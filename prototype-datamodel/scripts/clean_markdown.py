"""
Clean up markdown files:
1. Remove emoji dots from titles (🟢🟡🔘⚪⚫)
2. Remove "Arbeitsdokument" info and "Inhalt" sections from start
3. Remove "Anhang" table from end
"""

import re
from pathlib import Path

TARGET_DIR = r"c:\Users\DavidRasner\Documents\GitHub\ea-immo"


def clean_markdown(content):
    """Clean up markdown content"""

    # 1. Remove emoji dots from everywhere
    content = re.sub(r'[🟢🟡🔘⚪⚫]', '', content)

    # 1b. Remove "Detailstudie - " prefix from title
    content = re.sub(r'^# Detailstudie - ', '# ', content)

    # 2. Remove "Arbeitsdokument" section at the start
    content = re.sub(
        r'\*\*Arbeitsdokument\*\*\s*\n([-\*].*\n)*',
        '',
        content
    )

    # Remove Inhalt/TOC section - various patterns
    content = re.sub(
        r'\*\*Inhalt:?\*\*\s*\n([-\*\s]*\[.*?\]\(#.*?\)\s*\n)*',
        '',
        content
    )

    # Remove any remaining TOC-like lists (indented bullet points with anchor links)
    # These are lines like "  - [5.1. Something](#anchor)"
    content = re.sub(
        r'^[\s]*[-\*]\s*\[\d+\..*?\]\(#.*?\)\s*$\n?',
        '',
        content,
        flags=re.MULTILINE
    )

    # Remove standalone horizontal rules at the start (after title)
    content = re.sub(r'^(#.*\n)\n*---\n', r'\1\n', content)

    # 3. Remove "Anhang" section at the end
    # This is typically: # Anhang or ## Anhang followed by a table
    # Find and remove from "# Anhang" or "## Anhang" to end, or to next major section

    # Pattern to match Anhang section with table
    content = re.sub(
        r'\n#{1,2}\s*\d*\.?\s*Anhang\s*\n.*',
        '',
        content,
        flags=re.DOTALL
    )

    # Also try pattern: "# 6. Verweise und Anhang" or similar
    content = re.sub(
        r'\n#{1,2}\s*\d*\.?\s*Verweise und Anhang\s*\n.*',
        '',
        content,
        flags=re.DOTALL
    )

    # Clean up multiple consecutive blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)

    # Clean up trailing whitespace
    content = content.strip() + '\n'

    return content


def process_file(filepath):
    """Process a single markdown file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_len = len(content)
    cleaned = clean_markdown(content)
    new_len = len(cleaned)

    if original_len != new_len:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(cleaned)
        reduction = original_len - new_len
        print(f"  Cleaned: {filepath.name} (-{reduction} chars)")
        return True
    else:
        print(f"  No changes: {filepath.name}")
        return False


def main():
    print("=" * 70)
    print("Cleaning markdown files")
    print("=" * 70)

    target_path = Path(TARGET_DIR)
    cleaned_count = 0

    for md_file in target_path.glob("*.md"):
        if md_file.name == "README.md":
            continue
        if process_file(md_file):
            cleaned_count += 1

    print(f"\nCleaned {cleaned_count} files")
    print("=" * 70)


if __name__ == "__main__":
    main()
