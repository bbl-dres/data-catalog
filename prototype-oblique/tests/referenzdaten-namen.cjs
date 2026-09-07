/* Execute the Referenzdaten naming convention against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/updates', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-referenzdaten-namen.sql'), 'utf8');
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

check(proposal.renames.length, 8, 'Eight renamed lists');
for (const r of proposal.renames) {
  assert.ok(r.after.startsWith('BBL '), 'Source prefix first: ' + r.after); checks++;
  assert.ok(!/\(/.test(r.after), 'Parentheses reserved for technical ids: ' + r.after); checks++;
}
check(proposal.renames.filter(r => r.assignDomain).map(r => [r.id, r.assignDomain]),
  [['profile-eigentumsart', 'bau']], 'Only BBL Eigentumsart is assigned to Architektonische Sicht');
assert.ok(proposal.comment.after.includes('BBL Gebäudeart 1 und BBL Gebäudeart 2'), 'Comment follows the rename'); checks++;

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    await rejectWithoutChanges(db, sql, /Apply the comment review first/);
    await db.exec(priorSql[10]);
    const before = await snapshot(db), batches = await ledger(db);
    for (const r of proposal.renames) {
      const record = before.code_list.find(l => l.identifier === r.id);
      check([record.name_de, record.row_version], [r.before, r.revision], 'Replayed baseline: ' + r.id);
      if (r.assignDomain) check(record.domain_id, null, 'No prior domain on ' + r.id);
    }
    const attr = before.business_attribute.find(a => a.identifier === proposal.comment.id);
    check([attr.row_version, sha(attr.comment)], [proposal.comment.revision, proposal.comment.beforeHash], 'Replayed comment baseline');

    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(x => x.rows?.some(row => row.identifier === 'profile-eigentumsart' && row.domain === 'bau')),
      'Preview shows the domain assignment'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 9', '"expectedChanges": 10'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"revision": 3, "before": "Eigentumsart (BBL)"', '"revision": 4, "before": "Eigentumsart (BBL)"'), /Stale code-list baseline/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const bau = after.domain.find(d => d.identifier === 'bau');
    for (const r of proposal.renames) {
      const previous = before.code_list.find(l => l.identifier === r.id);
      const current = after.code_list.find(l => l.identifier === r.id);
      check([current.name_de, current.row_version, current.modified_on],
        [r.after, r.revision + 1, today], 'Renamed list: ' + r.id);
      check(current.domain_id, r.assignDomain ? bau.id : previous.domain_id, 'Domain assignment: ' + r.id);
      const rest = record => { const { name_de, domain_id, row_version, modified_on, ...other } = record; return other; };
      check(rest(current), rest(previous), 'Only name and domain change: ' + r.id);
    }
    const attrAfter = after.business_attribute.find(a => a.identifier === proposal.comment.id);
    check([attrAfter.comment, attrAfter.row_version, attrAfter.modified_on],
      [proposal.comment.after, proposal.comment.revision + 1, today], 'Gebäudeart comment follows the rename');
    const changed = new Set([...proposal.renames.map(r => 'code_list:' + r.id), 'business_attribute:' + proposal.comment.id]);
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
    check(DK.data.get('refs', 'profile-eigentumsart').name, 'BBL Eigentumsart', 'Renamed label projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 9', '"expectedChanges": 10'), /different content/);
  } finally { await db.close(); }
  console.log('Referenzdaten-Namen: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
