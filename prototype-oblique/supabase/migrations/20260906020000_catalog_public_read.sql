-- Current catalog metadata is approved for public reading. Writes remain restricted.
BEGIN;

CREATE TABLE catalog_private.import_batch (
  identifier text PRIMARY KEY,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE catalog_private.import_batch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON catalog_private.import_batch FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA catalog TO anon, authenticated;
DO $public_read$
DECLARE table_name text;
BEGIN
  IF to_regclass('catalog_private.user_access') IS NULL THEN
    RAISE EXCEPTION 'Apply the schema and member RLS migrations first';
  END IF;
  FOREACH table_name IN ARRAY ARRAY[
    'actor', 'domain', 'system', 'business_object', 'code_list', 'code_value',
    'quality_requirement', 'business_attribute', 'data_table', 'data_field',
    'data_product', 'product_attribute', 'data_service', 'relationship',
    'lineage_relation', 'change_event', 'service_endpoint',
    'business_attribute_quality_requirement', 'data_field_quality_requirement'
  ] LOOP
    EXECUTE format('ALTER TABLE catalog.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON catalog.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT ON catalog.%I TO anon, authenticated', table_name);
    EXECUTE format('DROP POLICY catalog_member_read ON catalog.%I', table_name);
    EXECUTE format('CREATE POLICY catalog_public_read ON catalog.%I FOR SELECT TO anon, authenticated USING (true)', table_name);
  END LOOP;
END;
$public_read$;

-- A single statement gives the prototype a consistent snapshot without REST row limits.
-- No stored JSON mirror: every collection is projected from the normalized tables.
CREATE FUNCTION catalog.read_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $snapshot$
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'actor', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.actor r),
  'domain', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.domain r),
  'system', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.system r),
  'business_object', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.business_object r),
  'code_list', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.code_list r),
  'code_value', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.code_value r),
  'quality_requirement', (SELECT coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('comparison_value', r.comparison_value::text) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.quality_requirement r),
  'business_attribute', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.business_attribute r),
  'data_table', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.data_table r),
  'data_field', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.data_field r),
  'data_product', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.data_product r),
  'product_attribute', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.product_attribute r),
  'data_service', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.data_service r),
  'relationship', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.relationship r),
  'lineage_relation', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier), '[]'::jsonb) FROM catalog.lineage_relation r),
  'change_event', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.occurred_on, r.identifier), '[]'::jsonb) FROM catalog.change_event r),
  'service_endpoint', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.identifier, r.id), '[]'::jsonb) FROM catalog.service_endpoint r),
  'business_attribute_quality_requirement', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.business_attribute_id, r.quality_requirement_id), '[]'::jsonb) FROM catalog.business_attribute_quality_requirement r),
  'data_field_quality_requirement', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.data_field_id, r.quality_requirement_id), '[]'::jsonb) FROM catalog.data_field_quality_requirement r)
);
$snapshot$;
REVOKE ALL ON FUNCTION catalog.read_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.read_snapshot() TO anon, authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
