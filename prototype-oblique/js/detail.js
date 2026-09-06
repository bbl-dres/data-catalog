/* Entity profiles: metadata, rows, relationships and history. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router;
  const t = ui.t, esc = ui.esc, icon = ui.icon, fmt = ui.fmtDate;
  const detail = {};

  detail.rowsLabel = e => data.kindDef(e.kind).rows;

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
    const counts = { rows: detail.rowsData(e).rows.length, relations: data.relations(e.kind, e).reduce((n, g) => n + g.items.length, 0), history: data.history(e.kind, e.identifier).length };
    const rowList = tab === 'rows' ? ctx?.rowList || detail.rowsContext(e, route, state) : null;
    const tabsHtml = `<div class="ob-detail-controls"><div class="ob-tabs-frame ob-detail-tabs-frame"><div class="ob-tabs"><div class="ob-tab-list" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" class="ob-tab" aria-selected="${tab === id}" aria-controls="panel-${id}" tabindex="${tab === id ? '0' : '-1'}" data-action="set-tab" data-tab="${id}">${esc(label)}${id === 'overview' ? '' : ` (${counts[id]})`}</button>`).join('')}</div>${tab === 'relations' ? `<button type="button" class="ob-button ob-relations-toggle" data-action="toggle-relation-view" aria-controls="panel-relations">${icon(state.relationDiagram ? 'list' : 'branch', 'sm')}${esc(t(state.relationDiagram ? 'detail.relations.showList' : 'detail.relations.showDiagram'))}</button>` : ''}</div></div>${rowList ? `<div class="ob-local-actions">${ui.collectionSearch(rowList.filter, 'panel-rows')}</div>` : ''}</div>`;
    let panel;
    if (tab === 'overview') panel = detail.overview(e, state);
    else if (tab === 'rows') panel = detail.rows(e, route, state, rowList);
    else if (tab === 'relations') panel = detail.relations(e, state);
    else panel = detail.history(e, state);
    return tabsHtml + (rowList ? ui.collectionStatus(rowList) : '') + `<div id="panel-${tab}" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0">${panel}</div>`;
  };

  /* Overview */
  detail.facts = function (e) {
    const plain = (label, value) => ({ label, value, type: 'plain' });
    const internal = (label, value, kind, id) => ({ label, value, type: 'internal', href: router.entityHref(kind, id) });
    const ext = (label, value, href) => ({ label, value, type: 'link', href });
    const dom = data.domainForEntity(e.kind, e);
    const informationUrls = e.kind === 'tables' && Array.isArray(e.informationUrls)
      ? [...new Set(e.informationUrls.filter(url => typeof url === 'string' && /^https?:\/\//i.test(url) && ui.safeHref(url)))] : [];
    const primary = [plain(t('fact.type'), data.kindDef(e.kind).singular), { label: t('fact.status'), value: e.status, type: 'chip', tone: data.statusTone(e.status) }];
    if (e.kind !== 'domains') primary.push(dom ? internal(t('fact.domain'), dom.name, 'domains', dom.identifier) : plain(t('fact.domain')));
    switch (e.kind) {
      case 'systems':
        primary.push(plain(t('fact.technology'), e.technology));
        primary.push(ext(t('fact.moreInformation'), e.informationUrl ? t('fact.openInformation') : null, e.informationUrl));
        break;
      case 'objects':
        primary.push(plain(t('fact.normReference'), e.normReference));
        break;
      case 'attrs': {
        const o = data.objOf(e.object);
        const key = e.keyRole === 'PK' ? t('fact.key.pk') : e.keyRole === 'FK' ? t('fact.key.fk') : t('fact.key.none');
        primary.push(internal(t('fact.object'), o.name, 'objects', o.identifier));
        primary.push(plain(t('fact.valueType'), e.valueType), plain(t('fact.key'), key), plain(t('fact.mandatory'), e.mandatory ? t('yes') : t('no')),
          plain(t('fact.normReference'), e.normReference));
        break;
      }
      case 'tables':
        primary.push(internal(t('fact.system'), data.nameOf('systems', e.system), 'systems', e.system), plain(t('fact.technicalName'), e.technicalName));
        primary.push(e.realizes ? internal(t('fact.realizes'), data.nameOf('objects', e.realizes), 'objects', e.realizes) : plain(t('fact.realizes')));
        primary.push({ label: t('fact.moreInformation'), value: informationUrls, type: 'links', labels: informationUrls.map(url => {
          if (url === e.descriptionSource?.url) return `${t('fact.definitionSource')}: ${e.descriptionSource.title}`;
          if (url === e.sourceUrl && e.source) return [e.source, e.dataSource || e.apiStructure].filter(Boolean).join(' · ');
          if (url === e.technicalNameSource && e.technicalName) return `${t('fact.technicalName')}: ${e.technicalName}`;
          return url;
        }) });
        break;
      case 'fields': {
        const table = data.get('tables', e.table);
        primary.push({ ...internal(t('fact.table'), data.displayName('tables', table), 'tables', table.identifier), href: router.entityHref('tables', table.identifier, { tab: 'rows' }) });
        if (data.sysOf(e.system)) primary.push(internal(t('fact.system'), data.nameOf('systems', e.system), 'systems', e.system));
        const key = e.keyRole === 'PK' ? t('fact.key.pk') : e.keyRole === 'FK' ? t('fact.key.fk') : t(e.provenance ? 'fact.undocumented' : 'fact.key.none');
        primary.push(plain(t('fact.technicalName'), e.technicalName), plain(t('col.label'), e.label), plain(t('col.dataType'), e.dataType), plain(t('fact.key'), key));
        primary.push(plain(t('fact.mandatory'), typeof e.mandatory === 'boolean' ? t(e.mandatory ? 'yes' : 'no') : null));
        const ref = data.get('refs', e.codeList);
        primary.push(ref ? internal(t('col.codeList'), ref.name, 'refs', ref.identifier) : plain(t('col.codeList')));
        break;
      }
      case 'products':
        primary.push(plain(t('fact.access'), e.accessRights), plain(t('fact.license'), e.license), plain(t('fact.format'), e.format), plain(t('fact.refresh'), e.accrualPeriodicity), ext(t('fact.obtain'), t('fact.obtainProduct')));
        break;
      case 'apis':
        primary.push(internal(t('fact.system'), data.nameOf('systems', e.system), 'systems', e.system), plain(t('fact.protocol'), e.protocol), plain(t('fact.access'), e.accessRights),
          plain(t('fact.baseUrl'), e.endpointURL), ext(t('fact.documentation'), e.documentation ? t('fact.openDocs') : null, e.documentation));
        break;
      case 'refs':
        primary.push(plain(t('fact.codeSource'), e.sourceAuthority));
        primary.push(e.businessObject ? internal(t('fact.object'), data.nameOf('objects', e.businessObject), 'objects', e.businessObject) : plain(t('fact.object')));
        break;
    }
    if (e.sourceUrl && !informationUrls.includes(e.sourceUrl)) primary.push(ext(t('fact.sourceDocument'), t('fact.openSourceDocument'), e.sourceUrl));
    if (!['fields', 'tables'].includes(e.kind) && (e.provenance || e.sourceUrl)) primary.push(plain(t('fact.sourceDetail'), e.sourceDetail));
    if (e.kind !== 'tables' && e.descriptionSource) {
      const label = `${e.descriptionSource.title} · ${t(e.descriptionSource.kind === 'source-excerpt' ? 'fact.sourceExcerpt' : 'fact.sourceSummary')}`;
      primary.push(informationUrls.includes(e.descriptionSource.url)
        ? plain(t('fact.definitionSource'), label) : ext(t('fact.definitionSource'), label, e.descriptionSource.url));
    }
    primary.push(plain(t('fact.classification'), e.classification), plain(t('fact.personalData'), typeof e.personalData === 'boolean' ? (e.personalData ? t('yes') : t('no')) : null));
    primary.push({ label: t('fact.comment'), value: e.comment, type: 'comment' });
    const metadata = [plain(t('fact.identifier'), e.identifier), plain(t('fact.version'), e.version), plain(t('fact.created'), fmt(e.created)), plain(t('fact.modified'), fmt(e.modified)), plain(t('fact.source'), e.source), plain(t('fact.synced'), fmt(e.synced))];
    return { primary, metadata };
  };

  detail.overview = function (e, state = {}) {
    const renderFacts = facts => facts.map(f => {
      let v;
      const empty = f.value == null || (typeof f.value === 'string' && !f.value.trim()) || (Array.isArray(f.value) && !f.value.length);
      if (empty) v = '<span>—</span>';
      else if (f.type === 'chip') v = ui.chip(f.value, f.tone);
      else if (f.type === 'comment') v = `<span class="ob-comment">${esc(f.value)}</span>`;
      else if (f.type === 'links') v = `<ul class="ob-fact-links">${f.value.map((url, i) => `<li>${ui.link(url, `${esc(f.labels[i])} ${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true, title: url })}</li>`).join('')}</ul>`;
      else if (f.type === 'internal') v = `<a class="ob-fact-link" href="${esc(f.href)}">${esc(f.value)}</a>`;
      else if (f.type === 'link') v = f.href
        ? ui.link(f.href, `${esc(f.value)} ${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true })
        : `<a class="ob-inline-link" href="#" data-action="not-available" data-what="${esc(f.value)}">${esc(f.value)} ${icon('link_external', 'sm')}</a>`;
      else v = `<span>${esc(f.value)}</span>`;
      return `<dt>${esc(f.label)}</dt><dd>${v}</dd>`;
    }).join('');
    const facts = detail.facts(e);
    return `
      <div class="ob-detail-sections">
        <section class="ob-core-facts">
          <h2>${esc(t('detail.facts'))}</h2>
          <dl class="ob-facts">${renderFacts(facts.primary)}</dl>
          <details class="ob-metadata"${state.metadataOpen ? ' open' : ''}>
            <summary>${esc(t('detail.metadata'))}</summary>
            <dl class="ob-facts">${renderFacts(facts.metadata)}</dl>
          </details>
        </section>
        ${detail.responsibility(e)}
      </div>`;
  };

  /** Keep responsibility rows stable when a contact or role is not documented. */
  detail.responsibility = function (e) {
    const row = (label, html) => `<dt>${esc(t(label))}</dt><dd>${html || '<span>—</span>'}</dd>`;
    const website = (name, url, title) => {
      const href = ui.safeHref(url);
      return href ? ui.link(href, `${esc(name)} ${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true, title }) : esc(name);
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
    const rows = row('detail.organisation', e.responsibleOrg ? website(e.responsibleOrg, contact.url) : '')
      + row('detail.owner', actor(e.dataOwner, 'person'))
      + row('detail.steward', actor(e.dataSteward, 'person'))
      + row('detail.dataCustodian', actor(data.custodianOf(e.kind, e), 'organisation'))
      + row('detail.email', contact.email ? ui.link('mailto:' + encodeURIComponent(contact.email).replace(/%40/g, '@'), esc(contact.email), { className: 'ob-inline-link' }) : '')
      + row('detail.phone', contact.phone ? ui.link('tel:' + contact.phone.replace(/[\s().-]/g, ''), esc(contact.phone), { className: 'ob-inline-link' }) : '');
    return rows ? `<section class="ob-responsibility"><h2>${esc(t('detail.contacts'))}</h2><dl class="ob-facts">${rows}</dl></section>` : '';
  };

  /* Detail rows */
  const keyCell = k => (k === 'PK' || k === 'FK') ? ui.chip(k, 'outline') : '<span class="ob-cell-muted">—</span>';
  const keyText = k => (k === 'PK' || k === 'FK') ? k : '';

  /** Rows carry escaped cells and raw sort values; exports reuse the same ordering. */
  detail.rowsData = function (e) {
    const c = (label, width) => ({ label: t(label), width });
    const compact = (label, numeric = false) => ({ label: t(label), compact: true, numeric });
    switch (e.kind) {
      case 'objects': return {
        columns: [{ ...c('col.attribute', '26%'), primary: true }, c('col.description'), c('col.valueType', '9rem'), compact('col.key'), compact('col.mandatory')],
        rows: e.attributes.map(a => { const href = router.entityHref('attrs', `${e.identifier}/${a.identifier}`), mandatory = a.mandatory ? t('yes') : t('no'); return { href, cells: [ui.entityLink(href, a.name), esc(a.description), esc(a.valueType), keyCell(a.keyRole), esc(mandatory)], text: [a.name, a.description, a.valueType, keyText(a.keyRole), mandatory], search: [a.identifier, a.technicalName] }; }),
      };
      case 'tables': {
        const hasCodes = e.fields.some(f => f.codeList);
        const columns = [{ ...c('col.field', '26%'), primary: true }, c('col.description'), c('col.dataType', '10rem'), compact('col.key')];
        if (hasCodes) columns.push(c('col.codeList', '22%'));
        return {
          columns,
          rows: e.fields.map(f => {
            const href = router.entityHref('fields', `${e.identifier}/${data.fieldId(f)}`);
            const name = data.displayName('fields', f);
            const row = { href, cells: [ui.entityLink(href, name), esc(f.description), esc(f.dataType), keyCell(f.keyRole)], text: [name, f.description, f.dataType, keyText(f.keyRole)] };
            if (hasCodes) {
              const ref = data.get('refs', f.codeList);
              row.cells.push(ref ? ui.entityLink(router.entityHref('refs', ref.identifier), ref.name) : '—');
              row.text.push(ref ? ref.name : '');
            }
            return row;
          }),
        };
      }
      case 'refs': return {
        columns: [c('col.code', '8rem'), c('col.label'), compact('col.type')],
        rows: e.values.map(v => ({ cells: [esc(v.code), esc(v.label), 'Code'], text: [v.code, v.label, 'Code'] })),
      };
      case 'systems': return {
        columns: [c('col.table', '28%'), c('col.description'), compact('col.fields', true), compact('col.status')],
        rows: data.tablesOfSystem(e).map(x => { const href = router.entityHref('tables', x.identifier), name = data.displayName('tables', x), st = data.statusOf('tables', x); return { href, cells: [ui.entityLink(href, name), esc(x.description), x.fields.length, ui.chip(st, data.statusTone(st))], text: [name, x.description, x.fields.length, st] }; }),
      };
      case 'products': return {
        columns: [c('col.attribute', '26%'), c('col.description'), c('col.valueType', '9rem')],
        rows: e.attributes.map(a => ({ cells: [esc(a.name), esc(a.description), esc(a.valueType)], text: [a.name, a.description, a.valueType] })),
      };
      default: return { columns: [], rows: [] };
    }
  };

  /** Filter the complete row set before sorting and pagination. */
  detail.rowsContext = function (e, route, state) {
    const rd = detail.rowsData(e);
    const filter = (route.params.filter || '').trim();
    const options = ui.tableOptions(state, `detail:${e.kind}:rows`);
    const matches = rd.rows.filter(row => data.matchesValues([...row.text, ...(row.search || [])], filter));
    const ordered = ui.sortRows(matches, options.sort, row => row.text);
    const paging = ui.pageState(ordered.length, route.params);
    return { filter, total: rd.rows.length, matched: matches.length, columns: rd.columns, options, paging, rows: ordered.slice(paging.from - 1, paging.to) };
  };

  detail.rows = function (e, route, state, list = detail.rowsContext(e, route, state)) {
    if (!list.total) return ui.empty(t('detail.noRows', { what: detail.rowsLabel(e) }));
    if (!list.matched) return ui.collectionEmpty(list.filter);
    const { columns, options, paging } = list;
    const rows = list.rows.map(r => ui.tr(r.cells, r.href, columns)).join('');
    return `<div class="ob-detail-rows">${ui.pager(paging, { position: 'top' })}${ui.table(columns, rows, options)}${ui.pager(paging)}</div>`;
  };

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
  detail.history = function (e, state) {
    const columns = [{ label: t('col.date'), compact: true }, { label: t('col.change'), width: '22%' }, { label: t('col.details') }, { label: t('col.editedBy'), width: '12rem' }];
    const options = ui.tableOptions(state, `detail:${e.kind}:history`, { column: 0, direction: 'desc' });
    const history = ui.sortRows(data.history(e.kind, e.identifier), options.sort, h => [h.date, h.action, h.detail, h.user]);
    const rows = history.map(h => ui.tr([{ html: esc(fmt(h.date)), cls: 'ob-cell-nowrap' }, esc(h.action), { html: esc(h.detail), cls: 'ob-cell-muted' }, esc(h.user)], null, columns)).join('');
    const noteKey = e.kind === 'attrs' ? 'detail.historyInherited' : e.kind === 'fields' ? 'detail.fieldHistoryInherited' : null;
    const note = noteKey ? `<p class="ob-context-note">${esc(t(noteKey))}</p>` : '';
    return note + ui.table(columns, rows, options);
  };

  DK.detail = detail;
})(window.DK);
