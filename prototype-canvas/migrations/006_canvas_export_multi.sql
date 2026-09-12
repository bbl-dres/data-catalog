-- =============================================================================
-- BBL Architektur-Canvas — multi-canvas canvas_export() RPC
-- Target schema: docs/DATAMODEL.sql v0.4
--
-- Apply via Supabase SQL Editor. Runs after 004_canvas_table.sql.
--
-- Replaces the parameterless v0.3 canvas_export() with a version that takes an
-- optional `canvas_slug text` parameter (defaults to 'default' so existing
-- frontend calls of `client.rpc('canvas_export')` continue to return the
-- single-canvas content seeded into the default row).
--
-- Output shape additions over the v0.3 RPC:
--   * `canvas`: { id, slug, label, description, visibility }  — identifies which
--               canvas the payload represents
--   * `homeView`: { scale, centerX, centerY }  — curator-set landing viewport,
--               or null when no home view is set
-- The frontend's State.load() already reads `data.homeView`; the new `canvas`
-- field is additive (frontend ignores unknown keys).
--
-- All CTEs filter through a single `target_nodes` CTE so cross-canvas leaks
-- through edges or pset-attribution joins are impossible by construction.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS canvas_export();

CREATE OR REPLACE FUNCTION canvas_export(canvas_slug text DEFAULT 'default')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
    target_canvas AS (
      SELECT id, slug, label_de, description_de, visibility,
             home_scale, home_center_x, home_center_y
        FROM canvas
       WHERE slug = canvas_slug
    ),

    -- Pre-filter every node lookup through this CTE so the entire payload is
    -- canvas-scoped by construction.
    target_nodes AS (
      SELECT n.*
        FROM node n
       WHERE n.canvas_id = (SELECT id FROM target_canvas)
    ),

    systems AS (
      SELECT n.id, n.label_de
        FROM target_nodes n
       WHERE n.kind = 'system'
    ),

    distributions AS (
      SELECT
        n.id                                        AS node_id,
        regexp_replace(n.slug, '^dist:', '')        AS id,
        dm.type                                     AS type,
        n.label_de                                  AS label,
        s.label_de                                  AS system,
        dm.schema_name                              AS schema,
        n.x, n.y,
        n.tags
      FROM target_nodes n
      JOIN distribution_meta dm ON dm.node_id = n.id
      LEFT JOIN edge e ON e.to_node_id = n.id AND e.edge_type = 'publishes'
      LEFT JOIN systems s ON s.id = e.from_node_id
      WHERE n.kind = 'distribution'
    ),

    codelists AS (
      SELECT
        n.id                                        AS node_id,
        regexp_replace(n.slug, '^cl:', '')          AS id,
        n.label_de                                  AS label,
        s.label_de                                  AS system,
        n.x, n.y,
        n.tags
      FROM target_nodes n
      LEFT JOIN edge e ON e.to_node_id = n.id AND e.edge_type = 'publishes'
      LEFT JOIN systems s ON s.id = e.from_node_id
      WHERE n.kind = 'code_list'
    ),

    -- Attributes are joined through target_nodes, but the LEFT JOIN to the
    -- parent pset goes through target_nodes too — a stray attribute → pset
    -- edge to a different canvas would be silently dropped (not joined).
    attributes AS (
      SELECT
        a.id                                        AS attr_id,
        ec.from_node_id                             AS dist_node_id,
        am.technical_name,
        a.label_de,
        am.data_type,
        am.key_role,
        am.source_structure,
        am.sort_order,
        regexp_replace(p.slug, '^pset:', '')        AS set_id
      FROM target_nodes a
      JOIN attribute_meta am ON am.node_id = a.id
      JOIN edge ec ON ec.to_node_id = a.id AND ec.edge_type = 'contains'
      LEFT JOIN edge ep ON ep.from_node_id = a.id AND ep.edge_type = 'in_pset'
      LEFT JOIN target_nodes p ON p.id = ep.to_node_id AND p.kind = 'pset'
      WHERE a.kind = 'attribute'
    ),

    dist_columns AS (
      SELECT
        dist_node_id,
        jsonb_agg(
          jsonb_strip_nulls(jsonb_build_object(
            'name',            COALESCE(technical_name, label_de),
            'type',            data_type,
            'key',             key_role,
            'sourceStructure', source_structure,
            'setId',           set_id
          ))
          ORDER BY sort_order NULLS LAST
        ) AS columns
      FROM attributes
      GROUP BY dist_node_id
    ),

    cl_columns AS (
      SELECT
        cle.code_list_node_id                       AS node_id,
        jsonb_agg(
          jsonb_build_object('name', cle.code, 'type', cle.label_de)
          ORDER BY cle.sort_order NULLS LAST, cle.code
        ) AS columns
      FROM code_list_entry cle
      JOIN target_nodes n ON n.id = cle.code_list_node_id
      GROUP BY cle.code_list_node_id
    ),

    nodes_payload AS (
      SELECT jsonb_agg(node_obj) AS arr
      FROM (
        SELECT jsonb_strip_nulls(jsonb_build_object(
          'id',      d.id,
          'type',    d.type,
          'label',   d.label,
          'system',  d.system,
          'schema',  d.schema,
          'x',       d.x,
          'y',       d.y,
          'tags',    CASE WHEN d.tags = '{}' OR d.tags IS NULL THEN NULL ELSE to_jsonb(d.tags) END,
          'columns', COALESCE(dc.columns, '[]'::jsonb)
        )) AS node_obj
        FROM distributions d
        LEFT JOIN dist_columns dc ON dc.dist_node_id = d.node_id

        UNION ALL

        SELECT jsonb_strip_nulls(jsonb_build_object(
          'id',      c.id,
          'type',    'codelist',
          'label',   c.label,
          'system',  c.system,
          'x',       c.x,
          'y',       c.y,
          'tags',    CASE WHEN c.tags = '{}' OR c.tags IS NULL THEN NULL ELSE to_jsonb(c.tags) END,
          'columns', COALESCE(clc.columns, '[]'::jsonb)
        )) AS node_obj
        FROM codelists c
        LEFT JOIN cl_columns clc ON clc.node_id = c.node_id
      ) all_nodes
    ),

    -- Diagram-level edges (canvas.edges[]). Both endpoints must be in the
    -- target canvas — joining via target_nodes (not node) enforces this.
    edges_payload AS (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',    e.id::text,
        'from',  regexp_replace(fn.slug, '^(dist|cl):', ''),
        'to',    regexp_replace(tn.slug, '^(dist|cl):', ''),
        'label', e.label_de
      ))) AS arr
      FROM edge e
      JOIN target_nodes fn ON fn.id = e.from_node_id
      JOIN target_nodes tn ON tn.id = e.to_node_id
      WHERE e.edge_type = 'flows_into'
        AND fn.kind IN ('distribution', 'code_list')
        AND tn.kind IN ('distribution', 'code_list')
    ),

    -- Normalize CRLF → LF first; the original Windows seed used \r\n\r\n
    -- separators in description_de. Same fix as 003_canvas_export_crlf_fix.sql.
    psets_norm AS (
      SELECT
        n.slug,
        n.label_de,
        regexp_replace(n.description_de, E'\r\n', E'\n', 'g') AS desc_norm
      FROM target_nodes n
      WHERE n.kind = 'pset'
    ),

    sets_payload AS (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',          regexp_replace(slug, '^pset:', ''),
        'label',       label_de,
        'description',
          CASE
            WHEN desc_norm IS NULL THEN NULL
            WHEN position(E'\n\nLineage: ' IN desc_norm) > 0
              THEN substring(desc_norm FROM 1 FOR position(E'\n\nLineage: ' IN desc_norm) - 1)
            WHEN desc_norm LIKE 'Lineage: %' THEN NULL
            ELSE desc_norm
          END,
        'lineage',
          CASE
            WHEN desc_norm IS NULL THEN NULL
            WHEN position(E'\n\nLineage: ' IN desc_norm) > 0
              THEN substring(desc_norm FROM position(E'\n\nLineage: ' IN desc_norm) + length(E'\n\nLineage: '))
            WHEN desc_norm LIKE 'Lineage: %'
              THEN substring(desc_norm FROM length('Lineage: ') + 1)
            ELSE NULL
          END
      ))) AS arr
      FROM psets_norm
    )

  SELECT jsonb_build_object(
    'version',  2,
    'canvas',   jsonb_strip_nulls(jsonb_build_object(
                  'id',          tc.id,
                  'slug',        tc.slug,
                  'label',       tc.label_de,
                  'description', tc.description_de,
                  'visibility',  tc.visibility
                )),
    'homeView', CASE
                  WHEN tc.home_scale IS NOT NULL THEN
                    jsonb_build_object(
                      'scale',   tc.home_scale,
                      'centerX', tc.home_center_x,
                      'centerY', tc.home_center_y
                    )
                  ELSE NULL
                END,
    'nodes',    COALESCE((SELECT arr FROM nodes_payload), '[]'::jsonb),
    'edges',    COALESCE((SELECT arr FROM edges_payload), '[]'::jsonb),
    'sets',     COALESCE((SELECT arr FROM sets_payload),  '[]'::jsonb)
  )
  FROM target_canvas tc;
$$;

GRANT EXECUTE ON FUNCTION canvas_export(text) TO anon, authenticated;

COMMENT ON FUNCTION canvas_export(text) IS
  'Returns the named canvas as { version, canvas, homeView, nodes, edges, sets }. '
  'Defaults to canvas_slug=default for backwards compatibility with the v0.3 '
  'parameterless RPC.';

COMMIT;

-- End of migration
