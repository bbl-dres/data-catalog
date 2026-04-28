/**
 * Canvas — pan, zoom, node DOM rendering, SVG edge rendering.
 *
 * Pan/zoom apply a transform to .canvas-transform; nodes are positioned
 * absolutely in canvas coordinates. Edges are SVG paths drawn between
 * node bounding boxes and re-rendered on every move.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Canvas = (function () {

    var State = null;

    var canvasEl = null;
    var transformEl = null;
    var nodeLayer = null;
    var edgeLayer = null;
    var edgeOverlay = null;
    var groupLayer = null;
    var zoomLabel = null;

    var translateX = 0;
    var translateY = 0;
    var scale = 1;

    var MIN_SCALE = 0.05;
    var MAX_SCALE = 3.0;
    var ZOOM_STEP = 0.1;     // additive step for fine adjustments at scale ≥ 1
    var ZOOM_FACTOR = 1.25;  // multiplicative factor for button zoom

    var isPanning = false;
    var panStart = null;

    // Per-node property-set expansion state. Sets are expanded by default;
    // presence in `collapsedSets` means the user collapsed it. Module memory
    // only — refresh = back to default (expanded).
    var collapsedSets = Object.create(null);
    // Key includes the node id so the same setId collapsed on one node
    // doesn't drag every node's display along with it.
    function expandKey(nodeId, setId) { return nodeId + '|' + (setId || ''); }
    function isSetExpanded(nodeId, setId) {
        return collapsedSets[expandKey(nodeId, setId)] !== true;
    }
    function toggleSet(nodeId, setId) {
        var k = expandKey(nodeId, setId);
        if (collapsedSets[k]) delete collapsedSets[k]; // expand
        else collapsedSets[k] = true;                  // collapse
    }
    /** Bulk: expand or collapse every property set across every node. */
    function setAllSetsExpanded(expanded) {
        if (expanded) {
            collapsedSets = Object.create(null);
        } else {
            collapsedSets = Object.create(null);
            State.getNodes().forEach(function (n) {
                State.derivePropertySets(n).forEach(function (s) {
                    collapsedSets[expandKey(n.id, s.id)] = true;
                });
            });
        }
        // Toggle the existing .node-set elements rather than blowing away the
        // whole node-layer DOM and rebuilding (the previous behaviour rebuilt
        // every node, including its column rows, just to flip a class).
        if (nodeLayer) {
            var sets = nodeLayer.querySelectorAll('.node-set');
            for (var i = 0; i < sets.length; i++) {
                var setEl = sets[i];
                var nodeEl = setEl.closest('.node');
                if (!nodeEl) continue;
                var nodeId = nodeEl.getAttribute('data-node-id');
                var name = setEl.getAttribute('data-set');
                setEl.classList.toggle('is-expanded', isSetExpanded(nodeId, name));
            }
        }
        // Heights changed → system frames need re-measuring.
        renderGroups();
    }

    var isDragging = false;
    var dragNodeId = null;
    // Cursor-to-node offset in canvas (world) coordinates, captured at drag
    // start. applyDragMove re-reads the live transform via clientToCanvas so
    // a wheel-zoom or pinch mid-drag keeps the node under the cursor instead
    // of jumping (which the previous delta math + live `scale` divisor did).
    var dragCursorOffset = null;

    // rAF-coalesced pointer pipeline. Pan, drag, and pinch handlers stash
    // their latest input; one rAF per frame applies whichever gesture is
    // active.
    var pointerRafQueued = false;
    var pendingPointer = null;

    function schedulePointerFrame(kind) {
        if (!pendingPointer) pendingPointer = {};
        pendingPointer[kind] = true;
        if (pointerRafQueued) return;
        pointerRafQueued = true;
        requestAnimationFrame(flushPointerFrame);
    }

    function flushPointerFrame() {
        pointerRafQueued = false;
        var p = pendingPointer;
        pendingPointer = null;
        if (!p) return;
        // Pinch wins over pan when both could fire (two pointers down).
        if (p.pinch && pinchInitial && activePointers.size >= 2) {
            applyPinch();
            return;
        }
        if (isPanning && p.pan) {
            var pp = lastPanClient;
            translateX = panStart.tx + (pp.x - panStart.x);
            translateY = panStart.ty + (pp.y - panStart.y);
            applyTransform();
        }
        if (isDragging && p.drag) {
            var dp = lastDragClient;
            applyDragMove(dp.x, dp.y);
        }
    }

    // Latest pointer-client positions stashed by the move handler — read by
    // flushPointerFrame on its next tick.
    var lastPanClient = null;
    var lastDragClient = null;

    // Active pointers (touch fingers + mouse). Two simultaneous pointers
    // = pinch zoom; one = pan. Tracked so we can detect transitions and
    // ignore single-pointer pan logic during pinch.
    var activePointers = new Map();
    var pinchInitial = null; // { distance, scale, midClient: {x,y}, translate: {x,y} }

    function beginPinch() {
        var pts = [];
        activePointers.forEach(function (p) { pts.push(p); });
        if (pts.length < 2) return;
        var dx = pts[1].x - pts[0].x;
        var dy = pts[1].y - pts[0].y;
        var d = Math.hypot(dx, dy);
        if (d < 1) return;
        pinchInitial = {
            distance: d,
            scale: scale,
            midClient: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
            translate: { x: translateX, y: translateY }
        };
        canvasEl.classList.add('is-pinching');
    }

    function endPinch() {
        pinchInitial = null;
        canvasEl.classList.remove('is-pinching');
    }

    function applyPinch() {
        if (!pinchInitial) return;
        var pts = [];
        activePointers.forEach(function (p) { pts.push(p); });
        if (pts.length < 2) return;
        var dx = pts[1].x - pts[0].x;
        var dy = pts[1].y - pts[0].y;
        var d = Math.hypot(dx, dy);
        if (d < 1) return;
        var newScale = clamp(
            (d / pinchInitial.distance) * pinchInitial.scale,
            MIN_SCALE, MAX_SCALE
        );
        // Anchor the zoom to the gesture's initial midpoint — same trick the
        // wheel handler uses for cursor-anchored zoom. We hold the anchor
        // fixed in client-space and recompute translate from the initial
        // (translate, scale) so the zoom feels like it's centred on where
        // the user's fingers came down.
        var rect = canvasEl.getBoundingClientRect();
        var ax = pinchInitial.midClient.x - rect.left;
        var ay = pinchInitial.midClient.y - rect.top;
        translateX = ax - (ax - pinchInitial.translate.x) * (newScale / pinchInitial.scale);
        translateY = ay - (ay - pinchInitial.translate.y) * (newScale / pinchInitial.scale);
        scale = newScale;
        applyTransform();
    }

    // Codelists (Wertelisten) are first-class catalog entities but are
    // intentionally excluded from the diagram — every BBL table would
    // otherwise need a tail of FK edges into a tall code-value node and
    // the result is unreadable. They still live in the data, the
    // Tabelle/Wertelisten tab lists them, and we surface a badge on
    // attributes that reference one (see codelistRefsByNode below).
    function isOnCanvas(node) { return !!node && node.type !== 'codelist'; }

    // Cache: node-id → DOM element. Built fresh in renderNodes; the previous
    // pattern was a `nodeLayer.querySelector('[data-node-id="..."]')` per
    // edge endpoint per render and per drag tick. Multiplied across all
    // edges that's hundreds of selectors per frame on a non-trivial graph.
    var nodeElById = Object.create(null);

    // Index: nodeId → { columnName → codelistNode }. Built once per
    // renderNodes from the FK edges (edge.from = node, edge.to = codelist,
    // edge.label = column name). Lookup is O(1) per attribute row.
    var codelistRefsByNode = Object.create(null);
    function buildCodelistRefsIndex() {
        var idx = Object.create(null);
        var edges = State.getEdges();
        for (var i = 0; i < edges.length; i++) {
            var e = edges[i];
            var target = State.getNode(e.to);
            if (!target || target.type !== 'codelist') continue;
            if (!e.label) continue;
            if (!idx[e.from]) idx[e.from] = Object.create(null);
            idx[e.from][e.label] = target;
        }
        return idx;
    }
    function getNodeEl(id) {
        var cached = nodeElById[id];
        if (cached && cached.isConnected) return cached;
        // Fall back to DOM lookup when the cache is stale (e.g. between renders).
        var fresh = nodeLayer && nodeLayer.querySelector('[data-node-id="' + cssEscape(id) + '"]');
        if (fresh) nodeElById[id] = fresh;
        return fresh || null;
    }

    // Column-key labels — short text badges (PK / FK / UK / –)
    var KEY_LABELS = { PK: 'PK', FK: 'FK', UK: 'UK', '': '–' };

    // Type icons for nodes (inline SVG)
    var TYPE_ICONS = {
        table: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="5.5" y1="5.5" x2="5.5" y2="14.5"/></svg>',
        view:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>',
        api:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 1.5L2 9.5h6l-1 5L13.5 6.5h-6l1-5z"/></svg>',
        file:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H3.5a1 1 0 0 0-1 1V13.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L9 1.5z"/><polyline points="9 1.5 9 6 13.5 6"/></svg>',
        codelist: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="13" y2="3"/><line x1="6" y1="8" x2="13" y2="8"/><line x1="6" y1="13" x2="13" y2="13"/><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="3" cy="13" r="1.2" fill="currentColor"/></svg>'
    };

    var inited = false;
    function init(opts) {
        // Idempotent: a second init() (HMR, accidental double bootstrap)
        // would otherwise duplicate every window-level pointer listener and
        // double drag/pan deltas. Bail rather than wiring twice.
        if (inited) return;
        inited = true;
        State = window.CanvasApp.State;
        canvasEl = document.getElementById('canvas');
        transformEl = document.getElementById('canvas-transform');
        nodeLayer = document.getElementById('node-layer');
        edgeLayer = document.getElementById('edge-layer');
        edgeOverlay = document.getElementById('edge-overlay');
        groupLayer = document.getElementById('group-layer');
        zoomLabel = document.getElementById('zoom-level');

        // Pan
        canvasEl.addEventListener('pointerdown', onPanStart);
        window.addEventListener('pointermove', onPanMove);
        window.addEventListener('pointerup', onPanEnd);
        // pointercancel fires when the OS or browser yanks the gesture away
        // (incoming call, native gesture conflict, etc). Without this handler
        // isPanning / isDragging stay true until the next pointerup, leaving
        // the canvas in a ghost-drag state.
        window.addEventListener('pointercancel', onPanEnd);
        canvasEl.addEventListener('wheel', onWheel, { passive: false });

        // Node drag (delegated)
        nodeLayer.addEventListener('pointerdown', onNodePointerDown);
        // Keyboard selection: Enter / Space on a focused node selects it.
        nodeLayer.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var nodeEl = e.target.closest('.node');
            if (!nodeEl || nodeEl !== e.target) return;
            // Don't preempt typing in inline-edit fields
            if (e.target.matches && e.target.matches('input, textarea, [contenteditable="true"]')) return;
            e.preventDefault();
            var id = nodeEl.getAttribute('data-node-id');
            if (id) State.setSelected(id);
        });

        // System frame label click → select system
        groupLayer.addEventListener('click', function (e) {
            var label = e.target.closest('.group-box-label');
            if (!label) return;
            var box = label.closest('.group-box');
            var sys = box && box.getAttribute('data-system');
            if (sys) State.setSelectedSystem(sys);
        });

        // Toolbar
        document.getElementById('zoom-in').addEventListener('click', zoomIn);
        document.getElementById('zoom-out').addEventListener('click', zoomOut);
        document.getElementById('zoom-fit').addEventListener('click', fitToScreen);
        // zoom-reset is now Home (curated entry view, fallback to fit-with-floor).
        // Map convention: Home + Zoom Extent sit next to each other.
        document.getElementById('zoom-reset').addEventListener('click', goHome);
        var setHomeBtn = document.getElementById('zoom-home-set');
        if (setHomeBtn) {
            setHomeBtn.addEventListener('click', function () {
                if (setHomeFromCurrent()) {
                    var App = window.CanvasApp.App;
                    if (App && App.toast) App.toast('Startansicht gespeichert', 'success');
                }
            });
        }

        // State events
        State.on(function (reason) {
            if (reason === 'replace' || reason === 'reset') {
                collapsedSets = Object.create(null);
            }
            if (reason === 'nodes' || reason === 'edges' || reason === 'replace' || reason === 'reset') {
                renderAll();
                applyFilterDim();
            } else if (reason === 'selection') {
                updateNodeSelection();
                // Selection changes used to drive a full edge re-render
                // (querySelector × 2 per edge); now we only diff the two
                // affected edges between layers.
                updateEdgeSelection();
                focusSelectedEdgeInput();
            } else if (reason === 'filter') {
                applyFilterDim();
                // Filtered nodes are now display:none, not dimmed — system
                // frames must re-measure so an all-filtered system drops
                // its rectangle instead of leaving an empty box. rAF lets
                // the CSS hide settle before we read offsetParent.
                requestAnimationFrame(renderGroups);
            }
        });

        applyTransform();
    }

    // ---- Render --------------------------------------------------------

    function renderAll() {
        renderNodes();
        renderEdges();
        // Groups must render AFTER nodes so we can read real DOM heights
        renderGroups();
        updateNodeSelection();
    }

    var GROUP_PAD = 18;
    var GROUP_LABEL_H = 14; // visible height of label badge

    function buildGroupBoxFor(sysName, members) {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        var anyVisible = false;
        for (var i = 0; i < members.length; i++) {
            var n = members[i];
            var el = nodeElById[n.id] || (nodeLayer && nodeLayer.querySelector('[data-node-id="' + cssEscape(n.id) + '"]'));
            // offsetParent is null when the element (or any ancestor) is
            // display:none — that's our cue to skip hidden members so the
            // frame snaps to the visible nodes only.
            if (!el || el.offsetParent === null) continue;
            anyVisible = true;
            var w = el.offsetWidth;
            var h = el.offsetHeight;
            var x = n.x || 0;
            var y = n.y || 0;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        }
        if (!anyVisible || minX === Infinity) return null;

        var box = document.createElement('div');
        box.className = 'group-box';
        box.setAttribute('data-system', sysName);
        box.style.left = (minX - GROUP_PAD) + 'px';
        box.style.top = (minY - GROUP_PAD - GROUP_LABEL_H / 2) + 'px';
        box.style.width = (maxX - minX + GROUP_PAD * 2) + 'px';
        box.style.height = (maxY - minY + GROUP_PAD * 2 + GROUP_LABEL_H / 2) + 'px';

        var label = document.createElement('span');
        label.className = 'group-box-label';
        label.textContent = sysName;
        box.appendChild(label);
        return box;
    }

    function membersOfSystem(sysName) {
        var out = [];
        var nodes = State.getNodes();
        for (var i = 0; i < nodes.length; i++) {
            // Codelists share `system: 'BFS GWR'` with the GWR tables but
            // aren't drawn — exclude them so the system frame sizes to
            // visible members only.
            if (!isOnCanvas(nodes[i])) continue;
            if ((nodes[i].system || '').trim() === sysName) out.push(nodes[i]);
        }
        return out;
    }

    /**
     * Render one bounding-box frame per `system` value in use. Nodes without a
     * system are excluded. The bbox uses each node's stored x/y plus its
     * actual offsetWidth/Height (so expanded property sets enlarge the frame).
     */
    function renderGroups() {
        groupLayer.innerHTML = '';
        var byS = Object.create(null);
        var nodes = State.getNodes();
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (!isOnCanvas(n)) continue;
            var s = (n.system || '').trim();
            if (!s) continue;
            (byS[s] = byS[s] || []).push(n);
        }
        Object.keys(byS).forEach(function (sysName) {
            var box = buildGroupBoxFor(sysName, byS[sysName]);
            if (box) groupLayer.appendChild(box);
        });
    }

    /**
     * Rebuild a single system's group-box in place. Used during node drag —
     * a full renderGroups() iterated every node and did a querySelector per
     * member, which dominated drag CPU on a graph with many systems.
     */
    function renderGroupForSystem(sysName) {
        if (!sysName) return;
        var existing = groupLayer.querySelector('.group-box[data-system="' + cssEscape(sysName) + '"]');
        var members = membersOfSystem(sysName);
        var box = members.length ? buildGroupBoxFor(sysName, members) : null;
        if (existing && box) existing.replaceWith(box);
        else if (existing) existing.remove();
        else if (box) groupLayer.appendChild(box);
    }

    function renderNodes() {
        nodeLayer.innerHTML = '';
        nodeElById = Object.create(null);
        // Rebuild the codelist-ref index once per render so the per-attribute
        // badge lookup is a plain object access.
        codelistRefsByNode = buildCodelistRefsIndex();
        State.getNodes().forEach(function (node) {
            if (!isOnCanvas(node)) return;
            var el = createNodeEl(node);
            nodeElById[node.id] = el;
            nodeLayer.appendChild(el);
        });
        setEditMode(State.getMode() === 'edit');
    }

    function createNodeEl(node) {
        var el = document.createElement('div');
        el.className = 'node';
        el.setAttribute('data-node-id', node.id);
        el.setAttribute('data-type', node.type || 'table');
        // Keyboard reachability: nodes are focusable so screen-reader and
        // keyboard users can Tab through them. Selection happens on Enter
        // or Space (handled in onNodePointerDown plus a key listener below).
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label',
            (node.label || node.id) + ' — ' + (node.type || 'Knoten') +
            (node.system ? ', System ' + node.system : ''));
        el.style.left = (node.x || 0) + 'px';
        el.style.top  = (node.y || 0) + 'px';

        var icon = TYPE_ICONS[node.type] || TYPE_ICONS.table;
        var headerLabel = node.label || node.id;
        var totalAttrs = (node.columns || []).length;

        var html =
            '<div class="node-header">' +
                '<span class="node-type-icon" data-edit="type" title="Typ wechseln">' + icon + '</span>' +
                '<span class="node-title" data-edit="label" contenteditable="false" spellcheck="false">' + escapeHtml(headerLabel) + '</span>' +
                '<span class="node-set-count" title="Anzahl Attribute">' + totalAttrs + '</span>' +
                '<span class="node-system" data-edit="system" contenteditable="false" spellcheck="false" data-placeholder="System">' + escapeHtml(node.system || '') + '</span>' +
                '<button class="node-delete edit-only" data-action="delete-node" title="Knoten löschen" tabindex="-1">' +
                    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</div>';

        var sets = State.derivePropertySets(node);
        var cols = node.columns || [];
        // Most nodes group by setId (BBL packages from the global registry).
        // The SAP API node groups by sourceStructure (its BAPI substructures).
        var groupKey = State.getGroupKey(node);
        // Per-attribute codelist references (FK edge → codelist node), keyed
        // by column name. Empty for the API node and any node without
        // codelist-FK edges.
        var clRefs = codelistRefsByNode[node.id] || {};

        if (sets.length === 0) {
            // Flat list — no sets in use
            html += '<ul class="node-cols">';
            cols.forEach(function (c, idx) { html += colRowHtml(c, idx, clRefs[c.name]); });
            html += '</ul>';
            html += '<div class="node-col-add edit-only" data-action="add-col" data-set="">+ Spalte</div>';
        } else {
            // Group by the chosen key (setId | sourceStructure) in one pass.
            var ungroupedHtml = '';
            var bySet = {};
            var countBySet = {};
            sets.forEach(function (s) { bySet[s.id] = ''; countBySet[s.id] = 0; });
            cols.forEach(function (c, idx) {
                var rowHtml = colRowHtml(c, idx, clRefs[c.name]);
                var k = c[groupKey];
                if (k && bySet.hasOwnProperty(k)) {
                    bySet[k] += rowHtml;
                    countBySet[k] += 1;
                } else {
                    ungroupedHtml += rowHtml;
                }
            });

            if (ungroupedHtml) {
                html += '<ul class="node-cols">' + ungroupedHtml + '</ul>';
            }

            sets.forEach(function (s) {
                var expanded = isSetExpanded(node.id, s.id);
                html += setSectionHtml(s, countBySet[s.id] || 0, bySet[s.id], expanded);
            });
        }

        // Edge handles (visible only in edit mode via CSS)
        // Edge-draw ports — four sides so users can pull connections from any
        // edge of the node, not just left/right at a fixed Y. The drawer
        // logic just needs the node-id; direction is derived from the side
        // class for arrow placement.
        html += '<span class="node-port top"    data-port="top"    data-node-id="' + node.id + '"></span>';
        html += '<span class="node-port right"  data-port="right"  data-node-id="' + node.id + '"></span>';
        html += '<span class="node-port bottom" data-port="bottom" data-node-id="' + node.id + '"></span>';
        html += '<span class="node-port left"   data-port="left"   data-node-id="' + node.id + '"></span>';

        el.innerHTML = html;
        return el;
    }

    function setSectionHtml(s, count, colsHtml, expanded) {
        // `s` shape: { id, label, kind } — id is the registry id (or SAP
        // substructure key for the API node); label is what we display.
        // Set name is *not* contenteditable any more — set names live in
        // the global registry; rename happens there, not on the node.
        var safeId = escapeAttr(s.id || '');
        var label = s.label || s.id || '';
        return '' +
            '<div class="node-set' + (expanded ? ' is-expanded' : '') + '" data-set="' + safeId + '">' +
                '<div class="node-set-header" data-action="toggle-set" data-set="' + safeId + '">' +
                    '<span class="node-set-toggle" aria-hidden="true">' +
                        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>' +
                    '</span>' +
                    '<span class="node-set-name">' + escapeHtml(label) + '</span>' +
                    '<span class="node-set-count">' + count + '</span>' +
                '</div>' +
                '<div class="node-set-content">' +
                    '<ul class="node-cols">' + colsHtml + '</ul>' +
                    '<div class="node-col-add edit-only" data-action="add-col" data-set="' + safeId + '">+ Spalte</div>' +
                '</div>' +
            '</div>';
    }

    function colRowHtml(c, idx, codelistNode) {
        var key = c.key || '';
        var keyClass = key === 'PK' ? 'pk' : key === 'FK' ? 'fk' : key === 'UK' ? 'uk' : '';
        var keyLabel = KEY_LABELS[key] || KEY_LABELS[''];
        var keyTitle = 'Klicken: PK → FK → UK → –';
        // Codelist badge — only if this attribute is FK'd to a codelist node.
        // Same icon as TYPE_ICONS.codelist for visual consistency. Click selects
        // the codelist (info-panel renders its codes).
        var clBadge = '';
        if (codelistNode) {
            clBadge = '<button type="button" class="node-col-codelist"' +
                ' data-action="show-codelist"' +
                ' data-codelist-id="' + escapeAttr(codelistNode.id) + '"' +
                ' title="Werteliste: ' + escapeAttr(codelistNode.label || codelistNode.id) + '"' +
                ' tabindex="-1">' +
                    '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                        '<line x1="6" y1="3" x2="13" y2="3"/><line x1="6" y1="8" x2="13" y2="8"/><line x1="6" y1="13" x2="13" y2="13"/>' +
                        '<circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="3" cy="13" r="1.2" fill="currentColor"/>' +
                    '</svg>' +
                '</button>';
        }
        return '' +
            '<li class="node-col' + (codelistNode ? ' has-codelist' : '') + '" data-col-idx="' + idx + '">' +
                '<span class="node-col-handle edit-only" data-col-idx="' + idx + '" title="Verschieben">' +
                    '<svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">' +
                        '<circle cx="2.5" cy="3" r="1"/><circle cx="2.5" cy="7" r="1"/><circle cx="2.5" cy="11" r="1"/>' +
                        '<circle cx="5.5" cy="3" r="1"/><circle cx="5.5" cy="7" r="1"/><circle cx="5.5" cy="11" r="1"/>' +
                    '</svg>' +
                '</span>' +
                '<span class="node-col-key ' + keyClass + '" data-edit="key" data-col-idx="' + idx + '" title="' + keyTitle + '">' + keyLabel + '</span>' +
                '<span class="node-col-name" data-edit="col-name" data-col-idx="' + idx + '" contenteditable="false" spellcheck="false">' + escapeHtml(c.name || '') + '</span>' +
                '<span class="node-col-type" data-edit="col-type" data-col-idx="' + idx + '" contenteditable="false" spellcheck="false">' + escapeHtml(c.type || '') + '</span>' +
                clBadge +
                '<button class="node-col-del edit-only" data-action="delete-col" data-col-idx="' + idx + '" title="Spalte löschen" tabindex="-1">' +
                    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</li>';
    }

    function renderEdges() {
        // Clear old edge groups from both layers (keep <defs>)
        edgeLayer.querySelectorAll('.edge-group').forEach(function (p) { p.remove(); });
        edgeOverlay.querySelectorAll('.edge-group').forEach(function (p) { p.remove(); });

        var selId = State.getSelectedEdgeId();
        State.getEdges().forEach(function (edge) {
            // Skip edges that touch a codelist — codelists aren't drawn on
            // the canvas, so a half-dangling edge would be confusing. The
            // FK relationship is surfaced as an inline badge on the source
            // attribute instead.
            var fromNode = State.getNode(edge.from);
            var toNode = State.getNode(edge.to);
            if (!isOnCanvas(fromNode) || !isOnCanvas(toNode)) return;
            var groupEl = createEdgeEl(edge);
            if (!groupEl) return;
            // Selected edge renders in the overlay so its handles + foreignObject
            // sit ABOVE the node-layer (nodes paint between the two SVGs).
            var target = (edge.id === selId) ? edgeOverlay : edgeLayer;
            target.appendChild(groupEl);
        });
    }

    /**
     * Apply or clear the [data-filtered="true"] attribute on every node
     * based on the current filter state. Edges inherit: an edge is
     * filtered if either of its endpoints is. CSS handles the visual
     * dim — this function just sets attributes.
     */
    function applyFilterDim() {
        if (!State.hasActiveFilters()) {
            nodeLayer.querySelectorAll('.node[data-filtered]').forEach(function (el) {
                el.removeAttribute('data-filtered');
            });
            edgeLayer.querySelectorAll('.edge-group[data-filtered]').forEach(function (g) {
                g.removeAttribute('data-filtered');
            });
            edgeOverlay.querySelectorAll('.edge-group[data-filtered]').forEach(function (g) {
                g.removeAttribute('data-filtered');
            });
            return;
        }
        var matched = Object.create(null);
        State.getNodes().forEach(function (n) {
            if (!isOnCanvas(n)) return;
            if (State.matchesFilters(n)) matched[n.id] = true;
        });
        nodeLayer.querySelectorAll('.node').forEach(function (el) {
            var id = el.getAttribute('data-node-id');
            if (matched[id]) el.removeAttribute('data-filtered');
            else             el.setAttribute('data-filtered', 'true');
        });
        // Edges: dim when EITHER endpoint is filtered out — keeps the
        // graph readable; a half-grey edge would imply a dangling link.
        var dimEdge = function (g) {
            var f = g.getAttribute('data-from');
            var t = g.getAttribute('data-to');
            if (matched[f] && matched[t]) g.removeAttribute('data-filtered');
            else                          g.setAttribute('data-filtered', 'true');
        };
        edgeLayer.querySelectorAll('.edge-group').forEach(dimEdge);
        edgeOverlay.querySelectorAll('.edge-group').forEach(dimEdge);
    }

    /**
     * Selection-only diff for edges. Demotes any edge currently in the
     * overlay that isn't the new selection back to the unselected layer,
     * and promotes the newly-selected one. Replaces a previous full
     * renderEdges() that re-created every <g> on every selection change.
     */
    function updateEdgeSelection() {
        var newSelId = State.getSelectedEdgeId();

        // Demote previously-selected edges (overlay → layer, no chrome).
        var overlayGroups = edgeOverlay.querySelectorAll('.edge-group');
        for (var i = 0; i < overlayGroups.length; i++) {
            var g = overlayGroups[i];
            var id = g.getAttribute('data-edge-id');
            if (id === newSelId) continue; // still selected
            var edge = State.getEdge(id);
            g.remove();
            if (edge) {
                var fresh = createEdgeEl(edge);
                if (fresh) edgeLayer.appendChild(fresh);
            }
        }

        // Promote new selection (layer → overlay, with handles + label editor).
        if (newSelId) {
            var existingInOverlay = edgeOverlay.querySelector('[data-edge-id="' + cssEscape(newSelId) + '"]');
            if (existingInOverlay) {
                // Re-create so handles / label editor reflect current edit-mode state.
                var edgeSel = State.getEdge(newSelId);
                existingInOverlay.remove();
                if (edgeSel) {
                    var refreshed = createEdgeEl(edgeSel);
                    if (refreshed) edgeOverlay.appendChild(refreshed);
                }
            } else {
                var existingInLayer = edgeLayer.querySelector('[data-edge-id="' + cssEscape(newSelId) + '"]');
                if (existingInLayer) existingInLayer.remove();
                var edgeNew = State.getEdge(newSelId);
                if (edgeNew) {
                    var freshSel = createEdgeEl(edgeNew);
                    if (freshSel) edgeOverlay.appendChild(freshSel);
                }
            }
        }
    }

    function createEdgeEl(edge) {
        var from = State.getNode(edge.from);
        var to = State.getNode(edge.to);
        if (!from || !to) return null;

        var fromRect = getNodeRect(from);
        var toRect = getNodeRect(to);

        var path = computeEdgePath(fromRect, toRect);
        var isSelected = State.getSelectedEdgeId() === edge.id;
        var isEdit = State.getMode() === 'edit';

        var ns = 'http://www.w3.org/2000/svg';
        var g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'edge-group' + (isSelected ? ' is-selected' : ''));
        g.setAttribute('data-edge-id', edge.id);
        // Endpoint hints — used by isolation logic to hide edges whose
        // endpoints aren't visible.
        g.setAttribute('data-from', edge.from);
        g.setAttribute('data-to',   edge.to);

        var hit = document.createElementNS(ns, 'path');
        hit.setAttribute('class', 'edge-hit');
        hit.setAttribute('d', path.d);
        g.appendChild(hit);

        var visible = document.createElementNS(ns, 'path');
        visible.setAttribute('class', 'edge-path');
        visible.setAttribute('d', path.d);
        // Selected edge lives in #edge-overlay which has its own marker;
        // unselected edge uses the marker in #edge-layer.
        visible.setAttribute('marker-end', isSelected ? 'url(#arrow-overlay)' : 'url(#arrow)');
        g.appendChild(visible);

        // Crow's Foot cardinality markers at each end. Rendered as plain
        // SVG groups (not <marker> elements) so we can position them
        // independently of the line stroke and let circles "punch out"
        // the line beneath via fill = page background.
        appendCardinalityMarker(g, ns, edge.fromCardinality, path, /*end=*/'from');
        appendCardinalityMarker(g, ns, edge.toCardinality,   path, /*end=*/'to');

        if (isSelected && isEdit) {
            // Inline label editor + cardinality dropdowns ("Von" before
            // the label, "Zu" after) — same row as the label so the
            // popover stays compact.
            var FO_W = 360, FO_H = 32;
            var fo = document.createElementNS(ns, 'foreignObject');
            fo.setAttribute('x', path.midX - FO_W / 2);
            fo.setAttribute('y', path.midY - FO_H / 2);
            fo.setAttribute('width', FO_W);
            fo.setAttribute('height', FO_H);
            fo.setAttribute('class', 'edge-label-fo');
            fo.innerHTML =
                '<div xmlns="http://www.w3.org/1999/xhtml" class="edge-label-edit">' +
                    cardinalitySelectHtml('from', edge.fromCardinality) +
                    '<div class="edge-label-input">' +
                        '<input type="text" data-edge-label-input value="' + escapeAttr(edge.label || '') + '" placeholder="Beziehung benennen…" spellcheck="false" />' +
                        '<button type="button" class="edge-clear" data-action="clear-label" title="Text leeren" tabindex="-1">' +
                            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                        '</button>' +
                    '</div>' +
                    cardinalitySelectHtml('to', edge.toCardinality) +
                    '<button type="button" class="edge-delete" data-action="delete-edge" title="Beziehung löschen" tabindex="-1">' +
                        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                    '</button>' +
                '</div>';
            g.appendChild(fo);

            // Endpoint drag handles
            g.appendChild(makeHandle(ns, path.startX, path.startY, edge.id, 'from'));
            g.appendChild(makeHandle(ns, path.endX,   path.endY,   edge.id, 'to'));
        } else if (edge.label) {
            // HTML-in-SVG so CSS can wrap long labels. The foreignObject is
            // centered on the path midpoint; height is generous to fit up to
            // three lines, with overflow:visible so the rare longer label
            // still renders rather than getting clipped.
            var LBL_W = 180, LBL_H = 60;
            var labelFo = document.createElementNS(ns, 'foreignObject');
            labelFo.setAttribute('class', 'edge-label-fo edge-label-fo-static');
            labelFo.setAttribute('x', path.midX - LBL_W / 2);
            labelFo.setAttribute('y', path.midY - LBL_H / 2);
            labelFo.setAttribute('width', LBL_W);
            labelFo.setAttribute('height', LBL_H);
            labelFo.innerHTML =
                '<div xmlns="http://www.w3.org/1999/xhtml" class="edge-label-wrap">' +
                    '<span class="edge-label">' + escapeHtml(edge.label) + '</span>' +
                '</div>';
            g.appendChild(labelFo);
        }
        return g;
    }

    function makeHandle(ns, x, y, edgeId, end) {
        var c = document.createElementNS(ns, 'circle');
        c.setAttribute('class', 'edge-handle');
        c.setAttribute('cx', x);
        c.setAttribute('cy', y);
        c.setAttribute('r', 6);
        c.setAttribute('data-edge-id', edgeId);
        c.setAttribute('data-end', end);
        return c;
    }

    function focusSelectedEdgeInput() {
        var selId = State.getSelectedEdgeId();
        if (!selId) return;
        if (State.getMode() !== 'edit') return;
        var sel = '[data-edge-id="' + cssEscape(selId) + '"] [data-edge-label-input]';
        var input = edgeOverlay.querySelector(sel) || edgeLayer.querySelector(sel);
        if (input) {
            input.focus();
            input.select();
        }
    }

    function getNodeRect(node) {
        var el = nodeElById[node.id];
        if (!el || !el.isConnected) {
            el = nodeLayer && nodeLayer.querySelector('[data-node-id="' + cssEscape(node.id) + '"]');
            if (el) nodeElById[node.id] = el;
        }
        var w = el ? el.offsetWidth : 220;
        var h = el ? el.offsetHeight : 80;
        return { x: node.x || 0, y: node.y || 0, w: w, h: h };
    }

    function computeEdgePath(a, b) {
        var ax = a.x + a.w; // right side of source
        var ay = a.y + Math.min(28, a.h / 2);
        var bx = b.x;        // left side of target
        var by = b.y + Math.min(28, b.h / 2);

        // If target is to the left, route from left to right instead
        if (b.x + b.w < a.x) {
            ax = a.x;
            bx = b.x + b.w;
        } else if (Math.abs(b.x - (a.x + a.w)) < 40 && Math.abs(b.y - a.y) > 200) {
            // Vertical layout: from bottom to top
            ax = a.x + a.w / 2;
            ay = a.y + a.h;
            bx = b.x + b.w / 2;
            by = b.y;
        }

        // Straight line — Crow's Foot ER notation reads more clearly with
        // direct lines than Bézier curves. Cardinality markers at the
        // endpoints get a stable angle to rotate against, too.
        var d = 'M ' + ax + ' ' + ay + ' L ' + bx + ' ' + by;
        return {
            d: d,
            midX: (ax + bx) / 2,
            midY: (ay + by) / 2,
            startX: ax, startY: ay,
            endX: bx, endY: by
        };
    }

    // ---- Crow's Foot cardinality markers --------------------------------
    // Glyph local frame: x along the line direction, +x toward the entity
    // the marker describes. y perpendicular. Anchor (origin) sits on the
    // line; glyph extends in +x. Width = max +x extent; placement code
    // uses width to back the marker off from the endpoint by enough to
    // leave room for the arrow head (to-end) or a small gap (from-end).
    var MARKER_WIDTHS = {
        'one':       14,
        'zero-one':  18,
        'many':      14,
        'zero-many': 22
    };
    var ARROW_BUFFER = 14; // px between marker far-edge and arrow tip
    var FROM_GAP     = 4;  // px from start point to marker far-edge

    function appendCardinalityMarker(g, ns, kind, path, end) {
        if (!kind || !MARKER_WIDTHS.hasOwnProperty(kind)) return;
        var dx = path.endX - path.startX;
        var dy = path.endY - path.startY;
        var len = Math.sqrt(dx * dx + dy * dy);
        // Skip markers on very short edges — they'd collide with each
        // other or the arrow.
        if (len < 40) return;
        var ux = dx / len, uy = dy / len;
        var angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
        var w = MARKER_WIDTHS[kind];

        var anchorX, anchorY, rotation;
        if (end === 'to') {
            // Glyph far-edge sits ARROW_BUFFER back from the arrow tip.
            // Anchor (glyph x=0) is another `w` further back along line.
            anchorX = path.endX - ux * (ARROW_BUFFER + w);
            anchorY = path.endY - uy * (ARROW_BUFFER + w);
            rotation = angleDeg;
        } else {
            // From-end: rotate 180° so the glyph faces the source entity.
            // Glyph far-edge in world = anchor + (-ux*w, -uy*w) after
            // mirroring; place far-edge at start + ux*FROM_GAP.
            anchorX = path.startX + ux * (FROM_GAP + w);
            anchorY = path.startY + uy * (FROM_GAP + w);
            rotation = angleDeg + 180;
        }

        var marker = document.createElementNS(ns, 'g');
        marker.setAttribute('class', 'edge-cardinality');
        marker.setAttribute('transform',
            'translate(' + anchorX + ' ' + anchorY + ') rotate(' + rotation + ')');
        drawCardinalityShapes(marker, ns, kind);
        g.appendChild(marker);
    }

    function drawCardinalityShapes(parent, ns, kind) {
        var line = function (x1, y1, x2, y2) {
            var l = document.createElementNS(ns, 'line');
            l.setAttribute('x1', x1); l.setAttribute('y1', y1);
            l.setAttribute('x2', x2); l.setAttribute('y2', y2);
            return l;
        };
        var circle = function (cx, cy, r) {
            var c = document.createElementNS(ns, 'circle');
            c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
            return c;
        };

        if (kind === 'one') {
            // Single perpendicular bar near the entity end of the marker.
            parent.appendChild(line(8, -6, 8, 6));
        } else if (kind === 'zero-one') {
            // Circle near anchor (line side), bar near entity side.
            parent.appendChild(circle(4, 0, 3.5));
            parent.appendChild(line(14, -6, 14, 6));
        } else if (kind === 'many') {
            // Crow's foot — three lines from a single point at the anchor,
            // fanning out toward the entity.
            parent.appendChild(line(0, 0, 14, -7));
            parent.appendChild(line(0, 0, 14,  0));
            parent.appendChild(line(0, 0, 14,  7));
        } else if (kind === 'zero-many') {
            // Circle near anchor, then crow's foot fanning toward entity.
            parent.appendChild(circle(4, 0, 3.5));
            parent.appendChild(line(10, 0, 22, -7));
            parent.appendChild(line(10, 0, 22,  0));
            parent.appendChild(line(10, 0, 22,  7));
        }
    }

    /**
     * <select> for cardinality on either end of an edge. Compact —
     * just the symbolic value ("1", "0..1", "1..*", "0..*") shows in
     * the closed select; option labels carry the longer description
     * for clarity. data-edge-card-end is read by editor.js to know
     * which end to update on change.
     */
    function cardinalitySelectHtml(end, current) {
        var options = [
            { value: '',          short: '–',     label: '– (keine)' },
            { value: 'one',       short: '1',     label: '1 (genau eins)' },
            { value: 'zero-one',  short: '0..1',  label: '0..1 (optional)' },
            { value: 'many',      short: '1..*',  label: '1..* (eins oder mehr)' },
            { value: 'zero-many', short: '0..*',  label: '0..* (null oder mehr)' }
        ];
        var html = '<select class="edge-card-select" data-edge-card-end="' + end +
            '" title="Kardinalität ' + (end === 'from' ? 'Quelle' : 'Ziel') + '">';
        for (var i = 0; i < options.length; i++) {
            var o = options[i];
            var isSel = (current || '') === o.value;
            html += '<option value="' + escapeAttr(o.value) + '"' +
                (isSel ? ' selected' : '') + '>' + escapeHtml(o.short) + '</option>';
        }
        html += '</select>';
        return html;
    }

    function updateEdgesForNode(nodeId) {
        // Re-render edges that touch this node, in whichever layer they live
        var selId = State.getSelectedEdgeId();
        State.getEdges().forEach(function (edge) {
            if (edge.from !== nodeId && edge.to !== nodeId) return;
            // Skip codelist FK edges — those aren't on the canvas at all.
            var fromN = State.getNode(edge.from);
            var toN = State.getNode(edge.to);
            if (!isOnCanvas(fromN) || !isOnCanvas(toN)) return;
            var existing = edgeLayer.querySelector('[data-edge-id="' + cssEscape(edge.id) + '"]') ||
                           edgeOverlay.querySelector('[data-edge-id="' + cssEscape(edge.id) + '"]');
            var fresh = createEdgeEl(edge);
            if (!fresh) return;
            var target = (edge.id === selId) ? edgeOverlay : edgeLayer;
            if (existing) {
                if (existing.parentNode === target) {
                    target.replaceChild(fresh, existing);
                } else {
                    existing.remove();
                    target.appendChild(fresh);
                }
            } else {
                target.appendChild(fresh);
            }
        });
    }

    function updateSelectionVisuals() {
        var sel = State.getSelection();
        var selNodeId = sel && sel.kind === 'node' ? sel.id : null;
        var selSystem = sel && sel.kind === 'system' ? sel.name : null;
        var selAttr   = sel && sel.kind === 'attribute' ? sel : null;

        nodeLayer.querySelectorAll('.node').forEach(function (el) {
            el.classList.toggle('is-selected', el.getAttribute('data-node-id') === selNodeId);
        });
        nodeLayer.querySelectorAll('.node-col.is-selected').forEach(function (el) {
            el.classList.remove('is-selected');
        });
        if (selAttr) {
            var nodeEl = nodeElById[selAttr.nodeId];
            if (nodeEl) {
                var node = State.getNode(selAttr.nodeId);
                if (node) {
                    var idx = (node.columns || []).findIndex(function (c) { return c.name === selAttr.name; });
                    if (idx !== -1) {
                        var rows = nodeEl.querySelectorAll('.node-col');
                        for (var i = 0; i < rows.length; i++) {
                            if (Number(rows[i].getAttribute('data-col-idx')) === idx) {
                                rows[i].classList.add('is-selected');
                                break;
                            }
                        }
                    }
                }
            }
        }
        if (groupLayer) {
            groupLayer.querySelectorAll('.group-box').forEach(function (el) {
                el.classList.toggle('is-selected', el.getAttribute('data-system') === selSystem);
            });
        }
    }
    // Keep a back-compat alias since editor.js / earlier callers used the old name
    var updateNodeSelection = updateSelectionVisuals;

    // ---- Pan / Zoom ----------------------------------------------------

    function onPanStart(e) {
        // The first pointer's target governs the bail-outs (nodes, edges,
        // floating toolbars). Subsequent pointers are tracked unconditionally
        // so a second finger can drop anywhere — including on a node — to
        // start pinch zoom. Editor's port/handle pointerdown listeners stop
        // propagation so we don't see those here.
        if (activePointers.size === 0) {
            if (e.target.closest('.node')) return;
            if (e.target.closest('#edge-layer')) return;
            if (e.target.closest('#edge-overlay')) return;
            if (e.target.closest('.ft')) return;
            if (e.target.closest('.node-action-bar')) return;
            if (e.target.closest('.group-box-label')) return;
            if (canvasEl.classList.contains('is-edge-drawing')) return;
        }

        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size >= 2) {
            // Two pointers down → pinch zoom takes over. Cancel any
            // single-pointer pan that was in progress; it would otherwise
            // double-up with the pinch translate computation.
            if (isPanning) {
                isPanning = false;
                canvasEl.classList.remove('is-panning');
            }
            beginPinch();
            return;
        }

        // Single pointer: standard pan.
        isPanning = true;
        panStart = {
            x: e.clientX,
            y: e.clientY,
            tx: translateX,
            ty: translateY
        };
        canvasEl.classList.add('is-panning');
        try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}

        // Click on background clears selection (and blurs any active editable)
        State.setSelected(null);
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
    }

    function onPanMove(e) {
        // Update tracked pointer position regardless of which gesture is
        // active — pinch reads both pointers from the map.
        if (activePointers.has(e.pointerId)) {
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (pinchInitial && activePointers.size >= 2) {
            schedulePointerFrame('pinch');
            return;
        }
        if (isPanning) {
            lastPanClient = { x: e.clientX, y: e.clientY };
            schedulePointerFrame('pan');
        }
        if (isDragging) {
            lastDragClient = { x: e.clientX, y: e.clientY };
            schedulePointerFrame('drag');
        }
    }

    function onPanEnd(e) {
        if (e && e.pointerId != null) {
            activePointers.delete(e.pointerId);
        } else {
            activePointers.clear();
        }
        // Lifting one finger of a pinch ends the gesture cleanly. We don't
        // demote to single-pointer pan because the remaining finger's
        // panStart is stale; the user must lift and re-touch to pan. This
        // matches how Miro / Figma behave on touch.
        if (pinchInitial && activePointers.size < 2) {
            endPinch();
        }
        if (activePointers.size === 0) {
            if (isPanning) {
                isPanning = false;
                canvasEl.classList.remove('is-panning');
            }
        }
        if (isDragging) {
            onDragEnd();
        }
    }

    function onWheel(e) {
        e.preventDefault();
        var factor = e.deltaY > 0 ? 0.92 : 1.08;
        var newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
        var rect = canvasEl.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        translateX = mx - (mx - translateX) * (newScale / scale);
        translateY = my - (my - translateY) * (newScale / scale);
        scale = newScale;
        applyTransform();
    }

    // Multiplicative zoom: each click feels proportional. Going 1.0 → 0.05
    // takes ~13 clicks instead of ~10 with additive 0.1, but each step at
    // low zoom levels stays meaningful (vs clamping to floor immediately).
    function zoomIn()  { zoomAt(scale * ZOOM_FACTOR); }
    function zoomOut() { zoomAt(scale / ZOOM_FACTOR); }

    function zoomAt(target) {
        var rect = canvasEl.getBoundingClientRect();
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var newScale = clamp(target, MIN_SCALE, MAX_SCALE);
        translateX = cx - (cx - translateX) * (newScale / scale);
        translateY = cy - (cy - translateY) * (newScale / scale);
        scale = newScale;
        applyTransform();
    }

    function fitToScreen() {
        var nodes = State.getNodes();
        if (!nodes.length) return;
        // Layout-not-settled guard: on first paint the rAF can fire before
        // the canvas has been measured, especially with a heavy node tree
        // (the 22-row codelist forces a long layout pass). A 0×0 rect made
        // the math collapse to MIN_SCALE and pushed content offscreen —
        // user reported "canvas appears empty until I apply a filter".
        // Retry next frame instead of computing from a stale rect.
        var rect = canvasEl.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) {
            requestAnimationFrame(fitToScreen);
            return;
        }
        // Use DOM rects for accurate height. Codelists are off-canvas, so
        // they shouldn't pull the fit framing toward y≈4900 and shrink
        // every BBL node into illegibility.
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(function (n) {
            if (!isOnCanvas(n)) return;
            var r = getNodeRect(n);
            minX = Math.min(minX, r.x);
            minY = Math.min(minY, r.y);
            maxX = Math.max(maxX, r.x + r.w);
            maxY = Math.max(maxY, r.y + r.h);
        });
        var graphW = maxX - minX;
        var graphH = maxY - minY;
        if (!isFinite(graphW) || !isFinite(graphH) || graphW <= 0 || graphH <= 0) return;
        var pad = 80;
        var sx = (rect.width - pad * 2) / graphW;
        var sy = (rect.height - pad * 2) / graphH;
        scale = clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE);
        translateX = (rect.width - graphW * scale) / 2 - minX * scale;
        translateY = (rect.height - graphH * scale) / 2 - minY * scale;
        applyTransform();
    }

    /**
     * "Fit-with-floor" initial framing — used on first paint instead of
     * fitToScreen. Computes the same fit math, then floors the scale at
     * INITIAL_MIN_SCALE so a sprawling graph doesn't shrink everything
     * to unreadable; lets the bbox extend past the viewport edges in
     * that case rather than zooming out further. Caps at 1.0 so a tiny
     * graph isn't magnified above 1:1. Centres on the bbox centre, so
     * the framing stays predictable as nodes are added/moved.
     *
     * The Fit button (zoom-fit) still calls fitToScreen so users can
     * always reach a full overview on demand.
     */
    var INITIAL_MIN_SCALE = 0.25;
    var INITIAL_MAX_SCALE = 1.0;
    function initialView() {
        var nodes = State.getNodes();
        if (!nodes.length) return;
        var rect = canvasEl.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) {
            requestAnimationFrame(initialView);
            return;
        }
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(function (n) {
            if (!isOnCanvas(n)) return;
            var r = getNodeRect(n);
            minX = Math.min(minX, r.x);
            minY = Math.min(minY, r.y);
            maxX = Math.max(maxX, r.x + r.w);
            maxY = Math.max(maxY, r.y + r.h);
        });
        var graphW = maxX - minX;
        var graphH = maxY - minY;
        if (!isFinite(graphW) || !isFinite(graphH) || graphW <= 0 || graphH <= 0) return;
        var pad = 80;
        var sx = (rect.width  - pad * 2) / graphW;
        var sy = (rect.height - pad * 2) / graphH;
        var fitScale = Math.min(sx, sy);
        var biased = Math.min(Math.max(fitScale, INITIAL_MIN_SCALE), INITIAL_MAX_SCALE);
        scale = clamp(biased, MIN_SCALE, MAX_SCALE);
        var bboxCenterX = (minX + maxX) / 2;
        var bboxCenterY = (minY + maxY) / 2;
        translateX = rect.width  / 2 - bboxCenterX * scale;
        translateY = rect.height / 2 - bboxCenterY * scale;
        applyTransform();
    }

    function resetLayout() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
    }

    /**
     * "Home" — apply the curator-saved entry-point view if one exists,
     * otherwise fall back to initialView (fit-with-floor). Wired to the
     * zoom-reset button (which used to be identity-reset, rarely useful).
     * Map convention: Home + Zoom Extent are sibling buttons.
     */
    function goHome() {
        var hv = State.getHomeView && State.getHomeView();
        if (!hv) { initialView(); return; }
        var rect = canvasEl.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) {
            requestAnimationFrame(goHome);
            return;
        }
        scale = clamp(hv.scale, MIN_SCALE, MAX_SCALE);
        translateX = rect.width  / 2 - hv.centerX * scale;
        translateY = rect.height / 2 - hv.centerY * scale;
        applyTransform();
    }

    /**
     * Capture the current scale + viewport-centre (in canvas-world coords)
     * as the new Home. State.setHomeView persists immediately.
     */
    function setHomeFromCurrent() {
        var rect = canvasEl.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) return false;
        var centerClientX = rect.left + rect.width  / 2;
        var centerClientY = rect.top  + rect.height / 2;
        var world = clientToCanvas(centerClientX, centerClientY);
        State.setHomeView({ scale: scale, centerX: world.x, centerY: world.y });
        return true;
    }

    function applyTransform() {
        transformEl.style.transform =
            'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
        // Match the dot grid to the current zoom — base 24px in canvas
        // coordinates, scaled to viewport coordinates and offset by the
        // current pan. Skips the work at extreme zoom-out where the grid
        // becomes noise anyway.
        if (canvasEl) {
            var size = 24 * scale;
            if (scale < 0.4) {
                canvasEl.style.backgroundImage = 'none';
            } else {
                canvasEl.style.backgroundImage =
                    'radial-gradient(var(--color-bg-grid-dot) 1px, transparent 1px)';
                canvasEl.style.backgroundSize = size + 'px ' + size + 'px';
                canvasEl.style.backgroundPosition = translateX + 'px ' + translateY + 'px';
            }
        }
        if (zoomLabel) {
            zoomLabel.textContent = Math.round(scale * 100) + '%';
        }
        // Selection chrome (node action bar) lives in canvas viewport coords —
        // re-anchor it whenever the transform changes.
        if (window.CanvasApp.Editor && window.CanvasApp.Editor.repositionActionBar) {
            window.CanvasApp.Editor.repositionActionBar();
        }
    }

    // ---- Node Drag (edit mode only) ------------------------------------

    function onNodePointerDown(e) {
        // Ports handled by Editor module
        if (e.target.classList.contains('node-port')) return;
        // Codelist badge owns the click — let editor.js handle it without
        // pointerdown selecting the parent attribute first (would flash).
        if (e.target.closest('[data-action="show-codelist"]')) return;

        var nodeEl = e.target.closest('.node');
        if (!nodeEl) return;

        var nodeId = nodeEl.getAttribute('data-node-id');

        // Click on a column row → select attribute (instead of node).
        // Inline-edit affordances inside the row (text spans, key cycle, ×,
        // drag handle) still work because pointerdown happens before
        // contenteditable focus.
        var colEl = e.target.closest('.node-col');
        if (colEl) {
            var colIdx = Number(colEl.getAttribute('data-col-idx'));
            var node = State.getNode(nodeId);
            var col = node && (node.columns || [])[colIdx];
            if (col) {
                State.setSelectedAttribute(nodeId, col.name);
            }
        } else {
            State.setSelected(nodeId);
        }

        if (State.getMode() !== 'edit') return;

        // In edit mode, don't start drag for clicks on interactive children.
        // .node-col is in the bail list — clicking a column should select the
        // attribute, never start a node drag.
        if (e.target.closest('[contenteditable="true"], button, .node-port, .node-col, .node-col-key, .node-col-handle, .node-col-add, .node-set-header, .node-type-icon')) {
            return;
        }

        var node = State.getNode(nodeId);
        if (!node) return;

        isDragging = true;
        dragNodeId = nodeId;
        var startWorld = clientToCanvas(e.clientX, e.clientY);
        dragCursorOffset = {
            x: (node.x || 0) - startWorld.x,
            y: (node.y || 0) - startWorld.y
        };
        nodeEl.classList.add('is-dragging');
        e.stopPropagation();
        e.preventDefault();
    }

    /**
     * Toggle contenteditable on every editable span inside the node layer
     * — driven by Editor when the mode flips.
     */
    function setEditMode(isEdit) {
        nodeLayer.querySelectorAll('[data-edit]').forEach(function (el) {
            // Type / key are click-to-cycle, not contenteditable.
            // Everything else (label, system, col-name, col-type, set-name)
            // becomes editable text in edit mode.
            var kind = el.getAttribute('data-edit');
            if (kind === 'type' || kind === 'key') return;
            el.setAttribute('contenteditable', isEdit ? 'true' : 'false');
        });
    }

    function applyDragMove(clientX, clientY) {
        if (!isDragging || !dragNodeId) return;
        // Re-read the current transform on every move via clientToCanvas —
        // see comment on dragCursorOffset above.
        var nowWorld = clientToCanvas(clientX, clientY);
        var nx = nowWorld.x + dragCursorOffset.x;
        var ny = nowWorld.y + dragCursorOffset.y;
        var el = nodeElById[dragNodeId];
        if (el) {
            el.style.left = nx + 'px';
            el.style.top = ny + 'px';
        }
        State.moveNode(dragNodeId, nx, ny);
        updateEdgesForNode(dragNodeId);
        // Only rebuild the system frame the dragged node lives in — full
        // renderGroups() iterated every node + queried the DOM per member.
        var draggedNode = State.getNode(dragNodeId);
        if (draggedNode) {
            var sys = (draggedNode.system || '').trim();
            if (sys) renderGroupForSystem(sys);
        }
        // Action bar follows the node it sits above
        if (window.CanvasApp.Editor && window.CanvasApp.Editor.repositionActionBar) {
            window.CanvasApp.Editor.repositionActionBar();
        }
    }

    function onDragEnd() {
        if (!isDragging) return;
        var el = nodeElById[dragNodeId];
        if (el) el.classList.remove('is-dragging');
        isDragging = false;
        dragNodeId = null;
    }

    // ---- Coordinate helpers --------------------------------------------

    function clientToCanvas(clientX, clientY) {
        var rect = canvasEl.getBoundingClientRect();
        return {
            x: (clientX - rect.left - translateX) / scale,
            y: (clientY - rect.top  - translateY) / scale
        };
    }

    function getTransform() {
        return { translateX: translateX, translateY: translateY, scale: scale };
    }

    // ---- Util ----------------------------------------------------------

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    function escapeAttr(s) { return escapeHtml(s); }

    function cssEscape(s) {
        if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
        return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    return {
        init: init,
        renderAll: renderAll,
        renderNodes: renderNodes,
        renderEdges: renderEdges,
        updateEdgesForNode: updateEdgesForNode,
        updateNodeSelection: updateNodeSelection,
        applyFilterDim: applyFilterDim,
        toggleSet: toggleSet,
        isSetExpanded: isSetExpanded,
        setAllSetsExpanded: setAllSetsExpanded,
        renderGroups: renderGroups,
        fitToScreen: fitToScreen,
        initialView: initialView,
        goHome: goHome,
        setHomeFromCurrent: setHomeFromCurrent,
        getNodeEl: getNodeEl,
        getNodeRect: getNodeRect,
        getTransform: getTransform,
        clientToCanvas: clientToCanvas,
        setEditMode: setEditMode
    };
})();
