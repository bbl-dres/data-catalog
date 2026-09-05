/* detail.js – entity pages ("Steckbrief"): tabs Übersicht, rows (Attribute /
   Felder / Werte / …), Beziehungen (diagram/table) and Verlauf. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router;
  const t = ui.t, esc = ui.esc, icon = ui.icon, fmt = ui.fmtDate;
  const detail = {};
  const PAGE_SIZES = [50, 100, 200];
  detail.pageSize = route => PAGE_SIZES.includes(Number(route.params.size)) ? Number(route.params.size) : 50;

  detail.rowsLabel = e => data.kindDef(e.kind).rows;

  detail.tabs = function (e) {
    const historyLabel = e.kind === 'attrs' ? t('detail.tab.objectHistory') : t('detail.tab.history');
    return [['overview', t('detail.tab.overview')], ['rows', detail.rowsLabel(e)], ['relations', t('detail.tab.relations')], ['history', historyLabel]].filter(x => x[1]);
  };

  /** Resolve a requested semantic tab for an entity, falling back to Übersicht. */
  detail.resolveTab = function (e, requested) {
    const tab = requested || 'overview';
    return detail.tabs(e).some(x => x[0] === tab) ? tab : 'overview';
  };

  detail.render = function (e, route, state) {
    const tabs = detail.tabs(e);
    const tab = detail.resolveTab(e, route.params.tab);
    const counts = { rows: detail.rowsData(e).rows.length, relations: data.relations(e.kind, e).reduce((n, g) => n + g.items.length, 0), history: data.history(e.kind, e.identifier).length };
    const tabsHtml = `<div class="ob-detail-controls"><div class="ob-tabs-frame ob-detail-tabs-frame"><div class="ob-tabs"><div class="ob-tab-list" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" class="ob-tab" aria-selected="${tab === id}" aria-controls="panel-${id}" tabindex="${tab === id ? '0' : '-1'}" data-action="set-tab" data-tab="${id}">${esc(label)}${id === 'overview' ? '' : ` (${counts[id]})`}</button>`).join('')}</div>${tab === 'relations' ? `<button type="button" class="ob-button ob-relations-toggle" data-action="toggle-relation-view" aria-controls="panel-relations">${icon(state.relationDiagram ? 'list' : 'branch', 'sm')}${esc(t(state.relationDiagram ? 'detail.relations.showList' : 'detail.relations.showDiagram'))}</button>` : ''}</div></div></div>`;
    let panel;
    if (tab === 'overview') panel = detail.overview(e, state);
    else if (tab === 'rows') panel = detail.rows(e, route, state);
    else if (tab === 'relations') panel = detail.relations(e, state);
    else panel = detail.history(e, state);
    return tabsHtml + `<div id="panel-${tab}" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0">${panel}</div>`;
  };

  /* ---- Übersicht ---------------------------------------------------------- */
  detail.facts = function (e) {
    const plain = (label, value) => ({ label, value, type: 'plain' });
    const internal = (label, value, kind, id) => ({ label, value, type: 'internal', href: router.entityHref(kind, id) });
    const ext = (label, value, href) => ({ label, value, type: 'link', href });
    const dom = data.domainForEntity(e.kind, e);
    const primary = [plain(t('fact.type'), data.kindDef(e.kind).singular), { label: t('fact.status'), value: e.status, type: 'chip', tone: data.statusTone(e.status) }];
    if (dom && e.kind !== 'domains') primary.push(internal(t('fact.domain'), dom.name, 'domains', dom.identifier));
    switch (e.kind) {
      case 'systems':
        primary.push(plain(t('fact.technology'), e.technology));
        if (e.informationUrl) primary.push(ext(t('fact.moreInformation'), t('fact.openInformation'), e.informationUrl));
        break;
      case 'objects':
        primary.push(plain(t('fact.normReference'), e.normReference));
        break;
      case 'attrs': {
        const o = data.objOf(e.object);
        const key = e.keyRole === 'PK' ? t('fact.key.pk') : e.keyRole === 'FK' ? t('fact.key.fk') : t('fact.key.none');
        primary.push(internal(t('fact.object'), o.name, 'objects', o.identifier));
        primary.push(plain(t('fact.valueType'), e.valueType), plain(t('fact.key'), key), plain(t('fact.mandatory'), e.mandatory ? t('yes') : t('no')),
          plain(t('fact.normReference'), e.normReference), plain(t('fact.position'), t('fact.positionOf', { i: e.position, n: o.attributes.length })));
        break;
      }
      case 'tables':
        primary.push(internal(t('fact.system'), data.nameOf('systems', e.system), 'systems', e.system), plain(t('fact.technicalName'), e.technicalName),
          internal(t('fact.realizes'), data.nameOf('objects', e.realizes), 'objects', e.realizes));
        break;
      case 'products':
        primary.push(plain(t('fact.access'), e.accessRights), plain(t('fact.license'), e.license), plain(t('fact.format'), e.format), plain(t('fact.refresh'), e.accrualPeriodicity), ext(t('fact.obtain'), t('fact.obtainProduct')));
        break;
      case 'apis':
        primary.push(internal(t('fact.system'), data.nameOf('systems', e.system), 'systems', e.system), plain(t('fact.protocol'), e.protocol), plain(t('fact.access'), e.accessRights),
          plain(t('fact.baseUrl'), e.endpointURL), ext(t('fact.documentation'), t('fact.openDocs'), e.documentation));
        break;
      case 'refs':
        primary.push(plain(t('fact.codeSource'), e.sourceAuthority), internal(t('fact.object'), data.nameOf('objects', e.businessObject), 'objects', e.businessObject), ext(t('fact.sourceDocument'), t('fact.openSourceDocument')));
        break;
    }
    primary.push(plain(t('fact.classification'), e.classification), plain(t('fact.personalData'), e.personalData ? t('yes') : t('no')));
    const metadata = [plain(t('fact.identifier'), e.identifier), plain(t('fact.version'), e.version), plain(t('fact.created'), fmt(e.created)), plain(t('fact.modified'), fmt(e.modified)), plain(t('fact.source'), e.source), plain(t('fact.synced'), fmt(e.synced))];
    const present = f => f.value != null && f.value !== '';
    return { primary: primary.filter(present), metadata: metadata.filter(present) };
  };

  detail.overview = function (e, state = {}) {
    const renderFacts = facts => facts.map(f => {
      let v;
      if (f.type === 'chip') v = ui.chip(f.value, f.tone);
      else if (f.type === 'internal') v = `<a class="ob-fact-link" href="${esc(f.href)}">${esc(f.value)}</a>`;
      else if (f.type === 'link') v = f.href
        ? ui.link(f.href, `${esc(f.value)} ${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true })
        : `<a class="ob-inline-link" href="#" data-action="not-available" data-what="${esc(f.value)}">${esc(f.value)} ${icon('link_external', 'sm')}</a>`;
      else v = `<span>${esc(f.value)}</span>`;
      return `<dt>${esc(f.label)}</dt><dd>${v}</dd>`;
    }).join('');
    const facts = detail.facts(e);
    const dataCustodian = data.custodianOf(e.kind, e);
    // Persons link to the federal directory. Prototype: the base URL without a person id (config.admindirUrl).
    const person = name => name
      ? ui.link(data.config.admindirUrl, `${esc(name)} ${icon('link_external', 'sm')}`, { className: 'ob-inline-link', external: true, title: t('detail.openAdmindir', { name }) })
      : '–';
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
        <section>
          <h2>${esc(t('detail.contacts'))}</h2>
          <dl class="ob-facts">
            <dt>${esc(t('detail.owner'))}</dt><dd>${person(e.dataOwner)}</dd>
            <dt>${esc(t('detail.steward'))}</dt><dd>${person(e.dataSteward)}</dd>
            ${dataCustodian ? `<dt>${esc(t('detail.dataCustodian'))}</dt><dd>${person(dataCustodian)}</dd>` : ''}
          </dl>
        </section>
      </div>`;
  };

  /* ---- rows (Attribute / Felder / Werte / Geschäftsobjekte / Datentabellen) */
  const keyCell = k => (k === 'PK' || k === 'FK') ? ui.chip(k, 'outline') : '<span class="ob-cell-muted">—</span>';
  const keyText = k => (k === 'PK' || k === 'FK') ? k : '';

  /** Columns + rows for the entity's list tab. rows: [{cells, text, href}]; `text` is the raw value per column (sort, CSV). */
  detail.rowsData = function (e) {
    const c = (label, width) => ({ label: t(label), width });
    const compact = (label, numeric = false) => ({ label: t(label), compact: true, numeric });
    switch (e.kind) {
      case 'objects': return {
        columns: [compact('col.position', true), { ...c('col.attribute', '26%'), primary: true }, c('col.description'), c('col.valueType', '9rem'), compact('col.key'), compact('col.mandatory')],
        rows: e.attributes.map((a, i) => { const href = router.entityHref('attrs', `${e.identifier}/${a.identifier}`), position = a.position || i + 1, mandatory = a.mandatory ? t('yes') : t('no'); return { href, cells: [position, ui.entityLink(href, a.name), esc(a.description), esc(a.valueType), keyCell(a.keyRole), esc(mandatory)], text: [position, a.name, a.description, a.valueType, keyText(a.keyRole), mandatory] }; }),
      };
      case 'tables': return {
        columns: [c('col.field', '26%'), c('col.description'), c('col.dataType', '10rem'), compact('col.key')],
        rows: e.fields.map(f => ({ cells: [{ html: esc(f.name), cls: 'ob-code' }, esc(f.description), esc(f.dataType), keyCell(f.keyRole)], text: [f.name, f.description, f.dataType, keyText(f.keyRole)] })),
      };
      case 'refs': return {
        columns: [c('col.code', '8rem'), c('col.label'), compact('col.type')],
        rows: e.values.map(v => ({ cells: [{ html: esc(v.code), cls: 'ob-code' }, esc(v.label), 'Code'], text: [v.code, v.label, 'Code'] })),
      };
      case 'domains': return {
        columns: [c('col.object', '28%'), c('col.description'), compact('col.attributes', true), compact('col.status')],
        rows: data.objectsOfDomain(e).map(o => { const href = router.entityHref('objects', o.identifier); return { href, cells: [ui.entityLink(href, o.name), esc(o.description), o.attributes.length, ui.chip(o.status, data.statusTone(o.status))], text: [o.name, o.description, o.attributes.length, o.status] }; }),
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

  detail.rows = function (e, route, state) {
    const rd = detail.rowsData(e);
    if (!rd.rows.length) return ui.empty(t('detail.noRows', { what: detail.rowsLabel(e) }));
    const options = ui.tableOptions(state, `detail:${e.kind}:rows`);
    const ordered = ui.sortRows(rd.rows, options.sort, row => row.text);
    const pageSize = detail.pageSize(route);
    const pages = Math.max(1, Math.ceil(ordered.length / pageSize));
    const page = Math.min(pages, Math.max(1, parseInt(route.params.page, 10) || 1));
    const slice = ordered.slice((page - 1) * pageSize, page * pageSize);
    const rows = slice.map(r => ui.tr(r.cells, r.href, rd.columns)).join('');
    const pager = `<div class="ob-pager">
      <span class="ob-pager-current" aria-current="page">${page}</span>
      <span>${esc(pages === 1 ? t('detail.page', { n: pages }) : t('detail.pagePlural', { n: pages }))}</span>
      <button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.prev'))}" data-action="set-page" data-page="${page - 1}" data-focus="page-prev"${page <= 1 ? ' disabled' : ''}>${icon('chevron_left', 'sm')}</button>
      <button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.next'))}" data-action="set-page" data-page="${page + 1}" data-focus="page-next"${page >= pages ? ' disabled' : ''}>${icon('chevron_right', 'sm')}</button>
      <label class="ob-page-size">${esc(t('detail.pageSize'))}<select data-action="set-page-size" aria-label="${esc(t('detail.pageSize'))}">${PAGE_SIZES.map(n => `<option value="${n}"${n === pageSize ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <span class="ob-pager-range">${esc(t('detail.rowRange', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, ordered.length), total: ordered.length }))}</span>
    </div>`;
    const topPager = pages > 1 ? `<nav class="ob-pager ob-pager--top" aria-label="${esc(t('detail.pagination'))}">
      <span class="ob-pager-range">${esc(t('detail.rowRange', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, ordered.length), total: ordered.length }))}</span>
      <button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.prev'))}" data-action="set-page" data-page="${page - 1}" data-focus="page-prev-top"${page <= 1 ? ' disabled' : ''}>${icon('chevron_left', 'sm')}</button>
      <button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.next'))}" data-action="set-page" data-page="${page + 1}" data-focus="page-next-top"${page >= pages ? ' disabled' : ''}>${icon('chevron_right', 'sm')}</button>
    </nav>` : '';
    return `<div class="ob-detail-rows">${topPager}${ui.table(rd.columns, rows, options)}${pager}</div>`;
  };

  /* ---- Beziehungen: shared table and interactive diagram ------------------ */
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

  /* ---- Verlauf --------------------------------------------------------------- */
  detail.history = function (e, state) {
    const columns = [{ label: t('col.date'), compact: true }, { label: t('col.change'), width: '22%' }, { label: t('col.details') }, { label: t('col.editedBy'), width: '12rem' }];
    const options = ui.tableOptions(state, `detail:${e.kind}:history`, { column: 0, direction: 'desc' });
    const history = ui.sortRows(data.history(e.kind, e.identifier), options.sort, h => [h.date, h.action, h.detail, h.user]);
    const rows = history.map(h => ui.tr([{ html: esc(fmt(h.date)), cls: 'ob-cell-nowrap' }, esc(h.action), { html: esc(h.detail), cls: 'ob-cell-muted' }, esc(h.user)], null, columns)).join('');
    const note = e.kind === 'attrs' ? `<p class="ob-context-note">${esc(t('detail.historyInherited'))}</p>` : '';
    return note + ui.table(columns, rows, options);
  };

  DK.detail = detail;
})(window.DK);
