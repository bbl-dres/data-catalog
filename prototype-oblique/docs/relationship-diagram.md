# Relationship diagram

Implemented after the request to make the diagram the default and improve the crowded `Architektonische Sicht` profile with 24 relationships.

## Presentation

- Every newly opened profile defaults to the diagram in **Beziehungen**. The current profile retains a user's diagram/table choice across local updates.
- **Liste anzeigen** sits on the right inside `.ob-tabs`, outside the element with `role="tablist"`. On narrow screens it wraps below the scrollable tab labels, aligned right.
- The alternative is one shared sortable table: **Eintrag**, **Beziehung**, **Kontext**. It includes all relationships, supports the existing mobile cards and sorting, and is used for printing.
- The diagram uses the remaining viewport height after the tabs, with a minimum working height on short screens. Its fullscreen mode fills the browser window.

## Diagram layout and large groups

The fixed orbit and overlapping circles have been replaced with panels connected to the central entity. On wide canvases, panels occupy two balanced columns, with enough vertical space for each panel. One-group and empty diagrams use a smaller canvas. Connections run through the space between panels and the entity.

Each group shows a total count and at most **six entries per page**. Paging changes the visible entries without increasing panel size or losing access to later records. Thus a group containing hundreds of relationships does not create a huge circle, overlap adjacent groups or hide records inside a clipped container. The table remains the complete alternative for scanning all entries.

Below 640 px of canvas width, panels form a vertical diagram with one entry per row at normal text size. Reset fits the width and returns to the top. Users can move through the canvas using the arrows, keyboard, or fullscreen touch panning. The application page still scrolls normally outside fullscreen.

## Controls

| Control | Behavior |
|---|---|
| Zoom in/out | Changes diagram zoom around the viewport center; zoom is bounded to 15–200% |
| Reset/fit | Restores the initial framing: all panels on wide canvases, readable width/top on narrow canvases |
| Percentage | Displays zoom; clicking restores 100% around the current viewport center |
| Pan | Enables dragging the canvas; a drag does not activate a node |
| Select | Enables clicking nodes without drag panning |
| Direction arrows | Move the view in the indicated direction; useful for touch and precise navigation |
| Fullscreen | Opens a full-window modal workspace with all controls; exit button or Escape restores the inline view |

Clicking an entry selects it in either tool mode. Selection highlights its group connection and displays the complete name, relationship/context and **Eintrag öffnen** link below the canvas. This provides full names even when a compact node label is truncated. Enter/Space activate focused nodes; Tab reaches entries and group paging controls. Focused offscreen nodes are brought into view. Within the canvas, arrow keys pan, `+`/`-` zoom and `0` resets. Escape clears an inline selection or closes fullscreen. Ctrl/Cmd keyboard shortcuts remain available to the browser; Ctrl/Cmd+wheel zooms the diagram at the pointer.

Inline touch gestures retain native page scrolling and browser zoom. In fullscreen, one-finger dragging pans and two-finger pinching zooms the diagram. The fullscreen implementation uses a native modal dialog, keeping the rest of the page inert and restoring focus on exit. It fills the browser window and retains browser chrome. See [MDN on modal dialogs](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal) and [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action).

## Implementation and checks

`js/graph.js` owns layout and local interactions, with state passed from `app.js`. `css/graph.css` contains the diagram styles. Existing zoom/fullscreen icons are reused; three small local SVG masks provide pan, selection and fit controls. They are additions to the prototype, not claimed as official Oblique assets. No graph library or new runtime dependency is added.

Checks cover non-overlapping bounds for every catalog entity in both orientations, large groups, actual table rows/sorting, toolbar actions, selection/navigation, keyboard visibility, fullscreen resize/Escape, direct touch pan/pinch, normal inline touch scrolling and print. A browser-only stress fixture has **1,000 relationships** across five groups: the diagram renders 30 entry buttons while the table retains all 1,000 rows. These checks do not establish performance for an unbounded catalog or substitute for physical-device and screen-reader testing.

Run commands are in [tests/README.md](../tests/README.md). The existing responsive and functional suites are maintained alongside the dedicated diagram suite.
