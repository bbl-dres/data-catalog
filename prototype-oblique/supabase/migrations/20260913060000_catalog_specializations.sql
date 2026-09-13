-- Explicit business-concept specializations; no attribute or responsibility inheritance.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(18427, 1);
ALTER TABLE catalog.relationship DROP CONSTRAINT relationship_check_6, DROP CONSTRAINT relationship_check_12,
  ADD CONSTRAINT relationship_check_6 CHECK (relationship_type IN ('realizes', 'represents', 'correspondsTo', 'exposes', 'assesses', 'basedOn', 'sourcedFrom', 'servedBy', 'measuredFor', 'specializes')),
  ADD CONSTRAINT relationship_check_12 CHECK (((relationship_type = 'realizes' AND source_data_table_id IS NOT NULL AND target_business_object_id IS NOT NULL)
      OR (relationship_type = 'represents' AND source_data_field_id IS NOT NULL AND target_business_attribute_id IS NOT NULL)
      OR (relationship_type = 'correspondsTo' AND source_data_field_id IS NOT NULL AND target_data_field_id IS NOT NULL)
      OR (relationship_type = 'exposes' AND source_data_service_id IS NOT NULL AND target_data_table_id IS NOT NULL)
      OR (relationship_type = 'exposes' AND source_data_service_id IS NOT NULL AND target_data_field_id IS NOT NULL)
      OR (relationship_type = 'assesses' AND source_data_service_id IS NOT NULL AND target_business_attribute_id IS NOT NULL)
      OR (relationship_type = 'basedOn' AND source_data_product_id IS NOT NULL AND target_business_object_id IS NOT NULL)
      OR (relationship_type = 'sourcedFrom' AND source_data_product_id IS NOT NULL AND target_data_table_id IS NOT NULL)
      OR (relationship_type = 'servedBy' AND source_data_product_id IS NOT NULL AND target_data_service_id IS NOT NULL)
      OR (relationship_type IN ('measuredFor', 'specializes') AND source_business_object_id IS NOT NULL AND target_business_object_id IS NOT NULL)));
CREATE UNIQUE INDEX relationship_specializes_uq ON catalog.relationship(source_business_object_id, target_business_object_id) WHERE relationship_type = 'specializes';

CREATE FUNCTION catalog_private.guard_specialization()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.relationship_type <> 'specializes' OR NEW.is_archived OR NEW.verification_status NOT IN ('candidate','confirmed') THEN RETURN NEW; END IF;
  -- All catalog writes already share this transaction lock; also document the graph guard's contract.
  PERFORM pg_advisory_xact_lock(18427, 1);
  IF EXISTS (
    WITH RECURSIVE ancestors(id) AS (
      SELECT NEW.target_business_object_id
      UNION
      SELECT r.target_business_object_id FROM catalog.relationship r JOIN ancestors a ON r.source_business_object_id = a.id
      WHERE r.relationship_type = 'specializes' AND NOT r.is_archived AND r.verification_status IN ('candidate','confirmed') AND r.id <> NEW.id
    ) SELECT FROM ancestors WHERE id = NEW.source_business_object_id
  ) THEN RAISE EXCEPTION 'Business-object specialization would form a cycle' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION catalog_private.guard_specialization() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER c_guard_specialization BEFORE INSERT OR UPDATE ON catalog.relationship
  FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_specialization();
NOTIFY pgrst, 'reload schema';
COMMIT;
