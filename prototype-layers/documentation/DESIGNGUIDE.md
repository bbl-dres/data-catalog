# Meta-Atlas - Design Guide

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Components](#5-components)
6. [Icons](#6-icons)
7. [CSS Custom Properties](#7-css-custom-properties)

---

## 1. Design Philosophy

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Swiss Clarity** | Clean, neutral, trustworthy design inspired by Swiss federal aesthetics |
| **Business-First** | Optimize for non-technical users; hide complexity, reveal on demand |
| **Dark Mode Native** | Design dark mode first, derive light mode; both are first-class citizens |
| **Progressive Disclosure** | Overview first, details on request; never overwhelm |

### 1.2 Target Users

| User Type | Needs | Design Implications |
|-----------|-------|---------------------|
| Business Analyst | Understand concepts, find definitions | Plain language, clear hierarchy |
| Domain Expert | Validate terminology, check relationships | Easy navigation, cross-references |
| Data Steward | Review compliance, check lineage | Status indicators, compliance badges |
| Data Engineer | Understand physical structures | Technical detail views |

---

## 2. Color System

### 2.1 Background Colors

**Dark Mode (Default):**
```css
--color-bg-base: #0F1419;      /* Main background */
--color-bg-surface: #171C24;   /* Cards, panels */
--color-bg-elevated: #1F252E;  /* Dropdowns, modals */
--color-bg-hover: rgba(255, 255, 255, 0.05);
--color-bg-active: rgba(255, 255, 255, 0.08);
```

**Light Mode:**
```css
--color-bg-base: #F4F6F8;      /* Main background */
--color-bg-surface: #FFFFFF;   /* Cards, panels */
--color-bg-elevated: #FFFFFF;  /* Dropdowns, modals */
--color-bg-hover: rgba(0, 0, 0, 0.035);
--color-bg-active: rgba(0, 0, 0, 0.055);
```

### 2.2 Text Colors

**Dark Mode:**
```css
--color-text-primary: #F0F3F6;    /* Main text */
--color-text-secondary: #8B99A8;  /* Secondary text */
--color-text-muted: #5C6A7A;      /* Hints, disabled */
--color-text-disabled: #3D4854;   /* Disabled text */
```

**Light Mode:**
```css
--color-text-primary: #1A1F26;    /* Main text */
--color-text-secondary: #4D5866;  /* Secondary text */
--color-text-muted: #6E7A89;      /* Hints, disabled */
--color-text-disabled: #9CA7B4;   /* Disabled text */
```

### 2.3 Layer Colors

Each architecture layer has a distinct color for instant recognition:

| Layer | Color | Usage |
|-------|-------|-------|
| **Conceptual** | `#4F8EF7` (Blue) | Domains, Concepts |
| **Logical** | `#22C997` (Green) | Entities, Attributes |
| **Physical** | `#F5A524` (Amber) | Systems, Tables, Columns |

```css
/* Dark Mode */
--color-conceptual: #4F8EF7;
--color-conceptual-bg: rgba(79, 142, 247, 0.10);
--color-conceptual-border: rgba(79, 142, 247, 0.25);

--color-logical: #22C997;
--color-logical-bg: rgba(34, 201, 151, 0.10);
--color-logical-border: rgba(34, 201, 151, 0.25);

--color-physical: #F5A524;
--color-physical-bg: rgba(245, 165, 36, 0.10);
--color-physical-border: rgba(245, 165, 36, 0.25);
```

### 2.4 Status Colors

| Status | Color | Usage |
|--------|-------|-------|
| **Active** | `#22C997` (Green) | Entity is current |
| **Draft** | `#F5A524` (Amber) | Work in progress |
| **Deprecated** | `#6B7A8A` (Gray) | No longer recommended |
| **Planned** | `#9B6EF3` (Purple) | Future entity |

### 2.5 Semantic Colors

```css
--color-error: #F25C5C;
--color-warning: #F5A524;
--color-success: #22C997;
--color-info: #4F8EF7;
```

---

## 3. Typography

### 3.1 Font Stack

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", Consolas, monospace;
```

Fonts are loaded from Google Fonts in `index.html`.

### 3.2 Type Scale

| Name | Size | Weight | Usage |
|------|------|--------|-------|
| Display | 32px (2rem) | 600 | Hero titles |
| H1 | 24px (1.5rem) | 600 | Page titles |
| H2 | 18px (1.125rem) | 600 | Section titles |
| H3 | 16px (1rem) | 600 | Card titles |
| Body | 14px (0.875rem) | 400 | Main content |
| Small | 13px (0.8125rem) | 400 | Secondary text |
| Caption | 12px (0.75rem) | 400 | Labels, captions |
| XS | 11px (0.6875rem) | 400 | Badges, metadata |

```css
--text-display: 2rem;
--text-h1: 1.5rem;
--text-h2: 1.125rem;
--text-h3: 1rem;
--text-body: 0.875rem;
--text-small: 0.8125rem;
--text-caption: 0.75rem;
--text-xs: 0.6875rem;
```

### 3.3 Font Weights

```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 3.4 Line Heights

```css
--leading-display: 1.2;
--leading-h1: 1.3;
--leading-body: 1.6;
--leading-small: 1.5;
--leading-caption: 1.45;
```

---

## 4. Spacing & Layout

### 4.1 Spacing Scale (4px base)

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

### 4.2 Layout Dimensions

```css
--sidebar-width: 260px;
--sidebar-min-width: 220px;
--sidebar-max-width: 320px;
--header-height: 52px;
--content-max-width: 1100px;
--prose-max-width: 640px;
```

### 4.3 Border Radius

```css
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 12px;
--radius-full: 9999px;
```

### 4.4 Breakpoints

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

---

## 5. Components

### 5.1 Cards

Primary container for entity information with collapsible headers.

```
┌─────────────────────────────────────────┐
│  Card Header                        [v] │
├─────────────────────────────────────────┤
│                                         │
│  Card content with metadata grid        │
│                                         │
└─────────────────────────────────────────┘
```

### 5.2 Badges

| Type | Style | Example |
|------|-------|---------|
| Layer | Filled, layer color | `[Concept]` `[Entity]` |
| Status | Dot + text | `● Active` `○ Draft` |
| Tag | Muted background | `eCH-0129` |

### 5.3 Tree Navigation

```
▼ CONCEPTUAL
  ▼ Immobilienverwaltung          [4]
    • Gebäude                     (selected)
    ○ Grundstück
    ○ Mietobjekt
▼ LOGICAL
  ▼ Building                       [8]
    └ egid
    └ building_type
▼ PHYSICAL
  ▼ SAP RE-FX                     [25]
    ▼ VIBDBE                       [5]
      └ EGID
```

### 5.4 Buttons

| Variant | Usage |
|---------|-------|
| Primary | Main actions (filled, accent color) |
| Secondary | Alternative actions (outline) |
| Ghost | Tertiary actions (text only) |
| Icon | Toolbar actions (icon only) |

### 5.5 Form Elements

```css
.input {
  font-size: var(--text-body);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
}
```

---

## 6. Icons

Icons are embedded as inline SVG in `app.js`. The icon set uses Lucide-style icons.

### 6.1 Icon Sizes

```css
--icon-xs: 12px;
--icon-sm: 14px;
--icon-md: 16px;
--icon-lg: 18px;
--icon-xl: 20px;
```

### 6.2 Entity Type Icons

| Entity | Icon |
|--------|------|
| Domain | `folder` |
| Concept | `lightbulb` |
| Entity | `cube` |
| Attribute | `hash` |
| System | `server` |
| Table | `table` |
| Column | `hash` |

### 6.3 Action Icons

| Action | Icon |
|--------|------|
| Search | `search` |
| Expand/Collapse | `chevronRight` / `chevronDown` |
| Theme toggle | `sun` / `moon` |
| Close | `x` |
| Add | `plus` |
| Sort | `sortAsc` / `sortDesc` |

---

## 7. CSS Custom Properties

### 7.1 Complete Reference

All design tokens are defined in `css/tokens.css`. Key categories:

**Colors:**
- Background hierarchy (`--color-bg-*`)
- Text hierarchy (`--color-text-*`)
- Layer colors (`--color-conceptual`, `--color-logical`, `--color-physical`)
- Status colors (`--color-status-*`)
- Semantic colors (`--color-error`, `--color-warning`, etc.)

**Typography:**
- Font families (`--font-sans`, `--font-mono`)
- Type scale (`--text-display` to `--text-xs`)
- Font weights (`--font-normal` to `--font-bold`)
- Line heights (`--leading-*`)

**Spacing:**
- Scale (`--space-1` to `--space-16`)
- Layout dimensions (`--sidebar-width`, `--header-height`, etc.)

**Visual:**
- Border radius (`--radius-xs` to `--radius-full`)
- Shadows (`--shadow-xs` to `--shadow-xl`)
- Animations (`--duration-fast`, `--ease-out`, etc.)

### 7.2 Theme Switching

Themes are applied via `data-theme` attribute on the root element:

```css
/* Default: Dark mode */
:root {
  --color-bg-base: #0F1419;
  /* ... */
}

/* Light mode override */
[data-theme="light"] {
  --color-bg-base: #F4F6F8;
  /* ... */
}
```

### 7.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## References

### Design Inspiration

- [Vercel Design](https://vercel.com/design) - Clean, dark-mode first
- [Linear](https://linear.app) - Keyboard-friendly, fast UI
- [Stripe Docs](https://stripe.com/docs) - Clear hierarchy
- [admin.ch](https://www.admin.ch) - Swiss federal aesthetic

### Resources

- [Inter Font](https://rsms.me/inter/) - Primary typeface
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) - Monospace typeface
- [Lucide Icons](https://lucide.dev) - Icon style reference

---

*Document Version: 2.0*
*Last Updated: January 2026*
*Status: Reflects Current Implementation*
