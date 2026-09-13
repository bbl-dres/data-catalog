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
    assert.equal(workbook.getWorksheet('Datentabellen').rowCount, 8 + 2);
    assert.equal(workbook.getWorksheet('Felder'), undefined, 'A system does not expand its tables into fields');
    assert.equal(workbook.getWorksheet('Metadaten'), undefined);
    const tables = await page.evaluate(() => DK.data.tablesOfSystem(DK.data.get('systems', 'av')).map(t => ({ id: t.identifier, count: t.fields.length })));
    const exportedNames = [];
    for (const table of tables) {
      await visit('#/tables/' + table.id);
      await page.click('[data-menu="actions"]');
      const nextDownload = page.waitForEvent('download');
      await page.click('[data-export="xlsx"]');
      const tableWorkbook = await readWorkbook(await (await nextDownload).path());
      const fields = tableWorkbook.getWorksheet('Felder');
      assert.equal(fields.rowCount, table.count + 2);
      exportedNames.push(...require('./excel-helpers.cjs').columnValues(fields, 'technicalName'));
    }
    assert.equal(exportedNames.length, 49, 'Individual table exports retain every source field');
    assert.deepEqual(errors, []);
    console.log('PASS AV system scope, all 49 fields through table exports and no browser errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
