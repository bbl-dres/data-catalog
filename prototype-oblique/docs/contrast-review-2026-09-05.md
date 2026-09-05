# Contrast review — 5 September 2026

The catalogue's main text already has strong contrast. The problems were concentrated in hover states, faint graphical cues, hidden keyboard focus and the separate Swagger UI palette. This pass corrects those states using existing palette values and two semantic aliases. Layout, typography, content, navigation and available features are unchanged.

## Scope and method

Reviewed the home search and KPIs, sidebar and resize handle, tiles, tables, entity overview/attributes/relationships/history, GWR field profile, search results, handbook, menus and API reference. Browser measurements cover widths of 390, 768, 1440 and 2560 px. API checks include expanded operations, required parameters, JSON examples, all 15 schema expansion controls and the authorization dialog. No API request or authorization was submitted.

Used Edge through Playwright to calculate contrast from rendered foreground/background colors, including alpha transparency and ancestor opacity. Ratios use relative luminance in sRGB and are compared without rounding. The tables below round results to two decimals. Screenshots of phone and desktop views, the diagram and keyboard states were also inspected.

Targets:

- Ordinary text, including small labels and placeholders: **4.5:1**. Large text: **3:1** (24 px regular, or approximately 18.67 px bold). Disabled controls and logos have exceptions. [WCAG 2.2: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Essential graphics and the visual information identifying controls/states: **3:1** against adjacent colors. Decorative dividers and surfaces do not automatically need that ratio. [WCAG 2.2: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Keyboard focus must remain visible; a good color token is insufficient if another style hides the indicator. [WCAG 2.2: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).
- Status and required-field meaning should retain text or symbols alongside color. Existing status labels, method names and required markers preserve that information. [WCAG 2.2: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

## Findings and implemented corrections

### Catalogue controls and diagram

| Element/state | Before | After | Correction |
|---|---:|---:|---|
| KPI supporting label on hover | 4.42:1 | 7.97:1 | Use secondary text on the darker hover/focus surface; retain tertiary text in the resting state |
| Sidebar grip on white | 2.10:1 | 3.34:1 | Replace the decorative border color with the essential-graphic token |
| Relationship connectors on white | 2.10:1 | 3.34:1 | Use the same essential-graphic token |
| Unsorted column arrow on hover | 2.64:1 | 5.11:1 | Replace 45% opacity with an opaque tertiary color; also reveal the arrow on keyboard focus |
| Back-to-top keyboard focus | Ring hidden by elevation shadow | Visible 3 px ring | Combine focus and elevation shadows |
| Selected diagram tool keyboard focus | Ring hidden by selection shadow | Visible 3 px ring | Give keyboard focus precedence; the selected background remains visible |

`--ob-color-graphic` resolves to `#828e9a`. It provides 3.34:1 on white and 3.02:1 on the standard surface. It is **not a small-text color**, and must not be used on the darker hover surface without rechecking contrast. The resize handle keeps its neutral appearance and existing stronger hover/drag treatment. Bubble layout, zoom and selection behavior are preserved.

The purple focus color already provides 4.52:1 on white and 3.53:1 on the selected tool's background. The focus failures came from CSS precedence rather than the palette.

### API reference

The vendored Swagger stylesheet supplied independent colors that bypassed the app's accessible text/status tokens. Corrections are scoped under `.ob-swagger .swagger-ui` in `main.css`; the pinned vendor assets remain intact.

| Element/state | Before | After | Correction |
|---|---:|---:|---|
| Version badge, white text | 3.76:1 | 10.20:1 | Neutral badge background |
| OpenAPI version badge, white text | 2.21:1 | 5.48:1 | Success background |
| Documentation link | 3.30:1 | 6.70:1 | Shared link colors, including hover/visited states |
| Authorize label on the scheme panel | 1.84:1 | 4.96:1 | Shared success color for text, border and icon |
| Authorize label in the dialog | 2.03:1 | 5.48:1 | Same shared success color |
| Operation lock icon | 2.82:1 | 5.23:1 | Opaque tertiary fill instead of black at 40% opacity |
| Filter field boundary | 1.36:1 | 5.65:1 | Shared input border color for enabled text fields |
| GET badge, white text | 2.32:1 | 6.70:1 | Shared blue background |
| Parameter location label | 3.65:1 | 5.23:1 | Tertiary text |
| Superscript `required` label | 2.78:1 | 7.73:1 | Opaque error color; required asterisks use it too |
| Expand/collapse-all schema control | 1.94:1 | 8.95:1 | Secondary text |
| Schema format badge, e.g. `date` | 2.39:1 | 5.18:1 | Shared darker orange background |
| JSON numeric example text | 3.45:1 | 4.75:1 | Darker code background, retaining syntax colors |

`--ob-color-code-bg` resolves to `#131b22`. A narrowly scoped `!important` overrides the highlighter's inline background; individual syntax colors and code structure remain intact. API keyboard controls also receive the shared focus outline, with system colors in forced-colors mode. Checks wait for Swagger's existing button transition before measuring the final focus state.

Only GET is present in the current specification. Other HTTP method palettes and future syntax themes need their own measurements when introduced.

## Deliberately retained

Body text measures 14.97:1 on white; secondary text is 10.20:1. Search placeholders and input boundaries are 5.65:1. Footer supporting text is 5.91:1. Existing status text ranges from 5.18:1 upward on the colored chips. These did not need darkening.

Table separators, bubble rings and card fills remain light because text, grouping and controls identify the content. Disabled actions keep their subdued appearance and actual disabled semantics. Status labels continue to spell out their meaning. No global palette darkening, additional borders or features were introduced.

## Verification and maintenance

Added [contrast.cjs](../tests/contrast.cjs) with the test-only [contrast sampler](../tests/contrast-helpers.cjs). The final run passed **50 view/state scans, 22 targeted contrast measurements and five keyboard-focus checks**, with no browser errors. The scan includes roughly 1,200 text samples, deduplicated by style within each view. Screenshot checks confirmed the stronger cues remain visually quiet and the mobile/desktop compositions are preserved.

Existing functional, responsive, graph, sidebar and design-polish suites also passed. This includes 150 responsive layouts, 7,680 profile render combinations, dense bubble diagrams, mouse/touch/keyboard controls and forced-color icon/focus rendering. The final API boundary adjustment was verified by the contrast suite.

Run the contrast suite using the browser setup in [tests/README.md](../tests/README.md). It writes `after.json` and screenshots to `oblique-contrast-review` inside the OS temporary directory. `REPORT_ONLY=1` records `before` artifacts without contrast/focus assertions; use it only when intentionally gathering a baseline. Normal verification must leave it unset.

This is a focused contrast review, **not a complete WCAG conformance audit**. The sampler does not model gradients/images, overlapping paint or antialiased pixels; complex backgrounds are reported separately. It samples rendered text and selected essential graphics, not every possible pseudo-element or interaction combination. Diagram zoom changes apparent type/stroke size, so good color ratios alone do not guarantee legibility at every zoom level. Real-device viewing in glare, assistive-technology testing and other browser engines remain separate checks.
