-- Older clients assume every field has a table owner. New clients explicitly opt in to API fields.
BEGIN;
CREATE FUNCTION catalog.read_snapshot(include_api_fields boolean) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $snapshot$
WITH visible_fields AS (
 SELECT * FROM catalog.data_field WHERE include_api_fields IS TRUE OR data_service_id IS NULL
), visible_relationships AS (
 SELECT * FROM catalog.relationship r WHERE include_api_fields IS TRUE OR NOT EXISTS (
  SELECT FROM catalog.data_field f WHERE f.data_service_id IS NOT NULL AND f.id IN (r.source_data_field_id,r.target_data_field_id))
), visible_lineage AS (
 SELECT * FROM catalog.lineage_relation r WHERE include_api_fields IS TRUE OR NOT EXISTS (
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
  WHERE include_api_fields IS TRUE OR (
   (r.record_data_field_id IS NULL OR EXISTS (SELECT FROM visible_fields f WHERE f.id=r.record_data_field_id))
   AND (r.record_relationship_id IS NULL OR EXISTS (SELECT FROM visible_relationships x WHERE x.id=r.record_relationship_id))
   AND (r.record_lineage_relation_id IS NULL OR EXISTS (SELECT FROM visible_lineage x WHERE x.id=r.record_lineage_relation_id)))),
 'service_endpoint',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier,r.id),'[]'::jsonb) FROM catalog.service_endpoint r),
 'business_attribute_quality_requirement',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.business_attribute_id,r.quality_requirement_id),'[]'::jsonb) FROM catalog.business_attribute_quality_requirement r),
 'data_field_quality_requirement',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.data_field_id,r.quality_requirement_id),'[]'::jsonb) FROM catalog.data_field_quality_requirement r
  WHERE include_api_fields IS TRUE OR EXISTS (SELECT FROM visible_fields f WHERE f.id=r.data_field_id))
);
$snapshot$;
REVOKE ALL ON FUNCTION catalog.read_snapshot(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.read_snapshot(boolean) TO anon,authenticated,service_role;
COMMENT ON FUNCTION catalog.read_snapshot(boolean) IS 'Public snapshot. Pass include_api_fields=true for independent API-owned fields and their dependent assertions/history.';

CREATE OR REPLACE FUNCTION catalog.read_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $snapshot$
SELECT catalog.read_snapshot(false);
$snapshot$;
COMMENT ON FUNCTION catalog.read_snapshot() IS 'Legacy snapshot with table-owned fields only. New clients call read_snapshot(true).';
NOTIFY pgrst,'reload schema';
COMMIT;
