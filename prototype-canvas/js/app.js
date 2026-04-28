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

        input.addEventListener('input', function () {
            var q = input.value.trim();
            highlightMatches(q.toLowerCase());
            currentItems = q ? buildRecommendations(q) : [];
            activeIdx = -1;
            renderDropdown(currentItems, dropdown);
            setExpanded(input, !!q);
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

        nodes.forEach(function (n) {
            var label = (n.label || n.id || '').toLowerCase();
            var id    = (n.id || '').toLowerCase();
            if (label.indexOf(q) !== -1 || id.indexOf(q) !== -1) {
                nodeHits.push({
                    kind: 'node',
                    label: n.label || n.id,
                    sub: typeLabelLocal(n.type) + (n.system ? ' · ' + n.system : ''),
                    nodeId: n.id
                });
            }
            (n.columns || []).forEach(function (c) {
                if ((c.name || '').toLowerCase().indexOf(q) !== -1) {
                    attrHits.push({
                        kind: 'attribute',
                        label: c.name,
                        sub: (n.label || n.id) + (n.system ? ' · ' + n.system : ''),
                        nodeId: n.id,
                        attrName: c.name
                    });
                }
            });
            if (n.system && !seenSystems[n.system] && n.system.toLowerCase().indexOf(q) !== -1) {
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
        return nodeHits.slice(0, 5)
            .concat(systemHits.slice(0, 3))
            .concat(attrHits.slice(0, 8));
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
        highlightMatches('');
        closeSearchDropdown(document.getElementById('search-dropdown'), input);
        input.blur();
        // Switch to diagram view if currently in API view (no selection panel there)
        if (State.getView() === 'api') State.setView('diagram');
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
