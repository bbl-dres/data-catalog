# Design polish and consistency review

Reviewed 5 September 2026. Scope: the active prototype, its authored CSS, rendering helpers and browser behavior. This is a refinement of the existing interface; catalog features, routes, data, exports and navigation patterns remain intact. Archived wireframes and vendored Swagger UI/ExcelJS code are outside the refactor.

## Review approach

The review covers typography and spacing, repeated components, interaction states, responsive layouts, long content, keyboard/high-contrast visibility, touch targets, and ownership of design tokens. Existing design decisions remain the baseline: vertically stacked page sections, equal tile widths, compact federal branding, resizable navigation, adaptive tables, and bubble relationships.

Source inspection is paired with local Edge browser measurements and screenshots. The initial inspection includes home, tiles, tables, GWR field documentation, handbook and relationship controls at phone, tablet and desktop widths. Temporary long labels and disabled states are injected only in the browser.

## Findings and implemented changes

| Priority | Evidence / finding | Implemented recommendation |
|---|---|---|
| High | A long unbroken tile name makes both the card and the document overflow horizontally. | Give filled cards a common wrapping/minimum-width foundation while keeping their existing grids, padding and description clamping. |
| High | In forced-color mode, masked icons resolve to a white background on white; focused controls have neither a visible outline nor a shadow. | Preserve mask silhouettes using inherited system text colors and add system-color focus outlines. Keep active navigation and card boundaries distinguishable. |
| Medium | A disabled hero submit button still changes background on hover. Disabled export menu items share the enabled pointer/hover styles. | Share deliberate enabled/disabled states across buttons and menu items; preserve the existing disabled behavior. |
| Medium | At 820 px, the page-size select is 32 px high with 13 px text while the neighboring card-sort select is 44 px with 16 px text. Their border and text colors differ. | Use one native-select foundation with an explicit comfortable-size variant and shared mobile/touch rules. |
| Medium | Imported source documentation inherits 13 px text from its disclosure, versus the handbook's 15 px reading text; both use 24 px line height. | Share the reading typography while keeping facts and disclosure labels compact. |
| Medium | Touch sizing is repeated across unrelated selectors. Graph group pager rules override the general touch target at 32 px before diagram scaling. | Centralize common touch-control rules and explicitly apply them to diagram paging. Preserve graph geometry and zoom behavior. |
| Medium | Buttons, icon-only controls, form fields, chip variants and card foundations are spread through the layout stylesheet. Chip and pager definitions are split between unrelated sections. | Extract a small reusable component stylesheet; keep layout and component variants in their current owners. Consolidate duplicated definitions instead of adding a framework or utility-class layer. |
| Low | Header search width, tab height, compact KPI height and diagram workspace/control dimensions remain literals. Tree padding and mobile overlay clearances repeat arithmetic relationships. | Add meaningful component tokens and derive dependent offsets from existing spacing/header/control tokens. Keep responsive query conditions and diagram coordinates explicit. |
| Low | README still advertises removed example searches; the logo reference table still says 18 px on large desktops although the implementation caps at 16 px. | Update current documentation so future refinements follow the actual approved design. |

## Boundaries

- Keep 14/20 data typography, normal/compact row densities, numeric alignment and unbroken table headers.
- Preserve distinct component roles: hero search, compact controls and diagram controls need different sizes; equal values alone do not justify merging them.
- Keep native CSS media/container query numbers, percentages, border overlaps, visually hidden boxes and algorithmic diagram geometry explicit. These are not interchangeable spacing tokens.
- The diagram scales its canvas, including its nodes and group pager. Larger unscaled pager targets improve consistency but do not guarantee 44 screen pixels at every zoom level. The existing outside-canvas toolbar and list alternative remain available.
- Browser high-contrast emulation checks rendering, not a full screen-reader or physical-device accessibility audit.

## Reusable style ownership

| Owner | Responsibility / usage |
|---|---|
| `css/tokens.css` | Shared scales and meaningful component adjustment points. Added header-search width, tree gutter, compact KPI/tab dimensions, graph minimum/control dimensions and focus stroke width. Mobile overlay clearances derive from existing header, target and spacing tokens; the help overlay also accounts for the safe-area inset. |
| `css/components.css` | Buttons, inputs/selects, quiet icon actions, chips, disclosures and filled navigation cards. Loads before layout styles so existing contextual variants remain authoritative. |
| `.ob-input`, `.ob-select` | Shared border, text, background, type and sizing. Search retains its own icon clearances and radius. `.ob-select--comfortable` keeps the card-sort control usable even when card mode is caused by a narrow content column on desktop. |
| `.ob-icon-button` | Shared search-clear and toast-close foundation. Their positioning stays with the surrounding component. |
| `.ob-card` | Shared filled surface, hover/focus treatment and safe long-text wrapping. KPI and tile classes retain their own layout/padding; table cards remain a separate representation of tabular data. |
| `.ob-metadata > summary` | One disclosure label/chevron rule for core metadata and GWR source sections. Direct-child selectors prevent an outer disclosure from styling nested labels; a non-shrinking chevron and wrapping text stay aligned. |
| `css/main.css` | Application layout, tables, search/menu composition, card variants and shared reading typography. Pager definitions are consolidated. Final high-contrast overrides use system colors for focus, icons, active navigation and card boundaries. |
| `css/graph.css` | Bubble workspace and diagram-specific controls. Selected-tool indication remains visible in high contrast, and pager controls follow the touch policy before canvas scaling. |

No new rendering framework, package, feature or build step is introduced. The renderer changes only apply the shared classes; route/state logic, source text and catalog data are untouched by this review.

## Visual result

- Familiar spacing, page structure and default sidebar width remain intact.
- Long card labels wrap within their grid columns; normal descriptions still clamp to two lines.
- Page-size and sort selects use the same neutral border/text treatment. Desktop page-size text is now 14 px; tablet/phone controls are 44 px high with 16 px input text.
- Source-documentation body text now follows the handbook's 15/24 reading scale. Disclosure labels and factual metadata keep their compact scales.
- Disabled actions keep a stable appearance on hover. High-contrast users can see icons, current navigation, card edges and keyboard focus.
- Header search, tab/KPI dimensions and diagram control sizes retain their established values through named tokens. Tree indentation and overlay offsets follow their source dimensions rather than independent numbers.

## Verification

Verified locally with Node 24.16.0, Playwright 1.62.1 and Microsoft Edge on Windows. All nine suites pass:

- `core.test.cjs`: 17 checks, including catalog relationships, data validation and actual Excel workbook round-trips.
- `polish.cjs`: reproductions for long unbroken names at 320/820/1440/1920 px; equal card widths across groups; disabled button/export hover states; consistent tablet selects; source typography; forced-color icons, focus and navigation; touch diagram pager sizing.
- `responsive.cjs`: 150 layouts across 320–3840 px, 7,680 profile-render combinations, sorting/focus continuity, input targets, drawer/orientation, print and short-screen search.
- `functional.cjs`, `graph.cjs`, `sidebar.cjs`, `fields.cjs`, `gwr.cjs`, `excel.cjs`: existing behavior, diagram gestures/fullscreen, resizing/persistence, GWR/field navigation and complete workbook downloads remain valid.
- Authored-style audit: no direct hex/RGB colors remain in component/layout CSS, no unused component tokens, and no unresolved static `--ob-*` references. Remaining runtime references are documented diagram metrics and measured suggestion height.
- Manual screenshot inspection: normal home/tiles, phone field reading, and high-contrast navigation/actions. The sidebar/diagram/field suites cover the corresponding interaction states.
- `git diff --check` passes.

The focused browser suite writes review screenshots to the OS temporary directory under `oblique-design-review`. Reproducible commands are in [tests/README.md](../tests/README.md). These are browser layout/interaction checks, not pixel-perfect baselines or a claim of complete accessibility conformance.
