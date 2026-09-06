/* Modal export workspace. Preview zoom never changes the physical document layout. */
(function (DK) {
  'use strict';
  const { ui, diagram, pdf, diagramControls: view } = DK, esc = ui.esc;
  const t = (session, key, params) => diagram.t(session.snapshot, key, params);
  let current = null;
  function renderControls(session) {
    const { snapshot, settings, dialog } = session;
    const focused = document.activeElement, focusedEntity = focused?.dataset.diagramEntity;
    const focusedSetting = focused?.closest('.ob-select-menu')?.querySelector('select')?.dataset.diagramSetting;
    const focusedScope = session.treeScopes?.[Number(focused?.dataset.diagramScope)];
    dialog.querySelector('#diagram-tree').innerHTML = view.tree(session);
    dialog.querySelector('#diagram-chips').innerHTML = view.chips(session);
    dialog.querySelector('#diagram-grouping').innerHTML = view.select('groupBy', t(session, 'toolbar.group'), snapshot.groupings.map(g => [g.id, g.label]), settings.groupBy, 'grid');
    dialog.querySelectorAll('.ob-export-toolbar [data-diagram-setting]').forEach(select => { select.value = settings[select.dataset.diagramSetting]; });
    dialog.querySelector('#diagram-document-button .ob-button-label').textContent = settings.title || snapshot.title;
    dialog.querySelector('[data-diagram-action="columns"] .ob-button-label').textContent = t(session, 'print.columnCount', diagram.visibilityCount(snapshot, settings));
    dialog.querySelectorAll('[data-diagram-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.diagramLayout === settings.layout)));
    dialog.querySelector('#diagram-selection-hint').textContent = t(session, settings.layout === 'tiles' ? 'print.tilesHint' : 'print.selectionHint');
    dialog.querySelector('#diagram-filter-status').textContent = t(session, 'diagram.filterCount', { matched: diagram.filteredEntities(snapshot, settings).length,
      total: session.catalogs[session.language][snapshot.kind].entities.length, selected: diagram.exportEntities(snapshot, settings).length });
    if (focusedEntity && !focused.isConnected) dialog.querySelectorAll('[data-diagram-entity]').forEach(input => { if (input.dataset.diagramEntity === focusedEntity) input.focus({ preventScroll: true }); });
    session.selectMenus.refresh();
    if (focusedSetting && !focused.isConnected) session.selectMenus.focus(dialog.querySelector(`.ob-export-toolbar [data-diagram-setting="${focusedSetting}"]`));
    if (focusedScope && !focused.isConnected) {
      const index = session.treeScopes.findIndex(scope => JSON.stringify(scope) === JSON.stringify(focusedScope));
      dialog.querySelector(`[data-diagram-scope="${index}"]`)?.focus({ preventScroll: true });
    }
  }
  function dismiss(session, restore = true) {
    session.selectMenus?.close();
    const popover = session.dialog.querySelector('#diagram-popover');
    if (popover.matches(':popover-open')) popover.hidePopover();
    session.popoverTrigger?.setAttribute('aria-expanded', 'false');
    if (restore) session.popoverTrigger?.focus();
    session.popoverMode = null;
  }
  function positionPopover(session) {
    if (!session.popoverMode) return;
    const popover = session.dialog.querySelector('#diagram-popover'), bounds = session.popoverTrigger.getBoundingClientRect();
    const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ob-space-sm'));
    const viewport = window.visualViewport, top = viewport?.scale === 1 ? viewport.offsetTop : 0;
    const bottom = top + (viewport?.scale === 1 ? viewport.height : innerHeight);
    popover.style.left = Math.max(inset, Math.min(bounds.left, innerWidth - popover.offsetWidth - inset)) + 'px';
    popover.style.top = Math.max(top + inset, Math.min(bounds.bottom + inset, bottom - popover.offsetHeight - inset)) + 'px';
  }
  function showPopover(session, mode, trigger) {
    dismiss(session, false); session.popoverMode = mode; session.popoverTrigger = trigger;
    const popover = session.dialog.querySelector('#diagram-popover');
    popover.innerHTML = view.popover(session, mode); popover.showPopover();
    session.selectMenus.refresh();
    trigger.setAttribute('aria-expanded', 'true');
    if (mode === 'filters') previewFilters(session);
    if (mode === 'columns') restoreColumnChecks(session);
    popover.querySelector('input:not(:disabled), select, button')?.focus();
    positionPopover(session);
  }
  function restoreColumnChecks(session) {
    const choices = diagram.visibilityChoices(session.snapshot, session.settings);
    session.dialog.querySelectorAll('[name="column"]').forEach(input => {
      const choice = choices.find(choice => choice.id === input.value);
      input.checked = choice.checked; input.indeterminate = choice.mixed;
    });
  }
  function selectedFilters(session) {
    const filters = structuredClone(session.settings.filters);
    session.snapshot.facets.filter(f => f.id !== session.scope.facet).forEach(f => { filters[f.id] = []; });
    session.dialog.querySelectorAll('[data-diagram-filter]:checked').forEach(input => {
      const choice = session.filterChoices[Number(input.dataset.diagramFilter)];
      filters[choice.facet].push(choice.id);
    });
    return filters;
  }
  function previewFilters(session) {
    const matching = diagram.filteredEntities(session.snapshot, session.settings).length;
    session.dialog.querySelector('#diagram-filter-preview').textContent = t(session, 'diagram.filterCount', { matched: matching, total: session.snapshot.entities.length,
      selected: diagram.exportEntities(session.snapshot, session.settings).length });
  }
  function applyPopover(session, form) {
    if (session.popoverMode === 'document') {
      for (const input of form.querySelectorAll('input[name]')) session.settings[input.name] = input.value;
      for (const select of form.querySelectorAll('select')) session.settings[select.dataset.diagramSetting] = select.value;
      session.customTitle = session.settings.title !== session.snapshot.title;
    }
    dismiss(session); session.page = 0; update(session);
  }
  function updateVisibility(session) {
    const { snapshot, settings } = session;
    settings.entityColumns = DK.presentation.normalize(snapshot.kind, settings.entityColumns);
    DK.presentation.save(snapshot.kind, settings.entityColumns);
    if (diagram.usesRows(settings)) {
      settings.columns = DK.presentation.normalize(snapshot.rowKind, settings.columns);
      DK.presentation.save(snapshot.rowKind, settings.columns);
    }
    DK.app.refreshVisibility();
    update(session);
    restoreColumnChecks(session);
    positionPopover(session);
  }
  function changeColumn(session, input) {
    const choice = diagram.visibilityChoices(session.snapshot, session.settings).find(choice => choice.id === input.value);
    if (!choice || choice.required) return;
    for (const target of choice.targets) {
      const selected = new Set(session.settings[target.key]);
      if (input.checked) selected.add(target.id); else selected.delete(target.id);
      session.settings[target.key] = [...selected];
    }
    updateVisibility(session);
  }
  function changeScope(session, scope) {
    if (current !== session || session.busy) return;
    const previous = session.snapshot;
    session.selections[session.scope.kind] = [...session.settings.selected];
    session.scope = scope;
    session.snapshot = diagram.scoped(session.catalogs, session.language, scope);
    if (previous.kind !== scope.kind) {
      session.settings.entityColumns = DK.presentation.selected(scope.kind);
      session.settings.columns = DK.presentation.selected(session.snapshot.rowKind);
    }
    session.settings.selected = session.selections[scope.kind] || session.catalogs[session.language][scope.kind].entities.map(e => e.id);
    Object.keys(session.settings.filters).forEach(id => { if (!session.snapshot.facets.some(facet => facet.id === id)) delete session.settings.filters[id]; });
    for (const facet of session.snapshot.facets) session.settings.filters[facet.id] = diagram.filterValues(session.settings.filters[facet.id]).map(id => {
      const group = previous.facets.find(f => f.id === facet.id)?.groups.find(g => g.id === id);
      return facet.groups.find(g => g.id === id || group && g.value === group.value)?.id || `${scope.kind}:${facet.id}:${group?.value || id}`;
    });
    if (!session.snapshot.groupings.some(g => g.id === session.settings.groupBy)) session.settings.groupBy = session.snapshot.defaultGroupBy;
    if (!session.customLayout) session.settings.layout = diagram.defaultLayout(scope.kind);
    if (!session.customOrientation) session.settings.orientation = session.settings.layout === 'list' ? 'portrait' : 'landscape';
    if (!session.customTitle) session.settings.title = session.snapshot.title;
    session.expanded.add(scope.kind);
    if (scope.facet) session.expanded.add(`${scope.kind}:${scope.facet}:${scope.value}`);
    session.page = 0; update(session);
  }
  function unwire(session) {
    session.events?.abort();
    cancelAnimationFrame(session.scrollFrame); session.scrollFrame = null;
    session.observer?.disconnect();
  }
  function close(restore = true) {
    if (!current) return;
    const session = current; current = null;
    unwire(session); session.dialog.close(); session.dialog.remove();
    document.documentElement.classList.remove('ob-export-open');
    if (restore) (session.opener?.isConnected ? session.opener : document.querySelector('.ob-actions-menu > button'))?.focus({ preventScroll: true });
  }
  function error(session, message) {
    session.dialog.querySelector('#diagram-error-message').textContent = message; session.error.hidden = !message;
  }
  function controls(session) {
    session.dialog.querySelectorAll('input, select, button').forEach(el => {
      if (el.dataset.diagramAction === 'close') return;
      el.disabled = session.busy || !session.assets || el.hasAttribute('data-fixed');
    });
    session.dialog.querySelector('[data-diagram-action="retry"]').disabled = session.busy;
    session.dialog.querySelector('[data-diagram-action="download"]').disabled = session.busy || !session.layout?.entityCount;
    const canReset = Object.values(session.settings.filters).some(value => diagram.filterValues(value).length) || session.scope.query;
    session.dialog.querySelectorAll('[data-diagram-action="reset-filters"]').forEach(el => { el.hidden = !canReset; el.disabled = session.busy || !session.assets || !canReset; });
    session.dialog.querySelectorAll('[data-diagram-action="all"]').forEach(el => { el.disabled = session.busy || !session.assets || !diagram.filteredEntities(session.snapshot, session.settings).length; });
    zoomControls(session);
  }
  function zoomControls(session) {
    const disable = (selector, value) => session.dialog.querySelectorAll(selector).forEach(el => { if (el.disabled !== value) el.disabled = value; });
    disable('#diagram-zoom-mode, [data-diagram-action="zoom-in"], [data-diagram-action="zoom-out"]', session.busy || !session.layout?.pages.length);
    session.selectMenus.refresh();
  }
  function syncPage(session) {
    if (!session.layout?.pages.length || current !== session || !session.stride) return;
    const top = session.canvas.scrollTop - session.padding, last = session.layout.pages.length - 1;
    const pageTop = session.page * session.stride;
    const fullyVisible = pageTop >= top - 1 && pageTop + session.pageHeight <= top + session.canvas.clientHeight + 1;
    if (!fullyVisible) session.page = Math.max(0, Math.min(last, Math.floor((top + Math.min(session.canvas.clientHeight, session.pageHeight) / 2) / session.stride)));
    pageSummary(session);
    // Keep page-sized placeholders; only visible pages and their neighbours need SVGs.
    const first = Math.max(0, Math.floor(top / session.stride) - 1);
    const end = Math.min(last, Math.floor((top + session.canvas.clientHeight) / session.stride) + 1);
    for (const index of session.mountedPages) {
      if (index < first || index > end) { session.pagesHost.children[index].querySelector('.ob-export-page-svg').replaceChildren(); session.mountedPages.delete(index); }
    }
    for (let index = first; index <= end; index++) {
      if (session.mountedPages.has(index)) continue;
      session.pagesHost.children[index].querySelector('.ob-export-page-svg').innerHTML = diagram.pageSvg(session.snapshot, session.settings, session.layout, index, session.palette, session.assets.logo);
      session.mountedPages.add(index);
    }
  }
  function jumpToPage(session, index) {
    if (!session.layout?.pages.length) return;
    const page = Math.max(0, Math.min(index, session.layout.pages.length - 1));
    session.page = page;
    session.canvas.scrollTop = page === 0 ? 0 : session.padding + page * session.stride;
    syncPage(session);
  }
  function zoom(session) {
    if (current !== session || !session.layout?.pages.length) return;
    const { width, height } = session.layout, cssRatio = 96 / 72;
    const position = session.stride ? Math.max(0, (session.canvas.scrollTop - session.padding) / session.stride) : session.page;
    const atTop = session.canvas.scrollTop === 0, canvasStyle = getComputedStyle(session.canvas);
    session.padding = parseFloat(canvasStyle.paddingTop);
    const fit = Math.max(0.05, Math.min((session.canvas.clientWidth - parseFloat(canvasStyle.paddingLeft) * 2) / width, (session.canvas.clientHeight - session.padding * 2) / height));
    const ratio = session.zoom === 'fit' ? fit : session.zoom === 'width' ? Math.max(.05, (session.canvas.clientWidth - parseFloat(canvasStyle.paddingLeft) * 2) / width) : session.zoom / 100 * cssRatio;
    session.ratio = ratio;
    session.pageHeight = height * ratio;
    session.stride = session.pageHeight + parseFloat(getComputedStyle(session.pagesHost).rowGap);
    session.pagesHost.style.setProperty('--ob-export-page-width', width * ratio + 'px');
    session.pagesHost.style.setProperty('--ob-export-page-height', session.pageHeight + 'px');
    session.canvas.scrollTop = atTop ? 0 : session.padding + position * session.stride;
    session.dialog.querySelector('#diagram-zoom').textContent = Math.round(ratio / cssRatio * 100) + '%';
    const picker = session.dialog.querySelector('#diagram-zoom-mode');
    picker.value = [...picker.options].some(o => o.value === String(session.zoom)) ? String(session.zoom) : 'custom';
    picker.querySelector('[value="custom"]').label = Math.round(ratio / cssRatio * 100) + '%';
    session.selectMenus.refresh();
    syncPage(session);
  }
  function pageSummary(session) {
    const layout = session.layout, pages = layout?.pages.length || 0;
    const summary = layout
      ? `${layout.entityCount} ${session.snapshot.scope} · ${layout.tiles ? t(session, 'print.tiles') : layout.fieldCount + ' ' + t(session, 'print.rows')} · ${t(session, 'print.pageCount', { page: pages ? session.page + 1 : 0, total: pages })}`
      : t(session, 'print.previewUnavailable');
    const host = session.dialog.querySelector('#diagram-summary');
    if (host.textContent !== summary) host.textContent = summary;
  }
  function showPages(session) {
    session.mountedPages.clear();
    const pages = session.layout.pages;
    const hasMatches = diagram.filteredEntities(session.snapshot, session.settings).length > 0;
    session.page = Math.max(0, Math.min(session.page, pages.length - 1));
    session.pagesHost.classList.toggle('is-empty', !pages.length);
    session.pagesHost.innerHTML = pages.length ? pages.map((_, index) => `<section class="ob-export-page" data-diagram-page="${index}" aria-labelledby="diagram-page-title-${index}"><h3 class="ob-sr-only" id="diagram-page-title-${index}">${esc(t(session, 'print.pageCount', { page: index + 1, total: pages.length }))}</h3><div class="ob-export-page-svg"></div></section>`).join('')
      : ui.empty(session.layout.emptyMessage, esc(t(session, hasMatches ? 'print.noSelectionHint' : 'print.emptyHint')), {
        className: 'ob-empty--plain ob-export-empty',
        actions: view.button(hasMatches ? 'all' : 'reset-filters', t(session, hasMatches ? 'diagram.all' : 'diagram.resetFilters'))
          + (diagram.parentScope(session.scope) ? view.button('parent-scope', t(session, 'print.parentScope')) : '')
      });
    pageSummary(session);
    zoom(session); jumpToPage(session, session.page); controls(session);
  }
  function update(session) {
    if (!session.assets || current !== session || session.busy) return;
    renderControls(session);
    try {
      session.layout = diagram.layout(session.snapshot, session.settings, session.measure);
      error(session, ''); showPages(session);
    } catch (failure) {
      session.layout = null; session.mountedPages.clear(); session.pagesHost.replaceChildren();
      pageSummary(session); controls(session); error(session, failure.message);
    }
  }
  async function prepare(session) {
    session.pagesHost.classList.add('is-loading');
    session.pagesHost.innerHTML = ui.loading(t(session, 'diagram.loading'));
    session.dialog.querySelector('[data-diagram-action="retry"]').hidden = true;
    controls(session); error(session, '');
    try {
      const assets = await pdf.load();
      if (current !== session) return;
      session.pagesHost.classList.remove('is-loading');
      session.assets = assets; session.measure = pdf.measure(assets); update(session);
    } catch (failure) {
      if (current !== session) return;
      session.pagesHost.classList.remove('is-loading');
      console.error(failure); session.pagesHost.replaceChildren(); error(session, t(session, 'diagram.failed'));
      session.dialog.querySelector('[data-diagram-action="retry"]').hidden = false;
      controls(session);
    }
  }
  function filename(session) {
    const name = (session.settings.documentId || session.settings.title || session.snapshot.title).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().slice(0, 100) || 'data-model';
    const version = session.settings.version.replace(/[^\p{L}\p{N}._-]/gu, '-').slice(0, 40);
    return `${name}${version ? '-v' + version : ''}-${session.snapshot.createdAt.slice(0, 10)}`;
  }
  async function download(session) {
    if (current !== session || session.busy) return;
    dismiss(session, false);
    update(session);
    if (!session.layout?.entityCount) return;
    session.busy = true; controls(session);
    const busy = session.dialog.querySelector('#diagram-busy');
    busy.innerHTML = ui.loading(t(session, 'diagram.generating', { page: 1, total: session.layout.pages.length })); busy.hidden = false;
    try {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      if (current !== session) return;
      const blob = await pdf.generate(session.assets, session.snapshot, session.settings, session.layout, session.palette, {
        active: () => current === session,
        progress: (page, total) => { busy.querySelector('.ob-loading-label').textContent = t(session, 'diagram.generating', { page, total }); },
      });
      if (current === session) { ui.downloadBlob(filename(session) + '.pdf', blob); pageSummary(session); }
    } catch (failure) {
      if (current === session) { console.error(failure); error(session, t(session, 'diagram.failed')); }
    } finally {
      if (current === session) { session.busy = false; busy.hidden = true; busy.replaceChildren(); controls(session); }
    }
  }
  function action(session, name, trigger) {
    if (current !== session) return;
    if (name === 'close') { close(); return; }
    if (session.busy) return;
    if (name !== 'retry' && !session.assets) return;
    if (['document', 'filters', 'columns'].includes(name)) { showPopover(session, name, trigger); return; }
    if (name === 'dismiss') { dismiss(session); return; }
    if (name === 'reset-title') { session.dialog.querySelector('input[name="title"]').value = session.snapshot.title; return; }
    if (name === 'reset-columns') {
      session.settings.entityColumns = DK.presentation.defaults(session.snapshot.kind);
      if (diagram.usesRows(session.settings)) session.settings.columns = DK.presentation.defaults(session.snapshot.rowKind);
      updateVisibility(session); return;
    }
    if (name === 'parent-scope') { const parent = diagram.parentScope(session.scope); if (parent) changeScope(session, parent); return; }
    if (name === 'retry') { prepare(session); return; }
    if (name === 'download') { download(session); return; }
    if (name === 'reset-filters' || name === 'clear-query') {
      if (name === 'reset-filters') Object.keys(session.settings.filters).forEach(key => { session.settings.filters[key] = []; });
      session.scope.query = ''; session.scope.initialIds = null;
      changeScope(session, session.scope); return;
    }
    if (name === 'all') {
      const selected = new Set(session.settings.selected);
      for (const entity of diagram.filteredEntities(session.snapshot, session.settings)) selected.add(entity.id);
      session.settings.selected = [...selected]; session.page = 0; update(session); session.canvas.focus({ preventScroll: true }); return;
    }
    if (name === 'zoom-in' || name === 'zoom-out') session.zoom = Math.max(10, Math.min(200, Math.round(session.ratio / (96 / 72) * 100) + (name === 'zoom-in' ? 10 : -10)));
    zoom(session);
  }
  function changeSetting(session, name, value) {
    session.settings[name] = value;
    if (name === 'layout') {
      session.customLayout = true;
      if (!session.customOrientation) session.settings.orientation = value === 'list' ? 'portrait' : 'landscape';
    }
    if (name === 'orientation') session.customOrientation = true;
    session.page = 0; update(session);
  }
  function wire(session) {
    const { dialog } = session;
    dialog.lang = session.language;
    session.events = new AbortController();
    session.selectMenus = ui.selectMenus(dialog, session.events.signal);
    const listen = (target, type, callback, options = {}) => target.addEventListener(type, callback, { ...options, signal: session.events.signal });
    session.canvas = dialog.querySelector('#diagram-canvas'); session.pagesHost = dialog.querySelector('#diagram-sheets'); session.error = dialog.querySelector('#diagram-error');
    session.observer = new ResizeObserver(entries => {
      if (session.dialog !== dialog) return;
      if (entries.some(entry => entry.target === session.canvas)) zoom(session);
      positionPopover(session);
    });
    session.observer.observe(session.canvas); session.observer.observe(dialog.querySelector('#diagram-popover'));
    session.narrow = view.compact(); dialog.classList.toggle('is-compact', session.narrow);
    session.resize = () => {
      const narrow = view.compact(); dialog.classList.toggle('is-compact', narrow);
      if (narrow !== session.narrow) {
        dialog.querySelector('#diagram-scope-panel').open = !narrow;
        dialog.querySelector('.ob-export-tools-panel').open = !narrow;
        session.narrow = narrow;
      }
      positionPopover(session);
    };
    listen(window, 'resize', session.resize);
    if (window.visualViewport) {
      listen(visualViewport, 'resize', session.resize, { passive: true });
      listen(visualViewport, 'scroll', session.resize, { passive: true });
    }
    listen(dialog, 'scroll', () => positionPopover(session), { passive: true });
    listen(session.canvas, 'scroll', () => {
      if (session.scrollFrame) return;
      session.scrollFrame = requestAnimationFrame(() => { session.scrollFrame = null; syncPage(session); });
    }, { passive: true });
    listen(dialog, 'cancel', event => { event.preventDefault(); if (session.popoverMode) dismiss(session); else close(); });
    listen(dialog, 'click', event => {
      event.stopPropagation();
      const target = event.target.closest('button'); if (current !== session || !target || target.disabled || session.busy && target.dataset.diagramAction !== 'close') return;
      if (target.dataset.diagramAction) action(session, target.dataset.diagramAction, target);
      else if (target.dataset.diagramLayout) changeSetting(session, 'layout', target.dataset.diagramLayout);
      else if (target.dataset.diagramScope !== undefined) changeScope(session, { ...session.treeScopes[Number(target.dataset.diagramScope)] });
      else if (target.dataset.diagramToggle) {
        const key = target.dataset.diagramToggle;
        if (session.expanded.has(key)) session.expanded.delete(key); else session.expanded.add(key);
        renderControls(session);
        session.dialog.querySelectorAll('[data-diagram-toggle]').forEach(button => { if (button.dataset.diagramToggle === key) button.focus(); });
      } else if (target.dataset.diagramRemove !== undefined) {
        const { facet, id } = session.filterChips[Number(target.dataset.diagramRemove)];
        session.settings.filters[facet] = diagram.filterValues(session.settings.filters[facet]).filter(value => value !== id);
        session.page = 0; update(session); dialog.querySelector('[data-diagram-action="filters"]').focus();
      }
    });
    listen(dialog, 'keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); if (session.popoverMode) dismiss(session); else close(); }
    });
    listen(dialog, 'focusin', event => event.stopPropagation()); listen(dialog, 'focusout', event => event.stopPropagation());
    listen(dialog, 'input', event => {
      event.stopPropagation(); if (current !== session || session.busy || !session.assets) return;
      if (event.target.id === 'diagram-find') renderControls(session);
      if (event.target.id === 'diagram-filter-find') {
        const query = event.target.value.trim().toLocaleLowerCase(session.language);
        dialog.querySelectorAll('[data-diagram-facet]').forEach(group => {
          const facetMatch = group.querySelector('legend').textContent.toLocaleLowerCase(session.language).includes(query);
          const visible = [...group.querySelectorAll('.ob-check')].map(label => { label.hidden = !facetMatch && !label.textContent.toLocaleLowerCase(session.language).includes(query); return !label.hidden; });
          group.hidden = !visible.some(Boolean);
        });
      }
    });
    listen(dialog, 'change', event => {
      event.stopPropagation(); if (current !== session || session.busy || !session.assets) return;
      const target = event.target;
      if (target.closest('#diagram-popover')) {
        if (target.dataset.diagramFilter !== undefined) {
          session.settings.filters = selectedFilters(session); session.page = 0; update(session); previewFilters(session); positionPopover(session);
        }
        if (target.name === 'column') changeColumn(session, target);
        return;
      }
      if (target.dataset.diagramEntity !== undefined) {
        const selected = new Set(session.settings.selected); if (target.checked) selected.add(target.dataset.diagramEntity); else selected.delete(target.dataset.diagramEntity);
        session.settings.selected = [...selected]; session.page = 0; update(session);
      } else if (target.id === 'diagram-zoom-mode') { session.zoom = ['fit', 'width'].includes(target.value) ? target.value : Number(target.value); zoom(session); }
      else if (target.id === 'diagram-language') {
        const finder = dialog.querySelector('#diagram-find').value;
        const expanded = ['#diagram-scope-panel', '.ob-export-tools-panel'].map(selector => dialog.querySelector(selector).open);
        dismiss(session, false); unwire(session);
        // Responsibility labels can change language; preserve facet membership by entity IDs.
        const previous = session.snapshot;
        session.language = target.value; session.snapshot = diagram.scoped(session.catalogs, session.language, session.scope);
        for (const facet of session.snapshot.facets) session.settings.filters[facet.id] = diagram.filterValues(session.settings.filters[facet.id]).map(id => {
          const group = previous.facets.find(f => f.id === facet.id)?.groups.find(g => g.id === id);
          return facet.groups.find(g => g.id === id || group && [...g.entityIds].sort().join('|') === [...group.entityIds].sort().join('|'))?.id || id;
        });
        if (!session.customTitle) session.settings.title = session.snapshot.title;
        const replacement = dialog.cloneNode(false); replacement.removeAttribute('open'); dialog.close(); dialog.replaceWith(replacement); session.dialog = replacement;
        replacement.innerHTML = view.shell(session); replacement.showModal(); wire(session); update(session); session.selectMenus.focus(replacement.querySelector('#diagram-language'));
        replacement.querySelector('#diagram-find').value = finder;
        ['#diagram-scope-panel', '.ob-export-tools-panel'].forEach((selector, index) => { replacement.querySelector(selector).open = expanded[index]; });
        renderControls(session);
      } else if (target.dataset.diagramSetting) {
        changeSetting(session, target.dataset.diagramSetting, target.value);
      }
    });
    listen(dialog, 'submit', event => { event.preventDefault(); event.stopPropagation(); if (current === session && session.assets && !session.busy && session.popoverMode === 'document') applyPopover(session, event.target); });
    listen(dialog.querySelector('#diagram-popover'), 'toggle', event => {
      if (event.newState === 'closed' && !event.target.matches(':popover-open')) { session.popoverTrigger?.setAttribute('aria-expanded', 'false'); session.popoverMode = null; }
    });
    renderControls(session);
  }
  function open(route, ctx) {
    const opener = document.activeElement; close(false);
    let captured;
    try { captured = diagram.capture(route, ctx, DK.app.state.lang); }
    catch (failure) { ui.toast(failure.message, 'error'); return; }
    const language = DK.app.state.lang, snapshot = diagram.scoped(captured.catalogs, language, captured.scope), settings = diagram.defaults(snapshot);
    if (ctx.isList) settings.layout = ctx.mode === 'table' ? 'list' : 'tiles';
    else if (ctx.isRows) settings.layout = 'list';
    settings.listRows = !ctx.isList && !['systems', 'domains'].includes(route.entity?.kind);
    settings.orientation = settings.layout === 'list' ? 'portrait' : 'landscape';
    settings.selected = captured.catalogs[language][snapshot.kind].entities.map(e => e.id);
    if (snapshot.groupings.some(group => group.id === ctx.groupBy)) settings.groupBy = ctx.groupBy;
    else if (route.entity) settings.groupBy = 'none';
    const dialog = document.createElement('dialog'); dialog.className = 'ob-export-dialog'; dialog.setAttribute('aria-labelledby', 'diagram-export-title');
    const session = { ...captured, snapshot, settings, language, dialog, opener, page: 0, zoom: 'fit', ratio: 1, busy: false, assets: null, layout: null,
      palette: pdf.palette(), selections: {}, expanded: new Set([captured.scope.kind]), mountedPages: new Set(), customLayout: ctx.isList || ctx.isRows };
    if (session.scope.facet) session.expanded.add(`${session.scope.kind}:${session.scope.facet}:${session.scope.value}`);
    current = session; dialog.innerHTML = view.shell(session); document.body.appendChild(dialog);
    document.documentElement.classList.add('ob-export-open'); dialog.showModal(); wire(session); dialog.querySelector('[data-diagram-action="close"]').focus(); prepare(session);
  }
  DK.diagramExport = { open, close };
})(window.DK);
