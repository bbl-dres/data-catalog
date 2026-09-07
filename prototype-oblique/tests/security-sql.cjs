const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, migrations } = require('../supabase/local-database.cjs');

(async () => {
  const db = await database({ setupOnly: true });
  try {
    await db.exec(fs.readFileSync(path.join(migrations, '20260906020000_catalog_public_read.sql'), 'utf8'));
    const permissions = async () => (await db.query(`SELECT
      has_table_privilege('anon', 'catalog.security_probe', 'SELECT') AS read,
      has_table_privilege('anon', 'catalog.security_probe', 'INSERT') AS write,
      has_function_privilege('anon', 'catalog.security_probe()', 'EXECUTE') AS execute`)).rows[0];
    await db.exec(`BEGIN;
      CREATE TABLE catalog.security_probe(id int);
      CREATE FUNCTION catalog.security_probe() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;`);
    assert.deepEqual(await permissions(), { read: true, write: true, execute: true }, 'Reproduce the old default-grant gap');
    await db.exec('ROLLBACK');

    // Exercise both global and schema-local grants, and preserve existing APIs.
    await db.exec(`ALTER DEFAULT PRIVILEGES GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA catalog, catalog_private GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA catalog, catalog_private GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA catalog, catalog_private GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
      CREATE TABLE public.existing_api(id int);
      CREATE FUNCTION public.existing_api() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;`);
    const migration = fs.readFileSync(path.join(migrations, '20260907000000_catalog_security.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    for (const schema of ['catalog', 'catalog_private']) {
      await db.exec(`CREATE TABLE ${schema}.security_probe(id int);
        CREATE SEQUENCE ${schema}.security_probe_seq;
        CREATE FUNCTION ${schema}.security_probe() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;`);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const { rows } = await db.query(`SELECT
          has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS table_access,
          has_sequence_privilege($1, $3, 'USAGE,SELECT,UPDATE') AS sequence_access,
          has_function_privilege($1, $4, 'EXECUTE') AS function_access`, [role, `${schema}.security_probe`, `${schema}.security_probe_seq`, `${schema}.security_probe()`]);
        assert.deepEqual(rows[0], { table_access: false, sequence_access: false, function_access: false }, schema + '/' + role);
      }
    }
    assert.deepEqual(await permissions(), { read: false, write: false, execute: false });
    const tables = (await db.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='catalog' AND tablename <> 'security_probe'")).rows;
    assert.equal(tables.length, 19);
    assert(tables.every(table => table.rowsecurity));
    for (const role of ['anon', 'authenticated']) {
      for (const { tablename } of tables) {
        const grants = (await db.query(`SELECT has_table_privilege($1, $2, 'SELECT') AS read,
          has_table_privilege($1, $2, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS write`, [role, 'catalog.' + tablename])).rows[0];
        assert.deepEqual(grants, { read: true, write: false }, role + '/' + tablename);
      }
      await db.exec(`SET ROLE ${role}`);
      try {
        assert.equal((await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot.business_object.length, 0);
        await assert.rejects(db.query('SELECT * FROM catalog.security_probe'), /permission denied/);
        await assert.rejects(db.query('SELECT catalog.security_probe()'), /permission denied/);
        await assert.rejects(db.query('SELECT * FROM catalog_private.user_access'), /permission denied/);
        await assert.rejects(db.query('CREATE TABLE catalog.untrusted(id int)'), /permission denied/);
        // Existing unrelated grants survive the default-privilege change.
        await db.query('SELECT * FROM public.existing_api');
        assert.equal((await db.query('SELECT public.existing_api() AS value')).rows[0].value, 1);
      } finally { await db.exec('RESET ROLE'); }
    }
    console.log('PASS: reproduced old anonymous read/write/RPC defaults; new tables, sequences and functions denied; 19 public read-only tables, private access and existing API grants preserved; migration is repeatable.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
