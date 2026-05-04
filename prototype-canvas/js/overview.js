/**
 * Overview — landing-page module that renders the canvas list.
 *
 * Reads `State.getCanvases()` (populated by State.load() when the view is
 * 'overview') and paints a grid of cards. Clicking a card navigates to that
 * canvas's diagram view via the URL hash, which the App router picks up.
 *
 * The Overview view is the only one without a slug — its URL is `#/`.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Overview = (function () {

    var State = null;
    var rootEl = null;
    var listEl = null;
    var emptyEl = null;

    function init() {
        State = window.CanvasApp.State;
        rootEl  = document.getElementById('view-overview');
        listEl  = document.getElementById('overview-list');
        emptyEl = document.getElementById('overview-empty');
        if (!rootEl || !listEl) return;

        listEl.addEventListener('click', function (e) {
            var card = e.target.closest('[data-canvas-slug]');
            if (!card) return;
            var slug = card.getAttribute('data-canvas-slug');
            if (!slug) return;
            window.location.hash = '#/c/' + encodeURIComponent(slug) + '/diagram';
        });

        State.on(function (reason) {
            if (reason === 'replace' || reason === 'reset' || reason === 'canvas') {
                if (State.getView() === 'overview') render();
            }
        });
    }

    function render() {
        if (!listEl) return;
        var canvases = State.getCanvases() || [];
        // Single-card layout: with one canvas the auto-fill grid leaves the
        // page looking unfinished. Switch to a constrained single column.
        listEl.classList.toggle('is-single-card', canvases.length === 1);
        if (!canvases.length) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.removeAttribute('hidden');
            return;
        }
        if (emptyEl) emptyEl.setAttribute('hidden', '');

        listEl.innerHTML = canvases.map(renderCard).join('');
    }

    function renderCard(c) {
        var label = c.label_de || c.slug;
        var description = c.description_de || '';
        var modified = c.modified_at ? formatDate(c.modified_at) : '';
        var restricted = c.visibility === 'restricted';
        return (
            '<button type="button" class="overview-card" data-canvas-slug="' + escapeAttr(c.slug) + '" ' +
                'aria-label="Canvas «' + escapeAttr(label) + '» öffnen">' +
                '<div class="overview-card-head">' +
                    '<span class="overview-card-title">' + escapeHtml(label) + '</span>' +
                    (restricted
                        ? '<span class="overview-card-badge" title="Nur für angemeldete Benutzer sichtbar">Nur intern</span>'
                        : '') +
                '</div>' +
                (description
                    ? '<p class="overview-card-desc">' + escapeHtml(description) + '</p>'
                    : '') +
                '<div class="overview-card-meta">' +
                    (modified
                        ? '<span class="overview-card-modified" title="Zuletzt geändert">Zuletzt geändert: ' + escapeHtml(modified) + '</span>'
                        : '<span></span>') +
                '</div>' +
            '</button>'
        );
    }

    function formatDate(iso) {
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('de-CH', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch (e) { return ''; }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttr(s) { return escapeHtml(s); }

    return {
        init:   init,
        render: render
    };
})();
