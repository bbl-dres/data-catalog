-- =============================================================================
-- BBL Datenkatalog – Seed / Test Data
-- Version: 0.3 (draft)
-- Generated for: SQLite (sql.js in-browser)
-- Domain: Swiss Federal Office for Buildings and Logistics (BBL)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USERS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "user" (id, name, email, catalog_role, preferred_language, department, active, created_at) VALUES
  ('uuid-user-001', 'Stefan Müller',    'stefan.müller@bbl.admin.ch',   'admin',   'de', 'DRES – Digital Solutions',       1,'2024-01-15T07:00:00Z'),
  ('uuid-user-002', 'Claudia Bernasconi','claudia.bernasconi@bbl.admin.ch','steward','de', 'DRES – Portfoliomanagement',    1,'2024-02-01T08:00:00Z'),
  ('uuid-user-003', 'Marc Favre',        'marc.favre@bbl.admin.ch',      'steward', 'fr', 'DRES – Bewirtschaftung',         1,'2024-02-10T09:00:00Z'),
  ('uuid-user-004', 'Anna Keller',       'anna.keller@bbl.admin.ch',     'analyst', 'de', 'DRES – Energie & Nachhaltigkeit',1, '2024-03-01T07:30:00Z'),
  ('uuid-user-005', 'Luca Bentivoglio',  'luca.bentivoglio@bbl.admin.ch','viewer',  'it', 'DRES – Digital Solutions',       1,'2024-03-15T08:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CONTACTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO contact (id, name, email, phone, organisation, role, user_id) VALUES
  ('uuid-contact-001', 'Stefan Müller',      'stefan.müller@bbl.admin.ch',    '+41 58 462 11 01', 'BBL – DRES Digital Solutions',       'data_owner',             'uuid-user-001'),
  ('uuid-contact-002', 'Claudia Bernasconi', 'claudia.bernasconi@bbl.admin.ch','+41 58 462 11 02', 'BBL – DRES Portfoliomanagement',     'data_steward',           'uuid-user-002'),
  ('uuid-contact-003', 'Marc Favre',         'marc.favre@bbl.admin.ch',        '+41 58 462 11 03', 'BBL – DRES Bewirtschaftung',         'data_steward',           'uuid-user-003'),
  ('uuid-contact-004', 'Anna Keller',        'anna.keller@bbl.admin.ch',       '+41 58 462 11 04', 'BBL – DRES Energie & Nachhaltigkeit','subject_matter_expert',  'uuid-user-004'),
  ('uuid-contact-005', 'Thomas Wyss',        'thomas.wyss@bbl.admin.ch',       '+41 58 462 11 05', 'BBL – DRES Informatik',              'data_custodian',         NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VOCABULARY
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO vocabulary (id, name_en, name_de, name_fr, name_it, description, version, homepage, publisher, status, created_at, modified_at) VALUES
  ('uuid-vocab-001',
   'BBL Real Estate Vocabulary',
   'BBL Immobilien-Fachbegriffe',
   'Vocabulaire immobilier OFC',
   'Vocabolario immobiliare UFCL',
   '{"en": "Authoritative vocabulary of real estate business terms used by the Swiss Federal Office for Buildings and Logistics (BBL). Covers building hierarchy, tenant management, energy, and business partners.", "de": "Massgebliches Vokabular der Immobilien-Fachbegriffe des Bundesamts für Bauten und Logistik (BBL). Umfasst Gebäudehierarchie, Mietermanagement, Energie und Geschäftspartner.", "fr": "Vocabulaire de reference des termes immobiliers de l''Office federal des constructions et de la logistique (OFCL). Couvre la hierarchie des batiments, la gestion des locataires, l''energie et les partenaires commerciaux.", "it": "Vocabolario di riferimento dei termini immobiliari dell''Ufficio federale delle costruzioni e della logistica (UFCL). Comprende la gerarchia degli edifici, la gestione degli inquilini, l''energia e i partner commerciali."}',
   '1.0.0',
   'https://data.bbl.admin.ch/vocabulary/immobilien',
   'DRES – Digital Solutions',
   'active',
   '2024-01-15T07:00:00Z',
   '2024-09-01T08:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. COLLECTIONS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO collection (id, vocabulary_id, parent_collection_id, name_en, name_de, name_fr, name_it, description, sort_order) VALUES
  ('uuid-coll-001', 'uuid-vocab-001', NULL,
   'Architectural View',  'Architektonische Sicht',  'Vue architecturale',      'Vista architettonica',
   '{"en": "Physical building hierarchy: sites, campuses, parcels, buildings, floors, rooms, occupancy units, and dimensional assessments.", "de": "Physische Gebäudehierarchie: Areale, Campusse, Grundstücke, Gebäude, Geschosse, Räume, Nutzungseinheiten und Bemessungen."}',
   1),
  ('uuid-coll-002', 'uuid-vocab-001', NULL,
   'Tenant Management',   'Mieter Management',       'Gestion des locataires',  'Gestione inquilini',
   '{"en": "Concepts related to rental units, lease agreements, and contractual conditions.", "de": "Konzepte rund um Mietobjekte, Mietverträge und vertragliche Konditionen."}',
   2),
  ('uuid-coll-003', 'uuid-vocab-001', NULL,
   'Energy',              'Energie',                 'Energie',                 'Energia',
   '{"en": "Concepts related to energy management, heating plants, metering, and operational measurements.", "de": "Konzepte rund um Energiemanagement, Heizzentralen, Zähler und Betriebsmesswerte."}',
   3),
  ('uuid-coll-004', 'uuid-vocab-001', NULL,
   'Business Partners',   'Geschäftspartner',       'Partenaires commerciaux', 'Partner commerciali',
   '{"en": "People, contacts, and organizations relevant to real estate management.", "de": "Personen, Kontakte und Unternehmen im Immobilienmanagement."}',
   4),
  ('uuid-coll-005', 'uuid-vocab-001', NULL,
   'Finance',             'Finanzen',                'Finances',                'Finanze',
   '{"en": "Financial organizational units and accounting structures for real estate management.", "de": "Finanzielle Organisationseinheiten und Buchhaltungsstrukturen für das Immobilienmanagement."}',
   5);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CONCEPTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO concept (id, vocabulary_id, collection_id, name_en, name_de, name_fr, name_it, alt_names, definition, scope_note, status, standard_ref, egid_relevant, egrid_relevant, steward_id, approved_at, created_at, modified_at) VALUES

  -- Architektonische Sicht (8 concepts)
  ('uuid-concept-001', 'uuid-vocab-001', 'uuid-coll-001',
   'Site', 'Areal', 'Site', 'Sito',
   '{"de": ["Standort", "Campus-Areal"], "fr": ["Terrain"]}',
   '{"en": "A defined area of land comprising one or more parcels, typically a federal campus or complex.", "de": "Ein definiertes Landareal bestehend aus einer oder mehreren Parzellen, typischerweise ein Bundeskampus oder eine Anlage.", "fr": "Un terrain defini comprenant une ou plusieurs parcelles, generalement un campus ou un complexe federal.", "it": "Un''area definita di terreno comprendente una o piu particelle, tipicamente un campus o un complesso federale."}',
   '{"de": "Im BBL-Kontext umfasst ein Areal das gesamte zusammenhängende Gelände einer Bundesanlage."}',
   'approved', 'VILB, eCH-0071', 0, 1,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-02-01T07:00:00Z', '2024-06-01T08:00:00Z'),

  ('uuid-concept-002', 'uuid-vocab-001', 'uuid-coll-001',
   'Campus', 'Kampus', 'Campus', 'Campus',
   '{"de": ["Bundeskampus"]}',
   '{"en": "A grouped set of buildings forming a functional unit, e.g. federal campus Zollikofen.", "de": "Eine zusammengehörende Gruppe von Gebäuden, die eine funktionale Einheit bilden, z.B. Bundeskampus Zollikofen.", "fr": "Un ensemble groupe de batiments formant une unite fonctionnelle, p. ex. campus federal de Zollicofen.", "it": "Un insieme raggruppato di edifici che formano un''unita funzionale, ad es. campus federale di Zollicofen."}',
   NULL,
   'approved', 'VILB Anhang A', 0, 0,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-02-01T07:30:00Z', '2024-06-01T08:00:00Z'),

  ('uuid-concept-003', 'uuid-vocab-001', 'uuid-coll-001',
   'Land Parcel', 'Grundstück', 'Bien-fonds', 'Fondo',
   '{"de": ["Parzelle"]}',
   '{"en": "A legally registered parcel of land in the Grundbuch, identified by an EGRID.", "de": "Ein im Grundbuch eingetragenes, rechtlich definiertes Stück Land, identifiziert durch eine EGRID.", "fr": "Une parcelle de terrain juridiquement definie, inscrite au registre foncier et identifiee par un EGRID.", "it": "Una parcella di terreno definita giuridicamente, iscritta nel registro fondiario e identificata da un EGRID."}',
   NULL,
   'approved', 'ZGB Art. 655, eCH-0071', 0, 1,
   'uuid-user-002', '2024-06-15T07:00:00Z',
   '2024-02-05T08:00:00Z', '2024-06-15T07:00:00Z'),

  ('uuid-concept-004', 'uuid-vocab-001', 'uuid-coll-001',
   'Building', 'Gebäude', 'Batiment', 'Edificio',
   '{"de": ["Bauwerk", "Bau"], "fr": ["Construction"]}',
   '{"en": "A permanent roofed structure identified in the GWR (Federal Register of Buildings and Dwellings) by an EGID.", "de": "Ein dauerhaftes, überdachtes Bauwerk, das im eidgenössischen Gebäude- und Wohnungsregister (GWR) erfasst und durch eine EGID identifiziert wird.", "fr": "Une construction permanente couverte enregistree dans le RegBL et identifiee par un EGID.", "it": "Una costruzione permanente coperta registrata nel REA e identificata da un EGID."}',
   '{"de": "Im BBL-Kontext umfasst Gebäude ausschliesslich Bauwerke im Eigentum oder in der Verwaltung des Bundes."}',
   'approved', 'eCH-0071 v2.0, GWR', 1, 0,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-02-01T08:00:00Z', '2024-06-01T08:00:00Z'),

  ('uuid-concept-005', 'uuid-vocab-001', 'uuid-coll-001',
   'Occupancy Unit', 'Nutzungseinheit', 'Unite d''utilisation', 'Unita d''uso',
   '{"de": ["NE"]}',
   '{"en": "A self-contained area within a building used for a single purpose, classified per SIA 416.", "de": "Ein in sich geschlossener Bereich innerhalb eines Gebäudes, der einem einzigen Zweck dient, klassifiziert nach SIA 416.", "fr": "Un espace autonome a l''interieur d''un batiment, utilise a un seul usage, classe selon SIA 416.", "it": "Un''area autonoma all''interno di un edificio utilizzata per un unico scopo, classificata secondo SIA 416."}',
   NULL,
   'approved', 'SIA 416 p3', 1, 0,
   'uuid-user-003', '2024-07-15T08:00:00Z',
   '2024-03-05T08:00:00Z', '2024-07-15T08:00:00Z'),

  ('uuid-concept-006', 'uuid-vocab-001', 'uuid-coll-001',
   'Floor', 'Geschoss', 'Etage', 'Piano',
   '{"de": ["Stockwerk", "Niveau"], "fr": ["Niveau"]}',
   '{"en": "A horizontal level within a building, measured according to SIA 416.", "de": "Eine horizontale Ebene innerhalb eines Gebäudes, gemessen nach SIA 416.", "fr": "Un niveau horizontal a l''interieur d''un batiment, mesure selon SIA 416.", "it": "Un livello orizzontale all''interno di un edificio, misurato secondo SIA 416."}',
   NULL,
   'approved', 'SIA 416', 1, 0,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-02-10T07:00:00Z', '2024-06-01T08:00:00Z'),

  ('uuid-concept-007', 'uuid-vocab-001', 'uuid-coll-001',
   'Room', 'Raum', 'Local', 'Locale',
   '{"de": ["Zimmer"]}',
   '{"en": "An individual enclosed space within a floor, identified by a room number.", "de": "Ein einzelner umschlossener Raum innerhalb eines Geschosses, identifiziert durch eine Raumnummer.", "fr": "Un espace individuel ferme a l''interieur d''un etage, identifie par un numero de local.", "it": "Uno spazio individuale chiuso all''interno di un piano, identificato da un numero di locale."}',
   NULL,
   'approved', 'SIA 416 p4', 1, 0,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-02-10T08:00:00Z', '2024-06-01T08:00:00Z'),

  ('uuid-concept-008', 'uuid-vocab-001', 'uuid-coll-001',
   'Dimensional Assessment', 'Bemessung', 'Evaluation dimensionnelle', 'Valutazione dimensionale',
   '{"de": ["Flächenberechnung", "Volumenberechnung"]}',
   '{"en": "Calculated area and volume metrics for a building or unit (gross floor area, usable area, etc.) according to SIA 416.", "de": "Berechnete Flächen- und Volumenkennwerte für ein Gebäude oder eine Einheit (Geschossfläche, Nutzfläche etc.) nach SIA 416.", "fr": "Metriques de surface et de volume calculees pour un batiment ou une unite (surface de plancher, surface utile, etc.) selon SIA 416.", "it": "Metriche calcolate di superficie e volume per un edificio o un''unita (superficie di piano, superficie utile, ecc.) secondo SIA 416."}',
   NULL,
   'approved', 'SIA 416 p3.6', 0, 0,
   'uuid-user-004', '2024-08-01T07:00:00Z',
   '2024-04-10T06:00:00Z', '2024-08-01T07:00:00Z'),

  -- Mieter Management (3 concepts)
  ('uuid-concept-009', 'uuid-vocab-001', 'uuid-coll-002',
   'Rental Unit', 'Mietobjekt', 'Objet locatif', 'Oggetto in locazione',
   '{"de": ["MO", "Mieteinheit"], "fr": ["Unite locative"]}',
   '{"en": "A rentable unit within a building managed by BBL, corresponding to a business entity in SAP RE-FX.", "de": "Eine vermietbare Einheit innerhalb eines Gebäudes, verwaltet durch das BBL, entsprechend einer Wirtschaftseinheit in SAP RE-FX.", "fr": "Une unite louable dans un batiment gere par l''OFCL, correspondant a une entite economique dans SAP RE-FX.", "it": "Un''unita affittabile all''interno di un edificio gestito dall''UFCL, corrispondente a un''entita economica in SAP RE-FX."}',
   '{"de": "Ein Mietobjekt kann aus mehreren Nutzungseinheiten bestehen."}',
   'approved', 'VILB Anhang A', 1, 0,
   'uuid-user-003', '2024-07-01T08:00:00Z',
   '2024-03-01T07:00:00Z', '2024-07-01T08:00:00Z'),

  ('uuid-concept-010', 'uuid-vocab-001', 'uuid-coll-002',
   'Lease Agreement', 'Mietvertrag', 'Contrat de bail', 'Contratto di locazione',
   '{"de": ["MV", "Mietkontrakt"]}',
   '{"en": "A contractual agreement for the use of a rental object between the Confederation and a counterparty.", "de": "Ein rechtsverbindlicher Vertrag zwischen dem Bund und einer Gegenpartei über die Nutzung eines Mietobjekts.", "fr": "Un contrat juridiquement contraignant entre la Confederation et une contrepartie pour l''utilisation d''un objet locatif.", "it": "Un contratto giuridicamente vincolante tra la Confederazione e una controparte per l''uso di un oggetto in locazione."}',
   NULL,
   'draft', 'OR Art. 253ff', 0, 0,
   'uuid-user-003', NULL,
   '2024-04-01T06:00:00Z', '2024-08-01T08:00:00Z'),

  ('uuid-concept-011', 'uuid-vocab-001', 'uuid-coll-002',
   'Condition', 'Kondition', 'Condition', 'Condizione',
   '{"de": ["Vertragskondition", "Mietkondition"]}',
   '{"en": "Financial and contractual conditions of a lease: rent, operating costs, indexation, and deposits.", "de": "Finanzielle und vertragliche Konditionen eines Mietvertrags: Mietzins, Nebenkosten, Indexierung und Kautionen.", "fr": "Conditions financieres et contractuelles d''un bail: loyer, charges, indexation et depots.", "it": "Condizioni finanziarie e contrattuali di una locazione: canone, spese accessorie, indicizzazione e depositi."}',
   NULL,
   'draft', 'OR Art. 269ff', 0, 0,
   'uuid-user-003', NULL,
   '2024-04-15T06:00:00Z', '2024-08-15T08:00:00Z'),

  -- Energie (3 concepts)
  ('uuid-concept-012', 'uuid-vocab-001', 'uuid-coll-003',
   'Heating Plant', 'Heizzentrale', 'Centrale de chauffage', 'Centrale termica',
   '{"de": ["HZ", "Wärmeerzeugung"]}',
   '{"en": "Central heating system serving one or more buildings, classified by energy source (oil, gas, heat pump, district heating).", "de": "Zentrale Heizungsanlage für ein oder mehrere Gebäude, klassifiziert nach Energieträger (Öl, Gas, Wärmepumpe, Fernwärme).", "fr": "Systeme de chauffage central desservant un ou plusieurs batiments, classe par source d''energie.", "it": "Sistema di riscaldamento centrale che serve uno o piu edifici, classificato per fonte energetica."}',
   NULL,
   'approved', 'SIA 380/1, EnDK', 0, 0,
   'uuid-user-004', '2024-08-01T07:00:00Z',
   '2024-04-20T06:00:00Z', '2024-08-01T07:00:00Z'),

  ('uuid-concept-013', 'uuid-vocab-001', 'uuid-coll-003',
   'Electricity Meter', 'Stromzähler', 'Compteur electrique', 'Contatore elettrico',
   '{"de": ["Zähler", "E-Zähler"]}',
   '{"en": "Metering device for electricity consumption within a building or building part.", "de": "Messgerät für den Stromverbrauch innerhalb eines Gebäudes oder Gebäudeteils.", "fr": "Dispositif de mesure de la consommation d''electricite dans un batiment ou partie de batiment.", "it": "Dispositivo di misura del consumo di elettricita in un edificio o parte di edificio."}',
   NULL,
   'approved', 'StromVV, ElCom', 0, 0,
   'uuid-user-004', '2024-08-15T07:00:00Z',
   '2024-05-01T06:00:00Z', '2024-08-15T07:00:00Z'),

  ('uuid-concept-014', 'uuid-vocab-001', 'uuid-coll-003',
   'Operational Measurement', 'Betriebsmesswert', 'Valeur de mesure operationnelle', 'Valore di misura operativo',
   '{"de": ["Messwert", "Verbrauchswert"]}',
   '{"en": "A recorded energy or resource consumption value from a metering device at a specific point in time.", "de": "Ein erfasster Energie- oder Ressourcenverbrauchswert eines Messgeräts zu einem bestimmten Zeitpunkt.", "fr": "Une valeur de consommation d''energie ou de ressources enregistree par un dispositif de mesure a un moment donne.", "it": "Un valore di consumo energetico o di risorse registrato da un dispositivo di misura in un determinato momento."}',
   NULL,
   'approved', 'SIA 380/1', 0, 0,
   'uuid-user-004', '2024-09-01T08:00:00Z',
   '2024-05-15T06:00:00Z', '2024-09-01T08:00:00Z'),

  -- Geschäftspartner (3 concepts)
  ('uuid-concept-015', 'uuid-vocab-001', 'uuid-coll-004',
   'Person', 'Person', 'Personne', 'Persona',
   '{"de": ["Natürliche Person"]}',
   '{"en": "A natural person relevant to real estate management: tenant, employee, or contact person.", "de": "Eine natürliche Person im Immobilienmanagement: Mieter, Mitarbeitende oder Kontaktperson.", "fr": "Une personne physique pertinente pour la gestion immobiliere: locataire, employe ou personne de contact.", "it": "Una persona fisica rilevante per la gestione immobiliare: inquilino, dipendente o persona di contatto."}',
   NULL,
   'approved', 'eCH-0010, eCH-0011', 0, 0,
   'uuid-user-003', '2024-07-01T08:00:00Z',
   '2024-03-10T07:00:00Z', '2024-07-01T08:00:00Z'),

  ('uuid-concept-016', 'uuid-vocab-001', 'uuid-coll-004',
   'Contact', 'Kontakt', 'Contact', 'Contatto',
   '{"de": ["Kontaktdaten", "Erreichbarkeit"]}',
   '{"en": "A communication endpoint for a person or organization: email, phone, or postal address.", "de": "Ein Kommunikationsendpunkt für eine Person oder Organisation: E-Mail, Telefon oder Postadresse.", "fr": "Un point de contact pour une personne ou une organisation: e-mail, telephone ou adresse postale.", "it": "Un punto di contatto per una persona o un''organizzazione: e-mail, telefono o indirizzo postale."}',
   NULL,
   'approved', 'eCH-0010', 0, 0,
   'uuid-user-003', '2024-07-15T08:00:00Z',
   '2024-03-15T07:00:00Z', '2024-07-15T08:00:00Z'),

  ('uuid-concept-017', 'uuid-vocab-001', 'uuid-coll-004',
   'Company', 'Unternehmen', 'Entreprise', 'Impresa',
   '{"de": ["Firma", "Organisation", "Juristische Person"]}',
   '{"en": "A legal entity or organizational unit, identified by UID (Unternehmens-Identifikationsnummer). Master data sourced from the BFS Unternehmensregister or SAP MDG.", "de": "Eine juristische Person oder Organisationseinheit, identifiziert durch die UID (Unternehmens-Identifikationsnummer). Stammdaten aus dem BFS-Unternehmensregister oder SAP MDG.", "fr": "Une entite juridique ou unite organisationnelle, identifiee par le IDE. Donnees de base du registre des entreprises de l''OFS ou SAP MDG.", "it": "Un''entita giuridica o unita organizzativa, identificata dall''IDI. Dati di base dal registro delle imprese dell''UST o SAP MDG."}',
   NULL,
   'approved', 'UID-Register (BFS), eCH-0011', 0, 0,
   'uuid-user-003', '2024-07-01T08:00:00Z',
   '2024-03-20T07:00:00Z', '2024-07-01T08:00:00Z'),

  -- Finanzen
  ('uuid-concept-018', 'uuid-vocab-001', 'uuid-coll-005',
   'Business Entity', 'Wirtschaftseinheit', 'Unite economique', 'Unita economica',
   '{"de": ["WE", "Immobilien-WE"]}',
   '{"en": "A self-contained economic unit in real estate accounting, typically a building or group of buildings managed as one profit center. Central organizational unit in SAP RE-FX.", "de": "Eine eigenständige wirtschaftliche Einheit in der Immobilienbuchhaltung, typischerweise ein Gebäude oder eine Gebäudegruppe, die als ein Profit Center geführt wird. Zentrale Organisationseinheit in SAP RE-FX.", "fr": "Une unite economique autonome dans la comptabilite immobiliere, typiquement un batiment ou un groupe de batiments gere comme un centre de profit.", "it": "Un''unita economica autonoma nella contabilita immobiliare, tipicamente un edificio o un gruppo di edifici gestiti come centro di profitto."}',
   NULL,
   'approved', 'SAP RE-FX, VILB', 0, 0,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-03-01T07:00:00Z', '2024-06-01T08:00:00Z'),
  ('uuid-concept-019', 'uuid-vocab-001', 'uuid-coll-005',
   'Company Code', 'Buchungskreis', 'Societe', 'Societa',
   '{"de": ["BuKrs", "Mandant"]}',
   '{"en": "The highest organizational unit in financial accounting (SAP FI). Each company code represents an independent legal entity with its own balance sheet and P&L. BBL typically operates under one company code for federal real estate.", "de": "Die höchste Organisationseinheit in der Finanzbuchhaltung (SAP FI). Jeder Buchungskreis repräsentiert eine eigenständige juristische Einheit mit eigener Bilanz und GuV. Das BBL operiert typischerweise unter einem Buchungskreis für Bundesimmobilien.", "fr": "L''unite organisationnelle la plus elevee en comptabilite financiere (SAP FI). Chaque societe represente une entite juridique independante.", "it": "L''unita organizzativa piu alta nella contabilita finanziaria (SAP FI). Ogni societa rappresenta un''entita giuridica indipendente."}',
   NULL,
   'approved', 'SAP FI, OR Art. 957ff', 0, 0,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-03-01T07:00:00Z', '2024-06-01T08:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CONCEPT ATTRIBUTES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO concept_attribute (id, concept_id, name_en, name_de, name_fr, name_it, definition, value_type, code_list_id, required, standard_ref, sort_order) VALUES

  -- Areal attributes
  ('uuid-cattr-001', 'uuid-concept-001', 'Site ID',            'Areal-ID',             'ID du site',           'ID del sito',
   '{"de": "Eindeutige Kennung des Areals.", "en": "Unique site identifier."}',
   'text', NULL, 1, 'VILB', 1),
  ('uuid-cattr-002', 'uuid-concept-001', 'Name',               'Bezeichnung',          'Designation',          'Designazione',
   '{"de": "Bezeichnung des Areals.", "en": "Name of the site."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-003', 'uuid-concept-001', 'Area (m2)',           'Fläche (m2)',         'Surface (m2)',         'Superficie (m2)',
   '{"de": "Gesamtfläche des Areals in Quadratmetern.", "en": "Total area of the site in square meters."}',
   'float', NULL, 0, NULL, 3),
  ('uuid-cattr-004', 'uuid-concept-001', 'Location Canton',    'Standort-Kanton',      'Canton de localisation','Cantone di ubicazione',
   '{"de": "Kanton, in dem sich das Areal befindet.", "en": "Canton where the site is located."}',
   'text', NULL, 1, 'eCH-0071', 4),
  ('uuid-cattr-005', 'uuid-concept-001', 'Owner',              'Eigentümer',          'Proprietaire',         'Proprietario',
   '{"de": "Eigentümer des Areals (Bund, Kanton, Dritte).", "en": "Owner of the site (Confederation, Canton, third party)."}',
   'text', NULL, 0, NULL, 5),

  -- Kampus attributes
  ('uuid-cattr-006', 'uuid-concept-002', 'Campus ID',          'Kampus-ID',            'ID du campus',         'ID del campus',
   '{"de": "Eindeutige Kennung des Kampus.", "en": "Unique campus identifier."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-007', 'uuid-concept-002', 'Name',               'Bezeichnung',          'Designation',          'Designazione',
   '{"de": "Bezeichnung des Kampus.", "en": "Name of the campus."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-008', 'uuid-concept-002', 'Number of Buildings','Anzahl Gebäude',      'Nombre de batiments',  'Numero di edifici',
   '{"de": "Anzahl der Gebäude auf dem Kampus.", "en": "Number of buildings on the campus."}',
   'integer', NULL, 0, NULL, 3),
  ('uuid-cattr-009', 'uuid-concept-002', 'Primary Use',        'Hauptnutzung',         'Utilisation principale','Uso principale',
   '{"de": "Hauptnutzungsart des Kampus.", "en": "Primary use type of the campus."}',
   'text', NULL, 0, NULL, 4),

  -- Grundstück attributes
  ('uuid-cattr-010', 'uuid-concept-003', 'Land Registry No.',  'Grundbuch-Nr',         'No registre foncier',  'Nr registro fondiario',
   '{"de": "Grundbuchnummer der Parzelle.", "en": "Land registry number of the parcel."}',
   'text', NULL, 1, 'ZGB', 1),
  ('uuid-cattr-011', 'uuid-concept-003', 'EGRID',              'EGRID',                'EGRID',                'EGRID',
   '{"de": "Eidgenössischer Grundstücksidentifikator.", "en": "Federal land parcel identifier."}',
   'text', NULL, 1, 'eCH-0071', 2),
  ('uuid-cattr-012', 'uuid-concept-003', 'Municipality BFS No.','Gemeinde-BFS-Nr',     'No commune OFS',       'Nr comune UST',
   '{"de": "BFS-Gemeindenummer des Standorts.", "en": "FSO municipality number."}',
   'integer', NULL, 1, 'eCH-0071', 3),
  ('uuid-cattr-013', 'uuid-concept-003', 'Area (m2)',           'Fläche (m2)',         'Surface (m2)',         'Superficie (m2)',
   '{"de": "Gesamtfläche des Grundstücks in m2.", "en": "Total area of the land parcel in m2."}',
   'float', NULL, 0, NULL, 4),
  ('uuid-cattr-014', 'uuid-concept-003', 'Ownership Type',     'Eigentumsart',         'Type de propriete',    'Tipo di proprieta',
   '{"de": "Art des Eigentums (Alleineigentum, Miteigentum, Stockwerkeigentum).", "en": "Type of ownership (sole, co-ownership, condominium)."}',
   'text', NULL, 1, NULL, 5),

  -- Gebäude attributes
  ('uuid-cattr-015', 'uuid-concept-004', 'EGID',               'EGID',                 'EGID',                 'EGID',
   '{"de": "Eidgenössischer Gebäudeidentifikator aus dem GWR.", "en": "Federal building identifier from the GWR."}',
   'integer', NULL, 1, 'eCH-0071', 1),
  ('uuid-cattr-016', 'uuid-concept-004', 'Year of Construction','Baujahr',              'Annee de construction','Anno di costruzione',
   '{"de": "Jahr der Fertigstellung des Gebäudes.", "en": "Year of building completion."}',
   'integer', NULL, 1, 'GWR', 2),
  ('uuid-cattr-017', 'uuid-concept-004', 'Building Category',  'Gebäudekategorie',    'Categorie de batiment','Categoria di edificio',
   '{"de": "Klassifikation des Gebäudetyps nach GWR-Katalog.", "en": "Classification of building type per GWR catalog."}',
   'code', 'uuid-codelist-001', 1, 'eCH-0071', 3),
  ('uuid-cattr-018', 'uuid-concept-004', 'Number of Floors',   'Anzahl Geschosse',     'Nombre d''etages',     'Numero di piani',
   '{"de": "Gesamtzahl der ober- und unterirdischen Geschosse.", "en": "Total number of above- and below-ground floors."}',
   'integer', NULL, 0, 'GWR', 4),
  ('uuid-cattr-019', 'uuid-concept-004', 'Energy Source',      'Energieträger',       'Agent energetique',    'Vettore energetico',
   '{"de": "Hauptsächlicher Energieträger für Heizung.", "en": "Primary energy source for heating."}',
   'code', 'uuid-codelist-003', 0, 'GWR', 5),

  -- Nutzungseinheit attributes
  ('uuid-cattr-020', 'uuid-concept-005', 'Unit Number',        'NE-Nummer',            'No d''unite',          'Nr unita',
   '{"de": "Nummer der Nutzungseinheit.", "en": "Occupancy unit number."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-021', 'uuid-concept-005', 'Usage Type',         'Nutzungsart',          'Type d''utilisation',  'Tipo di utilizzo',
   '{"de": "Art der Nutzung gemäss SIA 416.", "en": "Usage type per SIA 416."}',
   'code', 'uuid-codelist-002', 1, 'SIA 416', 2),
  ('uuid-cattr-022', 'uuid-concept-005', 'Area (m2)',           'Fläche (m2)',         'Surface (m2)',         'Superficie (m2)',
   '{"de": "Fläche der Nutzungseinheit in m2.", "en": "Area of the occupancy unit in m2."}',
   'float', NULL, 1, 'SIA 416', 3),
  ('uuid-cattr-023', 'uuid-concept-005', 'Floor Location',     'Geschoss-Lage',        'Situation d''etage',   'Ubicazione piano',
   '{"de": "Geschoss, auf dem sich die Nutzungseinheit befindet.", "en": "Floor on which the occupancy unit is located."}',
   'text', NULL, 0, NULL, 4),

  -- Geschoss attributes
  ('uuid-cattr-024', 'uuid-concept-006', 'Floor Number',       'Geschoss-Nr',          'No d''etage',          'Nr piano',
   '{"de": "Nummer des Geschosses.", "en": "Floor number."}',
   'integer', NULL, 1, NULL, 1),
  ('uuid-cattr-025', 'uuid-concept-006', 'Name',               'Bezeichnung',          'Designation',          'Designazione',
   '{"de": "Bezeichnung des Geschosses (z.B. EG, 1.OG, UG1).", "en": "Name of the floor (e.g. ground floor, 1st floor, basement 1)."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-026', 'uuid-concept-006', 'Gross Floor Area (m2)','Geschossfläche (m2)','Surface de plancher (m2)','Superficie di piano (m2)',
   '{"de": "Bruttogeschossfläche in m2.", "en": "Gross floor area in m2."}',
   'float', NULL, 0, 'SIA 416', 3),
  ('uuid-cattr-027', 'uuid-concept-006', 'Usable Area (m2)',   'Nutzfläche (m2)',     'Surface utile (m2)',   'Superficie utile (m2)',
   '{"de": "Nutzfläche in m2.", "en": "Usable area in m2."}',
   'float', NULL, 0, 'SIA 416', 4),

  -- Raum attributes
  ('uuid-cattr-028', 'uuid-concept-007', 'Room Number',        'Raum-Nr',              'No de local',          'Nr locale',
   '{"de": "Eindeutige Raumnummer.", "en": "Unique room number."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-029', 'uuid-concept-007', 'Name',               'Bezeichnung',          'Designation',          'Designazione',
   '{"de": "Bezeichnung des Raums.", "en": "Name of the room."}',
   'text', NULL, 0, NULL, 2),
  ('uuid-cattr-030', 'uuid-concept-007', 'Area (m2)',           'Fläche (m2)',         'Surface (m2)',         'Superficie (m2)',
   '{"de": "Fläche des Raums in m2.", "en": "Area of the room in m2."}',
   'float', NULL, 1, NULL, 3),
  ('uuid-cattr-031', 'uuid-concept-007', 'Usage Type',         'Nutzungsart',          'Type d''utilisation',  'Tipo di utilizzo',
   '{"de": "Art der Raumnutzung.", "en": "Room usage type."}',
   'text', NULL, 0, NULL, 4),

  -- Bemessung attributes
  ('uuid-cattr-032', 'uuid-concept-008', 'Calculation Type',   'Berechnungsart',       'Type de calcul',       'Tipo di calcolo',
   '{"de": "Art der Flächenberechnung (GF, NF, EBF, etc.).", "en": "Type of area calculation (gross floor area, usable area, energy reference area, etc.)."}',
   'text', NULL, 1, 'SIA 416', 1),
  ('uuid-cattr-033', 'uuid-concept-008', 'Reference Area (m2)','Bezugsfläche (m2)',   'Surface de reference (m2)','Superficie di riferimento (m2)',
   '{"de": "Berechnete Bezugsfläche in m2.", "en": "Calculated reference area in m2."}',
   'float', NULL, 1, 'SIA 416', 2),
  ('uuid-cattr-034', 'uuid-concept-008', 'Standard Reference', 'Norm-Referenz',        'Reference normative',  'Riferimento normativo',
   '{"de": "Referenz auf die angewandte Norm.", "en": "Reference to the applied standard."}',
   'text', NULL, 1, NULL, 3),
  ('uuid-cattr-035', 'uuid-concept-008', 'Calculation Date',   'Berechnungsdatum',     'Date de calcul',       'Data di calcolo',
   '{"de": "Datum der letzten Berechnung.", "en": "Date of last calculation."}',
   'date', NULL, 0, NULL, 4),

  -- Mietobjekt attributes
  ('uuid-cattr-036', 'uuid-concept-009', 'Rental Unit Number', 'MO-Nummer',            'No d''objet locatif',  'Nr oggetto in locazione',
   '{"de": "Eindeutige Kennung des Mietobjekts in SAP RE-FX.", "en": "Unique rental unit identifier in SAP RE-FX."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-037', 'uuid-concept-009', 'Name',               'Bezeichnung',          'Designation',          'Designazione',
   '{"de": "Bezeichnung des Mietobjekts.", "en": "Name of the rental unit."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-038', 'uuid-concept-009', 'Rental Area (m2)',   'Mietfläche (m2)',     'Surface locative (m2)','Superficie locativa (m2)',
   '{"de": "Vermietbare Fläche des Mietobjekts in m2.", "en": "Rentable area of the rental unit in m2."}',
   'float', NULL, 0, 'SIA 416', 3),
  ('uuid-cattr-039', 'uuid-concept-009', 'Status',             'Status',               'Statut',               'Stato',
   '{"de": "Status des Mietobjekts (aktiv/passiv).", "en": "Status of the rental unit (active/passive)."}',
   'text', NULL, 1, NULL, 4),

  -- Mietvertrag attributes
  ('uuid-cattr-040', 'uuid-concept-010', 'Contract Number',    'Vertrags-Nr',          'No de contrat',        'Nr di contratto',
   '{"de": "Eindeutige Kennung des Mietvertrags.", "en": "Unique lease contract identifier."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-041', 'uuid-concept-010', 'Start Date',         'Beginn',               'Debut',                'Inizio',
   '{"de": "Datum des Mietbeginns.", "en": "Lease start date."}',
   'date', NULL, 1, NULL, 2),
  ('uuid-cattr-042', 'uuid-concept-010', 'End Date',           'Ende',                 'Fin',                  'Fine',
   '{"de": "Datum des Mietendes (leer = unbefristet).", "en": "Lease end date (empty = indefinite)."}',
   'date', NULL, 0, NULL, 3),
  ('uuid-cattr-043', 'uuid-concept-010', 'Net Rent (CHF)',     'Nettomiete (CHF)',     'Loyer net (CHF)',      'Canone netto (CHF)',
   '{"de": "Jährliche Nettomiete in CHF.", "en": "Annual net rent in CHF."}',
   'float', NULL, 1, NULL, 4),
  ('uuid-cattr-044', 'uuid-concept-010', 'Status',             'Status',               'Statut',               'Stato',
   '{"de": "Vertragsstatus (aktiv, gekündigt, abgelaufen).", "en": "Contract status (active, terminated, expired)."}',
   'text', NULL, 1, NULL, 5),

  -- Kondition attributes
  ('uuid-cattr-045', 'uuid-concept-011', 'Condition Type',     'Konditionsart',        'Type de condition',    'Tipo di condizione',
   '{"de": "Art der Kondition (Nettomiete, Nebenkosten, Indexanpassung, Kaution, Mieterausbau).", "en": "Type of condition (net rent, operating costs, index adjustment, deposit, tenant fit-out)."}',
   'code', 'uuid-codelist-005', 1, NULL, 1),
  ('uuid-cattr-046', 'uuid-concept-011', 'Amount (CHF)',       'Betrag (CHF)',         'Montant (CHF)',        'Importo (CHF)',
   '{"de": "Betrag der Kondition in CHF.", "en": "Condition amount in CHF."}',
   'float', NULL, 1, NULL, 2),
  ('uuid-cattr-047', 'uuid-concept-011', 'Periodicity',        'Periodizität',        'Periodicite',          'Periodicita',
   '{"de": "Zahlungsintervall (monatlich, quartalsweise, jährlich).", "en": "Payment interval (monthly, quarterly, annual)."}',
   'text', NULL, 1, NULL, 3),
  ('uuid-cattr-048', 'uuid-concept-011', 'Index Basis',        'Index-Basis',          'Base d''indexation',   'Base di indicizzazione',
   '{"de": "Basis für die Indexanpassung (z.B. LIK Dezember 2020 = 100).", "en": "Basis for index adjustment (e.g. CPI December 2020 = 100)."}',
   'text', NULL, 0, NULL, 4),

  -- Heizzentrale attributes
  ('uuid-cattr-049', 'uuid-concept-012', 'Plant Number',       'HZ-Nummer',            'No de centrale',       'Nr centrale',
   '{"de": "Eindeutige Kennung der Heizzentrale.", "en": "Unique heating plant identifier."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-050', 'uuid-concept-012', 'Type',               'Typ',                  'Type',                 'Tipo',
   '{"de": "Typ der Heizzentrale (Öl, Gas, Wärmepumpe, Fernwärme).", "en": "Type of heating plant (oil, gas, heat pump, district heating)."}',
   'code', 'uuid-codelist-003', 1, NULL, 2),
  ('uuid-cattr-051', 'uuid-concept-012', 'Power (kW)',         'Leistung (kW)',        'Puissance (kW)',       'Potenza (kW)',
   '{"de": "Nennleistung der Heizzentrale in Kilowatt.", "en": "Nominal power of the heating plant in kilowatts."}',
   'float', NULL, 0, NULL, 3),
  ('uuid-cattr-052', 'uuid-concept-012', 'Year of Construction','Baujahr',             'Annee de construction','Anno di costruzione',
   '{"de": "Baujahr der Heizzentrale.", "en": "Year of construction of the heating plant."}',
   'integer', NULL, 0, NULL, 4),

  -- Stromzähler attributes
  ('uuid-cattr-053', 'uuid-concept-013', 'Meter Number',       'Zähler-Nr',           'No de compteur',       'Nr contatore',
   '{"de": "Eindeutige Zählernummer.", "en": "Unique meter number."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-054', 'uuid-concept-013', 'Meter Type',         'Zählertyp',           'Type de compteur',     'Tipo di contatore',
   '{"de": "Typ des Zählers (Hauptzähler, Unterzähler, Erzeugungszähler).", "en": "Type of meter (main meter, sub-meter, generation meter)."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-055', 'uuid-concept-013', 'Measurement Range',  'Messbereich',          'Plage de mesure',      'Campo di misura',
   '{"de": "Messbereich des Zählers.", "en": "Measurement range of the meter."}',
   'text', NULL, 0, NULL, 3),
  ('uuid-cattr-056', 'uuid-concept-013', 'Location',           'Standort',             'Emplacement',          'Ubicazione',
   '{"de": "Standort des Zählers im Gebäude.", "en": "Location of the meter within the building."}',
   'text', NULL, 0, NULL, 4),

  -- Betriebsmesswert attributes
  ('uuid-cattr-057', 'uuid-concept-014', 'Measurement Type',   'Messart',              'Type de mesure',       'Tipo di misura',
   '{"de": "Art der Messung (Strom, Wärme, Wasser, Gas).", "en": "Type of measurement (electricity, heat, water, gas)."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-058', 'uuid-concept-014', 'Value',              'Wert',                 'Valeur',               'Valore',
   '{"de": "Gemessener Wert.", "en": "Measured value."}',
   'float', NULL, 1, NULL, 2),
  ('uuid-cattr-059', 'uuid-concept-014', 'Unit',               'Einheit',              'Unite',                'Unita',
   '{"de": "Masseinheit (kWh, MWh, m3, l).", "en": "Unit of measure (kWh, MWh, m3, l)."}',
   'text', NULL, 1, NULL, 3),
  ('uuid-cattr-060', 'uuid-concept-014', 'Timestamp',          'Zeitstempel',          'Horodatage',           'Marca temporale',
   '{"de": "Zeitpunkt der Messung.", "en": "Timestamp of the measurement."}',
   'date', NULL, 1, NULL, 4),
  ('uuid-cattr-061', 'uuid-concept-014', 'Meter Reference',    'Zähler-Referenz',     'Reference compteur',   'Riferimento contatore',
   '{"de": "Referenz auf den zugehörigen Zähler.", "en": "Reference to the associated meter."}',
   'text', NULL, 1, NULL, 5),

  -- Person attributes
  ('uuid-cattr-062', 'uuid-concept-015', 'AHV Number',         'AHV-Nr',               'No AVS',               'Nr AVS',
   '{"de": "Sozialversicherungsnummer (AHV-Nr) der Person.", "en": "Social security number (AHV No.) of the person."}',
   'text', NULL, 0, 'eCH-0011', 1),
  ('uuid-cattr-063', 'uuid-concept-015', 'First Name',         'Vorname',              'Prenom',               'Nome',
   '{"de": "Vorname der Person.", "en": "First name of the person."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-064', 'uuid-concept-015', 'Last Name',          'Nachname',             'Nom',                  'Cognome',
   '{"de": "Nachname der Person.", "en": "Last name of the person."}',
   'text', NULL, 1, NULL, 3),
  ('uuid-cattr-065', 'uuid-concept-015', 'Date of Birth',      'Geburtsdatum',         'Date de naissance',    'Data di nascita',
   '{"de": "Geburtsdatum der Person.", "en": "Date of birth of the person."}',
   'date', NULL, 0, NULL, 4),

  -- Kontakt attributes
  ('uuid-cattr-066', 'uuid-concept-016', 'Contact Type',       'Kontaktart',           'Type de contact',      'Tipo di contatto',
   '{"de": "Art des Kontakts (Email, Telefon, Adresse).", "en": "Type of contact (email, phone, address)."}',
   'text', NULL, 1, NULL, 1),
  ('uuid-cattr-067', 'uuid-concept-016', 'Value',              'Wert',                 'Valeur',               'Valore',
   '{"de": "Kontaktwert (z.B. E-Mail-Adresse, Telefonnummer).", "en": "Contact value (e.g. email address, phone number)."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-068', 'uuid-concept-016', 'Valid From',         'Gültig-ab',           'Valable des',          'Valido da',
   '{"de": "Beginn der Gültigkeit des Kontakts.", "en": "Start of validity of the contact."}',
   'date', NULL, 0, NULL, 3),

  -- Unternehmen attributes
  ('uuid-cattr-069', 'uuid-concept-017', 'UID',                'UID',                  'IDE',                  'IDI',
   '{"de": "Unternehmens-Identifikationsnummer (UID).", "en": "Enterprise identification number (UID)."}',
   'text', NULL, 1, 'UID-Register', 1),
  ('uuid-cattr-070', 'uuid-concept-017', 'Company Name',       'Firmenname',           'Raison sociale',       'Ragione sociale',
   '{"de": "Offizielle Firma des Unternehmens.", "en": "Official company name."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-071', 'uuid-concept-017', 'Legal Form',         'Rechtsform',           'Forme juridique',      'Forma giuridica',
   '{"de": "Rechtsform des Unternehmens (AG, GmbH, Stiftung, etc.).", "en": "Legal form of the company (AG, GmbH, foundation, etc.)."}',
   'text', NULL, 1, NULL, 3),
  ('uuid-cattr-072', 'uuid-concept-017', 'Domicile',           'Sitz',                 'Siege',                'Sede',
   '{"de": "Sitz des Unternehmens (Gemeinde).", "en": "Domicile of the company (municipality)."}',
   'text', NULL, 1, NULL, 4),

  -- Wirtschaftseinheit attributes
  ('uuid-cattr-073', 'uuid-concept-018', 'WE Number',          'WE-Nummer',            'No UE',                'Nr UE',
   '{"de": "Eindeutige Nummer der Wirtschaftseinheit in SAP RE-FX.", "en": "Unique business entity number in SAP RE-FX."}',
   'text', NULL, 1, 'SAP RE-FX', 1),
  ('uuid-cattr-074', 'uuid-concept-018', 'Name',               'Bezeichnung',          'Designation',          'Designazione',
   '{"de": "Name/Bezeichnung der Wirtschaftseinheit.", "en": "Name of the business entity."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-075', 'uuid-concept-018', 'Company Code',       'Buchungskreis',        'Societe',              'Societa',
   '{"de": "Zugeordneter Buchungskreis der Wirtschaftseinheit.", "en": "Assigned company code of the business entity."}',
   'text', NULL, 1, 'SAP FI', 3),
  ('uuid-cattr-076', 'uuid-concept-018', 'Profit Center',      'Profit Center',        'Centre de profit',     'Centro di profitto',
   '{"de": "Zugeordnetes Profit Center für die Ergebnisrechnung.", "en": "Assigned profit center for profitability analysis."}',
   'text', NULL, 0, 'SAP CO', 4),

  -- Buchungskreis attributes
  ('uuid-cattr-077', 'uuid-concept-019', 'Company Code',       'Buchungskreis-Nr',     'No societe',           'Nr societa',
   '{"de": "Vierstelliger SAP-Buchungskreisschlüssel.", "en": "Four-digit SAP company code key."}',
   'text', NULL, 1, 'SAP FI', 1),
  ('uuid-cattr-078', 'uuid-concept-019', 'Name',               'Bezeichnung',          'Designation',          'Designazione',
   '{"de": "Name des Buchungskreises.", "en": "Name of the company code."}',
   'text', NULL, 1, NULL, 2),
  ('uuid-cattr-079', 'uuid-concept-019', 'Currency',            'Währung',             'Monnaie',              'Valuta',
   '{"de": "Hauswährung des Buchungskreises (CHF).", "en": "Local currency of the company code (CHF)."}',
   'text', NULL, 1, 'ISO 4217', 3),
  ('uuid-cattr-080', 'uuid-concept-019', 'Chart of Accounts',  'Kontenplan',           'Plan comptable',       'Piano dei conti',
   '{"de": "Zugeordneter Kontenplan.", "en": "Assigned chart of accounts."}',
   'text', NULL, 1, 'SAP FI', 4);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CODE LISTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO code_list (id, concept_id, name_en, name_de, name_fr, name_it, source_ref, version) VALUES
  ('uuid-codelist-001', 'uuid-concept-004',
   'GWR Building Category',   'GWR Gebäudekategorie',   'Categorie de batiment RegBL', 'Categoria di edificio REA',
   'GWR Merkmalskatalog 2023, eCH-0071 v2.0', '2023.1'),
  ('uuid-codelist-002', 'uuid-concept-005',
   'SIA Usage Type',          'SIA Nutzungsart',         'Type d''utilisation SIA',      'Tipo di utilizzo SIA',
   'SIA 416 Flächen und Volumen von Gebäuden', '2003'),
  ('uuid-codelist-003', 'uuid-concept-004',
   'Energy Source',            'Energieträger',          'Agent energetique',            'Vettore energetico',
   'GWR Merkmalskatalog 2023', '2023.1'),
  ('uuid-codelist-004', 'uuid-concept-004',
   'GEAK Efficiency Class',   'GEAK Effizienzklasse',    'Classe d''efficacite CECB',    'Classe di efficienza CECE',
   'GEAK 2023', '2023'),
  ('uuid-codelist-005', 'uuid-concept-011',
   'Condition Type',           'Konditionsart',           'Type de condition',            'Tipo di condizione',
   'OR Art. 269ff, BBL intern', '2024.1');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CODE LIST VALUES
-- ─────────────────────────────────────────────────────────────────────────────

-- GWR Gebäudekategorie
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-001', 'uuid-codelist-001', '1010', 'Single-family house',      'Einfamilienhaus',                      'Maison individuelle',            'Casa monofamiliare',       NULL, 0, 1),
  ('uuid-clv-002', 'uuid-codelist-001', '1020', 'Two-family house',         'Zweifamilienhaus',                     'Maison a deux logements',        'Casa bifamiliare',         NULL, 0, 2),
  ('uuid-clv-003', 'uuid-codelist-001', '1030', 'Multi-family house',       'Mehrfamilienhaus',                     'Immeuble locatif',               'Casa plurifamiliare',      NULL, 0, 3),
  ('uuid-clv-004', 'uuid-codelist-001', '1060', 'Building with partial residential use','Gebäude mit teilw. Wohnnutzung','Batiment a usage mixte',    'Edificio a uso misto',     NULL, 0, 4),
  ('uuid-clv-005', 'uuid-codelist-001', '1110', 'Office building',          'Bürogebäude',                        'Immeuble de bureaux',            'Edificio per uffici',      NULL, 0, 5),
  ('uuid-clv-006', 'uuid-codelist-001', '1230', 'Building for education',   'Gebäude für Bildung und Forschung',  'Batiment pour l''enseignement',  'Edificio per formazione',  NULL, 0, 6);

-- SIA Nutzungsart
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-007', 'uuid-codelist-002', 'BU',   'Office',           'Büro',            'Bureau',           'Ufficio',          NULL, 0, 1),
  ('uuid-clv-008', 'uuid-codelist-002', 'WO',   'Residential',      'Wohnen',           'Habitation',       'Abitazione',       NULL, 0, 2),
  ('uuid-clv-009', 'uuid-codelist-002', 'VK',   'Retail',           'Verkauf',          'Vente',            'Vendita',          NULL, 0, 3),
  ('uuid-clv-010', 'uuid-codelist-002', 'LA',   'Warehouse',        'Lager',            'Entrepot',         'Magazzino',        NULL, 0, 4),
  ('uuid-clv-011', 'uuid-codelist-002', 'NF',   'Ancillary Space',  'Nebennutzfläche', 'Surface secondaire','Superficie accessoria', NULL, 0, 5);

-- Energieträger (updated: 6 values)
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-012', 'uuid-codelist-003', '7530', 'Oil',              'Öl',              'Mazout',               'Gasolio',           NULL, 0, 1),
  ('uuid-clv-013', 'uuid-codelist-003', '7520', 'Gas',              'Gas',              'Gaz',                  'Gas',               NULL, 0, 2),
  ('uuid-clv-014', 'uuid-codelist-003', '7500', 'District heating', 'Fernwärme',       'Chauffage a distance', 'Teleriscaldamento', NULL, 0, 3),
  ('uuid-clv-015', 'uuid-codelist-003', '7510', 'Heat pump',        'Wärmepumpe',      'Pompe a chaleur',      'Pompa di calore',   NULL, 0, 4),
  ('uuid-clv-016', 'uuid-codelist-003', '7540', 'Wood',             'Holz',             'Bois',                 'Legna',             NULL, 0, 5),
  ('uuid-clv-017', 'uuid-codelist-003', '7550', 'Electric',         'Elektro',          'Electrique',           'Elettrico',         NULL, 0, 6);

-- GEAK Effizienzklasse
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-018', 'uuid-codelist-004', 'A', 'Very efficient',    'Sehr effizient',       'Tres efficace',          'Molto efficiente',        NULL, 0, 1),
  ('uuid-clv-019', 'uuid-codelist-004', 'B', 'Efficient',         'Effizient',            'Efficace',               'Efficiente',              NULL, 0, 2),
  ('uuid-clv-020', 'uuid-codelist-004', 'C', 'Fairly efficient',  'Recht effizient',      'Assez efficace',         'Abbastanza efficiente',   NULL, 0, 3),
  ('uuid-clv-021', 'uuid-codelist-004', 'D', 'Average',           'Durchschnittlich',     'Moyen',                  'Medio',                   NULL, 0, 4),
  ('uuid-clv-022', 'uuid-codelist-004', 'E', 'Below average',     'Unterdurchschnittlich','En dessous de la moyenne','Sotto la media',         NULL, 0, 5),
  ('uuid-clv-023', 'uuid-codelist-004', 'F', 'Inefficient',       'Wenig effizient',      'Peu efficace',           'Poco efficiente',         NULL, 0, 6),
  ('uuid-clv-024', 'uuid-codelist-004', 'G', 'Least efficient',   'Am wenigsten effizient','Le moins efficace',     'Il meno efficiente',      NULL, 0, 7);

-- Konditionsart (NEW)
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-025', 'uuid-codelist-005', 'NM',  'Net Rent',           'Nettomiete',       'Loyer net',            'Canone netto',        NULL, 0, 1),
  ('uuid-clv-026', 'uuid-codelist-005', 'NK',  'Operating Costs',    'Nebenkosten',      'Charges',              'Spese accessorie',    NULL, 0, 2),
  ('uuid-clv-027', 'uuid-codelist-005', 'IDX', 'Index Adjustment',   'Indexanpassung',   'Ajustement d''indice', 'Adeguamento indice',  NULL, 0, 3),
  ('uuid-clv-028', 'uuid-codelist-005', 'KAU', 'Deposit',            'Kaution',          'Depot de garantie',    'Deposito cauzionale', NULL, 0, 4),
  ('uuid-clv-029', 'uuid-codelist-005', 'MAB', 'Tenant Fit-Out',     'Mieterausbau',     'Amenagement locataire','Adeguamento inquilino',NULL, 0, 5);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SYSTEMS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO system (id, name_en, name_de, description, archimate_type, technology_stack, base_url, scanner_class, owner_id, last_scanned_at, active, created_at) VALUES
  ('uuid-sys-001',
   'SAP RE-FX', 'SAP RE-FX',
   '{"en": "Enterprise resource planning system for real estate management. Contains master data for buildings, rental units, lease contracts, conditions, and business partners.", "de": "ERP-System für die Immobilienbewirtschaftung. Enthält Stammdaten zu Gebäuden, Mietobjekten, Mietverträgen, Konditionen und Geschäftspartnern."}',
   'Application Component', 'SAP S/4HANA',
   'https://sap-refx.bbl.admin.ch', 'SapRefxScanner',
   'uuid-contact-005', '2024-12-01T02:00:00Z',
   1, '2024-01-15T07:00:00Z'),

  ('uuid-sys-002',
   'GIS IMMO', 'GIS IMMO',
   '{"en": "Geographic information system for federal real estate. Contains spatial data for buildings, land parcels, and energy infrastructure.", "de": "Geoinformationssystem für die Bundesimmobilien. Enthält Geodaten zu Gebäuden, Grundstücken und Energieinfrastruktur."}',
   'Application Component', 'ArcGIS Enterprise',
   'https://gis-immo.bbl.admin.ch', 'ArcGisScanner',
   'uuid-contact-005', '2024-12-02T01:00:00Z',
   1, '2024-01-15T07:00:00Z'),

  ('uuid-sys-003',
   'ActaNova GEVER', 'ActaNova GEVER',
   '{"en": "Document management and electronic records system (GEVER) for building-related documents, contracts, and correspondence.", "de": "Dokumentenmanagementsystem und elektronische Geschäftsverwaltung (GEVER) für Gebäudedokumente, Verträge und Korrespondenz."}',
   'Application Component', 'Acta Nova (Rubicon)',
   'https://actanova.bbl.admin.ch', 'ActaNovaScanner',
   'uuid-contact-005', '2024-11-28T03:00:00Z',
   1, '2024-02-01T07:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SCHEMAS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO schema_ (id, system_id, name, display_name, schema_type, description, created_at) VALUES
  ('uuid-schema-001', 'uuid-sys-001',
   'VIBD', 'SAP RE-FX Stammdaten',
   'database_schema',
   '{"de": "Stammdatenschema der SAP RE-FX Immobilienwirtschaft. Enthält Tabellen für Gebäude, Mietobjekte, Verträge und Konditionen.", "en": "Master data schema of SAP RE-FX real estate management. Contains tables for buildings, rental units, contracts, and conditions."}',
   '2024-01-15T07:00:00Z'),

  ('uuid-schema-002', 'uuid-sys-001',
   'VIBP', 'SAP RE-FX Partnerdaten',
   'database_schema',
   '{"de": "Partnerdatenschema der SAP RE-FX Immobilienwirtschaft. Enthält Stammdaten zu Geschäftspartnern (Personen und Unternehmen).", "en": "Partner data schema of SAP RE-FX real estate management. Contains master data for business partners (persons and companies)."}',
   '2024-01-15T07:00:00Z'),

  ('uuid-schema-003', 'uuid-sys-002',
   'SPATIAL', 'GIS IMMO Geodaten',
   'gis_workspace',
   '{"de": "GIS-Workspace mit Gebäudepolygonen und Parzellengeometrien.", "en": "GIS workspace with building polygons and parcel geometries."}',
   '2024-01-15T07:00:00Z'),

  ('uuid-schema-004', 'uuid-sys-003',
   'DMS_BBL', 'ActaNova BBL Aktenplan',
   'file_folder',
   '{"de": "Aktenplan und Ordnungsstruktur des BBL in ActaNova GEVER.", "en": "Filing plan and organisational structure of BBL in ActaNova GEVER."}',
   '2024-02-01T07:00:00Z'),

  ('uuid-schema-005', 'uuid-sys-002',
   'ENERGY', 'GIS IMMO Energiedaten',
   'gis_workspace',
   '{"de": "GIS-Workspace mit Energiezählern und Verbrauchsmessdaten.", "en": "GIS workspace with energy meters and consumption measurement data."}',
   '2024-03-01T07:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. DATASETS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dataset (id, schema_id, name, display_name, dataset_type, description, certified, egid, egrid, row_count_approx, source_url, owner_id, created_at, modified_at) VALUES

  ('uuid-ds-001', 'uuid-schema-001',
   'VIBDBE', 'Wirtschaftseinheiten Gebäude',
   'table',
   '{"de": "SAP RE-FX Stammdatentabelle für Gebäude (Wirtschaftseinheit Typ BE). Enthält EGID, Baujahr, Kategorie und technische Gebäudemerkmale.", "en": "SAP RE-FX master data table for buildings (Business Entity type BE). Contains EGID, year of construction, category, and technical building characteristics."}',
   1, NULL, NULL, 8450,
   'https://sap-refx.bbl.admin.ch/sap/bc/gui/sap/its/webgui?~transaction=VIBDBE',
   'uuid-contact-002',
   '2024-01-20T07:00:00Z', '2024-11-15T08:00:00Z'),

  ('uuid-ds-002', 'uuid-schema-001',
   'VIBDAU', 'Wirtschaftseinheiten Mietobjekt',
   'table',
   '{"de": "SAP RE-FX Stammdatentabelle für Mietobjekte (Wirtschaftseinheit Typ AU). Enthält Mietobjektnummern, Flächen und Nutzungsarten.", "en": "SAP RE-FX master data table for rental units (Business Entity type AU). Contains rental unit numbers, areas, and usage types."}',
   1, NULL, NULL, 32100,
   'https://sap-refx.bbl.admin.ch/sap/bc/gui/sap/its/webgui?~transaction=VIBDAU',
   'uuid-contact-003',
   '2024-01-20T07:00:00Z', '2024-11-15T08:00:00Z'),

  ('uuid-ds-003', 'uuid-schema-001',
   'VIBDMV', 'Mietverträge',
   'table',
   '{"de": "SAP RE-FX Vertragstabelle für Mietverträge. Enthält Vertragsnummern, Laufzeiten, Mietkonditionen und Geschäftspartner-Referenzen.", "en": "SAP RE-FX contract table for lease agreements. Contains contract numbers, terms, rental conditions, and business partner references."}',
   0, NULL, NULL, 15600,
   'https://sap-refx.bbl.admin.ch/sap/bc/gui/sap/its/webgui?~transaction=VIBDMV',
   'uuid-contact-003',
   '2024-02-01T07:00:00Z', '2024-10-01T07:00:00Z'),

  ('uuid-ds-004', 'uuid-schema-001',
   'VIBDKD', 'Konditionen',
   'table',
   '{"de": "SAP RE-FX Konditionentabelle. Enthält Nettomiete, Nebenkosten, Indexanpassungen und Kautionen pro Mietvertrag.", "en": "SAP RE-FX conditions table. Contains net rent, operating costs, index adjustments, and deposits per lease agreement."}',
   0, NULL, NULL, 42000,
   'https://sap-refx.bbl.admin.ch/sap/bc/gui/sap/its/webgui?~transaction=VIBDKD',
   'uuid-contact-003',
   '2024-02-15T07:00:00Z', '2024-10-15T07:00:00Z'),

  ('uuid-ds-005', 'uuid-schema-002',
   'VIBDBP', 'Geschäftspartner',
   'table',
   '{"de": "SAP RE-FX Geschäftspartner-Stammdaten. Enthält Personen und Unternehmen mit Partnernummern, UID, Adressen und Kontaktdaten.", "en": "SAP RE-FX business partner master data. Contains persons and companies with partner numbers, UID, addresses, and contact data."}',
   1, NULL, NULL, 18500,
   'https://sap-refx.bbl.admin.ch/sap/bc/gui/sap/its/webgui?~transaction=VIBDBP',
   'uuid-contact-003',
   '2024-02-01T07:00:00Z', '2024-11-01T08:00:00Z'),

  ('uuid-ds-006', 'uuid-schema-003',
   'BUILDING', 'Gebäudepolygone',
   'gis_layer',
   '{"de": "GIS-Layer mit den Gebäudegrundrissen als Polygone. Enthält EGID-Verknüpfung, Dachform und Gebäüdehöhe.", "en": "GIS layer with building footprints as polygons. Contains EGID reference, roof type, and building height."}',
   1, NULL, NULL, 9200,
   'https://gis-immo.bbl.admin.ch/arcgis/rest/services/BUILDING/FeatureServer/0',
   'uuid-contact-002',
   '2024-01-20T07:00:00Z', '2024-12-02T01:00:00Z'),

  ('uuid-ds-007', 'uuid-schema-003',
   'PARCEL', 'Parzellen',
   'gis_layer',
   '{"de": "GIS-Layer mit Parzellengrenzen der Bundesgrundstücke. Enthält EGRID, Grundbuchnummer und Gemeindezuordnung.", "en": "GIS layer with parcel boundaries of federal land. Contains EGRID, land registry number, and municipality assignment."}',
   1, NULL, NULL, 3400,
   'https://gis-immo.bbl.admin.ch/arcgis/rest/services/PARCEL/FeatureServer/0',
   'uuid-contact-002',
   '2024-01-20T07:00:00Z', '2024-12-02T01:00:00Z'),

  ('uuid-ds-008', 'uuid-schema-005',
   'ENERGY_METER', 'Energiezähler und Messwerte',
   'gis_layer',
   '{"de": "GIS-Layer mit Energiezählern, Heizzentralen und Betriebsmesswerten. Enthält Zählerstandorte, Verbrauchsdaten und Aggregationen.", "en": "GIS layer with energy meters, heating plants, and operational measurements. Contains meter locations, consumption data, and aggregations."}',
   1, NULL, NULL, 12600,
   'https://gis-immo.bbl.admin.ch/arcgis/rest/services/ENERGY_METER/FeatureServer/0',
   'uuid-contact-004',
   '2024-03-01T07:00:00Z', '2024-11-20T08:00:00Z'),

  ('uuid-ds-009', 'uuid-schema-004',
   'DOC_BUILDING', 'Gebäudedossiers',
   'file',
   '{"de": "ActaNova-Dossiers mit gebäudebezogenen Dokumenten: Baupläne, Gutachten, Bewilligungen und Korrespondenz.", "en": "ActaNova dossiers with building-related documents: construction plans, expert reports, permits, and correspondence."}',
   0, NULL, NULL, 125000,
   'https://actanova.bbl.admin.ch/objects/DOC_BUILDING',
   'uuid-contact-001',
   '2024-02-15T07:00:00Z', '2024-11-28T03:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. FIELDS
-- ─────────────────────────────────────────────────────────────────────────────

-- VIBDBE fields (SAP Buildings)
INSERT INTO field (id, dataset_id, name, display_name, data_type, description, nullable, is_primary_key, is_foreign_key, references_field_id, sample_values, sort_order) VALUES
  ('uuid-field-001', 'uuid-ds-001', 'SWESSION',  'Wirtschaftseinheit ID', 'VARCHAR(20)',  '{"de": "Primärschlüssel der Wirtschaftseinheit Gebäude."}',  0, 1, 0, NULL, '["1000001", "1000002", "1000003"]', 1),
  ('uuid-field-002', 'uuid-ds-001', 'BAESSION',  'Baujahr',              'INTEGER',       '{"de": "Jahr der Gebäudeerstellung."}',                        1, 0, 0, NULL, '[1952, 1978, 2015]', 2),
  ('uuid-field-003', 'uuid-ds-001', 'BUKESSION', 'Gebäudekategorie-Code','VARCHAR(4)',   '{"de": "GWR-Gebäudekategoriecode."}',                          1, 0, 0, NULL, '["1110", "1030", "1230"]', 3),
  ('uuid-field-004', 'uuid-ds-001', 'REESSION',  'EGID',                 'INTEGER',       '{"de": "Eidgenössischer Gebäudeidentifikator."}',              1, 0, 0, NULL, '[190123456, 190234567]', 4),
  ('uuid-field-005', 'uuid-ds-001', 'ANESSION',  'Anzahl Geschosse',     'SMALLINT',      '{"de": "Gesamtzahl Geschosse (ober- und unterirdisch)."}',       1, 0, 0, NULL, '[3, 5, 12]', 5),
  ('uuid-field-006', 'uuid-ds-001', 'ENESSION',  'Energieträger-Code',  'VARCHAR(4)',    '{"de": "Code des hauptsächlichen Energieträgers."}',           1, 0, 0, NULL, '["7500", "7510", "7520"]', 6),

-- VIBDAU fields (SAP Rental Units)
  ('uuid-field-007', 'uuid-ds-002', 'MIOBJNR',   'Mietobjektnummer',     'VARCHAR(20)',  '{"de": "Primärschlüssel des Mietobjekts."}',                  0, 1, 0, NULL, '["MO-00001", "MO-00002"]', 1),
  ('uuid-field-008', 'uuid-ds-002', 'SWESSION',   'WE Gebäude (FK)',     'VARCHAR(20)',  '{"de": "Fremdschlüssel zur Wirtschaftseinheit Gebäude."}',     0, 0, 1, 'uuid-field-001', '["1000001", "1000001"]', 2),
  ('uuid-field-009', 'uuid-ds-002', 'BEZEICHNUNG','Bezeichnung',          'VARCHAR(80)',  '{"de": "Bezeichnung des Mietobjekts."}',                        1, 0, 0, NULL, '["Büro 3. OG West", "Lager UG"]', 3),
  ('uuid-field-010', 'uuid-ds-002', 'MFESSION',   'Mietfläche m2',      'DECIMAL(10,2)','{"de": "Vermietbare Fläche in Quadratmetern."}',                1, 0, 0, NULL, '[45.50, 120.30, 250.00]', 4),
  ('uuid-field-011', 'uuid-ds-002', 'STATUS',     'Status',              'VARCHAR(10)',   '{"de": "Status des Mietobjekts (aktiv/passiv)."}',               0, 0, 0, NULL, '["aktiv", "passiv"]', 5),

-- VIBDMV fields (SAP Lease Agreements)
  ('uuid-field-012', 'uuid-ds-003', 'MVNR',       'Vertragsnummer',      'VARCHAR(20)',  '{"de": "Primärschlüssel des Mietvertrags."}',                  0, 1, 0, NULL, '["MV-2024-001", "MV-2024-002"]', 1),
  ('uuid-field-013', 'uuid-ds-003', 'MIOBJNR',    'Mietobjekt (FK)',     'VARCHAR(20)',  '{"de": "Fremdschlüssel zum Mietobjekt."}',                      0, 0, 1, 'uuid-field-007', '["MO-00001"]', 2),
  ('uuid-field-014', 'uuid-ds-003', 'MVBEG',      'Vertragsbeginn',      'DATE',         '{"de": "Beginn des Mietvertrags."}',                             0, 0, 0, NULL, '["2020-01-01", "2023-04-01"]', 3),
  ('uuid-field-015', 'uuid-ds-003', 'MVEND',      'Vertragsende',        'DATE',         '{"de": "Ende des Mietvertrags (NULL = unbefristet)."}',           1, 0, 0, NULL, '["2030-12-31", null]', 4),
  ('uuid-field-016', 'uuid-ds-003', 'NMIETE',     'Nettomiete CHF',      'DECIMAL(12,2)','{"de": "Jährliche Nettomiete in CHF."}',                         0, 0, 0, NULL, '[85000.00, 245000.00]', 5),
  ('uuid-field-017', 'uuid-ds-003', 'STATUS',     'Vertragsstatus',      'VARCHAR(20)',  '{"de": "Status des Vertrags (aktiv, gekündigt, abgelaufen)."}',  0, 0, 0, NULL, '["aktiv", "gekündigt"]', 6),

-- VIBDKD fields (SAP Conditions) — NEW
  ('uuid-field-018', 'uuid-ds-004', 'KDNR',       'Konditionsnummer',    'VARCHAR(20)',  '{"de": "Primärschlüssel der Kondition."}',                      0, 1, 0, NULL, '["KD-00001", "KD-00002"]', 1),
  ('uuid-field-019', 'uuid-ds-004', 'MVNR',       'Vertrag (FK)',        'VARCHAR(20)',  '{"de": "Fremdschlüssel zum Mietvertrag."}',                      0, 0, 1, 'uuid-field-012', '["MV-2024-001"]', 2),
  ('uuid-field-020', 'uuid-ds-004', 'KDART',      'Konditionsart',       'VARCHAR(10)',  '{"de": "Art der Kondition (NM, NK, IDX, KAU, MAB)."}',            0, 0, 0, NULL, '["NM", "NK", "IDX"]', 3),
  ('uuid-field-021', 'uuid-ds-004', 'BETRAG',     'Betrag CHF',          'DECIMAL(12,2)','{"de": "Betrag der Kondition in CHF."}',                          0, 0, 0, NULL, '[85000.00, 12000.00, 3500.00]', 4),
  ('uuid-field-022', 'uuid-ds-004', 'PERIOD',     'Periodizität',       'VARCHAR(20)',  '{"de": "Zahlungsintervall."}',                                    0, 0, 0, NULL, '["jährlich", "monatlich"]', 5),

-- VIBDBP fields (SAP Business Partners) — NEW
  ('uuid-field-023', 'uuid-ds-005', 'PARTNER_NR', 'Partnernummer',       'VARCHAR(20)',  '{"de": "Primärschlüssel des Geschäftspartners."}',             0, 1, 0, NULL, '["BP-00001", "BP-00002"]', 1),
  ('uuid-field-024', 'uuid-ds-005', 'BP_TYP',     'Partnertyp',          'VARCHAR(10)',  '{"de": "Typ des Partners (PERS = Person, ORG = Organisation)."}', 0, 0, 0, NULL, '["PERS", "ORG"]', 2),
  ('uuid-field-025', 'uuid-ds-005', 'NAME1',      'Name / Firma',        'VARCHAR(80)',  '{"de": "Nachname (Person) oder Firmenname (Organisation)."}',     0, 0, 0, NULL, '["Müller", "Schweizerische Post AG"]', 3),
  ('uuid-field-026', 'uuid-ds-005', 'NAME2',      'Vorname',             'VARCHAR(80)',  '{"de": "Vorname (nur bei Personen)."}',                           1, 0, 0, NULL, '["Hans", "Maria", null]', 4),
  ('uuid-field-027', 'uuid-ds-005', 'UID_NR',     'UID',                 'VARCHAR(15)',  '{"de": "Unternehmens-Identifikationsnummer (nur bei Org)."}',     1, 0, 0, NULL, '["CHE-123.456.789", null]', 5),

-- BUILDING fields (GIS)
  ('uuid-field-028', 'uuid-ds-006', 'GEB_ID',     'Gebäude-ID',         'INTEGER',      '{"de": "Primärschlüssel des GIS-Gebäudeobjekts."}',           0, 1, 0, NULL, '[10001, 10002, 10003]', 1),
  ('uuid-field-029', 'uuid-ds-006', 'EGID',       'EGID',                'INTEGER',      '{"de": "Eidgenössischer Gebäudeidentifikator (GWR)."}',         1, 0, 0, NULL, '[190123456, 190234567]', 2),
  ('uuid-field-030', 'uuid-ds-006', 'GEOMETRY',   'Geometrie',           'GEOMETRY(POLYGON, 2056)', '{"de": "Gebäudegrundriss als Polygon in LV95."}',     0, 0, 0, NULL, NULL, 3),
  ('uuid-field-031', 'uuid-ds-006', 'DACH_TYP',   'Dachform',            'VARCHAR(20)',  '{"de": "Art der Dachkonstruktion."}',                             1, 0, 0, NULL, '["Flachdach", "Satteldach"]', 4),
  ('uuid-field-032', 'uuid-ds-006', 'HOEHE',      'Gebäüdehöhe m',    'DECIMAL(5,1)', '{"de": "Gebäüdehöhe in Metern (Traufe)."}',                    1, 0, 0, NULL, '[12.5, 25.3, 8.0]', 5),

-- PARCEL fields (GIS) — NEW
  ('uuid-field-033', 'uuid-ds-007', 'PARZELLE_NR','Parzellennummer',     'VARCHAR(20)',  '{"de": "Primärschlüssel der Parzelle im GIS."}',                0, 1, 0, NULL, '["P-3001", "P-3002"]', 1),
  ('uuid-field-034', 'uuid-ds-007', 'EGRID',      'EGRID',               'VARCHAR(14)',  '{"de": "Eidgenössischer Grundstücksidentifikator."}',            1, 0, 0, NULL, '["CH123456789012", "CH234567890123"]', 2),
  ('uuid-field-035', 'uuid-ds-007', 'GB_NR',      'Grundbuch-Nr',        'VARCHAR(20)',  '{"de": "Grundbuchnummer."}',                                      0, 0, 0, NULL, '["GB-351-1234", "GB-2701-5678"]', 3),
  ('uuid-field-036', 'uuid-ds-007', 'GEMEINDE_BFS','Gemeinde BFS-Nr',    'INTEGER',      '{"de": "BFS-Gemeindenummer."}',                                   0, 0, 0, NULL, '[351, 2701, 5586]', 4),
  ('uuid-field-037', 'uuid-ds-007', 'GEOMETRY',   'Geometrie',           'GEOMETRY(POLYGON, 2056)', '{"de": "Parzellengrenze als Polygon in LV95."}',       0, 0, 0, NULL, NULL, 5),

-- ENERGY_METER fields (GIS) — NEW
  ('uuid-field-038', 'uuid-ds-008', 'METER_ID',   'Zähler-ID',          'INTEGER',      '{"de": "Primärschlüssel des Energiezählers."}',                0, 1, 0, NULL, '[6001, 6002, 6003]', 1),
  ('uuid-field-039', 'uuid-ds-008', 'HZ_ID',      'Heizzentralen-ID',    'INTEGER',      '{"de": "Referenz auf zugehörige Heizzentrale (kann NULL sein)."}',1, 0, 0, NULL, '[7001, 7002, null]', 2),
  ('uuid-field-040', 'uuid-ds-008', 'GEB_ID',     'Gebäude (FK)',       'INTEGER',      '{"de": "Fremdschlüssel zum GIS-Gebäude."}',                     0, 0, 1, 'uuid-field-028', '[10001, 10002]', 3),
  ('uuid-field-041', 'uuid-ds-008', 'ZAEHLER_TYP','Zählertyp',          'VARCHAR(20)',  '{"de": "Typ des Zählers (Strom, Wärme, Wasser)."}',             0, 0, 0, NULL, '["Strom", "Wärme", "Wasser"]', 4),
  ('uuid-field-042', 'uuid-ds-008', 'MESSWERT',   'Letzter Messwert',    'DECIMAL(12,2)','{"de": "Zuletzt erfasster Messwert."}',                            1, 0, 0, NULL, '[15234.50, 8721.00]', 5),
  ('uuid-field-043', 'uuid-ds-008', 'EINHEIT',    'Einheit',             'VARCHAR(10)',  '{"de": "Masseinheit des Messwerts (kWh, MWh, m3)."}',              0, 0, 0, NULL, '["kWh", "MWh", "m3"]', 6),

-- DOC_BUILDING fields (ActaNova)
  ('uuid-field-044', 'uuid-ds-009', 'DOC_ID',     'Dokument-ID',         'VARCHAR(36)',  '{"de": "Eindeutige Dokument-ID in ActaNova."}',                   0, 1, 0, NULL, '["d7a3f1e2-...", "c8b4e2f3-..."]', 1),
  ('uuid-field-045', 'uuid-ds-009', 'DOSSIER_NR', 'Dossiernummer',       'VARCHAR(30)',  '{"de": "Aktenzeichen des Gebäudedossiers."}',                    0, 0, 0, NULL, '["BBL-GEB-2024-001"]', 2),
  ('uuid-field-046', 'uuid-ds-009', 'DOC_TYP',    'Dokumenttyp',         'VARCHAR(20)',  '{"de": "Art des Dokuments (Plan, Gutachten, Bewilligung)."}',     1, 0, 0, NULL, '["Bauplan", "Gutachten", "Mietvertrag"]', 3),
  ('uuid-field-047', 'uuid-ds-009', 'EGID_REF',   'EGID-Referenz',       'INTEGER',      '{"de": "EGID-Verknüpfung zum zugehörigen Gebäude."}',          1, 0, 0, NULL, '[190123456]', 4);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. CONCEPT MAPPINGS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO concept_mapping (id, concept_id, field_id, match_type, transformation_note, verified, created_by, created_at) VALUES

  -- Gebäude -> SAP VIBDBE.SWESSION (exact: one row = one building)
  ('uuid-cm-001', 'uuid-concept-004', 'uuid-field-001', 'exact',
   NULL, 1, 'uuid-user-002', '2024-06-01T08:00:00Z'),

  -- Gebäude -> SAP VIBDBE.REESSION (exact: EGID field)
  ('uuid-cm-002', 'uuid-concept-004', 'uuid-field-004', 'exact',
   'EGID as INTEGER, leading zeros stripped in SAP', 1, 'uuid-user-002', '2024-06-01T08:00:00Z'),

  -- Gebäude -> GIS BUILDING.GEB_ID (exact: one polygon = one building)
  ('uuid-cm-003', 'uuid-concept-004', 'uuid-field-028', 'exact',
   NULL, 1, 'uuid-user-002', '2024-06-02T07:00:00Z'),

  -- Gebäude -> GIS BUILDING.EGID (exact: EGID in GIS)
  ('uuid-cm-004', 'uuid-concept-004', 'uuid-field-029', 'exact',
   NULL, 1, 'uuid-user-002', '2024-06-02T07:00:00Z'),

  -- Gebäude -> ActaNova DOC_BUILDING.EGID_REF (related: document references building)
  ('uuid-cm-005', 'uuid-concept-004', 'uuid-field-047', 'related',
   'Documents reference buildings via EGID - not all documents have EGID', 0, 'uuid-user-001', '2024-07-01T08:00:00Z'),

  -- Mietobjekt -> SAP VIBDAU.MIOBJNR (exact)
  ('uuid-cm-006', 'uuid-concept-009', 'uuid-field-007', 'exact',
   NULL, 1, 'uuid-user-003', '2024-07-01T08:00:00Z'),

  -- Mietobjekt -> SAP VIBDAU.MFESSION (close: area as property)
  ('uuid-cm-007', 'uuid-concept-009', 'uuid-field-010', 'close',
   'Rentable area in m2', 1, 'uuid-user-003', '2024-07-01T08:00:00Z'),

  -- Mietvertrag -> SAP VIBDMV.MVNR (exact)
  ('uuid-cm-008', 'uuid-concept-010', 'uuid-field-012', 'exact',
   NULL, 1, 'uuid-user-003', '2024-08-01T07:00:00Z'),

  -- Mietvertrag -> SAP VIBDMV.MVBEG (exact: start date)
  ('uuid-cm-009', 'uuid-concept-010', 'uuid-field-014', 'exact',
   NULL, 1, 'uuid-user-003', '2024-08-01T07:00:00Z'),

  -- Kondition -> SAP VIBDKD.KDNR (exact)
  ('uuid-cm-010', 'uuid-concept-011', 'uuid-field-018', 'exact',
   NULL, 1, 'uuid-user-003', '2024-08-15T07:00:00Z'),

  -- Kondition -> SAP VIBDKD.KDART (exact: condition type)
  ('uuid-cm-011', 'uuid-concept-011', 'uuid-field-020', 'exact',
   'Maps to code list Konditionsart', 1, 'uuid-user-003', '2024-08-15T07:00:00Z'),

  -- Grundstück -> GIS PARCEL.PARZELLE_NR (exact)
  ('uuid-cm-012', 'uuid-concept-003', 'uuid-field-033', 'exact',
   NULL, 1, 'uuid-user-002', '2024-09-01T08:00:00Z'),

  -- Grundstück -> GIS PARCEL.EGRID (exact)
  ('uuid-cm-013', 'uuid-concept-003', 'uuid-field-034', 'exact',
   NULL, 1, 'uuid-user-002', '2024-09-01T08:00:00Z'),

  -- Person -> SAP VIBDBP.PARTNER_NR (exact)
  ('uuid-cm-014', 'uuid-concept-015', 'uuid-field-023', 'exact',
   'Partner type PERS', 1, 'uuid-user-003', '2024-09-15T08:00:00Z'),

  -- Unternehmen -> SAP VIBDBP.PARTNER_NR (exact, filtered by BP_TYP=ORG)
  ('uuid-cm-015', 'uuid-concept-017', 'uuid-field-023', 'exact',
   'Partner type ORG', 1, 'uuid-user-003', '2024-09-15T08:00:00Z'),

  -- Unternehmen -> SAP VIBDBP.UID_NR (exact: UID)
  ('uuid-cm-016', 'uuid-concept-017', 'uuid-field-027', 'exact',
   NULL, 1, 'uuid-user-003', '2024-09-15T08:00:00Z'),

  -- Heizzentrale -> GIS ENERGY_METER.HZ_ID (exact)
  ('uuid-cm-017', 'uuid-concept-012', 'uuid-field-039', 'exact',
   NULL, 1, 'uuid-user-004', '2024-09-15T08:00:00Z'),

  -- Stromzähler -> GIS ENERGY_METER.METER_ID (exact)
  ('uuid-cm-018', 'uuid-concept-013', 'uuid-field-038', 'exact',
   NULL, 1, 'uuid-user-004', '2024-09-15T08:00:00Z'),

  -- Betriebsmesswert -> GIS ENERGY_METER.MESSWERT (exact)
  ('uuid-cm-019', 'uuid-concept-014', 'uuid-field-042', 'exact',
   NULL, 1, 'uuid-user-004', '2024-09-15T08:00:00Z'),

  -- Betriebsmesswert -> GIS ENERGY_METER.EINHEIT (related: unit of measurement)
  ('uuid-cm-020', 'uuid-concept-014', 'uuid-field-043', 'related',
   'Unit of the measurement value', 1, 'uuid-user-004', '2024-09-15T08:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. DATA CLASSIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_classification (id, name_en, name_de, name_fr, name_it, sensitivity_level, legal_basis, description, access_restriction) VALUES
  ('uuid-class-001', 'Public',       'Oeffentlich',   'Public',        'Pubblico',       0, 'EMBAG Art. 10',
   '{"de": "Daten, die ohne Einschränkung veröffentlicht werden duerfen.", "en": "Data that may be published without restriction."}',
   'No restrictions'),
  ('uuid-class-002', 'Internal',     'BBL-intern',    'Interne OFC',   'Interno UFCL',   1, 'ISG Art. 6',
   '{"de": "Daten, die nur innerhalb des BBL bzw. der Bundesverwaltung zugänglich sind.", "en": "Data accessible only within BBL or the federal administration."}',
   'Federal administration staff only'),
  ('uuid-class-003', 'Confidential', 'Vertraulich',   'Confidentiel',  'Confidenziale',  2, 'ISG Art. 7',
   '{"de": "Vertrauliche Daten, deren Offenlegung den Interessen des Bundes schaden könnte.", "en": "Confidential data whose disclosure could harm federal interests."}',
   'Authorized personnel with need-to-know'),
  ('uuid-class-004', 'Secret', 'Geheim', 'Secret', 'Segreto', 3, 'ISG Art. 10',
   '{"de": "Informationen deren Kenntnisnahme durch Unbefugte den Landesinteressen einen schweren Schaden zufügen kann.", "en": "Information whose disclosure to unauthorized persons could cause serious damage to national interests."}',
   'Physical and digital isolation required');

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. DATASET CLASSIFICATIONS (junction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dataset_classification (dataset_id, classification_id, assigned_at, assigned_by) VALUES
  ('uuid-ds-001', 'uuid-class-002', '2024-06-01T08:00:00Z', 'uuid-user-002'),   -- VIBDBE: Internal
  ('uuid-ds-002', 'uuid-class-002', '2024-06-01T08:00:00Z', 'uuid-user-003'),   -- VIBDAU: Internal
  ('uuid-ds-003', 'uuid-class-003', '2024-06-01T08:00:00Z', 'uuid-user-003'),   -- VIBDMV: Confidential (contracts)
  ('uuid-ds-004', 'uuid-class-003', '2024-06-15T08:00:00Z', 'uuid-user-003'),   -- VIBDKD: Confidential (conditions)
  ('uuid-ds-005', 'uuid-class-003', '2024-06-15T08:00:00Z', 'uuid-user-003'),   -- VIBDBP: Confidential (partners)
  ('uuid-ds-006', 'uuid-class-001', '2024-06-02T07:00:00Z', 'uuid-user-002'),   -- BUILDING: Public
  ('uuid-ds-007', 'uuid-class-001', '2024-06-02T07:00:00Z', 'uuid-user-002'),   -- PARCEL: Public
  ('uuid-ds-008', 'uuid-class-002', '2024-06-15T08:00:00Z', 'uuid-user-004'),   -- ENERGY_METER: Internal
  ('uuid-ds-009', 'uuid-class-003', '2024-07-01T08:00:00Z', 'uuid-user-001');   -- DOC_BUILDING: Confidential

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. DATASET CONTACTS (junction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dataset_contact (dataset_id, contact_id, role) VALUES
  ('uuid-ds-001', 'uuid-contact-002', 'data_steward'),
  ('uuid-ds-001', 'uuid-contact-005', 'data_custodian'),
  ('uuid-ds-002', 'uuid-contact-003', 'data_steward'),
  ('uuid-ds-002', 'uuid-contact-005', 'data_custodian'),
  ('uuid-ds-003', 'uuid-contact-003', 'data_steward'),
  ('uuid-ds-004', 'uuid-contact-003', 'data_steward'),
  ('uuid-ds-005', 'uuid-contact-003', 'data_steward'),
  ('uuid-ds-006', 'uuid-contact-002', 'data_steward'),
  ('uuid-ds-006', 'uuid-contact-005', 'data_custodian'),
  ('uuid-ds-007', 'uuid-contact-002', 'data_steward'),
  ('uuid-ds-008', 'uuid-contact-004', 'subject_matter_expert'),
  ('uuid-ds-009', 'uuid-contact-001', 'data_owner');

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. DATA PRODUCTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_product (id, name_en, name_de, name_fr, name_it, description, publisher, license, theme, keyword, spatial_coverage, temporal_start, temporal_end, update_frequency, certified, issued, modified) VALUES

  ('uuid-dp-001',
   'Building Registry API', 'Gebäuderegister API', 'API Registre des batiments', 'API Registro degli edifici',
   '{"en": "REST API providing authoritative building master data for the federal real estate portfolio. Combines data from SAP RE-FX and GIS IMMO with EGID cross-referencing.", "de": "REST-API mit den massgeblichen Gebäudestammdaten des Bundesimmobilienportfolios. Kombiniert Daten aus SAP RE-FX und GIS IMMO mit EGID-Verknüpfung."}',
   'DRES – Digital Solutions',
   'OGD CH Terms of Use',
   '["http://publications.europa.eu/resource/authority/data-theme/GOVE"]',
   '{"en": ["building", "real estate", "EGID", "federal property"], "de": ["Gebäude", "Immobilien", "EGID", "Bundesimmobilien"]}',
   'Switzerland',
   '2020-01-01', NULL,
   'http://publications.europa.eu/resource/authority/frequency/DAILY',
   1,
   '2024-06-01T08:00:00Z', '2024-11-15T08:00:00Z'),

  ('uuid-dp-002',
   'Energy Monitoring Export', 'Energie-Monitoring Export', 'Export Monitoring energetique', 'Esportazione Monitoraggio energetico',
   '{"en": "Periodic export of energy consumption data for all federal buildings. Includes meter readings, heating plant data, and aggregated measurements.", "de": "Periodischer Export der Energieverbrauchsdaten aller Bundesgebäude. Enthält Zählerständ, Heizzentralen-Daten und aggregierte Messwerte."}',
   'DRES – Energie & Nachhaltigkeit',
   'CC BY 4.0',
   '["http://publications.europa.eu/resource/authority/data-theme/ENER","http://publications.europa.eu/resource/authority/data-theme/ENVI"]',
   '{"en": ["energy", "meter", "heating", "sustainability"], "de": ["Energie", "Zähler", "Heizung", "Nachhaltigkeit"]}',
   'Switzerland',
   '2022-01-01', NULL,
   'http://publications.europa.eu/resource/authority/frequency/QUARTERLY',
   1,
   '2024-09-01T08:00:00Z', '2024-10-01T07:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. DATA PRODUCT <-> DATASET (junction: prov:wasDerivedFrom)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_product_dataset (data_product_id, dataset_id) VALUES
  ('uuid-dp-001', 'uuid-ds-001'),   -- Gebäuderegister <- SAP VIBDBE
  ('uuid-dp-001', 'uuid-ds-006'),   -- Gebäuderegister <- GIS BUILDING
  ('uuid-dp-001', 'uuid-ds-007'),   -- Gebäuderegister <- GIS PARCEL
  ('uuid-dp-002', 'uuid-ds-006'),   -- Energie-Monitoring <- GIS BUILDING
  ('uuid-dp-002', 'uuid-ds-008');   -- Energie-Monitoring <- GIS ENERGY_METER

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. DATA PRODUCT CLASSIFICATIONS (junction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_product_classification (data_product_id, classification_id) VALUES
  ('uuid-dp-001', 'uuid-class-001'),   -- Gebäuderegister API: Public
  ('uuid-dp-002', 'uuid-class-002');   -- Energie-Monitoring: Internal

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. DATA PRODUCT CONTACTS (junction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_product_contact (data_product_id, contact_id, role) VALUES
  ('uuid-dp-001', 'uuid-contact-001', 'data_owner'),
  ('uuid-dp-001', 'uuid-contact-002', 'data_steward'),
  ('uuid-dp-001', 'uuid-contact-005', 'publisher'),
  ('uuid-dp-002', 'uuid-contact-004', 'data_owner'),
  ('uuid-dp-002', 'uuid-contact-002', 'data_steward');

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. DISTRIBUTIONS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO distribution (id, data_product_id, name_en, name_de, name_fr, name_it, access_url, download_url, media_type, access_type, format, byte_size, "conformsTo", description, availability) VALUES

  ('uuid-dist-001', 'uuid-dp-001',
   'REST API (JSON)',        'REST-API (JSON)',         'API REST (JSON)',        'API REST (JSON)',
   'https://api.bbl.admin.ch/v1/buildings', NULL,
   'application/json', 'rest_api', 'JSON', NULL,
   'OpenAPI 3.0',
   '{"de": "RESTful API mit Gebäudestammdaten im JSON-Format. Paginierung, Filter nach EGID, Gemeinde und Kategorie.", "en": "RESTful API with building master data in JSON format. Pagination, filtering by EGID, municipality, and category."}',
   'stable'),

  ('uuid-dist-002', 'uuid-dp-001',
   'OGC WFS (GeoJSON)',     'OGC WFS (GeoJSON)',       'OGC WFS (GeoJSON)',      'OGC WFS (GeoJSON)',
   'https://gis-immo.bbl.admin.ch/wfs?service=WFS&request=GetCapabilities', NULL,
   'application/geo+json', 'rest_api', 'GeoJSON', NULL,
   'OGC WFS 2.0',
   '{"de": "OGC Web Feature Service mit Gebäudepolygonen und Sachdaten. Unterstützt CQL-Filter und räumliche Abfragen.", "en": "OGC Web Feature Service with building polygons and attribute data. Supports CQL filtering and spatial queries."}',
   'stable'),

  ('uuid-dist-003', 'uuid-dp-002',
   'Quarterly CSV Export',   'Quartals-CSV-Export',     'Export CSV trimestriel', 'Esportazione CSV trimestrale',
   'https://data.bbl.admin.ch/energy/export', 'https://data.bbl.admin.ch/energy/export/latest.csv',
   'text/csv', 'file_export', 'CSV', 3200000,
   NULL,
   '{"de": "Quartalsweiser CSV-Export aller Energiemesswerte. Spalten: Zähler-Nr, Gebäude-ID, Zählertyp, Messwert, Einheit, Zeitstempel.", "en": "Quarterly CSV export of all energy measurements. Columns: Meter No., Building ID, Meter Type, Value, Unit, Timestamp."}',
   'stable'),

  ('uuid-dist-004', 'uuid-dp-002',
   'Annual PDF Report',      'Jahres-PDF-Bericht',      'Rapport PDF annuel',     'Rapporto PDF annuale',
   'https://data.bbl.admin.ch/energy/report', 'https://data.bbl.admin.ch/energy/report/2025.pdf',
   'application/pdf', 'report', 'PDF', 8500000,
   NULL,
   '{"de": "Jährlicher Energiebericht als PDF mit Grafiken, Trends und Handlungsempfehlungen.", "en": "Annual energy report as PDF with charts, trends, and recommendations."}',
   'stable');

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. LINEAGE LINKS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO lineage_link (id, source_dataset_id, target_dataset_id, transformation_type, tool_name, job_name, description, frequency, recorded_at, recorded_by) VALUES

  -- SAP VIBDBE -> GIS BUILDING (daily ETL)
  ('uuid-lin-001', 'uuid-ds-001', 'uuid-ds-006',
   'transform', 'FME', 'SAP2GIS_Buildings',
   '{"de": "Täglicher ETL-Prozess: SAP-Gebäudestammdaten werden über FME in GIS-Polygone überführt. EGID dient als Verknüpfungsschlüssel. Koordinatentransformation CH1903+ nach LV95.", "en": "Daily ETL process: SAP building master data is transformed into GIS polygons via FME. EGID serves as the linking key. Coordinate transformation CH1903+ to LV95."}',
   'daily',
   '2024-11-15T02:00:00Z', 'uuid-user-005'),

  -- GIS PARCEL -> SAP VIBDBE (weekly sync back)
  ('uuid-lin-002', 'uuid-ds-007', 'uuid-ds-001',
   'copy', 'SAP PI', 'GIS_Parcel_Sync',
   '{"de": "Rücksynchronisation von GIS-Parzellendaten nach SAP für die Grundstückszuordnung. Wöchentlich.", "en": "Back-synchronization of GIS parcel data to SAP for land parcel assignment. Weekly."}',
   'weekly',
   '2024-11-15T02:00:00Z', 'uuid-user-005'),

  -- SAP VIBDAU -> SAP VIBDMV (internal join for lease-to-unit mapping)
  ('uuid-lin-003', 'uuid-ds-002', 'uuid-ds-003',
   'join', 'SAP ABAP', 'MO_MV_Link',
   '{"de": "Verknüpfung der Mietobjekte mit Mietverträgen über Fremdschlüssel MIOBJNR innerhalb SAP.", "en": "Join of rental units with lease agreements via foreign key MIOBJNR within SAP."}',
   'realtime',
   '2024-06-01T08:00:00Z', 'uuid-user-003'),

  -- GIS ENERGY_METER -> data aggregation (quarterly)
  ('uuid-lin-004', 'uuid-ds-008', 'uuid-ds-006',
   'aggregate', 'Python', 'Energy_Aggregation',
   '{"de": "Aggregation der Energiemesswerte auf Gebäudebene und Verknüpfung mit Gebäudepolygonen für den Energiebericht.", "en": "Aggregation of energy measurements at building level and linking with building polygons for the energy report."}',
   'quarterly',
   '2024-10-01T07:00:00Z', 'uuid-user-004');

-- ─────────────────────────────────────────────────────────────────────────────
-- 23. RELATIONSHIP EDGES (materialised)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO relationship_edge (source_id, source_type, target_id, target_type, rel_type, weight, derived_from, refreshed_at) VALUES

  -- concept -> field (realizes via concept_mapping)
  ('uuid-concept-004', 'concept', 'uuid-field-001', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-004', 'concept', 'uuid-field-028', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-009', 'concept', 'uuid-field-007', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-010', 'concept', 'uuid-field-012', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-003', 'concept', 'uuid-field-033', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-015', 'concept', 'uuid-field-023', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-012', 'concept', 'uuid-field-039', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-013', 'concept', 'uuid-field-038', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-014', 'concept', 'uuid-field-042', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),

  -- dataset -> dataset (lineage)
  ('uuid-ds-001', 'dataset', 'uuid-ds-006', 'dataset', 'lineage_downstream', 1.0, 'lineage_link', '2024-12-02T23:00:00Z'),
  ('uuid-ds-006', 'dataset', 'uuid-ds-001', 'dataset', 'lineage_upstream',   1.0, 'lineage_link', '2024-12-02T23:00:00Z'),
  ('uuid-ds-008', 'dataset', 'uuid-ds-006', 'dataset', 'lineage_downstream', 1.0, 'lineage_link', '2024-12-02T23:00:00Z'),
  ('uuid-ds-007', 'dataset', 'uuid-ds-001', 'dataset', 'lineage_downstream', 1.0, 'lineage_link', '2024-12-02T23:00:00Z'),

  -- data_product -> dataset (derived_from)
  ('uuid-dp-001', 'data_product', 'uuid-ds-001', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),
  ('uuid-dp-001', 'data_product', 'uuid-ds-006', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),
  ('uuid-dp-001', 'data_product', 'uuid-ds-007', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),
  ('uuid-dp-002', 'data_product', 'uuid-ds-006', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),
  ('uuid-dp-002', 'data_product', 'uuid-ds-008', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),

  -- concept -> concept (skos broader / related)
  ('uuid-concept-001', 'concept', 'uuid-concept-002', 'concept', 'skos:broader',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-002', 'concept', 'uuid-concept-004', 'concept', 'skos:broader',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-004', 'concept', 'uuid-concept-006', 'concept', 'skos:broader',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-006', 'concept', 'uuid-concept-007', 'concept', 'skos:broader',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-004', 'concept', 'uuid-concept-005', 'concept', 'skos:broader',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-005', 'concept', 'uuid-concept-009', 'concept', 'skos:related',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-009', 'concept', 'uuid-concept-010', 'concept', 'skos:related',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-010', 'concept', 'uuid-concept-011', 'concept', 'skos:related',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-012', 'concept', 'uuid-concept-004', 'concept', 'skos:related',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-013', 'concept', 'uuid-concept-004', 'concept', 'skos:related',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-014', 'concept', 'uuid-concept-013', 'concept', 'skos:related',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),

  -- sibling datasets (same schema)
  ('uuid-ds-001', 'dataset', 'uuid-ds-002', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),
  ('uuid-ds-001', 'dataset', 'uuid-ds-003', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),
  ('uuid-ds-001', 'dataset', 'uuid-ds-004', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),
  ('uuid-ds-002', 'dataset', 'uuid-ds-003', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),
  ('uuid-ds-002', 'dataset', 'uuid-ds-004', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),
  ('uuid-ds-003', 'dataset', 'uuid-ds-004', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),
  ('uuid-ds-006', 'dataset', 'uuid-ds-007', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 24. DATA PROFILES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_profile (id, dataset_id, row_count, null_percentage, cardinality, min_value, max_value, completeness_score, format_validity_score, sample_values, profiled_at, profiler) VALUES
  ('uuid-prof-001', 'uuid-ds-001', 8450,  0.03, 8450,  '1000001', '1008450', 0.97, 0.99, '["1000001", "1003421", "1007892"]', '2024-12-01T02:30:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-002', 'uuid-ds-002', 32100, 0.05, 32100, 'MO-00001','MO-32100',0.95, 0.98, '["MO-00001", "MO-15234", "MO-31999"]', '2024-12-01T02:45:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-003', 'uuid-ds-003', 15600, 0.04, 15600, 'MV-2020-001','MV-2024-999',0.96, 0.97, '["MV-2020-001", "MV-2023-456"]', '2024-12-01T03:00:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-004', 'uuid-ds-004', 42000, 0.06, 42000, 'KD-00001','KD-42000',0.94, 0.96, '["KD-00001", "KD-21000", "KD-41999"]', '2024-12-01T03:15:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-005', 'uuid-ds-005', 18500, 0.02, 18500, 'BP-00001','BP-18500',0.98, 0.99, '["BP-00001", "BP-09250", "BP-18499"]', '2024-12-01T03:30:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-006', 'uuid-ds-006', 9200,  0.02, 9200,  '10001',   '19200',   0.98, 0.99, '[10001, 14523, 18999]', '2024-12-02T01:30:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-007', 'uuid-ds-007', 3400,  0.01, 3400,  'P-3001',  'P-6400',  0.99, 0.99, '["P-3001", "P-4500", "P-6400"]', '2024-12-02T01:45:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-008', 'uuid-ds-008', 12600, 0.08, 12600, '6001',    '18600',   0.92, 0.95, '[6001, 10234, 18599]', '2024-11-20T08:30:00Z', 'catalog-scanner v2.1');

-- ─────────────────────────────────────────────────────────────────────────────
-- 25. DATA POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_policy (id, name_en, name_de, name_fr, name_it, policy_type, rule_definition, legal_basis, owner, valid_from, valid_to) VALUES
  ('uuid-pol-001',
   'Federal Data Retention 10y',    'Bundesaufbewahrung 10 Jahre',    'Conservation federale 10 ans',    'Conservazione federale 10 anni',
   'retention',
   '{"de": "Alle Immobilienstammdaten sind mindestens 10 Jahre nach Abgang des Objekts aufzubewahren.", "en": "All real estate master data must be retained for at least 10 years after the object is decommissioned."}',
   'BGA Art. 6',
   'DRES – Digital Solutions',
   '2023-12-31T23:00:00Z', NULL),

  ('uuid-pol-002',
   'Lease Data Access Restriction', 'Zugriffsbeschränkung Mietdaten', 'Restriction d''acces donnees locatives', 'Restrizione accesso dati locativi',
   'access',
   '{"de": "Mietvertragsdaten (inkl. Mietzinse und Geschäftspartner) sind vertraulich und nur für berechtigte Fachpersonen zugänglich.", "en": "Lease contract data (including rents and business partners) is confidential and accessible only to authorized specialists."}',
   'ISG Art. 7, OR Art. 253ff',
   'DRES – Bewirtschaftung',
   '2023-12-31T23:00:00Z', NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 26. DATASET POLICIES (junction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dataset_policy (dataset_id, policy_id) VALUES
  ('uuid-ds-001', 'uuid-pol-001'),
  ('uuid-ds-002', 'uuid-pol-001'),
  ('uuid-ds-003', 'uuid-pol-001'),
  ('uuid-ds-003', 'uuid-pol-002'),
  ('uuid-ds-004', 'uuid-pol-001'),
  ('uuid-ds-004', 'uuid-pol-002'),
  ('uuid-ds-005', 'uuid-pol-001'),
  ('uuid-ds-005', 'uuid-pol-002'),
  ('uuid-ds-006', 'uuid-pol-001'),
  ('uuid-ds-007', 'uuid-pol-001'),
  ('uuid-ds-008', 'uuid-pol-001'),
  ('uuid-ds-009', 'uuid-pol-001');

-- ─────────────────────────────────────────────────────────────────────────────
-- 27. CONCEPT RELATIONS (junction: skos:broader, skos:related)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO concept_relation (source_concept_id, target_concept_id, relation_type) VALUES
  -- Architektonische Sicht hierarchy
  ('uuid-concept-001', 'uuid-concept-002', 'skos:broader'),    -- Areal broader Kampus
  ('uuid-concept-002', 'uuid-concept-004', 'skos:broader'),    -- Kampus broader Gebäude
  ('uuid-concept-003', 'uuid-concept-001', 'skos:related'),    -- Grundstück related Areal
  ('uuid-concept-004', 'uuid-concept-006', 'skos:broader'),    -- Gebäude broader Geschoss
  ('uuid-concept-006', 'uuid-concept-007', 'skos:broader'),    -- Geschoss broader Raum
  ('uuid-concept-004', 'uuid-concept-005', 'skos:broader'),    -- Gebäude broader Nutzungseinheit

  -- Mieter Management links
  ('uuid-concept-005', 'uuid-concept-009', 'skos:related'),    -- Nutzungseinheit related Mietobjekt
  ('uuid-concept-009', 'uuid-concept-010', 'skos:related'),    -- Mietobjekt related Mietvertrag
  ('uuid-concept-010', 'uuid-concept-011', 'skos:related'),    -- Mietvertrag related Kondition

  -- Energie links
  ('uuid-concept-012', 'uuid-concept-004', 'skos:related'),    -- Heizzentrale related Gebäude
  ('uuid-concept-013', 'uuid-concept-004', 'skos:related'),    -- Stromzähler related Gebäude
  ('uuid-concept-014', 'uuid-concept-013', 'skos:related'),    -- Betriebsmesswert related Stromzähler

  -- Geschäftspartner links
  ('uuid-concept-015', 'uuid-concept-016', 'skos:related'),    -- Person related Kontakt
  ('uuid-concept-015', 'uuid-concept-017', 'skos:related'),    -- Person related Unternehmen

  -- Finanzen links
  ('uuid-concept-019', 'uuid-concept-018', 'skos:broader'),    -- Buchungskreis broader Wirtschaftseinheit
  ('uuid-concept-018', 'uuid-concept-004', 'skos:related'),    -- Wirtschaftseinheit related Gebäude
  ('uuid-concept-018', 'uuid-concept-009', 'skos:related');

-- =============================================================================
-- END OF SEED DATA
-- =============================================================================
