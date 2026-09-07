# Code review — 7 September 2026

A senior-developer review of `prototype-oblique/` focused on bugs and on how fast the page loads and reacts. The load path now starts the catalog and dictionary requests before the application scripts have arrived, icons no longer cost a request each, and the page's menus, tree and tables update without re-rendering the whole page. Eighteen defects were fixed, the user-visible ones with regression checks. Startup on a fast connection is bandwidth- and script-bound rather than fetch-bound; interactions that used to re-render the page dropped from about 14 ms to 1–2 ms (≈90 ms to 5 ms on a throttled CPU).

## Scope and method

Reviewed the loader and transport (`boot.js`, `catalog.js`, `data.js`), routing and state (`router.js`, `app.js`), the views and detail pages, the relationship diagram, search, the sidebar, the field picker, the handbook, the API page, and the Excel and PDF export pipeline. Three focused passes (data/routing/state, views/detail/graph, exports) produced candidate findings; every finding below was reproduced in code or in the browser before it was changed, and the ones that could not be reproduced are listed under *Not changed*.

Performance was measured with the new [`tests/performance-load.cjs`](../../tests/performance-load.cjs): a local HTTP/2 server that behaves like GitHub Pages (gzip, `Cache-Control: max-age=600`, ETag/304) serves the checkout, and the SQL snapshot from the isolated PGlite database is answered same-origin at `/rest/v1/rpc/read_snapshot`, so no request is intercepted and the request waterfall is real. The script records a cold start with a sampling profile, a warm reload, twelve route changes and sixteen interactions (median of five, with DevTools style-recalculation and layout counts), and heap/node/listener counts over 150 route changes.

- Environment: headless Chromium 141 (Playwright 1.56.1), Node 22.22, Linux container, 1366 × 768 viewport. The snapshot has 141 catalog entries, 621 fields, 119 attributes and 107 relationships: 1,621,975 bytes of JSON, 155,560 bytes gzip-compressed (107,298 brotli).
- *Before* is commit `c78c1b8` measured from a git worktree with `--root`; *after* is this change. Both ran on the same machine in the same session.
- Two conditions: normal CPU without throttling, and 4× CPU throttling with the DevTools "3G" profile (300 ms round trip, 1.6 Mbit/s down). The throttled condition is a slow-device simulation, not a measured phone.
- Limits: the hosted Supabase project and the GitHub Pages site are not reachable from the review environment (proxy), so the real hosting stack (TLS handshake, CDN compression, Supabase response time) is not part of any number here. The local server does not compress `index.html`: compressed HTML made the throttled HTTP/2 connection deliver the scripts one at a time, which is a local artefact.

## Results

All times are milliseconds. "Ready" is the first rendered page heading after navigation; "data start" is when the first catalog request left the page.

### Cold start and reload

| Measurement | Before, normal | After, normal | Before, 4× CPU + 3G | After, 4× CPU + 3G |
| --- | ---: | ---: | ---: | ---: |
| First contentful paint | 72 | 80 | 1,500 | 1,616 |
| Data requests start | 170 | 73 | 1,529 | 1,609 |
| DOMContentLoaded | 171 | 220 | 1,537 | 1,656 |
| Ready | 336 | 316 | 3,415 | 3,355 |
| Requests | 48 | 38 | 48 | 38 |
| Longest task | 90 | 89 | 475 | 449 |
| Warm reload: ready | 126 | 109 | 1,912 | 1,844 |
| Warm reload: network requests | 5 of 48 | 5 of 38 | 5 of 48 | 5 of 38 |

Both versions transfer about 379 KB on a cold start (2.29 MB decoded); the snapshot is 156 KB of it, the scripts about 90 KB, and 186 KB return on a warm reload (the snapshot plus four revalidations). On the 3G profile the page is bandwidth-bound: every byte has to arrive over the same 1.6 Mbit/s link, and the catalog request cannot start before the two boot scripts and the stylesheets have (the browser executes a body script only after the preceding stylesheets), so it starts at about the same time as before and *ready* moves by 2 %. The early request pays off where latency and CPU dominate: with the 4G profile and 4× CPU (quick run, single observation) the data requests started at 490 ms instead of 3,118 ms and *ready* went from 4,099 ms to 3,873 ms; unthrottled, the requests start at 73 ms instead of 170 ms. The remaining startup task (≈450 ms at 4× CPU, 89 ms unthrottled) is the initial style/layout pass of the rendered page, catalog projection and JSON parsing; none of it is repeated work any more.


### Route changes

Render is the time from the hash change to the first mutation of `<main>`; recalculations and layouts are DevTools counts for the whole change.

| Route | Before, normal | After, normal | Before, 4× CPU | After, 4× CPU |
| --- | ---: | ---: | ---: | ---: |
| Business objects (tiles) | 11.6 (3/2) | 10.8 (3/2) | 63.2 (3/2) | 60.1 (3/2) |
| Business objects (table) | 18.0 (15/8) | 15.4 (4/3) | 83.8 (15/8) | 91.7 (4/3) |
| Data tables (table) | 17.1 (11/6) | 14.5 (4/3) | 78.1 (11/6) | 91.0 (4/3) |
| Reference data | 21.7 (11/6) | 19.0 (4/3) | 115.0 (11/6) | 104.4 (4/3) |
| Profile: Gebäude | 7.3 (3/2) | 6.4 (3/2) | 31.8 (3/2) | 32.3 (3/2) |
| Profile: attributes | 10.1 (5/3) | 8.8 (4/3) | 39.8 (5/3) | 47.4 (4/3) |
| Profile: relationships | 12.6 (10/8) | 10.9 (10/8) | 81.9 (10/8) | 55.5 (10/8) |
| Table profile: 39 fields | 14.9 (5/3) | 13.9 (4/3) | 78.1 (5/3) | 67.9 (4/3) |
| System profile | 6.7 (3/2) | 6.7 (3/2) | 32.8 (3/2) | 30.8 (3/2) |
| Search results | 13.1 (4/3) | 16.4 (4/3) | 76.0 (4/3) | 77.7 (4/3) |
| Handbook | 12.0 (3/3) | 12.3 (3/3) | 67.3 (3/3) | 56.6 (3/3) |
| Home | 8.4 (7/2) | 9.4 (4/2) | 46.8 (7/2) | 36.8 (4/2) |

Values are render ms (style recalculations/layouts). Table views no longer lay out once per table (8 → 3 layouts, 15 → 4 recalculations); the render times themselves are within run-to-run noise at 4× CPU (±10 %), where the cost is the page's own layout. Relationship profiles keep their 8 layouts: the diagram measures its viewport and every bubble group after mounting.

### Interactions

Sync is the handler's own time (median of five); layouts are forced layouts during the handler.

| Interaction | Before, normal | After, normal | Before, 4× CPU | After, 4× CPU |
| --- | ---: | ---: | ---: | ---: |
| Open export menu | 14.2 (7) | 1.2 (1) | 88.6 (7) | 4.9 (1) |
| Open grouping menu | 14.8 (7) | 1.3 (1) | 87.5 (7) | 4.9 (1) |
| Expand a tree branch | 14.4 (7) | 2.0 (1) | 95.9 (7) | 11.8 (1) |
| Collapse the sidebar | 13.8 (7) | 14.3 (3) | 94.0 (7) | 67.2 (3) |
| Switch to table view | 13.3 (7) | 12.6 (3) | 83.8 (7) | 60.8 (3) |
| Filter keystroke, business objects | 9.8 (6) | 7.0 (2) | 53.5 (6) | 36.1 (2) |
| Filter keystroke, 39 fields | 8.7 (2) | 8.3 (2) | 46.3 (2) | 41.3 (2) |
| Sort a column, 39 fields | 11.9 (2) | 12.3 (3) | 63.1 (2) | 60.6 (3) |
| Switch tab overview → attributes | 7.1 (2) | 7.3 (3) | 34.1 (2) | 34.1 (3) |
| Search suggestion keystroke | 6.0 (3) | 5.8 (3) | 32.4 (3) | 31.3 (3) |
| Diagram zoom | 0.3 (1) | 0.2 (1) | 1.5 (1) | 1.8 (1) |
| Diagram node selection | 3.5 (2) | 2.9 (2) | 15.9 (2) | 14.0 (2) |
| Open help popover | 0.7 (1) | 0.6 (1) | 3.6 (1) | 3.1 (1) |
| Language switch de → fr | 20.6 (11) | 16.1 (7) | 125.1 (11) | 85.0 (7) |
| Window resize (ResizeObserver) | 16.6 (2) | 17.0 (2) | 23.9 (2) | 21.3 (2) |
| Open print workspace | 235.1 (18) | 121.8 (9) | 1,172.5 (18) | 516.0 (9) |

Values are handler ms (forced layouts). Menus, tree branches and the print workspace are the large wins; interactions that legitimately re-render the page (view switch, sort, tab) keep their render cost but lost the per-table layouts.

Memory is unchanged: after 150 route changes with menus and popovers opened in between, the heap stays at 9 MB with 45 listeners in both versions, and the node count returns to about 1,100 (1,900 while the help popover is open).

## Findings and changes

### Load path

- **Data requests started only after every script had executed.** `app.init` ran on `DOMContentLoaded`, so the four UI files and the snapshot waited for 24 scripts to download and run. The new [`boot.js`](../../js/boot.js), the second script of the page, starts those five requests while the remaining scripts are still arriving; `data.load()` and `catalog.load()` take the responses over through `DK.boot.take()` and fall back to their own request. `boot.js` applies the same guards as the transport (HTTPS or loopback, no embedded credentials, publishable key only). Placing the two scripts in `<head>` before the stylesheets was measured and rejected: a synchronous script there stopped Chromium from preloading everything after it, and the 24 scripts loaded one round trip at a time (DOMContentLoaded 9.2 s instead of 1.5 s on the throttled profile). `async` would have made the configuration's availability a race. The head now only preconnects to the Supabase origin and preloads the latin font.
- **Every render requested icon files.** Icons are CSS masks, and a page render issued 12–25 `assets/icons/*.svg` requests after the first paint. [`scripts/build-icons.py`](../../scripts/build-icons.py) generates [`css/icons.css`](../../css/icons.css) with every icon as an inline `data:` mask (19 KB, ≈6 KB compressed); `main.css`, `graph.css` and the disclosure marker in `components.css` use it. A page now issues no icon requests.
- **UI files bypassed the HTTP cache.** `config.json`, `i18n.json`, `model.json` and `manual.json` were fetched with `cache: 'no-cache'`, which revalidates on every load even though the same deployment serves them with the same `max-age` as scripts and styles. They now use the normal cache policy; the snapshot request stays `no-store`.

### Rendering hot paths

- **A forced style recalculation and a second one on every render.** `sidebar.sync()` read five width tokens with `getComputedStyle` right after `<main>` had been replaced (a full-document recalculation, the top self-time in the startup profile) and then wrote `--ob-sidebar-width` on the root, invalidating every element's style again. The tokens are constants: [`sidebar.js`](../../js/sidebar.js) reads them once per window resize, and the property is written only when the width changes. The divider drag uses the limits captured at pointer-down instead of measuring per frame.
- **One forced layout per table.** `observeTables()` adapted each table region right after reading its width, so region *n* read a layout that region *n − 1* had just invalidated, and the `ResizeObserver`'s first notification repeated the whole pass. [`app.js`](../../js/app.js) measures all regions first, writes afterwards, and skips a region already adapted to the same width and font size. A table view went from 8 layouts and 15 recalculations per route change to 3 and 4.
- **Menus, tree branches and exports re-rendered the page.** Opening the export or grouping menu, expanding a tree branch and choosing an export replaced the entire `<main>` (≈14 ms, seven layouts). The two page menus now swap only their host element (`#actions-menu-host`, `#group-menu-host`) and a tree toggle re-renders `#sidebar-tree` (and the rail flyout's tree), both with the same focus restoration; the tree keeps its scroll offset.
- **Root custom properties were rewritten on every viewport event.** `syncVisualViewport()` set two root properties on each scroll/resize of the visual viewport, and `fitSearchSuggestions()` read `--ob-touch-target` from computed style on every call. Root properties are now written only when their value changes and the token is cached until the window changes.
- **A collator per comparison.** `ui.sortRows()`, the tree, search and group ordering constructed `Intl.Collator` per call, and `localeCompare(…, language, { numeric: true })` per comparison (measured at about 25× the cost of a reused compare). `ui.collator()` caches one collator per language and options; all comparisons use it.
- **Search examples computed three times per focus.** `search.examples()` runs three searches; the empty combobox called it from `canSuggest`, the view and the keyboard handler. The result is reused while scope, language and catalog are unchanged.
- **Duplicated header and footer writes.** `setLanguage()` rendered the header tools and footer, then `app.render()` rendered them again; the language switch dropped from 22 to 12 style recalculations.
- **Print workspace: twenty catalogs on opening.** `diagram.capture()` built every language × kind catalog eagerly (five kinds × four languages) with a freshly translated dictionary each, although a session touches one or two. Catalogs are captured on first access with one dictionary per language; opening the workspace went from 235 ms to 101 ms (1,173 ms to 516 ms at 4× CPU).
- **Wrapping measured growing line prefixes.** `diagram.wrap()` measured `line + ' ' + word` for every word, so each call was a cache miss on a longer string. The PDF measurer sums glyph advances (verified: whole-line widths equal the summed word widths to 10⁻¹⁴), so lines now accumulate per-word widths and every word is measured once. Splitting oversized identifiers works the same way per character.
- **The wheel listener delayed every page scroll.** A non-passive `wheel` listener on `document` made the browser wait for JavaScript on every scroll of every page, for a handler that only acts on Ctrl+wheel inside the diagram. It now belongs to the diagram viewport, which moves as a whole into fullscreen.
- **`swagger.json` was fetched and parsed on every API visit.** The 506 KB contract is parsed once and reused; a failed load is forgotten so a retry fetches again.

### Bugs fixed

| Where | Defect | Fix |
| --- | --- | --- |
| `views.js` tree | A branch that contained the current page could not be collapsed: its open state was `treeOpen[key] || contains(page)`, and the toggle wrote `!undefined`. | An explicit user choice wins over containment; the toggle derives the next state from the row's `aria-expanded`. |
| `app.js` routing | After following a link inside the page (tiles, tree, breadcrumbs) focus fell to `<body>`, so keyboard and screen-reader position was lost. | Focus that the new page removes moves to the content, like the drawer and search cases already did. |
| `app.js` focus | Escape inside the help popover dropped focus to `<body>`. | Popover content maps back to its help button, like menu items map to their menu button. |
| `app.js` events | An open menu survived clicks on other controls (view tabs, sorting, pagination, the field picker) and was re-rendered open. | Any other control closes the open menu first; menu items and the menu buttons keep managing their own menu. |
| `field-picker.js` | Clicking the open picker's trigger closed it (light dismiss) and re-opened it in the same click; keyboard activation re-opened it too. | A press on the trigger marks the dismissal so the following click does nothing; keyboard activation of the open trigger closes it. |
| `ui.highlight` | Search finds "gebaeude" in "Gebäude" and "strasse" in "Straße", but highlighting only folded diacritics, so those hits were not marked (or were marked at wrong offsets after length changes). | Highlighting folds character by character under both search foldings with an offset map and merges the ranges. |
| `router.js` | `history.replaceState` per filter keystroke had no guard; browsers rate-limit history writes (Safari throws after 100 in 30 s), which would break the page. | The write is guarded; the page state is authoritative and the URL catches up. |
| `search.js`, `views.js` | A catalog without domains could never search: submission required at least one selected domain. | No domains to choose from is not an empty selection. |
| `views.js`, `app.js` | The grouping preference of a domain profile (which lists business objects without grouping by default) was stored under the `domains` kind and leaked into the domains list. | `views.groupKey()` gives the domain profile its own key; neither the domains list nor the business-object list inherits it. |
| `data.js`, `manual.js`, `app.js` | A `manual.json` without chapters passed validation and then threw in `resolveChapter` and the scroll tracker. | The loader requires at least one chapter; the scroll tracker tolerates none. |
| `views.js`, `manual.js` | Four router-built `href`s were interpolated without escaping, and the handbook hard-coded `#/api`. | Escaped like every other attribute; the link uses the router. |
| `graph.js` | See *wheel listener* above. | — |
| `excel.js` | The English workbook named its history sheet `History`, a name Excel reserves; the workbook opened with a repair prompt. | The name is treated as taken (`History (2)`). |
| `excel.js` | In database mode the metadata sheet flattened the projection internals `_record` and `_relationships` (the raw SQL row and relationship index) into thousands of rows. | Keys starting with `_` are internal and excluded. |
| `diagram-export.js` | The print filter status counted the whole kind as *total* while matched/selected referred to the tree scope. | Total is the scope's entity count, as documented. |
| `diagram-export.js` | A remembered filter value without a counterpart in the new scope was re-prefixed on every scope change (`kind:facet:kind:facet:value…`). | An orphaned value keeps its identifier. |
| `diagram-export.js` | Download re-laid the preview out first, which reset the preview position. | The layout every settings change already produced is reused; layout runs only when none exists. |
| `api.js` | See *swagger.json* above. | — |

### Not changed

- **Touch pinch handling** in `graph.js` (a reported third-finger/one-finger-left defect) was not reproduced: a third pointer keeps the first two, and lifting any finger ends the pinch and cancels the drag.
- **The PDF manifest hash** depends on key order and the source URL, so two exports of the same content from different addresses hash differently. That is how the manifest is defined (it records where the export came from); a content-only hash would be a feature change.
- **Excel generation runs on the main thread** (`writeBuffer` is a 1.5 s task for the whole catalog). Moving ExcelJS into a worker is possible without a build step but is a larger change than this review; the export shows its progress state and blocks duplicate actions meanwhile.
- **The snapshot payload** (1.6 MB JSON, 155 KB gzip) is the largest transfer and a fixed cost of every cold load on a slow link, where startup is bandwidth-bound: on the 3G profile the page needs ≈380 KB in total and about 3 s regardless of request order. A leaner RPC (no `_record` mirrors, shorter keys) or brotli from the API gateway would cut it; both are data-model or hosting changes.
- **24 script files.** Concatenation would remove 22 requests, but the project deliberately has no build step; HTTP/2 makes the cost small (the scripts share one connection and are all preloaded).

## Validation

- [`core.test.cjs`](../../tests/core.test.cjs) gained checks for highlighting under both foldings, searching without domains, the grouping key and the collapsible tree branch; [`pdf-metrics.cjs`](../../tests/pdf-metrics.cjs) checks that wrapping measures words rather than line prefixes; [`functional.cjs`](../../tests/functional.cjs) checks menu closing, the field-picker trigger, the collapsible branch, focus after in-page navigation, that the early requests are consumed rather than repeated, and that a page issues no icon requests.
- All 59 suites in `tests/` pass on the final code: the core and PDF-metric checks, 29 browser suites with the JSON fixture, the eight Supabase-mode suites (contract, live API page, catalog browser, migration, RLS, schema, SQL and browser security) with the isolated database, the diagram and print-review suites against the SQL snapshot, and the eighteen import-operation suites. `responsive.cjs` caught one regression on the way: keying the domain profile's grouping under `objects` made its default (no grouping) leak into the business-object list, which is why the profile now has its own key.
- The measurement script itself was validated against both trees in the same session; its `--root` baseline is how the *before* columns above were produced.
