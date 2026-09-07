/* Execute the Datenprodukte review against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql',
  '20260907-referenzdaten-namen.sql', '20260907-iso-laender.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/updates', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-datenprodukte-review.sql'), 'utf8');
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
    for (const script of priorSql.slice(10, 12)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the ISO country list first/);
    await db.exec(priorSql[12]);
    const before = await snapshot(db), batches = await ledger(db);
    for (const [key, id] of [['retire', 'p-opendata'], ['rename', 'p-gebaeudebestand']]) {
      const record = before.data_product.find(p => p.identifier === id);
      check(record.row_version, proposal[key].revision, 'Replayed baseline revision: ' + id);
      for (const [column, value] of Object.entries(proposal[key].before)) {
        check(record[column], value, 'Replayed baseline ' + column + ': ' + id);
      }
    }
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.identifier === 'p-gebaeudebestand' && row.name_de === 'SAP Liegenschafteninventar')),
      'Preview shows the renamed product'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 2', '"expectedChanges": 3'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"revision": 1,\n    "before": {\n      "status": "draft"', '"revision": 2,\n    "before": {\n      "status": "draft"'), /Stale Open-Data baseline/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const retired = after.data_product.find(p => p.identifier === 'p-opendata');
    check([retired.status, retired.comment, retired.description_de, retired.row_version, retired.modified_on],
      ['retired', proposal.retire.after.comment, proposal.retire.after.description, 2, today], 'Open-Data product retired');
    const renamed = after.data_product.find(p => p.identifier === 'p-gebaeudebestand');
    check([renamed.name_de, renamed.description_de, renamed.formats, renamed.update_frequency, renamed.row_version, renamed.modified_on],
      ['SAP Liegenschafteninventar', proposal.rename.after.description, ['Parquet', 'CSV'], 'monthly', 2, today],
      'SAP Liegenschafteninventar renamed and redescribed');
    const rest = record => {
      const { status, comment, name_de, description_de, formats, update_frequency, row_version, modified_on, ...other } = record;
      return other;
    };
    for (const id of ['p-opendata', 'p-gebaeudebestand']) {
      check(rest(after.data_product.find(p => p.identifier === id)), rest(before.data_product.find(p => p.identifier === id)),
        'Identity, governance and ownership unchanged: ' + id);
    }
    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table]) {
        if (table === 'data_product' && ['p-opendata', 'p-gebaeudebestand'].includes(previous.identifier)) continue;
        check(after[table].find(x => x.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
      }
    }
    check(after.change_event, before.change_event, 'No change-log records created');
    check(after.product_attribute.filter(a => a.data_product_id === retired.id).length, 3, 'Retired product keeps its attributes');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('products', 'p-opendata').status, 'Archiviert', 'Retired product shows as archived');
    check(DK.data.get('products', 'p-gebaeudebestand').name, 'SAP Liegenschafteninventar', 'Renamed product projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 2', '"expectedChanges": 3'), /different content/);
  } finally { await db.close(); }
  console.log('Datenprodukte-Review: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
