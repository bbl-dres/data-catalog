/* Actual browser downloads, failure/retry, scope snapshots and previously unsupported profiles. */
const assert = require('node:assert/strict');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const { readWorkbook } = require('./excel-helpers.cjs');
const server = createServer();
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const base = `http://127.0.0.1:${server.address().port}/`;
    const visit = async hash => { await page.goto(base + hash); await page.locator('#page-content h1').waitFor(); await settle(page); };
    const start = async () => {
      await page.click('[data-menu="actions"]');
      assert.equal(await page.locator('[data-export="csv"]').count(), 0);
      await page.click('[data-export="xlsx"]');
    };
    const download = async () => {
      const event = page.waitForEvent('download'); await start();
      const file = await event;
      assert(file.suggestedFilename().endsWith('.xlsx'));
      await page.waitForFunction(() => !DK.app.state.exporting);
      return readWorkbook(await file.path());
    };
    await visit('#/systems/gwr');
    assert.equal(await page.locator('script[src*="exceljs.min.js"]').count(), 0, 'writer must load on demand');
    let attempts = 0;
    await page.route('**/vendor/exceljs/exceljs.min.js', async route => {
      attempts++;
      if (attempts === 1) await route.abort(); else await route.continue();
    });
    await start();
    await page.locator('#toasts .ob-alert--error').waitFor();
    assert.equal(await page.evaluate(() => DK.app.state.exporting), false);
    const gwr = await download();
    assert.equal(attempts, 2);
    assert.equal(gwr.getWorksheet('Felder').rowCount, 147);
    assert.equal(gwr.getWorksheet('Werte').rowCount, 468);
    assert.equal(await page.locator('script[src*="exceljs.min.js"]').count(), 1);
    console.log('PASS: lazy local writer, load failure/retry and complete GWR workbook download');

    const profiles = [
      ['#/objects/gebaeude/attributes/egid', 'Attribute', 2],
      ['#/tables/t-gwr-gebaeude/fields/GKAT', 'Felder', 2],
      ['#/products/p-gebaeudebestand', 'Attribute', 6],
      ['#/apis/api-immo', 'API-Verzeichnis', 2],
      ['#/objects?filter=no-such-record', 'Geschäftsobjekte', 1],
    ];
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [hash, sheet, count] of profiles) {
      await visit(hash);
      const wb = await download();
      assert.equal(wb.getWorksheet(sheet).rowCount, count, hash);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    console.log('PASS: mobile attribute, field, product, API and empty filtered-list exports');

    // A slow writer must use the captured source page, even after navigating elsewhere.
    await page.unroute('**/vendor/exceljs/exceljs.min.js');
    await visit('#/objects?filter=Meilenstein');
    // Full reload creates a fresh lazy-loader state.
    await page.reload(); await page.locator('#collection-filter').waitFor();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/vendor/exceljs/exceljs.min.js', async route => { await gate; await route.continue(); });
    const pending = page.waitForEvent('download');
    await start();
    await page.click('[data-menu="actions"]');
    assert(await page.locator('[data-export="xlsx"]').isDisabled());
    await page.evaluate(() => { location.hash = '#/manual'; }); await settle(page);
    release();
    const wb = await readWorkbook(await (await pending).path());
    assert.equal(wb.getWorksheet('Geschäftsobjekte').rowCount, 2);
    assert.equal(wb.getWorksheet('Geschäftsobjekte').getCell('B2').value, 'Meilenstein');
    assert.equal(wb.getWorksheet('Attribute').rowCount, 7);
    assert(page.url().endsWith('#/manual'));
    assert.deepEqual(errors, []);
    console.log('PASS: duplicate-export guard and source snapshot across route changes');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
