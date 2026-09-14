# Strategy: load only what the active view needs

Proposal for the next performance step after the [14 September review](2026-09-14-performance-review.md). Goal: keep the catalog fast while its content grows several-fold, by loading per browser view instead of the whole catalog per page load. Written for the engineers maintaining the catalog; the decisions at the end are for the product owner.

## Where the bytes are

The initial load is now 3.6 MB. Almost all of it is child rows that only one profile displays at a time.

| Collection | Rows | JSON today | Who displays it |
| --- | ---: | ---: | --- |
| `data_field` | 1,138 | 1,457 kB | one table or API profile (Felder tab) |
| `code_value` | 2,120 | 1,388 kB | one code-list profile (Werte tab) |
| `business_attribute` | 295 | 321 kB | one object profile (Attribute tab), plus inherited attributes of its specialisations |
| `relationship` | 121 | 137 kB (122 kB of that is evidence text) | one profile (Beziehungen tab, diagram) |
| parents: `business_object`, `data_table`, `code_list`, `data_product`, `data_service`, `domain`, `system`, `actor`, `quality_requirement`, `service_endpoint` | 236 | about 220 kB | every view: lists, search, tree, home, breadcrumbs, link labels |

Per owner, the child bundles are small on average and bounded by the largest owners:

| Owner | Owners | Children max / avg | Bundle max / p90 / avg |
| --- | ---: | ---: | ---: |
| `data_service` | 7 | 378 / 54 | 510 kB / 205 kB / 74 kB |
| `code_list` | 95 | 667 / 22 | 460 kB / 20 kB / 16 kB |
| `data_table` | 30 | 205 / 25 | 307 kB / 50 kB / 33 kB |
| `business_object` | 42 | 44 / 7 | 58 kB / 17 kB / 9 kB |
| `data_product` | 5 | 5 / 2 | 5 kB / 4 kB / 3 kB |

## What each view actually reads

Read from the current `js/` code, not assumed.

| View | Reads | Needs children? |
| --- | --- | --- |
| Home (KPIs, recent changes) | counts per kind, `name`, `modified_on`, domain of each parent | no |
| Lists and tiles (all kinds, grouped by domain) | parent columns: name, description, status, system, technology, responsible organisation, norm reference, access rights, format, service version, protocol of the primary endpoint, child counts | only the counts |
| Sidebar tree | parents grouped by domain or system | no |
| Global search and suggestions | `name`, `technicalName`, `description` of parents (`data.relevance`), kind and domain filters | no |
| Profile, Übersicht tab | the parent record, its domain/system/actors, quality requirements of its attributes | no (object profiles show the attribute count) |
| Profile, Attribute/Felder/Werte tab | the owner's children, inherited attributes over `specializes`, code-list references, key roles, required rules | yes, one owner |
| Profile, Beziehungen tab and diagram | relationships touching the record or its children, the counterpart records' names and owners | yes, one owner plus the linked counterparts |
| Profile, Verlauf tab | `read_history` (already on demand) | no |
| Attribute and field profiles | the owner's bundle | one owner |
| Editor | the edited record and its children; parent lists for reference dropdowns | one owner |
| Excel, selection scope; PDF | the current profile | one owner |
| Excel, catalog scope | everything | all, at export time only |

Two cross-entity dependencies need care. Object profiles show attributes inherited from the object they specialise, and the relation list "Repräsentierte Attribute" resolves `represents` assertions from a table's fields to attributes of other objects. Both must be resolved by the database inside the profile bundle, otherwise the client would have to chain loads.

## Target architecture

Three tiers, each one request.

**Tier 0, the catalog index.** `catalog.read_catalog_index()` returns every parent record in full (they are small), the parent-level relationships without their evidence columns (`realizes`, `basedOn`, `sourcedFrom`, `servedBy`, `specializes`, `measuredFor`; about 20 kB), service endpoints, actors and quality requirements, plus a child count per parent and the catalog version. Estimated size today: 250 to 300 kB, that is 7 % of the current load and 3 % of the original one. Database time: tens of milliseconds, since it aggregates only the parent tables and counts over indexed foreign keys. This tier alone drives home, lists, tree, search, breadcrumbs and link labels, and it grows with the number of parent entities only, about 1 kB each.

**Tier 1, the profile bundle.** `catalog.read_record(record_table, record_id)` returns the record, its owned rows in stored order, the attributes inherited through `specializes` (recursive CTE, flagged with the defining object), the relationships touching the record or its children with their evidence, a minimal projection of every counterpart record those relationships point to (id, identifier, names, owner, status), and the quality-requirement links of its attributes. One request per profile, 9 to 74 kB on average, 510 kB at most today. Attribute and field profiles reuse their owner's bundle, as they already do for history.

**Tier 2, on demand.** `read_history` as today; `read_snapshot(true, false)` only for the Excel catalog scope, requested when the user starts that export, with a progress state; `read_snapshot()` unchanged for the import verification scripts and fixture tests.

**Version token.** Every response carries the catalog version. The client keeps the index and the bundles it has seen; if a bundle reports a newer version than the index, the index is refreshed in the background. After a save, the editor refreshes the index and the edited bundle and drops the others. The same token later drives the browser cache (`if_version`, Cache API), which makes repeat visits nearly free. The token needs a trigger-maintained row; the write-serialising statement trigger `catalog_private.serialize_write()` already runs for every catalog write and is the place to bump it. Where the row lives is the first decision below.

**Client.** `catalog.js` splits `project()` into `projectIndex()` and `projectRecord()`, reusing the existing `base()`, `localized()` and child logic. Index entities carry `attributes`, `fields` and `values` as empty placeholders plus a server count, so `data.sizeOf()`, list columns and KPIs keep working before any bundle arrives. A record store mirrors the history store: `data.recordState(kind, id)` returns `{ entity, loading, error }`, starts the read, caches it, and notifies the app when it arrives; `detail.render()` shows the same loading and failure states the Verlauf tab has now. Links prefetch their bundle on hover and focus, which hides the extra round trip on most navigations. A complete snapshot, as the fixture tests and the offline `json` provider supply it, still runs through `project()` as today, so the 56 suites that mock `read_snapshot` remain valid and only the new RPCs need new tests.

**Server-side search and paging, later.** Search stays in the browser over the index for as long as the index is one request; parent names and descriptions are 60 kB today. When parents pass a few thousand, add `catalog.search_catalog(query, language, kinds, limit)` on `pg_trgm` and `unaccent` (both available on the project, neither installed) with GIN indexes over the folded names, and page collection lists in the database (`read_collection(kind, domain, sort, page)`). The tiered client is already shaped for that: lists and search would then read a page instead of the whole index.

## Expected effect

| Measure | Original | Today | Tiered |
| --- | ---: | ---: | ---: |
| Initial payload | 10.5 MB | 3.6 MB | about 0.3 MB |
| Database time per page load | 0.8 to 8 s | 0.45 s | well under 0.1 s (parents and counts) |
| Extra request per profile | none | history only | one bundle of 9 to 74 kB on average, plus history; cached per session, prefetched on hover |
| Growth driver of the initial load | everything | current records | parent entities only, about 1 kB each |
| Ten times today's content | 100 MB, unusable | 36 MB, unusable | 3 MB index, bundles unchanged in size |
| Fifty times today's content | – | – | index 15 MB: switch lists and search to server paging (phase 3) |

## Phases

1. **Version token** (small SQL change, one decision). Trigger-maintained version row, exposed in every read RPC. Prerequisite for consistency across tiers and for client caching.
2. **Index and bundles** (the core of this proposal). `read_catalog_index`, `read_record`, the client record store, prefetch, loading states, editor and export adjustments, OpenAPI regeneration, PGlite and Playwright suites for both RPCs. Rough size: 200 lines of SQL, 300 lines of client code, two test suites. Ship behind the existing `provider` switch so the fixture mode is untouched.
3. **Client cache** (`if_version` on the index and bundles, Cache API storage). Returning visitors download nothing while the catalog is unchanged.
4. **Server-side search and paged lists**, triggered by measurement: when the index passes about 3 MB or its read passes 0.3 s.

Keep the public statement timeout at 3 s throughout; every tier is designed to stay far below it.

## Risks and how the design handles them

- **More round trips.** A profile costs one more request than today. Prefetch on hover and focus, an in-session cache and the version token remove most of the visible latency; a loading state covers the rest, as the Verlauf tab does now.
- **Consistency between index and bundle.** The version token detects a stale index; the trigger bump makes it exact rather than heuristic.
- **Cross-entity relations.** Inherited attributes and represented attributes are resolved in the database and delivered inside the bundle; the client never needs a second owner's children to render a profile.
- **Excel catalog scope.** Loads the complete snapshot at export time. It is the one view that legitimately needs everything, and it already shows progress.
- **Editor.** Reference dropdowns list parent records, which the index carries in full; required-attribute rules come with the bundle instead of a global set.
- **Tests and fixtures.** The complete-snapshot path stays; existing suites keep their mocks. New suites cover the new RPCs the way `history-on-demand.cjs` and `history-browser.cjs` do.
- **Largest owners.** A 378-field API is 510 kB in one bundle, acceptable today. If an owner passes about 1,000 rows, page its children inside the bundle RPC; the store already treats children as a loadable list.

## Decisions needed

1. **Home of the version row.** A public `catalog.catalog_state` table (one row, read-only for API roles) is the simplest and doubles as a "has the catalog changed?" endpoint for integrations, but joins the public table inventory in `docs/data-model.md`, the schema suite and the contract generator. The alternative, a `catalog_private` row with a narrow read grant, contradicts the current rule that API roles have no access to that schema. Recommendation: the public table.
2. **Bundle scope.** Resolve inherited and represented attributes in the database (recommended) or let the client chain owner loads.
3. **Prefetch policy.** Hover and focus only (recommended), or also the first visible tiles of a list.
4. **When to start phase 4.** Recommendation: only on measurement, not now.
