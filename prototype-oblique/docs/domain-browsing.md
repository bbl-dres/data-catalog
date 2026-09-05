# Consistent domain browsing

Domains primarily help people narrow the catalog to a subject area. Their previous profile repeated a separate business-object table and exposed relationships and history as peer navigation choices. This added a second browsing pattern alongside the existing collection pages.

Domain pages now offer **Übersicht**, **Kacheln**, and **Tabelle**. Kacheln is the initial browsing layout; the current collection layout is reused when entering another domain. Übersicht retains the domain's core facts, responsibility and additional metadata. Relationships and history remain in the catalog data and other entity profiles, but are no longer tabs on a domain page.

## Shared presentation and scope

- `views.collection()` composes the controls and panel for ordinary collections and domains. Domain contexts display business objects belonging to that domain, using the existing cards, columns, sorting, grouping, local search, responsive layouts and keyboard tab handling.
- Domains initially use **Gruppieren: Keine**, because the page already names the domain. Grouping can still be changed using the familiar control.
- The local query survives Kacheln/Tabelle/Übersicht changes and browser navigation. It is dormant while Übersicht is visible. Empty collections offer the existing clear-filter action.
- Excel from Kacheln or Tabelle exports the matching business objects in the current order, including their associated table/field/code-list data under the existing export rules. Excel from Übersicht exports the complete domain. The domain's separate row-table renderer was removed.
- Repeated domains in Referenzdaten, Datenprodukte and API-Verzeichnis continue to open their section-scoped collections; their links do not redirect to Geschäftsobjekte.

## Links and compatibility

`#/domains/bau` opens the preferred collection layout. `?tab=tiles`, `?tab=table` and `?tab=overview` select explicit tabs. A saved `?tab=rows` link resolves to Tabelle; old Beziehungen/Verlauf links resolve to Übersicht. `?view=tiles|table` is also accepted on entry and normalized to the domain tab URL. Filters and grouping retain their existing `filter` and `group` parameters. The resolved layout and grouping are written into each collection's history entry, including defaults, so Back/Forward and reload do not inherit a later page's preferences. Short links remain valid.

The domain route and its entity identity stay intact for breadcrumbs, search results and metadata links. Moving from domain browsing into an object opens that object's normal profile; domain layout tabs do not carry into object profile tabs.

## Verification

Core checks cover domain membership, legacy tabs, shared columns, filtered/empty exports and metadata. Browser checks cover 1440, 390 and 320 px layouts, keyboard tabs and focus, local search, reload/back navigation, exports and section-specific sidebar drill-down. Existing relation diagram tests now use the GWR system profile, which retains relationships, including the dense-graph and touch checks.

## Consistency review — 2026-09-05

The agreed tab structure and shared rendering are sound. Reviewed labels, table columns and card layout, keyboard tabs, filter scope, exports, links, history, sidebar state and mobile behavior. Four issues were reproduced in the browser and corrected:

| Finding | Reproduction and correction |
| --- | --- |
| Layout changed when returning with Back | Open Architektonische Sicht in Kacheln, enter Energie, switch to Tabelle, then go Back. The first domain incorrectly became Tabelle. Domain tabs now serialize Kacheln explicitly; all collection entries capture their resolved layout and grouping so subsequent preferences cannot change them. |
| Collapsing one domain hid another's cards | Collapse the ungrouped business objects in Architektonische Sicht, then enter Energie. Both shared the same disclosure key. Group disclosure keys now include the domain scope; returning to the original domain still retains its own collapse state. |
| Content links reset the navigation model | Open a domain with `nav=container`, then choose a card or table row. The sidebar reverted to the default entity layout. Collection links and profile breadcrumbs now retain the explicit navigation parameter, matching sidebar links. Search result rows use the same link behavior. |
| Direct links did not expand their sidebar branch | Open a domain URL directly or from the home table. Its active branch remained closed, unlike entering it through the sidebar. Domain and system profile entry now opens the corresponding branch in either navigation model. Users can still collapse it manually. |

### Intentional differences retained

| Context | Tabs and content |
| --- | --- |
| Geschäftsobjekte and other top-level collections | Kacheln / Tabelle for that section's entries. |
| A domain profile, such as Architektonische Sicht | Übersicht for domain metadata; Kacheln / Tabelle for its business objects. |
| A domain filter inside Referenzdaten, Datenprodukte or API-Verzeichnis | Kacheln / Tabelle for that section within the domain. No redirect into Geschäftsobjekte and no duplicate domain metadata tab. |
| Individual objects, tables, systems and other records | Their existing profile tabs, including relationships and history where applicable. |

The review adds no tabs or features. Regression checks exercise independent disclosures, Back/Forward after layout/grouping changes, direct-link expansion, and card/table/breadcrumb navigation in both sidebar models at desktop and phone widths. Existing filtered exports, empty states, legacy links, and responsive keyboard behavior remain covered by the shared suites.
