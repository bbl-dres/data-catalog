# BBL Canvas

A minimal Miro-style canvas for sketching data architecture. Combines ideas from `prototype-sqlite` (BBL chrome), `prototype-mermaid` (floating canvas toolbar), and `prototype-lineage` (node + edge rendering).

Vanilla HTML/CSS/JS · zero build step · single CDN dep (SheetJS).

## Three views, two modes

- **Diagram** (default) — pan, zoom, click to select. In Edit mode: drag the node body to move; the title, system, and column name/type become editable in place; click the type icon to cycle node type; click the column key to cycle PK → FK → –; small × buttons delete the node or a column; "+ Spalte" adds a column; drag from the round port to another node to create a relation; click an edge to delete it.
- **Table** — same nodes as a filterable list. In Edit mode the cells (label, type, system, schema, tags) become editable in place and a × button per row deletes the node. Plain click on a row in View mode jumps back to the diagram.
- **API** — Swagger-style mock endpoints generated from each Table/View node (GET / POST / PUT / DELETE). "YAML kopieren" copies an OpenAPI 3.0 stub to the clipboard.

The View / Edit toggle (top-right) gates all write actions. There is no popover or modal — the node and the table row *are* the editor.

## Excel round-trip

Three-sheet workbook:

| Sheet | Columns |
|-------|---------|
| `Nodes`   | `id`, `label`, `type`, `system`, `schema`, `x`, `y`, `tags` |
| `Columns` | `node_id`, `name`, `type`, `key` (PK/FK/empty) |
| `Edges`   | `id`, `from`, `to`, `label` |

**Import** replaces the canvas after a confirmation prompt. **Export** downloads `bbl-canvas-YYYY-MM-DD.xlsx`.

## Persistence

Canvas state mirrors to `localStorage['canvas.state.v1']` after every mutation, so a refresh keeps your layout. To reset to the seed data, clear that key in DevTools.

## File layout

```
prototype-canvas/
├── index.html         # BBL chrome + view router
├── css/
│   ├── tokens.css     # design tokens (colors, type, spacing)
│   └── styles.css     # canvas + table + API + inline edit affordances
├── js/
│   ├── state.js       # store, persistence, mutations
│   ├── canvas.js      # pan / zoom / drag, render nodes & edges
│   ├── editor.js      # inline-edit handlers, +Node, drag-to-edge, delete
│   ├── table.js       # filterable table view
│   ├── api.js         # mock Swagger generator
│   ├── xlsx_io.js     # 3-sheet Excel import/export
│   └── app.js         # bootstrap, view tabs, mode toggle, toasts
└── data/
    └── canvas.json    # seed: 6 nodes (buildings/rooms/leases/tenants/view/api)
```

## Run locally

```bash
# from the repo root
python3 -m http.server 8000
# then open
http://localhost:8000/prototype-canvas/
```

## Scope

The canvas is a single workspace — no built-in layer switcher. Multiple architectural views (physical, logical, conceptual) are intended to be saved and loaded as separate canvases. A future entity palette (business objects, systems, value lists, …) will appear in Edit mode.

Out of scope for v1: undo/redo, real backend, multi-language UI, real OpenAPI export, server-side persistence.
