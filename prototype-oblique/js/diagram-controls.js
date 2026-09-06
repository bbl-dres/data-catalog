/* Print-workspace controls share catalog tokens and tree styling, but never navigate the app. */
(function (DK) {
  'use strict';
  const { ui, diagram } = DK, esc = ui.esc;
  const controls = {};
  controls.compact = () => innerWidth <= 960 || (window.visualViewport?.scale === 1 ? visualViewport.height : innerHeight) <= 500;
  controls.button = (action, label, icon, extra = '', variant = '') => `<button type="button" class="ob-button${icon ? ' ob-button--icon' : ''}${variant ? ' ob-button--' + esc(variant) : ''}" data-diagram-action="${action}"${icon ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''} ${extra}>${icon ? ui.icon(icon, 'lg') : esc(label)}</button>`;
  controls.field = (caption, content) => `<label class="ob-export-control"><span>${esc(caption)}</span>${content}</label>`;
  controls.choice = (caption, content, icon = '') => `<div class="ob-export-control"><span>${esc(caption)}</span><div class="ob-select-menu" data-select-label="${esc(caption)}" data-select-icon="${esc(icon)}">${content}</div></div>`;
  controls.select = (name, caption, entries, value, icon) => controls.choice(caption, `<select class="ob-select" data-diagram-setting="${name}">${entries.map(([key, title]) => `<option value="${esc(key)}"${String(key) === String(value) ? ' selected' : ''}>${esc(title)}</option>`).join('')}</select>`, icon);
  controls.menu = (action, label, icon, extra = '') => `<button type="button" class="ob-button ob-button--menu" data-diagram-action="${action}" aria-haspopup="dialog" aria-expanded="false" ${extra}>${ui.buttonContent(label, { icon, menu: true })}</button>`;
  const tFor = session => (key, params) => diagram.t(session.snapshot, key, params);
  controls.shell = session => {
    const t = tFor(session), { settings } = session, button = controls.button, select = controls.select;
    return `<header class="ob-export-header"><h2 id="diagram-export-title">${esc(t('toolbar.export.diagram'))}</h2><div class="ob-export-header-actions">
      ${controls.choice(t('header.language'), `<select class="ob-select ob-language-select" id="diagram-language">${Object.keys(session.catalogs).map(lang => `<option value="${lang}"${lang === session.language ? ' selected' : ''}>${lang.toUpperCase()}</option>`).join('')}</select>`)}
      ${button('close', t('diagram.cancel'))}${button('download', t('diagram.download'), null, '', 'primary')}
      </div></header>
      <details class="ob-disclosure ob-export-tools-panel"${controls.compact() ? '' : ' open'}><summary>${esc(t('toolbar.view'))}</summary><div class="ob-export-toolbar"><div class="ob-export-toolbar-start">
        <div class="ob-export-control ob-export-document-control"><span>${esc(t('print.document'))}</span>${controls.menu('document', settings.title, '', 'id="diagram-document-button"')}</div>
        ${select('paper', t('diagram.paper'), Object.keys(diagram.papers).map(p => [p, p]), settings.paper)}
        <div class="ob-export-toolbar-divider">${select('orientation', t('diagram.orientation'), ['portrait', 'landscape'].map(p => [p, t('diagram.' + p)]), settings.orientation)}</div>
        <div class="ob-export-preview-tools">${controls.choice(t('diagram.preview'), `<select class="ob-select" id="diagram-zoom-mode"><option value="fit">${esc(t('print.fitPage'))}</option><option value="width">${esc(t('print.fitWidth'))}</option>${[50, 75, 100, 150, 200].map(n => `<option value="${n}">${n}%</option>`).join('')}<option value="custom" hidden></option></select>`)}
          ${button('zoom-out', t('diagram.zoomOut'), 'zoom_out')}<output id="diagram-zoom">—</output>${button('zoom-in', t('diagram.zoomIn'), 'zoom_in')}</div>
      </div><div class="ob-export-toolbar-end">
        <div class="ob-export-control ob-export-toolbar-divider"><span id="diagram-layout-label">${esc(t('print.layout'))}</span><div class="ob-export-layout" role="group" aria-labelledby="diagram-layout-label">${[['tiles', 'grid'], ['grid', 'grid_rows'], ['list', 'list']].map(([layout, icon]) => `<button type="button" class="ob-button" data-diagram-layout="${layout}" aria-pressed="${settings.layout === layout}">${ui.buttonContent(t('print.' + layout), { icon })}</button>`).join('')}</div></div>
        <div class="ob-export-control" id="diagram-columns-host"><span>${esc(t('visibility.label'))}</span>${controls.menu('columns', t('print.columnCount', diagram.visibilityCount(session.snapshot, settings)))}</div>
        <div id="diagram-grouping"></div>
      </div>
      </div></details>
      <div class="ob-export-filterbar"><div id="diagram-chips" class="ob-export-chips"></div>${controls.menu('filters', t('print.addFilter'))}
        <p id="diagram-filter-status" class="ob-export-hint" role="status" aria-live="polite"></p>${button('reset-filters', t('diagram.resetFilters'))}</div>
      <div class="ob-export-workspace"><aside class="ob-export-settings"><details class="ob-disclosure" id="diagram-scope-panel"${controls.compact() ? '' : ' open'}><summary>${esc(t('print.scope'))}</summary>
        <div class="ob-export-settings-body">
        ${controls.field(t('diagram.find'), '<input type="search" class="ob-input" id="diagram-find">')}<p class="ob-sr-only" id="diagram-selection-hint">${esc(t(settings.layout === 'tiles' ? 'print.tilesHint' : 'print.selectionHint'))}</p><nav id="diagram-tree" aria-label="${esc(t('print.scope'))}" aria-describedby="diagram-selection-hint"></nav></div></details></aside>
        <div class="ob-export-preview"><div class="ob-export-canvas" id="diagram-canvas" tabindex="0" role="document" aria-label="${esc(t('diagram.preview'))}"><div class="ob-export-pages" id="diagram-sheets"></div></div><div class="ob-export-busy" id="diagram-busy" hidden></div></div>
      </div><p class="ob-sr-only" id="diagram-summary" role="status" aria-live="polite"></p>
      <div class="ob-export-error" id="diagram-error" hidden><p id="diagram-error-message" role="alert"></p>${button('retry', t('diagram.retry'), null, 'hidden')}</div>
      <footer class="ob-footer" lang="${esc(DK.app.state.lang)}">${DK.views.footer()}</footer>
      <div class="ob-export-popover" id="diagram-popover" popover="auto" role="dialog" aria-labelledby="diagram-popover-title"></div>`;
  };
  controls.tree = session => {
    const { scope, catalogs, language } = session, selected = new Set(session.settings.selected), t = tFor(session);
    const query = session.dialog.querySelector('#diagram-find').value.trim().toLocaleLowerCase(language);
    session.treeScopes = [];
    const item = (target, title, count, level, icon, key, active, checkbox) => {
      const index = session.treeScopes.push(target) - 1, open = session.expanded.has(key) || Boolean(query);
      const toggle = key ? `<button type="button" class="ob-tree-toggle" data-diagram-toggle="${esc(key)}" aria-expanded="${open}" aria-label="${esc(t(open ? 'tree.collapse' : 'tree.expand', { name: title }))}">${ui.icon(open ? 'chevron_down' : 'chevron_right', 'sm')}</button>` : '<span class="ob-tree-spacer"></span>';
      const check = checkbox ? `<label class="ob-export-tree-check"><input type="checkbox" class="ob-check-input" data-diagram-entity="${esc(target.entityId)}"${selected.has(target.entityId) ? ' checked' : ''} aria-label="${esc(t('diagram.selection') + ': ' + title)}"></label>` : '';
      return `<li><div class="ob-tree-row${active ? ' is-active' : ''}" style="--level:${level}">${check || toggle}<button type="button" class="ob-tree-link" data-diagram-scope="${index}"${active ? ' aria-current="true"' : ''}>${ui.icon(icon)}<span class="ob-tree-label" title="${esc(title)}">${esc(title)}</span><span class="ob-tree-count">${count}</span></button></div></li>`;
    };
    let html = '';
    for (const kind of diagram.kinds) {
      const catalog = catalogs[language][kind], facet = kind === 'tables' ? 'system' : 'domain', root = { kind, facet: '', value: '', entityId: '' };
      html += item(root, catalog.scope, catalog.entities.length, 1, DK.data.kindDef(kind).icon, kind, scope.kind === kind && !scope.facet && !scope.entityId);
      if (!session.expanded.has(kind) && !query) continue;
      for (const group of catalog.facets.find(f => f.id === facet).groups) {
        const key = group.id, branch = { kind, facet, value: group.value, entityId: '' };
        const entities = catalog.entities.filter(e => group.entityIds.includes(e.id) && (!query || e.name.toLocaleLowerCase(language).includes(query)));
        if (query && !entities.length) continue;
        html += item(branch, group.title, group.entityIds.length, 2, facet === 'system' ? DK.data.kindDef('systems').icon : 'folder', key, scope.kind === kind && scope.facet === facet && scope.value === group.value && !scope.entityId);
        if (!session.expanded.has(key) && !query) continue;
        for (const entity of entities) html += item({ ...branch, entityId: entity.id }, entity.name, entity.rows.length, 3, DK.data.kindDef(kind).icon, null,
          scope.kind === kind && scope.entityId === entity.id, scope.kind === kind && session.snapshot.entities.some(e => e.id === entity.id));
      }
    }
    return `<ul class="ob-tree">${html}</ul>`;
  };
  controls.chips = session => {
    const t = tFor(session), { snapshot, settings } = session;
    let html = `<span class="ob-export-chip ob-export-chip--scope"><span>${esc(t('print.scope'))}:</span> <strong>${esc(snapshot.scopeTitle || snapshot.title)}</strong></span>`;
    if (session.scope.query) html += `<button type="button" class="ob-export-chip" data-diagram-action="clear-query" aria-label="${esc(t('print.removeFilter', { name: session.scope.query }))}">${esc(t('print.initialQuery'))}: ${esc(session.scope.query)} ${ui.icon('xmark', 'sm')}</button>`;
    session.filterChips = [];
    for (const facet of snapshot.facets) for (const id of diagram.filterValues(settings.filters[facet.id])) {
      const group = facet.groups.find(g => g.id === id), title = `${facet.label}: ${group?.title || '—'}`, index = session.filterChips.push({ facet: facet.id, id }) - 1;
      html += `<button type="button" class="ob-export-chip" data-diagram-remove="${index}" aria-label="${esc(t('print.removeFilter', { name: title }))}">${esc(title)} ${ui.icon('xmark', 'sm')}</button>`;
    }
    return html;
  };
  controls.popover = (session, mode) => {
    const t = tFor(session), field = controls.field, select = controls.select, button = controls.button;
    const input = (key, limit) => field(t('diagram.' + key), `<input class="ob-input" name="${key}" maxlength="${limit}" value="${esc(session.settings[key])}">`);
    let body;
    if (mode === 'document') body = `${input('title', 160)}${input('documentId', 80)}${input('version', 40)}
      ${select('documentStatus', t('col.status'), ['draft', 'review', 'approved'].map(p => [p, t('print.status.' + p)]), session.settings.documentStatus)}
      ${select('classification', t('fact.classification'), [['', t('print.fromScope')], ...diagram.classifications.map(value => [value, t('print.classification.' + value)])], session.settings.classification)}
      ${select('overview', t('print.overview'), ['auto', 'yes', 'no'].map(p => [p, t('print.' + p)]), session.settings.overview)}
      <p class="ob-export-hint">${esc(t('diagram.externalApproval'))}</p>${button('reset-title', t('print.resetTitle'))}`;
    if (mode === 'columns') {
      const choices = diagram.visibilityChoices(session.snapshot, session.settings);
      body = `<p class="ob-export-hint">${esc(t('print.columnsHint'))}</p>
        ${diagram.usesRows(session.settings) ? `<p class="ob-export-hint">${esc(t('visibility.sharedHint'))}</p>` : ''}
        <div class="ob-field-group">${DK.fieldPicker.checklist(choices, choices.filter(choice => choice.checked).map(choice => choice.id), { name: 'column', translate: t })}</div>`;
    }
    if (mode === 'filters') {
      session.filterChoices = [];
      const ids = new Set(session.snapshot.entities.map(e => e.id));
      body = `${field(t('print.filterSearch'), '<input type="search" class="ob-input" id="diagram-filter-find">')}<div class="ob-export-facet-list">${session.snapshot.facets.map(facet => {
        const missing = diagram.filterValues(session.settings.filters[facet.id]).filter(id => !facet.groups.some(group => group.id === id));
        const groups = [...facet.groups, ...missing.map(id => ({ id, title: t('diagram.unspecified'), entityIds: [] }))].map(group => ({ ...group, count: group.entityIds.filter(id => ids.has(id)).length }));
        if (facet.id === session.scope.facet) return '';
        return `<fieldset data-diagram-facet="${facet.id}"><legend>${esc(facet.label)}</legend>${groups.map(group => {
          const index = session.filterChoices.push({ facet: facet.id, id: group.id }) - 1;
          return `<label class="ob-check"><input type="checkbox" data-diagram-filter="${index}"${diagram.filterValues(session.settings.filters[facet.id]).includes(group.id) ? ' checked' : ''}><span>${esc(group.title)}</span><span class="ob-tree-count">${group.count}</span></label>`;
        }).join('')}</fieldset>`;
      }).join('')}</div><p id="diagram-filter-preview" class="ob-export-hint" role="status"></p>`;
    }
    const actions = mode === 'columns' ? `${button('reset-columns', t('visibility.reset'))}${button('dismiss', t('visibility.close'))}`
      : mode === 'filters' ? button('dismiss', t('visibility.close'))
      : `${button('dismiss', t('diagram.cancel'))}<button type="submit" class="ob-button">${esc(t('print.apply'))}</button>`;
    return `<h3 id="diagram-popover-title">${esc(t(mode === 'columns' ? 'visibility.title' : 'print.' + (mode === 'filters' ? 'addFilter' : mode)))}</h3><form id="diagram-settings-form"><div class="ob-export-popover-body">${body}</div><div class="ob-export-popover-actions">${actions}</div></form>`;
  };
  DK.diagramControls = controls;
})(window.DK);
