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
    await visit('#/objects?filter=NoMatchingEntryForExcel');
    await page.click('[data-menu="actions"]');
    assert.equal(await page.locator('[data-export="xlsx"]').innerText(), 'Excel: Aktuelle Auswahl');
    assert.equal(await page.locator('[data-export="xlsx-all"]').innerText(), 'Excel: Gesamter Katalog');
    assert.ok(await page.locator('.ob-menu').evaluate(el => el.getBoundingClientRect().right <= innerWidth));
    let downloaded = page.waitForEvent('download'); await page.click('[data-export="xlsx"]');
    const selectedWorkbook = await require('./excel-helpers.cjs').readWorkbook(await (await downloaded).path());
    assert.equal(selectedWorkbook.getWorksheet('Geschäftsobjekte').rowCount, 1, 'Empty current selection stays empty');
    await page.waitForFunction(() => !DK.app.state.exporting);
    const expected = await page.evaluate(() => ({
      sections: DK.data.kinds.map(kind => [DK.data.kindDef(kind).plural, DK.data.list(kind).length]),
      fields: DK.data.tables.reduce((sum, e) => sum + e.fields.length, 0),
      attributes: [...DK.data.objects, ...DK.data.products].reduce((sum, e) => sum + e.attributes.length, 0),
      values: DK.data.refs.reduce((sum, e) => sum + e.values.length, 0)
    }));
    await page.evaluate(() => {
      const download = DK.excel.download; window.excelDownloads = 0;
      DK.excel.download = async plan => {
        window.excelDownloads++;
        await new Promise(resolve => { window.resumeExcel = resolve; });
        return download(plan);
      };
    });
    await page.click('[data-menu="actions"]');
    downloaded = page.waitForEvent('download'); await page.click('[data-export="xlsx-all"]');
    await page.waitForFunction(() => !!window.resumeExcel);
    await page.evaluate(() => { DK.app.state.menu = 'actions'; DK.app.render(); });
    assert(await page.locator('[data-export="xlsx"]').isDisabled());
    assert(await page.locator('[data-export="xlsx-all"]').isDisabled());
    await page.locator('[data-export="xlsx"]').dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.excelDownloads), 1, 'A pending catalog export blocks both modes');
    await page.evaluate(() => { location.hash = '#/objects/gebaeude'; window.resumeExcel(); });
    const allDownload = await downloaded;
    assert.equal(allDownload.suggestedFilename(), 'gesamter-katalog.xlsx');
    const catalogWorkbook = await require('./excel-helpers.cjs').readWorkbook(await allDownload.path());
    for (const [name, count] of expected.sections) assert.equal(catalogWorkbook.getWorksheet(name).rowCount, count + 1, name);
    for (const [name, count] of [['Felder', expected.fields], ['Attribute', expected.attributes], ['Werte', expected.values]]) {
      assert.equal(catalogWorkbook.getWorksheet(name).rowCount, count + 1, name);
    }
    await page.waitForFunction(() => !DK.app.state.exporting);
    console.log('PASS: both Excel scopes on mobile, complete SQL catalog workbook, duplicate-export guard and navigation during export.');
    assert.deepEqual(errors, []);
    assert.deepEqual(catalogJsonRequests, [], 'Supabase mode never fetches the legacy catalog files');
    await Promise.all(liveChecks);
    page.removeAllListeners('response');
    await page.route('https://zicluerzbevodlmtbxow.supabase.co/rest/v1/rpc/read_snapshot', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
    await page.reload();
    await page.getByText('Datenkatalog konnte nicht geladen werden', { exact: true }).waitFor();
    assert.equal(await page.locator('#page-content').count(), 0, 'No silent fallback to stale JSON data');
    console.log('Supabase browser checks passed: navigation, field search, responsibility, bubbles, global search, mobile, Excel scopes and failed-load handling.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
