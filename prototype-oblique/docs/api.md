# Catalog API

The API page at `#/api` documents public reads and authenticated CRUD. Swagger UI loads the generated [OpenAPI 3.1 contract](../data/swagger.json). Existing collection reads use Supabase PostgREST; standard POST, single-record GET, PATCH and DELETE routes use the `catalog-api` Edge Function. The app's catalog loader continues to use the existing public snapshot API.

Users need only an **app login**. They do not need a Supabase dashboard account, database password or database access. Open **Account → API access token → Copy token** for use in scripts, curl or Postman. The token has the same editing permissions as that user. Its actual expiry is shown in the dialog; copy a current token after expiry. No refresh token or elevated key is exposed. Catalog writes also require the token’s current Auth session and an active permanent account. Server-confirmed sign-out/revocation, account deletion, an active ban or a session end time disables editing with that token, even before JWT expiry. If logout cannot reach the server, local sign-out alone does not revoke it. This adds the [Supabase session lookup](https://supabase.com/docs/guides/auth/sessions#how-to-ensure-an-access-token-jwt-cannot-be-used-after-a-user-signs-out) at both SQL write boundaries.

Swagger supplies the current app session for writes automatically. An explicit Bearer token may instead be entered in **Authorize**; it is not persisted across reloads. All 35 GET operations and the read-only snapshot POST are public and show no authorization lock. **Authorize** concerns only the 48 write operations. Direct Data API reads still carry the non-secret project `apikey` header, supplied automatically by the app and documented as a normal header parameter. It does not authenticate a user. Public reads send no user token. Each write is revision-checked and audited by SQL, including writes made outside this app.

## Activation

For system-of-record assignments, also apply [20260913000000_catalog_system_of_record.sql](../supabase/migrations/20260913000000_catalog_system_of_record.sql) after the editing/CRUD migrations. Both business-object and business-attribute create/update bodies accept `system_of_record_id` as a System UUID or null. Null clears an object designation or restores attribute inheritance. Reads return the stored reference; clients resolve the object fallback separately. System labels are not accepted as IDs. See [ordered activation](../supabase/README.md#system-of-record).

All numbered database migrations through `catalog_snapshot_api_fields` are applied and verified on Data Catalog. See the [14 September deployment record](review/2026-09-14-api-fields-groups.md). The **catalog-api Edge Function was still undeployed at the last check (GET returned 404 on 13 September 2026)**. Collection/snapshot reads and browser editing work; the standard Edge routes require separate deployment. The steps below are the ordered setup procedure, not instructions to rerun existing DDL.

1. Keep public signup disabled. Internal accounts remain administrator-created app users.
2. Apply the preceding security and editing migrations if needed, then run [20260912010000_catalog_rest_crud.sql](../supabase/migrations/20260912010000_catalog_rest_crud.sql) once as `postgres` in the Supabase SQL Editor. Do not rerun the initial schema or seed. It adds archive/timestamp fields where missing and the authenticated `api_write` command; direct table write grants stay denied. Apply the later numbered migrations through [catalog_snapshot_api_fields](../supabase/migrations/20260914020000_catalog_snapshot_api_fields.sql) before allowing writes on a fresh project.
3. Create an Edge Function named **catalog-api** using [index.ts](../supabase/functions/catalog-api/index.ts). The file is self-contained and has no package dependencies. Add the environment variable **PUBLIC_CATALOG_KEY** with the existing `sb_publishable_…` value from [catalog-config.js](../js/catalog-config.js). This is a public application key; do not use a service-role/secret key. `SUPABASE_URL` is supplied by the platform.
4. Set this function's gateway `verify_jwt` option to **false**, as recorded in [config.toml](../supabase/config.toml), and deploy it. Public GET and OPTIONS routes need this; the handler separately verifies every write token with Auth and forwards it to the Data API for SQL authorization. Keep those checks in place.
5. Publish/serve the updated app, sign in and try a small create/update/archive operation from `#/api`. Confirm its history. The runtime origin is the existing Supabase origin, already permitted by CSP.

With an administrator's authenticated Supabase CLI, step 4 can also use `supabase functions deploy catalog-api --project-ref zicluerzbevodlmtbxow --no-verify-jwt` from this app directory. Configure the public key environment variable in the dashboard first. No CLI or Supabase membership is required for end users. See [function routing](https://supabase.com/docs/guides/functions/routing) and [function authentication](https://supabase.com/docs/guides/functions/auth).

## CRUD routes and tokens

Base URL: `https://zicluerzbevodlmtbxow.supabase.co/functions/v1/catalog-api`

| Operation | Route | Required write headers |
|---|---|---|
| List records | `GET /{resource}` | None; PostgREST filters/pagination are accepted |
| Read one record | `GET /{resource}/{id}` | None; returns an `ETag` matching `row_version` |
| Create | `POST /{resource}` | `Authorization: Bearer <token>`, `Content-Type: application/json`, `Idempotency-Key: <new UUID>` |
| Update supplied properties | `PATCH /{resource}/{id}` | Same as create, plus `If-Match: "<row_version>"` |
| Archive | `DELETE /{resource}/{id}` | Authorization, Idempotency-Key and If-Match; no body |

CRUD resources: `actor`, `domain`, `system`, `business_object`, `business_attribute`, `data_table`, `data_field`, `code_list`, `code_value`, `data_product`, `product_attribute`, `data_service`, `service_endpoint`, `quality_requirement`, `relationship`, `lineage_relation`.

Audit events are generated by the server and remain read-only. Quality assignment tables are read-only directly; manage the complete `quality_requirement_ids` array through PATCH on the owning attribute/field. This is atomic, revision-checked, and includes the old/new collection in history. Removing an assignment unlinks it; the quality rule record and audited history are retained. Single-record reads include this array. The edit-mode UI still does not edit relationship/lineage assertions; their API endpoints are available to authenticated users.

DELETE sets `is_archived: true`. It does not physically remove or cascade to related records, change lifecycle/verification status, or free an existing identifier for reuse. Reads retain archived records so they can be inspected and restored; add `is_archived=eq.false` to collection reads for active records. PATCH `{ "is_archived": false }` with the current revision restores an entry. Public app collections hide archived roots/rows, while the raw snapshot retains identities and historical references. Archive does not automatically remove quality assignments or replace existing responsibility references.

Create returns **201**, the complete record, `Location` and `ETag`. PATCH and DELETE return **200** and the resulting record/ETag. PATCH only changes supplied properties; fields omitted from create receive SQL defaults. At least one translated name is required where the model has names. Internal IDs may be supplied on creation or generated; identities, owning parents, timestamps and revisions cannot be reassigned in updates. Relation endpoint/type identities also stay fixed. The generated create/update schemas list the actual allowed properties.

Use a fresh UUID Idempotency-Key for each new write. If the response is lost, retry the **same** request with the same key, body and revision; its original result is returned without another write or event. A changed request requires a new key. A missing If-Match returns **428**; a stale revision returns **412** without changing data. Read and reconcile the current record before submitting a new command. Invalid/expired tokens return **401**, forbidden writes **403**, duplicates **409**, model errors **422**. Requests are limited to 2 MiB and 2,000 assigned quality rules. No bulk/filter writes or upserts are offered.

Example (POSIX shell; substitute your own token, UUIDs and returned revision):

```sh
API="https://zicluerzbevodlmtbxow.supabase.co/functions/v1/catalog-api"
# Set TOKEN to the current access token copied from your app account.
curl --fail-with-body "$API/domain" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(python -c 'import uuid; print(uuid.uuid4())')" \
  -d '{"name_en":"REST example","status":"draft"}'

# Set ID to the returned id. If row_version is 1:
curl --fail-with-body -X PATCH "$API/domain/$ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H 'If-Match: "1"' \
  -H "Idempotency-Key: $(python -c 'import uuid; print(uuid.uuid4())')" \
  -d '{"description_en":"Created through the catalog REST API."}'
```

For retryable scripts, generate the command UUID once and retain it with the request until success; the example generates new commands on each execution. Never put access tokens in URLs, commits or shared logs.

## Independent API fields and groups

After the 14 September API-field and property-group migrations, create a `data_field` with either `data_table_id` or `data_service_id`, never both. The owning ID is immutable. API-owned fields require `technical_name_kind: "apiField"`; when a source type is documented, use `data_type_scope: "serviceSchema"`. All other field metadata is independently authored. No correspondence is required. Optional `correspondsTo` relationships connect distinct `data_field` IDs using the existing relationship API; an absent relation is not a confirmed capability gap.

`business_attribute` and `data_field` accept nullable `property_group` on create/update. This is a flexible text label, not a managed entity or foreign key. Null clears it; blank strings are invalid. API field inventories may remain empty, and new group values default to null; no existing inventories are copied or reassigned. Browser API editing saves field and endpoint rows atomically with the parent revision; new clients identify field children with `table: "data_field"`, while children without a table discriminator remain endpoints for compatibility. Field changes appear in the owning API history. Standard REST routes still require Edge Function activation as documented above.

## Access options

After the [access-options migration](../supabase/README.md#access-options-bereitstellungsformen), `data_table`, `data_product` and `data_service` accept `access_options` on POST/PATCH. This is the complete ordered JSON array of [AccessOption](data-model.md#accessoption) values, not a separate resource. Read the current owner first, preserve existing item IDs, modify the list and PATCH it with the owner's current If-Match revision and a fresh Idempotency-Key. Concurrent changes receive the ordinary conflict response.

Each item needs a lowercase UUID `id`, a title in at least one of `name_de`, `name_fr`, `name_it`, `name_en`, `status` and boolean `isArchived`. Optional fields are `format`, `accessUrl`, `downloadUrl`, `accessNotes`, `license` and `comment`. Omit blank optional values; nulls and unknown keys are rejected. Status `valid` requires an access/download URL or access notes. URLs must be HTTP(S) without embedded credentials. List order is display order.

Set an existing item's `isArchived` to true to archive it, or false to restore it; retain it in the array. Removing saved IDs is rejected. Omitted `access_options` leaves it unchanged on PATCH and defaults to an empty array on POST. History records the owner change. Existing `service_endpoint` CRUD remains separate.

## Access

Public reads need **no user login or bearer token**. Supabase still requires the application's public `apikey` header. The API page supplies the configured `sb_publishable_…` key automatically; other clients supply their own copy of that public key. Requests also select the exposed `catalog` schema.

| Operation | Route | Schema header |
|---|---|---|
| Read one catalog collection | `GET /rest/v1/{table}` | `Accept-Profile: catalog` |
| Read the complete catalog snapshot | `POST /rest/v1/rpc/read_snapshot` with `{}` | `Content-Profile: catalog` |
| Read one record's history | `POST /rest/v1/rpc/read_history` with `{"record_table":"data_table","record_id":"<uuid>"}` | `Content-Profile: catalog` |

The snapshot and history POSTs call SQL `STABLE`, security-invoker functions. They read metadata and do not write records. These 19 table reads and the two read RPCs remain available alongside the new CRUD routes; the underlying business data remains outside the catalog API.

Direct PostgREST table writes remain disabled. The new Edge routes call `catalog.api_write()` using the verified user's JWT, with no elevated key. SQL enforces permanent authenticated identity, the frozen table/property inventory, row versions and atomic audit/receipts even if a client calls the RPC directly. The Edge Function also offers public collection reads without the PostgREST schema/key headers.

Swagger permits only documented operations on their configured server and injects a session token only after validating the destination. It supplies public keys/schema headers for PostgREST reads, omits cookies, and rejects elevated application keys. These browser guards supplement database permissions; they do not replace them. In explicit offline JSON fixture mode, documentation renders but “Try it out” is disabled.

The catalog loader and Swagger share URL/key validation. Requests refuse redirects and Swagger ignores URL-supplied configuration. Update the explicit CSP connection origin in `index.html` when changing the configured Supabase project. See [Security and deployment](security.md).

## Querying records

Use the actual SQL names, including language suffixes. For example, this request returns the German and English labels of one business object:

```sh
curl "$SUPABASE_URL/rest/v1/business_object?identifier=eq.gebaeude&select=id,identifier,name_de,name_en&limit=1" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -H "Accept-Profile: catalog"
```

The raw API does not apply the app's language fallback or convert database records into frontend view models. SQL `id` values and foreign keys are UUIDs; `identifier` is the catalog's readable identity, unique per core table including full child identifiers. Only service endpoint identifiers are owner-scoped; child semantic names/codes can also have owner-scoped uniqueness. Include the parent UUID when filtering an owner's attributes or fields.

Table reads support PostgREST column filters, `select`, `order`, `limit`, `offset` and `Prefer: count=exact|planned|estimated`. Use a stable order with a unique key when paging; inspect `Content-Range` for the returned range and requested total. The hosted project may cap table responses. Selected columns, aliases and embedded resources alter the response shape; the displayed schemas describe ordinary full records.

POST `{"include_api_fields":true}` to `read_snapshot` (SQL: `read_snapshot(true)`) returns `schemaVersion` and every catalog collection, including independent API fields, under the caller's RLS permissions. The app adds `"include_history":false` on bootstrap and reload, which omits `change_event`: history was 65% of the payload and its before/after states are never displayed, so the app reads history per record instead. POST `{"record_table":"data_table","record_id":"<uuid>"}` to `read_history` returns that record's change events together with those of its owned attributes, fields or values, newest first and without `before`/`after` states; `record_table` accepts `domain`, `system`, `business_object`, `data_table`, `code_list`, `data_product` or `data_service`, and the optional `max_events` (default 1000, at most 5000) caps the newest events. Complete events remain readable through the `change_event` collection. An empty snapshot request or a false flag preserves the legacy table-field inventory and omits dependent assertions/history with excluded API-field targets. Direct table reads remain complete. The snapshot is not paginated, and quality-rule comparison numbers are serialized as decimal strings to preserve precision. Use table endpoints for smaller integration queries. The app's relevance search and Excel/PDF generation remain browser features, with no corresponding REST routes. The [performance review](review/2026-09-14-performance-review.md) records the measurements behind this split.

REST write bodies must be valid UTF-8. Numeric `comparison_value` tokens are forwarded to PostgreSQL using their exact JSON source text; decimal strings remain the portable choice, including on older Edge runtimes without source-aware parsing. No binary floating-point conversion is used for that threshold. The [September code review](wireframes/2026-09-13-code-review.md) documents the fix and tests.

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

This is a maintained read/CRUD contract generated from **repository SQL**, not a downloaded hosted PostgREST specification. CRUD input schemas use the same private SQL property inventory as the command. Hosted root OpenAPI discovery rejects publishable keys, while regular reads remain available. Schema changes made only in the SQL Editor must also become repository migrations or this contract will drift.

SQL checks, defaults and keys are descriptive `x-postgresql-*` annotations. The generator does not translate every SQL check, domain or trigger into JSON Schema. Most JSONB columns remain unconstrained JSON; `access_options` has an explicit item schema derived from the canonical dictionary. SQL additionally enforces unique/retained item IDs and exact value validation. The snapshot envelope and its numeric serialization are maintained explicitly. Response properties are optional because callers can project subsets with `select`; SQL nullability is recorded separately. The contract describes a supported subset of PostgREST, not every possible query operator or response representation.

## Verification

```powershell
node prototype-oblique/tests/api-contract.cjs
python prototype-oblique/tests/api-schema.py
node prototype-oblique/tests/api.cjs
node prototype-oblique/tests/rest-crud.cjs
node prototype-oblique/tests/rest-api-browser.cjs
```

The contract test executes the actual migrations/import, checks the generated file, all 84 operations, columns, keys, references and credential/destination guards, then writes response evidence to the OS temporary directory. The Python check needs `jsonschema` and validates complete read responses. `rest-crud.cjs` runs all 16 resource lifecycles, real HTTP routing, authorization, stale revisions, retries, rollback, owned assignments and audit checks. `rest-api-browser.cjs` tests account token controls and real Swagger POST/PATCH/DELETE through the actual handler and SQL commands. Browser transport/Auth are intercepted; no test changes hosted data or sends email.

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

### Owned row order

`sort_order` is the saved integer rank within a row's owner. On creation, omitting it appends after the maximum rank, including archived rows; an empty owner starts at 1. Explicit zero, positive ranks, gaps and ties are valid. Null is rejected. Updates change the rank only when supplied. Archive/restore retains it. Sort reads explicitly by `sort_order,identifier,id` to reproduce the saved sequence; an ordinary REST response does not imply ordering. See the [canonical rules](data-model.md#row-order) and [activation step](../supabase/README.md#row-ordering). The command allocator requires the row-order migration; the physical column default for imports remains 0.
