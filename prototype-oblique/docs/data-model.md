# Data model

All data is static JSON under `data/`, loaded once at start-up. Field names follow the catalog information model described in the handbook (DCAT-AP CH / I14Y, ArchiMate and DMBOK aligned). Dates are ISO `yyyy-mm-dd`; the UI formats them as `d.m.yyyy`. Content combines fictional examples with the documented [GWR catalog metadata import](gwr-import.md); it contains no live register records.

The [Projekt Management domain](project-management.md) contains Bauprojekt, Meilenstein, Phase and Bauarbeiten, with local draft attributes and explicit mappings to the GWR and GIS project tables.

The loader checks a complete snapshot before publishing it. Entity collections must be arrays; entities need non-empty string identifiers and names. Identifiers must be unique within a kind, and object-attribute identifiers within their object. Missing optional embedded lists become empty arrays; lists supplied with invalid shapes are rejected with file/record locations. Relationship ID lists contain non-empty strings. Dangling references are reported separately and remain tolerated by the UI. These runtime guards are not a complete schema validator for every metadata field.

Domain membership is based on the stable domain identifier, including when callers pass a copied profile record. External destinations pass URL-scheme validation before becoming links. [Excel exports](excel-export.md) preserve explicit string/number types, including leading-zero codes and formula-like text, without changing their content. CSV export has been replaced.

## Files

| File | Content | Entity kind |
|---|---|---|
| `domains.json` | Domains (Domänen) | `domains` |
| `systems.json` | Source systems (Systeme) | `systems` |
| `objects.json` | Business objects with embedded attributes | `objects`, `attrs` |
| `tables.json` | Data tables with embedded fields | `tables`, `fields` |
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
| `contact` | object (optional) | Shared organisation contact: `url`, `email`, `phone` (optional strings) | `dcat:contactPoint` |
| `dataOwner`, `dataSteward` | string or actor object | Persons or organisations in the NaDB roles (see below) | `dcat:contactPoint` |
| `classification` | `öffentlich` \| `intern` \| `vertraulich` \| `geheim` | | `dct:accessRights` |
| `personalData` | boolean | Contains personal data | DSG flag |
| `source`, `sourceDetail` | string | System of record and tool | `prov:wasDerivedFrom` |
| `synced` | date | Last harvest | `prov:generatedAtTime` |

## Responsibility and contacts

The overview's **Verantwortlich** section shows `responsibleOrg`, documented owner/steward/custodian roles and the organisation's shared email and phone. `contact.url` links the organisation to its website; mail and phone links use `mailto:` and `tel:`. Empty roles are omitted, and the organisation is not repeated in Kerndaten. `responsibleOrg` stays a string so collection grouping and exports remain compatible.

Role values can be `{ "type": "person" | "organisation", "name": "…", "url": "…" }`, with optional `url`. Legacy owner/steward strings denote persons; legacy custodian strings denote organisational units. Only persons without a supplied URL use the configured federal directory; organisations without a website remain plain text. URLs and labels use the existing safe rendering helpers. No owner/steward role is inferred from an organisation's name.

Attributes inherit the object's organisation, roles and shared contact. Fields inherit their table's organisation, roles and shared contact, with explicit field metadata taking precedence. A table's custodian can still fall back to its system. Contact details are not guessed from domain membership or a similarly named organisation.

## Type-specific fields

**domains**: shared core contact metadata as above.

**systems**: `technology`, `dataCustodian`, optional `informationUrl`, `contact`. The catalogue does not actively scan systems; `modified` records the last known change.

**objects**: `domain` (domain id), `normReference`, `termdat [{ name, id, url }]`, `attributes [{ identifier, name, description, valueType, keyRole, mandatory, position }]`. `valueType` is one of `Text`, `Ganzzahl`, `Dezimal`, `Datum`, `Code`, `Geometrie`; `keyRole` is `PK`, `FK` or `null`. An attribute is addressed as `<objectId>/<attributeId>` (route `#/objects/<objectId>/attributes/<attributeId>`).

**tables**: `technicalName`, `system` (system id), optional `dataCustodian` (otherwise inherited from the system), optional `realizes` (object id), optional `domain` (fallback when no business object is mapped), `fields [{ technicalName, labels, description, dataType, keyRole, codeList? }]`. `codeList` references a code-list ID and drives the optional Werteliste column and inverse relationships. Imported fields also retain `sourceUrl` and `catalogMetadata`. The catalogue does not actively scan or certify tables; `modified` records the last known catalog change.

**fields**: Every embedded field has a non-empty `technicalName` and a `labels` language map. German (`de`) is required; French (`fr`), Italian (`it`) and English (`en`) are optional non-empty strings. Omit translations that are not available. For example:

```json
{
  "technicalName": "EGID",
  "labels": { "de": "Eidgenössischer Gebäudeidentifikator" },
  "description": "Eidgenössischer Gebäudeidentifikator: Gebäudeidentifikationsnummer im eidg. GWR.",
  "dataType": "Ganzzahl (9)",
  "keyRole": null
}
```

A field is also available as a derived profile at `#/tables/<tableId>/fields/<fieldId>`, with no additional JSON file or top-level collection. `fieldId` is the optional embedded `identifier`, falling back to the exact, case-sensitive `technicalName`. It must be unique inside its table; the same technical name may occur in different tables. Route segments are encoded separately. An explicit identifier keeps a bookmark stable when a technical column is renamed. GWR's EGID is therefore `#/tables/t-gwr-gebaeude/fields/EGID`.

The profile resolves `label` from `labels` using the selected UI language, falling back to German, and derives its display `name` as `label (technicalName)` (without repeating an identical label). Both **Technischer Name** and **Bezeichnung** appear in Kerndaten. Language changes leave technical names, stored translations and URLs unchanged. Excel's Felder sheet uses the selected label; its Metadaten sheet retains all supplied translations. The OpenAPI `Field` / `LocalizedLabel` schemas describe the same stored shape.

The Felder table and its mobile cards use the same `Alias (technical name)` display as the field profile, via `data.displayName('fields', field)`. Sorting uses this displayed name, including the selected language. The name column shares the standard 26% width used for other entity names.

The September 2026 migration converted all 248 existing fields from `name` / optional string `label` to `technicalName` / `labels`. GWR labels were copied verbatim; fictional fields use the existing business-attribute names and descriptive German labels for system columns. No foreign-language translations were invented. Existing URLs, descriptions, field order and source metadata were preserved. Both data generators write the new shape; the loader rejects missing or malformed technical names and labels before publishing a snapshot.

The profile exposes `table`, `technicalName`, `labels`, resolved `label`, `dataType`, `keyRole`, `codeList`, optional `mandatory`, source-order `position`, and imported `catalogMetadata` where available. It derives system, domain, status, stewardship and history from its parent table, without modifying the stored field or adding to catalog totals. A field's `sourceUrl` remains its own source link; it never silently becomes the parent table's entity-definition link. Access category and master-data designation appear in Kerndaten. The source-documentation section is omitted from the page; complete imported `catalogMetadata` remains in the data and Excel export. Unspecified GWR physical keys and mandatory flags are not inferred from prose.

**codelists** (`refs`): `sourceAuthority`, optional `businessObject` (object id), optional `domain` (fallback), `values [{ code, label }]`. Imported values can retain `labels`/`shortLabels` keyed by language, spreadsheet row and version provenance; German `label` remains the display value. An empty `values` array means "noch nicht erfasst".

Imported records may carry `sourceUrl`, `sourceDetail` and `provenance` with source hashes, capture date and import identifier. Unknown metadata is omitted; an absent `personalData` value is not displayed as "Nein". GWR import dates describe the catalog record rather than the live source system's lifecycle.

**products**: `domain`, `accessRights`, `license`, `format`, `accrualPeriodicity`, `basedOn [object ids]`, `sourcedFrom [table ids]`, `servedBy [api ids]`, `attributes [{ name, description, valueType }]` (optional, may be empty).

**apis**: `version`, `domain`, `system`, `protocol`, `endpointURL`, `documentation`, `accessRights`.

**changelog**: `[{ entity: "<kind>:<identifier>", date, action, detail, user }]`. Attributes show the history of their business object; fields explicitly show the history of their data table.

## Derived values

Counts are always derived from the embedded lists (attributes, fields, values) so that the KPIs, tree counts and profile pages stay consistent. Missing embedded lists are treated as empty at load time, and every cross-reference above is checked by `data.validate()`; a dangling id is reported in the browser console and rendered as the id. Relations are computed from the ids above: tables realise objects, code lists type objects, products are based on objects and sourced from tables, APIs serve products and belong to a system. The "Letzte Änderungen" list on the home page sorts all entities by `modified`.

## Handbook chapters

Handbook chapters use English IDs and matching content keys: `introduction`, `governance`, `model`, `usage`, `retrieval`, `faq`, `glossary`, and `references`. Their titles and paragraphs remain German. An optional `chapters[].legacyId` accepts older chapter URLs and resolves them to the canonical ID; it is not a renderer key. `manual.js` owns chapter rendering and alias resolution.

## Regenerating

The fictional content was ported from the Claude Design wireframe by [generate-data.py](generate-data.py), which writes `domains.json`, `systems.json`, `objects.json`, `tables.json`, `codelists.json`, `products.json`, `apis.json` and `changelog.json`:

```bash
python docs/generate-data.py data
```

`config.json`, `i18n.json`, `model.json`, `manual.json` and `swagger.json` are maintained by hand. For small content changes edit the JSON files directly; keep ids stable because they appear in URLs and cross-references.
