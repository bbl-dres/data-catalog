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
    var TYPE_ICONS = {
        table: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="5.5" y1="5.5" x2="5.5" y2="14.5"/></svg>',
        view:  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>',
        api:   '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 1.5L2 9.5h6l-1 5L13.5 6.5h-6l1-5z"/></svg>',
        file:  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H3.5a1 1 0 0 0-1 1V13.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V6L9 1.5z"/><polyline points="9 1.5 9 6 13.5 6"/></svg>',
        codelist: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="13" y2="3"/><line x1="6" y1="8" x2="13" y2="8"/><line x1="6" y1="13" x2="13" y2="13"/><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="8" r="1.2" fill="currentColor"/><circle cx="3" cy="13" r="1.2" fill="currentColor"/></svg>'
    };

    function init() {
        State = window.CanvasApp.State;
        panelEl = document.getElementById('info-panel');
        contentEl = document.getElementById('info-panel-content');

        // Click delegation: × close, set / relation row clicks
        contentEl.addEventListener('click', onContentClick);

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
    }

    function updateOpenState() {
        var sel = State.getSelection();
        var supports = sel && (sel.kind === 'node' || sel.kind === 'system' || sel.kind === 'attribute');
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
        var tags = (node.tags || []).map(function (t) {
            return '<span class="info-tag">' + escapeHtml(t) + '</span>';
        }).join('') || '<span style="color:var(--color-text-placeholder)">–</span>';
        return '' +
            '<div class="info-section">' +
                '<div class="info-section-label">Metadaten</div>' +
                '<dl class="info-meta">' +
                    '<dt>ID</dt><dd><code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(node.id) + '</code></dd>' +
                    '<dt>Typ</dt><dd>' + escapeHtml(TYPE_LABELS[node.type] || node.type || 'Tabelle') + '</dd>' +
                    '<dt>System</dt><dd>' + (node.system ? escapeHtml(node.system) : '<span style="color:var(--color-text-placeholder)">–</span>') + '</dd>' +
                    '<dt>Schema</dt><dd>' + (node.schema ? escapeHtml(node.schema) : '<span style="color:var(--color-text-placeholder)">–</span>') + '</dd>' +
                    '<dt>Tags</dt><dd>' + tags + '</dd>' +
                '</dl>' +
            '</div>';
    }

    function propertySetsSectionHtml(node) {
        var sets = node.propertySets || [];
        if (!sets.length) return '';
        var cols = node.columns || [];
        var items = sets.map(function (s) {
            var count = cols.filter(function (c) { return c.set === s.name; }).length;
            return '' +
                '<li data-action="focus-set" data-set="' + escapeAttr(s.name) + '" title="Im Diagramm hervorheben">' +
                    '<span class="info-set-name">' + escapeHtml(s.name) + '</span>' +
                    '<span class="info-set-label">' + escapeHtml(s.label || '') + '</span>' +
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
        var pkCount = cols.filter(function (c) { return c.key === 'PK'; }).length;
        var fkCount = cols.filter(function (c) { return c.key === 'FK'; }).length;
        var ukCount = cols.filter(function (c) { return c.key === 'UK'; }).length;
        var ungrouped = cols.filter(function (c) { return !c.set; }).length;
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

    // ---- System content ------------------------------------------------

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
            setCount += (n.propertySets || []).length;
            colCount += (n.columns || []).length;
            (n.columns || []).forEach(function (c) { if (c.key === 'PK') pkCount += 1; });
            typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
            (n.tags || []).forEach(function (t) { tagSet[t] = true; });
        });

        var typeBreakdown = Object.keys(typeCounts).map(function (t) {
            return typeCounts[t] + ' ' + typeLabel(t) + (typeCounts[t] === 1 ? '' : 's');
        }).join(', ');

        var tagsHtml = Object.keys(tagSet).sort().map(function (t) {
            return '<span class="info-tag">' + escapeHtml(t) + '</span>';
        }).join('') || '<span style="color:var(--color-text-placeholder)">–</span>';

        var nodesItems = members.map(function (n) {
            var ic = TYPE_ICONS[n.type] || TYPE_ICONS.table;
            return '<li data-action="select-node" data-node-id="' + escapeAttr(n.id) + '">' +
                '<span class="info-set-name" style="display:inline-flex;align-items:center;gap:6px"><span class="cell-icon" data-type="' + escapeAttr(n.type) + '">' + ic + '</span>' + escapeHtml(n.label || n.id) + '</span>' +
                '<span class="info-set-label">' + escapeHtml(typeLabel(n.type)) + '</span>' +
                '<span class="info-set-count">' + ((n.columns || []).length) + '</span>' +
            '</li>';
        }).join('');

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
                '<div class="info-section-label">Knoten <span class="info-section-count">' + members.length + '</span></div>' +
                (members.length ? '<ul class="info-set-list">' + nodesItems + '</ul>' : '<div style="font-size:var(--text-small);color:var(--color-text-placeholder)">Keine Knoten</div>') +
            '</div>' +
            '<div class="info-section">' +
                '<div class="info-section-label">Externe Beziehungen <span class="info-section-count">' + external.length + '</span></div>' +
                externalHtml +
            '</div>';
    }

    // ---- Attribute content ---------------------------------------------

    function attributeContentHtml(node, col) {
        var keyClass = col.key === 'PK' ? 'pk' : col.key === 'FK' ? 'fk' : col.key === 'UK' ? 'uk' : '';
        var keyBadge = col.key
            ? '<span class="info-key-badge ' + keyClass + '" style="margin-right:8px">' + escapeHtml(col.key) + '</span>'
            : '<span class="info-key-badge" style="margin-right:8px;background:var(--color-bg-page);color:var(--color-text-placeholder)">–</span>';

        var subParts = [];
        if (col.type) subParts.push(escapeHtml(col.type));
        if (col.set) subParts.push(escapeHtml(col.set));
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
                var ic = TYPE_ICONS[r.node.type] || TYPE_ICONS.table;
                return '<li data-action="select-attr" data-node-id="' + escapeAttr(r.node.id) + '" data-attr-name="' + escapeAttr(r.col.name) + '">' +
                    '<span class="info-set-name" style="display:inline-flex;align-items:center;gap:6px"><span class="cell-icon" data-type="' + escapeAttr(r.node.type) + '">' + ic + '</span>' + escapeHtml(r.node.label || r.node.id) + '</span>' +
                    '<span class="info-set-label">' + escapeHtml(r.col.type || '') + (r.col.set ? ' · ' + escapeHtml(r.col.set) : '') + '</span>' +
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
                    '<dt>Property Set</dt><dd>' + (col.set ? '<code style="font-family:var(--font-mono);font-size:var(--text-mono-sm)">' + escapeHtml(col.set) + '</code>' : '<span style="color:var(--color-text-placeholder)">–</span>') + '</dd>' +
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
            );
    }

    function typeLabel(t) {
        return ({ table: 'Tabelle', view: 'View', api: 'API', file: 'Datei' }[t] || t || '–');
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
            // Future: scroll diagram to the set's section in the node.
            return;
        }
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
