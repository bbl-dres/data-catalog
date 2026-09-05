/* views.js – HTML rendering for header, navigation, tree, toolbar, home,
   section lists, search results, handbook and API page.
   Pure functions: (route, state) → html string. Detail pages live in detail.js. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router;
  const t = ui.t, esc = ui.esc, icon = ui.icon;
  const views = {};

  /* ---- header, nav, footer ------------------------------------------------ */
  views.headerTools = function (state, route) {
    const cfg = data.config;
    const home = route?.view === 'home';
    return `
      <div class="ob-header-search${state.searchOpen ? ' is-open' : ''}" id="header-search">
        <button type="button" class="ob-button ob-button--icon" data-action="toggle-search" aria-label="${esc(t('search.label'))}"${home ? ' aria-controls="home-search"' : ` aria-expanded="${state.searchOpen}" aria-controls="header-search-field"`}>${icon('search', 'xl')}</button>
        ${home ? '' : `<div id="header-search-field"${state.searchOpen ? '' : ' hidden'}>${views.toolbar({ state })}</div>`}
      </div>
      <div class="ob-popover-host" id="help-host">${views.helpHost(state)}</div>
      <div class="ob-menu-host" id="language-host">${views.languageHost(state)}</div>
      <div class="ob-avatar" title="${esc(cfg.app.user.name)}" aria-label="${esc(cfg.app.user.name)}">${esc(cfg.app.user.initials)}</div>
      <button type="button" class="ob-button ob-button--icon ob-navigation-toggle" data-action="open-navigation" aria-label="${esc(t('navigation.open'))}" aria-controls="navigation-panel" aria-expanded="${state.navDrawerOpen}">${icon('list', 'xl')}</button>`;
  };

  /** Language switch for UI text and localized field labels; other catalog content stays German. */
  views.languageHost = function (state) {
    const open = state.menu === 'language';
    const languages = data.config.app.languages || ['de'];
    const button = `<button type="button" class="ob-button ob-language-select${open ? ' is-active' : ''}" aria-haspopup="menu" aria-expanded="${open}" aria-label="${esc(`${t('header.language')}: ${t('header.languageCurrent')}`)}" data-action="menu" data-menu="language">${esc(state.lang.toUpperCase())} ${icon('chevron_down', 'sm')}</button>`;
    if (!open) return button;
    const items = languages.map(l => `<button type="button" role="menuitemradio" aria-checked="${l === state.lang}" class="ob-menu-item${l === state.lang ? ' is-active' : ''}" lang="${esc(l)}" data-action="set-language" data-lang="${esc(l)}">${esc(t('lang.' + l))}</button>`).join('');
    return button + `<div class="ob-menu ob-menu--narrow" role="menu" aria-label="${esc(t('header.language'))}">${items}<p class="ob-menu-note">${esc(t('header.languageNote'))}</p></div>`;
  };

  views.helpHost = function (state) {
    const h = data.config.help;
    const open = state.menu === 'info';
    const btn = `<button type="button" class="ob-button ob-button--icon${open ? ' is-active' : ''}" title="${esc(t('header.help'))}" aria-label="${esc(t('header.help'))}" aria-haspopup="dialog" aria-expanded="${open}" data-action="help-toggle">${icon('question', 'xl')}</button>`;
    if (!open) return btn;
    const link = l => ui.link(l.route || l.url, `${esc(l.label)}${l.route ? '' : ' ' + icon('link_external', 'sm')}`, { className: 'ob-popover-link', external: !l.route });
    return btn + `
      <div class="ob-popover" role="dialog" aria-label="${esc(t('header.help'))}">
        <div class="ob-popover-arrow"></div>
        <div class="ob-popover-content">
        <p>${esc(h.intro)}</p>
        <section class="ob-popover-section">
          <h4>${esc(t('help.title'))}</h4>
          <p class="ob-popover-lead">${esc(h.helpText)}</p>
          <ul class="ob-popover-list">${h.links.map(l => `<li>${link(l)}</li>`).join('')}</ul>
        </section>
        <section class="ob-popover-section">
          <h4>${esc(t('help.contact'))}</h4>
          <p>${esc(h.contactText)}</p>
          <ul class="ob-popover-list ob-popover-list--contact">
            <li><a class="ob-inline-link" href="mailto:${esc(h.email)}">${icon('mail')}${esc(h.email)}</a></li>
            <li><a class="ob-inline-link" href="tel:${esc(h.phone.replace(/\s/g, ''))}">${icon('phone')}${esc(h.phone)}</a><br>${esc(h.hours)}</li>
            <li>${ui.link(h.formUrl, `${esc(h.formLabel)} ${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true })}</li>
          </ul>
        </section>
        </div>
      </div>`;
  };

  views.mainNav = function (route) {
    const isCatalog = !['manual', 'api'].includes(route.view);
    const items = [['#/', t('nav.catalog'), isCatalog], ['#/manual', t('nav.manual'), route.view === 'manual'], ['#/api', t('nav.api'), route.view === 'api']];
    return items.map(([href, label, active]) => `<a class="ob-main-nav-item" href="${href}"${active ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  };

  views.footer = function () {
    const cfg = data.config;
    const links = cfg.footerLinks.map(l => {
      const href = l.route || l.url;
      const ext = !!l.url && !/^mailto:/.test(l.url);
      return `<li>${ui.link(href, esc(l.label), { external: ext })}</li>`;
    }).join('');
    return `<div class="ob-footer-inner"><ul class="ob-footer-links">${links}</ul><span class="ob-footer-meta">${esc(t('footer.version', { v: cfg.app.version }))} · ${esc(cfg.app.footerNote)}</span></div>`;
  };

  /* ---- page chrome --------------------------------------------------------- */
  views.breadcrumb = function (crumbs) {
    const items = crumbs.map((c, i) => {
      const last = i === crumbs.length - 1;
      return `<li>${last ? `<span aria-current="page">${esc(c.label)}</span>` : `<a href="${esc(c.href)}">${esc(c.label)}</a>${icon('chevron_right', 'xs')}`}</li>`;
    }).join('');
    return `<nav class="ob-breadcrumb" aria-label="${esc(t('nav.breadcrumb'))}"><ol>${items}</ol></nav>`;
  };

  /** Shared sidebar, icon rail and mobile drawer; all links use the same route model. */
  views.sidePanel = function (route, state) {
    // The API reference only needs the global navigation drawer, never a catalog tree.
    if (route.view === 'api') return `<div class="ob-sidebar-slot ob-sidebar-slot--global"><aside class="ob-tree-panel${state.navDrawerOpen ? ' is-mobile-open' : ''}" id="navigation-panel" aria-label="${esc(t('navigation.title'))}">
      <div class="ob-drawer-header"><h2>${esc(t('navigation.title'))}</h2><button type="button" class="ob-button ob-button--icon" aria-label="${esc(t('tree.close'))}" data-action="close-navigation">${icon('xmark', 'lg')}</button></div>
      <nav class="ob-drawer-nav" aria-label="${esc(t('nav.main'))}">${views.mainNav(route)}</nav>
      <div class="ob-drawer-tools"><div class="ob-menu-host" id="drawer-language-host">${views.languageHost(state)}</div><div class="ob-popover-host" id="drawer-help-host">${views.helpHost(state)}</div><span>${esc(t('header.help'))}</span></div>
    </aside></div>`;
    const manual = route.view === 'manual';
    const title = t(manual ? 'manual.title' : 'tree.title');
    const tree = manual ? views.chapterTree(state) : views.tree(route, state);
    const railItems = manual
      ? [{ key: 'manual', label: title, icon: 'file_list', active: true }]
      : [{ key: 'home', label: t('tree.overview'), icon: 'home', href: '#/', active: route.view === 'home' }, ...data.sections().map(kind => ({ key: kind, label: data.kindDef(kind).plural, icon: data.kindDef(kind).icon, active: state.treeSection === kind && route.view !== 'home' }))];
    const rail = `<nav class="ob-icon-rail" aria-label="${esc(title)}">${railItems.map(it => it.href
      ? `<a class="ob-rail-item${it.active ? ' is-active' : ''}" href="${it.href}" title="${esc(it.label)}" aria-label="${esc(it.label)}">${icon(it.icon, 'xl')}</a>`
      : `<button type="button" class="ob-rail-item${it.active ? ' is-active' : ''}" data-action="rail-section" data-key="${it.key}" title="${esc(it.label)}" aria-label="${esc(it.label)}" aria-expanded="${state.flyout === it.key}" aria-controls="sidebar-flyout">${icon(it.icon, 'xl')}</button>`).join('')}</nav>`;
    const flyoutTitle = state.flyout === 'manual' ? title : state.flyout ? data.kindDef(state.flyout).plural : '';
    const flyout = state.flyout ? `<section class="ob-sidebar-flyout" id="sidebar-flyout" aria-label="${esc(flyoutTitle)}"><div class="ob-sidebar-heading"><h2>${esc(flyoutTitle)}</h2><button type="button" class="ob-button ob-button--icon" data-action="close-flyout" aria-label="${esc(t('navigation.closeFlyout'))}">${icon('xmark')}</button></div>${manual ? tree : views.tree(route, state, state.flyout)}</section>` : '';
    return `<div class="ob-sidebar-slot"><aside class="ob-tree-panel${state.sidebarCollapsed ? ' is-collapsed' : ''}${state.navDrawerOpen ? ' is-mobile-open' : ''}" id="navigation-panel" aria-label="${esc(t('navigation.title'))}">
      <div class="ob-drawer-header"><h2>${esc(t('navigation.title'))}</h2><button type="button" class="ob-button ob-button--icon" aria-label="${esc(t('tree.close'))}" data-action="close-navigation">${icon('xmark', 'lg')}</button></div>
      <nav class="ob-drawer-nav" aria-label="${esc(t('nav.main'))}">${views.mainNav(route)}</nav>
      <div class="ob-sidebar-heading"><h2 class="ob-tree-title">${esc(title)}</h2><button type="button" class="ob-button ob-button--icon" data-action="toggle-sidebar" aria-label="${esc(t(state.sidebarCollapsed ? 'navigation.expand' : 'navigation.collapse'))}" title="${esc(t(state.sidebarCollapsed ? 'navigation.expand' : 'navigation.collapse'))}" aria-expanded="${!state.sidebarCollapsed}" aria-controls="sidebar-tree">${icon(state.sidebarCollapsed ? 'chevron_right' : 'chevron_left', 'sm')}</button></div>
      <div class="ob-sidebar-tree" id="sidebar-tree">${tree}</div>${rail}${flyout}
      <div class="ob-drawer-tools"><div class="ob-menu-host" id="drawer-language-host">${views.languageHost(state)}</div><div class="ob-popover-host" id="drawer-help-host">${views.helpHost(state)}</div><span>${esc(t('header.help'))}</span></div>
    </aside>${state.sidebarCollapsed ? '' : `<div id="sidebar-resizer" class="ob-sidebar-resizer" role="separator" tabindex="0" aria-orientation="vertical" aria-controls="navigation-panel page-content" aria-label="${esc(t('navigation.resize'))}" title="${esc(t('navigation.resizeHelp'))}"></div>`}</div>`;
  };

  /* ---- context: everything the page composition needs -------------------- */
  views.context = function (route, state) {
    const kinds = data.model.kinds;
    const ctx = {
      route, state, entity: route.entity, kind: route.kind, mode: state.mode,
      isList: route.view === 'list',
      groups: [], columns: [], groupOptions: [], groupLabel: '', groupBy: null, actions: [], crumbs: [], title: '',
      filter: (route.params.filter || '').trim(), total: 0, matched: 0,
      domain: route.view === 'list' && route.params.domain ? data.domainOf(route.params.domain) : null,
    };
    if (ctx.isList) {
      const requestedGroup = state.groupBy[route.kind] || data.defaultGroup(route.kind);
      const availableGroups = data.groupOptions(route.kind);
      const g = availableGroups.some(o => o.id === requestedGroup) ? requestedGroup : data.defaultGroup(route.kind);
      ctx.groupBy = g;
      ctx.groupOptions = availableGroups.map(o => Object.assign(o, { active: o.id === g }));
      ctx.groupLabel = (ctx.groupOptions.find(o => o.id === g) || ctx.groupOptions[0] || { label: '' }).label;
      const closed = ctx.filter ? (state.filteredClosed || {}) : state.closed;
      const members = ctx.domain ? data.membersOfDomain(route.kind, ctx.domain) : data.list(route.kind);
      const memberIds = new Set(members.map(e => e.identifier));
      ctx.total = members.length;
      ctx.groups = data.buildGroups(route.kind, g, ctx.mode === 'table').map(x => ({
        ...x, items: x.items.filter(e => memberIds.has(e.identifier) && data.matchesCollection(route.kind, e, ctx.filter)), open: !closed[x.id],
      })).filter(x => x.items.length);
      ctx.matched = ctx.groups.reduce((sum, x) => sum + x.items.length, 0);
      ctx.columns = data.columns(route.kind);
    }

    // title
    const e = route.entity;
    const titles = { home: () => t('home.title'), list: () => kinds[route.kind].plural, search: () => t('search.title'), manual: () => t('manual.title'), api: () => t('api.title'), detail: () => e.name };
    ctx.title = (titles[route.view] || (() => t('notfound.title')))();
    if (ctx.domain) ctx.title += ' – ' + ctx.domain.name;

    // breadcrumbs: Startseite › section › container › entity. The home page is the root itself.
    const crumbs = [{ label: t('nav.home'), href: '#/' }];
    if (route.view === 'detail') {
      const container = data.navModel() === 'container';
      const sec = k => ({ label: kinds[k].plural, href: router.listHref(k) });
      const ent = (k, x) => ({ label: x.name, href: router.entityHref(k, x.identifier) });
      const dom = data.domainForEntity(e.kind, e);
      const sys = data.sysOf(e.system);
      const obj = e.kind === 'attrs' ? data.objOf(e.object) : null;
      const table = e.kind === 'fields' ? data.get('tables', e.table) : null;
      const domCrumb = dom ? [ent('domains', dom)] : [];
      const scopedDomCrumb = dom ? [{ label: dom.name, href: router.domainListHref(e.kind, dom.identifier, route.params.nav ? { nav: data.navModel() } : undefined) }] : [];
      const sysCrumb = sys ? [ent('systems', sys)] : [];
      const objectsSec = sec(container ? 'domains' : 'objects');
      const tablesSec = sec(container ? 'systems' : 'tables');
      const path = {
        objects: [objectsSec, ...domCrumb],
        attrs: [objectsSec, ...domCrumb, ...(obj ? [ent('objects', obj)] : [])],
        tables: [tablesSec, ...sysCrumb],
        fields: [tablesSec, ...sysCrumb, ...(table ? [{ label: data.displayName('tables', table), href: router.entityHref('tables', table.identifier, { tab: 'rows', ...(route.params.nav ? { nav: data.navModel() } : {}) }) }] : [])],
        refs: [sec('refs'), ...scopedDomCrumb],
        products: [sec('products'), ...scopedDomCrumb],
        apis: [sec('apis'), ...scopedDomCrumb],
        domains: [objectsSec],
        systems: [tablesSec],
      }[e.kind];
      crumbs.push(...path, { label: data.displayName(e.kind, e) });
    } else if (ctx.domain) {
      crumbs.push({ label: kinds[route.kind].plural, href: router.listHref(route.kind, route.params.nav ? { nav: data.navModel() } : undefined) }, { label: ctx.domain.name });
    } else if (route.view !== 'home') {
      crumbs.push({ label: ctx.title });
    }
    ctx.crumbs = crumbs;

    // actions menu
    const A = (id, label) => ({ id, label });
    if (route.view === 'detail') {
      if (e.kind === 'attrs' || e.kind === 'fields' || e.kind === 'apis') ctx.actions = [A('profile-pdf', t('toolbar.export.profilePdf'))];
      else if (e.kind === 'products') ctx.actions = [A('profile-pdf', t('toolbar.export.profilePdf')), A('dcat', t('toolbar.export.dcat'))];
      else ctx.actions = [A('profile-pdf', t('toolbar.export.profilePdf')), A('uml', t('toolbar.export.uml'))];
      ctx.actions.unshift(A('xlsx', t('toolbar.export.xlsx')));
    } else if (route.view === 'list') {
      const w = t('toolbar.export.list');
      ctx.actions = [A('xlsx', t('toolbar.export.xlsx')), A('pdf', t('toolbar.export.pdf', { what: w })), A('uml', t('toolbar.export.uml'))];
    }
    return ctx;
  };

  /* ---- toolbar ---------------------------------------------------------------- */
  /** Suggestion listbox. Options are numbered in listbox order; the "all results" row comes last. */
  views.suggest = function (state) {
    const q = state.query.trim();
    if (!state.suggest || !q) return '';
    const groups = data.suggest(q);
    let idx = 0;
    const html = groups.map(g => `<div role="group" aria-label="${esc(g.title)}"><div class="ob-suggest-group-title">${icon(g.icon, 'sm')}${esc(g.title)}</div>${g.items.map(e => {
      const i = idx++;
      return `<div role="option" id="suggest-${i}" class="ob-suggest-option" aria-selected="${state.suggestIdx === i}" data-action="suggest-pick" data-href="${esc(router.entityHref(g.kind, e.identifier))}"><span>${ui.highlight(e.name, q)}</span></div>`;
    }).join('')}</div>`).join('');
    const label = groups.length ? t('search.showAll', { q }) : t('search.noSuggest', { q });
    return `<div id="search-suggest" class="ob-suggest" role="listbox" tabindex="-1" aria-label="${esc(t('search.suggestions'))}">${html}<div role="option" id="suggest-${idx}" class="ob-suggest-all" aria-selected="${state.suggestIdx === idx}" data-action="open-results">${esc(label)}</div></div>`;
  };

  views.actionsMenu = function (ctx) {
    if (!ctx.actions.length) return '';
    const open = ctx.state.menu === 'actions';
    const menu = open ? `<div class="ob-menu ob-menu--wide" role="menu" aria-label="${esc(t('toolbar.export'))}">${ctx.actions.map(a => `<button type="button" role="menuitem" class="ob-menu-item" data-action="export" data-export="${esc(a.id)}" data-label="${esc(a.label)}"${a.id === 'xlsx' && ctx.state.exporting ? ' disabled' : ''}>${esc(a.label)}</button>`).join('')}</div>` : '';
    return `<div class="ob-menu-host ob-actions-menu"><button type="button" class="ob-button" aria-label="${esc(t('toolbar.export'))}" aria-haspopup="menu" aria-expanded="${open}" data-action="menu" data-menu="actions">${icon('download', null, 'ob-export-icon')}<span class="ob-export-label">${esc(t('toolbar.export'))}</span>${icon('chevron_down', 'sm', 'ob-export-chevron')}</button>${menu}</div>`;
  };

  views.entityHeader = function (ctx) {
    const e = ctx.entity;
    return `<header class="ob-view-header ob-entity-header"><div class="ob-title-row"><h1>${esc(e.name)}</h1>${views.actionsMenu(ctx)}</div>${e.description ? `<p class="ob-prose ob-detail-description">${esc(e.description)}</p>` : ''}</header>`;
  };

  views.collectionHeader = ctx => `<header class="ob-view-header ob-collection-header"><div class="ob-title-row"><h1>${esc(ctx.title)}</h1>${views.actionsMenu(ctx)}</div><p class="ob-prose ob-view-description">${esc(data.kindDef(ctx.kind).description)}</p></header>`;

  views.viewHeader = ctx => `<header class="ob-view-header"><h1>${esc(ctx.title)}</h1></header>`;

  views.groupMenu = function (ctx) {
    const state = ctx.state;
    const menu = state.menu === 'group' ? `<div class="ob-menu" role="menu" aria-label="${esc(t('toolbar.group'))}">${ctx.groupOptions.map(o => `<button type="button" role="menuitem" class="ob-menu-item${o.active ? ' is-active' : ''}" data-action="set-group" data-group="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div>` : '';
    return `<div class="ob-menu-host ob-collection-group"><button type="button" class="ob-button" aria-haspopup="menu" aria-expanded="${state.menu === 'group'}" data-action="menu" data-menu="group">${icon('grid')}<span>${esc(t('toolbar.group'))}: ${esc(ctx.groupLabel)}</span>${icon('chevron_down', 'sm')}</button>${menu}</div>`;
  };

  views.collectionControls = function (ctx) {
    const modes = [['tiles', t('toolbar.tiles')], ['table', t('toolbar.table')]];
    const tabs = modes.map(([id, label]) => `<button type="button" role="tab" id="view-tab-${id}" class="ob-tab ob-view-tab" aria-selected="${ctx.mode === id}" aria-controls="collection-view-panel" tabindex="${ctx.mode === id ? '0' : '-1'}" data-action="set-view" data-view="${id}">${esc(label)}</button>`).join('');
    return `<div class="ob-collection-controls">
      <div class="ob-tabs-frame ob-collection-tabs-frame"><div class="ob-tabs" role="tablist" aria-label="${esc(t('toolbar.view'))}">${tabs}</div></div>
      <div class="ob-local-actions">
        <div class="ob-collection-search" role="search" aria-label="${esc(t('collection.search.label'))}">
          ${icon('search', 'lg', 'ob-search-icon')}
          <input type="search" class="ob-input ob-search-input" id="collection-filter" value="${esc(ctx.filter)}" placeholder="${esc(t('collection.search.placeholder'))}" aria-label="${esc(t('collection.search.label'))}" aria-controls="collection-view-panel" aria-describedby="collection-filter-status" autocomplete="off" spellcheck="false" enterkeyhint="search">
          <button type="button" class="ob-icon-button ob-search-clear" id="collection-filter-clear" data-action="clear-collection-filter" aria-label="${esc(t('collection.search.clear'))}"${ctx.filter ? '' : ' hidden'}>${icon('xmark')}</button>
        </div>${views.groupMenu(ctx)}
      </div>
    </div>`;
  };

  views.collectionStatus = ctx => t('collection.search.count', { n: ctx.matched, total: ctx.total });

  /** One shared combobox, placed in the home hero or the header on other routes. */
  views.searchField = function (state, home = false) {
    const q = state.query;
    const open = state.suggest && !!q.trim();
    return `<div class="ob-search"><div class="ob-search-control">
        ${icon('search', 'lg', 'ob-search-icon')}
        <input type="search" class="ob-input ob-search-input" id="search-input" name="q" value="${esc(q)}" placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.label'))}"${home ? ' aria-describedby="home-search-description"' : ''} role="combobox" aria-expanded="${open}" aria-controls="search-suggest"${open && state.suggestIdx >= 0 ? ` aria-activedescendant="suggest-${state.suggestIdx}"` : ''} aria-autocomplete="list" autocomplete="off" spellcheck="false" enterkeyhint="search">
        <button type="button" class="ob-icon-button ob-search-clear" id="search-clear" aria-label="${esc(t('search.clear'))}" data-action="clear-query"${q ? '' : ' hidden'}>${icon('xmark')}</button>
        </div>
        <div id="search-suggest-host">${views.suggest(state)}</div>
      </div>`;
  };
  views.toolbar = ctx => `<div class="ob-toolbar">${views.searchField(ctx.state)}<div class="ob-toolbar-spacer"></div></div>`;

  /* ---- catalog tree ------------------------------------------------------------- */
  views.tree = function (route, state, onlySection) {
    const kinds = data.model.kinds;
    const navParams = route.params.nav ? { nav: data.navModel() } : undefined;
    const listHref = kind => router.listHref(kind, navParams);
    const entityHref = (kind, id) => router.entityHref(kind, id, navParams);
    const e = route.entity;
    const treeE = e ? (e.kind === 'attrs' ? { kind: 'objects', id: e.object } : e.kind === 'fields' ? { kind: 'tables', id: e.table } : { kind: e.kind, id: e.identifier }) : null;
    const isActive = (kind, id) => !!treeE && treeE.kind === kind && treeE.id === id;
    const contains = (kind, members) => !!treeE && treeE.kind === kind && members.some(m => m.identifier === treeE.id);
    const items = [];
    if (!onlySection) items.push({ label: t('tree.overview'), level: 1, icon: 'home', active: route.view === 'home', href: '#/', action: 'open-overview' });

    data.sections().forEach(sec => {
      if (onlySection && sec !== onlySection) return;
      const open = !!state.treeOpen[sec];
      items.push({ label: kinds[sec].plural, count: data.list(sec).length, level: 1, icon: kinds[sec].icon, expandable: true, expanded: open, active: route.view === 'list' && route.kind === sec && !route.params.domain, href: listHref(sec), key: sec });
      if (!open) return;
      // Level 2: the containers of a container section, else the section's groups. Level 3: their members.
      const childKind = { domains: 'objects', systems: 'tables' }[sec];
      const branches = childKind
        ? data.list(sec).map(c => ({ key: `${sec}:${c.identifier}`, title: c.name, entityKind: sec, entity: c, itemKind: childKind, items: sec === 'domains' ? data.objectsOfDomain(c) : data.tablesOfSystem(c) }))
        : data.buildGroups(sec, sec === 'tables' ? 'system' : 'domain').map(g => ({ key: g.id, title: g.title, entityKind: g.entityKind, entity: g.entity, itemKind: sec, items: g.items }));
      branches.forEach(b => {
        // Repeated domains group these collections; their labels must not jump to the business-object domain profile.
        const scoped = b.entityKind === 'domains' && ['refs', 'products', 'apis'].includes(sec);
        const active = !!b.entity && (scoped
          ? route.view === 'list' && route.kind === sec && route.params.domain === b.entity.identifier
          : isActive(b.entityKind, b.entity.identifier));
        const bOpen = !!state.treeOpen[b.key] || contains(b.itemKind, b.items);
        items.push({
          label: b.title, count: b.items.length, level: 2, icon: b.entityKind ? kinds[b.entityKind].icon : 'folder', expandable: true, expanded: bOpen, key: b.key,
          active,
          href: b.entity ? (scoped ? router.domainListHref(sec, b.entity.identifier, navParams) : entityHref(b.entityKind, b.entity.identifier)) : listHref(sec), toggleOnly: !b.entity,
        });
        if (!bOpen) return;
        b.items.forEach(m => items.push({ label: m.name, count: data.sizeOf(b.itemKind, m), level: 3, icon: kinds[b.itemKind].icon, active: isActive(b.itemKind, m.identifier), href: entityHref(b.itemKind, m.identifier) }));
      });
    });
    items.forEach((it, i) => { if (it.level === 1 && i > 0) items[i - 1].divider = true; });

    items.forEach((it, i) => {
      for (let j = i + 1; j < items.length && items[j].level > it.level; j++) {
        if (items[j].active) { it.ancestor = true; break; }
      }
    });
    const showCounts = data.config.showTreeCounts !== false;
    const li = it => {
      const toggle = it.expandable
        ? `<button type="button" class="ob-tree-toggle" aria-label="${esc(t(it.expanded ? 'tree.collapse' : 'tree.expand', { name: it.label }))}" aria-expanded="${!!it.expanded}" data-action="toggle-tree" data-key="${esc(it.key)}">${icon(it.expanded ? 'chevron_down' : 'chevron_right', 'sm')}</button>`
        : '<span class="ob-tree-spacer" aria-hidden="true"></span>';
      const content = `${it.icon ? icon(it.icon) : ''}<span class="ob-tree-label" title="${esc(it.label)}">${esc(it.label)}</span>${showCounts && it.count != null ? `<span class="ob-tree-count">${it.count}</span>` : ''}`;
      const target = it.toggleOnly
        ? `<button type="button" class="ob-tree-link" data-action="toggle-tree" data-key="${esc(it.key)}">${content}</button>`
        : `<a class="ob-tree-link" href="${esc(it.href)}"${it.active ? ' aria-current="page"' : ''}${it.action ? ` data-action="${esc(it.action)}"` : it.key ? ` data-action="open-tree" data-key="${esc(it.key)}"` : ''}>${content}</a>`;
      return `<li><div class="ob-tree-row${it.active ? ' is-active' : ''}${it.ancestor ? ' is-ancestor' : ''}" style="--level:${it.level}">${toggle}${target}</div>${it.divider ? '<div class="ob-tree-divider"></div>' : ''}</li>`;
    };
    return `<ul class="ob-tree">${items.map(li).join('')}</ul>`;
  };

  /* ---- home ---------------------------------------------------------------------- */
  views.home = function (ctx) {
    const kpis = data.kpis().map(k => `
      <a class="ob-card ob-kpi" href="${router.listHref(k.kind)}">
        <div class="ob-kpi-head">${icon(k.icon, 'xl')}<h3>${esc(k.label)}</h3></div>
        <span class="ob-kpi-count"><strong>${k.count}</strong><span class="ob-kpi-unit">${esc(k.unit)}</span></span>
      </a>`).join('');
    const domainColumns = [{ label: t('home.col.domain'), width: '32%' }, { label: t('home.col.responsibility') }, { label: t('home.col.objects'), numeric: true, compact: true }, { label: t('home.col.attributes'), numeric: true, compact: true }];
    const domainTable = ui.tableOptions(ctx.state, 'home:domains', { column: 0, direction: 'asc' });
    domainTable.minWidth = 480;
    const domainValues = d => {
      const objs = data.objectsOfDomain(d);
      return [d.name, d.responsibleOrg, objs.length, objs.reduce((sum, o) => sum + o.attributes.length, 0)];
    };
    const domainRows = ui.sortRows(data.domains, domainTable.sort, domainValues).map(d => {
      const v = domainValues(d);
      const href = router.entityHref('domains', d.identifier);
      return ui.tr([ui.entityLink(href, d.name), esc(v[1]), v[2], v[3]], href, domainColumns);
    }).join('');
    const recentColumns = [{ label: t('home.col.name'), width: '30%' }, { label: t('home.col.type'), width: '20%' }, { label: t('home.col.domain') }, { label: t('home.col.status'), compact: true }, { label: t('home.col.modified'), compact: true }];
    const recentTable = ui.tableOptions(ctx.state, 'home:recent', { column: 4, direction: 'desc' });
    recentTable.minWidth = 680;
    const recent = ui.sortRows(data.recent(8), recentTable.sort, r => [r.name, r.kindLabel, r.group, r.status, r.modified]);
    const recentRows = recent.map(r => ui.tr([ui.entityLink(r.href, r.name), esc(r.kindLabel), esc(r.group), ui.chip(r.status, data.statusTone(r.status)), { html: ui.fmtDate(r.modified), cls: 'ob-cell-nowrap' }], r.href, recentColumns)).join('');
    return `
      <section class="ob-home-search" aria-labelledby="home-search-title">
        <h1 id="home-search-title">${esc(t('home.search.title'))}</h1>
        <p id="home-search-description">${esc(t('home.search.description'))}</p>
        <form id="home-search" class="ob-hero-search-form" role="search" aria-label="${esc(t('search.label'))}">
          ${views.searchField(ctx.state, true)}
          <button type="submit" class="ob-button ob-hero-search-submit" id="search-submit"${ctx.state.query.trim() ? '' : ' disabled'}>${esc(t('search.submit'))}</button>
        </form>
      </section>
      <div class="ob-kpi-grid">${kpis}</div>
      <div class="ob-home-sections">
      <section class="ob-section ob-home-domains">
        <h2>${esc(t('home.domains'))}</h2>
        ${ui.table(domainColumns, domainRows, domainTable)}
      </section>
      <section class="ob-section ob-home-recent">
        <h2>${esc(t('home.recent'))}</h2>
        ${ui.table(recentColumns, recentRows, recentTable)}
      </section></div>`;
  };

  /* ---- section lists and search results ----------------------------------------- */
  /** Raw column values of a section row (sorting). `withCount` includes the count column of the list view. */
  const rowValues = (kind, e, withCount) => {
    const c = data.cols(kind, e);
    return withCount ? [e.name, c[0], c[1], c[2], data.statusOf(kind, e)] : [e.name, c[0], c[1], data.statusOf(kind, e)];
  };
  /** One row of a section list (`withCount`) or of a search result table (`query` highlights the hits). */
  views.row = function (kind, e, columns, withCount, query) {
    const c = data.cols(kind, e);
    const st = data.statusOf(kind, e);
    const href = router.entityHref(kind, e.identifier);
    const text = query ? v => ui.highlight(v, query) : esc;
    const cells = [ui.entityLink(href, e.name, text(e.name)), text(c[0]), { html: `<span class="ob-clamp-2">${text(c[1])}</span>`, cls: 'ob-cell-muted' }];
    if (withCount) cells.push(esc(c[2]));
    cells.push(st ? ui.chip(st, data.statusTone(st)) : '');
    return ui.tr(cells, href, columns);
  };

  views.list = function (ctx) {
    const { kind, groups, mode, columns, state } = ctx;
    if (!groups.length) return ui.empty(t('collection.search.none'), ctx.filter ? `${esc(t('collection.search.hint'))}<p class="ob-empty-action"><button type="button" class="ob-button" data-action="clear-collection-filter">${esc(t('collection.search.clear'))}</button></p>` : '');
    const header = g => `<button type="button" class="ob-group-header" aria-expanded="${g.open}" data-action="toggle-group" data-key="${esc(g.id)}">${icon(g.open ? 'chevron_down' : 'chevron_right', 'sm')}<span class="ob-group-title">${esc(g.title)}</span><span class="ob-group-count">(${g.items.length})</span></button>`;
    if (mode === 'tiles') {
      return `<div class="ob-groups">${groups.map(g => `<div class="ob-group">${header(g)}${g.open ? `<div class="ob-group-body"><div class="ob-tiles">${g.items.map(e => `<a class="ob-card ob-tile" href="${router.entityHref(kind, e.identifier)}"><span class="ob-tile-name">${esc(e.name)}</span><span class="ob-tile-sub ob-clamp-2">${esc(e.description)}</span></a>`).join('')}</div></div>` : ''}</div>`).join('')}</div>`;
    }
    const options = ui.tableOptions(state, `list:${kind}`, { column: 0, direction: 'asc' });
    return `<div class="ob-groups ob-groups--table">${groups.map(g => {
      const items = ui.sortRows(g.items, options.sort, e => rowValues(kind, e, true));
      return `<div class="ob-group">${header(g)}${g.open ? `<div class="ob-group-body">${ui.table(columns, items.map(e => views.row(kind, e, columns, true)).join(''), { ...options, instance: g.id })}</div>` : ''}</div>`;
    }).join('')}</div>`;
  };

  /** Search results: groups and rows in relevance order (data.search); a column sort chosen by the user overrides the row order. */
  views.searchResults = function (ctx) {
    const q = ctx.state.query.trim();
    const groups = data.search(q);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const summary = `<p class="ob-view-description ob-search-summary">${esc(t(total === 1 ? 'search.summaryOne' : 'search.summary', { n: total, q }))}</p>`;
    if (!groups.length) return summary + ui.empty(t('search.none'), esc(t('search.noneHint')));
    return summary + `<div class="ob-search-groups">${groups.map(g => {
      const columns = data.searchColumns(g.kind);
      const options = ui.tableOptions(ctx.state, `search:${g.kind}`);
      const items = ui.sortRows(g.items, options.sort, e => rowValues(g.kind, e, false));
      return `<div>
        <div class="ob-search-group-head">${icon(g.icon, 'lg')}<span class="ob-group-title">${esc(g.title)}</span><span class="ob-group-count">(${g.items.length})</span></div>
        ${ui.table(columns, items.map(e => views.row(g.kind, e, columns, false, q)).join(''), options)}
      </div>`;
    }).join('')}</div>`;
  };

  views.notFound = () => ui.empty(t('notfound.title'), `${esc(t('notfound.text'))}<p class="ob-empty-action"><a href="#/">${esc(t('notfound.link'))}</a></p>`);

  /* ---- handbook -------------------------------------------------------------------------- */
  views.chapterTree = state => `<ul class="ob-tree">${data.manual.chapters.map((c, i) => `<li><div class="ob-tree-row ob-tree-row--chapter${state.chapter === c.id ? ' is-active' : ''}" style="--level:1"><a class="ob-tree-link" href="${router.build('/manual', { ch: c.id })}"${state.chapter === c.id ? ' aria-current="location"' : ''} data-action="chapter" data-chapter="${esc(c.id)}"><span class="ob-tree-label" title="${esc(c.title)}">${i + 1}. ${esc(c.title)}</span></a></div></li>`).join('')}</ul>`;

  views.manual = function (ctx) {
    const m = data.manual, model = data.model;
    const li = arr => arr.join('');

    const roleColumns = [{ label: t('manual.col.inCatalog'), width: '26%' }, { label: t('manual.col.nadb'), width: '28%' }, { label: t('manual.col.task') }];
    const coreColumns = [{ label: t('manual.col.field') }, { label: t('manual.col.inCatalog') }, { label: t('manual.col.dcat') }, { label: t('manual.col.archimate') }, { label: t('manual.col.dmbok') }];
    /** Chapter body renderers, keyed by chapter id; each receives manual.<id>. */
    const body = {
      einleitung: e => `<div><p>${esc(e.intro)}</p><ul class="ob-list">${li(e.questions.map(q => `<li>${esc(q)}</li>`))}</ul></div>${li(e.sections.map(s => `<div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`))}`,
      gouvernanz: g => {
        const roles = ui.table(roleColumns, li(g.roles.map(r => ui.tr([{ html: esc(r.label), cls: 'ob-cell-strong' }, esc(r.nadb), esc(r.task)], null, roleColumns))));
        return `<div><p>${esc(g.intro)}</p>${roles}</div><div><h3>${esc(g.workflowTitle)}</h3><p>${esc(g.workflowIntro)}</p><ol class="ob-list">${li(g.workflow.map(w => `<li><strong>${esc(w.title)}</strong> (${esc(w.who)}): ${esc(w.text)}</li>`))}</ol></div><div><h3>${esc(g.reportTitle)}</h3><p>${esc(g.reportText)}</p></div>`;
      },
      modell: mo => {
        const ext = Object.keys(model.kinds).map(k => ({ type: model.kinds[k].singular, en: model.kinds[k].en, fields: (model.extensions[k] || []).map(([f, l]) => `${f} (${l})`).join(', ') }));
        const core = ui.table(coreColumns, li(model.core.map(c => ui.tr([{ html: esc(c.field), cls: 'ob-cell-nowrap' }, esc(c.label), esc(c.dcat), esc(c.archimate), esc(c.dmbok)], null, coreColumns))));
        return `<div><p>${esc(mo.intro)}</p><ul class="ob-list">${li(mo.layers.map(l => `<li><strong>${esc(l.title)}</strong> (${esc(l.layer)}): ${esc(l.text)} ${esc(t('manual.example'))}: ${esc(l.example)}.</li>`))}</ul></div>
          <div><h3>${esc(mo.coreTitle)}</h3><p>${esc(mo.coreIntro)}</p>${core}</div>
          <div><h3>${esc(mo.extTitle)}</h3><ul class="ob-list">${li(ext.map(x => `<li><strong>${esc(x.type)}</strong> (${esc(x.en)}): ${esc(x.fields)}</li>`))}</ul></div>
          <div><h3>${esc(mo.statusTitle)}</h3><ul class="ob-list">${li(Object.entries(model.statuses).map(([k, v]) => `<li><strong>${esc(k)}</strong>: ${esc(v.text)}</li>`))}</ul></div>`;
      },
      nutzen: n => `<ol class="ob-list">${li(n.steps.map(s => `<li><strong>${esc(s.title)}</strong>: ${esc(s.text)}</li>`))}</ol>`,
      abrufen: a => `<ul class="ob-list"><li><strong>Export</strong>: ${esc(a.export)}</li><li><strong>API</strong>: ${esc(a.api)} <a href="#/api">${esc(t('manual.toApi'))}</a></li></ul>`,
      faq: f => `<ul class="ob-list ob-list--loose">${li(f.map(x => `<li><strong>${esc(x.q)}</strong><br>${esc(x.a)}</li>`))}</ul>`,
      glossar: g => `<ul class="ob-list">${li(g.map(x => `<li><strong>${esc(x.term)}</strong>: ${esc(x.text)}</li>`))}</ul>`,
      grundlagen: r => `<ul class="ob-list">${li(r.map(x => `<li><strong>${esc(x.title)}</strong> (${esc(x.source)}): ${ui.link(x.url, esc(x.url), { external: true })}</li>`))}</ul>`,
    };
    const chapters = m.chapters.map((c, i) => {
      const render = body[c.id];
      if (!render || m[c.id] == null) return '';
      return `<section id="hb-${esc(c.id)}" class="ob-chapter" data-chapter="${esc(c.id)}"><h2>${i + 1}. ${esc(c.title)}</h2>${render(m[c.id])}</section>`;
    }).join('');
    return `<div class="ob-manual-content">${views.viewHeader(ctx)}<div class="ob-manual-chapters">${chapters}</div></div>`;
  };

  /* ---- API page --------------------------------------------------------------------------- */
  views.apiPage = function () {
    return `<div class="ob-api">
      <div id="swagger-ui" class="ob-swagger" aria-live="polite" aria-busy="true"><div class="ob-swagger-loading">${esc(t('api.loading'))}</div></div>
    </div>`;
  };

  /* ---- page composition ----------------------------------------------------------------- */
  views.page = function (route, state) {
    const ctx = views.context(route, state);
    let content;
    if (route.view === 'manual') content = views.manual(ctx);
    else if (route.view === 'api') content = views.apiPage();
    else if (route.view === 'home') content = views.home(ctx);
    else if (route.view === 'list') content = `${views.collectionHeader(ctx)}${views.collectionControls(ctx)}<p id="collection-filter-status" class="${ctx.filter ? 'ob-collection-status' : 'ob-sr-only'}" role="status" aria-atomic="true">${esc(views.collectionStatus(ctx))}</p><div id="collection-view-panel" role="tabpanel" aria-labelledby="view-tab-${ctx.mode}" tabindex="0">${views.list(ctx)}</div>`;
    else if (route.view === 'search') content = views.viewHeader(ctx) + views.searchResults(ctx);
    else if (route.view === 'detail') content = views.entityHeader(ctx) + DK.detail.render(route.entity, route, state);
    else content = views.viewHeader(ctx) + views.notFound();
    const backdrop = state.navDrawerOpen ? `<button type="button" class="ob-drawer-backdrop" tabindex="-1" aria-label="${esc(t('tree.close'))}" data-action="close-navigation"></button>` : '';
    return { html: `<div class="ob-workspace${route.view === 'api' ? ' ob-workspace--standalone' : ''}${state.sidebarCollapsed ? ' is-collapsed' : ''}">${views.sidePanel(route, state)}<section class="ob-content" id="page-content" tabindex="-1">${views.breadcrumb(ctx.crumbs)}${content}</section></div>${backdrop}`, ctx };
  };

  DK.views = views;
})(window.DK);
