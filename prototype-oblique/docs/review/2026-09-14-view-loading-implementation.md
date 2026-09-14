# View-based loading: implementation and verification

Implements phases 1–3 of [the proposal](2026-09-14-view-based-loading.md). Server search and paging remain deferred until the index exceeds about 3 MB or its read exceeds 0.3 seconds.

## Delivered

- [Migration](../../supabase/migrations/20260914040000_catalog_view_loading.sql): a public, read-only CatalogState singleton, a transactional revision bump in the existing write-serialization trigger, and STABLE SECURITY INVOKER `read_catalog_index` / `read_record` RPCs. No Auth, role or timeout settings change.
- The index contains full parents, endpoints, quality rules, structural relationships without evidence, and counts of visible children including inherited attributes. It contains no attribute, field, value or history rows.
- A bundle contains full owned rows (including archived rows for restoration), inherited attributes with defining-owner IDs, full relationship/lineage evidence, quality assignments and minimal counterpart children. The client resolves represented attributes and field links without loading another owner.
- Profile loading/error/retry states, owner reuse for child deep links, hover/focus prefetch, and a generation guard against late responses. Newer bundle revisions refresh the index; inconsistent reads are retried before publication.
- Conditional Cache API storage for public index/bundle responses, partitioned by project and owner, with a 64-response limit. Cached values are revalidated using exact decimal-text revisions. Unavailable storage uses the ordinary network path.
- Editor startup loads its owner. Saving refreshes the index and edited owner and discards other in-memory bundles. Selection Excel uses loaded owner rows; catalog Excel reads a full snapshot under a progress indicator and uses a temporary projection. PDF row layouts load the selected scope with at most four concurrent owner requests and reject a revision change during capture.
- Generated OpenAPI, canonical schema inventory (20 tables / 483 columns), API/architecture guides and fixture transport mocks updated.

## Compatibility decisions

The existing `read_snapshot()` and `read_history()` response shapes remain unchanged. Version envelopes apply to the two new reads; history retains its array shape, including empty results. `read_snapshot(true,false)` remains the full-catalog export path. A missing index RPC (`PGRST202`) falls back to the older snapshot reads during rollout. Offline JSON and complete-snapshot fixture projection remain supported.

The proposal assumed profile-only PDF exports. The existing print workspace can expand to a collection or another kind, so it additionally loads that scope's rows before showing a row layout. It does not require a full catalog snapshot.

## Local evidence

These measurements use the repository fixture, not hosted production data:

| Check | Result |
|---|---:|
| Full snapshot without history | 1,426,915 bytes |
| Initial index | 196,813 bytes |
| Startup reduction | 86.2% |
| Unchanged browser index response | 59 bytes |
| Profile inventories, counts, evidence and relation views compared with full projection | 141 owners, all equal |
| Added API-field growth test | 1,100 fields; startup grows by less than 100 bytes |
| Returned growth-test bundle | All 1,100 fields; no table endpoint row-limit truncation |

Passing checks include the new `view-loading.cjs` and `view-loading-browser.cjs` suites, resource/cache behavior, 51 core checks, canonical schema/model aliases, generated API contract and JSON Schema validation, migration/RLS/security/session suites, SQL/REST editing, independent API fields/groups, inheritance/mappings, browser editor/API/history/catalog flows, loading/Auth/security, row ordering, system-of-record, access options and print menus/review. Browser tests use headless Edge and intercept hosted requests; writes run only in isolated PGlite databases.

## Hosted rollout

Read-only MCP inspection confirmed project `zicluerzbevodlmtbxow`, the existing 19-table / 481-column baseline, the expected write-serialization function, and no existing `catalog_view_loading` migration, version table or new read RPCs. The latest recorded migration is `20260914150059_catalog_snapshot_history`.

The new migration is prepared but has not been applied to the hosted project. Apply it once through the Supabase MCP with its outer `BEGIN` / `COMMIT` removed, retaining `NOTIFY pgrst, 'reload schema'`. Verify the two RPC signatures, version-table read-only grants, versioned index/profile responses, conditional `notModified` responses, the legacy snapshot/history contracts and unchanged content. Then release the frontend assets. No commits or pushes were made during this implementation.
