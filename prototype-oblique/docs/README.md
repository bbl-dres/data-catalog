# Documentation

Maintain these guides alongside changes to the prototype. The app's [README](../README.md) covers local setup and current previews; the [test guide](../tests/README.md) covers verification.

| Document | Purpose |
|---|---|
| [Architecture](architecture.md) | Current modules, rendering, routing, state and extension points. |
| [Design system](design-system.md) | Tokens, shared components, responsive behavior and accessibility checks. |
| [Behavior](behavior.md) | Navigation, local/global search, relationship diagrams and export contracts. |
| [Catalog data model](data-model.md) | Stable conceptual target: entities, complete attribute dictionaries, relationships, cardinalities, DE/IT/FR/EN content and standards alignment. |
| [Model implementation and migration](data-model-implementation.md) | PostgreSQL design and physical ER diagram, write/read contracts, current JSON and UI mappings, migration, validation and publication guidance. |
| [Business-object attribute proposal](business-object-attribute-proposal.md) | Pending conceptual Building, Parcel, EconomicUnit and Measurement content decisions. |
| [Imports and source evidence](imports/README.md) | Source-specific instructions, curation decisions, provenance and unresolved gaps. |

## Keeping this folder useful

- Update the relevant guide when behavior changes; keep test commands in the test guide.
- Keep model meaning and attributes in data-model.md; maintain storage, prototype coverage and migration decisions in data-model-implementation.md.
- Keep source evidence in `sources/` and executable import tools in `../scripts/`. Generated import reports belong beside their source evidence because they preserve mappings and retired records.
- Keep temporary screenshots and test output outside the repository. Current preview images live in `../assets/`.
- Use Git history for completed reviews, experiments and old prototype copies. Their lasting decisions are consolidated in the guides above; they do not need separate archives here.

The cleanup retained the catalog-model and business-object proposals, import evidence and outstanding source questions. It removed superseded reviews, old wireframes, duplicate assets and the obsolete fictional-data generator. To inspect the removed material, use `git log --all -- prototype-oblique/docs` and `git show <commit>:<path>` from the repository root.
