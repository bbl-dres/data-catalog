# Bereitstellungsformen

13 September 2026. Implemented and verified locally; hosted migration remains pending.

## Reference and implementation

The reference is the expandable distribution section in `prototype-dcat/index.html` and its renderer in `prototype-dcat/js/app.js`. It describes a representation's name, format, status, access/download URLs, licence and notes. The user requested this for Datentabellen, Datenprodukte and API-Verzeichnis, including editable entries and model/database support.

The implementation uses the existing profile and editor components. It adds a section below the overview facts, with individually expandable entries and a dedicated edit tab. Drafts need a title; valid entries also need a link or access instructions. Editors can translate titles, change the format, status, links, instructions, terms and comment, reorder entries, archive saved entries and restore them. Ordinary catalog accounts use their existing editing permission.

No example data from the old prototype is imported. Existing API endpoints also appear in the section using their own records and remain editable in the existing rows editor. Product formats, landing pages and licence metadata retain their existing meaning.

## Model and persistence

[data-model.md](../data-model.md#accessoption) is the canonical contract. `AccessOption` is a local owned value on DataTable, DataProduct and DataService. It describes access without introducing the deferred DCAT publication entities or an independent resource lifecycle.

The [migration](../../supabase/migrations/20260913040000_catalog_access_options.sql) adds three `access_options` JSONB columns, initially empty, bringing the repository baseline to 19 public tables and 477 columns. SQL validates the exact item shape, title, lifecycle, URLs and UUID uniqueness. Array position defines display order. Saved IDs cannot disappear; archival retains them. Browser saves and REST create/PATCH use the existing owner revision, atomic history and retry boundary. No new table permissions or privileged browser credentials are added.

Rendering, optional web/PDF descriptions and Excel use the same access projection. The field picker keeps Access options hidden by default. Excel includes an authored-entry sheet with owner context, all four title languages and safe hyperlinks; existing endpoint exports remain separate. Native browser print reveals collapsed descriptions.

## Visual checks

Microsoft Edge on Windows, local SQL fixtures, fonts loaded before measurement. The test intercepts authentication and every hosted-project request, so no hosted writes occur. URLs under `example.invalid` are test content only.

| Check | Result |
| --- | --- |
| Profile widths | 320, 390, 768 and 1440 px for all three record types; document width equals viewport width |
| UI languages | DE, FR, IT and EN at 320 and 1440 px; translated headings retain accents |
| Editor widths | 320, 390 and 1440 px while switching all four authoring languages; no page overflow |
| Interaction | Keyboard expansion, independent disclosures, collapsed-state print visibility and shared chevrons pass |
| Mobile polish | Labels stack above values below 600 px of workspace width; long URLs and German labels no longer compete for narrow columns |

Evidence: [table, desktop](2026-09-13-access-options/tables-1440.png), [table, phone](2026-09-13-access-options/tables-390.png), [API, desktop](2026-09-13-access-options/apis-1440.png), [editor, phone](2026-09-13-access-options/editor-390.png), [measurements](2026-09-13-access-options/measurements.json).

## Verification

- `tests/access-options.cjs`: real SQL creation and browser/REST updates on all three owners; permissions, invalid values, stale revisions, retries, owner history, retained identities, order, archive/restore, escaped output and safe links. XLSX write/read checks include hyperlinks, hidden identities and stored title translations.
- `tests/access-options-browser.cjs`: actual forms and SQL saves for all three owners, name isolation when item and owner UUIDs coincide, inline validation, ordering/archive/restore, old-schema compatibility, responsive measurements and PDF downloads with the optional field selected.
- Actual PDFs for tables/products/APIs contain titles, URLs and terms, checked with PyMuPDF text extraction. The fixtures produce 3/4/3 pages respectively. [PDF check results](2026-09-13-access-options/pdf-checks.json) and [table PDF page](2026-09-13-access-options/pdf-table.png). Long access descriptions follow the existing parent-column layout and can increase page counts.
- Canonical checks cover 477 SQL/API columns, 165 EN/DE bindings, 17 dictionaries and 148 schema assertions. API contract checks and 48 core checks pass. Existing editing, REST CRUD and field-visibility suites also pass.

The PDF test caught a missing connection to the optional-field inventory; it was fixed and the actual downloads were then verified. A test-navigation issue initially prevented locale initialization on same-hash navigation; full-page test visits now verify real application languages.

## Activation

Apply the new migration after its predecessors, following [Supabase setup](../../supabase/README.md#access-options-bereitstellungsformen), then reload the app. No authenticated dashboard or database connection was available in this session, so local verification does not establish hosted activation. The frontend remains usable with the older schema and reports access-option editing unavailable. A deployed catalog-api Edge Function needs no code change for the new owner property.
