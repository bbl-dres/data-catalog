-- =============================================================================
-- BBL Architektur-Canvas — visibility-aware anon-read after multi-canvas
-- Target schema: docs/DATAMODEL.sql v0.4 (§6.12 canvas + §6.11 enums)
--
-- Apply via Supabase SQL Editor (runs as superuser, bypasses RLS). Runs after
-- 004_canvas_table.sql, which created `canvas` with `visibility ∈ {public,
-- restricted}`. This migration:
--
--   1. Adds an anon-read policy on `canvas` that exposes only public canvases.
--   2. Replaces the existing unconditional `node_read_anon` policy with a
--      visibility-gated version that joins through `canvas`.
--
-- Side-table anon-read policies (`distribution_meta_read_anon`,
-- `attribute_meta_read_anon`, …) intentionally stay `USING (true)`. The data
-- they expose is unrenderable without the parent node, which is now gated; for
-- a small-team prototype that's an acceptable defence-in-depth gap. If strict
-- per-side-table visibility is needed later, swap in EXISTS-via-node policies.
-- =============================================================================

BEGIN;

-- ---------- 1. canvas: anon reads public canvases ----------

CREATE POLICY canvas_read_anon ON canvas FOR SELECT TO anon
  USING (visibility = 'public');


-- ---------- 2. node: anon reads only nodes whose canvas is public ----------
-- IF EXISTS so re-running on a DB that hasn't applied 002 (or where the
-- policy was already replaced) doesn't crash the whole transaction.

DROP POLICY IF EXISTS node_read_anon ON node;

CREATE POLICY node_read_anon ON node FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM canvas c
       WHERE c.id = node.canvas_id
         AND c.visibility = 'public'
    )
  );

COMMIT;

-- End of migration
