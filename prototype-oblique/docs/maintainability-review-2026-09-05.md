# Maintainability review — 5 September 2026

The prototype is ready for another user-review round with clearer module ownership and fewer duplicated contracts. This pass preserves its interface, catalog definitions, search behavior and export scope. The changes focus on English code identifiers, compact comments, shared logic and compatibility with existing links and preferences.

## Scope and method

Reviewed the ten original application modules, the HTML loading order, CSS integration, JSON boundaries, both Python data utilities, tests and current architecture guidance. Inspected names and comments, traced navigation and data ownership, compared the handbook payload with the previous Git snapshot, and ran core and real-browser regression suites against the refactored application.

Vendor distributions and archived wireframes retain their original contents. German catalog identifiers, official GWR source headings, translations, linguistic search terms and visible handbook text are data. They retain their spelling. Authored module names, variables, functions, renderer keys and comments use English. Legacy strings are isolated at compatibility boundaries.

## Findings and implemented recommendations

| Priority | Finding | Implemented change |
|---|---|---|
| Medium | Handbook dispatch used German keys such as `einleitung` and `gouvernanz`; scroll state and DOM IDs used the unexplained `hb` prefix. Renaming these directly would break bookmarked chapters. | Added `manual.js` with English renderer and chapter IDs. Renamed the matching JSON keys and DOM anchors. Optional `legacyId` values resolve existing chapter links to the canonical ID. Scroll state uses `chapterScrollLock` and `chapterScrollTimer`. |
| Medium | `views.js` combined page composition with all handbook templates, and `app.js` owned Swagger loading, retries and mounting. Those responsibilities had separate data and lifecycle needs. | Moved handbook rendering/navigation markup to `manual.js` and vendor loading/mount ownership to `api.js`. App coordination retains focus restoration, the live Swagger host and event delegation. The HTML shell explicitly loads the new modules before initialization. |
| Medium | Collection display sorting and Excel planning each reconstructed the same column values. The old collection renderer also retained flags and query-highlighting branches from grouped search results. | Added `data.collectionValues()` as the shared raw-column contract. Collection markup and workbook ordering consume it. Removed the obsolete `withCount`/`query` branches and the generic public row renderer; the collection renderer now expresses only the current collection schema. |
| Medium | Page-size defaults were repeated in event handlers, and search wrote browser history directly while other URL changes went through the router. | Added `ui.pageParams()` to serialize resolved pagination defaults. Added `router.pushParams()` beside `replaceParams()` using one URL writer. Pager options are named (`position`, `showRange`) instead of multiple positional booleans. |
| Low | Language, sidebar collapse and sidebar width repeated storage access and exception handling across modules. | Added `preferences.js` with English preference names and guarded reads/writes. Existing `datenkatalog.*` storage keys stay intact, so saved settings continue to work. Validation of widths and supported languages stays with the owning feature. |
| Low | Profile and workbook code separately accessed German source headings; one used a German property identifier directly. | Added `data.fieldSourceFacts()` to map the original headings to `registerAccess` and `masterData`. Both consumers use the adapter. Imported JSON and complete source documentation in Excel remain unchanged. |
| Low | Handbook scroll tracking duplicated the header offset as a hardcoded `24` and attempted to update a mobile-path element that is no longer rendered. | Read the chapter's CSS `scroll-margin-top`, with a one-pixel rounding allowance. Removed the stale DOM lookup. Click navigation and scroll tracking now use the same offset contract. |
| Low | Comments mixed UI-language terms with English, repeated obvious operations, and described obsolete search/header behavior. A route catalog was duplicated in the router header. | Translated the remaining code comments, shortened section markers and removed redundant descriptions. Kept compact explanations of escaping, imported data, pending mounts, focus/IME handling, graph geometry, scroll rounding and preference compatibility. Route documentation now lives in the architecture guide. |
| Low | Architecture guidance still described ten modules and per-group result sorting, making it unreliable for the current search implementation. | Updated module ownership, script order, shared adapters, pagination/history rules, search sorting and the handbook schema. Added this review to the README and expanded test documentation. |

## Resulting boundaries

- `views.js` derives page context and composes markup. `manual.js` renders handbook content; `detail.js` renders profiles. Templates receive data and already-escaped header markup, not event handlers.
- `app.js` coordinates state, navigation and rendering. `api.js` owns the vendor loader and mount tracking. The existing graph and sidebar controllers retain their DOM ownership.
- `data.js` owns catalog interpretation and shared row/source adapters. `search.js` owns scoped retrieval and global result ordering. Excel uses those contracts without changing records or their ordering.
- `router.js` owns history writes. `preferences.js` owns browser storage. UI defaults and feature-specific validation stay outside those adapters.

The application remains plain JavaScript with no build step or additional runtime dependency. The three new modules have concrete responsibilities; no general event bus, state framework, dependency container or speculative caching layer was introduced.

## Naming and comment conventions

Use English `camelCase` names for JavaScript functions and variables, English module filenames, and descriptive names for domain-sensitive operations. Existing abbreviations such as `ui`, `ctx`, `id`, `url`, `PK` and `FK` remain appropriate in their established contexts. Python utilities retain English `snake_case` functions and variables.

Use English keys for application-controlled JSON structures. Preserve external identifiers and imported source keys as data; translate them through a narrow adapter when code needs semantic property names. UI translations remain in `i18n.json`, and visible content stays in its source language. Startup fallback text can remain German because it must work when the translation file fails to load.

Keep a comment when it explains a non-obvious contract, boundary, compatibility decision or browser constraint. Prefer one or two lines next to the relevant code. Do not restate assignments, retain outdated implementation history, or duplicate a feature specification above a function. Detailed behavior and extension instructions belong in the documentation.

## Verification

- **26 core checks passed**, including new coverage for English handbook IDs and legacy aliases, preference-key compatibility and blocked storage. Existing checks cover global ranking, pagination, invalid input, source metadata, safe output and workbook round trips.
- **Functional browser suite passed**, including direct/reloaded legacy chapter URLs and navigation at desktop/phone widths, search and browser history, menu focus, retained Swagger state, concurrent loading, retry and leaving during a delayed load.
- **Responsive suite passed:** 150 layouts from 320 to 3840 px and 7,584 profile-render combinations, plus table/card transitions, pagination, Excel, print, drawer/orientation, keyboard navigation, touch targets and short-screen search. The render combinations are template checks, not independent user journeys.
- **GWR suite passed:** all seven field tables at 1600/390/320 px, field/code-list navigation, 119-value pagination, sorting, complete Excel export, domain relationships and collection search.
- **Sidebar suite passed:** mouse/keyboard resizing, DOM preservation, persistence, reset/cancellation, responsive limits, invalid or blocked storage, and API/mobile exclusions.
- All thirteen application modules and both Python utilities parse successfully. `git diff --check` passes.
- Every handbook title and content object exactly matches the previous snapshot after accounting for renamed keys and aliases. No catalog entity files were rewritten.

These checks use Node and headless Microsoft Edge. Physical-device, screen-reader and production-scale retrieval checks remain separate. The prototype still loads its catalog in memory; this review does not change that deployment model or make a throughput claim. Earlier dated reviews remain historical records of earlier implementations.
