/**
 * xlsx_io — Excel import/export and JSON download.
 *
 * Sheet names mirror the DB node kinds (docs/DATAMODEL.sql):
 *   system           per-system aggregates (derived from node.system)
 *   distribution     nodes of type table / view / api / file (kind=distribution)
 *   code_list        nodes of type codelist (kind=code_list)
 *   pset             the property-set / Datenpaket registry (kind=pset)
 *   attribute        every column across nodes (kind=attribute)
 *   source_structure per-node SAP substructure registry (auxiliary)
 *   edge             relations between nodes
 *
 * Import is forgiving:
 *   - Reads the `distribution` and `code_list` sheets; falls back to the
 *     pre-rename names (Tables / APIs / Files / ValueLists) so existing
 *     exports still load.
 *   - Per-row `type` column always wins over any sheet-level default.
 *   - Falls back to the legacy single `Nodes` sheet if nothing else matches.
 *   - Auto-creates property sets referenced by a column but missing from
 *     the pset sheet.
 *
 * Also exposes a JSON download (canvas.json) for round-tripping into the
 * git seed.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.XlsxIO = (function () {

    var State = null;
    var fileInput = null;

    // Current sheet names — match DB node kinds (docs/DATAMODEL.sql).
    var SHEET_SYSTEM           = 'system';
    var SHEET_DISTRIBUTION     = 'distribution';
    var SHEET_CODE_LIST        = 'code_list';
    var SHEET_PSET             = 'pset';
    var SHEET_ATTRIBUTE        = 'attribute';
    var SHEET_SOURCE_STRUCTURE = 'source_structure';
    var SHEET_EDGE             = 'edge';

    // Sheet name → implicit row type. The merged `distribution` sheet has no
    // single implicit type — rows must carry `type` (the export always writes
    // it). The pre-rename split sheets remain readable for backwards compat.
    var SHEET_TO_DEFAULT_TYPE = {
        'distribution': null,
        'code_list':    'codelist',
        // Pre-rename names — kept so older exports still import cleanly.
        'Tables':       'table',
        'APIs':         'api',
        'Files':        'file',
        'ValueLists':   'codelist',
        // Legacy single-sheet support
        'Nodes':        null
    };

    // First name in each list is the canonical (current) sheet name; the
    // remainder are accepted aliases for backwards compat on import.
    var DISTRIBUTION_SHEET_ALIASES = ['distribution', 'Tables', 'APIs', 'Files'];
    var CODE_LIST_SHEET_ALIASES    = ['code_list', 'ValueLists'];
    var PSET_SHEET_ALIASES         = ['pset', 'PropertySets'];
    var ATTRIBUTE_SHEET_ALIASES    = ['attribute', 'Attributes', 'Columns', 'columns'];
    var SOURCE_STRUCTURE_ALIASES   = ['source_structure', 'SourceStructures'];
    var EDGE_SHEET_ALIASES         = ['edge', 'Relations', 'Edges', 'edges'];
    var SYSTEM_SHEET_ALIASES       = ['system', 'Systems'];

    var NODE_HEADERS = ['id', 'label', 'type', 'system', 'schema', 'x', 'y', 'tags'];

    function init() {
        State = window.CanvasApp.State;
        // The legacy <input id="file-input"> still lives in the DOM but is
        // unused — the import flow now goes through the modal which has its
        // own scoped file input. Empty-canvas's "import" action also calls
        // btn-import.click(), so it ends up in openImportModal too.
        fileInput = document.getElementById('file-input');
        document.getElementById('btn-import').addEventListener('click', openImportModal);

        wireImportModal();
        wireExportDropdown();
    }

    // ---- Import modal --------------------------------------------------

    var modalEl       = null;
    var modalContent  = null;
    var modalState    = 'idle';   // 'idle' | 'pick' | 'parsing' | 'preview' | 'sending' | 'error'
    var modalMessage  = '';
    var parsedPayload = null;     // frontend-shape payload from parseWorkbook
    var parsedDiff    = null;     // { nodes, edges, sets } each { added, removed, updated, unchanged }
    var parsedFile    = null;     // { name, size }

    function wireImportModal() {
        modalEl      = document.getElementById('import-modal');
        modalContent = document.getElementById('import-modal-content');
        if (!modalEl) return;

        modalEl.addEventListener('click', function (e) {
            if (e.target.closest('[data-import-modal-close]')) closeImportModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalEl && !modalEl.hasAttribute('hidden')) {
                closeImportModal();
            }
        });
    }

    /**
     * Triggered from the toolbar Import button. Warns if the user is mid-edit
     * with unsaved changes, otherwise opens the modal in the pick state.
     */
    function openImportModal() {
        if (typeof XLSX === 'undefined') {
            toast('Excel-Bibliothek nicht geladen.', 'error');
            return;
        }
        if (State.hasUnsavedChanges && State.hasUnsavedChanges()) {
            var App = window.CanvasApp.App;
            var doOpen = function () { actuallyOpenImportModal(); };
            if (App && App.confirmDialog) {
                App.confirmDialog({
                    title: 'Ungespeicherte Änderungen verwerfen?',
                    body:  'Beim Importieren gehen alle ungespeicherten Änderungen verloren.',
                    confirmText: 'Fortfahren',
                    cancelText:  'Abbrechen',
                    danger: true
                }).then(function (ok) { if (ok) doOpen(); });
            } else {
                if (window.confirm('Ungespeicherte Änderungen verwerfen?')) doOpen();
            }
        } else {
            actuallyOpenImportModal();
        }
    }

    function actuallyOpenImportModal() {
        if (!modalEl) return;
        modalState = 'pick';
        modalMessage = '';
        parsedPayload = null;
        parsedDiff = null;
        parsedFile = null;
        modalEl.removeAttribute('hidden');
        document.body.classList.add('auth-modal-open');
        renderImportModal();
    }

    function closeImportModal() {
        if (!modalEl) return;
        modalEl.setAttribute('hidden', '');
        document.body.classList.remove('auth-modal-open');
        modalState = 'idle';
        parsedPayload = null;
        parsedDiff = null;
        parsedFile = null;
    }

    function renderImportModal() {
        if (!modalContent) return;
        if (modalState === 'pick' || modalState === 'parsing') {
            renderImportPick();
        } else if (modalState === 'preview' || modalState === 'sending' || modalState === 'error') {
            renderImportPreview();
        }
    }

    function renderImportPick() {
        var parsing = modalState === 'parsing';
        var errorBlock = modalMessage
            ? '<div class="auth-modal-status auth-modal-status-error">' + escapeHtml(modalMessage) + '</div>'
            : '';
        modalContent.innerHTML =
            '<h2 class="auth-modal-title" id="import-modal-title">Excel importieren</h2>' +
            '<p class="auth-modal-sub">Wählen Sie eine .xlsx-Datei (Export aus diesem Canvas) oder ziehen Sie sie ' +
                'auf das Feld unten. Der gesamte Canvas-Inhalt wird ersetzt.</p>' +
            '<div class="import-dropzone" id="import-dropzone">' +
                '<svg class="import-dropzone-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>' +
                '</svg>' +
                '<p class="import-dropzone-main">' + (parsing ? 'Datei wird gelesen…' : 'Excel-Datei hier fallen lassen') + '</p>' +
                (parsing ? '' :
                    '<p class="import-dropzone-or">oder <button type="button" class="import-pick-btn" id="import-pick-btn">Datei auswählen</button></p>') +
                '<input type="file" id="import-file-input" accept=".xlsx,.xls" hidden>' +
                '<p class="import-dropzone-hint">.xlsx · max. ~10 MB</p>' +
            '</div>' +
            errorBlock;

        var dz = modalContent.querySelector('#import-dropzone');
        var fi = modalContent.querySelector('#import-file-input');
        var pb = modalContent.querySelector('#import-pick-btn');
        if (pb) pb.addEventListener('click', function () { fi.value = ''; fi.click(); });
        if (fi) fi.addEventListener('change', function (e) {
            var f = e.target.files && e.target.files[0];
            if (f) handleImportFile(f);
        });
        if (dz) {
            ['dragenter', 'dragover'].forEach(function (ev) {
                dz.addEventListener(ev, function (e) {
                    e.preventDefault(); e.stopPropagation();
                    dz.classList.add('is-dragover');
                });
            });
            ['dragleave', 'drop'].forEach(function (ev) {
                dz.addEventListener(ev, function (e) {
                    e.preventDefault(); e.stopPropagation();
                    dz.classList.remove('is-dragover');
                });
            });
            dz.addEventListener('drop', function (e) {
                var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) handleImportFile(f);
            });
        }
    }

    function renderImportPreview() {
        if (!parsedDiff || !parsedFile) return;
        var sending = modalState === 'sending';
        var errorBlock = modalState === 'error'
            ? '<div class="auth-modal-status auth-modal-status-error">' + escapeHtml(modalMessage) + '</div>'
            : '';

        modalContent.innerHTML =
            '<h2 class="auth-modal-title" id="import-modal-title">Vorschau der Änderungen</h2>' +
            '<div class="import-summary-file">' +
                '<strong>' + escapeHtml(parsedFile.name) + '</strong>' +
                '<span>· ' + (parsedPayload.nodes.length) + ' Knoten · ' + (parsedPayload.edges.length) + ' Beziehungen</span>' +
            '</div>' +
            renderSummarySection('Knoten',       parsedDiff.nodes) +
            renderSummarySection('Beziehungen',  parsedDiff.edges) +
            renderSummarySection('Datenpakete',  parsedDiff.sets) +
            errorBlock +
            '<div class="import-modal-actions">' +
                '<button type="button" class="tb-btn" data-import-modal-close' + (sending ? ' disabled' : '') + '>Abbrechen</button>' +
                '<button type="button" class="tb-btn tb-btn-primary" id="import-confirm-btn"' + (sending ? ' disabled' : '') + '>' +
                    (sending ? 'Wird importiert…' : 'Importieren') +
                '</button>' +
            '</div>';

        var btn = modalContent.querySelector('#import-confirm-btn');
        if (btn) btn.addEventListener('click', onImportConfirm);
    }

    function renderSummarySection(title, diff) {
        return '<div class="import-summary-section">' +
            '<h3 class="import-summary-section-title">' + escapeHtml(title) + '</h3>' +
            '<div class="import-summary-counts">' +
                summaryCount('+', diff.added.length,     'hinzu',       'add') +
                summaryCount('~', diff.updated.length,   'ändern',      'update') +
                summaryCount('−', diff.removed.length,   'entfernen',   'remove') +
                summaryCount('=', diff.unchanged.length, 'unverändert', 'same') +
            '</div>' +
        '</div>';
    }

    function summaryCount(prefix, count, label, kind) {
        return '<div class="import-summary-count import-summary-count-' + kind + '">' +
            '<span class="import-summary-count-num">' + (kind === 'same' ? '' : prefix) + count + '</span>' +
            '<span class="import-summary-count-label">' + escapeHtml(label) + '</span>' +
        '</div>';
    }

    function handleImportFile(file) {
        if (!file) return;
        if (typeof XLSX === 'undefined') {
            toast('Excel-Bibliothek nicht geladen.', 'error');
            return;
        }
        modalState = 'parsing';
        modalMessage = '';
        renderImportModal();

        var reader = new FileReader();
        reader.onload = function (ev) {
            try {
                var wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
                var parsed = parseWorkbook(wb);
                if (!parsed.nodes.length) {
                    modalState = 'pick';
                    modalMessage = 'Keine Knoten in den Excel-Blättern gefunden.';
                    renderImportModal();
                    return;
                }
                parsedPayload = parsed;
                parsedFile = { name: file.name, size: file.size };
                parsedDiff = computeImportDiff(State, parsed);
                modalState = 'preview';
                renderImportModal();
            } catch (err) {
                console.error(err);
                modalState = 'pick';
                modalMessage = 'Datei konnte nicht gelesen werden: ' + (err.message || 'unbekannter Fehler');
                renderImportModal();
            }
        };
        reader.onerror = function () {
            modalState = 'pick';
            modalMessage = 'Datei konnte nicht gelesen werden.';
            renderImportModal();
        };
        reader.readAsArrayBuffer(file);
    }

    function onImportConfirm() {
        if (modalState === 'sending' || !parsedPayload) return;
        // Snapshot the change-count *before* the request — closeImportModal
        // nulls parsedDiff, so reading it in the .then() callback crashes.
        var totalChanges = totalChangeCount(parsedDiff);
        modalState = 'sending';
        modalMessage = '';
        renderImportModal();
        State.commitImport(parsedPayload).then(function () {
            closeImportModal();
            toast('Import erfolgreich · ' + totalChanges + ' Änderungen', 'success');
        }).catch(function (err) {
            console.error('Import failed', err);
            modalState = 'error';
            modalMessage = friendlyImportError(err);
            renderImportModal();
        });
    }

    function totalChangeCount(diff) {
        if (!diff) return 0;
        return diff.nodes.added.length + diff.nodes.updated.length + diff.nodes.removed.length +
               diff.edges.added.length + diff.edges.updated.length + diff.edges.removed.length +
               diff.sets.added.length  + diff.sets.updated.length  + diff.sets.removed.length;
    }

    /**
     * Categorise the parsed payload against the current State. Same key
     * conventions as the DB:
     *   - nodes by `id` (slug-without-prefix)
     *   - edges by from+to+label (edges have no stable id from the user side)
     *   - sets by `id`
     * Updated vs unchanged is decided by a JSON fingerprint of the
     * user-meaningful fields — internal coords (x,y) are intentionally
     * excluded from "changed" detection so re-importing a file you just
     * exported doesn't show every node as updated.
     */
    function computeImportDiff(State, parsed) {
        var current = {
            nodes: State.getNodes ? State.getNodes() : [],
            edges: State.getEdges ? State.getEdges() : [],
            sets:  State.getSets  ? State.getSets()  : []
        };
        return {
            nodes: diffSet(current.nodes, parsed.nodes || [], nodeKey, nodeFingerprint),
            edges: diffSet(current.edges, parsed.edges || [], edgeKey, edgeFingerprint),
            sets:  diffSet(current.sets,  parsed.sets  || [], setKey,  setFingerprint)
        };
    }

    function diffSet(currentArr, parsedArr, keyFn, fingerprintFn) {
        var added = [], removed = [], updated = [], unchanged = [];
        var currentByKey = Object.create(null);
        var parsedByKey  = Object.create(null);
        currentArr.forEach(function (e) { currentByKey[keyFn(e)] = e; });
        parsedArr.forEach(function (e)  { parsedByKey[keyFn(e)]  = e; });
        Object.keys(parsedByKey).forEach(function (k) {
            if (!(k in currentByKey)) added.push(parsedByKey[k]);
            else if (fingerprintFn(currentByKey[k]) !== fingerprintFn(parsedByKey[k])) updated.push(parsedByKey[k]);
            else unchanged.push(parsedByKey[k]);
        });
        Object.keys(currentByKey).forEach(function (k) {
            if (!(k in parsedByKey)) removed.push(currentByKey[k]);
        });
        return { added: added, removed: removed, updated: updated, unchanged: unchanged };
    }

    function nodeKey(n) { return String(n.id || ''); }
    function nodeFingerprint(n) {
        return JSON.stringify({
            id:     n.id || '',
            type:   n.type || '',
            label:  n.label || '',
            system: n.system || '',
            schema: n.schema || '',
            tags:   (n.tags || []).slice().sort(),
            columns: (n.columns || []).map(function (c) {
                return {
                    name:            c.name || '',
                    type:            c.type || '',
                    key:             c.key || '',
                    setId:           c.setId || '',
                    sourceStructure: c.sourceStructure || ''
                };
            })
        });
    }
    function edgeKey(e) { return [(e.from || ''), (e.to || ''), (e.label || '')].join('|'); }
    function edgeFingerprint(e) {
        return JSON.stringify({ from: e.from || '', to: e.to || '', label: e.label || '' });
    }
    function setKey(s) { return String(s.id || ''); }
    function setFingerprint(s) {
        return JSON.stringify({
            id: s.id || '', label: s.label || '',
            description: s.description || '', lineage: s.lineage || ''
        });
    }

    function friendlyImportError(err) {
        var msg = err && err.message ? String(err.message) : '';
        if (/42501|forbidden|editor or admin/i.test(msg))
            return 'Sie haben keine Berechtigung, Daten zu importieren.';
        if (/network|fetch|failed to fetch/i.test(msg))
            return 'Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.';
        if (/canvas not found/i.test(msg))
            return 'Canvas wurde nicht gefunden — vermutlich gelöscht.';
        return msg || 'Import fehlgeschlagen.';
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

        // system — derived overview, one row per node.system value.
        var systemRows = buildSystemRows(nodes);
        XLSX.utils.book_append_sheet(wb, sheetFromRows(systemRows,
            ['name', 'nodes', 'tables', 'apis', 'files', 'valuelists', 'sets', 'attributes', 'tags']),
            SHEET_SYSTEM);

        // distribution — nodes of type table / view / api / file (DB kind=distribution).
        // Codelists go to the code_list sheet (a separate kind in the DB).
        var distRows = nodes
            .filter(typeIn(['table', 'view', 'api', 'file']))
            .map(nodeToRow);
        XLSX.utils.book_append_sheet(wb, sheetFromRows(distRows, NODE_HEADERS), SHEET_DISTRIBUTION);

        // code_list — codelist nodes (DB kind=code_list).
        var codeListRows = nodes.filter(typeIn(['codelist'])).map(nodeToRow);
        XLSX.utils.book_append_sheet(wb, sheetFromRows(codeListRows, NODE_HEADERS), SHEET_CODE_LIST);

        // pset — the global property-set / Datenpaket registry. Authoritative
        // on import; round-trips so an Excel-edited registry can be reloaded.
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
            SHEET_PSET);

        // source_structure — per-node SAP BAPI substructure registry. Currently
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
            SHEET_SOURCE_STRUCTURE);

        // attribute — every column across nodes. set_id references the
        // pset sheet; source_structure references source_structure.
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
            SHEET_ATTRIBUTE);

        // edge — relations between nodes.
        var edgeRows = State.getEdges().map(function (e) {
            return { id: e.id, from: e.from, to: e.to, label: e.label || '' };
        });
        XLSX.utils.book_append_sheet(wb,
            sheetFromRows(edgeRows, ['id', 'from', 'to', 'label']),
            SHEET_EDGE);

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
    // The import flow is owned by the modal block above (openImportModal,
    // handleImportFile, onImportConfirm). This section provides parsing
    // helpers that the modal calls.

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
        // Sheet name + the implicit type rows on it should default to. The
        // current export writes one merged `distribution` sheet (rows carry
        // their own `type`) and a separate `code_list` sheet. Pre-rename
        // exports kept four typed sheets — read those as a fallback so older
        // exports still load. First match per id wins, so the new sheets are
        // listed before the legacy ones.
        var TYPED_SHEETS = [
            'distribution',
            'code_list',
            // pre-rename fallbacks
            'Tables', 'APIs', 'Files', 'ValueLists'
        ];
        var nodes = [];
        var seenIds = {};
        var sawLegacySheet = false;

        TYPED_SHEETS.forEach(function (sheetName) {
            var ws = findSheet(wb, [sheetName]);
            if (!ws) return;
            if (sheetName !== 'distribution' && sheetName !== 'code_list') {
                sawLegacySheet = true;
            }
            var defaultType = SHEET_TO_DEFAULT_TYPE[sheetName];
            XLSX.utils.sheet_to_json(ws, { defval: '' }).forEach(function (r) {
                if (!r.id) return;
                if (seenIds[r.id]) return; // first sheet wins (avoid duplicates)
                seenIds[r.id] = true;
                nodes.push(rowToNode(r, defaultType));
            });
        });

        if (sawLegacySheet) {
            console.warn('Import: pre-rename sheet names detected (Tables / APIs / Files / ValueLists). Workbook will be re-emitted with the current names (distribution / code_list) on the next export.');
        }

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
        var setsSheet = findSheet(wb, PSET_SHEET_ALIASES);
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
        var ssSheet = findSheet(wb, SOURCE_STRUCTURE_ALIASES);
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
        var colsSheet = findSheet(wb, ATTRIBUTE_SHEET_ALIASES);
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

        // edge sheet (with pre-rename fallbacks).
        var edgesSheet = findSheet(wb, EDGE_SHEET_ALIASES);
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

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    return { init: init, exportXlsx: exportXlsx, exportJson: exportJson };
})();
