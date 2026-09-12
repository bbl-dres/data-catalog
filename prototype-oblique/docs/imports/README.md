# Imports and source evidence

These guides describe the current source-specific imports. The [catalog model](../data-model.md) is a separate proposal for a future migration; running an importer does not implement that model.

| Source | Guide | Preserved evidence |
|---|---|---|
| GWR | [Import and definitions](gwr-import.md) | [Report](../sources/gwr/gwr-import-report.json), including input hashes and field/code coverage. |
| SAP RE-FX | [Reconciliation](sap-refx-reconciliation.md), [reviewed scope and open questions](sap-refx-catalog-scope.md) | [Source inventory](../sources/sap-refx/), reviewed definitions, mapping candidates, owner-approved exclusions and import report. |
| GIS IMMO | [Workbook import](gis-immo-import.md) | [Report](../sources/gis-immo/gis-immo-import-report.json), original rows, name collisions and replaced sample records. |
| Amtliche Vermessung | [Model and services](av-import.md) | [Model/service captures](../sources/av/), hashes, bounded service checks and import report. |

## Tools and verification

Python tools live in [scripts](../../scripts/); commands in each guide run from the repository root. GWR needs `beautifulsoup4` and `openpyxl`; GIS IMMO needs `openpyxl`; SAP RE-FX requirements are described in its guide. AV uses Python's standard library and the checked-in source captures. Original owner-supplied spreadsheets, MHTML, API documentation and diagram images remain outside the repository; their paths are examples, not portable defaults.

Review the source, curation rules and proposed diff before accepting a refreshed import. Reports preserve original records and unresolved mappings; they are maintenance evidence, not disposable test output. Do not infer missing technical IDs, keys, types, requiredness or API coverage from matching labels. Keep raw AV captures byte-for-byte intact because validation checks their hashes.

Use [the test guide](../../tests/README.md) for core integrity checks and source-specific browser/export checks. The obsolete fictional-data generator has been removed: curated `data/` files and these scoped importers are the maintained inputs.

## Catalog curation

The owner deliberately removed these sample records. Imports or later migrations must not silently restore them:

- Code lists: `r-geak` (GEAK Effizienzklasse), `r-geschoss` (Geschosstyp), `r-raum` (Raumtyp), `r-sia-nutz` (SIA Nutzungsart).
- APIs: `api-geo` (Geo-API Bundesimmobilien), `api-immo` (Immobilien-API), `api-opendata` (Open-Data-Schnittstelle). Their product links and history entries were removed without guessing replacement endpoints.
- SAP exclusions and consolidations are recorded separately in [catalog curation](../sources/sap-refx/sap-refx-catalog-curation.json). Preserve the distinction between documented source inventories and unverified diagram/API correspondences.

Position is omitted from attribute/field overviews but remains available as source ordering and in Excel. Field overviews omit source status, object types, GWR access category, GWR master-data classification and source snapshot; table overviews omit source snapshot and definition source. Field profiles have no separate source-documentation section. Underlying source evidence is retained in JSON and exports.

Shared empty facts, comments, responsibility roles and further-information rows remain visible as **—**; unknown booleans stay unknown and empty URLs do not become links. This does not mean every optional source-specific row is rendered: see the [model implementation and migration requirements](../data-model-implementation.md#current-prototype-differences) before changing that behavior.

GWR definitions retain their official-source release status; other current catalog definitions remain drafts. Imported source LIVE/DEV or similar status is independent of catalog approval. Evidence that a field exists in one source does not establish its availability through another interface or define a solution-neutral business requirement.

## Project domain

The `projekt` domain contains four draft business objects: `bauprojekt`, `meilenstein`, `phase` and `bauarbeiten`. Bauprojekt and Bauarbeiten use the selected GWR definitions; milestone/phase descriptions and the conceptual attributes are local catalog content. The GWR tables `t-gwr-bauprojekt` and `t-gwr-arbeiten` realize the corresponding business objects; their associated code lists follow this domain. Source identifiers and definitions remain unchanged.

The current GIS project table comes from its workbook import. Older sample fields are preserved only in its import report. Do not recreate them from historical project notes or infer object relationships from similar field names.
