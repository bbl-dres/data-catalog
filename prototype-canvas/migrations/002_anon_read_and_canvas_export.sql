-- =============================================================================
-- BBL Architektur-Canvas — anon-read policies + canvas_export() RPC
-- Target schema: docs/DATAMODEL.sql v0.3
--
-- Apply via Supabase SQL Editor (runs as superuser, bypasses RLS).
-- Wraps everything in a transaction so partial loads roll back.
--
-- Why: the catalog payload is treated as public information. Opening SELECT to
-- the anon role lets the prototype frontend read it with the publishable key.
-- contact and role_assignment stay restricted to authenticated.
--
-- canvas_export() returns the same { version, nodes, edges, sets } shape that
-- data/canvas.json carries, so the frontend can treat Supabase and the static
-- JSON as interchangeable seed sources.
-- =============================================================================

BEGIN;

-- ---------- 1. Anon-read policies for catalog tables ----------
CREATE POLICY node_read_anon                    ON node                    FOR SELECT TO anon USING (true);
CREATE POLICY edge_read_anon                    ON edge                    FOR SELECT TO anon USING (true);
CREATE POLICY system_meta_read_anon             ON system_meta             FOR SELECT TO anon USING (true);
CREATE POLICY distribution_meta_read_anon       ON distribution_meta       FOR SELECT TO anon USING (true);
CREATE POLICY attribute_meta_read_anon          ON attribute_meta          FOR SELECT TO anon USING (true);
CREATE POLICY standard_reference_meta_read_anon ON standard_reference_meta FOR SELECT TO anon USING (true);
CREATE POLICY code_list_entry_read_anon         ON code_list_entry         FOR SELECT TO anon USING (true);
CREATE POLICY processing_activity_read_anon     ON processing_activity     FOR SELECT TO anon USING (true);

-- ---------- 2. canvas_export() — single-call RPC for the frontend seed ----------
CREATE OR REPLACE FUNCTION canvas_export()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
    -- system node id → human-readable label, used to name the publisher of
    -- each distribution / codelist (frontend node.system).
    systems AS (
      SELECT n.id, n.label_de
      FROM node n
      WHERE n.kind = 'system'
    ),

    -- distribution rows in frontend shape (id stripped of the dist: prefix).
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

    -- codelist rows in frontend shape (id stripped of the cl: prefix).
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

    -- attribute rows joined to their parent distribution + (optional) pset.
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

    -- attribute columns rolled up per parent distribution, ordered by sort_order.
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

    -- code list entries → {name: code, type: label}, matching canvas.json codelist columns.
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

    -- combined nodes payload: distributions + codelists in frontend shape.
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

    -- diagram-level edges (canvas.edges[]). The seed wrote these as flows_into
    -- between distribution / code_list endpoints; everything else (publishes,
    -- contains, in_pset) is structural and reconstructed via the joins above.
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

    -- pset rows → frontend sets[]. The seed concatenated description and lineage
    -- with E'\n\nLineage: '; split them back here so the round-trip stays clean.
    sets_payload AS (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',          regexp_replace(n.slug, '^pset:', ''),
        'label',       n.label_de,
        'description',
          CASE
            WHEN n.description_de IS NULL THEN NULL
            WHEN position(E'\n\nLineage: ' IN n.description_de) > 0
              THEN substring(n.description_de FROM 1 FOR position(E'\n\nLineage: ' IN n.description_de) - 1)
            WHEN n.description_de LIKE 'Lineage: %' THEN NULL
            ELSE n.description_de
          END,
        'lineage',
          CASE
            WHEN n.description_de IS NULL THEN NULL
            WHEN position(E'\n\nLineage: ' IN n.description_de) > 0
              THEN substring(n.description_de FROM position(E'\n\nLineage: ' IN n.description_de) + length(E'\n\nLineage: '))
            WHEN n.description_de LIKE 'Lineage: %'
              THEN substring(n.description_de FROM length('Lineage: ') + 1)
            ELSE NULL
          END
      ))) AS arr
      FROM node n
      WHERE n.kind = 'pset'
    )

  SELECT jsonb_build_object(
    'version', 2,
    'nodes',   COALESCE((SELECT arr FROM nodes_payload), '[]'::jsonb),
    'edges',   COALESCE((SELECT arr FROM edges_payload), '[]'::jsonb),
    'sets',    COALESCE((SELECT arr FROM sets_payload),  '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION canvas_export() TO anon, authenticated;

COMMENT ON FUNCTION canvas_export() IS
  'Returns the canvas in canvas.json shape: { version, nodes, edges, sets }. '
  'One round trip from the frontend; no client-side joining required.';

COMMIT;

-- End of migration
