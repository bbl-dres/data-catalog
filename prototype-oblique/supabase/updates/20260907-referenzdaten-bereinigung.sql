-- Referenzdaten cleanup: Eigentumsform (r-eigentum) is an empty duplicate of BBL
-- Eigentumsart (no values, no attribute/field bindings) and is retired - the identity
-- guard keeps import-era records and their four change-log events instead of deleting.
-- Kanton becomes eCH Kanton: its 26 codes were verified on 7 September 2026 against
-- cantonAbbreviationType in the eCH-0007 6.0 schema (set-identical), so the vague
-- "GWR / eCH" reference becomes eCH-0007 with the standard page linked.
-- Standalone content update AFTER iso-land-domain-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 2 record changes: one retirement and one rename with reference update; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result table.
-- Repeating identical applied content is a no-op; stale baselines abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $bereinigung$
DECLARE
  operation_id constant text := 'referenzdaten-bereinigung-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Referenzdaten-Review 7. September 2026; eCH-0007 6.0 cantonAbbreviationType geprüft",
  "requiresOperation": "iso-land-domain-20260907-v1",
  "expectedChanges": 2,
  "retire": {
    "id": "r-eigentum",
    "revision": 1,
    "before": { "name_de": "Eigentumsform", "status": "draft", "comment": null },
    "after": {
      "status": "retired",
      "comment": "Leere Liste ohne Werte und Bindungen; fachlich durch BBL Eigentumsart abgedeckt. Am 7. September 2026 archiviert."
    }
  },
  "rename": {
    "id": "r-kanton",
    "revision": 1,
    "before": { "name_de": "Kanton", "comment": null, "normative_references": ["GWR / eCH"], "documentation_links": [] },
    "expectedCodes": ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"],
    "after": {
      "name": "eCH Kanton",
      "comment": "Die 26 Kantonskürzel entsprechen cantonAbbreviationType aus eCH-0007 6.0 (geprüft am 7. September 2026).",
      "standards": ["eCH-0007"],
      "links": [
        { "url": "https://www.ech.ch/de/ech/ech-0007/6.0", "purpose": "standard", "title_de": "eCH-0007 Datenstandard Gemeinden 6.0" }
      ]
    }
  }
}
  $proposal$::jsonb;
  raw_before jsonb;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete cleanup as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Cleanup operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Referenzdaten cleanup already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the ISO-Land domain assignment first';
  END IF;

  SELECT to_jsonb(l) INTO raw_before FROM catalog.code_list l
    WHERE l.identifier = proposal->'retire'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'retire'->>'revision')::bigint
    OR NOT raw_before @> (proposal->'retire'->'before') OR raw_before->>'comment' IS NOT NULL THEN
    RAISE EXCEPTION 'Stale Eigentumsform baseline; review intervening changes';
  END IF;
  record_uuid := (raw_before->>'id')::uuid;
  IF EXISTS (SELECT FROM catalog.code_value WHERE code_list_id = record_uuid)
    OR EXISTS (SELECT FROM catalog.business_attribute WHERE code_list_id = record_uuid)
    OR EXISTS (SELECT FROM catalog.data_field WHERE code_list_id = record_uuid) THEN
    RAISE EXCEPTION 'Eigentumsform is no longer unused; review the new references';
  END IF;
  UPDATE catalog.code_list AS l
    SET status = proposal->'retire'->'after'->>'status',
      comment = proposal->'retire'->'after'->>'comment',
      modified_on = edited_on
    WHERE l.id = record_uuid AND l.row_version = (proposal->'retire'->>'revision')::bigint
    RETURNING to_jsonb(l) INTO STRICT raw_before;
  change_count := change_count + 1;

  SELECT to_jsonb(l) INTO raw_before FROM catalog.code_list l
    WHERE l.identifier = proposal->'rename'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'rename'->>'revision')::bigint
    OR NOT raw_before @> (proposal->'rename'->'before') OR raw_before->>'comment' IS NOT NULL
    OR raw_before->'normative_references' <> proposal->'rename'->'before'->'normative_references'
    OR raw_before->'documentation_links' <> proposal->'rename'->'before'->'documentation_links' THEN
    RAISE EXCEPTION 'Stale Kanton baseline; review intervening changes';
  END IF;
  record_uuid := (raw_before->>'id')::uuid;
  IF (SELECT jsonb_agg(v.code ORDER BY v.code) FROM catalog.code_value v WHERE v.code_list_id = record_uuid)
      <> proposal->'rename'->'expectedCodes' THEN
    RAISE EXCEPTION 'Kanton codes differ from the verified eCH-0007 enumeration; review the values';
  END IF;
  IF EXISTS (SELECT FROM catalog.code_list WHERE name_de = proposal->'rename'->'after'->>'name') THEN
    RAISE EXCEPTION 'The proposed name already exists; refusing a duplicate label';
  END IF;
  UPDATE catalog.code_list AS l
    SET name_de = proposal->'rename'->'after'->>'name',
      comment = proposal->'rename'->'after'->>'comment',
      normative_references = ARRAY(SELECT jsonb_array_elements_text(proposal->'rename'->'after'->'standards')),
      documentation_links = proposal->'rename'->'after'->'links',
      modified_on = edited_on
    WHERE l.id = record_uuid AND l.row_version = (proposal->'rename'->>'revision')::bigint
    RETURNING to_jsonb(l) INTO STRICT raw_before;
  change_count := change_count + 1;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$bereinigung$;

-- Cleanup result: works after COMMIT and on a repeat run.
SELECT l.identifier, l.name_de, l.status, array_to_string(l.normative_references, ', ') AS standards,
  (SELECT count(*) FROM catalog.code_value v WHERE v.code_list_id = l.id) AS werte, l.row_version
FROM catalog.code_list l WHERE l.identifier IN ('r-eigentum', 'r-kanton') ORDER BY l.identifier;

COMMIT;
