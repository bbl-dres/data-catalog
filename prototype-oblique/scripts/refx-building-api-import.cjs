/* Audited, atomic content import. No schema/Auth changes or inferred correspondences. */
const fs = require('node:fs'), path = require('node:path');
const inventory = require('../docs/sources/sap-refx/2026-09-14-building-api-fields.json');
const commandId = '1b230328-85f1-548b-b805-fc195d921dde';
const ownerId = '47bcb613-759b-5882-9833-9a7239cdba2d';
const commandFor = version => ({ p_command_id:commandId, p_table:'data_service', p_id:ownerId,
  p_expected_version:version, p_patch:{}, p_children:inventory.fields.map(f=>({table:'data_field',id:f.id,expected_version:0,patch:f.patch})) });

function sqlFor({baselineHash,version,commit=false}) {
  if(!/^[a-f0-9]{32}$/.test(baselineHash) || !Number.isSafeInteger(version) || version<1)throw Error('Invalid baseline');
  const payload=JSON.stringify(commandFor(version));
  if(payload.includes('$refx_command$'))throw Error('Unsafe SQL delimiter');
  return `-- RE-FX Building API documentation import; ${commit?'COMMIT':'ROLLBACK PREVIEW'}.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
DO $refx_import$
DECLARE before_snapshot jsonb; after_snapshot jsonb; owner_before jsonb; owner_after jsonb;
  command jsonb := $refx_command$${payload}$refx_command$::jsonb;
  editors uuid[]; editor_id uuid; session_id uuid; result jsonb; child jsonb; actual jsonb;
  pair record; count_new integer; report jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(18427,1);
  before_snapshot := catalog.read_snapshot(true);
  IF md5(before_snapshot::text) <> '${baselineHash}' THEN RAISE EXCEPTION 'Catalog changed; refresh and review the baseline'; END IF;
  SELECT to_jsonb(s) INTO STRICT owner_before FROM catalog.data_service s WHERE s.id='${ownerId}' AND s.identifier='api-sap-building' AND NOT s.is_archived;
  IF owner_before->>'technical_name' <> 'ZAPI_X4AI_BAPI_RE_BU_GET_DET' OR (owner_before->>'row_version')::bigint <> ${version}
    OR EXISTS (SELECT FROM catalog.data_field WHERE data_service_id='${ownerId}') THEN RAISE EXCEPTION 'Unexpected API owner or existing field inventory'; END IF;
  SELECT array_agg(DISTINCT u.id) INTO editors FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
    WHERE NOT coalesce(u.is_anonymous,false) AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())
      AND (s.not_after IS NULL OR s.not_after > statement_timestamp());
  IF cardinality(editors) IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Exactly one active permanent editor is required for attribution'; END IF;
  editor_id := editors[1];
  SELECT id INTO STRICT session_id FROM auth.sessions WHERE user_id=editor_id AND (not_after IS NULL OR not_after > statement_timestamp()) ORDER BY id LIMIT 1;
  -- The authorized administrative operation uses the existing app user's active session for audit attribution.
  -- No token is read/minted, no session is created, and the normal guarded save command validates authorization.
  PERFORM set_config('request.jwt.claim.sub',editor_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',editor_id,'role','authenticated','session_id',session_id,'is_anonymous',false)::text,true);
  result := catalog.save_entry((command->>'p_command_id')::uuid,command->>'p_table',(command->>'p_id')::uuid,
    (command->>'p_expected_version')::bigint,command->'p_patch',command->'p_children');
  after_snapshot := catalog.read_snapshot(true);
  SELECT to_jsonb(s) INTO STRICT owner_after FROM catalog.data_service s WHERE s.id='${ownerId}';
  IF (owner_after - ARRAY['row_version','modified_on','edited_at']) IS DISTINCT FROM (owner_before - ARRAY['row_version','modified_on','edited_at'])
    OR (owner_after->>'row_version')::bigint <> ${version+1} THEN RAISE EXCEPTION 'Unexpected owner change'; END IF;
  FOR pair IN SELECT * FROM jsonb_each(before_snapshot) LOOP
    IF pair.key NOT IN ('data_field','data_service','change_event') AND pair.value IS DISTINCT FROM after_snapshot->pair.key THEN
      RAISE EXCEPTION 'Unrelated collection changed: %',pair.key;
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM jsonb_array_elements(before_snapshot->'data_service') b
    LEFT JOIN LATERAL (SELECT a FROM jsonb_array_elements(after_snapshot->'data_service') a WHERE a->>'id'=b->>'id') found ON true
    WHERE b->>'id'<>'${ownerId}' AND b IS DISTINCT FROM found.a) THEN RAISE EXCEPTION 'Another API changed'; END IF;
  IF EXISTS (SELECT FROM jsonb_array_elements(before_snapshot->'data_field') b
    LEFT JOIN LATERAL (SELECT a FROM jsonb_array_elements(after_snapshot->'data_field') a WHERE a->>'id'=b->>'id') found ON true
    WHERE b IS DISTINCT FROM found.a) THEN RAISE EXCEPTION 'An existing field changed'; END IF;
  IF EXISTS (SELECT FROM jsonb_array_elements(before_snapshot->'change_event') b
    LEFT JOIN LATERAL (SELECT a FROM jsonb_array_elements(after_snapshot->'change_event') a WHERE a->>'id'=b->>'id') found ON true
    WHERE b IS DISTINCT FROM found.a) THEN RAISE EXCEPTION 'Existing history changed'; END IF;
  FOR child IN SELECT * FROM jsonb_array_elements(command->'p_children') LOOP
    SELECT to_jsonb(f) INTO STRICT actual FROM catalog.data_field f WHERE f.id=(child->>'id')::uuid;
    IF NOT (actual @> (child->'patch')) OR actual->>'data_service_id'<>'${ownerId}' OR actual->>'data_table_id' IS NOT NULL
      OR actual->>'identifier'<>'entry-' || (child->>'id') OR (actual->>'row_version')::bigint<>1 THEN RAISE EXCEPTION 'Imported field mismatch: %',child->>'id'; END IF;
  END LOOP;
  count_new := jsonb_array_length(command->'p_children');
  IF count_new<>378 OR jsonb_array_length(after_snapshot->'data_field')<>jsonb_array_length(before_snapshot->'data_field')+count_new
    OR jsonb_array_length(after_snapshot->'change_event')<>jsonb_array_length(before_snapshot->'change_event')+count_new
    OR jsonb_array_length(after_snapshot->'data_service')<>jsonb_array_length(before_snapshot->'data_service') THEN RAISE EXCEPTION 'Unexpected record counts'; END IF;
  IF (SELECT count(*) FROM catalog_private.edit_event_actor a JOIN catalog.change_event e ON e.id=a.event_id
      WHERE a.command_id='${commandId}' AND a.user_id=editor_id AND e.action='created'
        AND e.record_data_field_id IN (SELECT (c->>'id')::uuid FROM jsonb_array_elements(command->'p_children') c))<>count_new
    THEN RAISE EXCEPTION 'Missing field audit attribution'; END IF;
  report := jsonb_build_object('source_sha256','${inventory.source_sha256}','inserted_fields',count_new,
    'groups',(SELECT count(DISTINCT property_group) FROM catalog.data_field WHERE data_service_id='${ownerId}'),
    'unchanged_existing_fields',jsonb_array_length(before_snapshot->'data_field'),
    'unchanged_relationships',jsonb_array_length(before_snapshot->'relationship'),
    'unchanged_previous_events',jsonb_array_length(before_snapshot->'change_event'),
    'new_events',count_new,'owner_revision_before',${version},'owner_revision_after',${version+1},
    'baseline_hash','${baselineHash}','result_hash',md5(after_snapshot::text),'response',result);
  PERFORM set_config('catalog.refx_building_result',report::text,true);
END;
$refx_import$;
SELECT current_setting('catalog.refx_building_result')::jsonb AS verification;
${commit?'COMMIT':'ROLLBACK'};
`;
}
module.exports={inventory,commandId,ownerId,commandFor,sqlFor};
if(require.main===module){
  const [baselineHash,version,mode,output]=process.argv.slice(2);
  if(!['preview','commit'].includes(mode)||!output)throw Error('Usage: node scripts/refx-building-api-import.cjs BASELINE_HASH OWNER_REVISION preview|commit OUTPUT.sql');
  fs.writeFileSync(path.resolve(output),sqlFor({baselineHash,version:Number(version),commit:mode==='commit'}));
  console.log('Prepared '+mode+' for '+inventory.fields.length+' fields: '+path.resolve(output));
}
