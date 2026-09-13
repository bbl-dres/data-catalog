# Editing unavailable: deployment investigation

13 September 2026. Project `zicluerzbevodlmtbxow`. **Hosted activation and signed-in browser save/history/restore completed.** The initial investigation and connection setup below are historical; see [completed activation](#completed-hosted-activation).

## Finding

The hosted database still has the original catalog schema, without the editing migrations. The app checks `catalog.edit_capabilities()` before creating a draft. Any failed/unsupported capability response keeps editing disabled and produces the reported message: “Bearbeiten ist derzeit nicht verfügbar. Bitte die Administration kontaktieren.” There is no per-user editor allowlist in the implemented model; permanent signed-in users can edit after activation.

Read-only requests used the existing public application key. No user token, password or service-role key was accessed, and no hosted mutation was attempted.

| Check | Observed response |
| --- | --- |
| `business_object.is_archived` | 400 / `42703`: column does not exist |
| `service_endpoint.row_version` | 400 / `42703`: column does not exist |
| `business_object.system_of_record_id` | 400 / `42703`: column does not exist |
| `data_table.access_options` | 400 / `42703`: column does not exist |
| Public-role request to `edit_capabilities` | 404 / `PGRST202`: function not found in schema cache |
| Public `read_snapshot` | Success; column names in all 17 populated collections exactly match the original 432-column baseline |
| Remaining collections | `lineage_relation` and `data_field_quality_requirement` are empty; their column shape cannot be inferred from snapshot rows |
| Public Auth settings | Email enabled; `disable_signup: true` |
| `GET /functions/v1/catalog-api/domain?limit=0` | 404 / `NOT_FOUND`: requested Edge Function was not found |

The anonymous RPC check alone would not establish function absence, because function visibility also depends on grants. The independently missing columns establish incomplete editing deployment. No authenticated dashboard/browser or database connection was available; user-session validity and private migration tracking remain unverified. The Edge Function is separate: browser editing calls the SQL RPC directly, while standard REST routes require the Edge deployment.

## Prepared correction

[prepare-editing-activation.cjs](../../supabase/prepare-editing-activation.cjs) generates `supabase/.temp/activate-editing.sql` from the existing security, editing, REST command, system-of-record, row-order, alias, required-rule and access-option migrations. It records source hashes and removes only their outer transaction boundaries so the complete activation commits atomically.

The generated SQL requires `postgres`, the original column inventory and absence of existing editing commands. It refuses partial activation and reruns. The original schema, import and curated catalog values are not replayed. Postconditions check the 477-column inventory, authenticated command grants, denied anonymous editing and denied direct table writes. Schema-cache reload notifications are delivered on commit. No test users or sample records are created by the activation.

See [execution instructions](../../supabase/README.md#fixing-editing-unavailable). Hosted application and a real signed-in save remain outstanding.

## Verification

- `tests/editing-activation.cjs` passes against the imported original database, including a prior editorial change. All original values, identities, row counts and revisions survive activation.
- Wrong-role, different-column inventory and repeat-run guards fail without changes. An injected failure after the migrations rolls back the complete DDL and preserves all data.
- The resulting authenticated capability response enables editing and access options. A save increments the revision and writes history; anonymous edits are rejected and public snapshot reads remain available.
- Existing `security-sql.cjs`, `editing-sql.cjs` and generated OpenAPI checks pass.

The local Supabase fixture now includes the platform's Auth-schema usage grant so the invoker-rights capability function is exercised under the authenticated role. This follows the [official Supabase Auth initialization](https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts/00000000000001-auth-schema.sql); it changes only local test setup, not hosted Auth permissions.

## MCP activation follow-up — 13 September 2026

**Hosted migrations applied in this follow-up: none.** The authorized deployment remains pending until the newly configured MCP connection is available to the running task.

At 2026-09-13T14:04:56.438Z, read-only requests to the configured project URL again confirmed public signup disabled, public snapshot access (3,918 rows across 19 collections), and the missing archive, endpoint-revision, system-of-record and access-option columns. The 17 populated collection inventories still exactly match their original baseline; the two empty collections remain unverified by this method. Anonymous capability discovery still returns 404 / PGRST202. The REST OpenAPI endpoint returned 401 / "Secret API key required", so no complete hosted schema inventory was obtained. These checks used only the existing public application key.

The prepared file is `supabase/.temp/activate-editing.sql` (233,113 bytes), not `supabase.temp/activate-editing.sql`. It was compared byte-for-byte with freshly generated output and matched. SHA-256: `1e18057e9a231884abf994d1b8988395804d5751597b586a2b9afddbfb80811f`. Its eight sources remain the security, editing, REST command, system-of-record, row-order, alias, required-rule and access-option migrations, in that order.

The reviewed preflight requires `postgres`, an exact table/column-name inventory, an existing snapshot RPC, and absence of the known edit commands and receipt table. It uses one transaction, an advisory transaction lock and a ten-second lock timeout. Its final guard checks 19 tables / 477 columns, authenticated command execution, denied anonymous capabilities, access-option support and denied direct INSERT/UPDATE/DELETE. These guards do not independently identify the project or attest the migration ledger, column types, existing comments, constraints, RLS policies or default privileges. Inspect those through the authenticated MCP connection before choosing the bundle; reconcile any partial deployment and apply only missing migrations in order. Public API evidence alone is insufficient to authorize that choice.

Re-run locally in this follow-up, all passing:

- `tests/editing-activation.cjs`: exact prepared activation behavior, prior-content preservation, wrong-role/column/rerun refusal, full DDL rollback, authenticated capabilities/save/history and public reads.
- `tests/security-sql.cjs`: future default-grant hardening, 19 public read-only tables, private access and existing API grants preserved.
- `tests/editing-sql.cjs`: authorization, immutable fields, atomicity, revisions, retries, owned rows, required rules and archival.
- `tests/catalog-schema.cjs`: canonical inventory of 19 current catalog tables / 477 columns; 148 schema checks.

The task initially exposed no Supabase MCP server; `codex mcp list` also showed none. With the user's authorization, a global `supabase` connection was added with URL `https://mcp.supabase.com/mcp?project_ref=zicluerzbevodlmtbxow&features=database,development,debugging`. Automatic OAuth registration failed with unsupported scopes. Explicit `projects:read,database:read,database:write,analytics:read` scopes succeeded, and the CLI reported a successful login. No password or token was requested in chat or saved in the repository. The active task's MCP resource discovery still reports `unknown MCP server 'supabase'`; reload/restart Codex and resume this task to expose its tools. See [OpenAI MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and [Supabase MCP setup](https://supabase.com/docs/guides/ai-tools/mcp).

Still unverified: authenticated project name and migration ledger; exact full deployed schema, functions and permissions; hosted activation and data-preservation postchecks; opening edit mode, saving a reversible change, seeing its history and restoring the original value in a real signed-in app session. Browser discovery exposed only an empty in-app browser, so no authenticated app session was available to this task. The separate catalog-api Edge deployment was not changed or rechecked. Existing uncommitted repository work was preserved; this follow-up changes documentation only.

## Completed hosted activation

**Completed and verified on 13 September 2026 at 2026-09-13T14:20:37.347Z.** Browser editing is active on project `zicluerzbevodlmtbxow`. An actual signed-in user opened edit mode, saved a reversible comment change on Archivgut, saw its history, restored the exact original comment and reloaded the page with both history entries visible. The original unavailable message did not recur.

### Deployment decision and application

Authenticated MCP returned the expected project URL and PostgreSQL 17.6 as `postgres`. Its migration ledger was initially empty because the original deployment used SQL Editor. The 19 tables, all 432 original column names/types/domains/nullability/defaults, 324 constraints, 44 triggers, 19 policies and 16 functions matched the original baseline (function bodies differed only in line endings). The editing commands and receipt table were absent.

However, the hosted table ACLs had drifted: `anon`, `authenticated` and `service_role` each held direct INSERT/UPDATE/DELETE on all 19 catalog tables. There were no inherited or column-level grants. The prepared bundle's final guard would reject this state. A narrow [ACL repair](../../supabase/repairs/2026-09-13-catalog-table-grants.sql) restored the existing SELECT-only API-role contract without changing rows, RLS, policies or private-table access. [Its regression test](../../tests/catalog-table-grants.cjs) reproduces that drift and verifies repeatability, data preservation and the subsequent migration chain.

The repair and eight pending migrations were then applied separately, in order, through the authenticated Supabase MCP connection. The prepared combined file and maintained migration sources were not modified or rerun.

| Hosted ledger version | Name | Maintained source |
| --- | --- | --- |
| `20260913141504` | `catalog_reconcile_existing_table_grants` | `repairs/2026-09-13-catalog-table-grants.sql` |
| `20260913141505` | `catalog_security` | `migrations/20260907000000_catalog_security.sql` |
| `20260913141506` | `catalog_editing` | `migrations/20260912000000_catalog_editing.sql` |
| `20260913141507` | `catalog_rest_crud` | `migrations/20260912010000_catalog_rest_crud.sql` |
| `20260913141508` | `catalog_system_of_record` | `migrations/20260913000000_catalog_system_of_record.sql` |
| `20260913141509` | `catalog_row_order` | `migrations/20260913010000_catalog_row_order.sql` |
| `20260913141510` | `catalog_aliases` | `migrations/20260913020000_catalog_aliases.sql` |
| `20260913141511` | `catalog_required_rules` | `migrations/20260913030000_catalog_required_rules.sql` |
| `20260913141728` | `catalog_access_options` | `migrations/20260913040000_catalog_access_options.sql` |

The final `catalog_access_options` MCP call reported a duplicate ledger version `20260913141511`, which was already used by the preceding migration in the same UTC second. Its DDL had nevertheless committed because the source contains COMMIT. Before any retry, the complete target schema and function definitions were compared with the current local migration chain. They matched. Only the missing ledger entry was inserted, with the original SQL source in its statements array; no access-option DDL was rerun. The repaired receipt is `20260913141728`, source MD5 `c9029ca18caf6f8910024354a3a9487d`. All nine receipts were subsequently read back.

For future MCP applications, separate calls across UTC-second boundaries. After any error, inspect both schema and ledger before retrying. These MCP-assigned versions differ from repository filenames; the original schema/import remain manually deployed and absent from the ledger. Reconcile the complete history before introducing CLI migration push, and never replay the initial schema/import into this catalog.

### Verification results

- Exact hosted target: **19 catalog tables, 477 columns, 335 constraints, 48 triggers and 25 functions**. All column definitions, canonical column comments, constraints, triggers, policies, function bodies/owners/security settings and API-role table permissions match the current repository. Existing unrelated schema-local platform defaults were preserved.
- All 19 catalog tables retain RLS and public SELECT policies. No API role has direct INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges. Authenticated SQL UPDATE is denied even with a false row predicate; the anonymous role is also denied.
- `edit_capabilities`, `save_entry` and `api_write` are executable by authenticated users and denied to anonymous and service roles. The save commands retain the fixed search path, postgres ownership and audited SECURITY DEFINER boundary. The permanent-account JWT guard has no editor allowlist. Anonymous Auth accounts are denied by the capability and save checks, verified in a rolled-back role test.
- All four private tables retain RLS and deny SELECT to anonymous, authenticated and service roles. The two real browser saves each created a private attribution record.
- Before the browser test, every original value, identity, revision and row count in all **3,918** catalog rows matched the pre-activation SQL hashes. No initial import or curated-content migration was replayed.
- Browser proof: Archivgut `812fbf7d-e68f-4639-b63d-38f155e388e7`, revision **2 → 3 → 4**. Only its comment was edited and restored. The two history events at `2026-09-13T14:18:28.448938+00:00` and `2026-09-13T14:18:58.402446+00:00` each list only `comment` as changed. Final record comparison shows the original business values exactly restored; only the expected revision and modification timestamps differ.
- Public history increased from **470 to 472**, for **3,920** total catalog rows after the reversible test. All other table counts are unchanged. SQL hashes are unchanged outside the tested business-object table and appended history.
- Public snapshot requests continue to return HTTP 200, and public Auth settings still report `disable_signup: true`. Anonymous capability requests now return HTTP 401 / SQLSTATE 42501 (denied), rather than the earlier missing-RPC response.
- Local checks: activation/rollback, security, editing and 148 schema checks passed during preparation; the additional ACL-repair regression passed against reproduced hosted drift and all eight migrations. The actual hosted browser save/history/restore and post-reload history checks also passed.

Machine-readable [verification evidence](2026-09-13-editing-activation/verification.json) records source hashes, ledger entries, pre/post data hashes, RPC grants and the two browser event IDs without credentials or private user identifiers.

### Remaining scope

The `catalog-api` Edge Function was not deployed or rechecked; its earlier 404 remains a separate REST deployment item and does not affect the verified browser RPC path. Only one real signed-in account was exercised interactively; the common permanent-user permission boundary was verified in SQL and against the maintained definitions.

Supabase advisors reported the intended authenticated SECURITY DEFINER commands and policy-free private RLS tables; these are consistent with the reviewed design. A separate existing Auth warning reports disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); no Auth settings were changed. Relevant advisor explanations: [private RLS with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Existing uncommitted repository changes were preserved. This activation added the ACL repair, its test and verification evidence, and updated the deployment documentation and queue. No passwords or tokens were requested in chat or written to the repository.
