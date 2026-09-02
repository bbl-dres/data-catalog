# Architecture

No build step and no framework. One HTML page, three stylesheets, six application JavaScript files, static JSON data, and a pinned self-hosted Swagger UI distribution.

## File structure

```
prototype-oblique/
├── index.html            Page shell: header (logo, titles, tools), nav, <main id="main">, footer
├── css/
│   ├── tokens.css        Design tokens (custom properties) – see design-system.md
│   └── main.css          Fonts, reset, layout and components; responsive and print rules
├── js/
│   ├── ui.js             DK.ui     – html helpers: t(), esc(), icon(), chip(), table(), tr(), toast(), downloadCsv()
│   ├── data.js           DK.data   – loads JSON, lookups, grouping, relations, search, KPIs, history
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

Swagger UI loads first as a vendored browser bundle. The six application scripts then load in the order above; each is an IIFE that adds one object to the `window.DK` namespace.

## JavaScript strategy

Six files, split by responsibility rather than by page, so a feature usually touches one or two files:

| File | Owns | Does not |
|---|---|---|
| `ui.js` | String helpers, tiny widgets, table headers and locale-aware stable sorting, the i18n dictionary | Read app state |
| `data.js` | All questions about the data: `get`, `domainForEntity`, `sizeOf`, `statusOf`, `buildGroups`, `relations`, `search`, `suggest`, `recent`, `kpis`, `history` | Touch the DOM |
| `router.js` | URL ↔ route object, hrefs for entities and lists | Render |
| `views.js` | HTML for everything except the profile page body; `views.context()` derives titles, breadcrumbs, group options and actions from a route | Handle events |
| `detail.js` | Profile page tabs, facts, sortable row tables with paging, orbit graph layout | Handle events |
| `app.js` | State, rendering cycle, all event listeners, CSV/print exports, handbook scroll spy, graph drag/zoom | Contain HTML templates |

Rendering is "render everything from state": `views.page(route, state)` returns the whole `<main>` as a string and `app.render()` replaces `innerHTML`. After the API route is composed, `app.js` mounts Swagger UI into `#swagger-ui` using `data/swagger.json`. Two exceptions avoid losing keyboard focus: typing in the search box only re-renders the suggestion listbox, and typing in the graph search only re-renders the graph canvas. Graph pan and zoom update the transform directly.

## Routing

The URL is the source of truth for everything that should be bookmarkable:

| Route | View |
|---|---|
| `#/` | Home |
| `#/objects`, `#/tables`, `#/refs`, `#/products`, `#/apis`, `#/domains`, `#/systems` | Section list. Params: `view=tiles|table`, `group=<option>` |
| `#/objects/gebaeude` | Profile page. Params: `tab=overview|rows|relations|history`, `page=n` |
| `#/objects/gebaeude/attributes/egid` | Attribute profile |
| `#/search?q=…` | Search results |
| `#/manual?ch=<chapter>` | Handbook |
| `#/api` | Swagger UI rendering the OpenAPI contract in `data/swagger.json` |
| any route `?nav=entity|container` | Overrides the tree model from `config.json` |

`hashchange` calls `app.onRoute()`, which resets transient state (open menus, suggestions) and renders. Controls that change only a query parameter (tab, page, view mode, grouping) call `router.replaceParams()` and re-render without a history entry. Navigation links are plain anchors with hash hrefs; table rows carry `data-href` and become clickable through delegation.

## Transient state (`app.js`)

Held in memory, not in the URL: search query and suggestion index, open menu (`info`, `group`, `actions`), default view mode and grouping per section, table sort column/direction, collapsed list groups, expanded tree nodes, graph transform and filters, active handbook chapter. URL params override `mode` and `groupBy` when present.

## Events

One `click` listener on `document` dispatches on `data-action` attributes (`menu`, `set-group`, `set-view`, `sort-table`, `toggle-group`, `toggle-tree`, `open-tree`, `set-tab`, `set-page`, `export`, `clear-query`, `suggest-pick`, `open-results`, `graph-zoom`, `graph-clear`, `chapter`, `help-toggle`, `not-available`, `toast-close`). Clicks with no action close open menus. `input`, `change`, `keydown`, `focusin`, pointer and `scroll` listeners cover the search box, graph and handbook.

Catalog data tables use native buttons in their column headers and expose the active direction through `aria-sort`. Repeated headers in grouped L0 tables share one sort state. Detail rows are sorted before pagination, and changing their sort resets the pager to page 1. Handbook reference tables remain unsorted because their authored row order conveys meaning.

## Configuration (`data/config.json`)

`navModel` (`entity` or `container`), `defaultGrouping` for business objects, `showTreeCounts`, `compactTables`, app name, organisation, version, badge, footer note, help and contact content, footer links.

## How to extend

- **New entity type**: add a JSON file and a `kinds` entry in `model.json`; add it to `FILES`, `KINDS` and the `cols`/`columns`/`sub`/`sizeOf`/`relations` switches in `data.js`; add `rowsData` and facts in `detail.js`; add crumbs in `views.context()`.
- **New grouping option**: extend `GROUP_IDS`, `groupKey` and `groupOrder` in `data.js`; add a `group.<id>` label in `i18n.json`.
- **New language**: add a language object to `i18n.json` and set `app.language`; data fields are still German strings, so a multilingual data schema (`{de, fr, it, en}`) would be the next step.
- **Real backend**: replace `data.load()` with API calls that return the same shapes as the JSON files; nothing else depends on the file layout.
- **Excel / DCAT export**: implement in `doExport()` in `app.js`; the menu entries already exist and show a notice today.

## Testing

No automated tests are checked in. A Playwright smoke script (routes, grouping, view toggle, tree, tabs, paging, graph pan/zoom, search keyboard flow, help popover, handbook, API page, container model, mobile overflow, print media) was run during development with zero console errors. Manual checks: navigate every route, toggle views and grouping, use the search box with the keyboard, drag the graph, print a profile page, resize to a phone width.
