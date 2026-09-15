# Design review: layering, tokens and shared styles

Date: 15 September 2026. Status: implemented and verified in Microsoft Edge on Windows.

The stylesheets were already token-driven: no component rule carries a raw colour, and nearly every length resolves to a `tokens.css` value. The gaps were in three places. The z-order vocabulary was incomplete, so seven rules used a literal `1` and the drawer computed its own layer. Token hygiene had drifted: two names for one control height, sixteen tokens nothing used, a focus ring composed by hand. And the same design code existed several times, most visibly three JavaScript routines that positioned floating surfaces with different gaps and different behaviour on short screens. This pass documents the layer map, cleans the token file, merges the duplicates into shared modules and adds a regression suite for the resulting contracts.

## Method and evidence

Read all eight stylesheets, the templates that emit their class names and the three modules that position floating surfaces. Cross-checked every `var(--ob-*)` against `tokens.css` in both directions, listed every `z-index`, and grepped every literal length, colour and percentage in component CSS. Oblique's legacy `$ob-z-index-*` scale was read from the upstream `_variables.scss` to name the missing layers.

Measurements use a Playwright script in headless Edge at 1440×900, 1280×420 and 390×844: computed `z-index` of each layered element, offsets between floating surfaces and their triggers, action-button metrics and screenshots. The script ran once before and once after the change against the local JSON catalog; the [before](2026-09-15-design-token-review/before-measurements.json) and [after](2026-09-15-design-token-review/after-measurements.json) samples and comparison images are stored beside this review. The same contracts are now asserted by [`tests/layering.cjs`](../../tests/README.md).

## Findings and implementation

### DR-01 — Z-order vocabulary incomplete · Medium · Fixed

`tokens.css` carried five of Oblique's seven legacy layers and no map of who uses which. Seven rules raised elements with a literal `z-index: 1` (header search toggle, home search host, sidebar grip, table edge shadows, sticky row headers, fullscreen diagram toolbar, focused print-layout segment), and the navigation drawer computed `calc(var(--ob-z-overlay) + 1)` to sit above its backdrop. Nothing was visually wrong, but the intent of each raise was undocumented and the next contributor had no scale to pick from.

Two tokens complete the scale: `--ob-z-local: 1` (an application addition; Oblique's default is 0) for raises inside a component's own stacking context, and Oblique's `--ob-z-overlay-top: 1010` for the drawer. The table edge shadows drop their `z-index` entirely: positioned pseudo-elements already paint above the in-flow table, and the literal had the side effect of painting the shadows over an open suggestion list on the home page, whose host is raised by the same value. The [design guide](../design-system.md#layering) now carries the layer map, including the rule that native dialogs and popovers live in the browser's top layer above every token, so a toast must only be raised after a modal dialog has closed (the editor and the print workspace already do this).

| Element | Before | After |
| --- | --- | --- |
| Navigation drawer (390 px) | 1006, computed | 1010, `--ob-z-overlay-top` |
| Table edge shadows | 1 | none |
| Seven local raises | literal 1 | `--ob-z-local` |
| Header, sidebar, widgets, overlay, toast | 101 / 10 / 200 / 1005 / 1400 | unchanged |

### DR-02 — Floating surfaces positioned three ways · Medium · Fixed

Select menus (`select-menu.js`), the field picker (`field-picker.js`) and the print popovers (`diagram-export.js`) each contained a private copy of the same routine: read the visual viewport, clamp to an inset, place the surface below its trigger. The copies had drifted.

| Surface | Gap below trigger | When the bottom lacks room | Height cap |
| --- | --- | --- | --- |
| Select menu | 4 px (`--ob-menu-offset`) | flips above | viewport minus 16 px |
| Field picker | 8 px (`--ob-space-sm`) | flips above | larger side of the trigger |
| Print popover | 4 px | clamped, covering its trigger | CSS only |

One helper, `ui.anchorPopover(node, trigger, { align, maxHeight })`, with `ui.viewportBox()` for the keyboard-aware viewport, replaces the three routines. Every surface now sits `--ob-menu-offset` (4 px) below its trigger, flips above when only the top has room, and is capped to the larger side while that side offers at least half the visible height, so it scrolls instead of covering its trigger. On shorter viewports it takes the whole visible height as before, which keeps the action row of the print filter popover reachable at 390×280 (the print-mobile suite caught the stricter first version of this rule). The print workspace's compact-mode check uses the same viewport helper.

| Measurement | Before | After |
| --- | --- | --- |
| Field picker gap below its trigger | 8 px | 4 px |
| Suggestion list, select menu, print popover gap | 4 px | 4 px |
| Print popover at 1280×420, trigger bottom at 146.6 px | 404 px tall from y = 8, covering the trigger | 261 px tall from y = 150.6, ending 8 px above the bottom |
| Select menu cap at 1440×1000 | 884 px | 777 px, the room below its trigger |

Evidence: [before](2026-09-15-design-token-review/before-export-popover-short.png) and [after](2026-09-15-design-token-review/after-export-popover-short.png) at 1280×420; [before](2026-09-15-design-token-review/before-field-picker-1440.png) and [after](2026-09-15-design-token-review/after-field-picker-1440.png) field picker.

### DR-03 — Focus ring composed by hand and split across files · Low · Fixed

`.ob-table-wrap:focus-visible` rebuilt the inset ring as `inset 0 0 0 3px` instead of using `--ob-focus-ring-inset`; four further inset-ring rules were spread over two files; `.ob-search-input:focus-visible` repeated the global ring. `components.css` now owns one inset list (controls inside scroll containers plus the focusable scroll regions: tab panels and sideways-scrolling tables), and the forced-colors block at the end of `main.css` mirrors that list with an inset outline. The measured ring is unchanged: `rgb(134, 85, 246) 0 0 0 3px inset`.

### DR-04 — Wrapping buttons defined six times · Low · Fixed

`height: auto; min-height: …; white-space: normal` appeared in six rules (choice-popover actions, empty-state actions, account submit, editor discard dialog, print download at 600 px, print popover actions at 600 px) with three different vertical paddings. One modifier, `.ob-button--wrap`, replaces them; choice-popover action rows and empty-state recovery apply it to every button, and the account submit, editor dialog and print download buttons carry the class in their templates. Single-line buttons keep 32 px (44 px on touch); popover actions gain the 4 px vertical padding the empty state already had, so a wrapped label no longer touches the border.

### DR-05 — Token hygiene · Low · Fixed

- `--ob-control-height-sm` and `--ob-control-height-lg` were aliases of `--ob-control-height` with identical values; five usages now name the single token.
- Sixteen tokens had no consumer in CSS or JavaScript, against the file's own rule of keeping only used values: `--ob-red-200/300/400/700/900`, `--ob-secondary-500`, `--ob-green-50/800`, `--ob-orange-600`, `--ob-font-weight-light`, `--ob-line-height-table`, `--ob-shadow-sm`, `--ob-duration-smooth/fast`, `--ob-color-tab-text`, `--ob-radius-none`. Removed; the PDF palette reads colours by token name and uses none of them.
- Added `--ob-radius-circle` for the five `50%` radii (avatar, diagram hub and bubbles) and `--ob-graph-line-width` with a selected variant derived from the 3 px marker width, replacing unitless SVG stroke literals.
- Two forced-colors `outline-offset: -1px` values now derive from the 1 px border token; the diagram count position gained a comment deriving its 14.645 % from the circle geometry.
- The print dialog backdrop used the drawer backdrop token (42 %); it now uses the modal dialog token (50 %) like the account and discard dialogs. The dialog is fullscreen, so the change is not visible, but the contract is one.
- Confirmed as intentionally literal, per the token policy: media and container query thresholds, proportional percentages, print `11pt`, off-screen positions and the editor's content-dependent `em` column minima.

### DR-06 — Duplicated layout rules · Low · Fixed

- `.ob-tab-list` in `graph.css` re-declared the `.ob-tabs` scroll strip; both now share one rule in `main.css`.
- `.ob-collection-tabs-frame, .ob-detail-tabs-frame` were always styled as a pair; their rules folded into `.ob-tabs-frame`.
- `.ob-collection-controls, .ob-detail-controls` were paired in four rules; both templates now also carry `.ob-view-controls`, which owns the shared row, while the two context classes keep their own wrap rules.
- Three visually-hidden implementations (`.ob-sr-only`, the editor's table-cell labels, the print header's language caption) collapsed into the one class, applied by the templates.

Stylesheet and script version stamps were raised to `20260915-design-review` so returning browsers load the new files together.

### Assessed and left

- **Supporting text**: the 13/20 secondary triple appears in about a dozen rules. The tokens are consistent; a `.ob-note` utility would need template changes in a dozen places for no visible gain.
- **Selection marker**: eight components share the 3 px transparent border that turns accent on hover or selection. The tokens are consistent and the forced-colors block already lists them; a shared class would only move lines.
- **Editor table**: `.ob-edit-table` restyles rows with form controls and 12 px padding rather than reusing `.ob-table`. Sharing the base would change the measured editor layouts of the 13 September review; noted as a candidate.
- **Chevron rotation**: three rotate-on-expand idioms exist, but a global rule would invert group headers and tree toggles, which swap icons instead of rotating.
- **Oblique scale names**: `--ob-line-height-sm` and `-md` both resolve to 1.25 rem and `--ob-font-size-lg` aliases `-md`; kept because they are Oblique's names and may diverge.
- **Skip link** at `--ob-z-overlay`: stronger than the header needs, harmless.

## Verification

| Check | Result |
| --- | --- |
| Before/after measurements (three viewports, 30 samples each) | Only the intended values changed; no page errors |
| `layering.cjs` (new) | Passes: layer tokens and users, edge shadows without z-index, inset ring on the table region, one 4 px gap for suggestions, field picker, select menu and print popover, short-viewport popover below its trigger, wrapping buttons, drawer above backdrop |
| `core.test`, `visibility`, `print-menus`, `print-tiles`, `print-mobile`, `polish`, `mobile`, `graph`, `laptop-layout`, `contrast`, `design-review`, `loading`, `diagram`, `print-tree` | Pass |
| `editing` (PGlite and Playwright) | Passes: the discard dialog buttons and hidden table-cell labels render through the real editor |
| `design-consistency`, `responsive`, `sidebar`, `functional`, `list-search`, `diagram-filters` | Fail identically on a clean checkout of HEAD (section list without System, header offset 80 ≠ 84, sidebar width 360 ≠ 480, section toggle state, the `Buchungskreis (COMP_CODE)` label, a zero field count). Not caused by this change; they need their own follow-up |

Limitations: measurements are CSS pixels in headless Edge on Windows; Safari, Firefox and physical touch devices were not exercised. The visual check of the table edge shadow after removing its `z-index` compares screenshots at 390 px, where the shadow is faint by design.
