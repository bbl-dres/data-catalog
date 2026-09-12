-- Authenticated REST commands. Apply after catalog_editing; no direct table grants.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';

DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['actor','domain','system','business_object','business_attribute','data_table','data_field','code_list','code_value','data_product','product_attribute','data_service','service_endpoint','quality_requirement','relationship','lineage_relation'] LOOP
    EXECUTE format('ALTER TABLE catalog.%I ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS edited_at timestamptz',tab);
  END LOOP;
END $$;

-- A frozen property inventory: adding a database column never silently allows API writes.
CREATE FUNCTION catalog_private.api_columns(tab text, creating boolean) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
SELECT array(SELECT k FROM unnest(CASE tab
 WHEN 'actor' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','actor_type','website_url','is_archived']
 WHEN 'domain' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','parent_domain_id','is_archived']
 WHEN 'system' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_type','technology','is_archived']
 WHEN 'business_object' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','domain_id','normative_references','is_archived']
 WHEN 'business_attribute' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','business_object_id','semantic_name','value_specification','is_identifier','code_list_id','sort_order','is_archived','quality_requirement_ids']
 WHEN 'data_table' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_id','domain_id','technical_name','database_name','schema_name','is_archived']
 WHEN 'data_field' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','data_table_id','technical_name','technical_name_kind','source_path','source_data_type','data_type_scope','is_required','is_nullable','key_roles','code_list_id','applies_to_type_names','sort_order','is_archived','quality_requirement_ids']
 WHEN 'code_list' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','domain_id','business_object_id','authority_organisation','normative_references','is_archived']
 WHEN 'code_value' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','code_list_id','code','short_name_de','short_name_it','short_name_fr','short_name_en','parent_code_value_id','sort_order','is_archived']
 WHEN 'data_product' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','domain_id','access_mode','access_notes','landing_page_url','formats','license_uri','license_notes','update_frequency','is_archived']
 WHEN 'product_attribute' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','data_product_id','semantic_name','business_attribute_id','value_specification','is_required','sort_order','is_archived']
 WHEN 'data_service' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_id','domain_id','technical_name','service_version','purpose','access_mode','access_notes','endpoint_description_urls','is_archived']
 WHEN 'service_endpoint' THEN ARRAY['id','data_service_id','identifier','url','relative_path','protocol','http_method','operation_name','environment','is_read_only','supports_bulk','authentication_methods','verification_status','sort_order','is_archived']
 WHEN 'quality_requirement' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','contact_actor_id','rule_type','comparison_value','dimension','is_archived']
 WHEN 'relationship' THEN ARRAY['id','identifier','source_business_object_id','source_data_product_id','source_data_table_id','source_data_field_id','source_data_service_id','target_business_object_id','target_business_attribute_id','target_data_table_id','target_data_field_id','target_data_service_id','relationship_type','comment','source_endpoint_id','verification_status','coverage','support_status','assessed_service_version','rule_notes_de','rule_notes_it','rule_notes_fr','rule_notes_en','documentation_links','is_archived']
 WHEN 'lineage_relation' THEN ARRAY['id','identifier','source_data_table_id','source_data_field_id','target_data_table_id','target_data_field_id','operation','transformation_notes_de','transformation_notes_it','transformation_notes_fr','transformation_notes_en','verification_status','documentation_links','is_archived']
 ELSE NULL::text[] END) k WHERE creating OR (k NOT IN ('id','identifier')
 AND NOT (tab='business_attribute' AND k='business_object_id')
 AND NOT (tab='data_field' AND k='data_table_id')
 AND NOT (tab='code_value' AND k='code_list_id')
 AND NOT (tab='product_attribute' AND k='data_product_id')
 AND NOT (tab='service_endpoint' AND k='data_service_id')
 AND NOT (tab IN ('relationship','lineage_relation') AND (k LIKE 'source\_%' ESCAPE '\' OR k LIKE 'target\_%' ESCAPE '\' OR k='relationship_type'))));
$$;
REVOKE ALL ON FUNCTION catalog_private.api_columns(text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION catalog.api_write(p_operation text, p_table text, p_id uuid,
  p_expected_version bigint, p_body jsonb, p_command_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE allowed text[]; body jsonb := p_body; before_row jsonb; after_row jsonb; values_row jsonb;
  receipt catalog_private.edit_receipt; request_body jsonb; record_id uuid; now_at timestamptz := clock_timestamp();
  changed text[]; col text; value jsonb; sql_type text; cols text; assignments text;
  event_id uuid := gen_random_uuid(); event_table text; event_record uuid; action_name text; record_name text;
  owner_table text; owner_id uuid; owner_col text; assignment_table text; quality_ids jsonb; old_quality_ids jsonb;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' THEN
    RAISE EXCEPTION 'A permanent app login is required' USING ERRCODE='42501';
  END IF;
  allowed := catalog_private.api_columns(p_table,p_operation='create');
  IF allowed IS NULL OR cardinality(allowed)=0 OR p_operation IS NULL OR p_operation NOT IN ('create','update','delete') OR p_command_id IS NULL
    OR jsonb_typeof(body) IS DISTINCT FROM 'object' OR octet_length(body::text)>2097152
    OR p_expected_version IS NULL OR (p_operation='create' AND (p_expected_version<>0 OR p_id IS NOT NULL))
    OR (p_operation<>'create' AND (p_id IS NULL OR p_expected_version<1)) THEN
    RAISE EXCEPTION 'Invalid API command' USING ERRCODE='22023';
  END IF;
  IF current_setting('transaction_isolation')='repeatable read' THEN RAISE EXCEPTION 'Use READ COMMITTED or SERIALIZABLE' USING ERRCODE='25000'; END IF;
  PERFORM pg_advisory_xact_lock(18427,1);
  request_body:=jsonb_build_object('api',1,'operation',p_operation,'table',p_table,'id',p_id,'revision',p_expected_version,'body',body);
  SELECT * INTO receipt FROM catalog_private.edit_receipt WHERE command_id=p_command_id;
  IF FOUND THEN
    IF receipt.user_id<>auth.uid() OR receipt.request<>request_body THEN RAISE EXCEPTION 'Idempotency key already used' USING ERRCODE='22023'; END IF;
    RETURN receipt.response;
  END IF;
  IF p_operation='delete' THEN
    IF body<>'{}'::jsonb THEN RAISE EXCEPTION 'DELETE accepts no body' USING ERRCODE='22023'; END IF;
    body:=jsonb_build_object('is_archived',true);
  END IF;
  IF EXISTS(SELECT FROM jsonb_object_keys(body) k WHERE NOT k=ANY(allowed)) THEN
    RAISE EXCEPTION 'Unknown, immutable or managed property' USING ERRCODE='42501';
  END IF;
  record_id:=CASE WHEN p_operation='create' THEN coalesce((body->>'id')::uuid,gen_random_uuid()) ELSE p_id END;
  EXECUTE format('SELECT to_jsonb(r) FROM catalog.%I r WHERE id=$1 FOR UPDATE',p_table) INTO before_row USING record_id;
  IF p_operation='create' AND before_row IS NOT NULL THEN RAISE EXCEPTION 'Record already exists' USING ERRCODE='23505'; END IF;
  IF p_operation<>'create' THEN
    IF before_row IS NULL THEN RAISE EXCEPTION 'Record not found' USING ERRCODE='P0002'; END IF;
    IF (before_row->>'row_version')::bigint<>p_expected_version THEN RAISE EXCEPTION 'Revision changed; read the current record before retrying' USING ERRCODE='40001'; END IF;
  END IF;
  -- Quality assignments are an owned collection, updated atomically on their field/attribute.
  IF p_table IN ('business_attribute','data_field') THEN
    assignment_table:=p_table || '_quality_requirement'; owner_col:=p_table || '_id';
    EXECUTE format('SELECT coalesce(jsonb_agg(quality_requirement_id ORDER BY quality_requirement_id),''[]'') FROM catalog.%I WHERE %I=$1',assignment_table,owner_col) INTO old_quality_ids USING record_id;
    IF body ? 'quality_requirement_ids' THEN
      quality_ids:=body->'quality_requirement_ids';
      IF jsonb_typeof(quality_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(quality_ids)>2000 THEN RAISE EXCEPTION 'Invalid quality requirement collection' USING ERRCODE='22023'; END IF;
      IF EXISTS(SELECT FROM jsonb_array_elements(quality_ids) v WHERE jsonb_typeof(v)<>'string') THEN RAISE EXCEPTION 'Quality IDs must be UUID strings' USING ERRCODE='22023'; END IF;
      SELECT coalesce(jsonb_agg(id ORDER BY id),'[]') INTO quality_ids FROM (SELECT DISTINCT ids.value::uuid AS id FROM jsonb_array_elements_text(quality_ids) AS ids(value)) q;
    ELSE quality_ids:=old_quality_ids; END IF;
    IF before_row IS NOT NULL THEN before_row:=before_row || jsonb_build_object('quality_requirement_ids',old_quality_ids); END IF;
  END IF;
  FOR col,value IN SELECT * FROM jsonb_each(body-'quality_requirement_ids') LOOP
    IF value='null'::jsonb THEN CONTINUE; END IF;
    SELECT coalesce(bt.typname,t.typname) INTO sql_type FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_type t ON t.oid=a.atttypid LEFT JOIN pg_catalog.pg_type bt ON bt.oid=t.typbasetype
      WHERE a.attrelid=format('catalog.%I',p_table)::regclass AND a.attname=col AND NOT a.attisdropped;
    IF (sql_type='bool' AND jsonb_typeof(value)<>'boolean') OR (sql_type IN ('int4','int8') AND (jsonb_typeof(value)<>'number' OR value::text !~ '^-?[0-9]+$'))
      OR (sql_type IN ('text','uuid','date','timestamptz') AND jsonb_typeof(value)<>'string')
      OR (sql_type='numeric' AND jsonb_typeof(value) NOT IN ('number','string'))
      OR (sql_type='_text' AND jsonb_typeof(value)<>'array') THEN RAISE EXCEPTION 'Incorrect JSON value type for %',col USING ERRCODE='22023'; END IF;
    IF sql_type='_text' AND EXISTS(SELECT FROM jsonb_array_elements(value) x WHERE jsonb_typeof(x)<>'string') THEN RAISE EXCEPTION 'Expected an array of strings' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF body ? 'quality_requirement_ids' THEN body:=jsonb_set(body,'{quality_requirement_ids}',quality_ids); END IF;
  SELECT coalesce(array_agg(k ORDER BY k),'{}') INTO changed FROM jsonb_object_keys(body) k WHERE before_row IS NULL OR before_row->k IS DISTINCT FROM body->k;
  IF before_row IS NOT NULL AND cardinality(changed)=0 THEN after_row:=before_row;
  ELSE
    values_row:=body-'quality_requirement_ids';
    IF p_operation='create' THEN
      values_row:=values_row || jsonb_build_object('id',record_id,'identifier',coalesce(body->>'identifier','entry-'||record_id::text),'created_on',(now_at AT TIME ZONE 'UTC')::date,'modified_on',(now_at AT TIME ZONE 'UTC')::date,'edited_at',now_at);
      SELECT string_agg(format('%I',k),',') INTO cols FROM jsonb_object_keys(values_row) k;
      EXECUTE format('INSERT INTO catalog.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::catalog.%1$I,$1) RETURNING to_jsonb(%1$I.*)',p_table,cols) INTO after_row USING values_row;
    ELSE
      values_row:=values_row || jsonb_build_object('modified_on',greatest((before_row->>'created_on')::date,(now_at AT TIME ZONE 'UTC')::date),'edited_at',now_at);
      SELECT string_agg(format('%1$I=v.%1$I',k),',') INTO assignments FROM jsonb_object_keys(values_row) k;
      EXECUTE format('UPDATE catalog.%1$I r SET %2$s FROM jsonb_populate_record(NULL::catalog.%1$I,$1) v WHERE r.id=$2 RETURNING to_jsonb(r)',p_table,assignments) INTO after_row USING values_row,record_id;
    END IF;
    IF assignment_table IS NOT NULL THEN
      IF body ? 'quality_requirement_ids' THEN
        EXECUTE format('DELETE FROM catalog.%I WHERE %I=$1 AND NOT (quality_requirement_id=ANY(ARRAY(SELECT value::uuid FROM jsonb_array_elements_text($2))))',assignment_table,owner_col) USING record_id,quality_ids;
        EXECUTE format('INSERT INTO catalog.%I (%I,quality_requirement_id) SELECT $1,value::uuid FROM jsonb_array_elements_text($2) ON CONFLICT DO NOTHING',assignment_table,owner_col) USING record_id,quality_ids;
      END IF;
      after_row:=after_row || jsonb_build_object('quality_requirement_ids',quality_ids);
    END IF;
    owner_table:=CASE p_table WHEN 'business_attribute' THEN 'business_object' WHEN 'data_field' THEN 'data_table' WHEN 'code_value' THEN 'code_list' WHEN 'product_attribute' THEN 'data_product' WHEN 'service_endpoint' THEN 'data_service' END;
    IF owner_table IS NOT NULL THEN
      owner_id:=(after_row->>(owner_table||'_id'))::uuid;
      EXECUTE format('UPDATE catalog.%I SET edited_at=$2,modified_on=greatest(created_on,($2 AT TIME ZONE ''UTC'')::date) WHERE id=$1',owner_table) USING owner_id,now_at;
    END IF;
    action_name:=CASE WHEN p_operation='create' THEN 'created' WHEN after_row->>'is_archived'='true' AND before_row->>'is_archived'<>'true' THEN 'retired' WHEN before_row->>'is_archived'='true' AND after_row->>'is_archived'='false' THEN 'restored' ELSE 'updated' END;
    event_table:=CASE WHEN p_table='service_endpoint' THEN 'data_service' ELSE p_table END;
    event_record:=CASE WHEN p_table='service_endpoint' THEN owner_id ELSE record_id END;
    record_name:=coalesce(after_row->>'name_en',after_row->>'name_de',after_row->>'name_fr',after_row->>'name_it',after_row->>'operation_name',after_row->>'url',after_row->>'identifier');
    EXECUTE format('INSERT INTO catalog.change_event(id,identifier,record_%I_id,occurred_on,occurred_at,action,actor_name_de,actor_name_en,summary_de,summary_en,changed_properties,before,after,import_id) VALUES($1,$2,$3,$4,$5,$6,''Katalogredaktion'',''Catalog editor'',$7,$8,$9,$10,$11,$12)',event_table)
      USING event_id,'api-'||event_id::text,event_record,(now_at AT TIME ZONE 'UTC')::date,now_at,action_name,
        (CASE action_name WHEN 'created' THEN 'Erstellt' WHEN 'retired' THEN 'Archiviert' WHEN 'restored' THEN 'Wiederhergestellt' ELSE 'Bearbeitet' END)||': '||record_name,
        initcap(action_name)||': '||record_name,changed,before_row,after_row,p_command_id::text;
    INSERT INTO catalog_private.edit_event_actor VALUES(event_id,auth.uid(),p_command_id);
  END IF;
  INSERT INTO catalog_private.edit_receipt(command_id,user_id,request,response) VALUES(p_command_id,auth.uid(),request_body,after_row);
  RETURN after_row;
END $$;
ALTER FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) TO authenticated;
COMMENT ON FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) IS 'REST command boundary: permanent authenticated users, immutable identities, optimistic revisions, soft deletion, idempotency and private attribution. No direct writes or editable audit history.';
NOTIFY pgrst,'reload schema';
COMMIT;
