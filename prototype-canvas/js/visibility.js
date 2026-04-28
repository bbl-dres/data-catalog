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

    function init() {
        triggerEl = document.getElementById('btn-visibility');
        dropdownEl = document.getElementById('vis-dropdown');
        masterEl = document.getElementById('vis-master');

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
        var btn = e.target.closest('[data-sets-action]');
        if (!btn) return;
        e.stopPropagation();
        var Canvas = window.CanvasApp.Canvas;
        if (!Canvas || !Canvas.setAllSetsExpanded) return;
        Canvas.setAllSetsExpanded(btn.getAttribute('data-sets-action') === 'expand');
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
    }

    function applyToBody() {
        var body = document.body;
        KEYS.forEach(function (k) {
            body.classList.toggle('hide-' + k, !visState[k]);
        });
    }

    return { init: init };
})();
