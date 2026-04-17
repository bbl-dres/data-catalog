# Mermaid Diagram Editor

Single-page editor for **ER diagrams** and **flowcharts** with free-text names — spaces, umlauts, and special characters all work out of the box. Built on [Mermaid](https://github.com/mermaid-js/mermaid). In-app branding: *Simple Chart*. Part of the [BBL Data Catalog prototypes](../README.md).

![Preview](assets/Preview1.jpg)

**Live demo:** https://bbl-dres.github.io/data-catalog/prototype-mermaid/

## Features

- Live Mermaid diagram preview as you type
- ER diagrams with name-first attribute syntax (key and comment as shorthand)
- Flowcharts with free-text quoted labels (auto-generated IDs)
- Direction (TD / BT / LR / RL), layout, and theme dropdowns
- Zoom / pan and SVG / PNG export
- Bundled examples in German and English

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

Any static file server works.

## ER diagram syntax

Attributes use a **name-first, comma-separated** format:

```
Name, Type, Key, "Comment"
```

| Column  | Required | Example                          |
|---------|----------|----------------------------------|
| Name    | yes      | `Gebäude ID`                     |
| Type    | yes      | `int`, `string`, `float`, `date` |
| Key     | optional | `PK`, `FK`, `UK`                 |
| Comment | optional | `"Büro, Wohnung, Lager"`         |

```
erDiagram
    Gebäude ||--o{ Raum : enthält
    Gebäude {
        Gebäude ID, int, PK
        Gebäude Name, string
        Gebäude Typ, string, , "Büro, Wohnung, Lager"
    }
    Raum {
        Raum ID, int, PK
        Fläche in m², float
    }
```

## Flowchart syntax

Quoted strings become free-text node labels; IDs are generated automatically.

```
flowchart TD
    "Antrag einreichen" --> "Dokumente prüfen"
    "Dokumente prüfen" --> {"Unterlagen vollständig?"}
    "Unterlagen vollständig?" -->|"Ja"| "Genehmigung"
    "Unterlagen vollständig?" -->|"Nein"| "Antrag einreichen"
```

## How it works

1. **Preprocessing** — free-text names are sanitized into valid Mermaid identifiers
2. **Rendering** — sanitized code is passed to Mermaid
3. **Post-processing** — original display names are swapped back into the rendered SVG

## Tech notes

[Mermaid](https://github.com/mermaid-js/mermaid) (MIT) loaded via CDN. No build step, no npm dependencies.

## License

MIT — see repo root [LICENSE](../LICENSE).
