# Documentation

Maintain these guides alongside changes to the prototype. The app's [README](../README.md) covers local setup and current previews; the [test guide](../tests/README.md) covers verification.

| Document | Purpose |
|---|---|
| [Architecture](architecture.md) | Current modules, rendering, routing, state and extension points. |
| [Design system](design-system.md) | Tokens, shared components, responsive behavior and accessibility checks. |
| [Behavior](behavior.md) | Navigation, local/global search, relationship diagrams and export contracts. |
| [Catalog data model](data-model.md) | Stable conceptual target: entities, complete attribute dictionaries, relationships, cardinalities, DE/IT/FR/EN content and standards alignment. |
| [Model implementation and migration](data-model-implementation.md) | PostgreSQL design and physical ER diagram, write/read contracts, current JSON and UI mappings, migration, validation and publication guidance. |
| [Supabase SQL setup](../supabase/README.md) | SQL Editor seed file, public read-only access, JSON migration, frontend connection and database checks. |
| [Catalog API](api.md) | Real public REST endpoints, Swagger requests, generated OpenAPI contract and verification. |
| [Business-object attribute proposal](business-object-attribute-proposal.md) | Pending conceptual Building, Parcel, EconomicUnit and Measurement content decisions. |
| [Imports and source evidence](imports/README.md) | Source-specific instructions, curation decisions, provenance and unresolved gaps. |
| [Tiles and print layout](tiles-and-print-layout.md) | Agreed design-study implementation plan and validation. |
| [Design and code reviews](review/README.md) | Findings, implemented fixes, validation and explicit remaining limitations. |
| [Wireframes and design archive](wireframes/README.md) | Preserved design studies and earlier prototype snapshots. |

## Keeping this folder useful

- Update the relevant guide when behavior changes; keep test commands in the test guide.
- Keep model meaning and attributes in data-model.md; maintain storage, prototype coverage and migration decisions in data-model-implementation.md.
- Keep source evidence in `sources/` and executable import tools in `../scripts/`. Generated import reports belong beside their source evidence because they preserve mappings and retired records.
- Keep temporary screenshots and test output outside the repository. Current preview images live in `../assets/`.
- Consolidate completed review decisions in the maintained guides. Preserve `wireframes/` and its supporting assets; delete archived designs only on explicit user request.

Superseded reviews remain available in Git history. Restored wireframes are indexed in the design archive above.
