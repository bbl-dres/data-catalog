-- Technische Anlage nach eBKP-H: the business object is a general building system
-- (Elektro, Gebäudeautomation, Sicherheit, Brandschutz, Wärme, Kälte, Luft, Wasser,
-- Abwasser, Gas, Spezialmedien, Beförderung), not only HLK. Description and comment
-- follow eBKP-H Hauptgruppe D (Technik Gebäude); eBKP-H joins the normative references.
-- Evidence: docs/sources/ebkp-h/2026-09-07-ebkph-technik-gebaeude.json.
-- Standalone content update AFTER cafm-basisplan-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 1 record change: one business-object update; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result table.
-- Repeating identical applied content is a no-op; different content is refused.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $ebkph$
DECLARE
  operation_id constant text := 'technische-anlage-ebkph-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "eBKP-H (SN 506 511), Hauptgruppe D Technik Gebäude; Präzisierung 7. September 2026",
  "requiresOperation": "cafm-basisplan-20260907-v1",
  "expectedChanges": 1,
  "object": {
    "id": "technische-anlage",
    "revision": 2,
    "before": {
      "description_de": "HLK Gebäudetechnische Anlage (Heizung, Klima, Lüftung)",
      "comment": "Gruppe: Technische Objekte; Priorität: Muss\nPrimäre Identifikation: Anlage-ID\nIst ein Typ von System (Ausprägung). Die zwölf Spezialisierungen (Heizungs-, Lüftungs-, Kälte-, Elektro-, Beleuchtungs-, Sanitär-, Aufzugs-, Brandschutz-, Sicherheits-, Kommunikations-, Gebäudeautomations- und Energieerzeugungsanlage) mit typspezifischen IFC-/eBKP-H-Attributen bleiben spätere Typprofil-Arbeit. Bewirtschaftungsprozesse wie Instandhaltung und Wartung gehören zum Objektmanagement.",
      "normative_references": ["SIA", "GEFMA"]
    },
    "after": {
      "description": "Gebäudetechnische Anlage als System des Gebäudes, z. B. Elektro, Gebäudeautomation, Sicherheit, Wärme, Kälte, Luft, Wasser oder Beförderung",
      "comment": "Gruppe: Technische Objekte; Priorität: Muss\nPrimäre Identifikation: Anlage-ID\nIst ein Typ von System (Ausprägung). Anlagearten nach eBKP-H Hauptgruppe D (Technik Gebäude): Elektroanlage, Gebäudeautomation, Sicherheitsanlage, Technische Brandschutzanlage, Wärme-, Kälte-, Luft-, Wasser-, Abwasser- und Gastechnische Anlage, Anlage für Spezialmedien sowie Beförderungsanlage; typspezifische Attribute je Anlageart bleiben spätere Typprofil-Arbeit. Bewirtschaftungsprozesse wie Instandhaltung und Wartung gehören zum Objektmanagement.",
      "standards": ["eBKP-H (SN 506 511)", "SIA", "GEFMA"]
    }
  }
}
  $proposal$::jsonb;
  raw_before jsonb;
  raw_after jsonb;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete object update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Object operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Technische Anlage already broadened; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the CAFM Basisplan update first';
  END IF;

  SELECT to_jsonb(o) INTO raw_before FROM catalog.business_object o
    WHERE o.identifier = proposal->'object'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'object'->>'revision')::bigint
    OR NOT raw_before @> (proposal->'object'->'before')
    OR raw_before->'normative_references' <> proposal->'object'->'before'->'normative_references' THEN
    RAISE EXCEPTION 'Stale object baseline; review intervening changes';
  END IF;
  record_uuid := (raw_before->>'id')::uuid;

  UPDATE catalog.business_object AS o
    SET description_de = proposal->'object'->'after'->>'description',
      comment = proposal->'object'->'after'->>'comment',
      normative_references = ARRAY(SELECT jsonb_array_elements_text(proposal->'object'->'after'->'standards')),
      modified_on = edited_on
    WHERE o.id = record_uuid AND o.row_version = (proposal->'object'->>'revision')::bigint
    RETURNING to_jsonb(o) INTO STRICT raw_after;
  change_count := change_count + 1;

  IF raw_after->>'description_de' LIKE 'HLK%' OR raw_after->>'comment' NOT LIKE '%eBKP-H Hauptgruppe D%' THEN
    RAISE EXCEPTION 'Updated record does not match the eBKP-H proposal; rolling back';
  END IF;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$ebkph$;

-- Current record content: this query also works after COMMIT and on a repeat run.
SELECT o.identifier, o.name_de AS objekt, o.description_de, o.row_version,
  array_to_string(o.normative_references, ', ') AS standards
FROM catalog.business_object o WHERE o.identifier = 'technische-anlage';

COMMIT;
