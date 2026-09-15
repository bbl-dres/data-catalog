/* Read-only browser verification; defaults to the isolated SQL test snapshot. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createServer, chromium, settle } = require('./browser-helpers.cjs');

(async () => {
  const server = createServer({ catalogProvider: 'supabase' });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (process.env.GWR_ENTRANCE_LIVE_READ !== '1') {
      const snapshot = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'gwr-entrance-import-snapshot.json'), 'utf8'));
      await page.route('https://zicluerzbevodlmtbxow.supabase.co/**', route => {
        if (['/rest/v1/rpc/read_snapshot', '/rest/v1/rpc/read_catalog_index'].includes(new URL(route.request().url()).pathname)) return route.fulfill({ json: snapshot });
        throw Error('Unexpected hosted request: ' + route.request().url());
      });
    }
    const base = `http://127.0.0.1:${server.address().port}/`;
    const visit = async hash => {
      await page.goto(base + hash);
      await page.locator('#page-content h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await settle(page);
    };
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await visit('#/objects/gebaeudeeingang?tab=rows');
      await page.locator('#panel-rows tbody tr').first().waitFor();
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 10);
      assert.match(await page.locator('#page-content h1').innerText(), /Gebäudeeingang/);
      assert(await page.locator('#panel-rows a[href="#/refs/r-gwr-doffadr"]').count());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const edidLink = await page.locator('#panel-rows a').filter({ hasText: 'Eidgenössischer Eingangsidentifikator' }).first().getAttribute('href');
      assert(edidLink);
      await visit(edidLink);
      assert.match(await page.locator('#page-content').innerText(), /EGID \+ EDID/);
      assert(await page.locator('a[href="https://www.housing-stat.ch/catalog/de/5.0/revised#EDID"]').count());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await visit('#/tables/t-gwr-gebaeudeeingang?tab=rows');
    await page.locator('#panel-rows tbody tr').first().waitFor();
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 9);
    await visit('#/objects/gebaeudeeingang?tab=relations');
    await page.locator('.ob-relations-diagram').waitFor();
    await page.click('[data-action="toggle-relation-view"]');
    assert(await page.locator('.ob-relations-list a[href="#/tables/t-gwr-gebaeudeeingang"]').count());
    await visit('#/refs/r-gwr-doffadr?tab=rows');
    await page.locator('#panel-rows tbody tr').first().waitFor();
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 2);
    const output = path.join(os.tmpdir(), 'gwr-entrance-' + (process.env.GWR_ENTRANCE_LIVE_READ === '1' ? 'live' : 'local'));
    fs.mkdirSync(output, { recursive: true });
    await visit('#/objects/gebaeudeeingang?tab=rows');
    await page.locator('#panel-rows tbody tr').first().waitFor();
    await page.screenshot({ path: path.join(output, 'attributes.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('GWR entrance browser: 10 attributes, composite EDID note, source links, 9 unchanged table fields, mapping and code list at 1440/320px passed. ' + output);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
