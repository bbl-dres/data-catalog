# Search scope and AI-answer demo

The search disclosure in `service-portal/js/search/search-ui.js` informed this interaction. The catalog uses its own Oblique components and spacing tokens. The hero remains white; only the expanded filter panel has a grey surface.

## Behavior

- **Auswählen** below the hero opens the filter panel: domains first, content types second, and the AI option last. The same component appears above search results. It starts collapsed and stays open while making selections.
- All domains and all seven existing searchable kinds are selected initially. Each group allows multiple selections; a match must satisfy both groups. Suggestions, keyboard selection, results and answer sources share this scope. Collection filters remain independent.
- Each group has its own **Alle abwählen** and **Alle einschalten** controls. Selecting none in either group prompts for a selection and disables submission. It never silently searches excluded content. Resetting one group preserves the other group and the AI preference.
- Domain membership follows the catalog's existing associations, including the business object that a table implements. Systems are included if one of their tables or APIs belongs to a selected domain. Searching all domains also includes records without a domain assignment. The **Domänen** content type searches domain definitions themselves; it remains independent of the domain filter.
- **KI-Antworten anzeigen** is enabled initially, matching the reference. Answers carry a **Demo** badge, can be hidden, and link to their catalog sources with source statuses.
- Desktop has two checkbox columns; narrow content uses one. Native checkboxes have clickable labels, shared focus styling and at least 44 px label height on touch/mobile. The panel expands in document flow.
- Changing options preserves the input node, query, checkbox focus and open panel. Escape closes suggestions without also clearing the search input.
- Home and search results render the same prominent form. Results prefill it from the decoded `q` URL parameter on entry, reload and Back/Forward. Editing or clearing keeps the last submitted results until a new search; submission retains the selected domains, types and AI preference. The header magnifier reveals and focuses the page form instead of opening a duplicate field.
- The AI-answer box occupies the same available width as the result tables below. The input and filter panel retain their shared hero-form width and responsive controls.

## One result table and global pagination

Search results use one table with **Name, Typ, Kontext, Beschreibung, Status**. Grouping the results by type could place weak matches in the first group above stronger matches in later groups. Type and domain filters already provide that narrowing, so result types now appear together in one ordered list. The context column retains the metadata previously supplied by each type's table (for example, a system, responsibility or access information). Suggestions retain their compact type groups.

**Sortierung** defaults to **Relevanz** across all matching records, regardless of type. **Name A–Z** and **Zuletzt geändert** are explicit alternatives; sorting applies before pagination. Equal-ranked records have deterministic name/type/identifier tie breakers. Records without a modification date appear last when sorting by date. The separate sort control also works when the table adapts into mobile cards; there is no competing per-column sort.

The default is **20 results per page**, with **50** and **100** available. Above the table, the global result range appears beside the sort control, without navigation arrows. The pager below the table displays the current page and previous/next on the left, with page size on the right; it does not repeat the range. Empty results omit pagination; a single page disables previous/next. Search and detail tables share `ui.pageState()` and `ui.pager()`; detail tables retain their existing range display and 50/100/200 options.

The URL owns `page`, `size` and `sort`. Page 1, size 20 and relevance are omitted as defaults. Invalid sizes/sort modes fall back to those defaults; invalid page numbers become page 1, and page numbers beyond the final page are clamped. Pagination, page-size and sort changes create history entries, so reload and Back/Forward restore the same selection. New queries, type/domain changes, sort changes and page-size changes start at page 1; new queries retain the selected size and sort. Changing AI visibility keeps the current result page. Paging preserves unsubmitted search edits and moves focus/scroll to the start of the results, including when using the bottom pager.

The result range is the only count display; there is no separate line repeating the query and total above the AI answer. The total in that range and the AI answer always use the complete filtered matching set. They do not change merely because the user changes the page or sort order. The answer remains aligned with the table width.

This is client-side pagination of the prototype's existing in-memory catalog. It bounds rendered rows; it does not reduce fixture loading or replace retrieval with a server API. A future backend should accept the same query, filters, sort and page settings and return a total plus one ordered result page.

Core checks cover global ranking across types, complete page traversal without missing/duplicate records, both alternative sorts, invalid parameters, empty sets and unchanged input data. Browser checks cover real GWR results at desktop and phone widths, keyboard paging, history/reload, filters, sorting, size changes, empty results, stable answer sources and responsive controls.

## Learning dropdown

Like `service-portal/js/search/search-suggest.js`, the empty focused search field offers examples. There are four: **Was ist GWR?**, **Gebäude**, **Energieverbrauch**, and **Bauprojekt**. The question demonstrates natural-language input; the other examples demonstrate keyword searches. Examples appear in the shared combobox on home, results and header search, without persistent links below the field or an automatic popup on page load.

Only examples with matches in the selected domains and content types appear. Selecting an example fills and submits that query with the current filters and AI preference. Typing replaces examples with matching records; clearing restores examples. Arrow keys and Enter select an example, Escape dismisses the popup, and Tab or an outside click closes it. Enter on an empty field without a selected example does nothing. The shared viewport limits keep the dropdown scrollable above a mobile keyboard; example text may wrap.

The question and teaching labels follow the UI language. Keyword examples retain the German names used by the current catalog records. Core checks verify matching in all four UI languages and filter exclusions; browser checks exercise focus, keyboard navigation, dismissal, query selection and preserved scope at desktop and phone widths. A 390 × 280 px touch check covers a short visible viewport: revealing the field is deferred until after the focus/click sequence so scrolling cannot retarget and dismiss the opening tap.

## URL state

`types` and `domains` are comma-separated allowlists of kind and domain IDs. Omission means all; `types=none` or `domains=none` explicitly means none in that group. Unknown IDs are discarded, so a wholly invalid selection does not broaden the search. `ai=0` hides the answer; omission enables it.

```text
#/?types=tables,refs&ai=0
#/search?q=GWR&types=tables
#/search?q=Was+ist+ein+Gebäude%3F&types=objects,tables
#/search?q=Energie&domains=energie,projekt&types=products,tables
#/search?q=GWR&page=2&size=50&sort=name
```

Option changes replace the current URL without adding history entries for each checkbox. Submitting creates a results navigation. Reloading or returning to a results URL restores its options. Opening the plain home URL resets defaults. Result filtering uses the submitted URL query, independently of unfinished edits in the search field.

## Implementation and limits

`js/search.js` owns option normalization, serialization, scoped retrieval, global ordering/pagination and the answer demo. `data.search()` supplies keyword matching and grouped suggestions; `search.page()` orders matching records across types before slicing. `app.js` refreshes the options and results without replacing the input.

Simple questions can fall back to significant words when the literal query finds nothing. Every remaining term must match the same record. This is lexical matching, not semantic search. Disabling answers does not change retrieval. Embedded attributes and fields are not new search categories in this change.

The answer assembles up to three short, verbatim excerpts from the strongest matching descriptions, each with a citation. It omits weaker matches so, for example, a definition of GWR does not acquire unrelated code-list excerpts. Equal-ranking candidates with provenance are preferred; duplicate descriptions are omitted. No-match searches show an empty answer without unrelated sources. There is no model call, API key or external transmission of the query. A future AI integration can replace this adapter while retaining the scope and citation contract.

Core tests cover option normalization, URL round trips, combined domain/type filters, multi-domain systems, unassigned records, excluded answer sources, question fallback, no matches, source excerpts and escaping. Functional browser tests cover both filter groups, keyboard selection, query retention, source links, reload, empty selection and AI toggling at 1440, 390 and 320 px widths.
