# Field columns and Gebäude cleanup — completed, 13 September 2026

**Datentabelle field lists:** the Name column now contains only the localized alias. Technischer Name is a separate, adjacent column and both are visible by default. Status remains last. The technical name links to the same stable field profile; an absent alias displays an em dash. Both values remain searchable even when a column is hidden. Existing source records and contextual profile titles are unchanged.

Visibility preferences move to version 3: existing field preferences receive the newly separated technical-name column once; later explicit hiding is preserved. Standard wiederherstellen restores both names and Status. Explicit URL field selections continue to express the chosen subset. The presentation script URL was refreshed to avoid stale browser code. Business-attribute semantic names were not exposed as new physical source fields.

**Gebäude:** Hauptnutzung and its exclusively assigned completeness rule are archived. No physical deletion. Two guarded updates passed rollback, a full unchanged-hash check and independent committed readback. All prior history, other attributes, classifications, source inventories and code lists are preserved. There are 39 non-retired active Gebäude definitions, including five aggregate measurements (34 other direct attributes); the retained retired Fläche definition is excluded from that active count. The verification's non-archived row count of 40 includes that older retired definition. Total stored business attributes remain 295, including archives; total history events are 1,213.

The 50 core tests pass, including new checks for separate localized values, stable field links, hidden-column search, missing aliases, default ordering and one-time preference migration followed by persistent hiding/reset. Localhost RE-FX Gebäude (VIBDBU) visibly shows six default columns: Name, Technischer Name, Datentyp, Schlüsselrollen, Werteliste, Status. Its first field displays Betrag pro Raumeinheit separately from AMOUNT_PER_VOLUME.

**Queued only:** assign consistent sortOrder values to Datentabellen and Felder, following the business-attribute convention. No table/field sortOrder data was changed by this task.

Evidence: [Hauptnutzung transaction manifest and readback](2026-09-13-field-cleanup/). Earlier Gebäude-ID, Ermittlungsart and FID (AOID) changes are documented in [the previous simplification](2026-09-13-simple-attributes.md). No schema/security changes, commit or push.

Final checks passed: 50 core tests; generated API contract (36 paths, 19 schemas, 84 operations); 165 canonical EN/DE bindings; PDF wrapping/font metrics; git diff --check. The latest committed snapshot also passed the local frontend projection for Hauptnutzung removal, ten Bemessung attributes, FID (AOID), separate source-field names and no broken references.
