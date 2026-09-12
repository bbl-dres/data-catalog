-- Consistent Referenzdaten names: source prefix first, parentheses reserved for technical
-- ids (as the GWR lists already do). Eight renames: the five SAP-F4 lists lose the
-- "(BBL)" suffix in favour of the BBL prefix, the three Basisbemessungen lists are
-- simplified (Einheit becomes Bemessungseinheit). BBL Eigentumsart is assigned to the
-- Architektonische Sicht domain, and the Gebäudeart attribute comment follows the rename.
-- Standalone content update AFTER kommentar-review-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 9 record changes: 8 code-list renames (one with domain assignment) and 1 attribute comment.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $namen$
DECLARE
  operation_id constant text := 'referenzdaten-namen-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Namenskonvention Referenzdaten: <Quelle> <Name>, Klammer nur für technische IDs; Review 7. September 2026",
  "requiresOperation": "kommentar-review-20260907-v1",
  "expectedChanges": 9,
  "renames": [
    { "id": "profile-eigentumsart", "revision": 3, "before": "Eigentumsart (BBL)", "after": "BBL Eigentumsart", "assignDomain": "bau" },
    { "id": "r-bbl-gebaeudeart-1", "revision": 2, "before": "Gebäudeart 1 (BBL)", "after": "BBL Gebäudeart 1" },
    { "id": "r-bbl-gebaeudeart-2", "revision": 2, "before": "Gebäudeart 2 (BBL)", "after": "BBL Gebäudeart 2" },
    { "id": "r-bbl-mietmodell", "revision": 2, "before": "Mietmodell (BBL)", "after": "BBL Mietmodell" },
    { "id": "r-bbl-teilportfolio", "revision": 2, "before": "Teilportfolio (BBL)", "after": "BBL Teilportfolio" },
    { "id": "profile-bemessungsart", "revision": 3, "before": "BBL Basisbemessungen – Bemessungsart", "after": "BBL Bemessungsart" },
    { "id": "profile-bemessungsumfang", "revision": 2, "before": "BBL Basisbemessungen – Bemessungsumfang", "after": "BBL Bemessungsumfang" },
    { "id": "profile-messeinheit", "revision": 3, "before": "BBL Basisbemessungen – Einheit", "after": "BBL Bemessungseinheit" }
  ],
  "comment": {
    "id": "gebaeude/gebaeudeart",
    "revision": 4,
    "beforeHash": "70923e4c1b7a63b2d7486fbc26021a4aedcd2c7fad5983a2651ad9b0bb11c296",
    "after": "Property Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Erforderlich im abgestimmten Geltungsbereich der BBL-Gebäudeklassifikation; ungeklärte Zuordnungen bleiben offen.\nReferenzlisten: BBL Gebäudeart 1 und BBL Gebäudeart 2 gemäss SAP-F4-Werthilfe vom 7. September 2026; Stufe-2-Codes tragen den Präfix ihrer Stufe 1. Verbindliche Zuordnung, Vokabularstand und Customizing-Nachweis bleiben zu bestätigen."
  }
}
  $proposal$::jsonb;
  item jsonb;
  raw_before jsonb;
  domain_uuid uuid;
  record_uuid uuid;
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
    RAISE NOTICE 'Referenzdaten names already consistent; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the comment review first';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'renames') LOOP
    SELECT to_jsonb(l) INTO raw_before FROM catalog.code_list l WHERE l.identifier = item->>'id' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'name_de' IS DISTINCT FROM item->>'before'
      OR (item ? 'assignDomain' AND raw_before->>'domain_id' IS NOT NULL) THEN
      RAISE EXCEPTION 'Stale code-list baseline for %; review intervening changes', item->>'id';
    END IF;
    IF EXISTS (SELECT FROM catalog.code_list WHERE name_de = item->>'after') THEN
      RAISE EXCEPTION 'The proposed name % already exists; refusing a duplicate label', item->>'after';
    END IF;
    domain_uuid := NULL;
    IF item ? 'assignDomain' THEN
      SELECT d.id INTO STRICT domain_uuid FROM catalog.domain d WHERE d.identifier = item->>'assignDomain';
    END IF;
    UPDATE catalog.code_list AS l
      SET name_de = item->>'after', domain_id = COALESCE(domain_uuid, l.domain_id), modified_on = edited_on
      WHERE l.id = (raw_before->>'id')::uuid AND l.row_version = (item->>'revision')::bigint
      RETURNING to_jsonb(l) INTO STRICT raw_before;
    change_count := change_count + 1;
  END LOOP;

  SELECT to_jsonb(a) INTO raw_before FROM catalog.business_attribute a
    WHERE a.identifier = proposal->'comment'->>'id' FOR UPDATE;
  IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (proposal->'comment'->>'revision')::bigint
    OR encode(sha256(convert_to(raw_before->>'comment', 'UTF8')), 'hex') <> proposal->'comment'->>'beforeHash' THEN
    RAISE EXCEPTION 'Stale attribute-comment baseline; review intervening changes';
  END IF;
  record_uuid := (raw_before->>'id')::uuid;
  UPDATE catalog.business_attribute AS a
    SET comment = proposal->'comment'->>'after', modified_on = edited_on
    WHERE a.id = record_uuid AND a.row_version = (proposal->'comment'->>'revision')::bigint
    RETURNING to_jsonb(a) INTO STRICT raw_before;
  change_count := change_count + 1;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$namen$;

-- Renamed lists and the moved domain assignment: works after COMMIT and on a repeat run.
SELECT l.identifier, l.name_de, d.identifier AS domain, l.row_version
FROM catalog.code_list l LEFT JOIN catalog.domain d ON d.id = l.domain_id
WHERE l.identifier IN ('profile-eigentumsart','r-bbl-gebaeudeart-1','r-bbl-gebaeudeart-2','r-bbl-mietmodell',
  'r-bbl-teilportfolio','profile-bemessungsart','profile-bemessungsumfang','profile-messeinheit')
ORDER BY l.name_de;

COMMIT;
