-- Archived required rules do not enforce the editor checkbox. Preserve their assignments.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';

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
REVOKE ALL ON FUNCTION catalog_private.apply_entry_edit(text,uuid,bigint,jsonb,text,uuid) FROM PUBLIC, anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
