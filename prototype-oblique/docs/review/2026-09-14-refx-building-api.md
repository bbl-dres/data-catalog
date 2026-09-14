# RE-FX Building API inventory — 14 September 2026

Added **378 independent API fields across 26 groups** to **SAP RE-FX – Gebäudestammdaten lesen** in Supabase project `zicluerzbevodlmtbxow`. These are 377 service-structure fields in 25 groups plus the separately documented BUILDING_ID input parameter in **Eingabeparameter**. BUILDING (66) and OBJECT_ADDRESS (17) lead; the other service groups follow their documentation order.

## Source and interpretation

Source: the user-provided `D:\SAP RE-FX\Building Master Data - Get Detail - SAP API Dokumentation Bund - Confluence.mhtml`, SHA-256 `4d3a9f871da5339dfb518f9fb9c0ffb9de44d9dfebd61c4cb75f1d4884795358`. The archive has no MIME charset; extraction uses its embedded UTF-8 HTML declaration. No replacement characters were accepted.

The [reviewed inventory](../sources/sap-refx/2026-09-14-building-api-fields.json) preserves each source row, group, description, declaration, length and document anchor. [Extraction script](../../scripts/extract-refx-building-api.py) reproduces it and refuses a different source hash.

- Seven `.INCLUDE` rows are retained as evidence but excluded as SAP structure markers.
- Group labels are the documented service-node names, not inferred physical SAP table IDs.
- Field paths preserve the documented group/field position; they are not a claim of verified WSDL paths or array cardinality.
- BUILDING and PROP_TAX have visibly inconsistent type/length declarations. All **82** field types in these groups remain unknown; raw declarations are retained in notes/evidence. No guessed corrections were substituted.
- PROP_TAX descriptions after OBJECT_TYPE/OBJECT_ID are mismatched or absent. Those fields use their technical names as labels, with the disputed original description retained in notes where present.
- The illustrative BUILDING response uses names absent from the detailed structure inventory. Those example-only variants were not added as verified structure fields.
- The input parameter has the documented String type and required flag. Other required flags and all nullability remain unknown.
- Every imported field is **draft**. No code lists, key roles, table-field relations or business mappings were inferred.

## Audited import and preservation

The [import generator](../../scripts/refx-building-api-import.cjs) submits one guarded `catalog.save_entry` command, with 378 field children, against API revision 3. It pins the complete before-snapshot hash, checks the empty API inventory, validates every resulting field, and verifies all unaffected records and prior events. The existing permanent editor's active session provides audit attribution through the authorized administrative MCP operation; no token was read/minted and no Auth record was created.

The rollback preview succeeded; an independent query confirmed the original snapshot hash and zero persisted API fields. The identical command payload then committed. API revision became **4**, with **378 new field history events**. All **621 existing table fields**, **121 relationships**, **295 business attributes**, seven endpoints and **1,864 previous events** were preserved. The API metadata is unchanged apart from revision/edit timestamps. The postflight full-snapshot hash matches the committed verification.

[Machine-readable verification](2026-09-14-refx-building-api/verification.json).

## Compatibility and frontend verification

A final deployment check found that the public demo's older loader assumes every field has a table owner. Migration [catalog_snapshot_api_fields](../../supabase/migrations/20260914020000_catalog_snapshot_api_fields.sql), applied as **20260914124500**, adds an explicit snapshot opt-in without changing stored data or write permissions:

- `read_snapshot()` / empty POST body retains the legacy table-field inventory and omits dependent assertions/history that would reference excluded API fields.
- `read_snapshot(true)` / POST `{"include_api_fields":true}` returns the complete inventory, including all API fields. The updated bootstrap and catalog reload request this form.
- Direct table reads retain the complete records. Both snapshot forms are public, stable and run under the caller's RLS permissions.

The complete snapshot hash was unchanged by this migration. The **older public demo was verified working** with 30 tables, 7 APIs and 621 table fields. The **local updated frontend using live Supabase data** displays 378 API fields, default-visible groups and correct group searches. Desktop/mobile checks and the 28-page PDF layout retain all 378 rows. Frontend changes remain local; no commit, push or website publication was performed.

Tests: `refx-building-api-import.cjs` (rollback, stale/repeat refusal, exact content, preservation, audit, projection and Excel), `refx-building-api-browser.cjs` (isolated and live read), `api-fields.cjs` (including legacy dependent-reference filtering), resources, catalog schema, generated API contract and canonical aliases passed.

Screenshots from the local frontend with live data: [desktop](2026-09-14-refx-building-api/desktop.png), [mobile](2026-09-14-refx-building-api/mobile.png).
