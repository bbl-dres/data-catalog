/* Execute the key-role review against isolated PostgreSQL; no hosted writes. */
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
  '20260907-crb-kostenelemente.sql', '20260907-kbob-dokumenttypen.sql', '20260907-praezise-namen.sql',
  '20260907-bodenbedeckung-profil.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/archive', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/archive/20260907-schluessel-review.sql'), 'utf8');
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

check(proposal.changes.length, 8, 'Eight key corrections');
for (const c of proposal.changes) {
  assert.ok(!c.after.includes('PK-Komponente'), 'No PK-Komponente survives: ' + c.id); checks++;
}
check(proposal.changes.filter(c => c.after.includes('Schlüsselrolle: FK')).length, 5, 'Five components become FK');
check(proposal.changes.filter(c => !c.after.includes('Schlüsselrolle')).map(c => c.id),
  ['gebaeude/gebaeudenummer-bbl', 'grundstueck/grundstuecksnummer-bbl', 'wirtschaftseinheit/we-nummer'],
  'Non-unique numbers lose their key role');

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 10)) await db.exec(script);
    /* Hosted baseline drift replayed before the comment review that pins it. */
    await db.exec("UPDATE catalog.data_table SET name_de = 'Gebäudehülle' WHERE identifier = 't-huelle' AND name_de = 'Gebäudehülle (AO)'");
    for (const script of priorSql.slice(10, 20)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the Bodenbedeckung profile first/);
    await db.exec(priorSql[20]);
    const before = await snapshot(db), batches = await ledger(db);
    for (const c of proposal.changes) {
      const record = before.business_attribute.find(a => a.identifier === c.id);
      check([record.comment, record.row_version, record.is_identifier], [c.before, c.revision, true],
        'Replayed baseline: ' + c.id);
    }

    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(x => x.rows?.some(row => row.identifier === 'gebaeude/buchungskreis' && row.pk === false && row.rolle === 'FK')),
      'Preview shows the corrected component'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 8', '"expectedChanges": 9'), /Unexpected record change count/);
    await rejectWithoutChanges(db, sql.replace('"id": "gebaeude/buchungskreis", "revision": 3', '"id": "gebaeude/buchungskreis", "revision": 4'), /Stale key baseline/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    for (const c of proposal.changes) {
      const current = after.business_attribute.find(a => a.identifier === c.id);
      check([current.comment, current.is_identifier, current.row_version, current.modified_on],
        [c.after, false, c.revision + 1, today], 'Corrected key role: ' + c.id);
    }
    const objects = new Map(after.business_object.map(o => [o.id, o.identifier]));
    const pkCounts = {};
    for (const a of after.business_attribute.filter(a => a.status !== 'retired' && a.is_identifier)) {
      const object = objects.get(a.business_object_id);
      pkCounts[object] = (pkCounts[object] || 0) + 1;
    }
    assert.ok(Object.values(pkCounts).every(n => n === 1), 'At most one primary key per object'); checks++;
    check(pkCounts.gebaeude, 1, 'Gebäude keeps exactly one PK');
    const changed = new Set(proposal.changes.map(c => 'business_attribute:' + c.id));
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
    check(DK.data.attr('gebaeude/gebaeude-id').keyRole, 'PK', 'ID attribute stays the primary key');
    check(DK.data.attr('gebaeude/buchungskreis').keyRole, 'FK', 'Component now shows as foreign key');
    check(DK.data.attr('gebaeude/egid').keyRole, 'FK', 'Documented FK reaches the app');
    check(DK.data.attr('gebaeude/gebaeudenummer-bbl').keyRole, null, 'Non-unique number carries no key role');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 8', '"expectedChanges": 9'), /different content/);
  } finally { await db.close(); }
  console.log('Schlüssel-Review: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
