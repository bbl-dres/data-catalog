# Design system: Oblique without Angular

For current responsive dimensions and deliberate deviations, see the [responsive strategy](responsive-strategy.md): a 1600 px workspace, a separate desktop navigation row, 15/24 reading text and 14/20 data rows. The source mappings below document the Oblique origin and earlier compact scale.

The current application uses the compact scale from [mockup option 1b](compact-layout.md): 24/32 headings, 17/24 section headings, 14/20 body, controls and data rows, 12/16 supporting labels and a 240/56 px sidebar. The header identity follows the federal flag/type dimensions below; the selected mockup determines the remaining density. See the [token consistency review](token-consistency.md) for the current token policy and cleanup.


The Swiss federal design system [Oblique](https://oblique.bit.admin.ch) (FOITT, MIT) ships as an Angular library. This prototype does not use it directly. Instead `css/tokens.css` reproduces Oblique's tokens as plain CSS custom properties and `css/main.css` hand-writes the components against them.

## Sources

Three sources were compared, in this order of authority for this app:

1. **Oblique code** (`github.com/oblique-bit/oblique`, v15.4.4). Palette and semantic aliases from `projects/oblique/src/styles/scss/core/_palette.scss` and `_variables.scss`; shadows from `core/mixins/_shadow.scss`; breakpoints from the legacy grid (sm 600, md 905, lg 1240, xl 1440). The newer `projects/design-system` package is framework-agnostic CSS but contains tokens and base typography only, no components yet; its shadow tokens are emitted without units and are unusable as-is.
2. **Oblique Figma library** (`docs/Oblique Library 15-1-2.fig`, "OB Library 15.1.2 – F1.0 (Community)"). Decoded from the fig-kiwi format; the extracted variables, text styles and effect styles are in [oblique-figma-tokens.json](oblique-figma-tokens.json), the component inventory in [oblique-figma-components.txt](oblique-figma-components.txt).
3. **The Claude Design wireframe** (`docs/wireframes/`), which already used Oblique's colours.

The source audit established the palette and shadows. The selected 1b mockup now governs layout and typography; other differences are listed below.

## Token tiers in `tokens.css`

| Tier | Prefix | Examples |
|---|---|---|
| Primitives | `--ob-red-500`, `--ob-secondary-800`, `--ob-font-size-xl`, `--ob-space-lg`, `--ob-radius-lg`, `--ob-shadow-default`, `--ob-z-widget` | Colour primitives define semantic aliases; components may use shared spacing/type/radius/elevation tokens directly |
| Semantic | `--ob-color-text`, `--ob-color-surface`, `--ob-color-border-strong`, `--ob-color-accent`, `--ob-color-link`, `--ob-color-focus`, `--ob-color-success` | Purpose-based colours used by components |
| Component | `--ob-control-height`, `--ob-touch-target`, `--ob-logo-*`, `--ob-sidebar-width`, `--ob-tile-gap`, `--ob-home-max-width`, `--ob-table-row-padding` | Shared component dimensions and compact application choices, with responsive value overrides in `tokens.css` |

## Mapping

| App token | Value | Oblique code | Figma variable |
|---|---|---|---|
| `--ob-color-text` | `#1c2834` | `$ob-default` (secondary-800) | Text/High Emphasis |
| `--ob-color-text-secondary` | `#2f4356` | `$ob-gray-darker` | Text/MediumEmphasis |
| `--ob-color-text-tertiary` | `#596978` | secondary-400 | Background/Secondary/light |
| `--ob-color-text-disabled` | `#828e9a` | `$ob-gray` | Text/Disabled |
| `--ob-color-surface` | `#f0f4f7` | `$ob-gray-extra-light` | Default states/hovered |
| `--ob-color-border` | `#dfe4e9` | `$ob-gray-lighter` | Border/border-default |
| `--ob-color-border-strong` | `#acb4bd` | `$ob-gray-light` | Border/border-highEmphasis |
| `--ob-color-border-input` | `#596978` | – | text/select component border |
| `--ob-color-footer-bg` | `#263645` | `$ob-dark` | Background/Secondary/dark-high |
| `--ob-color-accent` | `#e53940` | `$ob-accent` (red-500) | primary/500 |
| `--ob-color-accent-strong` | `#d8232a` | red-600 ("Nav color") | primary/600 |
| `--ob-color-link` | `#1d4ed8` | blue-700 ("Link color") | Text/Link |
| `--ob-color-focus` | `#8655f6` | `$tab-focus-color` | focus/purple-300 effect |
| `--ob-color-success` | `#047857` | `$ob-success` | green/700 |
| `--ob-color-warning` | `#c2410c` | `$ob-warning-dark` | orange/700 |
| `--ob-color-error` | `#99191e` | `$ob-error` | primary/800 ("Error color") |
| `--ob-color-info` | `#1e40af` | blue-800 (alert icon) | blue/800 |
| Headings | 24/32 bold, 17/24, 14/20 | Compact mockup 1b; Oblique font family/weights | heading/default/H1?H3 |
| Body | Noto Sans 14/20 | `$ob-font` | body/default |
| Overline | 12/16 medium, letter-spacing 1px | – | body/Overline |
| Logo lockup | Federal flag + 16 px gap + organisation/app text; responsive dimensions below | Federal design system `logo.postcss`, adapted for the compact app | Existing flag SVG |
| Entity type | Outlined 12/16 chip beside the title | Compact mockup 1b | ? |
| Breadcrumb | 13/20 | Compact mockup 1b | ? |
| Placeholder | secondary-400 (`--ob-color-placeholder`) | – | – |
| Pressed state | secondary-100 (`--ob-color-surface-hover`) | `ob-nav-hover` mixin `:active` | Components-States |
| Radius | control 2px, input 4px, pill | `$ob-border-radius-button`, `$ob-border-radius-base` | button 2, text 4, chip pill |
| Shadows | sm, md, default, lg | `core/mixins/_shadow.scss` | shadow/sm … shadow/lg |
| Focus ring | 3px box-shadow | `ob-tab-focus-box-shadow` | 3px spread |
| Content margin | 32px desktop, 16px ? 960px, 48px ? 2560px | Compact mockup 1b | ? |

## Known deltas

- **Focus colour**: code uses `#8655f6`, the Figma variable Border/focus is `#8b5cf6`. Code value kept.
- **Active tab underline**: the compact mockup and application use the `#e53940` accent; Figma uses pure red `#ff0000`.
- **Button label**: 14px medium in the compact mockup; desktop controls are 32px high, with larger touch controls.
- **Breadcrumb**: the compact application uses 13px, close to Oblique?s 0.8rem (12.8px).
- **Warning chip**: Oblique uses orange-600 (3.3:1 with white text); the app uses orange-700 (5.2:1) to pass AA for 12 px text.
- **Footer**: the compact footer uses 12px links, version and prototype note.
- **Alert / toast**: a compact variant (4 px status border plus light background) instead of Oblique's icon column; the status colours are the same.
- **Visited links**: only prose links (handbook, help popover) take Oblique's purple-700; catalogue navigation links are controls and stay blue.
- **Letter spacing**: compact 1b uses 0.25px body tracking and 1px uppercase table/panel labels.
- **Breakpoints**: the compact layout uses 600px for phone content, 960px for the navigation drawer, 1200px for small-desktop adjustments and 2560px for the centered wide-monitor band.
- The Figma file has **no spacing or radius variables**; spacing follows the legacy `$ob-spacing-*` scale (4 / 8 / 12 / 16 / 24 / 32 / 48).

## Federal header logo

Only the logo composition and its breakpoints are taken from the local `C:\Users\david\Documents\GitHub\designsystem` checkout. Source files: [logo.postcss](../../../designsystem/css/components/logo.postcss), [Logo.vue](../../../designsystem/app/components/ch/components/Logo.vue) and [tailwind.config.js](../../../designsystem/app/tailwind.config.js). The prototype keeps Oblique typography, colors, navigation and controls; it does not import the other design system's header or stylesheet.

The header uses the existing flag SVG followed by a 16 px gap (`--ob-logo-gap`), then the organisation and app text. The multilingual wordmark and divider are omitted at the user's request for the compact app; the wordmark SVG remains available as a reference asset. From 768 px the flag and title align at the top, including the source's `-0.16rem` optical title adjustment. The organisation stays bold and the app name regular.

| Viewport | Flag box | Title size |
|---|---|---|
| Below 480 px | 30 × 33 px | 14 px; acronym + app name |
| 480–639 px | 30 × 33 px | 12 px; full organisation + app name |
| 640–767 px | 30 × 33 px | 14 px |
| 768–1023 px | 30 × 33 px | 14 px |
| 1024–1279 px | 32 × 34 px | 14 px |
| 1280–1919 px | 32 × 34 px | 16 px |
| From 1920 px | 40 × 44 px | 18 px |

The identity row reserves 56 px below 768 px, 72 px up to 1919 px and 86 px from 1920 px, including the header bottom border. This compact outer spacing is a prototype choice; the reference's full top-header padding is not imported. The existing desktop navigation adds 45 px above 960 px. `--ob-header-height` derives from the identity and navigation tokens so the sidebar, sticky table headings, handbook anchors and mobile search stay below the header.

The flag image has empty alternative text; the home link's accessible name includes the full organisation, app name and destination even when the visible organisation is abbreviated. The original logo integration was checked at 21 widths; the simplified composition retains the flag and typography dimensions and has been checked from phone to wide desktop sizes.

## Components written in `main.css`

Master layout (header with logo and app title, main navigation, footer), breadcrumb, buttons (default, ghost, icon, pager), badge and chip, popover, dropdown menu, search field with listbox, view toggle, navigation tree, tables (zebra, hover, clickable rows), KPI cards, collapsible groups with tiles, tabs, description lists for facts, orbit graph, pagination, alert toast, empty state, handbook and API layouts, responsive rules at 960px and 600px, with the 2560px wide-monitor band, print stylesheet.

Oblique provides general scrolling utilities, but its documentation, source component inventory and bundled Figma 15.1.2 library do not define a back-to-top UI component. The prototype therefore uses an application-specific pattern built from the standard secondary button, spacing, shadow, focus and icon tokens. It appears only after meaningful page scrolling, respects reduced-motion preferences, and uses a compact icon-only presentation on phones.

Naming follows Oblique's flat kebab-case convention: `.ob-<component>-<part>`, variants as `.ob-<component>--<variant>`, states as `.is-*` or ARIA attributes (`aria-selected`, `aria-pressed`, `aria-current`, `aria-expanded`).

## Icons and fonts

The 25 icons are Oblique icons taken from the wireframe (C2PA metadata stripped), rendered as CSS masks so they take `currentColor`. Noto Sans (variable weight, latin and latin-ext subsets) and Noto Sans Mono are self-hosted under `assets/fonts/`; the mono font comes from the Oblique repository. Both fonts are SIL Open Font License 1.1.

## Licensing

Oblique code and styles: MIT (The Swiss Confederation, FOITT). Fonts: OFL 1.1. The federal logo and the "Schweizerische Eidgenossenschaft" wordmark are protected by the Coat of Arms Protection Act and are used here only because the prototype is built for a federal office; the MIT licence of the Oblique repository does not grant that right.
