# Prototype checks

The [catalog SQL suites](../supabase/README.md#validation) validate the schema, original member RLS and the public SQL Editor import in an isolated PostgreSQL engine. `catalog-browser.cjs` exercises the Supabase adapter against real database output with a mocked REST response. These checks do not need a hosted administrator credential.

The runtime still has no build step or package installation requirement. The core checks need Node; browser checks additionally need Playwright and a browser. Verified with Node 24.16.0, Playwright 1.62.1 and Microsoft Edge on Windows.

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
node prototype-oblique/tests/responsive.cjs
node prototype-oblique/tests/graph.cjs
node prototype-oblique/tests/gwr.cjs
node prototype-oblique/tests/sap.cjs
node prototype-oblique/tests/gis.cjs
node prototype-oblique/tests/av.cjs
node prototype-oblique/tests/fields.cjs
node prototype-oblique/tests/excel.cjs
node prototype-oblique/tests/loading.cjs
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
```

Edge must already be installed for `msedge`. On other platforms, omit `PLAYWRIGHT_CHANNEL` to use Playwright's bundled Chromium; install it with `node <playwright-directory>/cli.js install chromium`. The module override is optional when Node can resolve `require('playwright')` normally.

| Suite | Purpose |
|---|---|
| `performance.cjs` | Local SQL startup, 12 views, search, 10× projection fixture, PDF layouts, idle-scroll work and modal cleanup; JSON measurements in the OS temporary directory |
| `pdf-metrics.cjs` | Word/identifier/Unicode wrapping, text-width cache isolation, font/size keys and eviction; no browser required |
| `design-consistency.cjs` | Whole-app visual inventory of 21 routes/tab states; shared action states/contrast, panel alignment, disclosure markers, checkbox dimensions and mobile empty recovery |
| `print-menus.cjs` | Main-app/print dropdown appearance, four widths/languages, keyboard navigation/typeahead, nested/outside dismissal, custom zoom, disabled states, forced colors, simplified controls and the shared footer |
| `core.test.cjs` | Real and deliberately invalid fixtures; handbook chapter aliases, preference compatibility/failures, domain integrity, routing, loading, safe URLs, workbook round-trips, types/long text and sorting |
| `functional.cjs` | Handbook legacy links and navigation; hero/header search examples, domain/type filters, one result table, global pagination/sorting, mock answers and URLs; collection filtering, IME, export and history; shared domain tabs, legacy links, scoped export, metadata, focus, menus, API lifecycle/races/retry and load failures |
| `loading.cjs` | Centered startup/API loading states, mobile widths, reduced motion, high contrast, failure cleanup and retry; writes screenshots to the OS temporary directory |
| `diagram.cjs` | Tile sizing, complete PDF rows, Grid/List/column controls, document metadata/language, 320 physical layout combinations, scrolling/zoom, mobile controls, cancellation and asset retry |
| `diagram-filters.cjs` | Catalog scope tree, multi-value facets, applied/cancelled filters, selection memory, empty recovery, cross-type scope changes and frozen data |
| `print-review.cjs` | Queued scroll/language and close/reopen races, late export cancellation, source product/API coverage, escaped SVGs, classification, recovery, fixed columns and 64 additional section layouts |
| `print-tree.cjs` | Expanded object/table tree label widths and row alignment at 320–1600 px; independent mouse/keyboard selection and scope navigation |
| `print-tiles.cjs` | 200 summary-tile layouts across kinds/languages/paper sizes; complete descriptions, equal widths, row geometry, no detail rows, responsive icons, language/scope selection and actual PDFs (`python prototype-oblique/tests/diagram-pdf.py objects-tiles gwr-tiles`) |
| `print-mobile.cjs` | 18 catalog layouts and 32 print states: short/touch screens, preview height, scrolling, footer and popover geometry, translated header actions, keyboard fitting and retained focus/filters; `REPORT_ONLY=1` captures before measurements |
| `diagram-pdf.py` | Inspects generated PDFs with PyMuPDF: all GWR field names, page dimensions/bounds, embedded fonts, vector graphics, group headings, page numbering and the internal manifest hash |
| `responsive.cjs` | Layout and interaction regression across widths, languages, records, table/card modes, pagination and touch behavior |
| `list-search.cjs` | Shared collection/detail search: complete row coverage, technical names/descriptions, pagination, IME/focus, empty states, URL restoration, responsive controls and full entity export |
| `graph.cjs` | Diagram/table defaults, zoom/pan/selection, group paging, fullscreen, keyboard, touch pan/pinch, dense data and print |
| `gwr.cjs` | Real GWR field coverage, project-domain/object mappings, system/tree navigation, field/code-list links, 119-value pagination, sorting, complete Excel workbooks, collection search and mobile layouts |
| `sap.cjs` | Curated SAP scope, source inventories, alphabetical tree, retired entries, architectural types, field search, documentation/comments, responsive layouts and complete Excel metadata |
| `gis.cjs` | GIS workbook scope, Bodenabdeckung type Gebäude, duplicate field identities, source statuses, pagination/search, mobile layouts and complete 275-field Excel export |
| `av.cjs` | AV model/service navigation, field search, value-list links, hidden source facts, stable empty metadata, mobile layouts and complete 49-field Excel export |
| `fields.cjs` | Field links/profiles, localized labels and German fallback, stable technical names and URLs, consistent table fonts, organisation/person contacts and inheritance, breadcrumbs, both tree models, inherited history, code lists, invalid routes, keyboard and mobile navigation |
| `excel.cjs` | Lazy local writer, actual downloads, retry, mobile profile/empty-list exports, duplicate guard and scope preservation across navigation |
| `sidebar.cjs` | Live mouse resizing without DOM replacement, saved width, keyboard/reset/cancellation, collapse, responsive bounds, mobile/API exclusions and unavailable storage |
| `polish.cjs` | Long tile labels and equal widths, disabled hover states, shared selects/reading typography, high-contrast icons/focus/navigation and unscaled touch pager targets |
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

Run timings in isolation. `REPORT_ONLY=1` labels a baseline and skips deterministic work assertions; it does not restore older code. Reports are written after each stage to `oblique-diagram-export/performance-{before|after}-{1|4}x.json` in the OS temporary directory. Only 1× runs include the expensive 10× catalog fixture. Timings are diagnostic, with no machine-dependent pass threshold; unchanged-scroll mutations and excessive text measurements fail the after checks. CPU throttling is a desktop simulation, not a physical mobile-device result. See the [review](../docs/review/2026-09-06-performance-review.md) for the recorded comparison.

The diagram, diagram-filter and print-review suites write PDFs, test manifests and screenshots to `oblique-diagram-export` in the OS temporary directory. Run all three suites, then `python prototype-oblique/tests/diagram-pdf.py` to inspect the nine actual PDFs; this additional check needs PyMuPDF (`pip install pymupdf`). Set `DIAGRAM_SUPABASE=1` and `PGLITE_MODULE` as described in the Supabase validation guide to run the browser suites against the normalized SQL import through a mocked snapshot API. They do not contact or modify the hosted database.

PDF browser bundles and TTF fonts are committed with license and hash records. `python prototype-oblique/scripts/vendor-pdf.py` reproduces these pinned assets from the npm registry and font repository; network access is needed only when refreshing the vendored files.

Existing browser suites explicitly serve `provider: 'json'` from the local test server to retain their source-fixture checks. `catalog-browser.cjs` uses the shipped Supabase configuration and rejects any request for the legacy catalog JSON files. Neither path changes the production configuration.

The contrast suite writes measurements and screenshots to `oblique-contrast-review` in the OS temporary directory. Keep `REPORT_ONLY` unset for verification; setting it to `1` records a baseline without contrast/focus assertions. See [contrast guidance](../docs/design-system.md#contrast-and-accessibility) for thresholds and measurement limitations.

The mobile suite writes to `oblique-mobile-review` in the same temporary directory and also supports `REPORT_ONLY=1` for baseline layout measurements. Its keyboard cases simulate visual-viewport changes; they do not operate an actual OS keyboard. See [responsive guidance](../docs/design-system.md#responsive-layout).

See [architecture](../docs/architecture.md#testing) for verification scope and [responsive guidance](../docs/design-system.md#responsive-layout) for layout contracts.
