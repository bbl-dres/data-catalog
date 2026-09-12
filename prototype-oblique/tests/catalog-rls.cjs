/* Exercise both migrations with database roles and simulated Supabase JWT claims. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const migration = name => fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8');
const schemaSql = migration('20260906000000_catalog_schema.sql');
const rlsSql = migration('20260906010000_catalog_rls.sql');
const uuid = number => '00000000-0000-0000-0000-' + String(number).padStart(12, '0');
const id = number => `'${uuid(number)}'`;

async function main() {
  const db = new PGlite();
  let passed = 0;
  const reject = async (label, sql, code = '42501') => {
    await assert.rejects(db.exec(sql), error => {
      assert.equal(error.code, code, label + ': ' + error.message);
      return true;
    }, label);
    passed++;
  };
  const check = async (label, sql, expected) => {
    assert.deepEqual((await db.query(sql)).rows, expected, label);
    passed++;
  };
  const asUser = async (role, number, extra, work) => {
    await db.exec('BEGIN;');
    try {
      const claims = number == null ? {} : { sub: uuid(number), role, is_anonymous: false, ...extra };
      await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await db.exec('SET LOCAL ROLE ' + role);
      await work();
    } finally {
      await db.exec('ROLLBACK;');
    }
  };
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated, service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
        SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
      $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(auth.jwt()->>'sub', '')::uuid
      $$;
      REVOKE ALL ON TABLE auth.users FROM PUBLIC, anon, authenticated, service_role;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    `);
    await reject('RLS migration requires base schema', rlsSql, 'P0001');
    await db.exec('ROLLBACK;');
    await db.exec(schemaSql);
    await db.exec('CREATE POLICY unexpected_allow ON catalog.domain FOR SELECT TO authenticated USING (true)');
    await reject('unexpected permissive policies fail closed', rlsSql, 'P0001');
    await db.exec('ROLLBACK; DROP POLICY unexpected_allow ON catalog.domain;');
    await db.exec('CREATE VIEW catalog.unreviewed_view AS SELECT * FROM catalog.domain;');
    await reject('pre-existing definer view must be reviewed', rlsSql, 'P0001');
    await db.exec('ROLLBACK; DROP VIEW catalog.unreviewed_view;');
    await db.exec('CREATE TABLE catalog.unreviewed_table(id integer);');
    await reject('additional tables cannot gain access through old grants', rlsSql, 'P0001');
    await db.exec('ROLLBACK; DROP TABLE catalog.unreviewed_table;');
    await db.exec('CREATE FUNCTION catalog.unreviewed_rpc() RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;');
    await reject('pre-existing definer RPC must be reviewed', rlsSql, 'P0001');
    await db.exec('ROLLBACK; DROP FUNCTION catalog.unreviewed_rpc();');
    await db.exec(rlsSql);
    passed++;

    await db.exec(`
      INSERT INTO auth.users(id) VALUES (${id(1)}),(${id(2)}),(${id(3)}),(${id(4)});
      INSERT INTO catalog_private.user_access VALUES (${id(1)},'reader'),(${id(2)},'editor'),(${id(4)},'reader');
      INSERT INTO catalog.actor(id,identifier,name_en,actor_type) VALUES (${id(10)},'contact','Contact','person');
      INSERT INTO catalog.domain(id,identifier,name_en) VALUES (${id(11)},'buildings','Buildings');
      INSERT INTO catalog.system(id,identifier,name_en) VALUES (${id(12)},'source','Source');
      INSERT INTO catalog.business_object(id,identifier,name_en,domain_id,classification)
        VALUES (${id(13)},'building','Building',${id(11)},'secret');
      INSERT INTO catalog.code_list(id,identifier,name_en) VALUES (${id(14)},'codes','Codes');
      INSERT INTO catalog.code_value(identifier,name_en,code_list_id,code) VALUES ('code-one','One',${id(14)},'01');
      INSERT INTO catalog.quality_requirement(id,identifier,name_en,rule_type,dimension)
        VALUES (${id(15)},'required','Required','required','completeness');
      INSERT INTO catalog.business_attribute(id,identifier,name_en,business_object_id,semantic_name)
        VALUES (${id(16)},'building-name','Name',${id(13)},'name');
      INSERT INTO catalog.data_table(id,identifier,name_en,system_id)
        VALUES (${id(17)},'table-one','One',${id(12)}),(${id(18)},'table-two','Two',${id(12)});
      INSERT INTO catalog.data_field(id,identifier,name_en,data_table_id,technical_name,technical_name_kind)
        VALUES (${id(19)},'field-one','Field',${id(17)},'NAME','physicalColumn');
      INSERT INTO catalog.data_product(id,identifier,name_en,access_mode)
        VALUES (${id(20)},'product','Product','public');
      INSERT INTO catalog.product_attribute(identifier,name_en,data_product_id,semantic_name)
        VALUES ('product-name','Name',${id(20)},'name');
      INSERT INTO catalog.data_service(id,identifier,name_en) VALUES (${id(21)},'api','API');
      INSERT INTO catalog.service_endpoint(identifier,data_service_id,relative_path) VALUES ('detail',${id(21)},'/detail');
      INSERT INTO catalog.relationship(identifier,source_data_table_id,target_business_object_id,relationship_type,coverage)
        VALUES ('realization',${id(17)},${id(13)},'realizes','unknown');
      INSERT INTO catalog.lineage_relation(identifier,source_data_table_id,target_data_table_id,operation)
        VALUES ('copy',${id(17)},${id(18)},'copy');
      INSERT INTO catalog.change_event(identifier,record_domain_id,occurred_on,action,summary_en)
        VALUES ('event',${id(11)},'2026-09-06','created','Created the domain');
      INSERT INTO catalog.business_attribute_quality_requirement VALUES (${id(16)},${id(15)});
      INSERT INTO catalog.data_field_quality_requirement VALUES (${id(19)},${id(15)});
    `);
    const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='catalog' ORDER BY tablename")).rows.map(row => row.tablename);
    assert.equal(tables.length, 19);
    const counts = {};
    for (const table of tables) {
      counts[table] = (await db.query(`SELECT count(*)::int AS count FROM catalog.${table}`)).rows;
      assert.ok(counts[table][0].count > 0, table + ' fixture must exercise actual rows');
    }
    await check('all policies are authenticated SELECT only', `SELECT count(*)::int AS count,
      bool_and(cmd='SELECT' AND roles=ARRAY['authenticated']::name[]) AS restricted
      FROM pg_policies WHERE schemaname='catalog'`, [{ count: 19, restricted: true }]);
    await check('private membership table has RLS without client policies', `SELECT relrowsecurity AS enabled,
      NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='catalog_private' AND tablename='user_access') AS no_policies
      FROM pg_class WHERE oid='catalog_private.user_access'::regclass`, [{ enabled: true, no_policies: true }]);
    await check('helper has a fixed search path and trusted owner', `SELECT prosecdef AS definer,
      proconfig=ARRAY['search_path=""']::text[] AS fixed_path, pg_get_userbyid(proowner)='postgres' AS trusted_owner
      FROM pg_proc WHERE oid='catalog_private.has_catalog_access(text)'::regprocedure`, [{ definer: true, fixed_path: true, trusted_owner: true }]);
    await reject('unknown account cannot be granted access', `INSERT INTO catalog_private.user_access VALUES (${id(999)},'reader')`, '23503');
    await reject('undefined access role rejected', `INSERT INTO catalog_private.user_access VALUES (${id(3)},'admin')`, '23514');

    for (const table of tables) {
      await asUser('anon', null, {}, () => reject('anonymous read denied: ' + table, `SELECT * FROM catalog.${table}`));
    }
    await asUser('authenticated', 3, {}, async () => {
      for (const table of tables) await check('unlisted account has no rows: ' + table, `SELECT count(*)::int AS count FROM catalog.${table}`, [{ count: 0 }]);
      await check('unlisted helper result', 'SELECT catalog_private.has_catalog_access() AS allowed', [{ allowed: false }]);
    });
    for (const [number, role] of [[1, 'reader'], [2, 'editor']]) {
      await asUser('authenticated', number, {}, async () => {
        for (const table of tables) await check(role + ' reads ' + table, `SELECT count(*)::int AS count FROM catalog.${table}`, counts[table]);
        await check(role + ' permissions', "SELECT catalog_private.has_catalog_access('reader') AS read, catalog_private.has_catalog_access('editor') AS edit", [{ read: true, edit: role === 'editor' }]);
      });
      for (const table of tables) {
        for (const operation of [
          `INSERT INTO catalog.${table} DEFAULT VALUES`,
          `UPDATE catalog.${table} SET ${table.endsWith('_quality_requirement') ? 'quality_requirement_id=quality_requirement_id' : 'id=id'}`,
          `DELETE FROM catalog.${table}`,
          `TRUNCATE catalog.${table}`,
        ]) await asUser('authenticated', number, {}, () => reject(role + ' cannot mutate ' + table, operation));
      }
      await asUser('authenticated', number, {}, () => reject(role + ' cannot list access grants', 'SELECT * FROM catalog_private.user_access'));
      await asUser('authenticated', number, {}, () => reject(role + ' cannot self-promote', `UPDATE catalog_private.user_access SET access_role='editor' WHERE user_id=${id(number)}`));
      await asUser('authenticated', number, {}, () => reject(role + ' cannot invite another user', `INSERT INTO catalog_private.user_access VALUES (${id(3)},'reader')`));
    }
    await asUser('authenticated', 3, { user_metadata: { access_role: 'editor' }, app_metadata: { access_role: 'editor' } }, async () => {
      await check('metadata claims cannot replace private membership', 'SELECT count(*)::int AS count FROM catalog.domain', [{ count: 0 }]);
    });
    await asUser('authenticated', 4, { is_anonymous: true }, async () => {
      await check('even an allowlisted anonymous Auth user is denied', 'SELECT count(*)::int AS count FROM catalog.domain', [{ count: 0 }]);
    });
    await asUser('authenticated', null, {}, async () => {
      await check('missing JWT subject denied', 'SELECT count(*)::int AS count FROM catalog.domain', [{ count: 0 }]);
    });
    await asUser('authenticated', 1, {}, async () => {
      await check('invalid requested role fails closed', "SELECT catalog_private.has_catalog_access('admin') AS unknown, catalog_private.has_catalog_access(NULL) AS missing", [{ unknown: false, missing: false }]);
      await check('source classification is not catalog authorization', 'SELECT classification AS classification FROM catalog.business_object', [{ classification: 'secret' }]);
      await check('can read contact and history without owning an Actor', `SELECT NOT EXISTS (SELECT FROM catalog.actor WHERE id=${id(1)}) AS no_actor`, [{ no_actor: true }]);
    });
    await asUser('authenticated', 3, {}, () => check('public source access mode does not expose its catalog entry', 'SELECT count(*)::int AS count FROM catalog.data_product', [{ count: 0 }]));
    await asUser('anon', null, {}, () => reject('anon cannot invoke the access helper', 'SELECT catalog_private.has_catalog_access()'));
    await asUser('authenticated', 1, {}, () => reject('membership grants no access to integrity helper functions', "SELECT catalog_private.is_http_url('https://example.com')"));
    await asUser('authenticated', 1, {}, () => reject('member cannot create functions to shadow authorization', 'CREATE FUNCTION catalog_private.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$'));

    await db.exec(`DELETE FROM catalog_private.user_access WHERE user_id=${id(1)}`);
    await asUser('authenticated', 1, {}, () => check('revocation works with unchanged JWT claims', 'SELECT count(*)::int AS count FROM catalog.domain', [{ count: 0 }]));
    await db.exec(`UPDATE catalog_private.user_access SET access_role='reader' WHERE user_id=${id(2)}`);
    await asUser('authenticated', 2, {}, () => check('downgrade uses current database assignment', "SELECT catalog_private.has_catalog_access('editor') AS editor", [{ editor: false }]));
    await db.exec(`DELETE FROM auth.users WHERE id=${id(2)}`);
    await check('deleting Auth user removes its access grant', `SELECT count(*)::int AS count FROM catalog_private.user_access WHERE user_id=${id(2)}`, [{ count: 0 }]);
    await asUser('authenticated', 2, {}, () => check('deleted user token no longer grants access', 'SELECT count(*)::int AS count FROM catalog.domain', [{ count: 0 }]));

    await asUser('service_role', null, {}, async () => {
      for (const table of tables) await check('trusted backend read: ' + table, `SELECT count(*)::int AS count FROM catalog.${table}`, counts[table]);
    });
    await asUser('service_role', null, {}, () => reject('service role cannot manage access grants', `INSERT INTO catalog_private.user_access VALUES (${id(3)},'editor')`));
    await asUser('service_role', null, {}, () => reject('service role still has no direct writes', "UPDATE catalog.domain SET name_en='Changed'"));

    // If someone later adds a write grant by mistake, the missing write policies still deny it.
    await db.exec('GRANT INSERT, UPDATE, DELETE ON catalog.domain TO authenticated;');
    await asUser('authenticated', 4, {}, async () => {
      await check('fault-injection user still has read access', 'SELECT count(*)::int AS count FROM catalog.domain', counts.domain);
      await check('RLS protects UPDATE independently of grants', "UPDATE catalog.domain SET name_en='Changed' RETURNING id", []);
      await check('RLS protects DELETE independently of grants', 'DELETE FROM catalog.domain RETURNING id', []);
    });
    await asUser('authenticated', 4, {}, async () => {
      await assert.rejects(db.exec("INSERT INTO catalog.domain(identifier,name_en) VALUES ('intruder','Intruder')"), error => error.code === '42501' && /row-level security/.test(error.message));
      passed++;
    });
    await db.exec('REVOKE INSERT, UPDATE, DELETE ON catalog.domain FROM authenticated;');
    await reject('second RLS application cannot silently reset access', rlsSql, 'P0001');
    await db.exec('ROLLBACK;');
    await check('failed migration preserves remaining membership', `SELECT user_id::text AS id,access_role AS role FROM catalog_private.user_access`, [{ id: uuid(4), role: 'reader' }]);
    console.log(`${passed} catalog RLS checks passed (PostgreSQL via PGlite).`);
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
