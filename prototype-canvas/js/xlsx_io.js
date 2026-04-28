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
    var SHEET_SOURCE_STRUCTS = 'SourceStructures';
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
            else if (kind === 'pdf') exportPdf();
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

    /**
     * PDF export — defers to the browser's print pipeline (Strg+P → Als PDF speichern).
     * @media print rules in styles.css strip chrome and lay out canvas / table /
     * API content on a printable page.
     *
     * On the diagram view we briefly fit-to-screen so the print snapshot
     * captures the whole graph, then restore the previous transform.
     */
    function exportPdf() {
        var Canvas = window.CanvasApp && window.CanvasApp.Canvas;
        var view = State.getView();
        // Fit-to-screen for diagram view so the printed snapshot captures
        // every node. Caller didn't ask for it, but a partial print of an
        // already-zoomed canvas is rarely what they want.
        if (view === 'diagram' && Canvas && Canvas.fitToScreen) {
            Canvas.fitToScreen();
        }
        // Let the layout settle before opening the print dialog.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                window.print();
            });
        });
    }

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

        // PropertySets — the global registry. Authoritative on import; round-
        // trips so an Excel-edited registry can be re-imported.
        var setRows = State.getSets().map(function (s) {
            return {
                id: s.id,
                label: s.label || '',
                description: s.description || '',
                lineage: s.lineage || ''
            };
        });
        XLSX.utils.book_append_sheet(wb,
            sheetFromRows(setRows, ['id', 'label', 'description', 'lineage']),
            SHEET_PROPSETS);

        // SourceStructures — per-node SAP BAPI substructure registry. Currently
        // only used by refx_gebaeude_api but the sheet is generic so any node
        // with `groupBy: "sourceStructure"` can carry one.
        var ssRows = [];
        nodes.forEach(function (n) {
            (n.sourceStructures || []).forEach(function (s) {
                ssRows.push({ node_id: n.id, key: s.id, label: s.label || '' });
            });
        });
        XLSX.utils.book_append_sheet(wb,
            sheetFromRows(ssRows, ['node_id', 'key', 'label']),
            SHEET_SOURCE_STRUCTS);

        // Attributes — every column across nodes. set_id references the
        // PropertySets registry; source_structure references SourceStructures.
        var colRows = [];
        nodes.forEach(function (n) {
            (n.columns || []).forEach(function (c) {
                colRows.push({
                    node_id: n.id,
                    name: c.name || '',
                    type: c.type || '',
                    key: c.key || '',
                    set_id: c.setId || '',
                    source_structure: c.sourceStructure || ''
                });
            });
        });
        XLSX.utils.book_append_sheet(wb,
            sheetFromRows(colRows, ['node_id', 'name', 'type', 'key', 'set_id', 'source_structure']),
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
        if (typeof XLSX === 'undefined') {
            // Mirrors the guard in exportXlsx — CDN failure shouldn't surface
            // as an uncaught ReferenceError inside the FileReader callback.
            toast('Excel-Bibliothek nicht geladen.', 'error');
            return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
            try {
                var wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                var parsed = parseWorkbook(wb);
                if (!parsed.nodes.length) {
                    toast('Keine Knoten in den Tabellen-Blättern gefunden.', 'error');
                    return;
                }
                var App = window.CanvasApp.App;
                var ask = (App && App.confirmDialog)
                    ? App.confirmDialog({
                        title: 'Canvas ersetzen?',
                        body:  'Der aktuelle Canvas wird durch den Excel-Inhalt ersetzt: ' +
                                parsed.nodes.length + ' Knoten, ' + parsed.edges.length + ' Beziehungen. ' +
                                'Diese Aktion kann nicht rückgängig gemacht werden.',
                        confirmText: 'Ersetzen',
                        cancelText:  'Abbrechen',
                        danger: true
                      })
                    : Promise.resolve(confirm('Aktuelle Canvas-Inhalte ersetzen?'));
                ask.then(function (ok) {
                    if (!ok) return;
                    State.replaceAll(parsed);
                    toast('Import erfolgreich · ' + parsed.nodes.length + ' Knoten', 'success');
                });
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

        // PropertySets — global registry. Authoritative on import; columns
        // reference these by id. If the sheet is missing or empty, fall
        // back to the in-memory registry so the import doesn't strand
        // existing setIds.
        var sets = [];
        var setsSheet = findSheet(wb, [SHEET_PROPSETS]);
        if (setsSheet) {
            sets = XLSX.utils.sheet_to_json(setsSheet, { defval: '' })
                .filter(function (r) { return r.id; })
                .map(function (r) {
                    return {
                        id: String(r.id).trim(),
                        label: String(r.label || r.id).trim(),
                        description: String(r.description || ''),
                        lineage: String(r.lineage || '')
                    };
                });
        }
        if (!sets.length) sets = State.getSets().slice();
        var knownSetIds = Object.create(null);
        sets.forEach(function (s) { knownSetIds[s.id] = true; });

        // SourceStructures — per-node SAP-substructure registry.
        var ssByNode = {};
        var ssSheet = findSheet(wb, [SHEET_SOURCE_STRUCTS]);
        if (ssSheet) {
            XLSX.utils.sheet_to_json(ssSheet, { defval: '' }).forEach(function (r) {
                if (!r.node_id || !r.key) return;
                (ssByNode[r.node_id] = ssByNode[r.node_id] || []).push({
                    id: String(r.key).trim(),
                    label: String(r.label || '').trim()
                });
            });
        }

        // Attributes — canonical headers are snake_case (`set_id`,
        // `source_structure`) to match the rest of the Excel schema. We
        // still accept camelCase (`setId`, `sourceStructure`) for files
        // exported from older builds or hand-edited by users coming from
        // the JSON shape, but warn so the user knows the workbook will
        // normalise on the next export.
        var colsSheet = findSheet(wb, [SHEET_ATTRS, 'Columns', 'columns']);
        var colsByNode = {};
        var unknownSetIds = Object.create(null);
        var sawCamelHeaders = false;
        if (colsSheet) {
            XLSX.utils.sheet_to_json(colsSheet, { defval: '' }).forEach(function (r) {
                if (!r.node_id) return;
                var setIdSnake = String(r.set_id || '').trim();
                var setIdCamel = String(r.setId  || '').trim();
                if (setIdCamel && !setIdSnake) sawCamelHeaders = true;
                var setId = setIdSnake || setIdCamel;
                if (setId && !knownSetIds[setId]) {
                    unknownSetIds[setId] = (unknownSetIds[setId] || 0) + 1;
                    setId = ''; // drop the bad reference rather than poisoning state
                }
                var col = {
                    name: String(r.name || ''),
                    type: String(r.type || ''),
                    key: String(r.key || '')
                };
                if (setId) col.setId = setId;
                var ssSnake = String(r.source_structure || '').trim();
                var ssCamel = String(r.sourceStructure  || '').trim();
                if (ssCamel && !ssSnake) sawCamelHeaders = true;
                var ss = ssSnake || ssCamel;
                if (ss) col.sourceStructure = ss;
                (colsByNode[r.node_id] = colsByNode[r.node_id] || []).push(col);
            });
        }
        if (Object.keys(unknownSetIds).length) {
            console.warn('Import: unknown setIds (dropped on the affected columns):', unknownSetIds);
        }
        if (sawCamelHeaders) {
            console.warn('Import: camelCase column headers (setId / sourceStructure) detected — these will be exported as set_id / source_structure on the next round-trip.');
            // Surface to the user too — silent header drift is the bug we
            // got bitten by, so make sure they see it before re-exporting.
            toast('Hinweis: Spaltennamen "setId"/"sourceStructure" werden beim Export zu "set_id"/"source_structure" umbenannt.', 'success');
        }

        // Wire columns + per-node sourceStructures onto each node.
        nodes.forEach(function (n) {
            n.columns = colsByNode[n.id] || [];
            if (ssByNode[n.id]) {
                n.sourceStructures = ssByNode[n.id];
                if (!n.groupBy) n.groupBy = 'sourceStructure';
            }
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

        return { nodes: nodes, edges: edges, sets: sets };
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
            version: 2,
            // Curator-saved entry-point view. Optional — null when the
            // canvas hasn't been pinned to a starting frame. Excel exports
            // skip this; JSON is the round-trip format that preserves it.
            homeView: State.getHomeView ? State.getHomeView() : null,
            sets: State.getSets(),
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
