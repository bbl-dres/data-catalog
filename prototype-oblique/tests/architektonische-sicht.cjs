/* Execute the Architektonische Sicht object update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-architektonische-sicht.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const konzepte = JSON.parse(fs.readFileSync(path.join(root, '../prototype-datamodel/data/Konzepte.json'), 'utf8'));
const evidence = konzepte.domains.find(d => d.id === 'architektonische-sicht').groups.flatMap(g => g.concepts);
const evidenceNames = { 'technische-komponente': 'Komponente' };
const objectsSql = sql.match(/SELECT o\.identifier, o\.name_de AS objekt[\s\S]*?ORDER BY o\.identifier;/)[0];
const snapshot = async db => (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot;
const ledger = async db => (await db.query('SELECT * FROM catalog_private.import_batch ORDER BY identifier')).rows;
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
    for (const script of priorSql.slice(0, 5)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the Dokumente Management update first/);
    await db.exec(priorSql[5]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'technische-anlage')),
      'Preview shows the new objects'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 6', '"expectedChanges": 7'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    check(proposal.objects.length, 6, 'Six business objects');
    check(after.domain, before.domain, 'No domain records change');
    const bau = after.domain.find(d => d.identifier === 'bau');
    for (const item of proposal.objects) {
      const row = after.business_object.find(o => o.identifier === item.id);
      assert.ok(row, 'Created object: ' + item.id); checks++;
      check([row.name_de, row.description_de, row.comment, row.status, row.row_version, row.created_on, row.modified_on],
        [item.name, item.description, item.comment, 'draft', 1, today, today], 'Exact object record: ' + item.id);
      check(row.domain_id, bau.id, 'Object belongs to Architektonische Sicht: ' + item.id);
      check(row.normative_references, item.standards, 'Standards preserved: ' + item.id);
      check([row.classification ?? null, row.contains_personal_data ?? null, row.version ?? null,
        row.data_owner_id ?? null, row.responsible_organisation ?? null],
        [null, null, null, null, null], 'Zone precedent, no invented governance: ' + item.id);
      const source = evidence.find(c => c.name === (evidenceNames[item.id] ?? item.name));
      assert.ok(source, 'Evidence exists: ' + item.id); checks++;
      assert.ok(item.comment.includes('Priorität: ' + source.priority), 'Priority equals evidence: ' + item.id); checks++;
    }
    check(after.business_object.length, before.business_object.length + 6, 'Exactly six new objects');
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table])
        check(after[table].find(r => r.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.objects.filter(o => DK.data.domainForEntity('objects', o)?.identifier === 'bau').length, 16,
      'Architektonische Sicht grows from ten to sixteen objects');
    check(DK.data.get('objects', 'technische-komponente').name, 'Technische Komponente', 'Clean label with documented source name');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 6', '"expectedChanges": 7'), /different content/);
    await db.exec("UPDATE catalog.business_object SET name_de = 'Späterer Name' WHERE identifier = 'bauteil'");
    const later = await snapshot(db);
    for (const script of priorSql) await db.exec(script);
    await db.exec(sql);
    check(await snapshot(db), later, 'Repeating all seven operations preserves later edits');
  } finally { await db.close(); }

  const collisionDb = await database();
  try {
    for (const script of priorSql) await collisionDb.exec(script);
    await collisionDb.exec(`INSERT INTO catalog.business_object(identifier, name_de, domain_id, status)
      SELECT 'parkplatz', 'Bereits vorhandenes Objekt', id, 'draft' FROM catalog.domain WHERE identifier = 'miete'`);
    await rejectWithoutChanges(collisionDb, sql, /already exists/);
  } finally { await collisionDb.close(); }
  console.log('Architektonische Sicht update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
