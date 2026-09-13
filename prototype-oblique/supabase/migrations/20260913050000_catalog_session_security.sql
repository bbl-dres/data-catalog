-- Current account/session authorization for browser and REST commands.
-- No catalog rows, policies or direct table-write grants are changed.
BEGIN;
DO $$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run as postgres'; END IF;
END $$;

-- The unused public schema must not automatically publish future objects.
-- Existing objects and Supabase-managed schemas are not changed.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- Retain historical membership data, but retire its obsolete callable helper.
REVOKE ALL ON FUNCTION catalog_private.has_catalog_access(text) FROM PUBLIC, anon, authenticated, service_role;

-- Only this boolean is exposed to authenticated SQL callers. Auth rows remain
-- private. The gateway verifies the JWT signature/expiry; this check closes the
-- revocation window for catalog writes, including replayed idempotency receipts.
CREATE FUNCTION catalog_private.can_edit_catalog() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE claims jsonb := auth.jwt(); session_id uuid;
BEGIN
  IF auth.uid() IS NULL OR claims->>'role' IS DISTINCT FROM 'authenticated'
    OR claims->>'is_anonymous' IS DISTINCT FROM 'false' THEN RETURN false; END IF;
  BEGIN
    session_id := (claims->>'session_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  RETURN EXISTS (
    SELECT FROM auth.users u JOIN auth.sessions s ON s.user_id = u.id
    WHERE u.id = auth.uid() AND s.id = session_id
      AND NOT coalesce(u.is_anonymous, false) AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until <= statement_timestamp())
      AND (s.not_after IS NULL OR s.not_after > statement_timestamp())
  );
END;
$$;
REVOKE ALL ON FUNCTION catalog_private.can_edit_catalog() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION catalog_private.can_edit_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION catalog.edit_capabilities() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('version',1,'can_edit',catalog_private.can_edit_catalog(),'access_options',true);
$$;
REVOKE ALL ON FUNCTION catalog.edit_capabilities() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION catalog.edit_capabilities() TO authenticated;

CREATE OR REPLACE FUNCTION catalog.save_entry(p_command_id uuid, p_table text, p_id uuid, p_expected_version bigint,
  p_patch jsonb, p_children jsonb DEFAULT '[]') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_body jsonb; receipt catalog_private.edit_receipt; root_row jsonb; child jsonb;
  child_table text; child_result jsonb; children_changed boolean := false; saved jsonb; identifiers uuid[] := '{}'; now_at timestamptz := clock_timestamp();
BEGIN
  IF NOT catalog_private.can_edit_catalog() THEN
    RAISE EXCEPTION 'Sign in with a permanent account to edit' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_id IS NULL OR p_expected_version IS NULL OR p_expected_version < 0
    OR p_table IS NULL OR p_table NOT IN ('domain','system','business_object','business_attribute','data_table','data_field','code_list','data_product','data_service')
    OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_children) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_children) > 2000 OR octet_length(p_patch::text) + octet_length(p_children::text) > 2097152 THEN
    RAISE EXCEPTION 'Invalid edit request' USING ERRCODE = '22023';
  END IF;
  IF current_setting('transaction_isolation') = 'repeatable read' THEN RAISE EXCEPTION 'Use READ COMMITTED or SERIALIZABLE' USING ERRCODE = '25000'; END IF;
  PERFORM pg_advisory_xact_lock(18427,1);
  PERFORM set_config('catalog.edit_command',p_command_id::text,true);
  request_body := jsonb_build_object('table',p_table,'id',p_id,'expected',p_expected_version,'patch',p_patch,'children',p_children);
  SELECT * INTO receipt FROM catalog_private.edit_receipt WHERE command_id = p_command_id;
  IF FOUND THEN
    IF receipt.user_id <> auth.uid() OR receipt.request <> request_body THEN RAISE EXCEPTION 'Command ID already used' USING ERRCODE = '22023'; END IF;
    RETURN receipt.response;
  END IF;
  root_row := catalog_private.apply_entry_edit(p_table,p_id,p_expected_version,p_patch);
  child_table := CASE p_table WHEN 'business_object' THEN 'business_attribute' WHEN 'data_table' THEN 'data_field' WHEN 'code_list' THEN 'code_value' WHEN 'data_product' THEN 'product_attribute' WHEN 'data_service' THEN 'service_endpoint' END;
  IF child_table IS NULL AND jsonb_array_length(p_children) > 0 THEN RAISE EXCEPTION 'This entry has no editable rows' USING ERRCODE = '22023'; END IF;
  FOR child IN SELECT * FROM jsonb_array_elements(p_children) LOOP
    IF jsonb_typeof(child) <> 'object' OR child - ARRAY['id','expected_version','patch'] <> '{}' OR NOT child ?& ARRAY['id','expected_version','patch']
      OR (child->>'id')::uuid = ANY(identifiers) THEN RAISE EXCEPTION 'Invalid or repeated row' USING ERRCODE = '22023'; END IF;
    identifiers := array_append(identifiers,(child->>'id')::uuid);
    child_result := catalog_private.apply_entry_edit(child_table,(child->>'id')::uuid,(child->>'expected_version')::bigint,child->'patch',p_table,p_id);
    children_changed := children_changed OR (child_result->>'row_version')::bigint <> (child->>'expected_version')::bigint;
  END LOOP;
  -- Child-only changes still invalidate other drafts opened on the same profile.
  IF children_changed AND p_expected_version > 0 AND (root_row->>'row_version')::bigint = p_expected_version THEN
    EXECUTE format('UPDATE catalog.%I SET edited_at=$2, modified_on=greatest(created_on,($2 AT TIME ZONE ''UTC'')::date) WHERE id=$1 RETURNING to_jsonb(%I.*)',p_table,p_table)
      INTO root_row USING p_id,now_at;
  END IF;
  -- Editing a row's own profile also invalidates drafts opened on its owner.
  IF p_table IN ('business_attribute','data_field') AND (root_row->>'row_version')::bigint <> p_expected_version THEN
    EXECUTE format('UPDATE catalog.%I SET edited_at=$2,modified_on=greatest(created_on,($2 AT TIME ZONE ''UTC'')::date) WHERE id=$1',
      CASE p_table WHEN 'business_attribute' THEN 'business_object' ELSE 'data_table' END)
      USING (root_row->>CASE p_table WHEN 'business_attribute' THEN 'business_object_id' ELSE 'data_table_id' END)::uuid,now_at;
  END IF;
  saved := jsonb_build_object('id',p_id,'identifier',root_row->>'identifier','row_version',root_row->'row_version');
  INSERT INTO catalog_private.edit_receipt(command_id,user_id,request,response) VALUES(p_command_id,auth.uid(),request_body,saved);
  RETURN saved;
END;
$$;
REVOKE ALL ON FUNCTION catalog.save_entry(uuid,text,uuid,bigint,jsonb,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION catalog.save_entry(uuid,text,uuid,bigint,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION catalog.api_write(p_operation text, p_table text, p_id uuid,
  p_expected_version bigint, p_body jsonb, p_command_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE allowed text[]; body jsonb := p_body; before_row jsonb; after_row jsonb; values_row jsonb;
  receipt catalog_private.edit_receipt; request_body jsonb; record_id uuid; now_at timestamptz := clock_timestamp();
  changed text[]; col text; value jsonb; sql_type text; cols text; assignments text;
  event_id uuid := gen_random_uuid(); event_table text; event_record uuid; action_name text; record_name text;
  owner_table text; owner_id uuid; owner_col text; assignment_table text; quality_ids jsonb; old_quality_ids jsonb;
BEGIN
  IF NOT catalog_private.can_edit_catalog() THEN
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
  owner_table:=CASE p_table WHEN 'business_attribute' THEN 'business_object' WHEN 'data_field' THEN 'data_table' WHEN 'code_value' THEN 'code_list' WHEN 'product_attribute' THEN 'data_product' WHEN 'service_endpoint' THEN 'data_service' END;
  IF p_operation='create' AND owner_table IS NOT NULL AND NOT body ? 'sort_order' THEN
    body:=body || jsonb_build_object('sort_order',catalog_private.next_row_order(p_table,(body->>(owner_table||'_id'))::uuid));
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
REVOKE ALL ON FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
