# Data model

All data is static JSON under `data/`, loaded once at start-up. Field names follow the catalog information model described in the handbook (DCAT-AP CH / I14Y, ArchiMate and DMBOK aligned). Dates are ISO `yyyy-mm-dd`; the UI formats them as `d.m.yyyy`. Content is fictional.

The loader checks a complete snapshot before publishing it. Entity collections must be arrays; entities need non-empty string identifiers and names. Identifiers must be unique within a kind, and object-attribute identifiers within their object. Missing optional embedded lists become empty arrays; lists supplied with invalid shapes are rejected with file/record locations. Relationship ID lists contain non-empty strings. Dangling references are reported separately and remain tolerated by the UI. These runtime guards are not a complete schema validator for every metadata field.

Domain membership is based on the stable domain identifier, including when callers pass a copied profile record. External destinations pass URL-scheme validation before becoming links. CSV exports protect formula-like text by prefixing an apostrophe; see the [developer review](developer-review-2026-09-05.md) for format implications and validation coverage.

## Files

| File | Content | Entity kind |
|---|---|---|
| `domains.json` | Domains (Domänen) | `domains` |
| `systems.json` | Source systems (Systeme) | `systems` |
| `objects.json` | Business objects with embedded attributes | `objects`, `attrs` |
| `tables.json` | Data tables with embedded fields | `tables` |
| `codelists.json` | Reference data (Wertelisten) with embedded values | `refs` |
| `products.json` | Data products (dcat:Dataset) | `products` |
| `apis.json` | API directory (dcat:DataService) | `apis` |
| `changelog.json` | Change history per entity | – |
| `model.json` | Information model: kind labels, collection descriptions and icons, navigation models, core fields, type-specific fields, statuses, canonical orders | – |
| `config.json` | App configuration, help and footer content | – |
| `i18n.json` | UI strings, one entry per key with `de`, `fr`, `it`, `en` (German is the reference; other languages are drafts until validated) | – |
| `manual.json` | Handbook chapters | – |
| `swagger.json` | OpenAPI 3.1 contract rendered by Swagger UI | – |

## Core fields (every entity)

| Field | Type | Meaning | DCAT-AP CH |
|---|---|---|---|
| `identifier` | string | Stable id, used in URLs | `dct:identifier` |
| `name` | string | Display name | `dct:title` |
| `description` | string | Definition | `dct:description` |
| `status` | `Gültig` \| `Entwurf` \| `Zurückgezogen` | Lifecycle status | `adms:status` |
| `version` | string | | `owl:versionInfo` |
| `created`, `modified` | date | | `dct:issued`, `dct:modified` |
| `responsibleOrg` | string | Responsible organisational unit | `dct:publisher` |
| `dataOwner`, `dataSteward` | string | Persons in the NaDB roles | `dcat:contactPoint` |
| `classification` | `öffentlich` \| `intern` \| `vertraulich` \| `geheim` | | `dct:accessRights` |
| `personalData` | boolean | Contains personal data | DSG flag |
| `source`, `sourceDetail` | string | System of record and tool | `prov:wasDerivedFrom` |
| `synced` | date | Last harvest | `prov:generatedAtTime` |

## Type-specific fields

**domains**: `contact { email, phone }`.

**systems**: `technology`, `dataCustodian`, optional `informationUrl`, `contact`. The catalogue does not actively scan systems; `modified` records the last known change.

**objects**: `domain` (domain id), `normReference`, `termdat [{ name, id, url }]`, `attributes [{ identifier, name, description, valueType, keyRole, mandatory, position }]`. `valueType` is one of `Text`, `Ganzzahl`, `Dezimal`, `Datum`, `Code`, `Geometrie`; `keyRole` is `PK`, `FK` or `null`. An attribute is addressed as `<objectId>/<attributeId>` (route `#/objects/<objectId>/attributes/<attributeId>`).

**tables**: `technicalName`, `system` (system id), optional `dataCustodian` (otherwise inherited from the system), `realizes` (object id), `fields [{ name, description, dataType, keyRole }]`. The catalogue does not actively scan or certify tables; `modified` records the last known change.

**codelists** (`refs`): `sourceAuthority`, `businessObject` (object id), `values [{ code, label }]`. An empty `values` array means "noch nicht erfasst".

**products**: `domain`, `accessRights`, `license`, `format`, `accrualPeriodicity`, `basedOn [object ids]`, `sourcedFrom [table ids]`, `servedBy [api ids]`, `attributes [{ name, description, valueType }]` (optional, may be empty).

**apis**: `version`, `domain`, `system`, `protocol`, `endpointURL`, `documentation`, `accessRights`.

**changelog**: `[{ entity: "<kind>:<identifier>", date, action, detail, user }]`. Attributes show the history of their business object.

## Derived values

Counts are always derived from the embedded lists (attributes, fields, values) so that the KPIs, tree counts and profile pages stay consistent. Missing embedded lists are treated as empty at load time, and every cross-reference above is checked by `data.validate()`; a dangling id is reported in the browser console and rendered as the id. Relations are computed from the ids above: tables realise objects, code lists type objects, products are based on objects and sourced from tables, APIs serve products and belong to a system. The "Letzte Änderungen" list on the home page sorts all entities by `modified`.

## Regenerating

The fictional content was ported from the Claude Design wireframe by [generate-data.py](generate-data.py), which writes `domains.json`, `systems.json`, `objects.json`, `tables.json`, `codelists.json`, `products.json`, `apis.json` and `changelog.json`:

```bash
python docs/generate-data.py data
```

`config.json`, `i18n.json`, `model.json`, `manual.json` and `swagger.json` are maintained by hand. For small content changes edit the JSON files directly; keep ids stable because they appear in URLs and cross-references.
