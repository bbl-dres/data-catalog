"""Capture bounded public AV service checks; do not store parcel records."""
from datetime import date
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1] / 'docs/sources/av'


def main():
    checks = []
    for layer in ('LCSF', 'RESF'):
        url = f'https://geodienste.ch/db/av_0/deu/ogcapi/collections/{layer}/items?f=json&limit=2&bbox=7.44,46.94,7.45,46.95'
        checks.append(check(url, layer))
    for layer in ('ch.kantone.cadastralwebmap-farbe', 'ch.swisstopo-vd.amtliche-vermessung'):
        fields = json.loads((ROOT / f'{layer}.json').read_text(encoding='utf-8'))['fields']
        feature_id = next(field['values'][0] for field in fields if field['name'] == 'id')
        url = f'https://api3.geo.admin.ch/rest/services/ech/MapServer/{layer}/{feature_id}?sr=2056&geometryFormat=geojson&returnGeometry=true'
        checks.append(check(url, layer))
    result = {'checked': date.today().isoformat(), 'checks': checks,
              'limitation': 'Small response samples confirm delivery only, not national completeness, survey accuracy or legal currency.'}
    (ROOT / 'service-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))


def check(url, layer):
    result = {'layer': layer, 'url': url}
    try:
        with urlopen(url, timeout=30) as response:
            raw = response.read()
            payload = json.loads(raw)
            features = payload.get('features', [payload['feature']] if 'feature' in payload else [])
            result.update(httpStatus=response.status, responseSha256=hashlib.sha256(raw).hexdigest(),
                          featureCount=len(features), geometryTypes=sorted({feature.get('geometry', {}).get('type', 'missing') for feature in features}),
                          propertyNames=sorted({key for feature in features for key in feature.get('properties', {})}))
    except HTTPError as error:
        result.update(httpStatus=error.code, geometryVerified=False)
    return result


if __name__ == '__main__':
    main()
