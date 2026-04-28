/**
 * API view — Catalog Management API.
 *
 * Generates the documentation for the REST surface that *manages this
 * catalog* (CRUD over nodes, property sets, columns, edges; search;
 * export). It is NOT a generated façade in front of the systems being
 * catalogued — for those (e.g. the SAP RE-FX building API), the catalog
 * stores metadata only.
 *
 * Endpoint groups: Nodes · Property Sets · Columns · Edges · Search · Export
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Api = (function () {

    var State = null;
    var listEl = null;

    function init() {
        State = window.CanvasApp.State;
        listEl = document.getElementById('api-list');

        listEl.addEventListener('click', onClick);
        document.getElementById('copy-openapi').addEventListener('click', copyYaml);

        State.on(function (reason) {
            if (['nodes', 'edges', 'replace', 'reset'].indexOf(reason) !== -1) render();
        });
    }

    function render() {
        var items = buildEndpoints();
        if (!items.length) {
            listEl.innerHTML = '<div style="padding:24px;text-align:center;color:var(--color-text-secondary)">Keine Knoten — füge welche hinzu, um Beispiel-Antworten zu sehen.</div>';
            return;
        }
        listEl.innerHTML = items.map(itemHtml).join('');
    }

    // ---- Endpoint catalog ---------------------------------------------

    function buildEndpoints() {
        var nodes = State.getNodes();
        var edges = State.getEdges();

        // Pick concrete examples from current canvas state so samples are real
        var sampleNode = nodes[0] || null;
        var sampleNodeId = sampleNode ? sampleNode.id : 'example_node';
        var sampleSets = sampleNode ? State.derivePropertySets(sampleNode) : [];
        // Post sets-registry the shape is { id, label, kind }; pre-registry
        // it was { name }. Use id as the API-facing identifier.
        var sampleSetName = sampleSets[0] ? (sampleSets[0].id || sampleSets[0].name) : 'EXAMPLE_SET';
        var sampleCol = sampleNode && (sampleNode.columns || [])[0];
        var sampleColName = sampleCol ? sampleCol.name : 'example_column';
        var sampleEdge = edges[0] || null;
        var sampleEdgeId = sampleEdge ? sampleEdge.id : 'e_example';

        return [
            section('Nodes', 'Tabellen, Views, APIs und Dateien im Katalog. Ein Knoten beschreibt ein zu katalogisierendes Objekt — die eigentlichen Daten liegen in den Quellsystemen.'),
            {
                method: 'GET', path: '/nodes',
                summary: 'Alle Knoten auflisten',
                queryParams: [
                    { name: 'type',   desc: 'Filter: table, view, api, file' },
                    { name: 'system', desc: 'Filter nach Quellsystem' },
                    { name: 'tag',    desc: 'Filter nach Tag (mehrfach möglich)' },
                    { name: 'q',      desc: 'Volltextsuche in Label / ID' }
                ],
                response: { items: nodes.map(nodeSummary), total: nodes.length }
            },
            {
                method: 'POST', path: '/nodes',
                summary: 'Knoten anlegen',
                requestBody: {
                    label: 'neue_tabelle',
                    type: 'table',
                    system: 'SAP RE-FX',
                    schema: 'refx',
                    tags: ['master']
                },
                response: nodeMetadata(sampleNode || stubNode())
            },
            {
                method: 'GET', path: '/nodes/{nodeId}',
                summary: 'Vollständige Metadaten eines Knotens',
                pathParams: [{ name: 'nodeId', example: sampleNodeId }],
                response: nodeMetadata(sampleNode || stubNode())
            },
            {
                method: 'PUT', path: '/nodes/{nodeId}',
                summary: 'Knoten-Metadaten ersetzen',
                pathParams: [{ name: 'nodeId', example: sampleNodeId }],
                requestBody: nodeMetadata(sampleNode || stubNode()),
                response: nodeMetadata(sampleNode || stubNode())
            },
            {
                method: 'PATCH', path: '/nodes/{nodeId}',
                summary: 'Einzelne Felder aktualisieren',
                pathParams: [{ name: 'nodeId', example: sampleNodeId }],
                requestBody: { label: 'umbenannt', tags: ['master', 'kritisch'] },
                response: nodeMetadata(sampleNode || stubNode())
            },
            {
                method: 'DELETE', path: '/nodes/{nodeId}',
                summary: 'Knoten und alle anhängigen Beziehungen löschen',
                pathParams: [{ name: 'nodeId', example: sampleNodeId }],
                response: null
            },

            section('Property Sets', 'Logische Gruppierung von Attributen innerhalb eines Knotens (z.B. ARCH_REL, BUILDING in der RE-FX API). Sets sind aus dem Freitext-Feld `set` der Attribute abgeleitet — kein eigener Endpunkt zum Anlegen oder Löschen, das geschieht über Attribut-Updates.'),
            {
                method: 'GET', path: '/nodes/{nodeId}/property-sets',
                summary: 'Abgeleitete Property Sets eines Knotens',
                pathParams: [{ name: 'nodeId', example: sampleNodeId }],
                response: { items: sampleSets }
            },

            section('Columns / Attributes', 'Einzelne Attribute eines Knotens. Schlüsseltyp ist PK / FK / UK oder leer.'),
            {
                method: 'GET', path: '/nodes/{nodeId}/columns',
                summary: 'Attribute eines Knotens',
                pathParams: [{ name: 'nodeId', example: sampleNodeId }],
                queryParams: [
                    { name: 'set', desc: 'Filter nach Property-Set-Name' },
                    { name: 'key', desc: 'Filter: PK, FK, UK' }
                ],
                response: { items: ((sampleNode && sampleNode.columns) || []).slice(0, 5), total: (sampleNode && (sampleNode.columns || []).length) || 0 }
            },
            {
                method: 'POST', path: '/nodes/{nodeId}/columns',
                summary: 'Attribut hinzufügen',
                pathParams: [{ name: 'nodeId', example: sampleNodeId }],
                requestBody: { name: 'NEW_FIELD', type: 'CHAR(20)', key: '', set: '' },
                response: { name: 'NEW_FIELD', type: 'CHAR(20)', key: '', set: '' }
            },
            {
                method: 'PATCH', path: '/nodes/{nodeId}/columns/{columnName}',
                summary: 'Attribut aktualisieren — Typ, Schlüssel oder Set ändern',
                pathParams: [
                    { name: 'nodeId',     example: sampleNodeId },
                    { name: 'columnName', example: sampleColName }
                ],
                requestBody: { type: 'CHAR(8)', key: 'PK', set: sampleSetName },
                response: Object.assign({ name: sampleColName }, { type: 'CHAR(8)', key: 'PK', set: sampleSetName })
            },
            {
                method: 'DELETE', path: '/nodes/{nodeId}/columns/{columnName}',
                summary: 'Attribut entfernen',
                pathParams: [
                    { name: 'nodeId',     example: sampleNodeId },
                    { name: 'columnName', example: sampleColName }
                ],
                response: null
            },

            section('Edges / Relationships', 'Beziehungen zwischen Knoten. Eine Beziehung trägt einen optionalen Namen (z.B. "has", "owns", "tenant_of").'),
            {
                method: 'GET', path: '/edges',
                summary: 'Beziehungen auflisten',
                queryParams: [
                    { name: 'from', desc: 'Filter nach Quellknoten-ID' },
                    { name: 'to',   desc: 'Filter nach Zielknoten-ID' }
                ],
                response: { items: edges, total: edges.length }
            },
            {
                method: 'POST', path: '/edges',
                summary: 'Beziehung anlegen',
                requestBody: { from: nodes[0] && nodes[0].id || 'source_id', to: nodes[1] && nodes[1].id || 'target_id', label: 'has' },
                response: sampleEdge || { id: 'e_new', from: 'source_id', to: 'target_id', label: 'has' }
            },
            {
                method: 'GET', path: '/edges/{edgeId}',
                summary: 'Beziehung abrufen',
                pathParams: [{ name: 'edgeId', example: sampleEdgeId }],
                response: sampleEdge || { id: sampleEdgeId, from: '', to: '', label: '' }
            },
            {
                method: 'PATCH', path: '/edges/{edgeId}',
                summary: 'Beziehung aktualisieren',
                pathParams: [{ name: 'edgeId', example: sampleEdgeId }],
                requestBody: { label: 'umbenannt' },
                response: sampleEdge ? Object.assign({}, sampleEdge, { label: 'umbenannt' }) : { id: sampleEdgeId, label: 'umbenannt' }
            },
            {
                method: 'DELETE', path: '/edges/{edgeId}',
                summary: 'Beziehung löschen',
                pathParams: [{ name: 'edgeId', example: sampleEdgeId }],
                response: null
            },

            section('Search', 'Volltextsuche quer durch Knoten, Property Sets und Attribute.'),
            {
                method: 'GET', path: '/search',
                summary: 'Katalog durchsuchen',
                queryParams: [
                    { name: 'q',     desc: 'Suchbegriff', required: true },
                    { name: 'kind',  desc: 'Filter: node, set, column' },
                    { name: 'limit', desc: 'Maximale Treffer (Default 50)' }
                ],
                response: searchSample(nodes)
            },

            section('Export', 'Katalog-Inhalte als Excel oder OpenAPI ausgeben.'),
            {
                method: 'GET', path: '/export/xlsx',
                summary: 'Katalog als Excel-Workbook',
                description: 'Vier Sheets: Nodes, PropertySets, Columns, Edges. Identisch mit dem manuellen Excel-Export aus dem UI.',
                response: '<binary application/vnd.openxmlformats-officedocument.spreadsheetml.sheet>'
            },
            {
                method: 'GET', path: '/export/openapi',
                summary: 'Diese Spezifikation als OpenAPI 3.0 YAML',
                description: 'Self-describing endpoint — gibt das Schema dieser Catalog-API zurück.',
                response: '<text/yaml>'
            }
        ];
    }

    // ---- Sample shapes -------------------------------------------------

    function nodeSummary(n) {
        return {
            id: n.id,
            label: n.label,
            type: n.type,
            system: n.system || null,
            tags: n.tags || [],
            propertySetCount: State.derivePropertySets(n).length,
            columnCount: (n.columns || []).length
        };
    }

    function nodeMetadata(n) {
        return {
            id: n.id,
            label: n.label,
            type: n.type,
            system: n.system || '',
            schema: n.schema || '',
            tags: n.tags || [],
            x: Math.round(n.x || 0),
            y: Math.round(n.y || 0),
            columns: n.columns || []
        };
    }

    function stubNode() {
        return {
            id: 'example_node',
            label: 'example_node',
            type: 'table',
            system: '',
            schema: '',
            tags: [],
            x: 0, y: 0,
            columns: []
        };
    }

    function searchSample(nodes) {
        var hits = nodes.slice(0, 3).map(function (n) {
            return {
                kind: 'node',
                id: n.id,
                label: n.label,
                type: n.type,
                snippet: n.system || '',
                score: 1.0
            };
        });
        return { query: 'gebäude', total: hits.length, items: hits };
    }

    function section(title, description) {
        return { kind: 'section', title: title, description: description };
    }

    // ---- Rendering -----------------------------------------------------

    function itemHtml(item) {
        return item.kind === 'section' ? sectionHtml(item) : endpointHtml(item);
    }

    function sectionHtml(s) {
        return '' +
            '<div class="api-section-divider">' +
                '<div class="api-section-title">' + escapeHtml(s.title) + '</div>' +
                (s.description ? '<div class="api-section-desc">' + escapeHtml(s.description) + '</div>' : '') +
            '</div>';
    }

    function endpointHtml(ep) {
        var pathParamsHtml = renderParams(ep.pathParams, 'Pfadparameter');
        var queryParamsHtml = renderParams(ep.queryParams, 'Query-Parameter');
        var bodyHtml = ep.requestBody ? renderBlock('Request Body', ep.requestBody) : '';
        var descHtml = ep.description
            ? '<div class="api-section-label">Beschreibung</div><div class="api-desc">' + escapeHtml(ep.description) + '</div>'
            : '';
        var responseHtml = ep.response === null
            ? '<pre class="api-code">204 No Content</pre>'
            : (typeof ep.response === 'string'
                ? '<pre class="api-code">' + escapeHtml(ep.response) + '</pre>'
                : '<pre class="api-code">' + escapeHtml(JSON.stringify(ep.response, null, 2)) + '</pre>');

        return '' +
            '<div class="api-endpoint">' +
                '<div class="api-endpoint-header" data-action="toggle">' +
                    '<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>' +
                    '<span class="api-method ' + ep.method.toLowerCase() + '">' + ep.method + '</span>' +
                    '<span class="api-path">' + escapeHtml(ep.path) + '</span>' +
                    '<span class="api-summary">' + escapeHtml(ep.summary) + '</span>' +
                '</div>' +
                '<div class="api-endpoint-body">' +
                    descHtml +
                    pathParamsHtml +
                    queryParamsHtml +
                    bodyHtml +
                    '<div class="api-section-label">Antwort ' + (ep.response === null ? '(204)' : '(200)') + '</div>' +
                    responseHtml +
                '</div>' +
            '</div>';
    }

    function renderParams(params, label) {
        if (!params || !params.length) return '';
        var rows = params.map(function (p) {
            var req = p.required ? ' <span class="api-param-req">erforderlich</span>' : '';
            var ex = p.example ? ' <span class="api-param-ex">z.B. <code>' + escapeHtml(p.example) + '</code></span>' : '';
            return '<li><code>' + escapeHtml(p.name) + '</code>' + req + (p.desc ? ' — ' + escapeHtml(p.desc) : '') + ex + '</li>';
        }).join('');
        return '<div class="api-section-label">' + label + '</div><ul class="api-param-list">' + rows + '</ul>';
    }

    function renderBlock(label, value) {
        var json = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        return '<div class="api-section-label">' + label + '</div><pre class="api-code">' + escapeHtml(json) + '</pre>';
    }

    function onClick(e) {
        var hdr = e.target.closest('[data-action="toggle"]');
        if (!hdr) return;
        var ep = hdr.closest('.api-endpoint');
        if (ep) ep.classList.toggle('is-open');
    }

    // ---- OpenAPI YAML --------------------------------------------------

    function copyYaml() {
        var yaml = buildOpenApiYaml();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(yaml).then(
                function () { toast('OpenAPI YAML kopiert', 'success'); },
                function () { fallbackCopy(yaml); }
            );
        } else {
            fallbackCopy(yaml);
        }
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('OpenAPI YAML kopiert', 'success'); }
        catch (e) { toast('Kopieren fehlgeschlagen', 'error'); }
        document.body.removeChild(ta);
    }

    function buildOpenApiYaml() {
        var endpoints = buildEndpoints().filter(function (i) { return i.kind !== 'section'; });
        var lines = [
            'openapi: 3.0.0',
            'info:',
            '  title: BBL Catalog Management API',
            '  version: 0.1.0',
            '  description: |-',
            '    REST surface for managing catalog metadata (nodes, property sets,',
            '    columns, edges). This API does NOT proxy data from the catalogued',
            '    systems — only their metadata is stored here.',
            'servers:',
            '  - url: https://mock.bbl.local/v1',
            'paths:'
        ];
        var byPath = {};
        endpoints.forEach(function (ep) {
            (byPath[ep.path] = byPath[ep.path] || []).push(ep);
        });
        Object.keys(byPath).forEach(function (path) {
            lines.push('  ' + path + ':');
            byPath[path].forEach(function (ep) {
                lines.push('    ' + ep.method.toLowerCase() + ':');
                lines.push('      summary: ' + JSON.stringify(ep.summary));
                if (ep.pathParams && ep.pathParams.length || ep.queryParams && ep.queryParams.length) {
                    lines.push('      parameters:');
                    (ep.pathParams || []).forEach(function (p) {
                        lines.push('        - name: ' + p.name);
                        lines.push('          in: path');
                        lines.push('          required: true');
                        lines.push('          schema: { type: string }');
                    });
                    (ep.queryParams || []).forEach(function (p) {
                        lines.push('        - name: ' + p.name);
                        lines.push('          in: query');
                        if (p.required) lines.push('          required: true');
                        lines.push('          schema: { type: string }');
                    });
                }
                if (ep.requestBody) {
                    lines.push('      requestBody:');
                    lines.push('        required: true');
                    lines.push('        content:');
                    lines.push('          application/json:');
                    lines.push('            schema: { type: object }');
                }
                lines.push('      responses:');
                if (ep.response === null) {
                    lines.push('        \'204\':');
                    lines.push('          description: No Content');
                } else {
                    lines.push('        \'200\':');
                    lines.push('          description: OK');
                }
            });
        });
        return lines.join('\n') + '\n';
    }

    function toast(msg, kind) {
        if (window.CanvasApp.App && window.CanvasApp.App.toast) {
            window.CanvasApp.App.toast(msg, kind);
        }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    return { init: init, render: render };
})();
