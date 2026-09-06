# Application behavior

These are the current interaction contracts. Module ownership and route construction are in [architecture.md](architecture.md); layout and visual states are in [design-system.md](design-system.md). The [test guide](../tests/README.md) maps these contracts to executable checks.

## Navigation and collections

Domain pages share the collection renderer with business-object lists. They offer **Overview, Tiles and Table**, defaulting to the preferred collection layout, initially tiles. Overview shows domain metadata; the other tabs browse its business objects. Domains have no relationship or history tabs. Legacy `tab=rows` opens Table; `tab=relations` or `tab=history` opens Overview. Domain collections start ungrouped unless an explicit grouping is supplied.

Repeated domains under reference data, products and APIs are section-scoped lists: selecting Energy under products must stay in products. Keep the section and domain in routes, breadcrumbs and active-tree state. Explicit `nav=entity|container` overrides survive links. Entering a domain or system opens its matching branch. Tree entries sort by displayed name; table labels include a verified technical name in parentheses. Overview has no aggregate count.

Collection history records the resolved layout and grouping so Back/Forward restores the original page independently of later preferences. Disclosure state includes the domain and group identity; collapsing a group in one domain must not collapse another domain's group.

### Local search

Collection controls place search before grouping/actions. Detail row tabs use the same input for a system's tables, a table's fields, business-object/product attributes and code-list values. On narrow workspaces, controls wrap below the tabs.

- `filter` is local to the current collection or detail list; global search uses `q`.
- Match names, technical names, descriptions, identifiers and applicable table/context values, ignoring case and supporting umlaut alternatives.
- Filter the complete list before sorting and pagination. Changing the query returns to page one; tab counts retain the full count and the search status reports matches.
- Update results without replacing the input, caret or IME composition. Escape and the clear action reset the filter.
- Preserve the query through view/group changes and browser history. A bookmarked `tab=rows` filter reopens the row tab on reload.
- Collection exports use the filtered collection. An entity export includes its complete schema regardless of local row filtering or pagination.

## Global search

Home, results and the expandable header share the same search form/combobox. Results initialize from the decoded `q` parameter. On home/results, the header magnifier focuses the page form. Only one search input/listbox is active at a time, and page load does not autofocus it.

The learning dropdown offers a small set of example queries/questions, filtered by the selected domains and content types. It supports arrow navigation, Enter, Escape, Tab and pointer selection. Empty Enter does not search. Suggestions sit below the complete form and fit the visible viewport, including when the software keyboard opens.

### Scope and results

The scope disclosure lists domains first, then content types and the optional AI-answer demo. Submitted results use one table with **Name, Type, Context, Description and Status**. Type is a column and filter; results are not split into separate tables.

| URL parameter | Contract |
|---|---|
| `q` | Submitted query, distinct from an unsubmitted input edit. |
| `domains`, `types` | Selected identifiers. Omitted means all; explicit `none` means none. Unknown values are discarded without broadening an empty selection to all. |
| `ai` | `0` disables the answer demo. |
| `sort` | `relevance` (default), `name` or `modified`; stable tie-breaking, unknown dates last. |
| `page` | Global result page; default 1. |
| `size` | 20 (default), 50 or 100. |

Default pagination/sort values are omitted from the URL. Sort, size and page changes create history entries; scope normalization updates the current entry. Query/scope/sort/size changes reset page one, while toggling the answer alone preserves the page. New queries retain the chosen size and sort. Pagination must not submit an unfinished input edit.

Rank and sort the entire matching set before slicing the page. The top controls show the entry range and sort selector, without navigation arrows. The bottom pager contains page navigation and page size, without a duplicate range. No matches hides the pager; a single page disables navigation.

### Answer demo

The AI-answer box is explicitly a deterministic demo. It selects up to three description excerpts from strong matches within the current filters, cites their actual catalog entries and avoids duplicate sources. If evidence is insufficient, it must not fabricate an answer. Question handling uses lexical matching and a term fallback; it is not semantic retrieval. No model service, API key or external query is involved. The answer box uses the same width as the results table.

Pagination bounds rendered results; the static prototype still loads its complete catalog. Production retrieval and answer generation require separate implementation.

## Relationship diagram

The relationship tab defaults to a bubble diagram. Its **Show list** toggle is on the right of the tab row, outside the semantic tablist. The alternative is one shared sortable table with Entry, Relationship and Context; print uses this table. Local updates preserve the user's diagram/table choice.

Circular groups surround a central entity with undirected connections: these are associations, not lineage. Layout bounds include circles, captions and paging controls. Groups display at most six entries per page, or three below 640 px of canvas width. Paging keeps bubble size bounded; a narrow canvas arranges groups vertically. Full labels are available through titles and selection details.

The diagram uses the available height below the tabs with a minimum working height. Controls provide bounded zoom (15–200%), fit/reset, 100%, pan/select modes, directional movement and fullscreen. Clicking a node selects it and exposes an explicit open-entry link; dragging must not activate a node. Keyboard arrows pan, `+`/`-` zoom, `0` resets, and focused offscreen entries are brought into view.

Inline touch input retains native page scrolling and browser zoom. Fullscreen moves the existing workspace into a native modal dialog; one finger pans and two fingers zoom. Escape closes it, and closing/navigation restores the appropriate focus. A route change closes the dialog. The shell remains scrollable on short screens so controls are reachable.

The graph suite checks overlap, paging, selection, keyboard/touch input, print and a 1,000-relationship fixture; bounded geometry is also checked at 10,000 entries. This does not establish unlimited catalog performance.

## Excel export

Excel is the structured export; print-to-PDF is also available. CSV is removed and DCAT export remains a placeholder. Export scope is captured in an immutable plan before the writer loads, so navigation during export cannot change its content. Duplicate actions are guarded and failed lazy loads can be retried.

Workbooks separate overview, entity kinds, attributes, fields, code values, metadata, source documentation, relationships and history into applicable sheets. Collection exports include all matching records, not only the visible page. Domain collection exports use its filtered business objects; domain Overview exports the domain context. Entity exports include the full schema. Related records are expanded only within the defined scope, not through an unbounded graph traversal.

Preserve translations, comments, source metadata and source positions even when the profile does not display those facts. Write catalog strings as literal text, including formula-like content and leading-zero codes. Keep numeric values typed separately. Long text uses continuation references rather than silent truncation; worksheet names and collisions follow Excel constraints. Tests read downloaded workbooks back to check values, scope and completeness.
