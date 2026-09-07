/* Execute the ISO 3166-1 Land domain assignment against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql',
  '20260907-referenzdaten-namen.sql', '20260907-iso-laender.sql', '20260907-datenprodukte-review.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/updates', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-iso-land-domain.sql'), 'utf8');
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
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10, 13)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the product review first/);
    await db.exec(priorSql[13]);
    const before = await snapshot(db), batches = await ledger(db);
    const baseline = before.code_list.find(l => l.identifier === 'r-iso-land');
    check([baseline.name_de, baseline.domain_id, baseline.business_object_id, baseline.row_version],
      ['ISO 3166-1 Land', null, null, proposal.list.revision], 'Replayed chain matches the documented baseline');

    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'r-iso-land' && row.domain === 'bau')),
      'Preview shows the domain assignment'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 1', '"expectedChanges": 2'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"revision": 1,\n    "before"', '"revision": 2,\n    "before"'), /Stale country-list baseline/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const bau = after.domain.find(d => d.identifier === 'bau');
    const list = after.code_list.find(l => l.identifier === 'r-iso-land');
    check([list.domain_id, list.row_version, list.modified_on], [bau.id, proposal.list.revision + 1, today],
      'ISO 3166-1 Land assigned to Architektonische Sicht');
    const rest = record => { const { domain_id, row_version, modified_on, ...other } = record; return other; };
    check(rest(list), rest(baseline), 'Only the domain assignment changes');
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        if (table === 'code_list' && previous.identifier === 'r-iso-land') continue;
        check(after[table].find(x => x.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 1', '"expectedChanges": 2'), /different content/);
  } finally { await db.close(); }
  console.log('ISO 3166-1 Land Domäne: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
