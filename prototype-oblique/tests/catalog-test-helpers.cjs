const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { database, root, migrations } = require('../supabase/local-database.cjs');
function runtime(snapshot, config = { provider: 'supabase', url: 'https://catalog.example', publishableKey: 'sb_publishable_test' }) {
  const requests = [];
  const context = { window: { DK: {} }, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, console,
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      return { ok: true, json: async () => String(url).includes('/rpc/') ? snapshot : JSON.parse(fs.readFileSync(path.join(root, String(url)), 'utf8')) };
    } };
  vm.createContext(context);
  for (const file of ['ui', 'catalog', 'data', 'router', 'presentation', 'detail', 'excel']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
  context.window.DK.catalogConfig = config;
  return { DK: context.window.DK, context, requests };
}
module.exports = { database, runtime, root, migrations };
