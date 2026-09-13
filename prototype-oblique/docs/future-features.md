# Future features

**Updated: 13 September 2026.** Proposed extensions for discussion and planning; no delivery order or dates agreed. The [canonical data model](data-model.md) remains authoritative for the current schema. Model changes belong there before implementation.

## Wiki and additional information

Add editable pages for explanations, guidance, examples and background information. Authors can link directly to catalog objects, attributes, tables, fields and other entries. Catalog profiles should also show related wiki pages. Use stable links and page history, and keep structured definitions in the catalog rather than duplicating them in prose.

**Starting point:** the catalog already supports documentation links; a wiki and backlinks are new features.

## LLM-powered search

Let users ask questions in natural language and receive answers grounded in catalog definitions and wiki content. Answers should link to their sources, respect the selected search scope and content permissions, and say when information is missing or uncertain. Keep ordinary search available alongside questions.

**Starting point:** the frontend already has an [AI-answer demonstration](behavior.md#global-search). It uses deterministic excerpts, not an LLM. Retrieval and generated answers still need implementation.

## Property sets (attribute groups)

Group related attributes within a business object to make long lists easier to read and navigate. For example, a **Gebäudeadresse** group could contain street, house number, postal code, city and country. Show named sections on the profile, with a clear order and the option to collapse them. Individual attributes remain searchable and directly linkable.

Let editors create, rename and order groups and assign attributes to them. Keep ungrouped attributes visible. Give groups their own display order and use attribute `sortOrder` within each group. Include group membership and group order as columns in Excel once the structured model is implemented.

**Starting point:** the [canonical property-set proposal](data-model.md#property-sets-and-business-keys) describes groups owned by each business object. Existing labels are stored in comments; structured membership, an editor and grouped display still need implementation.

## Data quality requirements

Provide a place to create, review and maintain reusable requirements, assign them to business attributes or source fields, and display their conditions and applicability on profiles. Users should be able to see where each requirement is used and distinguish required, optional, conditional and unknown information.

**Starting point:** [QualityRequirement](data-model.md#qualityrequirement) and assignments exist in the model/database; the browser mainly exposes a Required shortcut. Automated checks and quality results are a separate potential extension.

## Data lineage

Let users document where data comes from and how it moves or changes between tables and fields. Capture upstream/downstream dependencies, transformation notes, supporting sources and verification state. Show the documented flow as a navigable diagram, with a list alternative and links to the affected catalog entries.

**Starting point:** [LineageRelation](data-model.md#lineagerelation) exists in the schema, but there is no dedicated editor or lineage view. The existing relationship diagram shows associations and must not be treated as data flow.

## Approval workflows

New entries and edits should be submitted to the responsible data owner and/or data steward for confirmation. Support draft, in review, approved, changes requested and rejected states, with reviewer comments, notifications and a review queue. Reviewers should see the proposed changes and who submitted them.

Keep the last approved version published while an edit is reviewed; new entries remain unpublished until approved. Record the decision, reviewer, time and exact revision reviewed. Further edits require renewed review. Apply the same approval rules to browser and REST API changes.

**Starting point:** the implemented edit flow saves directly and retains history; catalog status is not an approval workflow. Decide whether the owner, steward or both must approve, how reviewers are assigned to login accounts, and how delegation or missing reviewers are handled.
