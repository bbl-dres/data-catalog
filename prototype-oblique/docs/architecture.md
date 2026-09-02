# Architecture

No build step, no framework, no dependencies. One HTML page, two stylesheets, six JavaScript files, static JSON data.

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
│   ├── logo-ch.svg       Federal logo
│   ├── favicon.svg
│   ├── icons/*.svg       25 Oblique icons, used as CSS masks (colour via currentColor)
│   └── fonts/*.woff2     Noto Sans (latin, latin-ext) and Noto Sans Mono, variable weight
└── docs/
```

Scripts load in the order above; each file is an IIFE that adds one object to the `window.DK` namespace.

## JavaScript strategy

Six files, split by responsibility rather than by page, so a feature usually touches one or two files:

| File | Owns | Does not |
|---|---|---|
| `ui.js` | String helpers and tiny widgets, the i18n dictionary | Read app state |
| `data.js` | All questions about the data: `get`, `domainForEntity`, `sizeOf`, `statusOf`, `buildGroups`, `relations`, `search`, `suggest`, `recent`, `kpis`, `history` | Touch the DOM |
| `router.js` | URL ↔ route object, hrefs for entities and lists | Render |
| `views.js` | HTML for everything except the profile page body; `views.context()` derives titles, breadcrumbs, group options and actions from a route | Handle events |
| `detail.js` | Profile page tabs, facts, row tables with paging, orbit graph layout | Handle events |
| `app.js` | State, rendering cycle, all event listeners, CSV/print exports, handbook scroll spy, graph drag/zoom | Contain HTML templates |

Rendering is "render everything from state": `views.page(route, state)` returns the whole `<main>` as a string and `app.render()` replaces `innerHTML`. Two exceptions avoid losing keyboard focus: typing in the search box only re-renders the suggestion listbox, and typing in the graph search only re-renders the graph canvas. Graph pan and zoom update the transform directly.

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
| `#/api` | API documentation |
| any route `?nav=entity|container` | Overrides the tree model from `config.json` |

`hashchange` calls `app.onRoute()`, which resets transient state (open menus, suggestions) and renders. Controls that change only a query parameter (tab, page, view mode, grouping) call `router.replaceParams()` and re-render without a history entry. Navigation links are plain anchors with hash hrefs; table rows carry `data-href` and become clickable through delegation.

## Transient state (`app.js`)

Held in memory, not in the URL: search query and suggestion index, open menu (`info`, `group`, `actions`), default view mode and grouping per section, collapsed list groups, expanded tree nodes, graph transform and filters, active handbook chapter. URL params override `mode` and `groupBy` when present.

## Events

One `click` listener on `document` dispatches on `data-action` attributes (`menu`, `set-group`, `set-view`, `toggle-group`, `toggle-tree`, `open-tree`, `set-tab`, `set-page`, `export`, `clear-query`, `suggest-pick`, `open-results`, `graph-zoom`, `graph-clear`, `chapter`, `help-toggle`, `not-available`, `toast-close`). Clicks with no action close open menus. `input`, `change`, `keydown`, `focusin`, pointer and `scroll` listeners cover the search box, graph and handbook.

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
