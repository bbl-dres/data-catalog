# Security and deployment

The current catalog deliberately permits public metadata reads without login. This includes names, comments, actors and history. Classification labels and column visibility are presentation metadata, not access controls. Direct table writes remain disabled. The [editing migration](../supabase/migrations/20260912000000_catalog_editing.sql) adds a constrained, audited command API for every permanent signed-in user; public signup must be disabled for this internal-tool policy.

## Database permissions

Apply [20260907000000_catalog_security.sql](../supabase/migrations/20260907000000_catalog_security.sql) as `postgres` in the SQL Editor after the existing migrations. It is repeatable and changes no catalog records or grants on existing objects. See the [setup guide](../supabase/README.md) for the full sequence.

The migration removes global default table, sequence and function grants to `PUBLIC`, `anon`, `authenticated` and `service_role` for objects subsequently created by `postgres`. It also clears additive defaults in `catalog` and `catalog_private`. PostgreSQL cannot cancel global grants with a schema-local revoke. The global change applies across the database; existing grants and other schemas' local defaults remain unchanged. Objects created by another owner require that owner's defaults to be reviewed separately. [PostgreSQL default privileges](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)

Every new catalog table needs explicit reviewed SELECT grants and RLS policies; new RPCs need explicit EXECUTE grants. Keep `catalog_private` out of the Data API's exposed schemas. The current `read_snapshot()` uses invoker rights and retains public SELECT access. Never place database passwords, secret keys or service-role credentials in browser configuration.

`save_entry()` runs with a fixed empty search path, checks the Auth identity, restricts tables and properties, locks and compares revisions, and writes records/history/idempotency receipts in one transaction. Neither anonymous roles nor anonymous Auth accounts can save. Relationship, lineage and terminology edits are excluded. Public history names the edited record and uses a generic editor label; exact Auth user IDs and command IDs are held in private audit tables. See [activation and verification](edit-mode-implementation.md).

The later `api_write()` command extends REST access to 16 resource types, including actor, quality rule, relationship and lineage records. It retains the same permanent-user, property, revision, transaction and audit boundaries; system-managed fields and audit history remain protected. DELETE archives; no catalog record is physically removed. The `catalog-api` Edge Function uses only the publishable key and caller token. Public GET routes require its gateway JWT check to be disabled, but every write is checked with Auth and then re-authorized by the Data API/SQL. `If-Match` and per-command idempotency keys are required. Account tokens are revealed/copied on request, cleared from the dialog on close and never include refresh tokens. Their expiry is shown; logout does not promise immediate invalidation of copied access JWTs. See [REST setup and use](api.md).

## Browser policy

[index.html](../index.html) enforces a Content Security Policy before loading assets. Scripts and fonts come from the app's origin; network requests are limited to that origin and the configured Supabase project. Inline scripts, evaluation, plugins, embedded frames, form submissions and base-URL replacement are blocked. Inline styles remain allowed for existing dynamic layouts and vendor components; this is not a policy for untrusted HTML.

Change the explicit `connect-src` origin and the `<link rel="preconnect">` when changing [catalog-config.js](../js/catalog-config.js), including local Supabase development. Do not replace it with a wildcard. [boot.js](../js/boot.js) sends the snapshot request before the application scripts with the same guards as the transport: HTTPS (or HTTP loopback), no embedded credentials, only a publishable key; an invalid configuration sends nothing and fails in the loader. The shared connection validator requires HTTPS except for HTTP loopback development, rejects embedded credentials and only accepts publishable keys. Snapshot and Swagger requests omit cookies and refuse redirects; Swagger ignores URL-supplied configuration. Catalog text must still pass through the escaping/link helpers.

The page also sets `Referrer-Policy: no-referrer` through its meta equivalent, so external documentation links do not disclose the app's URL. Downloaded document links and source metadata are explicit content, independent of referrer policy.

## Hosting

For a deployment, serve `index.html`, `js/`, `css/`, `assets/`, the pinned vendor assets and runtime files `data/config.json`, `data/i18n.json`, `data/model.json`, `data/manual.json` and `data/swagger.json`. Keep repository metadata, SQL, tests, import tools, source captures and archived wireframes outside the published directory. Preserve them in the repository. The other catalog JSON files are offline fixtures and are unnecessary in Supabase mode.

Configure these response headers on the actual web host:

```http
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

The header policy adds framing protection to the page's existing meta policy. Alternatively, serve the full policy from `index.html` as a header with `frame-ancestors 'none'` appended. Framing protection cannot be supplied by a meta element. The local Python/test servers do not configure these headers; verify the deployed responses. [MDN framing policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)

Use HTTPS for deployment. Hosting, Supabase rate limits, backups and access administration remain operational responsibilities; repository tests do not validate those services. There is no database administration endpoint or file-upload feature in the browser app.

## Dependency verification

[vendor/manifest.json](../vendor/manifest.json) pins all four browser libraries and the Swagger stylesheet to SHA-256 file hashes and SHA-512 npm archive integrity values. Vendor Git attributes preserve those bytes across platform line-ending settings. Notices and licenses remain beside the assets. The verifier makes no repository changes:

```powershell
python prototype-oblique/scripts/verify-vendor.py
python prototype-oblique/scripts/verify-vendor.py --upstream
```

The second command downloads the exact archives into memory and compares their members byte for byte. Checksums detect unexpected changes, not vulnerabilities or a compromised upstream publisher. Review upstream advisories when updating a dependency or adding a new use of it, particularly import/parsing features.

## Validation

The [test guide](../tests/README.md) covers setup. Run `security-sql.cjs`, `security-browser.cjs`, `api-contract.cjs` and `api.cjs` for the dedicated boundaries, plus affected regression suites. Security checks use isolated PostgreSQL and intercepted browser responses; they do not probe writes against the hosted project. Findings and measured results are recorded in the [7 September security review](review/2026-09-07-security-review.md).
