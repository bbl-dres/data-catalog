/**
 * SupabaseClient — Supabase JS SDK wrapper for both data and auth.
 *
 * Read path: calls the canvas_export() RPC, which returns the same
 * { version, nodes, edges, sets } shape that data/canvas.json carries.
 * State.load() can therefore treat Supabase and the static JSON as
 * interchangeable seed sources.
 *
 * Auth path: wraps Supabase Auth's email + password flow. Sign-up is disabled
 * on the Email provider, so signInWithPassword only succeeds for credentials
 * an admin pre-created. Authorization on top of that is enforced by RLS via
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
            listCanvases: function () {
                return Promise.reject(new Error('Supabase SDK nicht geladen.'));
            },
            createCanvas: function () {
                return Promise.reject(new Error('Supabase SDK nicht geladen.'));
            },
            applyCanvas: function () {
                return Promise.reject(new Error('Supabase SDK nicht geladen.'));
            },
            signInWithPassword: function () {
                return Promise.reject(new Error('Supabase SDK nicht geladen.'));
            },
            resetPasswordForEmail: function () {
                return Promise.reject(new Error('Supabase SDK nicht geladen.'));
            },
            updatePassword: function () {
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

    /**
     * Fetch a single canvas's payload via canvas_export(slug). Slug-less call
     * keeps the v0.3 default-canvas behaviour (the RPC's parameter has a
     * 'default' DEFAULT in migration 006).
     */
    function loadCanvas(slug) {
        var args = slug ? { canvas_slug: slug } : {};
        return client.rpc('canvas_export', args).then(function (res) {
            if (res.error) throw new Error('Supabase canvas_export: ' + res.error.message);
            return res.data;
        });
    }

    /**
     * Atomically replace the named canvas's content via the canvas_apply()
     * RPC (migration 007). The payload is DB-shape — see State.serializeDraft.
     * Resolves on success with the function's row-count summary; rejects on
     * RLS / network / SQL errors.
     */
    function applyCanvas(slug, payload) {
        return client.rpc('canvas_apply', { canvas_slug: slug, payload: payload })
            .then(function (res) {
                if (res.error) {
                    var msg = res.error.message || 'canvas_apply failed';
                    var code = res.error.code ? ' (' + res.error.code + ')' : '';
                    throw new Error(msg + code);
                }
                return res.data;
            });
    }

    /**
     * Create a new canvas row. Goes via PostgREST INSERT — RLS policy
     * `canvas_write` already permits authenticated editors to INSERT, so no
     * dedicated RPC is needed. The DB enforces slug uniqueness + format and
     * visibility CHECK; failures bubble up as Supabase errors.
     */
    function createCanvas(data) {
        return client
            .from('canvas')
            .insert([data])
            .select()
            .single()
            .then(function (res) {
                if (res.error) {
                    var msg = res.error.message || 'canvas insert failed';
                    var code = res.error.code ? ' (' + res.error.code + ')' : '';
                    throw new Error(msg + code);
                }
                return res.data;
            });
    }

    /**
     * Fetch the canvas overview list. Anon RLS exposes only public canvases;
     * authenticated users see all (sign-in is what unlocks restricted ones).
     */
    function listCanvases() {
        return client
            .from('canvas')
            .select('id, slug, label_de, label_fr, label_it, label_en, description_de, visibility, modified_at')
            .order('modified_at', { ascending: false })
            .then(function (res) {
                if (res.error) throw new Error('Supabase canvas list: ' + res.error.message);
                return res.data || [];
            });
    }

    /**
     * Sign in with email + password. Stays on the page (no redirect, no
     * PKCE, no URL hash params). Allowlisting is enforced at the Supabase
     * side: "Allow new users to sign up" must be OFF on the Email provider
     * so unknown emails get rejected with "Invalid login credentials"
     * regardless of password.
     */
    function signInWithPassword(email, password) {
        return client.auth.signInWithPassword({
            email: email,
            password: password
        }).then(function (res) {
            if (res.error) throw res.error;
            return res.data;
        });
    }

    /**
     * Send a password recovery email. The link in the email returns the user
     * to redirectTo with auth tokens that the SDK turns into a temporary
     * session and a PASSWORD_RECOVERY event — Auth.js opens the modal in
     * "set new password" mode at that point.
     */
    function resetPasswordForEmail(email) {
        return client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        }).then(function (res) {
            if (res.error) throw res.error;
            return res.data;
        });
    }

    /** Update the currently-signed-in user's password (used by the recovery flow). */
    function updatePassword(newPassword) {
        return client.auth.updateUser({ password: newPassword }).then(function (res) {
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
        client:                client,
        loadCanvas:            loadCanvas,
        listCanvases:          listCanvases,
        createCanvas:          createCanvas,
        applyCanvas:           applyCanvas,
        signInWithPassword:    signInWithPassword,
        resetPasswordForEmail: resetPasswordForEmail,
        updatePassword:        updatePassword,
        signOut:               signOut,
        getSession:            getSession,
        onAuthStateChange:     onAuthStateChange
    };
})();
