/**
 * Panel — right-side info panel showing details about the currently
 * selected node. Lives across diagram + table views (hidden in API view).
 *
 * Visibility is driven by State.selectedId: any selected node opens the
 * panel; clearing the selection (background click, × on panel, Esc deselect)
 * closes it. Edge selection is handled by the inline edge editor — the
 * panel doesn't render for edges.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Panel = (function () {

    var State = null;
    var panelEl = null;
    var contentEl = null;

    // Node-type metadata (labels, plurals, 16 px icons) come from Util's
    // shared registry — same source as canvas.js / editor.js / filter.js.
    var Util = window.CanvasApp.Util;
    function typeLabelOf(key)       { return Util.nodeTypeLabel(key); }
    function typeLabelPluralOf(key) { return Util.nodeTypeLabelPlural(key); }
    function typeIcon(key)          { return Util.nodeTypeIcon(key, 16); }

    var WIDTH_STORAGE_KEY = 'canvas.panel.width.v1';
    var WIDTH_MIN = 280;
    var WIDTH_MAX = 640;
    var WIDTH_DEFAULT = 360;

    function init() {
        State = window.CanvasApp.State;
        panelEl = document.getElementById('info-panel');
        contentEl = document.getElementById('info-panel-content');

        // Click delegation: × close, set / relation row clicks
        contentEl.addEventListener('click', onContentClick);
        // Change delegation: edit-mode set picker on the attribute detail panel.
        contentEl.addEventListener('change', onContentChange);

        State.on(function (reason, payload) {
            if (reason === 'view') {
                document.body.setAttribute('data-view', State.getView());
                updateOpenState();
                return;
            }
            // 'canvas' is included so the panel re-renders on canvas
            // swap — without it, a stale selection from the previous
            // canvas could keep showing whatever node had the same id
            // (or an empty / partial render referencing a node that
            // doesn't exist in the new canvas).
            if (reason !== 'selection' && reason !== 'nodes' && reason !== 'edges' &&
                reason !== 'replace' && reason !== 'reset' && reason !== 'canvas') {
                return;
            }
            // Single-entity events ('nodes' / 'edges' with an id payload):
            // skip the re-render when the changed entity provably can't
            // affect what the panel is currently showing. The previous
            // behaviour rebuilt the entire panel innerHTML on every node
            // label edit even when the panel was closed or showing a
            // different entity.
            if ((reason === 'nodes' || reason === 'edges') &&
                typeof payload === 'string' && payload) {
                var sel = State.getSelection();
                if (!sel) return;  // panel is closed, nothing to refresh
                if (reason === 'nodes' && sel.kind === 'node'      && payload !== sel.id)     return;
                if (reason === 'nodes' && sel.kind === 'attribute' && payload !== sel.nodeId) return;
                if (reason === 'edges' && sel.kind === 'edge'      && payload !== sel.id)     return;
            }
            render();
        });

        // Initial state
        document.body.setAttribute('data-view', State.getView());

        // Resize: drag the left edge to widen / narrow the panel.
        applyPanelWidth(readStoredWidth());
        wireResize();
    }

    function readStoredWidth() {
        try {
            var raw = localStorage.getItem(WIDTH_STORAGE_KEY);
            var n = raw ? parseInt(raw, 10) : NaN;
            if (Number.isFinite(n)) return clampWidth(n);
        } catch (e) {}
        return WIDTH_DEFAULT;
    }

    function clampWidth(n) {
        if (n < WIDTH_MIN) return WIDTH_MIN;
        if (n > WIDTH_MAX) return WIDTH_MAX;
        return n;
    }

    function applyPanelWidth(px) {
        document.documentElement.style.setProperty('--info-panel-width', px + 'px');
    }

    function wireResize() {
        var handle = document.getElementById('info-panel-resize');
        if (!handle) return;

        var dragging = false;
        var startX = 0;
        var startWidth = WIDTH_DEFAULT;
        // rAF-coalesce pointermove → applyPanelWidth so a 120 Hz trackpad
        // doesn't trigger 120 style recalcs (and 120 ResizeObserver
        // notifications on canvasEl) per second. We stash the latest target
        // width and apply once per frame.
        var pendingWidth = null;
        var resizeRafQueued = false;
        function flushResize() {
            resizeRafQueued = false;
            if (pendingWidth == null) return;
            applyPanelWidth(pendingWidth);
            pendingWidth = null;
        }

        handle.addEventListener('pointerdown', function (e) {
            // Only respond to primary button drags
            if (e.button !== 0) return;
            dragging = true;
            startX = e.clientX;
            startWidth = panelEl.getBoundingClientRect().width;
            panelEl.classList.add('is-resizing');
            document.body.classList.add('is-resizing-panel');
            handle.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        handle.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            // Drag-left widens (panel grows from its right anchor)
            var delta = startX - e.clientX;
            pendingWidth = clampWidth(startWidth + delta);
            if (resizeRafQueued) return;
            resizeRafQueued = true;
            requestAnimationFrame(flushResize);
        });

        function endDrag(e) {
            if (!dragging) return;
            dragging = false;
            // Flush any rAF-pending width so the final cursor position lands
            // on screen before we read computed width below.
            if (pendingWidth != null) { applyPanelWidth(pendingWidth); pendingWidth = null; }
            panelEl.classList.remove('is-resizing');
            document.body.classList.remove('is-resizing-panel');
            try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
            var current = parseInt(getComputedStyle(panelEl).width, 10) || WIDTH_DEFAULT;
            try { localStorage.setItem(WIDTH_STORAGE_KEY, String(current)); } catch (_) {}
        }
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);

        // Keyboard: ←/→ steps the width by 16 px when handle is focused.
        handle.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            var current = parseInt(getComputedStyle(panelEl).width, 10) || WIDTH_DEFAULT;
            var step = e.key === 'ArrowLeft' ? 16 : -16;
            var next = clampWidth(current + step);
            applyPanelWidth(next);
            try { localStorage.setItem(WIDTH_STORAGE_KEY, String(next)); } catch (_) {}
        });
    }

    function updateOpenState() {
        var sel = State.getSelection();
        var supports = sel && (sel.kind === 'node' || sel.kind === 'system'
            || sel.kind === 'attribute' || sel.kind === 'edge' || sel.kind === 'set');
        var view = State.getView();
        var open = supports && view !== 'api';
        panelEl.classList.toggle('is-open', open);
        document.body.setAttribute('data-panel', open ? 'open' : 'closed');
        // a11y: when the panel is slid off-screen (transform: translateX
        // 100 %) it remains in the DOM and would otherwise sit in the
        // a11y tree — keyboard focus could enter it via Tab and screen
        // readers would announce its (stale) contents. `inert` removes
        // the whole subtree from focus + AT until it's open again.
        // Mirror with aria-hidden for older screen readers that don't
        // honour `inert` yet.
        if (open) {
            panelEl.removeAttribute('inert');
            panelEl.removeAttribute('aria-hidden');
        } else {
            panelEl.setAttribute('inert', '');
            panelEl.setAttribute('aria-hidden', 'true');
        }
    }

    function render() {
        var sel = State.getSelection();
        if (!sel) {
            contentEl.innerHTML = '';
            updateOpenState();
            return;
        }
        if (sel.kind === 'node') {
            var node = State.getNode(sel.id);
            if (!node) { contentEl.innerHTML = ''; updateOpenState(); return; }
            contentEl.innerHTML = nodeContentHtml(node);
        } else if (sel.kind === 'system') {
            contentEl.innerHTML = systemContentHtml(sel.name);
        } else if (sel.kind === 'attribute') {
            var an = State.getNode(sel.nodeId);
            var col = an && (an.columns || []).find(function (c) { return c.name === sel.name; });
            if (!an || !col) { contentEl.innerHTML = ''; updateOpenState(); return; }
            contentEl.innerHTML = attributeContentHtml(an, col);
        } else if (sel.kind === 'edge') {
            var edge = State.getEdge(sel.id);
            if (!edge) { contentEl.innerHTML = ''; updateOpenState(); return; }
            contentEl.innerHTML = edgeContentHtml(edge);
        } else if (sel.kind === 'set') {
            var setObj = State.getSet(sel.id);
            if (!setObj) { contentEl.innerHTML = ''; updateOpenState(); return; }
            contentEl.innerHTML = setContentHtml(setObj);
        } else {
            contentEl.innerHTML = '';
        }
        updateOpenState();
    }

    function nodeContentHtml(node) {
        // Codelists carry their entries in `node.columns[]` (code in .name,
        // label in .type) — same shape as a distribution's attributes, but
        // semantically "controlled vocabulary values", not "table fields".
        // Render them as a values list instead of a PK/FK stat block.
        var isCodelist = node.type === 'codelist';
        return headerHtml(node) +
               descriptionSectionHtml(node.description) +
               metadataSectionHtml(node) +
               distributionExtrasSectionHtml(node) +
               (isCodelist ? '' : propertySetsSectionHtml(node)) +
               (isCodelist ? codelistEntriesSectionHtml(node)
                           : attributesSectionHtml(node)) +
               rolesSectionHtml(node.roles) +
               standardsSectionHtml(node.standards) +
               relationsSectionHtml(node);
    }

    /**
     * Werteliste entries — the actual `(code, label)` rows of a codelist
     * node, rendered when the codelist is the panel subject. Uses the
     * same row markup as the inline values list shown on attribute
     * panels (codelistValuesSectionHtml) but without the "→ go to codelist"
     * back-link, since we're already there.
     */
    function codelistEntriesSectionHtml(node) {
        var cols = node.columns || [];
        if (!cols.length) {
            return '' +
                '<div class="info-section">' +
                    '<div class="info-section-label">Werteliste</div>' +
                    '<div style="font-size:var(--text-small);color:var(--color-text-placeholder)">Keine Einträge</div>' +
                '</div>';
        }
        var rows = cols.map(function (entry) {
            var code  = entry.name || '';
            var label = entry.type || '';
            return '<li>' +
                '<span class="info-set-name">' + escapeHtml(code) + '</span>' +
                '<span class="info-set-label">' + escapeHtml(label) + '</span>' +
            '</li>';
        }).join('');
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Werteliste <span class="info-section-count">' + cols.length + '</span></div>' +
                '<ul class="info-set-list info-codelist-list">' + rows + '</ul>' +
            '</div>';
    }

    /**
     * Distribution-meta extras: URLs, license, format, periodicity, etc.
     * Renders only when at least one field is populated, so unbridled
     * IBPDI-style data doesn't show an empty section. Attribute rows
     * follow the same "skip empty" rule as the main Metadaten block.
     */
    function distributionExtrasSectionHtml(node) {
        if (node.type === 'codelist') return ''; // codelists don't carry these
        var rows = [];
        if (node.technicalName)      rows.push(metaRow('Technischer Name', codeFmt(node.technicalName)));
        if (node.format)             rows.push(metaRow('Format',           escapeHtml(node.format)));
        if (node.mediaType)          rows.push(metaRow('Medientyp',        codeFmt(node.mediaType)));
        if (node.accessUrl)          rows.push(metaRow('Zugriff',          urlFmt(node.accessUrl)));
        if (node.downloadUrl)        rows.push(metaRow('Download',         urlFmt(node.downloadUrl)));
        if (node.license)            rows.push(metaRow('Lizenz',           escapeHtml(node.license)));
        if (node.accrualPeriodicity) rows.push(metaRow('Aktualisierung',   escapeHtml(node.accrualPeriodicity)));
        if (node.availability)       rows.push(metaRow('Verfügbarkeit',    escapeHtml(node.availability)));
        if (node.spatialCoverage)    rows.push(metaRow('Geltungsbereich',  escapeHtml(node.spatialCoverage)));
        if (node.temporalStart || node.temporalEnd) {
            var span = (node.temporalStart || '–') + ' → ' + (node.temporalEnd || '–');
            rows.push(metaRow('Zeitraum', escapeHtml(span)));
        }
        if (node.issued)   rows.push(metaRow('Veröffentlicht',  escapeHtml(formatDate(node.issued))));
        if (node.modified) rows.push(metaRow('Letzte Änderung', escapeHtml(formatDate(node.modified))));
        if (!rows.length) return '';
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Veröffentlichung</div>' +
                '<dl class="info-meta">' + rows.join('') + '</dl>' +
            '</div>';
    }

    /**
     * Role assignments (Verantwortliche). Each row: role label + contact
     * name (or org for team contacts) + email. Same shape as relations
     * rows so the rendering reads consistently across panels. Returns
     * empty when no roles are assigned (most current data).
     */
    function rolesSectionHtml(roles) {
        if (!roles || !roles.length) return '';
        var items = roles.map(function (r) {
            var name = r.contactName || r.organisation || r.contactEmail || '–';
            var sub = [];
            if (r.contactName && r.organisation) sub.push(escapeHtml(r.organisation));
            if (r.contactEmail) sub.push('<a href="mailto:' + escapeAttr(r.contactEmail) + '" class="info-link">' + escapeHtml(r.contactEmail) + '</a>');
            var subLine = sub.length
                ? '<span class="info-set-label">' + sub.join(' · ') + '</span>'
                : '';
            return '' +
                '<li>' +
                    '<span class="info-set-name">' + escapeHtml(roleLabel(r.role)) + '</span>' +
                    '<span class="info-rel-target">' + escapeHtml(name) + '</span>' +
                    subLine +
                '</li>';
        }).join('');
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Verantwortliche <span class="info-section-count">' + roles.length + '</span></div>' +
                '<ul class="info-rel-list">' + items + '</ul>' +
            '</div>';
    }

    /**
     * Standards realised by this node ("realises" edges → standard_reference
     * nodes). Each row carries organisation, code, version, and an optional
     * URL. Rendered as a flat list because standards rarely number more
     * than a handful per node.
     */
    function standardsSectionHtml(standards) {
        if (!standards || !standards.length) return '';
        var items = standards.map(function (s) {
            var primary = s.label || (s.organisation ? s.organisation + ' ' + (s.code || '') : (s.code || s.id || '–'));
            var sub = [];
            if (s.organisation && s.label) sub.push(escapeHtml(s.organisation));
            if (s.code)    sub.push(codeFmt(s.code));
            if (s.version) sub.push('v' + escapeHtml(s.version));
            var urlSpan = s.url
                ? '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener noreferrer" class="info-link" title="Norm in neuem Tab öffnen">↗</a>'
                : '';
            return '' +
                '<li>' +
                    '<span class="info-set-name">' + escapeHtml(primary) + '</span>' +
                    (sub.length ? '<span class="info-set-label">' + sub.join(' · ') + '</span>' : '') +
                    urlSpan +
                '</li>';
        }).join('');
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Normen <span class="info-section-count">' + standards.length + '</span></div>' +
                '<ul class="info-set-list">' + items + '</ul>' +
            '</div>';
    }

    function roleLabel(v) {
        // Schema enum values for role_assignment.role (DATAMODEL.sql:498-509).
        switch (v) {
            case 'data_owner':                    return 'Data Owner';
            case 'local_data_steward':            return 'Local Data Steward';
            case 'local_data_steward_statistics': return 'Local Data Steward Statistik';
            case 'local_data_custodian':          return 'Local Data Custodian';
            case 'data_producer':                 return 'Data Producer';
            case 'data_consumer':                 return 'Data Consumer';
            case 'swiss_data_steward':            return 'Swiss Data Steward';
            case 'data_steward_statistics':       return 'Data Steward Statistik';
            case 'ida_representative':            return 'IDA Vertretung';
            case 'information_security_officer':  return 'ISO';
            default:                              return v;
        }
    }

    /** Small helpers used across the new Phase 2 sections. */
    function metaRow(label, valueHtml) {
        return '<dt>' + escapeHtml(label) + '</dt><dd>' + valueHtml + '</dd>';
    }
    function codeFmt(text) {
        return '<code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(text) + '</code>';
    }
    function urlFmt(url) {
        return '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener noreferrer" class="info-link">' +
                   escapeHtml(url) +
               '</a>';
    }
    function formatDate(iso) {
        if (!iso) return '';
        // ISO-8601 → DD.MM.YYYY (Swiss federal convention). Falls back to
        // the raw value on parse failure so we never silently drop info.
        var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? (m[3] + '.' + m[2] + '.' + m[1]) : String(iso);
    }

    /**
     * Free-text description block. Rendered consistently across every
     * entity kind (node, attribute, system, edge, pset) right after the
     * Metadaten section, so the user always knows where to look. Returns
     * empty string when the value is missing/blank — caller doesn't have
     * to gate.
     */
    function descriptionSectionHtml(text) {
        if (!text || !String(text).trim()) return '';
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Beschreibung</div>' +
                '<div class="info-description">' + escapeHtml(text) + '</div>' +
            '</div>';
    }

    /**
     * Small classification + lifecycle pills shown below the header
     * subtitle. Compact governance signal that surfaces the same fields
     * on every kind that has them. Returns empty string when neither
     * field is set — keeps headers clean.
     */
    function governancePillsHtml(node) {
        var pills = [];
        if (node.classification) {
            pills.push('<span class="info-pill info-pill--classification" data-value="' + escapeAttr(node.classification) + '">' +
                escapeHtml(classificationLabel(node.classification)) +
            '</span>');
        }
        if (node.lifecycle) {
            pills.push('<span class="info-pill info-pill--lifecycle" data-value="' + escapeAttr(node.lifecycle) + '">' +
                escapeHtml(lifecycleLabel(node.lifecycle)) +
            '</span>');
        }
        if (!pills.length) return '';
        return '<div class="info-header-pills">' + pills.join('') + '</div>';
    }

    function classificationLabel(v) {
        // Schema enum values → human-readable German. See node_classification_chk
        // in DATAMODEL.sql:147-148.
        switch (v) {
            case 'oeffentlich':  return 'Öffentlich';
            case 'intern':       return 'Intern';
            case 'vertraulich':  return 'Vertraulich';
            case 'geheim':       return 'Geheim';
            default:             return v;
        }
    }
    function lifecycleLabel(v) {
        // node_lifecycle_chk in DATAMODEL.sql:149-150.
        switch (v) {
            case 'entwurf':         return 'Entwurf';
            case 'standardisiert':  return 'Standardisiert';
            case 'produktiv':       return 'Produktiv';
            case 'abgeloest':       return 'Abgelöst';
            default:                return v;
        }
    }
    function edgeTypeLabel(v) {
        // edge_type_chk in DATAMODEL.sql:202-205.
        switch (v) {
            case 'publishes':     return 'veröffentlicht';
            case 'contains':      return 'enthält';
            case 'realises':      return 'realisiert';
            case 'in_pset':       return 'in Property Set';
            case 'values_from':   return 'Werte aus';
            case 'fk_references': return 'FK Referenz';
            case 'derives_from':  return 'abgeleitet aus';
            case 'flows_into':    return 'fliesst in';
            case 'replaces':      return 'ersetzt';
            default:              return v;
        }
    }

    function headerHtml(node) {
        var icon = typeIcon(node.type);
        var typeLabel = typeLabelOf(node.type);
        var sub = [escapeHtml(typeLabel)];
        if (node.system) sub.push(escapeHtml(node.system));
        if (node.schema) sub.push(escapeHtml(node.schema));
        return '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" data-type="' + escapeAttr(node.type || 'table') + '">' + icon + '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title">' + escapeHtml(node.label || node.id) + '</div>' +
                    '<div class="info-header-sub">' + sub.join(' · ') + '</div>' +
                    governancePillsHtml(node) +
                '</div>' +
                '<button class="info-header-close" data-action="close" title="Schliessen" aria-label="Panel schliessen">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</div>';
    }

    function metadataSectionHtml(node) {
        // Only render rows that have a value — empty/system/schema/tags get
        // dropped to reduce the "wall of dashes" look in the panel.
        var rows = [];
        rows.push('<dt>ID</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(node.id) + '</code></dd>');
        // DB UUID is the gen_random_uuid PK from the node table — useful
        // for direct DB lookups, audit / diagnostics, and external API
        // integration without slug round-trips. Falls back gracefully on
        // pre-migration-010 payloads (uuid absent → row skipped).
        if (node.uuid) {
            rows.push('<dt>UUID</dt><dd><code class="info-uuid" title="Datenbank-Schlüssel zum Kopieren">' + escapeHtml(node.uuid) + '</code></dd>');
        }
        rows.push('<dt>Typ</dt><dd>' + escapeHtml(typeLabelOf(node.type)) + '</dd>');
        if (node.system) rows.push('<dt>System</dt><dd>' + escapeHtml(node.system) + '</dd>');
        if (node.schema) rows.push('<dt>Schema</dt><dd>' + escapeHtml(node.schema) + '</dd>');
        if ((node.tags || []).length) {
            var tags = node.tags.map(function (t) {
                return '<span class="info-tag">' + escapeHtml(t) + '</span>';
            }).join('');
            rows.push('<dt>Tags</dt><dd>' + tags + '</dd>');
        }
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Metadaten</div>' +
                '<dl class="info-meta">' + rows.join('') + '</dl>' +
            '</div>';
    }

    function propertySetsSectionHtml(node) {
        var sets = State.derivePropertySets(node);
        if (!sets.length) return '';
        var cols = node.columns || [];
        var groupKey = State.getGroupKey(node);
        // Single-pass groupBy — per-set filter was O(sets × cols).
        var countsBySet = Object.create(null);
        for (var i = 0; i < cols.length; i++) {
            var k = cols[i][groupKey];
            if (k) countsBySet[k] = (countsBySet[k] || 0) + 1;
        }
        var items = sets.map(function (s) {
            var count = countsBySet[s.id] || 0;
            return '' +
                '<li data-action="focus-set" data-set="' + escapeAttr(s.id) + '" title="Im Diagramm hervorheben">' +
                    '<span class="info-set-name">' + escapeHtml(s.label) + '</span>' +
                    '<span class="info-set-count">' + count + '</span>' +
                '</li>';
        }).join('');
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Property Sets <span class="info-section-count">' + sets.length + '</span></div>' +
                '<ul class="info-set-list">' + items + '</ul>' +
            '</div>';
    }

    function attributesSectionHtml(node) {
        var cols = node.columns || [];
        if (!cols.length) {
            return '' +
                '<div class="info-section">' +
                    '<div class="info-section-label">Attribute</div>' +
                    '<div style="font-size:var(--text-small);color:var(--color-text-placeholder)">Keine Attribute</div>' +
                '</div>';
        }
        // Single pass — was four separate filter() calls over the same array.
        var pkCount = 0, fkCount = 0, ukCount = 0, ungrouped = 0;
        var groupKey = State.getGroupKey(node);
        for (var i = 0; i < cols.length; i++) {
            var c = cols[i];
            if (c.key === 'PK') pkCount++;
            else if (c.key === 'FK') fkCount++;
            else if (c.key === 'UK') ukCount++;
            if (!c[groupKey]) ungrouped++;
        }
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Attribute <span class="info-section-count">' + cols.length + '</span></div>' +
                '<div class="info-key-stats">' +
                    statHtml('pk', pkCount, 'PK') +
                    statHtml('fk', fkCount, 'FK') +
                    statHtml('uk', ukCount, 'UK') +
                    (ungrouped ? '<div class="info-key-stat"><span style="color:var(--color-text-placeholder)">' + ungrouped + ' ohne Set</span></div>' : '') +
                '</div>' +
            '</div>';
    }

    function statHtml(cls, n, label) {
        if (!n) return '';
        return '<div class="info-key-stat"><span class="info-key-badge ' + cls + '">' + label + '</span> ' + n + '</div>';
    }

    function relationsSectionHtml(node) {
        var edges = State.getEdges();
        var outgoing = edges.filter(function (e) { return e.from === node.id; });
        var incoming = edges.filter(function (e) { return e.to === node.id; });
        // Synthetic "publishes" row for the node's system. The DB stores
        // a real `publishes` edge, but the RPC consumes it into the
        // string `node.system` instead of returning it in edges[]. The
        // graph view re-synthesises a visual edge from that string;
        // we do the same here so the relationship is clickable in the
        // panel too. See "Why isn't the system in Beziehungen?".
        var hasSystem = !!node.system;
        var totalRows = outgoing.length + incoming.length + (hasSystem ? 1 : 0);
        if (!totalRows) {
            return '' +
                '<div class="info-section">' +
                    '<div class="info-section-label">Beziehungen</div>' +
                    '<div style="font-size:var(--text-small);color:var(--color-text-placeholder)">Keine Beziehungen</div>' +
                '</div>';
        }
        var sysRow = hasSystem ? systemRelRowHtml(node.system) : '';
        var out = outgoing.map(function (e) {
            return relRowHtml(e, '→', e.to);
        }).join('');
        var inc = incoming.map(function (e) {
            return relRowHtml(e, '←', e.from);
        }).join('');
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Beziehungen <span class="info-section-count">' + totalRows + '</span></div>' +
                '<ul class="info-rel-list">' + sysRow + out + inc + '</ul>' +
            '</div>';
    }

    /**
     * Synthetic "← <system> · System" row, rendered at the top of the
     * Beziehungen list. Click handler is `select-system` (existing path
     * in onContentClick) so the user can drill from a node into its
     * system panel without going through the Metadaten field.
     */
    function systemRelRowHtml(systemName) {
        return '' +
            '<li data-action="select-system" data-system="' + escapeAttr(systemName) + '" title="System anzeigen">' +
                '<span class="info-rel-arrow">←</span>' +
                '<span class="info-rel-target">' + escapeHtml(systemName) + '</span>' +
                '<span class="info-rel-label">System</span>' +
            '</li>';
    }

    function relRowHtml(edge, arrow, otherId) {
        var other = State.getNode(otherId);
        var label = other ? (other.label || other.id) : otherId;
        var rel = edge.label ? ('<span class="info-rel-label">' + escapeHtml(edge.label) + '</span>') : '';
        return '' +
            '<li data-action="select-node" data-node-id="' + escapeAttr(otherId) + '" title="Knoten anzeigen">' +
                '<span class="info-rel-arrow">' + arrow + '</span>' +
                '<span class="info-rel-target">' + escapeHtml(label) + '</span>' +
                rel +
            '</li>';
    }

    // ---- Edge content --------------------------------------------------

    function edgeContentHtml(edge) {
        var fromNode = State.getNode(edge.from);
        var toNode = State.getNode(edge.to);
        var fromLabel = fromNode ? (fromNode.label || fromNode.id) : edge.from;
        var toLabel   = toNode   ? (toNode.label   || toNode.id)   : edge.to;
        var headerLabel = edge.label || '(unbenannte Beziehung)';
        // Sub-line: "Beziehung · fliesst in" — gives the edge type
        // immediate visibility without a metadata-row hunt.
        var subParts = ['Beziehung'];
        if (edge.edgeType) subParts.push(edgeTypeLabel(edge.edgeType));

        var arrowSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

        var endpointRow = function (label, nodeId, node) {
            var typeBadge = node
                ? '<span class="info-set-label">' + escapeHtml(node.system || typeLabel(node.type)) + '</span>'
                : '<span class="info-set-label" style="color:var(--color-text-placeholder)">unbekannt</span>';
            return '<li data-action="select-node" data-node-id="' + escapeAttr(nodeId) + '" title="Knoten anzeigen">' +
                    '<span class="info-set-name">' + escapeHtml(label) + '</span>' +
                    typeBadge +
                '</li>';
        };

        // Metadaten — surface every field the RPC carries, only rendering
        // rows that have a value (mirrors the node panel's no-empty-rows
        // approach so the section stays compact when fields are blank).
        var metaRows = [];
        metaRows.push('<dt>ID</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(edge.id) + '</code></dd>');
        metaRows.push('<dt>Label</dt><dd>' + (edge.label ? escapeHtml(edge.label) : '<span style="color:var(--color-text-placeholder)">–</span>') + '</dd>');
        if (edge.edgeType)    metaRows.push('<dt>Typ</dt><dd>' + escapeHtml(edgeTypeLabel(edge.edgeType)) + '</dd>');
        if (edge.cardinality) metaRows.push('<dt>Kardinalität</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(edge.cardinality) + '</code></dd>');

        return '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" style="background:var(--color-bg-accent);color:var(--color-bg-accent-strong)">' +
                    arrowSvg +
                '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title">' + escapeHtml(headerLabel) + '</div>' +
                    '<div class="info-header-sub">' + subParts.join(' · ') + '</div>' +
                '</div>' +
                '<button class="info-header-close" data-action="close" title="Schliessen" aria-label="Panel schliessen">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="info-section">' +
                '<div class="info-section-label">Metadaten</div>' +
                '<dl class="info-meta">' + metaRows.join('') + '</dl>' +
            '</div>' +
            descriptionSectionHtml(edge.note) +
            '<div class="info-section">' +
                '<div class="info-section-label">Quelle</div>' +
                '<ul class="info-set-list">' + endpointRow(fromLabel, edge.from, fromNode) + '</ul>' +
            '</div>' +
            '<div class="info-section">' +
                '<div class="info-section-label">Ziel</div>' +
                '<ul class="info-set-list">' + endpointRow(toLabel, edge.to, toNode) + '</ul>' +
            '</div>';
    }

    // ---- System content ------------------------------------------------

    // ---- Datenpaket (Property Set) content -----------------------------

    /**
     * Detail panel for a global Datenpaket — label, description, lineage,
     * plus a usage breakdown showing every node that references the set
     * with its column count. The "Alle Attribute anzeigen" link bridges
     * to the Attribute tab pre-filtered by the package's label, so the
     * user can drill from "this is the Adresse package" → "show me every
     * field across the catalog tagged as Adresse" in one tap.
     *
     * Single pass over nodes/columns: we count both unique nodes and
     * total columns referencing this setId, plus collect a sorted list
     * of (node, count) for the usage section.
     */
    function setContentHtml(setObj) {
        var nodes = State.getNodes();
        var byNode = []; // [{ node, count }]
        var totalCols = 0;
        nodes.forEach(function (n) {
            var c = 0;
            (n.columns || []).forEach(function (col) { if (col.setId === setObj.id) c += 1; });
            if (c > 0) {
                byNode.push({ node: n, count: c });
                totalCols += c;
            }
        });
        byNode.sort(function (a, b) {
            // System grouping first, then column-count desc, then label.
            var ca = (a.node.system || '').localeCompare(b.node.system || '');
            if (ca !== 0) return ca;
            if (b.count !== a.count) return b.count - a.count;
            return (a.node.label || a.node.id).localeCompare(b.node.label || b.node.id);
        });

        var packageIcon =
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
                '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>' +
                '<line x1="12" y1="22.08" x2="12" y2="12"/>' +
            '</svg>';

        var headerHtml = '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" style="background:var(--color-bg-accent);color:var(--color-bg-accent-strong)">' +
                    packageIcon +
                '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title">' + escapeHtml(setObj.label || setObj.id) + '</div>' +
                    '<div class="info-header-sub">Datenpaket · ' + byNode.length + ' Knoten · ' + totalCols + ' Attribute</div>' +
                '</div>' +
                '<button class="info-header-close" data-action="close" title="Schliessen" aria-label="Panel schliessen">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</div>';

        // Metadata section — only render rows that have a value, like the
        // node panel does. The Beschreibung block is now its own section
        // (via descriptionSectionHtml) so it sits in the same slot across
        // every panel kind, instead of being mixed into Metadaten.
        var metaRows = [];
        metaRows.push('<dt>ID</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(setObj.id) + '</code></dd>');
        if (setObj.uuid) {
            metaRows.push('<dt>UUID</dt><dd><code class="info-uuid" title="Datenbank-Schlüssel zum Kopieren">' + escapeHtml(setObj.uuid) + '</code></dd>');
        }
        if (setObj.lineage) {
            metaRows.push('<dt>Quelle</dt><dd>' + escapeHtml(setObj.lineage) + '</dd>');
        }
        var metadataSection = '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Metadaten</div>' +
                '<dl class="info-meta">' + metaRows.join('') + '</dl>' +
            '</div>' +
            descriptionSectionHtml(setObj.description);

        // Usage section — list of nodes referencing this set.
        var usageHtml;
        if (!byNode.length) {
            usageHtml =
                '<div style="font-size:var(--text-small);color:var(--color-text-placeholder)">' +
                    'Dieses Datenpaket ist aktuell keinem Attribut zugeordnet.' +
                '</div>';
        } else {
            var attrLink = '' +
                '<button type="button" class="info-link-btn" data-action="show-set-attributes"' +
                    ' data-set-id="' + escapeAttr(setObj.id) + '"' +
                    ' data-set-label="' + escapeAttr(setObj.label || setObj.id) + '"' +
                    ' title="Alle Attribute dieses Datenpakets in der Tabellenansicht anzeigen">' +
                    'Alle ' + totalCols + ' Attribute anzeigen →' +
                '</button>';
            usageHtml =
                '<ul class="info-rel-list">' +
                    byNode.map(function (r) {
                        var sub = r.node.system ? escapeHtml(r.node.system) : '';
                        return '<li data-action="select-node" data-node-id="' + escapeAttr(r.node.id) + '" title="Knoten anzeigen">' +
                            '<span class="info-set-name">' + escapeHtml(r.node.label || r.node.id) + '</span>' +
                            (sub ? '<span class="info-set-label">' + sub + '</span>' : '') +
                            '<span class="info-set-count">' + r.count + '</span>' +
                        '</li>';
                    }).join('') +
                '</ul>' + attrLink;
        }

        return headerHtml +
            metadataSection +
            processingSectionHtml(setObj.processing) +
            '<div class="info-section">' +
                '<div class="info-section-label">Verwendung <span class="info-section-count">' + byNode.length + '</span></div>' +
                usageHtml +
            '</div>';
    }

    /**
     * DSG Art. 12 "Verzeichnis der Bearbeitungstätigkeiten" block. Renders
     * only when the pset has a processing_activity row in the DB; field
     * order follows the legal template (Zweck → Rechtsgrundlage → …).
     * Boolean fields (cross-border transfer, DPIA required) only render
     * when explicitly true since "false" is the default and clutters.
     */
    function processingSectionHtml(p) {
        if (!p) return '';
        var rows = [];
        if (p.purpose)         rows.push(metaRow('Zweck',           escapeHtml(p.purpose)));
        if (p.legalBasis)      rows.push(metaRow('Rechtsgrundlage', escapeHtml(p.legalBasis)));
        if (p.dataSubjects)    rows.push(metaRow('Betroffene',      escapeHtml(p.dataSubjects)));
        if (p.recipients)      rows.push(metaRow('Empfänger',       escapeHtml(p.recipients)));
        if (p.retentionPolicy) rows.push(metaRow('Aufbewahrung',    escapeHtml(p.retentionPolicy)));
        if (p.crossBorderTransfer) {
            var countries = (p.transferCountries && p.transferCountries.length)
                ? ' <span style="color:var(--color-text-secondary)">(' + escapeHtml(p.transferCountries.join(', ')) + ')</span>'
                : '';
            rows.push(metaRow('Auslandtransfer', 'Ja' + countries));
        }
        if (p.dpiaRequired) {
            var dpia = p.dpiaUrl
                ? '<a href="' + escapeAttr(p.dpiaUrl) + '" target="_blank" rel="noopener noreferrer" class="info-link">DSFA-Bericht ↗</a>'
                : 'Ja';
            rows.push(metaRow('DSFA erforderlich', dpia));
        }
        if (!rows.length) return '';
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Datenschutz</div>' +
                '<dl class="info-meta">' + rows.join('') + '</dl>' +
            '</div>';
    }

    function systemContentHtml(sysName) {
        var members = State.getNodes().filter(function (n) { return n.system === sysName; });
        var edges = State.getEdges();
        var memberIds = {};
        members.forEach(function (n) { memberIds[n.id] = true; });
        // Phase 2: per-system metadata from systems[] (technology stack,
        // base URL, security zone, …). Null when the canvas doesn't carry
        // a system_meta row for this label — we still render the synthesised
        // member overview, just without the technical details section.
        var sysMeta = (State.getSystemMeta && State.getSystemMeta(sysName)) || null;

        var setCount = 0;
        var colCount = 0;
        var pkCount = 0;
        var typeCounts = {};
        var tagSet = {};
        members.forEach(function (n) {
            setCount += State.derivePropertySets(n).length;
            colCount += (n.columns || []).length;
            (n.columns || []).forEach(function (c) { if (c.key === 'PK') pkCount += 1; });
            typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
            (n.tags || []).forEach(function (t) { tagSet[t] = true; });
        });

        var typeBreakdown = Object.keys(typeCounts).map(function (t) {
            var n = typeCounts[t];
            return n + ' ' + (n === 1 ? typeLabelOf(t) : typeLabelPluralOf(t));
        }).join(', ');

        var tagsHtml = Object.keys(tagSet).sort().map(function (t) {
            return '<span class="info-tag">' + escapeHtml(t) + '</span>';
        }).join('') || '<span style="color:var(--color-text-placeholder)">–</span>';

        var external = edges.filter(function (e) {
            var fromIn = memberIds[e.from], toIn = memberIds[e.to];
            return fromIn !== toIn; // exactly one endpoint inside the system
        });
        var externalHtml = external.length
            ? '<ul class="info-rel-list">' + external.map(function (e) {
                var fromIn = memberIds[e.from];
                var arrow = fromIn ? '→' : '←';
                var otherId = fromIn ? e.to : e.from;
                var other = State.getNode(otherId);
                var otherLabel = other ? (other.label || other.id) : otherId;
                var rel = e.label ? ('<span class="info-rel-label">' + escapeHtml(e.label) + '</span>') : '';
                return '<li data-action="select-node" data-node-id="' + escapeAttr(otherId) + '">' +
                    '<span class="info-rel-arrow">' + arrow + '</span>' +
                    '<span class="info-rel-target">' + escapeHtml(otherLabel) + '</span>' +
                    rel +
                '</li>';
            }).join('') + '</ul>'
            : '<div style="font-size:var(--text-small);color:var(--color-text-placeholder)">Keine externen Beziehungen</div>';

        // Technical-details section from system_meta. Each row only renders
        // when the underlying field is set, so an empty system_meta row
        // collapses the whole section away.
        var techRows = [];
        if (sysMeta) {
            if (sysMeta.technologyStack) techRows.push(metaRow('Technologie',  escapeHtml(sysMeta.technologyStack)));
            if (sysMeta.baseUrl)         techRows.push(metaRow('Base URL',     urlFmt(sysMeta.baseUrl)));
            if (sysMeta.securityZone)    techRows.push(metaRow('Sicherheitszone', escapeHtml(sysMeta.securityZone)));
            if (sysMeta.isActive === false) {
                techRows.push(metaRow('Status', '<span style="color:var(--color-text-placeholder)">Inaktiv</span>'));
            }
        }
        var techSection = techRows.length
            ? '<div class="info-section">' +
                  '<div class="info-section-label">Technik</div>' +
                  '<dl class="info-meta">' + techRows.join('') + '</dl>' +
              '</div>'
            : '';

        // System-level governance pills mirror the node header layout.
        var sysPills = sysMeta ? governancePillsHtml({
            classification: sysMeta.classification,
            lifecycle:      sysMeta.lifecycle
        }) : '';

        return '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" style="background:var(--color-bg-accent);color:var(--color-bg-accent-strong)">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
                '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title">' + escapeHtml(sysName) + '</div>' +
                    '<div class="info-header-sub">System · ' + members.length + ' Knoten · ' + colCount + ' Attribute</div>' +
                    sysPills +
                '</div>' +
                '<button class="info-header-close" data-action="close" title="Schliessen" aria-label="Panel schliessen">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</div>' +
            descriptionSectionHtml(sysMeta && sysMeta.description) +
            '<div class="info-section">' +
                // Renamed from "Übersicht" to "Metadaten" so every panel
                // kind (node, attribute, system, edge, pset) uses the
                // same section name for its primary metadata block.
                '<div class="info-section-label">Metadaten</div>' +
                '<dl class="info-meta">' +
                    (sysMeta && sysMeta.id    ? '<dt>ID</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(sysMeta.id)   + '</code></dd>' : '') +
                    (sysMeta && sysMeta.uuid  ? '<dt>UUID</dt><dd><code class="info-uuid" title="Datenbank-Schlüssel zum Kopieren">' + escapeHtml(sysMeta.uuid) + '</code></dd>' : '') +
                    '<dt>Knoten</dt><dd>' + members.length + (typeBreakdown ? ' <span style="color:var(--color-text-secondary)">(' + escapeHtml(typeBreakdown) + ')</span>' : '') + '</dd>' +
                    '<dt>Sets</dt><dd>' + setCount + '</dd>' +
                    '<dt>Attribute</dt><dd>' + colCount + (pkCount ? ' <span style="color:var(--color-text-secondary)">· PK: ' + pkCount + '</span>' : '') + '</dd>' +
                    '<dt>Tags</dt><dd>' + tagsHtml + '</dd>' +
                '</dl>' +
            '</div>' +
            techSection +
            rolesSectionHtml(sysMeta && sysMeta.roles) +
            standardsSectionHtml(sysMeta && sysMeta.standards) +
            '<div class="info-section">' +
                // Renamed from "Externe Beziehungen" → just "Beziehungen"
                // for consistency with the node panel's section name.
                // The "external" qualifier is now communicated by the
                // section's content (only crossing edges are shown).
                '<div class="info-section-label">Beziehungen <span class="info-section-count">' + external.length + '</span></div>' +
                externalHtml +
            '</div>';
    }

    // ---- Attribute content ---------------------------------------------

    /**
     * Resolve the codelist node referenced by this attribute, if any.
     * Convention (mirrors canvas.js buildCodelistRefsIndex): an FK edge
     * from the attribute's node to a codelist node, with edge.label
     * matching the column name. Last write wins when multiple match.
     */
    function findCodelistForAttribute(node, col) {
        if (!node || !col || !col.name) return null;
        var edges = State.getEdges();
        var hit = null;
        for (var i = 0; i < edges.length; i++) {
            var e = edges[i];
            if (e.from !== node.id) continue;
            if (e.label !== col.name) continue;
            var target = State.getNode(e.to);
            if (target && target.type === 'codelist') hit = target;
        }
        return hit;
    }

    function codelistValuesSectionHtml(codelist) {
        var rows = (codelist.columns || []).map(function (entry) {
            var code  = entry.name || '';
            var label = entry.type || '';
            return '<li>' +
                '<span class="info-set-name">' + escapeHtml(code) + '</span>' +
                '<span class="info-set-label">' + escapeHtml(label) + '</span>' +
            '</li>';
        }).join('');

        var titleLink =
            '<a class="info-link" data-action="select-node" data-node-id="' +
                escapeAttr(codelist.id) + '" href="#">' +
                escapeHtml(codelist.label || codelist.id) +
            '</a>';

        return '<div class="info-section">' +
            '<div class="info-section-label">' +
                'Werteliste · ' + titleLink +
                '<span class="info-section-count">' + (codelist.columns || []).length + '</span>' +
            '</div>' +
            (rows
                ? '<ul class="info-set-list info-codelist-list">' + rows + '</ul>'
                : '<div class="info-empty">Keine Werte</div>') +
        '</div>';
    }

    function attributeContentHtml(node, col) {
        var keyClass = col.key === 'PK' ? 'pk' : col.key === 'FK' ? 'fk' : col.key === 'UK' ? 'uk' : '';
        var keyBadge = col.key
            ? '<span class="info-key-badge ' + keyClass + '" style="margin-right:8px">' + escapeHtml(col.key) + '</span>'
            : '<span class="info-key-badge" style="margin-right:8px;background:var(--color-bg-page);color:var(--color-text-placeholder)">–</span>';

        // Set label resolution: setId via the registry; fall back to
        // sourceStructure (raw SAP key) for API-node columns. This is what
        // the "Property Set" sub-line shows under the column name.
        var setLabel = col.setId ? State.getSetLabel(col.setId)
                     : col.sourceStructure || '';

        var subParts = [];
        if (col.type) subParts.push(escapeHtml(col.type));
        if (setLabel) subParts.push(escapeHtml(setLabel));
        subParts.push(escapeHtml(node.label || node.id));

        // Cross-references: same column name in other nodes
        var cross = [];
        State.getNodes().forEach(function (n) {
            if (n.id === node.id) return;
            (n.columns || []).forEach(function (c) {
                if (c.name === col.name) {
                    cross.push({ node: n, col: c });
                }
            });
        });

        var crossHtml = cross.length
            ? '<ul class="info-set-list">' + cross.map(function (r) {
                var rSetLabel = r.col.setId ? State.getSetLabel(r.col.setId)
                              : r.col.sourceStructure || '';
                return '<li data-action="select-attr" data-node-id="' + escapeAttr(r.node.id) + '" data-attr-name="' + escapeAttr(r.col.name) + '">' +
                    '<span class="info-set-name">' + escapeHtml(r.node.label || r.node.id) + '</span>' +
                    '<span class="info-set-label">' + escapeHtml(r.col.type || '') + (rSetLabel ? ' · ' + escapeHtml(rSetLabel) : '') + '</span>' +
                    (r.col.key ? '<span class="info-key-badge ' + (r.col.key === 'PK' ? 'pk' : r.col.key === 'FK' ? 'fk' : 'uk') + '">' + escapeHtml(r.col.key) + '</span>' : '') +
                '</li>';
            }).join('') + '</ul>'
            : '';

        var systemSection = node.system
            ? '<dt>System</dt><dd><a class="info-link" data-action="select-system" data-system="' + escapeAttr(node.system) + '" href="#">' + escapeHtml(node.system) + '</a></dd>'
            : '<dt>System</dt><dd><span style="color:var(--color-text-placeholder)">–</span></dd>';

        // PII pill in the header — DSG-relevant flag, surfaced loud since
        // catalog users need to know at a glance whether an attribute
        // carries personal data. Also rendered as a Metadaten row below
        // so the value is searchable + addressable.
        var piiPill = col.pii
            ? '<div class="info-header-pills"><span class="info-pill info-pill--pii" data-value="' + escapeAttr(col.pii) + '">' +
                escapeHtml(piiLabel(col.pii)) +
              '</span></div>'
            : '';

        return '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" style="background:var(--color-bg-page);color:var(--color-text-secondary);font-family:var(--font-mono);font-size:10px;font-weight:600">' +
                    (col.key || '·') +
                '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title" style="font-family:var(--font-mono);font-size:var(--text-mono)">' + keyBadge + escapeHtml(col.name) + '</div>' +
                    '<div class="info-header-sub">' + subParts.join(' · ') + '</div>' +
                    piiPill +
                '</div>' +
                '<button class="info-header-close" data-action="close" title="Schliessen">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="info-section">' +
                '<div class="info-section-label">Metadaten</div>' +
                '<dl class="info-meta">' +
                    '<dt>Name</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(col.name) + '</code></dd>' +
                    '<dt>Typ</dt><dd>' + (col.type ? '<code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(col.type) + '</code>' : '<span style="color:var(--color-text-placeholder)">–</span>') + '</dd>' +
                    '<dt>Schlüssel</dt><dd>' + (col.key ? '<span class="info-key-badge ' + keyClass + '">' + escapeHtml(col.key) + '</span>' : '<span style="color:var(--color-text-placeholder)">–</span>') + '</dd>' +
                    (col.nullable === true || col.nullable === false
                        ? '<dt>Nullable</dt><dd>' + (col.nullable ? 'Ja' : 'Nein') + '</dd>'
                        : '') +
                    (col.pii
                        ? '<dt>Personenbezug</dt><dd>' + escapeHtml(piiLabel(col.pii)) + '</dd>'
                        : '') +
                    '<dt>Property Set</dt><dd>' + setPickerOrLabelHtml(node, col) + '</dd>' +
                    (col.sourceStructure
                        ? '<dt>SAP-Struktur</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(col.sourceStructure) + '</code></dd>'
                        : '') +
                '</dl>' +
            '</div>' +
            descriptionSectionHtml(col.description) +
            '<div class="info-section">' +
                '<div class="info-section-label">Kontext</div>' +
                '<dl class="info-meta">' +
                    '<dt>Knoten</dt><dd><a class="info-link" data-action="select-node" data-node-id="' + escapeAttr(node.id) + '" href="#">' + escapeHtml(node.label || node.id) + '</a></dd>' +
                    systemSection +
                '</dl>' +
            '</div>' +
            (cross.length
                ? '<div class="info-section"><div class="info-section-label">Gleicher Name in anderen Knoten <span class="info-section-count">' + cross.length + '</span></div>' + crossHtml + '</div>'
                : ''
            ) +
            // Werteliste — render the FK-target codelist's code/label pairs
            // inline so the user doesn't have to hop to the codelist node
            // to know what values the attribute can take.
            (function () {
                var cl = findCodelistForAttribute(node, col);
                return cl ? codelistValuesSectionHtml(cl) : '';
            })();
    }

    function piiLabel(v) {
        // Schema enum values for attribute_meta.personal_data_category.
        // Common CH/Swiss DSG taxonomy: keine | personenbezogen |
        // besonders schuetzenswert. Falls through to raw value for any
        // free-text variants in legacy data.
        switch (v) {
            case 'keine':                       return 'Keine';
            case 'personenbezogen':             return 'Personenbezogen';
            case 'besonders_schuetzenswert':    return 'Besonders schützenswert';
            case 'besonders schützenswert':     return 'Besonders schützenswert';
            default:                            return v;
        }
    }

    function typeLabel(t) {
        // Kept for back-compat with internal callers; delegates to Util.
        return t ? typeLabelOf(t) : '–';
    }

    /**
     * Edit-mode set picker for a column attribute. View-mode falls back to
     * the static label. The SAP API node's columns are grouped by
     * sourceStructure (a per-node concept) so the global-registry picker
     * doesn't apply there — show the static label instead.
     */
    function setPickerOrLabelHtml(node, col) {
        var inEdit = State.getMode() === 'edit';
        var groupKey = State.getGroupKey(node);
        if (!inEdit || groupKey !== 'setId') {
            return col.setId
                ? escapeHtml(State.getSetLabel(col.setId))
                : '<span style="color:var(--color-text-placeholder)">–</span>';
        }
        var sets = State.getSets();
        var optsHtml = '<option value="">(kein Set)</option>' +
            sets.map(function (s) {
                var sel = (s.id === col.setId) ? ' selected' : '';
                return '<option value="' + escapeAttr(s.id) + '"' + sel + '>' + escapeHtml(s.label) + '</option>';
            }).join('');
        return '<select class="info-meta-select" data-edit="setId"' +
            ' data-node-id="' + escapeAttr(node.id) + '"' +
            ' data-col-name="' + escapeAttr(col.name) + '">' + optsHtml + '</select>';
    }

    // ---- Click delegation ----------------------------------------------

    function onContentClick(e) {
        var closeBtn = e.target.closest('[data-action="close"]');
        if (closeBtn) {
            State.clearSelection();
            return;
        }
        var nodeRow = e.target.closest('[data-action="select-node"]');
        if (nodeRow) {
            e.preventDefault();
            var id = nodeRow.getAttribute('data-node-id');
            if (id) {
                State.setSelected(id);
                if (State.getView() === 'diagram') {
                    requestAnimationFrame(function () {
                        window.CanvasApp.Canvas.fitToScreen();
                    });
                }
            }
            return;
        }
        var sysRow = e.target.closest('[data-action="select-system"]');
        if (sysRow) {
            e.preventDefault();
            var sys = sysRow.getAttribute('data-system');
            if (sys) State.setSelectedSystem(sys);
            return;
        }
        var attrRow = e.target.closest('[data-action="select-attr"]');
        if (attrRow) {
            e.preventDefault();
            var anId = attrRow.getAttribute('data-node-id');
            var anName = attrRow.getAttribute('data-attr-name');
            if (anId && anName) State.setSelectedAttribute(anId, anName);
            return;
        }
        var setRow = e.target.closest('[data-action="focus-set"]');
        if (setRow) {
            // Selecting a property-set row from the node panel opens the
            // Datenpaket detail in this same panel.
            var sId = setRow.getAttribute('data-set');
            if (sId) State.setSelectedSet(sId);
            return;
        }
        var showAttrs = e.target.closest('[data-action="show-set-attributes"]');
        if (showAttrs) {
            e.preventDefault();
            var label = showAttrs.getAttribute('data-set-label');
            if (window.CanvasApp.Table && window.CanvasApp.Table.showAttributesFor) {
                window.CanvasApp.Table.showAttributesFor(label);
            }
            return;
        }
    }

    function onContentChange(e) {
        var el = e.target;
        if (!el || !el.matches || !el.matches('select[data-edit="setId"]')) return;
        var nodeId = el.getAttribute('data-node-id');
        var colName = el.getAttribute('data-col-name');
        var node = State.getNode(nodeId);
        if (!node) return;
        var idx = (node.columns || []).findIndex(function (c) { return c.name === colName; });
        if (idx === -1) return;
        var newCols = node.columns.slice();
        var newCol = Object.assign({}, newCols[idx]);
        if (el.value) newCol.setId = el.value;
        else delete newCol.setId;
        newCols[idx] = newCol;
        State.updateNode(nodeId, { columns: newCols });
    }

    // ---- Util ----------------------------------------------------------

    var escapeHtml = window.CanvasApp.Util.escapeHtml;
    var escapeAttr = window.CanvasApp.Util.escapeAttr;

    return { init: init, render: render };
})();
