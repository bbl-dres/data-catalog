# Supabase security and public API review

Completed 13 September 2026 for project `zicluerzbevodlmtbxow` (Data Catalog). Public catalog content is intentional. Internal permanent users may edit; integration writes use a current app access JWT. This review made no commit or push.

## Implemented and applied

- Added `20260913050000_catalog_session_security.sql`, deployed through authenticated Supabase MCP as `20260913143436_catalog_session_security`. Both write RPCs and edit capabilities now require an active permanent Auth account and its live session. Deleted/soft-deleted or banned users, anonymous accounts, missing/malformed/wrong-user/revoked sessions and expired session end times are denied. Authorization runs before idempotency receipts, so an old successful command cannot bypass revocation.
- Preserved the existing write bodies except for their authorization condition. Table/property allowlists, validation, row revisions, serialization, atomic history and private attribution remain in place. No direct table writes were granted, RLS was not disabled and signup remains disabled.
- Revoked authenticated execution of the obsolete membership helper. Retained all historical membership records. Removed automatic future API-role grants in the unused `public` schema. Existing Supabase-managed schemas were preserved.
- Fixed the OpenAPI source and regenerated `data/swagger.json`: all 35 GETs and the read-only snapshot POST explicitly have no user-authentication requirement. Only the 48 write operations show authorization locks. The public project key is a normal header parameter for direct Data API reads, filled automatically; Authorize now offers only BearerAuth. The interceptor still strips user tokens from public reads.
- Added a frame guard before eager data/Auth initialization and application mounting. An embedded page does not start a session or render editing controls. It offers a safe link to open the app separately, without callback query/fragment tokens. Updated token-lifecycle copy in all four languages.

The revocation check follows [Supabase session guidance](https://supabase.com/docs/guides/auth/sessions#how-to-ensure-an-access-token-jwt-cannot-be-used-after-a-user-signs-out). The gateway still validates JWT signatures and expiry; this check is additional catalog authorization. It does not replace Auth's inactivity policies. Server-confirmed logout removes the session; local-only logout during an outage cannot promise server revocation.

## Hosted verification

The resulting schema matches the local migration chain: 19 catalog tables, 477 columns, 335 constraints, 48 triggers, 19 public SELECT policies and 26 functions across catalog/private schemas. Every catalog table has RLS. All 57 role/table combinations preserve SELECT and deny direct writes. The private schema is not exposed through PostgREST (406 / PGRST106). Public GET returned 200 without a user token; public Auth settings confirmed signup disabled.

Hashes of all 23 catalog/private tables matched exactly before and immediately after the security migration. The MCP payload used the MCP-owned transaction, including its ledger entry, and added exact checks of the three function definitions being replaced. It omitted only the source file's outer BEGIN/COMMIT. Source and payload hashes are recorded in [verification.json](2026-09-13-security-review/verification.json).

A real signed-in session on `http://localhost:8765/` opened edit mode, saved a temporary Archivgut comment, saw its history and restored the exact original value. Revision 4 → 5 → 6 and two additional public history/private attribution entries are expected. All other record values were preserved. Remaining catalog/private tables were unchanged; final catalog row count is 3,922, including 474 history rows. No user token or password was copied into the repository or chat.

## Verification performed

- Adversarial account/session authorization tests through both actual SQL RPCs, including replay after revocation and expired bans.
- Editing SQL, REST CRUD for all 16 resources, schema, access options, row order, system-of-record and existing-grant repair suites.
- API contract generation/check, 48 core checks and pinned vendor file hashes.
- Browser suites for public API requests/lock counts, actual REST handler + Swagger writes, authenticated editing, hostile catalog text, safe links, spreadsheet-formula handling, vector PDF, CSP, redirect refusal and cross-origin/sandboxed framing.
- The five pinned top-level browser packages returned no npm registry advisories at review time. This is not a complete transitive-dependency or penetration audit.

## Accepted design and operational follow-ups

The two authenticated SECURITY DEFINER RPC advisor warnings describe the intended, reviewed write boundary. Their empty search paths, explicit execution grants, property allowlists and internal authorization are necessary while direct writes remain denied. Four private RLS-without-policy notices intentionally describe deny-all tables. Permissive policies or invoker-only write functions would undermine the design rather than fix a vulnerability.

- `catalog-api` Edge GET still returned 404. Its handler is tested locally, but live standard REST routes require separate deployment. Browser editing uses SQL RPCs and is verified. No live Edge write was claimed.
- Leaked-password protection remains disabled. Current MCP tools cannot change Auth configuration; [Supabase documents this feature for Pro plans and above](https://supabase.com/docs/guides/auth/password-security). No plan purchase or settings change was attempted. Review this operational setting separately.
- GitHub Pages sent HSTS but no HTTP CSP, X-Frame-Options, nosniff or Referrer-Policy headers. Meta CSP/no-referrer and the new runtime frame guard help, but a hosting-level `frame-ancestors 'none'` policy remains preferable. Do not add an ineffective frame-ancestors meta directive. A host/proxy with response-header support is an operational follow-up.
- Account bans/deletion and session revocation were simulated in isolated SQL; real users were not disabled or logged out merely to test them. Backups, restore drills, SMTP and platform rate-limit configuration were not validated by this review. Observed SQL statement timeouts were 3 seconds for anon and 8 seconds for authenticated.

## Repository cleanup

Removed the superseded activation generator, its bundle-specific test and the two ignored generated SQL copies (`.temp/activate-editing.sql`, `.temp/seed.sql`). Updated the grant-repair test to use the maintained migration inventory. Git retains the historical activation implementation.

Retained all 13 numbered migrations: later migrations depend on the earlier schema/import and function definitions. Retained the 22 historical content scripts and the repair: existing recovery and regression tests depend on them. They are not pending operations. Removing applied SQL merely because it was applied would break reproducible setup. The hosted MCP ledger timestamps differ from source filenames; reconcile the verified history before adopting CLI `db push`, without replaying existing DDL or the import.
