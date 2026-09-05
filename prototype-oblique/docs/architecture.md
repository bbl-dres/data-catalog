# Architecture

No build step and no framework. One HTML page, three stylesheets, seven application JavaScript files, static JSON data, and a pinned self-hosted Swagger UI distribution that is loaded only when the API page is opened.

The current page composition implements [compact layout 1b](compact-layout.md) and the [responsive strategy](responsive-strategy.md): a sticky header with navigation below the identity row above 960 px, shared 240 px sidebar / 56 px icon rail, header search, and a mobile modal drawer. The [federal logo](design-system.md#federal-header-logo) sets the identity height to 56, 72 or 86 px; desktop navigation adds 45 px. The API reference uses only global navigation. The document scrolls normally; the footer remains at the page end.

## File structure

```
prototype-oblique/
├── index.html            Page shell: identity header and desktop nav row, <main id="main">, footer
├── css/
│   ├── tokens.css        Design tokens (custom properties) – see design-system.md
│   ├── main.css          Fonts, reset, layout and components; responsive and print rules
│   └── graph.css         Diagram workspace, controls and fullscreen presentation
├── js/
│   ├── ui.js             DK.ui     – translation, escaped markup, safe links, tables, sorting, CSV and small widgets
│   ├── data.js           DK.data   – loads and validates JSON, lookups, grouping, relations, search, KPIs, history
│   ├── router.js         DK.router – hash parsing/building, navigate(), replaceParams()
│   ├── graph.js          DK.graph  – relationship layout, viewport, input and modal workspace
│   ├── views.js          DK.views  – header, nav, breadcrumb, toolbar, tree, home, lists, search, manual, API page
│   ├── detail.js         DK.detail – profile pages: facts, rows, relationship list/graph, history
│   └── app.js            DK.app    – bootstrap, transient state, event delegation, exports
├── data/                 Static JSON – see data-model.md
├── assets/
│   ├── swiss-logo-flag.svg  Swiss coat of arms and browser-tab icon
│   ├── swiss-logo-name.svg  Multilingual Confederation wordmark (reference asset; not rendered)
│   ├── icons/*.svg       25 Oblique icons and 3 local diagram controls, used as CSS masks
│   └── fonts/*.woff2     Noto Sans (latin, latin-ext) and Noto Sans Mono, variable weight
├── vendor/swagger-ui/    Swagger UI 5.32.11 browser assets and license notices
├── tests/               Core, functional, responsive and diagram checks; see tests/README.md
└── docs/
```

The seven application scripts load in the order above; each is an IIFE that adds one object to the `window.DK` namespace (`router.js` and `graph.js` read `DK.data`, so `data.js` must come first). Swagger UI is not in `index.html`: `app.js` inserts its stylesheet and bundle on the first visit of `#/api`.

## JavaScript strategy

Files are split by responsibility:

| File | Owns | Does not |
|---|---|---|
| `ui.js` | String helpers, safe link rendering, CSV cells, tiny widgets, table headers and locale-aware stable sorting, the i18n dictionary | Read app state |
| `data.js` | Snapshot validation and indexed lookups, grouping, domain membership by identifier, relations, search, KPIs and history; `validate()` logs dangling references after loading | Touch the DOM |
| `router.js` | URL ↔ route object, hrefs for entities and lists | Render |
| `views.js` | HTML for everything except the profile page body; `views.context()` derives titles, breadcrumbs, group options and actions from a route | Handle events |
| `detail.js` | Profile page tabs, facts, sortable row/relationship tables and diagram composition | Handle events |
| `graph.js` | Deterministic panel layout, bounded group paging, zoom/pan/selection, keyboard/touch input, full-window dialog and viewport sizing | Change routes or mutate catalog data |
| `app.js` | State, rendering cycle with focus restoration, event delegation, lazy Swagger UI, CSV/print exports and handbook scroll spy | Contain HTML templates |

`views.page(route, state)` returns the application markup as a string. `app.render()` replaces `<main>` while preserving focus, sidebar/flyout scroll offsets and the current profile's metadata disclosure state. `replaceHtml()` identifies focused controls by `data-focus`, `id` or data attributes; disappearing menu items map back to their trigger. Repeated table controls include their group instance in `data-focus`. Route changes skip this control restoration and normally scroll to the top.

Some updates are local: search typing refreshes suggestions, help/language menus refresh their hosts, and graph panning changes a transform. A shared `ResizeObserver` switches each table between columns and cards according to its available width and moves focus between the appropriate sorting controls.

The home hero and compact header use the same `views.searchField()` combobox and query state. Home renders it above the summary tiles; its header magnifier scrolls to and focuses that form. Other routes render it in the expandable header. Only one input/listbox exists at a time. The hero adds native form submission and example result links; suggestion picks and Enter use the existing routing and ranking. Navigating from search moves focus to destination content. The hero popup sits below the entire form, keeping the submit button accessible when controls stack, and its height follows the visible viewport, including keyboard-induced viewport changes. Page load does not autofocus it.

Relationships default to the diagram. The list toggle sits inside the `.ob-tabs` row, outside the semantic tablist, and switches to a shared sortable table. `graph.js` owns its canvas updates and a separate size observer. Wide layouts balance non-overlapping panels on either side of the entity; narrow layouts stack panels at normal text size. Each panel shows six entries per page. The modal fullscreen workspace moves the existing shell into a native dialog and preserves it through background renders. Route changes close the dialog and restore focus to the destination content. See [relationship-diagram.md](relationship-diagram.md).

Swagger owns the contents of its live `#swagger-ui` node. On updates within the API view, the node is reattached rather than replaced, retaining filter, expansion and input state. A `WeakSet` tracks pending/mounted hosts, the loader is shared, and disconnected hosts are ignored when loading completes. Bundle failure permits a subsequent render to retry. Leaving the API view discards its host; a later visit mounts a fresh view.

Every entity lookup tolerates a missing target: `data.nameOf()` falls back to the id, relation builders drop unresolved ids, and breadcrumbs skip missing containers. `data.validate()` reports such references once in the console.

Before publishing a data snapshot, the loader checks collection shapes, record identities, embedded lists and duplicate IDs. Invalid input leaves any previously loaded snapshot intact. See [data-model.md](data-model.md) for the scope of these guards. HTML data is escaped; config/data links additionally use `ui.safeHref()` through `ui.link()`. Its label HTML must already be escaped. CSV uses `ui.csvCell()` and intentionally prefixes formula-like text for spreadsheet import.

## Routing

The URL is the source of truth for everything that should be bookmarkable:

| Route | View |
|---|---|
| `#/` | Home |
| `#/objects`, `#/tables`, `#/refs`, `#/products`, `#/apis`, `#/domains`, `#/systems` | Section list. Params: `view=tiles|table`, `group=<option>` |
| `#/objects/gebaeude` | Profile page. Params: `tab=overview|rows|relations|history`, `page=n`, `size=50|100|200` (50 is the default). The tab is kept in the hash during a session, but a fresh load always opens Übersicht (see design-review-responsive.md, "Tab continuity") |
| `#/objects/gebaeude/attributes/egid` | Attribute profile |
| `#/search?q=…` | Search results |
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

Column definitions also control presentation: `numeric: true` right-aligns the header and values and uses tabular digits; `compact: true` lets short metadata columns size to their content. Text headers and values share left alignment and the same padding. Numeric sort icons appear before the label so its right edge lines up with the numbers. Counts and row positions are numeric; codes, versions and dates remain text. Names use proportional widths, descriptions take the remaining space, and short status/count/date columns avoid expanding with the screen. Mobile cards keep labels left and numeric values right; print preserves the same value alignment.

## Configuration (`data/config.json`)

`admindirUrl` (base URL of the federal directory that the persons under Verantwortlich link to; the prototype has no person ids yet), `navModel` (`entity` or `container`), `app.languages` offered by the header switch, `app.language` as the default, `defaultGrouping` for business objects, `showTreeCounts`, `compactTables`, app name, organisation, version, badge, footer note, help and contact content, footer links (`route` for in-app hashes, `url` for external pages).

## How to extend

- **New entity type**: add a JSON file and a `kinds` entry in `model.json`; add it to `FILES`, `KINDS`, `LISTS` and the `cols`/`columns`/`sizeOf`/`relations` switches in `data.js`; add `rowsData` and facts in `detail.js`; add its crumb path in `views.context()`.
- **New grouping option**: extend `GROUP_IDS`, `groupKey` and `groupOrder` in `data.js`; add a `group.<id>` label in `i18n.json`.
- **New language**: `i18n.json` holds one entry per key with `de`, `fr`, `it`, `en`; validate the drafts, list the language in `app.languages` and optionally set it as `app.language`. Missing translations fall back to German; `setLanguage()` in `app.js` swaps the dictionary and re-renders. Data fields are still German strings, so a multilingual data schema (`{de, fr, it, en}`) would be the next step.
- **Real backend**: replace `data.load()` with API calls that return the same shapes as the JSON files; nothing else depends on the file layout.
- **Excel / DCAT export**: implement in `doExport()` in `app.js`; the menu entries already exist and show a notice today.

## Testing

Four suites are checked in: `tests/core.test.cjs` runs against real and mutated JSON using Node alone; `tests/functional.cjs` checks browser behavior and failure recovery; `tests/responsive.cjs` checks the responsive matrix; `tests/graph.cjs` covers diagram controls, dense data and fullscreen/touch behavior. See [tests/README.md](../tests/README.md) for reproducible setup. Physical-device and screen-reader checks remain separate from these automated suites.
