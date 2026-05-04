/**
 * SupabaseClient — Supabase JS SDK wrapper for both data and auth.
 *
 * Read path: calls the canvas_export() RPC, which returns the same
 * { version, nodes, edges, sets } shape that data/canvas.json carries.
 * State.load() can therefore treat Supabase and the static JSON as
 * interchangeable seed sources.
 *
 * Auth path: wraps Supabase Auth's magic-link OTP flow. Sign-up is disabled
 * project-wide, so signInWithMagicLink only succeeds for emails that already
 * exist in auth.users. Authorization on top of that is enforced by RLS via
 * contact.app_role; this module is concerned only with authentication.
 *
 * The publishable key is intended for client-side embedding — it grants the
 * anon role for unauthenticated requests, and the SDK transparently switches
 * to Bearer-of-JWT once a session exists.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.SupabaseClient = (function () {
    var SUPABASE_URL = 'https://elgsfqsouwtpjxtjcuow.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_9C0rU6s4VSmYX71Vyu5hTw_9TqT-OAc';

    if (!window.supabase || !window.supabase.createClient) {
        return {
            loadCanvas: function () {
                return Promise.reject(new Error('Supabase SDK nicht geladen.'));
            },
            signInWithMagicLink: function () {
                return Promise.reject(new Error('Supabase SDK nicht geladen.'));
            },
            signOut:            function () { return Promise.resolve(); },
            getSession:         function () { return Promise.resolve(null); },
            onAuthStateChange:  function () { return { data: { subscription: { unsubscribe: function () {} } } }; }
        };
    }

    var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });

    function loadCanvas() {
        return client.rpc('canvas_export').then(function (res) {
            if (res.error) throw new Error('Supabase canvas_export: ' + res.error.message);
            return res.data;
        });
    }

    /**
     * Request a magic-link email. shouldCreateUser:false belts-and-braces the
     * project-level "Allow new users to sign up" toggle — both must agree.
     * emailRedirectTo brings the user back to the page they signed in from;
     * that URL must be in the Supabase project's Redirect URLs allowlist
     * (Authentication → URL Configuration).
     */
    function signInWithMagicLink(email) {
        return client.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: false,
                emailRedirectTo: window.location.origin + window.location.pathname
            }
        }).then(function (res) {
            if (res.error) throw res.error;
            return res.data;
        });
    }

    function signOut() {
        return client.auth.signOut().then(function (res) {
            if (res && res.error) throw res.error;
        });
    }

    function getSession() {
        return client.auth.getSession().then(function (res) {
            return res && res.data ? res.data.session : null;
        });
    }

    /**
     * Subscribe to auth state changes. Returns the subscription object
     * (with .unsubscribe()) so callers can detach if needed.
     */
    function onAuthStateChange(cb) {
        var res = client.auth.onAuthStateChange(function (event, session) {
            try { cb(event, session); } catch (e) { console.error(e); }
        });
        return res && res.data ? res.data.subscription : null;
    }

    return {
        client:              client,
        loadCanvas:          loadCanvas,
        signInWithMagicLink: signInWithMagicLink,
        signOut:             signOut,
        getSession:          getSession,
        onAuthStateChange:   onAuthStateChange
    };
})();
