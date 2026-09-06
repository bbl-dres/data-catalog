/* Frozen, localized print content. Scope changes never read fresh catalog records. */
(function (DK) {
  'use strict';
  const { ui, data } = DK;
  const diagram = { templateVersion: '2.2', papers: { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] } };
  diagram.kinds = ['objects', 'tables', 'refs', 'products', 'apis'];
  diagram.columnKeys = ['name', 'code', 'type', 'required', 'key', 'codeList', 'description', 'unit', 'source', 'modified'];
  diagram.defaultColumns = diagram.columnKeys.slice(0, 7);
  diagram.classifications = ['public', 'internal', 'confidential', 'secret'];
  diagram.classification = value => ({ öffentlich: 'public', intern: 'internal', vertraulich: 'confidential', geheim: 'secret' }[value] || value || '');
  diagram.classificationLabel = (snapshot, value) => diagram.classifications.includes(diagram.classification(value))
    ? diagram.t(snapshot, 'print.classification.' + diagram.classification(value)) : value || '—';
  diagram.defaultLayout = kind => ['refs', 'apis'].includes(kind) ? 'list' : 'grid';
  diagram.gridKeys = kind => ({ objects: ['name', 'type', 'codeList'], refs: ['code', 'name'], apis: ['name', 'type', 'description'], products: ['name', 'type', 'description'] }[kind] || ['name', 'type', 'key']);
  const clone = value => JSON.parse(JSON.stringify(value));
  const translate = (dictionary, key, params = {}) => Object.entries(params).reduce((value, [name, replacement]) => value.split('{' + name + '}').join(replacement), dictionary[key] || key);
  diagram.t = (snapshot, key, params) => translate(snapshot.dictionary, key, params);
  const identity = entity => ({ id: entity.identifier, uuid: entity._record?.id || entity.id || null, revision: entity._record?.row_version ?? entity.row_version ?? null });
  const ref = (kind, id) => { const entity = data.get(kind, id); return entity ? { id, title: entity.name } : { id: '', title: ui.t('diagram.unspecified') }; };

  function rowContent(kind, row, index) {
    const name = ui.localized(row.labels) || row.name || row.label || (kind === 'apis' ? row.url : '') || row.identifier || row.code || row.technicalName || '';
    const code = row.technicalName ?? row.code ?? (kind === 'apis' ? row.operation_name : '') ?? '';
    const operation = kind === 'apis' ? [row.operation_name, row.http_method, row.relative_path].filter(Boolean).join(' · ') : '';
    return { ...identity(row), id: row.identifier || row.technicalName || row.code || String(index),
      name: kind === 'tables' ? data.displayName('fields', row) : kind === 'refs' && code && code !== name ? `${name} (${code})` : name, label: name, code,
      type: row.dataType || row.valueType || row.protocol || '', description: [row.description || row.note || '', operation].filter(Boolean).join(' · '),
      key: kind === 'objects' ? (row.keyRole === 'PK' ? 'ID' : '') : row.keyRoles?.length
        ? row.keyRoles.filter(key => ['primary', 'foreign'].includes(key)).map(key => key === 'primary' ? 'PK' : 'FK').join(' ') : row.keyRole || '',
      required: typeof row.mandatory === 'boolean' ? row.mandatory : null,
      codeList: row.codeList ? data.nameOf('refs', row.codeList) : '', unit: [row.length, row.unit].filter(value => value !== undefined && value !== null && value !== '').join(' / '),
      source: row.source || '', modified: row.modified || '',
    };
  }
  function entityContent(kind, entity) {
    const domain = data.domainForEntity(kind, entity), system = data.sysOf(entity.system);
    const facetValues = { domain: ref('domains', domain?.identifier), system: ref('systems', entity.system),
      businessObject: ref('objects', entity.realizes || entity.businessObject) };
    for (const [id, value] of Object.entries({ resp: entity.responsibleOrg, status: entity.status, classification: diagram.classification(entity.classification),
      source: entity.normReference || entity.source, access: entity.accessRights })) {
      const label = id === 'classification' && diagram.classifications.includes(value) ? ui.t('print.classification.' + value) : value;
      facetValues[id] = { id: value || '', title: label || ui.t('diagram.unspecified') };
    }
    let rows = kind === 'tables' ? entity.fields : kind === 'refs' ? entity.values : entity.attributes;
    if (kind === 'apis') rows = entity.endpoints?.length ? entity.endpoints : (entity.endpointURL ? [{ identifier: 'primary', url: entity.endpointURL, protocol: entity.protocol,
      operation_name: entity.operationName || entity.operation, http_method: entity.httpMethod, relative_path: entity.relativePath || entity.documentedPath }] : []);
    rows = (rows || []).map((row, index) => rowContent(kind, row, index));
    if (kind === 'products') for (const [relation, targetKind] of [['basedOn', 'objects'], ['sourcedFrom', 'tables'], ['servedBy', 'apis']]) {
      for (const id of new Set(entity[relation] || [])) {
        const target = data.get(targetKind, id), name = target ? data.displayName(targetKind, target) : id;
        rows.push({ id: `${relation}:${targetKind}:${id}`, label: name, name, code: target?.technicalName || '', type: ui.t('print.component.' + relation),
          description: target?.description || '', source: name, key: '', required: null, codeList: '', unit: '', modified: target?.modified || '' });
      }
    }
    return { ...identity(entity), name: data.displayName(kind, entity), label: ui.localized(entity.labels) || entity.name,
      tileSummary: data.tileSummary(kind, entity), statusTone: data.statusTone(entity.status),
      technicalName: entity.technicalName || '', description: entity.description || '', version: entity.version || '',
      versionDate: entity.versionDate || '', modified: entity.modified || '', status: entity.status || '', classification: diagram.classification(entity.classification),
      personalData: typeof entity.personalData === 'boolean' ? entity.personalData : null,
      businessObject: entity.realizes || entity.businessObject ? data.nameOf('objects', entity.realizes || entity.businessObject) : '',
      responsibility: entity.responsibleOrg || '', domain: domain?.name || '', system: system?.name || '',
      context: kind === 'tables' ? system?.name || '' : domain?.name || '', facetValues,
      rows,
    };
  }
  function content(kind, entries, language, title, filter = '', groupBy = data.defaultGroup(kind)) {
    const dictionary = Object.fromEntries(Object.keys(data.i18n).map(key => [key, ui.t(key)]));
    const entities = entries.map(e => entityContent(kind, e)).sort((a, b) => a.name.localeCompare(b.name, language, { numeric: true }) || a.id.localeCompare(b.id));
    const facetIds = ['domain', ...(kind === 'tables' || kind === 'apis' ? ['system'] : []), ...(kind === 'tables' || kind === 'refs' ? ['businessObject'] : []), 'status', 'resp', 'classification', 'source', ...(kind === 'products' ? ['access'] : [])];
    const grouping = id => {
      const groups = new Map();
      for (const entity of entities) {
        const value = entity.facetValues[id] || { id: 'none', title: '' };
        const key = `${kind}:${id}:${value.id}`;
        if (!groups.has(key)) groups.set(key, { id: key, title: value.title, value: value.id, entityIds: [] });
        groups.get(key).entityIds.push(entity.id);
      }
      const key = { classification: 'fact.classification', businessObject: 'col.object' }[id] || 'group.' + id;
      return { id, label: ui.t(key), groups: [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, language, { numeric: true })) };
    };
    const groupings = data.groupOptions(kind).map(option => ({ ...grouping(option.id), label: option.label }));
    const labels = Object.fromEntries(['continued', 'emptyFields', 'page', 'documentId', 'version', 'created', 'selection', 'legend', 'tooLong', 'noSelection', 'noFilterMatches', 'filters', 'scope', 'fieldCount'].map(key => [key, ui.t('diagram.' + key)]));
    Object.assign(labels, { name: ui.t(kind === 'tables' ? 'col.field' : kind === 'apis' ? 'print.endpoint' : kind === 'refs' || kind === 'products' ? 'col.name' : 'col.attribute'),
      type: ui.t(kind === 'tables' ? 'col.dataType' : kind === 'apis' ? 'print.protocol' : kind === 'products' ? 'col.type' : 'col.valueType'),
      key: ui.t('col.key'), code: ui.t('print.column.code'), codeList: ui.t('print.column.codeList'), description: ui.t('col.description') });
    return clone({ templateVersion: diagram.templateVersion, createdAt: new Date().toISOString(), language, dictionary,
      kind, title, scope: ui.t('print.kind.' + kind), filter, sourceUrl: window.location.href, creator: data.config.app.user?.name || data.config.app.user?.initials || '',
      organisation: data.config.app.organisation, application: data.config.app.name, labels, entities, groupings, facets: facetIds.map(grouping), defaultGroupBy: groupBy });
  }
  diagram.snapshot = (route, ctx, language) => ui.withLanguage(data.i18n, language, () => {
    const filter = ctx.isList || ['systems', 'domains'].includes(route.entity?.kind) ? ctx.filter || '' : '';
    let kind = ctx.kind, entries;
    if (route.entity?.kind === 'systems') { kind = 'tables'; entries = data.tablesOfSystem(route.entity).filter(e => data.matchesCollection(kind, e, filter)); }
    else if (route.entity?.kind === 'domains') { kind = 'objects'; entries = data.membersOfDomain(kind, route.entity).filter(e => data.matchesCollection(kind, e, filter)); }
    else if (ctx.isList) entries = ctx.groups.flatMap(group => group.items);
    else { kind = route.entity?.kind; entries = route.entity ? [route.entity] : []; }
    if (!diagram.kinds.includes(kind)) throw new Error(ui.t('diagram.unsupported'));
    const unique = [...new Map(entries.map(e => [e.identifier, e])).values()];
    return content(kind, unique, language, ctx.title, filter, ctx.groupBy || (ctx.isList ? data.defaultGroup(kind) : 'none'));
  });

  diagram.capture = (route, ctx, language) => {
    const createdAt = new Date().toISOString(), catalogs = {}, initial = diagram.snapshot(route, ctx, language);
    for (const lang of data.config.app.languages) catalogs[lang] = ui.withLanguage(data.i18n, lang, () => Object.fromEntries(diagram.kinds.map(kind => {
      const snapshot = content(kind, data.list(kind), lang, ui.t('print.kind.' + kind)); snapshot.createdAt = createdAt;
      return [kind, snapshot];
    })));
    const entity = route.entity;
    const scope = { kind: initial.kind, facet: '', value: '', entityId: '', initialIds: initial.entities.map(e => e.id), query: initial.filter };
    if (entity?.kind === 'systems') Object.assign(scope, { facet: 'system', value: entity.identifier });
    else if (entity?.kind === 'domains' || ctx.isList && route.params?.domain) Object.assign(scope, { facet: 'domain', value: entity?.identifier || route.params.domain });
    else if (entity && diagram.kinds.includes(entity.kind)) {
      scope.entityId = entity.identifier;
      scope.facet = entity.kind === 'tables' ? 'system' : 'domain';
      scope.value = initial.entities[0]?.facetValues[scope.facet]?.id || '';
    }
    return { catalogs, scope };
  };
  diagram.scoped = (catalogs, language, scope) => {
    const original = catalogs[language][scope.kind];
    const entities = original.entities.filter(e => (!scope.entityId || e.id === scope.entityId) && (!scope.facet || e.facetValues[scope.facet]?.id === scope.value)
      && (!scope.initialIds || scope.initialIds.includes(e.id)));
    const group = scope.facet ? original.facets.find(f => f.id === scope.facet)?.groups.find(g => g.value === scope.value) : null;
    const title = scope.entityId ? original.entities.find(e => e.id === scope.entityId)?.name : [original.scope, group?.title].filter(Boolean).join(' · ');
    const path = [original.scope, group?.title, scope.entityId ? original.entities.find(e => e.id === scope.entityId)?.name : ''].filter(Boolean);
    return { ...original, entities, title: title || original.title, filter: scope.query || '', scopeTitle: path.join(' › ') };
  };
  diagram.parentScope = scope => scope.entityId ? { kind: scope.kind, facet: scope.facet, value: scope.value, entityId: '' }
    : scope.facet ? { kind: scope.kind, facet: '', value: '', entityId: '' } : null;
  diagram.defaults = snapshot => ({ paper: 'A3', orientation: diagram.defaultLayout(snapshot.kind) === 'list' ? 'portrait' : 'landscape', scale: 100, layout: diagram.defaultLayout(snapshot.kind), title: snapshot.title, documentId: '', version: '',
    documentStatus: 'draft', classification: '', overview: 'auto', columns: [...diagram.defaultColumns], groupBy: snapshot.defaultGroupBy,
    filters: Object.fromEntries(snapshot.facets.map(facet => [facet.id, []])), selected: snapshot.entities.map(e => e.id) });
  diagram.filterValues = value => Array.isArray(value) ? value : value ? [value] : [];
  diagram.filteredEntities = (snapshot, settings) => {
    const filters = snapshot.facets.filter(facet => diagram.filterValues(settings.filters[facet.id]).length).map(facet => {
      const selected = new Set(diagram.filterValues(settings.filters[facet.id]));
      return new Set(facet.groups.filter(g => selected.has(g.id)).flatMap(g => g.entityIds));
    });
    return snapshot.entities.filter(entity => filters.every(ids => ids.has(entity.id)));
  };
  diagram.exportEntities = (snapshot, settings) => {
    const selected = new Set(settings.selected);
    return diagram.filteredEntities(snapshot, settings).filter(entity => selected.has(entity.id));
  };
  diagram.filterSummary = (snapshot, settings) => snapshot.facets.filter(f => diagram.filterValues(settings.filters[f.id]).length).map(f => {
    const selected = new Set(diagram.filterValues(settings.filters[f.id]));
    return `${f.label}: ${f.groups.filter(g => selected.has(g.id)).map(g => g.title).join(', ') || '—'}`;
  }).join(' · ');
  diagram.groups = (snapshot, groupBy, entities = snapshot.entities) => {
    if (groupBy === 'none') return [{ id: 'none', title: '', items: entities }];
    const grouping = snapshot.groupings.find(group => group.id === groupBy);
    if (!grouping) throw new Error('Invalid diagram grouping');
    return grouping.groups.map(group => ({ ...group, items: entities.filter(entity => group.entityIds.includes(entity.id)) })).filter(group => group.items.length);
  };
  DK.diagram = diagram;
})(window.DK);
