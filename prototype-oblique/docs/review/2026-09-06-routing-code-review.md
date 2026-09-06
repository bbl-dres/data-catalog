# Routing and URL-state review — 6 September 2026

## Assessment

The hash router is appropriate for this static prototype. Replacing it with a routing library would not address the main problems: URL values, remembered UI state and partial rendering did not always agree. Keep the router small and restore explicit URL state before deriving page content.

The review covered parsing/building, all catalog collections and supported profile tabs, nested attributes/fields, search and suggestions, handbook chapters, both tree models, history, preferences, pagination, Swagger lifecycle, and the web-to-print handoff. No database schema, records, authentication or hosting changes were needed.

## Confirmed findings and fixes

All findings below are implemented.

| Priority | Finding and reproduction | Change |
| --- | --- | --- |
| High | A cold `#/objects/gebaeude?tab=relations` link opened Overview and removed the requested tab. Rows and History had the same problem unless a special row-filter condition applied. | Supported explicit tabs now win on cold loads, reloads and history traversal. Unsupported tabs retain the existing safe fallback. |
| High | Opening an unqualified profile, following another profile's Rows link, then pressing Back changed the original Overview into Rows. The original history entry had never recorded its default. | Every resolved profile tab, including `overview`, is written to its history entry. Implicit consecutive-profile tab carry remains available without changing previously visited pages. |
| High | A GWR field list with no explicit sort inherited descending order after visiting a different field list and pressing Back. `sort=name:desc:extra` was also accepted as descending. | Route entry clears the affected cached sort before reading the URL. Sort syntax must contain exactly one field and a supported direction; the field must be visible and sortable. Missing row-table sorts restore source order; collections use their normal name order. A `view` value on an unrelated route no longer changes collection layout preferences. |
| Medium | `#/tables/t-geb-gis?tab=rows&fields=name&page=999&size=17` displayed the clamped page while leaving `999` and the unsupported size in the address. | Detail pagination now serializes the same validated page/size used by rendering, including after local filtering. Defaults are omitted. |
| Medium | Search ignored duplicate/unknown type and domain values but retained them in the URL. Invalid AI settings also remained in the address. | The existing search-scope serializer now participates in URL normalization. Explicit empty selections remain `none`, so normalization cannot accidentally broaden the search. |
| Medium | After visiting a handbook chapter, opening `#/manual` highlighted the old chapter while starting at the introduction. Chapter clicks also replaced rather than added history, and passive scrolling left an outdated chapter URL. | A chapterless link resolves to Introduction. Explicit chapter links push history; passive chapter changes replace the current entry. Legacy aliases normalize to English IDs. Navigation clears an obsolete smooth-scroll tracking lock. |
| Medium | Delegated chapter actions prevented the browser's normal modified-click behavior. | Modified anchor clicks, links targeting a new tab and download links bypass the app's ordinary click actions. Keyboard activation of ordinary links remains supported. |
| Medium | `nav=container` survived collection links but disappeared when opening a field, a header destination or a footer link. The tree switched back to its configured model. | Shared `router.href()` carries only the validated explicit navigation override. Entity/list/search, profile, graph, handbook, header, footer and recovery links use it. `router.build()` and parameter writes remain independent of navigation defaults. Invalid overrides normalize away. |
| Medium | Printing `#/systems/sap?tab=rows&fields=name&sort=name:desc` reverted to alphabetical order. Attribute/field ordering was likewise not captured. | Print captures ordered IDs from the complete source row set and applies them to its frozen snapshot. System entries and child rows retain the web sort. Child-row exports still include all source rows regardless of the current web filter/page. Changing print scope clears the inherited order. |

The initial browser baseline failed 9 of 11 scenario checks. Additional investigation reproduced navigation-context loss and system-to-print sort loss. The expanded routing suite now passes all 16 scenario groups, including the catalog route matrix.

## URL contract

| State | Rule |
| --- | --- |
| Paths and IDs | Hash routes remain case-sensitive. Builders percent-encode entity and child IDs; parsing decodes once. Malformed encoding and unsupported route shapes produce Not Found. Existing parent-scoped child identity is retained. |
| `tab`, `view`, `group` | Explicit supported values win. Resolved collection defaults and profile tabs are recorded in the current history entry. Domain legacy aliases retain their documented mappings. |
| `fields` | Comma-separated shared field IDs, normalized to the configured order. Mandatory names remain visible; retired/unknown choices are discarded. URL selection wins over browser preferences. |
| `sort` | Collections and detail rows use `field:asc` or `field:desc`. Global search uses `relevance`, `name` or `modified`. Each consumer validates its own vocabulary. |
| `filter`, `q` | Local filtering and submitted global search remain separate. Live local typing replaces URL state and preserves the input node, caret and IME composition. Unsubmitted global-search edits remain temporary. |
| `types`, `domains`, `ai` | Search scopes normalize against known IDs. Missing means unrestricted; `none` means an explicit empty selection. `ai=0` disables the demo answer. |
| `page`, `size` | Safe positive page numbers and supported sizes only; results clamp pages to available content. Page one and default sizes are omitted. |
| `ch` | Canonical handbook chapter ID, with legacy aliases accepted. Explicit links push history; scroll tracking replaces it. |
| `nav` | Only `entity` and `container` are accepted. The explicit override travels through app links; it does not change configuration or stored preferences. |
| Other parameters | Unknown query keys remain inert and are retained for compatibility. For repeated scalar keys, the last value wins; named multi-selections use their documented comma-separated form. |
| Hosting URL | Hash-state writes preserve the deployment pathname and any query outside the hash. |

`hashchange` remains the navigation event. Push/replace helpers leave rendering to their callers; Back/Forward between distinct hashes triggers the hash handler. Adding a second unconditional `popstate` render would duplicate work. In-place checkbox, grouping and filter edits continue to replace rather than flood browser history.

## Validation

Checks use local fixture servers and headless Edge. The routing and visibility suites were run against a locally imported PostgreSQL-compatible PGlite catalog served through an intercepted Supabase snapshot response. No hosted data was changed.

| Check | Result |
| --- | --- |
| `node prototype-oblique/tests/core.test.cjs` | 44/44 passed, including encoded IDs, strict sorts, safe links, pure serialization, contextual hrefs and responsibility grouping. |
| `node prototype-oblique/tests/routing.cjs` | 16/16 scenario groups passed: cold links/reloads, Back/Forward, source order, canonical parameters, handbook scrolling and modified clicks, navigation context, outer hosting query, hostile values and print handoff. Covers all seven catalog collection families, supported profile tabs, and nested field/attribute routes. |
| `node prototype-oblique/tests/functional.cjs` | Passed, including desktop/mobile search and history, domain aliases/scopes, keyboard navigation, Swagger mount retention, navigation during delayed loading and retry. |
| `node prototype-oblique/tests/list-search.cjs` | Passed at 320, 390, 768, 1280 and 1920 px: all-row filtering, pagination, IME, focus, reload, Back and export scope. |
| `node prototype-oblique/tests/visibility.cjs` | Passed: field preferences, URL restoration, responsive layouts, shared ordering and PDF generation. |

The functional suite had two stale assertions: one assumed a detail destination could not acquire its resolved `tab`, and another still expected the previous description/responsibility column order. Both now check the current behavior. No application workaround was added for those assertions.

`routing.cjs` writes `routing-before.json` / `routing-after.json` under `oblique-diagram-export` in the OS temporary directory. `REPORT_ONLY=1` records a baseline without failing. See the test guide for Playwright/PGlite setup.

## Boundaries retained

- Language remains a browser preference. Graph pan/zoom/selection, the temporary relationship list/diagram switch, open menus and disclosure state are not shareable URL state.
- The print workspace inherits the current catalog view but is not itself a bookmarkable document editor. Paper, zoom, document settings and later print-scope changes remain temporary; closing or route navigation cancels the workspace.
- Swagger has hash deep-linking disabled so it cannot replace the catalog route. Its network/lifecycle checks passed; API authorization remains separate from frontend routing.
- Parent/child identities and comma-separated selection formats are unchanged. Any future arbitrary identifier format must account for those existing delimiters before introducing new IDs.
- These checks cover Edge automation and simulated narrow viewports. They do not establish physical-device or all-browser conformance.

## References

- [Architecture and route ownership](../architecture.md#routing)
- [Current interaction contracts](../behavior.md)
- [Router implementation](../../js/router.js)
- [Application state and history integration](../../js/app.js)
- [Print snapshot and ordering](../../js/diagram-content.js)
- [Routing regression suite](../../tests/routing.cjs)
- [Test setup](../../tests/README.md)
