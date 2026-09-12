-- Markdown synchronization to the 106-attribute proposal: adds Geometrie/Höhenlage/
-- Höhenbezug (Geschoss), Geometrie (Raum), Geometrie/Geometriebezug (Zone) and the
-- Bemessung subject fields; extends Bemessungsart to twelve kinds and units to m;
-- moves Teilportfolio/Objektstrategie to Portfoliomanagement; Raumnutzung becomes optional.
-- Source: docs/business-object-attribute-proposal.md (7 September 2026, 106 Attribute).
-- Standalone content update AFTER business-object-profiles-20260907-v2 and
-- business-object-labels-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 44 record edits/creates: 7 object updates, 10 attribute updates, 8 attribute creates,
-- 2 code-list updates, 4 value updates, 8 value creates, 3 measurement-note updates,
-- 2 rule updates; plus 8 core-rule assignments and 1 removed conditional assignment.
-- No change-log entries are generated. Existing IDs, history and grants survive.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $geometry$
DECLARE
  operation_id constant text := 'business-object-geometry-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute",
  "requiresOperation": "business-object-labels-20260907-v1",
  "expectedChanges": 44,
  "counts": {
    "gebaeude": 32,
    "geschoss": 13,
    "raum": 11,
    "zone": 9,
    "grundstueck": 21,
    "wirtschaftseinheit": 8,
    "bemessung": 12
  },
  "unassign": [
    {
      "attribute": "raum/raumnutzung",
      "rule": "profile-raum/raumnutzung"
    }
  ],
  "changes": [
    {
      "kind": "business_object",
      "id": "gebaeude",
      "revision": 3,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Gebäudenummer; die Bestandteile sind getrennte Attribute, die Gebäude-ID ihre abgeleitete Gesamtrepräsentation. Änderungen der Schlüsselbestandteile erhalten datierte Alt-/Neuschlüsselbezüge. Die physische Abgrenzung ist mit dem SAP-Objekt abzugleichen. EGID und die ausgewählte EGRID bleiben bedingte Schweizer Referenzen; sämtliche Grundstücksbeziehungen behalten Quelle, Rechtsbezug und Gültigkeit. Eigentumsart und eingetragene Eigentümer sind getrennt; Eigentümerzuordnungen erhalten Registerkontext und belegte Anteile, keine automatisch geerbten Eigentümer. Teilportfolio ist ein BBL-Begriff; Objektstrategie ist eine eigene SAP-Quellangabe mit noch abzustimmendem Vokabular. Sieben atomare Komponenten beschreiben die Hauptadresse; weitere Adressen/Eingänge sind eigene Zuordnungen. Geometrie ist ein WGS84-Punkt, identisch mit den beiden Einzelkoordinaten; GeoJSON verwendet [Längengrad, Breitengrad]. Grundriss und Gebäudehülle (AO) bleiben getrennt und erhalten. Primäre Raumstruktur: Gebäude – Geschoss – Raum; Zonen haben eigene Raumzuordnungen. Basisbemessungen in Bemessung: GF und GV jeweils GESAMT, OBERIRDISCH, UNTERIRDISCH; VMF und GGF jeweils GESAMT. Keine zusätzlichen numerischen Flächen-/Volumenattribute oder automatischen Summen. Geschosszählung und GF/GV-Aufteilung erhalten getrennte, aufeinander bezogene Regeln. GWR GKAT ist als vorhandene Referenz gebunden; GKLAS und die weltweite Verwendung von GSTAT bleiben ungeprüft und ungebunden. Historische Quellenverweise sind keine Normkonformitäts- oder Abdeckungsbestätigung.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Gebäudenummer; die Bestandteile sind getrennte Attribute, die Gebäude-ID ihre abgeleitete Gesamtrepräsentation. Änderungen der Schlüsselbestandteile erhalten datierte Alt-/Neuschlüsselbezüge. Die physische Abgrenzung ist mit dem SAP-Objekt abzugleichen. EGID und die ausgewählte EGRID bleiben bedingte Schweizer Referenzen; sämtliche Grundstücksbeziehungen behalten Quelle, Rechtsbezug und Gültigkeit. Eigentumsart und eingetragene Eigentümer sind getrennt; Eigentümerzuordnungen erhalten Registerkontext und belegte Anteile, keine automatisch geerbten Eigentümer. Teilportfolio und Objektstrategie gehören zum Property Set Portfoliomanagement; Teilportfolio ist ein BBL-Begriff, Objektstrategie eine eigene SAP-Quellangabe mit noch abzustimmendem Vokabular. Sieben atomare Komponenten beschreiben die Hauptadresse; weitere Adressen/Eingänge sind eigene Zuordnungen. Geometrie ist ein WGS84-Punkt, identisch mit den beiden Einzelkoordinaten; GeoJSON verwendet [Längengrad, Breitengrad]. Grundriss und Gebäudehülle (AO) bleiben getrennt und erhalten. Primäre Raumstruktur: Gebäude – Geschoss – Raum; Zonen haben eigene Raumzuordnungen. Basisbemessungen in Bemessung: GF und GV jeweils GESAMT, OBERIRDISCH, UNTERIRDISCH; VMF und GGF jeweils GESAMT. Keine zusätzlichen numerischen Flächen-/Volumenattribute oder automatischen Summen. Geschosszählung und GF/GV-Aufteilung erhalten getrennte, aufeinander bezogene Regeln. GWR GKAT ist als vorhandene Referenz gebunden; GKLAS und die weltweite Verwendung von GSTAT bleiben ungeprüft und ungebunden. Historische Quellenverweise sind keine Normkonformitäts- oder Abdeckungsbestätigung.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_object",
      "id": "geschoss",
      "revision": 3,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nGenau ein primäres Gebäude pro fachlichem Zeitpunkt; Gebäude-ID referenziert den vollständigen SAP-Gebäudeschlüssel. Geschoss-ID bleibt von Geschosscode, Sortierposition und einzelnen Modellkennungen getrennt. Vollständige Geschosse, Teilgeschosse und reine Modell-/Referenzebenen sind vor einer Zählung zu unterscheiden. Geschosslage betrifft die Zählregel und entscheidet nicht allein über ober-/unterirdische Flächen oder Volumen. Geometriebezüge erhalten DWG-/IFC-Revision, abgegrenzte Modellobjekte, Koordinatensystem, Einheit und Höhenbezug. GF kann als Bemessung mit Bezugsobjekt Geschoss und Umfang GESAMT dieses Geschosses geführt werden; keine ungeprüfte Gleichsetzung mit Netto-Raumflächen. Zeitliche Zuordnung und Historie bei Änderungen erhalten.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nGenau ein primäres Gebäude pro fachlichem Zeitpunkt; Gebäude-ID referenziert den vollständigen SAP-Gebäudeschlüssel. Geschoss-ID bleibt von Geschosscode, Sortierposition und einzelnen Modellkennungen getrennt. Vollständige Geschosse, Teilgeschosse und reine Modell-/Referenzebenen sind vor einer Zählung zu unterscheiden. Geschosslage betrifft die Zählregel und entscheidet nicht allein über ober-/unterirdische Flächen oder Volumen. Geometrie umfasst 2D-Kontur und/oder 3D-Geometrie mit gekennzeichneter GF-/AGF-Kontur; Geometriebezüge erhalten DWG-/IFC-Revision, abgegrenzte Modellobjekte, Koordinatensystem, Einheit und Höhenbezug. Höhenlage ist die OKFF-Kote des Geschosses relativ zum separat dokumentierten Höhenbezug; die Geschosshöhe bleibt die getrennte Boden-zu-Boden-Distanz zur festgelegten darüberliegenden Bodenebene. Basisbemessungen in Bemessung: GF, AGF und GV jeweils GESAMT dieses Geschosses sowie Geschosshöhe bei definiertem Bezug; keine ungeprüfte Gleichsetzung mit Netto-Raumflächen. Zeitliche Zuordnung und Historie bei Änderungen erhalten.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_object",
      "id": "raum",
      "revision": 2,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nPrimäre Zuordnung: genau ein Geschoss zum betrachteten Zeitpunkt; das Gebäude ergibt sich daraus. Mehrgeschossige Räume behalten weitere betroffene Geschossbezüge, ohne Raum oder Volumen mehrfach zu zählen. Raumnummern sind lokale, zeitlich gültige Kennzeichnungen; Raum-ID und Vorgänger-/Nachfolgerbezüge bleiben bei Umnummerierungen, Teilungen und Zusammenlegungen nachvollziehbar. Raumstatus ist weder Leerstand noch Katalogfreigabe. Flächenklassifikation enthält Schema/Ausgabe/Kategorie und ist kein numerischer Flächenwert. Digitale Geometriebezüge bewahren Datei-/Modellrevision, Umfang und Quell-Koordinatensystem. VMF nur bei anwendbarer Vermietungsflächenregel als eigene Bemessung mit Umfang GESAMT des Raums. Ein Raum kann null, einer oder mehreren Zonen angehören. Eigentum und Teilportfolio werden nicht als unabhängig editierbare Raumangaben kopiert.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nPrimäre Zuordnung: genau ein Geschoss zum betrachteten Zeitpunkt; das Gebäude ergibt sich daraus. Mehrgeschossige Räume behalten weitere betroffene Geschossbezüge, ohne Raum oder Volumen mehrfach zu zählen. Raumnummern sind lokale, zeitlich gültige Kennzeichnungen; Raum-ID und Vorgänger-/Nachfolgerbezüge bleiben bei Umnummerierungen, Teilungen und Zusammenlegungen nachvollziehbar. Raumstatus ist weder Leerstand noch Katalogfreigabe. Raumnutzung ist eine optionale betriebliche Funktionsangabe; Flächenklassifikation führt SIA-416-, DIN-277- und IPMS-Zuordnungen parallel mit Schema, Ausgabe, Kategorie und Nachweis und ist kein numerischer Flächenwert. Geometrie umfasst 2D-Raumkontur und/oder 3D-Raumkörper; digitale Geometriebezüge bewahren Datei-/Modellrevision, Umfang und Quell-Koordinatensystem. Basisbemessungen in Bemessung: Raumfläche, Raumhöhe (lichte Höhe von OKFF bis zur fertigen Deckenunterseite) und Raumvolumen jeweils GESAMT des Raums; VMF nur bei anwendbarer Vermietungsflächenregel. Ein Raum kann null, einer oder mehreren Zonen angehören. Eigentum und Teilportfolio werden nicht als unabhängig editierbare Raumangaben kopiert.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_object",
      "id": "zone",
      "revision": 1,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nZone ist eine zeitlich gültige Sammlung ganzer Räume für einen bestimmten Zweck; Property Set ist dagegen eine Gruppe von Attributdefinitionen. Separate Raumzuordnungen enthalten Zone-ID, Raum-ID, Gültig ab und Gültig bis; keine verkettete Raumliste und keine obligatorische einzelne Zone-ID am Raum. Eine aktive Zone benötigt im vorgeschlagenen Profil mindestens einen Raum, eine geplante Zone darf noch leer sein. Mehrere Zonen pro Raum sind erlaubt; Exklusivität und vollständige Abdeckung gelten nur innerhalb eines ausdrücklich definierten Zonierungsschemas und Zeitraums, nicht allein aufgrund des Zonentyp-Labels. Geschossübergreifende Zonen sind möglich, gebäudeübergreifende nur mit dokumentierter Begründung. Teilraum- und verschachtelte Zonen sind ausserhalb des ersten Profils. Keine eigene Geometrie oder automatisch aggregierte Fläche. Optionaler VMF-Gesamtwert bleibt eine eigene Bemessung mit Bezugsobjekt Zone, Mitgliedschaftsstichtag und nachvollziehbaren beitragenden Bemessungen. Mitgliedschaftsregeln sind hier Anforderungen; dieses Inhaltsupdate führt keine neuen Beziehungstypen oder Instanztabellen ein.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nZone ist eine zeitlich gültige Sammlung ganzer Räume für einen bestimmten Zweck; Property Set ist dagegen eine Gruppe von Attributdefinitionen. Separate Raumzuordnungen enthalten Zone-ID, Raum-ID, Gültig ab und Gültig bis; keine verkettete Raumliste und keine obligatorische einzelne Zone-ID am Raum. Eine aktive Zone benötigt im vorgeschlagenen Profil mindestens einen Raum, eine geplante Zone darf noch leer sein. Mehrere Zonen pro Raum sind erlaubt; Exklusivität und vollständige Abdeckung gelten nur innerhalb eines ausdrücklich definierten Zonierungsschemas und Zeitraums, nicht allein aufgrund des Zonentyp-Labels. Geschossübergreifende Zonen sind möglich, gebäudeübergreifende nur mit dokumentierter Begründung. Teilraum- und verschachtelte Zonen sind ausserhalb des ersten Profils. Geometrie stellt die zum Stichtag zugeordneten ganzen Räume dar, nach Geschoss und Bezugsrahmen gegliedert; der Geometriebezug referenziert die Darstellung beziehungsweise ihren Ableitungsdatensatz mit Quelle, Revision und Eingabereferenzen. Basisbemessungen in Bemessung: Zonenfläche und Zonenvolumen jeweils GESAMT sowie optionaler VMF-Gesamtwert, je mit Bezugsobjekt Zone, Mitgliedschaftsstichtag und nachvollziehbaren beitragenden Bemessungen; keine automatisch aggregierte Fläche. Mitgliedschaftsregeln sind hier Anforderungen; dieses Inhaltsupdate führt keine neuen Beziehungstypen oder Instanztabellen ein.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_object",
      "id": "grundstueck",
      "revision": 3,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Grundstücksnummer, mit getrennten Komponenten. Grundstücksnummer (amtlich) mit Nummerierungsbereich sowie EGRID bleiben separate Registerangaben; BBL- und amtliche Nummer werden nicht gleichgesetzt. Das Profil betrifft Landparzellen; andere Grundstücksrechte behalten eigenen Rechtskontext. Sechs atomare Adress-/Lagekomponenten, ohne Hausnummer. Grenzgeometrie in WGS84 als Polygon oder MultiPolygon, einschliesslich Aussparungen und aller Teile; GeoJSON verwendet [Längengrad, Breitengrad]. Die beiden Einzelkoordinaten sind ein ausgewählter Innenpunkt einer dokumentierten Komponente, kein angenommener Schwerpunkt; gegen die gültige Geometrierevision prüfen. Eigentumsart: Eigentum / Anmiete / Spezialfall; Eigentümer: im zuständigen Register eingetragene Personen/Organisationen, jeweils mit Rechtsbezug, Gültigkeit und belegtem anwendbarem Anteil. Teilportfolio ist eine BBL-Zuordnung. Erforderlicher Profilwert Grundstücksfläche: zugeordnete Bemessung GSF / GESAMT / m². Amtliche und berechnete Flächen bleiben separate Aussagen mit Quelle/Grundlage, keine gegenseitige Überschreibung oder numerische Kopie an jedes Gebäude. Standortgemeinde, sämtliche Gebäudebeziehungen und Rechte bleiben separate datierte Bezüge.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Grundstücksnummer, mit getrennten Komponenten. Grundstücksnummer (amtlich) mit Nummerierungsbereich sowie EGRID bleiben separate Registerangaben; BBL- und amtliche Nummer werden nicht gleichgesetzt. Das Profil betrifft Landparzellen; andere Grundstücksrechte behalten eigenen Rechtskontext. Sechs atomare Adress-/Lagekomponenten, ohne Hausnummer. Grenzgeometrie in WGS84 als Polygon oder MultiPolygon, einschliesslich Aussparungen und aller Teile; GeoJSON verwendet [Längengrad, Breitengrad]. Die beiden Einzelkoordinaten sind ein ausgewählter Innenpunkt einer dokumentierten Komponente, kein angenommener Schwerpunkt; gegen die gültige Geometrierevision prüfen. Eigentumsart: Eigentum / Anmiete / Spezialfall; Eigentümer: im zuständigen Register eingetragene Personen/Organisationen, jeweils mit Rechtsbezug, Gültigkeit und belegtem anwendbarem Anteil. Teilportfolio ist eine BBL-Zuordnung im Property Set Portfoliomanagement. Erforderlicher Profilwert Grundstücksfläche: zugeordnete Bemessung GSF / GESAMT / m². Amtliche und berechnete Flächen bleiben separate Aussagen mit Quelle/Grundlage, keine gegenseitige Überschreibung oder numerische Kopie an jedes Gebäude. Standortgemeinde, sämtliche Gebäudebeziehungen und Rechte bleiben separate datierte Bezüge.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_object",
      "id": "wirtschaftseinheit",
      "revision": 2,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit (SAP-WE-Nummer), mit beiden Komponenten als Einzelattributen. Buchungskreis ist ausdrücklich Teil der Identität; WE-Nummer allein ist nicht der vollständige Schlüssel. Die bisherigen Katalog-Identitäten für Buchungskreis und WE-Nummer werden wiederverwendet. Der Schlüsselbestandteil Wirtschaftseinheit an Gebäude/Grundstück referenziert gemeinsam mit Buchungskreis diese primäre SAP-WE; andere wirtschaftliche Gruppierungen sind getrennte Beziehungen. Umgliederungen erhalten Alt-/Neuschlüssel und gültige Mitgliedschaften, ohne allein daraus eine neue physische Immobilie abzuleiten. Profit Center und Teilportfolio sind getrennte Angaben. Verantwortliche Organisationen/Personen und relevante Verträge behalten ihre eigenen Beziehungen und Gültigkeiten.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit (SAP-WE-Nummer), mit beiden Komponenten als Einzelattributen. Buchungskreis ist ausdrücklich Teil der Identität; WE-Nummer allein ist nicht der vollständige Schlüssel. Die bisherigen Katalog-Identitäten für Buchungskreis und WE-Nummer werden wiederverwendet. Der Schlüsselbestandteil Wirtschaftseinheit an Gebäude/Grundstück referenziert gemeinsam mit Buchungskreis diese primäre SAP-WE; andere wirtschaftliche Gruppierungen sind getrennte Beziehungen. Umgliederungen erhalten Alt-/Neuschlüssel und gültige Mitgliedschaften, ohne allein daraus eine neue physische Immobilie abzuleiten. Profit Center und Teilportfolio sind getrennte Angaben. Verantwortliche Organisationen/Personen und relevante Verträge behalten ihre eigenen Beziehungen und Gültigkeiten.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_object",
      "id": "bemessung",
      "revision": 2,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nGenau ein typisiertes Bezugsobjekt pro Aussage: Gebäude, Grundstück, Geschoss, Raum oder Zone. Eine ID darf nicht gleichzeitig den Gebäudegesamtwert und einen beitragenden Geschosswert bezeichnen. Lokale Bemessungsarten: GF, VMF, GV, GGF, GSF. GF/GV am Gebäude jeweils GESAMT, OBERIRDISCH, UNTERIRDISCH; VMF/GGF am Gebäude und GSF am Grundstück jeweils GESAMT. GF am Geschoss: GESAMT dieses Geschosses; VMF am Raum nur bei Anwendbarkeit, an Zone optional mit begründetem Umfang. GF, VMF, GGF und GSF in m², GV in m³. Quelle ist die konkrete Quelldatei mit unveränderlicher Revision, vorzugsweise DWG/IFC; mehrere Quellen sind getrennte Zuordnungen. Objekt-/Geometrieauswahl und Extraktionsregel mit Version erhalten. Datei, Bemessungsgrundlage und Ermittlungsart sind verschieden. Die Basis nennt die tatsächlich verwendete Normausgabe/Regel; GF/GV/GGF nach dokumentierter SIA-Grundlage, GSF amtlich/SIA/geometrisch unterscheidbar, VMF nach bestätigter Vermietungsflächenregel. Dateiformat allein beweist keine modellbasierte Ableitung. Manuelle Ausnahmen erhalten Nachweisdatei, Grund und wer/wann/wie; unbekannt ist kein Nullwert. Berechnete Aussagen erhalten Eingangs-Bemessungen mit Revision, Formel, Stichtag und versioniertem Dateinachweis. Werte sind nichtnegativ, Zeitbezug und Genauigkeit bleiben erhalten. Gesamt = oberirdisch + unterirdisch nur für vollständig vergleichbare, nicht überlappende Teilwerte und mit dokumentierter Rundung prüfen. Keine automatischen Summen, Normzertifizierung oder technischen SAP-Codegleichsetzungen.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte.",
        "description_de": "Ein fachlich bestimmter Flächen- oder Volumenwert für genau ein Bezugsobjekt und einen definierten Umfang, mit Einheit, dokumentierter Quelle, Bemessungsgrundlage, Ermittlungsart und zeitlicher Gültigkeit."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nGenau ein typisiertes Bezugsobjekt pro Aussage: Bezugsobjekttyp und Bezugsobjekt-ID sind explizite Attribute und bezeichnen Gebäude, Grundstück, Geschoss, Raum oder Zone. Eine ID darf nicht gleichzeitig den Gebäudegesamtwert und einen beitragenden Geschosswert bezeichnen. Lokale Bemessungsarten: GF, AGF, GV, VMF, GGF, GSF, Geschosshöhe, Raumfläche, Raumhöhe, Raumvolumen, Zonenfläche und Zonenvolumen. GF/GV am Gebäude jeweils GESAMT, OBERIRDISCH, UNTERIRDISCH; VMF/GGF am Gebäude und GSF am Grundstück jeweils GESAMT. GF, AGF und GV am Geschoss sowie Raumfläche, Raumhöhe, Raumvolumen, Zonenfläche und Zonenvolumen jeweils GESAMT ihres Bezugsobjekts; Geschosshöhe bei definiertem Bezug; VMF am Raum nur bei Anwendbarkeit, an Zone optional mit begründetem Umfang. Flächen in m², Volumen in m³, Höhen in m. Quelle ist die konkrete Quelldatei mit unveränderlicher Revision, vorzugsweise DWG/IFC; mehrere Quellen sind getrennte Zuordnungen. Objekt-/Geometrieauswahl und Extraktionsregel mit Version erhalten. Datei, Bemessungsgrundlage und Ermittlungsart sind verschieden. Die Basis nennt die tatsächlich verwendete Normausgabe/Regel; GF/AGF/GV/GGF nach dokumentierter SIA-Grundlage, GSF amtlich/SIA/geometrisch unterscheidbar, VMF nach bestätigter Vermietungsflächenregel; SIA 416, DIN 277, IPMS und BBL-Regeln bleiben unterscheidbar. Geschosshöhe und Raumhöhe erhalten ihre Bezugsflächen und Messregel. Dateiformat allein beweist keine modellbasierte Ableitung. Manuelle Ausnahmen erhalten Nachweisdatei, Grund und wer/wann/wie; unbekannt ist kein Nullwert. Berechnete Aussagen erhalten Eingangs-Bemessungen mit Revision, Formel, Stichtag und versioniertem Dateinachweis. Werte sind nichtnegativ, Zeitbezug und Genauigkeit bleiben erhalten. Gesamt = oberirdisch + unterirdisch nur für vollständig vergleichbare, nicht überlappende Teilwerte und mit dokumentierter Rundung prüfen. Keine automatischen Summen, Normzertifizierung oder technischen SAP-Codegleichsetzungen.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte.",
        "description_de": "Ein fachlich bestimmter Flächen-, Volumen- oder Längenwert für genau ein Bezugsobjekt und einen definierten Umfang, mit Einheit, dokumentierter Quelle, Bemessungsgrundlage, Ermittlungsart und zeitlicher Gültigkeit."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/teilportfolio",
      "revision": 1,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\nProperty Set (vorgeschlagen): Bewirtschaftung\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Portfoliomanagement\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/objektstrategie",
      "revision": 2,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\nProperty Set (vorgeschlagen): Bewirtschaftung\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Portfoliomanagement\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/teilportfolio",
      "revision": 1,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\nProperty Set (vorgeschlagen): Bewirtschaftung\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Portfoliomanagement\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/raumnutzung",
      "revision": 1,
      "before": {
        "description_de": "Fachlich bestimmte Nutzung des Raums nach dem vereinbarten BBL-Vokabular. Tatsächliche Nutzung, geplante Nutzung und Flächenklassifikation müssen unterscheidbar bleiben; eine Bezeichnung wie Büro ersetzt keine bestätigte Klassifikationszuordnung.",
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\nProperty Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Für genutzte Räume erforderlich; fehlende Nutzungsangaben bleiben Vollständigkeitslücken."
      },
      "after": {
        "description_de": "Betriebliche Funktion des Raums, beispielsweise Büro, Besprechung oder Lager, mit tatsächlicher beziehungsweise geplanter Nutzung und zeitlichem Bezug. Ein lokales Nutzungsvokabular bleibt möglich; dieses Feld enthält keine vermischte Werteliste aus SIA 416, DIN 277 und IPMS. Die normbezogene Einordnung wird separat als Flächenklassifikation geführt.",
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Klassifikation und Nutzung\nOptionale Angabe: nützlich, aber keine Voraussetzung für den vorgesehenen Anwendungsfall."
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/flaechenklassifikation",
      "revision": 1,
      "before": {
        "description_de": "Für die Flächenbewirtschaftung verwendete Klassifikation des Raums mit Schema, Ausgabe und Kategorie. Eine SIA-bezogene oder andere Zuordnung muss belegt sein; Quellfelder mit ähnlichen Namen werden nicht ungeprüft gleichgesetzt. Dies ist eine Klassifikation und kein Flächenwert.",
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\nProperty Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Wenn der Raum für eine Auswertung nach diesem Flächenschema klassifiziert werden muss."
      },
      "after": {
        "description_de": "Norm- beziehungsweise schemabezogene Zuordnung der Raumfläche mit Schema, tatsächlich verwendeter Ausgabe, Kategoriecode, Kategoriename, Gültigkeit und Nachweis. SIA 416, DIN 277 sowie anwendbare IPMS-Messkategorien oder Komponenten werden separat geführt. Pro Schema und Zuordnung eine eigene strukturierte Aussage; mehrere parallele Zuordnungen sind zulässig. Die Bestandteile werden als getrennte Felder geführt. Eine Kategorie ist kein Flächenwert und keine automatische Übersetzung in ein anderes Schema.",
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Wenn die Raumfläche für eine Auswertung nach dem betreffenden Schema klassifiziert werden muss."
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bemessungsart",
      "revision": 1,
      "before": {
        "description_de": "Art der bestimmten Grösse im Grundprofil: Geschossfläche GF, vermietbare Fläche VMF, Gebäudevolumen GV, Gebäudegrundfläche GGF oder Grundstücksfläche GSF. Die lokale Entwurfswerteliste verwendet diese fünf Fachkürzel; sie behauptet keine identischen SAP-Bemessungscodes. Oberirdisch, unterirdisch und Gesamtwert werden separat im Bemessungsumfang angegeben."
      },
      "after": {
        "description_de": "Art der bestimmten Grösse: GF, AGF, GV, VMF, GGF, GSF sowie Geschosshöhe, Raumfläche, Raumhöhe, Raumvolumen, Zonenfläche und Zonenvolumen. Die zwölf Einträge der lokalen Entwurfswerteliste unterscheiden das Messkonzept; Bezugsobjekt, Umfang und konkrete Bemessungsgrundlage bleiben zusätzlich erforderlich. Die Codes behaupten keine identischen SAP-, SIA-, DIN- oder IPMS-Codes."
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bemessungsumfang",
      "revision": 1,
      "before": {
        "description_de": "Räumlicher Umfang der Bemessung: GESAMT, OBERIRDISCH oder UNTERIRDISCH. Am Gebäude verwenden GF und GV je Umfang eine eigene Bemessung. GF am Geschoss sowie VMF, GGF und GSF werden im hier beschriebenen Profil als GESAMT ihres jeweiligen Bezugsobjekts geführt. Für GF und GV die jeweilige ober-/unterirdische Abgrenzungsregel und ihren Bezug zur Geschosszählung dokumentieren; eine Geschosslage allein bestimmt keine Flächen- oder Volumenaufteilung. Ein unbekannter Umfang bleibt unbekannt und wird nicht als Gesamtwert ausgegeben."
      },
      "after": {
        "description_de": "Räumlicher Umfang der Bemessung: GESAMT, OBERIRDISCH oder UNTERIRDISCH. Am Gebäude verwenden GF und GV je Umfang eine eigene Bemessung. Am Geschoss gelten GF, AGF und GV als GESAMT dieses Geschosses. Die übrigen Profilwerte verwenden GESAMT ihres jeweiligen Bezugsobjekts; bei Höhen bezeichnet dies die dokumentierte Höhenangabe und keine Summe. Für GF und GV die ober-/unterirdische Abgrenzungsregel und ihren Bezug zur Geschosszählung dokumentieren. Ein unbekannter Umfang wird nicht als Gesamtwert ausgegeben."
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/wert",
      "revision": 1,
      "before": {
        "description_de": "Numerischer Flächen- oder Volumenwert. Für eine verwendbare Bemessung benötigt; ein unbekannter Wert ist von der Zahl 0 zu unterscheiden und wird nicht durch 0 ersetzt."
      },
      "after": {
        "description_de": "Numerischer Flächen-, Volumen- oder Längenwert. Für eine verwendbare Bemessung benötigt; ein unbekannter Wert ist von der Zahl 0 zu unterscheiden und wird nicht durch 0 ersetzt. Höhenkoten werden als Höhenlage mit Höhenbezug am Geschoss geführt; sie sind keine Distanzbemessungen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/einheit",
      "revision": 1,
      "before": {
        "description_de": "Zur Bemessungsart passende Einheit: m² für GF, VMF, GGF und GSF; m³ für GV. Eine dokumentierte Umrechnung erhält die ursprüngliche Einheit und Herkunft. Flächen- und Volumenwerte werden weder verwechselt noch gemeinsam summiert."
      },
      "after": {
        "description_de": "Zur Bemessungsart passende Einheit: m² für GF, AGF, VMF, GGF, GSF, Raumfläche und Zonenfläche; m³ für GV, Raumvolumen und Zonenvolumen; m für Geschosshöhe und Raumhöhe. Eine dokumentierte Umrechnung erhält die ursprüngliche Einheit und Herkunft. Flächen-, Volumen- und Längenwerte werden nicht verwechselt oder gemeinsam summiert."
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bemessungsgrundlage",
      "revision": 1,
      "before": {
        "description_de": "Angewendete Bemessungsregel mit ihrer tatsächlich verwendeten Ausgabe und Objektabgrenzung. Für GF, GV und GGF die dokumentierte SIA-416-Grundlage angeben; für GSF die tatsächlich verwendete amtliche, SIA-basierte oder geometrische Grundlage erhalten; für VMF die bestätigte Vermietungsflächenregel, gegebenenfalls SIA D 0165 oder eine dokumentierte BBL-Regel. Amtliche Grundstücksflächen und geometrisch berechnete Werte behalten ihre jeweilige Grundlage. Keine Normausgabe aus einem Feldnamen ableiten."
      },
      "after": {
        "description_de": "Angewendete Bemessungsregel mit Schema/Norm, tatsächlich verwendeter Ausgabe, Messkategorie, Objektgrenzen und Abzügen. SIA 416, DIN 277, IPMS und BBL-Regeln bleiben unterscheidbar. Für GF, AGF, GV und GGF die dokumentierte SIA-416-Grundlage erhalten; für GSF die tatsächliche amtliche, SIA-basierte oder geometrische Grundlage, für VMF die bestätigte Vermietungsflächenregel. Geschosshöhe und Raumhöhe erhalten ihre Bezugsflächen und Messregel. Raum- und Zonenwerte dokumentieren die gewählte Flächen-/Volumenregel; berechnete Zonenwerte zusätzlich ihre Eingaben und deren Grenzen. Die Bestandteile werden getrennt geführt. Eine schematische Kategoriezuordnung ersetzt keinen Nachweis der Berechnung."
      }
    },
    {
      "kind": "code_list",
      "id": "profile-bemessungsart",
      "revision": 1,
      "before": {
        "description_de": "Lokales BBL-Grundprofil mit fünf Bemessungsarten. Keine SAP-Customizing-Codes und keine vollständige SIA-Hierarchie; jede Aussage behält ihre tatsächliche Bemessungsgrundlage.",
        "comment": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "description_de": "Lokale BBL-Entwurfswerteliste mit zwölf Bemessungsarten für Gebäude-, Grundstücks-, Geschoss-, Raum- und Zonenwerte. Keine SAP-Customizing-Codes und keine vollständige SIA- oder Normhierarchie; jede Aussage behält ihre tatsächliche Bemessungsgrundlage.",
        "comment": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute"
      }
    },
    {
      "kind": "code_list",
      "id": "profile-messeinheit",
      "revision": 1,
      "before": {
        "description_de": "Einheiten des kompakten Flächen-/Volumenprofils. Keine SAP-Einheitenkennungen und keine automatische Umrechnung.",
        "comment": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "description_de": "Einheiten des kompakten Flächen-, Volumen- und Längenprofils. Keine SAP-Einheitenkennungen und keine automatische Umrechnung.",
        "comment": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute"
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/GV",
      "revision": 1,
      "before": {
        "name_de": "Gebäudevolumen GV",
        "description_de": "Volumen des Bezugsgebäudes nach der dokumentierten SIA-416-Grundlage, in m³. Im Grundprofil je eine Bemessung für GESAMT, OBERIRDISCH und UNTERIRDISCH führen."
      },
      "after": {
        "name_de": "Volumen GV",
        "description_de": "Volumen des Bezugsgebäudes oder der abgegrenzte Volumenanteil eines Bezugsgeschosses nach der dokumentierten Grundlage, in m³. Im SIA-bezogenen Profil am Gebäude je GESAMT, OBERIRDISCH und UNTERIRDISCH; am Geschoss GESAMT mit dokumentierten oberen/unteren Grenzen und Bauteilanteilen. Die Anzeige lautet am Gebäude Gebäudevolumen und am Geschoss Geschossvolumen. Dies begründet keine automatische Gleichheit mit einer Summe von Raumvolumen oder anders definierten DIN-Rauminhalten."
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsumfang/GESAMT",
      "revision": 1,
      "before": {
        "description_de": "Wert für den gesamten vereinbarten Bezugsumfang der jeweiligen Bemessungsart. Bei GF und GV am Gebäude umfasst er oberirdische und unterirdische Teile; am Geschoss oder Raum bezeichnet GESAMT den gesamten dort definierten Bezugsumfang. Einen vorhandenen Gesamtwert erhalten; keine automatische Neuberechnung und keine Addition zu seinen Teilwerten."
      },
      "after": {
        "description_de": "Wert für den gesamten vereinbarten Bezugsumfang der jeweiligen Bemessungsart. Bei GF und GV am Gebäude umfasst er oberirdische und unterirdische Teile; am Geschoss, Raum oder an der Zone gilt der jeweils eigene Umfang. Höhen bleiben Distanzangaben mit dokumentierten Bezugsflächen. Einen vorhandenen Gesamtwert erhalten; keine automatische Neuberechnung und keine Addition zu seinen Teilwerten."
      }
    },
    {
      "kind": "code_value",
      "id": "profile-messeinheit/m²",
      "revision": 1,
      "before": {
        "description_de": "Flächeneinheit für GF, VMF, GGF und GSF."
      },
      "after": {
        "description_de": "Flächeneinheit für GF, AGF, VMF, GGF, GSF, Raumfläche und Zonenfläche."
      }
    },
    {
      "kind": "code_value",
      "id": "profile-messeinheit/m³",
      "revision": 1,
      "before": {
        "description_de": "Volumeneinheit für GV."
      },
      "after": {
        "description_de": "Volumeneinheit für GV, Raumvolumen und Zonenvolumen."
      }
    },
    {
      "kind": "relationship",
      "id": "profile-bemessung-geschoss",
      "revision": 1,
      "before": {
        "rule_notes_de": "GF / GESAMT / m² für ein Geschoss mit anwendbarer dokumentierter SIA-416-Grundlage. GESAMT ist relativ zu diesem Geschoss und kein Gebäudegesamtwert. Quelle, Grundlage und Gültigkeit erhalten.",
        "comment": "Vorgeschlagene Profilanforderung. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "rule_notes_de": "Basisprofil Geschoss: GF, AGF und GV jeweils GESAMT dieses Geschosses mit anwendbarer dokumentierter Grundlage; Geschosshöhe (OKFF zu OKFF der festgelegten darüberliegenden Bodenebene) bei definiertem Bezug. GESAMT ist relativ zu diesem Geschoss und kein Gebäudegesamtwert. Quelle, Grundlage und Gültigkeit erhalten.",
        "comment": "Vorgeschlagene Profilanforderung. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute"
      }
    },
    {
      "kind": "relationship",
      "id": "profile-bemessung-raum",
      "revision": 1,
      "before": {
        "rule_notes_de": "VMF / GESAMT / m² nur bei anwendbarer und belegter Vermietungsflächenregel für diesen Raum. Keine Gleichsetzung einer Netto-Raumfläche mit GF. Quelle, Grundlage und Gültigkeit erhalten.",
        "comment": "Vorgeschlagene Profilanforderung. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "rule_notes_de": "Basisprofil Raum: Raumfläche, Raumhöhe und Raumvolumen jeweils GESAMT dieses Raums nach der dokumentierten Grundlage; VMF / GESAMT / m² nur bei anwendbarer und belegter Vermietungsflächenregel. Keine Gleichsetzung einer Netto-Raumfläche mit GF; Raumvolumen nicht pauschal als Fläche × Höhe. Quelle, Grundlage und Gültigkeit erhalten.",
        "comment": "Vorgeschlagene Profilanforderung. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute"
      }
    },
    {
      "kind": "relationship",
      "id": "profile-bemessung-zone",
      "revision": 1,
      "before": {
        "rule_notes_de": "Optionaler VMF / GESAMT / m² für diese Zone bei begründetem Bezugsumfang. Mitgliedschaftsstichtag, beitragende Bemessungen mit Revision, Rechenregel und Dateinachweis erhalten. Mehrfachzugehörigkeit von Räumen rechtfertigt keine Addition überlappender Zonensummen.",
        "comment": "Vorgeschlagene Profilanforderung. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "rule_notes_de": "Basisprofil Zone: Zonenfläche und Zonenvolumen jeweils GESAMT der zum Stichtag zugeordneten ganzen Räume nach einer gemeinsamen dokumentierten Regel; optionaler VMF / GESAMT / m² bei begründetem Bezugsumfang. Mitgliedschaftsstichtag, beitragende Bemessungen mit Revision, Rechenregel und Dateinachweis erhalten. Mehrfachzugehörigkeit von Räumen rechtfertigt keine Addition überlappender Zonensummen.",
        "comment": "Vorgeschlagene Profilanforderung. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute"
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-raum/flaechenklassifikation",
      "revision": 1,
      "before": {
        "description_de": "Wenn der Raum für eine Auswertung nach diesem Flächenschema klassifiziert werden muss.",
        "comment": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "description_de": "Wenn die Raumfläche für eine Auswertung nach dem betreffenden Schema klassifiziert werden muss.",
        "comment": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute"
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-raum/raumnutzung",
      "revision": 1,
      "before": {
        "status": "draft",
        "comment": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute"
      },
      "after": {
        "status": "retired",
        "comment": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nAus dem Fachprofil genommen. Raumnutzung ist neu eine optionale betriebliche Angabe; die normbezogene Einordnung liegt in der Flächenklassifikation. docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute"
      }
    }
  ],
  "createAttributes": [
    {
      "object": "geschoss",
      "id": "geometrie",
      "semantic": "geometrie",
      "name": "Geometrie",
      "type": "geometry",
      "description": "Räumliche Darstellung des Geschosses als 2D-Kontur und/oder 3D-Geometrie mit eindeutigem Objektumfang. GF-Kontur und AGF-Kontur werden als getrennte Darstellungen beziehungsweise Bestandteile kenntlich gemacht. Jede Darstellung erhält Geometrie-ID, Rolle, Koordinatensystem, Einheit, Höhenbezug, Quelle und Revision. Eine 2D-Kontur allein liefert kein Geschossvolumen.",
      "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Geometrie\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
    },
    {
      "object": "geschoss",
      "id": "hoehenlage",
      "semantic": "hoehenlage",
      "name": "Höhenlage",
      "type": "decimal",
      "description": "Höhenkote der Oberkante Fertigfussboden (OKFF) des Geschosses in Metern, relativ zum separat dokumentierten Höhenbezug. Positive und negative Werte sowie 0 sind möglich. Die zugehörige Bezugsebene beziehungsweise Messstelle und Quelle mit Revision und Gültigkeit dokumentieren; bei Split-Leveln die einzelnen Ebenen unterscheiden.",
      "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Geometrie\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
    },
    {
      "object": "geschoss",
      "id": "hoehenbezug",
      "semantic": "hoehenbezug",
      "name": "Höhenbezug",
      "type": "structured",
      "description": "Referenz für die Höhenlage mit eindeutig bezeichneter Bezugsebene beziehungsweise Höhensystem und Datum. Ein lokales Gebäude-Nullniveau und eine amtliche oder geodätische Höhenreferenz werden ausdrücklich unterschieden. Bei einer Umrechnung Ausgangssystem, Zielsystem und Transformationsnachweis erhalten. Die Bestandteile werden getrennt gespeichert; ein unkommentierter Wert «m ü. M.» oder eine WGS84-Lageangabe genügt nicht.",
      "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Geometrie\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
    },
    {
      "object": "raum",
      "id": "geometrie",
      "semantic": "geometrie",
      "name": "Geometrie",
      "type": "geometry",
      "description": "Räumliche Abgrenzung des Raums als 2D-Raumkontur und/oder 3D-Raumkörper. Darstellung, Modell-/Geschossbezug, Koordinatensystem, Einheit, Höhenbezug, Quelle und Revision dokumentieren. Messkonturen verschiedener Flächenschemata bleiben unterscheidbar. Eine schematische Extrusion aus Raumfläche und einzelner Raumhöhe ersetzt keinen belegten Raumkörper.",
      "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Geometrie\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
    },
    {
      "object": "zone",
      "id": "geometrie",
      "semantic": "geometrie",
      "name": "Geometrie",
      "type": "geometry",
      "description": "Räumliche Darstellung der zum Stichtag zugeordneten ganzen Räume als gegliederte 2D-Flächen und/oder 3D-Raumgeometrien. Sie kann aus den Mitgliedsgeometrien abgeleitet oder als belegte Darstellung übernommen werden; Raumzuordnung, Eingaberevisionen und Ableitungsregel bleiben referenziert. Mehrere Geschosse beziehungsweise Gebäude behalten ihre eigenen Bezugsrahmen und dürfen nicht in eine höhenlose Fläche abgeflacht werden.",
      "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Geometrie\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
    },
    {
      "object": "zone",
      "id": "geometriebezug",
      "semantic": "geometriebezug",
      "name": "Geometriebezug",
      "type": "identifier",
      "description": "Referenz auf die eindeutig identifizierte Geometriedarstellung beziehungsweise ihren Ableitungsdatensatz mit Quelle, Revision und vollständigen Eingabereferenzen. Die geometrische Repräsentation muss mit den Raumzuordnungen für den angegebenen Zeitpunkt übereinstimmen. Ein ungeprüfter Umriss bestimmt keine zusätzlichen oder fehlenden Mitgliedsräume.",
      "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Geometrie\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt.\nSchlüsselrolle: FK (interne oder externe fachliche Referenz; keine neu implementierte physische Datenbankbeziehung)."
    },
    {
      "object": "bemessung",
      "id": "bezugsobjekttyp",
      "semantic": "bezugsobjekttyp",
      "name": "Bezugsobjekttyp",
      "type": "code",
      "description": "Typ des genau einen gemessenen Objekts: Gebäude, Grundstück, Geschoss, Raum oder Zone. Zusammen mit Bezugsobjekt-ID löst er die fachliche Referenz eindeutig auf. Wirtschaftseinheit ist im aktuellen Bemessungsprofil kein direktes Messobjekt.",
      "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Objektbezug\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt."
    },
    {
      "object": "bemessung",
      "id": "bezugsobjekt-id",
      "semantic": "bezugsobjektId",
      "name": "Bezugsobjekt-ID",
      "type": "identifier",
      "description": "Vollständiger fachlicher Primärschlüssel des gemessenen Objekts entsprechend Bezugsobjekttyp. Beispielsweise die vollständige Gebäude-ID oder eine Raum-ID, nicht eine lokale Gebäudenummer oder Raumnummer allein. Quelle und Geometriebezug ersetzen diese Objektzuordnung nicht. Bei Schlüsseländerungen die datierte Identitätszuordnung erhalten.",
      "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\nProperty Set (vorgeschlagen): Objektbezug\nKernangabe: im beschriebenen Anwendungsfall benötigt; unbekannte Werte bleiben unbekannt.\nSchlüsselrolle: FK (interne oder externe fachliche Referenz; keine neu implementierte physische Datenbankbeziehung)."
    }
  ],
  "createValues": [
    {
      "list": "profile-bemessungsart",
      "code": "AGF",
      "name": "Aussengeschossfläche AGF",
      "description": "Dem Bezugsgeschoss zugeordnete Aussenflächen nach der dokumentierten SIA-416-Grundlage, in m² und Umfang GESAMT. Aussenbereiche wie Balkone und Terrassen werden mit belegter Abgrenzung getrennt von GF geführt. Die Zuordnung zu einer Ebene und die Behandlung mehrgeschossiger Aussenbauteile sind nachvollziehbar."
    },
    {
      "list": "profile-bemessungsart",
      "code": "GESCHOSSHOEHE",
      "name": "Geschosshöhe",
      "description": "Vertikale Boden-zu-Boden-Distanz von OKFF des Bezugsgeschosses zur OKFF der festgelegten darüberliegenden Bodenebene, in m. Beide Bezugsflächen und ihre Revisionen dokumentieren; bei variierender Höhe die Messstelle beziehungsweise Auswertungsregel angeben."
    },
    {
      "list": "profile-bemessungsart",
      "code": "RAUMFLAECHE",
      "name": "Raumfläche",
      "description": "Fläche des abgegrenzten Bezugsraums nach der angegebenen Bemessungsgrundlage, in m². Schema, Ausgabe, Messkategorie, Grenzen und Abzüge bestimmen den Wert. Die lokale Bezeichnung bescheinigt weder GF noch VMF oder eine normübergreifend identische Nettofläche."
    },
    {
      "list": "profile-bemessungsart",
      "code": "RAUMHOEHE",
      "name": "Raumhöhe",
      "description": "Lichte vertikale Distanz von OKFF bis zur fertigen Deckenunterseite beziehungsweise Unterkante einer abgehängten Decke, in m. Messstelle oder Auswertungsregel für variable Höhen dokumentieren; ein Einzelwert bezeichnet nicht automatisch die Höhe des gesamten Raums."
    },
    {
      "list": "profile-bemessungsart",
      "code": "RAUMVOLUMEN",
      "name": "Raumvolumen",
      "description": "Volumen des abgegrenzten Innenraums nach der dokumentierten Volumenregel, in m³. Bauteile, Einbauten, Öffnungen und variierende Deckenverläufe nach dieser Regel berücksichtigen. Eine pauschale Multiplikation von Raumfläche und einer einzelnen Raumhöhe genügt nicht."
    },
    {
      "list": "profile-bemessungsart",
      "code": "ZONENFLAECHE",
      "name": "Zonenfläche",
      "description": "Fläche der zum massgeblichen Zeitpunkt zugeordneten Raumabgrenzungen nach einer gemeinsamen dokumentierten Flächenregel, in m². Bei Berechnung aus Raumwerten Eingabebemessungen und Mitgliedschaftsstand referenzieren; Überlagerungen, fehlende Werte und inkompatible Grundlagen dürfen nicht verborgen werden."
    },
    {
      "list": "profile-bemessungsart",
      "code": "ZONENVOLUMEN",
      "name": "Zonenvolumen",
      "description": "Volumen der zum massgeblichen Zeitpunkt zugeordneten Raumabgrenzungen nach einer gemeinsamen dokumentierten Volumenregel, in m³. Bei Berechnung Eingaben, Revisionen, Mitgliedschaftsstand und Rechenregel erhalten; mehrfach erfasste räumliche Anteile nicht doppelt zählen."
    },
    {
      "list": "profile-messeinheit",
      "code": "m",
      "name": "Meter",
      "description": "Längeneinheit für Geschosshöhe und Raumhöhe."
    }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  raw_before jsonb;
  record_uuid uuid;
  object_uuid uuid;
  core_rule_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  assignments text;
  change_count integer := 0;
  removed_links integer;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete geometry update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Geometry operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE '106-attribute synchronization already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the German naming follow-up first';
  END IF;

  -- Validate the entire reviewed scope before changing any row.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    IF item->>'kind' NOT IN ('business_object','business_attribute','code_list','code_value','relationship','quality_requirement')
      OR EXISTS (SELECT FROM jsonb_object_keys(item->'after') AS field(name)
        WHERE field.name NOT IN ('name_de','description_de','comment','rule_notes_de','status'))
      OR (item->'after') = '{}'::jsonb THEN
      RAISE EXCEPTION 'Unexpected geometry-update scope';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM catalog.%I t WHERE identifier = $1 FOR UPDATE', item->>'kind')
      INTO raw_before USING item->>'id';
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR NOT raw_before @> (item->'before') THEN
      RAISE EXCEPTION 'Stale geometry baseline for %; review intervening changes', item->>'id';
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM catalog.business_attribute WHERE identifier IN
      (SELECT (a->>'object') || '/' || (a->>'id') FROM jsonb_array_elements(proposal->'createAttributes') a))
    OR EXISTS (SELECT FROM catalog.code_value WHERE identifier IN
      (SELECT (v->>'list') || '/' || (v->>'code') FROM jsonb_array_elements(proposal->'createValues') v)) THEN
    RAISE EXCEPTION 'A proposed new attribute/value identifier already exists; refusing to overwrite it';
  END IF;
  SELECT id INTO core_rule_uuid FROM catalog.quality_requirement WHERE identifier = 'profile-core' AND status = 'draft';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected the shared profile-core requirement at draft status';
  END IF;
  IF NOT EXISTS (SELECT FROM catalog.business_attribute_quality_requirement l
      JOIN catalog.business_attribute a ON a.id = l.business_attribute_id
      JOIN catalog.quality_requirement q ON q.id = l.quality_requirement_id
      WHERE a.identifier = 'raum/raumnutzung' AND q.identifier = 'profile-raum/raumnutzung') THEN
    RAISE EXCEPTION 'Expected the superseded Raumnutzung assignment; review existing rules';
  END IF;

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

  -- The eight new draft definitions; every one is a Kernangabe of the shared core rule.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'createAttributes') LOOP
    SELECT id INTO STRICT object_uuid FROM catalog.business_object WHERE identifier = item->>'object';
    INSERT INTO catalog.business_attribute(identifier, business_object_id, semantic_name, name_de, description_de, comment,
      status, value_specification, is_identifier, created_on, modified_on)
    VALUES ((item->>'object') || '/' || (item->>'id'), object_uuid, item->>'semantic', item->>'name', item->>'description',
      item->>'comment', 'draft', jsonb_build_object('valueType', item->>'type'), false, edited_on, edited_on)
    RETURNING id INTO record_uuid;
    INSERT INTO catalog.business_attribute_quality_requirement(business_attribute_id, quality_requirement_id)
      VALUES (record_uuid, core_rule_uuid);
    change_count := change_count + 1;
  END LOOP;

  -- Additional local draft vocabulary values.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'createValues') LOOP
    SELECT id INTO STRICT object_uuid FROM catalog.code_list WHERE identifier = item->>'list';
    INSERT INTO catalog.code_value(identifier, code_list_id, code, name_de, description_de, comment, created_on, modified_on)
    VALUES ((item->>'list') || '/' || (item->>'code'), object_uuid, item->>'code', item->>'name',
      item->>'description', 'Lokaler Entwurfswert. ' || (proposal->>'source'), edited_on, edited_on)
    RETURNING id INTO record_uuid;
    change_count := change_count + 1;
  END LOOP;

  -- Raumnutzung keeps its definition and history; only the conditional assignment ends.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'unassign') LOOP
    DELETE FROM catalog.business_attribute_quality_requirement l
      USING catalog.business_attribute a, catalog.quality_requirement q
      WHERE l.business_attribute_id = a.id AND l.quality_requirement_id = q.id
        AND a.identifier = item->>'attribute' AND q.identifier = item->>'rule';
    GET DIAGNOSTICS removed_links = ROW_COUNT;
    IF removed_links <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one superseded assignment for %', item->>'attribute';
    END IF;
  END LOOP;

  FOR item IN SELECT to_jsonb(entry) FROM jsonb_each_text(proposal->'counts') AS entry LOOP
    IF (SELECT count(*) FROM catalog.business_attribute a JOIN catalog.business_object o ON o.id = a.business_object_id
      WHERE o.identifier = item->>'key' AND a.status <> 'retired') <> (item->>'value')::integer THEN
      RAISE EXCEPTION 'Unexpected active attribute count for %; rolling back', item->>'key';
    END IF;
  END LOOP;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$geometry$;

-- Current profile counts: these queries also work after COMMIT and on a repeat run.
SELECT o.identifier AS business_object,
  count(*) FILTER (WHERE a.status <> 'retired') AS active_attributes,
  count(*) FILTER (WHERE a.status = 'retired') AS retired_attributes
FROM catalog.business_object o JOIN catalog.business_attribute a ON a.business_object_id = o.id
WHERE o.identifier IN ('gebaeude','geschoss','raum','zone','grundstueck','wirtschaftseinheit','bemessung')
GROUP BY o.identifier ORDER BY o.identifier;

SELECT a.identifier, a.name_de AS attribut,
  substring(a.comment from 'Property Set \(vorgeschlagen\): [^\n]*') AS property_set
FROM catalog.business_attribute a
WHERE a.identifier IN ('geschoss/geometrie','geschoss/hoehenlage','geschoss/hoehenbezug','raum/geometrie',
  'zone/geometrie','zone/geometriebezug','bemessung/bezugsobjekttyp','bemessung/bezugsobjekt-id',
  'gebaeude/teilportfolio','gebaeude/objektstrategie','grundstueck/teilportfolio')
ORDER BY a.identifier;

SELECT l.identifier AS liste, count(v.id) AS werte, string_agg(v.code, ', ' ORDER BY v.identifier) AS codes
FROM catalog.code_list l JOIN catalog.code_value v ON v.code_list_id = l.id
WHERE l.identifier IN ('profile-bemessungsart','profile-bemessungsumfang','profile-messeinheit')
GROUP BY l.identifier ORDER BY l.identifier;

COMMIT;
