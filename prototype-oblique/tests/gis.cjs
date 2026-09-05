/* Source-complete GIS inventory, duplicate identities, local search and Excel export. */
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
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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
      await visit('#/systems/gis?tab=rows');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 7);
      assert.equal(await page.locator('#panel-rows a[href="#/tables/t-boden"]').innerText(), 'Bodenabdeckung');
      if (width === 1600) {
        const labels = await page.locator('#sidebar-tree .ob-tree-row[style="--level:3"] .ob-tree-label').allTextContents();
        assert.deepEqual(labels, [...labels].sort(new Intl.Collator('de-CH', { sensitivity: 'base', numeric: true }).compare));
        assert(labels.includes('Bodenabdeckung') && labels.includes('Grünfläche'));
      }
      await visit('#/tables/t-geb-gis?tab=rows');
      assert.equal(await page.locator('#tab-rows').innerText(), 'Felder (74)');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 50);
      await page.click('[data-focus="page-next"]');
      await settle(page);
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 24);
      await page.fill('#collection-filter', 'bbl_hist');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 2);
      const links = await page.locator('#panel-rows a').evaluateAll(items => items.map(item => item.getAttribute('href')));
      assert.equal(new Set(links).size, 2);
      await page.locator('#panel-rows a').last().click();
      await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Archivwürdigkeit'));
      assert((await page.locator('.ob-comment').innerText()).includes('zweimal'));
      assert((await page.locator('.ob-core-facts').innerText()).includes('LIVE'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `field overflow at ${width}px`);
      await visit('#/tables/t-boden?tab=rows');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 46);
      await page.fill('#collection-filter', 'ao_id');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 1);
      await page.locator('#panel-rows a').first().click();
      await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'AO ID (ao_id)');
      assert.equal(await page.locator('.ob-core-facts dt').filter({ hasText: 'Objekttypen' }).locator('+ dd').innerText(), 'Gebäude');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `typed field overflow at ${width}px`);
      console.log(`PASS GIS navigation, pagination, duplicate fields and type scope at ${width}px`);
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    await visit('#/systems/gis?tab=rows');
    await page.click('[data-menu="actions"]');
    const download = page.waitForEvent('download');
    await page.click('[data-export="xlsx"]');
    const workbook = await readWorkbook(await (await download).path());
    const fields = workbook.getWorksheet('Felder');
    assert.equal(fields.rowCount, 276);
    assert.equal(fields.getColumn(4).values.filter(value => value === 'bbl_hist').length, 2);
    const metadata = workbook.getWorksheet('Metadaten');
    assert(metadata.getColumn(4).values.includes('sourceStatus'));
    const types = [];
    metadata.eachRow(row => { if (row.getCell(4).value === 'objectTypes') types.push(JSON.parse(row.getCell(5).value)); });
    assert(types.some(list => list[0].name === 'Gebäude' && list[0].geometryType === 'Polygon'));
    assert.deepEqual(errors, []);
    console.log('PASS complete 275-field workbook, source statuses, geometry type metadata and no browser errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
