/* detail.js – entity pages ("Steckbrief"): tabs Übersicht, rows (Attribute /
   Felder / Werte / …), Beziehungen (orbit graph) and Verlauf. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router;
  const t = ui.t, esc = ui.esc, icon = ui.icon, fmt = ui.fmtDate;
  const detail = {};
  const PAGE_SIZE = 20;
  const tableEntityLink = (href, label) => `<a class="ob-table-entity-link" href="${esc(href)}">${esc(label)}</a>`;
  const tableOptions = (state, key, defaultSort) => ({ key, sort: state.tableSorts[key] || defaultSort || null });

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

  detail.render = function (e, route, state, actionsHtml) {
    const tabs = detail.tabs(e);
    const tab = detail.resolveTab(e, route.params.tab);
    const tabsHtml = `<div class="ob-detail-controls"><div class="ob-tabs-frame ob-detail-tabs-frame"><div class="ob-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" id="tab-${id}" class="ob-tab" aria-selected="${tab === id}" aria-controls="panel-${id}" tabindex="${tab === id ? '0' : '-1'}" data-action="set-tab" data-tab="${id}">${esc(label)}</button>`).join('')}</div></div><div class="ob-local-actions">${actionsHtml || ''}</div></div>`;
    let panel;
    if (tab === 'overview') panel = detail.overview(e);
    else if (tab === 'rows') panel = detail.rows(e, route, state);
    else if (tab === 'relations') panel = detail.relations(e, state);
    else panel = detail.history(e, state);
    return tabsHtml + `<div id="panel-${tab}" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0">${panel}</div>`;
  };

  /* ---- Übersicht ---------------------------------------------------------- */
  detail.facts = function (e) {
    const plain = (label, value) => ({ label, value: String(value), type: 'plain' });
    const chip = (label, value, tone) => ({ label, value: String(value), type: 'chip', tone });
    const internal = (label, value, kind, id) => ({ label, value, type: 'internal', href: router.entityHref(kind, id) });
    const ext = (label, value, href) => ({ label, value, type: 'link', href });
    const dom = data.domainForEntity(e.kind, e);
    const primary = [chip(t('fact.status'), e.status, data.statusTone(e.status))];
    if (dom && e.kind !== 'domains') primary.push(internal(t('fact.domain'), dom.name, 'domains', dom.identifier));
    switch (e.kind) {
      case 'domains':
        break;
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
      case 'tables': {
        primary.push(internal(t('fact.system'), data.sysOf(e.system).name, 'systems', e.system), plain(t('fact.technicalName'), e.technicalName),
          internal(t('fact.realizes'), data.objOf(e.realizes).name, 'objects', e.realizes));
        break;
      }
      case 'products':
        primary.push(plain(t('fact.access'), e.accessRights), plain(t('fact.license'), e.license), plain(t('fact.format'), e.format), plain(t('fact.refresh'), e.accrualPeriodicity), ext(t('fact.obtain'), t('fact.obtainProduct')));
        break;
      case 'apis':
        primary.push(internal(t('fact.system'), data.sysOf(e.system).name, 'systems', e.system), plain(t('fact.protocol'), e.protocol), plain(t('fact.access'), e.accessRights),
          plain(t('fact.baseUrl'), e.endpointURL), ext(t('fact.documentation'), t('fact.openDocs'), e.documentation));
        break;
      case 'refs':
        primary.push(plain(t('fact.codeSource'), e.sourceAuthority), internal(t('fact.object'), data.objOf(e.businessObject).name, 'objects', e.businessObject), ext(t('fact.sourceDocument'), t('fact.openSourceDocument')));
        break;
    }
    primary.push(plain(t('fact.classification'), e.classification), plain(t('fact.personalData'), e.personalData ? t('yes') : t('no')));
    const metadata = [plain(t('fact.identifier'), e.identifier), plain(t('fact.version'), e.version), plain(t('fact.created'), fmt(e.created)), plain(t('fact.modified'), fmt(e.modified)), plain(t('fact.source'), e.source), plain(t('fact.synced'), fmt(e.synced))];
    const present = f => f.value != null && f.value !== '' && f.value !== 'undefined';
    return { primary: primary.filter(present), metadata: metadata.filter(present) };
  };

  detail.overview = function (e) {
    const renderFacts = facts => facts.map(f => {
      let v;
      if (f.type === 'chip') v = ui.chip(f.value, f.tone);
      else if (f.type === 'internal') v = `<a class="ob-fact-link" href="${esc(f.href)}">${esc(f.value)}</a>`;
      else if (f.type === 'link') v = f.href
        ? `<a class="ob-inline-link" href="${esc(f.href)}" target="_blank" rel="noopener">${esc(f.value)} ${icon('link_external', 'sm')}</a>`
        : `<a class="ob-inline-link" href="#" data-action="not-available" data-what="${esc(f.value)}">${esc(f.value)} ${icon('link_external', 'sm')}</a>`;
      else v = `<span>${esc(f.value)}</span>`;
      return `<dt>${esc(f.label)}</dt><dd>${v}</dd>`;
    }).join('');
    const facts = detail.facts(e);
    const dataCustodian = data.custodianOf(e.kind, e);
    return `
      <div class="ob-detail-sections">
        <section>
          <h2>${esc(t('detail.contacts'))}</h2>
          <dl class="ob-facts">
            <dt>${esc(t('detail.owner'))}</dt><dd>${esc(e.dataOwner)}</dd>
            <dt>${esc(t('detail.steward'))}</dt><dd>${esc(e.dataSteward)}</dd>
            ${dataCustodian ? `<dt>${esc(t('detail.dataCustodian'))}</dt><dd>${esc(dataCustodian)}</dd>` : ''}
          </dl>
        </section>
        <section>
          <h2>${esc(t('detail.facts'))}</h2>
          <dl class="ob-facts">${renderFacts(facts.primary)}</dl>
        </section>
        <details class="ob-metadata">
          <summary>${esc(t('detail.metadata'))}</summary>
          <dl class="ob-facts">${renderFacts(facts.metadata)}</dl>
        </details>
      </div>`;
  };

  /* ---- rows (Attribute / Felder / Werte / Geschäftsobjekte / Datentabellen) */
  const keyCell = k => (k === 'PK' || k === 'FK') ? ui.chip(k, 'neutral') : '<span class="ob-cell-muted">—</span>';
  const keyText = k => (k === 'PK' || k === 'FK') ? k : '';

  /** Columns + rows for the entity's list tab. rows: [{cells, text, href}] */
  detail.rowsData = function (e) {
    const c = (label, width) => ({ label: t(label), width });
    switch (e.kind) {
      case 'objects': return {
        columns: [c('col.attribute', '22%'), c('col.description'), c('col.valueType', '14%'), c('col.key', '12%')],
        rows: e.attributes.map(a => { const href = router.entityHref('attrs', `${e.identifier}/${a.identifier}`); return { href, cells: [tableEntityLink(href, a.name), esc(a.description), esc(a.valueType), keyCell(a.keyRole)], text: [a.name, a.description, a.valueType, keyText(a.keyRole)] }; }),
      };
      case 'tables': return {
        columns: [c('col.field', '22%'), c('col.description'), c('col.dataType', '14%'), c('col.key', '12%')],
        rows: e.fields.map(f => ({ cells: [{ html: esc(f.name), cls: 'ob-code' }, esc(f.description), esc(f.dataType), keyCell(f.keyRole)], text: [f.name, f.description, f.dataType, keyText(f.keyRole)] })),
      };
      case 'refs': return {
        columns: [c('col.code', '16%'), c('col.label'), c('col.type', '14%')],
        rows: e.values.map(v => ({ cells: [{ html: esc(v.code), cls: 'ob-code' }, esc(v.label), 'Code'], text: [v.code, v.label, 'Code'] })),
      };
      case 'domains': return {
        columns: [c('col.object', '22%'), c('col.description'), c('col.attributes', '14%'), c('col.status', '12%')],
        rows: data.objectsOfDomain(e).map(o => { const href = router.entityHref('objects', o.identifier); return { href, cells: [tableEntityLink(href, o.name), esc(o.description), o.attributes.length, ui.chip(o.status, data.statusTone(o.status))], text: [o.name, o.description, o.attributes.length, o.status] }; }),
      };
      case 'systems': return {
        columns: [c('col.table', '26%'), c('col.description'), c('col.fields', '12%'), c('col.status', '14%')],
        rows: data.tablesOfSystem(e).map(x => { const href = router.entityHref('tables', x.identifier); const st = data.statusOf('tables', x); return { href, cells: [tableEntityLink(href, `${x.name} (${x.technicalName})`), esc(x.description), x.fields.length, ui.chip(st, data.statusTone(st))], text: [`${x.name} (${x.technicalName})`, x.description, x.fields.length, st] }; }),
      };
      case 'products': return {
        columns: [c('col.attribute', '22%'), c('col.description'), c('col.valueType', '14%')],
        rows: e.attributes.map(a => ({ cells: [esc(a.name), esc(a.description), esc(a.valueType)], text: [a.name, a.description, a.valueType] })),
      };
      default: return { columns: [], rows: [] };
    }
  };

  detail.rows = function (e, route, state) {
    const rd = detail.rowsData(e);
    if (!rd.rows.length) return `<div class="ob-empty"><div class="ob-empty-title">${esc(t('detail.noRows', { what: detail.rowsLabel(e) }))}</div></div>`;
    const options = tableOptions(state, `detail:${e.kind}:rows`);
    const ordered = ui.sortRows(rd.rows, options.sort, row => row.text);
    const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
    const page = Math.min(pages, Math.max(1, parseInt(route.params.page, 10) || 1));
    const slice = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const rows = slice.map(r => ui.tr(r.cells, r.href, rd.columns)).join('');
    const pager = `<div class="ob-pager">
      <span class="ob-pager-current" aria-current="page">${page}</span>
      <span>${esc(pages === 1 ? t('detail.page', { n: pages }) : t('detail.pagePlural', { n: pages }))}</span>
      <button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.prev'))}" data-action="set-page" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>${icon('chevron_left', 'sm')}</button>
      <button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.next'))}" data-action="set-page" data-page="${page + 1}"${page >= pages ? ' disabled' : ''}>${icon('chevron_right', 'sm')}</button>
    </div>`;
    return ui.table(rd.columns, rows, options) + pager;
  };

  /* ---- Beziehungen: orbit graph ------------------------------------------- */
  const SIZE = 1000, CX = 500, CY = 500, ORBIT = 230, GAP = 16, BADGE_OFF = 18, BADGE_ANG = -Math.PI * 3 / 4;

  detail.layout = function (e) {
    const rels = data.relations(e.kind, e).filter(r => r.items.length);
    const sats = rels.map((r, i) => {
      const outerR = Math.min(150, Math.max(70, 44 + r.items.length * 22));
      const angle = (2 * Math.PI * i / rels.length) - Math.PI / 2;
      const x = CX + ORBIT * Math.cos(angle), y = CY + ORBIT * Math.sin(angle);
      const bd = outerR + BADGE_OFF;
      return {
        r, outerR, x, y,
        badgeLeft: outerR + bd * Math.cos(BADGE_ANG) - 12, badgeTop: outerR + bd * Math.sin(BADGE_ANG) - 12,
        line: [CX, CY, x, y],
        badgeLine: [x + bd * Math.cos(BADGE_ANG), y + bd * Math.sin(BADGE_ANG), x + outerR * Math.cos(BADGE_ANG), y + outerR * Math.sin(BADGE_ANG)],
      };
    });
    return { rels, sats };
  };

  /** Inner canvas (lines, centre and satellites). */
  detail.graphCanvas = function (e) {
    const { sats } = detail.layout(e);
    const line = (cls, l) => `<line class="${cls}" x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}"></line>`;
    const svg = `<svg class="ob-graph-svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${sats.map(s => line('ob-graph-line', s.line)).join('')}${sats.map(s => line('ob-graph-line--badge', s.badgeLine)).join('')}</svg>`;
    const center = `<div class="ob-graph-center" style="left:${CX - 50}px;top:${CY - 50}px"><div class="ob-graph-center-circle">${icon(data.kindDef(e.kind).icon, '3xl')}</div><div class="ob-graph-center-label">${esc(e.name)}</div></div>`;
    const satsHtml = sats.map(s => {
      const d = s.outerR * 2, inner = (s.outerR - GAP) * 2;
      const items = s.r.items.map(it => {
        const short = it.name.length > 16 ? it.name.slice(0, 15) + '…' : it.name;
        return `<a class="ob-graph-sat-item" href="${esc(it.href)}"${it.external ? ' target="_blank" rel="noopener"' : ''} title="${esc(it.name + ' · ' + it.sub)}">${icon(s.r.icon, '2xl')}<span class="ob-graph-sat-item-label">${esc(short)}</span></a>`;
      }).join('');
      return `<div class="ob-graph-sat" style="left:${s.x - s.outerR}px;top:${s.y - s.outerR}px;width:${d}px;height:${d}px">
        <div class="ob-graph-sat-outer" style="width:${d}px;height:${d}px"><div class="ob-graph-sat-inner" style="width:${inner}px;height:${inner}px"><div class="ob-graph-sat-items">${items}</div></div></div>
        <div class="ob-graph-badge" style="left:${s.badgeLeft}px;top:${s.badgeTop}px">${s.r.items.length}</div>
        <div class="ob-graph-sat-title">${esc(s.r.title)}</div>
      </div>`;
    }).join('');
    return svg + center + satsHtml;
  };

  detail.graphTransform = g => `translate(${g.x}px,${g.y}px) scale(${g.scale})`;

  detail.graph = function (e, state) {
    const { rels } = detail.layout(e);
    return `<div class="ob-graph" id="graph">
      <div class="ob-graph-canvas" id="graph-canvas" style="transform:${detail.graphTransform(state.graph)}">${detail.graphCanvas(e)}</div>
      ${rels.length ? '' : `<div class="ob-graph-empty">${esc(t('detail.noRelations'))}</div>`}
    </div>`;
  };

  detail.relationList = function (e) {
    const groups = data.relations(e.kind, e).filter(r => r.items.length);
    if (!groups.length) return `<div class="ob-empty"><div class="ob-empty-title">${esc(t('detail.noRelations'))}</div></div>`;
    return `<div class="ob-relation-groups">${groups.map(group => `
      <section class="ob-relation-group">
        <h2>${icon(group.icon, 'lg')}<span>${esc(group.title)}</span><span class="ob-relation-count">${group.items.length}</span></h2>
        <ul>${group.items.map(item => `<li><a href="${esc(item.href)}"${item.external ? ' target="_blank" rel="noopener"' : ''}><span class="ob-relation-name">${esc(item.name)}</span>${item.sub ? `<span class="ob-relation-sub">${esc(item.sub)}</span>` : ''}</a></li>`).join('')}</ul>
      </section>`).join('')}</div>`;
  };

  detail.relations = function (e, state) {
    return `<div class="ob-relations-view${state.relationDiagram ? ' is-diagram' : ''}">
      <div class="ob-relation-view-switch">
        <button type="button" class="ob-button" data-action="toggle-relation-view">${esc(state.relationDiagram ? t('detail.relations.showList') : t('detail.relations.showDiagram'))}</button>
      </div>
      <div class="ob-relations-list">${detail.relationList(e)}</div>
      <div class="ob-relations-diagram">${detail.graph(e, state)}</div>
    </div>`;
  };

  /* ---- Verlauf --------------------------------------------------------------- */
  detail.history = function (e, state) {
    const columns = [{ label: t('col.date'), width: '12%' }, { label: t('col.change'), width: '22%' }, { label: t('col.details') }, { label: t('col.editedBy'), width: '18%' }];
    const options = tableOptions(state, `detail:${e.kind}:history`, { column: 0, direction: 'desc' });
    const history = ui.sortRows(data.history(e.kind, e.identifier), options.sort, h => [h.date, h.action, h.detail, h.user]);
    const rows = history.map(h => ui.tr([{ html: esc(fmt(h.date)), cls: 'ob-cell-nowrap' }, esc(h.action), { html: esc(h.detail), cls: 'ob-cell-muted' }, esc(h.user)], null, columns)).join('');
    const note = e.kind === 'attrs' ? `<p class="ob-context-note">${esc(t('detail.historyInherited'))}</p>` : '';
    return note + ui.table(columns, rows, options);
  };

  DK.detail = detail;
})(window.DK);
