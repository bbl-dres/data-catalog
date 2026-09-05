# Developer review — 5 September 2026

The main correctness issue was an empty domain profile despite populated navigation: `Architektonische Sicht` showed **0** business objects where the tree showed **9**. The fixes also address malformed routes, invalid data snapshots, lost interaction state, menu keyboard behavior, and link/export boundaries. The existing six-module structure remains suitable for this static prototype.

## Scope and approach

Reviewed the active prototype's six application scripts, HTML shell, CSS integration, JSON contracts, self-hosted Swagger integration, tests and documentation. The preserved wireframe copies, other prototypes, chat worker and sibling Oblique repository are outside this change.

Review topics: model correctness; routing and browser history; loading and error recovery; DOM ownership and asynchronous work; keyboard accessibility; HTML/URL and CSV output; dependency and network behavior; performance proportional to the dataset; regression coverage and maintainability.

Method: source inspection, assertions against the shipped JSON, deliberately malformed inputs, and real browser interactions in headless Edge. New tests exercise behavior and data consistency; the existing responsive suite covers layout. Initial core checks reproduced the domain mismatch and invalid navigation-model lookups. Browser checks exercise the final fixes, including controlled API loading failures and delays.

## Findings and implemented changes

Priority reflects impact on this prototype. Security findings concern data entering the renderer or export; the shipped catalog is fictional, locally authored content and no malicious record was found.

| # | Priority | Finding and impact | Implemented recommendation | Evidence |
|---|---|---|---|---|
| 1 | High | `membersOfDomain()` compared object identity. The router copies records to add `kind`, so domain rows, counts, relationships and CSV were empty. | Compare stable domain identifiers; a missing domain produces no members. | All domains checked with canonical and copied records. Live `#/domains/bau`: 9 rows and 9 exported records; relationships populated. |
| 2 | Medium | `?nav=__proto__`, `constructor` or `toString` selected inherited properties instead of navigation arrays. Extra path segments were silently ignored. | Require an own array property for navigation models, use dictionaries without prototypes for query parameters, and reject malformed encodings or unsupported route shapes. | Invalid navigation overrides render the default tree. `#/objects/areal/typo` is a not-found page. Encoded identifiers still round-trip. |
| 3 | Medium | Invalid entity collections silently became empty arrays; duplicate IDs overwrote lookup entries while remaining in list counts. Reloading published data before completing checks. | Validate a complete snapshot before publishing collections and indexes. Require collection arrays, record identities/names and usable embedded lists; reject duplicate entity and object-attribute IDs. Missing optional lists remain empty. | Mutated fixtures are rejected with file/record locations. A rejected reload retains the previous catalog. Shipped references remain valid. |
| 4 | Medium | Startup errors used translation keys before the dictionary had loaded. JSON parse errors lacked the source filename. | Provide an independent German startup message, include file-specific JSON errors and retain HTTP status details. | Controlled HTTP 503 and malformed JSON show understandable load errors. |
| 5 | Medium | A full render replaced native `<details>` and collapsed metadata when opening search/export or changing navigation. | Keep metadata disclosure state for the current profile, capture native toggles, restore it during renders and reset it for a different record. | Open metadata survives search, export and sidebar changes. A different profile starts closed. |
| 6 | Medium | Search, drawer and viewport changes replaced `#swagger-ui` and mounted a new Swagger component, losing filter and expanded-operation state. | Preserve the live host during updates to the current API view. Track pending/mounted hosts with a `WeakSet` to avoid duplicate mounts. Keep lazy loading, stale-host checks and retry after bundle failure. | Same DOM node, filter and expansion survive updates. Leaving during a delayed load does not mount on another view. Repeated renders mount once; an initial 503 can recover. Leaving and re-entering API starts a fresh view. |
| 7 | Medium | Menus declared ARIA menu semantics without keyboard entry or arrow navigation. Desktop sort buttons in repeated groups had indistinguishable focus selectors. | Focus menu items on entry; support arrows, Home/End, initial-letter navigation, Tab exit and Escape. Label menus, preserve drawer focus containment, and identify sortable headers by group instance and column. | Keyboard interaction on desktop and inside the phone drawer; sorting a later group retains focus in that group. |
| 8 | Medium, conditional on input | Escaping HTML does not reject an executable URL scheme. Some model-derived icon/tone attributes were also interpolated without escaping. | Introduce `safeHref()` and a shared link renderer for data/config destinations. Allow HTTP(S), relative/hash links, mail and telephone links; reject control characters and other schemes. Invalid destinations render readable text. Escape icon/tone and language attributes. | Tests cover mixed-case and whitespace-obfuscated `javascript:`, `data:` and `vbscript:` destinations, attribute-breaking quotes, valid catalog links and contact URLs. |
| 9 | Medium, conditional on input | CSV delimiter quoting did not prevent formula-like strings being interpreted by spreadsheet software. | Centralize CSV cell serialization. Prefix formula-like text with an apostrophe and quote it; preserve numeric values, normal text, delimiters, quotes, line breaks and the existing BOM. | Tests include formula markers, leading whitespace/control characters, full-width markers, embedded delimiters/quotes and negative numbers. Actual domain CSV is downloaded and checked. |
| 10 | Low | Historical review/architecture documentation claimed there were no checked-in tests and described the old header. Rendering-only coverage missed the domain data error. | Check in core and functional regression suites, share the browser server helper, document setup, and update current architecture/data-contract guidance. Mark the previous review as historical. | Reproducible commands in [tests/README.md](../tests/README.md); current documentation describes both header modes and data/state boundaries. |

## Engineering decisions

### Data and routing

The loader now publishes collections and their indexes together after structural checks. Optional absent lists are normalized, while an authored list of the wrong type is an error. Dangling cross-references continue to be diagnosed by `data.validate()` and handled by the UI. This is targeted validation of the runtime's collection/identity assumptions; it is not a complete JSON Schema for every configuration, handbook, date or classification field.

The established tab policy remains: a fresh load starts at Übersicht; navigation between profiles can retain a supported semantic tab. Invalid pagination is already bounded to available pages and supported page sizes. Sorting remains stable and happens before pagination; CSV exports the full dataset represented by the current list/profile.

### Rendering, performance and accessibility

The small application has useful separation between data, routes, pure view templates and event handling. A framework migration or a global state library would add complexity without fixing these specific defects. Retaining one DOM node for Swagger gives its component ownership of its internal state while the surrounding page can still use string rendering. Native metadata disclosure state is explicitly represented in the app state.

The responsive table observer, semantic table/card labels, shared sorting state, vertical home sections, type/status in Kerndaten, equal fact-row spacing, single-line table headers and API view without the catalog tree remain in place. Desktop navigation stays below the identity header. The 960 px drawer breakpoint and 101/56 px header heights remain unchanged.

Search and grouping scan the in-memory catalog and full-page rendering rebuilds application markup. That remains reasonable for this dataset; this review makes no throughput claim for thousands of records. It does not add speculative caching or virtualization. A backend-backed catalog should be profiled with representative data before choosing server paging, caching or virtualization.

Menu behavior follows the [WAI-ARIA menu-button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/). Browser keyboard tests do not replace screen-reader or physical-device testing.

### Output boundaries and dependencies

The earlier review's statement that HTML escaping alone establishes security was too broad. URL validation and attribute encoding address different parsing contexts, as described in the [OWASP XSS prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html). `ui.link()` accepts **already escaped** label HTML; callers must continue to escape data before composing that markup. Relative links are allowed for the static deployment. This is a scheme check, not a domain allowlist or an external-site trust assessment.

CSV text protection deliberately changes formula-like exported strings by adding an apostrophe. It reduces formula interpretation on import, but CSV has no explicit cell types and behavior can change when spreadsheets save and reopen files. Do not describe it as universally safe or lossless for machine consumers. [OWASP documents these limitations](https://owasp.org/www-community/attacks/CSV_Injection). A future typed spreadsheet export or raw JSON export would need its own explicit format contract; the placeholder export options are unchanged.

Runtime dependencies remain local: fonts, SVG masks and the existing pinned Swagger UI 5.32.11 files with license notices. Swagger loads only for the API page, with external validation and submit methods disabled. The responsive run reported no resource errors. No vendor upgrade, full transitive dependency/CVE audit, deployment-header audit, authentication review or backend authorization review was performed; those require a deployment and production data contract beyond this static prototype.

## Verification

Environment: Node 24.16.0, Playwright 1.62.1, headless Microsoft Edge on Windows.

- **11 core tests**: domain membership/relations, navigation overrides, malformed routes, shipped data, malformed collections, duplicate IDs, missing lists, dangling references, atomic reload, URL/attribute output, CSV and stable sorting.
- **9 browser scenarios**: actual domain rows/CSV/relations, metadata persistence, grouped sort focus, keyboard menus including the drawer, Swagger state preservation, invalid navigation, delayed load/navigation race, failed-bundle retry, HTTP/JSON startup errors.
- **150 responsive layouts** from 320–3840 px and **3,904 profile render combinations**, plus translated layouts and existing sorting, pagination, print, touch, navigation and focus checks. The render combinations verify template output, not 3,904 independent user journeys.
- Syntax checks for all six application scripts and `git diff --check`.

All listed checks passed on 5 September 2026. Commands and setup are in [tests/README.md](../tests/README.md). Browser tests use an ephemeral loopback server and temporary browser-only fixtures; catalog JSON and archived wireframes are not modified.

Remaining verification limits: physical iOS/Android devices, WebKit/Firefox, screen readers, actual spreadsheet applications and production-scale datasets were not exercised. These are follow-up validation contexts, not claims established by the automated checks.
