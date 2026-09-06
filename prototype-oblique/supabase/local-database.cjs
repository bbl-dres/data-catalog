/* Isolated PostgreSQL for migration checks and generated API documentation. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const migrations = path.join(__dirname, 'migrations');
const migrationFiles = () => fs.readdirSync(migrations).filter(file => file.endsWith('.sql')).sort();

async function database({ bundle = false, setupOnly = false, includeData = true } = {}) {
  const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
      ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
    let files = migrationFiles();
    if (bundle || setupOnly) files = files.slice(0, 2);
    if (!includeData) files = files.filter(file => !file.endsWith('_catalog_import.sql'));
    for (const file of files) await db.exec(fs.readFileSync(path.join(migrations, file), 'utf8'));
    if (bundle) await db.exec(fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8'));
    return db;
  } catch (error) { await db.close(); throw error; }
}

module.exports = { database, migrationFiles, root, migrations };
