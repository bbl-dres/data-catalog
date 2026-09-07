-- Run as postgres after the public-read migration. Safe to run again.
-- Global defaults must be revoked globally: a schema-local REVOKE cannot
-- cancel them. This affects future postgres-owned objects across the database,
-- not grants on existing objects. Future APIs need explicit reviewed grants.
BEGIN;

DO $$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run this migration as postgres (the catalog object owner)';
  END IF;
END;
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- Schema-local grants are additive, so clear them for both catalog schemas too.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA catalog, catalog_private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA catalog, catalog_private
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA catalog, catalog_private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
