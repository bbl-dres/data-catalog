# Architecture Layer Browser

Metadata catalog prototype for navigating enterprise data assets across a three-layer architecture model (Conceptual → Logical → Physical). In-app branding: *Meta-Atlas*. Part of the [BBL Data Catalog prototypes](../README.md).

<p>
  <img src="assets/preview1.jpg" width="45%" />
  <img src="assets/preview2.jpg" width="45%" />
</p>

**Live demo:** https://bbl-dres.github.io/data-catalog/prototype-dmbok/

## Features

- Hierarchical tree navigation with layer switching (Conceptual / Logical / Physical)
- Full-text search across all entities
- Wiki-style detail pages
- Cross-layer traceability
- Multilingual: DE / EN / FR / IT (stored in URL + `localStorage`)
- Dark and light themes
- Responsive design

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

Any static file server works.

## Tech notes

Vanilla JavaScript (ES6+), CSS custom properties, JSON data files. No build step, no npm dependencies.

## License

MIT — see repo root [LICENSE](../LICENSE).
