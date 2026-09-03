"""
Extract and recreate Confluence hierarchy from export
Focuses on: Studie - Fachliche Sicht IMMO (Arbeitsdokument)
"""

import os
import re
import shutil
from pathlib import Path
from bs4 import BeautifulSoup

SOURCE_DIR = r"D:\Confluence-space-export-184927-34.html\IMMO"
OUTPUT_DIR = r"c:\Users\DavidRasner\Documents\GitHub\ea-immo\Studie - Fachliche Sicht IMMO"
ASSETS_DIR = r"c:\Users\DavidRasner\Documents\GitHub\ea-immo\assets"


def parse_li(li_element):
    """Parse a single <li> element and return item with children"""
    link = li_element.find('a', recursive=False)
    if not link:
        return None

    item = {
        'title': link.get_text(strip=True),
        'href': link.get('href', ''),
        'children': []
    }

    # Confluence exports multiple <ul> as siblings, each containing one child
    # So we need to collect all <ul> children
    for ul in li_element.find_all('ul', recursive=False):
        for child_li in ul.find_all('li', recursive=False):
            child_item = parse_li(child_li)
            if child_item:
                item['children'].append(child_item)

    return item


def sanitize_filename(name):
    """Remove or replace characters that are invalid in Windows filenames"""
    # Remove emojis and special characters
    name = re.sub(r'[\U0001F300-\U0001F9FF]', '', name)  # Remove emojis
    name = re.sub(r'[🟢🟡🔘⚪⚫]', '', name)
    # Replace invalid characters
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, '_')
    # Remove leading/trailing spaces and dots
    name = name.strip('. ')
    # Replace multiple spaces
    name = re.sub(r'\s+', ' ', name)
    # Limit length
    if len(name) > 100:
        name = name[:100]
    return name


def create_folder_structure(items, parent_path, source_dir, indent=0):
    """Recursively create folders and copy files"""
    for item in items:
        title = sanitize_filename(item['title'])
        href = item['href']
        children = item.get('children', [])

        prefix = "  " * indent

        if children:
            # Create folder for items with children
            folder_path = parent_path / title
            folder_path.mkdir(parents=True, exist_ok=True)

            # Copy the HTML file into the folder
            source_file = Path(source_dir) / href
            if source_file.exists():
                dest_file = folder_path / f"_index.html"
                shutil.copy2(source_file, dest_file)
                print(f"{prefix}[DIR] {title}/")

            # Process children
            create_folder_structure(children, folder_path, source_dir, indent + 1)
        else:
            # Leaf node - just copy the file
            source_file = Path(source_dir) / href
            if source_file.exists():
                dest_file = parent_path / f"{title}.html"
                shutil.copy2(source_file, dest_file)
                print(f"{prefix}[FILE] {title}.html")


def print_hierarchy(items, indent=0):
    """Print the hierarchy for verification"""
    for item in items:
        prefix = "  " * indent
        children_count = len(item.get('children', []))
        # Remove all non-ASCII characters for safe printing
        title_clean = item['title'].encode('ascii', 'ignore').decode('ascii')
        if children_count > 0:
            print(f"{prefix}[{children_count}] {title_clean}")
        else:
            print(f"{prefix}    {title_clean}")
        if item.get('children'):
            print_hierarchy(item['children'], indent + 1)


def count_items(items):
    """Count total items in hierarchy"""
    count = len(items)
    for item in items:
        if item.get('children'):
            count += count_items(item['children'])
    return count


def copy_assets(source_dir, assets_dir):
    """Copy images and attachments folders to assets"""
    source_path = Path(source_dir)
    assets_path = Path(assets_dir)

    # Copy images folder
    images_src = source_path / "images"
    if images_src.exists():
        images_dest = assets_path / "images"
        if images_dest.exists():
            shutil.rmtree(images_dest)
        shutil.copytree(images_src, images_dest)
        print(f"Copied images folder to {images_dest}")

    # Copy attachments folder
    attachments_src = source_path / "attachments"
    if attachments_src.exists():
        attachments_dest = assets_path / "attachments"
        if attachments_dest.exists():
            shutil.rmtree(attachments_dest)
        shutil.copytree(attachments_src, attachments_dest)
        print(f"Copied attachments folder to {attachments_dest}")

    # Copy styles folder
    styles_src = source_path / "styles"
    if styles_src.exists():
        styles_dest = assets_path / "styles"
        if styles_dest.exists():
            shutil.rmtree(styles_dest)
        shutil.copytree(styles_src, styles_dest)
        print(f"Copied styles folder to {styles_dest}")


def main():
    # Read the index.html
    index_path = Path(SOURCE_DIR) / "index.html"
    with open(index_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Parse with BeautifulSoup
    soup = BeautifulSoup(html_content, 'html.parser')

    # Find our specific link and its parent li
    target_link = soup.find('a', href="229017406.html")
    if not target_link:
        print("Could not find target link!")
        return

    parent_li = target_link.find_parent('li')
    if not parent_li:
        print("Could not find parent li!")
        return

    # Parse the target section
    target = parse_li(parent_li)

    if not target:
        print("Could not parse target section!")
        return

    print("=" * 70)
    print("Extracted Hierarchy for: Studie - Fachliche Sicht IMMO (Arbeitsdokument)")
    print("=" * 70)
    print_hierarchy([target])

    total_count = count_items([target])
    print(f"\nTotal items: {total_count}")

    print("\n" + "=" * 70)
    print("Creating folder structure...")
    print("=" * 70)

    # Create output directory
    output_path = Path(OUTPUT_DIR)
    if output_path.exists():
        shutil.rmtree(output_path)
    output_path.mkdir(parents=True, exist_ok=True)

    # Create the folder structure
    create_folder_structure([target], output_path, SOURCE_DIR)

    print("\n" + "=" * 70)
    print("Copying assets (images, attachments, styles)...")
    print("=" * 70)

    # Create assets directory
    assets_path = Path(ASSETS_DIR)
    assets_path.mkdir(parents=True, exist_ok=True)

    # Copy assets
    copy_assets(SOURCE_DIR, ASSETS_DIR)

    print("\n" + "=" * 70)
    print(f"Done!")
    print(f"  Hierarchy: {OUTPUT_DIR}")
    print(f"  Assets:    {ASSETS_DIR}")
    print("=" * 70)


if __name__ == "__main__":
    main()
