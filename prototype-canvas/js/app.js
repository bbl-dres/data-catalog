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

        State.on(function (reason) {
            if (reason === 'view') {
                applyViewVisibility();
            }
            if (reason === 'view' || reason === 'selection') {
                syncStateToUrl();
            }
        });

        return State.load().then(function () {
            // Apply the URL's view/selection on top of what was loaded from
            // localStorage. URL wins so shared links land you exactly where
            // the sender was.
            applyUrlToState();
            applyViewVisibility();
            window.CanvasApp.Canvas.renderAll();
            window.CanvasApp.Table.render();
            window.CanvasApp.Api.render();
            window.CanvasApp.Panel.render();
            // Fit on first paint
            requestAnimationFrame(function () {
                window.CanvasApp.Canvas.fitToScreen();
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
        query.split('&').forEach(function (kv) {
            if (!kv) return;
            var eq = kv.indexOf('=');
            var k = eq === -1 ? kv : kv.slice(0, eq);
            var v = eq === -1 ? '' : decodeURIComponent(kv.slice(eq + 1));
            if (k === 'selected') selectedRaw = v || null;
        });
        var selection = decodeSelection(selectedRaw);
        return { view: view, selection: selection };
    }

    function decodeSelection(raw) {
        if (raw == null) return undefined; // no key in URL — leave state alone
        if (raw === '') return null;        // explicit clear
        var colon = raw.indexOf(':');
        var kind = colon === -1 ? 'node' : raw.slice(0, colon);
        var value = colon === -1 ? raw : raw.slice(colon + 1);
        if (kind === 'node' || kind === 'edge') return { kind: kind, id: value };
        if (kind === 'system') return { kind: 'system', name: value };
        if (kind === 'attr' || kind === 'attribute') {
            var pipe = value.indexOf('|');
            if (pipe === -1) return null;
            return { kind: 'attribute', nodeId: value.slice(0, pipe), name: value.slice(pipe + 1) };
        }
        return null;
    }

    function encodeSelection(sel) {
        if (!sel) return null;
        if (sel.kind === 'node')      return 'node:' + sel.id;
        if (sel.kind === 'edge')      return 'edge:' + sel.id;
        if (sel.kind === 'system')    return 'system:' + sel.name;
        if (sel.kind === 'attribute') return 'attr:' + sel.nodeId + '|' + sel.name;
        return null;
    }

    function buildUrl(view, selection) {
        var hash = '#/' + (view || 'diagram');
        var encoded = encodeSelection(selection);
        if (encoded) hash += '?selected=' + encodeURIComponent(encoded);
        return hash;
    }

    function applyUrlToState() {
        var url = parseUrl();
        if (!url.view && url.selection === undefined && !window.location.hash) return;
        applyingUrl = true;
        try {
            if (url.view) State.setView(url.view);
            // url.selection: undefined = no key, null = explicit clear, object = set
            if (url.selection !== undefined) State.setSelection(url.selection);
        } finally {
            applyingUrl = false;
        }
    }

    function syncStateToUrl() {
        if (applyingUrl) return;
        var newHash = buildUrl(State.getView(), State.getSelection());
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
            if (!confirm('Änderungen speichern?')) return;
            State.commitDraft();
            State.setMode('view');
            toast('Änderungen gespeichert', 'success');
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

    function wireSearch() {
        var input = document.getElementById('search-input');
        if (!input) return;
        input.addEventListener('input', function () {
            var q = input.value.trim().toLowerCase();
            highlightMatches(q);
        });
    }

    function highlightMatches(q) {
        var matches = [];
        var nodes = State.getNodes();
        nodes.forEach(function (n) {
            var hay = [
                n.label, n.id, n.system, n.schema,
                (n.columns || []).map(function (c) { return c.name; }).join(' ')
            ].join(' ').toLowerCase();
            if (q && hay.indexOf(q) !== -1) matches.push(n);
        });
        // Visual hint on the canvas: dim non-matching nodes when there's a query
        document.querySelectorAll('.node').forEach(function (el) {
            var id = el.getAttribute('data-node-id');
            var match = q === '' || matches.some(function (n) { return n.id === id; });
            el.style.opacity = match ? '' : '0.3';
        });
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

    return {
        init: init,
        toast: toast
    };
})();

// Bootstrap
document.addEventListener('DOMContentLoaded', function () {
    window.CanvasApp.Canvas.init();
    window.CanvasApp.Editor.init();
    window.CanvasApp.Table.init();
    window.CanvasApp.Api.init();
    window.CanvasApp.Panel.init();
    window.CanvasApp.Visibility.init();
    window.CanvasApp.XlsxIO.init();
    window.CanvasApp.App.init();
});
