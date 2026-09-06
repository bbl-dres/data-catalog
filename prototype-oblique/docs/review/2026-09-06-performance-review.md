# Performance review — 6 September 2026

The main bottleneck was SQL snapshot projection: every catalog record scanned every relationship. Snapshot-local indexes remove that growth pattern. Other changes reduce repeated translation allocations, sorting work, hidden row rendering and print-preview updates. No database migration, new runtime dependency or hosted catalog write is required.

## Scope and method

Reviewed bootstrap/transport, normalized data projection, lookups, translations, navigation, collections, detail profiles, search, relationship diagrams, the handbook, Swagger, Excel and the PDF workspace. Vendor internals were exercised through integration tests rather than rewritten.

Measurements use headless Microsoft Edge 152.0.4191.66, Node 24.16.0 and a 1600 × 1000 viewport on Windows. The isolated PGlite database applies the repository migrations; Playwright supplies its real SQL snapshot through a mocked Supabase response. The hosted project is not contacted. Measurements run separately from the browser regression suites.

- The fixture contains 141 top-level catalog entries, 621 physical fields, 119 business attributes and 107 relationships. Its serialized snapshot is 1,621,975 bytes before compression.
- Synchronous operation timings are medians after one warm-up: five samples for projection/render/capture, seven for PDF layouts, nine for search. The 10× stress fixture has three measured samples, preserving foreign-key connections while multiplying records and relationships.
- Startup is one cold browser observation per run, from navigation to the first rendered page heading. It includes local fetch/parse/validation/rendering; it is not a production-network or Web Vitals measurement.
- The 4× run uses DevTools CPU throttling. It is a slower-CPU simulation at the same viewport, not a measured phone. The 10× catalog projection runs only at normal CPU speed.
- DOM mutations and font-measurement calls provide deterministic work counts. Repeated modal cleanup uses forced garbage collection and DevTools heap/node/listener counters.

## Results

All times below are milliseconds. A dash means that scenario was not measured in that baseline.

| Measurement | Before 1× | After 1× | Before 4× CPU | After 4× CPU |
| --- | ---: | ---: | ---: | ---: |
| Startup to rendered heading (single observation) | 266.9 | 149.5 | 1,392.6 | 581.0 |
| Catalog projection | 124.8 | 6.0 | 780.3 | 33.5 |
| Catalog projection, 10× fixture | 12,614.8 | 48.4 | — | — |
| Four-query search pipeline | 6.4 | 2.7 | 40.3 | 16.8 |
| Empty-input examples | 3.8 | 1.6 | 27.6 | 12.4 |
| Multilingual print capture | 28.9 | 25.1 | 231.9 | 157.6 |
| Cold print opening (single observation) | 182.0 | 186.0 | 1,305.0 | 1,117.0 |
| Repeated default Grid layout | 2.0 | 0.4 | 12.2 | 2.9 |
| Repeated List layout | — | 0.8 | 52.7 | 9.6 |

The startup run at normal CPU speed no longer contains a task exceeding 50 ms. Slower-CPU startup still has long tasks; JSON processing, initial rendering and font/layout work remain on the main thread. The improvement in projection does not make the whole startup cost disappear.

Search timing covers four queries together, including global pagination and the cited answer demonstration. PDF layout timing measures repeated layout with an already-created font measurer, reflecting paper/layout changes within an open workspace; it excludes initial font loading and final PDF conversion.

Across 20 scroll events at an unchanged preview position, DOM mutations fell from **160 to 0**. The wrapping fixture produces the same six lines with **15 measurements instead of 26**. The eight-page List preview mounts three SVG pages around the viewport; remaining pages retain lightweight placeholders.

### Whole-app render inventory

These values measure synchronous `app.render()` execution, including any layout it forces. They do not include the later browser paint or asynchronous Swagger initialization. Small differences vary with browser scheduling and garbage collection; no across-the-board rendering speedup is claimed.

| View | Before 1× (ms) | After 1× (ms) | Final DOM nodes |
| --- | ---: | ---: | ---: |
| home | 2.8 | 2.9 | 588 |
| objects | 2.8 | 2.9 | 488 |
| tables | 4.9 | 5.4 | 875 |
| references | 4.0 | 4.0 | 731 |
| products | 1.5 | 1.5 | 289 |
| apis | 1.6 | 1.5 | 295 |
| system | 1.9 | 1.9 | 369 |
| fields | 4.5 | 5.0 | 922 |
| search | 4.3 | 4.1 | 690 |
| relations | 4.1 | 4.1 | 677 |
| manual | 3.7 | 3.2 | 565 |
| api | 2.5 | 2.9 | 754 |

The raw report includes all samples, 4× results, DOM counts and startup resource observations. Detail filtering and cold print opening also remain measured; these small workloads do not show a consistent desktop improvement. Their current behavior is retained.

## Implemented findings

| Priority | Finding | Resolution and preserved behavior |
| --- | --- | --- |
| High | Projection did an all-relationships scan for every field, value and entity; a 10× fixture took roughly 100× the time. | Build indexes for relationship endpoints, active outgoing links, quality assignments and service endpoints once per snapshot. Preserve original link order, rejected source evidence, active-link verification rules, retired-target filtering and broken-reference errors. Each projection owns fresh indexes. |
| Medium | Every localized SQL getter constructed a new four-language object, including during repeated sorting and search. | Extend the shared localization helper to read prefixed columns directly. Keep language/fallback selection dynamic and avoid persistent translated-value caches. |
| Medium | Profile tabs rendered every child row just to obtain the tab count; an active Rows tab built them twice. Table comparators repeatedly read whole row-value arrays. | Count children directly, reuse the row context, and derive sort values once per row. Stable ordering, missing-value placement, filtering before pagination and export ordering remain unchanged. |
| Medium | Question ranking and answer sorting recalculated an entity's score repeatedly inside comparators. | Cache scores only for the duration of each ranking operation and tokenize the question once. Filters, language changes, edited fixtures, relevance ordering and conservative answer selection stay fresh. |
| Medium | Wrapping a word onto a new PDF line measured every character even when the whole word fit. Repeated layouts recalculated identical font widths. | Test whether a word fits before splitting it. Use a workspace-owned, 5,000-entry FIFO width cache keyed by text, point size and weight. Oversized identifiers still split; cache eviction never changes measured values. |
| Medium | Unchanged preview scroll events rewrote disabled states and accessibility attributes. | Only write changed control attributes/content. Keep page-selection feedback and open-menu state synchronized, including direct page selection and disabled/retry states. |
| Validation | Repeated opens appeared to leak a detached dialog's SVG tree. | Heap retainers identified a Playwright readiness check returning an SVG node. Return a boolean instead, releasing the test-held handle. Repeated cleanups then stabilize; no production leak fix was needed. |

## Areas retained after review

| Area | Assessment |
| --- | --- |
| Loading and SQL transport | UI configuration loads in parallel with one complete snapshot request. Validation completes before publication, and failed reloads preserve prior data. Preserve this consistency contract. The snapshot RPC respects caller RLS. |
| Assets | PDF libraries/fonts, ExcelJS and Swagger load on demand; initial home loading requests none of these vendor bundles. Local fonts and icons are retained. No bundler/framework rewrite is justified by these measurements. |
| Navigation, tables and handbook | Existing lookups are indexed. Table pagination bounds displayed rows; container-size adaptation retains keyboard focus. Full page composition is still synchronous, but measured normal-CPU view renders are short. Avoid an unrelated virtual-DOM rewrite. |
| Relationship diagram | Bubble paging bounds visible group entries. Pan/zoom update the viewport transform. Preserve the bubble visualization and existing touch/keyboard behavior. |
| PDF lifecycle | Capture all configured languages once so changes of language, scope or selection use the same frozen catalog. Keep virtual page mounting, session-scoped listeners/observers, cancellation guards and per-page generation progress. |
| Excel | Keep lazy writer loading, immutable export plans, complete child records, typed values and duplicate-action protection. SQL-mode export and workbook read-back tests preserve metadata, including classification and personal-data values. |

### Limits and follow-up triggers

The 10× projection fixture demonstrates algorithmic scaling; it is not an end-to-end usability test of a 10× catalog. A full snapshot of that size is still costly to transfer, parse and retain. Before substantially increasing the catalog, measure the hosted compressed response, database execution, latency and representative devices. Consider scoped/server-side retrieval and search at that point, with an explicit version-consistency contract for exports.

Cold print opening still captures the multilingual catalog and loads/initializes fonts. Very large workbooks and final SVG-to-PDF conversion still consume main-thread time. Preserve cancellation and progress; consider a worker or incremental preparation only if measured document sizes require it. Do not silently omit rows or translations to reduce work.

Five close/reopen cycles are a useful regression check, not proof against every memory leak. After warm-up, DOM and listener counts stabilize. Some JavaScript heap growth remains from browser/runtime caches. The test now avoids retaining preview elements itself.

## Requested UI refinements included

- Remove PDF options from **Exportieren** and retain the separate **Drucken** entry point. Remove the unused browser-print action handler; Excel and the existing DCAT placeholder remain.
- Cap the header flag at 32 px on desktop, including full-width layouts, preserving its 40:44 aspect ratio.
- Stack **Kerndaten**, **Schutz und Datenschutz**, and **System** in the detail view. Move classification and personal-data handling into the middle section; keep System permanently visible. Responsibility stays beside this stack on wide screens and follows it on narrow screens. Translate headings into DE/FR/IT/EN, retain unknown-value placeholders, and remove the old metadata-disclosure state/styles/listener.

These are presentation changes; catalog data and generated metadata remain intact.

## Verification

- 36 core tests and the standalone PDF wrapping/cache checks passed.
- 6,847 SQL import, public-access and adapter checks passed, including indexed-link equivalence, rejected/retired targets, self-links, reload isolation and broken references.
- Functional, SQL-browser and field suites passed: search, filtering, pagination, translations, exports, responsibility, bubbles, failed loads and always-visible System metadata.
- 150 responsive layouts and 8,816 profile-render combinations passed, plus the 21-view design inventory. Header/section checks at 320, 1024, 1920 and 3840 px confirmed no horizontal overflow and the 32 px desktop flag.
- Print lifecycle review, 320 page/language/layout/grouping combinations, 64 additional section layouts and the dropdown/keyboard suite passed.
- Six generated PDFs (27 pages total) passed text/content, vector output, embedded-font, page-boundary and manifest-hash inspection.
- Normal/4× performance runs passed work-count and lifecycle assertions. After warm-up, the last four close cycles each had 2,842 nodes and 59 listeners; no cumulative DOM/listener growth was observed.
- JavaScript syntax checks and `git diff --check` passed.

## References

- [Raw before/after measurements](2026-09-06-performance-measurements.json)
- [Benchmark and regression commands](../../tests/README.md)
- [Performance harness](../../tests/performance.cjs), [PDF metric checks](../../tests/pdf-metrics.cjs), [SQL adapter checks](../../tests/catalog-migration.cjs)
- [Projection](../../js/catalog.js), [localization/sorting](../../js/ui.js), [search ranking](../../js/search.js), [detail sections](../../js/detail.js)
- [PDF metrics](../../js/pdf.js), [text wrapping](../../js/diagram.js), [preview controller](../../js/diagram-export.js), [shared select menus](../../js/select-menu.js)
- [Current architecture](../architecture.md), [behavior](../behavior.md), [design system](../design-system.md)
