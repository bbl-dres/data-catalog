"""Extract Gebäudeeingang evidence from the supplied GWR MHTML (requires lxml)."""
import argparse
import hashlib
import json
from email import policy
from email.parser import BytesParser
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = 'a731e2c6756c4eb7b255598add4339c96f0600b0a338625d3b018aa9f4111bc4'
URL = 'https://www.housing-stat.ch/catalog/de/5.0/revised'
CODES = ['EDID', 'EGAID', 'DEINR', 'DKODE', 'DKODN', 'DOFFADR', 'DPLZ4', 'DPLZZ', 'DPLZNAME']


def clean(value):
    return ' '.join(value.replace('\u00ad', '').replace('\u200b', '').split())


def text(node):
    return clean(' '.join(node.itertext()))


def extract(source):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_HASH:
        raise ValueError('Source changed; review the extraction before importing')
    message = BytesParser(policy=policy.default).parsebytes(raw)
    part = next(p for p in message.walk() if p.get_content_type() == 'text/html')
    document = html.fromstring(part.get_payload(decode=True))
    paragraphs = []
    for node in document.get_element_by_id('beschreibung-der-entitaet-gebaeudeeingang').itersiblings():
        if node.tag in ('h2', 'h3'):
            break
        if node.tag == 'p':
            paragraphs.append(text(node))
    definitions = [p for p in paragraphs if p.startswith('Gebäudeeingang: Zugang von aussen')]
    assert len(definitions) == 1

    def field(code):
        title = document.get_element_by_id(code)
        heading = title.getparent()
        assert heading.tag == 'h3'
        table = heading.getnext()
        assert table.tag == 'table'
        rows = table.xpath('./tbody/tr|./tr')
        metadata = {}
        for row in rows[1:]:
            cells = row.xpath('./th|./td')
            if len(cells) != 2:
                continue
            for repeated in cells[1].xpath('./strong|./div[contains(concat(" ", normalize-space(@class), " "), " d-none ")]'):
                repeated.drop_tree()
            metadata[text(cells[0])] = text(cells[1])
        return {'code': code, 'label': clean(' '.join(title.xpath('./text()'))),
                'description': text(rows[0]), 'metadata': metadata,
                'source_url': URL + '#' + code}

    headings = []
    for node in document.get_element_by_id('section22').itersiblings():
        if node.tag == 'h2':
            break
        if node.tag == 'h3':
            headings.append(node.xpath('./div[@id]')[0].get('id'))
    assert headings == CODES, f'Unexpected entrance feature section: {headings}'
    result = {'source_file': source.name, 'source_sha256': SOURCE_HASH, 'source_version': '5.0.0 (revised)',
              'definition': definitions[0], 'entity_paragraphs': paragraphs,
              'definition_url': URL + '#beschreibung-der-entitaet-gebaeudeeingang',
              'fields_url': URL + '#section22', 'fields': [field(code) for code in CODES],
              'building_reference': field('EGID')}
    # Check the new extraction against the frozen, independently imported source fields.
    old = next(t for t in json.loads((ROOT / 'data/tables.json').read_text(encoding='utf-8'))
               if t['identifier'] == 't-gwr-gebaeudeeingang')
    for row, previous in zip(result['fields'], old['fields'], strict=True):
        assert row['code'] == previous['technicalName']
        assert row['label'] == previous['labels']['de']
        assert row['metadata'] == previous['catalogMetadata'], row['code']
    assert '\ufffd' not in json.dumps(result, ensure_ascii=False)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/sources/gwr/2026-09-15-entrance-source.json')
    args = parser.parse_args()
    result = extract(args.source)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Extracted {len(result["fields"])} entrance features and EGID; source and original import match.')
