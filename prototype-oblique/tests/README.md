# Prototype checks

The runtime still has no build step or package installation requirement. The core checks need Node; browser checks additionally need Playwright and a browser. Verified with Node 24.16.0, Playwright 1.62.1 and Microsoft Edge on Windows.

From the repository root:

```powershell
node prototype-oblique/tests/core.test.cjs
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
node prototype-oblique/tests/fields.cjs
node prototype-oblique/tests/excel.cjs
node prototype-oblique/tests/sidebar.cjs
node prototype-oblique/tests/polish.cjs
node prototype-oblique/tests/contrast.cjs
node prototype-oblique/tests/mobile.cjs
```

Edge must already be installed for `msedge`. On other platforms, omit `PLAYWRIGHT_CHANNEL` to use Playwright's bundled Chromium; install it with `node <playwright-directory>/cli.js install chromium`. The module override is optional when Node can resolve `require('playwright')` normally.

| Suite | Purpose |
|---|---|
| `core.test.cjs` | Real and deliberately invalid fixtures; handbook chapter aliases, preference compatibility/failures, domain integrity, routing, loading, safe URLs, workbook round-trips, types/long text and sorting |
| `functional.cjs` | Handbook legacy links and navigation; hero/header search examples, domain/type filters, one result table, global pagination/sorting, mock answers and URLs; collection filtering, IME, export and history; shared domain tabs, legacy links, scoped export, metadata, focus, menus, API lifecycle/races/retry and load failures |
| `responsive.cjs` | Layout and interaction regression across widths, languages, records, table/card modes, pagination and touch behavior |
| `list-search.cjs` | Shared collection/detail search: complete row coverage, technical names/descriptions, pagination, IME/focus, empty states, URL restoration, responsive controls and full entity export |
| `graph.cjs` | Diagram/table defaults, zoom/pan/selection, group paging, fullscreen, keyboard, touch pan/pinch, dense data and print |
| `gwr.cjs` | Real GWR field coverage, project-domain/object mappings, system/tree navigation, field/code-list links, 119-value pagination, sorting, complete Excel workbooks, collection search and mobile layouts |
| `sap.cjs` | Curated SAP scope, source inventories, alphabetical tree, retired entries, architectural types, field search, documentation/comments, responsive layouts and complete Excel metadata |
| `gis.cjs` | GIS workbook scope, Bodenabdeckung type Gebäude, duplicate field identities, source statuses, pagination/search, mobile layouts and complete 275-field Excel export |
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

The contrast suite writes measurements and screenshots to `oblique-contrast-review` in the OS temporary directory. Keep `REPORT_ONLY` unset for verification; setting it to `1` records a baseline without contrast/focus assertions. See [the contrast review](../docs/contrast-review-2026-09-05.md) for thresholds, findings and measurement limitations.

The mobile suite writes to `oblique-mobile-review` in the same temporary directory and also supports `REPORT_ONLY=1` for baseline layout measurements. Its keyboard cases simulate visual-viewport changes; they do not operate an actual OS keyboard. See [the mobile review](../docs/mobile-responsive-review-2026-09-05.md).

See [the developer review](../docs/developer-review-2026-09-05.md) for findings and the limits of these checks, and [the responsive review](../docs/responsive-strategy.md) for the viewport matrix.
