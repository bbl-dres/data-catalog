/* Execute the Bodenbedeckung profile update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql',
  '20260907-dokumentenmanagement.sql', '20260907-architektonische-sicht.sql', '20260907-dokumente-kuerzung.sql',
  '20260907-cafm-basisplan.sql', '20260907-technische-anlage-ebkph.sql', '20260907-kommentar-review.sql',
  '20260907-referenzdaten-namen.sql', '20260907-iso-laender.sql', '20260907-datenprodukte-review.sql',
  '20260907-iso-land-domain.sql', '20260907-referenzdaten-bereinigung.sql', '20260907-flaechenarten.sql',
  '20260907-crb-kostenelemente.sql', '20260907-kbob-dokumenttypen.sql', '20260907-praezise-namen.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-bodenbedeckung-profil.sql'), 'utf8');
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

check(proposal.create.length, 11, 'Eleven new attributes');
check(proposal.create.map(c => c.id.split('/')[1]),
  ['egid', 'egrid', 'art', 'land', 'region', 'ort', 'postleitzahl', 'adresszusatz', 'geometrie', 'teilportfolio', 'flaeche'],
  'Reviewed attribute set: registers, Art, address without Strasse/Hausnummer, geometry, portfolio, area');
check(proposal.create.filter(c => c.codeList).map(c => [c.id.split('/')[1], c.codeList]),
  [['art', 'r-av-land-cover-type'], ['land', 'r-iso-land'], ['teilportfolio', 'r-bbl-teilportfolio']],
  'Reference-data bindings');
check(proposal.retire.map(r => r.before), ['Bezeichnung', 'Gültig ab'], 'Bezeichnung and Gültig ab retired');

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10, 19)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the precise names first/);
    await db.exec(priorSql[19]);
    const before = await snapshot(db), batches = await ledger(db);
    const objectBefore = before.business_object.find(o => o.identifier === 'bodenbedeckung');
    check([objectBefore.comment, objectBefore.row_version], [null, 1], 'Replayed object baseline');

    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(x => x.rows?.some(row => row.identifier === 'bodenbedeckung/art' && row.referenzliste === 'r-av-land-cover-type')),
      'Preview shows the bound Art attribute'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 14', '"expectedChanges": 15'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"revision": 1, "before": "Bezeichnung"', '"revision": 2, "before": "Bezeichnung"'), /Stale attribute baseline/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    const object = after.business_object.find(o => o.identifier === 'bodenbedeckung');
    check([object.comment, object.row_version, object.modified_on],
      [proposal.object.afterComment, 2, today], 'Object comment documents the review');
    for (const r of proposal.retire) {
      const attr = after.business_attribute.find(a => a.identifier === r.id);
      check([attr.status, attr.comment, attr.row_version, attr.modified_on],
        ['retired', proposal.retireComment, 2, today], 'Retired attribute: ' + r.id);
    }
    const lists = Object.fromEntries(after.code_list.map(l => [l.identifier, l.id]));
    for (const c of proposal.create) {
      const attr = after.business_attribute.find(a => a.identifier === c.id);
      assert.ok(attr, 'Created attribute: ' + c.id); checks++;
      check([attr.name_de, attr.semantic_name, attr.description_de, attr.value_specification, attr.code_list_id,
        attr.is_identifier, attr.status, attr.row_version, attr.created_on, attr.business_object_id],
        [c.name, c.semantic, c.description, c.spec, c.codeList ? lists[c.codeList] : null,
          false, 'draft', 1, today, object.id], 'Exact attribute record: ' + c.id);
    }
    check(after.business_attribute.filter(a => a.business_object_id === object.id && a.status !== 'retired').length, 13,
      'Thirteen active attributes: ID, Status and the eleven reviewed additions');
    const changed = new Set(['business_object:bodenbedeckung', ...proposal.retire.map(r => 'business_attribute:' + r.id)]);
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
    check(DK.data.attr('bodenbedeckung/land').codeList, 'r-iso-land', 'Country binding projects into the app');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 14', '"expectedChanges": 15'), /different content/);
  } finally { await db.close(); }
  console.log('Bodenbedeckung-Profil: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
