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
    menu: null,                       // null | 'info' | 'group' | 'actions'
    mode: 'tiles',                    // tiles | table (URL ?view= overrides)
    groupBy: {},                      // per section (URL ?group= overrides)
    closed: {},                       // collapsed list groups
    treeOpen: { objects: true },      // expanded tree nodes
    treeSection: 'objects',           // section whose branch is open (others collapse on section change)
    graph: { x: 0, y: 0 },            // pan offset of the relation graph
    relationDiagram: false,
    navDrawerOpen: false,
    chapter: 'einleitung',
    lastEntity: null,
    detailTab: 'overview',             // carried only between consecutive detail routes
    tableSorts: {},                    // per table key: { column, direction: asc | desc }
  };
  const app = { state };
  let route = null;
  let ctx = null;
  let treeViewportFrame = null;

  /* ---- rendering ---------------------------------------------------------- */
  const $ = id => document.getElementById(id);

  function resolveRoute() {
    const r = router.parse();
    data.navModelOverride = r.params.nav || null;
    r.entity = null;
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
    const previous = route;
    route = resolveRoute();
    state.navDrawerOpen = false;
    state.menu = null; state.suggest = false; state.suggestIdx = -1;

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
    const key = route.entity ? `${route.kind}:${route.id}` : null;
    if (key !== state.lastEntity) { state.graph = { x: 0, y: 0 }; state.relationDiagram = false; state.lastEntity = key; }
    if (route.view === 'search') state.query = route.params.q || '';
    if (route.view === 'manual') state.chapter = route.params.ch || state.chapter;
    app.render(true);
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
    route = resolveRoute(); // re-read: replaceParams() may have changed tab/page/view/group
    if (route.params.view) state.mode = route.params.view === 'table' ? 'table' : 'tiles';
    if (route.view === 'list' && route.params.group) state.groupBy[route.kind] = route.params.group;
    const page = views.page(route, state);
    ctx = page.ctx;
    $('main-nav').innerHTML = views.mainNav(route);
    if (navigated) $('main').innerHTML = page.html; else replaceHtml($('main'), page.html);
    document.documentElement.classList.toggle('ob-navigation-open', state.navDrawerOpen);
    document.title = `${ctx.title} – ${data.config.app.name} ${data.config.app.organisation}`;
    requestAnimationFrame(revealActiveTab);
    scheduleTreeViewport();
    updateBackToTop();
    if (route.view === 'api') renderSwagger();
  };

  /** Keep a desktop tree's complete scrollport inside the visible viewport. */
  function scheduleTreeViewport() {
    if (treeViewportFrame !== null) return;
    treeViewportFrame = requestAnimationFrame(() => {
      treeViewportFrame = null;
      document.querySelectorAll('.ob-tree-panel:not(.is-mobile-open)').forEach(panel => {
        if (window.matchMedia('(max-width: 960px)').matches) {
          panel.style.removeProperty('--ob-tree-available-height');
          return;
        }
        const top = Math.max(0, panel.getBoundingClientRect().top);
        panel.style.setProperty('--ob-tree-available-height', `${Math.max(160, Math.floor(window.innerHeight - top))}px`);
      });
    });
  }

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
    if (!host) return;
    try { await loadSwagger(); } catch (err) { console.error(err); }
    if (!host.isConnected) return; // the page was re-rendered or left while the bundle loaded
    if (typeof window.SwaggerUIBundle !== 'function') {
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
    const tabs = document.querySelector('.ob-tabs');
    const active = tabs && tabs.querySelector('.ob-tab[aria-selected="true"]');
    if (!active || tabs.scrollWidth <= tabs.clientWidth) return;
    const left = active.offsetLeft - (tabs.clientWidth - active.offsetWidth) / 2;
    tabs.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
  }

  function setNavigation(open) {
    state.navDrawerOpen = open;
    app.render();
    requestAnimationFrame(() => {
      const target = open ? document.querySelector('.ob-tree-panel.is-mobile-open [data-action="close-navigation"]') : document.querySelector('[data-action="open-navigation"]');
      if (target) target.focus({ preventScroll: true });
    });
  }

  function renderHelp() { const h = $('help-host'); if (h) replaceHtml(h, views.helpHost(state)); }
  function renderSuggest() {
    const host = $('search-suggest-host'); if (!host) return;
    host.innerHTML = views.suggest(state);
    const input = $('search-input');
    const open = state.suggest && !!state.query.trim();
    input.setAttribute('aria-expanded', String(open));
    if (open && state.suggestIdx >= 0) input.setAttribute('aria-activedescendant', 'suggest-' + state.suggestIdx); else input.removeAttribute('aria-activedescendant');
  }
  /** Open a menu (`info` lives in the header, the others in main) or close all; re-renders only what changed. */
  function setMenu(next) {
    const prev = state.menu, hadSuggest = state.suggest;
    state.menu = next; state.suggest = false; state.suggestIdx = -1;
    const inMain = m => !!m && m !== 'info';
    if (inMain(prev) || inMain(next)) app.render();
    else if (hadSuggest) renderSuggest();
    if (prev === 'info' || next === 'info') renderHelp();
  }
  function closeTransient() { if (state.menu || state.suggest) setMenu(null); }
  function closeSuggest() {
    if (!state.suggest) return;
    state.suggest = false; state.suggestIdx = -1;
    renderSuggest();
  }

  /* ---- search ---------------------------------------------------------------- */
  /** Hrefs of the current suggestions in listbox order; the "all results" row follows at index length. */
  const suggestHrefs = () => data.suggest(state.query).flatMap(g => g.items.map(e => router.entityHref(g.kind, e.identifier)));
  function openResults() {
    const q = state.query.trim();
    state.suggest = false; state.suggestIdx = -1;
    if (!q) return;
    router.navigate(router.searchHref(q));
  }
  function onSearchKey(e) {
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
      else { state.query = ''; e.target.value = ''; $('search-clear').hidden = true; }
    }
  }

  /* ---- graph ------------------------------------------------------------------- */
  let drag = null;
  function applyGraphTransform() { const c = $('graph-canvas'); if (c) c.style.transform = detail.graphTransform(state.graph); }

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
    if (state.navDrawerOpen) setNavigation(false); else updateChapterNav();
    const el = $('hb-' + id);
    if (el) {
      hbLock = id;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' });
      clearTimeout(hbTimer); hbTimer = setTimeout(() => { hbLock = null; }, 900);
    }
  }
  function onScroll() {
    scheduleTreeViewport();
    updateBackToTop();
    if (!route || route.view !== 'manual' || hbLock) return;
    let cur = data.manual.chapters[0].id;
    data.manual.chapters.forEach(c => { const el = $('hb-' + c.id); if (el && el.getBoundingClientRect().top <= 120) cur = c.id; });
    if (cur !== state.chapter) { state.chapter = cur; updateChapterNav(); }
  }

  /* ---- events ------------------------------------------------------------------- */
  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) {
      if (e.target.id === 'search-input') { if (!state.suggest && state.query.trim()) { state.suggest = true; renderSuggest(); } return; }
      if (e.target.closest('.ob-popover, .ob-menu, #search-suggest')) return;
      const tr = e.target.closest('tr.is-clickable[data-href]');
      if (tr && !e.target.closest('a, button')) { router.navigate(tr.dataset.href); return; }
      // A link to another route re-renders through hashchange; do not pull the link out of the DOM before it is followed.
      const link = e.target.closest('a[href^="#"]');
      if (link && link.getAttribute('href') !== location.hash) { state.menu = null; state.suggest = false; state.suggestIdx = -1; return; }
      closeTransient();
      return;
    }
    const key = el.dataset.key;
    switch (el.dataset.action) {
      case 'skip': e.preventDefault(); $('main').focus(); return;
      case 'back-to-top': e.preventDefault(); backToTop(); return;
      case 'help-toggle': e.stopPropagation(); setMenu(state.menu === 'info' ? null : 'info'); return;
      case 'menu': e.stopPropagation(); setMenu(state.menu === el.dataset.menu ? null : el.dataset.menu); return;
      case 'set-group': state.groupBy[route.kind] = el.dataset.group; state.closed = {}; state.menu = null; router.replaceParams({ group: el.dataset.group }); app.render(); return;
      case 'set-view': state.mode = el.dataset.view; router.replaceParams({ view: state.mode }); app.render(); return;
      case 'sort-table': {
        const sortKey = el.dataset.sortKey;
        const column = parseInt(el.dataset.sortColumn, 10);
        const current = state.tableSorts[sortKey];
        const direction = current && current.column === column && current.direction === 'asc' ? 'desc' : 'asc';
        state.tableSorts[sortKey] = { column, direction };
        if (route.view === 'detail' && route.params.page) router.replaceParams({ page: null });
        app.render();
        return;
      }
      case 'toggle-group': state.closed[key] = !state.closed[key]; app.render(); return;
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
      case 'set-page': router.replaceParams({ page: el.dataset.page === '1' ? null : el.dataset.page }); app.render(); return;
      case 'toggle-relation-view': state.relationDiagram = !state.relationDiagram; app.render(); return;
      case 'export': { const id = el.dataset.export, label = el.dataset.label; state.menu = null; app.render(); doExport(id, label); return; }
      case 'clear-query': {
        state.query = ''; state.suggest = false; state.suggestIdx = -1;
        if (route.view === 'search') { router.navigate('#/'); return; }
        const input = $('search-input'); if (input) { input.value = ''; input.focus(); }
        $('search-clear').hidden = true; renderSuggest(); return;
      }
      case 'suggest-pick': state.suggest = false; state.suggestIdx = -1; router.navigate(el.dataset.href); return;
      case 'open-results': openResults(); return;
      case 'chapter': e.preventDefault(); goChapter(el.dataset.chapter); return;
      case 'not-available': e.preventDefault(); ui.toast(t('toolbar.notAvailable', { what: el.dataset.what || el.textContent.trim() })); return;
      case 'toast-close': el.closest('.ob-alert').remove(); return;
      default: return;
    }
  }

  function onInput(e) {
    if (e.target.id === 'search-input') {
      state.query = e.target.value; state.suggest = true; state.suggestIdx = -1;
      $('search-clear').hidden = !state.query;
      renderSuggest();
    }
  }

  function onKeydown(e) {
    if (e.target.id === 'search-input') { onSearchKey(e); return; }
    if (e.target.matches('.ob-tab') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const tabs = [...e.target.parentElement.querySelectorAll('.ob-tab')];
      const current = tabs.indexOf(e.target);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      e.preventDefault();
      tabs[next].focus(); // focus first so the re-render keeps it on the new tab
      tabs[next].click();
      return;
    }
    if (e.key === 'Escape' && state.navDrawerOpen) { setNavigation(false); return; }
    if (e.key === 'Escape' && (state.menu || state.suggest)) closeTransient();
  }

  function onFocusin(e) {
    if (e.target.id === 'search-input' && state.query.trim() && !state.suggest) { state.suggest = true; renderSuggest(); }
  }
  function onFocusout(e) {
    const search = state.suggest && e.target.closest('.ob-search');
    if (search && !(e.relatedTarget && search.contains(e.relatedTarget))) closeSuggest();
  }

  function onPointerDown(e) {
    const g = e.target.closest('#graph');
    if (!g || e.button !== 0 || e.target.closest('a')) return;
    drag = { x: e.clientX, y: e.clientY, px: state.graph.x, py: state.graph.y, el: g };
    g.classList.add('is-dragging');
    if (g.setPointerCapture) { try { g.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!drag) return;
    state.graph.x = drag.px + e.clientX - drag.x;
    state.graph.y = drag.py + e.clientY - drag.y;
    applyGraphTransform();
  }
  function onPointerUp() {
    if (!drag) return;
    drag.el.classList.remove('is-dragging');
    drag = null;
  }

  /* ---- init ------------------------------------------------------------------------ */
  app.init = async function () {
    try {
      await data.load('data/');
    } catch (err) {
      $('main').innerHTML = ui.empty(t('loadError.title'), `${ui.esc(t('loadError'))}<div class="ob-cell-muted" style="margin-top:8px">${ui.esc(err.message)}</div>`);
      console.error(err);
      return;
    }
    const cfg = data.config;
    ui.setDictionary(data.i18n, cfg.app.language || 'de', 'de');
    document.documentElement.lang = cfg.app.language || 'de';
    if (cfg.compactTables) document.documentElement.classList.add('ob-density-compact');
    $('skip-link').textContent = t('skip');
    $('brand-link').setAttribute('aria-label', `${cfg.app.name} – ${t('nav.home')}`);
    $('brand-org').textContent = cfg.app.organisation;
    $('brand-app').textContent = cfg.app.name;
    $('main-nav').setAttribute('aria-label', t('nav.main'));
    $('header-tools').innerHTML = views.headerTools(state);
    $('footer').innerHTML = views.footer();
    const backToTopButton = $('back-to-top');
    backToTopButton.setAttribute('aria-label', t('backToTop.aria'));
    backToTopButton.innerHTML = `${ui.icon('arrow_right', 'sm')}<span>${ui.esc(t('backToTop.label'))}</span>`;

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('focusin', onFocusin);
    document.addEventListener('focusout', onFocusout);
    document.addEventListener('mousedown', e => { if (e.target.closest('#search-suggest')) e.preventDefault(); });
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', scheduleTreeViewport, { passive: true });
    window.addEventListener('resize', updateBackToTop, { passive: true });
    window.addEventListener('hashchange', app.onRoute);

    app.onRoute();
  };

  DK.app = app;
  document.addEventListener('DOMContentLoaded', app.init);
})(window.DK);
