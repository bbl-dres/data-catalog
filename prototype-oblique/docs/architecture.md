# Architecture

No build step and no framework. One HTML page, four stylesheets, application JavaScript modules, a public Supabase catalog and local UI configuration. Pinned self-hosted Swagger UI and ExcelJS load only when needed. See [database setup](../supabase/README.md) for the applied SQL Editor import and hosted verification.

The current page composition follows the [responsive layout](design-system.md#responsive-layout): a sticky header with navigation below the identity row above 960 px, shared 320 px default sidebar (resizable from 240 to 480 px) / 56 px icon rail, header search, and a mobile modal drawer. The [federal logo](design-system.md#federal-header-logo) sets the identity height to 56, 72 or 86 px; desktop navigation adds 45 px. The API reference uses only global navigation. The document scrolls normally; the footer remains at the page end.

## File structure

```
prototype-oblique/
├── index.html            Page shell: identity header and desktop nav row, <main id="main">, footer
├── css/
│   ├── tokens.css        Design tokens (custom properties) – see design-system.md
│   ├── components.css    Shared buttons, inputs/selects, icon actions, chips, disclosures and filled cards
│   ├── main.css          Fonts, reset, layouts and contextual variants; responsive, high-contrast and print rules
│   └── graph.css         Diagram workspace, controls and fullscreen presentation
├── js/
│   ├── ui.js             DK.ui     – translation, escaped markup, safe links, tables, sorting, downloads and small widgets
│   ├── preferences.js    DK.preferences – guarded access to existing browser preference keys
│   ├── catalog-config.js Public Supabase connection settings; explicit JSON mode for offline fixtures
│   ├── catalog.js        DK.catalog – REST transport and normalized SQL snapshot projection
│   ├── data.js           DK.data   – validates snapshots, lookups, grouping, relations, search, KPIs, history
│   ├── router.js         DK.router – hash parsing/building, navigate(), replaceParams(), pushParams()
│   ├── manual.js         DK.manual – handbook rendering, chapter names and legacy aliases
│   ├── search.js         DK.search – scope, global ordering/pagination, question fallback and cited AI-answer demo
│   ├── graph.js          DK.graph  – relationship layout, viewport, input and modal workspace
│   ├── views.js          DK.views  – page context, header, navigation, collections, search and composition
│   ├── detail.js         DK.detail – profile pages: facts, rows, relationship list/graph, history
│   ├── excel.js          DK.excel  – scoped workbook snapshots, worksheets, lazy ExcelJS loading and downloads
│   ├── sidebar.js        DK.sidebar – desktop divider input, width constraints and saved preference
│   ├── api.js            DK.api    – lazy Swagger loading, mounting and retry
│   └── app.js            DK.app    – bootstrap, transient state, event delegation, exports
├── data/                 Local UI configuration and frozen legacy catalog import inputs / test fixtures
├── supabase/             SQL migrations, SQL Editor seed, importer, identity manifest and setup guide
├── assets/
│   ├── swiss-logo-flag.svg  Swiss coat of arms and browser-tab icon
│   ├── swiss-logo-name.svg  Multilingual Confederation wordmark (reference asset; not rendered)
│   ├── icons/*.svg       25 Oblique icons and 3 local diagram controls, used as CSS masks
│   └── fonts/*.woff2     Noto Sans (latin, latin-ext) and Noto Sans Mono, variable weight
├── vendor/swagger-ui/    Swagger UI 5.32.11 browser assets and license notices
├── vendor/exceljs/       ExcelJS 4.4.0 browser bundle, license and integrity notice
├── tests/               Core, functional, responsive, diagram, GWR and field checks; see tests/README.md
├── scripts/             Scoped Python import and source-check tools
└── docs/                Maintained guides, import instructions and source evidence
```

The application scripts load in the order above; each is an IIFE that adds one object to the `window.DK` namespace. `ui.js` creates the namespace, data precedes its consumers, and `app.js` initializes last. Swagger UI is not in `index.html`: `api.js` inserts its stylesheet and bundle on the first visit of `#/api`. Likewise, `excel.js` loads the local ExcelJS bundle only on the first Excel export; failed loads can be retried.

Styles load in order: tokens, reusable components, application layouts/variants, diagram. `.ob-input` and `.ob-select` share native field styling; `.ob-icon-button` supplies quiet actions in inputs and notices; `.ob-card` supplies the filled surface, safe wrapping and interaction states for KPI cards and tiles. Layout classes retain their distinct padding, grids and content limits. See [the shared component guide](design-system.md#component-ownership) for ownership and regression checks.

## JavaScript strategy

Files are split by responsibility:

| File | Owns | Does not |
|---|---|---|
| `ui.js` | String helpers, safe link rendering, blob downloads, tiny widgets, table headers and locale-aware stable sorting, the i18n dictionary | Read app state |
| `catalog.js` | Public Supabase snapshot request, schema/reference validation, localized SQL-to-UI projection | Write catalog data or silently fall back to JSON |
| `data.js` | Snapshot validation and indexed lookups, grouping, domain membership by identifier, relations, search, KPIs and history; `validate()` logs dangling references after loading | Touch the DOM |
| `router.js` | URL ↔ route object, hrefs for entities and lists | Render |
| `preferences.js` | Stable browser keys and storage-failure handling | Choose UI defaults or render |
| `manual.js` | Handbook chapter rendering, navigation markup, canonical IDs and legacy aliases | Handle scrolling or mutate catalog content |
| `api.js` | Lazy Swagger loading, mount ownership and retries | Replace app navigation or catalog state |
| `search.js` | Scope options, retrieval, global sorting/pagination and deterministic answer excerpts | Touch the DOM or call a model |
| `views.js` | HTML for everything except the profile page body; `views.context()` derives titles, breadcrumbs, group options and actions from a route | Handle events |
| `detail.js` | Profile page tabs, facts, sortable row/relationship tables and diagram composition | Handle events |
| `graph.js` | Adaptive bubble layout, bounded group paging, zoom/pan/selection, keyboard/touch input, full-window dialog and viewport sizing | Change routes or mutate catalog data |
| `excel.js` | Immutable export plans, typed multi-sheet workbooks, local writer loading and downloads | Mutate catalog data or traverse every relationship recursively |
| `sidebar.js` | Pointer/keyboard resizing, CSS width and separator accessibility values, persisted preference and responsive limits | Re-render the tree or change mobile drawer behavior |
| `app.js` | State, render coordination with focus restoration, delegated events, export actions and handbook scroll tracking | Own handbook templates or vendor loading |

`views.page(route, state)` returns the application markup as a string. `app.render()` replaces `<main>` while preserving focus, sidebar/flyout scroll offsets and the current profile's metadata disclosure state. `replaceHtml()` identifies focused controls by `data-focus`, `id` or data attributes; disappearing menu items map back to their trigger. Repeated table controls include their group instance in `data-focus`. Route changes skip this control restoration and normally scroll to the top.

Some updates are local: search typing refreshes suggestions, help/language menus refresh their hosts, and graph panning changes a transform. A shared `ResizeObserver` switches each table between columns and cards according to its available width and moves focus between the appropriate sorting controls.

The desktop sidebar divider updates `--ob-sidebar-width` at most once per animation frame and keeps the tree and diagram DOM intact. Width limits come from tokens; the upper bound also reserves 600 px for content. `datenkatalog.sidebarWidth` stores the preferred width independently of collapse state. Narrower windows clamp the visible width without overwriting that preference. The focusable separator supports Left/Right (16 px), Home/End (limits) and Enter (reset); double-click also resets to 320 px. Escape, lost pointer capture, window blur and navigation cancel unfinished drags. The divider is absent when collapsed or on the API reference, and hidden in mobile drawer layouts.

The divider uses one 2 px neutral line: light on hover, darker for dragging or keyboard focus. Its focus style replaces the global box-shadow ring, whose outer edges otherwise produce three lines on the first drag after loading. A small grip with two 16 px vertical strokes stays near the center of the visible area below the header using sticky positioning, including on long pages. The grip is light grey at rest and darker on hover, focus or drag; its dimensions use component tokens. The mouse hit area stays 12 px wide; forced-color mode uses system colors for the grip and line.

Home and search results use the same `views.searchForm()` and `views.searchField()` combobox. Results initialize the query from the decoded `q` URL parameter. Their header magnifier scrolls to and focuses the page form; other routes render the combobox in the expandable header. Only one input/listbox exists at a time. Native form submission, suggestion picks and Enter use the shared routing and ranking. Navigating from search moves focus to destination content. The popup sits below the entire form, keeping the submit button accessible when controls stack, and its height follows the visible viewport, including keyboard-induced changes. JavaScript supplies available viewport space through a custom property; CSS applies the shared constraints. Page load does not autofocus it. Home and results share domain/type options. The cited answer demo aligns with the full width of the result tables. `search.js` owns their common scope and deterministic retrieval; see [global search](behavior.md#global-search).

Relationships default to the bubble diagram. The list toggle sits inside the `.ob-tabs` row, outside the semantic tablist, and switches to a shared sortable table. `graph.js` owns its canvas updates and a separate size observer. Wide layouts place circular groups around the central entity; narrow layouts stack readable bubbles. Each bubble shows up to six entries per page, or three on narrow canvases. The orbit accounts for circles, captions and paging controls to avoid overlap. The modal fullscreen workspace moves the existing shell into a native dialog and preserves it through background renders. Route changes close the dialog and restore focus to the destination content. See [relationship behavior](behavior.md#relationship-diagram).

Swagger owns the contents of its live `#swagger-ui` node. On updates within the API view, the node is reattached rather than replaced, retaining filter, expansion and input state. A `WeakSet` tracks pending/mounted hosts, the loader is shared, and disconnected hosts are ignored when loading completes. Bundle failure permits a subsequent render to retry. Leaving the API view discards its host; a later visit mounts a fresh view.

Every entity lookup tolerates a missing target: `data.nameOf()` falls back to the id, relation builders drop unresolved ids, and breadcrumbs skip missing containers. `data.validate()` reports such references once in the console.

The [GWR import](imports/gwr-import.md) supplies seven logical tables and explicit field-to-code-list references. Tables with these links add a Werteliste column; relationship builders resolve them in both directions, including entities without a mapped business object. An explicit domain supports those unmapped records. The GWR system diagram lists its tables. Curated documentation links retain the definition references; the frozen import evidence distinguishes the 5.0 catalog from the older code workbook. The Übersicht tree link omits the aggregate count.

Field profiles reuse the attribute-page composition and have Übersicht, Beziehungen and Verlauf Datentabelle. `data.field()` derives the profile from the projected field and parent context; `router.entityHref('fields', '<tableId>/<fieldId>')` preserves its address. Every field name and row in Felder links to that profile, including mobile cards; code-list links remain separate destinations. Breadcrumbs and the Datentabelle fact return to the parent's Felder tab. Both tree models highlight the parent table. SQL names project into `technicalName` and a localized `labels` map; the profile shows both in Kerndaten. Curated documentation links appear under Weitere Informationen. Raw source payloads stay in the frozen import evidence.

The loader fetches local UI configuration alongside one Supabase `catalog.read_snapshot()` request. The invoker-rights SQL function reads normalized records in one statement; it stores no JSON mirror and is not subject to collection row truncation. `catalog.js` projects records and direct references into the existing view shapes. Parent-scoped child identifiers preserve existing URLs. Catalog names/descriptions are resolved from stored language columns; display fallback never changes stored translations. Search, sorting and pagination remain in memory.

Before publishing a snapshot, the loader checks shapes, identities, embedded lists and duplicate IDs. Invalid input leaves a previously loaded snapshot intact and never silently switches to the archived JSON. The [core tests](../tests/core.test.cjs) and [migration/browser checks](../supabase/README.md#validation) cover these boundaries. HTML data is escaped; config/data links additionally use `ui.safeHref()` through `ui.link()`. Its label HTML must already be escaped. Excel writes literal text cells, including formula-like strings, and retains canonical SQL metadata and relationship verification details. Source-only payloads excluded from the target remain in the frozen import files and source captures.

## Routing

Repeated domain groups within Referenzdaten, Datenprodukte and API-Verzeichnis use section-scoped collection routes. The [side-tree investigation](behavior.md#navigation-and-collections) documents their destination, active-state and breadcrumb behaviour.

Domain profiles use Übersicht/Kacheln/Tabelle. Their browsing tabs reuse `views.collection()` with `ctx.kind = objects`, `ctx.domain` set to the domain and `ctx.isList = true`; the route and `ctx.entity` retain the domain identity. Übersicht displays metadata with `ctx.isList = false`. Export follows the visible collection or the full overview accordingly. See [domain browsing](behavior.md#navigation-and-collections) for navigation, defaults and legacy link handling.

Collection entry writes the resolved layout and grouping into the current history entry, so Back/Forward restores that page independently of later preference changes. Domain-scoped groups use independent disclosure keys. Collection links and breadcrumbs preserve an explicit navigation-model override; entering a domain or system profile opens its matching sidebar branch.

Collection rows and Excel plans use `data.collectionValues()` for the same column order and raw sort values. Detail tables and search use `ui.pageState()`, `ui.pageParams()` and the options-based `ui.pager()`; page-size defaults are serialized from the resolved state. `data.fieldSourceFacts()` translates imported source headings into English property names for profile and workbook consumers, while preserving the original metadata.

Collection pages have a local search in `.ob-collection-controls`, immediately before the grouping button. `?filter=…` scopes it to the current kind and survives view/group changes, reloads and browser history; the global search keeps its separate `q` state. Matching covers names, technical names, descriptions, identifiers, visible table metadata and domain/system names, with the same case/umlaut folding as global search. Filtering preserves canonical group order and the selected table sort. Counts, tiles, rows and Excel export all use the filtered context. Empty groups disappear, and matching groups start expanded without changing unfiltered disclosure state.

Typing replaces only the collection results and updates a persistent live result count, preserving the input node, caret and IME composition. Escape and the clear button reset the filter. Controls wrap according to content width and use the shared spacing, input and touch-target tokens. The search controls are omitted from print; filtered results remain printable.

The URL is the source of truth for everything that should be bookmarkable:

| Route | View |
|---|---|
| `#/` | Home |
| `#/objects`, `#/tables`, `#/refs`, `#/products`, `#/apis`, `#/domains`, `#/systems` | Section list. Params: `view=tiles|table`, `group=<option>`, `filter=<query>`; content collections also accept `domain=<id>` for exact domain membership |
| `#/objects/gebaeude` | Profile page. Params: `tab=overview|rows|relations|history`, `page=n`, `size=50|100|200` (50 is the default). The tab is kept in the hash during a session, but a fresh load opens Übersicht, except a bookmarked `tab=rows` search with `filter` |
| `#/domains/bau` | Domain overview and business-object collection. Params: `tab=overview|tiles|table`, `group`, `filter`. Defaults to the current collection layout and retains explicit tabs on reload. Legacy `tab=rows` opens Tabelle; `relations`/`history` open Übersicht |
| `#/objects/gebaeude/attributes/egid` | Attribute profile |
| `#/tables/t-gwr-gebaeude/fields/EGID` | Field profile; technical field IDs are case-sensitive. Fields inherit their table's history and keep the parent selected in the tree |
| `#/search?q=…` | One result table; optional domain/type filters, `ai=0`, `page`, `size=20|50|100`, and `sort=relevance|name|modified`. Defaults are omitted from the URL |
| `#/manual?ch=<chapter>` | Handbook; English chapter IDs, with old German IDs accepted as aliases |
| `#/api` | Swagger UI rendering the OpenAPI contract in `data/swagger.json` |
| any route `?nav=entity|container` | Overrides the tree model from `config.json` |

`hashchange` calls `app.onRoute()`, which resets transient state and renders. `router.replaceParams()` updates the current history entry for tabs, grouping, filters and normalization. `router.pushParams()` creates an entry for search pagination, page size and sorting. Both leave rendering to the caller. Navigation links are plain hash anchors; table rows carry `data-href` and navigate through delegation.

Code identifiers, module names, function names and comments are English. Translated UI content, catalog IDs, official GWR source headings and legacy compatibility strings retain their source spelling. Handbook rendering uses English chapter IDs; optional `legacyId` values in `manual.json` keep old links working. `preferences.js` retains the existing `datenkatalog.*` storage keys behind English preference names. Comments document contracts and non-obvious constraints, such as escaping, source preservation and DOM ownership; detailed behavior belongs in this guide and the feature documents.

## Transient state (`app.js`)

Held in memory, not in the URL: the UI language (also in `localStorage`), search query and suggestion index, open menu (`info`, `language`, `group`, `actions`), default view mode and grouping per section, table sort column/direction, collapsed list groups, expanded tree nodes, graph offset/zoom/tool/selection/group pages, relation list/diagram switch, active handbook chapter, the semantic tab carried between profiles, header-search expansion, sidebar expansion (also in local storage), and the currently open rail flyout. URL params override `mode` and `groupBy` when present.

## Events

A `change` listener handles the detail-row page-size selector. Sidebar/rail/search controls dispatch `toggle-sidebar`, `rail-section`, `close-flyout` and `toggle-search`; the mobile drawer keeps focus inside and makes the background inert. One `click` listener on `document` dispatches on `data-action` attributes (`skip`, `back-to-top`, `help-toggle`, `menu`, `set-language`, `set-group`, `set-view`, `sort-table`, `toggle-group`, `toggle-tree`, `open-navigation`, `close-navigation`, `open-overview`, `open-tree`, `set-tab`, `set-page`, `toggle-relation-view`, `export`, `clear-query`, `suggest-pick`, `open-results`, `chapter`, `not-available`, `toast-close`). Clicks with no action close open menus, except clicks on links to another route, which leave the close to the `hashchange` render. `input`, `keydown`, `focusin`, `focusout`, pointer and `scroll` listeners cover the search box, graph and handbook.

The `change` listener also handles card sorting. Native metadata `toggle` events update disclosure state. Menus support keyboard entry, arrows, Home/End, initial-letter navigation, Tab exit and Escape; drawer focus containment uses the active control after an inner menu closes.

Search ranks by `data.relevance()`: an exact name (100) beats a name prefix (90), a word prefix inside the name (80), any name substring (70), technical-name hits (50/40) and description hits (20/10). Suggestions keep compact type groups. Results use one table, ordered across all types before pagination by `search.page()`; the sort selector offers relevance, name and modification date. Matching tolerates umlaut spellings ("gebau", "gebaeu" both find "Gebäude") and hits are highlighted with `ui.highlight()`.

Catalog data tables use native buttons in their column headers and expose the active direction through `aria-sort`. Repeated headers in grouped L0 tables share one sort state. Detail rows are sorted before pagination, and changing their sort resets the pager to page 1. Handbook reference tables remain unsorted because their authored row order conveys meaning.

Column definitions also control presentation: `numeric: true` right-aligns the header and values and uses tabular digits; `compact: true` lets short metadata columns size to their content. Text headers and values share left alignment and the same padding. Numeric sort icons appear before the label so its right edge lines up with the numbers. Counts are numeric; codes, versions and dates remain text. Tables omit synthetic row numbers and use the standard body font, including technical field names and code values. Source positions remain in source metadata and Excel, outside profile overviews. Names use proportional widths, descriptions take the remaining space, and short status/count/date columns avoid expanding with the screen. Mobile cards keep labels left and numeric values right; print preserves the same value alignment.

## Configuration (`data/config.json`)

`admindirUrl` (base URL of the federal directory that the persons under Verantwortlich link to; the prototype has no person ids yet), `navModel` (`entity` or `container`), `app.languages` offered by the header switch, `app.language` as the default, `defaultGrouping` for business objects, `showTreeCounts`, `compactTables`, app name, organisation, version, badge, footer note, help and contact content, footer links (`route` for in-app hashes, `url` for external pages).

## How to extend

- **New entity type**: update the conceptual model, add a SQL migration with explicit grants/RLS and extend the snapshot/projection. Add its `kinds` entry in `model.json`, collection/detail presentation, relationship groups and breadcrumbs. Add legacy fixtures only when needed for tests.
- **New grouping option**: extend `GROUP_IDS`, `groupKey` and `groupOrder` in `data.js`; add a `group.<id>` label in `i18n.json`.
- **Languages**: `i18n.json` contains UI keys for DE/FR/IT/EN; PostgreSQL has explicit suffixed catalog text columns. `setLanguage()` swaps the dictionary and re-renders. Missing translations fall back to German, English, French and Italian, without storing fallback copies. Languages beyond these four require a schema and UI contract change.
- **Backend evolution**: extend the normalized schema, snapshot contract and adapter together. Server-side search and an audited edit API are separate future work; do not reintroduce JSON as a second live writer.
- **Excel export**: implemented by `DK.excel` (see [excel-export.md](behavior.md#excel-export)). DCAT export remains a placeholder in `doExport()`.

## Testing

See [tests/README.md](../tests/README.md) for the maintained suite inventory and reproducible setup. Core checks cover data integrity, routing, preferences and workbook values; browser suites cover functionality, imported catalogs, exports, responsive layout, contrast and input behavior. Physical-device and screen-reader checks remain separate.
