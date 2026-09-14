-- History leaves the initial catalog load. Change events were 65% of the snapshot, and their
-- before/after states are never displayed. The app now reads the current catalog without history
-- and fetches one record's history on demand; read_snapshot(true) keeps the complete contract.
BEGIN;

-- The complete snapshot orders history by date and identifier. Without this index the sort
-- carried every before/after state through a 4 MB external merge sort on each call.
CREATE INDEX change_event_occurred_idx ON catalog.change_event (occurred_on, identifier);

-- PostgREST resolves the overload by request keys: {} keeps read_snapshot(), an include_api_fields
-- key selects this function, and include_history stays optional. SQL callers keep read_snapshot(true).
DROP FUNCTION catalog.read_snapshot(boolean);
CREATE FUNCTION catalog.read_snapshot(include_api_fields boolean, include_history boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $snapshot$
DECLARE result jsonb;
BEGIN
  IF include_api_fields THEN
    -- The app's path: no visibility filters, so every collection is one ordered scan and the
    -- plan stays cached on the pooled connection instead of being rebuilt per call.
    SELECT jsonb_build_object(
      'schemaVersion',1,
      'actor',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.actor r),
      'domain',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.domain r),
      'system',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.system r),
      'business_object',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.business_object r),
      'code_list',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.code_list r),
      'code_value',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.code_value r),
      'quality_requirement',(SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('comparison_value',r.comparison_value::text) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.quality_requirement r),
      'business_attribute',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.business_attribute r),
      'data_table',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.data_table r),
      'data_field',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.data_field r),
      'data_product',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.data_product r),
      'product_attribute',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.product_attribute r),
      'data_service',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.data_service r),
      'relationship',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.relationship r),
      'lineage_relation',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.lineage_relation r),
      'service_endpoint',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier,r.id),'[]'::jsonb) FROM catalog.service_endpoint r),
      'business_attribute_quality_requirement',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.business_attribute_id,r.quality_requirement_id),'[]'::jsonb) FROM catalog.business_attribute_quality_requirement r),
      'data_field_quality_requirement',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.data_field_id,r.quality_requirement_id),'[]'::jsonb) FROM catalog.data_field_quality_requirement r)
    ) INTO result;
    IF include_history THEN
      result := result || jsonb_build_object('change_event',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.occurred_on,r.identifier),'[]'::jsonb) FROM catalog.change_event r));
    END IF;
    RETURN result;
  END IF;
  -- Legacy inventory for older clients: table-owned fields only, with dependent assertions and history.
  WITH visible_fields AS (
    SELECT * FROM catalog.data_field WHERE data_service_id IS NULL
  ), visible_relationships AS (
    SELECT * FROM catalog.relationship r WHERE NOT EXISTS (
      SELECT FROM catalog.data_field f WHERE f.data_service_id IS NOT NULL AND f.id IN (r.source_data_field_id,r.target_data_field_id))
  ), visible_lineage AS (
    SELECT * FROM catalog.lineage_relation r WHERE NOT EXISTS (
      SELECT FROM catalog.data_field f WHERE f.data_service_id IS NOT NULL AND f.id IN (r.source_data_field_id,r.target_data_field_id))
  )
  SELECT jsonb_build_object(
    'schemaVersion',1,
    'actor',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.actor r),
    'domain',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.domain r),
    'system',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.system r),
    'business_object',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.business_object r),
    'code_list',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.code_list r),
    'code_value',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.code_value r),
    'quality_requirement',(SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('comparison_value',r.comparison_value::text) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.quality_requirement r),
    'business_attribute',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.business_attribute r),
    'data_table',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.data_table r),
    'data_field',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM visible_fields r),
    'data_product',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.data_product r),
    'product_attribute',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.product_attribute r),
    'data_service',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM catalog.data_service r),
    'relationship',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM visible_relationships r),
    'lineage_relation',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier),'[]'::jsonb) FROM visible_lineage r),
    'change_event',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.occurred_on,r.identifier),'[]'::jsonb) FROM catalog.change_event r
      WHERE (r.record_data_field_id IS NULL OR EXISTS (SELECT FROM visible_fields f WHERE f.id=r.record_data_field_id))
        AND (r.record_relationship_id IS NULL OR EXISTS (SELECT FROM visible_relationships x WHERE x.id=r.record_relationship_id))
        AND (r.record_lineage_relation_id IS NULL OR EXISTS (SELECT FROM visible_lineage x WHERE x.id=r.record_lineage_relation_id))),
    'service_endpoint',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier,r.id),'[]'::jsonb) FROM catalog.service_endpoint r),
    'business_attribute_quality_requirement',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.business_attribute_id,r.quality_requirement_id),'[]'::jsonb) FROM catalog.business_attribute_quality_requirement r),
    'data_field_quality_requirement',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.data_field_id,r.quality_requirement_id),'[]'::jsonb) FROM catalog.data_field_quality_requirement r
      WHERE EXISTS (SELECT FROM visible_fields f WHERE f.id=r.data_field_id))
  ) INTO result;
  IF NOT include_history THEN result := result - 'change_event'; END IF;
  RETURN result;
END
$snapshot$;
REVOKE ALL ON FUNCTION catalog.read_snapshot(boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.read_snapshot(boolean, boolean) TO anon, authenticated, service_role;
COMMENT ON FUNCTION catalog.read_snapshot(boolean, boolean) IS 'Catalog snapshot. include_api_fields=true adds independent API-owned fields; include_history=false omits change_event for the initial app load (read one record''s history with read_history).';

CREATE OR REPLACE FUNCTION catalog.read_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $snapshot$
SELECT catalog.read_snapshot(false, true);
$snapshot$;
COMMENT ON FUNCTION catalog.read_snapshot() IS 'Legacy complete snapshot with table-owned fields only. New clients call read_snapshot(true, false) and read_history.';

-- One record's history, including its owned attributes, fields or values, newest first.
-- Branches whose record_table test fails are skipped as one-time filters; the matching branches
-- use the partial record indexes, so cost follows the record's history rather than the table size.
CREATE FUNCTION catalog.read_history(record_table text, record_id uuid, max_events integer DEFAULT 1000) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $history$
BEGIN
  IF record_table IS NULL OR record_table NOT IN ('domain','system','business_object','data_table','code_list','data_product','data_service') THEN
    RAISE EXCEPTION 'record_table must name a history owner: domain, system, business_object, data_table, code_list, data_product or data_service' USING ERRCODE = '22023';
  END IF;
  IF record_id IS NULL THEN
    RAISE EXCEPTION 'record_id is required' USING ERRCODE = '22023';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(e) - 'before' - 'after' ORDER BY e.occurred_at DESC NULLS LAST, e.occurred_on DESC, e.identifier DESC),'[]'::jsonb)
    FROM (
      SELECT * FROM (
        SELECT e.* FROM catalog.change_event e WHERE record_table = 'domain' AND e.record_domain_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e WHERE record_table = 'system' AND e.record_system_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e WHERE record_table = 'business_object' AND e.record_business_object_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e JOIN catalog.business_attribute a ON a.id = e.record_business_attribute_id WHERE record_table = 'business_object' AND a.business_object_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e WHERE record_table = 'data_table' AND e.record_data_table_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e JOIN catalog.data_field f ON f.id = e.record_data_field_id WHERE record_table = 'data_table' AND f.data_table_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e WHERE record_table = 'data_service' AND e.record_data_service_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e JOIN catalog.data_field f ON f.id = e.record_data_field_id WHERE record_table = 'data_service' AND f.data_service_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e WHERE record_table = 'code_list' AND e.record_code_list_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e JOIN catalog.code_value v ON v.id = e.record_code_value_id WHERE record_table = 'code_list' AND v.code_list_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e WHERE record_table = 'data_product' AND e.record_data_product_id = record_id
        UNION ALL SELECT e.* FROM catalog.change_event e JOIN catalog.product_attribute p ON p.id = e.record_product_attribute_id WHERE record_table = 'data_product' AND p.data_product_id = record_id
      ) matches
      ORDER BY occurred_at DESC NULLS LAST, occurred_on DESC, identifier DESC
      LIMIT least(greatest(coalesce(max_events, 1000), 1), 5000)
    ) e
  );
END
$history$;
REVOKE ALL ON FUNCTION catalog.read_history(text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.read_history(text, uuid, integer) TO anon, authenticated, service_role;
COMMENT ON FUNCTION catalog.read_history(text, uuid, integer) IS 'History of one owning record and its owned rows, newest first, without before/after states. record_table: domain, system, business_object, data_table, code_list, data_product or data_service.';

NOTIFY pgrst, 'reload schema';
COMMIT;
