const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { database, runtime, root, migrations } = require('./catalog-test-helpers.cjs');
const { build, parseJson, files } = require('../supabase/import-catalog.cjs');

(async () => {
  const db = await database({ bundle: true });
  let checks = 0;
  const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
  try {
    const snapshot = (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot;
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'supabase/import-manifest.json')));
    for (const [table, count] of Object.entries(manifest.counts)) check(snapshot[table].length, count, table);
    const source = Object.fromEntries(Object.entries(files).map(([kind, file]) => [kind, parseJson(fs.readFileSync(path.join(root, 'data', file + '.json'), 'utf8'), file)]));
    check(build(source).manifest, manifest.identities, 'Rebuilding preserves every allocated identity');
    await db.exec(fs.readFileSync(path.join(migrations, '20260906030000_catalog_import.sql'), 'utf8'));
    check((await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot, snapshot, 'Repeat import changes no data or revisions');
    check((await db.query("SELECT prosecdef FROM pg_proc WHERE oid = 'catalog.read_snapshot()'::regprocedure")).rows[0].prosecdef, false, 'Read RPC respects the caller RLS');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      check((await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot, snapshot, `${role} reads complete snapshot without login`);
      for (const table of Object.keys(manifest.counts)) {
        check((await db.query(`SELECT count(*)::integer AS count FROM catalog.${table}`)).rows[0].count, manifest.counts[table], `${role} ${table} reads`);
        for (const operation of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) check((await db.query(`SELECT has_table_privilege(current_user, 'catalog.${table}', '${operation}') AS allowed`)).rows[0].allowed, false, `${role} ${operation} ${table}`);
      }
      await assert.rejects(db.query('SELECT * FROM catalog_private.user_access'), /permission denied/); checks++;
      await assert.rejects(db.query('SELECT * FROM catalog_private.import_batch'), /permission denied/); checks++;
      await assert.rejects(db.query("UPDATE catalog.domain SET name_de = 'Changed'"), /permission denied/); checks++;
      await db.exec('RESET ROLE');
    }
    const { DK, context, requests } = runtime(snapshot);
    await DK.data.load('data/');
    check(requests.filter(r => r.url.endsWith('.json')).map(r => r.url).sort(), ['data/config.json', 'data/i18n.json', 'data/manual.json', 'data/model.json']);
    const request = requests.find(r => r.url.includes('/rpc/'));
    check(request.options.headers['Content-Profile'], 'catalog');
    check(request.options.headers.Authorization, undefined, 'Publishable key is not a JWT');
    check(DK.data.validate().length, 0, 'No broken cross references');
    for (const kind of Object.keys(files).filter(kind => kind !== 'changelog')) {
      check(DK.data[kind].length, source[kind].length, kind);
      for (const original of source[kind]) {
        const current = DK.data.get(kind, original.identifier);
        check(current.name, original.labels?.de || original.name, `${kind}/${original.identifier} name`);
        check(current.description || '', original.description || '', `${kind}/${original.identifier} exact definition`);
      }
    }
    for (const table of source.tables) for (const field of table.fields) {
      const identifier = table.identifier + '/' + (field.identifier ?? field.technicalName);
      const current = DK.data.field(identifier);
      assert.ok(current, identifier); checks++;
      check(current.technicalName, field.technicalName, identifier);
      check(current.description || '', field.description || '', identifier + ' description');
      check(current.codeList || null, field.codeList || null, identifier + ' code list');
      check(JSON.stringify(current.labels), JSON.stringify(field.labels), identifier + ' translations');
      check(DK.router.parse(DK.router.entityHref('fields', identifier)).id, identifier, 'Round-trip field URL');
    }
    for (const object of source.objects) for (const attribute of object.attributes) {
      const current = DK.data.attr(object.identifier + '/' + attribute.identifier);
      check(current.name, attribute.name, 'Attribute URL');
      check(current.mandatory, attribute.mandatory ? true : null, 'No invented optionality');
    }
    for (const list of source.refs) for (const value of list.values) {
      const current = DK.data.get('refs', list.identifier).values.find(v => v.code === value.code);
      check(current.label, value.label, 'Exact code and label');
    }
    for (const event of source.changelog) {
      check(DK.data.changelog.some(e => e.entity === event.entity && e.date === event.date && e.user === (event.user || '') && e.detail === [event.action, event.detail].filter(Boolean).join(': ')), true, 'Historical action, date and author preserved');
    }
    check(new Set(snapshot.data_field.map(f => f.technical_name)).size < snapshot.data_field.length, true, 'Repeated field names remain independent');
    check(snapshot.data_field.find(f => f.identifier === 't-sap-building/COMP_CODE').technical_name_kind, 'apiField');
    check(snapshot.relationship.every(r => r.verification_status === 'candidate'), true, 'Import does not confirm mappings');
    check(DK.data.get('systems', 'gwr').dataOwner, undefined, 'External organisation does not require an actor');
    check(DK.data.field('t-gwr-gebaeude/EGID').responsibleOrg, 'Bundesamt für Statistik (BFS)', 'Responsible organisation fallback');
    check(DK.data.relations('attrs', DK.data.attr('gebaeude/egid')).find(g => g.key === 'realizedInFields').items.length, 0, 'Matching names do not establish physical attribute mappings');
    const fieldFacts = DK.detail.facts({ ...DK.data.field('t-gwr-gebaeude/EGID'), kind: 'fields' });
    check(fieldFacts.primary.some(f => f.type === 'links' && f.value.some(url => url.includes('housing-stat.ch'))), true, 'Field documentation links remain visible');
    DK.ui.setDictionary(DK.data.i18n, 'fr', 'de');
    check(DK.data.get('refs', 'r-gwr-kat').values.find(v => v.code === '1010').label, 'Habitation provisoire');
    DK.ui.setDictionary(DK.data.i18n, 'de', 'de');
    const search = DK.data.search('Energie');
    assert.ok(search.length); checks++;
    const entity = { ...DK.data.get('tables', 't-gwr-gebaeude'), kind: 'tables' };
    const plan = DK.excel.plan({ view: 'detail', kind: 'tables', entity }, { kind: 'tables', title: entity.name, state: { tableSorts: {} }, groups: [], isList: false }, 'https://catalog.example/#/tables/t-gwr-gebaeude');
    check(plan.sheets.find(s => s.name === DK.ui.t('col.fields')).rows.length, entity.fields.length, 'Excel includes every field');
    const old = DK.data.get('tables', 't-gwr-gebaeude');
    context.fetch = async url => String(url).includes('/rpc/') ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, String(url)))) };
    await assert.rejects(DK.data.load('data/'), /Supabase HTTP 503/); checks++;
    check(DK.data.get('tables', 't-gwr-gebaeude'), old, 'Failed reload preserves prior snapshot');
    check(parseJson('{"name":"x","nested":{"name":"y"}}', 'fixture').nested.name, 'y');
    assert.throws(() => parseJson('{"name":"x","na\\u006de":"y"}', 'fixture'), /duplicate key/); checks++;
    await db.exec(`INSERT INTO catalog.data_field (identifier, name_en, data_table_id, technical_name, technical_name_kind)
      SELECT 'pagination-' || n, 'Extra field ' || n, (SELECT id FROM catalog.data_table LIMIT 1), 'EXTRA_' || n, 'unknown' FROM generate_series(1, 1100) n; SET ROLE anon;`);
    check((await db.query("SELECT jsonb_array_length(catalog.read_snapshot()->'data_field') AS count")).rows[0].count, 1721, 'Snapshot is not truncated at 1,000 rows');
    const occupied = await database({ setupOnly: true });
    try {
      await occupied.exec("INSERT INTO catalog.domain(identifier, name_de) VALUES ('existing', 'Keep this record')");
      await assert.rejects(occupied.exec(fs.readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8')), /requires an empty catalog/); checks++;
      await occupied.exec('ROLLBACK');
      check((await occupied.query('SELECT name_de FROM catalog.domain')).rows[0].name_de, 'Keep this record', 'Existing records survive a refused import');
      check((await occupied.query("SELECT to_regprocedure('catalog.read_snapshot()') AS rpc")).rows[0].rpc, null, 'Failed bundle rolls back the read function');
      check((await occupied.query("SELECT policyname FROM pg_policies WHERE schemaname = 'catalog' AND tablename = 'domain'")).rows[0].policyname, 'catalog_member_read', 'Failed bundle preserves original RLS');
    } finally { await occupied.close(); }
    console.log(`${checks} migration, public access and adapter checks passed.`);
  } finally { await db.close(); }
})().catch(error => { console.error(error.message, error.detail || ''); process.exitCode = 1; });
