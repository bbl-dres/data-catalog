-- =============================================================================
-- BBL Architektur-Canvas — Phase 2 of info-panel parity work.
-- Target schema: docs/DATAMODEL.sql v0.4
--
-- Apply via Supabase SQL Editor. Runs after 008_export_descriptions.sql.
--
-- Adds (additive — frontend ignores unknown keys):
--
--   distributions:
--     technicalName, accessUrl, downloadUrl, format, mediaType, license,
--     accrualPeriodicity, availability, spatialCoverage, temporalStart,
--     temporalEnd, issued, modified
--     standards[]   — embedded list of standards realised by this node
--                     ({id, organisation, code, version, url, label})
--     roles[]       — embedded list of role assignments scoped to this node
--                     ({role, contactName, contactEmail, organisation,
--                       isTeam, validFrom, validTo})
--   codelists:
--     standards[], roles[]   — same as distributions (codelists also have
--                              meaningful realises + role_assignments)
--   sets[]:
--     processing    — DSG Art. 12 fields when processing_activity exists
--                     ({purpose, legalBasis, dataSubjects, recipients,
--                       retentionPolicy, crossBorderTransfer,
--                       transferCountries, dpiaRequired, dpiaUrl})
--
--   New top-level arrays in the payload:
--     systems[]     — system nodes with metadata, keyed off the same
--                     label used in node.system on distributions
--                     ({name, description, classification, lifecycle,
--                       technologyStack, baseUrl, securityZone, isActive})
--
-- The expanded non-data edge types (publishes / contains / in_pset etc.)
-- remain consumed by the SQL — they're not surfaced as edges yet, since
-- the frontend already encodes those relationships through node.system,
-- node.columns, and column.setId. Doing both would create redundant
-- visual edges in the graph view.
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

    -- Standards realised by other nodes via 'realises' edges. Aggregated
    -- per source node so distributions / codelists can carry a flat
    -- list of normative anchors directly in their payload — no client-
    -- side join needed.
    standards_per_node AS (
      SELECT
        e.from_node_id                                 AS node_id,
        jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id',           regexp_replace(s.slug, '^std:', ''),
          'label',        s.label_de,
          'organisation', srm.organisation,
          'code',         srm.code,
          'version',      srm.version,
          'url',          srm.url
        )) ORDER BY srm.organisation, srm.code) AS arr
      FROM edge e
      JOIN target_nodes s ON s.id = e.to_node_id AND s.kind = 'standard_reference'
      LEFT JOIN standard_reference_meta srm ON srm.node_id = s.id
      WHERE e.edge_type = 'realises'
      GROUP BY e.from_node_id
    ),

    -- Role assignments scoped to each node, joined through to contact
    -- so the panel doesn't need a contact-id lookup. Sorted by role
    -- code and contact name for stable rendering.
    roles_per_node AS (
      SELECT
        ra.scope_node_id                               AS node_id,
        jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'role',         ra.role,
          'contactName',  c.name,
          'contactEmail', c.email,
          'organisation', c.organisation,
          'isTeam',       c.is_team,
          'validFrom',    ra.valid_from,
          'validTo',      ra.valid_to
        )) ORDER BY ra.role, c.name) AS arr
      FROM role_assignment ra
      JOIN contact c ON c.id = ra.contact_id
      JOIN target_nodes n ON n.id = ra.scope_node_id
      GROUP BY ra.scope_node_id
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
        -- Phase 2 additions from distribution_meta. NULLIF empty-string
        -- so jsonb_strip_nulls drops them cleanly.
        NULLIF(dm.technical_name, '')               AS technical_name,
        NULLIF(dm.access_url, '')                   AS access_url,
        NULLIF(dm.download_url, '')                 AS download_url,
        NULLIF(dm.format, '')                       AS format,
        NULLIF(dm.media_type, '')                   AS media_type,
        NULLIF(dm.license, '')                      AS license,
        NULLIF(dm.accrual_periodicity, '')          AS accrual_periodicity,
        NULLIF(dm.availability, '')                 AS availability,
        NULLIF(dm.spatial_coverage, '')             AS spatial_coverage,
        dm.temporal_start                           AS temporal_start,
        dm.temporal_end                             AS temporal_end,
        dm.issued                                   AS issued,
        dm.modified                                 AS dm_modified,
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
          'id',                  d.id,
          'type',                d.type,
          'label',               d.label,
          'description',         d.description,
          'classification',      d.classification,
          'lifecycle',           d.lifecycle,
          'theme',               d.theme,
          'system',              d.system,
          'schema',              d.schema,
          'technicalName',       d.technical_name,
          'accessUrl',           d.access_url,
          'downloadUrl',         d.download_url,
          'format',              d.format,
          'mediaType',           d.media_type,
          'license',             d.license,
          'accrualPeriodicity',  d.accrual_periodicity,
          'availability',        d.availability,
          'spatialCoverage',     d.spatial_coverage,
          'temporalStart',       d.temporal_start,
          'temporalEnd',         d.temporal_end,
          'issued',              d.issued,
          'modified',            d.dm_modified,
          'x',                   d.x,
          'y',                   d.y,
          'tags',                CASE WHEN d.tags = '{}' OR d.tags IS NULL THEN NULL ELSE to_jsonb(d.tags) END,
          'columns',             COALESCE(dc.columns, '[]'::jsonb),
          'standards',           spn.arr,
          'roles',               rpn.arr
        )) AS node_obj
        FROM distributions d
        LEFT JOIN dist_columns       dc  ON dc.dist_node_id = d.node_id
        LEFT JOIN standards_per_node spn ON spn.node_id     = d.node_id
        LEFT JOIN roles_per_node     rpn ON rpn.node_id     = d.node_id

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
          'columns',        COALESCE(clc.columns, '[]'::jsonb),
          'standards',      spn.arr,
          'roles',          rpn.arr
        )) AS node_obj
        FROM codelists c
        LEFT JOIN cl_columns         clc ON clc.node_id = c.node_id
        LEFT JOIN standards_per_node spn ON spn.node_id = c.node_id
        LEFT JOIN roles_per_node     rpn ON rpn.node_id = c.node_id
      ) all_nodes
    ),

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

    psets_norm AS (
      SELECT
        n.id                                        AS node_id,
        n.slug,
        n.label_de,
        regexp_replace(n.description_de, E'\r\n', E'\n', 'g') AS desc_norm
      FROM target_nodes n
      WHERE n.kind = 'pset'
    ),

    sets_payload AS (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',          regexp_replace(p.slug, '^pset:', ''),
        'label',       p.label_de,
        'description',
          CASE
            WHEN p.desc_norm IS NULL THEN NULL
            WHEN position(E'\n\nLineage: ' IN p.desc_norm) > 0
              THEN substring(p.desc_norm FROM 1 FOR position(E'\n\nLineage: ' IN p.desc_norm) - 1)
            WHEN p.desc_norm LIKE 'Lineage: %' THEN NULL
            ELSE p.desc_norm
          END,
        'lineage',
          CASE
            WHEN p.desc_norm IS NULL THEN NULL
            WHEN position(E'\n\nLineage: ' IN p.desc_norm) > 0
              THEN substring(p.desc_norm FROM position(E'\n\nLineage: ' IN p.desc_norm) + length(E'\n\nLineage: '))
            WHEN p.desc_norm LIKE 'Lineage: %'
              THEN substring(p.desc_norm FROM length('Lineage: ') + 1)
            ELSE NULL
          END,
        -- DSG Art. 12 Verzeichnis fields, packed into a single
        -- 'processing' object so the panel can render a self-contained
        -- "Datenschutz" section without flat-namespacing the keys.
        'processing',
          CASE WHEN pa.id IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
            'purpose',             NULLIF(pa.purpose, ''),
            'legalBasis',          NULLIF(pa.legal_basis, ''),
            'dataSubjects',        NULLIF(pa.data_subjects, ''),
            'recipients',          NULLIF(pa.recipients, ''),
            'retentionPolicy',     NULLIF(pa.retention_policy, ''),
            'crossBorderTransfer', pa.cross_border_transfer,
            'transferCountries',
              CASE WHEN pa.transfer_countries IS NULL OR pa.transfer_countries = '{}'
                   THEN NULL ELSE to_jsonb(pa.transfer_countries) END,
            'dpiaRequired',        pa.dpia_required,
            'dpiaUrl',             NULLIF(pa.dpia_url, '')
          )) END
      ))) AS arr
      FROM psets_norm p
      LEFT JOIN processing_activity pa ON pa.pset_node_id = p.node_id
    ),

    -- Systems are not nodes from the client's perspective (they're string
    -- labels on distributions). To still surface system_meta, we expose a
    -- separate top-level systems[] array keyed off the system label —
    -- the same value distributions carry in their `system` field. Panel
    -- looks up by label when rendering a system selection.
    systems_payload AS (
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',              regexp_replace(n.slug, '^sys:', ''),
        'name',            n.label_de,
        'description',     NULLIF(n.description_de, ''),
        'classification',  n.classification,
        'lifecycle',       n.lifecycle_status,
        'theme',           n.theme_slug,
        'tags',            CASE WHEN n.tags = '{}' OR n.tags IS NULL THEN NULL ELSE to_jsonb(n.tags) END,
        'technologyStack', NULLIF(sm.technology_stack, ''),
        'baseUrl',         NULLIF(sm.base_url, ''),
        'securityZone',    NULLIF(sm.security_zone, ''),
        'isActive',        sm.is_active,
        'standards',       spn.arr,
        'roles',           rpn.arr
      ))) AS arr
      FROM target_nodes n
      LEFT JOIN system_meta        sm  ON sm.node_id  = n.id
      LEFT JOIN standards_per_node spn ON spn.node_id = n.id
      LEFT JOIN roles_per_node     rpn ON rpn.node_id = n.id
      WHERE n.kind = 'system'
    )

  SELECT jsonb_build_object(
    'version',  3,
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
    'nodes',    COALESCE((SELECT arr FROM nodes_payload),   '[]'::jsonb),
    'edges',    COALESCE((SELECT arr FROM edges_payload),   '[]'::jsonb),
    'sets',     COALESCE((SELECT arr FROM sets_payload),    '[]'::jsonb),
    'systems',  COALESCE((SELECT arr FROM systems_payload), '[]'::jsonb)
  )
  FROM target_canvas tc;
$$;

GRANT EXECUTE ON FUNCTION canvas_export(text) TO anon, authenticated;

COMMENT ON FUNCTION canvas_export(text) IS
  'Returns the named canvas as { version, canvas, homeView, nodes, edges, sets, systems }. '
  'v3 (additive over v2): nodes carry description/classification/lifecycle/theme + '
  'distribution_meta extras + standards[] + roles[]; columns carry '
  'description/pii/nullable; edges carry edgeType/cardinality/note; sets carry '
  'processing (DSG Art. 12); new top-level systems[] keyed by label. '
  'Defaults to canvas_slug=default for backwards compatibility.';

COMMIT;

-- End of migration
