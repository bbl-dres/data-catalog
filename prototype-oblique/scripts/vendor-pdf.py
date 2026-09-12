"""Fetch pinned PDF browser bundles and fonts; verify package archives before extraction."""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = [
    ('jspdf', '4.2.1', 'YyAXyvnmjTbR4bHQRLzex3CuINCDlQnBqoSYyjJwTP2x9jDLuKDzy7aKUl0hgx3uhcl7xzg32agn5vlie6HIlQ==', 'jspdf.umd.min.js'),
    ('svg2pdf.js', '2.8.1', 'AzXfPHjHnFt9dpdRPhWWBOKipnMSWQZRKiV3FTTPdY6wwRgT3labbA4s0HIQaskNhwAhrcI2u2rDhD8j8udfNQ==', 'svg2pdf.umd.min.js'),
]
FONT_COMMIT = 'ffebf8c1ee449e544955a7e813c54f9b73848eac'


def fetch(url):
    with urlopen(url, timeout=45) as response:
        return response.read()


def save(directory, name, content):
    directory.mkdir(parents=True, exist_ok=True)
    (directory / name).write_bytes(content)
    return {'file': name, 'sha256': hashlib.sha256(content).hexdigest()}


for package, version, integrity, bundle in PACKAGES:
    archive_url = f'https://registry.npmjs.org/{package}/-/{package}-{version}.tgz'
    payload = fetch(archive_url)
    assert base64.b64encode(hashlib.sha512(payload).digest()).decode() == integrity
    directory = ROOT / 'vendor' / package
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
        files = []
        for source, target in [(f'package/dist/{bundle}', bundle), ('package/LICENSE', 'LICENSE')]:
            files.append(save(directory, target, archive.extractfile(source).read()))
    (directory / 'NOTICE').write_text(json.dumps({'package': package, 'version': version, 'source': archive_url, 'integrity': f'sha512-{integrity}', 'files': files}, indent=2) + '\n', encoding='utf-8')
    print(f'Vendored {package} {version}')

directory = ROOT / 'assets' / 'fonts' / 'pdf'
base_url = f'https://raw.githubusercontent.com/notofonts/noto-fonts/{FONT_COMMIT}'
files = [save(directory, f'NotoSans-{weight}.ttf', fetch(f'{base_url}/hinted/ttf/NotoSans/NotoSans-{weight}.ttf')) for weight in ['Regular', 'Bold']]
files.append(save(directory, 'LICENSE', fetch(f'{base_url}/LICENSE')))
(directory / 'NOTICE').write_text(json.dumps({'family': 'Noto Sans', 'source': base_url, 'files': files}, indent=2) + '\n', encoding='utf-8')
print('Vendored Noto Sans PDF fonts')
