-- Key-role review for Geschäftsobjekte: each object has exactly one primary key - its
-- ID attribute (is_identifier). SAP key components are not primary keys: Buchungskreis
-- and the Wirtschaftseinheit references become FK, and Gebäudenummer, Grundstücksnummer
-- and WE-Nummer lose their key role entirely (they are not unique on their own; the
-- composed SAP key stays documented on the object comments). The app reads FK/UK from
-- the Schlüsselrolle comment line, PK from is_identifier.
-- The Schlüssel column in docs/business-object-attribute-proposal.md still shows the
-- previous PK-Komponente markers; aligning the document is a separate follow-up.
-- Standalone content update AFTER bodenbedeckung-profil-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 8 record changes: eight attribute key corrections; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $schluessel$
DECLARE
  operation_id constant text := 'schluessel-review-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Schlüssel-Review 7. September 2026: genau ein PK je Objekt, Komponenten sind FK oder ohne Schlüsselrolle",
  "requiresOperation": "bodenbedeckung-profil-20260907-v1",
  "expectedChanges": 8,
  "changes": [
    { "id": "gebaeude/buchungskreis", "revision": 3,
      "before": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente",
      "after": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: FK" },
    { "id": "gebaeude/gebaeudenummer-bbl", "revision": 3,
      "before": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente",
      "after": "Property Set (vorgeschlagen): Identifikation" },
    { "id": "gebaeude/wirtschaftseinheit", "revision": 3,
      "before": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente / FK",
      "after": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: FK" },
    { "id": "grundstueck/buchungskreis", "revision": 2,
      "before": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente",
      "after": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: FK" },
    { "id": "grundstueck/grundstuecksnummer-bbl", "revision": 3,
      "before": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente",
      "after": "Property Set (vorgeschlagen): Identifikation" },
    { "id": "grundstueck/wirtschaftseinheit", "revision": 2,
      "before": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente / FK",
      "after": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: FK" },
    { "id": "wirtschaftseinheit/buchungskreis", "revision": 3,
      "before": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente",
      "after": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: FK" },
    { "id": "wirtschaftseinheit/we-nummer", "revision": 3,
      "before": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente",
      "after": "Property Set (vorgeschlagen): Identifikation" }
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
    RAISE EXCEPTION 'Run the complete key review as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Key operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Key roles already reviewed; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the Bodenbedeckung profile first';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    SELECT to_jsonb(a) INTO raw_before FROM catalog.business_attribute a WHERE a.identifier = item->>'id' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'comment' IS DISTINCT FROM item->>'before'
      OR (raw_before->>'is_identifier')::boolean IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Stale key baseline for %; review intervening changes', item->>'id';
    END IF;
    UPDATE catalog.business_attribute AS a
      SET is_identifier = false, comment = item->>'after', modified_on = edited_on
      WHERE a.id = (raw_before->>'id')::uuid AND a.row_version = (item->>'revision')::bigint
      RETURNING to_jsonb(a) INTO STRICT raw_before;
    change_count := change_count + 1;
  END LOOP;

  -- Exactly one primary key per profile object after the review.
  IF EXISTS (
    SELECT o.id FROM catalog.business_object o
    JOIN catalog.business_attribute a ON a.business_object_id = o.id AND a.status <> 'retired'
    GROUP BY o.id HAVING count(*) FILTER (WHERE a.is_identifier) <> 1
  ) THEN
    RAISE EXCEPTION 'An object is left without exactly one primary key; rolling back';
  END IF;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$schluessel$;

-- Key roles after the review: works after COMMIT and on a repeat run.
SELECT o.identifier AS objekt, a.identifier, a.is_identifier AS pk,
  (regexp_match(a.comment, 'Schlüsselrolle: ([^\n]+)'))[1] AS rolle, a.row_version
FROM catalog.business_attribute a JOIN catalog.business_object o ON o.id = a.business_object_id
WHERE a.status <> 'retired' AND o.identifier IN ('gebaeude', 'grundstueck', 'wirtschaftseinheit')
  AND (a.is_identifier OR a.comment LIKE '%Schlüsselrolle%')
ORDER BY o.identifier, a.identifier;

COMMIT;
