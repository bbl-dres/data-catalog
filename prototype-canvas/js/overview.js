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
            // Per-card hamburger toggle.
            var menuBtn = e.target.closest('[data-card-menu]');
            if (menuBtn) {
                e.stopPropagation();
                e.preventDefault();
                toggleCardMenu(menuBtn);
                return;
            }
            // Per-card menu action (rename / delete).
            var actionBtn = e.target.closest('[data-card-action]');
            if (actionBtn) {
                e.stopPropagation();
                e.preventDefault();
                handleCardAction(actionBtn);
                return;
            }
            // Click anywhere else inside the menu wrap shouldn't navigate
            // to the canvas — just absorb it.
            if (e.target.closest('.overview-card-menu-wrap')) return;
            // Card click → navigate.
            var card = e.target.closest('[data-canvas-slug]');
            if (!card) return;
            var slug = card.getAttribute('data-canvas-slug');
            if (!slug) return;
            window.location.hash = '#/c/' + encodeURIComponent(slug) + '/diagram';
        });

        // Outside-click + Escape close any open card menu.
        document.addEventListener('click', function (e) {
            if (e.target.closest('.overview-card-menu-wrap')) return;
            closeAllCardMenus();
        });

        // "+ Neuer Canvas" button + modal — visibility controlled by the
        // existing auth-only CSS, so signed-out users never see them.
        var newBtn = document.getElementById('overview-new-canvas-btn');
        if (newBtn) newBtn.addEventListener('click', openCreateModal);
        var modal = document.getElementById('canvas-create-modal');
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target.closest('[data-canvas-modal-close]')) closeCreateModal();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            closeAllCardMenus();
            if (modal && !modal.hasAttribute('hidden')) closeCreateModal();
        });

        State.on(function (reason) {
            if (reason === 'replace' || reason === 'reset' || reason === 'canvas') {
                if (State.getView() === 'overview') render();
            }
        });
    }

    // ---- Create-canvas modal --------------------------------------------

    var createState   = 'idle';     // 'idle' | 'sending' | 'error'
    var createMessage = '';
    var modalMode     = 'create';   // 'create' | 'rename'
    var modalCanvas   = null;       // for rename: the canvas being edited

    function openCreateModal() {
        modalMode = 'create';
        modalCanvas = null;
        openCanvasModal();
    }

    function openRenameModal(canvas) {
        modalMode = 'rename';
        modalCanvas = canvas;
        openCanvasModal();
    }

    // Focus-trap release function — set when the modal opens, called on
    // close. WCAG 2.4.3 / 2.1.2.
    var releaseFocusTrap = null;

    function openCanvasModal() {
        var modal = document.getElementById('canvas-create-modal');
        if (!modal) return;
        createState = 'idle';
        createMessage = '';
        modal.removeAttribute('hidden');
        document.body.classList.add('auth-modal-open');
        renderCreateModal();
        if (window.CanvasApp.App && window.CanvasApp.App.installFocusTrap) {
            releaseFocusTrap = window.CanvasApp.App.installFocusTrap(modal);
        }
        requestAnimationFrame(function () {
            var first = modal.querySelector('input:not([disabled])');
            if (first) first.focus();
        });
    }

    function closeCreateModal() {
        var modal = document.getElementById('canvas-create-modal');
        if (!modal) return;
        modal.setAttribute('hidden', '');
        document.body.classList.remove('auth-modal-open');
        if (releaseFocusTrap) { releaseFocusTrap(); releaseFocusTrap = null; }
    }

    function renderCreateModal() {
        var content = document.getElementById('canvas-create-content');
        if (!content) return;
        var disabled = createState === 'sending';
        var isRename = modalMode === 'rename';
        var preLabel = isRename && modalCanvas ? (modalCanvas.label_de || '') : '';
        var preDesc  = isRename && modalCanvas ? (modalCanvas.description_de || '') : '';
        var preVis   = isRename && modalCanvas ? modalCanvas.visibility : 'public';

        var title = isRename ? 'Canvas umbenennen' : 'Neuer Canvas';
        var subtitle = isRename
            ? 'Aktualisieren Sie Name, Beschreibung oder Sichtbarkeit. Der URL-Bezeichner bleibt unverändert.'
            : 'Der Bezeichner für die URL wird automatisch aus dem Namen abgeleitet. Knoten und Beziehungen können nach dem Erstellen hinzugefügt werden.';
        var submitText = isRename
            ? (disabled ? 'Wird gespeichert…' : 'Änderungen speichern')
            : (disabled ? 'Wird erstellt…'  : 'Canvas erstellen');

        var statusBlock = createState === 'error'
            ? '<div class="auth-modal-status auth-modal-status-error">' + escapeHtml(createMessage) + '</div>'
            : '';

        content.innerHTML =
            '<h2 class="auth-modal-title" id="canvas-create-title">' + escapeHtml(title) + '</h2>' +
            '<p class="auth-modal-sub">' + escapeHtml(subtitle) + '</p>' +
            '<form class="auth-modal-form" id="canvas-create-form" novalidate>' +
                '<div>' +
                    '<label class="auth-modal-label" for="canvas-create-label">Name</label>' +
                    '<input class="auth-modal-input" id="canvas-create-label" type="text" required maxlength="200" ' +
                        'placeholder="z. B. Personendaten" value="' + escapeAttr(preLabel) + '" ' +
                        (disabled ? 'disabled' : '') + '>' +
                '</div>' +
                '<div>' +
                    '<label class="auth-modal-label" for="canvas-create-description">Beschreibung (optional)</label>' +
                    '<input class="auth-modal-input" id="canvas-create-description" type="text" maxlength="500" ' +
                        'placeholder="Kurzbeschreibung des Canvas" value="' + escapeAttr(preDesc) + '" ' +
                        (disabled ? 'disabled' : '') + '>' +
                '</div>' +
                '<div>' +
                    '<label class="auth-modal-label" for="canvas-create-visibility">Sichtbarkeit</label>' +
                    '<select class="auth-modal-input" id="canvas-create-visibility" ' + (disabled ? 'disabled' : '') + '>' +
                        '<option value="public"'     + (preVis === 'public'     ? ' selected' : '') + '>Öffentlich (auch ohne Anmeldung sichtbar)</option>' +
                        '<option value="restricted"' + (preVis === 'restricted' ? ' selected' : '') + '>Nur intern (Anmeldung erforderlich)</option>' +
                    '</select>' +
                '</div>' +
                '<button type="submit" class="tb-btn tb-btn-primary auth-modal-submit"' + (disabled ? ' disabled' : '') + '>' +
                    escapeHtml(submitText) +
                '</button>' +
            '</form>' +
            statusBlock;

        var form = content.querySelector('#canvas-create-form');
        if (form) form.addEventListener('submit', onCreateSubmit);
    }

    function onCreateSubmit(e) {
        e.preventDefault();
        if (createState === 'sending') return;
        var labelEl = document.getElementById('canvas-create-label');
        var descEl  = document.getElementById('canvas-create-description');
        var visEl   = document.getElementById('canvas-create-visibility');
        if (!labelEl) return;
        var label = (labelEl.value || '').trim();
        if (!label) return;
        var description = (descEl && descEl.value || '').trim();
        var visibility  = (visEl && visEl.value) || 'public';

        var Sb = window.CanvasApp.SupabaseClient;
        var App = window.CanvasApp.App;

        if (modalMode === 'rename' && modalCanvas) {
            // Slug intentionally not updated — see updateCanvas comment.
            createState = 'sending';
            createMessage = '';
            renderCreateModal();
            Sb.updateCanvas(modalCanvas.id, {
                label_de: label,
                description_de: description || null,
                visibility: visibility
            }).then(function () {
                closeCreateModal();
                if (App && App.toast) App.toast('Canvas aktualisiert', 'success');
                refreshOverview();
            }).catch(function (err) {
                createState = 'error';
                createMessage = friendlyCreateError(err);
                renderCreateModal();
            });
            return;
        }

        // Create flow.
        var slug = slugify(label);
        if (!slug) {
            createState = 'error';
            createMessage = 'Aus dem Namen konnte kein gültiger Bezeichner abgeleitet werden.';
            renderCreateModal();
            return;
        }
        createState = 'sending';
        createMessage = '';
        renderCreateModal();
        Sb.createCanvas({
            slug: slug,
            label_de: label,
            description_de: description || null,
            visibility: visibility
        }).then(function (canvas) {
            closeCreateModal();
            var newSlug = (canvas && canvas.slug) || slug;
            window.location.hash = '#/c/' + encodeURIComponent(newSlug) + '/diagram';
        }).catch(function (err) {
            createState = 'error';
            createMessage = friendlyCreateError(err);
            renderCreateModal();
        });
    }

    // ---- Card hamburger + actions --------------------------------------

    function toggleCardMenu(btn) {
        var wrap = btn.closest('.overview-card-menu-wrap');
        if (!wrap) return;
        var menu = wrap.querySelector('.card-menu');
        if (!menu) return;
        var willOpen = menu.hasAttribute('hidden');
        closeAllCardMenus();
        if (willOpen) {
            menu.removeAttribute('hidden');
            btn.setAttribute('aria-expanded', 'true');
        }
    }

    function closeAllCardMenus() {
        document.querySelectorAll('.card-menu').forEach(function (m) {
            m.setAttribute('hidden', '');
        });
        document.querySelectorAll('.overview-card-menu-btn[aria-expanded="true"]').forEach(function (b) {
            b.setAttribute('aria-expanded', 'false');
        });
    }

    function handleCardAction(btn) {
        var action = btn.getAttribute('data-card-action');
        var wrap   = btn.closest('.overview-card-wrap');
        if (!wrap) return;
        var canvasId = wrap.getAttribute('data-canvas-id');
        var canvas = (State.getCanvases() || []).find(function (c) { return c.id === canvasId; });
        if (!canvas) return;
        closeAllCardMenus();
        if (action === 'rename') openRenameModal(canvas);
        else if (action === 'delete') confirmDeleteCanvas(canvas);
    }

    function confirmDeleteCanvas(canvas) {
        var App = window.CanvasApp.App;
        var label = canvas.label_de || canvas.slug;
        var body = 'Möchten Sie den Canvas «' + label + '» wirklich löschen? ' +
            'Alle Knoten, Beziehungen und Datenpakete in diesem Canvas gehen unwiderruflich verloren.';
        // App.confirmDialog is guaranteed to exist by the bootstrap load-
        // order check in app.js — no native-confirm fallback needed.
        App.confirmDialog({
            title: 'Canvas löschen',
            body: body,
            confirmText: 'Löschen',
            cancelText: 'Abbrechen',
            danger: true
        }).then(function (confirmed) {
            if (confirmed) doDeleteCanvas(canvas);
        });
    }

    function doDeleteCanvas(canvas) {
        var Sb  = window.CanvasApp.SupabaseClient;
        var App = window.CanvasApp.App;
        Sb.deleteCanvas(canvas.id).then(function () {
            if (App && App.toast) App.toast('Canvas gelöscht', 'success');
            refreshOverview();
        }).catch(function (err) {
            if (App && App.toast) {
                App.toast('Löschen fehlgeschlagen: ' + friendlyCreateError(err), 'error');
            }
        });
    }

    function refreshOverview() {
        State.load().then(function () {
            if (State.getView() === 'overview') render();
        });
    }

    /**
     * Map common Supabase errors when inserting a canvas to user-readable
     * German. The 23505 (unique_violation) is the slug clash case; 42501
     * is RLS rejection (e.g., contact.app_role is `viewer`, not editor).
     */
    function friendlyCreateError(err) {
        var msg = err && err.message ? String(err.message) : '';
        if (/duplicate key|unique|already exists|23505/i.test(msg))
            return 'Ein Canvas mit diesem Namen existiert bereits. Bitte wählen Sie einen anderen Namen.';
        if (/permission|forbidden|42501|policy/i.test(msg))
            return 'Sie haben keine Berechtigung, neue Canvases zu erstellen.';
        if (/violates check constraint.*slug_format/i.test(msg))
            return 'Aus dem Namen konnte kein gültiger Bezeichner abgeleitet werden.';
        if (/violates check constraint/i.test(msg))
            return 'Eine Eingabe ist ungültig.';
        if (/network|fetch|failed to fetch/i.test(msg))
            return 'Verbindung zum Server fehlgeschlagen.';
        return msg || 'Canvas konnte nicht erstellt werden.';
    }

    /**
     * Derive a DB-safe canvas slug from a free-text label. Result must match
     * the canvas_slug_format_chk constraint: ^[a-z0-9][a-z0-9_.-]*$. German
     * umlauts are transliterated; everything else non-alnum collapses to
     * a single hyphen.
     */
    function slugify(s) {
        var out = String(s || '').toLowerCase()
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .replace(/[^a-z0-9_.-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[-_.]+|[-_.]+$/g, '');
        return out.replace(/^[^a-z0-9]+/, '');
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
            '<div class="overview-card-wrap" data-canvas-id="' + escapeAttr(c.id) + '">' +
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
                '</button>' +
                // auth-only: signed-out users never see the menu trigger.
                '<div class="overview-card-menu-wrap auth-only">' +
                    '<button type="button" class="overview-card-menu-btn" data-card-menu ' +
                        'aria-label="Aktionen für ' + escapeAttr(label) + '" aria-haspopup="menu" aria-expanded="false">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
                            '<circle cx="12" cy="5" r="1.6"/>' +
                            '<circle cx="12" cy="12" r="1.6"/>' +
                            '<circle cx="12" cy="19" r="1.6"/>' +
                        '</svg>' +
                    '</button>' +
                    '<div class="card-menu" hidden role="menu">' +
                        '<button type="button" class="card-menu-item" data-card-action="rename" role="menuitem">Umbenennen…</button>' +
                        '<button type="button" class="card-menu-item card-menu-item-danger" data-card-action="delete" role="menuitem">Löschen…</button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function formatDate(iso) {
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('de-CH', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch (e) { return ''; }
    }

    var escapeHtml = window.CanvasApp.Util.escapeHtml;
    var escapeAttr = window.CanvasApp.Util.escapeAttr;

    return {
        init:   init,
        render: render
    };
})();
