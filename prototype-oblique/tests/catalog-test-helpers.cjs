const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { database, root, migrations } = require('../supabase/local-database.cjs');
function runtime(snapshot, config = { provider: 'supabase', url: 'https://catalog.example', publishableKey: 'sb_publishable_test' }, respond = null) {
  const requests = [];
  const context = { window: { DK: {} }, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, console,
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      // respond() answers hosted reads beyond the snapshot (for example read_history); a thrown error is a failed
      // request, and { status, error } is an HTTP error response with a PostgREST error body.
      const answer = respond ? await respond(String(url), options) : undefined;
      if (answer?.status && answer.error) return { ok: false, status: answer.status, json: async () => answer.error };
      return { ok: true, json: async () => answer !== undefined ? answer : String(url).includes('/rpc/') ? snapshot : JSON.parse(fs.readFileSync(path.join(root, String(url)), 'utf8')) };
    } };
  vm.createContext(context);
  for (const file of ['resources', 'ui', 'catalog', 'data', 'router', 'access-options', 'presentation', 'detail', 'excel']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
  context.window.DK.catalogConfig = config;
  return { DK: context.window.DK, context, requests };
}
module.exports = { database, runtime, root, migrations };
