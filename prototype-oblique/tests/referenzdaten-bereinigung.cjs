/* Execute the Referenzdaten cleanup against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql',
  '20260907-referenzdaten-namen.sql', '20260907-iso-laender.sql', '20260907-datenprodukte-review.sql',
  '20260907-iso-land-domain.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-referenzdaten-bereinigung.sql'), 'utf8');
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

check(proposal.rename.expectedCodes.length, 26, 'All 26 canton abbreviations expected');

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10, 14)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the ISO-Land domain assignment first/);
    await db.exec(priorSql[14]);
    const before = await snapshot(db), batches = await ledger(db);
    const eigentumBefore = before.code_list.find(l => l.identifier === 'r-eigentum');
    check([eigentumBefore.name_de, eigentumBefore.status, eigentumBefore.comment, eigentumBefore.row_version],
      ['Eigentumsform', 'draft', null, 1], 'Replayed Eigentumsform baseline');
    check(before.code_value.filter(v => v.code_list_id === eigentumBefore.id).length, 0, 'Eigentumsform has no values');
    const kantonBefore = before.code_list.find(l => l.identifier === 'r-kanton');
    check(before.code_value.filter(v => v.code_list_id === kantonBefore.id).map(v => v.code).sort(),
      proposal.rename.expectedCodes, 'Canton codes match the verified eCH-0007 enumeration');

    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'r-kanton' && row.name_de === 'eCH Kanton')),
      'Preview shows the rename'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 2', '"expectedChanges": 3'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"name_de": "Eigentumsform", "status": "draft"', '"name_de": "Eigentumsform", "status": "valid"'), /Stale Eigentumsform baseline/);
    await rejectWithoutChanges(db, sql.replace('"ZG","ZH"', '"ZG","ZZ"'), /differ from the verified eCH-0007 enumeration/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const eigentum = after.code_list.find(l => l.identifier === 'r-eigentum');
    check([eigentum.status, eigentum.comment, eigentum.row_version, eigentum.modified_on],
      ['retired', proposal.retire.after.comment, 2, today], 'Eigentumsform retired');
    const kanton = after.code_list.find(l => l.identifier === 'r-kanton');
    check([kanton.name_de, kanton.comment, kanton.normative_references, kanton.documentation_links, kanton.row_version, kanton.modified_on],
      ['eCH Kanton', proposal.rename.after.comment, ['eCH-0007'], proposal.rename.after.links, 2, today],
      'eCH Kanton renamed with verified reference');
    const rest = record => {
      const { name_de, status, comment, normative_references, documentation_links, row_version, modified_on, ...other } = record;
      return other;
    };
    check(rest(eigentum), rest(eigentumBefore), 'Eigentumsform identity unchanged');
    check(rest(kanton), rest(kantonBefore), 'Kanton identity, values anchor and version unchanged');
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        if (table === 'code_list' && ['r-eigentum', 'r-kanton'].includes(previous.identifier)) continue;
        check(after[table].find(x => x.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.change_event, before.change_event, 'No change-log records created; import history retained');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('refs', 'r-eigentum').status, 'Archiviert', 'Retired list shows as archived');
    check(DK.data.get('refs', 'r-kanton').name, 'eCH Kanton', 'Renamed list projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 2', '"expectedChanges": 3'), /different content/);
  } finally { await db.close(); }
  console.log('Referenzdaten-Bereinigung: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
