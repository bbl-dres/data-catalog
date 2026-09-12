"""
Convert Confluence HTML exports to clean Markdown
- Extracts main content
- Converts to Markdown
- Creates attachment folder per file
- Updates image/attachment links
"""

import os
import re
import shutil
import urllib.parse
from pathlib import Path
from bs4 import BeautifulSoup
from markdownify import markdownify as md, MarkdownConverter

TARGET_DIR = r"c:\Users\DavidRasner\Documents\GitHub\ea-immo"
ASSETS_DIR = r"c:\Users\DavidRasner\Documents\GitHub\ea-immo\assets"
# Exclude these directories from processing
EXCLUDE_DIRS = {'assets', '.git', '.claude', 'pdf'}


class CustomMarkdownConverter(MarkdownConverter):
    """Custom converter with better handling of Confluence elements"""

    def convert_img(self, el, text, convert_as_inline):
        """Convert images with proper path handling"""
        src = el.get('src', '')
        alt = el.get('alt', '')

        # Clean up the src path
        if src:
            # Remove query parameters
            src = src.split('?')[0]
            # URL decode
            src = urllib.parse.unquote(src)

        if not src:
            return ''

        return f'![{alt}]({src})'

    def convert_a(self, el, text, convert_as_inline):
        """Convert links, handling internal Confluence links"""
        href = el.get('href', '')
        title = el.get('title', '')

        if not href:
            return text

        # Clean up internal links
        if href.endswith('.html'):
            # Convert to markdown link (will be .md)
            href = href.replace('.html', '.md')

        if title:
            return f'[{text}]({href} "{title}")'
        return f'[{text}]({href})'


def extract_page_id(html_content):
    """Extract the page ID from attachment references"""
    match = re.search(r'attachments/(\d+)/', html_content)
    if match:
        return match.group(1)
    return None


def extract_title(soup):
    """Extract the page title"""
    title_span = soup.find('span', id='title-text')
    if title_span:
        title = title_span.get_text(strip=True)
        # Remove the space prefix (e.g., "Immobilienmanagement BBL : ")
        if ' : ' in title:
            title = title.split(' : ', 1)[1]
        return title

    title_tag = soup.find('title')
    if title_tag:
        title = title_tag.get_text(strip=True)
        if ' : ' in title:
            title = title.split(' : ', 1)[1]
        return title

    return "Untitled"


def clean_content(soup):
    """Remove Confluence navigation and metadata, keep main content"""
    # Find main content
    main_content = soup.find('div', id='main-content')
    if not main_content:
        main_content = soup.find('div', class_='wiki-content')
    if not main_content:
        main_content = soup.find('div', id='content')

    if not main_content:
        return None

    # Remove unwanted elements
    for element in main_content.find_all(['script', 'style']):
        element.decompose()

    # Remove Confluence macros metadata
    for element in main_content.find_all('div', class_='confluence-information-macro'):
        # Keep info boxes but clean them up
        pass

    # Remove page metadata/properties sections
    for element in main_content.find_all('div', class_='page-metadata'):
        element.decompose()

    return main_content


def convert_html_to_markdown(html_path, assets_source_dir):
    """Convert a single HTML file to Markdown"""
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')

    # Extract title
    title = extract_title(soup)

    # Extract page ID for attachments
    page_id = extract_page_id(html_content)

    # Clean and extract main content
    main_content = clean_content(soup)
    if not main_content:
        print(f"  Warning: No main content found in {html_path.name}")
        return None, None, []

    # Convert to markdown
    markdown_content = md(
        str(main_content),
        heading_style="atx",
        bullets="-",
        strip=['script', 'style', 'nav', 'footer', 'header']
    )

    # Clean up markdown
    # Remove excessive newlines
    markdown_content = re.sub(r'\n{3,}', '\n\n', markdown_content)
    # Clean up image paths
    markdown_content = re.sub(r'\?api=v2', '', markdown_content)

    # Add title as H1 if not already present
    if not markdown_content.strip().startswith('#'):
        markdown_content = f"# {title}\n\n{markdown_content}"

    # Find all attachment references
    attachments = []
    if page_id:
        attachment_pattern = rf'attachments/{page_id}/([^"\s\)]+)'
        for match in re.finditer(attachment_pattern, html_content):
            attachment_file = urllib.parse.unquote(match.group(1).split('?')[0])
            if attachment_file not in attachments:
                attachments.append(attachment_file)

    return markdown_content, page_id, attachments


def process_file(html_path, assets_source_dir):
    """Process a single HTML file - convert to MD and copy attachments"""
    # Convert to markdown
    markdown_content, page_id, attachments = convert_html_to_markdown(html_path, assets_source_dir)

    if markdown_content is None:
        return False

    # Determine output paths
    md_path = html_path.with_suffix('.md')
    attachment_folder_name = html_path.stem  # Same name as the file, without extension

    # Create attachment folder if there are attachments
    if attachments and page_id:
        attachment_folder = html_path.parent / attachment_folder_name
        attachment_folder.mkdir(exist_ok=True)

        # Source attachment folder
        source_attachment_folder = Path(assets_source_dir) / 'attachments' / page_id

        # Copy attachments
        copied_count = 0
        for attachment in attachments:
            source_file = source_attachment_folder / attachment
            if source_file.exists():
                dest_file = attachment_folder / attachment
                # Create subdirectories if needed
                dest_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source_file, dest_file)
                copied_count += 1

        # Update markdown content to use local attachment paths
        if page_id:
            markdown_content = markdown_content.replace(
                f'attachments/{page_id}/',
                f'{attachment_folder_name}/'
            )

        if copied_count > 0:
            print(f"  -> Copied {copied_count} attachments to {attachment_folder_name}/")

    # Write markdown file
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(markdown_content)

    # Remove original HTML file
    html_path.unlink()

    return True


def process_directory(directory, assets_source_dir):
    """Recursively process all HTML files in directory"""
    path = Path(directory)

    for html_file in path.rglob('*.html'):
        # Skip excluded directories
        rel_path = html_file.relative_to(path)
        parts = rel_path.parts
        if any(part in EXCLUDE_DIRS for part in parts):
            continue

        print(f"Converting: {rel_path}")
        process_file(html_file, assets_source_dir)


def main():
    print("=" * 70)
    print("Converting Confluence HTML to Markdown")
    print("=" * 70)

    process_directory(TARGET_DIR, ASSETS_DIR)

    print("\n" + "=" * 70)
    print("Done!")
    print(f"Markdown files created in: {TARGET_DIR}")
    print("=" * 70)


if __name__ == "__main__":
    main()
