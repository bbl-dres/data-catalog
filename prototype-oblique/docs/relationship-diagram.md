# Relationship diagram

The bubble relationship diagram is restored, retaining the controls and default-view behaviour added for the crowded `Architektonische Sicht` profile with 24 relationships. The rectangular panel version is saved as a [component reference](wireframes/relationship-panels-2026-09-05/README.md) for possible future lineage work.

## Presentation

- Every newly opened profile defaults to the diagram in **Beziehungen**. The current profile retains a user's diagram/table choice across local updates.
- **Liste anzeigen** sits on the right inside `.ob-tabs`, outside the element with `role="tablist"`. On narrow screens it wraps below the scrollable tab labels, aligned right.
- The alternative is one shared sortable table: **Eintrag**, **Beziehung**, **Kontext**. It includes all relationships, supports the existing mobile cards and sorting, and is used for printing.
- The diagram uses the remaining viewport height after the tabs, with a minimum working height on short screens. Its fullscreen mode fills the browser window.

## Diagram layout and large groups

The central entity is a dark circle inside a pale ring, with its name underneath. Related entities sit inside circular groups with soft outer rings, count badges and captions. Entries use the original icon-above-label presentation. Straight, undirected connections link the groups to the central entity on a white canvas. The diagram describes associations; it does not imply data flow, processing order or lineage.

The orbit adapts to the canvas proportions. Its radius increases until the complete group bounds, including captions and paging controls, clear each other and the central entity. Bubble diameters follow the visible entry grid; the grid fits inside the inner circle. Empty and one-group diagrams remain compact. Node labels and captions truncate rather than extending into adjacent groups; full names are available through titles and the selection details.

Each group shows a total count and at most **six entries per page**. Paging does not enlarge the bubble. Hundreds of relationships therefore remain reachable without increasing its diameter; the table provides the complete alternative for scanning all entries.

Below 640 px of canvas width, circles form a vertical arrangement with **three entries per page**, preserving normal-size labels on phones. Curved associations lead back to the same central entity. Reset fits the width and returns to the top. Users move through the canvas using the arrows, keyboard, or fullscreen touch panning. The application page still scrolls normally outside fullscreen.

## Controls

| Control | Behavior |
|---|---|
| Zoom in/out | Changes diagram zoom around the viewport center; zoom is bounded to 15–200% |
| Reset/fit | Restores the initial framing: the complete orbit on wide canvases, readable width/top on narrow canvases |
| Percentage | Displays zoom; clicking restores 100% around the current viewport center |
| Pan | Enables dragging the canvas; a drag does not activate a node |
| Select | Enables clicking nodes without drag panning |
| Direction arrows | Move the view in the indicated direction; useful for touch and precise navigation |
| Fullscreen | Opens a full-window modal workspace with all controls; exit button or Escape restores the inline view |

Clicking an entry selects it in either tool mode. Selection highlights its group connection and displays the complete name, relationship/context and **Eintrag öffnen** link below the canvas. This provides full names even when a compact node label is truncated. Enter/Space activate focused nodes; Tab reaches entries and group paging controls. Focused offscreen nodes are brought into view. Within the canvas, arrow keys pan, `+`/`-` zoom and `0` resets. Escape clears an inline selection or closes fullscreen. Ctrl/Cmd keyboard shortcuts remain available to the browser; Ctrl/Cmd+wheel zooms the diagram at the pointer.

Inline touch gestures retain native page scrolling and browser zoom. In fullscreen, one-finger dragging pans and two-finger pinching zooms the diagram. The fullscreen implementation uses a native modal dialog, keeping the rest of the page inert and restoring focus on exit. It fills the browser window and retains browser chrome. See [MDN on modal dialogs](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal) and [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action).

## Implementation and checks

`js/graph.js` owns layout and local interactions, with state passed from `app.js`. `css/graph.css` contains the diagram styles. Node, halo, caption and paging geometry is supplied to CSS through custom properties from the layout code, so painted circles and calculated bounds share the same dimensions. Colours, typography and toolbar spacing use the application tokens. Existing zoom/fullscreen icons are reused; three small local SVG masks provide pan, selection and fit controls. They are additions to the prototype, not claimed as official Oblique assets. No graph library or new runtime dependency is added.

Checks cover non-overlapping bubble/caption bounds for every catalog entity in both orientations, nodes fitting inside the rendered circles, large groups, actual table rows/sorting, toolbar actions, selection/navigation, keyboard visibility, fullscreen resize/Escape, direct touch pan/pinch, normal inline touch scrolling and print. A browser-only stress fixture has **1,000 relationships** across five groups: the wide diagram renders 30 entry buttons while the table retains all 1,000 rows. Layout checks also verify that increasing groups from 1,000 to 10,000 entries does not enlarge the orbit. These checks do not establish performance for an unbounded catalog or substitute for physical-device and screen-reader testing.

Run commands are in [tests/README.md](../tests/README.md). The existing responsive and functional suites are maintained alongside the dedicated diagram suite.
