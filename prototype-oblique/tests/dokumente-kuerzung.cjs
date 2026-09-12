/* Execute the Dokumente Management review update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-dokumente-kuerzung.sql'), 'utf8');
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
async function prepared() {
  const db = await database();
  for (const script of priorSql) await db.exec(script);
  return db;
}

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 6)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the Architektonische Sicht objects first/);
    await db.exec(priorSql[6]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.domain === 'dokumente' && Number(row.objekte) === 7)),
      'Preview shows the trimmed domain'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 18', '"expectedChanges": 19'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    check(proposal.remove.map(r => r.id).sort(), ['anweisung', 'dokumentversion', 'nachricht', 'workflow'], 'Reviewed removals');
    for (const removal of proposal.remove)
      check(after.business_object.some(o => o.identifier === removal.id), false, 'Removed again: ' + removal.id);
    check(after.business_object.length, before.business_object.length - 4, 'Exactly four records removed');

    const touched = new Map(proposal.changes.map(c => [c.kind + ':' + c.id, c]));
    for (const table of ['domain', 'business_object']) {
      for (const row of after[table]) {
        const change = touched.get(table + ':' + row.identifier);
        const previous = before[table].find(r => r.id === row.id);
        if (change) {
          check(row.row_version, change.revision + 1, 'One edit revision: ' + row.identifier);
          check(row.modified_on, today, 'Edit date: ' + row.identifier);
          for (const [field, value] of Object.entries(change.after)) check(row[field], value, 'Exact text: ' + row.identifier + '/' + field);
          for (const field of Object.keys(previous)) if (!(field in change.after) && !['row_version', 'modified_on'].includes(field))
            check(row[field], previous[field], 'Unrelated field preserved: ' + row.identifier + '/' + field);
        } else {
          check(row, previous, 'Untouched record: ' + table + ':' + row.identifier);
        }
      }
    }
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id && !['domain', 'business_object'].includes(k)))
      check(after[table], before[table], 'Untouched table: ' + table);
    check(after.change_event, before.change_event, 'No change-log records created');

    for (const change of proposal.changes.filter(c => c.kind === 'business_object')) {
      const lines = change.after.comment.split('\n');
      check(lines.some(l => l.startsWith('Fachkonzept ')), false, 'No source line: ' + change.id);
      check(change.after.comment.includes('MoSCoW'), false, 'No MoSCoW tag: ' + change.id);
      assert.ok(lines[0].startsWith('Gruppe: ') && lines[0].includes('Priorität: '), 'Group and priority kept: ' + change.id); checks++;
      assert.ok(lines[1].startsWith('Primäre Identifikation: '), 'Primary identification kept: ' + change.id); checks++;
    }
    const guard = await db.query("SELECT tgenabled FROM pg_trigger WHERE tgname = 'b_guard_record' AND tgrelid = 'catalog.business_object'::regclass");
    check(guard.rows[0].tgenabled, 'O', 'Identity guard is re-enabled');
    await assert.rejects(db.exec("DELETE FROM catalog.business_object WHERE identifier = 'dokument'"),
      /Retain catalog identities/); checks++;
    await db.exec('ROLLBACK');

    const { DK } = runtime(await snapshot(db));
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.objects.filter(o => DK.data.domainForEntity('objects', o)?.identifier === 'dokumente').map(o => o.identifier).sort(),
      ['archivgut', 'dokument', 'dokumenttyp', 'dossier', 'metadatensatz', 'registraturplan', 'vorarchiv'],
      'Exactly the seven kept objects project into the app');

    const appliedState = await snapshot(db);
    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), appliedState, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 18', '"expectedChanges": 19'), /different content/);
  } finally { await db.close(); }

  const referencedDb = await prepared();
  try {
    await referencedDb.exec(`INSERT INTO catalog.business_attribute(identifier, business_object_id, semantic_name, name_de)
      SELECT 'workflow/status', id, 'status', 'Status' FROM catalog.business_object WHERE identifier = 'workflow'`);
    await rejectWithoutChanges(referencedDb, sql, /is referenced; retire it instead/);
  } finally { await referencedDb.close(); }

  const editedDb = await prepared();
  try {
    await editedDb.exec("UPDATE catalog.business_object SET description_de = 'Zwischenzeitliche Änderung' WHERE identifier = 'nachricht'");
    await rejectWithoutChanges(editedDb, sql, /is not the untouched creation/);
  } finally { await editedDb.close(); }
  console.log('Dokumente Management review update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
