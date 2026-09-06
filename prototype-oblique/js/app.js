/* Application state, render coordination and delegated events. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router, views = DK.views, detail = DK.detail;
  const t = ui.t;

  /** UI state and cached preferences; bookmarkable choices are restored from the URL. */
  const state = {
    query: '', suggest: false, suggestIdx: -1,
    searchOptions: DK.search.options(),
    searchFiltersOpen: false,
    menu: null,                       // null | 'info' | 'language' | 'group' | 'actions'
    exporting: false,
    lang: 'de',                       // active UI language (one of config.languages)
    mode: 'tiles',                    // tiles | table (URL ?view= overrides)
    groupBy: {},                      // per section (URL ?group= overrides)
    closed: {},                       // collapsed list groups
    filteredClosed: {},               // search disclosures do not alter unfiltered groups
    treeOpen: { objects: true },      // expanded tree nodes
    treeSection: 'objects',           // section whose branch is open (others collapse on section change)
    graph: DK.graph.createState(),
    relationDiagram: true,
    navDrawerOpen: false,
    sidebarCollapsed: false,
    flyout: null,
    searchOpen: false,
    chapter: 'introduction',
    lastEntity: null,
    detailTab: 'overview',             // carried only between consecutive detail routes
    tableSorts: {},                    // Stable field IDs; fixed tables use column indices.
  };
  const app = { state };
  let route = null;
  let ctx = null;

  /* rendering */
  const $ = id => document.getElementById(id);

  // Table layout follows container width, including sidebar resizing.
  // One observer keeps DOM semantics and keyboard focus in sync with card mode.
  function adaptTable(region) {
    if (!region.isConnected) return;
    const minWidth = region.dataset.tableMinEm ? Number(region.dataset.tableMinEm) * parseFloat(getComputedStyle(region.querySelector('table')).fontSize) : Number(region.dataset.tableMinWidth);
    const cards = region.clientWidth < minWidth;
    const wasCards = region.classList.contains('is-cards');
    const focused = region.contains(document.activeElement) ? document.activeElement : null;
    region.classList.toggle('is-cards', cards);
    if (!cards && region.dataset.tableMinEm) {
      const headers = [...region.querySelectorAll('[data-column-min-em]')], fontSize = parseFloat(getComputedStyle(region.querySelector('table')).fontSize);
      const minima = headers.map(header => Number(header.dataset.columnMinEm) * fontSize);
      const remaining = Math.max(0, region.clientWidth - minima.reduce((sum, width) => sum + width, 0));
      const weight = headers.reduce((sum, header) => sum + Number(header.dataset.columnWeight), 0);
      headers.forEach((header, index) => { header.style.width = `${minima[index] + remaining * Number(header.dataset.columnWeight) / weight}px`; });
    }
    const select = region.querySelector('[data-action="sort-cards"]');
    if (select) select.closest('label').hidden = !cards;
    if (cards !== wasCards && focused) {
      if (cards && focused.matches('.ob-table-sort')) select?.focus({ preventScroll: true });
      else if (!cards && focused === select) {
        const column = select.value.split(':')[0];
        region.querySelector(`[data-sort-field="${column}"], [data-sort-column="${column}"]`)?.focus({ preventScroll: true });
      }
    }
  }
  const tableLayoutObserver = new ResizeObserver(entries => entries.forEach(entry => adaptTable(entry.target)));

  function observeTables() {
    tableLayoutObserver.disconnect();
    document.querySelectorAll('.ob-table-region').forEach(region => { adaptTable(region); tableLayoutObserver.observe(region); });
  }

  function resolveRoute() {
    const r = router.parse();
    data.navModelOverride = ['entity', 'container'].includes(r.params.nav) ? r.params.nav : null;
    if (Object.hasOwn(r.params, 'nav') && !data.navModelOverride) { router.replaceParams({ nav: null }); delete r.params.nav; }
    r.entity = null;
    if (r.view === 'list' && r.params.domain && (!data.contentKinds().includes(r.kind) || !data.domainOf(r.params.domain))) r.view = 'notfound';
    if (r.view === 'detail') {
      const e = data.get(r.kind, r.id);
      if (e) r.entity = Object.assign({ kind: r.kind }, e); else r.view = 'notfound';
    }
    return r;
  }

  /** Top-level tree section a route belongs to (depends on the nav model), or null. */
  function sectionOf(r) {
    if (r.view === 'list') return r.kind;
    if (r.view !== 'detail') return null;
    const container = data.navModel() === 'container';
    const k = r.kind === 'attrs' ? 'objects' : r.kind === 'fields' ? 'tables' : r.kind;
    if (k === 'objects' || k === 'domains') return container ? 'domains' : 'objects';
    if (k === 'tables' || k === 'systems') return container ? 'systems' : 'tables';
    return k;
  }

  /** Selector that re-identifies a focused control after `container` is re-rendered, or null. */
  function focusSelector(el, container) {
    if (!el || !container.contains(el)) return null;
    // A menu item disappears with its menu: return to the button that opened it.
    if (el.closest('.ob-menu')) el = el.closest('.ob-menu-host').querySelector('[data-action="menu"]');
    if (el.dataset.focus) return `[data-focus="${CSS.escape(el.dataset.focus)}"]`;
    if (el.id) return '#' + CSS.escape(el.id);
    const attrs = [...el.attributes].filter(a => a.name.startsWith('data-') && !['data-label', 'data-href'].includes(a.name));
    return attrs.length ? el.tagName.toLowerCase() + attrs.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : null;
  }

  /** Replace a container's HTML and keep keyboard focus on the equivalent control. */
  function replaceHtml(container, html) {
    const selector = focusSelector(document.activeElement, container);
    container.innerHTML = html;
    const target = selector && container.querySelector(selector);
    if (target && !target.disabled) target.focus({ preventScroll: true });
  }

  /** Called on every hash change (and by router.navigate): reset transient state, then render. */
  app.onRoute = function () {
    clearTimeout(chapterScrollTimer); chapterScrollLock = null;
    DK.diagramExport?.close(false);
    const diagramHadFocus = DK.graph.closeFullscreen(false);
    DK.graph.onPointerUp();
    const previous = route;
    const navigationHadFocus = diagramHadFocus || state.navDrawerOpen || !!state.flyout || !!document.activeElement?.closest('.ob-search, .ob-hero-search-form');
    route = resolveRoute();
    state.navDrawerOpen = false;
    state.flyout = null;
    state.searchOpen = false;
    state.menu = null; state.suggest = false; state.suggestIdx = -1;
    state.searchFiltersOpen = false;
    if (['home', 'search'].includes(route.view)) state.searchOptions = DK.search.options(route.params);
    state.filteredClosed = {};

    if (route.view === 'detail' && route.kind === 'domains') {
      // Domain browsing follows the collection layout preference, never an entity's relations/history tab.
      state.detailTab = detail.resolveTab(route.entity, route.params.tab || route.params.view || state.mode);
      if (state.detailTab !== 'overview') state.mode = state.detailTab;
      router.replaceParams({ tab: state.detailTab, view: null });
    } else if (route.view === 'detail') {
      // Explicit links win on both cold loads and history traversal. Snapshot implicit defaults below.
      const requested = route.params.tab || (previous?.view === 'detail' ? state.detailTab : 'overview');
      state.detailTab = detail.resolveTab(route.entity, requested);
      router.replaceParams({ tab: state.detailTab, ...(state.detailTab !== 'rows' ? { page: null } : {}) });
    } else {
      state.detailTab = 'overview';
    }

    // Entering another section collapses the other branches so the tree shows only the current path.
    const section = sectionOf(route);
    if (section && section !== state.treeSection) { state.treeOpen = { [section]: true }; state.treeSection = section; }
    if (section) state.treeOpen[section] = true;
    if (route.view === 'list' && route.params.domain) state.treeOpen[`${route.kind}:domain:${route.params.domain}`] = true;
    if (route.view === 'detail' && ['domains', 'systems'].includes(route.kind)) {
      const branch = data.navModel() === 'container' ? `${route.kind}:${route.id}`
        : `${section}:${route.kind === 'domains' ? 'domain' : 'system'}:${route.id}`;
      state.treeOpen[branch] = true;
    }
    const key = route.entity ? `${route.kind}:${route.id}` : null;
    if (key !== state.lastEntity) { state.graph = DK.graph.createState(); state.relationDiagram = true; state.lastEntity = key; }
    if (route.view === 'search') state.query = route.params.q || '';
    if (route.view === 'manual') {
      state.chapter = DK.manual.resolveChapter(route.params.ch);
      router.replaceParams({ ch: state.chapter });
    }
    app.render(true);
    if (navigationHadFocus) $('page-content').focus({ preventScroll: true });
    renderHelp();
    if (route.view === 'manual' && route.params.ch) {
      const el = $(DK.manual.anchorId(state.chapter));
      if (el) el.scrollIntoView({ block: 'start' });
    } else if (route.view !== 'manual') {
      window.scrollTo(0, 0);
    }
  };

  /** Re-render nav + main from the current route and state. `navigated`: a new page, focus is not restored. */
  app.render = function (navigated) {
    DK.fieldPicker.close();
    DK.sidebar.cancel();
    const mainFocus = !navigated && focusSelector(document.activeElement, $('main'));
    // Swagger owns a live component tree. Reattach its node on chrome updates instead of remounting it.
    const swaggerHost = !navigated && route?.view === 'api' ? $('swagger-ui') : null;
    const swaggerFocus = swaggerHost?.contains(document.activeElement) ? document.activeElement : null;
    const treeScroll = document.querySelector('.ob-sidebar-tree')?.scrollTop || 0;
    const flyoutScroll = $('sidebar-flyout')?.scrollTop || 0;
    route = resolveRoute(); // re-read: replaceParams() may have changed tab/page/view/group
    const visibleKind = DK.presentation.routeKind(route);
    if (visibleKind && Object.hasOwn(route.params, 'fields')) DK.presentation.save(visibleKind, route.params.fields.split(','));
    if (visibleKind && (navigated || Object.hasOwn(route.params, 'sort'))) {
      const key = route.view === 'list' || route.kind === 'domains' ? `list:${visibleKind}` : `detail:${route.kind}:rows`;
      const sort = router.sort(route.params.sort);
      delete state.tableSorts[key];
      if (sort && DK.presentation.fields(visibleKind).some(field => field.id === sort.field && field.type !== 'links')) state.tableSorts[key] = sort;
    }
    if (route.view === 'list' && route.params.view) state.mode = route.params.view === 'table' ? 'table' : 'tiles';
    if ((route.view === 'list' || route.kind === 'domains') && route.params.group) state.groupBy[route.kind] = route.params.group;
    const page = views.page(route, state);
    ctx = page.ctx;
    normalizeSearchPage();
    if (ctx.isList || ctx.isRows) syncVisibilityUrl();
    // Snapshot resolved defaults in this history entry. Back must restore this
    // page's layout/grouping, even after another collection changes the preference.
    if (navigated && ctx.isList) {
      router.replaceParams({ ...(ctx.isDomain ? { tab: ctx.mode } : { view: ctx.mode }), group: ctx.groupBy });
      route = resolveRoute(); ctx.route = route;
    }
    replaceHtml($('main-nav'), views.mainNav(route));
    $('brand-link').setAttribute('href', router.href('/'));
    replaceHtml($('footer'), views.footer());
    replaceHtml($('header-tools'), views.headerTools(state, route));
    if (navigated) $('main').innerHTML = page.html; else replaceHtml($('main'), page.html);
    DK.sidebar.sync();
    DK.graph.restoreFullscreen();
    if (swaggerHost) $('swagger-ui')?.replaceWith(swaggerHost);
    observeTables();
    DK.graph.mount(route.entity, state.graph);
    swaggerFocus?.focus({ preventScroll: true });
    if (mainFocus) $('main').querySelector(mainFocus)?.focus({ preventScroll: true });
    const tree = document.querySelector('.ob-sidebar-tree');
    if (tree) tree.scrollTop = treeScroll;
    if ($('sidebar-flyout')) $('sidebar-flyout').scrollTop = flyoutScroll;
    document.documentElement.classList.toggle('ob-navigation-open', state.navDrawerOpen);
    syncDrawer();
    ui.setLoading(state.exporting ? t('excel.preparing') : '');
    document.title = `${ctx.title} – ${data.config.app.name} ${data.config.app.organisation}`;
    requestAnimationFrame(() => { revealActiveTab(); DK.graph.resize(); fitSearchSuggestions(); });
    updateBackToTop();
    if (route.view === 'api') DK.api.mount($('swagger-ui'));
  };

  function updateBackToTop() {
    const button = $('back-to-top');
    if (!button) return;
    const threshold = Math.max(400, window.innerHeight * 0.75);
    const shouldBeHidden = window.scrollY <= threshold;
    if (button.hidden !== shouldBeHidden) button.hidden = shouldBeHidden;
  }

  function backToTop() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    requestAnimationFrame(() => $('main').focus({ preventScroll: true }));
  }

  function revealActiveTab() {
    const tabs = document.querySelector('.ob-tab-list') || document.querySelector('.ob-tabs');
    const active = tabs && tabs.querySelector('.ob-tab[aria-selected="true"]');
    if (!active || tabs.scrollWidth <= tabs.clientWidth) return;
    const left = active.offsetLeft - (tabs.clientWidth - active.offsetWidth) / 2;
    tabs.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
  }

  function setNavigation(open) {
    state.navDrawerOpen = open;
    state.menu = null;
    state.flyout = null;
    state.searchOpen = false;
    state.suggest = false; state.suggestIdx = -1;
    app.render();
    requestAnimationFrame(() => {
      const target = open ? document.querySelector('.ob-tree-panel.is-mobile-open [data-action="close-navigation"]') : document.querySelector('[data-action="open-navigation"]');
      if (target) target.focus({ preventScroll: true });
    });
  }

  function syncDrawer() {
    const modal = state.navDrawerOpen && window.matchMedia('(max-width: 960px)').matches;
    const panel = $('navigation-panel');
    ['header', 'page-content', 'footer', 'back-to-top'].forEach(id => { if ($(id)) $(id).inert = modal; });
    if (panel) {
      if (modal) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
      else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
    }
  }

  function setSearch(open, restoreFocus = true) {
    state.searchOpen = open && !views.hasPageSearch(route);
    state.flyout = null;
    state.suggest = open;
    state.suggestIdx = -1;
    state.menu = null;
    app.render();
    if (restoreFocus) {
      const target = open ? $('search-input') : document.querySelector('[data-action="toggle-search"]');
      if (open && views.hasPageSearch(route)) document.querySelector('.ob-hero-search-form').scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    }
  }

  function closeFlyout(restoreFocus) {
    const key = state.flyout;
    if (!key) return;
    state.flyout = null;
    app.render();
    if (restoreFocus) document.querySelector(`[data-action="rail-section"][data-key="${CSS.escape(key)}"]`)?.focus();
  }

  function renderHelp() {
    const h = $('help-host'); if (h) replaceHtml(h, views.helpHost(state));
    const l = $('language-host'); if (l) replaceHtml(l, views.languageHost(state));
    const dh = $('drawer-help-host'); if (dh) replaceHtml(dh, views.helpHost(state));
    const dl = $('drawer-language-host'); if (dl) replaceHtml(dl, views.languageHost(state));
  }
  function renderSuggest() {
    const host = $('search-suggest-host'); if (!host) return;
    host.innerHTML = views.suggest(state);
    const input = $('search-input');
    const open = state.suggest && DK.search.canSuggest(state.query, state.searchOptions);
    if ($('search-submit')) $('search-submit').disabled = !DK.search.canSubmit(state.query, state.searchOptions);
    input.setAttribute('aria-expanded', String(open));
    if (open && state.suggestIdx >= 0) input.setAttribute('aria-activedescendant', 'suggest-' + state.suggestIdx); else input.removeAttribute('aria-activedescendant');
    fitSearchSuggestions();
    // Finish the focus/click sequence before moving the field. Scrolling during
    // focus can retarget a tap's mouseup outside the input and close this popup.
    requestAnimationFrame(() => fitSearchSuggestions(true));
    if (open && state.suggestIdx >= 0) $('suggest-' + state.suggestIdx)?.scrollIntoView({ block: 'nearest' });
  }
  /** Share visual-viewport fitting between hero and header without replacing the input. */
  function fitSearchSuggestions(revealForm = false) {
    const list = $('search-suggest');
    if (!list) return;
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    let available = bottom - list.getBoundingClientRect().top;
    const form = document.querySelector('.ob-hero-search-form');
    const target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ob-touch-target'));
    if (revealForm === true && form && available < target * 2 && document.activeElement === $('search-input')) {
      form.scrollIntoView({ block: 'start' });
      available = bottom - list.getBoundingClientRect().top;
    }
    list.style.setProperty('--ob-suggest-available-height', available + 'px');
  }
  function syncVisualViewport(revealForm = false) {
    const viewport = window.visualViewport, style = document.documentElement.style;
    // Follow keyboard resizing/panning. During browser pinch zoom, retain native
    // modal geometry so zooming does not continuously shrink the dialog itself.
    if (viewport && viewport.scale === 1) {
      style.setProperty('--ob-visual-viewport-height', viewport.height + 'px');
      style.setProperty('--ob-visual-viewport-top', viewport.offsetTop + 'px');
    } else {
      style.removeProperty('--ob-visual-viewport-height');
      style.removeProperty('--ob-visual-viewport-top');
    }
    fitSearchSuggestions(revealForm);
  }
  // Update only the hosts affected by opening or closing a menu.
  const HEADER_MENUS = ['info', 'language'];
  function setMenu(next) {
    const prev = state.menu, hadSuggest = state.suggest;
    const hadFlyout = !!state.flyout;
    const closeSearch = !!next && state.searchOpen;
    if (closeSearch) state.searchOpen = false;
    state.flyout = null;
    state.menu = next; state.suggest = false; state.suggestIdx = -1;
    const inMain = m => !!m && !HEADER_MENUS.includes(m);
    if (inMain(prev) || inMain(next) || hadFlyout || closeSearch) app.render();
    else if (hadSuggest) renderSuggest();
    if (HEADER_MENUS.includes(prev) || HEADER_MENUS.includes(next)) renderHelp();
  }
  function closeTransient() { if (state.menu || state.suggest) setMenu(null); }

  function openMenu(button, last = false) {
    const host = button.closest('.ob-menu-host');
    const selector = (host.id ? '#' + CSS.escape(host.id) + ' ' : '') + `[data-action="menu"][data-menu="${CSS.escape(button.dataset.menu)}"]`;
    setMenu(button.dataset.menu);
    const items = document.querySelector(selector)?.closest('.ob-menu-host').querySelectorAll('.ob-menu-item');
    if (items?.length) items[last ? items.length - 1 : 0].focus();
  }
  function closeSuggest() {
    if (!state.suggest) return;
    state.suggest = false; state.suggestIdx = -1;
    renderSuggest();
  }

  /* search */
  function normalizeSearchPage() {
    if (!ctx.searchPage) return;
    const { sort } = ctx.searchPage;
    router.replaceParams({ ...DK.search.params(state.searchOptions), ...ui.pageParams(ctx.searchPage), sort: sort === 'relevance' ? null : sort });
    route = resolveRoute(); ctx.route = route;
  }
  function renderSearchResults() {
    route = resolveRoute();
    ctx = views.context(route, state);
    normalizeSearchPage();
    replaceHtml($('search-results-panel'), views.searchResults(ctx));
    observeTables();
  }
  function setSearchPage(patch) {
    // A page change is a history entry, while retaining the form's unsubmitted edits.
    router.pushParams(patch);
    renderSearchResults();
    const results = $('search-page');
    results?.focus({ preventScroll: true });
    results?.scrollIntoView({ block: 'start' });
  }
  function renderSearchOptions() {
    const host = $('search-options-host');
    if (host) replaceHtml(host, views.searchOptions(state));
  }
  function updateSearchOptions(patch, focusId) {
    state.searchOptions = { ...state.searchOptions, ...patch };
    state.suggest = false; state.suggestIdx = -1;
    if (['home', 'search'].includes(route.view)) router.replaceParams({ ...DK.search.params(state.searchOptions), ...(patch.kinds || patch.domains ? { page: null } : {}) });
    renderSearchOptions();
    renderSuggest();
    if (route.view === 'search') renderSearchResults();
    if (focusId) $(focusId)?.focus({ preventScroll: true });
  }
  /** Keep collection controls mounted while their results change. */
  function renderCollectionResults() {
    route = resolveRoute();
    ctx = views.context(route, state);
    syncVisibilityUrl();
    if (ctx.isRows) $('panel-rows').innerHTML = detail.rows(route.entity, route, state, ctx.rowList);
    else if (ctx.isList) $('collection-view-panel').innerHTML = views.list(ctx);
    observeTables();
  }
  function syncVisibilityUrl() {
    const kind = DK.presentation.routeKind(resolveRoute());
    if (kind) {
      const sort = ctx?.isList ? ctx.tableOptions?.sort : ctx?.isRows ? ctx.rowList?.options.sort : null;
      router.replaceParams({ fields: DK.presentation.selected(kind).join(','), sort: sort?.field ? `${sort.field}:${sort.direction}` : null,
        ...(ctx?.isRows ? ui.pageParams(ctx.rowList.paging) : {}) });
      route = resolveRoute(); ctx.route = route;
    }
  }
  app.refreshVisibility = () => { syncVisibilityUrl(); app.render(); };
  /** Update only results: keeping the input node preserves focus, selection and IME composition. */
  function filterCollection(value) {
    if (!ctx.isList && !ctx.isRows) return;
    const q = value.trim();
    $('collection-filter-clear').hidden = !value;
    if (q === ctx.filter) return;
    state.filteredClosed = {};
    router.replaceParams({ filter: q || null, ...(ctx.isRows ? { page: null } : {}) });
    renderCollectionResults();
    const status = $('collection-filter-status');
    status.className = q ? 'ob-collection-status' : 'ob-sr-only';
    status.textContent = ui.collectionCount(ctx);
  }
  function clearCollectionFilter() {
    const input = $('collection-filter');
    if (!input) return;
    input.value = '';
    filterCollection('');
    input.focus({ preventScroll: true });
  }
  /** Match the listbox order, including its final all-results row for a typed query. */
  const suggestItems = () => state.query.trim()
    ? [...DK.search.suggest(state.query, state.searchOptions).flatMap(g => g.items.map(e => ({ href: router.entityHref(g.kind, e.identifier) }))), { query: state.query.trim() }]
    : DK.search.examples(state.searchOptions);
  function openResults() {
    const q = state.query.trim();
    if (!DK.search.canSubmit(q, state.searchOptions)) return;
    state.suggest = false; state.suggestIdx = -1;
    router.navigate(router.searchHref(q, { ...DK.search.params(state.searchOptions), ...(route.view === 'search' ? { size: route.params.size, sort: route.params.sort, nav: route.params.nav } : {}) }));
  }
  function pickSuggestion(item) {
    if (item.query) {
      state.query = item.query;
      $('search-input').value = item.query;
      openResults();
    } else if (item.href) {
      state.suggest = false; state.suggestIdx = -1;
      router.navigate(item.href);
    }
  }
  function onSearchKey(e) {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown' && !state.suggest && DK.search.canSuggest(state.query, state.searchOptions)) state.suggest = true;
    const open = state.suggest && DK.search.canSuggest(state.query, state.searchOptions);
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); state.suggestIdx = Math.min(state.suggestIdx + 1, suggestItems().length - 1); renderSuggest(); return; }
    if (e.key === 'ArrowUp' && open) { e.preventDefault(); state.suggestIdx = Math.max(state.suggestIdx - 1, -1); renderSuggest(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = open && state.suggestIdx >= 0 ? suggestItems()[state.suggestIdx] : null;
      if (item) { pickSuggestion(item); return; }
      openResults(); return;
    }
    if (e.key === 'Escape') {
      if (state.suggest) { e.preventDefault(); closeSuggest(); }
      else if (!views.hasPageSearch(route)) { e.preventDefault(); setSearch(false); }
    }
  }

  /* exports */
  async function doExport(id, label) {
    if (id === 'diagram-pdf') { DK.diagramExport.open(route, ctx); return; }
    if (id === 'xlsx' || id === 'xlsx-all') {
      if (state.exporting) return;
      try {
        const plan = DK.excel.plan(route, ctx, window.location.href, { scope: id === 'xlsx-all' ? 'catalog' : 'selection' });
        state.exporting = true;
        app.render();
        // Paint the status before synchronous workbook preparation starts.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        await DK.excel.download(plan);
        ui.toast(t('excel.ready'));
      } catch (error) {
        console.error('Excel export failed:', error);
        ui.toast(t('excel.failed'), 'error');
      } finally {
        state.exporting = false;
        app.render();
      }
      return;
    }
    ui.toast(t('toolbar.notAvailable', { what: label }));
  }

  /* handbook */
  let chapterScrollLock = null, chapterScrollTimer = null;
  // Scroll tracking updates navigation without replacing chapter content.
  function updateChapterNav() {
    document.querySelectorAll('[data-action="chapter"]').forEach(a => {
      const active = a.dataset.chapter === state.chapter;
      if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      a.closest('.ob-tree-row').classList.toggle('is-active', active);
    });
  }
  function goChapter(id) {
    state.chapter = id;
    router.pushParams({ ch: id });
    if (state.navDrawerOpen) setNavigation(false);
    else if (state.flyout) closeFlyout(true);
    else updateChapterNav();
    const el = $(DK.manual.anchorId(id));
    if (el) {
      chapterScrollLock = id;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(el).scrollMarginTop), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      clearTimeout(chapterScrollTimer); chapterScrollTimer = setTimeout(() => { chapterScrollLock = null; }, 900);
    }
  }
  function onScroll() {
    updateBackToTop();
    fitSearchSuggestions();
    if (!route || route.view !== 'manual' || chapterScrollLock) return;
    const firstChapter = document.querySelector('.ob-chapter');
    if (!firstChapter) return;
    let activeChapter = data.manual.chapters[0].id;
    // Use the same CSS offset as chapter links, allowing a pixel for scroll rounding.
    const chapterThreshold = parseFloat(getComputedStyle(firstChapter).scrollMarginTop) + 1;
    data.manual.chapters.forEach(chapter => {
      const element = $(DK.manual.anchorId(chapter.id));
      if (element && element.getBoundingClientRect().top <= chapterThreshold) activeChapter = chapter.id;
    });
    if (activeChapter !== state.chapter) { state.chapter = activeChapter; router.replaceParams({ ch: activeChapter }); updateChapterNav(); }
  }

  /* events */
  function onClick(e) {
    const anchor = e.target.closest('a[href]');
    if (anchor && (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || anchor.target === '_blank' || anchor.hasAttribute('download'))) return;
    const action = e.target.closest('[data-action]');
    const samePageLink = e.target.closest('a[href^="#/"]');
    if (samePageLink && samePageLink.getAttribute('href') === location.hash && (state.navDrawerOpen || state.flyout)) {
      e.preventDefault();
      state.navDrawerOpen = false; state.flyout = null;
      app.render(); $('page-content').focus({ preventScroll: true }); return;
    }
    if (state.flyout && !e.target.closest('.ob-tree-panel') && !samePageLink) {
      state.flyout = null;
      app.render();
    }
    const el = action;
    if (!el) {
      if (e.target.closest('.ob-search-options')) return;
      if (e.target.id === 'search-input') { if (!state.suggest) { state.suggest = true; renderSuggest(); } return; }
      if (e.target.closest('.ob-popover, .ob-menu, #search-suggest')) return;
      const tr = e.target.closest('tr.is-clickable[data-href], .ob-tile[data-href]');
      if (tr && !e.target.closest('a, button')) { router.navigate(tr.dataset.href); return; }
      // A link to another route re-renders through hashchange; do not pull the link out of the DOM before it is followed.
      const link = e.target.closest('a[href^="#"]');
      if (link && link.getAttribute('href') !== location.hash) { state.menu = null; state.suggest = false; state.suggestIdx = -1; return; }
      if (state.searchOpen && !e.target.closest('.ob-header-search')) setSearch(false, false);
      closeTransient();
      return;
    }
    const key = el.dataset.key;
    if (el.dataset.action.startsWith('graph-')) { DK.graph.action(el, e); return; }
    switch (el.dataset.action) {
      case 'skip': e.preventDefault(); $('main').focus(); return;
      case 'back-to-top': e.preventDefault(); backToTop(); return;
      case 'toggle-search': setSearch(!state.searchOpen); return;
      case 'toggle-search-options':
        closeSuggest();
        state.searchFiltersOpen = !state.searchFiltersOpen;
        renderSearchOptions(); return;
      case 'search-types-none': updateSearchOptions({ kinds: [] }, 'search-type-' + DK.search.kinds()[0]); return;
      case 'search-types-all': updateSearchOptions({ kinds: DK.search.kinds() }, 'search-options-toggle'); return;
      case 'search-domains-none': updateSearchOptions({ domains: [] }, 'search-domain-' + DK.search.domains()[0]); return;
      case 'search-domains-all': updateSearchOptions({ domains: null }, 'search-options-toggle'); return;
      case 'hide-search-ai': updateSearchOptions({ ai: false }, 'search-options-toggle'); return;
      case 'toggle-sidebar':
        state.sidebarCollapsed = !state.sidebarCollapsed;
        state.flyout = null;
        DK.preferences.write('sidebarCollapsed', state.sidebarCollapsed);
        app.render(); return;
      case 'rail-section': {
        state.flyout = state.flyout === key ? null : key;
        state.menu = null; state.searchOpen = false; state.suggest = false; state.suggestIdx = -1;
        if (key !== 'manual') { state.treeOpen[key] = true; }
        app.render();
        if (state.flyout) $('sidebar-flyout').querySelector('a, button')?.focus();
        return;
      }
      case 'close-flyout': closeFlyout(true); return;
      case 'help-toggle': e.stopPropagation(); setMenu(state.menu === 'info' ? null : 'info'); return;
      case 'menu':
        e.stopPropagation();
        if (state.menu === el.dataset.menu) setMenu(null); else openMenu(el);
        return;
      case 'set-language': state.menu = null; setLanguage(el.dataset.lang); return;
      case 'field-picker':
        e.stopPropagation();
        DK.fieldPicker.open(el, el.dataset.fieldPicker, () => { syncVisibilityUrl(); renderCollectionResults(); }); return;
      case 'set-group': state.groupBy[route.kind] = el.dataset.group; state.closed = {}; state.filteredClosed = {}; state.menu = null; router.replaceParams({ group: el.dataset.group }); app.render(); return;
      case 'set-view': {
        if (ctx.isDomain) {
          state.detailTab = detail.resolveTab(route.entity, el.dataset.view);
          if (state.detailTab !== 'overview') state.mode = state.detailTab;
          router.replaceParams({ tab: state.detailTab, view: null, page: null });
        } else {
          state.mode = el.dataset.view;
          router.replaceParams({ view: state.mode });
        }
        app.render(); return;
      }
      case 'sort-table': {
        const sortKey = el.dataset.sortKey;
        const column = parseInt(el.dataset.sortColumn, 10);
        const headerDirection = el.closest('th')?.getAttribute('aria-sort');
        const field = el.dataset.sortField;
        const current = state.tableSorts[sortKey] || (headerDirection ? { column, field, direction: headerDirection === 'ascending' ? 'asc' : 'desc' } : null);
        const direction = current && (field ? current.field === field : current.column === column) && current.direction === 'asc' ? 'desc' : 'asc';
        state.tableSorts[sortKey] = field ? { field, direction } : { column, direction };
        if ((ctx.isList || ctx.isRows) && field) router.replaceParams({ sort: `${field}:${direction}` });
        if (['detail', 'search'].includes(route.view) && route.params.page) router.replaceParams({ page: null });
        app.render();
        return;
      }
      case 'toggle-group': {
        const closed = ctx.filter ? state.filteredClosed : state.closed;
        closed[key] = !closed[key]; app.render(); return;
      }
      case 'toggle-tree': e.preventDefault(); e.stopPropagation(); state.treeOpen[key] = !state.treeOpen[key]; app.render(); return;
      case 'open-navigation': e.preventDefault(); setNavigation(true); return;
      case 'close-navigation': e.preventDefault(); setNavigation(false); return;
      case 'open-overview': {
        state.treeOpen = {};
        if (route.view === 'home') { e.preventDefault(); app.render(); }
        return;
      }
      case 'open-tree': {
        state.treeOpen[key] = true;
        if (el.getAttribute('href') === location.hash) { e.preventDefault(); app.render(); }
        return;
      }
      case 'set-tab': {
        state.detailTab = detail.resolveTab(route.entity, el.dataset.tab);
        router.replaceParams({ tab: state.detailTab, page: null });
        app.render();
        return;
      }
      case 'set-page':
        if (route.view === 'search') { setSearchPage({ page: el.dataset.page === '1' ? null : el.dataset.page }); return; }
        router.replaceParams({ page: el.dataset.page === '1' ? null : el.dataset.page }); app.render();
        document.querySelector('.ob-detail-rows')?.scrollIntoView({ block: 'start' }); return;
      case 'toggle-relation-view': state.relationDiagram = !state.relationDiagram; app.render(); return;
      case 'export': { const id = el.dataset.export, label = el.dataset.label; state.menu = null; app.render(); doExport(id, label); return; }
      case 'clear-query': {
        state.query = ''; state.suggest = true; state.suggestIdx = -1;
        const input = $('search-input'); if (input) { input.value = ''; input.focus(); }
        $('search-clear').hidden = true; renderSuggest(); return;
      }
      case 'clear-collection-filter': clearCollectionFilter(); return;
      case 'suggest-example': pickSuggestion({ query: el.dataset.query }); return;
      case 'suggest-pick': state.suggest = false; state.suggestIdx = -1; router.navigate(el.dataset.href); return;
      case 'open-results': openResults(); return;
      case 'chapter': e.preventDefault(); goChapter(el.dataset.chapter); return;
      case 'not-available': e.preventDefault(); ui.toast(t('toolbar.notAvailable', { what: el.dataset.what || el.textContent.trim() })); return;
      case 'toast-close': el.closest('.ob-alert').remove(); return;
      default: return;
    }
  }

  function onInput(e) {
    if (e.target.id === 'collection-filter') {
      if (!e.isComposing) filterCollection(e.target.value);
      return;
    }
    if (e.target.id === 'search-input') {
      state.query = e.target.value; state.suggest = true; state.suggestIdx = -1;
      $('search-clear').hidden = !state.query;
      renderSuggest();
    }
  }

  function onKeydown(e) {
    if (DK.sidebar.onKeydown(e)) return;
    if (DK.graph.onKeydown(e)) return;
    if (e.target.matches('[data-action="menu"]') && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault(); openMenu(e.target, e.key === 'ArrowUp'); return;
    }
    const menu = e.target.closest('[role="menu"]');
    if (menu) {
      if (ui.menuKeydown(e, menu)) return;
      if (e.key === 'Tab') {
        // Restore the trigger synchronously; the native Tab action then leaves the closed menu.
        closeTransient();
      }
    }
    if (e.key === 'Tab' && state.navDrawerOpen) {
      const panel = $('navigation-panel');
      const controls = [...panel.querySelectorAll('a, button:not(:disabled), input, select, [tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      const focused = document.activeElement; // closing an inner menu may have restored its trigger
      if (e.shiftKey && (focused === first || !panel.contains(focused))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (focused === last || !panel.contains(focused))) { e.preventDefault(); first?.focus(); }
    }
    if (e.target.id === 'search-input') { onSearchKey(e); return; }
    if (e.target.id === 'collection-filter' && !e.isComposing && e.keyCode !== 229 && ['Escape', 'Enter'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'Escape') clearCollectionFilter();
      else filterCollection(e.target.value);
      return;
    }
    if (e.target.matches('.ob-tab') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const tabs = [...e.target.parentElement.querySelectorAll('.ob-tab')];
      const current = tabs.indexOf(e.target);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      e.preventDefault();
      tabs[next].focus(); // focus first so the re-render keeps it on the new tab
      tabs[next].click();
      return;
    }
    if (e.key === 'Escape' && (state.menu || state.suggest)) { closeTransient(); return; }
    if (e.key === 'Escape' && state.navDrawerOpen) { setNavigation(false); return; }
    if (e.key === 'Escape' && state.flyout) { closeFlyout(true); return; }
    if (e.key === 'Escape' && state.searchOpen) setSearch(false);
  }

  function onFocusin(e) {
    DK.graph.onFocusin(e);
    if (e.target.id === 'search-input' && !state.suggest) { state.suggest = true; renderSuggest(); }
  }
  function onFocusout(e) {
    const search = state.suggest && e.target.closest('.ob-search');
    if (search && !(e.relatedTarget && search.contains(e.relatedTarget))) closeSuggest();
  }

  /* language */
  function setLanguage(lang) {
    const cfg = data.config;
    const languages = cfg.app.languages || [cfg.app.language || 'de'];
    state.lang = languages.includes(lang) ? lang : languages[0];
    DK.preferences.write('language', state.lang);
    ui.setDictionary(data.i18n, state.lang, 'de');
    document.documentElement.lang = state.lang;
    $('skip-link').textContent = t('skip');
    $('brand-link').setAttribute('aria-label', `${cfg.app.organisation} – ${cfg.app.name} – ${t('nav.home')}`);
    $('main-nav').setAttribute('aria-label', t('nav.main'));
    $('header-tools').innerHTML = views.headerTools(state, route);
    $('footer').innerHTML = views.footer();
    const backToTopButton = $('back-to-top');
    backToTopButton.setAttribute('aria-label', t('backToTop.aria'));
    backToTopButton.innerHTML = `${ui.icon('arrow_right', 'sm')}<span>${ui.esc(t('backToTop.label'))}</span>`;
    if (route) {
      app.render();
      const button = document.querySelector(state.navDrawerOpen ? '#drawer-language-host .ob-language-select' : '#language-host .ob-language-select');
      if (button) button.focus({ preventScroll: true });
    }
  }

  /* init */
  app.init = async function () {
    try {
      if (!DK.catalogConfig) throw new Error('Missing catalog connection configuration');
      await data.load('data/');
    } catch (err) {
      // The dictionary is part of the failed load, so this bootstrap fallback must stand on its own.
      $('main').innerHTML = ui.empty('Datenkatalog konnte nicht geladen werden', `Bitte laden Sie die Seite erneut.<div class="ob-load-error-detail">${ui.esc(err.message)}</div>`);
      $('main').setAttribute('aria-busy', 'false');
      ui.setLoading();
      console.error(err);
      return;
    }
    const cfg = data.config;
    DK.sidebar.init();
    state.sidebarCollapsed = DK.preferences.read('sidebarCollapsed') === 'true';
    if (cfg.compactTables) document.documentElement.classList.add('ob-density-compact');
    $('brand-acronym').textContent = cfg.app.organisationShort || '';
    $('brand-org').textContent = cfg.app.organisation;
    $('brand-app').textContent = cfg.app.name;
    setLanguage(DK.preferences.read('language') || cfg.app.language || 'de');

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('compositionend', e => {
      if (e.target.id === 'collection-filter') filterCollection(e.target.value);
    });
    document.addEventListener('submit', e => {
      if (!e.target.matches('.ob-hero-search-form')) return;
      e.preventDefault(); openResults();
    });
    document.addEventListener('change', e => {
      if (e.target.matches('[data-search-domain]')) {
        const id = e.target.dataset.searchDomain;
        if (DK.search.domains().includes(id)) {
          const selected = new Set(DK.search.selectedDomains(state.searchOptions));
          if (e.target.checked) selected.add(id); else selected.delete(id);
          updateSearchOptions({ domains: DK.search.domains().filter(d => selected.has(d)) });
        }
        return;
      }
      if (e.target.matches('[data-search-kind]')) {
        const kind = e.target.dataset.searchKind;
        if (DK.search.kinds().includes(kind)) {
          const selected = new Set(DK.search.selectedKinds(state.searchOptions));
          if (e.target.checked) selected.add(kind); else selected.delete(kind);
          updateSearchOptions({ kinds: DK.search.kinds().filter(k => selected.has(k)) });
        }
        return;
      }
      if (e.target.id === 'search-ai') { updateSearchOptions({ ai: e.target.checked }); return; }
      if (e.target.matches('[data-action="set-search-sort"]')) {
        setSearchPage({ sort: e.target.value === 'relevance' ? null : e.target.value, page: null });
        $('search-sort')?.focus({ preventScroll: true });
        return;
      }
      if (e.target.matches('[data-action="set-page-size"]')) {
        if (route.view === 'search') { setSearchPage({ size: e.target.value, page: null }); return; }
        router.replaceParams(ui.pageParams(ui.pageState(0, { size: e.target.value })));
        app.render();
      }
      if (e.target.matches('[data-action="sort-cards"]') && e.target.value) {
        const [column, direction] = e.target.value.split(':');
        state.tableSorts[e.target.dataset.sortKey] = /^\d+$/.test(column) ? { column: Number(column), direction } : { field: column, direction };
        if ((ctx.isList || ctx.isRows) && !/^\d+$/.test(column)) router.replaceParams({ sort: `${column}:${direction}` });
        if (['detail', 'search'].includes(route.view)) router.replaceParams({ page: null });
        app.render();
      }
    });
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('focusin', onFocusin);
    document.addEventListener('focusout', onFocusout);
    document.addEventListener('mousedown', e => { if (e.target.closest('#search-suggest')) e.preventDefault(); });
    document.addEventListener('pointerdown', DK.graph.onPointerDown);
    document.addEventListener('pointermove', DK.graph.onPointerMove);
    document.addEventListener('pointerup', DK.graph.onPointerUp);
    document.addEventListener('pointercancel', DK.graph.onPointerUp);
    document.addEventListener('wheel', DK.graph.onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { updateBackToTop(); requestAnimationFrame(() => { revealActiveTab(); DK.graph.resize(); syncVisualViewport(true); }); }, { passive: true });
    window.visualViewport?.addEventListener('resize', () => syncVisualViewport(true), { passive: true });
    window.visualViewport?.addEventListener('scroll', () => syncVisualViewport(), { passive: true });
    window.addEventListener('hashchange', app.onRoute);
    window.matchMedia('(max-width: 960px)').addEventListener('change', event => {
      const navigationHadFocus = state.navDrawerOpen || state.flyout || document.activeElement?.closest('#navigation-panel, .ob-navigation-toggle');
      state.navDrawerOpen = false; state.flyout = null; app.render();
      if (navigationHadFocus) {
        const target = event.matches ? document.querySelector('.ob-navigation-toggle') : document.querySelector('[data-action="toggle-sidebar"]') || $('main-nav').querySelector('[aria-current="page"]');
        target?.focus({ preventScroll: true });
      }
    });

    syncVisualViewport();
    app.onRoute();
    $('main').setAttribute('aria-busy', 'false');
  };

  DK.app = app;
  document.addEventListener('DOMContentLoaded', app.init);
})(window.DK);
