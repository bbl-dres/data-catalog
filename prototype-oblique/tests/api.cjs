const assert = require('node:assert/strict');
const { database } = require('../supabase/local-database.cjs');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');

(async () => {
  const db = await database(), server = createServer({ catalogProvider: 'supabase' });
  let browser;
  try {
    const snapshot = (await db.query('SELECT catalog.read_snapshot() AS value')).rows[0].value;
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    let rejectRead = false;
    await page.route('https://zicluerzbevodlmtbxow.supabase.co/rest/v1/**', async route => {
      const request = route.request(), url = new URL(request.url());
      requests.push({ path: url.pathname, query: url.searchParams, method: request.method(), headers: request.headers(), body: request.postData() });
      if (url.pathname.endsWith('/rpc/read_snapshot')) return route.fulfill({ json: snapshot });
      if (url.pathname.endsWith('/business_object') && request.method() === 'GET') {
        return rejectRead ? route.fulfill({ status: 503, json: { message: 'Temporary test outage' } })
          : route.fulfill({ json: [{ identifier: 'gebaeude', name_de: 'Gebäude' }], headers: { 'Content-Range': '0-0/1' } });
      }
      throw new Error('Unexpected API request: ' + request.method() + ' ' + url.pathname);
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/#/api`);
    await page.locator('#swagger-ui .ob-swagger-content[aria-busy="false"]').waitFor();
    assert.equal(await page.locator('#swagger-ui .opblock').count(), 20);
    assert.equal(await page.locator('#sidebar:visible').count(), 0);
    const operation = page.locator('#operations-Business_objects-list_business_object');
    await operation.locator('.opblock-summary-control').click();
    await operation.getByRole('button', { name: 'Try it out', exact: true }).click();
    const input = name => operation.locator(`tr[data-param-name="${name}"] input`);
    await input('select').fill('identifier,name_de');
    await input('identifier').fill('eq.gebaeude');
    await input('limit').fill('1');
    await input('order').fill('id.asc');
    await operation.getByRole('button', { name: 'Execute', exact: true }).click();
    await operation.locator('.responses-inner .live-responses-table').waitFor();
    assert.match(await operation.locator('.live-responses-table').innerText(), /Gebäude/);
    const read = requests.at(-1);
    assert.equal(read.method, 'GET');
    assert.equal(read.headers['accept-profile'], 'catalog');
    assert(read.headers.apikey.startsWith('sb_publishable_'));
    assert(!read.headers.authorization);
    assert.equal(read.query.get('identifier'), 'eq.gebaeude');
    assert.equal(read.query.get('select'), 'identifier,name_de');
    assert.equal(read.query.get('limit'), '1');
    assert.equal(read.query.get('order'), 'id.asc');
    rejectRead = true;
    await operation.getByRole('button', { name: 'Execute', exact: true }).click();
    await operation.getByText('Temporary test outage', { exact: false }).first().waitFor();
    rejectRead = false;
    await operation.getByRole('button', { name: 'Execute', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#operations-Business_objects-list_business_object .live-responses-table')?.textContent.includes('Gebäude'));
    const rpc = page.locator('#operations-Snapshot-read_snapshot');
    await rpc.locator('.opblock-summary-control').click();
    await rpc.getByRole('button', { name: 'Try it out', exact: true }).click();
    await rpc.getByRole('button', { name: 'Execute', exact: true }).click();
    await rpc.locator('.live-responses-table').waitFor();
    const snapshotRead = requests.at(-1);
    assert.equal(snapshotRead.method, 'POST');
    assert.equal(snapshotRead.headers['content-profile'], 'catalog');
    assert(!snapshotRead.headers.authorization);
    assert.deepEqual(JSON.parse(snapshotRead.body || '{}'), {});
    assert.match(await rpc.locator('.live-responses-table').innerText(), /schemaVersion/);
    await rpc.locator('.opblock-summary-control').click();
    for (const width of [390, 320, 1600]) {
      await page.setViewportSize({ width, height: 844 }); await settle(page);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), width + ': no document overflow');
    }
    await page.locator('#swagger-ui .operation-filter-input').fill('Business objects');
    await page.evaluate(() => { DK.app.state.lang = 'en'; DK.app.render(); }); await settle(page);
    assert.equal(await page.locator('#swagger-ui .operation-filter-input').inputValue(), 'Business objects');
    assert.equal(await input('identifier').inputValue(), 'eq.gebaeude');
    assert.deepEqual(errors, []);
    console.log('PASS: 20 real API operations, automatic public-key reads, schema headers, filter/projection/pagination, snapshot POST, retry, retained state and 320–1600 px layouts.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
