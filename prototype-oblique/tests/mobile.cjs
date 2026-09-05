/* Mobile and constrained-viewport regressions; see tests/README.md. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const base = `http://127.0.0.1:${server.address().port}/`;
    const report = { views: [], errors: [] };
    page.on('pageerror', error => report.errors.push(error.message));
    const dir = path.join(process.env.TEMP || '/tmp', 'oblique-mobile-review'); fs.mkdirSync(dir, { recursive: true });
    const phase = process.env.REPORT_ONLY ? 'before' : 'after';
    let visits = 0;
    const visit = async hash => {
      await page.goto(base + '?mobile-check=' + (++visits) + hash); await page.locator('#page-content').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (hash === '#/api') await page.locator('.opblock-summary-control').first().waitFor();
      await settle(page);
    };
    const record = async name => {
      const result = await page.evaluate(() => {
        const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
        const visible = el => el.checkVisibility() && el.getBoundingClientRect().height > 0;
        const controls = [...document.querySelectorAll('.ob-header-tools button, .ob-suggest-option, .swagger-ui button, .swagger-ui input, .swagger-ui select')].filter(el => visible(el) && !el.disabled);
        return {
          viewport: { width: document.documentElement.clientWidth, height: innerHeight, bottom: visualViewport.offsetTop + visualViewport.height }, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          outside: [...document.querySelectorAll('#page-content *')].filter(el => visible(el) && el.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && getComputedStyle(el).position !== 'absolute').slice(0, 12).map(el => ({ tag: el.tagName, class: String(el.className), ...box(el) })),
          fields: controls.filter(el => el.matches('input,select')).map(el => ({ class: el.className, font: getComputedStyle(el).fontSize, ...box(el) })),
          smallTargets: controls.filter(el => { const r = box(el); return r.width < 44 || r.height < 44; }).slice(0, 15).map(el => ({ label: el.textContent.trim().slice(0, 30), class: el.className, ...box(el) })),
          overlays: [...document.querySelectorAll('.modal-ux, .ob-popover, .ob-popover-content, .ob-menu, #search-suggest, .ob-graph-fullscreen .ob-graph-shell')].filter(visible).map(el => ({ class: el.className, ...box(el), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: getComputedStyle(el).overflowY }))
        };
      });
      report.views.push({ name, ...result });
      await page.screenshot({ path: path.join(dir, `${phase}-${name}.png`) });
    };
    for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 600], [390, 280]]) {
      await page.setViewportSize({ width, height });
      await visit('#/api');
      await page.locator('.opblock-summary-control').nth(1).click(); await page.locator('.microlight').first().waitFor();
      await record(`api-expanded-${width}-${height}`);
      if (!process.env.REPORT_ONLY && width <= 390) {
        const scroll = page.locator('.opblock.is-open .responses-inner').first();
        assert(await scroll.evaluate(el => el.scrollWidth > el.clientWidth), 'Wide response columns must have a local scroll area');
        await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth; });
        assert(await scroll.evaluate(el => el.scrollLeft > 0), 'All response columns must remain reachable');
        await scroll.evaluate(el => { el.scrollLeft = 0; });
      }
      await page.locator('.btn.authorize').first().click(); await settle(page);
      await record(`api-dialog-${width}-${height}`);
      await page.locator('.modal-ux .btn-done').tap();
      assert.equal(await page.locator('.modal-ux').count(), 0, 'Dialog must remain dismissible on a short screen');
    }
    await page.setViewportSize({ width: 390, height: 280 });
    await visit('#/objects');
    await page.locator('[data-action="toggle-search"]').click(); await page.locator('#search-input').fill('Gebäude');
    await record('short-header-search');
    await page.keyboard.press('Escape');
    await page.locator('[data-action="open-navigation"]').click();
    await page.locator('#drawer-language-host button').first().click(); await record('short-language-menu');
    if (!process.env.REPORT_ONLY) {
      await page.locator('#drawer-language-host .ob-menu-item').first().focus();
      await page.keyboard.press('End');
      await page.keyboard.press('Home');
      const firstVisible = await page.locator('#drawer-language-host .ob-menu-item').first().evaluate(el => el.getBoundingClientRect().top >= 0);
      assert(firstVisible, 'First language option must be reachable without moving the background page');
    }
    await page.keyboard.press('Escape');
    await page.locator('#drawer-help-host button').first().click(); await record('short-help');
    await visit('#/objects/gebaeude'); await page.locator('[data-tab="relations"]').click();
    await page.locator('[data-action="graph-fullscreen"]').click(); await settle(page);
    await record('short-fullscreen');
    if (!process.env.REPORT_ONLY) {
      await page.locator('.ob-graph-fullscreen .ob-graph-shell').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const graph = await page.locator('.ob-graph-fullscreen').evaluate(el => ({
        toolbar: el.querySelector('.ob-graph-toolbar').getBoundingClientRect().top,
        hint: el.querySelector('.ob-graph-hint').getBoundingClientRect().bottom,
        height: el.clientHeight
      }));
      assert(graph.toolbar >= 0 && graph.hint <= graph.height + 1, 'Fullscreen controls and details must remain reachable');
      await page.screenshot({ path: path.join(dir, 'after-short-fullscreen-scrolled.png') });
      await page.locator('.ob-graph-fullscreen [data-action="graph-fullscreen"]').tap();
      assert.equal(await page.locator('.ob-graph-fullscreen').count(), 0);
    }
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1280, height: 800 });
    await visit('#/objects'); await page.locator('[data-action="toggle-search"]').click(); await page.locator('#search-input').fill('Gebäude');
    await record('touch-laptop-search');
    if (!process.env.REPORT_ONLY) assert(await page.locator('#search-input').evaluate(el => parseFloat(getComputedStyle(el).paddingRight) >= document.querySelector('.ob-search-clear').getBoundingClientRect().width), 'Touch search clear button must not cover typed text');
    await page.setViewportSize({ width: 390, height: 844 });
    await visit('#/objects'); await page.locator('[data-action="toggle-search"]').click(); await page.locator('#search-input').fill('Gebäude');
    await page.evaluate(() => { window.mobileSearchInput = document.querySelector('#search-input'); });
    await page.evaluate(() => { Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 280 }); visualViewport.dispatchEvent(new Event('resize')); });
    await settle(page); await record('keyboard-header-search');
    await page.evaluate(() => { Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, get: () => 24 }); visualViewport.dispatchEvent(new Event('scroll')); });
    await settle(page); await record('keyboard-header-search-panned');
    assert(await page.evaluate(() => mobileSearchInput === document.querySelector('#search-input') && document.activeElement === mobileSearchInput && mobileSearchInput.value === 'Gebäude'), 'Viewport fitting must preserve the input, focus and query');
    await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; delete window.mobileSearchInput; visualViewport.dispatchEvent(new Event('resize')); });
    await visit('#/'); await page.locator('[data-action="toggle-search"]').click(); await page.locator('#search-input').fill('Gebäude');
    await page.evaluate(() => { Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 280 }); visualViewport.dispatchEvent(new Event('resize')); });
    await settle(page); await record('keyboard-home-search');
    await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
    await visit('#/api'); await page.locator('.btn.authorize').first().tap();
    await page.evaluate(() => {
      window.mobileAuthInput = document.querySelector('.modal-ux input');
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 280 });
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, get: () => 24 });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await settle(page); await record('keyboard-api-dialog');
    assert(await page.evaluate(() => mobileAuthInput === document.querySelector('.modal-ux input') && document.activeElement === mobileAuthInput), 'Keyboard viewport must not remount the API dialog');
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'scale', { configurable: true, get: () => 2 }); visualViewport.dispatchEvent(new Event('resize'));
    });
    if (!process.env.REPORT_ONLY) assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--ob-visual-viewport-height')), '', 'Native pinch zoom must not shrink the modal layout');
    await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; delete visualViewport.scale; delete window.mobileAuthInput; visualViewport.dispatchEvent(new Event('resize')); });
    await page.setViewportSize({ width: 1024, height: 390 });
    await visit('#/objects'); await page.locator('#help-host button').click(); await record('short-desktop-help');
    if (!process.env.REPORT_ONLY) {
      const contact = page.locator('#help-host .ob-popover a').last();
      await contact.focus(); await settle(page);
      assert(await contact.evaluate(el => { const a = el.getBoundingClientRect(), b = el.closest('.ob-popover-content').getBoundingClientRect(); return a.top >= b.top && a.bottom <= b.bottom; }), 'Contact links must be reachable in the short help panel');
    }
    fs.writeFileSync(path.join(dir, phase + '.json'), JSON.stringify(report, null, 2));
    if (!process.env.REPORT_ONLY) {
      for (const v of report.views) {
        assert.equal(v.overflow, 0, `${v.name}: page overflow`);
        assert.deepEqual(v.smallTargets, [], `${v.name}: touch targets below 44 px`);
        assert(v.fields.every(f => parseFloat(f.font) >= 16), `${v.name}: small touch input text`);
        for (const overlay of v.overlays) {
          assert(overlay.x >= -1 && overlay.x + overlay.width <= v.viewport.width + 1 && overlay.y >= -1 && overlay.bottom <= v.viewport.bottom + 1, `${v.name}: overlay outside the viewport`);
          assert(overlay.scrollHeight <= overlay.clientHeight + 1 || ['auto', 'scroll'].includes(overlay.overflowY), `${v.name}: clipped overlay content`);
        }
      }
    }
    console.log(process.env.REPORT_ONLY ? `Recorded ${report.views.length} baseline mobile/touch views.` : `PASS: ${report.views.length} mobile/touch views; local API scrolling, touch controls, short overlays, fullscreen and keyboard viewport fitting.`);
    assert.deepEqual(report.errors, []);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
