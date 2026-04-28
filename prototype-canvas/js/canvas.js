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
    function expandKey(nodeId, setName) { return nodeId + '|' + (setName || ''); }
    function isSetExpanded(nodeId, setName) {
        return collapsedSets[expandKey(nodeId, setName)] !== true;
    }
    function toggleSet(nodeId, setName) {
        var k = expandKey(nodeId, setName);
        if (collapsedSets[k]) delete collapsedSets[k]; // expand
        else collapsedSets[k] = true;                  // collapse
    }
    function migrateSetState(nodeId, oldName, newName) {
        var oldKey = expandKey(nodeId, oldName);
        var newKey = expandKey(nodeId, newName);
        if (collapsedSets[oldKey]) {
            collapsedSets[newKey] = true;
            delete collapsedSets[oldKey];
        } else {
            delete collapsedSets[newKey];
        }
    }
    /** Bulk: expand or collapse every property set across every node. */
    function setAllSetsExpanded(expanded) {
        if (expanded) {
            collapsedSets = Object.create(null);
        } else {
            collapsedSets = Object.create(null);
            State.getNodes().forEach(function (n) {
                State.derivePropertySets(n).forEach(function (s) {
                    collapsedSets[expandKey(n.id, s.name)] = true;
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
    var dragStartClient = null;
    var dragNodeStart = null;

    // rAF-coalesced pointer pipeline. Pan and drag handlers used to do their
    // full work synchronously per pointermove; on a high-rate trackpad that
    // dispatched several heavy updates per frame (transform + persist +
    // edge re-route + group rebuild). Now: handlers stash the latest client
    // x/y, one rAF per frame applies the most recent values.
    var pointerRafQueued = false;
    var pendingPointer = null; // { panX, panY } || { dragX, dragY } || both fields

    function schedulePointerFrame(pan, drag) {
        if (!pendingPointer) pendingPointer = {};
        if (pan) { pendingPointer.panX = pan.x; pendingPointer.panY = pan.y; }
        if (drag) { pendingPointer.dragX = drag.x; pendingPointer.dragY = drag.y; }
        if (pointerRafQueued) return;
        pointerRafQueued = true;
        requestAnimationFrame(flushPointerFrame);
    }

    function flushPointerFrame() {
        pointerRafQueued = false;
        var p = pendingPointer;
        pendingPointer = null;
        if (!p) return;
        if (isPanning && p.panX != null) {
            translateX = panStart.tx + (p.panX - panStart.x);
            translateY = panStart.ty + (p.panY - panStart.y);
            applyTransform();
        }
        if (isDragging && p.dragX != null) {
            applyDragMove(p.dragX, p.dragY);
        }
    }

    // Cache: node-id → DOM element. Built fresh in renderNodes; the previous
    // pattern was a `nodeLayer.querySelector('[data-node-id="..."]')` per
    // edge endpoint per render and per drag tick. Multiplied across all
    // edges that's hundreds of selectors per frame on a non-trivial graph.
    var nodeElById = Object.create(null);
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

    function init(opts) {
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
        document.getElementById('zoom-reset').addEventListener('click', resetLayout);

        // State events
        State.on(function (reason) {
            if (reason === 'replace' || reason === 'reset') {
                collapsedSets = Object.create(null);
            }
            if (reason === 'nodes' || reason === 'edges' || reason === 'replace' || reason === 'reset') {
                renderAll();
            } else if (reason === 'selection') {
                updateNodeSelection();
                // Selection changes used to drive a full edge re-render
                // (querySelector × 2 per edge); now we only diff the two
                // affected edges between layers.
                updateEdgeSelection();
                focusSelectedEdgeInput();
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
        State.getNodes().forEach(function (node) {
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

        if (sets.length === 0) {
            // Flat list — no sets in use
            html += '<ul class="node-cols">';
            cols.forEach(function (c, idx) { html += colRowHtml(c, idx); });
            html += '</ul>';
            html += '<div class="node-col-add edit-only" data-action="add-col" data-set="">+ Spalte</div>';
        } else {
            // Group by property set in a single pass — was three passes over
            // cols (init bySet, build HTML, then per-set filter for count).
            var ungroupedHtml = '';
            var bySet = {};
            var countBySet = {};
            sets.forEach(function (s) { bySet[s.name] = ''; countBySet[s.name] = 0; });
            cols.forEach(function (c, idx) {
                var rowHtml = colRowHtml(c, idx);
                if (c.set && bySet.hasOwnProperty(c.set)) {
                    bySet[c.set] += rowHtml;
                    countBySet[c.set] += 1;
                } else {
                    ungroupedHtml += rowHtml;
                }
            });

            if (ungroupedHtml) {
                html += '<ul class="node-cols">' + ungroupedHtml + '</ul>';
            }

            sets.forEach(function (s) {
                var expanded = isSetExpanded(node.id, s.name);
                html += setSectionHtml(s, countBySet[s.name] || 0, bySet[s.name], expanded);
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
        var name = s.name || '';
        var safeName = escapeAttr(name);
        return '' +
            '<div class="node-set' + (expanded ? ' is-expanded' : '') + '" data-set="' + safeName + '">' +
                '<div class="node-set-header" data-action="toggle-set" data-set="' + safeName + '">' +
                    '<span class="node-set-toggle" aria-hidden="true">' +
                        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>' +
                    '</span>' +
                    '<span class="node-set-name" data-edit="set-name" data-set="' + safeName + '" contenteditable="false" spellcheck="false">' + escapeHtml(name) + '</span>' +
                    '<span class="node-set-count">' + count + '</span>' +
                '</div>' +
                '<div class="node-set-content">' +
                    '<ul class="node-cols">' + colsHtml + '</ul>' +
                    '<div class="node-col-add edit-only" data-action="add-col" data-set="' + safeName + '">+ Spalte</div>' +
                '</div>' +
            '</div>';
    }

    function colRowHtml(c, idx) {
        var key = c.key || '';
        var keyClass = key === 'PK' ? 'pk' : key === 'FK' ? 'fk' : key === 'UK' ? 'uk' : '';
        var keyLabel = KEY_LABELS[key] || KEY_LABELS[''];
        var keyTitle = 'Klicken: PK → FK → UK → –';
        return '' +
            '<li class="node-col" data-col-idx="' + idx + '">' +
                '<span class="node-col-handle edit-only" data-col-idx="' + idx + '" title="Verschieben">' +
                    '<svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">' +
                        '<circle cx="2.5" cy="3" r="1"/><circle cx="2.5" cy="7" r="1"/><circle cx="2.5" cy="11" r="1"/>' +
                        '<circle cx="5.5" cy="3" r="1"/><circle cx="5.5" cy="7" r="1"/><circle cx="5.5" cy="11" r="1"/>' +
                    '</svg>' +
                '</span>' +
                '<span class="node-col-key ' + keyClass + '" data-edit="key" data-col-idx="' + idx + '" title="' + keyTitle + '">' + keyLabel + '</span>' +
                '<span class="node-col-name" data-edit="col-name" data-col-idx="' + idx + '" contenteditable="false" spellcheck="false">' + escapeHtml(c.name || '') + '</span>' +
                '<span class="node-col-type" data-edit="col-type" data-col-idx="' + idx + '" contenteditable="false" spellcheck="false">' + escapeHtml(c.type || '') + '</span>' +
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
            var groupEl = createEdgeEl(edge);
            if (!groupEl) return;
            // Selected edge renders in the overlay so its handles + foreignObject
            // sit ABOVE the node-layer (nodes paint between the two SVGs).
            var target = (edge.id === selId) ? edgeOverlay : edgeLayer;
            target.appendChild(groupEl);
        });
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

        if (isSelected && isEdit) {
            // Inline label editor: input with × clear (inside) and trash (outside)
            var FO_W = 220, FO_H = 30;
            var fo = document.createElementNS(ns, 'foreignObject');
            fo.setAttribute('x', path.midX - FO_W / 2);
            fo.setAttribute('y', path.midY - FO_H / 2);
            fo.setAttribute('width', FO_W);
            fo.setAttribute('height', FO_H);
            fo.setAttribute('class', 'edge-label-fo');
            fo.innerHTML =
                '<div xmlns="http://www.w3.org/1999/xhtml" class="edge-label-edit">' +
                    '<div class="edge-label-input">' +
                        '<input type="text" data-edge-label-input value="' + escapeAttr(edge.label || '') + '" placeholder="Beziehung benennen…" spellcheck="false" />' +
                        '<button type="button" class="edge-clear" data-action="clear-label" title="Text leeren" tabindex="-1">' +
                            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                        '</button>' +
                    '</div>' +
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

        var dx = bx - ax;
        var c1x = ax + dx * 0.5;
        var c1y = ay;
        var c2x = bx - dx * 0.5;
        var c2y = by;

        var d = 'M ' + ax + ' ' + ay + ' C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + bx + ' ' + by;
        return {
            d: d,
            midX: (ax + bx) / 2,
            midY: (ay + by) / 2,
            startX: ax, startY: ay,
            endX: bx, endY: by
        };
    }

    function updateEdgesForNode(nodeId) {
        // Re-render edges that touch this node, in whichever layer they live
        var selId = State.getSelectedEdgeId();
        State.getEdges().forEach(function (edge) {
            if (edge.from !== nodeId && edge.to !== nodeId) return;
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
        // Don't pan if interacting with a node, an edge (in either layer),
        // any floating toolbar, or a system frame label.
        if (e.target.closest('.node')) return;
        if (e.target.closest('#edge-layer')) return;
        if (e.target.closest('#edge-overlay')) return;
        if (e.target.closest('.ft')) return;
        if (e.target.closest('.node-action-bar')) return;
        if (e.target.closest('.group-box-label')) return;
        // Edge-drawing in edit mode is handled by Editor module — bail
        if (canvasEl.classList.contains('is-edge-drawing')) return;

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
        // High-rate pointer streams used to drive applyTransform / drag work
        // synchronously per event. Coalesce to one rAF per frame so a fast
        // trackpad doesn't dispatch multiple repaints between frames.
        if (isPanning) {
            schedulePointerFrame({ x: e.clientX, y: e.clientY }, null);
        }
        if (isDragging) {
            schedulePointerFrame(null, { x: e.clientX, y: e.clientY });
        }
    }

    function onPanEnd() {
        if (isPanning) {
            isPanning = false;
            canvasEl.classList.remove('is-panning');
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
        // Use DOM rects for accurate height
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(function (n) {
            var r = getNodeRect(n);
            minX = Math.min(minX, r.x);
            minY = Math.min(minY, r.y);
            maxX = Math.max(maxX, r.x + r.w);
            maxY = Math.max(maxY, r.y + r.h);
        });
        var graphW = maxX - minX;
        var graphH = maxY - minY;
        var rect = canvasEl.getBoundingClientRect();
        var pad = 80;
        var sx = (rect.width - pad * 2) / graphW;
        var sy = (rect.height - pad * 2) / graphH;
        scale = clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE);
        translateX = (rect.width - graphW * scale) / 2 - minX * scale;
        translateY = (rect.height - graphH * scale) / 2 - minY * scale;
        applyTransform();
    }

    function resetLayout() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
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
        dragStartClient = { x: e.clientX, y: e.clientY };
        dragNodeStart  = { x: node.x || 0, y: node.y || 0 };
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
        var dx = (clientX - dragStartClient.x) / scale;
        var dy = (clientY - dragStartClient.y) / scale;
        var nx = dragNodeStart.x + dx;
        var ny = dragNodeStart.y + dy;
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
        toggleSet: toggleSet,
        isSetExpanded: isSetExpanded,
        migrateSetState: migrateSetState,
        setAllSetsExpanded: setAllSetsExpanded,
        renderGroups: renderGroups,
        fitToScreen: fitToScreen,
        getNodeEl: getNodeEl,
        getNodeRect: getNodeRect,
        getTransform: getTransform,
        clientToCanvas: clientToCanvas,
        setEditMode: setEditMode
    };
})();
