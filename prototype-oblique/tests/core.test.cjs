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
  for (const file of ['ui', 'data', 'router', 'graph', 'views', 'detail']) {
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

test('the shipped data has no dangling references or missing record identities', async () => {
  const { data, warnings } = await loaded();
  assert.equal(warnings.length, 0);
  for (const kind of data.kinds) for (const e of data.list(kind)) {
    assert.equal(data.get(kind, e.identifier), e);
    assert.ok(e.name);
  }
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

test('CSV serializes delimiters and quotes and neutralizes formula-like text cells', () => {
  const { ui } = runtime();
  assert.equal(ui.csvCell('a;b"c\nd'), '"a;b""c\nd"');
  assert.equal(ui.csvCell(null), '');
  assert.equal(ui.csvCell(-12), '-12');
  assert.equal(ui.csvCell('Gebäude'), 'Gebäude');
  for (const value of ['=1+2', '+1', '-2', '@SUM(A1)', ' \t=1', '\r=1', '＝1+1']) {
    assert.equal(ui.csvCell(value), '"\'' + value + '"');
  }
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
