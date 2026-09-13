/* Execute FK, audited edit and frontend projection behavior against real local SQL. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs'), path = require('node:path');
const { database, runtime } = require('./catalog-test-helpers.cjs');
const { configureIdentity, request, command } = require('./editing-sql.cjs');
const { write, command: apiCommand } = require('./rest-crud.cjs');

(async () => {
  const earlier = await database({ setupOnly: true });
  try {
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260913000000_catalog_system_of_record.sql'), 'utf8');
    await assert.rejects(earlier.exec(migration), e => e.code === '55000', 'Missing prerequisites fail before any schema change');
    await earlier.exec('ROLLBACK');
    assert.equal((await earlier.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='catalog' AND column_name='system_of_record_id'")).rows[0].n, 0);
  } finally { await earlier.close(); }
  const db = await database();
  try {
    await configureIdentity(db);
    const snapshot = async () => (await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
    const read = async (table, id) => (await db.query(`SELECT * FROM catalog.${table} WHERE id=$1`, [id])).rows[0];
    let s = await snapshot();
    const object = s.business_object.find(r => r.identifier === 'gebaeude');
    const attribute = s.business_attribute.find(r => r.business_object_id === object.id);
    const [system, override] = s.system;
    assert(s.business_object.every(r => r.system_of_record_id === null));
    assert(s.business_attribute.every(r => r.system_of_record_id === null), 'No inference from legacy source labels');
    const fks = (await db.query(`SELECT c.confdeltype, a.attname FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.contype='f' AND c.confrelid='catalog.system'::regclass AND a.attname='system_of_record_id'`)).rows;
    assert.equal(fks.length, 2); assert(fks.every(r => r.confdeltype === 'r'));
    const designation = command('business_object', object, { system_of_record_id: system.id });
    await assert.rejects(request(db, designation, { role: 'anon', user: null }), e => e.code === '42501');
    await assert.rejects(request(db, command('business_object', object, { system_of_record_id: system.identifier })), e => e.code === '22P02');
    await assert.rejects(request(db, command('business_object', object, { system_of_record_id: crypto.randomUUID() })), e => e.code === '23503');
    await assert.rejects(write(db, apiCommand('business_object', { system_of_record_id: s.domain[0].id }, object)), e => e.code === '23503');
    const saved = await request(db, designation);
    assert.deepEqual(await request(db, designation), saved, 'Idempotent assignment');
    assert.equal(saved.row_version, object.row_version + 1);
    const history = (await db.query('SELECT before, after, changed_properties FROM catalog.change_event WHERE record_business_object_id=$1 ORDER BY occurred_at DESC NULLS LAST LIMIT 1', [object.id])).rows[0];
    assert.equal(history.before.system_of_record_id, null);
    assert.equal(history.after.system_of_record_id, system.id);
    assert(history.changed_properties.includes('system_of_record_id'));
    await assert.rejects(request(db, command('business_object', object, { system_of_record_id: override.id })), e => e.code === '40001');
    async function projected() {
      const { DK } = runtime(await snapshot());
      await DK.data.load('data/'); DK.ui.setDictionary(DK.data.i18n, 'de');
      const parent = DK.data.get('objects', object.identifier);
      const child = parent.attributes.find(a => a._record.id === attribute.id);
      return { DK, parent, child: { ...DK.data.attr(parent.identifier + '/' + child.identifier), kind: 'attrs' } };
    }
    let p = await projected();
    assert.equal(p.parent.systemOfRecord, system.identifier);
    assert.equal(p.child.systemOfRecord, system.identifier);
    assert.equal(p.child.systemOfRecordInheritedFrom, object.identifier);
    assert.equal(p.child._record.system_of_record_id, null, 'Inheritance is never materialized');
    assert(p.DK.detail.facts(p.child).primary.some(f => f.label === p.DK.ui.t('fact.systemOfRecord') && f.href?.includes(system.identifier) && f.value.includes(p.DK.ui.t('systemOfRecord.inherited'))));
    assert(p.DK.presentation.choices('attrs').some(f => f.id === 'systemOfRecord'));
    await assert.rejects(write(db, apiCommand('business_attribute', { system_of_record_id: 'SAP RE-FX' }, attribute)), e => e.code === '22P02');
    await write(db, apiCommand('business_attribute', { system_of_record_id: override.id }, attribute));
    p = await projected();
    assert.equal(p.child.systemOfRecord, override.identifier);
    assert.equal(p.child.systemOfRecordInheritedFrom, null);
    await write(db, apiCommand('system', { name_de: 'Renamed reference system' }, await read('system', override.id)));
    p = await projected();
    assert.equal(p.DK.data.systemOfRecordOf(p.child).name, 'Renamed reference system', 'Names resolve from System');
    await write(db, apiCommand('system', {}, await read('system', override.id), 'delete'));
    p = await projected();
    const fact = p.DK.detail.facts(p.child).primary.find(f => f.label === p.DK.ui.t('fact.systemOfRecord'));
    assert(fact.value.includes('Renamed reference system')); assert(!fact.href, 'Archived reference stays visible without a broken link');
    await request(db, command('business_attribute', await read('business_attribute', attribute.id), { system_of_record_id: null }));
    p = await projected(); assert.equal(p.child.systemOfRecord, system.identifier);
    await write(db, apiCommand('business_object', { system_of_record_id: null }, await read('business_object', object.id)));
    p = await projected(); assert.equal(p.child.systemOfRecord, undefined);
    assert.equal(p.DK.detail.facts(p.child).primary.find(f => f.label === p.DK.ui.t('fact.systemOfRecord')).value, null);
    assert.equal((await read('business_attribute', attribute.id)).system_of_record_id, null);
    const created = await write(db, apiCommand('business_object', { name_en: 'Explicit reference', domain_id: object.domain_id, system_of_record_id: system.id }));
    assert.equal(created.system_of_record_id, system.id, 'REST creation accepts a real System UUID');
    console.log('System of record: FK validation, no backfill, audited browser/REST writes, retries/conflicts, inheritance/override/clear, rename and archive rendering passed.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
