/* Shared field definitions and browser-only visibility preferences. */
(function (DK) {
  'use strict';
  const { ui, data } = DK;
  const t = ui.t, empty = value => value == null || value === '' || Array.isArray(value) && !value.length;
  const field = (id, label, read, type = 'text', extra = {}) => ({ id, label, read, type, ...extra });
  const property = (id, label, type, extra) => field(id, label, e => e[id], type, extra);
  const record = (id, label, column) => field(id, label, e => e._record?.[column]);
  const shared = [
    property('description', 'col.description', 'long'), property('status', 'col.status', 'status'),
    property('responsibleOrg', 'col.responsibility'),
    field('dataOwner', 'detail.owner', e => e.dataOwner?.name || e.dataOwner),
    field('dataSteward', 'detail.steward', e => e.dataSteward?.name || e.dataSteward),
    field('dataCustodian', 'detail.dataCustodian', (e, kind) => { const a = kind === 'fields' && !e.table ? e.dataCustodian : data.custodianOf(kind, e); return a?.name || a; }),
    property('identifier', 'fact.identifier'), field('version', 'fact.version', (e, kind) => kind === 'apis' ? e._record?.version : e.version),
    property('versionDate', 'visibility.versionDate', 'date'), property('created', 'fact.created', 'date'), property('modified', 'fact.modified', 'date'),
    property('comment', 'fact.comment', 'long'), property('informationUrls', 'fact.moreInformation', 'links'),
    property('classification', 'fact.classification'), property('personalData', 'fact.personalData', 'boolean'),
    field('domain', 'fact.domain', (e, kind) => data.domainForEntity(kind, e)?.name),
    field('system', 'fact.system', e => e.system ? data.nameOf('systems', e.system) : null), property('normReference', 'fact.normReference'),
    field('systemOfRecord', 'fact.systemOfRecord', e => data.systemOfRecordOf(e)?.name, 'text', { href: e => {
      const system = data.systemOfRecordOf(e);
      return system && !system._record?.is_archived ? DK.router.entityHref('systems', system.identifier) : null;
    } }),
  ];
  const byId = Object.fromEntries(shared.map(f => [f.id, f]));
  const metadata = ['identifier', 'version', 'versionDate', 'created', 'modified', 'comment', 'informationUrls'];
  const responsibility = ['responsibleOrg', 'dataOwner', 'dataSteward'];
  const protection = ['classification', 'personalData'];
  const count = (id, label, kind) => field(id, label, e => data.sizeOf(kind, e), 'number');
  const custom = {
    objects: [count('attributeCount', 'col.attributes', 'objects')],
    tables: [field('sortOrder', 'excel.sortOrder', e => e._record?.sort_order ?? e.sortOrder ?? null, 'number'), field('accessOptions', 'access.title', (e, kind) => DK.accessOptions?.summary(e, kind), 'long'), count('fieldCount', 'col.fields', 'tables'), field('businessObject', 'fact.realizes', e => e.realizes ? data.nameOf('objects', e.realizes) : null),
      record('databaseName', 'visibility.database', 'database_name'), record('schemaName', 'visibility.schema', 'schema_name')],
    domains: [count('objectCount', 'col.object', 'domains'), field('parentDomain', 'visibility.parentDomain', e => e._record?.parent_domain_id ? data.domains.find(d => d._record?.id === e._record.parent_domain_id)?.name : null)],
    systems: [property('technology', 'fact.technology'), count('tableCount', 'col.tables', 'systems'), record('systemType', 'visibility.systemType', 'system_type'), field('apiCount', 'unit.apis', e => data.apisOfSystem(e).length, 'number')],
    refs: [count('valueCount', 'col.values', 'refs'), field('businessObject', 'fact.object', e => e.businessObject ? data.nameOf('objects', e.businessObject) : null)],
    products: [field('accessOptions', 'access.title', (e, kind) => DK.accessOptions?.summary(e, kind), 'long'), property('accessRights', 'fact.access'), property('format', 'fact.format'), count('attributeCount', 'col.attributes', 'products'),
      property('accrualPeriodicity', 'fact.refresh'), property('license', 'fact.license'), field('landingPage', 'visibility.landingPage', e => e._record?.landing_page_url ? [e._record.landing_page_url] : [], 'links')],
    apis: [field('accessOptions', 'access.title', (e, kind) => DK.accessOptions?.summary(e, kind), 'long'), field('serviceVersion', 'visibility.serviceVersion', e => data.serviceVersionOf(e)), property('protocol', 'fact.protocol'), property('accessRights', 'fact.access'),
      property('endpointURL', 'fact.baseUrl'), field('documentation', 'fact.documentation', e => e.documentation ? [e.documentation] : [], 'links'), field('endpointCount', 'visibility.endpoints', e => e.endpoints?.length ?? (e.endpointURL ? 1 : 0), 'number')],
  };
  const defaults = {
    objects: ['name', 'responsibleOrg', 'description', 'attributeCount', 'status'],
    tables: ['name', 'system', 'description', 'fieldCount', 'status'],
    domains: ['name', 'responsibleOrg', 'description', 'objectCount', 'status'],
    systems: ['name', 'technology', 'description', 'tableCount', 'apiCount', 'status'],
    refs: ['name', 'normReference', 'description', 'valueCount', 'status'],
    products: ['name', 'accessRights', 'description', 'format', 'attributeCount', 'status'],
    apis: ['name', 'system', 'serviceVersion', 'description', 'protocol', 'endpointCount', 'status'],
    attrs: ['propertyGroup', 'name', 'type', 'key', 'codeList', 'status'],
    fields: ['propertyGroup', 'name', 'code', 'type', 'key', 'codeList', 'status'],
    values: ['code', 'name'], productAttrs: ['name', 'description', 'type'], endpoints: ['name', 'type', 'description'],
    history: ['date', 'action', 'detail', 'user'],
  };
  const extras = {
    objects: ['domain', 'systemOfRecord', 'normReference', ...responsibility, ...protection],
    tables: ['domain', ...responsibility, 'dataCustodian', ...protection],
    domains: responsibility, systems: [...responsibility, 'dataCustodian', ...protection],
    refs: ['domain', 'responsibleOrg'], products: ['domain', ...responsibility, ...protection],
    apis: ['domain', ...responsibility, 'dataCustodian', ...protection],
  };
  const childOf = { objects: 'attrs', tables: 'fields', refs: 'values', products: 'productAttrs', apis: 'fields', systems: 'tables' };
  const nameLabels = Object.fromEntries(Object.keys(defaults).map(kind => [kind, kind === 'endpoints' ? 'visibility.endpoint' : 'col.name']));
  const rowFields = kind => [
    field('sortOrder', 'excel.sortOrder', e => e._record?.sort_order ?? e.sort_order ?? e.sortOrder ?? null, 'number'),
    field('propertyGroup', 'fact.propertyGroup', e => e._record?.property_group ?? e.propertyGroup ?? null),
    field('code', kind === 'fields' ? 'fact.technicalName' : 'print.column.code', e => e.technicalName ?? e.code ?? e.operation_name, 'text', kind === 'fields' ? { href: e => e.table ? DK.router.entityHref('fields', e.identifier) : null } : {}),
    field('type', kind === 'fields' ? 'col.dataType' : kind === 'endpoints' ? 'fact.protocol' : 'col.valueType', e => e.dataType || e.valueType || e.protocol, 'text', { sharedId: kind === 'endpoints' ? 'protocol' : 'type' }),
    field('required', kind === 'attrs' ? 'fact.requiredRule' : 'col.mandatory', e => e.mandatory, 'boolean'),
    field('key', kind === 'attrs' ? 'fact.businessKey' : 'col.key', e => kind === 'attrs' ? e.keyRole || null : e.keyRoles?.length ? e.keyRoles.map(k => ({ primary: 'PK', foreign: 'FK', unique: 'UK' }[k] || k)).join(', ') : e.keyRole),
    field('codeList', 'col.codeList', e => e.codeList ? data.nameOf('refs', e.codeList) : null, 'text', { href: e => e.codeList ? DK.router.entityHref('refs', e.codeList) : null }),
    field('unit', 'print.column.unit', e => [e.length, e.unit].filter(v => v != null).join(' / ')), property('source', 'print.column.source'),
    record('nullable', 'visibility.nullable', 'is_nullable'), record('semanticName', 'visibility.semanticName', 'semantic_name'),
    record('sourcePath', 'visibility.sourcePath', 'source_path'), field('shortName', 'visibility.shortName', e => ui.localized(e.shortLabels) || ui.localized(e._record || {}, 'short_name_')),
    property('http_method', 'visibility.httpMethod'), property('relative_path', 'visibility.relativePath'), property('url', 'fact.baseUrl', 'text', { sharedId: 'endpointURL' }),
    ...(kind === 'endpoints' ? [field('description', 'col.description', e => ui.localized(e, 'description_') || e.description, 'long')] : []),
  ].map(f => f.id === 'nullable' ? { ...f, type: 'boolean' } : f);
  const rowExtras = {
    attrs: ['sortOrder', 'propertyGroup', 'description', 'required', 'systemOfRecord', 'normReference', 'semanticName', ...responsibility, ...protection],
    fields: ['sortOrder', 'propertyGroup', 'description', 'code', 'required', 'nullable', 'unit', 'sourcePath', ...responsibility, 'dataCustodian', ...protection],
    values: ['sortOrder', 'description', 'shortName', 'identifier', 'comment', 'informationUrls', 'created', 'modified'],
    productAttrs: ['sortOrder', 'required', 'semanticName', 'code', 'source', 'identifier', 'comment', 'informationUrls', 'created', 'modified'],
    endpoints: ['sortOrder', 'code', 'http_method', 'relative_path', 'url'],
  };
  // Keep browsing choices compact; full definitions still support search and source snapshots.
  const optionalChoices = {
    objects: ['domain', 'systemOfRecord', 'normReference', 'dataOwner', 'dataSteward', 'version'],
    tables: ['sortOrder', 'domain', ...responsibility, 'dataCustodian', 'businessObject', 'version', 'accessOptions'],
    domains: ['dataOwner', 'dataSteward', 'version'],
    systems: [...responsibility, 'dataCustodian', 'version'],
    refs: ['domain', 'responsibleOrg', 'version'],
    products: ['domain', ...responsibility, 'version', 'accessOptions'],
    apis: ['domain', ...responsibility, 'dataCustodian', 'accessRights', 'endpointURL', 'accessOptions'],
    attrs: ['sortOrder', 'propertyGroup', 'description', 'required', 'systemOfRecord', 'normReference', ...responsibility, 'version'],
    fields: ['sortOrder', 'propertyGroup', 'description', 'code', 'required', 'nullable', 'unit', 'sourcePath', ...responsibility, 'dataCustodian', 'version'],
    values: ['sortOrder', 'description'], productAttrs: ['sortOrder', 'required', 'code'],
    endpoints: ['sortOrder', 'http_method', 'relative_path', 'url'],
  };
  const fieldOrder = ['name', 'sortOrder', 'description', 'domain', 'parentDomain', 'system', 'systemOfRecord', 'businessObject', ...responsibility, 'dataCustodian',
    'normReference', 'technology', 'systemType', 'serviceVersion', 'protocol', 'http_method', 'relative_path', 'endpointURL', 'url',
    'format', 'accessRights', 'accessOptions', 'code', 'type', 'unit', 'key', 'required', 'nullable', 'codeList', 'version',
    'attributeCount', 'fieldCount', 'objectCount', 'tableCount', 'apiCount', 'valueCount', 'endpointCount', 'status'];
  // Attribute and source-field tables share one sequence with their Ansicht controls.
  const attributeFieldOrder = ['sortOrder', 'propertyGroup', 'name', 'code', 'sourcePath', 'description', 'type', 'key', 'required', 'nullable',
    'codeList', 'unit', 'normReference', 'systemOfRecord', ...responsibility, 'dataCustodian', 'version', 'status'];
  // Relative widths carry the same reading priorities into CSS tables and physical PDF columns.
  // Short enumerated values (organisations, systems, norm references) reserve 14 em so compounds
  // such as "Immobilienmanagement" stay on one line; the clamped description donates the slack.
  const sizing = f => f.id === 'name' ? { minEm: 12, weight: 2.4 }
    : f.type === 'long' ? { minEm: 18, weight: 3 }
    : ['number', 'boolean', 'status', 'date'].includes(f.type) || f.id === 'key' ? { minEm: 5, weight: .25 }
    : ['type', 'version', 'serviceVersion', 'protocol'].includes(f.id) ? { minEm: 7, weight: .7 }
    : { minEm: 14, weight: 1.6 };
  const definitionCache = new Map();
  function definitions(kind) {
    if (!Object.hasOwn(defaults, kind)) return [];
    if (definitionCache.has(kind)) return definitionCache.get(kind);
    if (kind === 'history') {
      const result = [property('date', 'col.date', 'date'), property('action', 'col.change'),
        property('detail', 'col.details', 'long'), property('user', 'col.editedBy')]
        .map((f, order) => ({ ...f, order, required: f.id === 'date', primary: f.id === 'date', defaultVisible: true }));
      definitionCache.set(kind, result);
      return result;
    }
    const child = !custom[kind];
    const title = field('name', nameLabels[kind], e => kind === 'values' ? e.label || e.name : kind === 'endpoints' ? ui.localized(e, 'name_') || e.name || e.operation_name || e.identifier || e.url : kind === 'apis' ? e.name : kind === 'fields' ? ui.localized(e.labels) || '' : data.displayName(kind === 'productAttrs' ? 'attrs' : kind, e), 'text', { required: true, primary: true });
    const available = { ...byId, name: title, ...Object.fromEntries((custom[kind] || rowFields(kind)).map(f => [f.id, f])) };
    if (['refs', 'values'].includes(kind)) available.responsibleOrg = { ...available.responsibleOrg, label: 'fact.authorityOrganisation' };
    const ids = [...defaults[kind], ...(child ? rowExtras[kind] : [...custom[kind].map(f => f.id), ...extras[kind]]),
      ...(!child || ['attrs', 'fields', 'tables'].includes(kind) ? metadata : [])];
    const order = ['attrs', 'fields'].includes(kind) ? attributeFieldOrder : fieldOrder;
    const result = [...new Set(ids)].filter(id => available[id]).map(id => ({ ...available[id], sizing: sizing(available[id]),
      order: kind === 'values' && id === 'code' ? -1 : order.includes(id) ? order.indexOf(id) : order.length,
      required: id === 'name' || kind === 'values' && id === 'code', defaultVisible: defaults[kind].includes(id) })).sort((a, b) => a.order - b.order);
    definitionCache.set(kind, result);
    return result;
  }
  let preferences;
  function stored() {
    if (!preferences) {
      try {
        const value = JSON.parse(DK.preferences?.read('visibleFields') || 'null');
        preferences = [1, 2, 3, 4].includes(value?.version) && value.kinds && typeof value.kinds === 'object' && !Array.isArray(value.kinds) ? value.kinds : {};
        // Status was unavailable for these rows in v1. Add it once while retaining
        // other choices; v2 preserves an explicit decision to hide it thereafter.
        if (value?.version === 1) {
          for (const kind of ['attrs', 'fields']) if (Array.isArray(preferences[kind]) && !preferences[kind].includes('status')) preferences[kind].push('status');
        }
        // Earlier versions combined alias and technical name in one cell. Show both
        // columns once; subsequent explicit visibility choices remain persistent.
        if ([1, 2].includes(value?.version)) {
          if (Array.isArray(preferences.fields) && !preferences.fields.includes('code')) preferences.fields.push('code');
        }
        if ([1, 2, 3].includes(value?.version)) {
          for (const kind of ['attrs', 'fields']) if (Array.isArray(preferences[kind]) && !preferences[kind].includes('propertyGroup')) preferences[kind].push('propertyGroup');
          DK.preferences?.write('visibleFields', JSON.stringify({ version: 4, kinds: preferences }));
        }
      }
      catch { preferences = {}; }
    }
    return preferences;
  }
  const choices = kind => definitions(kind).filter(f => f.required || f.defaultVisible || optionalChoices[kind]?.includes(f.id));
  const normalize = (kind, ids) => choices(kind).filter(f => f.required || (Array.isArray(ids) ? ids.includes(f.id) : f.defaultVisible)).map(f => f.id);
  const selected = kind => normalize(kind, Object.hasOwn(stored(), kind) ? stored()[kind] : null);
  const routeKind = route => route.view === 'list' ? route.kind : route.view === 'detail'
    ? route.kind === 'domains' ? 'objects' : route.params?.tab === 'history' ? 'history' : childOf[route.kind] : null;
  function save(kind, ids) {
    if (!Object.hasOwn(defaults, kind)) return;
    const next = normalize(kind, ids);
    if (JSON.stringify(stored()[kind]) === JSON.stringify(next)) return;
    stored()[kind] = next;
    DK.preferences?.write('visibleFields', JSON.stringify({ version: 4, kinds: preferences }));
  }
  /** Share controls by semantic ID, retaining distinct names and each underlying selection. */
  function mergeFields(groups) {
    const choices = new Map();
    for (const group of groups) for (const field of group.fields) {
      const id = field.id === 'name' ? group.nameId : field.sharedId || field.id;
      if (!choices.has(id)) choices.set(id, { ...field, id, labelText: field.id === 'name' ? group.nameLabel || field.labelText : field.labelText, targets: [] });
      const choice = choices.get(id);
      choice.required ||= field.required;
      choice.defaultVisible ||= field.defaultVisible;
      choice.targets.push({ key: group.key, id: field.id, selected: field.required || group.selected.includes(field.id) });
    }
    const rank = choice => choice.targets.some(target => target.id === 'name') ? -2 : choice.order ?? 0;
    return [...choices.values()].map(choice => ({ ...choice, checked: choice.targets.every(target => target.selected),
      mixed: choice.targets.some(target => target.selected) && !choice.targets.every(target => target.selected) })).sort((a, b) => rank(a) - rank(b));
  }
  function format(field, value) {
    if (empty(value)) return '—';
    if (field.type === 'boolean') return typeof value === 'boolean' ? t(value ? 'yes' : 'no') : '—';
    if (field.type === 'date') return ui.fmtDate(value);
    return Array.isArray(value) ? value.join('; ') : String(value);
  }
  const fields = (kind, ids = selected(kind)) => { const visible = new Set(normalize(kind, ids)); return definitions(kind).filter(f => visible.has(f.id)); };
  // Web status chips carry padding and letter-spacing that the print minimum does not: "Archiviato" needs 7.2 em.
  const webSizing = f => f.type === 'status' && f.sizing ? { ...f.sizing, minEm: Math.max(f.sizing.minEm, 7.5) } : f.sizing;
  const column = f => ({ id: f.id, label: t(f.label), primary: f.primary, sizing: webSizing(f), numeric: f.type === 'number', compact: ['boolean', 'number', 'status', 'date'].includes(f.type) || ['key', 'type', 'code'].includes(f.id), sortable: f.type !== 'links' });
  const values = (kind, entity) => Object.fromEntries(definitions(kind).map(f => [f.id, f.read(entity, kind)]));
  const display = (kind, entity) => Object.fromEntries(definitions(kind).map(f => [f.id, format(f, f.read(entity, kind))]));
  function cell(f, value, entity) {
    if (entity && f.href?.(entity) && !empty(value)) return ui.entityLink(f.href(entity), format(f, value));
    if (f.type === 'status' && !empty(value)) return ui.chip(value, data.statusTone(value));
    if (f.type === 'links' && !empty(value)) return `<span class="ob-field-links">${value.map(url => ui.safeHref(url) ? ui.link(url, ui.esc(url), { external: true }) : '—').join('<br>')}</span>`;
    return ui.esc(format(f, value));
  }
  function sortOptions(state, key, kind) {
    const visible = fields(kind), old = state.tableSorts[key];
    const fallback = kind === 'history' ? 'date' : ['attrs', 'fields', 'tables'].includes(kind) ? 'sortOrder' : 'name';
    const id = old?.field || (old ? definitions(kind)[old.column ?? 0]?.id : null) || fallback;
    const field = visible.find(f => f.id === id && f.type !== 'links')?.id || (id === 'sortOrder' && ['attrs', 'fields', 'tables'].includes(kind) ? id : fallback);
    const direction = field === id && old ? (old.direction === 'desc' ? 'desc' : 'asc') : kind === 'history' ? 'desc' : 'asc';
    const sort = { field, direction };
    if (old && old.field && field !== old.field) state.tableSorts[key] = sort;
    return { key, sort };
  }
  const sort = (kind, rows, order, read = row => row) => {
    const f = definitions(kind).find(f => f.id === order?.field) || definitions(kind)[order?.column ?? 0];
    return f ? ui.sortRows(rows, { column: 0, direction: order?.direction || 'asc' }, row => [f.read(read(row), kind)]) : rows;
  };
  DK.presentation = { definitions, choices, defaults: kind => normalize(kind, null), normalize, selected, save, routeKind, mergeFields, fields, column, values, display, format, cell, sortOptions, sort, childOf };
})(window.DK);
