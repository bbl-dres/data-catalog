/* Execute the KBOB Dokumenttypen update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql',
  '20260907-referenzdaten-namen.sql', '20260907-iso-laender.sql', '20260907-datenprodukte-review.sql',
  '20260907-iso-land-domain.sql', '20260907-referenzdaten-bereinigung.sql', '20260907-flaechenarten.sql',
  '20260907-crb-kostenelemente.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-kbob-dokumenttypen.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/kbob/2026-09-07-kbob-dokumenttypen.json'), 'utf8'));
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

/* Static equivalence with the evidence transcription. */
const expected = evidence.groups.flatMap(g => [{ code: g.code, name: g.label },
  ...g.subgroups.flatMap(sg => [{ code: sg.code, name: sg.label },
    ...sg.types.map(t => ({ code: t.code, name: t.name, description: t.description }))])]);
check(proposal.list.values, expected, 'Proposal values equal the evidence transcription');
check(proposal.list.values.length, 667, 'Four Hauptgruppen, 53 Gruppen and 610 Dokumenttypen');
check(evidence.groups.map(g => g.code), ['O', 'K', 'B', 'V'], 'Hauptgruppen in catalog order');
check(proposal.list.values.filter(v => v.description).length, 610, 'Every Dokumenttyp carries its description');
check(proposal.list.values.filter(v => v.name === 'Basisplan CAFM').map(v => v.code), ['V02007', 'V11001'],
  'CAFM Basisplan document type present');

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10, 17)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the CRB Kostenelemente first/);
    await db.exec(priorSql[17]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'r-kbob-dokumenttyp'
      && Number(row.werte) === 667 && Number(row.mit_beschreibung) === 610)),
      'Preview shows the complete document-type list'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 668', '"expectedChanges": 669'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const list = after.code_list.find(l => l.identifier === 'r-kbob-dokumenttyp');
    assert.ok(list, 'Document-type list created'); checks++;
    const dokumenttyp = after.business_object.find(o => o.identifier === 'dokumenttyp');
    check([list.name_de, list.description_de, list.comment, list.status, list.row_version, list.created_on,
      list.normative_references, list.business_object_id, list.documentation_links],
      [proposal.list.name, proposal.list.description, proposal.list.comment, 'draft', 1, today,
        proposal.list.standards, dokumenttyp.id, proposal.list.links], 'Exact list record');
    const values = after.code_value.filter(v => v.code_list_id === list.id);
    check(values.length, 667, 'All values created');
    check(Object.fromEntries(values.map(v => [v.code, [v.name_de, v.description_de ?? undefined]])),
      Object.fromEntries(proposal.list.values.map(v => [v.code, [v.name, v.description]])),
      'Exact codes, names and descriptions');
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        check(after[table].find(x => x.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('refs', 'r-kbob-dokumenttyp').name, 'KBOB Dokumenttyp', 'New list projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 668', '"expectedChanges": 669'), /different content/);
  } finally { await db.close(); }
  console.log('KBOB Dokumenttypen: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
