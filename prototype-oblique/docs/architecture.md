# Architecture

No build step and no framework. One HTML page, four stylesheets, ten application JavaScript files, static JSON data, and pinned self-hosted Swagger UI and ExcelJS distributions loaded only when needed.

The current page composition implements [compact layout 1b](compact-layout.md) and the [responsive strategy](responsive-strategy.md): a sticky header with navigation below the identity row above 960 px, shared 320 px default sidebar (resizable from 240 to 480 px) / 56 px icon rail, header search, and a mobile modal drawer. The [federal logo](design-system.md#federal-header-logo) sets the identity height to 56, 72 or 86 px; desktop navigation adds 45 px. The API reference uses only global navigation. The document scrolls normally; the footer remains at the page end.

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
│   ├── data.js           DK.data   – loads and validates JSON, lookups, grouping, relations, search, KPIs, history
│   ├── router.js         DK.router – hash parsing/building, navigate(), replaceParams()
│   ├── search.js         DK.search – scope, question fallback and cited AI-answer demo
│   ├── graph.js          DK.graph  – relationship layout, viewport, input and modal workspace
│   ├── views.js          DK.views  – header, nav, breadcrumb, toolbar, tree, home, lists, search, manual, API page
│   ├── detail.js         DK.detail – profile pages: facts, rows, relationship list/graph, history
│   ├── excel.js          DK.excel  – scoped workbook snapshots, worksheets, lazy ExcelJS loading and downloads
│   ├── sidebar.js        DK.sidebar – desktop divider input, width constraints and saved preference
│   └── app.js            DK.app    – bootstrap, transient state, event delegation, exports
├── data/                 Static JSON – see data-model.md
├── assets/
│   ├── swiss-logo-flag.svg  Swiss coat of arms and browser-tab icon
│   ├── swiss-logo-name.svg  Multilingual Confederation wordmark (reference asset; not rendered)
│   ├── icons/*.svg       25 Oblique icons and 3 local diagram controls, used as CSS masks
│   └── fonts/*.woff2     Noto Sans (latin, latin-ext) and Noto Sans Mono, variable weight
├── vendor/swagger-ui/    Swagger UI 5.32.11 browser assets and license notices
├── vendor/exceljs/       ExcelJS 4.4.0 browser bundle, license and integrity notice
├── tests/               Core, functional, responsive, diagram, GWR and field checks; see tests/README.md
└── docs/
```

The ten application scripts load in the order above; each is an IIFE that adds one object to the `window.DK` namespace (`router.js` and `graph.js` read `DK.data`, so `data.js` must come first). Swagger UI is not in `index.html`: `app.js` inserts its stylesheet and bundle on the first visit of `#/api`. Likewise, `excel.js` loads the local ExcelJS bundle only on the first Excel export; failed loads can be retried.

Styles load in order: tokens, reusable components, application layouts/variants, diagram. `.ob-input` and `.ob-select` share native field styling; `.ob-icon-button` supplies quiet actions in inputs and notices; `.ob-card` supplies the filled surface, safe wrapping and interaction states for KPI cards and tiles. Layout classes retain their distinct padding, grids and content limits. See [the design polish review](design-polish-2026-09-05.md) for ownership and regression checks.

## JavaScript strategy

Files are split by responsibility:

| File | Owns | Does not |
|---|---|---|
| `ui.js` | String helpers, safe link rendering, blob downloads, tiny widgets, table headers and locale-aware stable sorting, the i18n dictionary | Read app state |
| `data.js` | Snapshot validation and indexed lookups, grouping, domain membership by identifier, relations, search, KPIs and history; `validate()` logs dangling references after loading | Touch the DOM |
| `router.js` | URL ↔ route object, hrefs for entities and lists | Render |
| `search.js` | Scope options, shared suggestion/result retrieval and deterministic answer excerpts | Touch the DOM or call a model |
| `views.js` | HTML for everything except the profile page body; `views.context()` derives titles, breadcrumbs, group options and actions from a route | Handle events |
| `detail.js` | Profile page tabs, facts, sortable row/relationship tables and diagram composition | Handle events |
| `graph.js` | Adaptive bubble layout, bounded group paging, zoom/pan/selection, keyboard/touch input, full-window dialog and viewport sizing | Change routes or mutate catalog data |
| `excel.js` | Immutable export plans, typed multi-sheet workbooks, local writer loading and downloads | Mutate catalog data or traverse every relationship recursively |
| `sidebar.js` | Pointer/keyboard resizing, CSS width and separator accessibility values, persisted preference and responsive limits | Re-render the tree or change mobile drawer behavior |
| `app.js` | State, rendering cycle with focus restoration, event delegation, lazy Swagger UI, Excel/print export actions and handbook scroll spy | Contain HTML templates |

`views.page(route, state)` returns the application markup as a string. `app.render()` replaces `<main>` while preserving focus, sidebar/flyout scroll offsets and the current profile's metadata disclosure state. `replaceHtml()` identifies focused controls by `data-focus`, `id` or data attributes; disappearing menu items map back to their trigger. Repeated table controls include their group instance in `data-focus`. Route changes skip this control restoration and normally scroll to the top.

Some updates are local: search typing refreshes suggestions, help/language menus refresh their hosts, and graph panning changes a transform. A shared `ResizeObserver` switches each table between columns and cards according to its available width and moves focus between the appropriate sorting controls.

The desktop sidebar divider updates `--ob-sidebar-width` at most once per animation frame and keeps the tree and diagram DOM intact. Width limits come from tokens; the upper bound also reserves 600 px for content. `datenkatalog.sidebarWidth` stores the preferred width independently of collapse state. Narrower windows clamp the visible width without overwriting that preference. The focusable separator supports Left/Right (16 px), Home/End (limits) and Enter (reset); double-click also resets to 320 px. Escape, lost pointer capture, window blur and navigation cancel unfinished drags. The divider is absent when collapsed or on the API reference, and hidden in mobile drawer layouts.

The divider uses one 2 px neutral line: light on hover, darker for dragging or keyboard focus. Its focus style replaces the global box-shadow ring, whose outer edges otherwise produce three lines on the first drag after loading. A small grip with two 16 px vertical strokes stays near the center of the visible area below the header using sticky positioning, including on long pages. The grip is light grey at rest and darker on hover, focus or drag; its dimensions use component tokens. The mouse hit area stays 12 px wide; forced-color mode uses system colors for the grip and line.

The home hero and compact header use the same `views.searchField()` combobox and query state. Home renders it above the summary tiles; its header magnifier scrolls to and focuses that form. Other routes render it in the expandable header. Only one input/listbox exists at a time. The hero adds native form submission; suggestion picks and Enter use the existing routing and ranking. Navigating from search moves focus to destination content. The hero popup sits below the entire form, keeping the submit button accessible when controls stack, and its height follows the visible viewport, including keyboard-induced viewport changes. JavaScript supplies available viewport space through a custom property; CSS applies the shared size and spacing constraints. Page load does not autofocus it. Home and results share the content-type disclosure and optional, cited AI-answer demo. `search.js` owns their common scope and deterministic retrieval; see [search-options.md](search-options.md).

Relationships default to the bubble diagram. The list toggle sits inside the `.ob-tabs` row, outside the semantic tablist, and switches to a shared sortable table. `graph.js` owns its canvas updates and a separate size observer. Wide layouts place circular groups around the central entity; narrow layouts stack readable bubbles. Each bubble shows up to six entries per page, or three on narrow canvases. The orbit accounts for circles, captions and paging controls to avoid overlap. The modal fullscreen workspace moves the existing shell into a native dialog and preserves it through background renders. Route changes close the dialog and restore focus to the destination content. See [relationship-diagram.md](relationship-diagram.md).

Swagger owns the contents of its live `#swagger-ui` node. On updates within the API view, the node is reattached rather than replaced, retaining filter, expansion and input state. A `WeakSet` tracks pending/mounted hosts, the loader is shared, and disconnected hosts are ignored when loading completes. Bundle failure permits a subsequent render to retry. Leaving the API view discards its host; a later visit mounts a fresh view.

Every entity lookup tolerates a missing target: `data.nameOf()` falls back to the id, relation builders drop unresolved ids, and breadcrumbs skip missing containers. `data.validate()` reports such references once in the console.

The [GWR import](gwr-import.md) supplies seven logical tables and explicit `fields[].codeList` references. Tables with these links add a Werteliste column; relationship builders resolve them in both directions, including entities without a mapped business object. A direct `domain` supports those unmapped records. The GWR system diagram lists its tables. Imported definitions link directly to the corresponding source paragraphs, and provenance/version details distinguish the 5.0 catalog from the older code workbook. The Übersicht tree link omits the aggregate count.

Field profiles reuse the attribute-page composition and have Übersicht, Beziehungen and Verlauf Datentabelle. `data.field()` derives the profile from its table's embedded field, and `router.entityHref('fields', '<tableId>/<fieldId>')` creates its address. Every field name and row in Felder links to that profile, including mobile cards; code-list links remain separate destinations. Breadcrumbs and the Datentabelle fact return to the parent's Felder tab. Both tree models highlight the parent table. Fields store `technicalName` and a `labels` language map; the profile resolves the selected label with `ui.localized()` and shows both in Kerndaten. Imported source documentation remains in JSON and Excel, without a separate section on the profile.

Before publishing a data snapshot, the loader checks collection shapes, record identities, embedded lists and duplicate IDs. Invalid input leaves any previously loaded snapshot intact. See [data-model.md](data-model.md) for the scope of these guards. HTML data is escaped; config/data links additionally use `ui.safeHref()` through `ui.link()`. Its label HTML must already be escaped. Excel export writes catalog strings as literal text cells, including formula-like content, and preserves numeric values separately.

## Routing

Repeated domain groups within Referenzdaten, Datenprodukte and API-Verzeichnis use section-scoped collection routes. The [side-tree investigation](side-tree-navigation.md) documents their destination, active-state and breadcrumb behaviour.

Domain profiles use Übersicht/Kacheln/Tabelle. Their browsing tabs reuse `views.collection()` with `ctx.kind = objects`, `ctx.domain` set to the domain and `ctx.isList = true`; the route and `ctx.entity` retain the domain identity. Übersicht displays metadata with `ctx.isList = false`. Export follows the visible collection or the full overview accordingly. See [domain-browsing.md](domain-browsing.md) for navigation, defaults and legacy link handling.

Collection pages have a local search in `.ob-collection-controls`, immediately before the grouping button. `?filter=…` scopes it to the current kind and survives view/group changes, reloads and browser history; the global search keeps its separate `q` state. Matching covers names, technical names, descriptions, identifiers, visible table metadata and domain/system names, with the same case/umlaut folding as global search. Filtering preserves canonical group order and the selected table sort. Counts, tiles, rows and Excel export all use the filtered context. Empty groups disappear, and matching groups start expanded without changing unfiltered disclosure state.

Typing replaces only the collection results and updates a persistent live result count, preserving the input node, caret and IME composition. Escape and the clear button reset the filter. Controls wrap according to content width and use the shared spacing, input and touch-target tokens. The search controls are omitted from print; filtered results remain printable.

The URL is the source of truth for everything that should be bookmarkable:

| Route | View |
|---|---|
| `#/` | Home |
| `#/objects`, `#/tables`, `#/refs`, `#/products`, `#/apis`, `#/domains`, `#/systems` | Section list. Params: `view=tiles|table`, `group=<option>`, `filter=<query>`; content collections also accept `domain=<id>` for exact domain membership |
| `#/objects/gebaeude` | Profile page. Params: `tab=overview|rows|relations|history`, `page=n`, `size=50|100|200` (50 is the default). The tab is kept in the hash during a session, but a fresh load always opens Übersicht (see design-review-responsive.md, "Tab continuity") |
| `#/domains/bau` | Domain overview and business-object collection. Params: `tab=overview|tiles|table`, `group`, `filter`. Defaults to the current collection layout and retains explicit tabs on reload. Legacy `tab=rows` opens Tabelle; `relations`/`history` open Übersicht |
| `#/objects/gebaeude/attributes/egid` | Attribute profile |
| `#/tables/t-gwr-gebaeude/fields/EGID` | Field profile; technical field IDs are case-sensitive. Fields inherit their table's history and keep the parent selected in the tree |
| `#/search?q=…` | Search results; optional `domains=energie,projekt,…` and `types=objects,tables,…` (`none` for an empty group); `ai=0` hides the answer demo |
| `#/manual?ch=<chapter>` | Handbook |
| `#/api` | Swagger UI rendering the OpenAPI contract in `data/swagger.json` |
| any route `?nav=entity|container` | Overrides the tree model from `config.json` |

`hashchange` calls `app.onRoute()`, which resets transient state (open menus, suggestions) and renders. Controls that change only a query parameter (tab, page, view mode, grouping) call `router.replaceParams()` and re-render without a history entry. Navigation links are plain anchors with hash hrefs; table rows carry `data-href` and become clickable through delegation.

## Transient state (`app.js`)

Held in memory, not in the URL: the UI language (also in `localStorage`), search query and suggestion index, open menu (`info`, `language`, `group`, `actions`), default view mode and grouping per section, table sort column/direction, collapsed list groups, expanded tree nodes, graph offset/zoom/tool/selection/group pages, relation list/diagram switch, active handbook chapter, the semantic tab carried between profiles, header-search expansion, sidebar expansion (also in local storage), and the currently open rail flyout. URL params override `mode` and `groupBy` when present.

## Events

A `change` listener handles the detail-row page-size selector. Sidebar/rail/search controls dispatch `toggle-sidebar`, `rail-section`, `close-flyout` and `toggle-search`; the mobile drawer keeps focus inside and makes the background inert. One `click` listener on `document` dispatches on `data-action` attributes (`skip`, `back-to-top`, `help-toggle`, `menu`, `set-language`, `set-group`, `set-view`, `sort-table`, `toggle-group`, `toggle-tree`, `open-navigation`, `close-navigation`, `open-overview`, `open-tree`, `set-tab`, `set-page`, `toggle-relation-view`, `export`, `clear-query`, `suggest-pick`, `open-results`, `chapter`, `not-available`, `toast-close`). Clicks with no action close open menus, except clicks on links to another route, which leave the close to the `hashchange` render. `input`, `keydown`, `focusin`, `focusout`, pointer and `scroll` listeners cover the search box, graph and handbook.

The `change` listener also handles card sorting. Native metadata `toggle` events update disclosure state. Menus support keyboard entry, arrows, Home/End, initial-letter navigation, Tab exit and Escape; drawer focus containment uses the active control after an inner menu closes.

Search ranks by `data.relevance()`: an exact name (100) beats a name prefix (90), a word prefix inside the name (80), any name substring (70), technical-name hits (50/40) and description hits (20/10). Groups are ordered by their best hit, ties by content order (objects, tables, code lists, products, APIs, then domains and systems); rows by score, shorter names first. Matching tolerates umlaut spellings ("gebau", "gebaeu" both find "Gebäude") and hits are highlighted with `ui.highlight()`. Result tables start in relevance order; a click on a column header switches that group to the chosen sort.

Catalog data tables use native buttons in their column headers and expose the active direction through `aria-sort`. Repeated headers in grouped L0 tables share one sort state. Detail rows are sorted before pagination, and changing their sort resets the pager to page 1. Handbook reference tables remain unsorted because their authored row order conveys meaning.

Column definitions also control presentation: `numeric: true` right-aligns the header and values and uses tabular digits; `compact: true` lets short metadata columns size to their content. Text headers and values share left alignment and the same padding. Numeric sort icons appear before the label so its right edge lines up with the numbers. Counts are numeric; codes, versions and dates remain text. Tables omit synthetic row numbers and use the standard body font, including technical field names and code values. Source positions remain available in details and Excel. Names use proportional widths, descriptions take the remaining space, and short status/count/date columns avoid expanding with the screen. Mobile cards keep labels left and numeric values right; print preserves the same value alignment.

## Configuration (`data/config.json`)

`admindirUrl` (base URL of the federal directory that the persons under Verantwortlich link to; the prototype has no person ids yet), `navModel` (`entity` or `container`), `app.languages` offered by the header switch, `app.language` as the default, `defaultGrouping` for business objects, `showTreeCounts`, `compactTables`, app name, organisation, version, badge, footer note, help and contact content, footer links (`route` for in-app hashes, `url` for external pages).

## How to extend

- **New entity type**: add a JSON file and a `kinds` entry in `model.json`; add it to `FILES`, `KINDS`, `LISTS` and the `cols`/`columns`/`sizeOf`/`relations` switches in `data.js`; add `rowsData` and facts in `detail.js`; add its crumb path in `views.context()`.
- **New grouping option**: extend `GROUP_IDS`, `groupKey` and `groupOrder` in `data.js`; add a `group.<id>` label in `i18n.json`.
- **New language**: `i18n.json` holds one entry per key with `de`, `fr`, `it`, `en`; validate the drafts, list the language in `app.languages` and optionally set it as `app.language`. Missing translations fall back to German; `setLanguage()` in `app.js` swaps the dictionary and re-renders. Embedded table fields use the same languages in `labels`; the loader validates this map and `ui.localized()` resolves it. Other catalog names and descriptions remain German strings.
- **Real backend**: replace `data.load()` with API calls that return the same shapes as the JSON files; nothing else depends on the file layout.
- **Excel export**: implemented by `DK.excel` (see [excel-export.md](excel-export.md)). DCAT export remains a placeholder in `doExport()`.

## Testing

Eleven suites are checked in: `tests/core.test.cjs` checks real and mutated JSON plus workbook round-trips using Node and the vendored writer; `tests/functional.cjs` checks browser behavior and failure recovery; `tests/responsive.cjs` checks the responsive matrix; `tests/graph.cjs` covers diagram controls, dense data and fullscreen/touch behavior; `tests/gwr.cjs` checks imported GWR data and exports; `tests/fields.cjs` checks field profiles and navigation; `tests/excel.cjs` checks workbook downloads, scope and loading failures; `tests/sidebar.cjs` checks desktop resizing, persistence, cancellation and responsive limits; `tests/polish.cjs` checks long labels, shared controls, disabled states and high-contrast rendering; `tests/contrast.cjs` measures text/graphic contrast and checks visible keyboard focus, including Swagger; `tests/mobile.cjs` covers short-screen overlays, touch controls, API table scrolling and simulated keyboard viewports. See [tests/README.md](../tests/README.md) for reproducible setup. Physical-device and screen-reader checks remain separate from these automated suites.
