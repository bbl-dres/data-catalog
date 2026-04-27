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

    var MIN_SCALE = 0.2;
    var MAX_SCALE = 2.5;
    var ZOOM_STEP = 0.1;

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

    var isDragging = false;
    var dragNodeId = null;
    var dragStartClient = null;
    var dragNodeStart = null;

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
                renderEdges();
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

    /**
     * Render one bounding-box frame per `system` value in use. Nodes without a
     * system are excluded. The bbox uses each node's stored x/y plus its
     * actual offsetWidth/Height (so expanded property sets enlarge the frame).
     */
    function renderGroups() {
        groupLayer.innerHTML = '';
        var byS = {};
        State.getNodes().forEach(function (n) {
            var s = (n.system || '').trim();
            if (!s) return;
            (byS[s] = byS[s] || []).push(n);
        });

        var PAD = 18;
        var LABEL_H = 14; // visible height of label badge

        Object.keys(byS).forEach(function (sysName) {
            var members = byS[sysName];
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            var anyVisible = false;
            members.forEach(function (n) {
                var el = nodeLayer.querySelector('[data-node-id="' + cssEscape(n.id) + '"]');
                // offsetParent is null when the element (or any ancestor) is
                // display:none — that's our cue to skip hidden members so
                // the frame snaps to the visible nodes only.
                if (!el || el.offsetParent === null) return;
                anyVisible = true;
                var w = el.offsetWidth;
                var h = el.offsetHeight;
                var x = n.x || 0;
                var y = n.y || 0;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x + w > maxX) maxX = x + w;
                if (y + h > maxY) maxY = y + h;
            });
            if (!anyVisible || minX === Infinity) return;

            var box = document.createElement('div');
            box.className = 'group-box';
            box.setAttribute('data-system', sysName);
            box.style.left = (minX - PAD) + 'px';
            box.style.top = (minY - PAD - LABEL_H / 2) + 'px';
            box.style.width = (maxX - minX + PAD * 2) + 'px';
            box.style.height = (maxY - minY + PAD * 2 + LABEL_H / 2) + 'px';

            var label = document.createElement('span');
            label.className = 'group-box-label';
            label.textContent = sysName;
            box.appendChild(label);

            groupLayer.appendChild(box);
        });
    }

    function renderNodes() {
        nodeLayer.innerHTML = '';
        State.getNodes().forEach(function (node) {
            nodeLayer.appendChild(createNodeEl(node));
        });
        setEditMode(State.getMode() === 'edit');
    }

    function createNodeEl(node) {
        var el = document.createElement('div');
        el.className = 'node';
        el.setAttribute('data-node-id', node.id);
        el.setAttribute('data-type', node.type || 'table');
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

        var sets = node.propertySets || [];
        var cols = node.columns || [];

        if (sets.length === 0) {
            // Flat list — original layout
            html += '<ul class="node-cols">';
            cols.forEach(function (c, idx) { html += colRowHtml(c, idx); });
            html += '</ul>';
            html += '<div class="node-col-add edit-only" data-action="add-col" data-set="">+ Spalte</div>';
        } else {
            // Group by property set. Ungrouped first (no header), then each set.
            var setNames = sets.map(function (s) { return s.name; });
            var ungroupedHtml = '';
            var bySet = {};
            setNames.forEach(function (n) { bySet[n] = ''; });
            cols.forEach(function (c, idx) {
                var rowHtml = colRowHtml(c, idx);
                if (c.set && bySet.hasOwnProperty(c.set)) bySet[c.set] += rowHtml;
                else ungroupedHtml += rowHtml;
            });

            if (ungroupedHtml) {
                html += '<ul class="node-cols">' + ungroupedHtml + '</ul>';
            }

            sets.forEach(function (s) {
                var expanded = isSetExpanded(node.id, s.name);
                var count = (cols.filter(function (c) { return c.set === s.name; })).length;
                html += setSectionHtml(s, count, bySet[s.name], expanded);
            });
        }

        // + Property Set (always available in edit mode)
        html += '<div class="node-add-set edit-only" data-action="add-set">+ Property Set</div>';

        // Edge handles (visible only in edit mode via CSS)
        html += '<span class="node-port left" data-port="in" data-node-id="' + node.id + '"></span>';
        html += '<span class="node-port right" data-port="out" data-node-id="' + node.id + '"></span>';

        el.innerHTML = html;
        return el;
    }

    function setSectionHtml(s, count, colsHtml, expanded) {
        var name = s.name || '';
        var label = s.label || '';
        var safeName = escapeAttr(name);
        return '' +
            '<div class="node-set' + (expanded ? ' is-expanded' : '') + '" data-set="' + safeName + '">' +
                '<div class="node-set-header" data-action="toggle-set" data-set="' + safeName + '">' +
                    '<span class="node-set-toggle" aria-hidden="true">' +
                        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>' +
                    '</span>' +
                    '<span class="node-set-name" data-edit="set-name" data-set="' + safeName + '" contenteditable="false" spellcheck="false">' + escapeHtml(name) + '</span>' +
                    '<span class="node-set-sep">·</span>' +
                    '<span class="node-set-label" data-edit="set-label" data-set="' + safeName + '" contenteditable="false" spellcheck="false" data-placeholder="Beschreibung">' + escapeHtml(label) + '</span>' +
                    '<span class="node-set-count">' + count + '</span>' +
                    '<button class="node-set-delete edit-only" data-action="delete-set" data-set="' + safeName + '" title="Property Set entfernen (Spalten werden entgruppiert)" tabindex="-1">' +
                        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                    '</button>' +
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
            var label = document.createElementNS(ns, 'text');
            label.setAttribute('class', 'edge-label');
            label.setAttribute('x', path.midX);
            label.setAttribute('y', path.midY - 6);
            label.setAttribute('text-anchor', 'middle');
            label.textContent = edge.label;
            g.appendChild(label);
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
        var el = nodeLayer.querySelector('[data-node-id="' + cssEscape(node.id) + '"]');
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
            var nodeEl = nodeLayer.querySelector('[data-node-id="' + cssEscape(selAttr.nodeId) + '"]');
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
        if (isPanning) {
            translateX = panStart.tx + (e.clientX - panStart.x);
            translateY = panStart.ty + (e.clientY - panStart.y);
            applyTransform();
        }
        if (isDragging) {
            onDragMove(e);
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

    function zoomIn()  { zoomAt(scale + ZOOM_STEP); }
    function zoomOut() { zoomAt(scale - ZOOM_STEP); }

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
        if (e.target.closest('[contenteditable="true"], button, .node-port, .node-col, .node-col-key, .node-col-handle, .node-col-add, .node-add-set, .node-set-header, .node-type-icon')) {
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
            // Everything else (label, system, col-name, col-type, set-name,
            // set-label) becomes editable text in edit mode.
            var kind = el.getAttribute('data-edit');
            if (kind === 'type' || kind === 'key') return;
            el.setAttribute('contenteditable', isEdit ? 'true' : 'false');
        });
    }

    function onDragMove(e) {
        if (!isDragging || !dragNodeId) return;
        var dx = (e.clientX - dragStartClient.x) / scale;
        var dy = (e.clientY - dragStartClient.y) / scale;
        var nx = dragNodeStart.x + dx;
        var ny = dragNodeStart.y + dy;
        var el = nodeLayer.querySelector('[data-node-id="' + cssEscape(dragNodeId) + '"]');
        if (el) {
            el.style.left = nx + 'px';
            el.style.top = ny + 'px';
        }
        State.moveNode(dragNodeId, nx, ny);
        updateEdgesForNode(dragNodeId);
        // The dragged node's system frame needs to grow/shrink with it
        renderGroups();
        // Action bar follows the node it sits above
        if (window.CanvasApp.Editor && window.CanvasApp.Editor.repositionActionBar) {
            window.CanvasApp.Editor.repositionActionBar();
        }
    }

    function onDragEnd() {
        if (!isDragging) return;
        var el = nodeLayer.querySelector('[data-node-id="' + cssEscape(dragNodeId) + '"]');
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

    function getNodeEl(id) {
        return nodeLayer.querySelector('[data-node-id="' + cssEscape(id) + '"]');
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
        renderGroups: renderGroups,
        fitToScreen: fitToScreen,
        getNodeEl: getNodeEl,
        getNodeRect: getNodeRect,
        getTransform: getTransform,
        clientToCanvas: clientToCanvas,
        setEditMode: setEditMode
    };
})();
