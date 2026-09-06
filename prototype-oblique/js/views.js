/* Page context and HTML composition. Events belong to app.js. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router;
  const t = ui.t, esc = ui.esc, icon = ui.icon;
  const views = {};
  const routeNav = route => route.params.nav ? { nav: data.navModel() } : undefined;
  views.hasPageSearch = route => ['home', 'search'].includes(route?.view);

  /* header, nav, footer */
  views.headerTools = function (state, route) {
    const cfg = data.config;
    const formId = views.hasPageSearch(route) ? (route.view === 'home' ? 'home-search' : 'results-search') : null;
    return `
      <div class="ob-header-search${state.searchOpen ? ' is-open' : ''}" id="header-search">
        <button type="button" class="ob-button ob-button--icon" data-action="toggle-search" aria-label="${esc(t('search.label'))}"${formId ? ` aria-controls="${formId}"` : ` aria-expanded="${state.searchOpen}" aria-controls="header-search-field"`}>${icon('search', 'xl')}</button>
        ${formId ? '' : `<div id="header-search-field"${state.searchOpen ? '' : ' hidden'}>${views.toolbar({ state })}</div>`}
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
    const button = `<button type="button" class="ob-button ob-button--menu ob-language-select${open ? ' is-active' : ''}" aria-haspopup="menu" aria-expanded="${open}" aria-label="${esc(`${t('header.language')}: ${t('header.languageCurrent')}`)}" data-action="menu" data-menu="language">${ui.buttonContent(state.lang.toUpperCase(), { menu: true })}</button>`;
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

  /* page chrome */
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
    const tree = manual ? DK.manual.tree(state) : views.tree(route, state);
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

  /* context: everything the page composition needs */
  views.context = function (route, state) {
    const kinds = data.model.kinds;
    const isDomain = route.view === 'detail' && route.entity?.kind === 'domains';
    const mode = isDomain ? DK.detail.resolveTab(route.entity, route.params.tab || route.params.view || state.mode) : state.mode;
    const ctx = {
      route, state, entity: route.entity, kind: isDomain ? 'objects' : route.kind, mode, isDomain,
      isList: route.view === 'list' || (isDomain && mode !== 'overview'),
      isRows: route.view === 'detail' && !isDomain && DK.detail.resolveTab(route.entity, route.params.tab) === 'rows',
      groups: [], columns: [], groupOptions: [], groupLabel: '', groupBy: null, actions: [], crumbs: [], title: '',
      filter: isDomain && mode === 'overview' ? '' : (route.params.filter || '').trim(), total: 0, matched: 0,
      domain: isDomain ? route.entity : route.view === 'list' && route.params.domain ? data.domainOf(route.params.domain) : null,
    };
    if (ctx.isList) {
      const defaultGroup = isDomain ? 'none' : data.defaultGroup(ctx.kind);
      const requestedGroup = route.params.group || state.groupBy[route.kind] || defaultGroup;
      const availableGroups = data.groupOptions(ctx.kind);
      const g = availableGroups.some(o => o.id === requestedGroup) ? requestedGroup : defaultGroup;
      ctx.groupBy = g;
      ctx.groupOptions = availableGroups.map(o => Object.assign(o, { active: o.id === g }));
      ctx.groupLabel = (ctx.groupOptions.find(o => o.id === g) || ctx.groupOptions[0] || { label: '' }).label;
      const closed = ctx.filter ? (state.filteredClosed || {}) : state.closed;
      const members = ctx.domain ? data.membersOfDomain(ctx.kind, ctx.domain) : data.list(ctx.kind);
      const memberIds = new Set(members.map(e => e.identifier));
      ctx.total = members.length;
      ctx.groups = data.buildGroups(ctx.kind, g, ctx.mode === 'table').map(x => {
        // Identically named groups in different domain scopes are independent disclosures.
        const id = ctx.domain ? `${ctx.domain.identifier}:${x.id}` : x.id;
        return { ...x, id, items: x.items.filter(e => memberIds.has(e.identifier) && data.matchesCollection(ctx.kind, e, ctx.filter)), open: !closed[id] };
      }).filter(x => x.items.length);
      ctx.matched = ctx.groups.reduce((sum, x) => sum + x.items.length, 0);
      ctx.columns = data.columns(ctx.kind);
    }

    if (ctx.isRows) {
      ctx.rowList = DK.detail.rowsContext(route.entity, route, state);
      ctx.total = ctx.rowList.total;
      ctx.matched = ctx.rowList.matched;
    }
    if (route.view === 'search') {
      ctx.searchGroups = DK.search.results((route.params.q || '').trim(), state.searchOptions);
      ctx.searchPage = DK.search.page(ctx.searchGroups, (route.params.q || '').trim(), route.params);
    }

    const e = route.entity;
    const titles = { home: () => t('home.title'), list: () => kinds[route.kind].plural, search: () => t('search.title'), manual: () => t('manual.title'), api: () => t('api.title'), detail: () => e.kind === 'tables' ? data.displayName('tables', e) : e.name };
    ctx.title = (titles[route.view] || (() => t('notfound.title')))();
    if (ctx.domain && !isDomain) ctx.title += ' – ' + ctx.domain.name;

    // Breadcrumbs follow section, container and entity; home is the root.
    const crumbs = [{ label: t('nav.home'), href: '#/' }];
    if (route.view === 'detail') {
      const container = data.navModel() === 'container';
      const nav = routeNav(route);
      const sec = k => ({ label: kinds[k].plural, href: router.listHref(k, nav) });
      const ent = (k, x) => ({ label: x.name, href: router.entityHref(k, x.identifier, nav) });
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

    const A = (id, label) => ({ id, label });
    if (route.view === 'detail' || ctx.isList) {
      ctx.actions = [A('xlsx', t('toolbar.export.xlsx')), A('xlsx-all', t('toolbar.export.xlsxAll'))];
      if (route.view === 'detail' && e.kind === 'products') ctx.actions.push(A('dcat', t('toolbar.export.dcat')));
    }
    ctx.canPrint = ctx.actions.length > 0 && ['objects', 'tables', 'domains', 'systems', 'refs', 'products', 'apis'].includes(route.kind);
    return ctx;
  };

  /* toolbar */
  /** Suggestion listbox. Options are numbered in listbox order; the "all results" row comes last. */
  views.suggest = function (state) {
    const q = state.query.trim();
    if (!state.suggest || !DK.search.canSuggest(q, state.searchOptions)) return '';
    if (!q) return `<div id="search-suggest" class="ob-suggest" role="listbox" tabindex="-1" aria-label="${esc(t('search.suggestions'))}">
      <div role="group" aria-label="${esc(t('search.examples'))}"><div class="ob-suggest-group-title" aria-hidden="true">${esc(t('search.examples'))}</div>
        ${DK.search.examples(state.searchOptions).map((example, i) => `<div role="option" id="suggest-${i}" class="ob-suggest-option ob-suggest-example" aria-selected="${state.suggestIdx === i}" data-action="suggest-example" data-query="${esc(example.query)}"><span>${esc(example.query)}</span><span class="ob-suggest-meta">${esc(t('search.example.' + example.type))}</span></div>`).join('')}
      </div></div>`;
    const groups = DK.search.suggest(q, state.searchOptions);
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
    const menu = open ? `<div class="ob-menu ob-menu--wide" role="menu" aria-label="${esc(t('toolbar.export'))}">${ctx.actions.map(a => `<button type="button" role="menuitem" class="ob-menu-item" data-action="export" data-export="${esc(a.id)}" data-label="${esc(a.label)}"${['xlsx', 'xlsx-all'].includes(a.id) && ctx.state.exporting ? ' disabled' : ''}>${esc(a.label)}</button>`).join('')}</div>` : '';
    return `<div class="ob-menu-host ob-actions-menu"><button type="button" class="ob-button ob-button--menu" aria-label="${esc(t('toolbar.export'))}" aria-haspopup="menu" aria-expanded="${open}" data-action="menu" data-menu="actions">${ui.buttonContent(t('toolbar.export'), { icon: 'download', menu: true, iconClass: 'ob-export-icon', labelClass: 'ob-export-label', chevronClass: 'ob-export-chevron' })}</button>${menu}</div>`;
  };

  views.entityHeader = function (ctx) {
    const e = ctx.entity;
    return `<header class="ob-view-header ob-entity-header"><div class="ob-title-row"><h1>${esc(ctx.title)}</h1>${views.pageActions(ctx)}</div>${e.description ? `<p class="ob-prose ob-detail-description">${esc(e.description)}</p>` : ''}</header>`;
  };

  views.pageActions = ctx => `<div class="ob-page-actions">${ctx.canPrint ? `<button type="button" class="ob-button" data-action="export" data-export="diagram-pdf">${icon('file_list')}<span>${esc(t('print.open'))}</span></button>` : ''}${views.actionsMenu(ctx)}</div>`;

  views.collectionHeader = ctx => `<header class="ob-view-header ob-collection-header"><div class="ob-title-row"><h1>${esc(ctx.title)}</h1>${views.pageActions(ctx)}</div><p class="ob-prose ob-view-description">${esc(data.kindDef(ctx.kind).description)}</p></header>`;

  views.viewHeader = ctx => `<header class="ob-view-header"><h1>${esc(ctx.title)}</h1></header>`;

  views.groupMenu = function (ctx) {
    const state = ctx.state;
    const menu = state.menu === 'group' ? `<div class="ob-menu" role="menu" aria-label="${esc(t('toolbar.group'))}">${ctx.groupOptions.map(o => `<button type="button" role="menuitem" class="ob-menu-item${o.active ? ' is-active' : ''}" data-action="set-group" data-group="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div>` : '';
    return `<div class="ob-menu-host ob-collection-group"><button type="button" class="ob-button ob-button--menu" aria-haspopup="menu" aria-expanded="${state.menu === 'group'}" data-action="menu" data-menu="group">${ui.buttonContent(`${t('toolbar.group')}: ${ctx.groupLabel}`, { icon: 'grid', menu: true })}</button>${menu}</div>`;
  };

  views.collectionControls = function (ctx) {
    const modes = ctx.isDomain ? DK.detail.tabs(ctx.entity) : [['tiles', t('toolbar.tiles')], ['table', t('toolbar.table')]];
    const tabs = modes.map(([id, label]) => `<button type="button" role="tab" id="view-tab-${id}" class="ob-tab ob-view-tab" aria-selected="${ctx.mode === id}" aria-controls="collection-view-panel" tabindex="${ctx.mode === id ? '0' : '-1'}" data-action="set-view" data-view="${id}">${esc(label)}</button>`).join('');
    return `<div class="ob-collection-controls">
      <div class="ob-tabs-frame ob-collection-tabs-frame"><div class="ob-tabs" role="tablist" aria-label="${esc(t('toolbar.view'))}">${tabs}</div></div>
      ${ctx.mode === 'overview' ? '' : `<div class="ob-local-actions">
        ${ui.collectionSearch(ctx.filter, 'collection-view-panel')}${views.groupMenu(ctx)}
      </div>`}
    </div>`;
  };

  views.collection = ctx => `${views.collectionControls(ctx)}${ctx.mode === 'overview' ? '' : ui.collectionStatus(ctx)}<div id="collection-view-panel" role="tabpanel" aria-labelledby="view-tab-${ctx.mode}" tabindex="0">${ctx.mode === 'overview' ? DK.detail.overview(ctx.entity) : views.list(ctx)}</div>`;

  /** One combobox for home, results and the expandable header. */
  views.searchField = function (state, home = false) {
    const q = state.query;
    const open = state.suggest && DK.search.canSuggest(q, state.searchOptions);
    return `<div class="ob-search"><div class="ob-search-control">
        ${icon('search', 'lg', 'ob-search-icon')}
        <input type="search" class="ob-input ob-search-input" id="search-input" name="q" value="${esc(q)}" placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.label'))}"${home ? ' aria-describedby="home-search-description"' : ''} role="combobox" aria-expanded="${open}" aria-controls="search-suggest"${open && state.suggestIdx >= 0 ? ` aria-activedescendant="suggest-${state.suggestIdx}"` : ''} aria-autocomplete="list" autocomplete="off" spellcheck="false" enterkeyhint="search">
        <button type="button" class="ob-icon-button ob-search-clear" id="search-clear" aria-label="${esc(t('search.clear'))}" data-action="clear-query"${q ? '' : ' hidden'}>${icon('xmark')}</button>
        </div>
        <div id="search-suggest-host">${views.suggest(state)}</div>
      </div>`;
  };
  views.toolbar = ctx => `<div class="ob-toolbar">${views.searchField(ctx.state)}<div class="ob-toolbar-spacer"></div></div>`;
  views.searchForm = (state, home = false) => `<form id="${home ? 'home-search' : 'results-search'}" class="ob-hero-search-form" role="search" aria-label="${esc(t('search.label'))}">
    ${views.searchField(state, home)}
    <button type="submit" class="ob-button ob-button--primary ob-hero-search-submit" id="search-submit"${DK.search.canSubmit(state.query, state.searchOptions) ? '' : ' disabled'}>${esc(t('search.submit'))}</button>
  </form>`;

  /** Same disclosure on home and results; native checkboxes keep keyboard/touch behavior. */
  views.searchOptions = function (state) {
    const kinds = DK.search.kinds(), selected = DK.search.selectedKinds(state.searchOptions);
    const all = selected.length === kinds.length, none = !selected.length;
    const domains = DK.search.domains(), selectedDomains = DK.search.selectedDomains(state.searchOptions);
    const allDomains = selectedDomains.length === domains.length, noDomains = !selectedDomains.length;
    const ai = state.searchOptions?.ai !== false;
    const summary = t(none ? 'search.scope.none' : all ? 'search.scope.all' : 'search.scope.some', { n: selected.length, total: kinds.length });
    const domainSummary = t(noDomains ? 'search.domains.none' : allDomains ? 'search.domains.all' : selectedDomains.length === 1 ? 'search.domains.one' : 'search.domains.some', { n: selectedDomains.length, total: domains.length, name: data.domainOf(selectedDomains[0])?.name || '' });
    const choices = (facet, title, items, selection) => `<fieldset class="ob-search-option-group"><legend>${esc(title)}</legend>
      <div class="ob-search-choice-grid">${items.map(({ id, label }) => `<label class="ob-check"><input type="checkbox" id="search-${facet}-${esc(id)}" data-search-${facet === 'type' ? 'kind' : facet}="${esc(id)}"${selection.includes(id) ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>
      <div class="ob-search-options-actions"><button type="button" class="ob-button ob-button--link" data-action="search-${facet}s-none"${selection.length ? '' : ' disabled'}>${esc(t('search.scope.clear'))}</button><button type="button" class="ob-button ob-button--link" data-action="search-${facet}s-all"${selection.length === items.length ? ' disabled' : ''}>${esc(t('search.scope.selectAll'))}</button></div>
      </fieldset>`;
    return `<div class="ob-search-options">
      <div class="ob-search-scope"><p id="search-scope-summary" role="status">${esc(domainSummary)} ${esc(summary)}${ai ? '' : ` ${esc(t('search.scope.noAI'))}`}</p>
        <button type="button" class="ob-button ob-button--link" id="search-options-toggle" data-action="toggle-search-options" aria-expanded="${!!state.searchFiltersOpen}" aria-controls="search-options-panel">${esc(t(all && allDomains && ai ? 'search.scope.choose' : 'search.scope.change'))}${icon('chevron_down', 'sm')}</button>
      </div>
      <div class="ob-panel ob-search-options-panel" id="search-options-panel"${state.searchFiltersOpen ? '' : ' hidden'}>
        ${choices('domain', t('search.domains.legend'), data.list('domains').map(d => ({ id: d.identifier, label: d.name })), selectedDomains)}
        ${choices('type', t('search.scope.legend'), kinds.map(kind => ({ id: kind, label: t('search.type.' + kind) })), selected)}
        <fieldset class="ob-search-option-group"><legend>${esc(t('search.scope.extra'))}</legend><label class="ob-check"><input type="checkbox" id="search-ai"${ai ? ' checked' : ''}><span>${esc(t('search.ai.enable'))} ${ui.chip(t('search.ai.demo'), 'outline')}</span></label></fieldset>
      </div></div>`;
  };

  views.searchAnswer = function (query, options, groups) {
    const answer = DK.search.answer(query, options, groups);
    if (!answer) return '';
    return `<section class="ob-panel ob-search-answer" aria-labelledby="search-answer-title">
      <div class="ob-search-answer-head"><h2 id="search-answer-title">${esc(t('search.ai.title'))}</h2>${ui.chip(t('search.ai.demo'), 'outline')}</div>
      <p class="ob-search-answer-note">${esc(t(answer.sources.length ? 'search.ai.note' : 'search.ai.empty'))}</p>
      ${answer.sources.map((source, i) => `<p class="ob-search-answer-excerpt">${esc(source.excerpt)} <a href="${esc(router.entityHref(source.kind, source.id))}" aria-label="${esc(t('search.ai.source', { n: i + 1, name: source.title }))}">[${i + 1}]</a></p>`).join('')}
      ${answer.sources.length ? `<h3>${esc(t('search.ai.sources'))}</h3><ol class="ob-search-answer-sources">${answer.sources.map(source => `<li>${ui.entityLink(router.entityHref(source.kind, source.id), source.title)} <span class="ob-search-answer-type">${esc(t('search.type.' + source.kind))}</span> ${ui.chip(source.status, data.statusTone(source.status))}</li>`).join('')}</ol>` : ''}
      <button type="button" class="ob-button ob-button--link" data-action="hide-search-ai">${esc(t('search.ai.hide'))}</button>
    </section>`;
  };

  /* catalog tree */
  views.tree = function (route, state, onlySection) {
    const kinds = data.model.kinds;
    const collator = new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' });
    const navParams = routeNav(route);
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
      branches.sort((a, b) => collator.compare(a.title, b.title)).forEach(b => {
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
        b.items.map(m => ({ entity: m, label: data.displayName(b.itemKind, m) }))
          .sort((a, b) => collator.compare(a.label, b.label))
          .forEach(({ entity: m, label }) => items.push({ label, count: data.sizeOf(b.itemKind, m), level: 3, icon: kinds[b.itemKind].icon, active: isActive(b.itemKind, m.identifier), href: entityHref(b.itemKind, m.identifier) }));
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

  /* home */
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
      <section class="ob-home-search ob-page-search" aria-labelledby="home-search-title">
        <h1 id="home-search-title">${esc(t('home.search.title'))}</h1>
        <p id="home-search-description">${esc(t('home.search.description'))}</p>
        ${views.searchForm(ctx.state, true)}
        <div id="search-options-host">${views.searchOptions(ctx.state)}</div>
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

  /* section lists and search results */
  function collectionRow(kind, entity, columns, nav) {
    const [name, context, description, count, status] = data.collectionValues(kind, entity);
    const href = router.entityHref(kind, entity.identifier, nav);
    return ui.tr([
      ui.entityLink(href, name), esc(context),
      { html: `<span class="ob-clamp-2">${esc(description)}</span>`, cls: 'ob-cell-muted' },
      esc(count), status ? ui.chip(status, data.statusTone(status)) : '',
    ], href, columns);
  };

  views.tile = function (kind, entity, nav) {
    const name = ui.localized(entity.labels) || entity.name;
    const technical = entity.technicalName && entity.technicalName !== name ? entity.technicalName : '';
    const count = data.tileSummary(kind, entity);
    const status = data.statusOf(kind, entity);
    return `<a class="ob-card ob-tile" href="${router.entityHref(kind, entity.identifier, nav)}" title="${esc(data.displayName(kind, entity))}">
      <span class="ob-tile-heading"><span class="ob-tile-name">${esc(name)}</span>${technical ? `<span class="ob-tile-technical">${esc(technical)}</span>` : ''}</span>
      <span class="ob-tile-sub">${esc(entity.description)}</span>
      <span class="ob-tile-footer"><span>${esc(count)}</span>${status ? ui.chip(status, data.statusTone(status)) : ''}</span>
    </a>`;
  };

  views.list = function (ctx) {
    const { kind, groups, mode, columns, state } = ctx;
    const nav = routeNav(ctx.route);
    if (!groups.length) return ui.collectionEmpty(ctx.filter);
    const header = g => `<button type="button" class="ob-group-header" aria-expanded="${g.open}" data-action="toggle-group" data-key="${esc(g.id)}">${icon(g.open ? 'chevron_down' : 'chevron_right', 'sm')}<span class="ob-group-title">${esc(g.title)}</span><span class="ob-group-count">(${g.items.length})</span></button>`;
    if (mode === 'tiles') {
      return `<div class="ob-groups">${groups.map(g => `<div class="ob-group">${header(g)}${g.open ? `<div class="ob-group-body"><div class="ob-tiles">${g.items.map(e => views.tile(kind, e, nav)).join('')}</div></div>` : ''}</div>`).join('')}</div>`;
    }
    const options = ui.tableOptions(state, `list:${kind}`, { column: 0, direction: 'asc' });
    return `<div class="ob-groups ob-groups--table">${groups.map(g => {
      const items = ui.sortRows(g.items, options.sort, entity => data.collectionValues(kind, entity));
      return `<div class="ob-group">${header(g)}${g.open ? `<div class="ob-group-body">${ui.table(columns, items.map(entity => collectionRow(kind, entity, columns, nav)).join(''), { ...options, instance: g.id })}</div>` : ''}</div>`;
    }).join('')}</div>`;
  };

  /** A single globally ordered result table, with the same pager as detail tables. */
  views.searchResults = function (ctx) {
    const q = (ctx.route.params.q || '').trim();
    if (!DK.search.selectedDomains(ctx.state.searchOptions).length) return ui.empty(t('search.domains.none'), `<button type="button" class="ob-button" data-action="search-domains-all">${esc(t('search.domains.selectAll'))}</button>`);
    if (!DK.search.selectedKinds(ctx.state.searchOptions).length) return ui.empty(t('search.scope.none'), `<button type="button" class="ob-button" data-action="search-types-all">${esc(t('search.scope.selectAll'))}</button>`);
    const paging = ctx.searchPage, total = paging.total;
    const answer = views.searchAnswer(q, ctx.state.searchOptions, ctx.searchGroups);
    if (!total) return answer + ui.empty(t('search.none'), esc(t('search.noneHint')));
    const columns = data.searchColumns();
    const rows = paging.items.map(({ kind, e }) => {
      const name = data.displayName(kind, e), href = router.entityHref(kind, e.identifier, routeNav(ctx.route));
      const status = data.statusOf(kind, e);
      return ui.tr([
        ui.entityLink(href, name, ui.highlight(name, q)),
        esc(data.kindDef(kind).singular),
        ui.highlight(data.cols(kind, e)[0] || '–', q),
        { html: `<span class="ob-clamp-2">${ui.highlight(e.description, q)}</span>`, cls: 'ob-cell-muted' },
        status ? ui.chip(status, data.statusTone(status)) : '',
      ], href, columns);
    }).join('');
    const sorting = `<label class="ob-search-sort" for="search-sort"><span>${esc(t('sort.label'))}</span><select id="search-sort" class="ob-select ob-select--comfortable" data-action="set-search-sort">${DK.search.sorts.map(sort => `<option value="${sort}"${sort === paging.sort ? ' selected' : ''}>${esc(t('search.sort.' + sort))}</option>`).join('')}</select></label>`;
    return answer + `<section id="search-page" tabindex="-1" aria-label="${esc(t('search.results'))}"><div class="ob-search-result-controls">${ui.pageRange(paging, true)}${sorting}</div>${ui.table(columns, rows)}${ui.pager(paging, { showRange: false })}</section>`;
  };

  views.notFound = () => ui.empty(t('notfound.title'), esc(t('notfound.text')), { actions: `<a href="#/">${esc(t('notfound.link'))}</a>` });

  /* API page */
  views.apiPage = function () {
    return `<div class="ob-api">
      <div id="swagger-ui" class="ob-swagger">${ui.loading(t('api.loading'))}</div>
    </div>`;
  };

  /* page composition */
  views.page = function (route, state) {
    const ctx = views.context(route, state);
    let content;
    if (route.view === 'manual') content = DK.manual.render(views.viewHeader(ctx));
    else if (route.view === 'api') content = views.apiPage();
    else if (route.view === 'home') content = views.home(ctx);
    else if (route.view === 'list') content = views.collectionHeader(ctx) + views.collection(ctx);
    else if (route.view === 'search') content = views.viewHeader(ctx) + `<div class="ob-page-search">${views.searchForm(state)}<div id="search-options-host" class="ob-search-results-options">${views.searchOptions(state)}</div></div><div id="search-results-panel">${views.searchResults(ctx)}</div>`;
    else if (route.view === 'detail') content = views.entityHeader(ctx) + DK.detail.render(route.entity, route, state, ctx);
    else content = views.viewHeader(ctx) + views.notFound();
    const backdrop = state.navDrawerOpen ? `<button type="button" class="ob-drawer-backdrop" tabindex="-1" aria-label="${esc(t('tree.close'))}" data-action="close-navigation"></button>` : '';
    return { html: `<div class="ob-workspace${route.view === 'api' ? ' ob-workspace--standalone' : ''}${state.sidebarCollapsed ? ' is-collapsed' : ''}">${views.sidePanel(route, state)}<section class="ob-content" id="page-content" tabindex="-1">${views.breadcrumb(ctx.crumbs)}${content}</section></div>${backdrop}`, ctx };
  };

  DK.views = views;
})(window.DK);
