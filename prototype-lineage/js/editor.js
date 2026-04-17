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

        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            setStatus('error', 'Schema error', 'Root object must have "nodes" and "edges" arrays');
            return;
        }

        setStatus('ok', 'Synced');
        if (onValidChange) onValidChange(data);
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
