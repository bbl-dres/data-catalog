/* Execute the 106-attribute synchronization against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const profilesSql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-profiles.sql'), 'utf8');
const labelsSql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-labels.sql'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-geometry.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const countsSql = sql.match(/SELECT o\.identifier AS business_object[\s\S]*?ORDER BY o\.identifier;/)[0];
const listsSql = sql.match(/SELECT l\.identifier AS liste[\s\S]*?ORDER BY l\.identifier;/)[0];
const snapshot = async db => (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot;
const ledger = async db => (await db.query('SELECT * FROM catalog_private.import_batch ORDER BY identifier')).rows;
const assignedRules = async (db, attribute) => (await db.query(`SELECT q.identifier FROM catalog.business_attribute_quality_requirement l
  JOIN catalog.business_attribute a ON a.id = l.business_attribute_id
  JOIN catalog.quality_requirement q ON q.id = l.quality_requirement_id
  WHERE a.identifier = '${attribute}' ORDER BY q.identifier`)).rows.map(r => r.identifier);
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
async function rejectWithoutChanges(db, script, pattern) {
  const before = await snapshot(db), batches = await ledger(db);
  await assert.rejects(db.exec(script), pattern); checks++;
  await db.exec('ROLLBACK');
  check(await snapshot(db), before, 'Failure rolls back all catalog edits');
  check(await ledger(db), batches, 'Failure does not consume operation marker');
}

(async () => {
  const db = await database();
  try {
    await rejectWithoutChanges(db, sql, /Apply the German naming follow-up first/);
    await db.exec(profilesSql);
    await rejectWithoutChanges(db, sql, /Apply the German naming follow-up first/);
    await db.exec(labelsSql);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.business_object === 'geschoss' && Number(row.active_attributes) === 13)),
      'Preview shows the extended profile counts'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 44', '"expectedChanges": 45'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    check(proposal.changes.length, 28, '28 reviewed record edits');
    check(proposal.createAttributes.length, 8, 'Eight new attribute definitions');
    check(proposal.createValues.length, 8, 'Eight new vocabulary values');

    const counts = (await db.query(countsSql)).rows;
    for (const [id, expected] of Object.entries(proposal.counts))
      check(Number(counts.find(r => r.business_object === id).active_attributes), expected, 'Active profile count: ' + id);
    check(counts.map(r => [r.business_object, Number(r.retired_attributes)]),
      [['bemessung', 2], ['gebaeude', 1], ['geschoss', 0], ['grundstueck', 3], ['raum', 0], ['wirtschaftseinheit', 1], ['zone', 0]],
      'Retired definitions and their history survive');

    // Reviewed edits apply exactly once; everything else is untouched.
    const touched = new Map(proposal.changes.map(c => [c.kind + ':' + c.id, c]));
    const created = new Set([
      ...proposal.createAttributes.map(a => 'business_attribute:' + a.object + '/' + a.id),
      ...proposal.createValues.map(v => 'code_value:' + v.list + '/' + v.code)]);
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.identifier)) {
      for (const row of after[table]) {
        const key = table + ':' + row.identifier;
        const change = touched.get(key);
        const previous = before[table].find(r => r.id === row.id);
        if (change) {
          check(row.row_version, change.revision + 1, 'One edit revision: ' + key);
          check(row.modified_on, today, 'Edit date: ' + key);
          for (const [field, value] of Object.entries(change.after)) check(row[field], value, 'Exact text: ' + key + '/' + field);
          for (const field of Object.keys(previous)) if (!(field in change.after) && !['row_version', 'modified_on'].includes(field))
            check(row[field], previous[field], 'Unrelated field preserved: ' + key + '/' + field);
        } else if (created.has(key)) {
          check(previous, undefined, 'Created record is new: ' + key);
          check(row.row_version, 1, 'Created record starts at revision 1: ' + key);
        } else if (previous) {
          check(row, previous, 'Untouched record: ' + key);
        } else {
          assert.fail('Unexpected new record: ' + key);
        }
      }
      check(after[table].length, before[table].length
        + [...created].filter(k => k.startsWith(table + ':')).length, 'Row count: ' + table);
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    for (const item of proposal.createAttributes) {
      const row = after.business_attribute.find(a => a.identifier === item.object + '/' + item.id);
      check(row.name_de, item.name, 'New attribute name: ' + row.identifier);
      check(row.description_de, item.description, 'New attribute definition: ' + row.identifier);
      check(row.comment, item.comment, 'New attribute comment: ' + row.identifier);
      check(row.value_specification, { valueType: item.type }, 'New attribute value type: ' + row.identifier);
      check(row.is_identifier, false, 'New attributes are not identifiers: ' + row.identifier);
      check(row.status, 'draft', 'New attributes stay draft: ' + row.identifier);
      check(await assignedRules(db, row.identifier), ['profile-core'], 'Core requirement assigned: ' + row.identifier);
    }
    const lists = (await db.query(listsSql)).rows;
    check(lists.map(r => [r.liste, Number(r.werte)]),
      [['profile-bemessungsart', 12], ['profile-bemessungsumfang', 3], ['profile-messeinheit', 3]], 'Extended vocabularies');
    assert.ok(lists.find(r => r.liste === 'profile-bemessungsart').codes.includes('GESCHOSSHOEHE')); checks++;
    check(after.code_value.find(v => v.identifier === 'profile-bemessungsart/GV').name_de, 'Volumen GV', 'GV covers building and floor');
    check(await assignedRules(db, 'raum/raumnutzung'), [], 'Raumnutzung has no conditional requirement any more');
    check(after.quality_requirement.find(q => q.identifier === 'profile-raum/raumnutzung').status, 'retired', 'Superseded rule retired');
    check(after.quality_requirement.find(q => q.identifier === 'profile-raum/flaechenklassifikation').description_de,
      'Wenn die Raumfläche für eine Auswertung nach dem betreffenden Schema klassifiziert werden muss.', 'Revised condition');
    for (const id of ['profile-bemessung-gebaeude', 'profile-bemessung-grundstueck'])
      check(after.relationship.find(r => r.identifier === id), before.relationship.find(r => r.identifier === id),
        'Building/parcel measurement scope unchanged: ' + id);

    // Every active profile attribute matches the current Markdown tables.
    const document = fs.readFileSync(path.join(root, 'docs/business-object-attribute-proposal.md'), 'utf8');
    assert.ok(document.includes('**106 direkten Attributdefinitionen**')); checks++;
    const objectNames = { gebaeude: 'Gebäude', geschoss: 'Geschoss', raum: 'Raum', zone: 'Zone',
      grundstueck: 'Grundstück', wirtschaftseinheit: 'Wirtschaftseinheit', bemessung: 'Bemessung' };
    for (const [id, name] of Object.entries(objectNames)) {
      const section = document.split('## ' + name + ' — ')[1].split('\n## ')[0];
      const table = section.match(/^\| Attribut \| Property Set \|[^\n]*\n(?:\|[^\n]*\n?)+/m)[0];
      const rows = table.trim().split('\n').slice(2).map(r => r.split('|').slice(1, -1).map(c => c.trim()));
      check(rows.length, proposal.counts[id], 'Markdown profile count: ' + id);
      const objectUuid = after.business_object.find(o => o.identifier === id).id;
      const active = after.business_attribute.filter(a => a.business_object_id === objectUuid && a.status !== 'retired');
      check(active.length, rows.length, 'Database profile count: ' + id);
      for (const attribute of active) {
        const row = rows.find(r => r[0] === attribute.name_de);
        assert.ok(row, 'Database name occurs in Markdown: ' + attribute.identifier); checks++;
        check(row[4], attribute.description_de, 'Definition matches Markdown: ' + attribute.identifier);
        assert.ok(attribute.comment.includes('Property Set (vorgeschlagen): ' + row[1]),
          'Property set matches Markdown: ' + attribute.identifier); checks++;
      }
    }

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('tables', 't-huelle').fields.length, 30, 'Gebäudehülle source inventory remains intact');
    check(DK.data.get('objects', 'geschoss').attributes.some(a => a.name === 'Höhenlage'), true, 'New floor attribute projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 44', '"expectedChanges": 45'), /different content/);
    await db.exec("UPDATE catalog.business_attribute SET name_de = 'Spätere Benennung' WHERE identifier = 'zone/geometrie'");
    const later = await snapshot(db);
    await db.exec(profilesSql);
    await db.exec(labelsSql);
    await db.exec(sql);
    check(await snapshot(db), later, 'Repeating all three operations preserves later edits');
  } finally { await db.close(); }

  const staleDb = await database();
  try {
    await staleDb.exec(profilesSql);
    await staleDb.exec(labelsSql);
    await staleDb.exec("UPDATE catalog.business_attribute SET description_de = 'Zwischenzeitliche Änderung' WHERE identifier = 'bemessung/wert'");
    await rejectWithoutChanges(staleDb, sql, /Stale geometry baseline/);
  } finally { await staleDb.close(); }

  const collisionDb = await database();
  try {
    await collisionDb.exec(profilesSql);
    await collisionDb.exec(labelsSql);
    await collisionDb.exec(`INSERT INTO catalog.business_attribute(identifier, business_object_id, semantic_name, name_de)
      SELECT 'zone/geometrie', id, 'geometrie', 'Bereits vorhandene Definition' FROM catalog.business_object WHERE identifier = 'zone'`);
    await rejectWithoutChanges(collisionDb, sql, /already exists/);
  } finally { await collisionDb.close(); }
  console.log('Business-object 106-attribute synchronization: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
