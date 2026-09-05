/* Curated SAP scope, architectural object types and exported source metadata. */
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
    const inventories = [
      { id: 't-sap-business-entity', name: 'Wirtschaftseinheit', table: 'VIBDBE', count: 9, field: 'SWENR', label: 'Wirtschaftseinheit' },
      { id: 't-sap-rental-object', name: 'Mietobjekt', table: 'VIBDRO', count: 12, field: 'SMENR', label: 'Mietobjekt' },
      { id: 't-sap-contract', name: 'Vertrag', table: 'VICNCN', count: 9, field: 'RECNNR', label: 'Nummer des Vertrags' },
    ];
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
      await visit('#/systems/sap?tab=rows');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 8);
      const text = await page.locator('#panel-rows').innerText();
      for (const retired of ['t-we', 't-mo', 't-mv', 't-sap-site', 't-sap-company-code', 't-sap-infrastructure-container']) {
        assert.equal(await page.locator(`#panel-rows a[href="#/tables/${retired}"]`).count(), 0);
      }
      assert(text.includes('Architektonisches Objekt'));
      if (width === 1600) {
        assert((await page.locator('#sidebar-tree a[href="#/tables/t-bem"]').innerText()).includes('Bemessungen (VIBDMEAS)'));
        assert((await page.locator('#sidebar-tree a[href="#/tables/t-sap-building"]').innerText()).includes('Gebäude (VIBDBU)'));
        assert((await page.locator('#sidebar-tree a[href="#/tables/t-sap-business-entity"]').innerText()).includes('Wirtschaftseinheit (VIBDBE)'));
        const labels = await page.locator('#sidebar-tree a[href^="#/tables/t-"] .ob-tree-label').allTextContents();
        assert.deepEqual(labels, [...labels].sort(new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' }).compare));
        for (const entry of inventories) assert(labels.includes(`${entry.name} (${entry.table})`));
        const land = await page.locator('#sidebar-tree a[href="#/tables/t-sap-land-architecture"]').innerText();
        assert(land.includes('Grundstück') && !land.includes('('), 'unknown technical ID is omitted');
      }
      await page.locator('#panel-rows a[href="#/tables/t-sap-architectural-object"]').click();
      await page.waitForFunction(() => document.querySelector('#page-content h1')?.textContent === 'Architektonisches Objekt (VIBDAO)');
      await page.locator('#panel-rows').waitFor();
      assert.equal(await page.locator('#tab-rows').innerText(), 'Felder (24)');
      await page.fill('#collection-filter', 'Ebene');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 1);
      await page.fill('#collection-filter', 'Typ Raum');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 23);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}px`);
      for (const entry of inventories) {
        await visit(`#/tables/${entry.id}?tab=rows`);
        assert.equal(await page.locator('h1').innerText(), `${entry.name} (${entry.table})`);
        assert.equal(await page.locator('#panel-rows tbody tr').count(), entry.count);
        await page.fill('#collection-filter', entry.field);
        assert.equal(await page.locator('#panel-rows tbody tr').count(), 1);
        await page.locator('#panel-rows a').first().click();
        await page.waitForFunction(title => document.querySelector('h1')?.textContent === title, `${entry.label} (${entry.field})`);
        assert((await page.locator('.ob-core-facts').innerText()).includes(entry.table));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${entry.name} overflow at ${width}px`);
      }
      await visit('#/tables/t-sap-building?tab=overview');
      assert.equal(await page.locator('.ob-fact-links a').count(), 3);
      assert((await page.locator('.ob-core-facts .ob-comment').innerText()).includes('SAP-Frontend'));
      assert((await page.locator('.ob-core-facts').innerText()).includes('Definitionsquelle'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `documentation links overflow at ${width}px`);
      console.log(`PASS curated system scope and type-specific field search at ${width}px`);
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    await visit('#/tables/t-sap-architectural-object/fields/ID');
    assert.equal(await page.locator('h1').innerText(), 'ID');
    assert((await page.locator('.ob-detail-description').innerText()).includes('Typ Ebene'));
    await visit('#/tables/t-sap-architectural-object?tab=rows');
    await page.click('[data-menu="actions"]');
    const download = page.waitForEvent('download');
    await page.click('[data-export="xlsx"]');
    const workbook = await require('./excel-helpers.cjs').readWorkbook(await (await download).path());
    assert.equal(workbook.getWorksheet('Felder').rowCount, 25);
    const metadata = workbook.getWorksheet('Metadaten');
    const fieldTypes = [];
    let objectTypes;
    metadata.eachRow(row => {
      if (row.getCell(4).value === 'appliesToObjectTypes') fieldTypes.push(JSON.parse(row.getCell(5).value));
      if (row.getCell(4).value === 'objectTypes') objectTypes = JSON.parse(row.getCell(5).value);
    });
    assert.equal(fieldTypes.filter(types => types.includes('Ebene')).length, 1);
    assert.equal(fieldTypes.filter(types => types.includes('Raum')).length, 23);
    assert.deepEqual(objectTypes.map(type => type.name), ['Ebene', 'Raum']);
    for (const entry of inventories) {
      await visit(`#/tables/${entry.id}?tab=rows`);
      await page.click('[data-menu="actions"]');
      const entityDownload = page.waitForEvent('download');
      await page.click('[data-export="xlsx"]');
      const entityWorkbook = await require('./excel-helpers.cjs').readWorkbook(await (await entityDownload).path());
      const entityFields = entityWorkbook.getWorksheet('Felder');
      assert.equal(entityFields.rowCount, entry.count + 1);
      assert(entityFields.getColumn(4).values.includes(entry.field));
      assert(entityFields.getColumn(5).values.includes(entry.label));
      assert(entityWorkbook.getWorksheet('Metadaten').getColumn(4).values.includes('informationUrls'));
    }
    await visit('#/apis/api-sap-building');
    assert((await page.locator('#page-content').innerText()).includes('SOAP'));
    const coverage = await page.evaluate(() => DK.data.get('apis', 'api-sap-building').modelCoverage);
    assert.equal(coverage.candidateModelFields, 0);
    assert.equal(coverage.documentedApiFields, 66);
    await visit('#/tables/t-sap-building?tab=rows');
    assert.equal(await page.locator('h1').innerText(), 'Gebäude (VIBDBU)');
    assert.equal(await page.locator('#tab-rows').innerText(), 'Felder (66)');
    await page.fill('#collection-filter', 'CONSTRUCTION_YEAR');
    assert((await page.locator('#panel-rows').innerText()).includes('Baujahr (CONSTRUCTION_YEAR)'));
    await page.fill('#collection-filter', 'EGID');
    assert.equal(await page.locator('#panel-rows tbody tr').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS object-type detail, complete typed workbook, API profile and no browser errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
