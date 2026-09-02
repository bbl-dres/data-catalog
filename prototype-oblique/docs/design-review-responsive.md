# Design review: responsive layout and entity flow

Date: 2026-09-02

Scope: `prototype-oblique`, with emphasis on small laptops, tablets, phones, content hierarchy, and the flow from catalog navigation to an entity profile. The measurements describe the original baseline; the implementation status and verification results describe the revised prototype.

## Executive recommendation

The profile itself has a sound basic structure, but the navigation and page chrome delay the content too much. The problem becomes severe below roughly 950 px: the complete catalog tree moves above the profile, so selecting an entity can appear to have done nothing.

The recommended direction is:

1. Keep one persistent `h1` with the entity name on every profile and on every tab.
2. Remove the generic **Beschreibung** heading. Present the description as a lead paragraph under the persistent identity header.
3. Do not replace **Beschreibung** with the entity name inside the overview panel. That would either duplicate the existing `h1` or make the entity name disappear on the other tabs.
4. Treat `.ob-page-header` and `.ob-page-title` as layout implementation details, not as required components. Use one compact `.ob-view-header` pattern for search, handbook, L0 collections, and L1 profiles. The KPI-led **Übersicht** needs no additional view header, while the API is a deliberate exception because Swagger UI supplies its own title.
5. Below the two-column layout threshold, replace the full inline tree with a closed catalog disclosure or drawer. The selected entity's content must come before the complete navigation tree.
6. Rename **Ansprechpersonen** to **Verantwortlich**, remove the redundant generic **Verantwortung** fact, and remove the English role subtitles (`.ob-fact-en`).
7. Stop rendering `sourceDetail` as `.ob-fact-sub` under **Führendes System**. Keep the value in the data/export if needed, but not in the primary profile view.
8. On phones, use list/card alternatives for tables and relationships rather than relying on horizontal scrolling and the orbit graph.

These recommendations are now implemented. Subsequent product decisions also remove the duplicated entity-meta line, keep status as a chip in **Kerndaten**, render facts as **label : value**, remove count and generic responsibility facts, place white group headers outside the bordered group body, model **Datenhalter** as the system-specific contact role, and align L0 collection titles and view tabs with L1.

## Evidence from the current layout

The following routes were rendered and inspected:

- `#/domains/bau`
- `#/objects`
- `#/objects/gebaeude`
- `#/objects/gebaeude?tab=relations`

Measurements were taken in headless Edge at 1366, 1024, 906, 905, 768, 600, and 390 CSS pixels wide. The test height was 768 px unless noted otherwise.

### Vertical position of the useful content

| Viewport | Route | Navigation layout | Profile content starts | Content width | Result |
|---|---|---|---:|---:|---|
| 1366 px | Domain | Side by side | 352 px | 963 px | Usable, but 46% of a 768 px screen is consumed before the profile begins |
| 1024 px | Domain/object | Side by side | 352 px | 621 px | Readable, but narrow for tabs and data tables |
| 906 px | Domain | Tree above content | 971 px | 827 px | Profile is below the first screen |
| 905 px | Business object | Tree above content | 1331 px | 858 px | Profile begins 563 px below the first screen |
| 390 px | Domain | Tree above content | 1018 px | 343 px | The user must pass the entire tree before seeing the selected domain |
| 390 px | Business object | Tree above content | 1378 px | 343 px | The selected object begins more than 1.6 screen-heights down |

The explicit breakpoint is 905 px, but the layout already wraps at 906 px because the flex bases and gaps need about 950 px. This creates an accidental breakpoint rather than a deliberate responsive state.

The selected business object's tree is 955 px high because the current domain and its objects are expanded. On a 768 px-high laptop, the navigation itself is taller than the viewport.

### Phone-specific failures

At 390 px:

- The federal logo and utility controls consume the entire header row. `.ob-header-titles` is only 9 px wide and both the organisation and app-title text have a measured content width of 0 px. The application name is therefore effectively absent.
- The header utilities take 234 px: prototype badge, disabled language control, help, and avatar. These are given priority over the app identity.
- The tab strip has 343 px of visible width but 501 px of content. Horizontal scrolling works technically, but there is no cue that more tabs exist and a deep-linked active tab can start off-screen.
- The relationship graph is 343 × 520 px, but its fixed 1000 px orbit canvas leaves much of the diagram outside the visible area and provides no compact reading order.
- List and detail tables depend on horizontal scrolling and do not provide a compact card representation or a visible overflow cue.

### Where the vertical space comes from

On a 1366 px-wide profile:

- Global header and navigation: 139 px
- Main top padding and breadcrumb: profile title begins at 207 px
- `h1`: 32 px
- `.ob-page-header` bottom margin: 32 px
- Search/actions toolbar and following gap: content begins at 352 px
- Tabs and their bottom gap: overview content begins at 425 px

Removing the `.ob-page-header` wrapper alone is not the complete answer. The class only contributes its 32 px margin, while the `h1` remains necessary. The larger improvement comes from changing the detail-page composition and removing redundant headings.

## Current user flow

The main catalog flow is:

```text
Home or search
  -> catalog section
  -> group/container in the tree
  -> container profile
  -> child entity
  -> entity profile and tabs
```

There are also direct paths from a list tile, table row, search result, or relationship node to an entity profile.

### Important source of confusion

The example **Architektonische Sicht** is not a Geschäftsobjekt. It is a **Domäne** displayed as a grouping node beneath **Geschäftsobjekte** in the entity-first navigation model. Clicking its label opens the domain profile, whose second tab is **Geschäftsobjekte**. This behavior is internally consistent, but the entity-type change is not explicit in the interface.

The breadcrumb reads:

```text
Datenkatalog > Geschäftsobjekte > Architektonische Sicht
```

It does not say that the current profile represents a domain. A user can reasonably interpret the final item as a business object.

Recommended clarification:

- Add a small entity-type eyebrow or badge above the profile title: **DOMÄNE**, **GESCHÄFTSOBJEKT**, **DATENTABELLE**, and so on.
- Keep the entity name as the only `h1`.
- Make expand-versus-open behavior explicit in the tree. The chevron should be a separate, adequately sized disclosure button; the label should remain the link to the profile.
- On narrow screens, show the current path and a **Katalog öffnen** control instead of the full tree.
- Do not default a domain link to the **Geschäftsobjekte** tab merely to hide the ambiguity. The overview is a reasonable destination for a real domain profile; the missing element is a clear type cue.

## Consistency of profiles and sections

### Tabs

All entity profiles share the same outer mechanism, but they do not all have the same tabs. This is mostly appropriate because the second tab represents the entity's contained rows.

| Entity type | Persistent tabs | Type-specific second tab | Notes |
|---|---|---|---|
| Domain | Übersicht, Beziehungen, Verlauf | Geschäftsobjekte | Container profile |
| System | Übersicht, Beziehungen, Verlauf | Datentabellen | Container profile |
| Geschäftsobjekt | Übersicht, Beziehungen, Verlauf | Attribute | Direct business profile |
| Attribut | Übersicht, Beziehungen, Verlauf | None | Its history currently comes from the parent business object |
| Datentabelle | Übersicht, Beziehungen, Verlauf | Felder | Physical data profile |
| Werteliste | Übersicht, Beziehungen, Verlauf | Werte | Empty lists still have the tab and show an empty table |
| Datenprodukt | Übersicht, Beziehungen, Verlauf | Attribute | The tab remains available and shows an empty state when no attributes are recorded |
| API | Übersicht, Beziehungen, Verlauf | None | No endpoint/detail-row tab |

The stable pattern is therefore **Übersicht → optional contents → Beziehungen → Verlauf**, not four identical tabs. That pattern should be documented and preserved.

Recommended adjustments:

- Keep the three stable tabs in the same order.
- Keep a type-specific contents tab when that collection is part of the entity model, even when it is empty. For example, an attribute-capable data product should show an empty-state **Attribute** tab rather than changing the tab set based on today's data.
- Clarify inherited content. An attribute's **Verlauf** is the business object's history, not attribute-specific history; label it accordingly or do not show it until attribute history exists.
- Ensure the active tab is scrolled into view on narrow screens and add an overflow cue to the tab strip.

### Tab continuity between profiles

The selected tab should express the user's current task, not be reset merely because the selected entity changes. Use the internal semantic tab IDs rather than the displayed labels: `rows` can mean **Geschäftsobjekte**, **Attribute**, **Felder**, or **Werte**, depending on the entity type.

Recommended behavior:

- When navigating directly from one profile to another by tree, breadcrumb, relationship, table row, or internal link, keep the active semantic tab if the destination supports it.
- If the destination does not support that tab, fall back to **Übersicht**. For example, an attribute has no `rows` tab.
- After that fallback, **Übersicht** becomes the current tab; do not retain an unavailable tab as hidden intent.
- Entering a profile from home, a section list, or the search-results page starts at **Übersicht**.
- A fresh browser load always starts at **Übersicht**, even if the incoming hash contains a `tab` parameter. Tab continuity is transient interaction state, not a preference stored in `localStorage` or `sessionStorage`.
- Keep the active tab in the hash during the in-app session so browser history and copied current-state URLs remain understandable. A reload still normalizes the view to **Übersicht**.

Examples:

```text
Gebäude / Attribute -> Grundstück / Attribute
Gebäude / Beziehungen -> SAP RE-FX / Beziehungen
Gebäude / Attribute -> Attribut EGID / Übersicht  (fallback: no rows tab)
Geschäftsobjekte list -> Gebäude / Übersicht
Fresh load of ...?tab=relations -> ... / Übersicht
```

### Overview sections

Every entity currently uses the same overview headings:

1. **Beschreibung**
2. **Verantwortlich**
3. **Kerndaten**

The markup is consistent, but the information is not equally meaningful for every entity type:

- Business objects, attributes, tables, code lists, products, APIs, domains, and systems all use the same contact labels.
- Attribute contacts are inherited from the parent business object, but the UI presents them as if they belong directly to the attribute.
- The original facts list mixed high-value context, governance, technical metadata, dates, IDs, counts, and placeholder links in one long section.
- Type-defining facts such as domain, system, realised business object, source authority, or access rights often appear after generic provenance fields.

Recommended overview contract:

```text
ENTITY TYPE
Entity name                                                Actions
The breadcrumb supplies the primary parent/context

Tabs

Lead description paragraph (no "Beschreibung" heading)

Verantwortlich
German role label                          Person

Kerndaten
Most important type-specific facts first

Weitere Metadaten (optional/collapsible)
ID, version, created, modified, synced, source and similar provenance
```

This keeps the profile recognizable across all types while allowing the content to reflect the entity.

## Decision on `.ob-page-header` and **Beschreibung**

### `.ob-page-header`

The class is not semantically important. It wraps the `h1` and adds `margin-bottom: 32px`; it is emitted for every route by `views.page()`.

Recommendation:

- Do not remove the page's `h1`.
- For non-detail pages, simplify the component to a normal page title with a smaller responsive gap.
- For detail pages, move the entity identity into `.ob-content`, above the tabs, so it stays visually associated with the profile rather than the catalog tree.
- Move the detail **Aktionen** control into that entity-header row.
- Keep the global search separate from entity identity. On smaller screens it can collapse to a search control or remain as a full-width row.

This is preferable to globally deleting the header because lists, search, handbook, API, and not-found pages still need a clear page title.

### **Beschreibung**

The heading has low information value when the section contains one introductory paragraph. It also creates an additional heading and gap directly below the tabs.

Recommendation:

- Remove the **Beschreibung** `h2`.
- Render the description as a visually prominent but normal lead paragraph.
- Do not replace the heading with the entity name inside the overview panel.
- Keep the entity name in the persistent `h1` above the tabs so it is present on **Attribute/Felder/Werte**, **Beziehungen**, and **Verlauf** as well as **Übersicht**.

### English role subtitles

The `.ob-fact-en` spans are used only for **Data Owner** and **Local Data Steward** beneath the German labels. The UI is German, and the handbook already explains the role mapping.

Recommendation:

- Remove both spans from the profile.
- Remove the unused `.ob-fact-en` CSS rule and the two detail-only translation keys.
- Retain the English terminology in the handbook/information-model documentation where it has explanatory value.

### Source-detail subtitle

The `.ob-fact-sub` element was used only to render `sourceDetail` beneath **Führendes System**. That implementation mixed a labelled fact with an unexplained secondary value.

Recommendation:

- Do not render this secondary line in the main facts list.
- Remove the generic `sub` branch and `.ob-fact-sub` CSS if they have no other use.
- Keep `sourceDetail` in the JSON and exports. If it becomes important later, show it as an explicitly labelled item under **Weitere Metadaten**, not as an unlabeled subtitle.

## Responsive recommendations

### Priority 0: make the selected content visible

1. Replace `flex-wrap` as the mechanism that chooses the catalog layout. Use an explicit two-column layout at large widths and an explicit drawer/disclosure state below it.
2. At approximately 960 px and below, hide the full tree behind **Katalog öffnen**. Preserve the selected path in the breadcrumb and control label.
3. Do not render the full tree before home or list content on mobile. Home already has KPI navigation, so the tree is redundant there.
4. On 1024 px laptops, reduce the tree column from 300 px to about 240–260 px or allow a user-controlled collapse. This gives tables and facts more room without removing navigation.

### Priority 0: repair the mobile header

1. Remove the disabled language selector until it is functional.
2. Prioritize a readable **Datenkatalog** title over the prototype badge and avatar.
3. Hide or move nonessential utilities into an overflow menu on phones. Keep help reachable.
4. Test the header at 320, 375, 390, and 600 px. It must not create horizontal overflow and the app name must remain visible.

### Priority 1: compact the profile hierarchy

1. Introduce a detail-specific entity header inside `.ob-content`.
2. Reduce main top padding and title/toolbar gaps at laptop heights, not only at phone widths.
3. Remove the **Beschreibung** heading, `.ob-fact-en`, and `.ob-fact-sub` output.
4. Keep the entity type next to the title and let the breadcrumb carry its parent context. Avoid a second meta line that repeats the breadcrumb.
5. Order facts by user value. Keep status in **Kerndaten**, remove derived count facts, and put identifiers and synchronization metadata in a collapsed **Weitere Metadaten** section.

### Priority 1: make tabs and dense content responsive

1. Keep tabs horizontally scrollable, but show an edge fade/overflow hint and scroll the active tab into view.
2. Use card or labelled-row layouts for detail tables below 600 px. Do not require users to remember column headers while scrolling sideways.
3. Default catalog lists to tiles/cards on a fresh load, but keep both labelled presentation tabs available on narrow screens and preserve an explicit user choice.
4. For 768–1100 px, consider hiding low-priority list columns before introducing horizontal scrolling.

### Priority 1: provide a relationship-list alternative

The orbit graph is a desktop exploration tool, not a good primary mobile representation. The underlying relation groups already exist as structured data.

1. On phones and tablets, show grouped relationship lists/cards first.
2. Offer **Diagramm anzeigen** as an optional secondary view.
3. Keep controls outside the drawing surface if they are reintroduced; the former in-canvas control panel has been removed.
4. Preserve the same group labels and links in both list and graph modes.

### Priority 2: improve navigation semantics

1. Do not nest the disclosure button inside the tree link. Use separate interactive elements with separate accessible names.
2. Give the disclosure control an adequate pointer target rather than the current 16 × 24 px control.
3. Make the current entity type explicit in the title area and make the current path concise on mobile.
4. Apply the same collapsed-navigation approach to the handbook chapter tree.

## Suggested page anatomy

### Desktop and small laptop

```text
Global header
Primary navigation
Breadcrumb
Global search

+----------------------+  +---------------------------------------------+
| Catalog tree         |  | DOMÄNE                                      |
|                      |  | Architektonische Sicht          [Aktionen] |
|                      |  |---------------------------------------------|
|                      |  | Übersicht | Geschäftsobjekte | ...          |
|                      |  |                                             |
|                      |  | Physische Gebäudehierarchie ...             |
|                      |  |                                             |
|                      |  | Verantwortlich                              |
|                      |  | Kerndaten                                   |
+----------------------+  +---------------------------------------------+
```

### Tablet and phone

```text
Compact global header
Primary navigation
Breadcrumb
[Katalog öffnen] [Suchen]

GESCHÄFTSOBJEKT
Gebäude                                      [Aktionen]
Scrollable tabs with overflow cue

Lead description
Verantwortlich
Kerndaten
Weitere Metadaten
```

The tree opens on demand as a drawer or disclosure; it does not precede the selected profile in document order.

## Implementation map

The review was implemented in these areas:

- `js/views.js`
  - Share the compact view-header composition between overview, search, handbook, collection, and detail routes. Use a title row only where collection or entity actions need it, and let Swagger UI own the API title.
  - Replace the icon-only L0 view switch with labelled, text-only **Kacheln** and **Tabelle** tabs; keep grouping beside these local view controls.
  - Add the compact catalog-navigation trigger.
  - Render whole-card KPI links and neutral entity links in tables.
- `js/detail.js`
  - Add the persistent entity identity/type treatment and semantic tab contract.
  - Remove the **Beschreibung** heading.
  - Remove `.ob-fact-en` and `.ob-fact-sub` markup.
  - Reorder/group facts, remove count facts, generic responsibility, and placeholder repository links; rename the role section to **Verantwortlich**; add **Weitere Metadaten** and relation-list rendering.
- `js/app.js`
  - Manage mobile catalog drawer state, keyboard-accessible collection/detail tabs, active-tab scrolling, view-mode persistence, and detail-to-detail tab continuity.
- `css/main.css`
  - Replace accidental flex wrapping with explicit responsive states.
  - Implement compact header, entity header, navigation drawer, tab overflow cue, card tables, and the responsive relationship alternative.
  - Use a narrower small-laptop catalog rail, neutral links, responsive collection title/view controls, white group headers outside the bordered group body, and 44 px tree disclosure targets.
- `data/i18n.json`, `data/model.json`, `data/systems.json`, and `data/tables.json`
  - Align labels and sample data with the simplified profiles.
  - Replace **Systembetrieb** with **Datenhalter**, remove system scan metadata, and support an optional real information URL without creating placeholder links.
  - Give Datentabellen a **Datenhalter** with a table-level override and system fallback; remove scan, source shortcut, responsibility, and certification claims from their profile.
  - Use **Letzte Änderung** for the existing `modified` value and keep provenance details under **Weitere Metadaten**.

## Acceptance criteria

- No horizontal page overflow at 320, 375, 390, 600, 768, 905, 1024, and 1366 px.
- The app name remains readable in the global header at 320 px.
- After opening an entity at 768 or 905 px wide, its type, name, actions, and tabs are visible in the first viewport without scrolling past the complete catalog tree.
- Every detail route has exactly one persistent `h1`, including non-overview tabs.
- Search, handbook, L0 collections, and L1 profiles share `.ob-view-header`; the KPI-led **Übersicht** renders no view header, no `.ob-page-title` remains, and Swagger UI supplies the API title without a duplicate application heading.
- All eight handbook chapter labels are visible in `number. title` form, match their body headings, and update the URL, active state, and scroll position when selected.
- The governance-role table has no English secondary line or `.ob-cell-sub` treatment.
- The overview description has no redundant **Beschreibung** heading.
- No `.ob-fact-en` or `.ob-fact-sub` markup remains in profile output.
- No profile offers a placeholder **Im Repository öffnen** link.
- L0 collection routes use the same title-row hierarchy as L1 profiles and expose **Kacheln** and **Tabelle** as labelled text tabs without icons.
- L0 collection and L1 entity headers place their description in the title copy beside the actions. Entity descriptions remain visible across tabs and are visually capped at two lines.
- Grouping menus contain only the grouping labels, without group counts or explanatory secondary text.
- Overview KPI cards omit the secondary subtitle and align their count line at the bottom of the card.
- Collection tiles use the entity description, capped at two lines, instead of responsibility and item-count metadata.
- The selected collection view survives navigation between L0 routes; a fresh load without a `view` parameter defaults to **Kacheln**.
- Fact punctuation follows the label (`Status :`), and profiles contain neither a generic **Verantwortung** row nor an **Ansprechpersonen** heading.
- Active tabs are visible on load and after navigation at 390 px.
- Detail-to-detail navigation retains `rows`, `relations`, or `history` whenever the destination supports it; unsupported tabs fall back to **Übersicht**.
- Fresh loads and entries from non-detail views open **Übersicht** and do not reuse a previous profile tab.
- Dense tables have a usable labelled mobile presentation.
- Catalog data tables sort by any column in ascending or descending order; the active header has a visible direction icon and `aria-sort`, grouped tables share their column sort, and detail rows sort before pagination.
- Relationships are understandable without manipulating the graph.
- Tree disclosure and profile navigation use separate, keyboard-accessible controls.
- Desktop catalog and handbook trees stick to the viewport's top edge, size their scrollport to the currently visible height, and retain native scroll chaining to the page.
- Systems and Datentabellen show **Datenhalter**; Datentabellen inherit it from their system unless they define an override.
- Datentabellen contain no certification or active-scan wording, grouping, KPI, or profile fact.
- Group headers use a white background and sit outside the bordered table/tile body.
- The tab matrix remains consistent with the entity capabilities described above.

## Verification after implementation

- Headless Edge measurements at 320, 375, 390, 600, 768, 905, 1024, and 1366 px found no horizontal page overflow and exactly one `h1` on the tested profile.
- At 960 px and below, the catalog is absent from the content flow and opens as a drawer. The app title remains visible at 320 px.
- A 24-check interaction harness passed tab continuity and fallback, fresh-load normalization, keyboard drawer dismissal, system-role content, relationship list/diagram switching, mobile table labels, neutral links, whole-card KPIs, and group-header contrast.
- Visual checks covered the 390 px profile, the 768 px compact profile, and the 1024 px table layout.
