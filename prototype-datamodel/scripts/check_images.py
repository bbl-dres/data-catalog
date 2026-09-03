"""
Check for broken image links in markdown files
"""

import re
import urllib.parse
from pathlib import Path

TARGET_DIR = r"c:\Users\DavidRasner\Documents\GitHub\ea-immo"


def check_images():
    target_path = Path(TARGET_DIR)
    broken = []
    working = []

    for md_file in target_path.glob("*.md"):
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find all image references
        images = re.findall(r'!\[.*?\]\(([^)]+)\)', content)

        for img in images:
            # Skip external URLs
            if img.startswith('http'):
                continue

            # URL-decode the path for checking
            decoded_img = urllib.parse.unquote(img)

            # Check if file exists
            img_path = target_path / decoded_img
            if not img_path.exists():
                broken.append((md_file.name, img))
            else:
                working.append((md_file.name, img))

    print("=" * 70)
    print(f"Working images: {len(working)}")
    print(f"Broken images: {len(broken)}")
    print("=" * 70)

    if broken:
        print("\nBROKEN IMAGES:")
        for md_file, img in broken:
            print(f"  {md_file}: {img}")

        # Group by missing folder
        missing_folders = {}
        for md_file, img in broken:
            folder = img.split('/')[1] if '/' in img else img
            if folder not in missing_folders:
                missing_folders[folder] = []
            missing_folders[folder].append((md_file, img))

        print("\n" + "=" * 70)
        print("Missing by folder:")
        for folder, items in missing_folders.items():
            print(f"  {folder}: {len(items)} images")


if __name__ == "__main__":
    check_images()
