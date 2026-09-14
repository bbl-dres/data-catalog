# Catalog performance review: snapshot timeouts

Review of the "Datenkatalog konnte nicht geladen werden … Supabase HTTP 500" failures of 14 September 2026, the read path behind them, and the changes made in response. It extends the [morning investigation](2026-09-14-snapshot-performance.md) with execution plans, a corrected reading of the generic-plan finding, and the implemented fix.

## Summary

The app loaded the whole catalog, including its complete change history with before/after states, through one `read_snapshot` call on every page view. That call had grown to 10.5 MB of JSON. On the hosted instance it ran between 0.8 s of CPU and several seconds of wall time, because the history sort spilled to disk and disk I/O on the small instance is erratic. The `anon` role cancels statements after 3 s, so any slow run surfaced as PostgREST error 57014, which the gateway reports as HTTP 500 and the loader shows as the message above.

History is now excluded from the initial load and read per record on demand, the snapshot function caches its plan, and the ordered history read is indexed. The initial payload drops from 10.5 MB to 3.6 MB and its database time from 0.8–8 s to about 0.45 s; a record's history costs one indexed read of 50–100 kB.

## Evidence

| Observation | Value |
| --- | --- |
| Snapshot requests on 14 Sep (gateway log) | 29, of which 6 returned HTTP 500; 0 of 79 failed on 13 Sep |
| Postgres log at each failure | `canceling statement due to statement timeout` |
| Role timeouts | `anon` 3 s, `authenticated` 8 s, `authenticator` 8 s, database default 2 min |
| Snapshot JSON | 10,532,159 bytes; `change_event` 6,690 kB (65.2 %, 2,243 events), `data_field` 1,467 kB (1,138 rows), `code_value` 1,388 kB (2,120 rows) |
| `change_event` table | 6.2 MB, of which `after` 2.6 MB and `before` 1.6 MB; neither column is displayed anywhere |
| History growth | 161 events on 7 Sep, 1,394 on 13 Sep (the 651-command row-order update), 379 on 14 Sep, 309 legacy undated |
| Execution plan of the function body (generic plan, as PostgREST runs it) | 833 ms execution, 141 ms planning; history aggregate 243 ms with `Sort Method: external merge  Disk: 4352kB` at `work_mem = 2184kB`; all `include_api_fields` filters `never executed` |
| Wall time, public API (`anon`, three runs) | time to first byte 2.4 s, 3.3 s, 3.6 s |
| Wall time, management connection (`postgres`, two runs) | 8.3 s, 7.7 s for the same function |
| History aggregate alone | 206 ms |
| Postgres version | 17.6: SQL-language functions are re-planned on every call; plan caching for them arrives with 18 |

Two points correct the morning note. The `include_api_fields IS TRUE OR …` conditions do not run when the flag is true (the plan marks their subplans `never executed`); their cost was the 141 ms of planning that a SQL-language function pays on every call. And the history collection is cheap to aggregate on its own; it is expensive because sorting 2,243 rows that carry their before/after states exceeds `work_mem` and spills, and because the spill lands on throttled disk. The same query measured 0.8 s, 2.4–3.6 s and 7.7–8.3 s within an hour depending on the connection and the moment, which is the signature of I/O contention rather than of query shape.

## Main bottlenecks, ranked

1. **History in the initial load.** 65 % of every page load was change events, two thirds of that before/after states no view reads. The table is append-only and grows with every edit, import and reorder, so the initial load degraded with each working day.
2. **A disk-spilling sort on a small instance.** The ordered history aggregate exceeded `work_mem` (2 MB) by 4 MB per call. Temp-file I/O on the hosted tier is fast in bursts and slow once the budget is spent, which turned a 0.8 s query into a 3–8 s one.
3. **No timeout headroom.** The public role cancels at 3 s. The old snapshot needed 1.5–2.7 s in good conditions, so ordinary variance crossed the line.
4. **Re-planning per call.** The SQL-language function was planned on every request (141 ms of the 974 ms), because Postgres 17 does not cache plans for SQL functions.
5. **Cost proportional to visits.** Every visitor rebuilds the whole snapshot; nothing is cached between page loads. This is acceptable now (0.45 s per visit) and the first thing to change when the audience grows (see next steps).

## Changes made

**Database** (`supabase/migrations/20260914030000_catalog_snapshot_history.sql`)

- `catalog.read_snapshot(include_api_fields boolean, include_history boolean DEFAULT true)` replaces the one-argument overload. PostgREST resolves `{}` to the legacy `read_snapshot()`, `{"include_api_fields":true}` to this function with history, and `{"include_api_fields":true,"include_history":false}` to the lean snapshot. SQL callers such as the import verification scripts keep `read_snapshot(true)` unchanged.
- The function is now PL/pgSQL, so pooled PostgREST connections reuse its plans. The app's branch has no visibility filters at all; the legacy branch keeps the table-field-only filters verbatim.
- `catalog.read_history(record_table text, record_id uuid, max_events integer DEFAULT 1000)` returns one owner's events together with those of its owned attributes, fields or values, newest first, without `before`/`after`. Each owner is a `UNION ALL` branch guarded by `record_table`; Postgres skips the other branches as one-time filters, and the matching branches use the existing partial `change_event_record_*_id_idx` indexes and the child tables' owner indexes. Measured on the busiest table (`t-sap-building`, 205 fields, 70 events): 74 ms and 73 kB, against 643 kB for the same events with states.
- `change_event_occurred_idx (occurred_on, identifier)` lets the complete snapshot and the archival hash checks read history in order without the 4 MB sort spill.
- Grants and volatility follow the existing pattern: `STABLE`, `SECURITY INVOKER`, `search_path = ''`, `EXECUTE` for `anon`, `authenticated` and `service_role`.

**Client**

- `boot.js` and `catalog.js` request `{"include_api_fields":true,"include_history":false}`. If the database predates the overload and answers PGRST202, the loader retries once with the previous body, so the frontend and the migration can be deployed in either order.
- `catalog.js` accepts a snapshot without `change_event`, exposes `projectHistory()` for rows read later, and adds `DK.catalog.history()` for the RPC.
- `data.js` replaces the synchronous filter over `data.changelog` with `data.historyState(kind, id)`: it returns `{ items, loading, error }` at once, starts one read per owner, caches it until the next `data.load()`, notifies the app when the read completes, and waits 15 s before retrying a failed read. `data.history()` keeps its signature; attribute and field profiles inherit their owner's list as before. A complete snapshot (fixture tests, older clients) still projects `change_event` directly.
- `detail.js` shows `…` in the tab count and a spinner in the Verlauf panel while a read is pending, and "Verlauf konnte nicht geladen werden." on failure; `app.js` re-renders a profile when its history arrives.

**Contract and tests**

- `supabase/generate-openapi.cjs` documents `include_history`, makes `change_event` optional in `CatalogSnapshot`, adds `/rpc/read_history` with the `HistoryEvent` schema, and verifies both RPC signatures; `data/swagger.json` is regenerated (37 paths).
- `tests/history-on-demand.cjs` (PGlite) checks the SQL contract, anonymous access, parity of every owner's history with the complete snapshot (133 owners in the fixture), the cached single read, inherited attribute history, loading and failure rendering, reload reset, and the legacy-body fallback.
- `tests/history-browser.cjs` (Playwright) loads the app on the lean snapshot and checks the request bodies, the tab count, one read per owner, inheritance by attribute profiles, and the loading and failure states.
- Existing suites keep passing unchanged: core, catalog-migration, catalog-schema, catalog-rls, catalog-table-grants, security-sql, session-security, api-contract, api-fields and api-fields-browser, rest-crud, resources, review-regressions, specializations, shared-attributes, attribute-mappings, catalog-browser, loading, editing, refx-building-mmb-browser.

## Before and after

| Measure | Before | After |
| --- | ---: | ---: |
| Initial payload (JSON before gzip) | 10.5 MB | 3.6 MB |
| Database time of the initial load | 0.8 s CPU, 2.4–8.3 s observed | 0.45 s (measured read-only on the hosted database with the new query body) |
| Temp-file spill per load | 4.3 MB | none (no history sort in the lean path; indexed order in the complete path) |
| History for one profile | included, all 2,243 events | one indexed read, 74 ms and 73 kB for the largest table |
| Planning per request | 141 ms | cached after the first call per pooled connection |
| Headroom under the 3 s public timeout | none to 1 s | about 2.5 s |

## Deployment

The migration is backward compatible: the deployed frontend's `{"include_api_fields":true}` resolves to the new function with `include_history` defaulted to true and receives the same snapshot as before. Apply it with the Supabase MCP `apply_migration` tool from an interactive session, with `supabase db push`, or by pasting the file into the SQL editor; then push the frontend. The new frontend also tolerates the old database through its PGRST202 fallback, so the order does not matter, only the end state.

Rollback: `DROP FUNCTION catalog.read_history(text, uuid, integer); DROP FUNCTION catalog.read_snapshot(boolean, boolean); DROP INDEX catalog.change_event_occurred_idx;` and recreate the one-argument function from `20260914020000_catalog_snapshot_api_fields.sql`. The frontend falls back to the complete snapshot on its own.

After deploying, confirm with the public key that `{"include_api_fields":true,"include_history":false}` returns about 3.6 MB without `change_event`, that `{}` still returns the legacy snapshot, and that `read_history` answers for a table id. The Postgres log should show no further `canceling statement due to statement timeout` entries for the snapshot.

## Recommendations not implemented here

1. **Conditional snapshot with a version token.** Return the current catalog version inside the snapshot and let the client send `if_version`; the database answers `{ unchanged: true }` in a few milliseconds when nothing changed, and the browser reuses the copy it kept in the Cache API. This makes database work proportional to edits rather than visits and removes the 3.6 MB download for returning visitors. It needs a trigger-maintained version row: the shared `catalog_private.serialize_write()` statement trigger is the natural place, but the row must be readable by `anon` inside the invoker-rights snapshot function, and both homes have a cost. A `catalog_private` table would need schema usage for API roles, which the security suites and docs currently forbid; a `catalog` table becomes a public endpoint and joins the canonical column inventory (481 columns) in `docs/data-model.md`, the schema suite and the contract generator. A sequence would avoid both but is non-transactional and can report a new version before the matching data commits. Decide the home first, then implement; the client side is about 40 lines in `boot.js` and `catalog.js`.
2. **Keep the public statement timeout at 3 s.** The lean load has about six times the headroom of the old one, and the timeout still protects the instance from runaway reads. Raise it only if the lean call ever measures above 1 s; the archival `read_snapshot(true)` is for administrative sessions, which run at 2 min.
3. **Watch the remaining growth vectors.** `data_field` (1.5 MB) and `code_value` (1.4 MB) now dominate the lean payload. When the lean load passes about 10 MB or 1 s, load fields and code values per table or list on demand the way history is loaded now; the projection already indexes them by owner, and the per-record pattern in `read_history` transfers directly.
4. **Instance I/O.** The 0.8 s versus 7.7 s spread for the same query is the hosted tier's disk budget. The lean path no longer spills, which removes the trigger, but bulk administrative runs (snapshot hashes, imports) still read and sort megabytes. Run them outside working hours, and consider the next compute tier before the catalog grows several-fold.
5. **History retention.** The 651 reorder events of 13 September carry full row states for a sort-order change. Consider storing only `changed_properties` plus the changed values for such bulk operations, or a compact event kind, before the next large import. The table's append-only guard stays.
6. **Advisors.** The performance advisor's two unindexed compound foreign keys are informational and irrelevant to the read path; most of the 63 "unused" indexes are the partial record indexes that `read_history` now uses, so they should stay. The security advisor's items (two `SECURITY DEFINER` write RPCs, leaked-password protection off) are unchanged and documented in [security.md](../security.md).

## Verification commands

```powershell
$env:PGLITE_MODULE = Join-Path $env:TEMP 'oblique-sql-test-tools/node_modules/@electric-sql/pglite'
$env:PLAYWRIGHT_MODULE = Join-Path $env:TEMP 'oblique-browser-tools/node_modules/playwright'
$env:PLAYWRIGHT_CHANNEL = 'msedge'
node prototype-oblique/tests/history-on-demand.cjs
node prototype-oblique/tests/history-browser.cjs
node prototype-oblique/tests/api-contract.cjs
node prototype-oblique/tests/catalog-migration.cjs
node prototype-oblique/supabase/generate-openapi.cjs --check
```

Hosted checks after the migration (public key only, no writes):

```sh
curl -s -o /dev/null -w '%{http_code} %{size_download} bytes, first byte after %{time_starttransfer}s\n' \
  -X POST "$SUPABASE_URL/rest/v1/rpc/read_snapshot" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H 'Content-Profile: catalog' -H 'Content-Type: application/json' \
  -d '{"include_api_fields":true,"include_history":false}'
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/read_history" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H 'Content-Profile: catalog' -H 'Content-Type: application/json' \
  -d '{"record_table":"data_table","record_id":"15b65a87-91dd-55af-b2af-8edac587a9aa"}' | head -c 400
```
