/**
 * Graph — read-only force-laid-out network of systems + entities + APIs.
 *
 * Sister view to Diagramm. Where Diagramm shows curator-positioned cards
 * with attribute rows, Graph shows the same data as small dots-and-lines
 * with an automatic ELK force layout. Skips attribute nodes — those live
 * inside their parent entity in Diagramm.
 *
 * Three node tiers:
 *   system   — one per unique node.system label, larger circle
 *   entity   — every distribution that isn't an API (table / view / file /
 *              codelist), medium circle, coloured by type
 *   api      — distribution with type === 'api', medium circle
 *
 * Edges:
 *   system → entity   (publishes — derived from each entity's `system`)
 *   entity → entity   (flows_into — taken from State.getEdges())
 *
 * Layout: ELK 'force' algorithm, computed async on first view-enter and
 * any subsequent state change. Pan/zoom + selection lifted from canvas.js
 * patterns; rendering is plain SVG so the existing State selection model
 * works unchanged (clicking a graph node calls State.setSelected, panel
 * picks it up the same way Diagramm does).
 *
 * Read-only: no drag, no inline edit, no edge drawing. Editing happens
 * in Diagramm.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Graph = (function () {

    var State = null;
    var Util  = null;

    var rootEl = null;
    var svgEl = null;
    var transformEl = null;
    var nodesGroup = null;
    var edgesGroup = null;
    var loadingEl = null;
    var emptyEl = null;
    var tooltipEl = null;
    var zoomLabelEl = null;

    // Last-laid-out positions, keyed by graph-node id (system labels are
    // prefixed with `sys::` so they don't collide with entity ids). We
    // keep this so we can re-render selection / hover without re-running
    // the layout.
    var positions = Object.create(null);

    var translateX = 0, translateY = 0, scale = 1;
    var MIN_SCALE = 0.05, MAX_SCALE = 4.0;
    var WHEEL_ZOOM_OUT = 0.92, WHEEL_ZOOM_IN = 1.08;
    var ZOOM_FACTOR = 1.25;

    var SVG_NS = 'http://www.w3.org/2000/svg';

    // Layout-rerun bookkeeping — ELK is async; if state changes mid-flight
    // we want the latest result to win even if an earlier layout finishes
    // after a newer one started.
    var layoutToken = 0;
    var elk = null;

    var inited = false;
    function init() {
        if (inited) return;
        inited = true;
        State = window.CanvasApp.State;
        Util  = window.CanvasApp.Util;

        rootEl       = document.getElementById('graph-canvas');
        svgEl        = document.getElementById('graph-svg');
        transformEl  = document.getElementById('graph-transform');
        nodesGroup   = document.getElementById('graph-nodes');
        edgesGroup   = document.getElementById('graph-edges');
        loadingEl    = document.getElementById('graph-loading');
        emptyEl      = document.getElementById('graph-empty');
        tooltipEl    = document.getElementById('graph-tooltip');
        zoomLabelEl  = document.getElementById('graph-zoom-level');
        if (!rootEl || !svgEl || !nodesGroup || !edgesGroup) return;

        // Pan / zoom — same patterns as canvas.js but scoped to the SVG.
        rootEl.addEventListener('pointerdown', onPanStart);
        window.addEventListener('pointermove', onPanMove);
        window.addEventListener('pointerup', onPanEnd);
        window.addEventListener('pointercancel', onPanEnd);
        rootEl.addEventListener('wheel', onWheel, { passive: false });

        // Selection + tooltip via event delegation on the SVG.
        svgEl.addEventListener('click', onGraphClick);
        svgEl.addEventListener('pointermove', onGraphPointerMove);
        svgEl.addEventListener('pointerleave', hideTooltip);

        // Toolbar
        var btnIn  = document.getElementById('graph-zoom-in');
        var btnOut = document.getElementById('graph-zoom-out');
        var btnFit = document.getElementById('graph-zoom-fit');
        if (btnIn)  btnIn.addEventListener('click',  function () { zoomAt(scale * ZOOM_FACTOR); });
        if (btnOut) btnOut.addEventListener('click', function () { zoomAt(scale / ZOOM_FACTOR); });
        if (btnFit) btnFit.addEventListener('click', fitToScreen);

        // State events that change the graph — recompute layout. Selection
        // is cheap (just toggle a class), so it bypasses layout.
        State.on(function (reason) {
            if (reason === 'view') {
                if (State.getView() === 'graph') {
                    // Lazy first layout: graph view just became active.
                    if (!Object.keys(positions).length) scheduleLayout();
                    else applyTransform();
                }
                return;
            }
            // Only rebuild when graph view is current — saves a layout pass
            // while the user is editing in Diagramm.
            if (State.getView() !== 'graph') return;
            if (reason === 'replace' || reason === 'reset' ||
                reason === 'nodes' || reason === 'edges' || reason === 'filter') {
                scheduleLayout();
            } else if (reason === 'selection') {
                renderSelection();
            }
        });

        // Initial transform write so the SVG transform attribute exists.
        applyTransform();
    }

    // ---- Layout ---------------------------------------------------------

    /**
     * Lazy-init the ELK instance (same shape as autolayout.js — first
     * construction creates the internal worker). Returns null if ELK
     * itself failed to load.
     */
    function getElk() {
        if (elk) return elk;
        if (typeof ELK !== 'function') return null;
        try { elk = new ELK(); return elk; }
        catch (err) { console.error('Graph: ELK construction failed', err); return null; }
    }

    /**
     * Build the ELK input graph from State. Three node tiers + the two
     * edge kinds (system→entity publishes, entity→entity flows_into).
     * Filter-aware: when filters are active, drop entities/APIs that
     * don't match; system nodes only emit if at least one of their
     * members survives the filter.
     */
    function buildElkInput() {
        var nodes = State.getNodes();
        var edges = State.getEdges();
        var filtersActive = State.hasActiveFilters();

        // 1. Entity + API nodes that pass the filter (skip codelist + skip
        // attributes — attributes don't appear in State.getNodes; they're
        // inlined as `n.columns`).
        // Codelists are kept as entity-tier nodes so cross-references
        // ("flows_into a codelist") remain visible.
        var entityNodes = [];
        var entityIds = Object.create(null);
        var systemMembers = Object.create(null);
        nodes.forEach(function (n) {
            if (filtersActive && !State.matchesFilters(n)) return;
            entityNodes.push(n);
            entityIds[n.id] = true;
            var sys = (n.system || '').trim();
            if (sys) (systemMembers[sys] = systemMembers[sys] || []).push(n.id);
        });

        // 2. System nodes — one per system that still has visible members.
        var systemIds = Object.keys(systemMembers).map(function (s) {
            return 'sys::' + s;
        });

        // 3. Node specs for ELK.
        var elkNodes = [];
        // Systems are the larger anchors. Sized bigger so ELK gives them
        // gravitational presence in the force layout.
        Object.keys(systemMembers).forEach(function (sys) {
            elkNodes.push({ id: 'sys::' + sys, width: 80, height: 80 });
        });
        entityNodes.forEach(function (n) {
            elkNodes.push({ id: n.id, width: 40, height: 40 });
        });

        // 4. Edges. ELK requires unique ids per edge.
        var elkEdges = [];
        var edgeCounter = 0;
        // 4a. system → entity (publishes)
        Object.keys(systemMembers).forEach(function (sys) {
            systemMembers[sys].forEach(function (entityId) {
                elkEdges.push({
                    id: 'pe' + (edgeCounter++),
                    sources: ['sys::' + sys],
                    targets: [entityId]
                });
            });
        });
        // 4b. entity → entity (flows_into) — drop self-loops + edges whose
        // endpoints didn't survive the filter.
        edges.forEach(function (e) {
            if (e.from === e.to) return;
            if (!entityIds[e.from] || !entityIds[e.to]) return;
            elkEdges.push({
                id: 'fe' + (edgeCounter++),
                sources: [e.from],
                targets: [e.to]
            });
        });

        return {
            id: 'root',
            layoutOptions: {
                'elk.algorithm':                  'force',
                'elk.force.iterations':           '300',
                'elk.spacing.nodeNode':           '60',
                'elk.spacing.componentComponent': '120'
            },
            children: elkNodes,
            edges: elkEdges
        };
    }

    /**
     * Run the layout. Async — ELK runs in its internal worker. Updates
     * `positions` and re-renders. Layout-token gates so a fast sequence
     * of state changes doesn't paint stale results.
     */
    function scheduleLayout() {
        var elkInst = getElk();
        var input = buildElkInput();
        var hasNodes = input.children.length > 0;

        // Empty graph short-circuit.
        if (!hasNodes) {
            positions = Object.create(null);
            renderEmpty();
            return;
        }
        if (!elkInst) {
            console.error('Graph: ELK not available');
            return;
        }

        var myToken = ++layoutToken;
        if (loadingEl) loadingEl.removeAttribute('hidden');
        if (emptyEl)   emptyEl.setAttribute('hidden', '');

        elkInst.layout(input).then(function (result) {
            if (myToken !== layoutToken) return; // newer layout took over
            positions = Object.create(null);
            (result.children || []).forEach(function (c) {
                positions[c.id] = { x: c.x || 0, y: c.y || 0 };
            });
            if (loadingEl) loadingEl.setAttribute('hidden', '');
            render();
            fitToScreen();
        }, function (err) {
            if (myToken !== layoutToken) return;
            console.error('Graph: ELK layout failed', err);
            if (loadingEl) loadingEl.setAttribute('hidden', '');
        });
    }

    function renderEmpty() {
        edgesGroup.innerHTML = '';
        nodesGroup.innerHTML = '';
        if (loadingEl) loadingEl.setAttribute('hidden', '');
        if (emptyEl)   emptyEl.removeAttribute('hidden');
    }

    // ---- Render ---------------------------------------------------------

    function render() {
        if (emptyEl) emptyEl.setAttribute('hidden', '');

        edgesGroup.innerHTML = '';
        nodesGroup.innerHTML = '';

        var nodes = State.getNodes();
        var edges = State.getEdges();
        var filtersActive = State.hasActiveFilters();

        // Build a quick id → State node lookup for node lookups.
        var byId = Object.create(null);
        nodes.forEach(function (n) { byId[n.id] = n; });

        // ---- Edges first (so nodes paint above) ----
        var systemMembers = Object.create(null);
        nodes.forEach(function (n) {
            if (filtersActive && !State.matchesFilters(n)) return;
            var sys = (n.system || '').trim();
            if (sys) (systemMembers[sys] = systemMembers[sys] || []).push(n.id);
        });

        // system → entity edges (publishes)
        Object.keys(systemMembers).forEach(function (sys) {
            var sysId = 'sys::' + sys;
            var sp = positions[sysId];
            if (!sp) return;
            systemMembers[sys].forEach(function (entityId) {
                var ep = positions[entityId];
                if (!ep) return;
                var line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('class', 'graph-edge graph-edge--publishes');
                line.setAttribute('x1', sp.x);
                line.setAttribute('y1', sp.y);
                line.setAttribute('x2', ep.x);
                line.setAttribute('y2', ep.y);
                edgesGroup.appendChild(line);
            });
        });

        // entity → entity edges (flows_into)
        edges.forEach(function (e) {
            if (e.from === e.to) return;
            var fromN = byId[e.from], toN = byId[e.to];
            if (!fromN || !toN) return;
            if (filtersActive && (!State.matchesFilters(fromN) || !State.matchesFilters(toN))) return;
            var fp = positions[e.from], tp = positions[e.to];
            if (!fp || !tp) return;
            var line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('class', 'graph-edge graph-edge--flows');
            line.setAttribute('x1', fp.x);
            line.setAttribute('y1', fp.y);
            line.setAttribute('x2', tp.x);
            line.setAttribute('y2', tp.y);
            edgesGroup.appendChild(line);
        });

        // ---- Nodes ----
        // Systems first (drawn under entity dots — entities render on top).
        Object.keys(systemMembers).forEach(function (sys) {
            var sysId = 'sys::' + sys;
            var p = positions[sysId];
            if (!p) return;
            var g = createSystemNode(sys, p);
            nodesGroup.appendChild(g);
        });
        // Entities + APIs.
        nodes.forEach(function (n) {
            if (filtersActive && !State.matchesFilters(n)) return;
            var p = positions[n.id];
            if (!p) return;
            var g = createEntityNode(n, p);
            nodesGroup.appendChild(g);
        });

        renderSelection();
    }

    function createSystemNode(sys, p) {
        var g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'graph-node graph-node--system');
        g.setAttribute('data-system', sys);
        g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');

        var circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', 26);
        circle.setAttribute('class', 'graph-node-circle graph-node-circle--system');
        g.appendChild(circle);

        var label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('class', 'graph-node-label graph-node-label--system');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('y', 44);
        label.textContent = sys;
        g.appendChild(label);
        return g;
    }

    function createEntityNode(n, p) {
        var g = document.createElementNS(SVG_NS, 'g');
        var typeKey = n.type || 'table';
        // 'api' gets its own visual tier; everything else is "entity" but
        // coloured per-type via a CSS modifier class.
        var tier = typeKey === 'api' ? 'api' : 'entity';
        g.setAttribute('class',
            'graph-node graph-node--' + tier +
            ' graph-node--type-' + typeKey);
        g.setAttribute('data-node-id', n.id);
        g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');

        var circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', tier === 'api' ? 14 : 12);
        circle.setAttribute('class',
            'graph-node-circle graph-node-circle--' + tier);
        g.appendChild(circle);

        var label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('class', 'graph-node-label graph-node-label--entity');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('y', tier === 'api' ? 28 : 24);
        label.textContent = n.label || n.id;
        g.appendChild(label);
        return g;
    }

    function renderSelection() {
        var sel = State.getSelection();
        var selNodeId = sel && sel.kind === 'node' ? sel.id : null;
        var selSys    = sel && sel.kind === 'system' ? sel.name : null;
        nodesGroup.querySelectorAll('.graph-node').forEach(function (g) {
            var isNode = g.getAttribute('data-node-id') === selNodeId;
            var isSys  = g.getAttribute('data-system')  === selSys;
            g.classList.toggle('is-selected', isNode || isSys);
        });
    }

    // ---- Interaction ----------------------------------------------------

    function onGraphClick(e) {
        var node = e.target.closest('.graph-node--system');
        if (node) {
            State.setSelectedSystem(node.getAttribute('data-system'));
            return;
        }
        node = e.target.closest('.graph-node[data-node-id]');
        if (node) {
            State.setSelected(node.getAttribute('data-node-id'));
            return;
        }
        // Click on empty area clears selection.
        State.setSelected(null);
    }

    function onGraphPointerMove(e) {
        var node = e.target.closest('.graph-node');
        if (!node) { hideTooltip(); return; }
        var label;
        if (node.classList.contains('graph-node--system')) {
            label = node.getAttribute('data-system') + ' · System';
        } else {
            var id = node.getAttribute('data-node-id');
            var n = State.getNode(id);
            if (!n) { hideTooltip(); return; }
            label = (n.label || n.id) + ' · ' + Util.nodeTypeLabel(n.type);
        }
        showTooltip(e.clientX, e.clientY, label);
    }

    function showTooltip(clientX, clientY, text) {
        if (!tooltipEl) return;
        var r = rootEl.getBoundingClientRect();
        tooltipEl.textContent = text;
        // Position near cursor, inside the canvas bounds.
        tooltipEl.style.left = (clientX - r.left + 12) + 'px';
        tooltipEl.style.top  = (clientY - r.top  + 12) + 'px';
        tooltipEl.removeAttribute('hidden');
    }
    function hideTooltip() {
        if (tooltipEl) tooltipEl.setAttribute('hidden', '');
    }

    // ---- Pan / zoom -----------------------------------------------------
    // Lighter than canvas.js — single-pointer pan, wheel zoom, no pinch
    // (the graph view is read-only and desktop-first; touch viewers can
    // use the toolbar buttons).

    var isPanning = false;
    var panStart = null;

    function onPanStart(e) {
        // Don't start a pan if the click landed on a node — let click
        // through for selection. Click on empty SVG = pan.
        if (e.target && e.target.closest && e.target.closest('.graph-node')) return;
        if (e.button !== 0) return;
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY, tx: translateX, ty: translateY };
        rootEl.classList.add('is-panning');
        try { rootEl.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
    }
    function onPanMove(e) {
        if (!isPanning || !panStart) return;
        translateX = panStart.tx + (e.clientX - panStart.x);
        translateY = panStart.ty + (e.clientY - panStart.y);
        applyTransform();
    }
    function onPanEnd() {
        if (!isPanning) return;
        isPanning = false;
        panStart = null;
        rootEl.classList.remove('is-panning');
    }

    function onWheel(e) {
        e.preventDefault();
        var factor = e.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN;
        var newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
        var rect = rootEl.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        translateX = mx - (mx - translateX) * (newScale / scale);
        translateY = my - (my - translateY) * (newScale / scale);
        scale = newScale;
        applyTransform();
    }

    function zoomAt(target) {
        var rect = rootEl.getBoundingClientRect();
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var newScale = clamp(target, MIN_SCALE, MAX_SCALE);
        translateX = cx - (cx - translateX) * (newScale / scale);
        translateY = cy - (cy - translateY) * (newScale / scale);
        scale = newScale;
        applyTransform();
    }

    function fitToScreen() {
        if (!Object.keys(positions).length) return;
        var rect = rootEl.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) {
            requestAnimationFrame(fitToScreen);
            return;
        }
        // Bounding box of all node positions (approximate — circles add
        // ~26 px padding on each side; we add a generous margin).
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        Object.keys(positions).forEach(function (id) {
            var p = positions[id];
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
        var pad = 80;
        var w = (maxX - minX) + pad * 2;
        var h = (maxY - minY) + pad * 2;
        if (w <= 0 || h <= 0) return;
        var s = Math.min(rect.width / w, rect.height / h);
        scale = clamp(s, MIN_SCALE, MAX_SCALE);
        translateX = (rect.width  - (maxX + minX) * scale) / 2;
        translateY = (rect.height - (maxY + minY) * scale) / 2;
        applyTransform();
    }

    function applyTransform() {
        if (!transformEl) return;
        transformEl.setAttribute('transform',
            'translate(' + translateX + ',' + translateY + ') scale(' + scale + ')');
        if (zoomLabelEl) {
            var pct = Math.round(scale * 100);
            zoomLabelEl.textContent = pct + '%';
        }
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    return {
        init: init,
        // Exposed so app.js can trigger a layout when the user first
        // navigates to this view via URL (no 'view' event fires for an
        // initial load that lands directly on /graph).
        ensureLayout: function () {
            if (!Object.keys(positions).length) scheduleLayout();
        }
    };
})();
