-- Append omitted child orders consistently in browser and REST commands.
-- Existing ranks and archival positions are preserved. Apply after system_of_record.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='catalog' AND table_name='business_attribute' AND column_name='system_of_record_id') THEN
    RAISE EXCEPTION 'Apply catalog_system_of_record first' USING ERRCODE='55000';
  END IF;
END $$;

-- Both callers hold the command advisory lock before allocating a position.
CREATE FUNCTION catalog_private.next_row_order(tab text, owner_id uuid) RETURNS integer
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE owner_column text; last_order bigint;
BEGIN
  owner_column := CASE tab WHEN 'business_attribute' THEN 'business_object_id' WHEN 'data_field' THEN 'data_table_id'
    WHEN 'code_value' THEN 'code_list_id' WHEN 'product_attribute' THEN 'data_product_id' WHEN 'service_endpoint' THEN 'data_service_id' END;
  IF owner_column IS NULL OR owner_id IS NULL THEN RAISE EXCEPTION 'An owned row needs its owner' USING ERRCODE='22023'; END IF;
  EXECUTE format('SELECT coalesce(max(sort_order),0)::bigint FROM catalog.%I WHERE %I=$1',tab,owner_column) INTO last_order USING owner_id;
  IF last_order >= 2147483647 THEN RAISE EXCEPTION 'Reorder the existing rows before adding another row' USING ERRCODE='22003'; END IF;
  RETURN last_order + 1;
END $$;
REVOKE ALL ON FUNCTION catalog_private.next_row_order(text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION catalog_private.apply_entry_edit(tab text, record_id uuid, expected bigint,
  patch jsonb, owner_table text DEFAULT NULL, owner_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE old_row jsonb; new_row jsonb; values_row jsonb; cols text; assignments text;
  key text; value jsonb; allowed text[]; owner_column text; changed text[];
  rule_id uuid; old_required boolean; required_value boolean; action_name text;
  event_id uuid := gen_random_uuid(); now_at timestamptz := clock_timestamp(); event_table text; event_record uuid;
BEGIN
  allowed := catalog_private.edit_columns(tab);
  IF allowed IS NULL OR record_id IS NULL OR expected IS NULL OR expected < 0
    OR jsonb_typeof(patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid edit command' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT FROM jsonb_object_keys(patch) k WHERE NOT k = ANY(allowed)) THEN
    RAISE EXCEPTION 'This property cannot be edited' USING ERRCODE = '42501';
  END IF;
  FOR key, value IN SELECT * FROM jsonb_each(patch) LOOP
    IF value = 'null'::jsonb THEN CONTINUE; END IF;
    IF key IN ('documentation_links','normative_references','formats','key_roles','applies_to_type_names','endpoint_description_urls','authentication_methods') THEN
      IF jsonb_typeof(value) <> 'array' THEN RAISE EXCEPTION 'Expected a list' USING ERRCODE = '22023'; END IF;
    ELSIF key IN ('responsible_organisation','authority_organisation','value_specification') THEN
      IF jsonb_typeof(value) <> 'object' THEN RAISE EXCEPTION 'Expected an object' USING ERRCODE = '22023'; END IF;
    ELSIF key IN ('contains_personal_data','is_identifier','is_required','is_nullable','is_archived','required','is_read_only','supports_bulk') THEN
      IF jsonb_typeof(value) <> 'boolean' THEN RAISE EXCEPTION 'Expected a boolean' USING ERRCODE = '22023'; END IF;
    ELSIF key = 'sort_order' THEN
      IF jsonb_typeof(value) <> 'number' OR value::text !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid order' USING ERRCODE = '22023'; END IF;
    ELSE
      IF jsonb_typeof(value) <> 'string' THEN RAISE EXCEPTION 'Expected text' USING ERRCODE = '22023'; END IF;
    END IF;
  END LOOP;
  EXECUTE format('SELECT to_jsonb(r) FROM catalog.%I r WHERE id = $1 FOR UPDATE', tab) INTO old_row USING record_id;
  IF expected = 0 AND old_row IS NOT NULL OR expected > 0 AND (old_row IS NULL OR (old_row->>'row_version')::bigint <> expected) THEN
    RAISE EXCEPTION 'The entry changed; reload before editing again' USING ERRCODE = '40001';
  END IF;
  owner_column := CASE tab WHEN 'business_attribute' THEN 'business_object_id' WHEN 'data_field' THEN 'data_table_id'
    WHEN 'code_value' THEN 'code_list_id' WHEN 'product_attribute' THEN 'data_product_id' WHEN 'service_endpoint' THEN 'data_service_id' END;
  IF owner_table IS NOT NULL AND (owner_column IS NULL OR owner_column <> owner_table || '_id' OR owner_id IS NULL
    OR old_row IS NOT NULL AND old_row->>owner_column <> owner_id::text) THEN
    RAISE EXCEPTION 'Row does not belong to this entry' USING ERRCODE = '42501';
  END IF;
  IF expected = 0 AND owner_column IS NOT NULL AND owner_id IS NULL THEN
    RAISE EXCEPTION 'Create rows through their owner' USING ERRCODE = '22023';
  END IF;
  IF expected = 0 AND owner_column IS NOT NULL AND NOT patch ? 'sort_order' THEN
    patch := patch || jsonb_build_object('sort_order',catalog_private.next_row_order(tab,owner_id));
  END IF;
  -- Terminology links are intentionally outside this version's edit boundary.
  IF patch ? 'documentation_links' AND
    (SELECT coalesce(jsonb_agg(x ORDER BY x::text), '[]') FROM jsonb_array_elements(coalesce(patch->'documentation_links','[]')) x WHERE x->>'purpose' = 'terminology')
    IS DISTINCT FROM
    (SELECT coalesce(jsonb_agg(x ORDER BY x::text), '[]') FROM jsonb_array_elements(coalesce(old_row->'documentation_links','[]')) x WHERE x->>'purpose' = 'terminology') THEN
    RAISE EXCEPTION 'Terminology links are read-only' USING ERRCODE = '42501';
  END IF;
  IF tab = 'business_attribute' THEN
    SELECT EXISTS (SELECT FROM catalog.business_attribute_quality_requirement a JOIN catalog.quality_requirement q ON q.id = a.quality_requirement_id
      WHERE a.business_attribute_id = record_id AND q.rule_type = 'required' AND q.status <> 'retired') INTO old_required;
    old_row := CASE WHEN old_row IS NOT NULL THEN old_row || jsonb_build_object('required',old_required) END;
  END IF;
  SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO changed FROM jsonb_object_keys(patch) k
    WHERE old_row IS NULL OR old_row->k IS DISTINCT FROM patch->k;
  IF old_row IS NOT NULL AND cardinality(changed) = 0 THEN RETURN old_row; END IF;
  values_row := patch - 'required';
  IF expected = 0 THEN
    values_row := values_row || jsonb_build_object('id', record_id, 'identifier', 'entry-' || record_id::text,
      'created_on', (now_at AT TIME ZONE 'UTC')::date, 'modified_on', (now_at AT TIME ZONE 'UTC')::date, 'edited_at',now_at);
    IF owner_column IS NOT NULL THEN values_row := values_row || jsonb_build_object(owner_column, owner_id); END IF;
    SELECT string_agg(format('%I',k), ',') INTO cols FROM jsonb_object_keys(values_row) k;
    EXECUTE format('INSERT INTO catalog.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::catalog.%1$I,$1) RETURNING to_jsonb(%1$I.*)',tab,cols)
      INTO new_row USING values_row;
  ELSE
    values_row := values_row || jsonb_build_object('modified_on',greatest((old_row->>'created_on')::date,(now_at AT TIME ZONE 'UTC')::date), 'edited_at',now_at);
    SELECT string_agg(format('%1$I = v.%1$I',k), ',') INTO assignments FROM jsonb_object_keys(values_row) k;
    EXECUTE format('UPDATE catalog.%1$I r SET %2$s FROM jsonb_populate_record(NULL::catalog.%1$I,$1) v WHERE r.id = $2 RETURNING to_jsonb(r)',tab,assignments)
      INTO new_row USING values_row, record_id;
  END IF;
  IF tab = 'business_attribute' AND patch ? 'required' THEN
    required_value := coalesce((patch->>'required')::boolean,false);
    IF required_value AND NOT old_required THEN
      SELECT id INTO rule_id FROM catalog.quality_requirement WHERE identifier = 'catalog-editor-required';
      IF rule_id IS NULL THEN
        INSERT INTO catalog.quality_requirement(identifier,name_de,name_en,description_de,description_en,status,rule_type,dimension,created_on,modified_on)
          VALUES ('catalog-editor-required','Pflichtangabe','Required value','Ein Wert muss vorhanden sein.','A value must be provided.','valid','required','completeness',current_date,current_date) RETURNING id INTO rule_id;
      END IF;
      INSERT INTO catalog.business_attribute_quality_requirement VALUES (record_id,rule_id);
    ELSIF NOT required_value THEN
      DELETE FROM catalog.business_attribute_quality_requirement a USING catalog.quality_requirement q
        WHERE a.business_attribute_id = record_id AND a.quality_requirement_id = q.id AND q.rule_type = 'required' AND q.status <> 'retired';
    END IF;
  END IF;
  IF tab = 'business_attribute' THEN
    new_row := new_row || jsonb_build_object('required',CASE WHEN patch ? 'required' THEN coalesce(required_value,false) ELSE old_required END);
  END IF;
  action_name := CASE WHEN expected = 0 THEN 'created' WHEN patch->>'is_archived' = 'true' OR patch->>'status' = 'retired' THEN 'retired'
    WHEN old_row->>'is_archived' = 'true' AND patch->>'is_archived' = 'false' THEN 'restored' ELSE 'updated' END;
  event_table := CASE WHEN tab = 'service_endpoint' THEN 'data_service' ELSE tab END;
  event_record := CASE WHEN tab = 'service_endpoint' THEN owner_id ELSE record_id END;
  EXECUTE format('INSERT INTO catalog.change_event(id,identifier,record_%I_id,occurred_on,occurred_at,action,actor_name_de,actor_name_en,summary_de,summary_en,changed_properties,before,after)
    VALUES ($11,$1,$2,$3,$4,$5,''Katalogredaktion'',''Catalog editor'',$6,$7,$8,$9,$10)',event_table)
    USING 'edit-' || event_id::text,event_record,(now_at AT TIME ZONE 'UTC')::date,now_at,action_name,
      (CASE action_name WHEN 'created' THEN 'Eintrag erstellt' WHEN 'retired' THEN 'Eintrag archiviert' WHEN 'restored' THEN 'Eintrag wiederhergestellt' ELSE 'Eintrag bearbeitet' END) || ': ' || coalesce(new_row->>'name_de',new_row->>'name_en',new_row->>'name_fr',new_row->>'name_it',new_row->>'operation_name',new_row->>'url',new_row->>'relative_path',new_row->>'identifier'),
      (CASE action_name WHEN 'created' THEN 'Entry created' WHEN 'retired' THEN 'Entry archived' WHEN 'restored' THEN 'Entry restored' ELSE 'Entry edited' END) || ': ' || coalesce(new_row->>'name_en',new_row->>'name_de',new_row->>'name_fr',new_row->>'name_it',new_row->>'operation_name',new_row->>'url',new_row->>'relative_path',new_row->>'identifier'),
      changed,old_row,new_row,event_id;
  INSERT INTO catalog_private.edit_event_actor VALUES(event_id,auth.uid(),current_setting('catalog.edit_command')::uuid);
  RETURN new_row;
END;
$$;
REVOKE ALL ON FUNCTION catalog_private.apply_entry_edit(text,uuid,bigint,jsonb,text,uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION catalog.api_write(p_operation text, p_table text, p_id uuid,
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
ALTER FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) TO authenticated;
COMMENT ON FUNCTION catalog.api_write(text,text,uuid,bigint,jsonb,uuid) IS 'REST command boundary: permanent authenticated users, immutable identities, optimistic revisions, soft deletion, idempotency and private attribution. No direct writes or editable audit history.';
NOTIFY pgrst,'reload schema';
COMMIT;
