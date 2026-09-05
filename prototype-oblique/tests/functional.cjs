/* Behavioral regression tests. Setup: tests/README.md. No fixture files are changed. */
const assert = require('node:assert/strict');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [], failures = [];
    page.on('pageerror', e => errors.push(e.message));
    const check = async (name, run) => {
      try { await run(); console.log('PASS: ' + name); }
      catch (err) { failures.push(name + ': ' + err.message); console.error('FAIL: ' + name + ': ' + err.stack); }
      finally { await page.setViewportSize({ width: 1440, height: 900 }); }
    };
    const visit = async hash => {
      await page.goto(base);
      await page.waitForSelector('#page-content');
      await page.goto(base + hash);
      await page.waitForSelector('#page-content');
      await settle(page);
    };

    await check('home search supports suggestions, submit and the header shortcut at desktop and phone widths', async () => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/');
        const input = page.locator('#search-input');
        assert.equal(await input.count(), 1);
        assert.equal(await page.locator('#header-search-field').count(), 0);
        assert(await input.isVisible());
        const hero = await page.locator('.ob-home-search').boundingBox(), tiles = await page.locator('.ob-kpi-grid').boundingBox();
        assert(hero.y + hero.height <= tiles.y, 'hero must precede the summary tiles');
        await input.fill('   ');
        assert(await page.locator('#search-submit').isDisabled());
        await input.fill('Gebäude');
        assert.equal(await input.getAttribute('aria-expanded'), 'true');
        await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
        assert(page.url().endsWith('#/'), 'IME confirmation must not submit');
        await input.press('ArrowDown');
        const option = page.locator('#' + await input.getAttribute('aria-activedescendant'));
        const target = await option.getAttribute('data-href');
        await input.press('Enter');
        await page.waitForURL(url => url.hash === target);
        await settle(page);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'page-content');

        await page.click('#brand-link'); await settle(page);
        await input.fill(' SAP ');
        await page.click('#search-submit');
        await page.waitForURL(url => url.hash === '#/search?q=SAP');
        await page.locator('.ob-search-groups').waitFor();
        assert(await page.locator('.ob-search-groups').isVisible());
        await page.click('#brand-link'); await settle(page);
        await page.click('#search-clear');
        assert.equal(await input.inputValue(), '');
        assert(await page.locator('#search-submit').isDisabled());
        await input.fill('no-such-catalog-entry');
        await input.press('Enter');
        await page.waitForURL(url => url.hash.includes('q=no-such-catalog-entry'));
        await page.locator('.ob-empty').waitFor();
        assert(await page.locator('.ob-empty').isVisible());

        await page.click('#brand-link'); await settle(page);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.click('[data-action="toggle-search"]');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-input');
        const bounds = await input.boundingBox(), header = await page.locator('#header').boundingBox();
        assert(bounds.y >= header.height, 'header shortcut must reveal the hero input');
        await input.press('Escape');
        assert.equal(await input.getAttribute('aria-expanded'), 'false');
        await input.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-input');
        assert.equal(await input.count(), 1);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await visit('#/manual');
      assert.equal(await page.locator('#home-search').count(), 0);
      await page.click('[data-action="toggle-search"]');
      await page.fill('#search-input', 'Energie');
      await page.press('#search-input', 'Enter');
      await page.waitForURL(url => url.hash === '#/search?q=Energie');
    });

    await check('domain tab, records, relations and CSV agree with the tree', async () => {
      await visit('#/domains/bau');
      assert.match(await page.locator('#tab-rows').innerText(), /\(9\)/);
      await page.click('#tab-rows');
      assert.equal(await page.locator('#panel-rows tbody tr').count(), 9);
      await page.click('[data-menu="actions"]');
      const downloaded = page.waitForEvent('download');
      await page.click('[data-export="csv"]');
      const csv = require('node:fs').readFileSync(await (await downloaded).path(), 'utf8');
      assert.equal(csv.trim().split('\r\n').length, 10);
      assert.match(csv, /Areal/);
      await page.click('#tab-relations');
      await page.click('[data-action="toggle-relation-view"]');
      assert.ok(await page.locator('.ob-relations-list a').count() > 0);
    });

    await check('open metadata survives search, export menu and sidebar changes', async () => {
      await visit('#/objects/areal');
      await page.click('.ob-metadata summary');
      for (const selector of ['[data-action="toggle-search"]', '[data-menu="actions"]', '[data-action="toggle-sidebar"]']) {
        await page.click(selector);
        assert.equal(await page.locator('.ob-metadata').evaluate(el => el.open), true, selector);
      }
      await visit('#/objects/gebaeude');
      assert.equal(await page.locator('.ob-metadata').evaluate(el => el.open), false);
    });

    await check('sorting a later desktop group keeps focus in that group', async () => {
      await visit('#/objects?view=table&group=domain');
      const button = page.locator('.ob-group .ob-table-sort').filter({ hasText: 'Bezeichnung' });
      const target = (await button.count()) > 1 ? button.nth(1) : page.locator('.ob-group').nth(1).locator('.ob-table-sort').first();
      await target.focus();
      await page.keyboard.press('Enter');
      assert.equal(await target.evaluate(el => el === document.activeElement), true);
    });

    await check('menus support keyboard entry, arrow navigation, Home/End, typeahead and Escape', async () => {
      await visit('#/objects');
      await page.focus('#language-host [data-menu="language"]');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.lang), 'de');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.lang), 'fr');
      await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.lang), 'en');
      await page.keyboard.press('Home');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.lang), 'de');
      await page.keyboard.press('f');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.lang), 'fr');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.menu), 'language');
      assert.equal(await page.locator('#language-host [role="menu"]').count(), 0);
      await page.focus('[data-menu="group"]');
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(() => document.activeElement === [...document.querySelectorAll('.ob-collection-group [role="menuitem"]')].at(-1)), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.ob-collection-group [role="menu"]').count(), 0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.click('.ob-navigation-toggle');
      await settle(page);
      await page.focus('#drawer-language-host [data-menu="language"]');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'help-toggle', await page.evaluate(() => document.activeElement.outerHTML.slice(0, 700)));
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 1440, height: 900 });
    });

    await check('Swagger keeps its mounted node, filter and expansion across chrome and viewport changes', async () => {
      await visit('#/api');
      await page.waitForSelector('#swagger-ui .opblock');
      await page.fill('#swagger-ui .operation-filter-input', 'Geschäftsobjekte');
      await page.locator('#swagger-ui .opblock-summary').first().click();
      await page.evaluate(() => { window.reviewSwaggerHost = document.getElementById('swagger-ui'); });
      await page.click('[data-action="toggle-search"]');
      await settle(page);
      assert.equal(await page.evaluate(() => window.reviewSwaggerHost === document.getElementById('swagger-ui')), true);
      assert.equal(await page.inputValue('#swagger-ui .operation-filter-input'), 'Geschäftsobjekte');
      assert.ok(await page.locator('#swagger-ui .opblock.is-open').count() > 0);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.click('.ob-navigation-toggle');
      await page.keyboard.press('Escape');
      assert.equal(await page.inputValue('#swagger-ui .operation-filter-input'), 'Geschäftsobjekte');
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => DK.router.navigate('#/'));
      await page.waitForSelector('.ob-kpi');
      await page.evaluate(() => DK.router.navigate('#/api'));
      await page.waitForSelector('#swagger-ui .opblock');
      assert.equal(await page.inputValue('#swagger-ui .operation-filter-input'), '');
    });

    await check('invalid route parameters cannot crash navigation', async () => {
      for (const nav of ['__proto__', 'constructor', 'toString', 'invalid']) {
        await visit('#/objects?nav=' + nav);
        assert.ok(await page.locator('.ob-tile').count() > 0);
      }
      await visit('#/objects/areal/typo');
      assert.equal(await page.locator('.ob-empty').count(), 1);
    });

    await check('leaving during a slow Swagger load never mounts on the wrong page or duplicates a mount', async () => {
      const slow = await browser.newPage();
      let release, requested;
      const gate = new Promise(resolve => { release = resolve; });
      const started = new Promise(resolve => { requested = resolve; });
      await slow.route('**/swagger-ui-bundle.js', async r => { requested(); await gate; await r.continue(); });
      try {
        await slow.goto(base + '#/api', { waitUntil: 'domcontentloaded' });
        await started;
        await slow.evaluate(() => { DK.app.render(); DK.app.render(); DK.router.navigate('#/'); });
        await slow.waitForSelector('.ob-kpi');
        release();
        await slow.waitForFunction(() => typeof SwaggerUIBundle === 'function');
        assert.equal(await slow.locator('#swagger-ui').count(), 0);
        await slow.evaluate(() => {
          window.reviewMounts = 0;
          window.SwaggerUIBundle = new Proxy(window.SwaggerUIBundle, { apply(target, self, args) { window.reviewMounts++; return Reflect.apply(target, self, args); } });
          DK.router.navigate('#/api');
        });
        await slow.waitForSelector('#swagger-ui .opblock');
        await slow.evaluate(() => { DK.app.render(); DK.app.render(); });
        assert.equal(await slow.evaluate(() => window.reviewMounts), 1);
      } finally { release(); await slow.close(); }
    });

    await check('a failed Swagger bundle load can be retried', async () => {
      const retry = await browser.newPage();
      let requests = 0;
      await retry.route('**/swagger-ui-bundle.js', r => ++requests === 1 ? r.fulfill({ status: 503, body: '' }) : r.continue());
      try {
        await retry.goto(base + '#/api');
        await retry.waitForSelector('#swagger-ui .ob-empty');
        await retry.click('[data-action="toggle-search"]');
        await retry.waitForSelector('#swagger-ui .opblock');
        assert.equal(requests, 2);
      } finally { await retry.close(); }
    });

    await check('data load errors explain the failure instead of displaying translation keys', async () => {
      const failed = await browser.newPage();
      await failed.route('**/data/objects.json', r => r.fulfill({ status: 503, body: 'Unavailable' }));
      await failed.goto(base);
      await failed.waitForSelector('.ob-empty');
      const message = await failed.locator('.ob-empty').innerText();
      assert.match(message, /objects\.json.*503/);
      assert.ok(!message.includes('loadError'));
      await failed.unroute('**/data/objects.json');
      await failed.route('**/data/objects.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{broken' }));
      await failed.reload();
      await failed.waitForSelector('.ob-empty');
      assert.match(await failed.locator('.ob-empty').innerText(), /objects\.json: invalid JSON/);
      await failed.close();
    });

    assert.deepEqual(errors, [], 'unexpected browser exceptions');
    assert.deepEqual(failures, [], 'functional regressions');
    console.log('PASS: all functional regression checks.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(err => { console.error(err); server.close(); process.exitCode = 1; });
