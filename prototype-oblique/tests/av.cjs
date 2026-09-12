/* AV model/service separation, missing facts, reference navigation and export. */
const assert = require('node:assert/strict');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const { readWorkbook } = require('./excel-helpers.cjs');

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const visit = async hash => {
      await page.goto(base);
      await page.locator('#page-content h1').waitFor();
      await page.goto(base + hash);
      await page.evaluate(() => document.fonts.ready);
      await settle(page);
    };
    for (const width of [1600, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await visit('#/systems/av?tab=rows');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 8);
      await page.fill('#collection-filter', 'RESF');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 1);
      await page.locator('#panel-rows a').first().click();
      await page.locator('#tab-rows').click();
      await page.fill('#collection-filter', 'EGRIS_EGRID');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 1);
      await page.locator('#panel-rows a').first().click();
      await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('(EGRIS_EGRID)'));
      const labels = await page.locator('.ob-core-facts dt').allTextContents();
      for (const label of ['Position', 'Status in Quelle', 'Objekttypen', 'Zugriffskategorie (GWR)', 'Stammdaten (GWR)', 'Quellenstand']) assert(!labels.includes(label));
      assert.equal(await page.locator('dt').filter({ hasText: /^Pflichtfeld$/ }).locator('+ dd').innerText(), '—');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await visit('#/tables/t-av-land-cover/fields/Art');
      await page.locator('.ob-core-facts a[href="#/refs/r-av-land-cover-type"]').click();
      await page.locator('#tab-rows').click();
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 26);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await visit('#/tables/t-boden');
      assert.equal(await page.locator('dt').filter({ hasText: /^Weitere Informationen$/ }).locator('+ dd').innerText(), '—');
      console.log(`PASS AV navigation, code lists and stable empty facts at ${width}px`);
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    await visit('#/systems/av?tab=rows');
    await page.click('[data-menu="actions"]');
    const download = page.waitForEvent('download');
    await page.click('[data-export="xlsx"]');
    const workbook = await readWorkbook(await (await download).path());
    assert.equal(workbook.getWorksheet('Felder').rowCount, 50);
    const metadata = workbook.getWorksheet('Metadaten');
    assert(metadata.getColumn(4).values.includes('modelDeclaration'));
    assert(metadata.getColumn(4).values.includes('serviceMetadata.storageCrs'));
    assert(metadata.getColumn(5).values.includes('http://www.opengis.net/def/crs/EPSG/0/2056'));
    assert.deepEqual(errors, []);
    console.log('PASS complete AV Excel export and no browser errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
