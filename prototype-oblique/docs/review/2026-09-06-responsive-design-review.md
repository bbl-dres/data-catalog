# Mobile and responsive design review

6 September 2026. Scope: the current prototype, with particular attention to the recently added print workspace. All existing features, catalog content and PDF layouts remain available.

## Assessment

The main catalog already adapts well: navigation changes to a drawer, tables become labeled cards according to container width, tiles keep consistent widths, and independent home sections stay vertically stacked. Search, the handbook, API reference and relationship view passed the existing mobile checks. The principal gaps were in print controls, short screens and software-keyboard handling.

Use available width for columns and available **visible height** for overlays. On constrained screens, let the print workspace scroll vertically instead of allocating fixed viewport percentages to several control panels. Keep local scrolling for the catalog tree, PDF pages and a settings form's body, where it serves a distinct purpose.

## Findings and implemented changes

| Finding | Evidence before the fix | Implemented change |
| --- | --- | --- |
| High: expanded controls consume the preview | At 390 × 844 px, opening display settings and scope left a 56 px preview. At 320 × 568 and 844 × 390 px, it fell to 32 px. | Compact mode uses normal outer scrolling and a grid with a token-based 280 px minimum preview. Display controls remain in the page flow; scope controls remain together and only the tree scrolls locally. The footer follows the preview without overlap. |
| High: Apply/Cancel can fall below the screen | The filter popover ended at y=592 on a 568 px phone and y=608 on a 600 px laptop. Initial positioning occurred before the count text changed its height. | Position after content updates and observe later size changes. Fit the popover to the visible viewport. Its body scrolls while the title and Apply/Cancel remain visible. Mobile facets share that body scroll area. |
| High: print overlays ignore the keyboard | With a simulated visible area from y=24 to y=304, the workspace retained its 844 px height and the filter menu extended to y=789. | Reuse the application's visual-viewport tokens for the dialog and popover. Resize/scroll events update fitting without replacing the focused input. The existing pinch-zoom fallback remains intact. Listeners and observers share session cleanup. |
| Medium: incomplete touch and narrow-header treatment | Display/scope summaries measured 36 px high, below the project's 44 px target. Header actions could wrap into another row at 320 px. | Apply the shared touch token to disclosures and removable filter chips. Use a three-column action row; the PDF button can wrap its text. Localized titles wrap safely, and disclosure focus rings stay inside their bounds. |
| Maintenance: width alone does not identify constrained screens | A wide, short viewport kept the expanded desktop print controls. Earlier tests did not assert usable preview height or visible dialog actions. | A shared compact-mode decision covers widths up to 960 px or visible heights up to 500 px. Add geometry, scrolling, keyboard and action-access regressions. Update an outdated responsive test to include the already implemented comment field. |

Safe-area padding is included in the print dialog. Native controls, browser zoom, selection, language, filters, scrolling PDF pages and all three output layouts are retained. No catalog or database changes were needed.

## Verification

- Main responsive suite: 150 layouts from 320 to 3840 px and 8,816 profile rendering combinations. Checked sorting, focus, pagination, table/card changes, drawer navigation, touch scrolling and translated layouts.
- Existing mobile suite: 20 touch/short-screen states covering search, API tables and dialogs, menus, fullscreen relations and simulated keyboard changes.
- New print-mobile suite: 18 catalog layouts with the migrated SQL fixture and 32 print states, including phones, tablet sizes, touch laptops, short landscape and keyboard-reduced viewports. Checks minimum preview height, horizontal overflow, footer reachability, 44 px targets, popover bounds, fixed action access, French labels and retained focus/filter state.
- Print lifecycle/tree regressions passed, including close/reopen, late async results, language rebuilding, mouse/keyboard selection and row alignment at 320–1600 px.
- Tiles, Grid and List checks passed: 200 tile combinations, 320 detailed layout combinations and 64 section combinations. PDF generation still uses the same physical layout and vector renderer.

Before/after measurements and screenshots are written to `oblique-diagram-export` in the OS temporary directory; they are not repository assets. Visual inspection included expanded phone controls, the scrolled preview/footer, French labels at 320 px and keyboard-constrained filter actions.

## Remaining validation

These checks use Edge/Chromium with touch emulation. Keyboard cases simulate visual-viewport events; they do not operate an OS keyboard. Physical iOS/Android keyboard, safe-area, Safari and screen-reader checks remain part of user-device validation. The review does not claim complete accessibility conformance.

## References

- [Responsive design contract](../design-system.md#responsive-layout) and [print behavior](../behavior.md#data-model-pdf-export).
- [Workspace styles](../../css/export.css), [controls](../../js/diagram-controls.js) and [lifecycle](../../js/diagram-export.js).
- [Mobile print checks](../../tests/print-mobile.cjs), [responsive checks](../../tests/responsive.cjs), [mobile checks](../../tests/mobile.cjs) and [test setup](../../tests/README.md).
