const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const migrations = path.join(root, 'supabase/migrations');
async function database({ bundle = false, setupOnly = false } = {}) {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
      ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
    const files = fs.readdirSync(migrations).filter(f => f.endsWith('.sql')).sort();
    for (const file of bundle || setupOnly ? files.slice(0, 2) : files) await db.exec(fs.readFileSync(path.join(migrations, file), 'utf8'));
    if (bundle) await db.exec(fs.readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8'));
    return db;
  } catch (error) { await db.close(); throw error; }
}
function runtime(snapshot, config = { provider: 'supabase', url: 'https://catalog.example', publishableKey: 'sb_publishable_test' }) {
  const requests = [];
  const context = { window: { DK: {} }, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, console,
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      return { ok: true, json: async () => String(url).includes('/rpc/') ? snapshot : JSON.parse(fs.readFileSync(path.join(root, String(url)), 'utf8')) };
    } };
  vm.createContext(context);
  for (const file of ['ui', 'catalog', 'data', 'router', 'detail', 'excel']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context);
  context.window.DK.catalogConfig = config;
  return { DK: context.window.DK, context, requests };
}
module.exports = { database, runtime, root, migrations };
