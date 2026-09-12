-- CAFM Basisplan: one additional business object in Dokumente Management. It is the
-- KBOB-IPB Anhang C document type (Dokumenttypenkatalog 2016) for the DWG floor base plan
-- used to create and mutate area plans (Flächenmanagement); one base plan per Geschoss.
-- The domain comment is updated from seven to eight objects. Zone precedent: draft status,
-- no invented governance, classification or priority. Existing content stays untouched.
-- Standalone content update AFTER dokumente-kuerzung-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 2 record changes: 1 object create and 1 domain comment update; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; identifier collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $cafm$
DECLARE
  operation_id constant text := 'cafm-basisplan-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "KBOB-IPB Anhang C – Dokumenttypenkatalog 2016; Ergänzung 7. September 2026",
  "requiresOperation": "dokumente-kuerzung-20260907-v1",
  "expectedChanges": 2,
  "domain": {
    "id": "dokumente",
    "revision": 2,
    "before": {
      "comment": "Sieben Geschäftsobjekte in vier Gruppen (Dokumentstruktur, Metadaten, Archivierung, Organisation): drei Muss (Dokument, Dossier, Archivgut), drei Soll (Dokumenttyp, Metadatensatz, Registraturplan), ein Kann (Vorarchiv). Version, Workflow, Anweisung und Nachricht wurden nach Review vom 7. September 2026 nicht übernommen; Physisches Archiv und Datei werden bewusst nicht modelliert. Attributprofile und Beziehungen (Dossier–Dokument, Verknüpfung zur Architektonischen Sicht) bleiben spätere Fachprofil-Arbeit."
    },
    "after": {
      "comment": "Acht Geschäftsobjekte in vier Gruppen (Dokumentstruktur, Metadaten, Archivierung, Organisation): drei Muss (Dokument, Dossier, Archivgut), drei Soll (Dokumenttyp, Metadatensatz, Registraturplan), ein Kann (Vorarchiv) sowie der CAFM Basisplan als Dokumenttyp gemäss KBOB-IPB. Version, Workflow, Anweisung und Nachricht wurden nach Review vom 7. September 2026 nicht übernommen; Physisches Archiv und Datei werden bewusst nicht modelliert. Attributprofile und Beziehungen (Dossier–Dokument, Verknüpfung zur Architektonischen Sicht) bleiben spätere Fachprofil-Arbeit."
    }
  },
  "object": {
    "id": "cafm-basisplan",
    "name": "CAFM Basisplan",
    "description": "Digitaler Geschoss-Basisplan (DWG) für das Flächenmanagement: Grundlage für die Erstellung und Mutation von Flächenplänen im CAFM.",
    "standards": [
      "KBOB-IPB Anhang C – Dokumenttypenkatalog 2016"
    ],
    "comment": "Gruppe: Dokumentstruktur\nPrimäre Identifikation: Dokumenttypcode (DTC)\nDokumenttyp gemäss KBOB-IPB Anhang C – Dokumenttypenkatalog 2016. Je Geschoss ein Basisplan; vgl. Geschoss in der Architektonischen Sicht.",
    "links": [
      {
        "url": "https://www.kbob.admin.ch/dam/de/sd-web/rVvtgYM1wFVT/20171024_KBOB-IPB_Anhang_C_-_Dokumenttypenkatalog_2016_DE.pdf",
        "purpose": "standard",
        "title_de": "KBOB-IPB Anhang C – Dokumenttypenkatalog 2016"
      }
    ]
  }
}
  $proposal$::jsonb;
  raw_before jsonb;
  domain_uuid uuid;
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
    RAISE NOTICE 'CAFM Basisplan already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the Dokumente Management review first';
  END IF;

  SELECT to_jsonb(d) INTO raw_before FROM catalog.domain d WHERE d.identifier = proposal->'domain'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'domain'->>'revision')::bigint
    OR NOT raw_before @> (proposal->'domain'->'before') THEN
    RAISE EXCEPTION 'Stale domain baseline; review intervening changes';
  END IF;
  domain_uuid := (raw_before->>'id')::uuid;
  IF EXISTS (SELECT FROM catalog.business_object WHERE identifier = proposal->'object'->>'id') THEN
    RAISE EXCEPTION 'The proposed object identifier already exists; refusing to overwrite it';
  END IF;

  UPDATE catalog.domain AS d SET comment = proposal->'domain'->'after'->>'comment', modified_on = edited_on
    WHERE d.id = domain_uuid AND d.row_version = (proposal->'domain'->>'revision')::bigint
    RETURNING to_jsonb(d) INTO STRICT raw_before;
  change_count := change_count + 1;

  -- Zone precedent: no invented governance, classification or priority.
  INSERT INTO catalog.business_object AS o
    (identifier, name_de, description_de, comment, domain_id, normative_references, documentation_links, status, created_on, modified_on)
  VALUES (proposal->'object'->>'id', proposal->'object'->>'name', proposal->'object'->>'description',
    proposal->'object'->>'comment', domain_uuid,
    ARRAY(SELECT jsonb_array_elements_text(proposal->'object'->'standards')),
    proposal->'object'->'links', 'draft', edited_on, edited_on)
  RETURNING o.id INTO record_uuid;
  change_count := change_count + 1;

  IF (SELECT count(*) FROM catalog.business_object WHERE domain_id = domain_uuid) <> 8 THEN
    RAISE EXCEPTION 'Unexpected Dokumente Management object count; rolling back';
  END IF;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$cafm$;

-- Current domain content: these queries also work after COMMIT and on a repeat run.
SELECT o.identifier, o.name_de AS objekt, o.status,
  array_to_string(o.normative_references, ', ') AS standards
FROM catalog.business_object o JOIN catalog.domain d ON d.id = o.domain_id
WHERE d.identifier = 'dokumente' ORDER BY o.identifier;

COMMIT;
