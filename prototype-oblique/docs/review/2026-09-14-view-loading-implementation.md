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

Applied to Data Catalog (`zicluerzbevodlmtbxow`) through the Supabase MCP after explicit user approval. `list_migrations` records **`20260914153224_catalog_view_loading`**, applied on 14 September 2026 at 15:32:24 UTC. Preflight found no migration of that name, no version table and neither new RPC. The tested file's SHA-256 was `9DD176516E263AA41D33D3FBBF5BA1003B6195D042A295DB7AF2D80AABA6535E`; only its outer `BEGIN` / `COMMIT` lines were removed for the tool, retaining `NOTIFY pgrst, 'reload schema'`. No extra schema reload was needed.

SQL verification confirmed:

- 20 catalog tables / 483 columns; one `catalog_state` row with `singleton=true`, `version=1`.
- `read_catalog_index(if_version text)` and `read_record(record_table text, record_id uuid, if_version text)` exist as STABLE SECURITY INVOKER functions.
- Both `read_snapshot` overloads and `read_history(record_table text, record_id uuid, max_events integer)` remain present; the history index exists, the no-history snapshot omits `change_event`, and the building history returns 70 events.
- `anon`, `authenticated` and `service_role` have SELECT only on the version table. Their role settings remain respectively `statement_timeout=3s`, `statement_timeout=8s` and no role settings. No Auth or timeout configuration changed.
- Before and after all verification, `md5(catalog.read_snapshot(true,true)::text)` was **`7bf5b7ae3500a0fe6df2fee8977409c7`**. Catalog content is preserved; hosted verification performed no test writes.

Public POST requests used the publishable key from `js/catalog-config.js`, `Content-Profile: catalog` and JSON bodies:

| Read | HTTP | Response bytes | Verified content |
|---|---:|---:|---|
| `read_catalog_index {}` | 200 | 286,453 | Version `"1"`; no child or history arrays |
| Index with `if_version: "1"` | 200 | 64 | `notModified: true` |
| RE-FX building table bundle | 200 | 409,865 | 205 owned fields, 150 active, 11 groups |
| RE-FX building API bundle | 200 | 637,915 | 378 owned fields, 26 groups |
| Each bundle with `if_version: "1"` | 200 | 64 each | `notModified: true` |
| `read_snapshot` with API fields, without history | 200 | 3,670,182 | 1,138 fields; no `change_event` |
| Legacy `read_snapshot {}` | 500, then 200 on retry | 8,996,808 on success | `change_event` present, 1,865 events |
| Building `read_history` | 200 | 76,109 | JSON array of 70 events |

The index reduces startup response bytes by **92.2%** compared with the full snapshot without history. Measured index HTTP time was 920 ms initially and 174 ms on a later request; conditional index time was 93 ms. A separate hosted `EXPLAIN ANALYZE` measured 259 ms for the index query. These are individual measurements, not latency percentiles; the proposal's sub-100-ms database target was not demonstrated by this run. Table/API bundle HTTP reads took 219/262 ms. Byte counts are decoded JSON response sizes, not compressed wire sizes.

Live read-only browser checks of the local frontend passed for the 150 exact Excel names, default groups and group filtering, the single batch-import history entry, 378 independent API fields, all 28 API PDF layout pages, and desktop/mobile layouts. Local suites separately verified Cache API reuse/revalidation and transactional version changes under isolated writes.

**Deviation:** the unchanged legacy full-history snapshot returned PostgreSQL `57014` (statement timeout) once; its retry returned HTTP 200 in 3,178 ms including network/transfer time. All new index/bundle reads, the export snapshot without history and the owner history succeeded. `query_logs` counted **one** matching `postgres_logs.event_message` between **15:32:24 and 15:33:49 UTC**:

```sql
select source, count() as entries,
       countIf(positionCaseInsensitive(event_message,
         'canceling statement due to statement timeout') > 0) as timeout_count
from logs where source = 'postgres_logs' group by source;
-- entries=2, timeout_count=1
```

An initial diagnostic searched `log_attributes` and returned zero; inspecting all log columns failed in the backend. The corrected query above searches the top-level `event_message` and is the reported count. The legacy full-history endpoint therefore retains a performance limitation; the new frontend startup does not call it. No additional migrations or timeout changes were made to address that separate path. The hosted database migration is complete; frontend publishing remains a separate release step. This task did not commit, push or publish the frontend.
