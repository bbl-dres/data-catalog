# Confluence Migration Scripts

Scripts for migrating Confluence HTML exports to clean Markdown.

## Prerequisites

```bash
pip install beautifulsoup4 markdownify
```

## Scripts

### 1. extract_hierarchy_v3.py
Extracts the page hierarchy from a Confluence HTML export and recreates it as a folder structure.

**Configuration:**
- `SOURCE_DIR` - Path to Confluence export folder
- `OUTPUT_DIR` - Where to create the folder structure
- `ASSETS_DIR` - Where to copy images/attachments

**Usage:**
```bash
python extract_hierarchy_v3.py
```

### 2. convert_to_markdown.py
Converts Confluence HTML files to clean Markdown, extracting main content and copying attachments.

**Configuration:**
- `TARGET_DIR` - Directory containing HTML files
- `ASSETS_DIR` - Where attachments are stored
- `EXCLUDE_DIRS` - Directories to skip

**Usage:**
```bash
python convert_to_markdown.py
```

### 3. clean_markdown.py
Cleans up converted Markdown files:
- Removes emoji status indicators (🟢🟡🔘⚪⚫)
- Removes "Detailstudie - " prefix from titles
- Removes "Arbeitsdokument" info sections
- Removes "Inhalt" table of contents
- Removes "Anhang" appendix sections

**Usage:**
```bash
python clean_markdown.py
```

### 4. rename_files.py
Removes prefixes like "Detailstudie - " from file and folder names.

**Configuration:**
- `TARGET_DIR` - Directory to process
- `PREFIX` - Prefix to remove

**Usage:**
```bash
python rename_files.py
```

### 5. fix_image_paths.py
Fixes image paths that contain parentheses by URL-encoding them for proper Markdown rendering.

**Usage:**
```bash
python fix_image_paths.py
```

### 6. check_images.py
Validates all image references in Markdown files and reports broken links.

**Usage:**
```bash
python check_images.py
```

### 7. rename_images_by_caption.py
Renames image files based on their "Bild:" captions in markdown. Converts numeric filenames (e.g., `224624812.png`) to descriptive names (e.g., `dreistufiges_metadatenmodell.png`).

**Features:**
- Finds image + caption pairs in markdown files
- Creates clean filenames from descriptions (umlauts converted, spaces to underscores)
- Renames actual image files
- Updates markdown references
- Dry-run mode by default

**Usage:**
```bash
# Preview changes (dry run)
python rename_images_by_caption.py

# Execute rename
python rename_images_by_caption.py --execute
```

## Typical Migration Workflow

1. Export Confluence space as HTML
2. Run `extract_hierarchy_v3.py` to create folder structure
3. Run `convert_to_markdown.py` to convert HTML to Markdown
4. Run `rename_files.py` to clean up file names
5. Run `clean_markdown.py` to clean up content
6. Run `fix_image_paths.py` to fix paths with parentheses
7. Run `rename_images_by_caption.py --execute` to give images descriptive names
8. Run `check_images.py` to verify all images work
