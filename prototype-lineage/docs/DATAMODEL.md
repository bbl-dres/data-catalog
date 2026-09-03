# Data model

Each example in `data/*.json` has a `nodes[]` / `edges[]` shape:

- **Tables** carry `id`, `label`, optional `system`, `database`, `schema`, and `columns[]`
- **Pipelines** carry `description` and `platform`
- **Dashboards** carry `platform` and `charts[]`
- **Edges** carry `source`, `target`, and optional `columnMapping[]` for column-level lineage

Grouping priority for the coloured system boxes: `system` > `database.schema` > (optional) `platform`.

