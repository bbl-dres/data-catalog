-- German attribute labels: incremental follow-up to the already applied 98-attribute update.
-- Run this ENTIRE file as postgres. Counts, IDs, key semantics and reference vocabularies stay intact.
-- 17 record edits: eight attribute labels and their affected definitions/comments/rule label.
-- No change-log entries or temporary report tables. The final report reads current labels.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK.
-- Same operation/content is repeatable; intervening edits or different content are refused.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $labels$
DECLARE
  operation_id constant text := 'business-object-labels-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "docs/business-object-attribute-proposal.md; einheitliche deutsche Attributnamen, 2026-09-07",
  "requiresOperation": "business-object-profiles-20260907-v2",
  "expectedChanges": 17,
  "replacements": [
    [
      "Building ID",
      "Gebäude-ID"
    ],
    [
      "Gebäudenummer (BBL)",
      "Gebäudenummer"
    ],
    [
      "Gebäudeart (BBL)",
      "Gebäudeart"
    ],
    [
      "Gebäudestatus (physisch)",
      "Gebäudestatus"
    ],
    [
      "Objektstrategie (SAP)",
      "Objektstrategie"
    ],
    [
      "Grundstücksnummer (BBL)",
      "Grundstücksnummer"
    ],
    [
      "Bewirtschaftungsstatus (Gebäude)",
      "Bewirtschaftungsstatus"
    ]
  ],
  "changes": [
    {
      "kind": "business_object",
      "id": "gebaeude",
      "revision": 2,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Gebäudenummer (BBL); die Bestandteile sind getrennte Attribute, die Building ID ihre abgeleitete Gesamtrepräsentation. Änderungen der Schlüsselbestandteile erhalten datierte Alt-/Neuschlüsselbezüge. Die physische Abgrenzung ist mit dem SAP-Objekt abzugleichen. EGID und die ausgewählte EGRID bleiben bedingte Schweizer Referenzen; sämtliche Grundstücksbeziehungen behalten Quelle, Rechtsbezug und Gültigkeit. Eigentumsart und eingetragene Eigentümer sind getrennt; Eigentümerzuordnungen erhalten Registerkontext und belegte Anteile, keine automatisch geerbten Eigentümer. Teilportfolio ist ein BBL-Begriff; Objektstrategie ist eine eigene SAP-Quellangabe mit noch abzustimmendem Vokabular. Sieben atomare Komponenten beschreiben die Hauptadresse; weitere Adressen/Eingänge sind eigene Zuordnungen. Geometrie ist ein WGS84-Punkt, identisch mit den beiden Einzelkoordinaten; GeoJSON verwendet [Längengrad, Breitengrad]. Grundriss und Gebäudehülle (AO) bleiben getrennt und erhalten. Primäre Raumstruktur: Gebäude – Geschoss – Raum; Zonen haben eigene Raumzuordnungen. Basisbemessungen in Bemessung: GF und GV jeweils GESAMT, OBERIRDISCH, UNTERIRDISCH; VMF und GGF jeweils GESAMT. Keine zusätzlichen numerischen Flächen-/Volumenattribute oder automatischen Summen. Geschosszählung und GF/GV-Aufteilung erhalten getrennte, aufeinander bezogene Regeln. GWR GKAT ist als vorhandene Referenz gebunden; GKLAS und die weltweite Verwendung von GSTAT bleiben ungeprüft und ungebunden. Historische Quellenverweise sind keine Normkonformitäts- oder Abdeckungsbestätigung.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Gebäudenummer; die Bestandteile sind getrennte Attribute, die Gebäude-ID ihre abgeleitete Gesamtrepräsentation. Änderungen der Schlüsselbestandteile erhalten datierte Alt-/Neuschlüsselbezüge. Die physische Abgrenzung ist mit dem SAP-Objekt abzugleichen. EGID und die ausgewählte EGRID bleiben bedingte Schweizer Referenzen; sämtliche Grundstücksbeziehungen behalten Quelle, Rechtsbezug und Gültigkeit. Eigentumsart und eingetragene Eigentümer sind getrennt; Eigentümerzuordnungen erhalten Registerkontext und belegte Anteile, keine automatisch geerbten Eigentümer. Teilportfolio ist ein BBL-Begriff; Objektstrategie ist eine eigene SAP-Quellangabe mit noch abzustimmendem Vokabular. Sieben atomare Komponenten beschreiben die Hauptadresse; weitere Adressen/Eingänge sind eigene Zuordnungen. Geometrie ist ein WGS84-Punkt, identisch mit den beiden Einzelkoordinaten; GeoJSON verwendet [Längengrad, Breitengrad]. Grundriss und Gebäudehülle (AO) bleiben getrennt und erhalten. Primäre Raumstruktur: Gebäude – Geschoss – Raum; Zonen haben eigene Raumzuordnungen. Basisbemessungen in Bemessung: GF und GV jeweils GESAMT, OBERIRDISCH, UNTERIRDISCH; VMF und GGF jeweils GESAMT. Keine zusätzlichen numerischen Flächen-/Volumenattribute oder automatischen Summen. Geschosszählung und GF/GV-Aufteilung erhalten getrennte, aufeinander bezogene Regeln. GWR GKAT ist als vorhandene Referenz gebunden; GKLAS und die weltweite Verwendung von GSTAT bleiben ungeprüft und ungebunden. Historische Quellenverweise sind keine Normkonformitäts- oder Abdeckungsbestätigung.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_object",
      "id": "geschoss",
      "revision": 2,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nGenau ein primäres Gebäude pro fachlichem Zeitpunkt; Building ID referenziert den vollständigen SAP-Gebäudeschlüssel. Geschoss-ID bleibt von Geschosscode, Sortierposition und einzelnen Modellkennungen getrennt. Vollständige Geschosse, Teilgeschosse und reine Modell-/Referenzebenen sind vor einer Zählung zu unterscheiden. Geschosslage betrifft die Zählregel und entscheidet nicht allein über ober-/unterirdische Flächen oder Volumen. Geometriebezüge erhalten DWG-/IFC-Revision, abgegrenzte Modellobjekte, Koordinatensystem, Einheit und Höhenbezug. GF kann als Bemessung mit Bezugsobjekt Geschoss und Umfang GESAMT dieses Geschosses geführt werden; keine ungeprüfte Gleichsetzung mit Netto-Raumflächen. Zeitliche Zuordnung und Historie bei Änderungen erhalten.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nGenau ein primäres Gebäude pro fachlichem Zeitpunkt; Gebäude-ID referenziert den vollständigen SAP-Gebäudeschlüssel. Geschoss-ID bleibt von Geschosscode, Sortierposition und einzelnen Modellkennungen getrennt. Vollständige Geschosse, Teilgeschosse und reine Modell-/Referenzebenen sind vor einer Zählung zu unterscheiden. Geschosslage betrifft die Zählregel und entscheidet nicht allein über ober-/unterirdische Flächen oder Volumen. Geometriebezüge erhalten DWG-/IFC-Revision, abgegrenzte Modellobjekte, Koordinatensystem, Einheit und Höhenbezug. GF kann als Bemessung mit Bezugsobjekt Geschoss und Umfang GESAMT dieses Geschosses geführt werden; keine ungeprüfte Gleichsetzung mit Netto-Raumflächen. Zeitliche Zuordnung und Historie bei Änderungen erhalten.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_object",
      "id": "grundstueck",
      "revision": 2,
      "before": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Grundstücksnummer (BBL), mit getrennten Komponenten. Grundstücksnummer (amtlich) mit Nummerierungsbereich sowie EGRID bleiben separate Registerangaben; BBL- und amtliche Nummer werden nicht gleichgesetzt. Das Profil betrifft Landparzellen; andere Grundstücksrechte behalten eigenen Rechtskontext. Sechs atomare Adress-/Lagekomponenten, ohne Hausnummer. Grenzgeometrie in WGS84 als Polygon oder MultiPolygon, einschliesslich Aussparungen und aller Teile; GeoJSON verwendet [Längengrad, Breitengrad]. Die beiden Einzelkoordinaten sind ein ausgewählter Innenpunkt einer dokumentierten Komponente, kein angenommener Schwerpunkt; gegen die gültige Geometrierevision prüfen. Eigentumsart: Eigentum / Anmiete / Spezialfall; Eigentümer: im zuständigen Register eingetragene Personen/Organisationen, jeweils mit Rechtsbezug, Gültigkeit und belegtem anwendbarem Anteil. Teilportfolio ist eine BBL-Zuordnung. Erforderlicher Profilwert Grundstücksfläche: zugeordnete Bemessung GSF / GESAMT / m². Amtliche und berechnete Flächen bleiben separate Aussagen mit Quelle/Grundlage, keine gegenseitige Überschreibung oder numerische Kopie an jedes Gebäude. Standortgemeinde, sämtliche Gebäudebeziehungen und Rechte bleiben separate datierte Bezüge.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      },
      "after": {
        "comment": "Fachprofil (Entwurf). docs/business-object-attribute-proposal.md; Stand 2026-09-07, 98 Attribute\n\nSAP-Schlüssel: Buchungskreis / Wirtschaftseinheit / Grundstücksnummer, mit getrennten Komponenten. Grundstücksnummer (amtlich) mit Nummerierungsbereich sowie EGRID bleiben separate Registerangaben; BBL- und amtliche Nummer werden nicht gleichgesetzt. Das Profil betrifft Landparzellen; andere Grundstücksrechte behalten eigenen Rechtskontext. Sechs atomare Adress-/Lagekomponenten, ohne Hausnummer. Grenzgeometrie in WGS84 als Polygon oder MultiPolygon, einschliesslich Aussparungen und aller Teile; GeoJSON verwendet [Längengrad, Breitengrad]. Die beiden Einzelkoordinaten sind ein ausgewählter Innenpunkt einer dokumentierten Komponente, kein angenommener Schwerpunkt; gegen die gültige Geometrierevision prüfen. Eigentumsart: Eigentum / Anmiete / Spezialfall; Eigentümer: im zuständigen Register eingetragene Personen/Organisationen, jeweils mit Rechtsbezug, Gültigkeit und belegtem anwendbarem Anteil. Teilportfolio ist eine BBL-Zuordnung. Erforderlicher Profilwert Grundstücksfläche: zugeordnete Bemessung GSF / GESAMT / m². Amtliche und berechnete Flächen bleiben separate Aussagen mit Quelle/Grundlage, keine gegenseitige Überschreibung oder numerische Kopie an jedes Gebäude. Standortgemeinde, sämtliche Gebäudebeziehungen und Rechte bleiben separate datierte Bezüge.\n\nFachlicher Entwurf für den weltweiten BBL-Bestand. PK und PK-Komponenten bezeichnen die fachliche SAP-Identität; interne Katalog-UUIDs bleiben unverändert. FK bezeichnet interne oder externe Referenzen, keine neu angelegte physische Datenbankbeziehung. Property Sets werden bis zur eigenen App-Funktion als Kommentar dokumentiert. Quelle/Revision, Erhebungsdatum, fachliche Gültigkeit und Katalogbearbeitung sind getrennt. Beziehungen und Basisbemessungen werden als Anforderungen beschrieben; dieses Update enthält keine Immobilieninstanzen, Dateien oder numerischen Messwerte."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/bewirtschaftungsstatus",
      "revision": 1,
      "before": {
        "name_de": "Bewirtschaftungsstatus (Gebäude)"
      },
      "after": {
        "name_de": "Bewirtschaftungsstatus"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/buchungskreis",
      "revision": 1,
      "before": {
        "description_de": "SAP-Buchungskreis als erster Bestandteil der Building ID und Kontext der Wirtschaftseinheit. Den Originalwert einschliesslich führender Nullen erhalten; er ist weder Teilportfolio noch Profit Center."
      },
      "after": {
        "description_de": "SAP-Buchungskreis als erster Bestandteil der Gebäude-ID und Kontext der Wirtschaftseinheit. Den Originalwert einschliesslich führender Nullen erhalten; er ist weder Teilportfolio noch Profit Center."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeude-id",
      "revision": 1,
      "before": {
        "name_de": "Building ID",
        "description_de": "Zusammengesetzter SAP-basierter Primärschlüssel des Gebäudes aus Buchungskreis, Wirtschaftseinheit und Gebäudenummer (BBL). Die drei Bestandteile werden separat geführt; die Building ID ist deren konsistente Gesamtrepräsentation. Eine lokale Gebäudenummer oder EGID ersetzt diesen Schlüssel nicht."
      },
      "after": {
        "name_de": "Gebäude-ID",
        "description_de": "Zusammengesetzter SAP-basierter Primärschlüssel des Gebäudes aus Buchungskreis, Wirtschaftseinheit und Gebäudenummer. Die drei Bestandteile werden separat geführt; die Gebäude-ID ist deren konsistente Gesamtrepräsentation. Eine lokale Gebäudenummer oder EGID ersetzt diesen Schlüssel nicht."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudeart",
      "revision": 1,
      "before": {
        "name_de": "Gebäudeart (BBL)"
      },
      "after": {
        "name_de": "Gebäudeart"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudenummer-bbl",
      "revision": 1,
      "before": {
        "name_de": "Gebäudenummer (BBL)",
        "description_de": "Lokale BBL-Gebäudenummer in SAP innerhalb von Buchungskreis und Wirtschaftseinheit; dritter Bestandteil der Building ID. Schreibweise und führende Nullen erhalten. Keine Hausnummer, EGID oder allein weltweit eindeutige Gebäudekennung."
      },
      "after": {
        "name_de": "Gebäudenummer",
        "description_de": "Lokale BBL-Gebäudenummer in SAP innerhalb von Buchungskreis und Wirtschaftseinheit; dritter Bestandteil der Gebäude-ID. Schreibweise und führende Nullen erhalten. Keine Hausnummer, EGID oder allein weltweit eindeutige Gebäudekennung."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/gebaeudestatus",
      "revision": 2,
      "before": {
        "name_de": "Gebäudestatus (physisch)"
      },
      "after": {
        "name_de": "Gebäudestatus"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/grundstueck",
      "revision": 2,
      "before": {
        "description_de": "Fachliche Fremdreferenz auf das für das Gebäude bezeichnete Grundstück im Schweizer Registerkontext. Bei mehreren Grundstücksbeziehungen bezeichnet dieser Einzelwert nur die dokumentiert ausgewählte Referenz; alle weiteren Zuordnungen bleiben separat erhalten. Eine EGRID bestimmt weder die Building ID noch automatisch eine Landparzellengeometrie."
      },
      "after": {
        "description_de": "Fachliche Fremdreferenz auf das für das Gebäude bezeichnete Grundstück im Schweizer Registerkontext. Bei mehreren Grundstücksbeziehungen bezeichnet dieser Einzelwert nur die dokumentiert ausgewählte Referenz; alle weiteren Zuordnungen bleiben separat erhalten. Eine EGRID bestimmt weder die Gebäude-ID noch automatisch eine Landparzellengeometrie."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/objektstrategie",
      "revision": 1,
      "before": {
        "name_de": "Objektstrategie (SAP)"
      },
      "after": {
        "name_de": "Objektstrategie"
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/wirtschaftseinheit",
      "revision": 1,
      "before": {
        "description_de": "SAP-Nummer der Wirtschaftseinheit als zweiter Bestandteil der Building ID. Zusammen mit Buchungskreis referenziert sie genau die Wirtschaftseinheit dieses SAP-Schlüssels; die Nummer allein ist kein vollständiger Fremdschlüssel."
      },
      "after": {
        "description_de": "SAP-Nummer der Wirtschaftseinheit als zweiter Bestandteil der Gebäude-ID. Zusammen mit Buchungskreis referenziert sie genau die Wirtschaftseinheit dieses SAP-Schlüssels; die Nummer allein ist kein vollständiger Fremdschlüssel."
      }
    },
    {
      "kind": "business_attribute",
      "id": "geschoss/building-id",
      "revision": 1,
      "before": {
        "name_de": "Building ID",
        "description_de": "Referenz auf das zugehörige Gebäude. Ein Geschoss hat im betrachteten Gültigkeitszeitraum genau ein fachlich übergeordnetes Gebäude; die Zuordnung verwendet dessen vollständige Building ID."
      },
      "after": {
        "name_de": "Gebäude-ID",
        "description_de": "Referenz auf das zugehörige Gebäude. Ein Geschoss hat im betrachteten Gültigkeitszeitraum genau ein fachlich übergeordnetes Gebäude; die Zuordnung verwendet dessen vollständige Gebäude-ID."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/grundstueck-id",
      "revision": 1,
      "before": {
        "description_de": "Zusammengesetzter SAP-basierter Primärschlüssel der Landparzelle aus Buchungskreis, Wirtschaftseinheit und Grundstücksnummer (BBL). Die drei Bestandteile werden separat geführt; die Grundstück-ID ist deren konsistente Gesamtrepräsentation. EGRID und Grundstücksnummer (amtlich) bleiben separate Registerreferenzen."
      },
      "after": {
        "description_de": "Zusammengesetzter SAP-basierter Primärschlüssel der Landparzelle aus Buchungskreis, Wirtschaftseinheit und Grundstücksnummer. Die drei Bestandteile werden separat geführt; die Grundstück-ID ist deren konsistente Gesamtrepräsentation. EGRID und Grundstücksnummer (amtlich) bleiben separate Registerreferenzen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/grundstuecksnummer-bbl",
      "revision": 1,
      "before": {
        "name_de": "Grundstücksnummer (BBL)"
      },
      "after": {
        "name_de": "Grundstücksnummer"
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/parzellennummer",
      "revision": 2,
      "before": {
        "description_de": "Amtliche Nummer der eingetragenen Parzelle im zugehörigen Nummerierungsbereich. Buchstaben und führende Nullen bleiben Bestandteil des Identifikators. Sie ist kein Ersatz für Grundstücksnummer (BBL) im SAP-Schlüssel."
      },
      "after": {
        "description_de": "Amtliche Nummer der eingetragenen Parzelle im zugehörigen Nummerierungsbereich. Buchstaben und führende Nullen bleiben Bestandteil des Identifikators. Sie ist kein Ersatz für Grundstücksnummer im SAP-Schlüssel."
      }
    },
    {
      "kind": "quality_requirement",
      "id": "profile-gebaeude/gebaeudeart",
      "revision": 1,
      "before": {
        "name_de": "Bedingte Vollständigkeit: Gebäudeart (BBL)"
      },
      "after": {
        "name_de": "Bedingte Vollständigkeit: Gebäudeart"
      }
    }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  raw_before jsonb;
  raw_after jsonb;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  assignments text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete label update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Label operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'German attribute labels already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the 98-attribute profile update first';
  END IF;

  -- Validate the entire reviewed scope before changing any row.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    IF item->>'kind' NOT IN ('business_object','business_attribute','quality_requirement')
      OR EXISTS (SELECT FROM jsonb_object_keys(item->'after') AS field(name)
        WHERE field.name NOT IN ('name_de','description_de','comment'))
      OR (item->'after') = '{}'::jsonb THEN
      RAISE EXCEPTION 'Unexpected label-update scope';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM catalog.%I t WHERE identifier = $1 FOR UPDATE', item->>'kind')
      INTO raw_before USING item->>'id';
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR NOT raw_before @> (item->'before') THEN
      RAISE EXCEPTION 'Stale label baseline for %; review intervening changes', item->>'id';
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
      INTO STRICT raw_after USING item->'after', edited_on, record_uuid, (item->>'revision')::bigint;

    change_count := change_count + 1;
  END LOOP;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected label change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$labels$;

-- Current labels: this query also works after COMMIT and on a repeat run.
SELECT a.identifier, a.name_de AS attribut
FROM catalog.business_attribute a
WHERE a.identifier IN (
  'gebaeude/bewirtschaftungsstatus',
  'gebaeude/buchungskreis',
  'gebaeude/gebaeude-id',
  'gebaeude/gebaeudeart',
  'gebaeude/gebaeudenummer-bbl',
  'gebaeude/gebaeudestatus',
  'gebaeude/grundstueck',
  'gebaeude/objektstrategie',
  'gebaeude/wirtschaftseinheit',
  'geschoss/building-id',
  'grundstueck/grundstueck-id',
  'grundstueck/grundstuecksnummer-bbl',
  'grundstueck/parzellennummer')
ORDER BY a.identifier;

COMMIT;
