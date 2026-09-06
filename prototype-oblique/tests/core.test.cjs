/* Run: node --test prototype-oblique/tests/core.test.cjs (no dependencies). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function runtime(change = () => {}, globals = {}) {
  const warnings = [];
  const context = vm.createContext({
    window: {}, URL, URLSearchParams, ...globals,
    console: { warn: message => warnings.push(message) },
    fetch: async url => ({ ok: true, json: async () => {
      const name = path.basename(url);
      const value = JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
      return change(name, value) ?? value;
    } }),
  });
  for (const file of ['ui', 'preferences', 'data', 'router', 'presentation', 'field-picker', 'manual', 'search', 'graph', 'views', 'detail', 'excel']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context, { filename: file + '.js' });
  }
  return { ...context.window.DK, warnings };
}
async function loaded(change) {
  const dk = runtime(change);
  await dk.data.load('data/');
  dk.ui.setDictionary(dk.data.i18n, 'de');
  return dk;
}

test('localized SQL columns preserve language fallback without constructing label maps', () => {
  const { ui } = runtime(), record = { name_de: 'Gebäude', name_fr: 'Bâtiment', name_it: 'Edificio', name_en: 'Building' };
  for (const lang of ['de', 'fr', 'it', 'en']) {
    ui.setDictionary({}, lang);
    assert.equal(ui.localized(record, 'name_'), record['name_' + lang]);
  }
  delete record.name_en;
  assert.equal(ui.localized(record, 'name_'), 'Gebäude');
  record.name_de = 'Updated';
  assert.equal(ui.localized(record, 'name_'), 'Updated');
  assert.equal(ui.localized({ en: 'Plain label' }), 'Plain label');
  assert.equal(ui.localized(null, 'name_'), '');
});

test('visibility preferences tolerate invalid storage, enforce identity and stay scoped by kind', () => {
  for (const stored of ['broken', '{"version":2,"kinds":{"objects":[]}}', '{"version":1,"kinds":[]}']) {
    const { presentation: p } = runtime(() => {}, { localStorage: { getItem: () => stored } });
    assert.deepEqual([...p.selected('objects')], [...p.defaults('objects')]);
  }
  const saved = new Map(), localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  const { presentation: p } = runtime(() => {}, { localStorage });
  p.save('objects', ['version', 'unknown', 'version']);
  assert.deepEqual([...p.selected('objects')], ['name', 'version']);
  assert.deepEqual([...p.selected('tables')], [...p.defaults('tables')]);
  p.save('values', []);
  assert.deepEqual([...p.selected('values')], ['code', 'name']);
  const reloaded = runtime(() => {}, { localStorage }).presentation;
  assert.deepEqual([...reloaded.selected('objects')], ['name', 'version']);
});

test('visibility preserves empty, false and zero values and localizes endpoint records', async () => {
  const { presentation: p, ui, data } = await loaded();
  assert.equal(p.format({ type: 'number' }, 0), '0');
  assert.equal(p.format({ type: 'boolean' }, false), 'Nein');
  for (const value of [null, undefined, '', []]) assert.equal(p.format({}, value), '—');
  assert.equal(p.cell({ type: 'text' }, '<script>'), '&lt;script&gt;');
  for (const kind of ['domains', 'refs']) assert(!p.definitions(kind).some(f => ['classification', 'personalData'].includes(f.id)));
  assert(!p.definitions('refs').some(f => ['dataOwner', 'dataSteward', 'dataCustodian'].includes(f.id)));
  for (const language of ['de', 'fr', 'it', 'en']) {
    ui.setDictionary(data.i18n, language);
    const endpoint = { ['name_' + language]: 'Endpoint ' + language, ['description_' + language]: 'Description ' + language, protocol: 'REST' };
    assert.equal(p.display('endpoints', endpoint).name, endpoint['name_' + language]);
    assert.equal(p.display('endpoints', endpoint).description, endpoint['description_' + language]);
    for (const kind of [...data.contentKinds(), 'domains', 'systems', 'attrs', 'fields', 'values', 'productAttrs', 'endpoints']) {
      for (const field of p.definitions(kind)) assert.notEqual(ui.t(field.label), field.label, `${language}:${kind}:${field.id}`);
    }
  }
});

test('web and print visibility choices exclude detailed metadata without removing searchable values', async () => {
  const { presentation: p } = await loaded();
  for (const kind of ['objects', 'tables', 'domains', 'systems', 'refs', 'products', 'apis', 'attrs', 'fields', 'values', 'productAttrs', 'endpoints']) {
    const ids = [...p.choices(kind)].map(field => field.id);
    assert(ids.length <= 14, kind + ': bounded browsing choices');
    for (const id of ['identifier', 'comment', 'created', 'modified', 'versionDate', 'informationUrls', 'classification', 'personalData', 'sourcePath', 'semanticName']) assert(!ids.includes(id), kind + ': omit ' + id);
    assert(p.defaults(kind).every(id => ids.includes(id)), 'Defaults are selectable');
  }
  p.save('objects', ['name', 'version', 'comment', 'identifier']);
  assert.deepEqual([...p.selected('objects')], ['name', 'version'], 'Old preferences discard retired choices');
  assert.equal(p.values('objects', { attributes: [], comment: 'Still searchable' }).comment, 'Still searchable');
  for (const kind of ['objects', 'tables', 'domains', 'systems', 'refs', 'products', 'apis']) {
    const fields = p.choices(kind), counts = fields.filter(field => field.type === 'number');
    assert(counts.length && counts.every(field => field.defaultVisible && !field.required), kind + ': counts are optional and on by default');
    assert.deepEqual([...fields].slice(0, 2).map(field => field.id), ['name', 'description']);
    assert(fields.find(field => field.id === 'description').sizing.weight > fields.find(field => field.id === 'name').sizing.weight);
    assert(counts.every(field => field.sizing.weight < fields.find(field => field.id === 'name').sizing.weight));
  }
});

test('shared visibility merges semantic fields while preserving names and mixed preferences', async () => {
  const { presentation: p } = await loaded();
  for (const [kind, child] of Object.entries(p.childOf).filter(([kind]) => kind !== 'systems')) {
    const groups = [{ key: 'entry', nameId: 'entry.name', fields: p.definitions(kind), selected: p.defaults(kind) },
      { key: 'row', nameId: 'name', fields: p.definitions(child), selected: p.defaults(child) }];
    const choices = p.mergeFields(groups), targets = choices.flatMap(choice => choice.targets.map(target => `${target.key}:${target.id}`));
    assert.equal(targets.length, new Set(targets).size, kind + ': no duplicated targets');
    assert.equal(targets.length, groups.reduce((n, group) => n + group.fields.length, 0), kind + ': no lost targets');
    assert.equal(choices.filter(choice => choice.id === 'description').length, 1);
    assert.equal(choices.find(choice => choice.id === 'description').targets.length, 2);
    assert(choices.filter(choice => ['entry.name', 'name'].includes(choice.id)).every(choice => choice.required && choice.checked));
    if (kind === 'objects') assert(choices.find(choice => choice.id === 'responsibleOrg').mixed);
    if (kind === 'apis') {
      assert.equal(choices.find(choice => choice.id === 'protocol').targets.length, 2, 'Protocol aliases share one control');
      assert.equal(choices.find(choice => choice.id === 'endpointURL').targets.length, 2, 'Endpoint URL aliases share one control');
    }
    assert.deepEqual([...p.selected(kind)], [...p.defaults(kind)], 'Merging never changes saved preferences');
  }
});

test('profile tab counts do not render child rows, and row tabs build them only once', async () => {
  const { detail, views, data } = await loaded();
  const state = { mode: 'tiles', groupBy: {}, closed: {}, tableSorts: {} }, original = detail.rowsData;
  let calls = 0;
  detail.rowsData = entity => { calls++; return original(entity); };
  for (const kind of ['objects', 'tables', 'refs', 'products', 'systems']) {
    const entity = { ...data.list(kind)[0], kind };
    for (const tab of ['overview', 'rows']) {
      calls = 0;
      const route = { view: 'detail', kind, id: entity.identifier, entity, params: { tab } };
      const ctx = views.context(route, state), html = detail.render(entity, route, state, ctx);
      assert.equal(calls, tab === 'rows' ? 1 : 0, `${kind}/${tab}`);
      assert(html.includes(`data-tab="rows">${detail.rowsLabel(entity)} (${data.sizeOf(kind, entity)})`));
      assert.equal(ctx.actions.some(action => action.id.includes('pdf')), false);
      assert.equal(ctx.canPrint, true);
    }
  }
});

test('sorting reads values once per row and keeps equal or missing rows stable', () => {
  const { ui } = runtime();
  const rows = [null, 10, 2, 2, undefined, 1].map((value, id) => ({ value, id }));
  let calls = 0;
  const sorted = ui.sortRows(rows, { column: 0, direction: 'asc' }, row => { calls++; return [row.value]; });
  assert.equal(calls, rows.length);
  assert.equal(sorted.map(row => row.id).join(','), '5,2,3,1,0,4');
  assert.equal(rows.map(row => row.id).join(','), '0,1,2,3,4,5');
});

test('English handbook chapter identifiers preserve legacy links and render every chapter', async () => {
  const { data, manual } = await loaded();
  assert.equal(data.manual.chapters.map(chapter => chapter.id).join(','), 'introduction,governance,model,usage,retrieval,faq,glossary,references');
  const html = manual.render('<h1>Handbuch</h1>');
  for (const chapter of data.manual.chapters) {
    assert.equal(manual.resolveChapter(chapter.id), chapter.id);
    if (chapter.legacyId) assert.equal(manual.resolveChapter(chapter.legacyId), chapter.id);
    assert.ok(html.includes(`id="manual-${chapter.id}"`));
    assert.ok(html.includes(chapter.title));
    assert.ok(data.manual[chapter.id]);
  }
  assert.equal(manual.resolveChapter(undefined), 'introduction');
  assert.equal(manual.resolveChapter('unknown'), 'introduction');
});

test('preferences retain existing browser keys and tolerate unavailable storage', () => {
  const stored = new Map([['datenkatalog.lang', 'fr'], ['datenkatalog.sidebarWidth', '380']]);
  const localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  const { preferences } = runtime(undefined, { localStorage });
  assert.equal(preferences.read('language'), 'fr');
  assert.equal(preferences.read('sidebarWidth'), '380');
  preferences.write('sidebarCollapsed', true);
  assert.equal(stored.get('datenkatalog.sidebarCollapsed'), 'true');
  preferences.write('sidebarWidth', null);
  assert.equal(stored.has('datenkatalog.sidebarWidth'), false);
  const fail = () => { throw new Error('Storage disabled'); };
  const blocked = runtime(undefined, { localStorage: { getItem: fail, setItem: fail, removeItem: fail } }).preferences;
  assert.equal(blocked.read('language'), null);
  assert.doesNotThrow(() => blocked.write('language', 'en'));
  assert.doesNotThrow(() => blocked.write('sidebarWidth', null));
});

test('search ranks across types before global pagination, with stable ordering and validated URL values', async () => {
  const { search, ui, data } = await loaded();
  const groups = ['objects', 'tables', 'refs'].map((kind, k) => ({ kind, items: Array.from({ length: 21 }, (_, n) => ({
    identifier: `${kind}-${n}`, technicalName: `ROW_${n}`, name: n === 0 ? 'Needle' : `Record ${k * 21 + n}`, description: 'Needle in description',
    modified: n === 1 ? '2026-09-05' : n === 2 ? undefined : '2024-01-01',
  })) }));
  const original = JSON.stringify(groups);
  const full = search.page(groups, 'Needle', { size: 100 });
  assert.equal(full.total, 63);
  assert.equal(full.items.slice(0, 3).map(x => x.kind).sort().join(','), 'objects,refs,tables', 'all exact matches precede weaker hits, regardless of type');
  assert.ok(full.items.slice(0, 3).every(x => x.score === 100));
  const key = x => `${x.kind}:${x.e.identifier}`;
  const visited = [];
  for (let page = 1; page <= 4; page++) {
    const result = search.page(groups, 'Needle', { page });
    assert.equal(result.size, 20);
    assert.equal(result.items.length, page < 4 ? 20 : 3);
    visited.push(...result.items.map(key));
  }
  assert.equal(visited.join(','), full.items.map(key).join(','), 'pages neither skip nor repeat records');
  assert.equal(new Set(visited).size, 63);
  assert.equal(search.page(groups, 'Needle', { page: '999' }).page, 4);
  for (const page of ['-1', '0', '1.5', '2oops', 'Infinity']) assert.equal(search.page(groups, 'Needle', { page }).page, 1);
  assert.equal(search.page(groups, 'Needle', { size: '999', sort: 'unknown' }).size, 20);
  assert.equal(search.page(groups, 'Needle', { sort: 'unknown' }).sort, 'relevance');
  const names = search.page(groups, 'Needle', { sort: 'name', size: 100 }).items.map(x => data.displayName(x.kind, x.e));
  assert.equal(names.join(','), names.slice().sort(new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' }).compare).join(','));
  const dates = search.page(groups, 'Needle', { sort: 'modified', size: 100 }).items.map(x => x.e.modified || '');
  assert.equal(dates.join(','), dates.slice().sort().reverse().join(','));
  assert.equal(JSON.stringify(groups), original, 'sorting never mutates retrieval results');
  const empty = search.page([], 'Needle', { page: 20 });
  assert.equal(empty.page, 1); assert.equal(empty.from, 0); assert.equal(empty.to, 0);
  assert.equal(ui.pager(empty), '');
  assert.equal(ui.pageState(119, {}).size, 50, 'detail table default stays 50');
  assert.equal(ui.pageState(119, { size: 200 }).size, 200, 'detail table options stay available');
});

test('domain profiles contain the same members as the tree, including copied records', async () => {
  const { data, detail } = await loaded();
  const domain = { ...data.domainOf('bau'), kind: 'domains' };
  assert.equal(detail.tabs(domain).map(([id]) => id).join(','), 'overview,tiles,table');
  assert.equal(detail.resolveTab(domain, 'rows'), 'table');
  assert.equal(detail.resolveTab(domain, 'relations'), 'overview');
  assert.equal(detail.resolveTab(domain, 'history'), 'overview');
  for (const d of data.domains) {
    for (const kind of data.kinds) {
      const canonical = data.membersOfDomain(kind, d).map(e => e.identifier).join(',');
      assert.equal(data.membersOfDomain(kind, { ...d }).map(e => e.identifier).join(','), canonical);
    }
    assert.equal(JSON.stringify(data.relations('domains', { ...d })), JSON.stringify(data.relations('domains', d)));
  }
  assert.equal(data.membersOfDomain('systems', null).length, 0);
});

test('domain browsing reuses collection rows, filtering and export scope while keeping its overview', async () => {
  const { data, detail, views, excel } = await loaded();
  const entity = { ...data.domainOf('bau'), kind: 'domains' };
  const state = { mode: 'tiles', groupBy: {}, closed: {}, tableSorts: {} };
  const route = { view: 'detail', kind: 'domains', id: 'bau', entity, params: {} };
  const tiles = views.context(route, state);
  assert.equal(tiles.mode, 'tiles');
  assert.equal(tiles.kind, 'objects');
  assert.equal(tiles.title, entity.name);
  assert.equal(tiles.matched, 9);
  assert.equal(JSON.stringify(tiles.columns), JSON.stringify(data.columns('objects')));
  assert.ok(tiles.groups.every(g => g.items.every(e => e.domain === 'bau')));
  assert.ok(detail.render(entity, route, state).includes('ob-tile'));
  const filteredRoute = { ...route, params: { tab: 'table', filter: 'Gebäude', group: 'status' } };
  const filtered = views.context(filteredRoute, state);
  assert.ok(filtered.matched > 0 && filtered.matched < 9);
  const plan = excel.plan(filteredRoute, filtered, 'http://localhost/#/domains/bau');
  const rows = plan.sheets.find(s => s.name === 'Geschäftsobjekte').rows;
  assert.equal(rows.length, filtered.matched);
  assert.ok(rows.every(r => filtered.groups.some(g => g.items.some(e => e.identifier === r[0]))));
  const overview = views.context({ ...route, params: { tab: 'overview', filter: 'Gebäude' } }, state);
  assert.equal(overview.isList, false);
  assert.equal(overview.filter, '');
  assert.ok(views.collection(overview).includes('ob-core-facts'));
  assert.ok(!views.collection(overview).includes('id="collection-filter"'));
  const empty = views.context({ ...route, params: { tab: 'table', filter: 'unfindable-fixture' } }, state);
  assert.equal(excel.plan(route, empty, 'http://localhost/#/domains/bau').sheets.find(s => s.name === 'Geschäftsobjekte').rows.length, 0);
});

test('unknown navigation models, including inherited property names, fall back to the entity tree', async () => {
  const { data } = await loaded();
  for (const nav of ['__proto__', 'constructor', 'toString', 'unknown']) {
    data.navModelOverride = nav;
    assert.equal(data.navModel(), 'entity');
    assert.ok(Array.isArray(data.sections()));
  }
  data.navModelOverride = 'container';
  assert.equal(data.sections()[0], 'domains');
});

test('router rejects malformed and extra path segments while retaining encoded identifiers', () => {
  const { router } = runtime();
  for (const hash of ['#/api/extra', '#/objects/areal/typo', '#/objects/areal/attributes', '#/objects/a/attributes/b/extra', '#/objects/%E0%A4%A']) {
    assert.equal(router.parse(hash).view, 'notfound', hash);
  }
  assert.equal(router.parse(router.entityHref('objects', 'a b?é')).id, 'a b?é');
  assert.equal(router.parse(router.entityHref('attrs', 'areal/areal-id')).id, 'areal/areal-id');
  const params = router.parse('#/search?q=A%26B&__proto__=value').params;
  assert.equal(Object.getPrototypeOf(params), null);
  assert.equal(params.q, 'A&B');
});

test('field profiles resolve within their own table and inherit context without duplicating catalog entries', async () => {
  const { data, router, detail, graph } = await loaded();
  assert.ok(!data.kinds.includes('fields'));
  for (const table of data.tables) {
    for (const embedded of table.fields) {
      const id = `${table.identifier}/${data.fieldId(embedded)}`;
      const parsed = router.parse(router.entityHref('fields', id));
      assert.equal(parsed.kind, 'fields');
      assert.equal(parsed.id, id);
      const field = { ...data.get('fields', id), kind: 'fields' };
      assert.equal(field.technicalName, embedded.technicalName);
      assert.equal(field.label, embedded.labels.de);
      assert.equal(field.table, table.identifier);
      assert.equal(field.status, table.status);
      assert.equal(data.domainForEntity('fields', field)?.identifier, data.domainForEntity('tables', table)?.identifier);
      assert.equal(JSON.stringify(data.history('fields', id)), JSON.stringify(data.history('tables', table.identifier)));
      assert.equal(detail.resolveTab(field, 'rows'), 'overview');
      assert.ok(detail.overview(field).includes(router.entityHref('tables', table.identifier, { tab: 'rows' })));
      assert.ok(graph.layout(field).panels.length >= 2);
      assert.equal(data.relations('fields', field).find(g => g.key === 'usesCodelists').items.length, embedded.codeList ? 1 : 0);
    }
  }
  assert.equal(data.get('fields', 't-gwr-gebaeude/egid'), null, 'technical field identifiers are case sensitive');
  assert.equal(data.get('fields', 'missing/EGID'), null);
  assert.equal(data.get('fields', 't-gwr-gebaeude/missing'), null);
  for (const path of ['#/fields', '#/tables/t-gwr-gebaeude/fields', '#/tables/t-gwr-gebaeude/fields/EGID/extra', '#/objects/gebaeude/fields/EGID', '#/tables/t-gwr-gebaeude/attributes/EGID']) {
    assert.equal(router.parse(path).view, 'notfound');
  }
  const field = data.field('t-gwr-gebaeude/GKAT');
  assert.equal(field.sourceUrl, 'https://www.housing-stat.ch/catalog/de/5.0/revised#GKAT');
  const html = detail.overview({ ...field, kind: 'fields', catalogMetadata: { 'Detaillierte Beschreibung': '<img src=x onerror=alert(1)> & literal source text' } });
  assert.ok(!html.includes('ob-field-documentation'));
  assert.ok(!html.includes('literal source text'));
  assert.ok(!html.includes('<img src=x'));
});

test('responsibility distinguishes organisations and people, and field profiles retain shared GWR contacts', async () => {
  const { data, detail } = await loaded();
  const official = data.kinds.flatMap(kind => data.list(kind).filter(e => e.provenance?.importId === 'gwr-catalog-5.0').map(e => ({ ...e, kind })));
  assert.equal(official.length, 56);
  for (const table of data.tables.filter(e => e.system === 'gwr')) {
    official.push(...table.fields.map(f => ({ ...data.field(`${table.identifier}/${data.fieldId(f)}`), kind: 'fields' })));
  }
  for (const e of official) {
    const html = detail.responsibility(e);
    assert.ok(html.includes('Bundesamt für Statistik (BFS)'));
    assert.ok(html.includes('href="https://www.housing-stat.ch/de/home.html"'));
    assert.ok(!html.includes('mailto:') && !html.includes('tel:'));
    assert.equal(html.includes('<dt>Datenhalter</dt>'), ['systems', 'tables', 'fields', 'apis'].includes(e.kind));
    assert.ok(!html.includes('Admindir'));
    assert.ok(html.includes('<dt>Dateneigner</dt><dd><span>—</span></dd>'));
    assert.ok(html.includes('<dt>Datenverwalter</dt><dd><span>—</span></dd>'));
    assert.ok(!detail.facts(e).primary.some(f => f.value === e.responsibleOrg));
  }
  const system = { ...data.sysOf('sap'), kind: 'systems' };
  const legacy = detail.responsibility(system);
  assert.ok(legacy.includes('Martina Aebischer im Admindir öffnen'));
  assert.ok(legacy.includes('<dt>Datenhalter</dt><dd>Portfoliomanagement</dd>'));
  const mixed = detail.responsibility({
    ...system, responsibleOrg: '<BFS>', contact: { url: 'javascript:alert(1)' },
    dataOwner: { type: 'organisation', name: 'Registerteam', url: 'https://example.org/team' },
    dataSteward: { type: 'organisation', name: 'Fachbereich' },
    dataCustodian: { type: 'person', name: 'A & B' },
  });
  assert.ok(mixed.includes('&lt;BFS&gt;'));
  assert.ok(!mixed.includes('javascript:') && !mixed.includes('Registerteam im Admindir'));
  assert.ok(mixed.includes('href="https://example.org/team"'));
  assert.ok(mixed.includes('<dt>Datenverwalter</dt><dd>Fachbereich</dd>'));
  assert.ok(mixed.includes('A &amp; B im Admindir öffnen'));
  assert.equal((detail.responsibility({ kind: 'objects' }).match(/<span>—<\/span>/g) || []).length, 3);
  assert.ok(detail.responsibility({ kind: 'apis', dataCustodian: 'API operations' }).includes('<dt>Datenhalter</dt><dd>API operations</dd>'));
  // Inheritance also works for non-GWR records without guessing contacts from a domain/system.
  const object = data.get('objects', 'gebaeude');
  object.contact = { url: 'https://example.org/team' };
  assert.equal(data.attr('gebaeude/egid').contact.url, 'https://example.org/team');
  const table = data.get('tables', 't-gwr-gebaeude');
  table.fields[0].contact = { url: 'https://example.org/field' };
  assert.equal(data.field(`${table.identifier}/${data.fieldId(table.fields[0])}`).contact.url, 'https://example.org/field');
  assert.equal(table.contact.url, 'https://www.housing-stat.ch/de/home.html');
});

test('field identifiers support encoded names and reject ambiguous duplicates', async () => {
  const { data, router } = await loaded((name, value) => {
    if (name === 'tables.json') value[0].fields.push({ identifier: 'cost / m²?net#', technicalName: 'RENAMED_COLUMN', labels: { de: 'Kosten pro Quadratmeter' }, description: 'Stable identifier', dataType: 'DECIMAL' });
  });
  const id = `${data.tables[0].identifier}/cost / m²?net#`;
  const href = router.entityHref('fields', id);
  assert.equal(router.parse(href).id, id);
  assert.equal(data.get('fields', router.parse(href).id).technicalName, 'RENAMED_COLUMN');
  for (const explicit of [false, true]) {
    const { data: invalid } = runtime((name, value) => {
      if (name === 'tables.json') {
        const f = value[0].fields[0];
        value[0].fields.push(explicit ? { ...f, identifier: f.identifier || f.technicalName, technicalName: 'another-name' } : { ...f });
      }
    });
    await assert.rejects(invalid.load('data/'), /duplicate field identifier/);
  }
});

test('field labels follow the selected language with a German fallback and stable technical identity', async () => {
  const { data, ui, detail, excel } = await loaded((name, value) => {
    if (name === 'tables.json') value[0].fields[0] = { technicalName: 'MANDT', labels: { de: 'Mandant', fr: 'Mandant FR <test>' } };
  });
  const embedded = data.tables[0].fields[0];
  const stored = JSON.stringify(embedded);
  const id = `${data.tables[0].identifier}/${data.fieldId(embedded)}`;
  for (const [lang, expected] of [['fr', 'Mandant FR <test>'], ['it', 'Mandant'], ['en', 'Mandant'], ['de', 'Mandant']]) {
    ui.setDictionary(data.i18n, lang);
    const field = { ...data.field(id), kind: 'fields' };
    assert.equal(field.label, expected);
    assert.equal(field.technicalName, 'MANDT');
    assert.equal(field.identifier, id);
    assert.equal(field.name, `${expected} (MANDT)`);
    const html = detail.overview(field);
    assert.ok(html.includes(ui.esc(expected)));
    assert.ok(!html.includes('<test>'));
    const plan = excel.plan({ view: 'detail', kind: 'fields', entity: field }, { title: field.name, state: {} }, 'http://localhost/');
    const fields = plan.sheets.find(s => s.name === ui.t('col.fields'));
    assert.equal(fields.rows[0][3], 'MANDT');
    assert.equal(fields.rows[0][4], expected);
    const meta = plan.sheets.find(s => s.name === ui.t('excel.metadata'));
    assert.ok(meta.rows.some(r => r[3] === 'labels.fr' && r[4] === embedded.labels.fr));
  }
  assert.equal(JSON.stringify(embedded), stored, 'language selection must not rewrite the source record');
});

test('search scope is shared by suggestions, results and demo sources and survives URL round trips', async () => {
  const { data, search, router } = await loaded();
  assert.equal(JSON.stringify(search.results('Gebäude')), JSON.stringify(data.search('Gebäude')));
  for (const kind of search.kinds()) {
    const options = search.options({ types: `${kind},${kind},unknown,__proto__` });
    assert.equal(JSON.stringify(options.kinds), JSON.stringify([kind]));
    const groups = search.results('Gebäude', options);
    assert.ok(groups.every(g => g.kind === kind));
    assert.ok(search.suggest('Gebäude', options).every(g => g.kind === kind && g.items.length <= 4));
    assert.ok(search.answer('Gebäude', options, groups).sources.every(s => s.kind === kind && groups.some(g => g.items.some(e => e.identifier === s.id))));
  }
  for (const types of ['none', '', 'constructor,unknown']) {
    const options = search.options({ types });
    assert.equal(search.results('Gebäude', options).length, 0);
    assert.equal(search.suggest('Gebäude', options).length, 0);
    assert.equal(search.answer('Gebäude', options), null);
    assert.equal(search.canSubmit('Gebäude', options), false);
  }
  const options = search.options({ types: 'tables,objects', ai: '0' });
  const parsed = router.parse(router.searchHref('Gebäude & GWR', search.params(options)));
  assert.equal(parsed.params.q, 'Gebäude & GWR');
  assert.equal(JSON.stringify(search.options(parsed.params)), JSON.stringify(options));
  assert.equal(search.answer('Gebäude', options), null);
  assert.equal(search.canSubmit('  ', options), false);
});

test('domain facets intersect content types and constrain suggestions and cited answers', async () => {
  const { data, search, router } = runtime();
  const initial = search.options(); // app initializes this before loading JSON
  await data.load('data/');
  assert.equal(search.selectedDomains(initial).length, data.domains.length);
  const options = search.options({ domains: 'energie,projekt,energie,unknown', types: 'products,tables' });
  assert.equal(search.selectedDomains(options).join(','), 'energie,projekt');
  const roundTrip = search.options(router.parse(router.searchHref('Gebäude', search.params(options))).params);
  assert.equal(JSON.stringify(roundTrip), JSON.stringify(options));
  for (const query of ['Gebäude', 'Was ist ein Gebäude?', 'Energie', 'GWR']) {
    const groups = search.results(query, options);
    for (const g of [...groups, ...search.suggest(query, options)]) {
      assert.ok(['products', 'tables'].includes(g.kind));
      assert.ok(g.items.every(e => ['energie', 'projekt'].includes(data.domainForEntity(g.kind, e)?.identifier)));
    }
    // Even a caller supplying unfiltered groups cannot leak excluded domains into citations.
    for (const source of search.answer(query, options, search.results(query)).sources) {
      assert.ok(['products', 'tables'].includes(source.kind));
      assert.ok(['energie', 'projekt'].includes(data.domainForEntity(source.kind, data.get(source.kind, source.id))?.identifier));
    }
  }
  const energy = search.options({ domains: 'energie', types: 'products' });
  assert.equal(search.results('Energie', energy)[0].items[0].identifier, 'p-energie');
  assert.equal(search.results('Gebäudebestand', energy).length, 0);
  assert.equal(search.answer('Energie', energy).sources[0].id, 'p-energie');
  assert.equal(search.results('Energie', search.options({ domains: 'energie', types: 'domains' }))[0].items[0].identifier, 'energie');
  assert.equal(search.results('GWR', search.options({ domains: 'projekt', types: 'systems' }))[0].items[0].identifier, 'gwr');
  assert.equal(search.results('GWR', search.options({ domains: 'finanzen', types: 'systems' })).length, 0);
  // Also include systems connected only through an API, and keep unassigned records in all-domains searches.
  data.systems.push({ identifier: 'api-only', name: 'Fixture-only system' });
  data.apis.push({ identifier: 'test-api', name: 'Fixture-only API', domain: 'energie', system: 'api-only' });
  assert.equal(search.results('Fixture-only', search.options({ domains: 'energie', types: 'systems' }))[0].items[0].identifier, 'api-only');
  data.products.push({ identifier: 'unassigned', name: 'Unassigned fixture', description: 'Without a domain.' });
  assert.equal(search.results('Unassigned')[0].items[0].identifier, 'unassigned');
  assert.equal(search.results('Unassigned', energy).length, 0);
  for (const domains of ['none', '', 'constructor,unknown']) {
    const empty = search.options({ domains });
    assert.equal(search.canSubmit('Gebäude', empty), false);
    assert.equal(search.results('Gebäude', empty).length, 0);
    assert.equal(search.suggest('Gebäude', empty).length, 0);
    assert.equal(search.answer('Gebäude', empty), null);
    assert.equal(search.params(empty).domains, 'none');
  }
});

test('learning examples are few, answerable, translated and constrained by the search scope', async () => {
  const { data, search, ui, views } = await loaded();
  for (const lang of ['de', 'fr', 'it', 'en']) {
    ui.setDictionary(data.i18n, lang);
    const examples = search.examples();
    assert.equal(examples.length, 4);
    assert.equal(examples[0].query, data.i18n['search.example.gwr'][lang]);
    assert.equal(search.answer(examples[0].query).sources[0].id, 'gwr');
    assert.ok(examples.every(example => search.results(example.query).length));
  }
  ui.setDictionary(data.i18n, 'de');
  const scope = search.options({ domains: 'energie', types: 'products', ai: '0' });
  assert.equal(search.examples(scope).map(e => e.query).join(','), 'Gebäude,Energieverbrauch');
  for (const options of [search.options({ domains: 'none' }), search.options({ types: 'none' })]) {
    assert.equal(search.examples(options).length, 0);
    assert.equal(search.canSuggest('', options), false);
    assert.equal(views.suggest({ query: '', suggest: true, searchOptions: options }), '');
  }
  assert.equal(search.canSuggest(''), true);
  assert.equal(search.canSubmit(''), false);
  assert.equal(views.suggest({ query: '', suggest: false }), '');
  assert.match(views.suggest({ query: '', suggest: true }), /data-action="suggest-example"/);
  assert.doesNotMatch(views.suggest({ query: 'Gebäude', suggest: true }), /suggest-example/);
});

test('mock answers handle simple questions conservatively and escape source excerpts and titles', async () => {
  const { data, search, views } = await loaded();
  const options = search.options({ types: 'tables' });
  assert.ok(search.results('Was ist ein Gebäude?', options).some(g => g.items.some(e => e.identifier === 't-gwr-gebaeude')));
  assert.ok(search.results('What is GWR?', options).length);
  const gwr = search.answer('Was ist GWR?', search.options());
  assert.equal(gwr.sources.length, 1);
  assert.equal(gwr.sources[0].id, 'gwr');
  assert.equal(search.results('Welche Gebäude enthalten verschwundeneMarsdaten?', options).length, 0);
  assert.equal(search.answer('unfindable-query', options).sources.length, 0);
  const answer = search.answer('Gebäude', options);
  const candidates = new Set(search.results('Gebäude', options).flatMap(group => group.items.map(item => item.identifier)));
  assert.ok(answer.sources.length && answer.sources.every(source => source.kind === 'tables' && candidates.has(source.id)));
  for (const source of answer.sources) {
    const description = data.get(source.kind, source.id).description.trim().replace(/\s+/g, ' ');
    assert.ok(description.startsWith(source.excerpt.replace(/…$/, '')));
  }
  data.tables[0].name = '<svg onload=alert(1)>search-fixture';
  data.tables[0].description = '<img src=x onerror=alert(1)> & literal excerpt';
  const html = views.searchAnswer('search-fixture', options);
  assert.ok(!html.includes('<svg') && !html.includes('<img'));
  assert.ok(html.includes('&lt;img') && html.includes('&lt;svg') && html.includes('&amp; literal excerpt'));
  assert.ok(html.includes('Demo') && html.includes('#/tables/' + data.tables[0].identifier));
});

test('the shipped data has no dangling references or missing record identities', async () => {
  const { data, warnings } = await loaded();
  assert.equal(warnings.length, 0);
  for (const kind of data.kinds) for (const e of data.list(kind)) {
    assert.equal(data.get(kind, e.identifier), e);
    assert.ok(e.name);
  }
});

test('tree groups and members sort by displayed labels without changing source order', async () => {
  const { data, views } = await loaded();
  const source = JSON.stringify([data.tables, data.objects, data.domains, data.systems]);
  const treeOpen = Object.fromEntries(data.sections().map(kind => [kind, true]));
  for (const kind of data.sections()) {
    for (const group of data.buildGroups(kind, kind === 'tables' ? 'system' : 'domain')) treeOpen[group.id] = true;
  }
  const html = views.tree({ view: 'home', params: {} }, { treeOpen });
  const labels = [...html.matchAll(/style="--level:(\d)"[^]*?<span class="ob-tree-label"[^>]*>([^]*?)<\/span>/g)];
  const collator = new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' });
  let group = '', member = '';
  for (const [, level, label] of labels) {
    if (level === '1') { group = ''; member = ''; }
    else if (level === '2') { assert.ok(collator.compare(group, label) <= 0, `${group} before ${label}`); group = label; member = ''; }
    else { assert.ok(collator.compare(member, label) <= 0, `${member} before ${label}`); member = label; }
  }
  assert.ok(labels.length > 50);
  assert.equal(JSON.stringify([data.tables, data.objects, data.domains, data.systems]), source);
  const fixture = data.tables.filter(table => table.system === 'sap').slice(0, 4);
  for (let i = 0; i < fixture.length; i++) fixture[i].labels = { de: ['Zulu', 'Ärea 10', 'Area 2', 'Alpha'][i] };
  const named = views.tree({ view: 'home', params: {} }, { treeOpen }, 'tables');
  assert.ok(named.indexOf('Alpha (') < named.indexOf('Area 2'));
  assert.ok(named.indexOf('Area 2') < named.indexOf('Ärea 10'));
  assert.ok(named.indexOf('Ärea 10') < named.indexOf('Zulu ('));
});

test('information links are safe, optional and preserved in Excel metadata across profiles', async () => {
  const { data, detail, excel, ui } = await loaded();
  const urls = ['https://example.org/reference?a=1&b=2', 'https://example.org/second'];
  for (const kind of ['tables', 'objects', 'refs']) {
    const entity = { ...data.list(kind)[0], kind, sourceUrl: urls[0], informationUrls: [...urls, urls[0], 'javascript:alert(1)', null, 'https://example.org/\ninvalid'] };
    const html = detail.overview(entity);
    assert.ok(html.includes('Weitere Informationen'));
    assert.equal((html.match(/href="https:\/\/example.org\/reference/g) || []).length, 1);
    assert.ok(html.includes('a=1&amp;b=2'));
    assert.ok(html.includes('target="_blank" rel="noopener"'));
    assert.ok(!html.includes('javascript:') && !html.includes('/invalid'));
    for (const informationUrls of [undefined, [], ['javascript:alert(1)']]) {
      const empty = detail.overview({ ...entity, informationUrls });
      assert.ok(!empty.includes('ob-fact-links'));
      assert.ok(empty.includes('<dt>Weitere Informationen</dt><dd><span>—</span></dd>'));
      if (kind === 'tables' || kind === 'refs') {
        assert.ok(!empty.includes('<dt>Quelldokument</dt>') && !empty.includes('<dt>Quellenstand</dt>'));
      }
    }
    entity.informationUrls = urls;
    const plan = excel.plan({ view: 'detail', kind, entity }, { title: entity.name, state: { tableSorts: {} } }, 'http://localhost/');
    assert.ok(plan.sheets.find(sheet => sheet.name === 'Metadaten').rows.some(row => row[3] === 'informationUrls' && row[4] === JSON.stringify(urls)));
  }
  for (const lang of ['de', 'fr', 'it', 'en']) {
    ui.setDictionary(data.i18n, lang);
    for (const table of data.tables) {
      const facts = detail.facts({ ...table, kind: 'tables' }).primary;
      assert.ok(!facts.some(fact => [ui.t('fact.sourceDocument'), ui.t('fact.sourceDetail')].includes(fact.label)));
      if (table.sourceUrl) assert.ok(table.informationUrls.includes(table.sourceUrl));
    }
    assert.equal(data.columns('refs').find(column => column.id === 'normReference').label, ui.t('fact.normReference'));
    for (const ref of data.refs) {
      const facts = detail.facts({ ...ref, kind: 'refs' }).primary;
      assert.equal(facts.find(fact => fact.label === ui.t('fact.normReference')).value, ref.normReference);
      assert.ok(!facts.some(fact => [ui.t('fact.sourceDocument'), ui.t('fact.sourceDetail')].includes(fact.label)));
      assert.equal(data.cols('refs', ref)[0], ref.normReference);
      if (ref.sourceUrl) assert.ok(ref.informationUrls.includes(ref.sourceUrl));
    }
  }
});

test('comments belong to each entity and render safely in core facts and Excel', async () => {
  const { data, detail, excel } = await loaded();
  const comment = 'Review <script> & field mapping\nSecond line';
  for (const kind of data.kinds) {
    const entity = { ...data.list(kind)[0], kind, comment };
    assert.equal(detail.facts(entity).primary.find(fact => fact.label === 'Kommentar').value, comment);
    const html = detail.overview(entity);
    assert.ok(html.includes('Review &lt;script&gt; &amp; field mapping\nSecond line'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!detail.overview({ ...entity, comment: '  ' }).includes('ob-comment'));
    assert.ok(detail.overview({ ...entity, comment: '  ' }).includes('<dt>Kommentar</dt><dd><span>—</span></dd>'));
  }
  const table = data.tables[0], object = data.objects[0];
  table.comment = 'Parent table only'; object.comment = 'Parent object only';
  const fieldId = `${table.identifier}/${data.fieldId(table.fields[0])}`;
  const attrId = `${object.identifier}/${object.attributes[0].identifier}`;
  assert.equal(data.field(fieldId).comment, undefined);
  assert.equal(data.attr(attrId).comment, undefined);
  table.fields[0].comment = comment; object.attributes[0].comment = comment;
  for (const [kind, entity] of [['fields', data.field(fieldId)], ['attrs', data.attr(attrId)]]) {
    entity.kind = kind;
    assert.equal(detail.facts(entity).primary.find(fact => fact.type === 'comment').value, comment);
    const plan = excel.plan({ view: 'detail', kind, entity }, { title: entity.name, state: {} }, 'http://localhost/');
    assert.ok(plan.sheets.find(sheet => sheet.name === 'Metadaten').rows.some(row => row[3] === 'comment' && row[4] === comment));
  }
});

test('SAP catalog curation excludes rejected classes and preserves source evidence separately', async () => {
  const { data } = await loaded();
  const tables = data.tables.filter(table => table.provenance?.importId === 'sap-refx-innovator-model');
  assert.equal(tables.length, 7);
  assert.equal(tables.reduce((sum, table) => sum + table.fields.length, 0), 142);
  assert.ok(tables.every(table => table.modelView !== 'usage'));
  const report = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/sap-refx/sap-refx-import-report.json'), 'utf8'));
  const definitions = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/sap-refx/sap-refx-definitions.json'), 'utf8'));
  for (const definition of definitions.entries) {
    const table = data.get('tables', definition.tableId);
    assert.equal(table.description, definition.description);
    assert.equal(table.descriptionSource.kind, definition.kind);
    assert.ok(table.informationUrls.includes(definition.sourceUrl));
    assert.ok(table.comment);
  }
  assert.ok(data.get('tables', 't-sap-area').comment.includes('Ungeklärte Diagrammklasse'));
  assert.ok(data.get('apis', 'api-sap-building').comment.includes('SAP-Frontend'));
  for (const change of report.catalogCuration.changes) assert.equal(data.get('tables', change.tableId), null);
  const building = data.get('tables', 't-sap-building');
  assert.equal(building.fields.length, 66);
  assert.equal(building.technicalName, 'VIBDBU');
  assert.equal(data.displayName('tables', building), 'Gebäude (VIBDBU)');
  const land = data.get('tables', 't-sap-land-architecture');
  assert.equal(land.technicalName, undefined);
  assert.equal(data.displayName('tables', land), 'Grundstück');
  const businessEntity = data.get('tables', 't-sap-business-entity');
  assert.equal(data.displayName('tables', businessEntity), 'Wirtschaftseinheit (VIBDBE)');
  assert.equal(businessEntity.realizes, 'wirtschaftseinheit');
  assert.equal(businessEntity.domain, 'finanzen');
  assert.equal(businessEntity.fieldScope, 'datasource-projection');
  assert.equal(businessEntity.dataSource, '0BUSENTITY_ATTR');
  assert.equal(businessEntity.fields.map(field => field.technicalName).join(','), 'BUKRS,SWENR,SINSTBEZ,SLAGEWE,SOBJLAGE,SMIETSP,SMIETR,SSTDORT,KOKRS');
  assert.ok(businessEntity.fields.every(field => field.technicalNameKind === 'datasource-field' && field.catalogMetadata.sourceTable === 'VIBDBE'));
  assert.ok(businessEntity.fields.every(field => field.dataType === undefined && field.mandatory === undefined && field.keyRole === null && field.apiMappings === undefined));
  assert.equal(data.field('t-sap-business-entity/SWENR').name, 'Wirtschaftseinheit (SWENR)');
  assert.equal(businessEntity.modelClass, undefined, 'the rejected diagram class is not republished');
  for (const [id, name, technicalName, source, fieldIds, realizes] of [
    ['t-sap-rental-object', 'Mietobjekt', 'VIBDRO', '0RENTOBJECT_ATTR', 'BUKRS,SWENR,SMENR,SGENR,SGRNR,SNUNR,ROTYPE,SGEBT,XAUSTKL,XLAGE,RLGESCH,KOKRS', 'mietobjekt'],
    ['t-sap-contract', 'Vertrag', 'VICNCN', '0RECONTRACT_ATTR', 'BUKRS,RECNNR,RECNTYPE,RECNBEG,RECNENDABS,RECNTLAW,RECNNOTPER,RECNNOTREASON,SRRELEVANT', undefined],
  ]) {
    const table = data.get('tables', id);
    assert.equal(data.displayName('tables', table), `${name} (${technicalName})`);
    assert.equal(table.realizes, realizes);
    assert.equal(table.domain, 'miete');
    assert.equal(table.modelClass, undefined);
    assert.equal(table.dataSource, source);
    assert.equal(table.fieldScope, 'datasource-projection');
    assert.equal(table.fields.map(field => field.technicalName).join(','), fieldIds);
    assert.ok(table.informationUrls.includes(table.sourceUrl));
    assert.ok(table.fields.every(field => field.technicalNameKind === 'datasource-field' && field.catalogMetadata.sourceTable === technicalName));
    assert.ok(table.fields.every(field => field.labels.de && field.dataType === undefined && field.mandatory === undefined && field.keyRole === null && field.apiMappings === undefined));
  }
  const object = data.get('tables', 't-sap-architectural-object');
  assert.equal(object.technicalName, 'VIBDAO');
  assert.equal(data.displayName('tables', object), 'Architektonisches Objekt (VIBDAO)');
  assert.equal(object.fields.length, 24);
  assert.equal(object.objectTypes.map(type => type.name).join(','), 'Ebene,Raum');
  assert.ok(object.fields.every(field => field.appliesToObjectTypes.length === 1));
  for (const type of object.objectTypes) {
    assert.equal(type.fieldIds.length, type.name === 'Ebene' ? 1 : 23);
    assert.ok(type.fieldIds.every(id => data.field(`${object.identifier}/${id}`).appliesToObjectTypes.includes(type.name)));
  }
  assert.equal(data.field('t-sap-building/EGID'), null, 'the API projection must not invent EGID coverage');
  assert.equal(data.field('t-sap-building/BUILDING_TEXT').dataType, undefined, 'the shifted API type must not be imported');
  assert.equal(data.displayName('fields', building.fields.find(field => field.technicalName === 'CONSTRUCTION_YEAR')), 'Baujahr (CONSTRUCTION_YEAR)');
  const api = data.get('apis', 'api-sap-building');
  assert.equal(api.modelMappings.length, 0, 'archived source candidates must not link to retired catalog tables');
  assert.equal(api.sourceReconciliation.candidateModelFields, 75);
  assert.equal(api.documentedFieldMappings.length, 66);
  for (const mapping of api.documentedFieldMappings) {
    const field = data.field(`${mapping.table}/${mapping.fieldId}`);
    assert.equal(field.technicalName, mapping.field);
    assert.equal(field.technicalNameKind, 'api-field');
    assert.equal(mapping.physicalColumnVerified, false);
    assert.equal(mapping.structure, 'BUILDING');
  }
  assert.equal(report.reconciliation.summary.modelFields, 508);
  const ambiguous = report.reconciliation.candidates.find(match => match.modelAttribute === 'Umbaujahr');
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.targets.length, 2);
  assert.ok(!report.reconciliation.candidates.some(match => match.modelAttribute === 'EGID'));
  assert.equal(api.modelCoverage.candidateModelFields, api.modelMappings.length);
  assert.equal(api.modelCoverage.verifiedPhysicalTableMappings, 0);
});

test('GIS workbook preserves every source row, ambiguous field names and typed land coverage', async () => {
  const { data, detail } = await loaded();
  const report = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/gis-immo/gis-immo-import-report.json'), 'utf8'));
  const expected = { 't-geb-gis': 74, 't-boden': 46, 't-parzelle': 42, 't-huelle': 30, 't-gis-room': 32, 't-proj': 27, 't-gis-green-area': 24 };
  const tables = data.tablesOfSystem(data.sysOf('gis'));
  assert.equal(tables.length, 7);
  assert.equal(report.summary.fieldRows, 275);
  assert.deepEqual(report.summary.sourceStatuses, { LIVE: 131, DEV: 143, unspecified: 1 });
  const visited = [];
  for (const table of tables) {
    assert.equal(table.fields.length, expected[table.identifier]);
    assert.equal(table.status, 'Entwurf');
    assert.equal(table.technicalName, undefined);
    assert.equal(table.fieldScope, 'model-inventory');
    assert.ok(table.comment);
    for (const field of table.fields) {
      const source = report.sourceRows.find(row => row.row === field.catalogMetadata.sourceRow);
      assert.equal(field.technicalName, source.technicalName);
      assert.equal(field.labels.de, source.labelDe);
      assert.equal(field.labels.en, source.labelEn || undefined);
      assert.equal(field.description, source.description || '');
      assert.equal(field.dataType, source.format);
      assert.equal(field.sourceStatus, source.status || undefined);
      assert.equal(field.catalogMetadata.origin, source.origin);
      assert.equal(field.keyRole, null);
      assert.equal(field.mandatory, undefined);
      assert.equal(field.nullable, undefined);
      assert.equal(field.length, undefined);
      assert.equal(field.codeList, undefined);
      assert.equal(field.apiMappings, undefined);
      assert.ok(data.field(`${table.identifier}/${data.fieldId(field)}`));
      visited.push(source.row);
    }
  }
  assert.equal(new Set(visited).size, 275);
  const duplicate = data.get('tables', 't-geb-gis').fields.filter(field => field.technicalName === 'bbl_hist');
  assert.equal(duplicate.length, 2);
  assert.equal(duplicate.map(field => data.fieldId(field)).join(','), 'bbl_hist-source-41,bbl_hist-source-42');
  assert.ok(duplicate.every(field => field.comment.includes('zweimal')));
  const ground = data.get('tables', 't-boden');
  assert.equal(ground.name, 'Bodenabdeckung');
  assert.equal(ground.realizes, 'bodenbedeckung');
  assert.equal(ground.objectTypes[0].name, 'Gebäude');
  assert.equal(ground.objectTypes[0].geometryType, 'Polygon');
  assert.equal(ground.objectTypes[0].sourceClass, 'BBL Gebäude (AO)');
  assert.equal(ground.objectTypes[0].fieldIds.length, 46);
  assert.ok(ground.fields.every(field => field.appliesToObjectTypes.join(',') === 'Gebäude'));
  assert.equal(data.get('tables', 't-gis-building-ao'), null);
  assert.equal(data.field('t-geb-gis/wgs84_lat').dataType, 'String');
  assert.equal(data.field('t-gis-room/ao_id').source, 'BBL SAP Korasoft');
  const room = { ...data.field('t-gis-room/ao_id'), kind: 'fields' };
  assert.equal(room.sourceStatus, 'DEV');
  assert.ok(!detail.facts(room).primary.some(fact => fact.label === 'Status in Quelle'));
  assert.equal(data.field('t-gis-green-area/bbl_port').sourceStatus, undefined);
  assert.ok(data.field('t-gis-green-area/bbl_port').comment.includes('nicht angegeben'));
  assert.equal(report.replacedCatalog.tables.length, 5);
  assert.equal(report.retiredTableIds.length, 0);
});

test('AV keeps model classes, service fields and geometry evidence separate', async () => {
  const { data, detail } = await loaded();
  const report = JSON.parse(fs.readFileSync(path.join(root, 'docs/sources/av/av-import-report.json'), 'utf8'));
  const tables = data.tables.filter(table => table.system === 'av');
  assert.equal(tables.length, 8);
  assert.equal(tables.reduce((sum, table) => sum + table.fields.length, 0), 49);
  assert.equal(report.fieldCount, 49);
  assert.equal(report.valueCount, 45);
  for (const [file, expected] of Object.entries(report.provenance.files)) {
    const actual = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'docs/sources/av', file))).digest('hex');
    assert.equal(actual, expected, file);
  }
  assert.equal(tables.filter(table => table.technicalNameKind === 'model-class').length, 6);
  assert.equal(tables.filter(table => table.technicalNameKind === 'service-layer').length, 2);
  assert.ok(tables.every(table => table.status === 'Entwurf'));
  const property = data.get('tables', 't-av-property');
  assert.equal(property.modelIdentifiers.join(), 'NBIdent, Nummer');
  assert.equal(property.fields.find(field => field.technicalName === 'EGRIS_EGRID').mandatory, false);
  assert.ok(!property.fields.some(field => field.technicalName === 'Geometrie'));
  const parcel = data.get('tables', 't-av-parcel');
  assert.ok(!parcel.fields.some(field => field.technicalName === 'EGRIS_EGRID' || field.technicalName === 'Linienart'));
  const geometry = parcel.fields.find(field => field.technicalName === 'Geometrie');
  assert.match(geometry.dataType, /^AREA WITH \(STRAIGHTS, ARCS\)/);
  assert.equal(geometry.catalogMetadata.lineAttributes[0].codeList, 'r-av-boundary-line-type');
  const cover = data.get('refs', 'r-av-land-cover-type');
  assert.equal(cover.values.length, 26);
  assert.ok(cover.values.some(value => value.code === 'humusiert.Intensivkultur.Reben'));
  assert.ok(!cover.values.some(value => value.code === 'humusiert'));
  for (const table of tables.filter(table => table.technicalNameKind === 'service-layer')) {
    assert.ok(table.fields.every(field => field.technicalNameKind === 'api-field' && field.dataTypeKind === 'service-schema'));
    assert.ok(table.fields.every(field => field.mandatory === undefined && field.nullable === undefined && field.codeList === undefined));
    assert.equal(table.fields[0].dataType, 'gml:GeometryPropertyType');
  }
  const api = data.get('apis', 'api-av-geoadmin');
  assert.equal(data.displayName('apis', api), api.name, 'unknown API version is not rendered as undefined');
  assert.ok(api.verification.every(check => check.httpStatus === 200 && check.geometryTypes.includes('Polygon')));
  assert.ok(data.get('apis', 'api-av-features').verification.every(check => check.httpStatus === 403 && check.geometryVerified === false));
  assert.ok(data.get('apis', 'api-av-wms').servicePurpose === 'map-image');
  const html = detail.overview({ ...data.field('t-av-service-parcel/EGRIS_EGRID'), kind: 'fields' });
  assert.ok(html.includes('<dt>Pflichtfeld</dt><dd><span>—</span></dd>'));
});

test('retired samples stay absent and field profiles omit the requested source facts', async () => {
  const { data, detail } = await loaded();
  for (const id of ['r-geak', 'r-geschoss', 'r-raum', 'r-sia-nutz']) assert.equal(data.get('refs', id), null);
  for (const id of ['api-geo', 'api-immo', 'api-opendata']) assert.equal(data.get('apis', id), null);
  assert.equal(data.validate().length, 0);
  for (const id of ['t-boden/ao_id', 't-gwr-gebaeude/EGID']) {
    const field = { ...data.field(id), kind: 'fields' };
    const labels = detail.facts(field).primary.map(fact => fact.label);
    for (const label of ['Position', 'Status in Quelle', 'Objekttypen', 'Zugriffskategorie (GWR)', 'Stammdaten (GWR)', 'Quellenstand']) assert.ok(!labels.includes(label), label);
  }
  assert.ok(!detail.facts({ ...data.attr('gebaeude/egid'), kind: 'attrs' }).primary.some(fact => fact.label === 'Position'));
});

test('GWR import preserves source coverage, versions and explicit field-to-code-list links', async () => {
  const { data, detail } = await loaded();
  for (const kind of data.kinds) for (const entity of data.list(kind)) {
    assert.equal(entity.status, entity.provenance?.importId === 'gwr-catalog-5.0' ? 'Gültig' : 'Entwurf');
  }
  assert.equal(data.get('tables', 't-gwr-gebaeude').description, 'Ein Gebäude ist ein auf Dauer angelegter, mit einem Dach versehener, mit dem Boden fest verbundener Bau, der Personen aufnehmen kann und zu Wohnzwecken oder Zwecken der Arbeit, der Ausbildung, der Kultur, des Sports oder jeg¬licher anderer menschlicher Tätigkeit dient; ein Doppel-, Gruppen- und Reihenhaus zählt ebenfalls als ein Gebäude, wenn es einen eigenen Zugang von aussen hat und wenn zwischen den Gebäuden eine senkrechte vom Erdgeschoss bis zum Dach reichende tragende Trennmauer besteht.');
  const imported = data.tablesOfSystem(data.sysOf('gwr'));
  const expected = { bauprojekt: 37, arbeiten: 10, gebaeude: 39, waermeerzeugungsanlage: 17, gebaeudeeingang: 9, wohnung: 24, strasse: 10 };
  assert.equal(imported.length, 7);
  const project = data.domainOf('projekt');
  assert.equal(data.objectsOfDomain(project).map(o => o.identifier).join(','), 'bauprojekt,meilenstein,phase,bauarbeiten');
  assert.equal(data.tablesOfDomain(project).map(e => e.identifier).join(','), 't-proj,t-gwr-bauprojekt,t-gwr-arbeiten');
  assert.equal(data.refsOfDomain(project).length, 15);
  for (const [id, objectId] of [['t-gwr-bauprojekt', 'bauprojekt'], ['t-gwr-arbeiten', 'bauarbeiten']]) {
    const table = data.get('tables', id), object = data.get('objects', objectId);
    assert.equal(table.realizes, objectId);
    assert.equal(object.description, table.description);
    assert.equal(object.sourceUrl, table.sourceUrl);
    assert.equal(object.status, 'Entwurf');
    assert.ok(detail.facts({ ...object, kind: 'objects' }).primary.some(f => String(f.value).includes('lokale Modellierungsbeispiele')));
    for (const field of table.fields.filter(f => f.codeList)) {
      assert.equal(data.get('refs', field.codeList).businessObject, objectId);
    }
  }
  for (const [slug, count] of Object.entries(expected)) {
    const table = data.get('tables', 't-gwr-' + slug);
    assert.equal(table.fields.length, count);
    assert.ok(table.sourceUrl.includes('#beschreibung-der-entitaet-'));
    assert.equal(new Set(table.fields.map(f => f.technicalName)).size, count);
    assert.ok(data.domainForEntity('tables', table));
    const groups = data.relations('tables', table);
    assert.equal(groups.find(g => g.key === 'sourceSystem').items[0].href, '#/systems/gwr');
    const refs = new Set(table.fields.map(f => f.codeList).filter(Boolean));
    assert.equal(groups.find(g => g.key === 'usesCodelists').items.length, refs.size);
    for (const field of table.fields) {
      assert.ok(field.labels.de && field.description && field.dataType && field.sourceUrl);
      assert.ok(!JSON.stringify(field).includes('\uFFFD'), 'UTF-8 must be decoded without replacement characters');
      if (!field.codeList) continue;
      const ref = data.get('refs', field.codeList);
      assert.ok(ref);
      assert.equal(new Set(ref.values.map(v => v.code)).size, ref.values.length);
      assert.ok(data.relations('refs', ref).find(g => g.key === 'usedInTables').items.some(i => i.href.endsWith(table.identifier)));
      assert.ok(detail.rowsContext({ ...table, kind: 'tables' }, { params: {} }, { tableSorts: {} }).rows.some(r => r.cells.some(c => typeof c === 'string' && c.includes('#/refs/' + ref.identifier))));
    }
  }
  const kat = data.get('refs', 'r-gwr-kat');
  assert.equal(kat.values.length, 6);
  assert.equal(kat.values.find(v => v.code === '1010').label, 'Provisorische Unterkunft');
  assert.ok(!kat.values.some(v => v.code === '1021'), '3.7-only codes must not leak into the revised catalog');
  assert.equal(data.get('refs', 'r-gwr-gklas').version, '4.2');
  const floors = data.get('refs', 'r-gwr-wstwk').values;
  assert.equal(floors.length, 119);
  assert.equal(floors[0].code, '3100');
  assert.equal(floors.at(-1).code, '3419');
  assert.ok(!floors.some(v => v.code === '3301'), 'old attic codes are outside the revised floor ranges');
  const unmapped = { ...data.get('tables', 't-gwr-arbeiten'), kind: 'tables' };
  assert.ok(!detail.overview(unmapped).includes('#/objects/undefined'));
  assert.equal(detail.facts(unmapped).protection.find(f => f.label === 'Personendaten').value, null, 'unknown register data classification must not become No');
  assert.ok(detail.overview(unmapped).includes('<dt>Personendaten</dt><dd><span>—</span></dd>'));
});

test('loading rejects broken collection and embedded-list shapes with useful locations', async () => {
  const cases = [
    ['objects.json', () => ({}), /objects\.json.*array/i],
    ['objects.json', v => { v[0] = null; }, /objects\.json\[0\]/],
    ['objects.json', v => { v[0].name = 12; }, /objects\.json\[0\].name/],
    ['objects.json', v => { v[0].attributes = {}; }, /attributes.*array/i],
    ['objects.json', v => { v[0].attributes[0] = null; }, /attributes\[0\]/],
    ['products.json', v => { v[0].basedOn = [null]; }, /basedOn\[0\]/],
    ['tables.json', v => { delete v[0].fields[0].technicalName; }, /fields\[0\]\.technicalName/],
    ['tables.json', v => { v[0].fields[0].technicalName = ' '; }, /fields\[0\]\.technicalName/],
    ['tables.json', v => { v[0].fields[0].labels = 'Mandant'; }, /fields\[0\]\.labels/],
    ['tables.json', v => { v[0].fields[0].labels = { fr: 'Mandant' }; }, /fields\[0\]\.labels.de/],
    ['tables.json', v => { v[0].fields[0].labels.fr = {}; }, /fields\[0\]\.labels.fr/],
    ['tables.json', v => { v[0].fields[0].labels.it = ''; }, /fields\[0\]\.labels.it/],
    ['tables.json', v => { v[0].fields[0].labels.xx = 'Invalid language'; }, /unsupported language xx/],
  ];
  for (const [file, edit, error] of cases) {
    const { data } = runtime((name, value) => name === file ? edit(value) : value);
    await assert.rejects(data.load('data/'), error);
  }
});

test('duplicate entity and attribute IDs are rejected instead of silently overwriting lookups', async () => {
  for (const nested of [false, true]) {
    const { data } = runtime((name, v) => {
      if (name === 'objects.json') {
        if (nested) v[0].attributes.push({ ...v[0].attributes[0] });
        else v.push({ ...v[0] });
      }
    });
    await assert.rejects(data.load('data/'), /duplicate.*identifier/i);
  }
});

test('absent optional lists are normalized and broken references remain diagnosable', async () => {
  const { data, warnings } = await loaded((name, v) => {
    if (name === 'objects.json') { delete v[0].attributes; delete v[0].termdat; }
    if (name === 'tables.json') { v[0].realizes = 'missing-object'; delete v[0].domain; }
  });
  assert.equal(data.objects[0].attributes.length, 0);
  assert.equal(data.domainForEntity('tables', data.tables[0]), null);
  assert.match(warnings[0], /missing-object/);
});

test('a rejected reload leaves the previous catalog and lookup index intact', async () => {
  let broken = false;
  const { data } = await loaded((name, v) => name === 'objects.json' && broken ? {} : v);
  const previous = data.objects;
  broken = true;
  await assert.rejects(data.load('data/'));
  assert.equal(data.objects, previous);
  assert.equal(data.get('objects', 'areal'), previous[0]);
});

test('catalog links validate URL protocols as well as escaping HTML', async () => {
  const { ui, data, detail, views } = await loaded();
  for (const href of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'java\nscript:alert(1)', 'data:text/html,test', 'vbscript:msgbox(1)']) {
    assert.equal(ui.safeHref(href), null, href);
    const html = detail.overview({ ...data.apis[0], kind: 'apis', documentation: href });
    assert.ok(!html.includes('href="' + ui.esc(href) + '"'));
  }
  for (const href of ['#/objects/areal', 'https://example.org/a?x=1&y=2', 'mailto:a@example.org', 'tel:+41310000000']) {
    assert.equal(ui.safeHref(href), href);
  }
  data.config.footerLinks = [{ label: '<script>', url: 'javascript:alert(1)' }];
  assert.ok(!views.footer().includes('javascript:'));
  assert.ok(views.footer().includes('&lt;script&gt;'));
  assert.ok(!ui.icon('x" onclick="bad()').includes(' onclick="'));
  assert.ok(!ui.chip('label', 'x" onclick="bad()').includes(' onclick="'));
});

test('Excel workbooks contain complete scoped GWR data and retain explicit cell types', async () => {
  const { data, excel } = await loaded();
  const ExcelJS = require('../vendor/exceljs/exceljs.min.js');
  const profile = (kind, id) => {
    const e = { ...data.get(kind, id), kind };
    return excel.plan({ view: 'detail', kind, entity: e, params: {} }, { title: e.name, state: { tableSorts: {} }, filter: '' }, 'http://localhost/prototype/#/' + kind + '/' + id);
  };
  const plan = profile('systems', 'gwr');
  const rows = name => plan.sheets.find(s => s.name === name).rows;
  assert.equal(rows('Datentabellen').length, 7);
  assert.equal(rows('Felder').length, 146);
  assert.equal(rows('Referenzdaten').length, 48);
  assert.equal(rows('Werte').length, 467);
  assert.ok(rows('Quelldokumentation').some(r => r[1] === 'EGID' && r[3].includes('gesamtschweizerisch eindeutige')));
  assert.ok(rows('Metadaten').some(r => r[3] === 'contact.url' && r[4] === 'https://www.housing-stat.ch/de/home.html'));
  assert.ok(!rows('Metadaten').some(r => ['contact.email', 'contact.phone'].includes(r[3])));
  assert.equal(new Set(rows('Felder').map(r => r[0] + '/' + r[2])).size, 146);
  const workbook = excel.createWorkbook(plan, ExcelJS);
  const buffer = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  assert.equal(reopened.getWorksheet('Felder').rowCount, 147);
  assert.equal(reopened.getWorksheet('Felder').views[0].ySplit, 1);
  assert.ok(reopened.getWorksheet('Felder').autoFilter);
  assert.equal(reopened.getWorksheet('Felder').getCell('J2').type, ExcelJS.ValueType.Number);
  assert.equal(reopened.getWorksheet('Werte').getCell('C2').type, ExcelJS.ValueType.String);
  assert.equal(reopened.getWorksheet('Felder').getCell('P2').hyperlink, 'http://localhost/prototype/#/tables/t-gwr-bauprojekt/fields/EPROID');
  assert.equal(profile('fields', 't-gwr-gebaeude/GKAT').sheets.find(s => s.name === 'Felder').rows.length, 1);
  assert.equal(profile('fields', 't-gwr-gebaeude/GKAT').sheets.find(s => s.name === 'Werte').rows.length, 6);
  const project = profile('domains', 'projekt');
  assert.equal(project.sheets.find(s => s.name === 'Geschäftsobjekte').rows.length, 4);
  assert.equal(project.sheets.find(s => s.name === 'Attribute').rows.length, 25);
  // Also leave a real artifact for an independent openpyxl compatibility check.
  fs.writeFileSync(path.join(require('node:os').tmpdir(), 'oblique-gwr.xlsx'), buffer);
});

test('Excel catalog scope ignores view filters and includes all sections and parent-scoped children', async () => {
  const { data, excel, views, ui } = await loaded();
  data.products.slice(0, 2).forEach(product => product.attributes.push({ identifier: 'shared-id', name: 'Shared attribute', description: product.name }));
  const route = { view: 'list', kind: 'objects', params: { page: '2' } };
  const ctx = { isList: true, kind: 'objects', title: 'Filtered objects', groups: [], filter: 'No match', state: { tableSorts: {} } };
  const url = 'http://localhost/prototype/#/objects?filter=No%20match&page=2';
  const selected = excel.plan(route, ctx, url);
  assert.equal(selected.sheets.find(s => s.name === 'Geschäftsobjekte').rows.length, 0);
  assert.equal(selected.sheets.some(s => s.name === 'Systeme'), false);
  const plan = excel.plan(route, ctx, url, { scope: 'catalog' });
  const rows = name => plan.sheets.find(s => s.name === name).rows;
  for (const kind of data.kinds) {
    const actual = rows(data.kindDef(kind).plural);
    assert.equal(actual.length, data.list(kind).length, kind);
    assert.equal(new Set(actual.map(row => row[0])).size, actual.length, kind + ' unique IDs');
    assert(actual.every(row => row[8] === 'Ausgewählt'));
  }
  assert.equal(rows('Felder').length, data.tables.reduce((sum, e) => sum + e.fields.length, 0));
  assert.equal(rows('Attribute').length, [...data.objects, ...data.products].reduce((sum, e) => sum + e.attributes.length, 0));
  assert.equal(rows('Attribute').filter(row => row[3] === 'shared-id').length, 2);
  assert.equal(rows('Werte').length, data.refs.reduce((sum, e) => sum + e.values.length, 0));
  assert.equal(rows('Übersicht').find(row => row[0] === 'Suchfilter')[1], '');
  assert.equal(rows('Übersicht').find(row => row[0] === 'Ausgewählte Einträge')[1], data.kinds.reduce((sum, kind) => sum + data.list(kind).length, 0));
  assert.equal(plan.filename, 'gesamter-katalog.xlsx');
  const profile = excel.plan({ view: 'detail', entity: { ...data.objects[0], kind: 'objects' } }, ctx, url, { scope: 'catalog' });
  assert.equal(JSON.stringify(profile.sheets.slice(1)), JSON.stringify(plan.sheets.slice(1)), 'Originating route does not change catalog export');
  const before = JSON.stringify(plan);
  data.objects[0].name = 'Changed after capture'; data.tables[0].fields[0].description = 'Changed after capture';
  ui.setDictionary(data.i18n, 'fr');
  assert.equal(JSON.stringify(plan), before, 'Plan is independent of later data and language changes');
  const menu = views.actionsMenu({ actions: [{ id: 'xlsx', label: 'Selection' }, { id: 'xlsx-all', label: 'Catalog' }], state: { menu: 'actions', exporting: true } });
  assert.equal((menu.match(/ disabled/g) || []).length, 2, 'Both modes are disabled during an export');
  assert.throws(() => excel.plan(route, ctx, url, { scope: 'unknown' }), /Unknown Excel export scope/);
});

test('Excel preserves formula-like strings, zero-prefixed codes, Unicode and oversized source text', async () => {
  const { excel } = await loaded();
  const ExcelJS = require('../vendor/exceljs/exceljs.min.js');
  const strings = ['00123', '=1+2', '+1', '-2', '@SUM(A1)', '\t=1', '＝1+1', 'Gebäude; "Text"\nZürich'];
  const long = 'GWR 🏠 Beschreibung\n'.repeat(4000);
  const plan = { title: 'Test', longTextName: 'Langtexte', continuation: 'Vollständiger Text', sheets: [
    {name: 'Data/invalid:*?[]', columns: [{label: 'Text', width: 50}], rows: [...strings.map(s => [s]), [-12], [long], [{ formula: '1+1' }]]},
    {name: 'data/INVALID:*?[]', columns: [{label: 'Link', width: 40, type: 'link'}], rows: [['javascript:alert(1)']]},
    {name: 'Langtexte', columns: [{label: 'Other', width: 40}], rows: [['A worksheet sharing the continuation-sheet name']]},
  ] };
  const wb = excel.createWorkbook(plan, ExcelJS);
  const reopened = new ExcelJS.Workbook(); await reopened.xlsx.load(await wb.xlsx.writeBuffer());
  const first = reopened.worksheets[0];
  strings.forEach((s, i) => { assert.equal(first.getCell(i + 2, 1).value, s); assert.equal(first.getCell(i + 2, 1).type, ExcelJS.ValueType.String); });
  assert.equal(first.getCell(strings.length + 2, 1).value, -12);
  assert.equal(first.getCell(strings.length + 4, 1).type, ExcelJS.ValueType.String);
  assert.equal(reopened.worksheets[1].getCell('A2').hyperlink, undefined);
  assert.equal(new Set(reopened.worksheets.map(s => s.name.toLowerCase())).size, reopened.worksheets.length);
  assert.ok(reopened.worksheets[1].name.endsWith('(2)'));
  assert.ok(first.getCell(strings.length + 3, 1).value.includes('Langtexte / T1'));
  const parts = []; reopened.getWorksheet('Langtexte').eachRow((r, n) => { if (n > 1) parts.push(r.getCell(6).value); });
  assert.equal(parts.join(''), long);
});

test('sorting is stable, numeric-aware and keeps missing values last in both directions', () => {
  const { ui } = runtime();
  const rows = [{ n: 'Item 10', id: 1 }, { n: 'Item 2', id: 2 }, { n: '', id: 3 }, { n: 'item 2', id: 4 }];
  assert.equal(ui.sortRows(rows, { column: 0, direction: 'asc' }, e => [e.n]).map(e => e.id).join(','), '2,4,1,3');
  assert.equal(ui.sortRows(rows, { column: 0, direction: 'desc' }, e => [e.n]).map(e => e.id).join(','), '1,2,4,3');
  assert.equal(rows[0].id, 1);
});

test('relationship bubbles and captions never overlap and large groups have bounded, paged layouts', async () => {
  const { data, graph } = await loaded();
  const verify = layout => {
    const boxes = [layout.hub, ...layout.panels];
    for (const a of boxes) {
      assert(a.x >= 0 && a.y >= 0 && a.x + a.width <= layout.width && a.y + a.height <= layout.height);
      for (const b of boxes) if (a !== b) {
        assert(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, 'overlapping bubbles or captions');
      }
    }
  };
  for (const kind of data.kinds) for (const e of data[kind]) {
    verify(graph.layout({ ...e, kind }));
    verify(graph.layout({ ...e, kind }, {}, true));
  }
  const entity = { ...data.domainOf('bau'), kind: 'domains' };
  const groups = data.relations(entity.kind, entity);
  data.relations = () => groups.map(g => ({ ...g, items: Array.from({ length: 1000 }, () => g.items[0]) }));
  const layout = graph.layout(entity, { pages: { [groups[0].key]: 999 } });
  verify(layout);
  assert.equal(layout.panels[0].page, 166);
  assert.equal(layout.panels[0].pages, 167);
  data.relations = () => groups.map(g => ({ ...g, items: Array.from({ length: 10000 }, () => g.items[0]) }));
  const larger = graph.layout(entity);
  assert.equal(larger.width, layout.width, 'orbit width must not grow with paged entries');
  assert.equal(larger.height, layout.height, 'orbit height must not grow with paged entries');
  const phone = graph.layout(entity, {}, true, 356);
  verify(phone);
  assert(phone.width <= 356, 'phone bubbles must fit at readable scale');
  assert.equal(phone.panels[0].pageSize, 3);
  data.relations = () => [];
  verify(graph.layout(entity));
});
