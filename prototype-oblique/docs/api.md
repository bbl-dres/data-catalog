# Catalog API

The API page at `#/api` documents the real Supabase PostgREST API. Swagger UI loads the generated [OpenAPI 3.1 contract](../data/swagger.json) and executes public reads directly against the project configured in [catalog-config.js](../js/catalog-config.js). No Edge Function, additional REST server or administrator login is needed.

## Access

Public reads need **no user login or bearer token**. Supabase still requires the application's public `apikey` header. The API page supplies the configured `sb_publishable_…` key automatically; other clients supply their own copy of that public key. Requests also select the exposed `catalog` schema.

| Operation | Route | Schema header |
|---|---|---|
| Read one catalog collection | `GET /rest/v1/{table}` | `Accept-Profile: catalog` |
| Read the complete catalog snapshot | `POST /rest/v1/rpc/read_snapshot` with `{}` | `Content-Profile: catalog` |

The snapshot POST calls a SQL `STABLE`, security-invoker function. It reads metadata and does not write records. The contract exposes 19 table reads and this one RPC; the underlying business data remains outside the catalog API.

Create, update and delete remain disabled in the current database grants. A future editing API would require an authenticated user's JWT **and** explicit authorization, RLS policies and the audited write boundary described in the implementation guide. A token alone does not grant editing rights. Completely header-free reads would require a separate proxy or gateway and are outside this implementation.

Swagger only permits documented reads against the configured origin. It supplies schema headers, omits cookies and bearer authorization, and rejects secret/service-role keys. These browser guards supplement database permissions; they do not replace them. In explicit offline JSON fixture mode, documentation renders but “Try it out” is disabled.

## Querying records

Use the actual SQL names, including language suffixes. For example, this request returns the German and English labels of one business object:

```sh
curl "$SUPABASE_URL/rest/v1/business_object?identifier=eq.gebaeude&select=id,identifier,name_de,name_en&limit=1" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "Accept-Profile: catalog"
```

The raw API does not apply the app's language fallback or convert database records into frontend view models. SQL `id` values are UUIDs; `identifier` is the catalog's readable identifier. Child identifiers are scoped to their parent, so include the appropriate parent ID when filtering attributes or fields.

Table reads support PostgREST column filters, `select`, `order`, `limit`, `offset` and `Prefer: count=exact|planned|estimated`. Use a stable order with a unique key when paging; inspect `Content-Range` for the returned range and requested total. The hosted project may cap table responses. Selected columns, aliases and embedded resources alter the response shape; the displayed schemas describe ordinary full records.

`read_snapshot()` returns `schemaVersion` and every catalog collection in one database statement, under the caller's RLS permissions. It is used by the current app. It is not paginated, and quality-rule comparison numbers are serialized as decimal strings to preserve precision. Use table endpoints for smaller integration queries. The app's relevance search and Excel/PDF generation remain browser features, with no corresponding REST routes.

## Regenerating the contract

The generator executes the repository migrations in an isolated PGlite PostgreSQL database, then reads column types, nullability, comments, defaults, primary keys, foreign keys and constraints. It does not contact or modify Supabase. Initial bulk data imports are skipped. New publicly readable tables require an explicit addition to the generator's reviewed table/tag inventory.

From the repository root, reuse the SQL test dependency or install it in a temporary directory:

```powershell
$sqlTools = Join-Path $env:TEMP 'oblique-sql-test-tools'
npm install --prefix $sqlTools --no-save --ignore-scripts @electric-sql/pglite@0.5.8
$env:PGLITE_MODULE = Join-Path $sqlTools 'node_modules/@electric-sql/pglite'
node prototype-oblique/supabase/generate-openapi.cjs
node prototype-oblique/supabase/generate-openapi.cjs --check
```

Regenerate after schema, access or configured endpoint changes, review the diff and commit `data/swagger.json` with the relevant changes. Ordinary catalog record edits do not require regeneration. The generator records migration hashes, has deterministic output and fails `--check` for a stale contract. No dependency or build step is added to the browser app.

This is a maintained public-read contract generated from **repository SQL**, not a downloaded hosted PostgREST specification. Hosted root OpenAPI discovery rejects publishable keys, while regular reads remain available. Schema changes made only in the SQL Editor must also become repository migrations or this contract will drift.

SQL checks, defaults and keys are descriptive `x-postgresql-*` annotations. The generator does not translate every SQL check, domain or trigger into JSON Schema. JSONB columns remain unconstrained JSON; the snapshot envelope and its numeric serialization are maintained explicitly. Response properties are optional because callers can project subsets with `select`; SQL nullability is recorded separately. The contract describes a supported subset of PostgREST, not every possible query operator or response representation.

## Verification

```powershell
node prototype-oblique/tests/api-contract.cjs
python prototype-oblique/tests/api-schema.py
node prototype-oblique/tests/api.cjs
```

The contract test executes the actual migrations/import, checks the generated file, columns, keys, references and request guards, then writes response evidence to the OS temporary directory. The Python check needs `jsonschema` and validates complete responses, formats and nullability against the OpenAPI schemas. The browser check needs the Playwright setup in the test guide; it exercises Swagger against intercepted read responses without changing hosted data.

For an optional live verification using only the configured public key:

```powershell
$env:API_LIVE_READ = '1'
node prototype-oblique/tests/api-contract.cjs
python prototype-oblique/tests/api-schema.py live
Remove-Item Env:API_LIVE_READ
```

This reads one row from each table while selecting every documented column, then reads the complete snapshot. It does not send writes or compare catalog content against a frozen initial import. Verified on 6 September 2026: all 19 table endpoints and the complete hosted snapshot passed; browser GET/RPC calls, automatic public-key headers, failure recovery and 320–1600 px layouts passed.

Regression checks also passed: 37 core tests, 6,847 migration/access/adapter checks, the functional suite, 20 mobile states and 50 contrast views. The newly exposed POST badge uses the existing success token; Swagger's default green measured only 2.03:1 with white text. The final contrast run reported no failures.

## References

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase OpenAPI discovery access change](https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key)
- [PostgREST schema selection](https://postgrest.org/en/stable/references/api/schemas.html)
- [PostgREST table queries](https://postgrest.org/en/stable/references/api/tables_views.html)
- [PostgREST pagination and counts](https://postgrest.org/en/stable/references/api/pagination_count.html)
- [SQL setup and access](../supabase/README.md), [editing boundary](data-model-implementation.md#editing-review-and-imports) and [test setup](../tests/README.md)
