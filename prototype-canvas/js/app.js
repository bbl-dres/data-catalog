/**
 * App — bootstrap. Wires the view tabs, mode toggle, search, toast helper,
 * and kicks off the initial render once state has loaded.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.App = (function () {

    var State = null;

    var toastEl = null;
    var toastTimer = null;

    function init() {
        State = window.CanvasApp.State;

        wireViewTabs();
        wireEditButtons();
        wireSearch();
        wireUrlSync();
        wireGlobalKeys();
        wireUserMenu();
        wireCanvasEmpty();

        State.on(function (reason) {
            if (reason === 'view') {
                applyViewVisibility();
            }
            if (reason === 'view' || reason === 'selection' || reason === 'filter' ||
                reason === 'replace' || reason === 'reset') {
                // 'replace'/'reset' included so an import (which clears
                // selection in state) also strips a stale `selected=` from
                // the URL — otherwise a refresh would re-apply a ghost.
                syncStateToUrl();
            }
            // Save-button affordance reflects draft dirtiness across every
            // mutation — nodes/edges/replace plus mode toggles.
            updateSaveAffordance();
            updateCanvasEmpty();
        });

        return State.load().then(function () {
            // Apply the URL's view/selection on top of what was loaded from
            // localStorage. URL wins so shared links land you exactly where
            // the sender was.
            applyUrlToState();
            applyViewVisibility();
            window.CanvasApp.Canvas.renderAll();
            // After renderAll, apply filter dim if URL carried filters.
            if (State.hasActiveFilters() && window.CanvasApp.Canvas.applyFilterDim) {
                window.CanvasApp.Canvas.applyFilterDim();
            }
            window.CanvasApp.Table.render();
            window.CanvasApp.Api.render();
            window.CanvasApp.Panel.render();
            updateSaveAffordance();
            updateCanvasEmpty();
            // Fit on first paint
            // Double rAF — first frame paints the freshly-rendered DOM,
            // second frame fires after layout has been computed. Single
            // rAF was racing layout on heavy initial trees and producing
            // a stale 0×0 rect inside fitToScreen.
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    window.CanvasApp.Canvas.fitToScreen();
                });
            });
        });
    }

    // ---- URL sync ------------------------------------------------------
    // Hash format:
    //   #/diagram                       view, no selection
    //   #/diagram?selected=<nodeId>     view + selected node
    //   #/table                         view (no selection)
    //   #/api                           view (selection ignored — no panel)

    var applyingUrl = false;
    var VALID_VIEWS = { diagram: 1, table: 1, api: 1 };

    function wireUrlSync() {
        window.addEventListener('hashchange', applyUrlToState);
    }

    /**
     * Parse the URL hash into { view, selection }. Selection encoding:
     *   ?selected=node:<id>            (unprefixed = node — backwards compat)
     *   ?selected=edge:<id>
     *   ?selected=system:<name>
     *   ?selected=attr:<nodeId>|<columnName>
     * All values are URL-decoded; the kind prefix is parsed off first.
     */
    function parseUrl() {
        var raw = (window.location.hash || '').replace(/^#\/?/, '');
        var qIdx = raw.indexOf('?');
        var path = qIdx === -1 ? raw : raw.slice(0, qIdx);
        var query = qIdx === -1 ? '' : raw.slice(qIdx + 1);
        var view = VALID_VIEWS[path] ? path : null;
        var selectedRaw = null;
        // Filter values keyed by dimension. Comma-separated values; URL-decode
        // each part. Empty string → empty filter (explicit clear).
        var filters = {}; // key (without 'f.' prefix) → string[] | undefined
        query.split('&').forEach(function (kv) {
            if (!kv) return;
            var eq = kv.indexOf('=');
            var k = eq === -1 ? kv : kv.slice(0, eq);
            var v = eq === -1 ? '' : decodeURIComponent(kv.slice(eq + 1));
            if (k === 'selected') {
                selectedRaw = v || null;
            } else if (k.indexOf('f.') === 0) {
                var dim = k.slice(2);
                filters[dim] = v ? v.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
            }
        });
        var selection = decodeSelection(selectedRaw);
        return { view: view, selection: selection, filters: filters };
    }

    function decodeSelection(raw) {
        if (raw == null) return undefined; // no key in URL — leave state alone
        if (raw === '') return null;        // explicit clear
        var colon = raw.indexOf(':');
        var kind = colon === -1 ? 'node' : raw.slice(0, colon);
        var value = colon === -1 ? raw : raw.slice(colon + 1);
        if (kind === 'node' || kind === 'edge' || kind === 'set') return { kind: kind, id: value };
        if (kind === 'system') return { kind: 'system', name: value };
        if (kind === 'attr' || kind === 'attribute') {
            var pipe = value.indexOf('|');
            // Malformed attribute selector — leave state alone rather than
            // silently clearing whatever was selected.
            if (pipe === -1) return undefined;
            return { kind: 'attribute', nodeId: value.slice(0, pipe), name: value.slice(pipe + 1) };
        }
        // Unknown kind — treat as missing key, not as explicit clear.
        console.warn('Ignoring unknown selection kind in URL:', kind);
        return undefined;
    }

    function encodeSelection(sel) {
        if (!sel) return null;
        if (sel.kind === 'node')      return 'node:' + sel.id;
        if (sel.kind === 'edge')      return 'edge:' + sel.id;
        if (sel.kind === 'set')       return 'set:' + sel.id;
        if (sel.kind === 'system')    return 'system:' + sel.name;
        if (sel.kind === 'attribute') return 'attr:' + sel.nodeId + '|' + sel.name;
        return null;
    }

    function buildUrl(view, selection, filters) {
        var hash = '#/' + (view || 'diagram');
        var params = [];
        var encoded = encodeSelection(selection);
        if (encoded) params.push('selected=' + encodeURIComponent(encoded));
        if (filters) {
            // Stable order so the URL is deterministic across renders.
            State.getFilterDimensions().forEach(function (dim) {
                var vals = filters[dim] || [];
                if (!vals.length) return;
                var encodedVals = vals.map(encodeURIComponent).join(',');
                params.push('f.' + dim + '=' + encodedVals);
            });
        }
        if (params.length) hash += '?' + params.join('&');
        return hash;
    }

    function applyUrlToState() {
        var url = parseUrl();
        if (!url.view && url.selection === undefined &&
            Object.keys(url.filters).length === 0 && !window.location.hash) return;
        applyingUrl = true;
        try {
            if (url.view) State.setView(url.view);
            // url.selection: undefined = no key, null = explicit clear, object = set
            if (url.selection !== undefined) State.setSelection(url.selection);
            // Filters: only the dimensions present in the URL get reset.
            // Missing keys leave the existing in-memory filter alone (so
            // back-button + a partial URL doesn't clobber unrelated filters).
            // Empty string ("f.system=") explicitly clears that dimension.
            State.getFilterDimensions().forEach(function (dim) {
                if (url.filters.hasOwnProperty(dim)) State.setFilter(dim, url.filters[dim]);
            });
        } finally {
            applyingUrl = false;
        }
        // Drop a selection that points at something this catalog doesn't
        // contain (stale shared link, or post-import refresh). pruneSelection
        // emits 'selection' on change, which is now also a sync trigger, so
        // the URL self-corrects and panels re-render.
        State.pruneSelection();
    }

    function syncStateToUrl() {
        if (applyingUrl) return;
        var newHash = buildUrl(State.getView(), State.getSelection(), State.getFilters());
        if (window.location.hash === newHash) return;
        history.replaceState(null, '', newHash);
    }

    function wireViewTabs() {
        var seg = document.getElementById('view-seg');
        seg.addEventListener('click', function (e) {
            var btn = e.target.closest('.seg-btn');
            if (!btn) return;
            var view = btn.getAttribute('data-view');
            State.setView(view);
        });
    }

    function applyViewVisibility() {
        var view = State.getView();
        document.querySelectorAll('#view-seg .seg-btn').forEach(function (b) {
            var active = b.getAttribute('data-view') === view;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.querySelectorAll('.view').forEach(function (v) {
            v.classList.toggle('is-active', v.getAttribute('data-view') === view);
        });
    }

    function wireEditButtons() {
        document.getElementById('btn-edit').addEventListener('click', function () {
            State.setMode('edit');
        });

        document.getElementById('btn-cancel').addEventListener('click', function () {
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
            if (State.hasUnsavedChanges() && !confirm('Ungespeicherte Änderungen verwerfen?')) {
                return;
            }
            State.revertDraft();
            State.setMode('view');
        });

        document.getElementById('btn-save').addEventListener('click', function () {
            // Make sure pending text edits commit first
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
            if (!State.hasUnsavedChanges()) {
                State.setMode('view');
                return;
            }
            // No confirm — saving is non-destructive. Toast acknowledges.
            var n = State.getUnsavedChangeCount();
            State.commitDraft();
            State.setMode('view');
            toast(n === 1 ? '1 Änderung gespeichert' : n + ' Änderungen gespeichert', 'success');
        });

        // Esc anywhere outside an input reverts the draft and exits edit mode.
        // Inputs / contenteditable elements consume their own Escape (blur + revert
        // text); a second Escape — once focus returns to body — exits the mode.
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (State.getMode() !== 'edit') return;
            var t = e.target;
            if (t && t.matches && t.matches('input, textarea, select, [contenteditable="true"]')) return;

            if (State.hasUnsavedChanges() && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
            State.revertDraft();
            State.setMode('view');
        });
    }

    /**
     * Global keyboard shortcuts that aren't tied to a specific surface.
     * Per-surface shortcuts (Esc to exit edit, Delete to remove selection)
     * stay where they are.
     *
     *   /        focus the header search (skipped while typing in a field)
     *   ?        toast the shortcut cheat-sheet
     *   Ctrl+S   save the draft (edit mode only)
     *   Ctrl+Z   undo last destructive edit (handled in Editor)
     */
    function wireGlobalKeys() {
        document.addEventListener('keydown', function (e) {
            var typing = isTypingInField(e.target);

            if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                var input = document.getElementById('search-input');
                if (input) input.focus();
                return;
            }

            if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                toast(
                    'Tastenkürzel: / Suche · Strg+S Speichern · Strg+Z Rückgängig · Esc Abbrechen · Entf Auswahl löschen',
                    'success'
                );
                return;
            }

            if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
                if (State.getMode() !== 'edit') return;
                e.preventDefault();
                var saveBtn = document.getElementById('btn-save');
                if (saveBtn && !saveBtn.disabled) saveBtn.click();
                return;
            }

            if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
                if (State.getMode() !== 'edit') return;
                if (typing) return; // browser handles inline text undo
                e.preventDefault();
                if (!State.canUndo()) {
                    toast('Nichts zum Rückgängigmachen', 'success');
                    return;
                }
                var label = State.undo();
                toast('Rückgängig: ' + (label || 'letzte Aktion'), 'success');
            }
        });
    }

    function isTypingInField(t) {
        if (!t || !t.matches) return false;
        return t.matches('input, textarea, select, [contenteditable="true"]');
    }

    function wireUserMenu() {
        var btn = document.getElementById('user-avatar-btn');
        var dd  = document.getElementById('user-dropdown');
        if (!btn || !dd) return;
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = dd.hasAttribute('hidden');
            if (open) {
                dd.removeAttribute('hidden');
                btn.setAttribute('aria-expanded', 'true');
            } else {
                dd.setAttribute('hidden', '');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('click', function (e) {
            if (dd.hasAttribute('hidden')) return;
            if (e.target.closest('.user-menu')) return;
            dd.setAttribute('hidden', '');
            btn.setAttribute('aria-expanded', 'false');
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !dd.hasAttribute('hidden')) {
                dd.setAttribute('hidden', '');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function wireCanvasEmpty() {
        var empty = document.getElementById('canvas-empty');
        if (!empty) return;
        empty.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-empty-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-empty-action');
            if (action === 'import') {
                document.getElementById('btn-import').click();
            } else if (action === 'add') {
                State.setMode('edit');
                // Fire a synthetic palette click for "Tabelle" — best entry point.
                var paletteBtn = document.querySelector('#entity-palette [data-add-type="table"]');
                if (paletteBtn) paletteBtn.click();
            }
        });
    }

    function updateCanvasEmpty() {
        var empty = document.getElementById('canvas-empty');
        if (!empty) return;
        var hasNodes = State.getNodes().length > 0;
        if (hasNodes) empty.setAttribute('hidden', '');
        else          empty.removeAttribute('hidden');
    }

    /**
     * Reflect draft dirtiness on the Save button + the unsaved-changes
     * counter. Called on every state event so it stays in sync with edits,
     * undo, and mode toggles.
     */
    function updateSaveAffordance() {
        var saveBtn = document.getElementById('btn-save');
        var indicator = document.getElementById('unsaved-indicator');
        if (!saveBtn || !indicator) return;
        var inEdit = State.getMode() === 'edit';
        var n = inEdit ? State.getUnsavedChangeCount() : 0;
        saveBtn.disabled = n === 0;
        if (n === 0) {
            indicator.setAttribute('hidden', '');
            indicator.textContent = '';
        } else {
            indicator.removeAttribute('hidden');
            indicator.textContent = n === 1 ? '1 ungespeicherte Änderung' : n + ' ungespeicherte Änderungen';
        }
    }

    var KIND_ICONS = {
        node:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>',
        attribute: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>',
        system:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>'
    };
    var TYPE_LABELS_LOCAL = {
        table: 'Tabelle', view: 'View', api: 'API', file: 'Datei', codelist: 'Werteliste'
    };

    function wireSearch() {
        var input = document.getElementById('search-input');
        var dropdown = document.getElementById('search-dropdown');
        if (!input || !dropdown) return;

        var activeIdx = -1;
        var currentItems = [];
        var searchDebounceTimer = null;

        function runSearch() {
            var q = input.value.trim();
            // buildRecommendations already iterates every node + column. Have
            // it return the matched-id Set in the same pass, so highlight no
            // longer re-walks the graph.
            var built = q ? buildRecommendations(q) : { items: [], matchIds: null };
            currentItems = built.items;
            highlightMatches(built.matchIds);
            activeIdx = -1;
            renderDropdown(currentItems, dropdown);
            setExpanded(input, !!q);
        }

        input.addEventListener('input', function () {
            // Debounce: a fast typer would otherwise re-iterate the whole
            // graph (and touch every .node element) on every keystroke.
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(runSearch, 80);
        });

        input.addEventListener('focus', function () {
            if (input.value.trim()) {
                renderDropdown(currentItems, dropdown);
                setExpanded(input, true);
            }
        });

        // Click on a row → trigger that recommendation
        dropdown.addEventListener('mousedown', function (e) {
            var btn = e.target.closest('[data-rec-idx]');
            if (!btn) return;
            e.preventDefault(); // keep input focused so blur doesn't fire first
            var i = Number(btn.getAttribute('data-rec-idx'));
            applyRecommendation(currentItems[i], input);
        });

        // Close on outside click
        document.addEventListener('click', function (e) {
            if (e.target.closest('.header-search')) return;
            closeSearchDropdown(dropdown, input);
        });

        // Keyboard: Esc closes, ↑/↓ navigate, Enter applies active
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                input.value = '';
                highlightMatches('');
                closeSearchDropdown(dropdown, input);
                input.blur();
                return;
            }
            if (!currentItems.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIdx = (activeIdx + 1) % currentItems.length;
                updateActiveRow(dropdown, activeIdx);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIdx = (activeIdx - 1 + currentItems.length) % currentItems.length;
                updateActiveRow(dropdown, activeIdx);
            } else if (e.key === 'Enter' && activeIdx >= 0) {
                e.preventDefault();
                applyRecommendation(currentItems[activeIdx], input);
            }
        });
    }

    function setExpanded(input, expanded) {
        input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function closeSearchDropdown(dropdown, input) {
        dropdown.setAttribute('hidden', '');
        if (input) setExpanded(input, false);
    }

    function buildRecommendations(query) {
        var q = query.toLowerCase();
        var nodes = State.getNodes();
        var nodeHits = [], systemHits = [], attrHits = [];
        var seenSystems = {};
        var matchIds = new Set(); // shared with highlightMatches — single graph walk

        nodes.forEach(function (n) {
            var label = (n.label || n.id || '').toLowerCase();
            var id    = (n.id || '').toLowerCase();
            var nodeMatches = label.indexOf(q) !== -1 || id.indexOf(q) !== -1;
            if (nodeMatches) {
                nodeHits.push({
                    kind: 'node',
                    label: n.label || n.id,
                    sub: typeLabelLocal(n.type) + (n.system ? ' · ' + n.system : ''),
                    nodeId: n.id
                });
                matchIds.add(n.id);
            }
            var sysMatches = n.system && n.system.toLowerCase().indexOf(q) !== -1;
            if (sysMatches) matchIds.add(n.id);
            var attrMatches = false;
            var ncols = n.columns || [];
            for (var i = 0; i < ncols.length; i++) {
                var c = ncols[i];
                if ((c.name || '').toLowerCase().indexOf(q) !== -1) {
                    attrHits.push({
                        kind: 'attribute',
                        label: c.name,
                        sub: (n.label || n.id) + (n.system ? ' · ' + n.system : ''),
                        nodeId: n.id,
                        attrName: c.name
                    });
                    attrMatches = true;
                }
            }
            if (attrMatches) matchIds.add(n.id);
            if (sysMatches && !seenSystems[n.system]) {
                seenSystems[n.system] = true;
                systemHits.push({
                    kind: 'system',
                    label: n.system,
                    sub: 'System',
                    systemName: n.system
                });
            }
        });

        // Cap each kind so attribute-heavy queries don't push out node/system hits.
        var items = nodeHits.slice(0, 5)
            .concat(systemHits.slice(0, 3))
            .concat(attrHits.slice(0, 8));
        return { items: items, matchIds: matchIds };
    }

    function typeLabelLocal(t) {
        return TYPE_LABELS_LOCAL[t] || t || 'Knoten';
    }

    function renderDropdown(items, dropdown) {
        if (!items.length) {
            dropdown.innerHTML = '<div class="search-empty">Keine Treffer</div>';
            dropdown.removeAttribute('hidden');
            return;
        }
        dropdown.innerHTML = items.map(function (it, i) {
            return '<button type="button" class="search-row" role="option" data-rec-idx="' + i + '">' +
                '<span class="search-row-kind">' + (KIND_ICONS[it.kind] || '') + '</span>' +
                '<span class="search-row-text">' +
                    '<strong>' + escapeHtml(it.label) + '</strong>' +
                    '<em>' + escapeHtml(it.sub) + '</em>' +
                '</span>' +
            '</button>';
        }).join('');
        dropdown.removeAttribute('hidden');
    }

    function updateActiveRow(dropdown, idx) {
        Array.prototype.forEach.call(dropdown.querySelectorAll('.search-row'), function (row, i) {
            row.classList.toggle('is-active', i === idx);
            if (i === idx) row.scrollIntoView({ block: 'nearest' });
        });
    }

    function applyRecommendation(rec, input) {
        if (!rec) return;
        if (rec.kind === 'node')      State.setSelected(rec.nodeId);
        else if (rec.kind === 'system')    State.setSelectedSystem(rec.systemName);
        else if (rec.kind === 'attribute') State.setSelectedAttribute(rec.nodeId, rec.attrName);
        // Clear search after selection so the dropdown closes naturally
        input.value = '';
        highlightMatches(null);
        closeSearchDropdown(document.getElementById('search-dropdown'), input);
        input.blur();
        // Switch to diagram view if currently in API view (no selection panel there)
        if (State.getView() === 'api') State.setView('diagram');
    }

    /**
     * Dim non-matching nodes on the canvas. `matchIds` is a Set built by
     * buildRecommendations in the same pass — passing null clears the dim.
     * Skips writes for nodes whose state didn't change so opacity isn't
     * touched on every keystroke for the entire graph.
     */
    function highlightMatches(matchIds) {
        document.querySelectorAll('.node').forEach(function (el) {
            var id = el.getAttribute('data-node-id');
            var dim = matchIds && !matchIds.has(id);
            var current = el.style.opacity;
            var next = dim ? '0.3' : '';
            if (current !== next) el.style.opacity = next;
        });
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ---- Toast helper --------------------------------------------------

    function toast(msg, kind) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'toast';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg;
        toastEl.classList.remove('is-error', 'is-success');
        if (kind === 'error') toastEl.classList.add('is-error');
        if (kind === 'success') toastEl.classList.add('is-success');
        // force reflow then animate
        // eslint-disable-next-line no-unused-expressions
        toastEl.offsetHeight;
        toastEl.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toastEl.classList.remove('is-visible');
        }, 2400);
    }

    // ---- Custom confirm dialog -----------------------------------------
    // Promise-based replacement for native confirm() — used for genuinely
    // destructive non-undoable actions (e.g. Excel import replaces all).
    // Returns a Promise<boolean>.
    function confirmDialog(opts) {
        opts = opts || {};
        var title       = opts.title       || 'Bestätigen';
        var body        = opts.body        || '';
        var confirmText = opts.confirmText || 'Bestätigen';
        var cancelText  = opts.cancelText  || 'Abbrechen';
        var danger      = opts.danger !== false; // default to danger styling

        return new Promise(function (resolve) {
            var overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML =
                '<div class="confirm-card">' +
                    '<h3 class="confirm-title">' + escapeHtml(title) + '</h3>' +
                    '<p class="confirm-body">' + escapeHtml(body) + '</p>' +
                    '<div class="confirm-actions">' +
                        '<button type="button" class="tb-btn" data-confirm-action="cancel">' + escapeHtml(cancelText) + '</button>' +
                        '<button type="button" class="tb-btn ' + (danger ? 'tb-btn-danger' : 'tb-btn-primary') + '" data-confirm-action="confirm">' + escapeHtml(confirmText) + '</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(overlay);
            // Focus the confirm button so Enter resolves true and Esc resolves false.
            requestAnimationFrame(function () {
                overlay.classList.add('is-visible');
                var btn = overlay.querySelector('[data-confirm-action="confirm"]');
                if (btn) btn.focus();
            });

            function close(result) {
                overlay.classList.remove('is-visible');
                setTimeout(function () { overlay.remove(); }, 150);
                document.removeEventListener('keydown', onKey, true);
                resolve(result);
            }
            overlay.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-confirm-action]');
                if (btn) return close(btn.getAttribute('data-confirm-action') === 'confirm');
                if (e.target === overlay) close(false);
            });
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); close(false); }
                else if (e.key === 'Enter') { e.preventDefault(); close(true); }
            }
            document.addEventListener('keydown', onKey, true);
        });
    }

    return {
        init: init,
        toast: toast,
        confirmDialog: confirmDialog
    };
})();

// Bootstrap
document.addEventListener('DOMContentLoaded', function () {
    window.CanvasApp.Canvas.init();
    window.CanvasApp.Editor.init();
    window.CanvasApp.Table.init();
    window.CanvasApp.Api.init();
    window.CanvasApp.Panel.init();
    window.CanvasApp.Filter.init();
    window.CanvasApp.XlsxIO.init();
    window.CanvasApp.App.init();
});
