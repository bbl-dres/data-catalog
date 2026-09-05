# Mobile and responsive refinement — 5 September 2026

The existing content-width strategy works well for catalogue pages. The remaining problems were mostly in transient panels, the keyboard viewport and Swagger's separate control styles. This pass refactors their sizing and scrolling; it adds no product features and removes none.

This document supplements [the responsive strategy](responsive-strategy.md), [design polish](design-polish-2026-09-05.md) and [contrast review](contrast-review-2026-09-05.md). “Responsive” here means adapting to available space and input capabilities; no framework change is involved.

## Review scope

Inspected the shared controls, header/search, navigation drawer, collections, tables/cards, profile facts, GWR fields, handbook, relationship workspace and API reference. Existing responsive checks cover 320–3840 CSS px, intermediate layout boundaries, languages, sidebar changes, table sorting, pagination and touch gestures.

Added targeted browser measurements and screenshots for 320 × 568 and 390 × 844 phones, 844 × 390 landscape, a 1280 × 600 touch laptop, a 1024 × 390 window and a deliberately constrained 390 × 280 viewport. Keyboard cases keep the layout viewport at 390 × 844 while supplying a 280 px visual viewport, including a 24 px viewport offset.

The review uses two principles:

- Keep ordinary content within the available width. Where a table needs two-dimensional structure, contain its horizontal scrolling locally. The 320 CSS px reflow reference also represents a zoomed desktop viewport; it is not a device classification. [WCAG: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Distinguish layout size from the portion currently visible above an on-screen keyboard. The visual viewport can change independently and emits resize/scroll events. [MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

The app retains its **44 px touch-control target**, including devices with both touch and a mouse. This is the app's chosen sizing policy; WCAG's minimum target criterion is 24 CSS px with qualifications, not a blanket 44 px requirement. [WCAG: Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Findings and implementation

| Priority | Reproduced issue | Implemented refinement |
|---|---|---|
| High | Header search ignored the visual viewport. With 280 px visible, the results panel extended to y=532, behind the simulated keyboard. | Hero and header search now use one fitting function and one CSS height rule. Results end at y=272, retaining an 8 px margin. Viewport panning also updates the available space. |
| High | At 320 px, an expanded API response table caused 8 px of document overflow. Mobile Chromium enlarged the layout viewport, subtly changing the apparent page scale. | Parameter/response tables scroll inside their existing containers. A 600 px table minimum preserves readable columns; document overflow is now zero. All columns and examples remain available. |
| High | API inputs/selects used 14 px text; authorization buttons measured 34 px high, lock buttons about 30 × 23 px, and some example/schema tabs only 14 px high. | Scoped Swagger rules apply the app's 16 px touch-input text and minimum 44 × 44 px button targets on narrow or coarse-pointer devices. Vendor files remain unchanged. |
| High | The API authorization dialog used fixed centering and a separate 540 px content limit, with no knowledge of the keyboard viewport. | The dialog is bounded by shared visual-viewport dimensions, with one internal scroll area. At 390 × 280 it is 248 px high, with 16 px margins; controls remain reachable. Browser pinch zoom retains native modal geometry. |
| Medium | At 390 × 280, the language menu began at y=−38.69, hiding its first option. | Cap its height using existing drawer, spacing and safe-area tokens; overflow scrolls inside the menu. It now starts at y=8. Keyboard Home/End and every language remain available. |
| Medium | Header search suggestions were about 36 px high, while hero suggestions were 44 px. Touch header clearances also still derived from the 32 px desktop control height. | Share the touch control-height token and suggestion target floor. Remove redundant mobile header overrides. Search padding and clear-button geometry now agree on touch laptops as well as phones. |
| Medium | In a 1024 × 390 window, the help panel extended from y=69.5 to y=595.28. Contact content was below the visible area. | Add a reusable `.ob-popover-content` scroll wrapper. The panel now ends at y=355.5; its outer arrow and shadow remain visible. Drawer help uses the same wrapper. |
| Medium | A fullscreen diagram had 353 px of content inside a 280 px shell, with overflow left visible. Its selection details and hint were cut off. | Allow vertical scrolling inside the fullscreen shell and keep its existing toolbar pinned. The canvas, details, hint and exit control remain reachable. |

The API tables deliberately retain their vendor table structure. They do not gain a second, custom card renderer. This keeps the same headers, schema/example tabs, media-type selectors and content, while preventing a wide table from widening the whole page.

## Refactoring decisions

- **One touch geometry source:** `--ob-control-height` changes from 32 to 44 px under the existing narrow/coarse-pointer query. Derived header dimensions and search clearances follow it; independent component minimums remain where needed.
- **One search fitting path:** `fitSearchSuggestions()` handles both placements. The hero supplies only its smaller maximum-height token. Opening/resizing may reveal the hero input; ordinary scrolling recalculates available space without forcing the page back to the form.
- **Explicit runtime geometry:** `syncVisualViewport()` updates `--ob-visual-viewport-height` and `--ob-visual-viewport-top` at normal browser scale, with CSS viewport fallbacks. It changes geometry without rebuilding the input or API dialog.
- **One help scroll surface:** the inner content wrapper handles scrolling while the outer panel retains its positioning, arrow and shadow.
- **Scoped vendor adaptation:** API styles stay under `.ob-swagger .swagger-ui`; no vendor patch, new dependency, alternate data renderer or additional layout breakpoint is introduced.

The existing 960 px drawer boundary, content container queries, equal tile grids, table/card thresholds, bounded reading widths and separate desktop navigation row are retained. Domänen and Letzte Änderungen stay vertically stacked. The bubble diagram remains the default relationship view. Search, filters, exports, sorting, navigation and state persistence keep their existing behavior.

## Validation

Added [tests/mobile.cjs](../tests/mobile.cjs), covering **20 mobile/touch states**. It checks:

- Zero document overflow, input typography and measured touch targets.
- Local API table scrolling, dialog dismissal and short-screen control access.
- Language menu keyboard access and help contact-link visibility.
- Fullscreen scrolling with a reachable toolbar and exit action.
- Header/hero search fitting, visual-viewport panning, input identity, query and focus preservation.
- API dialog identity/focus during keyboard resizing, and retention of native geometry during browser pinch zoom.

The mobile, functional, responsive, graph, sidebar, design-polish and contrast suites passed. Existing coverage includes 150 responsive layouts, 7,680 profile render combinations, the dense bubble diagram, touch pan/pinch, high-contrast rendering and measured contrast states. Syntax and whitespace checks were also run. No catalogue data was changed and no API request or authorization was submitted.

Reproduction instructions are in [tests/README.md](../tests/README.md). The mobile suite writes measurements and screenshots to `oblique-mobile-review` in the OS temporary directory. `REPORT_ONLY=1` gathers a baseline without the final layout assertions; leave it unset for verification.

## Limits

Measurements use Chromium/Edge touch emulation. Keyboard resize/pan cases are deterministic visual-viewport simulations, not a physical iOS or Android keyboard. Narrow CSS widths exercise reflow but do not replace checks of actual 200% text enlargement, browser zoom or Safari/Firefox rendering. Physical-device checks should still cover keyboard opening/closing, orientation, safe areas, native select pickers and assistive technology. This review does not claim complete accessibility conformance.
