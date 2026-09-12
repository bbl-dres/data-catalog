/* Local search across collections and paginated detail rows. */
const assert = require('node:assert/strict');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Large and empty schemas remain covered independently of catalog curation.
    await page.route('**/data/tables.json', async route => {
      const response = await route.fetch();
      const tables = await response.json();
      const fields = tables.find(table => table.identifier === 't-sap-building').fields;
      for (let n = fields.length; n < 150; n++) {
        const name = n === 149 ? 'Asbest letzte Massnahme' : n < 71 ? `Gültig ${n}` : `Fixture ${n}`;
        fields.push({ technicalName: name, labels: { de: name }, description: '' });
      }
      tables.find(table => table.identifier === 't-sap-area').fields = [];
      await route.fulfill({ response, json: tables });
    });
    const visit = async hash => {
      await page.goto(base);
      await page.locator('#page-content h1').waitFor();
      await page.goto(base + hash);
      await page.evaluate(() => document.fonts.ready);
      await settle(page);
    };
    const input = page.locator('#collection-filter');
    const rows = page.locator('#panel-rows tbody tr');
    const params = () => new URLSearchParams(page.url().split('?')[1]);

    await visit('#/tables/t-sap-building?tab=rows');
    assert.equal(await rows.count(), 50);
    await page.click('[data-focus="page-next-top"]');
    assert.equal(params().get('page'), '2');
    await input.evaluate(el => { window.localSearchNode = el; });
    await input.fill('Asbest letzte Massnahme');
    assert.equal(await rows.count(), 1, 'search includes fields beyond the displayed page');
    assert((await rows.innerText()).includes('Asbest letzte Massnahme'));
    assert.equal(params().has('page'), false, 'new searches reset pagination');
    assert.equal(await page.locator('#collection-filter-status').innerText(), '1 von 150 Einträgen');
    assert(await input.evaluate(el => el === window.localSearchNode && el === document.activeElement));
    assert.equal(await page.locator('#tab-rows').innerText(), 'Felder (150)', 'tab count retains the full list size');

    await page.reload();
    await input.waitFor();
    assert.equal(await input.inputValue(), 'Asbest letzte Massnahme');
    assert.equal(await rows.count(), 1);
    await rows.locator('a').first().click();
    await page.locator('.ob-core-facts').waitFor();
    await page.goBack();
    await input.waitFor();
    assert.equal(await input.inputValue(), 'Asbest letzte Massnahme');
    assert.equal(await rows.count(), 1);
    await page.click('#tab-overview');
    assert.equal(await input.count(), 0);
    await page.click('#tab-rows');
    assert.equal(await input.inputValue(), 'Asbest letzte Massnahme');

    await input.dispatchEvent('compositionstart');
    await input.evaluate(el => {
      el.value = 'COMP_CODE';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    });
    assert.equal(params().get('filter'), 'Asbest letzte Massnahme');
    await input.dispatchEvent('compositionend');
    assert.equal(await rows.count(), 1);
    assert.equal(await rows.locator('a').first().innerText(), 'Buchungskreis (COMP_CODE)');
    await input.fill('<script>missing</script>');
    await input.press('Enter');
    assert(await page.locator('#panel-rows .ob-empty').isVisible());
    assert.equal(await page.locator('#collection-filter-status').innerText(), '0 von 150 Einträgen');
    assert.equal(await page.locator('#panel-rows .ob-pager').count(), 0);
    await page.click('#panel-rows [data-action="clear-collection-filter"]');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'collection-filter');
    assert.equal(await rows.count(), 50);
    assert.equal(params().has('filter'), false);

    await input.fill('Gueltig');
    const matched = await rows.count();
    assert(matched > 1 && matched < 50, 'umlaut alternatives match multiple rows');
    await page.locator('#panel-rows .ob-table-sort').first().click();
    assert.equal(await rows.count(), matched, 'sorting preserves the filter');
    await page.locator('#panel-rows [data-action="set-page-size"]').selectOption('100');
    assert.equal(await input.inputValue(), 'Gueltig');
    assert.equal(await rows.count(), matched);
    await input.press('Escape');
    assert.equal(await rows.count(), 100, 'clearing retains the chosen page size');
    console.log('PASS all-row matching, pagination, focus, IME, empty state, sorting, reload and back navigation');

    for (const width of [1920, 1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [hash, query, expected] of [
        ['#/systems/sap?tab=rows', 'VIBDBU', 1],
        ['#/tables/t-sap-architectural-object?tab=rows', 'Ebene', 1],
        ['#/tables/t-gwr-gebaeude?tab=rows', 'EGID', 1],
        ['#/objects/gebaeude?tab=rows', 'Fertigstellung', 1],
      ]) {
        await visit(hash);
        await input.fill(query);
        await settle(page);
        assert.equal(await rows.count(), expected, hash + ' matching names, technical names or descriptions');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${hash} overflow at ${width}px`);
        const bounds = await input.boundingBox();
        assert(bounds.width > 200 && bounds.x >= 0 && bounds.x + bounds.width <= width, 'search input remains usable');
        assert.equal(await input.getAttribute('aria-controls'), 'panel-rows');
        await input.press('Escape');
        assert.equal(await input.inputValue(), '');
      }
      await visit('#/domains/bau?tab=table');
      await input.fill('Areal');
      assert.equal(await page.locator('#collection-view-panel tbody tr').count(), 1);
      await page.click('#view-tab-tiles');
      assert.equal(await page.locator('#collection-view-panel .ob-tile').count(), 1);
      await visit('#/systems?view=table');
      await input.fill('SAP');
      assert.equal(await page.locator('#collection-view-panel tbody tr').count(), 1);
      console.log(`PASS systems, fields, attributes and domain business objects at ${width}px`);
    }

    await visit('#/tables/t-sap-area?tab=rows');
    assert(await input.isVisible(), 'empty source lists keep their controls');
    await input.fill('anything');
    assert.equal(await rows.count(), 0);
    assert(await page.locator('#panel-rows .ob-empty').isVisible());
    await input.press('Escape');

    await visit('#/tables/t-sap-building?tab=rows&filter=COMP_CODE');
    await page.click('[data-menu="actions"]');
    const download = page.waitForEvent('download');
    await page.click('[data-export="xlsx"]');
    const workbook = await require('./excel-helpers.cjs').readWorkbook(await (await download).path());
    assert.equal(workbook.getWorksheet('Felder').rowCount, 151, 'entity export retains the complete schema while browsing a filtered list');
    assert.deepEqual(errors, []);
    console.log('PASS empty source lists, complete entity export and no browser errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
