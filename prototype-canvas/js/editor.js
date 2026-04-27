/**
 * Editor — inline edit mode for the canvas.
 *
 * In edit mode, node text is contenteditable; column keys (PK/FK/–) cycle on
 * click; the type icon cycles node type on click; small × buttons delete
 * nodes / columns; "+ Spalte" adds a column; dragging from a node port to
 * another node creates an edge; clicking an edge in edit mode deletes it.
 *
 * No popover, no modal — the node itself is the editor.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Editor = (function () {

    var State = null;
    var Canvas = null;

    var canvasEl = null;
    var nodeLayer = null;
    var edgePreview = null;
    var actionBarEl = null;

    // Edge-drawing state (port → new edge)
    var isDrawingEdge = false;
    var edgeFromNodeId = null;
    var edgePreviewPath = null;

    // Edge-retarget state (drag an existing edge endpoint onto a different node)
    var isRetargeting = false;
    var retargetEdgeId = null;
    var retargetEnd = null;       // 'from' | 'to'
    var retargetPreviewPath = null;

    // Views are kept supported in the data model so existing nodes still
    // render — but they're skipped in the cycle (and the entity palette)
    // so users don't create new ones.
    var TYPE_CYCLE = ['table', 'api', 'file', 'codelist'];
    var KEY_CYCLE = ['', 'PK', 'FK', 'UK'];

    function init() {
        State = window.CanvasApp.State;
        Canvas = window.CanvasApp.Canvas;

        canvasEl = document.getElementById('canvas');
        nodeLayer = document.getElementById('node-layer');
        edgePreview = document.getElementById('edge-preview');

        // Entity palette — click adds at viewport centre; drag drops at cursor
        var palette = document.getElementById('entity-palette');
        if (palette) {
            palette.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-add-type]');
                if (!btn) return;
                addNodeOfType(btn.getAttribute('data-add-type'));
            });
            palette.addEventListener('dragstart', onPaletteDragStart);
        }
        canvasEl.addEventListener('dragover', onCanvasDragOver);
        canvasEl.addEventListener('drop', onCanvasDrop);

        // Column drag-and-drop (reorder + move between sets). Only the drag
        // handle initiates a drag; toggle draggable=true on mousedown so
        // contenteditable spans don't accidentally drag.
        nodeLayer.addEventListener('mousedown', onColHandleMouseDown, true);
        nodeLayer.addEventListener('dragstart', onColDragStart);
        nodeLayer.addEventListener('dragover', onColDragOver);
        nodeLayer.addEventListener('dragleave', onColDragLeave);
        nodeLayer.addEventListener('drop', onColDrop);
        nodeLayer.addEventListener('dragend', onColDragEnd);

        // Click delegation for inline-edit affordances
        nodeLayer.addEventListener('click', onNodeLayerClick);
        // Commit text edits on blur
        nodeLayer.addEventListener('blur', onEditableBlur, true);
        // Enter commits / Escape cancels for editable spans
        nodeLayer.addEventListener('keydown', onEditableKeydown);

        // Edge drag from ports — capture so it beats the canvas drag handler
        nodeLayer.addEventListener('pointerdown', onPortPointerDown, true);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);

        // Edge handlers: bind to BOTH layers. Non-selected edges live in
        // #edge-layer (below node-layer); the selected edge moves to
        // #edge-overlay (above node-layer) so its handles + label editor
        // are clickable even when they sit over a node body.
        ['edge-layer', 'edge-overlay'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', onEdgeLayerClick);
            el.addEventListener('pointerdown', onEdgeLayerPointerDown, true);
            el.addEventListener('input', onEdgeLabelInput);
            el.addEventListener('blur', onEdgeLabelBlur, true);
            el.addEventListener('keydown', onEdgeLabelKeydown);
        });

        // Keyboard Delete / Backspace — only when nothing is being edited
        document.addEventListener('keydown', onGlobalKeydown);

        State.on(function (reason) {
            if (reason === 'mode') {
                applyModeClasses();
                Canvas.setEditMode(State.getMode() === 'edit');
                updateActionBar();
            } else if (reason === 'selection' || reason === 'nodes' || reason === 'replace' || reason === 'reset') {
                updateActionBar();
            }
        });

        applyModeClasses();
    }

    function applyModeClasses() {
        document.body.classList.toggle('mode-edit', State.getMode() === 'edit');
        document.body.classList.toggle('mode-view', State.getMode() === 'view');
    }

    // ---- Inline edit (click delegate) ----------------------------------

    function onNodeLayerClick(e) {
        var nodeEl = e.target.closest('.node');
        if (!nodeEl) return;
        var nodeId = nodeEl.getAttribute('data-node-id');

        // Toggle property set — works in BOTH view and edit modes (UI state)
        var toggleEl = e.target.closest('[data-action="toggle-set"]');
        if (toggleEl) {
            // Don't toggle when clicking on the editable text spans inside the header
            if (e.target.closest('[contenteditable="true"]')) return;
            // Don't toggle when clicking the × delete button
            if (e.target.closest('[data-action="delete-set"]')) {} else {
                e.stopPropagation();
                var setName = toggleEl.getAttribute('data-set');
                var setEl = toggleEl.closest('.node-set');
                if (setEl) {
                    Canvas.toggleSet(nodeId, setName);
                    setEl.classList.toggle('is-expanded', Canvas.isSetExpanded(nodeId, setName));
                    // Node height changed — refresh the system frame and the
                    // floating action bar (if it sits above this node)
                    Canvas.renderGroups();
                    repositionActionBar();
                }
                return;
            }
        }

        if (State.getMode() !== 'edit') return;

        // Delete node
        if (e.target.closest('[data-action="delete-node"]')) {
            e.stopPropagation();
            var node = State.getNode(nodeId);
            var nm = node ? (node.label || node.id) : '';
            if (confirm('Knoten "' + nm + '" löschen?')) State.deleteNode(nodeId);
            return;
        }

        // Delete property set (ungroups its columns, doesn't remove them)
        var delSetBtn = e.target.closest('[data-action="delete-set"]');
        if (delSetBtn) {
            e.stopPropagation();
            var setNameDel = delSetBtn.getAttribute('data-set');
            var nDel = State.getNode(nodeId);
            if (!nDel) return;
            var hasCols = (nDel.columns || []).some(function (c) { return c.set === setNameDel; });
            var prompt = hasCols
                ? 'Property Set "' + setNameDel + '" entfernen? Spalten werden entgruppiert.'
                : 'Property Set "' + setNameDel + '" entfernen?';
            if (!confirm(prompt)) return;
            var newSets = (nDel.propertySets || []).filter(function (s) { return s.name !== setNameDel; });
            var newCols = (nDel.columns || []).map(function (c) {
                return c.set === setNameDel ? Object.assign({}, c, { set: '' }) : c;
            });
            State.updateNode(nodeId, { propertySets: newSets, columns: newCols });
            return;
        }

        // Add property set
        if (e.target.closest('[data-action="add-set"]')) {
            e.stopPropagation();
            var nAdd = State.getNode(nodeId);
            if (!nAdd) return;
            var sets = (nAdd.propertySets || []).slice();
            // Generate a unique tech name like "NEW_SET", "NEW_SET_2", ...
            var base = 'NEW_SET';
            var name = base;
            var counter = 2;
            while (sets.some(function (s) { return s.name === name; })) {
                name = base + '_' + counter;
                counter += 1;
            }
            sets.push({ name: name, label: '' });
            State.updateNode(nodeId, { propertySets: sets });
            // Sets are expanded by default — focus the new set's name field
            requestAnimationFrame(function () {
                var fresh = nodeLayer.querySelector('[data-node-id="' + cssEscape(nodeId) + '"]');
                if (!fresh) return;
                var section = fresh.querySelector('.node-set[data-set="' + cssEscape(name) + '"]');
                var nameEl = section && section.querySelector('[data-edit="set-name"]');
                if (nameEl) {
                    nameEl.focus();
                    selectAll(nameEl);
                }
            });
            return;
        }

        // Delete column
        var delColBtn = e.target.closest('[data-action="delete-col"]');
        if (delColBtn) {
            e.stopPropagation();
            var idx = Number(delColBtn.getAttribute('data-col-idx'));
            var n1 = State.getNode(nodeId);
            if (!n1) return;
            var cols = (n1.columns || []).slice();
            cols.splice(idx, 1);
            State.updateNode(nodeId, { columns: cols });
            return;
        }

        // Add column — honours data-set on the button so the new column lands
        // in the right property set (or ungrouped if data-set="")
        var addColBtn = e.target.closest('[data-action="add-col"]');
        if (addColBtn) {
            e.stopPropagation();
            var n2 = State.getNode(nodeId);
            if (!n2) return;
            var targetSet = addColBtn.getAttribute('data-set') || '';
            var cols2 = (n2.columns || []).slice();
            cols2.push({ name: '', type: '', key: '', set: targetSet });
            State.updateNode(nodeId, { columns: cols2 });
            // Focus the new name span after re-render. New cols append to the
            // node.columns array, so the LAST .node-col is the new one.
            requestAnimationFrame(function () {
                var fresh = nodeLayer.querySelector('[data-node-id="' + cssEscape(nodeId) + '"]');
                if (!fresh) return;
                var rows = fresh.querySelectorAll('.node-col');
                var lastRow = rows[rows.length - 1];
                var nameEl = lastRow && lastRow.querySelector('[data-edit="col-name"]');
                if (nameEl) {
                    nameEl.focus();
                    placeCaretAtEnd(nameEl);
                }
            });
            return;
        }

        // Cycle column key
        var keyEl = e.target.closest('[data-edit="key"]');
        if (keyEl) {
            e.stopPropagation();
            var idx2 = Number(keyEl.getAttribute('data-col-idx'));
            var n3 = State.getNode(nodeId);
            if (!n3) return;
            var cols3 = (n3.columns || []).slice();
            var cur = cols3[idx2] && cols3[idx2].key || '';
            var nextKey = KEY_CYCLE[(KEY_CYCLE.indexOf(cur) + 1) % KEY_CYCLE.length];
            cols3[idx2] = Object.assign({}, cols3[idx2], { key: nextKey });
            State.updateNode(nodeId, { columns: cols3 });
            return;
        }

        // Cycle node type
        if (e.target.closest('.node-type-icon')) {
            e.stopPropagation();
            var n4 = State.getNode(nodeId);
            if (!n4) return;
            var cur2 = n4.type || 'table';
            var nextType = TYPE_CYCLE[(TYPE_CYCLE.indexOf(cur2) + 1) % TYPE_CYCLE.length];
            State.updateNode(nodeId, { type: nextType });
            return;
        }
    }

    function onEditableBlur(e) {
        var el = e.target;
        if (!el || !el.matches || !el.matches('[contenteditable="true"][data-edit]')) return;
        var nodeEl = el.closest('.node');
        if (!nodeEl) return;
        var nodeId = nodeEl.getAttribute('data-node-id');
        var kind = el.getAttribute('data-edit');
        var value = (el.textContent || '').trim();

        var node = State.getNode(nodeId);
        if (!node) return;

        if (kind === 'label') {
            if (value !== (node.label || '')) {
                State.updateNode(nodeId, { label: value || node.id });
            }
        } else if (kind === 'system') {
            if (value !== (node.system || '')) {
                State.updateNode(nodeId, { system: value });
            }
        } else if (kind === 'col-name' || kind === 'col-type') {
            var idx = Number(el.getAttribute('data-col-idx'));
            var cols = (node.columns || []).slice();
            if (!cols[idx]) return;
            var field = kind === 'col-name' ? 'name' : 'type';
            if (value !== (cols[idx][field] || '')) {
                cols[idx] = Object.assign({}, cols[idx], (function () { var o = {}; o[field] = value; return o; })());
                State.updateNode(nodeId, { columns: cols });
            }
        } else if (kind === 'set-name' || kind === 'set-label') {
            var oldSetName = el.getAttribute('data-set');
            var sets = (node.propertySets || []).slice();
            var sIdx = -1;
            for (var i = 0; i < sets.length; i++) {
                if (sets[i].name === oldSetName) { sIdx = i; break; }
            }
            if (sIdx === -1) return;

            if (kind === 'set-name') {
                // Tech name normalised to upper-case + safe chars
                var newName = value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                if (!newName) return;                      // empty → revert (no change)
                if (newName === oldSetName) return;
                // Reject duplicate set names
                if (sets.some(function (s) { return s.name === newName; })) {
                    Canvas.renderNodes(); // restore original text
                    return;
                }
                sets[sIdx] = Object.assign({}, sets[sIdx], { name: newName });
                // Carry collapsed/expanded state across the rename
                Canvas.migrateSetState(nodeId, oldSetName, newName);
                // Update any columns that referenced the old name
                var newCols = (node.columns || []).map(function (c) {
                    return c.set === oldSetName ? Object.assign({}, c, { set: newName }) : c;
                });
                State.updateNode(nodeId, { propertySets: sets, columns: newCols });
            } else {
                if (value === (sets[sIdx].label || '')) return;
                sets[sIdx] = Object.assign({}, sets[sIdx], { label: value });
                State.updateNode(nodeId, { propertySets: sets });
            }
        }
    }

    function onEditableKeydown(e) {
        var el = e.target;
        if (!el || !el.matches || !el.matches('[contenteditable="true"]')) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
        } else if (e.key === 'Escape') {
            // Revert to stored value by re-reading state
            e.preventDefault();
            el.blur();
            // Trigger a re-render to restore original text
            Canvas.renderNodes();
            Canvas.renderEdges();
        }
    }

    // ---- Add entity from palette ---------------------------------------

    var TYPE_DEFAULTS = {
        table:    { label: 'neue_tabelle',  columns: [{ name: 'id', type: 'uuid', key: 'PK' }] },
        view:     { label: 'neue_view',     columns: [] },
        api:      { label: '/api/neu',      columns: [] },
        file:     { label: 'neue_datei',    columns: [] },
        codelist: { label: 'neue_werteliste', columns: [
            { name: 'code',        type: 'CHAR(10)', key: 'PK' },
            { name: 'label',       type: 'TEXT',     key: ''   },
            { name: 'description', type: 'TEXT',     key: ''   },
            { name: 'sort_order',  type: 'INT',      key: ''   },
            { name: 'deprecated',  type: 'BOOLEAN',  key: ''   }
        ] }
    };
    var TYPE_LABELS = {
        table: 'Tabelle', view: 'View', api: 'API', file: 'Datei', codelist: 'Werteliste'
    };

    var DRAG_MIME = 'application/x-canvas-type';

    /** Click-to-add: placed near viewport centre with a jitter. */
    function addNodeOfType(type) {
        var rect = canvasEl.getBoundingClientRect();
        var centre = Canvas.clientToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
        var jx = (Math.random() - 0.5) * 80;
        var jy = (Math.random() - 0.5) * 80;
        addNodeAt(type, centre.x - 110 + jx, centre.y - 40 + jy);
    }

    /** Drop-to-add: placed at the canvas position under the drop cursor. */
    function addNodeAt(type, x, y) {
        if (!TYPE_DEFAULTS[type]) type = 'table';
        var defaults = TYPE_DEFAULTS[type];
        var node = State.addNode({
            label: defaults.label,
            type: type,
            x: x,
            y: y,
            columns: defaults.columns.map(function (c) { return Object.assign({}, c); })
        });
        State.setSelected(node.id);
        requestAnimationFrame(function () {
            var fresh = nodeLayer.querySelector('[data-node-id="' + cssEscape(node.id) + '"]');
            var title = fresh && fresh.querySelector('[data-edit="label"]');
            if (title) {
                title.focus();
                selectAll(title);
            }
        });
    }

    function onPaletteDragStart(e) {
        var btn = e.target.closest('[data-add-type]');
        if (!btn) return;
        var type = btn.getAttribute('data-add-type');
        e.dataTransfer.setData(DRAG_MIME, type);
        // Plain-text fallback so the data is visible in inspectors
        e.dataTransfer.setData('text/plain', type);
        e.dataTransfer.effectAllowed = 'copy';
        // Custom drag image: a small pill with the type icon + label
        var ghost = createDragGhost(btn, type);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 12, 12);
        // Remove on the next tick — by then the browser has rasterised it
        setTimeout(function () { ghost.remove(); }, 0);
    }

    function onCanvasDragOver(e) {
        var types = e.dataTransfer && e.dataTransfer.types;
        if (!types) return;
        // dataTransfer.types is a DOMStringList in some browsers; coerce to array
        var hasOurType = false;
        for (var i = 0; i < types.length; i++) {
            if (types[i] === DRAG_MIME) { hasOurType = true; break; }
        }
        if (!hasOurType) return;
        e.preventDefault(); // signal that we accept the drop
        e.dataTransfer.dropEffect = 'copy';
    }

    function onCanvasDrop(e) {
        var type = e.dataTransfer.getData(DRAG_MIME);
        if (!type) return;
        e.preventDefault();
        if (State.getMode() !== 'edit') return; // safety — palette is edit-only anyway
        // Don't accept drops on other floating toolbars (zoom etc.)
        if (e.target && e.target.closest && e.target.closest('.ft')) return;
        var pos = Canvas.clientToCanvas(e.clientX, e.clientY);
        addNodeAt(type, pos.x - 110, pos.y - 20);
    }

    function createDragGhost(btn, type) {
        var iconSvg = btn.querySelector('svg');
        var label = TYPE_LABELS[type] || type;
        var ghost = document.createElement('div');
        ghost.className = 'palette-ghost';
        ghost.innerHTML = (iconSvg ? iconSvg.outerHTML : '') + '<span>+ ' + label + '</span>';
        // Position offscreen so it gets rendered for setDragImage but isn't visible
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.left = '-1000px';
        return ghost;
    }

    // ---- Edge drawing --------------------------------------------------

    function onPortPointerDown(e) {
        var port = e.target.closest('.node-port');
        if (!port) return;
        if (State.getMode() !== 'edit') return;

        e.stopPropagation();
        e.preventDefault();
        isDrawingEdge = true;
        edgeFromNodeId = port.getAttribute('data-node-id');
        canvasEl.classList.add('is-edge-drawing');

        var ns = 'http://www.w3.org/2000/svg';
        edgePreviewPath = document.createElementNS(ns, 'path');
        edgePreview.appendChild(edgePreviewPath);
        updateEdgePreviewFromPort(e.clientX, e.clientY);
    }

    function updateEdgePreviewFromPort(clientX, clientY) {
        var fromNode = State.getNode(edgeFromNodeId);
        if (!fromNode) return;
        var fromRect = Canvas.getNodeRect(fromNode);
        var srcX = fromRect.x + fromRect.w;
        var srcY = fromRect.y + Math.min(28, fromRect.h / 2);
        drawPreviewBezier(srcX, srcY, clientX, clientY, edgePreviewPath);
    }

    function drawPreviewBezier(srcCanvasX, srcCanvasY, targetClientX, targetClientY, pathEl) {
        var t = Canvas.getTransform();
        var canvasRect = canvasEl.getBoundingClientRect();
        var sx = srcCanvasX * t.scale + t.translateX;
        var sy = srcCanvasY * t.scale + t.translateY;
        var ex = targetClientX - canvasRect.left;
        var ey = targetClientY - canvasRect.top;
        var dx = ex - sx;
        var c1x = sx + dx * 0.5, c1y = sy;
        var c2x = ex - dx * 0.5, c2y = ey;
        pathEl.setAttribute('d',
            'M ' + sx + ' ' + sy + ' C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + ex + ' ' + ey
        );
    }

    // ---- Edge: select / rename / retarget / delete ---------------------

    function onEdgeLayerClick(e) {
        // × inside the input — clears text only, keeps the relation.
        // Empty value commits to state on the next blur via onEdgeLabelBlur.
        var clearBtn = e.target.closest('[data-action="clear-label"]');
        if (clearBtn) {
            e.stopPropagation();
            e.preventDefault();
            var input = clearBtn.parentElement && clearBtn.parentElement.querySelector('[data-edge-label-input]');
            if (input) {
                input.value = '';
                input.focus();
            }
            return;
        }

        // Trash button — deletes the relation
        var delBtn = e.target.closest('[data-action="delete-edge"]');
        if (delBtn) {
            e.stopPropagation();
            var selId = State.getSelectedEdgeId();
            if (selId) State.deleteEdge(selId);
            return;
        }

        // Click on an edge group = select. Skip if click is on the foreignObject
        // contents (the user is interacting with the label editor).
        if (e.target.closest('foreignObject')) return;

        var group = e.target.closest('.edge-group');
        if (!group) return;
        var id = group.getAttribute('data-edge-id');
        if (!id) return;
        if (State.getSelectedEdgeId() !== id) {
            State.setSelectedEdge(id);
        }
    }

    function onEdgeLayerPointerDown(e) {
        // Endpoint handle drag → retarget the edge's `from` or `to`
        var handle = e.target.closest('.edge-handle');
        if (!handle) return;
        if (State.getMode() !== 'edit') return;

        e.stopPropagation();
        e.preventDefault();
        isRetargeting = true;
        retargetEdgeId = handle.getAttribute('data-edge-id');
        retargetEnd = handle.getAttribute('data-end');
        canvasEl.classList.add('is-edge-drawing');

        var ns = 'http://www.w3.org/2000/svg';
        retargetPreviewPath = document.createElementNS(ns, 'path');
        edgePreview.appendChild(retargetPreviewPath);
        updateRetargetPreview(e.clientX, e.clientY);
    }

    function updateRetargetPreview(clientX, clientY) {
        var edge = State.getEdge(retargetEdgeId);
        if (!edge) return;
        // Anchor on the OTHER end (the one that's NOT being dragged)
        var fixedNodeId = retargetEnd === 'from' ? edge.to : edge.from;
        var fixedNode = State.getNode(fixedNodeId);
        if (!fixedNode) return;
        var rect = Canvas.getNodeRect(fixedNode);
        // Use centre of node as anchor — good enough for a preview line
        var srcX = rect.x + rect.w / 2;
        var srcY = rect.y + Math.min(28, rect.h / 2);
        drawPreviewBezier(srcX, srcY, clientX, clientY, retargetPreviewPath);
    }

    function onPointerMove(e) {
        if (isDrawingEdge) updateEdgePreviewFromPort(e.clientX, e.clientY);
        if (isRetargeting) updateRetargetPreview(e.clientX, e.clientY);
    }

    function onPointerUp(e) {
        if (isDrawingEdge) finishDrawingEdge(e);
        if (isRetargeting) finishRetargeting(e);
    }

    function finishDrawingEdge(e) {
        isDrawingEdge = false;
        canvasEl.classList.remove('is-edge-drawing');
        if (edgePreviewPath) { edgePreviewPath.remove(); edgePreviewPath = null; }

        var targetNodeEl = nodeUnderPoint(e.clientX, e.clientY);
        if (!targetNodeEl) { edgeFromNodeId = null; return; }
        var toId = targetNodeEl.getAttribute('data-node-id');
        if (!toId || toId === edgeFromNodeId) { edgeFromNodeId = null; return; }

        var newEdge = State.addEdge({ from: edgeFromNodeId, to: toId, label: '' });
        edgeFromNodeId = null;
        if (newEdge) State.setSelectedEdge(newEdge.id); // open label editor immediately
    }

    function finishRetargeting(e) {
        var edgeId = retargetEdgeId;
        var end = retargetEnd;
        isRetargeting = false;
        canvasEl.classList.remove('is-edge-drawing');
        if (retargetPreviewPath) { retargetPreviewPath.remove(); retargetPreviewPath = null; }
        retargetEdgeId = null;
        retargetEnd = null;

        var targetNodeEl = nodeUnderPoint(e.clientX, e.clientY);
        if (!targetNodeEl) return;
        var newId = targetNodeEl.getAttribute('data-node-id');
        if (!newId) return;

        var edge = State.getEdge(edgeId);
        if (!edge) return;
        // Don't allow self-loops or no-op
        var otherEnd = end === 'from' ? edge.to : edge.from;
        if (newId === otherEnd) return;
        if ((end === 'from' && edge.from === newId) || (end === 'to' && edge.to === newId)) return;

        var patch = {};
        patch[end] = newId;
        State.updateEdge(edgeId, patch);
    }

    function nodeUnderPoint(x, y) {
        var el = document.elementFromPoint(x, y);
        return el ? el.closest('.node') : null;
    }

    // ---- Edge label inline edit ----------------------------------------

    function onEdgeLabelInput(e) {
        // Live updates can be debounced if needed; for now we commit on blur
        // so paths don't reflow on every keystroke.
    }

    function onEdgeLabelBlur(e) {
        var input = e.target;
        if (!input || !input.matches || !input.matches('[data-edge-label-input]')) return;
        var group = input.closest('.edge-group');
        if (!group) return;
        var id = group.getAttribute('data-edge-id');
        var edge = State.getEdge(id);
        if (!edge) return;
        var value = (input.value || '').trim();
        if (value !== (edge.label || '')) {
            State.updateEdge(id, { label: value });
        }
    }

    function onEdgeLabelKeydown(e) {
        var input = e.target;
        if (!input || !input.matches || !input.matches('[data-edge-label-input]')) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            // Revert by re-rendering from state
            e.preventDefault();
            var group = input.closest('.edge-group');
            var id = group && group.getAttribute('data-edge-id');
            var edge = id && State.getEdge(id);
            input.value = (edge && edge.label) || '';
            input.blur();
        }
    }

    // ---- Keyboard delete ----------------------------------------------

    function onGlobalKeydown(e) {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        if (isInEditableElement()) return;
        if (State.getMode() !== 'edit') return;

        var edgeId = State.getSelectedEdgeId();
        if (edgeId) {
            e.preventDefault();
            State.deleteEdge(edgeId);
            return;
        }
        var nodeId = State.getSelectedId();
        if (nodeId) {
            e.preventDefault();
            var n = State.getNode(nodeId);
            if (confirm('Knoten "' + (n ? (n.label || n.id) : nodeId) + '" löschen?')) {
                State.deleteNode(nodeId);
            }
        }
    }

    function isInEditableElement() {
        var el = document.activeElement;
        if (!el) return false;
        var tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (el.isContentEditable) return true;
        return false;
    }

    // ---- Floating action bar (selected node, edit mode) ----------------

    function updateActionBar() {
        var selId = State.getSelectedId();
        var inEdit = State.getMode() === 'edit';
        if (!selId || !inEdit) {
            if (actionBarEl) { actionBarEl.remove(); actionBarEl = null; }
            return;
        }
        if (!actionBarEl) {
            actionBarEl = createActionBar();
            canvasEl.appendChild(actionBarEl);
        }
        repositionActionBar();
    }

    function createActionBar() {
        var el = document.createElement('div');
        el.className = 'node-action-bar';
        el.innerHTML =
            '<button type="button" data-action="delete-node" title="Knoten löschen">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>';
        // Don't let bar interactions trigger canvas pan or node drag
        el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        el.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            var selId = State.getSelectedId();
            if (!selId) return;
            if (action === 'delete-node') {
                var node = State.getNode(selId);
                if (confirm('Knoten "' + (node ? (node.label || node.id) : selId) + '" löschen?')) {
                    State.deleteNode(selId);
                }
            }
        });
        return el;
    }

    function repositionActionBar() {
        if (!actionBarEl) return;
        var selId = State.getSelectedId();
        if (!selId) return;
        var nodeEl = Canvas.getNodeEl(selId);
        if (!nodeEl) {
            actionBarEl.style.display = 'none';
            return;
        }
        actionBarEl.style.display = '';
        // Make sure dimensions are known before measuring
        var nodeRect = nodeEl.getBoundingClientRect();
        var canvasRect = canvasEl.getBoundingClientRect();
        var barH = actionBarEl.offsetHeight || 32;
        var barW = actionBarEl.offsetWidth  || 40;
        var top  = nodeRect.top  - canvasRect.top  - barH - 8;
        var left = nodeRect.left - canvasRect.left + (nodeRect.width / 2) - (barW / 2);
        // Clamp to canvas viewport with a small margin
        if (top  < 4) top  = 4;
        if (left < 4) left = 4;
        if (left + barW > canvasRect.width  - 4) left = canvasRect.width  - 4 - barW;
        actionBarEl.style.top  = top  + 'px';
        actionBarEl.style.left = left + 'px';
    }

    // ---- Column drag-and-drop ------------------------------------------

    var COL_DRAG_MIME = 'application/x-canvas-col';
    var dragSourceRow = null;

    function onColHandleMouseDown(e) {
        var handle = e.target.closest('.node-col-handle');
        if (!handle) return;
        if (State.getMode() !== 'edit') return;
        var row = handle.closest('.node-col');
        if (!row) return;
        // Toggle draggable so the row becomes draggable for the next dragstart.
        // We clear it on dragend.
        row.setAttribute('draggable', 'true');
    }

    function onColDragStart(e) {
        var row = e.target.closest('.node-col[draggable="true"]');
        if (!row) return;
        var nodeEl = row.closest('.node');
        if (!nodeEl) return;
        var nodeId = nodeEl.getAttribute('data-node-id');
        var colIdx = Number(row.getAttribute('data-col-idx'));
        e.dataTransfer.setData(COL_DRAG_MIME, JSON.stringify({ nodeId: nodeId, colIdx: colIdx }));
        e.dataTransfer.setData('text/plain', String(colIdx));
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('is-dragging');
        dragSourceRow = row;
    }

    function dataTransferHasColType(dt) {
        if (!dt || !dt.types) return false;
        for (var i = 0; i < dt.types.length; i++) {
            if (dt.types[i] === COL_DRAG_MIME) return true;
        }
        return false;
    }

    function onColDragOver(e) {
        if (!dataTransferHasColType(e.dataTransfer)) return;
        var row = e.target.closest('.node-col');
        var setEl = e.target.closest('.node-set');
        var ul = e.target.closest('.node-cols');
        // Only accept drops within the same node (the source row's node).
        if (dragSourceRow) {
            var nodeEl = e.target.closest('.node');
            if (!nodeEl || nodeEl !== dragSourceRow.closest('.node')) {
                clearDropIndicators();
                return;
            }
        }
        clearDropIndicators();
        if (row && row !== dragSourceRow) {
            // Decide before/after based on cursor Y vs row midpoint
            var rect = row.getBoundingClientRect();
            var after = (e.clientY - rect.top) > rect.height / 2;
            row.classList.add('is-drop-target');
            if (after) row.classList.add('drop-after');
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        } else if (setEl) {
            // Drop on set body / header → append to that set
            setEl.classList.add('is-drop-target');
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        } else if (ul) {
            // Drop on the ungrouped <ul> at the top of a node
            ul.classList.add('is-drop-target');
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
    }

    function onColDragLeave(e) {
        // Browsers fire dragleave when crossing into a child — clear only when
        // the cursor actually leaves the relevant target.
        var related = e.relatedTarget;
        if (related && (related.closest('.node-col') || related.closest('.node-set') || related.closest('.node-cols'))) {
            return;
        }
        clearDropIndicators();
    }

    function onColDrop(e) {
        var raw = e.dataTransfer.getData(COL_DRAG_MIME);
        if (!raw) return;
        var data;
        try { data = JSON.parse(raw); } catch (err) { return; }
        e.preventDefault();
        clearDropIndicators();

        var node = State.getNode(data.nodeId);
        if (!node) return;
        var nodeEl = e.target.closest('.node');
        if (!nodeEl || nodeEl.getAttribute('data-node-id') !== data.nodeId) return;

        var sourceCol = (node.columns || [])[data.colIdx];
        if (!sourceCol) return;

        var newCols = (node.columns || []).slice();
        var sourceIdx = data.colIdx;
        var targetRow = e.target.closest('.node-col');
        var targetSetEl = e.target.closest('.node-set');
        var targetUl = e.target.closest('.node-cols');

        if (targetRow && targetRow !== dragSourceRow) {
            var targetIdx = Number(targetRow.getAttribute('data-col-idx'));
            var rect = targetRow.getBoundingClientRect();
            var after = (e.clientY - rect.top) > rect.height / 2;
            var targetCol = newCols[targetIdx];
            var targetSetName = (targetCol && targetCol.set) || '';
            // Pull source out
            newCols.splice(sourceIdx, 1);
            // Adjust target index if source was before target
            if (sourceIdx < targetIdx) targetIdx -= 1;
            var insertAt = after ? targetIdx + 1 : targetIdx;
            newCols.splice(insertAt, 0, Object.assign({}, sourceCol, { set: targetSetName }));
        } else if (targetSetEl) {
            var setName = targetSetEl.getAttribute('data-set') || '';
            newCols.splice(sourceIdx, 1);
            // Append at the END of the target set's columns (or end of array)
            var lastIdxInSet = -1;
            for (var i = 0; i < newCols.length; i++) {
                if ((newCols[i].set || '') === setName) lastIdxInSet = i;
            }
            var insertAt2 = lastIdxInSet === -1 ? newCols.length : lastIdxInSet + 1;
            newCols.splice(insertAt2, 0, Object.assign({}, sourceCol, { set: setName }));
        } else if (targetUl && !targetSetEl) {
            // Drop on ungrouped ul → set.set = ''
            newCols.splice(sourceIdx, 1);
            // Append at end of ungrouped section (last col with set === '')
            var lastUngrouped = -1;
            for (var j = 0; j < newCols.length; j++) {
                if (!newCols[j].set) lastUngrouped = j;
            }
            var insertAt3 = lastUngrouped === -1 ? 0 : lastUngrouped + 1;
            newCols.splice(insertAt3, 0, Object.assign({}, sourceCol, { set: '' }));
        } else {
            return;
        }

        State.updateNode(data.nodeId, { columns: newCols });
    }

    function onColDragEnd() {
        clearDropIndicators();
        if (dragSourceRow) {
            dragSourceRow.classList.remove('is-dragging');
            dragSourceRow.removeAttribute('draggable');
            dragSourceRow = null;
        }
        // Some rows may have draggable left over if dragstart never fired
        nodeLayer.querySelectorAll('.node-col[draggable="true"]').forEach(function (r) {
            r.removeAttribute('draggable');
        });
    }

    function clearDropIndicators() {
        nodeLayer.querySelectorAll('.is-drop-target').forEach(function (el) {
            el.classList.remove('is-drop-target', 'drop-after');
        });
    }

    // ---- Util ----------------------------------------------------------

    function placeCaretAtEnd(el) {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function selectAll(el) {
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function cssEscape(s) {
        if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
        return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    return {
        init: init,
        repositionActionBar: repositionActionBar
    };
})();
