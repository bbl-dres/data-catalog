"""Read the supplied MMB workbook without modifying it; retain source row identity."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import openpyxl


def extract(path):
    workbook = openpyxl.load_workbook(path, read_only=False, data_only=False)
    try:
        sheet = workbook['AttributeApplicationClass']
        headers = [cell.value for cell in sheet[1]]
        assert len(headers) == len(set(headers))
        fields = []
        retained = ['UUID', 'Name', 'Besitzer', 'ID', 'ID (Quellsystem)', 'Typ',
                    'ist fachlicher Schlüssel', 'Pflichtfeld', 'Untergrenze', 'Obergrenze',
                    'Beschreibung (ROOT PROFILE)', 'Beschreibung (MMB_MetaModel)']
        for cells in sheet.iter_rows(min_row=2):
            if all(cell.value is None for cell in cells):
                continue
            assert all(cell.data_type != 'f' for cell in cells), 'Review formulas before importing'
            row = dict(zip(headers, [cell.value for cell in cells]))
            assert row['Stereotyp'] == 'AttributeApplicationClass'
            assert row['Besitzer'].endswith('::SAP RE-FX::Gebäude_NS')
            assert row['Name'] and row['UUID']
            fields.append({'row': cells[0].row, 'hidden': bool(sheet.row_dimensions[cells[0].row].hidden),
                           'source': {key: row[key] for key in retained}})
        assert len(fields) == 150
        assert len({f['source']['UUID'] for f in fields}) == len(fields)
        return {'source_file': str(path), 'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                'sheet': sheet.title, 'range': sheet.calculate_dimension(), 'headers': headers,
                'notes': ['No ALIAS column exists in this export.',
                          'Workbook remains unchanged. Relevant source cells are preserved verbatim; personnel and diagram metadata are not copied into catalog records.',
                          'Assoziationrolle contains nine association records, not field rows, and is outside this field import.'],
                'fields': fields}
    finally:
        workbook.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    data = extract(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'rows': len(data['fields']), 'source_sha256': data['source_sha256'],
                      'hidden_rows': sum(f['hidden'] for f in data['fields']),
                      'duplicate_names': {name: n for name, n in collections.Counter(f['source']['Name'] for f in data['fields']).items() if n > 1}}))
