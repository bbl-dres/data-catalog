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

    var TYPE_LABELS = {
        table: 'Tabelle', view: 'View', api: 'API', file: 'Datei', codelist: 'Werteliste'
    };
    var TYPE_LABELS_PLURAL = {
        table: 'Tabellen', view: 'Views', api: 'APIs', file: 'Dateien', codelist: 'Wertelisten'
    };
    var TYPE_ICONS = {
        table: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="5.5" y1="5.5" x2="5.5" y2="14.5"/></svg>',
        view:  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>',
        api:   '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 1.5L2 9.5h6l-1 5L13.5 6.5h-6l1-5z"/></svg>',
        file:  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H3.5a1 1 0 0 0-1 1V13.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L9 1.5z"/><polyline points="9 1.5 9 6 13.5 6"/></svg>',
        codelist: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="13" y2="3"/><line x1="6" y1="8" x2="13" y2="8"/><line x1="6" y1="13" x2="13" y2="13"/><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="3" cy="13" r="1.2" fill="currentColor"/></svg>'
    };

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

        State.on(function (reason) {
            if (reason === 'view') {
                document.body.setAttribute('data-view', State.getView());
                updateOpenState();
                return;
            }
            if (reason === 'selection' || reason === 'nodes' || reason === 'edges' ||
                reason === 'replace' || reason === 'reset') {
                render();
            }
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
            var next = clampWidth(startWidth + delta);
            applyPanelWidth(next);
        });

        function endDrag(e) {
            if (!dragging) return;
            dragging = false;
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
        return headerHtml(node) +
               metadataSectionHtml(node) +
               propertySetsSectionHtml(node) +
               attributesSectionHtml(node) +
               relationsSectionHtml(node);
    }

    function headerHtml(node) {
        var icon = TYPE_ICONS[node.type] || TYPE_ICONS.table;
        var typeLabel = TYPE_LABELS[node.type] || node.type || 'Tabelle';
        var sub = [escapeHtml(typeLabel)];
        if (node.system) sub.push(escapeHtml(node.system));
        if (node.schema) sub.push(escapeHtml(node.schema));
        return '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" data-type="' + escapeAttr(node.type || 'table') + '">' + icon + '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title">' + escapeHtml(node.label || node.id) + '</div>' +
                    '<div class="info-header-sub">' + sub.join(' · ') + '</div>' +
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
        rows.push('<dt>Typ</dt><dd>' + escapeHtml(TYPE_LABELS[node.type] || node.type || 'Tabelle') + '</dd>');
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
        if (!outgoing.length && !incoming.length) {
            return '' +
                '<div class="info-section">' +
                    '<div class="info-section-label">Beziehungen</div>' +
                    '<div style="font-size:var(--text-small);color:var(--color-text-placeholder)">Keine Beziehungen</div>' +
                '</div>';
        }
        var out = outgoing.map(function (e) {
            return relRowHtml(e, '→', e.to);
        }).join('');
        var inc = incoming.map(function (e) {
            return relRowHtml(e, '←', e.from);
        }).join('');
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Beziehungen <span class="info-section-count">' + (outgoing.length + incoming.length) + '</span></div>' +
                '<ul class="info-rel-list">' + out + inc + '</ul>' +
            '</div>';
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

        return '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" style="background:var(--color-bg-accent);color:var(--color-bg-accent-strong)">' +
                    arrowSvg +
                '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title">' + escapeHtml(headerLabel) + '</div>' +
                    '<div class="info-header-sub">Beziehung</div>' +
                '</div>' +
                '<button class="info-header-close" data-action="close" title="Schliessen" aria-label="Panel schliessen">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="info-section">' +
                '<div class="info-section-label">Metadaten</div>' +
                '<dl class="info-meta">' +
                    '<dt>ID</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(edge.id) + '</code></dd>' +
                    '<dt>Label</dt><dd>' + (edge.label ? escapeHtml(edge.label) : '<span style="color:var(--color-text-placeholder)">–</span>') + '</dd>' +
                '</dl>' +
            '</div>' +
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
        // node panel does.
        var metaRows = [];
        metaRows.push('<dt>ID</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(setObj.id) + '</code></dd>');
        if (setObj.description) {
            metaRows.push('<dt>Beschreibung</dt><dd>' + escapeHtml(setObj.description) + '</dd>');
        }
        if (setObj.lineage) {
            metaRows.push('<dt>Quelle</dt><dd>' + escapeHtml(setObj.lineage) + '</dd>');
        }
        var metadataSection = '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Metadaten</div>' +
                '<dl class="info-meta">' + metaRows.join('') + '</dl>' +
            '</div>';

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
            '<div class="info-section">' +
                '<div class="info-section-label">Verwendung <span class="info-section-count">' + byNode.length + '</span></div>' +
                usageHtml +
            '</div>';
    }

    function systemContentHtml(sysName) {
        var members = State.getNodes().filter(function (n) { return n.system === sysName; });
        var edges = State.getEdges();
        var memberIds = {};
        members.forEach(function (n) { memberIds[n.id] = true; });

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
            return n + ' ' + (n === 1 ? typeLabel(t) : (TYPE_LABELS_PLURAL[t] || typeLabel(t)));
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

        return '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" style="background:var(--color-bg-accent);color:var(--color-bg-accent-strong)">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
                '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title">' + escapeHtml(sysName) + '</div>' +
                    '<div class="info-header-sub">System · ' + members.length + ' Knoten · ' + colCount + ' Attribute</div>' +
                '</div>' +
                '<button class="info-header-close" data-action="close" title="Schliessen" aria-label="Panel schliessen">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="info-section">' +
                '<div class="info-section-label">Übersicht</div>' +
                '<dl class="info-meta">' +
                    '<dt>Knoten</dt><dd>' + members.length + (typeBreakdown ? ' <span style="color:var(--color-text-secondary)">(' + escapeHtml(typeBreakdown) + ')</span>' : '') + '</dd>' +
                    '<dt>Sets</dt><dd>' + setCount + '</dd>' +
                    '<dt>Attribute</dt><dd>' + colCount + (pkCount ? ' <span style="color:var(--color-text-secondary)">· PK: ' + pkCount + '</span>' : '') + '</dd>' +
                    '<dt>Tags</dt><dd>' + tagsHtml + '</dd>' +
                '</dl>' +
            '</div>' +
            '<div class="info-section">' +
                '<div class="info-section-label">Externe Beziehungen <span class="info-section-count">' + external.length + '</span></div>' +
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

        return '' +
            '<div class="info-header">' +
                '<span class="info-header-icon" style="background:var(--color-bg-page);color:var(--color-text-secondary);font-family:var(--font-mono);font-size:10px;font-weight:600">' +
                    (col.key || '·') +
                '</span>' +
                '<div class="info-header-text">' +
                    '<div class="info-header-title" style="font-family:var(--font-mono);font-size:var(--text-mono)">' + keyBadge + escapeHtml(col.name) + '</div>' +
                    '<div class="info-header-sub">' + subParts.join(' · ') + '</div>' +
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
                    '<dt>Property Set</dt><dd>' + setPickerOrLabelHtml(node, col) + '</dd>' +
                    (col.sourceStructure
                        ? '<dt>SAP-Struktur</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(col.sourceStructure) + '</code></dd>'
                        : '') +
                '</dl>' +
            '</div>' +
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

    function typeLabel(t) {
        return TYPE_LABELS[t] || t || '–';
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

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttr(s) { return escapeHtml(s); }

    return { init: init, render: render };
})();
