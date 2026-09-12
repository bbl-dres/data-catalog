# Security review — 7 September 2026

## Scope and result

Reviewed the current `prototype-oblique` application: catalog loading/projection, HTML/SVG rendering, URL state and links, Supabase SQL permissions and RPCs, Swagger, Excel/PDF exports, browser policies, dependencies and deployment boundaries. Archived prototypes and unrelated repository applications were excluded.

One confirmed database-default permissions defect and three hardening gaps were addressed. The SQL fix is prepared and tested locally; it has **not been applied to the hosted project**. No evidence of an existing data breach was found, and this review is not a penetration-test certification. Public reads remain intentional, including comments, actors and history.

## Findings and changes

| ID | Priority / nature | Finding | Resolution |
| --- | --- | --- | --- |
| S1 | High — confirmed future-object exposure | Schema-local default revokes did not cancel global grants. A new catalog table could inherit anonymous SELECT and INSERT; new functions inherited EXECUTE. | Added the repeatable [security migration](../../supabase/migrations/20260907000000_catalog_security.sql), preserving existing public reads. |
| S2 | Medium — defense in depth | No browser CSP or explicit referrer policy. Escaped rendering was the primary injection defense. | Added an early meta CSP and no-referrer policy; documented host-only framing headers. |
| S3 | Low — connection consistency | Swagger did not share the loader's URL validation, and requests could follow redirects beyond the initially checked target. Swagger query overrides were only disabled by the library default. | Centralized connection validation, rejected URL credentials/non-HTTPS remote endpoints, refused redirects and explicitly disabled query configuration. |
| S4 | Low — dependency auditability | Vendored files had no shared integrity inventory; Swagger's notice did not identify its package version. | Verified exact published bytes, recorded versions/hashes and added a repeatable local/upstream verifier. No library version change was necessary for these fixes. |

### S1: reproduction and limits

The isolated database helper reproduces permissive global table defaults. Before the fix, creating a probe table and function in `catalog` produced:

| Anonymous privilege | Before | After |
| --- | --- | --- |
| SELECT on a new table without RLS | Allowed | Denied |
| INSERT on that table | Allowed | Denied |
| EXECUTE on a new function | Allowed | Denied |

Existing catalog tables already had explicit grants and RLS; the defect concerned later DDL. PostgreSQL adds schema-local default privileges to global ones, so a local revoke cannot remove a global grant. The fix changes future defaults for the `postgres` owner globally, and clears local grants in both catalog schemas. It leaves existing objects and other schemas' local defaults untouched. [PostgreSQL documentation](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)

`security-sql.cjs` reproduces the old behavior, adds both global and local grants, runs the migration twice, and verifies denial for future tables, sequences and functions under all three API roles. It also checks all 19 existing catalog tables still allow public reads, deny browser writes, retain RLS and keep private access/DDL inaccessible. Existing unrelated API grants are preserved. The historical seed bundle remains unchanged; existing projects apply the new migration separately.

### S2–S3: browser and request boundaries

The CSP permits local scripts, styles/fonts and the configured Supabase connection. It blocks inline/external scripts, external connections and base-URL changes. Existing inline styles are retained for layout compatibility; no `unsafe-eval` or inline-script permission was needed. JavaScript/data documentation links remain rejected by the existing link helper. The referrer policy protects navigations to external documentation.

Hostile SQL names/descriptions were exercised in seven route states covering profiles, attributes, relations, collection tables/tiles, search and the handbook. They remained text without creating injected elements or relying on a CSP violation to suppress execution. Deliberately inserting executable DOM nodes separately confirmed policy enforcement. A snapshot redirect was rejected before contacting its destination. Swagger ignored hostile `url`/`configUrl` parameters and retained all 20 read operations.

The new [deployment guide](../security.md) distinguishes the implemented meta policy from framing headers that must be installed on the web host. A meta policy cannot enforce `frame-ancestors`. [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)

### S4: dependency findings

| Component | Verified version | Review conclusion |
| --- | --- | --- |
| Swagger UI | 5.32.11 | Bundle and stylesheet match npm. Upstream release includes DOMPurify 3.4.12; URL overrides are explicitly off. [Release](https://github.com/swagger-api/swagger-ui/releases/tag/v5.32.11), [configuration advisory](https://github.com/swagger-api/swagger-ui/security/advisories/GHSA-qrmm-w75w-3wpx). |
| jsPDF | 4.2.1 | Bundle matches npm. The reviewed XMP injection advisory affects versions through 4.0.0 and is fixed from 4.1.0. [Advisory](https://github.com/parallax/jsPDF/security/advisories/GHSA-vm32-vv63-w422). |
| svg2pdf.js | 2.8.1 | Bundle matches npm; the app renders its own escaped SVG, with no uploaded SVG parser surface. |
| ExcelJS | 4.4.0 | Bundle matches npm. This app only writes browser workbooks, with literal cells. Upstream reports involving `tmp`/`uuid` require a separate assessment if Node/import features are introduced. [Upstream issue](https://github.com/exceljs/exceljs/issues/3055). |

The manifest is an integrity baseline, not proof that every bundled/transitive feature is vulnerability-free. No claim is made about unused parsers or future advisories.

## Other reviewed boundaries

- **Data rendering:** catalog text is escaped before HTML/SVG insertion. URL protocols are checked independently of escaping. Unknown/malformed route parameters are normalized or rejected; URLs do not become executable code or SQL.
- **Database authorization:** `read_snapshot()` is invoker-rights; browser roles have no write grants. The original member-policy tests still reject forged/anonymous identities and unauthorized changes. Static UI filters and classification labels are not security controls.
- **Exports:** actual XLSX output retained a formula-like attribute name as literal text, with no formula cells. Hostile labels did not create SVG scripts/events; an actual vector PDF downloaded under CSP. Export libraries load from local pinned assets.
- **Credentials:** a targeted scan of 47 JS/JSON/SQL/config files found no secret Supabase keys, password-bearing PostgreSQL URLs or private-key blocks. No `.env` files were found under the prototype. The publishable key is public configuration. This was not a full-history or source-document secret audit.
- **Availability and lifecycle:** request timeouts, invalid-snapshot rejection, retained prior data and lazy-library retry paths already exist. Functional checks passed for failures and navigation races. Public endpoint quotas/load testing remain outside this local review.
- **Publication:** repository archives, import captures and SQL are unnecessary web assets. The deployment guide lists the runtime assets to publish and keeps source history in the repository.

## Validation

All checks completed against local fixtures; no hosted write attempts or database mutations were made.

| Check | Result |
| --- | --- |
| `security-sql.cjs` | Old defect reproduced; future-object denial, preserved current access and repeatability passed. |
| `security-browser.cjs` | Hostile metadata/links, CSP enforcement, actual Excel/PDF export and redirect rejection passed. |
| `catalog-rls.cjs` | 289 checks passed. |
| `catalog-migration.cjs` | 6,847 migration, public-access and adapter checks passed. |
| `api-contract.cjs` | Generated SQL contract, 20 read operations and request guards passed; provenance regenerated for the new migration. |
| `api.cjs` | Actual Swagger requests, hostile query configuration, CSP compatibility, retry and mobile layouts passed. |
| `core.test.cjs` | 44 tests passed, including routing, safe links, reload integrity and literal workbook values. |
| `functional.cjs` | All navigation, search, menus, URL state, Swagger lifecycle and failure/retry checks passed. |
| `verify-vendor.py --upstream` | All five assets from four pinned npm packages matched their archive members and hashes. |

## Deployment follow-up

Run the new migration in Supabase SQL Editor as `postgres`; do not rerun the original schema or seed. For deployment, configure framing/nosniff headers and publish only runtime assets as described in [Security and deployment](../security.md). Hosted ACL drift, hosting headers, quotas, backups and future authenticated editing were not assessed by the local tests.
