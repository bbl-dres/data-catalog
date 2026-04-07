"""
Extract business objects from Objektmanagement markdown files
and add them to Konsolidierte_Geschaeftsobjekte.xlsx
"""

import re
import pandas as pd
from pathlib import Path

# Configuration
DOCS_DIR = Path(__file__).parent.parent / "docs"
EXCEL_FILE = Path(__file__).parent.parent / "Konsolidierte_Geschaeftsobjekte.xlsx"

# Files to process with their domain names
FILES_TO_PROCESS = [
    ("Objektmanagement - GFB6 Garantiemanagement.md", "Objektmanagement - GFB6 (Garantiemanagement)"),
    ("Objektmanagement - GFW9 Instandhaltung.md", "Objektmanagement - GFW9 (Instandhaltung)"),
    ("Objektmanagement - GFW12 Reinigung.md", "Objektmanagement - GFW12 (Reinigung)"),
    ("Reinigungsmanagement_Archiv.md", "Objektmanagement - Reinigungsmanagement (Archiv)"),
]


def extract_table_from_markdown(content: str) -> list[dict]:
    """Extract business objects from markdown table"""
    objects = []
    current_group = ""

    # Find tables with the business objects pattern
    # Look for table rows with | separators
    table_pattern = r'\|[^\n]+\|'

    in_table = False
    for line in content.split('\n'):
        # Skip separator lines
        if re.match(r'\|[\s\-:]+\|', line):
            in_table = True
            continue

        # Check if this is a table row
        if not line.strip().startswith('|') or not line.strip().endswith('|'):
            if in_table and line.strip():
                in_table = False
            continue

        # Parse table row
        cells = [c.strip() for c in line.split('|')[1:-1]]

        if len(cells) < 6:
            continue

        # cells[0] = row number
        # cells[1] = Gruppe/Geschäftsobjekt
        # cells[2] = Priorität
        # cells[3] = Beschreibung
        # cells[4] = Primäre Identifikatoren
        # cells[5] = Relevante Standards
        # cells[6] = Kommentar (if exists)

        name = cells[1].strip()
        priority = cells[2].strip() if len(cells) > 2 else ""
        description = cells[3].strip() if len(cells) > 3 else ""
        identifiers = cells[4].strip() if len(cells) > 4 else ""
        standards = cells[5].strip() if len(cells) > 5 else ""
        comment = cells[6].strip() if len(cells) > 6 else ""

        # Check if this is a group header (bold text)
        if name.startswith('**') and name.endswith('**'):
            current_group = name.strip('*').strip()
            continue

        # Skip rows without a valid priority (likely headers or empty)
        if priority not in ['Muss', 'Soll', 'Kann']:
            continue

        # Clean up the name (remove any remaining formatting)
        name = name.strip('*').strip()

        # Skip empty names
        if not name:
            continue

        # Combine identifiers into comment if comment is empty
        full_comment = comment
        if identifiers and identifiers != '-':
            if full_comment:
                full_comment = f"Identifikatoren: {identifiers}; {full_comment}"
            else:
                full_comment = f"Identifikatoren: {identifiers}"

        objects.append({
            'Gruppe': current_group,
            'Konzept': name,
            'Priorität': priority,
            'Beschreibung': description,
            'Relevante Standards': standards,
            'Kommentar': full_comment
        })

    return objects


def main():
    print("=" * 70)
    print("Extracting business objects from Objektmanagement files")
    print("=" * 70)

    all_objects = []

    for filename, domain in FILES_TO_PROCESS:
        filepath = DOCS_DIR / filename
        if not filepath.exists():
            print(f"Warning: {filename} not found, skipping")
            continue

        print(f"\nProcessing: {filename}")
        print(f"  Domain: {domain}")

        content = filepath.read_text(encoding='utf-8')
        objects = extract_table_from_markdown(content)

        # Add domain to each object
        for obj in objects:
            obj['Domäne'] = domain

        print(f"  Found {len(objects)} business objects")
        all_objects.extend(objects)

    print(f"\n{'=' * 70}")
    print(f"Total extracted: {len(all_objects)} business objects")

    # Load existing Excel
    print(f"\nLoading existing Excel: {EXCEL_FILE}")
    df_existing = pd.read_excel(EXCEL_FILE)
    print(f"  Existing rows: {len(df_existing)}")

    # Create DataFrame from extracted objects
    df_new = pd.DataFrame(all_objects)

    # Reorder columns to match existing Excel
    columns = ['Domäne', 'Gruppe', 'Konzept', 'Priorität', 'Beschreibung', 'Relevante Standards', 'Kommentar']
    df_new = df_new[columns]

    # Check for duplicates based on Konzept name
    existing_concepts = set(df_existing['Konzept'].str.lower().str.strip())

    duplicates = []
    unique_new = []

    for _, row in df_new.iterrows():
        concept = row['Konzept'].lower().strip()
        if concept in existing_concepts:
            duplicates.append(row['Konzept'])
        else:
            unique_new.append(row)
            existing_concepts.add(concept)  # Prevent duplicates within new data too

    print(f"\n  Duplicates found (skipped): {len(duplicates)}")
    if duplicates:
        print(f"    Examples: {duplicates[:5]}")

    print(f"  New unique concepts: {len(unique_new)}")

    if unique_new:
        # Append new rows to existing DataFrame
        df_unique_new = pd.DataFrame(unique_new)
        df_combined = pd.concat([df_existing, df_unique_new], ignore_index=True)

        # Save updated Excel
        df_combined.to_excel(EXCEL_FILE, index=False)
        print(f"\n  Updated Excel saved: {len(df_combined)} total rows")
    else:
        print("\n  No new objects to add")

    print(f"\n{'=' * 70}")
    print("Done!")
    print("=" * 70)


if __name__ == "__main__":
    main()
