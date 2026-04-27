/**
 * Table view — entity-typed tabs over the same canvas state.
 *
 * Tabs (left of the toolbar):
 *   Knoten         · all nodes        cols: Name | Typ | System | Schema | Sets | Attr | Tags | ×
 *   Beziehungen    · all edges        cols: Quelle | Ziel | Label | ×
 *   Property Sets  · all sets         cols: Knoten | Set | Label | Attr | ×
 *   Attribute      · all columns      cols: Knoten | Set | Name | Typ | Schlüssel | ×
 *
 * Click on a row selects the related node so the side panel reflects context.
 * Edit-mode adds inline editing on the Knoten tab and a delete (×) action
 * appropriate to the row.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Table = (function () {

    var State = null;

    var headEl = null;
    var bodyEl = null;
    var countEl = null;
    var systemSel = null;
    var typeSel = null;
    var textInput = null;
    var tabsEl = null;
    var filtersEl = null;

    var activeTab = 'nodes';

    var TYPE_ICONS = {
        table: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="5.5" y1="5.5" x2="5.5" y2="14.5"/></svg>',
        view:  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>',
        api:   '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 1.5L2 9.5h6l-1 5L13.5 6.5h-6l1-5z"/></svg>',
        file:  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H3.5a1 1 0 0 0-1 1V13.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L9 1.5z"/><polyline points="9 1.5 9 6 13.5 6"/></svg>'
    };

    var TYPE_OPTS = [
        { v: 'table', l: 'Tabelle' },
        { v: 'view',  l: 'View' },
        { v: 'api',   l: 'API' },
        { v: 'file',  l: 'Datei' }
    ];

    function init() {
        State = window.CanvasApp.State;
        headEl = document.getElementById('table-head');
        bodyEl = document.getElementById('table-body');
        countEl = document.getElementById('table-count');
        systemSel = document.getElementById('filter-system');
        typeSel = document.getElementById('filter-type');
        textInput = document.getElementById('filter-text');
        tabsEl = document.getElementById('table-tabs');
        filtersEl = document.getElementById('table-filters');

        systemSel.addEventListener('change', render);
        typeSel.addEventListener('change', render);
        textInput.addEventListener('input', render);

        tabsEl.addEventListener('click', onTabClick);
        bodyEl.addEventListener('click', onRowClick);
        bodyEl.addEventListener('blur', onCellBlur, true);
        bodyEl.addEventListener('change', onSelectChange);
        bodyEl.addEventListener('keydown', onCellKeydown);

        State.on(function (reason) {
            if (reason === 'nodes' || reason === 'edges' || reason === 'replace' || reason === 'reset') {
                refreshFilters();
                render();
            } else if (reason === 'mode') {
                render();
            }
        });

        // Initial tab UI (placeholder text, filter visibility)
        applyTabUI();
    }

    function refreshFilters() {
        var nodes = State.getNodes();
        var systems = unique(nodes.map(function (n) { return n.system; }).filter(Boolean));
        var types = unique(nodes.map(function (n) { return n.type; }).filter(Boolean));

        systemSel.innerHTML = '<option value="">Alle</option>' +
            systems.map(function (s) { return '<option value="' + escapeAttr(s) + '">' + escapeHtml(s) + '</option>'; }).join('');
        typeSel.innerHTML = '<option value="">Alle</option>' +
            types.map(function (t) { return '<option value="' + escapeAttr(t) + '">' + typeLabel(t) + '</option>'; }).join('');
    }

    function onTabClick(e) {
        var btn = e.target.closest('[data-tab]');
        if (!btn) return;
        var tab = btn.getAttribute('data-tab');
        if (tab === activeTab) return;
        activeTab = tab;
        // Reset text filter so it doesn't unintentionally hide rows from the new tab
        textInput.value = '';
        applyTabUI();
        render();
    }

    function applyTabUI() {
        Array.prototype.forEach.call(tabsEl.querySelectorAll('.seg-btn'), function (b) {
            var active = b.getAttribute('data-tab') === activeTab;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        // Filters block is only relevant for the Knoten tab
        var show = filtersEl.getAttribute('data-tab-only') === activeTab;
        filtersEl.style.display = show ? '' : 'none';
        // Adjust placeholder to hint what's filterable now
        var placeholders = {
            nodes: 'Knoten filtern…',
            edges: 'Beziehungen filtern…',
            sets:  'Property Sets filtern…',
            cols:  'Attribute filtern…'
        };
        textInput.setAttribute('placeholder', placeholders[activeTab] || 'Filtern…');
    }

    function render() {
        if (activeTab === 'nodes') return renderNodes();
        if (activeTab === 'edges') return renderEdges();
        if (activeTab === 'sets')  return renderSets();
        if (activeTab === 'cols')  return renderCols();
    }

    // ---- Tab: Nodes ----------------------------------------------------

    function renderNodes() {
        var sysFilter = systemSel.value;
        var typeFilter = typeSel.value;
        var q = textInput.value.trim().toLowerCase();
        var isEdit = State.getMode() === 'edit';

        var rows = State.getNodes().filter(function (n) {
            if (sysFilter && n.system !== sysFilter) return false;
            if (typeFilter && n.type !== typeFilter) return false;
            if (!q) return true;
            var hay = [
                n.label, n.id, n.system, n.schema,
                (n.tags || []).join(' '),
                (n.columns || []).map(function (c) { return c.name; }).join(' ')
            ].join(' ').toLowerCase();
            return hay.indexOf(q) !== -1;
        });

        headEl.innerHTML = '<tr>' +
            '<th>Name</th><th>Typ</th><th>System</th><th>Schema</th><th>Sets</th><th>Attribute</th><th>Tags</th><th></th>' +
        '</tr>';

        var total = State.getNodes().length;
        countEl.textContent = countLabel(rows.length, total, 'Knoten');

        bodyEl.innerHTML = rows.map(function (n) { return nodeRowHtml(n, isEdit); }).join('') ||
            emptyRowHtml(8, q ? 'Keine Treffer' : 'Keine Knoten');
    }

    function nodeRowHtml(n, isEdit) {
        var icon = TYPE_ICONS[n.type] || TYPE_ICONS.table;
        var ce = isEdit ? 'true' : 'false';
        var typeOptsHtml = TYPE_OPTS.map(function (o) {
            return '<option value="' + o.v + '"' + (o.v === n.type ? ' selected' : '') + '>' + o.l + '</option>';
        }).join('');
        var setCount = (n.propertySets || []).length;
        var colCount = (n.columns || []).length;
        var tags = (n.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('');
        return '<tr data-node-id="' + escapeAttr(n.id) + '" data-kind="node">' +
                '<td><span class="cell-name"><span class="cell-icon" data-type="' + escapeAttr(n.type) + '">' + icon + '</span>' +
                    '<span data-edit="label" contenteditable="' + ce + '" spellcheck="false">' + escapeHtml(n.label || n.id) + '</span></span></td>' +
                '<td><select class="cell-select" data-edit="type">' + typeOptsHtml + '</select></td>' +
                '<td><span data-edit="system" contenteditable="' + ce + '" spellcheck="false">' + escapeHtml(n.system || '') + '</span></td>' +
                '<td><span data-edit="schema" contenteditable="' + ce + '" spellcheck="false">' + escapeHtml(n.schema || '') + '</span></td>' +
                '<td>' + (setCount || '–') + '</td>' +
                '<td>' + (colCount || '–') + '</td>' +
                '<td>' +
                    (isEdit
                        ? '<span data-edit="tags" contenteditable="true" spellcheck="false" data-placeholder="komma,getrennt">' + escapeHtml((n.tags || []).join(', ')) + '</span>'
                        : (tags || dash())
                    ) +
                '</td>' +
                '<td>' + delBtn('Knoten') + '</td>' +
            '</tr>';
    }

    // ---- Tab: Edges ----------------------------------------------------

    function renderEdges() {
        var q = textInput.value.trim().toLowerCase();
        var nodes = State.getNodes();
        var byId = {};
        nodes.forEach(function (n) { byId[n.id] = n; });

        var edges = State.getEdges().filter(function (e) {
            if (!q) return true;
            var fromLabel = (byId[e.from] && byId[e.from].label) || e.from;
            var toLabel = (byId[e.to] && byId[e.to].label) || e.to;
            return [e.label, fromLabel, toLabel, e.from, e.to].join(' ').toLowerCase().indexOf(q) !== -1;
        });

        headEl.innerHTML = '<tr><th>Quelle</th><th>Ziel</th><th>Beziehung</th><th></th></tr>';
        countEl.textContent = countLabel(edges.length, State.getEdges().length, 'Beziehungen');

        bodyEl.innerHTML = edges.map(function (e) { return edgeRowHtml(e, byId); }).join('') ||
            emptyRowHtml(4, q ? 'Keine Treffer' : 'Keine Beziehungen');
    }

    function edgeRowHtml(e, byId) {
        var fromNode = byId[e.from];
        var toNode = byId[e.to];
        var fromLabel = fromNode ? (fromNode.label || fromNode.id) : e.from;
        var toLabel = toNode ? (toNode.label || toNode.id) : e.to;
        return '<tr data-edge-id="' + escapeAttr(e.id) + '" data-kind="edge" data-from="' + escapeAttr(e.from) + '">' +
                '<td><span class="cell-name">' + escapeHtml(fromLabel) + '</span></td>' +
                '<td><span class="cell-name">→ ' + escapeHtml(toLabel) + '</span></td>' +
                '<td>' + (e.label ? escapeHtml(e.label) : dash()) + '</td>' +
                '<td>' + delBtn('Beziehung') + '</td>' +
            '</tr>';
    }

    // ---- Tab: Property Sets --------------------------------------------

    function renderSets() {
        var q = textInput.value.trim().toLowerCase();
        var rows = [];
        State.getNodes().forEach(function (n) {
            (n.propertySets || []).forEach(function (s) {
                var attrCount = (n.columns || []).filter(function (c) { return c.set === s.name; }).length;
                rows.push({ node: n, set: s, count: attrCount });
            });
        });
        var total = rows.length;
        if (q) {
            rows = rows.filter(function (r) {
                return [r.set.name, r.set.label, r.node.label, r.node.id].join(' ').toLowerCase().indexOf(q) !== -1;
            });
        }

        headEl.innerHTML = '<tr><th>Knoten</th><th>Set</th><th>Label</th><th>Attribute</th><th></th></tr>';
        countEl.textContent = countLabel(rows.length, total, 'Property Sets');

        bodyEl.innerHTML = rows.map(setRowHtml).join('') ||
            emptyRowHtml(5, q ? 'Keine Treffer' : 'Keine Property Sets');
    }

    function setRowHtml(r) {
        var icon = TYPE_ICONS[r.node.type] || TYPE_ICONS.table;
        return '<tr data-node-id="' + escapeAttr(r.node.id) + '" data-set="' + escapeAttr(r.set.name) + '" data-kind="set">' +
                '<td><span class="cell-name"><span class="cell-icon" data-type="' + escapeAttr(r.node.type) + '">' + icon + '</span>' + escapeHtml(r.node.label || r.node.id) + '</span></td>' +
                '<td><code class="cell-mono">' + escapeHtml(r.set.name) + '</code></td>' +
                '<td>' + (r.set.label ? escapeHtml(r.set.label) : dash()) + '</td>' +
                '<td>' + r.count + '</td>' +
                '<td>' + delBtn('Property Set') + '</td>' +
            '</tr>';
    }

    // ---- Tab: Columns / Attributes -------------------------------------

    function renderCols() {
        var q = textInput.value.trim().toLowerCase();
        var rows = [];
        State.getNodes().forEach(function (n) {
            (n.columns || []).forEach(function (c, idx) {
                rows.push({ node: n, col: c, idx: idx });
            });
        });
        var total = rows.length;
        if (q) {
            rows = rows.filter(function (r) {
                return [r.col.name, r.col.type, r.col.set, r.node.label, r.node.id].join(' ').toLowerCase().indexOf(q) !== -1;
            });
        }

        headEl.innerHTML = '<tr><th>Knoten</th><th>Set</th><th>Name</th><th>Typ</th><th>Schlüssel</th><th></th></tr>';
        countEl.textContent = countLabel(rows.length, total, 'Attribute');

        bodyEl.innerHTML = rows.map(colRowHtml).join('') ||
            emptyRowHtml(6, q ? 'Keine Treffer' : 'Keine Attribute');
    }

    function colRowHtml(r) {
        var icon = TYPE_ICONS[r.node.type] || TYPE_ICONS.table;
        var keyClass = r.col.key === 'PK' ? 'pk' : r.col.key === 'FK' ? 'fk' : r.col.key === 'UK' ? 'uk' : '';
        var keyLabel = r.col.key || '–';
        return '<tr data-node-id="' + escapeAttr(r.node.id) + '" data-col-idx="' + r.idx + '" data-kind="col">' +
                '<td><span class="cell-name"><span class="cell-icon" data-type="' + escapeAttr(r.node.type) + '">' + icon + '</span>' + escapeHtml(r.node.label || r.node.id) + '</span></td>' +
                '<td>' + (r.col.set ? '<code class="cell-mono">' + escapeHtml(r.col.set) + '</code>' : dash()) + '</td>' +
                '<td><code class="cell-mono">' + escapeHtml(r.col.name) + '</code></td>' +
                '<td><span style="color:var(--color-text-secondary)">' + escapeHtml(r.col.type || '') + '</span></td>' +
                '<td>' + (r.col.key ? '<span class="info-key-badge ' + keyClass + '">' + escapeHtml(keyLabel) + '</span>' : dash()) + '</td>' +
                '<td>' + delBtn('Attribut') + '</td>' +
            '</tr>';
    }

    // ---- Row click + delete + inline edit ------------------------------

    function onRowClick(e) {
        var row = e.target.closest('tr');
        if (!row) return;
        var kind = row.getAttribute('data-kind');

        // Delete (edit mode only) — kind-specific
        var delEl = e.target.closest('[data-action="delete"]');
        if (delEl && State.getMode() === 'edit') {
            e.stopPropagation();
            return onRowDelete(row, kind);
        }

        // In edit mode: don't intercept clicks on inline-edit controls
        if (State.getMode() === 'edit') {
            if (e.target.closest('[contenteditable="true"], select, button')) return;
        }

        // Selection — pick the related node
        if (kind === 'edge') {
            // Selecting the edge's source node so the panel shows the
            // "outgoing" entry for this edge.
            var fromId = row.getAttribute('data-from');
            if (fromId) State.setSelected(fromId);
            return;
        }
        var nodeId = row.getAttribute('data-node-id');
        if (nodeId) State.setSelected(nodeId);
    }

    function onRowDelete(row, kind) {
        var nodeId = row.getAttribute('data-node-id');
        if (kind === 'node') {
            var n = nodeId ? State.getNode(nodeId) : null;
            if (confirm('Knoten "' + (n ? (n.label || n.id) : nodeId) + '" löschen?')) {
                State.deleteNode(nodeId);
            }
            return;
        }
        if (kind === 'edge') {
            var edgeId = row.getAttribute('data-edge-id');
            if (edgeId) State.deleteEdge(edgeId);
            return;
        }
        if (kind === 'set') {
            var setName = row.getAttribute('data-set');
            var nset = State.getNode(nodeId);
            if (!nset) return;
            if (!confirm('Property Set "' + setName + '" entfernen? Spalten werden entgruppiert.')) return;
            var newSets = (nset.propertySets || []).filter(function (s) { return s.name !== setName; });
            var newCols = (nset.columns || []).map(function (c) {
                return c.set === setName ? Object.assign({}, c, { set: '' }) : c;
            });
            State.updateNode(nodeId, { propertySets: newSets, columns: newCols });
            return;
        }
        if (kind === 'col') {
            var idx = Number(row.getAttribute('data-col-idx'));
            var ncol = State.getNode(nodeId);
            if (!ncol) return;
            var cols = (ncol.columns || []).slice();
            if (Number.isNaN(idx) || !cols[idx]) return;
            cols.splice(idx, 1);
            State.updateNode(nodeId, { columns: cols });
            return;
        }
    }

    function onCellBlur(e) {
        if (activeTab !== 'nodes') return;
        var el = e.target;
        if (!el || !el.matches || !el.matches('[contenteditable="true"][data-edit]')) return;
        var row = el.closest('tr[data-node-id]');
        if (!row) return;
        var id = row.getAttribute('data-node-id');
        var node = State.getNode(id);
        if (!node) return;

        var kind = el.getAttribute('data-edit');
        var value = (el.textContent || '').trim();

        if (kind === 'tags') {
            var tags = value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            if (tags.join('|') !== (node.tags || []).join('|')) State.updateNode(id, { tags: tags });
            return;
        }
        if (['label', 'system', 'schema'].indexOf(kind) === -1) return;
        if (value === (node[kind] || '')) return;
        var patch = {};
        patch[kind] = (kind === 'label') ? (value || node.id) : value;
        State.updateNode(id, patch);
    }

    function onSelectChange(e) {
        if (activeTab !== 'nodes') return;
        var sel = e.target;
        if (!sel || !sel.matches || !sel.matches('select[data-edit="type"]')) return;
        var row = sel.closest('tr[data-node-id]');
        if (!row) return;
        var id = row.getAttribute('data-node-id');
        State.updateNode(id, { type: sel.value });
    }

    function onCellKeydown(e) {
        var el = e.target;
        if (!el || !el.matches || !el.matches('[contenteditable="true"]')) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            el.blur();
            render();
        }
    }

    // ---- Helpers -------------------------------------------------------

    function delBtn(what) {
        return '<button class="row-del-btn" data-action="delete" title="' + escapeAttr(what) + ' löschen">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>';
    }

    function emptyRowHtml(cols, msg) {
        return '<tr><td colspan="' + cols + '" style="padding:24px;text-align:center;color:var(--color-text-secondary)">' + escapeHtml(msg) + '</td></tr>';
    }

    function dash() { return '<span style="color:var(--color-text-placeholder)">–</span>'; }

    function countLabel(filtered, total, noun) {
        return filtered === total
            ? filtered + ' ' + noun
            : filtered + ' von ' + total + ' ' + noun;
    }

    function unique(arr) {
        var seen = {}, out = [];
        arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
        return out.sort();
    }

    function typeLabel(t) {
        return ({ table: 'Tabelle', view: 'View', api: 'API', file: 'Datei' }[t] || t || '–');
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttr(s) { return escapeHtml(s); }

    return {
        init: init,
        render: render,
        refreshFilters: refreshFilters
    };
})();
