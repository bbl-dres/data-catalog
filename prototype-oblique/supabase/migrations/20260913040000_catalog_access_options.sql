-- Shared, owned access descriptions; no inferred links or DCAT publication entities.
-- Apply after catalog_required_rules as postgres. Existing records start with an empty list.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';

CREATE FUNCTION catalog_private.valid_access_options(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
DECLARE item jsonb; ids text[] := '{}';
BEGIN
  IF jsonb_typeof(value) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(value) LOOP
    IF jsonb_typeof(item) <> 'object' OR jsonb_typeof(item->'isArchived') IS DISTINCT FROM 'boolean'
      OR NOT catalog_private.valid_object(item - 'isArchived', '{
        "id":{"type":"text","required":true},
        "name_de":{"type":"text"},"name_fr":{"type":"text"},"name_it":{"type":"text"},"name_en":{"type":"text"},
        "status":{"type":"text","required":true,"enum":["draft","valid","retired"]},
        "format":{"type":"text"},"accessUrl":{"type":"url"},"downloadUrl":{"type":"url"},
        "accessNotes":{"type":"text"},"license":{"type":"text"},"comment":{"type":"text"}
      }'::jsonb)
      OR NOT item ?| ARRAY['name_de','name_fr','name_it','name_en']
      OR item->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR item->>'id' = ANY(ids) THEN RETURN false; END IF;
    IF item->>'status' = 'valid' AND NOT item ?| ARRAY['accessUrl','downloadUrl','accessNotes'] THEN RETURN false; END IF;
    ids := array_append(ids,item->>'id');
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION catalog_private.valid_access_options(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION catalog_private.retain_access_option_ids() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NOT catalog_private.valid_access_options(NEW.access_options) THEN
    RAISE EXCEPTION 'Invalid access options' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT FROM jsonb_array_elements(OLD.access_options) previous
    WHERE NOT EXISTS (SELECT FROM jsonb_array_elements(NEW.access_options) current WHERE current->>'id'=previous->>'id')) THEN
    RAISE EXCEPTION 'Archive saved access options instead of removing their identities' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION catalog_private.retain_access_option_ids() FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE catalog.data_table ADD COLUMN access_options jsonb NOT NULL DEFAULT '[]'::jsonb
  CONSTRAINT data_table_access_options_check CHECK (catalog_private.valid_access_options(access_options));
CREATE TRIGGER data_table_retain_access_options BEFORE UPDATE OF access_options ON catalog.data_table
  FOR EACH ROW EXECUTE FUNCTION catalog_private.retain_access_option_ids();
COMMENT ON COLUMN catalog.data_table.access_options IS 'Access options. Ordered, explicitly authored ways to obtain the data. Stored as an owned JSON list, initially empty. No inheritance or automatic conversion from documentation, product formats or endpoint URLs. Edits use the owner revision and history. Alias (DE): Bereitstellungsformen. Canonical: DataTable.accessOptions.';

ALTER TABLE catalog.data_product ADD COLUMN access_options jsonb NOT NULL DEFAULT '[]'::jsonb
  CONSTRAINT data_product_access_options_check CHECK (catalog_private.valid_access_options(access_options));
CREATE TRIGGER data_product_retain_access_options BEFORE UPDATE OF access_options ON catalog.data_product
  FOR EACH ROW EXECUTE FUNCTION catalog_private.retain_access_option_ids();
COMMENT ON COLUMN catalog.data_product.access_options IS 'Access options. Ordered, explicitly authored ways to obtain the data. Stored as an owned JSON list, initially empty. No inheritance or automatic conversion from documentation, product formats or endpoint URLs. Edits use the owner revision and history. Alias (DE): Bereitstellungsformen. Canonical: DataProduct.accessOptions.';

ALTER TABLE catalog.data_service ADD COLUMN access_options jsonb NOT NULL DEFAULT '[]'::jsonb
  CONSTRAINT data_service_access_options_check CHECK (catalog_private.valid_access_options(access_options));
CREATE TRIGGER data_service_retain_access_options BEFORE UPDATE OF access_options ON catalog.data_service
  FOR EACH ROW EXECUTE FUNCTION catalog_private.retain_access_option_ids();
COMMENT ON COLUMN catalog.data_service.access_options IS 'Access options. Ordered, explicitly authored ways to obtain the data. Stored as an owned JSON list, initially empty. No inheritance or automatic conversion from documentation, product formats or endpoint URLs. Edits use the owner revision and history. Alias (DE): Bereitstellungsformen. Canonical: DataService.accessOptions.';

CREATE OR REPLACE FUNCTION catalog_private.edit_columns(tab text) RETURNS text[]
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
  WHEN 'business_object' THEN ARRAY['domain_id','normative_references','system_of_record_id']
  WHEN 'business_attribute' THEN ARRAY['semantic_name','value_specification','is_identifier','code_list_id','required','system_of_record_id']
  WHEN 'data_table' THEN ARRAY['access_options','system_id','domain_id','technical_name','database_name','schema_name']
  WHEN 'data_field' THEN ARRAY['technical_name','technical_name_kind','source_path','source_data_type','data_type_scope','is_required','is_nullable','key_roles','code_list_id','applies_to_type_names']
  WHEN 'code_list' THEN ARRAY['domain_id','authority_organisation','normative_references']
  WHEN 'code_value' THEN ARRAY['code','short_name_de','short_name_fr','short_name_it','short_name_en']
  WHEN 'data_product' THEN ARRAY['access_options','domain_id','access_mode','access_notes','landing_page_url','formats','license_uri','license_notes','update_frequency']
  WHEN 'product_attribute' THEN ARRAY['semantic_name','value_specification','is_required']
  WHEN 'data_service' THEN ARRAY['access_options','domain_id','system_id','technical_name','service_version','purpose','access_mode','access_notes','endpoint_description_urls']
 END
END;
$$;
REVOKE ALL ON FUNCTION catalog_private.edit_columns (text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION catalog_private.api_columns(tab text, creating boolean) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
SELECT array(SELECT k FROM unnest(CASE tab
 WHEN 'actor' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','actor_type','website_url','is_archived']
 WHEN 'domain' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','parent_domain_id','is_archived']
 WHEN 'system' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_type','technology','is_archived']
 WHEN 'business_object' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','domain_id','normative_references','system_of_record_id','is_archived']
 WHEN 'business_attribute' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','business_object_id','semantic_name','value_specification','is_identifier','code_list_id','sort_order','system_of_record_id','is_archived','quality_requirement_ids']
 WHEN 'data_table' THEN ARRAY['access_options','id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_id','domain_id','technical_name','database_name','schema_name','is_archived']
 WHEN 'data_field' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','data_table_id','technical_name','technical_name_kind','source_path','source_data_type','data_type_scope','is_required','is_nullable','key_roles','code_list_id','applies_to_type_names','sort_order','is_archived','quality_requirement_ids']
 WHEN 'code_list' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','domain_id','business_object_id','authority_organisation','normative_references','is_archived']
 WHEN 'code_value' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','code_list_id','code','short_name_de','short_name_it','short_name_fr','short_name_en','parent_code_value_id','sort_order','is_archived']
 WHEN 'data_product' THEN ARRAY['access_options','id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','domain_id','access_mode','access_notes','landing_page_url','formats','license_uri','license_notes','update_frequency','is_archived']
 WHEN 'product_attribute' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','data_product_id','semantic_name','business_attribute_id','value_specification','is_required','sort_order','is_archived']
 WHEN 'data_service' THEN ARRAY['access_options','id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_id','domain_id','technical_name','service_version','purpose','access_mode','access_notes','endpoint_description_urls','is_archived']
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
REVOKE ALL ON FUNCTION catalog_private.api_columns (text,boolean) FROM PUBLIC,anon,authenticated,service_role;

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
    IF key IN ('access_options','documentation_links','normative_references','formats','key_roles','applies_to_type_names','endpoint_description_urls','authentication_methods') THEN
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
      WHERE a.business_attribute_id = record_id AND q.rule_type = 'required' AND q.status <> 'retired' AND NOT q.is_archived) INTO old_required;
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
      SELECT id INTO rule_id FROM catalog.quality_requirement
        WHERE (identifier = 'catalog-editor-required' OR identifier LIKE 'catalog-editor-required-%')
          AND rule_type = 'required' AND status <> 'retired' AND NOT is_archived
        ORDER BY (identifier = 'catalog-editor-required') DESC, identifier LIMIT 1;
      IF rule_id IS NULL THEN
        INSERT INTO catalog.quality_requirement(identifier,name_de,name_en,description_de,description_en,status,rule_type,dimension,created_on,modified_on)
          VALUES ('catalog-editor-required-' || gen_random_uuid()::text,'Pflichtangabe','Required value','Ein Wert muss vorhanden sein.','A value must be provided.','valid','required','completeness',current_date,current_date) RETURNING id INTO rule_id;
      END IF;
      INSERT INTO catalog.business_attribute_quality_requirement VALUES (record_id,rule_id);
    ELSIF NOT required_value THEN
      DELETE FROM catalog.business_attribute_quality_requirement a USING catalog.quality_requirement q
        WHERE a.business_attribute_id = record_id AND a.quality_requirement_id = q.id AND q.rule_type = 'required' AND q.status <> 'retired' AND NOT q.is_archived;
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
REVOKE ALL ON FUNCTION catalog_private.apply_entry_edit(text,uuid,bigint,jsonb,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION catalog.edit_capabilities() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('version',1,'can_edit',auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false')='false','access_options',true);
$$;
REVOKE ALL ON FUNCTION catalog.edit_capabilities() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION catalog.edit_capabilities() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
