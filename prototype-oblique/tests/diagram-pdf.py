"""Validate actual vector output against source rows and every preview text run."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
import fitz

root = Path(tempfile.gettempdir()) / 'oblique-diagram-export'
normalize = lambda value: re.sub(r'\s+', '', value)
for name in sys.argv[1:] or ['gwr-grid', 'gwr-list', 'gwr-fr', 'gis-building', 'objects-overview', 'filtered-tables', 'reference-codes', 'api-endpoints', 'review-products']:
    expected = json.loads((root / (name + '.json')).read_text(encoding='utf-8'))
    manifest = expected['manifest']
    digest = hashlib.sha256(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()
    with fitz.open(root / (name + '.pdf')) as document:
        assert len(document) == len(expected['texts'])
        assert f'snapshot-sha256={digest}' in document.metadata['keywords']
        for page, texts in zip(document, expected['texts']):
            assert abs(page.rect.width - expected['width']) < .02
            assert abs(page.rect.height - expected['height']) < .02
            assert not page.get_images(), 'Branding and content must remain vector graphics'
            assert page.get_fonts() and all(font[1] == 'ttf' and font[2] == 'Type0' for font in page.get_fonts())
            actual = normalize(page.get_text())
            for value in texts:
                assert normalize(value) in actual, (name, page.number, value)
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    for span in line['spans']:
                        bounds = fitz.Rect(span['bbox'])
                        assert bounds.x0 >= 30 and bounds.x1 <= page.rect.width - 30, (name, span)
                        assert bounds.y0 >= 25 and bounds.y1 <= page.rect.height - 20, (name, span)
        content = normalize(' '.join(page.get_text() for page in document))
        settings, snapshot = manifest['settings'], manifest['snapshot']
        parent_fields = [f['id'] for f in snapshot['entityFields'] if f['required'] or f['id'] in settings['entityColumns']]
        row_fields = [f['id'] for f in snapshot['rowFields'] if f['required'] or f['id'] in settings['columns']]
        for entity in snapshot['entities']:
            for field in parent_fields:
                assert normalize(entity['display'][field]) in content, (name, entity['id'], field)
            for row in ([] if settings['layout'] == 'tiles' or settings['layout'] == 'list' and settings.get('listRows') is False else entity['rows']):
                for field in row_fields:
                    assert normalize(row['display'].get(field, '—')) in content, (name, row['id'], field)
        document[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(root / (name + '.pdf.png'))
        if len(document) > 1:
            document[1].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(root / (name + '-page2.pdf.png'))
        print(f'PASS: {name}: {len(document)} pages; source content, preview text, vector output, fonts, bounds and manifest hash')
