# Code review: prototype-oblique

Historical review of 2 September 2026. The [5 September developer review](developer-review-2026-09-05.md) supersedes its current-state conclusions, including test availability and the claim that HTML escaping alone covers security. Retained below as implementation history.

Date: 2026-09-02. Scope: the six application scripts under `js/`, `index.html`, the JSON data contract and the documentation that describes them. Reviewed for correctness, race conditions, robustness against imperfect data, accessibility of the render cycle, duplicated code, and drift between code and documentation. Every recommendation below has been implemented; the "Status" column says where.

Verification: a Playwright script (headless Edge, 1366 px and 390 px) visited every route, exercised grouping, view toggle, sorting, tree, tabs, paging, graph drag, search keyboard flow, help popover, handbook chapters, the API page and the container navigation model, before and after the changes. Both runs finished with zero console errors and zero failed requests. After the changes it additionally checked focus restoration, the lazy Swagger UI load and rendering with deliberately broken references.

## Summary

The codebase is small, dependency-free and easy to follow. It had no crash under the shipped data, but it was one broken cross-reference away from a blank page, it lost keyboard focus on almost every click, it loaded 1.7 MB of Swagger UI on every page, and the same helpers were written twice in `views.js` and `detail.js`. The review found no security issues: all data reaches the DOM through `ui.esc()` and all internal navigation goes through `location.hash`.

| Area | Findings | Fixed |
|---|---|---|
| Bugs and robustness | 7 | 7 |
| Race conditions and re-rendering | 4 | 4 |
| Accessibility of the render cycle | 3 | 3 |
| Duplication and dead code | 9 | 9 |
| Documentation drift | 4 | 4 |

## 1. Bugs and robustness

### 1.1 Dangling references crashed whole pages (high)

`data.tablesOfDomain`, `data.refsOfDomain`, `data.domainForEntity`, `data.cols`, `data.groupKey`, `data.relations`, `views.context` (breadcrumbs) and `detail.facts` dereferenced the result of `data.objOf()` / `data.sysOf()` without a null check. One table whose `realizes` id does not exist would throw inside `views.page()` and leave `<main>` empty for the domain list, the home page, the tables list grouped by domain and the search page. The shipped JSON is consistent, but the data is meant to be harvested from other systems later.

Status: `data.js` now has `data.nameOf(kind, id)` (name or id fallback), `data.objectForEntity` / `data.domainForEntity` return `null` for missing targets, `data.membersOfDomain` compares resolved domains, `data.relations` drops unresolved ids, breadcrumbs skip missing containers, and `data.load()` guarantees the embedded arrays (`attributes`, `fields`, `values`, `termdat`, `basedOn`, `sourcedFrom`, `servedBy`) exist. `data.validate()` runs after loading and logs every dangling reference once with `console.warn`, so content problems are visible without breaking the page. Verified by injecting three broken references at runtime and rendering seven routes.

### 1.2 Tree groups were matched by display name (medium)

`views.tree` located the domain or system behind a group with `data.domains.find(d => d.name === g.title)`. Two containers with the same name, or a renamed container, would have linked the wrong entity. Status: `data.buildGroups()` now carries `entity` and `entityKind` for domain and system groupings and uses the entity id in the group id; the tree reads them directly.

### 1.3 `detail.facts` filtered on the string `'undefined'` (low)

`plain()` converted every value with `String()`, so a missing field became the text `'undefined'` and the `present` filter had to test for that literal. Status: values are kept raw and filtered on `null` / `''`; rendering escapes them.

### 1.4 Search-input `Escape` and clear button left the listbox open for keyboard users (low)

Tabbing out of the search box left the suggestion listbox open and `aria-expanded="true"` on a control that no longer had focus. Status: a `focusout` listener closes the suggestions when focus leaves `.ob-search`.

### 1.5 Page parameter was written as `page=1` (low)

Clicking "previous" from page 2 stored `?page=1`, which is not a state and differs from the canonical URL. Status: page 1 is stored as no parameter.

### 1.6 CSV export started with an invisible character (low)

`ui.downloadCsv` contained a literal U+FEFF inside the string. It is correct but invisible in editors and easy to lose in a copy. Status: written as the escape `'﻿'`.

### 1.7 Untranslated strings (low)

The toast close button, the load-error heading, the skip link and the main-navigation label were hard-coded German while everything else came from `i18n.json`. Status: keys `toast.close`, `loadError.title`, `skip`, `nav.main` are used; six unused keys (`fact.notDocumented`, `fact.values`, `fact.notCaptured`, `manual.chapters`, `header.logoAlt`, `print.title`) were removed.

## 2. Race conditions and re-rendering

### 2.1 Swagger UI was re-created by unrelated re-renders (medium)

Any full render on the API route (opening the help popover, pressing Escape, clicking on the page background with a menu open) replaced `<main>`, and `renderSwagger()` mounted a fresh Swagger UI instance that fetched `swagger.json` again. The `onComplete` callback of the previous instance could still fire against a detached node. Status: `setMenu()` re-renders `<main>` only when a menu inside it changed; the help popover re-renders only its own host. `renderSwagger()` mounts with `domNode` and checks `host.isConnected` after the asynchronous load. Verified: the `#swagger-ui` node survives a help open/close.

### 2.2 Swagger UI (1.55 MB script, 180 KB stylesheet) loaded on every page (medium)

Both files were static `<script>` / `<link>` tags in `index.html`, blocking the first render of the catalog for an API page most sessions never open, and applying the Swagger stylesheet globally. Status: `loadSwagger()` inserts the stylesheet before `main.css` (so the app's overrides keep winning) and the script on first visit of `#/api`, memoises the promise, and reports a load failure in the page. Verified: on the home page `SwaggerUIBundle` is undefined and no vendor request is made.

### 2.3 Menu open plus link click removed the link mid-event (low)

A click on an in-page link while a menu was open ran `closeTransient()` → `app.render()` during event dispatch, replacing the anchor before the browser followed it. Status: when the click target is a hash link to another route, only the state is reset and the `hashchange` render does the rest.

### 2.4 `views.suggest()` wrote to state (low)

A "pure" view filled `state.suggestFlat` and `state.suggestAllIdx` as a side effect of rendering; keyboard handling depended on the last render. Status: the view is pure; `app.js` derives the suggestion hrefs from `data.suggest()` when a key is pressed.

## 3. Accessibility of the render cycle

### 3.1 Focus was lost on nearly every control (medium)

`app.render()` replaces `main.innerHTML`, which drops focus to `<body>`. Sorting, grouping, view toggle, tab changes by mouse, group and tree toggles, paging, export and the relation view switch all sent keyboard and screen-reader users back to the top of the document. Two special cases (sort buttons, arrow-key tabs) restored focus by hand. Status: `replaceHtml()` records a selector for the active element (`data-focus`, `id`, or its `data-*` attributes; a menu item maps to its menu button), re-renders and refocuses without scrolling. The special cases are gone. Verified for sort, group toggle, Escape on a menu, and the help popover.

### 3.2 Help popover lost focus (low)

`renderHelp()` replaced the help button while it had focus. Status: uses the same `replaceHtml()`.

### 3.3 Chapter path label went stale on scroll (low)

The scroll spy updated `aria-current` on the chapter links but not the `is-active` row class or the current-chapter label next to the drawer button on narrow screens. Status: `updateChapterNav()` updates all three; `goChapter()` no longer re-renders the whole page.

## 4. Duplication and dead code

| Finding | Status |
|---|---|
| `KINDS` was defined in `router.js` and twice in `data.js` (`KINDS`, `ORDERED_KINDS`) | One list in `data.js`, exported as `data.kinds`; `router.js` reads it |
| `tableEntityLink` and `tableOptions` copied into `views.js` and `detail.js` | `ui.entityLink`, `ui.tableOptions` |
| Empty-state markup written five times | `ui.empty(title, hintHtml)` |
| `views.listRow` and `views.searchRow` differed by one cell | `views.row(kind, e, columns, withCount)` plus one `rowValues()` for sorting |
| `data.searchColumns` repeated the column labels of `data.columns` | Derived from `data.columns()` |
| Display name of tables (`name (technicalName)`) and APIs (`name version`) built in four places | `data.displayName(kind, e)` |
| Attribute-to-field naming rule duplicated from the generator inline | `ui.fieldName()` next to `ui.slug()` |
| Side panel (`<aside class="ob-tree-panel">`) and drawer chrome built separately for the tree and the handbook | `views.sidePanel()`, `views.drawer()` |
| Handbook chapters rendered by position (`sec(1, …)` … `sec(8, …)`) | Renderers keyed by chapter id, driven by `manual.chapters`; an unknown chapter renders nothing instead of throwing |
| Relation link builders `linkT` … `linkA` and `mk()` with per-call `.filter(Boolean)` | One `link` map keyed by kind; `mk(key, icon, kind, entities)` drops unresolved entities |
| `data.kpis()` built five identical objects by hand | Derived from `data.contentKinds()`; unit key is `unit.<kind>` |
| `state.isPhone` and its `matchMedia` listener re-rendered lists on breakpoint change but nothing read it (CSS handles the breakpoint) | Removed |
| `data.sub()` (tile subtitle) and `router.homeHref` were never called | Removed |
| `state.graph.scale` and the zoom transform had no zoom control left | Removed; the graph is pan only |
| `open-tree` handler read `el.dataset.toggle`, which no template set | Removed |
| `onRoute()` resolved the route twice and `app.render()` a third time | Once in `onRoute()`, once in `render()` (needed after `replaceParams`) |
| Tab normalisation in `onRoute()` used a two-clause condition that was hard to read | `wanted` vs `route.params.tab` comparison |
| Tree state on entity change set `treeOpen[route.kind]` even when the container model shows the entity under another section | Uses `sectionOf(route)` |

Net effect: `js/` went from 1667 to 1727 lines. The duplicates removed above are outweighed by the additions: reference validation, lazy loading, focus restoration, per-key i18n fallback and the null guards.

## 5. Documentation drift

| Finding | Status |
|---|---|
| `architecture.md` and `README.md` described graph zoom, a graph search box, `graph-zoom` / `graph-clear` actions and a `change` listener that no longer exist | Rewritten to match the code |
| `README.md` promised that the `tab` parameter is deep-linkable; `design-review-responsive.md` decided that a fresh load always opens Übersicht | README now states the rule |
| `architecture.md` said `data.sub` exists and listed the wrong helpers in `ui.js` | Updated |
| `data-model.md` described `i18n.json` as "UI strings per language" | Updated for the per-key layout |

## 6. Changes requested during the review

- Footer links: Rechtliches → `https://www.admin.ch/de/rechtliches`, Barrierefreiheit → `https://www.bbl.admin.ch/de/barrierefreiheit-in-der-bundesverwaltung`, Kontakt → `https://www.bbl.admin.ch/de/kontakt`; the Hilfe link was removed (the help popover and the main navigation already lead to the handbook).
- Header: the two title lines are top-aligned next to the logo; organisation and application name share one size (`--ob-header-title-font-size`, 17/28 px so that both lines fit next to the 53 px logo); the organisation reads "Bundesamt für Bauten und Logistik BBL".
- Tables: the first column (entity links and the `ob-cell-strong` cells of the handbook tables) is no longer semibold. The clickable row with its hover background remains the visual affordance for entity links.
- Breadcrumb: the home page no longer shows "Startseite › Übersicht" (a crumb pointing at itself under another name); it shows only the root. See the discussion below.
- `i18n.json`: restructured from language → keys to key → `{de, fr, it, en}` so a translator can validate one key across languages. `ui.setDictionary(table, lang, fallback)` picks the language per key and falls back to German. The fr/it/en values are machine drafts marked as such in the file's `_comment`; the language switch stays disabled until they are validated.

### Breadcrumb root

Federal sites (admin.ch, bbl.admin.ch) use "Startseite" as the first crumb, and Oblique's breadcrumb component is `ob-breadcrumb`, so the class name and the root label are conventional. The problem was only the home page, where the root and the page were the same thing under two names. Options considered:

1. "Startseite" alone on the home page, "Startseite › Geschäftsobjekte › Gebäude" elsewhere. Chosen: shortest path, keeps the federal convention, and the main navigation already tells the user they are in "Katalog".
2. "Katalog › Übersicht": mirrors the main navigation, but the handbook and API pages would then start at a different root, and every catalog crumb would repeat what the highlighted main-navigation item shows.
3. "Startseite › Katalog › Übersicht": complete, but three levels before the first real section, and the design review already measured the page chrome as too tall.

If the tree's root item "Übersicht" and the breadcrumb root "Startseite" should carry the same name, renaming the tree item is a one-key change (`tree.overview`).

## 7. Not changed, worth knowing

- **Render-everything strategy.** Each interaction rebuilds the whole `<main>` string. At the current data size this is a few milliseconds; a real catalog with thousands of entities would need at least memoised `buildGroups()` results and a virtualised table. Not a problem for the prototype.
- **`router.navigate()` calls `DK.app.onRoute()`** for same-hash navigation, a small upward dependency from router to app. Acceptable at this size; an event would decouple it.
- **The suggestion listbox becomes keyboard-focusable in Chromium** because it scrolls (Chrome 130+ makes scrollable containers focusable). Tab from the clear button lands on the listbox before leaving the search box. Harmless, but a `tabindex="-1"` on `.ob-suggest` would skip it.
- **Attribute → field relation** is a naming heuristic (`ui.fieldName`), shared with the generator; 38 of 94 attributes currently match a field. A real catalog would need an explicit mapping.
- **Unused CSS**: `.ob-button--ghost`, `.ob-button--outlined`, `.ob-print-only`, `.ob-sr-only` and the hooks `ob-collection-header`, `ob-entity-header`, `ob-view-tab`, `ob-fact-link` have no rules or no users. Kept as design-system vocabulary.
- **No automated tests are checked in.** The Playwright script used for this review lives outside the repository because the project deliberately has no `package.json`. Adding it under `docs/` or a `test/` folder with a one-line `npx playwright test` would make the manual checklist in `architecture.md` repeatable.
