-- Architektonische Sicht: six additional business objects from the EA-IMMO Fachkonzept
-- (prototype-datamodel/docs/Architektonische Sicht.md): Parkplatz (Soll), Baurecht (Kann),
-- Dienstbarkeit (Kann), Technische Anlage (Muss), Technische Komponente (Muss, source name
-- Komponente) and Bauteil (Soll). The Anlage/Bauteil specializations and Bauteiltyp with
-- their type-specific IFC/eBKP-H attributes are recorded as later type-profile work instead
-- of separate objects; management processes stay with Objektmanagement. Objects follow the
-- Zone precedent: draft status, doc descriptions and standards, compact comments, no invented
-- governance or classification. Existing content and fixtures are untouched.
-- Standalone content update AFTER dokumentenmanagement-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 6 record creates in the existing domain bau; no change-log entries are generated.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; identifier collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $bau$
DECLARE
  operation_id constant text := 'architektonische-sicht-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026",
  "requiresOperation": "dokumentenmanagement-20260907-v1",
  "domain": "bau",
  "expectedChanges": 6,
  "objects": [
    {
      "id": "parkplatz",
      "name": "Parkplatz",
      "description": "Stellfläche für Fahrzeuge, Velos, oder Sonstiges, mit eindeutiger ID",
      "standards": [],
      "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Räumliche Objekte; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: Parkplatz-ID\nWerden in Reservierungssystemen genutzt."
    },
    {
      "id": "baurecht",
      "name": "Baurecht",
      "description": "Selbständiges und dauerndes Recht auf fremdem Grundstück",
      "standards": [
        "ZGB",
        "eGRISDM"
      ],
      "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Rechtliche Objekte; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: EREID\nFür komplexe Rechtsverhältnisse; selbständiges und dauerndes Recht gemäss Art. 779–779l ZGB."
    },
    {
      "id": "dienstbarkeit",
      "name": "Dienstbarkeit",
      "description": "Beschränkung des Eigentums zugunsten eines berechtigten Grundstücks",
      "standards": [
        "ZGB",
        "eGRISDM"
      ],
      "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Rechtliche Objekte; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: EREID\nFür Zugangs- und Leitungsrechte gemäss Art. 730–792 ZGB."
    },
    {
      "id": "technische-anlage",
      "name": "Technische Anlage",
      "description": "HLK Gebäudetechnische Anlage (Heizung, Klima, Lüftung)",
      "standards": [
        "SIA",
        "GEFMA"
      ],
      "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Technische Objekte; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: Anlage-ID\nIst ein Typ von System (Ausprägung). Die zwölf Spezialisierungen (Heizungs-, Lüftungs-, Kälte-, Elektro-, Beleuchtungs-, Sanitär-, Aufzugs-, Brandschutz-, Sicherheits-, Kommunikations-, Gebäudeautomations- und Energieerzeugungsanlage) mit typspezifischen IFC-/eBKP-H-Attributen bleiben spätere Typprofil-Arbeit. Bewirtschaftungsprozesse wie Instandhaltung und Wartung gehören zum Objektmanagement."
    },
    {
      "id": "technische-komponente",
      "name": "Technische Komponente",
      "description": "Einzelne technische Bauteile und Geräte",
      "standards": [
        "IFC",
        "IBPDI",
        "Bauen Digital CH"
      ],
      "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Technische Objekte; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: Komponenten-ID\nFür Wartung und Betrieb. Der Quellname im Fachkonzept lautet Komponente; typspezifische Attribute (IFC, IBPDI) bleiben spätere Typprofil-Arbeit. Bewirtschaftungsprozesse gehören zum Objektmanagement."
    },
    {
      "id": "bauteil",
      "name": "Bauteil",
      "description": "Physische Bauteile der Gebäudestruktur",
      "standards": [
        "IFC",
        "Bauen Digital CH"
      ],
      "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Konstruktive Objekte; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: Bauteil-ID\nÜbergeordnete Klasse für alle konstruktiven Elemente. Die zehn Spezialisierungen (Wand, Decke/Bodenplatte, Dach, Stütze, Träger/Balken, Fundament, Treppe, Tür, Fenster, Fassade) und der Bauteiltyp (IfcBuildingElementType) mit typspezifischen IFC-/eBKP-H-Attributen bleiben spätere Typprofil-Arbeit."
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
    RAISE EXCEPTION 'Run the complete object update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Object operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Architektonische Sicht objects already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the Dokumente Management update first';
  END IF;

  SELECT id INTO domain_uuid FROM catalog.domain WHERE identifier = proposal->>'domain';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected the existing Architektonische Sicht domain';
  END IF;
  IF EXISTS (SELECT FROM catalog.business_object WHERE identifier IN
      (SELECT o->>'id' FROM jsonb_array_elements(proposal->'objects') o)) THEN
    RAISE EXCEPTION 'A proposed new object identifier already exists; refusing to overwrite it';
  END IF;

  -- Objects follow the Zone precedent: no invented governance or classification.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'objects') LOOP
    INSERT INTO catalog.business_object AS o
      (identifier, name_de, description_de, comment, domain_id, normative_references, status, created_on, modified_on)
    SELECT item->>'id', item->>'name', item->>'description', item->>'comment', domain_uuid,
      ARRAY(SELECT jsonb_array_elements_text(item->'standards')), 'draft', edited_on, edited_on
    RETURNING o.id INTO record_uuid;
    change_count := change_count + 1;
  END LOOP;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$bau$;

-- Current domain content: these queries also work after COMMIT and on a repeat run.
SELECT o.identifier, o.name_de AS objekt, substring(o.comment from 'Priorität: [^ ]+') AS prioritaet,
  array_to_string(o.normative_references, ', ') AS standards
FROM catalog.business_object o JOIN catalog.domain d ON d.id = o.domain_id
WHERE d.identifier = 'bau' ORDER BY o.identifier;

COMMIT;
