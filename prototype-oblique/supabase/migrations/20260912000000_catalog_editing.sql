-- Run as postgres after the existing catalog migrations. All permanent signed-in
-- accounts may use this command API. Disable public signup in Supabase Auth.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['domain','system','business_object','business_attribute','data_table','data_field','code_list','code_value','data_product','product_attribute','data_service'] LOOP
    EXECUTE format('ALTER TABLE catalog.%I ADD COLUMN edited_at timestamptz', tab);
  END LOOP;
  FOREACH tab IN ARRAY ARRAY['business_attribute','data_field','code_value','product_attribute','service_endpoint'] LOOP
    EXECUTE format('ALTER TABLE catalog.%I ADD COLUMN sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0), ADD COLUMN is_archived boolean NOT NULL DEFAULT false', tab);
  END LOOP;
END;
$$;
ALTER TABLE catalog.service_endpoint ADD COLUMN row_version catalog_private.safe_integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  ADD COLUMN created_on date, ADD COLUMN modified_on date, ADD COLUMN edited_at timestamptz;
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.service_endpoint
  FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();

-- Durable idempotency and attribution are private, not part of public history.
CREATE TABLE catalog_private.edit_receipt (
  command_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  request jsonb NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE catalog_private.edit_receipt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catalog_private.edit_receipt FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE catalog_private.edit_event_actor (
  event_id uuid PRIMARY KEY REFERENCES catalog.change_event(id),
  user_id uuid NOT NULL,
  command_id uuid NOT NULL
);
ALTER TABLE catalog_private.edit_event_actor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catalog_private.edit_event_actor FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION catalog_private.edit_columns(tab text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
SELECT CASE WHEN tab = 'service_endpoint' THEN ARRAY['url','relative_path','protocol','http_method','operation_name','environment','is_read_only','supports_bulk','authentication_methods','sort_order','is_archived']
 WHEN tab IN ('domain','system','business_object','business_attribute','data_table','data_field','code_list','code_value','data_product','product_attribute','data_service') THEN
 ARRAY['name_de','name_fr','name_it','name_en','description_de','description_fr','description_it','description_en','comment','documentation_links'] ||
 CASE WHEN tab NOT IN ('code_value','product_attribute') THEN ARRAY['status','version','version_date'] ELSE '{}'::text[] END ||
 CASE WHEN tab IN ('domain','system','business_object','business_attribute','data_table','data_field','data_product','data_service') THEN ARRAY['responsible_organisation','data_owner_id','data_steward_id','contact_actor_id'] ELSE '{}'::text[] END ||
 CASE WHEN tab IN ('system','data_table','data_field','data_service') THEN ARRAY['data_custodian_id'] ELSE '{}'::text[] END ||
 CASE WHEN tab IN ('system','business_object','business_attribute','data_table','data_field','data_product','data_service') THEN ARRAY['classification','contains_personal_data'] ELSE '{}'::text[] END ||
 CASE WHEN tab IN ('business_attribute','data_field','code_value','product_attribute') THEN ARRAY['sort_order','is_archived'] ELSE '{}'::text[] END ||
 CASE tab
  WHEN 'domain' THEN ARRAY['parent_domain_id']
  WHEN 'system' THEN ARRAY['system_type','technology']
  WHEN 'business_object' THEN ARRAY['domain_id','normative_references']
  WHEN 'business_attribute' THEN ARRAY['semantic_name','value_specification','is_identifier','code_list_id','required']
  WHEN 'data_table' THEN ARRAY['system_id','domain_id','technical_name','database_name','schema_name']
  WHEN 'data_field' THEN ARRAY['technical_name','technical_name_kind','source_path','source_data_type','data_type_scope','is_required','is_nullable','key_roles','code_list_id','applies_to_type_names']
  WHEN 'code_list' THEN ARRAY['domain_id','authority_organisation','normative_references']
  WHEN 'code_value' THEN ARRAY['code','short_name_de','short_name_fr','short_name_it','short_name_en']
  WHEN 'data_product' THEN ARRAY['domain_id','access_mode','access_notes','landing_page_url','formats','license_uri','license_notes','update_frequency']
  WHEN 'product_attribute' THEN ARRAY['semantic_name','value_specification','is_required']
  WHEN 'data_service' THEN ARRAY['domain_id','system_id','technical_name','service_version','purpose','access_mode','access_notes','endpoint_description_urls']
 END
END;
$$;
REVOKE ALL ON FUNCTION catalog_private.edit_columns(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION catalog.edit_capabilities() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('version', 1, 'can_edit',
    auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false') = 'false');
$$;
REVOKE ALL ON FUNCTION catalog.edit_capabilities() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION catalog.edit_capabilities() TO authenticated;

-- Private helper. Table/column names are checked before any dynamic SQL.
CREATE FUNCTION catalog_private.apply_entry_edit(tab text, record_id uuid, expected bigint,
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

CREATE FUNCTION catalog.save_entry(p_command_id uuid, p_table text, p_id uuid, p_expected_version bigint,
  p_patch jsonb, p_children jsonb DEFAULT '[]') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_body jsonb; receipt catalog_private.edit_receipt; root_row jsonb; child jsonb;
  child_table text; child_result jsonb; children_changed boolean := false; saved jsonb; identifiers uuid[] := '{}'; now_at timestamptz := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' THEN
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
ALTER FUNCTION catalog.save_entry(uuid,text,uuid,bigint,jsonb,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION catalog.save_entry(uuid,text,uuid,bigint,jsonb,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION catalog.save_entry(uuid,text,uuid,bigint,jsonb,jsonb) TO authenticated;
COMMENT ON FUNCTION catalog.save_entry(uuid,text,uuid,bigint,jsonb,jsonb) IS 'Atomic, revision-checked catalog editing for permanent signed-in users. No direct writes, relationship editing or caller-supplied audit identity.';
NOTIFY pgrst, 'reload schema';
COMMIT;
