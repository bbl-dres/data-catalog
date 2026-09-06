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

    await check('handbook legacy links resolve to English chapters and keep desktop/mobile navigation', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/manual?ch=modell');
        assert.equal(await page.evaluate(() => DK.router.parse().params.ch), 'model');
        assert.equal(await page.locator('.ob-chapter').count(), 8);
        assert.equal(await page.evaluate(() => DK.app.state.chapter), 'model');
        const chapter = page.locator('#manual-model');
        assert(Math.abs(await chapter.evaluate(el => el.getBoundingClientRect().top - parseFloat(getComputedStyle(el).scrollMarginTop))) <= 1);
        await page.reload(); await page.locator('#manual-model').waitFor(); await settle(page);
        assert.equal(await page.evaluate(() => DK.router.parse().params.ch), 'model');
        if (width < 961) await page.click('[data-action="open-navigation"]');
        await page.locator('[data-action="chapter"][data-chapter="glossary"]').click(); await settle(page);
        assert.equal(await page.evaluate(() => DK.router.parse().params.ch), 'glossary');
        assert.equal(await page.evaluate(() => DK.app.state.chapter), 'glossary');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    });

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
        await page.locator('#search-page .ob-table-region').waitFor();
        assert(await page.locator('#search-page .ob-table-region').isVisible());
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

    await check('results reuse the hero input, restore URL queries and align answers with tables', async () => {
      for (const width of [1440, 390, 320, 2560]) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/');
        const hero = await page.locator('#search-input').evaluate(el => ({ height: el.getBoundingClientRect().height, font: getComputedStyle(el).fontSize }));
        await visit('#/search?q=Geb%C3%A4ude&types=tables&domains=bau');
        const input = page.locator('#search-input');
        assert.equal(await input.count(), 1);
        assert.equal(await page.locator('#header-search-field').count(), 0);
        assert(await page.locator('#results-search').isVisible());
        assert.equal(await input.inputValue(), 'Gebäude');
        assert.deepEqual(await input.evaluate(el => ({ height: el.getBoundingClientRect().height, font: getComputedStyle(el).fontSize })), hero);
        const answer = await page.locator('.ob-search-answer').boundingBox();
        const table = await page.locator('#search-results-panel .ob-table-region').first().boundingBox();
        assert(Math.abs(answer.x - table.x) < 1 && Math.abs(answer.width - table.width) < 1, 'answer and result tables share both edges');
        const originalUrl = page.url();
        const originalResults = await page.locator('#search-page').innerText();
        await input.fill('GWR'); await input.press('Escape');
        assert.equal(page.url(), originalUrl, 'typing leaves the submitted query in the URL until search');
        assert.equal(await page.locator('#search-page').innerText(), originalResults, 'typing keeps the submitted results until search');
        await page.click('#search-submit'); await page.waitForURL(url => url.hash.includes('q=GWR'));
        assert(page.url().includes('types=tables') && page.url().includes('domains=bau'));
        await page.goBack(); await settle(page); assert.equal(await input.inputValue(), 'Gebäude');
        await page.goForward(); await settle(page); assert.equal(await input.inputValue(), 'GWR');
        await page.reload(); await page.locator('#results-search').waitFor(); assert.equal(await input.inputValue(), 'GWR');
        const submittedUrl = page.url();
        await page.click('#search-clear');
        assert.equal(page.url(), submittedUrl, 'clearing the input stays on results');
        assert.equal(await input.inputValue(), '');
        assert(await page.locator('#search-submit').isDisabled());
        assert(await page.locator('.ob-suggest-example').count() > 0);
        await page.locator('.ob-suggest-example[data-query="Gebäude"]').click();
        await page.waitForURL(url => url.hash.includes('q=Geb'));
        assert.equal(await input.inputValue(), 'Gebäude');
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.click('[data-action="toggle-search"]');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-input');
        assert.equal(await page.locator('#search-input').count(), 1);
        const field = await input.boundingBox(), header = await page.locator('#header').boundingBox();
        assert(field.y >= header.height, 'header shortcut reveals the results form');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
    });

    await check('one search table ranks all types, paginates globally and preserves URL state on desktop and mobile', async () => {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/search?q=GWR&nav=container');
        const rows = page.locator('#search-page tbody tr');
        const ids = () => rows.evaluateAll(els => els.map(el => el.dataset.href));
        const params = () => page.evaluate(() => ({ ...DK.router.parse().params }));
        const next = page.locator('[data-focus="page-next"]');
        assert.equal(await page.locator('#search-page table').count(), 1);
        assert.equal(await page.locator('#search-page [data-action="set-page-size"]').count(), 1);
        assert.equal(await page.locator('.ob-search-result-controls [data-action="set-page"]').count(), 0);
        assert.equal(await page.locator('.ob-search-result-controls .ob-pager-range').count(), 1);
        assert.equal(await page.locator('#search-page .ob-pager .ob-pager-range').count(), 0);
        assert.equal(await page.locator('#search-sort').inputValue(), 'relevance');
        assert.equal(await rows.count(), 20);
        const expected = await page.evaluate(() => {
          const options = DK.search.options(DK.router.parse().params);
          return DK.search.page(DK.search.results('GWR', options), 'GWR', { size: 100 }).items.map(x => DK.router.entityHref(x.kind, x.e.identifier, { nav: 'container' }));
        });
        assert(expected.length > 40, 'real GWR data spans several pages and types');
        const answer = await page.locator('.ob-search-answer').innerText();
        const seen = await ids();
        await next.focus(); await page.keyboard.press('Enter'); await settle(page);
        assert.equal((await params()).page, '2');
        assert.equal((await params()).nav, 'container');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-page');
        assert.equal(await page.locator('.ob-search-answer').innerText(), answer, 'answer uses the whole matching set, not only the page');
        assert.equal(await page.locator('.ob-search-result-controls .ob-pager-range').innerText(), `21–40 von ${expected.length} Einträgen`);
        assert.equal((await ids()).join(','), expected.slice(20, 40).join(','));
        await page.goBack(); await settle(page);
        assert.equal((await params()).page, undefined);
        assert.equal((await ids()).join(','), seen.join(','));
        await page.goForward(); await settle(page);
        assert.equal((await params()).page, '2');
        await page.reload(); await page.locator('#search-page').waitFor();
        assert.equal((await ids()).join(','), expected.slice(20, 40).join(','));
        seen.push(...await ids());
        while (!await next.isDisabled()) {
          await next.click(); await settle(page); seen.push(...await ids());
        }
        assert.equal(seen.join(','), expected.join(','), 'every result appears exactly once across pages');
        assert.equal(new Set(seen).size, seen.length);
        assert.equal(await page.locator('#search-page .ob-pager-range').first().innerText(), `${Math.floor((expected.length - 1) / 20) * 20 + 1}–${expected.length} von ${expected.length} Einträgen`);
        await page.selectOption('#search-sort', 'name'); await settle(page);
        assert.equal((await params()).page, undefined);
        assert.equal((await params()).sort, 'name');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-sort');
        await next.click(); await settle(page);
        await page.selectOption('[data-action="set-page-size"]', '50'); await settle(page);
        assert.equal((await params()).page, undefined);
        assert.equal((await params()).size, '50');
        assert.equal(await rows.count(), Math.min(50, expected.length));
        await page.selectOption('[data-action="set-page-size"]', '20'); await settle(page);
        await next.click(); await settle(page);
        await page.click('#search-options-toggle');
        await page.locator('#search-ai').uncheck();
        assert.equal((await params()).page, '2', 'AI visibility does not change the result page');
        await page.click('[data-action="search-types-none"]');
        assert.equal(await page.locator('#search-page').count(), 0);
        await page.locator('#search-type-refs').check();
        assert.equal((await params()).page, undefined);
        assert.equal((await params()).sort, 'name');
        assert.equal((await params()).types, 'refs');
        assert.equal(await page.locator('#search-page table').count(), 1);
        const typeLabels = await page.locator('#search-page tbody td:nth-child(2)').allTextContents();
        assert(typeLabels.length > 0 && typeLabels.every(type => type.trim() === 'Werteliste'));
        await page.selectOption('#search-sort', 'modified');
        assert.equal((await params()).sort, 'modified');
        await page.reload(); await page.locator('#search-page').waitFor();
        assert.equal(await page.locator('#search-sort').inputValue(), 'modified');
        await page.fill('#search-input', 'no-matching-catalog-record');
        await page.click('#search-submit'); await settle(page);
        assert.equal(await page.locator('#search-page').count(), 0);
        assert.equal(await page.locator('.ob-pager').count(), 0);
        assert.equal((await params()).sort, 'modified');
        assert.equal((await params()).page, undefined);
        await visit('#/search?q=GWR&page=999&size=15&sort=unknown');
        assert.equal((await params()).page, String(Math.ceil(expected.length / 20)));
        assert.equal((await params()).size, undefined);
        assert.equal((await params()).sort, undefined);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
    });

    await check('empty search teaches with examples and supports keyboard, dismissal and scoped searches', async () => {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/');
        const input = page.locator('#search-input');
        assert.equal(await page.locator('#search-suggest').count(), 0, 'no examples before focus');
        await input.focus();
        assert.equal(await input.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('.ob-suggest-example').count(), 4);
        assert(await page.locator('#search-submit').isDisabled());
        await input.press('Enter'); assert(page.url().endsWith('#/'), 'an empty Enter does not pick an example');
        for (let i = 0; i < 6; i++) await input.press('ArrowDown');
        assert.equal(await input.getAttribute('aria-activedescendant'), 'suggest-3');
        await input.press('Escape');
        assert.equal(await input.getAttribute('aria-expanded'), 'false');
        assert.equal(await input.getAttribute('aria-activedescendant'), null);
        await input.press('ArrowDown');
        assert.equal(await input.getAttribute('aria-activedescendant'), 'suggest-0');
        await input.press('ArrowUp'); assert.equal(await input.getAttribute('aria-activedescendant'), null);
        await input.press('ArrowDown'); await input.press('Enter');
        await page.waitForURL(url => url.hash.includes('/search?'));
        assert.equal(await page.evaluate(() => DK.router.parse(location.hash).params.q), 'Was ist GWR?');
        assert.equal(await page.locator('.ob-search-answer-sources a').first().getAttribute('href'), '#/systems/gwr');
        await visit('#/');
        await input.fill('Gebäude'); assert.equal(await page.locator('.ob-suggest-example').count(), 0);
        await page.click('#search-clear'); assert.equal(await page.locator('.ob-suggest-example').count(), 4);
        await input.press('Tab'); assert.equal(await input.getAttribute('aria-expanded'), 'false');
        await input.click(); assert.equal(await page.locator('.ob-suggest-example').count(), 4);
        await page.click('#home-search-title'); assert.equal(await input.getAttribute('aria-expanded'), 'false');
        await visit('#/?domains=energie&types=products&ai=0');
        await input.focus();
        assert.equal(await page.locator('.ob-suggest-example').count(), 2);
        await page.locator('.ob-suggest-example[data-query="Energieverbrauch"]').click();
        await page.waitForURL(url => url.hash.includes('/search?'));
        assert.equal(await page.evaluate(() => DK.router.parse(location.hash).params.q), 'Energieverbrauch');
        assert(page.url().includes('domains=energie') && page.url().includes('types=products') && page.url().includes('ai=0'));
        await page.locator('#search-results-panel tbody tr').first().waitFor();
        assert.equal(await page.locator('.ob-search-answer').count(), 0);
        assert.equal(await page.locator('#search-results-panel tbody tr').count(), 1);
        await visit('#/objects'); await page.click('[data-action="toggle-search"]');
        assert.equal(await page.locator('.ob-suggest-example').count(), 4, 'compact header uses the same examples');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await input.press('Escape'); assert.equal(await page.locator('#search-suggest').count(), 0);
      }
    });

    await check('example dropdown survives a tap and scrolls on a short touch viewport', async () => {
      const touch = await browser.newPage({ viewport: { width: 390, height: 280 }, hasTouch: true, isMobile: true });
      touch.on('pageerror', e => errors.push(e.message));
      try {
        await touch.goto(base + '#/'); await touch.locator('#search-input').waitFor();
        await touch.locator('#search-input').tap(); await settle(touch);
        assert.equal(await touch.locator('#search-input').getAttribute('aria-expanded'), 'true');
        assert.equal(await touch.locator('.ob-suggest-example').count(), 4);
        const box = await touch.locator('#search-suggest').boundingBox();
        assert(box.height >= 44 && box.y + box.height <= 280);
        await touch.locator('.ob-suggest-example').last().scrollIntoViewIfNeeded();
        assert(await touch.locator('#search-suggest').evaluate(el => el.scrollTop > 0));
        await touch.locator('.ob-suggest-example').last().tap();
        await touch.waitForURL(url => url.hash.includes('/search?'));
        assert.equal(await touch.evaluate(() => DK.router.parse(location.hash).params.q), 'Bauprojekt');
      } finally { await touch.close(); }
    });

    await check('search scope, mock answers and URLs agree on desktop and mobile', async () => {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/');
        const input = page.locator('#search-input');
        await input.fill('Was ist ein Gebäude?'); await input.press('Escape');
        await page.click('#search-options-toggle');
        await page.evaluate(() => { window.originalSearchInput = document.getElementById('search-input'); });
        await page.click('[data-action="search-types-none"]');
        assert(await page.locator('#search-submit').isDisabled());
        assert.equal(await page.locator('[data-search-kind]:checked').count(), 0);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-type-objects');
        assert(await page.locator('#search-ai').isChecked());
        await page.locator('#search-type-tables').focus(); await page.keyboard.press('Space');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-type-tables');
        assert.equal(await page.evaluate(() => originalSearchInput === document.getElementById('search-input')), true);
        assert.equal(await input.inputValue(), 'Was ist ein Gebäude?');
        assert.equal(await page.locator('#search-options-toggle').getAttribute('aria-expanded'), 'true');
        await input.focus(); await input.press('ArrowDown');
        assert.match(await page.locator('#' + await input.getAttribute('aria-activedescendant')).getAttribute('data-href'), /^#\/tables\//);
        await input.press('Escape'); await page.click('#search-submit');
        await page.waitForURL(url => url.hash.includes('/search?'));
        assert(page.url().includes('types=tables'));
        await page.locator('#search-page table').waitFor();
        assert.equal(await page.locator('#search-page table').count(), 1);
        const types = await page.locator('#search-page tbody td:nth-child(2)').allTextContents();
        assert(types.length > 0 && types.every(type => type.trim() === 'Datentabelle'));
        const sources = await page.locator('.ob-search-answer-sources a').evaluateAll(els => els.map(el => el.getAttribute('href')));
        assert(sources.length > 0 && sources.every(href => href.startsWith('#/tables/')));
        const resultUrl = page.url();
        await page.locator('.ob-search-answer-sources a').first().click(); await page.locator('.ob-entity-header').waitFor();
        await page.goBack(); await settle(page); assert.equal(page.url(), resultUrl);
        await page.click('#search-options-toggle'); await page.locator('#search-ai').uncheck();
        assert.equal(await page.locator('.ob-search-answer').count(), 0);
        assert(page.url().includes('ai=0'));
        await page.reload(); await page.locator('#search-options-toggle').waitFor();
        assert.equal(await page.locator('.ob-search-answer').count(), 0);
        await page.click('#search-options-toggle');
        assert.equal(await page.locator('[data-search-kind]:checked').count(), 1);
        assert(await page.locator('#search-type-tables').isChecked());
        await page.click('[data-action="search-types-all"]');
        assert.equal(await page.locator('[data-search-kind]:checked').count(), 7);
        assert.equal(await page.locator('.ob-search-answer').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await visit('#/search?q=Gebäude&types=none');
      assert.equal(await page.locator('.ob-search-answer').count(), 0);
      assert.equal(await page.locator('#search-page .ob-table-region').count(), 0);
      await page.locator('#search-results-panel [data-action="search-types-all"]').click();
      assert(await page.locator('#search-page .ob-table-region').isVisible());
      await page.click('[data-action="hide-search-ai"]');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'search-options-toggle');
    });

    await check('domain choices appear first and intersect types on desktop and mobile', async () => {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/');
        const input = page.locator('#search-input');
        await input.fill('Energie'); await input.press('Escape');
        await page.click('#search-options-toggle');
        assert.match(await page.locator('#search-options-panel legend').first().innerText(), /Domänen/);
        await page.click('[data-action="search-domains-none"]');
        assert(await page.locator('#search-submit').isDisabled());
        assert.equal(await page.locator('[data-search-kind]:checked').count(), 7);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-domain-bau');
        await page.locator('#search-domain-energie').focus(); await page.keyboard.press('Space');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'search-domain-energie');
        await page.click('[data-action="search-types-none"]');
        await page.locator('#search-type-products').check();
        assert.equal(await input.inputValue(), 'Energie');
        await input.focus(); await input.press('ArrowDown');
        assert.equal(await page.locator('#' + await input.getAttribute('aria-activedescendant')).getAttribute('data-href'), '#/products/p-energie');
        await input.press('Escape'); await page.click('#search-submit');
        await page.waitForURL(url => url.hash.includes('/search?'));
        assert(page.url().includes('domains=energie') && page.url().includes('types=products'));
        await page.locator('#search-results-panel tbody tr').waitFor();
        assert.equal(await page.locator('#search-results-panel tbody tr').count(), 1);
        assert.equal(await page.locator('.ob-search-answer-sources a').first().getAttribute('href'), '#/products/p-energie');
        await page.reload(); await page.locator('#search-options-toggle').waitFor();
        await page.click('#search-options-toggle');
        assert.equal(await page.locator('[data-search-domain]:checked').count(), 1);
        assert(await page.locator('#search-domain-energie').isChecked());
        await page.locator('#search-domain-projekt').check();
        assert(page.url().includes('domains=energie%2Cprojekt'));
        assert.equal(await page.locator('[data-search-kind]:checked').count(), 1);
        await page.click('[data-action="search-domains-all"]');
        assert(!page.url().includes('domains='));
        assert.equal(await page.locator('[data-search-kind]:checked').count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await visit('#/search?q=Energie&types=products&domains=none');
      assert.equal(await page.locator('.ob-search-answer').count(), 0);
      assert.equal(await page.locator('#search-page .ob-table-region').count(), 0);
      await page.locator('#search-results-panel [data-action="search-domains-all"]').click();
      assert.equal(await page.locator('#search-results-panel tbody tr').count(), 1);
    });

    await check('collection search keeps typing stable and filters tiles, tables, grouping and exports together', async () => {
      await visit('#/objects');
      const objectCount = await page.evaluate(() => DK.data.objects.length);
      await page.locator('.ob-group-header').first().click();
      const input = page.locator('#collection-filter');
      await input.evaluate(el => { window.collectionInputNode = el; });
      await input.fill('GeBaEu');
      assert(await page.locator('.ob-tile[href="#/objects/gebaeude"]').isVisible(), 'search reveals matching collapsed groups');
      assert(await input.evaluate(el => el === window.collectionInputNode && el === document.activeElement));
      const ids = await page.locator('.ob-tile').evaluateAll(els => els.map(el => el.getAttribute('href')).sort());
      assert(ids.length > 0 && ids.length < objectCount);
      assert.equal(await page.locator('#collection-filter-status').innerText(), `${ids.length} von ${objectCount} Einträgen`);

      await input.dispatchEvent('compositionstart');
      await input.evaluate(el => { el.value = 'Stromzaehler'; });
      await input.evaluate(el => el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true })));
      assert.equal(new URLSearchParams(page.url().split('?')[1]).get('filter'), 'GeBaEu');
      await input.dispatchEvent('compositionend');
      assert.equal(await page.locator('.ob-tile').count(), 1);
      assert.equal(await page.locator('.ob-tile-name').innerText(), 'Stromzähler');
      await input.fill('GeBaEu');
      await page.click('#view-tab-table');
      const tableIds = () => page.locator('#collection-view-panel tbody tr').evaluateAll(els => els.map(el => el.dataset.href).sort());
      assert.deepEqual(await tableIds(), ids);
      await page.click('[data-menu="group"]'); await page.click('[data-group="none"]');
      assert.deepEqual(await tableIds(), ids);
      await page.locator('#collection-view-panel .ob-table-sort').first().click();
      assert.deepEqual(await tableIds(), ids);
      await page.click('[data-menu="actions"]');
      const download = page.waitForEvent('download'); await page.click('[data-export="xlsx"]');
      const workbook = await require('./excel-helpers.cjs').readWorkbook(await (await download).path());
      assert.equal(workbook.getWorksheet('Geschäftsobjekte').rowCount, ids.length + 1);
      await page.reload(); await page.waitForSelector('#collection-filter'); await settle(page);
      assert.equal(await input.inputValue(), 'GeBaEu');
      assert.deepEqual(await tableIds(), ids);
      await page.locator('#collection-view-panel .ob-table-entity-link').first().click();
      await page.waitForSelector('.ob-entity-header'); await page.goBack(); await page.waitForSelector('#collection-filter');
      assert.equal(await input.inputValue(), 'GeBaEu');
      assert.deepEqual(await tableIds(), ids);
      await page.click('[data-action="toggle-search"]'); await page.fill('#search-input', 'SAP');
      assert.deepEqual(await tableIds(), ids, 'global suggestions do not filter the collection');
      await page.press('#search-input', 'Escape'); await page.press('#search-input', 'Escape');
      await input.fill('no-such-collection-entry'); await input.press('Enter');
      assert(await page.locator('#collection-view-panel .ob-empty').isVisible());
      assert.equal(await page.locator('#collection-filter-status').innerText(), `0 von ${objectCount} Einträgen`);
      assert(page.url().includes('#/objects?'));
      await page.locator('#collection-view-panel [data-action="clear-collection-filter"]').click();
      assert.equal(await input.inputValue(), '');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'collection-filter');
      assert.equal((await tableIds()).length, objectCount);
      assert(!new URLSearchParams(page.url().split('?')[1]).has('filter'));

      await page.setViewportSize({ width: 390, height: 844 });
      await visit('#/tables?filter=VIBDBU');
      assert.equal(await page.locator('.ob-tile').count(), 1);
      await page.click('#view-tab-table');
      assert.equal(await page.locator('#collection-view-panel tbody tr').count(), 1);
      assert(await page.locator('.ob-table-region.is-cards').isVisible());
      await page.fill('#collection-filter', 'SAP');
      assert(await page.locator('#collection-view-panel tbody tr').count() > 1);
      await page.press('#collection-filter', 'Escape');
      assert.equal(await page.locator('#collection-view-panel tbody tr').count(), await page.evaluate(() => DK.data.tables.length));
    });

    await check('repeated domain branches keep their section, members, breadcrumbs and history', async () => {
      for (const kind of ['products', 'refs', 'apis']) {
        await visit('#/' + kind);
        const branch = `#sidebar-tree a[data-key="${kind}:domain:energie"]`;
        const count = Number(await page.locator(branch + ' .ob-tree-count').innerText());
        await page.click(branch); await settle(page);
        assert.equal(await page.evaluate(() => DK.router.parse().kind), kind);
        assert.equal(await page.evaluate(() => DK.router.parse().params.domain), 'energie');
        assert.equal(await page.evaluate(() => DK.app.state.treeSection), kind);
        assert.equal(await page.locator('#sidebar-tree a[aria-current="page"]').count(), 1);
        assert.equal(await page.locator(branch).getAttribute('aria-current'), 'page');
        assert.equal(await page.locator('.ob-tile').count(), count);
        assert((await page.locator('h1').innerText()).endsWith(' – Energie'));
        await page.locator('.ob-tile').first().click(); await page.waitForSelector('.ob-entity-header');
        const crumb = page.locator('.ob-breadcrumb a').filter({ hasText: /^Energie$/ });
        assert((await crumb.getAttribute('href')).startsWith('#/' + kind + '?domain=energie'));
        await crumb.click(); await page.waitForSelector('#collection-filter');
        await page.click('#view-tab-table');
        assert.equal(await page.locator('#collection-view-panel tbody tr').count(), count);
        await page.fill('#collection-filter', 'no-such-domain-entry');
        assert(await page.locator('#collection-view-panel .ob-empty').isVisible());
        await page.press('#collection-filter', 'Escape');
        assert.equal(await page.locator('#collection-view-panel tbody tr').count(), count, 'clearing search must retain the domain scope');
        await page.reload(); await page.waitForSelector('#collection-filter');
        assert.equal(await page.locator('#collection-view-panel tbody tr').count(), count);
        await page.click('[data-menu="actions"]');
        const download = page.waitForEvent('download'); await page.click('[data-export="xlsx"]');
        const workbook = await require('./excel-helpers.cjs').readWorkbook(await (await download).path());
        assert.equal(workbook.getWorksheet(await page.evaluate(k => DK.data.kindDef(k).plural, kind)).rowCount, count + 1);
        await page.locator('#sidebar-tree a[data-key="' + kind + '"]').click(); await settle(page);
        assert(!await page.evaluate(() => DK.router.parse().params.domain));
        assert.equal(await page.locator('#collection-view-panel tbody tr').count(), await page.evaluate(k => DK.data.list(k).length, kind));
        await page.goBack(); await page.waitForSelector('#collection-filter');
        assert.equal(await page.locator(branch).getAttribute('aria-current'), 'page');
      }
      await visit('#/products?nav=container');
      await page.click('#sidebar-tree a[data-key="products:domain:energie"]'); await settle(page);
      assert.equal(await page.evaluate(() => DK.data.navModel()), 'container');
      assert.equal(await page.locator('#sidebar-tree a[aria-current="page"]').count(), 1);
      await page.click('[data-action="toggle-sidebar"]');
      await page.click('[data-action="rail-section"][data-key="products"]');
      await page.click('#sidebar-flyout a[data-key="products:domain:energie"]'); await settle(page);
      assert.equal(await page.locator('#sidebar-flyout').count(), 0);
      assert.equal(await page.evaluate(() => DK.app.state.treeSection), 'products');
      assert.equal(await page.locator('.ob-tile').count(), 1);
      await page.click('[data-action="toggle-sidebar"]');
      await visit('#/objects');
      assert.equal(await page.locator('#sidebar-tree a[data-key="objects:domain:energie"]').getAttribute('href'), '#/domains/energie');
      await visit('#/products?domain=does-not-exist');
      assert.equal(await page.locator('#collection-view-panel').count(), 0);
      await visit('#/products');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.click('[data-action="open-navigation"]');
      await page.click('#sidebar-tree a[data-key="products:domain:energie"]'); await settle(page);
      assert.equal(await page.locator('.ob-tree-panel.is-mobile-open').count(), 0);
      assert.equal(await page.locator('.ob-tile').count(), 1);
      await page.click('[data-action="open-navigation"]');
      assert.equal(await page.locator('#sidebar-tree a[data-key="products:domain:energie"]').getAttribute('aria-current'), 'page');
      await page.click('[data-action="close-navigation"]');
    });

    await check('domain tabs share collection layouts, filters, links and Excel scope', async () => {
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/domains/bau');
        assert.deepEqual(await page.locator('.ob-collection-controls [role="tab"]').allTextContents(), ['Übersicht', 'Kacheln', 'Tabelle']);
        assert.equal(await page.locator('.ob-tile').count(), 9);
        assert.equal(await page.locator('#tab-relations, #tab-history, #tab-rows').count(), 0);
        await page.locator('#view-tab-tiles').focus(); await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('#view-tab-table').getAttribute('aria-selected'), 'true');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'view-tab-table');
        assert.equal(await page.locator('#collection-view-panel tbody tr').count(), 9);
        assert.deepEqual(await page.locator('#collection-view-panel th .ob-table-sort').allTextContents(), ['Name', 'Verantwortung', 'Beschreibung', 'Attribute', 'Status']);
        await page.locator('#collection-filter').fill('Areal');
        assert.equal(await page.locator('#collection-view-panel tbody tr').count(), 1);
        await page.click('#view-tab-tiles');
        assert.equal(await page.locator('.ob-tile').count(), 1);
        await page.click('#view-tab-overview');
        assert(await page.locator('.ob-core-facts').isVisible());
        assert.equal(await page.locator('#collection-filter').count(), 0);
        await page.click('#view-tab-table');
        assert.equal(await page.locator('#collection-filter').inputValue(), 'Areal');
        await page.reload(); await page.locator('#collection-filter').waitFor();
        assert.equal(await page.locator('#view-tab-table').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#collection-view-panel tbody tr').count(), 1);
        await page.locator('#collection-view-panel a[href="#/objects/areal"]').click(); await settle(page);
        assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#tab-relations').count(), 1);
        await page.goBack(); await settle(page);
        assert.equal(await page.locator('#collection-filter').inputValue(), 'Areal');
        await page.click('#collection-filter-clear');
        assert.equal(await page.locator('#collection-view-panel tbody tr').count(), 9);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await visit('#/domains/bau?tab=rows');
      assert.equal(await page.locator('#view-tab-table').getAttribute('aria-selected'), 'true');
      assert(page.url().includes('tab=table'));
      await page.locator('#collection-filter').fill('Areal');
      await page.click('[data-menu="actions"]');
      const downloaded = page.waitForEvent('download');
      await page.click('[data-export="xlsx"]');
      const workbook = await require('./excel-helpers.cjs').readWorkbook(await (await downloaded).path());
      assert.equal(workbook.getWorksheet('Geschäftsobjekte').rowCount, 2);
      assert.equal(workbook.getWorksheet('Geschäftsobjekte').getCell('B2').value, 'Areal');
      for (const tab of ['overview', 'relations', 'history']) {
        await visit('#/domains/bau?tab=' + tab);
        assert(await page.locator('.ob-core-facts').isVisible());
        assert.equal(await page.locator('#view-tab-overview').getAttribute('aria-selected'), 'true');
      }
    });

    await check('domain history and group disclosures remain independent of other collections', async () => {
      await visit('#/domains/bau');
      const original = page.url();
      assert.equal(await page.evaluate(() => DK.router.parse().params.tab), 'tiles');
      await page.locator('.ob-group-header').click();
      assert.equal(await page.locator('.ob-tile').count(), 0);
      await page.click('#sidebar-tree a[data-key="objects:domain:energie"]'); await settle(page);
      assert.equal(await page.locator('.ob-tile').count(), 3, 'another domain must not inherit the collapsed group');
      await page.click('#view-tab-table');
      await page.goBack(); await settle(page);
      assert.equal(page.url(), original);
      assert.equal(await page.locator('#view-tab-tiles').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('.ob-group-header').getAttribute('aria-expanded'), 'false');
      await page.goForward(); await settle(page);
      assert.equal(await page.locator('#view-tab-table').getAttribute('aria-selected'), 'true');
      await page.click('[data-menu="group"]'); await page.click('[data-group="status"]');
      await page.goBack(); await settle(page);
      assert.equal(page.url(), original);
      assert.equal(await page.evaluate(() => DK.views.context({ ...DK.router.parse(), entity: { ...DK.data.domainOf('bau'), kind: 'domains' } }, DK.app.state).groupBy), 'none');
      await visit('#/objects');
      const collection = page.url();
      await page.click('#sidebar-tree a[data-key="refs"]'); await settle(page);
      await page.click('#view-tab-table');
      await page.goBack(); await settle(page);
      assert.equal(page.url(), collection);
      assert.equal(await page.locator('#view-tab-tiles').getAttribute('aria-selected'), 'true');
    });

    await check('domain deep links, cards, tables and breadcrumbs keep the selected navigation model', async () => {
      for (const width of [1440, 390]) for (const nav of ['entity', 'container']) {
        await page.setViewportSize({ width, height: 900 });
        await visit('#/domains/bau?nav=' + nav);
        const key = nav === 'container' ? 'domains:bau' : 'objects:domain:bau';
        const branch = `#sidebar-tree [data-action="toggle-tree"][data-key="${key}"]`;
        assert.equal(await page.locator(branch).getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#sidebar-tree a[aria-current="page"]').count(), 1);
        for (const mode of ['tiles', 'table']) {
          await page.click('#view-tab-' + mode);
          const link = page.locator(mode === 'tiles' ? '#collection-view-panel .ob-tile' : '#collection-view-panel td.is-primary a').first();
          assert((await link.getAttribute('href')).includes('nav=' + nav));
          await link.click(); await page.locator('.ob-entity-header').waitFor(); await settle(page);
          assert.equal(await page.evaluate(() => DK.data.navModel()), nav);
          assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'), 'true');
          const domain = page.locator('.ob-breadcrumb a').filter({ hasText: /^Architektonische Sicht$/ });
          assert((await domain.getAttribute('href')).includes('nav=' + nav));
          assert((await page.locator('.ob-breadcrumb a').nth(1).getAttribute('href')).includes('nav=' + nav));
          await domain.click(); await page.locator('#collection-filter').waitFor();
          assert.equal(await page.evaluate(() => DK.data.navModel()), nav);
          assert.equal(await page.locator('#view-tab-' + mode).getAttribute('aria-selected'), 'true');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        }
      }
      await visit('#/systems/gwr');
      assert.equal(await page.locator('#sidebar-tree [data-action="toggle-tree"][data-key="tables:system:gwr"]').getAttribute('aria-expanded'), 'true');
    });

    await check('System metadata stays visible through search, export and sidebar changes', async () => {
      await visit('#/objects/areal');
      for (const selector of ['[data-action="toggle-search"]', '[data-menu="actions"]', '[data-action="toggle-sidebar"]']) {
        await page.click(selector);
        assert(await page.locator('.ob-system-facts dl').isVisible(), selector);
      }
      await visit('#/objects/gebaeude');
      assert(await page.locator('.ob-system-facts dl').isVisible());
      assert.equal(await page.locator('.ob-detail-facts details').count(), 0);
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
