# Projekt Management

Added on 2026-09-05 at `#/domains/projekt`. The domain contains four draft business objects:

| Business object | Attributes | Description source |
|---|---:|---|
| Bauprojekt | 7 | Exact definition from the imported GWR catalog 5.0.0 |
| Meilenstein | 6 | Local prototype definition |
| Phase | 7 | Local prototype definition |
| Bauarbeiten | 5 | Exact explanatory paragraph for GWR's entity **Arbeiten** |

Attributes, identifiers, key roles and mandatory flags on these business objects are illustrative local modelling choices. They do not claim to reproduce the GWR field schema. The original 37 Bauprojekt fields and 10 Arbeiten fields remain available on their table and field profiles. The GWR definition links and the business objects' Quellenstand distinguish copied definitions from these draft attributes.

The domain and four business objects have status **Entwurf**, version 0.1 and a single creation-history entry. `Projektmanagement` is the prototype's responsible organisational unit; no staff names, contacts, access classification or personal-data assessments are invented. The original GWR system, tables and code lists keep **Gültig**, BFS responsibility and verified contact details.

Mappings:

- `t-gwr-bauprojekt` realises `bauprojekt`, in domain `projekt`.
- `t-gwr-arbeiten` realises `bauarbeiten`, in domain `projekt`; its official display name remains **Arbeiten**.
- The 15 code lists attached to those tables inherit the same domain/business-object mappings in the importer.
- GIS IMMO's existing `t-proj` / `CONSTRUCTION_PROJECT` now realises `bauprojekt`. All existing field names, table IDs and bookmarks are retained, including the `AREAL_ID` field. In the baseline generator, `obj='areal'` keeps that existing field template; `realizes='bauprojekt'` specifies the corrected business-object mapping.

Tree membership, home counts, collection grouping/search, breadcrumbs and table/code-list relationship bubbles derive from these references. No new navigation branch or relationship layout is hardcoded. Object references expressed in draft attributes are descriptive; the current model does not infer object-to-object diagram edges from attribute names.

The baseline [generator](generate-data.py) includes the new domain and objects. The [GWR importer](import-gwr.py) preserves the table and code-list mappings on repeated runs. Run the baseline generator before the GWR importer when rebuilding all data; normal incremental edits should retain the existing JSON records. The initial update merged only the five new records and their history, preserving unrelated edits.
