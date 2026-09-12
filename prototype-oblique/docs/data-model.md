# Catalog data model

**Canonical specification · review baseline: 12 September 2026.** This is the authoritative document for the catalog's scope, entities, attributes, relationships, keys, cardinalities and validation rules. It includes the physical schema mapping and ER diagram so the schema can be reviewed in one place.

**Review status:** the repository schema has been reconciled with this specification; your review of its business sufficiency is still pending. All 19 public tables and 472 columns are accounted for. Deployment and the factual completeness of catalog entries must be verified separately; neither is certified by this document.

## Vision and purpose

Build a shared DE/IT/FR/EN catalog that connects business meaning with documented data structures and services. Business definitions lead; documented relationships make implementation coverage and API gaps understandable.

The model describes metadata, not individual buildings, parcels or observations. Building, Parcel, EconomicUnit and Measurement are BusinessObject records with BusinessAttribute definitions; their proposed content is maintained in the [business-object attribute proposal](business-object-attribute-proposal.md).

The scope includes reusable quality requirements, documented lineage, controlled vocabularies, responsibility and edit history. Quality execution/results, workflow, separate organisation registries, multi-tenancy and diagram editing are outside the core model. Implementation status does not determine whether an entity belongs to the target.

## Reading guide

| Question | Section |
|---|---|
| What does the catalog describe? | [Conceptual model](#conceptual-model) and [entity overview](#entity-overview) |
| What are the exact attributes and relationships? | [Conventions](#conventions), [entity definitions](#entity-definitions) and [owned value types](#reusable-value-types) |
| What should I review before launch? | [Review checklist and known gaps](#review-before-launch) |
| Is every stored field and key accounted for? | [Schema baseline and mapping](#physical-schema-and-constraints), [ER diagram](#physical-er-review-diagram) and [key constraints](#key-and-constraint-review) |
| What should editors know before using it? | [Editing, archiving and history](#editing-archiving-and-history) |
| How does it align with standards? | [Standards alignment](#standards-alignment) |
| How do the app, API and migration implement it? | [Implementation guide](data-model-implementation.md) |

Each entity dictionary lists its complete canonical attributes. Review one entity at a time, then its shared conventions, owned values and cross-record constraints. A field being documented and implemented does not establish that the model contains every business concept you need.

### Authority and change control

Change model meaning, fields, cardinalities, controlled values and integrity rules here first. Implement an accepted change through a new migration, corresponding API/app changes and verification. Existing applied migrations remain historical records; do not edit them to conceal a model change.

| Artifact | Role |
|---|---|
| This document | Canonical model and schema contract, including explicitly labelled review gaps and deferred proposals. |
| [Implementation guide](data-model-implementation.md) | App coverage, storage implementation, write/read behavior, migration and verification procedures. It must follow this model. |
| [SQL migrations](../supabase/migrations/) and [generated OpenAPI](../data/swagger.json) | Evidence of the implemented repository schema and wire format. A mismatch is a documented implementation gap or a model change to review, not an automatic redefinition of the model. |
| [Business-object proposal](business-object-attribute-proposal.md), source captures and wireframes | Content/design evidence. They do not add catalog entities or fields until a model change is recorded here. |

## Review before launch

### Schema review checklist

The checks below are for your review of the specification. They are intentionally open; automated schema reconciliation does not approve these decisions.

- [ ] **Scope:** the [16 core entities](#entity-overview) cover the required catalog metadata. Operational building/parcel records, source observations and execution results remain outside this schema.
- [ ] **Attributes:** each [entity dictionary](#entity-definitions) has the required facts, formats, optionality and controlled values; unknown values and four-language completeness rules are acceptable.
- [ ] **Identity and ownership:** required parents, scoped uniqueness, hierarchical codes/domains and retained identifiers match the intended lifecycle. Use the [key review](#key-and-constraint-review).
- [ ] **Business versus source constraints:** [BusinessAttribute](#businessattribute), [DataField](#datafield), [ProductAttribute](#productattribute) and [QualityRequirement](#qualityrequirement) keep their distinct meanings. The five rule types and prose-only custom requirements are sufficient for initial use.
- [ ] **Relationships:** the [nine allowed signatures](#relationship-types), verification, coverage and endpoint scope cover the associations needed at launch. Business-instance cardinalities and arbitrary new relationship types are not implied by these signatures.
- [ ] **Governance and visibility:** responsibility, authority, inheritance and sensitivity have the right scope. [Public metadata and history](#editing-archiving-and-history) may include names and comments; internal classification does not make those records private.
- [ ] **Retention and audit:** independent archive/status flags, retained references and the current audit limitations below meet the review and recovery needs.
- [ ] **Content readiness:** review the actual object/attribute definitions, vocabularies, source inventories and candidate mappings separately. A structurally valid catalog entry is not necessarily factually complete or approved.

### Known gaps and deferred work

These items distinguish the model contract from current app/tooling coverage. Decide which gaps matter for launch before treating the review as complete; this document does not silently waive a requirement.

| Area | Current state / review consequence |
|---|---|
| Audit completeness | REST quality changes retain full assignment IDs. The browser Required shortcut records a boolean and may create a shared rule without a separate creation event. Endpoint history targets its service, with the endpoint row in the snapshot; complete owner-aggregate snapshots are not implemented. Review whether this is sufficient before editing begins. |
| Browser field coverage | Forms cover a subset of the schema. Actor/rule management, full quality assignments, relationship/lineage editing and service verification changes use REST. The [coverage matrix](data-model-implementation.md#prototype-coverage) identifies available editors; stored support does not promise a dedicated screen. |
| Review evidence | The database checks shapes, tokens and selected evidence requirements. It does not verify that a source statement is true or that an endpoint check actually occurred. Generic change history is not a test report; review evidence must identify its scope. |
| Derived relationship views | The complete confirmation-aware, multi-domain read model remains a target. The current projection may show a candidate realization and reduce a table's mappings to one. Do not treat that display as proof of complete or confirmed coverage. |
| Additional tooling | General batch/source-refresh merging, automatic impact review, quality execution, lineage ingestion/visualization and standards export remain later work. Their absence does not remove QualityRequirement or LineageRelation from the model. |
| Publication extension | Catalog, Dataset and Distribution are [deferred proposals](#optional-publication-extension), outside the 16-entity baseline. Introduce them through an explicit model decision when an exchange profile requires them. |
| Hosted activation and recovery | This audit executes the repository schema locally. Before user access, verify the deployed migrations, API function, disabled public signup and intended permissions using the [database](../supabase/README.md) and [API activation](api.md#activation) guides, and validate a current backup/recovery path. Hosted state was not checked in this review. |

### Maintaining this baseline

After an accepted model change, reconcile every SQL column with a dictionary attribute or explicit collection/reference expansion; review all FK targets, enum tokens, conditional requirements and owned JSON shapes. Update the ER diagram, schema inventory and implementation coverage together. Record the new review date and outstanding gaps here; retain source evidence and applied migrations.

Using the [local SQL test setup](../supabase/README.md#validation), run these commands from the repository root:

```powershell
node prototype-oblique/tests/catalog-schema.cjs
node prototype-oblique/supabase/generate-openapi.cjs --check
```

The first checks every current column against the dictionaries, nullability and table inventory before exercising the original schema's constraints. The second detects drift in the generated API contract; regenerate OpenAPI when migrations intentionally change it. Run the affected editing/API suites for any corresponding behavior change. Neither command replaces review of meaning, evidence, enum definitions or the ER diagram.

## Conceptual model

BusinessObject and BusinessAttribute define meaning and requirements. System, DataTable and DataField describe technical structures. CodeList and CodeValue supply controlled values. DataProduct and ProductAttribute describe an offering and its contract; DataService describes access. Domain groups definitions, Actor provides optional managed responsibility identities, and ChangeEvent preserves history.

Relationship records explicitly documented associations, correspondences and service-support assessments. LineageRelation separately describes technical dependencies. QualityRequirement supplies reusable expectations for business attributes and fields. Organisation details and documentation links are owned values, not additional entities.

### Relationship overview

This overview shows the main conceptual connections. The dictionaries define complete cardinalities and permitted relationship endpoints. The detailed [physical ER review diagram](#physical-er-review-diagram) below shows the repository schema.

```mermaid
flowchart LR
    Domain -->|groups| BusinessObject
    BusinessObject -->|defines| BusinessAttribute
    System -->|documents| DataTable
    DataTable -->|contains| DataField
    System -->|provides| DataService
    DataService -->|owns| ServiceEndpoint
    DataProduct -->|defines| ProductAttribute
    ProductAttribute -.->|business meaning| BusinessAttribute
    CodeList -->|contains| CodeValue
    BusinessAttribute -.->|uses| CodeList
    DataField -.->|uses| CodeList
    BusinessAttribute -.->|requires| QualityRequirement
    DataField -.->|requires| QualityRequirement
    Actor -.->|optional responsibility| BusinessObject
    Relationship -.->|typed endpoints| BusinessObject
    Relationship -.->|typed endpoints| DataProduct
    Relationship -.->|typed endpoints| DataService
    Relationship -.->|typed endpoints| DataTable
    Relationship -.->|typed endpoints| DataField
    Relationship -.->|typed endpoints| BusinessAttribute
    Relationship -.->|optional endpoint scope| ServiceEndpoint
    LineageRelation -.->|technical endpoints| DataTable
    LineageRelation -.->|technical endpoints| DataField
    ChangeEvent -.->|records edits; any core kind| Relationship
```

### Entity overview

The 16 core entities are listed alphabetically. Standards indicate intended alignment, not conformance. Owned value types are defined separately and are not additional entities.

| Entity | Purpose | Standards / alignment |
|---|---|---|
| [Actor](#actor) | Reuses managed internal contact/responsibility identities. | DCMI: `dcterms:Agent` |
| [BusinessAttribute](#businessattribute) | Defines a business characteristic and its expected values. | Local |
| [BusinessObject](#businessobject) | Defines a solution-neutral business concept, such as Building. | Local; optional SKOS glossary: `skos:Concept` |
| [ChangeEvent](#changeevent) | Records catalog edit history. | Local |
| [CodeList](#codelist) | Defines a controlled vocabulary and its authority. | SKOS: `skos:ConceptScheme` |
| [CodeValue](#codevalue) | Defines one stable code and its multilingual meaning. | SKOS: `skos:Concept`, `skos:notation` |
| [DataField](#datafield) | Describes one field in a technical structure. | Local |
| [DataProduct](#dataproduct) | Describes a governed data offering and its product contract. | Local |
| [DataService](#dataservice) | Describes an API or other interface providing data access. | DCAT 3: `dcat:DataService` |
| [DataTable](#datatable) | Describes a technical structure and its documented field inventory. | Local; ArchiMate Data Object correspondence where applicable |
| [Domain](#domain) | Groups definitions by business subject area. | SKOS: `skos:Concept` in a theme scheme |
| [LineageRelation](#lineagerelation) | Records directed table/field data movement and transformation dependencies. | Local; future OpenLineage import alignment |
| [ProductAttribute](#productattribute) | Describes a characteristic promised by a data product. | Local |
| [QualityRequirement](#qualityrequirement) | Defines reusable checks such as Not null, Unique and Greater than zero. | Local; DQV-inspired quality dimensions |
| [Relationship](#relationship) | Records typed business/product associations, implementation correspondences and endpoint support for business requirements. | Local; type-specific standards alignment |
| [System](#system) | Describes an application, register or distributed source inventory. | Local; ArchiMate Application Component correspondence where applicable |

## Conventions

### Naming and completeness

Documentation, entity names, attribute bases and controlled application tokens are English. Entities use PascalCase; conceptual attributes use lowerCamelCase with _de, _it, _fr and _en suffixes for translated content. SQL and REST column names use snake_case: `rowVersion` becomes `row_version`, `qualityRequirementIds` becomes `quality_requirement_ids`, and `name_de` stays unchanged. Owned JSON values retain their documented camelCase keys. The [generated API contract](../data/swagger.json) lists exact request/response names and writable properties. Preserve exact source identifiers, technical names and official codes, including their original language and case.

| Convention | Meaning |
|---|---|
| `1` | Exactly one persisted value is required; the server may supply a documented default or maintained value on creation. |
| `0..1` | Optional value; absence is unknown or undocumented unless stated otherwise. |
| `0..*` / `1..*` | Zero or more / one or more values. Reference collections contain no duplicates. |
| Unknown values | Do not substitute false, zero, blank text or invented dates for missing information. |
| Empty collections | No members or assertions are recorded; this does not prove that none exist in the source. DataField.keyRoles distinguishes unknown from a documented empty set. |
| Catalog validation | Validate metadata separately from the business-data or source constraints it describes. Unknown source constraints are valid catalog metadata. |
| Stored and derived information | Each assertion has one authoritative location. Inverse relationships, inherited context and counts are derived. |

### Reading attribute tables

Each dictionary is complete. Alias (EN) is the English human-readable label, not an additional attribute. Key describes identity and reference roles in the target model; it never describes keys in the source data being cataloged.

| Key | Meaning |
|---|---|
| PK | Immutable internal identity. |
| UQ / UQ (composite) | Unique public identifier or member of a stated scoped uniqueness rule. |
| FK | Reference to an existing record of the stated entity type. |
| FK (typed) | Reference whose entity kind and UUID are both specified. |
| FK (collection) | Multiple references to records of the stated type. |
| FK (composite) | Reference constrained by its owner, such as a parent code in the same list. |
| — | No identity or reference role. |

The [physical schema mapping](#physical-schema-and-constraints) belongs to this specification. The companion guide describes [storage implementation](data-model-implementation.md#postgresql-persistence), [prototype coverage](data-model-implementation.md#prototype-coverage) and [current presentation](data-model-implementation.md#current-presentation-mapping).

### Primitive formats

| Format | Representation and constraints |
|---|---|
| `UUID` | Internal database identifier, generated once on creation and immutable; not a source identifier or translated label. |
| `Identifier` | Non-empty Unicode string; no leading/trailing whitespace. Case-sensitive and never reused for another record. |
| `Text` | Non-empty, not whitespace-only Unicode text when present. Reject U+0000 and unpaired surrogates at the UTF8 boundary. Preserve meaningful source punctuation and line breaks. Escape at rendering; no embedded HTML. |
| `Boolean` | `true` or `false`; absence remains a third, unknown state. |
| `Integer` | Whole JSON number in the safe range -9007199254740991 through 9007199254740991, subject to tighter per-attribute bounds. Digit-only source identifiers remain strings. |
| `Decimal` | Exact finite decimal. The precision-preserving input/owned-JSONB representation is a base-10 string, for example `"0"` or `"123.45"`; scalar SQL storage uses numeric. See [constraint and serialization contract](#constraint-and-serialization-contract). |
| `Date` | Calendar date in `YYYY-MM-DD` form. No artificial time of day. |
| `Timestamp` | [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) date-time with `Z` or an explicit UTC offset. Date-only evidence does not establish an exact timestamp. |
| `LanguageCode` | Exactly `de`, `it`, `fr` or `en`; supported content/UI languages and suffixes. |
| `LanguageTag` | Valid [BCP 47 tag](https://www.w3.org/International/articles/language-tags/) for source, destination or dataset-content language, which may differ from the four supported translation languages. |
| `HttpUrl` | Absolute HTTP or HTTPS URL without embedded credentials. Validate schemes before rendering links. |
| `Enum` | Documented English application token with a translated UI label. Official source codes are not translated. |
| `Object` | JSON object constrained by its documented owned shape; not an arbitrary replacement for entity attributes. |
| `<Format>[]` | Array of values of the stated format; member constraints also apply to every element. |
| `RecordReference` | Conceptual kind plus UUID; REST exposes concrete UUID FK columns. |

### Internationalisation

Support German (DE), Italian (IT), French (FR) and English (EN). Every declared localized family has four sibling attributes, each optional individually. Every named entity needs at least one populated name; valid Domains, BusinessObjects, BusinessAttributes and QualityRequirements also need at least one populated description.

| Content | German | Italian | French | English |
|---|---|---|---|---|
| Name | name_de | name_it | name_fr | name_en |
| Description | description_de | description_it | description_fr | description_en |
| Link title | title_de | title_it | title_fr | title_en |
| Change summary | summary_de | summary_it | summary_fr | summary_en |

Names, descriptions and declared localized notes are ordinary editable content. Missing translations remain unknown; never invent them or copy display fallback into the record. Personal names remain proper names; organisation names may have documented translations. Translation edits do not change identity.

comment, accessNotes and licenseNotes each retain one authored value without language variants. Identifiers, technical names, codes, URLs, units and machine-readable constraints are language-independent. A suffix identifies the content language, not the language in which someone edited the record. LocalizedTextFields defines the reusable family convention.

[Display fallback and language handling](data-model-implementation.md#display-fallback-and-language-handling) belong to the application contract.

### Shared attribute conventions

Every entity chapter contains its complete target attribute table. Names, descriptions, comments, identity, status and responsibility fields are repeated where applicable so the chapter can be read on its own. Matching fields follow the same rules below; repetition does not introduce inheritance, extra entities. Internal identities are marked in each dictionary; read-only projections are described separately.

#### Identity

`id` is the immutable UUID used by foreign keys and REST record routes. `identifier` is stable and unique within the concrete core kind, including full child identifiers; only ServiceEndpoint identifiers are scoped to their owner. A child may also have an owner-scoped semantic name or code. Source technical names and translated labels do not determine identity. Identities and owning parents cannot be reassigned by an update. Archived records retain their identifiers and uniqueness reservations.

`rowVersion` is a server-maintained optimistic edit revision on mutable records. It increases when a stored row changes; owned edits also invalidate the owner's revision, so callers must use the returned value rather than predict it. A no-op creates no edit event or revision. `editedAt` records a timestamp from the edit command; it may be unknown for imports or changes outside that command. Catalog dates describe the record itself; inherited parent dates are context, not new child assertions. `kind` is derived from the concrete entity and is not an independent attribute. [RecordReference](#recordreference) lists allowed target kinds; ChangeEvent is not itself a target.

#### Version and dates

For entities with version, versionDate records when that catalog definition version was issued. New assignments and version changes require a date. Correcting the date or version is an audited edit; history retains the previous pair. A normal metadata edit changes modifiedOn/rowVersion without silently issuing a new version.

When version is absent, versionDate must also be absent; clear both in the same edit. A known date may be corrected but cannot be cleared while its version remains. Preserve a legacy version with an unknown date until the next version is issued; do not substitute creation, modification or import dates. API serviceVersion describes the source interface release. External vocabulary editions remain in standard citations/documentation links, separate from the catalog version.

#### Localized content

Named entities list all four name/description columns. Their family-level completeness and fallback rules are defined under [Internationalisation](#internationalisation). The single optional comment is a catalog note; accessNotes and licenseNotes retain authored access and usage terms. These fields have no translated copies or display fallback. Comments are publicly readable in the current app; “internal note” describes their editorial purpose, not confidential storage.

Relationship has one optional comment and localized rule notes; LineageRelation has transformation notes. Both derive their display labels from endpoints and translated type/operation labels. DocumentationLink has localized titles; ChangeEvent has summaries and attribution. These supporting records have their own prose fields instead of generic names and descriptions. English aliases are human-readable attribute labels; translated names are the preferred content labels. Language fallback follows [Internationalisation](#internationalisation).

#### Status

The ten entities with status use draft, valid and retired. Status is maintained manually and describes catalog readiness, not a formal approval. BusinessAttribute and DataField have independent status; CodeValue and ProductAttribute derive it from their owner. Relationship and LineageRelation use verificationStatus. Actor has no editorial lifecycle; ChangeEvent records edits without separate reviewer/date fields or an approval workflow.

Every mutable core entity and ServiceEndpoint also has `isArchived`, default false. It controls removal from normal browsing independently of status or verification. A record can therefore have status `valid` and be archived. Archiving an Actor does not remove its existing responsibility references; it prevents ordinary new selection in the editor. `sortOrder` on the five owned row types records a non-negative display order within the owner; it is not identity, a source key or a guarantee of unique positions. The current editor preserves the initial order when positions tie.

#### Responsibility

Use `responsibleOrganisation` for organisation details stored directly on an entry. Use optional `dataOwnerId`, `dataStewardId` and `contactActorId` where the entity declares them and an internal Actor record is maintained. QualityRequirement keeps only responsibleOrganisation and contactActorId, without owner/steward roles or parent inheritance. Technical entries also support `dataCustodianId` as scoped below. External metadata may contain only the organisation; an empty personal role is valid. Recording an organisation does not automatically assign it every role.

Data custodian is a technical responsibility, available on System, DataTable, DataField and DataService only. Domain, BusinessObject, BusinessAttribute, CodeList, CodeValue, DataProduct, ProductAttribute and QualityRequirement have no custodian field or inherited custodian. Reference-data authority and stewardship do not imply technical custody. Omit inapplicable roles; keep applicable unknown roles visible.

Store roles directly on the governed record. Resolve each applicable role independently: a BusinessAttribute falls back to its BusinessObject, a DataField to its DataTable, and a table's custodian to its System. CodeValue uses its CodeList authority; ProductAttribute uses its parent roles without overrides. No other inheritance, including Domain membership, is implied. Show where inherited roles come from. Clearing an override returns to the inherited value; it does not suppress a known parent role.

The initial model permits one responsible organisation value and one managed actor per optional role. Conflicting or multiple explicitly named parties require clarification; never silently discard them. Role changes use ChangeEvent. Catalog ownership is distinct from property ownership, facility management and publication responsibility.

Apply organisation fallback as a whole: a directly supplied organisation replaces the parent value, without mixing one organisation's name with another's website. Contact links use an explicit contactActorId when supplied, otherwise the responsibleOrganisation's website/contact page. Dedicated email and phone attributes are excluded from catalog entries. Keep their origin clear; do not infer a contact from a data-owner name. CodeList uses authorityOrganisation alone, without owner/steward/contact overrides; CodeValue inherits that authority as context. Other entities use their declared responsibility fields.

For GWR, the entry can hold Bundesamt für Statistik directly, plus its documented website/contact page, and leave all Actor links empty. An internal editor's edit attribution is independent of the external provider; no employee of that provider needs an Actor record.

#### Sensitivity

A child BusinessAttribute or DataField may supply explicit sensitivity; otherwise it inherits from its owner, with origin shown. Other entities with these attributes use their own assertions. Domain has neither attribute and supplies no sensitivity fallback to its members. An empty inherited and direct value stays unknown. This classification describes cataloged information and is not the access-control policy for catalog contacts or review history.

## Editing, archiving and history

Visitors can browse the catalog without signing in. Every permanent app account can edit; an Actor is a contact/responsibility record and does not grant login or editing permission. Users need no database or Supabase dashboard account. Public registration must remain disabled for the agreed internal-user setup.

The account dialog can show/copy the current login's expiring API token. It is a credential for the same editing rights, not a catalog attribute, API endpoint authentication example or long-lived integration key. Never place credentials in catalog content. Names, comments, contact actors, raw catalog records and public ChangeEvents are readable without login. Exact authenticated-user attribution and retry receipts are stored separately in private operational tables.

| Action | Meaning |
|---|---|
| Create | Create one explicitly identified entry; missing optional facts remain unknown. The server assigns IDs/identifiers when omitted. Supply at least one name where applicable and the required owner/type fields. |
| Edit | Preserve the UUID, identifier and immutable ownership/scope. Supply the current revision. A stale edit fails for reconciliation; related changes commit with history or roll back together. |
| Edit a translation | Change the chosen language only. Display fallback is never saved as a new authored translation. |
| Change a shared rule or contact | The changed definition is used by every existing reference. Review its impact; related records keep their own status and content. |
| Archive / REST DELETE | Set `isArchived = true`; retain the record, references, owned rows and audit history. Archive does not cascade or change lifecycle/verification status. |
| Restore | Set `isArchived = false` with the current revision. Previous status/verification remains. Separately reactivating a rejected/obsolete assertion requires a change to `candidate` before confirmation. |
| Retire a definition | Set status to `retired` where available. This editorial state is distinct from archive visibility; the current UI may still list retired entries. |
| Remove a quality assignment | Replace the owner's complete requirement-ID collection. Unlinking keeps the reusable rule and audit history; an empty collection means no documented expectations. |

The 16 core entities include append-only ChangeEvent. The REST API supports CRUD on the other 15 core entities plus the owned ServiceEndpoint. Quality assignment junctions are managed through their attribute/field; ChangeEvents are generated by writes and have no user CRUD. The [API guide](api.md) defines exact routes, retry keys, revision headers and archive filters. Public browsing hides archived entries/owned rows and navigation links to archived entries; raw REST/snapshot reads retain them. Archive alone does not deactivate an assigned quality rule or erase responsibility context.

### Enforced rules and editorial review

| Rule | Current boundary |
|---|---|
| Names, enums, required owners, version/date pairs, owned JSON shapes | SQL constraints validate these on writes. |
| Stable identities, same-owner parent codes/endpoints, unique assertion scopes, hierarchy cycles | SQL constraints/triggers enforce these; archiving does not release their keys. |
| Quality-rule compatibility | SQL rejects new assignments to status-retired rules and numeric rules on explicitly non-numeric business types. An unknown business type remains unassessed. Exact source type strings are not automatically interpreted or evaluated. |
| Evidence and verification | SQL checks required notes/links and selected scope/version transitions. Whether the evidence is correct, complete and operation-specific requires editorial review. |
| Endpoint checks | Verification status records a documented assessment; the catalog does not execute the source endpoint or verify a claimed test result. |
| Shared changes and archival | Review dependent definitions and references. The current commands do not automatically mark them outdated, retire them, or cascade archive. Archived records can still satisfy stored foreign keys. |
| Audit | App edit and REST commands save history atomically. Direct administrator SQL is outside those commands and does not automatically produce equivalent audit events. |

The browser supports profile/owned-row editing, including a Required convenience control backed by rule assignments. Actor/rule management, complete quality-assignment editing, relationship/lineage editing and service verification changes are available through REST, without dedicated browser editors. Relations remain read-only in the edit workspace. Quality execution/results, lineage ingestion/visualization, full multi-domain relationship projection and standards export remain outside the current release. Detailed target behavior below must not be read as evidence that those interfaces or review workflows are implemented.

## Entity definitions

Alphabetical reference. Each dictionary lists all stored attributes, including applicable shared metadata. Key and visibility notation follows [Conventions](#conventions).

### Actor

Derived `kind = actor`. The table lists its complete attributes and identity. An internally managed person or organisation, independent of the roles it fulfils. External organisations need no Actor record; their details belong directly to the catalog entry.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `actorType` | Actor type | — | Enum | 1 | `person`, `organisation`. |
| `websiteUrl` | Website | — | HttpUrl | 0..1 | Official website or directory entry. Do not fabricate URLs from names. |

Organisation names may have official language variants. Personal names are proper names and must not be automatically translated. Matching labels alone are insufficient to merge actors.

Contact actors are independent of login accounts. Changing an Actor updates references without duplicating its contact fields on every record. Retain historical attribution in ChangeEvent where recorded.

### BusinessAttribute

Derived `kind = businessAttribute`. The table lists its complete attributes and identity. Describes expected business values; it does not hold those values.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `sortOrder` | Row order | — | Integer | 1 | Display order within the owner, from 0 through 2147483647 (SQL integer); defaults to 0. Reordering preserves row identity. Ties are permitted. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. Do not copy a parent date as a child assertion. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. Do not copy a parent date as a child assertion. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent. |
| `dataOwnerId` | Data owner | FK | UUID → Actor | 0..1 | Accountable person/organisation. One optional Actor; apply only the documented parent fallback. |
| `dataStewardId` | Data steward | FK | UUID → Actor | 0..1 | Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback. |
| `classification` | Classification | — | Enum | 0..1 | `public`, `internal`, `confidential`, `secret`. Classification of the described information, separate from technical access. |
| `containsPersonalData` | Personal data | — | Boolean | 0..1 | Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset. |
| `businessObjectId` | Business object | FK | UUID → BusinessObject | 1 | Owning business definition. |
| `semanticName` | Semantic name | UQ (composite) | Identifier | 1 | Stable English name, unique within the owner, for example `constructionYear`. Independent of localized labels. |
| `valueSpecification` | Value specification | — | ValueSpecification | 0..1 | Descriptive value type/format/unit only; required before status becomes valid. Validation rules come from qualityRequirementIds, not inline bounds or conditions. |
| `qualityRequirementIds` | Data quality requirements | FK (collection) | UUID[] → QualityRequirement | 0..* | Reusable quality rules assigned to this attribute/field; no duplicates or per-assignment overrides. Resolve each referenced rule's definition and status; no automatic parent-status cascade. Business requirements stay solution-neutral; field rules describe additional source expectations. |
| `isIdentifier` | Business identifier | — | Boolean | 0..1 | Participation in business identification. Does not establish a physical key or global uniqueness. |
| `codeListId` | Code list | FK | UUID → CodeList | 0..1 | Reviewed vocabulary; similar source wording is insufficient evidence. |

BusinessAttribute derives normative references from its BusinessObject; these are parent context, not separate attribute assertions.

Validation requirements are resolved through qualityRequirementIds. An empty assignment list means no requirements are recorded; it does not establish optionality. isIdentifier describes the attribute's identification role, not a uniqueness check. Conditional requirements and cardinality limits belong to reusable QualityRequirement definitions.

Derived context: domain and normative references from BusinessObject; effective roles and sensitivity use the documented fallback. Status is independent; parent dates and history remain labelled parent context.

### BusinessObject

Derived `kind = businessObject`. The table lists its complete attributes and identity. Defines a business **type** independently of physical schemas and interface capabilities.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent. |
| `dataOwnerId` | Data owner | FK | UUID → Actor | 0..1 | Accountable person/organisation. One optional Actor; apply only the documented parent fallback. |
| `dataStewardId` | Data steward | FK | UUID → Actor | 0..1 | Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback. |
| `classification` | Classification | — | Enum | 0..1 | `public`, `internal`, `confidential`, `secret`. Classification of the described information, separate from technical access. |
| `containsPersonalData` | Personal data | — | Boolean | 0..1 | Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset. |
| `domainId` | Domain | FK | UUID → Domain | 1 | Primary business domain. A copied domain label is not the relationship. |
| `normativeReferences` | Standard reference | — | Text[] | 0..* | Documented standards/rules, including edition when known. URLs belong in DocumentationLink. |

Derived: BusinessAttributes by owner and technical realisations through Relationship. Terminology links use `purpose = terminology`. API limitations must not define the business concept.

### ChangeEvent

Derived `kind = changeEvent`. The table lists its complete attributes and identity. Append-only metadata history, separate from business transactions or operational measurement history.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Unique event identifier; never an array position. |
| `record` | Catalog entity | FK (typed) | RecordReference | 1 | Changed catalog record. |
| `occurredOn` | Date | — | Date | 1 | Known event date. For events with occurredAt, use its UTC calendar date; preserve standalone legacy dates without inventing a timestamp. |
| `occurredAt` | Event timestamp | — | Timestamp | 0..1 | Exact event time when known; normalize to UTC. Its UTC calendar date must equal occurredOn. Keep legacy date-only events without this attribute. |
| `action` | Change | — | Enum | 1 | `created`, `updated`, `imported`, `retired`, `restored`. Preserve unmapped original action wording in summaries. |
| `actorId` | Actor | FK | UUID → Actor | 0..1 | Identified editor when available; this is edit attribution, not approval. |
| `actorName_de` | Edited by (DE) | — | Text | 0..1 | German. Recorded name at the time of the edit, also when actorId resolves. Preserve known wording without translation or inferred identity; later Actor edits must not rewrite attribution. |
| `actorName_it` | Edited by (IT) | — | Text | 0..1 | Italian. Recorded name at the time of the edit, also when actorId resolves. Preserve known wording without translation or inferred identity; later Actor edits must not rewrite attribution. |
| `actorName_fr` | Edited by (FR) | — | Text | 0..1 | French. Recorded name at the time of the edit, also when actorId resolves. Preserve known wording without translation or inferred identity; later Actor edits must not rewrite attribution. |
| `actorName_en` | Edited by (EN) | — | Text | 0..1 | English. Recorded name at the time of the edit, also when actorId resolves. Preserve known wording without translation or inferred identity; later Actor edits must not rewrite attribution. |
| `summary_de` | Details (DE) | — | Text | 0..1 | German. Change summary. At least one of the four summaries is required. |
| `summary_it` | Details (IT) | — | Text | 0..1 | Italian. Change summary. At least one of the four summaries is required. |
| `summary_fr` | Details (FR) | — | Text | 0..1 | French. Change summary. At least one of the four summaries is required. |
| `summary_en` | Details (EN) | — | Text | 0..1 | English. Change summary. At least one of the four summaries is required. |
| `changedProperties` | Changed properties | — | Text[] | 0..* | Canonical property paths, including the exact language suffix for translated text, where known. |
| `before` | Before change | — | Object | 0..1 | Snapshot before the changed record/owned edit, absent for creation. Legacy events may lack it. Contains direct values and command-specific owned data, without linked-record expansion or derived counts; see the audit-format notes below. |
| `after` | After change | — | Object | 0..1 | Snapshot after the edit, required for all new events; retirement retains the record and snapshot. Legacy history may omit it; never reconstruct unknown past values. |
| `importId` | Import or operation ID | — | Identifier | 0..1 | Shared operation identifier grouping related events from an import, batch or multi-record command. Required for new commands emitting multiple events, including relationship/product edits. One generated value is reused across retries; no separate operation entity is required. |

Parent history may appear as related context on child profiles, clearly labelled as parent history. Do not duplicate it as child events. Retain stable archival references when retiring records referenced by history.

ChangeEvent preserves any recorded editor name independently of later Actor edits. Current app/REST commands use generic public “Catalog editor” labels and retain the authenticated user UUID privately; they do not create an Actor or expose the login email. Events and prior snapshots are immutable; restoring a record creates a new event.

Current snapshots use SQL property names, including `row_version` and UUID foreign keys. REST attribute/field events include the complete `quality_requirement_ids` collection. Browser Required edits record the derived `required` boolean rather than every assignment ID; that shortcut can also create its shared Required rule without a separate rule-creation event. Endpoint changes target the owning DataService in history, but their snapshots identify the changed endpoint. Child events can be displayed on the owner's history; advancing an owner's revision for a child write does not necessarily create another owner event. The [implementation guide](data-model-implementation.md#audit-snapshots-and-event-grouping) separates these formats from the fuller aggregate-audit target.

### CodeList

Derived `kind = codeList`. The table lists its complete attributes and identity. A vocabulary independent of labels and applications using it.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `domainId` | Domain | FK | UUID → Domain | 0..1 | Explicit primary domain; if absent, derive it from businessObjectId when that object is active. Explicit domain takes precedence. |
| `businessObjectId` | Business object | FK | UUID → BusinessObject | 0..1 | Primary classified concept. Actual attribute/field usage comes from their direct references. |
| `authorityOrganisation` | Source authority | — | OrganisationDetails | 0..1 | Organisation defining the vocabulary, recorded directly. The sole organisation value on a CodeList. Keep unresolved authority wording in comment/import notes; do not infer an organisation from a standard citation. |
| `normativeReferences` | Standard reference | — | Text[] | 0..* | Documented standards/rules, including edition when known. Preserve partial or composite citations intact; do not invent a standard identifier. URLs belong in DocumentationLink. |

Derived: CodeValues and the attributes/fields using the list. Use version/versionDate for catalog releases and documentationLinks/normativeReferences for the applicable external specification. Record known incompleteness or usage restrictions in comment; an empty list does not prove completeness.

A compatible update or added translation keeps the same identity. If a code changes meaning and existing users must retain the old vocabulary, create a separately identified CodeList with its own CodeValues; do not silently retarget existing references. ChangeEvent preserves edits without an edition-chain entity or link.

### CodeValue

Derived `kind = codeValue`. The table lists its complete attributes and identity. Several translated labels describe the same vocabulary member.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `sortOrder` | Row order | — | Integer | 1 | Display order within the owner, from 0 through 2147483647 (SQL integer); defaults to 0. Reordering preserves row identity. Ties are permitted. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `codeListId` | Code list | FK | UUID → CodeList | 1 | Owning vocabulary. |
| `code` | Code | UQ (composite) | Text | 1 | Unique within the list. Preserve leading zeros, punctuation, case and symbolic paths. Source order is not a wire code. |
| `shortName_de` | Short name (DE) | — | Text | 0..1 | German. Official abbreviations where available. |
| `shortName_it` | Short name (IT) | — | Text | 0..1 | Italian. Official abbreviations where available. |
| `shortName_fr` | Short name (FR) | — | Text | 0..1 | French. Official abbreviations where available. |
| `shortName_en` | Short name (EN) | — | Text | 0..1 | English. Official abbreviations where available. |
| `parentCodeValueId` | Parent code value | FK (composite) | UUID → CodeValue | 0..1 | Broader member in the same vocabulary; enforce the composite FK with codeListId. No self-reference or cycles. Do not invent selectable parent codes from source headings. |

If a code changes meaning while existing references must retain its old definition, use a separately identified CodeList. Do not silently relabel historical references. Status and catalog definition version belong to CodeList; CodeValue has its own edit revision and history, without a separate version field or validity period.

Derived context: status, authority and domain from CodeList. CodeList/CodeValue have no sensitivity classification or personal-data flag, including inherited values.

### DataField

Derived `kind = dataField`. The table lists its complete attributes and identity. Has a stable catalog identifier independent of its source name or array position.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `sortOrder` | Row order | — | Integer | 1 | Display order within the owner, from 0 through 2147483647 (SQL integer); defaults to 0. Reordering preserves row identity. Ties are permitted. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. Do not copy a parent date as a child assertion. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. Do not copy a parent date as a child assertion. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent. |
| `dataOwnerId` | Data owner | FK | UUID → Actor | 0..1 | Accountable person/organisation. One optional Actor; apply only the documented parent fallback. |
| `dataStewardId` | Data steward | FK | UUID → Actor | 0..1 | Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback. |
| `dataCustodianId` | Data custodian | FK | UUID → Actor | 0..1 | Maintains the technical source; may be a person or organisation. One explicit actor per role; missing means undocumented or inherited as specified below. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback. |
| `classification` | Classification | — | Enum | 0..1 | `public`, `internal`, `confidential`, `secret`. Classification of the described information, separate from technical access. |
| `containsPersonalData` | Personal data | — | Boolean | 0..1 | Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset. |
| `dataTableId` | Data table | FK | UUID → DataTable | 1 | Owning technical structure. |
| `technicalName` | Technical name | — | Text | 1 | Exact documented source field name, preserving case. Never translated. |
| `technicalNameKind` | Technical name kind | — | Enum | 1 | `physicalColumn`, `modelAttribute`, `apiField`, `dataSourceField`, `unknown`. |
| `sourcePath` | Source path | — | Text | 0..1 | Documented nesting or path context when the name is ambiguous. Not a guessed flattened column. |
| `sourceDataType` | Data type | — | Text | 0..1 | Exact reported type, including documented length/precision. |
| `dataTypeScope` | Data type scope | — | Enum | 0..1 | `physicalSchema`, `modelDefinition`, `serviceSchema`, `unknown`; required when sourceDataType is present, otherwise absent. Use unknown when a documented type has no established scope. |
| `qualityRequirementIds` | Data quality requirements | FK (collection) | UUID[] → QualityRequirement | 0..* | Reusable quality rules assigned to this attribute/field; no duplicates or per-assignment overrides. Resolve each referenced rule's definition and status; no automatic parent-status cascade. Business requirements stay solution-neutral; field rules describe additional source expectations. |
| `isRequired` | Mandatory | — | Boolean | 0..1 | Documented presence requirement in the stated source scope. Not inherited from the business definition. |
| `isNullable` | Nullable | — | Boolean | 0..1 | Whether explicit null is permitted. Distinct from whether the field may be absent. |
| `keyRoles` | Key | — | Enum[] | 0..* | `primary`, `foreign`, `unique`. An absent value means unknown; an empty set means reviewed with no documented role. Never treat an unknown key set as a confirmed empty set. Composite-key membership does not make a field individually unique.  Describes source-data keys; not a catalog key. |
| `codeListId` | Code list | FK | UUID → CodeList | 0..1 | Verified source vocabulary; never infer service wire codes from a similarly named model enumeration. |
| `appliesToTypeNames` | Applies to model types | — | Text[] | 0..* | Exact documented source type names using the field; descriptive text, not references to a catalog type registry. Use the documented source declaration to establish membership. The DataTable has no stored type set. |

Duplicate source names may remain as separately identified draft records with evidence of the ambiguity. Domain and system derive through the table. Parent descriptions, comments and provenance are not copied as field-specific facts. Business correspondence belongs to Relationship.

Derived context: system and domains from DataTable; effective roles and sensitivity use the documented fallback. Status is independent; parent dates and history remain labelled parent context.

### DataProduct

Derived `kind = dataProduct`. The table lists its complete attributes and identity. A governed offering assembled for a user purpose; its schema is a product contract rather than necessarily one source table.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent. |
| `dataOwnerId` | Data owner | FK | UUID → Actor | 0..1 | Accountable person/organisation. One optional Actor; apply only the documented parent fallback. |
| `dataStewardId` | Data steward | FK | UUID → Actor | 0..1 | Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback. |
| `classification` | Classification | — | Enum | 0..1 | `public`, `internal`, `confidential`, `secret`. Classification of the described information, separate from technical access. |
| `containsPersonalData` | Personal data | — | Boolean | 0..1 | Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset. |
| `domainId` | Domain | FK | UUID → Domain | 0..1 | Primary business classification. |
| `accessMode` | Access | — | Enum | 0..1 | `public`, `internal`, `restricted`; separate from authentication configuration. |
| `accessNotes` | Access notes | — | Text | 0..1 | Who may obtain the product and under what conditions. One value in its authored language; no translation variants or fallback. |
| `landingPageUrl` | Information page | — | HttpUrl | 0..1 | Documented product information/access page; no placeholder destination. |
| `formats` | Format | — | Text[] | 0..* | Documented product format names or media types; preserve exact tokens and do not guess a standard vocabulary URI. |
| `licenseUri` | License | — | HttpUrl | 0..1 | Identified product usage terms. Missing does not imply open reuse. |
| `licenseNotes` | License notes | — | Text | 0..1 | Documented usage terms in their authored language, including unresolved legacy licence text. One value; no language variants or fallback. |
| `updateFrequency` | Update frequency | — | Enum | 0..1 | `continuous`, `daily`, `weekly`, `monthly`, `quarterly`, `annually`, `onChange`, `onDemand`, `irregular`. Product commitment, not evidence of actual data freshness. |

Derived: ProductAttributes by owner. Format, licence and cadence describe the product offering. Multiple independently managed data collections or representations can justify the optional publication extension later. A product is not automatically a DCAT Dataset or an ArchiMate Product.

Derived associations: outgoing Relationship records with type `basedOn` resolve BusinessObjects, `sourcedFrom` resolve DataTables, and `servedBy` resolve DataServices. These are not independently stored DataProduct attributes. ProductAttribute ownership remains a direct FK. A `servedBy` assertion does not prove that the service exposes every product attribute or source field.

### DataService

Derived `kind = dataService`. The table lists its complete attributes and identity. Describes access interfaces, including SOAP, REST, map and feature services.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent. |
| `dataOwnerId` | Data owner | FK | UUID → Actor | 0..1 | Accountable person/organisation. One optional Actor; apply only the documented parent fallback. |
| `dataStewardId` | Data steward | FK | UUID → Actor | 0..1 | Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback. |
| `dataCustodianId` | Data custodian | FK | UUID → Actor | 0..1 | Maintains the technical source; may be a person or organisation. One explicit actor per role; missing means undocumented or inherited as specified below. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback. |
| `classification` | Classification | — | Enum | 0..1 | `public`, `internal`, `confidential`, `secret`. Classification of the described information, separate from technical access. |
| `containsPersonalData` | Personal data | — | Boolean | 0..1 | Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset. |
| `systemId` | System | FK | UUID → System | 0..1 | Providing system, if identified. External services need no invented system assignment. |
| `domainId` | Domain | FK | UUID → Domain | 0..1 | Primary catalog classification. |
| `technicalName` | Technical name | — | Text | 0..1 | Official interface identifier. |
| `serviceVersion` | Service version | — | Text | 0..1 | Source interface release, separate from catalog `version`. |
| `purpose` | Purpose | — | Enum | 0..1 | `recordAccess`, `featureAccess`, `mapImage`, `download`, `mixed`. Map display does not imply polygon extraction. |
| `accessMode` | Access | — | Enum | 0..1 | `public`, `internal`, `restricted`. |
| `accessNotes` | Access notes | — | Text | 0..1 | Access restrictions and limitations. One value in its authored language; no translation variants or fallback. |
| `endpointDescriptionUrls` | Interface descriptions | — | HttpUrl[] | 0..* | Machine-readable interface descriptions, such as OpenAPI, WSDL or capabilities documents. Human help pages stay in DocumentationLink. |
| `endpoints` | Endpoints | — | ServiceEndpoint[] | 0..* | Documented entry points or operations with distinct stable identifiers. |

Derived: served products and exposure mappings. Link request/response and capability documentation through documentationLinks. A successful sample does not certify all operations, coverage or completeness.

### DataTable

Derived `kind = dataTable`. The table lists its complete attributes and identity. Describes a documented technical structure within a System. Keep its known technical identifier and field inventory; document relevant source limitations in comment and documentationLinks. An API-derived inventory does not establish the full physical schema, and an empty field list does not prove the source has no fields.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent. |
| `dataOwnerId` | Data owner | FK | UUID → Actor | 0..1 | Accountable person/organisation. One optional Actor; apply only the documented parent fallback. |
| `dataStewardId` | Data steward | FK | UUID → Actor | 0..1 | Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback. |
| `dataCustodianId` | Data custodian | FK | UUID → Actor | 0..1 | Maintains the technical source; may be a person or organisation. One explicit actor per role; missing means undocumented or inherited as specified below. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback. |
| `classification` | Classification | — | Enum | 0..1 | `public`, `internal`, `confidential`, `secret`. Classification of the described information, separate from technical access. |
| `containsPersonalData` | Personal data | — | Boolean | 0..1 | Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset. |
| `systemId` | System | FK | UUID → System | 1 | System or source inventory documenting the structure. |
| `domainId` | Domain | FK | UUID → Domain | 0..1 | Explicit primary classification, especially without a confirmed business mapping. |
| `technicalName` | Technical name | — | Text | 0..1 | Exact documented table, class or feature-type identifier. Never substitute an alias for an unknown physical table ID. |
| `databaseName` | Database name | — | Text | 0..1 | Exact source database name, if documented. A source system is not necessarily a database. |
| `schemaName` | Schema name | — | Text | 0..1 | Exact source namespace/schema, if documented; no invented default schema. |

Derived: DataFields by owner, business mappings and consuming products/services. Display the explicit primary domain when supplied; otherwise derive the set of domains from confirmed realisation mappings. Do not silently reduce multiple domains to the first one.

Use documentationLinks for definition and schema references; the catalog describes the structure without embedding the complete source model.

### Domain

Derived `kind = domain`. The table includes its own names and descriptions. A business subject area independent of an application or navigation layout.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent. |
| `dataOwnerId` | Data owner | FK | UUID → Actor | 0..1 | Accountable person/organisation. One optional Actor; apply only the documented parent fallback. |
| `dataStewardId` | Data steward | FK | UUID → Actor | 0..1 | Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback. |
| `parentDomainId` | Parent domain | FK | UUID → Domain | 0..1 | Broader domain; no self-reference or cycles. |

Derived: child domains and BusinessObjects referencing this domain. Domains may have no members.

A Domain's description explains its subject area, including relevant inclusion/exclusion boundaries. No name, description or responsibility is borrowed from its parentDomainId.

### LineageRelation

Derived `kind = lineageRelation`. A directed dependency describing documented data movement or transformation between technical tables or fields. Its display label derives from the endpoints. It has no generic name, ownership or second status. Lineage is distinct from catalog associations.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `source` | Source | FK (typed) | RecordReference | 1 | Upstream DataTable or DataField. Must resolve and differ from target. |
| `target` | Target | FK (typed) | RecordReference | 1 | Downstream record of the same kind: table-to-table or field-to-field. BusinessObject and BusinessAttribute are meaning definitions, not flow nodes. |
| `operation` | Operation | — | Enum | 1 | `copy`, `transform`, `aggregate`, `unknown`. A documented dependency may have an unknown operation; do not infer copy from similar names. |
| `transformationNotes_de` | Transformation notes (DE) | — | Text | 0..1 | German. Documented derivation and scope. At least one note is required for confirmed transform or aggregate relations. No executable expression is assumed. |
| `transformationNotes_it` | Transformation notes (IT) | — | Text | 0..1 | Italian. Documented derivation and scope. At least one note is required for confirmed transform or aggregate relations. No executable expression is assumed. |
| `transformationNotes_fr` | Transformation notes (FR) | — | Text | 0..1 | French. Documented derivation and scope. At least one note is required for confirmed transform or aggregate relations. No executable expression is assumed. |
| `transformationNotes_en` | Transformation notes (EN) | — | Text | 0..1 | English. Documented derivation and scope. At least one note is required for confirmed transform or aggregate relations. No executable expression is assumed. |
| `verificationStatus` | Verification status | — | Enum | 1 | `candidate`, `confirmed`, `rejected`, `obsolete`; new records default to candidate. Confirmation requires a documented basis in transformation notes and/or documentationLinks, an explicit verification-state edit recorded in ChangeEvent. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Supporting documentation for the scoped assertion. Deduplicate URL/purpose pairs; confirmation also needs the review and scope notes below. |

Store one relation identity per directed source/target pair, including rejected/obsolete rows; retain changes in history. Endpoints are immutable: a different pair has a different identity. Explicitly restoring a previously recorded pair reuses its ID and history, returns it to candidate. Several input relations can lead into the same output, with transformation scope documented in notes and documentation links. The initial model records dependency, not distinct execution instances or multiple scheduled jobs for the same pair.

Field-level lineage may produce a derived table-level summary through field ownership. Omit a table self-edge when both fields share an owner; retain the field-level dependency. Mark derived summaries and do not persist them as duplicate assertions. A separately documented table relation is allowed but does not prove field-level detail. Multiple hops support impact analysis only within the recorded scope; no path does not prove independence. Feedback cycles may be documented; traversal must guard against loops rather than assume every graph is acyclic.

A business correspondence, product source-table association or API exposure does not establish lineage. Record the flow basis in documentation links and transformation notes. Editors maintain verificationStatus explicitly; there is no automated reassessment of upstream changes.

### ProductAttribute

Derived `kind = productAttribute`. The table lists its complete attributes and identity. Defines a product-specific characteristic, distinct from business definitions and source fields.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `sortOrder` | Row order | — | Integer | 1 | Display order within the owner, from 0 through 2147483647 (SQL integer); defaults to 0. Reordering preserves row identity. Ties are permitted. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `dataProductId` | Data product | FK | UUID → DataProduct | 1 | Owning product contract. |
| `semanticName` | Semantic name | UQ (composite) | Identifier | 1 | Stable English name, unique within the product. |
| `businessAttributeId` | Business attribute | FK | UUID → BusinessAttribute | 0..1 | Reviewed business meaning when correspondence is direct. |
| `valueSpecification` | Value specification | — | ValueSpecification | 0..1 | Value format and constraints promised by the product. |
| `isRequired` | Mandatory | — | Boolean | 0..1 | Requiredness in the product contract; absence is unknown. |

Product restrictions must not overwrite the business attribute's general definition. Array positions do not identify product attributes.

Status and responsibilities come from the owning DataProduct.

Derived context: status, responsibilities, sensitivity and domain from DataProduct. These are read-only parent values, not additional ProductAttribute columns.

### QualityRequirement

Derived `kind = qualityRequirement`. A reusable definition of an expected data-quality check. BusinessAttribute and DataField each reference zero or more rules through qualityRequirementIds. The same Required, Not null or Unique record can be reused across many attributes and fields; a Greater than zero rule stores its threshold once. Assignments reference reusable rules without duplicating their definitions.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable rule identifier, unique in the rule library and independent of translated labels or assignments. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Organisation responsible for maintaining this rule; stored inline. No parent responsibility inheritance. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact for this rule. Organisation details may be supplied independently in responsibleOrganisation. No parent responsibility inheritance. |
| `ruleType` | Rule type | — | Enum | 1 | `required`, `notNull`, `unique`, `greaterThan`, `custom`. Describes the rule semantics below; no executable rule body is stored. |
| `comparisonValue` | Comparison value | — | Decimal | 0..1 | Required only for greaterThan; forbidden for the other rule types. Zero is a valid value. Stored once on the reusable rule, with no per-assignment override. |
| `dimension` | Quality dimension | — | Enum | 1 | `completeness`, `validity`, `consistency`, `uniqueness`, `timeliness`, `accuracy`. Local classification tokens, not a standards-conformance claim. |

#### Rule semantics and examples

| Example name (EN) | ruleType | comparisonValue | Meaning |
|---|---|---|---|
| Required | `required` | Absent | The attribute/field must be provided in each instance in scope. Null handling is checked separately by Not null. |
| Not null | `notNull` | Absent | A provided value must not be null; absence is checked separately by Required. An empty string is not automatically null. |
| Unique | `unique` | Absent | Non-null values occur at most once within the owning object/table population being checked. Missing or null values require Not null/presence rules separately. Does not mean global uniqueness across systems. |
| Greater than zero | `greaterThan` | `0` | Every non-null value is numeric and strictly greater than zero. Non-numeric values fail; null handling remains separate. An explicitly non-numeric BusinessAttribute valueType is incompatible; an unknown type leaves compatibility unassessed. |
| Required for occupied buildings | `custom` | Absent | The rule description states the condition, required value and applicable population. Reuse the complete criterion; no condition is stored on an assignment or attribute. |
| At most one value | `custom` | Absent | The rule description limits the attribute to one value per business-object instance. No inline maximum-value property. |
| Monthly identifier completeness | `custom` | Absent | An explicit multilingual acceptance criterion, such as at least 99.5% completeness in a specified monthly reporting population. No automatic execution is implied. |

These are proposed reusable definitions, not new BBL policies or measured results. Create another rule record for a different threshold or meaning. A mere label change keeps identity; changing a shared rule's meaning deliberately affects every referencing attribute/field and requires impact review. Never redefine Greater than zero to mean greater than ten while leaving its name unchanged.

An assignment applies one complete rule in the owning BusinessObject/DataTable context. Reusing Unique on two fields creates independent checks, not a composite key. Custom descriptions may state conditions or cardinality limits; define their scope explicitly. Automated cross-field evaluation, execution-specific filters, per-assignment thresholds and measured results remain outside this model.

For BusinessAttribute, all validation requirements are stored on assigned QualityRequirements and resolved through those references. valueSpecification contains descriptive type/format/unit information; codeListId identifies the vocabulary and isIdentifier the identification role. Do not duplicate bounds, requiredness, conditions or cardinalities on the attribute.

DataField.sourceDataType, isRequired, isNullable and keyRoles describe documented source behavior. There is no second interpreted value specification on a field. Quality targets are separate expectations and must not overwrite that source description. Flag incompatible types, thresholds or nullability for review; a stricter business requirement can coexist with a nullable source field.

Confirmed represents mappings can show the referenced business attribute's rules on a field as derived context. Do not copy those links into the field automatically. Explicit field assignments add source-specific expectations; show each rule's origin and deduplicate only its presentation when the same rule is both inherited as context and directly assigned.

Rule assignments are audited owner edits. Changing a shared rule updates its joined definition without copying attributes or changing their status. Keep history and reject new assignments to retired rules. Check compatibility on assignment, rule edits and changes to the assigned attribute/field type. Reject malformed rule parameters and numeric rules on an explicitly non-numeric business value type. For DataField, sourceDataType remains exact text. An unknown type leaves compatibility unassessed; a documented mismatch is reported without invalidating the expectation or rewriting the source description. Neither establishes an API capability gap without a scoped assessment. A stricter expectation may coexist with the documented source behavior.

### Relationship

Derived `kind = relationship`. The table lists its complete attributes and identity. Stores an explicitly maintained, typed association between catalog definitions. The display label derives from its endpoints and the relationship type. No independent name, description, generic catalog status, owner or classification is required. Structural ownership stays in direct FKs; external documentation stays in DocumentationLink; technical data flow stays in LineageRelation. Neither operational instances nor diagram coordinates are stored here.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `source` | Source | FK (typed) | RecordReference | 1 | Must satisfy the signature table below. |
| `target` | Target | FK (typed) | RecordReference | 1 | Must resolve; cannot identify the same kind and record as source. |
| `relationshipType` | Relationship type | — | Enum | 1 | Controlled English token from the signature table below. |
| `comment` | Comment | — | Text | 0..1 | Optional, publicly readable catalog explanation, stored once without translation or language fallback. |
| `sourceEndpointId` | Source endpoint | FK (composite) | UUID → ServiceEndpoint | 0..1 | Endpoint within the source DataService. Required for assesses; optional for exposes; prohibited for all other relationship types. |
| `verificationStatus` | Verification status | — | Enum | 1 | `candidate`, `confirmed`, `rejected`, `obsolete`; defaults to candidate. This is the sole relationship review lifecycle. Rejected/obsolete records remain available in history and review tools. |
| `coverage` | Coverage | — | Enum | 0..1 | `full`, `partial`, `unknown`; required for realizes, represents, correspondsTo and exposes, absent for all other relationship types. Describes source coverage of the documented target scope; partial needs a rule note. |
| `supportStatus` | Requirement support | — | Enum | 0..1 | For assesses only: `notAssessed`, `supported`, `partial`, `missing`. Required for that type; confirmed requires a value other than notAssessed. |
| `assessedServiceVersion` | Assessed service version | — | Text | 0..1 | Exact source service release assessed for exposes/assesses; absent for other types. Required when known; never invented. Evidence must identify its documentation scope even when no release number exists. |
| `ruleNotes_de` | Rule notes (DE) | — | Text | 0..1 | German. Scope limits, semantic differences or the capability gap. At least one ruleNotes language value is required for partial/missing support or partial coverage. No executable code. |
| `ruleNotes_it` | Rule notes (IT) | — | Text | 0..1 | Italian. Scope limits, semantic differences or the capability gap. At least one ruleNotes language value is required for partial/missing support or partial coverage. No executable code. |
| `ruleNotes_fr` | Rule notes (FR) | — | Text | 0..1 | French. Scope limits, semantic differences or the capability gap. At least one ruleNotes language value is required for partial/missing support or partial coverage. No executable code. |
| `ruleNotes_en` | Rule notes (EN) | — | Text | 0..1 | English. Scope limits, semantic differences or the capability gap. At least one ruleNotes language value is required for partial/missing support or partial coverage. No executable code. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Supporting documentation for the scoped assertion. Deduplicate URL/purpose pairs; confirmation also needs the review and scope notes below. |

#### Relationship types

| Relationship type | Allowed source | Allowed target | Meaning |
|---|---|---|---|
| `realizes` | DataTable | BusinessObject | Inventory represents some or all of the business concept. |
| `represents` | DataField | BusinessAttribute | Source field carries the stated business characteristic. |
| `correspondsTo` | DataField | DataField | Documented correspondence; does not establish physical storage or processing direction. |
| `exposes` | DataService | DataTable or DataField | Service or specified endpoint exposes this inventory scope. |
| `assesses` | DataService | BusinessAttribute | Whether one endpoint supports the business requirement, including reviewed gaps. |
| `basedOn` | DataProduct | BusinessObject | Business concept included in the product contract. |
| `sourcedFrom` | DataProduct | DataTable | Documented source inventory; this association alone does not establish processing lineage. |
| `servedBy` | DataProduct | DataService | Service documented as providing the product; field/endpoint exposure needs separate evidence. |
| `measuredFor` | BusinessObject | BusinessObject | Measurement concept describes observations for the target business concept; not a link between operational instances. |

Relationship types form a closed set with fixed meanings and permitted endpoint kinds. Forward and inverse meaning belong to the type; individual assertions do not override it.

Save the canonical direction in the signature table; derive inverse labels and navigation. `correspondsTo` coverage is directional. Reverse navigation does not assert reverse coverage, business-instance multiplicity, transitive closure, a physical FK or data flow.

Source, target, relationship type and optional sourceEndpointId form an immutable scope. A scope change obsoletes the old assertion and creates a replacement only if that scope has never been recorded.

Restore a matching rejected/obsolete record explicitly, reusing its ID/history and returning it to candidate. Report an already active match instead of duplicating it. Distinct same-kind records may be connected where the signature permits.

#### Relationship examples

| Source | Type | Target | Meaning |
|---|---|---|---|
| DataProduct | `basedOn` | BusinessObject | Business concept included in an offering. |
| DataTable | `realizes` | BusinessObject | Documented technical realisation of a business concept. |
| Measurement BusinessObject | `measuredFor` | Building BusinessObject | The measurement concept describes observations for that kind of object. |

These illustrate allowed meanings, not assertions that particular records are linked. Terminology references remain DocumentationLink values. Structural ownership and code-list references remain direct relationships, without duplicate Relationship records.

#### Coverage and confirmation

Coverage is directional: full means the source satisfies the documented target scope, not that its complete physical schema or every API operation is known. Partial names the limitation; unknown records an unassessed extent. A correspondsTo assertion does not automatically establish equal coverage in reverse. Exposing a DataTable does not establish exposure of every DataField; no exposure is inferred merely from matching systems or names.

Setting verificationStatus to confirmed requires a documented basis in localized rule notes and/or documentationLinks. Notes delimit scope when a link alone is insufficient; partial/missing support always needs a gap note. This is an ordinary audited edit with no separate reviewer/date fields. Candidate assertions remain provisional; rejected/obsolete assertions are inactive.

The association types basedOn, sourcedFrom, servedBy and measuredFor omit endpoint scope, coverage, supportStatus and assessedServiceVersion. Optional rule notes explain scope; comment is a publicly readable catalog note. Update the single scoped record with ChangeEvents.

#### Service assessments

Assessments describe requirement support. A missing capability must never appear as a positive exposure edge.

For example, **Building.EGID** may be required in BusinessAttribute, while a Relationship assesses the documented building-detail endpoint as `missing`, with confirmation and source evidence. This supports a change-request report. It makes no assertion that the SAP system cannot store EGID. Absence of an assessment is unassessed; a rejected field correspondence is not proof of missing capability. Positive support requires documented response scope or field correspondence, not a similarly named response field.

Verification is maintained manually; status does not promise automated reassessment after a related definition changes. Show recorded scope and documentation with the assertion. Change-request reports include only confirmed assessments applicable to the current service scope; no system limitation changes the business definition automatically.

Keep one assessment per service/endpoint/requirement scope. assessedServiceVersion identifies the assessed release, not another identity component. Confirmation applies to the documented release and scope; a changed release requires explicit reassessment of the same assertion.

### System

Derived `kind = system`. The table lists its complete attributes and identity. A source application, register, model repository or coordinated distributed inventory.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable internal identity, separate from the public catalog identifier and source identifiers. |
| `identifier` | ID | UQ | Identifier | 1 | Stable and unique within its kind. Child identifiers distinguish records across owners. |
| `rowVersion` | Edit revision | — | Integer | 1 | Automatically maintained edit revision; initially 1 and advanced on stored changes, including owned edits. Separate from catalog definition version. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the latest app/REST edit; unknown for earlier imports. Separate from source freshness, definition version and historical dates. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the entry from normal browsing while retaining identity, references and history; independent of status/verification. |
| `createdOn` | Created | — | Date | 0..1 | Date the catalog record was created; unknown historical dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Date the catalog record last changed; not before createdOn. History and edit revision establish order. |
| `name_de` | Name (DE) | — | Text | 0..1 | German name; at least one language is required. Not an identifier. |
| `name_it` | Name (IT) | — | Text | 0..1 | Italian name; at least one language is required. Not an identifier. |
| `name_fr` | Name (FR) | — | Text | 0..1 | French name; at least one language is required. Not an identifier. |
| `name_en` | Name (EN) | — | Text | 0..1 | English name; at least one language is required. Not an identifier. |
| `description_de` | Description (DE) | — | Text | 0..1 | German. Definition; preserve documented wording. |
| `description_it` | Description (IT) | — | Text | 0..1 | Italian. Definition; preserve documented wording. |
| `description_fr` | Description (FR) | — | Text | 0..1 | French. Definition; preserve documented wording. |
| `description_en` | Description (EN) | — | Text | 0..1 | English. Definition; preserve documented wording. |
| `comment` | Comment | — | Text | 0..1 | Catalog note in its authored language; publicly readable. No translation variants, fallback or parent inheritance. |
| `documentationLinks` | More information | — | DocumentationLink[] | 0..* | Curated supporting links; deduplicate identical URL/purpose pairs. |
| `status` | Status | — | Enum | 1 | `draft`, `valid`, `retired`; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations. |
| `version` | Version | — | Text | 0..1 | Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion. |
| `versionDate` | Version date | — | Date | 0..1 | Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date. |
| `responsibleOrganisation` | Responsible organisation | — | OrganisationDetails | 0..1 | Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent. |
| `dataOwnerId` | Data owner | FK | UUID → Actor | 0..1 | Accountable person/organisation. One optional Actor; apply only the documented parent fallback. |
| `dataStewardId` | Data steward | FK | UUID → Actor | 0..1 | Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback. |
| `dataCustodianId` | Data custodian | FK | UUID → Actor | 0..1 | Maintains the technical source; may be a person or organisation. One explicit actor per role; missing means undocumented or inherited as specified below. |
| `contactActorId` | Contact | FK | UUID → Actor | 0..1 | Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback. |
| `classification` | Classification | — | Enum | 0..1 | `public`, `internal`, `confidential`, `secret`. Classification of the described information, separate from technical access. |
| `containsPersonalData` | Personal data | — | Boolean | 0..1 | Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset. |
| `systemType` | System type | — | Enum | 0..1 | `application`, `register`, `modelRepository`, `distributedSource`; omit if unreviewed. |
| `technology` | Technology | — | Text | 0..1 | Documented platform or technology name. |

Derived: DataTables and DataServices referencing this system. Websites use DocumentationLink; custodians use the direct `dataCustodianId` reference. No stored table counts.

## Reusable value types

### LocalizedTextFields

A reusable attribute-family convention, not a nested object or separate entity. For each translatable base, define these four sibling Text attributes on the owning record or value object:

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `<base>_de` | Text (DE) | — | Text | 0..1 | German text. |
| `<base>_it` | Text (IT) | — | Text | 0..1 | Italian text. |
| `<base>_fr` | Text (FR) | — | Text | 0..1 | French text. |
| `<base>_en` | Text (EN) | — | Text | 0..1 | English text. |

Each supplied value must be non-empty plain text. Per-field optionality allows missing translations; family-level constraints still apply (at least one name, a conditionally required description or rule note, or at least one change summary). Missing optional translations remain unknown. Empty strings are invalid; fallback never changes stored values.

Nested value objects use the same names: DocumentationLink has `title_de` through `title_en`, and ValueSpecification has `ruleNotes_de` through `ruleNotes_en`. These sibling fields do not introduce a nested translation-map representation.

### RecordReference

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `kind` | Type | — | Enum | 1 | `actor`, `businessAttribute`, `businessObject`, `codeList`, `codeValue`, `dataField`, `dataProduct`, `dataService`, `dataTable`, `domain`, `lineageRelation`, `productAttribute`, `qualityRequirement`, `relationship`, `system`. ChangeEvent cannot itself be a target. Owned value types are not reference targets. |
| `id` | Internal ID | — | UUID | 1 | Existing internal ID of that kind. Human-readable identifiers and labels are resolved separately. |

Typed properties such as `domainId` imply their kind and contain the target UUID. Labels never serve as references. RecordReference is a conceptual shorthand: the current REST contract exposes concrete columns such as `domain_id`, `source_data_table_id` or `record_business_object_id`, with SQL foreign keys and exactly-one-target checks. It does not accept an arbitrary `{kind, id}` payload instead of those columns. ServiceEndpoint is referenced through its explicit owner-scoped endpoint FK and is not a core RecordReference target.

### OrganisationDetails

An owned organisation/contact value, not a catalog entity or separate registry. Used by responsibleOrganisation and CodeList.authorityOrganisation. At least one of the four names is required when the value exists; missing translations and contact details remain unknown. Omit the whole optional object when no organisation is known.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `name_de` | Organisation name (DE) | — | Text | 0..1 | German. Documented organisation name. At least one name is required; never fabricate translations. |
| `name_it` | Organisation name (IT) | — | Text | 0..1 | Italian. Documented organisation name. At least one name is required; never fabricate translations. |
| `name_fr` | Organisation name (FR) | — | Text | 0..1 | French. Documented organisation name. At least one name is required; never fabricate translations. |
| `name_en` | Organisation name (EN) | — | Text | 0..1 | English. Documented organisation name. At least one name is required; never fabricate translations. |
| `websiteUrl` | Website | — | HttpUrl | 0..1 | Documented organisation website or relevant contact page. |

Organisation details are deliberately repeated across entries when needed, so each entry can maintain its documented organisation independently. This permits updates without registering external contacts. Do not silently unify two entries because their organisation labels match. If a registry becomes necessary later, it requires a separate model decision.

### DocumentationLink

An owned link value on entities that declare `documentationLinks`.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `url` | URL | — | HttpUrl | 1 | Documentation destination with validated scheme. |
| `title_de` | Title (DE) | — | Text | 0..1 | German. Link text; fall back to the URL when no title resolves. |
| `title_it` | Title (IT) | — | Text | 0..1 | Italian. Link text; fall back to the URL when no title resolves. |
| `title_fr` | Title (FR) | — | Text | 0..1 | French. Link text; fall back to the URL when no title resolves. |
| `title_en` | Title (EN) | — | Text | 0..1 | English. Link text; fall back to the URL when no title resolves. |
| `purpose` | Purpose | — | Enum | 1 | `documentation`, `definition`, `standard`, `terminology`, `license`, `access`. |
| `language` | Language | — | LanguageTag | 0..1 | Destination language, independent of the link-title language. |
| `externalIdentifier` | External ID | — | Text | 0..1 | Official terminology, standard or document identifier. |

Several links are supported. A link alone is not evidence that every assertion on the linked page was reviewed.

### ValueSpecification

Describes business values and product-contract values. The containing entity determines the allowed properties. For BusinessAttribute, allow only valueType, format, unit, geometryType and coordinateReferenceSystem as descriptive metadata; validation requirements come from referenced QualityRequirements. ProductAttribute may retain documented contract bounds and rule notes. DataField uses sourceDataType and assigned QualityRequirements instead of this value. This value never establishes a physical schema by itself.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `valueType` | Value type | — | Enum | 1 | `text`, `identifier`, `integer`, `decimal`, `boolean`, `date`, `dateTime`, `year`, `code`, `geometry`, `structured`. |
| `format` | Format | — | Text | 0..1 | Reviewed representation or official identifier format. No invented storage length. |
| `minimumLength` | Minimum length | — | Integer | 0..1 | At least zero; applies to text/code/identifier values. Count Unicode code points, not bytes. |
| `maximumLength` | Maximum length | — | Integer | 0..1 | Non-negative; at least the minimum when both exist. A source byte limit is a separately documented constraint. |
| `minimumValue` | Minimum value | — | Decimal | 0..1 | Inclusive lower numeric bound. |
| `maximumValue` | Maximum value | — | Decimal | 0..1 | Inclusive upper numeric bound, not below the minimum. |
| `precision` | Precision | — | Integer | 0..1 | Positive total decimal digits when defined by the applicable specification. |
| `scale` | Scale | — | Integer | 0..1 | Documented decimal scale. Negative values or a scale greater than precision are allowed when the source specification supports them. |
| `unit` | Unit | — | Text | 0..1 | Defined unit identifier or symbol. A measurement's unit is a business value, not its field's storage type. |
| `geometryType` | Geometry type | — | Text | 0..1 | Documented geometric form, independent of transport/file format. |
| `coordinateReferenceSystem` | Coordinate reference system | — | Text | 0..1 | Authority-qualified reference system where established. |
| `ruleNotes_de` | Rule notes (DE) | — | Text | 0..1 | German. Conditional, composite-identifier, uniqueness or other rules beyond the simple bounds. |
| `ruleNotes_it` | Rule notes (IT) | — | Text | 0..1 | Italian. Conditional, composite-identifier, uniqueness or other rules beyond the simple bounds. |
| `ruleNotes_fr` | Rule notes (FR) | — | Text | 0..1 | French. Conditional, composite-identifier, uniqueness or other rules beyond the simple bounds. |
| `ruleNotes_en` | Rule notes (EN) | — | Text | 0..1 | English. Conditional, composite-identifier, uniqueness or other rules beyond the simple bounds. |

Only applicable constraints may be supplied: numeric bounds for numbers, geometric constraints for geometry, and so on. A year remains a year; do not fabricate month/day. Requiredness, nullability and multiplicity are represented only where the containing entity dictionary declares them; absence of a counterpart implies no constraint. Preserve unsupported product constraints in explanatory rule notes. Field source declarations remain in sourceDataType and linked documentation. Precision and scale follow the documented specification; they do not establish a physical schema.

### ServiceEndpoint

An owned technical interface record describing documented capabilities. Its separate persistence/API identity supports stable references and edits; it remains owned by one DataService and is not a seventeenth core entity.

| Attribute | Alias (EN) | Key | Format | Cardinality | Constraints and description |
|---|---|---|---|---|---|
| `id` | Internal ID | PK | UUID | 1 | Immutable endpoint identity. |
| `identifier` | ID | UQ (composite) | Identifier | 1 | Stable and unique within the owning DataService. |
| `dataServiceId` | Data service | FK | UUID → DataService | 1 | Required, immutable owner. Assertion endpoint references must agree with this service. |
| `rowVersion` | Edit revision | — | Integer | 1 | Server-maintained positive revision, initially 1. An endpoint edit also advances the service revision. |
| `createdOn` | Created | — | Date | 0..1 | Catalog creation date; unknown legacy dates remain unknown. |
| `modifiedOn` | Last modified | — | Date | 0..1 | Catalog modification date, not source freshness. |
| `editedAt` | Last edit timestamp | — | Timestamp | 0..1 | Server time of the app/REST edit; may be unknown for older records. |
| `isArchived` | Archived | — | Boolean | 1 | Defaults to false. Hides the endpoint from the normal endpoint list without deleting its identity or references. |
| `sortOrder` | Row order | — | Integer | 1 | Display order within the service, from 0 through 2147483647 (SQL integer); default 0. Ties are permitted. |
| `url` | URL | — | HttpUrl | 0..1 | Documented base or operation URL; unknown hosts are not invented. |
| `relativePath` | Relative path | — | Text | 0..1 | Documented path where the base is unavailable or separately specified. |
| `protocol` | Protocol | — | Text | 0..1 | Official protocol name/version, such as `SOAP`, `REST`, `WMS`, `WFS`. |
| `httpMethod` | HTTP method | — | Enum | 0..1 | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`. |
| `operationName` | Operation name | — | Text | 0..1 | Exact operation identifier, never translated. |
| `environment` | Environment | — | Enum | 0..1 | `production`, `test`, `development`, only when documented. |
| `isReadOnly` | Read-only | — | Boolean | 0..1 | Documented behaviour, not inferred from the operation label. |
| `supportsBulk` | Bulk access supported | — | Boolean | 0..1 | Explicit bulk capability; not inferred from pagination or a sample response. |
| `authenticationMethods` | Authentication methods | — | Text[] | 0..* | Documented mechanism names. No passwords, tokens or private credentials. |
| `verificationStatus` | Verification status | — | Enum | 1 | `notChecked`, `metadataChecked`, `sampleChecked`, `accessDenied`, `failed`; defaults to notChecked. Editors must document the operation-scoped result. The current command validates the token and creates generic history; it does not require or verify a custom test report. |

An endpoint belongs to one DataService and has a stable identifier within that service. At least one of URL, relative path or operation name is known. Supporting links belong to the DataService; their title or the check summary identifies the operation. Referenced endpoints remain available for their assertion history.

Request/response inventories are not automatically physical DataFields.

## Physical schema and constraints

### Reviewed schema baseline

The seven migrations in [supabase/migrations](../supabase/migrations/), ending with `20260912010000_catalog_rest_crud.sql`, define **19 public `catalog` tables, 472 columns and 83 foreign-key constraints**. The 16 core entities occupy 16 tables; ServiceEndpoint and the two quality-assignment junctions account for the remaining three. All 472 columns are covered by the entity/value dictionaries and the explicit reference/collection mappings below. The generated API contract was checked against an isolated database built from those migrations on 12 September 2026.

These counts describe the repository schema. They do not establish which migrations are deployed, how many catalog entries exist, or whether the source inventories are complete. Authentication, access policies, command receipts, import markers and private user attribution are operational storage outside the public catalog model; their implementation belongs to the [database guide](../supabase/README.md) and [write contract](data-model-implementation.md#transactional-write-contract).

| Dictionary / collection | SQL table | Columns |
|---|---|---:|
| [Actor](#actor) | `actor` | 18 |
| [BusinessAttribute](#businessattribute) | `business_attribute` | 32 |
| BusinessAttribute.qualityRequirementIds | `business_attribute_quality_requirement` | 2 |
| [BusinessObject](#businessobject) | `business_object` | 28 |
| [ChangeEvent](#changeevent) | `change_event` | 33 |
| [CodeList](#codelist) | `code_list` | 24 |
| [CodeValue](#codevalue) | `code_value` | 25 |
| [DataField](#datafield) | `data_field` | 39 |
| DataField.qualityRequirementIds | `data_field_quality_requirement` | 2 |
| [DataProduct](#dataproduct) | `data_product` | 34 |
| [DataService](#dataservice) | `data_service` | 35 |
| [DataTable](#datatable) | `data_table` | 32 |
| [Domain](#domain) | `domain` | 25 |
| [LineageRelation](#lineagerelation) | `lineage_relation` | 18 |
| [ProductAttribute](#productattribute) | `product_attribute` | 23 |
| [QualityRequirement](#qualityrequirement) | `quality_requirement` | 25 |
| [Relationship](#relationship) | `relationship` | 29 |
| [ServiceEndpoint](#serviceendpoint) | `service_endpoint` | 19 |
| [System](#system) | `system` | 29 |
| **Total** | **19 tables** | **472** |

### Dictionary-to-storage mapping

A dictionary describes persisted values, not the required keys of a create request. The server supplies defaults and maintained fields where documented. Core UUIDs and `rowVersion` remain required on persisted records even when a caller does not submit them on creation.

- Ordinary attributes map to one snake_case column: `businessObjectId` becomes `business_object_id`, and `shortName_fr` becomes `short_name_fr`. Enum values retain their documented case. SQL FK columns contain UUIDs, not public identifiers or display labels.
- OrganisationDetails and ValueSpecification are validated JSONB objects. DocumentationLink collections are JSONB arrays. Their nested keys stay exactly as written in their dictionaries; they do not become snake_case or additional SQL columns. Unknown optional nested keys are omitted; unknown top-level optional values use SQL NULL.
- Ordinary `0..*` collections are non-null empty arrays when no members are recorded. Cardinality counts members, not SQL nullability. DataField.keyRoles is the explicit exception: SQL NULL means unknown, `[]` means reviewed with no key role. Null array members and duplicate members are rejected; documentation links are unique by URL/purpose.
- `DataService.endpoints` is the inverse collection of ServiceEndpoint rows selected by `data_service_id`, not a column or a second copy of endpoint JSON. Owned rows retain their own UUIDs, revisions, ordering and archive flags.
- `qualityRequirementIds` on BusinessAttribute/DataField is the collection stored in the corresponding junction, not a SQL array column. The REST write/read-result collection is a projection over that store.
- Relationship.source/target, LineageRelation.source/target and ChangeEvent.record expand into concrete nullable FK columns. Exactly one FK in each required group must be set; each permitted kind below creates a column named `<group>_<snake_case_kind>_id`. A named FK such as `sourceEndpointId` stays a separate column with its own scope checks.

| Conceptual reference group | Permitted concrete FK targets |
|---|---|
| Relationship.source | BusinessObject, DataProduct, DataTable, DataField, DataService |
| Relationship.target | BusinessObject, BusinessAttribute, DataTable, DataField, DataService |
| LineageRelation.source / target | DataTable, DataField; both ends must be the same kind |
| ChangeEvent.record | All 15 [RecordReference kinds](#recordreference); never ChangeEvent or ServiceEndpoint |

The [relationship signatures](#relationship-types) further restrict combinations; the table above does not permit arbitrary pairs. Endpoint history targets the owning DataService and identifies the endpoint in the snapshot. `ChangeEvent.actorId` identifies an optional recorded editor; `record_actor_id` instead means that an Actor record was edited.

### Quality-assignment junctions

Both tables implement reference collections rather than additional catalog entities. Each row consists of exactly the two required UUIDs below; together they are the primary key. There is no assignment ID, revision, status, threshold or per-assignment override. Assignment changes through app/REST commands revise and audit their attribute/field owner, with the [browser Required limitation](#known-gaps-and-deferred-work) noted above. Removing an assignment unlinks the pair while retaining the shared rule and the recorded history; it is not archival of the rule.

| SQL table | Column | Key / required reference |
|---|---|---|
| `business_attribute_quality_requirement` | `business_attribute_id` | PK member, FK to BusinessAttribute.id, required |
| `business_attribute_quality_requirement` | `quality_requirement_id` | PK member, FK to QualityRequirement.id, required |
| `data_field_quality_requirement` | `data_field_id` | PK member, FK to DataField.id, required |
| `data_field_quality_requirement` | `quality_requirement_id` | PK member, FK to QualityRequirement.id, required |

### Physical ER review diagram

The diagram includes all 19 public tables and every foreign-key column. Lines emphasize structural ownership and selected connections; role and typed-reference columns identify their targets inside the tables. Two quality junctions and the owned service_endpoint table implement collections without adding catalog entities. Mutable records also have `is_archived` and `edited_at`; the five owned row tables have `sort_order`. These repeated fields are omitted from the diagram but included in the [complete dictionaries](#entity-definitions). Use the dictionaries and reference-expansion rules above for completeness; the diagram intentionally omits repeated non-key attributes.

<details>
<summary>Expand the ER diagram — 19 tables, including owned and junction tables</summary>

```mermaid
erDiagram
    direction TB
    actor {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text actor_type
    }
    business_attribute {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid data_owner_id FK "NULL; actor.id"
        uuid data_steward_id FK "NULL; actor.id"
        uuid contact_actor_id FK "NULL; actor.id"
        uuid business_object_id FK, UK "business_object.id; U1"
        text semantic_name UK "U1"
        jsonb value_specification "NULL"
        boolean is_identifier "NULL"
        uuid code_list_id FK "NULL; code_list.id"
    }
    business_object {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid data_owner_id FK "NULL; actor.id"
        uuid data_steward_id FK "NULL; actor.id"
        uuid contact_actor_id FK "NULL; actor.id"
        uuid domain_id FK "domain.id"
    }
    change_event {
        uuid id PK
        text identifier UK
        uuid record_actor_id FK "NULL; actor.id"
        uuid record_business_attribute_id FK "NULL; business_attribute.id"
        uuid record_business_object_id FK "NULL; business_object.id"
        uuid record_code_list_id FK "NULL; code_list.id"
        uuid record_code_value_id FK "NULL; code_value.id"
        uuid record_data_field_id FK "NULL; data_field.id"
        uuid record_data_product_id FK "NULL; data_product.id"
        uuid record_data_service_id FK "NULL; data_service.id"
        uuid record_data_table_id FK "NULL; data_table.id"
        uuid record_domain_id FK "NULL; domain.id"
        uuid record_lineage_relation_id FK "NULL; lineage_relation.id"
        uuid record_relationship_id FK "NULL; relationship.id"
        uuid record_product_attribute_id FK "NULL; product_attribute.id"
        uuid record_quality_requirement_id FK "NULL; quality_requirement.id"
        uuid record_system_id FK "NULL; system.id"
        date occurred_on
        timestamptz occurred_at "NULL"
        text action
        uuid actor_id FK "NULL; actor.id"
        jsonb before "NULL"
        jsonb after "NULL"
        text import_id "NULL"
    }
    code_list {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        uuid domain_id FK "NULL; domain.id"
        uuid business_object_id FK "NULL; business_object.id"
        jsonb authority_organisation "NULL"
    }
    code_value {
        uuid id PK, UK "U2"
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        uuid code_list_id FK, UK "code_list.id; U1/U2"
        text code UK "U1"
        uuid parent_code_value_id FK "NULL; code_value.id"
    }
    data_field {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid data_owner_id FK "NULL; actor.id"
        uuid data_steward_id FK "NULL; actor.id"
        uuid data_custodian_id FK "NULL; actor.id"
        uuid contact_actor_id FK "NULL; actor.id"
        uuid data_table_id FK "data_table.id"
        text technical_name
        text technical_name_kind
        text source_path "NULL"
        text source_data_type "NULL"
        text data_type_scope "NULL"
        boolean is_required "NULL"
        boolean is_nullable "NULL"
        text[] key_roles "NULL; source keys"
        uuid code_list_id FK "NULL; code_list.id"
    }
    data_product {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid data_owner_id FK "NULL; actor.id"
        uuid data_steward_id FK "NULL; actor.id"
        uuid contact_actor_id FK "NULL; actor.id"
        uuid domain_id FK "NULL; domain.id"
        text access_mode "NULL"
        text access_notes "NULL; one authored value"
        text license_uri "NULL"
        text license_notes "NULL; one authored value"
    }
    data_service {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid data_owner_id FK "NULL; actor.id"
        uuid data_steward_id FK "NULL; actor.id"
        uuid data_custodian_id FK "NULL; actor.id"
        uuid contact_actor_id FK "NULL; actor.id"
        uuid system_id FK "NULL; system.id"
        uuid domain_id FK "NULL; domain.id"
        text technical_name "NULL"
        text service_version "NULL"
        text purpose "NULL"
        text access_mode "NULL"
        text access_notes "NULL; one authored value"
    }
    data_table {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid data_owner_id FK "NULL; actor.id"
        uuid data_steward_id FK "NULL; actor.id"
        uuid data_custodian_id FK "NULL; actor.id"
        uuid contact_actor_id FK "NULL; actor.id"
        uuid system_id FK "system.id"
        uuid domain_id FK "NULL; domain.id"
        text technical_name "NULL"
        text database_name "NULL"
        text schema_name "NULL"
    }
    domain {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid data_owner_id FK "NULL; actor.id"
        uuid data_steward_id FK "NULL; actor.id"
        uuid contact_actor_id FK "NULL; actor.id"
        uuid parent_domain_id FK "NULL; domain.id"
    }
    lineage_relation {
        uuid id PK
        text identifier UK
        bigint row_version
        uuid source_data_table_id FK "NULL; data_table.id"
        uuid source_data_field_id FK "NULL; data_field.id"
        uuid target_data_table_id FK "NULL; data_table.id"
        uuid target_data_field_id FK "NULL; data_field.id"
        text operation
        text transformation_notes_de "NULL; also _it _fr _en"
        text verification_status
        jsonb documentation_links "supporting links"
    }
    product_attribute {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        uuid data_product_id FK, UK "data_product.id; U1"
        text semantic_name UK "U1"
        uuid business_attribute_id FK "NULL; business_attribute.id"
        jsonb value_specification "NULL"
        boolean is_required "NULL"
    }
    quality_requirement {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid contact_actor_id FK "NULL; actor.id"
        text rule_type
        numeric comparison_value "NULL; greaterThan only"
        text dimension
    }
    relationship {
        uuid id PK
        text identifier UK
        bigint row_version
        uuid source_business_object_id FK "NULL; business_object.id"
        uuid source_data_product_id FK "NULL; data_product.id"
        uuid source_data_table_id FK "NULL; data_table.id"
        uuid source_data_field_id FK "NULL; data_field.id"
        uuid source_data_service_id FK "NULL; data_service.id"
        uuid target_business_object_id FK "NULL; business_object.id"
        uuid target_business_attribute_id FK "NULL; business_attribute.id"
        uuid target_data_table_id FK "NULL; data_table.id"
        uuid target_data_field_id FK "NULL; data_field.id"
        uuid target_data_service_id FK "NULL; data_service.id"
        text relationship_type
        text comment "NULL"
        uuid source_endpoint_id FK "NULL; service_endpoint.id"
        text verification_status
        text coverage "NULL"
        text support_status "NULL"
        text assessed_service_version "NULL"
        text rule_notes_de "NULL; also _it _fr _en"
        jsonb documentation_links "supporting links"
    }
    system {
        uuid id PK
        text identifier UK
        bigint row_version
        text name_de "NULL"
        text name_it "NULL"
        text name_fr "NULL"
        text name_en "NULL"
        text description_de "NULL; also _it _fr _en"
        text comment "NULL"
        text status
        text version "NULL; catalog definition"
        date version_date "NULL; date of version"
        jsonb responsible_organisation "NULL; inline; no FK"
        uuid data_owner_id FK "NULL; actor.id"
        uuid data_steward_id FK "NULL; actor.id"
        uuid data_custodian_id FK "NULL; actor.id"
        uuid contact_actor_id FK "NULL; actor.id"
        text system_type "NULL"
        text technology "NULL"
    }
    service_endpoint {
        uuid id PK, UK "U2"
        uuid data_service_id FK, UK "data_service.id; U1/U2"
        text identifier UK "U1"
        text url "NULL"
        text relative_path "NULL"
        text protocol "NULL"
        text http_method "NULL"
        text operation_name "NULL"
        text environment "NULL"
        text verification_status
    }
    business_attribute_quality_requirement {
        uuid business_attribute_id PK, FK "business_attribute.id"
        uuid quality_requirement_id PK, FK "quality_requirement.id"
    }
    data_field_quality_requirement {
        uuid data_field_id PK, FK "data_field.id"
        uuid quality_requirement_id PK, FK "quality_requirement.id"
    }

    domain o|..o{ domain : parent
    domain ||..o{ business_object : groups
    domain o|..o{ data_table : classifies
    domain o|..o{ code_list : classifies
    domain o|..o{ data_product : classifies
    domain o|..o{ data_service : classifies
    business_object ||..o{ business_attribute : defines
    system ||..o{ data_table : contains
    system o|..o{ data_service : provides
    data_table ||..o{ data_field : describes
    code_list ||..o{ code_value : contains
    code_value o|..o{ code_value : parent_in_same_list
    code_list o|..o{ business_attribute : constrains
    code_list o|..o{ data_field : constrains
    data_product ||..o{ product_attribute : promises
    business_attribute o|..o{ product_attribute : reuses
    data_service ||..o{ service_endpoint : owns
    service_endpoint o|..o{ relationship : scopes_service_source
    data_product o|..o{ relationship : source_product
    business_object o|..o{ relationship : target_concept
    actor o|..o{ change_event : edited_by
    business_attribute ||--o{ business_attribute_quality_requirement : assigns
    quality_requirement ||--o{ business_attribute_quality_requirement : referenced_by
    data_field ||--o{ data_field_quality_requirement : assigns
    quality_requirement ||--o{ data_field_quality_requirement : referenced_by
```

</details>

### Key and constraint review

| Structure | Required constraint |
|---|---|
| Version/date pair | version_date requires version. New or changed versions require a date through the write contract; unknown legacy version dates remain allowed. Neither modifiedOn nor an import time substitutes for the version date. |
| Core identity | Each core table has id as UUID PK and identifier as a separate unique public identity. Every mutable record has row_version; ChangeEvent is append-only. |
| BusinessAttribute U1 | Unique (business_object_id, semantic_name). |
| ProductAttribute U1 | Unique (data_product_id, semantic_name). |
| CodeValue U1 / U2 | Unique (code_list_id, code) and (code_list_id, id). Composite parent FK (code_list_id, parent_code_value_id) references the same CodeList using MATCH SIMPLE, allowing a null parent. Retain the ordinary code_list_id FK for roots. |
| ServiceEndpoint U1 / U2 | Unique (data_service_id, identifier) and (data_service_id, id). Relationship's (source_data_service_id, source_endpoint_id) FK uses MATCH SIMPLE; separate signature checks enforce required/allowed endpoint scope. Keep the standalone DataService FK when the endpoint is absent. |
| Two quality junctions | Each two-column PK consists of two FKs. No assignment identifier or duplicate writable JSONB reference array. |
| Relationship | Exactly one source and one target; allowed signatures, coverage and endpoint scope follow its dictionary. One assertion per type, endpoints and optional endpoint scope, enforced with signature-specific uniqueness including absent scope. |
| LineageRelation | Exactly one source and target of the same technical kind, with distinct UUIDs and unique directed pairs. Endpoints alone do not prove flow. |
| ChangeEvent | Exactly one of the 15 record_* target FKs. Optional actor_id records a catalog Actor attribution; record_actor_id means an Actor was edited. Current command user attribution is private. Snapshot contents follow the [command-specific audit formats](data-model-implementation.md#audit-snapshots-and-event-grouping). |
| QualityRequirement | comparison_value is required only for greaterThan; zero is valid. Rule assignments and changes validate compatibility transactionally; joined users read the current rule without copied requirements. |
| Ownership and links | Actor role FKs are optional where documented; external organisations require no Actor. Organisation values and documentationLinks use owned JSONB; Actor keeps only websiteUrl for contact navigation. |
| Cycles and retention | Domain and CodeValue hierarchies reject cycles transactionally. Referenced records and audit targets are retained; deleting referenced endpoints is restricted. |

Technical names and source key_roles are metadata about a source, never catalog PKs. Table/field technical-name uniqueness needs known source namespace/scope and must not merge separately documented draft structures. The [PostgreSQL implementation acceptance cases](data-model-implementation.md#postgresql-implementation-acceptance-cases) cover the behavior that diagram syntax alone cannot validate.

### Constraint and serialization contract

Use UTF8 storage and exact, case-sensitive comparison for catalog identifiers, semantic names and official code strings. Choose deterministic `COLLATE "C"` for these identity/uniqueness columns; never lowercase, unaccent or Unicode-normalize them when matching references. User-facing names use the requested locale's collation separately. Provider/locale names must be pinned and verified in the deployed database. PostgreSQL permits collation choices independently of the database default; see [collation support](https://www.postgresql.org/docs/18/collation.html).

| Boundary | Required behavior |
|---|---|
| Required/conditional values | Apply NOT NULL to required scalars and explicit row checks to enum/conditional requirements. A positive-value check alone does not reject NULL. Require the family-level name/description rules, not a name in every language. |
| Owned JSONB | Validate shape, types, allowed keys, enum values, bounds, language suffixes and owner-local identifiers. Reject unknown canonical keys rather than silently losing them. Keep unmodeled upstream properties in the external import archive. An optional absent object uses SQL NULL; collection arrays may be empty only when their minimum cardinality is zero. Reject null array members. |
| Optional owned properties | Omit unknown scalar keys inside JSONB. Replace an owned object without an optional key to clear that nested property; top-level null clears an optional column. Do not persist JSON null as a substitute for an unknown canonical value. Original import captures may retain upstream nulls. |
| Integer | JSON integer within the documented safe range; tighter domain bounds still apply. Keep rowVersion positive. Converting a bigint to a JavaScript Number must never silently round it. |
| Decimal | Owned JSONB Decimal values require canonical decimal strings under their SQL validator. Scalar comparison_value accepts finite JSON numbers or numeric strings through REST; send a decimal string to preserve precision. The snapshot returns comparison values as strings, while ordinary REST reads return PostgreSQL numeric JSON tokens. Use a decimal-aware client for those reads; no NaN or infinity. |
| Decimal storage | Scalar Decimal properties use finite numeric columns; Decimal properties inside JSONB stay strings and are validated/cast as exact numerics for comparisons. Do not run either representation through binary floating point. Original source number tokens remain in their capture. |
| Constraints on other rows | Use native FK/unique constraints for identity and ownership, plus transactional checks for hierarchy cycles, current rule state and applicable assertion scope. These are not safe as CHECK functions querying other tables. |

The canonical Decimal text `"0"` becomes numeric zero in SQL; a missing comparisonValue stays SQL NULL. The rule examples' unquoted zero describes the mathematical value. PostgreSQL offers exact numeric storage but also special numeric values, which this contract excludes; see [numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html). Row checks must treat unknown explicitly and native constraints should express relational invariants; see [constraint behavior](https://www.postgresql.org/docs/18/ddl-constraints.html). The UTF8 text boundary also excludes the zero character; see [character types](https://www.postgresql.org/docs/18/datatype-character.html).

### Numeric source declarations

PostgreSQL permits negative scales and scales above precision; see its [numeric type rules](https://www.postgresql.org/docs/18/datatype-numeric.html#DATATYPE-NUMERIC-DECIMAL). Such declarations describe source rounding/representation and do not change this catalog's exact Decimal transport format.

## Standards alignment

### Recommended profile and boundaries

Use DCMI for reusable metadata and SKOS for vocabularies. DCAT 3 guides DataService and the optional publication extension. DCTAP can describe a future exchange profile. DMBOK and architecture frameworks guide scope and responsibility; they do not dictate additional entities. These are proposed mappings, not current conformance claims.

| Reference | Use here | Boundary |
|---|---|---|
| [DCAT 3](https://www.w3.org/TR/vocab-dcat-3/) | DataService and optional Catalog/Dataset/Distribution publication. | Business definitions and schema inventories are not automatically datasets. |
| [DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) | Identifiers, names, descriptions, dates, agents and rights. | Preserve the subject of each assertion; metadata-edit dates are not data freshness. |
| [SKOS Reference](https://www.w3.org/TR/skos-reference/) | Domain themes, code schemes, codes and multilingual terminology. | Does not define database constraints or business cardinalities. |
| [W3C DQV](https://www.w3.org/TR/vocab-dqv/) | Distinguishes quality dimensions, metrics and observed measurements. | Our QualityRequirement is a local acceptance criterion, not a QualityMeasurement; no measurement engine is included. |
| [OpenLineage object model](https://openlineage.io/docs/spec/object-model/) | Future import guidance for dataset dependencies through jobs/runs. | LineageRelation stores a reviewed dependency projection, not the complete event model or an executed run. |
| [DCTAP](https://www.dublincore.org/specifications/dctap/) | Later tabular exchange-profile constraints. | Not a domain vocabulary or database schema. |
| [DAMA-DMBOK](https://dama.org/learning-resources/dama-data-management-body-of-knowledge-dmbok/) | Explicit accountability, metadata, evidence and reference-data management. | Advisory guidance, not entity equivalence or a conformance claim. |
| [ArchiMate introduction](https://archimate-community.pages.opengroup.org/workgroups/archimate-101/) / [TOGAF overview](https://www.opengroup.org/togaf) | Separate business meaning, application structures and technical realization. | Interpretive correspondence; no architecture interchange or extra process/capability entities. |

### Class and metadata correspondence

| Local record or property | Proposed exchange treatment | Constraint |
|---|---|---|
| DataService | `dcat:DataService` | Describes data access, not all APIs regardless of purpose. |
| DataService endpoint URL / `endpointDescriptionUrls` | `dcat:endpointURL` / `dcat:endpointDescription` | Resolve documented URLs only; human help pages are not machine-readable interface descriptions. |
| DataService `serviceVersion` | `dcat:version` | Source release, not catalog editorial version. |
| Actor | `dcterms:Agent` | No automatic publisher/contact role is inferred from ownership. |
| CodeList | `skos:ConceptScheme` | Each separately retained vocabulary has its own identity; version dates are catalog metadata. |
| CodeValue | `skos:Concept`, `skos:notation`, `skos:inScheme` | Preserve exact codes and owning CodeList. |
| Domain | `skos:Concept` in an agreed theme scheme | No invented scheme URI. |
| BusinessObject | Optional glossary `skos:Concept` projection | Describes a business type, not an individual building; no automatic OWL class semantics. |
| DataTable / DataField | Local schema descriptions | Not automatically a dataset or distribution. |
| BusinessAttribute / ProductAttribute | Local definitions | Preserve semantic scope and requirements. |
| DataProduct | Local offering/contract | No automatic equivalence to DCAT Dataset or ArchiMate Product. |
| Relationship | Local typed association, correspondence or requirement-support assessment | Review each type before standards export; no automatic `owl:sameAs`, `skos:exactMatch` or processing-lineage assertion. |
| LineageRelation | Local technical dependency | OpenLineage alignment concerns dependencies; jobs/runs remain outside the core model. No complete interchange claim. |
| QualityRequirement | Local reusable rule definition | Keep required quality separate from measured scores and observations. |
| DocumentationLink / ChangeEvent | Supporting links / audit records | No structured provenance entity or qualified PROV export in this model. |
| `identifier` | `dcterms:identifier` | Exact stable identifier; publication subject URIs require a separate approved export namespace. |
| `name_<language>` / `description_<language>` | `dcterms:title` / `dcterms:description` | Populated suffixes become language-tagged literals; concepts instead use `skos:prefLabel` / `skos:definition`. |
| CodeValue `shortName_<language>` | `skos:altLabel` | Distinct from that language's preferred label; no duplicate preferred labels per language. |
| `parentCodeValueId` / `parentDomainId` | `skos:broader` | Reviewed hierarchy only; no invented selectable parents from headings. |
| `createdOn` / `modifiedOn` | Metadata history dates | Never export as release or modification dates of the underlying data. |
| Product formats, licence and cadence | Local product contract | Review the subject before mapping to publication format, licence or update-frequency terms. |
| Direct responsibility fields, status, comments and sensitivity | Local governance metadata | Export only under an explicit exposure/role policy. A data owner is not automatically a publisher or public contact. |

For example, Building, a documented SAP table, a published building collection, a file representation and its access API describe different subjects. A source field named EGID does not by itself prove a business-attribute mapping. A building-to-parcel association is not a SKOS hierarchy. A reviewed application data structure may correspond to an ArchiMate Data Object and an application System to an Application Component; a distributed inventory need not be an application component.

The extension below is a deferred model proposal; it adds no required core entities or empty records to the current baseline. [Publication acceptance](data-model-implementation.md#publication-acceptance) describes the later implementation checks.

### Optional publication extension

The core catalog can work without these three entities. Introduce them only when publishing to a selected DCAT consumer or managing independently identifiable collections and representations. Standards alignment does not require every standard class to become an internal table.

| Deferred concept | Introduce when | Minimum information to define then |
|---|---|---|
| Catalog (`dcat:Catalog`) | A catalog publication needs managed identity, membership and publisher metadata. A single deployment may initially use an export configuration. | Stable publication URI, four-language titles/descriptions, explicit publisher organisation, metadata licence, homepage, theme scheme and selected resource membership. |
| Dataset (`dcat:Dataset`) | A data collection has its own release, coverage or access identity beyond a product contract/table description. | Stable identity, four-language names/descriptions, domains, schema-table links, publisher, language/coverage, release/version/cadence and information/access page. |
| Distribution (`dcat:Distribution`) | One collection has a documented accessible representation, such as a downloadable file or service access. | Owning dataset, access URL, optional direct download URL/service references, format, licence and usage terms; size only when meaningful. |

Dataset-to-Distribution ownership, product-to-dataset membership and service-to-dataset links would be added together with their validation. Confirm the exact exchange profile first; these are deferred concepts, not incomplete core records requiring empty rows now. Do not automatically create a dataset for every table or product. Keep product commitments on DataProduct; move representation-specific assertions only when their subject has been reviewed, preserving original evidence.

A WMS image does not establish downloadable parcel polygons. The application's Excel export publishes catalog metadata, not the operational data described by each entry. Publication URIs, dataset release dates, spatial/temporal coverage and licence terms must be documented before export; no production namespace or URL is invented.

## References

- [W3C DCAT 3](https://www.w3.org/TR/vocab-dcat-3/) — catalog, dataset, distribution and service vocabulary; [namespace](https://www.w3.org/ns/dcat).
- [DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) — shared metadata properties; [DCMI specifications index](https://www.dublincore.org/specifications/).
- [W3C SKOS Reference](https://www.w3.org/TR/skos-reference/) — terminology and controlled vocabularies.
- [W3C Data Quality Vocabulary](https://www.w3.org/TR/vocab-dqv/) — quality dimensions, metrics and measurements; local requirements remain distinct.
- [OpenLineage object model](https://openlineage.io/docs/spec/object-model/) — future lineage ingestion concepts and execution-model boundary.
- [DCTAP](https://www.dublincore.org/specifications/dctap/) and [Elements](https://www.dublincore.org/specifications/dctap/elements/) — tabular application-profile structure.
- [DAMA-DMBOK](https://dama.org/learning-resources/dama-data-management-body-of-knowledge-dmbok/) — data-management guidance.
- [ArchiMate community introduction](https://archimate-community.pages.opengroup.org/workgroups/archimate-101/) and [TOGAF overview](https://www.opengroup.org/togaf) — architecture concepts and methodology; interpretive use only.
- [BCP 47 language tags](https://www.w3.org/International/articles/language-tags/), [RFC 3339 timestamps](https://www.rfc-editor.org/rfc/rfc3339) and [Mermaid ER notation](https://mermaid.js.org/syntax/entityRelationshipDiagram.html) — formats and diagram notation.

- [Implementation guide](data-model-implementation.md) — persistence, presentation, migration and validation.
- [Business-object attribute proposal](business-object-attribute-proposal.md) — separate proposed business content.
- [Documentation index](README.md) — the maintained guide set.
