"""Import reviewed AV model metadata from captured official sources, offline."""
import argparse
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/sources/av'
IMPORT_ID = 'av-dm01-reviewed'
MODEL = 'DM01AVCH24LV95D'
MODEL_FILE = 'DM.01-AV-CH_LV95_24d_ili1.ili'
MODEL_URL = 'https://models.geo.admin.ch/V_D/' + MODEL_FILE
MANUAL_URL = 'https://www.cadastre-manual.admin.ch/de/modelldokumentation-dm01-av-ch'
SERVICE_URL = 'https://geodienste.ch/services/av/info'
SERVICE_BASE = 'https://geodienste.ch/db/av_0/deu'
SCHEMA_URL = SERVICE_BASE + '?REQUEST=DescribeFeatureType&SERVICE=WFS&VERSION=1.1.0'
REGISTER_URL = 'https://www.ech.ch/de/ech/ech-0153/1.0'
MODEL_TABLES = {
    'Bodenbedeckung.BoFlaeche': ('t-av-land-cover', 'Bodenabdeckung – DM.01', 'bodenbedeckung',
        'Flächen der Bodenbedeckung im DM.01-AV-CH. Art unterscheidet unter anderem Gebäude, befestigte und humusierte Flächen, Gewässer, bestockte und vegetationslose Flächen.'),
    'Bodenbedeckung.Gebaeudenummer': ('t-av-building-number', 'Gebäudenummer – DM.01', 'gebaeude',
        'Nummern einer Bodenbedeckungsfläche der Art Gebäude. Ein GWR_EGID kann angegeben werden, wenn die Gebäudedefinition mit jener des BFS übereinstimmt.'),
    'Bodenbedeckung.BBNachfuehrung': ('t-av-land-cover-update', 'Nachführung Bodenabdeckung – DM.01', None,
        'Nachführungsinformationen der Bodenbedeckung mit Identifikation, Beschreibung, optionalem Perimeter, Gültigkeit und Datumsangaben.'),
    'Liegenschaften.Grundstueck': ('t-av-property', 'Grundstück – DM.01', 'grundstueck',
        'Grundstücksidentifikation und Zustandsangaben im DM.01-AV-CH. Die Art unterscheidet Liegenschaft, selbständige Rechte und Bergwerk. Die Geometrie einer Liegenschaft wird in der zugehörigen Klasse Liegenschaft geführt.'),
    'Liegenschaften.Liegenschaft': ('t-av-parcel', 'Liegenschaft – DM.01', 'grundstueck',
        'Geometrie und Flächenmass einer Liegenschaft beziehungsweise eines Teilgrundstücks. Die Referenz Liegenschaft_von verbindet sie mit der Grundstücksidentifikation.'),
    'Liegenschaften.LSNachfuehrung': ('t-av-property-update', 'Nachführung Liegenschaften – DM.01', None,
        'Nachführungsinformationen der Liegenschaften mit Identifikation, Beschreibung, optionalem Perimeter, Gültigkeit sowie technischem und Grundbucheintrag.'),
}
LABELS = {
    'Entstehung': 'Nachführung', 'Geometrie': 'Geometrie', 'Qualitaet': 'Qualitätsstandard', 'Art': 'Art',
    'Gebaeudenummer_von': 'Bodenbedeckungsfläche', 'Nummer': 'Nummer', 'GWR_EGID': 'Eidgenössischer Gebäudeidentifikator',
    'NBIdent': 'Identifikation Nummerierungsbereich', 'Identifikator': 'Identifikator', 'Beschreibung': 'Beschreibung',
    'Perimeter': 'Perimeter', 'Gueltigkeit': 'Gültigkeit', 'GueltigerEintrag': 'Gültiger Eintrag',
    'Datum1': 'Datum 1 (Altbestand)', 'Datum2': 'Datum 2 (Altbestand)', 'GBEintrag': 'Grundbucheintrag',
    'EGRIS_EGRID': 'Eidgenössischer Grundstücksidentifikator', 'Vollstaendigkeit': 'Vollständigkeit',
    'GesamteFlaechenmass': 'Gesamtes Flächenmass', 'Liegenschaft_von': 'Grundstück',
    'NummerTeilGrundstueck': 'Nummer Teilgrundstück', 'Flaechenmass': 'Flächenmass',
    'msGeometry': 'Geometrie', 'BFSNr': 'BFS-Gemeindenummer', 'Kanton': 'Kanton', 'Flaeche': 'Fläche',
}
ENUMS = {
    'BBArt': ('r-av-land-cover-type', 'AV Bodenbedeckungsart', 'Bodenbedeckung', None, 'bodenbedeckung'),
    'Qualitaetsstandard': ('r-av-quality', 'AV Qualitätsstandard', None, None, None),
    'Status': ('r-av-update-status', 'AV Nachführungsstatus', None, None, None),
    'Grundstuecksart': ('r-av-property-type', 'AV Grundstücksart', 'Liegenschaften', None, 'grundstueck'),
    'Gueltigkeit': ('r-av-property-validity', 'AV Grundstücksgültigkeit', 'Liegenschaften', 'Grundstueck', 'grundstueck'),
    'Vollstaendigkeit': ('r-av-completeness', 'AV Grundstücksvollständigkeit', 'Liegenschaften', 'Grundstueck', 'grundstueck'),
    'Linienart': ('r-av-boundary-line-type', 'AV Grenzlinienart', 'Liegenschaften', 'Liegenschaft', 'grundstueck'),
}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def section(text, keyword, name):
    match = re.search(r'\b' + keyword + r'\s+' + name + r'\s*=.*?\bEND\s+' + name + r'[.;]', text, re.S)
    if not match:
        raise ValueError(f'Missing {keyword} {name}')
    return match.group()


def enumeration(text, name):
    match = re.search(r'\b' + name + r'\s*[:=]\s*(?:OPTIONAL\s*)?(\(.*?\))\s*;', text, re.S)
    if not match:
        raise ValueError(f'Missing enumeration {name}')
    tokens = re.findall(r'[A-Za-z][A-Za-z0-9_]*|[(),]', match[1])
    index = 0

    def parse(prefix=()):
        nonlocal index
        if tokens[index] != '(':
            raise ValueError('Invalid enumeration')
        index += 1
        leaves = []
        while tokens[index] != ')':
            name = tokens[index]
            index += 1
            path = (*prefix, name)
            if tokens[index] == '(':
                leaves.extend(parse(path))
            else:
                leaves.append('.'.join(path))
            if tokens[index] == ',':
                index += 1
            elif tokens[index] != ')':
                raise ValueError('Invalid enumeration separator')
        index += 1
        return leaves

    values = parse()
    if index != len(tokens):
        raise ValueError('Incomplete enumeration parse')
    return values


def statements(body):
    """Split declarations while retaining geometry LINEATTR as nested metadata."""
    current, nested = [], False
    for line in body.splitlines()[1:-1]:
        clean = line.strip()
        if not clean or clean.startswith(('IDENT ', 'NO IDENT')):
            continue
        current.append(clean)
        nested = nested or 'LINEATTR' in clean
        if clean.endswith(';') and (not nested or clean == 'END;'):
            yield ' '.join(current)
            current, nested = [], False
    if current:
        raise ValueError('Unparsed field declaration: ' + ' '.join(current))


def common(identifier, name, description, captured, provenance):
    return {'identifier': identifier, 'name': name, 'description': description, 'status': 'Entwurf',
            'created': captured, 'modified': captured, 'synced': captured, 'domain': 'bau',
            'source': 'Amtliche Vermessung', 'provenance': provenance}


def build(captured):
    source_bytes = (SOURCE / MODEL_FILE).read_bytes()
    indexed = read_json(SOURCE / 'model-record.json')['records'][0]
    if hashlib.md5(source_bytes).hexdigest() != indexed['md5']:
        raise ValueError('Model differs from official repository checksum')
    raw = source_bytes.decode('latin1').replace('\r\n', '\n')
    text = re.sub(r'!![^\n]*', '', raw)
    text = re.sub(r'//.*?//', '', text, flags=re.S)
    sources = {file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in sorted(SOURCE.iterdir()) if file.is_file() and not file.name.startswith('.')}
    provenance = {'importId': IMPORT_ID, 'captured': captured, 'model': MODEL, 'files': sources}
    records = {'tables': [], 'codelists': [], 'apis': [], 'systems': []}
    government = {'responsibleOrg': 'Kantonale Stellen der amtlichen Vermessung',
                  'contact': {'url': 'https://geodienste.ch/services/av'}}
    model_info = {'sourceUrl': MODEL_URL, 'version': 'DM.01-AV-CH 24 / LV95', **government}
    for name, (identifier, title, topic, table, business_object) in ENUMS.items():
        scope = section(text, 'TOPIC', topic) if topic else text[:text.index('TOPIC')]
        if table:
            scope = section(scope, 'TABLE', table)
        codes = enumeration(scope, name)
        record = common(identifier, title, 'Aufzählungswerte aus dem DM.01-AV-CH. Technische Werte und Hierarchie entsprechen dem INTERLIS-Modell.', captured, provenance)
        record.update(sourceAuthority='swisstopo · DM.01-AV-CH', sourceUrl=MODEL_URL, version='24 / LV95',
                      sourceDetail=f'{MODEL}.{topic + "." if topic else ""}{table + "." if table else ""}{name}',
                      responsibleOrg='Bundesamt für Landestopografie swisstopo',
                      values=[{'code': code, 'label': code.replace('_', ' '), 'sourceOrdinal': index} for index, code in enumerate(codes)],
                      comment='Codes sind symbolische INTERLIS-Pfade; sourceOrdinal ist nur die Quellreihenfolge. Keine erfundenen numerischen Fachcodes. Anzeigenamen sind lesbar formatierte Modellwerte.')
        if business_object:
            record['businessObject'] = business_object
        if name == 'Linienart':
            record['comment'] += ' Linienattribute gehören zur Geometrie, nicht zu einem eigenständigen Polygonattribut. Undefiniert bedeutet im Modell rechtskräftig und vollständig.'
        records['codelists'].append(record)
    for qualified, (identifier, title, realizes, description) in MODEL_TABLES.items():
        topic, table = qualified.split('.')
        body = section(section(text, 'TOPIC', topic), 'TABLE', table)
        source_body = section(section(raw, 'TOPIC', topic), 'TABLE', table)
        fields = []
        for declaration in statements(body):
            name, spec = declaration.split(':', 1)
            name, spec = name.strip(), spec.strip().rstrip(';').strip()
            if name not in LABELS:
                raise ValueError('Unreviewed field: ' + name)
            optional = spec.startswith('OPTIONAL ')
            spec = spec.removeprefix('OPTIONAL ')
            field = {'technicalName': name, 'technicalNameKind': 'model-attribute', 'labels': {'de': LABELS[name]},
                     'description': '', 'dataType': spec.split(' LINEATTR')[0], 'dataTypeKind': 'model-type',
                     'mandatory': not optional, 'keyRole': None, 'sourceUrl': MODEL_URL,
                     'catalogMetadata': {'modelClass': f'{MODEL}.{qualified}', 'declaration': declaration}}
            if spec in ENUMS:
                field['codeList'] = ENUMS[spec][0]
            elif spec.startswith('('):
                field['codeList'] = ENUMS[name][0]
                field['dataType'] = 'ENUMERATION'
            if spec.startswith('->'):
                reference = spec.removeprefix('->').strip()
                field['catalogMetadata']['modelReference'] = f'{MODEL}.{topic}.{reference}'
                field['description'] = 'Modellreferenz auf ' + reference + '; keine bestätigte physische Fremdschlüsselspalte.'
            if 'LINEATTR' in spec:
                field['catalogMetadata']['lineAttributes'] = [{'technicalName': 'Linienart', 'mandatory': False, 'codeList': 'r-av-boundary-line-type'}]
            if name in ('Datum1', 'Datum2'):
                field['comment'] = 'Altbestand laut Modellkommentar. Für neue Nachführungen gelten GueltigerEintrag bzw. zusätzlich GBEintrag; die formale OPTIONAL-Deklaration bleibt unverändert.'
            fields.append(field)
        record = common(identifier, title, description, captured, provenance)
        record.update(**model_info, technicalName=qualified, technicalNameKind='model-class', labels={'de': title},
                      system='av', modelClass=f'{MODEL}.{qualified}', fieldScope='model-inventory', fields=fields,
                      sourceDetail=f'{MODEL}.{qualified}', informationUrls=[MODEL_URL, MANUAL_URL],
                      descriptionSource={'title': qualified, 'url': MODEL_URL, 'kind': 'source-summary', 'reviewed': captured},
                      modelDeclaration=source_body, modelIdentifiers=re.findall(r'\bIDENT ([^;]+);', body),
                      comment='INTERLIS-Modellklasse; technischer Name ist kein physischer Datenbanktabellenname. Die Beschreibung ist eine Zusammenfassung. Modellpflicht und Eindeutigkeit gelten für den Datentransfer, nicht automatisch für einen Webdienst.')
        if realizes:
            record['realizes'] = realizes
        if table == 'Grundstueck':
            record['informationUrls'].append(REGISTER_URL)
            record['comment'] += ' EGRID ist im Modell optional. NBIdent und Nummer bilden die deklarierte Identifikation. Keine Eigentümer-, Rechte- oder Grundbuchdaten aus eGRISDM importiert.'
        if table == 'Liegenschaft':
            record['comment'] += ' Ein Grundstück kann mehrere Teilflächen haben. AREA kann Kreisbögen enthalten; GeoJSON erfordert deren Approximation. Das amtliche Flächenmass ist nicht durch eine neu berechnete Polygonfläche zu ersetzen.'
        records['tables'].append(record)
    schema = ET.parse(SOURCE / 'av-wfs-schema.xsd')
    ns = {'x': 'http://www.w3.org/2001/XMLSchema'}
    collections = {entry['id']: entry for entry in read_json(SOURCE / 'av-collections.json')['collections']}
    for layer, identifier, title, realizes in [('LCSF', 't-av-service-land-cover', 'Bodenabdeckung – geodienste.ch', 'bodenbedeckung'),
                                               ('RESF', 't-av-service-parcel', 'Liegenschaften – geodienste.ch', 'grundstueck')]:
        fields = []
        for element in schema.findall(f'.//x:complexType[@name="{layer}Type"]//x:element', ns):
            name = element.attrib['name']
            if name not in LABELS:
                raise ValueError('Unreviewed service field ' + name)
            fields.append({'technicalName': name, 'technicalNameKind': 'api-field', 'labels': {'de': LABELS[name]},
                           'description': '', 'dataType': element.attrib['type'], 'dataTypeKind': 'service-schema',
                           'keyRole': None, 'sourceUrl': SCHEMA_URL,
                           'catalogMetadata': {'featureType': 'ms:' + layer, 'xsd': element.attrib},
                           'comment': 'DescribeFeatureType beschreibt dieses Servicefeld. minOccurs=0 erlaubt das Weglassen im XML; daraus wird keine physische Nullfähigkeit abgeleitet.'})
        record = common(identifier, title, 'Publizierte Serviceprojektion für ' + ('Bodenbedeckungsflächen.' if layer == 'LCSF' else 'Liegenschaftsflächen mit Grundstücksidentifikation.'), captured, provenance)
        record.update(**government, technicalName=layer, technicalNameKind='service-layer', labels={'de': title},
                      system='av', realizes=realizes, fieldScope='api-projection', fields=fields, version='24.0.0',
                      sourceUrl=SCHEMA_URL, sourceDetail=f'WFS 1.1.0 DescribeFeatureType · ms:{layer}',
                      informationUrls=[SERVICE_URL, SCHEMA_URL, SERVICE_BASE + f'/ogcapi/collections/{layer}?f=json'],
                      serviceMetadata=collections[layer],
                      comment='Service-Layer, keine physische Tabelle. Feldnamen und Typen sind im XSD bestätigt; Geometrie ist dort allgemein gml:GeometryPropertyType. Die OGC-API-Beispielabfrage lieferte hier HTTP 403. Wertecodierung und Geometriequalität des Dienstes sind noch zu prüfen; DM.01-Wertelisten werden nicht als bestätigte Servicecodes zugeordnet.')
        records['tables'].append(record)
    system = common('av', 'Amtliche Vermessung (AV)', 'Verteilte Daten der amtlichen Vermessung. Katalogauszug für Bodenabdeckung und Liegenschaften mit DM.01-Modellklassen und getrennten geodienste.ch-Serviceprojektionen.', captured, provenance)
    system.update(**government, technology='INTERLIS 1 · DM.01-AV-CH 24 · LV95', informationUrl=MANUAL_URL,
                  sourceUrl=MODEL_URL, sourceDetail='DM.01-AV-CH 24, LV95; geodienste.ch Angebotsversion 24.0',
                  comment='Fachlicher Datenbestand aus kantonalen Quellen, kein zentrales BBL-System. Bundesaufsicht: swisstopo. DM.01 wird gemäss swisstopo bis 31.12.2027 durch DMAV abgelöst. eCH-0153 beschreibt das elektronische Grundbuch und ist kein Ersatz für das AV-Geometriemodell. Katalogstatus bleibt Entwurf.')
    records['systems'].append(system)
    api_specs = [
        ('api-av-wms', 'AV – geodienste.ch WMS', 'WMS 1.3.0', SERVICE_BASE, SERVICE_URL, '24.0.0',
         'Kartendarstellung der Amtlichen Vermessung. Für diesen Katalog sind LCSF (Bodenbedeckung) und RESF (Liegenschaften) relevant.',
         'GetMap liefert ein Kartenbild. Parcel-Polygone für Berechnungen oder Speicherung über einen Vektordienst beziehen.', 'map-image'),
        ('api-av-wfs', 'AV – geodienste.ch WFS', 'WFS 2.0.0', SERVICE_BASE, SERVICE_URL, '24.0.0',
         'Vektorzugriff auf die publizierten AV-Featuretypen; im Katalog auf LCSF und RESF begrenzt.',
         'Capabilities und Schema geprüft; GetFeature-Datenabruf noch nicht verifiziert. Kantonale Verfügbarkeit und Nutzungsbedingungen prüfen. Paging ist angeboten, laut Capabilities aber nicht transaktionssicher.', 'vector-features'),
        ('api-av-features', 'AV – geodienste.ch OGC API Features', 'OGC API Features', SERVICE_BASE + '/ogcapi', SERVICE_BASE + '/ogcapi', '24.0.0',
         'GeoJSON-Zugriff auf AV-Collections. Relevant sind RESF für Liegenschaften und LCSF für Bodenbedeckung.',
         'Collection-Metadaten geprüft, Beispielabrufe hier HTTP 403. Keine bestätigte flächendeckende Zugänglichkeit. Projektierte Collections RESFPROJ und LCSFPROJ sind getrennt und nicht Teil des importierten Ist-Inventars.', 'vector-features'),
        ('api-av-geoadmin', 'AV – swisstopo GeoAdmin REST', 'REST / GeoJSON', 'https://api3.geo.admin.ch/rest/services/ech/MapServer', 'https://docs.geo.admin.ch/access-data/get-features.html', None,
         'Metadaten und Einzelobjekte der AV-Layer ch.swisstopo-vd.amtliche-vermessung und ch.kantone.cadastralwebmap-farbe. Beide lieferten in Stichproben Polygongeometrie.',
         'Explizit sr=2056 und returnGeometry=true verwenden. Feature-ID ist keine EGRID. SearchServer-Treffer und Bounding Box sind keine vollständige Polygongeometrie. Stichproben bestätigen keine schweizweite Vollständigkeit oder Vermessungsgenauigkeit.', 'vector-features'),
        ('api-av-geoadmin-wms', 'AV – swisstopo WMS / WMTS', 'WMS / WMTS', 'https://wms.geo.admin.ch/', 'https://docs.geo.admin.ch/visualize-data/wmts.html', None,
         'Kartendarstellung der Amtlichen Vermessung über die GeoAdmin-Dienste. CadastralWebMap ist als ch.kantone.cadastralwebmap-farbe dokumentiert.',
         'Rasterdarstellung; keine Vektorextraktion aus Kartenbildern. Für CadastralWebMap empfiehlt die Dokumentation LV95 oder LV03. Der GetFeatures-Zugriff wird separat im REST-Eintrag beschrieben.', 'map-image'),
    ]
    checks = read_json(SOURCE / 'service-checks.json')
    for identifier, name, protocol, endpoint, documentation, version, description, comment, purpose in api_specs:
        record = common(identifier, name, description, captured, provenance)
        record.update(system='av', protocol=protocol, endpointURL=endpoint, documentation=documentation,
                      sourceUrl=documentation, sourceDetail='Geprüfte öffentliche Dokumentation und Service-Metadaten',
                      responsibleOrg='swisstopo' if 'geoadmin' in identifier else 'Konferenz der kantonalen Geoinformations- und Katasterstellen (KGK)',
                      accessRights='Gemäss kantonaler Verfügbarkeit und Nutzungsbedingungen', comment=comment,
                      readOnly=True, servicePurpose=purpose)
        if version:
            record['version'] = version
        if 'geoadmin' in identifier:
            record['layers'] = ['ch.swisstopo-vd.amtliche-vermessung', 'ch.kantone.cadastralwebmap-farbe']
        else:
            record['layers'] = ['LCSF', 'RESF']
        if identifier == 'api-av-geoadmin':
            record['verification'] = [check for check in checks['checks'] if check['layer'].startswith('ch.')]
        if identifier == 'api-av-features':
            record['verification'] = [check for check in checks['checks'] if not check['layer'].startswith('ch.')]
        records['apis'].append(record)
    report = {'provenance': provenance, 'summary': {kind: len(items) for kind, items in records.items()},
              'modelClasses': list(MODEL_TABLES), 'serviceLayers': ['LCSF', 'RESF'],
              'fieldCount': sum(len(table['fields']) for table in records['tables']),
              'valueCount': sum(len(ref['values']) for ref in records['codelists']),
              'serviceChecks': checks,
              'excludedModelClasses': {topic: [name for name in re.findall(r'\bTABLE (\w+)\s*=', section(text, 'TOPIC', topic)) if f'{topic}.{name}' not in MODEL_TABLES]
                                       for topic in ('Bodenbedeckung', 'Liegenschaften')},
              'scope': 'Current area/identity/update classes and their enumerations. Other topics, projected features, labels, points, rights geometry and land-register records are not imported.'}
    return records, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--captured', required=True)
    args = parser.parse_args()
    date.fromisoformat(args.captured)
    records, report = build(args.captured)
    pending = {}
    for kind, items in records.items():
        path = ROOT / 'data' / (kind + '.json')
        current = read_json(path)
        previous = {record['identifier']: record for record in current}
        for item in items:
            old = previous.get(item['identifier'])
            if old and old.get('provenance', {}).get('importId') != IMPORT_ID:
                raise ValueError('Identifier already belongs to an unrelated record: ' + item['identifier'])
            if old:
                for key in ('created', 'comment'):
                    if key in old:
                        item[key] = old[key]
                if old.get('informationUrls'):
                    item['informationUrls'] = list(dict.fromkeys([*item.get('informationUrls', []), *old['informationUrls']]))
                old_fields = {field['technicalName']: field for field in old.get('fields', [])}
                for field in item.get('fields', []):
                    if 'comment' in old_fields.get(field['technicalName'], {}):
                        field['comment'] = old_fields[field['technicalName']]['comment']
        replacements = {item['identifier']: item for item in items}
        pending[path] = [replacements.get(item['identifier'], item) for item in current] + [item for item in items if item['identifier'] not in previous]
    history_path = ROOT / 'data/changelog.json'
    history = [entry for entry in read_json(history_path) if not (entry.get('importId') == IMPORT_ID and entry['date'] == args.captured)]
    for kind, items in records.items():
        for item in items:
            history.append({'entity': f'{"refs" if kind == "codelists" else kind}:{item["identifier"]}', 'date': args.captured,
                            'action': 'Metadaten importiert', 'detail': 'Geprüfter AV-Auszug: Modell, Serviceprojektionen und Wertelisten getrennt dokumentiert.',
                            'user': 'Katalogimport', 'importId': IMPORT_ID})
    pending[history_path] = history
    pending[ROOT / 'docs/sources/av/av-import-report.json'] = report
    for path, value in pending.items():
        write_json(path, value)
    print(json.dumps({**report['summary'], 'fields': report['fieldCount'], 'values': report['valueCount']}))


if __name__ == '__main__':
    main()
