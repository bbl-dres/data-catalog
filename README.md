# Data Catalog Prototypes

![Social Preview](assets/Social1.jpg)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/badge/demo-live-brightgreen)](https://bbl-dres.github.io/data-catalog/)
[![Standard: DCAT-AP CH](https://img.shields.io/badge/standard-DCAT--AP%20CH%20v3.0-blue)](https://www.dcat-ap.ch/)

> [!CAUTION]
> **This is a collection of unofficial prototypes for demonstration purposes only.**
> All data is fictional. Not all features are fully functional. This project serves as a visual and conceptual prototype - it is not intended for production use.

## What is this?

A set of **experimental web prototypes** exploring different ways to browse, search, and document the data assets of a large organisation - here, the Swiss Federal Office for Buildings and Logistics (BBL).

Each prototype tackles the same underlying question - *"how should people inside my organisation find out what data exists, what it means, and where it lives?"* - but from a different angle: a polished DCAT-AP catalog, an architecture-layer browser, a SQL-backed explorer, a lineage graph, a diagram editor, and a Miro-style architecture canvas.

All here presented applications are unofficial mockups. They are **not** production systems - they're meant to compare ideas and spark discussion. Where relevant, metadata follows the Swiss [DCAT-AP CH v3.0](https://www.dcat-ap.ch/) standard (the Swiss profile of the EU catalog vocabulary), or best practice frameworks like TOGAG, or DAMA-DMBOK.


## Prototypes

You don't need to install anything - every prototype is deployed on GitHub Pages.

### Business Object & Dataset Catalog

Main catalog. Browse business objects and datasets with search, filters, grid/list views, and detail pages. Follows the DCAT-AP CH v3.0 standard. Multilingual: DE / EN / FR / IT.

- Link: https://bbl-dres.github.io/data-catalog/prototype-main/

![Preview](prototype-main/assets/Preview1.jpg)

---

### SQLite Catalog Explorer

Data catalog backed by a SQLite file that runs entirely in the browser via sql.js. Sidebar navigation, full-text search, detail views for every entity, and interactive lineage graphs.

- Link: https://bbl-dres.github.io/data-catalog/prototype-sqlite/

<p>
  <img src="prototype-sqlite/assets/Preview1.jpg" width="45%" />
  <img src="prototype-sqlite/assets/Preview2.jpg" width="45%" />
</p>

---

### Architecture Layer Browser

Hierarchical metadata browser following a three-layer architecture model (Conceptual → Logical → Physical), with wiki-style documentation and cross-layer traceability. Multilingual (DE / EN / FR / IT), dark and light theme.

- Link: https://bbl-dres.github.io/data-catalog/prototype-layers/

<p>
  <img src="prototype-layers/assets/preview1.jpg" width="45%" />
  <img src="prototype-layers/assets/preview2.jpg" width="45%" />
</p>

---

### Data Lineage Viewer

Interactive graph for exploring data lineage across systems. Live JSON editor on the left, viewer with pan / zoom / fit / expand on the right. Six layout presets, column-level mappings, system-based grouping - vanilla JS, no framework.

- Link: https://bbl-dres.github.io/data-catalog/prototype-lineage/

![Preview](prototype-lineage/assets/Preview1.jpg)

---

### Mermaid Diagram Editor

Single-page editor for ER diagrams and flowcharts that accepts free-text names (spaces, umlauts, special characters). Built on Mermaid.js.

- Link: https://bbl-dres.github.io/data-catalog/prototype-mermaid/

<p>
  <img src="prototype-mermaid/assets/Preview1.jpg" width="45%" />
</p>

---

### Architecture Canvas

Miro-style canvas for sketching data architecture. Drag-and-drop entity palette, draggable nodes with collapsible **property sets** (groups of attributes), inline-editable column rows with PK/FK/UK key cycling, drag-handle reorder, system-grouping frames, and a draft-mode editor with explicit Save / Cancel. Click a node or table row to open a right-side info panel showing metadata, sets, attribute counts, and relations. Three views over the same state - Diagram, Tabelle (entity-typed tabs), and a mock Catalog Management API. Excel round-trip across four sheets. Hash-based URLs for shareable links.

- Link: https://bbl-dres.github.io/data-catalog/prototype-canvas/

<p>
  <img src="prototype-layers/data-catalog/assets/preview1.jpg" width="45%" />
  <img src="prototype-layers/data-catalog/assets/preview2.jpg" width="45%" />
</p>

## Run locally

All prototypes are plain HTML/CSS/JS with **zero build step and zero npm dependencies**. Any static file server will do:

```bash
git clone https://github.com/bbl-dres/data-catalog.git
cd data-catalog

# then either:
python3 -m http.server 8000
# or:
npx http-server
```

Open <http://localhost:8000> - the root page redirects to the main catalog. Append `/prototype-layers/`, `/prototype-sqlite/`, `/prototype-lineage/`, `/prototype-mermaid/`, or `/prototype-canvas/` for the others.

## Repository layout

```
data-catalog/
├── index.html              # Redirect to prototype-main/
├── prototype-main/         # Business Object & Dataset Catalog (Datenkatalog IMMO)
├── prototype-layers/       # Architecture Layer Browser (Meta-Atlas)
├── prototype-sqlite/       # SQLite Catalog Explorer
├── prototype-lineage/      # Data Lineage Viewer
├── prototype-mermaid/      # Mermaid Diagram Editor (Simple Chart)
├── prototype-canvas/       # Architecture Canvas (Miro-style, BBL chrome)
├── assets/                 # Shared repo assets (social preview)
└── docs-concepts/          # Shared concept docs
```

## License

Licensed under the [MIT License](https://opensource.org/licenses/MIT).

---

*Unofficial mockup - not affiliated with or endorsed by BBL.*
