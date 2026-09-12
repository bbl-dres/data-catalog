-- =============================================================================
-- BBL Architektur-Canvas — canvas_apply() RPC: server-side Speichern path
-- Target schema: docs/DATAMODEL.sql v0.4
--
-- Apply via Supabase SQL Editor. Runs after 004_canvas_table.sql.
--
-- Replaces the entire content of one canvas atomically. The frontend posts a
-- DB-shape payload (Option 2b in the design discussion) — separate arrays
-- per table — so this function can pure-INSERT instead of pulling apart a
-- denormalised round-trip of canvas_export().
--
-- Authorization:
--   * GRANT EXECUTE TO authenticated only — anon gets a 401-equivalent.
--   * Inside the function, current_user_can_edit() must return true (i.e.
--     contact.app_role IN ('editor','admin')) — otherwise a 42501 is raised.
-- SECURITY DEFINER lets the body DELETE / INSERT inside RLS-protected tables
-- once authorization has been checked above.
--
-- Atomicity:
--   The whole function runs in a single statement-level transaction (PL/pgSQL
--   functions are auto-transactional unless explicitly committed). Any
--   constraint violation rolls back the entire apply — partial saves are
--   structurally impossible.
--
-- Payload shape (DB-shape, see canvas-write-design notes in the codebase):
--   {
--     "canvas":            { home_scale, home_center_x, home_center_y, ... } | null,
--     "nodes":             [ { slug, kind, label_de, ..., x, y, tags, ... } ],
--     "system_meta":       [ { node_slug, technology_stack, base_url, security_zone, is_active } ],
--     "distribution_meta": [ { node_slug, type, technical_name, schema_name, ... } ],
--     "attribute_meta":    [ { node_slug, technical_name, data_type, key_role, sort_order, source_structure, ... } ],
--     "code_list_entry":   [ { code_list_node_slug, code, label_de, sort_order, ... } ],
--     "edges":             [ { from_slug, to_slug, edge_type, label_de, cardinality, ... } ]
--   }
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS canvas_apply(text, jsonb);

CREATE OR REPLACE FUNCTION canvas_apply(canvas_slug text, payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canvas_id     uuid;
  v_node_count    int := 0;
  v_edge_count    int := 0;
  v_smeta_count   int := 0;
  v_dmeta_count   int := 0;
  v_ameta_count   int := 0;
  v_cle_count     int := 0;
BEGIN
  -- --- Authorization ----------------------------------------------------
  IF NOT current_user_can_edit() THEN
    RAISE EXCEPTION 'forbidden: editor or admin role required'
      USING ERRCODE = '42501';
  END IF;

  -- --- Resolve canvas ---------------------------------------------------
  SELECT id INTO v_canvas_id FROM canvas WHERE slug = canvas_slug;
  IF v_canvas_id IS NULL THEN
    RAISE EXCEPTION 'canvas not found: %', canvas_slug
      USING ERRCODE = 'P0002';
  END IF;

  -- --- Optional canvas-level updates ------------------------------------
  -- Only the home view + visibility are user-editable; label/description
  -- are managed via canvas-list UI, not the per-canvas Speichern flow.
  IF payload ? 'canvas' AND jsonb_typeof(payload->'canvas') = 'object' THEN
    UPDATE canvas SET
      home_scale     = NULLIF(payload->'canvas'->>'home_scale',     '')::numeric,
      home_center_x  = NULLIF(payload->'canvas'->>'home_center_x',  '')::numeric,
      home_center_y  = NULLIF(payload->'canvas'->>'home_center_y',  '')::numeric
    WHERE id = v_canvas_id;
  END IF;

  -- --- Replace all node content ----------------------------------------
  -- Cascades clear distribution_meta, attribute_meta, system_meta,
  -- standard_reference_meta, code_list_entry, processing_activity, edges,
  -- and any role_assignments scoped to nodes in this canvas.
  DELETE FROM node WHERE canvas_id = v_canvas_id;

  -- --- Insert nodes -----------------------------------------------------
  INSERT INTO node (canvas_id, slug, kind,
                    label_de, label_fr, label_it, label_en,
                    description_de, description_fr, description_it, description_en,
                    tags, classification, theme_slug, lifecycle_status, x, y)
  SELECT
    v_canvas_id,
    n->>'slug',
    n->>'kind',
    n->>'label_de', n->>'label_fr', n->>'label_it', n->>'label_en',
    n->>'description_de', n->>'description_fr', n->>'description_it', n->>'description_en',
    COALESCE(
      CASE WHEN jsonb_typeof(n->'tags') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(n->'tags'))
           ELSE NULL END,
      '{}'::text[]
    ),
    n->>'classification',
    n->>'theme_slug',
    COALESCE(n->>'lifecycle_status', 'entwurf'),
    NULLIF(n->>'x', '')::numeric,
    NULLIF(n->>'y', '')::numeric
  FROM jsonb_array_elements(COALESCE(payload->'nodes', '[]'::jsonb)) AS n;

  GET DIAGNOSTICS v_node_count = ROW_COUNT;

  -- --- Insert system_meta ----------------------------------------------
  INSERT INTO system_meta (node_id, technology_stack, base_url, security_zone, is_active)
  SELECT
    nd.id,
    m->>'technology_stack',
    m->>'base_url',
    m->>'security_zone',
    COALESCE((m->>'is_active')::boolean, true)
  FROM jsonb_array_elements(COALESCE(payload->'system_meta', '[]'::jsonb)) AS m
  JOIN node nd ON nd.canvas_id = v_canvas_id
              AND nd.slug = m->>'node_slug'
              AND nd.kind = 'system';

  GET DIAGNOSTICS v_smeta_count = ROW_COUNT;

  -- --- Insert distribution_meta ----------------------------------------
  INSERT INTO distribution_meta (node_id, technical_name, type, schema_name,
                                 access_url, download_url, format, media_type, license,
                                 accrual_periodicity, availability, spatial_coverage,
                                 temporal_start, temporal_end, issued, modified)
  SELECT
    nd.id,
    m->>'technical_name',
    m->>'type',
    m->>'schema_name',
    m->>'access_url',
    m->>'download_url',
    m->>'format',
    m->>'media_type',
    m->>'license',
    m->>'accrual_periodicity',
    m->>'availability',
    m->>'spatial_coverage',
    NULLIF(m->>'temporal_start', '')::date,
    NULLIF(m->>'temporal_end',   '')::date,
    NULLIF(m->>'issued',         '')::timestamptz,
    NULLIF(m->>'modified',       '')::timestamptz
  FROM jsonb_array_elements(COALESCE(payload->'distribution_meta', '[]'::jsonb)) AS m
  JOIN node nd ON nd.canvas_id = v_canvas_id
              AND nd.slug = m->>'node_slug'
              AND nd.kind = 'distribution';

  GET DIAGNOSTICS v_dmeta_count = ROW_COUNT;

  -- --- Insert attribute_meta -------------------------------------------
  INSERT INTO attribute_meta (node_id, technical_name, data_type, key_role,
                              is_nullable, personal_data_category,
                              source_structure, sort_order)
  SELECT
    nd.id,
    m->>'technical_name',
    m->>'data_type',
    m->>'key_role',
    COALESCE((m->>'is_nullable')::boolean, true),
    COALESCE(m->>'personal_data_category', 'keine'),
    m->>'source_structure',
    NULLIF(m->>'sort_order', '')::integer
  FROM jsonb_array_elements(COALESCE(payload->'attribute_meta', '[]'::jsonb)) AS m
  JOIN node nd ON nd.canvas_id = v_canvas_id
              AND nd.slug = m->>'node_slug'
              AND nd.kind = 'attribute';

  GET DIAGNOSTICS v_ameta_count = ROW_COUNT;

  -- --- Insert code_list_entry ------------------------------------------
  INSERT INTO code_list_entry (code_list_node_id, code,
                               label_de, label_fr, label_it, label_en,
                               description_de, description_fr, description_it, description_en,
                               sort_order, is_deprecated)
  SELECT
    nd.id,
    m->>'code',
    m->>'label_de', m->>'label_fr', m->>'label_it', m->>'label_en',
    m->>'description_de', m->>'description_fr', m->>'description_it', m->>'description_en',
    NULLIF(m->>'sort_order', '')::integer,
    COALESCE((m->>'is_deprecated')::boolean, false)
  FROM jsonb_array_elements(COALESCE(payload->'code_list_entry', '[]'::jsonb)) AS m
  JOIN node nd ON nd.canvas_id = v_canvas_id
              AND nd.slug = m->>'code_list_node_slug'
              AND nd.kind = 'code_list';

  GET DIAGNOSTICS v_cle_count = ROW_COUNT;

  -- --- Insert edges -----------------------------------------------------
  -- Resolve from_slug / to_slug → node uuid via JOIN; an edge with a slug
  -- not present in the canvas is silently dropped (the JOIN doesn't match)
  -- which keeps the apply tolerant of frontend serialisation gaps.
  INSERT INTO edge (from_node_id, to_node_id, edge_type,
                    label_de, label_fr, label_it, label_en,
                    cardinality, note)
  SELECT
    fn.id, tn.id,
    e->>'edge_type',
    e->>'label_de', e->>'label_fr', e->>'label_it', e->>'label_en',
    e->>'cardinality',
    e->>'note'
  FROM jsonb_array_elements(COALESCE(payload->'edges', '[]'::jsonb)) AS e
  JOIN node fn ON fn.canvas_id = v_canvas_id AND fn.slug = e->>'from_slug'
  JOIN node tn ON tn.canvas_id = v_canvas_id AND tn.slug = e->>'to_slug';

  GET DIAGNOSTICS v_edge_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'status',        'ok',
    'canvas_slug',   canvas_slug,
    'nodes',         v_node_count,
    'edges',         v_edge_count,
    'system_meta',   v_smeta_count,
    'distribution_meta', v_dmeta_count,
    'attribute_meta',    v_ameta_count,
    'code_list_entry',   v_cle_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION canvas_apply(text, jsonb) TO authenticated;

COMMENT ON FUNCTION canvas_apply(text, jsonb) IS
  'Atomically replaces all content of canvas <canvas_slug> with the DB-shape '
  'payload. Authorisation: contact.app_role IN (editor, admin). Returns a '
  'jsonb summary of inserted row counts.';

COMMIT;

-- End of migration
