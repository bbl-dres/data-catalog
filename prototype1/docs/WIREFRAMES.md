# BBL Datenkatalog – Wireframes

**Version:** 0.2 (draft)
**Owner:** DRES – Kreis Digital Solutions
**Status:** In Review

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Visual Language](#2-visual-language)
3. [Information Architecture](#3-information-architecture)
4. [Layout: Application Shell](#4-layout-application-shell)
5. [Sidebar: Navigation Tree](#5-sidebar-navigation-tree)
6. [Header](#6-header)
7. [Detail View: Structure](#7-detail-view-structure)
8. [Tab Visibility Matrix](#8-tab-visibility-matrix)
9. [Vocabulary Section](#9-vocabulary-section)
   - 9.1 [Vocabulary: List View](#91-vocabulary-list-view)
   - 9.2 [Collection: List View](#92-collection-list-view)
   - 9.3 [Concept: Overview Tab](#93-concept-overview-tab)
   - 9.4 [Concept: Mappings Tab](#94-concept-mappings-tab)
   - 9.5 [Concept: Values Tab](#95-concept-values-tab)
10. [Code Lists Section](#10-code-lists-section)
    - 10.1 [Code List: List View](#101-code-list-list-view)
    - 10.2 [Code List: Overview Tab](#102-code-list-overview-tab)
    - 10.3 [Code List: Contents Tab](#103-code-list-contents-tab)
    - 10.4 [Code List: Mappings Tab](#104-code-list-mappings-tab)
11. [Systems Section](#11-systems-section)
    - 11.1 [System: List View](#111-system-list-view)
    - 11.2 [Dataset: Overview Tab](#112-dataset-overview-tab)
    - 11.3 [Dataset: Lineage Tab](#113-dataset-lineage-tab)
    - 11.4 [Dataset: Quality Tab](#114-dataset-quality-tab)
12. [Data Products Section](#12-data-products-section)
    - 12.1 [Data Product: List View](#121-data-product-list-view)
    - 12.2 [Data Product: Overview Tab](#122-data-product-overview-tab)
13. [Shared Tab: Stakeholders](#13-shared-tab-stakeholders)
14. [Search](#14-search)
15. [Access-Restricted Asset Pattern](#15-access-restricted-asset-pattern)
16. [Responsive Behaviour](#16-responsive-behaviour)

---

## 1. Design Principles

**Solution neutral first.** The catalog presents business concepts independently of their physical implementation. A user searching for "Mietobjekt" finds the concept first, then discovers which systems contain relevant data.

**Progressive disclosure.** The sidebar shows four top-level sections. Clicking a section loads a browsable list in the main area — not an expanded subtree. Depth is navigated via breadcrumbs and the Contents tab, not a deep tree.

**Consistency over completeness.** Every detail view follows the same structure: breadcrumb, title block, tab bar, content. Tabs are hidden when not applicable — never shown empty.

**Public by default.** The frontend is publicly accessible. Access-restricted assets are shown as locked cards — name visible, content hidden, access request link present. They are never hidden entirely.

**Language-aware throughout.** The UI renders in the user's selected language. Missing translations are flagged inline, not silently omitted. The language switcher is always visible in the header.

**Minimal chrome.** Black text on white, generous spacing, light grey surfaces, blue accents for interactive elements, subtle drop shadow on the header only.

---

## 2. Visual Language

```
Colour usage
────────────────────────────────────────────────────
Background         #FFFFFF  white — main content area
Surface            #F7F7F6  light grey — sidebar, cards, table alt rows
Border             #EFEFED  light grey — separators, card borders
Text primary       #2C2C29  near-black — headings, body
Text secondary     #6B6B66  mid-grey — labels, metadata, timestamps
Accent             #0B6FCC  blue — links, active nav bg, buttons
Accent light       #EAF2FB  light blue — active tab background, selected rows
Warning            #C9820B  amber — draft status, missing translation
Success            #1A9E55  green — certified, approved
Danger             #C9372C  red — deprecated, error
Locked             #A3A39E  grey — access-restricted asset text

Typography
────────────────────────────────────────────────────
Font               Inter (system sans-serif fallback)
Page title         24px / 600
Section heading    18px / 600
Card title         16px / 500
Body               14px / 400 / line-height 1.65
Label / meta       11px / 500 / uppercase / tracked
Code               13px / mono

Spacing unit       8px base (4, 8, 12, 16, 20, 24, 32, 40, 48)

Shadows
────────────────────────────────────────────────────
Header             0 1px 4px rgba(0,0,0,0.08)
Card (hover only)  0 2px 8px rgba(0,0,0,0.07)
No other shadows

Icons
────────────────────────────────────────────────────
Set: Lucide (MIT), 16px default, stroke-width 1.5
Section icons:  book-open (Vocabulary), list-ordered (Code Lists),
                database (Systems), package (Data Products)
```

---

## 3. Information Architecture

```
BBL Datenkatalog
│
├── [Search]  ─────────────────── global, always visible in header
│
├── Vocabulary                    skos:ConceptScheme
│   ├── [Collection]              skos:Collection (optional grouping)
│   │   └── Concept               skos:Concept / ArchiMate Business Object
│   │       ├── Overview
│   │       ├── Contents          → Concept Attributes
│   │       ├── Mappings          → Fields that realize this concept (skos:exactMatch)
│   │       ├── Values            → Summary + link to associated Code List
│   │       ├── Relationships     → Broader / narrower / related concepts
│   │       ├── Stakeholders      → Data Owner, Steward, Subject Matter Expert
│   │       └── Feedback
│   └── Concept (ungrouped)
│
├── Code Lists                    skos:ConceptScheme (type=codelist)
│   └── Code List
│       ├── Overview
│       ├── Contents              → Code / value table (the reference data)
│       ├── Mappings              → Concept attributes and fields using this list
│       ├── Relationships         → Related code lists
│       ├── Quality               → Translation completeness, deprecated value %
│       ├── Stakeholders          → Custodian, Steward
│       └── Feedback
│
├── Systems                       bv:System / ArchiMate Application Component
│   └── System
│       └── Schema                bv:Schema
│           └── Dataset           dcat:Dataset (physical) / ArchiMate Data Object + Artifact
│               ├── Overview
│               ├── Contents      → Fields
│               ├── Lineage       → Upstream / downstream flows (prov:wasDerivedFrom)
│               ├── Relationships → Related datasets (relationship_edge)
│               ├── Quality       → Data profile metrics (dqv:QualityMeasurement)
│               ├── Stakeholders  → Data Owner, Steward, Custodian, Subject Matter Expert
│               └── Feedback
│
└── Data Products                 dcat:Dataset (published)
    └── Data Product
        ├── Overview
        ├── Contents              → Distributions
        ├── Lineage               → Source datasets (prov:wasDerivedFrom)
        ├── Relationships         → Related data products
        ├── Quality               → SLA / update frequency health
        ├── Stakeholders          → Data Owner, Steward, Publisher
        └── Feedback
```

---

## 4. Layout: Application Shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER  (56px fixed, drop shadow)                                          │
│  [Logo]          [         Search...           ]    [DE ▾]  [?]  [Login]   │
├──────────────────┬──────────────────────────────────────────────────────────┤
│                  │                                                           │
│  SIDEBAR         │  MAIN CONTENT                                            │
│  (260px fixed)   │  (fluid)                                                 │
│                  │                                                           │
│  Navigation      │  ┌─ Breadcrumb ──────────────────────────────────────┐  │
│  tree            │  │  Vocabulary / Portfolio / Mietobjekt               │  │
│  (see §5)        │  └───────────────────────────────────────────────────┘  │
│                  │                                                           │
│                  │  ┌─ Title block ──────────────────────────────────────┐  │
│                  │  │  [icon]  Mietobjekt                  [✓ Certified] │  │
│                  │  │         CONCEPT · Portfolio                         │  │
│                  │  └───────────────────────────────────────────────────┘  │
│                  │                                                           │
│                  │  ┌─ Tab bar ──────────────────────────────────────────┐  │
│                  │  │  Overview  Contents  Mappings  Values               │  │
│                  │  │  Relationships  Stakeholders  Feedback              │  │
│                  │  └───────────────────────────────────────────────────┘  │
│                  │                                                           │
│                  │  ┌─ Tab content ──────────────────────────────────────┐  │
│                  │  │  (varies by tab — see §9–12)                       │  │
│                  │  └───────────────────────────────────────────────────┘  │
│                  │                                                           │
└──────────────────┴──────────────────────────────────────────────────────────┘

Widths:   Sidebar 260px fixed  │  Main content fluid (min 640px)
Heights:  Header 56px fixed    │  Sidebar + Main scrollable, height: 100vh - 56px
```

---

## 5. Sidebar: Navigation Tree

Four fixed top-level nodes. No deep tree expansion — clicking loads the list view in the main area.

```
┌──────────────────────────────┐
│                              │
│  ┌────────────────────────┐  │
│  │█ 📖  Vocabulary        │  │  ← active: bg #0B6FCC · text #FFFFFF · weight 500
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  🗂  Code Lists        │  │  ← inactive: transparent · primary text
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  🗄  Systems           │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  📦  Data Products     │  │
│  └────────────────────────┘  │
│                              │
│  ─────────────────────────   │
│  RECENTS                     │  ← 11px / 500 / uppercase / secondary
│                              │
│  Mietobjekt                  │  ← 13px / clickable / truncated with ellipsis
│  GWR Gebäudekategorie        │
│  SAP RE-FX / VIBDBE          │
│  GIS IMMO Layer Export       │
│                              │
│  ─────────────────────────   │
│  BOOKMARKS                   │
│                              │
│  Energiebezugsfläche         │
│  eBKP-H Kostengruppe         │
│                              │
└──────────────────────────────┘

Active:  bg #0B6FCC · text #FFFFFF · border-radius 8px
Hover:   bg #EFEFED · text unchanged
```

---

## 6. Header

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌──────────┐    ┌───────────────────────────────────────┐   ┌──┐  ┌─┐ ┌─┐│
│  │ BBL      │    │  🔍  Search datasets, concepts...     │   │DE│  │?│ │↗││
│  │ [logo]   │    └───────────────────────────────────────┘   └──┘  └─┘ └─┘│
│  └──────────┘                                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Left:    BBL logo · 260px wide (aligns with sidebar)
Centre:  Search bar · max-width 640px · shortcut: / or Ctrl+K
Right:   [DE ▾] language switcher (EN / DE / FR / IT, no flags)
         [?] help
         [↗] login — shows initials avatar when authenticated

56px fixed · background #FFFFFF · shadow: 0 1px 4px rgba(0,0,0,0.08)
```

---

## 7. Detail View: Structure

Every entity detail view follows this consistent structure regardless of entity type.

```
┌─────────────────────────────────────────────────────────────┐
│  BREADCRUMB                                                  │
│  Vocabulary / Portfolio / Mietobjekt                        │
│  Each segment is a clickable link except the last           │
├─────────────────────────────────────────────────────────────┤
│  TITLE BLOCK                                                 │
│                                                              │
│  [icon]  Mietobjekt                        [● Certified]    │
│          CONCEPT · Portfolio collection                      │
│          Standard: VILB Anhang A                            │
│          Last modified: 12 Jan 2025 · Steward: D. Rasmussen │
├─────────────────────────────────────────────────────────────┤
│  TAB BAR                                                     │
│                                                              │
│  [ Overview ] [ Contents ] [ Mappings ] [ Values ]          │
│  [ Relationships ] [ Stakeholders ] [ Feedback ]            │
│                                                              │
│  Only applicable tabs shown (see §8)                        │
│  Active tab: filled #EAF2FB background · #0B6FCC text       │
├─────────────────────────────────────────────────────────────┤
│  TAB CONTENT  (varies — see §9–12)                          │
└─────────────────────────────────────────────────────────────┘

Title block:
  [icon]       24px entity type icon (secondary colour)
  Name         24px / 600
  Badge        ● Certified · ○ Draft · Deprecated
  Type label   11px uppercase: CONCEPT · CODE LIST · DATASET · DATA PRODUCT
  Subtitle     Collection or system path, secondary grey
  Standard ref Small link if present
  Meta row     Modified date · Steward — 12px secondary

  [⚠ No DE translation]  amber badge — shown to stewards/admins only
```

---

## 8. Tab Visibility Matrix

Tabs are shown only when applicable. Hidden tabs are removed from the DOM — not `display: none`.

```
Tab             Vocabulary  Concept  Code List  System  Dataset  Field  Data Product
────────────────────────────────────────────────────────────────────────────────────
Overview             ✓         ✓         ✓        ✓       ✓       ✓         ✓
Contents             ✓         ✓         ✓        ✓       ✓       –         ✓
Mappings             –         ✓         ✓        –       –       ✓         –
Values               –         ✓*        –        –       –       –         –
Lineage              –         –         –        –       ✓       –         ✓
Relationships        –         ✓         ✓        –       ✓       –         ✓
Quality              –         –         ✓**      –       ✓       –         ✓***
Stakeholders         ✓         ✓         ✓        ✓       ✓       –         ✓
Feedback             –         ✓         ✓        –       ✓       –         ✓
────────────────────────────────────────────────────────────────────────────────────

*   Values on Concept: compact summary + link to full Code List. Only shown
    when the concept has an associated code_list_id.
**  Quality on Code List: translation completeness per locale, deprecated value %
*** Quality on Data Product: SLA / update frequency health only, not field metrics

Contents renders differently per entity:
  Vocabulary     → Collections (grouped) + ungrouped Concepts
  Concept        → Concept Attributes (name, type, required, code list if set)
  Code List      → Full code / value table (the reference data itself)
  System         → Schemas, collapsible to show Datasets
  Dataset        → Fields table (name, type, nullable, mapped concept)
  Data Product   → Distributions (access method, format, URL)

Mappings tab:
  Concept        → Physical fields that realize this concept (skos:exactMatch)
  Code List      → Concept attributes + Dataset fields that reference this list
  Field          → Concept(s) this field realizes (inverse view)

Lineage tab (physical entities only — not on conceptual entities):
  Dataset        → Upstream / downstream data flows, tool, frequency, depth
  Data Product   → Source datasets (prov:wasDerivedFrom)

Stakeholders tab (see §13 for wireframe):
  Concept        → Data Owner · Data Steward · Subject Matter Expert
  Code List      → Data Steward · Data Custodian
  System         → Data Owner · Data Custodian
  Dataset        → Data Owner · Data Steward · Data Custodian · Subject Matter Expert
  Data Product   → Data Owner · Data Steward · Publisher
```

---

## 9. Vocabulary Section

### 9.1 Vocabulary: List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Vocabulary                                              [+ New Concept]    │
│  288 concepts across 7 collections                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter by collection:  [All ▾]    Status: [All ▾]    [🔍 Filter...]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ● PROPERTY & BUILDING                               42 concepts  [–]      │
│  ──────────────────────────────────────────────────────────────────────     │
│  Building               Gebäude           ✓ Certified    SIA 416           │
│  Parcel                 Grundstück        ✓ Certified    eCH-0071          │
│  Occupancy Unit         Nutzungseinheit   ✓ Certified    SIA 416 §3        │
│  Floor Area             Geschossfläche    ○ Draft        SIA 416           │
│  ──────────────────────────────────────────────────────────────────────     │
│  → View all 42 concepts in Property & Building                              │
│                                                                             │
│  ● PORTFOLIO                                         31 concepts  [–]      │
│  ──────────────────────────────────────────────────────────────────────     │
│  Rental Unit            Mietobjekt        ✓ Certified    VILB Anhang A     │
│  Federal Property       Liegenschaft      ✓ Certified    VILB              │
│  Lease                  Mietvertrag       ○ Draft        –                 │
│  ──────────────────────────────────────────────────────────────────────     │
│  → View all 31 concepts in Portfolio                                        │
│                                                                             │
│  ● COSTS & BENCHMARKS                                18 concepts  [+]      │
│  ● ENERGY & RESOURCES                               24 concepts  [+]      │
│  ● SPACE MANAGEMENT                                 29 concepts  [+]      │
│  ● DOCUMENTS & PLANS                                15 concepts  [+]      │
│  ● GOVERNANCE                                       12 concepts  [+]      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Rows: name (EN) · name (DE) · status badge · standard reference
Collapsed collection: name + count · [+] to expand
Expanded: up to 4 rows then "→ View all N" link
```

---

### 9.2 Collection: List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Vocabulary / Portfolio                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  [📂]  Portfolio                                                            │
│        COLLECTION · BBL Real Estate Vocabulary                              │
│        31 concepts · Last updated 14 Mar 2025                               │
│        Federal real estate portfolio: properties, rental units,             │
│        leases, and their lifecycle states.                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [🔍 Search within Portfolio...]         Status: [All ▾]                   │
├──────────────────┬──────────────┬────────────┬────────────┬─────────────────┤
│  Name (EN)       │  Name (DE)   │  Status    │  Mappings  │  Standard       │
├──────────────────┼──────────────┼────────────┼────────────┼─────────────────┤
│  Rental Unit     │  Mietobjekt  │  ✓ Cert.   │  4 fields  │  VILB Anhang A  │
│  Federal Property│  Liegenschaft│  ✓ Cert.   │  6 fields  │  VILB           │
│  Lease           │  Mietvertrag │  ○ Draft   │  –         │  –              │
│  Tenant          │  Mieter      │  ✓ Cert.   │  2 fields  │  –              │
└──────────────────┴──────────────┴────────────┴────────────┴─────────────────┘
```

---

### 9.3 Concept: Overview Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Vocabulary / Portfolio / Mietobjekt                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [📄]  Mietobjekt                                          [✓ Certified]   │
│        CONCEPT · Portfolio                                                  │
│        Standard: VILB Anhang A                                              │
│        Steward: D. Rasmussen · Modified: 12 Jan 2025                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Overview ] [ Contents ] [ Mappings ] [ Values ] [ Relationships ]       │
│  [ Stakeholders ] [ Feedback ]                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NAMES                                                                     │
│  ┌───────┬────────────────────────────────────────────────────────────┐   │
│  │  EN   │  Rental Unit                                                │   │
│  │  DE   │  Mietobjekt                                                 │   │
│  │  FR   │  Unité locative                                              │   │
│  │  IT   │  Unità locativa                            ⚠ Not reviewed   │   │
│  └───────┴────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DEFINITION                                          [EN ▾]                │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  A Rental Unit is the smallest contractually leasable unit within   │  │
│  │  a federal property. It may consist of one or more rooms and is     │  │
│  │  identified by a unique reference in SAP RE-FX.                     │  │
│  │  Synonyms (DE): MO, Mietobjekt-Nr                                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  PROPERTIES                                                                │
│  ┌───────────────────────────────┬────────────────────────────────────┐   │
│  │  Standard reference           │  VILB Anhang A                     │   │
│  │  EGID relevant                │  No                                │   │
│  │  EGRID relevant               │  No                                │   │
│  │  Status                       │  Certified                         │   │
│  │  Vocabulary                   │  BBL Real Estate Vocabulary v1.2   │   │
│  └───────────────────────────────┴────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 9.4 Concept: Mappings Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Overview ] [ Contents ] [● Mappings ] [ Values ] [ Relationships ]      │
│  [ Stakeholders ] [ Feedback ]                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MAPPINGS  — 4 fields across 2 systems                                     │
│  Physical fields that realize "Mietobjekt"  (ArchiMate: realizes)          │
│                                                                             │
│  ┌──────────────────────┬─────────────────────────┬──────────┬──────────┐  │
│  │  Field               │  Dataset / System        │  Match   │  Verified│  │
│  ├──────────────────────┼─────────────────────────┼──────────┼──────────┤  │
│  │  MIOBJNR             │  VIBDBE · SAP RE-FX      │  Exact   │  ✓       │  │
│  │  MIOBJBEZ            │  VIBDBE · SAP RE-FX      │  Related │  ✓       │  │
│  │  mietobjekt_id       │  Mietobjekte · GIS IMMO  │  Exact   │  ✓       │  │
│  │  obj_bezeichnung     │  Mietobjekte · GIS IMMO  │  Related │  ○       │  │
│  └──────────────────────┴─────────────────────────┴──────────┴──────────┘  │
│                                                                             │
│  Exact = skos:exactMatch · Related = skos:relatedMatch                     │
│  ○ = not yet verified by a steward                                         │
│  [+ Add mapping]   (stewards only)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 9.5 Concept: Values Tab

Shown only when the concept has an associated code list. Renders a compact summary with a link to the full Code List detail view in §10.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Overview ] [ Contents ] [ Mappings ] [● Values ] [ Relationships ]      │
│  [ Stakeholders ] [ Feedback ]                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  VALUES  — linked to GWR Gebäudekategorie                                  │
│  Source: GWR Merkmalskatalog 2023 · 24 values · Version 2023-01            │
│  → View full code list in Code Lists section                               │
│                                                                             │
│  [🔍 Filter...]                                     [EN] [DE] [FR] [IT]    │
│                                                                             │
│  ┌──────┬──────────────────────────┬──────────────────────────────────────┐ │
│  │ Code │  Label (DE)              │  Label (FR)                          │ │
│  ├──────┼──────────────────────────┼──────────────────────────────────────┤ │
│  │ 1010 │  Einfamilienhaus         │  Maison individuelle                 │ │
│  │ 1020 │  Zweifamilienhaus        │  Maison à deux logements             │ │
│  │ 1030 │  Mehrfamilienhaus        │  Immeuble locatif                    │ │
│  │ 1060 │  Geb. mit teilw. Wohnnut.│  Bâtiment à usage mixte             │ │
│  │ 1110 │  Bürogebäude             │  Immeuble de bureaux                 │ │
│  │ …    │  (showing 5 of 24)       │                                      │ │
│  └──────┴──────────────────────────┴──────────────────────────────────────┘ │
│                                                                             │
│  → View all 24 values in full code list                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Truncated at 5 rows. Full table lives on the Code List detail view (§10.3).
Language toggle switches both label columns.
```

---

## 10. Code Lists Section

Code Lists are first-class entities accessible directly from the sidebar. Users — developers, integrators, domain experts — need to find allowed values fast without navigating through a concept first. Many important code lists (eBKP-H, GWR, ISG) span multiple concepts and cannot be subordinated to a single one.

### 10.1 Code List: List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Code Lists                                           [+ New Code List]    │
│  47 code lists · 12 source standards                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Source: [All ▾]    Status: [All ▾]    [🔍 Filter...]                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ● GWR — Gebäude- und Wohnungsregister                        9 lists  [–] │
│  ──────────────────────────────────────────────────────────────────────     │
│  GWR Building Category      Gebäudekategorie     24 values   2023-01       │
│  GWR Building Status        Gebäudestatus         7 values   2023-01       │
│  GWR Energy Source          Energieträger        22 values   2023-01       │
│  GWR Heating Type           Heizungsart           9 values   2023-01       │
│  ──────────────────────────────────────────────────────────────────────     │
│  → View all 9 GWR code lists                                                │
│                                                                             │
│  ● SIA 416                                                    4 lists  [–] │
│  ──────────────────────────────────────────────────────────────────────     │
│  SIA Usage Type             Nutzungsart          18 values   SIA 416       │
│  SIA Room Type              Raumkategorie        31 values   SIA 416       │
│  ──────────────────────────────────────────────────────────────────────     │
│                                                                             │
│  ● eBKP-H                                                     3 lists  [+] │
│  ● ISG / ISMS                                                 5 lists  [+] │
│  ● VILB                                                       4 lists  [+] │
│  ● BBL internal                                              22 lists  [+] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Grouped by source standard (not by concept domain) — this is how users look up code lists.
Rows: name (EN) · name (DE) · value count · source / version ref
```

---

### 10.2 Code List: Overview Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Code Lists / GWR / GWR Building Category                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [🗂]  GWR Building Category                               [✓ Certified]   │
│        CODE LIST · GWR Merkmalskatalog                                      │
│        Version: 2023-01 · 24 values · 2 deprecated                         │
│        Custodian: Federal Statistical Office (BFS)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Overview ] [ Contents ] [ Mappings ] [ Relationships ]                  │
│  [ Quality ] [ Stakeholders ] [ Feedback ]                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NAMES                                                                     │
│  ┌───────┬────────────────────────────────────────────────────────────┐   │
│  │  EN   │  GWR Building Category                                      │   │
│  │  DE   │  GWR Gebäudekategorie                                        │   │
│  │  FR   │  GWR Catégorie de bâtiment                                   │   │
│  │  IT   │  GWR Categoria dell'edificio                                 │   │
│  └───────┴────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DESCRIPTION                                          [EN ▾]               │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Classifies buildings in the Swiss Federal Register of Buildings    │  │
│  │  and Dwellings (GWR) by primary use type. Each building receives    │  │
│  │  exactly one category code at registration.                         │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  PROPERTIES                                                                │
│  ┌───────────────────────────────┬────────────────────────────────────┐   │
│  │  Source                       │  GWR Merkmalskatalog 2023          │   │
│  │  Source URL                   │  www.housing-stat.ch/merkmal →     │   │
│  │  Version                      │  2023-01                           │   │
│  │  Total values                 │  24 (22 active · 2 deprecated)     │   │
│  │  Languages complete           │  EN ✓ · DE ✓ · FR ✓ · IT ✓        │   │
│  │  Used by concepts             │  1 — Building (Gebäude)            │   │
│  │  Used by dataset fields       │  3 fields across 2 systems         │   │
│  └───────────────────────────────┴────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 10.3 Code List: Contents Tab

The Contents tab is the core reason users navigate to a code list — the full table of codes and multilingual labels.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Overview ] [● Contents ] [ Mappings ] [ Relationships ]                 │
│  [ Quality ] [ Stakeholders ] [ Feedback ]                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  24 values · 2 deprecated · Version 2023-01                                │
│  [🔍 Filter values...]      [DE] [FR] [IT]         [↓ Download CSV]        │
│                                                                             │
│  Show deprecated  ○  (off by default)                                       │
│                                                                             │
│  ┌──────┬───────────────────────────────┬─────────────────────────────────┐ │
│  │ Code │  Label (DE)                   │  Label (FR)                     │ │
│  ├──────┼───────────────────────────────┼─────────────────────────────────┤ │
│  │ 1010 │  Einfamilienhaus              │  Maison individuelle            │ │
│  │ 1020 │  Zweifamilienhaus             │  Maison à deux logements        │ │
│  │ 1030 │  Mehrfamilienhaus             │  Immeuble locatif               │ │
│  │ 1040 │  Einfamilienhaus m. Einliegew.│  Maison indiv. avec appart.     │ │
│  │ 1060 │  Geb. mit teilw. Wohnnutzung  │  Bâtiment à usage mixte         │ │
│  │ 1080 │  Wohngebäude (o. Angabe)      │  Bâtiment résidentiel (n. spéc.)│ │
│  │ 1110 │  Bürogebäude                  │  Immeuble de bureaux            │ │
│  │ 1120 │  Handelsgebäude               │  Bâtiment commercial            │ │
│  │ …    │  (showing 8 of 22 active)     │                                 │ │
│  └──────┴───────────────────────────────┴─────────────────────────────────┘ │
│                                                                             │
│  Language selector switches label columns. EN is the code column (neutral).│
│  Deprecated values shown in grey italic when toggle is on.                 │
│  Download CSV exports: code, label_en, label_de, label_fr, label_it        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 10.4 Code List: Mappings Tab

Shows where this code list is used — which concept attributes and which dataset fields reference it.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Overview ] [ Contents ] [● Mappings ] [ Relationships ]                 │
│  [ Quality ] [ Stakeholders ] [ Feedback ]                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USED BY CONCEPTS                                                          │
│  ┌──────────────────────────┬──────────────────────────────────────────┐   │
│  │  Concept                 │  Attribute                                │   │
│  ├──────────────────────────┼──────────────────────────────────────────┤   │
│  │  Building (Gebäude)      │  Building Category (Gebäudekategorie)    │   │
│  └──────────────────────────┴──────────────────────────────────────────┘   │
│                                                                             │
│  USED BY FIELDS                                                            │
│  ┌────────────────────┬────────────────────────────┬─────────────────────┐  │
│  │  Field             │  Dataset / System           │  Verified           │  │
│  ├────────────────────┼────────────────────────────┼─────────────────────┤  │
│  │  GEBKAT            │  VIBGEB · SAP RE-FX         │  ✓                  │  │
│  │  geb_kategorie     │  Gebäude · GIS IMMO         │  ✓                  │  │
│  │  building_cat_code │  CDE_Buildings · CDE Bund   │  ○                  │  │
│  └────────────────────┴────────────────────────────┴─────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Systems Section

### 11.1 System: List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Systems                                                                    │
│  6 systems · last scanned 2h ago                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🗄  SAP RE-FX                                    [● Active]        │   │
│  │      SAP S/4HANA · 3 schemas · 142 datasets · Last scan: 2h ago    │   │
│  │      Owner: D. Rasmussen · DRES – Digital Solutions                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🗄  GIS IMMO                                     [● Active]        │   │
│  │      ArcGIS Online · 1 workspace · 38 layers · Last scan: 4h ago   │   │
│  │      Owner: B. Vidondo · DRES – Digital Solutions                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🗄  ActaNova GEVER                               [● Active]        │   │
│  │      Acta Nova · 1 schema · 24 datasets · Last scan: 1d ago        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🗄  EDM InterWatt                                [● Active]        │   │
│  │      InterWatt · 1 schema · 18 datasets                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  [+ Register System]  (admin only)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.2 Dataset: Overview Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Systems / SAP RE-FX / RE_FX / VIBDBE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  [🗃]  VIBDBE                                             [✓ Certified]    │
│        DATASET · TABLE · SAP RE-FX / RE_FX schema                          │
│        Steward: D. Rasmussen · Modified: 08 Feb 2025                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Overview ] [ Contents ] [ Lineage ] [ Relationships ]                   │
│  [ Quality ] [ Stakeholders ] [ Feedback ]                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DESCRIPTION                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Rental object master data table. Contains all active and           │  │
│  │  historical rental units managed within SAP RE-FX.                  │  │
│  │  Primary source for Mietobjekt data in the federal portfolio.       │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  PROPERTIES                                                                │
│  ┌───────────────────────────────┬────────────────────────────────────┐   │
│  │  System                       │  SAP RE-FX                         │   │
│  │  Schema                       │  RE_FX                             │   │
│  │  Type                         │  Table                             │   │
│  │  Approx. row count            │  48,231                            │   │
│  │  Classification               │  [BBL-intern]                      │   │
│  │  EGID relevant                │  Yes                               │   │
│  │  EGRID relevant               │  No                                │   │
│  └───────────────────────────────┴────────────────────────────────────┘   │
│                                                                             │
│  CONCEPT MAPPINGS (summary)                                                │
│  Fields in this dataset realize 3 concepts:                                │
│  [Mietobjekt]  [Liegenschaft]  [Kostenstelle]                              │
│  → See Mappings tab on each concept for full details                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Classification badge by sensitivity: green · blue · amber · red
Concept pills are clickable links to concept detail views
```

---

### 11.3 Dataset: Lineage Tab

Physical entities use "Lineage", not "Provenance". The DCAT/PROV anchor is `prov:wasDerivedFrom` but the user-facing label throughout the UI is "Lineage" for all datasets and data products.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Overview ] [ Contents ] [● Lineage ] [ Relationships ]                  │
│  [ Quality ] [ Stakeholders ] [ Feedback ]                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LINEAGE  — prov:wasDerivedFrom                                            │
│                                                                             │
│  UPSTREAM  (sources that feed into this dataset)                           │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  None — VIBDBE is a primary source with no upstream dependencies     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  DOWNSTREAM  (datasets derived from this one)                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │  VIBDBE (SAP RE-FX)                                                  │ │
│  │    │                                                                  │ │
│  │    ├── FME ──────────────→  Mietobjekte (GIS IMMO)    [daily]        │ │
│  │    │                           │                                     │ │
│  │    │                           └── ArcGIS Pro ──→  BIM-Layer (GIS)  │ │
│  │    │                                                                  │ │
│  │    └── SAP PI ─────────→  RE_Liegenschaften (GEVER)   [on_demand]    │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Depth: 2 hops   [Show more ▾]  (up to 6 hops via recursive CTE)          │
│  Each node is a clickable link · Arrow labels: tool · frequency            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.4 Dataset: Quality Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Overview ] [ Contents ] [ Lineage ] [ Relationships ]                   │
│  [● Quality ] [ Stakeholders ] [ Feedback ]                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  QUALITY  — Last profiled: 12 Feb 2025 at 03:00 · scanner v2.1             │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Completeness      ████████████████████░░░░  82%                    │  │
│  │  Format validity   ██████████████████████░░  91%                    │  │
│  │  Null rate         ████░░░░░░░░░░░░░░░░░░░░  18%                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  Total rows: 48,231                                                         │
│                                                                             │
│  FIELD-LEVEL QUALITY                                                       │
│  ┌─────────────────┬────────────┬───────────┬────────────┬─────────────┐  │
│  │  Field          │  Null %    │  Distinct │  Min       │  Max        │  │
│  ├─────────────────┼────────────┼───────────┼────────────┼─────────────┤  │
│  │  MIOBJNR        │  0%        │  48,231   │  1000001   │  9999999    │  │
│  │  MIOBJBEZ       │  3%        │  21,450   │  –         │  –          │  │
│  │  MIOBJSTAT      │  0%        │  6        │  –         │  –          │  │
│  │  MFLAECHE       │  22%  ⚠    │  8,231    │  4.2       │  12,450.0   │  │
│  └─────────────────┴────────────┴───────────┴────────────┴─────────────┘  │
│                                                                             │
│  ⚠ null rate above 20% threshold                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Data Products Section

### 12.1 Data Product: List View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Data Products                                               [+ New]        │
│  24 data products · 3 pending review                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter: [All ▾]   Access type: [All ▾]   License: [All ▾]                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  📦  Federal Property Portfolio                    [✓ Certified]    │   │
│  │      Updated monthly · 3 distributions             [Öffentlich]     │   │
│  │      REST API  ·  File Export (XLSX)  ·  OGD open data              │   │
│  │      Publisher: DRES – Digital Solutions                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  📦  Energy Consumption Report                     [○ Draft]        │   │
│  │      Updated quarterly · 1 distribution            [BBL-intern]     │   │
│  │      Report (PDF)                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔒  Construction Cost Benchmarks                  [✓ Certified]    │   │
│  │      Access restricted · BBL-intern · Request access →              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 12.2 Data Product: Overview Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Data Products / Federal Property Portfolio                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  [📦]  Federal Property Portfolio                         [✓ Certified]    │
│        DATA PRODUCT · DRES – Digital Solutions                              │
│        License: CC BY 4.0 · Updated: monthly                               │
│        Steward: D. Rasmussen · Published: 01 Jan 2023                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Overview ] [ Contents ] [ Lineage ] [ Relationships ]                   │
│  [ Quality ] [ Stakeholders ] [ Feedback ]                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NAMES                                                                     │
│  ┌───┬───────────────────────────────────────────────────────────────────┐ │
│  │ EN│  Federal Property Portfolio                                       │ │
│  │ DE│  Bundesimmobilien-Portfolio                                       │ │
│  │ FR│  Portefeuille immobilier fédéral                                  │ │
│  │ IT│  Portafoglio immobiliare federale                                 │ │
│  └───┴───────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  DESCRIPTION                                                  [EN ▾]       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  A comprehensive view of federal real estate holdings including      │   │
│  │  properties, rental units, and space allocations. Updated monthly   │   │
│  │  from SAP RE-FX and GIS IMMO.                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DISTRIBUTIONS                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [🔗]  REST API                                                     │   │
│  │        https://api.bbl.admin.ch/immo/v1/portfolio                   │   │
│  │        OData · realtime  [Access →]                                 │   │
│  │  [📄]  Monthly Excel Export                                         │   │
│  │        XLSX · ~2.4 MB · 1st of month  [Download →]                 │   │
│  │  [🌐]  OGD Publication (opendata.swiss)                              │   │
│  │        CC BY 4.0 · JSON-LD  [View →]                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Shared Tab: Stakeholders

The Stakeholders tab is consistent across all entity types that display it. The set of roles rendered varies by entity type (see §8 matrix), but the visual pattern is identical everywhere.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Overview ] [ Contents ] [ Lineage ] [ Relationships ]                   │
│  [ Quality ] [● Stakeholders ] [ Feedback ]                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STAKEHOLDERS                                                              │
│                                                                             │
│  DATA OWNER                                                                │
│  Accountable for existence, quality standards, and use of this data.       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  [DM]  D. Müller                                                    │  │
│  │        Leiter Immobilienportfolio · BBL                              │  │
│  │        d.mueller@bbl.admin.ch                                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  DATA STEWARD                                                              │
│  Maintains the catalog entry, enforces standards, approves mappings.       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  [DR]  D. Rasmussen                                                 │  │
│  │        Business Analyst · DRES – Digital Solutions                  │  │
│  │        d.rasmussen@bbl.admin.ch                                     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  [BV]  B. Vidondo                                                   │  │  ← multiple stewards OK
│  │        GIS Spezialistin · DRES – Digital Solutions                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  DATA CUSTODIAN                                                            │
│  Technically operates the system: access management, backup, availability. │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  [SO]  SAP Operations Team                                          │  │  ← teams allowed
│  │        IKT Infrastruktur · BBL                                      │  │
│  │        sap-ops@bbl.admin.ch                                         │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  SUBJECT MATTER EXPERT                                                     │
│  Provides domain knowledge about the data's meaning and edge cases.        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  [HK]  H. Keller                                                    │  │
│  │        Liegenschaftsspezialist · Portfolio Management               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [+ Assign stakeholder]   (stewards and admins only)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Role slots per entity type:
  Concept        Data Owner · Data Steward · Subject Matter Expert
  Code List      Data Steward · Data Custodian
  System         Data Owner · Data Custodian
  Dataset        Data Owner · Data Steward · Data Custodian · Subject Matter Expert
  Data Product   Data Owner · Data Steward · Publisher

Unassigned role shows a placeholder:
  ┌──────────────────────────────────────────────────────┐
  │  —  No subject matter expert assigned               │
  │     [+ Assign]  (stewards only)                     │
  └──────────────────────────────────────────────────────┘

Avatar: 28px circle · bg #0B6FCC · white initials 11px/500
Teams (no individual): group icon instead of initials
```

---

## 14. Search

Search is global across all four sections.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [🔍  mietobjekt                                                        ]   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CONCEPTS                                                                  │
│  📄  Mietobjekt                          Concept · Portfolio               │
│      Rental unit managed in federal...   VILB Anhang A                     │
│                                                                             │
│  CODE LISTS                                                                │
│  🗂  GWR Building Category               Code List · GWR                   │
│      24 values · Used by Building concept...                               │
│                                                                             │
│  DATASETS                                                                  │
│  🗃  VIBDBE                              Table · SAP RE-FX                  │
│      Rental object master data. 48k...   4 concept mappings                │
│  🗃  Mietobjekte                         GIS Layer · GIS IMMO              │
│      Spatial rental unit features...     3 concept mappings                │
│                                                                             │
│  DATA PRODUCTS                                                             │
│  📦  Federal Property Portfolio          Data Product · DRES               │
│      Comprehensive federal real estat...  REST API · Excel                  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  → View all 14 results for "mietobjekt"                                    │
└─────────────────────────────────────────────────────────────────────────────┘

Result order: Concepts · Code Lists · Datasets · Data Products
Search is multilingual: "unité locative" finds Mietobjekt
Restricted assets: [🔒 Access restricted] — name shown, content hidden
```

---

## 15. Access-Restricted Asset Pattern

For assets with `sensitivity_level ≥ 2`. Never hidden — only locked.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [🔒]  Construction Cost Benchmarks                                 │   │
│  │        DATA PRODUCT                                                 │   │
│  │        ──────────────────────────────────────────────────────────   │   │
│  │        This data product is classified [Vertraulich] and is        │   │
│  │        available to authorised BBL staff only.                      │   │
│  │        [Request access →]                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

- Name, type, and classification badge visible
- All other content hidden (no tabs shown)
- [Request access →] ghost button — links to form or pre-filled mailto
- Text colour: #A3A39E
- In lineage / relationship views: grey node with lock icon, no content revealed
```

---

## 16. Responsive Behaviour

```
DESKTOP (≥ 1280px)
┌──────────────┬────────────────────────────────────────────┐
│  260px fixed │  fluid main content                        │
└──────────────┴────────────────────────────────────────────┘

TABLET (768px – 1279px)
  Sidebar → 48px icon strip · tap opens overlay
┌──────┬────────────────────────────────────────────────────┐
│  📖  │  full-width main content                           │
│  🗂  │                                                    │
│  🗄  │                                                    │
│  📦  │                                                    │
└──────┴────────────────────────────────────────────────────┘

MOBILE (< 768px)
  Sidebar hidden · hamburger in header
  Tab bar scrolls horizontally (no truncation ever)
  Tables → card-per-row layout
```

---

*End of document.*
