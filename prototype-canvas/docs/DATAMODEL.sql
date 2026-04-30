-- =============================================================================
-- BBL Architektur-Canvas — Schema DDL
-- Generated from docs/DATAMODEL.md v0.3
-- Target: Supabase / PostgreSQL 15+
--
-- Run order: this file is meant to be executed top-to-bottom against a fresh
-- database. It creates 10 catalog tables, RLS policies, indexes, and a
-- minimal helper-function set. Audit / version history is intentionally
-- absent (deferred to §10 Future Developments).
--
-- Idempotency: this script is NOT idempotent. It uses CREATE TABLE / CREATE
-- INDEX / CREATE POLICY without IF NOT EXISTS. To re-run, drop the schema
-- first:
--   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
--
-- Supabase dependencies: contact.auth_user_id references auth.users(id); the
-- RLS helpers call auth.uid(); the Realtime block targets the
-- supabase_realtime publication. For vanilla Postgres testing the auth.*
-- references must be stubbed and the Realtime block becomes a no-op
-- (handled defensively below).
--
-- Bootstrap: see "Operator bootstrap" section near the bottom — the first
-- admin contact must be created via service_role / superuser, since RLS
-- otherwise blocks the very first INSERT into contact.
-- =============================================================================

-- =============================================================================
-- Extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram label search


-- =============================================================================
-- Helper: keep modified_at fresh
-- =============================================================================

CREATE OR REPLACE FUNCTION touch_modified_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modified_at := now();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- 1. node — universal catalog entity
-- =============================================================================

CREATE TABLE node (
  id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text           NOT NULL,
  kind              text           NOT NULL,
  label_de          text           NOT NULL,
  label_fr          text,
  label_it          text,
  label_en          text,
  description_de    text,
  description_fr    text,
  description_it    text,
  description_en    text,
  tags              text[]         NOT NULL DEFAULT '{}',
  classification    text,
  theme_slug        text,
  lifecycle_status  text           NOT NULL DEFAULT 'entwurf',
  x                 numeric(10,2),
  y                 numeric(10,2),
  created_at        timestamptz    NOT NULL DEFAULT now(),
  modified_at       timestamptz    NOT NULL DEFAULT now(),

  -- Slug must be globally unique; (id, kind) UK is required so side tables
  -- can declare composite FKs to (node_id, kind).
  CONSTRAINT node_slug_uk        UNIQUE (slug),
  CONSTRAINT node_id_kind_uk     UNIQUE (id, kind),

  CONSTRAINT node_kind_chk
    CHECK (kind IN ('system','pset','distribution','attribute','code_list','standard_reference')),
  CONSTRAINT node_classification_chk
    CHECK (classification IS NULL OR classification IN ('oeffentlich','intern','vertraulich','geheim')),
  CONSTRAINT node_lifecycle_chk
    CHECK (lifecycle_status IN ('entwurf','standardisiert','produktiv','abgeloest')),
  CONSTRAINT node_slug_format_chk
    CHECK (slug ~ '^(sys|pset|dist|attr|cl|std):[A-Za-z0-9_.-]+$'),
  CONSTRAINT node_xy_coherence_chk
    CHECK ((x IS NULL) = (y IS NULL))
);

COMMENT ON TABLE  node IS 'Universal catalog entity. The kind discriminator selects which side table (system_meta, distribution_meta, attribute_meta, standard_reference_meta) carries kind-specific fields. code_list nodes have child rows in code_list_entry; pset nodes optionally have a 1:1 processing_activity.';
COMMENT ON COLUMN node.slug             IS 'Stable human-readable key in the form {kind_prefix}:{technical_path}, e.g. pset:address.';
COMMENT ON COLUMN node.tags             IS 'Language-independent free-text keys; translations live in the application i18n catalog.';
COMMENT ON COLUMN node.theme_slug       IS 'Optional free-text grouping (Personendaten, Geokoordinaten, …).';
COMMENT ON COLUMN node.x                IS 'Single-canvas x coordinate. NULL = not placed on canvas.';
COMMENT ON COLUMN node.y                IS 'Single-canvas y coordinate. NULL = not placed on canvas.';

CREATE INDEX node_kind_idx           ON node (kind);
CREATE INDEX node_lifecycle_idx      ON node (lifecycle_status);
CREATE INDEX node_classification_idx ON node (classification) WHERE classification IS NOT NULL;
CREATE INDEX node_modified_at_idx    ON node (modified_at DESC);
CREATE INDEX node_tags_gin           ON node USING gin (tags);

CREATE INDEX node_label_de_trgm ON node USING gin (label_de gin_trgm_ops);
CREATE INDEX node_label_fr_trgm ON node USING gin (label_fr gin_trgm_ops);
CREATE INDEX node_label_it_trgm ON node USING gin (label_it gin_trgm_ops);
CREATE INDEX node_label_en_trgm ON node USING gin (label_en gin_trgm_ops);

CREATE TRIGGER node_touch_modified_at
  BEFORE UPDATE ON node
  FOR EACH ROW EXECUTE FUNCTION touch_modified_at();


-- =============================================================================
-- 2. edge — directed typed connection between two nodes
-- =============================================================================

CREATE TABLE edge (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id  uuid         NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  to_node_id    uuid         NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  edge_type     text         NOT NULL,
  label_de      text,
  label_fr      text,
  label_it      text,
  label_en      text,
  cardinality   text,
  note          text,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  modified_at   timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT edge_no_self_loop CHECK (from_node_id <> to_node_id),
  CONSTRAINT edge_no_dup       UNIQUE (from_node_id, to_node_id, edge_type),
  CONSTRAINT edge_type_chk     CHECK (edge_type IN (
    'publishes', 'contains', 'realises', 'in_pset', 'values_from',
    'fk_references', 'derives_from', 'flows_into', 'replaces'
  ))
);

COMMENT ON TABLE  edge IS 'All parent-child, peer, and lineage relationships between nodes. There are no parent-pointer FKs on side tables; everything goes through edge.';
COMMENT ON COLUMN edge.note IS 'DE-only internal commentary, not user-visible.';

CREATE INDEX edge_from_idx        ON edge (from_node_id);
CREATE INDEX edge_to_idx          ON edge (to_node_id);
CREATE INDEX edge_type_idx        ON edge (edge_type);
CREATE INDEX edge_modified_at_idx ON edge (modified_at DESC);

-- Hierarchy invariants (FR-08).
CREATE UNIQUE INDEX edge_attribute_one_parent
  ON edge (to_node_id) WHERE edge_type = 'contains';

CREATE UNIQUE INDEX edge_distribution_one_publisher
  ON edge (to_node_id) WHERE edge_type = 'publishes';

CREATE TRIGGER edge_touch_modified_at
  BEFORE UPDATE ON edge
  FOR EACH ROW EXECUTE FUNCTION touch_modified_at();


-- =============================================================================
-- 3. system_meta — kind-locked side table for kind = system
-- =============================================================================

CREATE TABLE system_meta (
  node_id           uuid     PRIMARY KEY,
  kind              text     NOT NULL DEFAULT 'system',
  technology_stack  text,
  base_url          text,
  security_zone     text,
  active            boolean  NOT NULL DEFAULT true,

  CONSTRAINT system_meta_kind_chk CHECK (kind = 'system'),
  FOREIGN KEY (node_id, kind) REFERENCES node (id, kind) ON DELETE CASCADE
);

COMMENT ON TABLE  system_meta IS 'Per-system fields. 1:0..1 with a node row of kind = system, enforced by composite FK.';
COMMENT ON COLUMN system_meta.security_zone IS 'ISG security zone identifier.';


-- =============================================================================
-- 4. distribution_meta — kind-locked side table for kind = distribution
-- =============================================================================

CREATE TABLE distribution_meta (
  node_id              uuid         PRIMARY KEY,
  kind                 text         NOT NULL DEFAULT 'distribution',
  name                 text         NOT NULL,
  type                 text         NOT NULL,
  schema_name          text,
  access_url           text,
  download_url         text,
  format               text,
  media_type           text,
  license              text,
  accrual_periodicity  text,
  availability         text,
  spatial_coverage     text,
  temporal_start       date,
  temporal_end         date,
  issued               timestamptz,
  modified             timestamptz,

  CONSTRAINT distribution_meta_kind_chk CHECK (kind = 'distribution'),
  CONSTRAINT distribution_meta_type_chk CHECK (type IN ('table','view','api','file')),
  FOREIGN KEY (node_id, kind) REFERENCES node (id, kind) ON DELETE CASCADE
);

COMMENT ON TABLE  distribution_meta  IS 'DCAT-AP CH distribution metadata. 1:0..1 with a node row of kind = distribution.';
COMMENT ON COLUMN distribution_meta.name        IS 'Technical name in the source system, e.g. refx_gebaeude.';
COMMENT ON COLUMN distribution_meta.access_url  IS 'DCAT-AP CH mandatory at publication time.';
COMMENT ON COLUMN distribution_meta.license     IS 'Reference into VOCAB-CH-LICENSE.';
COMMENT ON COLUMN distribution_meta.accrual_periodicity IS 'EU Frequency vocabulary, e.g. ANNUAL, MONTHLY.';

CREATE INDEX distribution_meta_type_idx ON distribution_meta (type);
CREATE INDEX distribution_meta_name_idx ON distribution_meta (name);


-- =============================================================================
-- 5. attribute_meta — kind-locked side table for kind = attribute
-- =============================================================================

CREATE TABLE attribute_meta (
  node_id                  uuid     PRIMARY KEY,
  kind                     text     NOT NULL DEFAULT 'attribute',
  name                     text     NOT NULL,
  data_type                text,
  key_role                 text,
  nullable                 boolean  NOT NULL DEFAULT true,
  personal_data_category   text     NOT NULL DEFAULT 'keine',
  source_structure         text,
  sort_order               integer,

  CONSTRAINT attribute_meta_kind_chk      CHECK (kind = 'attribute'),
  CONSTRAINT attribute_meta_key_role_chk  CHECK (key_role IS NULL OR key_role IN ('PK','FK','UK')),
  CONSTRAINT attribute_meta_pdc_chk
    CHECK (personal_data_category IN ('keine','personenbezogen','besonders_schutzenswert')),
  FOREIGN KEY (node_id, kind) REFERENCES node (id, kind) ON DELETE CASCADE
);

COMMENT ON TABLE  attribute_meta IS 'Per-attribute technical metadata and DSG personal-data tagging. 1:0..1 with a node row of kind = attribute. Pset tag, FK reference, and codelist binding are NOT columns — they are edges.';
COMMENT ON COLUMN attribute_meta.name             IS 'Technical column name (e.g. OBJECT_ID, EGID). Single-locale.';
COMMENT ON COLUMN attribute_meta.personal_data_category IS 'DSG Art. 5 lit. c. Default keine; edit per attribute.';
COMMENT ON COLUMN attribute_meta.source_structure IS 'Free-text label for source-system substructure (e.g. SAP BAPI substructure name).';

CREATE INDEX attribute_meta_name_idx     ON attribute_meta (name);
CREATE INDEX attribute_meta_key_role_idx ON attribute_meta (key_role) WHERE key_role IS NOT NULL;
CREATE INDEX attribute_meta_pdc_idx      ON attribute_meta (personal_data_category)
  WHERE personal_data_category <> 'keine';


-- =============================================================================
-- 6. standard_reference_meta — kind-locked side table for kind = standard_reference
-- =============================================================================

CREATE TABLE standard_reference_meta (
  node_id      uuid    PRIMARY KEY,
  kind         text    NOT NULL DEFAULT 'standard_reference',
  org          text    NOT NULL,
  code         text    NOT NULL,
  std_version  text,
  url          text,

  CONSTRAINT standard_reference_meta_kind_chk CHECK (kind = 'standard_reference'),
  CONSTRAINT standard_reference_meta_uk       UNIQUE (org, code, std_version),
  FOREIGN KEY (node_id, kind) REFERENCES node (id, kind) ON DELETE CASCADE
);

COMMENT ON TABLE  standard_reference_meta IS 'External normative anchors (eCH-0010, ISO 19115, SR 510.625, …). Standards reference one another via edge_type = derives_from.';
COMMENT ON COLUMN standard_reference_meta.org IS 'Issuing organisation: eCH, ISO, Bund, EU, BFE, BFS, …';


-- =============================================================================
-- 7. code_list_entry — rows of a controlled vocabulary
--    Side table of a node row of kind = code_list. Entries are NOT nodes.
-- =============================================================================

CREATE TABLE code_list_entry (
  code_list_node_id  uuid     NOT NULL,
  kind               text     NOT NULL DEFAULT 'code_list',
  code               text     NOT NULL,
  label_de           text     NOT NULL,
  label_fr           text,
  label_it           text,
  label_en           text,
  description_de     text,
  description_fr     text,
  description_it     text,
  description_en     text,
  sort_order         integer,
  deprecated         boolean  NOT NULL DEFAULT false,

  PRIMARY KEY (code_list_node_id, code),
  CONSTRAINT code_list_entry_kind_chk CHECK (kind = 'code_list'),
  FOREIGN KEY (code_list_node_id, kind) REFERENCES node (id, kind) ON DELETE CASCADE
);

COMMENT ON TABLE code_list_entry IS 'Rows of a controlled vocabulary. Leaf data; never participates in the edge graph.';

CREATE INDEX code_list_entry_label_de_trgm ON code_list_entry USING gin (label_de gin_trgm_ops);
CREATE INDEX code_list_entry_label_fr_trgm ON code_list_entry USING gin (label_fr gin_trgm_ops);
CREATE INDEX code_list_entry_label_it_trgm ON code_list_entry USING gin (label_it gin_trgm_ops);
CREATE INDEX code_list_entry_label_en_trgm ON code_list_entry USING gin (label_en gin_trgm_ops);


-- =============================================================================
-- 8. processing_activity — DSG Art. 12 Verzeichnis
--    1:0..1 with a node row of kind = pset.
-- =============================================================================

CREATE TABLE processing_activity (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  pset_node_id           uuid         NOT NULL,
  kind                   text         NOT NULL DEFAULT 'pset',
  purpose                text         NOT NULL,
  legal_basis            text,
  data_subjects          text,
  recipients             text,
  retention_policy       text,
  cross_border_transfer  boolean      NOT NULL DEFAULT false,
  transfer_countries     text[],
  dpia_required          boolean      NOT NULL DEFAULT false,
  dpia_url               text,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  modified_at            timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT processing_activity_pset_uk UNIQUE (pset_node_id),
  CONSTRAINT processing_activity_kind_chk CHECK (kind = 'pset'),
  FOREIGN KEY (pset_node_id, kind) REFERENCES node (id, kind) ON DELETE CASCADE
);

COMMENT ON TABLE  processing_activity IS 'DSG Art. 12 Verzeichnis der Bearbeitungstätigkeiten. DE-only by federal practice.';
COMMENT ON COLUMN processing_activity.purpose            IS 'Bearbeitungszweck (DE).';
COMMENT ON COLUMN processing_activity.transfer_countries IS 'ISO 3166-1 alpha-2 codes.';

CREATE TRIGGER processing_activity_touch_modified_at
  BEFORE UPDATE ON processing_activity
  FOR EACH ROW EXECUTE FUNCTION touch_modified_at();

-- Soft validation: warn (don't block) when the parent pset has no
-- attributes flagged as personal data.
CREATE OR REPLACE FUNCTION processing_activity_warn_no_personal_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_pd boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM edge AS e
      JOIN attribute_meta AS am ON am.node_id = e.from_node_id
     WHERE e.to_node_id = NEW.pset_node_id
       AND e.edge_type = 'in_pset'
       AND am.personal_data_category <> 'keine'
  )
  INTO has_pd;

  IF NOT has_pd THEN
    RAISE WARNING
      'processing_activity for pset % has no attributes with personal_data_category != keine',
      NEW.pset_node_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER processing_activity_validate
  BEFORE INSERT OR UPDATE ON processing_activity
  FOR EACH ROW EXECUTE FUNCTION processing_activity_warn_no_personal_data();


-- =============================================================================
-- 9. contact — single table for users, externals, teams
-- =============================================================================

CREATE TABLE contact (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Supabase-only: depends on the auth.users table from Supabase Auth.
  -- For vanilla Postgres testing, replace REFERENCES auth.users (id)
  -- with a plain `uuid` column (no FK).
  auth_user_id  uuid         REFERENCES auth.users (id) ON DELETE SET NULL,
  email         text         NOT NULL,
  name          text         NOT NULL,
  phone         text,
  organisation  text,
  is_team       boolean      NOT NULL DEFAULT false,
  app_role      text,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  modified_at   timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT contact_email_uk     UNIQUE (email),
  CONSTRAINT contact_auth_user_uk UNIQUE (auth_user_id),
  CONSTRAINT contact_app_role_chk
    CHECK (app_role IS NULL OR app_role IN ('viewer','editor','admin')),
  CONSTRAINT contact_team_no_auth_chk
    CHECK (auth_user_id IS NULL OR is_team = false)
);

COMMENT ON TABLE  contact IS 'Person, team, or org unit. auth_user_id links to Supabase auth when the contact has an account; nullable for externals and teams.';
COMMENT ON COLUMN contact.email IS 'Continuously monitored per DCAT-AP CH dcat:contactPoint requirement; doubles as Excel join key.';
COMMENT ON COLUMN contact.is_team IS 'true distinguishes org units / shared mailboxes from individual persons.';
COMMENT ON COLUMN contact.app_role IS 'Catalog-edit permission (viewer/editor/admin). NULL = non-user contact.';

CREATE INDEX contact_auth_user_idx
  ON contact (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX contact_organisation_idx ON contact (organisation);

CREATE TRIGGER contact_touch_modified_at
  BEFORE UPDATE ON contact
  FOR EACH ROW EXECUTE FUNCTION touch_modified_at();


-- =============================================================================
-- 10. role_assignment — NaDB role attribution: contact + role + scope
-- =============================================================================

CREATE TABLE role_assignment (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id     uuid         NOT NULL REFERENCES contact (id) ON DELETE RESTRICT,
  role           text         NOT NULL,
  scope_node_id  uuid         NOT NULL REFERENCES node (id) ON DELETE CASCADE,
  valid_from     date,
  valid_to       date,
  note           text,
  created_at     timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT role_assignment_dates_chk
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CONSTRAINT role_assignment_role_chk CHECK (role IN (
    'data_owner',
    'local_data_steward',
    'local_data_steward_statistics',
    'local_data_custodian',
    'data_producer',
    'data_consumer',
    'swiss_data_steward',
    'data_steward_statistics',
    'ida_representative',
    'information_security_officer'
  ))
);

COMMENT ON TABLE  role_assignment IS 'NaDB role attribution: which contact holds which role at which node-scoped target. dct:publisher and dcat:contactPoint are derived projections, not stored.';
COMMENT ON COLUMN role_assignment.note IS 'DE-only internal commentary.';

-- Same role for same contact at same scope can have multiple historical
-- entries but only one active per start date. Postgres requires an
-- expression index (not a table-level UNIQUE) because of COALESCE.
CREATE UNIQUE INDEX role_assignment_active_uk
  ON role_assignment (contact_id, role, scope_node_id,
                      COALESCE(valid_from, '1900-01-01'::date));

CREATE INDEX role_assignment_scope_idx        ON role_assignment (scope_node_id);
CREATE INDEX role_assignment_contact_role_idx ON role_assignment (contact_id, role);
CREATE INDEX role_assignment_active_idx
  ON role_assignment (scope_node_id, role) WHERE valid_to IS NULL;


-- =============================================================================
-- RLS helpers
-- =============================================================================

-- SECURITY DEFINER lets these helpers query `contact` without recursing into
-- the `contact_*` RLS policies (those policies in turn call these helpers).
-- SET search_path locks down the schema lookup against search-path attacks.
CREATE OR REPLACE FUNCTION current_user_can_edit()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contact
     WHERE contact.auth_user_id = auth.uid()
       AND contact.app_role IN ('editor','admin')
  );
$$;

CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM contact
     WHERE contact.auth_user_id = auth.uid()
       AND contact.app_role = 'admin'
  );
$$;


-- =============================================================================
-- Row-Level Security
-- =============================================================================

ALTER TABLE node                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_meta             ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_meta       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attribute_meta          ENABLE ROW LEVEL SECURITY;
ALTER TABLE standard_reference_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_list_entry         ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_activity     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignment         ENABLE ROW LEVEL SECURITY;

-- Catalog tables: read by any authenticated user; write by editor/admin.
CREATE POLICY node_read  ON node  FOR SELECT TO authenticated USING (true);
CREATE POLICY node_write ON node  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

CREATE POLICY edge_read  ON edge  FOR SELECT TO authenticated USING (true);
CREATE POLICY edge_write ON edge  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

CREATE POLICY system_meta_read  ON system_meta  FOR SELECT TO authenticated USING (true);
CREATE POLICY system_meta_write ON system_meta  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

CREATE POLICY distribution_meta_read  ON distribution_meta  FOR SELECT TO authenticated USING (true);
CREATE POLICY distribution_meta_write ON distribution_meta  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

CREATE POLICY attribute_meta_read  ON attribute_meta  FOR SELECT TO authenticated USING (true);
CREATE POLICY attribute_meta_write ON attribute_meta  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

CREATE POLICY standard_reference_meta_read  ON standard_reference_meta  FOR SELECT TO authenticated USING (true);
CREATE POLICY standard_reference_meta_write ON standard_reference_meta  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

CREATE POLICY code_list_entry_read  ON code_list_entry  FOR SELECT TO authenticated USING (true);
CREATE POLICY code_list_entry_write ON code_list_entry  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

CREATE POLICY processing_activity_read  ON processing_activity  FOR SELECT TO authenticated USING (true);
CREATE POLICY processing_activity_write ON processing_activity  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

CREATE POLICY role_assignment_read  ON role_assignment  FOR SELECT TO authenticated USING (true);
CREATE POLICY role_assignment_write ON role_assignment  FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

-- contact: a user may always read/update their own row; only admins manage others.
CREATE POLICY contact_read ON contact FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR current_user_is_admin());

CREATE POLICY contact_update_self_or_admin ON contact FOR UPDATE TO authenticated
  USING      (auth_user_id = auth.uid() OR current_user_is_admin())
  WITH CHECK (auth_user_id = auth.uid() OR current_user_is_admin());

CREATE POLICY contact_insert_admin ON contact FOR INSERT TO authenticated
  WITH CHECK (current_user_is_admin());

CREATE POLICY contact_delete_admin ON contact FOR DELETE TO authenticated
  USING (current_user_is_admin());


-- =============================================================================
-- Realtime publication
-- Catalog tables publish; governance and audit tables intentionally don't.
-- =============================================================================

-- Defensive: the supabase_realtime publication only exists on Supabase (or a
-- self-hosted Supabase setup that creates it). Skip silently elsewhere.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE
             node, edge, system_meta, distribution_meta, attribute_meta,
             standard_reference_meta, code_list_entry, processing_activity';
  END IF;
END $$;


-- =============================================================================
-- Operator bootstrap — run once, as service_role / superuser
-- =============================================================================
-- RLS makes contact_insert_admin require an existing admin. To create the very
-- first admin, run the INSERT below from a role that bypasses RLS (Supabase's
-- service_role key, or a `postgres` superuser session). After this row exists,
-- subsequent admin / editor / viewer contacts can be created through the
-- normal RLS-gated path.
--
-- Replace the placeholder UUID and email with your real Supabase user.
--
-- INSERT INTO contact (auth_user_id, email, name, app_role) VALUES
--   ('00000000-0000-0000-0000-000000000000', 'admin@bbl.admin.ch', 'Bootstrap Admin', 'admin');


-- =============================================================================
-- Optional seed: BBL systems (uncomment to populate)
-- Source-of-truth list per docs/DATAMODEL.md §6.3.
-- =============================================================================

-- INSERT INTO node (slug, kind, label_de, lifecycle_status) VALUES
--   ('sys:refx',      'system', 'SAP RE-FX',  'produktiv'),
--   ('sys:bbl_gis',   'system', 'BBL GIS',    'produktiv'),
--   ('sys:gwr',       'system', 'BFS GWR',    'produktiv'),
--   ('sys:av_gis',    'system', 'AV GIS',     'produktiv'),
--   ('sys:grundbuch', 'system', 'Grundbuch',  'produktiv');
--
-- INSERT INTO system_meta (node_id, technology_stack, base_url, security_zone, active)
-- SELECT id,
--   CASE slug
--     WHEN 'sys:refx'      THEN 'SAP S/4HANA'
--     WHEN 'sys:bbl_gis'   THEN 'ArcGIS Online'
--     WHEN 'sys:gwr'       THEN 'PostgreSQL (BFS)'
--     WHEN 'sys:av_gis'    THEN 'ArcGIS / kantonale Geodaten'
--     WHEN 'sys:grundbuch' THEN 'kantonale Grundbuchsysteme'
--   END,
--   NULL, NULL, true
-- FROM node WHERE kind = 'system';


-- =============================================================================
-- End of schema
-- =============================================================================
