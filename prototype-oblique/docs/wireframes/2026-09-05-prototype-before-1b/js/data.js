/* data.js – loads the static JSON files and answers all model questions
   (lookups, grouping, relations, search). No DOM access. */
(function (DK) {
  'use strict';

  const ui = DK.ui;
  const t = (k, p) => DK.ui.t(k, p);

  const FILES = {
    config: 'config.json', i18n: 'i18n.json', model: 'model.json',
    domains: 'domains.json', systems: 'systems.json', objects: 'objects.json', tables: 'tables.json',
    refs: 'codelists.json', products: 'products.json', apis: 'apis.json',
    changelog: 'changelog.json', manual: 'manual.json',
  };
  /** Entity kinds in canonical display order (also the URL section names). */
  const KINDS = ['domains', 'systems', 'objects', 'tables', 'refs', 'products', 'apis'];
  /** Embedded lists that must exist on every entity of a kind. */
  const LISTS = { objects: ['attributes', 'termdat'], tables: ['fields'], refs: ['values'], products: ['attributes', 'basedOn', 'sourcedFrom', 'servedBy'] };

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
    KINDS.forEach(kind => {
      if (!Array.isArray(data[kind])) data[kind] = [];
      data[kind].forEach(e => (LISTS[kind] || []).forEach(list => { if (!Array.isArray(e[list])) e[list] = []; }));
      index[kind] = new Map(data[kind].map(e => [e.identifier, e]));
    });
    data.validate();
  };

  /** Report dangling cross-references once. The UI tolerates them, but the content should be fixed. */
  data.validate = function () {
    const problems = [];
    const check = (kind, e, field, refKind, id) => { if (id && !index[refKind].has(id)) problems.push(`${kind}:${e.identifier}.${field} → ${refKind}:${id} not found`); };
    data.objects.forEach(o => check('objects', o, 'domain', 'domains', o.domain));
    data.tables.forEach(x => { check('tables', x, 'realizes', 'objects', x.realizes); check('tables', x, 'system', 'systems', x.system); });
    data.refs.forEach(r => check('refs', r, 'businessObject', 'objects', r.businessObject));
    data.products.forEach(p => {
      check('products', p, 'domain', 'domains', p.domain);
      p.basedOn.forEach(id => check('products', p, 'basedOn', 'objects', id));
      p.sourcedFrom.forEach(id => check('products', p, 'sourcedFrom', 'tables', id));
      p.servedBy.forEach(id => check('products', p, 'servedBy', 'apis', id));
    });
    data.apis.forEach(a => { check('apis', a, 'domain', 'domains', a.domain); check('apis', a, 'system', 'systems', a.system); });
    if (problems.length) console.warn('Datenkatalog: inconsistent references\n' + problems.join('\n'));
    return problems;
  };

  /* ---- lookups ----------------------------------------------------------- */
  data.list = kind => data[kind] || [];
  data.kindDef = kind => data.model.kinds[kind];
  /** Kinds counted as catalog content (everything except the containers domains/systems). */
  data.contentKinds = () => data.model.navModels.entity;
  data.get = function (kind, id) {
    if (kind === 'attrs') return data.attr(id);
    const m = index[kind];
    return (m && m.get(id)) || null;
  };
  /** Display name of a referenced entity; falls back to the id when the reference dangles. */
  data.nameOf = function (kind, id) {
    const e = data.get(kind, id);
    return e ? e.name : (id || '–');
  };
  /** Name as shown in lists, crumbs and links (tables carry the technical name, APIs the version). */
  data.displayName = function (kind, e) {
    if (kind === 'tables') return `${e.name} (${e.technicalName})`;
    if (kind === 'apis') return `${e.name} ${e.version}`;
    return e.name;
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
  data.custodianOf = function (kind, e) {
    if (kind === 'systems') return e.dataCustodian || '';
    if (kind === 'tables') {
      const system = data.sysOf(e.system);
      return e.dataCustodian || (system && system.dataCustodian) || '';
    }
    return '';
  };

  /** The business object an entity realises / types / belongs to (null for domains, systems, products, APIs). */
  data.objectForEntity = function (kind, e) {
    if (kind === 'objects') return e;
    if (kind === 'tables') return data.objOf(e.realizes);
    if (kind === 'refs') return data.objOf(e.businessObject);
    if (kind === 'attrs') return data.objOf(e.object);
    return null;
  };
  /** The domain an entity belongs to (null for systems and for dangling references). */
  data.domainForEntity = function (kind, e) {
    if (kind === 'domains') return e;
    if (kind === 'systems') return null;
    const o = data.objectForEntity(kind, e);
    return data.domainOf(o ? o.domain : e.domain);
  };

  data.membersOfDomain = (kind, d) => data.list(kind).filter(e => data.domainForEntity(kind, e) === d);
  data.objectsOfDomain = d => data.membersOfDomain('objects', d);
  data.tablesOfDomain = d => data.membersOfDomain('tables', d);
  data.refsOfDomain = d => data.membersOfDomain('refs', d);
  data.productsOfDomain = d => data.membersOfDomain('products', d);
  data.apisOfDomain = d => data.membersOfDomain('apis', d);
  data.tablesOfSystem = s => data.tables.filter(x => x.system === s.identifier);
  data.apisOfSystem = s => data.apis.filter(a => a.system === s.identifier);

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
  data.statusOf = (kind, e) => e.status || '';
  data.statusTone = st => ((data.model.statuses || {})[st] || {}).tone || 'neutral';

  data.navModel = function () {
    const m = data.navModelOverride || (data.config && data.config.navModel) || 'entity';
    return data.model.navModels[m] ? m : 'entity';
  };
  data.sections = () => data.model.navModels[data.navModel()];

  /* ---- list presentation ------------------------------------------------- */
  /** Table cells [col2, description, col4] of a section row; the status column is added by the view. */
  data.cols = function (kind, e) {
    switch (kind) {
      case 'objects': return [e.responsibleOrg, e.description, String(e.attributes.length)];
      case 'tables': return [data.nameOf('systems', e.system), e.description, String(e.fields.length)];
      case 'domains': return [e.responsibleOrg, e.description, String(data.objectsOfDomain(e).length)];
      case 'systems': return [e.technology, e.description, String(data.tablesOfSystem(e).length)];
      case 'products': return [e.accessRights, e.description, e.format];
      case 'apis': return [`${data.nameOf('systems', e.system)} · ${e.version}`, e.description, e.protocol];
      default: return [e.sourceAuthority, e.description, e.values.length ? String(e.values.length) : '–'];
    }
  };
  /** Table columns per section (list view). */
  data.columns = function (kind) {
    const c = (label, width) => ({ label: t(label), width });
    switch (kind) {
      case 'objects': return [c('col.name', '20%'), c('col.responsibility', '25%'), c('col.description'), c('col.attributes', '11%'), c('col.status', '11%')];
      case 'tables': return [c('col.name', '18%'), c('col.system', '18%'), c('col.description'), c('col.fields', '9%'), c('col.status', '14%')];
      case 'domains': return [c('col.domain', '18%'), c('col.responsibility', '18%'), c('col.description'), c('col.object', '12%'), c('col.status', '12%')];
      case 'systems': return [c('col.system', '18%'), c('col.technology', '18%'), c('col.description'), c('col.tables', '12%'), c('col.status', '12%')];
      case 'products': return [c('col.product', '18%'), c('col.access', '16%'), c('col.description'), c('col.format', '14%'), c('col.status', '12%')];
      case 'apis': return [c('col.api', '18%'), c('col.systemVersion', '16%'), c('col.description'), c('col.protocol', '16%'), c('col.status', '12%')];
      default: return [c('col.name', '20%'), c('col.source', '14%'), c('col.description'), c('col.values', '9%'), c('col.status', '12%')];
    }
  };
  /** Search result columns: the list columns without the count column. */
  data.searchColumns = function (kind) {
    const cols = data.columns(kind);
    return [{ label: t('col.name'), width: '24%' }, { label: cols[1].label, width: '22%' }, { label: t('col.description') }, { label: cols[4].label, width: '14%' }];
  };

  /* ---- grouping ---------------------------------------------------------- */
  const GROUP_IDS = {
    objects: ['none', 'domain', 'resp', 'status'],
    tables: ['none', 'system', 'domain', 'status'],
    refs: ['none', 'domain', 'status'],
    products: ['none', 'domain', 'access', 'status'],
    apis: ['none', 'domain', 'system', 'status'],
    domains: ['none', 'resp'],
    systems: ['none', 'resp'],
  };
  data.defaultGroup = function (kind) {
    if (kind === 'objects') return data.config.defaultGrouping || 'domain';
    return { tables: 'system', refs: 'domain' }[kind] || 'none';
  };
  data.groupOptions = function (kind) {
    return (GROUP_IDS[kind] || []).map(id => ({ id, label: t('group.' + id) }));
  };
  /** The container entity a grouping refers to ({ kind, entity }), or null for value groupings. */
  data.groupEntity = function (kind, e, g) {
    if (g === 'domain') return { kind: 'domains', entity: data.domainForEntity(kind, e) };
    if (g === 'system') return { kind: 'systems', entity: data.sysOf(e.system) };
    return null;
  };
  data.groupKey = function (kind, e, g) {
    const ref = data.groupEntity(kind, e, g);
    if (ref) return ref.entity ? ref.entity.name : '–';
    if (g === 'resp') return e.responsibleOrg || '–';
    if (g === 'status') return data.statusOf(kind, e) || '–';
    if (g === 'source') return e.sourceAuthority || '–';
    if (g === 'access') return e.accessRights || '–';
    return t('group.all', { what: data.kindDef(kind).plural });
  };
  data.groupOrder = function (g) {
    if (g === 'domain') return data.domains.map(d => d.name);
    if (g === 'resp') return data.model.responsibilities;
    if (g === 'system') return data.systems.map(s => s.name);
    if (g === 'source') return data.model.sourceAuthorities;
    if (g === 'access') return data.model.accessOrder;
    if (g === 'status') return Object.keys(data.model.statuses);
    return [];
  };
  /** Groups [{ id, title, items, entityKind, entity }] of a section, in canonical order. */
  data.buildGroups = function (kind, g, sortByName) {
    const order = data.groupOrder(g);
    const map = new Map();
    data.list(kind).forEach(e => {
      const ref = data.groupEntity(kind, e, g);
      const entity = ref ? ref.entity : null;
      const title = data.groupKey(kind, e, g);
      const id = `${kind}:${g}:${entity ? entity.identifier : title}`;
      if (!map.has(id)) map.set(id, { id, title, items: [], entityKind: ref ? ref.kind : null, entity });
      map.get(id).items.push(e);
    });
    const rank = title => { const i = order.indexOf(title); return i < 0 ? 1e6 : i; };
    const groups = [...map.values()].sort((a, b) => rank(a.title) - rank(b.title));
    if (sortByName) groups.forEach(group => group.items.sort((a, b) => a.name.localeCompare(b.name, 'de')));
    return groups;
  };

  /* ---- relations ----------------------------------------------------------- */
  data.termsOf = o => o.termdat.map(tm => ({ name: tm.name, sub: 'TERMDAT ' + tm.id, href: tm.url, external: true }));
  data.relations = function (kind, e) {
    const href = (k, id) => DK.router.entityHref(k, id);
    const link = {
      tables: x => ({ name: data.displayName('tables', x), sub: data.nameOf('systems', x.system), href: href('tables', x.identifier) }),
      refs: r => ({ name: r.name, sub: r.sourceAuthority, href: href('refs', r.identifier) }),
      objects: o => ({ name: o.name, sub: `${o.attributes.length} ${t('unit.attributes')}`, href: href('objects', o.identifier) }),
      domains: d => ({ name: d.name, sub: d.responsibleOrg, href: href('domains', d.identifier) }),
      systems: s => ({ name: s.name, sub: s.technology, href: href('systems', s.identifier) }),
      products: p => ({ name: p.name, sub: p.accessRights, href: href('products', p.identifier) }),
      apis: a => ({ name: data.displayName('apis', a), sub: a.protocol, href: href('apis', a.identifier) }),
    };
    /** Relation group of entities of kind `k` (dangling references are dropped). */
    const mk = (key, icon, k, entities) => ({ key, title: t('rel.' + key), icon, items: entities.filter(Boolean).map(link[k]) });
    const byIds = (k, ids) => [...new Set(ids)].map(id => data.get(k, id));

    if (kind === 'domains') {
      const tables = data.tablesOfDomain(e);
      return [
        mk('productsOfDomain', 'briefcase', 'products', data.productsOfDomain(e)),
        mk('apisOfDomain', 'branch', 'apis', data.apisOfDomain(e)),
        mk('tablesOfDomain', 'database', 'tables', tables),
        mk('codelistsOfDomain', 'file_list', 'refs', data.refsOfDomain(e)),
        mk('systemsInvolved', 'apps', 'systems', byIds('systems', tables.map(x => x.system))),
      ];
    }
    if (kind === 'systems') {
      const objs = byIds('objects', data.tablesOfSystem(e).map(x => x.realizes)).filter(Boolean);
      return [
        mk('realizedObjects', 'stack', 'objects', objs),
        mk('providedApis', 'branch', 'apis', data.apisOfSystem(e)),
        mk('domains', 'folder', 'domains', byIds('domains', objs.map(o => o.domain))),
      ];
    }
    if (kind === 'products') {
      return [
        mk('basedOn', 'stack', 'objects', byIds('objects', e.basedOn)),
        mk('sourcedFrom', 'database', 'tables', byIds('tables', e.sourcedFrom)),
        mk('servedBy', 'branch', 'apis', byIds('apis', e.servedBy)),
      ];
    }
    if (kind === 'apis') {
      return [
        mk('serves', 'briefcase', 'products', data.products.filter(p => p.servedBy.includes(e.identifier))),
        mk('sourceSystem', 'apps', 'systems', [data.sysOf(e.system)]),
      ];
    }
    if (kind === 'attrs') {
      const o = data.objOf(e.object);
      const fieldName = ui.fieldName(e.name);
      const relTables = data.tables.filter(x => x.realizes === o.identifier && x.fields.some(f => f.name === fieldName));
      const relRefs = e.valueType === 'Code' ? data.refs.filter(r => r.businessObject === o.identifier) : [];
      const stem = e.name.toLowerCase().split(/[ -]/)[0];
      return [
        mk('object', 'stack', 'objects', [o]),
        { key: 'realizedInFields', title: t('rel.realizedInFields'), icon: 'database', items: relTables.map(x => ({ name: `${fieldName} in ${x.technicalName}`, sub: data.nameOf('systems', x.system), href: href('tables', x.identifier) })) },
        mk('typedBy', 'file_list', 'refs', relRefs),
        { key: 'termdat', title: t('rel.termdat'), icon: 'tag', items: data.termsOf(o).filter(tm => tm.name.toLowerCase().includes(stem)) },
      ];
    }
    // objects, tables, refs
    const o = data.objectForEntity(kind, e);
    if (!o) return [];
    const relTables = data.tables.filter(x => x.realizes === o.identifier && !(kind === 'tables' && x.identifier === e.identifier));
    const relRefs = data.refs.filter(r => r.businessObject === o.identifier && !(kind === 'refs' && r.identifier === e.identifier));
    const rels = [
      mk('realizedInTables', 'database', 'tables', relTables),
      mk('usesCodelists', 'file_list', 'refs', relRefs),
      mk('usedInProducts', 'briefcase', 'products', data.products.filter(p => p.basedOn.includes(o.identifier))),
      { key: 'termdat', title: t('rel.termdat'), icon: 'tag', items: data.termsOf(o) },
    ];
    if (kind !== 'objects') rels.splice(2, 0, mk('object', 'stack', 'objects', [o]));
    return rels;
  };

  /* ---- search --------------------------------------------------------------- */
  /* Matching is case-insensitive and tolerant of umlaut spellings: "Gebäude" is found by
     "gebäu", "gebau" and "gebaeu". Two foldings are tried: diacritics stripped (keeps the
     string length, used for highlighting too) and ä→ae / ö→oe / ü→ue / ß→ss. */
  const foldMarks = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const foldUmlauts = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const WORD_BOUNDARY = /[\s\-–—(/.,:;«»"']/;
  /** First occurrence of `q` in `text` under either folding: { index, folded } or null. */
  const find = (text, q) => {
    if (!text) return null;
    for (const fold of [foldMarks, foldUmlauts]) {
      const folded = fold(text), index = folded.indexOf(fold(q));
      if (index >= 0) return { index, folded };
    }
    return null;
  };
  const atWordStart = hit => hit.index === 0 || WORD_BOUNDARY.test(hit.folded[hit.index - 1]);
  /** Relevance of an entity for a query (0 = no match). Name hits outrank technical-name hits, which outrank description hits. */
  data.relevance = function (e, q) {
    let hit = find(e.name, q);
    if (hit) return hit.folded.length === foldMarks(q).length || hit.folded === foldUmlauts(q) ? 100 : hit.index === 0 ? 90 : atWordStart(hit) ? 80 : 70;
    hit = find(e.technicalName, q);
    if (hit) return atWordStart(hit) ? 50 : 40;
    hit = find(e.description, q);
    if (hit) return atWordStart(hit) ? 20 : 10;
    return 0;
  };
  data.match = (e, q) => data.relevance(e, q) > 0;
  /** One result group: items by relevance, then shorter names first, then alphabetical. */
  const resultGroup = (kind, q, limit) => {
    const ranked = data.list(kind).map(e => ({ e, score: data.relevance(e, q) })).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name, 'de'));
    const items = (limit ? ranked.slice(0, limit) : ranked).map(x => x.e);
    return { kind, title: data.kindDef(kind).plural, icon: data.kindDef(kind).icon, items, total: ranked.length, best: ranked.length ? ranked[0].score : 0 };
  };
  /** Groups with the best hit first; ties follow the content order (business objects before the tables that realise them), containers last. */
  const SEARCH_ORDER = ['objects', 'tables', 'refs', 'products', 'apis', 'domains', 'systems'];
  const byRelevance = (a, b) => b.best - a.best || SEARCH_ORDER.indexOf(a.kind) - SEARCH_ORDER.indexOf(b.kind);
  /** Full result groups for the search page. */
  data.search = function (query) {
    const q = (query || '').trim();
    if (!q) return [];
    return KINDS.map(kind => resultGroup(kind, q)).filter(g => g.items.length).sort(byRelevance);
  };
  /** Suggestion groups: same ranking, at most 4 per kind. */
  data.suggest = function (query) {
    const q = (query || '').trim();
    if (!q) return [];
    return KINDS.map(kind => resultGroup(kind, q, 4)).filter(g => g.items.length).sort(byRelevance);
  };

  /* ---- home ----------------------------------------------------------------- */
  data.recent = function (n) {
    const feed = [];
    KINDS.forEach(kind => data.list(kind).forEach(e => {
      const dom = data.domainForEntity(kind, e);
      feed.push({ kind, id: e.identifier, name: data.displayName(kind, e), kindLabel: data.kindDef(kind).singular, group: dom ? dom.name : '–', status: data.statusOf(kind, e), modified: e.modified || '', href: DK.router.entityHref(kind, e.identifier) });
    }));
    return feed.sort((a, b) => (b.modified > a.modified ? 1 : b.modified < a.modified ? -1 : a.name.localeCompare(b.name, 'de'))).slice(0, n);
  };
  data.kpis = () => data.contentKinds().map(kind => {
    const def = data.kindDef(kind);
    return { kind, count: data.list(kind).length, label: def.plural, icon: def.icon, unit: t('unit.' + kind) };
  });

  /* ---- history ---------------------------------------------------------------- */
  data.history = function (kind, id) {
    const key = kind === 'attrs' ? 'objects:' + id.split('/')[0] : `${kind}:${id}`;
    return data.changelog.filter(h => h.entity === key).slice().sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  };

  DK.data = data;
})(window.DK);
