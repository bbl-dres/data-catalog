# Business-attribute order applied

13 September 2026. All **217 attributes across 26 populated business objects** have unique, spaced sort_order values. The other 14 catalog objects have no attribute definitions and were not populated artificially.

Primary identifiers come first. Numbers increase by 10 inside topic bands; the next topic starts at its reserved hundred. The larger separation leaves space for additions.

| Start | Topic |
|---:|---|
| 100 | Identifikation |
| 200 | Räumliche Zuordnung |
| 300 | Registerbezug |
| 400 | Klassifikation und Nutzung |
| 500 | Adresse |
| 600 | Geometrie |
| 700 | Bauwerk und Lebenszyklus |
| 800 | Eigentum |
| 900 | Bewirtschaftung |
| 1000 | Portfoliomanagement |
| 1100 | Messwert |
| 1200 | Nachweis und Methode |
| 1300 | Gültigkeit |
| 9000 | Stillgelegte Definitionen |

Addresses use Land → Region/Kanton/Bundesstaat → Ort → Postleitzahl → Strasse → Hausnummer → Adresszusatz, skipping inapplicable or absent definitions. Existing property-set comments inform the topic order. Remaining small object profiles follow the same topics without introducing new attributes. Retired and archived definitions sort from 9000 onward; their lifecycle, archival flag and reference identity are unchanged.

The default web sort for business-attribute and data-field tables is now explicitly **sortOrder ascending**, even when its optional column is hidden. Explicit user sorts still take precedence and survive reload. Status remains the last visible column and can be hidden in Ansicht. No data-field ranks were renumbered.

## Applied and verified

The 217 rank-only commands passed a full rollback preview, with the original snapshot fingerprint checked afterwards. They were then committed atomically through the existing audited SQL RPC, with full original-row/revision checks. A separate read-back confirmed every rank, PK-first order, address sequence, row count and unchanged references. Only sort_order and managed revision/timestamps changed; parent revisions advanced through the normal command boundary. All previous content and history remained present, with 217 additional history events and one private receipt/attribution per command.

This used the same explicitly authorized administrative MCP operation and sole existing active app-account context as the [content cleanup](2026-09-13-bemessung-simplification.md). No token or credentials were read, and no schema, grants, policies or Auth records changed.

The current signed-in localhost preview also confirmed Gebäude-ID first, the country-to-address sequence, sortOrder:asc in the URL and a status pill as the last column. The presentation, detail and app script URLs carry a cache revision so the existing browser receives the updated assets.

The isolated SQL/Excel round-trip suite and browser row-order suite passed, covering numeric ordering, explicit sorting, reload, print, archived positions, editor movement and narrow layouts.

The [exact order plan](2026-09-13-attribute-order/order.json), [applied commands with original rows](2026-09-13-attribute-order/manifest.json) and [post-commit verification](2026-09-13-attribute-order/verification.json) are recovery evidence, not migrations to rerun. Reverse only reviewed fields with current revisions and fresh command IDs; preserve subsequent changes and history.

The ranks are an editorial convention. They do not create structured PropertySets or automatically reorder future imports. The existing editor's move operation still compacts a reordered draft to consecutive ranks; use explicit API sort_order edits to preserve numeric gaps during later maintenance.
