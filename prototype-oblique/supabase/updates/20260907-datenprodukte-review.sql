-- Datenprodukte review: Bundesimmobilien (Open Data) is not published as OGD and is
-- retired (the identity guard keeps import-era records; its product attributes and
-- relationships stay, the app hides links to retired targets). Gebäudebestand Bund is
-- the SAP transaction "SAP Liegenschafteninventar" (Gebäude und Grundstücke, combined
-- from SAP sources such as RE-FX and Anlagenbuchhaltung AA; monthly from the ERP per
-- prototype-dcat/data/datasets.json) - renamed and redescribed; the GeoJSON format and
-- daily frequency belonged to the old GIS-merge description.
-- Standalone content update AFTER iso-laender-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 2 record changes: one retirement and one rename/redescription; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result table.
-- Repeating identical applied content is a no-op; stale baselines abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $produkte$
DECLARE
  operation_id constant text := 'datenprodukte-review-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Produkt-Review 7. September 2026; SAP Liegenschafteninventar gemäss prototype-dcat/data/datasets.json",
  "requiresOperation": "iso-laender-20260907-v1",
  "expectedChanges": 2,
  "retire": {
    "id": "p-opendata",
    "revision": 1,
    "before": {
      "status": "draft",
      "comment": null,
      "description_de": "Öffentliche Liste der zivilen Bundesbauten mit Standort und Hauptnutzung, publiziert auf opendata.swiss gemäss DCAT-AP CH."
    },
    "after": {
      "status": "retired",
      "comment": "Wird derzeit nicht als OGD publiziert; Katalogeintrag am 7. September 2026 archiviert.",
      "description": "Liste der zivilen Bundesbauten mit Standort und Hauptnutzung für eine mögliche Publikation auf opendata.swiss (DCAT-AP CH); derzeit nicht publiziert."
    }
  },
  "rename": {
    "id": "p-gebaeudebestand",
    "revision": 1,
    "before": {
      "name_de": "Gebäudebestand Bund",
      "description_de": "Konsolidierter Bestand aller Gebäude und Grundstücke im Eigentum des Bundes mit Adresse, GWR-Attributen und Geometrie. Zusammenführung aus SAP RE-FX und GIS IMMO.",
      "formats": ["Parquet", "CSV", "GeoJSON"],
      "update_frequency": "daily"
    },
    "after": {
      "name": "SAP Liegenschafteninventar",
      "description": "SAP-Transaktion mit dem Liegenschafteninventar des Bundes: Stammdaten aller Gebäude und Grundstücke, zusammengeführt aus mehreren SAP-Quellen wie RE-FX und Anlagenbuchhaltung (AA).",
      "formats": ["Parquet", "CSV"],
      "update_frequency": "monthly"
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
    RAISE EXCEPTION 'Run the complete product review as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Product operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Product review already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the ISO country list first';
  END IF;

  SELECT to_jsonb(p) INTO raw_before FROM catalog.data_product p
    WHERE p.identifier = proposal->'retire'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'retire'->>'revision')::bigint
    OR NOT raw_before @> (proposal->'retire'->'before') OR raw_before->>'comment' IS NOT NULL THEN
    RAISE EXCEPTION 'Stale Open-Data baseline; review intervening changes';
  END IF;
  record_uuid := (raw_before->>'id')::uuid;
  UPDATE catalog.data_product AS p
    SET status = proposal->'retire'->'after'->>'status',
      comment = proposal->'retire'->'after'->>'comment',
      description_de = proposal->'retire'->'after'->>'description',
      modified_on = edited_on
    WHERE p.id = record_uuid AND p.row_version = (proposal->'retire'->>'revision')::bigint
    RETURNING to_jsonb(p) INTO STRICT raw_before;
  change_count := change_count + 1;

  SELECT to_jsonb(p) INTO raw_before FROM catalog.data_product p
    WHERE p.identifier = proposal->'rename'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'rename'->>'revision')::bigint
    OR NOT raw_before @> (proposal->'rename'->'before')
    OR raw_before->'formats' <> proposal->'rename'->'before'->'formats' THEN
    RAISE EXCEPTION 'Stale Gebäudebestand baseline; review intervening changes';
  END IF;
  IF EXISTS (SELECT FROM catalog.data_product WHERE name_de = proposal->'rename'->'after'->>'name') THEN
    RAISE EXCEPTION 'The proposed product name already exists; refusing a duplicate label';
  END IF;
  record_uuid := (raw_before->>'id')::uuid;
  UPDATE catalog.data_product AS p
    SET name_de = proposal->'rename'->'after'->>'name',
      description_de = proposal->'rename'->'after'->>'description',
      formats = ARRAY(SELECT jsonb_array_elements_text(proposal->'rename'->'after'->'formats')),
      update_frequency = proposal->'rename'->'after'->>'update_frequency',
      modified_on = edited_on
    WHERE p.id = record_uuid AND p.row_version = (proposal->'rename'->>'revision')::bigint
    RETURNING to_jsonb(p) INTO STRICT raw_before;
  change_count := change_count + 1;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$produkte$;

-- Product state after the review: works after COMMIT and on a repeat run.
SELECT p.identifier, p.name_de, p.status, array_to_string(p.formats, ', ') AS formate,
  p.update_frequency, p.row_version
FROM catalog.data_product p ORDER BY p.identifier;

COMMIT;
