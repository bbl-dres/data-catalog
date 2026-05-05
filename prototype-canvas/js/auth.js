/**
 * Auth — owns the user-menu (avatar + signed-in dropdown) and the auth
 * modal (signed-out sign-in, password reset request, recovery flow).
 *
 * Two distinct surfaces:
 *   - Avatar dropdown (signed-in): quick access to email + Abmelden
 *   - Auth modal (signed-out / recovery): centred dialog for the email +
 *     password form, the "Passwort vergessen?" reset request, and the
 *     "set new password" view that opens when the SDK fires
 *     PASSWORD_RECOVERY after the user clicks the reset email link
 *
 * Sign-up is disabled on the Email provider, so signInWithPassword only
 * succeeds for credentials an admin pre-created via Supabase Dashboard →
 * Authentication → Users. RLS on the catalog tables provides the second
 * gate (contact.app_role).
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Auth = (function () {

    var Sb = null;
    var session = null;
    var listeners = [];

    var avatarBtn    = null;
    var dropdown     = null;
    var modal        = null;
    var modalContent = null;

    // Per-request state used by both the modal forms.
    var formState   = 'idle';   // 'idle' | 'sending' | 'error'
    var formMessage = '';
    // Which modal view is showing.
    var modalView   = 'signin'; // 'signin' | 'reset' | 'reset-sent' | 'recovery' | 'recovery-done'

    function init() {
        Sb           = window.CanvasApp.SupabaseClient;
        avatarBtn    = document.getElementById('user-avatar-btn');
        dropdown     = document.getElementById('user-dropdown');
        modal        = document.getElementById('auth-modal');
        modalContent = document.getElementById('auth-modal-content');
        if (!avatarBtn || !dropdown) return;

        // OAuth-callback error capture — kept as defence-in-depth even after
        // the swap to email + password, since the Site URL still routes here.
        var pendingAuthError = extractAuthErrorFromHash(window.location.hash);
        if (pendingAuthError) {
            setTimeout(function () {
                if (window.CanvasApp.App && window.CanvasApp.App.toast) {
                    window.CanvasApp.App.toast(
                        'Anmeldung fehlgeschlagen: ' + friendlyAuthError({ message: pendingAuthError }),
                        'error'
                    );
                }
            }, 0);
        }

        wireOpenClose();

        Sb.getSession().then(function (s) {
            session = s;
            render();
        });

        Sb.onAuthStateChange(function (event, s) {
            session = s;
            if (event === 'SIGNED_OUT') {
                formState = 'idle';
                formMessage = '';
                modalView = 'signin';
            }
            // Recovery: user clicked the password-reset email link. Open the
            // modal in "set new password" mode — the SDK has given us a
            // temporary session (verified via the email link) so updateUser
            // is allowed.
            if (event === 'PASSWORD_RECOVERY') {
                openModal('recovery');
            }
            // Sign-in via the modal? Close it — but not for recovery flows
            // (which also fire SIGNED_IN, and we want to show the new-password
            // form, not close).
            if (event === 'SIGNED_IN' && modal && !modal.hasAttribute('hidden')
                && modalView !== 'recovery' && modalView !== 'recovery-done') {
                closeModal();
            }
            render();
            listeners.forEach(function (fn) { try { fn(event, s); } catch (e) { console.error(e); } });
        });
    }

    function getSession() { return session; }
    function isSignedIn() { return !!(session && session.user); }
    function on(fn)       { listeners.push(fn); }

    // ---- Open / close --------------------------------------------------

    function wireOpenClose() {
        // Avatar (signed-in only) toggles the small dropdown.
        avatarBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (dropdown.hasAttribute('hidden')) openDropdown();
            else closeDropdown();
        });
        // Sign-in triggers (header button, toolbar hint, empty-canvas CTA)
        // open the auth modal — single delegation so new entry points just
        // need [data-signin-trigger].
        document.addEventListener('click', function (e) {
            var trigger = e.target.closest('[data-signin-trigger]');
            if (!trigger) return;
            e.preventDefault();
            e.stopPropagation();
            openModal('signin');
        });
        // Outside-click closes the dropdown.
        document.addEventListener('click', function (e) {
            if (dropdown.hasAttribute('hidden')) return;
            if (e.target.closest('.user-menu')) return;
            closeDropdown();
        });
        // Modal close: × button or backdrop both carry [data-modal-close].
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target.closest('[data-modal-close]')) closeModal();
            });
        }
        // Escape closes whichever surface is open.
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (modal && !modal.hasAttribute('hidden')) closeModal();
            else if (!dropdown.hasAttribute('hidden')) closeDropdown();
        });
    }

    function openDropdown() {
        dropdown.removeAttribute('hidden');
        avatarBtn.setAttribute('aria-expanded', 'true');
    }
    function closeDropdown() {
        dropdown.setAttribute('hidden', '');
        avatarBtn.setAttribute('aria-expanded', 'false');
    }

    // Focus-trap release function — set when the modal opens, called on
    // close. Single-instance because the auth modal is a singleton.
    var releaseFocusTrap = null;

    function openModal(view) {
        if (!modal) return;
        modalView = view || 'signin';
        // Reset transient form state on a fresh open so a stale error from
        // the previous session doesn't greet the user.
        if (modalView === 'signin' || modalView === 'reset') {
            formState = 'idle';
            formMessage = '';
        }
        modal.removeAttribute('hidden');
        document.body.classList.add('auth-modal-open');
        renderModal();
        // Focus trap: keep Tab inside the modal, restore focus to the
        // trigger on close. Installed AFTER renderModal so the form inputs
        // exist by the time `focusable()` queries them.
        if (window.CanvasApp.App && window.CanvasApp.App.installFocusTrap) {
            releaseFocusTrap = window.CanvasApp.App.installFocusTrap(modal);
        }
        requestAnimationFrame(function () {
            var first = modal.querySelector('input:not([disabled])');
            if (first) first.focus();
        });
    }
    function closeModal() {
        if (!modal) return;
        modal.setAttribute('hidden', '');
        document.body.classList.remove('auth-modal-open');
        if (releaseFocusTrap) { releaseFocusTrap(); releaseFocusTrap = null; }
    }

    // ---- Render --------------------------------------------------------

    function render() {
        // Drives the body-level `.is-signed-in` flag — CSS uses it to hide
        // any element marked `auth-only` from anonymous visitors.
        document.body.classList.toggle('is-signed-in', isSignedIn());
        if (isSignedIn()) {
            avatarBtn.classList.remove('is-anonymous');
            // External profile pictures (e.g. from a future Google auth
            // round-trip) get rendered as <img>; otherwise initials.
            var meta = (session.user.user_metadata) || {};
            if (meta.avatar_url) {
                avatarBtn.innerHTML =
                    '<img class="user-avatar-img" alt="" referrerpolicy="no-referrer" src="' +
                    escapeAttr(meta.avatar_url) + '">';
            } else {
                avatarBtn.textContent = initialsFromSession(session);
            }
            avatarBtn.title = session.user.email || 'Konto';
            renderDropdown();
        } else {
            avatarBtn.classList.add('is-anonymous');
            avatarBtn.innerHTML =
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
                '<circle cx="12" cy="7" r="4"/></svg>';
            avatarBtn.title = 'Anmelden';
            // Signed-out content lives in the modal now; clear the dropdown
            // so a stale form can't be reached if anything tries to open it.
            dropdown.innerHTML = '';
        }
    }

    function renderDropdown() {
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
                btn.disabled = false;
                btn.textContent = 'Abmelden';
            });
        });
    }

    function renderModal() {
        if (!modalContent) return;
        if (modalView === 'signin')         renderModalSignin();
        else if (modalView === 'reset')     renderModalReset();
        else if (modalView === 'reset-sent') renderModalResetSent();
        else if (modalView === 'recovery')  renderModalRecovery();
        else if (modalView === 'recovery-done') renderModalRecoveryDone();
    }

    function renderModalSignin() {
        var disabled = formState === 'sending';
        modalContent.innerHTML =
            '<h2 class="auth-modal-title" id="auth-modal-title">Anmelden</h2>' +
            '<p class="auth-modal-sub">Mit E-Mail-Adresse und Passwort anmelden.</p>' +
            '<form class="auth-modal-form" id="modal-signin-form" autocomplete="on" novalidate>' +
                '<div>' +
                    '<label class="auth-modal-label" for="modal-signin-email">E-Mail-Adresse</label>' +
                    '<input class="auth-modal-input" type="email" id="modal-signin-email" placeholder="name@beispiel.ch" autocomplete="email" required ' +
                        (disabled ? 'disabled' : '') + '>' +
                '</div>' +
                '<div>' +
                    '<label class="auth-modal-label" for="modal-signin-password">Passwort</label>' +
                    '<input class="auth-modal-input" type="password" id="modal-signin-password" autocomplete="current-password" required ' +
                        (disabled ? 'disabled' : '') + '>' +
                '</div>' +
                '<button type="submit" class="tb-btn tb-btn-primary auth-modal-submit"' + (disabled ? ' disabled' : '') + '>' +
                    (disabled ? 'Wird geprüft…' : 'Anmelden') +
                '</button>' +
                '<button type="button" class="auth-modal-link" data-modal-action="show-reset">Passwort vergessen?</button>' +
            '</form>' +
            statusBlock();

        modalContent.querySelector('#modal-signin-form').addEventListener('submit', onSigninSubmit);
        modalContent.querySelector('[data-modal-action="show-reset"]').addEventListener('click', function () {
            formState = 'idle'; formMessage = '';
            modalView = 'reset';
            renderModal();
            var inp = modal.querySelector('#modal-reset-email');
            if (inp) inp.focus();
        });
    }

    function renderModalReset() {
        var disabled = formState === 'sending';
        modalContent.innerHTML =
            '<h2 class="auth-modal-title" id="auth-modal-title">Passwort zurücksetzen</h2>' +
            '<p class="auth-modal-sub">Wir senden Ihnen einen Link per E-Mail, mit dem Sie ein neues Passwort festlegen können.</p>' +
            '<form class="auth-modal-form" id="modal-reset-form" autocomplete="on" novalidate>' +
                '<div>' +
                    '<label class="auth-modal-label" for="modal-reset-email">E-Mail-Adresse</label>' +
                    '<input class="auth-modal-input" type="email" id="modal-reset-email" placeholder="name@beispiel.ch" autocomplete="email" required ' +
                        (disabled ? 'disabled' : '') + '>' +
                '</div>' +
                '<button type="submit" class="tb-btn tb-btn-primary auth-modal-submit"' + (disabled ? ' disabled' : '') + '>' +
                    (disabled ? 'Wird gesendet…' : 'E-Mail senden') +
                '</button>' +
                '<button type="button" class="auth-modal-link" data-modal-action="back-to-signin">← Zurück zur Anmeldung</button>' +
            '</form>' +
            statusBlock();

        modalContent.querySelector('#modal-reset-form').addEventListener('submit', onResetSubmit);
        modalContent.querySelector('[data-modal-action="back-to-signin"]').addEventListener('click', function () {
            formState = 'idle'; formMessage = '';
            modalView = 'signin';
            renderModal();
        });
    }

    function renderModalResetSent() {
        modalContent.innerHTML =
            '<h2 class="auth-modal-title" id="auth-modal-title">E-Mail gesendet</h2>' +
            '<p class="auth-modal-sub">Falls die E-Mail-Adresse zu einem freigeschalteten Konto gehört, ' +
            'erhalten Sie in Kürze einen Link zum Zurücksetzen des Passworts. Bitte prüfen Sie Ihr Postfach ' +
            'und auch den Spam-Ordner.</p>' +
            '<button type="button" class="tb-btn tb-btn-primary auth-modal-submit" data-modal-close>Schließen</button>';
    }

    function renderModalRecovery() {
        var disabled = formState === 'sending';
        modalContent.innerHTML =
            '<h2 class="auth-modal-title" id="auth-modal-title">Neues Passwort festlegen</h2>' +
            '<p class="auth-modal-sub">Bitte wählen Sie ein neues Passwort für Ihr Konto. Mindestens 8 Zeichen.</p>' +
            '<form class="auth-modal-form" id="modal-recovery-form" autocomplete="on" novalidate>' +
                '<div>' +
                    '<label class="auth-modal-label" for="modal-recovery-password">Neues Passwort</label>' +
                    '<input class="auth-modal-input" type="password" id="modal-recovery-password" autocomplete="new-password" minlength="8" required ' +
                        (disabled ? 'disabled' : '') + '>' +
                '</div>' +
                '<button type="submit" class="tb-btn tb-btn-primary auth-modal-submit"' + (disabled ? ' disabled' : '') + '>' +
                    (disabled ? 'Wird gespeichert…' : 'Passwort speichern') +
                '</button>' +
            '</form>' +
            statusBlock();

        modalContent.querySelector('#modal-recovery-form').addEventListener('submit', onRecoverySubmit);
    }

    function renderModalRecoveryDone() {
        modalContent.innerHTML =
            '<h2 class="auth-modal-title" id="auth-modal-title">Passwort gespeichert</h2>' +
            '<p class="auth-modal-sub">Sie sind jetzt angemeldet.</p>' +
            '<button type="button" class="tb-btn tb-btn-primary auth-modal-submit" data-modal-close>Schließen</button>';
    }

    function statusBlock() {
        if (formState !== 'error') return '';
        return '<div class="auth-modal-status auth-modal-status-error">' +
            escapeHtml(formMessage || 'Anmeldung fehlgeschlagen.') +
            '</div>';
    }

    // ---- Submit handlers -----------------------------------------------

    function onSigninSubmit(e) {
        e.preventDefault();
        if (formState === 'sending') return;
        var emailInput    = modal.querySelector('#modal-signin-email');
        var passwordInput = modal.querySelector('#modal-signin-password');
        if (!emailInput || !passwordInput) return;
        var email    = (emailInput.value || '').trim();
        var password = passwordInput.value || '';
        if (!email || !password) return;
        formState = 'sending';
        formMessage = '';
        renderModal();
        Sb.signInWithPassword(email, password).then(function () {
            // SIGNED_IN event will close the modal + render signed-in state.
        }).catch(function (err) {
            formState = 'error';
            formMessage = friendlyAuthError(err);
            renderModal();
        });
    }

    function onResetSubmit(e) {
        e.preventDefault();
        if (formState === 'sending') return;
        var emailInput = modal.querySelector('#modal-reset-email');
        if (!emailInput) return;
        var email = (emailInput.value || '').trim();
        if (!email) return;
        formState = 'sending';
        formMessage = '';
        renderModal();
        Sb.resetPasswordForEmail(email).then(function () {
            formState = 'idle';
            modalView = 'reset-sent';
            renderModal();
        }).catch(function (err) {
            formState = 'error';
            formMessage = friendlyAuthError(err);
            renderModal();
        });
    }

    function onRecoverySubmit(e) {
        e.preventDefault();
        if (formState === 'sending') return;
        var passwordInput = modal.querySelector('#modal-recovery-password');
        if (!passwordInput) return;
        var pw = passwordInput.value || '';
        if (!pw || pw.length < 8) {
            formState = 'error';
            formMessage = 'Passwort muss mindestens 8 Zeichen lang sein.';
            renderModal();
            return;
        }
        formState = 'sending';
        formMessage = '';
        renderModal();
        Sb.updatePassword(pw).then(function () {
            formState = 'idle';
            modalView = 'recovery-done';
            renderModal();
        }).catch(function (err) {
            formState = 'error';
            formMessage = friendlyAuthError(err);
            renderModal();
        });
    }

    // ---- Helpers -------------------------------------------------------

    /**
     * Translate the common Supabase password-auth errors into German.
     * Supabase deliberately returns the same generic "Invalid login
     * credentials" for both wrong-email and wrong-password cases — that's
     * by design (avoids leaking which emails exist), so we mirror the
     * ambiguity in the friendly message.
     */
    function friendlyAuthError(err) {
        var msg = (err && err.message) ? String(err.message) : '';
        if (/Invalid login credentials/i.test(msg))     return 'E-Mail oder Passwort ist falsch.';
        if (/Email not confirmed/i.test(msg))           return 'E-Mail-Adresse ist noch nicht bestätigt.';
        if (/Email logins are disabled/i.test(msg))     return 'Anmeldung mit E-Mail ist serverseitig deaktiviert.';
        if (/User not found|user_not_found/i.test(msg)) return 'Dieses Konto ist nicht freigeschaltet.';
        if (/Signups not allowed/i.test(msg))           return 'Dieses Konto ist nicht freigeschaltet.';
        if (/Password should be at least/i.test(msg))   return 'Passwort ist zu kurz.';
        if (/New password should be different/i.test(msg)) return 'Das neue Passwort darf nicht dem alten entsprechen.';
        if (/rate limit|too many requests/i.test(msg))  return 'Zu viele Versuche. Bitte später erneut versuchen.';
        if (/network|fetch|failed to fetch/i.test(msg)) return 'Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.';
        return msg || 'Anmeldung fehlgeschlagen.';
    }

    /**
     * Pull `error_description` out of a Supabase auth callback hash. Returns
     * the decoded description string, or null if no error is present.
     */
    function extractAuthErrorFromHash(hash) {
        if (!hash) return null;
        var match = hash.match(/[#&?]error_description=([^&]+)/);
        if (!match) return null;
        try {
            return decodeURIComponent(match[1].replace(/\+/g, ' '));
        } catch (e) {
            return match[1];
        }
    }

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
    function escapeAttr(s) { return escapeHtml(s); }

    return {
        init:       init,
        getSession: getSession,
        isSignedIn: isSignedIn,
        on:         on
    };
})();
