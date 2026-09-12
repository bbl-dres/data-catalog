"""Validate captured SQL/API responses against the OpenAPI 3.1 JSON Schemas."""
import json
import pathlib
import sys
import tempfile

from jsonschema import Draft202012Validator, FormatChecker

source = sys.argv[1] if len(sys.argv) > 1 else 'local'
if source not in ('local', 'live'):
    raise SystemExit('Usage: python api-schema.py [local|live]')
evidence = json.loads((pathlib.Path(tempfile.gettempdir()) / 'oblique-api-review' / f'{source}.json').read_text(encoding='utf-8'))
components = evidence['spec']['components']
for model in components['schemas'].values():
    Draft202012Validator.check_schema(model)
snapshot_schema = {'$ref': '#/components/schemas/CatalogSnapshot', 'components': components}
Draft202012Validator(snapshot_schema, format_checker=FormatChecker()).validate(evidence['snapshot'])
count = 0
for name, rows in evidence['tables'].items():
    schema = {'type': 'array', 'items': {'$ref': f'#/components/schemas/{name}'}, 'components': components}
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(rows)
    count += len(rows)
print(f'PASS: {evidence["source"]}: complete snapshot and {count} table records match the generated schemas, including formats and nullability.')
