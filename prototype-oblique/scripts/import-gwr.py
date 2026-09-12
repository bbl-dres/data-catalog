"""Import the user-supplied GWR 5.0 MHTML and 3.7/4.2 code workbook.

Usage: python scripts/import-gwr.py --catalog <file.mhtml> --codes <file.xlsx>
Development dependencies: beautifulsoup4, openpyxl. No application dependency.
Only records owned by this import (plus two existing GWR reference IDs) are upserted.
"""
import argparse
from collections import Counter, defaultdict
from email import policy
from email.parser import BytesParser
from email.utils import parsedate_to_datetime
import hashlib
import json
from pathlib import Path
import re

from bs4 import BeautifulSoup
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.housing-stat.ch/catalog/de/5.0/revised'
IMPORT_ID = 'gwr-catalog-5.0'
# Catalog entities are logical tables; these technical names are local aliases.
ENTITIES = [
    ('section18', 'bauprojekt', 'Bauprojekt', 'projekt', 'bauprojekt', 37),
    ('section19', 'arbeiten', 'Arbeiten', 'projekt', 'bauarbeiten', 10),
    ('section20', 'gebaeude', 'Gebäude', 'bau', 'gebaeude', 39),
    ('section21', 'waermeerzeugungsanlage', 'Wärmeerzeugungsanlage', 'energie', None, 17),
    ('section22', 'gebaeudeeingang', 'Gebäudeeingang', 'bau', None, 9),
    ('section23', 'wohnung', 'Wohnung', 'miete', 'wohnung', 24),
    ('section24', 'strasse', 'Strasse', 'bau', None, 10),
]
EXISTING_REFS = {'GKAT': 'r-gwr-kat', 'GSTAT': 'r-gwr-status'}
DEFINITIONS = {
    'bauprojekt': ('bauprojekt', ['Ein Bauprojekt ist']),
    'arbeiten': ('arbeiten', ['Die Art der Arbeiten (Neubau, Umbau oder Abbruch)']),
    'gebaeude': ('gebaeude', ['Ein Gebäude ist']),
    'waermeerzeugungsanlage': ('waermeerzeugungsanlage', ['Konkret werden die Merkmale jeder Wärmeerzeugungsanlage', 'Obwohl sie nicht als eigentliche Wärmeerzeugungsanlagen']),
    'gebaeudeeingang': ('gebaeudeeingang', ['Gebäudeeingang: Zugang von aussen']),
    'wohnung': ('wohnung', ['Eine Wohnung ist eine Gesamtheit von Räumen']),
    'strasse': ('strassen', ['Als Strasse gilt ein Verkehrsweg']),
}


def clean(value):
    return ' '.join(str(value or '').replace('\u00ad', '').replace('\u200b', '').split())


def text(node):
    return clean(node.get_text(' ', strip=True)) if node else ''


def rows(table):
    body = table.find('tbody', recursive=False) or table
    return body.find_all('tr', recursive=False)


def entity_definition(soup, slug):
    suffix, starts = DEFINITIONS[slug]
    anchor = 'beschreibung-der-entitaet-' + suffix
    paragraphs = []
    for node in soup.find(id=anchor).next_siblings:
        if node.name in ['h2', 'h3']:
            break
        if node.name == 'p':
            paragraphs.append(text(node))
    selected = []
    for start in starts:
        matches = [p for p in paragraphs if p.startswith(start)]
        if len(matches) != 1:
            raise ValueError(f'{slug}: expected one definition starting with {start!r}')
        selected.append(matches[0])
    return '\n\n'.join(selected), f'{URL}#{anchor}'


def field_info(heading):
    title = heading.select_one('div[id]')
    code = title['id']
    label = clean(' '.join(str(n) for n in title.contents if isinstance(n, str)))
    table = heading.find_next_sibling('table')
    source_rows = rows(table)
    summary = text(source_rows[0])
    metadata = {}
    cells = {}
    for row in source_rows[1:]:
        pair = row.find_all(['td', 'th'], recursive=False)
        if len(pair) != 2:
            continue
        cell = BeautifulSoup(str(pair[1]), 'html.parser').td
        # Repeated feature headings are decoration, including alternate markup in 5.0.
        for repeated in cell.select(':scope > strong, :scope > div.d-none'):
            repeated.decompose()
        key = text(pair[0])
        cells[key] = cell
        metadata[key] = text(cell)
    coding = cells['Codierung']
    lines = BeautifulSoup(str(coding), 'html.parser')
    for nested in lines.select('table'):
        nested.decompose()
    for br in lines.select('br'):
        br.replace_with('\n')
    coding_lines = [clean(line) for line in lines.get_text().splitlines() if clean(line)]
    values = []
    for nested in coding.select('table'):
        for row in rows(nested):
            pair = row.find_all('td', recursive=False)
            if len(pair) >= 2 and re.fullmatch(r'\d+(?:\s*[-–]\s*\d+)?', text(pair[0])):
                value = {'code': text(pair[0]), 'label': text(pair[1])}
                if len(pair) > 2:
                    value['note'] = ' · '.join(text(c) for c in pair[2:])
                values.append(value)
    if not values and re.search(r'1\s*=\s*ja\s*,\s*0\s*=\s*nein', metadata['Codierung'], re.I):
        values = [{'code': '0', 'label': 'Nein'}, {'code': '1', 'label': 'Ja'}]
    field = {
        'technicalName': code, 'labels': {'de': label}, 'description': f'{label}: {summary}',
        'dataType': '', 'keyRole': None,
        'sourceUrl': f'{URL}#{code}',
        'catalogMetadata': metadata,
    }
    # The catalog describes logical identifiers, not a physical SQL key schema.
    return field, coding_lines[0] if coding_lines else '', values


def data_type(coding, coded):
    if 'Alphanumerisch' in coding:
        length = re.search(r'(\d+) (?:Stellen|Zeichen)', coding)
        return f'Text ({length[1]})' if length else 'Text'
    if 'reell' in coding:
        return 'Dezimal (10,3)'
    if 'Ganzzahl' in coding or coding.startswith('Numerisch'):
        length = re.search(r'(\d+) Stelle', coding)
        return ('Code' if coded else 'Ganzzahl') + (f' ({length[1]})' if length else '')
    if 'yyyy' in coding:
        return 'Jahr (yyyy)' if 'dd.mm' not in coding else 'Datum (dd.mm.yyyy)'
    if 'Binäre Datei' in coding:
        return 'Datei (PDF/JPG/DXF)'
    if 'ISO-Ländercode' in coding:
        return 'Ländercode (2)'
    if 'GEOJSon' in coding:
        return 'GeoJSON (LV95)'
    if coded:
        return 'Code'
    raise ValueError(f'Unknown coding: {coding!r}')


def workbook_rows(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    groups = defaultdict(list)
    all_rows = list(workbook['Codeliste'].values)[1:]
    for row_number, row in enumerate(all_rows, start=2):
        if row[0] is None:
            continue
        code, version, feature, de, de_short, fr, fr_short, it, it_short = row
        groups[clean(feature)].append({
            'code': str(int(code)) if isinstance(code, (int, float)) else clean(code),
            'label': clean(de), 'labels': {'de': clean(de), 'fr': clean(fr), 'it': clean(it)},
            'shortLabels': {'de': clean(de_short), 'fr': clean(fr_short), 'it': clean(it_short)},
            'sourceVersion': str(version), 'sourceRow': row_number,
        })
    workbook.close()
    return groups


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--codes', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'data')
    parser.add_argument('--report', type=Path, default=ROOT / 'docs/sources/gwr/gwr-import-report.json')
    args = parser.parse_args()
    message = BytesParser(policy=policy.default).parsebytes(args.catalog.read_bytes())
    html = next(part for part in message.walk() if part.get_content_type() == 'text/html')
    # MHTML omits the MIME charset: use the HTML's declared UTF-8, not email's ASCII fallback.
    soup = BeautifulSoup(html.get_payload(decode=True).decode('utf-8'), 'html.parser')
    if 'Version 5.0.0' not in text(soup.find(id='section12').parent):
        raise ValueError('This mapping expects catalog version 5.0.0')
    captured = parsedate_to_datetime(message['Date']).date().isoformat()
    provenance = {
        'importId': IMPORT_ID, 'catalogVersion': '5.0.0', 'variant': 'revised', 'captured': captured,
        'files': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [args.catalog, args.codes]},
    }
    base = {
        'status': 'Gültig', 'version': '5.0.0', 'created': captured, 'modified': captured,
        'responsibleOrg': 'Bundesamt für Statistik (BFS)',
        'contact': {'url': 'https://www.housing-stat.ch/de/home.html'},
        'source': 'GWR', 'synced': captured, 'provenance': provenance,
    }
    workbook = workbook_rows(args.codes)
    tables, refs, report = [], [], {'provenance': provenance, 'tables': [], 'codeLists': []}
    for section, slug, name, domain, realizes, expected in ENTITIES:
        definition, definition_url = entity_definition(soup, slug)
        table = {
            **base, 'identifier': 't-gwr-' + slug, 'name': name,
            'description': definition,
            'technicalName': 'GWR_' + slug.upper(), 'system': 'gwr', 'domain': domain,
            'sourceUrl': definition_url,
            'informationUrls': [definition_url],
            'fieldsSourceUrl': f'{URL}#{section}',
            'sourceDetail': f'Merkmalskatalog.mhtml · 5.0.0 (revised) · {expected} Merkmale',
            'fields': [],
        }
        if realizes:
            table['realizes'] = realizes
        headings = []
        for sibling in soup.find(id=section).next_siblings:
            if sibling.name == 'h2':
                break
            if sibling.name == 'h3':
                headings.append(sibling)
        if len(headings) != expected:
            raise ValueError(f'{name}: expected {expected} features, found {len(headings)}')
        for heading in headings:
            field, coding, values = field_info(heading)
            code = field['technicalName']
            candidates = [r for r in workbook.get(code, []) if '4.2' in r['sourceVersion'].split('/')]
            if len({r['code'] for r in candidates}) != len(candidates):
                raise ValueError(f'Duplicate 4.2 code in {code}')
            old = {r['code']: r for r in candidates}
            origin = 'catalog-5.0'
            # Only WSTWK has documented numeric ranges. Expand from workbook labels
            # after verifying complete coverage of the ranges stated in the 5.0 source.
            ranges = [v for v in values if '-' in v['code'] or '–' in v['code']]
            if ranges:
                expected_codes = set()
                for value in values:
                    ends = re.split(r'\s*[-–]\s*', value['code'])
                    expected_codes.update(str(i) for i in range(int(ends[0]), int(ends[-1]) + 1))
                if set(old) != expected_codes:
                    raise ValueError(f'{code}: workbook does not match catalog ranges')
                values = [dict(row) for row in candidates]
                origin = 'catalog-5.0-ranges-with-workbook-4.2-labels'
            elif values:
                for value in values:
                    other = old.get(value['code'])
                    if other and other['label'] == value['label']:
                        value.update({k: other[k] for k in ['labels', 'shortLabels', 'sourceVersion', 'sourceRow']})
            elif candidates:
                values = [dict(row) for row in candidates]
                origin = 'workbook-4.2-only'
            if values:
                if len({v['code'] for v in values}) != len(values):
                    raise ValueError(f'Duplicate imported code in {code}')
                ref_id = EXISTING_REFS.get(code, 'r-gwr-' + code.lower())
                field['codeList'] = ref_id
                ref = {
                    **base, 'identifier': ref_id, 'name': f'GWR {field["labels"]["de"]} ({code})',
                    'description': f'Werteliste für {field["labels"]["de"]} ({code}) in der GWR-Entität {name}.',
                    'normReference': 'GWR / eCH', 'domain': domain,
                    'sourceField': code, 'codeListOrigin': origin,
                    'classification': 'öffentlich', 'personalData': False, 'values': values,
                }
                if realizes:
                    ref['businessObject'] = realizes
                if origin == 'workbook-4.2-only':
                    ref.update(version='4.2', sourceDetail='gwr codes.xlsx · Blatt Codeliste · MK 4.2')
                    ref['description'] += ' Stand 4.2 aus der Excel-Datei; Übereinstimmung mit 5.0 nicht bestätigt.'
                else:
                    ref.update(sourceUrl=field['sourceUrl'], sourceDetail='Merkmalskatalog.mhtml · 5.0.0 (revised)')
                    if ranges:
                        ref['sourceDetail'] += ' · Bereichsauflösung und Bezeichnungen aus gwr codes.xlsx, MK 4.2'
                ref['informationUrls'] = [ref['sourceUrl']] if ref.get('sourceUrl') else []
                refs.append(ref)
                report['codeLists'].append({
                    'feature': code, 'id': ref_id, 'origin': origin, 'count': len(values),
                    'workbook42CodesNotImported': sorted(set(old) - {v['code'] for v in values}),
                })
            field['dataType'] = data_type(coding, bool(values))
            table['fields'].append(field)
        tables.append(table)
        report['tables'].append({'id': table['identifier'], 'name': name, 'definitionSourceUrl': definition_url, 'fields': [f['technicalName'] for f in table['fields']]})
    system = {
        **base, 'identifier': 'gwr', 'name': 'GWR',
        'description': 'Eidgenössisches Gebäude- und Wohnungsregister des BFS. Der importierte Merkmalskatalog 5.0.0 beschreibt Bauprojekte, Arbeiten, Gebäude, Wärmeerzeugungsanlagen, Gebäudeeingänge, Wohnungen und Strassen.',
        'informationUrl': URL, 'sourceDetail': 'Merkmalskatalog.mhtml · 5.0.0 (revised) · Metadatenimport',
    }
    # No engine, real data owner, physical PK/FK, access classification or personal-
    # data assessment is invented for the register or its tables.
    changes = [
        {'entity': 'systems:gwr', 'date': captured, 'action': 'Importiert', 'detail': 'GWR-Merkmalskatalog 5.0.0 aus bereitgestellter MHTML-Datei importiert.', 'user': 'Katalogimport'},
        *[{'entity': 'tables:' + t['identifier'], 'date': captured, 'action': 'Importiert', 'detail': f'{len(t["fields"])} Merkmale aus GWR-Merkmalskatalog 5.0.0 importiert.', 'user': 'Katalogimport'} for t in tables],
        *[{'entity': 'refs:' + r['identifier'], 'date': captured, 'action': 'Importiert', 'detail': f'{len(r["values"])} Werte importiert. {r["sourceDetail"]}', 'user': 'Katalogimport'} for r in refs],
    ]
    args.output.mkdir(parents=True, exist_ok=True)
    for filename, incoming in [('systems.json', [system]), ('tables.json', tables), ('codelists.json', refs), ('changelog.json', changes)]:
        path = args.output / filename
        current = json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
        if filename == 'changelog.json':
            keys = {(r['entity'], r['date'], r['action']) for r in incoming}
            merged = [r for r in current if (r['entity'], r['date'], r['action']) not in keys] + incoming
        else:
            new = {r['identifier']: r for r in incoming}
            for record in current:
                replacement = new.get(record['identifier'])
                if replacement is not None and record.get('informationUrls'):
                    replacement['informationUrls'] = list(dict.fromkeys([*replacement.get('informationUrls', []), *record['informationUrls']]))
            merged = [new.pop(r['identifier'], r) for r in current]
            merged.extend(new.values())
        path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    used = {f['technicalName'] for table in tables for f in table['fields']}
    report['workbookFeaturesOutsideCatalog'] = {k: len(v) for k, v in sorted(workbook.items()) if k not in used}
    report['workbookRowsByVersion'] = dict(Counter(r['sourceVersion'] for group in workbook.values() for r in group))
    report['totals'] = {'tables': len(tables), 'fields': sum(len(t['fields']) for t in tables), 'codeLists': len(refs), 'values': sum(len(r['values']) for r in refs)}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['totals']))


if __name__ == '__main__':
    main()
