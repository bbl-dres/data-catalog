/* Repeatable local measurements; timings are reports, deterministic work counts are regressions. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');
(async () => {
  const test = await workspace(), { page, visit, open, close, settle, output, choose } = test;
  const phase = process.env.REPORT_ONLY ? 'before' : 'after';
  const report = { phase, cpuRate: Number(process.env.PERF_CPU_RATE || 1), timings: {}, routes: [] };
  report.environment = { browser: page.context().browser().version(), node: process.version, platform: process.platform, viewport: page.viewportSize(), provider: process.env.DIAGRAM_SUPABASE === '1' ? 'local SQL snapshot' : 'legacy JSON' };
  const save = stage => {
    fs.writeFileSync(path.join(output, `performance-${phase}-${report.cpuRate}x.json`), JSON.stringify(report, null, 2));
    console.log(stage);
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: report.cpuRate });
  await cdp.send('Performance.enable');
  try {
    await page.addInitScript(() => {
      window.perfLongTasks = [];
      const ready = new MutationObserver(() => {
        if (!document.querySelector('#page-content h1')) return;
        window.perfReadyMs = performance.now(); ready.disconnect();
      });
      ready.observe(document, { childList: true, subtree: true });
      new PerformanceObserver(list => window.perfLongTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
      window.bench = (callback, iterations = 7) => {
        callback(); const samples = [];
        for (let i = 0; i < iterations; i++) { const start = performance.now(); callback(); samples.push(performance.now() - start); }
        const sorted = samples.slice().sort((a, b) => a - b);
        return { median: sorted[Math.floor(sorted.length / 2)], max: Math.max(...samples), samples };
      };
    });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await visit('#/'); await settle(page);
    report.startup = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      return { navigationMs: performance.getEntriesByType('navigation')[0].loadEventEnd, appReadyMs: window.perfReadyMs,
        longTasks: perfLongTasks, requests: resources.length, resourceBytes: resources.reduce((sum, e) => sum + e.decodedBodySize, 0),
        lazyVendors: resources.filter(e => /vendor\//.test(e.name)).map(e => e.name.split('/vendor/')[1]),
        snapshotBytes: new TextEncoder().encode(JSON.stringify(DK.data.catalogSnapshot)).length,
        records: Object.fromEntries(Object.entries(DK.data.catalogSnapshot || {}).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])) };
    });
    assert.deepEqual(report.startup.lazyVendors, []);
    save('Startup measured');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
    report.timings.projection = await page.evaluate(() => bench(() => DK.catalog.project(DK.data.catalogSnapshot), 5));
    save('Projection measured');
    if (report.cpuRate === 1) report.timings.projection10x = await page.evaluate(() => {
      const scaled = { schemaVersion: 1 };
      for (const [key, values] of Object.entries(DK.data.catalogSnapshot)) {
        scaled[key] = Array.isArray(values) ? Array.from({ length: 10 }, (_, i) => values.map(record => Object.fromEntries(Object.entries(record).map(([key, value]) =>
          [key, value && typeof value === 'string' && (key === 'id' || key.endsWith('_id')) ? value + ':' + i : value])))).flat() : values;
      }
      return bench(() => DK.catalog.project(scaled), 3);
    });
    save('Scaled projection measured');
    for (const [name, route, tab] of [
      ['home', '#/'], ['objects', '#/objects'], ['tables', '#/tables?view=table'], ['references', '#/refs'], ['products', '#/products'], ['apis', '#/apis'],
      ['system', '#/systems/gwr'], ['fields', '#/tables/t-sap-building', 'rows'], ['search', '#/search?q=GWR'],
      ['relations', '#/objects/gebaeude', 'relations'], ['manual', '#/manual'], ['api', '#/api']
    ]) {
      await visit(route); if (tab) await page.locator(`[data-tab="${tab}"]`).click();
      if (name === 'api') await page.locator('.swagger-ui .opblock').first().waitFor();
      await settle(page);
      report.routes.push({ name, ...await page.evaluate(() => ({ render: bench(() => DK.app.render(), 5), nodes: document.getElementsByTagName('*').length })) });
      save(`Rendered ${name}`);
    }
    await visit('#/');
    report.timings.search = await page.evaluate(() => bench(() => {
      for (const query of ['GWR', 'Gebäude', 'Energie', 'Was ist GWR?']) {
        const groups = DK.search.results(query); DK.search.page(groups, query); DK.search.answer(query, {}, groups);
      }
    }, 9));
    report.timings.examples = await page.evaluate(() => bench(() => DK.search.examples({}), 9));
    save('Search measured');
    await visit('#/tables/t-sap-building'); await page.locator('[data-tab="rows"]').click();
    report.timings.fieldFilter = await page.evaluate(() => {
      const samples = [];
      for (const q of ['Geb', 'Gebäude', 'EGID', '']) {
        const start = performance.now(), input = document.getElementById('collection-filter');
        input.value = q; input.dispatchEvent(new Event('input', { bubbles: true })); samples.push(performance.now() - start);
      }
      return { samples, max: Math.max(...samples) };
    });
    save('Field filtering measured');
    await visit('#/systems/gwr');
    report.timings.capture = await page.evaluate(() => {
      const route = DK.router.parse(); route.entity = { ...DK.data.get('systems', 'gwr'), kind: 'systems' };
      const ctx = DK.views.context(route, DK.app.state);
      return bench(() => DK.diagram.capture(route, ctx, 'de'), 5);
    });
    save('Capture measured');
    const started = Date.now(); await open(); report.timings.printOpenMs = Date.now() - started;
    report.timings.layout = await page.evaluate(async () => {
      const measure = DK.pdf.measure(await DK.pdf.load()), { snapshot, settings } = printTest;
      return bench(() => DK.diagram.layout(snapshot, settings, measure), 7);
    });
    for (const mode of ['grid', 'list']) {
      await choose('[data-diagram-setting="layout"]', mode);
      report.timings[`layout_${mode}`] = await page.evaluate(async () => {
        const measure = DK.pdf.measure(await DK.pdf.load()), { snapshot, settings } = printTest;
        return bench(() => DK.diagram.layout(snapshot, settings, measure), 7);
      });
    }
    save('Print layouts measured');
    report.wrapping = await page.evaluate(() => {
      let calls = 0; const measured = new Set();
      const measure = (text, size) => { calls++; measured.add(text); return text.length * size / 2; };
      const value = 'one two three four five six seven eight nine ten';
      const lines = DK.diagram.wrap(value, 45, 10, false, measure);
      return { calls, distinct: measured.size, lines };
    });
    report.scroll = await page.evaluate(async () => {
      const changes = [], observer = new MutationObserver(records => changes.push(...records));
      const header = document.querySelector('.ob-export-dialog'); observer.observe(header, { attributes: true, childList: true, subtree: true });
      const before = performance.now();
      for (let i = 0; i < 20; i++) {
        document.getElementById('diagram-canvas').dispatchEvent(new Event('scroll'));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      observer.disconnect();
      return { mutations: changes.length, elapsedMs: performance.now() - before, mountedPages: document.querySelectorAll('.ob-export-page-svg > svg').length,
        totalPages: document.querySelectorAll('.ob-export-page').length };
    });
    if (!process.env.REPORT_ONLY) {
      assert.deepEqual(report.wrapping.lines, ['one two', 'three', 'four five', 'six seven', 'eight', 'nine ten']);
      assert(report.wrapping.calls <= 15, 'Fitting words should not be measured character by character');
      assert.equal(report.scroll.mutations, 0, 'Unchanged scroll position should not rewrite preview controls');
      assert(report.scroll.mountedPages <= 4, 'Preview only mounts nearby pages at fit-page zoom');
    }
    // Ignore the test-only layout capture before checking repeated modal cleanup.
    report.lifecycle = [];
    for (let i = 0; i < 5; i++) {
      await page.locator('[data-diagram-action="close"]').first().click();
      await settle(page); await page.evaluate(() => { delete window.printTest; });
      await cdp.send('HeapProfiler.collectGarbage');
      const { metrics } = await cdp.send('Performance.getMetrics');
      report.lifecycle.push(Object.fromEntries(metrics.filter(m => ['JSHeapUsedSize', 'Nodes', 'JSEventListeners'].includes(m.name)).map(m => [m.name, m.value])));
      assert.equal(await page.locator('.ob-export-dialog').count(), 0);
      if (i < 4) await open();
    }
    assert.equal(report.lifecycle.at(-1).JSEventListeners, report.lifecycle[1].JSEventListeners, 'Repeated print workspaces release their listeners');
    report.errors = test.errors;
    assert.deepEqual(report.errors, []);
    save('Complete');
    console.log(JSON.stringify(report, null, 2));
  } finally { await close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
