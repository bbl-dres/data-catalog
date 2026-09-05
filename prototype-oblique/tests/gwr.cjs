/* Real imported GWR content: navigation, code-list links, large lists and exports. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const visit = async hash => {
      await page.goto(base);
      await page.locator('#page-content h1').waitFor();
      await page.goto(base + hash);
      await page.locator('#page-content h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await settle(page);
    };
    await visit('#/tables');
    assert.equal(await page.locator('#sidebar-tree [data-action="open-overview"] .ob-tree-count').count(), 0);
    await page.click('#sidebar-tree a[data-key="tables"]');
    const branch = page.locator('#sidebar-tree a[data-key="tables:system:gwr"]');
    assert.equal(await branch.locator('.ob-tree-count').innerText(), '7');
    await branch.click();
    await page.click('#tab-rows');
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 7);
    await page.click('#tab-relations');
    assert(await page.locator('.ob-relations-diagram').isVisible());
    await page.click('[data-action="toggle-relation-view"]');
    assert.equal(await page.locator('.ob-relations-list a[href^="#/tables/t-gwr-"]').count(), 7);

    const tables = await page.evaluate(() => DK.data.tablesOfSystem(DK.data.sysOf('gwr')).map(t => ({id: t.identifier, count: t.fields.length})));
    for (const width of [1600, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      for (const table of tables) {
        await visit('#/tables/' + table.id);
        assert.equal(await page.locator('.ob-detail-description').innerText(), await page.evaluate(id => DK.data.get('tables', id).description, table.id));
        await page.click('#tab-rows');
        await settle(page);
        assert.equal(await page.locator('#panel-rows tbody tr').count(), table.count);
        assert(await page.locator('#panel-rows a[href^="#/refs/r-gwr-"]').count() > 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}: ${table.id}`);
        if (width <= 390) assert(await page.locator('#panel-rows .ob-table-region.is-cards').isVisible());
      }
      console.log(`PASS: all seven GWR field tables and reference links at ${width}px`);
    }

    await page.setViewportSize({width: 1600, height: 1000});
    await visit('#/tables/t-gwr-gebaeude');
    await page.click('#tab-rows');
    await page.screenshot({path: path.join(process.env.TEMP || '/tmp', 'oblique-gwr-fields.png')});
    await page.click('#panel-rows a[href="#/refs/r-gwr-kat"]');
    await page.waitForURL('**/#/refs/r-gwr-kat*');
    await settle(page);
    assert.equal(await page.locator('#tab-rows').innerText(), 'Werte (6)');
    await page.click('#tab-rows');
    assert((await page.locator('#panel-rows').innerText()).includes('Provisorische Unterkunft'));
    await page.click('#tab-relations');
    if (await page.locator('.ob-relations-diagram').isVisible()) await page.click('[data-action="toggle-relation-view"]');
    await page.click('.ob-relations-list a[href="#/tables/t-gwr-gebaeude"]');
    await settle(page);
    assert(page.url().includes('#/tables/t-gwr-gebaeude'));

    await visit('#/refs/r-gwr-gklas');
    assert((await page.locator('#panel-overview').innerText()).includes('MK 4.2'));
    assert((await page.locator('.ob-detail-description').innerText()).includes('nicht bestätigt'));
    await visit('#/refs/r-gwr-wstwk');
    await page.click('#tab-rows');
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 50);
    await page.click('[data-focus="page-next-top"]');
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 50);
    await page.click('[data-focus="page-next-top"]');
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 19);
    await page.selectOption('[data-action="set-page-size"]', '200');
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 119);
    await page.click('#panel-rows [data-sort-column="0"]');
    assert.equal(await page.locator('#panel-rows tbody tr').first().locator('td').first().innerText(), '3100');
    await page.click('#panel-rows [data-sort-column="0"]');
    assert.equal(await page.locator('#panel-rows tbody tr').first().locator('td').first().innerText(), '3419');
    await page.selectOption('[data-action="set-page-size"]', '50');
    await page.click('[data-menu="actions"]');
    const download = page.waitForEvent('download');
    await page.click('[data-export="xlsx"]');
    const workbook = await require('./excel-helpers.cjs').readWorkbook(await (await download).path());
    const values = workbook.getWorksheet('Werte');
    assert.equal(values.rowCount, 120, 'Excel must contain all values, not just one page');
    const labels = values.getColumn(4).values;
    assert(labels.includes('Parterre inkl. Hochparterre') && labels.includes('19. Untergeschoss'));
    console.log('PASS: code-list round trip, source version, 119-value paging, sorting and complete Excel export');

    await page.setViewportSize({width: 390, height: 844});
    await visit('#/tables/t-gwr-gebaeude');
    await page.click('#tab-rows');
    await page.screenshot({path: path.join(process.env.TEMP || '/tmp', 'oblique-gwr-phone.png')});
    await page.click('[data-action="open-navigation"]');
    await page.click('#sidebar-tree a[data-key="tables:system:gwr"]');
    await settle(page);
    assert(page.url().includes('#/systems/gwr'));
    assert.equal(await page.locator('.ob-tree-panel.is-mobile-open').count(), 0);
    for (const width of [1600, 390]) {
      await page.setViewportSize({width, height: 1000});
      await visit('#/domains/projekt');
      assert.equal(await page.locator('h1').innerText(), 'Projekt Management');
      await page.click('#view-tab-table');
      assert.equal(await page.locator('#collection-view-panel tbody tr').count(), 4);
      await page.click('#collection-view-panel a[href="#/objects/bauarbeiten"]'); await settle(page);
      assert.equal(await page.locator('h1').innerText(), 'Bauarbeiten');
      assert.equal(await page.locator('.ob-breadcrumb a[href="#/domains/projekt"]').count(), 1);
      await page.click('#tab-overview');
      assert((await page.locator('.ob-core-facts').innerText()).includes('lokale Modellierungsbeispiele'));
      await page.click('#tab-relations');
      assert(await page.locator('.ob-relations-diagram').isVisible());
      await page.click('[data-action="toggle-relation-view"]');
      await page.click('.ob-relations-list a[href="#/tables/t-gwr-arbeiten"]'); await settle(page);
      assert.equal(await page.locator('h1').innerText(), 'Arbeiten');
      await page.click('#tab-overview');
      assert((await page.locator('.ob-responsibility').innerText()).includes('Bundesamt für Statistik (BFS)'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await visit('#/objects?filter=Meilenstein');
      assert.equal(await page.locator('.ob-tile').count(), 1);
      await page.click('#view-tab-table');
      await page.click('#collection-view-panel a[href="#/objects/meilenstein"]'); await settle(page);
      await page.click('#tab-rows');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 6);
      if (width < 960) await page.click('[data-action="open-navigation"]');
      const projectBranch = page.locator('#sidebar-tree a[data-key="objects:domain:projekt"]');
      assert.equal(await projectBranch.locator('.ob-tree-count').innerText(), '4');
      await projectBranch.click(); await settle(page);
      assert.equal(await page.locator('h1').innerText(), 'Projekt Management');
    }
    console.log('PASS: project domain, draft objects, GWR relationships, collection search and tree at desktop and phone widths');
    assert.deepEqual(errors, []);
    console.log('PASS: mobile GWR navigation; no runtime errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
