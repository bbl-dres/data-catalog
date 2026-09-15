/* Atomic administrator content import, with source evidence and per-record history. */
const fs = require('node:fs');
const path = require('node:path');
const source = require('../docs/sources/gwr/2026-09-15-entrance-source.json');
const importId = 'gwr-entrance-20260915-v1';
const objectIdentifier = 'gebaeudeeingang';
const link = url => ({ url, purpose: 'documentation' });

function inventory() {
  const fields = [source.building_reference, ...source.fields];
  const types = { EGID: 'identifier', EDID: 'identifier', EGAID: 'identifier', DEINR: 'text',
    DKODE: 'decimal', DKODN: 'decimal', DOFFADR: 'code', DPLZ4: 'code', DPLZZ: 'code', DPLZNAME: 'text' };
  const attributes = fields.map((field, index) => {
    const code = field.code;
    const keyNote = code === 'EGID'
      ? 'Gebäudereferenz und Bestandteil der Eingangsidentität EGID + EDID; EGID allein identifiziert keinen Eingang. Ergänzung aus dem Gebäudemerkmal, keine zusätzliche Spalte der importierten Eingangstabelle.'
      : code === 'EDID' ? 'Bestandteil der Eingangsidentität EGID + EDID; EDID allein ist nicht schweizweit eindeutig.'
      : code === 'EGAID' ? 'Identifiziert die Gebäudeadresse. Die Eingangsidentität wird durch EGID + EDID beschrieben.'
      : code === 'DPLZZ' ? 'Als zweistelligen Code darstellen, einschliesslich führender Null (00–99).'
      : '';
    return { code, required: !['DEINR', 'DKODE', 'DKODN'].includes(code),
      sourceField: code === 'EGID' ? null : 't-gwr-gebaeudeeingang/' + code,
      patch: { identifier: objectIdentifier + '/' + code.toLowerCase(), semantic_name: code.toLowerCase(),
        name_de: field.label, description_de: field.description,
        status: 'draft', is_identifier: ['EGID', 'EDID'].includes(code), sort_order: (index + 1) * 10,
        property_group: ['EGID', 'EDID', 'EGAID'].includes(code) ? 'Identifikation'
          : ['DKODE', 'DKODN'].includes(code) ? 'Lage' : 'Adresse',
        value_specification: { valueType: types[code], format: field.metadata.Codierung },
        documentation_links: [link(field.source_url)],
        comment: [`GWR-Merkmal ${code}; Merkmalskatalog ${source.source_version}.`, keyNote,
          ...Object.entries(field.metadata).map(([key, value]) => `${key}: ${value}`)].filter(Boolean).join('\n') }
    };
  });
  return { source_sha256: source.source_sha256,
    object: { identifier: objectIdentifier, name_de: 'Gebäudeeingang', status: 'draft',
      description_de: source.definition,
      documentation_links: [link(source.definition_url), link(source.fields_url)],
      comment: 'Fachliches Profil nach GWR-Merkmalskatalog 5.0.0 (revised). GWR-Umfang: mindestens ein Eingang pro Gebäude; zusätzliche Keller-, Garagen- und Noteingänge gelten nicht als Gebäudeeingang. Jeder Eingang gehört zu einem Gebäude. EGID + EDID identifizieren den Eingang; eine Neuadressierung verändert diese Identität nicht. Neun Merkmale aus dem Eingangsabschnitt, ergänzt um die Gebäudereferenz EGID. Die Quelle dokumentiert das Schweizer GWR; das lokale Geschäftsobjekt und seine Attribute sind Entwurf.' },
    attributes };
}

function sqlFor({ baselineHash, commit = false }) {
  if (!/^[a-f0-9]{32}$/.test(baselineHash)) throw Error('Invalid baseline hash');
  const payload = JSON.stringify(inventory());
  if (payload.includes('$entrance_payload$')) throw Error('Unsafe SQL delimiter');
  return `-- Gebäudeeingang: 1 object, 10 attributes, 1 completeness rule, 10 source mappings.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
DO $entrance_import$
DECLARE plan jsonb := $entrance_payload$${payload}$entrance_payload$::jsonb;
  before_snapshot jsonb; after_snapshot jsonb; table_row catalog.data_table; field_row catalog.data_field;
  object_id uuid; attribute_id uuid; rule_id uuid; relation_id uuid; code_list uuid;
  patch jsonb; item jsonb; inserted jsonb; cols text; pair record; event record;
  now_at timestamptz := clock_timestamp(); today date := (now_at AT TIME ZONE 'UTC')::date;
  created jsonb := '[]'; report jsonb;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Administrative import requires postgres'; END IF;
  PERFORM pg_advisory_xact_lock(18427,1);
  before_snapshot := catalog.read_snapshot(true);
  IF md5(before_snapshot::text) <> '${baselineHash}' THEN RAISE EXCEPTION 'Catalog changed; review a fresh baseline'; END IF;
  IF EXISTS (SELECT FROM catalog.change_event WHERE import_id='${importId}')
    OR EXISTS (SELECT FROM catalog.business_object WHERE identifier='${objectIdentifier}') THEN
    RAISE EXCEPTION 'Gebäudeeingang already exists or this batch was imported';
  END IF;
  SELECT * INTO STRICT table_row FROM catalog.data_table
    WHERE identifier='t-gwr-gebaeudeeingang' AND NOT is_archived;
  IF table_row.description_de IS DISTINCT FROM plan->'object'->>'description_de'
    OR (SELECT identifier FROM catalog.domain WHERE id=table_row.domain_id) <> 'bau'
    OR (SELECT identifier FROM catalog.system WHERE id=table_row.system_id) <> 'gwr'
    OR (SELECT count(*) FROM catalog.data_field WHERE data_table_id=table_row.id AND NOT is_archived) <> 9 THEN
    RAISE EXCEPTION 'Unexpected GWR table or domain';
  END IF;
  SELECT id INTO STRICT code_list FROM catalog.code_list WHERE identifier='r-gwr-doffadr' AND NOT is_archived;
  IF (SELECT jsonb_agg(jsonb_build_array(code,name_de) ORDER BY code) FROM catalog.code_value
      WHERE code_list_id=code_list AND NOT is_archived) IS DISTINCT FROM '[ ["0","Nein"], ["1","Ja"] ]'::jsonb THEN
    RAISE EXCEPTION 'Unexpected official-address codes';
  END IF;
  patch := plan->'object' || jsonb_build_object('domain_id',table_row.domain_id,'created_on',today,'modified_on',today,'edited_at',now_at);
  SELECT string_agg(format('%I',key),',') INTO cols FROM jsonb_object_keys(patch) key;
  EXECUTE format('INSERT INTO catalog.business_object(%s) SELECT %s FROM jsonb_populate_record(NULL::catalog.business_object,$1) RETURNING to_jsonb(business_object)',cols,cols) INTO inserted USING patch;
  object_id := (inserted->>'id')::uuid;
  created := created || jsonb_build_array(jsonb_build_object('table','business_object','row',inserted));
  INSERT INTO catalog.quality_requirement(identifier,name_de,description_de,status,rule_type,dimension,documentation_links,created_on,modified_on,edited_at)
    VALUES ('gebaeudeeingang/gwr-pflichtangabe','Pflichtangabe Gebäudeeingang (GWR)',
      'Ein Wert ist für die zugeordneten GWR-Merkmale obligatorisch. EGID bezeichnet das zugehörige Gebäude; EGID + EDID bilden die Eingangsidentität.',
      'draft','required','completeness',jsonb_build_array(plan->'object'->'documentation_links'->1),today,today,now_at)
    RETURNING id INTO rule_id;
  SELECT to_jsonb(q) INTO inserted FROM catalog.quality_requirement q WHERE id=rule_id;
  created := created || jsonb_build_array(jsonb_build_object('table','quality_requirement','row',inserted));
  FOR item IN SELECT * FROM jsonb_array_elements(plan->'attributes') LOOP
    IF item->>'sourceField' IS NOT NULL THEN
      SELECT * INTO STRICT field_row FROM catalog.data_field
        WHERE identifier=item->>'sourceField' AND data_table_id=table_row.id AND NOT is_archived;
      IF field_row.technical_name IS DISTINCT FROM item->>'code' OR field_row.name_de IS DISTINCT FROM item->'patch'->>'name_de'
        OR field_row.code_list_id IS DISTINCT FROM (CASE WHEN item->>'code'='DOFFADR' THEN code_list END) THEN
        RAISE EXCEPTION 'GWR source field changed: %',item->>'code';
      END IF;
    END IF;
    patch := item->'patch' || jsonb_build_object('business_object_id',object_id,'created_on',today,'modified_on',today,'edited_at',now_at,
      'code_list_id',CASE WHEN item->>'code'='DOFFADR' THEN code_list END);
    SELECT string_agg(format('%I',key),',') INTO cols FROM jsonb_object_keys(patch) key;
    EXECUTE format('INSERT INTO catalog.business_attribute(%s) SELECT %s FROM jsonb_populate_record(NULL::catalog.business_attribute,$1) RETURNING to_jsonb(business_attribute)',cols,cols) INTO inserted USING patch;
    attribute_id := (inserted->>'id')::uuid;
    IF (item->>'required')::boolean THEN
      INSERT INTO catalog.business_attribute_quality_requirement VALUES(attribute_id,rule_id);
    END IF;
    inserted := inserted || jsonb_build_object('quality_requirement_ids',CASE WHEN (item->>'required')::boolean THEN jsonb_build_array(rule_id) ELSE '[]'::jsonb END);
    created := created || jsonb_build_array(jsonb_build_object('table','business_attribute','row',inserted));
    IF item->>'sourceField' IS NOT NULL THEN
      INSERT INTO catalog.relationship(identifier,source_data_field_id,target_business_attribute_id,relationship_type,verification_status,coverage,rule_notes_de,documentation_links,created_on,modified_on,edited_at)
        VALUES ('gwr-entrance/represents-' || lower(item->>'code'),field_row.id,attribute_id,'represents','confirmed','full',
          'Fachliches Attribut unmittelbar aus dem gleichnamigen GWR-Merkmal abgeleitet; Quellcode, Definition und Codierung geprüft. Aussage über Katalogmetadaten.',
          item->'patch'->'documentation_links',today,today,now_at) RETURNING id INTO relation_id;
      SELECT to_jsonb(r) INTO inserted FROM catalog.relationship r WHERE id=relation_id;
      created := created || jsonb_build_array(jsonb_build_object('table','relationship','row',inserted));
    END IF;
  END LOOP;
  INSERT INTO catalog.relationship(identifier,source_data_table_id,target_business_object_id,relationship_type,verification_status,coverage,rule_notes_de,documentation_links,created_on,modified_on,edited_at)
    VALUES ('gwr-entrance/realizes',table_row.id,object_id,'realizes','confirmed','partial',
      'Die neun dokumentierten Eingangsmerkmale sind vollständig zugeordnet. Die zusätzliche Gebäudereferenz EGID stammt aus dem Gebäudeabschnitt und ist keine der neun importierten Eingangsspalten.',
      plan->'object'->'documentation_links',today,today,now_at) RETURNING id INTO relation_id;
  SELECT to_jsonb(r) INTO inserted FROM catalog.relationship r WHERE id=relation_id;
  created := created || jsonb_build_array(jsonb_build_object('table','relationship','row',inserted));
  FOR event IN SELECT value->>'table' AS tab,value->'row' AS row FROM jsonb_array_elements(created) LOOP
    EXECUTE format('INSERT INTO catalog.change_event(identifier,%I,occurred_on,occurred_at,action,actor_name_de,summary_de,after,import_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)','record_' || event.tab || '_id')
      USING '${importId}/' || (event.row->>'id'),(event.row->>'id')::uuid,today,now_at,'imported','Codex (MCP-Import)',
        'Geschäftsobjekt Gebäudeeingang aus bereitgestelltem GWR-Merkmalskatalog 5.0.0 ergänzt: ' || coalesce(event.row->>'name_de',event.row->>'identifier'),event.row,'${importId}';
  END LOOP;
  after_snapshot := catalog.read_snapshot(true);
  FOR pair IN SELECT * FROM jsonb_each(before_snapshot) LOOP
    IF pair.key NOT IN ('business_object','business_attribute','quality_requirement','business_attribute_quality_requirement','relationship','change_event') THEN
      IF pair.value IS DISTINCT FROM after_snapshot->pair.key THEN RAISE EXCEPTION 'Unrelated collection changed: %',pair.key; END IF;
    ELSIF EXISTS(SELECT FROM jsonb_array_elements(pair.value) b WHERE NOT EXISTS(
      SELECT FROM jsonb_array_elements(after_snapshot->pair.key) a WHERE a=b)) THEN
      RAISE EXCEPTION 'An existing record changed: %',pair.key;
    END IF;
  END LOOP;
  IF jsonb_array_length(created) <> 22
    OR (SELECT count(*) FROM catalog.business_attribute WHERE business_object_id=object_id) <> 10
    OR (SELECT count(*) FROM catalog.business_attribute_quality_requirement WHERE quality_requirement_id=rule_id) <> 7
    OR (SELECT count(*) FROM catalog.change_event WHERE import_id='${importId}') <> 22 THEN
    RAISE EXCEPTION 'Unexpected import counts';
  END IF;
  report := jsonb_build_object('import_id','${importId}','source_sha256',plan->>'source_sha256','object_identifier','${objectIdentifier}',
    'attributes',10,'source_field_mappings',9,'table_mappings',1,'required_attributes',7,'new_history_events',22,
    'baseline_hash','${baselineHash}','result_hash',md5(after_snapshot::text));
  PERFORM set_config('catalog.gwr_entrance_result',report::text,true);
END;
$entrance_import$;
SELECT current_setting('catalog.gwr_entrance_result')::jsonb AS verification;
${commit ? 'COMMIT' : 'ROLLBACK'};
`;
}

module.exports = { inventory, sqlFor, source, importId, objectIdentifier };
if (require.main === module) {
  const [baselineHash, mode, output] = process.argv.slice(2);
  if (!['preview', 'commit'].includes(mode) || !output) throw Error('Usage: node scripts/gwr-entrance-import.cjs BASELINE_HASH preview|commit OUTPUT.sql');
  fs.writeFileSync(path.resolve(output), sqlFor({ baselineHash, commit: mode === 'commit' }));
  console.log('Prepared ' + mode + ': ' + path.resolve(output));
}
