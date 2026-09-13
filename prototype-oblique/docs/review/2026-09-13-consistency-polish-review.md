# Whole-prototype design review: consistency, responsiveness and polish

Date: 13 September 2026. Status: implemented and verified in Microsoft Edge on Windows.

The public catalog already has a coherent layout. The largest problems were in the newer editor and dialogs: a table could widen the entire mobile page, narrow desktop forms kept cramped columns, and locally defined spacing and controls drifted from the shared components. This pass fixes those problems and consolidates the repeated CSS without changing the catalog structure or the relationship diagram.

During the review, the user also requested search, pagination and an **Ansicht (4)** picker for **Verlauf**, followed by a prominent red prototype banner. Those additions are documented separately below. The previously rejected detail-page redesign is not part of this implementation; the existing tabs, section order, collapsible headings, default-closed System section and optional row-order column remain.

## Method and evidence

Inspected the authored runtime styles, component markup and the catalog, editor, authentication and print rendering paths. Vendor styles and historical wireframes were treated as references, not refactoring targets. Measurements use CSS pixels after Noto Sans loaded and layout settled. Screenshots are unedited browser captures.

The live-page audit used a cached public catalog snapshot from the local application. Authentication and editing were simulated in an isolated browser context, with write requests blocked. It did not alter hosted catalog data or use a real user's account. Database-backed behavior checks ran against isolated local SQL fixtures.

| Coverage | Samples |
| --- | --- |
| Home; objects, tables, reference data, products, APIs and systems; domain overview; object overview, attributes, history and relationships; search, handbook, API reference and empty results | All 16 routes at 320, 390, 768 and 1440 px |
| Home, objects, overview, attributes, handbook and API reference | Additional 1024, 1280 and 1920 px widths; includes a 720 px high laptop |
| Field picker, login, print workspace, document settings, editor overview/rows and discard dialog | Desktop and phone widths; editor also at 768, 1024 and 1280 px |
| Touch editor stress checks | Five widths from 320 to 1440 px, including horizontally scrolled and expanded rows |
| Discard-dialog stress checks | DE/FR/IT/EN at 390×844, 320×568, 844×390 and 390×280 |
| New banner | Four languages at five viewport sizes, scrolling, header search, enlarged text and native print |

The main capture has [109 before samples](2026-09-13-consistency-polish-review/before-measurements.json) and [112 after samples](2026-09-13-consistency-polish-review/after-measurements.json); the extra three capture the history picker. Separate [before](2026-09-13-consistency-polish-review/before-stress.json) and [after](2026-09-13-consistency-polish-review/after-stress.json) stress results contain 21 cases each. [Banner measurements](2026-09-13-consistency-polish-review/banner-measurements.json) record localized sizes and the resolved sticky-header offset.

Final screenshots include the requested banner, so desktop content begins lower than in the baseline. Compare component dimensions and relative gaps rather than expecting unchanged absolute vertical coordinates. Login captures also have a different background tab; the modal measurements are directly comparable.

## Findings and implementation

### DP-01 — Editor table overflow escaped its scroll region · High · Fixed

On a 390 px viewport, the editor's attribute table made the document 767 px wide. The same defect appeared at 320 px, and the 1024 px desktop page expanded to 1143 px. On a true mobile context, this also expanded the layout viewport and reduced the apparent size of the whole interface.

The wide table already had a local scroller. Absolutely positioned, visually hidden field labels lacked a nearby positioning container and escaped its bounds. The shared `.ob-form-field` now establishes `position: relative` and `min-width: 0`. The table keeps its local horizontal scrolling and full set of fields; no page-level overflow clipping masks the defect.

| Requested viewport | Before document width | After document width |
| --- | ---: | ---: |
| 320 px | 767 px | 320 px |
| 390 px | 767 px | 390 px |
| 1024 px | 1143 px | 1024 px |

Evidence: [before touch table](2026-09-13-consistency-polish-review/before-editor-table-390.png), [after touch table](2026-09-13-consistency-polish-review/after-editor-table-390.png). The baseline capture's displaced/zoomed view is a consequence of the overflow; it is not the same row crop. Expanded row details and touch ordering controls were also checked.

### DP-02 — Editor responsiveness followed the browser rather than available space · Medium · Fixed

With the sidebar open, a 1024 px browser left only 600 px for the form. The previous viewport breakpoint still allocated columns of 330 and 230 px with a 40 px gap. At 1280 px, responsibility fields occupied only 272 px.

The form now switches to one column when the workspace container is at most 880 px wide. At 1024 and 1280 px, the measured columns are respectively 600 and 856 px. At 1440 px the existing two-column arrangement remains, with 656 and 328 px columns separated by the shared 32 px gap. The rule also responds to sidebar resizing.

This deliberately trades additional vertical scrolling on narrow workspaces for readable form labels and values. It preserves the form's sections and controls. Evidence: [1280 px before](2026-09-13-consistency-polish-review/before-editor-laptop-1280.png), [1280 px after](2026-09-13-consistency-polish-review/after-editor-laptop-1280.png), [1440 px after](2026-09-13-consistency-polish-review/after-editor-1440.png).

### DP-03 — Form spacing and control geometry drifted · Medium · Fixed

Editor styles independently defined label gaps, line heights, input insets, checkbox sizes and button widths. These differences were small individually but made the newer forms feel less consistent than browsing and print settings.

| Detail | Before | After |
| --- | --- | --- |
| Label-to-control gap | 6 px in editor, 4 px elsewhere | Shared 4 px |
| Editor label line height | Approximately 18.57 px | Explicit 20 px |
| Input horizontal padding | 10 px in editor; browser-default inset in some plain inputs | Shared 8 px |
| Editor section column gap | 40 px | Shared 32 px |
| Space between form sections | Last field margin added to section gap | 24 px section gap, without trailing field margin |
| Editor checkbox | 20 px | Shared 18 px checkbox within its label target |
| Touch ordering buttons | 32 px minimum width | Shared 44 px minimum width |
| Three-row description textarea | Fixed 70 px | Intrinsic 82 px for three 24 px lines, padding and borders |

`.ob-form-field` is now reused by authentication, editing and print settings. `.ob-input` owns the common inset. Editor headings, hints, warning/info surfaces, borders and widths use existing semantic and component tokens. Textareas retain native resizing and their declared row counts. A narrow table may still require more local horizontal scrolling because touch buttons now receive their full target width.

Evidence: [editor before](2026-09-13-consistency-polish-review/before-editor-1440.png), [editor after](2026-09-13-consistency-polish-review/after-editor-1440.png), [phone editor after](2026-09-13-consistency-polish-review/after-editor-390.png).

### DP-04 — Dialog surfaces had inconsistent mobile padding and bounds · Medium · Fixed

At 390 px, login used a 356 px dialog with 17 px exterior margins, while discard used 358 px and 16 px margins. Login had 16 px interior padding, but discard kept 24 px. Their viewport fitting and backdrop declarations were maintained separately.

Both now compose `.ob-dialog`, with context-specific widths, shared border/shadow/backdrop, 16 px exterior clearance, 24 px desktop padding and 16 px padding at widths up to 600 px. Visible-viewport positioning is shared, including keyboard resizing. Dialog-specific submission, focus return and draft behavior remain in their own modules.

At 390 px, both surfaces now measure 358 px wide. The German discard dialog reduces from approximately 194 to 158 px high because the improved content width avoids an unnecessary text wrap. Its actions wrap when translations or short screens require it.

Evidence: [discard before](2026-09-13-consistency-polish-review/before-discard-390.png), [discard after](2026-09-13-consistency-polish-review/after-discard-390.png), [French at 320 px](2026-09-13-consistency-polish-review/after-discard-fr-320.png), [login after](2026-09-13-consistency-polish-review/after-login-390.png).

### DP-05 — Choice-popover CSS was duplicated · Low · Consolidated

The catalog field picker and print settings repeated the same fixed surface, scrolling body and action-row declarations. They now share `.ob-choice-popover`, `.ob-choice-popover-body` and `.ob-choice-popover-actions`. Context classes keep their different widths and contents; existing positioning, focus and event lifecycles remain separate.

At 390 px the print document settings still measure 374 px wide, with 16 px padding and approximately 669 px height. The catalog picker retains its 8 px exterior gutter and 16 px padding; its available height responds to its anchor and viewport. The new banner changes that available height by 4 px in the phone capture.

Evidence: [catalog picker](2026-09-13-consistency-polish-review/after-picker-390.png), [print document settings](2026-09-13-consistency-polish-review/after-print-settings-390.png).

### DP-06 — Token use needed a focused cleanup · Low · Consolidated

The [CSS inventory](2026-09-13-consistency-polish-review/css-token-audit.json) counts ordinary declarations containing literal px/rem dimensions, literal colors or direct palette references, excluding custom-property declarations and query thresholds. It is an inventory, not a rule that every numeric value is wrong.

In the most affected stylesheets, counts reduced from **71 to 2** in `editor.css`, **5 to 0** in `auth.css`, and **1 to 0** in `components.css`. The remaining editor values are the one-pixel dimensions used to clip accessible labels. Added tokens describe reusable contracts: dialog sizing/padding, form spacing and width, editor table minimum width, modal backdrop, subtle feedback surfaces and optical chip padding.

Media/container thresholds, percentages, accessible clipping geometry, native print points and content-dependent SVG calculations remain appropriate literals. The relationship diagram, PDF layout algorithm and vendor stylesheet were not rewritten. This avoids creating token aliases that obscure the purpose of a value.

### DP-07 — Public layout rhythm was already consistent · Verified, retained

The 1440 px catalog has a 360 px sidebar, content beginning at x=392 px and 1016 px usable inner width. At 390 px, the inner width is 358 px with 16 px side padding. Cards use a 24 px gap; overview columns use 32 px. The content remains bounded on large screens.

The existing 24 px controls-to-panel gap remains consistent; the visible bottom of inset controls is 29 px from the panel. Shared controls remain 32 px on desktop and 44 px on touch/narrow screens. No document overflow was found in the public route matrix before or after this pass. Wide catalog/API tables continue to scroll locally.

No additional spacing redesign was justified for the dashboard, public profiles, handbook, API reference or print workspace. Representative final captures: [home](2026-09-13-consistency-polish-review/after-home-1440.png), [collection](2026-09-13-consistency-polish-review/after-objects-1440.png), [profile](2026-09-13-consistency-polish-review/after-overview-1440.png), [phone handbook](2026-09-13-consistency-polish-review/after-manual-390.png), [phone API](2026-09-13-consistency-polish-review/after-api-390.png), [print workspace](2026-09-13-consistency-polish-review/after-print-1440.png).

## Additional user requests

### Verlauf: search, pagination and Ansicht

History now uses the same local search, result status, table wrapper and pagination as Attribute. Search covers the complete history before sorting and slicing, including date, change, details and actor. Page sizes are 50, 100 and 200, with a top pager when there is more than one page and a bottom pager. The tab count continues to show the full history count.

The shared picker starts at **Ansicht (4)**: Datum, Änderung, Details and Bearbeitet von. Datum remains mandatory; the other columns can be hidden. Changes apply immediately, persist in the browser and can be reset. Search still finds hidden-column values. Default sorting remains newest date first; hiding an actively sorted optional column returns to that default.

`historyFilter`, `historyFields` and `historySort` keep history state separate from the Attribute tab's `filter`, `fields` and `sort`. Reloads and browser navigation restore the displayed state. Local history search and column preferences do not change entity Excel export scope. The editor's existing read-only history rendering is preserved.

Evidence: [desktop history](2026-09-13-consistency-polish-review/after-history-1440.png), [phone history](2026-09-13-consistency-polish-review/after-history-390.png), [desktop picker](2026-09-13-consistency-polish-review/after-history-picker-1440.png), [phone picker](2026-09-13-consistency-polish-review/after-history-picker-390.png). `tests/list-search.cjs` now exercises a 150-event fixture, including matches on later pages, hidden actor search, sorting, reset, pagination, persistence, invalid-page normalization and responsive bounds.

### Prominent prototype banner

The banner matches the treatment in `property-inventory/prototype-main`: full-width dark red (`#b71c1c`), white text and a bold uppercase prototype label. It retains the catalog's concise demonstration message, translated into DE/FR/IT/EN. White text has a calculated **6.57:1** contrast ratio against the red background.

`.prototype-banner` sits at the top of the sticky header. Its normal height is 36 px on desktop/tablet and 24 px below 768 px. At 1440 px the complete header grows from 117 to 153 px; at 390 px it becomes 80 px, replacing the previous 84 px header with its separate notice row. Wrapped text is measured with `ResizeObserver`, updating the existing header-height token used by sticky content and anchors. The Help panel's height allowance also includes the banner; the initial short-screen overflow found during verification is fixed.

The notice remains visible when header search opens and while the document scrolls. Native browser print retains the notice as dark text without the red fill; the generated PDF document layout remains independent. Evidence: [profile with banner](2026-09-13-consistency-polish-review/after-overview-1440.png), [search open](2026-09-13-consistency-polish-review/after-banner-search-1440.png), [French text enlarged at 320 px](2026-09-13-consistency-polish-review/after-banner-fr-320-text-zoom.png).

## Verification and limits

Passed during this implementation:

- All 48 core checks.
- `design-consistency.cjs`: 21 views, shared surfaces, controls, disclosures, empty states and print.
- `polish.cjs`: typography, long labels, cards, control states and forced colors.
- `mobile.cjs`: 20 mobile/touch views, API scrolling, short overlays, fullscreen and keyboard viewport behavior; rerun after the banner/Help fix.
- `laptop-layout.cjs`: 204 viewport/language/sidebar combinations, header bounds, tab dividers, 24/29 px gaps and focus across resizing; run with the new banner.
- `auth.cjs` and `editing.cjs`: real SDK with isolated local SQL, login/recovery/session paths and editor save, ordering, archive, validation, discard, retry/conflict and translated mobile flows.
- `list-search.cjs` and `visibility.cjs`: history additions plus existing collection, detail and shared print-picker behavior.
- Final live-snapshot audit: 112 measurements, no browser errors or document overflow; 21 touch/dialog stress cases; localized banner checks including enlarged text and native print.

Review screenshots are evidence of the sampled states, not a universal pixel-equivalence guarantee. Physical iOS/Safari and Firefox were not tested in this pass. Keyboard/visual-viewport simulations do not replace testing those devices. Native control rendering and font rasterization may differ between platforms. No schema, API permission or hosted-data changes were made.

The ongoing contracts are maintained in [Design system](../design-system.md) and [Behavior](../behavior.md). Future visual changes should reuse those shared components and check real workspace width, long translated labels, local table scrolling and short-screen overlays.
