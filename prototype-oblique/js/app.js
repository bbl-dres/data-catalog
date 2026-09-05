/* app.js – bootstrap, UI state and event handling.
   Rendering is "render everything from state": the URL (router) plus the
   transient state below are turned into HTML by views.js / detail.js. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router, views = DK.views, detail = DK.detail;
  const t = ui.t;

  /** Transient UI state that is not part of the URL. */
  const state = {
    query: '', suggest: false, suggestIdx: -1,
    menu: null,                       // null | 'info' | 'language' | 'group' | 'actions'
    lang: 'de',                       // active UI language (one of config.languages)
    mode: 'tiles',                    // tiles | table (URL ?view= overrides)
    groupBy: {},                      // per section (URL ?group= overrides)
    closed: {},                       // collapsed list groups
    filteredClosed: {},               // search disclosures do not alter unfiltered groups
    treeOpen: { objects: true },      // expanded tree nodes
    treeSection: 'objects',           // section whose branch is open (others collapse on section change)
    graph: DK.graph.createState(),
    relationDiagram: true,
    metadataOpen: false,
    navDrawerOpen: false,
    sidebarCollapsed: false,
    flyout: null,
    searchOpen: false,
    chapter: 'einleitung',
    lastEntity: null,
    detailTab: 'overview',             // carried only between consecutive detail routes
    tableSorts: {},                    // per table key: { column, direction: asc | desc }
  };
  const app = { state };
  let route = null;
  let ctx = null;

  /* ---- rendering ---------------------------------------------------------- */
  const $ = id => document.getElementById(id);

  // Tables respond to their own width (also when the sidebar or home columns change).
  // One observer keeps DOM semantics and keyboard focus in sync with card mode.
  function adaptTable(region) {
    if (!region.isConnected) return;
    const cards = region.clientWidth < Number(region.dataset.tableMinWidth);
    const wasCards = region.classList.contains('is-cards');
    const focused = region.contains(document.activeElement) ? document.activeElement : null;
    region.classList.toggle('is-cards', cards);
    const select = region.querySelector('[data-action="sort-cards"]');
    if (select) select.closest('label').hidden = !cards;
    if (cards !== wasCards && focused) {
      if (cards && focused.matches('.ob-table-sort')) select?.focus({ preventScroll: true });
      else if (!cards && focused === select) {
        const column = Number(select.value.split(':')[0]);
        region.querySelector(`[data-sort-column="${column}"]`)?.focus({ preventScroll: true });
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
    data.navModelOverride = r.params.nav || null;
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
    const k = r.kind === 'attrs' ? 'objects' : r.kind;
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
    const diagramHadFocus = DK.graph.closeFullscreen(false);
    DK.graph.onPointerUp();
    const previous = route;
    const navigationHadFocus = diagramHadFocus || state.navDrawerOpen || !!state.flyout || !!document.activeElement?.closest('.ob-search, #home-search');
    route = resolveRoute();
    state.navDrawerOpen = false;
    state.flyout = null;
    state.searchOpen = false;
    state.menu = null; state.suggest = false; state.suggestIdx = -1;
    state.filteredClosed = {};

    if (route.view === 'detail') {
      // Fresh loads and entries from non-detail views start at Übersicht; between profiles the
      // semantic tab is kept when the target has it (docs/design-review-responsive.md, "Tab continuity").
      const requested = !previous ? 'overview' : route.params.tab || (previous.view === 'detail' ? state.detailTab : 'overview');
      state.detailTab = detail.resolveTab(route.entity, requested);
      const wanted = state.detailTab === 'overview' ? undefined : state.detailTab;
      if (route.params.tab !== wanted) router.replaceParams({ tab: wanted || null, page: null });
    } else {
      state.detailTab = 'overview';
    }

    // Entering another section collapses the other branches so the tree shows only the current path.
    const section = sectionOf(route);
    if (section && section !== state.treeSection) { state.treeOpen = { [section]: true }; state.treeSection = section; }
    if (section) state.treeOpen[section] = true;
    if (route.view === 'list' && route.params.domain) state.treeOpen[`${route.kind}:domain:${route.params.domain}`] = true;
    const key = route.entity ? `${route.kind}:${route.id}` : null;
    if (key !== state.lastEntity) { state.graph = DK.graph.createState(); state.relationDiagram = true; state.metadataOpen = false; state.lastEntity = key; }
    if (route.view === 'search') state.query = route.params.q || '';
    if (route.view === 'manual') state.chapter = route.params.ch || state.chapter;
    app.render(true);
    if (navigationHadFocus) $('page-content').focus({ preventScroll: true });
    renderHelp();
    if (route.view === 'manual' && route.params.ch) {
      const el = $('hb-' + route.params.ch);
      if (el) el.scrollIntoView({ block: 'start' });
    } else if (route.view !== 'manual') {
      window.scrollTo(0, 0);
    }
  };

  /** Re-render nav + main from the current route and state. `navigated`: a new page, focus is not restored. */
  app.render = function (navigated) {
    const mainFocus = !navigated && focusSelector(document.activeElement, $('main'));
    if (!navigated) state.metadataOpen = document.querySelector('.ob-metadata')?.open ?? state.metadataOpen;
    // Swagger owns a live component tree. Reattach its node on chrome updates instead of remounting it.
    const swaggerHost = !navigated && route?.view === 'api' ? $('swagger-ui') : null;
    const swaggerFocus = swaggerHost?.contains(document.activeElement) ? document.activeElement : null;
    const treeScroll = document.querySelector('.ob-sidebar-tree')?.scrollTop || 0;
    const flyoutScroll = $('sidebar-flyout')?.scrollTop || 0;
    route = resolveRoute(); // re-read: replaceParams() may have changed tab/page/view/group
    if (route.params.view) state.mode = route.params.view === 'table' ? 'table' : 'tiles';
    if (route.view === 'list' && route.params.group) state.groupBy[route.kind] = route.params.group;
    const page = views.page(route, state);
    ctx = page.ctx;
    replaceHtml($('main-nav'), views.mainNav(route));
    replaceHtml($('header-tools'), views.headerTools(state, route));
    if (navigated) $('main').innerHTML = page.html; else replaceHtml($('main'), page.html);
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
    document.title = `${ctx.title} – ${data.config.app.name} ${data.config.app.organisation}`;
    requestAnimationFrame(() => { revealActiveTab(); DK.graph.resize(); fitHomeSuggestions(); });
    updateBackToTop();
    if (route.view === 'api') renderSwagger();
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

  /* ---- API page: Swagger UI is loaded on first use (1.7 MB that other pages never need) ---- */
  let swaggerLoader = null;
  const swaggerMounts = new WeakSet();
  function loadSwagger() {
    if (typeof window.SwaggerUIBundle === 'function') return Promise.resolve();
    if (!swaggerLoader) swaggerLoader = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'vendor/swagger-ui/swagger-ui.css';
      document.head.insertBefore(css, $('main-css')); // before main.css so the app's overrides keep winning
      const script = document.createElement('script');
      script.src = 'vendor/swagger-ui/swagger-ui-bundle.js';
      script.onload = resolve;
      script.onerror = () => { swaggerLoader = null; script.remove(); css.remove(); reject(new Error('swagger-ui-bundle.js could not be loaded')); };
      document.head.appendChild(script);
    });
    return swaggerLoader;
  }
  async function renderSwagger() {
    const host = $('swagger-ui');
    if (!host || swaggerMounts.has(host)) return;
    swaggerMounts.add(host); // includes pending mounts while the bundle is loading
    try { await loadSwagger(); } catch (err) { console.error(err); }
    if (!host.isConnected) return; // the page was re-rendered or left while the bundle loaded
    if (typeof window.SwaggerUIBundle !== 'function') {
      swaggerMounts.delete(host); // a later render can retry a failed load
      host.setAttribute('aria-busy', 'false');
      host.innerHTML = ui.empty(t('api.unavailable'));
      return;
    }
    window.SwaggerUIBundle({
      url: 'data/swagger.json',
      domNode: host,
      deepLinking: false,
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
      filter: true,
      supportedSubmitMethods: [],
      validatorUrl: null,
      presets: [window.SwaggerUIBundle.presets.apis],
      onComplete: () => host.setAttribute('aria-busy', 'false'),
    });
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
    state.searchOpen = open && route.view !== 'home';
    state.flyout = null;
    state.suggest = open && !!state.query.trim();
    state.suggestIdx = -1;
    state.menu = null;
    app.render();
    if (restoreFocus) {
      const target = open ? $('search-input') : document.querySelector('[data-action="toggle-search"]');
      if (open && route.view === 'home') $('home-search').scrollIntoView({ block: 'start' });
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

  /** Re-render the header widgets that depend on transient state (help popover, language menu). */
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
    const open = state.suggest && !!state.query.trim();
    if ($('search-submit')) $('search-submit').disabled = !state.query.trim();
    input.setAttribute('aria-expanded', String(open));
    if (open && state.suggestIdx >= 0) input.setAttribute('aria-activedescendant', 'suggest-' + state.suggestIdx); else input.removeAttribute('aria-activedescendant');
    fitHomeSuggestions();
    if (open && state.suggestIdx >= 0) $('suggest-' + state.suggestIdx)?.scrollIntoView({ block: 'nearest' });
  }
  function fitHomeSuggestions() {
    const list = $('home-search') && $('search-suggest');
    if (!list) return;
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    let available = bottom - list.getBoundingClientRect().top;
    if (available < 88 && document.activeElement === $('search-input')) {
      $('home-search').scrollIntoView({ block: 'start' });
      available = bottom - list.getBoundingClientRect().top;
    }
    list.style.setProperty('--ob-suggest-available-height', available + 'px');
  }
  /** Open a menu (`info` and `language` live in the header, the others in main) or close all; re-renders only what changed. */
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

  /* ---- search ---------------------------------------------------------------- */
  /** Update only results: keeping the input node preserves focus, selection and IME composition. */
  function filterCollection(value) {
    if (route.view !== 'list') return;
    const q = value.trim();
    $('collection-filter-clear').hidden = !value;
    if (q === ctx.filter) return;
    state.filteredClosed = {};
    router.replaceParams({ filter: q || null });
    route = resolveRoute();
    ctx = views.context(route, state);
    $('collection-view-panel').innerHTML = views.list(ctx);
    const status = $('collection-filter-status');
    status.className = q ? 'ob-collection-status' : 'ob-sr-only';
    status.textContent = views.collectionStatus(ctx);
    observeTables();
  }
  function clearCollectionFilter() {
    const input = $('collection-filter');
    if (!input) return;
    input.value = '';
    filterCollection('');
    input.focus({ preventScroll: true });
  }
  /** Hrefs of the current suggestions in listbox order; the "all results" row follows at index length. */
  const suggestHrefs = () => data.suggest(state.query).flatMap(g => g.items.map(e => router.entityHref(g.kind, e.identifier)));
  function openResults() {
    const q = state.query.trim();
    state.suggest = false; state.suggestIdx = -1;
    if (!q) return;
    router.navigate(router.searchHref(q));
  }
  function onSearchKey(e) {
    if (e.isComposing) return;
    const open = state.suggest && !!state.query.trim();
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); state.suggestIdx = Math.min(state.suggestIdx + 1, suggestHrefs().length); renderSuggest(); return; }
    if (e.key === 'ArrowUp' && open) { e.preventDefault(); state.suggestIdx = Math.max(state.suggestIdx - 1, -1); renderSuggest(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const href = open && state.suggestIdx >= 0 ? suggestHrefs()[state.suggestIdx] : null;
      if (href) { state.suggest = false; state.suggestIdx = -1; router.navigate(href); return; }
      openResults(); return;
    }
    if (e.key === 'Escape') {
      if (state.suggest) closeSuggest();
      else if (route.view !== 'home') setSearch(false);
    }
  }

  /* ---- exports --------------------------------------------------------------- */
  function doExport(id, label) {
    if (id === 'csv') {
      if (route.view === 'list') {
        const header = ctx.columns.map(c => c.label);
        const rows = [];
        ctx.groups.forEach(g => g.items.forEach(e => { const c = data.cols(route.kind, e); rows.push([e.name, c[0], c[1], c[2], data.statusOf(route.kind, e)]); }));
        ui.downloadCsv(`${route.kind}.csv`, header, rows);
      } else if (route.entity) {
        const rd = detail.rowsData(route.entity);
        ui.downloadCsv(`${ui.slug(route.entity.name)}-${ui.slug(detail.rowsLabel(route.entity) || 'export')}.csv`, rd.columns.map(c => c.label), rd.rows.map(r => r.text));
      }
      return;
    }
    if (id === 'pdf' || id === 'profile-pdf') { setTimeout(() => window.print(), 50); return; }
    ui.toast(t('toolbar.notAvailable', { what: label }));
  }

  /* ---- handbook ---------------------------------------------------------------- */
  let hbLock = null, hbTimer = null;
  /** Mark the current chapter in the chapter list and the drawer button without re-rendering the page. */
  function updateChapterNav() {
    document.querySelectorAll('[data-action="chapter"]').forEach(a => {
      const active = a.dataset.chapter === state.chapter;
      if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      a.closest('.ob-tree-row').classList.toggle('is-active', active);
    });
    const path = document.querySelector('.ob-mobile-navigation-path');
    const chapter = data.manual.chapters.find(c => c.id === state.chapter);
    if (path && chapter) path.textContent = chapter.title;
  }
  function goChapter(id) {
    state.chapter = id;
    router.replaceParams({ ch: id });
    if (state.navDrawerOpen) setNavigation(false);
    else if (state.flyout) closeFlyout(true);
    else updateChapterNav();
    const el = $('hb-' + id);
    if (el) {
      hbLock = id;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(el).scrollMarginTop), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      clearTimeout(hbTimer); hbTimer = setTimeout(() => { hbLock = null; }, 900);
    }
  }
  function onScroll() {
    updateBackToTop();
    if (!route || route.view !== 'manual' || hbLock) return;
    let cur = data.manual.chapters[0].id;
    const chapterThreshold = $('header').getBoundingClientRect().height + 24;
    data.manual.chapters.forEach(c => { const el = $('hb-' + c.id); if (el && el.getBoundingClientRect().top <= chapterThreshold) cur = c.id; });
    if (cur !== state.chapter) { state.chapter = cur; updateChapterNav(); }
  }

  /* ---- events ------------------------------------------------------------------- */
  function onClick(e) {
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
      if (e.target.id === 'search-input') { if (!state.suggest && state.query.trim()) { state.suggest = true; renderSuggest(); } return; }
      if (e.target.closest('.ob-popover, .ob-menu, #search-suggest')) return;
      const tr = e.target.closest('tr.is-clickable[data-href]');
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
      case 'toggle-sidebar':
        state.sidebarCollapsed = !state.sidebarCollapsed;
        state.flyout = null;
        try { localStorage.setItem('datenkatalog.sidebarCollapsed', String(state.sidebarCollapsed)); } catch (err) { /* storage unavailable */ }
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
      case 'set-group': state.groupBy[route.kind] = el.dataset.group; state.closed = {}; state.filteredClosed = {}; state.menu = null; router.replaceParams({ group: el.dataset.group }); app.render(); return;
      case 'set-view': state.mode = el.dataset.view; router.replaceParams({ view: state.mode }); app.render(); return;
      case 'sort-table': {
        const sortKey = el.dataset.sortKey;
        const column = parseInt(el.dataset.sortColumn, 10);
        const headerDirection = el.closest('th')?.getAttribute('aria-sort');
        const current = state.tableSorts[sortKey] || (headerDirection ? { column, direction: headerDirection === 'ascending' ? 'asc' : 'desc' } : null);
        const direction = current && current.column === column && current.direction === 'asc' ? 'desc' : 'asc';
        state.tableSorts[sortKey] = { column, direction };
        if (route.view === 'detail' && route.params.page) router.replaceParams({ page: null });
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
        router.replaceParams({ tab: state.detailTab === 'overview' ? null : state.detailTab, page: null });
        app.render();
        return;
      }
      case 'set-page':
        router.replaceParams({ page: el.dataset.page === '1' ? null : el.dataset.page }); app.render();
        document.querySelector('.ob-detail-rows')?.scrollIntoView({ block: 'start' }); return;
      case 'toggle-relation-view': state.relationDiagram = !state.relationDiagram; app.render(); return;
      case 'export': { const id = el.dataset.export, label = el.dataset.label; state.menu = null; app.render(); doExport(id, label); return; }
      case 'clear-query': {
        state.query = ''; state.suggest = false; state.suggestIdx = -1;
        if (route.view === 'search') { router.navigate('#/'); return; }
        const input = $('search-input'); if (input) { input.value = ''; input.focus(); }
        $('search-clear').hidden = true; renderSuggest(); return;
      }
      case 'clear-collection-filter': clearCollectionFilter(); return;
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
    if (DK.graph.onKeydown(e)) return;
    if (e.target.matches('[data-action="menu"]') && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault(); openMenu(e.target, e.key === 'ArrowUp'); return;
    }
    const menu = e.target.closest('[role="menu"]');
    if (menu) {
      const items = [...menu.querySelectorAll('.ob-menu-item:not(:disabled)')];
      const current = items.indexOf(e.target);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus(); return;
      }
      if (e.key === 'Tab') {
        // Restore the trigger synchronously; the native Tab action then leaves the closed menu.
        closeTransient();
      } else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const next = items.slice(current + 1).concat(items.slice(0, current + 1)).find(item => item.textContent.trim().toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase()));
        if (next) { e.preventDefault(); next.focus(); }
        return;
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
    if (e.target.id === 'search-input' && state.query.trim() && !state.suggest) { state.suggest = true; renderSuggest(); }
  }
  function onFocusout(e) {
    const search = state.suggest && e.target.closest('.ob-search');
    if (search && !(e.relatedTarget && search.contains(e.relatedTarget))) closeSuggest();
  }

  /* ---- language ---------------------------------------------------------------------- */
  const LANG_KEY = 'datenkatalog.lang';
  /** Install a UI language: dictionary, <html lang>, static chrome, then a full re-render. Remembered per browser. */
  function setLanguage(lang) {
    const cfg = data.config;
    const languages = cfg.app.languages || [cfg.app.language || 'de'];
    state.lang = languages.includes(lang) ? lang : languages[0];
    try { localStorage.setItem(LANG_KEY, state.lang); } catch (err) { /* storage unavailable */ }
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
  function storedLanguage() {
    try { return localStorage.getItem(LANG_KEY); } catch (err) { return null; }
  }

  /* ---- init ------------------------------------------------------------------------ */
  app.init = async function () {
    try {
      await data.load('data/');
    } catch (err) {
      // The dictionary is part of the failed load, so this bootstrap fallback must stand on its own.
      $('main').innerHTML = ui.empty('Datenkatalog konnte nicht geladen werden', `Bitte laden Sie die Seite erneut.<div class="ob-load-error-detail">${ui.esc(err.message)}</div>`);
      console.error(err);
      return;
    }
    const cfg = data.config;
    try { state.sidebarCollapsed = localStorage.getItem('datenkatalog.sidebarCollapsed') === 'true'; } catch (err) { /* storage unavailable */ }
    if (cfg.compactTables) document.documentElement.classList.add('ob-density-compact');
    $('brand-acronym').textContent = cfg.app.organisationShort || '';
    $('brand-org').textContent = cfg.app.organisation;
    $('brand-app').textContent = cfg.app.name;
    setLanguage(storedLanguage() || cfg.app.language || 'de');

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('compositionend', e => {
      if (e.target.id === 'collection-filter') filterCollection(e.target.value);
    });
    document.addEventListener('submit', e => {
      if (e.target.id !== 'home-search') return;
      e.preventDefault(); openResults();
    });
    document.addEventListener('change', e => {
      if (e.target.matches('[data-action="set-page-size"]')) {
        router.replaceParams({ size: e.target.value === '50' ? null : e.target.value, page: null });
        app.render();
      }
      if (e.target.matches('[data-action="sort-cards"]') && e.target.value) {
        const [column, direction] = e.target.value.split(':');
        state.tableSorts[e.target.dataset.sortKey] = { column: Number(column), direction };
        if (route.view === 'detail') router.replaceParams({ page: null });
        app.render();
      }
    });
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('focusin', onFocusin);
    document.addEventListener('focusout', onFocusout);
    document.addEventListener('toggle', e => {
      if (e.target.matches('.ob-metadata') && e.target.isConnected) state.metadataOpen = e.target.open;
    }, true);
    document.addEventListener('mousedown', e => { if (e.target.closest('#search-suggest')) e.preventDefault(); });
    document.addEventListener('pointerdown', DK.graph.onPointerDown);
    document.addEventListener('pointermove', DK.graph.onPointerMove);
    document.addEventListener('pointerup', DK.graph.onPointerUp);
    document.addEventListener('pointercancel', DK.graph.onPointerUp);
    document.addEventListener('wheel', DK.graph.onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { updateBackToTop(); requestAnimationFrame(() => { revealActiveTab(); DK.graph.resize(); fitHomeSuggestions(); }); }, { passive: true });
    window.visualViewport?.addEventListener('resize', fitHomeSuggestions, { passive: true });
    window.addEventListener('hashchange', app.onRoute);
    window.matchMedia('(max-width: 960px)').addEventListener('change', event => {
      const navigationHadFocus = state.navDrawerOpen || state.flyout || document.activeElement?.closest('#navigation-panel, .ob-navigation-toggle');
      state.navDrawerOpen = false; state.flyout = null; app.render();
      if (navigationHadFocus) {
        const target = event.matches ? document.querySelector('.ob-navigation-toggle') : document.querySelector('[data-action="toggle-sidebar"]') || $('main-nav').querySelector('[aria-current="page"]');
        target?.focus({ preventScroll: true });
      }
    });

    app.onRoute();
  };

  DK.app = app;
  document.addEventListener('DOMContentLoaded', app.init);
})(window.DK);
