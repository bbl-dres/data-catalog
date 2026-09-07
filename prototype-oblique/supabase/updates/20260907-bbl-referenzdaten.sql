-- BBL Referenzdaten from the SAP F4 value helps captured on 7 September 2026:
-- creates Teilportfolio (BBL), Gebäudeart 1 (BBL), Gebäudeart 2 (BBL) and Mietmodell (BBL)
-- with 145 values, renames the Eigentumsart list to Eigentumsart (BBL) and records the
-- confirmed SAP codes 01/03/05, binds Teilportfolio (BBL) to the Gebäude and Grundstück
-- Teilportfolio attributes, references both Gebäudeart lists from the Gebäudeart attribute,
-- and links the eight GIS source fields (bbl_gbda1/2, bbl_port ×3, bbl_eigen ×3) whose
-- documented origin is this SAP master data to their lists.
-- Source evidence: docs/sources/sap-refx/2026-09-07-sap-f4-referenzdaten.json; SAP-F4-Werthilfen, 7. September 2026.
-- Two Gebäudeart-2 Langtexte are stored truncated and flagged; 02.05 is absent from the capture.
-- Standalone content update AFTER business-object-geometry-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 164 record edits/creates: 5 updates, 4 list creates, 145 value creates,
-- 2 attribute bindings and 8 field bindings.
-- No change-log entries are generated. Existing IDs, history and grants survive.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $referenzdaten$
DECLARE
  operation_id constant text := 'bbl-referenzdaten-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "docs/sources/sap-refx/2026-09-07-sap-f4-referenzdaten.json; SAP-F4-Werthilfen, 7. September 2026",
  "requiresOperation": "business-object-geometry-20260907-v1",
  "expectedChanges": 164,
  "changes": [
    {
      "kind": "code_list",
      "id": "profile-eigentumsart",
      "revision": 1,
      "before": {
        "name_de": "BBL Eigentumsart",
        "description_de": "Vorgegebene BBL-Bewirtschaftungskategorien für Gebäude und Grundstücke. Die lokalen Codes verwenden die vereinbarten Bezeichnungen; technische SAP-Codes und ihre Abbildung bleiben zu bestätigen. Keine grundbuchliche Eigentumsform."
      },
      "after": {
        "name_de": "Eigentumsart (BBL)",
        "description_de": "Vorgegebene BBL-Bewirtschaftungskategorien für Gebäude und Grundstücke. Die lokalen Codes verwenden die vereinbarten Bezeichnungen; die SAP-Codes 01 (Eigentum Bund), 03 (Mietobjekt) und 05 (Spezialfall) sind durch die F4-Werthilfe vom 7. September 2026 bestätigt, ihre technische Abbildung bleibt zu dokumentieren. Keine grundbuchliche Eigentumsform."
      }
    },
    {
      "kind": "code_value",
      "id": "profile-eigentumsart/Anmiete",
      "revision": 1,
      "before": {
        "comment": "Lokaler Entwurfswert. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "comment": "Lokaler Entwurfswert. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Code 03 (Langtext «Mietobjekt») gemäss F4-Werthilfe vom 7. September 2026; technische Abbildung im Quellsystem bleibt zu dokumentieren. docs/sources/sap-refx/2026-09-07-sap-f4-referenzdaten.json; SAP-F4-Werthilfen, 7. September 2026"
      }
    },
    {
      "kind": "code_value",
      "id": "profile-eigentumsart/Eigentum",
      "revision": 1,
      "before": {
        "comment": "Lokaler Entwurfswert. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "comment": "Lokaler Entwurfswert. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Code 01 (Langtext «Eigentum Bund») gemäss F4-Werthilfe vom 7. September 2026; technische Abbildung im Quellsystem bleibt zu dokumentieren. docs/sources/sap-refx/2026-09-07-sap-f4-referenzdaten.json; SAP-F4-Werthilfen, 7. September 2026"
      }
    },
    {
      "kind": "code_value",
      "id": "profile-eigentumsart/Spezialfall",
      "revision": 1,
      "before": {
        "comment": "Lokaler Entwurfswert. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "comment": "Lokaler Entwurfswert. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Code 05 (Langtext «Spezialfall») gemäss F4-Werthilfe vom 7. September 2026; technische Abbildung im Quellsystem bleibt zu dokumentieren. docs/sources/sap-refx/2026-09-07-sap-f4-referenzdaten.json; SAP-F4-Werthilfen, 7. September 2026"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudeart",
      "revision": 2,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\nProperty Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Erforderlich im abgestimmten Geltungsbereich der BBL-Gebäudeklassifikation; ungeklärte Zuordnungen bleiben offen."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\nProperty Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Erforderlich im abgestimmten Geltungsbereich der BBL-Gebäudeklassifikation; ungeklärte Zuordnungen bleiben offen.\nReferenzlisten: Gebäudeart 1 (BBL) und Gebäudeart 2 (BBL) gemäss SAP-F4-Werthilfe vom 7. September 2026; Stufe-2-Codes tragen den Präfix ihrer Stufe 1. Verbindliche Zuordnung, Vokabularstand und Customizing-Nachweis bleiben zu bestätigen."
      }
    }
  ],
  "createLists": [
    {
      "id": "r-bbl-teilportfolio",
      "name": "Teilportfolio (BBL)",
      "object": "gebaeude",
      "description": "BBL-Teilportfolio-Werteliste gemäss SAP-F4-Werthilfe (GOM, Gruppe Objektmerkmale) vom 7. September 2026 mit zehn Werten. Gilt für Gebäude und Grundstücke; Teilportfoliogruppe bleibt eine separate Angabe. System-/Mandantenkontext und Customizing-Tabelle sind noch zu dokumentieren.",
      "values": [
        {
          "code": "001",
          "name": "Allgemeine Bundesverwaltung"
        },
        {
          "code": "002",
          "name": "Ausland"
        },
        {
          "code": "003",
          "name": "Zoll"
        },
        {
          "code": "004",
          "name": "Gerichte"
        },
        {
          "code": "005",
          "name": "Forschungsanstalten"
        },
        {
          "code": "006",
          "name": "Kunst und Kultur"
        },
        {
          "code": "007",
          "name": "Sport"
        },
        {
          "code": "008",
          "name": "Repräsentation Inland"
        },
        {
          "code": "009",
          "name": "Infrastruktur"
        },
        {
          "code": "010",
          "name": "SEM"
        }
      ]
    },
    {
      "id": "r-bbl-gebaeudeart-1",
      "name": "Gebäudeart 1 (BBL)",
      "object": "gebaeude",
      "description": "BBL-Gebäudeklassifikation Stufe 1 gemäss SAP-F4-Werthilfe vom 7. September 2026 mit 21 Werten. Fachlich getrennt von Hauptnutzung und den GWR-Klassifikationen; Vokabularstand und Customizing-Nachweis bleiben zu bestätigen.",
      "values": [
        {
          "code": "01",
          "name": "Wohnen"
        },
        {
          "code": "02",
          "name": "Unterricht, Bildung und Forschung"
        },
        {
          "code": "03",
          "name": "Industrie und Gewerbe"
        },
        {
          "code": "04",
          "name": "Land- und Forstwirtschaft"
        },
        {
          "code": "05",
          "name": "Technische Anlagen"
        },
        {
          "code": "06",
          "name": "Handel und Verwaltung"
        },
        {
          "code": "07",
          "name": "Justiz und Polizei"
        },
        {
          "code": "08",
          "name": "Fürsorge und Gesundheit"
        },
        {
          "code": "09",
          "name": "Kultus"
        },
        {
          "code": "10",
          "name": "Kultur und Geselligkeit"
        },
        {
          "code": "11",
          "name": "Gastgewerbe und Fremdenverkehr"
        },
        {
          "code": "12",
          "name": "Freizeit, Sport, Erholung"
        },
        {
          "code": "13",
          "name": "Verkehrsanlagen"
        },
        {
          "code": "14",
          "name": "Militär- und Schutzanlagen"
        },
        {
          "code": "15",
          "name": "Militärische Objekte mit Schutz gegen Waffenwirkung"
        },
        {
          "code": "16",
          "name": "Gebäude im Ausland"
        },
        {
          "code": "17",
          "name": "Allgemeine Objektumgebung"
        },
        {
          "code": "18",
          "name": "Natur-Verbauungen, Umwelt-Bauwerke"
        },
        {
          "code": "19",
          "name": "Gebäude Repräsentation Inland"
        },
        {
          "code": "20",
          "name": "Mieterspezifischer Ausbau AA + EE (BKP6) / 5 Jahre"
        },
        {
          "code": "21",
          "name": "Ausbau bei Zumiete EE / Nutzung nach Vertragsdauer"
        }
      ]
    },
    {
      "id": "r-bbl-gebaeudeart-2",
      "name": "Gebäudeart 2 (BBL)",
      "object": "gebaeude",
      "description": "BBL-Gebäudeklassifikation Stufe 2 gemäss SAP-F4-Werthilfe vom 7. September 2026 mit 100 erfassten Werten; die Codes tragen den Präfix ihrer Stufe 1. Zwei Langtexte sind im Screenshot abgeschnitten und entsprechend gekennzeichnet; 02.05 fehlt in der Erfassung. Vollständigkeit, Vokabularstand und Customizing-Nachweis bleiben zu bestätigen.",
      "values": [
        {
          "code": "01.01",
          "name": "Wohnungen"
        },
        {
          "code": "01.02",
          "name": "Mehrfamilienhäuser"
        },
        {
          "code": "01.03",
          "name": "Einfamilienhäuser"
        },
        {
          "code": "01.04",
          "name": "Grenzwacht-Stützpunkt"
        },
        {
          "code": "01.05",
          "name": "Residenzgebäude"
        },
        {
          "code": "02.01",
          "name": "Schulen"
        },
        {
          "code": "02.02",
          "name": "Bibliotheken"
        },
        {
          "code": "02.03",
          "name": "Staatsarchive"
        },
        {
          "code": "02.04",
          "name": "Forschungs-/laborgebäude"
        },
        {
          "code": "02.06",
          "name": "Ausbildungsbauten BAZG"
        },
        {
          "code": "03.01",
          "name": "Lagerhallen"
        },
        {
          "code": "03.02",
          "name": "Mechanisierte Lager, Kühllager"
        },
        {
          "code": "03.03",
          "name": "Silobauten"
        },
        {
          "code": "03.04",
          "name": "Industriehallen"
        },
        {
          "code": "03.05",
          "name": "Gewerbebauten und Werkstätten"
        },
        {
          "code": "03.06",
          "name": "Revisionsgarage"
        },
        {
          "code": "04.01",
          "name": "Schuppen, Hütten"
        },
        {
          "code": "04.02",
          "name": "Futterlagerräume, Treibhäuser"
        },
        {
          "code": "04.03",
          "name": "Stallungen, landwirtschaftliche Prod.anl."
        },
        {
          "code": "04.04",
          "name": "Ökonomiegebäude inkl. Wohnanteil"
        },
        {
          "code": "04.05",
          "name": "Veterinärstationen"
        },
        {
          "code": "05.01",
          "name": "Heizzentralen, Fernwärmanlagen, Kraftwerkbauten"
        },
        {
          "code": "05.02",
          "name": "Kraftwerkbauten/Stromversorgung"
        },
        {
          "code": "05.03",
          "name": "Tankanlagen"
        },
        {
          "code": "05.04",
          "name": "Antennen / Radar"
        },
        {
          "code": "05.05",
          "name": "Telefonzentralen"
        },
        {
          "code": "05.06",
          "name": "KOMBV-Räume"
        },
        {
          "code": "05.07",
          "name": "Wasseraufbereitungsanlagen"
        },
        {
          "code": "05.08",
          "name": "Kläranlagen"
        },
        {
          "code": "05.09",
          "name": "WC-Anlage"
        },
        {
          "code": "05.10",
          "name": "Brückenwaagen"
        },
        {
          "code": "05.11",
          "name": "Messfelder"
        },
        {
          "code": "05.12",
          "name": "Kamerastandorte"
        },
        {
          "code": "05.13",
          "name": "Kontrollturm"
        },
        {
          "code": "05.14",
          "name": "Lysimeteranlage"
        },
        {
          "code": "05.15",
          "name": "Infrastrukturgefäss"
        },
        {
          "code": "06.01",
          "name": "Bürobauten, Verwaltungsgebäude"
        },
        {
          "code": "06.02",
          "name": "Rechenzentren"
        },
        {
          "code": "06.03",
          "name": "Rathäuser"
        },
        {
          "code": "06.04",
          "name": "Abfertigungspavillon"
        },
        {
          "code": "06.05",
          "name": "Ausfuhrgebäude"
        },
        {
          "code": "06.06",
          "name": "Bürocontainer"
        },
        {
          "code": "06.07",
          "name": "Einfuhrgebäude"
        },
        {
          "code": "06.08",
          "name": "Grenzwachtposten"
        },
        {
          "code": "06.09",
          "name": "Kontrollkabine"
        },
        {
          "code": "06.10",
          "name": "Revisionsgebäude"
        },
        {
          "code": "06.11",
          "name": "Transitgebäude"
        },
        {
          "code": "06.12",
          "name": "Interventionszentrum"
        },
        {
          "code": "06.13",
          "name": "Stützpunkt"
        },
        {
          "code": "06.14",
          "name": "Interventionsstandort"
        },
        {
          "code": "06.15",
          "name": "Interventionsplatz plus"
        },
        {
          "code": "06.16",
          "name": "Interventionsplatz"
        },
        {
          "code": "07.01",
          "name": "Gerichtsgebäude"
        },
        {
          "code": "08.01",
          "name": "Krankenhäuser"
        },
        {
          "code": "09.01",
          "name": "Kirchen, Kapellen, Abdankungshallen"
        },
        {
          "code": "09.02",
          "name": "Klöster"
        },
        {
          "code": "10.01",
          "name": "Museen, Ausstellungsbauten"
        },
        {
          "code": "10.02",
          "name": "Kinotheater, Diskotheken, Saalbauten"
        },
        {
          "code": "10.03",
          "name": "Kongresshäuser"
        },
        {
          "code": "10.04",
          "name": "Radio-, Fernseh, Filmstudios"
        },
        {
          "code": "10.05",
          "name": "Historisches Geb. ohne spez. Nutzung"
        },
        {
          "code": "11.01",
          "name": "Restaurationsbetriebe"
        },
        {
          "code": "11.02",
          "name": "Unterkunftsgebäude"
        },
        {
          "code": "11.03",
          "name": "Hotel- und Motelbauten"
        },
        {
          "code": "11.04",
          "name": "Bundesasylzentren"
        },
        {
          "code": "12.01",
          "name": "Turn und Sporthallen, Mehrzweckhallen"
        },
        {
          "code": "12.02",
          "name": "Stadionanlagen, Sportplätze"
        },
        {
          "code": "12.03",
          "name": "Tribünenbauten, Garderobengebäude"
        },
        {
          "code": "12.04",
          "name": "Offene Kunsteisbahnen, Freibäder"
        },
        {
          "code": "12.05",
          "name": "Kunsteishallen"
        },
        {
          "code": "12.06",
          "name": "Hallenbäder"
        },
        {
          "code": "12.07",
          "name": "Reithallen"
        },
        {
          "code": "12.08",
          "name": "Bootshäuser"
        },
        {
          "code": "12.09",
          "name": "Pärke (betriebsnotwendig)"
        },
        {
          "code": "12.10",
          "name": "Pärke (nicht betriebsnotwendig)"
        },
        {
          "code": "12.11",
          "name": "Aussichtsturm"
        },
        {
          "code": "13.01",
          "name": "Eingeschossige Einstellgaragen"
        },
        {
          "code": "13.02",
          "name": "Parkhäuser"
        },
        {
          "code": "13.03",
          "name": "Parkplätze"
        },
        {
          "code": "13.04",
          "name": "Werkhöfe"
        },
        {
          "code": "13.05",
          "name": "Autobahnzollanlagen"
        },
        {
          "code": "13.06",
          "name": "Tankstellen, Wartehallen mit Diensträumen, Zollposten, Busba…",
          "comment": "Langtext im Screenshot abgeschnitten; vollständige Bezeichnung noch zu ergänzen."
        },
        {
          "code": "13.07",
          "name": "Seilbahnstation"
        },
        {
          "code": "13.08",
          "name": "Fahrradunterstand"
        },
        {
          "code": "14.01",
          "name": "Öffentliche Zivilschutzanlagen, Kommandoposten, Bereitstellu…",
          "comment": "Langtext im Screenshot abgeschnitten; vollständige Bezeichnung noch zu ergänzen."
        },
        {
          "code": "14.02",
          "name": "Zivilschutz-Ausbildungszentren"
        },
        {
          "code": "14.03",
          "name": "Kavernen"
        },
        {
          "code": "15.00",
          "name": "Militärische Objekte mit Schutz gegen Waffenwirkung"
        },
        {
          "code": "16.01",
          "name": "Ausland: Wohnungen"
        },
        {
          "code": "16.02",
          "name": "Ausland: Residenzen"
        },
        {
          "code": "16.03",
          "name": "Ausland: Kanzleien"
        },
        {
          "code": "16.04",
          "name": "Ausland: Schulen"
        },
        {
          "code": "16.05",
          "name": "Ausland: Parkplätze"
        },
        {
          "code": "16.06",
          "name": "Ausland: Kultur"
        },
        {
          "code": "16.07",
          "name": "Ausland: Wissenschaft und Technologie"
        },
        {
          "code": "17.00",
          "name": "Allgemeine Objektumgebung"
        },
        {
          "code": "18.00",
          "name": "Natur-Verbauungen, Umwelt-Bauwerke"
        },
        {
          "code": "19.00",
          "name": "Gebäude Repräsentation Inland"
        },
        {
          "code": "20.00",
          "name": "Gemäss vertraglich festgelegter Nutzungsdauer"
        },
        {
          "code": "21.00",
          "name": "10 Jahre oder Zumietvertrag"
        }
      ]
    },
    {
      "id": "r-bbl-mietmodell",
      "name": "Mietmodell (BBL)",
      "object": "mietobjekt",
      "description": "Verrechnungsmodell Miete gemäss SAP-F4-Werthilfe vom 7. September 2026 mit 14 Werten. Referenzdaten ohne gebundenes Katalogattribut; die fachliche Zuordnung zu Mietobjekt oder Vertrag bleibt zu bestätigen. System-/Mandantenkontext und Customizing-Tabelle sind noch zu dokumentieren.",
      "values": [
        {
          "code": "1a",
          "name": "Marktorientiert - Primärgruppe"
        },
        {
          "code": "1b",
          "name": "Marktorientiert - Sekundärgruppe"
        },
        {
          "code": "1c",
          "name": "Marktorientiert - begr. Ausnahmen"
        },
        {
          "code": "2a",
          "name": "Kostenorientiert - Flughafen"
        },
        {
          "code": "2b",
          "name": "Kostenorientiert - zusätzl. FLAG"
        },
        {
          "code": "2c",
          "name": "Kostenorientiert mit Integration FLM"
        },
        {
          "code": "3",
          "name": "Zollbauten"
        },
        {
          "code": "3a",
          "name": "Zollbauten mit Integration FLM"
        },
        {
          "code": "4",
          "name": "Auslandsbauten EDA"
        },
        {
          "code": "4a",
          "name": "Auslandsbauten Wohnen"
        },
        {
          "code": "4b",
          "name": "Auslandsbauten Residenz"
        },
        {
          "code": "4c",
          "name": "Auslandsbauten Kanzlei"
        },
        {
          "code": "4d",
          "name": "Auslandsbauten übrige"
        },
        {
          "code": "5",
          "name": "Keine interne Verrechnung"
        }
      ]
    }
  ],
  "bind": [
    {
      "attribute": "gebaeude/teilportfolio",
      "list": "r-bbl-teilportfolio",
      "revision": 2
    },
    {
      "attribute": "grundstueck/teilportfolio",
      "list": "r-bbl-teilportfolio",
      "revision": 2
    }
  ],
  "bindFields": [
    {
      "field": "t-geb-gis/bbl_gbda1",
      "list": "r-bbl-gebaeudeart-1",
      "revision": 1
    },
    {
      "field": "t-geb-gis/bbl_gbda2",
      "list": "r-bbl-gebaeudeart-2",
      "revision": 1
    },
    {
      "field": "t-geb-gis/bbl_port",
      "list": "r-bbl-teilportfolio",
      "revision": 1
    },
    {
      "field": "t-parzelle/bbl_port",
      "list": "r-bbl-teilportfolio",
      "revision": 1
    },
    {
      "field": "t-gis-green-area/bbl_port",
      "list": "r-bbl-teilportfolio",
      "revision": 1
    },
    {
      "field": "t-geb-gis/bbl_eigen",
      "list": "profile-eigentumsart",
      "revision": 1
    },
    {
      "field": "t-parzelle/bbl_eigen",
      "list": "profile-eigentumsart",
      "revision": 1
    },
    {
      "field": "t-gis-green-area/bbl_eigen",
      "list": "profile-eigentumsart",
      "revision": 1
    }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  child jsonb;
  raw_before jsonb;
  record_uuid uuid;
  object_uuid uuid;
  list_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  assignments text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete reference-data update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Reference-data operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'BBL Referenzdaten already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the 106-attribute synchronization first';
  END IF;

  -- Validate the entire reviewed scope before changing any row.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    IF item->>'kind' NOT IN ('business_attribute','code_list','code_value')
      OR EXISTS (SELECT FROM jsonb_object_keys(item->'after') AS field(name)
        WHERE field.name NOT IN ('name_de','description_de','comment'))
      OR (item->'after') = '{}'::jsonb THEN
      RAISE EXCEPTION 'Unexpected reference-data update scope';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM catalog.%I t WHERE identifier = $1 FOR UPDATE', item->>'kind')
      INTO raw_before USING item->>'id';
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR NOT raw_before @> (item->'before') THEN
      RAISE EXCEPTION 'Stale reference-data baseline for %; review intervening changes', item->>'id';
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM catalog.code_list WHERE identifier IN
      (SELECT l->>'id' FROM jsonb_array_elements(proposal->'createLists') l))
    OR EXISTS (SELECT FROM catalog.code_value WHERE identifier IN
      (SELECT (l->>'id') || '/' || (v->>'code') FROM jsonb_array_elements(proposal->'createLists') l,
        LATERAL jsonb_array_elements(l->'values') v)) THEN
    RAISE EXCEPTION 'A proposed new list/value identifier already exists; refusing to overwrite it';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'bind') LOOP
    SELECT to_jsonb(a) INTO raw_before FROM catalog.business_attribute a WHERE a.identifier = item->>'attribute' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'code_list_id' IS NOT NULL THEN
      RAISE EXCEPTION 'Expected unbound attribute % at its reviewed revision', item->>'attribute';
    END IF;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'bindFields') LOOP
    SELECT to_jsonb(f) INTO raw_before FROM catalog.data_field f WHERE f.identifier = item->>'field' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'code_list_id' IS NOT NULL THEN
      RAISE EXCEPTION 'Expected unbound source field % at its reviewed revision', item->>'field';
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

  -- Reference lists captured from the SAP F4 value helps; codes preserve leading zeros,
  -- dots and letters. Values have no reviewed definitions yet, only the SAP Langtext.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'createLists') LOOP
    SELECT id INTO STRICT object_uuid FROM catalog.business_object WHERE identifier = item->>'object';
    INSERT INTO catalog.code_list AS l
      (identifier, name_de, description_de, comment, business_object_id, status, created_on, modified_on)
    VALUES (item->>'id', item->>'name', item->>'description', proposal->>'source', object_uuid, 'draft', edited_on, edited_on)
    RETURNING l.id INTO list_uuid;
    change_count := change_count + 1;
    FOR child IN SELECT * FROM jsonb_array_elements(item->'values') LOOP
      INSERT INTO catalog.code_value AS v
        (identifier, code_list_id, code, name_de, comment, created_on, modified_on)
      VALUES ((item->>'id') || '/' || (child->>'code'), list_uuid, child->>'code', child->>'name',
        concat_ws(E'\n\n', child->>'comment', 'SAP-F4-Werthilfe. ' || (proposal->>'source')), edited_on, edited_on)
      RETURNING v.id INTO record_uuid;
      change_count := change_count + 1;
    END LOOP;
    IF (SELECT count(*) FROM catalog.code_value WHERE code_list_id = list_uuid)
      <> jsonb_array_length(item->'values') THEN
      RAISE EXCEPTION 'Unexpected value count for %; rolling back', item->>'id';
    END IF;
  END LOOP;

  -- The BBL-Werteliste now defines the Teilportfolio meaning on both objects.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'bind') LOOP
    SELECT id INTO STRICT list_uuid FROM catalog.code_list WHERE identifier = item->>'list';
    UPDATE catalog.business_attribute AS a SET code_list_id = list_uuid, modified_on = edited_on
      WHERE a.identifier = item->>'attribute' AND a.row_version = (item->>'revision')::bigint AND a.code_list_id IS NULL
      RETURNING a.id INTO STRICT record_uuid;
    change_count := change_count + 1;
  END LOOP;

  -- Documented source-field vocabularies: the GIS descriptions name this SAP master data.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'bindFields') LOOP
    SELECT id INTO STRICT list_uuid FROM catalog.code_list WHERE identifier = item->>'list';
    UPDATE catalog.data_field AS f SET code_list_id = list_uuid, modified_on = edited_on
      WHERE f.identifier = item->>'field' AND f.row_version = (item->>'revision')::bigint AND f.code_list_id IS NULL
      RETURNING f.id INTO STRICT record_uuid;
    change_count := change_count + 1;
  END LOOP;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$referenzdaten$;

-- Current reference lists: these queries also work after COMMIT and on a repeat run.
SELECT l.identifier AS liste, l.name_de, count(v.id) AS werte,
  count(*) FILTER (WHERE v.comment LIKE '%abgeschnitten%') AS abgeschnitten
FROM catalog.code_list l LEFT JOIN catalog.code_value v ON v.code_list_id = l.id
WHERE l.identifier IN ('profile-eigentumsart','r-bbl-teilportfolio','r-bbl-gebaeudeart-1','r-bbl-gebaeudeart-2','r-bbl-mietmodell')
GROUP BY l.identifier, l.name_de ORDER BY l.identifier;

SELECT a.identifier, a.name_de AS attribut, l.identifier AS werteliste
FROM catalog.business_attribute a LEFT JOIN catalog.code_list l ON l.id = a.code_list_id
WHERE a.identifier IN ('gebaeude/teilportfolio','grundstueck/teilportfolio','gebaeude/eigentumsart','grundstueck/eigentumsart','gebaeude/gebaeudeart')
ORDER BY a.identifier;

SELECT f.identifier AS feld, l.identifier AS werteliste
FROM catalog.data_field f LEFT JOIN catalog.code_list l ON l.id = f.code_list_id
WHERE f.identifier IN ('t-geb-gis/bbl_gbda1','t-geb-gis/bbl_gbda2','t-geb-gis/bbl_port','t-parzelle/bbl_port',
  't-gis-green-area/bbl_port','t-geb-gis/bbl_eigen','t-parzelle/bbl_eigen','t-gis-green-area/bbl_eigen')
ORDER BY f.identifier;

COMMIT;
