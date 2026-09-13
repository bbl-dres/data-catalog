# Excel review export

Implemented from the [Excel layout study](wireframes/2026-09-06-excel-layout.html), with the [canonical data model](data-model.md) governing field meaning. The workbook is for reading, filtering and collecting feedback. It contains catalog definitions, not operational building records. Feedback remains in the workbook; there is no Excel import or approval workflow.

## Scope

| Entry point | This view |
|---|---|
| Collection, including a domain's collection tab | Overview and the listed kind; all filtered entries in the current order, across pages and collapsed groups |
| Domain profile overview | Domain, its business objects and profile relationships; no attribute expansion |
| System profile | System, its tables and profile relationships; no field expansion |
| Business-object profile | Object, its attributes and profile relationships |
| Attribute / field profile | That row, parent context in columns and profile relationships |
| Data-table profile | Table, its fields and profile relationships |
| Reference-list profile | List, its values and profile relationships |
| Data-product profile | Product, its attributes and profile relationships |
| API profile | API, its documented endpoints and profile relationships |

An Overview sheet leads every workbook. Empty dependent sheets are omitted; an empty filtered collection retains its column headers. Profile exports include all saved child rows regardless of a child filter or page. They follow the profile's selected column sort, when present. Neighbouring tables, code lists and other linked entries are not expanded.

Entire catalog ignores the originating view. It exports all browsable top-level entries, their owned rows and profile relationships. Top-level entries are alphabetical in the export language; child rows use their saved sequence. Archived records excluded from normal browsing remain excluded. Status alone is not archival.

An **Access options / Bereitstellungsformen** sheet accompanies exported tables, products or APIs that have authored, unarchived access entries. It follows their saved list order and contains hidden owner/item UUIDs, readable owner identity/name, the display title and all four stored title languages, format, status, access/download URLs, instructions, terms, comment and feedback. It does not synthesize entries from product formats or endpoint URLs; endpoints remain on their existing sheet. See [AccessOption](data-model.md#accessoption).

## Fields and formatting

Technical keys occupy row 1 and translated labels row 2. English/German labels follow the [canonical alias contract](data-model.md#alias-contract-across-surfaces). Name columns use Name; language suffixes remain on parallel stored translations. Reference context uses the referenced property alias, and derived relationship/feedback labels are defined in the canonical document. Keys, column order and widths stay identical across languages and scopes. Column blocks are context, identity/order, responsibility, content, status/dates and feedback. The source-link column is part of content. Headers and identifying columns are frozen. Filters start on row 2. UUID columns used for identity and context are initially hidden to keep the visible sheet readable; users can unhide them.

| Key / family | Meaning |
|---|---|
| `id`, `identifier` | Stored catalog UUID and stable public identifier. Legacy fixtures without a UUID leave `id` blank. Neither is derived from a worksheet row number. |
| `sortOrder` | Exact stored `sort_order` on owned rows, including zero. Blank means no saved rank was available, not an alphabetical-order instruction. The [ordering contract](data-model.md#row-order) governs defaults, ties and editing. |
| `domainId` / `domainName`, `systemId` / `systemName` | Context references and readable names. System here is the technical system. |
| `businessObjectId`, `dataProductId`, `dataTableId`, `codeListId`, `dataServiceId` and corresponding `Name` columns | Owning context where applicable. Attributes from objects and products share the Attribute sheet, with distinct parent columns. Legacy fixtures use their stable owner identifier where a UUID is unavailable. |
| `name`, `description`, `comment` | Display-language text with the catalog's normal fallback, and the entry's own comment. Field labels are separate from `technicalName`. |
| `responsibleOrganisationName`, `dataOwnerName`, `dataStewardName`, `dataCustodianName` | Readable responsibility context. Actor UUIDs accompany the role names; applicable parent and custodian fallback follows the catalog. Reference values inherit their list's authority. |
| `systemOfRecordId` | Stored UUID designation. An inherited attribute keeps this cell blank. |
| `effectiveSystemOfRecordId`, `systemOfRecordName`, `systemOfRecordInherited` | Resolved designation and its origin; separate from the stored override. |
| `valueType`, `unit`, `sourceDataType`, `keyRole` / `keyRoles` | Review columns mapped from value specification, documented source type and the current key-role projection. A key label does not create a business-key constraint. |
| `required`, `isRequired`, `isNullable` | Current required/nullable projection. Unknown remains blank; false remains No. Detailed quality-rule assignments remain in the API. |
| `version`, `serviceVersion`, `createdOn` | Definition version, separately recorded interface release, and the creation date at its actual precision. Values/products' attribute versions are parent context. No timestamp is invented from a date. |
| `name_de`, `name_fr`, `name_it`, `name_en` on Values | Stored code labels side by side. Codes remain text, including leading zeros. |
| `documentationLinks` | Documented URLs joined with semicolons. A single safe URL is clickable. |
| Relationship columns | Typed source/target identity, readable association and context. These are profile associations, including derived ownership links, not a dump of the physical Relationship table. Relationships cover exported entries that have their own profiles, including business attributes and fields. Targets may lie outside the workbook. |
| `remark` | Empty feedback field; distinct from the existing catalog comment. |

Numbers retain numeric cell types. Booleans use translated Yes/No labels. Dates retain ISO date text; unknown values are empty. Strings, including formula-like text, are literal cells. Safe HTTP(S) hyperlinks are created only for link columns. Column labels and content follow the selected language; no catalog values are rewritten during export.

## Completeness and limits

The review workbook deliberately omits audit history, flattened metadata, imported source-document sections, unused language variants outside Values and Access options, detailed quality assignments and private operational data. History and canonical records remain in the catalog/API; imported source payloads remain in the retained archives. It is not a database backup or a full canonical-schema serialization. The Overview states this boundary.

Long exported values are never silently truncated. If a value exceeds Excel's cell limit, a readable excerpt points to a continuation sheet holding every part, the source sheet, row and technical column key. This sheet appears only when needed. Worksheet names are sanitized and deduplicated. Files are named `datenkatalog_<scope>_<YYYY-MM-DD>.xlsx` using the UTC export date.

Future property sets will add explicit group membership and group order columns once that structured model exists. Current comment markers are not interpreted as structured groups by the export.

## Implementation and verification

[excel.js](../js/excel.js) captures a plain-data plan before loading the pinned local ExcelJS writer. Pending exports survive route/language changes and use only the last saved snapshot. The menu prevents duplicate downloads; failed writer loads can be retried.

The core and Excel browser suites check scope, stable schemas, literal strings, leading zeros, long-text reconstruction, filters, frozen panes, mobile downloads and asynchronous snapshot behavior. [row-order.cjs](../tests/row-order.cjs) verifies real SQL ranks through an XLSX write/read round trip; [row-order-browser.cjs](../tests/row-order-browser.cjs) covers edit movement and restoration of saved view order. All write tests use isolated data.
