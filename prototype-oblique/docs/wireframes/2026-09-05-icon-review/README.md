# Icon review, 2026-09-05

Open [index.html](index.html) for an interactive comparison at the prototype's 16 px tree and 20 px rail sizes. The preview contains a shortened, representative tree; counts are copied from the user's screenshot, not calculated from live data. No runtime files or earlier snapshots are changed.

## Recommendations

- Replace the business-object stack with a simple cube, subject to choosing a custom icon. The native Oblique `file` alternative is shown for comparison; it is more easily confused with a document or reference list.
- Keep the same business-object icon for the category and every object, across navigation, search, overview and relationships. Use folders for domains; avoid per-topic pictograms.
- Replace the manual's `file_list` with `book`, and the mobile navigation button's `list` with `menu`.
- Keep `home`, `folder`, `database`, `file_list`, `briefcase`, `apps`, and `tag` for now. Database and briefcase are imperfect but distinguishable metaphors. Oblique's `grid` represents tiles, not a table.
- Optionally compare `swap_horizontal` for APIs with users: it suggests exchange rather than branching/lineage, but could also mean switching. The sidebar preview retains `branch`.
- Keep the existing search, help, export, close, external-link, disclosure, mail and phone icons. Preserve accessible names for icon controls and treat icons alongside visible text as decorative.

These are design judgments, not Oblique rules. The cube has been drawn to harmonize with the existing set; it is not an official Oblique asset. Its meaning should be checked with catalog users, especially when shown without its label.

## Implementation observations

`data/model.json` defines the eight catalog-kind icons. `js/data.js` repeats those icon names in relationship groups. Any future implementation should derive relationship icons from the model too, so changing the business-object icon also changes graph nodes and relationship headings. `js/views.js` separately chooses the manual and mobile-menu icons. `css/main.css` maps icon names to SVG masks; `js/ui.js` makes those icon spans decorative.

Check tree rows (16 px), rail (20 px), overview cards, search, relationship headings, graph satellites (22 px), and graph center (28 px). Review selected, hovered and keyboard-focused states. The present review has not changed or functionally retested the application.

## Sources and assets

The library inventory was checked against the same release used by the prototype's design-system audit: [Oblique 15.4.4](https://github.com/oblique-bit/oblique/tree/15.4.4/projects/oblique/icons), commit `c63ea9fa79306e2e3a15ef0c4a538bd1abdbbd2f`. This inventory has no `cube`, `table`, `package` or `plug` icon.

- `icons/book.svg`, `icons/menu.svg`, `icons/file.svg`, and `icons/swap_horizontal.svg` are unchanged downloads from that release's `projects/oblique/icons/` directory. The upstream [MIT license](icons/LICENSE-Oblique.txt) is included.
- `icons/cube.svg` is an original review candidate: a 24 × 24 view box, 1.5 px strokes, and monochrome rendering. No external icon library was introduced.
- Current icons and Noto Sans are referenced from the prototype's existing assets. All preview resources are local, so the comparison also works without an internet connection.

The earlier wireframe backup is untouched.

## Preview verification

Checked in local headless Edge: all three choices update the tree and rail, the tree measures 240 px, all 24 referenced icon assets load, and the page has no horizontal overflow at 390, 768 and 1200 px. Opening the HTML directly via `file://` also works. No script or resource errors occurred. [comparison.png](comparison.png) shows the default cube proposal at desktop size.
