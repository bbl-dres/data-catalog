# Architektur-Canvas

Miro-style sketching surface for data architecture — drag tables, views, APIs, files, and code lists onto a canvas, group attributes into property sets, and connect them with relationships. In-app branding: *BBL Canvas*. Part of the [BBL Data Catalog prototypes](../README.md).

**Live demo:** https://bbl-dres.github.io/data-catalog/prototype-canvas/

## Features

- Three views: **Diagramm** (canvas), **Tabelle** (filterable lists per entity type), **API** (Swagger-style mock spec)
- Two modes: **Ansicht** (read-only) / **Bearbeiten** (inline editing, drag-to-edge, palette, action bar)
- Five node types: Tabellen, Views, APIs, Dateien, Wertelisten
- Property sets derived from the free-text `set` column of attributes — no separate set entity
- System frames (Miro-style group bounding boxes) per `system` value
- Right-side info panel for selected node / system / attribute / edge
- Sichtbarkeits-Dropdown with tri-state master toggle and bulk expand/collapse for property sets
- Excel round-trip (8-sheet workbook) and JSON download
- localStorage persistence — refresh keeps your layout
- Hash-based URL sync for view + selection — shareable deep links
- German UI

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000/prototype-canvas/
```

Any static file server works.

## Excel round-trip

Eight-sheet workbook keyed by `node_id`:

| Sheet | Description |
|-------|-------------|
| `Systeme`     | Aggregated stats per source system |
| `Tabellen`    | Nodes of type `table` / `view` |
| `APIs`        | Nodes of type `api` |
| `Dateien`     | Nodes of type `file` |
| `Wertelisten` | Nodes of type `codelist` |
| `PropertySets` | Derived from distinct `attribute.set` values (informational on import) |
| `Attribute`   | Every column across all nodes — set names live in the `set` column |
| `Beziehungen` | Edges with optional label |

**Import** replaces the canvas after a confirmation prompt. **Export ▾** offers Excel, JSON, and (planned) PDF.

## Data model

See [docs/DATAMODEL.md](docs/DATAMODEL.md) for the Supabase-target relational model (system / node / attribute / relationship / canvas_layout / data_classification / contact / revision) and the i18n strategy.

## Tech notes

- Vanilla JavaScript IIFE modules on `window.CanvasApp.<Module>`
- [SheetJS](https://github.com/SheetJS/sheetjs) loaded via CDN for Excel I/O
- No build step, no npm dependencies

## License

MIT — see repo root [LICENSE](../LICENSE).
