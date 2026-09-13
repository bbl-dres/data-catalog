# Canonical alias review — 13 September 2026

The English and German alias columns in [data-model.md](../data-model.md) now drive attribute labels in the frontend, forms, print/PDF, Excel and API documentation. The review found duplicate label definitions and several shared labels that represented different concepts. The implementation keeps technical keys and catalog content stable, generates the repeated wording from the Markdown, and documents derived display fields there as well.

## Scope and evidence

Reviewed all 17 persisted entity/value dictionaries, the reusable value dictionaries, all 19 public SQL tables and 474 columns, current form definitions, profile facts, collection/child columns, grouping and print controls, handbook model labels, and the fixed Excel schemas. English and German are canonical. Existing French/Italian interface translations remain translations; the model has no Alias (FR)/(IT) columns.

The database evidence is an isolated PostgreSQL-compatible database built from every repository migration, including the new comment migration. Hosted activation is separate: no authenticated Supabase connection was available to apply migrations or inspect private deployment state. This review does not certify hosted schema alignment or close the existing deployment gaps.

## Findings and changes

| Canonical field / meaning | Before | Implemented |
|---|---|---|
| `identifier`: ID / Kennung | German labels used ID throughout. | Kennung in profiles, forms, handbook, print (including its legend) and Excel; API retains the technical `identifier` key and exposes both aliases. |
| Selected `name_*`: Name / Name | Bezeichnung in forms/handbook; Attribut, Feld, Werteliste or entity names on columns; Excel Values used Bezeichnung (DE), etc. | Name for the selected name; Name (DE)/(FR)/(IT)/(EN) for parallel stored translations. Entity/navigation names remain separate. |
| `sortOrder`: Row order / Zeilenreihenfolge | Order / Reihenfolge in forms, Excel and handbook. | Exact canonical alias; Excel order-column width accommodates it. Saved order remains an action label. |
| `responsibleOrganisation`: Responsible organisation / Verantwortliche Organisation | Responsibility / Verantwortung and Organisation differed by surface. | Canonical alias for the whole organisation, including grouping/filter controls. Its editable nested name uses Organisation name / Organisationsname. |
| `authorityOrganisation`: Source authority / Herausgebende Stelle | Code lists reused the generic organisation/responsibility label. | The code-list profile, grouping, column picker, print and Excel identify the source authority. |
| `createdOn`, `modifiedOn`, `rowVersion` | Erstellt, Geändert/Letzte Änderung and Bearbeitungsstand were inconsistent. | Erstellt am, Zuletzt geändert am and Bearbeitungsrevision. Labels can wrap without losing alignment. |
| `ValueSpecification.valueType` | Werttyp or Format; the handbook explicitly changed both business and source types to Format. | Value type / Wertetyp for business/product attributes. |
| `DataField.sourceDataType` | Format in profiles/tables and Quelldatentyp in forms. | Data type / Datentyp consistently. Product formats keep Format. |
| `DataField.keyRoles` | Schlüssel in every context. | Schlüsselrollen for physical key roles; the distinct derived business key role uses Schlüsselrolle. No key flags or comment conventions are rewritten. |
| `isRequired`, `isNullable` | Pflicht versus Pflichtfeld; inconsistent NULL capitalization. | Mandatory / Pflichtfeld and Nullable / NULL zulässig. The business required-rule shortcut is explicitly documented as a projection. |
| `serviceVersion` versus `version` | Serviceversion/API-Version labels; the SQL projection replaced the definition version with the service release, also under Version in profile metadata. | Schnittstellenversion for the release, Version for the catalog definition. A single resolver preserves legacy release context in titles while keeping stored definition versions distinct. |
| `accessNotes`, `licenseNotes` | Excel used Access / Zugang and License / Lizenz even beside the separate mode/URI columns. | Access notes / Zugangshinweise and License notes / Lizenzhinweise. Compact summary fields remain explicit projections. |
| Endpoint and value-specification fields | Endpunkt-URL, Nur lesender Zugriff, API-Beschreibungen, Formatangabe and line-entry instructions were mixed into aliases. | URL, Nur lesend, Schnittstellenbeschreibungen and Format; line-entry instructions remain accessible help beside the input. |
| Print parent/child context | Parent Name became the entity type instead of retaining its alias. | Name (entry) / Name (Eintrag) when needed to distinguish parent and child. |
| Product print component rows | Attribute value types and linked component categories shared a type column without an explicit model label. | The derived mixed column is documented as Type / Typ. Actual product attribute value types remain Wertetyp in their own tables and Excel. |
| Relationship/context export columns | Generic ID/Name headers obscured source/target roles. | Explicit source/target aliases are defined in the canonical projection table and used by Excel. |
| Backend documentation | SQL comments were frozen independently of later model edits; OpenAPI copied descriptions without dedicated aliases. | A comment-only migration synchronizes all 474 column descriptions. OpenAPI adds canonical titles, EN/DE `x-aliases` and `x-canonical-property`, including owned JSON members and CRUD quality collections. |

The dictionaries themselves already use consistent aliases for shared stored properties. No existing alias values were changed to accommodate the UI. The new [alias contract](../data-model.md#alias-contract-across-surfaces) explains selected-language suffixes, reference-name context and presentation-only fields.

## Maintaining one source of truth

- [model-contract.cjs](../../scripts/model-contract.cjs) reads dictionaries and display aliases directly from the Markdown. It fails on missing references or divergent shared field aliases that require an explicit mapping split.
- [model-alias-bindings.cjs](../../scripts/model-alias-bindings.cjs) maps properties to interface keys. It contains no English/German alias wording.
- [sync-model-aliases.cjs](../../scripts/sync-model-aliases.cjs) generates 159 EN/DE bindings in the existing translation file and the handbook's model labels. French/Italian translations and non-field interface copy remain maintained separately. There is no new browser request or runtime Markdown parser.
- [generate-openapi.cjs](../../supabase/generate-openapi.cjs) uses the executed SQL for types, nullability and constraints and the Markdown for alias metadata. Technical snake_case API properties stay unchanged. Typed reference expansions and quality junction columns point to their conceptual canonical property; aliases do not invent a replacement wire representation.
- [20260913020000_catalog_aliases.sql](../../supabase/migrations/20260913020000_catalog_aliases.sql) updates column comments only. Rows, keys, permissions, constraints and existing migrations remain intact.

From the repository root, after editing the canonical document:

```powershell
node prototype-oblique/scripts/sync-model-aliases.cjs
node prototype-oblique/supabase/generate-openapi.cjs
node prototype-oblique/scripts/sync-model-aliases.cjs --check
node prototype-oblique/tests/model-aliases.cjs
node prototype-oblique/tests/catalog-schema.cjs
node prototype-oblique/supabase/generate-openapi.cjs --check
```

If a changed stored-field alias/description requires a database comment update, prepare a **new** timestamped migration with `sync-model-aliases.cjs --migration supabase/migrations/NEW_TIMESTAMP_catalog_aliases.sql`. Replace `NEW_TIMESTAMP` with a 14-digit timestamp. The command refuses to overwrite a migration. Regenerate OpenAPI afterward and follow the [activation guide](../../supabase/README.md#canonical-aliases). Apply missing migrations in order; do not rerun the schema/import or rewrite old comments in historical migrations.

## Verification and limits

[model-aliases.cjs](../../tests/model-aliases.cjs) compares the canonical aliases with actual SQL comments, all OpenAPI table properties and nested value labels, form/column definitions, frozen print snapshots and headers read back from generated XLSX files in DE and EN. A real stored fixture gives the definition version and service release different values so the previous conflation cannot pass unnoticed. It also detects stale generated labels.

Passed the canonical alias, schema, OpenAPI, REST CRUD, editing, saved-order browser, core (47 checks), functional, detailed-print and responsive suites. The responsive suite covered 150 layouts and 8,816 profile combinations without browser/resource errors. Longer aliases wrap with matching label/value row heights.

[model-alias-browser.cjs](../../tests/model-alias-browser.cjs) also passed with the SQL fixture in DE and EN at 320, 390 and 1280 px, including actual PDF and XLSX downloads. Inspected rendered Excel headers, mobile profiles and PDF pages for readable aliases. The PDF checker verified both three-page files for source/preview fidelity, text bounds, embedded fonts and manifest hashes. Generated files are current and documentation links resolve. These checks use local fixtures; they do not verify hosted email delivery or authenticated Supabase deployment.

This is an alias/presentation review, not a full implementation of every field in the model. Existing coverage gaps for editing relationships, lineage, general quality rules, full geometric specifications and structured property sets remain in the [canonical coverage matrix](../data-model.md#documented-deployed-visible-and-editable). Business value-type projection still contains documented simplifications. This work does not translate catalog records, infer missing metadata, change publication policy or implement new model features.
