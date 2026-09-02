/* app.js – bootstrap, UI state and event handling.
   Rendering is "render everything from state": the URL (router) plus the
   transient state below are turned into HTML by views.js / detail.js. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router, views = DK.views, detail = DK.detail;
  const t = ui.t;

  /** Transient UI state that is not part of the URL. */
  const state = {
    query: '', suggest: false, suggestIdx: -1, suggestFlat: [], suggestAllIdx: 0,
    menu: null,                       // null | 'info' | 'group' | 'actions'
    mode: 'tiles',                    // tiles | table (URL ?view= overrides)
    groupBy: {},                      // per section (URL ?group= overrides)
    closed: {},                       // collapsed list groups
    treeOpen: { objects: true },      // expanded tree nodes
    treeSection: 'objects',           // section whose branch is open (others collapse on section change)
    graph: { scale: 1, x: 0, y: 0 },
    relationDiagram: false,
    navDrawerOpen: false,
    isPhone: false,
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

  /** Called on every hash change (and by router.navigate): reset transient state, then render. */
  app.onRoute = function () {
    const previousRoute = route;
    route = resolveRoute();
    state.navDrawerOpen = false;

    // A fresh load and entry from a non-detail view start at Übersicht. While
    // moving between profiles, retain the semantic tab when the target has it.
    if (route.view === 'detail') {
      const requested = previousRoute
        ? (route.params.tab || (previousRoute.view === 'detail' ? state.detailTab : 'overview'))
        : 'overview';
      const tab = detail.resolveTab(route.entity, requested);
      state.detailTab = tab;
      if ((route.params.tab || 'overview') !== tab || (tab === 'overview' && route.params.tab)) {
        router.replaceParams({ tab: tab === 'overview' ? null : tab, page: null });
        route = resolveRoute();
      }
    } else {
      state.detailTab = 'overview';
    }

    state.menu = null; state.suggest = false; state.suggestIdx = -1;
    // Entering another section collapses the other branches so the tree shows only the current path.
    const section = sectionOf(route);
    if (section && section !== state.treeSection) { state.treeOpen = { [section]: true }; state.treeSection = section; }
    const key = route.entity ? `${route.kind}:${route.id}` : null;
    if (key !== state.lastEntity) {
      state.graph = { scale: 1, x: 0, y: 0 }; state.relationDiagram = false; state.lastEntity = key;
      if (route.entity) state.treeOpen[route.kind === 'attrs' ? 'objects' : route.kind] = true;
    }
    if (route.view === 'list') state.treeOpen[route.kind] = true;
    if (route.view === 'search') state.query = route.params.q || '';
    if (route.view === 'manual') state.chapter = route.params.ch || state.chapter;
    app.render();
    renderHelp();
    if (route.view === 'manual' && route.params.ch) {
      const el = $('hb-' + route.params.ch);
      if (el) el.scrollIntoView({ block: 'start' });
    } else if (route.view !== 'manual') {
      window.scrollTo(0, 0);
    }
  };

  /** Re-render nav + main from the current route and state. */
  app.render = function () {
    route = resolveRoute(); // re-read: replaceParams() may have changed tab/page/view/group
    if (route.params.view) state.mode = route.params.view === 'table' ? 'table' : 'tiles';
    if (route.view === 'list' && route.params.group) state.groupBy[route.kind] = route.params.group;
    const page = views.page(route, state);
    ctx = page.ctx;
    $('main-nav').innerHTML = views.mainNav(route);
    $('main').innerHTML = page.html;
    document.documentElement.classList.toggle('ob-navigation-open', state.navDrawerOpen);
    document.title = `${ctx.title} – ${data.config.app.name} ${data.config.app.organisation}`;
    requestAnimationFrame(revealActiveTab);
    scheduleTreeViewport();
    updateBackToTop();
    if (route.view === 'api') requestAnimationFrame(renderSwagger);
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

  function renderSwagger() {
    const host = $('swagger-ui');
    if (!host) return;
    if (typeof window.SwaggerUIBundle !== 'function') {
      host.setAttribute('aria-busy', 'false');
      host.innerHTML = `<div class="ob-empty"><div class="ob-empty-title">${ui.esc(t('api.unavailable'))}</div></div>`;
      return;
    }
    window.swaggerUi = window.SwaggerUIBundle({
      url: 'data/swagger.json',
      dom_id: '#swagger-ui',
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
      if (target) target.focus();
    });
  }

  function renderHelp() { const h = $('help-host'); if (h) h.innerHTML = views.helpHost(state); }
  function renderSuggest() {
    const host = $('search-suggest-host'); if (!host) return;
    host.innerHTML = views.suggest(state);
    const input = $('search-input');
    const open = state.suggest && !!state.query.trim();
    input.setAttribute('aria-expanded', String(open));
    if (open && state.suggestIdx >= 0) input.setAttribute('aria-activedescendant', 'suggest-' + state.suggestIdx); else input.removeAttribute('aria-activedescendant');
  }
  function closeTransient() {
    const wasOpen = state.menu || state.suggest;
    state.menu = null; state.suggest = false; state.suggestIdx = -1;
    if (!wasOpen) return;
    app.render(); renderHelp();
  }

  /* ---- search ---------------------------------------------------------------- */
  function openResults() {
    const q = state.query.trim();
    state.suggest = false; state.suggestIdx = -1;
    if (!q) return;
    router.navigate(router.searchHref(q));
  }
  function onSearchKey(e) {
    const open = state.suggest && !!state.query.trim();
    const n = state.suggestAllIdx; // index of the "all results" row
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); state.suggestIdx = Math.min(state.suggestIdx + 1, n); renderSuggest(); return; }
    if (e.key === 'ArrowUp' && open) { e.preventDefault(); state.suggestIdx = Math.max(state.suggestIdx - 1, -1); renderSuggest(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && state.suggestIdx >= 0 && state.suggestIdx < n) { const href = state.suggestFlat[state.suggestIdx]; state.suggest = false; router.navigate(href); return; }
      openResults(); return;
    }
    if (e.key === 'Escape') {
      if (state.suggest) { state.suggest = false; state.suggestIdx = -1; renderSuggest(); }
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
  function updateChapterNav() {
    document.querySelectorAll('[data-action="chapter"]').forEach(a => {
      if (a.dataset.chapter === state.chapter) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }
  function goChapter(id) {
    state.chapter = id;
    state.navDrawerOpen = false;
    router.replaceParams({ ch: id });
    app.render();
    const el = $('hb-' + id);
    if (el) {
      hbLock = id;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' });
      clearTimeout(hbTimer); hbTimer = setTimeout(() => { hbLock = null; }, 900);
    }
    updateChapterNav();
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
      closeTransient();
      return;
    }
    const key = el.dataset.key;
    switch (el.dataset.action) {
      case 'skip': e.preventDefault(); $('main').focus(); return;
      case 'back-to-top': e.preventDefault(); backToTop(); return;
      case 'help-toggle': e.stopPropagation(); state.menu = state.menu === 'info' ? null : 'info'; state.suggest = false; app.render(); renderHelp(); return;
      case 'menu': e.stopPropagation(); state.menu = state.menu === el.dataset.menu ? null : el.dataset.menu; state.suggest = false; app.render(); renderHelp(); return;
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
        requestAnimationFrame(() => {
          const button = [...document.querySelectorAll('[data-action="sort-table"]')].find(x => x.dataset.sortKey === sortKey && parseInt(x.dataset.sortColumn, 10) === column);
          if (button) button.focus();
        });
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
        const same = el.getAttribute('href') === location.hash;
        if (same) { e.preventDefault(); state.treeOpen[key] = el.dataset.toggle ? !state.treeOpen[key] : true; app.render(); }
        else state.treeOpen[key] = true;
        return;
      }
      case 'set-tab': {
        state.detailTab = detail.resolveTab(route.entity, el.dataset.tab);
        router.replaceParams({ tab: state.detailTab === 'overview' ? null : state.detailTab, page: null });
        app.render();
        return;
      }
      case 'set-page': router.replaceParams({ page: el.dataset.page }); app.render(); return;
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
      return;
    }
  }

  function onKeydown(e) {
    if (e.target.id === 'search-input') { onSearchKey(e); return; }
    if (e.target.matches('.ob-tab') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const tabs = [...e.target.parentElement.querySelectorAll('.ob-tab')];
      const current = tabs.indexOf(e.target);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      const nextId = tabs[next].id;
      e.preventDefault(); tabs[next].click();
      requestAnimationFrame(() => document.getElementById(nextId)?.focus());
      return;
    }
    if (e.key === 'Escape' && state.navDrawerOpen) { setNavigation(false); return; }
    if (e.key === 'Escape' && (state.menu || state.suggest)) closeTransient();
  }

  function onFocusin(e) {
    if (e.target.id === 'search-input' && state.query.trim() && !state.suggest) { state.suggest = true; renderSuggest(); }
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
      $('main').innerHTML = `<div class="ob-empty"><div class="ob-empty-title">Fehler beim Laden</div><div>${ui.esc(t('loadError'))}</div><div class="ob-cell-muted" style="margin-top:8px">${ui.esc(err.message)}</div></div>`;
      console.error(err);
      return;
    }
    const cfg = data.config;
    ui.setDictionary(data.i18n[cfg.app.language] || data.i18n.de);
    document.documentElement.lang = cfg.app.language || 'de';
    if (cfg.compactTables) document.documentElement.classList.add('ob-density-compact');
    $('brand-org').textContent = cfg.app.organisation;
    $('brand-app').textContent = cfg.app.name;
    $('header-tools').innerHTML = views.headerTools(state);
    $('footer').innerHTML = views.footer();
    const backToTopButton = $('back-to-top');
    backToTopButton.setAttribute('aria-label', t('backToTop.aria'));
    backToTopButton.innerHTML = `${ui.icon('arrow_right', 'sm')}<span>${ui.esc(t('backToTop.label'))}</span>`;

    const phoneMedia = window.matchMedia('(max-width: 600px)');
    state.isPhone = phoneMedia.matches;
    phoneMedia.addEventListener('change', event => {
      if (state.isPhone === event.matches) return;
      state.isPhone = event.matches;
      if (route && route.view === 'list') app.render();
    });

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('focusin', onFocusin);
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
