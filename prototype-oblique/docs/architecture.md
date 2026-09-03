# Architecture

No build step and no framework. One HTML page, two stylesheets, six application JavaScript files, static JSON data, and a pinned self-hosted Swagger UI distribution that is loaded only when the API page is opened.

## File structure

```
prototype-oblique/
├── index.html            Page shell: header (logo, titles, tools), nav, <main id="main">, footer
├── css/
│   ├── tokens.css        Design tokens (custom properties) – see design-system.md
│   └── main.css          Fonts, reset, layout and components; responsive and print rules
├── js/
│   ├── ui.js             DK.ui     – html helpers: t(), esc(), icon(), chip(), entityLink(), table(), tr(), empty(), toast(), downloadCsv(), slug(), fieldName()
│   ├── data.js           DK.data   – loads and validates JSON, lookups, grouping, relations, search, KPIs, history
│   ├── router.js         DK.router – hash parsing/building, navigate(), replaceParams()
│   ├── views.js          DK.views  – header, nav, breadcrumb, toolbar, tree, home, lists, search, manual, API page
│   ├── detail.js         DK.detail – profile pages: facts, rows, orbit graph, history
│   └── app.js            DK.app    – bootstrap, transient state, event delegation, exports
├── data/                 Static JSON – see data-model.md
├── assets/
│   ├── swiss-logo-flag.svg  Swiss coat of arms and browser-tab icon
│   ├── swiss-logo-name.svg  Multilingual Confederation wordmark
│   ├── icons/*.svg       25 Oblique icons, used as CSS masks (colour via currentColor)
│   └── fonts/*.woff2     Noto Sans (latin, latin-ext) and Noto Sans Mono, variable weight
├── vendor/swagger-ui/    Swagger UI 5.32.11 browser assets and license notices
└── docs/
```

The six application scripts load in the order above; each is an IIFE that adds one object to the `window.DK` namespace (`router.js` reads `DK.data.kinds`, so `data.js` must come first). Swagger UI is not in `index.html`: `app.js` inserts its stylesheet and bundle on the first visit of `#/api`.

## JavaScript strategy

Six files, split by responsibility rather than by page, so a feature usually touches one or two files:

| File | Owns | Does not |
|---|---|---|
| `ui.js` | String helpers, tiny widgets, table headers and locale-aware stable sorting, the i18n dictionary | Read app state |
| `data.js` | All questions about the data: `get`, `nameOf`, `displayName`, `domainForEntity`, `sizeOf`, `statusOf`, `buildGroups`, `relations`, `relevance`, `search`, `suggest`, `recent`, `kpis`, `history`; `validate()` logs dangling references after loading | Touch the DOM |
| `router.js` | URL ↔ route object, hrefs for entities and lists | Render |
| `views.js` | HTML for everything except the profile page body; `views.context()` derives titles, breadcrumbs, group options and actions from a route | Handle events |
| `detail.js` | Profile page tabs, facts, sortable row tables with paging, orbit graph layout | Handle events |
| `app.js` | State, rendering cycle with focus restoration, all event listeners, lazy Swagger UI, CSV/print exports, handbook scroll spy, graph drag | Contain HTML templates |

Rendering is "render everything from state": `views.page(route, state)` returns the whole `<main>` as a string and `app.render()` replaces `innerHTML`. Because that drops keyboard focus, `replaceHtml()` records a selector for the focused control before the swap (`data-focus`, `id`, or its `data-*` attributes; a menu item maps to its menu button) and refocuses it afterwards without scrolling. Route changes skip this and scroll to the top. Three things bypass the full render: typing in the search box only re-renders the suggestion listbox, the help popover re-renders only its host, and graph panning sets the canvas transform directly. After the API route is composed, `app.js` loads Swagger UI on first use and mounts it into `#swagger-ui` using `data/swagger.json`; the mount is skipped if the page was re-rendered while the bundle was loading.

Every entity lookup tolerates a missing target: `data.nameOf()` falls back to the id, relation builders drop unresolved ids, and breadcrumbs skip missing containers. `data.validate()` reports such references once in the console.

## Routing

The URL is the source of truth for everything that should be bookmarkable:

| Route | View |
|---|---|
| `#/` | Home |
| `#/objects`, `#/tables`, `#/refs`, `#/products`, `#/apis`, `#/domains`, `#/systems` | Section list. Params: `view=tiles|table`, `group=<option>` |
| `#/objects/gebaeude` | Profile page. Params: `tab=overview|rows|relations|history`, `page=n`. The tab is kept in the hash during a session, but a fresh load always opens Übersicht (see design-review-responsive.md, "Tab continuity") |
| `#/objects/gebaeude/attributes/egid` | Attribute profile |
| `#/search?q=…` | Search results |
| `#/manual?ch=<chapter>` | Handbook |
| `#/api` | Swagger UI rendering the OpenAPI contract in `data/swagger.json` |
| any route `?nav=entity|container` | Overrides the tree model from `config.json` |

`hashchange` calls `app.onRoute()`, which resets transient state (open menus, suggestions) and renders. Controls that change only a query parameter (tab, page, view mode, grouping) call `router.replaceParams()` and re-render without a history entry. Navigation links are plain anchors with hash hrefs; table rows carry `data-href` and become clickable through delegation.

## Transient state (`app.js`)

Held in memory, not in the URL: the UI language (also in `localStorage`), search query and suggestion index, open menu (`info`, `language`, `group`, `actions`), default view mode and grouping per section, table sort column/direction, collapsed list groups, expanded tree nodes, graph pan offset, relation list/diagram switch, active handbook chapter, the semantic tab carried between profiles. URL params override `mode` and `groupBy` when present.

## Events

One `click` listener on `document` dispatches on `data-action` attributes (`skip`, `back-to-top`, `help-toggle`, `menu`, `set-language`, `set-group`, `set-view`, `sort-table`, `toggle-group`, `toggle-tree`, `open-navigation`, `close-navigation`, `open-overview`, `open-tree`, `set-tab`, `set-page`, `toggle-relation-view`, `export`, `clear-query`, `suggest-pick`, `open-results`, `chapter`, `not-available`, `toast-close`). Clicks with no action close open menus, except clicks on links to another route, which leave the close to the `hashchange` render. `input`, `keydown`, `focusin`, `focusout`, pointer and `scroll` listeners cover the search box, graph and handbook.

Search ranks by `data.relevance()`: an exact name (100) beats a name prefix (90), a word prefix inside the name (80), any name substring (70), technical-name hits (50/40) and description hits (20/10). Groups are ordered by their best hit, ties by content order (objects, tables, code lists, products, APIs, then domains and systems); rows by score, shorter names first. Matching tolerates umlaut spellings ("gebau", "gebaeu" both find "Gebäude") and hits are highlighted with `ui.highlight()`. Result tables start in relevance order; a click on a column header switches that group to the chosen sort.

Catalog data tables use native buttons in their column headers and expose the active direction through `aria-sort`. Repeated headers in grouped L0 tables share one sort state. Detail rows are sorted before pagination, and changing their sort resets the pager to page 1. Handbook reference tables remain unsorted because their authored row order conveys meaning.

## Configuration (`data/config.json`)

`navModel` (`entity` or `container`), `app.languages` offered by the header switch, `app.language` as the default, `defaultGrouping` for business objects, `showTreeCounts`, `compactTables`, app name, organisation, version, badge, footer note, help and contact content, footer links (`route` for in-app hashes, `url` for external pages).

## How to extend

- **New entity type**: add a JSON file and a `kinds` entry in `model.json`; add it to `FILES`, `KINDS`, `LISTS` and the `cols`/`columns`/`sizeOf`/`relations` switches in `data.js`; add `rowsData` and facts in `detail.js`; add its crumb path in `views.context()`.
- **New grouping option**: extend `GROUP_IDS`, `groupKey` and `groupOrder` in `data.js`; add a `group.<id>` label in `i18n.json`.
- **New language**: `i18n.json` holds one entry per key with `de`, `fr`, `it`, `en`; validate the drafts, list the language in `app.languages` and optionally set it as `app.language`. Missing translations fall back to German; `setLanguage()` in `app.js` swaps the dictionary and re-renders. Data fields are still German strings, so a multilingual data schema (`{de, fr, it, en}`) would be the next step.
- **Real backend**: replace `data.load()` with API calls that return the same shapes as the JSON files; nothing else depends on the file layout.
- **Excel / DCAT export**: implement in `doExport()` in `app.js`; the menu entries already exist and show a notice today.

## Testing

No automated tests are checked in. A Playwright smoke script (routes, grouping, view toggle, sorting, tree, tabs, paging, graph pan, search keyboard flow, help popover, handbook, API page, container model, mobile drawer, focus restoration, rendering with broken references) was run during development and for the code review (see code-review.md) with zero console errors. Manual checks: navigate every route, toggle views and grouping, use the search box with the keyboard, drag the graph, print a profile page, resize to a phone width.
