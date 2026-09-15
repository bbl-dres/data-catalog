# Documentation

Maintain these guides alongside changes to the prototype. The app's [README](../README.md) covers local setup and current previews; the [test guide](../tests/README.md) covers verification.

| Document | Purpose |
|---|---|
| [Architecture](architecture.md) | Current modules, rendering, routing, state and extension points. |
| [Design system](design-system.md) | Tokens, shared components, responsive behavior and accessibility checks. |
| [Behavior](behavior.md) | Navigation, local/global search, relationship diagrams and export contracts. |
| [Canonical catalog data model](data-model.md) | Review before launch: current schema dictionaries and ER diagram, proposed property-set/business-key decisions, dated deployed/visible/editable coverage, separate content readiness, constraints and standards alignment. |
| [Model implementation and migration](data-model-implementation.md) | Companion for storage implementation, write/read contracts, current JSON and UI mappings, migration, validation and publication procedures. |
| [Future features](future-features.md) | Wiki, LLM-powered search, property sets, quality requirements, data lineage and approval workflows; proposed scope and existing foundations. |
| [Supabase setup](../supabase/README.md) | Ordered migrations, login and editing, public reads, archived content updates, frontend connection and database checks. |
| [Catalog API](api.md) | Public reads, authenticated CRUD, account tokens, Swagger requests and deployment. |
| [Security and deployment](security.md) | Database defaults, browser policy, deployment headers/assets and dependency verification. |
| [Business-object attribute proposal](business-object-attribute-proposal.md) | Pending conceptual Building, Parcel, EconomicUnit and Measurement content decisions. |
| [Imports and source evidence](imports/README.md) | Source-specific instructions, curation decisions, provenance and unresolved gaps. |
| [Tiles and print layout](tiles-and-print-layout.md) | Agreed design-study implementation plan and validation. |
| [Excel review export](excel-export.md) | Workbook scope, stable field mappings, ordering, formatting and completeness boundary. |
| [Edit mode](edit-mode-implementation.md) | Design-study mapping, implemented scope, atomic save API and activation. |
| [Design and code reviews](review/README.md) | Findings, implemented fixes, validation and explicit remaining limitations. |
| [Wireframes and design archive](wireframes/README.md) | Preserved design studies and earlier prototype snapshots. |
| [Explainer video — Version 2](video/2026-09-15-version-2/README.md) | Practical Baujahr example, continuous diagram, real catalog captures, Corinna narration, editable Shotcut timeline and subtitles. |
| [Preserved explainer — Version 1](video/2026-09-15-landscape/README.md) | Preserved NotebookLM adaptation, landscape diagrams, editable Shotcut timeline and subtitles. |

## Keeping this folder useful

- Update the relevant guide when behavior changes; keep test commands in the test guide.
- Keep model meaning, dictionaries, schema mappings, keys, constraints and the ER diagram in the canonical data-model.md. Maintain implementation procedures, prototype coverage and migration in data-model-implementation.md.
- Keep deployed observations dated and distinguish them from repository support. Proposed next-revision fields do not enter the current schema inventory until implemented; content review does not close automatically when schema checks pass.
- Keep source evidence in `sources/` and executable import tools in `../scripts/`. Generated import reports belong beside their source evidence because they preserve mappings and retired records.
- Keep temporary screenshots and test output outside the repository. Current preview images live in `../assets/`; a review may keep a few compressed before/after composites in a folder named after it.
- Consolidate completed review decisions in the maintained guides. Preserve `wireframes/` and its supporting assets; delete archived designs only on explicit user request.

Superseded reviews remain available in Git history. Restored wireframes are indexed in the design archive above.
