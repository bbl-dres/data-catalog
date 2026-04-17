-- =============================================================================
-- BBL Datenkatalog – SQLite DDL Schema
-- Generated from DATAMODEL.md v0.2 (draft)
-- Adapted for SQLite (sql.js in-browser) from the original PostgreSQL spec
-- =============================================================================
-- Adaptations from PostgreSQL:
--   UUID        -> TEXT  (DEFAULT lower(hex(randomblob(16))))
--   TIMESTAMPTZ -> TEXT  (ISO 8601 strings, stored UTC)
--   JSONB       -> TEXT  (store JSON as text)
--   VARCHAR(n)  -> TEXT
--   BOOLEAN     -> INTEGER (0/1)
--   TEXT[]      -> TEXT  (store JSON array as text)
--   BIGINT      -> INTEGER
--   FLOAT       -> REAL
--   NUMERIC     -> REAL
--   DATE        -> TEXT
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 6.20  User
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
    id                  TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name                TEXT NOT NULL,
    email               TEXT NOT NULL,
    catalog_role        TEXT NOT NULL,  -- admin, steward, analyst, viewer
    preferred_language  TEXT NOT NULL DEFAULT 'en',  -- en, de, fr, it
    department          TEXT,
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_user_catalog_role ON "user"(catalog_role);
CREATE INDEX IF NOT EXISTS idx_user_active ON "user"(active);

-- ---------------------------------------------------------------------------
-- 6.19  Contact (dcat:contactPoint)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact (
    id              TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    organisation    TEXT,
    role            TEXT NOT NULL,  -- data_owner, data_steward, data_custodian, publisher, subject_matter_expert
    user_id         TEXT REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_contact_name ON contact(name);
CREATE INDEX IF NOT EXISTS idx_contact_role ON contact(role);
CREATE INDEX IF NOT EXISTS idx_contact_user_id ON contact(user_id);

-- ---------------------------------------------------------------------------
-- 6.1   Vocabulary (skos:ConceptScheme)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vocabulary (
    id              TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name_en         TEXT NOT NULL,
    name_de         TEXT,
    name_fr         TEXT,
    name_it         TEXT,
    description     TEXT,  -- JSON: {"en": "...", "de": "...", ...}
    version         TEXT,
    homepage        TEXT,
    publisher       TEXT,
    status          TEXT NOT NULL,  -- draft, active, deprecated
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_status ON vocabulary(status);
CREATE INDEX IF NOT EXISTS idx_vocabulary_name_en ON vocabulary(name_en);

-- ---------------------------------------------------------------------------
-- 6.2   Collection (skos:Collection)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection (
    id                      TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    vocabulary_id           TEXT NOT NULL REFERENCES vocabulary(id),
    parent_collection_id    TEXT REFERENCES collection(id),
    name_en                 TEXT NOT NULL,
    name_de                 TEXT,
    name_fr                 TEXT,
    name_it                 TEXT,
    description             TEXT,  -- JSON
    sort_order              INTEGER
);

CREATE INDEX IF NOT EXISTS idx_collection_vocabulary_id ON collection(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_collection_parent_collection_id ON collection(parent_collection_id);

-- ---------------------------------------------------------------------------
-- 6.3   Concept (skos:Concept)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concept (
    id              TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    vocabulary_id   TEXT NOT NULL REFERENCES vocabulary(id),
    collection_id   TEXT REFERENCES collection(id),
    name_en         TEXT NOT NULL,
    name_de         TEXT,
    name_fr         TEXT,
    name_it         TEXT,
    alt_names       TEXT,  -- JSON: {"de": ["Mietobjekt", "MO"], ...}
    definition      TEXT,  -- JSON per locale
    scope_note      TEXT,  -- JSON per locale
    status          TEXT NOT NULL,  -- draft, approved, deprecated
    standard_ref    TEXT,
    egid_relevant   INTEGER NOT NULL DEFAULT 0,
    egrid_relevant  INTEGER NOT NULL DEFAULT 0,
    steward_id      TEXT REFERENCES "user"(id),
    approved_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_concept_vocabulary_id ON concept(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_concept_collection_id ON concept(collection_id);
CREATE INDEX IF NOT EXISTS idx_concept_status ON concept(status);
CREATE INDEX IF NOT EXISTS idx_concept_name_en ON concept(name_en);
CREATE INDEX IF NOT EXISTS idx_concept_steward_id ON concept(steward_id);

-- ---------------------------------------------------------------------------
-- 6.3   Concept Relation (junction: skos:related, skos:broader, skos:narrower)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concept_relation (
    source_concept_id   TEXT NOT NULL REFERENCES concept(id),
    target_concept_id   TEXT NOT NULL REFERENCES concept(id),
    relation_type       TEXT NOT NULL,  -- skos:related, skos:broader, skos:narrower, skos:exactMatch
    PRIMARY KEY (source_concept_id, target_concept_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_concept_relation_source ON concept_relation(source_concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_relation_target ON concept_relation(target_concept_id);

-- ---------------------------------------------------------------------------
-- Term: a simple glossary entry (Fachbegriff) — no fields, no mappings, no data owner
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS term (
    id                  TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name_en             TEXT NOT NULL,
    name_de             TEXT,
    name_fr             TEXT,
    name_it             TEXT,
    definition          TEXT,  -- JSON per locale
    standard_ref        TEXT,  -- e.g., "eCH-0071", "SIA 416 §3.6"
    source_type         TEXT NOT NULL,  -- standard, law, regulation, norm
    source_document     TEXT,  -- full document reference
    status              TEXT NOT NULL DEFAULT 'draft',  -- draft, approved, deprecated
    related_terms       TEXT,  -- JSON array of term IDs
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_term_status ON term(status);
CREATE INDEX IF NOT EXISTS idx_term_source_type ON term(source_type);

-- Junction: concept (business object) ↔ term
CREATE TABLE IF NOT EXISTS concept_term (
    concept_id  TEXT NOT NULL REFERENCES concept(id),
    term_id     TEXT NOT NULL REFERENCES term(id),
    PRIMARY KEY (concept_id, term_id)
);

-- ---------------------------------------------------------------------------
-- 6.5   Code List (skos:ConceptScheme type=codelist)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS code_list (
    id          TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    concept_id  TEXT REFERENCES concept(id),
    name_en     TEXT NOT NULL,
    name_de     TEXT,
    name_fr     TEXT,
    name_it     TEXT,
    source_ref  TEXT,
    version     TEXT,
    status      TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('draft','approved','deprecated')),
    owner_id    TEXT REFERENCES contact(id)
);

CREATE INDEX IF NOT EXISTS idx_code_list_concept_id ON code_list(concept_id);
CREATE INDEX IF NOT EXISTS idx_code_list_name_en ON code_list(name_en);
CREATE INDEX IF NOT EXISTS idx_code_list_status ON code_list(status);
CREATE INDEX IF NOT EXISTS idx_code_list_owner_id ON code_list(owner_id);

-- ---------------------------------------------------------------------------
-- 6.4   Concept Attribute
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concept_attribute (
    id              TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    concept_id      TEXT NOT NULL REFERENCES concept(id),
    name_en         TEXT NOT NULL,
    name_de         TEXT,
    name_fr         TEXT,
    name_it         TEXT,
    definition      TEXT,  -- JSON per locale
    value_type      TEXT NOT NULL,  -- text, integer, float, boolean, date, uri, code
    code_list_id    TEXT REFERENCES code_list(id),
    required        INTEGER NOT NULL DEFAULT 0,
    standard_ref    TEXT,
    sort_order      INTEGER,
    key_role        TEXT CHECK (key_role IS NULL OR key_role IN ('PK','FK','UK'))  -- PK = primary, FK = foreign, UK = alternate unique
);

CREATE INDEX IF NOT EXISTS idx_concept_attribute_concept_id ON concept_attribute(concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_attribute_code_list_id ON concept_attribute(code_list_id);
CREATE INDEX IF NOT EXISTS idx_concept_attribute_value_type ON concept_attribute(value_type);
CREATE INDEX IF NOT EXISTS idx_concept_attribute_key_role ON concept_attribute(key_role);

-- ---------------------------------------------------------------------------
-- 6.6   Code List Value (skos:Concept in code list)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS code_list_value (
    id              TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    code_list_id    TEXT NOT NULL REFERENCES code_list(id),
    code            TEXT NOT NULL,
    label_en        TEXT NOT NULL,
    label_de        TEXT,
    label_fr        TEXT,
    label_it        TEXT,
    description     TEXT,  -- JSON
    deprecated      INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER,
    UNIQUE(code_list_id, code)
);

CREATE INDEX IF NOT EXISTS idx_code_list_value_code_list_id ON code_list_value(code_list_id);
CREATE INDEX IF NOT EXISTS idx_code_list_value_code ON code_list_value(code);

-- ---------------------------------------------------------------------------
-- 6.8   System (bv:System)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system (
    id                  TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name_en             TEXT NOT NULL,
    name_de             TEXT,
    description         TEXT,  -- JSON
    archimate_type      TEXT NOT NULL,  -- Application Component
    technology_stack    TEXT,
    base_url            TEXT,
    scanner_class       TEXT,
    owner_id            TEXT REFERENCES contact(id),
    last_scanned_at     TEXT,
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_system_name_en ON system(name_en);
CREATE INDEX IF NOT EXISTS idx_system_active ON system(active);
CREATE INDEX IF NOT EXISTS idx_system_owner_id ON system(owner_id);

-- ---------------------------------------------------------------------------
-- 6.9   Schema (bv:Schema)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_ (
    id              TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    system_id       TEXT NOT NULL REFERENCES system(id),
    name            TEXT NOT NULL,
    display_name    TEXT,
    schema_type     TEXT NOT NULL,  -- database_schema, gis_workspace, bim_project, file_folder, api_namespace
    description     TEXT,  -- JSON
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_schema_system_id ON schema_(system_id);
CREATE INDEX IF NOT EXISTS idx_schema_schema_type ON schema_(schema_type);

-- ---------------------------------------------------------------------------
-- 6.10  Dataset (dcat:Dataset)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataset (
    id                  TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    schema_id           TEXT NOT NULL REFERENCES schema_(id),
    name                TEXT NOT NULL,
    display_name        TEXT,
    dataset_type        TEXT NOT NULL,  -- table, view, gis_layer, bim_model, file, api_resource
    description         TEXT,  -- JSON per locale
    certified           INTEGER NOT NULL DEFAULT 0,
    egid                TEXT,
    egrid               TEXT,
    row_count_approx    INTEGER,
    source_url          TEXT,
    owner_id            TEXT REFERENCES contact(id),
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_dataset_schema_id ON dataset(schema_id);
CREATE INDEX IF NOT EXISTS idx_dataset_dataset_type ON dataset(dataset_type);
CREATE INDEX IF NOT EXISTS idx_dataset_certified ON dataset(certified);
CREATE INDEX IF NOT EXISTS idx_dataset_name ON dataset(name);
CREATE INDEX IF NOT EXISTS idx_dataset_owner_id ON dataset(owner_id);
CREATE INDEX IF NOT EXISTS idx_dataset_egid ON dataset(egid);
CREATE INDEX IF NOT EXISTS idx_dataset_egrid ON dataset(egrid);

-- ---------------------------------------------------------------------------
-- 6.10  Dataset junction tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dataset_classification (
    dataset_id          TEXT NOT NULL REFERENCES dataset(id),
    classification_id   TEXT NOT NULL REFERENCES data_classification(id),
    assigned_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    assigned_by         TEXT,
    PRIMARY KEY (dataset_id, classification_id)
);

CREATE TABLE IF NOT EXISTS dataset_policy (
    dataset_id  TEXT NOT NULL REFERENCES dataset(id),
    policy_id   TEXT NOT NULL REFERENCES data_policy(id),
    PRIMARY KEY (dataset_id, policy_id)
);

CREATE TABLE IF NOT EXISTS dataset_contact (
    dataset_id  TEXT NOT NULL REFERENCES dataset(id),
    contact_id  TEXT NOT NULL REFERENCES contact(id),
    role        TEXT NOT NULL,  -- data_owner, data_steward, data_custodian, subject_matter_expert
    PRIMARY KEY (dataset_id, contact_id, role)
);

-- ---------------------------------------------------------------------------
-- 6.11  Field (bv:Field)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field (
    id                      TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    dataset_id              TEXT NOT NULL REFERENCES dataset(id),
    name                    TEXT NOT NULL,
    display_name            TEXT,
    data_type               TEXT NOT NULL,
    description             TEXT,  -- JSON per locale
    nullable                INTEGER NOT NULL DEFAULT 1,
    is_primary_key          INTEGER NOT NULL DEFAULT 0,
    is_foreign_key          INTEGER NOT NULL DEFAULT 0,
    references_field_id     TEXT REFERENCES field(id),
    sample_values           TEXT,  -- JSON array
    sort_order              INTEGER
);

CREATE INDEX IF NOT EXISTS idx_field_dataset_id ON field(dataset_id);
CREATE INDEX IF NOT EXISTS idx_field_name ON field(name);
CREATE INDEX IF NOT EXISTS idx_field_references_field_id ON field(references_field_id);

-- ---------------------------------------------------------------------------
-- 6.7   Concept Mapping (skos:exactMatch)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concept_mapping (
    id                      TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    concept_id              TEXT NOT NULL REFERENCES concept(id),
    field_id                TEXT NOT NULL REFERENCES field(id),
    match_type              TEXT NOT NULL,  -- skos:exactMatch, skos:relatedMatch, skos:broadMatch, skos:narrowMatch
    transformation_note     TEXT,
    verified                INTEGER NOT NULL DEFAULT 0,
    created_by              TEXT REFERENCES "user"(id),
    created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_concept_mapping_concept_id ON concept_mapping(concept_id);
CREATE INDEX IF NOT EXISTS idx_concept_mapping_field_id ON concept_mapping(field_id);
CREATE INDEX IF NOT EXISTS idx_concept_mapping_match_type ON concept_mapping(match_type);
CREATE INDEX IF NOT EXISTS idx_concept_mapping_verified ON concept_mapping(verified);

-- ---------------------------------------------------------------------------
-- 6.12  Data Product (dcat:Dataset, published)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_product (
    id                  TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name_en             TEXT NOT NULL,
    name_de             TEXT,
    name_fr             TEXT,
    name_it             TEXT,
    description         TEXT,  -- JSON per locale
    publisher           TEXT NOT NULL,
    license             TEXT,
    theme               TEXT,  -- JSON array of EU Data Theme URIs
    keyword             TEXT,  -- JSON: {"en": ["building", ...], "de": [...]}
    spatial_coverage    TEXT,
    temporal_start      TEXT,  -- ISO 8601 date
    temporal_end        TEXT,  -- ISO 8601 date
    update_frequency    TEXT,
    certified           INTEGER NOT NULL DEFAULT 0,
    issued              TEXT,
    modified            TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_product_name_en ON data_product(name_en);
CREATE INDEX IF NOT EXISTS idx_data_product_publisher ON data_product(publisher);
CREATE INDEX IF NOT EXISTS idx_data_product_certified ON data_product(certified);

-- ---------------------------------------------------------------------------
-- 6.12  Data Product junction tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_product_dataset (
    data_product_id TEXT NOT NULL REFERENCES data_product(id),
    dataset_id      TEXT NOT NULL REFERENCES dataset(id),
    PRIMARY KEY (data_product_id, dataset_id)
);

CREATE TABLE IF NOT EXISTS data_product_classification (
    data_product_id     TEXT NOT NULL REFERENCES data_product(id),
    classification_id   TEXT NOT NULL REFERENCES data_classification(id),
    PRIMARY KEY (data_product_id, classification_id)
);

CREATE TABLE IF NOT EXISTS data_product_policy (
    data_product_id TEXT NOT NULL REFERENCES data_product(id),
    policy_id       TEXT NOT NULL REFERENCES data_policy(id),
    PRIMARY KEY (data_product_id, policy_id)
);

CREATE TABLE IF NOT EXISTS data_product_contact (
    data_product_id TEXT NOT NULL REFERENCES data_product(id),
    contact_id      TEXT NOT NULL REFERENCES contact(id),
    role            TEXT NOT NULL,  -- data_owner, data_steward, publisher
    PRIMARY KEY (data_product_id, contact_id, role)
);

-- ---------------------------------------------------------------------------
-- 6.13  Distribution (dcat:Distribution)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS distribution (
    id                  TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    data_product_id     TEXT NOT NULL REFERENCES data_product(id),
    name_en             TEXT NOT NULL,
    name_de             TEXT,
    name_fr             TEXT,
    name_it             TEXT,
    access_url          TEXT NOT NULL,
    download_url        TEXT,
    media_type          TEXT,
    access_type         TEXT NOT NULL,  -- rest_api, sql_endpoint, file_export, report, dashboard, odata
    format              TEXT,
    byte_size           INTEGER,
    conformsTo          TEXT,
    description         TEXT,  -- JSON per locale
    availability        TEXT   -- stable, available, experimental
);

CREATE INDEX IF NOT EXISTS idx_distribution_data_product_id ON distribution(data_product_id);
CREATE INDEX IF NOT EXISTS idx_distribution_access_type ON distribution(access_type);

-- ---------------------------------------------------------------------------
-- 6.16  Data Classification
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_classification (
    id                  TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name_en             TEXT NOT NULL,
    name_de             TEXT,
    name_fr             TEXT,
    name_it             TEXT,
    sensitivity_level   INTEGER NOT NULL,  -- 0=public, 1=internal, 2=confidential, 3=secret
    legal_basis         TEXT,
    description         TEXT,  -- JSON
    access_restriction  TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_classification_sensitivity_level ON data_classification(sensitivity_level);

-- ---------------------------------------------------------------------------
-- 6.14  Relationship Edge
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relationship_edge (
    source_id       TEXT NOT NULL,
    source_type     TEXT NOT NULL,  -- concept, dataset, field, data_product
    target_id       TEXT NOT NULL,
    target_type     TEXT NOT NULL,  -- concept, dataset, field, data_product
    rel_type        TEXT NOT NULL,  -- realizes, lineage_downstream, lineage_upstream, derived_from, skos_related, skos_broader, shared_classification, sibling
    weight          REAL NOT NULL DEFAULT 0.0,  -- 0.0-1.0
    derived_from    TEXT,
    refreshed_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (source_id, source_type, target_id, target_type, rel_type)
);

CREATE INDEX IF NOT EXISTS idx_relationship_edge_source ON relationship_edge(source_id, source_type);
CREATE INDEX IF NOT EXISTS idx_relationship_edge_target ON relationship_edge(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_relationship_edge_rel_type ON relationship_edge(rel_type);

-- ---------------------------------------------------------------------------
-- 6.15  Lineage Link (prov:wasDerivedFrom)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lineage_link (
    id                      TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    source_dataset_id       TEXT NOT NULL REFERENCES dataset(id),
    target_dataset_id       TEXT NOT NULL REFERENCES dataset(id),
    transformation_type     TEXT,  -- copy, transform, aggregate, filter, join, derive
    tool_name               TEXT,
    job_name                TEXT,
    description             TEXT,  -- JSON per locale
    frequency               TEXT,  -- realtime, daily, weekly, on_demand
    recorded_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    recorded_by             TEXT REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_lineage_link_source_dataset_id ON lineage_link(source_dataset_id);
CREATE INDEX IF NOT EXISTS idx_lineage_link_target_dataset_id ON lineage_link(target_dataset_id);
CREATE INDEX IF NOT EXISTS idx_lineage_link_transformation_type ON lineage_link(transformation_type);

-- ---------------------------------------------------------------------------
-- 6.17  Data Profile (dqv:QualityMeasurement)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_profile (
    id                      TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    dataset_id              TEXT NOT NULL REFERENCES dataset(id),
    row_count               INTEGER,
    null_percentage         REAL,    -- 0.0-1.0
    cardinality             INTEGER,
    min_value               TEXT,
    max_value               TEXT,
    completeness_score      REAL,    -- 0.0-1.0
    format_validity_score   REAL,    -- 0.0-1.0
    timeliness_score        REAL,    -- 0.0-1.0  Aktualität
    accuracy_score          REAL,    -- 0.0-1.0  Genauigkeit
    consistency_score       REAL,    -- 0.0-1.0  Konsistenz
    uniqueness_score        REAL,    -- 0.0-1.0  Eindeutigkeit
    sample_values           TEXT,    -- JSON array
    profiled_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    profiler                TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_profile_dataset_id ON data_profile(dataset_id);

-- ---------------------------------------------------------------------------
-- 6.18  Data Policy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_policy (
    id              TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name_en         TEXT NOT NULL,
    name_de         TEXT,
    name_fr         TEXT,
    name_it         TEXT,
    policy_type     TEXT NOT NULL,  -- retention, access, quality, privacy, opendata
    rule_definition TEXT NOT NULL,  -- JSON per locale
    legal_basis     TEXT,
    owner           TEXT,
    valid_from      TEXT,
    valid_to        TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_policy_policy_type ON data_policy(policy_type);
