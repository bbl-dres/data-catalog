/**
 * xlsx_io — Excel import/export.
 *
 * Workbook shape (4 sheets):
 *   Nodes:        id | label | type | system | schema | x | y | tags
 *   PropertySets: node_id | name | label | description
 *   Columns:      node_id | name | type | key | set
 *   Edges:        id | from | to | label
 *
 * Import replaces the canvas state (after confirmation). Export downloads
 * the current state as `bbl-canvas-YYYY-MM-DD.xlsx`. SheetJS is loaded via
 * CDN in index.html (same as prototype-sqlite).
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.XlsxIO = (function () {

    var State = null;
    var fileInput = null;

    function init() {
        State = window.CanvasApp.State;
        fileInput = document.getElementById('file-input');

        document.getElementById('btn-import').addEventListener('click', function () {
            fileInput.value = '';
            fileInput.click();
        });
        fileInput.addEventListener('change', onFile);

        document.getElementById('btn-export').addEventListener('click', exportXlsx);
    }

    // ---- Export --------------------------------------------------------

    function exportXlsx() {
        if (typeof XLSX === 'undefined') {
            toast('Excel-Bibliothek nicht geladen.', 'error');
            return;
        }
        var wb = XLSX.utils.book_new();

        var nodeRows = State.getNodes().map(function (n) {
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
        });
        var setRows = [];
        State.getNodes().forEach(function (n) {
            (n.propertySets || []).forEach(function (s) {
                setRows.push({
                    node_id: n.id,
                    name: s.name || '',
                    label: s.label || '',
                    description: s.description || ''
                });
            });
        });
        var colRows = [];
        State.getNodes().forEach(function (n) {
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
        var edgeRows = State.getEdges().map(function (e) {
            return { id: e.id, from: e.from, to: e.to, label: e.label || '' };
        });

        XLSX.utils.book_append_sheet(wb, sheetFromRows(nodeRows, ['id', 'label', 'type', 'system', 'schema', 'x', 'y', 'tags']), 'Nodes');
        XLSX.utils.book_append_sheet(wb, sheetFromRows(setRows, ['node_id', 'name', 'label', 'description']), 'PropertySets');
        XLSX.utils.book_append_sheet(wb, sheetFromRows(colRows, ['node_id', 'name', 'type', 'key', 'set']), 'Columns');
        XLSX.utils.book_append_sheet(wb, sheetFromRows(edgeRows, ['id', 'from', 'to', 'label']), 'Edges');

        var date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, 'bbl-canvas-' + date + '.xlsx');
        toast('Export erfolgreich', 'success');
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
                    toast('Keine Knoten im "Nodes"-Sheet gefunden.', 'error');
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

    function parseWorkbook(wb) {
        var nodesSheet = wb.Sheets['Nodes'] || wb.Sheets['nodes'];
        var setsSheet = wb.Sheets['PropertySets'] || wb.Sheets['propertysets'] || wb.Sheets['property_sets'];
        var colsSheet = wb.Sheets['Columns'] || wb.Sheets['columns'];
        var edgesSheet = wb.Sheets['Edges'] || wb.Sheets['edges'];

        if (!nodesSheet) throw new Error('Sheet "Nodes" fehlt.');

        var nodeRows = XLSX.utils.sheet_to_json(nodesSheet, { defval: '' });
        var setRows = setsSheet ? XLSX.utils.sheet_to_json(setsSheet, { defval: '' }) : [];
        var colRows = colsSheet ? XLSX.utils.sheet_to_json(colsSheet, { defval: '' }) : [];
        var edgeRows = edgesSheet ? XLSX.utils.sheet_to_json(edgesSheet, { defval: '' }) : [];

        var setsByNode = {};
        setRows.forEach(function (r) {
            if (!r.node_id || !r.name) return;
            (setsByNode[r.node_id] = setsByNode[r.node_id] || []).push({
                name: String(r.name),
                label: String(r.label || ''),
                description: String(r.description || '')
            });
        });

        var colsByNode = {};
        colRows.forEach(function (r) {
            if (!r.node_id) return;
            (colsByNode[r.node_id] = colsByNode[r.node_id] || []).push({
                name: String(r.name || ''),
                type: String(r.type || ''),
                key: String(r.key || ''),
                set: String(r.set || '')
            });
        });

        var nodes = nodeRows.filter(function (r) { return r.id; }).map(function (r, i) {
            var tags = String(r.tags || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            var nodeId = String(r.id);
            var sets = setsByNode[nodeId] || [];
            var nodeCols = colsByNode[nodeId] || [];

            // Auto-create any property set referenced by a column but missing
            // from the PropertySets sheet — keeps imports forgiving.
            var seenSetNames = {};
            sets.forEach(function (s) { seenSetNames[s.name] = true; });
            nodeCols.forEach(function (c) {
                if (c.set && !seenSetNames[c.set]) {
                    sets.push({ name: c.set, label: '', description: '' });
                    seenSetNames[c.set] = true;
                }
            });

            return {
                id: nodeId,
                label: String(r.label || r.id),
                type: String(r.type || 'table'),
                system: String(r.system || ''),
                schema: String(r.schema || ''),
                x: Number(r.x) || (100 + i * 60),
                y: Number(r.y) || (100 + i * 60),
                tags: tags,
                propertySets: sets,
                columns: nodeCols
            };
        });

        var edges = edgeRows.filter(function (r) { return r.from && r.to; }).map(function (r, i) {
            return {
                id: String(r.id || ('e' + i)),
                from: String(r.from),
                to: String(r.to),
                label: String(r.label || '')
            };
        });

        return { nodes: nodes, edges: edges };
    }

    // ---- Util ----------------------------------------------------------

    function toast(msg, kind) {
        if (window.CanvasApp.App && window.CanvasApp.App.toast) {
            window.CanvasApp.App.toast(msg, kind);
        }
    }

    return {
        init: init,
        exportXlsx: exportXlsx
    };
})();
