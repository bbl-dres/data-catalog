# Whole-app design consistency review

6 September 2026. Scope: visual polish and reuse across the current application. Existing navigation, catalog content, search, relationship bubbles, export options and PDF layouts remain available.

## Assessment

The application has a coherent compact visual foundation. Most colors, spacing, typography and responsive dimensions already use tokens. The useful next step is consolidating repeated control patterns and correcting their states, rather than changing page layouts or adding another design layer.

The main inconsistencies were in the print workspace: native selectors beside custom menu buttons, different disclosure markers and checkbox sizes, a primary action that lost its emphasis on hover, and a separate empty-state implementation. Search also repeated its panel styling, while catalog and PDF tiles independently calculated the same summaries.

## Coverage

| Area | Review result |
| --- | --- |
| Header, navigation, sidebar and mobile drawer | Compact branding, hierarchy and resizing remain consistent. Menu label/icon composition and keyboard navigation are shared. |
| Home and search results | Preserve the white hero, vertically stacked sections and equal answer/result widths. Reuse panel styling and a consistent primary search action. |
| All catalog collections and domains | Preserve equal tile widths, grouping, local search, table alignment and pagination. Tile count/unit formatting has one owner. |
| Objects, tables, fields, attributes, reference data, products, APIs and systems | Preserve the shared profile hierarchy, visible empty facts, typography and row spacing. Reuse disclosure styling. |
| Relationship bubbles and history | Existing structure and interaction remain appropriate. Retain diagram geometry and independently scrollable/zoomable content. |
| Handbook and API reference | Existing adaptive widths and scoped vendor styling remain appropriate. Verify API examples, schema controls, authorization dialog, focus and contrast. |
| Print workspace and settings | Align selectors, actions, checkboxes, disclosures, empty recovery and narrow-screen scope text with the catalog. |

The visual inventory covers 21 routes/tab states. Additional checks cover open menus, metadata, search filters, disabled actions, empty selections, mobile layouts, translation and PDF generation.

## Findings and implemented refinements

| Priority | Finding and evidence | Change |
| --- | --- | --- |
| Medium | Print mixed browser-native select arrows/borders with the app's menu buttons. Document, grouping and export triggers also repeated icon/label markup. | Print choices now use `.ob-button--menu`, `ui.buttonContent()` and the app's `.ob-menu` / `.ob-menu-item` styles. This includes language, paper, orientation, layout, grouping, preview, page and document settings. Selected items, keyboard navigation, typeahead, dismissal and focus restoration use shared conventions. |
| Medium | PDF download had a bespoke dark fill, but inherited a pale hover background and changed text color; disabled styling used opacity. | Add one primary-button variant and semantic default/hover/pressed action colors. Apply it to search submit and PDF download. Disabled controls retain full opacity and suppress hover changes. |
| Medium | Metadata used an Oblique chevron while print disclosures used native triangles. Print selection checkboxes were smaller than filter checkboxes. | Share `.ob-disclosure` and the 18px checkbox foundation. Keep existing 44px touch targets, tree toggle-column placement and local disclosure state. |
| Medium | The print scope caption could split inside a narrow anonymous flex item beside a long scope name. | Render the scope as readable inline text within a quiet rectangular label. Keep the caption intact and let the scope name wrap naturally. Removable filters retain their chip presentation. |
| Low | Search filters and AI answers duplicated surface, border, radius and padding declarations. | Share `.ob-panel` and `--ob-panel-padding`: 24px normally, 16px in narrow content containers. Context retains widths and margins. |
| Low | Catalog and print empty states separately defined title hierarchy, spacing and recovery actions. | Extend `ui.empty()` with optional recovery markup and a plain variant. Buttons wrap on narrow screens; selection, filter reset and parent-scope recovery remain available. |
| Low | Catalog and PDF tile summaries duplicated entity-kind-to-unit mapping. | Use `data.tileSummary()` in both renderers, within the existing language context. Product counts still count attributes, and API tiles still show protocol. |
| Low | Mobile table-card rows used an isolated 5px padding, while single-border overlaps used literal offsets. | Use the existing 6px compact spacing token for card rows and the border-width token for overlapping edges. Menu focus indicators stay inside scrollable menus. |
| Maintenance | The design guide described obsolete title chips, a 2560px wide-layout threshold, missing restored wireframes and an outdated icon inventory. The contrast test expected a documentation link absent from the current API specification. | Correct the guide, document component ownership and exercise the optional Swagger link with a local test fixture. Catalog/API content remains unchanged. |

## Reuse and boundaries

`components.css` owns button states, label/icon alignment, selection-control sizing, disclosures, panels, cards, loading and empty states. `main.css`, `graph.css` and `export.css` retain their layout responsibilities. Responsive panel padding is defined with the other component tokens in `tokens.css`.

`select-menu.js` adapts native select values to the catalog's visible menu presentation. The native control remains the single value/form store and supplies intrinsic option sizing; it is excluded from focus and the accessibility tree after enhancement. The visible button exposes the caption and selected value, and menu items expose their checked state. Choices dispatch the existing change event, preserving print settings and draft form behavior. Popup menus fit the visible viewport, nest inside settings popovers and use the print session's abort signal for listener cleanup. App and print use the same keyboard-navigation helper; their surrounding state and lifecycle remain separate.

Keep these literals: media/container thresholds, percentages, accessibility clipping, optical chip insets and content-dependent diagram geometry. PDF dimensions, point sizes and text measurement belong to the document renderer. Turning every numeric value into a token would add indirection without improving consistency.

## Validation

All browser work uses an ephemeral local server and local fixtures. The new visual/print checks also run against the migrated PostgreSQL snapshot through an intercepted read API; they do not change the hosted project.

- Core: 33 checks for data, routing, rendering, sorting, exports and relationship geometry.
- Functional: search, grouping, domains, metadata state, menu keyboard behavior, exports, navigation and API loading/retry.
- Responsive: 150 layouts from 320 to 3840px and 8,816 profile rendering combinations.
- Visual consistency: 21 route/tab states, primary-button state/contrast comparisons, panel geometry, disclosure markers, checkbox sizing and empty-state recovery.
- Contrast: 50 view/state scans, 1,250 text samples and explicit control/graphic/focus checks; no measured failures.
- Print mobile: 18 catalog layouts and 32 print states, including touch, short screens, translated controls and simulated keyboard viewports.
- Print menus: match the main grouping control, four widths/languages, arrows/Home/End/typeahead, Escape/Tab/outside dismissal, nested settings, page synchronization, custom zoom, disabled controls and forced colors.
- Print tiles/tree/lifecycle: equal tile geometry, complete descriptions, preserved language and selection, visible tree labels, async cleanup and 64 section layout combinations.
- PDF: 200 tile combinations and 320 detailed layout combinations. Six actual PDFs pass source-text, page-boundary, embedded-font, vector-output and manifest checks.

Screenshots and generated PDFs are test artifacts in the OS temporary directory, not new catalog or preview assets. Automated Edge/Chromium checks and selected screenshot inspection do not replace physical-device, Safari/Firefox or assistive-technology review.

## References

- [Design system and ownership](../design-system.md#component-ownership)
- [Architecture](../architecture.md)
- [Mobile and responsive review](2026-09-06-responsive-design-review.md)
- [Test commands and coverage](../../tests/README.md)
- [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) — the 320 CSS-pixel baseline and the treatment of content that needs two-dimensional layout.
- [W3C: Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) — text contrast criteria used by the regression sampler.
