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
        wireCanvasEmpty();
        wireHomeLink();
        wireAuthRefresh();

        State.on(function (reason) {
            if (reason === 'view' || reason === 'canvas') {
                applyViewVisibility();
                renderBreadcrumb();
            }
            if (reason === 'view' || reason === 'selection' || reason === 'filter' ||
                reason === 'replace' || reason === 'reset' || reason === 'canvas') {
                syncStateToUrl();
            }
            updateSaveAffordance();
            updateCanvasEmpty();
        });

        wireLoadErrorRetry();

        // Apply the URL into state BEFORE the first load so the dispatcher in
        // State.load() picks the right code path (overview vs canvas).
        applyUrlToState();
        applyViewVisibility();
        renderBreadcrumb();

        return loadAndRender();
    }

    /**
     * Fetches whatever the current state says is needed (canvas list when
     * view='overview', canvas content otherwise) and re-renders the
     * appropriate view. Single code path used by init AND by hashchange so
     * URL navigation and first paint share behaviour.
     */
    function loadAndRender() {
        return State.load().then(function () {
            applyLoadError();
            renderBreadcrumb();
            if (State.getLoadError()) return;
            if (State.getView() === 'overview') {
                window.CanvasApp.Overview.render();
                return;
            }
            window.CanvasApp.Canvas.renderAll();
            if (State.hasActiveFilters() && window.CanvasApp.Canvas.applyFilterDim) {
                window.CanvasApp.Canvas.applyFilterDim();
            }
            window.CanvasApp.Table.render();
            window.CanvasApp.Api.render();
            window.CanvasApp.Panel.render();
            window.CanvasApp.Minimap.render();
            updateSaveAffordance();
            updateCanvasEmpty();
            // Initial framing on first paint. goHome applies the curator's
            // saved Home view if present, otherwise falls back to
            // initialView (fit-with-floor, never below 25%). Double rAF —
            // first frame paints the freshly-rendered DOM, second frame
            // fires after layout has been computed.
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    window.CanvasApp.Canvas.goHome();
                });
            });
        });
    }

    /** Update the breadcrumb's "current canvas" text + visibility pill from state. */
    function renderBreadcrumb() {
        var labelEl = document.getElementById('toolbar-canvas-label');
        var visEl   = document.getElementById('toolbar-canvas-visibility');
        if (!labelEl) return;
        if (State.getView() === 'overview') {
            labelEl.textContent = '';
            if (visEl) visEl.setAttribute('hidden', '');
            return;
        }
        // Prefer the freshly-loaded current canvas; fall back to the overview
        // list match by slug; last resort, the slug itself.
        var c = State.getCurrentCanvas();
        var label = c && c.label ? c.label : null;
        var vis   = c && c.visibility ? c.visibility : null;
        if (!label || !vis) {
            var slug = State.getCurrentCanvasSlug();
            var match = (State.getCanvases() || []).find(function (x) { return x.slug === slug; });
            if (match) {
                if (!label) label = match.label_de || slug;
                if (!vis)   vis   = match.visibility;
            }
            if (!label) label = slug || '';
        }
        labelEl.textContent = label;

        if (visEl) {
            // Each variant carries a leading SVG icon (globe / lock) so the
            // public-vs-restricted distinction is conveyed by shape, not just
            // colour — passes WCAG 1.4.1 (no info via colour alone).
            // aria-hidden="true" on the icon so screen readers don't double-
            // announce it; the visible text already says "öffentlich" /
            // "Nur intern".
            var GLOBE_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
            var LOCK_ICON  = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
            if (vis === 'public') {
                visEl.innerHTML = GLOBE_ICON + '<span>öffentlich</span>';
                visEl.className = 'toolbar-canvas-visibility is-public';
                visEl.title = 'Auch ohne Anmeldung lesbar';
                visEl.removeAttribute('hidden');
            } else if (vis === 'restricted') {
                visEl.innerHTML = LOCK_ICON + '<span>Nur intern</span>';
                visEl.className = 'toolbar-canvas-visibility is-restricted';
                visEl.title = 'Nur für angemeldete Benutzer sichtbar';
                visEl.removeAttribute('hidden');
            } else {
                visEl.setAttribute('hidden', '');
            }
        }
    }

    // ---- Load-error overlay --------------------------------------------
    // Shown when State.load() failed (Supabase unreachable, RPC error, …).
    // The overlay sits above all three views; retry just runs load() again
    // and re-renders.

    function wireLoadErrorRetry() {
        var btn = document.getElementById('load-error-retry');
        if (!btn) return;
        btn.addEventListener('click', function () {
            btn.disabled = true;
            var bodyEl = document.getElementById('load-error-body');
            if (bodyEl) bodyEl.textContent = 'Lade Daten…';
            loadAndRender().then(function () { btn.disabled = false; });
        });
    }

    function applyLoadError() {
        var overlay = document.getElementById('load-error-overlay');
        var body    = document.getElementById('load-error-body');
        if (!overlay) return;
        var err = State.getLoadError();
        if (err) {
            if (body) body.textContent = err;
            overlay.removeAttribute('hidden');
        } else {
            overlay.setAttribute('hidden', '');
        }
    }

    // ---- URL sync ------------------------------------------------------
    // Hash format (v0.4 multi-canvas):
    //   #/                              overview (canvas list)
    //   #/c/<slug>                      canvas, default sub-view (diagram)
    //   #/c/<slug>/diagram              canvas + diagram
    //   #/c/<slug>/table                canvas + table
    //   #/c/<slug>/api                  canvas + api
    //   #/c/<slug>/diagram?selected=…   canvas + selection / filters
    //   #/diagram (legacy)              redirects to #/c/default/diagram

    var applyingUrl = false;
    var VALID_VIEWS = { diagram: 1, table: 1, api: 1 };

    function wireUrlSync() {
        window.addEventListener('hashchange', onHashChange);
    }

    /**
     * Hash change handler. Re-applies URL → state and triggers a reload only
     * when the canvas slug or the overview/canvas mode actually changed; pure
     * view tab switches and selection changes don't refetch.
     */
    function onHashChange() {
        var prevSlug = State.getCurrentCanvasSlug();
        var prevMode = State.getView() === 'overview' ? 'overview' : 'canvas';
        applyUrlToState();
        var nextMode = State.getView() === 'overview' ? 'overview' : 'canvas';
        if (prevSlug !== State.getCurrentCanvasSlug() || prevMode !== nextMode) {
            loadAndRender();
        }
    }

    /**
     * Parse the URL hash into { view, slug, selection, filters }. Path forms:
     *   ''                             → view='overview', slug=null
     *   'c/<slug>'                     → view='diagram',  slug=<slug>
     *   'c/<slug>/<view>'              → view=<view>,     slug=<slug>
     *   '<view>' (legacy)              → view=<view>,     slug='default'
     *
     * Selection encoding (unchanged):
     *   ?selected=node:<id>            (unprefixed = node — backwards compat)
     *   ?selected=edge:<id>
     *   ?selected=system:<name>
     *   ?selected=attr:<nodeId>|<columnName>
     */
    function parseUrl() {
        var raw = (window.location.hash || '').replace(/^#\/?/, '');
        var qIdx = raw.indexOf('?');
        var path = qIdx === -1 ? raw : raw.slice(0, qIdx);
        var query = qIdx === -1 ? '' : raw.slice(qIdx + 1);

        var view = null, slug = null;
        if (path === '' || path === 'overview') {
            view = 'overview';
            slug = null;
        } else if (path.indexOf('c/') === 0) {
            var rest = path.slice(2);
            var slashIdx = rest.indexOf('/');
            if (slashIdx === -1) {
                slug = decodeURIComponent(rest);
                view = 'diagram';
            } else {
                slug = decodeURIComponent(rest.slice(0, slashIdx));
                var sub = rest.slice(slashIdx + 1);
                view = VALID_VIEWS[sub] ? sub : 'diagram';
            }
        } else if (VALID_VIEWS[path]) {
            slug = 'default';
            view = path;
        }

        var selectedRaw = null;
        var filters = {};
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
        return { view: view, slug: slug, selection: selection, filters: filters };
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

    function buildUrl(view, slug, selection, filters) {
        var hash;
        if (view === 'overview' || !slug) {
            hash = '#/';
        } else {
            hash = '#/c/' + encodeURIComponent(slug) + '/' + (VALID_VIEWS[view] ? view : 'diagram');
        }
        var params = [];
        var encoded = encodeSelection(selection);
        if (encoded) params.push('selected=' + encodeURIComponent(encoded));
        if (filters) {
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
        // Detect Supabase auth-callback artefacts in the URL — recovery,
        // OAuth, magic-link, error params. We mustn't normalise (= strip)
        // the hash while these are present: the Supabase SDK reads them
        // asynchronously during its own init and would lose them if we
        // replaceState first. Once the SDK clears them, the next state
        // change re-runs syncStateToUrl naturally.
        var rawHash = window.location.hash || '';
        var rawSearch = window.location.search || '';
        var authMarker = /(?:^|[?#&])(access_token|refresh_token|provider_token|type=(?:recovery|signup|invite|magiclink|email_change)|error_description|error=)/;
        var inAuthCallback = authMarker.test(rawHash) || authMarker.test(rawSearch);

        applyingUrl = true;
        try {
            if (url.view) State.setView(url.view);
            else         State.setView('overview');
            State.setCurrentCanvasSlug(url.slug);
            if (url.selection !== undefined) State.setSelection(url.selection);
            State.getFilterDimensions().forEach(function (dim) {
                if (url.filters.hasOwnProperty(dim)) State.setFilter(dim, url.filters[dim]);
            });
        } finally {
            applyingUrl = false;
        }
        State.pruneSelection();

        if (!inAuthCallback) {
            // Rewrite the URL after parsing — turns legacy paths like
            // #/diagram into the canonical #/c/default/diagram and strips
            // any unknown junk users might have typed. Cheap no-op when
            // the URL was already canonical.
            syncStateToUrl();
        }
    }

    function syncStateToUrl() {
        if (applyingUrl) return;
        var newHash = buildUrl(
            State.getView(),
            State.getCurrentCanvasSlug(),
            State.getSelection(),
            State.getFilters()
        );
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
        // WAI-ARIA Tab Pattern: ArrowLeft / ArrowRight cycle within the
        // tablist (with wrap-around), Home jumps to the first tab, End to
        // the last. Tab itself moves focus OUT of the tablist into the
        // tabpanel, so the user doesn't have to walk through every tab to
        // leave the group. Roving tabindex (set by applyViewVisibility +
        // here on key) keeps Tab from emitting three sequential stops.
        seg.addEventListener('keydown', function (e) {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
            var tabs = Array.prototype.slice.call(seg.querySelectorAll('[role="tab"]'));
            if (!tabs.length) return;
            var idx = tabs.indexOf(document.activeElement);
            if (idx < 0) idx = 0;
            var next = idx;
            if (e.key === 'ArrowLeft')  next = (idx - 1 + tabs.length) % tabs.length;
            if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
            if (e.key === 'Home')       next = 0;
            if (e.key === 'End')        next = tabs.length - 1;
            e.preventDefault();
            tabs[next].focus();
            State.setView(tabs[next].getAttribute('data-view'));
        });
    }

    function applyViewVisibility() {
        var view = State.getView();
        document.querySelectorAll('#view-seg .seg-btn').forEach(function (b) {
            var active = b.getAttribute('data-view') === view;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', active ? 'true' : 'false');
            // Roving tabindex: only the active tab is in the Tab order;
            // Arrow keys cycle the rest. Without this, all three tabs
            // emit sequential Tab stops which violates the WAI-ARIA
            // tab pattern.
            b.setAttribute('tabindex', active ? '0' : '-1');
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
            var n = State.getUnsavedChangeCount();
            var saveBtn = document.getElementById('btn-save');
            // Disable synchronously so a second click during the in-flight
            // RPC can't trigger a double-apply. updateSaveAffordance will
            // pick up the post-success state via the 'mode' event.
            if (saveBtn) saveBtn.disabled = true;
            State.commitDraft().then(function () {
                State.setMode('view');
                var c = State.getCurrentCanvas();
                var visNote = c && c.visibility === 'public' ? ' · jetzt öffentlich sichtbar' : '';
                var msg = (n === 1 ? '1 Änderung gespeichert' : n + ' Änderungen gespeichert') + visNote;
                toast(msg, 'success');
            }).catch(function (err) {
                console.error('Save failed', err);
                if (saveBtn) saveBtn.disabled = false;
                toast('Speichern fehlgeschlagen: ' + friendlySaveError(err), 'error');
            });
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
                // Two lines because we now have meaningful canvas-keyboard
                // shortcuts to surface. Toast wraps via .toast-text; long
                // message readability is preserved by the 2.4 s timeout.
                toast(
                    'Allgemein: / Suche · Strg+S Speichern · Strg+Z Rückgängig · Esc Abbrechen · Entf Auswahl löschen. ' +
                    'Diagramm (Fokus): Pfeile Verschieben (+ Shift schneller) · + / − Zoom · 0 Startansicht · 1 Anpassen.',
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

    /**
     * Intercept the breadcrumb home link so a click while there are unsaved
     * changes prompts before navigating away. Same dialog the Cancel button
     * uses — keeps user-driven nav consistent with the rest of edit-mode.
     * Note: hashchange from the URL bar / back button cannot be intercepted
     * the same way; that path discards silently.
     */
    function wireHomeLink() {
        var link = document.getElementById('header-home-link');
        if (!link) return;
        link.addEventListener('click', function (e) {
            if (!State.hasUnsavedChanges()) return;
            if (!confirm('Ungespeicherte Änderungen verwerfen?')) {
                e.preventDefault();
            }
        });
    }

    /**
     * Refresh the overview when the user signs in or out — newly visible
     * (or newly hidden) restricted canvases would otherwise only appear
     * after a manual reload. Skipped for INITIAL_SESSION / TOKEN_REFRESHED
     * since they don't change visibility.
     *
     * Also fires the welcome toast on a fresh sign-in. INITIAL_SESSION fires
     * first (before app.js subscribes) so a session restore doesn't reach
     * this listener at all — only a real sign-in does.
     */
    function wireAuthRefresh() {
        if (!window.CanvasApp.Auth || !window.CanvasApp.Auth.on) return;
        var prevSession = null;
        window.CanvasApp.Auth.on(function (event, session) {
            if (event === 'SIGNED_IN' && !prevSession) {
                var email = session && session.user && session.user.email;
                toast(email ? 'Angemeldet als ' + email : 'Erfolgreich angemeldet', 'success');
            }
            prevSession = session;
            if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
            if (State.getView() === 'overview') loadAndRender();
        });
    }

    /**
     * Translate the common canvas_apply RPC errors into user-readable German.
     * Falls back to the raw message for unknown errors so the user at least
     * sees something diagnosable.
     */
    function friendlySaveError(err) {
        var msg = err && err.message ? String(err.message) : '';
        var match = msg.match(/\(([0-9A-Z]{5})\)/);
        var code = match ? match[1] : '';
        if (code === '42501' || /forbidden|editor or admin/i.test(msg)) {
            return 'Sie haben keine Berechtigung zum Bearbeiten dieses Canvas.';
        }
        if (code === 'P0002' || /canvas not found/i.test(msg)) {
            return 'Canvas wurde nicht gefunden — vermutlich gelöscht.';
        }
        if (/network|fetch|failed to fetch|networkerror/i.test(msg)) {
            return 'Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.';
        }
        if (/jwt|token|expired/i.test(msg)) {
            return 'Sitzung abgelaufen. Bitte erneut anmelden.';
        }
        return msg || 'Speichern fehlgeschlagen.';
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
            // Live region: state changes (saves, errors, "?" cheatsheet) get
            // announced to screen readers. polite > assertive — never
            // interrupt the user's current activity.
            toastEl.setAttribute('role', 'status');
            toastEl.setAttribute('aria-live', 'polite');
            toastEl.setAttribute('aria-atomic', 'true');
            document.body.appendChild(toastEl);
        }
        // Icon + textual prefix carry the success/error semantic so the
        // status isn't conveyed by colour alone (WCAG 1.4.1). The prefix
        // also gives screen readers a quick category cue before the body.
        var icon = '';
        var prefix = '';
        if (kind === 'error') {
            icon = '<svg class="toast-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>';
            prefix = 'Fehler: ';
        } else if (kind === 'success') {
            icon = '<svg class="toast-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 12 10 18 20 6"/></svg>';
            // No prefix on success — too noisy when most toasts are positive
            // confirmations ("Auto-Layout angewendet", "Gespeichert"). The
            // checkmark icon already carries the cue.
        }
        toastEl.innerHTML = icon + '<span class="toast-text">' + escapeHtml(prefix + msg) + '</span>';
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

    // ---- Focus trap (modal a11y) ---------------------------------------
    // WCAG 2.4.3 + 2.1.2: keyboard users must not Tab "behind" an open modal,
    // and focus must return to the trigger when the modal closes. This
    // helper wraps any modal element (auth, import, canvas-create, confirm)
    // with a Tab/Shift+Tab cycle and a previousFocus/restore pair.
    //
    // Usage:
    //   var release = installFocusTrap(modalEl);
    //   ... when closing the modal:
    //   release(); // un-binds keydown + restores focus to the original trigger
    //
    // Caller is responsible for moving focus *into* the modal initially —
    // typically the first input or the primary button. We don't auto-focus
    // because each call site already has a sensible "first focus" target.
    function installFocusTrap(modalEl) {
        if (!modalEl) return function () {};
        var previousFocus = document.activeElement;

        function focusable() {
            // Live query — modal contents can change (e.g. auth modal swaps
            // from sign-in form to reset form to recovery form). The CSS
            // `:not([hidden])` filter keeps invisible inputs out of the
            // cycle.
            return Array.prototype.slice.call(modalEl.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
                'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )).filter(function (el) {
                // offsetParent is null for display:none / hidden ancestors —
                // CSS that hides the auth-modal-card via the [hidden]
                // attribute on the wrapper covers this case.
                return el.offsetParent !== null || el === document.activeElement;
            });
        }

        function onKey(e) {
            if (e.key !== 'Tab') return;
            var nodes = focusable();
            if (!nodes.length) return;
            var first = nodes[0];
            var last  = nodes[nodes.length - 1];
            // Wrap forward: last → first
            if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
                return;
            }
            // Wrap backward: first → last
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        }

        document.addEventListener('keydown', onKey, true);

        return function release() {
            document.removeEventListener('keydown', onKey, true);
            // Restore focus only when it makes sense — if the user navigated
            // away (e.g. clicked a different button mid-modal), don't yank
            // focus back to a stale trigger.
            if (previousFocus && typeof previousFocus.focus === 'function' &&
                document.contains(previousFocus)) {
                try { previousFocus.focus(); } catch (e) { /* detached */ }
            }
        };
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
            var releaseTrap = installFocusTrap(overlay);
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
                releaseTrap();
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
        confirmDialog: confirmDialog,
        installFocusTrap: installFocusTrap
    };
})();

// Bootstrap
document.addEventListener('DOMContentLoaded', function () {
    window.CanvasApp.Auth.init();
    window.CanvasApp.Canvas.init();
    window.CanvasApp.Editor.init();
    window.CanvasApp.Table.init();
    window.CanvasApp.Overview.init();
    window.CanvasApp.Api.init();
    window.CanvasApp.Panel.init();
    window.CanvasApp.Filter.init();
    window.CanvasApp.XlsxIO.init();
    window.CanvasApp.Minimap.init();
    window.CanvasApp.AutoLayout.init();
    window.CanvasApp.App.init();
});
