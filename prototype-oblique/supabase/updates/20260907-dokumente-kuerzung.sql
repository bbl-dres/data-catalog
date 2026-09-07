-- Dokumente Management review, 7 September 2026: Version, Workflow, Anweisung and
-- Nachricht are removed again. The four records were created earlier the same day by
-- dokumentenmanagement-20260907-v1, are still at revision 1 and are referenced by no
-- attribute, relationship, code list or change event; the identity guard is disabled for
-- exactly these validated deletes and re-enabled immediately. The comments of the domain
-- and of the thirteen remaining new objects are compacted: no source lines and no MoSCoW
-- tag - only group, priority, primary identification and the substantive note.
-- Standalone content update AFTER architektonische-sicht-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 18 record changes: 4 deletes, 1 domain update and 13 comment updates; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/references abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $kuerzung$
DECLARE
  operation_id constant text := 'dokumente-kuerzung-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Review Dokumente Management, 7. September 2026",
  "requiresOperation": "architektonische-sicht-20260907-v1",
  "expectedChanges": 18,
  "changes": [
    {
      "kind": "domain",
      "id": "dokumente",
      "revision": 1,
      "before": {
        "description_de": "Strukturierte Erfassung, Verwaltung, Bereitstellung und langfristige Archivierung dokumentenbezogener Informationen: Dokumente, Dossiers, Versionen, Metadaten, Workflows und Archivgut.",
        "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\n\nElf Geschäftsobjekte in fünf Gruppen (Dokumentstruktur, Metadaten, Prozesse, Archivierung, Kommunikation), priorisiert nach MoSCoW: vier Muss, vier Soll, drei Kann. Physisches Archiv und Datei werden bewusst nicht modelliert; der Fokus liegt auf digitaler Dokumentation, und die Datei ist Teil des Dokument-Objekts. Attributprofile, Beziehungen (Dossier–Dokument, Version–Dokument, Verknüpfung zur Architektonischen Sicht) und Systemzuordnungen (ActaNova GEVER, CDE Bund, IBM FileNet/DALA) bleiben spätere Fachprofil-Arbeit."
      },
      "after": {
        "description_de": "Strukturierte Erfassung, Verwaltung, Bereitstellung und langfristige Archivierung dokumentenbezogener Informationen: Dokumente, Dossiers, Metadaten und Archivgut.",
        "comment": "Sieben Geschäftsobjekte in vier Gruppen (Dokumentstruktur, Metadaten, Archivierung, Organisation): drei Muss (Dokument, Dossier, Archivgut), drei Soll (Dokumenttyp, Metadatensatz, Registraturplan), ein Kann (Vorarchiv). Version, Workflow, Anweisung und Nachricht wurden nach Review vom 7. September 2026 nicht übernommen; Physisches Archiv und Datei werden bewusst nicht modelliert. Attributprofile und Beziehungen (Dossier–Dokument, Verknüpfung zur Architektonischen Sicht) bleiben spätere Fachprofil-Arbeit."
      }
    },
    {
      "kind": "business_object",
      "id": "dokument",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Dokumentstruktur; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: BBL-Dokument-ID / UUID\nZentrale Verwaltungseinheit für alle BBL-Informationen."
      },
      "after": {
        "comment": "Gruppe: Dokumentstruktur; Priorität: Muss\nPrimäre Identifikation: BBL-Dokument-ID / UUID\nZentrale Verwaltungseinheit für alle BBL-Informationen."
      }
    },
    {
      "kind": "business_object",
      "id": "dossier",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Dokumentstruktur; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: BBL-Dossier-ID / UUID\nOrganisationseinheit für Geschäftsfälle und Projekte."
      },
      "after": {
        "comment": "Gruppe: Dokumentstruktur; Priorität: Muss\nPrimäre Identifikation: BBL-Dossier-ID / UUID\nOrganisationseinheit für Geschäftsfälle und Projekte."
      }
    },
    {
      "kind": "business_object",
      "id": "dokumenttyp",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Dokumentstruktur; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: Dokumenttypcode (DTC)\nStrukturiert Dokumentablage nach Leistungsbereichen."
      },
      "after": {
        "comment": "Gruppe: Dokumentstruktur; Priorität: Soll\nPrimäre Identifikation: Dokumenttypcode (DTC)\nStrukturiert Dokumentablage nach Leistungsbereichen."
      }
    },
    {
      "kind": "business_object",
      "id": "metadatensatz",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Metadaten; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: BBL-Metadaten-ID\nFlexibles Metadatenmanagement."
      },
      "after": {
        "comment": "Gruppe: Metadaten; Priorität: Soll\nPrimäre Identifikation: BBL-Metadaten-ID\nFlexibles Metadatenmanagement."
      }
    },
    {
      "kind": "business_object",
      "id": "archivgut",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Archivierung; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: BBL-Archiv-ID\nEndstatus wertvoller Dokumente."
      },
      "after": {
        "comment": "Gruppe: Archivierung; Priorität: Muss\nPrimäre Identifikation: BBL-Archiv-ID\nEndstatus wertvoller Dokumente."
      }
    },
    {
      "kind": "business_object",
      "id": "vorarchiv",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Archivierung; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: BBL-Vorarchiv-ID\nÜbergangsbereich vor Archivierung."
      },
      "after": {
        "comment": "Gruppe: Archivierung; Priorität: Kann\nPrimäre Identifikation: BBL-Vorarchiv-ID\nÜbergangsbereich vor Archivierung."
      }
    },
    {
      "kind": "business_object",
      "id": "registraturplan",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Organisation; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: BBL-Registratur-ID\nBasis für Ablagestruktur."
      },
      "after": {
        "comment": "Gruppe: Organisation; Priorität: Soll\nPrimäre Identifikation: BBL-Registratur-ID\nBasis für Ablagestruktur."
      }
    },
    {
      "kind": "business_object",
      "id": "parkplatz",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Räumliche Objekte; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: Parkplatz-ID\nWerden in Reservierungssystemen genutzt."
      },
      "after": {
        "comment": "Gruppe: Räumliche Objekte; Priorität: Soll\nPrimäre Identifikation: Parkplatz-ID\nWerden in Reservierungssystemen genutzt."
      }
    },
    {
      "kind": "business_object",
      "id": "baurecht",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Rechtliche Objekte; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: EREID\nFür komplexe Rechtsverhältnisse; selbständiges und dauerndes Recht gemäss Art. 779–779l ZGB."
      },
      "after": {
        "comment": "Gruppe: Rechtliche Objekte; Priorität: Kann\nPrimäre Identifikation: EREID\nFür komplexe Rechtsverhältnisse; selbständiges und dauerndes Recht gemäss Art. 779–779l ZGB."
      }
    },
    {
      "kind": "business_object",
      "id": "dienstbarkeit",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Rechtliche Objekte; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: EREID\nFür Zugangs- und Leitungsrechte gemäss Art. 730–792 ZGB."
      },
      "after": {
        "comment": "Gruppe: Rechtliche Objekte; Priorität: Kann\nPrimäre Identifikation: EREID\nFür Zugangs- und Leitungsrechte gemäss Art. 730–792 ZGB."
      }
    },
    {
      "kind": "business_object",
      "id": "technische-anlage",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Technische Objekte; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: Anlage-ID\nIst ein Typ von System (Ausprägung). Die zwölf Spezialisierungen (Heizungs-, Lüftungs-, Kälte-, Elektro-, Beleuchtungs-, Sanitär-, Aufzugs-, Brandschutz-, Sicherheits-, Kommunikations-, Gebäudeautomations- und Energieerzeugungsanlage) mit typspezifischen IFC-/eBKP-H-Attributen bleiben spätere Typprofil-Arbeit. Bewirtschaftungsprozesse wie Instandhaltung und Wartung gehören zum Objektmanagement."
      },
      "after": {
        "comment": "Gruppe: Technische Objekte; Priorität: Muss\nPrimäre Identifikation: Anlage-ID\nIst ein Typ von System (Ausprägung). Die zwölf Spezialisierungen (Heizungs-, Lüftungs-, Kälte-, Elektro-, Beleuchtungs-, Sanitär-, Aufzugs-, Brandschutz-, Sicherheits-, Kommunikations-, Gebäudeautomations- und Energieerzeugungsanlage) mit typspezifischen IFC-/eBKP-H-Attributen bleiben spätere Typprofil-Arbeit. Bewirtschaftungsprozesse wie Instandhaltung und Wartung gehören zum Objektmanagement."
      }
    },
    {
      "kind": "business_object",
      "id": "technische-komponente",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Technische Objekte; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: Komponenten-ID\nFür Wartung und Betrieb. Der Quellname im Fachkonzept lautet Komponente; typspezifische Attribute (IFC, IBPDI) bleiben spätere Typprofil-Arbeit. Bewirtschaftungsprozesse gehören zum Objektmanagement."
      },
      "after": {
        "comment": "Gruppe: Technische Objekte; Priorität: Muss\nPrimäre Identifikation: Komponenten-ID\nFür Wartung und Betrieb. Der Quellname im Fachkonzept lautet Komponente; typspezifische Attribute (IFC, IBPDI) bleiben spätere Typprofil-Arbeit. Bewirtschaftungsprozesse gehören zum Objektmanagement."
      }
    },
    {
      "kind": "business_object",
      "id": "bauteil",
      "revision": 1,
      "before": {
        "comment": "Fachkonzept Architektonische Sicht (EA-IMMO). prototype-datamodel/docs/Architektonische Sicht.md; Stand 7. September 2026\nGruppe: Konstruktive Objekte; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: Bauteil-ID\nÜbergeordnete Klasse für alle konstruktiven Elemente. Die zehn Spezialisierungen (Wand, Decke/Bodenplatte, Dach, Stütze, Träger/Balken, Fundament, Treppe, Tür, Fenster, Fassade) und der Bauteiltyp (IfcBuildingElementType) mit typspezifischen IFC-/eBKP-H-Attributen bleiben spätere Typprofil-Arbeit."
      },
      "after": {
        "comment": "Gruppe: Konstruktive Objekte; Priorität: Soll\nPrimäre Identifikation: Bauteil-ID\nÜbergeordnete Klasse für alle konstruktiven Elemente. Die zehn Spezialisierungen (Wand, Decke/Bodenplatte, Dach, Stütze, Träger/Balken, Fundament, Treppe, Tür, Fenster, Fassade) und der Bauteiltyp (IfcBuildingElementType) mit typspezifischen IFC-/eBKP-H-Attributen bleiben spätere Typprofil-Arbeit."
      }
    }
  ],
  "remove": [
    {
      "id": "dokumentversion",
      "name": "Version",
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Dokumentstruktur; Priorität: Muss (MoSCoW)\nPrimäre Identifikation: BBL-Version-ID\nFür Nachvollziehbarkeit und Änderungsmanagement; jede Version gehört zu genau einem Dokument."
    },
    {
      "id": "workflow",
      "name": "Workflow",
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Prozesse; Priorität: Soll (MoSCoW)\nPrimäre Identifikation: BBL-Workflow-ID\nSteuert Dokumentenlebenszyklen."
    },
    {
      "id": "anweisung",
      "name": "Anweisung",
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Prozesse; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: BBL-Anweisung-ID\nDirective gemäss eCH-0039."
    },
    {
      "id": "nachricht",
      "name": "Nachricht",
      "comment": "Fachkonzept Dokumentenmanagement (EA-IMMO). prototype-datamodel/docs/Dokumentenmanagement.md; Stand 7. September 2026\nGruppe: Kommunikation; Priorität: Kann (MoSCoW)\nPrimäre Identifikation: BBL-Nachricht-ID\nTransportcontainer für Austausch."
    }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  raw_before jsonb;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  assignments text;
  change_count integer := 0;
  removed integer;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete review update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Review operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Dokumente Management review already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the Architektonische Sicht objects first';
  END IF;

  -- Validate the entire reviewed scope before changing any row.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    IF item->>'kind' NOT IN ('domain','business_object')
      OR EXISTS (SELECT FROM jsonb_object_keys(item->'after') AS field(name)
        WHERE field.name NOT IN ('description_de','comment')) THEN
      RAISE EXCEPTION 'Unexpected review-update scope';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM catalog.%I t WHERE identifier = $1 FOR UPDATE', item->>'kind')
      INTO raw_before USING item->>'id';
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR NOT raw_before @> (item->'before') THEN
      RAISE EXCEPTION 'Stale review baseline for %; review intervening changes', item->>'id';
    END IF;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'remove') LOOP
    SELECT to_jsonb(o) INTO raw_before FROM catalog.business_object o WHERE o.identifier = item->>'id' FOR UPDATE;
    IF raw_before IS NULL OR raw_before->>'status' <> 'draft' OR (raw_before->>'row_version')::bigint <> 1
      OR raw_before->>'comment' IS DISTINCT FROM item->>'comment' OR raw_before->>'name_de' IS DISTINCT FROM item->>'name' THEN
      RAISE EXCEPTION 'Record % is not the untouched creation; review before removing', item->>'id';
    END IF;
    record_uuid := (raw_before->>'id')::uuid;
    IF EXISTS (SELECT FROM catalog.business_attribute WHERE business_object_id = record_uuid)
      OR EXISTS (SELECT FROM catalog.relationship WHERE source_business_object_id = record_uuid OR target_business_object_id = record_uuid)
      OR EXISTS (SELECT FROM catalog.code_list WHERE business_object_id = record_uuid)
      OR EXISTS (SELECT FROM catalog.lineage_relation WHERE to_jsonb(lineage_relation)::text LIKE '%' || record_uuid || '%') THEN
      RAISE EXCEPTION 'Record % is referenced; retire it instead of removing it', item->>'id';
    END IF;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    EXECUTE format('SELECT to_jsonb(t) FROM catalog.%I t WHERE identifier = $1 FOR UPDATE', item->>'kind')
      INTO STRICT raw_before USING item->>'id';
    record_uuid := (raw_before->>'id')::uuid;
    SELECT string_agg(format('%I = ($1->>%L)', field.name, field.name), ', ' ORDER BY field.name)
      INTO assignments FROM jsonb_object_keys(item->'after') AS field(name);
    EXECUTE format('UPDATE catalog.%I AS t SET %s, modified_on = $2 WHERE id = $3 AND row_version = $4 RETURNING to_jsonb(t)',
      item->>'kind', assignments)
      INTO STRICT raw_before USING item->'after', edited_on, record_uuid, (item->>'revision')::bigint;
    change_count := change_count + 1;
  END LOOP;

  -- The identity guard forbids deletes by design; it is disabled only for these four
  -- validated same-day creations and re-enabled before anything else happens.
  ALTER TABLE catalog.business_object DISABLE TRIGGER b_guard_record;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'remove') LOOP
    DELETE FROM catalog.business_object WHERE identifier = item->>'id' AND status = 'draft' AND row_version = 1;
    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one removable record for %', item->>'id';
    END IF;
    change_count := change_count + 1;
  END LOOP;
  ALTER TABLE catalog.business_object ENABLE TRIGGER b_guard_record;

  IF (SELECT count(*) FROM catalog.business_object o JOIN catalog.domain d ON d.id = o.domain_id
    WHERE d.identifier = 'dokumente') <> 7 THEN
    RAISE EXCEPTION 'Unexpected Dokumente Management object count; rolling back';
  END IF;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$kuerzung$;

-- Current domain content: these queries also work after COMMIT and on a repeat run.
SELECT d.identifier AS domain, d.name_de,
  (SELECT count(*) FROM catalog.business_object o WHERE o.domain_id = d.id) AS objekte
FROM catalog.domain d ORDER BY d.identifier;

SELECT o.identifier, o.name_de AS objekt, substring(o.comment from 'Priorität: [^\n]+') AS prioritaet
FROM catalog.business_object o JOIN catalog.domain d ON d.id = o.domain_id
WHERE d.identifier = 'dokumente' ORDER BY o.identifier;

COMMIT;
