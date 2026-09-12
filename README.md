# Data Catalog Prototypes

![Social Preview](assets/social-preview.jpg)

[![Demo](https://img.shields.io/badge/demo-GitHub%20Pages-2ea44f?logo=github&logoColor=white)](https://bbl-dres.github.io/data-catalog/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [!CAUTION]
> These are unofficial prototypes with fictional data. Features may be incomplete, and none of the applications is intended for production use.

A collection of experimental interfaces for finding, understanding, and documenting an organisation's data assets.

## Demo

**Live app:** <https://bbl-dres.github.io/data-catalog/>

<div align="center">
  <img src="assets/prototype-oblique-overview.png" alt="Oblique data catalog overview" width="49%" align="top">
  <img src="assets/prototype-oblique-profile.png" alt="Oblique data catalog entity profile" width="49%" align="top">
</div>

The root URL opens the Oblique Data Catalog. Use the direct links below to compare every variant.

## Prototypes

| Prototype | Focus | Demo | Details |
|---|---|---|---|
| Oblique Data Catalog | Datenkatalog following the Oblique design system | [Open](https://bbl-dres.github.io/data-catalog/prototype-oblique/) | [README](prototype-oblique/README.md) |
| Business Object & Dataset Catalog | Searchable DCAT-AP CH catalog | [Open](https://bbl-dres.github.io/data-catalog/prototype-dcat/) | [README](prototype-dcat/README.md) |
| SQLite Catalog Explorer | In-browser SQLite catalog and lineage | [Open](https://bbl-dres.github.io/data-catalog/prototype-sqlite/) | [README](prototype-sqlite/README.md) |
| Architecture Layer Browser | Conceptual, logical, and physical layers | [Open](https://bbl-dres.github.io/data-catalog/prototype-layers/) | [README](prototype-layers/README.md) |
| Data Lineage Viewer | Interactive system and column lineage | [Open](https://bbl-dres.github.io/data-catalog/prototype-lineage/) | [README](prototype-lineage/README.md) |
| Mermaid Diagram Editor | ER diagrams and flowcharts with free-text names | [Open](https://bbl-dres.github.io/data-catalog/prototype-erd/) | [README](prototype-erd/README.md) |
| Architecture Canvas | Miro-style data-architecture modelling | [Open](https://bbl-dres.github.io/data-catalog/prototype-canvas/) | [README](prototype-canvas/README.md) |
| EA-IMMO | Conceptual real-estate data model | [Open](https://bbl-dres.github.io/data-catalog/prototype-datamodel/) | [README](prototype-datamodel/README.md) |

The catalog-oriented prototypes use DCAT-AP CH where relevant; other variants explore architecture, modelling, and lineage approaches.

## Run locally

From the repository root, serve every browser prototype with:

```bash
python -m http.server 8000
```

Open <http://localhost:8000>; the root redirects to `prototype-oblique/`. Append a path from the table for another prototype.

## Documentation and related components

- [Market screening](docs/MARKTSCREENING.md) — data-catalog landscape and recommendations from a Swiss federal perspective
- [Chat Worker](chat-worker/README.md) — optional Cloudflare Worker for the SQLite prototype's AI assistant
- Each prototype's implementation notes, data model, and specific setup instructions are linked in the table above.

## License

[MIT](LICENSE)
