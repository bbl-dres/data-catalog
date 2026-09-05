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

`#/domains/bau` opens the preferred collection layout. `?tab=table` and `?tab=overview` select explicit tabs. A saved `?tab=rows` link resolves to Tabelle; old Beziehungen/Verlauf links resolve to Übersicht. `?view=tiles|table` is also accepted on entry and normalized to the domain tab URL. Filters and grouping retain their existing `filter` and `group` parameters.

The domain route and its entity identity stay intact for breadcrumbs, search results and metadata links. Moving from domain browsing into an object opens that object's normal profile; domain layout tabs do not carry into object profile tabs.

## Verification

Core checks cover domain membership, legacy tabs, shared columns, filtered/empty exports and metadata. Browser checks cover 1440, 390 and 320 px layouts, keyboard tabs and focus, local search, reload/back navigation, exports and section-specific sidebar drill-down. Existing relation diagram tests now use the GWR system profile, which retains relationships, including the dense-graph and touch checks.
