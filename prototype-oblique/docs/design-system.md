# Design system: Oblique without Angular

The Swiss federal design system [Oblique](https://oblique.bit.admin.ch) (FOITT, MIT) ships as an Angular library. This prototype does not use it directly. Instead `css/tokens.css` reproduces Oblique's tokens as plain CSS custom properties and `css/main.css` hand-writes the components against them.

## Sources

Three sources were compared, in this order of authority for this app:

1. **Oblique code** (`github.com/oblique-bit/oblique`, v15.4.4). Palette and semantic aliases from `projects/oblique/src/styles/scss/core/_palette.scss` and `_variables.scss`; shadows from `core/mixins/_shadow.scss`; breakpoints from the legacy grid (sm 600, md 905, lg 1240, xl 1440). The newer `projects/design-system` package is framework-agnostic CSS but contains tokens and base typography only, no components yet; its shadow tokens are emitted without units and are unusable as-is.
2. **Oblique Figma library** (`docs/Oblique Library 15-1-2.fig`, "OB Library 15.1.2 – F1.0 (Community)"). Decoded from the fig-kiwi format; the extracted variables, text styles and effect styles are in [oblique-figma-tokens.json](oblique-figma-tokens.json), the component inventory in [oblique-figma-components.txt](oblique-figma-components.txt).
3. **The Claude Design wireframe** (`docs/wireframes/`), which already used Oblique's colours.

All three agree on the palette, the type scale and the shadows. Where they differ, the code wins and the delta is listed below.

## Token tiers in `tokens.css`

| Tier | Prefix | Examples |
|---|---|---|
| Primitives | `--ob-red-500`, `--ob-secondary-800`, `--ob-font-size-xl`, `--ob-space-lg`, `--ob-radius-lg`, `--ob-shadow-default`, `--ob-z-widget` | Raw values, only used to define the tiers below |
| Semantic | `--ob-color-text`, `--ob-color-surface`, `--ob-color-border-strong`, `--ob-color-accent`, `--ob-color-link`, `--ob-color-focus`, `--ob-color-success` | What `main.css` uses |
| Component | `--ob-control-height`, `--ob-header-logo-width`, `--ob-tree-panel-basis`, `--ob-table-row-padding`, `--ob-graph-height` | Sizes that several components share |

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
| Headings | 28/32 bold −0.5px, 23/28, 17/24 | `core/mixins/_typography.scss` | heading/default/H1–H3 |
| Body | Noto Sans 16/24 | `$ob-font` | body/default |
| Overline | 12/16 medium, letter-spacing 2px | – | body/Overline |
| App title | 26/34 light | – | _components-only/App title |
| Radius | control 2px, input 4px, pill | `$ob-border-radius-button`, `$ob-border-radius-base` | button 2, text 4, chip pill |
| Shadows | sm, md, default, lg | `core/mixins/_shadow.scss` | shadow/sm … shadow/lg |
| Focus ring | 3px box-shadow | `ob-tab-focus-box-shadow` | 3px spread |
| Content margin | 32px desktop, 16px ≤ 905px | – | Grid desktop 32 / mobile 16 |

## Known deltas

- **Focus colour**: code uses `#8655f6`, the Figma variable Border/focus is `#8b5cf6`. Code value kept.
- **Active tab underline**: Figma uses pure red `#ff0000` (red-bund) for active highlights; code and wireframe use `#d8232a`. Code value kept.
- **Button label**: Figma 14px medium, Oblique code 16px. 16px kept.
- **Letter spacing**: the wireframe adds 0.5px to body text; Figma body/default uses 0.1%. The wireframe value is kept for fidelity with the approved mockup.
- **Breakpoints**: Figma had a removed collection (375 / 768 / 1024 / 1440); the code grid (600 / 905 / 1240 / 1440) is used.
- The Figma file has **no spacing or radius variables**; spacing follows the legacy `$ob-spacing-*` scale (4 / 8 / 12 / 16 / 24 / 32 / 48).

## Components written in `main.css`

Master layout (header with logo and app title, main navigation, footer), breadcrumb, buttons (default, ghost, icon, pager), badge and chip, popover, dropdown menu, search field with listbox, view toggle, navigation tree, tables (zebra, hover, clickable rows), KPI cards, collapsible groups with tiles, tabs, description lists for facts, orbit graph, pagination, alert toast, empty state, handbook and API layouts, responsive rules at 905px and 600px, print stylesheet.

Naming follows Oblique's flat kebab-case convention: `.ob-<component>-<part>`, variants as `.ob-<component>--<variant>`, states as `.is-*` or ARIA attributes (`aria-selected`, `aria-pressed`, `aria-current`, `aria-expanded`).

## Icons and fonts

The 25 icons are Oblique icons taken from the wireframe (C2PA metadata stripped), rendered as CSS masks so they take `currentColor`. Noto Sans (variable weight, latin and latin-ext subsets) and Noto Sans Mono are self-hosted under `assets/fonts/`; the mono font comes from the Oblique repository. Both fonts are SIL Open Font License 1.1.

## Licensing

Oblique code and styles: MIT (The Swiss Confederation, FOITT). Fonts: OFL 1.1. The federal logo and the "Schweizerische Eidgenossenschaft" wordmark are protected by the Coat of Arms Protection Act and are used here only because the prototype is built for a federal office; the MIT licence of the Oblique repository does not grant that right.
