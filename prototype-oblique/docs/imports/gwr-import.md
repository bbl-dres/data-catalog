# GWR catalog import

Imported on 2026-09-05 from the user-provided `Merkmalskatalog.mhtml` and `gwr codes.xlsx`. The [source page](https://www.housing-stat.ch/catalog/de/5.0/revised) identifies itself as version **5.0.0**. The saved page is the revised variant; its commented-out effective date is not treated as evidence of publication or approval.

## Content

GWR is a source system under **Datentabellen → GWR** (`#/systems/gwr`). The seven catalog entities are represented as logical data tables:

| Table | Fields | Prototype domain | Existing business object |
|---|---:|---|---|
| Bauprojekt | 37 | Projekt Management | Bauprojekt |
| Arbeiten | 10 | Projekt Management | Bauarbeiten |
| Gebäude | 39 | Architektonische Sicht | Gebäude |
| Wärmeerzeugungsanlage | 17 | Energie | Unmapped |
| Gebäudeeingang | 9 | Architektonische Sicht | Unmapped |
| Wohnung | 24 | Mieter Management | Wohnung |
| Strasse | 10 | Architektonische Sicht | Unmapped |
| **Total** | **146** | | |

The `GWR_*` technical names are local catalog aliases, not claimed physical database table names. The domain and business-object mappings are prototype decisions. No business objects are fabricated to fill the unmapped cases; the source domain remains available independently. Described entities without their own feature section, such as Erhebungsstelle and Strassenabschnitt, are not imported as empty invented schemas.

Entity descriptions copy the exact definition paragraphs from **Beschreibung der Entitäten**, rather than summarising the field sections. For Arbeiten and Wärmeerzeugungsanlage, which lack a short boxed definition, the original explanatory paragraphs are used (both scope paragraphs for the latter). Whitespace is normalised and paragraph boundaries are retained; visible source spelling, including `jeg¬licher` in the building definition, is preserved. The table's Quelldokument link opens the exact definition anchor; `fieldsSourceUrl` separately identifies its feature section. The import validates unique paragraph matches so future source changes cannot silently select a different passage.

All 146 documented features retain their source code, German label, short description, coding, source URL and the additional source metadata (access category, master-data designation, technical specifications, reporting obligation, quality rules and other available rows) in `fields[].catalogMetadata`. Soft hyphens and redundant whitespace are normalised; MHTML bytes are explicitly decoded as UTF-8. The UI uses concise logical types derived from the documented coding. Full coding remains in the JSON. Physical SQL types and PK/FK constraints are not asserted; the source's composite identifier qualifications for EDID/EWID remain in the metadata.

## Code lists and version reconciliation

The workbook contains **817 rows**, covering 63 feature names and versions 3.7, 4.2 and shared 3.7/4.2 entries. It is not a 5.0 export.

- Imported **48 relevant code lists with 467 values**. The saved 5.0 catalog's inline codes and explicit Boolean coding take precedence.
- Workbook enrichment selects only rows labelled 4.2 or 3.7/4.2. For enumerated 5.0 codes, translations and short labels are retained only when both the code and normalised German label match. No French or Italian translations are invented. The application continues to display German catalog data.
- **Stockwerk (WSTWK): 119 values.** The spreadsheet's 4.2 code set exactly matches the 5.0 ranges: 3100, 3101–3199 and 3401–3419. The import verifies complete set equality before using the spreadsheet's individual labels. The source mix is visible under Quellenstand. This provides three real pages at the default 50 rows.
- **Gebäudeklasse (GKLAS)** is supplied from the workbook as version **4.2**, with an explicit description that compatibility with 5.0 has not been confirmed. Its 5.0 field section supplies a numeric format but no enumerated codes.
- Features outside the saved 5.0 catalog, including former heating fields such as GWAERZH1 and GENH1, are not connected to new 5.0 features by guesswork. Their names and row counts are recorded in the report.
- Existing `r-gwr-kat` and `r-gwr-status` IDs are updated in place to preserve bookmarks. This corrects fictional category labels such as `1010 = Einfamilienhaus`; the source defines `1010 = Provisorische Unterkunft`. Other pre-existing examples remain separate.

`fields[].codeList` provides an explicit reference. A Werteliste column appears in tables that have these references; its links open the reference profile. Relationship diagrams and list views follow these links in both directions. GWR's system diagram includes its seven tables and all four mapped domains.

The [Projekt Management domain](README.md#project-domain) adds draft business objects for Bauprojekt and Bauarbeiten. The latter maps to the source entity named **Arbeiten**; the imported table's name, field IDs and source definition remain unchanged. Their 15 code lists follow the new domain and business-object assignments. These are local catalog mappings, not changes to GWR's official metadata or release status.

Field names and rows now open individual profiles, for example `#/tables/t-gwr-gebaeude/fields/EGID`. Fields store the source code in `technicalName` and the exact German label in `labels.de`; the profile displays both in Kerndaten. Supplied translations follow the selected language, with German as the fallback. The field-level source link and code-list links remain available. Full source documentation stays in JSON and Excel without a separate section on the page. Parent-table breadcrumbs, relationships and inherited table history follow the same patterns as business-object attribute profiles. See the [field migration mapping](../data-model-implementation.md#tablesfields) for current identifiers and parent context.

## Provenance and limits

**Responsibility and contact:** the system, seven tables, their derived field profiles and 48 imported code lists show **Bundesamt für Statistik (BFS)** under Verantwortlich. The organisation links to the [official GWR portal](https://www.housing-stat.ch/de/home.html). The shared email `housing-stat@bfs.admin.ch` and hotline `0800 866 600` were verified on 2026-09-05 against the [official portal's contact panel](https://www.regbl.admin.ch/de/search.html). These contact details are curated portal metadata in the importer, separate from the saved catalog and workbook; named owner/steward roles remain unspecified. Future imports retain the contact details without accessing the network.

At the user's direction, the official GWR system, table and reference imports are **Gültig**; all remaining prototype records are **Entwurf**. This does not remove the explicitly documented 4.2 source version of GKLAS. The old GWR-named example Heizungsart is still a draft, since it was not verified by this import. Dates describe this prototype's import, not changes in the live register. BFS is recorded as the responsible organisation; staff names, database technology, register access classification and personal-data assessments are left unspecified. Public code definitions are distinguished from access to register records; each field's A/B/C category is preserved from the source without translating it into a whole-table classification. No live register records are imported.

Source file SHA-256 hashes, capture date, per-table field coverage, source choices, excluded old codes and summary counts are in [gwr-import-report.json](../sources/gwr/gwr-import-report.json). Original MHTML and Excel files remain outside the repository.

## Reproduce

The importer uses Python with `beautifulsoup4` and `openpyxl` (development tools only):

```powershell
python prototype-oblique/scripts/import-gwr.py --catalog "C:\Users\david\Downloads\Merkmalskatalog.mhtml" --codes "C:\Users\david\Downloads\gwr codes.xlsx"
```

[import-gwr.py](../../scripts/import-gwr.py) validates the expected 5.0 field coverage and duplicate codes before writing. Repeated runs with these inputs upsert the same IDs and import-history entries. `--output` and `--report` allow generating a separate review copy. The obsolete sample generator is removed. Preserve curated records and review import diffs against the source evidence.

## Verification

Core checks cover field counts, exact building-definition text, statuses, UTF-8 integrity, unique codes, resolvable references, domain membership, both relationship directions, old-version exclusions and the absence of invented metadata. Browser checks exercise the new system/tree, all seven field lists on desktop and phone, code-list navigation, floor-list paging/sorting/export and relationship diagrams. The long Wärmeerzeugungsanlage name exposed a breadcrumb overflow at 320 px; breadcrumb items now fit their available width. The Übersicht tree link has no count, while section and entity counts remain. See [tests/README.md](../../tests/README.md).
