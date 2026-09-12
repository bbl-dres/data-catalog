# Prototype checks

The [catalog SQL suites](../supabase/README.md#validation) validate the schema, original member RLS and the public SQL Editor import in an isolated PostgreSQL engine. `catalog-schema.cjs` first checks the canonical model's dictionaries, nullability and complete table/column inventory against the current migration chain, then exercises the original schema migration independently. `catalog-browser.cjs` exercises the Supabase adapter against real database output with a mocked REST response, including both Excel export scopes, complete workbook row counts, mobile menu layout and navigation/duplicate guards during export. These checks do not need a hosted administrator credential.

The runtime still has no build step or package installation requirement. The core checks need Node; browser checks additionally need Playwright and a browser. Verified with Node 24.16.0, Playwright 1.62.1 and Microsoft Edge on Windows. The [API guide](../docs/api.md#verification) covers PGlite/JSON Schema contract checks and optional hosted read verification.

From the repository root:

```powershell
node prototype-oblique/tests/core.test.cjs
node prototype-oblique/tests/pdf-metrics.cjs
```

This uses Node's built-in test runner directly, without spawning test workers. `node --test prototype-oblique/tests/core.test.cjs` also works where spawning subprocesses is allowed.

For browser checks, point `PLAYWRIGHT_MODULE` at an installed Playwright package, or use a normal local `playwright` installation. Example isolated setup on Windows:

```powershell
$testTools = Join-Path $env:TEMP 'oblique-browser-tools'
npm install --prefix $testTools --no-save playwright@1.62.1
$env:PLAYWRIGHT_MODULE = Join-Path $testTools 'node_modules/playwright'
$env:PLAYWRIGHT_CHANNEL = 'msedge'
node prototype-oblique/tests/functional.cjs
node prototype-oblique/tests/list-search.cjs
node prototype-oblique/tests/visibility.cjs
node prototype-oblique/tests/responsive.cjs
node prototype-oblique/tests/laptop-layout.cjs
node prototype-oblique/tests/graph.cjs
node prototype-oblique/tests/gwr.cjs
node prototype-oblique/tests/sap.cjs
node prototype-oblique/tests/gis.cjs
node prototype-oblique/tests/av.cjs
node prototype-oblique/tests/fields.cjs
node prototype-oblique/tests/excel.cjs
node prototype-oblique/tests/loading.cjs
node prototype-oblique/tests/auth.cjs
node prototype-oblique/tests/editing-sql.cjs
node prototype-oblique/tests/editing.cjs
node prototype-oblique/tests/rest-crud.cjs
node prototype-oblique/tests/rest-api-browser.cjs
node prototype-oblique/tests/diagram.cjs
node prototype-oblique/tests/diagram-filters.cjs
node prototype-oblique/tests/print-review.cjs
node prototype-oblique/tests/print-tree.cjs
node prototype-oblique/tests/print-tiles.cjs
node prototype-oblique/tests/print-mobile.cjs
node prototype-oblique/tests/print-menus.cjs
node prototype-oblique/tests/design-consistency.cjs
node prototype-oblique/tests/sidebar.cjs
node prototype-oblique/tests/polish.cjs
node prototype-oblique/tests/contrast.cjs
node prototype-oblique/tests/mobile.cjs
node prototype-oblique/tests/design-review.cjs
```

Edge must already be installed for `msedge`. On other platforms, omit `PLAYWRIGHT_CHANNEL` to use Playwright's bundled Chromium; install it with `node <playwright-directory>/cli.js install chromium`. The module override is optional when Node can resolve `require('playwright')` normally.

| Suite | Purpose |
|---|---|
| `rest-crud.cjs` | All 16 CRUD resource lifecycles through the SQL command plus actual Edge HTTP handler: identities, revisions, retry keys, archival/restore, owned quality sets, rollback/audit, denial and public projection; requires PGlite |
| `rest-api-browser.cjs` | Account token reveal/hide/copy/expiry and mobile layout, real Swagger POST/PATCH/DELETE with the user's session through the actual handler and SQL; requires PGlite + Playwright |
| `editing-sql.cjs` | Actual migrations and authenticated edit commands: identity/property checks, atomic rollback, revisions/no-ops, retries, all profile types, owned endpoints/rows, archival and private attribution; requires PGlite |
| `editing.cjs` | Real SDK + local SQL saves: public browsing, administrator recovery, multilingual drafts, rows/order/archive, validation/discard, conflict/retry, reload failure, pending saves, session loss and mobile in DE/FR/IT/EN; requires PGlite + Playwright |
| `business-object-profiles.cjs` | Executes the standalone update with the real schema/import: 98 active definitions across seven profiles, SAP key components, Zone, property-set comments, four draft vocabularies, five measurement-subject links, preserved identities/GIS scope/change logs, result queries after commit, rollback previews, repeat runs and stale-data/collision refusal; requires PGlite |
| `business-object-labels.cjs` | Executes the German naming follow-up: exact Markdown/database text (through the later reviewed overlay), preserved IDs/references/property sets and change logs, rollback previews, result queries after commit, repeat runs and stale-data refusal; requires PGlite |
| `business-object-geometry.cjs` | Executes the 106-attribute synchronization after both prior operations: exact reviewed edits and untouched records, eight new core attributes, twelve measurement kinds and the m unit, retired Raumnutzung rule, unchanged building/parcel measurement scope, full doc↔database equivalence for all 106 definitions, runtime projection, rollback previews, repeat runs, stale-baseline and collision refusal; requires PGlite |
| `bbl-referenzdaten.cjs` | Executes the BBL reference-data update after all three prior operations: four captured SAP lists with 145 exact codes/Langtexte and truncation flags, Eigentumsart rename with confirmed SAP codes, Teilportfolio attribute bindings, eight GIS field bindings, untouched records, evidence-file equivalence, runtime projection, rollback previews, repeat runs, stale-baseline and collision refusal; requires PGlite |
| `kompakte-kommentare.cjs` | Executes the comment compaction after all four prior operations: exact compact comments and untouched records, preserved property sets/key roles/conditions/SAP codes/truncation flags, no boilerplate lines, retired history intact, runtime projection, rollback previews, repeat runs and stale-baseline refusal; requires PGlite |
| `dokumentenmanagement.cjs` | Executes the Dokumente Management update after all five prior operations: new domain with eleven exact objects, evidence equivalence with the datamodel Konzepte.json, deliberate exclusions, Zone-precedent governance, untouched records, runtime projection, rollback previews, repeat runs and collision refusal; requires PGlite |
| `architektonische-sicht.cjs` | Executes the six-object addition to the bau domain: exact records and priorities, Komponente source-name mapping, untouched records, runtime projection, rollback previews, repeat runs and collision refusal; requires PGlite |
| `dokumente-kuerzung.cjs` | Executes the review update: four validated same-day creations deleted with the identity guard disabled only for them and verified re-enabled, thirteen compact comments without source lines, reference/edit refusals, untouched records, runtime projection, previews and repeat runs; requires PGlite |
| `cafm-basisplan.cjs` | Executes the CAFM Basisplan addition: exact KBOB-IPB object and linked catalog PDF, domain comment counting eight objects, no invented priority, untouched records, runtime projection, previews, repeat runs and refusals; requires PGlite |
| `technische-anlage-ebkph.cjs` | Executes the Technische Anlage broadening: comment coverage of all twelve eBKP-H D groups against the source transcription, documented baseline after chain replay, exact broadened record with eBKP-H reference, untouched records, runtime projection, previews, repeat runs and refusals; requires PGlite |
| `kommentar-review.cjs` | Executes the catalog-wide comment review: all 56 pinned baselines after chain replay (including the reproduced hosted t-huelle rename), exact reviewed records with only the comment changed, removed XSD boilerplate relocated to the two service tables, no surviving source/meta lines, untouched records, runtime projection, previews, repeat runs and refusals; requires PGlite |
| `referenzdaten-namen.cjs` | Executes the naming convention: eight exact renames with prefix-first labels and no parentheses, the Eigentumsart domain assignment, the Gebäudeart comment follow-up, duplicate-label refusal, untouched records, runtime projection, previews, repeat runs and stale-baseline refusal; requires PGlite |
| `iso-laender.cjs` | Executes the ISO 3166-1 country list: 249 unique alpha-2 codes with German names (spot checks on neighbouring countries), exact list record with ISO authority, both attribute bindings and all eight field bindings, untouched records, runtime projection, previews, repeat runs, collision and stale-baseline refusal; requires PGlite |
| `datenprodukte-review.cjs` | Executes the product review: Open-Data retirement with preserved product attributes and unchanged governance, exact SAP Liegenschafteninventar rename with formats/frequency, untouched records, runtime projection incl. archived status, previews, repeat runs and refusals; requires PGlite |
| `iso-land-domain.cjs` | Executes the ISO 3166-1 Land domain assignment to Architektonische Sicht: documented baseline after chain replay, only the domain changes, untouched records, runtime projection, previews, repeat runs and refusals; requires PGlite |
| `referenzdaten-bereinigung.cjs` | Executes the cleanup: empty Eigentumsform retired with preserved import history, eCH Kanton rename with the verified 26-code eCH-0007 enumeration pinned, untouched records, runtime projection incl. archived status, previews, repeat runs and refusals; requires PGlite |
| `flaechenarten.cjs` | Executes the area-type update: SIA plot areas added (13 values), exact DIN 277 and IPMS lists with Bemessung anchor and the All-Buildings classes (no 3A/3B/3C), untouched records, runtime projection, previews, repeat runs, collision and stale-baseline refusal; requires PGlite |
| `crb-kostenelemente.cjs` | Executes the eBKP-H cost elements: all fourteen lists equal the parsed Verzeichnis evidence (71 Elementgruppen, 328 Elemente), Hauptgruppe D matches the screenshot transcription, untouched records, runtime projection, previews, repeat runs and refusals; requires PGlite |
| `kbob-dokumenttypen.cjs` | Executes the KBOB document types: 667 values equal the table-extraction evidence incl. all 610 descriptions and the Basisplan CAFM codes, Dokumenttyp anchor and catalog links, untouched records, runtime projection, previews, repeat runs and refusals; requires PGlite |
| `praezise-namen.cjs` | Executes the precise names: fourteen CRB eBKP-H list renames and the EGID (GWR)/EGRID (AV) attribute suffixes with pinned baselines, untouched records, runtime projection, previews, repeat runs and refusals; requires PGlite |
| `bodenbedeckung-profil.cjs` | Executes the Bodenbedeckung profile: exact eleven attribute records with their three reference-data bindings, Bezeichnung/Gültig ab retirements, thirteen active attributes, untouched records, runtime projection, previews, repeat runs and refusals; requires PGlite |
| `schluessel-review.cjs` | Executes the key-role review: eight corrections with pinned comments and is_identifier flags, at most one primary key per object, PK/FK/none projection through the extended catalog adapter, untouched records, previews, repeat runs and refusals; requires PGlite |
| `api-contract.cjs` / `api-schema.py` | Generated CRUD OpenAPI freshness, SQL columns/keys/nullability, local refs, credential/destination guards and full response JSON Schema validation; optional `API_LIVE_READ=1` verifies public hosted reads |
| `api.cjs` | Real Swagger contract and automatic publishable-key headers, table filters/projection/pagination, snapshot POST, retry, state retention and mobile widths using intercepted read responses |
| `performance.cjs` | Local SQL startup, 12 views, search, 10× projection fixture, PDF layouts, idle-scroll work and modal cleanup; JSON measurements in the OS temporary directory |
| `performance-load.cjs` | Load and reactivity under a real request waterfall: an HTTP/2 GitHub-Pages-like server (gzip, `max-age`, ETag), same-origin SQL snapshot, cold start with a sampling profile, warm reload, 12 route changes, 16 interactions with forced style/layout counts and memory over 150 route changes; optional CPU/network throttling and `--root` for a baseline checkout |
| `pdf-metrics.cjs` | Word/identifier/Unicode wrapping, text-width cache isolation, font/size keys and eviction; no browser required |
| `design-consistency.cjs` | Whole-app visual inventory of 21 routes/tab states; shared action states/contrast, panel alignment, disclosure markers, checkbox dimensions and mobile empty recovery |
| `design-review.cjs` | Diagnostic capture of 18 states from 320 px phones to 2560 px desktops (title row, controls, tables, profile, diagram, print workspace, drawer, footer, search, handbook, API) with screenshots and layout measurements in `oblique-design-review` in the OS temporary directory; compare two runs by their `measurements.json`. See the [mobile design review](../docs/review/2026-09-07-mobile-design-review.md) |
| `print-menus.cjs` | Main-app/print dropdown appearance, four widths/languages, keyboard navigation/typeahead, nested/outside dismissal, custom zoom, disabled states, forced colors, simplified controls and the shared footer |
| `core.test.cjs` | Real and deliberately invalid fixtures; handbook chapter aliases, preference compatibility/failures, domain integrity, routing, loading, safe URLs, workbook round-trips, types/long text and sorting |
| `security-sql.cjs` | Reproduces permissive future-object grants; tests the security migration, 19 public read-only tables, private/DDL denial, new table/sequence/function denial and preserved unrelated grants |
| `security-browser.cjs` | Hostile SQL metadata, unsafe links, literal Excel formulas, vector PDF under CSP, blocked executable content/connections/base changes and refused snapshot redirects; requires PGlite and Playwright |
| `routing.cjs` | Cold detail links/reloads, history restoration, strict sorts, canonical search scopes and detail pagination, handbook history/scroll/modified clicks, navigation-context links, outer hosting query preservation, hostile inputs and restored URL-to-print ordering. Uses the shared print fixture; `REPORT_ONLY=1` records failures without failing. Reports: `oblique-diagram-export/routing-{before,after}.json` in the OS temporary directory. |
| `functional.cjs` | Handbook legacy links/navigation, inline official sources and responsive native video playback; hero/header search examples, domain/type filters, one result table, global pagination/sorting, mock answers and URLs; collection filtering, IME, export and history; shared domain tabs, legacy links, scoped export, metadata, focus, menus, API lifecycle/races/retry and load failures |
| `loading.cjs` | Centered startup/API loading states, mobile widths, reduced motion, high contrast, failure cleanup and retry; writes screenshots to the OS temporary directory |
| `auth.cjs` | Real self-hosted Supabase SDK with mocked Auth endpoints: login failures/success, duplicate guard, persistent/expired sessions, cross-tab sign-out, PKCE reset, password change, invalid callbacks, keyboard and four-language mobile layout. Requires PGlite as configured in the [Supabase validation guide](../supabase/README.md#validation); never sends emails or modifies hosted accounts. |
| `diagram.cjs` | Tile sizing, complete PDF rows, column controls, document metadata/language, 400 physical layout combinations (including the retained grid renderer), scrolling/zoom, mobile controls, cancellation and asset retry |
| `print-details.cjs` | Responsibility grouping in seven collections/five print kinds; complete child lists, summary/context fidelity, multilingual pagination and downloaded PDFs |
| `print-contents.cjs` | Two-level TOC, individual entity destinations, preview mouse/keyboard navigation, unchanged catalog route, section headings and translated PDFs |
| `print-widths.cjs` | Actual font measurements for the reported A3 column-width issue; `REPORT_ONLY=1` records a baseline, otherwise verifies short values and downloads a PDF |
| `diagram-filters.cjs` | Catalog scope tree, immediate multi-value facets, retained keyboard focus and scroll, dismissal persistence, selection memory, empty recovery, cross-type scope changes and frozen data |
| `print-review.cjs` | Queued scroll/language and close/reopen races, late export cancellation, source product/API coverage, escaped SVGs, classification, recovery, fixed columns and 64 additional section layouts |
| `print-tree.cjs` | Expanded object/table tree label widths and row alignment at 320–1600 px; independent mouse/keyboard selection and scope navigation |
| `print-tiles.cjs` | 200 summary-tile layouts across kinds/languages/paper sizes; complete descriptions, equal widths, row geometry, no detail rows, responsive icons, language/scope selection and actual PDFs (`python prototype-oblique/tests/diagram-pdf.py objects-tiles gwr-tiles`) |
| `print-mobile.cjs` | 18 catalog layouts and 32 print states: short/touch screens, preview height, scrolling, footer and popover geometry, translated header actions, keyboard fitting and retained focus/filters; `REPORT_ONLY=1` captures before measurements |
| `diagram-pdf.py` | Inspects generated PDFs with PyMuPDF: all GWR field names, page dimensions/bounds, embedded fonts, vector graphics, group headings, page numbering and the internal manifest hash |
| `responsive.cjs` | Layout and interaction regression across widths, languages, records, sideways-scrolling tables (hint, edge shadows, focusable region, header sorting), pagination and touch behavior |
| `laptop-layout.cjs` | 204 local-fixture layouts across 390–1920 px, 360/480 px sidebars, German/French labels and exact wrap thresholds; measured 24/29 px panel/action gaps, single tab dividers, header/table bounds, responsibility placement, retained filter/focus and relationship navigation. Measurements and screenshots: `oblique-diagram-export` in the OS temporary directory. |
| `list-search.cjs` | Shared collection/detail search: complete row coverage, technical names/descriptions, pagination, IME/focus, empty states, URL restoration, responsive controls and full entity export |
| `visibility.cjs` | Seven entity kinds, immediate checkbox/reset interactions, retained focus/scroll, shared ordering, URL restoration, measured column widths, inherited web/print layouts, collection and detail List rows, mixed choices, parent/child synchronization, default counts, classification-label removal and 320–1600 px picker geometry; `python prototype-oblique/tests/diagram-pdf.py visibility-list visibility-entries` validates the downloaded PDFs |
| `graph.cjs` | Diagram/table defaults, zoom/pan/selection, group paging, fullscreen, keyboard, touch pan/pinch, dense data and print |
| `gwr.cjs` | Real GWR field coverage, project-domain/object mappings, system/tree navigation, field/code-list links, 119-value pagination, sorting, complete Excel workbooks, collection search and mobile layouts |
| `sap.cjs` | Curated SAP scope, source inventories, alphabetical tree, retired entries, architectural types, field search, documentation/comments, responsive layouts and complete Excel metadata |
| `gis.cjs` | GIS workbook scope, Bodenabdeckung type Gebäude, duplicate field identities, source statuses, pagination/search, mobile layouts and complete 275-field Excel export |
| `av.cjs` | AV model/service navigation, field search, value-list links, hidden source facts, stable empty metadata, mobile layouts and complete 49-field Excel export |
| `fields.cjs` | Field links/profiles, localized labels and German fallback, stable technical names and URLs, consistent table fonts, organisation/person contacts and inheritance, breadcrumbs, both tree models, inherited history, code lists, invalid routes, keyboard and mobile navigation |
| `excel.cjs` | Lazy local writer, actual downloads, retry, mobile profile/empty-list exports, duplicate guard and scope preservation across navigation |
| `sidebar.cjs` | Live mouse resizing without DOM replacement, saved width, keyboard/reset/cancellation, collapse, responsive bounds, mobile/API exclusions and unavailable storage |
| `polish.cjs` | Long tile labels and equal widths, disabled hover states, the pager select and scrolling system table list at 740 px, reading typography, high-contrast icons/focus/navigation and unscaled touch pager targets |
| `contrast.cjs` | Computed text/graphic contrast at phone, tablet and desktop widths; hover, API schemas/examples/dialog, input boundaries and keyboard focus |
| `mobile.cjs` | Short/mobile/touch layouts, API table scrolling, dialog/menu/help access, fullscreen scrolling and simulated keyboard viewport changes without losing state |
| `contrast-helpers.cjs` | Test-only sRGB relative luminance and alpha-composited foreground/background sampler |
| `excel-helpers.cjs` | Read actual downloaded XLSX files for content assertions using the pinned writer/reader |
| `browser-helpers.cjs` | Shared ephemeral loopback server and browser rendering synchronization |

Each browser script owns its server and browser and closes them on completion or failure. Fixture mutations and failed responses are confined to tests. No external server, catalog edits or app build is needed. No CI workflow is added to this repository's unrelated chat-worker deployment.

For the performance benchmark, configure Playwright and `PGLITE_MODULE` as above, then run:

```powershell
$env:DIAGRAM_SUPABASE = '1'
node prototype-oblique/tests/performance.cjs
$env:PERF_CPU_RATE = '4'
node prototype-oblique/tests/performance.cjs
```

The load measurement uses the same environment (`PGLITE_MODULE`; `--json` serves the fixture catalog instead). Compare a baseline checkout with `--root`, for example a git worktree of the previous commit:

```powershell
node prototype-oblique/tests/performance-load.cjs after
node prototype-oblique/tests/performance-load.cjs after-slow --cpu 4 --net 3g
node prototype-oblique/tests/performance-load.cjs before --root C:\path\to\previous\prototype-oblique
```

It writes `oblique-diagram-export/load-<label>.json` in the OS temporary directory and prints a summary. HTTP/2 needs `openssl` for a self-signed loopback certificate; without it, or with `--h1`, the server speaks HTTP/1.1. See the [code review](../docs/review/2026-09-07-code-review.md) for the recorded comparison.

Run timings in isolation. `REPORT_ONLY=1` labels a baseline and skips deterministic work assertions; it does not restore older code. Reports are written after each stage to `oblique-diagram-export/performance-{before|after}-{1|4}x.json` in the OS temporary directory. Only 1× runs include the expensive 10× catalog fixture. Timings are diagnostic, with no machine-dependent pass threshold; unchanged-scroll mutations and excessive text measurements fail the after checks. CPU throttling is a desktop simulation, not a physical mobile-device result. See the [review](../docs/review/2026-09-06-performance-review.md) for the recorded comparison.

The diagram, diagram-filter and print-review suites write PDFs, test manifests and screenshots to `oblique-diagram-export` in the OS temporary directory. Run all three suites, then `python prototype-oblique/tests/diagram-pdf.py` to inspect the nine actual PDFs; this additional check needs PyMuPDF (`pip install pymupdf`). Set `DIAGRAM_SUPABASE=1` and `PGLITE_MODULE` as described in the Supabase validation guide to run the browser suites against the normalized SQL import through a mocked snapshot API. They do not contact or modify the hosted database.

PDF browser bundles and TTF fonts are committed with license and hash records. `python prototype-oblique/scripts/vendor-pdf.py` reproduces these pinned assets from the npm registry and font repository; network access is needed only when refreshing the vendored files.

Existing browser suites explicitly serve `provider: 'json'` from the local test server to retain their source-fixture checks. `catalog-browser.cjs` uses the shipped Supabase configuration and rejects any request for the legacy catalog JSON files. Neither path changes the production configuration.

The contrast suite writes measurements and screenshots to `oblique-contrast-review` in the OS temporary directory. Keep `REPORT_ONLY` unset for verification; setting it to `1` records a baseline without contrast/focus assertions. See [contrast guidance](../docs/design-system.md#contrast-and-accessibility) for thresholds and measurement limitations.

The mobile suite writes to `oblique-mobile-review` in the same temporary directory and also supports `REPORT_ONLY=1` for baseline layout measurements. Its keyboard cases simulate visual-viewport changes; they do not operate an actual OS keyboard. See [responsive guidance](../docs/design-system.md#responsive-layout).

See [architecture](../docs/architecture.md#testing) for verification scope and [responsive guidance](../docs/design-system.md#responsive-layout) for layout contracts.
