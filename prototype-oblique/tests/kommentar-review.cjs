/* Execute the catalog-wide comment review against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-kommentar-review.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const sha = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
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

check(proposal.changes.length, 56, 'Review covers 56 records');
check(proposal.changes.filter(c => c.after.comment === null).length, 14, 'Fourteen boilerplate comments are removed');
for (const c of proposal.changes) {
  assert.ok(['business_attribute', 'data_field', 'data_table', 'code_list', 'system'].includes(c.kind), 'Reviewed kind ' + c.kind); checks++;
  if (c.after.comment !== null) {
    assert.ok(!/docs\/business-object-attribute-proposal/.test(c.after.comment), 'No source lines survive: ' + c.id); checks++;
    assert.ok(!/DescribeFeatureType/.test(c.after.comment), 'No per-field XSD boilerplate survives: ' + c.id); checks++;
    assert.ok(!/Die Beschreibung (ist eine Zusammenfassung|fasst)/.test(c.after.comment), 'No curation meta survives: ' + c.id); checks++;
    assert.ok(!/Katalogstatus bleibt Entwurf/.test(c.after.comment), 'No status meta survives: ' + c.id); checks++;
  }
}

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 9)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the Technische Anlage update first/);
    await db.exec(priorSql[9]);
    /* Hosted baseline drift: t-huelle was renamed on the hosted database on 2026-09-05
       (Gebäudehülle (AO) -> Gebäudehülle, row_version 2) outside the scripted chain. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    const before = await snapshot(db), batches = await ledger(db);
    for (const c of proposal.changes) {
      const table = before[c.kind] || [];
      const record = table.find(r => r.identifier === c.id);
      assert.ok(record, 'Baseline record ' + c.kind + ':' + c.id); checks++;
      check([record.row_version, sha(record.comment)], [c.revision, c.beforeHash],
        'Replayed chain matches the pinned baseline: ' + c.id);
      if (c.after.comment !== null) {
        assert.ok(c.after.comment.length < record.comment.length, 'Review shortens ' + c.id); checks++;
      }
    }
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.entity === 'data_field' && Number(row.with_comment) === 10)),
      'Preview shows the reduced field footprint'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 56', '"expectedChanges": 57'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"removedComments": 14', '"removedComments": 15'), /Unexpected removal count/);
    await rejectWithoutChanges(db, sql.replace(proposal.changes[0].beforeHash, sha('anderer Text')), /Stale comment baseline/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const changed = new Set(proposal.changes.map(c => c.kind + ':' + c.id));
    for (const c of proposal.changes) {
      const previous = before[c.kind].find(r => r.identifier === c.id);
      const current = after[c.kind].find(r => r.identifier === c.id);
      check([current.comment, current.row_version, current.modified_on], [c.after.comment, c.revision + 1, today],
        'Exact reviewed record: ' + c.id);
      const rest = record => { const { comment, row_version, modified_on, ...other } = record; return other; };
      check(rest(current), rest(previous), 'Only the comment changes: ' + c.id);
    }
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        if (changed.has(table + ':' + previous.identifier)) continue;
        check(after[table].find(r => r.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.change_event, before.change_event, 'No change-log records created');
    check(after.data_field.filter(r => r.comment !== null).length, 10, 'Ten substantive field notes remain');
    check(after.data_field.filter(r => /DescribeFeatureType/.test(r.comment || '')).length, 0, 'XSD boilerplate is gone');
    check(after.data_table.filter(r => /minOccurs=0/.test(r.comment || '')).map(r => r.identifier).sort(),
      ['t-av-service-land-cover', 't-av-service-parcel'], 'The XSD fact lives on the two service tables');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 56', '"expectedChanges": 57'), /different content/);
  } finally { await db.close(); }
  console.log('Katalogweite Kommentar-Review: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
