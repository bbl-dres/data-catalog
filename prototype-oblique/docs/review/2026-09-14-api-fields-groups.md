# API fields and property groups — 14 September 2026

API profiles now have an independent **Felder** tab. An API can have no documented fields, a subset of a table, or a completely different schema. Fields have their own metadata and ordering. A relation to a table field is optional.

**Gruppe** is optional text on Geschäftsobjekt attributes, Datentabelle fields and API fields. It appears by default in their tables and can be hidden in **Ansicht**. Existing visibility preferences gain the column once; later hiding is preserved. Groups are editable, searchable, sortable and included in Excel/PDF exports.

## Source review and decision

The six screenshots and the Confluence MHTML in `D:\SAP RE-FX` demonstrate different grouping contexts: the API structures BUILDING and OBJECT_ADDRESS, and SAP structures REBDBUFLDS and REBPADDRESSFLDS. The SAP screenshots explicitly identify the latter as structures; they do not establish that these are physical database tables. A flexible label accommodates these cases and business property sets without introducing a group registry.

The hosted catalog had seven APIs, no field-to-field correspondences, and 66 candidate exposes links from the SAP building API to existing table-owned fields. Those assertions do not justify copying or moving an inventory. All existing field records, relationships and comments remain unchanged. API inventories start empty; group values start null.

## Storage and editing

The existing `data_field` table stores separate field records with exactly one owner: `data_table_id` or `data_service_id`. Both references are immutable. API-owned fields use `technical_name_kind = apiField` and optional `data_type_scope = serviceSchema`. The existing `correspondsTo` relationship can connect distinct fields; no correspondence is created automatically.

API edit mode has separate **Felder** and **Endpunkte** tabs, with independent row order, archive/restore and an atomic save under the API revision. Field changes appear in the owning API's history. API field children use `table: "data_field"`; older clients without the discriminator continue to edit endpoints.

API fields are edited within their API, without a standalone field-profile route or a new relation editor in this revision. Excel has a separate API-fields sheet and retains endpoints. API model PDFs list fields and default to landscape to accommodate the API and field columns. Explicit paper/orientation choices remain available.

## Hosted deployment

Applied through Supabase MCP to project `zicluerzbevodlmtbxow`:

| Local migration | Hosted version |
| --- | --- |
| [catalog_api_fields](../../supabase/migrations/20260914000000_catalog_api_fields.sql) | `20260914101146` |
| [catalog_property_groups](../../supabase/migrations/20260914010000_catalog_property_groups.sql) | `20260914101153` |

Readback verified **19 catalog tables / 481 columns**, both capability flags, both owner/scope constraints, RLS on all tables, and denied direct writes for anon, authenticated and service_role. The unauthenticated capability response correctly has `can_edit: false`.

Before/after counts and content hashes match for **all 19 public snapshot collections**, excluding only the newly added nullable columns. This includes all 621 table fields, 295 business attributes, 121 relationships and 1,864 history events. There are zero API-owned fields and zero assigned groups after deployment. [Machine-readable verification](2026-09-14-api-fields-groups/verification.json).

Frontend changes are local in the working tree; they have not been committed, pushed or published by this task. No catalog data was imported from the SAP examples.

## Validation

- `api-fields.cjs`: independent owners, no inferred copies, optional correspondences, browser/REST SQL commands, cross-owner denial, immutable identities, retries/revisions/history, group validation/clearing, projection/search, visibility and Excel/PDF source content.
- `api-fields-browser.cjs`: real editor saves against isolated SQL, separate fields/endpoints, all three group owners, show/hide/reset/reload, reorder/archive/restore, DE/FR/IT/EN, desktop/mobile, populated PDF preview and download.
- `core.test.cjs`: 51 checks, including one-time column preference migration.
- `catalog-schema.cjs`, `model-aliases.cjs`, `api-contract.cjs`: schema, canonical model, aliases, actual XLSX headers and generated OpenAPI agree on all 481 columns.
- `editing-sql.cjs`, `editing.cjs`, `rest-crud.cjs`, `session-security.cjs`, `catalog-table-grants.cjs`, `table-order.cjs`, `row-order.cjs`: existing editing, authorization and ordering regressions pass.
- `print-review.cjs`: filter/empty/error recovery, scope, columns, cancellation, product references, API field content, actual download and 64 section layout combinations pass. The unmatched-filter case uses a larger page so column-width validation cannot mask the filter assertion.

Browser checks use a local server and intercepted Supabase requests; test records never reach the hosted database.

Screenshots with synthetic API fields: [desktop](2026-09-14-api-fields-groups/apis-1440.png), [mobile](2026-09-14-api-fields-groups/apis-390.png).
