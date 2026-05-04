-- =============================================================================
-- BBL Architektur-Canvas — promote single-canvas world to multi-canvas (Path B)
-- Target schema: docs/DATAMODEL.sql v0.4 (§6.1 node + §6.12 canvas)
--
-- Apply via Supabase SQL Editor (runs as superuser, bypasses RLS). Wrapped in a
-- single transaction so a failure rolls back cleanly.
--
-- What this migration does, in order:
--   1. Creates the `canvas` table (table 1 in v0.4).
--   2. Seeds a `default` canvas row to host all existing v0.3 content.
--   3. Adds `node.canvas_id` NOT NULL FK → canvas(id) ON DELETE CASCADE,
--      backfilled from the default canvas.
--   4. Replaces global `node.slug` UNIQUE with per-canvas `(canvas_id, slug)`.
--   5. Adds the `(canvas_id, kind)` read-pattern index.
--   6. Enables RLS on canvas with the standard read-all-write-editor template.
--   7. Adds canvas to the supabase_realtime publication.
--
-- Anon-read on canvas (visibility-aware) and the multi-canvas canvas_export()
-- RPC are split into 005_anon_read_visibility.sql and 006_canvas_export_multi.sql
-- so each step is independently reviewable.
-- =============================================================================

BEGIN;

-- ---------- 1. canvas table ----------

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
  owner_contact_id  uuid           REFERENCES contact (id) ON DELETE SET NULL,
  created_at        timestamptz    NOT NULL DEFAULT now(),
  modified_at       timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT canvas_slug_uk          UNIQUE (slug),
  CONSTRAINT canvas_slug_format_chk  CHECK (slug ~ '^[a-z0-9][a-z0-9_.-]*$'),
  CONSTRAINT canvas_visibility_chk   CHECK (visibility IN ('public','restricted')),
  CONSTRAINT canvas_home_view_coherence_chk CHECK (
    (home_scale IS NULL AND home_center_x IS NULL AND home_center_y IS NULL)
    OR
    (home_scale IS NOT NULL AND home_center_x IS NOT NULL AND home_center_y IS NOT NULL)
  ),
  CONSTRAINT canvas_home_scale_positive_chk
    CHECK (home_scale IS NULL OR home_scale > 0)
);

COMMENT ON TABLE  canvas IS 'Named perspective wrapping a self-contained node set. Each canvas owns its own nodes (Path B); cross-canvas node reuse is deferred to §10 of DATAMODEL.md.';
COMMENT ON COLUMN canvas.slug          IS 'URL-friendly key for hash routing (e.g. #/c/bbl-immo/diagram). Globally unique.';
COMMENT ON COLUMN canvas.visibility    IS 'public = anon-readable; restricted = signed-in only. Editor permissions remain governed by contact.app_role independently of visibility.';
COMMENT ON COLUMN canvas.home_scale    IS 'Curator-set home-view zoom level. NULL = no curated view, frontend falls back to fit-all.';
COMMENT ON COLUMN canvas.home_center_x IS 'Home-view world-X centre. NULL together with the other home_* columns.';
COMMENT ON COLUMN canvas.home_center_y IS 'Home-view world-Y centre. NULL together with the other home_* columns.';

CREATE INDEX canvas_visibility_idx     ON canvas (visibility);
CREATE INDEX canvas_modified_at_idx    ON canvas (modified_at DESC);
CREATE INDEX canvas_owner_contact_idx  ON canvas (owner_contact_id) WHERE owner_contact_id IS NOT NULL;

CREATE TRIGGER canvas_touch_modified_at
  BEFORE UPDATE ON canvas
  FOR EACH ROW EXECUTE FUNCTION touch_modified_at();


-- ---------- 2. Seed the default canvas ----------
-- Hosts the existing v0.3 single-canvas content. Visibility='public' preserves
-- the prior anon-read behaviour for everything that was already public.

INSERT INTO canvas (slug, label_de, description_de, visibility)
VALUES (
  'default',
  'BBL Datenarchitektur',
  'Standard-Canvas mit allen bestehenden Daten aus dem v0.3 Single-Canvas-Modell.',
  'public'
);


-- ---------- 3. node.canvas_id — add, backfill, enforce NOT NULL + FK ----------

ALTER TABLE node ADD COLUMN canvas_id uuid;

UPDATE node
   SET canvas_id = (SELECT id FROM canvas WHERE slug = 'default');

ALTER TABLE node ALTER COLUMN canvas_id SET NOT NULL;

ALTER TABLE node
  ADD CONSTRAINT node_canvas_fk
  FOREIGN KEY (canvas_id) REFERENCES canvas (id) ON DELETE CASCADE;

COMMENT ON COLUMN node.canvas_id IS 'Owning canvas. NOT NULL; node and its meta/edges/role-assignments cascade on canvas deletion.';


-- ---------- 4. Slug uniqueness: global → per-canvas ----------

ALTER TABLE node DROP CONSTRAINT node_slug_uk;
ALTER TABLE node ADD CONSTRAINT node_canvas_slug_uk UNIQUE (canvas_id, slug);


-- ---------- 5. Read-pattern index ----------

CREATE INDEX node_canvas_kind_idx ON node (canvas_id, kind);


-- ---------- 6. RLS: read-all-authenticated, write-editor-or-admin ----------

ALTER TABLE canvas ENABLE ROW LEVEL SECURITY;

CREATE POLICY canvas_read  ON canvas FOR SELECT TO authenticated USING (true);
CREATE POLICY canvas_write ON canvas FOR ALL    TO authenticated
  USING      (current_user_can_edit())
  WITH CHECK (current_user_can_edit());


-- ---------- 7. Realtime publication ----------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE canvas';
  END IF;
END $$;

COMMIT;

-- End of migration
