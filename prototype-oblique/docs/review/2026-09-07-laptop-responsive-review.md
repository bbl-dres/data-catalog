# Small-laptop layout review

7 September 2026. Scope: catalog collections, business-object and data-table details, attributes/fields, relationships, shared controls and the surrounding shell. The review uses the local JSON catalog fixture in Edge/Chromium; it does not change catalog data.

## Findings and changes

| Finding | Measured evidence | Implemented change |
| --- | --- | --- |
| Inconsistent visible spacing after detail search wraps | On Areal → Attribute, the search-to-table distance was 29 px at 1600 × 900 and 32 px at 1280 × 720. The controls-wrapper-to-panel distance was already 24 px in both. | Remove the extra wrapped padding. Preserve a 5 px action inset at both sizes, giving a consistent 29 px from the lowest visible action to the panel. |
| Collection dividers followed the action row | The initial 168-layout audit found the tab baseline missing in 44 collection/domain cases. The divider appeared underneath search and grouping controls when they wrapped. | Share the existing detail rule with collection controls: one divider under the tab row, with no additional divider under actions. |
| Relationship dividers followed the wrapped toggle | The same audit found 12 narrow relationship layouts with the divider below “Liste anzeigen” instead of the tabs. These controls wrap inside the tab frame at a separate 640 px container threshold. | Put the divider on the actual tab list when the toggle wraps. Preserve the selected-tab underline and normalize the toggle's bottom inset. |
| Previous checks missed internal spacing and divider placement | Existing responsive, design-consistency and mobile suites passed before these fixes. They check overflow, adaptation and interaction, but did not compare these distances or the divider position with the tab buttons. | Add a focused geometry regression across both sides of the wrap thresholds and preserve focus/filter/navigation checks during live resizing. |

The initial audit found no page overflow, overlapping header text or clipped table headings in its 168 cases. The 360 px default sidebar and the existing responsibility ordering already address the earlier reported laptop concerns; they remain part of verification.

## Exact gap measurements

Measurements use `getBoundingClientRect()` after fonts and layout settle, in CSS pixels, with the sidebar set to 360 px. Areal's five-row attribute table has no visible filter status or top pager, so `#panel-rows` and the table start at the same vertical position.

| Viewport | Content width | Search position | Wrapper → panel before / after | Search → table before / after |
| --- | ---: | --- | ---: | ---: |
| 1920 × 1080 | 1174 px | Beside tabs | 24 / 24 px | 29 / 29 px |
| 1600 × 900 | 1176 px | Beside tabs | 24 / 24 px | 29 / 29 px |
| 1440 × 900 | 1016 px | Beside tabs | 24 / 24 px | 29 / 29 px |
| 1366 × 768 | 942 px | Beside tabs | 24 / 24 px | 29 / 29 px |
| 1280 × 720 | 856 px | Below tabs | 24 / 24 px | 32 / 29 px |
| 1024 × 768 | 600 px | Below tabs | 24 / 24 px | 32 / 29 px |
| 830 × 600 | 798 px | Below tabs; drawer navigation | 24 / 24 px | 32 / 29 px |

The original single-row distance was `24 px outer margin + 4 px action margin + 1 px divider = 29 px`. Once search wrapped, the outer divider moved to the tab row, but actions had `24 px outer margin + 4 px action margin + 4 px padding = 32 px`. Wrapped actions now use a 5 px margin and no bottom padding. This keeps both the wrapper gap and the visible gap consistent, without adding another divider or changing the desktop alignment.

Wrapping follows **available content width**, not the device name: search moves below the tabs at 880 px or less. With the default sidebar, viewport widths of 1304 and 1305 px fall on either side of this threshold. A wider saved sidebar makes the controls wrap sooner. The 600/601 px compact-search and 640/641 px relationship-toggle boundaries are also covered. Since the [mobile and multi-device review](2026-09-07-mobile-design-review.md) the phone rules apply below 600 px (599/600 boundary) and, at 1024 × 768, the view and grouping menus share the row below the search instead of leaving the grouping menu alone. Screenshots taken with display scaling or browser zoom may contain more image pixels per CSS pixel.

When filtering shows a result count, that status line intentionally adds content between the controls and panel. A top pager or card-sort toolbar can also add space inside the panel before the actual data rows. On very narrow screens, measure from the lowest action row when search and view controls themselves wrap onto separate rows.

## Verification

- Focused regression: 204 layouts, six routes, German/French labels, viewport widths from 390 to 1920 px, default 360 px and saved 480 px sidebars. Includes 1093 × 615 px, representative of the CSS space available on a 1366 × 768 display at 125% zoom.
- Checks cover one correctly placed tab divider, 24 px wrapper and 29 px visible-action gaps, header/table bounds, responsibility placement, preserved search focus/results across live resizing, and relationship toggle/keyboard navigation.
- Post-change responsive regression passed: 150 layouts and 8,816 profile combinations, including sorting, focus, pagination, exports, drawer/orientation, tab navigation and touch behavior; no browser/resource errors.
- Post-change design-consistency regression passed: 21 views covering shared action states/contrast, panels, disclosures, checkbox sizing and empty-state recovery.
- Post-change mobile regression passed: 20 mobile/touch views covering API scrolling, touch controls, short overlays, fullscreen and keyboard viewport fitting.
- Visual inspection confirmed the single tab divider and corrected spacing in the 1280 px attribute view and 1024 px relationship view. `git diff --check` passed.

The focused suite writes `laptop-layout.json` and desktop/laptop screenshots to `oblique-diagram-export` in the OS temporary directory. The investigation also captured `laptop-baseline.json`, `gap-before.json` and `gap-after.json` there. Screenshots are review artifacts, not application assets.

These checks use local fixture data and browser viewport emulation. Hosted catalog contents, physical device scaling and Safari/Firefox rendering were not directly tested.

## Code and documentation

- [Shared controls](../../css/main.css) and [relationship controls](../../css/graph.css).
- [Focused regression](../../tests/laptop-layout.cjs) and [test setup](../../tests/README.md).
- [Responsive design contract](../design-system.md#responsive-layout).
