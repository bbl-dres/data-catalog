const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { database, root } = require('../supabase/local-database.cjs');
const { generate, config, output } = require('../supabase/generate-openapi.cjs');

(async () => {
  const db = await database();
  try {
    const spec = await generate(db);
    assert.deepEqual(spec, JSON.parse(fs.readFileSync(output, 'utf8')), 'Regenerate the committed OpenAPI file after schema changes');
    assert.equal(spec.openapi, '3.1.0');
    assert.equal(Object.keys(spec.paths).length, 20);
    const tables = Object.keys(spec.paths).filter(p => p !== '/rpc/read_snapshot').map(p => p.slice(1));
    const operationIds = new Set();
    for (const [url, operations] of Object.entries(spec.paths)) {
      assert.deepEqual(Object.keys(operations), [url.startsWith('/rpc/') ? 'post' : 'get'], 'Only catalog reads are documented');
      for (const operation of Object.values(operations)) {
        assert(!operationIds.has(operation.operationId)); operationIds.add(operation.operationId);
        const parameters = operation.parameters.map(p => p.$ref ? spec.components.parameters[p.$ref.split('/').pop()] : p);
        assert.equal(new Set(parameters.map(p => p.in + ':' + p.name)).size, parameters.length);
      }
    }
    const walk = value => {
      if (!value || typeof value !== 'object') return;
      if (value.$ref) {
        assert(value.$ref.startsWith('#/'), 'Contract refs are local');
        assert(value.$ref.slice(2).split('/').reduce((node, key) => node?.[key], spec), value.$ref);
      }
      Object.values(value).forEach(walk);
    };
    walk(spec);
    assert(!JSON.stringify(spec).includes(config().publishableKey), 'Keys are runtime configuration, not part of the contract');
    assert.equal(spec.components.securitySchemes.PublishableKey.name, 'apikey');
    for (const table of tables) {
      const model = spec.components.schemas[table];
      assert(model['x-postgresql-primary-key'].length, table + ' primary key');
      for (const fk of model['x-postgresql-foreign-keys']) {
        assert(fk.columns.every(name => model.properties[name]));
        assert(fk.referencedColumns.every(name => spec.components.schemas[fk.table].properties[name]));
      }
      const { rows } = await db.query(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='catalog' AND table_name=$1 ORDER BY ordinal_position`, [table]);
      assert.deepEqual(Object.keys(model.properties), rows.map(row => row.column_name));
      for (const row of rows) assert.equal(model.properties[row.column_name]['x-postgresql-not-null'], row.is_nullable === 'NO');
    }
    const context = { window: { DK: {} }, URL, Headers };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'js/api.js'), 'utf8'), context);
    const prepare = context.window.DK.api.prepareRequest;
    const target = { base: new URL('https://catalog.example/rest/v1/'), key: 'sb_publishable_test' };
    const request = (url, method = 'GET', headers = {}) => ({ url: new URL(url, target.base).href, method, headers });
    const read = prepare(request('business_object?limit=1', 'GET', { Authorization: 'Bearer unwanted', 'Content-Profile': 'public' }), spec, target);
    assert.equal(read.headers.apikey, target.key);
    assert.equal(read.headers['accept-profile'], 'catalog');
    assert(!('authorization' in read.headers)); assert(!('content-profile' in read.headers));
    assert.equal(read.credentials, 'omit');
    const snapshotRequest = prepare(request('rpc/read_snapshot', 'POST'), spec, target);
    assert.equal(snapshotRequest.headers['content-profile'], 'catalog');
    assert.equal(snapshotRequest.headers['content-type'], 'application/json');
    for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) assert.throws(() => prepare(request('domain', method), spec, target), /Only documented/);
    for (const url of ['https://other.example/rest/v1/domain', '../domain', 'unknown', 'rpc/write_record']) assert.throws(() => prepare(request(url), spec, target), /Only documented/);
    for (const apikey of ['sb_secret_no', 'eyJ_service_role']) assert.throws(() => prepare(request('domain', 'GET', { apikey }), spec, target), /publishable key/);
    assert.throws(() => prepare(request('domain'), spec, null), /offline fixture/);

    const live = process.env.API_LIVE_READ === '1';
    const evidence = { spec, source: live ? 'Supabase public reads' : 'Local SQL migrations', tables: {} };
    if (live) {
      const current = config();
      const readPublic = async (url, options) => {
        const response = await fetch(new URL('/rest/v1/' + url, current.url), { ...options, signal: AbortSignal.timeout(30000) });
        assert(response.ok, `${url}: HTTP ${response.status}`);
        return response.json();
      };
      for (const table of tables) {
        const columns = Object.keys(spec.components.schemas[table].properties).join(',');
        evidence.tables[table] = await readPublic(table + '?select=' + columns + '&limit=1', { headers: { apikey: current.publishableKey, 'Accept-Profile': 'catalog' } });
      }
      evidence.snapshot = await readPublic('rpc/read_snapshot', { method: 'POST', headers: { apikey: current.publishableKey, 'Content-Profile': 'catalog', 'Content-Type': 'application/json' }, body: '{}' });
    } else {
      evidence.snapshot = (await db.query('SELECT catalog.read_snapshot() AS value')).rows[0].value;
      for (const table of tables) evidence.tables[table] = (await db.query(`SELECT coalesce(jsonb_agg(t), '[]'::jsonb) AS rows FROM catalog.${table} t`)).rows[0].rows;
    }
    for (const table of tables) for (const row of [...evidence.tables[table], ...evidence.snapshot[table]]) {
      assert.deepEqual(Object.keys(row).sort(), Object.keys(spec.components.schemas[table].properties).sort(), table + ' response columns');
    }
    const folder = path.join(os.tmpdir(), 'oblique-api-review'); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, live ? 'live.json' : 'local.json'), JSON.stringify(evidence));
    console.log(`PASS: generated contract, SQL columns/keys, 20 read operations, request guards and ${evidence.source}. JSON Schema evidence: ${folder}`);
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
