# Compact sidebar layout — option 1b

Implemented 2026-09-05 from [260803_compact design.html](wireframes/260803_compact%20design.html), **1b Seitenspalte – bevorzugt**. This document supersedes the earlier layout recommendations in the design reviews where they differ.

Review the implemented [desktop profile](compact-layout-desktop.png) and [phone profile](compact-layout-mobile.png).

## Implementation plan

1. Preserve a runnable snapshot before editing the application.
2. Replace the two-row header with the 56 px sticky header, compact federal logo, primary navigation, expandable search and utilities.
3. Share one sidebar between the catalog and handbook: 240 px expanded tree, 56 px icon rail, click-to-open flyouts, saved expansion preference and a mobile drawer.
4. Apply the 24/32, 17/24, 14/20, 13/18 and 12/16 type scale, compact rows, filled F2 cards and T8 tree icons/ancestor states.
5. Recompose profiles with type/status beside the title, export in the title row, counted tabs, and facts/contacts in two columns. Implement the selected normal-flow attribute table and 50/100/200-row pagination.
6. Verify desktop, phone, tablet and wide-monitor layouts, keyboard behavior, search, navigation, data rendering and exports.

## Result and interpretation

- The original runtime files and supporting documentation are preserved in [before-1b-2026-09-05](wireframes/before-1b-2026-09-05/index.html). Its 70 files were verified byte-for-byte before implementation. The wireframes directory is excluded to avoid recursively copying the archive into itself.
- The primary header and sidebar stay visible while the document scrolls. The footer remains at the end of the document. Sidebar contents scroll independently when they exceed the available height.
- The expanded sidebar is the initial default. Its collapsed state is saved as `datenkatalog.sidebarCollapsed` in local storage. On the rail, clicking a section opens its navigation flyout; Escape, its close button, choosing a destination or clicking outside closes it. The top arrow pins the full tree again.
- Search moves into the header. The magnifier reveals the existing search field, ranked suggestions and keyboard controls; Escape dismisses suggestions first, then the field. On narrow screens the input opens immediately below the header.
- The mockup's 2a home and 2b handbook screens belong to the 1b column and are included. Home uses five filled KPI cards, an 800 px domain table and a 928 px recent-changes table. Column headings remain sortable.
- Profiles display their type and status beside the title. Status is no longer repeated in the facts. Core facts appear on the left, contacts on the right; additional metadata expands within the core-facts column. Tab counts are calculated from the actual data, including relationships and inherited attribute history.
- The selected 3b attribute-table behavior is included: document scrolling, headers sticky below the application header, and pagination at the bottom. The default page size is 50, with 100 and 200 available through the page-size selector (`size` in the route). Attribute rows expose position and requiredness already present in the data. Sorting precedes pagination; exports include all rows.
- At 960 px and below the sidebar becomes a modal drawer with primary navigation above the tree and language/help below it. Background content is inert while it is open; Tab stays inside and Escape restores focus to the opener. Touch controls use larger targets. Profile facts stack below 600 px, the export button becomes an icon, and tables use labelled cards.
- Above 2560 px, header, workspace and footer contents share a centered 2560 px band. The surrounding background is secondary-50 and content padding increases to 48 px.
- All catalog data is retained. The mockup's expanded 60-attribute example is not added to the fictional catalog. Existing CSV, print, relationship, grouping, language and API behavior remains available; Excel, UML and DCAT exports retain their existing placeholder notices.

## Files

`index.html` defines the compact header. `views.js` owns the sidebar/rail/drawer, header search and page composition. `app.js` owns interaction state, focus, persistence and pagination events. `detail.js` owns the profile layout, counts and row presentation. `tokens.css`, `main.css` and `i18n.json` provide the compact styling and translated controls.

## Validation

Headless Edge checks passed for the 56 px header, 240/56 px sidebar, persistence and flyouts, keyboard search, tab continuity, desktop graph panning, mobile drawer focus, language/help, handbook chapters, pagination and sorting with 123 temporary attributes, CSV/print actions, Swagger UI, the 2560 px centered band and the original backup. The temporary attributes exist only in the test browser, not in the JSON files. No browser errors or failed requests were observed.

Rendering checks exercised 1,144 combinations of collections, grouping, profiles, attributes and tabs across both navigation models. Responsive checks covered 320, 390, 600, 768, 960, 1024, 1280, 1920 and 3840 px with no horizontal page overflow; API checks additionally covered 390, 1024, 1280 and 3840 px. Screenshots were compared with the bundled mockup, including home, profile, tiles, rail, flyout, handbook and mobile drawer.
