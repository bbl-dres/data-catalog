/* Load and reactivity measurement: how fast the page loads and reacts, under a real request waterfall.
 * usage: PGLITE_MODULE=... node prototype-oblique/tests/performance-load.cjs <label> [--cpu 4] [--net 3g|4g] [--json] [--root <prototype directory>] [--quick] [--h1]
 * A static server that behaves like GitHub Pages (gzip, Cache-Control: max-age=600, ETag/304) serves the app over
 * HTTP/2 (a self-signed certificate from openssl; --h1 or no openssl falls back to HTTP/1.1). The SQL snapshot from the
 * isolated database is answered same-origin at /rest/v1/rpc/read_snapshot, so no request is intercepted and the
 * waterfall is real. --json serves the fixture catalog instead. --root measures another checkout (a baseline).
 * Reports: cold start with a sampling profile, warm reload, 12 route changes, 16 interactions with forced style/layout
 * counts, and memory over 150 route changes. Writes oblique-diagram-export/load-<label>.json in the OS temporary
 * directory. Timings are diagnostic (no pass threshold); DevTools CPU/network throttling simulates a slow device.
 * See docs/review/2026-09-07-code-review.md for the recorded comparison. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const http2 = require('node:http2');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium, settle } = require('./browser-helpers.cjs');
const args = process.argv.slice(2);
const label = args[0] || 'run';
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const cpu = Number(opt('cpu', 1));
const net = opt('net', 'none');
const useJson = args.includes('--json');
const quick = args.includes('--quick');
const ROOT = path.resolve(opt('root', path.resolve(__dirname, '..')));
const OUT = path.join(os.tmpdir(), 'oblique-diagram-export'); fs.mkdirSync(OUT, { recursive: true });
/** Self-signed loopback certificate for HTTP/2; null when openssl is unavailable or --h1 is given. */
function certificate() {
  if (args.includes('--h1')) return null;
  const dir = path.join(OUT, 'tls'), key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(key) || !fs.existsSync(cert)) execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
    return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
  } catch { console.warn('openssl is not available: measuring over HTTP/1.1'); return null; }
}
const tls = certificate(), h2 = !!tls;
const median = xs => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const r1 = x => Math.round(x * 10) / 10;
const NET = { none: null, '4g': { latency: 100, down: 4 * 1024 * 1024 / 8, up: 3 * 1024 * 1024 / 8 }, '3g': { latency: 300, down: 1.6 * 1024 * 1024 / 8, up: 750 * 1024 / 8 } };
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };

function serve(snapshotText, port = 0) {
  const handler = (req, res) => {
    let pathname; try { pathname = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); res.end(); return; }
    const gz = /gzip/.test(req.headers['accept-encoding'] || '');
    const send = (status, body, type, cacheable) => {
      const etag = '"' + crypto.createHash('sha1').update(body).digest('hex').slice(0, 16) + '"';
      const headers = { 'Content-Type': type, ETag: etag, 'Cache-Control': cacheable ? 'max-age=600' : 'no-store', Vary: 'Accept-Encoding' };
      if (cacheable && req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }
      // HTML stays uncompressed: gzip-encoded HTML serialised the throttled HTTP/2 script requests in the local server.
      if (gz && type !== 'text/html' && /text|javascript|json|svg/.test(type)) { headers['Content-Encoding'] = 'gzip'; body = zlib.gzipSync(body); }
      headers['Content-Length'] = body.length; // without a length the throttled HTTP/2 connection processed responses one at a time
      res.writeHead(status, headers); res.end(body);
    };
    if (req.method === 'POST' && pathname === '/rest/v1/rpc/read_snapshot') { send(200, Buffer.from(snapshotText), 'application/json', false); return; }
    if (pathname === '/js/catalog-config.js') {
      const origin = `${h2 ? 'https' : 'http'}://127.0.0.1:${server.address().port}`;
      send(200, Buffer.from(useJson ? "window.DK = window.DK || {}; window.DK.catalogConfig = { provider: 'json' };" : `window.DK = window.DK || {}; window.DK.catalogConfig = Object.freeze({ provider: 'supabase', url: '${origin}', publishableKey: 'sb_publishable_local' });`), 'application/javascript', true); return;
    }
    const file = path.resolve(ROOT, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end('Not found'); return; } send(200, data, mime[path.extname(file)] || 'application/octet-stream', true); });
  };
  const server = h2 ? http2.createSecureServer({ ...tls, allowHTTP1: true }, handler) : http.createServer(handler);
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

(async () => {
  let snapshot = null;
  if (!useJson) {
    const db = await require('./catalog-test-helpers.cjs').database();
    try { snapshot = (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot; } finally { await db.close(); }
  }
  const snapshotText = snapshot ? JSON.stringify(snapshot) : '{}';
  const server = await serve(snapshotText);
  const base = `${h2 ? 'https' : 'http'}://127.0.0.1:${server.address().port}/`;
  const report = { label, cpu, net, protocol: h2 ? 'h2' : 'http/1.1', provider: useJson ? 'json' : 'sql-snapshot', root: ROOT,
    snapshot: snapshot ? { bytes: Buffer.byteLength(snapshotText), gzip: zlib.gzipSync(snapshotText).length, brotli: zlib.brotliCompressSync(snapshotText).length, records: Object.fromEntries(Object.entries(snapshot).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])) } : null };
  const browser = await chromium.launch({ headless: true });
  // A fresh context is the cold cache; DevTools cache disabling would serialize the preloaded scripts and distort the waterfall.
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (NET[net]) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: NET[net].latency, downloadThroughput: NET[net].down, uploadThroughput: NET[net].up });
  await page.addInitScript(() => {
    window.perfLongTasks = [];
    new PerformanceObserver(list => window.perfLongTasks.push(...list.getEntries().map(e => ({ start: Math.round(e.startTime), duration: Math.round(e.duration) })))).observe({ type: 'longtask', buffered: true });
    const ready = new MutationObserver(() => { if (document.querySelector('#page-content h1')) { window.perfReadyMs = performance.now(); ready.disconnect(); } });
    ready.observe(document, { childList: true, subtree: true });
    window.perfPhases = {};
    const origFetch = window.fetch;
    window.fetch = function (input, init) { const url = String(input); const start = performance.now(); return origFetch.call(this, input, init).then(r => { window.perfPhases['fetch ' + url.replace(/^.*\/(data\/|rest\/v1\/)/, '$1')] = [Math.round(start), Math.round(performance.now() - start)]; return r; }); };
  });
  const metrics = async () => { const { metrics } = await cdp.send('Performance.getMetrics'); return Object.fromEntries(metrics.map(m => [m.name, m.value])); };
  const delta = (a, b) => ({ layouts: b.LayoutCount - a.LayoutCount, styleRecalcs: b.RecalcStyleCount - a.RecalcStyleCount, layoutMs: r1((b.LayoutDuration - a.LayoutDuration) * 1000), styleMs: r1((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000), scriptMs: r1((b.ScriptDuration - a.ScriptDuration) * 1000), taskMs: r1((b.TaskDuration - a.TaskDuration) * 1000) });
  try {
    /* ---- cold startup with a sampling profile ---- */
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
    await cdp.send('Profiler.start');
    const t0 = Date.now();
    await page.goto(base + '#/');
    await page.locator('#page-content h1').waitFor();
    await page.evaluate(() => document.fonts.ready); await settle(page);
    await page.waitForTimeout(600); // late resources, such as icon requests that an older tree still issues
    const wall = Date.now() - t0;
    const { profile } = await cdp.send('Profiler.stop');
    report.startup = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource').map(e => ({ name: e.name.replace(/^https?:\/\/[^/]+\//, ''), type: e.initiatorType, start: Math.round(e.startTime), end: Math.round(e.responseEnd), ms: Math.round(e.duration), bytes: e.decodedBodySize, transfer: e.transferSize, protocol: e.nextHopProtocol }));
      const paint = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]));
      return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), appReadyMs: Math.round(window.perfReadyMs), paint, phases: window.perfPhases,
        longTasks: window.perfLongTasks, requests: res.length, bytes: res.reduce((s, e) => s + e.bytes, 0), transfer: res.reduce((s, e) => s + e.transfer, 0), resources: res,
        iconRequests: res.filter(e => /icons\//.test(e.name)).length, firstIconStart: Math.min(...res.filter(e => /icons\//.test(e.name)).map(e => e.start), Infinity),
        fonts: [...document.fonts].map(f => ({ family: f.family, status: f.status })), nodes: document.getElementsByTagName('*').length };
    });
    report.startup.wallMs = wall;
    const nodes = new Map(profile.nodes.map(n => [n.id, n]));
    const self = new Map(); const dt = profile.timeDeltas; const total = dt.reduce((a, b) => a + b, 0);
    const byFile = new Map();
    profile.samples.forEach((id, i) => {
      const cf = nodes.get(id).callFrame;
      const key = `${cf.functionName || '(anonymous)'} ${cf.url.split('/').slice(-1)[0]}:${cf.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0));
      const f = cf.url ? cf.url.split('/').slice(-1)[0] : (['(garbage collector)', '(program)', '(idle)'].includes(cf.functionName) ? cf.functionName : '(native)'); byFile.set(f, (byFile.get(f) || 0) + (dt[i] || 0));
    });
    report.profile = { totalMs: Math.round(total / 1000), topFunctions: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, r1(v / 1000)]), byFile: [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, r1(v / 1000)]) };
    await cdp.send('Profiler.disable');

    /* ---- warm reload: HTTP cache on, static assets max-age=600 ---- */
    const t1 = Date.now(); await page.reload(); await page.locator('#page-content h1').waitFor(); await settle(page);
    report.warmReload = { wallMs: Date.now() - t1, ...(await page.evaluate(() => { const res = performance.getEntriesByType('resource'); return { appReadyMs: Math.round(window.perfReadyMs), requests: res.length, networkRequests: res.filter(e => e.transferSize > 0).length, transfer: res.reduce((s, e) => s + e.transferSize, 0), phases: window.perfPhases, longTasks: window.perfLongTasks }; })) };

    /* ---- route changes: hashchange → first mutation of <main> ---- */
    await page.evaluate(() => {
      window.perfRoute = () => new Promise(resolve => { const main = document.getElementById('main'); const start = performance.now(); const mo = new MutationObserver(() => { const t = performance.now() - start; mo.disconnect(); requestAnimationFrame(() => requestAnimationFrame(() => resolve({ render: t, frame: performance.now() - start }))); }); mo.observe(main, { childList: true, subtree: true }); window.perfRouteStart = start; });
    });
    const routes = quick ? ['#/objects', '#/tables/t-gwr-gebaeude?tab=rows', '#/'] : ['#/objects', '#/objects?view=table', '#/tables?view=table', '#/refs', '#/objects/gebaeude', '#/objects/gebaeude?tab=rows', '#/objects/gebaeude?tab=relations', '#/tables/t-gwr-gebaeude?tab=rows', '#/systems/gwr', '#/search?q=Geb%C3%A4ude', '#/manual', '#/'];
    report.routes = [];
    for (const route of routes) {
      const samples = [], frames = [], deltas = [];
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => { location.hash = '#/products'; }); await settle(page);
        const before = await metrics();
        const t = await page.evaluate(r => { const p = window.perfRoute(); location.hash = r; return p; }, route);
        const after = await metrics();
        samples.push(t.render); frames.push(t.frame); deltas.push(delta(before, after));
      }
      const mid = deltas[2];
      report.routes.push({ route, renderMs: r1(median(samples)), frameMs: r1(median(frames)), layouts: median(deltas.map(d => d.layouts)), styleRecalcs: median(deltas.map(d => d.styleRecalcs)), layoutMs: r1(median(deltas.map(d => d.layoutMs))), styleMs: r1(median(deltas.map(d => d.styleMs))), scriptMs: r1(median(deltas.map(d => d.scriptMs))), nodes: await page.evaluate(() => document.getElementsByTagName('*').length) });
    }

    /* ---- interactions: synchronous handler time + forced layout/style counts + time to next frame ---- */
    const interact = async (name, hash, action, async = false) => {
      const samples = [], frames = [], deltas = [];
      for (let i = 0; i < (quick ? 3 : 5); i++) {
        await page.evaluate(() => { location.hash = '#/products'; }); await settle(page);
        await page.evaluate(h => { location.hash = h; }, hash); await settle(page);
        const before = await metrics();
        const t = await page.evaluate(async body => { const fn = new Function(body); const start = performance.now(); const result = fn(); if (result && result.then) await result; const sync = performance.now() - start; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return { sync, frame: performance.now() - start }; }, action);
        const after = await metrics();
        samples.push(t.sync); frames.push(t.frame); deltas.push(delta(before, after));
      }
      report.interactions = report.interactions || [];
      report.interactions.push({ name, syncMs: r1(median(samples)), frameMs: r1(median(frames)), maxSyncMs: r1(Math.max(...samples)), layouts: median(deltas.map(d => d.layouts)), styleRecalcs: median(deltas.map(d => d.styleRecalcs)), layoutMs: r1(median(deltas.map(d => d.layoutMs))), styleMs: r1(median(deltas.map(d => d.styleMs))) });
    };
    await interact('open export menu', '#/objects', `document.querySelector('[data-menu="actions"]').click()`);
    await interact('open grouping menu', '#/objects', `document.querySelector('[data-menu="group"]').click()`);
    await interact('toggle tree branch', '#/objects', `document.querySelector('[data-action="toggle-tree"][data-key="tables"]').click()`);
    await interact('collapse sidebar', '#/objects', `document.querySelector('[data-action="toggle-sidebar"]').click()`);
    await interact('switch to table view', '#/objects', `document.querySelector('[data-view="table"]').click()`);
    await interact('filter keystroke (objects)', '#/objects', `const i = document.getElementById('collection-filter'); i.value = 'geb'; i.dispatchEvent(new Event('input', { bubbles: true }))`);
    await interact('filter keystroke (39 fields)', '#/tables/t-gwr-gebaeude?tab=rows', `const i = document.getElementById('collection-filter'); i.value = 'geb'; i.dispatchEvent(new Event('input', { bubbles: true }))`);
    await interact('sort column (fields)', '#/tables/t-gwr-gebaeude?tab=rows', `document.querySelector('[data-sort-field="type"]').click()`);
    await interact('switch tab overview→attributes', '#/objects/gebaeude', `document.querySelector('[data-tab="rows"]').click()`);
    await interact('search suggestion keystroke', '#/', `const i = document.getElementById('search-input'); i.focus(); i.value = 'geb'; i.dispatchEvent(new Event('input', { bubbles: true }))`);
    await interact('graph zoom in', '#/objects/gebaeude?tab=relations', `document.querySelector('[data-action="graph-zoom-in"]').click()`);
    await interact('graph select node', '#/objects/gebaeude?tab=relations', `document.querySelector('.ob-graph-node').click()`);
    await interact('open help popover', '#/objects', `document.querySelector('[data-action="help-toggle"]').click()`);
    await interact('language switch de→fr', '#/objects', `document.querySelector('[data-menu="language"]').click(); document.querySelector('[data-lang="fr"]').click()`);
    await interact('resize window (ResizeObserver)', '#/objects?view=table', `return new Promise(res => { const main = document.querySelector('.ob-content'); main.style.width = '700px'; requestAnimationFrame(() => { main.style.width = ''; res(); }); })`);
    if (!quick) await interact('open print workspace', '#/objects', `return new Promise(async res => { document.querySelector('[data-export="diagram-pdf"]').click(); while (!(document.querySelector('#diagram-sheets svg') || document.querySelector('#diagram-error:not([hidden])'))) await new Promise(r => setTimeout(r, 10)); res(); })`);

    /* ---- memory over repeated navigation ---- */
    if (!quick) {
      const gcMetrics = async () => { await cdp.send('HeapProfiler.collectGarbage'); const m = await metrics(); return { JSHeapUsedSize: m.JSHeapUsedSize, Nodes: m.Nodes, JSEventListeners: m.JSEventListeners }; };
      await page.evaluate(() => { location.hash = '#/'; }); await settle(page);
      report.memory = [{ cycle: 0, ...(await gcMetrics()) }];
      const cycle = ['#/objects', '#/objects/gebaeude?tab=relations', '#/tables/t-gwr-gebaeude?tab=rows', '#/search?q=Geb%C3%A4ude', '#/manual', '#/'];
      for (let c = 1; c <= 5; c++) {
        for (let r = 0; r < 5; r++) for (const h of cycle) { await page.evaluate(h => { location.hash = h; }, h); await settle(page); }
        await page.evaluate(() => { document.querySelector('[data-menu="actions"]')?.click(); document.querySelector('[data-action="help-toggle"]')?.click(); document.body.click(); });
        report.memory.push({ cycle: c, ...(await gcMetrics()) });
      }
    }
    report.errors = errors;
  } catch (e) {
    console.error('page errors:', errors, 'main:', await page.evaluate(() => document.getElementById('main')?.textContent.trim().slice(0, 300)).catch(() => '-'));
    throw e;
  } finally {
    fs.writeFileSync(path.join(OUT, `load-${label}.json`), JSON.stringify(report, null, 1));
    await browser.close(); server.close();
  }
  const s = report.startup;
  console.log(`[${label}] cpu ${cpu}x net ${net} ${report.protocol} ${report.provider}${report.snapshot ? ` snapshot ${report.snapshot.bytes} B (gzip ${report.snapshot.gzip}, br ${report.snapshot.brotli})` : ''}`);
  console.log(`cold: first paint ${s.paint['first-contentful-paint'] ?? '-'} ms, ready ${s.appReadyMs} ms, DCL ${s.domContentLoaded} ms, load ${s.load} ms; ${s.requests} requests, ${s.transfer} B transferred (${s.bytes} B decoded); icons ${s.iconRequests} requests from ${s.firstIconStart} ms; long tasks ${s.longTasks.map(t => t.duration + '@' + t.start).join(',') || 'none'}`);
  console.log('phases (start, duration):', JSON.stringify(s.phases));
  console.log('profile by file:', JSON.stringify(report.profile.byFile));
  console.log('top functions:', JSON.stringify(report.profile.topFunctions.slice(0, 14)));
  console.log(`warm: ready ${report.warmReload.appReadyMs} ms, ${report.warmReload.networkRequests}/${report.warmReload.requests} requests hit the network, ${report.warmReload.transfer} B; phases ${JSON.stringify(report.warmReload.phases)}; long tasks ${report.warmReload.longTasks.map(t => t.duration).join(',') || 'none'}`);
  console.log('routes:'); for (const r of report.routes) console.log(`  ${r.route.padEnd(40)} render ${r.renderMs} ms, frame ${r.frameMs} ms, script ${r.scriptMs} ms, style ${r.styleRecalcs}× ${r.styleMs} ms, layout ${r.layouts}× ${r.layoutMs} ms, nodes ${r.nodes}`);
  console.log('interactions:'); for (const r of report.interactions) console.log(`  ${r.name.padEnd(34)} sync ${r.syncMs} ms (max ${r.maxSyncMs}), frame ${r.frameMs} ms, style ${r.styleRecalcs}× ${r.styleMs} ms, layout ${r.layouts}× ${r.layoutMs} ms`);
  if (report.memory) console.log('memory:', report.memory.map(m => `${m.cycle}: ${Math.round(m.JSHeapUsedSize / 1048576 * 10) / 10} MB / ${m.Nodes} nodes / ${m.JSEventListeners} listeners`).join(' | '));
  if (errors.length) console.log('page errors:', errors);
})().catch(e => { console.error(e); process.exit(1); });
