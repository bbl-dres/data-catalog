# Oblique Data Catalog

> [!CAUTION]
> Unofficial prototype with fictional data. Not intended for production use.

Data catalog prototype for the Swiss Federal Office for Buildings and Logistics (BBL) that follows the [Oblique](https://oblique.bit.admin.ch) design system of the Swiss federal administration. Browse domains, systems, business objects, attributes, data tables, code lists, data products and APIs; every entry has a profile page with core metadata, rows, a relationship graph and a change history. In-app branding: *Datenkatalog*. Part of the [BBL Data Catalog prototypes](../README.md).

**Live demo:** https://bbl-dres.github.io/data-catalog/prototype-oblique/

## Features

- Home page with KPI cards, domain overview and latest changes
- Seven catalog sections with a navigation tree, tiles or table view, and grouping by domain, responsibility, system, source, access or status
- Profile pages ("Steckbrief") with tabs: Übersicht, Attribute / Felder / Werte, Beziehungen (pannable and zoomable orbit graph), Verlauf
- Search with grouped suggestions, keyboard navigation and a results page
- Handbook (Handbuch) with chapter navigation and scroll spy, API documentation page, help and contact popover
- CSV export and print-to-PDF from the Aktionen menu (Excel and DCAT-AP CH exports are placeholders)
- Deep-linkable hash routes: section, entity, tab, page, view mode, grouping, search query and handbook chapter are all in the URL
- Two navigation models (entity-first or container-first tree), switched in `data/config.json` or with `?nav=container`
- German UI, i18n-ready (all strings in `data/i18n.json`)
- Self-hosted Noto Sans, no external requests, no build step, no dependencies

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000/prototype-oblique/
```

Any static file server works. Opening `index.html` directly from the file system does not work because the data is loaded with `fetch()`.

## Layout

| Path | Purpose |
|---|---|
| `index.html` | Page shell (header, main, footer) |
| `css/tokens.css` | Design tokens derived from Oblique (palette, type, spacing, radius, shadows, z-index) |
| `css/main.css` | Layout and components, written against the tokens |
| `js/` | Vanilla JavaScript in six files, see [docs/architecture.md](docs/architecture.md) |
| `data/*.json` | Static catalog data and configuration, see [docs/data-model.md](docs/data-model.md) |
| `assets/` | Federal logo, icons (SVG masks), fonts, favicon |
| `docs/` | Documentation, the Claude Design wireframe and the decoded Oblique Figma library |

## Documentation

- [docs/architecture.md](docs/architecture.md): file structure, rendering model, routing, state, events, how to extend
- [docs/design-system.md](docs/design-system.md): how the tokens map to Oblique, what was taken from the Figma library, known deltas
- [docs/data-model.md](docs/data-model.md): JSON files and fields
- [docs/wireframes/](docs/wireframes/): the Claude Design mockup this app was built from

## Tech notes

Vanilla JavaScript (ES2020) organised as small modules on a `DK` namespace, CSS custom properties, JSON data files. The app re-renders the page from the URL plus a small transient state. No build step, no npm dependencies.

## License

MIT, see repo root [LICENSE](../LICENSE). Oblique styles are MIT (Swiss Confederation, FOITT). Noto Sans is licensed under the SIL Open Font License 1.1. The Swiss federal logo is protected by the Coat of Arms Protection Act and may only be used by federal bodies.
