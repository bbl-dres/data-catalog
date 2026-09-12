-- ISO 3166-1 Land joins the Architektonische Sicht domain (like BBL Eigentumsart):
-- the country list anchors the address attributes of Gebäude and Grundstück.
-- Standalone content update AFTER datenprodukte-review-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 1 record change: one code-list domain assignment; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result table.
-- Repeating identical applied content is a no-op; stale baselines abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $landdomain$
DECLARE
  operation_id constant text := 'iso-land-domain-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Domänenzuordnung Referenzdaten; Review 7. September 2026",
  "requiresOperation": "datenprodukte-review-20260907-v1",
  "expectedChanges": 1,
  "list": {
    "id": "r-iso-land",
    "revision": 1,
    "before": { "name_de": "ISO 3166-1 Land", "domain_id": null, "business_object_id": null },
    "assignDomain": "bau"
  }
}
  $proposal$::jsonb;
  raw_before jsonb;
  domain_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete domain assignment as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Domain operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'ISO 3166-1 Land already assigned; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the product review first';
  END IF;

  SELECT to_jsonb(l) INTO raw_before FROM catalog.code_list l WHERE l.identifier = proposal->'list'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'list'->>'revision')::bigint
    OR raw_before->>'name_de' IS DISTINCT FROM proposal->'list'->'before'->>'name_de'
    OR raw_before->>'domain_id' IS NOT NULL OR raw_before->>'business_object_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Stale country-list baseline; review intervening changes';
  END IF;
  SELECT d.id INTO STRICT domain_uuid FROM catalog.domain d WHERE d.identifier = proposal->'list'->>'assignDomain';
  UPDATE catalog.code_list AS l SET domain_id = domain_uuid, modified_on = edited_on
    WHERE l.id = (raw_before->>'id')::uuid AND l.row_version = (proposal->'list'->>'revision')::bigint
    RETURNING to_jsonb(l) INTO STRICT raw_before;
  change_count := change_count + 1;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$landdomain$;

-- Domain assignments of the two address-related lists: works after COMMIT and on a repeat run.
SELECT l.identifier, l.name_de, d.identifier AS domain, l.row_version
FROM catalog.code_list l LEFT JOIN catalog.domain d ON d.id = l.domain_id
WHERE l.identifier IN ('r-iso-land', 'profile-eigentumsart') ORDER BY l.identifier;

COMMIT;
