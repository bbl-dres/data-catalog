# Business Object & Dataset Catalog

Main data catalog prototype — browse business objects and datasets with search, filters, grid/list views, and detail pages. Follows the Swiss [DCAT-AP CH v3.0](https://www.dcat-ap.ch/) standard. In-app branding: *Datenkatalog IMMO*. Part of the [BBL Data Catalog prototypes](../README.md).

![Preview](assets/Preview1.jpg)

**Live demo:** https://bbl-dres.github.io/data-catalog/prototype-main/

(The root URL https://bbl-dres.github.io/data-catalog/ redirects here.)

## Features

- Browse business object concepts and datasets with full metadata
- Full-text search across titles, descriptions, and tags
- Filter by tags, source system, classification, and personal-data status
- Grid and list view modes
- Print and share-link support
- Mobile-responsive design
- Multilingual UI and content: DE / EN / FR / IT
- Hash-based client-side routing; filter state stored in the URL

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000/prototype-main/
```

Any static file server works.

## Data model

| Location | Purpose |
|---|---|
| `data/concepts.json` | Business object definitions (multilingual titles, descriptions, tags, meta, standards, attributes) |
| `data/datasets.json` | Dataset definitions — extends the concept shape with `distributions` and `publications` |
| `data/i18n.json` | UI label translations (tag / enum / UI keys) |
| `content/about-{de,fr,it,en}.html` | About page content |
| `content/manual-{de,fr,it,en}.html` | User manual |
| `assets/concepts/`, `assets/datasets/` | Per-entity preview images |

## Tech notes

Vanilla JavaScript wrapped in an IIFE, CSS custom properties, JSON data files. No build step, no npm dependencies.

## License

MIT — see repo root [LICENSE](../LICENSE).
