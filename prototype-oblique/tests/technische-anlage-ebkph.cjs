/* Execute the Technische Anlage eBKP-H update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-technische-anlage-ebkph.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/ebkp-h/2026-09-07-ebkph-technik-gebaeude.json'), 'utf8'));
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

// The comment must name every eBKP-H D group either verbatim or via the merged
// "Wärme-, Kälte-, ... Gastechnische Anlage" contraction.
const contracted = ['Wärmetechnische Anlage', 'Kältetechnische Anlage', 'Lufttechnische Anlage',
  'Wassertechnische Anlage', 'Abwassertechnische Anlage', 'Gastechnische Anlage'];
for (const group of evidence.groups) {
  const named = proposal.object.after.comment.includes(group.label)
    || (contracted.includes(group.label) && proposal.object.after.comment.includes('Gastechnische Anlage'));
  assert.ok(named, 'Comment covers eBKP-H group ' + group.code + ' ' + group.label); checks++;
}
check(evidence.groups.length, 12, 'Evidence lists the twelve D groups');

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 8)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the CAFM Basisplan update first/);
    await db.exec(priorSql[8]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'technische-anlage'
      && row.standards === proposal.object.after.standards.join(', '))), 'Preview shows the broadened record'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 1', '"expectedChanges": 2'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"revision": 2,', '"revision": 3,'), /Stale object baseline/);

    const previous = before.business_object.find(o => o.identifier === 'technische-anlage');
    check([previous.description_de, previous.comment, previous.normative_references, previous.row_version],
      [proposal.object.before.description_de, proposal.object.before.comment,
        proposal.object.before.normative_references, proposal.object.revision],
      'Replayed chain matches the documented baseline');

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const row = after.business_object.find(o => o.identifier === 'technische-anlage');
    check([row.description_de, row.comment, row.normative_references, row.row_version, row.modified_on],
      [proposal.object.after.description, proposal.object.after.comment, proposal.object.after.standards,
        proposal.object.revision + 1, today], 'Exact broadened record');
    check([row.name_de, row.status, row.created_on, row.domain_id],
      [previous.name_de, previous.status, previous.created_on, previous.domain_id], 'Identity, status and domain unchanged');
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const past of before[table]) {
        if (table === 'business_object' && past.identifier === 'technische-anlage') continue;
        check(after[table].find(r => r.id === past.id), past, 'Untouched record: ' + table + ':' + (past.identifier ?? past.id));
      }
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    const entity = DK.data.objects.find(o => o.identifier === 'technische-anlage');
    check(entity.description.startsWith('Gebäudetechnische Anlage als System'), true, 'App shows the broadened description');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 1', '"expectedChanges": 2'), /different content/);
    await db.exec("UPDATE catalog.business_object SET comment = 'Zwischenzeitliche Änderung' WHERE identifier = 'technische-anlage'");
    await rejectWithoutChanges(db, sql.replace('"revision": 1,', '"revision": 2,'), /different content/);
  } finally { await db.close(); }
  console.log('Technische Anlage eBKP-H update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
