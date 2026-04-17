# Data Lineage Viewer

Interactive data-lineage graph with a live JSON editor, pan / zoom, column-level mappings, and system-based grouping. Part of the [BBL Data Catalog prototypes](../README.md).

![Preview](assets/Preview1.jpg)

**Live demo:** https://bbl-dres.github.io/data-catalog/prototype-lineage/

## Features

- Split view: live JSON editor on the left, graph viewer on the right (toggle the editor pane on/off)
- Three bundled examples: E-commerce Orders, Swiss Buildings / RE-FX, Music Streaming
- Six layout presets: **Lineage** (default), **Auto**, **Horizontal**, **Vertical**, **Compact**, **Flat**
- Dagre-based layered layout, optionally in compound mode so system boxes don't overlap
- Expand tables to see columns; column-level lineage drawn across pipelines
- Click a node or column to highlight its upstream / downstream
- Reference validation in the editor — every edge and `columnMapping` endpoint must resolve

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

Any static file server works.

## Data model

Each example in `data/*.json` has a `nodes[]` / `edges[]` shape:

- **Tables** carry `id`, `label`, optional `system`, `database`, `schema`, and `columns[]`
- **Pipelines** carry `description` and `platform`
- **Dashboards** carry `platform` and `charts[]`
- **Edges** carry `source`, `target`, and optional `columnMapping[]` for column-level lineage

Grouping priority for the coloured system boxes: `system` > `database.schema` > (optional) `platform`.

## Tech notes

- [dagre](https://github.com/dagrejs/dagre) loaded via CDN for layered layout
- Vanilla JS, no build step, no npm dependencies

## License

MIT — see repo root [LICENSE](../LICENSE).
