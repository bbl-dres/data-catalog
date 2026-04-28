/**
 * Visibility — checkbox-driven filter dropdown that toggles which kinds of
 * canvas elements are rendered. Settings persist to localStorage in their
 * own key (always-saved, separate from the data state and from layout).
 *
 * Mechanism: each toggle flips a `body.hide-<key>` class. CSS does the
 * actual hiding. Group frames are re-rendered when node-affecting toggles
 * change so the bbox tightens to the visible members.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Visibility = (function () {

    var STORAGE_KEY = 'canvas.vis.v1';

    var KEYS = [
        'type-table', 'type-view', 'type-api', 'type-file', 'type-codelist',
        'edges', 'systems'
    ];
    // Keys whose toggling changes a node's height or removes whole nodes —
    // group frames need re-measuring after these flip.
    var NODE_AFFECTING = {
        'type-table': true, 'type-view': true, 'type-api': true,
        'type-file': true, 'type-codelist': true
    };

    var visState = {};       // key → boolean (true = visible)
    var triggerEl = null;
    var dropdownEl = null;
    var masterEl = null;
    var masterCountEl = null;

    // Isolation: when a node or system is selected and the user picks
    // "Nur Auswahl anzeigen", we mark every other node as isolated via
    // a body-class flag plus per-node `data-isolated="true"`. CSS hides
    // .node[data-isolated="true"]; deselecting / clicking "Alle wieder
    // zeigen" clears the flag.
    var isolated = false;

    function init() {
        triggerEl = document.getElementById('btn-visibility');
        dropdownEl = document.getElementById('vis-dropdown');
        masterEl = document.getElementById('vis-master');
        masterCountEl = document.getElementById('vis-master-count');

        // Hydrate state — default visible
        var stored = readStorage();
        KEYS.forEach(function (k) {
            visState[k] = stored ? stored[k] !== false : true;
        });

        triggerEl.addEventListener('click', onTriggerClick);
        dropdownEl.addEventListener('change', onChange);
        dropdownEl.addEventListener('click', onDropdownClick);
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onKeydown);

        // Re-render isolation when nodes/edges or selection change.
        var State = window.CanvasApp && window.CanvasApp.State;
        if (State) {
            State.on(function (reason) {
                if (reason === 'replace' || reason === 'reset' || reason === 'nodes') {
                    if (isolated) applyIsolation();
                }
                if (reason === 'selection') {
                    // If the user clears their selection, dropping isolation
                    // matches the "isolated view of nothing" intuition.
                    if (isolated && !State.getSelection()) {
                        clearIsolation();
                    }
                }
            });
        }

        renderCheckboxes();
        applyToBody();
    }

    function readStorage() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
        catch (e) { return null; }
    }
    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visState)); }
        catch (e) { /* quota — ignore */ }
    }

    function onTriggerClick(e) {
        e.stopPropagation();
        var open = dropdownEl.hasAttribute('hidden');
        if (open) {
            dropdownEl.removeAttribute('hidden');
            triggerEl.setAttribute('aria-expanded', 'true');
        } else {
            close();
        }
    }

    function onDocClick(e) {
        if (dropdownEl.hasAttribute('hidden')) return;
        if (e.target.closest('.vis-menu')) return;
        close();
    }

    function onKeydown(e) {
        if (e.key === 'Escape' && !dropdownEl.hasAttribute('hidden')) close();
    }

    function close() {
        dropdownEl.setAttribute('hidden', '');
        triggerEl.setAttribute('aria-expanded', 'false');
    }

    function onChange(e) {
        var cb = e.target;
        if (!cb) return;
        // Master tri-state toggle: bulk set every visState key.
        if (cb === masterEl) {
            var on = cb.checked;
            KEYS.forEach(function (k) { visState[k] = on; });
            persist();
            renderCheckboxes();
            applyToBody();
            if (window.CanvasApp.Canvas && window.CanvasApp.Canvas.renderGroups) {
                requestAnimationFrame(window.CanvasApp.Canvas.renderGroups);
            }
            return;
        }
        if (!cb.matches || !cb.matches('input[type="checkbox"][data-vis]')) return;
        var key = cb.getAttribute('data-vis');
        visState[key] = cb.checked;
        persist();
        updateMaster();
        applyToBody();
        // If this toggle changes node sizes / removes nodes, the system
        // frames need re-measuring after the layout settles.
        if (NODE_AFFECTING[key] && window.CanvasApp.Canvas && window.CanvasApp.Canvas.renderGroups) {
            requestAnimationFrame(window.CanvasApp.Canvas.renderGroups);
        }
    }

    function onDropdownClick(e) {
        var setsBtn = e.target.closest('[data-sets-action]');
        if (setsBtn) {
            e.stopPropagation();
            var Canvas = window.CanvasApp.Canvas;
            if (!Canvas || !Canvas.setAllSetsExpanded) return;
            Canvas.setAllSetsExpanded(setsBtn.getAttribute('data-sets-action') === 'expand');
            return;
        }
        var isoBtn = e.target.closest('[data-isolate-action]');
        if (isoBtn) {
            e.stopPropagation();
            if (isoBtn.getAttribute('data-isolate-action') === 'on') applyIsolation();
            else clearIsolation();
        }
    }

    /**
     * Hide every node that's not part of the current selection's "neighbourhood":
     *   - selected node itself
     *   - all nodes belonging to the selected system (if a system is selected)
     *   - direct edge neighbours (one hop away) of the selected node
     *
     * We use data-isolated="true" rather than display:none so the existing
     * type/edge visibility classes still compose. Edges where either endpoint
     * is hidden get hidden via a CSS rule.
     */
    function applyIsolation() {
        var State = window.CanvasApp && window.CanvasApp.State;
        if (!State) return;
        var sel = State.getSelection();
        if (!sel) {
            window.CanvasApp.App && window.CanvasApp.App.toast &&
                window.CanvasApp.App.toast('Erst etwas auswählen, dann isolieren.');
            return;
        }
        var keepIds = Object.create(null);
        if (sel.kind === 'node') {
            keepIds[sel.id] = true;
            // One-hop neighbourhood — direct connections.
            State.getEdges().forEach(function (e) {
                if (e.from === sel.id) keepIds[e.to]   = true;
                if (e.to   === sel.id) keepIds[e.from] = true;
            });
        } else if (sel.kind === 'system') {
            State.getNodes().forEach(function (n) {
                if (n.system === sel.name) keepIds[n.id] = true;
            });
        } else if (sel.kind === 'attribute') {
            keepIds[sel.nodeId] = true;
        } else if (sel.kind === 'edge') {
            var ed = State.getEdge(sel.id);
            if (ed) { keepIds[ed.from] = true; keepIds[ed.to] = true; }
        }

        document.querySelectorAll('.node-layer .node').forEach(function (el) {
            var id = el.getAttribute('data-node-id');
            if (keepIds[id]) el.removeAttribute('data-isolated');
            else             el.setAttribute('data-isolated', 'true');
        });
        // Edges: hide if either endpoint is isolated.
        document.querySelectorAll('.edge-group').forEach(function (g) {
            var f = g.getAttribute('data-from');
            var t = g.getAttribute('data-to');
            if (keepIds[f] && keepIds[t]) g.removeAttribute('data-isolated');
            else                          g.setAttribute('data-isolated', 'true');
        });
        isolated = true;
        document.body.classList.add('is-isolated');
    }

    function clearIsolation() {
        document.querySelectorAll('[data-isolated]').forEach(function (el) {
            el.removeAttribute('data-isolated');
        });
        isolated = false;
        document.body.classList.remove('is-isolated');
    }

    function renderCheckboxes() {
        var inputs = dropdownEl.querySelectorAll('input[data-vis]');
        Array.prototype.forEach.call(inputs, function (cb) {
            var key = cb.getAttribute('data-vis');
            cb.checked = visState[key] !== false;
        });
        updateMaster();
    }

    /** Tri-state master: all on → checked; all off → unchecked; mixed → indeterminate. */
    function updateMaster() {
        if (!masterEl) return;
        var onCount = 0;
        KEYS.forEach(function (k) { if (visState[k]) onCount += 1; });
        if (onCount === KEYS.length) {
            masterEl.checked = true;
            masterEl.indeterminate = false;
        } else if (onCount === 0) {
            masterEl.checked = false;
            masterEl.indeterminate = false;
        } else {
            masterEl.checked = false;
            masterEl.indeterminate = true;
        }
        if (masterCountEl) {
            masterCountEl.textContent = onCount + '/' + KEYS.length;
        }
    }

    function applyToBody() {
        var body = document.body;
        KEYS.forEach(function (k) {
            body.classList.toggle('hide-' + k, !visState[k]);
        });
    }

    return { init: init };
})();
