-- =============================================================================
-- BBL Architektur-Canvas — Schema DDL
-- Generated from docs/DATAMODEL.md v0.4
-- Target: Supabase / PostgreSQL 15+
--
-- Run order: this file is meant to be executed top-to-bottom against a fresh
-- database. It creates 11 catalog tables, RLS policies, indexes, and a
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
-- 1. canvas — named perspective wrapping a self-contained set of nodes
--
-- Each canvas owns its own nodes (FK enforced on node.canvas_id NOT NULL); two
-- canvases needing the same conceptual entity ("AV GIS") each carry their own
-- node row. This is the simpler of two multi-canvas patterns; cross-canvas
-- node reuse — same node placed at different positions on different canvases
-- — is the deferred Path A in §10 of DATAMODEL.md.
--
-- Home view (home_scale, home_center_x, home_center_y) is curator-set and
-- shared by all viewers of the canvas; per-user-per-canvas viewport
-- preferences remain a §10 deferral.
--
-- The owner_contact_id FK is added below, after `contact` is created.
-- =============================================================================

CREATE TABLE canvas (
  id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text           NOT NULL,
  label_de          text           NOT NULL,
  label_fr          text,
  label_it          text,
  label_en          text,
  description_de    text,
  description_fr    text,
  description_it    text,
  description_en    text,
  home_scale        numeric(10,6),
  home_center_x     numeric(10,2),
  home_center_y     numeric(10,2),
  visibility        text           NOT NULL DEFAULT 'public',
  owner_contact_id  uuid,
  created_at        timestamptz    NOT NULL DEFAULT now(),
  modified_at       timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT canvas_slug_uk          UNIQUE (slug),
  CONSTRAINT canvas_slug_format_chk  CHECK (slug ~ '^[a-z0-9][a-z0-9_.-]*$'),
  CONSTRAINT canvas_visibility_chk   CHECK (visibility IN ('public','restricted')),
  -- All three home-view coords or none. Mirrors node.x/y coherence.
  CONSTRAINT canvas_home_view_coherence_chk CHECK (
    (home_scale IS NULL AND home_center_x IS NULL AND home_center_y IS NULL)
    OR
    (home_scale IS NOT NULL AND home_center_x IS NOT NULL AND home_center_y IS NOT NULL)
  ),
  CONSTRAINT canvas_home_scale_positive_chk
    CHECK (home_scale IS NULL OR home_scale > 0)
);

COMMENT ON TABLE  canvas IS 'Named perspective wrapping a self-contained node set. label_de is the only required label; other locales follow the global de → en → first-non-null fallback. Each canvas owns its own nodes (Path B); cross-canvas node reuse is deferred to §10.';
COMMENT ON COLUMN canvas.slug          IS 'URL-friendly key for hash routing (e.g. #/c/bbl-immo/diagram). Globally unique.';
COMMENT ON COLUMN canvas.visibility    IS 'public = anon-readable; restricted = signed-in only. Editor permissions are gated by contact.app_role independently of visibility.';
COMMENT ON COLUMN canvas.home_scale    IS 'Curator-set home-view zoom level. NULL = no curated view, frontend falls back to fit-all.';
COMMENT ON COLUMN canvas.home_center_x IS 'Home-view world-X centre. NULL together with the other home_* columns.';
COMMENT ON COLUMN canvas.home_center_y IS 'Home-view world-Y centre. NULL together with the other home_* columns.';

CREATE INDEX canvas_visibility_idx  ON canvas (visibility);
CREATE INDEX canvas_modified_at_idx ON canvas (modified_at DESC);

CREATE TRIGGER canvas_touch_modified_at
  BEFORE UPDATE ON canvas
  FOR EACH ROW EXECUTE FUNCTION touch_modified_at();


-- =============================================================================
-- 2. node — universal catalog entity
-- =============================================================================

CREATE TABLE node (
  id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id         uuid           NOT NULL REFERENCES canvas(id) ON DELETE CASCADE,
  slug              text           NOT NULL,
  kind              text           NOT NULL,
  label_de          text,
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

  -- Slug is unique per canvas (two canvases can each have a `dist:av_gv_dat`).
  -- (id, kind) UK is required so side tables can declare composite FKs to
  -- (node_id, kind); side tables stay canvas-agnostic since id is global.
  CONSTRAINT node_canvas_slug_uk UNIQUE (canvas_id, slug),
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
COMMENT ON COLUMN node.canvas_id        IS 'Owning canvas. NOT NULL; node and its meta/edges/role-assignments cascade on canvas deletion.';
COMMENT ON COLUMN node.slug             IS 'Stable human-readable key in the form {kind_prefix}:{technical_path}, e.g. pset:address. Unique within a canvas.';
COMMENT ON COLUMN node.tags             IS 'Language-independent free-text keys; translations live in the application i18n catalog.';
COMMENT ON COLUMN node.theme_slug       IS 'Optional free-text grouping (Personendaten, Geokoordinaten, …).';
COMMENT ON COLUMN node.x                IS 'Canvas-space x coordinate. NULL = not placed.';
COMMENT ON COLUMN node.y                IS 'Canvas-space y coordinate. NULL = not placed.';

CREATE INDEX node_canvas_kind_idx    ON node (canvas_id, kind);
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
-- 3. edge — directed typed connection between two nodes
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
-- 4. system_meta — kind-locked side table for kind = system
-- =============================================================================

CREATE TABLE system_meta (
  node_id           uuid     PRIMARY KEY,
  kind              text     NOT NULL DEFAULT 'system',
  technology_stack  text,
  base_url          text,
  security_zone     text,
  is_active         boolean  NOT NULL DEFAULT true,

  CONSTRAINT system_meta_kind_chk CHECK (kind = 'system'),
  FOREIGN KEY (node_id, kind) REFERENCES node (id, kind) ON DELETE CASCADE
);

COMMENT ON TABLE  system_meta IS 'Per-system fields. 1:0..1 with a node row of kind = system, enforced by composite FK.';
COMMENT ON COLUMN system_meta.security_zone IS 'ISG security zone identifier.';


-- =============================================================================
-- 5. distribution_meta — kind-locked side table for kind = distribution
-- =============================================================================

CREATE TABLE distribution_meta (
  node_id              uuid         PRIMARY KEY,
  kind                 text         NOT NULL DEFAULT 'distribution',
  technical_name       text,
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
COMMENT ON COLUMN distribution_meta.technical_name IS 'Technical name in the source system, e.g. refx_gebaeude.';
COMMENT ON COLUMN distribution_meta.access_url  IS 'DCAT-AP CH mandatory at publication time.';
COMMENT ON COLUMN distribution_meta.license     IS 'Reference into VOCAB-CH-LICENSE.';
COMMENT ON COLUMN distribution_meta.accrual_periodicity IS 'EU Frequency vocabulary, e.g. ANNUAL, MONTHLY.';

CREATE INDEX distribution_meta_type_idx           ON distribution_meta (type);
CREATE INDEX distribution_meta_technical_name_idx ON distribution_meta (technical_name);


-- =============================================================================
-- 6. attribute_meta — kind-locked side table for kind = attribute
-- =============================================================================

CREATE TABLE attribute_meta (
  node_id                  uuid     PRIMARY KEY,
  kind                     text     NOT NULL DEFAULT 'attribute',
  technical_name           text,
  data_type                text,
  key_role                 text,
  is_nullable              boolean  NOT NULL DEFAULT true,
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
COMMENT ON COLUMN attribute_meta.technical_name   IS 'Technical column name (e.g. OBJECT_ID, EGID). Single-locale.';
COMMENT ON COLUMN attribute_meta.personal_data_category IS 'DSG Art. 5 lit. c. Default keine; edit per attribute.';
COMMENT ON COLUMN attribute_meta.source_structure IS 'Free-text label for source-system substructure (e.g. SAP BAPI substructure name).';

CREATE INDEX attribute_meta_technical_name_idx ON attribute_meta (technical_name);
CREATE INDEX attribute_meta_key_role_idx ON attribute_meta (key_role) WHERE key_role IS NOT NULL;
CREATE INDEX attribute_meta_pdc_idx      ON attribute_meta (personal_data_category)
  WHERE personal_data_category <> 'keine';


-- =============================================================================
-- 7. standard_reference_meta — kind-locked side table for kind = standard_reference
-- =============================================================================

CREATE TABLE standard_reference_meta (
  node_id      uuid    PRIMARY KEY,
  kind         text    NOT NULL DEFAULT 'standard_reference',
  organisation text,
  code         text,
  version      text,
  url          text,

  CONSTRAINT standard_reference_meta_kind_chk CHECK (kind = 'standard_reference'),
  CONSTRAINT standard_reference_meta_uk       UNIQUE (organisation, code, version),
  FOREIGN KEY (node_id, kind) REFERENCES node (id, kind) ON DELETE CASCADE
);

COMMENT ON TABLE  standard_reference_meta IS 'External normative anchors (eCH-0010, ISO 19115, SR 510.625, …). Standards reference one another via edge_type = derives_from.';
COMMENT ON COLUMN standard_reference_meta.organisation IS 'Issuing organisation: eCH, ISO, Bund, EU, BFE, BFS, …';


-- =============================================================================
-- 8. code_list_entry — rows of a controlled vocabulary
--    Side table of a node row of kind = code_list. Entries are NOT nodes.
-- =============================================================================

CREATE TABLE code_list_entry (
  code_list_node_id  uuid     NOT NULL,
  kind               text     NOT NULL DEFAULT 'code_list',
  code               text     NOT NULL,
  label_de           text,
  label_fr           text,
  label_it           text,
  label_en           text,
  description_de     text,
  description_fr     text,
  description_it     text,
  description_en     text,
  sort_order         integer,
  is_deprecated      boolean  NOT NULL DEFAULT false,

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
-- 9. processing_activity — DSG Art. 12 Verzeichnis
--    1:0..1 with a node row of kind = pset.
-- =============================================================================

CREATE TABLE processing_activity (
  id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  pset_node_id           uuid         NOT NULL,
  kind                   text         NOT NULL DEFAULT 'pset',
  purpose                text,
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
-- 10. contact — single table for users, externals, teams
-- =============================================================================

CREATE TABLE contact (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Supabase-only: depends on the auth.users table from Supabase Auth.
  -- For vanilla Postgres testing, replace REFERENCES auth.users (id)
  -- with a plain `uuid` column (no FK).
  auth_user_id  uuid         REFERENCES auth.users (id) ON DELETE SET NULL,
  email         text         NOT NULL,
  name          text,
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
-- 11. role_assignment — NaDB role attribution: contact + role + scope
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
-- Deferred FK: canvas.owner_contact_id → contact(id)
-- canvas is created before contact for ordering reasons (node FKs into canvas).
-- =============================================================================

ALTER TABLE canvas
  ADD CONSTRAINT canvas_owner_contact_fk
  FOREIGN KEY (owner_contact_id) REFERENCES contact (id) ON DELETE SET NULL;

CREATE INDEX canvas_owner_contact_idx
  ON canvas (owner_contact_id) WHERE owner_contact_id IS NOT NULL;


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

ALTER TABLE canvas                  ENABLE ROW LEVEL SECURITY;
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

-- canvas: any authenticated user reads everything; editors/admins write.
-- The visibility-aware anon-read policy lives in migrations/, not here.
CREATE POLICY canvas_read  ON canvas FOR SELECT TO authenticated USING (true);
CREATE POLICY canvas_write ON canvas FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());

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
             canvas, node, edge, system_meta, distribution_meta, attribute_meta,
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
--
-- A canvas must exist before any node can be inserted (node.canvas_id is
-- NOT NULL). Create at least one default canvas:
--
-- INSERT INTO canvas (slug, label_de) VALUES ('default', 'BBL Datenarchitektur');


-- =============================================================================
-- Optional seed: BBL systems (uncomment to populate)
-- Source-of-truth list per docs/DATAMODEL.md §6.3.
-- Assumes the 'default' canvas was created in the bootstrap section above.
-- =============================================================================

-- INSERT INTO node (canvas_id, slug, kind, label_de, lifecycle_status)
-- SELECT c.id, v.slug, 'system', v.label_de, 'produktiv'
--   FROM canvas c
--   CROSS JOIN (VALUES
--     ('sys:refx',      'SAP RE-FX'),
--     ('sys:bbl_gis',   'BBL GIS'),
--     ('sys:gwr',       'BFS GWR'),
--     ('sys:av_gis',    'AV GIS'),
--     ('sys:grundbuch', 'Grundbuch')
--   ) AS v(slug, label_de)
--  WHERE c.slug = 'default';
--
-- INSERT INTO system_meta (node_id, technology_stack, base_url, security_zone, is_active)
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
