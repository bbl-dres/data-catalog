# Tiles and print layout

Implementation record and gap review for the [6 September design study](wireframes/2026-09-06-tiles-and-print-layout.html).

The current [behavior guide](behavior.md#visible-information) includes subsequent changes: shared field visibility, flat List columns and the revised print toolbar. It takes precedence over the original decisions recorded below.

## Agreed direction

Implemented tile option **1a** and the print workspace **2c**, with the inline filter menu **2e** and **Grid / List** layouts. Landscape and the entire UML view are deferred, as agreed. The wireframe is a visual reference; its sample field codes, inferred keys, relationships, counts and dates are not catalog data.

## Initial findings

| Area | Current limitation | Recommendation |
| --- | --- | --- |
| Tiles | Narrow cards combine aliases and long technical identifiers; descriptions are cut after two lines. | Separate the title, optional technical name, three-line description and count/status footer. Share the component across collections; use a 300 px minimum with a single-column fallback. |
| Print controls | Document metadata, filters and selection compete in a tall sidebar. | Move document settings, page controls and grouping to the toolbar; use removable filter chips and a filter dropdown. Keep the sidebar for catalog scope and selection. |
| Scope | Changing the system or collection requires reopening the export. | Capture the catalog when opening, then allow explicit scope changes in an independent catalog tree. Preserve filters where applicable and make the current scope visible. |
| Pagination | Row-based packing leaves space beneath short cards; oversized entities are split before placement. | Flow complete rows down columns, repeat entity and column headers on continuation, start each group on a new page, and avoid fragments with fewer than five rows where space permits. |
| Document | The header and footer use too much vertical space and omit useful document context. | Use the study's two-part branded header and three-part footer, document status/classification, creator and actual source dates. Add an optional group overview with page references. |
| Reading | One grid layout cannot serve both overview and detailed review. | Add a full-width List layout with configurable columns, zebra rows, and complete text. Keep physical print size fixed; preview zoom never changes pagination. |
| Language and accessibility | Document language follows the application; small toolbar controls can clip. | Allow independent DE/FR/IT/EN document language, fitting zoom modes, keyboard controls, visible empty states and responsive controls. |

## Implementation sequence

1. Refactor the shared tile and add a direct Print action beside Export.
2. Extend immutable export content for catalog scopes, translated content, facets and list columns.
3. Implement Grid/List pagination and shared page branding, metadata, continuation and overview.
4. Rebuild the responsive print workspace around scope, document settings, inline filters, selection and scrollable pages.
5. Verify source fidelity, pagination, language changes, filtering, cancellation, responsive layouts and actual vector PDFs. Update the maintained guides with the final behavior.

## Data and workflow rules

- This remains an output-only workflow. Document settings are temporary; no catalog records or approval status are changed.
- Excel and existing export-menu entries remain available; DCAT remains a placeholder. Unknown metadata is shown as a dash; no keys, classifications, source dates or relationship assertions are invented.
- Print starts with the current scope and collection search. Broadening scope requires an explicit tree selection; reset filters does not silently change scope.
- Grid/List retain all fields, attributes and code values, including empty values. The subsequently requested Tiles layout intentionally exports entity summaries without child rows. Preview virtualization must not change the downloaded content.
- Archived wireframes and prototype snapshots remain unchanged.

## Validation

- All 33 core checks, functional navigation checks and existing design-polish checks passed.
- Print tests covered 320 combinations of DE/FR/IT/EN, A4–A0, both orientations, Grid/List and table groupings. Every source row appeared exactly once, within page bounds and without overlapping cards.
- Actual PDFs were checked for complete source labels/codes, matching preview text, embedded fonts, physical dimensions, vector graphics, page bounds and matching content-manifest hashes.
- Browser checks covered 320–1920 px widths, short landscape screens, scope/filter changes, custom columns, document-language isolation, keyboard dismissal, asset retry and cancellation without downloading.
- Real content differs from the abbreviated wireframe. The migrated GWR fixture has 146 fields and uses three A3 Grid pages; the default seven-column List uses eight A3 portrait pages after the continuous-table refinement with complete descriptions. Reducing columns changes the page count without omitting rows.

The maintained [behavior guide](behavior.md#data-model-pdf-export) defines the final controls and scope rules; [architecture](architecture.md) describes module ownership. Test outputs remain in the OS temporary directory.

## Wireframe gap review — 6 September 2026

Tile option 1a and the main print workflow are implemented. The subsequent [code review](review/2026-09-06-print-code-review.md) resolved the substantive gaps below and added lifecycle regressions. Optional visual differences remain deferred.

### Matched

- **1a:** separate alias and technical name, three-line description, count/status footer, shared 300 px minimum width and direct Print action.
- **2c / 2e:** catalog scope tree, independent selection, removable filters, searchable facet menu, scoped counts, retained filters and scrollable preview.
- **2h / 2l:** group page breaks, column flow, repeated headings and complete field rows across continuation pages.
- **2j / 2n:** optional overview with page references, temporary document metadata, title following scope until edited, branded header/footer and independent document language.
- **2o:** empty results suppress pages and disable download; filters and tree remain available for recovery.

### Findings and resolution

| Area / reference | Resolution after code review |
| --- | --- |
| Page feedback, 2c | Fixed: page picker and summary track the same page; failed layouts clear obsolete controls. |
| Language, 2c / 2n | Fixed: stable classification values with DE/FR/IT/EN labels in controls and PDF. |
| Other sections, 2m | Fixed: existing product members/sources and API operation details are included. |
| Single-table profile, 2k | Fixed: labeled facts include business object, system and entity classification; empty values remain visible. |
| Section defaults, 2m | Fixed: List defaults for reference data/APIs; Grid columns and labels match each section. Explicit choices are preserved. |
| List and columns, 2i | Fixed: continuous table, one column header per content page, reset/default count and recorded length/unit support. |
| Scope and recovery, 2k / 2o | Fixed: full scope path, explicit parent-scope action retaining filters, separate empty-selection recovery. |
| Overview and toolbar, 2j / 2c | Shared app icons now identify document, paper, orientation, layout, grouping, columns and filter controls. Expanded overview body and adjacent layout buttons remain optional; native selects and selection controls remain. |

### Accepted differences and deferrals

- UML, UML relationship lines and the Landscape collection view remain explicitly deferred. Landscape here is the collection mode, not the supported landscape paper orientation.
- Options 1b/1c and filter alternatives 2f/2g were not selected.
- Real descriptions, technical types and unverified keys differ from the mock data. The GWR page-count difference (three Grid pages; eight default List pages after the code review) is not itself a defect: full source text must take precedence over matching the mock page count.
- Responsive disclosures and selection controls preserve existing capabilities. Native selects are a visual difference, not missing functionality.
- Document settings apply on confirmation and can be cancelled. This is a reasonable interpretation of the study's Apply/Cancel controls, despite its accompanying text mentioning immediate preview changes.

### Review evidence

Compared annotated study sections, implementation code, workspace screenshots and actual PDFs. Focused browser checks reproduced the original stale page summary, product-row omission and untranslated classification. The [code review record](review/2026-09-06-print-code-review.md) documents the fixes, source-to-export assertions, race-condition checks and final PDF validation. These local checks do not contact or modify the hosted catalog.

### Follow-up: summary tiles and dropdown icons

Added **Tiles** alongside Grid/List at user request. This matches the collection cards: alias, technical name where available, complete description, count/protocol and status badge. Tiles share a width and align in rows, with no attribute/field table, including single-entry scopes. Grouping, filters, selection, branding and scrolling remain shared with the detailed layouts. Native selects and popover buttons reuse the main application's decorative icons; their accessible labels and keyboard behavior remain intact.

Validated 200 tile combinations across five entity types, four languages, A4–A0 and both orientations, plus responsive controls at 320–1600 px and actual object/GWR PDFs. Detailed Grid/List and lifecycle regressions also passed. See [print tile checks](../tests/print-tiles.cjs) and [PDF inspection](../tests/diagram-pdf.py).

Keep the optional visual differences for user feedback; UML and Landscape remain deferred.

### Follow-up: quieter print workspace

The [decluttering review](review/2026-09-06-print-declutter-review.md) supersedes the earlier page picker, bulk-selection controls and decorative dropdown icons. Pages now use scrolling alone. The workspace reuses the catalog footer, keeps one Cancel action and shows filter reset only when applicable. Document branding and all three PDF layouts remain unchanged.
