-- Compact comments for the profile content created by the four 2026-09-07 operations:
-- every record keeps only load-bearing comment lines (property set, short key role,
-- conditional applicability, reference-list pointers, SAP-code notes, truncation flags);
-- repeated per-record source lines, presence boilerplate and the identical methodology
-- paragraph on all seven objects are removed. Each object gets one distilled note after
-- its source reference. Import-curated comments elsewhere are untouched, as are retired
-- records and their history.
-- Standalone content update AFTER bbl-referenzdaten-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 319 comment edits; no other fields change and no change-log entries are generated.
-- Baselines are pinned by SHA-256 of the previous comment instead of repeating the long texts.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $kommentare$
DECLARE
  operation_id constant text := 'kompakte-kommentare-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute",
  "requiresOperation": "bbl-referenzdaten-20260907-v1",
  "expectedChanges": 319,
  "changes": [
    {
      "kind": "business_object",
      "id": "raum",
      "revision": 3,
      "beforeHash": "d654cb9b11cc08100932a1031d71d5be07a5515941fbba1c88f8a3d450a99c2f",
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nGenau ein primäres Geschoss pro Zeitpunkt; das Gebäude ergibt sich daraus. Raumnutzung ist optional; die Flächenklassifikation führt SIA-416-, DIN-277- und IPMS-Zuordnungen parallel. Basisbemessungen in Bemessung: Raumfläche, Raumhöhe und Raumvolumen je GESAMT; VMF nur bei anwendbarer Vermietungsflächenregel."
      }
    },
    {
      "kind": "business_object",
      "id": "grundstueck",
      "revision": 4,
      "beforeHash": "2862283237319f4446532cd92c0f5f41a70457cfbf861da24a850e2c0ba47089",
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Grundstücksnummer; Grundstücksnummer (amtlich), Nummerierungsbereich und EGRID bleiben separate Registerangaben. Grenzgeometrie als WGS84-Polygon/MultiPolygon mit separatem Innenpunkt; Adresse in sechs Bestandteilen ohne Hausnummer. Erforderlicher Profilwert: Bemessung GSF / GESAMT / m²."
      }
    },
    {
      "kind": "business_object",
      "id": "gebaeude",
      "revision": 4,
      "beforeHash": "4dd8b489499db5c2c686f99558a64f0acaaa9c0e8dbffd4ac5bc444a45d76aba",
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Gebäudenummer; die Gebäude-ID ist deren abgeleitete Gesamtrepräsentation. EGID und EGRID bleiben bedingte Schweizer Registerreferenzen. Hauptadresse in sieben Bestandteilen; Geometrie ist ein WGS84-Punkt. Basisbemessungen in Bemessung: GF und GV je GESAMT, OBERIRDISCH und UNTERIRDISCH sowie VMF und GGF GESAMT."
      }
    },
    {
      "kind": "business_object",
      "id": "geschoss",
      "revision": 4,
      "beforeHash": "1314caff6acf141c50036de6e2a1cbffa08919e2d8ced256bfe8cd732b925705",
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nGenau ein primäres Gebäude pro Zeitpunkt (Gebäude-ID). Höhenlage ist die OKFF-Kote zum dokumentierten Höhenbezug; die Geschosshöhe bleibt die separate Boden-zu-Boden-Distanz. Basisbemessungen in Bemessung: GF, AGF und GV je GESAMT dieses Geschosses sowie Geschosshöhe bei definiertem Bezug."
      }
    },
    {
      "kind": "business_object",
      "id": "zone",
      "revision": 2,
      "beforeHash": "63fca7ba886c9ec62174e8c9726bf865c63b2f1db1ffb2ae21071e96b9a2ef37",
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nZeitlich gültige Sammlung ganzer Räume; Mitgliedschaften sind separate datierte Raumzuordnungen, mehrere Zonen pro Raum sind zulässig. Basisbemessungen in Bemessung: Zonenfläche und Zonenvolumen je GESAMT sowie optional VMF."
      }
    },
    {
      "kind": "business_object",
      "id": "wirtschaftseinheit",
      "revision": 3,
      "beforeHash": "4e72e120aa35c0febdce2646082f206f56450f315f4377d9b8a180f0d711b785",
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit (WE-Nummer); beide Komponenten sind eigene Attribute. Profit Center und Teilportfolio bleiben getrennte Angaben."
      }
    },
    {
      "kind": "business_object",
      "id": "bemessung",
      "revision": 3,
      "beforeHash": "7ee12b404e17b7d9535b7da9f4fad0c445d736ce96cb2b11f96622e682d3a67f",
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 106 Attribute\n\nGenau ein typisiertes Bezugsobjekt je Aussage (Bezugsobjekttyp und Bezugsobjekt-ID). Zwölf Bemessungsarten; Flächen in m², Volumen in m³, Höhen in m. Quelle, Bemessungsgrundlage und Ermittlungsart bleiben getrennte Angaben; keine automatischen Summen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bemessung-id",
      "revision": 2,
      "beforeHash": "6396508ca2120f56c308048f096284b77f8be64a5885071fd1effa27c1cb49da",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bemessungsart",
      "revision": 2,
      "beforeHash": "056b841139de0026967c9105fd95276d58c9b7faa230a9ea0ca9021f00d91ee7",
      "after": {
        "comment": "Property Set (vorgeschlagen): Messwert"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bemessungsgrundlage",
      "revision": 2,
      "beforeHash": "6eca2463e7cc2909b09a86ffdefb67ce464c5bc451635c35f88c7907a6bd875d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Nachweis und Methode"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bemessungsumfang",
      "revision": 2,
      "beforeHash": "056b841139de0026967c9105fd95276d58c9b7faa230a9ea0ca9021f00d91ee7",
      "after": {
        "comment": "Property Set (vorgeschlagen): Messwert"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bezugsobjekt-id",
      "revision": 1,
      "beforeHash": "71bf04420a515dad4cc5c509e280ff642704f2dae9dde79d3ab21ab3bd53bbc9",
      "after": {
        "comment": "Property Set (vorgeschlagen): Objektbezug\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/bezugsobjekttyp",
      "revision": 1,
      "beforeHash": "6d935f3da8a28296d03344d9dbd8733365421710f95857539cd79ddd6b1fafcc",
      "after": {
        "comment": "Property Set (vorgeschlagen): Objektbezug"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/einheit",
      "revision": 2,
      "beforeHash": "056b841139de0026967c9105fd95276d58c9b7faa230a9ea0ca9021f00d91ee7",
      "after": {
        "comment": "Property Set (vorgeschlagen): Messwert"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/ermittlungsart",
      "revision": 1,
      "beforeHash": "6eca2463e7cc2909b09a86ffdefb67ce464c5bc451635c35f88c7907a6bd875d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Nachweis und Methode"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/gueltig-ab",
      "revision": 2,
      "beforeHash": "81a1683588302c700a0e686b5a1d7b074d1c0b7fc990994b9448812668410efd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/gueltig-bis",
      "revision": 1,
      "beforeHash": "42292f9d7d657fab10da79e31439633ce3ddaf4461c1e79817ed7d592310ceca",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/quelle",
      "revision": 1,
      "beforeHash": "273fec5eec15c67a395049cec57dd3dcade180c1c8cf34bfde054745242c216a",
      "after": {
        "comment": "Property Set (vorgeschlagen): Nachweis und Methode\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/wert",
      "revision": 2,
      "beforeHash": "056b841139de0026967c9105fd95276d58c9b7faa230a9ea0ca9021f00d91ee7",
      "after": {
        "comment": "Property Set (vorgeschlagen): Messwert"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/abbruchjahr",
      "revision": 1,
      "beforeHash": "2531fe8d8dc2a3081946e5c43698d15dc96b5c068d861a2f5ff07c47053a9b8c",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus\nBedingte Angabe: Für vollständig abgebrochene Gebäude erforderlich; ein unbekanntes Jahr bleibt eine Vollständigkeitslücke."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/adresszusatz",
      "revision": 1,
      "beforeHash": "40319655960a8cb9d3a05b2d0f8e070ee939d190cea9d21438267c3e20a9aca2",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse\nBedingte Angabe: Erforderlich, wenn der Zusatz zur eindeutigen Adressierung benötigt wird."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/baujahr",
      "revision": 2,
      "beforeHash": "9885b557a79501062d01671ced41a681e56e56a871b419374ab9d71e48e93ecd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus\nBedingte Angabe: Für fertiggestellte Gebäude erforderlich; unbekanntes Baujahr als Lücke führen und eine belegte Bauperiode ergänzen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/bauperiode",
      "revision": 1,
      "beforeHash": "1002e3b3fae33cafbcb66fc83f4fe17fc1f1f7e3f106942313a11f5496663a01",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus\nBedingte Angabe: Erforderlich, wenn nur eine Bauperiode bekannt ist oder die Auswertung eine solche Einteilung benötigt."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/bewirtschaftungsstatus",
      "revision": 2,
      "beforeHash": "10976f4df033d6e3a90de49023824bd5aa23569f65e2ef5eb5edc5c967d2211d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bewirtschaftung"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/bezeichnung",
      "revision": 2,
      "beforeHash": "13cc33b820f46bd67acfb887117d1de805638802ec7d712be3231eb634ad90fd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/buchungskreis",
      "revision": 2,
      "beforeHash": "f93c4b05ffdf046699c6f13c225b5e22bd0e1a003e68c3854fa67840b8b9ec94",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/egid",
      "revision": 2,
      "beforeHash": "81aaa473bdb0895e0bf60364b96ca76dbfebc1bbe0bead5bc5ce35a8e288f070",
      "after": {
        "comment": "Property Set (vorgeschlagen): Registerbezug\nBedingte Angabe: Erforderlich bei anwendbarem Schweizer GWR-Bezug und bestätigter Übereinstimmung der physischen Gebäudeabgrenzung.\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/eigentuemer",
      "revision": 1,
      "beforeHash": "c45a8115edbd1462f290c6db2e470664f328d8d11a43354a306cf7791b745920",
      "after": {
        "comment": "Property Set (vorgeschlagen): Eigentum\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/eigentumsart",
      "revision": 1,
      "beforeHash": "9ab6147d35052a3603ca03b912616102dd591f92f056c788f5f8d5cfbdf22507",
      "after": {
        "comment": "Property Set (vorgeschlagen): Eigentum"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeude-id",
      "revision": 2,
      "beforeHash": "6396508ca2120f56c308048f096284b77f8be64a5885071fd1effa27c1cb49da",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudeart",
      "revision": 3,
      "beforeHash": "63de6c9c558c159f768b7fe0d1b9060ec5271869e3e1338a6237da5164950bc5",
      "after": {
        "comment": "Property Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Erforderlich im abgestimmten Geltungsbereich der BBL-Gebäudeklassifikation; ungeklärte Zuordnungen bleiben offen.\nReferenzlisten: Gebäudeart 1 (BBL) und Gebäudeart 2 (BBL) gemäss SAP-F4-Werthilfe vom 7. September 2026; Stufe-2-Codes tragen den Präfix ihrer Stufe 1. Verbindliche Zuordnung, Vokabularstand und Customizing-Nachweis bleiben zu bestätigen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudekategorie",
      "revision": 2,
      "beforeHash": "7cdb5c30805ac43faa8a869f90b639bbd877e51158940027f4fc0df27f99329d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Bei einem anwendbaren GWR-Datensatz erforderlich; ohne entsprechenden Registerbezug keine Kategorie erfinden."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudeklasse",
      "revision": 1,
      "beforeHash": "790c10f1f005fbae8f35b5c1dc9c3349649739700c20be803d36c3c8f5f0fb97",
      "after": {
        "comment": "Property Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Bei anwendbarem GWR-Bezug erforderlich. Fehlende Werte bleiben sichtbar; die Kompatibilität des vorhandenen 4.2-Vokabulars mit 5.0 bleibt zu prüfen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudenummer-bbl",
      "revision": 2,
      "beforeHash": "f93c4b05ffdf046699c6f13c225b5e22bd0e1a003e68c3854fa67840b8b9ec94",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudestatus",
      "revision": 3,
      "beforeHash": "69016bda9489e6fe2c855a71018945873b7cb05c79d2e0f4ef9ba51d757363ab",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/geometrie",
      "revision": 1,
      "beforeHash": "148a68088f1d3e016afb291455840bab64f6bf1a6cc78a6ee0d9c46956bb0911",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/geschosse-oberirdisch",
      "revision": 1,
      "beforeHash": "157b0860c12e2264e5cb9e6837f94d37010084a991ceb17c2117fa2af355df08",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus\nBedingte Angabe: Für baulich realisierte Gebäude erforderlich; unbekannte Anzahlen bleiben Vollständigkeitslücken."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/geschosse-unterirdisch",
      "revision": 1,
      "beforeHash": "157b0860c12e2264e5cb9e6837f94d37010084a991ceb17c2117fa2af355df08",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus\nBedingte Angabe: Für baulich realisierte Gebäude erforderlich; unbekannte Anzahlen bleiben Vollständigkeitslücken."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/grundstueck",
      "revision": 3,
      "beforeHash": "c0c72827a1d719f42ce81fb000ebd5c7f1e6476662e7dc01514cc9a47fcfd230",
      "after": {
        "comment": "Property Set (vorgeschlagen): Registerbezug\nBedingte Angabe: Erforderlich, sofern für das Gebäude ein massgeblicher Schweizer Grundstücksbezug mit EGRID festgelegt ist; für ausländische Gebäude keine EGRID erfinden.\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/hauptnutzung",
      "revision": 1,
      "beforeHash": "957859d6278c09280a19b041d4691cf760ce8973ae462dbdf8b0c9586543e583",
      "after": {
        "comment": "Property Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Für Gebäude mit tatsächlicher Nutzung erforderlich; eine fehlende Zuordnung ist eine Vollständigkeitslücke. Geplante Nutzung separat kennzeichnen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/hausnummer",
      "revision": 1,
      "beforeHash": "d0837b2113387e6bebdbbe06a12d5af7dde5a0636adfa866cbf4ee179c15cda5",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse\nBedingte Angabe: Erforderlich, sofern der Hauptadresse eine Hausnummer zugeteilt ist."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/land",
      "revision": 1,
      "beforeHash": "e3b1f59d8c4eb03aa4a13ba508ac2d46f2cf61fd662eb0f9cec3c151934999cd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/objektstrategie",
      "revision": 3,
      "beforeHash": "a41819a6320029279d43e92dee66aa98dbe00d6d3f123824ef80a28e850aeff0",
      "after": {
        "comment": "Property Set (vorgeschlagen): Portfoliomanagement"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/ort",
      "revision": 1,
      "beforeHash": "e3b1f59d8c4eb03aa4a13ba508ac2d46f2cf61fd662eb0f9cec3c151934999cd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/postleitzahl",
      "revision": 1,
      "beforeHash": "bf3fcb19cbd2e7a8f3550a582cb3e6544f8991e24c6e90123ee02714b5f220a3",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse\nBedingte Angabe: Erforderlich, sofern für die betreffende Adresse eine Postleitzahl vergeben ist."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/region",
      "revision": 1,
      "beforeHash": "30d234c371c427f7a57c48b2b649fe7d3a6e7517763e97b71a3888c919c97f32",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse\nBedingte Angabe: Erforderlich, sofern die administrative Region Bestandteil der Adresse im betreffenden Land ist."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/strasse",
      "revision": 1,
      "beforeHash": "066191400983a6ca1b35eaac2611fa7ea02b11ec8e9ed43a3f4bc6c74422bb75",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse\nBedingte Angabe: Erforderlich, sofern das Gebäude eine Strassenadresse hat."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/teilportfolio",
      "revision": 3,
      "beforeHash": "a41819a6320029279d43e92dee66aa98dbe00d6d3f123824ef80a28e850aeff0",
      "after": {
        "comment": "Property Set (vorgeschlagen): Portfoliomanagement"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/wgs84-lat",
      "revision": 1,
      "beforeHash": "148a68088f1d3e016afb291455840bab64f6bf1a6cc78a6ee0d9c46956bb0911",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/wgs84-lon",
      "revision": 1,
      "beforeHash": "148a68088f1d3e016afb291455840bab64f6bf1a6cc78a6ee0d9c46956bb0911",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/wirtschaftseinheit",
      "revision": 2,
      "beforeHash": "d6b5a54e24f1fdd1edeeca1f68ec86d2b138fd0b1648cc72d24a97be4dcb089d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente / FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/bezeichnung",
      "revision": 2,
      "beforeHash": "13cc33b820f46bd67acfb887117d1de805638802ec7d712be3231eb634ad90fd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/building-id",
      "revision": 2,
      "beforeHash": "c0643c48894cd32c814e97aeb9e9ac540ddb9ecb962a6ed4535b2621eb6769c0",
      "after": {
        "comment": "Property Set (vorgeschlagen): Räumliche Zuordnung\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/geometrie",
      "revision": 1,
      "beforeHash": "41cbeada2ead95ca3ed761ac1da2780023f7a9beef9c6ea4026f66335bd0ff3b",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/geometriebezug",
      "revision": 1,
      "beforeHash": "a3173a34fb6078b99d9a464a576b431fc3c6078d2c32cc91826b2f56bd76c170",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie\nBedingte Angabe: Für Geschosse mit digital geführter Geometrie erforderlich.\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/geschoss-id",
      "revision": 2,
      "beforeHash": "6396508ca2120f56c308048f096284b77f8be64a5885071fd1effa27c1cb49da",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/geschosscode",
      "revision": 1,
      "beforeHash": "13cc33b820f46bd67acfb887117d1de805638802ec7d712be3231eb634ad90fd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/geschosslage",
      "revision": 1,
      "beforeHash": "f21860fb0ed4b2a575bbab7b0efe5e04573c3d4657a9ec784c100fbec51b5aab",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus\nBedingte Angabe: Für baulich realisierte Geschosse erforderlich; eine ungeklärte Zuordnung bleibt eine Qualitätslücke."
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/gueltig-ab",
      "revision": 2,
      "beforeHash": "81a1683588302c700a0e686b5a1d7b074d1c0b7fc990994b9448812668410efd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/gueltig-bis",
      "revision": 1,
      "beforeHash": "42292f9d7d657fab10da79e31439633ce3ddaf4461c1e79817ed7d592310ceca",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/hoehenbezug",
      "revision": 1,
      "beforeHash": "41cbeada2ead95ca3ed761ac1da2780023f7a9beef9c6ea4026f66335bd0ff3b",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/hoehenlage",
      "revision": 1,
      "beforeHash": "41cbeada2ead95ca3ed761ac1da2780023f7a9beef9c6ea4026f66335bd0ff3b",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/sortierposition",
      "revision": 1,
      "beforeHash": "050245afd5ce9adc5a713aac69e87cbb0f2dfcd5edd5eaf97298267c41dc4864",
      "after": {
        "comment": "Property Set (vorgeschlagen): Räumliche Zuordnung"
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/status",
      "revision": 2,
      "beforeHash": "69016bda9489e6fe2c855a71018945873b7cb05c79d2e0f4ef9ba51d757363ab",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/adresszusatz",
      "revision": 1,
      "beforeHash": "fd978cee50d282d0a763412a06cb593b3006c97f2b3671b99f058326bb5e438b",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/bezeichnung",
      "revision": 1,
      "beforeHash": "210dbbc087b7706f17afdcf3956cf09371eaf4aab23b9599e389e6f35a23af93",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/buchungskreis",
      "revision": 1,
      "beforeHash": "f93c4b05ffdf046699c6f13c225b5e22bd0e1a003e68c3854fa67840b8b9ec94",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/egrid",
      "revision": 2,
      "beforeHash": "7e137907d79397235a1ac5578d665aa7ac7c102fb1d21bd6ba6bd4bf1e7834f4",
      "after": {
        "comment": "Property Set (vorgeschlagen): Registerbezug\nBedingte Angabe: Erforderlich, sofern im anwendbaren Schweizer Registerkontext zugeteilt; eine nicht beschaffte EGRID bleibt eine Vollständigkeitslücke. Für ausländische Parzellen keine EGRID erfinden.\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/eigentuemer",
      "revision": 1,
      "beforeHash": "c45a8115edbd1462f290c6db2e470664f328d8d11a43354a306cf7791b745920",
      "after": {
        "comment": "Property Set (vorgeschlagen): Eigentum\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/eigentumsart",
      "revision": 1,
      "beforeHash": "9ab6147d35052a3603ca03b912616102dd591f92f056c788f5f8d5cfbdf22507",
      "after": {
        "comment": "Property Set (vorgeschlagen): Eigentum"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/grenzgeometrie",
      "revision": 1,
      "beforeHash": "148a68088f1d3e016afb291455840bab64f6bf1a6cc78a6ee0d9c46956bb0911",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/grundstueck-id",
      "revision": 2,
      "beforeHash": "6396508ca2120f56c308048f096284b77f8be64a5885071fd1effa27c1cb49da",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/grundstuecksnummer-bbl",
      "revision": 2,
      "beforeHash": "f93c4b05ffdf046699c6f13c225b5e22bd0e1a003e68c3854fa67840b8b9ec94",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/land",
      "revision": 1,
      "beforeHash": "e3b1f59d8c4eb03aa4a13ba508ac2d46f2cf61fd662eb0f9cec3c151934999cd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/nummerierungsbereich",
      "revision": 1,
      "beforeHash": "62d6eb910437a9850f4e1131ce9685cac7f9d1d23ca9a82d169c2509b4c29a04",
      "after": {
        "comment": "Property Set (vorgeschlagen): Registerbezug"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/ort",
      "revision": 1,
      "beforeHash": "e3b1f59d8c4eb03aa4a13ba508ac2d46f2cf61fd662eb0f9cec3c151934999cd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/parzellennummer",
      "revision": 3,
      "beforeHash": "62d6eb910437a9850f4e1131ce9685cac7f9d1d23ca9a82d169c2509b4c29a04",
      "after": {
        "comment": "Property Set (vorgeschlagen): Registerbezug"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/postleitzahl",
      "revision": 1,
      "beforeHash": "abc16a3928bf32082c2a456a560ab0fc8ad1df17bcebe0bbb35e78e2adb5bda2",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse\nBedingte Angabe: Erforderlich, sofern der Grundstücksadresse eine Postleitzahl zugeordnet ist."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/rechtsstand",
      "revision": 1,
      "beforeHash": "66431f9b13931f9b0df32ebe9026b6e920b6e5be9716d96c6c2051486b5fab89",
      "after": {
        "comment": "Property Set (vorgeschlagen): Registerbezug\nBedingte Angabe: Erforderlich, wenn die Grenzgeometrie als rechtlich massgeblich verwendet wird; ein fehlender oder ungeklärter Rechtsstand bleibt eine Qualitätslücke. Keine Ableitung aus einem ungeklärten Quellstatus."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/region-kanton-bundesstaat",
      "revision": 1,
      "beforeHash": "82ea8ce232879271e147878de91f3ddc40611c7020bcccdae59e15cd7347c49f",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse\nBedingte Angabe: Erforderlich, sofern die administrative Region Bestandteil der Grundstücksadresse oder Lagebezeichnung im betreffenden Land ist."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/strasse",
      "revision": 1,
      "beforeHash": "b56b0597e298573fa5e799bc93285bdf98a4694767bfe987d9994007febf5b04",
      "after": {
        "comment": "Property Set (vorgeschlagen): Adresse\nBedingte Angabe: Erforderlich, sofern der Grundstücksadresse eine Strasse zugeordnet ist."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/teilportfolio",
      "revision": 3,
      "beforeHash": "a41819a6320029279d43e92dee66aa98dbe00d6d3f123824ef80a28e850aeff0",
      "after": {
        "comment": "Property Set (vorgeschlagen): Portfoliomanagement"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/wgs84-breitengrad",
      "revision": 1,
      "beforeHash": "148a68088f1d3e016afb291455840bab64f6bf1a6cc78a6ee0d9c46956bb0911",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/wgs84-laengengrad",
      "revision": 1,
      "beforeHash": "148a68088f1d3e016afb291455840bab64f6bf1a6cc78a6ee0d9c46956bb0911",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/wirtschaftseinheit",
      "revision": 1,
      "beforeHash": "d6b5a54e24f1fdd1edeeca1f68ec86d2b138fd0b1648cc72d24a97be4dcb089d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente / FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/bezeichnung",
      "revision": 2,
      "beforeHash": "13cc33b820f46bd67acfb887117d1de805638802ec7d712be3231eb634ad90fd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/flaechenklassifikation",
      "revision": 2,
      "beforeHash": "50cba965c68065d53d386f9dcea68365c97b3c7808d58783b3d27a31904118ce",
      "after": {
        "comment": "Property Set (vorgeschlagen): Klassifikation und Nutzung\nBedingte Angabe: Wenn die Raumfläche für eine Auswertung nach dem betreffenden Schema klassifiziert werden muss."
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/geometrie",
      "revision": 1,
      "beforeHash": "41cbeada2ead95ca3ed761ac1da2780023f7a9beef9c6ea4026f66335bd0ff3b",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/geometriebezug",
      "revision": 1,
      "beforeHash": "b5fee13bad17050e7df13ee668e4eb6d7fce6e6b0fca0952988bb4de0025a46a",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie\nBedingte Angabe: Für Räume mit digital geführter Geometrie erforderlich.\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/geschoss-id",
      "revision": 1,
      "beforeHash": "c0643c48894cd32c814e97aeb9e9ac540ddb9ecb962a6ed4535b2621eb6769c0",
      "after": {
        "comment": "Property Set (vorgeschlagen): Räumliche Zuordnung\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/gueltig-ab",
      "revision": 2,
      "beforeHash": "81a1683588302c700a0e686b5a1d7b074d1c0b7fc990994b9448812668410efd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/gueltig-bis",
      "revision": 1,
      "beforeHash": "42292f9d7d657fab10da79e31439633ce3ddaf4461c1e79817ed7d592310ceca",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/raum-id",
      "revision": 2,
      "beforeHash": "6396508ca2120f56c308048f096284b77f8be64a5885071fd1effa27c1cb49da",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/raumnummer",
      "revision": 1,
      "beforeHash": "13cc33b820f46bd67acfb887117d1de805638802ec7d712be3231eb634ad90fd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/raumnutzung",
      "revision": 2,
      "beforeHash": "36cdd5b633fad6903c2d0ea891922b1ae08e0a9beeab483ee6747c6bf298cc0f",
      "after": {
        "comment": "Property Set (vorgeschlagen): Klassifikation und Nutzung"
      }
    },
    {
      "kind": "business_attribute",
      "id": "raum/status",
      "revision": 2,
      "beforeHash": "69016bda9489e6fe2c855a71018945873b7cb05c79d2e0f4ef9ba51d757363ab",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bauwerk und Lebenszyklus"
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/bewirtschaftungsstatus",
      "revision": 1,
      "beforeHash": "10976f4df033d6e3a90de49023824bd5aa23569f65e2ef5eb5edc5c967d2211d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bewirtschaftung"
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/bewirtschaftungszweck",
      "revision": 1,
      "beforeHash": "10976f4df033d6e3a90de49023824bd5aa23569f65e2ef5eb5edc5c967d2211d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bewirtschaftung"
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/bezeichnung",
      "revision": 2,
      "beforeHash": "13cc33b820f46bd67acfb887117d1de805638802ec7d712be3231eb634ad90fd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation"
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/buchungskreis",
      "revision": 2,
      "beforeHash": "f93c4b05ffdf046699c6f13c225b5e22bd0e1a003e68c3854fa67840b8b9ec94",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente"
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/gueltig-ab",
      "revision": 1,
      "beforeHash": "81a1683588302c700a0e686b5a1d7b074d1c0b7fc990994b9448812668410efd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/gueltig-bis",
      "revision": 1,
      "beforeHash": "42292f9d7d657fab10da79e31439633ce3ddaf4461c1e79817ed7d592310ceca",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/we-nummer",
      "revision": 2,
      "beforeHash": "f93c4b05ffdf046699c6f13c225b5e22bd0e1a003e68c3854fa67840b8b9ec94",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK-Komponente"
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/wirtschaftseinheit-id",
      "revision": 1,
      "beforeHash": "6396508ca2120f56c308048f096284b77f8be64a5885071fd1effa27c1cb49da",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/bezeichnung",
      "revision": 1,
      "beforeHash": "13cc33b820f46bd67acfb887117d1de805638802ec7d712be3231eb634ad90fd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/geometrie",
      "revision": 1,
      "beforeHash": "41cbeada2ead95ca3ed761ac1da2780023f7a9beef9c6ea4026f66335bd0ff3b",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/geometriebezug",
      "revision": 1,
      "beforeHash": "91b743c5b2db537a1ecf81448fa7ea3fa9fc16b8151805960a36f796f5ce69d3",
      "after": {
        "comment": "Property Set (vorgeschlagen): Geometrie\nSchlüsselrolle: FK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/gueltig-ab",
      "revision": 1,
      "beforeHash": "81a1683588302c700a0e686b5a1d7b074d1c0b7fc990994b9448812668410efd",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/gueltig-bis",
      "revision": 1,
      "beforeHash": "42292f9d7d657fab10da79e31439633ce3ddaf4461c1e79817ed7d592310ceca",
      "after": {
        "comment": "Property Set (vorgeschlagen): Gültigkeit"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/zone-id",
      "revision": 1,
      "beforeHash": "6396508ca2120f56c308048f096284b77f8be64a5885071fd1effa27c1cb49da",
      "after": {
        "comment": "Property Set (vorgeschlagen): Identifikation\nSchlüsselrolle: PK"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/zonenstatus",
      "revision": 1,
      "beforeHash": "10976f4df033d6e3a90de49023824bd5aa23569f65e2ef5eb5edc5c967d2211d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bewirtschaftung"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/zonentyp",
      "revision": 1,
      "beforeHash": "cb9bc4b4c7db46e077fda25fad12daf6e344349ea6f0a4de142d96a646d43e67",
      "after": {
        "comment": "Property Set (vorgeschlagen): Klassifikation und Nutzung"
      }
    },
    {
      "kind": "business_attribute",
      "id": "zone/zweck-und-abgrenzung",
      "revision": 1,
      "beforeHash": "10976f4df033d6e3a90de49023824bd5aa23569f65e2ef5eb5edc5c967d2211d",
      "after": {
        "comment": "Property Set (vorgeschlagen): Bewirtschaftung"
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-core",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/abbruchjahr",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/adresszusatz",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/baujahr",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/bauperiode",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/egid",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/gebaeudeart",
      "revision": 2,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/gebaeudekategorie",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/gebaeudeklasse",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/geschosse-oberirdisch",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/geschosse-unterirdisch",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/grundstueck",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/hauptnutzung",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/hausnummer",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/postleitzahl",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/region",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/strasse",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-geschoss/geometriebezug",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-geschoss/geschosslage",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-grundstueck/egrid",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-grundstueck/postleitzahl",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-grundstueck/rechtsstand",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-grundstueck/region-kanton-bundesstaat",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-grundstueck/strasse",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-raum/flaechenklassifikation",
      "revision": 2,
      "beforeHash": "6a4416f2e5b32da06c7f4d405ac96df8f8570949e98aaea60810e591ff337573",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-raum/geometriebezug",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-raum/raumnutzung",
      "revision": 2,
      "beforeHash": "d0f40ba490343f4e5ae8c1f46b02dfe2add73b4ff90120465c173c90e33189ff",
      "after": {
        "comment": "Aus dem Fachprofil genommen. Raumnutzung ist neu eine optionale betriebliche Angabe; die normbezogene Einordnung liegt in der Flächenklassifikation."
      }
    },
    {
      "kind": "code_list",
      "id": "profile-bemessungsumfang",
      "revision": 1,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_list",
      "id": "profile-eigentumsart",
      "revision": 2,
      "beforeHash": "159224ca75c5aa30cb90c130381a350f3e329ca48a0d2cd14a516c3f8f2e8884",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_list",
      "id": "profile-messeinheit",
      "revision": 2,
      "beforeHash": "6a4416f2e5b32da06c7f4d405ac96df8f8570949e98aaea60810e591ff337573",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_list",
      "id": "profile-bemessungsart",
      "revision": 2,
      "beforeHash": "6a4416f2e5b32da06c7f4d405ac96df8f8570949e98aaea60810e591ff337573",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_list",
      "id": "r-bbl-teilportfolio",
      "revision": 1,
      "beforeHash": "ef1be96bea949c0d5650ab7a06a682513fb859142bc77fb615a769a285058954",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_list",
      "id": "r-bbl-gebaeudeart-1",
      "revision": 1,
      "beforeHash": "ef1be96bea949c0d5650ab7a06a682513fb859142bc77fb615a769a285058954",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_list",
      "id": "r-bbl-gebaeudeart-2",
      "revision": 1,
      "beforeHash": "ef1be96bea949c0d5650ab7a06a682513fb859142bc77fb615a769a285058954",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_list",
      "id": "r-bbl-mietmodell",
      "revision": 1,
      "beforeHash": "ef1be96bea949c0d5650ab7a06a682513fb859142bc77fb615a769a285058954",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/AGF",
      "revision": 1,
      "beforeHash": "914a38def8d5ef03cbcc2800729bd20cbbc1b541a5dbd3f6be73b08a14853b2c",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/GESCHOSSHOEHE",
      "revision": 1,
      "beforeHash": "914a38def8d5ef03cbcc2800729bd20cbbc1b541a5dbd3f6be73b08a14853b2c",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/GF",
      "revision": 1,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/GGF",
      "revision": 1,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/GSF",
      "revision": 1,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/GV",
      "revision": 2,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/RAUMFLAECHE",
      "revision": 1,
      "beforeHash": "914a38def8d5ef03cbcc2800729bd20cbbc1b541a5dbd3f6be73b08a14853b2c",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/RAUMHOEHE",
      "revision": 1,
      "beforeHash": "914a38def8d5ef03cbcc2800729bd20cbbc1b541a5dbd3f6be73b08a14853b2c",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/RAUMVOLUMEN",
      "revision": 1,
      "beforeHash": "914a38def8d5ef03cbcc2800729bd20cbbc1b541a5dbd3f6be73b08a14853b2c",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/VMF",
      "revision": 1,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/ZONENFLAECHE",
      "revision": 1,
      "beforeHash": "914a38def8d5ef03cbcc2800729bd20cbbc1b541a5dbd3f6be73b08a14853b2c",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsart/ZONENVOLUMEN",
      "revision": 1,
      "beforeHash": "914a38def8d5ef03cbcc2800729bd20cbbc1b541a5dbd3f6be73b08a14853b2c",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsumfang/GESAMT",
      "revision": 2,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsumfang/OBERIRDISCH",
      "revision": 1,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-bemessungsumfang/UNTERIRDISCH",
      "revision": 1,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-eigentumsart/Anmiete",
      "revision": 2,
      "beforeHash": "684bcedbe25e9a4eda92fe09b5b1b569269fd7bcae264d1bf3b3b214caeab526",
      "after": {
        "comment": "SAP-Code 03, Langtext «Mietobjekt» (F4-Werthilfe, 7. September 2026)."
      }
    },
    {
      "kind": "code_value",
      "id": "profile-eigentumsart/Eigentum",
      "revision": 2,
      "beforeHash": "9829110f471f4d9696ef74c290162dae78903d30b1200097aef2267a1eeaba18",
      "after": {
        "comment": "SAP-Code 01, Langtext «Eigentum Bund» (F4-Werthilfe, 7. September 2026)."
      }
    },
    {
      "kind": "code_value",
      "id": "profile-eigentumsart/Spezialfall",
      "revision": 2,
      "beforeHash": "351209ec1f09758cc67ddf743684fc856dc5a3c30e992a6e0103b35f7bfd769f",
      "after": {
        "comment": "SAP-Code 05, Langtext «Spezialfall» (F4-Werthilfe, 7. September 2026)."
      }
    },
    {
      "kind": "code_value",
      "id": "profile-messeinheit/m",
      "revision": 1,
      "beforeHash": "914a38def8d5ef03cbcc2800729bd20cbbc1b541a5dbd3f6be73b08a14853b2c",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-messeinheit/m²",
      "revision": 2,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "profile-messeinheit/m³",
      "revision": 2,
      "beforeHash": "37e23528bc16a97ca0c6e692683afc1f7e29e0566351438a6b9ff1ab87be996d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/06",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/07",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/08",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/09",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/10",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/11",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/12",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/13",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/14",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/15",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/16",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/17",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/18",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/19",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/20",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-1/21",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/01.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/01.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/01.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/01.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/01.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/02.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/02.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/02.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/02.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/02.06",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/03.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/03.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/03.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/03.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/03.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/03.06",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/04.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/04.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/04.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/04.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/04.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.06",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.07",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.08",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.09",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.10",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.11",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.12",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.13",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.14",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/05.15",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.06",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.07",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.08",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.09",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.10",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.11",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.12",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.13",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.14",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.15",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/06.16",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/07.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/08.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/09.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/09.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/10.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/10.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/10.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/10.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/10.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/11.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/11.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/11.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/11.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.06",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.07",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.08",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.09",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.10",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/12.11",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/13.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/13.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/13.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/13.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/13.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/13.06",
      "revision": 1,
      "beforeHash": "a4e834cd37565f565f545af711e7fe6b137fee0b2ad8190274dd8031af4de05b",
      "after": {
        "comment": "Langtext im Screenshot abgeschnitten; vollständige Bezeichnung noch zu ergänzen."
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/13.07",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/13.08",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/14.01",
      "revision": 1,
      "beforeHash": "a4e834cd37565f565f545af711e7fe6b137fee0b2ad8190274dd8031af4de05b",
      "after": {
        "comment": "Langtext im Screenshot abgeschnitten; vollständige Bezeichnung noch zu ergänzen."
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/14.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/14.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/15.00",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/16.01",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/16.02",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/16.03",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/16.04",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/16.05",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/16.06",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/16.07",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/17.00",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/18.00",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/19.00",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/20.00",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-gebaeudeart-2/21.00",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/1a",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/1b",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/1c",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/2a",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/2b",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/2c",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/3",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/3a",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/4",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/4a",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/4b",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/4c",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/4d",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-mietmodell/5",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/001",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/002",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/003",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/004",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/005",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/006",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/007",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/008",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/009",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "code_value",
      "id": "r-bbl-teilportfolio/010",
      "revision": 1,
      "beforeHash": "c875aa24f2cb17c5de4c86e54bc528acfd3fbd52ce5e128c330b3df0fe8b18ed",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "relationship",
      "id": "profile-bemessung-gebaeude",
      "revision": 1,
      "beforeHash": "d6040f62fb75812f42e7423876151700c903b00ac50ffd6805ce35016dd7b7ab",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "relationship",
      "id": "profile-bemessung-zone",
      "revision": 2,
      "beforeHash": "5ddca74faa71d8483ca2c2252799b78793ff3b0598e0be7dfd7afb457483613d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "relationship",
      "id": "profile-bemessung-grundstueck",
      "revision": 1,
      "beforeHash": "d6040f62fb75812f42e7423876151700c903b00ac50ffd6805ce35016dd7b7ab",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "relationship",
      "id": "profile-bemessung-geschoss",
      "revision": 2,
      "beforeHash": "5ddca74faa71d8483ca2c2252799b78793ff3b0598e0be7dfd7afb457483613d",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "relationship",
      "id": "profile-bemessung-raum",
      "revision": 2,
      "beforeHash": "5ddca74faa71d8483ca2c2252799b78793ff3b0598e0be7dfd7afb457483613d",
      "after": {
        "comment": null
      }
    }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  raw_before jsonb;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete comment update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Comment operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Compact comments already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the BBL Referenzdaten first';
  END IF;

  -- Validate the entire reviewed scope before changing any row.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    IF item->>'kind' NOT IN ('business_object','business_attribute','quality_requirement','code_list','code_value','relationship')
      OR (SELECT array_agg(field.name) FROM jsonb_object_keys(item->'after') AS field(name)) <> ARRAY['comment']
      OR item->>'beforeHash' IS NULL THEN
      RAISE EXCEPTION 'Unexpected comment-update scope';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM catalog.%I t WHERE identifier = $1 FOR UPDATE', item->>'kind')
      INTO raw_before USING item->>'id';
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'comment' IS NULL
      OR encode(sha256(convert_to(raw_before->>'comment', 'UTF8')), 'hex') <> item->>'beforeHash' THEN
      RAISE EXCEPTION 'Stale comment baseline for %; review intervening changes', item->>'id';
    END IF;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    EXECUTE format('SELECT to_jsonb(t) FROM catalog.%I t WHERE identifier = $1 FOR UPDATE', item->>'kind')
      INTO STRICT raw_before USING item->>'id';
    record_uuid := (raw_before->>'id')::uuid;
    EXECUTE format('UPDATE catalog.%I AS t SET comment = ($1->>''comment''), modified_on = $2 WHERE id = $3 AND row_version = $4 RETURNING to_jsonb(t)',
      item->>'kind')
      INTO STRICT raw_before USING item->'after', edited_on, record_uuid, (item->>'revision')::bigint;
    change_count := change_count + 1;
  END LOOP;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$kommentare$;

-- Comment footprint after compaction: these queries also work after COMMIT and on a repeat run.
SELECT o.identifier AS business_object, length(o.comment) AS object_comment_length,
  max(length(a.comment)) FILTER (WHERE a.status <> 'retired') AS longest_attribute_comment
FROM catalog.business_object o JOIN catalog.business_attribute a ON a.business_object_id = o.id
WHERE o.identifier IN ('gebaeude','geschoss','raum','zone','grundstueck','wirtschaftseinheit','bemessung')
GROUP BY o.identifier, o.comment ORDER BY o.identifier;

SELECT count(*) FILTER (WHERE v.comment IS NOT NULL) AS values_with_comment,
  count(*) FILTER (WHERE v.comment LIKE 'SAP-Code%') AS sap_code_notes,
  count(*) FILTER (WHERE v.comment LIKE '%abgeschnitten%') AS truncation_flags
FROM catalog.code_value v JOIN catalog.code_list l ON l.id = v.code_list_id
WHERE l.identifier IN ('profile-bemessungsart','profile-bemessungsumfang','profile-eigentumsart','profile-messeinheit','r-bbl-teilportfolio','r-bbl-gebaeudeart-1','r-bbl-gebaeudeart-2','r-bbl-mietmodell');

COMMIT;
