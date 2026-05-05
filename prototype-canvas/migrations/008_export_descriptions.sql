-- =============================================================================
-- BBL Architektur-Canvas — surface descriptions + governance fields in the
-- canvas_export() RPC.
-- Target schema: docs/DATAMODEL.sql v0.4
--
-- Apply via Supabase SQL Editor. Runs after 006_canvas_export_multi.sql
-- and 007_canvas_apply.sql.
--
-- Phase 1 of the info-panel parity work. The previous canvas_export()
-- silently dropped a long list of fields between the DB and the client:
-- descriptions on every kind, classification + lifecycle status on every
-- node, edge type + cardinality on every relationship, and the
-- personal_data_category flag on attributes (a DSG concern). The panel
-- could never surface them because they didn't survive the boundary.
--
-- This migration adds (additive — no field is removed; the JSON
-- payload is a strict superset of v2):
--
--   nodes[]:
--     description       — node.description_de (NULL when blank)
--     classification    — 'oeffentlich' | 'intern' | 'vertraulich' | 'geheim'
--     lifecycle         — 'entwurf' | 'standardisiert' | 'produktiv' | 'abgeloest'
--     theme             — node.theme_slug (free-text Datenkategorie)
--     columns[].pii     — attribute_meta.personal_data_category
--     columns[].nullable — attribute_meta.is_nullable
--
--   edges[]:
--     edgeType          — 'flows_into' (others still filtered out at this
--                         stage; expanded in a later phase)
--     cardinality       — edge.cardinality (free-text e.g. "1..*")
--     note              — edge.note (DE-only internal commentary)
--
--   sets[]:
--     description       — already present, behaviour unchanged
--
-- Frontend ignores unknown keys, so deploying this migration without a
-- frontend release is safe.
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS canvas_export(text);

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
        NULLIF(n.description_de, '')                AS description,
        n.classification                            AS classification,
        n.lifecycle_status                          AS lifecycle,
        n.theme_slug                                AS theme,
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
        NULLIF(n.description_de, '')                AS description,
        n.classification                            AS classification,
        n.lifecycle_status                          AS lifecycle,
        n.theme_slug                                AS theme,
        s.label_de                                  AS system,
        n.x, n.y,
        n.tags
      FROM target_nodes n
      LEFT JOIN edge e ON e.to_node_id = n.id AND e.edge_type = 'publishes'
      LEFT JOIN systems s ON s.id = e.from_node_id
      WHERE n.kind = 'code_list'
    ),

    -- Attributes — additionally surface personal_data_category (DSG flag)
    -- and is_nullable so the attribute panel can show them. The
    -- attribute's own description_de is exposed too; even though it's
    -- usually empty in practice, panels should show it when present.
    attributes AS (
      SELECT
        a.id                                        AS attr_id,
        ec.from_node_id                             AS dist_node_id,
        am.technical_name,
        a.label_de,
        NULLIF(a.description_de, '')                AS description,
        am.data_type,
        am.key_role,
        am.source_structure,
        am.sort_order,
        am.is_nullable,
        am.personal_data_category,
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
            'description',     description,
            'sourceStructure', source_structure,
            'setId',           set_id,
            'pii',             personal_data_category,
            'nullable',        is_nullable
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
          'id',             d.id,
          'type',           d.type,
          'label',          d.label,
          'description',    d.description,
          'classification', d.classification,
          'lifecycle',      d.lifecycle,
          'theme',          d.theme,
          'system',         d.system,
          'schema',         d.schema,
          'x',              d.x,
          'y',              d.y,
          'tags',           CASE WHEN d.tags = '{}' OR d.tags IS NULL THEN NULL ELSE to_jsonb(d.tags) END,
          'columns',        COALESCE(dc.columns, '[]'::jsonb)
        )) AS node_obj
        FROM distributions d
        LEFT JOIN dist_columns dc ON dc.dist_node_id = d.node_id

        UNION ALL

        SELECT jsonb_strip_nulls(jsonb_build_object(
          'id',             c.id,
          'type',           'codelist',
          'label',          c.label,
          'description',    c.description,
          'classification', c.classification,
          'lifecycle',      c.lifecycle,
          'theme',          c.theme,
          'system',         c.system,
          'x',              c.x,
          'y',              c.y,
          'tags',           CASE WHEN c.tags = '{}' OR c.tags IS NULL THEN NULL ELSE to_jsonb(c.tags) END,
          'columns',        COALESCE(clc.columns, '[]'::jsonb)
        )) AS node_obj
        FROM codelists c
        LEFT JOIN cl_columns clc ON clc.node_id = c.node_id
      ) all_nodes
    ),

    -- Edges — additionally surface edgeType and cardinality so the edge
    -- panel can show meaningful relationship metadata. `note` is DE-only
    -- internal commentary (not user-visible per its column comment) but
    -- we include it so edge panels can optionally display it for editors.
    edges_payload AS (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',          e.id::text,
        'from',        regexp_replace(fn.slug, '^(dist|cl):', ''),
        'to',          regexp_replace(tn.slug, '^(dist|cl):', ''),
        'label',       e.label_de,
        'edgeType',    e.edge_type,
        'cardinality', e.cardinality,
        'note',        NULLIF(e.note, '')
      ))) AS arr
      FROM edge e
      JOIN target_nodes fn ON fn.id = e.from_node_id
      JOIN target_nodes tn ON tn.id = e.to_node_id
      WHERE e.edge_type = 'flows_into'
        AND fn.kind IN ('distribution', 'code_list')
        AND tn.kind IN ('distribution', 'code_list')
    ),

    -- Pset descriptions: existing CRLF normalisation + lineage carve-out
    -- preserved verbatim from migration 006.
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
  'v3 (additive over v2): nodes carry description/classification/lifecycle/theme; '
  'columns carry description/pii/nullable; edges carry edgeType/cardinality/note. '
  'Defaults to canvas_slug=default for backwards compatibility with the v0.3 '
  'parameterless RPC.';

COMMIT;

-- End of migration
