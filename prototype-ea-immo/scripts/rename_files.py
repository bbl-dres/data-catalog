"""
Remove 'Detailstudie - ' prefix from file and folder names
"""

import os
from pathlib import Path

TARGET_DIR = r"c:\Users\DavidRasner\Documents\GitHub\ea-immo\Studie - Fachliche Sicht IMMO"
PREFIX = "Detailstudie - "


def rename_items(directory):
    """Recursively rename files and folders, processing deepest first"""
    path = Path(directory)

    # First, process all subdirectories (depth-first)
    for item in sorted(path.iterdir(), key=lambda x: -len(str(x))):
        if item.is_dir():
            # Recursively process subdirectory first
            rename_items(item)

            # Then rename the directory if needed
            if item.name.startswith(PREFIX):
                new_name = item.name[len(PREFIX):]
                new_path = item.parent / new_name
                print(f"[DIR]  {item.name}")
                print(f"    -> {new_name}")
                item.rename(new_path)

    # Then process files in this directory
    for item in path.iterdir():
        if item.is_file() and item.name.startswith(PREFIX):
            new_name = item.name[len(PREFIX):]
            new_path = item.parent / new_name
            print(f"[FILE] {item.name}")
            print(f"    -> {new_name}")
            item.rename(new_path)


def main():
    print("=" * 60)
    print("Removing 'Detailstudie - ' prefix from names...")
    print("=" * 60)

    rename_items(TARGET_DIR)

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
