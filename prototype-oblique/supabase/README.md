# Supabase catalog database

The prototype now reads public catalog metadata from Supabase without a login. UI configuration, translations, the handbook and the demonstration OpenAPI specification remain local. **The hosted import and browser connection were verified on 6 September 2026:** all 2,003 normalized rows match the tested import, and the browser reads the live project anonymously.

## Apply to the existing project

This project is already initialized and seeded; do not run setup again. The following records the SQL Editor procedure used after installing the catalog schema and original member RLS scripts.

1. Open [the project SQL Editor](https://supabase.com/dashboard/project/zicluerzbevodlmtbxow/sql/new) with the `postgres` role.
2. Copy the **entire** [seed.sql](seed.sql) into a new query and run it once. It combines the public-read migration and initial import in one transaction.
3. In **Project Settings / Data API / Exposed schemas**, add `catalog`, preserving the existing schemas. Keep `catalog_private` unexposed. No additional blanket grants are needed.
4. Reload the prototype. [catalog-config.js](../js/catalog-config.js) contains its public project URL and publishable key.

The script refuses a nonempty catalog and never overwrites records. Any error rolls back both import and access changes. Re-running the complete setup after success fails safely because its setup objects already exist. The separate data-import migration recognizes a successful prior import and does nothing, preserving subsequent database edits.

Verify in the SQL Editor:

```sql
SELECT 'tables' AS kind, count(*) FROM catalog.data_table
UNION ALL SELECT 'fields', count(*) FROM catalog.data_field
UNION ALL SELECT 'business_objects', count(*) FROM catalog.business_object
UNION ALL SELECT 'business_attributes', count(*) FROM catalog.business_attribute
UNION ALL SELECT 'code_lists', count(*) FROM catalog.code_list
UNION ALL SELECT 'code_values', count(*) FROM catalog.code_value;

BEGIN;
SET LOCAL ROLE anon;
SELECT jsonb_array_length(catalog.read_snapshot()->'data_field') AS public_fields;
ROLLBACK;
```

Expected: **30 tables, 621 fields, 25 business objects, 119 business attributes, 64 code lists and 572 code values**. The anonymous read returns 621 fields.

## Files and migration order

| File | Purpose |
|---|---|
| [20260906000000_catalog_schema.sql](migrations/20260906000000_catalog_schema.sql) | Initial normalized schema: 19 tables, 432 columns, concrete FKs and integrity guards. Already applied. |
| [20260906010000_catalog_rls.sql](migrations/20260906010000_catalog_rls.sql) | Original member-read policy and private Auth access list. Already applied. |
| [20260906020000_catalog_public_read.sql](migrations/20260906020000_catalog_public_read.sql) | Public SELECT policies, private import ledger and invoker-rights snapshot RPC. Replaces member-only reads. |
| [20260906030000_catalog_import.sql](migrations/20260906030000_catalog_import.sql) | Generated initial import, depending on preceding migrations. |
| [seed.sql](seed.sql) | SQL Editor bundle of the last two migrations, applied atomically. |
| [import-catalog.cjs](import-catalog.cjs) | Deterministic offline importer and bundle generator. |
| [import-manifest.json](import-manifest.json) | Source SHA-256 hashes, all allocated identities and expected counts. Retain with backups. |

For a **fresh project**, apply all four numbered migrations in order; do not then apply seed.sql. The schema uses PostgreSQL 15+ and existing Supabase roles, without extensions or new Auth users.

If CLI tracking is introduced later, first inspect the deployed schema and mark the SQL Editor migrations as applied. Do not push the initial schema into an existing database. This setup needs no CLI, MCP, connection string or administrator credential in the app.

## Import decisions

The import contains 2,003 rows, including 11 managed actors, 7 services/endpoints, 107 candidate relationships, 309 historical events and 103 assignments to one Required rule. Lineage remains empty.

- Existing top-level identifiers and every attribute/field URL are preserved. Child identifiers include their owner; repeated field names remain independent. Product-attribute and history identities do not depend on array positions.
- Definitions, exact codes and recorded DE/IT/FR/EN labels are preserved. Missing translations stay null; display fallback does not write invented translations.
- Owner/steward values become managed people and custodians organisational actors, following the current UI convention. External responsible organisations, including BFS, stay inline without Actor or Auth records.
- `mandatory: true` becomes an assignment to a **draft Required rule**, without asserting Not null. False/absence creates no optionality rule. Undocumented physical key roles stay SQL null; conceptual FK flags do not become physical relationships.
- Existing `realizes` and product arrays become candidate Relationship rows. Documented SAP API-field mappings become candidate `exposes` rows scoped to their endpoint, retaining notes that physical-column mappings are unconfirmed. No API-gap requirement or lineage is invented.
- Field names/types retain their evidence scope; API names are not relabeled as physical columns. Table technical IDs are copied only where recorded.
- Historical dates/names are retained. Descriptive legacy actions remain in summaries beside normalized English action tokens. No historical timestamps, version dates or current Actor attribution are invented.
- Source-only metadata excluded by the target model remains in the original JSON and `docs/sources` captures: reconciliation payloads, ordering, editions, locators, API samples and removed source properties. Runtime reads do not load these archives.

The eight catalog JSON files in `data/` are frozen import inputs and regression fixtures, not a second writable catalog. The manifest fingerprints both their exact bytes and the normalized output. Regeneration refuses changed input/mappings; later changes need reviewed incremental SQL migrations. The source-specific Python importers still write legacy files and must not be used as live database writers.

Regenerate unchanged input from the repository root:

```powershell
node prototype-oblique/supabase/import-catalog.cjs
```

## Public reads and browser integration

Both `anon` and `authenticated` can SELECT the current catalog, including comments and history. Classification describes the underlying data, not access to its catalog entry. The private access list is reserved for future editing and no longer gates reads. No eIAM integration is introduced.

Browser INSERT, UPDATE, DELETE and TRUNCATE remain denied. The service role retains its previous read-only grants. Future tables receive no new default public grants. The publishable key is intentionally public; database passwords and secret/service-role keys are not shipped.

`catalog.read_snapshot()` projects normalized tables in one consistent statement using **SECURITY INVOKER**, respecting RLS. It returns one JSON object, so PostgREST row limits do not truncate collections. Numeric quality thresholds travel as exact decimal strings. No JSON catalog mirror is stored.

`js/catalog.js` projects that response for the existing routes, collections, search, diagrams and Excel export. Canonical records and relationship verification details remain in workbook metadata. Attribute-to-field links now require explicit `represents` assertions; the database mode does not infer physical mappings from similar names. Labels follow the selected language, then German, English, French and Italian. Errors never silently fall back to legacy JSON; failed reloads preserve the last validated in-memory snapshot.

The prototype retains client-side search, sorting and pagination. Server-side search/pagination and incremental loading are future scaling work. Reloading fetches current database data; there is no realtime subscription. `#/api` remains a demonstration specification, not documentation of the Supabase REST API.

For an explicit offline fixture run, set `provider: 'json'` in catalog-config.js and restore `supabase` before deploying. Existing regression tests make that override only inside their local server.

## Editing boundary

The schema enforces identities, FKs, status/type constraints, hierarchies, version dates, append-only history and automatic row revisions. Initial legacy inserts preserve unknown version dates using a transaction-local import flag.

The audited edit API remains future work: authorize identities separately from catalog actors, compare expected row versions, maintain modification dates and create canonical ChangeEvents atomically. Direct SQL Editor edits are not automatically audited. Do not grant browser writes to bypass this boundary.

Write guards serialize cross-record changes using an advisory lock. Use short READ COMMITTED transactions or SERIALIZABLE with retries. REPEATABLE READ writes are rejected. See the [implementation guide](../docs/data-model-implementation.md#editing-review-and-imports).

## Validation

Use Node and an isolated PGlite dependency; browser checks additionally need Playwright and Edge/Chromium, as described in the [test guide](../tests/README.md).

```powershell
$sqlTestTools = Join-Path $env:TEMP 'oblique-sql-test-tools'
npm install --prefix $sqlTestTools --no-save --ignore-scripts @electric-sql/pglite@0.5.8
$env:PGLITE_MODULE = Join-Path $sqlTestTools 'node_modules/@electric-sql/pglite'
node prototype-oblique/tests/catalog-schema.cjs
node prototype-oblique/tests/catalog-rls.cjs
node prototype-oblique/tests/catalog-migration.cjs
node prototype-oblique/tests/catalog-browser.cjs
```

The first two suites test the original migrations independently. The migration suite executes the actual SQL Editor bundle and verifies records, child URLs, translations, codes, repeat imports, anonymous reads, denied writes, duplicate-key rejection, Excel completeness and snapshots beyond 1,000 fields. It also checks that a refused import rolls back access changes and preserves existing data.

Browser tests normally use real PostgreSQL output through mocked REST responses. They cover search, links, bubbles, responsibility, mobile and failed loads. Set `CATALOG_LIVE_READ=1` to run the same checks against the live project, comparing every returned record with the initial import. This optional baseline check was run successfully; it will need updating after intentional database edits. Hosted testing performs reads only; write-denial checks execute locally.

## References

- [Conceptual model](../docs/data-model.md) and [implementation guide](../docs/data-model-implementation.md)
- [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Supabase publishable keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase migration history repair](https://supabase.com/docs/reference/cli/supabase-migration-repair)
