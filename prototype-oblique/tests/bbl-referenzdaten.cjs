/* Execute the BBL reference-data update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const profilesSql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-profiles.sql'), 'utf8');
const labelsSql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-labels.sql'), 'utf8');
const geometrySql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-geometry.sql'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-bbl-referenzdaten.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const evidence = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/sap-refx/2026-09-07-sap-f4-referenzdaten.json'), 'utf8'));
const listsSql = sql.match(/SELECT l\.identifier AS liste[\s\S]*?ORDER BY l\.identifier;/)[0];
const fieldsSql = sql.match(/SELECT f\.identifier AS feld[\s\S]*?ORDER BY f\.identifier;/)[0];
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
  await db.exec(profilesSql);
  await db.exec(labelsSql);
  await db.exec(geometrySql);
  return db;
}

(async () => {
  const db = await database();
  try {
    await db.exec(profilesSql);
    await db.exec(labelsSql);
    await rejectWithoutChanges(db, sql, /Apply the 106-attribute synchronization first/);
    await db.exec(geometrySql);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.liste === 'r-bbl-gebaeudeart-2' && Number(row.werte) === 100)),
      'Preview shows the captured reference lists'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 164', '"expectedChanges": 165'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    check(proposal.changes.length, 5, 'Five reviewed record edits');
    check(proposal.createLists.length, 4, 'Four captured reference lists');
    check(proposal.createLists.reduce((n, l) => n + l.values.length, 0), 145, '145 captured values');
    check(proposal.bind.length, 2, 'Two attribute bindings');
    check(proposal.bindFields.length, 8, 'Eight source-field bindings');

    // Reviewed edits, creations and bindings apply exactly once; everything else is untouched.
    const touched = new Map(proposal.changes.map(c => [c.kind + ':' + c.id, c]));
    const listIds = new Map(after.code_list.map(l => [l.identifier, l.id]));
    const boundAttributes = new Map(proposal.bind.map(b => [b.attribute, b]));
    const boundFields = new Map(proposal.bindFields.map(b => [b.field, b]));
    const created = new Set();
    for (const list of proposal.createLists) {
      created.add('code_list:' + list.id);
      for (const value of list.values) created.add('code_value:' + list.id + '/' + value.code);
    }
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.identifier)) {
      for (const row of after[table]) {
        const key = table + ':' + row.identifier;
        const change = touched.get(key);
        const bound = table === 'business_attribute' ? boundAttributes.get(row.identifier)
          : table === 'data_field' ? boundFields.get(row.identifier) : undefined;
        const previous = before[table].find(r => r.id === row.id);
        if (change) {
          check(row.row_version, change.revision + 1, 'One edit revision: ' + key);
          check(row.modified_on, today, 'Edit date: ' + key);
          for (const [field, value] of Object.entries(change.after)) check(row[field], value, 'Exact text: ' + key + '/' + field);
          for (const field of Object.keys(previous)) if (!(field in change.after) && !['row_version', 'modified_on'].includes(field))
            check(row[field], previous[field], 'Unrelated field preserved: ' + key + '/' + field);
        } else if (bound) {
          check(row.row_version, bound.revision + 1, 'One binding revision: ' + key);
          check(row.modified_on, today, 'Binding date: ' + key);
          check(row.code_list_id, listIds.get(bound.list), 'Bound vocabulary: ' + key);
          for (const field of Object.keys(previous)) if (!['row_version', 'modified_on', 'code_list_id'].includes(field))
            check(row[field], previous[field], 'Binding leaves other fields: ' + key + '/' + field);
        } else if (created.has(key)) {
          check(previous, undefined, 'Created record is new: ' + key);
          check(row.row_version, 1, 'Created record starts at revision 1: ' + key);
        } else if (previous) {
          check(row, previous, 'Untouched record: ' + key);
        } else {
          assert.fail('Unexpected new record: ' + key);
        }
      }
      check(after[table].length, before[table].length
        + [...created].filter(k => k.startsWith(table + ':')).length, 'Row count: ' + table);
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    // Captured lists match the screenshot evidence exactly, including codes and flags.
    const evidenceKeys = { 'r-bbl-teilportfolio': 'teilportfolio', 'r-bbl-gebaeudeart-1': 'gebaeudeart1', 'r-bbl-gebaeudeart-2': 'gebaeudeart2', 'r-bbl-mietmodell': 'verrechnungsmodellMiete' };
    for (const item of proposal.createLists) {
      const source = evidence.lists[evidenceKeys[item.id]];
      check(item.values.map(v => [v.code, v.name]), source.values.map(v => [v.code, v.text]), 'Payload equals evidence: ' + item.id);
      const list = after.code_list.find(l => l.identifier === item.id);
      check(list.name_de, item.name, 'Clean label: ' + item.id);
      check(list.status, 'draft', 'Captured list stays draft: ' + item.id);
      const values = after.code_value.filter(v => v.code_list_id === list.id);
      check(values.length, source.screenshotEntries, 'Complete capture: ' + item.id);
      for (const value of item.values) {
        const row = values.find(v => v.code === value.code);
        check([row.name_de, row.row_version], [value.name, 1], 'Exact Langtext: ' + item.id + '/' + value.code);
        check(row.comment.includes('abgeschnitten'), Boolean(value.comment), 'Truncation flag: ' + item.id + '/' + value.code);
      }
    }
    check(after.code_value.filter(v => v.code_list_id === listIds.get('r-bbl-gebaeudeart-2') && v.comment.includes('abgeschnitten'))
      .map(v => v.code).sort(), ['13.06', '14.01'], 'Exactly the two truncated Langtexte are flagged');
    check(after.code_value.some(v => v.identifier === 'r-bbl-gebaeudeart-2/02.05'), false, 'Absent 02.05 is not invented');
    const eigList = after.code_list.find(l => l.identifier === 'profile-eigentumsart');
    check(eigList.name_de, 'Eigentumsart (BBL)', 'Eigentumsart carries the clean label');
    for (const [label, code] of [['Eigentum', '01'], ['Anmiete', '03'], ['Spezialfall', '05']]) {
      const value = after.code_value.find(v => v.identifier === 'profile-eigentumsart/' + label);
      check(value.code, label, 'Agreed business code preserved: ' + label);
      assert.ok(value.comment.includes('SAP-Code ' + code), 'Confirmed SAP code recorded: ' + label); checks++;
    }
    assert.ok(after.business_attribute.find(a => a.identifier === 'gebaeude/gebaeudeart')
      .comment.includes('Gebäudeart 1 (BBL) und Gebäudeart 2 (BBL)'), 'Gebäudeart references both lists'); checks++;

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('refs', 'r-bbl-gebaeudeart-2').values.length, 100, 'Level-2 list projects into the app');
    check(DK.data.get('objects', 'gebaeude').attributes.find(a => a.name === 'Teilportfolio').codeList,
      'r-bbl-teilportfolio', 'Attribute binding projects into the app');
    check(DK.data.get('tables', 't-geb-gis').fields.find(f => f.technicalName === 'bbl_gbda1').codeList,
      'r-bbl-gebaeudeart-1', 'Field binding projects into the app');
    check(DK.data.get('refs', 'r-bbl-teilportfolio').name, 'Teilportfolio (BBL)', 'Clean label projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 164', '"expectedChanges": 165'), /different content/);
    await db.exec("UPDATE catalog.code_value SET name_de = 'Späterer Langtext' WHERE identifier = 'r-bbl-mietmodell/5'");
    const later = await snapshot(db);
    await db.exec(profilesSql);
    await db.exec(labelsSql);
    await db.exec(geometrySql);
    await db.exec(sql);
    check(await snapshot(db), later, 'Repeating all four operations preserves later edits');
  } finally { await db.close(); }

  const staleDb = await prepared();
  try {
    await staleDb.exec("UPDATE catalog.code_value SET comment = 'Zwischenzeitliche Änderung' WHERE identifier = 'profile-eigentumsart/Anmiete'");
    await rejectWithoutChanges(staleDb, sql, /Stale reference-data baseline/);
  } finally { await staleDb.close(); }

  const collisionDb = await prepared();
  try {
    await collisionDb.exec(`INSERT INTO catalog.code_list(identifier, name_de, status)
      VALUES ('r-bbl-mietmodell', 'Bereits vorhandene Liste', 'draft')`);
    await rejectWithoutChanges(collisionDb, sql, /already exists/);
  } finally { await collisionDb.close(); }

  const boundDb = await prepared();
  try {
    await boundDb.exec(`UPDATE catalog.data_field SET code_list_id = (SELECT id FROM catalog.code_list WHERE identifier = 'r-gwr-kat')
      WHERE identifier = 't-geb-gis/bbl_port'`);
    await rejectWithoutChanges(boundDb, sql, /Expected unbound source field/);
  } finally { await boundDb.close(); }
  console.log('BBL Referenzdaten update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
