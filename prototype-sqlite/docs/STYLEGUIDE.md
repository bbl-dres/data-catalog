# BBL Datenkatalog – Style Guide

**Version:** 0.1 (draft)
**Owner:** DRES – Kreis Digital Solutions
**Status:** In Review

This document defines the complete visual language for the BBL Datenkatalog frontend.
The reference aesthetic is Informatica Cloud Data Governance and Catalog: black text
on white, generous spacing, light grey surfaces, blue accents, minimal decoration.
Every design decision here prioritises legibility and information density over visual
expression. When in doubt, add whitespace and remove colour.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Colour Tokens](#2-colour-tokens)
3. [Typography](#3-typography)
4. [Spacing System](#4-spacing-system)
5. [Layout & Grid](#5-layout--grid)
6. [Elevation & Shadow](#6-elevation--shadow)
7. [Border & Radius](#7-border--radius)
8. [CSS Custom Properties](#8-css-custom-properties)
9. [Components](#9-components)
   - 9.1 [Header](#91-header)
   - 9.2 [Sidebar Navigation](#92-sidebar-navigation)
   - 9.3 [Breadcrumb](#93-breadcrumb)
   - 9.4 [Title Block](#94-title-block)
   - 9.5 [Tab Bar](#95-tab-bar)
   - 9.6 [Buttons](#96-buttons)
   - 9.7 [Badges & Status Pills](#97-badges--status-pills)
   - 9.8 [Cards](#98-cards)
   - 9.9 [Tables](#99-tables)
   - 9.10 [Forms & Inputs](#910-forms--inputs)
   - 9.11 [Search](#911-search)
   - 9.12 [Quality Bar](#912-quality-bar)
   - 9.13 [Lineage Tree](#913-lineage-tree)
   - 9.14 [Empty States](#914-empty-states)
   - 9.15 [Loading States](#915-loading-states)
   - 9.16 [Locked Asset](#916-locked-asset)
   - 9.17 [Translation Gap Indicator](#917-translation-gap-indicator)
   - 9.18 [Feedback / Comments](#918-feedback--comments)
10. [Icons](#10-icons)
11. [Interaction States](#11-interaction-states)
12. [Accessibility](#12-accessibility)
13. [Internationalisation](#13-internationalisation)
14. [Do / Don't](#14-do--dont)

---

## 1. Philosophy

**Text first.** Every interface element either is text or serves to organise text.
Decoration that does not carry meaning is removed.

**One blue.** The accent colour appears on interactive elements (links, active tabs,
primary buttons, active nav items) and nothing else. If something is blue, users
expect to be able to click it.

**Whitespace is structure.** Section separation is achieved with space, not lines.
Dividers and borders appear only when space alone is insufficient to separate items
(i.e. dense tables).

**Status through shape, not only colour.** Every status badge uses a pill shape and
a label in addition to colour. Colour alone is never the sole indicator of meaning.

**Predictability over cleverness.** Every detail view has the same structure:
breadcrumb, title block, tab bar, content. Users should never have to reorient.

---

## 2. Colour Tokens

All colours are defined as CSS custom properties (see §8). Raw hex values are
provided here for reference. Never use raw hex in component code — always reference
a token.

### 2.1 Base palette

```
                       HEX        Usage
────────────────────────────────────────────────────────────────
White                  #FFFFFF    Page background, main content area, cards
Grey 50                #F7F7F6    Sidebar background, table alt rows, input bg
Grey 100               #EFEFED    Dividers, card borders, table row borders
Grey 200               #D8D8D5    Input borders (default), separator lines
Grey 400               #A3A39E    Placeholder text, disabled icons
Grey 600               #6B6B66    Secondary text, metadata, timestamps
Grey 800               #2C2C29    Primary text (headings, body)
Grey 950               #111110    Maximum contrast (rarely used directly)

Blue 50                #EAF2FB    Active tab background, accent surface
Blue 100               #C3DAEF    Focus ring base, hover surface (nav)
Blue 500               #0B6FCC    Links, active tab text, primary button bg,
                                  active nav item bg, icon accent
Blue 600               #0A5DAD    Primary button hover, active link hover
Blue 700               #084A8A    Primary button active/pressed

Green 50               #EDFAF3    Certified badge background
Green 500              #1A9E55    Certified badge text and border
Green 600              #157A42    Certified badge hover

Amber 50               #FEF7E8    Draft badge bg, warning bg
Amber 500              #C9820B    Draft badge text, warning indicator
Amber 600              #A36808    Warning icon

Red 50                 #FEF0EE    Error bg, deprecated badge bg
Red 500                #C9372C    Error text, deprecated badge text

Teal 400               #1BA8A0    Quality bar — non-distinct / completeness
Orange 400             #F07A2A    Quality bar — null values highlight
────────────────────────────────────────────────────────────────
```

### 2.2 Semantic tokens

These are the tokens components should reference. They map to the base palette but
allow future theming without touching component code.

```
Token                         Value              Usage
──────────────────────────────────────────────────────────────────────────────
--color-bg-page               #FFFFFF            Main content, card interiors
--color-bg-surface            #F7F7F6            Sidebar, section headers, inputs
--color-bg-surface-hover      #EFEFED            Hover state on surface items
--color-bg-accent             #EAF2FB            Active tab bg, selected row bg
--color-bg-accent-strong      #0B6FCC            Primary button, active nav item

--color-border-subtle         #EFEFED            Card border, table row divider
--color-border-default        #D8D8D5            Input border, section divider
--color-border-strong         #A3A39E            Focused input border (alt)
--color-border-accent         #0B6FCC            Focus ring, active input

--color-text-primary          #2C2C29            Headings, body, table cells
--color-text-secondary        #6B6B66            Metadata, labels, timestamps
--color-text-placeholder      #A3A39E            Input placeholder
--color-text-link             #0B6FCC            All clickable links
--color-text-link-hover       #0A5DAD            Link hover
--color-text-on-accent-strong #FFFFFF            Text on blue backgrounds

--color-status-certified      #1A9E55            Certified badge text/border
--color-status-certified-bg   #EDFAF3            Certified badge bg
--color-status-draft          #C9820B            Draft badge text/border
--color-status-draft-bg       #FEF7E8            Draft badge bg
--color-status-deprecated     #6B6B66            Deprecated badge text/border
--color-status-deprecated-bg  #EFEFED            Deprecated badge bg
--color-status-restricted     #A3A39E            Locked asset text
--color-status-restricted-bg  #F7F7F6            Locked asset bg

--color-quality-complete      #1BA8A0            Quality bar fill (completeness)
--color-quality-null          #F07A2A            Quality bar null indicator
--color-quality-bg            #EFEFED            Quality bar track background

--color-warning               #C9820B            Translation gap indicator
--color-warning-bg            #FEF7E8            Warning surface
--color-error                 #C9372C            Error state
--color-error-bg              #FEF0EE            Error surface
──────────────────────────────────────────────────────────────────────────────
```

---

## 3. Typography

### 3.1 Font stack

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system,
             BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace,
             'Cascadia Code', monospace;
```

Inter is the preferred choice. It is freely available (Google Fonts / bundles cleanly)
and very close to what Informatica uses. Fall back to the system sans stack.
Monospace is used exclusively for technical values: field names, data types,
sample values, code snippets, API endpoints.

### 3.2 Type scale

```
Role              Size    Weight    Line-height    Tracking    Usage
─────────────────────────────────────────────────────────────────────────────
Display           24px    600       1.3            –0.01em     Page title (entity name)
Heading L         18px    600       1.4            –0.01em     Section heading (Description, Attributes)
Heading M         16px    500       1.4            0           Subheading, card title
Body              14px    400       1.65           0           All body text, table cells
Body strong       14px    500       1.65           0           Emphasised body (key in key-value)
Small             12px    400       1.5            0.01em      Metadata, timestamps, captions
Label             11px    500       1.4            0.06em      Column headers, uppercase section labels
Mono              13px    400       1.5            0           Field names, data types, code
─────────────────────────────────────────────────────────────────────────────
```

**Rules:**
- Never use font-weight 700 or above. 600 is the maximum.
- Never use font sizes below 11px.
- Body text is always 14px / 400. Do not deviate for density.
- Uppercase tracking is reserved for Label role only (11px column headers,
  section meta labels like "CONCEPT" or "DATASET"). Never apply uppercase
  to any other role.
- Heading L (18px / 600) is for content section headings inside tab panels
  (e.g. "Description", "Attributes", "Field-level Quality"). Not for UI chrome.

### 3.3 Colour in type

```
Primary text     var(--color-text-primary)     #2C2C29    headings, body, table cells
Secondary text   var(--color-text-secondary)   #6B6B66    metadata, labels, timestamps
Link             var(--color-text-link)         #0B6FCC    all clickable text
Placeholder      var(--color-text-placeholder)  #A3A39E    input hints
On blue bg       var(--color-text-on-accent)    #FFFFFF    text on --color-bg-accent-strong
```

---

## 4. Spacing System

Base unit: **8px**. All spacing values are multiples of 4 (half-unit) or 8.

```
Token        Value    Usage
──────────────────────────────────────────────────────────────────
--space-1    4px      Inline gap between icon and label; badge internal padding
--space-2    8px      Between related inline elements; input internal padding (v)
--space-3    12px     Between list items in dense lists; tab internal padding (v)
--space-4    16px     Card internal padding (compact); between form fields
--space-5    20px     Card internal padding (standard)
--space-6    24px     Between content sections within a tab panel
--space-8    32px     Between major sections; title block bottom margin
--space-10   40px     Top/bottom padding of content area
--space-12   48px     Empty state internal padding
──────────────────────────────────────────────────────────────────
```

**Horizontal layout:**

```
Sidebar inner padding    16px left / 12px right
Main content padding     32px left / 32px right / 40px top
Table cell padding       12px horizontal / 10px vertical
Card padding             20px all sides
```

---

## 5. Layout & Grid

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER  56px                                                               │
├──────────────────────┬──────────────────────────────────────────────────────┤
│  SIDEBAR             │  MAIN CONTENT                                        │
│  260px               │  fluid (min 640px, max unconstrained)                │
│  position: fixed     │  margin-left: 260px                                  │
│  top: 56px           │  padding: 40px 32px 64px                             │
│  height: 100vh       │                                                      │
│  overflow-y: auto    │  Content max-width: 960px (not centred — left-flush) │
│                      │  Reading width cap prevents overly wide text blocks   │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

The main content area is left-flush at 32px from the sidebar edge, not centred.
This matches Informatica's layout and feels consistent with data-dense applications
where users scan left-to-right.

Tab panels that contain full-width tables or quality bars should extend to the full
available width. Prose sections (Description, Definition) cap at 720px to maintain
readability.

---

## 6. Elevation & Shadow

Only one shadow is used in the entire application. No card shadows, no modal shadows,
no elevated button shadows.

```
Header shadow:  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

Card hover:     box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
                (applied on :hover only — cards are flat at rest)

All others:     no shadow
```

Depth is communicated through background colour difference, not shadow stacking.
The sidebar (#F7F7F6) sits behind the main content (#FFFFFF). That contrast is
sufficient — no shadow needed between them.

---

## 7. Border & Radius

```
Border colour (default):   var(--color-border-subtle)    #EFEFED
Border colour (inputs):    var(--color-border-default)   #D8D8D5
Border width:              1px throughout
No 2px borders anywhere.

Border radius scale:
  --radius-sm   4px    Badges, pills, small chips
  --radius-md   6px    Inputs, table wrapper, small cards
  --radius-lg   8px    Cards, panels, modals, sidebar nav active item
  --radius-xl   12px   Search bar, large modal panels

Rule: use the smallest radius that looks intentional in context.
Cards use --radius-lg. Badges use --radius-sm.
Do not use fully rounded (radius = 50% height) except for user avatar circles.
```

---

## 8. CSS Custom Properties

Complete token file. Import once at `:root`.

```css
:root {
  /* Colour: backgrounds */
  --color-bg-page:             #FFFFFF;
  --color-bg-surface:          #F7F7F6;
  --color-bg-surface-hover:    #EFEFED;
  --color-bg-accent:           #EAF2FB;
  --color-bg-accent-strong:    #0B6FCC;

  /* Colour: borders */
  --color-border-subtle:       #EFEFED;
  --color-border-default:      #D8D8D5;
  --color-border-strong:       #A3A39E;
  --color-border-accent:       #0B6FCC;

  /* Colour: text */
  --color-text-primary:        #2C2C29;
  --color-text-secondary:      #6B6B66;
  --color-text-placeholder:    #A3A39E;
  --color-text-link:           #0B6FCC;
  --color-text-link-hover:     #0A5DAD;
  --color-text-on-accent:      #FFFFFF;

  /* Colour: status */
  --color-status-certified:    #1A9E55;
  --color-status-certified-bg: #EDFAF3;
  --color-status-draft:        #C9820B;
  --color-status-draft-bg:     #FEF7E8;
  --color-status-deprecated:   #6B6B66;
  --color-status-deprecated-bg:#EFEFED;
  --color-status-restricted:   #A3A39E;
  --color-status-restricted-bg:#F7F7F6;

  /* Colour: quality bars */
  --color-quality-complete:    #1BA8A0;
  --color-quality-null:        #F07A2A;
  --color-quality-bg:          #EFEFED;

  /* Colour: feedback */
  --color-warning:             #C9820B;
  --color-warning-bg:          #FEF7E8;
  --color-error:               #C9372C;
  --color-error-bg:            #FEF0EE;

  /* Typography */
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system,
               BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

  --text-display:  24px;
  --text-heading-l: 18px;
  --text-heading-m: 16px;
  --text-body:     14px;
  --text-small:    12px;
  --text-label:    11px;
  --text-mono:     13px;

  /* Spacing */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Shadow */
  --shadow-header: 0 1px 4px rgba(0, 0, 0, 0.08);
  --shadow-card:   0 2px 8px rgba(0, 0, 0, 0.07);

  /* Layout */
  --sidebar-width:   260px;
  --header-height:   56px;
  --content-padding: 32px;
  --prose-max-width: 720px;
}
```

---

## 9. Components

---

### 9.1 Header

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌──────────────────┐  ┌────────────────────────────────────────┐  DE  ? ↗ │
│  │ [logo]  BBL      │  │ 🔍  Search datasets, concepts...       │          │
│  └──────────────────┘  └────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
56px height · background: --color-bg-page · shadow: --shadow-header
```

```css
.header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-height);        /* 56px */
  background: var(--color-bg-page);
  box-shadow: var(--shadow-header);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  gap: var(--space-4);
  z-index: 100;
}

.header-logo {
  width: var(--sidebar-width);         /* 260px — aligns with sidebar */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--color-text-primary);
  text-decoration: none;
}

.header-search {
  flex: 1;
  max-width: 640px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}
```

**Language switcher:** Plain text button showing current locale (e.g. "DE").
On click, opens a small dropdown with EN / DE / FR / IT options. Selected locale
has a blue dot to the left. No flags — they cause political and accessibility issues.

```
  DE ▾
  ────────
  ● EN
    DE
    FR
    IT
  ────────
```

**Action icons (right of language switcher):** 24px icon buttons, no background at
rest, `--color-bg-surface` on hover, `--radius-md` radius.

---

### 9.2 Sidebar Navigation

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐    │  ← active item
│  │█  📖  Vocabulary               │    │    bg: --color-bg-accent-strong (#0B6FCC)
│  └─────────────────────────────────┘    │    text: --color-text-on-accent (#FFFFFF)
│                                         │    radius: --radius-lg
│  ┌─────────────────────────────────┐    │  ← inactive item
│  │   🗄  Systems                  │    │    bg: transparent
│  └─────────────────────────────────┘    │    text: --color-text-primary
│                                         │    hover bg: --color-bg-surface-hover
│  ┌─────────────────────────────────┐    │
│  │   📦  Data Products            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ─────────────────────────────────────  │  ← divider: --color-border-subtle, 1px
│                                         │
│  RECENTS                                │  ← 11px / 500 / uppercase / secondary
│                                         │
│  Mietobjekt                             │  ← 13px / 400 / link colour on hover
│  SAP RE-FX / VIBDBE                     │    truncated with ellipsis
│  Gebäudekategorien                      │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  BOOKMARKS                              │
│                                         │
│  Energiebezugsfläche                    │
│                                         │
└─────────────────────────────────────────┘
```

```css
.sidebar {
  position: fixed;
  top: var(--header-height);
  left: 0;
  width: var(--sidebar-width);
  height: calc(100vh - var(--header-height));
  background: var(--color-bg-surface);
  overflow-y: auto;
  padding: var(--space-4) var(--space-3);
  border-right: 1px solid var(--color-border-subtle);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  font-size: var(--text-body);
  font-weight: 400;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 120ms ease;
}

.nav-item:hover {
  background: var(--color-bg-surface-hover);
}

.nav-item.active {
  background: var(--color-bg-accent-strong);
  color: var(--color-text-on-accent);
  font-weight: 500;
}

.nav-section-label {
  font-size: var(--text-label);
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-4);
}

.nav-recent-item {
  font-size: 13px;
  color: var(--color-text-secondary);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: var(--radius-md);
}

.nav-recent-item:hover {
  color: var(--color-text-link);
  background: var(--color-bg-surface-hover);
}
```

---

### 9.3 Breadcrumb

```
Vocabulary / Portfolio / Mietobjekt

Each segment except the last is a blue link.
The last segment is primary text (non-clickable — current page).
Separator: " / " in secondary text colour.
```

```css
.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-small);     /* 12px */
  color: var(--color-text-secondary);
  margin-bottom: var(--space-4);
}

.breadcrumb-link {
  color: var(--color-text-link);
  text-decoration: none;
}

.breadcrumb-link:hover {
  text-decoration: underline;
}

.breadcrumb-current {
  color: var(--color-text-primary);
}

.breadcrumb-separator {
  color: var(--color-text-secondary);
  user-select: none;
}
```

---

### 9.4 Title Block

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [icon 24px]   Mietobjekt                               [● Certified]      │
│                CONCEPT · Portfolio                                          │
│                Standard ref: VILB Anhang A                                 │
│                                                                             │
│                Steward: D. Rasmussen · Modified: 12 Jan 2025               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```css
.title-block {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.title-block-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-top: 3px;   /* optical alignment with 24px title text */
  color: var(--color-text-secondary);
}

.title-block-content {
  flex: 1;
}

.title-block-name {
  font-size: var(--text-display);   /* 24px */
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
  margin: 0 0 var(--space-1);
}

.title-block-type {
  font-size: var(--text-label);     /* 11px */
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-1);
}

.title-block-meta {
  font-size: var(--text-small);     /* 12px */
  color: var(--color-text-secondary);
  margin-top: var(--space-2);
}

.title-block-meta a {
  color: var(--color-text-link);
}

.title-block-badge {
  flex-shrink: 0;
  margin-top: 4px;
}
```

The type label ("CONCEPT · Portfolio") uses the Label role: 11px, 500, uppercase,
0.06em tracking, secondary colour. The dot separator between type and parent context
is a literal "·" character, not a styled element.

---

### 9.5 Tab Bar

The active tab uses a **filled light-blue background pill**, not an underline.
This matches the Informatica reference exactly.

```
  ┌──────────────────┐                                              ← active tab
  │   Overview       │  Contents   Mappings   Relationships   ...
  └──────────────────┘
  filled: --color-bg-accent (#EAF2FB)
  text:   --color-text-link (#0B6FCC)
  weight: 500
```

```css
.tab-bar {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border-subtle);
  margin-bottom: var(--space-6);
  padding-bottom: 0;
}

.tab {
  padding: var(--space-2) var(--space-4);       /* 8px 16px */
  font-size: var(--text-body);                  /* 14px */
  font-weight: 400;
  color: var(--color-text-secondary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  cursor: pointer;
  border: none;
  background: transparent;
  position: relative;
  bottom: -1px;                 /* sits on top of the border-bottom */
  transition: background 100ms ease, color 100ms ease;
  white-space: nowrap;
}

.tab:hover {
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
}

.tab.active {
  background: var(--color-bg-accent);           /* #EAF2FB */
  color: var(--color-text-link);                /* #0B6FCC */
  font-weight: 500;
  border: 1px solid var(--color-border-subtle);
  border-bottom: 1px solid var(--color-bg-accent); /* hides bottom border */
}
```

Hidden tabs (not applicable to entity type) must be removed from the DOM — not
hidden with `display: none`. Screen readers should not encounter irrelevant tabs.

---

### 9.6 Buttons

Three variants only. No outline variants, no ghost variants, no icon-only variants
with backgrounds.

```
PRIMARY          SECONDARY         GHOST (text)
┌─────────────┐  ┌─────────────┐   + Add mapping
│ Save changes│  │ Cancel      │
└─────────────┘  └─────────────┘
Blue bg          White bg           No bg, no border
White text       Grey border        Link colour text
                 Grey text          Underline on hover
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);       /* 8px 16px */
  font-size: var(--text-body);                  /* 14px */
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 120ms ease, box-shadow 120ms ease;
  text-decoration: none;
}

/* Primary */
.btn-primary {
  background: var(--color-bg-accent-strong);    /* #0B6FCC */
  color: var(--color-text-on-accent);
}

.btn-primary:hover  { background: #0A5DAD; }
.btn-primary:active { background: #084A8A; }

/* Secondary */
.btn-secondary {
  background: var(--color-bg-page);
  color: var(--color-text-primary);
  border-color: var(--color-border-default);
}

.btn-secondary:hover  { background: var(--color-bg-surface); }
.btn-secondary:active { background: var(--color-bg-surface-hover); }

/* Ghost */
.btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--color-text-link);
  padding-left: 0;
  padding-right: 0;
}

.btn-ghost:hover { text-decoration: underline; }

/* Disabled (all variants) */
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

/* Size modifier */
.btn-sm {
  padding: var(--space-1) var(--space-3);       /* 4px 12px */
  font-size: var(--text-small);                 /* 12px */
}
```

---

### 9.7 Badges & Status Pills

All badges use the same base shape. Colour and text vary by semantic role.

```
  ┌───────────────┐   ┌───────────────┐   ┌────────────┐   ┌──────────────┐
  │ ● Certified   │   │ ○ Draft       │   │ Deprecated │   │ BBL-intern   │
  └───────────────┘   └───────────────┘   └────────────┘   └──────────────┘
  green               amber               grey                blue (access)
```

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);              /* 2px 8px */
  font-size: var(--text-small);             /* 12px */
  font-weight: 500;
  border-radius: var(--radius-sm);          /* 4px */
  border: 1px solid currentColor;
  white-space: nowrap;
}

.badge-certified {
  color: var(--color-status-certified);
  background: var(--color-status-certified-bg);
}

.badge-draft {
  color: var(--color-status-draft);
  background: var(--color-status-draft-bg);
}

.badge-deprecated {
  color: var(--color-status-deprecated);
  background: var(--color-status-deprecated-bg);
}

/* Classification pills (access level) */
.badge-public       { color: var(--color-status-certified);  background: var(--color-status-certified-bg); }
.badge-internal     { color: var(--color-text-link);         background: var(--color-bg-accent); }
.badge-confidential { color: var(--color-status-draft);      background: var(--color-status-draft-bg); }
.badge-restricted   { color: var(--color-error);             background: var(--color-error-bg); }
```

**Dot indicator:** An SVG circle (6px) precedes the text label for status badges.
Certified = filled green circle. Draft = hollow amber circle. Do not use emoji.

---

### 9.8 Cards

Used in list views (system cards, data product cards). Cards are flat at rest;
a subtle shadow appears on hover.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [icon 20px]  Title                                    [Status badge]      │
│               Subtitle · metadata · metadata                                │
│               Second line of metadata                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
border: 1px solid --color-border-subtle
border-radius: --radius-lg (8px)
background: --color-bg-page
padding: --space-5 (20px)
```

```css
.card {
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  cursor: pointer;
  transition: box-shadow 150ms ease, border-color 150ms ease;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.card:hover {
  box-shadow: var(--shadow-card);
  border-color: var(--color-border-default);
}

.card-icon {
  color: var(--color-text-secondary);
  flex-shrink: 0;
  margin-top: 2px;
}

.card-content { flex: 1; min-width: 0; }

.card-title {
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: var(--space-1);
}

.card-meta {
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.card-actions {
  flex-shrink: 0;
}
```

Between cards in list views: `gap: var(--space-3)` (12px). No alternating row
colours in card lists — white throughout. Alternating rows are a table pattern only.

---

### 9.9 Tables

Tables are used for Contents (field lists), Mappings, Values (code list), and
Quality (field-level metrics). They are near-borderless: only horizontal row
separators, no vertical column borders, no outer border on the table itself.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NAME              TYPE          GLOSSARIES      NULL %    DISTINCT         │  ← header row
├─────────────────────────────────────────────────────────────────────────────┤
│  MIOBJNR           VARCHAR       Mietobjekt      0%        48,231           │  ← row
│  MIOBJBEZ          VARCHAR       –               3%        21,450           │  ← row (hover bg)
│  MFLAECHE          DECIMAL       –               22% ⚠     8,231           │  ← row with warning
└─────────────────────────────────────────────────────────────────────────────┘
```

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body);
}

.data-table thead th {
  font-size: var(--text-label);               /* 11px */
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);     /* 8px 12px */
  text-align: left;
  border-bottom: 1px solid var(--color-border-default);
  white-space: nowrap;
}

.data-table tbody tr {
  border-bottom: 1px solid var(--color-border-subtle);
  transition: background 80ms ease;
}

.data-table tbody tr:hover {
  background: var(--color-bg-surface);
}

.data-table tbody tr:last-child {
  border-bottom: none;
}

.data-table tbody td {
  padding: var(--space-2) var(--space-3);    /* 10px 12px */
  color: var(--color-text-primary);
  vertical-align: middle;
}

/* Technical values (field names, data types) */
.data-table .cell-mono {
  font-family: var(--font-mono);
  font-size: var(--text-mono);               /* 13px */
}

/* Clickable cell values */
.data-table a {
  color: var(--color-text-link);
  text-decoration: none;
}

.data-table a:hover {
  text-decoration: underline;
}
```

Column header alignment: all left-aligned. No centred or right-aligned headers.
Numeric values (counts, percentages) can be right-aligned in the cell but not
the header. Never centre-align anything in a data table.

---

### 9.10 Forms & Inputs

```
label (12px / 500 / secondary)
┌──────────────────────────────────────────────────────────┐
│  Value...                                                │
└──────────────────────────────────────────────────────────┘
helper text (12px / 400 / secondary)
```

```css
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--text-small);             /* 12px */
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-input {
  padding: var(--space-2) var(--space-3);   /* 8px 12px */
  font-size: var(--text-body);
  font-family: var(--font-sans);
  color: var(--color-text-primary);
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
  width: 100%;
}

.form-input::placeholder {
  color: var(--color-text-placeholder);
}

.form-input:hover {
  border-color: var(--color-border-strong);
}

.form-input:focus {
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 3px rgba(11, 111, 204, 0.12);
}

.form-helper {
  font-size: var(--text-small);
  color: var(--color-text-secondary);
}

.form-select {
  /* Same as .form-input */
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B6B66' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

textarea.form-input {
  resize: vertical;
  min-height: 96px;
}
```

---

### 9.11 Search

The search bar in the header and the inline section filters use the same input
style, but the header variant has a larger radius and a search icon prefix.

```
┌────────────────────────────────────────────────────────────────────┐
│ 🔍  Search datasets, concepts...                                   │
└────────────────────────────────────────────────────────────────────┘
border: 1px solid --color-border-default
border-radius: --radius-xl (12px)
height: 36px
```

```css
.search-bar {
  position: relative;
  width: 100%;
}

.search-bar-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-placeholder);
  pointer-events: none;
}

.search-bar-input {
  width: 100%;
  height: 36px;
  padding: 0 var(--space-3) 0 36px;
  font-size: var(--text-body);
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-xl);
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.search-bar-input:focus {
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 3px rgba(11, 111, 204, 0.12);
}
```

**Search dropdown:**

```
┌──────────────────────────────────────────────────────────────────┐
│  CONCEPTS                                             ← label    │
│  📄  Mietobjekt         Concept · Portfolio                      │
│  📄  Nutzungseinheit    Concept · Space Management               │
│  ──────────────────────────────────────────────────────────────  │
│  DATASETS                                                        │
│  🗃  VIBDBE             Table · SAP RE-FX                        │
│  ──────────────────────────────────────────────────────────────  │
│  → View all 12 results                              ← footer     │
└──────────────────────────────────────────────────────────────────┘
background: --color-bg-page
border: 1px solid --color-border-default
border-radius: --radius-lg
box-shadow: --shadow-card
max-height: 400px, overflow-y: auto
```

Each result row: 36px height, 12px horizontal padding, hover background
`--color-bg-surface`. Active (keyboard-selected) row background
`--color-bg-accent`. Group labels use the Label role (11px uppercase).

---

### 9.12 Quality Bar

Used in the Quality tab for field-level null/distinct/completeness visualisation,
matching Informatica's coloured bar exactly.

```
  MFLAECHE      22%  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    8,231 distinct
                     ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                     null%  ↑ orange fill
```

```css
.quality-bar {
  display: flex;
  height: 8px;
  border-radius: var(--radius-sm);
  background: var(--color-quality-bg);
  overflow: hidden;
  min-width: 120px;
}

.quality-bar-null {
  background: var(--color-quality-null);    /* #F07A2A */
  height: 100%;
  transition: width 300ms ease;
}

.quality-bar-complete {
  background: var(--color-quality-complete); /* #1BA8A0 */
  height: 100%;
  transition: width 300ms ease;
}
```

For the header summary bars (completeness, format validity):

```
  Completeness     ████████████████████░░░░  82%
  ─────────────────────────────────────────────────
  bar height: 12px
  label left: 130px fixed width
  value right: 40px fixed width, right-aligned
  bar: flex-1 between label and value
```

---

### 9.13 Lineage Tree

The Lineage tab on physical entities (Dataset, Data Product) renders a textual tree, not a graph canvas. "Provenance" is the DCAT/PROV term used in the data model (`prov:wasDerivedFrom`); "Lineage" is the user-facing label throughout the UI.

```css
.provenance-tree {
  font-family: var(--font-mono);
  font-size: var(--text-mono);              /* 13px */
  color: var(--color-text-primary);
  line-height: 1.8;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.provenance-node {
  color: var(--color-text-link);
  cursor: pointer;
  text-decoration: none;
}

.provenance-node:hover {
  text-decoration: underline;
}

.provenance-edge-label {
  font-family: var(--font-sans);
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  font-style: italic;
}
```

Tree connectors (├──, └──, │) use `--color-text-secondary`. Arrow glyphs (──→)
use the same colour. Clickable node names use link colour.

---

### 9.14 Empty States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        [icon 32px, secondary colour]                        │
│                                                                             │
│                         No mappings yet                                     │
│                                                                             │
│                  This concept has not been mapped to any                    │
│                  physical fields. Add a mapping to connect                  │
│                  it to a source system.                                     │
│                                                                             │
│                         [+ Add mapping]                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-12) var(--space-8);   /* 48px 32px */
  color: var(--color-text-secondary);
}

.empty-state-icon {
  margin-bottom: var(--space-4);
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.empty-state-title {
  font-size: var(--text-heading-m);          /* 16px */
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.empty-state-description {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  max-width: 360px;
  line-height: 1.6;
  margin-bottom: var(--space-5);
}
```

Empty states always include a title and a description. The CTA button is optional —
only shown when the user can take action. Never show "No data" alone without context.

---

### 9.15 Loading States

Use a skeleton screen, not a spinner. Match the layout of the content being loaded.

```
Skeleton block:
  background: linear-gradient(
    90deg,
    #EFEFED 25%,
    #E8E8E5 50%,
    #EFEFED 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: var(--radius-sm);
```

```css
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #EFEFED 25%, #E4E4E0 50%, #EFEFED 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.skeleton-text  { height: 14px; }
.skeleton-title { height: 24px; width: 40%; }
.skeleton-badge { height: 20px; width: 72px; border-radius: var(--radius-sm); }
.skeleton-row   { height: 40px; width: 100%; }
```

Skeleton blocks replace exact content areas (title, metadata row, table rows).
Never show a blank white page or a centred spinner for more than 200ms.

---

### 9.16 Locked Asset

For entities with `sensitivity_level ≥ 2` shown on the public frontend.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [🔒 20px]  Construction Cost Benchmarks         [Vertraulich]             │
│             DATA PRODUCT                                                    │
│                                                                             │
│             This data product is classified Vertraulich and is              │
│             available to authorised BBL staff only.                         │
│                                                                             │
│             [Request access →]                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
background: --color-status-restricted-bg (#F7F7F6)
border:     1px solid --color-border-subtle
opacity on text: 1.0 (do not reduce — name must be readable)
```

```css
.card-locked {
  background: var(--color-status-restricted-bg);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  cursor: default;
}

.card-locked-icon {
  color: var(--color-status-restricted);
  flex-shrink: 0;
  margin-top: 2px;
}

.card-locked-name {
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--color-status-restricted);
}

.card-locked-type {
  font-size: var(--text-label);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-status-restricted);
  margin-bottom: var(--space-2);
}

.card-locked-description {
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-3);
}
```

The "Request access" CTA is a `.btn-ghost` in link colour — not a full button.
It should link to an access request form or a mailto with subject pre-filled.

---

### 9.17 Translation Gap Indicator

Shown inline when the selected UI language has no translation for a field.

```
  IT  │  [⚠ No translation]
```

```css
.translation-gap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-small);
  color: var(--color-warning);              /* #C9820B */
  background: var(--color-warning-bg);      /* #FEF7E8 */
  border-radius: var(--radius-sm);
  padding: 1px var(--space-1);
}
```

In the i18n name table (Overview tab), the missing-locale row shows this badge
instead of text. Stewards can click it to open an inline edit form for that locale.
The badge is never shown to viewers — only stewards and admins see it. Viewers see
the fallback language value (EN → DE → blank) without a gap indicator.

---

### 9.18 Feedback / Comments

The Feedback tab renders a comments thread. Style matches Informatica's comments
panel but integrated as a tab rather than a slide-over.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Leave a comment... Use @ to tag a colleague.                       │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  [Submit]                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  D. Rasmussen  ·  2 days ago                                               │
│  Confirmed EGID mapping with GWR team. MIOBJNR is not the EGID —          │
│  the EGID is on the parent VIBGEB table.                                    │
│  Reply                                                                      │
│                                                                             │
│    B. Vidondo  ·  1 day ago                                                │  ← reply, indented 24px
│    Agreed. Updated the mapping accordingly.                                  │
│    Reply                                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```css
.comment {
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.comment:last-child { border-bottom: none; }

.comment-author {
  font-size: var(--text-body);
  font-weight: 500;
  color: var(--color-text-primary);
  display: inline;
}

.comment-meta {
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  margin-left: var(--space-2);
}

.comment-body {
  font-size: var(--text-body);
  color: var(--color-text-primary);
  margin: var(--space-1) 0 var(--space-2);
  line-height: 1.6;
}

.comment-reply-btn {
  font-size: var(--text-small);
  color: var(--color-text-link);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.comment-reply-btn:hover { text-decoration: underline; }

.comment-thread {
  padding-left: var(--space-6);             /* 24px indent */
  border-left: 2px solid var(--color-border-subtle);
  margin-top: var(--space-3);
}
```

No star ratings (unlike Informatica). Feedback is text-only. User avatars are
initials circles: 28px, `--radius-xl`, `--color-bg-accent-strong` background,
white initials, 11px / 500.

---

## 10. Icons

Use a single icon set throughout. **Lucide** (MIT licensed, available as SVG or
React components) is recommended. Do not mix sets.

```
Size      Usage
──────────────────────────────────────────────────────────────────
16px      Inline icons in table cells, badges, nav items, buttons
20px      Entity type icon in title block, card icons
24px      Feature icons in empty states

Stroke width: 1.5px (Lucide default) — do not change.
```

**Icon-to-entity mapping (canonical, never deviate):**

```
Entity            Icon name (Lucide)
──────────────────────────────────────────────────────────────────
Vocabulary        book-open
Collection        folder
Concept           file-text
Concept Attribute list
Code List         list-ordered
Code List Value   tag
System            database
Schema            layers
Dataset           table-2
Field             columns
Data Product      package
Distribution      share-2
Lineage           git-merge
Relationship      link-2
Quality           bar-chart-2
Contact           user
User              user-circle
Locked asset      lock
Search            search
Settings          settings
Help              help-circle
Language          globe
Certified         check-circle
Draft             clock
Deprecated        archive
Warning           alert-triangle
Error             alert-circle
```

Icons used without a visible text label must have an `aria-label` attribute.
Never use `title` for icon tooltips — use a custom tooltip component.

---

## 11. Interaction States

Every interactive element must implement all four states. Never skip one.

```
State         Visual treatment
──────────────────────────────────────────────────────────────────────────────
Default       As specified in component CSS above
Hover         Background shift (surface → surface-hover) or underline on text
              Cursor: pointer
Focus         box-shadow: 0 0 0 3px rgba(11, 111, 204, 0.20)
              border-color: --color-border-accent
              outline: none (custom focus ring replaces browser default)
Active        Background darkened one step (button: 700 variant)
              transform: none — no press animation
Disabled      opacity: 0.45
              cursor: not-allowed
              pointer-events: none
──────────────────────────────────────────────────────────────────────────────
```

**Transitions:**

```css
/* Standard timing — use on all interactive elements */
transition: background 120ms ease, color 120ms ease,
            border-color 120ms ease, box-shadow 120ms ease;

/* Slower for shadows (card hover) */
transition: box-shadow 150ms ease, border-color 150ms ease;
```

Never use `transition: all` — it causes unexpected animation of layout properties.
No spring animations, bounce effects, or transform-based micro-interactions.
The application is a professional data tool, not a consumer product.

---

## 12. Accessibility

**Colour contrast:**

All text must meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).

```
Primary text (#2C2C29) on white (#FFFFFF):         18.1:1  ✓
Secondary text (#6B6B66) on white (#FFFFFF):         5.9:1  ✓
Link (#0B6FCC) on white (#FFFFFF):                   5.2:1  ✓
White on accent-strong (#0B6FCC):                    5.2:1  ✓
Warning text (#C9820B) on warning-bg (#FEF7E8):      4.8:1  ✓
Status-restricted (#A3A39E) on surface (#F7F7F6):    2.4:1  ✗ — use only for
                                                             decorative text,
                                                             not for conveying info
```

**Keyboard navigation:**

- All interactive elements must be focusable (natural tab order).
- Tab bar: arrow keys navigate between tabs (roving tabindex).
- Search dropdown: arrow keys navigate results, Enter selects, Escape closes.
- Sidebar nav: standard tab order, no arrow-key navigation required.
- Modals and dropdowns: focus must be trapped inside while open.

**Screen reader:**

- Every icon used without text label must have `aria-label`.
- Status badges must not rely on colour alone — the text label is mandatory.
- Tables must have `<th scope="col">` on all column headers.
- Hidden tabs must use `hidden` attribute, not `display: none`, to be excluded
  from the accessibility tree.
- Skeleton loading states: `aria-busy="true"` on the container, `aria-hidden="true"`
  on the skeleton elements themselves.

**Reduced motion:**

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; background: #EFEFED; }
  * { transition-duration: 0ms !important; }
}
```

---

## 13. Internationalisation

**Text expansion.** German and French text is typically 20–40% longer than English.
French can be up to 60% longer for short strings. Design all components to handle
this without truncation or overflow.

```
English:    Overview
German:     Übersicht          +0%  (same)
French:     Aperçu             +0%  (shorter)
Italian:    Panoramica         +44%

English:    Federal Property Portfolio
German:     Bundesimmobilien-Portfolio
French:     Portefeuille immobilier fédéral  +40% longer
```

Rules derived from this:
- Tabs must be allowed to scroll horizontally on narrow viewports — never truncate
  tab labels.
- Badge labels must have a minimum width but no maximum — they wrap in their pill.
- Card titles must allow two lines before truncating with ellipsis.
- Never hardcode pixel widths for containers that hold translated strings.

**Special characters.** All four languages use characters outside ASCII.
```
DE: ä ö ü Ä Ö Ü ß
FR: é è ê ë à â ù û ü ô î ï ç œ
IT: à è é ì ò ó ù
```

Ensure fonts are loaded with the full Latin Extended character set.
Inter covers all of these. Verify that `font-display: swap` is set to avoid
invisible text during font load.

**Number and date formatting.** Use the browser's `Intl` API, never hardcode
formatters.

```javascript
// Date
new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' }).format(date)
// → "12. Jan. 2025"

// Number
new Intl.NumberFormat('de-CH').format(48231)
// → "48 231"

// Percentage
new Intl.NumberFormat('de-CH', { style: 'percent', maximumFractionDigits: 1 })
  .format(0.82)
// → "82 %"
```

**Right-to-left.** Not required for DE/FR/IT/EN. Do not add RTL infrastructure.

---

## 14. Do / Don't

```
DO                                          DON'T
──────────────────────────────────────────────────────────────────────────────
Use whitespace to separate sections         Add decorative divider lines between
                                            every section

Use the Label role (11px uppercase) for     Use uppercase on body text or headings
column headers and UI meta labels only

Show tabs only when they have content       Show empty tabs with a "No data" message

Use blue exclusively for interactive        Use blue for decorative highlights,
elements                                    category colours, or emphasis

Use skeleton loading screens                Use a spinner for content loading

Show locked asset name + access request     Hide restricted assets entirely

Show translation gap indicators to          Show placeholder text in another
stewards only                               language without flagging it

Use the canonical icon per entity type      Mix icon styles or invent new mappings

Use Inter at 14px/400 for body              Use 13px body text for density

Keep the four-state interaction model       Implement hover only, skip focus ring
complete on every interactive element

One shadow only: the header                 Add card shadows at rest, or stack
                                            shadows for elevation

Font-weight max 600                         Use 700 or bold on any element

Test all components at 160% font scale      Assume 100% is the only zoom level
(browser accessibility zoom)
──────────────────────────────────────────────────────────────────────────────
```

---

*End of document.*
