# -*- coding: utf-8 -*-
"""Generate prototype-oblique/data/*.json from the mockup's inline data.

Field names follow the catalog information model (DCAT-AP CH / DMBOK aligned):
identifier, name, description, status, version, created, modified, responsibleOrg,
dataOwner, dataSteward, classification, personalData, source, sourceDetail, synced.
"""
import json, os, re, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(name, len(obj) if isinstance(obj, list) else '')

def slug(s):
    s = s.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue')
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

# ---------------------------------------------------------------- domains
DOMAINS = [
    dict(id='bau', name='Architektonische Sicht', resp='Immobilienmanagement', owner='Martina Aebischer', steward='Lukas Zbinden', desc='Physische Gebäudehierarchie: Areale, Campusse, Grundstücke, Gebäude, Geschosse, Räume, Nutzungseinheiten und Bemessungen.'),
    dict(id='energie', name='Energie', resp='Energiemanagement', owner='Rahel Gasser', steward='Simon Bürki', desc='Konzepte rund um Energiemanagement, Heizzentralen, Zähler und Betriebsmesswerte.'),
    dict(id='finanzen', name='Finanzen', resp='Portfoliomanagement', owner='Martina Aebischer', steward='Lukas Zbinden', desc='Finanzielle Organisationseinheiten und Buchhaltungsstrukturen für das Immobilienmanagement.'),
    dict(id='partner', name='Geschäftspartner', resp='Vertragsmanagement', owner='Corinne Marti', steward='Pascal Rüegg', desc='Personen, Kontakte und Unternehmen im Immobilienmanagement.'),
    dict(id='miete', name='Mieter Management', resp='Liegenschaftsmanagement', owner='Andrea Kaufmann', steward='Thomas Wyss', desc='Konzepte rund um Mietobjekte, Wohnungen, Mietverträge und vertragliche Konditionen.'),
    dict(id='projekt', name='Projekt Management', resp='Projektmanagement', localDraft=True, date='2026-09-05', desc='Planung, Steuerung und Durchführung von Bauprojekten mit Phasen, Meilensteinen und Bauarbeiten.'),
]
CONTACT = {
    'Immobilienmanagement': dict(email='immobilienmanagement@bbl.admin.ch', phone='+41 58 465 50 10'),
    'Energiemanagement': dict(email='energiemanagement@bbl.admin.ch', phone='+41 58 465 50 30'),
    'Portfoliomanagement': dict(email='portfoliomanagement@bbl.admin.ch', phone='+41 58 465 50 20'),
    'Vertragsmanagement': dict(email='vertragsmanagement@bbl.admin.ch', phone='+41 58 465 50 40'),
    'Liegenschaftsmanagement': dict(email='liegenschaften@bbl.admin.ch', phone='+41 58 465 50 50'),
}
domain_of = {d['id']: d for d in DOMAINS}

# ---------------------------------------------------------------- systems
SYSTEMS = [
    dict(id='sap', name='SAP RE-FX', tech='SAP S/4HANA', resp='Portfoliomanagement', owner='Martina Aebischer', steward='Nadia Ferrari', date='2025-12-01', desc='ERP-System für die Immobilienbewirtschaftung. Enthält Stammdaten zu Gebäuden, Mietobjekten, Mietverträgen, Konditionen und Geschäftspartnern.'),
    dict(id='gis', name='GIS IMMO', tech='ArcGIS Enterprise', resp='Immobilienmanagement', owner='Martina Aebischer', steward='Lukas Zbinden', date='2025-12-02', desc='Geoinformationssystem für die Bundesimmobilien. Enthält Geodaten zu Gebäuden, Grundstücken und Energieinfrastruktur.'),
]

# ---------------------------------------------------------------- business objects
OBJECTS = [
    dict(id='areal', name='Areal', domain='bau', attrs=5, status='Gültig', norm='VILB, eCH-0071', desc='Ein definiertes Landareal bestehend aus einer oder mehreren Parzellen, typischerweise ein Bundeskampus oder eine Anlage.'),
    dict(id='kampus', name='Kampus', domain='bau', attrs=4, status='Gültig', norm='VILB Anhang A', desc='Eine zusammengehörende Gruppe von Gebäuden, die eine funktionale Einheit bilden, z.B. Bundeskampus Zollikofen.'),
    dict(id='grundstueck', name='Grundstück', domain='bau', attrs=5, status='Gültig', norm='ZGB Art. 655, eCH-0071', desc='Ein im Grundbuch eingetragenes, rechtlich definiertes Stück Land, identifiziert durch eine EGRID.'),
    dict(id='gebaeude', name='Gebäude', domain='bau', attrs=7, status='Gültig', norm='eCH-0071 v2.0, GWR', desc='Ein dauerhaftes, überdachtes Bauwerk, das im eidgenössischen Gebäude- und Wohnungsregister (GWR) erfasst und durch eine EGID identifiziert wird.'),
    dict(id='nutzungseinheit', name='Nutzungseinheit', domain='bau', attrs=4, status='Gültig', norm='SIA 416', desc='Ein in sich geschlossener Bereich innerhalb eines Gebäudes, der einem einzigen Zweck dient, z.B. eine Bürofläche oder ein Lager.'),
    dict(id='geschoss', name='Geschoss', domain='bau', attrs=4, status='Gültig', norm='SIA 416', desc='Eine horizontale Ebene innerhalb eines Gebäudes, gemessen nach SIA 416.'),
    dict(id='raum', name='Raum', domain='bau', attrs=4, status='Gültig', norm='SIA 416, DIN 277', desc='Ein einzelner umschlossener Raum innerhalb eines Geschosses, identifiziert durch eine Raumnummer.'),
    dict(id='bodenbedeckung', name='Bodenbedeckung', domain='bau', attrs=4, status='Gültig', norm='DM.01-AV-CH, eCH-0071', desc='Fläche einer bestimmten Bodenbedeckungsart (Gebäude, befestigt, humusiert, Gewässer) gemäss amtlicher Vermessung.'),
    dict(id='bemessung', name='Bemessung', domain='bau', attrs=4, status='Gültig', norm='SIA 416', desc='Berechnete Flächen- und Volumenkennwerte für ein Gebäude oder eine Einheit (Geschossfläche, Nutzfläche, Volumen).'),
    dict(id='heizzentrale', name='Heizzentrale', domain='energie', attrs=5, status='Gültig', norm='SIA 380/1', desc='Technische Anlage zur Wärmeerzeugung, die ein oder mehrere Gebäude versorgt.'),
    dict(id='stromzaehler', name='Stromzähler', domain='energie', attrs=4, status='Gültig', norm='MID 2014/32/EU', desc='Messeinrichtung zur Erfassung des elektrischen Energieverbrauchs eines Gebäudes oder einer Nutzungseinheit.'),
    dict(id='betriebsmesswert', name='Betriebsmesswert', domain='energie', attrs=4, status='Entwurf', norm='BBL intern', desc='Zeitreihenwert aus dem Gebäudebetrieb, z.B. Wärmeverbrauch, Stromverbrauch oder Wasserverbrauch pro Periode.'),
    dict(id='wirtschaftseinheit', name='Wirtschaftseinheit', domain='finanzen', attrs=4, status='Gültig', norm='SAP RE-FX, VILB', desc='Eine eigenständige wirtschaftliche Einheit in der Immobilienbuchhaltung, typischerweise ein Gebäude oder eine Gebäudegruppe, die als ein Profit Center geführt wird. Zentrale Organisationseinheit in SAP RE-FX.'),
    dict(id='buchungskreis', name='Buchungskreis', domain='finanzen', attrs=4, status='Gültig', norm='SAP FI', desc='Kleinste organisatorische Einheit des externen Rechnungswesens, für die eine vollständige Buchhaltung geführt wird.'),
    dict(id='person', name='Person', domain='partner', attrs=6, status='Gültig', norm='eCH-0044, DSG', desc='Natürliche Person, die in einer Geschäftsbeziehung zum BBL steht, z.B. als Mieterin, Ansprechperson oder Bewirtschafter.'),
    dict(id='kontakt', name='Kontakt', domain='partner', attrs=4, status='Gültig', norm='eCH-0046', desc='Erreichbarkeitsangaben (E-Mail, Telefon, Adresse) einer Person oder eines Unternehmens.'),
    dict(id='unternehmen', name='Unternehmen', domain='partner', attrs=5, status='Gültig', norm='eCH-0097, UID', desc='Juristische Person oder Organisationseinheit, identifiziert durch die Unternehmens-Identifikationsnummer (UID).'),
    dict(id='mietobjekt', name='Mietobjekt', domain='miete', attrs=5, status='Gültig', norm='SAP RE-FX', desc='Vermietbare Einheit (Fläche, Raum, Parkplatz), die Gegenstand eines Mietvertrags sein kann.'),
    dict(id='wohnung', name='Wohnung', domain='miete', attrs=5, status='Gültig', norm='GWR (EWID), eCH-0071', desc='Wohneinheit innerhalb eines Gebäudes, im GWR durch eine EWID identifiziert; kann als Mietobjekt vermietet werden.'),
    dict(id='mietvertrag', name='Mietvertrag', domain='miete', attrs=4, status='Gültig', norm='OR Art. 253ff', desc='Vertragliche Vereinbarung zwischen Vermieter und Mieter über die Nutzung eines oder mehrerer Mietobjekte.'),
    dict(id='kondition', name='Kondition', domain='miete', attrs=3, status='Entwurf', norm='OR Art. 269ff', desc='Finanzielle Bedingung eines Mietvertrags, z.B. Nettomiete, Nebenkosten oder Kaution.'),
    dict(id='bauprojekt', name='Bauprojekt', domain='projekt', norm='', desc='Ein Bauprojekt ist ein Objekt, für das ein Baubewilligungsgesuch nach Artikel 22 des Bundesgesetzes vom 22. Juni 1979 über die Raumplanung (SR 700) erforderlich ist, oder ähnliches Objekt, das keiner Baubewilligung bedarf, jedoch der Meldepflicht unterliegt.', sourceUrl='https://www.housing-stat.ch/catalog/de/5.0/revised#beschreibung-der-entitaet-bauprojekt'),
    dict(id='meilenstein', name='Meilenstein', domain='projekt', norm='', desc='Ein Meilenstein bezeichnet einen festgelegten Zeitpunkt oder ein überprüfbares Ergebnis im Verlauf eines Bauprojekts, etwa eine Freigabe, einen Entscheid oder den Abschluss einer Phase.'),
    dict(id='phase', name='Phase', domain='projekt', norm='', desc='Eine Phase ist ein zeitlich und fachlich abgegrenzter Abschnitt eines Bauprojekts mit definierten Zielen und Ergebnissen. Ihre Reihenfolge strukturiert den Projektablauf.'),
    dict(id='bauarbeiten', name='Bauarbeiten', domain='projekt', norm='', desc='Die Art der Arbeiten (Neubau, Umbau oder Abbruch) muss für jedes Gebäude eines Bauprojekts angegeben werden. Neubau bedeutet die vollständige Errichtung eines neuen Gebäudes. Abbruch hingegen den kompletten Abbruch eines bestehenden Gebäudes. Alle übrigen Arbeiten werden als Umbau bezeichnet und umfassen die Vergrösserung oder den Teilabbruch eines bestehenden Gebäudes. Wenn es sich um einen Umbau handelt, muss die Art des Umbaus präzisiert werden.', sourceUrl='https://www.housing-stat.ch/catalog/de/5.0/revised#beschreibung-der-entitaet-arbeiten'),
]
obj_of = {o['id']: o for o in OBJECTS}

# Explicit attribute lists (name, description, valueType, keyRole)
ATTRS = {
    # Local business-model examples, not a duplicate or a claimed GWR field schema.
    'bauprojekt': [
        ('Projekt-ID', 'Eindeutiger Identifikator des Bauprojekts im Projektmanagement.', 'Text', 'PK'),
        ('EPROID', 'Eidgenössischer Bauprojektidentifikator zur Zuordnung eines im GWR erfassten Bauprojekts.', 'Ganzzahl', 'optional'),
        ('Bezeichnung', 'Kurzbezeichnung des Bauprojekts.', 'Text', None),
        ('Status', 'Aktueller Bearbeitungsstand des Bauprojekts.', 'Code', None),
        ('Startdatum', 'Geplanter Beginn des Bauprojekts.', 'Datum', 'optional'),
        ('Enddatum', 'Geplanter Abschluss des Bauprojekts.', 'Datum', 'optional'),
        ('Projektkosten', 'Geplante Gesamtkosten des Bauprojekts in CHF.', 'Dezimal', 'optional'),
    ],
    'meilenstein': [
        ('Meilenstein-ID', 'Eindeutiger Identifikator des Meilensteins.', 'Text', 'PK'),
        ('Bauprojekt', 'Projekt-ID des zugehörigen Bauprojekts.', 'Text', 'FK'),
        ('Phase', 'Phase des Bauprojekts, der der Meilenstein zugeordnet ist.', 'Text', 'optional'),
        ('Bezeichnung', 'Erwartetes Ergebnis, Entscheid oder Freigabe.', 'Text', None),
        ('Solltermin', 'Geplanter Termin des Meilensteins.', 'Datum', None),
        ('Isttermin', 'Datum, an dem der Meilenstein erreicht wurde.', 'Datum', 'optional'),
    ],
    'phase': [
        ('Phase-ID', 'Eindeutiger Identifikator der Projektphase.', 'Text', 'PK'),
        ('Bauprojekt', 'Projekt-ID des zugehörigen Bauprojekts.', 'Text', 'FK'),
        ('Bezeichnung', 'Name der Phase im Projektablauf.', 'Text', None),
        ('Reihenfolge', 'Position der Phase innerhalb des Bauprojekts.', 'Ganzzahl', None),
        ('Startdatum', 'Geplanter Beginn der Phase.', 'Datum', 'optional'),
        ('Enddatum', 'Geplanter Abschluss der Phase.', 'Datum', 'optional'),
        ('Status', 'Aktueller Bearbeitungsstand der Phase.', 'Code', None),
    ],
    'bauarbeiten': [
        ('Bauarbeiten-ID', 'Lokaler Identifikator der Bauarbeiten im Projektmanagement.', 'Text', 'PK'),
        ('Bauprojekt', 'Projekt-ID des zugehörigen Bauprojekts.', 'Text', 'FK'),
        ('Gebäude', 'Identifikator des Gebäudes, an dem die Arbeiten durchgeführt werden.', 'Text', 'FK'),
        ('Art der Arbeiten', 'Einordnung der Arbeiten als Neubau, Umbau oder Abbruch.', 'Code', None),
        ('Beschreibung', 'Ergänzende Beschreibung des Umfangs der Bauarbeiten.', 'Text', 'optional'),
    ],
    'wirtschaftseinheit': [
        ('WE-Nummer', 'Eindeutige Nummer der Wirtschaftseinheit in SAP RE-FX.', 'Text', 'PK'),
        ('Bezeichnung', 'Name/Bezeichnung der Wirtschaftseinheit.', 'Text', None),
        ('Buchungskreis', 'Zugeordneter Buchungskreis der Wirtschaftseinheit.', 'Text', 'FK'),
        ('Profit Center', 'Zugeordnetes Profit Center für die Ergebnisrechnung.', 'Text', 'optional'),
    ],
    'gebaeude': [
        ('EGID', 'Eidgenössischer Gebäudeidentifikator gemäss GWR.', 'Ganzzahl', 'PK'),
        ('Bezeichnung', 'Gebäudename oder Kurzbezeichnung.', 'Text', None),
        ('Gebäudekategorie', 'Kategorie gemäss GWR Merkmalskatalog.', 'Code', 'FK'),
        ('Baujahr', 'Jahr der Fertigstellung.', 'Ganzzahl', None),
        ('Grundstück', 'Zugehöriges Grundstück (EGRID).', 'Text', 'FK'),
        ('Gebäudestatus', 'Status gemäss GWR (bestehend, projektiert, abgebrochen).', 'Code', 'FK'),
        ('Energieträger', 'Hauptenergieträger der Heizung.', 'Code', 'optional'),
    ],
    'grundstueck': [
        ('EGRID', 'Eidgenössischer Grundstücksidentifikator gemäss amtlicher Vermessung.', 'Text', 'PK'),
        ('Parzellennummer', 'Nummer der Parzelle im Grundbuch der Gemeinde.', 'Text', None),
        ('Gemeinde', 'BFS-Gemeindenummer der Standortgemeinde.', 'Code', 'FK'),
        ('Fläche', 'Grundstücksfläche in m² gemäss Grundbuch.', 'Dezimal', None),
        ('Eigentumsform', 'Eigentumsverhältnis (Alleineigentum, Baurecht, Miteigentum).', 'Code', 'FK'),
    ],
    'person': [
        ('Personen-ID', 'Eindeutiger Identifikator der Person im führenden System.', 'Text', 'PK'),
        ('Name', 'Familienname.', 'Text', None),
        ('Vorname', 'Vorname.', 'Text', None),
        ('Geburtsdatum', 'Geburtsdatum gemäss eCH-0044.', 'Datum', 'optional'),
        ('Unternehmen', 'Zugehöriges Unternehmen, falls die Person eine Organisation vertritt.', 'Text', 'FK'),
        ('Rolle', 'Rolle in der Geschäftsbeziehung (Mieter, Ansprechperson, Bewirtschafter).', 'Code', 'FK'),
    ],
    'mietobjekt': [
        ('Mietobjekt-Nummer', 'Eindeutige Nummer des Mietobjekts in SAP RE-FX.', 'Text', 'PK'),
        ('Bezeichnung', 'Bezeichnung des Mietobjekts.', 'Text', None),
        ('Wirtschaftseinheit', 'Übergeordnete Wirtschaftseinheit.', 'Text', 'FK'),
        ('Nutzungsart', 'Nutzungsart gemäss SIA 416.', 'Code', 'FK'),
        ('Fläche', 'Vermietbare Fläche in m².', 'Dezimal', None),
    ],
}
BASE_ATTRS = lambda o: [
    (o['name'] + '-ID', 'Eindeutiger Identifikator des Geschäftsobjekts ' + o['name'] + '.', 'Text', 'PK'),
    ('Bezeichnung', 'Name/Bezeichnung.', 'Text', None),
    ('Status', 'Lebenszyklusstatus des Objekts.', 'Code', 'FK'),
    ('Gültig ab', 'Beginn der Gültigkeit.', 'Datum', None),
    ('Gültig bis', 'Ende der Gültigkeit.', 'Datum', 'optional'),
    ('Bemerkung', 'Ergänzende Hinweise als Freitext.', 'Text', 'optional'),
    ('Führendes System', 'System, das den Datensatz führt.', 'Code', 'FK'),
]
def attrs_of(o):
    raw = ATTRS.get(o['id']) or BASE_ATTRS(o)[:o['attrs']]
    out = []
    for i, (n, d, t, k) in enumerate(raw):
        out.append(dict(identifier=slug(n), name=n, description=d, valueType=t,
                        keyRole=k if k in ('PK', 'FK') else None, mandatory=k != 'optional', position=i + 1))
    return out

TERMS = {
    'gebaeude': [('Gebäude', 39047), ('Bauwerk', 39051), ('EGID', 61120)],
    'grundstueck': [('Grundstück', 40102), ('Parzelle', 40108), ('EGRID', 61121)],
    'areal': [('Areal', 40230)], 'kampus': [('Campus', 40233)], 'geschoss': [('Geschoss', 40310), ('Stockwerk', 40311)],
    'raum': [('Raum', 40320)], 'nutzungseinheit': [('Nutzungseinheit', 40340)], 'bemessung': [('Geschossfläche', 40350), ('Nutzfläche', 40352)],
    'heizzentrale': [('Heizzentrale', 42010), ('Wärmeerzeuger', 42012)], 'stromzaehler': [('Stromzähler', 42020)], 'betriebsmesswert': [('Messwert', 42030)],
    'wirtschaftseinheit': [('Wirtschaftseinheit', 43010), ('Profit Center', 43014)], 'buchungskreis': [('Buchungskreis', 43020)],
    'person': [('Natürliche Person', 44010)], 'kontakt': [('Kontakt', 44020)], 'unternehmen': [('Unternehmen', 44030), ('UID', 44031)],
    'mietobjekt': [('Mietobjekt', 45010)], 'mietvertrag': [('Mietvertrag', 45020), ('Miete', 45021)], 'kondition': [('Mietzins', 45030), ('Nebenkosten', 45031)],
}
CLASSIFICATION = {'person': 'vertraulich', 'kontakt': 'vertraulich', 'mietvertrag': 'vertraulich', 'kondition': 'vertraulich', 'unternehmen': 'intern'}
PERSONAL = {'person', 'kontakt', 'mietvertrag', 'mietobjekt', 'unternehmen'}

# ---------------------------------------------------------------- tables
TABLES = [
    dict(id='t-we', name='Wirtschaftseinheit', tech='VIBDBU', system='sap', obj='wirtschaftseinheit', date='2026-04-20', desc='Stammdaten der Wirtschaftseinheiten (Immobilienbuchhaltung).'),
    dict(id='t-geb-sap', name='Gebäude', tech='VIBDBE', system='sap', obj='gebaeude', date='2026-04-20', desc='Gebäudestammdaten in SAP RE-FX inkl. Adresse und Zuordnung zur Wirtschaftseinheit.'),
    dict(id='t-bem', name='Bemessungen', tech='VIBDMEAS', system='sap', obj='bemessung', date='2026-04-20', desc='Flächen- und Volumenbemessungen je Objekt.'),
    dict(id='t-mo', name='Mietobjekt', tech='VIBDRO', system='sap', obj='mietobjekt', date='2026-03-12', desc='Vermietbare Einheiten mit Flächen und Nutzungsart.'),
    dict(id='t-mv', name='Mietvertrag', tech='VICNCN', system='sap', obj='mietvertrag', date='2026-03-12', desc='Mietverträge mit Laufzeiten, Partnern und Konditionen.'),
    dict(id='t-geb-gis', name='Gebäude', tech='BUILDING', system='gis', obj='gebaeude', date='2026-04-20', desc='Gebäudegeometrien und GWR-Attribute.'),
    dict(id='t-huelle', name='Gebäudehülle', tech='BUILDING_ENVELOPE', system='gis', obj='gebaeude', date='2026-04-20', desc='Fassaden- und Dachflächen mit Materialisierung.'),
    dict(id='t-proj', name='Bauprojekt', tech='CONSTRUCTION_PROJECT', system='gis', obj='areal', realizes='bauprojekt', date='2026-04-20', desc='Laufende und geplante Bauprojekte mit Perimeter.'),
    dict(id='t-boden', name='Bodenbedeckung', tech='LAND_COVER', system='gis', obj='bodenbedeckung', date='2026-04-20', desc='Bodenbedeckungsflächen gemäss amtlicher Vermessung.'),
    dict(id='t-parzelle', name='Grundstück', tech='PARCEL', system='gis', obj='grundstueck', date='2026-04-20', desc='Liegenschaften mit EGRID und Grundbuchdaten.'),
]
SQL_TYPE = {'Text': 'VARCHAR(40)', 'Datum': 'DATE', 'Ganzzahl': 'INTEGER', 'Dezimal': 'DECIMAL(15,2)', 'Code': 'CHAR(4)'}
def fields_of(t):
    o = obj_of[t['obj']]
    fields = []
    if t['system'] == 'sap':
        fields.append(('MANDT', 'Mandant.', 'CHAR(3)', 'PK'))
    else:
        fields.append(('OBJECTID', 'Interner Objektidentifikator (ArcGIS).', 'INTEGER', 'PK'))
    for a in attrs_of(o):
        n = re.sub(r'[^A-Z0-9]+', '_', a['name'].replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('Ä', 'Ae').replace('Ö', 'Oe').replace('Ü', 'Ue').upper()).strip('_')
        fields.append((n, a['description'], SQL_TYPE[a['valueType']], a['keyRole']))
    if t['system'] == 'sap':
        fields += [('ERDAT', 'Datum der Anlage.', 'DATE', None), ('ERNAM', 'Anlegender Benutzer.', 'VARCHAR(12)', None),
                   ('AEDAT', 'Datum der letzten Änderung.', 'DATE', None), ('AENAM', 'Ändernder Benutzer.', 'VARCHAR(12)', None)]
    else:
        fields += [('SHAPE', 'Geometrie (LV95, EPSG:2056).', 'GEOMETRY', None), ('CREATED_DATE', 'Datum der Erfassung.', 'DATE', None),
                   ('LAST_EDITED_DATE', 'Datum der letzten Bearbeitung.', 'DATE', None), ('LAST_EDITED_USER', 'Letzter Bearbeiter.', 'VARCHAR(50)', None)]
    return [dict(name=n, description=d, dataType=ty, keyRole=k) for n, d, ty, k in fields]

# ---------------------------------------------------------------- reference data (code lists)
REFS = [
    dict(id='r-gwr-kat', name='GWR Gebäudekategorie', source='GWR / eCH', obj='gebaeude', status='Gültig', desc='Kategorie eines Gebäudes gemäss GWR Merkmalskatalog 2023.'),
    dict(id='r-gwr-status', name='GWR Gebäudestatus', source='GWR / eCH', obj='gebaeude', status='Gültig', desc='Lebenszyklusstatus eines Gebäudes im GWR.'),
    dict(id='r-gwr-heiz', name='GWR Heizungsart', source='GWR / eCH', obj='heizzentrale', status='Gültig', desc='Art der Wärmeerzeugung gemäss GWR.'),
    dict(id='r-kanton', name='Kanton', source='GWR / eCH', obj='grundstueck', status='Gültig', desc='Kantonskürzel gemäss eCH-0007.'),
    dict(id='r-sia-nutz', name='SIA Nutzungsart', source='SIA', obj='nutzungseinheit', status='Gültig', desc='Nutzungsart einer Fläche gemäss SIA 416.'),
    dict(id='r-sia-flaeche', name='SIA 416 Flächenart', source='SIA', obj='bemessung', status='Gültig', desc='Flächenarten (GF, NF, HNF, …) gemäss SIA 416.'),
    dict(id='r-geak', name='GEAK Effizienzklasse', source='GEAK', obj='gebaeude', status='Entwurf', desc='Energieeffizienzklasse A–G gemäss GEAK.'),
    dict(id='r-kond', name='Konditionsart', source='BBL intern', obj='kondition', status='Gültig', desc='Art einer Mietkondition (Nettomiete, Nebenkosten, …).'),
    dict(id='r-vertrag', name='Vertragsart', source='BBL intern', obj='mietvertrag', status='Entwurf', desc='Typ eines Mietvertrags.'),
    dict(id='r-zaehler', name='Zählertyp', source='BBL intern', obj='stromzaehler', status='Entwurf', desc='Typ eines Energiezählers.'),
    dict(id='r-geschoss', name='Geschosstyp', source='BBL intern', obj='geschoss', status='Gültig', desc='Typ eines Geschosses (UG, EG, OG, DG, …).'),
    dict(id='r-raum', name='Raumtyp', source='BBL intern', obj='raum', status='Gültig', desc='Funktionaler Raumtyp.'),
    dict(id='r-eigentum', name='Eigentumsform', source='BBL intern', obj='grundstueck', status='Entwurf', desc='Eigentumsverhältnis eines Grundstücks.'),
    dict(id='r-energie', name='Energieträger', source='BBL intern', obj='heizzentrale', status='Gültig', desc='Hauptenergieträger einer Heizzentrale.'),
    dict(id='r-waehrung', name='Währung', source='BBL intern', obj='kondition', status='Gültig', desc='ISO-4217 Währungscode.'),
]
REF_VALUES = {
    'r-gwr-kat': [('1010', 'Einfamilienhaus'), ('1020', 'Zweifamilienhaus'), ('1030', 'Mehrfamilienhaus'), ('1060', 'Gebäude mit teilw. Wohnnutzung'), ('1110', 'Bürogebäude'), ('1230', 'Gebäude für Bildung und Forschung')],
    'r-gwr-status': [('1001', 'Projektiert'), ('1002', 'Bewilligt'), ('1003', 'Im Bau'), ('1004', 'Bestehend'), ('1005', 'Nicht nutzbar'), ('1007', 'Abgebrochen'), ('1008', 'Nicht realisiert')],
    'r-gwr-heiz': [('7400', 'Kein Wärmeerzeuger'), ('7410', 'Wärmepumpe für ein Gebäude'), ('7411', 'Wärmepumpe für mehrere Gebäude'), ('7420', 'Thermische Solaranlage für ein Gebäude'), ('7430', 'Heizkessel (generisch) für ein Gebäude'), ('7431', 'Heizkessel nicht kondensierend'), ('7432', 'Heizkessel kondensierend'), ('7433', 'Heizkessel für mehrere Gebäude'), ('7436', 'Ofen'), ('7440', 'Wärmekraftkopplungsanlage'), ('7450', 'Elektrospeicher-Zentralheizung'), ('7460', 'Wärmetauscher (inkl. Fernwärme)')],
    'r-kanton': [(c, n) for c, n in [('ZH', 'Zürich'), ('BE', 'Bern'), ('LU', 'Luzern'), ('UR', 'Uri'), ('SZ', 'Schwyz'), ('OW', 'Obwalden'), ('NW', 'Nidwalden'), ('GL', 'Glarus'), ('ZG', 'Zug'), ('FR', 'Freiburg'), ('SO', 'Solothurn'), ('BS', 'Basel-Stadt'), ('BL', 'Basel-Landschaft'), ('SH', 'Schaffhausen'), ('AR', 'Appenzell Ausserrhoden'), ('AI', 'Appenzell Innerrhoden'), ('SG', 'St. Gallen'), ('GR', 'Graubünden'), ('AG', 'Aargau'), ('TG', 'Thurgau'), ('TI', 'Tessin'), ('VD', 'Waadt'), ('VS', 'Wallis'), ('NE', 'Neuenburg'), ('GE', 'Genf'), ('JU', 'Jura')]],
    'r-sia-nutz': [('BU', 'Büro'), ('WO', 'Wohnen'), ('VK', 'Verkauf'), ('LA', 'Lager'), ('PR', 'Produktion'), ('SC', 'Schule'), ('LB', 'Labor'), ('PK', 'Parkierung'), ('SO', 'Sonstiges')],
    'r-sia-flaeche': [('GF', 'Geschossfläche'), ('KF', 'Konstruktionsfläche'), ('NGF', 'Nettogeschossfläche'), ('NF', 'Nutzfläche'), ('HNF', 'Hauptnutzfläche'), ('NNF', 'Nebennutzfläche'), ('VF', 'Verkehrsfläche'), ('FF', 'Funktionsfläche')],
    'r-geak': [('A', 'Sehr effizient'), ('B', 'Effizient'), ('C', 'Gut'), ('D', 'Mittel'), ('E', 'Unterdurchschnittlich'), ('F', 'Schlecht'), ('G', 'Sehr schlecht')],
    'r-kond': [('NM', 'Nettomiete'), ('NK', 'Nebenkosten akonto'), ('NP', 'Nebenkosten pauschal'), ('KA', 'Kaution'), ('RB', 'Rabatt')],
    'r-vertrag': [],
    'r-zaehler': [],
    'r-geschoss': [('UG', 'Untergeschoss'), ('EG', 'Erdgeschoss'), ('ZG', 'Zwischengeschoss'), ('OG', 'Obergeschoss'), ('DG', 'Dachgeschoss'), ('AG', 'Attikageschoss')],
    'r-raum': [('BUE', 'Büro'), ('SIZ', 'Sitzungszimmer'), ('ARC', 'Archiv'), ('LAG', 'Lager'), ('TEC', 'Technikraum'), ('SAN', 'Sanitärraum'), ('KOR', 'Korridor'), ('KUE', 'Küche'), ('LAB', 'Labor'), ('WER', 'Werkstatt'), ('GAR', 'Garage')],
    'r-eigentum': [],
    'r-energie': [('OEL', 'Heizöl'), ('GAS', 'Erdgas'), ('FW', 'Fernwärme'), ('HOLZ', 'Holz'), ('WP', 'Wärmepumpe'), ('EL', 'Elektrisch')],
    'r-waehrung': [('CHF', 'Schweizer Franken'), ('EUR', 'Euro'), ('USD', 'US-Dollar')],
}

# ---------------------------------------------------------------- data products & APIs
PRODUCTS = [
    dict(id='p-gebaeudebestand', name='Gebäudebestand Bund', domain='bau', objs=['gebaeude', 'grundstueck', 'areal'], tables=['t-geb-sap', 't-geb-gis', 't-parzelle'], apis=['api-immo'], status='Gültig', access='intern (eIAM)', license='BBL intern', format='Parquet, CSV, GeoJSON', refresh='täglich', date='2026-04-15', attrs=[('EGID', 'Eidgenössischer Gebäudeidentifikator', 'Ganzzahl'), ('Bezeichnung', 'Gebäudename', 'Text'), ('Adresse', 'Strasse, PLZ, Ort', 'Text'), ('Baujahr', 'Jahr der Fertigstellung', 'Ganzzahl'), ('Geometrie', 'Gebäudegrundriss (LV95)', 'Geometrie')], desc='Konsolidierter Bestand aller Gebäude und Grundstücke im Eigentum des Bundes mit Adresse, GWR-Attributen und Geometrie. Zusammenführung aus SAP RE-FX und GIS IMMO.'),
    dict(id='p-flaechen', name='Flächen und Bemessungen', domain='bau', objs=['bemessung', 'geschoss', 'nutzungseinheit'], tables=['t-bem'], apis=['api-immo'], status='Gültig', access='intern (eIAM)', license='BBL intern', format='Parquet, CSV', refresh='monatlich', date='2026-04-01', attrs=[], desc='Flächenkennwerte nach SIA 416 je Gebäude, Geschoss und Nutzungseinheit als Grundlage für Flächenmanagement und Benchmarks.'),
    dict(id='p-energie', name='Energieverbrauch Liegenschaften', domain='energie', objs=['heizzentrale', 'stromzaehler', 'betriebsmesswert'], tables=[], apis=['api-energie'], status='Entwurf', access='intern (eIAM)', license='BBL intern', format='Parquet, CSV', refresh='monatlich', date='2026-02-03', attrs=[('EGID', 'Gebäude', 'Ganzzahl'), ('Periode', 'Monat (YYYY-MM)', 'Text'), ('Energieträger', 'gemäss Werteliste', 'Code'), ('Verbrauch', 'kWh', 'Dezimal')], desc='Monatliche Wärme- und Stromverbräuche je Gebäude, aggregiert aus Zählerdaten. Grundlage für RUMBA-Reporting und Energiestrategie.'),
    dict(id='p-mietportfolio', name='Mietportfolio', domain='miete', objs=['mietobjekt', 'mietvertrag', 'kondition'], tables=['t-mo', 't-mv'], apis=['api-immo'], status='Gültig', access='eingeschränkt (Rollen)', license='BBL intern', format='Parquet', refresh='täglich', date='2026-03-12', attrs=[], desc='Vermietete Objekte mit Vertragslaufzeiten und Konditionen für Portfolio-Steuerung. Enthält Personendaten; Zugriff rollenbasiert.'),
    dict(id='p-opendata', name='Bundesimmobilien (Open Data)', domain='bau', objs=['gebaeude', 'grundstueck'], tables=['t-geb-gis', 't-parzelle'], apis=['api-opendata'], status='Gültig', access='öffentlich', license='opendata.swiss BY', format='CSV, GeoJSON', refresh='quartalsweise', date='2026-04-01', attrs=[('EGID', 'Gebäudeidentifikator', 'Ganzzahl'), ('Gemeinde', 'BFS-Gemeindename', 'Text'), ('Nutzung', 'Hauptnutzung', 'Code')], desc='Öffentliche Liste der zivilen Bundesbauten mit Standort und Hauptnutzung, publiziert auf opendata.swiss gemäss DCAT-AP CH.'),
]
APIS = [
    dict(id='api-immo', name='Immobilien-API', version='v2.3', system='sap', domain='bau', status='Gültig', access='intern (eIAM)', protocol='REST · OpenAPI 3.1', base='https://api.bbl.admin.ch/immo/v2', docs='https://api.bbl.admin.ch/immo/v2/docs', date='2026-04-20', desc='Lesender Zugriff auf Gebäude, Grundstücke, Mietobjekte und Verträge aus SAP RE-FX.'),
    dict(id='api-geo', name='Geo-API Bundesimmobilien', version='v1.8', system='gis', domain='bau', status='Gültig', access='intern (eIAM)', protocol='OGC API Features', base='https://geo.bbl.admin.ch/ogc', docs='https://geo.bbl.admin.ch/ogc/docs', date='2025-12-02', desc='Geometrien und Sachdaten zu Gebäuden, Grundstücken und Bodenbedeckung als OGC API Features.'),
    dict(id='api-energie', name='Energie-API', version='v0.9', system='gis', domain='energie', status='Entwurf', access='intern (eIAM)', protocol='REST · OpenAPI 3.1', base='https://api.bbl.admin.ch/energie/v1', docs='https://api.bbl.admin.ch/energie/v1/docs', date='2026-02-03', desc='Zählerstände und Betriebsmesswerte je Gebäude und Periode. Pilotbetrieb.'),
    dict(id='api-opendata', name='Open-Data-Schnittstelle', version='v1.0', system='gis', domain='bau', status='Gültig', access='öffentlich', protocol='DCAT-AP CH · SPARQL', base='https://opendata.swiss/api', docs='https://handbook.opendata.swiss/de/', date='2026-04-01', desc='Publikation der offenen Datenprodukte des BBL über opendata.swiss und I14Y.'),
]

# ---------------------------------------------------------------- core builder
def core(kind, e):
    obj = e if kind == 'objects' else obj_of[e['obj']] if kind in ('tables', 'refs') else None
    dom = e if kind == 'domains' else None if kind == 'systems' else domain_of[e['domain']] if kind in ('products', 'apis') else domain_of[obj['domain']]
    if dom and dom.get('localDraft') and kind in ('domains', 'objects'):
        return dict(identifier=e['id'], name=e['name'], description=e['desc'], status='Entwurf',
                    version='0.1', created=dom['date'], modified=dom['date'], responsibleOrg=dom['resp'],
                    source='Prototyp', sourceDetail='Fachlicher Entwurf für Projekt Management; Attribute und Pflichtangaben sind Modellierungsbeispiele.')
    owner = dom['owner'] if dom else e['owner']
    steward = dom['steward'] if dom else e['steward']
    if obj:
        classification = CLASSIFICATION.get(obj['id'], 'intern')
    elif kind in ('products', 'apis') and e['access'] == 'öffentlich':
        classification = 'öffentlich'
    elif kind == 'products' and any(CLASSIFICATION.get(o) == 'vertraulich' for o in e['objs']):
        classification = 'vertraulich'
    else:
        classification = 'intern'
    personal = obj['id'] in PERSONAL if obj else any(o in PERSONAL for o in e['objs']) if kind == 'products' else (kind == 'systems' and e['id'] == 'sap')
    technical_asset = kind in ('tables', 'systems')
    status = 'Entwurf'  # All fictional baseline records are drafts; the GWR import sets official records to Gültig.
    return dict(
        identifier=e['id'], name=e['name'], description=e['desc'],
        status=status,
        version=e.get('version') or ('2023.1' if kind == 'refs' else '2025.12' if technical_asset else '2024.1'),
        created='2022-01-14' if technical_asset else '2021-09-03',
        modified=e.get('date') or ('2026-02-03' if status == 'Entwurf' else '2024-06-01'),
        responsibleOrg=e.get('resp') or dom['resp'],
        dataOwner=owner, dataSteward=steward,
        classification=classification, personalData=bool(personal),
        source='Architektur-Repository',
        sourceDetail='Innovator / smartfacts',
        synced='2024-06-01',
    )

# ---------------------------------------------------------------- emit
domains = []
for d in DOMAINS:
    c = core('domains', d)
    if d['resp'] in CONTACT:
        c.update(contact=CONTACT[d['resp']])
    domains.append(c)
dump('domains.json', domains)

systems = []
for s in SYSTEMS:
    c = core('systems', s)
    c.update(technology=s['tech'], dataCustodian=s['resp'], contact=CONTACT[s['resp']])
    systems.append(c)
dump('systems.json', systems)

objects = []
for o in OBJECTS:
    c = core('objects', o)
    c.update(domain=o['domain'], normReference=o['norm'],
             termdat=[dict(name=n, id=i, url='https://www.termdat.bk.admin.ch/entry/%d' % i) for n, i in TERMS.get(o['id'], [])],
             attributes=attrs_of(o))
    if o.get('sourceUrl'):
        c.update(sourceUrl=o['sourceUrl'], sourceDetail='Definition wörtlich aus dem GWR-Merkmalskatalog 5.0.0; Attribute und Pflichtangaben sind lokale Modellierungsbeispiele.')
    objects.append(c)
dump('objects.json', objects)

tables = []
for t in TABLES:
    c = core('tables', t)
    c.update(technicalName=t['tech'], system=t['system'], realizes=t.get('realizes', t['obj']), fields=fields_of(t))
    if t.get('dataCustodian'):
        c['dataCustodian'] = t['dataCustodian']
    tables.append(c)
dump('tables.json', tables)

refs = []
for r in REFS:
    c = core('refs', r)
    c.update(sourceAuthority=r['source'], businessObject=r['obj'],
             values=[dict(code=code, label=label) for code, label in REF_VALUES[r['id']]])
    refs.append(c)
dump('codelists.json', refs)

products = []
for p in PRODUCTS:
    c = core('products', p)
    c.update(domain=p['domain'], accessRights=p['access'], license=p['license'], format=p['format'], accrualPeriodicity=p['refresh'],
             basedOn=p['objs'], sourcedFrom=p['tables'], servedBy=p['apis'],
             attributes=[dict(name=n, description=d, valueType=t) for n, d, t in p['attrs']])
    products.append(c)
dump('products.json', products)

apis = []
for a in APIS:
    c = core('apis', a)
    c.update(version=a['version'], domain=a['domain'], system=a['system'], protocol=a['protocol'], endpointURL=a['base'],
             documentation=a['docs'], accessRights=a['access'])
    apis.append(c)
dump('apis.json', apis)

# change log (mock, one block per entity)
KIND_LABEL = dict(objects='Geschäftsobjekt', tables='Datentabelle', refs='Werteliste', domains='Domäne', systems='System', products='Datenprodukt', apis='API')
ROWS_WORD = dict(objects='Attribute', tables='Felder', refs='Werte', domains='Geschäftsobjekte', systems='Datentabellen', products='Attribute', apis='Endpunkte')
changelog = []
def rows_count(kind, c):
    if kind == 'objects': return len(c['attributes'])
    if kind == 'tables': return len(c['fields'])
    if kind == 'refs': return len(c['values'])
    if kind == 'products': return len(c['attributes'])
    if kind == 'domains': return sum(1 for o in OBJECTS if o['domain'] == c['identifier'])
    if kind == 'systems': return sum(1 for t in TABLES if t['system'] == c['identifier'])
    return 0
for kind, lst in [('domains', domains), ('systems', systems), ('objects', objects), ('tables', tables), ('refs', refs), ('products', products), ('apis', apis)]:
    for c in lst:
        if c['source'] == 'Prototyp':
            changelog.append(dict(entity=kind + ':' + c['identifier'], date=c['created'], action='Erstellt', detail=KIND_LABEL[kind] + ' als Entwurf für Projekt Management angelegt.', user='Prototyp'))
            continue
        who = [c['dataSteward'], c['dataOwner'], 'Nadia Ferrari']
        key = kind + ':' + c['identifier']
        n = rows_count(kind, c)
        entries = [
            dict(date=c['modified'], action='Abgeglichen', detail='Abgleich mit Architektur-Repository (Innovator / smartfacts)', user='System'),
            dict(date='2026-02-03', action='Beschreibung geändert', detail='Beschreibung präzisiert und Normreferenz ergänzt', user=who[0]),
            dict(date='2024-06-01', action='Status geändert', detail='Entwurf → ' + c['status'], user=who[1]),
        ]
        if n and kind != 'apis':
            entries.append(dict(date='2024-03-12', action=ROWS_WORD[kind] + ' ergänzt', detail='%d %s erfasst' % (n, ROWS_WORD[kind]), user=who[0]))
        entries.append(dict(date='2024-02-01', action='Erstellt', detail=KIND_LABEL[kind] + ' im Katalog angelegt', user=who[2]))
        for e in entries:
            changelog.append(dict(entity=key, **e))
dump('changelog.json', changelog)
print('done')
