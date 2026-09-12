/* Execute the precise-names update against isolated PostgreSQL; no hosted writes. */
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
  '20260907-crb-kostenelemente.sql', '20260907-kbob-dokumenttypen.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-praezise-namen.sql'), 'utf8');
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

check(proposal.listRenames.length, 14, 'All fourteen CRB lists renamed');
for (const r of proposal.listRenames) {
  check(r.after, r.before.replace(/^CRB /, 'CRB eBKP-H '), 'Standard inserted into the name: ' + r.id);
}
check(proposal.attributeRenames.map(r => [r.id, r.after]),
  [['gebaeude/egid', 'EGID (GWR)'], ['gebaeude/grundstueck', 'EGRID (AV)'], ['grundstueck/egrid', 'EGRID (AV)']],
  'Register suffixes on the three reference attributes');

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10, 18)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the KBOB Dokumenttypen first/);
    await db.exec(priorSql[18]);
    const before = await snapshot(db), batches = await ledger(db);
    for (const r of proposal.listRenames) {
      const record = before.code_list.find(l => l.identifier === r.id);
      check([record.name_de, record.row_version], [r.before, r.revision], 'Replayed list baseline: ' + r.id);
    }
    for (const r of proposal.attributeRenames) {
      const record = before.business_attribute.find(a => a.identifier === r.id);
      check([record.name_de, record.row_version], [r.before, r.revision], 'Replayed attribute baseline: ' + r.id);
    }

    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(x => x.rows?.some(row => row.name_de === 'CRB eBKP-H Ausbau Gebäude')),
      'Preview shows the renamed list'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 17', '"expectedChanges": 18'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"before": "EGID"', '"before": "EGID alt"'), /Stale attribute baseline/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    for (const r of proposal.listRenames) {
      const current = after.code_list.find(l => l.identifier === r.id);
      check([current.name_de, current.row_version, current.modified_on], [r.after, r.revision + 1, today], 'Renamed list: ' + r.id);
    }
    for (const r of proposal.attributeRenames) {
      const current = after.business_attribute.find(a => a.identifier === r.id);
      check([current.name_de, current.row_version, current.modified_on], [r.after, r.revision + 1, today], 'Renamed attribute: ' + r.id);
    }
    const changed = new Set([...proposal.listRenames.map(r => 'code_list:' + r.id),
      ...proposal.attributeRenames.map(r => 'business_attribute:' + r.id)]);
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        if (changed.has(table + ':' + previous.identifier)) continue;
        check(after[table].find(x => x.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.attr('gebaeude/egid').name, 'EGID (GWR)', 'Attribute suffix projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 17', '"expectedChanges": 18'), /different content/);
  } finally { await db.close(); }
  console.log('Präzise Namen: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
