/* Execute the Flächenarten update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql',
  '20260907-referenzdaten-namen.sql', '20260907-iso-laender.sql', '20260907-datenprodukte-review.sql',
  '20260907-iso-land-domain.sql', '20260907-referenzdaten-bereinigung.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-flaechenarten.sql'), 'utf8');
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

check(proposal.extendSia.values.map(v => v.code), ['GSF', 'GGF', 'UF', 'BUF', 'UUF'], 'SIA plot areas added');
const din = proposal.createLists.find(l => l.id === 'r-din277-flaeche');
const ipms = proposal.createLists.find(l => l.id === 'r-ipms-flaeche');
check(din.values.length, 16, 'DIN 277 list has 16 area types');
check(din.values.filter(v => v.code.startsWith('NUF ')).length, 7, 'NUF groups 1-7 present');
check(ipms.values.map(v => v.code), ['IPMS 1', 'IPMS 2', 'IPMS 3.1', 'IPMS 3.2', 'IPMS 4.1', 'IPMS 4.2'],
  'IPMS All Buildings classes, not the superseded 3A/3B/3C');
for (const list of [din, ipms]) {
  assert.ok(!/\(/.test(list.name), 'Parentheses reserved for technical ids: ' + list.name); checks++;
  check(new Set(list.values.map(v => v.code)).size, list.values.length, 'Unique codes in ' + list.id);
}

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10, 15)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the Referenzdaten cleanup first/);
    await db.exec(priorSql[15]);
    const before = await snapshot(db), batches = await ledger(db);
    const siaBefore = before.code_list.find(l => l.identifier === 'r-sia-flaeche');
    check(before.code_value.filter(v => v.code_list_id === siaBefore.id).map(v => v.code).sort(),
      proposal.extendSia.expectedCodes, 'Replayed SIA codes match the reviewed baseline');

    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'r-sia-flaeche' && Number(row.werte) === 13)),
      'Preview shows the completed SIA list'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 30', '"expectedChanges": 31'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const sia = after.code_list.find(l => l.identifier === 'r-sia-flaeche');
    check([sia.comment, sia.normative_references, sia.row_version, sia.modified_on],
      [proposal.extendSia.after.comment, ['SIA 416'], 2, today], 'SIA list updated');
    check(after.code_value.filter(v => v.code_list_id === sia.id).length, 13, 'Thirteen SIA area types');
    const bemessung = after.business_object.find(o => o.identifier === 'bemessung');
    for (const list of [din, ipms]) {
      const record = after.code_list.find(l => l.identifier === list.id);
      assert.ok(record, 'List created: ' + list.id); checks++;
      check([record.name_de, record.description_de, record.comment, record.status, record.row_version,
        record.created_on, record.normative_references, record.business_object_id],
        [list.name, list.description, list.comment, 'draft', 1, today, list.standards, bemessung.id],
        'Exact list record: ' + list.id);
      check(record.documentation_links, list.links ?? [], 'Documentation links: ' + list.id);
      const values = after.code_value.filter(v => v.code_list_id === record.id);
      check(Object.fromEntries(values.map(v => [v.code, v.name_de])),
        Object.fromEntries(list.values.map(v => [v.code, v.name])), 'Exact codes and names: ' + list.id);
    }
    const newValueIds = new Set([
      ...proposal.extendSia.values.map(v => 'r-sia-flaeche/' + v.code),
      ...proposal.createLists.flatMap(l => l.values.map(v => l.id + '/' + v.code)),
    ]);
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        if (table === 'code_list' && previous.identifier === 'r-sia-flaeche') continue;
        check(after[table].find(x => x.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.code_value.length, before.code_value.length + 27, 'Exactly 27 new values');
    check(after.code_value.filter(v => newValueIds.has(v.identifier)).length, 27, 'All new values addressable');
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('refs', 'r-ipms-flaeche').name, 'IPMS Flächenart', 'New list projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 30', '"expectedChanges": 31'), /different content/);
  } finally { await db.close(); }

  const collisionDb = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await collisionDb.exec(script);
    await collisionDb.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10)) await collisionDb.exec(script);
    await collisionDb.exec(`INSERT INTO catalog.code_list(identifier, name_de, status)
      VALUES ('r-din277-flaeche', 'Bereits vorhandene Liste', 'draft')`);
    await rejectWithoutChanges(collisionDb, sql, /already exists/);
  } finally { await collisionDb.close(); }
  console.log('Flächenarten: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
