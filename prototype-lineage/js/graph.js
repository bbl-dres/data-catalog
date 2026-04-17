/**
 * Graph — Layout computation via dagre and graph model state.
 */
window.LineageApp = window.LineageApp || {};

window.LineageApp.Graph = (function () {

    var NODE_WIDTHS = {
        table: 260,
        pipeline: 200,
        dashboard: 220
    };

    var HEADER_HEIGHT = 42;
    var SUBTITLE_HEIGHT = 22;
    var COLUMN_ROW_HEIGHT = 28;
    var COLUMN_PADDING = 8;
    var CHARTS_HEIGHT = 36;
    var DESCRIPTION_HEIGHT = 30;

    // --- Layout options & presets ---

    // "Lineage" preserves the original behavior (flat dagre + all group boxes,
    // including platform-based ones). Other presets use dagre compound mode so
    // cluster members stay together, and skip platform grouping.
    var PRESETS = {
        lineage:    { direction: 'LR', nodesep: 60, ranksep: 180, cluster: false, showGroups: true,  includePlatformGroups: true },
        auto:       { direction: 'LR', nodesep: 60, ranksep: 180, cluster: true,  showGroups: true,  includePlatformGroups: false, autoDirection: true },
        horizontal: { direction: 'LR', nodesep: 60, ranksep: 180, cluster: true,  showGroups: true,  includePlatformGroups: false },
        vertical:   { direction: 'TB', nodesep: 60, ranksep: 120, cluster: true,  showGroups: true,  includePlatformGroups: false },
        compact:    { direction: 'LR', nodesep: 30, ranksep: 100, cluster: true,  showGroups: true,  includePlatformGroups: false },
        flat:       { direction: 'LR', nodesep: 60, ranksep: 180, cluster: false, showGroups: false, includePlatformGroups: false }
    };

    var DEFAULT_PRESET = 'lineage';

    var layoutOptions = Object.assign({}, PRESETS[DEFAULT_PRESET]);

    function resolvePreset(presetName, nodeCount) {
        var base = PRESETS[presetName] || PRESETS[DEFAULT_PRESET];
        var opts = Object.assign({}, base);
        if (opts.autoDirection) {
            opts.direction = (nodeCount > 15) ? 'TB' : 'LR';
            if (opts.direction === 'TB') opts.ranksep = 120;
        }
        return opts;
    }

    function setLayoutOptions(opts) {
        if (opts.direction !== undefined) layoutOptions.direction = opts.direction;
        if (opts.nodesep !== undefined) layoutOptions.nodesep = opts.nodesep;
        if (opts.ranksep !== undefined) layoutOptions.ranksep = opts.ranksep;
        if (opts.cluster !== undefined) layoutOptions.cluster = opts.cluster;
        if (opts.showGroups !== undefined) layoutOptions.showGroups = opts.showGroups;
        if (opts.includePlatformGroups !== undefined) layoutOptions.includePlatformGroups = opts.includePlatformGroups;
    }

    function getLayoutOptions() {
        return Object.assign({}, layoutOptions);
    }

    /**
     * Derive the group key for a node. `system` wins; tables fall back to
     * `database[.schema]`; the `platform` fallback is opt-in because it causes
     * cross-graph overlap when multiple pipelines share a platform.
     */
    function getGroupKey(node, includePlatform) {
        if (node.system) return node.system;
        if (node.type === 'table' && node.database) {
            return node.database + (node.schema ? '.' + node.schema : '');
        }
        if (includePlatform && node.platform) return node.platform;
        return null;
    }

    function estimateCollapsedHeight(node) {
        var h = HEADER_HEIGHT;
        if (node.type === 'table') {
            h += SUBTITLE_HEIGHT;
        } else if (node.type === 'pipeline') {
            h += SUBTITLE_HEIGHT;
            if (node.description) h += DESCRIPTION_HEIGHT;
        } else if (node.type === 'dashboard') {
            h += SUBTITLE_HEIGHT;
            if (node.charts && node.charts.length > 0) h += CHARTS_HEIGHT;
        }
        return h;
    }

    function estimateExpandedHeight(node) {
        if (node.type !== 'table' || !node.columns) return estimateCollapsedHeight(node);
        var colCount = Math.min(node.columns.length, 10);
        return HEADER_HEIGHT + SUBTITLE_HEIGHT + colCount * COLUMN_ROW_HEIGHT + COLUMN_PADDING;
    }

    /**
     * Compute layout positions for all nodes using dagre.
     * @param {Array} nodes
     * @param {Array} edges
     * @param {Object} [options] overrides for direction / spacing / cluster
     * @returns {Object} positions keyed by node id: {x, y, width, height}
     */
    function computeLayout(nodes, edges, options) {
        var opts = options || layoutOptions;
        var direction = opts.direction || 'LR';
        var nodesep = opts.nodesep != null ? opts.nodesep : 60;
        var ranksep = opts.ranksep != null ? opts.ranksep : 180;
        var cluster = !!opts.cluster;

        var g = new dagre.graphlib.Graph({ compound: cluster });
        g.setGraph({
            rankdir: direction,
            nodesep: nodesep,
            ranksep: ranksep,
            marginx: 60,
            marginy: 60
        });
        g.setDefaultEdgeLabel(function () { return {}; });

        // In cluster mode, add a parent node per distinct group and attach
        // each member via setParent. Platform groups are intentionally excluded
        // from clustering — pipelines sharing a platform aren't co-located.
        var clusterKeys = {};
        if (cluster) {
            nodes.forEach(function (node) {
                var key = getGroupKey(node, false);
                if (key && !clusterKeys[key]) {
                    clusterKeys[key] = true;
                    g.setNode(key, { label: key });
                }
            });
        }

        nodes.forEach(function (node) {
            var w = NODE_WIDTHS[node.type] || 240;
            var expanded = !!state.expandedNodes[node.id];
            var h = expanded ? estimateExpandedHeight(node) : estimateCollapsedHeight(node);
            g.setNode(node.id, { width: w, height: h });
            if (cluster) {
                var key = getGroupKey(node, false);
                if (key) g.setParent(node.id, key);
            }
        });

        edges.forEach(function (edge) {
            g.setEdge(edge.source, edge.target);
        });

        dagre.layout(g);

        var positions = {};
        nodes.forEach(function (node) {
            var n = g.node(node.id);
            positions[node.id] = {
                x: n.x - n.width / 2,
                y: n.y - n.height / 2,
                width: n.width,
                height: n.height
            };
        });

        return positions;
    }

    // -- Graph Model (state) --

    var state = {
        nodes: [],
        edges: [],
        positions: {},      // {nodeId: {x, y, width, height}}
        expandedNodes: {},   // {nodeId: true}
        nodeMap: {}          // {nodeId: nodeObject}
    };

    function init(data) {
        state.nodes = data.nodes;
        state.edges = data.edges;
        state.expandedNodes = {};
        state.nodeMap = {};
        data.nodes.forEach(function (n) {
            state.nodeMap[n.id] = n;
        });
        state.positions = computeLayout(data.nodes, data.edges, layoutOptions);
    }

    /**
     * Recompute positions with the current layoutOptions. Caller is expected
     * to re-render nodes and edges afterwards.
     */
    function relayout() {
        state.positions = computeLayout(state.nodes, state.edges, layoutOptions);
    }

    function getState() {
        return state;
    }

    function getNodeRect(nodeId) {
        return state.positions[nodeId] || null;
    }

    function setNodePosition(nodeId, x, y) {
        if (state.positions[nodeId]) {
            state.positions[nodeId].x = x;
            state.positions[nodeId].y = y;
        }
    }

    function setNodeHeight(nodeId, height) {
        if (state.positions[nodeId]) {
            state.positions[nodeId].height = height;
        }
    }

    function isExpanded(nodeId) {
        return !!state.expandedNodes[nodeId];
    }

    function toggleExpanded(nodeId) {
        if (state.expandedNodes[nodeId]) {
            delete state.expandedNodes[nodeId];
            return false;
        }
        state.expandedNodes[nodeId] = true;
        return true;
    }

    function expandAll() {
        state.nodes.forEach(function (n) {
            if (n.type === 'table') {
                state.expandedNodes[n.id] = true;
            }
        });
    }

    function collapseAll() {
        state.expandedNodes = {};
    }

    function getEdgesForNode(nodeId) {
        return state.edges.filter(function (e) {
            return e.source === nodeId || e.target === nodeId;
        });
    }

    function getColumnLineage(sourceNodeId, columnName) {
        var results = [];
        state.edges.forEach(function (edge) {
            if (!edge.columnMapping || edge.columnMapping.length === 0) return;
            edge.columnMapping.forEach(function (cm) {
                if (cm.sourceNode === sourceNodeId && cm.sourceColumn === columnName) {
                    results.push({
                        edgeId: edge.id,
                        sourceNode: cm.sourceNode,
                        sourceColumn: cm.sourceColumn,
                        targetNode: edge.target,
                        targetColumn: cm.targetColumn,
                        pipelineNode: edge.source
                    });
                }
            });
        });
        return results;
    }

    function getColumnLineageReverse(targetNodeId, columnName) {
        var results = [];
        state.edges.forEach(function (edge) {
            if (edge.target !== targetNodeId) return;
            if (!edge.columnMapping || edge.columnMapping.length === 0) return;
            edge.columnMapping.forEach(function (cm) {
                if (cm.targetColumn === columnName) {
                    results.push({
                        edgeId: edge.id,
                        sourceNode: cm.sourceNode,
                        sourceColumn: cm.sourceColumn,
                        targetNode: targetNodeId,
                        targetColumn: cm.targetColumn,
                        pipelineNode: edge.source
                    });
                }
            });
        });
        return results;
    }

    return {
        computeLayout: computeLayout,
        estimateCollapsedHeight: estimateCollapsedHeight,
        estimateExpandedHeight: estimateExpandedHeight,
        init: init,
        relayout: relayout,
        getState: getState,
        getNodeRect: getNodeRect,
        setNodePosition: setNodePosition,
        setNodeHeight: setNodeHeight,
        isExpanded: isExpanded,
        toggleExpanded: toggleExpanded,
        expandAll: expandAll,
        collapseAll: collapseAll,
        getEdgesForNode: getEdgesForNode,
        getColumnLineage: getColumnLineage,
        getColumnLineageReverse: getColumnLineageReverse,
        setLayoutOptions: setLayoutOptions,
        getLayoutOptions: getLayoutOptions,
        resolvePreset: resolvePreset,
        getGroupKey: getGroupKey
    };
})();
