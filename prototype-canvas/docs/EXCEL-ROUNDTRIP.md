# Excel round-trip

Seven-sheet workbook. Sheet names mirror the DB node kinds in [DATAMODEL.sql](DATAMODEL.sql):

| Sheet | Description |
|-------|-------------|
| `system`           | Aggregated stats per source system |
| `distribution`     | Nodes of kind `distribution` (type ∈ `table` / `view` / `api` / `file`) |
| `code_list`        | Nodes of kind `code_list` (type = `codelist`) |
| `pset`             | Property-set / Datenpaket registry (kind `pset`) |
| `attribute`        | Every column across all nodes (kind `attribute`); `set_id` references `pset.id` |
| `source_structure` | Per-node SAP BAPI substructure registry (auxiliary) |
| `edge`             | Relations between nodes with optional label |

Import accepts the pre-rename sheet names (`Tables`, `APIs`, `Files`, `ValueLists`, `PropertySets`, `Attributes`, `SourceStructures`, `Relations`, `Systems`) so older exports still load; the workbook is re-emitted with the current names on the next export.

**Import** replaces the canvas after a confirmation prompt. **Export ▾** offers Excel, JSON, and (planned) PDF.

