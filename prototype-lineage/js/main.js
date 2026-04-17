/**
 * Main — Entry point. Loads data, initializes graph, renders, wires interactions.
 */
window.LineageApp = window.LineageApp || {};

(function () {

    var Graph = window.LineageApp.Graph;
    var Renderer = window.LineageApp.Renderer;
    var Interactions = window.LineageApp.Interactions;

    var ERROR_CARD_ID = 'graph-error-card';

    function applySelectedLayoutPreset(nodeCount) {
        var selector = document.getElementById('layout-selector');
        var preset = selector ? selector.value : undefined;
        if (!preset) return;
        Graph.setLayoutOptions(Graph.resolvePreset(preset, nodeCount));
    }

    function renderData(data) {
        hideLoadError();
        applySelectedLayoutPreset(data.nodes.length);
        Graph.init(data);
        Renderer.renderAllNodes();
        Renderer.renderAllEdges();
        requestAnimationFrame(function () {
            Interactions.fitToScreen();
        });
    }

    async function loadExample(url) {
        var response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var rawText = await response.text();
        return { data: JSON.parse(rawText), rawText: rawText };
    }

    function showLoadError(url, err) {
        var container = document.getElementById('graph-container');
        if (!container) return;

        var existing = document.getElementById(ERROR_CARD_ID);
        if (existing) existing.remove();

        var card = document.createElement('div');
        card.id = ERROR_CARD_ID;
        card.className = 'graph-error-card';

        var title = document.createElement('div');
        title.className = 'graph-error-card__title';
        title.textContent = 'Could not load ' + url;
        card.appendChild(title);

        var detail = document.createElement('div');
        detail.className = 'graph-error-card__detail';
        detail.textContent = err && err.message ? err.message : String(err);
        card.appendChild(detail);

        var hint = document.createElement('div');
        hint.className = 'graph-error-card__hint';
        hint.textContent = 'Check that the file exists and is valid JSON, or pick another example.';
        card.appendChild(hint);

        container.appendChild(card);
    }

    function hideLoadError() {
        var existing = document.getElementById(ERROR_CARD_ID);
        if (existing) existing.remove();
    }

    function clearGraph() {
        Graph.init({ nodes: [], edges: [] });
        Renderer.renderAllNodes();
        Renderer.renderAllEdges();
    }

    async function init() {
        var Editor = window.LineageApp.Editor;

        Renderer.init();
        Interactions.init();

        if (Editor) {
            Editor.init('', function (newData) {
                renderData(newData);
            });
        }

        var selector = document.getElementById('example-selector');
        var defaultUrl = selector ? selector.value : 'data/lineage.json';

        await loadAndRender(defaultUrl, Editor);

        if (selector) {
            selector.addEventListener('change', function (e) {
                loadAndRender(e.target.value, Editor);
            });
        }
    }

    async function loadAndRender(url, Editor) {
        try {
            var loaded = await loadExample(url);
            if (Editor) Editor.setContent(loaded.rawText);
            renderData(loaded.data);
        } catch (err) {
            console.warn('Could not load ' + url + ':', err.message);
            clearGraph();
            if (Editor) Editor.setContent('');
            showLoadError(url, err);
        }
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
