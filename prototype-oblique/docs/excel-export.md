# Excel export

Implemented on 2026-09-05. **Excel-Arbeitsmappe exportieren** replaces CSV in all collection and detail menus, including attribute, field, product and API profiles. The result is a real compressed `.xlsx` workbook. PDF actions remain available.

## Contents and scope

| Worksheet | Contents |
|---|---|
| Übersicht | Source view, export time, search filter, selected count, scope and worksheet row counts |
| One sheet per entity kind | IDs, complete names/descriptions, status, version, domain/system, responsible organisation, selection marker and catalog links |
| Attribute | Business-object and product attributes, parent IDs, value types, keys, mandatory flags and positions |
| Felder | All selected table fields, parent table IDs, technical names, types, source links, code-list IDs, GWR access/master-data flags and field-profile links |
| Werte | Code-list values, German/French/Italian/English labels, notes and source version/row; codes remain text |
| Metadaten | Remaining and complete record metadata, flattened by property path, including organisation contacts, provenance, short labels and unknown extension fields |
| Quelldokumentation | Complete imported source sections, one row per field/section |
| Beziehungen | Named relationship groups and links, including targets outside the workbook |
| Verlauf | Recorded history; standalone attributes/fields use their existing inherited object/table history |
| Langtexte (when needed) | Ordered continuation parts for text exceeding Excel's 32,767-character cell limit; original cells point to the complete text |

Optional empty worksheets are omitted. An empty filtered collection still exports its overview and entity-sheet headers.

- **Collections:** select exactly the matching entities, including collapsed groups and all pages. In table mode, retain the current sort within each group.
- **Domains:** include their business objects, tables, code lists, products and APIs.
- **Systems:** include their tables and APIs.
- **Business objects:** include attributes, realising tables/fields and associated code lists/values.
- **Tables:** include all fields and their explicitly referenced code lists/values.
- **Code lists:** include every value, regardless of current page size.
- **Attributes/fields:** export only the selected child and any explicitly linked code list; parent IDs and profile links provide context without exporting sibling fields.
- **Products/APIs:** export metadata, product attributes where present, relationships and history. Relationship targets are links, not an unrestricted recursive catalog export.

Entities/code lists are deduplicated by kind and identifier. Child rows include parent IDs so equal technical field names in different tables remain distinguishable. Domain filters and search terms are recorded in the source URL/overview. Scope is captured before loading the writer, so navigating or changing language while a download is pending cannot silently change its contents. Only catalog metadata is exported, never live register records.

## Implementation

[`js/excel.js`](../js/excel.js) separates the synchronous plain-data export plan, workbook construction and browser download. [`ExcelJS 4.4.0`](https://github.com/exceljs/exceljs/releases/tag/v4.4.0) is vendored under `vendor/exceljs`, with MIT license and a package-integrity/hash notice. Its [documented workbook writer](https://github.com/exceljs/exceljs/tree/v4.4.0#writing-xlsx) handles XLSX packaging. The application does not use spreadsheet import APIs. The writer loads locally once on demand; no runtime CDN, backend, installation or build step is needed.

Worksheets have frozen headers, filters, readable widths, wrapping body text and unwrapped headers. Text aligns left; numeric values and numeric column headers align right. Dates and technical identifiers remain source strings; positions/counts remain numbers. Catalog text is never interpreted as a formula object, and only validated HTTP(S) destinations become active workbook links. Long text is split without discarding content or breaking surrogate pairs. Worksheet names are sanitised, limited to 31 characters and deduplicated case-insensitively. A sheet exceeding Excel's row limit fails rather than silently dropping rows.

The export menu disables repeated Excel requests while a workbook is being prepared. Failure resets the loader/export state and leaves a retryable action. The source data and catalog UI remain usable throughout.

## Verification

- Real GWR workbook round-trip: 7 tables, 146 fields, 48 code lists and 467 values, plus full source documentation, contacts, relationships and history.
- Independent openpyxl read: worksheet counts, numeric/string types, frozen panes, hyperlinks and absence of formula cells.
- Formula-like text, leading zeros, quotes, umlauts, multiline text and oversized Unicode source text are preserved.
- Browser downloads cover filtered/grouped lists, domain scopes, later pages, mobile profiles, empty results, load failure/retry and navigation during loading.
- Existing core, functional, GWR, field and responsive suites pass, including 150 layouts and 7,680 profile combinations. See [tests/README.md](../tests/README.md).
