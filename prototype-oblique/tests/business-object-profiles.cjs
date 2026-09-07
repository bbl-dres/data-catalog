/* Execute the reviewed content update against isolated PostgreSQL; no hosted writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');

const sql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-profiles.sql'), 'utf8');
const proposal = JSON.parse(sql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const labelsSql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-labels.sql'), 'utf8');
const labelProposal = JSON.parse(labelsSql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
// The Markdown moved on to the 106-attribute revision; overlay the later reviewed
// operation so this suite still verifies its own payload against the current document.
const geometrySql = fs.readFileSync(path.join(root, 'supabase/updates/20260907-business-object-geometry.sql'), 'utf8');
const geometryProposal = JSON.parse(geometrySql.match(/\$proposal\$([\s\S]*?)\$proposal\$/)[1]);
const revisedLater = (kind, id) => geometryProposal.changes.find(c => c.kind === kind && c.id === id)?.after || {};
const reportSql = sql.match(/SELECT o\.identifier AS business_object,[\s\S]*?GROUP BY o\.identifier ORDER BY o\.identifier;/)[0];
const expectedCounts = { gebaeude: 32, geschoss: 10, raum: 10, zone: 7, grundstueck: 21, wirtschaftseinheit: 8, bemessung: 10 };
const canonical = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [
  /_(de|it|fr|en)$/.test(key) ? key : key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value,
]));
const snapshot = async db => (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot;
const ledger = async db => (await db.query('SELECT * FROM catalog_private.import_batch ORDER BY identifier')).rows;
const aggregate = (state, table, row) => ({ ...canonical(row), ...(table === 'business_attribute' ? {
  qualityRequirementIds: state.business_attribute_quality_requirement.filter(q => q.business_attribute_id === row.id)
    .map(q => q.quality_requirement_id).sort(),
} : {}) });
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
async function rejectWithoutChanges(db, script, pattern) {
  const before = await snapshot(db), batches = await ledger(db);
  await assert.rejects(db.exec(script), pattern); checks++;
  await db.exec('ROLLBACK');
  check(await snapshot(db), before, 'Refused operation leaves every record/revision/event unchanged');
  check(await ledger(db), batches, 'Refused operation does not consume the operation ID');
}
async function scenario(label, prepare, pattern) {
  const db = await database();
  try {
    await prepare(db);
    await rejectWithoutChanges(db, sql, pattern);
    console.log('Passed:', label);
  } finally { await db.close(); }
}

(async () => {
  const document = fs.readFileSync(path.join(root, 'docs/business-object-attribute-proposal.md'), 'utf8');
  const parsed = {};
  for (const object of proposal.objects) {
    const section = document.split('## ' + object.name + ' — ')[1].split('\n## ')[0];
    const table = section.match(/^\| Attribut \| Property Set \|[^\n]*\n(?:\|[^\n]*\n?)+/m)[0];
    parsed[object.id] = table.trim().split('\n').slice(2).map(row => row.split('|').slice(1, -1).map(c => c.trim()));
    check(parsed[object.id].length, geometryProposal.counts[object.id], 'Current Markdown profile count');
    check(proposal.attributes.filter(a => a.object === object.id).length, expectedCounts[object.id], 'SQL profile count');
    assert.ok(section.includes(revisedLater('business_object', object.id).description_de || object.description)); checks++;
  }
  for (const a of proposal.attributes) {
    const renamed = labelProposal.changes.find(c => c.kind === 'business_attribute' && c.id === a.object + '/' + a.id)?.after || {};
    const later = revisedLater('business_attribute', a.object + '/' + a.id);
    const name = later.name_de || renamed.name_de || a.name;
    const description = later.description_de || renamed.description_de || a.description;
    const propertySet = later.comment?.match(/Property Set \(vorgeschlagen\): ([^\n]*)/)?.[1] || a.propertySet;
    const row = parsed[a.object].find(r => r[0] === name);
    assert.ok(row, 'SQL attribute occurs in Markdown: ' + name); checks++;
    check([row[1], row[2].replace(/\x60/g, ''), row[3].replace(/\x60/g, ''), row[4]],
      [propertySet, a.keyRole || '—', a.type, description], 'Exact group, role, type and final German definition');
    check(row[5], later.comment?.includes('Optionale Angabe:') ? 'Optional'
      : later.comment?.match(/Bedingte Angabe: ([^\n]*)/) ? 'Bedingt: ' + later.comment.match(/Bedingte Angabe: ([^\n]*)/)[1]
      : a.presence === 'core' ? 'Kernangabe' : a.presence === 'optional' ? 'Optional' : 'Bedingt: ' + a.condition,
      'Exact conditional applicability');
  }
  check(proposal.attributes.length, 98, '98 active definitions');
  check(proposal.attributes.filter(a => a.semantic).length, 77, '77 new definitions');
  check(proposal.retire.length, 7, '7 superseded definitions retired');
  check(proposal.expectedChanges, 161, '161 changed records');

  const db = await database();
  try {
    const before = await snapshot(db), initialLedger = await ledger(db);
    const preview = await db.exec(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));
    assert.ok(preview.some(r => r.rows?.some(row => row.business_object === 'zone' && row.active_attributes === 7))); checks++;
    check(await snapshot(db), before, 'Preview rolls back objects, attributes, lists, values, rules and history');
    check(await ledger(db), initialLedger, 'Preview leaves the operation ledger unchanged');
    check((await db.query(reportSql)).rows.some(r => r.business_object === 'zone'), false, 'Standalone report after preview reads the rolled-back catalog');
    await rejectWithoutChanges(db, sql.replace('"count": 32', '"count": 33'), /Unexpected active attribute count/);
    await rejectWithoutChanges(db, sql.replace('"expectedChanges": 161', '"expectedChanges": 162'), /Unexpected record change count/);

    await db.exec(sql);
    const after = await snapshot(db);
    const report = (await db.query(reportSql)).rows;
    check(Object.fromEntries(report.map(r => [r.business_object, r.active_attributes])), expectedCounts, 'Report works independently after commit');
    check(report.reduce((sum, r) => sum + r.retired_attributes, 0), 7, 'Report separates seven retirements');
    check((await db.query("SELECT to_regclass('pg_temp.profile_changes') AS temp")).rows[0].temp, null, 'No temporary report table required');
    const targets = new Set(after.business_object.filter(o => Object.hasOwn(expectedCounts, o.identifier)).map(o => o.id));
    const retired = new Set(proposal.retire.map(a => a.id));
    const findAttribute = identifier => after.business_attribute.find(a => a.identifier === identifier);
    for (const object of after.business_object.filter(o => targets.has(o.id))) {
      const attrs = after.business_attribute.filter(a => a.business_object_id === object.id);
      check(attrs.filter(a => a.status === 'draft').length, expectedCounts[object.identifier], 'Active draft profile: ' + object.identifier);
      const old = before.business_object.find(o => o.id === object.id);
      if (old) {
        check(object.row_version, 2, 'Exactly one object edit revision');
        for (const key of Object.keys(old).filter(k => !['description_de', 'comment', 'status', 'modified_on', 'row_version'].includes(k)))
          check(object[key], old[key], 'Existing object metadata preserved: ' + key);
      } else {
        check(object.identifier, 'zone', 'Only Zone is a new business object');
        check(object.row_version, 1, 'New Zone starts at revision 1');
        check(object.domain_id, after.business_object.find(o => o.identifier === 'raum').domain_id, 'Zone is in the spatial business domain');
        check([object.data_owner_id, object.data_steward_id, object.responsible_organisation, object.classification, object.contains_personal_data],
          [null, null, null, null, null], 'New object does not fabricate governance/sensitivity');
      }
    }
    for (const old of before.business_attribute.filter(a => targets.has(a.business_object_id))) {
      const current = findAttribute(old.identifier);
      check(current.id, old.id, 'Existing UUID/bookmark identity retained');
      check(current.semantic_name, old.semantic_name, 'Existing semantic name retained');
      check(current.row_version, 2, 'One attribute edit revision including owned assignment changes');
      check(current.created_on, old.created_on, 'Historical creation date preserved');
      check(current.status, retired.has(old.identifier) ? 'retired' : 'draft', 'Reviewed retirement');
      const altered = retired.has(old.identifier)
        ? ['status', 'comment', 'modified_on', 'row_version']
        : ['name_de', 'description_de', 'comment', 'status', 'modified_on', 'row_version', 'value_specification', 'is_identifier', 'code_list_id'];
      for (const key of Object.keys(old).filter(k => !altered.includes(k)))
        check(current[key], old[key], 'Unchanged attribute metadata: ' + key);
      if (retired.has(old.identifier))
        check(aggregate(after, 'business_attribute', current).qualityRequirementIds,
          aggregate(before, 'business_attribute', old).qualityRequirementIds, 'Retired requirements preserved');
    }
    for (const a of proposal.attributes) {
      const current = findAttribute(a.object + '/' + a.id);
      check(current.name_de, a.name, 'German label');
      check(current.description_de, a.description, 'German definition');
      check(current.value_specification, { valueType: a.type, ...(a.spec || {}) }, 'Only reviewed value and geometry metadata');
      check(current.is_identifier, a.identity, 'Identifier participation matches PK/component role');
      assert.ok(current.comment.includes('Property Set (vorgeschlagen): ' + a.propertySet)); checks++;
      if (a.keyRole) { assert.ok(current.comment.includes('Schlüsselrolle: ' + a.keyRole)); checks++; }
      if (a.semantic) {
        check(current.row_version, 1, 'New attribute revision');
        check(current.semantic_name, a.semantic, 'New semantic name');
        check(current.created_on, current.modified_on, 'New attribute dates');
        check([current.data_owner_id, current.responsible_organisation, current.classification, current.contains_personal_data],
          [null, null, null, null], 'No invented attribute governance/sensitivity');
      }
      const rules = after.business_attribute_quality_requirement.filter(q => q.business_attribute_id === current.id)
        .map(q => after.quality_requirement.find(r => r.id === q.quality_requirement_id));
      check(rules.map(r => r.rule_type), a.presence === 'optional' ? [] : [a.presence === 'core' ? 'required' : 'custom'], 'Presence rules');
      check(rules.every(r => r.status === 'draft' && r.dimension === 'completeness'), true, 'Draft completeness semantics');
      if (a.condition) check(rules[0].description_de, a.condition, 'Conditional rule is complete');
      check(current.code_list_id, a.codeList ? after.code_list.find(c => c.identifier === a.codeList).id : null, 'Reviewed code-list binding');
    }
    for (const id of ['wirtschaftseinheit/buchungskreis', 'wirtschaftseinheit/we-nummer', 'gebaeude/grundstueck'])
      check(findAttribute(id).status, 'draft', 'Reuse confirmed key/reference definition: ' + id);
    check(findAttribute('gebaeude/grundstueck').name_de, 'EGRID', 'Existing building parcel reference becomes explicit EGRID');
    check(findAttribute('grundstueck/parzellennummer').name_de, 'Grundstücksnummer (amtlich)', 'Official parcel number stays distinct');
    check(findAttribute('grundstueck/grundstuecksnummer-bbl').value_specification.valueType, 'identifier', 'BBL parcel number preserves textual identity');
    for (const object of ['gebaeude', 'grundstueck']) {
      for (const id of ['buchungskreis', 'wirtschaftseinheit'])
        check(findAttribute(object + '/' + id).is_identifier, true, 'SAP composite-key component');
      for (const id of ['eigentumsart', 'eigentuemer', 'teilportfolio'])
        check(findAttribute(object + '/' + id).status, 'draft', 'Ownership/portfolio on building and parcel');
      check(findAttribute(object + '/eigentumsart').code_list_id, after.code_list.find(c => c.identifier === 'profile-eigentumsart').id, 'Shared agreed Eigentumsart');
    }
    for (const list of proposal.codeLists) {
      const current = after.code_list.find(c => c.identifier === list.id);
      check(current.status, 'draft', 'New vocabulary stays draft');
      const values = after.code_value.filter(v => v.code_list_id === current.id);
      check(values.map(v => v.code).sort(), list.values.map(v => v.code).sort(), 'Exact local vocabulary');
      for (const value of list.values) {
        const row = values.find(v => v.code === value.code);
        check([row.name_de, row.description_de, row.row_version], [value.name, value.description, 1], 'Exact value definition and initial revision');
        if (list.id === 'profile-bemessungsart' || list.id === 'profile-bemessungsumfang') {
          const laterValue = revisedLater('code_value', list.id + '/' + value.code);
          assert.ok(document.includes(laterValue.description_de || value.description)); checks++;
        }
      }
    }
    check(after.code_value.filter(v => v.code_list_id === findAttribute('bemessung/bemessungsart').code_list_id).map(v => v.code).sort(),
      ['GF', 'GGF', 'GSF', 'GV', 'VMF'].sort(), 'Exactly five basic kinds; no inherited full SIA list');
    for (const id of ['gebaeude/gebaeudestatus', 'gebaeude/gebaeudeklasse', 'gebaeude/objektstrategie'])
      check(findAttribute(id).code_list_id, null, 'Unconfirmed vocabulary remains unbound');
    check(after.business_attribute.filter(a => targets.has(a.business_object_id) && a.is_identifier && a.status !== 'retired').length,
      15, 'Seven full IDs and eight components participate in identification');
    check(findAttribute('geschoss/building-id').is_identifier, false, 'Building reference on floor is not a PK');
    check(findAttribute('gebaeude/egid').is_identifier, false, 'EGID is not the building PK');
    check(findAttribute('grundstueck/egrid').is_identifier, false, 'EGRID is not the parcel PK');

    check(after.change_event, before.change_event, 'Prototype update creates no change-log entries');
    const today = (await db.query("SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date::text AS today")).rows[0].today;
    for (const table of ['business_object', 'business_attribute', 'quality_requirement', 'code_list', 'code_value', 'relationship']) {
      for (const row of after[table].filter(r => JSON.stringify(r) !== JSON.stringify(before[table].find(b => b.id === r.id))))
        check(row.modified_on, today, 'Changed record gets the current edit date');
    }
    for (const table of Object.keys(before).filter(key => Array.isArray(before[key]))) {
      if (table === 'business_object') check(after[table].filter(r => !targets.has(r.id)), before[table].filter(r => !targets.has(r.id)), 'Other objects unchanged');
      else if (table === 'business_attribute') check(after[table].filter(r => !targets.has(r.business_object_id)), before[table].filter(r => !targets.has(r.business_object_id)), 'Other attributes unchanged');
      else if (['quality_requirement', 'change_event', 'code_list', 'code_value', 'relationship'].includes(table))
        check(after[table].filter(r => before[table].some(b => b.id === r.id)), before[table], 'Existing ' + table + ' unchanged');
      else if (table === 'business_attribute_quality_requirement') {
        const untouched = new Set(before.business_attribute.filter(a => !targets.has(a.business_object_id) || retired.has(a.identifier)).map(a => a.id));
        check(after[table].filter(r => untouched.has(r.business_attribute_id)), before[table].filter(r => untouched.has(r.business_attribute_id)), 'Other/retired assignments unchanged');
      } else check(after[table], before[table], table + ' unchanged, including source fields and relationship assertions');
    }
    const measurementLinks = after.relationship.filter(r => proposal.measurements.some(m => m.id === r.identifier));
    check(measurementLinks.length, 5, 'Five explicit measurement-subject requirements');
    for (const item of proposal.measurements) {
      const link = measurementLinks.find(r => r.identifier === item.id);
      check(link.relationship_type, 'measuredFor', 'Use the existing supported relationship type');
      check(link.verification_status, 'candidate', 'Do not assert measured data coverage or implementation');
      check(link.rule_notes_de, item.notes, 'Exact measurement selections and applicability');
      check(link.source_business_object_id, after.business_object.find(o => o.identifier === 'bemessung').id, 'Measurement subject source');
      check(link.target_business_object_id, after.business_object.find(o => o.identifier === item.target).id, 'Correct measured subject');
    }
    assert.match(measurementLinks.find(r => r.identifier === 'profile-bemessung-grundstueck').rule_notes_de, /GSF \/ GESAMT \/ m²/); checks++;
    const { DK } = runtime(after);
    await DK.data.load('data/');
    check(Array.from(DK.data.validate()), [], 'Actual runtime loads the resulting snapshot without dangling references');
    check(DK.data.get('tables', 't-huelle').fields.length, 30, 'Gebäudehülle keeps all 30 fields');
    for (const [id, count] of Object.entries(expectedCounts))
      check(DK.data.get('objects', id).attributes.filter(a => a.status === 'Entwurf').length, count, 'Runtime active profile: ' + id);
    check(DK.data.get('objects', 'gebaeude').attributes.find(a => a.identifier === 'egid').mandatory, null, 'Conditional GWR reference');
    check(DK.data.get('objects', 'gebaeude').attributes.find(a => a.identifier === 'gebaeude-id').keyRole, 'PK', 'Gebäude-ID is a PK in runtime');
    const appliedLedger = await ledger(db);
    await db.exec(sql);
    check(await snapshot(db), after, 'Repeat run leaves revisions/history unchanged');
    check(await ledger(db), appliedLedger, 'Repeat run leaves ledger timestamp unchanged');
    await rejectWithoutChanges(db, sql.replace('Lesbarer Gebäudename', 'Geänderter Gebäudename'), /different content/);
    await db.exec("UPDATE catalog.business_object SET comment = 'Later reviewed edit' WHERE identifier = 'gebaeude'");
    const later = await snapshot(db);
    await db.exec(sql);
    check(await snapshot(db), later, 'Repeat run never overwrites subsequent edits');
  } finally { await db.close(); }

  await scenario('stale object revision', db => db.exec("UPDATE catalog.business_object SET comment = 'Concurrent edit' WHERE identifier = 'geschoss'"), /Stale profile baseline/);
  await scenario('stale child revision', db => db.exec("UPDATE catalog.business_attribute SET comment = 'Concurrent edit' WHERE identifier = 'wirtschaftseinheit/we-nummer'"), /Stale profile baseline/);
  await scenario('changed owned assignments', db => db.exec("DELETE FROM catalog.business_attribute_quality_requirement WHERE business_attribute_id = (SELECT id FROM catalog.business_attribute WHERE identifier = 'gebaeude/egid')"), /Quality assignments differ/);
  await scenario('unexpected additional attribute', db => db.exec("INSERT INTO catalog.business_attribute(identifier, business_object_id, semantic_name, name_de) SELECT 'gebaeude/later-field', id, 'laterField', 'Later field' FROM catalog.business_object WHERE identifier = 'gebaeude'"), /Attribute scope differs/);
  await scenario('pre-existing proposed rule', db => db.exec("INSERT INTO catalog.quality_requirement(identifier, name_de, rule_type, dimension) VALUES ('profile-core', 'Existing rule', 'required', 'completeness')"), /identifier already exists/);
  await scenario('pre-existing Zone', db => db.exec("INSERT INTO catalog.business_object(identifier, name_de, domain_id) SELECT 'zone', 'Existing Zone', domain_id FROM catalog.business_object WHERE identifier = 'raum'"), /identifier already exists/);
  await scenario('pre-existing profile code list', db => db.exec("INSERT INTO catalog.code_list(identifier, name_de) VALUES ('profile-eigentumsart','Existing vocabulary')"), /identifier already exists/);
  await scenario('changed reference vocabulary', db => db.exec("UPDATE catalog.code_list SET comment = 'New review' WHERE identifier = 'r-gwr-kat'"), /reviewed GWR code list/);
  await scenario('changed reference value', db => db.exec("UPDATE catalog.code_value SET name_de = 'Changed meaning' WHERE identifier = 'r-gwr-kat/1010'"), /Reviewed vocabulary values changed/);
  await scenario('existing measuredFor scope', db => db.exec("INSERT INTO catalog.relationship(identifier,source_business_object_id,target_business_object_id,relationship_type) SELECT 'independent-measurement',s.id,t.id,'measuredFor' FROM catalog.business_object s CROSS JOIN catalog.business_object t WHERE s.identifier='bemessung' AND t.identifier='grundstueck'"), /Measurement relationship scope changed/);
  // Simulate a different revision-1 import with translations, in this isolated fixture only.
  await scenario('baseline translation requires review', db => db.exec("ALTER TABLE catalog.business_attribute DISABLE TRIGGER b_guard_record; UPDATE catalog.business_attribute SET name_fr = 'Identifiant' WHERE identifier = 'raum/raum-id'; ALTER TABLE catalog.business_attribute ENABLE TRIGGER b_guard_record"), /Translated definitions need review/);
  await scenario('earlier profile operation already applied', db => db.exec("INSERT INTO catalog_private.import_batch(identifier,fingerprint) VALUES ('business-object-profiles-20260907-v1',repeat('0',64))"), /superseded profile update was applied/);
  console.log('Business-object profile update: ' + checks + ' checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
