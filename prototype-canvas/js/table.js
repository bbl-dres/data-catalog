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

    var TAB_PLACEHOLDERS = {
        systems:   'Systeme filtern…',
        tables:    'Tabellen filtern…',
        apis:      'APIs filtern…',
        files:     'Dateien filtern…',
        codelists: 'Wertelisten filtern…',
        sets:      'Datenpakete filtern…',
        cols:      'Attribute filtern…',
        edges:     'Beziehungen filtern…'
    };

    var filterDebounceTimer = null;
    function debouncedRender() {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = setTimeout(render, 100);
    }

    function init() {
        State = window.CanvasApp.State;
        headEl = document.getElementById('table-head');
        bodyEl = document.getElementById('table-body');
        countEl = document.getElementById('table-count');
        textInput = document.getElementById('filter-text');
        tabsEl = document.getElementById('table-tabs');

        // Debounce the input handler — every keystroke used to rebuild the
        // entire <tbody>.innerHTML and rebuild a haystack string per row.
        textInput.addEventListener('input', debouncedRender);

        tabsEl.addEventListener('click', onTabClick);
        bodyEl.addEventListener('click', onRowClick);
        bodyEl.addEventListener('blur', onCellBlur, true);
        bodyEl.addEventListener('change', onSelectChange);
        bodyEl.addEventListener('keydown', onCellKeydown);

        State.on(function (reason) {
            // Background renders while the table view isn't visible were
            // dominating typing-blur cost in the diagram view (every node
            // label edit rebuilt the full table tbody — ~1k rows on IBPDI).
            // Catch up by always rendering when the user enters the table
            // view; otherwise, only react to events when already visible.
            if (reason === 'view') {
                if (State.getView() === 'table') render();
                return;
            }
            if (State.getView() !== 'table') return;
            if (reason === 'nodes' || reason === 'edges' || reason === 'replace' || reason === 'reset') {
                render();
            } else if (reason === 'mode' || reason === 'filter') {
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
            case 'sets':      return renderSets();
            case 'cols':      return renderCols();
            case 'edges':     return renderEdges();
        }
    }

    // ---- Tab: Systems --------------------------------------------------

    function renderSystems() {
        var q = textInput.value.trim().toLowerCase();
        // Filter pills narrow the universe BEFORE aggregation: a system
        // disappears from this list once every node it owned is filtered
        // out. Stats reflect the filtered scope, not the catalog total.
        var nodes = State.getNodes().filter(State.matchesFilters);
        var byName = {};
        nodes.forEach(function (n) {
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

        // Apply filter pills first; "total" reflects the filtered scope
        // so the count reads "5 von 12" within the active filter set.
        var allOfKind = State.getNodes()
            .filter(function (n) { return typeSet[n.type]; })
            .filter(State.matchesFilters);
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

        // Typ column dropped — the active sub-tab (Tabellen / APIs /
        // Dateien / Wertelisten) already disambiguates the row's type.
        // Editing the type in the Liste view is rare; users who need
        // it switch in the canvas detail panel.
        headEl.innerHTML = '<tr>' +
            '<th>Name</th><th>System</th><th>Schema</th>' +
            (isCodelist ? '' : '<th>Property Sets</th>') +
            '<th>' + attrCol + '</th><th>Tags</th><th></th></tr>';

        countEl.textContent = countLabel(rows.length, allOfKind.length, noun);

        bodyEl.innerHTML = rows.map(function (n) {
            return typedNodeRowHtml(n, isEdit, isCodelist);
        }).join('') || emptyRowHtml(isCodelist ? 6 : 7, q ? 'Keine Treffer' : 'Keine ' + noun);
    }

    function typedNodeRowHtml(n, isEdit, isCodelist) {
        var ce = isEdit ? 'true' : 'false';
        var setCount = State.derivePropertySets(n).length;
        var colCount = (n.columns || []).length;
        var tags = (n.tags || []).map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('');

        return '<tr data-node-id="' + escapeAttr(n.id) + '" data-kind="node">' +
                '<td><span class="cell-name">' +
                    '<span data-edit="label" contenteditable="' + ce + '" spellcheck="false">' + escapeHtml(n.label || n.id) + '</span>' +
                '</span></td>' +
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

    // ---- Tab: Datenpakete (global property-set registry) ---------------

    /**
     * Lists every entry in the global sets registry with usage stats —
     * how many distinct nodes reference it and how many columns total.
     * This is the "show me the lineage atlas" view the engineer asked
     * for in the Datenpakete framing. Per-node-only sets disappear from
     * here once they're promoted to the registry.
     *
     * Row click jumps to the Attribute tab pre-filtered by the set's
     * label — gives the user a one-tap "show me every column in this
     * package across the whole catalog."
     */
    function renderSets() {
        var q = textInput.value.trim().toLowerCase();
        // Filter pills shape this view in two ways:
        //   - Stats are computed from filter-matching nodes only, so e.g.
        //     filtering by System=BBL re-counts Adresse usage with only
        //     BBL nodes contributing.
        //   - When f.set is non-empty the registry list is restricted to
        //     just those packages; otherwise the full registry shows.
        var nodes = State.getNodes().filter(State.matchesFilters);
        var allSets = State.getSets();
        var setFilter = State.getFilter('set');
        var sets = setFilter.length
            ? allSets.filter(function (s) { return setFilter.indexOf(s.id) !== -1; })
            : allSets;

        // Single pass over all columns: tally distinct nodes + column count
        // per set. Cheaper than iterating registry × nodes × columns.
        var statsBySet = Object.create(null);
        sets.forEach(function (s) { statsBySet[s.id] = { nodes: Object.create(null), cols: 0 }; });
        nodes.forEach(function (n) {
            (n.columns || []).forEach(function (c) {
                var st = c.setId && statsBySet[c.setId];
                if (!st) return;
                st.nodes[n.id] = true;
                st.cols += 1;
            });
        });

        var rows = sets.map(function (s) {
            var st = statsBySet[s.id];
            return {
                id: s.id,
                label: s.label || s.id,
                description: s.description || '',
                lineage: s.lineage || '',
                nodeCount: Object.keys(st.nodes).length,
                colCount: st.cols
            };
        });
        var total = rows.length;
        if (q) {
            rows = rows.filter(function (r) {
                return [r.label, r.description, r.lineage, r.id]
                    .join(' ').toLowerCase().indexOf(q) !== -1;
            });
        }
        // Unused sets still show, sorted alphabetically — this is a
        // catalog of available packages, not just used ones.
        rows.sort(function (a, b) { return a.label.localeCompare(b.label); });

        headEl.innerHTML = '<tr><th>Datenpaket</th><th>Beschreibung</th><th>Quelle</th><th>Knoten</th><th>Attribute</th></tr>';
        countEl.textContent = countLabel(rows.length, total, 'Datenpakete');
        bodyEl.innerHTML = rows.map(setRowHtml).join('') ||
            emptyRowHtml(5, q ? 'Keine Treffer' : 'Keine Datenpakete');
    }

    function setRowHtml(r) {
        var dim = (r.nodeCount === 0) ? ' style="opacity:0.55"' : '';
        return '<tr data-set-id="' + escapeAttr(r.id) + '" data-kind="set"' + dim + ' title="Klicken: alle Attribute dieses Datenpakets anzeigen">' +
                '<td><span class="cell-name">' + escapeHtml(r.label) + '</span></td>' +
                '<td><span style="color:var(--color-text-secondary)">' + escapeHtml(r.description) + '</span></td>' +
                '<td><span style="color:var(--color-text-secondary)">' + escapeHtml(r.lineage) + '</span></td>' +
                '<td>' + r.nodeCount + '</td>' +
                '<td>' + r.colCount + '</td>' +
            '</tr>';
    }

    // ---- Tab: Columns / Attributes -------------------------------------

    function renderCols() {
        var q = textInput.value.trim().toLowerCase();
        // Two-tier filter:
        //   - Parent node must satisfy filter pills (system / type / tag).
        //   - When f.set is non-empty, restrict to columns whose own setId
        //     is in f.set — stricter than the node-level "any column with
        //     a matching set" semantic, because on the Attribute tab the
        //     user wants the columns IN the package, not every column on
        //     a node that happens to use the package.
        var setFilter = State.getFilter('set');
        var rows = [];
        State.getNodes().forEach(function (n) {
            if (!State.matchesFilters(n)) return;
            (n.columns || []).forEach(function (c, idx) {
                if (setFilter.length && setFilter.indexOf(c.setId || '') === -1) return;
                rows.push({ node: n, col: c, idx: idx });
            });
        });
        var total = rows.length;
        if (q) {
            rows = rows.filter(function (r) {
                // Filter haystack now hits both the registry label (so users
                // can search "Adresse" and find columns whose setId is
                // "address") and the SAP substructure key.
                var setLabel = r.col.setId ? State.getSetLabel(r.col.setId) : '';
                return [r.col.name, r.col.type, setLabel, r.col.sourceStructure || '',
                        r.node.label, r.node.id, r.node.system].join(' ').toLowerCase().indexOf(q) !== -1;
            });
        }

        headEl.innerHTML = '<tr><th>Name</th><th>Datentyp</th><th>Schlüssel</th><th>Set</th><th>Knoten</th><th>System</th><th></th></tr>';
        countEl.textContent = countLabel(rows.length, total, 'Attribute');
        bodyEl.innerHTML = rows.map(colRowHtml).join('') ||
            emptyRowHtml(7, q ? 'Keine Treffer' : 'Keine Attribute');
    }

    function colRowHtml(r) {
        var keyClass = r.col.key === 'PK' ? 'pk' : r.col.key === 'FK' ? 'fk' : r.col.key === 'UK' ? 'uk' : '';
        var keyLabel = r.col.key || '–';
        // Set column shows registry label (preferred) or SAP key (API node
        // fallback). Either way the cell is human-readable, not the raw id.
        var setCell;
        if (r.col.setId) {
            setCell = '<span class="cell-name">' + escapeHtml(State.getSetLabel(r.col.setId)) + '</span>';
        } else if (r.col.sourceStructure) {
            setCell = '<code class="cell-mono">' + escapeHtml(r.col.sourceStructure) + '</code>';
        } else {
            setCell = dash();
        }
        return '<tr data-node-id="' + escapeAttr(r.node.id) + '" data-col-idx="' + r.idx + '" data-kind="col">' +
                '<td><code class="cell-mono">' + escapeHtml(r.col.name) + '</code></td>' +
                '<td><span style="color:var(--color-text-secondary)">' + escapeHtml(r.col.type || '') + '</span></td>' +
                '<td>' + (r.col.key ? '<span class="info-key-badge ' + keyClass + '">' + escapeHtml(keyLabel) + '</span>' : dash()) + '</td>' +
                '<td>' + setCell + '</td>' +
                '<td><span class="cell-name">' + escapeHtml(r.node.label || r.node.id) + '</span></td>' +
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
        // Filter pills hide an edge when EITHER endpoint is filtered out
        // — same rule the canvas uses, keeps the two views consistent.
        var matched = Object.create(null);
        var hasFilters = State.hasActiveFilters();
        if (hasFilters) {
            nodes.forEach(function (n) { if (State.matchesFilters(n)) matched[n.id] = true; });
        }
        var allEdges = State.getEdges().filter(function (e) {
            if (!hasFilters) return true;
            return matched[e.from] && matched[e.to];
        });
        var edges = allEdges.filter(function (e) {
            if (!q) return true;
            var fromLabel = (byId[e.from] && byId[e.from].label) || e.from;
            var toLabel = (byId[e.to] && byId[e.to].label) || e.to;
            return [e.label, fromLabel, toLabel, e.from, e.to].join(' ').toLowerCase().indexOf(q) !== -1;
        });

        headEl.innerHTML = '<tr><th>Beziehung</th><th>Quelle</th><th>Ziel</th><th></th></tr>';
        countEl.textContent = countLabel(edges.length, allEdges.length, 'Beziehungen');
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
        if (kind === 'set') {
            // Open the Datenpaket detail in the side panel. Drilling further
            // ("show me every attribute in this package") is a one-click
            // affordance inside the panel itself — see Table.showAttributesFor
            // wired from panel.js.
            var setId = row.getAttribute('data-set-id');
            if (setId) State.setSelectedSet(setId);
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

    /**
     * Public hook for the Datenpaket detail panel — switches to the
     * Liste view (if not already there), the Attribute tab, and
     * pre-fills the filter input with the set's label. Pre-fill works
     * because the Attribute filter haystack includes the resolved set
     * label (so "Adresse" matches every column whose setId is "address").
     */
    function showAttributesFor(setLabel) {
        if (!setLabel) return;
        if (State.getView() !== 'table') State.setView('table');
        activeTab = 'cols';
        textInput.value = setLabel;
        applyTabUI();
        render();
        // Bring the filter input into view & focused for further refinement.
        if (textInput.focus) textInput.focus();
    }

    return { init: init, render: render, showAttributesFor: showAttributesFor };
})();
