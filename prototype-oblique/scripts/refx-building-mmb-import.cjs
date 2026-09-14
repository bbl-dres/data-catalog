/* Authorized MCP administrator import; one table-level batch event, no Auth/session impersonation. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=require('../docs/sources/sap-refx/2026-09-14-building-mmb-source.json');
const matches=require('../docs/sources/sap-refx/2026-09-14-building-mmb-matches.json');
const baseline=require('../docs/sources/sap-refx/2026-09-14-building-mmb-baseline.json');
const api=require('../docs/sources/sap-refx/2026-09-14-building-api-fields.json');
const ownerId=baseline.owner.id,importId='refx-building-mmb-20260914-v1';
const apiByPath=new Map(api.fields.map(f=>[f.patch.source_path,f]));
const stableId=value=>{const b=crypto.createHash('sha256').update(importId+':'+value).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};

function inventory(){
 const used=new Set();
 const fields=source.fields.map(row=>{
  const raw=row.source,assigned=matches.assignments[row.row],candidate=matches.candidates[row.row];
  if(assigned&&candidate)throw Error('Assigned and candidate overlap');
  const hit=assigned&&apiByPath.get(assigned);if(assigned&&!hit)throw Error('Unknown API path '+assigned);
  for(const p of candidate?.paths||[])if(!apiByPath.has(p))throw Error('Unknown candidate '+p);
  const existing=hit&&hit.patch.property_group==='BUILDING'?baseline.fields.find(f=>f.technical===hit.patch.technical_name):null;
  if(existing&&used.has(existing.id))throw Error('Existing field matched twice');
  if(existing)used.add(existing.id);
  const note=[`Quelle: EFD-BBL Modelle (MMB).xlsx, AttributeApplicationClass, Zeile ${row.row}.`,
   `Modell-UUID: ${raw.UUID}. Originalname: ${raw.Name}.`,
   `Fachlicher Schlüssel (Excel): ${raw['ist fachlicher Schlüssel']}; Pflichtfeld (Excel): ${raw.Pflichtfeld}.`,
   hit?`API-Abgleich: ${assigned} (${hit.patch.name_de}). Arbeitszuordnung anhand der dokumentierten Bedeutung; keine Bestätigung einer physischen SAP-Spalte. Gruppe bezeichnet den API-Knoten.`:
   candidate?`Technische ID offen. API-Kandidaten: ${candidate.paths.join(', ')}. ${candidate.reason} Originalname als Modellattribut beibehalten.`:
   'Technische ID offen: kein belastbarer Treffer im dokumentierten Building-API-Inventar. Originalname als Modellattribut beibehalten.'
  ];
  return {id:existing?.id||stableId(raw.UUID),identifier:existing?.identifier||'t-sap-building/mmb-'+raw.UUID,
   expected_version:existing?.version||0,source_row:row.row,source_uuid:raw.UUID,
   match_status:hit?'assigned':candidate?'candidate':'unmatched',api_path:assigned||null,
   candidate_paths:candidate?.paths||[],
   patch:{name_de:raw.Name,description_de:raw['Beschreibung (MMB_MetaModel)']||raw['Beschreibung (ROOT PROFILE)']||null,
    technical_name:hit?hit.patch.technical_name:raw.Name,technical_name_kind:hit?'apiField':'modelAttribute',
    property_group:hit?hit.patch.property_group:null,source_path:assigned||null,
    source_data_type:raw.Typ||null,data_type_scope:raw.Typ?'modelDefinition':null,
    is_required:null,is_nullable:null,key_roles:null,status:'draft',is_archived:false,sort_order:(row.row-2)*10,
    comment:note.join('\n'),documentation_links:hit?hit.patch.documentation_links:[]}}
 });
 const archived=baseline.fields.filter(f=>!used.has(f.id)).map(f=>({id:f.id,identifier:f.identifier,expected_version:f.version,patch:{is_archived:true}}));
 return {import_id:importId,source_sha256:source.source_sha256,owner_id:ownerId,fields,archived,
  counts:{active:fields.length,assigned:fields.filter(f=>f.match_status==='assigned').length,
   candidate:fields.filter(f=>f.match_status==='candidate').length,unmatched:fields.filter(f=>f.match_status==='unmatched').length,
   reused:used.size,created:fields.length-used.size,archived:archived.length,
   groups:new Set(fields.map(f=>f.patch.property_group).filter(Boolean)).size}};
}

function sqlFor({baselineHash,version,commit=false}){
 if(!/^[a-f0-9]{32}$/.test(baselineHash)||!Number.isSafeInteger(version)||version<1)throw Error('Invalid baseline');
 const plan=inventory(),payload=JSON.stringify(plan);
 if(payload.includes('$mmb_payload$'))throw Error('Unsafe delimiter');
 return `BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
DO $mmb_import$
DECLARE plan jsonb:=$mmb_payload$${payload}$mmb_payload$::jsonb;
 before_snapshot jsonb; after_snapshot jsonb; parent_before jsonb; parent_after jsonb;
 old_row jsonb; new_row jsonb; item jsonb; patch jsonb; cols text; assignments text; pair record;
 now_at timestamptz:=clock_timestamp(); event_id uuid:=gen_random_uuid(); report jsonb;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Administrative MCP import requires postgres'; END IF;
 PERFORM pg_advisory_xact_lock(18427,1);
 before_snapshot:=catalog.read_snapshot(true);
 IF md5(before_snapshot::text)<>'${baselineHash}' THEN RAISE EXCEPTION 'Catalog changed; review a fresh baseline'; END IF;
 IF EXISTS(SELECT FROM catalog.change_event WHERE import_id='${importId}') THEN RAISE EXCEPTION 'Batch already imported'; END IF;
 SELECT to_jsonb(t) INTO STRICT parent_before FROM catalog.data_table t WHERE id='${ownerId}' AND identifier='t-sap-building' AND NOT is_archived FOR UPDATE;
 IF (parent_before->>'row_version')::bigint<>${version} THEN RAISE EXCEPTION 'Owner changed'; END IF;
 IF (SELECT count(*) FROM catalog.data_field WHERE data_table_id='${ownerId}')<>${baseline.fields.length} THEN RAISE EXCEPTION 'Unexpected starting inventory'; END IF;
 -- Direct administrator DML retains all database constraints and immutable-identity guards.
 -- No user tokens/sessions, grants, functions, policies, or schema are changed.
 FOR item IN SELECT * FROM jsonb_array_elements(plan->'fields') UNION ALL SELECT * FROM jsonb_array_elements(plan->'archived') LOOP
  SELECT to_jsonb(f) INTO old_row FROM catalog.data_field f WHERE id=(item->>'id')::uuid FOR UPDATE;
  IF (item->>'expected_version')::int=0 THEN
   IF old_row IS NOT NULL THEN RAISE EXCEPTION 'New identity already exists'; END IF;
   patch:=item->'patch'||jsonb_build_object('id',item->'id','identifier',item->'identifier','data_table_id','${ownerId}',
     'created_on',(now_at AT TIME ZONE 'UTC')::date,'modified_on',(now_at AT TIME ZONE 'UTC')::date,'edited_at',now_at);
   SELECT string_agg(format('%I',key),',') INTO cols FROM jsonb_object_keys(patch) key;
   EXECUTE format('INSERT INTO catalog.data_field(%s) SELECT %s FROM jsonb_populate_record(NULL::catalog.data_field,$1) RETURNING to_jsonb(data_field)',cols,cols) INTO new_row USING patch;
  ELSE
   IF old_row IS NULL OR old_row->>'data_table_id'<>'${ownerId}' OR old_row->>'identifier'<>item->>'identifier'
     OR (old_row->>'row_version')::bigint<>(item->>'expected_version')::bigint THEN RAISE EXCEPTION 'Existing field changed'; END IF;
   patch:=item->'patch'||jsonb_build_object('modified_on',(now_at AT TIME ZONE 'UTC')::date,'edited_at',now_at);
   SELECT string_agg(format('%I=p.%I',key,key),',') INTO assignments FROM jsonb_object_keys(patch) key;
   EXECUTE format('UPDATE catalog.data_field f SET %s FROM jsonb_populate_record(NULL::catalog.data_field,$1) p WHERE f.id=$2 RETURNING to_jsonb(f)',assignments)
    INTO new_row USING patch,(item->>'id')::uuid;
  END IF;
  IF NOT(new_row @> (item->'patch')) OR new_row->>'data_table_id'<>'${ownerId}' OR new_row->>'data_service_id' IS NOT NULL
    OR (new_row->>'row_version')::bigint<>(item->>'expected_version')::bigint+1 THEN RAISE EXCEPTION 'Field verification failed'; END IF;
 END LOOP;
 UPDATE catalog.data_table SET comment='Feldinventar gemäss EFD-BBL Modelle (MMB).xlsx, AttributeApplicationClass (150 Attribute). Namen und Reihenfolge aus Excel. Technische Namen vom Typ API-Feld und Gruppen sind Arbeitszuordnungen zur Building-API; physische SAP-Spalten bleiben unbestätigt. Offene Zuordnungen behalten den Excel-Namen als Modellattribut. Frühere API-Felder ausserhalb des Excel-Inventars sind archiviert.',
  modified_on=(now_at AT TIME ZONE 'UTC')::date,edited_at=now_at WHERE id='${ownerId}' RETURNING to_jsonb(data_table) INTO parent_after;
 IF (parent_after->>'row_version')::bigint<>${version+1} OR
   parent_before-ARRAY['comment','modified_on','edited_at','row_version'] IS DISTINCT FROM parent_after-ARRAY['comment','modified_on','edited_at','row_version'] THEN RAISE EXCEPTION 'Unexpected owner change'; END IF;
 -- User requested one batch event. Preserve complete before/after field inventories in this table event.
 INSERT INTO catalog.change_event(id,identifier,record_data_table_id,occurred_on,occurred_at,action,actor_name_de,summary_de,changed_properties,before,after,import_id)
 VALUES(event_id,'event-'||event_id,'${ownerId}',(now_at AT TIME ZONE 'UTC')::date,now_at,'imported','Codex (MCP-Import)',
  'Excel-Batchimport: 150 Felder als Entwurf; ${plan.counts.reused} bestehende übernommen, ${plan.counts.created} ergänzt, ${plan.counts.archived} archiviert. Namen unverändert aus Excel. ${plan.counts.assigned} API-Arbeitszuordnungen, ${plan.counts.candidate} Kandidaten, ${plan.counts.unmatched} ohne belastbaren Treffer.',
  ARRAY['fields','comment'],
  parent_before||jsonb_build_object('fields',(SELECT jsonb_agg(f ORDER BY f->>'id') FROM jsonb_array_elements(before_snapshot->'data_field') f WHERE f->>'data_table_id'='${ownerId}')),
  parent_after||jsonb_build_object('fields',(SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM catalog.data_field f WHERE data_table_id='${ownerId}')),'${importId}');
 after_snapshot:=catalog.read_snapshot(true);
 FOR pair IN SELECT * FROM jsonb_each(before_snapshot) LOOP
  IF pair.key NOT IN ('data_field','data_table','change_event') AND pair.value IS DISTINCT FROM after_snapshot->pair.key THEN RAISE EXCEPTION 'Unrelated collection changed: %',pair.key; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM jsonb_array_elements(before_snapshot->'data_field') b LEFT JOIN LATERAL
   (SELECT a FROM jsonb_array_elements(after_snapshot->'data_field') a WHERE a->>'id'=b->>'id') found ON true
   WHERE b->>'data_table_id' IS DISTINCT FROM '${ownerId}' AND b IS DISTINCT FROM found.a) THEN RAISE EXCEPTION 'Unrelated field changed'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(before_snapshot->'data_table') b LEFT JOIN LATERAL
   (SELECT a FROM jsonb_array_elements(after_snapshot->'data_table') a WHERE a->>'id'=b->>'id') found ON true
   WHERE b->>'id'<>'${ownerId}' AND b IS DISTINCT FROM found.a) THEN RAISE EXCEPTION 'Another table changed'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(before_snapshot->'change_event') b LEFT JOIN LATERAL
   (SELECT a FROM jsonb_array_elements(after_snapshot->'change_event') a WHERE a->>'id'=b->>'id') found ON true
   WHERE b IS DISTINCT FROM found.a) THEN RAISE EXCEPTION 'Previous history changed'; END IF;
 IF (SELECT count(*) FROM catalog.data_field WHERE data_table_id='${ownerId}' AND NOT is_archived)<>150
   OR (SELECT count(*) FROM catalog.data_field WHERE data_table_id='${ownerId}' AND is_archived)<>${plan.counts.archived}
   OR jsonb_array_length(after_snapshot->'data_field')<>jsonb_array_length(before_snapshot->'data_field')+${plan.counts.created}
   OR jsonb_array_length(after_snapshot->'change_event')<>jsonb_array_length(before_snapshot->'change_event')+1 THEN RAISE EXCEPTION 'Unexpected counts'; END IF;
 report:=jsonb_build_object('counts',plan->'counts','source_sha256',plan->'source_sha256','import_id','${importId}',
  'history_events_added',1,'owner_revision_before',${version},'owner_revision_after',${version+1},
  'unchanged_relationships',jsonb_array_length(before_snapshot->'relationship'),'unchanged_api_fields',(SELECT count(*) FROM catalog.data_field WHERE data_service_id IS NOT NULL),
  'baseline_hash','${baselineHash}','result_hash',md5(after_snapshot::text));
 PERFORM set_config('catalog.mmb_result',report::text,true);
END;
$mmb_import$;
SELECT current_setting('catalog.mmb_result')::jsonb AS verification;
${commit?'COMMIT':'ROLLBACK'};
`;
}

function reviewMarkdown(plan){
 const lines=['# RE-FX Gebäude: Excel import and API matching','',
  `Source: EFD-BBL Modelle (MMB).xlsx, AttributeApplicationClass!A1:AL151. SHA-256: \`${source.source_sha256}\`.`,
  '',`150 exact Excel names, all Draft, in source order. ${plan.counts.reused} existing identities reused, ${plan.counts.created} created, ${plan.counts.archived} old fields archived.`,
  `${plan.counts.assigned} API IDs assigned as working matches; ${plan.counts.candidate} candidates remain unresolved; ${plan.counts.unmatched} have no reliable match.`,
  '', 'API IDs and groups describe the documented API schema; they do not establish physical SAP columns or tables. Unresolved rows keep their exact Excel name as a modelAttribute because the existing schema requires a name. No candidate is written as an API ID. No new relations are inferred.',
  '', 'The workbook has no ALIAS column. Its ID columns are empty. Business-key flags are retained in comments, without inventing physical primary keys. Pflichtfeld n/a remains unknown. The one model type is preserved with modelDefinition scope. Source file is unchanged.',
  '', 'One table-level batch history entry contains complete before/after inventories. Existing relationships and history remain intact. No Auth identity or session is used for this administrator import.',
  '', '| Excel row | Exact field name | API working match / candidates | Result |', '| --- | --- | --- | --- |'];
 for(const f of plan.fields)lines.push(`| ${f.source_row} | ${f.patch.name_de.replaceAll('|','\\|')} | ${f.api_path||f.candidate_paths.join('; ')||'—'} | ${f.match_status} |`);
 lines.push('','## Old fields archived','',...plan.archived.map(f=>'- '+f.identifier),'');return lines.join('\n');
}
module.exports={inventory,sqlFor,ownerId,importId,source,reviewMarkdown};
if(require.main===module){
 const [mode,...args]=process.argv.slice(2),plan=inventory();
 if(mode==='plan'){
  fs.writeFileSync('docs/sources/sap-refx/2026-09-14-building-mmb-import.json',JSON.stringify(plan,null,2)+'\n');
  fs.writeFileSync('docs/review/2026-09-14-refx-building-mmb.md',reviewMarkdown(plan));console.log(JSON.stringify(plan.counts));
 }else if(['preview','commit'].includes(mode)){
  const [baselineHash,version,output]=args;if(!output)throw Error('Output SQL path required');
  fs.writeFileSync(path.resolve(output),sqlFor({baselineHash,version:Number(version),commit:mode==='commit'}));console.log('Prepared '+mode+': '+output);
 }else throw Error('Expected plan|preview|commit');
}
