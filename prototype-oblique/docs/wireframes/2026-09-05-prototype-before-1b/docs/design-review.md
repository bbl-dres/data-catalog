# Design review: tokens, layout, states and accessibility

Date: 2026-09-02. Scope: `css/tokens.css`, `css/main.css`, the markup they style, and the corporate design in the Oblique repository (`projects/oblique/src/styles/scss`, the Angular component stylesheets, `projects/design-system` tokens and the Figma 15.1.2 library decoded in this folder). The review covers hardcoded values that should be tokens, conformance with the CD, consistency, states, typography, spacing, contrast, readability and usability. Every recommendation has been implemented; the "Status" lines say how.

Method: static scan of `main.css` for literals (px, rem, hex, rgba), WCAG 2.x contrast ratios computed for every foreground/background pair in use, element measurements in headless Edge, and screenshots of nine desktop routes, a tablet width (905 px) and three phone routes (390 px) before and after the changes.

## Summary

The stylesheet was already token-based for colour and the main spacing scale, and the type ramp matches Oblique exactly (h1 28/32 −0.5, h2 23/28 −0.5, h3 17/24, body 16/24 +0.5, caption 12/16 +0.5, overline 12/16 +2). What remained were 70 hard-coded lengths, two undefined tokens that silently fell back to browser defaults, off-scale spacing values (6 px and 10 px, which do not exist in Oblique's 4/8/12/16/24/32/48 scale), one typographic error in the facts list, missing pressed states, focus rings clipped by scroll containers, and a few phone-layout problems. Contrast is good throughout: every text pair passes AA, most pass AAA.

| Area | Findings | Fixed |
|---|---|---|
| Hardcoded values → tokens | 70 literals, 2 undefined tokens | 68 replaced, 2 fixed |
| CD conformance | 6 | 6 |
| States and focus | 4 | 4 |
| Typography and readability | 5 | 5 |
| Layout (phone and tablet) | 5 | 5 |
| Contrast | 0 failures | – |

## 1. Hardcoded values that should be tokens

The scan found 70 pixel literals, one `rem` literal, four unitless line-heights and seven hex or `rgba()` colours outside `tokens.css`. They fall into four groups.

**Undefined tokens (bugs).** `--ob-font-family-base` and `--ob-radius-control` were referenced in the Swagger UI overrides but never defined, so the API page rendered Swagger's own font and square buttons. Status: replaced by `--ob-font-family-body` and `--ob-radius-sm`; a scan now confirms every `var(--ob-*)` in `main.css` is defined (the only exception, `--ob-tree-available-height`, is set by `app.js` at runtime).

**Off-scale spacing.** Gaps and paddings of 6 px and 10 px appeared in twelve places (KPI head, KPI count, group header, popover link, ghost button, suggestion rows, badge padding, facts rows, graph item gaps, search-group head, phone header, phone table cards). Oblique's scale is 4/8/12/16/24/32/48. Status: snapped to the nearest step, `--ob-space-xs`, `--ob-space-sm` or `--ob-space-md`; visually the difference is 2 px per instance and the rhythm is now consistent.

**Component sizes written inline.** Icon sizes (12–28 px), the 32 px control size used by the avatar, tree toggle, tree grid column and search clear button, the 24 px count badges, the 56 px tile height, the 60 px drawer header, the 220/260 px tree column, the 260/480 px search width, the 240/260 px menus, the 395 px popover, the 240/320 px breadcrumb limits, the 240 px KPI card, the 140/200 px facts label column, the 400 px group basis, 280 px tab strip, 420 px suggestion height and toast width, 360 px drawer, 1200 px API width and the 1000/100/68/64 px graph geometry. Status: 33 component tokens added to `tokens.css` (`--ob-icon-size-*`, `--ob-control-height-sm`, `--ob-avatar-size`, `--ob-badge-size`, `--ob-tree-panel-min/max-width`, `--ob-drawer-*`, `--ob-search-*`, `--ob-menu-*`, `--ob-popover-width`, `--ob-breadcrumb-*`, `--ob-kpi-min-width`, `--ob-facts-label-*`, `--ob-tile-min-height`, `--ob-group-basis`, `--ob-tabs-min-width`, `--ob-toast-max-width`, `--ob-card-label-min-width`, `--ob-api-max-width`, `--ob-graph-*`). The graph canvas token carries a comment that it must match `SIZE` in `detail.js`; the JS tile-group basis now references `--ob-group-basis` instead of repeating `400px`.

**Colours.** The drawer backdrop `rgba(19, 27, 34, 0.42)`, the transparent end of the tab-strip fade, the print colours (`#000`, `#fff`, `#eee`, `#f6f6f6`) and the tab label `var(--ob-black)` used a primitive directly. Status: `--ob-color-backdrop`, `--ob-color-tab-text`, `--ob-color-placeholder`, `--ob-color-link-visited` added; print uses the palette primitives.

What remains literal, on purpose: media query widths (custom properties cannot be used there; the list is documented at the end of `tokens.css`), hairline offsets of 1 px, the `-100px` off-screen position of the skip link, `11pt` print body size, and three Swagger-internal widths.

Two dead component tokens (`--ob-tree-panel-basis`, `--ob-content-basis`) were removed. Unused palette primitives (red 50–400, 700, 900; green 50, 800; orange 50, 600; blue 50; secondary 500, 900) and the unused `--ob-shadow-sm/md`, `--ob-z-controls`, `--ob-duration-fast` are kept so the token file stays a complete mirror of Oblique's palette and scales.

## 2. Corporate design conformance

Compared against `core/_variables.scss`, `core/mixins/_typography.scss`, `core/components/_table.scss`, the master-layout, navigation, nav-tree, breadcrumb, footer, popover and chip stylesheets.

| Element | Oblique | Prototype before | Status |
|---|---|---|---|
| Headings | h1 28/32 bold −0.5; h2 23/28; h3 17/24 | Same, but h2 line-height as a `rem` literal | Token `--ob-line-height-lg` |
| Body | 16/24, letter-spacing 0.5 px | Same | – |
| Overline (entity type) | 12/16 medium, 2 px tracking | 12, semibold, no line-height | Medium weight, line-height token |
| Chip / badge | caption 12/16 medium, white on secondary-600 / green-700 / blue-800 / red-800; warning on orange-600 | Same, warning on orange-700 (5.2:1 instead of 3.3:1) | Kept orange-700, a deliberate accessibility delta |
| Table | thead and even rows secondary-50, hover secondary-100, rows 1 px secondary-200, head 2 px, uppercase regular headers, 8 px cells | Hover used the border token as background | `--ob-color-surface-hover` |
| Navigation and nav-tree | Hover secondary-50, pressed secondary-100, 3 px accent left border | No pressed state | Pressed state added (main nav, tree rows, menu items, buttons, tabs, group headers) |
| Links | blue-700, hover 800, active 900, visited purple-700 | No visited colour | Visited colour on prose links (handbook, popover); catalogue navigation links stay unvisited because they are controls, not content |
| Breadcrumb | 0.8 rem, separator 4 px, ellipsis per item | 13 px | 14 px (`--ob-font-size-sm`): one step above Oblique for readability, and the same size as the other secondary text (tree counts, table cards) |
| Footer | links body size, version and info one step smaller (xs), 2 px top offset | Everything 14 px | Version and note 12 px; links stay 14 px so the bar keeps its 39 px height |
| Popover | 395 px, drop-shadow filter, h5 section titles, link rows with 1 px dividers and accent border | Same, arrow geometry inline | Arrow uses the spacing tokens like Oblique (`$ob-spacing-sm` border) |
| Alert | Icon column in the status colour, light content background | Left border plus light background (a compact toast variant) | Kept; body size raised from 14 to 16 px like Oblique alerts |
| Back to top | Grey tab docked to the right edge, 85 % opacity | Secondary button with shadow | Kept, documented in design-system.md |
| Focus | 3 px purple box-shadow | Same, but clipped inside scroll containers | Inset ring for main nav, tabs, tree, table sort buttons and suggestions |

## 3. States and focus

- **Pressed state missing.** Oblique's `ob-nav-hover` mixin defines hover (secondary-50) and active (secondary-100). The prototype had hover only. Status: `:active` added to buttons, main-nav items, tabs, tree rows, menu items and group headers, all using `--ob-color-surface-hover`.
- **Focus ring clipped.** `.ob-main-nav`, `.ob-tabs`, `.ob-tree-panel` and `.ob-table-wrap` scroll or hide overflow, so the 3 px outer ring of the focused control was cut at the container edge (top of a tab, both sides of a tree row). Status: `--ob-focus-ring-inset` on those controls, the pattern Oblique uses for tabs and navigation.
- **Reduced motion.** Transitions on KPI cards, graph items and sort icons ignored `prefers-reduced-motion`. Status: a global reduced-motion rule disables transitions and smooth scrolling.
- **Placeholder looked like a value.** The search placeholder used the body text colour, so "Im Katalog suchen…" read as typed input. Status: `--ob-color-placeholder` (tertiary, 5.65:1) distinguishes it while keeping AA.

## 4. Typography and readability

- **"Dateneigner :" with a space before the colon.** The facts list appended the colon with a 0.35 em margin, which is wrong in German typography. Status: margin removed.
- **Two lead-paragraph styles.** The collection description was 16 px in the secondary colour, the profile description 17 px in the primary colour with a 1.55 line-height literal. Status: one lead style (`--ob-font-size-lg` / `--ob-line-height-lg`, secondary colour) for both; phones fall back to body size.
- **Line-height literals** on the tile name (1.35), badge (1.3333), graph labels (1.2) and buttons (1). Status: mapped to the `--ob-line-height-*` ramp (xs 16, sm 20, md 24, lg 28).
- **Breadcrumb at 13 px** was the smallest interactive text on the page. Status: 14 px.
- **Toast at 14 px** with 0.25 px tracking differed from every other message surface. Status: body size and tracking.

## 5. Layout: phone and tablet

- **Phone breadcrumb truncated every crumb** to 128 px, producing "Starts… › Geschäftsob… › Architektonisc… › Gebä…", which conveys nothing. Status: crumbs wrap onto a second line instead; the desktop per-item ellipsis limits still apply to very long names.
- **Phone actions** "Gruppieren" and "Exportieren" were two right-aligned, differently sized buttons with ragged edges. Status: they stack as full-width buttons (the group label is too long for half a 390 px row), which is the standard phone pattern for a short action list.
- **Phone table cards stretched the status chip** across the whole value column because the cell is a grid. Status: chips align to the start of the column.
- **Phone search clear button** was a 32 px target. Status: 44 px on phones, matching the other touch targets.
- **Toast close button** was a 14 px icon with no padding. Status: 32 px hit area, hover background.

## 6. Contrast

All pairs measured on the rendered colours (WCAG 2.x ratios):

| Pair | Ratio | Requirement |
|---|---|---|
| Body text secondary-800 on white | 14.97 | 4.5 |
| Secondary text secondary-600 on white / on surface | 10.2 / 9.23 | 4.5 |
| Tertiary text secondary-400 on white / on surface / on hover row | 5.65 / 5.11 / 4.42 | 4.5 (hover row only carries primary and secondary text) |
| Link blue-700 on white / surface / hover row | 6.7 / 6.06 / 5.24 | 4.5 |
| Chip text on green-700 / orange-700 / secondary-600 / red-800 / blue-800 | 5.48 / 5.18 / 10.2 / 8.36 / 8.72 | 4.5 (12 px medium) |
| Graph badge white on secondary-400 | 5.65 | 4.5 |
| Footer white on secondary-700, hover secondary-100 | 12.38 / 9.68 | 4.5 |
| Accent red-500 underline, focus purple on white | 4.21 / 4.52 | 3.0 (non-text) |
| Input border secondary-400, button border secondary-600 | 5.65 / 10.2 | 3.0 |
| Disabled text secondary-300 | 3.34 | exempt (Oblique uses the same) |

Nothing failed. The only pair below 3:1 is the tile outline (border-strong, 2.1:1), which is decorative: the 3 px left bar in secondary-600 and the row hover carry the affordance.

## 7. Not changed, worth knowing

- **Button label size.** Oblique's SCSS mixin sets 14 px medium, the Figma library 16 px medium. The prototype keeps 16 px as documented in design-system.md.
- **Table hover** uses secondary-100 as Oblique does; on that background the tertiary text (5.65 on white) would drop to 4.42, so tables deliberately never use tertiary text.
- **KPI cards** repeat the section name in the count line ("Geschäftsobjekte" and "21 Geschäftsobjekte"). Leaving it: the second line names the unit, which differs for Referenzdaten ("15 Wertelisten").
- **Tree panel heading** "Katalog" is an h2 at 23 px next to a 28 px h1; the hierarchy is correct because the panel is a landmark, not content.
- **Media queries** keep literal widths (360, 600, 960, 1100 px) because custom properties cannot be used in `@media`; the list at the end of `tokens.css` is the single source.
- **Design-system v2 tokens.** Oblique's newer `projects/design-system` package exposes semantic tokens such as `--ob-s3-color-interaction-state-bg-hover` and `--ob-h-typography-context-h1-*`. Its values coincide with the legacy SCSS for everything this app uses (text #1c2834, surface #f0f4f7, borders #dfe4e9/#acb4bd, headings 28/23/17), but its interaction colours (#2e8fbf blue family) differ from the legacy palette and it ships no components yet. The prototype stays on the legacy palette that the Angular components render today.
