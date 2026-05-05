/**
 * Graph — read-only force-directed network of systems + entities + APIs.
 *
 * Sister view to Diagramm. Where Diagramm shows curator-positioned cards
 * with attribute rows, Graph shows the same data as small dots-and-lines
 * with an animated d3-force simulation. Skips attribute nodes — those
 * live inside their parent entity in Diagramm.
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
 * Layout: d3.forceSimulation. We tried ELK 'force' and ELK 'stress' first;
 * both took 20+ seconds on IBPDI-scale graphs (263 nodes / 640 edges) and
 * blocked the main thread. d3-force converges in ~2-3 s with smooth
 * animation thanks to a quadtree-accelerated O(n log n) n-body force.
 *
 * Rendering: plain SVG. Elements are created once in `buildDom()` and the
 * simulation's tick handler only mutates `transform` / `x1y1x2y2` — no
 * re-render per frame, no garbage churn, no layout thrash.
 *
 * Pan/zoom + selection lifted from canvas.js patterns; clicking a graph
 * node calls State.setSelected, panel picks it up the same way Diagramm
 * does.
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

    // Live positions, keyed by graph-node id (system labels are prefixed
    // with `sys::` so they don't collide with entity ids). The simulation's
    // tick handler updates this in place; pan/zoom/selection read from it.
    var positions = Object.create(null);

    var translateX = 0, translateY = 0, scale = 1;
    var MIN_SCALE = 0.05, MAX_SCALE = 4.0;
    var WHEEL_ZOOM_OUT = 0.92, WHEEL_ZOOM_IN = 1.08;
    var ZOOM_FACTOR = 1.25;

    var SVG_NS = 'http://www.w3.org/2000/svg';

    // Active simulation. Stopped + recreated on every state change.
    var simulation = null;
    // Cached element refs so the tick handler skips DOM lookups.
    var nodeEls = Object.create(null); // id → <g>
    var edgeRefs = [];                 // [{el, source, target}]
    // Has the user triggered any work? Used to suppress the post-load fit
    // when nothing is on screen yet.
    var layoutToken = 0;
    // Auto-fit during simulation ticks until the user grabs the camera —
    // network graphs spread well beyond their seed bbox as the simulation
    // runs, so without periodic refits nodes drift off-screen mid-animation.
    // Once the user pans or zooms, we yield camera control entirely.
    var userControlsCamera = false;
    var tickCounter = 0;

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
        var btnIn    = document.getElementById('graph-zoom-in');
        var btnOut   = document.getElementById('graph-zoom-out');
        var btnReset = document.getElementById('graph-zoom-reset');
        var btnFit   = document.getElementById('graph-zoom-fit');
        if (btnIn)    btnIn.addEventListener('click',    function () { zoomAt(scale * ZOOM_FACTOR); });
        if (btnOut)   btnOut.addEventListener('click',   function () { zoomAt(scale / ZOOM_FACTOR); });
        // Reset = "back to overview" — refits everything visible. Graph has
        // no curator-set home view (layout is auto-computed), so reset and
        // fit do the same thing here. Reset also re-enables auto-tracking
        // so a still-running simulation refocuses the camera.
        if (btnReset) btnReset.addEventListener('click', function () {
            userControlsCamera = false;
            fitToScreen();
        });
        if (btnFit)   btnFit.addEventListener('click',   fitToScreen);

        // State events that change the graph — recompute layout. Selection
        // and filter changes are cheap (CSS class toggles only), so they
        // bypass layout.
        State.on(function (reason) {
            if (reason === 'view') {
                if (State.getView() === 'graph') {
                    // Lazy first layout: graph view just became active.
                    if (!Object.keys(positions).length) scheduleLayout();
                    else applyTransform();
                } else {
                    // Leaving graph view: stop the simulation so we don't
                    // waste cycles ticking + writing transforms to a hidden
                    // SVG (and racing any future re-entry into the view).
                    // Positions stay so re-entering shows the existing
                    // layout rather than re-running from a seed.
                    stopSimulation();
                }
                return;
            }
            // Only rebuild when graph view is current — saves a layout pass
            // while the user is editing in Diagramm.
            if (State.getView() !== 'graph') return;
            if (reason === 'replace' || reason === 'reset' ||
                reason === 'nodes' || reason === 'edges') {
                scheduleLayout();
            } else if (reason === 'filter') {
                // Filter changes don't move nodes — just dim non-matching
                // ones in place so the user can compare matching vs.
                // unmatched without losing the spatial layout. Same UX
                // pattern as Canvas/Diagramm's applyFilterDim.
                applyFilterDim();
            } else if (reason === 'selection') {
                renderSelection();
            }
        });

        // Initial transform write so the SVG transform attribute exists.
        applyTransform();
    }

    // ---- Layout ---------------------------------------------------------
    //
    // d3.forceSimulation. The simulation iterates on its own internal
    // timer; each tick we mutate live `positions` + the cached SVG element
    // attributes in place. No re-render, no DOM churn — just transform
    // attribute writes per node and x1/y1/x2/y2 writes per edge.
    //
    // Forces:
    //   link        spring along publish + flow edges (publish edges are
    //               stiffer so each system's entities cluster around it)
    //   charge      n-body repulsion (negative strength = push apart)
    //   center      weak gravity to (0,0) so the graph stays framed
    //   collide     hard collision based on each node's display radius
    //
    // Seed: hub-and-spoke initial positions (systems on a big circle,
    // entities on smaller rings) so the simulation starts from a sane
    // configuration rather than chaos at the origin — this cuts visible
    // settling time roughly in half on dense graphs.

    /**
     * Build datum arrays for d3 from State. Filters are NOT applied at
     * this stage — they used to be, which meant every filter change
     * triggered a full re-layout (~2.5 s of animation from a fresh seed).
     * The current model mirrors Canvas/Diagramm: include every node + edge
     * in the simulation, then `applyFilterDim()` toggles a CSS class on
     * non-matching ones for in-place dimming. Layout stays stable across
     * filter changes; feedback is instant.
     * Returns { simNodes, simLinks, idIndex, systemMembers }.
     */
    function buildSimData() {
        var nodes = State.getNodes();
        var edges = State.getEdges();

        var simNodes = [];
        var idIndex = Object.create(null);
        var systemMembers = Object.create(null);

        nodes.forEach(function (n) {
            var typeKey = n.type || 'table';
            var d = {
                id:     n.id,
                kind:   typeKey === 'api' ? 'api' : 'entity',
                type:   typeKey,
                label:  n.label || n.id,
                sys:    (n.system || '').trim() || null,
                radius: typeKey === 'api' ? 14 : 12
            };
            simNodes.push(d);
            idIndex[d.id] = d;
            if (d.sys) (systemMembers[d.sys] = systemMembers[d.sys] || []).push(d.id);
        });

        // System hubs as nodes — only systems with at least one visible
        // member.
        Object.keys(systemMembers).forEach(function (sys) {
            var d = {
                id:     'sys::' + sys,
                kind:   'system',
                sys:    sys,
                label:  sys,
                radius: 26
            };
            simNodes.push(d);
            idIndex[d.id] = d;
        });

        // Links. d3.forceLink resolves source/target strings to node refs
        // on init, so passing ids is fine.
        var simLinks = [];
        Object.keys(systemMembers).forEach(function (sys) {
            systemMembers[sys].forEach(function (eid) {
                simLinks.push({
                    source: 'sys::' + sys,
                    target: eid,
                    kind:   'publishes'
                });
            });
        });
        edges.forEach(function (e) {
            if (e.from === e.to) return;
            if (!idIndex[e.from] || !idIndex[e.to]) return;
            simLinks.push({
                source: e.from,
                target: e.to,
                kind:   'flows'
            });
        });

        return {
            simNodes:      simNodes,
            simLinks:      simLinks,
            idIndex:       idIndex,
            systemMembers: systemMembers
        };
    }

    /**
     * Seed initial positions in a hub-and-spoke pattern so the simulation
     * starts from a sane configuration. Mutates `simNodes` in place.
     */
    function seedPositions(simNodes, systemMembers) {
        var systemNames = Object.keys(systemMembers).sort();
        var sysCount = systemNames.length;
        var systemRadius = sysCount > 1 ? Math.max(400, sysCount * 120) : 0;

        var sysPos = Object.create(null);
        systemNames.forEach(function (sys, i) {
            var angle = sysCount > 1
                ? (2 * Math.PI * i) / sysCount - Math.PI / 2
                : 0;
            sysPos[sys] = {
                x: sysCount > 1 ? Math.cos(angle) * systemRadius : 0,
                y: sysCount > 1 ? Math.sin(angle) * systemRadius : 0,
                angle: angle
            };
        });

        var entityCounts = Object.create(null);
        simNodes.forEach(function (d) {
            if (d.kind === 'system') {
                var s = sysPos[d.sys];
                d.x = s ? s.x : 0;
                d.y = s ? s.y : 0;
            } else if (d.sys) {
                entityCounts[d.sys] = (entityCounts[d.sys] || 0) + 1;
            }
        });

        var sysIdxCounter = Object.create(null);
        simNodes.forEach(function (d) {
            if (d.kind === 'system') return;
            if (d.sys && sysPos[d.sys]) {
                var s = sysPos[d.sys];
                var total = entityCounts[d.sys] || 1;
                var i = (sysIdxCounter[d.sys] = (sysIdxCounter[d.sys] || 0) + 1) - 1;
                var minSpacing = 50;
                var ringR = Math.max(140, (total * minSpacing) / (2 * Math.PI));
                var ringStart = sysCount > 1 ? s.angle : -Math.PI / 2;
                var ang = ringStart + (2 * Math.PI * i) / total;
                d.x = s.x + Math.cos(ang) * ringR;
                d.y = s.y + Math.sin(ang) * ringR;
            } else {
                // Orphan: stack below in a column.
                d.x = 0;
                d.y = (systemRadius || 0) + 400 + (Math.random() - 0.5) * 60;
            }
        });
    }

    /** Stop and discard any in-flight simulation. */
    function stopSimulation() {
        if (simulation) {
            simulation.on('tick', null).on('end', null);
            simulation.stop();
            simulation = null;
        }
    }

    /**
     * Build SVG elements from the sim datum arrays. Run once per layout —
     * the simulation tick handler then only mutates attributes, never
     * touches the DOM tree.
     */
    function buildDom(simNodes, simLinks) {
        edgesGroup.innerHTML = '';
        nodesGroup.innerHTML = '';
        nodeEls = Object.create(null);
        edgeRefs = [];

        // Edges first so nodes paint above them.
        simLinks.forEach(function (l) {
            // After d3.forceLink resolves, source/target are datum objects.
            // Before resolution they're strings; we'll read .x / .y in tick.
            var line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('class', 'graph-edge graph-edge--' +
                (l.kind === 'publishes' ? 'publishes' : 'flows'));
            edgesGroup.appendChild(line);
            edgeRefs.push({ el: line, link: l });
        });

        // Nodes.
        simNodes.forEach(function (d) {
            var g;
            if (d.kind === 'system') {
                g = createSystemNode(d.sys, { x: d.x, y: d.y });
            } else {
                g = createEntityNode(
                    { id: d.id, type: d.type, label: d.label },
                    { x: d.x, y: d.y }
                );
            }
            nodesGroup.appendChild(g);
            nodeEls[d.id] = g;
        });
    }

    /**
     * Per-tick attribute updates. Runs at ~60 Hz during simulation. Pure
     * attribute writes — no DOM mutation, no node creation — so the cost
     * is roughly (nodes + edges) × constant.
     */
    function onTick(simNodes) {
        for (var i = 0; i < simNodes.length; i++) {
            var d = simNodes[i];
            var el = nodeEls[d.id];
            if (el) el.setAttribute('transform', 'translate(' + d.x + ',' + d.y + ')');
            positions[d.id] = { x: d.x, y: d.y };
        }
        for (var j = 0; j < edgeRefs.length; j++) {
            var ref = edgeRefs[j];
            var s = ref.link.source;
            var t = ref.link.target;
            if (!s || !t || typeof s !== 'object' || typeof t !== 'object') continue;
            ref.el.setAttribute('x1', s.x);
            ref.el.setAttribute('y1', s.y);
            ref.el.setAttribute('x2', t.x);
            ref.el.setAttribute('y2', t.y);
        }
        // Soft auto-fit: every 4 ticks while the user hasn't grabbed the
        // camera, recentre + rescale to keep the spreading graph framed.
        // ~15 fits/sec is smooth without being expensive (bbox calc is O(n)).
        tickCounter++;
        if (!userControlsCamera && (tickCounter & 3) === 0) {
            fitToScreen();
        }
    }

    /**
     * Kick off / restart the layout. Stops any running simulation, rebuilds
     * the data + DOM, then starts a fresh d3.forceSimulation with seeded
     * positions.
     */
    function scheduleLayout() {
        if (typeof d3 === 'undefined' || !d3.forceSimulation) {
            console.error('Graph: d3 not available');
            return;
        }
        stopSimulation();
        layoutToken++;
        userControlsCamera = false;
        tickCounter = 0;

        if (emptyEl) emptyEl.setAttribute('hidden', '');

        var data = buildSimData();
        if (data.simNodes.length === 0) {
            positions = Object.create(null);
            renderEmpty();
            return;
        }

        // Seed before the simulation reads positions so the very first
        // frame (before any ticks land) shows the hub-and-spoke pattern.
        seedPositions(data.simNodes, data.systemMembers);

        // Reset positions to seeded values + build fresh DOM.
        positions = Object.create(null);
        data.simNodes.forEach(function (d) { positions[d.id] = { x: d.x, y: d.y }; });
        buildDom(data.simNodes, data.simLinks);
        renderSelection();
        // Apply current filter state to the freshly-built DOM so any
        // active filter dim is in effect from the first paint, not after
        // the user touches the filter UI.
        applyFilterDim();
        // Initial fit so the seeded layout is centred before ticks start.
        fitToScreen();

        if (loadingEl) loadingEl.removeAttribute('hidden');

        var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

        simulation = d3.forceSimulation(data.simNodes)
            .force('link', d3.forceLink(data.simLinks)
                .id(function (d) { return d.id; })
                // Publish edges keep entities tethered to their system hub
                // but with enough length that 80-entity clusters don't
                // collapse into an unreadable blob. Flow edges are longer
                // and softer so cross-cluster lineage doesn't drag clusters
                // into each other.
                .distance(function (l) { return l.kind === 'publishes' ? 140 : 240; })
                .strength(function (l) { return l.kind === 'publishes' ? 0.5 : 0.15; }))
            .force('charge', d3.forceManyBody()
                // Strong repulsion all-around so labels don't overlap. For
                // 263 nodes this is the dominant force shaping spread.
                .strength(function (d) { return d.kind === 'system' ? -2200 : -500; })
                // Cap distance prevents far-side nodes from exerting force
                // that would inflate the bbox without benefit — keeps the
                // graph compact while still pushing neighbours apart.
                .distanceMax(800))
            .force('center', d3.forceCenter(0, 0).strength(0.04))
            .force('collide', d3.forceCollide()
                // Bigger buffer so labels (rendered ~24 px below each
                // circle) clear adjacent nodes' circles.
                .radius(function (d) { return d.radius + 18; })
                .strength(0.9))
            // alphaDecay 0.04 → ~150 ticks until alpha hits the default
            // alphaMin (0.001). On a 60 fps tick rate that's ~2.5 s of
            // visible animation — long enough to feel "alive", short
            // enough to settle quickly.
            .alphaDecay(0.04)
            .velocityDecay(0.4)
            .on('tick', function () { onTick(data.simNodes); })
            .on('end', function () {
                if (loadingEl) loadingEl.setAttribute('hidden', '');
                fitToScreen();
                var t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
                if (window.console && console.debug) {
                    console.debug('Graph: d3-force settled',
                        data.simNodes.length + ' nodes,',
                        data.simLinks.length + ' edges,',
                        Math.round(t1 - t0) + 'ms');
                }
            });
    }

    function renderEmpty() {
        edgesGroup.innerHTML = '';
        nodesGroup.innerHTML = '';
        if (loadingEl) loadingEl.setAttribute('hidden', '');
        if (emptyEl)   emptyEl.removeAttribute('hidden');
    }

    // ---- Node DOM helpers ----------------------------------------------
    // Used by buildDom() to create the <g> wrappers for systems + entities.
    // Per-tick updates only mutate the `transform` attribute on these — the
    // child <circle> + <text> stay put.

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

    /**
     * Apply or clear the `is-filtered-out` class on every node + edge
     * based on the current filter state. Mirrors Canvas/Diagramm's
     * applyFilterDim — non-matching nodes stay in place but fade, so the
     * user keeps the spatial layout while seeing what matches. System
     * hubs are filtered out only if every member is filtered (otherwise
     * they're still relevant context for the visible entities).
     *
     * Edges fade if either endpoint is filtered out. Cheap operation —
     * pure attribute toggling, no layout, no DOM rebuild.
     */
    function applyFilterDim() {
        if (!nodesGroup || !edgesGroup) return;
        var filtersActive = State.hasActiveFilters();
        if (!filtersActive) {
            nodesGroup.querySelectorAll('.is-filtered-out').forEach(function (g) {
                g.classList.remove('is-filtered-out');
            });
            edgesGroup.querySelectorAll('.is-filtered-out').forEach(function (l) {
                l.classList.remove('is-filtered-out');
            });
            rootEl.classList.remove('has-filters');
            return;
        }

        // Build matched-id set in one pass over State nodes — O(n) instead
        // of calling matchesFilters() per DOM lookup.
        var matched = Object.create(null);
        State.getNodes().forEach(function (n) {
            if (State.matchesFilters(n)) matched[n.id] = true;
        });

        // Track per-system survival so a system hub fades only when none
        // of its members survived the filter.
        var systemSurvives = Object.create(null);
        State.getNodes().forEach(function (n) {
            var sys = (n.system || '').trim();
            if (sys && matched[n.id]) systemSurvives[sys] = true;
        });

        nodesGroup.querySelectorAll('.graph-node').forEach(function (g) {
            var nodeId = g.getAttribute('data-node-id');
            var sysName = g.getAttribute('data-system');
            var keep;
            if (nodeId)        keep = matched[nodeId] === true;
            else if (sysName)  keep = systemSurvives[sysName] === true;
            else               keep = false;
            g.classList.toggle('is-filtered-out', !keep);
        });

        // Edges: fade when either endpoint is filtered. edgeRefs holds
        // the source/target objects (post d3.forceLink resolution) so
        // we can check membership without DOM crawling.
        edgeRefs.forEach(function (ref) {
            var s = ref.link.source;
            var t = ref.link.target;
            var sid = (typeof s === 'object') ? s.id : s;
            var tid = (typeof t === 'object') ? t.id : t;
            // System hub endpoint: keep when the cluster has any
            // surviving member (matches its node's keep rule).
            function keepEnd(id) {
                if (!id) return false;
                if (id.indexOf('sys::') === 0) {
                    return systemSurvives[id.slice(5)] === true;
                }
                return matched[id] === true;
            }
            var keep = keepEnd(sid) && keepEnd(tid);
            ref.el.classList.toggle('is-filtered-out', !keep);
        });

        rootEl.classList.add('has-filters');
    }

    function renderSelection() {
        var sel = State.getSelection();
        var selNodeId = sel && sel.kind === 'node' ? sel.id : null;
        var selSys    = sel && sel.kind === 'system' ? sel.name : null;
        // Attribute selection in Graph isn't a thing today, but treat the
        // attribute's parent node as the focal subject if one ever lands.
        var nodeFocus = selNodeId ||
            (sel && sel.kind === 'attribute' ? sel.nodeId : null);

        // Selection class — bolder treatment is in CSS, see .is-selected.
        // The explicit null guards matter: entity <g>s have no data-system
        // attribute (returns null) and system <g>s have no data-node-id
        // (also null). Without the guards, `null === null` evaluates true
        // and every entity becomes "selected" the moment any node is
        // selected (and vice-versa for system selection). Old blue-on-blue
        // selection style hid this; the new red selection makes it loud.
        nodesGroup.querySelectorAll('.graph-node').forEach(function (g) {
            var nodeAttr = g.getAttribute('data-node-id');
            var sysAttr  = g.getAttribute('data-system');
            var isNode = selNodeId !== null && nodeAttr === selNodeId;
            var isSys  = selSys    !== null && sysAttr  === selSys;
            g.classList.toggle('is-selected', isNode || isSys);
        });

        applySpotlight(nodeFocus, selSys);
    }

    /**
     * Spotlight: dim non-related nodes/edges, highlight 1st-degree
     * neighbours of the focal subject. Pure DOM toggling — visual
     * styling lives in CSS under `.graph-canvas.is-spotlighting`.
     *
     * For node focus: neighbours = nodes on the other end of any edge.
     * For system focus: neighbours = all entities published by the
     * system (the synthesised publish edges already encode this — every
     * entity in the cluster has a publish edge from sys::<name>).
     */
    function applySpotlight(nodeFocus, selSys) {
        var spotlight = !!(nodeFocus || selSys);
        if (!spotlight) {
            rootEl.classList.remove('is-spotlighting');
            nodesGroup.querySelectorAll('.is-neighbour').forEach(function (g) {
                g.classList.remove('is-neighbour');
            });
            edgesGroup.querySelectorAll('.is-related').forEach(function (l) {
                l.classList.remove('is-related');
            });
            return;
        }

        var focalId = nodeFocus || ('sys::' + selSys);

        // Compute neighbour ids by walking the cached link list. After
        // d3.forceLink has resolved the link endpoints to datum objects,
        // .id is on each end; before resolution we accept string fallback.
        var neighbours = Object.create(null);
        edgeRefs.forEach(function (ref) {
            var s = ref.link.source;
            var t = ref.link.target;
            var sid = (typeof s === 'object') ? s.id : s;
            var tid = (typeof t === 'object') ? t.id : t;
            if (sid === focalId) neighbours[tid] = true;
            if (tid === focalId) neighbours[sid] = true;
        });

        nodesGroup.querySelectorAll('.graph-node').forEach(function (g) {
            var id = g.getAttribute('data-node-id') ||
                ('sys::' + g.getAttribute('data-system'));
            g.classList.toggle('is-neighbour',
                neighbours[id] === true && id !== focalId);
        });

        edgeRefs.forEach(function (ref) {
            var s = ref.link.source;
            var t = ref.link.target;
            var sid = (typeof s === 'object') ? s.id : s;
            var tid = (typeof t === 'object') ? t.id : t;
            var related = (sid === focalId || tid === focalId);
            ref.el.classList.toggle('is-related', related);
        });

        rootEl.classList.add('is-spotlighting');
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
        // Background click — selection preserved on purpose. The user
        // pans / explores with the current selection still spotlighted;
        // deselection requires either picking a different node or
        // clicking the × on the info panel.
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
        userControlsCamera = true; // stop auto-fit while sim is still running
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
        userControlsCamera = true;
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
            // Match Diagramm's "10% · Karte" label format — the second
            // segment names the active visualisation so the user always
            // knows which view they're zooming.
            var pct = Math.round(scale * 100);
            zoomLabelEl.textContent = pct + '% · Netzwerk';
        }
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    return {
        init: init,
        // Exposed so app.js can trigger a layout when loadAndRender
        // finishes. The 'view' event from applyUrlToState fires BEFORE
        // State.load() populates nodes — that initial scheduleLayout
        // hits empty data, paints renderEmpty(), and increments
        // layoutToken. Without this fallback the canvas would stay on
        // "Keine Knoten" forever (State.load doesn't emit 'replace' on
        // success, so the listener-driven re-schedule never fires).
        //
        // Bail conditions: positions already computed (a real layout has
        // landed) OR a simulation is currently running (don't disturb it).
        // Re-running while empty is safe — scheduleLayout's first action
        // is stopSimulation().
        ensureLayout: function () {
            if (Object.keys(positions).length) return;
            if (simulation) return;
            scheduleLayout();
        }
    };
})();
