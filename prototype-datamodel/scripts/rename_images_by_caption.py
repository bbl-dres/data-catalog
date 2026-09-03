"""
Rename image files based on their 'Bild:' captions in markdown files.

Pattern detected:
  ![](assets/folder/123456.png)

  Bild: Description text. [Quelle](...)

This script:
1. Finds image + caption pairs in markdown
2. Creates clean filenames from the description
3. Renames the actual image files
4. Updates markdown references
"""

import re
import unicodedata
from pathlib import Path

TARGET_DIR = r"c:\Users\DavidRasner\Documents\GitHub\ea-immo"

# Track renamed files to avoid duplicates
renamed_files = {}


def clean_filename(description, original_ext, folder):
    """Create a clean filename from the description"""
    # Remove source links like [Quelle](...)
    description = re.sub(r'\[.*?\]\(.*?\)', '', description)

    # Remove trailing punctuation and whitespace
    description = description.rstrip('. \t')

    # Take only the first part if there's a period (sentence end)
    if '. ' in description:
        description = description.split('. ')[0]

    # Normalize unicode characters (ü -> u, etc for filename)
    # But keep umlauts readable by replacing them explicitly
    description = description.replace('ü', 'ue').replace('ö', 'oe').replace('ä', 'ae')
    description = description.replace('Ü', 'Ue').replace('Ö', 'Oe').replace('Ä', 'Ae')
    description = description.replace('ß', 'ss')

    # Replace spaces and special characters
    clean = re.sub(r'[^\w\s-]', '', description)
    clean = re.sub(r'[\s]+', '_', clean.strip())
    clean = clean.lower()

    # Truncate if too long
    if len(clean) > 60:
        clean = clean[:60].rsplit('_', 1)[0]

    # Create unique filename if needed
    base_name = clean
    counter = 1
    full_key = f"{folder}/{clean}{original_ext}"

    while full_key in renamed_files:
        clean = f"{base_name}_{counter:02d}"
        full_key = f"{folder}/{clean}{original_ext}"
        counter += 1

    renamed_files[full_key] = True

    return f"{clean}{original_ext}"


def process_markdown(filepath, dry_run=True):
    """Process a markdown file and rename images based on captions"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    target_path = Path(TARGET_DIR)
    changes = []

    # Pattern: image followed by blank line and "Bild:" caption
    # Match: ![...](path) followed by newlines and "Bild: description"
    pattern = r'(!\[.*?\]\((assets/[^)]+)\))(\s*\n\s*\n\s*)(Bild:\s*([^\n]+))'

    def replace_image(match):
        full_img_tag = match.group(1)
        img_path = match.group(2)
        whitespace = match.group(3)
        bild_line = match.group(4)
        description = match.group(5).strip()

        # Skip external URLs
        if img_path.startswith('http'):
            return match.group(0)

        # Get the original file info
        # URL-decode the path
        import urllib.parse
        decoded_path = urllib.parse.unquote(img_path)

        original_file = target_path / decoded_path

        if not original_file.exists():
            print(f"    Skipping (file not found): {decoded_path}")
            return match.group(0)

        # Get folder and extension
        folder = original_file.parent.name
        original_ext = original_file.suffix

        # Create new filename
        new_filename = clean_filename(description, original_ext, folder)
        new_path = original_file.parent / new_filename

        # Skip if already has a descriptive name (not just numbers)
        if not re.match(r'^\d+\.\w+$', original_file.name):
            print(f"    Skipping (already named): {original_file.name}")
            return match.group(0)

        # Create the new asset path for markdown
        new_asset_path = f"assets/{folder}/{new_filename}"
        # URL-encode for markdown
        new_asset_path_encoded = new_asset_path.replace(' ', '%20')

        changes.append({
            'old_file': original_file,
            'new_file': new_path,
            'old_path': img_path,
            'new_path': new_asset_path_encoded,
            'description': description[:50]
        })

        if not dry_run:
            # Rename the file
            if not new_path.exists():
                original_file.rename(new_path)

        # Return updated markdown
        new_img_tag = f'![]({new_asset_path_encoded})'
        return new_img_tag + whitespace + bild_line

    new_content = re.sub(pattern, replace_image, content)

    if changes:
        print(f"\n  {filepath.name}:")
        for change in changes:
            print(f"    {change['old_file'].name} -> {change['new_file'].name}")
            print(f"      Caption: {change['description']}...")

    if not dry_run and new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

    return len(changes)


def main(dry_run=True):
    print("=" * 70)
    if dry_run:
        print("DRY RUN - Showing what would be renamed")
    else:
        print("Renaming images based on Bild: captions")
    print("=" * 70)

    target_path = Path(TARGET_DIR)
    total_changes = 0

    for md_file in target_path.glob("*.md"):
        changes = process_markdown(md_file, dry_run=dry_run)
        total_changes += changes

    print(f"\n{'Would rename' if dry_run else 'Renamed'}: {total_changes} images")
    print("=" * 70)

    if dry_run and total_changes > 0:
        print("\nRun with --execute to perform the actual rename")


if __name__ == "__main__":
    import sys
    dry_run = "--execute" not in sys.argv
    main(dry_run=dry_run)
