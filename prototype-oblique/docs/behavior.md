# Application behavior

These are the current interaction contracts. Module ownership and route construction are in [architecture.md](architecture.md); layout and visual states are in [design-system.md](design-system.md). The [test guide](../tests/README.md) maps these contracts to executable checks.

## Navigation and collections

Domain pages share the collection renderer with business-object lists. They offer **Overview, Tiles and Table**, defaulting to the preferred collection layout, initially tiles. Overview shows domain metadata; the other tabs browse its business objects. Domains have no relationship or history tabs. Legacy `tab=rows` opens Table; `tab=relations` or `tab=history` opens Overview. Domain collections start ungrouped unless an explicit grouping is supplied.

Repeated domains under reference data, products and APIs are section-scoped lists: selecting Energy under products must stay in products. Keep the section and domain in routes, breadcrumbs and active-tree state. Explicit `nav=entity|container` overrides survive links. Entering a domain or system opens its matching branch. Tree entries sort by displayed name; table labels include a verified technical name in parentheses. Overview has no aggregate count.

Collection history records the resolved layout and grouping so Back/Forward restores the original page independently of later preferences. Disclosure state includes the domain and group identity; collapsing a group in one domain must not collapse another domain's group.

Supported explicit profile tabs survive direct links and reloads. A new profile link without a tab can carry the preceding profile's supported tab; the resolved choice, including Overview, is stored in that history entry. Detail sorting and pagination restore from the URL, independently of later visits. Invalid values normalize to the actual displayed state. Handbook chapter links create history entries, passive scrolling updates the current chapter, and opening the handbook without a chapter starts at Introduction.

### Local search

Collection controls place search before grouping/actions. Detail row tabs use the same input for a system's tables, a table's fields, business-object/product attributes and code-list values. On narrow workspaces, controls wrap below the tabs.

- `filter` is local to the current collection or detail list; global search uses `q`.
- Match names, technical names, descriptions, identifiers and applicable table/context values, ignoring case and supporting umlaut alternatives.
- Filter the complete list before sorting and pagination. Changing the query returns to page one; tab counts retain the full count and the search status reports matches.
- Update results without replacing the input, caret or IME composition. Escape and the clear action reset the filter.
- Preserve the query through view/group changes and browser history. Bookmarked row tabs reopen on reload, with or without a filter.
- Collection exports use the filtered collection. An entity export includes its complete schema regardless of local row filtering or pagination.

## Key facts

Detail overviews stack **Key facts**, **Protection and privacy** (*Schutz und Datenschutz*) and **System** in that order. Classification and personal-data handling belong to Protection and privacy. System shows identifiers, version, creation/modification dates and the existing source/synchronization metadata. All three sections remain expanded, with dashes for unknown values. Responsibility stays alongside on wide screens and follows them on narrow screens. This grouping does not change the catalog records or export contents.

Business objects, data tables and reference data share a **More information** list backed by `informationUrls`. Keep the row visible when empty; deduplicate links and accept only safe HTTP(S) URLs. Existing source links remain available in this list. Data-table and reference-data profiles omit separate source-document, source-context and definition-source rows; their provenance remains in the data and Excel metadata.

Reference-data profiles and collection tables use **Standard reference**, backed by `normReference`, matching business objects. Existing citation text is preserved without inferring an organisation record or a more precise standard identifier.

## Visible information

The **View** (German: **Ansicht**) control sits between collection search and grouping, and beside search on detail row tabs. Its choices apply to Tiles and Table together, per displayed entity kind. Domain business-object collections share business-object preferences; system table lists share data-table preferences. Attribute, field, code-value and product-attribute lists each have their own selection. The `fields` URL parameter records ordered field IDs; `sort` records `field:direction`. These take precedence over browser preferences on reload. Existing `view`/`tab`, `group` and `filter` parameters restore layout and scope. Global search results and dashboard tables retain their fixed columns.

Names are mandatory; code values also retain their code. Web and print use the same compact choices for each entity type: descriptions, status, ownership, domain/system context, versions, counts and essential type-specific facts. Fields and attributes also offer data type, keys, required/nullability and value lists where applicable. Audit dates, internal IDs, comments, information links and other detailed metadata remain outside the picker, available through detail pages and Excel. Empty selected values remain `—`, and zero/false remain meaningful values. Names retain alias/technical-name formatting. Tiles show descriptions, labeled facts and count/status footers; tables show the same selection as columns. Labels remain translated in DE/FR/IT/EN.

Checkbox changes and Reset take effect immediately, including the toolbar count. The menu stays open and retains focus and scroll position. Close, Escape and outside dismissal keep the current selection; there is no Apply or Cancel step. Preferences persist in this browser, and retired choices are ignored when reading older preferences. Hiding the active sort field restores name ordering. Search still matches hidden metadata, and Excel exports retain their full schema regardless of visibility.

The print **View** picker is one list. Shared properties such as description, responsibility and version have one checkbox controlling both the entry and its child rows. Their values remain distinct in the output. Entry and child names remain separate, mandatory choices. Protocol and endpoint URL use shared choices even where their internal field IDs differ. Both dropdowns show a simple `(count)`; print counts unique choices, not physical PDF columns.

A mixed checkbox means a property is visible at only one level. Untouched mixed choices preserve existing independent preferences; clicking selects both levels, and unchecking hides both immediately. Reset immediately restores both types' defaults, including mixed defaults. Grid and List synchronize selections back to the corresponding main views. Tiles expose and reset entry fields only. These browser presentation preferences never write catalog records. Document identity/status and branding remain independent from entity column visibility.

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

**Print** beside **Export** opens the output-only PDF workspace. Collections inherit their current Tiles/Table layout, fields, grouping, search scope and entry order; Table becomes print List. List always includes the complete attributes, fields, values or endpoints of the selected entries, independently of web child-row filtering and pagination. Domain/system entry points select their business objects/tables. Detail pages default to List. APIs include documented endpoints and operation details; products include attributes, business-object members, source tables and serving APIs. The selector offers Tiles and List; Raster is not offered. The Export dropdown has no PDF options.

### Scope and filters

The independent catalog tree changes the export scope without navigating the application. Opening captures all supported sections in DE/FR/IT/EN; every later scope or document-language change uses that frozen content. The initial scope includes the current collection search. The scope chip, selection count and document summary make that boundary visible.

**+ Filter** opens a searchable checkbox menu with all applicable facets visible, including those with one populated value. Choices within a facet combine with OR; different facets combine with AND. Facets depend on the entity type and include domain, system, business object, status, responsibility, classification, origin and access where applicable. Counts refer to the tree scope. The tree's current grouping facet is represented by the scope instead of duplicated in the menu. Checkbox changes immediately update the preview, counts and chips while retaining the open menu, keyboard focus and scroll position. Close/Escape/outside dismissal keep these changes. Individual chips remove selected choices; Reset filters clears them.

Tree checkboxes remember exclusions when changing scope; there are no persistent bulk-selection buttons. The finder changes visibility only. Reset filters appears when filters or an initial collection search are active and clears them while retaining the current tree scope and exclusions. A deliberate tree click or parent-scope action can broaden scope. Unmatched selected filters remain restrictive until removed. Empty filters offer Reset/parent scope; empty selection offers Select all for the filtered scope, including entries hidden by the tree finder. Neither produces blank pages or an enabled download.

### Document and layout

| Control | Behavior |
| --- | --- |
| Document | Title, optional document ID/version, document status, classification and optional table of contents. Apply changes the output settings only. The title follows scope until customized; reset restores the scope title. Document approval remains external. |
| Paper/orientation | A4–A0, default A3. Portrait is listed before landscape. Tiles start landscape; List starts portrait. Explicit orientation choices are retained. Physical text size is fixed; there is no print-scale control. |
| Tiles | Equal-width summary cards with the same selected metadata as collection tiles; selected descriptions are complete in the PDF. No attribute/field rows. Cards flow left to right with equal height within each row; groups start new pages. A single selected entry remains a tile. |
| List | A descriptive summary of selected entries and their domains/systems precedes the detailed lists. Entry descriptions appear once in this summary, governed by the View selection. Child descriptions remain in the detailed table. Every detailed row identifies its parent, with other selected parent facts as ordinary columns. No entity separator bands. Section titles and column headers repeat per page; groups start new pages. |
| View | Available in both layouts and synchronized with the main views. One compact list merges shared entry/child properties in List; Tiles shows entry choices only. Names stay selected, as does code for code values. Checkboxes and Reset update immediately. Missing values remain dashes. |
| Single entry | List retains its summary and detailed rows. Entries without child rows remain identifiable through an empty child row and a zero count. |
| Table of contents | First in every multi-page document by default, including ungrouped exports; can be explicitly enabled/disabled. Two levels: section/group headings, then individual entries. Both levels have clickable page references in the preview and PDF. Group counts remain separate from ownership. Long names and long contents paginate without losing destinations. |
| Language | DE/FR/IT/EN for document labels and available catalog translations, using the existing fallback. Does not change application language or stored translations. |
| Preview | Whole page, page width or numerical zoom. The fit dropdown comes first, followed by zoom out, percentage and zoom in. Fit modes recompute when resized. Pages scroll vertically without a page picker or navigation arrows. Page numbers remain on the document and in screen-reader feedback. Only visible pages and neighbours mount SVGs. |

The List sections use plain headings: Entries and context, then Attributes, Fields, Values or Endpoints. Group labels appear beneath the detail title without filled bands. Contents, group headings and document summaries use the same counts: entries in every layout, plus child rows when printed. Product rows combine attributes and component references, so their count remains labelled Rows. Responsibility grouping is available for all web collections and all five printable kinds, using `responsibleOrg`. Organisation names sort alphabetically in the active language, with unspecified responsibility last.

PDF columns measure headers and actual values using the embedded font. Short statuses, counts and booleans reserve enough width; names and context columns stop growing once their values fit, leaving remaining space for descriptions. Long values wrap, and a genuinely overfull selection produces the existing paper/orientation/column guidance.

Print preserves the collection order and URL-selected sort from system tables and detail rows. Child-row exports still include every source row, independently of the web filter or current page; the print scope and subsequent controls determine which entries are exported. Changing export scope clears inherited ordering; the frozen catalogs remain unchanged.

Dropdown ordering stays stable across selections. Paper sizes run from A4 to A0 (small to large); preview lists fit modes before ascending zoom percentages. Grouping follows the main app (None, context, responsibility, other applicable facts and status). Document status follows its lifecycle, classification increases in sensitivity, and the contents option lists Automatic, Yes, No. Filter names use the document language's alphabetical order. A selected default does not move an option to the top. The View checklist follows the shared attribute order, not alphabetical order.

Grid cards repeat headings, row ranges and column labels on continuation. Splits occur between complete rows; Grid reserves at least five rows where the page can accommodate them. List zebra stripes continue across entity boundaries and restart per page. Text aligns left; numeric counts align right. A cell/header too large for the selected paper raises an actionable error and clears obsolete preview controls instead of clipping or dropping content. Long repeated entry descriptions can create many List pages; users can hide those columns or choose larger paper. Business identifiers use ID, physical keys use PK/FK/UQ, and required values reflect recorded data. Hidden columns do not reappear as name decorations. No relationship lines or inferred key metadata are added.

Pages share a two-part branded header and a three-part footer: document identity/status, creation/source information and page numbering. The source date is the latest recorded version date (or modification date) among selected entries; undocumented dates remain dashes. Classification is retained in document settings and the source manifest, with no printed classification labels or extra header spacing. The creator comes from app configuration, not authenticated approval evidence. PDFs contain vectors, embedded Noto Sans and selectable text; no PDF/A or PDF/UA conformance is asserted.

The workspace reuses the main application's footer component and language; it has no separate export footer. Document, paper, orientation and preview controls sit on the left; layout, view and grouping sit on the right. Layout uses a visible horizontal Tiles/Grid/List toggle with a pressed state. Vertical dividers follow orientation and layout; dividers disappear when these groups occupy separate mobile rows. Preview puts its dropdown before zoom controls. Cancel closes the workspace; live pickers use Close. Selection instructions and page feedback remain available to screen readers without repeating them visually. The PDF's own branded header/footer are independent of this workspace chrome.

The local PDF writer/fonts load on demand. Download shows page progress; Cancel, Escape or application navigation prevents a pending download. Asset-load failures show retry beside the error message. PDF metadata includes a SHA-256 digest of the frozen content/settings manifest. The workflow persists visibility preferences only; it does not write catalog data, save document settings or manage approvals. On narrow or short screens, display controls and the scope tree use disclosures. Expanded controls scroll with the workspace; the preview retains a minimum usable height. Settings dialogs fit above the software keyboard and keep their actions accessible while contents scroll. Only document settings retain Apply/Cancel.

## API reference

The API view renders the generated Supabase public-read contract. “Try it out” queries the configured project with its public application key; users do not log in. Table GETs support PostgREST filters, projection and pagination. The snapshot POST is a read-only function. No create, update, delete, simulated search or simulated export routes are offered. Swagger retains its filter, expanded operations and inputs across application chrome updates and viewport changes; leaving the route resets the reference. See the [API guide](api.md) for the contract and access boundaries.

## Excel export

Excel is the structured export; the separate Print button opens PDF generation. CSV and PDF options are absent from the Export dropdown; DCAT export remains a placeholder. Export scope is captured in an immutable plan before the writer loads, so navigation during export cannot change its content. Duplicate actions are guarded and failed lazy loads can be retried.

The menu offers two modes:

- **Excel: Current selection** exports the current collection or detail entry. Collection exports include all matching records, not only the visible page. Domain collection exports use its filtered business objects; domain Overview exports the domain context. Entity exports include the full schema. Related records are expanded only within the defined scope, not through an unbounded graph traversal.
- **Excel: Entire catalog** exports every domain, system, business object, data table, reference list, data product and API, with their detail sheets. It ignores the originating view's filters, pagination, sorting and collapsed groups. Entries sort alphabetically within each entity sheet. This is the complete catalog content available to the app, not a database backup or export of application configuration.

Both modes separate overview, entity kinds, attributes, fields, code values, metadata, source documentation, relationships and history into applicable sheets. The overview identifies the scope and entry count; the complete-catalog workbook records no applied search filter. Both menu actions are disabled during generation. Child identifiers are scoped to their parent to prevent collisions across data products.

Preserve translations, comments, source metadata and source positions even when the profile does not display those facts. Write catalog strings as literal text, including formula-like content and leading-zero codes. Keep numeric values typed separately. Long text uses continuation references rather than silent truncation; worksheet names and collisions follow Excel constraints. Tests read downloaded workbooks back to check values, scope and completeness.
