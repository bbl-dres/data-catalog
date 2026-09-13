# Detail pages and tabs — design and UX review

**Date:** 13 September 2026  
**Status:** Analysis only. All recommendations below are proposals; none were implemented during this review.  
**Audience:** The internal catalog users and the people maintaining its definitions.

## Assessment

The existing detail-page structure is a sound foundation. The title and definition, familiar tabs, consistent fact rows, and restrained visual style suit a small internal catalog. Keep this structure and the recently added section disclosures. A broad visual redesign would add less value than improving a few complete tasks.

The highest priorities are the mobile row editor, the default relationship view, and the visibility of record status outside Overview. The next priorities are finding tabs on small screens, preserving context when entering edit mode, and making history useful for reviewing changes. These issues become much clearer with the live catalog than with the smaller offline fixtures.

This is an expert inspection with browser evidence, not a usability study or a certification of WCAG compliance. Observations are distinguished from recommendations and hypotheses below.

## Scope and method

Reviewed the running application at `http://localhost:8000/Documents/GitHub/data-catalog/prototype-oblique/`, using its current Supabase public snapshot and current working-tree frontend. No hosted records, settings, accounts, or permissions were changed.

- **Main examples:** Gebäude, Bemessung, Bauteil, Bauarbeiten, and the Architektonische Sicht domain.
- **Variants:** Bemessung-ID attribute, GWR EGID field, BBL Bemessungsart values, and the SAP building API profile.
- **Views:** Overview, child rows, relationship diagram and list, history, column picker, export menu, empty results, and empty records.
- **Viewports:** 1440 × 1000 desktop, 1280 × 720 laptop, 390 × 844 phone, and 320 px width. Additional translated narrow-screen checks used FR/IT/EN; the English finding was also reproduced through the actual language menu.
- **Interaction checks:** Tab/arrow/End navigation, disclosure controls, column-picker Escape/focus return, filtering, parent-to-child navigation, and entry into editing.
- **Editor inspection:** A separate fresh browser context used locally mocked authentication and edit-capability responses with real public catalog content. Save requests were blocked. No account was created and no draft was saved. This verifies the rendered editor and navigation, not hosted authorization or save/conflict behavior.
- **Source cross-check:** [detail.js](../../js/detail.js), [views.js](../../js/views.js), [app.js](../../js/app.js), [field-picker.js](../../js/field-picker.js), [graph.js](../../js/graph.js), [editor.js](../../js/editor.js), their CSS, and the maintained [behavior](../behavior.md), [design system](../design-system.md), and canonical [data model](../data-model.md).

Live counts at inspection: Gebäude had **33 attributes, 23 relationship entries, and 39 history events**; Bemessung had **14 attributes**. Counts and content may subsequently change. A selected evidence set is retained beside this document; screenshots show existing catalog content, not proposed mockups.

Not assessed: a real screen-reader session, Safari/iOS behavior, native browser zoom at every magnification, real-user task success, authenticated saves, or the complete PDF/Excel output. Export observations concern entry points and documented scope.

## What should be retained

1. **The four-tab concept.** Overview, attributes/fields/values, relationships, and history reflect distinct user questions. Domain Overview/Tiles/Table is a reasonable variant for a container that also lists members.
2. **Canonical terminology.** Field aliases should continue to come from `docs/data-model.md`. This review does not propose independently renaming domain attributes in CSS, forms, or export code.
3. **The new disclosures.** Full-width heading buttons, 44 px minimum targets, down/up chevrons with right inset, and independent sections work well. Keep System initially closed and other sections initially open. Keyboard activation and state preservation within the current entry are useful.
4. **Compact fact tables and restrained styling.** Consistent typography, aligned values, light separators, and sufficient whitespace support scanning. The empty space below the shorter responsibility column is not, by itself, a problem requiring more panels or decoration.
5. **Existing recovery and navigation behavior.** Filtered lists explain an empty result and offer reset. The column picker restores focus on Escape. Arrow keys activate tabs and keep focus on the selected tab; End reaches the final mobile tab. Breadcrumbs and typed child routes preserve useful context.
6. **Contained scrolling in the public lists.** The inspected public pages did not widen the document at 320–1440 px. Wide tables provide a horizontal-scroll hint. Preserve this while improving their mobile presentation.

## Priority summary

P1 means address before relying on the affected workflow for routine use. P2 means a material improvement for the next usability pass. Effort is relative design/implementation size, not a delivery estimate.

| ID | Priority | Finding | Evidence | Effort |
|---|---|---|---|---|
| UX-01 | P1 | Mobile row editing widens the document | Measured in simulated signed-in UI | Small–medium |
| UX-02 | P1 | Default relationship diagram obscures much of the relationship set | Live desktop and phone | Medium |
| UX-03 | P1 | Draft status is unavailable while using other tabs | Live UI and renderer | Small |
| UX-04 | P2 | Mobile tab discoverability and tab semantics need refinement | Live keyboard/DOM inspection | Small–medium |
| UX-05 | P2 | The page spends too much vertical space before the active task | Measured layouts | Medium |
| UX-06 | P2 | Entering edit mode loses the user's task context | Simulated signed-in UI and source | Medium |
| UX-07 | P2 | History presents records but poorly explains changes | Live content, empty state, and source | Medium |
| UX-08 | P2 | Column selection and saved order are difficult to understand together | Live picker and canonical behavior | Small–medium |
| UX-09 | P2 | “Excel: Diese Ansicht” overpromises correspondence with the active tab | Menu and export contract | Small |
| UX-10 | P2 | Structural tab labels remain German in other UI languages | Actual English menu and source | Small |
| UX-11 | P2 | Mobile and keyboard overview order prioritizes contacts over core facts | Live layout and keyboard check | Small; validate priority with users |

## Findings and recommendations

### UX-01 — Contain the mobile row editor

**Observed.** In the simulated signed-in Gebäude editor, selecting **Einträge** and reducing the viewport to 390 px produced a document scroll width of **767 px**. At 320 px it remained **767 px**. The public Attributes page did not have this problem. The editor already has an intended local scrolling region, `.ob-edit-table-scroll`; nevertheless, the page itself acquires horizontal overflow. This is more than a preference for compact versus spacious tables.

The visible editing sequence also becomes cumbersome: three order controls occupy the first column, the name follows, and field values and row actions require horizontal movement. After scrolling down, neither the column headings nor save controls remain in view. See the [scrolled phone editor](2026-09-13-detail-page-ux-review/edit-rows-390-scrolled.png).

**Recommendation.** First fix document containment and examine off-screen/visually hidden descendants as well as visible controls; the exact CSS cause still needs implementation investigation. Retain horizontal scrolling inside the table. For the mobile editing experience, favor a short list of named rows that opens one row's form, while retaining the desktop grid for bulk review. Reordering must remain available with buttons; do not make dragging mandatory.

**Acceptance.** At 320 and 390 px, document width equals viewport width, all row actions remain reachable, and keyboard focus is visible when moving between cells. A user can edit one named attribute and reach Save without losing which row they changed. Check both fresh phone loads and desktop-to-phone resizing. The two-dimensional nature of a table does not justify making the surrounding page overflow; see [W3C's reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

### UX-02 — Make relationships readable before making them spatial

**Observed.** On Gebäude at 1440 px, the default graph uses **75% zoom**. Only one of four group bounds is fully inside its viewport. The data-product group begins below the visible canvas; other groups are partly clipped. Pressing Fit retains the minimum zoom behavior rather than fitting the entire set. At that scale, 12 px node text renders at approximately 9 px.

On a fresh 390 px view the graph canvas starts at **y = 575 px**. The initial screen mainly shows controls, the hub, and the beginning of a group. Other relationship groups require further navigation inside the diagram. [Desktop evidence](2026-09-13-detail-page-ux-review/gebaeude-relations-1440.png) · [Phone evidence](2026-09-13-detail-page-ux-review/graph-default-390.png).

The clipping follows an intentional legibility floor in `graph.fit()` and `--ob-graph-fit-min-zoom`; simply removing that floor would produce even smaller labels. The list alternative already communicates entry, relationship, and context much more directly.

**Recommendation.** Prefer the list on phones and for dense relationship sets, retaining the diagram as an explicit exploration option. Use a clearly selected **Liste / Diagramm** choice instead of relying only on a button named after the opposite mode. In the diagram, distinguish “show the complete structure” from “reset to a readable position”; group counts and access to all groups should remain apparent. Do not shrink the whole graph until it technically fits.

**Acceptance.** A user can find which systems implement Gebäude and which code lists it uses without learning pan mode. Each relationship group is discoverable from the initial view. If list-first behavior changes, update the maintained behavior contract deliberately; the current graph default is documented behavior, not an accidental implementation defect.

### UX-03 — Keep trust context visible across tabs

**Observed.** **Status: Entwurf** appears in Kerndaten. On Attributes, Relationships, and History it is absent, while Print and Export remain prominent. Collapsing Kerndaten also removes that signal from Overview. A user who opens a row-tab link cannot immediately tell whether the definition is a draft. A similarly named attribute, business object, and physical table can also require the breadcrumb or Overview to distinguish their type.

**Recommendation.** Add a quiet, consistent context line near the title containing entity type and status, visible on every tab. It should identify the catalog definition's state, not imply that the underlying system is operationally inactive. Avoid adding all System metadata to this line. This revisits the earlier compact-header choice for a concrete reason: record trust must remain visible during the actual reading/export task.

**Acceptance.** Direct links to every supported tab show the record status without another click. Draft and valid records remain visually distinguishable using text, not only color. Do not label anything approved unless the model and workflow support that meaning.

### UX-04 — Make all tabs discoverable, and complete their semantics

**Observed.** At 390 px on Gebäude, **Verlauf (39)** is not fully visible in the initial Attributes view. A fade and partial label suggest overflow, but they do not tell a new user how many destinations exist. Child-history labels are longer still. Keyboard navigation is better: End successfully selects and reveals History.

The ordinary profile tablist lacks an accessible name. Inactive tabs have `aria-controls` values whose panel elements are absent because only the active panel is rendered. Domain tabs use a named tablist and a shared panel, so the variants differ.

**Recommendation.** Preserve the horizontal tab model, but add a clear, keyboard-operable overflow affordance when necessary, with appropriate disabled/end states. Keep the selected tab fully visible without hiding the fact that another tab exists. Name the profile tablist, and give tab/panel relationships a consistent valid lifecycle; empty stable panel containers can coexist with lazy content rendering.

**Acceptance.** All destinations are discoverable and reachable at 320/390 px and with long translated labels. Arrow, Home, End, Tab, and focus restoration continue to work. Inspect the accessibility tree and test with a screen reader before claiming compliance. These recommendations follow the [WAI-ARIA tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/); missing semantics are not presented here as proof of a particular screen reader failing.

### UX-05 — Reduce the distance to the active task

**Observed.** The complete definition repeats above every tab. For Gebäude on a phone, the attributes table begins at approximately **y = 554 px** after the header, breadcrumbs, title/actions, definition, tabs, search, column picker, and scrolling hint. For the longer Bauarbeiten definition, the tablist itself begins at **y = 492 px**. In the phone editor, the row table begins at approximately **y = 858 px**, below the initial viewport.

Long lists then scroll the title and tab controls out of view. Public row tables have sticky headers in applicable layouts, but that does not keep record identity or the tab destinations available. [Phone Attributes](2026-09-13-detail-page-ux-review/rows-viewport-390.png).

**Recommendation.** Keep the full definition easy to read on Overview. On other tabs, consider a compact definition disclosure with a short introduction and access to the full wording; do not truncate the canonical text itself. Prototype a modest sticky context/tab row after the main title scrolls away. On mobile, give search priority and make the column picker a compact neighboring or secondary action where space permits. Avoid stacking multiple sticky toolbars.

**Acceptance.** Readers can reach useful row content sooner and switch tabs after scrolling without returning to the top. Sticky elements must not obscure focused controls or consume most of a short screen; validate against [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). Treat exact height targets as a prototype decision to test, not an arbitrary compliance threshold.

### UX-06 — Preserve the task when entering editing

**Observed.** Starting **Bearbeiten** from Gebäude's Attributes tab opens the editor on **Übersicht**. The user must find the row tab again, now labeled **Einträge** rather than **Attribute**. The title becomes the generic **Eintrag bearbeiten**, with entity identity in the name field and breadcrumb. Name and description remain above all editor tabs. On desktop, the editor tablist starts around **y = 490 px**; on phone it starts around **y = 645 px**.

Individual attribute/field profiles have no direct edit action because editing is owned by the parent. The parent route is available, but the page does not offer an obvious action that opens this specific row in its parent's editor. [Desktop row editor](2026-09-13-detail-page-ux-review/edit-rows-1440.png).

**Recommendation.** Enter editing on the equivalent tab when supported, and retain the child-row name/filter context. Use the same task-specific row label in browse and edit modes. Keep the entry name visible in the editing heading or context line, and locate the editable full definition primarily on Overview. An authenticated child's **Attribut bearbeiten** action could open and expand that row in the existing parent-owned draft, without introducing independent child saves. Provide a reachable save/discard area during long edits.

**Acceptance.** From a named attribute or filtered Attributes list, one edit action reaches the intended row. Returning from editing preserves useful browse context. Existing unsaved-change guards, atomic parent saves, and read-only relationships remain intact. Hosted save and conflict behavior need separate validation; they were not exercised here.

### UX-07 — Turn history into an understandable review surface

**Observed.** Gebäude's 39 events render as one table. A large same-day batch contains technical identifiers such as `gebaeude/abbruchjahr`; many imported entries have an empty **Bearbeitet von** cell. There is no local history search or pagination. The visible date has no time even when an event may have an exact timestamp. On a phone, the useful Details text and attribution are partly outside the initial horizontal viewport. [Phone History](2026-09-13-detail-page-ux-review/history-viewport-390.png).

Bauteil's **Verlauf (0)** renders only column headings, without an empty-state explanation. Child profiles explicitly label inherited parent history, which is good, but this is still poor support for answering “what changed in this attribute?”

**Recommendation.** Group related events using the existing operation/import ID when present, retaining access to every event. Show a readable affected-record name and link, preserve recorded summaries, display time only when known, and use an explicit unknown attribution when the stored name is absent. Provide a history filter and bounded presentation. Prefer stacked event summaries on phones. Add a clear empty-history message. If a child has its own events, expose those before optional parent context.

**Acceptance.** A reviewer can identify the latest meaningful change, its affected entry, and the recorded attribution without reading a large import batch row by row. Do not invent an actor, time, or before/after values. The canonical ChangeEvent already provides typed record references, optional `occurredAt`, names-at-edit-time, summaries, and `importId`; a full field-diff feature would require a separate data-availability assessment. Parent history must remain labeled as such.

### UX-08 — Explain columns and order as separate choices

**Observed.** **Ansicht (4)** opens a long mixed list of display fields. The number denotes visible columns, but could be mistaken for a view count. Choices for order, description, responsibilities, technical properties, and version share one list. The saved row order is initially invisible and has no active sort indicator. After sorting by Name, returning to the saved sequence requires enabling **Zeilenreihenfolge** and sorting that column ascending. **Standard wiederherstellen** in the picker resets columns, not the table's sort.

This behavior is internally consistent with the canonical model, but its meaning is difficult to infer from the controls. [Column picker](2026-09-13-detail-page-ux-review/field-picker-viewport-1440.png).

**Recommendation.** Consider **Spalten (4)** as the control label, and group related options without adding unnecessary nesting. Within the existing dropdown, distinguish column visibility from sorting and offer a clear way to return to saved order. Provide a concise active-sort description when helpful. Keep the position column hidden by default and do not reintroduce the removed standalone saved-order button.

**Acceptance.** A user can state what the number means, distinguish resetting columns from resetting sorting, and return to saved order without guessing. Filters and sorts must not rewrite stored ranks; zero, gaps, ties, and export behavior continue to follow `docs/data-model.md`.

### UX-09 — Make export scope explicit

**Observed.** The same **Excel: Diese Ansicht** and **Excel: Gesamter Katalog** options appear across the profile tabs. The documented review workbook captures the profile scope and its applicable children; it does not reproduce whichever tab happens to be open. In particular, History is not exported as the visible event table. The wording can therefore promise a closer correspondence than the output provides.

**Recommendation.** Use scope-specific wording such as **Excel: Dieser Eintrag** on a profile, with a short explanation of included child rows where needed. Keep the existing distinctions for collection/filter scope. Treat exporting history or a relationship list as separate capabilities rather than implying they already exist. Keep Print and Excel names distinct because their resulting artifacts differ.

**Acceptance.** Before starting an export from Overview, Attributes, Relationships, or History, a user can predict which records and content the artifact will contain. This is a copy/scope recommendation; no export implementation or file content was changed or newly validated in this review.

### UX-10 — Translate structural labels consistently

**Observed.** Choosing English through the actual language menu on Bemessung produced **Overview / Attribute (14) / Relationships (10) / History (18)**. FR and IT checks similarly retained German **Attribute**. `detail.rowsLabel()` takes `data.model.kinds[kind].rows`, which is a fixed German string; surrounding tab labels use the dictionary. Other kind-level names and empty-state insertions use the same static model definitions and merit the same check.

**Recommendation.** Give structural kind and child-list labels the same translation path as the rest of the UI. Keep this distinct from legitimate fallback of authored catalog content when a translation is missing. Use canonical EN/DE terminology and update the model-driven label contract before changing aliases independently.

**Acceptance.** All tab names, child-list labels, and structural empty-state wording use the selected UI language. Missing content translations may still fall back according to the documented policy. Verify long FR/IT labels together with UX-04.

### UX-11 — Validate which overview information should come first

**Observed.** On desktop, Kerndaten is visually at the upper left and Verantwortlich at the upper right. DOM and keyboard order begin with Verantwortlich: pressing Tab from the selected Overview tab focuses its heading first. On phones, responsibility is also the first section. On Gebäude, the core section starts around **y = 624 px**, with Status farther down. [Desktop Overview](2026-09-13-detail-page-ux-review/gebaeude-overview-1440.png) · [Phone Overview](2026-09-13-detail-page-ux-review/gebaeude-overview-390.png).

**Recommendation.** Test a core-facts-first linear order with the five users. It is likely preferable for “what is this and can I use it?”, while the existing order may be better for “who can help me?”. If core-first wins, align DOM, keyboard, and mobile order, retaining responsibility beside core facts on desktop. This is an information-priority proposal, not a claim that the existing order automatically violates WCAG.

**Acceptance.** Users can find both status and the responsible contact quickly and can predict the sequence when switching devices. Retain native heading buttons and disclosure semantics, consistent with the [WAI-ARIA accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/).

## Additional decisions to preserve or validate

- **Kommentar stays in System.** That is an explicit product choice. Keep System collapsed by default. If users repeatedly miss meaningful comments, test a quiet indication that the closed section contains a comment. Do not open all technical metadata automatically or add guessed warnings.
- **Business meaning should not depend on finding a comment.** The canonical model already documents transitional property-set/key-role conventions in comments. Structured grouping and constraints belong to that planned model work; this review does not treat parsing more prose as a design solution.
- **Use missing-value language carefully.** An em dash keeps fact rows compact but does not distinguish unknown, not documented, and not applicable. Avoid silently hiding required/core facts. Test a short explanation or explicit wording for consequential unknowns, particularly responsibilities and the system of record. Do not infer data semantics from emptiness.
- **Keep empty tabs predictable.** Zero counts can help users understand the record's shape. Prefer helpful empty content over arbitrarily removing a standard tab. For an authenticated editor, a context-specific add action may help; anonymous users should not see an action they cannot complete.
- **Do not replace whitespace with decoration.** The desktop hierarchy does not need more card backgrounds, shadows, badges, or icons. Adjust spacing only to solve a demonstrated scanning or task-distance problem, preserving the current disclosure touch target.
- **Do not imply planned functionality is available.** Approval, property sets, richer lineage, wiki content, and quality workflows need their own designs and model decisions. Keep the current detail-page improvements focused on existing tasks.

## Recommended sequence

1. **Correct access and orientation:** contain the mobile editor; complete tab semantics; keep status visible; fix structural translation gaps. These are relatively bounded and improve confidence without changing the overall page model.
2. **Improve the main task paths:** readable relationship default, discoverable mobile tabs, equivalent browse/edit tab labels and entry points, then compact persistent context. Prototype the sticky behavior before applying it to every viewport.
3. **Improve review and configuration:** grouped/readable history, precise export wording, and clearer column/sort choices. Preserve existing data semantics and historical attribution.
4. **Validate information priority:** compare core-first and responsibility-first mobile order with users. Carry property sets, approval, and richer change diffs into their existing future-feature/model discussions rather than expanding this change set implicitly.

Any accepted field or schema change starts in [data-model.md](../data-model.md). Accepted interaction/layout changes should update [behavior.md](../behavior.md) and [design-system.md](../design-system.md). Those maintained documents were not changed by this review.

## Lightweight user validation

Use the five internal users for short task sessions before choosing among the larger layout proposals. Give tasks without naming the control they should use:

| Task | Observe | Relevant findings |
|---|---|---|
| Open a direct Attributes link and decide whether the definition is ready to use | Whether status is found; confidence and explanation | UX-03, UX-05 |
| Find the definition and owner of a building attribute | First destination; reading order; unnecessary navigation | UX-05, UX-11 |
| Find which systems implement Gebäude | List/diagram preference; missed groups; need for pan instructions | UX-02 |
| Find the latest meaningful change to one attribute | Whether parent/batch events are mistaken for that attribute's change | UX-07 |
| Change a named attribute and return to browsing, on desktop and phone | Lost context, scrolling, save reachability, accidental reorder | UX-01, UX-06 |
| Return a sorted list to its stored sequence and predict an Excel export | Interpretation of column count, reset, ordering, and scope | UX-08, UX-09 |

Record completion, wrong turns, assistance, and the user's explanation. Recheck the relevant tasks after a prototype; five colleagues provide useful directional evidence, not statistically representative usability scores.

## Review completion

Public profile captures reported no page-level overflow at the sampled widths and no page errors in the initial capture run. Focused interactions and the separately simulated editor exposed the findings above. These checks do not replace the project's regression suites or a screen-reader audit.

Only this review, its selected screenshots, and the review index were added/updated. Existing uncommitted application work was left intact. **No recommendations have been implemented.**
