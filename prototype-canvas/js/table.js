/**
 * Table view — entity-typed tabs over the same canvas state.
 *
 * Seven tabs:
 *   Systeme        · derived from unique node.system values
 *   Tabellen       · nodes where type === 'table' || 'view'
 *   APIs           · nodes where type === 'api'
 *   Dateien        · nodes where type === 'file'
 *   Wertelisten    · nodes where type === 'codelist'
 *   Attribute      · all columns across nodes (filter by `set` for set-level analysis)
 *   Beziehungen    · all edges
 *
 * Click a row to select the related node (or system / edge); the side
 * panel reflects context. Edit-mode adds inline editing on the entity
 * tabs and a delete (×) action appropriate to the row.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Table = (function () {

    var State = null;

    var headEl = null;
    var bodyEl = null;
    var countEl = null;
    var textInput = null;
    var tabsEl = null;

    var activeTab = 'systems';

    var TYPE_ICONS = {
        table: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="5.5" y1="5.5" x2="5.5" y2="14.5"/></svg>',
        view:  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>',
        api:   '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 1.5L2 9.5h6l-1 5L13.5 6.5h-6l1-5z"/></svg>',
        file:  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H3.5a1 1 0 0 0-1 1V13.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L9 1.5z"/><polyline points="9 1.5 9 6 13.5 6"/></svg>',
        codelist: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="13" y2="3"/><line x1="6" y1="8" x2="13" y2="8"/><line x1="6" y1="13" x2="13" y2="13"/><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="3" cy="13" r="1.2" fill="currentColor"/></svg>'
    };

    var TAB_PLACEHOLDERS = {
        systems:   'Systeme filtern…',
        tables:    'Tabellen filtern…',
        apis:      'APIs filtern…',
        files:     'Dateien filtern…',
        codelists: 'Wertelisten filtern…',
        cols:      'Attribute filtern…',
        edges:     'Beziehungen filtern…'
    };

    function init() {
        State = window.CanvasApp.State;
        headEl = document.getElementById('table-head');
        bodyEl = document.getElementById('table-body');
        countEl = document.getElementById('table-count');
        textInput = document.getElementById('filter-text');
        tabsEl = document.getElementById('table-tabs');

        textInput.addEventListener('input', render);

        tabsEl.addEventListener('click', onTabClick);
        bodyEl.addEventListener('click', onRowClick);
        bodyEl.addEventListener('blur', onCellBlur, true);
        bodyEl.addEventListener('change', onSelectChange);
        bodyEl.addEventListener('keydown', onCellKeydown);

        State.on(function (reason) {
            if (reason === 'nodes' || reason === 'edges' || reason === 'replace' || reason === 'reset') {
                render();
            } else if (reason === 'mode') {
                render();
            }
        });

        applyTabUI();
    }

    function onTabClick(e) {
        var btn = e.target.closest('[data-tab]');
        if (!btn) return;
        var tab = btn.getAttribute('data-tab');
        if (tab === activeTab) return;
        activeTab = tab;
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
        textInput.setAttribute('placeholder', TAB_PLACEHOLDERS[activeTab] || 'Filtern…');
    }

    function render() {
        switch (activeTab) {
            case 'systems':   return renderSystems();
            case 'tables':    return renderTypedNodes(['table', 'view'], 'Tabellen');
            case 'apis':      return renderTypedNodes(['api'],           'APIs');
            case 'files':     return renderTypedNodes(['file'],          'Dateien');
            case 'codelists': return renderTypedNodes(['codelist'],      'Wertelisten');
            case 'cols':      return renderCols();
            case 'edges':     return renderEdges();
        }
    }

    // ---- Tab: Systems --------------------------------------------------

    function renderSystems() {
        var q = textInput.value.trim().toLowerCase();
        var byName = {};
        State.getNodes().forEach(function (n) {
            var s = (n.system || '').trim();
            if (!s) return;
            if (!byName[s]) byName[s] = { name: s, byType: {}, attrs: 0, tags: {} };
            byName[s].byType[n.type] = (byName[s].byType[n.type] || 0) + 1;
            byName[s].attrs += (n.columns || []).length;
            (n.tags || []).forEach(function (t) { byName[s].tags[t] = true; });
        });
        var rows = Object.keys(byName).map(function (k) { return byName[k]; });
        var total = rows.length;
        if (q) {
            rows = rows.filter(function (r) { return r.name.toLowerCase().indexOf(q) !== -1; });
        }
        rows.sort(function (a, b) { return a.name.localeCompare(b.name); });

        headEl.innerHTML = '<tr><th>Name</th><th>Typen</th><th>Attribute</th><th>Tags</th></tr>';
        countEl.textContent = countLabel(rows.length, total, 'Systeme');

        bodyEl.innerHTML = rows.map(systemRowHtml).join('') ||
            emptyRowHtml(4, q ? 'Keine Treffer' : 'Keine Systeme');
    }

    function systemRowHtml(r) {
        var byType = r.byType;
        var typeBreakdown = Object.keys(byType).map(function (t) {
            return byType[t] + ' ' + typeLabel(t);
        }).join(', ');
        var tags = Object.keys(r.tags).sort().slice(0, 4).map(function (t) {
            return '<span class="tag">' + escapeHtml(t) + '</span>';
        }).join('');
        return '<tr data-system="' + escapeAttr(r.name) + '" data-kind="system">' +
                '<td><span class="cell-name">' + escapeHtml(r.name) + '</span></td>' +
                '<td><span style="color:var(--color-text-secondary)">' + escapeHtml(typeBreakdown) + '</span></td>' +
                '<td>' + r.attrs + '</td>' +
                '<td>' + (tags || dash()) + '</td>' +
            '</tr>';
    }

    // ---- Tab: typed nodes (tables / apis / files / codelists) ---------

    function renderTypedNodes(types, noun) {
        var q = textInput.value.trim().toLowerCase();
        var isEdit = State.getMode() === 'edit';

        var typeSet = {};
        types.forEach(function (t) { typeSet[t] = true; });

        var allOfKind = State.getNodes().filter(function (n) { return typeSet[n.type]; });
        var rows = allOfKind.filter(function (n) {
            if (!q) return true;
            var hay = [
                n.label, n.id, n.system, n.schema,
                (n.tags || []).join(' '),
                (n.columns || []).map(function (c) { return c.name; }).join(' ')
            ].join(' ').toLowerCase();
            return hay.indexOf(q) !== -1;
        });

        // Codelists: rename the "Attribute" count column to "Codes"; drop "Property Sets"
        var isCodelist = types.length === 1 && types[0] === 'codelist';
        var attrCol = isCodelist ? 'Codes' : 'Attribute';

        headEl.innerHTML = '<tr>' +
            '<th>Name</th><th>Typ</th><th>System</th><th>Schema</th>' +
            (isCodelist ? '' : '<th>Property Sets</th>') +
            '<th>' + attrCol + '</th><th>Tags</th><th></th></tr>';

        countEl.textContent = countLabel(rows.length, allOfKind.length, noun);

        bodyEl.innerHTML = rows.map(function (n) {
            return typedNodeRowHtml(n, isEdit, isCodelist, types);
        }).join('') || emptyRowHtml(isCodelist ? 7 : 8, q ? 'Keine Treffer' : 'Keine ' + noun);
    }

    function typedNodeRowHtml(n, isEdit, isCodelist, allowedTypes) {
        var icon = TYPE_ICONS[n.type] || TYPE_ICONS.table;
        var ce = isEdit ? 'true' : 'false';
        // The type select only offers the allowed types for this tab plus
        // the node's current type (so legacy view nodes can still be seen).
        var typeChoices = allowedTypes.slice();
        if (typeChoices.indexOf(n.type) === -1) typeChoices.push(n.type);
        var typeOptsHtml = typeChoices.map(function (t) {
            return '<option value="' + t + '"' + (t === n.type ? ' selected' : '') + '>' + typeLabel(t) + '</option>';
        }).join('');
        var setCount = State.derivePropertySets(n).length;
        var colCount = (n.columns || []).length;
        var tags = (n.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('');

        return '<tr data-node-id="' + escapeAttr(n.id) + '" data-kind="node">' +
                '<td><span class="cell-name"><span class="cell-icon" data-type="' + escapeAttr(n.type) + '">' + icon + '</span>' +
                    '<span data-edit="label" contenteditable="' + ce + '" spellcheck="false">' + escapeHtml(n.label || n.id) + '</span></span></td>' +
                '<td><select class="cell-select" data-edit="type">' + typeOptsHtml + '</select></td>' +
                '<td><span data-edit="system" contenteditable="' + ce + '" spellcheck="false">' + escapeHtml(n.system || '') + '</span></td>' +
                '<td><span data-edit="schema" contenteditable="' + ce + '" spellcheck="false">' + escapeHtml(n.schema || '') + '</span></td>' +
                (isCodelist ? '' : '<td>' + (setCount || '–') + '</td>') +
                '<td>' + (colCount || '–') + '</td>' +
                '<td>' +
                    (isEdit
                        ? '<span data-edit="tags" contenteditable="true" spellcheck="false" data-placeholder="komma,getrennt">' + escapeHtml((n.tags || []).join(', ')) + '</span>'
                        : (tags || dash())
                    ) +
                '</td>' +
                '<td>' + delBtn('Eintrag') + '</td>' +
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
                return [r.col.name, r.col.type, r.col.set, r.node.label, r.node.id, r.node.system].join(' ').toLowerCase().indexOf(q) !== -1;
            });
        }

        headEl.innerHTML = '<tr><th>Name</th><th>Datentyp</th><th>Schlüssel</th><th>Set</th><th>Knoten</th><th>System</th><th></th></tr>';
        countEl.textContent = countLabel(rows.length, total, 'Attribute');
        bodyEl.innerHTML = rows.map(colRowHtml).join('') ||
            emptyRowHtml(7, q ? 'Keine Treffer' : 'Keine Attribute');
    }

    function colRowHtml(r) {
        var icon = TYPE_ICONS[r.node.type] || TYPE_ICONS.table;
        var keyClass = r.col.key === 'PK' ? 'pk' : r.col.key === 'FK' ? 'fk' : r.col.key === 'UK' ? 'uk' : '';
        var keyLabel = r.col.key || '–';
        return '<tr data-node-id="' + escapeAttr(r.node.id) + '" data-col-idx="' + r.idx + '" data-kind="col">' +
                '<td><code class="cell-mono">' + escapeHtml(r.col.name) + '</code></td>' +
                '<td><span style="color:var(--color-text-secondary)">' + escapeHtml(r.col.type || '') + '</span></td>' +
                '<td>' + (r.col.key ? '<span class="info-key-badge ' + keyClass + '">' + escapeHtml(keyLabel) + '</span>' : dash()) + '</td>' +
                '<td>' + (r.col.set ? '<code class="cell-mono">' + escapeHtml(r.col.set) + '</code>' : dash()) + '</td>' +
                '<td><span class="cell-name"><span class="cell-icon" data-type="' + escapeAttr(r.node.type) + '">' + icon + '</span>' + escapeHtml(r.node.label || r.node.id) + '</span></td>' +
                '<td>' + (r.node.system ? escapeHtml(r.node.system) : dash()) + '</td>' +
                '<td>' + delBtn('Attribut') + '</td>' +
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

        headEl.innerHTML = '<tr><th>Beziehung</th><th>Quelle</th><th>Ziel</th><th></th></tr>';
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
                '<td>' + (e.label ? escapeHtml(e.label) : dash()) + '</td>' +
                '<td><span class="cell-name">' + escapeHtml(fromLabel) + '</span></td>' +
                '<td><span class="cell-name">→ ' + escapeHtml(toLabel) + '</span></td>' +
                '<td>' + delBtn('Beziehung') + '</td>' +
            '</tr>';
    }

    // ---- Row click + delete + inline edit ------------------------------

    function onRowClick(e) {
        var row = e.target.closest('tr');
        if (!row) return;
        var kind = row.getAttribute('data-kind');

        var delEl = e.target.closest('[data-action="delete"]');
        if (delEl && State.getMode() === 'edit') {
            e.stopPropagation();
            return onRowDelete(row, kind);
        }

        if (State.getMode() === 'edit') {
            if (e.target.closest('[contenteditable="true"], select, button')) return;
        }

        if (kind === 'system') {
            var sys = row.getAttribute('data-system');
            if (sys) State.setSelectedSystem(sys);
            return;
        }
        if (kind === 'edge') {
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
            State.deleteNode(nodeId);
            return;
        }
        if (kind === 'edge') {
            var edgeId = row.getAttribute('data-edge-id');
            if (edgeId) State.deleteEdge(edgeId);
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
        // Inline edit only on the typed-node tabs (rows have data-kind="node")
        if (['tables', 'apis', 'files', 'codelists'].indexOf(activeTab) === -1) return;
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
        if (['tables', 'apis', 'files', 'codelists'].indexOf(activeTab) === -1) return;
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
        return filtered === total ? filtered + ' ' + noun : filtered + ' von ' + total + ' ' + noun;
    }
    function unique(arr) {
        var seen = {}, out = [];
        arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
        return out.sort();
    }
    function typeLabel(t) {
        return ({ table: 'Tabelle', view: 'View', api: 'API', file: 'Datei', codelist: 'Werteliste' }[t] || t || '–');
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttr(s) { return escapeHtml(s); }

    return { init: init, render: render };
})();
