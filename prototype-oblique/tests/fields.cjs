/* Field profiles use the same shell and controls as business-object attributes. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const base = `http://127.0.0.1:${server.address().port}/`;
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const visit = async hash => {
      await page.goto(base); await page.locator('#page-content h1').waitFor();
      await page.goto(base + hash); await settle(page);
      await page.evaluate(() => document.fonts.ready);
    };
    const link = '#/tables/t-gwr-gebaeude/fields/EGID';
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await visit('#/tables/t-gwr-gebaeude');
      await page.click('#tab-rows');
      const anchor = page.locator(`#panel-rows a[href="${link}"]`);
      await anchor.focus(); await anchor.press('Enter'); await settle(page);
      assert(page.url().includes(link));
      assert.equal(await page.locator('h1').innerText(), 'Eidgenössischer Gebäudeidentifikator (EGID)');
      assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#tab-rows').count(), 0);
      assert.equal(await page.locator('.ob-field-documentation details[open]').count(), 1);
      assert((await page.locator('.ob-field-documentation').innerText()).includes('Der EGID ist eine gesamtschweizerisch eindeutige Identifikationsnummer'));
      assert((await page.locator('.ob-core-facts').innerText()).includes('Gültig'));
      assert.equal(await page.locator('.ob-core-facts a[href="https://www.housing-stat.ch/catalog/de/5.0/revised#EGID"]').count(), 1);
      const responsibility = page.locator('.ob-responsibility');
      assert((await responsibility.innerText()).includes('Bundesamt für Statistik (BFS)'));
      assert.deepEqual(await responsibility.locator('dt').allTextContents(), ['Organisation', 'E-Mail', 'Telefon']);
      assert.equal(await responsibility.getByRole('link', {name: 'Bundesamt für Statistik (BFS)'}).getAttribute('href'), 'https://www.housing-stat.ch/de/home.html');
      assert.equal(await responsibility.getByRole('link', {name: 'housing-stat@bfs.admin.ch'}).getAttribute('href'), 'mailto:housing-stat@bfs.admin.ch');
      assert.equal(await responsibility.getByRole('link', {name: '0800 866 600'}).getAttribute('href'), 'tel:0800866600');
      assert(!(await page.locator('.ob-core-facts').innerText()).includes('Bundesamt für Statistik (BFS)'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const sourceDetails = page.locator('.ob-field-documentation details').filter({has: page.locator('summary', {hasText: /^Technische Spezifikationen$/})});
      await sourceDetails.locator('summary').click();
      assert((await sourceDetails.innerText()).includes("1-900'000'000"));
      await page.click('[data-menu="actions"]');
      assert.equal(await sourceDetails.getAttribute('open'), '');
      assert.equal(await page.locator('.ob-core-facts > .ob-metadata').getAttribute('open'), null);
      await page.keyboard.press('Escape');
      if (width > 960) assert.equal(await page.locator('#sidebar-tree a[aria-current="page"]').getAttribute('href'), '#/tables/t-gwr-gebaeude');
      const parent = page.locator('.ob-breadcrumb a[href="#/tables/t-gwr-gebaeude?tab=rows"]');
      await parent.click(); await settle(page);
      assert.equal(await page.locator('#tab-rows').getAttribute('aria-selected'), 'true');
      await page.goBack(); await settle(page);
      assert(page.url().includes(link));
      await page.reload(); await page.locator('.ob-field-documentation').waitFor();
      assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'), 'true');
      console.log(`PASS: field navigation, source text, breadcrumbs, reload and layout at ${width}px`);
    }
    await page.setViewportSize({width: 1600, height: 1100});
    await visit('#/tables/t-gwr-gebaeude/fields/GKAT');
    await page.click('.ob-core-facts a[href="#/refs/r-gwr-kat"]'); await settle(page);
    assert(page.url().includes('#/refs/r-gwr-kat'));
    await page.goBack(); await settle(page);
    await page.click('#tab-relations');
    assert(await page.locator('.ob-relations-diagram').isVisible());
    await page.click('[data-action="toggle-relation-view"]');
    assert.equal(await page.locator('.ob-relations-list tbody tr').count(), 4);
    assert.equal(await page.locator('.ob-relations-list a[href="#/refs/r-gwr-kat"]').count(), 1);
    await page.click('#tab-history');
    assert.match(await page.locator('#tab-history').innerText(), /Verlauf Datentabelle/);
    assert((await page.locator('#panel-history .ob-context-note').innerText()).includes('Datentabelle'));
    assert.equal(await page.locator('#panel-history tbody tr').count(), 1);
    await page.click('#tab-overview');
    await page.click('[data-menu="actions"]');
    assert.equal(await page.locator('.ob-actions-menu [data-export="profile-pdf"]').count(), 1);
    assert.equal(await page.locator('.ob-actions-menu [data-export="csv"]').count(), 0);
    assert.equal(await page.locator('.ob-actions-menu [data-export="xlsx"]').count(), 1);
    await page.keyboard.press('Escape');
    await visit(link);
    await page.screenshot({path: path.join(process.env.TEMP || '/tmp', 'oblique-field-desktop.png')});

    await visit(link + '?nav=container');
    assert.equal(await page.evaluate(() => DK.app.state.treeSection), 'systems');
    assert.equal(await page.locator('#sidebar-tree a[aria-current="page"]').getAttribute('href'), '#/tables/t-gwr-gebaeude?nav=container');
    await visit('#/tables/t-geb-sap/fields/EGID');
    assert.equal(await page.locator('h1').innerText(), 'EGID');
    assert((await page.locator('.ob-core-facts').innerText()).includes('Entwurf'));
    assert((await page.locator('.ob-core-facts').innerText()).includes('Primärschlüssel (PK)'));
    assert.equal(await page.locator('.ob-field-documentation').count(), 0);
    assert.equal(await page.locator('.ob-responsibility a[title*="im Admindir öffnen"]').count(), 2);
    assert.equal(await page.locator('.ob-responsibility dd').filter({hasText: /^Portfoliomanagement$/}).locator('a').count(), 0, 'organisation custodians do not link to the person directory');

    for (const hash of ['#/tables/missing/fields/EGID', '#/tables/t-gwr-gebaeude/fields/missing', '#/tables/t-gwr-gebaeude/fields/EGID/extra']) {
      await visit(hash);
      assert.equal(await page.locator('.ob-entity-header').count(), 0);
      assert(await page.locator('.ob-empty').isVisible());
    }
    await page.setViewportSize({width: 390, height: 844});
    await visit(link);
    await page.screenshot({path: path.join(process.env.TEMP || '/tmp', 'oblique-field-phone.png')});
    await page.click('[data-action="open-navigation"]');
    assert.equal(await page.locator('#sidebar-tree a[aria-current="page"]').getAttribute('href'), '#/tables/t-gwr-gebaeude');
    await page.click('#sidebar-tree a[aria-current="page"]'); await settle(page);
    assert.equal(await page.locator('.ob-tree-panel.is-mobile-open').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: code-list links, diagram/table, inherited history, export, both tree models, ordinary fields and invalid links');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
