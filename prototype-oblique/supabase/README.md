# Supabase catalog database

The prototype reads public catalog metadata from Supabase, with optional email/password login. UI configuration, translations, the handbook and the generated OpenAPI contract remain local. **The hosted import and browser connection were verified on 6 September 2026:** all 2,003 normalized rows match the tested import, and the browser reads the live project anonymously.

**Editing was activated and verified on 13 September 2026:** all eight pending migrations and a narrow existing-grant repair are applied. That activation established 19 catalog tables / 477 columns; an actual signed-in save, history and restoration passed. [Deployment record](../docs/review/2026-09-13-editing-activation.md#completed-hosted-activation). Do not rerun the activation bundle on this project.

## Email and password login

The header offers **Anmelden / Sign in** for existing Supabase Auth users. Signing in restores the current catalog route, shows the account email and offers password changes and sign-out on this browser (including its other tabs). Sessions persist through reloads and refresh automatically using the pinned, self-hosted Supabase JS SDK. For the five-user internal tool, accounts and forgotten passwords are administrator-managed: `authRecovery: 'administrator'` in [catalog-config.js](../js/catalog-config.js) shows instructions without requesting email. Create confirmed users with passwords in Supabase rather than sending invitations; users can change their password after login. No SMTP provider or sending domain is needed for this setup.

Optional email recovery remains supported: after configuring SMTP, set `authRecovery: 'email'`. It uses PKCE; open the email link in the same browser and device that requested it. Dashboard invitation links use an implicit callback instead: the app removes the URL tokens, validates the session with Supabase Auth and opens the password form. Standard dashboard recovery, confirmation and magic-link callbacks are also accepted.

The existing URL and publishable key in [catalog-config.js](../js/catalog-config.js) also configure Auth. No secret, service-role key or build step is required. Login alone needs no migration; editing requires the migration below. Every permanent signed-in account can then edit through the command API. Public catalog reads stay independent of the session; direct table writes remain denied. Auth identities are separate from catalog actors. No private editor allowlist is used.

Configure the existing project in the Supabase dashboard:

1. Under **Authentication / Sign In / Providers**, enable **Email** and disable **Allow new users to sign up**. Create the internal users in **Authentication / Users**, or use existing confirmed email/password accounts. Hiding registration in the app does not disable the public signup API.
2. Under **Authentication / URL Configuration**, set **Site URL** to `https://bbl-dres.github.io/data-catalog/prototype-oblique/` and allow redirects to `https://bbl-dres.github.io/data-catalog/prototype-oblique/**`. This path-scoped wildcard preserves catalog hashes and query parameters in reset links.
3. For development served from the repository root, also allow `http://localhost:8000/prototype-oblique/**` (and the corresponding `127.0.0.1` URL if used). If serving this folder directly, use `http://localhost:8000/**`. Use the same hostname when requesting and opening a reset link.
4. SMTP is optional for the current administrator-managed setup. If enabling email recovery later, configure delivery as described below, retain `{{ .ConfirmationURL }}` in templates and verify a complete reset flow.

The browser's CSP allows this existing Supabase origin only. If moving projects, update both `catalog-config.js` and the Supabase origin in `index.html`. Offline JSON fixture mode does not initialize Auth. An Auth failure does not prevent browsing the public catalog.

An earlier read-only check on 12 September 2026 reported Email enabled, signup enabled and email confirmation required. The user subsequently selected administrator-created accounts. Public Auth settings independently confirmed signup disabled on 13 September 2026, before and after editing activation. No hosted settings or accounts were changed by this implementation.

Implementation: [auth.js](../js/auth.js), [auth.css](../css/auth.css), translations in [i18n.json](../data/i18n.json). SDK pin, license and hashes are recorded in [vendor/manifest.json](../vendor/manifest.json); reproduce them with `python prototype-oblique/scripts/vendor-supabase.py` and verify with `python prototype-oblique/scripts/verify-vendor.py --upstream`.

The [Auth browser tests](../tests/auth.cjs) run the real SDK against mocked Auth responses and a local PostgreSQL catalog snapshot. They do not send emails or use hosted credentials. Dashboard settings and real email delivery must be verified separately.

References: [password authentication](https://supabase.com/docs/guides/auth/passwords), [password reset](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [redirect allow lists](https://supabase.com/docs/guides/auth/redirect-urls), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

### Email delivery setup and troubleshooting

The project owner confirmed on 12 September 2026 that the project uses Supabase's built-in sender. It only sends to members of the project's Supabase organization, currently permits two emails per hour, and does not guarantee delivery. An Auth log entry with `POST /invite`, `user_invited` and status `200` confirms request completion, not receipt in an inbox. Check spam and the exact recipient, then use a custom SMTP provider for regular delivery. See [Supabase SMTP limitations](https://supabase.com/docs/guides/auth/auth-smtp).

Distinguish the failed request by its path, timestamp and error code:

- `email_address_invalid`: the mailer rejected address validation. Retype the actual recipient without backslashes, spaces or copied formatting. If a correctly entered real address still fails, inspect that failing request's Auth log; the message does not by itself prove a spelling mistake.
- `email_address_not_authorized`: the default sender is restricted to organization members. Configure SMTP to deliver to ordinary app users.
- `over_email_send_rate_limit`: stop repeated attempts until the applicable rate limit resets.
- A completed `/invite` does not explain a failed `/magiclink`; inspect each request separately.

The distinctions are documented in [Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes); the [Auth mailer implementation](https://github.com/supabase/auth/blob/master/internal/api/mail.go) also maps address, format and DNS validation failures to `email_address_invalid`.

For an existing email service, enter that provider's SMTP settings under **Authentication → Email → SMTP Settings**. If no provider is in place, Resend is one supported option:

1. Verify a sending domain you own in Resend using the DNS records it provides, then create a sending API key.
2. Enable custom SMTP in Supabase and fill in the following values. Replace the example sender with an address at your verified domain.

| Supabase field | Resend value |
|---|---|
| Sender email | `noreply@your-verified-domain.ch` |
| Sender name | `Datenkatalog` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key, entered directly in Supabase |

Use the provider credential only in Supabase's SMTP settings, never in this repository or browser configuration. These values come from [Resend's Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp).

3. Check **Authentication → URL Configuration**. The deployed app's Site URL is `https://bbl-dres.github.io/data-catalog/prototype-oblique/`; replace a leftover `http://localhost:3000` if present. Keep the redirect allow list described above. For a local-only test use the actual local server URL.
4. Keep the default `{{ .ConfirmationURL }}` link in each template; changing SMTP does not require custom email HTML. Send one test invitation after saving, compare the Supabase Auth log with the provider's delivery/bounce log, and confirm the recipient reaches the app's new-password form. Check password recovery separately.

The local invitation callback and error-message tests pass with the real SDK and mocked responses. SMTP credentials, DNS verification, dashboard URLs and real delivery still require setup/verification in the connected services; no hosted settings were changed by the app fix.

## Apply to the existing project

All numbered schema changes through `catalog_snapshot_api_fields` are already applied to Data Catalog. The sections below describe their dependencies for recovery or a fresh project; they are not a pending deployment queue. Current schema: **19 catalog tables / 481 columns**. [Latest import and compatibility verification](../docs/review/2026-09-14-refx-building-api.md).

### API fields and property groups

The RE-FX Building API now has 378 documented fields. Apply [snapshot compatibility](migrations/20260914020000_catalog_snapshot_api_fields.sql) after the group migration: updated clients POST `{"include_api_fields":true}` to read the complete snapshot; legacy empty requests retain table-owned fields only. The function-only migration is applied as **20260914124500**. It preserves data and write permissions. [Source review and verification](../docs/review/2026-09-14-refx-building-api.md).

Apply [catalog_api_fields](migrations/20260914000000_catalog_api_fields.sql) after table ordering, then [catalog_property_groups](migrations/20260914010000_catalog_property_groups.sql). They add independent API-owned field records using an exclusive table/API owner, plus optional free-text groups on business attributes and both field inventories. Browser and REST commands preserve immutable owners, revisions, history and existing permissions. No data is copied or reassigned. Both were applied through MCP on 14 September 2026 as **20260914101146** and **20260914101153**; all 19 collection fingerprints were preserved. See the [deployment record](../docs/review/2026-09-14-api-fields-groups.md).

### Required-rule correction

Apply [catalog_required_rules](migrations/20260913030000_catalog_required_rules.sql) after the alias migration. Archived or retired quality rules no longer activate the editor's required checkbox. Re-enabling the checkbox selects or creates an active editor rule; historical assignments stay intact. This function-only correction changes no table/column inventory and was tested locally. It was applied to the hosted project on 13 September 2026 as part of the verified editing activation.

Deploy the revised [catalog-api function](functions/catalog-api/index.ts) separately for exact decimal token forwarding and strict UTF-8 request validation. Follow the existing [API activation guide](../docs/api.md#activation).

### Canonical aliases

Apply [canonical column comments](migrations/20260913020000_catalog_aliases.sql) after all earlier migrations, including the row-order and system-of-record updates below. This migration changes comments only on all 474 public columns. It preserves rows, identities, permissions and constraints. The generated OpenAPI contract carries English titles, EN/DE aliases and canonical property references from [data-model.md](../docs/data-model.md#alias-contract-across-surfaces).

Applied through Supabase MCP on 13 September 2026. All 477 then-current column comments, including the later access-option columns, match the canonical migration output. Follow the [alias review and maintenance commands](../docs/review/2026-09-13-model-alias-review.md#maintaining-one-source-of-truth); future changes start in the Markdown and use a new comment migration.

### Row ordering

[catalog table ordering](migrations/20260913070000_catalog_table_order.sql) is applied via MCP as **20260913190314**. That migration established **19 catalog tables / 478 columns**. It adds DataTable.sortOrder with integer validation and guarded browser/REST edit support, preserving RLS and denied direct writes. The 30 table and 621 field ranks were separately curated through audited RPCs. [Deployment and verification](../docs/review/2026-09-13-source-order.md).

Apply [catalog row ordering](migrations/20260913010000_catalog_row_order.sql) after the system-of-record migration below. It changes command behavior only: omitted child ranks append consistently through both `save_entry` and REST CRUD. Existing columns, ranks, permissions and identities remain unchanged. The command lock, history and idempotency receipt cover the allocated rank. Explicit zero and ties remain valid; null is rejected. See the [canonical contract](../docs/data-model.md#row-order).

This migration was applied through Supabase MCP on 13 September 2026; its hosted function definitions match the maintained migration chain.

Verify with `node prototype-oblique/tests/row-order.cjs` and `node prototype-oblique/tests/row-order-browser.cjs`. The first covers all five child types and the resulting workbook; the second checks hidden archives and restoration of saved view order.

### System of record

`system_of_record_id` is an optional UUID foreign key to `catalog.system(id)` on BusinessObject and BusinessAttribute. The object supplies a default; a null attribute value inherits that default. Legacy source text is not converted into assignments. The [canonical definition](../docs/data-model.md#system-of-record) specifies the scope.

Applied through Supabase MCP on 13 September 2026. For another existing deployment, inspect and apply only missing migrations in this order, without rerunning the initial schema or import:

1. Apply the existing [security update](migrations/20260907000000_catalog_security.sql) if still pending.
2. Apply [catalog editing](migrations/20260912000000_catalog_editing.sql) and then [REST CRUD](migrations/20260912010000_catalog_rest_crud.sql) if not already applied. These provide the audited commands and private write inventories extended by the new migration. Keep public signup disabled.
3. Apply [the system-of-record migration](migrations/20260913000000_catalog_system_of_record.sql) as `postgres`. It adds two nullable references and indexes and extends the existing write inventories; no catalog values are backfilled.
4. Verify both columns below, reload the app and sign in. Select a system on a business object, verify the attribute inheritance, then set and clear an attribute override. Check the owner history. The REST Edge Function needs [separate activation](../docs/api.md#activation) for standard HTTP CRUD; browser saves use the SQL RPC directly.

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'catalog'
  and table_name in ('business_object', 'business_attribute')
  and column_name = 'system_of_record_id';
```

Expected: two nullable UUID columns. Local verification: `node prototype-oblique/tests/system-of-record.cjs` and `node prototype-oblique/tests/system-of-record-browser.cjs`, with the dependencies described below.

### Enable editing

For standard REST CRUD and account access tokens, also follow [API activation](../docs/api.md#activation). It adds the later CRUD migration and one Edge Function; end users do not receive database or Supabase dashboard access.

For the already imported project:

1. Disable **Authentication → Sign In / Providers → Allow new users to sign up**. Only the internal accounts you create should be able to sign in and edit. Leave the Email provider enabled.
2. If not already applied, run [20260907000000_catalog_security.sql](migrations/20260907000000_catalog_security.sql) as `postgres` in the SQL Editor. This earlier security migration is repeatable.
3. Run [20260912000000_catalog_editing.sql](migrations/20260912000000_catalog_editing.sql) once as `postgres`. It adds edit timestamps, row ordering/archive flags, endpoint revisions, private audit/retry tables and the two authenticated RPCs. It preserves existing values and identities. Do not rerun the seed or initial schema.
4. Serve/publish the updated app, sign in and open **Bearbeiten / Edit** on a profile or **Neu anlegen / Create** on a collection. Save a small edit and check the profile history. No `catalog_private.user_access` row is needed.

The migration is **applied to the hosted project**. A real signed-in browser opened edit mode, saved and restored a comment, and displayed both history entries on 13 September 2026. See the [implementation plan and verified behavior](../docs/edit-mode-implementation.md).

An administrator can inspect exact attribution in the SQL Editor without exposing account emails in public history:

```sql
select e.occurred_at, e.summary_en, a.user_id, a.command_id
from catalog_private.edit_event_actor a
join catalog.change_event e on e.id = a.event_id
order by e.occurred_at desc;
```

### Original setup and earlier security update

**Security update, 7 September 2026:** run [20260907000000_catalog_security.sql](migrations/20260907000000_catalog_security.sql) as `postgres` in the SQL Editor. This tested, repeatable migration closes the future-object default-grant gap. It changes future global defaults for `postgres` and local defaults in the catalog schemas, preserving current records and grants. Global changes affect future objects across the database; other schemas' local defaults remain unchanged. This update was applied on 13 September 2026. A separate [ACL repair](repairs/2026-09-13-catalog-table-grants.sql) also removed observed direct write grants on existing catalog tables; the security migration changes future defaults only. See the [security review](../docs/review/2026-09-07-security-review.md).

This project is already initialized and seeded; do not run setup again. The following records the SQL Editor procedure used after installing the catalog schema and original member RLS scripts.

1. Open [the project SQL Editor](https://supabase.com/dashboard/project/zicluerzbevodlmtbxow/sql/new) with the `postgres` role.
2. The historical `seed.sql` combined the public-read migration and initial import in one transaction. If needed for recovery, regenerate it with `node prototype-oblique/supabase/import-catalog.cjs --sql-editor-bundle` from the repository root, then copy the entire generated `supabase/.temp/seed.sql` into a new query. The bundle requires the first two migrations and excludes all later migrations; it is not a current setup script.
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

## Fixing editing unavailable

Resolved on 13 September 2026: [deployment record](../docs/review/2026-09-13-editing-activation.md#completed-hosted-activation). The hosted project has all editing migrations and the subsequent [session security migration](migrations/20260913050000_catalog_session_security.sql). A real signed-in localhost save/history/restore passed after hardening.

If this message recurs, first check that the account is permanent, not banned/deleted, and has a live session; sign in again after server-side revocation. Then compare the deployed migration ledger, function permissions and schema with this repository. Apply only missing migrations in order. Keep signup disabled and direct table writes denied.

The one-off activation generator, its dedicated bundle test and the disposable generated activation/seed SQL have been retired. They target a superseded pre-editing baseline. Use the numbered migrations for a fresh database; never rerun the initial schema/import on this populated project. Git history retains the original activation procedure and evidence.

MCP assigned deployment timestamps different from source filenames, and the initial SQL Editor setup has no original ledger entries. **Do not run an unreviewed CLI db push against this project.** Reconcile the ledger with the verified schema before adopting CLI deployment; a timestamp mismatch is not evidence that DDL is missing.

## Access options (Bereitstellungsformen)

Apply [20260913040000_catalog_access_options.sql](migrations/20260913040000_catalog_access_options.sql) once as `postgres`, after all preceding migrations through [catalog_required_rules](migrations/20260913030000_catalog_required_rules.sql). For an existing database, apply only missing migrations in the table below; do not rerun the initial schema or import.

The migration adds `access_options` JSONB lists to `data_table`, `data_product` and `data_service`, with strict validation, retained item identities, canonical column comments and the existing browser/REST write inventories. Lists start empty. Parent revisions and history cover edits, reordering and archival. Existing endpoint records, grants and catalog content are preserved; no demonstration URLs are imported. That migration brought the repository to 19 public tables and 477 columns; table ordering later adds one column.

**Hosted activation is complete.** The access-option columns, constraints, triggers, functions and canonical comments match the tested current schema. An MCP ledger timestamp collision was reconciled after confirming the DDL committed; the DDL was not rerun. After applying it, reload the app, sign in, open a table/product/API and use the Bereitstellungsformen edit tab. Check a saved entry and its history. If the CRUD Edge Function is already deployed, it needs no code change for this new owner property. The frontend handles an older schema by keeping public reads available and disabling access-option editing.

## Files and migration order

| File | Purpose |
|---|---|
| [20260906000000_catalog_schema.sql](migrations/20260906000000_catalog_schema.sql) | Initial normalized schema: 19 tables, 432 columns, concrete FKs and integrity guards. Already applied. |
| [20260906010000_catalog_rls.sql](migrations/20260906010000_catalog_rls.sql) | Original member-read policy and private Auth access list. Already applied. |
| [20260906020000_catalog_public_read.sql](migrations/20260906020000_catalog_public_read.sql) | Public SELECT policies, private import ledger and invoker-rights snapshot RPC. Replaces member-only reads. |
| [20260906030000_catalog_import.sql](migrations/20260906030000_catalog_import.sql) | Generated initial import, depending on preceding migrations. |
| [20260907000000_catalog_security.sql](migrations/20260907000000_catalog_security.sql) | Deny future implicit API-role grants; apply separately to the existing project. |
| [20260912000000_catalog_editing.sql](migrations/20260912000000_catalog_editing.sql) | Authenticated atomic edit commands, revisions, row ordering/archive, private attribution and safe retries. Apply after disabling public signup. |
| [20260912010000_catalog_rest_crud.sql](migrations/20260912010000_catalog_rest_crud.sql) | REST command boundary for all 16 resource types, archival and atomic owned quality assignments. Requires catalog-api deployment for standard HTTP routes. |
| [20260913000000_catalog_system_of_record.sql](migrations/20260913000000_catalog_system_of_record.sql) | Explicit System UUID references on business objects and attributes; object default, attribute override, existing audit/write boundary. |
| [20260913010000_catalog_row_order.sql](migrations/20260913010000_catalog_row_order.sql) | Consistent audited append behavior for browser and REST child creation. |
| [20260913020000_catalog_aliases.sql](migrations/20260913020000_catalog_aliases.sql) | Canonical EN/DE column aliases and descriptions; comments only. |
| [20260913030000_catalog_required_rules.sql](migrations/20260913030000_catalog_required_rules.sql) | Exclude archived required rules and retain historical assignments when the checkbox is re-enabled. |
| [20260913040000_catalog_access_options.sql](migrations/20260913040000_catalog_access_options.sql) | Owned access descriptions on tables, products and APIs; validation, identity retention and audited browser/REST editing. |
| [import-catalog.cjs](import-catalog.cjs) | Deterministic offline importer and bundle generator. |
| [import-manifest.json](import-manifest.json) | Source SHA-256 hashes, all allocated identities and expected counts. Retain with backups. |
| [20260913050000_catalog_session_security.sql](migrations/20260913050000_catalog_session_security.sql) | Current account/session checks for both write RPCs, retired membership-helper execution and closed future public-schema grants. Applied through MCP on 13 September 2026. |
| [20260913060000_catalog_specializations.sql](migrations/20260913060000_catalog_specializations.sql) | Typed BusinessObject specialization, uniqueness and cycle guard. Applied via MCP as 20260913175334; existing content and ACLs preserved. |
| [20260913070000_catalog_table_order.sql](migrations/20260913070000_catalog_table_order.sql) | DataTable display rank and guarded edit/API support. Applied via MCP as 20260913190314; established 478 columns. |
| [20260914000000_catalog_api_fields.sql](migrations/20260914000000_catalog_api_fields.sql) | Independent API-owned fields, exclusive immutable ownership and guarded field/endpoint editing. Applied via MCP as 20260914101146. |
| [20260914010000_catalog_property_groups.sql](migrations/20260914010000_catalog_property_groups.sql) | Optional text groups on business attributes and fields. Applied via MCP as 20260914101153; current schema has 481 columns. |
| [20260914020000_catalog_snapshot_api_fields.sql](migrations/20260914020000_catalog_snapshot_api_fields.sql) | Explicit API-field snapshot opt-in and consistent legacy snapshots. Applied via MCP as 20260914124500; no stored content changed. |
| [archive/](archive/README.md) | The 22 content updates applied on 7 September 2026, preserved unchanged with their original replay order and evidence. |

For a **fresh project**, apply all eighteen numbered migrations in order. The grant repair in `repairs/` is operational recovery for observed hosted ACL drift, not a numbered setup migration. The schema uses PostgreSQL 15+ and existing Supabase roles, without extensions or new Auth users. These migrations restore the original import; later curated content requires the archived updates and their documented prerequisites, or a database backup.

Cleanup review: every numbered SQL migration remains required by the rebuild chain; the 22 archived content operations are also used by regression tests. Applying a migration does not make its source obsolete. The repair remains a tested tool for existing grant drift.

Keep the numbered migrations intact: later migrations depend on earlier ones, even when they replace a policy. The Supabase CLI applies `migrations/`; `archive/` is historical, manual recovery material. The duplicate `seed.sql` is generated only on request into ignored CLI scratch space (`.temp/`), and is never needed after applying the numbered migrations.

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

Both `anon` and `authenticated` can SELECT the current catalog, including comments and history. Classification describes the underlying data, not access to its catalog entry. The original private access list gates neither public reads nor the new editor. All permanent signed-in accounts can call the edit API; anonymous Auth accounts cannot. No eIAM integration is introduced.

Direct table INSERT, UPDATE, DELETE and TRUNCATE remain denied. Authenticated changes go through the audited command functions. The service role retains its previous read-only grants. After the security update, future catalog objects created by `postgres` receive no implicit API-role grants; other owners require a separate default-privilege review. The publishable key is intentionally public; database passwords and secret/service-role keys are not shipped.

`catalog.read_snapshot()` projects normalized tables in one consistent statement using **SECURITY INVOKER**, respecting RLS. It returns one JSON object, so PostgREST row limits do not truncate collections. The app calls `read_snapshot(true, false)`: independent API fields included, change events omitted, because history was 65% of the payload and its before/after states are never displayed. `catalog.read_history(record_table, record_id)` returns one owning record's events, including its owned attributes, fields or values, newest first through the partial record indexes. Numeric quality thresholds travel as exact decimal strings. No JSON catalog mirror is stored. The [performance review](../docs/review/2026-09-14-performance-review.md) documents the bottlenecks behind this split.

`js/catalog.js` projects that response for the existing routes, collections, search, diagrams and Excel export. The review workbook uses fixed readable columns; complete canonical records and relationship verification details remain available through the API. See the [Excel contract](../docs/excel-export.md). Attribute-to-field links now require explicit `represents` assertions; the database mode does not infer physical mappings from similar names. Labels follow the selected language, then German, English, French and Italian. Errors never silently fall back to legacy JSON; failed reloads preserve the last validated in-memory snapshot.

The prototype retains client-side search, sorting and pagination. Using server-side search/pagination and incremental loading in the app is future scaling work. Reloading fetches current database data; there is no realtime subscription. `#/api` documents public table/snapshot reads and authenticated CRUD. Swagger supplies the public key for reads and the current app token for writes. Standard CRUD routes require the later SQL migration and `catalog-api` Edge Function; see [API activation](../docs/api.md#activation).

For an explicit offline fixture run, set `provider: 'json'` in catalog-config.js and restore `supabase` before deploying. Existing regression tests make that override only inside their local server.

## Editing boundary

The [archived catalog content updates](archive/README.md) record the 22 operations already applied on 7 September 2026, including the revised business-object profiles. Keep them for evidence and recovery; follow their documented order and prerequisites when reconstructing that content. The original import and fixtures remain frozen. New content changes should use the app or authenticated API; schema changes belong in a new numbered migration.

The schema enforces identities, FKs, status/type constraints, hierarchies, version dates, append-only history and automatic row revisions. Initial legacy inserts preserve unknown version dates using a transaction-local import flag.

The editing and REST migrations provide audited commands: permanent app identities are separate from catalog actors, expected row versions prevent stale writes, and modification dates, ChangeEvents and private attribution are saved atomically. Direct SQL Editor edits are not automatically audited. Do not grant direct table writes to bypass this boundary.

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
node prototype-oblique/tests/history-on-demand.cjs
node prototype-oblique/tests/history-browser.cjs
```

The schema suite first reconciles the [canonical model](../docs/data-model.md) with all current migrations, including dictionary coverage, nullability and table/column counts. It then tests the original schema independently; the RLS suite tests the original member policies. The migration suite reconstructs the historical SQL Editor bundle from the committed migrations in memory and verifies records, child URLs, translations, codes, repeat imports, anonymous reads, denied writes, duplicate-key rejection, Excel completeness and snapshots beyond 1,000 fields. It also checks that a refused import rolls back access changes and preserves existing data.

Browser tests normally use real PostgreSQL output through mocked REST responses. They cover search, links, bubbles, responsibility, mobile and failed loads. Set `CATALOG_LIVE_READ=1` to run the same checks against the live project, comparing every returned record with the initial import. This optional baseline check was run successfully; it will need updating after intentional database edits. Hosted testing performs reads only; write-denial checks execute locally.

## References

- [Conceptual model](../docs/data-model.md) and [implementation guide](../docs/data-model-implementation.md)
- [Supabase custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Supabase publishable keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase migration history repair](https://supabase.com/docs/reference/cli/supabase-migration-repair)
