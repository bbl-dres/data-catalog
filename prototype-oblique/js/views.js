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
      <button type="button" class="ob-button ob-button--ghost" title="${esc(t('lang.more'))}" aria-label="${esc(t('nav.language'))}: Deutsch" disabled>DE ${icon('chevron_down', 'sm')}</button>
      <div class="ob-popover-host" id="help-host">${views.helpHost(state)}</div>
      <div class="ob-avatar" title="${esc(cfg.app.user.name)}" aria-label="${esc(cfg.app.user.name)}">${esc(cfg.app.user.initials)}</div>`;
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
      const ext = l.url && !/^mailto:/.test(l.url);
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

  views.pageHeader = title => `<div class="ob-page-header"><h1>${esc(title)}</h1></div>`;

  /* ---- context: everything the page composition needs -------------------- */
  views.context = function (route, state) {
    const kinds = data.model.kinds;
    const ctx = {
      route, state, entity: route.entity, kind: route.kind, mode: state.mode,
      isList: route.view === 'list', hasActions: route.view === 'list' || route.view === 'detail',
      groups: [], columns: [], groupOptions: [], groupLabel: '', groupBy: null, actions: [], crumbs: [], title: '',
    };
    if (ctx.isList) {
      const g = state.groupBy[route.kind] || data.defaultGroup(route.kind);
      ctx.groupBy = g;
      ctx.groupOptions = data.groupOptions(route.kind).map(o => Object.assign(o, { active: o.id === g }));
      ctx.groupLabel = (ctx.groupOptions.find(o => o.id === g) || ctx.groupOptions[0] || { label: '' }).label;
      ctx.groups = data.buildGroups(route.kind, g, state.mode === 'table').map(x => Object.assign(x, { open: !state.closed[x.id] }));
      ctx.columns = data.columns(route.kind);
    }

    // title
    const e = route.entity;
    switch (route.view) {
      case 'home': ctx.title = t('home.title'); break;
      case 'list': ctx.title = kinds[route.kind].plural; break;
      case 'search': ctx.title = t('search.title'); break;
      case 'manual': ctx.title = t('manual.title'); break;
      case 'api': ctx.title = t('api.title'); break;
      case 'detail': ctx.title = e.name; break;
      default: ctx.title = t('notfound.title');
    }

    // breadcrumbs
    const crumbs = [{ label: t('nav.home'), href: '#/' }];
    const container = data.navModel() === 'container';
    const sec = k => ({ label: kinds[k].plural, href: router.listHref(k) });
    const ent = (k, id, label) => ({ label, href: router.entityHref(k, id) });
    if (route.view === 'list') crumbs.push({ label: kinds[route.kind].plural });
    else if (route.view === 'search') crumbs.push({ label: t('search.title') });
    else if (route.view === 'manual') crumbs.push({ label: t('manual.title') });
    else if (route.view === 'api') crumbs.push({ label: t('api.title') });
    else if (route.view === 'detail') {
      const dom = data.domainForEntity(e.kind, e);
      switch (e.kind) {
        case 'objects': crumbs.push(container ? sec('domains') : sec('objects'), ent('domains', dom.identifier, dom.name), { label: e.name }); break;
        case 'attrs': { const o = data.objOf(e.object); crumbs.push(container ? sec('domains') : sec('objects'), ent('domains', dom.identifier, dom.name), ent('objects', o.identifier, o.name), { label: e.name }); break; }
        case 'tables': { const sy = data.sysOf(e.system); crumbs.push(container ? sec('systems') : sec('tables'), ent('systems', sy.identifier, sy.name), { label: `${e.name} (${e.technicalName})` }); break; }
        case 'products': crumbs.push(sec('products'), ent('domains', dom.identifier, dom.name), { label: e.name }); break;
        case 'apis': crumbs.push(sec('apis'), { label: `${e.name} ${e.version}` }); break;
        case 'refs': crumbs.push(sec('refs'), { label: e.sourceAuthority, href: router.listHref('refs') }, { label: e.name }); break;
        case 'domains': crumbs.push(container ? sec('domains') : sec('objects'), { label: e.name }); break;
        case 'systems': crumbs.push(container ? sec('systems') : sec('tables'), { label: e.name }); break;
      }
    } else if (route.view === 'notfound') crumbs.push({ label: t('notfound.title') });
    else crumbs.push({ label: t('home.title') });
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
  views.suggest = function (state) {
    const q = state.query.trim();
    state.suggestFlat = [];
    state.suggestAllIdx = 0;
    if (!state.suggest || !q) return '';
    const groups = data.suggest(q);
    let idx = 0;
    const html = groups.map(g => `<div role="group" aria-label="${esc(g.title)}"><div class="ob-suggest-group-title">${icon(g.icon, 'sm')}${esc(g.title)}</div>${g.items.map(e => {
      const i = idx++;
      const href = router.entityHref(g.kind, e.identifier);
      state.suggestFlat.push(href);
      return `<div role="option" id="suggest-${i}" class="ob-suggest-option" aria-selected="${state.suggestIdx === i}" data-action="suggest-pick" data-href="${esc(href)}"><span>${esc(e.name)}</span><span class="ob-suggest-option-sub">${esc(data.sub(g.kind, e))}</span></div>`;
    }).join('')}</div>`).join('');
    state.suggestAllIdx = idx;
    const label = groups.length ? t('search.showAll', { q }) : t('search.noSuggest', { q });
    return `<div id="search-suggest" class="ob-suggest" role="listbox" aria-label="${esc(t('search.suggestions'))}">${html}<div role="option" id="suggest-${idx}" class="ob-suggest-all" aria-selected="${state.suggestIdx === idx}" data-action="open-results">${esc(label)}</div></div>`;
  };

  views.toolbar = function (ctx) {
    const state = ctx.state;
    const q = state.query;
    const open = state.suggest && !!q.trim();
    const search = `
      <div class="ob-search">
        ${icon('search', 'lg', 'ob-search-icon')}
        <input type="search" class="ob-search-input" id="search-input" value="${esc(q)}" placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.label'))}" role="combobox" aria-expanded="${open}" aria-controls="search-suggest" aria-autocomplete="list" autocomplete="off" spellcheck="false">
        <button type="button" class="ob-search-clear" id="search-clear" aria-label="${esc(t('search.clear'))}" data-action="clear-query"${q ? '' : ' hidden'}>${icon('xmark')}</button>
        <div id="search-suggest-host">${views.suggest(state)}</div>
      </div>
      <div class="ob-toolbar-spacer"></div>`;
    let group = '', actions = '', toggle = '';
    if (ctx.isList) {
      const menu = state.menu === 'group' ? `<div class="ob-menu" role="menu">${ctx.groupOptions.map(o => `<button type="button" role="menuitem" class="ob-menu-item${o.active ? ' is-active' : ''}" data-action="set-group" data-group="${esc(o.id)}"><span>${esc(o.label)}</span><span class="ob-menu-item-hint">${esc(o.hint)}</span></button>`).join('')}</div>` : '';
      group = `<div class="ob-menu-host"><button type="button" class="ob-button" aria-haspopup="menu" aria-expanded="${state.menu === 'group'}" data-action="menu" data-menu="group">${esc(t('toolbar.group'))}: ${esc(ctx.groupLabel)} ${icon('chevron_down', 'sm')}</button>${menu}</div>`;
    }
    if (ctx.hasActions) {
      const menu = state.menu === 'actions' ? `<div class="ob-menu ob-menu--wide" role="menu">${ctx.actions.map(a => `<button type="button" role="menuitem" class="ob-menu-item ob-menu-item--lead" data-action="export" data-export="${esc(a.id)}" data-label="${esc(a.label)}">${icon('download')}${esc(a.label)}</button>`).join('')}</div>` : '';
      actions = `<div class="ob-menu-host"><button type="button" class="ob-button" aria-haspopup="menu" aria-expanded="${state.menu === 'actions'}" data-action="menu" data-menu="actions">${esc(t('toolbar.actions'))} ${icon('chevron_down', 'sm')}</button>${menu}</div>`;
    }
    if (ctx.isList) {
      toggle = `<div class="ob-toolbar-divider"></div><div class="ob-view-toggle" role="group" aria-label="${esc(t('toolbar.view'))}">
        <button type="button" class="ob-view-toggle-button" title="${esc(t('toolbar.tiles'))}" aria-label="${esc(t('toolbar.tiles'))}" aria-pressed="${ctx.mode === 'tiles'}" data-action="set-view" data-view="tiles">${icon('grid', 'lg')}</button>
        <button type="button" class="ob-view-toggle-button" title="${esc(t('toolbar.table'))}" aria-label="${esc(t('toolbar.table'))}" aria-pressed="${ctx.mode === 'table'}" data-action="set-view" data-view="table">${icon('list', 'lg')}</button>
      </div>`;
    }
    return `<div class="ob-toolbar">${search}${group}${actions}${toggle}</div>`;
  };

  /* ---- catalog tree ------------------------------------------------------------- */
  views.tree = function (route, state) {
    const kinds = data.model.kinds;
    const e = route.entity;
    const treeE = e ? (e.kind === 'attrs' ? { kind: 'objects', id: e.object } : { kind: e.kind, id: e.identifier }) : null;
    const isActive = (kind, id) => !!treeE && treeE.kind === kind && treeE.id === id;
    const items = [];
    const total = ['objects', 'tables', 'refs', 'products', 'apis'].reduce((a, k) => a + data.list(k).length, 0);
    items.push({ label: t('tree.overview'), count: total, pad: 16, icon: 'home', active: route.view === 'home', href: '#/' });

    data.sections().forEach(sec => {
      const open = !!state.treeOpen[sec];
      items.push({ label: kinds[sec].plural, count: data.list(sec).length, pad: 16, icon: kinds[sec].icon, expandable: true, expanded: open, active: route.view === 'list' && route.kind === sec, href: router.listHref(sec), key: sec, follow: true });
      if (!open) return;
      if (sec === 'domains' || sec === 'systems') {
        const childKind = sec === 'domains' ? 'objects' : 'tables';
        data.list(sec).forEach(c => {
          const members = sec === 'domains' ? data.objectsOfDomain(c) : data.tablesOfSystem(c);
          const key = `${sec}:${c.identifier}`;
          const cOpen = !!state.treeOpen[key] || (!!treeE && treeE.kind === childKind && members.some(m => m.identifier === treeE.id));
          items.push({ label: c.name, count: members.length, pad: 24, expandable: true, expanded: cOpen, active: isActive(sec, c.identifier), href: router.entityHref(sec, c.identifier), key });
          if (!cOpen) return;
          members.forEach(m => items.push({ label: m.name, count: data.sizeOf(childKind, m), pad: 32, active: isActive(childKind, m.identifier), href: router.entityHref(childKind, m.identifier) }));
        });
        return;
      }
      const gBy = { objects: 'domain', tables: 'system', refs: 'source', products: 'domain', apis: 'domain' }[sec];
      data.buildGroups(sec, gBy).forEach(g => {
        const gOpen = !!state.treeOpen[g.id] || (!!treeE && treeE.kind === sec && g.items.some(i => i.identifier === treeE.id));
        const cont = gBy === 'domain' ? ['domains', data.domains.find(d => d.name === g.title)] : gBy === 'system' ? ['systems', data.systems.find(s => s.name === g.title)] : null;
        const cEnt = cont && cont[1];
        items.push({
          label: g.title, count: g.items.length, pad: 24, expandable: true, expanded: gOpen,
          active: !!cEnt && isActive(cont[0], cEnt.identifier),
          href: cEnt ? router.entityHref(cont[0], cEnt.identifier) : router.listHref(sec), key: g.id, toggleOnly: !cEnt,
        });
        if (!gOpen) return;
        g.items.forEach(it => items.push({ label: it.name, count: data.sizeOf(sec, it), pad: 32, active: isActive(sec, it.identifier), href: router.entityHref(sec, it.identifier) }));
      });
    });
    items.forEach((it, i) => { if (it.pad === 16 && i > 0) items[i - 1].divider = true; });

    const showCounts = data.config.showTreeCounts !== false;
    const li = it => {
      const toggle = it.expandable
        ? `<button type="button" class="ob-tree-toggle" tabindex="-1" aria-hidden="true" data-action="toggle-tree" data-key="${esc(it.key)}">${icon(it.expanded ? 'chevron_down' : 'chevron_right', 'sm')}</button>`
        : '<span class="ob-tree-spacer"></span>';
      const action = it.key ? ` data-action="open-tree" data-key="${esc(it.key)}"${it.toggleOnly ? ' data-toggle="1"' : ''}` : '';
      return `<li role="none"><a class="ob-tree-item" role="treeitem" href="${esc(it.href)}" style="--pad:${it.pad}px" aria-selected="${!!it.active}"${it.expandable ? ` aria-expanded="${!!it.expanded}"` : ''}${action}>${toggle}${it.icon ? icon(it.icon, 'lg') : ''}<span class="ob-tree-label">${esc(it.label)}</span>${showCounts ? `<span class="ob-tree-count">${it.count}</span>` : ''}</a>${it.divider ? '<div class="ob-tree-divider"></div>' : ''}</li>`;
    };
    return `<aside class="ob-tree-panel" aria-label="${esc(t('tree.title'))}"><h3 class="ob-tree-title">${esc(t('tree.title'))}</h3><ul class="ob-tree" role="tree" aria-label="${esc(t('tree.title'))}">${items.map(li).join('')}</ul></aside>`;
  };

  /* ---- home ---------------------------------------------------------------------- */
  views.home = function () {
    const kpis = data.kpis().map(k => `
      <div class="ob-kpi">
        <div class="ob-kpi-head">${icon(k.icon, 'xl')}<h3>${esc(k.label)}</h3></div>
        <div class="ob-kpi-sub">${esc(k.sub)}</div>
        <a class="ob-kpi-link" href="${router.listHref(k.kind)}"><strong>${k.count}</strong>&nbsp;${esc(k.unit)} ${icon('arrow_right', 'sm')}</a>
      </div>`).join('');
    const domainRows = data.domains.map(d => {
      const objs = data.objectsOfDomain(d);
      const href = router.entityHref('domains', d.identifier);
      return ui.tr([`<a href="${href}">${esc(d.name)}</a>`, esc(d.responsibleOrg), objs.length, objs.reduce((a, o) => a + o.attributes.length, 0)], href);
    }).join('');
    const recentRows = data.recent(8).map(r => ui.tr([`<a href="${r.href}">${esc(r.name)}</a>`, esc(r.kindLabel), esc(r.group), ui.chip(r.status, data.statusTone(r.status)), ui.fmtDate(r.modified)], r.href)).join('');
    return `
      <section class="ob-section">
        <div class="ob-kpi-grid">${kpis}</div>
        <h2>${esc(t('home.domains'))}</h2>
        ${ui.table([{ label: t('home.col.domain') }, { label: t('home.col.responsibility') }, { label: t('home.col.objects') }, { label: t('home.col.attributes') }], domainRows)}
      </section>
      <section class="ob-section">
        <h2>${esc(t('home.recent'))}</h2>
        ${ui.table([{ label: t('home.col.name') }, { label: t('home.col.type') }, { label: t('home.col.domain') }, { label: t('home.col.status') }, { label: t('home.col.modified') }], recentRows)}
      </section>`;
  };

  /* ---- section lists ----------------------------------------------------------------- */
  views.listRow = function (kind, e) {
    const c = data.cols(kind, e);
    const st = data.statusOf(kind, e);
    const href = router.entityHref(kind, e.identifier);
    return ui.tr([`<a href="${href}">${esc(e.name)}</a>`, esc(c[0]), { html: `<span class="ob-clamp-2">${esc(c[1])}</span>`, cls: 'ob-cell-muted' }, esc(c[2]), st ? ui.chip(st, data.statusTone(st)) : ''], href);
  };
  views.searchRow = function (kind, e) {
    const c = data.cols(kind, e);
    const st = data.statusOf(kind, e);
    const href = router.entityHref(kind, e.identifier);
    return ui.tr([`<a href="${href}">${esc(e.name)}</a>`, esc(c[0]), { html: `<span class="ob-clamp-2">${esc(c[1])}</span>`, cls: 'ob-cell-muted' }, st ? ui.chip(st, data.statusTone(st)) : ''], href);
  };

  views.list = function (ctx) {
    const { kind, groups, mode, columns } = ctx;
    const header = g => `<button type="button" class="ob-group-header" aria-expanded="${g.open}" data-action="toggle-group" data-key="${esc(g.id)}">${icon(g.open ? 'chevron_down' : 'chevron_right', 'sm')}<span class="ob-group-title">${esc(g.title)}</span><span class="ob-group-count">(${g.items.length})</span></button>`;
    if (mode === 'tiles') {
      return `<div class="ob-groups">${groups.map(g => `<div class="ob-group" style="--basis:${g.items.length > 8 ? '100%' : '400px'}">${header(g)}${g.open ? `<div class="ob-tiles">${g.items.map(e => `<a class="ob-tile" href="${router.entityHref(kind, e.identifier)}" title="${esc(e.description)}"><span class="ob-tile-name">${esc(e.name)}</span><span class="ob-tile-sub">${esc(data.sub(kind, e))}</span></a>`).join('')}</div>` : ''}</div>`).join('')}</div>`;
    }
    return `<div class="ob-groups ob-groups--table">${groups.map(g => `<div class="ob-group">${header(g)}${g.open ? ui.table(columns, g.items.map(e => views.listRow(kind, e)).join('')) : ''}</div>`).join('')}</div>`;
  };

  /* ---- search results --------------------------------------------------------------- */
  views.searchResults = function (query) {
    const groups = data.search(query);
    if (!groups.length) return `<div class="ob-empty"><div class="ob-empty-title">${esc(t('search.none'))}</div><div>${esc(t('search.noneHint'))}</div></div>`;
    return `<div class="ob-search-groups">${groups.map(g => `
      <div>
        <div class="ob-search-group-head">${icon(g.icon, 'lg')}<span class="ob-group-title">${esc(g.title)}</span><span class="ob-group-count">(${g.items.length})</span></div>
        ${ui.table(data.searchColumns(g.kind), g.items.map(e => views.searchRow(g.kind, e)).join(''))}
      </div>`).join('')}</div>`;
  };

  views.notFound = () => `<div class="ob-empty"><div class="ob-empty-title">${esc(t('notfound.title'))}</div><div>${esc(t('notfound.text'))}</div><p style="margin-top:12px"><a href="#/">${esc(t('notfound.link'))}</a></p></div>`;

  /* ---- handbook -------------------------------------------------------------------------- */
  views.manual = function (state) {
    const m = data.manual, model = data.model;
    const aside = `<aside class="ob-tree-panel is-sticky" aria-label="${esc(t('manual.title'))}"><h3 class="ob-tree-title">${esc(t('manual.title'))}</h3><ul class="ob-tree" role="tree" aria-label="${esc(t('manual.chapters'))}">${m.chapters.map((c, i) => `<li role="none"><a class="ob-tree-item" role="treeitem" href="${router.build('/manual', { ch: c.id })}" aria-selected="${state.chapter === c.id}" data-action="chapter" data-chapter="${esc(c.id)}"><span class="ob-tree-number">${i + 1}</span><span class="ob-tree-label">${esc(c.title)}</span></a></li>`).join('')}</ul></aside>`;
    const sec = (n, inner) => { const c = m.chapters[n - 1]; return `<section id="hb-${esc(c.id)}" class="ob-chapter" data-chapter="${esc(c.id)}"><h2>${n} ${esc(c.title)}</h2>${inner}</section>`; };
    const li = arr => arr.join('');

    const e = m.einleitung;
    const s1 = sec(1, `<div><p>${esc(e.intro)}</p><ul class="ob-list">${li(e.questions.map(q => `<li>${esc(q)}</li>`))}</ul></div>${li(e.sections.map(s => `<div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`))}`);

    const g = m.gouvernanz;
    const roles = ui.table([{ label: t('manual.col.inCatalog'), width: '26%' }, { label: t('manual.col.nadb'), width: '28%' }, { label: t('manual.col.task') }],
      li(g.roles.map(r => ui.tr([{ html: esc(r.label), cls: 'ob-cell-strong' }, `${esc(r.nadb)}<div class="ob-cell-sub">${esc(r.en)}</div>`, esc(r.task)]))));
    const s2 = sec(2, `<div><p>${esc(g.intro)}</p>${roles}</div><div><h3>${esc(g.workflowTitle)}</h3><p>${esc(g.workflowIntro)}</p><ol class="ob-list">${li(g.workflow.map(w => `<li><strong>${esc(w.title)}</strong> (${esc(w.who)}): ${esc(w.text)}</li>`))}</ol></div><div><h3>${esc(g.reportTitle)}</h3><p>${esc(g.reportText)}</p></div>`);

    const mo = m.modell;
    const ext = Object.keys(model.kinds).map(k => ({ type: model.kinds[k].singular, en: model.kinds[k].en, fields: (model.extensions[k] || []).map(([f, l]) => `${f} (${l})`).join(', ') }));
    const core = ui.table([{ label: t('manual.col.field') }, { label: t('manual.col.inCatalog') }, { label: t('manual.col.dcat') }, { label: t('manual.col.archimate') }, { label: t('manual.col.dmbok') }],
      li(model.core.map(c => ui.tr([{ html: esc(c.field), cls: 'ob-cell-nowrap' }, esc(c.label), esc(c.dcat), esc(c.archimate), esc(c.dmbok)]))));
    const s3 = sec(3, `<div><p>${esc(mo.intro)}</p><ul class="ob-list">${li(mo.layers.map(l => `<li><strong>${esc(l.title)}</strong> (${esc(l.layer)}): ${esc(l.text)} ${esc(t('manual.example'))}: ${esc(l.example)}.</li>`))}</ul></div>
      <div><h3>${esc(mo.coreTitle)}</h3><p>${esc(mo.coreIntro)}</p>${core}</div>
      <div><h3>${esc(mo.extTitle)}</h3><ul class="ob-list">${li(ext.map(x => `<li><strong>${esc(x.type)}</strong> (${esc(x.en)}): ${esc(x.fields)}</li>`))}</ul></div>
      <div><h3>${esc(mo.statusTitle)}</h3><ul class="ob-list">${li(Object.entries(model.statuses).map(([k, v]) => `<li><strong>${esc(k)}</strong>: ${esc(v.text)}</li>`))}</ul></div>`);

    const s4 = sec(4, `<ol class="ob-list">${li(m.nutzen.steps.map(s => `<li><strong>${esc(s.title)}</strong>: ${esc(s.text)}</li>`))}</ol>`);
    const s5 = sec(5, `<ul class="ob-list"><li><strong>Export</strong>: ${esc(m.abrufen.export)}</li><li><strong>API</strong>: ${esc(m.abrufen.api)} <a href="#/api">${esc(t('manual.toApi'))}</a></li></ul>`);
    const s6 = sec(6, `<ul class="ob-list ob-list--loose">${li(m.faq.map(f => `<li><strong>${esc(f.q)}</strong><br>${esc(f.a)}</li>`))}</ul>`);
    const s7 = sec(7, `<ul class="ob-list">${li(m.glossar.map(x => `<li><strong>${esc(x.term)}</strong>: ${esc(x.text)}</li>`))}</ul>`);
    const s8 = sec(8, `<ul class="ob-list">${li(m.grundlagen.map(r => `<li><strong>${esc(r.title)}</strong> (${esc(r.source)}): <a href="${esc(r.url)}" target="_blank" rel="noopener" style="overflow-wrap:anywhere">${esc(r.url)}</a></li>`))}</ul>`);
    return `<div class="ob-manual">${aside}<div class="ob-manual-content">${s1}${s2}${s3}${s4}${s5}${s6}${s7}${s8}</div></div>`;
  };

  /* ---- API page --------------------------------------------------------------------------- */
  views.apiPage = function () {
    const a = data.apiDocs;
    const groups = a.groups.map(g => `
      <div>
        <div class="ob-api-group-head"><h2>${esc(g.tag)}</h2><span class="ob-api-group-desc">${esc(g.description)}</span></div>
        <ul class="ob-endpoints">${g.endpoints.map(ep => `<li class="ob-endpoint"><span class="ob-endpoint-method">${esc(ep.method)}</span><div style="min-width:0"><div class="ob-endpoint-path">${esc(ep.path)}</div><div class="ob-endpoint-summary">${esc(ep.summary)}</div></div><span class="ob-endpoint-params">${esc(t('api.params'))}: <span class="ob-code">${esc(ep.params)}</span></span></li>`).join('')}</ul>
      </div>`).join('');
    return `<div class="ob-api">
      <div class="ob-api-info">${ui.chip('OAS ' + a.openapi, 'info')}<span><strong>${esc(t('api.servers'))}:</strong> <span class="ob-code">${esc(a.servers.join(', '))}</span></span><span><strong>${esc(t('api.authorize'))}:</strong> ${esc(a.auth)}</span><a class="ob-inline-link" href="${esc(a.specUrl)}" target="_blank" rel="noopener">${esc(t('api.spec'))} ${icon('download', 'sm')}</a></div>
      <div class="ob-api-groups">${groups}</div>
    </div>`;
  };

  /* ---- page composition ----------------------------------------------------------------- */
  views.page = function (route, state) {
    const ctx = views.context(route, state);
    let body;
    if (route.view === 'manual') body = views.manual(state);
    else if (route.view === 'api') body = views.apiPage();
    else {
      let content;
      if (route.view === 'home') content = views.home();
      else if (route.view === 'list') content = views.list(ctx);
      else if (route.view === 'search') content = views.searchResults(state.query);
      else if (route.view === 'detail') content = DK.detail.render(route.entity, route, state);
      else content = views.notFound();
      body = views.toolbar(ctx) + `<div class="ob-catalog">${views.tree(route, state)}<section class="ob-content">${content}</section></div>`;
    }
    return { html: views.breadcrumb(ctx.crumbs) + views.pageHeader(ctx.title) + body, ctx };
  };

  DK.views = views;
})(window.DK);
