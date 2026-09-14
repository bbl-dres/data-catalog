/* Entity profiles: metadata, rows, relationships and history. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router;
  const t = ui.t, esc = ui.esc, icon = ui.icon, fmt = ui.fmtDate;
  const detail = {};

  detail.rowsLabel = e => e.kind === 'apis' ? t('col.fields') : data.kindDef(e.kind).rows;

  detail.tabs = function (e) {
    if (e.kind === 'domains') return [['overview', t('detail.tab.overview')], ['tiles', t('toolbar.tiles')], ['table', t('toolbar.table')]];
    const historyLabel = e.kind === 'attrs' ? t('detail.tab.objectHistory') : e.kind === 'fields' ? t('detail.tab.tableHistory') : t('detail.tab.history');
    return [['overview', t('detail.tab.overview')], ['rows', detail.rowsLabel(e)], ['relations', t('detail.tab.relations')], ['history', historyLabel]].filter(x => x[1]);
  };

  /** Resolve supported tabs; legacy domain rows links map to table browsing. */
  detail.resolveTab = function (e, requested) {
    const tab = e.kind === 'domains' ? (requested === 'rows' ? 'table' : requested || 'tiles') : requested || 'overview';
    return detail.tabs(e).some(x => x[0] === tab) ? tab : 'overview';
  };

  detail.render = function (e, route, state, ctx) {
    if (e.kind === 'domains') return DK.views.collection(ctx || DK.views.context({ ...route, view: 'detail', kind: 'domains', entity: e }, state));
    const tabs = detail.tabs(e);
    const tab = detail.resolveTab(e, route.params.tab);
    const rowList = tab === 'rows' ? ctx?.rowList || detail.rowsContext(e, route, state) : null;
    const historyList = tab === 'history' ? ctx?.historyList || detail.historyContext(e, route, state) : null;
    const searchList = rowList || historyList;
    const historyState = historyList || data.historyState(e.kind, e.identifier);
    const counts = { rows: rowList?.total ?? data.sizeOf(e.kind, e), relations: data.relations(e.kind, e).reduce((n, g) => n + g.items.length, 0), history: historyState.loading ? '…' : historyList?.total ?? historyState.items.length };
    const tabsHtml = `<div class="ob-detail-controls"><div class="ob-tabs-frame ob-detail-tabs-frame"><div class="ob-tabs"><div class="ob-tab-list" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" class="ob-tab" aria-selected="${tab === id}" aria-controls="panel-${id}" tabindex="${tab === id ? '0' : '-1'}" data-action="set-tab" data-tab="${id}">${esc(label)}${id === 'overview' ? '' : ` (${counts[id]})`}</button>`).join('')}</div>${tab === 'relations' ? `<button type="button" class="ob-button ob-relations-toggle" data-action="toggle-relation-view" aria-controls="panel-relations">${icon(state.relationDiagram ? 'list' : 'branch', 'sm')}${esc(t(state.relationDiagram ? 'detail.relations.showList' : 'detail.relations.showDiagram'))}</button>` : ''}</div></div>${searchList ? `<div class="ob-local-actions">${ui.collectionSearch(searchList.filter, `panel-${tab}`)}<div class="ob-local-menus">${DK.fieldPicker.button(searchList.kind)}</div></div>` : ''}</div>`;
    let panel;
    if (tab === 'overview') panel = detail.overview(e, state);
    else if (tab === 'rows') panel = detail.rows(e, route, state, rowList);
    else if (tab === 'relations') panel = detail.relations(e, state);
    else panel = detail.history(e, state, historyList);
    return tabsHtml + (searchList && !searchList.loading ? ui.collectionStatus(searchList) : '') + ui.tabPanel(`panel-${tab}`, `tab-${tab}`, panel);
  };

  /* Overview */
  detail.facts = function (e) {
    const plain = (label, value) => ({ label, value, type: 'plain' });
    const internal = (label, value, kind, id) => ({ label, value, type: 'internal', href: router.entityHref(kind, id) });
    const ext = (label, value, href) => ({ label, value, type: 'link', href });
    const dom = data.domainForEntity(e.kind, e);
    const hasInformationLinks = Boolean(e._record) || ['objects', 'tables', 'refs'].includes(e.kind);
    const informationUrls = hasInformationLinks && Array.isArray(e.informationUrls)
      ? [...new Set(e.informationUrls.filter(url => typeof url === 'string' && /^https?:\/\//i.test(url) && ui.safeHref(url)))] : [];
    const primary = [plain(t('fact.type'), data.kindDef(e.kind).singular), { label: t('fact.status'), value: e.status, type: 'chip', tone: data.statusTone(e.status) }];
    if (e.kind !== 'domains') primary.push(dom ? internal(t('fact.domain'), dom.name, 'domains', dom.identifier) : plain(t('fact.domain')));
    if (['objects', 'attrs'].includes(e.kind)) {
      const system = data.systemOfRecordOf(e);
      const note = [e.systemOfRecordInheritedFrom && t('systemOfRecord.inherited'),
        system?._record?.is_archived && t('systemOfRecord.archived')].filter(Boolean).join('; ');
      const name = system ? [system.name, note && `(${note})`].filter(Boolean).join(' ') : null;
      primary.push(system && !system._record?.is_archived
        ? internal(t('fact.systemOfRecord'), name, 'systems', system.identifier)
        : plain(t('fact.systemOfRecord'), name));
    }
    if (['attrs','fields'].includes(e.kind)) primary.push(plain(t('fact.propertyGroup'), e.propertyGroup));
    switch (e.kind) {
      case 'systems':
        primary.push(plain(t('fact.technology'), e.technology));
        if (!e._record) primary.push(ext(t('fact.moreInformation'), e.informationUrl ? t('fact.openInformation') : null, e.informationUrl));
        break;
      case 'objects':
        primary.push(plain(t('fact.normReference'), e.normReference));
        break;
      case 'attrs': {
        const o = data.objOf(e.object);
        const ref = data.get('refs', e.codeList);
        const key = e.keyRole === 'PK' ? t('fact.key.pk') : e.keyRole === 'FK' ? t('fact.key.fk') : null;
        primary.push(internal(t('fact.object'), o.name, 'objects', o.identifier));
        primary.push(plain(t('fact.valueType'), e.valueType), plain(t('fact.businessKey'), key), plain(t('fact.requiredRule'), typeof e.mandatory === 'boolean' ? t(e.mandatory ? 'yes' : 'no') : null),
          ref ? internal(t('col.codeList'), ref.name, 'refs', ref.identifier) : plain(t('col.codeList')),
          plain(t('fact.normReference'), e.normReference));
        break;
      }
      case 'tables':
        primary.push(internal(t('fact.system'), data.nameOf('systems', e.system), 'systems', e.system), plain(t('fact.technicalName'), e.technicalName));
        primary.push(e.realizes ? internal(t('fact.realizes'), data.nameOf('objects', e.realizes), 'objects', e.realizes) : plain(t('fact.realizes')));
        break;
      case 'fields': {
        const table = data.get('tables', e.table);
        primary.push({ ...internal(t('fact.table'), data.displayName('tables', table), 'tables', table.identifier), href: router.entityHref('tables', table.identifier, { tab: 'rows' }) });
        if (data.sysOf(e.system)) primary.push(internal(t('fact.system'), data.nameOf('systems', e.system), 'systems', e.system));
        const key = e.keyRole === 'PK' ? t('fact.key.pk') : e.keyRole === 'FK' ? t('fact.key.fk') : t(e.provenance || (e._record && e.keyRoles == null) ? 'fact.undocumented' : 'fact.key.none');
        primary.push(plain(t('fact.technicalName'), e.technicalName), plain(t('col.name'), e.label), plain(t('col.dataType'), e.dataType), plain(t('fact.key'), key));
        primary.push(plain(t('fact.mandatory'), typeof e.mandatory === 'boolean' ? t(e.mandatory ? 'yes' : 'no') : null));
        const ref = data.get('refs', e.codeList);
        primary.push(ref ? internal(t('col.codeList'), ref.name, 'refs', ref.identifier) : plain(t('col.codeList')));
        break;
      }
      case 'products':
        primary.push(plain(t('fact.access'), e.accessRights), plain(t('fact.license'), e.license), plain(t('fact.format'), e.format), plain(t('fact.refresh'), e.accrualPeriodicity), ext(t('fact.obtain'), t('fact.obtainProduct')));
        break;
      case 'apis':
        primary.push(plain(t('visibility.serviceVersion'), data.serviceVersionOf(e)));
        primary.push(internal(t('fact.system'), data.nameOf('systems', e.system), 'systems', e.system), plain(t('fact.protocol'), e.protocol), plain(t('fact.access'), e.accessRights),
          plain(t('fact.baseUrl'), e.endpointURL), ext(t('fact.documentation'), e.documentation ? t('fact.openDocs') : null, e.documentation));
        break;
      case 'refs':
        primary.push(plain(t('fact.normReference'), e.normReference));
        primary.push(e.businessObject ? internal(t('fact.object'), data.nameOf('objects', e.businessObject), 'objects', e.businessObject) : plain(t('fact.object')));
        break;
    }
    if (hasInformationLinks) primary.push({ label: t('fact.moreInformation'), value: informationUrls, type: 'links', labels: informationUrls.map(url => {
      const title = e.documentationLinks?.find(link => link.url === url);
      if (title) return ui.localized(Object.fromEntries(['de', 'it', 'fr', 'en'].map(lang => [lang, title[`title_${lang}`]]))) || url;
      if (url === e.descriptionSource?.url) return `${t('fact.definitionSource')}: ${e.descriptionSource.title}`;
      if (url === e.sourceUrl && e.source) return [e.source, e.dataSource || e.apiStructure].filter(Boolean).join(' · ');
      if (url === e.technicalNameSource && e.technicalName) return `${t('fact.technicalName')}: ${e.technicalName}`;
      return url;
    }) });
    if (!['tables', 'refs'].includes(e.kind) && e.sourceUrl && !informationUrls.includes(e.sourceUrl)) primary.push(ext(t('fact.sourceDocument'), t('fact.openSourceDocument'), e.sourceUrl));
    if (!['fields', 'tables', 'refs'].includes(e.kind) && (e.provenance || e.sourceUrl)) primary.push(plain(t('fact.sourceDetail'), e.sourceDetail));
    if (!['tables', 'refs'].includes(e.kind) && e.descriptionSource) {
      const label = `${e.descriptionSource.title} · ${t(e.descriptionSource.kind === 'source-excerpt' ? 'fact.sourceExcerpt' : 'fact.sourceSummary')}`;
      primary.push(informationUrls.includes(e.descriptionSource.url)
        ? plain(t('fact.definitionSource'), label) : ext(t('fact.definitionSource'), label, e.descriptionSource.url));
    }
    const protection = [plain(t('fact.classification'), e.classification), plain(t('fact.personalData'), typeof e.personalData === 'boolean' ? (e.personalData ? t('yes') : t('no')) : null)];
    const metadata = [plain(t('fact.identifier'), e.identifier), plain(t('fact.version'), e.kind === 'apis' ? e._record?.version : e.version), plain(t('fact.created'), fmt(e.created)), plain(t('fact.modified'), fmt(e.modified)), plain(t('fact.synced'), fmt(e.synced))];
    metadata.push({ label: t('fact.comment'), value: e.comment, type: 'comment' });
    return { primary, protection, metadata };
  };

  /** Each overview section is independent and starts expanded. */
  function section(className, heading, rows, state) {
    const expanded = state.detailSections?.[className] ?? true;
    const id = `${className}-content`;
    return `<section class="${className}"><h2><button type="button" id="${className}-toggle" class="ob-detail-section-toggle" data-action="toggle-detail-section" data-section="${className}" aria-expanded="${expanded}" aria-controls="${id}">${esc(t(heading))}${icon('chevron_down', 'sm')}</button></h2><dl id="${id}" class="ob-facts"${expanded ? '' : ' hidden'}>${rows}</dl></section>`;
  }

  detail.overview = function (e, state = {}) {
    const renderFacts = facts => facts.map(f => {
      let v;
      const empty = f.value == null || (typeof f.value === 'string' && !f.value.trim()) || (Array.isArray(f.value) && !f.value.length);
      if (empty) v = '<span>—</span>';
      else if (f.type === 'chip') v = ui.chip(f.value, f.tone);
      else if (f.type === 'comment') v = `<span class="ob-comment">${esc(f.value)}</span>`;
      else if (f.type === 'links') v = `<ul class="ob-fact-links">${f.value.map((url, i) => `<li>${ui.link(url, `${esc(f.labels[i])}&nbsp;${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true, title: url })}</li>`).join('')}</ul>`;
      else if (f.type === 'internal') v = `<a class="ob-fact-link" href="${esc(f.href)}">${esc(f.value)}</a>`;
      else if (f.type === 'link') v = f.href
        ? ui.link(f.href, `${esc(f.value)}&nbsp;${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true })
        : `<a class="ob-inline-link" href="#" data-action="not-available" data-what="${esc(f.value)}">${esc(f.value)}&nbsp;${icon('link_external', 'sm')}</a>`;
      else v = `<span>${esc(f.value)}</span>`;
      return `<dt>${esc(f.label)}</dt><dd>${v}</dd>`;
    }).join('');
    const facts = detail.facts(e);
    return `
      <div class="ob-detail-sections">
        ${detail.responsibility(e, state)}
        <div class="ob-detail-facts">
          ${section('ob-core-facts', 'detail.facts', renderFacts(facts.primary), state)}
          ${section('ob-protection-facts', 'detail.protection', renderFacts(facts.protection), state)}
        </div>
      </div>${DK.accessOptions?.render(e, state) || ''}
      ${section('ob-system-facts', 'detail.system', renderFacts(facts.metadata), state)}`;
  };

  /** Keep responsibility rows stable when a contact or role is not documented. */
  detail.responsibility = function (e, state = {}) {
    const row = (label, html) => `<dt>${esc(t(label))}</dt><dd>${html || '<span>—</span>'}</dd>`;
    const website = (name, url, title) => {
      const href = ui.safeHref(url);
      return href ? ui.link(href, `${esc(name)}&nbsp;${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true, title }) : esc(name);
    };
    // Existing owner/steward strings denote people; custodian strings denote organisational units.
    // Explicit { type, name, url? } values allow either actor type in every role.
    const actor = (value, defaultType) => {
      if (!value) return '';
      const a = typeof value === 'string' ? { name: value, type: defaultType } : value;
      if (!a.name) return '';
      const directory = a.type === 'person' && !a.url;
      return website(a.name, a.url || (directory ? data.config.admindirUrl : null), directory ? t('detail.openAdmindir', { name: a.name }) : null);
    };
    const contact = e.contact || {};
    const rows = row(e.kind === 'refs' ? 'fact.authorityOrganisation' : 'detail.organisation', e.responsibleOrg ? website(e.responsibleOrg, contact.url) : '')
      + row('detail.owner', actor(e.dataOwner, 'person'))
      + row('detail.steward', actor(e.dataSteward, 'person'))
      + (data.supportsCustodian(e.kind) ? row('detail.dataCustodian', actor(data.custodianOf(e.kind, e), 'organisation')) : '');
    return rows ? section('ob-responsibility', 'detail.contacts', rows, state) : '';
  };

  /* Detail rows */
  /** Search and exports use the complete values; only the visible page needs HTML cells. */
  detail.rowsData = function (e) {
    const kind = DK.presentation.childOf[e.kind];
    if (!kind) return { columns: [], rows: [] };
    const fields = DK.presentation.definitions(kind);
    const items = e.kind === 'systems' ? data.tablesOfSystem(e) : ['tables', 'apis'].includes(e.kind) ? e.fields : e.kind === 'refs' ? e.values : e.attributes || [];
    const rows = items.map((item, position) => {
      const href = e.kind === 'objects' ? router.entityHref('attrs', data.attributeEntity(e, item).identifier)
        : e.kind === 'tables' ? router.entityHref('fields', data.childId(e.identifier, data.fieldId(item)))
        : e.kind === 'systems' ? router.entityHref('tables', item.identifier) : null;
      const entity = kind === 'fields' ? (e.kind === 'apis' ? data.apiFieldEntity(e, item, position) : data.fieldEntity(e, item, position))
        : kind === 'attrs' ? data.attributeEntity(e, item) : item;
      const values = DK.presentation.values(kind, entity);
      return { entity, href, values,
        text: fields.map(f => DK.presentation.format(f, values[f.id])), search: [item.identifier, item.technicalName] };
    });
    return { kind, fields, columns: fields.map(DK.presentation.column), rows };
  };

  /** Filter the complete row set before sorting and pagination. */
  detail.rowsContext = function (e, route, state) {
    const rd = detail.rowsData(e);
    const filter = (route.params.filter || '').trim();
    const key = `detail:${e.kind}:rows`;
    const options = state.tableSorts[key] || ['attrs', 'fields', 'tables'].includes(rd.kind) ? DK.presentation.sortOptions(state, key, rd.kind) : { key, sort: null };
    const matches = rd.rows.filter(row => data.matchesValues([...row.text, ...(row.search || [])], filter));
    const ordered = options.sort ? DK.presentation.sort(rd.kind, matches, options.sort, row => row.entity) : matches;
    const fields = DK.presentation.fields(rd.kind);
    const paging = ui.pageState(ordered.length, route.params);
    // Rows that list catalog entities (a system's tables) clamp long text like the collection tables do; other cells stay plain strings.
    const cell = (f, row) => { const html = DK.presentation.cell(f, row.values[f.id], row.entity); return f.type === 'long' && data.contentKinds().includes(rd.kind) ? { html, cls: 'ob-cell-summary' } : html; };
    return { filter, total: rd.rows.length, matched: matches.length, kind: rd.kind, columns: fields.map(DK.presentation.column), options, paging,
      rows: ordered.slice(paging.from - 1, paging.to).map(row => ({ href: row.href, cells: fields.map(f => f.primary && row.href
        ? ui.entityLink(row.href, DK.presentation.format(f, row.values[f.id])) : cell(f, row)) })) };
  };

  detail.rows = function (e, route, state, list = detail.rowsContext(e, route, state)) {
    if (!list.total) return ui.empty(t(e.kind === 'apis' ? 'apiFields.empty' : 'detail.noRows', { what: detail.rowsLabel(e) }));
    if (!list.matched) return ui.collectionEmpty(list.filter);
    const { columns, options, paging } = list;
    const rows = list.rows.map(r => ui.tr(r.cells, r.href, columns)).join('');
    const definitions = [...new Set((e.attributes || []).map(a => a.definitionObject).filter(Boolean))];
    const shared = definitions.length ? '<p>' + esc(t('detail.sharedAttributes')) + ' ' + definitions.map(id => {
      const object = data.get('objects', id);
      return ui.link(router.entityHref('objects', id, { tab: 'rows' }), object?.name || id);
    }).join(', ') + '.</p>' : '';
    return shared + pagedTable(columns, rows, options, paging);
  };

  function pagedTable(columns, rows, options, paging) {
    return `<div class="ob-detail-rows">${ui.pager(paging, { position: 'top' })}${ui.table(columns, rows, options)}${ui.pager(paging)}</div>`;
  }

  /* Relationships */
  detail.relationList = function (e, state) {
    const groups = data.relations(e.kind, e).filter(r => r.items.length);
    if (!groups.length) return ui.empty(t('detail.noRelations'));
    const columns = [
      { label: t('graph.entry'), primary: true, width: '40%' },
      { label: t('graph.relationship'), width: '28%' },
      { label: t('graph.context') },
    ];
    const options = ui.tableOptions(state, `detail:${e.kind}:relations`);
    const rows = groups.flatMap(group => group.items.map(item => ({ group, item })));
    const ordered = ui.sortRows(rows, options.sort, r => [r.item.name, r.group.title, r.item.sub || '']);
    return ui.table(columns, ordered.map(({ group, item }) => ui.tr([
      ui.link(item.href, `${icon(group.icon, 'sm')} ${esc(item.name)}${item.external ? ' ' + icon('link_external', 'sm') : ''}`, { className: 'ob-table-entity-link', external: item.external }),
      esc(group.title), esc(item.sub || '–'),
    ], null, columns)).join(''), options);
  };

  detail.relations = function (e, state) {
    return `<div class="ob-relations-view${state.relationDiagram ? ' is-diagram' : ''}">
      <div class="ob-relations-list">${detail.relationList(e, state)}</div>
      <div class="ob-relations-diagram">${DK.graph.render(e, state.graph)}</div>
    </div>`;
  };

  /* History */
  detail.historyContext = function (e, route, state) {
    const params = route?.params || {};
    const fields = route ? DK.presentation.fields('history') : DK.presentation.definitions('history');
    const columns = fields.map(f => ({ id: f.id, label: t(f.label), compact: f.id === 'date', width: { action: '22%', user: '12rem' }[f.id] }));
    const options = DK.presentation.sortOptions(state, `detail:${e.kind}:history`, 'history');
    const filter = (params.historyFilter || '').trim();
    const history = data.historyState(e.kind, e.identifier), all = history.items;
    const matches = all.filter(h => data.matchesValues([h.date, fmt(h.date), h.action, h.detail, h.user], filter));
    const items = DK.presentation.sort('history', matches, options.sort);
    return { kind: 'history', filter, total: all.length, matched: items.length, fields, columns, options, items, paging: ui.pageState(items.length, params), loading: history.loading, error: history.error };
  };

  detail.history = function (e, state, list) {
    // The editor's read-only history keeps its existing full list; public profiles supply paging context.
    const context = list || detail.historyContext(e, null, state);
    const { fields, columns, options, items, paging } = context;
    const visible = list ? items.slice(paging.from - 1, paging.to) : items;
    const rows = visible.map(h => ui.tr(fields.map(f => ({ html: esc(f.id === 'date' ? fmt(h.date) : h[f.id]),
      cls: f.id === 'date' ? 'ob-cell-nowrap' : f.id === 'detail' ? 'ob-cell-muted' : '' })), null, columns)).join('');
    const noteKey = e.kind === 'attrs' ? 'detail.historyInherited' : e.kind === 'fields' ? 'detail.fieldHistoryInherited' : null;
    const note = noteKey ? `<p class="ob-context-note">${esc(t(noteKey))}</p>` : '';
    if (context.loading) return note + ui.loading(t('history.loading'));
    if (context.error) return note + ui.empty(t('history.unavailable'));
    if (!list) return note + ui.table(columns, rows, options);
    return note + (list.matched ? pagedTable(columns, rows, options, paging) : ui.collectionEmpty(list.filter));
  };

  DK.detail = detail;
})(window.DK);
