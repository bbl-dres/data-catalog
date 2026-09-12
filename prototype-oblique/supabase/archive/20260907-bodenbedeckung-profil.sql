-- Bodenbedeckung profile: the bau business object is completed per the owner review of
-- 7 September 2026. Eleven new attributes: EGID (GWR) and EGRID (AV) register references,
-- Art bound to AV Bodenbedeckungsart, the Lageadresse without Strasse and Hausnummer
-- (Land bound to ISO 3166-1 Land, Region, Ort, Postleitzahl, Adresszusatz), the WGS84
-- polygon geometry, Teilportfolio bound to BBL Teilportfolio, and Fläche in m².
-- Bezeichnung and Gültig ab are not needed and are retired; Bodenbedeckung-ID and
-- Status stay unchanged.
-- Standalone content update AFTER praezise-namen-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 14 record changes: 1 object comment, 2 attribute retirements, 11 attribute creations.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $boden$
DECLARE
  operation_id constant text := 'bodenbedeckung-profil-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Profil-Review Bodenbedeckung 7. September 2026 (Katalogverantwortlicher)",
  "requiresOperation": "praezise-namen-20260907-v1",
  "expectedChanges": 14,
  "object": {
    "id": "bodenbedeckung",
    "revision": 1,
    "before": { "comment": null },
    "afterComment": "Profil am 7. September 2026 ergänzt: Art nach AV Bodenbedeckungsart, Registerbezüge EGID (GWR) und EGRID (AV), Lageadresse ohne Strasse und Hausnummer, WGS84-Polygon, Teilportfolio und Fläche in m². Bezeichnung und Gültig ab entfallen."
  },
  "retire": [
    { "id": "bodenbedeckung/bezeichnung", "revision": 1, "before": "Bezeichnung" },
    { "id": "bodenbedeckung/gueltig-ab", "revision": 1, "before": "Gültig ab" }
  ],
  "retireComment": "Aus dem Profil genommen; für Bodenbedeckungen nicht benötigt.",
  "create": [
    { "id": "bodenbedeckung/egid", "name": "EGID (GWR)", "semantic": "egid",
      "spec": { "valueType": "identifier" },
      "description": "Eidgenössischer Gebäudeidentifikator des zugehörigen Gebäudes im GWR." },
    { "id": "bodenbedeckung/egrid", "name": "EGRID (AV)", "semantic": "egrid",
      "spec": { "valueType": "identifier" },
      "description": "Eidgenössischer Grundstücksidentifikator des zugehörigen Grundstücks aus der amtlichen Vermessung." },
    { "id": "bodenbedeckung/art", "name": "Art", "semantic": "art",
      "spec": { "valueType": "code" }, "codeList": "r-av-land-cover-type",
      "description": "Bodenbedeckungsart gemäss amtlicher Vermessung." },
    { "id": "bodenbedeckung/land", "name": "Land", "semantic": "country",
      "spec": { "valueType": "code" }, "codeList": "r-iso-land",
      "description": "Land der Lageadresse." },
    { "id": "bodenbedeckung/region", "name": "Region / Kanton / Bundesstaat", "semantic": "region",
      "spec": { "valueType": "text" },
      "description": "Administrative Region der Lageadresse, beispielsweise Kanton, Bundesstaat oder Provinz." },
    { "id": "bodenbedeckung/ort", "name": "Ort", "semantic": "locality",
      "spec": { "valueType": "text" },
      "description": "Ortschaft der Lageadresse." },
    { "id": "bodenbedeckung/postleitzahl", "name": "Postleitzahl", "semantic": "postalCode",
      "spec": { "valueType": "text" },
      "description": "Postleitzahl der Lageadresse, sofern zugeteilt." },
    { "id": "bodenbedeckung/adresszusatz", "name": "Adresszusatz", "semantic": "addressSupplement",
      "spec": { "valueType": "text" },
      "description": "Ergänzende Angabe zur Lageadresse." },
    { "id": "bodenbedeckung/geometrie", "name": "Geometrie", "semantic": "geometrie",
      "spec": { "valueType": "geometry", "geometryType": "Polygon", "coordinateReferenceSystem": "EPSG:4326" },
      "description": "Fläche der Bodenbedeckung als Polygon in WGS84 (EPSG:4326)." },
    { "id": "bodenbedeckung/teilportfolio", "name": "Teilportfolio", "semantic": "teilportfolio",
      "spec": { "valueType": "code" }, "codeList": "r-bbl-teilportfolio",
      "description": "Teilportfolio-Zuordnung der Bodenbedeckung im BBL-Portfolio." },
    { "id": "bodenbedeckung/flaeche", "name": "Fläche", "semantic": "flaeche",
      "spec": { "valueType": "decimal" },
      "description": "Fläche der Bodenbedeckung in Quadratmetern." }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  raw_before jsonb;
  object_uuid uuid;
  list_uuid uuid;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete profile update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Profile operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Bodenbedeckung profile already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the precise names first';
  END IF;

  -- Validate the entire scope before changing any row.
  SELECT to_jsonb(o) INTO raw_before FROM catalog.business_object o
    WHERE o.identifier = proposal->'object'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'object'->>'revision')::bigint
    OR raw_before->>'comment' IS NOT NULL THEN
    RAISE EXCEPTION 'Stale Bodenbedeckung baseline; review intervening changes';
  END IF;
  object_uuid := (raw_before->>'id')::uuid;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'retire') LOOP
    SELECT to_jsonb(a) INTO raw_before FROM catalog.business_attribute a WHERE a.identifier = item->>'id' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'name_de' IS DISTINCT FROM item->>'before'
      OR raw_before->>'status' IS DISTINCT FROM 'draft' OR raw_before->>'comment' IS NOT NULL THEN
      RAISE EXCEPTION 'Stale attribute baseline for %; review intervening changes', item->>'id';
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM catalog.business_attribute WHERE identifier IN
      (SELECT c->>'id' FROM jsonb_array_elements(proposal->'create') c)) THEN
    RAISE EXCEPTION 'A proposed attribute identifier already exists; refusing to overwrite it';
  END IF;

  UPDATE catalog.business_object AS o
    SET comment = proposal->'object'->>'afterComment', modified_on = edited_on
    WHERE o.id = object_uuid AND o.row_version = (proposal->'object'->>'revision')::bigint
    RETURNING to_jsonb(o) INTO STRICT raw_before;
  change_count := change_count + 1;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'retire') LOOP
    UPDATE catalog.business_attribute AS a
      SET status = 'retired', comment = proposal->>'retireComment', modified_on = edited_on
      WHERE a.identifier = item->>'id' AND a.row_version = (item->>'revision')::bigint
      RETURNING to_jsonb(a) INTO STRICT raw_before;
    change_count := change_count + 1;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'create') LOOP
    list_uuid := NULL;
    IF item ? 'codeList' THEN
      SELECT l.id INTO STRICT list_uuid FROM catalog.code_list l WHERE l.identifier = item->>'codeList';
    END IF;
    INSERT INTO catalog.business_attribute AS a
      (identifier, business_object_id, name_de, semantic_name, description_de, value_specification,
        code_list_id, is_identifier, status, created_on, modified_on)
    VALUES (item->>'id', object_uuid, item->>'name', item->>'semantic', item->>'description',
      item->'spec', list_uuid, false, 'draft', edited_on, edited_on)
    RETURNING a.id INTO record_uuid;
    change_count := change_count + 1;
  END LOOP;

  IF (SELECT count(*) FROM catalog.business_attribute WHERE business_object_id = object_uuid AND status <> 'retired') <> 13 THEN
    RAISE EXCEPTION 'Unexpected active attribute count for Bodenbedeckung; rolling back';
  END IF;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$boden$;

-- Bodenbedeckung profile after the update: works after COMMIT and on a repeat run.
SELECT a.identifier, a.name_de, a.status, a.value_specification->>'valueType' AS format,
  l.identifier AS referenzliste, a.row_version
FROM catalog.business_attribute a
JOIN catalog.business_object o ON o.id = a.business_object_id
LEFT JOIN catalog.code_list l ON l.id = a.code_list_id
WHERE o.identifier = 'bodenbedeckung' ORDER BY a.status, a.identifier;

COMMIT;
