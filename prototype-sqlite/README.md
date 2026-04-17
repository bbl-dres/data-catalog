# SQLite Catalog Explorer

Data catalog backed by a SQLite file that runs entirely in the browser. Sidebar navigation, full-text search, detail views for every entity, and interactive lineage graphs. In-app branding: *BBL Datenkatalog*. Part of the [BBL Data Catalog prototypes](../README.md).

<p>
  <img src="assets/Preview1.jpg" width="45%" />
  <img src="assets/Preview2.jpg" width="45%" />
</p>

**Live demo:** https://bbl-dres.github.io/data-catalog/prototype-sqlite/

## Features

- SQLite catalog loaded client-side via sql.js (WASM)
- Keyboard search (Ctrl+K)
- Sidebar navigation across systems, tables, and columns
- Detail pages for every catalog entity
- Interactive lineage graphs
- German UI

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

Any static file server works.

## Tech notes

- [sql.js](https://github.com/sql-js/sql.js) for in-browser SQLite (loaded via CDN)
- [Lucide](https://lucide.dev/) icons via CDN
- Catalog data lives in `data/` as a SQLite file and supporting JSON

## License

MIT — see repo root [LICENSE](../LICENSE).
