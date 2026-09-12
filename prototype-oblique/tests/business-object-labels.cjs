/* Execute the German naming follow-up against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const profilesSql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-business-object-profiles.sql'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-business-object-labels.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const profiles = JSON.parse(profilesSql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
// The Markdown carries the later 106-attribute revision; overlay that reviewed operation
// so this suite still verifies its naming result against the current document.
const geometrySql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-business-object-geometry.sql'), 'utf8');
const geometryProposal = JSON.parse(geometrySql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const reportSql = sql.match(/SELECT a\.identifier, a\.name_de AS attribut[\s\S]*?ORDER BY a\.identifier;/)[0];
const snapshot = async db => (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot;
const ledger = async db => (await db.query('SELECT * FROM catalog_private.import_batch ORDER BY identifier')).rows;
const withoutOrder = rows => [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
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
    await rejectWithoutChanges(db, sql, /Apply the 98-attribute profile update first/);
    await db.exec(profilesSql);
    const before = await snapshot(db), batches = await ledger(db);
    const reportBefore = (await db.query(reportSql)).rows;
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'gebaeude/gebaeude-id' && row.attribut === 'Gebäude-ID'))); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation marker');
    check((await db.query(reportSql)).rows, reportBefore, 'Standalone report after preview shows rolled-back names');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 17', '"expectedChanges": 18'), /Unexpected label change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    check(proposal.changes.length, 17, '17 reviewed record edits');
    check(proposal.changes.filter(c => c.kind === 'business_attribute' && c.after.name_de).length, 8, 'Eight changed attribute labels');
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]))) {
      const expected = before[table].map(row => {
        const change = proposal.changes.find(c => c.kind === table && c.id === row.identifier);
        return change ? { ...row, ...change.after, modified_on: today, row_version: row.row_version + 1 } : row;
      });
      check(withoutOrder(after[table]), withoutOrder(expected), 'Only reviewed text/date/revision edits: ' + table);
    }
    check(after.change_event, before.change_event, 'No change-log records created');
    for (const change of proposal.changes) {
      const row = after[change.kind].find(r => r.identifier === change.id);
      check(row.row_version, change.revision + 1, 'One edit revision per affected record');
      for (const [key, value] of Object.entries(change.after)) check(row[key], value, 'Exact German text: ' + change.id);
    }
    const report = (await db.query(reportSql)).rows;
    check(report.length, 13, 'Standalone report works after COMMIT for all affected attributes');
    for (const row of report)
      check(row.attribut, after.business_attribute.find(a => a.identifier === row.identifier).name_de, 'Report reads current catalog labels');

    const document = fs.readFileSync(path.join(root, 'docs/business-object-attribute-proposal.md'), 'utf8');
    const parsed = {};
    for (const object of profiles.objects) {
      const section = document.split('## ' + object.name + ' — ')[1].split('\n## ')[0];
      const table = section.match(/^\| Attribut \| Property Set \|[^\n]*\n(?:\|[^\n]*\n?)+/m)[0];
      parsed[object.id] = table.trim().split('\n').slice(2).map(r => r.split('|').slice(1, -1).map(c => c.trim()));
      check(parsed[object.id].length, geometryProposal.counts[object.id], 'Current Markdown profile count');
    }
    for (const attribute of profiles.attributes) {
      const current = after.business_attribute.find(a => a.identifier === attribute.object + '/' + attribute.id);
      const later = geometryProposal.changes.find(c => c.kind === 'business_attribute' && c.id === current.identifier)?.after || {};
      const row = parsed[attribute.object].find(r => r[0] === current.name_de);
      assert.ok(row, 'Final database name occurs in Markdown: ' + current.name_de); checks++;
      check(row[4], later.description_de || current.description_de, 'Final database definition matches Markdown');
      assert.ok((later.comment || current.comment).includes('Property Set (vorgeschlagen): ' + row[1])); checks++;
    }
    for (const [oldLabel] of proposal.replacements) {
      check(document.includes(oldLabel), false, 'Superseded label removed from current proposal: ' + oldLabel);
      check(after.business_attribute.filter(a => a.status !== 'retired' && profiles.objects.some(o => o.id === a.identifier.split('/')[0]))
        .some(a => a.name_de.includes(oldLabel)), false, 'Active labels use current terminology');
    }
    for (const id of ['gebaeude/gebaeudekategorie', 'gebaeude/gebaeudeklasse', 'grundstueck/parzellennummer']) {
      const previous = before.business_attribute.find(a => a.identifier === id);
      check(after.business_attribute.find(a => a.identifier === id).name_de, previous.name_de, 'GWR/official qualifier preserved');
    }
    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('tables', 't-huelle').fields.length, 30, 'Gebäudehülle source inventory remains intact');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    check((await db.query(reportSql)).rows, report, 'Repeat result reads current labels');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 17', '"expectedChanges": 18'), /different content/);
    await db.exec("UPDATE catalog.business_attribute SET name_de = 'Spätere Benennung' WHERE identifier = 'gebaeude/gebaeude-id'");
    const later = await snapshot(db);
    await db.exec(profilesSql);
    await db.exec(sql);
    check(await snapshot(db), later, 'Repeating both operations preserves later edits');
    check((await db.query(reportSql)).rows.find(r => r.identifier === 'gebaeude/gebaeude-id').attribut, 'Spätere Benennung', 'Report shows current names after later edits');
  } finally { await db.close(); }

  const staleDb = await database();
  try {
    await staleDb.exec(profilesSql);
    await staleDb.exec("UPDATE catalog.business_attribute SET comment = 'Intervening edit' WHERE identifier = 'grundstueck/parzellennummer'");
    await rejectWithoutChanges(staleDb, sql, /Stale label baseline/);
  } finally { await staleDb.close(); }
  console.log('Business-object naming update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
