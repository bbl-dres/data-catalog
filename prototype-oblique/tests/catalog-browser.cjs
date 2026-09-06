const assert = require('node:assert/strict');
const { database } = require('./catalog-test-helpers.cjs');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');

(async () => {
  const db = await database();
  const server = createServer({ catalogProvider: 'supabase' });
  let browser;
  try {
    const snapshot = (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot;
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [], catalogJsonRequests = [];
    const liveChecks = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/\/data\/(domains|systems|objects|tables|codelists|products|apis|changelog)\.json$/.test(r.url())) catalogJsonRequests.push(r.url()); });
    if (process.env.CATALOG_LIVE_READ === '1') {
      page.on('response', response => {
        if (response.url().endsWith('/rpc/read_snapshot')) liveChecks.push(response.json().then(actual => { assert.deepEqual(actual, snapshot, 'Hosted snapshot must match the tested import'); }));
      });
    } else await page.route('https://zicluerzbevodlmtbxow.supabase.co/rest/v1/rpc/read_snapshot', route => route.fulfill({ json: snapshot }));
    const visit = async hash => {
      await page.goto(base + hash);
      await page.locator('#page-content h1').waitFor();
      await settle(page);
    };
    await visit('#/');
    assert.equal(await page.evaluate(() => DK.data.tables.length), 30);
    await visit('#/tables/t-sap-building?tab=rows');
    await page.locator('#collection-filter').fill('COMP_CODE');
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 1);
    await page.locator('#panel-rows tbody tr a').first().click();
    await page.locator('.ob-core-facts').waitFor();
    assert.match(page.url(), /fields\/COMP_CODE/);
    await visit('#/tables/t-gwr-gebaeude/fields/EGID');
    assert.match(await page.locator('.ob-responsibility').innerText(), /Bundesamt für Statistik/);
    await visit('#/objects/gebaeude?tab=relations');
    assert.ok(await page.locator('.ob-graph').count(), 'Bubble diagram renders from projected relationships');
    await visit('#/systems/gis?tab=relations');
    assert.ok(await page.locator('.ob-graph').count());
    await visit('#/search?q=Geb%C3%A4ude');
    assert.ok(await page.locator('tbody tr').count());
    assert.equal(await page.locator('#search-input').inputValue(), 'Gebäude');
    await page.setViewportSize({ width: 390, height: 844 });
    await visit('#/tables/t-gwr-gebaeude?tab=rows');
    await page.locator('#collection-filter').fill('EGID');
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No mobile page overflow');
    assert.deepEqual(errors, []);
    assert.deepEqual(catalogJsonRequests, [], 'Supabase mode never fetches the legacy catalog files');
    await Promise.all(liveChecks);
    page.removeAllListeners('response');
    await page.route('https://zicluerzbevodlmtbxow.supabase.co/rest/v1/rpc/read_snapshot', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
    await page.reload();
    await page.getByText('Datenkatalog konnte nicht geladen werden', { exact: true }).waitFor();
    assert.equal(await page.locator('#page-content').count(), 0, 'No silent fallback to stale JSON data');
    console.log('Supabase browser checks passed: navigation, field search, responsibility, bubbles, global search, mobile and failed-load handling.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
