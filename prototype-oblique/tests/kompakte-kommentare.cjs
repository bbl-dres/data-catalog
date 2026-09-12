/* Execute the compact-comments update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-kompakte-kommentare.sql'), 'utf8');
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
    for (const script of priorSql.slice(0, 3)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the BBL Referenzdaten first/);
    await db.exec(priorSql[3]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => Number(row.sap_code_notes) === 3 && Number(row.values_with_comment) === 5)),
      'Preview shows the compact value comments'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 319', '"expectedChanges": 320'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    check(proposal.changes.length, 319, '319 reviewed comment edits');
    check(proposal.changes.every(c => /^[0-9a-f]{64}$/.test(c.beforeHash) && Object.keys(c.after).join() === 'comment'),
      true, 'Only comments change, pinned to hashed baselines');

    const touched = new Map(proposal.changes.map(c => [c.kind + ':' + c.id, c]));
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.identifier)) {
      for (const row of after[table]) {
        const change = touched.get(table + ':' + row.identifier);
        const previous = before[table].find(r => r.id === row.id);
        if (change) {
          check(row.comment, change.after.comment, 'Exact compact comment: ' + table + ':' + row.identifier);
          check(row.row_version, change.revision + 1, 'One edit revision: ' + table + ':' + row.identifier);
          check(row.modified_on, today, 'Edit date: ' + table + ':' + row.identifier);
          for (const field of Object.keys(previous)) if (!['comment', 'row_version', 'modified_on'].includes(field))
            check(row[field], previous[field], 'Unrelated field preserved: ' + table + ':' + row.identifier + '/' + field);
        } else {
          check(row, previous, 'Untouched record: ' + table + ':' + row.identifier);
        }
      }
      check(after[table].length, before[table].length, 'No created or removed records: ' + table);
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    const profileObjects = new Map(after.business_object
      .filter(o => ['gebaeude', 'geschoss', 'raum', 'zone', 'grundstueck', 'wirtschaftseinheit', 'bemessung'].includes(o.identifier))
      .map(o => [o.id, o.identifier]));
    for (const [, identifier] of profileObjects) {
      const comment = after.business_object.find(o => o.identifier === identifier).comment;
      assert.ok(comment.startsWith('Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\n'),
        'Object comment keeps one source reference: ' + identifier); checks++;
      assert.ok(comment.length < 700, 'Object comment is compact: ' + identifier); checks++;
    }
    const ruleByUuid = new Map(after.quality_requirement.map(r => [r.id, r]));
    const rulesOf = uuid => after.business_attribute_quality_requirement
      .filter(l => l.business_attribute_id === uuid).map(l => ruleByUuid.get(l.quality_requirement_id));
    for (const a of after.business_attribute.filter(x => profileObjects.has(x.business_object_id) && x.status !== 'retired')) {
      const lines = a.comment.split('\n');
      assert.ok(lines[0].startsWith('Property Set (vorgeschlagen): '), 'Property set stays first: ' + a.identifier); checks++;
      check(lines.some(l => l.startsWith('Fachprofil') || l.startsWith('Kernangabe:') || l.startsWith('Optionale Angabe:')),
        false, 'Boilerplate removed: ' + a.identifier);
      check(lines.filter(l => l.startsWith('Schlüsselrolle:')).some(l => l.includes('(')), false, 'Key role is short: ' + a.identifier);
      const conditional = rulesOf(a.id).find(r => r.rule_type === 'custom' && r.status !== 'retired');
      if (conditional) check(lines.some(l => l === 'Bedingte Angabe: ' + conditional.description_de),
        true, 'Condition stays visible: ' + a.identifier);
      else check(lines.some(l => l.startsWith('Bedingte Angabe:')), false, 'No stray condition: ' + a.identifier);
    }
    assert.ok(after.business_attribute.find(a => a.identifier === 'gebaeude/gebaeudeart').comment
      .includes('Referenzlisten: Gebäudeart 1 (BBL) und Gebäudeart 2 (BBL)'), 'Reference-list pointer kept'); checks++;
    for (const a of after.business_attribute.filter(x => profileObjects.has(x.business_object_id) && x.status === 'retired'))
      check(a.comment, before.business_attribute.find(b => b.id === a.id).comment, 'Retired history untouched: ' + a.identifier);

    const profileLists = after.code_list.filter(l => /^(profile-|r-bbl-)/.test(l.identifier));
    check(profileLists.filter(l => l.comment !== null).length, 0, 'List comments live in descriptions');
    const listUuids = new Set(profileLists.map(l => l.id));
    const commented = after.code_value.filter(v => listUuids.has(v.code_list_id) && v.comment !== null);
    check(commented.filter(v => v.comment.startsWith('SAP-Code')).map(v => v.identifier).sort(),
      ['profile-eigentumsart/Anmiete', 'profile-eigentumsart/Eigentum', 'profile-eigentumsart/Spezialfall'], 'SAP codes stay recorded');
    check(commented.filter(v => v.comment.includes('abgeschnitten')).map(v => v.code).sort(),
      ['13.06', '14.01'], 'Truncation flags stay');
    check(commented.length, 5, 'Only helpful value comments remain');
    check(after.quality_requirement.filter(r => r.identifier.startsWith('profile-') && r.comment !== null)
      .map(r => r.identifier), ['profile-raum/raumnutzung'], 'Only the retirement note remains on rules');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 319', '"expectedChanges": 320'), /different content/);
    await db.exec("UPDATE catalog.business_attribute SET comment = 'Späterer Kommentar' WHERE identifier = 'zone/geometrie'");
    const later = await snapshot(db);
    for (const script of priorSql) await db.exec(script);
    await db.exec(sql);
    check(await snapshot(db), later, 'Repeating all five operations preserves later edits');
  } finally { await db.close(); }

  const staleDb = await prepared();
  try {
    await staleDb.exec("UPDATE catalog.business_attribute SET comment = 'Zwischenzeitliche Änderung' WHERE identifier = 'gebaeude/teilportfolio'");
    await rejectWithoutChanges(staleDb, sql, /Stale comment baseline/);
  } finally { await staleDb.close(); }
  console.log('Compact comments update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
