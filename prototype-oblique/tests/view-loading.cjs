/* Real SQL tiers, projection parity, version/permission guarantees and client races. */
const assert = require('node:assert/strict');
const { database, runtime } = require('./catalog-test-helpers.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const children = { objects: 'attributes', tables: 'fields', apis: 'fields', refs: 'values', products: 'attributes' };
(async () => {
  const db = await database();
  const read = async (sql, params) => (await db.query(sql, params)).rows[0].s;
  try {
    const full = await read('SELECT catalog.read_snapshot(true,false) s');
    const initial = await read('SELECT catalog.read_catalog_index() s');
    assert(initial.catalogVersion && initial.scope === 'index');
    for (const table of ['business_attribute','data_field','code_value','product_attribute','change_event']) assert(!(table in initial), table + ' stays out of the index');
    assert(initial.relationship.every(r => !('rule_notes_de' in r) && !('documentation_links' in r) && !('comment' in r)));
    assert(JSON.stringify(initial).length < JSON.stringify(full).length / 4);
    const { DK } = runtime(initial);
    await DK.data.load('data/');
    const complete = DK.catalog.project(full), index = DK.data.catalogSnapshot;
    const bundles = new Map();
    for (const [kind, table] of Object.entries(DK.catalog.kinds)) {
      for (const entity of complete[kind]) {
        const raw = await read('SELECT catalog.read_record($1,$2) s', [table, entity._record.id]);
        bundles.set(kind + ':' + entity.identifier, raw);
        const projected = DK.catalog.projectRecord(index, [raw])[kind].find(e => e.identifier === entity.identifier);
        if (children[kind]) {
          assert.deepEqual(plain(projected[children[kind]]), plain(entity[children[kind]]), kind + ':' + entity.identifier + ' complete ordered children');
          assert.equal(DK.data.sizeOf(kind, DK.data.get(kind, entity.identifier)), entity[children[kind]].length, 'Server count includes inherited visible children');
        }
        assert.deepEqual(plain(projected._relationships), plain(entity._relationships), 'Full owner evidence');
        const view = catalog => DK.data.withCatalog(catalog, () => plain(DK.data.relations(kind, catalog[kind].find(e=>e.identifier===entity.identifier))));
        assert.deepEqual(view(DK.catalog.projectRecord(index,[raw])),view(complete),kind + ':' + entity.identifier + ' relation view parity');
      }
    }
    const table = complete.tables.find(e => e.fields.some(f => f._relationships.length));
    const bundle = bundles.get('tables:' + table.identifier);
    const partial = DK.catalog.projectRecord(index, [bundle]);
    const relationShape = catalog => DK.data.withCatalog(catalog, () => plain(DK.data.relations('tables', catalog.tables.find(e => e.identifier === table.identifier))));
    assert.deepEqual(relationShape(partial), relationShape(complete), 'Represented attributes and code references resolve in one bundle');
    assert.deepEqual(await read('SELECT catalog.read_catalog_index($1) s',[initial.catalogVersion]),
      { schemaVersion: 1, catalogVersion: initial.catalogVersion, notModified: true });
    assert.deepEqual(await read('SELECT catalog.read_record($1,$2,$3) s',['data_table',table._record.id,initial.catalogVersion]),
      { schemaVersion: 1, catalogVersion: initial.catalogVersion, notModified: true });
    await assert.rejects(db.query('SELECT catalog.read_record($1,$2)', ['auth.users', table._record.id]), e => e.code === '22023');
    await assert.rejects(db.query("SELECT catalog.read_record('data_table','00000000-0000-0000-0000-000000000000')"), e => e.code === 'P0002');
    const rpc=(await db.query("SELECT bool_and(NOT prosecdef AND provolatile='s') ok FROM pg_proc WHERE pronamespace='catalog'::regnamespace AND proname IN ('read_catalog_index','read_record')")).rows[0];
    assert(rpc.ok,'Both reads respect caller RLS and the statement snapshot');
    for (const role of ['anon','authenticated','service_role']) {
      await db.exec('SET ROLE ' + role);
      assert.equal((await read('SELECT catalog.read_catalog_index() s')).catalogVersion, initial.catalogVersion);
      assert.equal((await read('SELECT catalog.read_record($1,$2) s',['data_table',table._record.id])).recordId,table._record.id);
      await assert.rejects(db.exec('UPDATE catalog.catalog_state SET version=100'), e => e.code === '42501');
      await db.exec('RESET ROLE');
    }
    await db.exec('BEGIN; UPDATE catalog.data_table SET comment=comment;');
    assert(BigInt((await read('SELECT catalog.read_catalog_index() s')).catalogVersion) > BigInt(initial.catalogVersion));
    await db.exec('ROLLBACK');
    assert.equal((await read('SELECT catalog.read_catalog_index() s')).catalogVersion, initial.catalogVersion, 'Rollback restores token');
    await db.exec('BEGIN; UPDATE catalog.catalog_state SET version=9007199254740993;');
    assert.equal((await read('SELECT catalog.read_catalog_index() s')).catalogVersion,'9007199254740993','SQL emits bigint revisions without rounding');
    await db.exec('ROLLBACK');
    // Zero-row statements also invalidate conservatively; they may never leave a changed row with an old token.
    await db.exec('UPDATE catalog.data_field SET comment=comment WHERE false');
    const newer = await read('SELECT catalog.read_catalog_index() s');
    assert.notEqual(newer.catalogVersion, initial.catalogVersion);
    assert.deepEqual(await read('SELECT catalog.read_snapshot(true,false) s'), full, 'Legacy/full snapshot contract is unchanged');
    await db.exec('BEGIN');
    const api = complete.apis[0];
    await db.query("INSERT INTO catalog.data_field(identifier,name_de,data_service_id,technical_name,technical_name_kind,source_data_type,data_type_scope) SELECT 'loading-test/'||n,'Testfeld '||n,$1,'TEST_'||n,'apiField','string','serviceSchema' FROM generate_series(1,1100) n",[api._record.id]);
    const largeIndex = await read('SELECT catalog.read_catalog_index() s');
    const largeBundle = await read('SELECT catalog.read_record($1,$2) s',['data_service',api._record.id]);
    assert.equal(largeBundle.data_field.length,1100,'RPC bundles are not truncated by the usual 1000-row table limit');
    assert.equal(largeIndex.childCounts[api._record.id],1100);
    assert(JSON.stringify(largeIndex).length-JSON.stringify(initial).length<100,'1100 extra child rows add only a count to startup');
    await db.exec('ROLLBACK');

    let reads = 0, release, fail = false, liveIndex = initial;
    const client = runtime(initial, undefined, async (url, options) => {
      const body = JSON.parse(options?.body || '{}');
      if (url.includes('read_catalog_index')) return liveIndex;
      if (url.includes('read_record')) {
        reads++;
        if (release === 'wait') await new Promise(resolve => { release = resolve; });
        if (fail) return { status: 503, error: { code: 'unavailable' } };
        return read('SELECT catalog.read_record($1,$2) s',[body.record_table,body.record_id]);
      }
    });
    await client.DK.data.load('data/');
    liveIndex = newer;
    release = 'wait';
    const first = client.DK.data.recordState('tables',table.identifier);
    const second = client.DK.data.recordState('tables',table.identifier);
    assert(first.loading && second.loading);
    assert.equal(first.promise, second.promise);
    await new Promise(resolve => setTimeout(resolve,0));
    release();
    await first.promise;
    assert.equal(reads,1);
    assert.equal(client.DK.data.catalogVersion,newer.catalogVersion,'Newer bundle refreshes index');
    assert.equal(client.DK.data.recordState('tables',table.identifier).entity.fields.length,table.fields.length);
    const field = table.fields[0];
    await client.DK.data.loadRecord('fields',client.DK.data.childId(table.identifier,field.identifier));
    assert.equal(reads,1,'Child profile shares the owner bundle');
    const other = complete.tables.find(e => e.identifier !== table.identifier && e.fields.length);
    fail = true;
    await assert.rejects(client.DK.data.loadRecord('tables',other.identifier));
    assert(client.DK.data.recordState('tables',other.identifier).error);
    fail = false;
    await client.DK.data.retryRecord('tables',other.identifier).promise;
    assert(!client.DK.data.recordState('tables',other.identifier).error);
    release = 'wait';
    const pendingOwner = complete.objects.find(e=>e.attributes.length);
    const pending = client.DK.data.recordState('objects',pendingOwner.identifier);
    await new Promise(resolve => setTimeout(resolve,0));
    await client.DK.data.load('data/');
    release();
    await pending.promise;
    assert.equal(client.DK.data.get('objects',pendingOwner.identifier).attributes.length,0,'Old request cannot republish after reset');
    console.log('View loading: all owner inventories/evidence/counts, relation parity, conditional reads, public read-only access, rollback, legacy compatibility, deduplication, refresh, retry and stale response guards passed.');
    console.log(JSON.stringify({ indexBytes: JSON.stringify(initial).length, fullBytes: JSON.stringify(full).length, owners: bundles.size }));
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
