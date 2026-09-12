/* Execute the CRB Kostenelemente update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql',
  '20260907-referenzdaten-namen.sql', '20260907-iso-laender.sql', '20260907-datenprodukte-review.sql',
  '20260907-iso-land-domain.sql', '20260907-referenzdaten-bereinigung.sql', '20260907-flaechenarten.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-crb-kostenelemente.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/ebkp-h/2026-09-07-ebkph-kostenelemente.json'), 'utf8'));
const technik = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/ebkp-h/2026-09-07-ebkph-technik-gebaeude.json'), 'utf8'));
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

/* Static equivalence with the evidence file, and the D group with the screenshot transcription. */
check(proposal.createLists.length, 14, 'One list per Hauptgruppe');
check(evidence.groups.length, 14, 'Evidence covers all fourteen Hauptgruppen');
for (const group of evidence.groups) {
  const list = proposal.createLists.find(l => l.name === 'CRB ' + group.label);
  assert.ok(list, 'List for Hauptgruppe ' + group.code); checks++;
  const expected = group.elementGroups.flatMap(eg => [{ code: eg.code, name: eg.label },
    ...eg.elements.map(e => ({ code: e.code, name: e.label }))]);
  check(list.values, expected, 'Values equal the evidence transcription: ' + group.code);
  assert.ok(list.values.every(v => v.code[0] === group.code), 'Codes carry the Hauptgruppe letter: ' + group.code); checks++;
  check(new Set(list.values.map(v => v.code)).size, list.values.length, 'Unique codes: ' + group.code);
}
const dList = proposal.createLists.find(l => l.name === 'CRB Technik Gebäude');
for (const group of technik.groups) {
  check(dList.values.filter(v => v.code.startsWith(group.code + '.')).map(v => ({ code: v.code, name: v.name })),
    group.positions.map(p => ({ code: p.code, name: p.label })),
    'Hauptgruppe D matches the screenshot transcription: ' + group.code);
}
check(proposal.createLists.reduce((n, l) => n + l.values.length, 0), 399, 'All 71 Elementgruppen and 328 Elemente');

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10, 16)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the Flächenarten update first/);
    await db.exec(priorSql[16]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'r-crb-technik' && Number(row.werte) === dList.values.length)),
      'Preview shows the Technik Gebäude list'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 413', '"expectedChanges": 414'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    for (const list of proposal.createLists) {
      const record = after.code_list.find(l => l.identifier === list.id);
      assert.ok(record, 'List created: ' + list.id); checks++;
      check([record.name_de, record.description_de, record.comment ?? null, record.status, record.row_version,
        record.created_on, record.normative_references, record.domain_id, record.business_object_id],
        [list.name, list.description, null, 'draft', 1, today, list.standards, null, null],
        'Exact list record: ' + list.id);
      const values = after.code_value.filter(v => v.code_list_id === record.id)
        .sort((a, b) => a.code.localeCompare(b.code));
      check(values.map(v => ({ code: v.code, name: v.name_de })),
        [...list.values].sort((a, b) => a.code.localeCompare(b.code)), 'Exact values: ' + list.id);
    }
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        check(after[table].find(x => x.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.code_list.length, before.code_list.length + 14, 'Exactly fourteen new lists');
    check(after.code_value.length, before.code_value.length + 399, 'Exactly 399 new values');
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('refs', 'r-crb-technik').name, 'CRB Technik Gebäude', 'New list projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 413', '"expectedChanges": 414'), /different content/);
    await db.exec(`INSERT INTO catalog.code_list(identifier, name_de, status) VALUES ('r-crb-kollision', 'CRB Grundstück Duplikat', 'draft')`);
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 413', '"expectedChanges": 414'), /different content/);
  } finally { await db.close(); }
  console.log('CRB Kostenelemente: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
