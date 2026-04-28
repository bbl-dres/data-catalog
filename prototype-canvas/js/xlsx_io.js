/**
 * xlsx_io — Excel import/export and JSON download.
 *
 * Workbook shape (8 sheets — one per entity tab):
 *   Systems       node_id-less, derived per unique node.system
 *   Tables        nodes where type ∈ {table, view}
 *   APIs          nodes where type === 'api'
 *   Files         nodes where type === 'file'
 *   ValueLists    nodes where type === 'codelist'
 *   PropertySets  rows of (node_id, name, label, description)
 *   Attributes    columns with node_id + set
 *   Relations     edges
 *
 * Import is forgiving:
 *   - Reads every node-typed sheet and merges them into nodes[]; the type
 *     for each row defaults to the sheet's implicit type but a `type`
 *     column on the row wins if present.
 *   - Falls back to the legacy `Nodes` sheet if the typed sheets aren't
 *     there.
 *   - Auto-creates property sets referenced by a column but missing from
 *     the PropertySets sheet.
 *
 * Also exposes a JSON download (canvas.json) for round-tripping into the
 * git seed.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.XlsxIO = (function () {

    var State = null;
    var fileInput = null;

    var SHEET_TABLES      = 'Tables';
    var SHEET_APIS        = 'APIs';
    var SHEET_FILES       = 'Files';
    var SHEET_VALUELISTS  = 'ValueLists';
    var SHEET_SYSTEMS     = 'Systems';
    var SHEET_PROPSETS    = 'PropertySets';
    var SHEET_ATTRS       = 'Attributes';
    var SHEET_RELATIONS   = 'Relations';

    // Sheet name → implicit type (when a row lacks a `type` column).
    // Tables sheet: implicit table; if the row's `type` column says 'view',
    // that wins.
    var SHEET_TO_DEFAULT_TYPE = {
        'Tables':     'table',
        'APIs':       'api',
        'Files':      'file',
        'ValueLists': 'codelist',
        // Legacy single-sheet support
        'Nodes':      null
    };

    var NODE_HEADERS = ['id', 'label', 'type', 'system', 'schema', 'x', 'y', 'tags'];

    function init() {
        State = window.CanvasApp.State;
        fileInput = document.getElementById('file-input');

        document.getElementById('btn-import').addEventListener('click', function () {
            fileInput.value = '';
            fileInput.click();
        });
        fileInput.addEventListener('change', onFile);

        wireExportDropdown();
    }

    // ---- Export dropdown -----------------------------------------------

    function wireExportDropdown() {
        var trigger = document.getElementById('btn-export');
        var dropdown = document.getElementById('export-dropdown');
        if (!trigger || !dropdown) return;

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = dropdown.hasAttribute('hidden');
            if (open) {
                dropdown.removeAttribute('hidden');
                trigger.setAttribute('aria-expanded', 'true');
            } else {
                closeDropdown();
            }
        });

        dropdown.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-export]');
            if (!btn) return;
            if (btn.disabled) return;
            var kind = btn.getAttribute('data-export');
            closeDropdown();
            if (kind === 'xlsx') exportXlsx();
            else if (kind === 'json') exportJson();
            else if (kind === 'pdf') toast('PDF-Export folgt', 'success');
        });

        document.addEventListener('click', function (e) {
            if (dropdown.hasAttribute('hidden')) return;
            if (e.target.closest('.export-menu')) return;
            closeDropdown();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !dropdown.hasAttribute('hidden')) closeDropdown();
        });

        function closeDropdown() {
            dropdown.setAttribute('hidden', '');
            trigger.setAttribute('aria-expanded', 'false');
        }
    }

    // ---- Export --------------------------------------------------------

    function exportXlsx() {
        if (typeof XLSX === 'undefined') {
            toast('Excel-Bibliothek nicht geladen.', 'error');
            return;
        }
        var wb = XLSX.utils.book_new();
        var nodes = State.getNodes();

        // Systems — derived overview
        var systemRows = buildSystemRows(nodes);
        XLSX.utils.book_append_sheet(wb, sheetFromRows(systemRows,
            ['name', 'nodes', 'tables', 'apis', 'files', 'valuelists', 'sets', 'attributes', 'tags']),
            SHEET_SYSTEMS);

        // Per-type node sheets
        var tableRows      = nodes.filter(typeIn(['table', 'view'])).map(nodeToRow);
        var apiRows        = nodes.filter(typeIn(['api'])).map(nodeToRow);
        var fileRows       = nodes.filter(typeIn(['file'])).map(nodeToRow);
        var valueListRows  = nodes.filter(typeIn(['codelist'])).map(nodeToRow);
        XLSX.utils.book_append_sheet(wb, sheetFromRows(tableRows,     NODE_HEADERS), SHEET_TABLES);
        XLSX.utils.book_append_sheet(wb, sheetFromRows(apiRows,       NODE_HEADERS), SHEET_APIS);
        XLSX.utils.book_append_sheet(wb, sheetFromRows(fileRows,      NODE_HEADERS), SHEET_FILES);
        XLSX.utils.book_append_sheet(wb, sheetFromRows(valueListRows, NODE_HEADERS), SHEET_VALUELISTS);

        // PropertySets — derived from distinct column.set values per node.
        // Exported for human readability of the Excel file; on import this
        // sheet is ignored (sets come from Attributes.set on import).
        var setRows = [];
        nodes.forEach(function (n) {
            State.derivePropertySets(n).forEach(function (s) {
                var count = (n.columns || []).filter(function (c) { return c.set === s.name; }).length;
                setRows.push({
                    node_id: n.id,
                    name: s.name,
                    attribute_count: count
                });
            });
        });
        XLSX.utils.book_append_sheet(wb,
            sheetFromRows(setRows, ['node_id', 'name', 'attribute_count']),
            SHEET_PROPSETS);

        // Attributes — every column across nodes
        var colRows = [];
        nodes.forEach(function (n) {
            (n.columns || []).forEach(function (c) {
                colRows.push({
                    node_id: n.id,
                    name: c.name || '',
                    type: c.type || '',
                    key: c.key || '',
                    set: c.set || ''
                });
            });
        });
        XLSX.utils.book_append_sheet(wb,
            sheetFromRows(colRows, ['node_id', 'name', 'type', 'key', 'set']),
            SHEET_ATTRS);

        // Relations
        var edgeRows = State.getEdges().map(function (e) {
            return { id: e.id, from: e.from, to: e.to, label: e.label || '' };
        });
        XLSX.utils.book_append_sheet(wb,
            sheetFromRows(edgeRows, ['id', 'from', 'to', 'label']),
            SHEET_RELATIONS);

        var date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, 'bbl-canvas-' + date + '.xlsx');
        toast('Export erfolgreich', 'success');
    }

    function nodeToRow(n) {
        return {
            id: n.id,
            label: n.label || '',
            type: n.type || 'table',
            system: n.system || '',
            schema: n.schema || '',
            x: Math.round(n.x || 0),
            y: Math.round(n.y || 0),
            tags: (n.tags || []).join(', ')
        };
    }

    function buildSystemRows(nodes) {
        var byName = {};
        nodes.forEach(function (n) {
            var s = (n.system || '').trim();
            if (!s) return;
            if (!byName[s]) {
                byName[s] = {
                    name: s, nodes: 0,
                    tables: 0, apis: 0, files: 0, valuelists: 0,
                    sets: 0, attributes: 0,
                    tags: {}
                };
            }
            var rec = byName[s];
            rec.nodes += 1;
            if (n.type === 'table' || n.type === 'view') rec.tables     += 1;
            else if (n.type === 'api')                   rec.apis       += 1;
            else if (n.type === 'file')                  rec.files      += 1;
            else if (n.type === 'codelist')              rec.valuelists += 1;
            rec.sets       += State.derivePropertySets(n).length;
            rec.attributes += (n.columns      || []).length;
            (n.tags || []).forEach(function (t) { rec.tags[t] = true; });
        });
        return Object.keys(byName).sort().map(function (k) {
            var r = byName[k];
            r.tags = Object.keys(r.tags).sort().join(', ');
            return r;
        });
    }

    function typeIn(types) {
        var s = {};
        types.forEach(function (t) { s[t] = true; });
        return function (n) { return !!s[n.type]; };
    }

    function sheetFromRows(rows, headers) {
        if (!rows.length) {
            return XLSX.utils.aoa_to_sheet([headers]);
        }
        return XLSX.utils.json_to_sheet(rows, { header: headers });
    }

    // ---- Import --------------------------------------------------------

    function onFile(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            try {
                var wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                var parsed = parseWorkbook(wb);
                if (!parsed.nodes.length) {
                    toast('Keine Knoten in den Tabellen-Blättern gefunden.', 'error');
                    return;
                }
                if (!confirm('Aktuelle Canvas-Inhalte ersetzen? (' + parsed.nodes.length + ' Knoten, ' + parsed.edges.length + ' Beziehungen)')) {
                    return;
                }
                State.replaceAll(parsed);
                toast('Import erfolgreich · ' + parsed.nodes.length + ' Knoten', 'success');
            } catch (err) {
                console.error(err);
                toast('Import fehlgeschlagen: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function findSheet(wb, names) {
        for (var i = 0; i < names.length; i++) {
            if (wb.Sheets[names[i]]) return wb.Sheets[names[i]];
            // case-insensitive fallback
            var lower = names[i].toLowerCase();
            for (var k in wb.Sheets) {
                if (k.toLowerCase() === lower) return wb.Sheets[k];
            }
        }
        return null;
    }

    function parseWorkbook(wb) {
        var TYPED_SHEETS = ['Tables', 'APIs', 'Files', 'ValueLists'];
        var nodes = [];
        var seenIds = {};

        TYPED_SHEETS.forEach(function (sheetName) {
            var ws = findSheet(wb, [sheetName]);
            if (!ws) return;
            var defaultType = SHEET_TO_DEFAULT_TYPE[sheetName];
            XLSX.utils.sheet_to_json(ws, { defval: '' }).forEach(function (r) {
                if (!r.id) return;
                if (seenIds[r.id]) return; // first sheet wins (avoid duplicates)
                seenIds[r.id] = true;
                nodes.push(rowToNode(r, defaultType));
            });
        });

        // Legacy fallback — if no typed sheets matched but a Nodes sheet exists
        if (!nodes.length) {
            var legacy = findSheet(wb, ['Nodes', 'nodes']);
            if (legacy) {
                XLSX.utils.sheet_to_json(legacy, { defval: '' }).forEach(function (r) {
                    if (!r.id) return;
                    if (seenIds[r.id]) return;
                    seenIds[r.id] = true;
                    nodes.push(rowToNode(r, null));
                });
            }
        }

        // PropertySets sheet is informational only — sets are derived from
        // the Attributes sheet's `set` column on import.

        // Attributes
        var colsSheet = findSheet(wb, [SHEET_ATTRS, 'Columns', 'columns']);
        var colsByNode = {};
        if (colsSheet) {
            XLSX.utils.sheet_to_json(colsSheet, { defval: '' }).forEach(function (r) {
                if (!r.node_id) return;
                (colsByNode[r.node_id] = colsByNode[r.node_id] || []).push({
                    name: String(r.name || ''),
                    type: String(r.type || ''),
                    key: String(r.key || ''),
                    set: String(r.set || '')
                });
            });
        }

        // Wire columns onto each node.
        nodes.forEach(function (n) {
            n.columns = colsByNode[n.id] || [];
        });

        // Edges (Relations sheet, with Edges fallback)
        var edgesSheet = findSheet(wb, [SHEET_RELATIONS, 'Edges', 'edges']);
        var edges = [];
        if (edgesSheet) {
            edges = XLSX.utils.sheet_to_json(edgesSheet, { defval: '' })
                .filter(function (r) { return r.from && r.to; })
                .map(function (r, i) {
                    return {
                        id: String(r.id || ('e' + i)),
                        from: String(r.from),
                        to: String(r.to),
                        label: String(r.label || '')
                    };
                });
        }

        return { nodes: nodes, edges: edges };
    }

    function rowToNode(r, defaultType) {
        var rowType = (r.type || '').toString().trim();
        var type = rowType || defaultType || 'table';
        var tags = String(r.tags || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        return {
            id: String(r.id),
            label: String(r.label || r.id),
            type: type,
            system: String(r.system || ''),
            schema: String(r.schema || ''),
            x: Number(r.x) || 0,
            y: Number(r.y) || 0,
            tags: tags
        };
    }

    // ---- JSON download -------------------------------------------------

    function exportJson() {
        var data = {
            nodes: State.getNodes(),
            edges: State.getEdges()
        };
        var json = JSON.stringify(data, null, 2);
        if (!json.endsWith('\n')) json += '\n';
        var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'canvas.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('canvas.json heruntergeladen', 'success');
    }

    function toast(msg, kind) {
        if (window.CanvasApp.App && window.CanvasApp.App.toast) {
            window.CanvasApp.App.toast(msg, kind);
        }
    }

    return { init: init, exportXlsx: exportXlsx, exportJson: exportJson };
})();
