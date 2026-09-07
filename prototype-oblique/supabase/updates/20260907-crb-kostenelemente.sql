-- CRB Kostenelemente: fourteen new reference lists, one per eBKP-H Hauptgruppe
-- (A Grundstück ... Z Mehrwertsteuer), each carrying its Elementgruppen (two-digit)
-- and Elemente (four-digit) as values - 71 Elementgruppen and 328 Elemente in total,
-- parsed from the Verzeichnis 5.1 of the official excerpt (SN 506 511:2020) at
-- docs/sources/ebkp-h/Auszug_eBKP_2020_Web.pdf and cross-checked against the earlier
-- Hauptgruppe-D screenshot transcription. Evidence:
-- docs/sources/ebkp-h/2026-09-07-ebkph-kostenelemente.json.
-- Standalone content update AFTER flaechenarten-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 413 record changes: 14 lists and 399 values; no change-log entries.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $crb$
DECLARE
  operation_id constant text := 'crb-kostenelemente-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
 "revision": 1,
 "source": "eBKP-H (SN 506 511:2020) Verzeichnis 5.1, Auszug_eBKP_2020_Web.pdf; Ergänzung 7. September 2026",
 "requiresOperation": "flaechenarten-20260907-v1",
 "expectedChanges": 413,
 "createLists": [
  {
   "id": "r-crb-grundstueck",
   "name": "CRB Grundstück",
   "description": "Kostenelemente der eBKP-H Hauptgruppe A (Grundstück): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "A01",
     "name": "Grundstück, Baurecht"
    },
    {
     "code": "A01.01",
     "name": "Grundstückserwerb"
    },
    {
     "code": "A01.02",
     "name": "Baurechtserwerb"
    },
    {
     "code": "A01.03",
     "name": "Bauwerkserwerb"
    },
    {
     "code": "A01.04",
     "name": "Perimeterbeitrag"
    },
    {
     "code": "A02",
     "name": "Nebenkosten zu Grundstück, Baurecht"
    },
    {
     "code": "A02.01",
     "name": "Handänderungssteuer, Gewinnsteuer"
    },
    {
     "code": "A02.02",
     "name": "Notariatskosten"
    },
    {
     "code": "A02.03",
     "name": "Grundbuchgebühr"
    },
    {
     "code": "A02.04",
     "name": "Anwaltskosten, Gerichtskosten"
    },
    {
     "code": "A02.05",
     "name": "Vermittlungsprovision"
    },
    {
     "code": "A02.06",
     "name": "Abfindung, Servitut"
    },
    {
     "code": "A02.07",
     "name": "Vermessung, Vermarkung"
    }
   ]
  },
  {
   "id": "r-crb-vorbereitung",
   "name": "CRB Vorbereitung",
   "description": "Kostenelemente der eBKP-H Hauptgruppe B (Vorbereitung): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "B01",
     "name": "Untersuchung, Aufnahme, Messung"
    },
    {
     "code": "B01.01",
     "name": "Baugrunduntersuchung"
    },
    {
     "code": "B01.02",
     "name": "Bestandsaufnahme"
    },
    {
     "code": "B01.03",
     "name": "Umweltmessung"
    },
    {
     "code": "B01.04",
     "name": "Überwachung"
    },
    {
     "code": "B02",
     "name": "Baustelleneinrichtung"
    },
    {
     "code": "B02.01",
     "name": "Baustellenerschliessung"
    },
    {
     "code": "B02.02",
     "name": "Versorgung, Entsorgung"
    },
    {
     "code": "B02.03",
     "name": "Arbeitsraum, Aufenthaltsraum"
    },
    {
     "code": "B02.04",
     "name": "Hebe-, Verlade-, Transport-, Lagereinrichtung"
    },
    {
     "code": "B02.05",
     "name": "Einrichtung für Materialaufbereitung"
    },
    {
     "code": "B02.06",
     "name": "Witterungsbedingte Baumassnahme"
    },
    {
     "code": "B02.07",
     "name": "Baustellenorganisation, Sicherheit"
    },
    {
     "code": "B02.08",
     "name": "Schutzmassnahme für Umgebung"
    },
    {
     "code": "B03",
     "name": "Provisorium"
    },
    {
     "code": "B03.01",
     "name": "Provisorisches Rückhaltesystem"
    },
    {
     "code": "B03.02",
     "name": "Provisorische Werkleitung"
    },
    {
     "code": "B03.03",
     "name": "Provisorisches Gebäude"
    },
    {
     "code": "B03.04",
     "name": "Provisorische Verkehrsanlage"
    },
    {
     "code": "B03.05",
     "name": "Provisorischer Ausbau, Ausstattung"
    },
    {
     "code": "B04",
     "name": "Erschliessung durch Werkleitungen"
    },
    {
     "code": "B04.01",
     "name": "Starkstromleitung"
    },
    {
     "code": "B04.02",
     "name": "Schwachstromleitung"
    },
    {
     "code": "B04.03",
     "name": "Fernwärmeleitung"
    },
    {
     "code": "B04.04",
     "name": "Fernkälteleitung"
    },
    {
     "code": "B04.05",
     "name": "Wasserleitung"
    },
    {
     "code": "B04.06",
     "name": "Schmutzwasserleitung"
    },
    {
     "code": "B04.07",
     "name": "Regenwasserleitung"
    },
    {
     "code": "B04.08",
     "name": "Gasleitung"
    },
    {
     "code": "B05",
     "name": "Rodung, Rückbau"
    },
    {
     "code": "B05.01",
     "name": "Fällung, Rodung, Umpflanzung"
    },
    {
     "code": "B05.02",
     "name": "Nicht kontaminierter Rückbau"
    },
    {
     "code": "B05.03",
     "name": "Kontaminierter Rückbau"
    },
    {
     "code": "B06",
     "name": "Baugrube"
    },
    {
     "code": "B06.01",
     "name": "Nicht kontaminierter Aushub"
    },
    {
     "code": "B06.02",
     "name": "Kontaminierter Aushub"
    },
    {
     "code": "B06.03",
     "name": "Böschungssicherung"
    },
    {
     "code": "B06.04",
     "name": "Baugrubenabschluss"
    },
    {
     "code": "B06.05",
     "name": "Materialeinbau"
    },
    {
     "code": "B06.06",
     "name": "Wasserhaltung"
    },
    {
     "code": "B07",
     "name": "Baugrundverbesserung, Bauwerkssicherung"
    },
    {
     "code": "B07.01",
     "name": "Verbesserung Baugrund"
    },
    {
     "code": "B07.02",
     "name": "Pfählung"
    },
    {
     "code": "B07.03",
     "name": "Unterfangung Bauwerk"
    },
    {
     "code": "B07.04",
     "name": "Sicherung Bauwerk"
    },
    {
     "code": "B08",
     "name": "Gerüst"
    },
    {
     "code": "B08.01",
     "name": "Fassadengerüst"
    },
    {
     "code": "B08.02",
     "name": "Arbeitsgerüst"
    },
    {
     "code": "B08.03",
     "name": "Notdach"
    },
    {
     "code": "B08.04",
     "name": "Schutzgerüst"
    },
    {
     "code": "B09",
     "name": "Anpassung angrenzendes Bauwerk"
    },
    {
     "code": "B09.01",
     "name": "Bauliche Anpassung angrenzendes Bauwerk"
    },
    {
     "code": "B09.02",
     "name": "Unterfangung, Sicherung angrenzendes Bauwerk"
    },
    {
     "code": "B09.03",
     "name": "Verkehrsanlage ausserhalb Grundstück"
    }
   ]
  },
  {
   "id": "r-crb-konstruktion",
   "name": "CRB Konstruktion Gebäude",
   "description": "Kostenelemente der eBKP-H Hauptgruppe C (Konstruktion Gebäude): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "C01",
     "name": "Fundament, Bodenplatte"
    },
    {
     "code": "C01.01",
     "name": "Unterbau Fundament, Bodenplatte"
    },
    {
     "code": "C01.02",
     "name": "Fundament"
    },
    {
     "code": "C01.03",
     "name": "Bodenplatte"
    },
    {
     "code": "C01.04",
     "name": "Erdverbundene Treppe, Rampe"
    },
    {
     "code": "C01.05",
     "name": "Erdverbundenes Podest"
    },
    {
     "code": "C02",
     "name": "Wandkonstruktion"
    },
    {
     "code": "C02.01",
     "name": "Aussenwandkonstruktion"
    },
    {
     "code": "C02.02",
     "name": "Innenwandkonstruktion"
    },
    {
     "code": "C03",
     "name": "Stützenkonstruktion"
    },
    {
     "code": "C03.01",
     "name": "Aussenstütze"
    },
    {
     "code": "C03.02",
     "name": "Innenstütze"
    },
    {
     "code": "C04",
     "name": "Deckenkonstruktion, Dachkonstruktion"
    },
    {
     "code": "C04.01",
     "name": "Geschossdecke"
    },
    {
     "code": "C04.02",
     "name": "Innen liegende Treppe, Rampe"
    },
    {
     "code": "C04.03",
     "name": "Innen liegendes Podest"
    },
    {
     "code": "C04.04",
     "name": "Konstruktion Flachdach"
    },
    {
     "code": "C04.05",
     "name": "Konstruktion geneigtes Dach"
    },
    {
     "code": "C04.06",
     "name": "Aussen liegende Treppe, Rampe"
    },
    {
     "code": "C04.07",
     "name": "Aussen liegendes Podest"
    },
    {
     "code": "C04.08",
     "name": "Aussen liegende Konstruktion, Vordach"
    },
    {
     "code": "C05",
     "name": "Ergänzende Leistung zu Konstruktion"
    },
    {
     "code": "C05.01",
     "name": "Durchbruch, Schlitz zu Konstruktion"
    },
    {
     "code": "C05.02",
     "name": "Maschinensockel, Einlage"
    }
   ]
  },
  {
   "id": "r-crb-technik",
   "name": "CRB Technik Gebäude",
   "description": "Kostenelemente der eBKP-H Hauptgruppe D (Technik Gebäude): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "D01",
     "name": "Elektroanlage"
    },
    {
     "code": "D01.01",
     "name": "Anlage Erzeugung Starkstrom"
    },
    {
     "code": "D01.02",
     "name": "Transformierung Starkstrom"
    },
    {
     "code": "D01.03",
     "name": "Speicherung Starkstrom"
    },
    {
     "code": "D01.04",
     "name": "Installation Starkstrom"
    },
    {
     "code": "D01.05",
     "name": "Verbraucher Starkstrom: Leuchten"
    },
    {
     "code": "D01.06",
     "name": "Verbraucher Starkstrom: Elektrogeräte"
    },
    {
     "code": "D01.07",
     "name": "Anlage Erzeugung Schwachstrom"
    },
    {
     "code": "D01.08",
     "name": "Transformierung Schwachstrom"
    },
    {
     "code": "D01.09",
     "name": "Speicherung Schwachstrom"
    },
    {
     "code": "D01.10",
     "name": "Installation Schwachstrom"
    },
    {
     "code": "D01.11",
     "name": "Verbraucher Schwachstrom"
    },
    {
     "code": "D02",
     "name": "Gebäudeautomation"
    },
    {
     "code": "D02.01",
     "name": "Managementebene"
    },
    {
     "code": "D02.02",
     "name": "Automationsebene"
    },
    {
     "code": "D02.03",
     "name": "Feldebene"
    },
    {
     "code": "D02.04",
     "name": "Raumautomation"
    },
    {
     "code": "D02.05",
     "name": "Automationsnetzwerk"
    },
    {
     "code": "D02.06",
     "name": "Schaltgerätekombination"
    },
    {
     "code": "D02.07",
     "name": "Systemintegration"
    },
    {
     "code": "D03",
     "name": "Sicherheitsanlage"
    },
    {
     "code": "D03.01",
     "name": "Einbruchmeldeanlage, Überfallmeldeanlage"
    },
    {
     "code": "D03.02",
     "name": "Zutrittskontrollanlage"
    },
    {
     "code": "D03.03",
     "name": "Videoüberwachungsanlage"
    },
    {
     "code": "D03.04",
     "name": "Schliessanlage"
    },
    {
     "code": "D04",
     "name": "Technische Brandschutzanlage"
    },
    {
     "code": "D04.01",
     "name": "Brandmeldeanlage"
    },
    {
     "code": "D04.02",
     "name": "Gaswarnanlage"
    },
    {
     "code": "D04.03",
     "name": "Nasslöschanlage"
    },
    {
     "code": "D04.04",
     "name": "Trockenlöschanlage"
    },
    {
     "code": "D04.05",
     "name": "Löschgerät"
    },
    {
     "code": "D04.06",
     "name": "Rauch- und Wärmebehandlungsanlage"
    },
    {
     "code": "D04.07",
     "name": "Elektroakustische Lautsprecheranlage"
    },
    {
     "code": "D05",
     "name": "Wärmetechnische Anlage"
    },
    {
     "code": "D05.01",
     "name": "Wärmequelle, -senke, Brennstofflager"
    },
    {
     "code": "D05.02",
     "name": "Wärmeerzeugung"
    },
    {
     "code": "D05.03",
     "name": "Wärmespeicherung"
    },
    {
     "code": "D05.04",
     "name": "Wärmeverteilung"
    },
    {
     "code": "D05.05",
     "name": "Wärmeabgabe"
    },
    {
     "code": "D05.06",
     "name": "Wärmebezug: Investitionsanteil"
    },
    {
     "code": "D06",
     "name": "Kältetechnische Anlage"
    },
    {
     "code": "D06.01",
     "name": "Kältequelle, -senke, Brennstofflager"
    },
    {
     "code": "D06.02",
     "name": "Kälteerzeugung"
    },
    {
     "code": "D06.03",
     "name": "Kältespeicherung"
    },
    {
     "code": "D06.04",
     "name": "Kälteverteilung"
    },
    {
     "code": "D06.05",
     "name": "Kälteabgabe"
    },
    {
     "code": "D06.06",
     "name": "Kältebezug: Investitionsanteil"
    },
    {
     "code": "D07",
     "name": "Lufttechnische Anlage"
    },
    {
     "code": "D07.01",
     "name": "Aussenluftversorgung, Fortluftführung"
    },
    {
     "code": "D07.02",
     "name": "Luftaufbereitung"
    },
    {
     "code": "D07.03",
     "name": "Luftwärmespeicherung"
    },
    {
     "code": "D07.04",
     "name": "Luftverteilung"
    },
    {
     "code": "D07.05",
     "name": "Luftabgabe"
    },
    {
     "code": "D07.06",
     "name": "Luft: Investitionsanteil"
    },
    {
     "code": "D08",
     "name": "Wassertechnische Anlage"
    },
    {
     "code": "D08.01",
     "name": "Wasserversorgung"
    },
    {
     "code": "D08.02",
     "name": "Wasserbehandlung"
    },
    {
     "code": "D08.03",
     "name": "Wasserspeicher"
    },
    {
     "code": "D08.04",
     "name": "Wasserverteilung"
    },
    {
     "code": "D08.05",
     "name": "Wasser: Armatur, Apparat"
    },
    {
     "code": "D08.06",
     "name": "Wasser: Installationselement"
    },
    {
     "code": "D09",
     "name": "Abwassertechnische Anlage"
    },
    {
     "code": "D09.01",
     "name": "Abwasserentsorgung"
    },
    {
     "code": "D09.02",
     "name": "Abwasserbehandlung"
    },
    {
     "code": "D09.03",
     "name": "Abwasserspeicher"
    },
    {
     "code": "D09.04",
     "name": "Abwassersammlung"
    },
    {
     "code": "D09.05",
     "name": "Abwasser: Armatur, Apparat"
    },
    {
     "code": "D10",
     "name": "Gastechnische Anlage"
    },
    {
     "code": "D10.01",
     "name": "Gasversorgung"
    },
    {
     "code": "D10.02",
     "name": "Gasbehandlung"
    },
    {
     "code": "D10.03",
     "name": "Gasspeicherung"
    },
    {
     "code": "D10.04",
     "name": "Gasverteilung"
    },
    {
     "code": "D10.05",
     "name": "Gas: Armatur, Apparat"
    },
    {
     "code": "D11",
     "name": "Anlage für Spezialmedien"
    },
    {
     "code": "D11.01",
     "name": "Spezialmedien: Versorgung, Entsorgung"
    },
    {
     "code": "D11.02",
     "name": "Spezialmedien: Aufbereitung"
    },
    {
     "code": "D11.03",
     "name": "Spezialmedien: Speicherung"
    },
    {
     "code": "D11.04",
     "name": "Spezialmedien: Verteilung"
    },
    {
     "code": "D11.05",
     "name": "Spezialmedien: Armatur, Apparat"
    },
    {
     "code": "D12",
     "name": "Beförderungsanlage"
    },
    {
     "code": "D12.01",
     "name": "Personenaufzug"
    },
    {
     "code": "D12.02",
     "name": "Lasten- und Serviceaufzug"
    },
    {
     "code": "D12.03",
     "name": "Spezialaufzug"
    },
    {
     "code": "D12.04",
     "name": "Fahrtreppe"
    },
    {
     "code": "D12.05",
     "name": "Fahrsteig"
    },
    {
     "code": "D12.06",
     "name": "Hebeeinrichtung, Verladestation"
    }
   ]
  },
  {
   "id": "r-crb-wandbekleidung",
   "name": "CRB Äussere Wandbekleidung Gebäude",
   "description": "Kostenelemente der eBKP-H Hauptgruppe E (Äussere Wandbekleidung Gebäude): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "E01",
     "name": "Äussere Wandbekleidung unter Terrain"
    },
    {
     "code": "E01.01",
     "name": "Wandabdichtung unter Terrain"
    },
    {
     "code": "E01.02",
     "name": "Aussenwärmedämmung unter Terrain"
    },
    {
     "code": "E01.03",
     "name": "Schutzschicht unter Terrain"
    },
    {
     "code": "E02",
     "name": "Äussere Wandbekleidung über Terrain"
    },
    {
     "code": "E02.01",
     "name": "Äussere Beschichtung"
    },
    {
     "code": "E02.02",
     "name": "Aussenwärmedämmsystem"
    },
    {
     "code": "E02.03",
     "name": "Fassadenbekleidung"
    },
    {
     "code": "E02.04",
     "name": "Systemfassade"
    },
    {
     "code": "E02.05",
     "name": "Fassadenbekleidung Untersicht"
    },
    {
     "code": "E02.06",
     "name": "Aussen liegende Absturzsicherung"
    },
    {
     "code": "E03",
     "name": "Element in Aussenwand"
    },
    {
     "code": "E03.01",
     "name": "Fenster"
    },
    {
     "code": "E03.02",
     "name": "Aussentür"
    },
    {
     "code": "E03.03",
     "name": "Aussentor"
    },
    {
     "code": "E03.04",
     "name": "Sonnenschutz, Wetterschutz"
    },
    {
     "code": "E03.05",
     "name": "Absturzsicherung"
    }
   ]
  },
  {
   "id": "r-crb-bedachung",
   "name": "CRB Bedachung Gebäude",
   "description": "Kostenelemente der eBKP-H Hauptgruppe F (Bedachung Gebäude): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "F01",
     "name": "Dachhaut"
    },
    {
     "code": "F01.01",
     "name": "Dachabdichtung unter Terrain"
    },
    {
     "code": "F01.02",
     "name": "Bedachung Flachdach"
    },
    {
     "code": "F01.03",
     "name": "Bedachung geneigtes Dach"
    },
    {
     "code": "F01.04",
     "name": "Systemdach"
    },
    {
     "code": "F02",
     "name": "Element zu Dach"
    },
    {
     "code": "F02.01",
     "name": "Element zu Flachdach"
    },
    {
     "code": "F02.02",
     "name": "Element zu geneigtem Dach"
    },
    {
     "code": "F02.03",
     "name": "Schutzanlage zu Dach"
    }
   ]
  },
  {
   "id": "r-crb-ausbau",
   "name": "CRB Ausbau Gebäude",
   "description": "Kostenelemente der eBKP-H Hauptgruppe G (Ausbau Gebäude): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "G01",
     "name": "Trennwand, Innentür, Innentor"
    },
    {
     "code": "G01.01",
     "name": "Fest stehende Trennwand"
    },
    {
     "code": "G01.02",
     "name": "Bewegliche Trennwand"
    },
    {
     "code": "G01.03",
     "name": "Schachtfront"
    },
    {
     "code": "G01.04",
     "name": "Innenfenster"
    },
    {
     "code": "G01.05",
     "name": "Innentür"
    },
    {
     "code": "G01.06",
     "name": "Innentor"
    },
    {
     "code": "G02",
     "name": "Bodenbelag"
    },
    {
     "code": "G02.01",
     "name": "Unterkonstruktion zu Bodenbelag"
    },
    {
     "code": "G02.02",
     "name": "Bodenbelag"
    },
    {
     "code": "G03",
     "name": "Wandbekleidung"
    },
    {
     "code": "G03.01",
     "name": "Unterkonstruktion zu Wandbekleidung"
    },
    {
     "code": "G03.02",
     "name": "Wandbekleidung"
    },
    {
     "code": "G04",
     "name": "Deckenbekleidung"
    },
    {
     "code": "G04.01",
     "name": "Unterkonstruktion zu Deckenbekleidung"
    },
    {
     "code": "G04.02",
     "name": "Deckenbekleidung"
    },
    {
     "code": "G05",
     "name": "Einbauten, Schutzeinrichtung zu Ausbau"
    },
    {
     "code": "G05.01",
     "name": "Einbauschrank, Regal, Ablage"
    },
    {
     "code": "G05.02",
     "name": "Einbauküche"
    },
    {
     "code": "G05.03",
     "name": "Innerer Fensterausbau"
    },
    {
     "code": "G05.04",
     "name": "Innerer Abschluss"
    },
    {
     "code": "G05.05",
     "name": "Absturz-, Anprallschutzeinrichtung"
    },
    {
     "code": "G05.06",
     "name": "Sonderbauteil"
    },
    {
     "code": "G05.07",
     "name": "Kleinbauteil, Schutzraumeinrichtung"
    },
    {
     "code": "G06",
     "name": "Ergänzende Leistung zu Ausbau"
    },
    {
     "code": "G06.01",
     "name": "Durchbruch, Schlitz zu Ausbau"
    },
    {
     "code": "G06.02",
     "name": "Abschottung"
    },
    {
     "code": "G06.03",
     "name": "Reinigung"
    },
    {
     "code": "G06.04",
     "name": "Trocknung"
    }
   ]
  },
  {
   "id": "r-crb-nutzungsanlage",
   "name": "CRB Nutzungsspezifische Anlage Gebäude",
   "description": "Kostenelemente der eBKP-H Hauptgruppe H (Nutzungsspezifische Anlage Gebäude): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "H01",
     "name": "Produktionsanlage"
    },
    {
     "code": "H01.01",
     "name": "Produktionsanlage: Versorgung, Entsorgung"
    },
    {
     "code": "H01.02",
     "name": "Produktionsanlage: Aufbereitung"
    },
    {
     "code": "H01.03",
     "name": "Produktionsanlage: Speicherung"
    },
    {
     "code": "H01.04",
     "name": "Produktionsanlage: Verteilung"
    },
    {
     "code": "H01.05",
     "name": "Produktionsanlage: Armatur, Apparat"
    },
    {
     "code": "H02",
     "name": "Laboranlage"
    },
    {
     "code": "H02.01",
     "name": "Laboranlage: Versorgung, Entsorgung"
    },
    {
     "code": "H02.02",
     "name": "Laboranlage: Aufbereitung"
    },
    {
     "code": "H02.03",
     "name": "Laboranlage: Speicherung"
    },
    {
     "code": "H02.04",
     "name": "Laboranlage: Verteilung"
    },
    {
     "code": "H02.05",
     "name": "Laboranlage: Armatur, Apparat"
    },
    {
     "code": "H03",
     "name": "Grossküche"
    },
    {
     "code": "H03.01",
     "name": "Grossküche: Versorgung, Entsorgung"
    },
    {
     "code": "H03.02",
     "name": "Grossküche: Aufbereitung"
    },
    {
     "code": "H03.03",
     "name": "Grossküche: Lagerung"
    },
    {
     "code": "H03.04",
     "name": "Grossküche: Verteilung"
    },
    {
     "code": "H03.05",
     "name": "Grossküche: Armatur, Apparat"
    },
    {
     "code": "H04",
     "name": "Wäscherei-, Reinigungsanlage"
    },
    {
     "code": "H04.01",
     "name": "Wäscherei-, Reinigungsanlage: Versorgung, Entsorgung"
    },
    {
     "code": "H04.02",
     "name": "Wäscherei-, Reinigungsanlage: Aufbereitung"
    },
    {
     "code": "H04.03",
     "name": "Wäscherei-, Reinigungsanlage: Speicherung"
    },
    {
     "code": "H04.04",
     "name": "Wäscherei-, Reinigungsanlage: Verteilung"
    },
    {
     "code": "H04.05",
     "name": "Wäscherei-, Reinigungsanlage: Armatur, Apparat"
    },
    {
     "code": "H05",
     "name": "Anlage für Gesundheit"
    },
    {
     "code": "H05.01",
     "name": "Gerät für Vitaldatenüberwachung"
    },
    {
     "code": "H05.02",
     "name": "Einrichtung für Diagnostik"
    },
    {
     "code": "H05.03",
     "name": "Gerät für Behandlung, Pflege"
    },
    {
     "code": "H05.04",
     "name": "Medizinisches Kälte-, Wärmegerät"
    },
    {
     "code": "H05.05",
     "name": "Mess-, Analysetechnik"
    },
    {
     "code": "H05.06",
     "name": "Reinigung, Desinfektion, Sterilisation"
    },
    {
     "code": "H05.07",
     "name": "Medizinische Einrichtung, Ausstattung"
    },
    {
     "code": "H05.08",
     "name": "Medizinischer Beleuchtungskörper"
    },
    {
     "code": "H05.09",
     "name": "Medizinische Textilien"
    },
    {
     "code": "H05.10",
     "name": "Medizinisches Kleininventar"
    },
    {
     "code": "H05.11",
     "name": "Medizinisches Transportmittel"
    },
    {
     "code": "H05.12",
     "name": "Medizinisches Betriebsmittel"
    },
    {
     "code": "H06",
     "name": "Anlage für Bildung, Kultur"
    },
    {
     "code": "H06.01",
     "name": "Bildung, Kultur: Versorgung, Entsorgung"
    },
    {
     "code": "H06.02",
     "name": "Bildung, Kultur: Apparat"
    },
    {
     "code": "H06.03",
     "name": "Bildung, Kultur: Steuerung"
    },
    {
     "code": "H06.04",
     "name": "Bildung, Kultur: Einbauten"
    },
    {
     "code": "H07",
     "name": "Sportanlage, Freizeitanlage"
    },
    {
     "code": "H07.01",
     "name": "Sportanlage, Freizeitanlage: Versorgung, Entsorgung"
    },
    {
     "code": "H07.02",
     "name": "Sportanlage, Freizeitanlage: Apparat"
    },
    {
     "code": "H07.03",
     "name": "Sportanlage, Freizeitanlage: Steuerung"
    },
    {
     "code": "H07.04",
     "name": "Sportanlage, Freizeitanlage: Einbauten"
    },
    {
     "code": "H08",
     "name": "Anlage für Erholung"
    },
    {
     "code": "H08.01",
     "name": "Erholungsanlage: Versorgung, Entsorgung"
    },
    {
     "code": "H08.02",
     "name": "Erholungsanlage: Apparat"
    },
    {
     "code": "H08.03",
     "name": "Erholungsanlage: Steuerung"
    },
    {
     "code": "H08.04",
     "name": "Erholungsanlage: Einbauten"
    },
    {
     "code": "H09",
     "name": "Weitere nutzungsspezifische Anlage"
    },
    {
     "code": "H09.01",
     "name": "Nutzungsspezifische Anlage: Versorgung, Entsorgung"
    },
    {
     "code": "H09.02",
     "name": "Nutzungsspezifische Anlage: Aufbereitung"
    },
    {
     "code": "H09.03",
     "name": "Nutzungsspezifische Anlage: Speicherung, Lagerung"
    },
    {
     "code": "H09.04",
     "name": "Nutzungsspezifische Anlage: Verteilung"
    },
    {
     "code": "H09.05",
     "name": "Nutzungsspezifische Anlage: Armatur, Apparat"
    },
    {
     "code": "H09.06",
     "name": "Parkieranlage"
    },
    {
     "code": "H09.07",
     "name": "Materialtransportanlage"
    },
    {
     "code": "H09.08",
     "name": "Kühlzelle"
    },
    {
     "code": "H09.09",
     "name": "Lagereinrichtung"
    }
   ]
  },
  {
   "id": "r-crb-umgebung",
   "name": "CRB Umgebung Gebäude",
   "description": "Kostenelemente der eBKP-H Hauptgruppe I (Umgebung Gebäude): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "I01",
     "name": "Umgebungsgestaltung"
    },
    {
     "code": "I01.01",
     "name": "Geländeanpassung"
    },
    {
     "code": "I01.02",
     "name": "Tief liegende Entwässerung"
    },
    {
     "code": "I02",
     "name": "Bauwerk in der Umgebung"
    },
    {
     "code": "I02.01",
     "name": "Böschungsverbau"
    },
    {
     "code": "I02.02",
     "name": "Stützmauer"
    },
    {
     "code": "I02.03",
     "name": "Frei stehende Wand"
    },
    {
     "code": "I02.04",
     "name": "Treppe, Rampe"
    },
    {
     "code": "I02.05",
     "name": "Kleinbauwerk"
    },
    {
     "code": "I02.06",
     "name": "Unterirdisches Bauwerk"
    },
    {
     "code": "I02.07",
     "name": "Absturz-, Anprallschutzeinrichtung für Umgebung"
    },
    {
     "code": "I02.08",
     "name": "Einfriedung"
    },
    {
     "code": "I03",
     "name": "Grünfläche"
    },
    {
     "code": "I03.01",
     "name": "Vegetationstragschicht"
    },
    {
     "code": "I03.02",
     "name": "Saatfläche"
    },
    {
     "code": "I03.03",
     "name": "Flächenbepflanzung, Hecke"
    },
    {
     "code": "I03.04",
     "name": "Vertikale Begrünung"
    },
    {
     "code": "I03.05",
     "name": "Einzelbepflanzung"
    },
    {
     "code": "I03.06",
     "name": "Einfassung, Abschluss Grünfläche"
    },
    {
     "code": "I03.07",
     "name": "Naturnahe Wasserfläche"
    },
    {
     "code": "I03.08",
     "name": "Ingenieurbiologische Massnahme"
    },
    {
     "code": "I03.09",
     "name": "Pflegemassnahme bis Übergabe"
    },
    {
     "code": "I04",
     "name": "Hartfläche"
    },
    {
     "code": "I04.01",
     "name": "Fundations-, Tragschicht"
    },
    {
     "code": "I04.02",
     "name": "Einfassung, Abschluss Hartfläche"
    },
    {
     "code": "I04.03",
     "name": "Deckschicht"
    },
    {
     "code": "I04.04",
     "name": "Bodenmarkierung"
    },
    {
     "code": "I05",
     "name": "Technik Umgebung"
    },
    {
     "code": "I05.01",
     "name": "Elektroanlage Starkstrom für Umgebung"
    },
    {
     "code": "I05.02",
     "name": "Elektroanlage Schwachstrom für Umgebung"
    },
    {
     "code": "I05.03",
     "name": "Wärmeanlage für Umgebung"
    },
    {
     "code": "I05.04",
     "name": "Kälteanlage für Umgebung"
    },
    {
     "code": "I05.05",
     "name": "Sanitäre Anlage für Umgebung"
    },
    {
     "code": "I05.06",
     "name": "Oberflächenentwässerung für Umgebung"
    },
    {
     "code": "I05.07",
     "name": "Transportanlage für Umgebung"
    },
    {
     "code": "I05.08",
     "name": "Perimeterschutz"
    },
    {
     "code": "I06",
     "name": "Ausstattung Umgebung"
    },
    {
     "code": "I06.01",
     "name": "Mobile Ausstattung für Umgebung"
    },
    {
     "code": "I06.02",
     "name": "Fixierte Ausstattung für Umgebung"
    },
    {
     "code": "I06.03",
     "name": "Spiel-, Sportgerät für Umgebung"
    },
    {
     "code": "I06.04",
     "name": "Abfallentsorgungseinrichtung für Umgebung"
    }
   ]
  },
  {
   "id": "r-crb-ausstattung",
   "name": "CRB Ausstattung Gebäude",
   "description": "Kostenelemente der eBKP-H Hauptgruppe J (Ausstattung Gebäude): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "J01",
     "name": "Mobiliar"
    },
    {
     "code": "J01.01",
     "name": "Allgemeines Mobiliar"
    },
    {
     "code": "J01.02",
     "name": "Nutzungsspezifisches Mobiliar"
    },
    {
     "code": "J01.03",
     "name": "Mobile Leuchte"
    },
    {
     "code": "J01.04",
     "name": "Signaletik"
    },
    {
     "code": "J02",
     "name": "Kleininventar"
    },
    {
     "code": "J02.01",
     "name": "Allgemeines Kleininventar"
    },
    {
     "code": "J02.02",
     "name": "Nutzungsspezifisches Kleininventar"
    },
    {
     "code": "J02.03",
     "name": "Mobiles Gerät"
    },
    {
     "code": "J03",
     "name": "Textilien"
    },
    {
     "code": "J03.01",
     "name": "Allgemeine Textilien"
    },
    {
     "code": "J03.02",
     "name": "Nutzungsspezifische Textilien"
    },
    {
     "code": "J04",
     "name": "Kunst am Bau"
    },
    {
     "code": "J04.01",
     "name": "Kunstobjekt"
    },
    {
     "code": "J04.02",
     "name": "Künstlerisch gestaltetes Bauteil"
    }
   ]
  },
  {
   "id": "r-crb-planungskosten",
   "name": "CRB Planungskosten",
   "description": "Kostenelemente der eBKP-H Hauptgruppe V (Planungskosten): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "V01",
     "name": "Planer"
    },
    {
     "code": "V01.01",
     "name": "Architekt"
    },
    {
     "code": "V01.02",
     "name": "Landschaftsarchitekt"
    },
    {
     "code": "V01.03",
     "name": "Bauingenieur"
    },
    {
     "code": "V01.04",
     "name": "Fachingenieur Gebäudetechnik"
    },
    {
     "code": "V01.05",
     "name": "Spezialist"
    },
    {
     "code": "V01.06",
     "name": "Generalplaner, Planergemeinschaft"
    },
    {
     "code": "V01.07",
     "name": "Nebenkosten zu Planerleistungen"
    },
    {
     "code": "V02",
     "name": "Unternehmer"
    },
    {
     "code": "V02.01",
     "name": "Beratung zur Planung"
    },
    {
     "code": "V02.02",
     "name": "Vorbereitung zur Bewirtschaftung"
    },
    {
     "code": "V03",
     "name": "Auftraggeber"
    },
    {
     "code": "V03.01",
     "name": "Auswahlverfahren"
    },
    {
     "code": "V03.02",
     "name": "Eigentümer"
    },
    {
     "code": "V03.03",
     "name": "Betreiber"
    },
    {
     "code": "V03.04",
     "name": "Nutzer"
    },
    {
     "code": "V03.05",
     "name": "Berater"
    },
    {
     "code": "V03.06",
     "name": "Anwalt, Experte, Gericht"
    },
    {
     "code": "V03.07",
     "name": "Plattform, Projektraum"
    }
   ]
  },
  {
   "id": "r-crb-nebenkosten",
   "name": "CRB Nebenkosten zu Erstellung",
   "description": "Kostenelemente der eBKP-H Hauptgruppe W (Nebenkosten zu Erstellung): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "W01",
     "name": "Bewilligung, Gebühr"
    },
    {
     "code": "W01.01",
     "name": "Bewilligung"
    },
    {
     "code": "W01.02",
     "name": "Gebühr"
    },
    {
     "code": "W02",
     "name": "Versicherung, Garantie"
    },
    {
     "code": "W02.01",
     "name": "Versicherung"
    },
    {
     "code": "W02.02",
     "name": "Garantie"
    },
    {
     "code": "W02.03",
     "name": "Rückvergütung"
    },
    {
     "code": "W03",
     "name": "Kapitalkosten"
    },
    {
     "code": "W03.01",
     "name": "Kapitalkosten zu Grundstück"
    },
    {
     "code": "W03.02",
     "name": "Kapitalkosten zu Erstellung"
    },
    {
     "code": "W04",
     "name": "Bewirtung, Öffentlichkeitsarbeit, Entschädigung"
    },
    {
     "code": "W04.01",
     "name": "Bewirtungskosten"
    },
    {
     "code": "W04.02",
     "name": "Öffentlichkeitsarbeit"
    },
    {
     "code": "W04.03",
     "name": "Entschädigung"
    },
    {
     "code": "W05",
     "name": "Inbetriebnahme"
    },
    {
     "code": "W05.01",
     "name": "Inbetriebnahme Bauwerk"
    },
    {
     "code": "W06",
     "name": "Vermietung, Verkauf"
    },
    {
     "code": "W06.01",
     "name": "Vergütung zu Erstvermietung"
    },
    {
     "code": "W06.02",
     "name": "Nebenkosten zu Erstvermietung"
    },
    {
     "code": "W06.03",
     "name": "Vergütung zu Verkauf"
    },
    {
     "code": "W06.04",
     "name": "Nebenkosten zu Verkauf"
    },
    {
     "code": "W07",
     "name": "Betriebserfolg"
    },
    {
     "code": "W07.01",
     "name": "Betriebsaufwand"
    },
    {
     "code": "W07.02",
     "name": "Betriebsertrag"
    }
   ]
  },
  {
   "id": "r-crb-reserve",
   "name": "CRB Reserve, Teuerung",
   "description": "Kostenelemente der eBKP-H Hauptgruppe Y (Reserve, Teuerung): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "Y01",
     "name": "Reserve"
    },
    {
     "code": "Y01.01",
     "name": "Reserve"
    },
    {
     "code": "Y02",
     "name": "Teuerung"
    },
    {
     "code": "Y02.01",
     "name": "Teuerung"
    }
   ]
  },
  {
   "id": "r-crb-mwst",
   "name": "CRB Mehrwertsteuer",
   "description": "Kostenelemente der eBKP-H Hauptgruppe Z (Mehrwertsteuer): Elementgruppen und Elemente gemäss SN 506 511:2020.",
   "standards": [
    "eBKP-H (SN 506 511)"
   ],
   "values": [
    {
     "code": "Z01",
     "name": "Mehrwertsteuer"
    },
    {
     "code": "Z01.01",
     "name": "Mehrwertsteuer"
    }
   ]
  }
 ]
}
  $proposal$::jsonb;
  item jsonb;
  child jsonb;
  raw_before jsonb;
  list_uuid uuid;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete cost-element update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Cost-element operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'CRB Kostenelemente already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the Flächenarten update first';
  END IF;

  -- Validate the entire scope before changing any row.
  IF (SELECT count(*) FROM jsonb_array_elements(proposal->'createLists')) <> 14 THEN
    RAISE EXCEPTION 'Expected fourteen Hauptgruppen';
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

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'createLists') LOOP
    INSERT INTO catalog.code_list AS l
      (identifier, name_de, description_de, status, created_on, modified_on, normative_references)
    VALUES (item->>'id', item->>'name', item->>'description', 'draft', edited_on, edited_on,
      ARRAY(SELECT jsonb_array_elements_text(item->'standards')))
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
$crb$;

-- Cost-element lists after the update: works after COMMIT and on a repeat run.
SELECT l.identifier, l.name_de, count(v.id) AS werte
FROM catalog.code_list l LEFT JOIN catalog.code_value v ON v.code_list_id = l.id
WHERE l.identifier LIKE 'r-crb-%' GROUP BY l.identifier, l.name_de ORDER BY min(v.code);

COMMIT;
