-- Repair observed hosted ACL drift before applying pending editing migrations.
-- Target: Data Catalog / zicluerzbevodlmtbxow, verified 13 September 2026.
-- This restores the existing read-only API-role contract; it changes no rows or RLS policies.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';
DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the catalog grant repair as postgres' USING ERRCODE='42501';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='catalog' AND c.relkind='r') <> 19
    OR EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='catalog' AND c.relkind='r' AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Expected the 19 RLS-enabled catalog tables; review deployment first' USING ERRCODE='55000';
  END IF;
END;
$preflight$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA catalog FROM PUBLIC, anon, authenticated, service_role;

DO $verify$
BEGIN
  IF EXISTS (
    SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) role_name
    WHERE n.nspname='catalog' AND c.relkind='r'
      AND (NOT has_table_privilege(role_name,c.oid,'SELECT')
        OR has_table_privilege(role_name,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(role_name,c.oid,'INSERT,UPDATE,REFERENCES'))
  ) THEN
    RAISE EXCEPTION 'Catalog API roles must retain SELECT only; repair rolled back' USING ERRCODE='55000';
  END IF;
END;
$verify$;
COMMIT;
