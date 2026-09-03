# CLAUDE.md

This document provides development guidelines for Claude Code when working on the BBL Buildings Data Catalog project.

## Repository Layout

The repo hosts **eight sibling prototypes** under `prototype-*/` folders, plus a root `index.html` that redirects to the Oblique catalog. A root `404.html` forwards the folder names retired in September 2026 (`prototype-main`, `prototype-mermaid`, `prototype-ea-immo`) to their successors on GitHub Pages.

```
data-catalog/
├── index.html              # Redirect to prototype-oblique/
├── 404.html                # GitHub Pages fallback: forwards retired prototype folder names
├── prototype-oblique/      # Datenkatalog following the Oblique design system (see its docs/)
├── prototype-dcat/         # Business Object & Dataset Catalog on DCAT-AP CH (Datenkatalog IMMO)
├── prototype-sqlite/       # SQLite Catalog Explorer (BBL Datenkatalog, SQLite)
├── prototype-layers/       # Architecture Layer Browser (Meta-Atlas)
├── prototype-lineage/      # Data Lineage Viewer
├── prototype-erd/          # ER diagram and flowchart editor on Mermaid (Simple Chart)
├── prototype-canvas/       # Architecture Canvas (Miro-style data-architecture modelling)
├── prototype-datamodel/    # EA-IMMO conceptual data model for real estate
├── chat-worker/            # Cloudflare Worker behind the SQLite prototype's AI assistant
├── assets/                 # Shared repo assets (social preview, screenshots)
└── docs/                   # Repo-level docs (market research, etc.)
```

The guidelines below document **`prototype-dcat/`** specifically (the DCAT-AP catalog). Each other prototype has its own README.

## Project Overview

`prototype-dcat/` is a **minimalist web application** for cataloging business objects and datasets for the Swiss Federal Office for Buildings and Logistics. It runs from `prototype-dcat/index.html` with CSS and JavaScript in separate files and zero external JavaScript dependencies.

## Architecture

### Design
- HTML structure in `prototype-dcat/index.html` (~360 lines)
- CSS styles in `prototype-dcat/css/style.css` (~966 lines)
- JavaScript application in `prototype-dcat/js/app.js` (~850 lines)
- No build system, bundlers, or transpilers
- Data loaded from JSON files at runtime
- Hash-based client-side routing

### Code Organization

```
prototype-dcat/
├── index.html          → HTML structure only
├── css/style.css       → All styles (~966 lines)
└── js/app.js           → JavaScript application (~850 lines)
    ├── State management
    ├── Data loading
    ├── Routing
    ├── Rendering functions
    └── Event handlers
```

### Key Patterns
- **IIFE Pattern:** JavaScript wrapped to avoid global scope pollution
- **Hash Routing:** `window.location.hash` for navigation
- **URL as State:** Filter states stored in URL query parameters
- **Event Delegation:** Single listeners on container elements
- **Async Data Loading:** JSON files loaded via fetch()

## File Locations

All paths below are inside `prototype-dcat/`.

| Purpose | Location |
|---------|----------|
| HTML structure | `prototype-dcat/index.html` |
| Styles | `prototype-dcat/css/style.css` |
| JavaScript | `prototype-dcat/js/app.js` |
| Business objects | `prototype-dcat/data/concepts.json` |
| Dataset definitions | `prototype-dcat/data/datasets.json` |
| UI translations | `prototype-dcat/data/i18n.json` |
| About page content | `prototype-dcat/content/about-{de,fr,it,en}.html` |
| User manual | `prototype-dcat/content/manual-{de,fr,it,en}.html` |
| Concept images | `prototype-dcat/assets/concepts/` |
| Dataset images | `prototype-dcat/assets/datasets/` |

## Development Commands

```bash
# From the repo root, start a static server
python3 -m http.server 8000
# or
npx http-server

# Open in browser — root redirects to prototype-oblique/
open http://localhost:8000
# direct URL for this catalog:
open http://localhost:8000/prototype-dcat/
```

## Making Changes

### Adding a New Concept

1. Edit `prototype-dcat/data/concepts.json`
2. Add a new object with required fields:
   - `id`, `title` (multilingual `{de,fr,it,en}` object), `description`, `fullDescription`
   - `image`, `tags` (language-independent keys), `meta`, `standards`, `attributes`
   - Optional: `responsiblePersons`
3. Add tag translations to `prototype-dcat/data/i18n.json` if using new tags
4. Add corresponding image to `assets/concepts/`

### Adding a New Dataset

1. Edit `prototype-dcat/data/datasets.json`
2. Add a new object with required fields:
   - Same as concepts plus `distributions` and `publications`
3. Add tag translations to `prototype-dcat/data/i18n.json` if using new tags
4. Add corresponding image to `assets/datasets/`

### i18n / Translations

- **UI strings**: Add keys to `data/i18n.json` with `{de, fr, it, en}` values
- **Data fields**: `title`, `description`, `fullDescription`, and selected meta fields are `{de,fr,it,en}` objects
- **Tags**: Language-independent keys (e.g., `"arch_view"`), translated via `tag.*` keys in `i18n.json`
- **Enums**: Internal keys (e.g., `"public"`, `"internal"`), translated via `enum.*` keys in `i18n.json`
- **Content pages**: Per-language HTML files in `content/` (e.g., `about-de.html`, `about-fr.html`)
- **Language state**: Stored in URL `lang` param and `localStorage`, default `de`
- **Translation function**: `t(key)` resolves both i18n keys and inline `{de,fr,...}` objects

### Modifying Styles

All CSS is in `css/style.css`. Key CSS variables:

```css
--primary-500: #e53940;      /* Swiss Red - primary accent */
--secondary-600: #2f4356;    /* Dark blue-grey */
--text-900: #111827;         /* Main text color */
--secondary-50: #f0f4f7;    /* Light backgrounds */
--text-200: #e5e7eb;         /* Borders and dividers */
```

### Adding New Features

When adding JavaScript functionality:
1. Locate the relevant section in `js/app.js`
2. Follow existing patterns for consistency
3. Use the existing state management approach
4. Update URL parameters if adding new filters

## Code Style Guidelines

### JavaScript
- Use vanilla JavaScript (no frameworks)
- Prefer `const` and `let` over `var`
- Use template literals for HTML generation
- Use async/await for data fetching
- Keep functions focused and small

### CSS
- Use CSS variables for colors and spacing
- Follow BEM-like naming (`.card-title`, `.filter-panel`)
- Mobile-first responsive design
- Use flexbox/grid for layouts

### HTML
- Use semantic elements (`<nav>`, `<main>`, `<article>`)
- Include proper accessibility attributes
- Keep structure minimal and clean

## Data Schema Reference

### Concept Object
```json
{
  "id": "string (unique identifier)",
  "title": "string (display name)",
  "description": "string (short summary)",
  "fullDescription": "string (detailed description)",
  "image": "string (path to image)",
  "tags": ["array", "of", "strings"],
  "meta": {
    "fachliche_id": "string",
    "termdat": "string (TERMDAT reference)",
    "fachbereich": "string",
    "system": "string (source system)",
    "klassifizierung": "Public|Intern|Vertraulich|Geheim",
    "personenbezogen": "Keine|Personenbezogen|Besonders schützenswert",
    "kommentar": "string",
    "version": "string (semver)"
  },
  "standards": [
    { "name": "string", "value": "string|array" }
  ],
  "attributes": [
    { "name": "string", "format": "string", "key": "PK|FK|-", "list": "string", "desc": "string" }
  ],
  "responsiblePersons": [
    { "admindirId": "string", "name": "string", "rolle": "string" }
  ]
}
```

### Dataset Object
```json
{
  // Same fields as concept, plus:
  "distributions": [
    {
      "name": "string",
      "format": "string",
      "identifikator": "string",
      "titel": "string",
      "zugriffsUrl": "string (URL)",
      "downloadUrl": "string (URL)",
      "status": "string",
      "dateiformat": "string",
      "lizenz": "string",
      "bemerkungen": "string"
    }
  ],
  "publications": [
    { "katalog": "string", "url": "string" }
  ]
}
```

## Testing

No automated tests exist. Manual testing:

1. Check all navigation routes work
2. Verify search and filter functionality
3. Test grid/list view toggle
4. Verify detail pages render correctly
5. Check responsive behavior on mobile
6. Test print functionality
7. Test share functionality

## Common Tasks

### Fix styling issues
- Check `<style>` section in `index.html`
- Use browser dev tools to identify CSS conflicts
- Maintain Swiss Federal Administration design guidelines

### Add new filter option
1. Add filter UI in the filter panel HTML
2. Add state variable for the filter
3. Update `applyFilters()` function
4. Update URL parameter handling

### Debug data loading
- Check browser console for fetch errors
- Verify JSON file syntax is valid
- Check file paths are correct

## Important Notes

- **No build step required** - changes are immediately visible on refresh
- **Keep dependencies at zero** - this is intentional for simplicity
- **Preserve Swiss Federal styling** - use official colors and fonts
- **Follow DCAT-AP CH standard** - metadata structure must comply
- **German is primary language** - all content in German, UI labels in German
