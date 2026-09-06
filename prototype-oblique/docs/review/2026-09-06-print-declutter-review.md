# Print workspace decluttering review

6 September 2026. Scope: the print workspace controls and surrounding application layout. The exported document's content, layout and branding are unchanged.

## Assessment and approach

The preview already supports scrolling, a scope tree, filtering and clear output settings. Clutter came mainly from duplicate navigation, persistent recovery actions and repeated icons. Keep the settings users need to prepare a document; reduce the surrounding controls and use the same footer as the catalog.

The implementation followed three steps: simplify shared markup and remove obsolete controller/CSS branches; reuse the application footer and preserve error/selection recovery; update interaction checks and inspect desktop/mobile screenshots and generated PDFs.

## Findings and changes

| Finding | Implemented recommendation |
| --- | --- |
| The page selector and previous/next buttons duplicate vertical scrolling. | Remove `.ob-export-page-tools`, its select options, event handlers and disabled-state updates. Keep scroll position, zoom anchoring and virtual SVG mounting. Page numbers remain in the document; an unobtrusive live region reports the current page to assistive technology. |
| Bulk-selection buttons compete with scope navigation. | Remove `.ob-export-selection-actions` and the unused deselect-all action. Individual checkboxes retain exclusions across scope/filter changes. When nothing is selected, the existing Select all recovery action restores the filtered scope and focuses the preview. |
| The export footer duplicates counts and creates another visual band. | Remove `.ob-export-footer`. Render `views.footer()` with the shared `.ob-footer` styles and application language. The background app footer stays intact; closing the dialog removes its workspace copy. |
| Retry lived in the removed footer. | Move retry beside the asset-load error, separate message updates from button markup, and keep the area hidden during successful operation. |
| Search/document/paper/orientation/column icons add little to explicit labels. | Remove those leading icons. Retain zoom controls, layout/grouping icons, tree icons, filter-removal crosses and dropdown chevrons because they indicate actions or structure. |
| Cancel and a close cross perform the same action. | Keep Cancel and Escape; remove the extra close button and its mobile positioning rules. |
| Reset filters is disabled in the common unfiltered state. | Show it only when an explicit filter or initial collection search is active. Active chips remain individually removable; resetting preserves scope and exclusions. |
| Repeated selection instructions consume sidebar space. | Associate the existing layout-specific instructions with the tree through `aria-describedby` and screen-reader-only text. Keep scope and selected-entry counts visible. |

The default populated view loses six persistent controls: three page-navigation controls, two bulk-selection buttons and the duplicate close button. The inactive reset button also disappears. No new styling tokens or UI dependencies were needed; retired selectors and controller paths were removed instead of overridden.

## Validation

Validation uses an isolated local SQL fixture and Edge/Chromium. No hosted catalog data is changed.

- Desktop/mobile screenshots inspected, including the standard footer at 1280 × 600 and after scrolling at 320 × 568.
- Responsive checks: 18 catalog layouts and 32 print states, including touch targets, expanded disclosures, short screens, simulated keyboard viewport, footer reachability, translated labels and preserved filters.
- Grid/List checks: 320 paper/orientation/language/group combinations and 64 additional section layouts, complete fields, virtual scrolling, zoom, asset retry and cancellation. Tiles passed another 200 layout combinations.
- Eleven generated PDFs (36 pages) passed content, preview-text, fonts, vector output, bounds and manifest checks.
- Interaction checks passed for removed controls, shared footer markup/styles, document-language isolation, selection recovery/focus, conditional reset, dropdown keyboard behavior and scope/filter changes. Queued scroll, language rebuild and close/reopen lifecycle regressions passed.
- The 21-view design inventory and 36 core checks passed. JavaScript syntax, translation JSON and review links were checked.

The checks do not replace physical-device, Safari or screen-reader testing. The deliberate tradeoff is that arbitrary page jumps and persistent bulk deselection are no longer offered; scrolling, scope/filter narrowing and individual selection are the remaining controls.

## References

- [Current print behavior](../behavior.md#data-model-pdf-export) and [design system](../design-system.md).
- [Workspace controls](../../js/diagram-controls.js), [controller](../../js/diagram-export.js), [styles](../../css/export.css) and [shared footer](../../js/views.js).
- [Menu checks](../../tests/print-menus.cjs), [mobile checks](../../tests/print-mobile.cjs), [filter checks](../../tests/diagram-filters.cjs), [lifecycle checks](../../tests/print-review.cjs) and [PDF checks](../../tests/diagram.cjs).
