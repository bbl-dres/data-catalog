"""Extract the reviewed RE-FX API inventory from the user's saved MHTML (requires lxml)."""
import argparse
import hashlib
import json
import uuid
from email import policy
from email.parser import BytesParser
from pathlib import Path
from lxml import html

SOURCE_HASH = '4d3a9f871da5339dfb518f9fb9c0ffb9de44d9dfebd61c4cb75f1d4884795358'
SOURCE_URL = 'https://confluence.bit.admin.ch/pages/viewpage.action?pageId=1105159761'
ROOT = Path(__file__).resolve().parent.parent


def extract(source):
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SOURCE_HASH, 'Source changed; review before importing'
    message = BytesParser(policy=policy.default).parsebytes(raw)
    part = next(p for p in message.walk() if p.get_content_type() == 'text/html')
    # MIME omits charset. Pass bytes so lxml uses the saved HTML's UTF-8 declaration.
    document = html.fromstring(part.get_payload(decode=True))
    assert '\ufffd' not in document.text_content(), 'Invalid source decoding'
    clean = lambda value: ' '.join(value.split())
    tables = []
    for table in document.xpath('//table'):
        heading = table.xpath('preceding::*[self::h1 or self::h2 or self::h3 or self::h4 or self::h5 or self::h6][1]')[0]
        tables.append({'heading': clean(heading.text_content()), 'anchor': heading.get('id'),
                       'rows': [[clean(c.text_content()) for c in row.xpath('./th|./td')]
                                for row in table.xpath('./thead/tr|./tbody/tr|./tr')]})
    groups = [t for t in tables if t['heading'].startswith('Attribute ')]
    assert len(groups) == 25 and sum(len(t['rows']) - 1 for t in groups) == 384
    group_names = [t['heading'].removeprefix('Attribute ') for t in groups]
    order = ['BUILDING', 'OBJECT_ADDRESS'] + [g for g in group_names if g not in ('BUILDING', 'OBJECT_ADDRESS')]
    fields, excluded, seen = [], [], set()
    for table in groups:
        group = table['heading'].removeprefix('Attribute ')
        field_index = 0
        for source_row, values in enumerate(table['rows'][1:], 1):
            assert len(values) == 4
            technical, label, source_type, length = values
            evidence = {'group': group, 'row': source_row, 'technical_name': technical,
                        'description': label, 'type': source_type, 'length': length, 'anchor': table['anchor']}
            if technical == '.INCLUDE':
                excluded.append({**evidence, 'reason': 'SAP include marker; not an ordinary API field'})
                continue
            assert technical and (group, technical) not in seen
            seen.add((group, technical))
            field_index += 1
            disputed_type = group in ('BUILDING', 'PROP_TAX')
            disputed_label = group == 'PROP_TAX' and technical not in ('OBJECT_TYPE', 'OBJECT_ID')
            notes = []
            if disputed_label and label:
                notes.append(f'Quellbeschreibung widersprüchlich: „{label}“.')
            if disputed_type and source_type:
                notes.append(f'Typ/Länge unbestätigt (Dokumentation: {source_type}, Länge {length or "unbekannt"}).')
            declared_type = f'{source_type}({length})' if length else source_type
            path = group + '.' + technical
            patch = {'name_de': technical if disputed_label or not label else label,
                     'technical_name': technical, 'technical_name_kind': 'apiField',
                     'property_group': group, 'source_path': path,
                     'source_data_type': declared_type if source_type and not disputed_type else None,
                     'data_type_scope': 'serviceSchema' if source_type and not disputed_type else None,
                     'sort_order': (order.index(group) + 1) * 1000 + field_index * 10,
                     'status': 'draft', 'is_required': None, 'is_nullable': None,
                     'comment': ' '.join(notes) or None,
                     'documentation_links': [{'url': SOURCE_URL + '#' + table['anchor'], 'purpose': 'documentation'}]}
            fields.append({'id': str(uuid.uuid5(uuid.NAMESPACE_URL, SOURCE_URL + '#catalog-field:' + path)),
                           'patch': patch, 'source': evidence})
    inputs = next(t for t in tables if t['heading'] == 'Eingabeparameter')
    assert inputs['rows'][1:] == [['BUILDING_ID', 'String', 'Ja', 'Gebäude-Identifikator']]
    input_path = 'ZAPI_X4AI_BAPI_RE_BU_GET_DET.BUILDING_ID'
    fields.append({'id': str(uuid.uuid5(uuid.NAMESPACE_URL, SOURCE_URL + '#catalog-field:request.' + input_path)),
                   'patch': {'name_de': 'Gebäude-Identifikator', 'technical_name': 'BUILDING_ID',
                             'technical_name_kind': 'apiField', 'property_group': 'Eingabeparameter',
                             'source_path': input_path, 'source_data_type': 'String', 'data_type_scope': 'serviceSchema',
                             'sort_order': 26010, 'status': 'draft', 'is_required': True, 'is_nullable': None,
                             'comment': 'Eingabeparameter gemäss Parameterliste und SOAP-Request-Beispiel; nicht aus den Service-Strukturen abgeleitet.',
                             'documentation_links': [{'url': SOURCE_URL + '#' + inputs['anchor'], 'purpose': 'documentation'}]},
                   'source': {'heading': inputs['heading'], 'anchor': inputs['anchor'], 'row': inputs['rows'][1]}})
    fields.sort(key=lambda item: item['patch']['sort_order'])
    assert len(fields) == 378 and len(excluded) == 7
    return {'source_file': source.name, 'source_sha256': SOURCE_HASH, 'source_url': SOURCE_URL,
            'api_identifier': 'api-sap-building', 'api_technical_name': 'ZAPI_X4AI_BAPI_RE_BU_GET_DET',
            'reviewed_on': '2026-09-14', 'groups': order + ['Eingabeparameter'],
            'decisions': [
                '377 service-structure fields and one separately documented input parameter.',
                'BUILDING and PROP_TAX type/length declarations are inconsistent; retain raw evidence and notes, leave source_data_type unset.',
                'PROP_TAX descriptions after OBJECT_TYPE/OBJECT_ID are mismatched or absent; use technical names as labels.',
                'Source paths identify documented group/field positions; they are not verified WSDL or full SOAP instance paths.',
                'Illustrative response-only names BUILDING_ID, DESCRIPTION, STATUS, POSTAL_CODE and CITY inside BUILDING conflict with the detailed inventory and are not additional confirmed structure fields.',
                'No inferred table-field relations, code-list assignments, key roles, nullability or undisclosed required flags.',
            ], 'excluded_markers': excluded, 'fields': fields}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/sources/sap-refx/2026-09-14-building-api-fields.json')
    args = parser.parse_args()
    inventory = extract(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(inventory["fields"])} fields, {len(inventory["groups"])} groups, {len(inventory["excluded_markers"])} include markers excluded: {args.output}')
