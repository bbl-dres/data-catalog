/* views.js – HTML rendering for header, navigation, tree, toolbar, home,
   section lists, search results, handbook and API page.
   Pure functions: (route, state) → html string. Detail pages live in detail.js. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router;
  const t = ui.t, esc = ui.esc, icon = ui.icon;
  const views = {};

  /* ---- header, nav, footer ------------------------------------------------ */
  views.headerTools = function (state) {
    const cfg = data.config;
    return `
      <span class="ob-badge ob-chip--warning">${esc(cfg.app.badge)}</span>
      <div class="ob-popover-host" id="help-host">${views.helpHost(state)}</div>
      <div class="ob-menu-host" id="language-host">${views.languageHost(state)}</div>
      <div class="ob-avatar" title="${esc(cfg.app.user.name)}" aria-label="${esc(cfg.app.user.name)}">${esc(cfg.app.user.initials)}</div>`;
  };

  /** Language switch: a menu with the languages offered in config.json (app.languages); the UI dictionary changes, the catalog content stays German. */
  views.languageHost = function (state) {
    const open = state.menu === 'language';
    const languages = data.config.app.languages || ['de'];
    const button = `<button type="button" class="ob-button ob-language-select${open ? ' is-active' : ''}" aria-haspopup="menu" aria-expanded="${open}" aria-label="${esc(`${t('header.language')}: ${t('header.languageCurrent')}`)}" data-action="menu" data-menu="language">${esc(state.lang.toUpperCase())} ${icon('chevron_down', 'sm')}</button>`;
    if (!open) return button;
    const items = languages.map(l => `<button type="button" role="menuitemradio" aria-checked="${l === state.lang}" class="ob-menu-item${l === state.lang ? ' is-active' : ''}" lang="${l}" data-action="set-language" data-lang="${l}">${esc(t('lang.' + l))}</button>`).join('');
    return button + `<div class="ob-menu ob-menu--narrow" role="menu" aria-label="${esc(t('header.language'))}">${items}<p class="ob-menu-note">${esc(t('header.languageNote'))}</p></div>`;
  };

  views.helpHost = function (state) {
    const h = data.config.help;
    const open = state.menu === 'info';
    const btn = `<button type="button" class="ob-button ob-button--icon${open ? ' is-active' : ''}" title="${esc(t('header.help'))}" aria-label="${esc(t('header.help'))}" aria-haspopup="dialog" aria-expanded="${open}" data-action="help-toggle">${icon('question', 'xl')}</button>`;
    if (!open) return btn;
    const link = l => l.route
      ? `<a class="ob-popover-link" href="${esc(l.route)}">${esc(l.label)}</a>`
      : `<a class="ob-popover-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ${icon('link_external', 'sm')}</a>`;
    return btn + `
      <div class="ob-popover" role="dialog" aria-label="${esc(t('header.help'))}">
        <div class="ob-popover-arrow"></div>
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
            <li><a class="ob-inline-link" href="${esc(h.formUrl)}" target="_blank" rel="noopener">${esc(h.formLabel)} ${icon('link_external', 'sm')}</a></li>
          </ul>
        </section>
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
      return `<li><a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a></li>`;
    }).join('');
    return `<ul class="ob-footer-links">${links}</ul><span class="ob-footer-version">${esc(t('footer.version', { v: cfg.app.version }))}</span><span class="ob-footer-note">${esc(cfg.app.footerNote)}</span>`;
  };

  /* ---- page chrome --------------------------------------------------------- */
  views.breadcrumb = function (crumbs) {
    const items = crumbs.map((c, i) => {
      const last = i === crumbs.length - 1;
      return `<li>${last ? `<span aria-current="page">${esc(c.label)}</span>` : `<a href="${esc(c.href)}">${esc(c.label)}</a>${icon('chevron_right', 'xs')}`}</li>`;
    }).join('');
    return `<nav class="ob-breadcrumb" aria-label="${esc(t('nav.breadcrumb'))}"><ol>${items}</ol></nav>`;
  };

  /** Mobile drawer chrome around `inner`: the open button (with the current path), the content and the backdrop. */
  views.drawer = function (id, label, path, state, inner) {
    const toggle = `<div class="ob-mobile-navigation">
      <button type="button" class="ob-button ob-mobile-navigation-button" aria-controls="${esc(id)}" aria-expanded="${state.navDrawerOpen}" data-action="open-navigation">${icon('list', 'lg')}${esc(label)}</button>
      ${path ? `<span class="ob-mobile-navigation-path">${esc(path)}</span>` : ''}
    </div>`;
    const backdrop = state.navDrawerOpen ? `<button type="button" class="ob-drawer-backdrop" aria-label="${esc(t('tree.close'))}" data-action="close-navigation"></button>` : '';
    return toggle + inner + backdrop;
  };

  /** Sticky side panel (catalog tree, handbook chapters); becomes the drawer on narrow screens. */
  views.sidePanel = function (id, title, state, listHtml) {
    const header = `<div class="ob-drawer-header"><h2>${esc(title)}</h2><button type="button" class="ob-button ob-button--icon" aria-label="${esc(t('tree.close'))}" data-action="close-navigation">${icon('xmark', 'lg')}</button></div>`;
    return `<aside class="ob-tree-panel is-sticky${state.navDrawerOpen ? ' is-mobile-open' : ''}" id="${esc(id)}" aria-label="${esc(title)}">${header}<h2 class="ob-tree-title">${esc(title)}</h2><ul class="ob-tree">${listHtml}</ul></aside>`;
  };

  /* ---- context: everything the page composition needs -------------------- */
  views.context = function (route, state) {
    const kinds = data.model.kinds;
    const ctx = {
      route, state, entity: route.entity, kind: route.kind, mode: state.mode,
      isList: route.view === 'list',
      groups: [], columns: [], groupOptions: [], groupLabel: '', groupBy: null, actions: [], crumbs: [], title: '',
    };
    if (ctx.isList) {
      const requestedGroup = state.groupBy[route.kind] || data.defaultGroup(route.kind);
      const availableGroups = data.groupOptions(route.kind);
      const g = availableGroups.some(o => o.id === requestedGroup) ? requestedGroup : data.defaultGroup(route.kind);
      ctx.groupBy = g;
      ctx.groupOptions = availableGroups.map(o => Object.assign(o, { active: o.id === g }));
      ctx.groupLabel = (ctx.groupOptions.find(o => o.id === g) || ctx.groupOptions[0] || { label: '' }).label;
      ctx.groups = data.buildGroups(route.kind, g, ctx.mode === 'table').map(x => Object.assign(x, { open: !state.closed[x.id] }));
      ctx.columns = data.columns(route.kind);
    }

    // title
    const e = route.entity;
    const titles = { home: () => t('home.title'), list: () => kinds[route.kind].plural, search: () => t('search.title'), manual: () => t('manual.title'), api: () => t('api.title'), detail: () => e.name };
    ctx.title = (titles[route.view] || (() => t('notfound.title')))();

    // breadcrumbs: Startseite › section › container › entity. The home page is the root itself.
    const crumbs = [{ label: t('nav.home'), href: '#/' }];
    if (route.view === 'detail') {
      const container = data.navModel() === 'container';
      const sec = k => ({ label: kinds[k].plural, href: router.listHref(k) });
      const ent = (k, x) => ({ label: x.name, href: router.entityHref(k, x.identifier) });
      const dom = data.domainForEntity(e.kind, e);
      const sys = data.sysOf(e.system);
      const obj = e.kind === 'attrs' ? data.objOf(e.object) : null;
      const domCrumb = dom ? [ent('domains', dom)] : [];
      const sysCrumb = sys ? [ent('systems', sys)] : [];
      const objectsSec = sec(container ? 'domains' : 'objects');
      const tablesSec = sec(container ? 'systems' : 'tables');
      const path = {
        objects: [objectsSec, ...domCrumb],
        attrs: [objectsSec, ...domCrumb, ...(obj ? [ent('objects', obj)] : [])],
        tables: [tablesSec, ...sysCrumb],
        refs: [sec('refs'), ...domCrumb],
        products: [sec('products'), ...domCrumb],
        apis: [sec('apis')],
        domains: [objectsSec],
        systems: [tablesSec],
      }[e.kind];
      crumbs.push(...path, { label: data.displayName(e.kind, e) });
    } else if (route.view !== 'home') {
      crumbs.push({ label: ctx.title });
    }
    ctx.crumbs = crumbs;

    // actions menu
    const A = (id, label) => ({ id, label });
    if (route.view === 'detail') {
      const rowsWord = e.kind === 'apis' ? t('unit.endpoints') : (kinds[e.kind].rows || t('unit.attributes'));
      if (e.kind === 'attrs' || e.kind === 'apis') ctx.actions = [A('profile-pdf', t('toolbar.export.profilePdf'))];
      else if (e.kind === 'products') ctx.actions = [A('profile-pdf', t('toolbar.export.profilePdf')), A('dcat', t('toolbar.export.dcat'))];
      else ctx.actions = [A('csv', t('toolbar.export.csv', { what: rowsWord })), A('xlsx', t('toolbar.export.xlsx', { what: rowsWord })), A('profile-pdf', t('toolbar.export.profilePdf')), A('uml', t('toolbar.export.uml'))];
    } else if (route.view === 'list') {
      const w = t('toolbar.export.list');
      ctx.actions = [A('csv', t('toolbar.export.csv', { what: w })), A('xlsx', t('toolbar.export.xlsx', { what: w })), A('pdf', t('toolbar.export.pdf', { what: w })), A('uml', t('toolbar.export.uml'))];
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
    return `<div id="search-suggest" class="ob-suggest" role="listbox" aria-label="${esc(t('search.suggestions'))}">${html}<div role="option" id="suggest-${idx}" class="ob-suggest-all" aria-selected="${state.suggestIdx === idx}" data-action="open-results">${esc(label)}</div></div>`;
  };

  views.actionsMenu = function (ctx) {
    if (!ctx.actions.length) return '';
    const open = ctx.state.menu === 'actions';
    const menu = open ? `<div class="ob-menu ob-menu--wide" role="menu">${ctx.actions.map(a => `<button type="button" role="menuitem" class="ob-menu-item" data-action="export" data-export="${esc(a.id)}" data-label="${esc(a.label)}">${esc(a.label)}</button>`).join('')}</div>` : '';
    return `<div class="ob-menu-host ob-actions-menu"><button type="button" class="ob-button" aria-haspopup="menu" aria-expanded="${open}" data-action="menu" data-menu="actions">${esc(t('toolbar.export'))} ${icon('chevron_down', 'sm')}</button>${menu}</div>`;
  };

  views.titleRow = function (title, eyebrow, modifier, description, descriptionClass) {
    return `<header class="ob-view-header${modifier ? ` ${modifier}` : ''}">
      ${eyebrow ? `<div class="ob-entity-type">${esc(eyebrow)}</div>` : ''}
      <div class="ob-title-row"><div class="ob-title-copy"><h1>${esc(title)}</h1>${description ? `<p class="ob-prose ${descriptionClass || 'ob-view-description'}" title="${esc(description)}">${esc(description)}</p>` : ''}</div></div>
    </header>`;
  };

  views.entityHeader = function (ctx) {
    const e = ctx.entity;
    return views.titleRow(e.name, data.kindDef(e.kind).singular, 'ob-entity-header', e.description, 'ob-detail-description');
  };

  views.collectionHeader = ctx => views.titleRow(ctx.title, '', 'ob-collection-header', data.kindDef(ctx.kind).description);

  views.viewHeader = ctx => `<header class="ob-view-header"><h1>${esc(ctx.title)}</h1></header>`;

  views.groupMenu = function (ctx) {
    const state = ctx.state;
    const menu = state.menu === 'group' ? `<div class="ob-menu" role="menu">${ctx.groupOptions.map(o => `<button type="button" role="menuitem" class="ob-menu-item${o.active ? ' is-active' : ''}" data-action="set-group" data-group="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div>` : '';
    return `<div class="ob-menu-host ob-collection-group"><button type="button" class="ob-button" aria-haspopup="menu" aria-expanded="${state.menu === 'group'}" data-action="menu" data-menu="group">${esc(t('toolbar.group'))}: ${esc(ctx.groupLabel)} ${icon('chevron_down', 'sm')}</button>${menu}</div>`;
  };

  views.collectionControls = function (ctx) {
    const modes = [['tiles', t('toolbar.tiles')], ['table', t('toolbar.table')]];
    const tabs = modes.map(([id, label]) => `<button type="button" role="tab" id="view-tab-${id}" class="ob-tab ob-view-tab" aria-selected="${ctx.mode === id}" aria-controls="collection-view-panel" tabindex="${ctx.mode === id ? '0' : '-1'}" data-action="set-view" data-view="${id}">${esc(label)}</button>`).join('');
    return `<div class="ob-collection-controls">
      <div class="ob-tabs-frame ob-collection-tabs-frame"><div class="ob-tabs" role="tablist" aria-label="${esc(t('toolbar.view'))}">${tabs}</div></div>
      <div class="ob-local-actions">${views.groupMenu(ctx)}${views.actionsMenu(ctx)}</div>
    </div>`;
  };

  views.toolbar = function (ctx) {
    const state = ctx.state;
    const q = state.query;
    const open = state.suggest && !!q.trim();
    return `<div class="ob-toolbar">
      <div class="ob-search">
        ${icon('search', 'lg', 'ob-search-icon')}
        <input type="search" class="ob-search-input" id="search-input" value="${esc(q)}" placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.label'))}" role="combobox" aria-expanded="${open}" aria-controls="search-suggest" aria-autocomplete="list" autocomplete="off" spellcheck="false">
        <button type="button" class="ob-search-clear" id="search-clear" aria-label="${esc(t('search.clear'))}" data-action="clear-query"${q ? '' : ' hidden'}>${icon('xmark')}</button>
        <div id="search-suggest-host">${views.suggest(state)}</div>
      </div>
      <div class="ob-toolbar-spacer"></div>
    </div>`;
  };

  /* ---- catalog tree ------------------------------------------------------------- */
  views.tree = function (route, state) {
    const kinds = data.model.kinds;
    const e = route.entity;
    const treeE = e ? (e.kind === 'attrs' ? { kind: 'objects', id: e.object } : { kind: e.kind, id: e.identifier }) : null;
    const isActive = (kind, id) => !!treeE && treeE.kind === kind && treeE.id === id;
    const contains = (kind, members) => !!treeE && treeE.kind === kind && members.some(m => m.identifier === treeE.id);
    const items = [];
    const total = data.contentKinds().reduce((a, k) => a + data.list(k).length, 0);
    items.push({ label: t('tree.overview'), count: total, level: 1, icon: 'home', active: route.view === 'home', href: '#/', action: 'open-overview' });

    data.sections().forEach(sec => {
      const open = !!state.treeOpen[sec];
      items.push({ label: kinds[sec].plural, count: data.list(sec).length, level: 1, icon: kinds[sec].icon, expandable: true, expanded: open, active: route.view === 'list' && route.kind === sec, href: router.listHref(sec), key: sec });
      if (!open) return;
      // Level 2: the containers of a container section, else the section's groups. Level 3: their members.
      const childKind = { domains: 'objects', systems: 'tables' }[sec];
      const branches = childKind
        ? data.list(sec).map(c => ({ key: `${sec}:${c.identifier}`, title: c.name, entityKind: sec, entity: c, itemKind: childKind, items: sec === 'domains' ? data.objectsOfDomain(c) : data.tablesOfSystem(c) }))
        : data.buildGroups(sec, sec === 'tables' ? 'system' : 'domain').map(g => ({ key: g.id, title: g.title, entityKind: g.entityKind, entity: g.entity, itemKind: sec, items: g.items }));
      branches.forEach(b => {
        const bOpen = !!state.treeOpen[b.key] || contains(b.itemKind, b.items);
        items.push({
          label: b.title, count: b.items.length, level: 2, expandable: true, expanded: bOpen, key: b.key,
          active: !!b.entity && isActive(b.entityKind, b.entity.identifier),
          href: b.entity ? router.entityHref(b.entityKind, b.entity.identifier) : router.listHref(sec), toggleOnly: !b.entity,
        });
        if (!bOpen) return;
        b.items.forEach(m => items.push({ label: m.name, count: data.sizeOf(b.itemKind, m), level: 3, active: isActive(b.itemKind, m.identifier), href: router.entityHref(b.itemKind, m.identifier) }));
      });
    });
    items.forEach((it, i) => { if (it.level === 1 && i > 0) items[i - 1].divider = true; });

    const showCounts = data.config.showTreeCounts !== false;
    const li = it => {
      const toggle = it.expandable
        ? `<button type="button" class="ob-tree-toggle" aria-label="${esc(t(it.expanded ? 'tree.collapse' : 'tree.expand', { name: it.label }))}" aria-expanded="${!!it.expanded}" data-action="toggle-tree" data-key="${esc(it.key)}">${icon(it.expanded ? 'chevron_down' : 'chevron_right', 'sm')}</button>`
        : '<span class="ob-tree-spacer" aria-hidden="true"></span>';
      const content = `${it.icon ? icon(it.icon, 'lg') : ''}<span class="ob-tree-label">${esc(it.label)}</span>${showCounts ? `<span class="ob-tree-count">${it.count}</span>` : ''}`;
      const target = it.toggleOnly
        ? `<button type="button" class="ob-tree-link" data-action="toggle-tree" data-key="${esc(it.key)}">${content}</button>`
        : `<a class="ob-tree-link" href="${esc(it.href)}"${it.active ? ' aria-current="page"' : ''}${it.action ? ` data-action="${esc(it.action)}"` : it.key ? ` data-action="open-tree" data-key="${esc(it.key)}"` : ''}>${content}</a>`;
      return `<li><div class="ob-tree-row${it.active ? ' is-active' : ''}" style="--level:${it.level}">${toggle}${target}</div>${it.divider ? '<div class="ob-tree-divider"></div>' : ''}</li>`;
    };
    return views.sidePanel('catalog-navigation', t('tree.title'), state, items.map(li).join(''));
  };

  /* ---- home ---------------------------------------------------------------------- */
  views.home = function (ctx) {
    const kpis = data.kpis().map(k => `
      <a class="ob-kpi" href="${router.listHref(k.kind)}">
        <div class="ob-kpi-head">${icon(k.icon, 'xl')}<h3>${esc(k.label)}</h3></div>
        <span class="ob-kpi-count"><strong>${k.count}</strong>&nbsp;${esc(k.unit)} ${icon('arrow_right', 'sm')}</span>
      </a>`).join('');
    const domainColumns = [{ label: t('home.col.domain') }, { label: t('home.col.responsibility') }, { label: t('home.col.objects') }, { label: t('home.col.attributes') }];
    const domainTable = ui.tableOptions(ctx.state, 'home:domains', { column: 0, direction: 'asc' });
    const domainValues = d => {
      const objs = data.objectsOfDomain(d);
      return [d.name, d.responsibleOrg, objs.length, objs.reduce((sum, o) => sum + o.attributes.length, 0)];
    };
    const domainRows = ui.sortRows(data.domains, domainTable.sort, domainValues).map(d => {
      const v = domainValues(d);
      const href = router.entityHref('domains', d.identifier);
      return ui.tr([ui.entityLink(href, d.name), esc(v[1]), v[2], v[3]], href, domainColumns);
    }).join('');
    const recentColumns = [{ label: t('home.col.name') }, { label: t('home.col.type') }, { label: t('home.col.domain') }, { label: t('home.col.status') }, { label: t('home.col.modified') }];
    const recentTable = ui.tableOptions(ctx.state, 'home:recent', { column: 4, direction: 'desc' });
    const recent = ui.sortRows(data.recent(8), recentTable.sort, r => [r.name, r.kindLabel, r.group, r.status, r.modified]);
    const recentRows = recent.map(r => ui.tr([ui.entityLink(r.href, r.name), esc(r.kindLabel), esc(r.group), ui.chip(r.status, data.statusTone(r.status)), ui.fmtDate(r.modified)], r.href, recentColumns)).join('');
    return `
      <section class="ob-section">
        <div class="ob-kpi-grid">${kpis}</div>
        <h2>${esc(t('home.domains'))}</h2>
        ${ui.table(domainColumns, domainRows, domainTable)}
      </section>
      <section class="ob-section">
        <h2>${esc(t('home.recent'))}</h2>
        ${ui.table(recentColumns, recentRows, recentTable)}
      </section>`;
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
    const header = g => `<button type="button" class="ob-group-header" aria-expanded="${g.open}" data-action="toggle-group" data-key="${esc(g.id)}">${icon(g.open ? 'chevron_down' : 'chevron_right', 'sm')}<span class="ob-group-title">${esc(g.title)}</span><span class="ob-group-count">(${g.items.length})</span></button>`;
    if (mode === 'tiles') {
      return `<div class="ob-groups">${groups.map(g => `<div class="ob-group" style="--basis:${g.items.length > 8 ? '100%' : 'var(--ob-group-basis)'}">${header(g)}${g.open ? `<div class="ob-group-body"><div class="ob-tiles">${g.items.map(e => `<a class="ob-tile" href="${router.entityHref(kind, e.identifier)}"><span class="ob-tile-name">${esc(e.name)}</span><span class="ob-tile-sub ob-clamp-2">${esc(e.description)}</span></a>`).join('')}</div></div>` : ''}</div>`).join('')}</div>`;
    }
    const options = ui.tableOptions(state, `list:${kind}`, { column: 0, direction: 'asc' });
    return `<div class="ob-groups ob-groups--table">${groups.map(g => {
      const items = ui.sortRows(g.items, options.sort, e => rowValues(kind, e, true));
      return `<div class="ob-group">${header(g)}${g.open ? `<div class="ob-group-body">${ui.table(columns, items.map(e => views.row(kind, e, columns, true)).join(''), options)}</div>` : ''}</div>`;
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
  views.manual = function (ctx) {
    const state = ctx.state;
    const m = data.manual, model = data.model;
    const li = arr => arr.join('');
    const chapterList = m.chapters.map((c, i) => `<li><div class="ob-tree-row ob-tree-row--chapter${state.chapter === c.id ? ' is-active' : ''}" style="--level:1"><a class="ob-tree-link" href="${router.build('/manual', { ch: c.id })}"${state.chapter === c.id ? ' aria-current="location"' : ''} data-action="chapter" data-chapter="${esc(c.id)}"><span class="ob-tree-label">${i + 1}. ${esc(c.title)}</span></a></div></li>`).join('');
    const aside = views.sidePanel('manual-navigation', t('manual.title'), state, chapterList);

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
      grundlagen: r => `<ul class="ob-list">${li(r.map(x => `<li><strong>${esc(x.title)}</strong> (${esc(x.source)}): <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.url)}</a></li>`))}</ul>`,
    };
    const chapters = m.chapters.map((c, i) => {
      const render = body[c.id];
      if (!render || m[c.id] == null) return '';
      return `<section id="hb-${esc(c.id)}" class="ob-chapter" data-chapter="${esc(c.id)}"><h2>${i + 1}. ${esc(c.title)}</h2>${render(m[c.id])}</section>`;
    }).join('');
    const current = (m.chapters.find(c => c.id === state.chapter) || m.chapters[0]).title;
    return views.drawer('manual-navigation', t('manual.open'), current, state, `<div class="ob-manual"><div class="ob-manual-content">${views.viewHeader(ctx)}<div class="ob-manual-chapters">${chapters}</div></div>${aside}</div>`);
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
    let body;
    if (route.view === 'manual') body = views.manual(ctx);
    else if (route.view === 'api') body = views.apiPage();
    else {
      let content;
      if (route.view === 'home') content = views.home(ctx);
      else if (route.view === 'list') content = `${views.collectionHeader(ctx)}${views.collectionControls(ctx)}<div id="collection-view-panel" role="tabpanel" aria-labelledby="view-tab-${ctx.mode}" tabindex="0">${views.list(ctx)}</div>`;
      else if (route.view === 'search') content = views.viewHeader(ctx) + views.searchResults(ctx);
      else if (route.view === 'detail') content = views.entityHeader(ctx) + DK.detail.render(route.entity, route, state, views.actionsMenu(ctx));
      else content = views.viewHeader(ctx) + views.notFound();
      const path = ctx.crumbs.slice(1).map(c => c.label).join(' / ');
      body = views.toolbar(ctx) + views.drawer('catalog-navigation', t('tree.open'), path, state, `<div class="ob-catalog"><section class="ob-content">${content}</section>${views.tree(route, state)}</div>`);
    }
    return { html: views.breadcrumb(ctx.crumbs) + body, ctx };
  };

  DK.views = views;
})(window.DK);
