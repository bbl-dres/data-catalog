# Meta-Atlas - Requirements Specification

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Layers (TOGAF)](#2-architecture-layers-togaf)
3. [Entity Types](#3-entity-types)
4. [Application Structure](#4-application-structure)
5. [UI/UX Requirements](#5-uiux-requirements)
6. [Feature Status](#6-feature-status)

---

## 1. Project Overview

### 1.1 Purpose

Meta-Atlas is a metadata catalog prototype that provides a unified view of data assets across TOGAF architecture layers (Conceptual, Logical, Physical). It enables stakeholders to navigate from business concepts down to physical implementations while maintaining comprehensive metadata for governance and compliance.

### 1.2 Technical Approach

This prototype follows a **no-build, vanilla JavaScript** approach:

- Pure HTML5, CSS3, and ES6+ JavaScript
- No transpilation, bundling, or build tools required
- Single monolithic `app.js` file for all functionality
- JSON files for data storage
- Works directly from file system or simple HTTP server
- Zero external dependencies (fonts loaded from Google Fonts)

### 1.3 Context

Designed for Swiss Federal Government (BBL - Bundesamt für Bauten und Logistik) to manage real estate and building-related data entities with compliance/governance tracking.

---

## 2. Architecture Layers (TOGAF)

### 2.1 Layer Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CONCEPTUAL LAYER                         │
│  Business concepts, domains, terminology                    │
│  Audience: Business stakeholders, domain experts            │
├─────────────────────────────────────────────────────────────┤
│                     LOGICAL LAYER                           │
│  Technology-independent data models, entities, attributes   │
│  Audience: Data architects, analysts                        │
├─────────────────────────────────────────────────────────────┤
│                     PHYSICAL LAYER                          │
│  Database schemas, tables, columns, systems                 │
│  Audience: Developers, DBAs, system administrators          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Conceptual Layer

**Contains:**
- Business Domains (e.g., "Immobilienverwaltung", "Projektmanagement")
- Business Concepts (e.g., "Gebäude", "Mietvertrag", "Grundstück")

**Key Metadata:**
- Multilingual names (DE/EN/FR)
- Business definitions
- Synonyms
- Legal references
- Related concepts

### 2.3 Logical Layer

**Contains:**
- Logical Entities (e.g., "Building", "Plot", "RentalUnit")
- Attributes with data types

**Key Metadata:**
- Attribute definitions
- Data types (String, Integer, Decimal, Reference, etc.)
- Nullable flags
- Key indicators (PK, FK)
- Value domain references

### 2.4 Physical Layer

**Contains:**
- Systems (e.g., "SAP RE-FX", "PostGIS")
- Tables with columns

**Key Metadata:**
- Physical data types
- Column definitions
- Row counts
- System technology info

---

## 3. Entity Types

### 3.1 Entity Hierarchy

```
Project
  └── Domain (Conceptual)
        └── Concept (Conceptual)
              └── Logical Entity (Logical)
                    └── Attribute (Logical)

System (Physical)
  └── Table (Physical)
        └── Column (Physical)
```

### 3.2 Cross-Layer Relationships

- Concepts → realize → Logical Entities
- Logical Entities → implement → Physical Tables
- Attributes → map to → Columns

---

## 4. Application Structure

### 4.1 File Structure

```
meta-atlas/
├── index.html              # Single-page application entry point
├── css/
│   ├── tokens.css          # CSS custom properties (design tokens)
│   └── styles.css          # Main UI styles
├── js/
│   └── app.js              # Complete application logic (monolithic)
├── data/
│   ├── projects.json       # Project definitions
│   ├── domains.json        # Business domains
│   ├── concepts.json       # Business concepts
│   ├── entities.json       # Logical entities with attributes
│   ├── systems.json        # Physical systems
│   ├── tables.json         # Database tables with columns
│   └── value-domains.json  # Enumeration/reference data
├── documentation/
│   ├── REQUIREMENTS.md     # This file
│   ├── DATABASE.md         # Data model specifications
│   └── DESIGNGUIDE.md      # Design system guidelines
└── README.md               # Project overview
```

### 4.2 Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+)
- HTML5 / CSS3
- CSS Custom Properties for theming

**Fonts:**
- Inter (400, 500, 600, 700) - UI text
- JetBrains Mono (400, 500, 600) - Code/monospace

**Data Storage:**
- JSON files loaded via Fetch API
- LocalStorage for user preferences (theme)

### 4.3 State Management

The application uses a centralized state object:

```javascript
state = {
  currentProject: null,
  currentLayer: 'conceptual',
  currentView: 'wiki',
  selectedItem: null,
  expandedNodes: Set,
  expandedLayers: Set,
  theme: 'light',
  searchQuery: '',
  searchResults: []
}
```

### 4.4 Key Functions

| Function | Purpose |
|----------|---------|
| `loadData()` | Loads all JSON data files |
| `renderAll()` | Re-renders entire UI |
| `renderTree()` | Renders sidebar navigation |
| `renderContent()` | Renders main content area |
| `handleSearch()` | Full-text search with debounce |
| `navigateTo()` | URL-based navigation |

---

## 5. UI/UX Requirements

### 5.1 Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  Logo    Meta-Atlas     BBL Branding              [Search] [🌙] │
├──────────────────────────────────────────────────────────────────┤
├────────────────┬─────────────────────────────────────────────────┤
│                │                                                 │
│   Sidebar      │   Main Content Area                            │
│   (260px)      │                                                 │
│                │   ┌─────────────────────────────────────────┐  │
│   [Search]     │   │  Breadcrumb                             │  │
│   [Group By]   │   ├─────────────────────────────────────────┤  │
│                │   │  Entity Title + Badges                  │  │
│   CONCEPTUAL   │   ├─────────────────────────────────────────┤  │
│   ▼ Domain     │   │  [Details] [Diagram] [History]          │  │
│     Concept    │   ├─────────────────────────────────────────┤  │
│                │   │                                         │  │
│   LOGICAL      │   │  Content Cards                          │  │
│   ▼ Entity     │   │                                         │  │
│     └ Attr     │   └─────────────────────────────────────────┘  │
│                │                                                 │
│   PHYSICAL     │                                                 │
│   ▼ System     │                                                 │
│     └ Table    │                                                 │
│                │                                                 │
└────────────────┴─────────────────────────────────────────────────┘
│  Quellcode · API · Kontakt                              v0.1.0  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Navigation Features

- **Layer Sections**: Collapsible Conceptual/Logical/Physical sections
- **Tree Navigation**: Expandable/collapsible nodes with item counts
- **Search**: Global search with debounced results
- **Breadcrumb**: Path navigation with clickable segments
- **URL Routing**: Hash-based routing for direct linking

### 5.3 Detail Views

- **Wiki View**: Metadata cards with collapsible sections
- **Diagram View**: Placeholder for ER diagrams (future)
- **History View**: Placeholder for version history (future)

### 5.4 Theme Support

- Dark mode (default)
- Light mode
- Toggle button in header
- Preference saved to LocalStorage

---

## 6. Feature Status

### Implemented (Phase 1)

- [x] Project cards overview
- [x] Three-layer tree navigation (Conceptual/Logical/Physical)
- [x] Wiki view for all entity types
- [x] Cross-layer mapping display
- [x] Global search with results
- [x] Tree search and filtering
- [x] Sort by name (A-Z, Z-A)
- [x] Group by layer/system/domain
- [x] Expand/collapse all
- [x] Dark/light theme toggle
- [x] Responsive layout
- [x] Multilingual content (DE/EN in data)
- [x] Breadcrumb navigation
- [x] URL routing

### Planned (Future Phases)

- [ ] ER diagram visualization
- [ ] Data lineage view
- [ ] Version history and comparison
- [ ] Impact analysis
- [ ] Export functionality (PDF/JSON)
- [ ] API integration
- [ ] User authentication
- [ ] Edit capabilities

---

*Document Version: 2.0*
*Last Updated: January 2026*
*Status: Reflects Current Implementation*
