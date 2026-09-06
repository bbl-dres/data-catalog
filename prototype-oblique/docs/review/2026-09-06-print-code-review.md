# Print and export code review

Date: 6 September 2026. Perspective: senior developer. Outcome: the correctness findings below are fixed; optional visual differences remain documented.

## Scope and approach

Reviewed the new tile/print implementation and its integration with application routing, shared translations, catalog projection and lazy export loading. Focus areas were asynchronous lifecycle, isolation of export settings, completeness of exported metadata, filter semantics, localization, physical pagination, escaping, accessible feedback and maintainability. The [wireframe gap review](../tiles-and-print-layout.md#wireframe-gap-review--6-september-2026) supplied additional acceptance criteria.

Inspected source and generated output, added targeted browser regressions, and ran the existing core, functional and print checks. Browser tests use local fixtures, including the migrated PostgreSQL data projected through the Supabase adapter. No hosted records, database migrations, dependencies or archived wireframes were changed. This is not a new audit of the database authorization policy or third-party library internals.

## Findings and resolutions

| ID | Severity | Finding and impact | Implemented resolution |
| --- | --- | --- | --- |
| R1 | Medium | A pending scroll frame was cancelled during a language change without resetting its handle. The new listener then considered an update pending forever, preventing page tracking and SVG virtualization from advancing. | One cleanup function aborts listeners, disconnects the resize observer, cancels the frame and clears its handle. Rebuilt dialogs get their own listener lifetime; stale observers cannot operate on the replacement. |
| R2 | High | A detail URL carrying a domain navigation parameter could be interpreted as a domain export. The entity identifier was used as a domain identifier, producing an empty or incorrect scope. | Domain query scope applies to collection routes only. Detail export always retains the selected entity and all its child rows. |
| R3 | Medium | Page navigation updated the picker but left the summary on page 1. A layout failure retained obsolete page choices and counts. Empty-selection recovery offered filter reset even though selection was the cause. | Picker and summary share page state. Failed layouts clear page choices and disable preview actions. Empty selection offers Select all; empty filters offer Reset and an explicit parent-scope action. All copies of recovery controls share disabled-state rules. |
| R4 | Medium | A filter value absent from the new section's facet choices was silently discarded when opening and applying the filter menu. This could broaden the exported selection. Search also ignored facet headings. | Preserve unmatched selected choices with a zero count until explicitly removed. Filter search matches headings and values. Parent-scope navigation retains explicit filters and remembered exclusions. |
| R5 | Medium | Classification choices and explicit PDF classifications remained German in other document languages. The dialog did not declare its independent language for assistive technology. | Normalize classification to stable English values and translate display labels in DE/FR/IT/EN, including automatic classification and confidential/secret header repetition. Set the dialog language; preserve the app dictionary, finder text and disclosure state across language changes. |
| R6 | High | Product export omitted documented constituents/sources; an entity with no attributes appeared empty despite having source links. API export omitted operation name, path and HTTP method. Endpoint UUIDs were absent from the content manifest. | Capture existing `basedOn`, `sourcedFrom` and `servedBy` members as typed rows, and include documented endpoint operation details. Support both the SQL projection and legacy JSON property names. Retain endpoint UUIDs in the snapshot. No inferred links or schema writes. |
| R7 | Medium | Single-table PDF profiles omitted business object, system and classification facts. Repeating full descriptions on every continuation wasted space. | Render labeled profile facts with explicit empty values on the first fragment. Keep concise entity identity and column headers on continuation. Document classification and entity classification remain separate. |
| R8 | Medium | Every section defaulted to Grid and reused field/key headings. APIs were labeled as attributes; reference data gained empty type/key columns. Switching layout could override an explicitly chosen orientation. | Use List by default for reference data/APIs and Grid for other sections. Tailor Grid columns by kind. Preserve identifiers/required markers where a separate key column is absent. Explicit layout/orientation choices survive scope changes. |
| R9 | Low | List reused bordered cards and repeated headings for each entity. Column settings lacked reset and selection count; generic re-enabling could release the fixed Name checkbox. | Use one continuous full-width table per content page, with entity separators and one column header. Add a draft-only default-column reset and selected count. Preserve fixed disabled controls. Include recorded length/unit values when available. |
| R10 | Low | Export translations depended on a global current session. Event cleanup and late asynchronous completion were spread across multiple paths. Script timeout/error handlers could settle the same load twice. | Translate against the owning session, consolidate listener cleanup, ignore obsolete sessions before generation, and check cancellation around asynchronous PDF conversion. Make script completion idempotent. Remove the unused timer cleanup and correct module comments. |

## Wireframe reconciliation

Implemented the substantive remaining gaps: page feedback, classification localization, product/API content, profile facts, per-section defaults, continuous List, column reset/count, complete scope path and explicit parent-scope recovery. Tile anatomy already matched option 1a and needed no additional styling change.

The overview still has group counts, responsibility, page references and shared document header/footer. A separate expanded document summary in the overview body remains optional. Native layout selects, the existing icons and retained selection controls also remain as implemented; they do not prevent the agreed workflow. UML, relationship lines and the Landscape collection view remain deferred by user decision.

## Validation

- Core suite: 33 checks passed, including immutable reloads, safe text/URLs, routing, translations, reference integrity and Excel source fidelity.
- Functional suite passed: search, domain navigation, menus, field/profile state, Swagger lifecycle/retry and load errors.
- Existing print suite passed 320 language/paper/orientation/layout/grouping combinations, source-row coverage, page bounds, non-overlap, mobile controls, zoom, asset retry and cancellation.
- Scope/filter suite passed: OR/AND filtering, cancellation, exclusions, scope changes, frozen content and actual reference/API PDFs.
- New review suite covers the queued-scroll race, stale loads/exports after close/reopen, route cleanup, translated classification, control recovery, unmatched filters, explicit layout/orientation, source product/API content, domain parameters on detail routes, escaped SVG text and preserved identifier/required markers. An additional 64 section/language/layout combinations check row coverage and geometry.
- Nine generated PDFs passed checks for preview text, source labels/codes, embedded fonts, vector graphics, physical bounds and the matching content-manifest hash. Profile, continuous List and product output were also visually inspected. The complete GWR A3 portrait List now uses eight pages rather than nine.

Tests check source relationships independently of the export snapshot: matching every captured row alone would not have detected R6. Temporary output stays outside the repository. Test commands and prerequisites are maintained in the [test guide](../../tests/README.md).

## Limits and maintenance

### Follow-up: expanded print-tree rows

A user screenshot exposed a missed layout regression: the shared tree has two grid columns, but selectable export leaves rendered three children (spacer, checkbox and name button). The checkbox stretched into the name column; the name button wrapped into the narrow toggle column and its text width became zero. This was a visual defect that the earlier presence/selection assertions did not detect.

Fixed by placing a labeled checkbox in the existing leaf toggle slot. Branch toggles retain their shared layout. The new [print-tree regression](../../tests/print-tree.cjs) measures actual label width and checkbox/link alignment for expanded object and table branches at 320, 390, 768, 1024 and 1600 px. It also verifies mouse/keyboard selection separately from name-click scope changes. All checks passed; the corrected tree was visually inspected.

### Remaining limits

Source translations and undocumented metadata still use the established fallback or an explicit dash. The exporter does not verify SAP/GWR definitions, infer keys, authenticate approvers or manage document versions. Oversized content that cannot fit a complete row fails visibly instead of being clipped. PDF/A and PDF/UA conformance are not asserted.

Keep content mapping, physical pagination, controls and lifecycle separate. New catalog properties should be covered by a source-to-snapshot assertion and, when visible, an actual PDF check. Any new asynchronous workspace operation must check its owning session before publishing a result and use the shared cleanup path.

## References

- [Behavior contract](../behavior.md#data-model-pdf-export) and [architecture](../architecture.md).
- [Content mapping](../../js/diagram-content.js), [physical layout](../../js/diagram-layout.js), [controls](../../js/diagram-controls.js), [lifecycle](../../js/diagram-export.js) and [PDF writer](../../js/pdf.js).
- [Review regressions](../../tests/print-review.cjs), [layout regressions](../../tests/diagram.cjs), [filter regressions](../../tests/diagram-filters.cjs) and [actual PDF inspection](../../tests/diagram-pdf.py).
