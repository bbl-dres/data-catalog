/* Run: node --test prototype-oblique/tests/core.test.cjs (no dependencies). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function runtime(change = () => {}) {
  const warnings = [];
  const context = vm.createContext({
    window: {}, URL, URLSearchParams,
    console: { warn: message => warnings.push(message) },
    fetch: async url => ({ ok: true, json: async () => {
      const name = path.basename(url);
      const value = JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
      return change(name, value) ?? value;
    } }),
  });
  for (const file of ['ui', 'data', 'router', 'graph', 'views', 'detail', 'excel']) {
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

test('domain profiles contain the same members as the tree, including copied records', async () => {
  const { data, detail } = await loaded();
  const domain = { ...data.domainOf('bau'), kind: 'domains' };
  assert.equal(detail.rowsData(domain).rows.length, 9);
  for (const d of data.domains) {
    for (const kind of data.kinds) {
      const canonical = data.membersOfDomain(kind, d).map(e => e.identifier).join(',');
      assert.equal(data.membersOfDomain(kind, { ...d }).map(e => e.identifier).join(','), canonical);
    }
    assert.equal(JSON.stringify(data.relations('domains', { ...d })), JSON.stringify(data.relations('domains', d)));
  }
  assert.equal(data.membersOfDomain('systems', null).length, 0);
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
      assert.equal(field.technicalName, embedded.name);
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
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; literal source text'));
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
    assert.ok(html.includes('href="mailto:housing-stat@bfs.admin.ch"'));
    assert.ok(html.includes('href="tel:0800866600"'));
    assert.ok(!html.includes('Admindir') && !html.includes('<dt>Dateneigner</dt>') && !html.includes('<dt>Datenverwalter</dt>'));
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
  assert.equal(detail.responsibility({ kind: 'objects' }), '');
  // Inheritance also works for non-GWR records without guessing contacts from a domain/system.
  const object = data.get('objects', 'gebaeude');
  object.contact = { email: 'team@example.org' };
  assert.equal(data.attr('gebaeude/egid').contact.email, 'team@example.org');
  const table = data.get('tables', 't-gwr-gebaeude');
  table.fields[0].contact = { email: 'field@example.org' };
  assert.equal(data.field(`${table.identifier}/${data.fieldId(table.fields[0])}`).contact.email, 'field@example.org');
  assert.equal(table.contact.email, 'housing-stat@bfs.admin.ch');
});

test('field identifiers support encoded names and reject ambiguous duplicates', async () => {
  const { data, router } = await loaded((name, value) => {
    if (name === 'tables.json') value[0].fields.push({ identifier: 'cost / m²?net#', name: 'RENAMED_COLUMN', description: 'Stable identifier', dataType: 'DECIMAL' });
  });
  const href = router.entityHref('fields', 't-we/cost / m²?net#');
  assert.equal(router.parse(href).id, 't-we/cost / m²?net#');
  assert.equal(data.get('fields', router.parse(href).id).technicalName, 'RENAMED_COLUMN');
  for (const explicit of [false, true]) {
    const { data: invalid } = runtime((name, value) => {
      if (name === 'tables.json') {
        const f = value[0].fields[0];
        value[0].fields.push(explicit ? { ...f, identifier: f.name, name: 'another-name' } : { ...f });
      }
    });
    await assert.rejects(invalid.load('data/'), /duplicate field identifier/);
  }
});

test('the shipped data has no dangling references or missing record identities', async () => {
  const { data, warnings } = await loaded();
  assert.equal(warnings.length, 0);
  for (const kind of data.kinds) for (const e of data.list(kind)) {
    assert.equal(data.get(kind, e.identifier), e);
    assert.ok(e.name);
  }
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
    assert.equal(new Set(table.fields.map(f => f.name)).size, count);
    assert.ok(data.domainForEntity('tables', table));
    const groups = data.relations('tables', table);
    assert.equal(groups.find(g => g.key === 'sourceSystem').items[0].href, '#/systems/gwr');
    const refs = new Set(table.fields.map(f => f.codeList).filter(Boolean));
    assert.equal(groups.find(g => g.key === 'usesCodelists').items.length, refs.size);
    for (const field of table.fields) {
      assert.ok(field.label && field.description && field.dataType && field.sourceUrl);
      assert.ok(!JSON.stringify(field).includes('\uFFFD'), 'UTF-8 must be decoded without replacement characters');
      if (!field.codeList) continue;
      const ref = data.get('refs', field.codeList);
      assert.ok(ref);
      assert.equal(new Set(ref.values.map(v => v.code)).size, ref.values.length);
      assert.ok(data.relations('refs', ref).find(g => g.key === 'usedInTables').items.some(i => i.href.endsWith(table.identifier)));
      assert.ok(detail.rowsData({ ...table, kind: 'tables' }).rows.some(r => r.cells.some(c => typeof c === 'string' && c.includes('#/refs/' + ref.identifier))));
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
  assert.ok(!detail.facts(unmapped).primary.some(f => f.label === 'Personendaten'), 'unknown register data classification must not become No');
});

test('loading rejects broken collection and embedded-list shapes with useful locations', async () => {
  const cases = [
    ['objects.json', () => ({}), /objects\.json.*array/i],
    ['objects.json', v => { v[0] = null; }, /objects\.json\[0\]/],
    ['objects.json', v => { v[0].name = 12; }, /objects\.json\[0\].name/],
    ['objects.json', v => { v[0].attributes = {}; }, /attributes.*array/i],
    ['objects.json', v => { v[0].attributes[0] = null; }, /attributes\[0\]/],
    ['products.json', v => { v[0].basedOn = [null]; }, /basedOn\[0\]/],
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
    if (name === 'tables.json') v[0].realizes = 'missing-object';
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
  assert.ok(rows('Metadaten').some(r => r[3] === 'contact.email' && r[4] === 'housing-stat@bfs.admin.ch'));
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
