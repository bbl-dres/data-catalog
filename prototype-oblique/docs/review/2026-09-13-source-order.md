# Table and field ordering — completed, 13 September 2026

Applied saved ordering to all **30 Datentabellen and 621 Felder** in Supabase project **zicluerzbevodlmtbxow (Data Catalog)**. Further naming candidates were explicitly skipped; no source names or definitions were changed.

## Saved order

Tables follow a logical order within each system, in steps of 100: core spatial/master tables before their dependent tables, measurements and services. Fields use spaced subject ranges, with steps of 10. The three fields with explicitly declared key roles across the inventory were reviewed: the two primary keys in Bemessungen lead at 100/110; the third declared key role is a foreign key. Other identifiable source keys lead their tables without inventing PK/FK metadata.

| System | Tables | Fields |
| --- | ---: | ---: |
| Amtliche Vermessung | 8 | 49 |
| GIS IMMO | 7 | 275 |
| GWR | 7 | 146 |
| SAP RE-FX | 8 | 151 |
| Total | 30 | 621 |

Identifiers start at 1000, references at 2000, labels at 3000, classifications at 4000 and addresses at 5000. Geometry, lifecycle, ownership, operations, portfolio, measurements, provenance, validity and audit fields follow in separate ranges. Address order is country → region → town → postcode → street → house number where these source fields exist. Validity dates stay paired; measurement values and their supporting information stay together. Shared GIS fields keep consistent ranks across tables. These are presentation numbers, not new property-set metadata or business-key assertions. The [complete plan](2026-09-13-source-order/source-order-plan.json) records every assignment.

## Schema and deployment

DataField already had sort_order, but all 621 values were zero. DataTable had no saved order. Migration [20260913070000_catalog_table_order.sql](../../supabase/migrations/20260913070000_catalog_table_order.sql) adds one nonnegative integer column with default 0, a canonical comment and the existing browser/REST write allowlists. Applied through Supabase MCP as **20260913190314 / catalog_table_order**. The deployed and local schemas now contain **19 catalog tables / 478 columns**.

The migration preserved all existing records and revisions. It does not grant direct table writes, change RLS or touch Auth settings. Public snapshot reads remain available; anonymous writes remain denied. Subsequent content edits used catalog.api_write under the authorized permanent editor's existing active session context, with no token read or minted.

All **651 updates** were previewed atomically with rollback, then the full snapshot hash was checked before committing the identical commands. The commit was independently read back. All 2,757 other records, all quality assignments, prior history, source definitions and key roles were unchanged. Table/field revisions and parent revision increments were verified exactly. Each update has one history event and private command/actor receipt: **651 new events**, **1,864 total** at verification. No hard deletion or reimport.

## Browser and API behavior

DataTable lists, system profile tables and Felder lists default to sortOrder ascending even while the rank column is hidden. Explicit name/other sorts remain available. A fresh localhost RE-FX Gebäude field route with no sort parameter automatically selected sortOrder:asc and began with COMP_CODE, BUSINESS_ENTITY and BUILDING at 1000, 1010 and 1020.

For Attribute and Felder, **Zeilenreihenfolge is the first Ansicht choice and the first table column when selected**. Both use the same relative order: name, technical name where available, description, type, key, required/nullability, value list/unit, standards/source system, responsibility, version, then Status last. Existing visibility defaults are retained, including separate alias and technical-name columns for Felder. Rank remains optional. This was checked in both live localhost tables, and the original visibility settings were restored afterwards.

Table ordering is editable as a number in the existing profile editor and through the guarded APIs; Excel exports include the saved numeric value. New tables default to 0 unless given an explicit rank. The established append/move behavior for owned rows remains unchanged and can compact their spaced ranks when manually reordering.

## Verification and limits

- All 30 tables and all 621 fields match the plan in the actual frontend projection; unique field ranks and declared primary-key positions verified.
- Local table-order tests cover guarded browser/REST writes, integer validation, stale revisions, retries, no-op history, denied direct writes, editor values, exports, default sorts and matching dropdown/column order.
- Canonical schema (148 checks), grant-repair regression, API contract, all 478 SQL/API aliases, child row-order regression and 50 core tests passed. Generated contracts and aliases checked.
- Localhost browser checks verified fresh default sorting and rank-first controls/columns for Felder and Attribute. No extra live browser save was necessary: all content edits were verified through the same audited SQL boundary; editor save validation was tested against isolated SQL.

The frontend changes are local and **not committed or pushed**. The database changes are already applied. Existing uncommitted repository work was preserved. The separate catalog-api Edge Function deployment remains outside this task.

Evidence: [plan, exact before/update manifest, migration/security receipts and verification summaries](2026-09-13-source-order/).
