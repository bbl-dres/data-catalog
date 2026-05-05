/**
 * Filter — toolbar popover + active-filter pill bar. Owns the merged
 * dropdown that previously split into Filter and Sichtbarkeit.
 *
 * Sections in render order:
 *   1. Filter facets — system / type / set / tag (URL-synced via State).
 *      Match logic lives in State.matchesFilters; this module only
 *      decides which checkboxes to draw. Effect: dim non-matching nodes
 *      via Canvas.applyFilterDim.
 *   2. Anzeigen — edges + system frames on/off (body classes).
 *      Persisted to localStorage so layout choices survive refresh.
 *   3. Auswahl — isolate the current selection, or restore.
 *   4. Property Sets — bulk expand / collapse on every node (Canvas).
 *
 * Migration: the previous split exposed type-* checkboxes under
 * Sichtbarkeit that wrote `body.hide-type-*` classes. If a user
 * toggled all types off (intentionally or in testing) and saved that
 * to localStorage, the canvas appeared empty on the next load. The
 * merged dropdown drops type-as-visibility in favour of type-as-filter
 * (dim, not display:none). hydrateLayoutState() picks up the legacy
 * `canvas.vis.v1` key, carries forward edges/systems if present, and
 * deletes the stale shape so anyone who hit that bug recovers
 * automatically on first load of this build.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Filter = (function () {

    var State = null;

    var triggerEl = null;
    var dropdownEl = null;
    var pillBarEl = null;
    var badgeEl = null;

    // Section-collapsed state — session-only, not URL-synced. Internal UX
    // preference: not all four sections need to be open at once.
    var collapsed = Object.create(null);

    // Free-text filter inside the Datenpaket section (registry can be long).
    var setSearchQuery = '';

    // Layout / visibility state (formerly visibility.js). edges + systems
    // toggle body classes that hide their respective layers. Persisted so
    // layout choices survive refresh.
    var LAYOUT_STORAGE_KEY = 'canvas.layout.v2';
    var LEGACY_VIS_KEY     = 'canvas.vis.v1';
    var LAYOUT_KEYS = ['edges', 'systems'];
    var layoutState = { edges: true, systems: true };

    // Node-type labels come from Util.nodeTypeLabel — single source of truth.
    function typeLabelOf(key) { return window.CanvasApp.Util.nodeTypeLabel(key); }
    var DIMENSION_LABELS = {
        system: 'System',
        type: 'Typ',
        set: 'Datenpaket',
        tag: 'Tag'
    };

    var inited = false;
    function init() {
        if (inited) return;
        inited = true;
        State = window.CanvasApp.State;

        triggerEl = document.getElementById('btn-filter');
        dropdownEl = document.getElementById('filter-dropdown');
        pillBarEl = document.getElementById('filter-pill-bar');
        badgeEl = document.getElementById('filter-badge');
        if (!triggerEl || !dropdownEl || !pillBarEl) return;

        // Migrate + apply layout state BEFORE any render so a legacy
        // `hide-type-*` body class never paints (would briefly hide the
        // canvas on first frame).
        hydrateLayoutState();
        applyLayoutToBody();

        triggerEl.addEventListener('click', onTriggerClick);
        dropdownEl.addEventListener('click', onDropdownClick);
        dropdownEl.addEventListener('change', onDropdownChange);
        dropdownEl.addEventListener('input', onDropdownInput);
        pillBarEl.addEventListener('click', onPillBarClick);
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onKeydown);

        State.on(function (reason) {
            if (reason === 'filter') {
                renderPills();
                renderBadge();
                if (!dropdownEl.hasAttribute('hidden')) renderDropdown();
            } else if (reason === 'replace' || reason === 'reset') {
                // Data changed — option lists for system / set / tag may
                // have shifted. Pills still resolve via the registry, but
                // some values may no longer be valid. We don't auto-prune
                // (the URL is the source of truth); just re-render.
                // Drop the Datenpaket free-text query: the registry is now
                // a different set, so the previous search string would show
                // misleading "no results" against unrelated data.
                setSearchQuery = '';
                renderPills();
                renderBadge();
                if (!dropdownEl.hasAttribute('hidden')) renderDropdown();
            }
        });

        renderPills();
        renderBadge();
    }

    // ---- Popover open / close ------------------------------------------

    function onTriggerClick(e) {
        e.stopPropagation();
        var open = dropdownEl.hasAttribute('hidden');
        if (open) openDropdown();
        else      closeDropdown();
    }

    function openDropdown() {
        renderDropdown();
        dropdownEl.removeAttribute('hidden');
        triggerEl.setAttribute('aria-expanded', 'true');
    }

    function closeDropdown() {
        dropdownEl.setAttribute('hidden', '');
        triggerEl.setAttribute('aria-expanded', 'false');
    }

    function onDocClick(e) {
        if (dropdownEl.hasAttribute('hidden')) return;
        if (e.target.closest('.filter-menu')) return;
        closeDropdown();
    }

    function onKeydown(e) {
        if (e.key === 'Escape' && !dropdownEl.hasAttribute('hidden')) closeDropdown();
    }

    // ---- Render: dropdown body -----------------------------------------

    /**
     * Compute distinct option lists for each dimension from the current
     * dataset. Sorted alphabetically except `type`, which keeps its
     * canonical order so the checkbox column reads predictably.
     */
    function computeOptions() {
        var nodes = State.getNodes();
        var systems = Object.create(null);
        var tags = Object.create(null);
        nodes.forEach(function (n) {
            if (n.system) systems[n.system] = true;
            (n.tags || []).forEach(function (t) { if (t) tags[t] = true; });
        });
        var sets = State.getSets().map(function (s) {
            return { value: s.id, label: s.label || s.id };
        });
        return {
            system: Object.keys(systems).sort().map(function (s) { return { value: s, label: s }; }),
            type: window.CanvasApp.Util.NODE_TYPE_KEYS.map(function (t) {
                return { value: t, label: typeLabelOf(t) };
            }),
            set: sets,
            tag: Object.keys(tags).sort().map(function (t) { return { value: t, label: t }; })
        };
    }

    function renderDropdown() {
        var opts = computeOptions();
        var f = State.getFilters();
        var html = '';

        // Property Sets first — bulk expand/collapse is the most common
        // shortcut after opening the dropdown, so it sits up top.
        html += setsSectionHtml();

        // Filter facets — order matches the pill bar / URL param order.
        ['system', 'type', 'set', 'tag'].forEach(function (dim) {
            html += sectionHtml(dim, opts[dim], f[dim] || []);
        });

        // Layout toggles — folded in from Sichtbarkeit. Don't touch
        // State.filters; have their own click/change delegation.
        html += anzeigenSectionHtml();

        // Footer: clear-all when any filter facet is active.
        var hasAny = State.hasActiveFilters();
        html += '<div class="filter-footer">' +
            '<button type="button" class="vis-action-btn" data-filter-action="clear-all"' +
                (hasAny ? '' : ' disabled') + '>Alle Filter entfernen</button>' +
            '<button type="button" class="vis-action-btn" data-filter-action="close">Schliessen</button>' +
        '</div>';

        dropdownEl.innerHTML = html;
    }

    function anzeigenSectionHtml() {
        return '<div class="filter-section" data-filter-section="anzeigen">' +
            '<div class="filter-section-header" data-section-static="anzeigen">' +
                '<span class="filter-section-label">Anzeigen</span>' +
            '</div>' +
            '<div class="filter-section-body">' +
                '<label class="vis-row">' +
                    '<input type="checkbox" data-layout="edges"' + (layoutState.edges ? ' checked' : '') + '> Beziehungen' +
                '</label>' +
                '<label class="vis-row">' +
                    '<input type="checkbox" data-layout="systems"' + (layoutState.systems ? ' checked' : '') + '> Systemrahmen' +
                '</label>' +
            '</div>' +
        '</div>';
    }

    function setsSectionHtml() {
        return '<div class="filter-section" data-filter-section="sets">' +
            '<div class="filter-section-header" data-section-static="sets">' +
                '<span class="filter-section-label">Property Sets</span>' +
            '</div>' +
            '<div class="filter-section-body">' +
                '<div class="vis-footer-actions vis-footer-actions-row">' +
                    '<button type="button" class="vis-action-btn" data-sets-action="expand" title="Alle Property Sets aufklappen">' +
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
                        ' Alle aufklappen' +
                    '</button>' +
                    '<button type="button" class="vis-action-btn" data-sets-action="collapse" title="Alle Property Sets einklappen">' +
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>' +
                        ' Alle einklappen' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function sectionHtml(dim, options, active) {
        var isCollapsed = !!collapsed[dim];
        var activeCount = active.length;
        // Datenpaket section gets a search box because the registry can
        // grow past comfortable scroll length.
        var searchHtml = '';
        var visibleOptions = options;
        if (dim === 'set') {
            searchHtml = '<input type="text" class="filter-section-search"' +
                ' data-filter-search="set"' +
                ' placeholder="Datenpaket suchen…" value="' + escapeAttr(setSearchQuery) + '">';
            if (setSearchQuery) {
                var q = setSearchQuery.toLowerCase();
                visibleOptions = options.filter(function (o) {
                    return o.label.toLowerCase().indexOf(q) !== -1
                        || o.value.toLowerCase().indexOf(q) !== -1;
                });
            }
        }

        var rowsHtml;
        if (!visibleOptions.length) {
            rowsHtml = '<div class="filter-empty">' +
                (dim === 'set' && setSearchQuery ? 'Keine Treffer'
                    : 'Keine Werte vorhanden') +
                '</div>';
        } else {
            rowsHtml = visibleOptions.map(function (o) {
                var checked = active.indexOf(o.value) !== -1 ? ' checked' : '';
                return '<label class="vis-row">' +
                    '<input type="checkbox" data-filter-dim="' + escapeAttr(dim) + '"' +
                        ' data-filter-value="' + escapeAttr(o.value) + '"' + checked + '>' +
                    '<span>' + escapeHtml(o.label) + '</span>' +
                '</label>';
            }).join('');
        }

        return '<div class="filter-section' + (isCollapsed ? ' is-collapsed' : '') +
                '" data-filter-section="' + escapeAttr(dim) + '">' +
            '<div class="filter-section-header" data-filter-toggle="' + escapeAttr(dim) + '">' +
                '<span class="filter-section-chev" aria-hidden="true">' +
                    '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
                '</span>' +
                '<span class="filter-section-label">' + escapeHtml(DIMENSION_LABELS[dim]) + '</span>' +
                (activeCount > 0
                    ? '<span class="filter-section-count">' + activeCount + '</span>'
                    : '') +
            '</div>' +
            '<div class="filter-section-body">' +
                searchHtml +
                rowsHtml +
            '</div>' +
        '</div>';
    }

    // ---- Dropdown click / change delegation ----------------------------

    function onDropdownClick(e) {
        // Section collapse/expand (filter facets only)
        var toggle = e.target.closest('[data-filter-toggle]');
        if (toggle) {
            var dim = toggle.getAttribute('data-filter-toggle');
            collapsed[dim] = !collapsed[dim];
            renderDropdown();
            return;
        }
        // Property Sets bulk expand/collapse
        var setsBtn = e.target.closest('[data-sets-action]');
        if (setsBtn) {
            e.stopPropagation();
            var Canvas = window.CanvasApp.Canvas;
            if (Canvas && Canvas.setAllSetsExpanded) {
                Canvas.setAllSetsExpanded(setsBtn.getAttribute('data-sets-action') === 'expand');
            }
            return;
        }
        // Footer actions
        var actionBtn = e.target.closest('[data-filter-action]');
        if (actionBtn) {
            e.stopPropagation();
            var action = actionBtn.getAttribute('data-filter-action');
            if (action === 'clear-all') State.clearFilters();
            else if (action === 'close') closeDropdown();
            return;
        }
    }

    function onDropdownChange(e) {
        var cb = e.target;
        if (!cb || !cb.matches) return;
        // Filter facet checkbox
        if (cb.matches('input[type="checkbox"][data-filter-dim]')) {
            var dim = cb.getAttribute('data-filter-dim');
            var value = cb.getAttribute('data-filter-value');
            // toggleFilter handles the "is it currently in the list?" decision —
            // simpler than reasoning about checkbox state here.
            State.toggleFilter(dim, value);
            return;
        }
        // Layout (Anzeigen) checkbox — body class + persist
        if (cb.matches('input[type="checkbox"][data-layout]')) {
            var key = cb.getAttribute('data-layout');
            setLayout(key, cb.checked);
            return;
        }
    }

    function onDropdownInput(e) {
        var input = e.target;
        if (!input || !input.matches || !input.matches('[data-filter-search]')) return;
        if (input.getAttribute('data-filter-search') !== 'set') return;
        setSearchQuery = input.value;
        // Re-render only the section body would be lighter, but the full
        // re-render is cheap (~ms) and preserves the input focus naturally
        // because we restore focus after.
        var caret = input.selectionStart;
        renderDropdown();
        var restored = dropdownEl.querySelector('[data-filter-search="set"]');
        if (restored) {
            restored.focus();
            try { restored.setSelectionRange(caret, caret); } catch (err) {}
        }
    }

    // ---- Render: pill bar ----------------------------------------------

    function renderPills() {
        if (!pillBarEl) return;
        var f = State.getFilters();
        var active = []; // [{ dim, value, label }]
        var sets = State.getSets ? State.getSets() : [];
        var setLabelById = Object.create(null);
        sets.forEach(function (s) { setLabelById[s.id] = s.label || s.id; });

        State.getFilterDimensions().forEach(function (dim) {
            (f[dim] || []).forEach(function (v) {
                active.push({ dim: dim, value: v, label: pillLabel(dim, v, setLabelById) });
            });
        });

        if (!active.length) {
            pillBarEl.setAttribute('hidden', '');
            pillBarEl.innerHTML = '';
            return;
        }
        pillBarEl.removeAttribute('hidden');

        var html = '<span class="filter-pill-bar-label">Filter:</span>' +
            active.map(pillHtml).join('') +
            '<button type="button" class="filter-pill-bar-clear" data-filter-action="clear-all"' +
            ' title="Alle Filter entfernen">Alle löschen</button>';
        pillBarEl.innerHTML = html;
    }

    function pillLabel(dim, value, setLabelById) {
        if (dim === 'type') return typeLabelOf(value);
        if (dim === 'set')  return setLabelById[value] || value;
        return value;
    }

    function pillHtml(p) {
        return '<span class="filter-pill" data-pill-dim="' + escapeAttr(p.dim) + '"' +
            ' data-pill-value="' + escapeAttr(p.value) + '">' +
            '<span class="filter-pill-dim">' + escapeHtml(DIMENSION_LABELS[p.dim] || p.dim) + ':</span>' +
            '<span>' + escapeHtml(p.label) + '</span>' +
            '<button type="button" class="filter-pill-remove" data-action="remove-pill"' +
                ' title="Filter entfernen" aria-label="Filter entfernen">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
        '</span>';
    }

    function onPillBarClick(e) {
        var pill = e.target.closest('.filter-pill');
        var clearAll = e.target.closest('[data-filter-action="clear-all"]');
        if (clearAll) {
            State.clearFilters();
            return;
        }
        if (pill && e.target.closest('[data-action="remove-pill"]')) {
            var dim = pill.getAttribute('data-pill-dim');
            var value = pill.getAttribute('data-pill-value');
            State.removeFilterValue(dim, value);
        }
    }

    // ---- Badge on the toolbar trigger ----------------------------------

    function renderBadge() {
        if (!badgeEl) return;
        var n = 0;
        var f = State.getFilters();
        State.getFilterDimensions().forEach(function (dim) {
            n += (f[dim] || []).length;
        });
        if (n > 0) {
            badgeEl.textContent = String(n);
            badgeEl.removeAttribute('hidden');
        } else {
            badgeEl.textContent = '';
            badgeEl.setAttribute('hidden', '');
        }
    }

    // ---- Layout state (Anzeigen section) -------------------------------

    function hydrateLayoutState() {
        // Carry forward the only meaningful keys from the legacy
        // `canvas.vis.v1` shape: edges + systems. Everything else
        // (type-* checkboxes) is intentionally dropped — see file
        // header for context. The legacy key is removed after the
        // one-time migration so it can't leak into a future shape.
        try {
            var legacyRaw = localStorage.getItem(LEGACY_VIS_KEY);
            if (legacyRaw) {
                var legacy = JSON.parse(legacyRaw);
                if (legacy && typeof legacy === 'object') {
                    if (typeof legacy.edges   === 'boolean') layoutState.edges   = legacy.edges;
                    if (typeof legacy.systems === 'boolean') layoutState.systems = legacy.systems;
                }
                localStorage.removeItem(LEGACY_VIS_KEY);
            }
        } catch (e) { /* malformed — ignore */ }

        try {
            var raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
            if (raw) {
                var stored = JSON.parse(raw);
                if (stored && typeof stored === 'object') {
                    LAYOUT_KEYS.forEach(function (k) {
                        if (typeof stored[k] === 'boolean') layoutState[k] = stored[k];
                    });
                }
            }
        } catch (e) { /* malformed — ignore */ }

        persistLayoutState();
    }

    function persistLayoutState() {
        try {
            var snapshot = {};
            LAYOUT_KEYS.forEach(function (k) { snapshot[k] = layoutState[k]; });
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(snapshot));
        } catch (e) { /* quota — ignore */ }
    }

    function applyLayoutToBody() {
        document.body.classList.toggle('hide-edges',   !layoutState.edges);
        document.body.classList.toggle('hide-systems', !layoutState.systems);
    }

    function setLayout(key, on) {
        if (LAYOUT_KEYS.indexOf(key) === -1) return;
        layoutState[key] = !!on;
        persistLayoutState();
        applyLayoutToBody();
        // System frames re-measure when nodes change; toggling them on/off
        // doesn't move nodes, so no extra render call is needed.
    }

    // ---- Util ----------------------------------------------------------

    var escapeHtml = window.CanvasApp.Util.escapeHtml;
    var escapeAttr = window.CanvasApp.Util.escapeAttr;

    return { init: init };
})();
