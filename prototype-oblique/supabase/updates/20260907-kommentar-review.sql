-- Catalog-wide comment review: the remaining import-curated comments are compacted to
-- their load-bearing substance. The identical XSD note on 14 service fields moves into the
-- two service-table comments; stale source blocks on 7 retired attributes, repeated INTERLIS/
-- Arbeitsmappe/AV-list boilerplate and catalog-status meta are removed. Substantive
-- record-specific flags (SAP codes, RPG/RPV references, truncation flags, open checks) stay;
-- business objects, code values, data services, domains and quality requirements are already
-- compact and stay untouched.
-- Standalone content update AFTER technische-anlage-ebkph-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 56 comment edits (14 comments removed); no other fields change and no change-log entries.
-- Baselines are pinned by SHA-256 of the previous comment instead of repeating the long texts.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $review$
DECLARE
  operation_id constant text := 'kommentar-review-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "Katalogweite Kommentar-Review vom 7. September 2026; Baseline aus dem Hosted-Katalog",
  "requiresOperation": "technische-anlage-ebkph-20260907-v1",
  "expectedChanges": 56,
  "removedComments": 14,
  "changes": [
    {
      "kind": "business_attribute",
      "id": "bemessung/bezeichnung",
      "revision": 2,
      "beforeHash": "3db18139ce086ffaac22aa52d4ee2e2c31248fbe3c97c8509365406f7e670fbc",
      "after": {
        "comment": "Aus dem Fachprofil genommen. Lesbare Bezeichnung aus Art und Bezugsobjekt ableiten; kein separates editierbares Fachattribut im vorliegenden Profil."
      }
    },
    {
      "kind": "business_attribute",
      "id": "bemessung/status",
      "revision": 2,
      "beforeHash": "70f08609e5e5accb1f43a8387f4d32236e44d858cc7882bb2975475703ed9c7f",
      "after": {
        "comment": "Aus dem Fachprofil genommen. Im Fachprofil durch typisierte Bemessungsangaben ersetzen; der Status der Katalogdefinition bleibt separat erhalten."
      }
    },
    {
      "kind": "business_attribute",
      "id": "gebaeude/energietraeger",
      "revision": 2,
      "beforeHash": "244b2d4305deed4a7c1702914234334d73f6f99b757e418daeb344b61046b892",
      "after": {
        "comment": "Aus dem Fachprofil genommen. Mit dem Energiemodell bearbeiten; kein universeller einzelner Gebäudewert im vorliegenden Profil."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/eigentumsform",
      "revision": 2,
      "beforeHash": "9f5c8410a2cced0cb32df544ac5dcc5d79f6ca8362f666c76eff431f3b08a9b2",
      "after": {
        "comment": "Aus dem Fachprofil genommen. Eigentümer, Recht/Vertrag, Anteil und Gültigkeit fachlich trennen; Eigentumsform und Baurecht nicht als ungeprüften Code zusammenfassen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/flaeche",
      "revision": 2,
      "beforeHash": "a2bc102171877aba25812423c4a312ed721a99f44690190d0731303a6f4978d0",
      "after": {
        "comment": "Aus dem Fachprofil genommen. Amtliche Grundstücksfläche als typisierte Bemessung führen und von berechneten Flächen unterscheiden."
      }
    },
    {
      "kind": "business_attribute",
      "id": "grundstueck/gemeinde",
      "revision": 2,
      "beforeHash": "6df2aafdc217095f337b8852b2134d6abc334ec9cfff6ece9900c51148c963fc",
      "after": {
        "comment": "Aus dem Fachprofil genommen. Standortgemeinde als identifizierbare Ortsbeziehung vorsehen."
      }
    },
    {
      "kind": "business_attribute",
      "id": "wirtschaftseinheit/profit-center",
      "revision": 2,
      "beforeHash": "c0e68a896ad174803846d4352549007a54d7333b66fa62b5a62d547257d1bfdd",
      "after": {
        "comment": "Aus dem Fachprofil genommen. Finanzzuordnung oder Systemabbildung; keine ungeprüfte Gleichsetzung mit der Wirtschaftseinheit."
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-land-cover/Art",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-land-cover/BFSNr",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-land-cover/GWR_EGID",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-land-cover/Kanton",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-land-cover/Qualitaet",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-land-cover/msGeometry",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-parcel/BFSNr",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-parcel/EGRIS_EGRID",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-parcel/Flaeche",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-parcel/Kanton",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-parcel/NBIdent",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-parcel/Nummer",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-parcel/Vollstaendigkeit",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-service-parcel/msGeometry",
      "revision": 1,
      "beforeHash": "f2a2073879a482a9fd45aa3dbdd98550f70000a39ba0bde265041540d7cd6ce6",
      "after": {
        "comment": null
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-land-cover-update/Datum1",
      "revision": 1,
      "beforeHash": "90d82f896766077c0049d8059c6ee76c1eb89da2816f14a3940fd07bed61cf5e",
      "after": {
        "comment": "Altbestand laut Modellkommentar; für neue Nachführungen gelten GueltigerEintrag bzw. GBEintrag."
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-property-update/Datum1",
      "revision": 1,
      "beforeHash": "90d82f896766077c0049d8059c6ee76c1eb89da2816f14a3940fd07bed61cf5e",
      "after": {
        "comment": "Altbestand laut Modellkommentar; für neue Nachführungen gelten GueltigerEintrag bzw. GBEintrag."
      }
    },
    {
      "kind": "data_field",
      "id": "t-av-property-update/Datum2",
      "revision": 1,
      "beforeHash": "90d82f896766077c0049d8059c6ee76c1eb89da2816f14a3940fd07bed61cf5e",
      "after": {
        "comment": "Altbestand laut Modellkommentar; für neue Nachführungen gelten GueltigerEintrag bzw. GBEintrag."
      }
    },
    {
      "kind": "data_field",
      "id": "t-boden/av_egrid",
      "revision": 1,
      "beforeHash": "fd05e2ec51d588fd4662dad5cfeab73b8581ea39d89ff1699b8933d548445960",
      "after": {
        "comment": "Die Quelle bezeichnet das Feld als AV AGRID; Schreibweise zu prüfen."
      }
    },
    {
      "kind": "data_field",
      "id": "t-huelle/av_egrid",
      "revision": 1,
      "beforeHash": "fd05e2ec51d588fd4662dad5cfeab73b8581ea39d89ff1699b8933d548445960",
      "after": {
        "comment": "Die Quelle bezeichnet das Feld als AV AGRID; Schreibweise zu prüfen."
      }
    },
    {
      "kind": "data_field",
      "id": "t-geb-gis/bbl_hist-source-41",
      "revision": 1,
      "beforeHash": "3e084a2679efa66403e7a3b0291bf83e186e8e08034c128db9f2e547d26b4a52",
      "after": {
        "comment": "Technischer Name in der Quelle zweimal mit verschiedenen Bezeichnungen vergeben; korrekter Spaltenname zu klären."
      }
    },
    {
      "kind": "data_field",
      "id": "t-geb-gis/bbl_hist-source-42",
      "revision": 1,
      "beforeHash": "3e084a2679efa66403e7a3b0291bf83e186e8e08034c128db9f2e547d26b4a52",
      "after": {
        "comment": "Technischer Name in der Quelle zweimal mit verschiedenen Bezeichnungen vergeben; korrekter Spaltenname zu klären."
      }
    },
    {
      "kind": "data_field",
      "id": "t-gis-green-area/bbl_port",
      "revision": 2,
      "beforeHash": "ca325b62d873b37d660abeb19a4eeabfec0ea2f0a8ef02cece991c7ae6c13e1b",
      "after": {
        "comment": "Status in der Arbeitsmappe nicht angegeben."
      }
    },
    {
      "kind": "data_field",
      "id": "t-parzelle/larea_buf",
      "revision": 1,
      "beforeHash": "954289ff8d886b691fbff13ea5e240a81d4ae55b58ca9407578c0f693027e7f1",
      "after": {
        "comment": "Die Quelle bezeichnet larea_buf als unbearbeitete Umgebungsfläche (UUF); Kürzel und Bezeichnung zu prüfen."
      }
    },
    {
      "kind": "data_field",
      "id": "t-parzelle/larea_uuf",
      "revision": 1,
      "beforeHash": "ba80c3004d5ab85265a2f33ef55c5981b775e2b33f56a729700e9b529d9f6527",
      "after": {
        "comment": "Die Quelle bezeichnet larea_uuf als bearbeitete Umgebungsfläche (BUF); Kürzel und Bezeichnung zu prüfen."
      }
    },
    {
      "kind": "data_table",
      "id": "t-av-building-number",
      "revision": 1,
      "beforeHash": "c1d34f8fcc2d6d4ef935ae86ec85b3d005644bd34be24c5b279654a69f4736c8",
      "after": {
        "comment": "INTERLIS-Modellklasse, kein physischer Tabellenname; Modellpflicht und Eindeutigkeit gelten für den Datentransfer."
      }
    },
    {
      "kind": "data_table",
      "id": "t-av-land-cover",
      "revision": 1,
      "beforeHash": "c1d34f8fcc2d6d4ef935ae86ec85b3d005644bd34be24c5b279654a69f4736c8",
      "after": {
        "comment": "INTERLIS-Modellklasse, kein physischer Tabellenname; Modellpflicht und Eindeutigkeit gelten für den Datentransfer."
      }
    },
    {
      "kind": "data_table",
      "id": "t-av-land-cover-update",
      "revision": 1,
      "beforeHash": "c1d34f8fcc2d6d4ef935ae86ec85b3d005644bd34be24c5b279654a69f4736c8",
      "after": {
        "comment": "INTERLIS-Modellklasse, kein physischer Tabellenname; Modellpflicht und Eindeutigkeit gelten für den Datentransfer."
      }
    },
    {
      "kind": "data_table",
      "id": "t-av-property-update",
      "revision": 1,
      "beforeHash": "c1d34f8fcc2d6d4ef935ae86ec85b3d005644bd34be24c5b279654a69f4736c8",
      "after": {
        "comment": "INTERLIS-Modellklasse, kein physischer Tabellenname; Modellpflicht und Eindeutigkeit gelten für den Datentransfer."
      }
    },
    {
      "kind": "data_table",
      "id": "t-av-parcel",
      "revision": 1,
      "beforeHash": "0f0f294734779cb96ac9f76e75d4347b05b3ed70116fdee8dcef0c28adc81e94",
      "after": {
        "comment": "INTERLIS-Modellklasse, kein physischer Tabellenname; Modellpflicht und Eindeutigkeit gelten für den Datentransfer. Ein Grundstück kann mehrere Teilflächen haben; AREA kann Kreisbögen enthalten, GeoJSON erfordert deren Approximation. Das amtliche Flächenmass nicht durch eine neu berechnete Polygonfläche ersetzen."
      }
    },
    {
      "kind": "data_table",
      "id": "t-av-property",
      "revision": 1,
      "beforeHash": "a18d5dec3ce55d650b5eb1ea0383b6385d8053ea35959b3486d5cd465f8b29e5",
      "after": {
        "comment": "INTERLIS-Modellklasse, kein physischer Tabellenname; Modellpflicht und Eindeutigkeit gelten für den Datentransfer. EGRID ist im Modell optional; NBIdent und Nummer bilden die deklarierte Identifikation. Keine Eigentümer-, Rechte- oder Grundbuchdaten aus eGRISDM importiert."
      }
    },
    {
      "kind": "data_table",
      "id": "t-av-service-land-cover",
      "revision": 1,
      "beforeHash": "a9113aaea4a5274c52e46062c43ad9678dea8870050d975805252affd9c4d009",
      "after": {
        "comment": "Service-Layer, keine physische Tabelle; Feldnamen und Typen im XSD bestätigt, minOccurs=0 bedeutet keine physische Nullfähigkeit. OGC-API-Beispielabfrage lieferte HTTP 403; Wertecodierung und Geometriequalität des Dienstes bleiben zu prüfen, DM.01-Wertelisten sind nicht als Servicecodes bestätigt."
      }
    },
    {
      "kind": "data_table",
      "id": "t-av-service-parcel",
      "revision": 1,
      "beforeHash": "a9113aaea4a5274c52e46062c43ad9678dea8870050d975805252affd9c4d009",
      "after": {
        "comment": "Service-Layer, keine physische Tabelle; Feldnamen und Typen im XSD bestätigt, minOccurs=0 bedeutet keine physische Nullfähigkeit. OGC-API-Beispielabfrage lieferte HTTP 403; Wertecodierung und Geometriequalität des Dienstes bleiben zu prüfen, DM.01-Wertelisten sind nicht als Servicecodes bestätigt."
      }
    },
    {
      "kind": "data_table",
      "id": "t-boden",
      "revision": 1,
      "beforeHash": "133d950e79488c81e4bf8e19965bc3fb5db322dee5cc162e1b7f2791d98785e7",
      "after": {
        "comment": "Arbeitsmappe: 18 LIVE, 28 DEV; physischer Tabellenname, Schlüsselfelder und Spaltenlängen nicht dokumentiert. Typ Gebäude der Bodenabdeckung als Gebäudegrundfläche (Polygon); die Arbeitsmappe nennt diesen Typ BBL Gebäude (AO), die Felder gelten für diesen Typ."
      }
    },
    {
      "kind": "data_table",
      "id": "t-geb-gis",
      "revision": 1,
      "beforeHash": "904ca51193921a9d91af6d848beb38e77cb93589a6e51107e3bee455d6a8c740",
      "after": {
        "comment": "Arbeitsmappe: 72 LIVE, 2 DEV; physischer Tabellenname, Schlüsselfelder und Spaltenlängen nicht dokumentiert. bbl_hist ist zweimal unterschiedlich bezeichnet; beide Quellzeilen bleiben getrennt erhalten."
      }
    },
    {
      "kind": "data_table",
      "id": "t-gis-green-area",
      "revision": 1,
      "beforeHash": "c9f53d781dc835a3d614c08f9a03165589ded88ec0dc2e889b1828064c865a1c",
      "after": {
        "comment": "Arbeitsmappe: 23 DEV, 1 ohne Status; physischer Tabellenname, Schlüsselfelder und Spaltenlängen nicht dokumentiert."
      }
    },
    {
      "kind": "data_table",
      "id": "t-gis-room",
      "revision": 1,
      "beforeHash": "8350b8aa8cf3b8607c4a53d817cfc56aab0e2323219988adf4ed0224ddcc9bda",
      "after": {
        "comment": "Arbeitsmappe: 32 DEV; physischer Tabellenname, Schlüsselfelder und Spaltenlängen nicht dokumentiert."
      }
    },
    {
      "kind": "data_table",
      "id": "t-huelle",
      "revision": 2,
      "beforeHash": "c7aee381df4eb57e9900cbf0b6267b6132a10a4830692794708406fa8467a28f",
      "after": {
        "comment": "Arbeitsmappe: 30 DEV; physischer Tabellenname, Schlüsselfelder und Spaltenlängen nicht dokumentiert."
      }
    },
    {
      "kind": "data_table",
      "id": "t-parzelle",
      "revision": 1,
      "beforeHash": "67c389f69393cb27b8b58ede6463c7cadcbe0ac65887b251b3c5981106279688",
      "after": {
        "comment": "Arbeitsmappe: 41 LIVE, 1 DEV; physischer Tabellenname, Schlüsselfelder und Spaltenlängen nicht dokumentiert."
      }
    },
    {
      "kind": "data_table",
      "id": "t-proj",
      "revision": 1,
      "beforeHash": "577303fe01ab902c6441427f1735b3518594c86b347f13fcf240ec898d0cee53",
      "after": {
        "comment": "Arbeitsmappe: 27 DEV; physischer Tabellenname, Schlüsselfelder und Spaltenlängen nicht dokumentiert."
      }
    },
    {
      "kind": "data_table",
      "id": "t-bem",
      "revision": 1,
      "beforeHash": "ca219f0492afdec4ff516fab885bbd8a7e958910893d5d4df14b0aad2471a783",
      "after": {
        "comment": "Bemessungszeilen tragen eine AOID als Verknüpfung zu Geometrie in DWG-Plänen (Korasoft-Umfeld), z. B. Räume oder Flächenpolygone. Physische Spaltenzuordnung, Gültigkeitsbezug und Kardinalität bleiben zu prüfen; die Beispielfeldliste ist nicht als SAP-Schema bestätigt."
      }
    },
    {
      "kind": "code_list",
      "id": "r-av-boundary-line-type",
      "revision": 1,
      "beforeHash": "25f3cbc2ef367772f58f2f9c1ab46bf8de6d56729f67f0d57640e4d6711976d3",
      "after": {
        "comment": "Codes sind symbolische INTERLIS-Pfade, keine numerischen Fachcodes; Anzeigenamen sind formatierte Modellwerte. Linienattribute gehören zur Geometrie, nicht zu einem eigenständigen Polygonattribut. Undefiniert bedeutet im Modell rechtskräftig und vollständig."
      }
    },
    {
      "kind": "code_list",
      "id": "r-av-completeness",
      "revision": 1,
      "beforeHash": "b97ccd1cf23607e33b8ec52f76ffd952be13b3f00e6b66523e5af0c167d7ec80",
      "after": {
        "comment": "Codes sind symbolische INTERLIS-Pfade, keine numerischen Fachcodes; Anzeigenamen sind formatierte Modellwerte."
      }
    },
    {
      "kind": "code_list",
      "id": "r-av-land-cover-type",
      "revision": 1,
      "beforeHash": "b97ccd1cf23607e33b8ec52f76ffd952be13b3f00e6b66523e5af0c167d7ec80",
      "after": {
        "comment": "Codes sind symbolische INTERLIS-Pfade, keine numerischen Fachcodes; Anzeigenamen sind formatierte Modellwerte."
      }
    },
    {
      "kind": "code_list",
      "id": "r-av-property-type",
      "revision": 1,
      "beforeHash": "b97ccd1cf23607e33b8ec52f76ffd952be13b3f00e6b66523e5af0c167d7ec80",
      "after": {
        "comment": "Codes sind symbolische INTERLIS-Pfade, keine numerischen Fachcodes; Anzeigenamen sind formatierte Modellwerte."
      }
    },
    {
      "kind": "code_list",
      "id": "r-av-property-validity",
      "revision": 1,
      "beforeHash": "b97ccd1cf23607e33b8ec52f76ffd952be13b3f00e6b66523e5af0c167d7ec80",
      "after": {
        "comment": "Codes sind symbolische INTERLIS-Pfade, keine numerischen Fachcodes; Anzeigenamen sind formatierte Modellwerte."
      }
    },
    {
      "kind": "code_list",
      "id": "r-av-quality",
      "revision": 1,
      "beforeHash": "b97ccd1cf23607e33b8ec52f76ffd952be13b3f00e6b66523e5af0c167d7ec80",
      "after": {
        "comment": "Codes sind symbolische INTERLIS-Pfade, keine numerischen Fachcodes; Anzeigenamen sind formatierte Modellwerte."
      }
    },
    {
      "kind": "code_list",
      "id": "r-av-update-status",
      "revision": 1,
      "beforeHash": "b97ccd1cf23607e33b8ec52f76ffd952be13b3f00e6b66523e5af0c167d7ec80",
      "after": {
        "comment": "Codes sind symbolische INTERLIS-Pfade, keine numerischen Fachcodes; Anzeigenamen sind formatierte Modellwerte."
      }
    },
    {
      "kind": "system",
      "id": "av",
      "revision": 1,
      "beforeHash": "c7ebe3eeaf8b82e8ebf1b57669ac29b4d2c2d42b3979bf8acd7dbbf8117ccfd3",
      "after": {
        "comment": "Fachlicher Datenbestand aus kantonalen Quellen, kein zentrales BBL-System; Bundesaufsicht swisstopo. DM.01 wird bis 31.12.2027 durch DMAV abgelöst. eCH-0153 beschreibt das elektronische Grundbuch und ersetzt das AV-Geometriemodell nicht."
      }
    },
    {
      "kind": "system",
      "id": "gis",
      "revision": 1,
      "beforeHash": "097a487bcdeead900f65a8c728e91bbc6cf5d06075de8172e36e167ab7203831",
      "after": {
        "comment": "Arbeitsmappe mit Quellenstatus LIVE und DEV; technische Tabellennamen, Geometrietypen und API-Verfügbarkeit sind daraus nicht bestätigt."
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
    RAISE EXCEPTION 'Run the complete comment review as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Comment operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'Comment review already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the Technische Anlage update first';
  END IF;

  -- Validate the entire reviewed scope before changing any row.
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'changes') LOOP
    IF item->>'kind' NOT IN ('business_attribute','data_field','data_table','code_list','system')
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

  IF (SELECT count(*) FROM jsonb_array_elements(proposal->'changes') c WHERE c->'after'->>'comment' IS NULL)
      <> (proposal->>'removedComments')::integer THEN
    RAISE EXCEPTION 'Unexpected removal count; rolling back';
  END IF;
  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$review$;

-- Comment footprint after the review: these queries also work after COMMIT and on a repeat run.
SELECT 'data_field' AS entity, count(*) FILTER (WHERE comment IS NOT NULL) AS with_comment, max(length(comment)) AS longest FROM catalog.data_field
UNION ALL SELECT 'data_table', count(*) FILTER (WHERE comment IS NOT NULL), max(length(comment)) FROM catalog.data_table
UNION ALL SELECT 'code_list', count(*) FILTER (WHERE comment IS NOT NULL), max(length(comment)) FROM catalog.code_list
UNION ALL SELECT 'business_attribute', count(*) FILTER (WHERE comment IS NOT NULL), max(length(comment)) FROM catalog.business_attribute
UNION ALL SELECT 'system', count(*) FILTER (WHERE comment IS NOT NULL), max(length(comment)) FROM catalog.system
ORDER BY entity;

COMMIT;
