BEGIN;

-- Infrastructure, not a catalog record: only the existing write trigger advances it.
CREATE TABLE catalog.catalog_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);
INSERT INTO catalog.catalog_state DEFAULT VALUES;
ALTER TABLE catalog.catalog_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catalog.catalog_state FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON catalog.catalog_state TO anon, authenticated, service_role;
CREATE POLICY public_read ON catalog.catalog_state FOR SELECT TO anon, authenticated, service_role USING (true);
COMMENT ON TABLE catalog.catalog_state IS 'Singleton catalog revision. Public read access; maintained transactionally by catalog write triggers.';
COMMENT ON COLUMN catalog.catalog_state.singleton IS 'Singleton. Always true; primary key and CHECK permit at most one row. The migration creates it. Alias (DE): Einzelzeile. Canonical: CatalogState.singleton.';
COMMENT ON COLUMN catalog.catalog_state.version IS 'Version. Positive transactional revision, advanced by catalog writes. Not a source edition or authored record version. Alias (DE): Version. Canonical: CatalogState.version.';

CREATE OR REPLACE FUNCTION catalog_private.serialize_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF current_setting('transaction_isolation') = 'repeatable read' THEN
    RAISE EXCEPTION 'Catalog writes require READ COMMITTED or SERIALIZABLE' USING ERRCODE = '25000';
  END IF;
  PERFORM pg_advisory_xact_lock(18427, 1);
  UPDATE catalog.catalog_state SET version = version + 1 WHERE singleton;
  RETURN NULL;
END;
$$;

CREATE FUNCTION catalog.read_catalog_index(if_version text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v text; result jsonb; tbl text; rows jsonb;
BEGIN
  SELECT version::text INTO v FROM catalog.catalog_state WHERE singleton;
  IF v IS NOT NULL AND v = if_version THEN
    RETURN jsonb_build_object('schemaVersion', 1, 'catalogVersion', v, 'notModified', true);
  END IF;
  result := jsonb_build_object('schemaVersion', 1, 'catalogVersion', v, 'scope', 'index');
  FOREACH tbl IN ARRAY ARRAY['actor','domain','system','business_object','data_table','code_list',
      'data_product','data_service','service_endpoint','quality_requirement'] LOOP
    IF tbl = 'quality_requirement' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(q) || jsonb_build_object('comparison_value',q.comparison_value::text) ORDER BY q.identifier),'[]') INTO rows FROM catalog.quality_requirement q;
    ELSE
      EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), ''[]'') FROM catalog.%I r',tbl) INTO rows;
    END IF;
    result := result || jsonb_build_object(tbl, rows);
  END LOOP;
  SELECT coalesce(jsonb_agg(to_jsonb(r) - ARRAY['rule_notes_de','rule_notes_fr','rule_notes_it','rule_notes_en','documentation_links','comment'] ORDER BY r.identifier),'[]') INTO rows
    FROM catalog.relationship r WHERE r.relationship_type IN ('realizes','basedOn','sourcedFrom','servedBy','specializes','measuredFor');
  result := result || jsonb_build_object('relationship', rows);
  WITH RECURSIVE inheritance(object_id, ancestor_id) AS (
    SELECT id, id FROM catalog.business_object
    UNION
    SELECT i.object_id, r.target_business_object_id FROM inheritance i
    JOIN catalog.relationship r ON r.source_business_object_id = i.ancestor_id
    JOIN catalog.business_object child ON child.id = r.source_business_object_id
    JOIN catalog.business_object parent ON parent.id = r.target_business_object_id
    WHERE r.relationship_type = 'specializes' AND r.verification_status = 'confirmed' AND NOT r.is_archived
      AND NOT child.is_archived AND child.status <> 'retired' AND NOT parent.is_archived AND parent.status <> 'retired'
  ), counts AS (
    SELECT i.object_id AS id, count(a.id) AS n FROM inheritance i
      JOIN catalog.business_attribute a ON a.business_object_id = i.ancestor_id AND NOT a.is_archived
        AND (i.object_id = i.ancestor_id OR a.status <> 'retired') GROUP BY i.object_id
    UNION ALL SELECT coalesce(data_table_id,data_service_id),count(*) FROM catalog.data_field WHERE NOT is_archived GROUP BY 1
    UNION ALL SELECT code_list_id,count(*) FROM catalog.code_value WHERE NOT is_archived GROUP BY 1
    UNION ALL SELECT data_product_id,count(*) FROM catalog.product_attribute WHERE NOT is_archived GROUP BY 1
  ) SELECT coalesce(jsonb_object_agg(id,n),'{}') INTO rows FROM counts;
  RETURN result || jsonb_build_object('childCounts', rows);
END;
$$;

CREATE FUNCTION catalog.read_record(record_table text, record_id uuid, if_version text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v text; root jsonb; result jsonb; rows jsonb; links jsonb; lineage jsonb; tbl text;
  ancestors uuid[] := '{}'; attributes uuid[] := '{}'; fields uuid[] := '{}'; values_ids uuid[] := '{}'; products uuid[] := '{}';
  counterparts uuid[] := '{}'; touched uuid[];
BEGIN
  IF record_table IS NULL OR record_table NOT IN ('domain','system','business_object','data_table','code_list','data_product','data_service') OR record_id IS NULL THEN
    RAISE EXCEPTION 'Unsupported record owner' USING ERRCODE = '22023';
  END IF;
  SELECT version::text INTO v FROM catalog.catalog_state WHERE singleton;
  EXECUTE format('SELECT to_jsonb(r) FROM catalog.%I r WHERE id=$1',record_table) INTO root USING record_id;
  IF root IS NULL THEN RAISE EXCEPTION 'Record not found' USING ERRCODE = 'P0002'; END IF;
  IF v IS NOT NULL AND v = if_version THEN
    RETURN jsonb_build_object('schemaVersion',1,'catalogVersion',v,'notModified',true);
  END IF;
  IF record_table = 'business_object' THEN
    WITH RECURSIVE inherited(id) AS (
      SELECT record_id UNION
      SELECT r.target_business_object_id FROM inherited i
      JOIN catalog.relationship r ON r.source_business_object_id = i.id
      JOIN catalog.business_object child ON child.id = r.source_business_object_id
      JOIN catalog.business_object parent ON parent.id = r.target_business_object_id
      WHERE r.relationship_type = 'specializes' AND r.verification_status = 'confirmed' AND NOT r.is_archived
        AND NOT child.is_archived AND child.status <> 'retired' AND NOT parent.is_archived AND parent.status <> 'retired'
    ) SELECT array_agg(id) INTO ancestors FROM inherited;
    SELECT coalesce(array_agg(id),'{}') INTO attributes FROM catalog.business_attribute WHERE business_object_id = ANY(ancestors);
  ELSIF record_table IN ('data_table','data_service') THEN
    SELECT coalesce(array_agg(id),'{}') INTO fields FROM catalog.data_field
      WHERE (record_table='data_table' AND data_table_id=record_id) OR (record_table='data_service' AND data_service_id=record_id);
  ELSIF record_table = 'code_list' THEN
    SELECT coalesce(array_agg(id),'{}') INTO values_ids FROM catalog.code_value WHERE code_list_id=record_id;
  ELSIF record_table = 'data_product' THEN
    SELECT coalesce(array_agg(id),'{}') INTO products FROM catalog.product_attribute WHERE data_product_id=record_id;
  END IF;
  touched := ARRAY[record_id] || attributes || fields || values_ids || products;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]') INTO links FROM catalog.relationship r
    WHERE EXISTS (SELECT 1 FROM jsonb_each_text(to_jsonb(r)) kv
      WHERE CASE WHEN kv.key ~ '^(source|target)_.+_id$' THEN kv.value::uuid END = ANY(touched))
      OR (r.relationship_type='specializes' AND r.source_business_object_id=ANY(ancestors));
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]') INTO lineage FROM catalog.lineage_relation r
    WHERE (record_table='data_table' AND (r.source_data_table_id=record_id OR r.target_data_table_id=record_id))
      OR r.source_data_field_id=ANY(fields) OR r.target_data_field_id=ANY(fields);
  SELECT coalesce(array_agg(DISTINCT CASE WHEN kv.key ~ '^(source|target)_.+_id$' THEN kv.value::uuid END),'{}') INTO counterparts
    FROM jsonb_array_elements(links || lineage) r, LATERAL jsonb_each_text(r) kv
    WHERE kv.key ~ '^(source|target)_.+_id$' AND kv.value IS NOT NULL;
  result := jsonb_build_object('schemaVersion',1,'catalogVersion',v,'scope','record',
    'recordTable',record_table,'recordId',record_id,record_table,jsonb_build_array(root),'relationship',links,'lineage_relation',lineage);
  SELECT coalesce(jsonb_object_agg(id,business_object_id),'{}') INTO rows FROM catalog.business_attribute
    WHERE id=ANY(attributes) AND business_object_id<>record_id;
  result := result || jsonb_build_object('inheritedAttributes',rows);
  -- Parent references are already in the index. Counterpart children are only link-label projections.
  FOREACH tbl IN ARRAY ARRAY['business_attribute','data_field','code_value','product_attribute'] LOOP
    EXECUTE format($q$
      SELECT coalesce(jsonb_agg(CASE WHEN id=ANY($1) THEN to_jsonb(r) ELSE
        (SELECT jsonb_object_agg(k,value) FROM jsonb_each(to_jsonb(r)) kv(k,value)
         WHERE k IN ('id','identifier','name_de','name_fr','name_it','name_en','status','is_archived',
           'business_object_id','data_table_id','data_service_id','code_list_id','data_product_id','technical_name'))
           || '{"_counterpart":true}'::jsonb END ORDER BY r.sort_order,r.identifier,r.id),'[]')
      FROM catalog.%I r WHERE id=ANY($1) OR id=ANY($2)
        %s
    $q$,tbl, CASE WHEN record_table='code_list' AND tbl IN ('business_attribute','data_field') THEN 'OR code_list_id=$3' ELSE '' END)
    INTO rows USING CASE tbl WHEN 'business_attribute' THEN attributes WHEN 'data_field' THEN fields WHEN 'code_value' THEN values_ids ELSE products END,counterparts,record_id;
    result := result || jsonb_build_object(tbl,rows);
  END LOOP;
  SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO rows FROM catalog.business_attribute_quality_requirement r WHERE business_attribute_id=ANY(attributes);
  result := result || jsonb_build_object('business_attribute_quality_requirement',rows);
  SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO rows FROM catalog.data_field_quality_requirement r WHERE data_field_id=ANY(fields);
  result := result || jsonb_build_object('data_field_quality_requirement',rows);
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY sort_order,identifier,id),'[]') INTO rows FROM catalog.service_endpoint r WHERE record_table='data_service' AND data_service_id=record_id;
  RETURN result || jsonb_build_object('service_endpoint',rows);
END;
$$;

REVOKE ALL ON FUNCTION catalog.read_catalog_index(text), catalog.read_record(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.read_catalog_index(text), catalog.read_record(text,uuid,text) TO anon, authenticated, service_role;
COMMENT ON FUNCTION catalog.read_catalog_index(text) IS 'Versioned parent index, structural relationships and visible child counts. if_version returns a small notModified response when unchanged.';
COMMENT ON FUNCTION catalog.read_record(text,uuid,text) IS 'Versioned owner bundle including archived owned rows, inherited attributes, relationship evidence and minimal counterpart children. Merge with the same-version catalog index.';
NOTIFY pgrst, 'reload schema';
COMMIT;
