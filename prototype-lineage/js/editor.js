/**
 * Editor — Live JSON editor for lineage data. Parses on input (debounced)
 * and invokes a callback with the parsed object when valid. Does not persist.
 */
window.LineageApp = window.LineageApp || {};

window.LineageApp.Editor = (function () {

    var DEBOUNCE_MS = 400;

    var textarea = null;
    var statusEl = null;
    var debounceTimer = null;
    var onValidChange = null;

    function init(initialText, onValid) {
        textarea = document.getElementById('editor');
        statusEl = document.getElementById('editor-status');
        onValidChange = onValid;

        textarea.value = initialText;
        setStatus('ok', 'Synced');

        textarea.addEventListener('input', onInput);
    }

    function onInput() {
        if (debounceTimer) clearTimeout(debounceTimer);
        setStatus('typing', 'Typing...');
        debounceTimer = setTimeout(tryParse, DEBOUNCE_MS);
    }

    function tryParse() {
        var text = textarea.value;
        var data;

        try {
            data = JSON.parse(text);
        } catch (err) {
            setStatus('error', 'Invalid JSON', err.message);
            return;
        }

        var schemaError = validateSchema(data);
        if (schemaError) {
            setStatus('error', 'Schema error', schemaError);
            return;
        }

        setStatus('ok', 'Synced');
        if (onValidChange) onValidChange(data);
    }

    /**
     * Check shape + every id reference. Returns null when valid, otherwise a
     * short human-readable message naming the offending element.
     */
    function validateSchema(data) {
        if (!data || typeof data !== 'object') {
            return 'Root must be an object';
        }
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            return 'Root object must have "nodes" and "edges" arrays';
        }

        var nodesById = {};
        for (var i = 0; i < data.nodes.length; i++) {
            var n = data.nodes[i];
            if (!n || typeof n !== 'object') return 'nodes[' + i + '] is not an object';
            if (!n.id) return 'nodes[' + i + '] is missing "id"';
            if (nodesById[n.id]) return 'Duplicate node id "' + n.id + '"';
            nodesById[n.id] = n;
        }

        var edgeIds = {};
        for (var j = 0; j < data.edges.length; j++) {
            var e = data.edges[j];
            if (!e || typeof e !== 'object') return 'edges[' + j + '] is not an object';
            if (!e.id) return 'edges[' + j + '] is missing "id"';
            if (edgeIds[e.id]) return 'Duplicate edge id "' + e.id + '"';
            edgeIds[e.id] = true;

            if (!nodesById[e.source]) {
                return 'Edge "' + e.id + '" source "' + e.source + '" is not a node';
            }
            if (!nodesById[e.target]) {
                return 'Edge "' + e.id + '" target "' + e.target + '" is not a node';
            }

            if (e.columnMapping != null && !Array.isArray(e.columnMapping)) {
                return 'Edge "' + e.id + '" columnMapping must be an array';
            }

            if (Array.isArray(e.columnMapping)) {
                var targetNode = nodesById[e.target];
                for (var k = 0; k < e.columnMapping.length; k++) {
                    var cm = e.columnMapping[k];
                    var cmLabel = 'Edge "' + e.id + '" columnMapping[' + k + ']';
                    if (!cm || typeof cm !== 'object') return cmLabel + ' is not an object';

                    var srcNode = nodesById[cm.sourceNode];
                    if (!srcNode) {
                        return cmLabel + ' sourceNode "' + cm.sourceNode + '" is not a node';
                    }
                    if (srcNode.columns && !columnExists(srcNode.columns, cm.sourceColumn)) {
                        return cmLabel + ' sourceColumn "' + cm.sourceColumn + '" not found on "' + cm.sourceNode + '"';
                    }
                    if (targetNode.columns && !columnExists(targetNode.columns, cm.targetColumn)) {
                        return cmLabel + ' targetColumn "' + cm.targetColumn + '" not found on "' + e.target + '"';
                    }
                }
            }
        }

        return null;
    }

    function columnExists(columns, name) {
        if (!Array.isArray(columns)) return false;
        for (var i = 0; i < columns.length; i++) {
            if (columns[i] && columns[i].name === name) return true;
        }
        return false;
    }

    /**
     * Replace the editor contents programmatically (does not fire onValidChange).
     * Use when loading a preset example so the UI reflects the new file.
     */
    function setContent(text) {
        if (!textarea) return;
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        textarea.value = text;
        setStatus('ok', 'Synced');
    }

    function setStatus(state, label, tooltip) {
        if (!statusEl) return;
        statusEl.classList.remove(
            'editor-pane__status--ok',
            'editor-pane__status--error',
            'editor-pane__status--typing'
        );
        statusEl.classList.add('editor-pane__status--' + state);
        statusEl.textContent = label;
        statusEl.title = tooltip || '';
    }

    return {
        init: init,
        setContent: setContent
    };
})();
