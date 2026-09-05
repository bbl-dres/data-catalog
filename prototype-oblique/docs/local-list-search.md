# Local list search

The collection pages already supported local search, including system collections and business objects within a domain. The detail tables used a separate renderer and lacked the same control.

Detail row tabs now reuse the collection search input, matching rules, count and empty state. This covers a system's data tables, a table's fields, business-object and data-product attributes, and reference-list values.

- Search sits to the right of the tabs and moves below them in narrow workspaces, using the existing spacing and control tokens.
- Matching includes displayed names, technical names, descriptions and other table values. Attribute identifiers are also searchable. Matching ignores case and supports umlaut alternatives such as `Gebaeude`.
- Filtering precedes sorting and pagination, and changing the query returns to page one. Tab counts continue to show the full list size; the search status shows the matching count.
- Typing updates only the results and status, preserving focus and IME composition. Escape and the clear button reset the query.
- The `filter` URL parameter restores the query on back navigation. A bookmarked `tab=rows` search also reopens that tab on reload.
- Entity Excel exports still include the complete entity schema. Collection exports retain their existing filtered scope.

Implementation is shared through `ui.collectionSearch`, `data.matchesValues`, and `detail.rowsContext`. The browser checks in `tests/list-search.cjs` cover a 150-field test fixture, GWR aliases, system lists, business-object attributes, domain collections and widths from 320 to 1920 pixels. Long and empty schemas are test fixtures so coverage does not depend on the current SAP catalog scope.
