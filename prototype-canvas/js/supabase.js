/**
 * SupabaseClient — read-only seed loader against the Supabase project.
 *
 * Calls the canvas_export() RPC, which returns the same
 * { version, nodes, edges, sets } shape that data/canvas.json carries.
 * State.load() can therefore treat Supabase and the static JSON as
 * interchangeable seed sources.
 *
 * The publishable key is intended for client-side embedding — it grants the
 * anon role, which only has SELECT on catalog tables (see
 * migrations/002_anon_read_and_canvas_export.sql). Writes still go through
 * the existing localStorage-backed Bearbeiten flow.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.SupabaseClient = (function () {
    var SUPABASE_URL = 'https://elgsfqsouwtpjxtjcuow.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_9C0rU6s4VSmYX71Vyu5hTw_9TqT-OAc';

    function loadCanvas() {
        var url = SUPABASE_URL + '/rest/v1/rpc/canvas_export';
        return fetch(url, {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type':  'application/json'
            },
            body: '{}'
        }).then(function (r) {
            if (!r.ok) {
                return r.text().then(function (body) {
                    throw new Error('Supabase canvas_export ' + r.status + ': ' + body);
                });
            }
            return r.json();
        });
    }

    return { loadCanvas: loadCanvas };
})();
