# Data files

Catalog metadata is now read from Supabase. This folder contains both deprecated catalog snapshots and active application files. Its name remains `data` because application configuration and the API reference still use it.

## Deprecated catalog JSON

These files are frozen migration inputs and regression-test fixtures:

- [apis.json](apis.json)
- [changelog.json](changelog.json)
- [codelists.json](codelists.json)
- [domains.json](domains.json)
- [objects.json](objects.json)
- [products.json](products.json)
- [systems.json](systems.json)
- [tables.json](tables.json)

The application does not load them in Supabase mode. Editing them does not update the live catalog. Keep them for source evidence, reproducible migration and explicit offline tests; their hashes are recorded in the [import manifest](../supabase/import-manifest.json).

Legacy source import scripts still target these files. They are not live database writers. Make subsequent catalog changes through reviewed database migrations rather than regenerating the initial import.

## Active application files

These files are **not deprecated**:

| File | Purpose |
|---|---|
| [config.json](config.json) | Application settings, branding and navigation options. |
| [i18n.json](i18n.json) | UI translations for German, French, Italian and English. |
| [manual.json](manual.json) | Handbook content and navigation. |
| [model.json](model.json) | UI entity definitions and presentation configuration. |
| [swagger.json](swagger.json) | Generated OpenAPI contract for the real Supabase catalog reads, rendered at `#/api`. Regenerate from SQL using the [API guide](../docs/api.md). |

Keep these files at their current paths so application startup and Swagger continue to work.

See the [Supabase guide](../supabase/README.md) for migration and access details, and [catalog-config.js](../js/catalog-config.js) for the active data provider.
