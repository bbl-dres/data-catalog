/* data.js – loads the static JSON files and answers all model questions
   (lookups, grouping, relations, search). No DOM access. */
(function (DK) {
  'use strict';

  const ui = DK.ui;
  const t = k => DK.ui.t(k);

  const FILES = {
    config: 'config.json', i18n: 'i18n.json', model: 'model.json',
    domains: 'domains.json', systems: 'systems.json', objects: 'objects.json', tables: 'tables.json',
    refs: 'codelists.json', products: 'products.json', apis: 'apis.json',
    changelog: 'changelog.json', manual: 'manual.json', apiDocs: 'api-docs.json',
  };
  const KINDS = ['domains', 'systems', 'objects', 'tables', 'refs', 'products', 'apis'];
  const ORDERED_KINDS = ['domains', 'systems', 'objects', 'tables', 'refs', 'products', 'apis'];

  const data = { kinds: KINDS, navModelOverride: null };
  const index = {};

  /* ---- loading ---------------------------------------------------------- */
  data.load = async function (base) {
    const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
      const res = await fetch(base + file, { cache: 'no-cache' });
      if (!res.ok) throw new Error(file + ' → HTTP ' + res.status);
      return [key, await res.json()];
    }));
    entries.forEach(([k, v]) => { data[k] = v; });
    KINDS.forEach(k => { index[k] = new Map(data[k].map(e => [e.identifier, e])); });
  };

  /* ---- lookups ----------------------------------------------------------- */
  data.list = kind => data[kind] || [];
  data.kindDef = kind => data.model.kinds[kind];
  data.get = function (kind, id) {
    if (kind === 'attrs') return data.attr(id);
    const m = index[kind];
    return m ? m.get(id) || null : null;
  };
  /** Attribute as a first-class entity: id = "<objectId>/<attributeId>". */
  data.attr = function (id) {
    const i = id.indexOf('/');
    if (i < 0) return null;
    const o = data.get('objects', id.slice(0, i));
    if (!o) return null;
    const a = o.attributes.find(x => x.identifier === id.slice(i + 1));
    if (!a) return null;
    return Object.assign({}, a, {
      identifier: id, attrId: a.identifier, object: o.identifier, domain: o.domain,
      status: o.status, normReference: o.normReference, responsibleOrg: o.responsibleOrg,
      dataOwner: o.dataOwner, dataSteward: o.dataSteward, classification: o.classification, personalData: o.personalData,
      version: o.version, created: o.created, modified: o.modified, source: o.source, sourceDetail: o.sourceDetail, synced: o.synced,
    });
  };
  data.domainOf = id => data.get('domains', id);
  data.objOf = id => data.get('objects', id);
  data.sysOf = id => data.get('systems', id);

  data.objectsOfDomain = d => data.objects.filter(o => o.domain === d.identifier);
  data.tablesOfDomain = d => data.tables.filter(x => data.objOf(x.realizes).domain === d.identifier);
  data.refsOfDomain = d => data.refs.filter(r => data.objOf(r.businessObject).domain === d.identifier);
  data.productsOfDomain = d => data.products.filter(p => p.domain === d.identifier);
  data.apisOfDomain = d => data.apis.filter(a => a.domain === d.identifier);
  data.tablesOfSystem = s => data.tables.filter(x => x.system === s.identifier);
  data.apisOfSystem = s => data.apis.filter(a => a.system === s.identifier);

  /** The domain an entity belongs to (null for systems). */
  data.domainForEntity = function (kind, e) {
    if (kind === 'domains') return e;
    if (kind === 'systems') return null;
    if (kind === 'tables') return data.domainOf(data.objOf(e.realizes).domain);
    if (kind === 'refs') return data.domainOf(data.objOf(e.businessObject).domain);
    return data.domainOf(e.domain); // objects, attrs, products, apis
  };
  /** The business object an entity realises / types / belongs to. */
  data.objectForEntity = function (kind, e) {
    if (kind === 'objects') return e;
    if (kind === 'tables') return data.objOf(e.realizes);
    if (kind === 'refs') return data.objOf(e.businessObject);
    if (kind === 'attrs') return data.objOf(e.object);
    return null;
  };

  data.sizeOf = function (kind, e) {
    switch (kind) {
      case 'objects': return e.attributes.length;
      case 'tables': return e.fields.length;
      case 'refs': return e.values.length;
      case 'products': return e.attributes.length;
      case 'domains': return data.objectsOfDomain(e).length;
      case 'systems': return data.tablesOfSystem(e).length;
      default: return 0;
    }
  };
  data.statusOf = (kind, e) => kind === 'tables' ? (e.certified ? 'Zertifiziert' : 'Nicht zertifiziert') : (e.status || '');
  data.statusTone = st => ((data.model.statuses || {})[st] || {}).tone || 'neutral';

  data.navModel = function () {
    const m = data.navModelOverride || (data.config && data.config.navModel) || 'entity';
    return data.model.navModels[m] ? m : 'entity';
  };
  data.sections = () => data.model.navModels[data.navModel()];

  /* ---- list presentation ------------------------------------------------- */
  /** Tile subtitle. */
  data.sub = function (kind, e) {
    const n = data.sizeOf(kind, e);
    switch (kind) {
      case 'objects': return `${e.responsibleOrg} · ${n} ${t('unit.attributes')}`;
      case 'tables': return `${e.technicalName} · ${n} ${t('unit.fields')}`;
      case 'domains': return `${e.responsibleOrg} · ${n} ${t('unit.objects')}`;
      case 'systems': return `${e.technology} · ${n} ${t('unit.tables')}`;
      case 'products': return `${e.accessRights} · ${e.format}`;
      case 'apis': return `${e.protocol} · ${e.version}`;
      default: return n ? `${n} ${t('unit.values')}` : t('fact.notCaptured');
    }
  };
  /** Table cells [col2, description, col4, (status fallback)]. */
  data.cols = function (kind, e) {
    switch (kind) {
      case 'objects': return [e.responsibleOrg, e.description, String(e.attributes.length)];
      case 'tables': return [`${data.sysOf(e.system).name} · ${e.technicalName}`, e.description, String(e.fields.length)];
      case 'domains': return [e.responsibleOrg, e.description, String(data.objectsOfDomain(e).length)];
      case 'systems': return [e.technology, e.description, String(data.tablesOfSystem(e).length)];
      case 'products': return [e.accessRights, e.description, e.format];
      case 'apis': return [`${data.sysOf(e.system).name} · ${e.version}`, e.description, e.protocol];
      default: return [e.sourceAuthority, e.description, e.values.length ? String(e.values.length) : '–'];
    }
  };
  /** Table columns per section (list view). */
  data.columns = function (kind) {
    const c = (label, width) => ({ label: t(label), width });
    switch (kind) {
      case 'objects': return [c('col.name', '18%'), c('col.responsibility', '20%'), c('col.description'), c('col.attributes', '10%'), c('col.status', '12%')];
      case 'tables': return [c('col.name', '18%'), c('col.systemTech', '22%'), c('col.description'), c('col.fields', '9%'), c('col.certification', '14%')];
      case 'domains': return [c('col.domain', '18%'), c('col.responsibility', '18%'), c('col.description'), c('col.object', '12%'), c('col.status', '12%')];
      case 'systems': return [c('col.system', '18%'), c('col.technology', '18%'), c('col.description'), c('col.tables', '12%'), c('col.status', '12%')];
      case 'products': return [c('col.product', '18%'), c('col.access', '16%'), c('col.description'), c('col.format', '14%'), c('col.status', '12%')];
      case 'apis': return [c('col.api', '18%'), c('col.systemVersion', '16%'), c('col.description'), c('col.protocol', '16%'), c('col.status', '12%')];
      default: return [c('col.name', '20%'), c('col.source', '14%'), c('col.description'), c('col.values', '9%'), c('col.status', '12%')];
    }
  };
  /** Search result columns (4 columns: name, col2, description, status). */
  data.searchColumns = function (kind) {
    const map = {
      products: ['col.access', 'col.status'], apis: ['col.systemVersion', 'col.status'], domains: ['col.responsibility', 'col.status'],
      systems: ['col.technology', 'col.status'], objects: ['col.responsibility', 'col.status'], tables: ['col.systemTech', 'col.certification'], refs: ['col.source', 'col.status'],
    }[kind];
    return [{ label: t('col.name'), width: '24%' }, { label: t(map[0]), width: '22%' }, { label: t('col.description') }, { label: t(map[1]), width: '14%' }];
  };

  /* ---- grouping ---------------------------------------------------------- */
  const GROUP_IDS = {
    objects: ['none', 'domain', 'resp', 'status'],
    tables: ['none', 'system', 'domain', 'cert'],
    refs: ['none', 'source', 'domain', 'status'],
    products: ['none', 'domain', 'access', 'status'],
    apis: ['none', 'domain', 'system', 'status'],
    domains: ['none', 'resp'],
    systems: ['none', 'resp'],
  };
  data.defaultGroup = function (kind) {
    if (kind === 'objects') return data.config.defaultGrouping || 'domain';
    return { tables: 'system', refs: 'source' }[kind] || 'none';
  };
  data.groupOptions = function (kind) {
    return (GROUP_IDS[kind] || []).map(id => {
      const n = data.buildGroups(kind, id).length;
      return { id, label: t('group.' + id), hint: id === 'none' ? DK.ui.t('group.all', { what: data.kindDef(kind).plural }) : (n === 1 ? t('unit.group') : DK.ui.t('unit.groups', { n })) };
    });
  };
  data.groupKey = function (kind, e, g) {
    if (!g || g === 'none') return DK.ui.t('group.all', { what: data.kindDef(kind).plural });
    if (g === 'domain') return data.domainForEntity(kind, e).name;
    if (g === 'resp') return e.responsibleOrg;
    if (g === 'status' || g === 'cert') return data.statusOf(kind, e);
    if (g === 'system') return data.sysOf(e.system).name;
    if (g === 'source') return e.sourceAuthority;
    if (g === 'access') return e.accessRights;
    return DK.ui.t('group.all', { what: data.kindDef(kind).plural });
  };
  data.groupOrder = function (g) {
    if (g === 'domain') return data.domains.map(d => d.name);
    if (g === 'resp') return data.model.responsibilities;
    if (g === 'system') return data.systems.map(s => s.name);
    if (g === 'source') return data.model.sourceAuthorities;
    if (g === 'access') return data.model.accessOrder;
    if (g === 'status' || g === 'cert') return Object.keys(data.model.statuses);
    return [];
  };
  /** Groups [{id, title, items}] of a section, in canonical order. */
  data.buildGroups = function (kind, g, sortByName) {
    const order = data.groupOrder(g);
    const map = new Map();
    data.list(kind).forEach(e => {
      const k = data.groupKey(kind, e, g);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    });
    const rank = k => { const i = order.indexOf(k); return i < 0 ? 1e6 : i; };
    const keys = [...map.keys()].sort((a, b) => rank(a) - rank(b));
    return keys.map(k => {
      const items = map.get(k).slice();
      if (sortByName) items.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      return { id: `${kind}:${g}:${k}`, title: k, items };
    });
  };

  /* ---- relations ----------------------------------------------------------- */
  data.termsOf = o => (o.termdat || []).map(tm => ({ name: tm.name, sub: 'TERMDAT ' + tm.id, href: tm.url, external: true }));
  data.relations = function (kind, e) {
    const href = (k, id) => DK.router.entityHref(k, id);
    const linkT = x => ({ name: `${x.name} (${x.technicalName})`, sub: data.sysOf(x.system).name, href: href('tables', x.identifier) });
    const linkR = r => ({ name: r.name, sub: r.sourceAuthority, href: href('refs', r.identifier) });
    const linkO = o => ({ name: o.name, sub: `${o.attributes.length} ${t('unit.attributes')}`, href: href('objects', o.identifier) });
    const linkD = d => ({ name: d.name, sub: d.responsibleOrg, href: href('domains', d.identifier) });
    const linkS = s => ({ name: s.name, sub: s.technology, href: href('systems', s.identifier) });
    const linkP = p => ({ name: p.name, sub: p.accessRights, href: href('products', p.identifier) });
    const linkA = a => ({ name: `${a.name} ${a.version}`, sub: a.protocol, href: href('apis', a.identifier) });
    const mk = (key, icon, items) => ({ key, title: t('rel.' + key), icon, items: items.filter(Boolean) });
    const uniq = arr => [...new Set(arr)];

    if (kind === 'domains') {
      const sysIds = uniq(data.tablesOfDomain(e).map(x => x.system));
      return [
        mk('productsOfDomain', 'briefcase', data.productsOfDomain(e).map(linkP)),
        mk('apisOfDomain', 'branch', data.apisOfDomain(e).map(linkA)),
        mk('tablesOfDomain', 'database', data.tablesOfDomain(e).map(linkT)),
        mk('codelistsOfDomain', 'file_list', data.refsOfDomain(e).map(linkR)),
        mk('systemsInvolved', 'apps', sysIds.map(id => linkS(data.sysOf(id)))),
      ];
    }
    if (kind === 'systems') {
      const objIds = uniq(data.tablesOfSystem(e).map(x => x.realizes));
      const domIds = uniq(objIds.map(id => data.objOf(id).domain));
      return [
        mk('realizedObjects', 'stack', objIds.map(id => linkO(data.objOf(id)))),
        mk('providedApis', 'branch', data.apisOfSystem(e).map(linkA)),
        mk('domains', 'folder', domIds.map(id => linkD(data.domainOf(id)))),
      ];
    }
    if (kind === 'products') {
      return [
        mk('basedOn', 'stack', e.basedOn.map(id => data.objOf(id)).filter(Boolean).map(linkO)),
        mk('sourcedFrom', 'database', e.sourcedFrom.map(id => data.get('tables', id)).filter(Boolean).map(linkT)),
        mk('servedBy', 'branch', e.servedBy.map(id => data.get('apis', id)).filter(Boolean).map(linkA)),
      ];
    }
    if (kind === 'apis') {
      return [
        mk('serves', 'briefcase', data.products.filter(p => p.servedBy.includes(e.identifier)).map(linkP)),
        mk('sourceSystem', 'apps', [linkS(data.sysOf(e.system))]),
      ];
    }
    if (kind === 'attrs') {
      const o = data.objOf(e.object);
      const fieldName = e.name.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      const relTables = data.tables.filter(x => x.realizes === o.identifier && x.fields.some(f => f.name === fieldName));
      const relRefs = e.valueType === 'Code' ? data.refs.filter(r => r.businessObject === o.identifier) : [];
      const stem = e.name.toLowerCase().split(/[ -]/)[0];
      return [
        mk('object', 'stack', [linkO(o)]),
        mk('realizedInFields', 'database', relTables.map(x => ({ name: `${fieldName} in ${x.technicalName}`, sub: data.sysOf(x.system).name, href: href('tables', x.identifier) }))),
        mk('typedBy', 'file_list', relRefs.map(linkR)),
        mk('termdat', 'tag', data.termsOf(o).filter(tm => tm.name.toLowerCase().includes(stem))),
      ];
    }
    // objects, tables, refs
    const o = data.objectForEntity(kind, e);
    const relTables = data.tables.filter(x => x.realizes === o.identifier && !(kind === 'tables' && x.identifier === e.identifier));
    const relRefs = data.refs.filter(r => r.businessObject === o.identifier && !(kind === 'refs' && r.identifier === e.identifier));
    const rels = [
      mk('realizedInTables', 'database', relTables.map(linkT)),
      mk('usesCodelists', 'file_list', relRefs.map(linkR)),
      mk('usedInProducts', 'briefcase', data.products.filter(p => p.basedOn.includes(o.identifier)).map(linkP)),
      mk('termdat', 'tag', data.termsOf(o)),
    ];
    if (kind !== 'objects') rels.splice(2, 0, mk('object', 'stack', [linkO(o)]));
    return rels;
  };

  /* ---- search --------------------------------------------------------------- */
  data.match = function (e, q) {
    return !!q && (e.name.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q) || (e.technicalName || '').toLowerCase().includes(q));
  };
  /** Full result groups for the search page. */
  data.search = function (query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    return ORDERED_KINDS.map(kind => ({ kind, title: data.kindDef(kind).plural, icon: data.kindDef(kind).icon, items: data.list(kind).filter(e => data.match(e, q)) })).filter(g => g.items.length);
  };
  /** Suggestion groups: name-first ranking, at most 4 per kind. */
  data.suggest = function (query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const rank = e => e.name.toLowerCase().startsWith(q) ? 0 : e.name.toLowerCase().includes(q) ? 1 : 2;
    return ORDERED_KINDS.map(kind => ({
      kind, title: data.kindDef(kind).plural, icon: data.kindDef(kind).icon,
      items: data.list(kind).filter(e => data.match(e, q)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'de')).slice(0, 4),
    })).filter(g => g.items.length);
  };

  /* ---- home ----------------------------------------------------------------- */
  data.recent = function (n) {
    const feed = [];
    ORDERED_KINDS.forEach(kind => data.list(kind).forEach(e => {
      const dom = data.domainForEntity(kind, e);
      const name = kind === 'tables' ? `${e.name} (${e.technicalName})` : kind === 'apis' ? `${e.name} ${e.version}` : e.name;
      feed.push({ kind, id: e.identifier, name, kindLabel: data.kindDef(kind).singular, group: dom ? dom.name : '–', status: data.statusOf(kind, e), modified: e.modified, href: DK.router.entityHref(kind, e.identifier) });
    }));
    return feed.sort((a, b) => (b.modified > a.modified ? 1 : b.modified < a.modified ? -1 : a.name.localeCompare(b.name, 'de'))).slice(0, n);
  };
  data.kpis = function () {
    const T = DK.ui.t;
    const count = (list, f) => list.filter(f).length;
    const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
    const O = data.objects, Tb = data.tables, R = data.refs, P = data.products, A = data.apis;
    return [
      { kind: 'objects', count: O.length, sub: `${sum(O, o => o.attributes.length)} ${T('unit.attributes')} · ${count(O, o => o.status === 'Gültig')} ${T('kpi.valid')} · ${count(O, o => o.status === 'Entwurf')} ${T('kpi.draft')}` },
      { kind: 'tables', count: Tb.length, sub: `${sum(Tb, x => x.fields.length)} ${T('unit.fields')} · ${count(Tb, x => x.certified)} ${T('kpi.certified')} · ${count(Tb, x => !x.certified)} ${T('kpi.notCertified')}` },
      { kind: 'refs', count: R.length, sub: `${sum(R, r => r.values.length)} ${T('unit.values')} · ${count(R, r => !r.values.length)} ${T('kpi.notCaptured')}` },
      { kind: 'products', count: P.length, sub: `${count(P, p => p.accessRights === 'öffentlich')} ${T('kpi.public')} · ${count(P, p => p.status === 'Gültig')} ${T('kpi.valid')} · ${count(P, p => p.status === 'Entwurf')} ${T('kpi.draft')}` },
      { kind: 'apis', count: A.length, sub: `${count(A, a => a.accessRights === 'öffentlich')} ${T('kpi.public')} · ${count(A, a => a.status === 'Gültig')} ${T('kpi.valid')} · ${count(A, a => a.status === 'Entwurf')} ${T('kpi.draft')}` },
    ].map(k => Object.assign(k, { label: data.kindDef(k.kind).plural, icon: data.kindDef(k.kind).icon, unit: T('unit.' + (k.kind === 'refs' ? 'codelists' : k.kind)) }));
  };

  /* ---- history ---------------------------------------------------------------- */
  data.history = function (kind, id) {
    const key = kind === 'attrs' ? 'objects:' + id.split('/')[0] : `${kind}:${id}`;
    return data.changelog.filter(h => h.entity === key).slice().sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  };

  DK.data = data;
})(window.DK);
