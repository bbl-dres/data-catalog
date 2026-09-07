/* Execute the Dokumente Management update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const priorSql = ['20260907-business-object-profiles.sql', '20260907-business-object-labels.sql',
  '20260907-business-object-geometry.sql', '20260907-bbl-referenzdaten.sql', '20260907-kompakte-kommentare.sql']
  .map(file => fs.readFileSync(path.join(root, 'supabase/updates', file), 'utf8'));
const sql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-dokumentenmanagement.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const konzepte = JSON.parse(fs.readFileSync(path.join(root, '../prototype-datamodel/data/Konzepte.json'), 'utf8'));
const evidence = konzepte.domains.find(d => d.id === 'dokumentenmanagement').groups.flatMap(g => g.concepts);
const domainsSql = sql.match(/SELECT d\.identifier AS domain[\s\S]*?ORDER BY d\.identifier;/)[0];
const objectsSql = sql.match(/SELECT o\.identifier, o\.name_de AS objekt[\s\S]*?ORDER BY o\.identifier;/)[0];
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
async function prepared(count = priorSql.length) {
  const db = await database();
  for (const script of priorSql.slice(0, count)) await db.exec(script);
  return db;
}

(async () => {
  const db = await database();
  try {
    for (const script of priorSql.slice(0, 4)) await db.exec(script);
    await rejectWithoutChanges(db, sql, /Apply the compact comments first/);
    await db.exec(priorSql[4]);
    const before = await snapshot(db), batches = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.domain === 'dokumente' && Number(row.objekte) === 11)),
      'Preview shows the new domain with eleven objects'); checks++;
    check(await snapshot(db), before, 'Preview preserves every record, reference, revision and change log');
    check(await ledger(db), batches, 'Preview preserves operation markers');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 12', '"expectedChanges": 13'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    check(proposal.objects.length, 11, 'Eleven business objects');
    check(after.domain.length, before.domain.length + 1, 'Exactly one new domain');
    const domain = after.domain.find(d => d.identifier === 'dokumente');
    check([domain.name_de, domain.status, domain.row_version, domain.created_on, domain.modified_on],
      ['Dokumente Management', 'draft', 1, today, today], 'New domain record');
    check(domain.description_de, proposal.domain.description, 'Domain description');
    check(domain.comment, proposal.domain.comment, 'Domain comment records groups, MoSCoW and exclusions');
    check(domain.documentation_links, proposal.domain.links, 'Domain standard links');
    check([domain.responsible_organisation ?? null, domain.data_owner_id ?? null, domain.parent_domain_id ?? null],
      [null, null, null], 'No invented domain assertions');

    for (const item of proposal.objects) {
      const row = after.business_object.find(o => o.identifier === item.id);
      assert.ok(row, 'Created object: ' + item.id); checks++;
      check([row.name_de, row.description_de, row.comment, row.status, row.row_version],
        [item.name, item.description, item.comment, 'draft', 1], 'Exact object record: ' + item.id);
      check(row.domain_id, domain.id, 'Object belongs to the new domain: ' + item.id);
      check(row.normative_references, item.standards, 'Standards preserved: ' + item.id);
      check([row.classification ?? null, row.contains_personal_data ?? null, row.version ?? null,
        row.data_owner_id ?? null, row.responsible_organisation ?? null],
        [null, null, null, null, null], 'Zone precedent, no invented governance: ' + item.id);
      const source = evidence.find(c => c.name === item.name);
      check(source.description, item.description, 'Description equals datamodel evidence: ' + item.id);
      assert.ok(item.comment.includes('Priorität: ' + source.priority), 'Priority equals evidence: ' + item.id); checks++;
    }
    for (const excluded of ['Physisches Archiv', 'Datei'])
      check(after.business_object.some(o => o.name_de === excluded), false, 'Deliberately not modelled: ' + excluded);
    check(after.business_object.length, before.business_object.length + 11, 'Exactly eleven new objects');

    for (const table of Object.keys(before).filter(k => Array.isArray(before[k]) && before[k][0]?.id)) {
      for (const previous of before[table])
        check(after[table].find(r => r.id === previous.id), previous, 'Untouched record: ' + table + ':' + (previous.identifier ?? previous.id));
    }
    check(after.change_event, before.change_event, 'No change-log records created');

    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Runtime loads updated catalog without broken references');
    check(DK.data.get('domains', 'dokumente').name, 'Dokumente Management', 'Domain projects into the app');
    check(DK.data.objects.filter(o => DK.data.domainForEntity('objects', o)?.identifier === 'dokumente').length, 11,
      'All eleven objects project into the app');
    check(DK.data.get('objects', 'dokumentversion').name, 'Version', 'Version keeps its document-scoped identifier');

    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat execution performs no edits');
    check(await ledger(db), appliedLedger, 'Repeat execution preserves marker timestamp');
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 12', '"expectedChanges": 13'), /different content/);
    await db.exec("UPDATE catalog.business_object SET name_de = 'Späterer Name' WHERE identifier = 'dokument'");
    const later = await snapshot(db);
    for (const script of priorSql) await db.exec(script);
    await db.exec(sql);
    check(await snapshot(db), later, 'Repeating all six operations preserves later edits');
  } finally { await db.close(); }

  const collisionDb = await prepared();
  try {
    await collisionDb.exec(`INSERT INTO catalog.business_object(identifier, name_de, domain_id, status)
      SELECT 'dossier', 'Bereits vorhandenes Objekt', id, 'draft' FROM catalog.domain WHERE identifier = 'bau'`);
    await rejectWithoutChanges(collisionDb, sql, /already exists/);
  } finally { await collisionDb.close(); }

  const domainCollisionDb = await prepared();
  try {
    await domainCollisionDb.exec("INSERT INTO catalog.domain(identifier, name_de, status) VALUES ('dokumente', 'Bereits vorhandene Domäne', 'draft')");
    await rejectWithoutChanges(domainCollisionDb, sql, /already exists/);
  } finally { await domainCollisionDb.close(); }
  console.log('Dokumente Management update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
