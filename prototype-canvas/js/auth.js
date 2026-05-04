/**
 * Auth — owns the user-menu (avatar + dropdown) and the magic-link sign-in
 * flow. Tracks the current Supabase session and emits to subscribers when it
 * changes; downstream modules (Editor, Canvas, …) gate write actions on
 * isSignedIn().
 *
 * Sign-up is disabled project-wide, so signInWithMagicLink only succeeds for
 * pre-provisioned auth.users rows. RLS on the catalog tables provides the
 * second gate (contact.app_role) — this module is concerned only with
 * authentication, not authorization.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Auth = (function () {

    var Sb = null;
    var session = null;
    var listeners = [];

    var avatarBtn = null;
    var dropdown  = null;

    // Sign-in form state lives across open/close so a "sent" confirmation
    // survives an accidental click outside. Reset when the form is reused.
    var formState   = 'idle';   // 'idle' | 'sending' | 'sent' | 'error'
    var formMessage = '';

    function init() {
        Sb        = window.CanvasApp.SupabaseClient;
        avatarBtn = document.getElementById('user-avatar-btn');
        dropdown  = document.getElementById('user-dropdown');
        if (!avatarBtn || !dropdown) return;

        wireOpenClose();

        // Optimistic first paint — the SDK hydrates from localStorage
        // synchronously enough for getSession() to resolve immediately when
        // a session exists. The auth state listener below also fires
        // INITIAL_SESSION right after subscription, so the UI converges.
        Sb.getSession().then(function (s) {
            session = s;
            render();
        });

        Sb.onAuthStateChange(function (event, s) {
            session = s;
            // Resetting form state on SIGNED_OUT keeps the next open clean.
            if (event === 'SIGNED_OUT') { formState = 'idle'; formMessage = ''; }
            render();
            // Forward the event so subscribers can distinguish actual
            // sign-in/out from quieter INITIAL_SESSION / TOKEN_REFRESHED
            // ticks (App.wireAuthRefresh leans on this).
            listeners.forEach(function (fn) { try { fn(event, s); } catch (e) { console.error(e); } });
        });
    }

    function getSession() { return session; }
    function isSignedIn() { return !!(session && session.user); }
    function on(fn)       { listeners.push(fn); }

    // ---- Open / close --------------------------------------------------

    function wireOpenClose() {
        avatarBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (dropdown.hasAttribute('hidden')) open();
            else close();
        });
        // Any element with [data-signin-trigger] opens the dropdown — used by
        // the header sign-in button, the toolbar "Zum Bearbeiten anmelden"
        // hint, and the empty-canvas signed-out CTA. Single delegation point
        // means new entry points just need the attribute, no extra wiring.
        document.addEventListener('click', function (e) {
            var trigger = e.target.closest('[data-signin-trigger]');
            if (!trigger) return;
            e.preventDefault();
            e.stopPropagation();
            if (dropdown.hasAttribute('hidden')) open();
        });
        document.addEventListener('click', function (e) {
            if (dropdown.hasAttribute('hidden')) return;
            if (e.target.closest('.user-menu')) return;
            if (e.target.closest('[data-signin-trigger]')) return;
            close();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !dropdown.hasAttribute('hidden')) close();
        });
    }

    function open() {
        dropdown.removeAttribute('hidden');
        avatarBtn.setAttribute('aria-expanded', 'true');
        // Focus the email input on open if signed-out, for keyboard ergonomics.
        var input = dropdown.querySelector('#user-signin-email');
        if (input) requestAnimationFrame(function () { input.focus(); });
    }

    function close() {
        dropdown.setAttribute('hidden', '');
        avatarBtn.setAttribute('aria-expanded', 'false');
    }

    // ---- Render --------------------------------------------------------

    function render() {
        // Drives the body-level `.is-signed-in` flag — CSS uses it to hide
        // any element marked `auth-only` from anonymous visitors.
        document.body.classList.toggle('is-signed-in', isSignedIn());
        if (isSignedIn()) {
            avatarBtn.classList.remove('is-anonymous');
            avatarBtn.textContent = initialsFromSession(session);
            avatarBtn.title = session.user.email || 'Benutzer';
            renderSignedIn();
        } else {
            avatarBtn.classList.add('is-anonymous');
            avatarBtn.innerHTML =
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
                '<circle cx="12" cy="7" r="4"/></svg>';
            avatarBtn.title = 'Anmelden';
            renderSignedOut();
        }
    }

    function renderSignedIn() {
        var email = (session && session.user && session.user.email) || '';
        var name  = nameFromSession(session) || email;
        dropdown.innerHTML =
            '<div class="user-dropdown-header">' +
                '<div class="user-dropdown-name">' + escapeHtml(name) + '</div>' +
                '<div class="user-dropdown-sub">' + escapeHtml(email) + '</div>' +
            '</div>' +
            '<div class="vis-divider"></div>' +
            '<button type="button" class="user-dropdown-row" data-user-action="signout">Abmelden</button>';

        var btn = dropdown.querySelector('[data-user-action="signout"]');
        btn.addEventListener('click', function () {
            btn.disabled = true;
            btn.textContent = 'Abmelden…';
            Sb.signOut().catch(function (err) {
                console.error('Sign out failed', err);
                if (window.CanvasApp.App && window.CanvasApp.App.toast) {
                    window.CanvasApp.App.toast('Abmelden fehlgeschlagen: ' + (err.message || 'unbekannt'), 'error');
                }
                // Re-enable so the user can retry.
                btn.disabled = false;
                btn.textContent = 'Abmelden';
            });
            // SIGNED_OUT event will fire on success and re-render.
        });
    }

    function renderSignedOut() {
        var statusBlock = '';
        if (formState === 'sent') {
            statusBlock =
                '<div class="user-signin-status user-signin-status-success">' +
                    'Anmeldelink gesendet. Prüfen Sie Ihr E-Mail-Postfach.' +
                '</div>';
        } else if (formState === 'error') {
            statusBlock =
                '<div class="user-signin-status user-signin-status-error">' +
                    escapeHtml(formMessage || 'Anmeldung fehlgeschlagen.') +
                '</div>';
        }

        dropdown.innerHTML =
            '<div class="user-dropdown-header">' +
                '<div class="user-dropdown-name">Nicht angemeldet</div>' +
                '<div class="user-dropdown-sub">Anmeldelink per E-Mail</div>' +
            '</div>' +
            '<div class="vis-divider"></div>' +
            '<form class="user-signin-form" id="user-signin-form" autocomplete="on" novalidate>' +
                '<label for="user-signin-email" class="user-signin-label">E-Mail-Adresse</label>' +
                '<input type="email" id="user-signin-email" class="user-signin-input" placeholder="name@beispiel.ch" autocomplete="email" required ' +
                    (formState === 'sending' ? 'disabled' : '') + '>' +
                '<button type="submit" class="tb-btn tb-btn-primary user-signin-submit"' +
                    (formState === 'sending' ? ' disabled' : '') + '>' +
                    (formState === 'sending' ? 'Wird gesendet…' : 'Anmeldelink senden') +
                '</button>' +
            '</form>' +
            statusBlock;

        var form = dropdown.querySelector('#user-signin-form');
        if (form) form.addEventListener('submit', onSubmit);
    }

    function onSubmit(e) {
        e.preventDefault();
        var input = dropdown.querySelector('#user-signin-email');
        if (!input) return;
        var email = (input.value || '').trim();
        if (!email) return;
        formState = 'sending';
        formMessage = '';
        renderSignedOut();
        Sb.signInWithMagicLink(email).then(function () {
            formState = 'sent';
            formMessage = '';
            renderSignedOut();
        }).catch(function (err) {
            formState = 'error';
            formMessage = friendlyAuthError(err);
            renderSignedOut();
        });
    }

    /**
     * Translate the common Supabase OTP errors into something a non-dev user
     * can understand. Strings are stable across recent SDK versions; falls
     * back to the raw message if nothing matches.
     */
    function friendlyAuthError(err) {
        var msg = (err && err.message) ? String(err.message) : '';
        if (/Signups not allowed/i.test(msg)) return 'Diese E-Mail-Adresse ist nicht freigeschaltet.';
        if (/User not found/i.test(msg))     return 'Diese E-Mail-Adresse ist nicht freigeschaltet.';
        if (/email rate limit/i.test(msg))   return 'Zu viele Versuche. Bitte später erneut versuchen.';
        if (/rate limit/i.test(msg))         return 'Zu viele Versuche. Bitte später erneut versuchen.';
        if (/invalid email/i.test(msg))      return 'Ungültige E-Mail-Adresse.';
        return msg || 'Anmeldung fehlgeschlagen.';
    }

    // ---- Helpers -------------------------------------------------------

    function nameFromSession(s) {
        if (!s || !s.user) return null;
        var meta = s.user.user_metadata || {};
        return meta.full_name || meta.name || null;
    }

    function initialsFromSession(s) {
        var name = nameFromSession(s);
        if (name) {
            var parts = name.trim().split(/\s+/).filter(Boolean);
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        }
        var email = (s && s.user && s.user.email) || '';
        return email ? email.slice(0, 2).toUpperCase() : '?';
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    return {
        init:       init,
        getSession: getSession,
        isSignedIn: isSignedIn,
        on:         on
    };
})();
