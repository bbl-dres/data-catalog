-- =============================================================================
-- BBL Architektur-Canvas — canvas_export() CRLF fix
--
-- The Windows-generated seed wrote pset descriptions with \r\n\r\n between the
-- description text and the "Lineage: ..." block. The original splitter only
-- matched \n\n, so on real data lineage stayed embedded in description and the
-- lineage field came back NULL. Normalize CRLF → LF before splitting.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION canvas_export()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
    systems AS (
      SELECT n.id, n.label_de
      FROM node n
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
      FROM node n
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
      FROM node n
      LEFT JOIN edge e ON e.to_node_id = n.id AND e.edge_type = 'publishes'
      LEFT JOIN systems s ON s.id = e.from_node_id
      WHERE n.kind = 'code_list'
    ),

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
      FROM node a
      JOIN attribute_meta am ON am.node_id = a.id
      JOIN edge ec ON ec.to_node_id = a.id AND ec.edge_type = 'contains'
      LEFT JOIN edge ep ON ep.from_node_id = a.id AND ep.edge_type = 'in_pset'
      LEFT JOIN node p  ON p.id = ep.to_node_id AND p.kind = 'pset'
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
        code_list_node_id                           AS node_id,
        jsonb_agg(
          jsonb_build_object('name', code, 'type', label_de)
          ORDER BY sort_order NULLS LAST, code
        ) AS columns
      FROM code_list_entry
      GROUP BY code_list_node_id
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

    edges_payload AS (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',    e.id::text,
        'from',  regexp_replace(fn.slug, '^(dist|cl):', ''),
        'to',    regexp_replace(tn.slug, '^(dist|cl):', ''),
        'label', e.label_de
      ))) AS arr
      FROM edge e
      JOIN node fn ON fn.id = e.from_node_id
      JOIN node tn ON tn.id = e.to_node_id
      WHERE e.edge_type = 'flows_into'
        AND fn.kind IN ('distribution', 'code_list')
        AND tn.kind IN ('distribution', 'code_list')
    ),

    -- Normalize CRLF → LF first; the seed written on Windows has \r\n\r\n
    -- separators in description_de. After this, the existing \n\n splitter
    -- works for both line-ending conventions.
    psets_norm AS (
      SELECT
        n.slug,
        n.label_de,
        regexp_replace(n.description_de, E'\r\n', E'\n', 'g') AS desc_norm
      FROM node n
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
    'version', 2,
    'nodes',   COALESCE((SELECT arr FROM nodes_payload), '[]'::jsonb),
    'edges',   COALESCE((SELECT arr FROM edges_payload), '[]'::jsonb),
    'sets',    COALESCE((SELECT arr FROM sets_payload),  '[]'::jsonb)
  );
$$;

COMMIT;
