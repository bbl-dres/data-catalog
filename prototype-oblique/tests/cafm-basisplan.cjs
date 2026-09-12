/* Execute the CAFM Basisplan update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-cafm-basisplan.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
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
    for (const script of priorSql.slice(0, 7)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the Dokumente Management review first/);
    await db.exec(priorSql[7]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'cafm-basisplan')), 'Preview shows the new object'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 2', '"expectedChanges": 3'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const domain = after.domain.find(d => d.identifier === 'dokumente');
    check(domain.comment, proposal.domain.after.comment, 'Domain comment counts eight objects');
    check(domain.row_version, proposal.domain.revision + 1, 'One domain revision');
    const row = after.business_object.find(o => o.identifier === 'cafm-basisplan');
    assert.ok(row, 'CAFM Basisplan created'); checks++;
    check([row.name_de, row.description_de, row.comment, row.status, row.row_version, row.created_on, row.modified_on],
      [proposal.object.name, proposal.object.description, proposal.object.comment, 'draft', 1, today, today], 'Exact object record');
    check(row.domain_id, domain.id, 'Object belongs to Dokumente Management');
    check(row.normative_references, proposal.object.standards, 'KBOB-IPB reference preserved');
    check(row.documentation_links, proposal.object.links, 'Catalog PDF linked');
    check([row.classification ?? null, row.contains_personal_data ?? null, row.version ?? null, row.data_owner_id ?? null],
      [null, null, null, null], 'Zone precedent, no invented governance');
    check(row.comment.includes('Priorität'), false, 'No invented priority');
    check(after.business_object.length, before.business_object.length + 1, 'Exactly one new object');
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        const current = after[table].find(r => r.id === previous.id);
        if (table === 'domain' && previous.identifier === 'dokumente') continue;
        check(current, previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.objects.filter(o => DK.data.domainForEntity('objects', o)?.identifier === 'dokumente').length, 8,
      'Dokumente Management shows eight objects');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 2', '"expectedChanges": 3'), /different content/);
    await db.exec("UPDATE catalog.domain SET comment = 'Zwischenzeitliche Änderung' WHERE identifier = 'dokumente'");
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 2', '"expectedChanges": 3'), /different content/);
  } finally { await db.close(); }

  const collisionDb = await database();
  try {
    for (const script of priorSql) await collisionDb.exec(script);
    await collisionDb.exec(`INSERT INTO catalog.business_object(identifier, name_de, domain_id, status)
      SELECT 'cafm-basisplan', 'Bereits vorhandenes Objekt', id, 'draft' FROM catalog.domain WHERE identifier = 'bau'`);
    await rejectWithoutChanges(collisionDb, sql, /Stale domain baseline|already exists/);
  } finally { await collisionDb.close(); }
  console.log('CAFM Basisplan update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
