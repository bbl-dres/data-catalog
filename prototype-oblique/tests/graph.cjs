/* Diagram behavior and dense-data regression checks. Setup: tests/README.md. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/#/systems/gwr`);
    await page.click('#tab-relations');
    await page.evaluate(() => document.fonts.ready);
    await settle(page);
    assert(await page.locator('.ob-relations-diagram').isVisible());
    assert.equal(await page.locator('.ob-tabs [data-action="toggle-relation-view"]').count(), 1);
    assert.equal(await page.locator('[role="tablist"] [data-action="toggle-relation-view"]').count(), 0);
    const relationCount = await page.evaluate(() => DK.data.relations('systems', DK.data.sysOf('gwr')).reduce((n, g) => n + g.items.length, 0));
    assert((await page.locator('#tab-relations').innerText()).includes(`(${relationCount})`));
    assert.equal(await page.locator('.ob-graph-group').count(), await page.evaluate(() => DK.data.relations('systems', DK.data.sysOf('gwr')).filter(g => g.items.length).length));
    const bubbles = await page.locator('.ob-graph-bubble-inner').evaluateAll(els => els.map(el => {
      const circle = el.getBoundingClientRect(), cx = circle.x + circle.width / 2, cy = circle.y + circle.height / 2;
      return { round: Math.abs(circle.width - circle.height) < 1 && getComputedStyle(el).borderRadius === '50%', contained: [...el.querySelectorAll('.ob-graph-node')].every(node => {
        const r = node.getBoundingClientRect();
        return [r.left, r.right].every(x => [r.top, r.bottom].every(y => Math.hypot(x - cx, y - cy) <= circle.width / 2 + 1));
      }) };
    }));
    assert(bubbles.every(b => b.round && b.contained), 'bubble nodes must fit within circular groups');
    assert.equal(await page.locator('.ob-graph-hub-circle').count(), 1);
    const shell = await page.locator('#graph-shell').boundingBox();
    assert(Math.abs(shell.y + shell.height - 1034) <= 2, 'diagram does not use the remaining viewport height');
    await page.screenshot({ path: path.join(process.env.TEMP || '/tmp', 'oblique-relations-desktop.png') });

    await page.click('[data-action="toggle-relation-view"]');
    assert(await page.locator('.ob-relations-list .ob-table').isVisible());
    assert.equal(await page.locator('.ob-relations-list tbody tr').count(), relationCount);
    await page.click('.ob-relations-list [data-sort-column="0"]');
    assert.equal(await page.locator('.ob-relations-list th').first().getAttribute('aria-sort'), 'ascending');
    await page.click('[data-action="toggle-relation-view"]');

    const fitted = await page.evaluate(() => DK.app.state.graph.zoom);
    await page.click('[data-action="graph-zoom-in"]');
    assert(await page.evaluate(() => DK.app.state.graph.zoom) > fitted);
    await page.click('[data-action="graph-zoom-out"]');
    assert(Math.abs(await page.evaluate(() => DK.app.state.graph.zoom) - fitted) < .001);
    await page.click('[data-action="graph-actual"]');
    assert.equal(await page.locator('#graph-zoom').innerText(), '100%');
    await page.click('[data-action="graph-fit"]');
    const before = await page.evaluate(() => ({ x: DK.app.state.graph.x, y: DK.app.state.graph.y }));
    const viewport = await page.locator('#graph').boundingBox();
    await page.mouse.move(viewport.x + 8, viewport.y + 8);
    await page.mouse.down();
    await page.mouse.move(viewport.x + 68, viewport.y + 48, { steps: 5 });
    await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => ({ x: DK.app.state.graph.x, y: DK.app.state.graph.y })), { x: before.x + 60, y: before.y + 40 });
    await page.click('[data-action="graph-select"]');
    const selectedMode = await page.evaluate(() => ({ x: DK.app.state.graph.x, y: DK.app.state.graph.y }));
    await page.mouse.move(viewport.x + 8, viewport.y + 8); await page.mouse.down();
    await page.mouse.move(viewport.x + 58, viewport.y + 48); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => ({ x: DK.app.state.graph.x, y: DK.app.state.graph.y })), selectedMode);
    await page.click('[data-action="graph-fit"]');
    const node = page.locator('.ob-graph-node').first();
    const name = await node.innerText();
    await node.click();
    assert((await page.locator('#graph-selection').innerText()).includes(name));
    assert.equal(await page.locator('#graph-selection a').count(), 1);
    assert(page.url().includes('/systems/gwr'));

    const paged = page.locator('.ob-graph-group').filter({ has: page.locator('.ob-graph-group-pager') }).first();
    const groupKey = await paged.getAttribute('data-group');
    const firstPageNames = await paged.locator('.ob-graph-node').allTextContents();
    await paged.locator('[data-action="graph-page"]').last().click();
    assert.notDeepEqual(await paged.locator('.ob-graph-node').allTextContents(), firstPageNames);
    assert.equal(await page.evaluate(key => DK.app.state.graph.pages[key], groupKey), 1);

    await page.click('[data-action="graph-fullscreen"]');
    assert(await page.locator('dialog.ob-graph-fullscreen').isVisible());
    let full = await page.locator('dialog').boundingBox();
    assert.equal(full.width, 1600); assert.equal(full.height, 1050);
    await page.click('[data-action="graph-zoom-in"]');
    await page.setViewportSize({ width: 820, height: 1050 });
    await settle(page);
    assert.equal(await page.locator('#graph').count(), 1);
    assert(await page.locator('dialog').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.action), 'graph-fullscreen');
    assert.equal(await page.locator('#main #graph').count(), 1);
    await page.locator('#graph').focus();
    const x = await page.evaluate(() => DK.app.state.graph.x);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => DK.app.state.graph.x), x - 80);
    await page.keyboard.press('0');
    assert.equal(await page.evaluate(() => DK.app.state.graph.autoFit), true);

    // Thousands of relationships stay reachable without rendering thousands of graph nodes.
    await page.evaluate(() => {
      const original = DK.data.relations;
      const groups = original('domains', DK.data.domainOf('bau'));
      DK.data.relations = () => groups.map(g => ({ ...g, items: Array.from({ length: 200 }, (_, i) => ({ ...g.items[i % g.items.length], name: g.items[i % g.items.length].name + ' ' + (i + 1) })) }));
      DK.app.state.graph = DK.graph.createState(); DK.app.render();
    });
    await settle(page);
    assert.equal(await page.locator('.ob-graph-node').count(), 30);
    assert.equal(await page.locator('.ob-relations-list tbody tr').count(), 1000);
    assert.match(await page.locator('#tab-relations').innerText(), /\(1000\)/);
    await page.click('[data-action="toggle-relation-view"]');
    assert(await page.locator('.ob-relations-list').isVisible());
    await page.click('[data-action="toggle-relation-view"]');
    await page.emulateMedia({ media: 'print' });
    assert(await page.locator('.ob-relations-list').isVisible());
    assert.equal(await page.locator('#graph-shell').isVisible(), false);
    await page.emulateMedia({ media: 'screen' });

    await page.reload(); await page.click('#tab-relations');
    for (const width of [320, 390, 768, 961, 1280, 1920, 3840]) {
      await page.setViewportSize({ width, height: 900 }); await settle(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
      assert(await page.locator('[data-action="toggle-relation-view"]').isVisible());
      if (width === 390) {
        await page.screenshot({ path: path.join(process.env.TEMP || '/tmp', 'oblique-relations-phone.png') });
        await page.click('[data-action="graph-fullscreen"]');
        full = await page.locator('dialog').boundingBox(); assert.equal(full.width, width);
        await page.click('[data-action="graph-fullscreen"]');
      }
    }
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const touch = await touchContext.newPage();
    touch.on('pageerror', e => errors.push(e.message));
    await touch.goto(`http://127.0.0.1:${server.address().port}/#/systems/gwr`);
    await touch.click('#tab-relations'); await settle(touch);
    assert.equal(await touch.evaluate(() => DK.app.state.graph.zoom), 1, 'phone labels should retain their normal size');
    await touch.click('[data-action="graph-fullscreen"]');
    const cdp = await touchContext.newCDPSession(touch);
    const beforePinch = await touch.evaluate(() => DK.app.state.graph.zoom);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 100, y: 250, id: 1 }, { x: 220, y: 250, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 70, y: 250, id: 1 }, { x: 250, y: 250, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert(await touch.evaluate(() => DK.app.state.graph.zoom) > beforePinch, 'fullscreen pinch did not zoom');
    await touch.click('[data-action="graph-fit"]');
    const beforeTouchPan = await touch.evaluate(() => DK.app.state.graph.y);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 16, y: 240, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 16, y: 180, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert(await touch.evaluate(() => DK.app.state.graph.y) < beforeTouchPan, 'fullscreen touch did not pan');
    await touch.locator('.ob-graph-node').last().focus();
    const lastBounds = await touch.locator('.ob-graph-node').last().boundingBox(), touchViewport = await touch.locator('#graph').boundingBox();
    assert(lastBounds.y >= touchViewport.y && lastBounds.y + lastBounds.height <= touchViewport.y + touchViewport.height, 'keyboard focus is clipped outside the canvas');
    await touch.keyboard.press('Enter');
    await touch.locator('#graph-selection a').click();
    await touch.waitForSelector('.ob-entity-header'); await settle(touch);
    assert.equal(await touch.locator('dialog').count(), 0);
    assert.equal(await touch.evaluate(() => document.activeElement.id), 'page-content');
    await touchContext.close();
    assert.deepEqual(errors, []);
    console.log('PASS: diagram default, table sorting, zoom/reset/pan/select, group paging, fullscreen/resize/Escape, keyboard navigation, touch pan/pinch, 1,000 relationships, print and responsive widths.');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
