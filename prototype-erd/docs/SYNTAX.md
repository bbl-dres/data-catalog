# Diagram syntax

Syntax reference for the Mermaid Diagram Editor (Simple Chart). Features and setup are in the [README](../README.md).

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

