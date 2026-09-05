/* Run from any directory. Requires Playwright; see docs/responsive-strategy.md.
   Test data is injected into the browser only. No application data is modified. */
const assert = require('node:assert/strict');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage();
    const errors = [];
    const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); }); };
    watch(page);
    async function visit(hash, tab) {
      await page.goto(base + hash);
      await page.locator('#page-content').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (tab) await page.locator(`[data-tab="${tab}"]`).click();
      await settle(page);
    }
    const routes = [
      ['#/', null], ['#/objects', null], ['#/objects?view=table', null],
      ['#/objects/gebaeude', null], ['#/objects/gebaeude', 'rows'], ['#/objects/gebaeude', 'relations'], ['#/objects/gebaeude', 'history'],
      ['#/search?q=Gebäude', null], ['#/manual', null], ['#/api', null]
    ];
    let layouts = 0;
    for (const width of [320, 390, 600, 640, 768, 820, 960, 961, 1024, 1280, 1440, 1600, 1920, 2560, 3840]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [route, tab] of routes) {
        await visit(route, tab);
        if (route === '#/api') await page.locator('.swagger-ui .opblock').first().waitFor();
        const result = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          shell: document.querySelector('.ob-main').getBoundingClientRect().width,
          headerHeight: document.querySelector('#header').getBoundingClientRect().height,
          navVisible: document.querySelector('#main-nav').checkVisibility(),
          hasTree: !!document.querySelector('#sidebar-tree'),
          homeStacked: !document.querySelector('.ob-home-recent') || document.querySelector('.ob-home-recent').getBoundingClientRect().top >= document.querySelector('.ob-home-domains').getBoundingClientRect().bottom,
          brokenHeaders: [...document.querySelectorAll('.ob-table-region:not(.is-cards) th')].some(th => {
            const label = th.querySelector('.ob-table-sort-label');
            return label && (label.getBoundingClientRect().height > parseFloat(getComputedStyle(label).lineHeight) + 1 || label.getBoundingClientRect().right > th.getBoundingClientRect().right);
          }),
          tables: [...document.querySelectorAll('.ob-table-region')].filter(el => el.checkVisibility()).map(el => ({
            width: el.clientWidth, min: Number(el.dataset.tableMinWidth), cards: el.classList.contains('is-cards'),
            sortVisible: el.querySelector('[data-action="sort-cards"]')?.checkVisibility(),
            headerVisible: el.querySelector('.ob-table-sort')?.checkVisibility(),
            emptyLabels: [...el.querySelectorAll('td')].some(td => !td.dataset.label)
          }))
        }));
        assert.equal(result.overflow, false, `${width}: ${route}/${tab} page overflow`);
        assert(result.shell <= 1600, 'Workspace exceeds reading band');
        const identityHeight = width >= 1920 ? 86 : width >= 768 ? 72 : 56;
        assert.equal(result.headerHeight, identityHeight + (width > 960 ? 45 : 0), 'Header height does not match sticky offsets');
        assert.equal(result.navVisible, width > 960, 'Primary navigation row at wrong breakpoint');
        assert(result.homeStacked, 'Independent home sections must stay stacked');
        assert.equal(result.brokenHeaders, false, `${width}: ${route}/${tab} wrapped or overflowing header`);
        if (route === '#/api') assert.equal(result.hasTree, false, 'API must not render the catalog tree');
        for (const table of result.tables) {
          assert.equal(table.cards, table.width < table.min, 'Table did not adapt to its container');
          assert.equal(table.emptyLabels, false, 'Card field lacks label');
          if (table.sortVisible !== undefined) assert.equal(table.sortVisible, table.cards, 'Sorting unavailable or duplicated');
          if (table.headerVisible !== undefined) assert.equal(table.headerVisible, !table.cards, 'Hidden header control remains visible');
        }
        layouts++;
      }
    }

    // Width changes must preserve sort order and focus, including sidebar collapse.
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit('#/domains/bau');
    await page.click('#view-tab-overview');
    assert.equal(await page.locator('.ob-entity-header .ob-chip').count(), 0, 'Type/status must be in Kerndaten, not the title');
    assert.deepEqual(await page.locator('.ob-core-facts > .ob-facts dt').allTextContents(), ['Typ', 'Status', 'Klassifizierung', 'Personendaten']);
    await page.locator('.ob-metadata summary').click();
    const factHeights = await page.locator('.ob-facts dt, .ob-facts dd').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
    assert(factHeights.every(height => height === 37), 'Expanded metadata must use the same single-line row height as core facts and contacts');
    await page.setViewportSize({ width: 1024, height: 768 });
    await visit('#/objects/gebaeude', 'rows');
    await page.locator('[data-action="sort-cards"]').focus();
    await page.locator('[data-action="sort-cards"]').selectOption('0:desc');
    assert.equal(await page.locator('.ob-detail-rows tbody tr').first().locator('td.is-primary').innerText(), 'Grundstück');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'sort-cards');
    await page.locator('[data-action="toggle-sidebar"]').click();
    await settle(page);
    assert.equal(await page.locator('.ob-detail-rows .is-cards').count(), 0);
    assert.equal(await page.locator('th[aria-sort="descending"]').innerText(), 'Attribut');
    await page.locator('[data-action="toggle-sidebar"]').click();
    await settle(page);
    await page.locator('[data-action="sort-cards"]').focus();
    await page.setViewportSize({ width: 1280, height: 768 });
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'sort-table');
    await page.setViewportSize({ width: 1024, height: 768 });
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'sort-cards');
    await page.setViewportSize({ width: 1280, height: 768 });
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'sort-table');
    assert.equal(await page.locator('.ob-detail-rows tbody tr').first().locator('td.is-primary').innerText(), 'Grundstück');

    // Sorting a later group restores focus to that same group's control.
    await page.setViewportSize({ width: 390, height: 844 });
    await visit('#/objects?view=table');
    const groupSort = page.locator('[data-action="sort-cards"]').nth(1);
    const focusId = await groupSort.getAttribute('data-focus');
    await groupSort.focus();
    await groupSort.selectOption('0:desc');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.focus), focusId);

    // Pagination/sorting/export keep the full dataset in card mode.
    await visit('#/objects/gebaeude', 'rows');
    await page.evaluate(() => {
      const object = DK.data.objOf('gebaeude');
      const seed = object.attributes[0];
      object.attributes = Array.from({ length: 123 }, (_, i) => ({ ...seed, identifier: `test-${i}`, name: `Test ${String(i + 1).padStart(3, '0')}`, position: i + 1 }));
      delete DK.app.state.tableSorts['detail:objects:rows'];
      DK.app.render();
    });
    assert.equal(await page.locator('.ob-detail-rows tbody tr').count(), 50);
    await page.locator('.ob-pager--top [data-action="set-page"][data-page="2"]').click();
    assert.equal(await page.locator('.ob-detail-rows td.is-primary').first().innerText(), 'Test 051');
    await page.locator('[data-action="sort-cards"]').selectOption('0:desc');
    assert.equal(await page.locator('.ob-detail-rows td.is-primary').first().innerText(), 'Test 123');
    await page.locator('[data-action="set-page-size"]').selectOption('100');
    assert.equal(await page.locator('.ob-detail-rows tbody tr').count(), 100);
    await page.locator('.ob-actions-menu > button').click();
    const downloadEvent = page.waitForEvent('download');
    await page.locator('[data-export="xlsx"]').click();
    const download = await downloadEvent;
    const workbook = await require('./excel-helpers.cjs').readWorkbook(await download.path());
    const attrs = workbook.getWorksheet('Attribute');
    assert.equal(attrs.rowCount, 124, 'Excel lost rows outside current page');
    assert.equal(attrs.getCell('E2').value, 'Test 123', 'Excel must retain the selected row sort');
    assert(attrs.getColumn(5).values.includes('Test 001'));
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.ob-table thead').evaluate(el => getComputedStyle(el).position), 'static');
    assert.equal(await page.locator('.ob-table-card-sort').evaluate(el => getComputedStyle(el).display), 'none');
    await page.emulateMedia({ media: 'screen' });

    // Drawer, keyboard tabs and orientation change.
    await page.reload();
    await visit('#/objects/gebaeude');
    assert.equal(await page.evaluate(() => DK.data.objOf('gebaeude').attributes.length), 7);
    await page.locator('[data-action="open-navigation"]').click();
    await settle(page);
    assert(await page.locator('#page-content').evaluate(el => el.inert));
    await page.keyboard.press('Shift+Tab');
    assert(await page.evaluate(() => !!document.activeElement.closest('#navigation-panel')));
    await page.keyboard.press('Escape');
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'open-navigation');
    await page.locator('[data-action="open-navigation"]').click();
    await settle(page);
    await page.setViewportSize({ width: 1280, height: 768 });
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'toggle-sidebar');
    assert.equal(await page.locator('#page-content').evaluate(el => el.inert), false);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.locator('[data-tab="overview"]').focus();
    await page.keyboard.press('End');
    await settle(page);
    assert.equal(await page.locator('.ob-tab[aria-selected="true"]').getAttribute('data-tab'), 'history');
    assert(await page.locator('.ob-tabs').evaluate(el => { const a = el.querySelector('[aria-selected="true"]').getBoundingClientRect(), b = el.getBoundingClientRect(); return a.left >= b.left && a.right <= b.right + 1; }));

    // Default header sort must agree with the advertised direction.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await visit('#/');
    await page.locator('.ob-home-domains [data-sort-column="0"]').click();
    assert.equal(await page.locator('.ob-home-domains th').first().getAttribute('aria-sort'), 'descending');
    assert.equal(await page.locator('.ob-home-domains tbody td.is-primary').first().innerText(), 'Projekt Management');
    await visit('#/objects/gebaeude', 'relations');
    assert(await page.locator('.ob-relations-diagram').isVisible());
    const beforePan = await page.evaluate(() => ({ x: DK.app.state.graph.x, y: DK.app.state.graph.y }));
    const desktopGraph = await page.locator('#graph').boundingBox();
    await page.mouse.move(desktopGraph.x + 20, desktopGraph.y + 20);
    await page.mouse.down();
    await page.mouse.move(desktopGraph.x + 80, desktopGraph.y + 60);
    await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => ({ x: DK.app.state.graph.x, y: DK.app.state.graph.y })), { x: beforePan.x + 60, y: beforePan.y + 40 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await visit('#/manual');
    if (await page.locator('.ob-workspace.is-collapsed').count()) await page.locator('[data-action="toggle-sidebar"]').click();
    await page.locator('[data-chapter="modell"][data-action="chapter"]').click();
    await settle(page);
    const handbookTop = await page.locator('#header').evaluate(el => el.getBoundingClientRect().bottom + 16);
    assert.equal(Math.round(await page.locator('#hb-modell').evaluate(el => el.getBoundingClientRect().top)), handbookTop, 'Handbook chapter hidden behind header');

    // Touch emulation at a tablet width; also test a short phone landscape view.
    const touchContext = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
    const touch = await touchContext.newPage(); watch(touch);
    await touch.goto(base + '#/objects/gebaeude');
    await touch.locator('[data-action="open-navigation"]').click();
    const target = await touch.locator('.ob-tree-toggle').first().boundingBox();
    assert(target.width >= 44 && target.height >= 44, 'Disclosure target too small for touch');
    await touch.locator('#navigation-panel [data-action="close-navigation"]').click();
    await touch.setViewportSize({ width: 390, height: 844 });
    await touch.locator('[data-tab="relations"]').click();
    assert(await touch.locator('.ob-relations-diagram').isVisible());
    assert.equal(await touch.locator('#graph').evaluate(el => getComputedStyle(el).touchAction), 'pan-y pinch-zoom');
    const cdp = await touchContext.newCDPSession(touch);
    const graph = await touch.locator('#graph').boundingBox();
    const startY = Math.min(740, graph.y + 150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: startY }] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: startY - i * 15 }] });
      await settle(touch);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settle(touch);
    assert(await touch.evaluate(() => scrollY > 0), 'Graph traps vertical touch scrolling');
    await touch.setViewportSize({ width: 844, height: 390 });
    await touch.locator('[data-action="toggle-search"]').click();
    await touch.locator('#search-input').fill('Gebäude');
    const suggest = await touch.locator('#search-suggest').boundingBox();
    assert(suggest && suggest.y + suggest.height <= 390, 'Suggestions exceed short viewport');
    await touch.goto(base + '#/api');
    await touch.locator('[data-action="open-navigation"]').click();
    assert.equal(await touch.locator('#navigation-panel .ob-tree').count(), 0);
    assert.equal(await touch.locator('#navigation-panel .ob-drawer-nav a').count(), 3);
    await touchContext.close();

    // All profile kinds and translated UI render with both navigation models.
    let profiles = 0;
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await visit('#/');
      profiles += await page.evaluate(() => {
        let count = 0;
        for (const nav of ['entity', 'container']) for (const lang of ['de', 'fr', 'it', 'en']) {
          DK.data.navModelOverride = nav;
          DK.ui.setDictionary(DK.data.i18n, lang, 'de');
          for (const kind of DK.data.kinds) for (const item of DK.data[kind]) {
            const entity = { kind, ...item };
            for (const [tab] of DK.detail.tabs(entity)) {
              const route = { view: 'detail', kind, id: item.identifier, entity, params: { nav, tab } };
              const html = DK.views.page(route, DK.app.state).html;
              if (!html.includes('page-content') || html.includes('undefined')) throw Error(`${kind}/${item.identifier}/${tab}/${lang}`);
              count++;
            }
          }
        }
        DK.ui.setDictionary(DK.data.i18n, 'de', 'de');
        return count;
      });
    }
    for (const width of [320, 768, 961, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const lang of ['de', 'fr', 'it', 'en']) {
        await visit('#/objects/gebaeude', 'rows');
        await page.evaluate(lang => { DK.app.state.lang = lang; document.documentElement.lang = lang; DK.ui.setDictionary(DK.data.i18n, lang, 'de'); DK.app.render(); }, lang);
        await settle(page);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${lang}/${width} translated layout overflow`);
      }
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: ${layouts} responsive layouts, ${profiles} profile render combinations; sorting, focus, pagination, Excel, print, drawer/orientation, tab keyboard navigation, touch targets and touch scrolling, short-screen search. No browser/resource errors.`);
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
