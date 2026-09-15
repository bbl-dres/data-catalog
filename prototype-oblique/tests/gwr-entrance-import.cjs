/* Source-derived content, real PostgreSQL guards/projections and rollback; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { database, runtime } = require('./catalog-test-helpers.cjs');
const { inventory, sqlFor, importId } = require('../scripts/gwr-entrance-import.cjs');

(async () => {
  const db = await database();
  try {
    const baseline = (await db.query('SELECT catalog.read_snapshot(true) s, md5(catalog.read_snapshot(true)::text) hash, (SELECT version FROM catalog.catalog_state) version')).rows[0];
    const options = { baselineHash: baseline.hash };
    await db.exec(sqlFor(options));
    assert.equal((await db.query('SELECT md5(catalog.read_snapshot(true)::text) hash')).rows[0].hash, baseline.hash);
    assert.equal((await db.query('SELECT version FROM catalog.catalog_state')).rows[0].version, baseline.version);
    await assert.rejects(db.exec(sqlFor({ baselineHash: '0'.repeat(32), commit: true })), /Catalog changed/);
    await db.exec('ROLLBACK');
    // A fresh global hash must not hide source edits or pre-existing object identities.
    await db.exec("BEGIN; UPDATE catalog.data_field SET name_de='Changed EDID' WHERE identifier='t-gwr-gebaeudeeingang/EDID'");
    const staleSource = (await db.query('SELECT md5(catalog.read_snapshot(true)::text) hash')).rows[0].hash;
    await assert.rejects(db.exec(sqlFor({ baselineHash: staleSource, commit: true })), /GWR source field changed/);
    await db.exec('ROLLBACK');
    await db.exec(sqlFor({ ...options, commit: true }));
    const after = (await db.query('SELECT catalog.read_snapshot(true) s')).rows[0].s;
    const object = after.business_object.find(o => o.identifier === 'gebaeudeeingang');
    const attributes = after.business_attribute.filter(a => a.business_object_id === object.id);
    assert.equal(object.name_de, 'Gebäudeeingang');
    assert.equal(object.status, 'draft');
    assert.equal(object.system_of_record_id, null);
    assert.equal(attributes.length, 10);
    for (const item of inventory().attributes) {
      const actual = attributes.find(a => a.identifier === item.patch.identifier);
      for (const [key, value] of Object.entries(item.patch)) assert.deepEqual(actual[key], value, `${item.code}: ${key}`);
      const required = after.business_attribute_quality_requirement.some(q => q.business_attribute_id === actual.id);
      assert.equal(required, item.required, item.code + ' source obligation');
    }
    assert.deepEqual(attributes.filter(a => a.is_identifier).map(a => a.semantic_name).sort(), ['edid', 'egid']);
    assert.equal(after.business_object.length, baseline.s.business_object.length + 1);
    assert.equal(after.business_attribute.length, baseline.s.business_attribute.length + 10);
    assert.equal(after.relationship.length, baseline.s.relationship.length + 10);
    assert.equal(after.quality_requirement.length, baseline.s.quality_requirement.length + 1);
    assert.equal(after.change_event.filter(e => e.import_id === importId).length, 22);
    for (const [kind, rows] of Object.entries(baseline.s)) {
      if (Array.isArray(rows)) for (const old of rows) assert(after[kind].some(r => JSON.stringify(r) === JSON.stringify(old)), `Preserved ${kind}`);
    }
    const links = after.relationship.filter(r => r.identifier.startsWith('gwr-entrance/'));
    assert.equal(links.filter(r => r.relationship_type === 'represents').length, 9);
    assert(links.every(r => r.verification_status === 'confirmed'));
    assert.equal(links.find(r => r.relationship_type === 'realizes').coverage, 'partial');
    const currentHash = (await db.query('SELECT md5(catalog.read_snapshot(true)::text) hash')).rows[0].hash;
    await assert.rejects(db.exec(sqlFor({ baselineHash: currentHash, commit: true })), /already exists/);
    await db.exec('ROLLBACK');
    const index = (await db.query('SELECT catalog.read_catalog_index() s')).rows[0].s;
    assert.equal(index.childCounts[object.id], 10);
    const bundle = (await db.query('SELECT catalog.read_record($1,$2) s', ['business_object', object.id])).rows[0].s;
    assert.equal(bundle.business_attribute.filter(a => a.business_object_id === object.id).length, 10);
    const { DK } = runtime(after);
    await DK.data.load('data/');
    DK.ui.setDictionary(DK.data.i18n, 'de');
    const profile = { ...DK.data.objects.find(o => o.identifier === 'gebaeudeeingang'), kind: 'objects' };
    assert.equal(profile.attributes.length, 10);
    const plan = DK.excel.plan({ view: 'detail', kind: 'objects', entity: profile, params: {} }, { state: {}, title: profile.name }, 'http://localhost/');
    assert(plan.sheets.some(s => s.rows.length === 10));
    const output = path.join(os.tmpdir(), 'gwr-entrance-import-snapshot.json');
    fs.writeFileSync(output, JSON.stringify(after));
    console.log('GWR entrance: 10 attributes, 7 required, 9 field mappings, 1 table mapping, 22 events; rollback, stale/repeat refusal, preserved records, lazy reads and Excel passed. Snapshot: ' + output);
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
