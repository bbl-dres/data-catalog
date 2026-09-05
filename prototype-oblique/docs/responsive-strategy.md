# Responsive design review and implementation

Date: 2026-09-05. Scope: the current root `prototype-oblique`, following the compact 1b implementation. This review supersedes the earlier documents where responsive dimensions or behavior differ. The earlier wireframe snapshots and the separate icon review are unchanged.

## Recommendation

Use one content model and one navigation model, with a bounded workspace and components that adapt to their available width. A device's name or physical resolution is not a reliable layout signal: a tablet in split view, a zoomed laptop browser and a phone can all offer similar CSS widths.

Keep top-level sections in vertical reading order. In particular, **Domänen and Letzte Änderungen remain stacked at every width**. Make individual tables, tiles and profile facts adapt within that flow. On a large monitor, use comfortable reading widths and slightly more generous type and spacing. Empty space outside the working area is preferable to long, disconnected rows inside it. Do not enlarge a small amount of content merely to fill the screen.

The desktop header now separates institutional identity and utilities from primary navigation, following Oblique's structural hierarchy. Phones and tablets retain the compact header and navigation drawer. The API reference has no catalog tree; its mobile menu contains only the global destinations and utilities.

## Method and evidence

I inspected the rendering, routing, icon masks, tables, sidebar, keyboard handling and existing design documentation. Baseline browser measurements covered home, collections, a business-object profile, attributes, relationships and the handbook at 320, 390, 768, 1024, 1280, 1440, 1920, 2560 and 3840 CSS pixels. Follow-up checks also cover search, Swagger UI, intermediate boundaries and interaction state.

These are a heuristic review and browser checks, not user research or a formal accessibility certification. The prototype contains fictional data and short example datasets. Long datasets were injected only into the test browser.

### Findings

| Priority | Baseline observation | User impact | Implemented response |
|---|---|---|---|
| High | At 3840 px the profile's usable content spans 2222 px; each facts column is 1095 px wide. | Labels, values, contacts and actions feel disconnected despite the small type. | A centered 1600 px application band; profile/table content is about 1294 px with the expanded sidebar. |
| High | At 1920 px the summary spans 1616 px, while home tables stop at unrelated 800 and 928 px widths. | Strong horizontal expansion at the top and a sparse, uneven reading area below. | One summary grid and a consistent, stacked home reading area capped at 1120 px. |
| High | At 768 px, the six-column attribute table leaves little room for descriptions. Headers and ordinary words split into fragments. | A table fits mathematically but is difficult to scan or compare. | Width-sensitive cards, more balanced column widths, sentence-case headings and readable cell text. |
| High | At phone widths, table headers use `display:none`; the sort buttons disappear too. | Mobile users lose functionality that desktop users have. | A native sort selector in card mode, with the same sort state as desktop column headings. |
| High | An open drawer can lose keyboard focus when a viewport change hides its focused close button. | A keyboard or assistive-technology user loses their position. | Close the drawer on the layout boundary and restore focus to the corresponding visible navigation control. |
| Medium | At 390 px the five summary cards occupy 493 px; the domain heading begins at y=609. | Overview decoration delays useful content. | Compact summary links occupy 292 px; the domain heading begins around y=408. |
| Medium | Facts and contacts remain side by side even when the working area is only 720–736 px wide. | Long role labels, names and metadata compete for space. | Stack the profile facts sections below 880 px of available content width. |
| Medium | Relationships originally switched between graph and list by device. | The same task changed its reading order across devices. | Following the subsequent user request, the diagram is now the default everywhere, with a consistent table alternative in the tabs row. See [relationship-diagram.md](relationship-diagram.md). |
| Medium | The graph declares `touch-action:none`. | Touching the diagram captures gestures normally used to scroll the page or zoom. | Allow native vertical scrolling and pinch zoom, while preserving pointer-based diagram exploration. |
| Medium | Tree disclosures are only 28 px wide on touch layouts. | A visible 44 px row still contains a much smaller disclosure target. | 44 × 44 px disclosure controls, including touch-capable laptops. |
| Medium | Page controls sit only after the entire attribute list. | Long mobile card pages require excessive scrolling to change pages. | Additional previous/next controls above multi-page attribute lists. |
| Medium | The API reference inherits the complete catalog sidebar. | Irrelevant navigation competes with endpoint documentation. | A standalone, centered API reading area with global navigation retained. |
| Medium | Expanded metadata rows measure 53 px while single-line core facts and contacts measure 37 px. The native details wrapper changes inherited box sizing. | The same kind of information has inconsistent spacing. | Explicit border-box sizing on the shared facts component; single-line rows now consistently measure 37 px. Wrapped content can still grow. |

## Layout strategy

### 1. Separate the application frame from reading width

- The header, main workspace and footer share a **1600 px maximum width**. Beyond it, a subtle surface background marks the outer margin.
- Catalog/handbook navigation uses a **320 px default expanded sidebar** and **56 px icon rail**. Above 960 px, the right divider allows resizing between **240 and 480 px**, while reserving at least 600 px for content. Dragging or keyboard resizing saves the chosen width; narrowing the window only clamps its visible width. Double-click or Enter resets it to the default. The mobile drawer retains its own sizing.
- The home KPI grid and table sections share a **1120 px maximum reading width** and align at both edges. Table sections always follow one another vertically.
- Tile groups follow one another vertically and use the same full-width grid. Columns have a **220 px minimum**, shrinking to the available width on narrower screens. `auto-fill` keeps short rows aligned with larger groups, so a group with two entries uses the same card widths as one with nine. Column counts adapt to the content width, including sidebar changes.
- Catalog explanatory paragraphs remain limited to **72ch**. The handbook expands with the available space up to **1120 px**, with its paragraphs and lists capped separately at **100ch** (about 858 px). Reference tables can use the entire handbook width and switch to cards only when that space is insufficient. Chapters remain stacked vertically. Prose uses **15 px text with 24 px line height**. Facts and data rows use **14/20**, with supporting labels kept smaller.
- The API's inner reference area is capped at **1200 px**, centered without a sidebar.
- Entity type and status belong to **Kerndaten**, as explicitly labelled facts. The profile title row contains the name and export action; its description stays below the title. Status retains its visual chip within the facts row.

This deliberately leaves margins on very large displays. It also works when the application occupies only part of a monitor. A hypothetical future comparison workspace or large analytical grid could justify a wider task-specific canvas; the present catalog does not need one.

### 2. Restore Oblique's primary navigation hierarchy

For viewports wider than **960 px**, `Katalog`, `Handbuch` and `API` appear in a dedicated row below the identity and utility row. Navigation adds **45 px**, including its border; targets are 44 px high. With the [federal logo composition](design-system.md#federal-header-logo), the resulting desktop header is **117 px** high below 1920 px and **131 px** from 1920 px. The sidebar, sticky table headings and handbook anchors use the same derived header-height token or the measured header height.

At **960 px and below**, the extra navigation row disappears and the header exposes the global destinations through the drawer. The identity is **56 px** high below 768 px and **72 px** from 768 px to accommodate the federal logo separator. The additional desktop row costs 45 px of vertical space, gives small laptops more horizontal room for the identity, search and utilities and makes the destination hierarchy clearer.

The local reference at `C:\Users\david\Documents\GitHub\oblique` was inspected read-only. Its header template ends the identity header before rendering `ob-master-layout-navigation`. The same structure exists in the [official Oblique 15.4.4 header template](https://github.com/oblique-bit/oblique/blob/15.4.4/projects/oblique/src/lib/master-layout/master-layout-header/master-layout-header.component.html). This is evidence for the hierarchy, not a claim that this vanilla-JavaScript prototype is a complete or pixel-identical Oblique implementation. Compact typography, the catalog tree and the responsive table presentation remain deliberate product choices.

### 3. Respond to available content width

| Condition | Presentation |
|---|---|
| Viewport ≤960 px | Global navigation drawer; no permanently visible catalog tree |
| Viewport >960 px | Separate primary navigation row and the user's expanded/collapsed sidebar |
| Content >1100 px | Five summary cards in one row |
| Content 601–1100 px | Three summary cards per row |
| Content ≤600 px | Compact summary links |
| Diagram canvas <640 px | Vertical diagram panels at normal text size; pan controls and fullscreen reveal further groups |
| Diagram canvas ≥640 px | Balanced panels on either side of the entity, fitted to the available area |
| Profile content ≤880 px | Facts and contacts stack vertically |
| Very wide viewport | The working area stops growing at 1600 px |

CSS container queries control these content arrangements. The thresholds refer to the space remaining after the sidebar and padding, so opening or closing the sidebar can change a component's layout without changing the browser width. [MDN's container-query documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries) describes this distinction.

Collections retain the existing tile/table choice. Tiles have a more useful minimum width and slightly larger description text. There is no extra density setting: adding another persistent preference would complicate an already capable prototype without evidence that users need it.

### 4. Preserve table capabilities when rows become cards

The same table data and links serve both presentations. No low-priority columns are silently removed. A small `ResizeObserver` checks each table region, synchronizes its presentation and sort controls, and transfers keyboard focus when a resize changes which control is visible.

| Table | Minimum width for columns |
|---|---:|
| Six or more columns, including attributes | 880 px |
| Five columns | 720 px |
| Other tables | 640 px |
| Home domain summary | 480 px |
| Home recent changes | 680 px |

Below its threshold, a table presents labelled records. The entity name is the primary link. Wider card regions can show two records per row; phones show one. Descriptions are not clamped in this mode. Native sorting offers the same columns and ascending/descending choices as desktop. Sort order survives switching between cards and columns, and sorting resets pagination to the first page.

Column headings stay on one line without hyphenation. Automatic table layout accommodates the heading and its sort indicator; preferred column widths guide allocation without forcing headings into narrow fixed boxes. Body text can wrap normally. Narrow tables transition to cards before their columns become unusable.

The table/row/header/cell roles remain explicit. Column labels remain available to assistive technology while the hidden desktop sort buttons are replaced by the visible selector. CSV export continues to include all rows, not merely the current page. Print restores a conventional table and removes interactive sorting controls.

Cards are taller than dense rows; that is an intentional reading trade-off. The existing 50/100/200 page-size choices remain, and multi-page lists now offer navigation before and after the rows. Do not reduce mobile text merely to match desktop row counts.

### 5. Support touch, keyboards and short screens

- Use 44 px targets for primary touch controls, including tree disclosures, menus, navigation and pagination. The rule uses `any-pointer: coarse` as well as the narrow layout, so a touch-enabled laptop benefits too.
- Preserve drawer focus containment, Escape behavior and inert background content. Restore focus when the drawer closes or the layout changes. API pages offer the same global drawer without a catalog tree.
- Use 16 px text in mobile text-entry and sorting controls. Keep browser zoom enabled.
- Respect the bottom safe-area inset in the drawer and contain its internal scrolling.
- Keep search suggestions inside short landscape viewports. Avoid sticky table headings below 500 px viewport height.
- The default relationship diagram preserves page scrolling and browser pinch zoom in its inline view. Its explicit fullscreen workspace supports direct canvas panning and diagram pinch zoom. The table alternative contains every relationship, with the same responsive sorting and card behavior as other tables.
- Keep the active tab visible when its strip overflows. Maintain the existing semantic tab continuity when moving between profiles.

The [WCAG reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) explains the 320 CSS px target and the exception for inherently two-dimensional data tables. This implementation generally offers cards rather than requiring sideways scrolling. WCAG's [minimum target criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) is 24 CSS px with qualifications; **44 px is this design's touch target**, consistent with the separate [enhanced target criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html). This review does not imply conformance to every WCAG criterion.

### 6. Make homepage search visible

The approved home search proposal is implemented above the summary tiles. A short heading, description, search field, explicit **Suchen** button and example queries provide a visible entry point. The form grows to 880 px within the available content width. At 600 px of content width and below, the button moves below the field; text inputs remain 16 px and controls 48 px high.

The hero reuses the existing suggestions, keyboard controls and results page. Its popup opens below the entire form so it cannot cover the submit button. It has an internal scroll area sized to the visible viewport. Header search focuses this form on home and retains the compact expandable input on other pages. There is one active combobox, no automatic focus on page load and no second search index. The hero is omitted from print; **Domänen** and **Letzte Änderungen** remain stacked vertically. Checks cover submission by button and Enter, suggestions, empty queries/results, examples, focus restoration, touch taps, short landscape screens and four UI languages.

## Implementation map

| File | Responsibility |
|---|---|
| `index.html` | Dedicated desktop primary-navigation row |
| `css/tokens.css` | Workspace cap and shared header-height token |
| `css/main.css` | Reading scale, containers, stacked home sections, table/card states, standalone API, touch/print behavior |
| `js/ui.js` | Table semantics, field labels, primary cells and native card sorting |
| `js/app.js` | Table observation, sort/focus preservation, drawer resizing, header-aware anchors, touch handling |
| `js/views.js` | Compact home summaries and API global navigation without a tree |
| `js/detail.js` | Attribute column allocation and top pagination for long lists |
| `data/i18n.json` | New sort and pagination labels in the four supported UI languages |
| `tests/responsive.cjs` | Repeatable browser regression checks |

All catalog records, business-object icons, routing conventions and existing wireframe snapshots are preserved. This task does not publish or deploy the prototype.

## Verification

The automated regression script serves the prototype on an ephemeral loopback port. It uses an installed Playwright module and Edge on Windows (Chromium elsewhere); `PLAYWRIGHT_MODULE` can point to an existing Playwright installation and `PLAYWRIGHT_CHANNEL` can override the browser channel.

```powershell
# Set this only if Playwright is not resolvable from the normal Node module path.
$env:PLAYWRIGHT_MODULE = 'C:/path/to/node_modules/playwright'
node prototype-oblique/tests/responsive.cjs
```

The final Edge run passed **150 responsive view checks** at 15 widths from 320 to 3840 px, **3904 profile-render combinations**, and 16 live translated attribute layouts. The view matrix includes home, tiles, collection tables, profile overview/rows/relationships/history, search, handbook and Swagger UI. No horizontal page overflow, browser script errors or failed resource requests were observed.

Interaction checks cover card/column sorting and focus continuity, grouped-list focus, sidebar resizing, temporary 123-row pagination, full CSV export, print table restoration, drawer focus containment and orientation changes, keyboard tabs, handbook anchor offsets, desktop graph dragging, native vertical touch scrolling over the graph, 44 px disclosures, short-screen search and the API's global-only mobile menu. Header measurements match the responsive logo identity height plus the navigation row where visible. The domain/metadata regression confirms matching 37 px single-line fact rows.

These before/after measurements describe the original responsive pass. The later hero adds space above the summary and domain section; the linked home screenshots include that addition.

| Measured example | Before | After |
|---|---:|---:|
| Expanded-sidebar profile content on a very large screen | 2222 px wide | About 1294 px wide |
| Home summary at 390 px | 493 px tall | 292 px tall |
| Domain heading position at 390 px | y=609 | y=408 |
| Home tables on a large screen | 800 / 928 px wide | Shared 1120 px reading width |
| Expanded metadata single-line row | 53 px | 37 px, matching core facts and contacts |

Screenshots of the final implementation: [desktop overview](responsive-home-desktop.png), [desktop profile](responsive-profile-desktop.png), [phone overview](responsive-home-phone.png), [phone profile](responsive-profile-phone.png), [tablet attributes](responsive-attributes-tablet.png), [API on a laptop](responsive-api-laptop.png), and [expanded metadata](responsive-metadata-desktop.png).

### Remaining validation beyond this environment

Test on physical iOS Safari and Android Chrome, including the onscreen keyboard, safe areas and screen readers. Confirm 200% text enlargement and 400% browser zoom in the supported browser/OS combinations; the automated narrow-viewport tests exercise reflow widths but are not a substitute for those physical-device checks. The tested browser engine is Chromium via Edge, not WebKit or Firefox.

A short usability study should ask users to find a definition and contact, compare attributes, follow a relationship and retrieve an API endpoint. Include a phone, a small laptop, a tablet in split view and a large monitor. Measure completion, errors and orientation rather than how much of the screen is filled. Use those results to revisit card thresholds or default page size if necessary.
