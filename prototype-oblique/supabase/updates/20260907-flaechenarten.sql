-- Flächenarten: the SIA 416 list is completed with the plot areas (GSF = GGF + UF with
-- BUF/UUF, verified against published SIA 416 documentation), and two new lists join it:
-- DIN 277 Flächenart (DIN 277-1:2021-08: GF = BF + UF; BGF = KGF + NRF; NRF = NUF + TF
-- + VF; NUF groups 1-7) and IPMS Flächenart (IPMS: All Buildings, January 2023: classes
-- IPMS 1, 2, 3.1, 3.2, 4.1, 4.2 - definitions extracted from the official standard PDF;
-- the 3A/3B/3C labels of the superseded per-asset standards no longer apply).
-- All three lists anchor to the Bemessung business object like the existing SIA list.
-- Standalone content update AFTER referenzdaten-bereinigung-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 30 record changes: 1 list update + 5 values, and 2 new lists with 16 + 6 values.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $flaechen$
DECLARE
  operation_id constant text := 'flaechenarten-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Flächenarten-Recherche 7. September 2026: SIA 416, DIN 277-1:2021-08, IPMS: All Buildings (2023)",
  "requiresOperation": "referenzdaten-bereinigung-20260907-v1",
  "expectedChanges": 30,
  "extendSia": {
    "id": "r-sia-flaeche",
    "revision": 1,
    "before": { "name_de": "SIA 416 Flächenart", "comment": null, "normative_references": ["SIA"] },
    "expectedCodes": ["FF", "GF", "HNF", "KF", "NF", "NGF", "NNF", "VF"],
    "after": {
      "standards": ["SIA 416"],
      "comment": "Vollständige Flächengliederung nach SIA 416: GSF = GGF + UF (BUF, UUF); GF = NGF + KF; NGF = NF (HNF, NNF) + VF + FF. Grundstücksflächen am 7. September 2026 ergänzt."
    },
    "values": [
      { "code": "GSF", "name": "Grundstücksfläche" },
      { "code": "GGF", "name": "Gebäudegrundfläche" },
      { "code": "UF", "name": "Umgebungsfläche" },
      { "code": "BUF", "name": "Bearbeitete Umgebungsfläche" },
      { "code": "UUF", "name": "Unbearbeitete Umgebungsfläche" }
    ]
  },
  "createLists": [
    {
      "id": "r-din277-flaeche",
      "name": "DIN 277 Flächenart",
      "description": "Grundflächen des Hochbaus (BGF, NRF, NUF, …) gemäss DIN 277-1.",
      "standards": ["DIN 277-1:2021-08"],
      "comment": "GF = BF + UF; BGF = KGF + NRF; NRF = NUF + TF + VF; die Nutzungsfläche ist in die Nutzungsgruppen NUF 1–7 gegliedert. Rauminhalte (BRI, NRI, KRI) sind keine Flächenarten und nicht enthalten.",
      "values": [
        { "code": "GF", "name": "Grundstücksfläche" },
        { "code": "BF", "name": "Bebaute Fläche" },
        { "code": "UF", "name": "Unbebaute Fläche" },
        { "code": "BGF", "name": "Brutto-Grundfläche" },
        { "code": "KGF", "name": "Konstruktions-Grundfläche" },
        { "code": "NRF", "name": "Netto-Raumfläche" },
        { "code": "NUF", "name": "Nutzungsfläche" },
        { "code": "NUF 1", "name": "Wohnen und Aufenthalt" },
        { "code": "NUF 2", "name": "Büroarbeit" },
        { "code": "NUF 3", "name": "Produktion, Hand- und Maschinenarbeit, Forschung und Entwicklung" },
        { "code": "NUF 4", "name": "Lagern, Verteilen und Verkaufen" },
        { "code": "NUF 5", "name": "Bildung, Unterricht und Kultur" },
        { "code": "NUF 6", "name": "Heilen und Pflegen" },
        { "code": "NUF 7", "name": "Sonstige Nutzungen" },
        { "code": "TF", "name": "Technikfläche" },
        { "code": "VF", "name": "Verkehrsfläche" }
      ]
    },
    {
      "id": "r-ipms-flaeche",
      "name": "IPMS Flächenart",
      "description": "Messklassen für Gebäudeflächen gemäss IPMS: All Buildings (2023).",
      "standards": ["IPMS: All Buildings"],
      "links": [
        { "url": "https://ipmsc.org/standards/", "purpose": "standard", "title_de": "IPMS: All Buildings (Januar 2023)" }
      ],
      "comment": "IPMS 1 und 2 messen das Gebäude aussen bzw. bis zur inneren dominanten Fläche; IPMS 3.1/3.2 exklusiv genutzte Flächen aussen bzw. innen; IPMS 4.1/4.2 ausgewählte Flächen zu Fertigoberflächen mit bzw. ohne Wände und Stützen. Ersetzt die Klassen 3A/3B/3C der abgelösten Einzelstandards; Definitionen am 7. September 2026 gegen das Normdokument geprüft.",
      "values": [
        { "code": "IPMS 1", "name": "Geschossfläche bis zur Aussenseite der Aussenwände" },
        { "code": "IPMS 2", "name": "Geschossfläche bis zur inneren dominanten Fläche (IDF)" },
        { "code": "IPMS 3.1", "name": "Exklusiv genutzte Fläche, aussen gemessen" },
        { "code": "IPMS 3.2", "name": "Exklusiv genutzte Fläche, innen gemessen" },
        { "code": "IPMS 4.1", "name": "Ausgewählte Fläche zu Fertigoberflächen, einschliesslich Wände und Stützen" },
        { "code": "IPMS 4.2", "name": "Ausgewählte Fläche zu Fertigoberflächen, ohne Wände und Stützen" }
      ]
    }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  child jsonb;
  raw_before jsonb;
  sia_uuid uuid;
  anchor_uuid uuid;
  list_uuid uuid;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete area-type update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Area-type operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Flächenarten already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the Referenzdaten cleanup first';
  END IF;

  -- Validate the entire scope before changing any row.
  SELECT to_jsonb(l) INTO raw_before FROM catalog.code_list l
    WHERE l.identifier = proposal->'extendSia'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'extendSia'->>'revision')::bigint
    OR NOT raw_before @> (proposal->'extendSia'->'before') OR raw_before->>'comment' IS NOT NULL
    OR raw_before->'normative_references' <> proposal->'extendSia'->'before'->'normative_references' THEN
    RAISE EXCEPTION 'Stale SIA 416 baseline; review intervening changes';
  END IF;
  sia_uuid := (raw_before->>'id')::uuid;
  anchor_uuid := (raw_before->>'business_object_id')::uuid;
  IF anchor_uuid IS NULL OR NOT EXISTS (SELECT FROM catalog.business_object WHERE id = anchor_uuid AND identifier = 'bemessung') THEN
    RAISE EXCEPTION 'Expected the SIA list anchored to Bemessung';
  END IF;
  IF (SELECT jsonb_agg(v.code ORDER BY v.code) FROM catalog.code_value v WHERE v.code_list_id = sia_uuid)
      <> proposal->'extendSia'->'expectedCodes' THEN
    RAISE EXCEPTION 'SIA 416 codes differ from the reviewed baseline; review the values';
  END IF;
  IF EXISTS (SELECT FROM catalog.code_value WHERE identifier IN
      (SELECT (proposal->'extendSia'->>'id') || '/' || (v->>'code') FROM jsonb_array_elements(proposal->'extendSia'->'values') v)) THEN
    RAISE EXCEPTION 'A proposed SIA value identifier already exists; refusing to overwrite it';
  END IF;
  IF EXISTS (SELECT FROM catalog.code_list WHERE identifier IN
      (SELECT l->>'id' FROM jsonb_array_elements(proposal->'createLists') l))
    OR EXISTS (SELECT FROM catalog.code_list WHERE name_de IN
      (SELECT l->>'name' FROM jsonb_array_elements(proposal->'createLists') l))
    OR EXISTS (SELECT FROM catalog.code_value WHERE identifier IN
      (SELECT (l->>'id') || '/' || (v->>'code') FROM jsonb_array_elements(proposal->'createLists') l,
        LATERAL jsonb_array_elements(l->'values') v)) THEN
    RAISE EXCEPTION 'A proposed new list/value identifier or name already exists; refusing to overwrite it';
  END IF;

  UPDATE catalog.code_list AS l
    SET comment = proposal->'extendSia'->'after'->>'comment',
      normative_references = ARRAY(SELECT jsonb_array_elements_text(proposal->'extendSia'->'after'->'standards')),
      modified_on = edited_on
    WHERE l.id = sia_uuid AND l.row_version = (proposal->'extendSia'->>'revision')::bigint
    RETURNING to_jsonb(l) INTO STRICT raw_before;
  change_count := change_count + 1;
  FOR child IN SELECT * FROM jsonb_array_elements(proposal->'extendSia'->'values') LOOP
    INSERT INTO catalog.code_value AS v
      (identifier, code_list_id, code, name_de, created_on, modified_on)
    VALUES ((proposal->'extendSia'->>'id') || '/' || (child->>'code'), sia_uuid, child->>'code', child->>'name', edited_on, edited_on)
    RETURNING v.id INTO record_uuid;
    change_count := change_count + 1;
  END LOOP;
  IF (SELECT count(*) FROM catalog.code_value WHERE code_list_id = sia_uuid) <> 13 THEN
    RAISE EXCEPTION 'Unexpected SIA 416 value count; rolling back';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'createLists') LOOP
    INSERT INTO catalog.code_list AS l
      (identifier, name_de, description_de, comment, business_object_id, status, created_on, modified_on, normative_references, documentation_links)
    VALUES (item->>'id', item->>'name', item->>'description', item->>'comment', anchor_uuid, 'draft', edited_on, edited_on,
      ARRAY(SELECT jsonb_array_elements_text(item->'standards')), COALESCE(item->'links', '[]'::jsonb))
    RETURNING l.id INTO list_uuid;
    change_count := change_count + 1;
    FOR child IN SELECT * FROM jsonb_array_elements(item->'values') LOOP
      INSERT INTO catalog.code_value AS v
        (identifier, code_list_id, code, name_de, created_on, modified_on)
      VALUES ((item->>'id') || '/' || (child->>'code'), list_uuid, child->>'code', child->>'name', edited_on, edited_on)
      RETURNING v.id INTO record_uuid;
      change_count := change_count + 1;
    END LOOP;
    IF (SELECT count(*) FROM catalog.code_value WHERE code_list_id = list_uuid)
      <> jsonb_array_length(item->'values') THEN
      RAISE EXCEPTION 'Unexpected value count for %; rolling back', item->>'id';
    END IF;
  END LOOP;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$flaechen$;

-- Area-type lists after the update: works after COMMIT and on a repeat run.
SELECT l.identifier, l.name_de, array_to_string(l.normative_references, ', ') AS standards,
  count(v.id) AS werte, l.row_version
FROM catalog.code_list l LEFT JOIN catalog.code_value v ON v.code_list_id = l.id
WHERE l.identifier IN ('r-sia-flaeche', 'r-din277-flaeche', 'r-ipms-flaeche')
GROUP BY l.identifier, l.name_de, l.normative_references, l.row_version ORDER BY l.identifier;

COMMIT;
