# Whole-prototype code review — 13 September 2026

The review found correctness bugs in the REST write boundary, required-rule handling, compound record identifiers and asynchronous editor work. It also found two avoidable costs that grow with the number of child rows. The implemented changes retain the existing framework-free application and its public browsing / authenticated editing model.

This report is in `docs/wireframes` as requested. [data-model.md](../data-model.md) remains the canonical schema and alias specification.

## Scope and method

Reviewed the active application modules, page shell and CSS responsibilities, Supabase migration chain and Edge Function, OpenAPI/alias generators, import tooling boundaries, dependency manifest, documentation and test coverage. Existing uncommitted work was preserved. Historical wireframes, source evidence, archived SQL operations and vendored library internals were inventoried rather than rewritten.

| Area | Review focus |
|---|---|
| Startup, transport and Auth | Failure ownership, deadlines, credential destinations, session restoration, callback URL cleanup, optional-login impact on public browsing. |
| Catalog, schema and REST | Exact values, archival semantics, ownership, reference integrity, revisions, idempotency, authorization and audit preservation. |
| Router, application and views | Compound identities, navigation guards, asynchronous completions, focus restoration, search/pagination and repeated rendering work. |
| Editor | Draft mutation, dirty detection, required rules, duplicate starts, account changes, validation, atomic saves and retry. |
| Search, graph, menus and sidebar | Shared behavior, scope consistency, bounded rendering, listeners/observers and cleanup. |
| Print/PDF and Excel | Shared child projection, canonical labels, frozen exports, failure/retry, cancellation and actual output. |
| Tooling, CSS and documentation | Existing shared primitives, generated-file checks, dependency integrity, script/module responsibilities and deployment instructions. |

The database checks execute the repository migrations in isolated PGlite. Browser checks use Edge/Playwright with local fixtures and intercepted Auth/SQL transport. No hosted credentials, account changes, mail sends or production writes were used. Findings below distinguish code defects from scaling tradeoffs; this is not a hosted penetration test or a claim that every possible defect has been found.

## Findings and implemented changes

| ID | Priority | Finding and concrete trigger | Resolution |
|---|---|---|---|
| R1 | High — data loss | Sending `comparison_value: 9007199254740993.1234567890123456789` through the REST Edge Function forwarded `9007199254740994` to SQL. Ordinary `JSON.parse`/`JSON.stringify` introduced binary floating-point rounding. | [REST handler](../../supabase/functions/catalog-api/index.ts) preserves the original numeric token as a decimal string. An older runtime without source-aware parsing rejects numeric thresholds with a request to send a string. Existing decimal-string inputs continue to work. |
| R2 | High — incorrect saved meaning | Archiving a required quality rule through REST left the browser and editor treating it as active. The SQL checkbox implementation could also reuse the archived default rule and report success without an active requirement. | [Catalog projection](../../js/catalog.js) and [editor](../../js/editor.js) share the active-rule predicate. The [new migration](../../supabase/migrations/20260913030000_catalog_required_rules.sql) excludes archived rules, selects an active editor rule or creates a replacement, and retains historical assignments. It never silently revives a shared archived rule. |
| R3 | Medium — data loss | Invalid UTF-8 request bytes were decoded with replacement characters and accepted as a different catalog value. | A bounded REST body reader uses fatal UTF-8 decoding and returns `400 invalid_utf8` before contacting Auth or SQL. The existing 2 MiB limit is retained. |
| R4 | Medium — broken navigation | A legal owning identifier containing `/` was confused with the parent/child separator. Its field or attribute links could not resolve. Percent signs made decoding ambiguous as well. | [Compound identity helpers](../../js/data.js) escape and split the owning identifier once. Routing, row links, direct child lookups and inherited history use that same representation. Stored identifiers and REST UUIDs are unchanged. |
| R5 | Medium — startup failure handling | Boot requests could reject before `data.js` attached a handler. UI-configuration fetches also had no deadline, and an early snapshot deadline started only when consumed. | [resources.js](../../js/resources.js) applies a deadline through response-body consumption. [boot.js](../../js/boot.js) immediately observes failures while retaining the original rejected promise for the normal error display. Early parsed results are consumed once. |
| R6 | Medium — recovery and duplication | Swagger could render after its stylesheet failed, and three vendor loaders implemented different retry/timeout cleanup. A failed or late asset event could leave inconsistent behavior. | Script/style loading is now one retryable, single-flight helper. Swagger waits for both CSS and JS; PDF and Excel retain their ordered dependencies and readiness checks. Failed assets are removed and retries do not duplicate successful assets. |
| R7 | Medium — editor responsiveness | Every input event diffed every property of every draft row, twice. Typing in a profile with many children paid for unrelated rows. | Each row retains its current patch. Input, reorder and archive operations refresh only affected patches; dirty totals and save payloads reuse them. No catalog data is cached across reloads. |
| R8 | Medium — quadratic work | Detail rows, print snapshots and Excel already had each child object, but called a lookup that scanned the owning list again for every row. | Shared `attributeEntity` / `fieldEntity` functions enrich known rows directly. Direct-link lookups use the same functions after their single lookup. This removes the repeated scans while keeping inheritance and labels consistent. |
| R9 | Medium — asynchronous races | Two quick Edit clicks could start concurrent reloads. An older capability check for account A could overwrite a newer result after A → B → A account changes. | One pending editor opening is allowed. Route/account checks run before and after refresh; capability responses carry a generation and only the latest result can enable saving. |
| R10 | Medium — canonical-label drift | The value-specification editor still used the product `Format` label for `valueType`. The earlier alias test verified the selected mapping, so it did not detect a mapping to the wrong semantic field. | The form now uses the canonical `Value type / Wertetyp` binding, with a field-specific regression assertion. |
| R11 | Low — startup sequencing | The Supabase SDK was a parser-blocking script even for the offline JSON fixture. Public browsing waited for its download/execution before later application scripts. | Auth loads its SDK asynchronously through the shared asset helper in Supabase mode. All callback codes/tokens are removed from the page URL before that wait. Session restoration and invitation/recovery handling remain automatic; public rendering proceeds independently. |
| R12 | Low — maintenance drift | Search matching and hit highlighting independently defined the same umlaut/diacritic folding rules. | Both use one frozen set of folding functions in [ui.js](../../js/ui.js). Existing matching and highlighting behavior is retained. |
| R13 | Low — verification portability | The schema/document check recognized zero dictionaries after a normal Windows CRLF write, despite valid Markdown. Some browser tests assumed one dialog, one API authorization scheme and an already-expanded schema section. | Normalize line endings before parsing. Update browser selectors to the intended dialog/input, request a fresh specification for the contact-link fixture, expand schemas before inspecting them and settle resize rendering before measuring overflow. |
| R14 | Medium — accessibility | REST PATCH and DELETE method badges still used vendor colors with white-text contrast of 1.60:1 and 3.63:1. The previous overrides covered GET/POST only. | Use the existing success/error color tokens in [main.css](../../css/main.css): PATCH now measures 5.48:1 and DELETE 8.36:1. The contrast suite explicitly checks every supported method. |

The decimal repair uses the standardized JSON reviver source text, which exists specifically to avoid precision loss after parsing a number. [MDN JSON.parse documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).

## Performance evidence

Measurements use Node 24 / local Edge on Windows. They are local diagnostics, not promises about hosted response times or a physical phone.

The [child-row benchmark](../../tests/review-performance.cjs) compares the removed lookup loop with direct enrichment in the same process and on the same SQL-derived records. Both produce the complete detail-row data. Median of three measured runs after warm-up:

| Rows in one table | Previous lookup loop | Direct enrichment | Identifier reads, before → after |
|---:|---:|---:|---:|
| 250 | 5.09 ms | 3.10 ms | 64,000 → 1,250 |
| 1,000 | 40.03 ms | 12.31 ms | 1,006,000 → 5,000 |
| 3,000 | 268.65 ms | 37.75 ms | 9,018,000 → 15,000 |

The deterministic check enforces linear identifier reads; it does not fail on machine-dependent elapsed times. This measures the row-building path, not complete XLSX compression or PDF pagination.

A real browser with 1,000 draft children performed **54 JSON serializations in 0.6 ms** for one root-field input event. The regression bounds serialization work, verifies one unsaved change and confirms that duplicate Edit clicks start one capability request and one reload.

Whole-page measurements use `performance-load.cjs review-20260913-before --h1 --quick` and the matching `review-20260913-after` run, with no other test suite running. Both use the same 1.71 MB SQL snapshot over a local compressed HTTP/1.1 server:

| Measurement | Before | After |
|---|---:|---:|
| Cold catalog ready | 204 ms | 188 ms |
| Warm catalog ready | 65 ms | 62 ms |
| Cold requests | 43 | 44 |
| Cold bytes transferred | 471,236 | 471,984 |
| Three route renders | 4.6–7.5 ms | 4.5–6.7 ms |

These are single diagnostic captures, not a statistically established startup improvement. The new shared resource module adds one small request. Fifteen interaction samples showed no material slowdown; warm startup had no long task. The deterministic delayed-SDK browser check separately proves that public content becomes usable while the SDK is still downloading. Measurements exclude hosted TLS/CDN latency and database execution time.

Raw timing reports are written to `oblique-review-performance.json` and `oblique-diagram-export/{load-review-20260913-before.json,load-review-20260913-after.json,review-editor-performance.json}` in the OS temporary directory.

## Complexity decisions

- Keep controllers separate: `app.js`, `editor.js`, `graph.js` and `diagram-export.js` own different state and cancellation lifetimes. Combining them into a generic controller would hide their invariants. The shared module extracts resource mechanics, not application state.
- Keep API `api_write` and editor `save_entry` as distinct command boundaries. The editor saves an owner plus curated children atomically; REST updates one allowed resource. Their common ordering, revision and database guards already live below those boundaries. Historical SQL copies remain immutable migration evidence.
- Keep the existing shared presentation definitions, tables, pagination, menus, field picker and CSS components. The new work fixes actual duplication around them instead of introducing a framework, build pipeline or generic schema-driven UI.
- Keep the existing global SQL write serialization for this five-user internal tool. It protects cross-record validation and command receipts. If measured write contention becomes material, review lock scope together with those invariants; narrowing locks alone is unsafe.
- Keep full snapshot loading for now: current search, public browsing and frozen exports require the catalog. Server pagination/worker-based export should follow a measured size threshold, not a speculative rewrite. Browser export still holds the selected workbook/document in memory.
- Maintain canonical labels in Markdown first. Reusable modules do not make French/Italian aliases canonical, turn source-code tokens into translated values, or fill documented feature-coverage gaps.

## Verification and deployment

New regression suites:

- [resources.cjs](../../tests/resources.cjs): early rejection handling, deadline through body parsing, duplicate requests, late callbacks, missing globals, stylesheet failure/retry and immediate callback URL cleanup while the Auth SDK is pending.
- [review-regressions.cjs](../../tests/review-regressions.cjs): actual SQL archival/checkbox behavior, exact REST number forwarding and rejection of malformed UTF-8. Before the SQL/HTTP fixes, three reproductions failed: no active saved rule, rounded decimal and accepted invalid bytes.
- [review-browser.cjs](../../tests/review-browser.cjs): public rendering during a delayed Auth SDK download, stylesheet failure/recovery, duplicate edit opening, large-draft input work and stale capability responses.
- [review-performance.cjs](../../tests/review-performance.cjs): linear child enrichment and diagnostic timings.
- Existing core/alias suites gain compound-identity and semantic label checks.

Passed local verification:

- Core: 48 tests; resource failures/retry, malformed request and required-rule reproductions.
- Database/contracts: 11 migrations; 17 dictionaries, 474 columns and 148 CHECK constraints; 84 documented read/write operations; 2,003 table records and the complete snapshot validate against the generated schemas. Editing SQL, all 16 REST resource lifecycles, future-object privilege guards and five child-ordering families pass.
- Canonical labels: 159 EN/DE bindings, 474 SQL/API column comments, curated edit forms, print snapshots and actual downloaded workbook headers.
- Real-browser Auth, editor, REST, SQL catalog, row-order, routing, functional, Excel, security and review regressions. Auth includes persistent/expired sessions, cross-tab sign-out, invitation/recovery callbacks and restricted storage.
- Responsive: 150 layouts and 8,816 profile combinations; graph mouse/keyboard/touch behavior and bounded rendering; 20 mobile/touch states and all visibility choices.
- Print: 400 layout/language/group combinations, 64 further section combinations, preview races, cancellation and failed-asset recovery. Ten downloaded PDFs (43 pages) independently pass source/preview text, vector graphics, fonts, geometry, links and manifest checks.
- Vendored package integrity and JavaScript syntax. All changes pass `git diff --check`.

The final contrast run passes 50 views, 1,496 text/graphic samples, all four method badges and five keyboard-focus states, with no browser errors. Isolated load results are recorded above. No failures remain in the listed checks; historical import-operation suites were not replayed as part of this review.

The required-rule migration and revised `catalog-api` Edge Function require hosted activation. Apply migrations in order, then redeploy the function through the existing [activation guide](../api.md#activation). The frontend must be served with the new `resources.js` script. No hosted changes were made in this review.

All five vendored packages match the committed local integrity manifest. This does not claim a current upstream vulnerability audit. Deployment headers, disabled public signup for the internal-user editing model, actual provider delivery and hosted migration state remain deployment checks; they cannot be certified from the local repository.
