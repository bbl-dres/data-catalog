/**
 * Util — small shared helpers used across modules.
 *
 * Loaded first in index.html (before any other CanvasApp module) so every
 * downstream module can do `var escapeHtml = window.CanvasApp.Util.escapeHtml;`
 * at the top of its IIFE without a load-order dance. Keep this surface
 * deliberately minimal — the bar for adding something here is "duplicated
 * in three or more modules, with no module-specific variations".
 *
 * History: extracted in March 2026 after a senior-dev review found nine
 * identical copies of `escapeHtml` and two of `cssEscape` scattered across
 * UI modules. Today's surface only covers the literal duplicates; module
 * lifecycle helpers (modal open/close, focus management, etc.) stay in
 * their owning modules because they each have specific state to thread.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Util = (function () {

    /**
     * HTML-escape a value for inline insertion via innerHTML or template
     * strings. Coerces null/undefined to ''. The character set covers the
     * five ASCII characters that can break out of element-content context;
     * attribute insertion uses the same rules (browsers parse `&` inside
     * attributes too).
     */
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Alias kept for call-site clarity: `escapeAttr` reads as "I'm putting
     * this in an attribute". Behaviour identical to escapeHtml — both
     * contexts need the same five characters escaped.
     */
    var escapeAttr = escapeHtml;

    /**
     * CSS.escape with a vanilla regex fallback for older browsers. Used to
     * safely embed user-controlled ids inside attribute selectors like
     * `[data-node-id="..."]`. The fallback is conservative — it escapes
     * anything outside [a-zA-Z0-9_-]; CSS.escape is more precise but only
     * matters in browsers that have it (which is all modern browsers, so
     * the fallback is effectively dead code retained for safety).
     */
    function cssEscape(s) {
        if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
        return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    /**
     * Run `fn` after the browser has both painted the latest DOM and
     * recomputed layout. The "double rAF" pattern: first frame fires after
     * the next paint, second frame fires after the layout pass that paint
     * triggered. Used wherever we need to read measured dimensions of
     * just-rendered content (e.g., post-load `goHome` framing in app.js,
     * post-export PDF print dialog timing in xlsx_io.js).
     */
    function afterLayout(fn) {
        requestAnimationFrame(function () {
            requestAnimationFrame(fn);
        });
    }

    /**
     * WAI-ARIA Tab Pattern keyboard handler. Wires ArrowLeft / ArrowRight /
     * Home / End cycling on a tablist container; the active tab gets
     * `tabindex="0"`, inactive ones `tabindex="-1"` (roving tabindex), so
     * Tab itself moves focus *out* of the group instead of stepping
     * through every tab.
     *
     * Caller is responsible for the click-driven activation path and for
     * setting initial `aria-selected` / `tabindex` attributes; this helper
     * only handles the keyboard cycle. `onActivate(tabEl)` is called when
     * the cycle moves to a new tab — caller decides whether to update
     * state, render content, etc.
     */
    function wireTablistKeyboard(seg, onActivate) {
        if (!seg) return;
        seg.addEventListener('keydown', function (e) {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
            var tabs = Array.prototype.slice.call(seg.querySelectorAll('[role="tab"]'));
            if (!tabs.length) return;
            var idx = tabs.indexOf(document.activeElement);
            if (idx < 0) idx = 0;
            var next = idx;
            if (e.key === 'ArrowLeft')  next = (idx - 1 + tabs.length) % tabs.length;
            if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
            if (e.key === 'Home')       next = 0;
            if (e.key === 'End')        next = tabs.length - 1;
            e.preventDefault();
            tabs[next].focus();
            if (onActivate) onActivate(tabs[next]);
        });
    }

    /**
     * Single source of truth for the five node types the app knows about.
     * Was previously duplicated as parallel maps across canvas / editor /
     * panel / filter / app:
     *   - TYPE_LABELS         (singular)
     *   - TYPE_LABELS_PLURAL  (plural — only panel needed it)
     *   - TYPE_ICONS          (inline SVG markup, identical paths but
     *                          different `width` per call site)
     *   - TYPE_DEFAULTS       (column seeds for new entities)
     *   - TYPE_CYCLE          (key cycle for the type-icon click)
     *
     * Order matters — TYPE_KEYS / NODE_TYPES is the canonical cycle for
     * the click-to-cycle node-type icon (editor.js); add new types at
     * the end so existing canvases stay on stable cycle positions.
     *
     * Icon paths are stored as the *inner* markup (no <svg> wrapper);
     * `nodeTypeIcon(key, size)` wraps with the requested dimensions —
     * so the same paths feed canvas.js (14 px node header) and panel.js
     * (16 px info-panel header) without the SVG wrapper getting copy-
     * pasted.
     */
    var NODE_TYPES = [
        {
            key: 'table',
            label: 'Tabelle',
            labelPlural: 'Tabellen',
            iconBody:
                '<rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/>' +
                '<line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/>' +
                '<line x1="5.5" y1="5.5" x2="5.5" y2="14.5"/>',
            defaults: { label: 'neue_tabelle', columns: [{ name: 'id', type: 'uuid', key: 'PK' }] }
        },
        {
            key: 'view',
            label: 'View',
            labelPlural: 'Views',
            iconBody:
                '<path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>' +
                '<circle cx="8" cy="8" r="2"/>',
            defaults: { label: 'neue_view', columns: [] }
        },
        {
            key: 'api',
            label: 'API',
            labelPlural: 'APIs',
            iconBody:
                '<path d="M8.5 1.5L2 9.5h6l-1 5L13.5 6.5h-6l1-5z"/>',
            defaults: { label: '/api/neu', columns: [] }
        },
        {
            key: 'file',
            label: 'Datei',
            labelPlural: 'Dateien',
            iconBody:
                '<path d="M9 1.5H3.5a1 1 0 0 0-1 1V13.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L9 1.5z"/>' +
                '<polyline points="9 1.5 9 6 13.5 6"/>',
            defaults: { label: 'neue_datei', columns: [] }
        },
        {
            key: 'codelist',
            label: 'Werteliste',
            labelPlural: 'Wertelisten',
            iconBody:
                '<line x1="6" y1="3" x2="13" y2="3"/>' +
                '<line x1="6" y1="8" x2="13" y2="8"/>' +
                '<line x1="6" y1="13" x2="13" y2="13"/>' +
                '<circle cx="3" cy="3" r="1.2" fill="currentColor"/>' +
                '<circle cx="3" cy="8" r="1.2" fill="currentColor"/>' +
                '<circle cx="3" cy="13" r="1.2" fill="currentColor"/>',
            defaults: { label: 'neue_werteliste', columns: [
                { name: 'code',        type: 'CHAR(10)', key: 'PK' },
                { name: 'label',       type: 'TEXT',     key: ''   },
                { name: 'description', type: 'TEXT',     key: ''   },
                { name: 'sort_order',  type: 'INT',      key: ''   },
                { name: 'deprecated',  type: 'BOOLEAN',  key: ''   }
            ] }
        }
    ];

    var NODE_TYPES_BY_KEY = Object.create(null);
    NODE_TYPES.forEach(function (t) { NODE_TYPES_BY_KEY[t.key] = t; });

    var NODE_TYPE_KEYS = NODE_TYPES.map(function (t) { return t.key; });

    /** Singular German label for a type key, with safe fallback. */
    function nodeTypeLabel(key) {
        var t = NODE_TYPES_BY_KEY[key];
        return t ? t.label : (key || 'Knoten');
    }
    /** Plural German label, with safe fallback. */
    function nodeTypeLabelPlural(key) {
        var t = NODE_TYPES_BY_KEY[key];
        return t ? t.labelPlural : (key || 'Knoten');
    }
    /** Inline SVG markup for the type icon, sized to `px`. Default 14. */
    function nodeTypeIcon(key, px) {
        var t = NODE_TYPES_BY_KEY[key] || NODE_TYPES_BY_KEY.table;
        var size = px || 14;
        return '<svg width="' + size + '" height="' + size +
            '" viewBox="0 0 16 16" fill="none" stroke="currentColor" ' +
            'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
            'aria-hidden="true">' + t.iconBody + '</svg>';
    }
    /** Default columns for a new entity of `key`. Returns a shallow clone. */
    function nodeTypeDefaults(key) {
        var t = NODE_TYPES_BY_KEY[key] || NODE_TYPES_BY_KEY.table;
        return {
            label: t.defaults.label,
            columns: t.defaults.columns.map(function (c) { return Object.assign({}, c); })
        };
    }

    return {
        escapeHtml: escapeHtml,
        escapeAttr: escapeAttr,
        cssEscape:  cssEscape,
        afterLayout: afterLayout,
        wireTablistKeyboard: wireTablistKeyboard,
        NODE_TYPES: NODE_TYPES,
        NODE_TYPE_KEYS: NODE_TYPE_KEYS,
        nodeTypeLabel: nodeTypeLabel,
        nodeTypeLabelPlural: nodeTypeLabelPlural,
        nodeTypeIcon: nodeTypeIcon,
        nodeTypeDefaults: nodeTypeDefaults
    };
})();
