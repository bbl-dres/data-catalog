# SAP RE-FX source reconciliation — 2026-09-05

The Innovator PNG is readable at its original 4000 × 7320 resolution. Its **17 application classes and 508 scalar attributes** are retained as source evidence. Following the catalog owner's review, **seven curated entries with 142 fields** are published: 46 type/model fields, 66 documented building API fields and 30 SAP DataSource fields for Wirtschaftseinheit, Mietobjekt and Vertrag. The diagram mixes conceptual and implementation models and must not determine which SAP entities exist.

The building SOAP API retains its documented endpoint and 25 response structures. Its **75 candidate model-field matches**, including three ambiguous matches, belong to the removed building Nutzungssicht class. They remain in the reconciliation report, with **zero active catalog mappings**. They are not verified physical SAP column mappings or approved requirements.

## Catalog correction

The owner explicitly requested removal of **every Nutzungssicht entry**, rather than merely changing its display name. All 11 usage classes are excluded, along with Areal. This also removes Infrastrukturgefäss and Buchungskreis from the SAP RE-FX table list. Ebene and Raum are consolidated as types of **Architektonisches Objekt**.

| Remaining imported entry | Source fields | Treatment |
|---|---:|---|
| Grundstück | 19 | Model fields retained for subsequent review; technical table ID unknown |
| Gebäude (VIBDBU) | 66 | Replaces Gebäude_AS with the documented BUILDING API projection |
| Wirtschaftseinheit (VIBDBE) | 9 | Independently sourced from SAP DataSource 0BUSENTITY_ATTR |
| Mietobjekt (VIBDRO) | 12 | Independently sourced from SAP DataSource 0RENTOBJECT_ATTR |
| Vertrag (VICNCN) | 9 | Independently sourced from SAP DataSource 0RECONTRACT_ATTR |
| Fläche | 3 | Retained for subsequent review |
| Architektonisches Objekt (VIBDAO) | 24 | One field from Ebene, 23 from Raum; each retains explicit type applicability |

The separate pre-existing Bemessungen sample retains its fields and now has a SAP definition and a review comment, so SAP RE-FX currently contains eight entries. Remaining diagram entries are drafts, not certified physical schemas. The consolidated entry uses `objectTypes` and field-level `appliesToObjectTypes`; field descriptions also identify the source type. This inventory does not claim that all 24 fields apply to every architectural object. Unknown table IDs are omitted instead of displaying diagram class names as technical IDs.

The [focused catalog review](sap-refx-catalog-scope.md) documents the new Mietobjekt and Vertrag inventories, recommended scope, validity/history distinctions and unresolved Fläche/AOID geometry semantics. Business-object definitions remain unchanged.

## Technical identities and SAP documentation

### Wirtschaftseinheit

The owner subsequently requested Wirtschaftseinheit using [SAP's DataSource documentation](https://help.sap.com/docs/SAP_ERP_SPV/d91b9ba4593d4466bfc484ac34ab743d/4419895360b93d58e10000000a174cb4.html?locale=de-DE), reviewed in a browser on 2026-09-05. It identifies **0BUSENTITY_ATTR** as the extraction DataSource and **VIBDBE** as the source table for all nine listed fields. The new entry `t-sap-business-entity` links to the existing Geschäftsobjekt `wirtschaftseinheit` in `finanzen`. The original `Wirtschaftseinheit_NS` / `t-we` remains excluded.

The reviewed inventory is stored in [sap-refx-data-sources.json](../sources/sap-refx/sap-refx-data-sources.json), including exact German field labels, extraction IDs, source-table assignments and the source URL. `fieldScope: "datasource-projection"` and `technicalNameKind: "datasource-field"` distinguish that inventory from a complete physical schema. The page has no separate physical-column mapping column and provides no types, mandatory flags or primary keys; none are inferred. The source label for SLAGEWE is retained verbatim. No connection to the building-only SOAP API is asserted.

BUKRS is a field in the documented inventory; it does not recreate Buchungskreis as a standalone RE-FX table. The SAP Help input is imported reproducibly after the diagram exclusions, and its hash and content are included in `catalogCuration.dataSources`. The entry remains Entwurf under the catalog's review policy.

### Gebäude and architectural objects

The catalog owner approved replacing Gebäude_AS with **Gebäude (VIBDBU)**. The saved page mentions VIBDBU, and [SAP's building migration documentation](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/d3a3eb7caa1842858bf0372e17ad3909/b14687d42cee443eb6a664e3e1526fd4.html) explicitly identifies that source table. The new catalog entry is `t-sap-building`; the diagram fields remain in the source report.

The API supplies 66 exact IDs in `BUILDING`, such as `BUILDING_TEXT` and `CONSTRUCTION_YEAR`. Each is displayed with its German alias and marked `technicalNameKind: "api-field"`. Their mappings are documented API correspondences, not verified physical column mappings. The table declares `fieldScope: "api-projection"`. Unreliable type declarations are omitted, EGID is not invented, and the other 24 API structures remain separate endpoint metadata. All 377 endpoint field IDs are retained in the report.

Both owner-supplied SAP pages were accessible through a browser on 2026-09-05; the lightweight web reader could not render them. [Data Sources im Flexiblen Immobilienmanagement](https://help.sap.com/docs/SAP_ERP_SPV/d91b9ba4593d4466bfc484ac34ab743d/e9465e52a9a0617fe10000000a44538d.html?locale=de-DE) indexes BW extraction definitions. [Architektonisches Objekt](https://help.sap.com/docs/SAP_ERP_SPV/d91b9ba4593d4466bfc484ac34ab743d/2725228b197441c5a092e6ba12c0b931.html?locale=de-DE) identifies DataSource `0ARCHOBJECT_ATTR` and explicitly separates VIBDAO source columns, ADRC address columns and extractor-calculated values. It confirms the VIBDAO table ID; it does not automatically validate mappings from the diagram's field aliases.

[sap-refx-catalog-curation.json](../sources/sap-refx/sap-refx-catalog-curation.json) records these decisions separately from the original transcription. The importer applies them after source reconciliation, so rerunning it cannot restore the excluded classes. Product links and history for retired table IDs are removed from active data and archived in `catalogCuration.retiredReferences`. They are not remapped to superficially similar entries.

Business objects lead future requirements: business definition and purpose → required attributes and rules → system mapping → API coverage. Source/API differences, including missing EGID, are supporting evidence for that next review and do not automatically establish change requirements. Business-object definitions have not been changed by this cleanup.

The reduced model and API documentation are different views of the data. The diagram contains architectural classes, usage classes and portfolio/contract information; the supplied endpoint reads one building and returns 25 service structures. Keeping these distinctions avoids treating every response structure as a database table or assuming every modeled field is exposed by this endpoint.

## Sources and artifacts

| Source | Content |
|---|---|
| `SAP RE-FX.png` | Innovator application diagram. Inspected in native-resolution crops; German OCR was used as a transcription aid and checked visually. Source names, abbreviations and numeric suffixes are retained. |
| `Building Master Data - Get Detail - SAP API Dokumentation Bund - Confluence.htm` | Saved Confluence page 1105159761, version 7. API `ZAPI_X4AI_BAPI_RE_BU_GET_DET`, version 1.0.0, reported modification 2024-05-14, status ACTIVE. |
| Its adjacent `_files` directory | Page assets and generic schema loaders. Neither `ApiSchema.yaml` nor the WSDL was saved. |
| `EFD-BBL Modelle (MMB) - SAP RE-FX.xlsx` | Earlier unusable export: one diagram metadata record, no classes/attributes or embedded model. Superseded by the PNG for this import. |

Maintained inputs:

- [sap-refx-model.json](../sources/sap-refx/sap-refx-model.json): reviewed class/attribute transcription, original-image bounds, associations, model types and retained field IDs.
- [sap-refx-field-matches.json](../sources/sap-refx/sap-refx-field-matches.json): explicit candidate API targets and the matching rationale/limitations.
- [sap-refx-catalog-curation.json](../sources/sap-refx/sap-refx-catalog-curation.json): owner-approved exclusions and object-type consolidation.
- [sap-refx-data-sources.json](../sources/sap-refx/sap-refx-data-sources.json): reviewed SAP Help extraction inventories, independently sourced from the excluded diagram classes.
- [sap-refx-definitions.json](../sources/sap-refx/sap-refx-definitions.json): reviewed definition excerpts/summaries, source URLs and release. These are independent of field provenance and catalog comments.
- [import-sap-refx.py](../../scripts/import-sap-refx.py): validates source hashes and references, then upserts the owned catalog records.

[sap-refx-import-report.json](../sources/sap-refx/sap-refx-import-report.json) is generated. It contains source hashes, all **377 API field rows**, their reported types/lengths, the model transcription, candidates, unmatched fields and retired prototype identifiers. Seven `.INCLUDE` rows are preserved separately as structure markers, not scalar fields. Source navigation, user accounts, scripts and business-record examples are excluded.

## Original source classes (before catalog correction)

| Class | View | Scalar fields | Catalog table ID |
|---|---|---:|---|
| Buchungskreis | Usage | 0 | `t-sap-company-code` |
| Areal | Architecture | 15 | `t-sap-site` |
| Wirtschaftseinheit_NS | Usage | 31 | `t-we` |
| Infrastrukturgefäss | Usage | 0 | `t-sap-infrastructure-container` |
| Grundstück_AS | Architecture | 19 | `t-sap-land-architecture` |
| Grundstück_NS | Usage | 69 | `t-sap-land-usage` |
| Gebäude_AS | Architecture | 40 | `t-sap-building-architecture` |
| Gebäude_NS | Usage | 150 | `t-geb-sap` |
| PFM-Strategie | Usage | 23 | `t-sap-portfolio-strategy` |
| Ebene | Architecture | 1 | `t-sap-level` |
| Raum | Architecture | 23 | `t-sap-room` |
| Flächenpool | Usage | 0 | `t-sap-area-pool` |
| Mietfläche | Usage | 0 | `t-sap-rental-area` |
| Fläche | Architecture | 3 | `t-sap-area` |
| Mieteinheit | Usage | 0 | `t-sap-rental-unit` |
| Mietobjekt | Usage | 0 | `t-mo` |
| Mietvertrag | Usage | 134 | `t-mv` |

AS and NS are distinct labels in the source transcription. The table above is a source inventory, not the current table list. Initial domain/object assignments were catalog curation; the later correction supersedes publication of usage classes, Areal, Ebene and Raum as independent entities. The source does not provide catalog domain IDs or physical implementation links.

Six classes show no scalar attributes. Their empty field lists mean **not shown in this diagram**, not that a real SAP object has no fields. UML association ends are stored in `modelAssociations`, separately from scalar fields. Undrawn targets such as Bedarf, Plan_K, Plan_PV and Miet_Nutzungsvertrag remain source strings rather than invented catalog entries. Italic class titles are recorded as `modelAbstract`.

PFM-Strategie content also appears in Gebäude_NS with some shorter labels. Both lists are retained because the evidence does not authorize merging them. Numeric suffixes such as `_1702` and `_1769`, and spelling such as `Typ ach. Objekt`, remain unchanged. The enum type `GE Eigentumart` and two `ID_Type` declarations are model types; their physical representations are unknown.

## Initial import history (superseded where noted above)

The initial import retained four existing IDs (`t-we`, `t-geb-sap`, `t-mo`, `t-mv`) and added thirteen classes. All four IDs are now retired with the usage classes. Other systems, including GWR, and the separate fictional Bemessungen example are unchanged.

`technicalName` holds the exact model class/attribute name on these records, with `technicalNameKind: "model-class"` or `"model-attribute"`. It is **not** asserted to be a physical SAP name. Fields have the required German `labels.de`; no translations are invented. Types, lengths, mandatory flags and PK/FK constraints are unspecified unless a model type is explicitly visible. Diagram key symbols do not establish database constraints.

The initial import preserved selected field bookmarks and recorded unsupported sample fields in `prototypeReplacement`. Bookmarks under the subsequently excluded tables are now retired too. They are not redirected to unrelated attributes. The report retains the initial replacement audit.

Imported records remain **Entwurf**. Named sample owners/stewards, synthetic source-system versions and undocumented personal-data flags are not carried into model metadata. BBL is recorded as the responsible organization; no person-specific role is inferred. Capture dates describe catalog import, not the underlying SAP object's lifecycle.

## Archived building API correspondence

Matching is limited to Gebäude_NS. A building-only endpoint does not establish API coverage of contract, land or architectural classes merely because their labels look similar.

| Measure | Count |
|---|---:|
| Gebäude_NS attributes | 150 |
| Attributes with a candidate | 75 |
| Single-candidate attributes | 72 |
| Attributes with alternatives | 3 |
| Building attributes without a candidate | 75 |
| Distinct API fields referenced by candidates | 77 |
| API fields without a model candidate | 300 |
| All model attributes without a candidate in this endpoint | 433 |
| Verified physical table/column mappings | 0 |

The 433 comprise 75 unmatched building attributes plus 358 attributes in other classes. “Unmatched” does not mean unused, unavailable in SAP, or absent from every other API.

| Model attribute | API structure/field | Note |
|---|---|---|
| Buchungskreis | `BUILDING.COMP_CODE` | Semantic match; reported BUILDING types are unreliable. |
| Bezeichnung des GE | `BUILDING.BUILDING_TEXT` | API description copied; erroneous NUMC type not imported. |
| Strasse | `OBJECT_ADDRESS.STREET_LNG` | Address is a separate response structure. |
| Verfügbare Bemessungsgrösse | `MEASUREMENT.VALUE_AVAIL` | Measurement context. |
| Geschäftspartnerrolle | `PARTNER.ROLE_TYPE` | Partner assignment, not a Person table. |
| Profitcenter | `TERM_ORG_ASSIGNMENT.PROFIT_CTR` | Organizational assignment. |
| Mietermodell | `CUS_DATA_0MM.MIMOD` | Customer extension. |
| Asbest letzte Massnahme | `CUS_DATA_0BU.SAF03` | Customer extension. |
| Umbaujahr | `BUILDING.MODERNIZATION_YEAR` or `RECONSTRUCTION_YEAR` | Unresolved alternatives. |
| Gültig ab / bis | `OBJECT_VALID_FROM/TO` or `REAL_VALID_FROM/TO` | Model does not distinguish effective/object validity sufficiently. |

Candidates are retained in `reconciliation.candidates` in the report and summarized in the API's `sourceReconciliation`. The live API's `modelMappings` is empty following removal of Gebäude_NS. The original import copied descriptions only for single-candidate fields; ambiguous fields received no arbitrarily selected description. API types were never copied into model fields.

EGID and EDID occur in Gebäude_NS but nowhere in the supplied API inventory. They are not mapped to BUILDING or BUILDING_ID. `System- und Anwenderstatus` combines concepts and has no single-field match. Generic notes, repeated dates and unnamed portfolio extensions are not matched by guesswork. Two architectural-object identifiers share the same API candidate; this possible many-to-one correspondence remains flagged in the matching notes.

## Documentation conflicts

| Finding | Evidence and treatment |
|---|---|
| BUILDING types appear shifted | CREATION_USER is reported as DATS(8), CREATION_DATE as TIMS(6), BUILDING_TEXT as NUMC(2); FUNCTION has no type/length. Raw values remain in the report only. |
| PROP_TAX contains copied/missing definitions | Descriptions repeat options-rate fields; two fields have no descriptions/types. No model mappings use this structure. |
| Request/response examples disagree with field tables | BUILDING_ID versus COMP_CODE/BUSINESS_ENTITY/BUILDING; example properties do not match the BUILDING inventory. Request parameters remain unverified. |
| Protocol and endpoint paths differ | SOAP prose describes an RFC/SOAP path; rendered OpenAPI servers use `/sap/opu/odata/sap/` and `/BuildingGetDetail`. The documented production URL is retained with `endpointVerification: "unverified"`. No live call was made. |
| Access descriptions disagree | Natural-person access versus technical user; authorization objects say `offen`. No eIAM/OAuth integration or detailed roles are inferred. |
| Operational prose is inconsistent | Read-only service labelled NotIdempotence; unrelated Sell-from-Stock restrictions; building response called a business entity. These passages remain flagged. |
| Physical schema/contract unavailable | PNG contains model names; WSDL and generated YAML are absent. Physical names, precision, required flags and deployment binding still need confirmation. |

The SOAP service is `api-sap-building`. `sourceStatus: "ACTIVE"` is separate from the catalog's Entwurf review status. The broader fictional REST example `api-immo` was subsequently removed. Existing rental and area products do not establish use of this building-only operation.

## Reproduction and checks

```powershell
python prototype-oblique/scripts/import-sap-refx.py `
  --api-page 'C:\Users\david\Downloads\Building Master Data - Get Detail - SAP API Dokumentation Bund - Confluence.htm' `
  --model 'C:\Users\david\Downloads\SAP RE-FX.png' `
  --captured 2026-09-05
```

The importer uses the reviewed JSON transcription; it does not rerun OCR. A changed PNG hash requires review. It validates classes, attribute uniqueness, bookmark IDs and candidate targets before writing, and refuses to downgrade a diagram import to the empty workbook. Repeated imports produce identical output. Unrelated APIs and tables are preserved.

Earlier validation covered the functional, local-list-search and field-profile browser suites, including widths from 320 to 1920 pixels. The current additions pass all 30 core tests and the SAP browser suite at 1600, 768, 390 and 320 pixels, covering inventories, definitions, comments, technical labels, tree order, documentation links, field search and Excel metadata. Import outputs are byte-identical on repetition, and all active table/field records validate against the OpenAPI schemas. Long-table search uses an isolated 150-field fixture rather than restoring rejected source classes.

For further verification, obtain a physical-schema export or SAP dictionary mapping, the deployed WSDL, and confirmation of the three ambiguous attributes. These would validate technical contracts; they are no longer prerequisites for browsing this application model in the prototype.
