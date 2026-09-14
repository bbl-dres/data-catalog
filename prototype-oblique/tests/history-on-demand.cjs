/* Lean snapshot and per-record history: SQL contract, anonymous access, projection parity with the
   complete snapshot, one cached read per owner, inherited attribute history and loading/failure
   states. Requires PGlite. */
const assert = require('node:assert/strict');
const { database, runtime } = require('./catalog-test-helpers.cjs');

(async () => {
  const db = await database();
  let checks = 0;
  // Values from the sandboxed browser runtime carry another realm's prototypes; compare plain data.
  const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const check = (actual, expected, message) => { assert.deepEqual(plain(actual), plain(expected), message); checks++; };
  const query = async (sql, params) => (await db.query(sql, params)).rows;
  const waitFor = async condition => { for (let i = 0; i < 500 && !condition(); i++) await new Promise(resolve => setTimeout(resolve, 10)); assert(condition(), 'timed out'); };
  try {
    const full = (await query('SELECT catalog.read_snapshot(true) AS s'))[0].s;
    const lean = (await query('SELECT catalog.read_snapshot(true, false) AS s'))[0].s;
    const { change_event: events, ...current } = full;
    check(lean, current, 'The initial load is the API-inclusive snapshot without change events');
    check((await query('SELECT catalog.read_snapshot() AS s'))[0].s, (await query('SELECT catalog.read_snapshot(false, true) AS s'))[0].s, 'The legacy snapshot keeps its table-field inventory and history');
    check('change_event' in (await query('SELECT catalog.read_snapshot(false, false) AS s'))[0].s, false, 'The legacy inventory can also omit history');
    check(await query(`SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, p.provolatile AS volatility, p.prosecdef AS definer,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS member
      FROM pg_proc p WHERE p.pronamespace = 'catalog'::regnamespace AND p.proname IN ('read_snapshot', 'read_history') ORDER BY 1, 2`), [
      { name: 'read_history', args: 'record_table text, record_id uuid, max_events integer', volatility: 's', definer: false, anon: true, member: true },
      { name: 'read_snapshot', args: '', volatility: 's', definer: false, anon: true, member: true },
      { name: 'read_snapshot', args: 'include_api_fields boolean, include_history boolean', volatility: 's', definer: false, anon: true, member: true }
    ], 'PostgREST resolves {} to the legacy snapshot and include_api_fields to the optional-history overload');
    check((await query("SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname = 'catalog' AND indexname = 'change_event_occurred_idx'"))[0].n, 1, 'Ordered history reads are indexed');

    // Per-record history returns exactly the events the complete snapshot attributes to that owner.
    const children = { business_object: ['business_attribute', 'business_object_id'], data_table: ['data_field', 'data_table_id'], data_service: ['data_field', 'data_service_id'], code_list: ['code_value', 'code_list_id'], data_product: ['product_attribute', 'data_product_id'], domain: null, system: null };
    const kinds = { business_object: 'objects', data_table: 'tables', data_service: 'apis', code_list: 'refs', data_product: 'products', domain: 'domains', system: 'systems' };
    const expectedEvents = (table, record) => {
      const child = children[table], owned = new Set(child ? full[child[0]].filter(r => r[child[1]] === record.id).map(r => r.id) : []);
      return events.filter(e => e[`record_${table}_id`] === record.id || (child && owned.has(e[`record_${child[0]}_id`])));
    };
    const strip = ({ before, after, ...event }) => event;
    const byId = list => list.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    const newestFirst = list => list.every((e, i) => {
      if (!i) return true;
      const previous = list[i - 1];
      if ((previous.occurred_at == null) !== (e.occurred_at == null)) return previous.occurred_at != null;
      if (previous.occurred_at != null && previous.occurred_at !== e.occurred_at) return previous.occurred_at > e.occurred_at;
      return previous.occurred_on >= e.occurred_on;
    });
    const samples = [];
    let owners = 0;
    for (const table of Object.keys(children)) for (const record of full[table]) {
      const expected = expectedEvents(table, record);
      if (!expected.length) continue;
      const actual = (await query('SELECT catalog.read_history($1, $2) AS h', [table, record.id]))[0].h;
      check(byId(actual), byId(expected).map(strip), `${table} ${record.identifier}: owned events without before/after states`);
      assert(newestFirst(actual), `${table} ${record.identifier}: newest first`); checks++;
      owners++;
      if (!record.is_archived && (table !== 'business_object' || (expected.length >= 2 && full.business_attribute.some(a => a.business_object_id === record.id && !a.is_archived)))) samples.push({ table, kind: kinds[table], record, expected });
    }
    assert(owners >= 5, `history covers several owners (${owners})`); checks++;
    const sample = samples.find(s => s.table === 'business_object');
    const others = samples.filter(s => s !== sample && s.kind !== 'domains');
    assert(sample && others.length >= 2, 'The fixture has a business object with attributes and history plus other owners'); checks++;
    check((await query('SELECT catalog.read_history($1, $2, 1) AS h', ['business_object', sample.record.id]))[0].h.length, 1, 'max_events caps the newest events');
    check((await query('SELECT catalog.read_history($1, $2) AS h', ['domain', '00000000-0000-0000-0000-000000000000']))[0].h, [], 'Unknown records have an empty history');
    await assert.rejects(query("SELECT catalog.read_history('user_access', $1)", [sample.record.id]), error => error.code === '22023' || /history owner/.test(error.message)); checks++;
    await assert.rejects(query('SELECT catalog.read_history($1, NULL)', ['domain']), error => error.code === '22023' || /record_id/.test(error.message)); checks++;
    await db.exec('SET ROLE anon');
    check('change_event' in (await query('SELECT catalog.read_snapshot(true, false) AS s'))[0].s, false, 'anon reads the lean snapshot');
    check((await query('SELECT catalog.read_history($1, $2) AS h', ['business_object', sample.record.id]))[0].h.length, sample.expected.length, 'anon reads per-record history');
    await db.exec('RESET ROLE');

    // The browser projection: no preloaded history, one read per owner, cached and inherited by attributes.
    const reads = [];
    const fromDatabase = async body => (await query('SELECT catalog.read_history($1, $2) AS h', [body.record_table, body.record_id]))[0].h;
    let answer = fromDatabase;
    const respond = (url, options) => {
      if (!url.includes('/rpc/read_history')) return undefined;
      const body = JSON.parse(options.body);
      reads.push(body);
      return answer(body);
    };
    const { DK } = runtime(lean, undefined, respond);
    await DK.data.load('data/');
    check([DK.data.historyLoaded, DK.data.changelog], [false, []], 'The app publishes the lean snapshot without preloaded history');
    const reference = runtime(full).DK;
    await reference.data.load('data/');
    check(reference.data.historyLoaded, true, 'A complete snapshot keeps the preloaded history path');
    const shape = h => ({ identifier: h.identifier, entity: h.entity, date: h.date, action: h.action, importId: h.importId, detail: h.detail, user: h.user });
    const notifications = [];
    DK.data.onHistory = key => notifications.push(key);
    const pending = DK.data.historyState('objects', sample.record.identifier);
    check([pending.loading, pending.error, pending.items], [true, false, []], 'The first request reports loading');
    check(DK.data.history('objects', sample.record.identifier), [], 'History reads as empty while loading');
    check(reads, [{ record_table: 'business_object', record_id: sample.record.id }], 'One read for the owning record');
    await waitFor(() => notifications.length === 1);
    check(notifications, [`objects:${sample.record.identifier}`], 'The page is notified once');
    const loaded = DK.data.historyState('objects', sample.record.identifier);
    check([loaded.loading, loaded.error], [false, false]);
    check(loaded.items.map(shape), reference.data.history('objects', sample.record.identifier).map(shape), 'On-demand history projects like the complete snapshot');
    const attribute = reference.data.get('objects', sample.record.identifier).attributes[0];
    const attributeId = DK.data.childId(sample.record.identifier, attribute.identifier);
    check(DK.data.history('attrs', attributeId).map(shape), loaded.items.map(shape), 'Attributes inherit the object history');
    check(reads.length, 1, 'Inherited and repeated reads use the cached history');

    // Rendering states use the dictionary; a failed read is reported without retry storms; a reload starts over.
    DK.preferences ||= { read: () => null, write: () => {} };
    const state = { tableSorts: {} };
    const entity = kind => ({ ...DK.data.get(kind.kind, kind.record.identifier), kind: kind.kind });
    assert.ok(DK.detail.history(entity(sample), state).includes(DK.ui.esc(loaded.items[0].action)), 'Loaded history renders its rows'); checks++;
    let release;
    answer = () => new Promise(resolve => { release = resolve; });
    assert.ok(DK.detail.history(entity(others[0]), state).includes(DK.ui.esc(DK.ui.t('history.loading'))), 'A pending read renders the loading state'); checks++;
    check(reads.length, 2);
    release([]);
    await waitFor(() => notifications.length === 2);
    check(DK.data.historyState(others[0].kind, others[0].record.identifier).items, [], 'The released read publishes its rows');
    answer = async () => { throw new Error('offline'); };
    const failing = DK.data.historyState(others[1].kind, others[1].record.identifier);
    check(failing.loading, true);
    await waitFor(() => notifications.length === 3);
    check([failing.loading, failing.error], [false, true], 'A failed read is reported');
    assert.ok(DK.detail.history(entity(others[1]), state).includes(DK.ui.esc(DK.ui.t('history.unavailable'))), 'The panel reports the failure'); checks++;
    check(DK.data.history(others[1].kind, others[1].record.identifier), [], 'Failed history reads as empty');
    check(reads.length, 3, 'A failed read is not retried immediately');
    answer = fromDatabase;
    await DK.data.load('data/');
    DK.data.historyState('objects', sample.record.identifier);
    check(reads.length, 4, 'A new snapshot forgets on-demand history');
    await waitFor(() => notifications.length === 4);
    check(DK.data.history('attrs', attributeId).map(shape), loaded.items.map(shape), 'Reloaded history matches');

    // A database without the optional-history overload rejects the new key; the app falls back to the complete snapshot.
    const legacy = runtime(full, undefined, (url, options) => url.includes('/rpc/read_catalog_index') || url.includes('/rpc/read_snapshot') && options.body.includes('include_history') ? { status: 404, error: { code: 'PGRST202', message: 'Could not find the function' } } : undefined);
    await legacy.DK.data.load('data/');
    check(legacy.requests.filter(r => r.url.includes('/rpc/read_snapshot')).map(r => r.options.body), ['{"include_api_fields":true,"include_history":false}', '{"include_api_fields":true}'], 'One retry with the legacy request body');
    check([legacy.DK.data.historyLoaded, legacy.DK.data.history('objects', sample.record.identifier).map(shape)], [true, loaded.items.map(shape)], 'The complete snapshot keeps preloaded history');
    const missing = runtime(full, undefined, url => /\/rpc\/read_(snapshot|catalog_index)/.test(url) ? { status: 404, error: { code: 'PGRST202', message: 'Could not find the function' } } : undefined);
    await assert.rejects(missing.DK.data.load('data/'), /Supabase HTTP 404\. Apply the catalog public-read and import migrations/); checks++;
    console.log(`history-on-demand: ${checks} checks, ${owners} owners with history`);
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
