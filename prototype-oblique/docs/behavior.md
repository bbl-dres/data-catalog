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

## Key facts

Detail overviews stack **Key facts**, **Protection and privacy** (*Schutz und Datenschutz*) and **System** in that order. Classification and personal-data handling belong to Protection and privacy. System shows identifiers, version, creation/modification dates and the existing source/synchronization metadata. All three sections remain expanded, with dashes for unknown values. Responsibility stays alongside on wide screens and follows them on narrow screens. This grouping does not change the catalog records or export contents.

Business objects, data tables and reference data share a **More information** list backed by `informationUrls`. Keep the row visible when empty; deduplicate links and accept only safe HTTP(S) URLs. Existing source links remain available in this list. Data-table and reference-data profiles omit separate source-document, source-context and definition-source rows; their provenance remains in the data and Excel metadata.

Reference-data profiles and collection tables use **Standard reference**, backed by `normReference`, matching business objects. Existing citation text is preserved without inferring an organisation record or a more precise standard identifier.

## Responsibility

Every entity profile shows organisation, data owner and data steward, retaining placeholders for applicable unknown values. Systems, tables, fields and APIs additionally show data custodian. Business definitions, domains, products and reference data have no custodian row. Fields inherit a table custodian and tables may inherit their system's custodian; API custodians are explicit.

Organisation and person links retain their documented website/directory targets. Dedicated email and phone values are removed from catalog records and the Responsible section. The GWR importer emits only its organisation contact-page URL. Application help contacts remain separate configuration.

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

## Data model PDF export

**Print** beside **Export** opens the output-only PDF workspace. The Export dropdown has no PDF options. The workspace supports business objects, data tables, reference data, products and APIs. Domain/system entry points select their business objects/tables. Grid and List include every documented child row, independent of a profile's field filter or pagination. APIs print documented endpoints and operation details; products include attributes, business-object members, source tables and serving APIs. Tiles provide an entity summary without child rows.

### Scope and filters

The independent catalog tree changes the export scope without navigating the application. Opening captures all supported sections in DE/FR/IT/EN; every later scope or document-language change uses that frozen content. The initial scope includes the current collection search. The scope chip, selection count and document summary make that boundary visible.

**+ Filter** opens a searchable checkbox menu. Choices within a facet combine with OR; different facets combine with AND. Available facets depend on the entity type and include domain, system, business object, status, responsibility, classification, origin and access where applicable. Counts refer to the tree scope. Facets with only one populated value are initially hidden, with **Show all facets** to reveal them. The tree's current grouping facet is represented by the scope instead of duplicated in the menu. Apply commits pending choices; Cancel/Escape discards them. Individual chips remove applied choices.

Tree checkboxes remember exclusions when changing scope; there are no persistent bulk-selection buttons. The finder changes visibility only. Reset filters appears when filters or an initial collection search are active and clears them while retaining the current tree scope and exclusions. A deliberate tree click or parent-scope action can broaden scope. Unmatched selected filters remain restrictive until removed. Empty filters offer Reset/parent scope; empty selection offers Select all for the filtered scope, including entries hidden by the tree finder. Neither produces blank pages or an enabled download.

### Document and layout

| Control | Behavior |
| --- | --- |
| Document | Title, optional document ID/version, document status, classification and optional overview. Apply changes the output settings only. The title follows scope until customized; reset restores the scope title. Document approval remains external. |
| Paper/orientation | A4–A0, default A3. Tiles/Grid start landscape; List starts portrait. Explicit orientation choices are retained. Physical text size is fixed; there is no print-scale control. |
| Tiles | Equal-width summary cards: alias, optional technical name, complete description, the same count/protocol summary and status as collection tiles. No attribute/field rows or profile facts. Cards flow left to right with equal height within each row; groups start new pages. A single selected entry remains a tile. |
| Grid | Default for objects, tables and products. Equal-width cards with section-specific columns flow down columns. Each group starts a new page and repeats its band on continuation pages. |
| List | Default for reference data/APIs. One continuous full-width table per content page, with an entity separator and one column header per page. An explicit layout choice survives scope changes. |
| Columns | Available in List and detailed single-entry profiles; hidden in Tiles. Name is always present. Code, type/format, required, key, code list and description are initially included. Length/unit, origin and modified date are optional. The menu shows a count and restores defaults without applying until confirmed. Missing values remain dashes. |
| Single entry | In Grid/List, uses full available page width, shows labeled facts on the first fragment and includes the complete row list. Table facts include business object, system, domain, responsibility and classification; empty values remain visible. |
| Overview | A group index with page references; automatic from three groups, or explicitly enabled/disabled. |
| Language | DE/FR/IT/EN for document labels and available catalog translations, using the existing fallback. Does not change application language or stored translations. |
| Preview | Whole page, page width or numerical zoom. Fit modes recompute when resized. Pages scroll vertically without a page picker or navigation arrows. Page numbers remain on the document and in screen-reader feedback. Only visible pages and neighbours mount SVGs. |

Cards repeat headings and row ranges on continuation; Grid/profile cards also repeat column labels. Splits occur between complete rows; a new fragment reserves at least five rows where the page can accommodate them. Zebra stripes restart in each fragment. A cell/header too large for the selected paper raises an actionable error and clears obsolete preview controls instead of clipping or dropping content. Business identifiers use ID, physical keys use PK/FK, and required markers reflect recorded data. Without a Grid key column, recorded markers appear beside the name. No relationship lines or inferred key metadata are added.

Pages share a two-part branded header and a three-part footer: document identity/status, creation/source/classification and page numbering. The source date is the latest recorded version date (or modification date) among selected entries; undocumented dates/classification remain dashes. Confidential/secret classification repeats in the header. The creator comes from app configuration, not authenticated approval evidence. PDFs contain vectors, embedded Noto Sans and selectable text; no PDF/A or PDF/UA conformance is asserted.

The workspace reuses the main application's footer component and language; it has no separate export footer. The toolbar keeps zoom, layout and grouping icons, plus dropdown chevrons. Document, paper, orientation, columns and filter menus use text labels without leading icons. Cancel is the single visible close action. Selection instructions and page feedback remain available to screen readers without repeating them visually. The PDF's own branded header/footer are independent of this workspace chrome.

The local PDF writer/fonts load on demand. Download shows page progress; Cancel, Escape or application navigation prevents a pending download. Asset-load failures show retry beside the error message. PDF metadata includes a SHA-256 digest of the frozen content/settings manifest. The workflow does not write catalog data, save document settings or manage approvals. On narrow or short screens, display controls and the scope tree use disclosures. Expanded controls scroll with the workspace; the preview retains a minimum usable height. Settings dialogs fit the visible area above the software keyboard and keep Apply/Cancel accessible while their contents scroll.

## Excel export

Excel is the structured export; the separate Print button opens PDF generation. CSV and PDF options are absent from the Export dropdown; DCAT export remains a placeholder. Export scope is captured in an immutable plan before the writer loads, so navigation during export cannot change its content. Duplicate actions are guarded and failed lazy loads can be retried.

Workbooks separate overview, entity kinds, attributes, fields, code values, metadata, source documentation, relationships and history into applicable sheets. Collection exports include all matching records, not only the visible page. Domain collection exports use its filtered business objects; domain Overview exports the domain context. Entity exports include the full schema. Related records are expanded only within the defined scope, not through an unbounded graph traversal.

Preserve translations, comments, source metadata and source positions even when the profile does not display those facts. Write catalog strings as literal text, including formula-like content and leading-zero codes. Keep numeric values typed separately. Long text uses continuation references rather than silent truncation; worksheet names and collisions follow Excel constraints. Tests read downloaded workbooks back to check values, scope and completeness.
