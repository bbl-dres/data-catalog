/* Execute the ISO 3166-1 country-list update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql',
  '20260907-referenzdaten-namen.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/updates', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-iso-laender.sql'), 'utf8');
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

check(proposal.list.values.length, 249, 'All 249 officially assigned alpha-2 codes');
check(new Set(proposal.list.values.map(v => v.code)).size, 249, 'Unique codes');
check(new Set(proposal.list.values.map(v => v.name)).size, 249, 'Unique names');
for (const v of proposal.list.values) { assert.match(v.code, /^[A-Z]{2}$/, 'Alpha-2 code ' + v.code); checks++; }
const byCode = Object.fromEntries(proposal.list.values.map(v => [v.code, v.name]));
check([byCode.CH, byCode.DE, byCode.FR, byCode.IT, byCode.AT, byCode.LI, byCode.US, byCode.GB],
  ['Schweiz', 'Deutschland', 'Frankreich', 'Italien', 'Österreich', 'Liechtenstein', 'Vereinigte Staaten', 'Vereinigtes Königreich'],
  'Neighbouring and major countries carry the expected German names');
assert.ok(!/\(/.test(proposal.list.name), 'List name keeps parentheses free for technical ids'); checks++;

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    await db.exec(priorSql[10]);
    await rejectWithoutChanges(db, sql, /Apply the Referenzdaten naming convention first/);
    await db.exec(priorSql[11]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'r-iso-land' && Number(row.werte) === 249)),
      'Preview shows the complete country list'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 260', '"expectedChanges": 261'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const list = after.code_list.find(l => l.identifier === 'r-iso-land');
    assert.ok(list, 'Country list created'); checks++;
    check([list.name_de, list.description_de, list.comment, list.status, list.row_version, list.created_on, list.normative_references],
      [proposal.list.name, proposal.list.description, proposal.list.comment, 'draft', 1, today, proposal.list.standards], 'Exact list record');
    check(list.authority_organisation, proposal.list.authority, 'ISO as authority');
    check([list.domain_id, list.business_object_id, list.version ?? null], [null, null, null], 'Cross-domain list without invented anchors');
    const values = after.code_value.filter(v => v.code_list_id === list.id);
    check(values.length, 249, 'All country values created');
    check(Object.fromEntries(values.map(v => [v.code, v.name_de])), byCode, 'Exact codes and German names');
    for (const b of proposal.bind) {
      const attr = after.business_attribute.find(a => a.identifier === b.attribute);
      check([attr.code_list_id, attr.row_version, attr.modified_on], [list.id, b.revision + 1, today], 'Attribute binding: ' + b.attribute);
    }
    for (const b of proposal.bindFields) {
      const field = after.data_field.find(f => f.identifier === b.field);
      check([field.code_list_id, field.row_version, field.modified_on], [list.id, b.revision + 1, today], 'Field binding: ' + b.field);
    }
    const changed = new Set([...proposal.bind.map(b => 'business_attribute:' + b.attribute), ...proposal.bindFields.map(b => 'data_field:' + b.field)]);
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
    const landAttr = DK.data.attr('gebaeude/land');
    check(landAttr.codeList, 'r-iso-land', 'Land attribute links the country list in the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 260', '"expectedChanges": 261'), /different content/);
  } finally { await db.close(); }

  const collisionDb = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await collisionDb.exec(script);
    await collisionDb.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10)) await collisionDb.exec(script);
    await collisionDb.exec(`INSERT INTO catalog.code_list(identifier, name_de, status)
      VALUES ('r-iso-land', 'Bereits vorhandene Liste', 'draft')`);
    await rejectWithoutChanges(collisionDb, sql, /already exists/);
  } finally { await collisionDb.close(); }
  console.log('ISO 3166-1 Land: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
