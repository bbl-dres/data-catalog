-- Dokumente Management: new domain and its eleven business objects from the EA-IMMO
-- Fachkonzept Dokumentenmanagement (prototype-datamodel/docs/Dokumentenmanagement.md).
-- Four Muss (Dokument, Dossier, Version, Archivgut), four Soll (Dokumenttyp, Metadatensatz,
-- Workflow, Registraturplan) and three Kann objects (Anweisung, Vorarchiv, Nachricht) in five
-- groups; Physisches Archiv and Datei are deliberately not modelled. Objects follow the Zone
-- precedent: draft status, doc descriptions and standards, compact comments, no invented
-- governance, classification or attribute profiles. Existing content and fixtures are untouched.
-- Standalone content update AFTER kompakte-kommentare-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 12 record creates: 1 domain and 11 business objects; no change-log entries are generated.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; identifier collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $dokumente$
DECLARE
  operation_id constant text := 'dokumentenmanagement-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026",
  "requiresOperation": "kompakte-kommentare-20260907-v1",
  "expectedChanges": 12,
  "domain": {
    "id": "dokumente",
    "name": "Dokumente Management",
    "description": "Strukturierte Erfassung, Verwaltung, Bereitstellung und langfristige Archivierung dokumentenbezogener Informationen: Dokumente, Dossiers, Versionen, Metadaten, Workflows und Archivgut.",
    "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\n\nElf Geschäftsobjekte in fünf Gruppen (Dokumentstruktur, Metadaten, Prozesse, Archivierung, Kommunikation), priorisiert nach MoSCoW: vier Muss, vier Soll, drei Kann. Physisches Archiv und Datei werden bewusst nicht modelliert; der Fokus liegt auf digitaler Dokumentation, und die Datei ist Teil des Dokument-Objekts. Attributprofile, Beziehungen (Dossier–Dokument, Version–Dokument, Verknüpfung zur Architektonischen Sicht) und Systemzuordnungen (ActaNova GEVER, CDE Bund, IBM FileNet/DALA) bleiben spätere Fachprofil-Arbeit.",
    "links": [
      {
        "url": "https://www.ech.ch/de/ech/ech-0039/3.1",
        "purpose": "standard",
        "title_de": "eCH-0039 E-Government-Schnittstelle für Dossiers und Dokumente"
      },
      {
        "url": "https://www.fedlex.admin.ch/eli/cc/1999/354/de",
        "purpose": "standard",
        "title_de": "Bundesgesetz über die Archivierung (ArchG)"
      },
      {
        "url": "https://www.kbob.admin.ch/de/bauwerksdokumentation-im-hochbau",
        "purpose": "standard",
        "title_de": "KBOB Bauwerksdokumentation im Hochbau (BWD)"
      }
    ]
  },
  "objects": [
    {
      "id": "dokument",
      "name": "Dokument",
      "description": "Einzelne aufgezeichnete Information unabhängig vom Informationsträger (Pläne, Verträge, Berichte, E-Mails)",
      "standards": [
        "eCH-0039",
        "KBOB BWD",
        "ISO 15489"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Dokumentstruktur; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: BBL-Dokument-ID / UUID\nZentrale Verwaltungseinheit für alle BBL-Informationen."
    },
    {
      "id": "dossier",
      "name": "Dossier",
      "description": "Zusammengehörige Dokumente zu einem Geschäft oder Vorgang als strukturierte Einheit",
      "standards": [
        "eCH-0039",
        "ArchG",
        "GEVER"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Dokumentstruktur; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: BBL-Dossier-ID / UUID\nOrganisationseinheit für Geschäftsfälle und Projekte."
    },
    {
      "id": "dokumentversion",
      "name": "Version",
      "description": "Versionierte Instanz eines Dokuments mit Änderungshistorie",
      "standards": [
        "eCH-0039",
        "ISO 15489"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Dokumentstruktur; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: BBL-Version-ID\nFür Nachvollziehbarkeit und Änderungsmanagement; jede Version gehört zu genau einem Dokument."
    },
    {
      "id": "dokumenttyp",
      "name": "Dokumenttyp",
      "description": "Katalogentität für die Klassifikation ähnlicher Dokumente mit spezifischem Informationsgehalt",
      "standards": [
        "KBOB BWD"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Dokumentstruktur; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: Dokumenttypcode (DTC)\nStrukturiert Dokumentablage nach Leistungsbereichen."
    },
    {
      "id": "metadatensatz",
      "name": "Metadatensatz",
      "description": "Eigenständige Entität für strukturierte Beschreibungsinformationen zu Dokumenten",
      "standards": [
        "Dublin Core",
        "ISO 23081",
        "eCH-0039"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Metadaten; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: BBL-Metadaten-ID\nFlexibles Metadatenmanagement."
    },
    {
      "id": "workflow",
      "name": "Workflow",
      "description": "Definierter Ablauf für Dokumentenbearbeitung mit Status und Übergängen",
      "standards": [
        "eCH-0039",
        "ISO 15489"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Prozesse; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: BBL-Workflow-ID\nSteuert Dokumentenlebenszyklen."
    },
    {
      "id": "anweisung",
      "name": "Anweisung",
      "description": "Strukturierte Handlungsanweisung für Dokumentenbearbeitung",
      "standards": [
        "eCH-0039"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Prozesse; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: BBL-Anweisung-ID\nDirective gemäss eCH-0039."
    },
    {
      "id": "archivgut",
      "name": "Archivgut",
      "description": "Dokumente mit bleibendem Wert, die dauerhaft aufbewahrt werden",
      "standards": [
        "ArchG",
        "ISAD(G)"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Archivierung; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: BBL-Archiv-ID\nEndstatus wertvoller Dokumente."
    },
    {
      "id": "vorarchiv",
      "name": "Vorarchiv",
      "description": "Zwischenlager für Dokumente vor der definitiven Archivierung",
      "standards": [
        "ArchG"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Archivierung; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: BBL-Vorarchiv-ID\nÜbergangsbereich vor Archivierung."
    },
    {
      "id": "registraturplan",
      "name": "Registraturplan",
      "description": "Systematisches Ordnungssystem für die strukturierte Ablage",
      "standards": [
        "ArchG",
        "eCH-0002"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Organisation; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: BBL-Registratur-ID\nBasis für Ablagestruktur."
    },
    {
      "id": "nachricht",
      "name": "Nachricht",
      "description": "Standardisierte Struktur für Dokumentenaustausch zwischen Systemen",
      "standards": [
        "eCH-0039"
      ],
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Kommunikation; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: BBL-Nachricht-ID\nTransportcontainer für Austausch."
    }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  domain_uuid uuid;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete domain update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Domain operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Dokumente Management already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the compact comments first';
  END IF;

  -- Refuse pre-existing identifiers before creating anything.
  IF EXISTS (SELECT FROM catalog.domain WHERE identifier = proposal->'domain'->>'id')
    OR EXISTS (SELECT FROM catalog.business_object WHERE identifier IN
      (SELECT o->>'id' FROM jsonb_array_elements(proposal->'objects') o)) THEN
    RAISE EXCEPTION 'A proposed new domain/object identifier already exists; refusing to overwrite it';
  END IF;

  INSERT INTO catalog.domain AS d
    (identifier, name_de, description_de, comment, documentation_links, status, created_on, modified_on)
  VALUES (proposal->'domain'->>'id', proposal->'domain'->>'name', proposal->'domain'->>'description',
    proposal->'domain'->>'comment', proposal->'domain'->'links', 'draft', edited_on, edited_on)
  RETURNING d.id INTO domain_uuid;
  change_count := change_count + 1;

  -- Objects follow the Zone precedent: no invented governance or classification.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'objects') LOOP
    INSERT INTO catalog.business_object AS o
      (identifier, name_de, description_de, comment, domain_id, normative_references, status, created_on, modified_on)
    SELECT item->>'id', item->>'name', item->>'description', item->>'comment', domain_uuid,
      ARRAY(SELECT jsonb_array_elements_text(item->'standards')), 'draft', edited_on, edited_on
    RETURNING o.id INTO record_uuid;
    change_count := change_count + 1;
  END LOOP;

  IF (SELECT count(*) FROM catalog.business_object WHERE domain_id = domain_uuid) <> jsonb_array_length(proposal->'objects') THEN
    RAISE EXCEPTION 'Unexpected object count for the new domain; rolling back';
  END IF;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$dokumente$;

-- Current domain content: these queries also work after COMMIT and on a repeat run.
SELECT d.identifier AS domain, d.name_de,
  (SELECT count(*) FROM catalog.business_object o WHERE o.domain_id = d.id) AS objekte
FROM catalog.domain d ORDER BY d.identifier;

SELECT o.identifier, o.name_de AS objekt, substring(o.comment from 'Priorität: [^ ]+') AS prioritaet,
  array_to_string(o.normative_references, ', ') AS standards
FROM catalog.business_object o JOIN catalog.domain d ON d.id = o.domain_id
WHERE d.identifier = 'dokumente' ORDER BY o.identifier;

COMMIT;
