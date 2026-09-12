# Archived catalog content updates

These 22 standalone SQL Editor updates were applied on 7 September 2026 after the schema and initial import. They are retained as historical evidence and for recovery; their SQL contents are unchanged. They are not pending migrations and are not applied by the Supabase CLI. Preparing and testing these scripts does not apply them to the hosted database.

Use the app or authenticated API for new content changes. For recovery, follow the explicit sequence below, not alphabetical filename order. The comment review also requires the separately recorded `t-huelle` rename; this archive alone is not a complete backup of the hosted database.

## Business-object profiles — 7 September 2026

[20260907-business-object-profiles.sql](20260907-business-object-profiles.sql) implements the **98-attribute draft** in the [reviewed proposal](../../docs/business-object-attribute-proposal.md). It starts from the original import. A read-only API check on 7 September 2026 confirmed that this operation **already committed in the hosted database**, with all 98 active attributes. The reported missing `profile_changes` relation concerned the temporary result report. The scripts now use ordinary catalog queries for their results. The earlier four-profile draft is superseded.

**Applied follow-ups:** [20260907-business-object-labels.sql](20260907-business-object-labels.sql) (German naming cleanup below) and [20260907-business-object-geometry.sql](20260907-business-object-geometry.sql) (106-attribute synchronization below) **both committed in the hosted database on 7 September 2026**, verified by their operation markers and fingerprints. The original profile payload remains unchanged so its existing operation fingerprint stays valid.

| Object | Active attributes | Existing updated | Created | Retired |
|---|---:|---:|---:|---:|
| Gebäude | 32 | 6 | 26 | 1 |
| Geschoss | 10 | 4 | 6 | 0 |
| Raum | 10 | 4 | 6 | 0 |
| Zone | 7 | 0 | 7 | 0 |
| Grundstück | 21 | 2 | 19 | 3 |
| Wirtschaftseinheit | 8 | 3 | 5 | 1 |
| Bemessung | 10 | 2 | 8 | 2 |
| **Total** | **98** | **21** | **77** | **7** |

The script updates six existing object definitions and creates Zone in the same business domain as Raum. It preserves existing UUIDs, public identifiers and semantic names where meanings continue, including Gebäude → EGRID at `gebaeude/grundstueck`, Grundstücksnummer (amtlich) at `grundstueck/parzellennummer`, and WE's Buchungskreis and WE number. A revised display name does not change a bookmark or source reference.

The seven retirements are Gebäude/Energieträger; Grundstück/Gemeinde, Fläche and Eigentumsform; Wirtschaftseinheit/Profit Center; and Bemessung/Bezeichnung and Status. Their records, definitions, references and history remain. GSF remains an explicit required measurement for Grundstück; retiring the separate Fläche definition does not remove that requirement.

## Content and current schema limits

- **SAP keys:** separate Buchungskreis, Wirtschaftseinheit and local BBL building/parcel numbers. Full Gebäude-ID, Grundstück-ID and Wirtschaftseinheit-ID describe their composite identities. All eight key components preserve textual identity. The catalog's `is_identifier` flag records participation in identification; it is true for the seven full IDs and eight components. The current UI labels both as PK. The exact PK/component/composite-FK roles are retained in comments. EGID, EGRID and ordinary object references are not marked as PK.
- **Ownership and location:** both building and parcel have Eigentumsart, registered Eigentümer and Teilportfolio. Addresses remain atomic; parcels have no Hausnummer. Building geometry is a WGS84 Point with synchronized latitude/longitude. Parcel geometry permits Polygon/MultiPolygon and has separate interior-point coordinates. These describe requirements, not property instance values or physical asset-table constraints.
- **Property sets:** all 98 attributes retain their proposed group in `comment` as `Property Set (vorgeschlagen): …` and in the embedded SQL proposal. This does not implement property-set tables, editing or grouped app views.
- **Measurement requirements:** five new candidate `measuredFor` relationships connect Bemessung to Gebäude, Grundstück, Geschoss, Raum and Zone, using the existing relationship type. Their scope notes preserve the requested type/scope/unit selections and applicability, including required GSF. They do not create measurements or claim data coverage. Room hierarchy and zone membership remain requirements in object comments; their new relationship types/instance storage need the later feature.
- **Completeness:** one shared core rule and 26 conditional rules, all draft. The eight optional attributes have no requirement assignment. These are business requirements, not executable validation of asset records.

Four **local draft code lists** are created, with 13 values:

| List | Values |
|---|---|
| `profile-bemessungsart` | GF, VMF, GV, GGF, GSF |
| `profile-bemessungsumfang` | GESAMT, OBERIRDISCH, UNTERIRDISCH |
| `profile-eigentumsart` | Eigentum, Anmiete, Spezialfall |
| `profile-messeinheit` | m², m³ |

These codes express the proposal; they do not claim SAP code equivalence or SIA certification. Existing lists and values remain unchanged. GKAT binds to the checked GWR reference list. GKLAS, worldwide GSTAT adoption, Objektstrategie, Teilportfolio and other unconfirmed vocabularies remain unbound; their descriptive requirements remain draft.

**Gebäudehülle (AO) retains all 30 source fields.** Source tables/fields, existing relationship assertions, governance, historical metadata, application code, schema and grants remain unchanged. The current UI includes retired definitions in total counts; SQL reports active and retired counts separately.

## German attribute names

The follow-up updates eight attribute labels across Gebäude, Geschoss and Grundstück:

| Previous label | Current label |
|---|---|
| Building ID (Gebäude and Geschoss) | Gebäude-ID |
| Gebäudenummer (BBL) | Gebäudenummer |
| Grundstücksnummer (BBL) | Grundstücksnummer |
| Gebäudeart (BBL) | Gebäudeart |
| Gebäudestatus (physisch) | Gebäudestatus |
| Bewirtschaftungsstatus (Gebäude) | Bewirtschaftungsstatus |
| Objektstrategie (SAP) | Objektstrategie |

It also aligns references in definitions, three object comments and the affected completeness-rule name: **17 record edits in total**. Register qualifiers **(GWR)** and **(amtlich)** remain. Technical identifiers such as `geschoss/building-id` and `gebaeude/gebaeudenummer-bbl` stay stable so existing references continue to work. Profile counts, property sets and key roles are unchanged.

## 106-attribute synchronization — 7 September 2026

[20260907-business-object-geometry.sql](20260907-business-object-geometry.sql) synchronizes the catalog with the revised [106-attribute proposal](../../docs/business-object-attribute-proposal.md). It requires the naming follow-up and was applied to the hosted database on 7 September 2026. **44 record edits/creates**, plus eight core-rule assignments and one removed conditional assignment:

| Change | Scope |
|---|---|
| 8 new attributes | Geschoss: Geometrie, Höhenlage, Höhenbezug; Raum: Geometrie; Zone: Geometrie, Geometriebezug; Bemessung: Bezugsobjekttyp, Bezugsobjekt-ID — all Kernangaben of the shared core rule |
| 7 revised definitions | Raumnutzung (now optional, separated from area schemes), Flächenklassifikation (parallel SIA 416 / DIN 277 / IPMS) and five Bemessung attributes covering the twelve kinds, meters and length values |
| 3 property-set moves | Gebäude Teilportfolio and Objektstrategie plus Grundstück Teilportfolio move to **Portfoliomanagement** (comment metadata only) |
| Vocabularies | `profile-bemessungsart` grows from five to **twelve** kinds (AGF, GESCHOSSHOEHE, RAUMFLAECHE, RAUMHOEHE, RAUMVOLUMEN, ZONENFLAECHE, ZONENVOLUMEN); GV becomes Volumen GV; `profile-messeinheit` adds `m`; the GESAMT, m² and m³ definitions extend to the new kinds |
| Measurement links | The Geschoss, Raum and Zone `measuredFor` scope notes now describe the **20 profile selections**; the Gebäude and Grundstück notes are unchanged |
| Completeness | Raumnutzung loses its conditional assignment and `profile-raum/raumnutzung` is retired with history; the Flächenklassifikation condition follows the revised wording |
| Objects | All seven comments reflect the 106-attribute state; the Bemessung working definition now covers length values |

Attribute identities, retired records, change logs, source inventories (including Gebäudehülle) and all other content are untouched. The seven attributes whose Markdown definitions were unchanged keep their revisions.

## BBL Referenzdaten — 7 September 2026

[20260907-bbl-referenzdaten.sql](20260907-bbl-referenzdaten.sql) loads the SAP F4 value helps captured in [screenshot evidence](../../docs/sources/sap-refx/2026-09-07-sap-f4-referenzdaten.json). It requires the 106-attribute synchronization and was applied to the hosted database on 7 September 2026. **164 record edits/creates:**

| Change | Scope |
|---|---|
| 4 new reference lists | **Teilportfolio (BBL)** (10 values), **Gebäudeart 1 (BBL)** (21), **Gebäudeart 2 (BBL)** (100, two Langtexte truncated in the capture and flagged; 02.05 absent), **Mietmodell (BBL)** (14, Verrechnungsmodell Miete) |
| Eigentumsart | List renamed to **Eigentumsart (BBL)**; the confirmed SAP codes 01 (Eigentum Bund), 03 (Mietobjekt) and 05 (Spezialfall) are recorded on the three agreed values, whose codes and identifiers stay unchanged |
| 2 attribute bindings | Teilportfolio (BBL) becomes the bound Werteliste of the Gebäude and Grundstück Teilportfolio attributes |
| 8 field bindings | `bbl_gbda1`/`bbl_gbda2` → Gebäudeart 1/2, `bbl_port` (three GIS tables) → Teilportfolio, `bbl_eigen` (three GIS tables) → Eigentumsart; the GIS descriptions document exactly this SAP master data |
| Gebäudeart attribute | References both Gebäudeart lists in its comment; the two-level `structured` attribute deliberately binds neither single list |

An assignment audit of every code list against attributes and fields found no incorrect links. Deliberately unbound and documented: AV service fields (WFS strings without enumerated wire values), AV Grenzlinienart (line geometry, no scalar field), GKLAS on the attribute (4.2/5.0 vocabulary unverified), Mietmodell (BBL) (attribute decision open) and the legacy 2021 lists (r-energie, r-gwr-heiz with the older 4.x heating codes, r-kanton, r-kond, r-sia-flaeche, r-waehrung and the empty r-eigentum/r-vertrag/r-zaehler) whose anchors never existed, are retired or lack captured vocabularies.

## Kompakte Kommentare — 7 September 2026

[20260907-kompakte-kommentare.sql](20260907-kompakte-kommentare.sql) compacts the comments the four operations above created; it requires the BBL Referenzdaten and was applied to the hosted database on 7 September 2026. **319 comment edits, nothing else changes.** Every record keeps only load-bearing lines: the property-set assignment, the short key role (PK, PK-Komponente, PK-Komponente / FK, FK), the conditional-applicability text, the Gebäudeart reference-list pointer, the three confirmed SAP-code notes and the two truncation flags. The repeated per-record source lines, the core/optional presence boilerplate and the identical methodology paragraph on all seven objects are removed; each object keeps one source reference plus a distilled two-to-four-sentence note. Import-curated comments elsewhere, retired records and their history are untouched. Baselines are pinned by SHA-256 of the previous comment instead of repeating the long texts.

## Dokumente Management und Architektonische Sicht — 7 September 2026

Six applied operations extend the catalog with EA-IMMO content from `prototype-datamodel/docs/`, one KBOB-IPB document type, an eBKP-H clarification and a catalog-wide comment review:

| Script | Content |
|---|---|
| [20260907-dokumentenmanagement.sql](20260907-dokumentenmanagement.sql) | New domain **Dokumente Management** (`dokumente`) with eleven business objects from the Fachkonzept Dokumentenmanagement (four Muss, four Soll, three Kann in five groups); Physisches Archiv and Datei deliberately not modelled |
| [20260907-architektonische-sicht.sql](20260907-architektonische-sicht.sql) | Six objects added to the existing domain `bau`: Parkplatz, Baurecht, Dienstbarkeit, Technische Anlage, Technische Komponente (source name Komponente) and Bauteil; the Anlage/Bauteil specializations with type-specific IFC/eBKP-H attributes are recorded as later type-profile work, management processes stay with Objektmanagement |
| [20260907-dokumente-kuerzung.sql](20260907-dokumente-kuerzung.sql) | Review: Version, Workflow, Anweisung and Nachricht removed again (validated same-day creations without references; the identity guard is disabled only for these four deletes and re-enabled), and the thirteen remaining new comments compacted to group, priority, primary identification and note |
| [20260907-cafm-basisplan.sql](20260907-cafm-basisplan.sql) | **CAFM Basisplan** as an eighth Dokumente-Management object: the KBOB-IPB Anhang C document type (Dokumenttypenkatalog 2016) for the DWG floor base plan of the Flächenmanagement, with the catalog PDF linked |
| [20260907-technische-anlage-ebkph.sql](20260907-technische-anlage-ebkph.sql) | **Technische Anlage** broadened from HLK-only to the general building system per eBKP-H Hauptgruppe D (Technik Gebäude): Elektro, Gebäudeautomation, Sicherheit, Brandschutz, Wärme, Kälte, Luft, Wasser, Abwasser, Gas, Spezialmedien, Beförderung; eBKP-H (SN 506 511) joins the normative references. Evidence: [docs/sources/ebkp-h](../../docs/sources/ebkp-h/2026-09-07-ebkph-technik-gebaeude.json) |
| [20260907-kommentar-review.sql](20260907-kommentar-review.sql) | Catalog-wide comment review: 56 comment edits across attributes, fields, tables, code lists and systems. The identical XSD note on 14 service fields moves into the two service-table comments (comments removed); stale source blocks on 7 retired attributes, repeated INTERLIS/Arbeitsmappe/AV-list boilerplate and catalog-status meta are dropped. Substantive record-specific flags (SAP codes, RPG/RPV references, truncation flags, open checks) stay; already compact entities are untouched |

## Referenzdaten-Namen, ISO-Länder und Datenprodukte — 7 September 2026

Three applied operations establish the reference-data naming convention (`<Quelle> <Name>`, parentheses reserved for technical ids as on the GWR lists), add the country vocabulary and review the data products:

| Script | Content |
|---|---|
| [20260907-referenzdaten-namen.sql](20260907-referenzdaten-namen.sql) | Eight code-list renames: the five SAP-F4 lists lose the "(BBL)" suffix in favour of the **BBL** prefix (BBL Eigentumsart, BBL Gebäudeart 1/2, BBL Mietmodell, BBL Teilportfolio) and the three Basisbemessungen lists are simplified to BBL Bemessungsart, BBL Bemessungsumfang and BBL Bemessungseinheit. BBL Eigentumsart is assigned to the Architektonische Sicht domain; the Gebäudeart attribute comment follows the rename |
| [20260907-iso-laender.sql](20260907-iso-laender.sql) | New list **ISO 3166-1 Land** with the 249 officially assigned alpha-2 country codes and German short names, bound to the Land attributes of Gebäude and Grundstück and to the country-coded source fields (six GIS `adr_land`, GWR `PAGLAND`, SAP `Land`). Names are flagged for verification against the official Staatenverzeichnis (BFS/eCH-0072) |
| [20260907-datenprodukte-review.sql](20260907-datenprodukte-review.sql) | **Bundesimmobilien (Open Data)** retired (not published as OGD; identity, product attributes and relationships preserved) and **Gebäudebestand Bund** renamed to **SAP Liegenschafteninventar**: the SAP transaction with Gebäude und Grundstücke, combined from SAP sources such as RE-FX and Anlagenbuchhaltung (AA), monthly from the ERP per `prototype-dcat/data/datasets.json` |
| [20260907-iso-land-domain.sql](20260907-iso-land-domain.sql) | **ISO 3166-1 Land** assigned to the Architektonische Sicht domain, alongside BBL Eigentumsart |

## Bereinigung, Flächenarten, Kostenelemente und Profile — 7 September 2026

Seven applied operations complete the reference-data build-out and the object profiles:

| Script | Content |
|---|---|
| [20260907-referenzdaten-bereinigung.sql](20260907-referenzdaten-bereinigung.sql) | **Eigentumsform** retired as an empty duplicate of BBL Eigentumsart (import history preserved); **Kanton** becomes **eCH Kanton** after verifying its 26 codes against `cantonAbbreviationType` in the eCH-0007 6.0 schema, with the standard page linked |
| [20260907-flaechenarten.sql](20260907-flaechenarten.sql) | **SIA 416 Flächenart** completed with the plot areas (GSF, GGF, UF, BUF, UUF → 13 values); new lists **DIN 277 Flächenart** (16 values incl. NUF 1–7 per DIN 277-1:2021-08) and **IPMS Flächenart** (the six IPMS: All Buildings 2023 classes 1, 2, 3.1, 3.2, 4.1, 4.2, extracted from the official standard PDF); all anchored to Bemessung |
| [20260907-crb-kostenelemente.sql](20260907-crb-kostenelemente.sql) | **CRB eBKP-H Kostenelemente**: fourteen lists, one per Hauptgruppe (A Grundstück … Z Mehrwertsteuer) with 71 Elementgruppen and 328 Elemente, parsed from `docs/sources/ebkp-h/Auszug_eBKP_2020_Web.pdf` (Verzeichnis 5.1) and cross-checked against the Hauptgruppe-D screenshot transcription. Evidence: [2026-09-07-ebkph-kostenelemente.json](../../docs/sources/ebkp-h/2026-09-07-ebkph-kostenelemente.json) |
| [20260907-kbob-dokumenttypen.sql](20260907-kbob-dokumenttypen.sql) | **KBOB Dokumenttyp**: the complete KBOB-IPB Anhang C Dokumenttypenkatalog 2016 (4 Hauptgruppen, 53 Gruppen, 610 Dokumenttypen with descriptions), anchored to the Dokumenttyp object; the CAFM Basisplan corresponds to Basisplan CAFM (V02007, V11001). Evidence: [docs/sources/kbob](../../docs/sources/kbob/2026-09-07-kbob-dokumenttypen.json) |
| [20260907-praezise-namen.sql](20260907-praezise-namen.sql) | Precise names: the fourteen CRB lists become **CRB eBKP-H \<Hauptgruppe\>**, and the register attributes carry their source: **EGID (GWR)**, **EGRID (AV)** on Gebäude and Grundstück |
| [20260907-bodenbedeckung-profil.sql](20260907-bodenbedeckung-profil.sql) | **Bodenbedeckung** profile per owner review: EGID (GWR)/EGRID (AV), Art → AV Bodenbedeckungsart, Lageadresse without Strasse/Hausnummer (Land → ISO 3166-1 Land), WGS84 polygon, Teilportfolio → BBL Teilportfolio, Fläche in m²; Bezeichnung and Gültig ab retired |
| [20260907-schluessel-review.sql](20260907-schluessel-review.sql) | Key-role review: exactly one PK per object (the ID attribute); Buchungskreis and the Wirtschaftseinheit references become FK, and Gebäudenummer, Grundstücksnummer and WE-Nummer lose their key role (not unique on their own). The app now reads FK/UK from the Schlüsselrolle comment line (`js/catalog.js`); the Schlüssel column of the proposal document still shows PK-Komponente and follows in a later revision |


All created records follow the Zone precedent: draft status, descriptions and standards from the source documents, no invented governance, classification, version or priority. JSON fixtures stay frozen; the new content is visible in the hosted catalog only.

## Transaction and repeat-run behavior

None of the scripts generates change-log entries. Existing creation/version dates are preserved; modified dates and revisions reflect the actual edits. The original operation's previously saved history remains in the database.

The first three scripts acquire the catalog write lock and validate the expected records before editing. The profile update checks the original six objects, 28 attributes, 26 requirement assignments and reviewed GKAT vocabulary. The naming follow-up requires the profile operation and checks the 17 affected records' revisions and previous text. The 106-attribute synchronization requires the naming follow-up and checks all 28 edited records' revisions and previous text, refuses pre-existing identifiers for its creations and verifies the final active counts. Intervening edits or collisions cause a rollback.

The private operation marker fingerprints the embedded content and baseline. Identical repeat execution performs no edits, including after subsequent catalog changes. Reusing an operation ID with different content is refused. Operation IDs are `business-object-profiles-20260907-v2`, `business-object-labels-20260907-v1`, `business-object-geometry-20260907-v1`, `bbl-referenzdaten-20260907-v1`, `kompakte-kommentare-20260907-v1`, `dokumentenmanagement-20260907-v1`, `architektonische-sicht-20260907-v1`, `dokumente-kuerzung-20260907-v1`, `cafm-basisplan-20260907-v1`, `technische-anlage-ebkph-20260907-v1`, `kommentar-review-20260907-v1`, `referenzdaten-namen-20260907-v1`, `iso-laender-20260907-v1`, `datenprodukte-review-20260907-v1`, `iso-land-domain-20260907-v1`, `referenzdaten-bereinigung-20260907-v1`, `flaechenarten-20260907-v1`, `crb-kostenelemente-20260907-v1`, `kbob-dokumenttypen-20260907-v1`, `praezise-namen-20260907-v1`, `bodenbedeckung-profil-20260907-v1` and `schluessel-review-20260907-v1`.

## Historical replay in Supabase SQL Editor

1. All twenty-two scripts are applied in the hosted database; repeat execution is a no-op. For a fresh original import, run them in this dependency order (profiles, labels, geometry, Referenzdaten, compact comments, Dokumente Management, Architektonische Sicht, Kürzung, CAFM Basisplan, Technische Anlage eBKP-H, Kommentar-Review, Referenzdaten-Namen, ISO-Länder, Datenprodukte-Review, ISO-Land-Domäne, Bereinigung, Flächenarten, CRB Kostenelemente, KBOB Dokumenttypen, Präzise Namen, Bodenbedeckung-Profil, Schlüssel-Review), each as the project's `postgres` SQL Editor role. The comment review additionally expects the hosted `t-huelle` rename of 2026-09-05 (Gebäudehülle (AO) → Gebäudehülle), which is not part of the scripted chain.
2. For a preview, replace only the **final** `COMMIT;` with `ROLLBACK;`. Run the whole file and inspect the result: profile counts for the first script, current attribute names for the follow-up, counts/new attributes/vocabularies for the synchronization. The preview leaves catalog content and operation markers unchanged.
3. To apply, restore the final `COMMIT;` and run the entire file. If an error leaves a transaction open, execute `ROLLBACK;` before retrying.
4. Reload the catalog. Repeat execution shows current catalog results without repeating the edits. The final result queries also work independently after commit; they do not require temporary tables or change logs.

## Validation

Use the isolated PGlite dependency from the [database guide](../README.md#validation). From the repository root:

```powershell
$env:PGLITE_MODULE = Join-Path $env:TEMP 'oblique-sql-test-tools/node_modules/@electric-sql/pglite'
node prototype-oblique/tests/business-object-profiles.cjs
node prototype-oblique/tests/business-object-labels.cjs
node prototype-oblique/tests/business-object-geometry.cjs
node prototype-oblique/tests/bbl-referenzdaten.cjs
node prototype-oblique/tests/kompakte-kommentare.cjs
node prototype-oblique/tests/dokumentenmanagement.cjs
node prototype-oblique/tests/architektonische-sicht.cjs
node prototype-oblique/tests/dokumente-kuerzung.cjs
node prototype-oblique/tests/cafm-basisplan.cjs
node prototype-oblique/tests/technische-anlage-ebkph.cjs
node prototype-oblique/tests/kommentar-review.cjs
node prototype-oblique/tests/referenzdaten-namen.cjs
node prototype-oblique/tests/iso-laender.cjs
node prototype-oblique/tests/datenprodukte-review.cjs
node prototype-oblique/tests/iso-land-domain.cjs
node prototype-oblique/tests/referenzdaten-bereinigung.cjs
node prototype-oblique/tests/flaechenarten.cjs
node prototype-oblique/tests/crb-kostenelemente.cjs
node prototype-oblique/tests/kbob-dokumenttypen.cjs
node prototype-oblique/tests/praezise-namen.cjs
node prototype-oblique/tests/bodenbedeckung-profil.cjs
node prototype-oblique/tests/schluessel-review.cjs
```

The suites execute the twenty-two scripts against the complete schema/import. They check final Markdown/SQL definitions and property sets, identity reuse, the new object and vocabularies, measurement links, revisions, runtime loading and preserved source scope; the earlier suites verify their own operation results against the current Markdown through the later reviewed overlays. They also verify that change logs remain unchanged, result queries work after commit, previews and failures roll back completely, repeat runs preserve subsequent edits, and stale baselines and identifier collisions are refused. The suites never contact the hosted database.
