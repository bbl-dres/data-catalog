# Data model

| Location | Purpose |
|---|---|
| `data/concepts.json` | Business object definitions (multilingual titles, descriptions, tags, meta, standards, attributes) |
| `data/datasets.json` | Dataset definitions — extends the concept shape with `distributions` and `publications` |
| `data/i18n.json` | UI label translations (tag / enum / UI keys) |
| `content/about-{de,fr,it,en}.html` | About page content |
| `content/manual-{de,fr,it,en}.html` | User manual |
| `assets/concepts/`, `assets/datasets/` | Per-entity preview images |


Field-level schemas for concepts and datasets, the i18n conventions and the development workflow are documented in the repository-level [CLAUDE.md](../../CLAUDE.md).
