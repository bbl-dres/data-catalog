-- =============================================================================
-- BBL Datenkatalog – Seed / Test Data
-- Version: 0.2 (draft)
-- Generated for: SQLite (sql.js in-browser)
-- Domain: Swiss Federal Office for Buildings and Logistics (BBL)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USERS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "user" (id, name, email, catalog_role, preferred_language, department, active, created_at) VALUES
  ('uuid-user-001', 'Stefan Müller',    'stefan.mueller@bbl.admin.ch',   'admin',   'de', 'DRES – Digital Solutions',       1,'2024-01-15T07:00:00Z'),
  ('uuid-user-002', 'Claudia Bernasconi','claudia.bernasconi@bbl.admin.ch','steward','de', 'DRES – Portfoliomanagement',    1,'2024-02-01T08:00:00Z'),
  ('uuid-user-003', 'Marc Favre',        'marc.favre@bbl.admin.ch',      'steward', 'fr', 'DRES – Bewirtschaftung',         1,'2024-02-10T09:00:00Z'),
  ('uuid-user-004', 'Anna Keller',       'anna.keller@bbl.admin.ch',     'analyst', 'de', 'DRES – Energie & Nachhaltigkeit',1, '2024-03-01T07:30:00Z'),
  ('uuid-user-005', 'Luca Bentivoglio',  'luca.bentivoglio@bbl.admin.ch','viewer',  'it', 'DRES – Digital Solutions',       1,'2024-03-15T08:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CONTACTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO contact (id, name, email, phone, organisation, role, user_id) VALUES
  ('uuid-contact-001', 'Stefan Müller',      'stefan.mueller@bbl.admin.ch',    '+41 58 462 11 01', 'BBL – DRES Digital Solutions',       'data_owner',             'uuid-user-001'),
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
   'Immobilien-Fachbegriffe',
   'Vocabulaire immobilier OFC',
   'Vocabolario immobiliare UFCL',
   '{"en": "Authoritative vocabulary of real estate business terms used by the Swiss Federal Office for Buildings and Logistics (BBL). Covers buildings, land parcels, rental objects, energy, and cost management.", "de": "Massgebliches Vokabular der Immobilien-Fachbegriffe des Bundesamts für Bauten und Logistik (BBL). Umfasst Gebäude, Grundstücke, Mietobjekte, Energie und Kostenmanagement.", "fr": "Vocabulaire de référence des termes immobiliers de l''Office fédéral des constructions et de la logistique (OFCL). Couvre les bâtiments, les parcelles, les objets locatifs, l''énergie et la gestion des coûts.", "it": "Vocabolario di riferimento dei termini immobiliari dell''Ufficio federale delle costruzioni e della logistica (UFCL). Comprende edifici, fondi, oggetti in locazione, energia e gestione dei costi."}',
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
   'Buildings',        'Gebäude',       'Bâtiments',      'Edifici',
   '{"en": "Concepts related to buildings, properties, and land parcels in the federal real estate portfolio.", "de": "Konzepte rund um Gebäude, Liegenschaften und Grundstücke im Immobilienportfolio des Bundes."}',
   1),
  ('uuid-coll-002', 'uuid-vocab-001', NULL,
   'Rental Objects',   'Mietobjekte',   'Objets locatifs', 'Oggetti in locazione',
   '{"en": "Concepts related to rental units, occupancy management, and lease agreements.", "de": "Konzepte rund um Mietobjekte, Nutzungseinheiten und Mietverträge."}',
   2),
  ('uuid-coll-003', 'uuid-vocab-001', NULL,
   'Energy',           'Energie',       'Énergie',         'Energia',
   '{"en": "Concepts related to energy management, reference areas, and construction cost benchmarks.", "de": "Konzepte rund um Energiemanagement, Bezugsflächen und Baukostenkennwerte."}',
   3);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CONCEPTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO concept (id, vocabulary_id, collection_id, name_en, name_de, name_fr, name_it, alt_names, definition, scope_note, status, standard_ref, egid_relevant, egrid_relevant, steward_id, approved_at, created_at, modified_at) VALUES

  -- Gebäude collection
  ('uuid-concept-001', 'uuid-vocab-001', 'uuid-coll-001',
   'Building', 'Gebäude', 'Bâtiment', 'Edificio',
   '{"de": ["Bauwerk", "Bau"], "fr": ["Construction"]}',
   '{"en": "A permanent, roofed structure with walls that is registered in the GWR (Federal Register of Buildings and Dwellings) and identified by an EGID.", "de": "Ein dauerhaftes, überdachtes Bauwerk mit Wänden, das im eidgenössischen Gebäude- und Wohnungsregister (GWR) erfasst und durch eine EGID identifiziert wird.", "fr": "Une construction permanente couverte avec des murs, enregistrée dans le RegBL (Registre fédéral des bâtiments et des logements) et identifiée par un EGID.", "it": "Una costruzione permanente coperta con muri, registrata nel REA (Registro federale degli edifici e delle abitazioni) e identificata da un EGID."}',
   '{"de": "Im BBL-Kontext umfasst «Gebäude» ausschliesslich Bauwerke im Eigentum oder in der Verwaltung des Bundes."}',
   'approved', 'eCH-0071 v2.0, GWR', 1,0,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-02-01T07:00:00Z', '2024-06-01T08:00:00Z'),

  ('uuid-concept-002', 'uuid-vocab-001', 'uuid-coll-001',
   'Property', 'Liegenschaft', 'Immeuble', 'Immobile',
   '{"de": ["Objekt", "Immobilie"]}',
   '{"en": "A real estate property comprising one or more buildings and associated land, managed as a single administrative unit.", "de": "Eine Liegenschaft bestehend aus einem oder mehreren Gebäuden und zugehörigem Land, die als eine Verwaltungseinheit bewirtschaftet wird.", "fr": "Un bien immobilier composé d''un ou plusieurs bâtiments et du terrain associé, géré comme une unité administrative unique.", "it": "Una proprietà immobiliare composta da uno o più edifici e terreno associato, gestita come un''unica unità amministrativa."}',
   NULL,
   'approved', 'VILB Anhang A', 1,1,
   'uuid-user-002', '2024-06-01T08:00:00Z',
   '2024-02-01T07:30:00Z', '2024-06-01T08:00:00Z'),

  ('uuid-concept-003', 'uuid-vocab-001', 'uuid-coll-001',
   'Land Parcel', 'Grundstück', 'Bien-fonds', 'Fondo',
   '{"de": ["Parzelle"]}',
   '{"en": "A legally defined parcel of land registered in the Swiss land registry, identified by an EGRID.", "de": "Ein im Grundbuch eingetragenes, rechtlich definiertes Stück Land, identifiziert durch eine EGRID.", "fr": "Une parcelle de terrain juridiquement définie, inscrite au registre foncier et identifiée par un EGRID.", "it": "Una parcella di terreno definita giuridicamente, iscritta nel registro fondiario e identificata da un EGRID."}',
   NULL,
   'approved', 'ZGB Art. 655', 0,1,
   'uuid-user-002', '2024-06-15T07:00:00Z',
   '2024-02-05T08:00:00Z', '2024-06-15T07:00:00Z'),

  -- Mietobjekte collection
  ('uuid-concept-004', 'uuid-vocab-001', 'uuid-coll-002',
   'Rental Unit', 'Mietobjekt', 'Objet locatif', 'Oggetto in locazione',
   '{"de": ["MO", "Mieteinheit"], "fr": ["Unité locative"]}',
   '{"en": "A physical or virtual space within a building that can be rented to a tenant. Corresponds to a business partner allocation in SAP RE-FX.", "de": "Ein physischer oder virtueller Raum innerhalb eines Gebäudes, der an einen Mieter vermietet werden kann. Entspricht einer Geschäftspartnerzuordnung in SAP RE-FX.", "fr": "Un espace physique ou virtuel dans un bâtiment pouvant être loué à un locataire. Correspond à une affectation de partenaire commercial dans SAP RE-FX.", "it": "Uno spazio fisico o virtuale all''interno di un edificio che può essere affittato a un inquilino. Corrisponde a un''assegnazione di partner commerciale in SAP RE-FX."}',
   '{"de": "Ein Mietobjekt kann aus mehreren Nutzungseinheiten bestehen."}',
   'approved', 'VILB Anhang A', 1,0,
   'uuid-user-003', '2024-07-01T08:00:00Z',
   '2024-03-01T07:00:00Z', '2024-07-01T08:00:00Z'),

  ('uuid-concept-005', 'uuid-vocab-001', 'uuid-coll-002',
   'Occupancy Unit', 'Nutzungseinheit', 'Unité d''utilisation', 'Unità d''uso',
   '{"de": ["NE"]}',
   '{"en": "The smallest unit of space with a defined usage type according to SIA 416. Used for area calculations and benchmarking.", "de": "Die kleinste Raumeinheit mit definierter Nutzungsart gemäss SIA 416. Wird für Flächenberechnungen und Benchmarking verwendet.", "fr": "La plus petite unité spatiale avec un type d''utilisation défini selon SIA 416. Utilisée pour les calculs de surfaces et le benchmarking.", "it": "La più piccola unità spaziale con un tipo di utilizzo definito secondo SIA 416. Utilizzata per i calcoli delle superfici e il benchmarking."}',
   NULL,
   'approved', 'SIA 416 §3', 1,0,
   'uuid-user-003', '2024-07-15T08:00:00Z',
   '2024-03-05T08:00:00Z', '2024-07-15T08:00:00Z'),

  ('uuid-concept-006', 'uuid-vocab-001', 'uuid-coll-002',
   'Lease Agreement', 'Mietvertrag', 'Contrat de bail', 'Contratto di locazione',
   '{"de": ["MV", "Mietkontrakt"]}',
   '{"en": "A legally binding contract between the Confederation (as landlord or tenant) and a counterparty, governing the use and payment for one or more rental units.", "de": "Ein rechtsverbindlicher Vertrag zwischen dem Bund (als Vermieter oder Mieter) und einer Gegenpartei über die Nutzung und Bezahlung eines oder mehrerer Mietobjekte.", "fr": "Un contrat juridiquement contraignant entre la Confédération (en tant que bailleur ou locataire) et une contrepartie, régissant l''utilisation et le paiement d''un ou plusieurs objets locatifs.", "it": "Un contratto giuridicamente vincolante tra la Confederazione (come locatore o locatario) e una controparte, che disciplina l''uso e il pagamento di uno o più oggetti in locazione."}',
   NULL,
   'draft', 'OR Art. 253ff', 0,0,
   'uuid-user-003', NULL,
   '2024-04-01T06:00:00Z', '2024-08-01T08:00:00Z'),

  -- Energie collection
  ('uuid-concept-007', 'uuid-vocab-001', 'uuid-coll-003',
   'Energy Reference Area', 'Energiebezugsfläche', 'Surface de référence énergétique', 'Superficie di riferimento energetico',
   '{"de": ["EBF"]}',
   '{"en": "The sum of all heated or air-conditioned gross floor areas of a building, measured according to SIA 416. Used as the denominator for energy intensity calculations (kWh/m2).", "de": "Die Summe aller beheizten oder klimatisierten Bruttogeschossflächen eines Gebäudes, gemessen nach SIA 416. Wird als Nenner für Energiekennwertberechnungen (kWh/m2) verwendet.", "fr": "La somme de toutes les surfaces brutes de plancher chauffées ou climatisées d''un bâtiment, mesurée selon SIA 416. Utilisée comme dénominateur pour le calcul de l''intensité énergétique (kWh/m2).", "it": "La somma di tutte le superfici lorde di piano riscaldate o climatizzate di un edificio, misurata secondo SIA 416. Utilizzata come denominatore per il calcolo dell''intensità energetica (kWh/m2)."}',
   NULL,
   'approved', 'SIA 416 §3.6', 1,0,
   'uuid-user-004', '2024-08-01T07:00:00Z',
   '2024-04-10T06:00:00Z', '2024-08-01T07:00:00Z'),

  ('uuid-concept-008', 'uuid-vocab-001', 'uuid-coll-003',
   'Construction Cost Index', 'Baukostenindex', 'Indice du coût de la construction', 'Indice dei costi di costruzione',
   '{"de": ["BKI", "Kostenkennwert"]}',
   '{"en": "A statistical index tracking changes in construction costs over time, published by the Swiss Federal Statistical Office (BFS). Used for cost planning and benchmarking of federal building projects.", "de": "Ein statistischer Index zur Messung der Baukostenentwicklung, publiziert vom Bundesamt für Statistik (BFS). Wird für die Kostenplanung und das Benchmarking von Bundesbauprojekten verwendet.", "fr": "Un indice statistique mesurant l''évolution des coûts de construction, publié par l''Office fédéral de la statistique (OFS). Utilisé pour la planification des coûts et le benchmarking des projets de construction fédéraux.", "it": "Un indice statistico che misura l''evoluzione dei costi di costruzione, pubblicato dall''Ufficio federale di statistica (UST). Utilizzato per la pianificazione dei costi e il benchmarking dei progetti edilizi federali."}',
   NULL,
   'draft', 'eBKP-H 2012', 0,0,
   'uuid-user-004', NULL,
   '2024-05-01T06:00:00Z', '2024-09-01T08:00:00Z'),

  ('uuid-concept-009', 'uuid-vocab-001', 'uuid-coll-003',
   'GEAK Energy Certificate', 'Gebäudeenergieausweis (GEAK)', 'Certificat énergétique cantonal (CECB)', 'Certificato energetico cantonale (CECE)',
   '{"de": ["GEAK", "Gebäudeenergieausweis"], "fr": ["CECB"], "it": ["CECE"]}',
   '{"en": "The GEAK (Gebäudeenergieausweis der Kantone) is the official Swiss cantonal energy certificate that rates a building''s energy efficiency on a scale from A (very efficient) to G (least efficient).", "de": "Der GEAK (Gebäudeenergieausweis der Kantone) ist der offizielle Schweizer Energieausweis, der die Energieeffizienz eines Gebäudes auf einer Skala von A (sehr effizient) bis G (wenig effizient) bewertet.", "fr": "Le CECB (Certificat énergétique cantonal des bâtiments) est le certificat énergétique officiel suisse qui évalue l''efficacité énergétique d''un bâtiment sur une échelle de A (très efficace) à G (peu efficace).", "it": "Il CECE (Certificato energetico cantonale degli edifici) è il certificato energetico ufficiale svizzero che valuta l''efficienza energetica di un edificio su una scala da A (molto efficiente) a G (poco efficiente)."}',
   NULL,
   'approved', 'SIA 380/1, EnDK', 1, 0,
   'uuid-user-004', '2024-09-01T08:00:00Z',
   '2024-05-15T06:00:00Z', '2024-09-01T08:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CONCEPT ATTRIBUTES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO concept_attribute (id, concept_id, name_en, name_de, name_fr, name_it, definition, value_type, code_list_id, required, standard_ref, sort_order) VALUES

  -- Gebäude attributes
  ('uuid-cattr-001', 'uuid-concept-001', 'EGID',               'EGID',                 'EGID',                 'EGID',
   '{"de": "Eidgenössischer Gebäudeidentifikator aus dem GWR.", "en": "Federal building identifier from the GWR."}',
   'integer', NULL, 1,'eCH-0071', 1),
  ('uuid-cattr-002', 'uuid-concept-001', 'Year of Construction','Baujahr',              'Année de construction', 'Anno di costruzione',
   '{"de": "Jahr der Fertigstellung des Gebäudes.", "en": "Year of building completion."}',
   'integer', NULL, 1,'GWR', 2),
  ('uuid-cattr-003', 'uuid-concept-001', 'Building Category',   'Gebäudekategorie',     'Catégorie de bâtiment', 'Categoria di edificio',
   '{"de": "Klassifikation des Gebäudetyps nach GWR-Katalog.", "en": "Classification of building type per GWR catalog."}',
   'code', 'uuid-codelist-001', 1,'eCH-0071', 3),
  ('uuid-cattr-004', 'uuid-concept-001', 'Number of Floors',    'Anzahl Geschosse',     'Nombre d''étages',     'Numero di piani',
   '{"de": "Gesamtzahl der ober- und unterirdischen Geschosse.", "en": "Total number of above- and below-ground floors."}',
   'integer', NULL, 0,'GWR', 4),
  ('uuid-cattr-005', 'uuid-concept-001', 'Energy Source',       'Energieträger',        'Agent énergétique',    'Vettore energetico',
   '{"de": "Hauptsächlicher Energieträger für Heizung.", "en": "Primary energy source for heating."}',
   'code', 'uuid-codelist-003', 0,'GWR', 5),

  -- Liegenschaft attributes
  ('uuid-cattr-006', 'uuid-concept-002', 'Property Number',     'Liegenschaftsnummer',  'Numéro d''immeuble',   'Numero di proprietà',
   '{"de": "Eindeutige Kennung der Liegenschaft im SAP RE-FX.", "en": "Unique property identifier in SAP RE-FX."}',
   'text', NULL, 1,NULL, 1),
  ('uuid-cattr-007', 'uuid-concept-002', 'Address',             'Adresse',              'Adresse',              'Indirizzo',
   '{"de": "Offizielle Postadresse der Liegenschaft.", "en": "Official postal address of the property."}',
   'text', NULL, 1,NULL, 2),
  ('uuid-cattr-008', 'uuid-concept-002', 'Land Area',           'Grundstücksfläche',    'Surface du terrain',   'Superficie del fondo',
   '{"de": "Gesamtfläche des Grundstücks in Quadratmetern.", "en": "Total land area in square meters."}',
   'float', NULL, 0,'SIA 416', 3),

  -- Grundstück attributes
  ('uuid-cattr-009', 'uuid-concept-003', 'EGRID',               'EGRID',                'EGRID',                'EGRID',
   '{"de": "Eidgenössischer Grundstücksidentifikator.", "en": "Federal land parcel identifier."}',
   'text', NULL, 1,'ZGB', 1),
  ('uuid-cattr-010', 'uuid-concept-003', 'Parcel Number',       'Parzellennummer',      'Numéro de parcelle',   'Numero di parcella',
   '{"de": "Kantonale Parzellennummer.", "en": "Cantonal parcel number."}',
   'text', NULL, 1,NULL, 2),
  ('uuid-cattr-011', 'uuid-concept-003', 'Municipality',        'Gemeinde',             'Commune',              'Comune',
   '{"de": "BFS-Gemeindenummer.", "en": "FSO municipality number."}',
   'integer', NULL, 1,'eCH-0071', 3),

  -- Mietobjekt attributes
  ('uuid-cattr-012', 'uuid-concept-004', 'Rental Unit Number',  'Mietobjektnummer',     'Numéro d''objet locatif','Numero oggetto in locazione',
   '{"de": "Eindeutige Kennung des Mietobjekts in SAP RE-FX.", "en": "Unique rental unit identifier in SAP RE-FX."}',
   'text', NULL, 1,NULL, 1),
  ('uuid-cattr-013', 'uuid-concept-004', 'Usage Type',          'Nutzungsart',          'Type d''utilisation',   'Tipo di utilizzo',
   '{"de": "Art der Nutzung gemäss SIA 416.", "en": "Type of use according to SIA 416."}',
   'code', 'uuid-codelist-002', 1,'SIA 416', 2),
  ('uuid-cattr-014', 'uuid-concept-004', 'Net Area',            'Nettofläche',          'Surface nette',        'Superficie netta',
   '{"de": "Nettofläche des Mietobjekts in m².", "en": "Net area of the rental unit in m²."}',
   'float', NULL, 0,'SIA 416', 3),

  -- Nutzungseinheit attributes
  ('uuid-cattr-015', 'uuid-concept-005', 'Unit ID',             'Einheits-ID',          'ID d''unité',          'ID unità',
   '{"de": "Systemtechnische Kennung der Nutzungseinheit.", "en": "System identifier of the occupancy unit."}',
   'text', NULL, 1,NULL, 1),
  ('uuid-cattr-016', 'uuid-concept-005', 'Usage Type',          'Nutzungsart',          'Type d''utilisation',   'Tipo di utilizzo',
   '{"de": "Art der Nutzung gemäss SIA 416.", "en": "Usage type per SIA 416."}',
   'code', 'uuid-codelist-002', 1,'SIA 416', 2),
  ('uuid-cattr-017', 'uuid-concept-005', 'Gross Floor Area',    'Bruttogeschossfläche', 'Surface brute de plancher','Superficie lorda di piano',
   '{"de": "Bruttogeschossfläche in m² nach SIA 416.", "en": "Gross floor area in m² per SIA 416."}',
   'float', NULL, 1,'SIA 416 §3.2', 3),

  -- Mietvertrag attributes
  ('uuid-cattr-018', 'uuid-concept-006', 'Contract Number',     'Vertragsnummer',       'Numéro de contrat',    'Numero di contratto',
   '{"de": "Eindeutige Kennung des Mietvertrags.", "en": "Unique lease contract identifier."}',
   'text', NULL, 1,NULL, 1),
  ('uuid-cattr-019', 'uuid-concept-006', 'Start Date',          'Mietbeginn',           'Début du bail',        'Inizio della locazione',
   '{"de": "Datum des Mietbeginns.", "en": "Lease start date."}',
   'date', NULL, 1,NULL, 2),
  ('uuid-cattr-020', 'uuid-concept-006', 'Annual Rent',         'Jahresmietpreis',      'Loyer annuel',         'Affitto annuale',
   '{"de": "Jahresmiete in CHF brutto.", "en": "Annual gross rent in CHF."}',
   'float', NULL, 1,NULL, 3),

  -- Energiebezugsfläche attributes
  ('uuid-cattr-021', 'uuid-concept-007', 'EBF Value',           'EBF-Wert',             'Valeur SRE',           'Valore SRE',
   '{"de": "Energiebezugsfläche in m².", "en": "Energy reference area in m²."}',
   'float', NULL, 1,'SIA 416 §3.6', 1),
  ('uuid-cattr-022', 'uuid-concept-007', 'Measurement Year',    'Messjahr',             'Année de mesure',      'Anno di misurazione',
   '{"de": "Jahr der letzten Flächenerhebung.", "en": "Year of last area survey."}',
   'integer', NULL, 0,NULL, 2),
  ('uuid-cattr-023', 'uuid-concept-007', 'Heating Degree Days',  'Heizgradtage',        'Degrés-jours de chauffage','Gradi giorno di riscaldamento',
   '{"de": "Klimakorrektur-Wert (HGT) der Standortgemeinde.", "en": "Climate correction value (HDD) of the site municipality."}',
   'float', NULL, 0,'SIA 381/3', 3),

  -- Baukostenindex attributes
  ('uuid-cattr-024', 'uuid-concept-008', 'Index Value',         'Indexwert',            'Valeur de l''indice',  'Valore dell''indice',
   '{"de": "Aktueller Indexstand (Basis Oktober 2020 = 100).", "en": "Current index level (base October 2020 = 100)."}',
   'float', NULL, 1,'BFS', 1),
  ('uuid-cattr-025', 'uuid-concept-008', 'Reference Period',    'Referenzperiode',      'Période de référence', 'Periodo di riferimento',
   '{"de": "Quartal und Jahr der Erhebung.", "en": "Quarter and year of the survey."}',
   'text', NULL, 1,NULL, 2),
  ('uuid-cattr-026', 'uuid-concept-008', 'Cost Group',          'Kostengruppe',         'Groupe de coûts',     'Gruppo di costi',
   '{"de": "eBKP-H Kostengruppe (z.B. C Gebäude).", "en": "eBKP-H cost group (e.g. C Building)."}',
   'text', NULL, 0,'eBKP-H 2012', 3),

  -- GEAK attributes
  ('uuid-cattr-027', 'uuid-concept-009', 'GEAK Class',          'GEAK-Klasse',          'Classe CECB',          'Classe CECE',
   '{"de": "Energieeffizienzklasse des Gebäudes gemäss GEAK (A–G).", "en": "Energy efficiency class of the building according to GEAK (A–G)."}',
   'code', 'uuid-codelist-004', 1, 'GEAK 2023', 1),
  ('uuid-cattr-028', 'uuid-concept-009', 'Issue Date',          'Ausstelldatum',        'Date d''émission',     'Data di emissione',
   '{"de": "Datum der Ausstellung des GEAK-Zertifikats.", "en": "Date of issuance of the GEAK certificate."}',
   'date', NULL, 1, NULL, 2),
  ('uuid-cattr-029', 'uuid-concept-009', 'Valid Until',         'Gültig bis',           'Valable jusqu''au',    'Valido fino al',
   '{"de": "Ablaufdatum des GEAK-Zertifikats.", "en": "Expiry date of the GEAK certificate."}',
   'date', NULL, 0, NULL, 3);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CODE LISTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO code_list (id, concept_id, name_en, name_de, name_fr, name_it, source_ref, version) VALUES
  ('uuid-codelist-001', 'uuid-concept-001',
   'GWR Building Category',   'GWR Gebäudekategorie',    'Catégorie de bâtiment RegBL', 'Categoria di edificio REA',
   'GWR Merkmalskatalog 2023, eCH-0071 v2.0', '2023.1'),
  ('uuid-codelist-002', 'uuid-concept-005',
   'SIA Usage Type',          'SIA Nutzungsart',         'Type d''utilisation SIA',      'Tipo di utilizzo SIA',
   'SIA 416 Flächen und Volumen von Gebäuden', '2003'),
  ('uuid-codelist-003', 'uuid-concept-001',
   'Energy Source',            'Energieträger',           'Agent énergétique',            'Vettore energetico',
   'GWR Merkmalskatalog 2023', '2023.1'),
  ('uuid-codelist-004', 'uuid-concept-009',
   'GEAK Efficiency Class',    'GEAK Effizienzklasse',    'Classe d''efficacité CECB',    'Classe di efficienza CECE',
   'GEAK 2023', '2023');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CODE LIST VALUES
-- ─────────────────────────────────────────────────────────────────────────────

-- GWR Gebäudekategorie
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-001', 'uuid-codelist-001', '1010', 'Single-family house',      'Einfamilienhaus',                      'Maison individuelle',            'Casa monofamiliare',       NULL, 0,1),
  ('uuid-clv-002', 'uuid-codelist-001', '1020', 'Two-family house',         'Zweifamilienhaus',                     'Maison à deux logements',        'Casa bifamiliare',         NULL, 0,2),
  ('uuid-clv-003', 'uuid-codelist-001', '1030', 'Multi-family house',       'Mehrfamilienhaus',                     'Immeuble locatif',               'Casa plurifamiliare',      NULL, 0,3),
  ('uuid-clv-004', 'uuid-codelist-001', '1060', 'Building with partial residential use','Gebäude mit teilw. Wohnnutzung','Bâtiment à usage mixte',    'Edificio a uso misto',     NULL, 0,4),
  ('uuid-clv-005', 'uuid-codelist-001', '1110', 'Office building',          'Bürogebäude',                          'Immeuble de bureaux',            'Edificio per uffici',      NULL, 0,5),
  ('uuid-clv-006', 'uuid-codelist-001', '1230', 'Building for education',   'Gebäude für Bildung und Forschung',    'Bâtiment pour l''enseignement', 'Edificio per formazione',  NULL, 0,6);

-- SIA Nutzungsart
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-007', 'uuid-codelist-002', 'BU',   'Office',           'Büro',             'Bureau',          'Ufficio',          NULL, 0,1),
  ('uuid-clv-008', 'uuid-codelist-002', 'WO',   'Residential',      'Wohnen',           'Habitation',      'Abitazione',       NULL, 0,2),
  ('uuid-clv-009', 'uuid-codelist-002', 'VK',   'Retail',           'Verkauf',          'Vente',           'Vendita',          NULL, 0,3),
  ('uuid-clv-010', 'uuid-codelist-002', 'LA',   'Warehouse',        'Lager',            'Entrepôt',        'Magazzino',        NULL, 0,4),
  ('uuid-clv-011', 'uuid-codelist-002', 'NF',   'Ancillary Space',  'Nebennutzfläche',  'Surface secondaire','Superficie accessoria', NULL, 0,5);

-- Energieträger
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-012', 'uuid-codelist-003', '7500', 'District heating', 'Fernwärme',        'Chauffage à distance', 'Teleriscaldamento', NULL, 0,1),
  ('uuid-clv-013', 'uuid-codelist-003', '7510', 'Heat pump',        'Wärmepumpe',       'Pompe à chaleur',      'Pompa di calore',   NULL, 0,2),
  ('uuid-clv-014', 'uuid-codelist-003', '7520', 'Gas',              'Gas',              'Gaz',                  'Gas',               NULL, 0,3),
  ('uuid-clv-015', 'uuid-codelist-003', '7530', 'Oil',              'Heizöl',           'Mazout',               'Gasolio',           NULL, 0,4);

-- GEAK Effizienzklasse
INSERT INTO code_list_value (id, code_list_id, code, label_en, label_de, label_fr, label_it, description, deprecated, sort_order) VALUES
  ('uuid-clv-016', 'uuid-codelist-004', 'A', 'Very efficient',    'Sehr effizient',    'Très efficace',     'Molto efficiente',   NULL, 0, 1),
  ('uuid-clv-017', 'uuid-codelist-004', 'B', 'Efficient',         'Effizient',         'Efficace',          'Efficiente',         NULL, 0, 2),
  ('uuid-clv-018', 'uuid-codelist-004', 'C', 'Fairly efficient',  'Recht effizient',   'Assez efficace',    'Abbastanza efficiente', NULL, 0, 3),
  ('uuid-clv-019', 'uuid-codelist-004', 'D', 'Average',           'Durchschnittlich',  'Moyen',             'Medio',              NULL, 0, 4),
  ('uuid-clv-020', 'uuid-codelist-004', 'E', 'Below average',     'Unterdurchschnittlich','En dessous de la moyenne','Sotto la media', NULL, 0, 5),
  ('uuid-clv-021', 'uuid-codelist-004', 'F', 'Inefficient',       'Wenig effizient',   'Peu efficace',      'Poco efficiente',    NULL, 0, 6),
  ('uuid-clv-022', 'uuid-codelist-004', 'G', 'Least efficient',   'Wenig effizient',   'Peu efficace',      'Poco efficiente',    NULL, 0, 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SYSTEMS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO system (id, name_en, name_de, description, archimate_type, technology_stack, base_url, scanner_class, owner_id, last_scanned_at, active, created_at) VALUES
  ('uuid-sys-001',
   'SAP RE-FX', 'SAP RE-FX',
   '{"en": "Enterprise resource planning system for real estate management. Contains master data for properties, buildings, rental units, and lease contracts.", "de": "ERP-System für die Immobilienbewirtschaftung. Enthält Stammdaten zu Liegenschaften, Gebäuden, Mietobjekten und Mietverträgen."}',
   'Application Component', 'SAP S/4HANA',
   'https://sap-refx.bbl.admin.ch', 'SapRefxScanner',
   'uuid-contact-005', '2024-12-01T02:00:00Z',
   1,'2024-01-15T07:00:00Z'),

  ('uuid-sys-002',
   'GIS IMMO', 'GIS IMMO',
   '{"en": "Geographic information system for federal real estate. Contains spatial data for buildings, land parcels, and infrastructure.", "de": "Geoinformationssystem für die Bundesimmobilien. Enthält Geodaten zu Gebäuden, Grundstücken und Infrastruktur."}',
   'Application Component', 'ArcGIS Enterprise',
   'https://gis-immo.bbl.admin.ch', 'ArcGisScanner',
   'uuid-contact-005', '2024-12-02T01:00:00Z',
   1,'2024-01-15T07:00:00Z'),

  ('uuid-sys-003',
   'ActaNova GEVER', 'ActaNova GEVER',
   '{"en": "Document management and electronic records system (GEVER) for building-related documents, contracts, and correspondence.", "de": "Dokumentenmanagementsystem und elektronische Geschäftsverwaltung (GEVER) für Gebäudedokumente, Verträge und Korrespondenz."}',
   'Application Component', 'Acta Nova (Rubicon)',
   'https://actanova.bbl.admin.ch', 'ActaNovaScanner',
   'uuid-contact-005', '2024-11-28T03:00:00Z',
   1,'2024-02-01T07:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SCHEMAS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO schema_ (id, system_id, name, display_name, schema_type, description, created_at) VALUES
  ('uuid-schema-001', 'uuid-sys-001',
   'VIBD', 'SAP RE-FX Stammdaten',
   'database_schema',
   '{"de": "Stammdatenschema der SAP RE-FX Immobilienwirtschaft. Enthält Tabellen für Wirtschaftseinheiten, Gebäude, Mietobjekte und Verträge.", "en": "Master data schema of SAP RE-FX real estate management. Contains tables for business entities, buildings, rental units, and contracts."}',
   '2024-01-15T07:00:00Z'),

  ('uuid-schema-002', 'uuid-sys-002',
   'SPATIAL', 'GIS IMMO Geodaten',
   'gis_workspace',
   '{"de": "GIS-Workspace mit Gebäudepolygonen, Parzellen und Energiedaten.", "en": "GIS workspace with building polygons, parcels, and energy data."}',
   '2024-01-15T07:00:00Z'),

  ('uuid-schema-003', 'uuid-sys-003',
   'DMS_BBL', 'ActaNova BBL Aktenplan',
   'file_folder',
   '{"de": "Aktenplan und Ordnungsstruktur des BBL in ActaNova GEVER.", "en": "Filing plan and organisational structure of BBL in ActaNova GEVER."}',
   '2024-02-01T07:00:00Z'),

  ('uuid-schema-004', 'uuid-sys-002',
   'ENERGY', 'GIS IMMO Energiedaten',
   'gis_workspace',
   '{"de": "GIS-Workspace mit Energiezertifikaten und Verbrauchsdaten.", "en": "GIS workspace with energy certificates and consumption data."}',
   '2024-03-01T07:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. DATASETS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dataset (id, schema_id, name, display_name, dataset_type, description, certified, egid, egrid, row_count_approx, source_url, owner_id, created_at, modified_at) VALUES

  ('uuid-ds-001', 'uuid-schema-001',
   'VIBDBE', 'Wirtschaftseinheiten Gebäude',
   'table',
   '{"de": "SAP RE-FX Stammdatentabelle für Gebäude (Wirtschaftseinheit Typ BE). Enthält EGID, Baujahr, Kategorie und technische Gebäudemerkmale.", "en": "SAP RE-FX master data table for buildings (Business Entity type BE). Contains EGID, year of construction, category, and technical building characteristics."}',
   1,NULL, NULL, 8450,
   'https://sap-refx.bbl.admin.ch/sap/bc/gui/sap/its/webgui?~transaction=VIBDBE',
   'uuid-contact-002',
   '2024-01-20T07:00:00Z', '2024-11-15T08:00:00Z'),

  ('uuid-ds-002', 'uuid-schema-001',
   'VIBDAU', 'Wirtschaftseinheiten Mietobjekt',
   'table',
   '{"de": "SAP RE-FX Stammdatentabelle für Mietobjekte (Wirtschaftseinheit Typ AU). Enthält Mietobjektnummern, Flächen und Nutzungsarten.", "en": "SAP RE-FX master data table for rental units (Business Entity type AU). Contains rental unit numbers, areas, and usage types."}',
   1,NULL, NULL, 32100,
   'https://sap-refx.bbl.admin.ch/sap/bc/gui/sap/its/webgui?~transaction=VIBDAU',
   'uuid-contact-003',
   '2024-01-20T07:00:00Z', '2024-11-15T08:00:00Z'),

  ('uuid-ds-003', 'uuid-schema-001',
   'VIBDMV', 'Mietverträge',
   'table',
   '{"de": "SAP RE-FX Vertragstabelle für Mietverträge. Enthält Vertragsnummern, Laufzeiten, Mietkonditionen und Geschäftspartner.", "en": "SAP RE-FX contract table for lease agreements. Contains contract numbers, terms, rental conditions, and business partners."}',
   0,NULL, NULL, 15600,
   'https://sap-refx.bbl.admin.ch/sap/bc/gui/sap/its/webgui?~transaction=VIBDMV',
   'uuid-contact-003',
   '2024-02-01T07:00:00Z', '2024-10-01T07:00:00Z'),

  ('uuid-ds-004', 'uuid-schema-002',
   'BUILDING', 'Gebäudepolygone',
   'gis_layer',
   '{"de": "GIS-Layer mit den Gebäudegrundrissen als Polygone. Enthält EGID-Verknüpfung, Dachform und Gebäudehöhe.", "en": "GIS layer with building footprints as polygons. Contains EGID reference, roof type, and building height."}',
   1,NULL, NULL, 9200,
   'https://gis-immo.bbl.admin.ch/arcgis/rest/services/BUILDING/FeatureServer/0',
   'uuid-contact-002',
   '2024-01-20T07:00:00Z', '2024-12-02T01:00:00Z'),

  ('uuid-ds-005', 'uuid-schema-004',
   'ENERGY_CERT', 'Energieausweise',
   'gis_layer',
   '{"de": "GIS-Layer mit Energieausweisen (GEAK) pro Gebäude. Enthält Energiekennwerte, EBF und CO2-Emissionen.", "en": "GIS layer with energy performance certificates (GEAK) per building. Contains energy indicators, EBF, and CO2 emissions."}',
   1,NULL, NULL, 4800,
   'https://gis-immo.bbl.admin.ch/arcgis/rest/services/ENERGY_CERT/FeatureServer/0',
   'uuid-contact-004',
   '2024-03-01T07:00:00Z', '2024-11-20T08:00:00Z'),

  ('uuid-ds-006', 'uuid-schema-003',
   'DOC_BUILDING', 'Gebäudedossiers',
   'file',
   '{"de": "ActaNova-Dossiers mit gebäudebezogenen Dokumenten: Baupläne, Gutachten, Bewilligungen und Korrespondenz.", "en": "ActaNova dossiers with building-related documents: construction plans, expert reports, permits, and correspondence."}',
   0,NULL, NULL, 125000,
   'https://actanova.bbl.admin.ch/objects/DOC_BUILDING',
   'uuid-contact-001',
   '2024-02-15T07:00:00Z', '2024-11-28T03:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. FIELDS
-- ─────────────────────────────────────────────────────────────────────────────

-- VIBDBE fields (SAP Buildings)
INSERT INTO field (id, dataset_id, name, display_name, data_type, description, nullable, is_primary_key, is_foreign_key, references_field_id, sample_values, sort_order) VALUES
  ('uuid-field-001', 'uuid-ds-001', 'SWESSION', 'Wirtschaftseinheit ID', 'VARCHAR(20)', '{"de": "Primärschlüssel der Wirtschaftseinheit Gebäude."}', 0,1,0, NULL, '["1000001", "1000002", "1000003"]', 1),
  ('uuid-field-002', 'uuid-ds-001', 'BAESSION', 'Baujahr',              'INTEGER',      '{"de": "Jahr der Gebäudeerstellung."}',                     1, 0,0, NULL, '[1952, 1978, 2015]', 2),
  ('uuid-field-003', 'uuid-ds-001', 'BUKESSION','Gebäudekategorie-Code', 'VARCHAR(4)',   '{"de": "GWR-Gebäudekategoriecode."}',                       1, 0,0, NULL, '["1110", "1030", "1230"]', 3),
  ('uuid-field-004', 'uuid-ds-001', 'MESSION',  'Gemeinde BFS-Nr.',     'INTEGER',      '{"de": "BFS-Gemeindenummer des Standorts."}',               0,0, 0,NULL, '[351, 2701, 5586]', 4),
  ('uuid-field-005', 'uuid-ds-001', 'REESSION', 'EGID',                 'INTEGER',      '{"de": "Eidgenössischer Gebäudeidentifikator."}',           1, 0,0, NULL, '[190123456, 190234567]', 5),
  ('uuid-field-006', 'uuid-ds-001', 'ANESSION', 'Anzahl Geschosse',     'SMALLINT',     '{"de": "Gesamtzahl Geschosse (ober- und unterirdisch)."}',  1, 0,0, NULL, '[3, 5, 12]', 6),

-- VIBDAU fields (SAP Rental Units)
  ('uuid-field-007', 'uuid-ds-002', 'MIOBJNR',  'Mietobjektnummer',     'VARCHAR(20)', '{"de": "Primärschlüssel des Mietobjekts."}',                0,1,0, NULL, '["MO-00001", "MO-00002"]', 1),
  ('uuid-field-008', 'uuid-ds-002', 'SWESSION',  'WE Gebäude (FK)',      'VARCHAR(20)', '{"de": "Fremdschlüssel zur Wirtschaftseinheit Gebäude."}',  0,0, 1,'uuid-field-001', '["1000001", "1000001"]', 2),
  ('uuid-field-009', 'uuid-ds-002', 'NUESSION',  'Nutzungsart-Code',     'VARCHAR(4)',  '{"de": "SIA-Nutzungsart-Code."}',                           1, 0,0, NULL, '["BU", "LA", "WO"]', 3),
  ('uuid-field-010', 'uuid-ds-002', 'NFESSION',  'Nettofläche m²',       'DECIMAL(10,2)','{"de": "Nettofläche in Quadratmetern."}',                  1, 0,0, NULL, '[45.50, 120.30, 250.00]', 4),

-- VIBDMV fields (SAP Lease Agreements)
  ('uuid-field-011', 'uuid-ds-003', 'MVNR',     'Vertragsnummer',       'VARCHAR(20)', '{"de": "Primärschlüssel des Mietvertrags."}',               0,1, 0,NULL, '["MV-2024-001", "MV-2024-002"]', 1),
  ('uuid-field-012', 'uuid-ds-003', 'MIOBJNR',  'Mietobjekt (FK)',      'VARCHAR(20)', '{"de": "Fremdschlüssel zum Mietobjekt."}',                  0,0, 1,'uuid-field-007', '["MO-00001"]', 2),
  ('uuid-field-013', 'uuid-ds-003', 'MVBEG',    'Vertragsbeginn',       'DATE',        '{"de": "Beginn des Mietvertrags."}',                        0,0, 0,NULL, '["2020-01-01", "2023-04-01"]', 3),
  ('uuid-field-014', 'uuid-ds-003', 'MVEND',    'Vertragsende',         'DATE',        '{"de": "Ende des Mietvertrags (NULL = unbefristet)."}',     1, 0,0, NULL, '["2030-12-31", null]', 4),
  ('uuid-field-015', 'uuid-ds-003', 'JAESSION', 'Jahresmiete CHF',      'DECIMAL(12,2)','{"de": "Jährlicher Mietpreis in CHF."}',                   0,0, 0,NULL, '[85000.00, 245000.00]', 5),

-- BUILDING fields (GIS)
  ('uuid-field-016', 'uuid-ds-004', 'GEB_ID',   'Gebäude-ID',           'INTEGER',     '{"de": "Primärschlüssel des GIS-Gebäudeobjekts."}',        0,1, 0,NULL, '[10001, 10002, 10003]', 1),
  ('uuid-field-017', 'uuid-ds-004', 'EGID',     'EGID',                 'INTEGER',     '{"de": "Eidgenössischer Gebäudeidentifikator (GWR)."}',     1, 0,0, NULL, '[190123456, 190234567]', 2),
  ('uuid-field-018', 'uuid-ds-004', 'SHAPE',    'Geometrie',            'GEOMETRY(POLYGON, 2056)','{"de": "Gebäudegrundriss als Polygon in LV95."}', 0,0, 0,NULL, NULL, 3),
  ('uuid-field-019', 'uuid-ds-004', 'DACH_TYP', 'Dachform',             'VARCHAR(20)', '{"de": "Art der Dachkonstruktion."}',                       1, 0,0, NULL, '["Flachdach", "Satteldach"]', 4),
  ('uuid-field-020', 'uuid-ds-004', 'HOEHE',    'Gebäudehöhe m',        'DECIMAL(5,1)','{"de": "Gebäudehöhe in Metern (Traufe)."}',                 1, 0,0, NULL, '[12.5, 25.3, 8.0]', 5),

-- ENERGY_CERT fields (GIS)
  ('uuid-field-021', 'uuid-ds-005', 'CERT_ID',  'Zertifikat-ID',        'INTEGER',     '{"de": "Primärschlüssel des Energieausweises."}',           0,1, 0,NULL, '[5001, 5002]', 1),
  ('uuid-field-022', 'uuid-ds-005', 'EGID',     'EGID',                 'INTEGER',     '{"de": "Eidgenössischer Gebäudeidentifikator."}',           0,0, 0,NULL, '[190123456]', 2),
  ('uuid-field-023', 'uuid-ds-005', 'EBF_M2',   'EBF in m²',            'DECIMAL(10,2)','{"de": "Energiebezugsfläche in Quadratmetern."}',          1, 0,0, NULL, '[1250.00, 3400.50]', 3),
  ('uuid-field-024', 'uuid-ds-005', 'KWH_M2',   'Energiekennwert',      'DECIMAL(8,2)','{"de": "Spezifischer Energieverbrauch in kWh/m² pro Jahr."}',1, 0,0, NULL, '[42.5, 78.3, 125.0]', 4),
  ('uuid-field-025', 'uuid-ds-005', 'CO2_KG',   'CO2-Emissionen kg/m²', 'DECIMAL(8,2)','{"de": "Jährliche CO2-Emissionen in kg pro m² EBF."}',     1, 0,0, NULL, '[5.2, 12.8]', 5),
  ('uuid-field-026', 'uuid-ds-005', 'GEAK_KLASSE','GEAK-Klasse',        'VARCHAR(2)',  '{"de": "GEAK-Effizienzklasse (A–G)."}',                     1, 0,0, NULL, '["A", "B", "D", "F"]', 6),

-- DOC_BUILDING fields (ActaNova)
  ('uuid-field-027', 'uuid-ds-006', 'DOC_ID',      'Dokument-ID',       'VARCHAR(36)', '{"de": "Eindeutige Dokument-ID in ActaNova."}',             0,1, 0,NULL, '["d7a3f1e2-...", "c8b4e2f3-..."]', 1),
  ('uuid-field-028', 'uuid-ds-006', 'DOSSIER_NR',  'Dossiernummer',     'VARCHAR(30)', '{"de": "Aktenzeichen des Gebäudedossiers."}',               0,0, 0,NULL, '["BBL-GEB-2024-001"]', 2),
  ('uuid-field-029', 'uuid-ds-006', 'DOC_TYP',     'Dokumenttyp',       'VARCHAR(20)', '{"de": "Art des Dokuments (Plan, Gutachten, Bewilligung)."}'  ,1, 0,0, NULL, '["Bauplan", "Gutachten", "Mietvertrag"]', 3),
  ('uuid-field-030', 'uuid-ds-006', 'EGID_REF',    'EGID-Referenz',     'INTEGER',     '{"de": "EGID-Verknüpfung zum zugehörigen Gebäude."}',       1, 0,0, NULL, '[190123456]', 4);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. CONCEPT MAPPINGS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO concept_mapping (id, concept_id, field_id, match_type, transformation_note, verified, created_by, created_at) VALUES

  -- Gebäude → SAP VIBDBE.SWESSION (exact: one row = one building)
  ('uuid-cm-001', 'uuid-concept-001', 'uuid-field-001', 'exact',
   NULL, 1,'uuid-user-002', '2024-06-01T08:00:00Z'),

  -- Gebäude → SAP VIBDBE.REESSION (exact: EGID field)
  ('uuid-cm-002', 'uuid-concept-001', 'uuid-field-005', 'exact',
   'EGID as INTEGER, leading zeros stripped in SAP', 1,'uuid-user-002', '2024-06-01T08:00:00Z'),

  -- Gebäude → GIS BUILDING.GEB_ID (exact: one polygon = one building)
  ('uuid-cm-003', 'uuid-concept-001', 'uuid-field-016', 'exact',
   NULL, 1,'uuid-user-002', '2024-06-02T07:00:00Z'),

  -- Gebäude → GIS BUILDING.EGID (exact: EGID in GIS)
  ('uuid-cm-004', 'uuid-concept-001', 'uuid-field-017', 'exact',
   NULL, 1,'uuid-user-002', '2024-06-02T07:00:00Z'),

  -- Gebäude → ActaNova DOC_BUILDING.EGID_REF (related: document references building)
  ('uuid-cm-005', 'uuid-concept-001', 'uuid-field-030', 'related',
   'Documents reference buildings via EGID; not all documents have EGID', 0,'uuid-user-001', '2024-07-01T08:00:00Z'),

  -- Mietobjekt → SAP VIBDAU.MIOBJNR (exact)
  ('uuid-cm-006', 'uuid-concept-004', 'uuid-field-007', 'exact',
   NULL, 1,'uuid-user-003', '2024-07-01T08:00:00Z'),

  -- Mietobjekt → SAP VIBDAU.NUESSION (close: usage type as attribute of rental unit)
  ('uuid-cm-007', 'uuid-concept-004', 'uuid-field-009', 'close',
   'SIA usage type code; maps to code_list SIA Nutzungsart', 1,'uuid-user-003', '2024-07-01T08:00:00Z'),

  -- Nutzungseinheit → SAP VIBDAU.NUESSION (exact: usage type defines the unit)
  ('uuid-cm-008', 'uuid-concept-005', 'uuid-field-009', 'exact',
   NULL, 1,'uuid-user-003', '2024-07-15T07:00:00Z'),

  -- Nutzungseinheit → SAP VIBDAU.NFESSION (close: area as property)
  ('uuid-cm-009', 'uuid-concept-005', 'uuid-field-010', 'close',
   'Net area in m²; need SIA 416 gross/net conversion for EBF', 1,'uuid-user-003', '2024-07-15T07:00:00Z'),

  -- Mietvertrag → SAP VIBDMV.MVNR (exact)
  ('uuid-cm-010', 'uuid-concept-006', 'uuid-field-011', 'exact',
   NULL, 1,'uuid-user-003', '2024-08-01T07:00:00Z'),

  -- Mietvertrag → SAP VIBDMV.MVBEG (exact: start date)
  ('uuid-cm-011', 'uuid-concept-006', 'uuid-field-013', 'exact',
   NULL, 1,'uuid-user-003', '2024-08-01T07:00:00Z'),

  -- Energiebezugsfläche → GIS ENERGY_CERT.EBF_M2 (exact)
  ('uuid-cm-012', 'uuid-concept-007', 'uuid-field-023', 'exact',
   NULL, 1,'uuid-user-004', '2024-08-15T08:00:00Z'),

  -- Energiebezugsfläche → GIS ENERGY_CERT.KWH_M2 (related: derived metric)
  ('uuid-cm-013', 'uuid-concept-007', 'uuid-field-024', 'related',
   'Energy intensity uses EBF as denominator; kWh/m² = total consumption / EBF', 1,'uuid-user-004', '2024-08-15T08:00:00Z'),

  -- Grundstück → SAP VIBDBE.MESSION (close: municipality links to parcel location)
  ('uuid-cm-014', 'uuid-concept-003', 'uuid-field-004', 'close',
   'BFS municipality number; parcel identified by EGRID at federal level', 0,'uuid-user-002', '2024-09-01T08:00:00Z'),

  -- Liegenschaft → SAP VIBDBE.SWESSION (close: property contains buildings)
  ('uuid-cm-015', 'uuid-concept-002', 'uuid-field-001', 'close',
   'SAP models properties at building level; 1:N relationship Property→Building managed via hierarchy', 0,'uuid-user-002', '2024-09-01T08:00:00Z'),

  -- GEAK → GIS ENERGY_CERT.GEAK_KLASSE (exact: GEAK class)
  ('uuid-cm-016', 'uuid-concept-009', 'uuid-field-026', 'exact',
   NULL, 1,'uuid-user-004', '2024-09-15T08:00:00Z'),

  -- GEAK → GIS ENERGY_CERT.CO2_KG (related: certificate number)
  ('uuid-cm-017', 'uuid-concept-009', 'uuid-field-025', 'related',
   'CO2 emissions derived from GEAK classification', 1,'uuid-user-004', '2024-09-15T08:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. DATA CLASSIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_classification (id, name_en, name_de, name_fr, name_it, sensitivity_level, legal_basis, description, access_restriction) VALUES
  ('uuid-class-001', 'Public',       'Öffentlich',    'Public',        'Pubblico',       0, 'EMBAG Art. 10',
   '{"de": "Daten, die ohne Einschränkung veröffentlicht werden dürfen.", "en": "Data that may be published without restriction."}',
   'No restrictions'),
  ('uuid-class-002', 'Internal',     'BBL-intern',    'Interne OFC',   'Interno UFCL',   1, 'ISG Art. 6',
   '{"de": "Daten, die nur innerhalb des BBL bzw. der Bundesverwaltung zugänglich sind.", "en": "Data accessible only within BBL or the federal administration."}',
   'Federal administration staff only'),
  ('uuid-class-003', 'Confidential', 'Vertraulich',   'Confidentiel',  'Confidenziale',  2, 'ISG Art. 7',
   '{"de": "Vertrauliche Daten, deren Offenlegung den Interessen des Bundes schaden könnte.", "en": "Confidential data whose disclosure could harm federal interests."}',
   'Authorized personnel with need-to-know'),
  ('uuid-class-004', 'Secret', 'Geheim', 'Secret', 'Segreto', 3, 'ISG Art. 10',
   '{"de":"Informationen deren Kenntnisnahme durch Unbefugte den Landesinteressen einen schweren Schaden zufügen kann.","en":"Information whose disclosure to unauthorized persons could cause serious damage to national interests."}',
   'Physical and digital isolation required');

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. DATASET CLASSIFICATIONS (junction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dataset_classification (dataset_id, classification_id, assigned_at, assigned_by) VALUES
  ('uuid-ds-001', 'uuid-class-002', '2024-06-01T08:00:00Z', 'uuid-user-002'),   -- VIBDBE: Internal
  ('uuid-ds-002', 'uuid-class-002', '2024-06-01T08:00:00Z', 'uuid-user-003'),   -- VIBDAU: Internal
  ('uuid-ds-003', 'uuid-class-003', '2024-06-01T08:00:00Z', 'uuid-user-003'),   -- VIBDMV: Confidential (contracts)
  ('uuid-ds-004', 'uuid-class-001', '2024-06-02T07:00:00Z', 'uuid-user-002'),   -- BUILDING: Public
  ('uuid-ds-005', 'uuid-class-001', '2024-06-02T07:00:00Z', 'uuid-user-004'),   -- ENERGY_CERT: Public
  ('uuid-ds-006', 'uuid-class-003', '2024-07-01T08:00:00Z', 'uuid-user-001');   -- DOC_BUILDING: Confidential

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. DATASET CONTACTS (junction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO dataset_contact (dataset_id, contact_id, role) VALUES
  ('uuid-ds-001', 'uuid-contact-002', 'data_steward'),
  ('uuid-ds-001', 'uuid-contact-005', 'data_custodian'),
  ('uuid-ds-002', 'uuid-contact-003', 'data_steward'),
  ('uuid-ds-002', 'uuid-contact-005', 'data_custodian'),
  ('uuid-ds-003', 'uuid-contact-003', 'data_steward'),
  ('uuid-ds-004', 'uuid-contact-002', 'data_steward'),
  ('uuid-ds-004', 'uuid-contact-005', 'data_custodian'),
  ('uuid-ds-005', 'uuid-contact-004', 'subject_matter_expert'),
  ('uuid-ds-006', 'uuid-contact-001', 'data_owner');

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. DATA PRODUCTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_product (id, name_en, name_de, name_fr, name_it, description, publisher, license, theme, keyword, spatial_coverage, temporal_start, temporal_end, update_frequency, certified, issued, modified) VALUES

  ('uuid-dp-001',
   'Building Registry API', 'Gebäuderegister API', 'API Registre des bâtiments', 'API Registro degli edifici',
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
   'Energy Report Export', 'Energiebericht Export', 'Export Rapport énergétique', 'Esportazione Rapporto energetico',
   '{"en": "Periodic export of energy performance data for all federal buildings. Includes GEAK ratings, EBF, kWh/m2, and CO2 emissions per building.", "de": "Periodischer Export der Energiekennwerte aller Bundesgebäude. Enthält GEAK-Bewertungen, EBF, kWh/m², und CO2-Emissionen pro Gebäude."}',
   'DRES – Energie & Nachhaltigkeit',
   'CC BY 4.0',
   '["http://publications.europa.eu/resource/authority/data-theme/ENER","http://publications.europa.eu/resource/authority/data-theme/ENVI"]',
   '{"en": ["energy", "GEAK", "CO2", "sustainability"], "de": ["Energie", "GEAK", "CO2", "Nachhaltigkeit"]}',
   'Switzerland',
   '2022-01-01', NULL,
   'http://publications.europa.eu/resource/authority/frequency/QUARTERLY',
   1,
   '2024-09-01T08:00:00Z', '2024-10-01T07:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. DATA PRODUCT ↔ DATASET (junction: prov:wasDerivedFrom)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_product_dataset (data_product_id, dataset_id) VALUES
  ('uuid-dp-001', 'uuid-ds-001'),   -- Gebäuderegister ← SAP VIBDBE
  ('uuid-dp-001', 'uuid-ds-004'),   -- Gebäuderegister ← GIS BUILDING
  ('uuid-dp-002', 'uuid-ds-004'),   -- Energiebericht  ← GIS BUILDING
  ('uuid-dp-002', 'uuid-ds-005');   -- Energiebericht  ← GIS ENERGY_CERT

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. DATA PRODUCT CLASSIFICATIONS (junction)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_product_classification (data_product_id, classification_id) VALUES
  ('uuid-dp-001', 'uuid-class-001'),   -- Gebäuderegister API: Public
  ('uuid-dp-002', 'uuid-class-001');   -- Energiebericht: Public

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
   'text/csv', 'file_export', 'CSV', 2450000,
   NULL,
   '{"de": "Quartalsweiser CSV-Export aller Energiekennwerte. Spalten: EGID, EBF, kWh/m², CO2 kg/m², GEAK-Klasse.", "en": "Quarterly CSV export of all energy performance data. Columns: EGID, EBF, kWh/m2, CO2 kg/m2, GEAK class."}',
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

  -- SAP VIBDBE → GIS BUILDING (daily ETL)
  ('uuid-lin-001', 'uuid-ds-001', 'uuid-ds-004',
   'transform', 'FME', 'SAP2GIS_Buildings',
   '{"de": "Täglicher ETL-Prozess: SAP-Gebäudestammdaten werden über FME in GIS-Polygone überführt. EGID dient als Verknüpfungsschlüssel. Koordinatentransformation CH1903+ → LV95.", "en": "Daily ETL process: SAP building master data is transformed into GIS polygons via FME. EGID serves as the linking key. Coordinate transformation CH1903+ to LV95."}',
   'daily',
   '2024-11-15T02:00:00Z', 'uuid-user-005'),

  -- GIS BUILDING → Data Product Gebäuderegister (via API publication)
  ('uuid-lin-002', 'uuid-ds-004', 'uuid-ds-001',
   'copy', 'SAP PI', 'GIS_Sync_Back',
   '{"de": "Rücksynchronisation von GIS-Geometriedaten nach SAP für die Flächenberechnung. Wöchentlich.", "en": "Back-synchronization of GIS geometry data to SAP for area calculations. Weekly."}',
   'weekly',
   '2024-11-15T02:00:00Z', 'uuid-user-005'),

  -- SAP VIBDAU → SAP VIBDMV (internal join for lease-to-unit mapping)
  ('uuid-lin-003', 'uuid-ds-002', 'uuid-ds-003',
   'join', 'SAP ABAP', 'MO_MV_Link',
   '{"de": "Verknüpfung der Mietobjekte mit Mietverträgen über Fremdschlüssel MIOBJNR innerhalb SAP.", "en": "Join of rental units with lease agreements via foreign key MIOBJNR within SAP."}',
   'realtime',
   '2024-06-01T08:00:00Z', 'uuid-user-003'),

  -- GIS ENERGY_CERT → CSV Export (data product publication)
  ('uuid-lin-004', 'uuid-ds-005', 'uuid-ds-004',
   'aggregate', 'Python', 'Energy_Aggregation',
   '{"de": "Aggregation der Energieausweisdaten auf Gebäudeebene und Verknüpfung mit Gebäudepolygonen für den Energiebericht.", "en": "Aggregation of energy certificate data at building level and linking with building polygons for the energy report."}',
   'quarterly',
   '2024-10-01T07:00:00Z', 'uuid-user-004');

-- ─────────────────────────────────────────────────────────────────────────────
-- 23. RELATIONSHIP EDGES (materialised)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO relationship_edge (source_id, source_type, target_id, target_type, rel_type, weight, derived_from, refreshed_at) VALUES

  -- concept → field (realizes via concept_mapping)
  ('uuid-concept-001', 'concept', 'uuid-field-001', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-001', 'concept', 'uuid-field-016', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-004', 'concept', 'uuid-field-007', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-006', 'concept', 'uuid-field-011', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-007', 'concept', 'uuid-field-023', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),

  -- dataset → dataset (lineage)
  ('uuid-ds-001', 'dataset', 'uuid-ds-004', 'dataset', 'lineage_downstream', 1.0, 'lineage_link', '2024-12-02T23:00:00Z'),
  ('uuid-ds-004', 'dataset', 'uuid-ds-001', 'dataset', 'lineage_upstream',   1.0, 'lineage_link', '2024-12-02T23:00:00Z'),
  ('uuid-ds-005', 'dataset', 'uuid-ds-004', 'dataset', 'lineage_downstream', 1.0, 'lineage_link', '2024-12-02T23:00:00Z'),

  -- data_product → dataset (derived_from)
  ('uuid-dp-001', 'data_product', 'uuid-ds-001', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),
  ('uuid-dp-001', 'data_product', 'uuid-ds-004', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),
  ('uuid-dp-002', 'data_product', 'uuid-ds-004', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),
  ('uuid-dp-002', 'data_product', 'uuid-ds-005', 'dataset', 'derived_from', 0.9, 'data_product_dataset', '2024-12-02T23:00:00Z'),

  -- concept → concept (skos related)
  ('uuid-concept-001', 'concept', 'uuid-concept-002', 'concept', 'skos:broader',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-004', 'concept', 'uuid-concept-005', 'concept', 'skos:broader',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),
  ('uuid-concept-004', 'concept', 'uuid-concept-006', 'concept', 'skos:related',  0.7, 'concept_relation', '2024-12-02T23:00:00Z'),

  -- sibling datasets (same schema)
  ('uuid-ds-001', 'dataset', 'uuid-ds-002', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),
  ('uuid-ds-001', 'dataset', 'uuid-ds-003', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),
  ('uuid-ds-002', 'dataset', 'uuid-ds-003', 'dataset', 'sibling', 0.4, 'dataset', '2024-12-02T23:00:00Z'),

  -- GEAK concept edges
  ('uuid-concept-009', 'concept', 'uuid-field-026', 'field', 'realizes', 1.0, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-009', 'concept', 'uuid-field-025', 'field', 'realizes', 0.7, 'concept_mapping', '2024-12-02T23:00:00Z'),
  ('uuid-concept-009', 'concept', 'uuid-concept-007', 'concept', 'skos:related', 0.7, 'concept_relation', '2024-12-02T23:00:00Z');

-- ─────────────────────────────────────────────────────────────────────────────
-- 24. DATA PROFILES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_profile (id, dataset_id, row_count, null_percentage, cardinality, min_value, max_value, completeness_score, format_validity_score, sample_values, profiled_at, profiler) VALUES
  ('uuid-prof-001', 'uuid-ds-001', 8450,  0.03, 8450,  '1000001', '1008450', 0.97, 0.99, '["1000001", "1003421", "1007892"]', '2024-12-01T02:30:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-002', 'uuid-ds-002', 32100, 0.05, 32100, 'MO-00001','MO-32100',0.95, 0.98, '["MO-00001", "MO-15234", "MO-31999"]', '2024-12-01T02:45:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-003', 'uuid-ds-004', 9200,  0.02, 9200,  '10001',   '19200',   0.98, 0.99, '[10001, 14523, 18999]', '2024-12-02T01:30:00Z', 'catalog-scanner v2.1'),
  ('uuid-prof-004', 'uuid-ds-005', 4800,  0.08, 4800,  '5001',    '9800',    0.92, 0.95, '[5001, 7234, 9800]', '2024-11-20T08:30:00Z', 'catalog-scanner v2.1');

-- ─────────────────────────────────────────────────────────────────────────────
-- 25. DATA POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO data_policy (id, name_en, name_de, name_fr, name_it, policy_type, rule_definition, legal_basis, owner, valid_from, valid_to) VALUES
  ('uuid-pol-001',
   'Federal Data Retention 10y',    'Bundesaufbewahrung 10 Jahre',    'Conservation fédérale 10 ans',    'Conservazione federale 10 anni',
   'retention',
   '{"de": "Alle Immobilienstammdaten sind mindestens 10 Jahre nach Abgang des Objekts aufzubewahren.", "en": "All real estate master data must be retained for at least 10 years after the object is decommissioned."}',
   'BGA Art. 6',
   'DRES – Digital Solutions',
   '2023-12-31T23:00:00Z', NULL),

  ('uuid-pol-002',
   'Lease Data Access Restriction', 'Zugriffsbeschränkung Mietdaten', 'Restriction d''accès données locatives', 'Restrizione accesso dati locativi',
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
  ('uuid-ds-005', 'uuid-pol-001'),
  ('uuid-ds-006', 'uuid-pol-001');

-- ─────────────────────────────────────────────────────────────────────────────
-- 27. CONCEPT RELATIONS (junction: skos:broader, skos:related)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO concept_relation (source_concept_id, target_concept_id, relation_type) VALUES
  ('uuid-concept-002', 'uuid-concept-001', 'skos:broader'),    -- Liegenschaft broader Gebäude
  ('uuid-concept-003', 'uuid-concept-002', 'skos:broader'),    -- Grundstück broader Liegenschaft
  ('uuid-concept-005', 'uuid-concept-004', 'skos:broader'),    -- Nutzungseinheit broader Mietobjekt
  ('uuid-concept-004', 'uuid-concept-006', 'skos:related'),    -- Mietobjekt related Mietvertrag
  ('uuid-concept-001', 'uuid-concept-007', 'skos:related'),    -- Gebäude related Energiebezugsfläche
  ('uuid-concept-007', 'uuid-concept-008', 'skos:related'),    -- Energiebezugsfläche related Baukostenindex
  ('uuid-concept-009', 'uuid-concept-007', 'skos:related');    -- GEAK related Energiebezugsfläche

-- =============================================================================
-- END OF SEED DATA
-- =============================================================================
