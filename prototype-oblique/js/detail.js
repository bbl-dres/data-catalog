/* detail.js – entity pages ("Steckbrief"): tabs Übersicht, rows (Attribute /
   Felder / Werte / …), Beziehungen (orbit graph) and Verlauf. */
(function (DK) {
  'use strict';

  const ui = DK.ui, data = DK.data, router = DK.router;
  const t = ui.t, esc = ui.esc, icon = ui.icon, fmt = ui.fmtDate;
  const detail = {};
  const PAGE_SIZE = 20;

  detail.rowsLabel = e => e.kind === 'products' ? (e.attributes.length ? data.kindDef('products').rows : '') : data.kindDef(e.kind).rows;

  detail.tabs = function (e) {
    return [['overview', t('detail.tab.overview')], ['rows', detail.rowsLabel(e)], ['relations', t('detail.tab.relations')], ['history', t('detail.tab.history')]].filter(x => x[1]);
  };

  detail.render = function (e, route, state) {
    const tabs = detail.tabs(e);
    let tab = route.params.tab || 'overview';
    if (!tabs.some(x => x[0] === tab)) tab = 'overview';
    const tabsHtml = `<div class="ob-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="ob-tab" aria-selected="${tab === id}" data-action="set-tab" data-tab="${id}">${esc(label)}</button>`).join('')}</div>`;
    let panel;
    if (tab === 'overview') panel = detail.overview(e);
    else if (tab === 'rows') panel = detail.rows(e, route);
    else if (tab === 'relations') panel = detail.graph(e, state);
    else panel = detail.history(e);
    return tabsHtml + `<div role="tabpanel">${panel}</div>`;
  };

  /* ---- Übersicht ---------------------------------------------------------- */
  detail.facts = function (e) {
    const plain = (label, value, sub) => ({ label, value: String(value), sub, type: 'plain' });
    const internal = (label, value, kind, id) => ({ label, value, type: 'internal', href: router.entityHref(kind, id) });
    const ext = (label, value, href) => ({ label, value, type: 'link', href });
    const chip = (label, value) => ({ label, value, type: 'chip', tone: data.statusTone(value) });
    const dom = data.domainForEntity(e.kind, e);
    const core = [
      chip(t('fact.status'), e.status),
      plain(t('fact.responsibility'), e.responsibleOrg), plain(t('fact.classification'), e.classification), plain(t('fact.personalData'), e.personalData ? t('yes') : t('no')),
      plain(t('fact.version'), e.version), plain(t('fact.created'), fmt(e.created)), plain(t('fact.modified'), fmt(e.modified)),
      plain(t('fact.identifier'), e.identifier), plain(t('fact.source'), e.source, e.sourceDetail), plain(t('fact.synced'), fmt(e.synced)),
    ];
    const facts = dom && e.kind !== 'domains' ? [internal(t('fact.domain'), dom.name, 'domains', dom.identifier)] : [];
    switch (e.kind) {
      case 'domains': {
        const objs = data.objectsOfDomain(e);
        facts.push(plain(t('fact.objects'), objs.length), plain(t('fact.attributes'), objs.reduce((a, o) => a + o.attributes.length, 0)),
          plain(t('fact.tables'), data.tablesOfDomain(e).length), plain(t('fact.codelists'), data.refsOfDomain(e).length), ext(t('fact.repository'), t('fact.openRepository')));
        break;
      }
      case 'systems': {
        const tables = data.tablesOfSystem(e);
        facts.push(plain(t('fact.technology'), e.technology), plain(t('fact.operator'), e.operator), plain(t('fact.tables'), tables.length),
          plain(t('fact.fields'), tables.reduce((a, x) => a + x.fields.length, 0)), plain(t('fact.lastScan'), fmt(e.lastScan)), ext(t('fact.system'), t('fact.openSystem')));
        break;
      }
      case 'objects':
        facts.push(plain(t('fact.attributes'), e.attributes.length), plain(t('fact.normReference'), e.normReference), ext(t('fact.repository'), t('fact.openRepository')));
        break;
      case 'attrs': {
        const o = data.objOf(e.object);
        const key = e.keyRole === 'PK' ? t('fact.key.pk') : e.keyRole === 'FK' ? t('fact.key.fk') : t('fact.key.none');
        facts.unshift(internal(t('fact.object'), o.name, 'objects', o.identifier));
        facts.push(plain(t('fact.valueType'), e.valueType), plain(t('fact.key'), key), plain(t('fact.mandatory'), e.mandatory ? t('yes') : t('no')),
          plain(t('fact.normReference'), e.normReference), plain(t('fact.position'), t('fact.positionOf', { i: e.position, n: o.attributes.length })), ext(t('fact.repository'), t('fact.openRepository')));
        break;
      }
      case 'tables': {
        const st = data.statusOf('tables', e);
        facts.push(internal(t('fact.system'), data.sysOf(e.system).name, 'systems', e.system), plain(t('fact.technicalName'), e.technicalName), chip(t('fact.certification'), st),
          internal(t('fact.realizes'), data.objOf(e.realizes).name, 'objects', e.realizes), plain(t('fact.fields'), e.fields.length), plain(t('fact.lastScan'), fmt(e.lastScan)), ext(t('fact.sourceSystem'), t('fact.openTable')));
        break;
      }
      case 'products':
        facts.push(plain(t('fact.access'), e.accessRights), plain(t('fact.license'), e.license), plain(t('fact.format'), e.format), plain(t('fact.refresh'), e.accrualPeriodicity),
          plain(t('fact.attributes'), e.attributes.length ? e.attributes.length : t('fact.notDocumented')), ext(t('fact.obtain'), t('fact.obtainProduct')));
        break;
      case 'apis':
        facts.push(internal(t('fact.system'), data.sysOf(e.system).name, 'systems', e.system), plain(t('fact.protocol'), e.protocol), plain(t('fact.access'), e.accessRights),
          plain(t('fact.baseUrl'), e.endpointURL), ext(t('fact.documentation'), t('fact.openDocs'), e.documentation));
        break;
      case 'refs':
        facts.push(plain(t('fact.codeSource'), e.sourceAuthority), internal(t('fact.object'), data.objOf(e.businessObject).name, 'objects', e.businessObject),
          plain(t('fact.values'), e.values.length ? e.values.length : t('fact.notCaptured')), ext(t('fact.sourceDocument'), t('fact.openSourceDocument')));
        break;
    }
    return core.concat(facts);
  };

  detail.overview = function (e) {
    const dl = detail.facts(e).map(f => {
      let v;
      if (f.type === 'chip') v = ui.chip(f.value, f.tone);
      else if (f.type === 'internal') v = `<a href="${esc(f.href)}">${esc(f.value)}</a>`;
      else if (f.type === 'link') v = f.href
        ? `<a class="ob-inline-link" href="${esc(f.href)}" target="_blank" rel="noopener">${esc(f.value)} ${icon('link_external', 'sm')}</a>`
        : `<a class="ob-inline-link" href="#" data-action="not-available" data-what="${esc(f.value)}">${esc(f.value)} ${icon('link_external', 'sm')}</a>`;
      else v = `<span>${esc(f.value)}</span>${f.sub ? `<div class="ob-fact-sub">${esc(f.sub)}</div>` : ''}`;
      return `<dt>${esc(f.label)}</dt><dd>${v}</dd>`;
    }).join('');
    return `
      <div class="ob-detail-sections">
        <div>
          <h2>${esc(t('detail.description'))}</h2>
          <p class="ob-prose ob-detail-description">${esc(e.description)}</p>
          <h2>${esc(t('detail.contacts'))}</h2>
          <dl class="ob-facts">
            <dt>${esc(t('detail.owner'))} <span class="ob-fact-en">${esc(t('detail.ownerEn'))}</span></dt><dd>${esc(e.dataOwner)}</dd>
            <dt>${esc(t('detail.steward'))} <span class="ob-fact-en">${esc(t('detail.stewardEn'))}</span></dt><dd>${esc(e.dataSteward)}</dd>
          </dl>
        </div>
        <div>
          <h2>${esc(t('detail.facts'))}</h2>
          <dl class="ob-facts">${dl}</dl>
        </div>
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
        rows: e.attributes.map(a => { const href = router.entityHref('attrs', `${e.identifier}/${a.identifier}`); return { href, cells: [`<a href="${href}">${esc(a.name)}</a>`, esc(a.description), esc(a.valueType), keyCell(a.keyRole)], text: [a.name, a.description, a.valueType, keyText(a.keyRole)] }; }),
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
        rows: data.objectsOfDomain(e).map(o => { const href = router.entityHref('objects', o.identifier); return { href, cells: [`<a href="${href}">${esc(o.name)}</a>`, esc(o.description), o.attributes.length, ui.chip(o.status, data.statusTone(o.status))], text: [o.name, o.description, o.attributes.length, o.status] }; }),
      };
      case 'systems': return {
        columns: [c('col.table', '26%'), c('col.description'), c('col.fields', '12%'), c('col.certification', '14%')],
        rows: data.tablesOfSystem(e).map(x => { const href = router.entityHref('tables', x.identifier); const st = data.statusOf('tables', x); return { href, cells: [`<a href="${href}">${esc(x.name)} (${esc(x.technicalName)})</a>`, esc(x.description), x.fields.length, ui.chip(st, data.statusTone(st))], text: [`${x.name} (${x.technicalName})`, x.description, x.fields.length, st] }; }),
      };
      case 'products': return {
        columns: [c('col.attribute', '22%'), c('col.description'), c('col.valueType', '14%')],
        rows: e.attributes.map(a => ({ cells: [esc(a.name), esc(a.description), esc(a.valueType)], text: [a.name, a.description, a.valueType] })),
      };
      default: return { columns: [], rows: [] };
    }
  };

  detail.rows = function (e, route) {
    const rd = detail.rowsData(e);
    const pages = Math.max(1, Math.ceil(rd.rows.length / PAGE_SIZE));
    const page = Math.min(pages, Math.max(1, parseInt(route.params.page, 10) || 1));
    const slice = rd.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const rows = slice.map(r => ui.tr(r.cells, r.href)).join('');
    const pager = `<div class="ob-pager">
      <span class="ob-pager-current" aria-current="page">${page}</span>
      <span>${esc(pages === 1 ? t('detail.page', { n: pages }) : t('detail.pagePlural', { n: pages }))}</span>
      <button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.prev'))}" data-action="set-page" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>${icon('chevron_left', 'sm')}</button>
      <button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.next'))}" data-action="set-page" data-page="${page + 1}"${page >= pages ? ' disabled' : ''}>${icon('chevron_right', 'sm')}</button>
    </div>`;
    return ui.table(rd.columns, rows) + pager;
  };

  /* ---- Beziehungen: orbit graph ------------------------------------------- */
  const SIZE = 1000, CX = 500, CY = 500, ORBIT = 230, GAP = 16, BADGE_OFF = 18, BADGE_ANG = -Math.PI * 3 / 4;

  detail.layout = function (e, state) {
    const rels = data.relations(e.kind, e).filter(r => r.items.length);
    const sats = rels.map((r, i) => {
      const outerR = Math.min(150, Math.max(70, 44 + r.items.length * 22));
      const angle = (2 * Math.PI * i / rels.length) - Math.PI / 2;
      const x = CX + ORBIT * Math.cos(angle), y = CY + ORBIT * Math.sin(angle);
      const bd = outerR + BADGE_OFF;
      return {
        r, shown: !state.hiddenSats[r.key], outerR, x, y,
        badgeLeft: outerR + bd * Math.cos(BADGE_ANG) - 12, badgeTop: outerR + bd * Math.sin(BADGE_ANG) - 12,
        line: [CX, CY, x, y],
        badgeLine: [x + bd * Math.cos(BADGE_ANG), y + bd * Math.sin(BADGE_ANG), x + outerR * Math.cos(BADGE_ANG), y + outerR * Math.sin(BADGE_ANG)],
      };
    });
    return { rels, sats };
  };

  /** Inner canvas (lines, centre, satellites) – re-rendered on filter changes. */
  detail.graphCanvas = function (e, state) {
    const { sats } = detail.layout(e, state);
    const shown = sats.filter(s => s.shown);
    const gq = (state.graphQ || '').trim().toLowerCase();
    const line = (cls, l) => `<line class="${cls}" x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}"></line>`;
    const svg = `<svg class="ob-graph-svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${shown.map(s => line('ob-graph-line', s.line)).join('')}${shown.map(s => line('ob-graph-line--badge', s.badgeLine)).join('')}</svg>`;
    const center = `<div class="ob-graph-center" style="left:${CX - 50}px;top:${CY - 50}px"><div class="ob-graph-center-circle">${icon(data.kindDef(e.kind).icon, '3xl')}</div><div class="ob-graph-center-label">${esc(e.name)}</div></div>`;
    const satsHtml = shown.map(s => {
      const d = s.outerR * 2, inner = (s.outerR - GAP) * 2;
      const items = s.r.items.map(it => {
        const hide = gq && !it.name.toLowerCase().includes(gq);
        const short = it.name.length > 16 ? it.name.slice(0, 15) + '…' : it.name;
        return `<a class="ob-graph-sat-item" href="${esc(it.href)}"${it.external ? ' target="_blank" rel="noopener"' : ''} title="${esc(it.name + ' · ' + it.sub)}"${hide ? ' hidden' : ''}>${icon(s.r.icon, '2xl')}<span class="ob-graph-sat-item-label">${esc(short)}</span></a>`;
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
    const { rels, sats } = detail.layout(e, state);
    const tool = (name, label, zoom) => `<button type="button" class="ob-button ob-button--icon ob-button--outlined" title="${esc(label)}" aria-label="${esc(label)}" data-action="graph-zoom" data-zoom="${zoom}">${icon(name)}</button>`;
    const panel = `<div class="ob-graph-panel" data-panel="true">
      <div class="ob-graph-panel-tools">${tool('zoom_in', t('detail.graph.zoomIn'), 'in')}${tool('zoom_out', t('detail.graph.zoomOut'), 'out')}${tool('expand', t('detail.graph.reset'), 'reset')}</div>
      <div class="ob-graph-panel-search">
        <input type="text" id="graph-search" value="${esc(state.graphQ)}" placeholder="${esc(t('detail.graph.search'))}" aria-label="${esc(t('detail.graph.searchLabel'))}" autocomplete="off">
        <button type="button" class="ob-search-clear" id="graph-clear" aria-label="${esc(t('search.clear'))}" data-action="graph-clear"${state.graphQ ? '' : ' hidden'}>${icon('xmark', 'sm')}</button>
      </div>
      <div class="ob-graph-panel-label">${esc(t('detail.graph.show'))}</div>
      ${sats.map(s => `<label class="ob-graph-panel-check"><input type="checkbox"${s.shown ? ' checked' : ''} data-action="graph-toggle" data-key="${esc(s.r.key)}"><span>${esc(s.r.title)}</span></label>`).join('')}
    </div>`;
    return `<div class="ob-graph" id="graph">
      <div class="ob-graph-canvas" id="graph-canvas" style="transform:${detail.graphTransform(state.graph)}">${detail.graphCanvas(e, state)}</div>
      ${rels.length ? '' : `<div class="ob-graph-empty">${esc(t('detail.noRelations'))}</div>`}
      ${panel}
    </div>`;
  };

  /* ---- Verlauf --------------------------------------------------------------- */
  detail.history = function (e) {
    const rows = data.history(e.kind, e.identifier).map(h => ui.tr([{ html: esc(fmt(h.date)), cls: 'ob-cell-nowrap' }, esc(h.action), { html: esc(h.detail), cls: 'ob-cell-muted' }, esc(h.user)])).join('');
    return ui.table([{ label: t('col.date'), width: '12%' }, { label: t('col.change'), width: '22%' }, { label: t('col.details') }, { label: t('col.editedBy'), width: '18%' }], rows);
  };

  DK.detail = detail;
})(window.DK);
