-- Internal catalog access. Apply after 20260906000000_catalog_schema.sql as postgres.
-- Grant access to individual Supabase Auth users in catalog_private.user_access.
-- Both reader and editor can read; editing will use a separately audited command API.

BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';

-- An existing permissive policy could otherwise bypass the membership requirement.
DO $$
DECLARE expected_tables text[] := ARRAY[
  'actor', 'business_attribute', 'business_object', 'change_event', 'code_list',
  'code_value', 'data_field', 'data_product', 'data_service', 'data_table', 'domain',
  'lineage_relation', 'product_attribute', 'quality_requirement', 'relationship',
  'system', 'service_endpoint', 'business_attribute_quality_requirement',
  'data_field_quality_requirement'
];
BEGIN
  IF to_regclass('catalog.change_event') IS NULL OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Apply the catalog schema in a Supabase project before this migration';
  END IF;
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'catalog') THEN
    RAISE EXCEPTION 'Existing catalog policies found; review them before applying this initial RLS migration';
  END IF;
  IF EXISTS (
    SELECT FROM pg_class WHERE relnamespace = 'catalog'::regnamespace
      AND (relkind IN ('v', 'm', 'f', 'S') OR (relkind IN ('r', 'p') AND relname <> ALL(expected_tables)))
  ) OR EXISTS (SELECT FROM pg_proc WHERE pronamespace = 'catalog'::regnamespace) THEN
    RAISE EXCEPTION 'Additional catalog tables, views or routines found; review their access before exposing the schema';
  END IF;
END;
$$;

-- Operational access configuration, independent of the catalog Actor entity.
CREATE TABLE catalog_private.user_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_role text COLLATE "C" NOT NULL CHECK (access_role IN ('reader', 'editor'))
);
ALTER TABLE catalog_private.user_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE catalog_private.user_access FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE catalog_private.user_access IS
  'Administrator-managed catalog access. No registration trigger, email-domain rule or browser writes. Delete a row to revoke access.';
COMMENT ON COLUMN catalog_private.user_access.user_id IS
  'Supabase Auth user UUID, not a catalog Actor UUID. Authentication-provider changes must preserve or explicitly remap this identity.';
COMMENT ON COLUMN catalog_private.user_access.access_role IS
  'reader: catalog reads; editor: reads and eligibility for the future audited edit API. Neither grants direct table writes.';

CREATE FUNCTION catalog_private.has_catalog_access(required_role text DEFAULT 'reader')
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    required_role IN ('reader', 'editor')
    AND auth.uid() IS NOT NULL
    AND coalesce(auth.jwt()->>'is_anonymous', 'false') = 'false'
    AND EXISTS (
      SELECT FROM catalog_private.user_access AS access
      WHERE access.user_id = auth.uid()
        AND (required_role = 'reader' OR access.access_role = 'editor')
    ), false);
$$;
ALTER FUNCTION catalog_private.has_catalog_access(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION catalog_private.has_catalog_access(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION catalog_private.has_catalog_access(text) TO authenticated;

COMMENT ON FUNCTION catalog_private.has_catalog_access(text) IS
  'Checks only the caller identity against the private access list. Ignores user-editable metadata and rejects anonymous Auth sessions. Keep this schema unexposed.';

REVOKE ALL ON SCHEMA catalog, catalog_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA catalog, catalog_private TO authenticated;
REVOKE CREATE ON SCHEMA catalog, catalog_private FROM PUBLIC, anon, authenticated, service_role;

-- An explicit table list prevents a future table or definer view being exposed by accident.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'actor', 'business_attribute', 'business_object', 'change_event', 'code_list',
    'code_value', 'data_field', 'data_product', 'data_service', 'data_table', 'domain',
    'lineage_relation', 'product_attribute', 'quality_requirement', 'relationship',
    'system', 'service_endpoint', 'business_attribute_quality_requirement',
    'data_field_quality_requirement'
  ] LOOP
    EXECUTE format('ALTER TABLE catalog.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE catalog.%I FROM PUBLIC, anon, authenticated, service_role', table_name);
    EXECUTE format('GRANT SELECT ON TABLE catalog.%I TO authenticated, service_role', table_name);
    EXECUTE format('CREATE POLICY catalog_member_read ON catalog.%I
      FOR SELECT TO authenticated
      USING ((SELECT catalog_private.has_catalog_access(''reader'')))', table_name);
  END LOOP;
END;
$$;

-- No INSERT, UPDATE, DELETE or TRUNCATE grants; no membership-management RPC.
-- service_role retains trusted backend reads and bypasses RLS: never send it to clients.
COMMENT ON SCHEMA catalog IS
  'Internal metadata catalog. Approved permanent Auth users can read through RLS. Direct application writes are disabled.';

NOTIFY pgrst, 'reload schema';
COMMIT;
