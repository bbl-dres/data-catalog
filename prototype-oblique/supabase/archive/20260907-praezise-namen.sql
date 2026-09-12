-- Precise names: the fourteen CRB cost-element lists carry the standard in the name
-- (CRB eBKP-H <Hauptgruppe>), and the register-reference attributes of Gebäude and
-- Grundstück carry their source register as suffix: EGID (GWR), EGRID (AV). The
-- attribute rows in docs/business-object-attribute-proposal.md keep the plain names;
-- the suffix is display clarification, not a semantic change.
-- Standalone content update AFTER kbob-dokumenttypen-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 17 record changes: 14 code-list renames and 3 attribute renames; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $namen$
DECLARE
  operation_id constant text := 'praezise-namen-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Namensschärfung 7. September 2026: Standard im Listennamen, Registerquelle im Attributnamen",
  "requiresOperation": "kbob-dokumenttypen-20260907-v1",
  "expectedChanges": 17,
  "listRenames": [
    { "id": "r-crb-grundstueck", "revision": 1, "before": "CRB Grundstück", "after": "CRB eBKP-H Grundstück" },
    { "id": "r-crb-vorbereitung", "revision": 1, "before": "CRB Vorbereitung", "after": "CRB eBKP-H Vorbereitung" },
    { "id": "r-crb-konstruktion", "revision": 1, "before": "CRB Konstruktion Gebäude", "after": "CRB eBKP-H Konstruktion Gebäude" },
    { "id": "r-crb-technik", "revision": 1, "before": "CRB Technik Gebäude", "after": "CRB eBKP-H Technik Gebäude" },
    { "id": "r-crb-wandbekleidung", "revision": 1, "before": "CRB Äussere Wandbekleidung Gebäude", "after": "CRB eBKP-H Äussere Wandbekleidung Gebäude" },
    { "id": "r-crb-bedachung", "revision": 1, "before": "CRB Bedachung Gebäude", "after": "CRB eBKP-H Bedachung Gebäude" },
    { "id": "r-crb-ausbau", "revision": 1, "before": "CRB Ausbau Gebäude", "after": "CRB eBKP-H Ausbau Gebäude" },
    { "id": "r-crb-nutzungsanlage", "revision": 1, "before": "CRB Nutzungsspezifische Anlage Gebäude", "after": "CRB eBKP-H Nutzungsspezifische Anlage Gebäude" },
    { "id": "r-crb-umgebung", "revision": 1, "before": "CRB Umgebung Gebäude", "after": "CRB eBKP-H Umgebung Gebäude" },
    { "id": "r-crb-ausstattung", "revision": 1, "before": "CRB Ausstattung Gebäude", "after": "CRB eBKP-H Ausstattung Gebäude" },
    { "id": "r-crb-planungskosten", "revision": 1, "before": "CRB Planungskosten", "after": "CRB eBKP-H Planungskosten" },
    { "id": "r-crb-nebenkosten", "revision": 1, "before": "CRB Nebenkosten zu Erstellung", "after": "CRB eBKP-H Nebenkosten zu Erstellung" },
    { "id": "r-crb-reserve", "revision": 1, "before": "CRB Reserve, Teuerung", "after": "CRB eBKP-H Reserve, Teuerung" },
    { "id": "r-crb-mwst", "revision": 1, "before": "CRB Mehrwertsteuer", "after": "CRB eBKP-H Mehrwertsteuer" }
  ],
  "attributeRenames": [
    { "id": "gebaeude/egid", "revision": 3, "before": "EGID", "after": "EGID (GWR)" },
    { "id": "gebaeude/grundstueck", "revision": 4, "before": "EGRID", "after": "EGRID (AV)" },
    { "id": "grundstueck/egrid", "revision": 3, "before": "EGRID", "after": "EGRID (AV)" }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  raw_before jsonb;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete rename update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Rename operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Precise names already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the KBOB Dokumenttypen first';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'listRenames') LOOP
    SELECT to_jsonb(l) INTO raw_before FROM catalog.code_list l WHERE l.identifier = item->>'id' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'name_de' IS DISTINCT FROM item->>'before' THEN
      RAISE EXCEPTION 'Stale code-list baseline for %; review intervening changes', item->>'id';
    END IF;
    IF EXISTS (SELECT FROM catalog.code_list WHERE name_de = item->>'after') THEN
      RAISE EXCEPTION 'The proposed name % already exists; refusing a duplicate label', item->>'after';
    END IF;
    UPDATE catalog.code_list AS l SET name_de = item->>'after', modified_on = edited_on
      WHERE l.id = (raw_before->>'id')::uuid AND l.row_version = (item->>'revision')::bigint
      RETURNING to_jsonb(l) INTO STRICT raw_before;
    change_count := change_count + 1;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'attributeRenames') LOOP
    SELECT to_jsonb(a) INTO raw_before FROM catalog.business_attribute a WHERE a.identifier = item->>'id' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'name_de' IS DISTINCT FROM item->>'before' THEN
      RAISE EXCEPTION 'Stale attribute baseline for %; review intervening changes', item->>'id';
    END IF;
    UPDATE catalog.business_attribute AS a SET name_de = item->>'after', modified_on = edited_on
      WHERE a.id = (raw_before->>'id')::uuid AND a.row_version = (item->>'revision')::bigint
      RETURNING to_jsonb(a) INTO STRICT raw_before;
    change_count := change_count + 1;
  END LOOP;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$namen$;

-- Renamed records: works after COMMIT and on a repeat run.
SELECT 'code_list' AS entity, l.identifier, l.name_de, l.row_version FROM catalog.code_list l WHERE l.identifier LIKE 'r-crb-%'
UNION ALL
SELECT 'business_attribute', a.identifier, a.name_de, a.row_version FROM catalog.business_attribute a
WHERE a.identifier IN ('gebaeude/egid', 'gebaeude/grundstueck', 'grundstueck/egrid')
ORDER BY entity, identifier;

COMMIT;
