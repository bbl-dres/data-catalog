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
    var systemOverlayLayer = null;
    var edgeLayer = null;
    var edgeOverlay = null;
    var groupLayer = null;
    var zoomLabel = null;

    var translateX = 0;
    var translateY = 0;
    var scale = 1;

    // External subscribers (currently the minimap) that need to react to every
    // pan/zoom change. Fired from applyTransform — the single choke point all
    // gestures funnel through.
    var transformListeners = [];

    // 0.01 ≈ "1%" floor — very large auto-laid-out graphs (IBPDI is several
    // thousand world-pixels wide) need to fit-to-screen at single-digit
    // percentages. Below 0.005 the percentage display rounds to "0%",
    // which the user explicitly wanted as the visible bottom of the range.
    // The math itself stays well clear of divide-by-zero (pinch + zoom
    // anchor calculations divide by `scale`, never by zero).
    var MIN_SCALE = 0.01;
    var MAX_SCALE = 3.0;
    var ZOOM_STEP = 0.1;     // additive step for fine adjustments at scale ≥ 1
    var ZOOM_FACTOR = 1.25;  // multiplicative factor for button zoom (zoomIn / zoomOut)
    // Wheel zoom multipliers — gentler than ZOOM_FACTOR because wheel events
    // arrive in bursts (60-120 Hz on trackpads). 0.92 down × 1.08 up ≈ ±8 %
    // per tick is the felt-right default; matches Miro / Figma trackpad
    // calibration.
    var WHEEL_ZOOM_OUT = 0.92;
    var WHEEL_ZOOM_IN  = 1.08;
    // Keyboard pan step (Arrow keys when canvas has focus). 60 px =
    // one dot-grid row at 100 % zoom. Shift multiplies for fast pan.
    var KEY_PAN_STEP      = 60;
    var KEY_PAN_STEP_FAST = 240;

    // Dot-grid hysteresis: a single threshold made the grid flap on / off as
    // wheel zoom (factor 0.92 / 1.08) crossed scale = 0.4 repeatedly. With a
    // 0.35–0.45 dead band, the grid only toggles once per zoom direction.
    var GRID_OFF_BELOW = 0.35;
    var GRID_ON_ABOVE  = 0.45;
    var gridOn = null;          // null = unset, will resolve on first call
    var lastGridSize = -1;
    var lastGridPosX = NaN;
    var lastGridPosY = NaN;
    var lastZoomPct  = null;    // skip zoom-label writes when text hasn't changed

    // Level-of-Detail (LOD) tiers — like a map's zoom levels. Driven by
    // canvas scale, with hysteresis bands so wheel-zoom can't flap between
    // tiers. We set both `data-lod` (CSS targeting) and `is-low-zoom` (kept
    // for the existing styles that apply across far + low tiers) on the
    // canvas element.
    //
    //   far  (~10–22 %): orientation only. Edges + edge labels hidden;
    //                    cards render as type-tinted silhouettes. Just
    //                    systems + node positions visible.
    //   low  ( 22–45 %): + edge lines (no labels). Attribute rows + edge
    //                    labels still hidden. Card silhouettes.
    //   mid  ( 45–75 %): + edge labels. Full node header (icon + title +
    //                    system pill). Attribute rows still hidden.
    //   full (≥ 75 %  ): + attribute rows. Default detail.
    //
    // Bands:                     [enter-when-below, exit-when-above]
    //   far: < 0.20 / > 0.25
    //   low: < 0.40 / > 0.45  (between far and mid)
    //   mid: < 0.70 / > 0.75  (between low and full)
    //
    // Thresholds tuned for IBPDI legibility — at 22 % a 12 px label is 2.6 px
    // on screen, unreadable noise that costs paint cycles for nothing.
    var lod = null;

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
        // Heights changed → system frames need re-measuring. Use the in-place
        // updater so we don't innerHTML='' the group / overlay layers (which
        // produced a visible flash on bulk expand-all / collapse-all).
        rebuildGroupsIncremental();
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

    // Type icons come from Util.nodeTypeIcon — single source of truth
    // shared with panel.js. The 14 px size is the node-header convention.
    var nodeTypeIcon14 = function (key) {
        return window.CanvasApp.Util.nodeTypeIcon(key, 14);
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
        systemOverlayLayer = document.getElementById('system-overlay-layer');
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
        // Canvas-level keyboard navigation — keeps mouse pan/zoom intact,
        // adds a parallel keyboard model so the diagram is operable without
        // a pointer (WCAG 2.1.1). Listener sits on canvasEl so the keys
        // only fire when the canvas (or one of its children) has focus —
        // typing in an unrelated input in the toolbar doesn't pan the
        // diagram.
        canvasEl.addEventListener('keydown', onCanvasKeydown);

        // System frame click (anywhere on the .group-box, not just the
        // small badge label) → select system. The CSS gives .group-box
        // pointer-events: auto so clicks on the gap-area between nodes
        // inside the frame land here; clicks on a node fall on the node
        // first because .node-layer paints above .group-layer. Pan-gesture
        // (down + drag) doesn't synthesise a click — only a discrete
        // press-release fires this, so the user can still pan from inside
        // a group frame.
        groupLayer.addEventListener('click', function (e) {
            var box = e.target.closest('.group-box');
            if (!box) return;
            var sys = box.getAttribute('data-system');
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
                    // The change goes into the current draft — say
                    // "festgelegt" (set), not "gespeichert", since the user
                    // still needs to click Speichern for the home view to
                    // reach the canvas table on the server.
                    var App = window.CanvasApp.App;
                    if (App && App.toast) App.toast('Startansicht festgelegt – Speichern, um zu übernehmen', 'success');
                }
            });
        }

        // State events. Single-entity mutators (updateNode, updateEdge,
        // addNode, deleteNode, addEdge, deleteEdge) pass the affected id as
        // the payload — we route to an incremental renderer that swaps just
        // that node/edge's DOM. Bulk events ('replace', 'reset') still take
        // the full-rebuild path. The previous behaviour rebuilt the entire
        // canvas on every label edit / column tweak / edge delete; on the
        // 256-node IBPDI graph that's a multi-MB innerHTML write per blur
        // — visible flash on commit.
        State.on(function (reason, payload) {
            if (reason === 'replace' || reason === 'reset') {
                collapsedSets = Object.create(null);
                // Cancel any in-progress gesture before the DOM is rebuilt.
                // renderAll() rebuilds nodeLayer.innerHTML from scratch; if
                // a drag was running, dragNodeId points at a freshly-detached
                // element. Subsequent applyDragMove ticks would no-op
                // visually but State.moveNode would keep mutating the
                // restored / reloaded state to the cursor's world coords.
                if (isDragging)   onDragEnd();
                if (isPanning)    { isPanning = false; canvasEl.classList.remove('is-panning'); }
                if (pinchInitial) endPinch();
            }
            if (reason === 'replace' || reason === 'reset') {
                renderAll();
                applyFilterDim();
            } else if (reason === 'nodes') {
                if (typeof payload === 'string' && payload) {
                    renderNodeIncremental(payload);
                } else {
                    renderAll();
                }
                applyFilterDim();
            } else if (reason === 'edges') {
                if (typeof payload === 'string' && payload) {
                    renderEdgeIncremental(payload);
                } else {
                    renderEdges();
                }
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
                // Filtered nodes are display:none — system frames must
                // re-measure so an all-filtered system drops its rectangle
                // instead of leaving an empty box. We update geometry IN
                // PLACE on the existing DOM (no innerHTML teardown), so
                // there's no inter-frame state where boxes / overlays
                // briefly disappear. Reading offsetParent below forces a
                // synchronous style/layout pass, so the data-filtered
                // attribute writes from applyFilterDim are reflected before
                // we measure.
                updateGroupsForFilter();
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

    /**
     * Compute the bounding rect for a system's visible members. Returns null
     * when none of the members render (filtered out, or codelist-only system).
     * Pulled out so both `buildGroupBoxFor` and the in-place filter updater
     * share the same geometry math.
     */
    function computeGroupRect(members) {
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
        return {
            left:   minX - GROUP_PAD,
            top:    minY - GROUP_PAD - GROUP_LABEL_H / 2,
            width:  maxX - minX + GROUP_PAD * 2,
            height: maxY - minY + GROUP_PAD * 2 + GROUP_LABEL_H / 2
        };
    }

    function buildGroupBoxFor(sysName, members) {
        var rect = computeGroupRect(members);
        if (!rect) return null;

        var box = document.createElement('div');
        box.className = 'group-box';
        box.setAttribute('data-system', sysName);
        box.style.left   = rect.left   + 'px';
        box.style.top    = rect.top    + 'px';
        box.style.width  = rect.width  + 'px';
        box.style.height = rect.height + 'px';

        var label = document.createElement('span');
        label.className = 'group-box-label';
        label.textContent = sysName;
        box.appendChild(label);
        return box;
    }

    /**
     * Reposition the system-overlay for a given group-box. Used by the in-
     * place updaters so a filter change or single-node drag never triggers a
     * full systemOverlayLayer rebuild (which used to clear and re-create every
     * overlay element on every drag tick — visible flash).
     */
    function syncSystemOverlayForBox(sysName, rect) {
        if (!systemOverlayLayer) return;
        var sel = '.system-overlay[data-system="' + cssEscape(sysName) + '"]';
        var overlay = systemOverlayLayer.querySelector(sel);
        if (!rect) {
            if (overlay) overlay.style.display = 'none';
            return;
        }
        if (overlay) {
            overlay.style.display = '';
            overlay.style.left = (rect.left + rect.width / 2) + 'px';
            overlay.style.top  = (rect.top + rect.height / 2) + 'px';
            return;
        }
        overlay = document.createElement('div');
        overlay.className = 'system-overlay';
        overlay.setAttribute('data-system', sysName);
        overlay.textContent = sysName;
        overlay.style.left = (rect.left + rect.width / 2) + 'px';
        overlay.style.top  = (rect.top + rect.height / 2) + 'px';
        systemOverlayLayer.appendChild(overlay);
        // Cached node-lists are stale and the new element hasn't yet been
        // given opacity / counter-scale. Invalidate, then run the updater so
        // the new overlay matches the current zoom on the next paint.
        invalidateOverlayCache();
        updateSystemOverlays();
    }

    /**
     * Walk every existing `.group-box` and recompute its geometry in place
     * using only visible members. No DOM teardown — boxes whose members are
     * all hidden get display:none. This is the filter-event path; the
     * previous version did `groupLayer.innerHTML = ''` inside an rAF, which
     * vanished every system frame and overlay for one paint cycle (the
     * "elements disappearing" symptom).
     */
    function updateGroupsForFilter() {
        if (!groupLayer) return;
        var boxes = groupLayer.querySelectorAll('.group-box');
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            var sysName = box.getAttribute('data-system') || '';
            var members = membersOfSystem(sysName);
            var rect = computeGroupRect(members);
            if (!rect) {
                box.style.display = 'none';
                syncSystemOverlayForBox(sysName, null);
                continue;
            }
            box.style.display = '';
            box.style.left   = rect.left   + 'px';
            box.style.top    = rect.top    + 'px';
            box.style.width  = rect.width  + 'px';
            box.style.height = rect.height + 'px';
            syncSystemOverlayForBox(sysName, rect);
        }
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
        invalidateOverlayCache();
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
        renderSystemOverlays();
    }

    /**
     * Rebuild a single system's group-box in place. Used during node drag —
     * a full renderGroups() iterated every node and did a querySelector per
     * member, which dominated drag CPU on a graph with many systems. We also
     * sync only this system's overlay (instead of nuking the whole overlay
     * layer); previously every drag tick called `renderSystemOverlays()`,
     * which `innerHTML = ''`'d the layer and re-created every overlay
     * element — visible flash on the labels of unrelated systems.
     */
    function renderGroupForSystem(sysName) {
        if (!sysName) return;
        var existing = groupLayer.querySelector('.group-box[data-system="' + cssEscape(sysName) + '"]');
        var members = membersOfSystem(sysName);
        var rect = members.length ? computeGroupRect(members) : null;

        if (existing && rect) {
            existing.style.display = '';
            existing.style.left   = rect.left   + 'px';
            existing.style.top    = rect.top    + 'px';
            existing.style.width  = rect.width  + 'px';
            existing.style.height = rect.height + 'px';
        } else if (existing && !rect) {
            existing.remove();
            // The small-label NodeList lost a member — invalidate so
            // updateSystemOverlays re-picks it up.
            invalidateOverlayCache();
        } else if (!existing && rect) {
            var box = buildGroupBoxFor(sysName, members);
            if (box) {
                groupLayer.appendChild(box);
                invalidateOverlayCache();
            }
        }
        syncSystemOverlayForBox(sysName, rect);
    }

    // ---- System-name overlays ------------------------------------------
    // Big readable system labels that fade in only when zoomed out, so the
    // user can orient themselves when individual node text is too small to
    // read. They live in their own DOM layer (above nodes) so node bodies
    // can't obscure them.

    var SYSTEM_OVERLAY_FADE_HI = 0.65; // fully invisible at this scale and above
    var SYSTEM_OVERLAY_FADE_LO = 0.35; // fully opaque at this scale and below

    // Cached node-lists + last-applied style strings for updateSystemOverlays.
    // Without this, every wheel tick (post rAF-coalesce, still ~60/sec on
    // sustained zoom) ran two querySelectorAll's over the document and wrote
    // opacity + transform on every overlay/label, even when the values hadn't
    // changed. Invalidated whenever renderSystemOverlays repopulates the
    // layer (the new nodes don't yet carry the cached inline styles).
    var cachedOverlays = null;
    var cachedSmallLabels = null;
    var lastBigOpacityStr = null;
    var lastBigTransform = null;
    var lastSmallOpacityStr = null;
    var lastSmallPointerEvents = null;
    function invalidateOverlayCache() {
        cachedOverlays = null;
        cachedSmallLabels = null;
        lastBigOpacityStr = null;
        lastBigTransform = null;
        lastSmallOpacityStr = null;
        lastSmallPointerEvents = null;
    }

    /**
     * Read the geometry of every `.group-box` and emit a matching
     * `.system-overlay` element positioned at the box's top-centre. Cheap to
     * call: one DOM iteration plus a tiny element per system. Called
     * whenever group boxes change (renderGroups / renderGroupForSystem).
     */
    function renderSystemOverlays() {
        if (!systemOverlayLayer || !groupLayer) return;
        systemOverlayLayer.innerHTML = '';
        // Cleared NodeLists + style strings — the next updateSystemOverlays
        // pass needs to write the current opacity/transform onto the brand-new
        // elements, even if scale hasn't changed since the last call.
        invalidateOverlayCache();
        var boxes = groupLayer.querySelectorAll('.group-box');
        for (var i = 0; i < boxes.length; i++) {
            var b = boxes[i];
            var sysName = b.getAttribute('data-system') || '';
            var bx = parseFloat(b.style.left)   || 0;
            var by = parseFloat(b.style.top)    || 0;
            var bw = parseFloat(b.style.width)  || 0;
            var bh = parseFloat(b.style.height) || 0;
            var label = document.createElement('div');
            label.className = 'system-overlay';
            label.setAttribute('data-system', sysName);
            label.textContent = sysName;
            // Geometric centre of the box. CSS counter-translates by -50%/-50%
            // so the anchor sits dead-centre on (left+width/2, top+height/2).
            label.style.left = (bx + bw / 2) + 'px';
            label.style.top  = (by + bh / 2) + 'px';
            systemOverlayLayer.appendChild(label);
        }
        updateSystemOverlays();
    }

    /**
     * Recompute opacity + counter-scale on every system overlay. Counter-scale
     * keeps the label's on-screen size constant regardless of zoom; opacity
     * fades linearly between the FADE_HI and FADE_LO thresholds. Called from
     * applyTransform on every pan/zoom and after each render.
     */
    function updateSystemOverlays() {
        if (!systemOverlayLayer) return;
        var s = scale;
        var bigOpacity;
        if (s >= SYSTEM_OVERLAY_FADE_HI) bigOpacity = 0;
        else if (s <= SYSTEM_OVERLAY_FADE_LO) bigOpacity = 1;
        else bigOpacity = (SYSTEM_OVERLAY_FADE_HI - s) / (SYSTEM_OVERLAY_FADE_HI - SYSTEM_OVERLAY_FADE_LO);

        // At LOD `low` the per-node card labels are visible (centred on
        // each card), and a fully-opaque system overlay sitting on top
        // would obscure them. Cap the overlay at watermark opacity in
        // that tier so the system label is still readable for orientation
        // but card labels show through. LOD `far` keeps full opacity —
        // at that zoom card labels are smaller and need the system
        // overlay's stronger presence for orientation.
        if (lod === 'low' && bigOpacity > 0.35) bigOpacity = 0.35;

        var bigStr = bigOpacity === 0 ? '0'
                   : bigOpacity === 1 ? '1'
                   : bigOpacity.toFixed(2);
        var transform = bigOpacity === 0
            ? null
            : 'translate(-50%, -50%) scale(' + (1 / s).toFixed(3) + ')';

        // Big overlay: fades in as zoom decreases.
        if (cachedOverlays === null) {
            cachedOverlays = systemOverlayLayer.querySelectorAll('.system-overlay');
        }
        if (bigStr !== lastBigOpacityStr || transform !== lastBigTransform) {
            for (var i = 0; i < cachedOverlays.length; i++) {
                var o = cachedOverlays[i];
                if (bigStr !== lastBigOpacityStr) o.style.opacity = bigStr;
                if (transform !== lastBigTransform && transform !== null) {
                    o.style.transform = transform;
                }
            }
            lastBigOpacityStr = bigStr;
            lastBigTransform = transform;
        }

        // Small corner badge: inverse fade so the two labels never compete
        // at mid-zoom. Pointer-events go to none when invisible so the badge
        // doesn't intercept clicks aimed at the canvas behind.
        if (groupLayer) {
            if (cachedSmallLabels === null) {
                cachedSmallLabels = groupLayer.querySelectorAll('.group-box-label');
            }
            var smallOpacity = 1 - bigOpacity;
            var smallStr = smallOpacity === 1 ? '' : smallOpacity === 0 ? '0' : smallOpacity.toFixed(2);
            var pe = smallOpacity < 0.05 ? 'none' : '';
            if (smallStr !== lastSmallOpacityStr || pe !== lastSmallPointerEvents) {
                for (var k = 0; k < cachedSmallLabels.length; k++) {
                    var lbl = cachedSmallLabels[k];
                    if (smallStr !== lastSmallOpacityStr) lbl.style.opacity = smallStr;
                    if (pe !== lastSmallPointerEvents) lbl.style.pointerEvents = pe;
                }
                lastSmallOpacityStr = smallStr;
                lastSmallPointerEvents = pe;
            }
        }
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

        var icon = nodeTypeIcon14(node.type);
        var headerLabel = node.label || node.id;
        var totalAttrs = (node.columns || []).length;

        // Native tooltip on the card. Useful at LOD `low` where the
        // centered card label can ellipsis-truncate long compound names —
        // hover surfaces the full text without needing to zoom in.
        el.setAttribute('title', headerLabel);

        // Centred card label — visible only at LOD `low` (~22-45 % scale).
        // Sits behind the regular header chrome (z-index 1) so hover
        // affordances on the header still register at higher LODs. Span
        // wrapper carries the truncation styles; the parent does the
        // centring layout so the ellipsis kicks in within the card width.
        var html =
            '<div class="node-low-label" aria-hidden="true">' +
                '<span>' + escapeHtml(headerLabel) + '</span>' +
            '</div>';

        html +=
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
        // Same icon as Util.nodeTypeIcon('codelist') for visual consistency.
        // Click selects the codelist (info-panel renders its codes).
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

    // ---- Incremental rendering (single-entity events) -------------------
    // Single-entity state events (`'nodes'`/`'edges'` carrying an id) take
    // these paths instead of the full renderAll. Replacing one .node or one
    // .edge-group is bounded work — typing a new label on one node no
    // longer rebuilds 256 nodes worth of attribute rows.

    /**
     * Build a fresh DOM element for `node` and put it in the right place,
     * replacing the existing element if present, otherwise appending. Updates
     * `nodeElById`.  Pulled out so renderNodeIncremental and the codelist
     * badge-refresh path inside renderEdgeIncremental share the same logic.
     */
    function swapNodeDOM(node) {
        if (!node || !isOnCanvas(node)) return null;
        var existing = nodeElById[node.id];
        if (!existing && nodeLayer) {
            existing = nodeLayer.querySelector('[data-node-id="' + cssEscape(node.id) + '"]');
        }
        var freshEl = createNodeEl(node);
        nodeElById[node.id] = freshEl;
        if (existing) existing.replaceWith(freshEl);
        else nodeLayer.appendChild(freshEl);
        return freshEl;
    }

    /**
     * Apply a single-node state change (add / update / delete) without
     * touching unrelated DOM. Caller must follow up with applyFilterDim
     * (which is what the State.on dispatcher does).
     */
    function renderNodeIncremental(id) {
        var node = State.getNode(id);
        var existing = nodeElById[id];
        if (!existing && nodeLayer) {
            existing = nodeLayer.querySelector('[data-node-id="' + cssEscape(id) + '"]');
        }

        // Codelist FK badges are derived from the edge index; rebuild it so
        // the next createNodeEl call reflects current FKs. Cheap (linear in
        // edges).
        codelistRefsByNode = buildCodelistRefsIndex();

        if (!node) {
            // Delete (or off-canvas type change with stale DOM).
            if (existing) existing.remove();
            delete nodeElById[id];
            // Cascade in the canvas: drop edge DOM whose endpoints reference
            // the deleted id. State.deleteNode already removed those edges
            // from state, but no per-edge events were emitted (we collapse
            // the cascade into the single 'nodes' event).
            var sel = '[data-from="' + cssEscape(id) + '"], [data-to="' + cssEscape(id) + '"]';
            edgeLayer.querySelectorAll(sel).forEach(function (g) { g.remove(); });
            edgeOverlay.querySelectorAll(sel).forEach(function (g) { g.remove(); });
            rebuildGroupsIncremental();
            updateNodeSelection();
            return;
        }

        if (!isOnCanvas(node)) {
            // Type changed to something off-canvas (e.g. → codelist). Drop
            // any DOM we had for it; edges to/from it are codelist edges
            // and shouldn't be drawn either.
            if (existing) {
                existing.remove();
                delete nodeElById[id];
            }
            var sel2 = '[data-from="' + cssEscape(id) + '"], [data-to="' + cssEscape(id) + '"]';
            edgeLayer.querySelectorAll(sel2).forEach(function (g) { g.remove(); });
            edgeOverlay.querySelectorAll(sel2).forEach(function (g) { g.remove(); });
            rebuildGroupsIncremental();
            return;
        }

        var freshEl = swapNodeDOM(node);
        // Scope contenteditable update to the newly-built subtree — walking
        // every editable in the entire layer (~2.5k on IBPDI) is wasteful
        // when we just touched one node.
        if (freshEl) setEditMode(State.getMode() === 'edit', freshEl);

        // Edges may need rerouting (column add/remove changes node height).
        updateEdgesForNode(id);
        // System membership / dimensions may have changed (label width,
        // expanded sets, system reassignment).
        rebuildGroupsIncremental();
        updateNodeSelection();
    }

    /**
     * Apply a single-edge state change without touching unrelated DOM.
     * Codelist edges aren't drawn — they manifest as a badge on the
     * non-codelist endpoint's column row, so we refresh that node's DOM
     * when one comes or goes.
     */
    function renderEdgeIncremental(id) {
        var edge = State.getEdge(id);
        var sel = '[data-edge-id="' + cssEscape(id) + '"]';
        var existing = edgeLayer.querySelector(sel) || edgeOverlay.querySelector(sel);

        codelistRefsByNode = buildCodelistRefsIndex();

        if (!edge) {
            if (existing) existing.remove();
            return;
        }

        var fromNode = State.getNode(edge.from);
        var toNode = State.getNode(edge.to);

        if (!isOnCanvas(fromNode) || !isOnCanvas(toNode)) {
            // Codelist FK edge — drop any DOM (shouldn't exist) and refresh
            // the on-canvas endpoint's badges.
            if (existing) existing.remove();
            var subjectId = (fromNode && fromNode.type === 'codelist') ? edge.to : edge.from;
            var subjectNode = State.getNode(subjectId);
            if (subjectNode) swapNodeDOM(subjectNode);
            return;
        }

        var fresh = createEdgeEl(edge);
        if (!fresh) {
            if (existing) existing.remove();
            return;
        }
        var selId = State.getSelectedEdgeId();
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
    }

    /**
     * Diff-style rebuild of the system frames. Composed of two pure-ish
     * passes:
     *   1. `reconcileGroups()` — compute what should change, returning a
     *      plan of {update / hide / remove / add} ops. Reads State + the
     *      existing `.group-box` DOM, but doesn't mutate anything.
     *   2. `applyGroupPlan(plan)` — execute the plan against the DOM and
     *      the overlay layer.
     * Splitting like this localises the "what changed" reasoning in one
     * place; previously the choreography between three render targets
     * (groupLayer + systemOverlayLayer + cachedOverlays) was tangled
     * across one function. No `innerHTML = ''` teardown either way —
     * that was the source of the system-frame flash on every node edit.
     */
    function rebuildGroupsIncremental() {
        if (!groupLayer) return;
        var plan = reconcileGroups();
        applyGroupPlan(plan);
    }

    /**
     * Compute the set of group-box transitions needed to bring the DOM
     * back in sync with State. Returns four arrays of ops; doesn't mutate.
     *
     *   update — { sysName, box, rect }      (existing box, geometry changed)
     *   hide   — { sysName, box }            (existing box, no visible members)
     *   remove — { sysName, box }            (existing box, system gone)
     *   add    — { sysName, members, rect }  (new system, no box yet)
     */
    function reconcileGroups() {
        // Group visible nodes by system label.
        var nodes = State.getNodes();
        var byS = Object.create(null);
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (!isOnCanvas(n)) continue;
            var s = (n.system || '').trim();
            if (!s) continue;
            (byS[s] = byS[s] || []).push(n);
        }

        var update = [], hide = [], remove = [], add = [];
        var seen = Object.create(null);

        // Walk existing DOM boxes — classify each as remove / hide / update.
        var existingBoxes = groupLayer.querySelectorAll('.group-box');
        for (var j = 0; j < existingBoxes.length; j++) {
            var box = existingBoxes[j];
            var sysName = box.getAttribute('data-system') || '';
            seen[sysName] = true;
            if (!byS[sysName]) {
                remove.push({ sysName: sysName, box: box });
                continue;
            }
            var rect = computeGroupRect(byS[sysName]);
            if (!rect) {
                hide.push({ sysName: sysName, box: box });
                continue;
            }
            update.push({ sysName: sysName, box: box, rect: rect });
        }

        // Systems that exist in State but have no DOM box yet → append.
        Object.keys(byS).forEach(function (sysName) {
            if (seen[sysName]) return;
            var members = byS[sysName];
            var rect = computeGroupRect(members);
            if (!rect) return; // no visible members — skip
            add.push({ sysName: sysName, members: members, rect: rect });
        });

        return { update: update, hide: hide, remove: remove, add: add };
    }

    /**
     * Execute a plan from reconcileGroups against the DOM. Each op kind
     * maps to a focused mutation; the overlay-cache invalidation only
     * fires on adds + removes (the structure changed) — display / geometry
     * changes don't touch the cache.
     */
    function applyGroupPlan(plan) {
        plan.remove.forEach(function (op) {
            op.box.remove();
            syncSystemOverlayForBox(op.sysName, null);
            invalidateOverlayCache();
        });
        plan.hide.forEach(function (op) {
            op.box.style.display = 'none';
            syncSystemOverlayForBox(op.sysName, null);
        });
        plan.update.forEach(function (op) {
            var box = op.box, r = op.rect;
            box.style.display = '';
            box.style.left   = r.left   + 'px';
            box.style.top    = r.top    + 'px';
            box.style.width  = r.width  + 'px';
            box.style.height = r.height + 'px';
            syncSystemOverlayForBox(op.sysName, r);
        });
        plan.add.forEach(function (op) {
            var box = buildGroupBoxFor(op.sysName, op.members);
            if (!box) return;
            groupLayer.appendChild(box);
            invalidateOverlayCache();
            syncSystemOverlayForBox(op.sysName, op.rect);
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
            // single-pointer pan or drag that was in progress; it would
            // otherwise double-up with the pinch translate, or — for drag
            // — keep mutating with a stale dragCursorOffset captured at
            // the pre-pinch scale.
            if (isPanning) {
                isPanning = false;
                canvasEl.classList.remove('is-panning');
            }
            if (isDragging) {
                onDragEnd();
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
        // pointercancel sometimes arrives with a real pointerId (e.g. one
        // finger of a pinch) — but treat any cancel as "force-end the
        // gesture entirely", since we can't trust the remaining tracked
        // pointer's state once the OS has interrupted us. Without this,
        // an interrupted pinch left pinchInitial set forever, clobbering
        // every subsequent single-pointer pan via the "pinch wins" branch
        // in flushPointerFrame.
        var isCancel = e && e.type === 'pointercancel';
        if (isCancel) {
            activePointers.clear();
        } else if (e && e.pointerId != null) {
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

    // Wheel events arrive at >60 Hz on trackpads. We update scale / translate
    // synchronously per tick (so successive ticks compose correctly) but defer
    // the visual `applyTransform()` to a single rAF — collapsing N events per
    // frame into one transform write, one grid update, one overlay opacity
    // pass, and one transform-listener fan-out.
    var wheelRafQueued = false;
    function onWheel(e) {
        e.preventDefault();
        var factor = e.deltaY > 0 ? WHEEL_ZOOM_OUT : WHEEL_ZOOM_IN;
        var newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
        var rect = canvasEl.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        translateX = mx - (mx - translateX) * (newScale / scale);
        translateY = my - (my - translateY) * (newScale / scale);
        scale = newScale;
        if (wheelRafQueued) return;
        wheelRafQueued = true;
        requestAnimationFrame(function () {
            wheelRafQueued = false;
            applyTransform();
        });
    }

    // ---- Canvas keyboard navigation (a11y parallel to mouse) -----------
    // Keyboard model — keeps mouse pan/zoom untouched:
    //   Arrow keys                      pan 60 px        (1 dot-grid row)
    //   Shift + Arrow                   pan 240 px       (4×, fast pan)
    //   +  / =                          zoom in  (centre-anchored)
    //   −  / _                          zoom out
    //   0                               home (curator's saved view, falls
    //                                   back to fit-with-floor)
    //   1                               fit to screen
    //   Tab / Shift+Tab between nodes   handled by the browser's natural
    //                                   tab order — only nodes inside the
    //                                   current viewport are focusable
    //                                   (roving tabindex below) so a 256-
    //                                   node graph behaves like ~10-20.
    //
    // Active only when focus is inside the canvas. Inputs (text fields,
    // contenteditable) bail before the handler reaches them so typing in
    // a node label doesn't pan the diagram.
    // KEY_PAN_STEP / KEY_PAN_STEP_FAST defined at the top of the module
    // alongside ZOOM_FACTOR / WHEEL_ZOOM_* — single constants block.

    function onCanvasKeydown(e) {
        // Don't preempt text input — the user is editing a label / system /
        // attribute, not navigating.
        if (e.target && e.target.matches &&
            e.target.matches('input, textarea, select, [contenteditable="true"]')) {
            return;
        }
        // Ignore when a modifier other than Shift is held — Ctrl+Z (undo),
        // Ctrl+S (save) etc. should not hit this handler. We do allow
        // Shift since it modifies the pan step (fast vs normal).
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        var step = e.shiftKey ? KEY_PAN_STEP_FAST : KEY_PAN_STEP;
        var handled = true;

        switch (e.key) {
            case 'ArrowLeft':  translateX += step; break;
            case 'ArrowRight': translateX -= step; break;
            case 'ArrowUp':    translateY += step; break;
            case 'ArrowDown':  translateY -= step; break;
            case '+':
            case '=':
                zoomIn();
                e.preventDefault();
                return;
            case '-':
            case '_':
                zoomOut();
                e.preventDefault();
                return;
            case '0':
                goHome();
                e.preventDefault();
                return;
            case '1':
                fitToScreen();
                e.preventDefault();
                return;
            default:
                handled = false;
        }

        if (handled) {
            e.preventDefault();
            applyTransform();
        }
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
    // First-paint floor was 0.25 — a "don't make BBL too tiny on a big
     // monitor" protection — but huge graphs (IBPDI-scale, ~10k×8k px after
     // auto-layout) genuinely need to fit at single-digit percent. Drop to
     // 0.05 so the initial framing actually shows the whole graph; the LOD
     // tiers carry the now-tiny cards as silhouettes + system labels, which
     // is what the user wants for orientation on first load.
    var INITIAL_MIN_SCALE = 0.05;
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

    /**
     * Sync the dot-grid background to the current pan/zoom. Hysteresis around
     * 0.4 prevents flapping when wheel zoom crosses the threshold; the cached
     * `gridOn / lastGridSize / lastGridPos*` values mean a wheel burst writes
     * only the props that actually changed (background-position, basically),
     * not all three on every tick.
     */
    function updateGridBackground() {
        if (!canvasEl) return;
        var wantOn;
        if (gridOn === null)      wantOn = scale >= GRID_ON_ABOVE;
        else if (gridOn)          wantOn = scale >= GRID_OFF_BELOW;
        else                      wantOn = scale >= GRID_ON_ABOVE;
        if (wantOn !== gridOn) {
            canvasEl.style.backgroundImage = wantOn
                ? 'radial-gradient(var(--color-bg-grid-dot) 1px, transparent 1px)'
                : 'none';
            gridOn = wantOn;
            if (!wantOn) {
                // Force re-write of size/pos when the grid comes back on so a
                // pan-while-off → zoom-on transition doesn't leave a stale offset.
                lastGridSize = -1;
                lastGridPosX = NaN;
                lastGridPosY = NaN;
            }
        }
        if (!wantOn) return;
        var size = 24 * scale;
        if (size !== lastGridSize) {
            canvasEl.style.backgroundSize = size + 'px ' + size + 'px';
            lastGridSize = size;
        }
        if (translateX !== lastGridPosX || translateY !== lastGridPosY) {
            canvasEl.style.backgroundPosition = translateX + 'px ' + translateY + 'px';
            lastGridPosX = translateX;
            lastGridPosY = translateY;
        }
    }

    /**
     * State-machine LOD with hysteresis. Each tier has [enter-when-below,
     * exit-when-above] bounds; we only step UP (more detail) when scale
     * rises past the upper bound, only step DOWN (less detail) when it
     * falls past the lower bound. The initial pick (no prior state) uses
     * the band midpoints. See the LOD comment on lod-related constants
     * above for tier semantics.
     */
    // Tier table — each row says "if previous tier was X, leave it when
    // scale crosses {downAt, upAt}". `downAt` is the lower hysteresis bound
    // (drop to coarser tier when scale falls past it); `upAt` is the upper
    // bound (jump to finer tier when scale rises past it). The initial
    // bucket (no prev state) is picked by the band midpoints below.
    var LOD_BANDS = [
        { tier: 'far',  downAt: -Infinity, upAt: 0.25 },
        { tier: 'low',  downAt: 0.20,      upAt: 0.45 },
        { tier: 'mid',  downAt: 0.40,      upAt: 0.75 },
        { tier: 'full', downAt: 0.70,      upAt: Infinity }
    ];
    var LOD_INITIAL_PICKS = [
        { tier: 'far',  below: 0.225 },
        { tier: 'low',  below: 0.425 },
        { tier: 'mid',  below: 0.725 },
        { tier: 'full', below: Infinity }
    ];

    function computeLod(prev, s) {
        for (var i = 0; i < LOD_BANDS.length; i++) {
            var band = LOD_BANDS[i];
            if (band.tier !== prev) continue;
            // Cross down → previous tier on the coarser side.
            if (s < band.downAt && i > 0) return LOD_BANDS[i - 1].tier;
            // Cross up → next tier on the finer side.
            if (s > band.upAt && i < LOD_BANDS.length - 1) return LOD_BANDS[i + 1].tier;
            return band.tier;
        }
        // Initial pick — no `prev` matched, choose by band midpoint.
        for (var j = 0; j < LOD_INITIAL_PICKS.length; j++) {
            if (s < LOD_INITIAL_PICKS[j].below) return LOD_INITIAL_PICKS[j].tier;
        }
        return 'full';
    }

    /**
     * Recompute LOD on every transform change. CSS uses `visibility: hidden`
     * (not `display: none`) on the row subtree so node heights are preserved
     * across the far/low boundary — group boxes don't need re-measuring.
     */
    function updateLod() {
        if (!canvasEl) return;
        var next = computeLod(lod, scale);
        if (next === lod) return;
        lod = next;
        canvasEl.setAttribute('data-lod', next);
        // is-low-zoom remains the union of 'far' + 'low' so existing styles
        // (silhouette tinting, hidden attribute rows, hidden header chrome)
        // need no migration.
        canvasEl.classList.toggle('is-low-zoom', next === 'far' || next === 'low');
    }

    function applyTransform() {
        transformEl.style.transform =
            'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
        updateGridBackground();
        updateLod();
        if (zoomLabel) {
            var pct = Math.round(scale * 100);
            // Append the LOD descriptor at the extremes — gives users a
            // narrative for "why don't I see edge labels at 30 %?" instead
            // of letting the disappearing detail read as a bug. Mid / full
            // tiers get the bare percentage (no annotation needed; you can
            // see everything at those levels).
            var lodLabel = '';
            if (lod === 'far') lodLabel = ' · Übersicht';
            else if (lod === 'low') lodLabel = ' · Karte';
            // Compose-then-compare so we don't fight ourselves on the LOD
            // boundary (where pct may not change but the LOD does).
            var next = pct + '%' + lodLabel;
            if (next !== lastZoomPct) {
                zoomLabel.textContent = next;
                lastZoomPct = next;
            }
        }
        // Selection chrome (node action bar) lives in canvas viewport coords —
        // re-anchor it whenever the transform changes.
        if (window.CanvasApp.Editor && window.CanvasApp.Editor.repositionActionBar) {
            window.CanvasApp.Editor.repositionActionBar();
        }
        updateSystemOverlays();
        for (var i = 0; i < transformListeners.length; i++) {
            try { transformListeners[i](); } catch (e) { console.error(e); }
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
    /**
     * Toggle contenteditable on every editable span inside `root` (defaults
     * to nodeLayer). After an incremental single-node render, callers should
     * pass the freshly-built node element — walking the entire layer to set
     * an attribute on every node's editables (~2.5k spans on IBPDI) was
     * dominating the per-blur cost.
     */
    function setEditMode(isEdit, root) {
        var scope = root || nodeLayer;
        scope.querySelectorAll('[data-edit]').forEach(function (el) {
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

    /**
     * Mutate the live transform from outside (currently used by the minimap
     * to pan on click/drag). Any field omitted is left as-is. scale is
     * clamped to MIN/MAX. Calls applyTransform so listeners fire.
     */
    function setTransform(t) {
        if (!t) return;
        if (typeof t.translateX === 'number') translateX = t.translateX;
        if (typeof t.translateY === 'number') translateY = t.translateY;
        if (typeof t.scale === 'number') scale = clamp(t.scale, MIN_SCALE, MAX_SCALE);
        applyTransform();
    }

    /**
     * Subscribe to transform changes (pan, zoom, fit, home, programmatic).
     * Returns nothing — listeners persist for the life of the page.
     */
    function onTransform(fn) {
        if (typeof fn === 'function') transformListeners.push(fn);
    }

    /**
     * World-coordinate bounding box of every on-canvas node, or null when
     * the canvas is empty. Codelists are excluded (they aren't drawn). When
     * filters are active, only the matching subset contributes — so the
     * minimap reframes to what the user currently sees. No padding — callers
     * add their own framing margin.
     */
    function getWorldBounds() {
        var nodes = State.getNodes();
        var filtersActive = State.hasActiveFilters();
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        var any = false;
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (!isOnCanvas(n)) continue;
            if (filtersActive && !State.matchesFilters(n)) continue;
            var r = getNodeRect(n);
            any = true;
            if (r.x < minX) minX = r.x;
            if (r.y < minY) minY = r.y;
            if (r.x + r.w > maxX) maxX = r.x + r.w;
            if (r.y + r.h > maxY) maxY = r.y + r.h;
        }
        if (!any) return null;
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    // ---- Util ----------------------------------------------------------

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    // Shared escape / cssEscape helpers — single source of truth in Util.
    var escapeHtml = window.CanvasApp.Util.escapeHtml;
    var escapeAttr = window.CanvasApp.Util.escapeAttr;
    var cssEscape  = window.CanvasApp.Util.cssEscape;

    // Public API — only methods called from outside this module. Bulk
    // render entry points (renderNodes / renderEdges / renderGroups) and
    // fine-grained internals (updateNodeSelection, updateEdgesForNode,
    // initialView, setHomeFromCurrent, getWorldBounds) used to ship here
    // but had zero external callers; trimmed to make the surface match
    // actual use, so future contributors aren't tempted to wire to a
    // private helper.
    return {
        init: init,
        renderAll: renderAll,
        applyFilterDim: applyFilterDim,
        toggleSet: toggleSet,
        isSetExpanded: isSetExpanded,
        setAllSetsExpanded: setAllSetsExpanded,
        rebuildGroupsIncremental: rebuildGroupsIncremental,
        renderGroupForSystem: renderGroupForSystem,
        refreshNode: renderNodeIncremental,
        fitToScreen: fitToScreen,
        goHome: goHome,
        getNodeEl: getNodeEl,
        getNodeRect: getNodeRect,
        getTransform: getTransform,
        setTransform: setTransform,
        onTransform: onTransform,
        clientToCanvas: clientToCanvas,
        setEditMode: setEditMode
    };
})();
