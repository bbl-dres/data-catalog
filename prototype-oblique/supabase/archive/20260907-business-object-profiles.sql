-- Reviewed business profiles: 32 Gebaeude, 10 Geschoss, 10 Raum, 7 Zone,
-- 21 Grundstueck, 8 Wirtschaftseinheit and 10 Bemessung attributes (98 active).
-- Source: docs/business-object-attribute-proposal.md (7 September 2026).
-- Standalone content update FROM THE ORIGINAL IMPORT; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 6 object updates + Zone create; 21 attribute updates + 77 creates + 7 retirements;
-- 27 draft completeness rules; 4 local draft code lists with 13 values;
-- 5 candidate measuredFor links; no change-log entries are generated.
-- Apply 20260907-business-object-labels.sql afterwards for the current German labels.
-- Keep this applied operation payload unchanged so its repeat-run fingerprint remains valid.
-- Property-set membership and detailed key roles are retained in comments.
-- Existing IDs, source inventories (including Gebaeudehuelle), history and grants survive.
-- Preview: replace the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $profiles$
DECLARE
  operation_id constant text := 'business-object-profiles-20260907-v2';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  -- "semantic" explicitly creates an attribute; otherwise preserve its existing identity.
  -- The baseline and local vocabularies are part of the operation fingerprint.
  proposal constant jsonb := $proposal$
{
  "revision": 2,
  "source": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute",
  "sharedNotes": "Fachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte.",
  "objects": [
    {
      "id": "gebaeude",
      "name": "Gebäude",
      "count": 32,
      "description": "Ein baulich abgegrenztes, dauerhaftes und überdachtes Bauwerk, das im Portfolio mit eigener Identität über seinen Lebenszyklus geführt wird. Erfasst werden auch seine geplante Ausprägung und der historische Nachweis nach einem Abbruch oder einer Nichtrealisierung.",
      "notes": "SAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Gebäudenummer (BBL); die Bestandteile sind getrennte Attribute, die Building ID ihre abgeleitete Gesamtrepräsentation. Änderungen der Schlüsselbestandteile erhalten datierte Alt-/Neuschlüsselbezüge. Die physische Abgrenzung ist mit dem SAP-Objekt abzugleichen. EGID und die ausgewählte EGRID bleiben bedingte Schweizer Referenzen; sämtliche Grundstücksbeziehungen behalten Quelle, Rechtsbezug und Gültigkeit. Eigentumsart und eingetragene Eigentümer sind getrennt; Eigentümerzuordnungen erhalten Registerkontext und belegte Anteile, keine automatisch geerbten Eigentümer. Teilportfolio ist ein BBL-Begriff; Objektstrategie ist eine eigene SAP-Quellangabe mit noch abzustimmendem Vokabular. Sieben atomare Komponenten beschreiben die Hauptadresse; weitere Adressen/Eingänge sind eigene Zuordnungen. Geometrie ist ein WGS84-Punkt, identisch mit den beiden Einzelkoordinaten; GeoJSON verwendet [Längengrad, Breitengrad]. Grundriss und Gebäudehülle (AO) bleiben getrennt und erhalten. Primäre Raumstruktur: Gebäude – Geschoss – Raum; Zonen haben eigene Raumzuordnungen. Basisbemessungen in Bemessung: GF und GV jeweils GESAMT, OBERIRDISCH, UNTERIRDISCH; VMF und GGF jeweils GESAMT. Keine zusätzlichen numerischen Flächen-/Volumenattribute oder automatischen Summen. Geschosszählung und GF/GV-Aufteilung erhalten getrennte, aufeinander bezogene Regeln. GWR GKAT ist als vorhandene Referenz gebunden; GKLAS und die weltweite Verwendung von GSTAT bleiben ungeprüft und ungebunden. Historische Quellenverweise sind keine Normkonformitäts- oder Abdeckungsbestätigung."
    },
    {
      "id": "geschoss",
      "name": "Geschoss",
      "count": 10,
      "description": "Eine fachlich abgegrenzte bauliche Ebene innerhalb eines Gebäudes, die Räume und weitere bauliche Bereiche räumlich einordnet. Ihre Identität wird unabhängig von einer bestimmten Flächenbemessung geführt.",
      "notes": "Genau ein primäres Gebäude pro fachlichem Zeitpunkt; Building ID referenziert den vollständigen SAP-Gebäudeschlüssel. Geschoss-ID bleibt von Geschosscode, Sortierposition und einzelnen Modellkennungen getrennt. Vollständige Geschosse, Teilgeschosse und reine Modell-/Referenzebenen sind vor einer Zählung zu unterscheiden. Geschosslage betrifft die Zählregel und entscheidet nicht allein über ober-/unterirdische Flächen oder Volumen. Geometriebezüge erhalten DWG-/IFC-Revision, abgegrenzte Modellobjekte, Koordinatensystem, Einheit und Höhenbezug. GF kann als Bemessung mit Bezugsobjekt Geschoss und Umfang GESAMT dieses Geschosses geführt werden; keine ungeprüfte Gleichsetzung mit Netto-Raumflächen. Zeitliche Zuordnung und Historie bei Änderungen erhalten."
    },
    {
      "id": "raum",
      "name": "Raum",
      "count": 10,
      "description": "Eine räumlich abgegrenzte, einzeln identifizierte Einheit innerhalb eines Gebäudes mit dokumentiertem Nutzungs- und Geschossbezug. Die Abgrenzung kann baulich oder im Bewirtschaftungsmodell eindeutig festgelegt sein.",
      "notes": "Primäre Zuordnung: genau ein Geschoss zum betrachteten Zeitpunkt; das Gebäude ergibt sich daraus. Mehrgeschossige Räume behalten weitere betroffene Geschossbezüge, ohne Raum oder Volumen mehrfach zu zählen. Raumnummern sind lokale, zeitlich gültige Kennzeichnungen; Raum-ID und Vorgänger-/Nachfolgerbezüge bleiben bei Umnummerierungen, Teilungen und Zusammenlegungen nachvollziehbar. Raumstatus ist weder Leerstand noch Katalogfreigabe. Flächenklassifikation enthält Schema/Ausgabe/Kategorie und ist kein numerischer Flächenwert. Digitale Geometriebezüge bewahren Datei-/Modellrevision, Umfang und Quell-Koordinatensystem. VMF nur bei anwendbarer Vermietungsflächenregel als eigene Bemessung mit Umfang GESAMT des Raums. Ein Raum kann null, einer oder mehreren Zonen angehören. Eigentum und Teilportfolio werden nicht als unabhängig editierbare Raumangaben kopiert."
    },
    {
      "id": "zone",
      "name": "Zone",
      "count": 7,
      "description": "Eine für einen bestimmten fachlichen Zweck gebildete und zeitlich gültige Zusammenfassung von Räumen. Die Zugehörigkeit wird durch einzelne Raumzuordnungen beschrieben; die Räume müssen nicht räumlich benachbart sein.",
      "create": true,
      "domainFrom": "raum",
      "notes": "Zone ist eine zeitlich gültige Sammlung ganzer Räume für einen bestimmten Zweck; Property Set ist dagegen eine Gruppe von Attributdefinitionen. Separate Raumzuordnungen enthalten Zone-ID, Raum-ID, Gültig ab und Gültig bis; keine verkettete Raumliste und keine obligatorische einzelne Zone-ID am Raum. Eine aktive Zone benötigt im vorgeschlagenen Profil mindestens einen Raum, eine geplante Zone darf noch leer sein. Mehrere Zonen pro Raum sind erlaubt; Exklusivität und vollständige Abdeckung gelten nur innerhalb eines ausdrücklich definierten Zonierungsschemas und Zeitraums, nicht allein aufgrund des Zonentyp-Labels. Geschossübergreifende Zonen sind möglich, gebäudeübergreifende nur mit dokumentierter Begründung. Teilraum- und verschachtelte Zonen sind ausserhalb des ersten Profils. Keine eigene Geometrie oder automatisch aggregierte Fläche. Optionaler VMF-Gesamtwert bleibt eine eigene Bemessung mit Bezugsobjekt Zone, Mitgliedschaftsstichtag und nachvollziehbaren beitragenden Bemessungen. Mitgliedschaftsregeln sind hier Anforderungen; dieses Inhaltsupdate führt keine neuen Beziehungstypen oder Instanztabellen ein."
    },
    {
      "id": "grundstueck",
      "name": "Grundstück",
      "count": 21,
      "description": "Eine grundbuchlich geführte Landparzelle mit eigener Identität und räumlicher Abgrenzung.",
      "notes": "SAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Grundstücksnummer (BBL), mit getrennten Komponenten. Grundstücksnummer (amtlich) mit Nummerierungsbereich sowie EGRID bleiben separate Registerangaben; BBL- und amtliche Nummer werden nicht gleichgesetzt. Das Profil betrifft Landparzellen; andere Grundstücksrechte behalten eigenen Rechtskontext. Sechs atomare Adress-/Lagekomponenten, ohne Hausnummer. Grenzgeometrie in WGS84 als Polygon oder MultiPolygon, einschliesslich Aussparungen und aller Teile; GeoJSON verwendet [Längengrad, Breitengrad]. Die beiden Einzelkoordinaten sind ein ausgewählter Innenpunkt einer dokumentierten Komponente, kein angenommener Schwerpunkt; gegen die gültige Geometrierevision prüfen. Eigentumsart: Eigentum / Anmiete / Spezialfall; Eigentümer: im zuständigen Register eingetragene Personen/Organisationen, jeweils mit Rechtsbezug, Gültigkeit und belegtem anwendbarem Anteil. Teilportfolio ist eine BBL-Zuordnung. Erforderlicher Profilwert Grundstücksfläche: zugeordnete Bemessung GSF / GESAMT / m². Amtliche und berechnete Flächen bleiben separate Aussagen mit Quelle/Grundlage, keine gegenseitige Überschreibung oder numerische Kopie an jedes Gebäude. Standortgemeinde, sämtliche Gebäudebeziehungen und Rechte bleiben separate datierte Bezüge."
    },
    {
      "id": "wirtschaftseinheit",
      "name": "Wirtschaftseinheit",
      "count": 8,
      "description": "Eine nach wirtschaftlichen Bewirtschaftungskriterien abgegrenzte Zusammenfassung von Immobilienobjekten.",
      "notes": "SAP-Schlüssel: Buchungskreis / Wirtschaftseinheit (SAP-WE-Nummer), mit beiden Komponenten als Einzelattributen. Buchungskreis ist ausdrücklich Teil der Identität; WE-Nummer allein ist nicht der vollständige Schlüssel. Die bisherigen Katalog-Identitäten für Buchungskreis und WE-Nummer werden wiederverwendet. Der Schlüsselbestandteil Wirtschaftseinheit an Gebäude/Grundstück referenziert gemeinsam mit Buchungskreis diese primäre SAP-WE; andere wirtschaftliche Gruppierungen sind getrennte Beziehungen. Umgliederungen erhalten Alt-/Neuschlüssel und gültige Mitgliedschaften, ohne allein daraus eine neue physische Immobilie abzuleiten. Profit Center und Teilportfolio sind getrennte Angaben. Verantwortliche Organisationen/Personen und relevante Verträge behalten ihre eigenen Beziehungen und Gültigkeiten."
    },
    {
      "id": "bemessung",
      "name": "Bemessung",
      "count": 10,
      "description": "Ein fachlich bestimmter Flächen- oder Volumenwert für genau ein Bezugsobjekt und einen definierten Umfang, mit Einheit, dokumentierter Quelle, Bemessungsgrundlage, Ermittlungsart und zeitlicher Gültigkeit.",
      "notes": "Genau ein typisiertes Bezugsobjekt pro Aussage: Gebäude, Grundstück, Geschoss, Raum oder Zone. Eine ID darf nicht gleichzeitig den Gebäudegesamtwert und einen beitragenden Geschosswert bezeichnen. Lokale Bemessungsarten: GF, VMF, GV, GGF, GSF. GF/GV am Gebäude jeweils GESAMT, OBERIRDISCH, UNTERIRDISCH; VMF/GGF am Gebäude und GSF am Grundstück jeweils GESAMT. GF am Geschoss: GESAMT dieses Geschosses; VMF am Raum nur bei Anwendbarkeit, an Zone optional mit begründetem Umfang. GF, VMF, GGF und GSF in m², GV in m³. Quelle ist die konkrete Quelldatei mit unveränderlicher Revision, vorzugsweise DWG/IFC; mehrere Quellen sind getrennte Zuordnungen. Objekt-/Geometrieauswahl und Extraktionsregel mit Version erhalten. Datei, Bemessungsgrundlage und Ermittlungsart sind verschieden. Die Basis nennt die tatsächlich verwendete Normausgabe/Regel; GF/GV/GGF nach dokumentierter SIA-Grundlage, GSF amtlich/SIA/geometrisch unterscheidbar, VMF nach bestätigter Vermietungsflächenregel. Dateiformat allein beweist keine modellbasierte Ableitung. Manuelle Ausnahmen erhalten Nachweisdatei, Grund und wer/wann/wie; unbekannt ist kein Nullwert. Berechnete Aussagen erhalten Eingangs-Bemessungen mit Revision, Formel, Stichtag und versioniertem Dateinachweis. Werte sind nichtnegativ, Zeitbezug und Genauigkeit bleiben erhalten. Gesamt = oberirdisch + unterirdisch nur für vollständig vergleichbare, nicht überlappende Teilwerte und mit dokumentierter Rundung prüfen. Keine automatischen Summen, Normzertifizierung oder technischen SAP-Codegleichsetzungen."
    }
  ],
  "attributes": [
    {
      "object": "gebaeude",
      "id": "gebaeude-id",
      "semantic": "buildingId",
      "name": "Building ID",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Zusammengesetzter SAP-basierter Primärschlüssel des Gebäudes aus Buchungskreis, Wirtschaftseinheit und Gebäudenummer (BBL). Die drei Bestandteile werden separat geführt; die Building ID ist deren konsistente Gesamtrepräsentation. Eine lokale Gebäudenummer oder EGID ersetzt diesen Schlüssel nicht.",
      "keyRole": "PK"
    },
    {
      "object": "gebaeude",
      "id": "buchungskreis",
      "semantic": "buchungskreis",
      "name": "Buchungskreis",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "SAP-Buchungskreis als erster Bestandteil der Building ID und Kontext der Wirtschaftseinheit. Den Originalwert einschliesslich führender Nullen erhalten; er ist weder Teilportfolio noch Profit Center.",
      "keyRole": "PK-Komponente"
    },
    {
      "object": "gebaeude",
      "id": "wirtschaftseinheit",
      "semantic": "wirtschaftseinheit",
      "name": "Wirtschaftseinheit",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "SAP-Nummer der Wirtschaftseinheit als zweiter Bestandteil der Building ID. Zusammen mit Buchungskreis referenziert sie genau die Wirtschaftseinheit dieses SAP-Schlüssels; die Nummer allein ist kein vollständiger Fremdschlüssel.",
      "keyRole": "PK-Komponente / FK"
    },
    {
      "object": "gebaeude",
      "id": "gebaeudenummer-bbl",
      "semantic": "gebaeudenummerBbl",
      "name": "Gebäudenummer (BBL)",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Lokale BBL-Gebäudenummer in SAP innerhalb von Buchungskreis und Wirtschaftseinheit; dritter Bestandteil der Building ID. Schreibweise und führende Nullen erhalten. Keine Hausnummer, EGID oder allein weltweit eindeutige Gebäudekennung.",
      "keyRole": "PK-Komponente"
    },
    {
      "object": "gebaeude",
      "id": "bezeichnung",
      "name": "Bezeichnung",
      "propertySet": "Identifikation",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Lesbarer Gebäudename oder kurze Bezeichnung für die fachliche Bewirtschaftung."
    },
    {
      "object": "gebaeude",
      "id": "land",
      "semantic": "country",
      "name": "Land",
      "propertySet": "Adresse",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Land der festgelegten Gebäude-Hauptadresse als separater Wert nach dem vereinbarten Ländervokabular. Das weltweite Portfolio wird nicht auf die Schweiz beschränkt."
    },
    {
      "object": "gebaeude",
      "id": "region",
      "semantic": "region",
      "name": "Region / Kanton / Bundesstaat",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "conditional",
      "description": "Administrative Region der Hauptadresse, beispielsweise Kanton, Bundesstaat oder Provinz. Als eigener Adressbestandteil führen; Bedeutung und Schreibweise richten sich nach dem betreffenden Land.",
      "condition": "Erforderlich, sofern die administrative Region Bestandteil der Adresse im betreffenden Land ist."
    },
    {
      "object": "gebaeude",
      "id": "ort",
      "semantic": "locality",
      "name": "Ort",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Postalisch oder örtlich verwendete Ortsbezeichnung der Gebäude-Hauptadresse als separater Wert. Sie ist nicht automatisch identisch mit dem amtlichen Gemeindenamen."
    },
    {
      "object": "gebaeude",
      "id": "postleitzahl",
      "semantic": "postalCode",
      "name": "Postleitzahl",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "conditional",
      "description": "Postleitzahl der Hauptadresse als Text. Buchstaben, Leerzeichen, Bindestriche und führende Nullen werden nach dem nationalen Adresssystem erhalten; keine Umwandlung in eine Zahl.",
      "condition": "Erforderlich, sofern für die betreffende Adresse eine Postleitzahl vergeben ist."
    },
    {
      "object": "gebaeude",
      "id": "strasse",
      "semantic": "street",
      "name": "Strasse",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "conditional",
      "description": "Strassenname der Hauptadresse ohne Hausnummer, Postleitzahl oder Ort. Bei Gebäuden ohne Strassenadresse wird kein Strassenname erfunden.",
      "condition": "Erforderlich, sofern das Gebäude eine Strassenadresse hat."
    },
    {
      "object": "gebaeude",
      "id": "hausnummer",
      "semantic": "houseNumber",
      "name": "Hausnummer",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "conditional",
      "description": "Hausnummer einschliesslich der zum amtlichen Nummernwert gehörenden Buchstaben oder Zeichen als separater Textwert. Nicht mit Strassenname oder Gebäudekennung verketten.",
      "condition": "Erforderlich, sofern der Hauptadresse eine Hausnummer zugeteilt ist."
    },
    {
      "object": "gebaeude",
      "id": "adresszusatz",
      "semantic": "addressSupplement",
      "name": "Adresszusatz",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "conditional",
      "description": "Ergänzende lokale Adressangabe, soweit sie zur eindeutigen Adressierung benötigt wird und nicht in den übrigen Adressbestandteilen enthalten ist. Keine vollständige verkettete Adresse und kein Ersatz für bekannte Einzelbestandteile.",
      "condition": "Erforderlich, wenn der Zusatz zur eindeutigen Adressierung benötigt wird."
    },
    {
      "object": "gebaeude",
      "id": "wgs84-lat",
      "semantic": "latitude",
      "name": "WGS84 Breitengrad",
      "propertySet": "Geometrie",
      "type": "decimal",
      "identity": false,
      "presence": "core",
      "description": "Breitengrad des festgelegten Gebäude-Referenzpunkts im Bezugssystem WGS84 in Dezimalgrad, von −90 bis +90. Separat vom Längengrad führen; 0 ist ein gültiger Wert und kein Platzhalter für unbekannt. Der Punkt ist nicht automatisch ein Eingang oder eine Grundrissgeometrie."
    },
    {
      "object": "gebaeude",
      "id": "wgs84-lon",
      "semantic": "longitude",
      "name": "WGS84 Längengrad",
      "propertySet": "Geometrie",
      "type": "decimal",
      "identity": false,
      "presence": "core",
      "description": "Längengrad desselben Gebäude-Referenzpunkts im Bezugssystem WGS84 in Dezimalgrad, von −180 bis +180. Separat vom Breitengrad führen; 0 ist ein gültiger Wert und kein Platzhalter für unbekannt. Quelle, Aktualität und Punktbedeutung müssen nachvollziehbar bleiben."
    },
    {
      "object": "gebaeude",
      "id": "geometrie",
      "semantic": "geometrie",
      "name": "Geometrie",
      "propertySet": "Geometrie",
      "type": "geometry",
      "identity": false,
      "presence": "core",
      "description": "Punktgeometrie des bewirtschafteten Gebäudes in WGS84 (EPSG:4326). Sie beschreibt denselben festgelegten Referenzpunkt wie WGS84 Breitengrad und Längengrad. Bei GeoJSON gilt die Reihenfolge [Längengrad, Breitengrad]; Punkt und Einzelkoordinaten müssen übereinstimmen. Grundriss und Gebäudehülle bleiben separate Geometrien.",
      "spec": {
        "geometryType": "Point",
        "coordinateReferenceSystem": "EPSG:4326"
      }
    },
    {
      "object": "gebaeude",
      "id": "gebaeudeart",
      "semantic": "buildingType",
      "name": "Gebäudeart (BBL)",
      "propertySet": "Klassifikation und Nutzung",
      "type": "structured",
      "identity": false,
      "presence": "conditional",
      "description": "BBL-Gebäudeklassifikation mit den verfügbaren Hierarchiestufen 1 und 2 sowie dem verwendeten Vokabularstand. Gebäudeart, Hauptnutzung und GWR-Klassifikationen sind fachlich getrennt; eine Gleichsetzung wird nicht vorausgesetzt.",
      "condition": "Erforderlich im abgestimmten Geltungsbereich der BBL-Gebäudeklassifikation; ungeklärte Zuordnungen bleiben offen."
    },
    {
      "object": "gebaeude",
      "id": "hauptnutzung",
      "semantic": "primaryUse",
      "name": "Hauptnutzung",
      "propertySet": "Klassifikation und Nutzung",
      "type": "code",
      "identity": false,
      "presence": "conditional",
      "description": "Vorherrschende tatsächliche Nutzung des Gebäudes für die Portfolioübersicht nach einer vereinbarten Bewertungsregel. Detaillierte Mischnutzung wird den Räumen oder Nutzungseinheiten mit ihrer Gültigkeit zugeordnet.",
      "condition": "Für Gebäude mit tatsächlicher Nutzung erforderlich; eine fehlende Zuordnung ist eine Vollständigkeitslücke. Geplante Nutzung separat kennzeichnen."
    },
    {
      "object": "gebaeude",
      "id": "gebaeudestatus",
      "name": "Gebäudestatus (physisch)",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Physischer Lebenszyklus des Gebäudes. Als Referenzvokabular werden die GWR-Zustände projektiert, bewilligt, im Bau, bestehend, nicht nutzbar, abgebrochen und nicht realisiert vorgeschlagen; ihre Verwendung für das weltweite BBL-Portfolio bleibt zu bestätigen. Bewirtschaftung, Verkauf, Eigentum und Katalogfreigabe sind davon getrennt."
    },
    {
      "object": "gebaeude",
      "id": "bewirtschaftungsstatus",
      "semantic": "managementStatus",
      "name": "Bewirtschaftungsstatus (Gebäude)",
      "propertySet": "Bewirtschaftung",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Fachlicher Bewirtschaftungszustand des Gebäudes im BBL-Portfolio mit massgeblichem Datum. Für Gebäude im BBL-Bewirtschaftungsumfang benötigt. Vokabular und Ableitung sind abzustimmen; physischer Status, Eigentumsverhältnis und gegebenenfalls mehrere SAP-System-/Anwenderstatus bleiben getrennt."
    },
    {
      "object": "gebaeude",
      "id": "baujahr",
      "name": "Baujahr",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "year",
      "identity": false,
      "presence": "conditional",
      "description": "Jahr der physischen Fertigstellung des Gebäudes. Renovation, Nutzungsänderung und geplante Fertigstellung sind gesonderte Sachverhalte und ersetzen das Baujahr nicht.",
      "condition": "Für fertiggestellte Gebäude erforderlich; unbekanntes Baujahr als Lücke führen und eine belegte Bauperiode ergänzen."
    },
    {
      "object": "gebaeude",
      "id": "bauperiode",
      "semantic": "constructionPeriod",
      "name": "Bauperiode",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "structured",
      "identity": false,
      "presence": "conditional",
      "description": "Bekannte Bauperiode oder ausdrücklich abgeleitete zeitliche Einteilung mit Periodenschema und Herkunft. Bekannte und abgeleitete Angaben sind zu unterscheiden; aus einer Periode wird kein scheinbar genaues Baujahr erfunden.",
      "condition": "Erforderlich, wenn nur eine Bauperiode bekannt ist oder die Auswertung eine solche Einteilung benötigt."
    },
    {
      "object": "gebaeude",
      "id": "abbruchjahr",
      "semantic": "demolitionYear",
      "name": "Abbruchjahr",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "year",
      "identity": false,
      "presence": "conditional",
      "description": "Jahr des vollständigen physischen Abbruchs. Verkauf, Ende der Nutzung und Ausscheiden aus der Bewirtschaftung sind kein Abbruchnachweis; ein Teilabbruch wird als eigenes datiertes Ereignis geführt.",
      "condition": "Für vollständig abgebrochene Gebäude erforderlich; ein unbekanntes Jahr bleibt eine Vollständigkeitslücke."
    },
    {
      "object": "gebaeude",
      "id": "geschosse-oberirdisch",
      "semantic": "aboveGroundStoreys",
      "name": "Anzahl oberirdische Geschosse",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "integer",
      "identity": false,
      "presence": "conditional",
      "description": "Anzahl oberirdischer Geschosse nach einer vereinbarten Regel für Erdgeschoss, Dachgeschosse und Zwischengeschosse, mit Quelle und massgeblichem Datum. GWR GASTW und GIS-/SAP-Zählungen werden nicht ungeprüft gleichgesetzt.",
      "condition": "Für baulich realisierte Gebäude erforderlich; unbekannte Anzahlen bleiben Vollständigkeitslücken."
    },
    {
      "object": "gebaeude",
      "id": "geschosse-unterirdisch",
      "semantic": "belowGroundStoreys",
      "name": "Anzahl unterirdische Geschosse",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "integer",
      "identity": false,
      "presence": "conditional",
      "description": "Anzahl unterirdischer Geschosse nach der vereinbarten baulichen Zählregel, mit Quelle und massgeblichem Datum. Unbekannt ist von einer bestätigten Anzahl 0 zu unterscheiden; Quellzählungen haben nicht automatisch dieselbe Bedeutung.",
      "condition": "Für baulich realisierte Gebäude erforderlich; unbekannte Anzahlen bleiben Vollständigkeitslücken."
    },
    {
      "object": "gebaeude",
      "id": "egid",
      "name": "EGID",
      "propertySet": "Registerbezug",
      "type": "identifier",
      "identity": false,
      "presence": "conditional",
      "description": "Fachliche Fremdreferenz (FK) zum zugehörigen Gebäude im Schweizer GWR, sofern dieser Registerbezug anwendbar ist. Sie ist kein Primärschlüssel des BBL-/SAP-Gebäudes. Die Zuordnung setzt übereinstimmende physische Gebäudegrenzen voraus; ausländische Gebäude benötigen keine EGID, und mehrere Kandidaten werden nicht in einem Einzelwert verkettet.",
      "keyRole": "FK",
      "condition": "Erforderlich bei anwendbarem Schweizer GWR-Bezug und bestätigter Übereinstimmung der physischen Gebäudeabgrenzung."
    },
    {
      "object": "gebaeude",
      "id": "grundstueck",
      "name": "EGRID",
      "propertySet": "Registerbezug",
      "type": "identifier",
      "identity": false,
      "presence": "conditional",
      "description": "Fachliche Fremdreferenz auf das für das Gebäude bezeichnete Grundstück im Schweizer Registerkontext. Bei mehreren Grundstücksbeziehungen bezeichnet dieser Einzelwert nur die dokumentiert ausgewählte Referenz; alle weiteren Zuordnungen bleiben separat erhalten. Eine EGRID bestimmt weder die Building ID noch automatisch eine Landparzellengeometrie.",
      "keyRole": "FK",
      "condition": "Erforderlich, sofern für das Gebäude ein massgeblicher Schweizer Grundstücksbezug mit EGRID festgelegt ist; für ausländische Gebäude keine EGRID erfinden."
    },
    {
      "object": "gebaeude",
      "id": "gebaeudekategorie",
      "name": "Gebäudekategorie (GWR)",
      "propertySet": "Klassifikation und Nutzung",
      "type": "code",
      "identity": false,
      "presence": "conditional",
      "description": "Gebäudekategorie des GWR nach Zweckbestimmung, insbesondere hinsichtlich Wohn- und Nichtwohnnutzung. Die bestehende GKAT-Referenzliste wird getrennt von BBL-Gebäudeart und Hauptnutzung verwendet.",
      "condition": "Bei einem anwendbaren GWR-Datensatz erforderlich; ohne entsprechenden Registerbezug keine Kategorie erfinden.",
      "codeList": "r-gwr-kat"
    },
    {
      "object": "gebaeude",
      "id": "gebaeudeklasse",
      "semantic": "gwrBuildingClass",
      "name": "Gebäudeklasse (GWR)",
      "propertySet": "Klassifikation und Nutzung",
      "type": "code",
      "identity": false,
      "presence": "conditional",
      "description": "Detaillierte GWR-Gebäudeklassifikation auf Grundlage der erweiterten Eurostat-Klassifikation. Sie bleibt von GKAT, BBL-Gebäudeart und Hauptnutzung getrennt; der vorhandene 4.2-Quellenstand begründet keine geprüfte 5.0-Wertelistenbindung.",
      "condition": "Bei anwendbarem GWR-Bezug erforderlich. Fehlende Werte bleiben sichtbar; die Kompatibilität des vorhandenen 4.2-Vokabulars mit 5.0 bleibt zu prüfen."
    },
    {
      "object": "gebaeude",
      "id": "eigentumsart",
      "semantic": "eigentumsart",
      "name": "Eigentumsart",
      "propertySet": "Eigentum",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Bewirtschaftungsbezogene Einordnung des Gebäudes mit den drei fachlich vorgegebenen Werten Eigentum, Anmiete oder Spezialfall. Die Zuordnung aus den SAP-Stammdaten mit ihrer Gültigkeit erhalten. Diese Kategorie ist weder die Identität des eingetragenen Eigentümers noch die grundbuchliche Eigentumsform.",
      "codeList": "profile-eigentumsart"
    },
    {
      "object": "gebaeude",
      "id": "eigentuemer",
      "semantic": "eigentuemer",
      "name": "Eigentümer",
      "propertySet": "Eigentum",
      "type": "identifier",
      "identity": false,
      "presence": "core",
      "description": "Im Grundbuch eingetragener Eigentümer im für das Gebäude massgeblichen Grundstücks- beziehungsweise Registerrechtsbezug. Die Zuordnung am Gebäude wird mit diesem Registerbezug und ihrer Gültigkeit geführt; im Ausland ist das entsprechende zuständige Register massgeblich. Mehrere Eigentümer erhalten separate Zuordnungen; eine SAP-Geschäftspartner-ID ist nur bei bestätigtem Abgleich die Referenz auf die eingetragene Person oder Organisation.",
      "keyRole": "FK"
    },
    {
      "object": "gebaeude",
      "id": "teilportfolio",
      "semantic": "teilportfolio",
      "name": "Teilportfolio",
      "propertySet": "Bewirtschaftung",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Fachliche Teilportfolio-Zuordnung des Gebäudes im BBL-Portfolio mit dem verwendeten BBL-Wert und nachvollziehbarer Gültigkeit. Teilportfolio, Teilportfoliogruppe, Wirtschaftseinheit und Profit Center sind getrennte Sachverhalte. Die BBL-Werteliste definiert die Bedeutung; das liefernde System ist separate Quelleninformation."
    },
    {
      "object": "gebaeude",
      "id": "objektstrategie",
      "semantic": "objektstrategie",
      "name": "Objektstrategie (SAP)",
      "propertySet": "Bewirtschaftung",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Fachliche Strategie für den weiteren Umgang mit dem Gebäude gemäss SAP-Stammdaten. Die im Quellsystem geführte Zuordnung mit ihrer Bedeutung und zeitlichen Gültigkeit erhalten; Objektstrategie, Teilportfolio, Hauptnutzung und aktueller Bewirtschaftungsstatus sind getrennte Angaben. Die konkrete Werteliste und technische SAP-Abbildung sind noch zu bestätigen."
    },
    {
      "object": "geschoss",
      "id": "geschoss-id",
      "name": "Geschoss-ID",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Stabile fachliche Identifikation des Geschosses im vollständigen vereinbarten Schlüsselumfang. Eine bestätigte Kennung des führenden Architektur-/Bewirtschaftungssystems kann diese Rolle erfüllen; Geschosscode, Anzeige-Reihenfolge und eine einzelne Modellobjekt-ID ersetzen die Identität nicht.",
      "keyRole": "PK"
    },
    {
      "object": "geschoss",
      "id": "building-id",
      "semantic": "buildingId",
      "name": "Building ID",
      "propertySet": "Räumliche Zuordnung",
      "type": "identifier",
      "identity": false,
      "presence": "core",
      "description": "Referenz auf das zugehörige Gebäude. Ein Geschoss hat im betrachteten Gültigkeitszeitraum genau ein fachlich übergeordnetes Gebäude; die Zuordnung verwendet dessen vollständige Building ID.",
      "keyRole": "FK"
    },
    {
      "object": "geschoss",
      "id": "geschosscode",
      "semantic": "geschosscode",
      "name": "Geschosscode",
      "propertySet": "Identifikation",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Im Gebäude verwendete Geschosskennzeichnung, beispielsweise EG, 01 oder U1. Schreibweise und führende Nullen erhalten. Der Code ist ein lokales Ordnungsmerkmal und kein weltweit eindeutiger Schlüssel."
    },
    {
      "object": "geschoss",
      "id": "bezeichnung",
      "name": "Bezeichnung",
      "propertySet": "Identifikation",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Lesbare Bezeichnung des Geschosses, beispielsweise Erdgeschoss oder Zwischengeschoss Ost. Sie bleibt von Geschosscode und stabiler Identifikation getrennt."
    },
    {
      "object": "geschoss",
      "id": "geschosslage",
      "semantic": "geschosslage",
      "name": "Geschosslage",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "code",
      "identity": false,
      "presence": "conditional",
      "description": "Zuordnung zur oberirdischen oder unterirdischen Geschosszählung nach der vereinbarten Gebäuderegel. Bei Hanglage oder Split-Level muss die Abgrenzung dokumentiert sein; weder das Vorzeichen eines Codes noch eine ungeprüfte Modellhöhe bestimmt die Zuordnung.",
      "condition": "Für baulich realisierte Geschosse erforderlich; eine ungeklärte Zuordnung bleibt eine Qualitätslücke."
    },
    {
      "object": "geschoss",
      "id": "sortierposition",
      "semantic": "sortierposition",
      "name": "Sortierposition",
      "propertySet": "Räumliche Zuordnung",
      "type": "integer",
      "identity": false,
      "presence": "optional",
      "description": "Reihenfolge des Geschosses innerhalb des Gebäudes für Navigation und Pläne. Die Position ist weder Höhenkote noch Geschossanzahl und kann ohne Änderung der Geschossidentität angepasst werden."
    },
    {
      "object": "geschoss",
      "id": "status",
      "name": "Geschossstatus",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Fachlicher Lebenszyklus des Geschosses, beispielsweise geplant, bestehend oder aufgehoben, nach einem abzustimmenden Vokabular. Katalogfreigabe und Nutzungsbelegung werden separat geführt."
    },
    {
      "object": "geschoss",
      "id": "geometriebezug",
      "semantic": "geometriebezug",
      "name": "Geometriebezug",
      "propertySet": "Geometrie",
      "type": "identifier",
      "identity": false,
      "presence": "conditional",
      "description": "Referenz auf die abgegrenzte Geschossgeometrie im verwendeten DWG-/IFC- oder Geometriebestand mit Quelle, Revision und Objektumfang. Modellkoordinaten behalten Referenzsystem, Einheit und Höhenbezug; WGS84 wird für Innenraumgeometrie nicht pauschal vorausgesetzt.",
      "keyRole": "FK",
      "condition": "Für Geschosse mit digital geführter Geometrie erforderlich."
    },
    {
      "object": "geschoss",
      "id": "gueltig-ab",
      "name": "Gültig ab",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "core",
      "description": "Beginn der fachlichen Gültigkeit des beschriebenen Geschosses. Das Datum ist nicht automatisch das Baujahr des Gebäudes, die Dateirevision oder das Änderungsdatum im Katalog."
    },
    {
      "object": "geschoss",
      "id": "gueltig-bis",
      "semantic": "gueltigBis",
      "name": "Gültig bis",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "optional",
      "description": "Ende der fachlichen Gültigkeit des beschriebenen Geschosses. Bei offener Gültigkeit bleibt der Wert leer; Änderungen an räumlichen Zuordnungen behalten ihre eigene Gültigkeit."
    },
    {
      "object": "raum",
      "id": "raum-id",
      "name": "Raum-ID",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Stabile fachliche Identifikation des Raums. Den vollständigen Schlüsselumfang des führenden Systems erhalten; eine Raumnummer, AOID oder IFC-Objektkennung wird nur nach bestätigtem Geltungsbereich gleichgesetzt. Umnummerierungen allein erzeugen keine neue Raumidentität.",
      "keyRole": "PK"
    },
    {
      "object": "raum",
      "id": "geschoss-id",
      "semantic": "geschossId",
      "name": "Geschoss-ID",
      "propertySet": "Räumliche Zuordnung",
      "type": "identifier",
      "identity": false,
      "presence": "core",
      "description": "Referenz auf das fachlich primär zugeordnete Geschoss. Jeder Raum hat für den betrachteten Zeitpunkt genau eine primäre Zuordnung; das Gebäude ergibt sich über dieses Geschoss. Weitere räumliche Bezüge werden separat geführt.",
      "keyRole": "FK"
    },
    {
      "object": "raum",
      "id": "raumnummer",
      "semantic": "raumnummer",
      "name": "Raumnummer",
      "propertySet": "Identifikation",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Im Gebäude beziehungsweise Nummerierungsplan verwendete Raumkennzeichnung. Buchstaben, Trennzeichen und führende Nullen erhalten; die lokale Eindeutigkeit und der Geltungszeitraum müssen nachvollziehbar sein."
    },
    {
      "object": "raum",
      "id": "bezeichnung",
      "name": "Bezeichnung",
      "propertySet": "Identifikation",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Lesbarer Raumname oder kurze Bezeichnung. Die Bezeichnung kann sich ändern, ohne die stabile Raumidentität oder die dokumentierte Raumnummer zu ersetzen."
    },
    {
      "object": "raum",
      "id": "raumnutzung",
      "semantic": "raumnutzung",
      "name": "Raumnutzung",
      "propertySet": "Klassifikation und Nutzung",
      "type": "code",
      "identity": false,
      "presence": "conditional",
      "description": "Fachlich bestimmte Nutzung des Raums nach dem vereinbarten BBL-Vokabular. Tatsächliche Nutzung, geplante Nutzung und Flächenklassifikation müssen unterscheidbar bleiben; eine Bezeichnung wie Büro ersetzt keine bestätigte Klassifikationszuordnung.",
      "condition": "Für genutzte Räume erforderlich; fehlende Nutzungsangaben bleiben Vollständigkeitslücken."
    },
    {
      "object": "raum",
      "id": "flaechenklassifikation",
      "semantic": "flaechenklassifikation",
      "name": "Flächenklassifikation",
      "propertySet": "Klassifikation und Nutzung",
      "type": "structured",
      "identity": false,
      "presence": "conditional",
      "description": "Für die Flächenbewirtschaftung verwendete Klassifikation des Raums mit Schema, Ausgabe und Kategorie. Eine SIA-bezogene oder andere Zuordnung muss belegt sein; Quellfelder mit ähnlichen Namen werden nicht ungeprüft gleichgesetzt. Dies ist eine Klassifikation und kein Flächenwert.",
      "condition": "Wenn der Raum für eine Auswertung nach diesem Flächenschema klassifiziert werden muss."
    },
    {
      "object": "raum",
      "id": "status",
      "name": "Raumstatus",
      "propertySet": "Bauwerk und Lebenszyklus",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Fachlicher Lebenszyklus des Raums, beispielsweise geplant, bestehend oder aufgehoben, nach einem abzustimmenden Vokabular. Leerstand, Belegung und Freigabe seiner Katalogdefinition sind davon getrennt."
    },
    {
      "object": "raum",
      "id": "geometriebezug",
      "semantic": "geometriebezug",
      "name": "Geometriebezug",
      "propertySet": "Geometrie",
      "type": "identifier",
      "identity": false,
      "presence": "conditional",
      "description": "Referenz auf die verwendete Raumgeometrie mit Dokument-/Modellrevision und eindeutigem Objektumfang. Die Quelle kann eine DWG-Raumabgrenzung oder eine IFC-Raumdarstellung sein. Referenzsystem, Einheit und Höhenbezug bleiben erhalten; ein Gebäude-Punkt beschreibt keine Raumgrenze.",
      "keyRole": "FK",
      "condition": "Für Räume mit digital geführter Geometrie erforderlich."
    },
    {
      "object": "raum",
      "id": "gueltig-ab",
      "name": "Gültig ab",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "core",
      "description": "Beginn der fachlichen Gültigkeit des beschriebenen Raums. Herkunfts-, Erfassungs- und Dateidaten sind davon getrennt; unbekannte historische Daten bleiben unbekannt."
    },
    {
      "object": "raum",
      "id": "gueltig-bis",
      "semantic": "gueltigBis",
      "name": "Gültig bis",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "optional",
      "description": "Ende der fachlichen Gültigkeit des beschriebenen Raums. Eine Aufteilung oder Zusammenlegung muss mit den Vorgänger-/Nachfolgerbezügen nachvollziehbar bleiben; eine offene Gültigkeit erhält kein erfundenes Enddatum."
    },
    {
      "object": "zone",
      "id": "zone-id",
      "semantic": "zoneId",
      "name": "Zone-ID",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Stabile fachliche Identifikation der Raumgruppe. Änderungen ihrer Bezeichnung oder einzelner Mitgliedschaften ändern die Identität nicht automatisch. Eine Quellkennung wird mit ihrem System- und Schlüsselumfang erhalten; ein bestimmtes führendes System wird nicht vorausgesetzt.",
      "keyRole": "PK"
    },
    {
      "object": "zone",
      "id": "bezeichnung",
      "semantic": "bezeichnung",
      "name": "Bezeichnung",
      "propertySet": "Identifikation",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Lesbarer Name der Zone, der sie im zuständigen Bewirtschaftungskontext unterscheidbar macht. Eine Nummer oder Abkürzung darf als Anzeige dienen, ersetzt jedoch keine stabile Zone-ID."
    },
    {
      "object": "zone",
      "id": "zonentyp",
      "semantic": "zonentyp",
      "name": "Zonentyp",
      "propertySet": "Klassifikation und Nutzung",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Art der fachlichen Gruppierung, beispielsweise Nutzungszone, Reinigungszone oder Sicherheitszone. Das BBL-Vokabular ist abzustimmen. Ein Zonentyp allein erteilt weder Zugangsrechte noch bestätigt er eine technische oder rechtliche Zonierung."
    },
    {
      "object": "zone",
      "id": "zweck-und-abgrenzung",
      "semantic": "zweckUndAbgrenzung",
      "name": "Zweck und Abgrenzung",
      "propertySet": "Bewirtschaftung",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Fachlicher Zweck der Zone und nachvollziehbare Regel für die Auswahl ihrer Räume. Festhalten, ob räumliche Nähe, gleiche Nutzung oder ein anderer Zusammenhang massgeblich ist und ob Mitgliedschaften innerhalb dieses Zwecks exklusiv sein müssen."
    },
    {
      "object": "zone",
      "id": "zonenstatus",
      "semantic": "zonenstatus",
      "name": "Zonenstatus",
      "propertySet": "Bewirtschaftung",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Fachlicher Lebenszyklus der Raumgruppe, beispielsweise geplant, aktiv oder aufgehoben. Er gilt für die Zone; Raumstatus, Gültigkeit einzelner Mitgliedschaften und Katalogfreigabe bleiben separat."
    },
    {
      "object": "zone",
      "id": "gueltig-ab",
      "semantic": "gueltigAb",
      "name": "Gültig ab",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "core",
      "description": "Beginn der fachlichen Gültigkeit der Zone. Die Zugehörigkeit eines einzelnen Raums kann innerhalb dieses Zeitraums später beginnen."
    },
    {
      "object": "zone",
      "id": "gueltig-bis",
      "semantic": "gueltigBis",
      "name": "Gültig bis",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "optional",
      "description": "Ende der fachlichen Gültigkeit der Zone. Bei offener Gültigkeit bleibt der Wert leer; Mitgliedschaften müssen zeitlich mit der Zone und dem jeweiligen Raum vereinbar sein."
    },
    {
      "object": "grundstueck",
      "id": "grundstueck-id",
      "semantic": "parcelId",
      "name": "Grundstück-ID",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Zusammengesetzter SAP-basierter Primärschlüssel der Landparzelle aus Buchungskreis, Wirtschaftseinheit und Grundstücksnummer (BBL). Die drei Bestandteile werden separat geführt; die Grundstück-ID ist deren konsistente Gesamtrepräsentation. EGRID und Grundstücksnummer (amtlich) bleiben separate Registerreferenzen.",
      "keyRole": "PK"
    },
    {
      "object": "grundstueck",
      "id": "buchungskreis",
      "semantic": "buchungskreis",
      "name": "Buchungskreis",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "SAP-Buchungskreis als erster Bestandteil der Grundstück-ID und Kontext der Wirtschaftseinheit. Den Originalwert einschliesslich führender Nullen erhalten; er ist weder Teilportfolio noch Profit Center.",
      "keyRole": "PK-Komponente"
    },
    {
      "object": "grundstueck",
      "id": "wirtschaftseinheit",
      "semantic": "wirtschaftseinheit",
      "name": "Wirtschaftseinheit",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "SAP-Nummer der Wirtschaftseinheit als zweiter Bestandteil der Grundstück-ID. Zusammen mit Buchungskreis referenziert sie genau die Wirtschaftseinheit dieses SAP-Schlüssels; die Nummer allein ist kein vollständiger Fremdschlüssel.",
      "keyRole": "PK-Komponente / FK"
    },
    {
      "object": "grundstueck",
      "id": "grundstuecksnummer-bbl",
      "semantic": "grundstuecksnummerBbl",
      "name": "Grundstücksnummer (BBL)",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Lokale BBL-Grundstücksnummer in SAP innerhalb von Buchungskreis und Wirtschaftseinheit; dritter Bestandteil der Grundstück-ID. Schreibweise und führende Nullen erhalten. Sie ist fachlich von Grundstücksnummer (amtlich), Nummerierungsbereich und EGRID getrennt.",
      "keyRole": "PK-Komponente"
    },
    {
      "object": "grundstueck",
      "id": "bezeichnung",
      "semantic": "designation",
      "name": "Bezeichnung",
      "propertySet": "Identifikation",
      "type": "text",
      "identity": false,
      "presence": "optional",
      "description": "Lesbare örtliche Bezeichnung der Parzelle, sofern eine solche verwendet wird."
    },
    {
      "object": "grundstueck",
      "id": "egrid",
      "name": "EGRID",
      "propertySet": "Registerbezug",
      "type": "identifier",
      "identity": false,
      "presence": "conditional",
      "description": "Fachliche Fremdreferenz (FK) zum Grundstück im anwendbaren Schweizer Registerkontext; kein Primärschlüssel der BBL-/SAP-Parzelle. Bei ausländischen Parzellen wird die Identität des zuständigen Registers als eigene Referenz erhalten.",
      "keyRole": "FK",
      "condition": "Erforderlich, sofern im anwendbaren Schweizer Registerkontext zugeteilt; eine nicht beschaffte EGRID bleibt eine Vollständigkeitslücke. Für ausländische Parzellen keine EGRID erfinden."
    },
    {
      "object": "grundstueck",
      "id": "parzellennummer",
      "name": "Grundstücksnummer (amtlich)",
      "propertySet": "Registerbezug",
      "type": "identifier",
      "identity": false,
      "presence": "core",
      "description": "Amtliche Nummer der eingetragenen Parzelle im zugehörigen Nummerierungsbereich. Buchstaben und führende Nullen bleiben Bestandteil des Identifikators. Sie ist kein Ersatz für Grundstücksnummer (BBL) im SAP-Schlüssel."
    },
    {
      "object": "grundstueck",
      "id": "nummerierungsbereich",
      "semantic": "numberingArea",
      "name": "Nummerierungsbereich",
      "propertySet": "Registerbezug",
      "type": "identifier",
      "identity": false,
      "presence": "core",
      "description": "Amtlicher Kontext, in dem die Grundstücksnummer (amtlich) eindeutig ist. Gemeinsam mit der amtlichen Nummer erforderlich; ein Gemeindename allein ersetzt den Nummerierungskontext nicht."
    },
    {
      "object": "grundstueck",
      "id": "grenzgeometrie",
      "semantic": "boundaryGeometry",
      "name": "Grenzgeometrie",
      "propertySet": "Geometrie",
      "type": "geometry",
      "identity": false,
      "presence": "core",
      "description": "Räumliche Grundstücksgrenze als Polygon in WGS84 (EPSG:4326), bei getrennten Flächenteilen als MultiPolygon. Aussparungen und alle Teile sowie Quelle, Version und massgebliches Datum erhalten. Bei GeoJSON gilt [Längengrad, Breitengrad]. Die separaten WGS84-Koordinaten beschreiben einen Innenpunkt und ersetzen diese Grenzgeometrie nicht.",
      "spec": {
        "coordinateReferenceSystem": "EPSG:4326"
      }
    },
    {
      "object": "grundstueck",
      "id": "rechtsstand",
      "semantic": "legalValidity",
      "name": "Rechtsstand",
      "propertySet": "Registerbezug",
      "type": "code",
      "identity": false,
      "presence": "conditional",
      "description": "Von der massgeblichen Quelle gemeldete rechtliche Gültigkeit der Parzellengrenze. Eigentum, Lieferumfang und Katalogstatus sind davon getrennt; GIS av_stat wird ohne bestätigte Bedeutung nicht gleichgesetzt.",
      "condition": "Erforderlich, wenn die Grenzgeometrie als rechtlich massgeblich verwendet wird; ein fehlender oder ungeklärter Rechtsstand bleibt eine Qualitätslücke. Keine Ableitung aus einem ungeklärten Quellstatus."
    },
    {
      "object": "grundstueck",
      "id": "eigentumsart",
      "semantic": "eigentumsart",
      "name": "Eigentumsart",
      "propertySet": "Eigentum",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Bewirtschaftungsbezogene Einordnung des Grundstücks mit den drei fachlich vorgegebenen Werten Eigentum, Anmiete oder Spezialfall. Die Zuordnung aus den SAP-Stammdaten mit ihrer Gültigkeit erhalten. Diese Kategorie ist weder die Identität des eingetragenen Eigentümers noch die grundbuchliche Eigentumsform.",
      "codeList": "profile-eigentumsart"
    },
    {
      "object": "grundstueck",
      "id": "eigentuemer",
      "semantic": "eigentuemer",
      "name": "Eigentümer",
      "propertySet": "Eigentum",
      "type": "identifier",
      "identity": false,
      "presence": "core",
      "description": "Im Grundbuch eingetragene Person oder Organisation als Eigentümer des Grundstücks; im Ausland gemäss dem zuständigen entsprechenden Register. Mehrere eingetragene Eigentümer erhalten getrennte Zuordnungen mit Registerbezug und Gültigkeit sowie dem eingetragenen Anteil, soweit anwendbar und belegt. Ein SAP-Geschäftspartner kann nach bestätigtem Abgleich referenziert werden; Vermieter, Verwalter und Katalog-Datenverantwortliche sind nicht automatisch Eigentümer.",
      "keyRole": "FK"
    },
    {
      "object": "grundstueck",
      "id": "teilportfolio",
      "semantic": "teilportfolio",
      "name": "Teilportfolio",
      "propertySet": "Bewirtschaftung",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Fachliche Teilportfolio-Zuordnung des Grundstücks im BBL-Portfolio mit dem verwendeten BBL-Wert und nachvollziehbarer Gültigkeit. Teilportfolio, Teilportfoliogruppe, Wirtschaftseinheit und Profit Center sind getrennte Sachverhalte. Die BBL-Werteliste definiert die Bedeutung; das liefernde System ist separate Quelleninformation."
    },
    {
      "object": "grundstueck",
      "id": "land",
      "semantic": "land",
      "name": "Land",
      "propertySet": "Adresse",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Land der festgelegten Grundstücksadresse oder Lagebezeichnung als separater Wert nach dem vereinbarten Ländervokabular. Das weltweite Portfolio wird nicht auf die Schweiz beschränkt."
    },
    {
      "object": "grundstueck",
      "id": "region-kanton-bundesstaat",
      "semantic": "regionKantonBundesstaat",
      "name": "Region / Kanton / Bundesstaat",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "conditional",
      "description": "Administrative Region der Grundstücksadresse oder Lagebezeichnung, beispielsweise Kanton, Bundesstaat oder Provinz. Bedeutung und Schreibweise richten sich nach dem betreffenden Land.",
      "condition": "Erforderlich, sofern die administrative Region Bestandteil der Grundstücksadresse oder Lagebezeichnung im betreffenden Land ist."
    },
    {
      "object": "grundstueck",
      "id": "ort",
      "semantic": "ort",
      "name": "Ort",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Ortsbezeichnung der festgelegten Grundstücksadresse oder Lagebezeichnung als separater Wert. Sie ist nicht automatisch identisch mit dem amtlichen Gemeindenamen."
    },
    {
      "object": "grundstueck",
      "id": "postleitzahl",
      "semantic": "postleitzahl",
      "name": "Postleitzahl",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "conditional",
      "description": "Postleitzahl der Grundstücksadresse als Text. Buchstaben, Leerzeichen, Bindestriche und führende Nullen nach dem nationalen Adresssystem erhalten; bei fehlender postalischer Adresse keinen Wert erfinden.",
      "condition": "Erforderlich, sofern der Grundstücksadresse eine Postleitzahl zugeordnet ist."
    },
    {
      "object": "grundstueck",
      "id": "strasse",
      "semantic": "strasse",
      "name": "Strasse",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "conditional",
      "description": "Strassenname der festgelegten Grundstücksadresse ohne Hausnummer, Postleitzahl oder Ort. Mehrere angrenzende Strassen bilden getrennte Lagebezüge; keine Strassenliste im Einzelwert führen.",
      "condition": "Erforderlich, sofern der Grundstücksadresse eine Strasse zugeordnet ist."
    },
    {
      "object": "grundstueck",
      "id": "adresszusatz",
      "semantic": "adresszusatz",
      "name": "Adresszusatz",
      "propertySet": "Adresse",
      "type": "text",
      "identity": false,
      "presence": "optional",
      "description": "Ergänzende örtliche Adress- oder Lageangabe zum Grundstück, soweit sie nicht in den übrigen Einzelbestandteilen enthalten ist. Keine verkettete Volladresse und keine versteckte Hausnummer; das Grundstücksprofil führt keine Hausnummer."
    },
    {
      "object": "grundstueck",
      "id": "wgs84-breitengrad",
      "semantic": "wgs84Breitengrad",
      "name": "WGS84 Breitengrad",
      "propertySet": "Geometrie",
      "type": "decimal",
      "identity": false,
      "presence": "core",
      "description": "Breitengrad eines festgelegten Punkts innerhalb der Grundstücksfläche in WGS84-Dezimalgrad, von −90 bis +90. Zusammen mit dem Längengrad bezeichnet er einen Innenpunkt für die Lageanzeige; er ist weder Grenzgeometrie noch zwingend der geometrische Schwerpunkt. 0 ist gültig und kein Platzhalter für unbekannt."
    },
    {
      "object": "grundstueck",
      "id": "wgs84-laengengrad",
      "semantic": "wgs84Laengengrad",
      "name": "WGS84 Längengrad",
      "propertySet": "Geometrie",
      "type": "decimal",
      "identity": false,
      "presence": "core",
      "description": "Längengrad desselben festgelegten Grundstücks-Innenpunkts in WGS84-Dezimalgrad, von −180 bis +180. Der Punkt muss innerhalb der zugehörigen Polygonfläche und ausserhalb ihrer Aussparungen liegen. Quelle und Gültigkeit bleiben nachvollziehbar; 0 ist gültig und kein Platzhalter für unbekannt."
    },
    {
      "object": "wirtschaftseinheit",
      "id": "wirtschaftseinheit-id",
      "semantic": "economicUnitId",
      "name": "Wirtschaftseinheit-ID",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Zusammengesetzter SAP-basierter Primärschlüssel der Wirtschaftseinheit aus Buchungskreis und Wirtschaftseinheit (SAP-WE-Nummer). Beide Bestandteile werden separat geführt; die Wirtschaftseinheit-ID ist deren konsistente Gesamtrepräsentation. Die WE-Nummer allein oder ein Profit Center ersetzt den vollständigen Schlüssel nicht.",
      "keyRole": "PK"
    },
    {
      "object": "wirtschaftseinheit",
      "id": "buchungskreis",
      "name": "Buchungskreis",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "SAP-Buchungskreis als erster Bestandteil der Wirtschaftseinheit-ID. Den Originalwert einschliesslich führender Nullen erhalten; er bildet den Schlüsselkontext der WE-Nummer.",
      "keyRole": "PK-Komponente"
    },
    {
      "object": "wirtschaftseinheit",
      "id": "we-nummer",
      "name": "Wirtschaftseinheit",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "SAP-WE-Nummer innerhalb des Buchungskreises als zweiter Bestandteil der Wirtschaftseinheit-ID. Sie ist die Nummer, die auch in den Gebäuden und Grundstücken dieses SAP-WE-Bezugs geführt wird; eine Bezeichnung ersetzt sie nicht.",
      "keyRole": "PK-Komponente"
    },
    {
      "object": "wirtschaftseinheit",
      "id": "bezeichnung",
      "name": "Bezeichnung",
      "propertySet": "Identifikation",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Lesbarer Name der wirtschaftlichen Bewirtschaftungseinheit."
    },
    {
      "object": "wirtschaftseinheit",
      "id": "bewirtschaftungszweck",
      "semantic": "managementPurpose",
      "name": "Bewirtschaftungszweck",
      "propertySet": "Bewirtschaftung",
      "type": "text",
      "identity": false,
      "presence": "core",
      "description": "Kurze fachliche Erklärung, weshalb die Immobilienobjekte gemeinsam bewirtschaftet werden und wo die Abgrenzung dieser Zusammenfassung liegt."
    },
    {
      "object": "wirtschaftseinheit",
      "id": "bewirtschaftungsstatus",
      "semantic": "managementStatus",
      "name": "Bewirtschaftungsstatus",
      "propertySet": "Bewirtschaftung",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Fachlicher Lebenszyklus der Bewirtschaftungseinheit, etwa geplant, aktiv oder abgeschlossen. Bedeutungen und BBL-Vokabular sind noch abzustimmen; die Freigabe der Katalogdefinition ist davon unabhängig."
    },
    {
      "object": "wirtschaftseinheit",
      "id": "gueltig-ab",
      "semantic": "validFrom",
      "name": "Gültig ab",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "core",
      "description": "Beginn der fachlichen Gültigkeit der wirtschaftlichen Zusammenfassung. Nach Etablierung der Einheit benötigt; unbekannte historische Daten werden nicht aus Katalog- oder Importdaten abgeleitet."
    },
    {
      "object": "wirtschaftseinheit",
      "id": "gueltig-bis",
      "semantic": "validTo",
      "name": "Gültig bis",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "optional",
      "description": "Ende der fachlichen Gültigkeit der wirtschaftlichen Zusammenfassung. Bis zum Abschluss darf die Gültigkeit offen bleiben; ein Enddatum wird nicht erfunden."
    },
    {
      "object": "bemessung",
      "id": "bemessung-id",
      "name": "Bemessung-ID",
      "propertySet": "Identifikation",
      "type": "identifier",
      "identity": true,
      "presence": "core",
      "description": "Stabile Identifikation einer Bemessungsaussage; fachliche Revisionen bleiben nachvollziehbar.",
      "keyRole": "PK"
    },
    {
      "object": "bemessung",
      "id": "bemessungsart",
      "semantic": "measurementKind",
      "name": "Bemessungsart",
      "propertySet": "Messwert",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Art der bestimmten Grösse im Grundprofil: Geschossfläche GF, vermietbare Fläche VMF, Gebäudevolumen GV, Gebäudegrundfläche GGF oder Grundstücksfläche GSF. Die lokale Entwurfswerteliste verwendet diese fünf Fachkürzel; sie behauptet keine identischen SAP-Bemessungscodes. Oberirdisch, unterirdisch und Gesamtwert werden separat im Bemessungsumfang angegeben.",
      "codeList": "profile-bemessungsart"
    },
    {
      "object": "bemessung",
      "id": "bemessungsumfang",
      "semantic": "bemessungsumfang",
      "name": "Bemessungsumfang",
      "propertySet": "Messwert",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Räumlicher Umfang der Bemessung: GESAMT, OBERIRDISCH oder UNTERIRDISCH. Am Gebäude verwenden GF und GV je Umfang eine eigene Bemessung. GF am Geschoss sowie VMF, GGF und GSF werden im hier beschriebenen Profil als GESAMT ihres jeweiligen Bezugsobjekts geführt. Für GF und GV die jeweilige ober-/unterirdische Abgrenzungsregel und ihren Bezug zur Geschosszählung dokumentieren; eine Geschosslage allein bestimmt keine Flächen- oder Volumenaufteilung. Ein unbekannter Umfang bleibt unbekannt und wird nicht als Gesamtwert ausgegeben.",
      "codeList": "profile-bemessungsumfang"
    },
    {
      "object": "bemessung",
      "id": "wert",
      "semantic": "value",
      "name": "Wert",
      "propertySet": "Messwert",
      "type": "decimal",
      "identity": false,
      "presence": "core",
      "description": "Numerischer Flächen- oder Volumenwert. Für eine verwendbare Bemessung benötigt; ein unbekannter Wert ist von der Zahl 0 zu unterscheiden und wird nicht durch 0 ersetzt."
    },
    {
      "object": "bemessung",
      "id": "einheit",
      "semantic": "unit",
      "name": "Einheit",
      "propertySet": "Messwert",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Zur Bemessungsart passende Einheit: m² für GF, VMF, GGF und GSF; m³ für GV. Eine dokumentierte Umrechnung erhält die ursprüngliche Einheit und Herkunft. Flächen- und Volumenwerte werden weder verwechselt noch gemeinsam summiert.",
      "codeList": "profile-messeinheit"
    },
    {
      "object": "bemessung",
      "id": "bemessungsgrundlage",
      "semantic": "measurementBasis",
      "name": "Bemessungsgrundlage",
      "propertySet": "Nachweis und Methode",
      "type": "structured",
      "identity": false,
      "presence": "core",
      "description": "Angewendete Bemessungsregel mit ihrer tatsächlich verwendeten Ausgabe und Objektabgrenzung. Für GF, GV und GGF die dokumentierte SIA-416-Grundlage angeben; für GSF die tatsächlich verwendete amtliche, SIA-basierte oder geometrische Grundlage erhalten; für VMF die bestätigte Vermietungsflächenregel, gegebenenfalls SIA D 0165 oder eine dokumentierte BBL-Regel. Amtliche Grundstücksflächen und geometrisch berechnete Werte behalten ihre jeweilige Grundlage. Keine Normausgabe aus einem Feldnamen ableiten."
    },
    {
      "object": "bemessung",
      "id": "quelle",
      "semantic": "quelle",
      "name": "Quelle",
      "propertySet": "Nachweis und Methode",
      "type": "identifier",
      "identity": false,
      "presence": "core",
      "description": "Referenz auf die konkrete Quelldatei in der verwendeten Revision, vorzugsweise ein DWG- oder IFC-Modell. Bei manueller Ermittlung oder Übernahme auf das Messprotokoll beziehungsweise den belegenden Nachweis verweisen. Dokument-ID oder dauerhafte URI und unveränderliche Revision machen die Datei auffindbar; Dateiname oder Format allein genügen nicht. Bei mehreren Dateien je Quelle eine separate Zuordnung führen.",
      "keyRole": "FK"
    },
    {
      "object": "bemessung",
      "id": "ermittlungsart",
      "semantic": "derivationMethod",
      "name": "Ermittlungsart",
      "propertySet": "Nachweis und Methode",
      "type": "code",
      "identity": false,
      "presence": "core",
      "description": "Art der Wertermittlung: vorzugsweise modellbasiert aus DWG/IFC abgeleitet; alternativ manuell gemessen, aus einem dokumentierten Nachweis übernommen, aus bestehenden Bemessungen berechnet oder ausdrücklich geschätzt. Bei einer Berechnung Ausgangsbemessungen, deren Revisionen und die Rechenregel dokumentieren. Das Methodenvokabular ist ein Entwurf. Manuelle Eingabe eines bereits modellbasiert ermittelten Werts ändert dessen Ermittlungsart nicht."
    },
    {
      "object": "bemessung",
      "id": "gueltig-ab",
      "name": "Gültig ab",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "core",
      "description": "Datum, ab dem der Wert für das Bezugsobjekt gilt. Für stichtagsbezogene Auswertungen benötigt; unbekannte Daten bleiben unbekannt. Das Datum ist weder automatisch Erhebungsdatum noch Bearbeitungsdatum des Katalogs."
    },
    {
      "object": "bemessung",
      "id": "gueltig-bis",
      "semantic": "validTo",
      "name": "Gültig bis",
      "propertySet": "Gültigkeit",
      "type": "date",
      "identity": false,
      "presence": "optional",
      "description": "Ende der Anwendbarkeit des Werts auf das Bezugsobjekt. Bei offener Gültigkeit wird kein Enddatum erfunden."
    }
  ],
  "retire": [
    {
      "id": "bemessung/bezeichnung",
      "reason": "Lesbare Bezeichnung aus Art und Bezugsobjekt ableiten; kein separates editierbares Fachattribut im vorliegenden Profil."
    },
    {
      "id": "bemessung/status",
      "reason": "Im Fachprofil durch typisierte Bemessungsangaben ersetzen; der Status der Katalogdefinition bleibt separat erhalten."
    },
    {
      "id": "gebaeude/energietraeger",
      "reason": "Mit dem Energiemodell bearbeiten; kein universeller einzelner Gebäudewert im vorliegenden Profil."
    },
    {
      "id": "grundstueck/eigentumsform",
      "reason": "Eigentümer, Recht/Vertrag, Anteil und Gültigkeit fachlich trennen; Eigentumsform und Baurecht nicht als ungeprüften Code zusammenfassen."
    },
    {
      "id": "grundstueck/flaeche",
      "reason": "Amtliche Grundstücksfläche als typisierte Bemessung führen und von berechneten Flächen unterscheiden."
    },
    {
      "id": "grundstueck/gemeinde",
      "reason": "Standortgemeinde als identifizierbare Ortsbeziehung vorsehen."
    },
    {
      "id": "wirtschaftseinheit/profit-center",
      "reason": "Finanzzuordnung oder Systemabbildung; keine ungeprüfte Gleichsetzung mit der Wirtschaftseinheit."
    }
  ],
  "codeLists": [
    {
      "id": "profile-bemessungsart",
      "name": "BBL Basisbemessungen – Bemessungsart",
      "object": "bemessung",
      "description": "Lokales BBL-Grundprofil mit fünf Bemessungsarten. Keine SAP-Customizing-Codes und keine vollständige SIA-Hierarchie; jede Aussage behält ihre tatsächliche Bemessungsgrundlage.",
      "values": [
        {
          "code": "GF",
          "name": "Geschossfläche GF",
          "description": "Geschossfläche des Bezugsgebäudes oder Bezugsgeschosses nach der dokumentierten SIA-416-Grundlage, in m². Am Gebäude getrennt nach GESAMT, OBERIRDISCH und UNTERIRDISCH; am Geschoss als GESAMT dieses Geschosses. Eine Netto-Raumfläche ist nicht automatisch GF."
        },
        {
          "code": "VMF",
          "name": "Vermietbare Fläche VMF",
          "description": "Für die Vermietung bestimmte Fläche des jeweiligen Bezugsobjekts nach der bestätigten Vermietungsflächenregel, in m². Eine Verwendung für Raum oder Zone setzt eine entsprechende, belegte Bezugsabgrenzung voraus. Im Grundprofil Umfang GESAMT; Vermietbarkeit und tatsächlich vermietete Fläche unterscheiden. SIA D 0165 nur bei entsprechender Bemessungsgrundlage angeben."
        },
        {
          "code": "GV",
          "name": "Gebäudevolumen GV",
          "description": "Volumen des Bezugsgebäudes nach der dokumentierten SIA-416-Grundlage, in m³. Im Grundprofil je eine Bemessung für GESAMT, OBERIRDISCH und UNTERIRDISCH führen."
        },
        {
          "code": "GGF",
          "name": "Gebäudegrundfläche GGF",
          "description": "Gebäudegrundfläche des Bezugsgebäudes nach der dokumentierten SIA-416-Grundlage, in m² und Umfang GESAMT. Der tatsächliche bodenbezogene Umfang muss belegt sein; sie ist weder die Summe der Geschossflächen noch automatisch eine Dachprojektion. Eine Grundstückssumme aus mehreren Gebäudegrundflächen ist eine andere Bezugsabgrenzung."
        },
        {
          "code": "GSF",
          "name": "Grundstücksfläche GSF",
          "description": "Fläche des Bezugsgrundstücks, in m² und Umfang GESAMT. SIA-416-basierte, amtlich übernommene und geometrisch ermittelte Werte behalten ihre jeweils dokumentierte Herkunft und Grundlage; die Verwendung des Fachkürzels bescheinigt keine Normkonformität. Keine vollständige Grundstücksfläche auf jedes zugeordnete Gebäude duplizieren."
        }
      ]
    },
    {
      "id": "profile-bemessungsumfang",
      "name": "BBL Basisbemessungen – Bemessungsumfang",
      "object": "bemessung",
      "description": "Gesamtwert oder ober-/unterirdischer Teil im dokumentierten Bezugsumfang. GF und GV am Gebäude verwenden alle drei Umfänge; andere Grundprofilwerte GESAMT ihres Bezugsobjekts.",
      "values": [
        {
          "code": "GESAMT",
          "name": "Gesamtwert",
          "description": "Wert für den gesamten vereinbarten Bezugsumfang der jeweiligen Bemessungsart. Bei GF und GV am Gebäude umfasst er oberirdische und unterirdische Teile; am Geschoss oder Raum bezeichnet GESAMT den gesamten dort definierten Bezugsumfang. Einen vorhandenen Gesamtwert erhalten; keine automatische Neuberechnung und keine Addition zu seinen Teilwerten."
        },
        {
          "code": "OBERIRDISCH",
          "name": "Oberirdisch",
          "description": "Oberirdischer Teil einer GF- oder GV-Bemessung nach der dokumentierten Abgrenzungsregel. Den Bezug zur Geschosszählung dokumentieren, ohne deren Kategorien als geometrische Aufteilung vorauszusetzen; der Wert wird nicht aus einer Geschossanzahl geschätzt."
        },
        {
          "code": "UNTERIRDISCH",
          "name": "Unterirdisch",
          "description": "Unterirdischer Teil einer GF- oder GV-Bemessung nach derselben für die betreffende Bemessungsart dokumentierten Abgrenzungsregel wie ihr oberirdischer Teil. Eine bestätigte Abwesenheit unterirdischer Teile kann den Wert 0 ergeben; unbekannte Werte bleiben unbekannt."
        }
      ]
    },
    {
      "id": "profile-eigentumsart",
      "name": "BBL Eigentumsart",
      "description": "Vorgegebene BBL-Bewirtschaftungskategorien für Gebäude und Grundstücke. Die lokalen Codes verwenden die vereinbarten Bezeichnungen; technische SAP-Codes und ihre Abbildung bleiben zu bestätigen. Keine grundbuchliche Eigentumsform.",
      "values": [
        {
          "code": "Eigentum",
          "name": "Eigentum",
          "description": "Vereinbarte Kategorie der BBL-Eigentumsart: Eigentum. Keine Aussage zur Identität der eingetragenen Eigentümerschaft."
        },
        {
          "code": "Anmiete",
          "name": "Anmiete",
          "description": "Vereinbarte Kategorie der BBL-Eigentumsart: Anmiete. Keine Aussage zur Identität der eingetragenen Eigentümerschaft."
        },
        {
          "code": "Spezialfall",
          "name": "Spezialfall",
          "description": "Vereinbarte Kategorie der BBL-Eigentumsart: Spezialfall. Keine Aussage zur Identität der eingetragenen Eigentümerschaft."
        }
      ]
    },
    {
      "id": "profile-messeinheit",
      "name": "BBL Basisbemessungen – Einheit",
      "object": "bemessung",
      "description": "Einheiten des kompakten Flächen-/Volumenprofils. Keine SAP-Einheitenkennungen und keine automatische Umrechnung.",
      "values": [
        {
          "code": "m²",
          "name": "Quadratmeter",
          "description": "Flächeneinheit für GF, VMF, GGF und GSF."
        },
        {
          "code": "m³",
          "name": "Kubikmeter",
          "description": "Volumeneinheit für GV."
        }
      ]
    }
  ],
  "baseline": {
    "objects": [
      {
        "id": "bemessung",
        "revision": 1,
        "status": "draft"
      },
      {
        "id": "gebaeude",
        "revision": 1,
        "status": "draft"
      },
      {
        "id": "geschoss",
        "revision": 1,
        "status": "draft"
      },
      {
        "id": "grundstueck",
        "revision": 1,
        "status": "draft"
      },
      {
        "id": "raum",
        "revision": 1,
        "status": "draft"
      },
      {
        "id": "wirtschaftseinheit",
        "revision": 1,
        "status": "draft"
      }
    ],
    "attributes": [
      {
        "id": "bemessung/bemessung-id",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "bemessung/bezeichnung",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "bemessung/gueltig-ab",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "bemessung/status",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "gebaeude/baujahr",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "gebaeude/bezeichnung",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "gebaeude/egid",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "gebaeude/energietraeger",
        "revision": 1,
        "status": "draft",
        "rules": []
      },
      {
        "id": "gebaeude/gebaeudekategorie",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "gebaeude/gebaeudestatus",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "gebaeude/grundstueck",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "geschoss/bezeichnung",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "geschoss/geschoss-id",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "geschoss/gueltig-ab",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "geschoss/status",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "grundstueck/egrid",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "grundstueck/eigentumsform",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "grundstueck/flaeche",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "grundstueck/gemeinde",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "grundstueck/parzellennummer",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "raum/bezeichnung",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "raum/gueltig-ab",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "raum/raum-id",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "raum/status",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "wirtschaftseinheit/bezeichnung",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "wirtschaftseinheit/buchungskreis",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      },
      {
        "id": "wirtschaftseinheit/profit-center",
        "revision": 1,
        "status": "draft",
        "rules": []
      },
      {
        "id": "wirtschaftseinheit/we-nummer",
        "revision": 1,
        "status": "draft",
        "rules": [
          "required"
        ]
      }
    ],
    "references": [
      {
        "id": "r-gwr-kat",
        "revision": 1,
        "status": "valid",
        "values": [
          {
            "id": "r-gwr-kat/1010",
            "code": "1010",
            "revision": 1
          },
          {
            "id": "r-gwr-kat/1020",
            "code": "1020",
            "revision": 1
          },
          {
            "id": "r-gwr-kat/1030",
            "code": "1030",
            "revision": 1
          },
          {
            "id": "r-gwr-kat/1040",
            "code": "1040",
            "revision": 1
          },
          {
            "id": "r-gwr-kat/1060",
            "code": "1060",
            "revision": 1
          },
          {
            "id": "r-gwr-kat/1080",
            "code": "1080",
            "revision": 1
          }
        ]
      }
    ]
  },
  "expectedChanges": 161,
  "measurements": [
    {
      "id": "profile-bemessung-gebaeude",
      "target": "gebaeude",
      "notes": "Basisprofil Gebäude: GF und GV je GESAMT, OBERIRDISCH und UNTERIRDISCH; VMF und GGF jeweils GESAMT. VMF nur bei anwendbarer Vermietungsflächenregel. Jede Aussage hat genau dieses Gebäude als Bezugsobjekt; Quelle, Grundlage, Einheit, Beobachtung und Gültigkeit erhalten. Keine automatischen Summen."
    },
    {
      "id": "profile-bemessung-grundstueck",
      "target": "grundstueck",
      "notes": "Erforderlicher Profilwert Grundstücksfläche: GSF / GESAMT / m² mit genau diesem Grundstück als Bezugsobjekt. Amtliche, geometrische und SIA-basierte Aussagen anhand von Quelle, Grundlage und Gültigkeit unterscheiden; den für Zweck/Stichtag ausgewählten Wert kenntlich machen. Ersetzt den unabhängig gepflegten numerischen Profilwert Fläche, nicht die Anforderung Grundstücksfläche."
    },
    {
      "id": "profile-bemessung-geschoss",
      "target": "geschoss",
      "notes": "GF / GESAMT / m² für ein Geschoss mit anwendbarer dokumentierter SIA-416-Grundlage. GESAMT ist relativ zu diesem Geschoss und kein Gebäudegesamtwert. Quelle, Grundlage und Gültigkeit erhalten."
    },
    {
      "id": "profile-bemessung-raum",
      "target": "raum",
      "notes": "VMF / GESAMT / m² nur bei anwendbarer und belegter Vermietungsflächenregel für diesen Raum. Keine Gleichsetzung einer Netto-Raumfläche mit GF. Quelle, Grundlage und Gültigkeit erhalten."
    },
    {
      "id": "profile-bemessung-zone",
      "target": "zone",
      "notes": "Optionaler VMF / GESAMT / m² für diese Zone bei begründetem Bezugsumfang. Mitgliedschaftsstichtag, beitragende Bemessungen mit Revision, Rechenregel und Dateinachweis erhalten. Mehrfachzugehörigkeit von Räumen rechtfertigt keine Addition überlappender Zonensummen."
    }
  ]
}
  $proposal$::jsonb;
  fingerprint text;
  previous_fingerprint text;
  item jsonb;
  child jsonb;
  expected_ids text[];
  actual_ids text[];
  object_row catalog.business_object;
  attribute_row catalog.business_attribute;
  change_count integer := 0;
  record_uuid uuid;
  object_uuid uuid;
  code_uuid uuid;
  core_rule_uuid uuid;
  rule_uuid uuid;
  rule_identifier text;
  attribute_identifier text;
  note text;
  is_new boolean;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the entire update as postgres in the Supabase SQL Editor';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Business-object profiles already applied; no records or history changed';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = 'json-catalog-v1') THEN
    RAISE EXCEPTION 'Apply the original catalog import first';
  END IF;
  IF EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = 'business-object-profiles-20260907-v1') THEN
    RAISE EXCEPTION 'The superseded profile update was applied; prepare an incremental update from that state';
  END IF;

  SELECT array_agg(a->>'id' ORDER BY a->>'id') INTO expected_ids
    FROM jsonb_array_elements(proposal->'baseline'->'attributes') a;
  SELECT array_agg(a.identifier::text ORDER BY a.identifier::text) INTO actual_ids
    FROM catalog.business_attribute a JOIN catalog.business_object o ON o.id = a.business_object_id
    WHERE o.identifier IN (SELECT x->>'id' FROM jsonb_array_elements(proposal->'objects') x);
  IF actual_ids IS DISTINCT FROM expected_ids THEN
    RAISE EXCEPTION 'Attribute scope differs from the reviewed 28-record baseline; review existing changes';
  END IF;
  IF EXISTS (
    SELECT FROM jsonb_array_elements(proposal->'baseline'->'objects') b
    LEFT JOIN catalog.business_object o ON o.identifier = b->>'id'
    WHERE o.id IS NULL OR o.row_version <> (b->>'revision')::bigint OR o.status <> b->>'status'
  ) OR EXISTS (
    SELECT FROM jsonb_array_elements(proposal->'baseline'->'attributes') b
    LEFT JOIN catalog.business_attribute a ON a.identifier = b->>'id'
    WHERE a.id IS NULL OR a.row_version <> (b->>'revision')::bigint OR a.status <> b->>'status'
      OR (SELECT o.identifier::text FROM catalog.business_object o WHERE o.id = a.business_object_id) <> split_part(b->>'id', '/', 1)
  ) THEN
    RAISE EXCEPTION 'Stale profile baseline: expected six objects and 28 attributes at draft revision 1';
  END IF;
  IF EXISTS (SELECT FROM catalog.business_object WHERE identifier IN
      (SELECT x->>'id' FROM jsonb_array_elements(proposal->'objects') x)
      AND num_nonnulls(description_it, description_fr, description_en) > 0)
    OR EXISTS (SELECT FROM catalog.business_attribute WHERE identifier = ANY(expected_ids)
      AND num_nonnulls(name_it, name_fr, name_en, description_it, description_fr, description_en) > 0) THEN
    RAISE EXCEPTION 'Translated definitions need review before this German-language update';
  END IF;
  IF EXISTS (SELECT FROM catalog.business_object WHERE identifier IN
      (SELECT x->>'id' FROM jsonb_array_elements(proposal->'objects') x WHERE x->>'create' = 'true'))
    OR EXISTS (SELECT FROM catalog.business_attribute WHERE identifier IN
      (SELECT (a->>'object') || '/' || (a->>'id') FROM jsonb_array_elements(proposal->'attributes') a WHERE a ? 'semantic'))
    OR EXISTS (SELECT FROM catalog.quality_requirement WHERE identifier = 'profile-core'
      OR identifier IN (SELECT 'profile-' || (a->>'object') || '/' || (a->>'id')
        FROM jsonb_array_elements(proposal->'attributes') a WHERE a->>'presence' = 'conditional'))
    OR EXISTS (SELECT FROM catalog.code_list WHERE identifier IN
      (SELECT l->>'id' FROM jsonb_array_elements(proposal->'codeLists') l))
    OR EXISTS (SELECT FROM catalog.code_value WHERE identifier IN
      (SELECT (l->>'id') || '/' || (v->>'code') FROM jsonb_array_elements(proposal->'codeLists') l,
        LATERAL jsonb_array_elements(l->'values') v)) THEN
    RAISE EXCEPTION 'A proposed new object/attribute/rule/code identifier already exists; refusing to overwrite it';
  END IF;
  -- Child assignments have no row revision: compare their complete imported collection.
  IF EXISTS (
    SELECT FROM jsonb_array_elements(proposal->'baseline'->'attributes') b
    JOIN catalog.business_attribute a ON a.identifier = b->>'id'
    WHERE (SELECT COALESCE(jsonb_agg(q.identifier ORDER BY q.identifier), '[]'::jsonb)
      FROM catalog.business_attribute_quality_requirement aq
      JOIN catalog.quality_requirement q ON q.id = aq.quality_requirement_id WHERE aq.business_attribute_id = a.id)
      IS DISTINCT FROM b->'rules'
  ) THEN
    RAISE EXCEPTION 'Quality assignments differ from the imported baseline; review the existing rules';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'baseline'->'references') LOOP
    SELECT id INTO code_uuid FROM catalog.code_list
      WHERE identifier = item->>'id' AND row_version = (item->>'revision')::bigint AND status = item->>'status';
    IF NOT FOUND THEN RAISE EXCEPTION 'Expected reviewed GWR code list at its checked revision: %', item->>'id'; END IF;
    IF (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', v.identifier, 'code', v.code, 'revision', v.row_version)
        ORDER BY v.identifier), '[]'::jsonb) FROM catalog.code_value v WHERE v.code_list_id = code_uuid)
      IS DISTINCT FROM item->'values' THEN
      RAISE EXCEPTION 'Reviewed vocabulary values changed: %', item->>'id';
    END IF;
  END LOOP;

  IF EXISTS (SELECT FROM catalog.relationship r
      JOIN catalog.business_object s ON s.id = r.source_business_object_id
      JOIN catalog.business_object t ON t.id = r.target_business_object_id
      WHERE r.relationship_type = 'measuredFor' AND s.identifier = 'bemessung'
        AND t.identifier IN (SELECT m->>'target' FROM jsonb_array_elements(proposal->'measurements') m))
    OR EXISTS (SELECT FROM catalog.relationship WHERE identifier IN
      (SELECT m->>'id' FROM jsonb_array_elements(proposal->'measurements') m)) THEN
    RAISE EXCEPTION 'Measurement relationship scope changed; review existing assertions before applying';
  END IF;

  INSERT INTO catalog.quality_requirement AS q
    (identifier, name_de, description_de, comment, status, rule_type, dimension, created_on, modified_on)
  VALUES ('profile-core', 'Kernangabe für das BBL-Fachprofil',
    'Für den im Attribut beschriebenen fachlichen Anwendungsfall erforderlich. Fehlende oder unbekannte Werte bleiben Vollständigkeitslücken. Keine technische NOT-NULL-, Eindeutigkeits- oder Wertebereichsvorgabe.',
    proposal->>'source', 'draft', 'required', 'completeness', edited_on, edited_on)
  RETURNING q.id INTO core_rule_uuid;
  change_count := change_count + 1;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'objects') LOOP
    note := concat_ws(E'\n\n', 'Fachprofil (Entwurf). ' || (proposal->>'source'), item->>'notes', proposal->>'sharedNotes');
    IF item->>'create' = 'true' THEN
      -- Zone belongs to the same business domain as Raum; do not copy its governance assertions.
      INSERT INTO catalog.business_object AS o
        (identifier, name_de, description_de, comment, domain_id, status, created_on, modified_on)
      SELECT item->>'id', item->>'name', item->>'description', note, source.domain_id, 'draft', edited_on, edited_on
        FROM catalog.business_object source WHERE source.identifier = item->>'domainFrom'
      RETURNING o.id INTO STRICT record_uuid;
      change_count := change_count + 1;
    ELSE
      SELECT * INTO STRICT object_row FROM catalog.business_object WHERE identifier = item->>'id' FOR UPDATE;

      UPDATE catalog.business_object AS o
        SET description_de = item->>'description', comment = concat_ws(E'\n\n', object_row.comment, note),
          status = 'draft', modified_on = edited_on
        WHERE o.id = object_row.id AND o.row_version = 1
        RETURNING o.id INTO STRICT record_uuid;
      change_count := change_count + 1;
    END IF;
  END LOOP;

  -- Only the explicit local profile vocabularies are created. Existing reference lists survive.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'codeLists') LOOP
    object_uuid := NULL;
    IF item ? 'object' THEN
      SELECT id INTO STRICT object_uuid FROM catalog.business_object WHERE identifier = item->>'object';
    END IF;
    INSERT INTO catalog.code_list AS l
      (identifier, name_de, description_de, comment, business_object_id, status, created_on, modified_on)
    VALUES (item->>'id', item->>'name', item->>'description', proposal->>'source', object_uuid, 'draft', edited_on, edited_on)
    RETURNING l.id INTO code_uuid;
    change_count := change_count + 1;
    FOR child IN SELECT * FROM jsonb_array_elements(item->'values') LOOP
      INSERT INTO catalog.code_value AS v
        (identifier, code_list_id, code, name_de, description_de, comment, created_on, modified_on)
      VALUES ((item->>'id') || '/' || (child->>'code'), code_uuid, child->>'code', child->>'name',
        child->>'description', 'Lokaler Entwurfswert. ' || (proposal->>'source'), edited_on, edited_on)
      RETURNING v.id INTO record_uuid;
      change_count := change_count + 1;
    END LOOP;
  END LOOP;

  -- Existing catalog relation type; candidate metadata requirements, not actual asset measurements.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'measurements') LOOP
    SELECT id INTO STRICT object_uuid FROM catalog.business_object WHERE identifier = item->>'target';
    INSERT INTO catalog.relationship AS r
      (identifier, source_business_object_id, target_business_object_id, relationship_type,
        verification_status, rule_notes_de, comment, created_on, modified_on)
    SELECT item->>'id', source.id, object_uuid, 'measuredFor', 'candidate',
      item->>'notes', 'Vorgeschlagene Profilanforderung. ' || (proposal->>'source'), edited_on, edited_on
      FROM catalog.business_object source WHERE source.identifier = 'bemessung'
    RETURNING r.id INTO STRICT record_uuid;
    change_count := change_count + 1;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'attributes') LOOP
    attribute_identifier := (item->>'object') || '/' || (item->>'id');
    SELECT id INTO STRICT object_uuid FROM catalog.business_object WHERE identifier = item->>'object';
    is_new := item ? 'semantic';

    code_uuid := NULL;
    rule_uuid := NULL;
    IF item ? 'codeList' THEN
      SELECT id INTO STRICT code_uuid FROM catalog.code_list WHERE identifier = item->>'codeList';
    END IF;
    note := 'Fachprofil (Entwurf). ' || (proposal->>'source') ||
      E'\nProperty Set (vorgeschlagen): ' || (item->>'propertySet') || E'\n' ||
      CASE item->>'presence'
        WHEN 'core' THEN 'Kernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt.'
        WHEN 'conditional' THEN 'Bedingte Angabe: ' || (item->>'condition')
        ELSE 'Optionale Angabe: nützlich, aber keine Voraussetzung für den vorgesehenen Anwendungsfall.' END;
    IF item ? 'keyRole' THEN
      note := note || E'\nSchlüsselrolle: ' || (item->>'keyRole') ||
        CASE
          WHEN item->>'keyRole' LIKE 'PK-Komponente%' THEN
            ' (Teil des zusammengesetzten fachlichen Schlüssels; allein nicht eindeutig. Ein WE-FK gilt nur gemeinsam mit Buchungskreis).'
          WHEN item->>'keyRole' = 'FK' THEN
            ' (interne oder externe fachliche Referenz; keine neu implementierte physische Datenbankbeziehung).'
          ELSE ' (vollständiger fachlicher Primärschlüssel; von der Katalog-UUID getrennt).' END;
    END IF;
    IF NOT is_new THEN
      SELECT * INTO STRICT attribute_row FROM catalog.business_attribute WHERE identifier = attribute_identifier FOR UPDATE;

      note := concat_ws(E'\n\n', attribute_row.comment, note);
    END IF;

    IF item->>'presence' = 'core' THEN rule_uuid := core_rule_uuid;
    ELSIF item->>'presence' = 'conditional' THEN
      rule_identifier := 'profile-' || attribute_identifier;
      INSERT INTO catalog.quality_requirement AS q
        (identifier, name_de, description_de, comment, status, rule_type, dimension, created_on, modified_on)
      VALUES (rule_identifier, 'Bedingte Vollständigkeit: ' || (item->>'name'), item->>'condition',
        proposal->>'source', 'draft', 'custom', 'completeness', edited_on, edited_on)
      RETURNING q.id INTO rule_uuid;
      change_count := change_count + 1;
    END IF;

    IF is_new THEN
      INSERT INTO catalog.business_attribute(identifier, business_object_id, semantic_name, name_de, description_de, comment,
        status, value_specification, is_identifier, code_list_id, created_on, modified_on)
      VALUES (attribute_identifier, object_uuid, item->>'semantic', item->>'name', item->>'description', note, 'draft',
        jsonb_build_object('valueType', item->>'type') || COALESCE(item->'spec', '{}'::jsonb),
        (item->>'identity')::boolean, code_uuid, edited_on, edited_on)
      RETURNING id INTO record_uuid;
    ELSE
      UPDATE catalog.business_attribute AS a SET name_de = item->>'name', description_de = item->>'description', comment = note,
        status = 'draft', value_specification = jsonb_build_object('valueType', item->>'type') || COALESCE(item->'spec', '{}'::jsonb),
        is_identifier = (item->>'identity')::boolean, code_list_id = code_uuid, modified_on = edited_on
      WHERE a.id = attribute_row.id AND a.row_version = 1 RETURNING a.id INTO STRICT record_uuid;
      DELETE FROM catalog.business_attribute_quality_requirement WHERE business_attribute_id = record_uuid;
    END IF;
    IF rule_uuid IS NOT NULL THEN
      INSERT INTO catalog.business_attribute_quality_requirement(business_attribute_id, quality_requirement_id) VALUES (record_uuid, rule_uuid);
    END IF;

    change_count := change_count + 1;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'retire') LOOP
    SELECT * INTO STRICT attribute_row FROM catalog.business_attribute WHERE identifier = item->>'id' FOR UPDATE;

    UPDATE catalog.business_attribute AS a SET status = 'retired', modified_on = edited_on,
      comment = concat_ws(E'\n\n', attribute_row.comment, 'Aus dem Fachprofil genommen. ' || (item->>'reason'), proposal->>'source')
      WHERE a.id = attribute_row.id AND a.row_version = 1 RETURNING a.id INTO STRICT record_uuid;
    -- Keep historical definitions, rules and relationships; active projections suppress retired endpoints.

    change_count := change_count + 1;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'objects') LOOP
    IF (SELECT count(*) FROM catalog.business_attribute a JOIN catalog.business_object o ON o.id = a.business_object_id
      WHERE o.identifier = item->>'id' AND a.status <> 'retired') <> (item->>'count')::integer THEN
      RAISE EXCEPTION 'Unexpected active attribute count for %; rolling back', item->>'id';
    END IF;
  END LOOP;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$profiles$;

-- The current UI also lists retired attributes. These counts separate the active profile.
SELECT o.identifier AS business_object,
  count(*) FILTER (WHERE a.status <> 'retired') AS active_attributes,
  count(*) FILTER (WHERE a.status = 'retired') AS retired_attributes
FROM catalog.business_object o JOIN catalog.business_attribute a ON a.business_object_id = o.id
WHERE o.identifier IN ('gebaeude','geschoss','raum','zone','grundstueck','wirtschaftseinheit','bemessung')
GROUP BY o.identifier ORDER BY o.identifier;

COMMIT;
