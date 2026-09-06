/* Responsive print geometry and keyboard fitting, using the same catalog fixture as PDF tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace({ hasTouch: true, isMobile: true }), { page, choose, visit, open, settle, output } = test;
  const report = [], check = !process.env.REPORT_ONLY;
  const record = async name => {
    const result = await page.evaluate(() => {
      const box = selector => {
        const el = document.querySelector(selector), r = el?.getBoundingClientRect();
        return r && el.checkVisibility() ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, scroll: el.scrollHeight, client: el.clientHeight, overflowX: el.scrollWidth - el.clientWidth } : null;
      };
      return { width: innerWidth, height: innerHeight, visibleTop: visualViewport.offsetTop, visibleHeight: visualViewport.height,
        dialog: box('.ob-export-dialog'), compact: document.querySelector('.ob-export-dialog').classList.contains('is-compact'), canvas: box('#diagram-canvas'), toolbar: box('.ob-export-toolbar'), scope: box('.ob-export-settings'),
        footer: box('.ob-export-dialog > .ob-footer'), popover: box('#diagram-popover'), actions: box('.ob-export-popover-actions'), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: [...document.querySelectorAll('.ob-export-dialog button, .ob-export-dialog summary, .ob-export-dialog .ob-check, .ob-export-tree-check')]
          .filter(el => el.checkVisibility() && !el.disabled).map(el => ({ name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 35), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))
          .filter(r => r.width < 43.5 || r.height < 43.5) };
    });
    report.push({ name, ...result });
    await page.screenshot({ path: path.join(output, `${check ? 'after' : 'before'}-${name}.png`) });
    if (check) {
      assert(result.overflow <= 1 && result.dialog.overflowX <= 1, `${name}: horizontal overflow`);
      assert.deepEqual(result.small, [], `${name}: undersized touch targets`);
      assert(Math.abs(result.dialog.top - result.visibleTop) < 1 && Math.abs(result.dialog.height - result.visibleHeight) < 1, `${name}: dialog ignores visible viewport`);
      if (result.compact) assert(result.canvas.height >= 280, `${name}: collapsed preview`);
      assert(result.footer.top >= result.canvas.bottom - 1, `${name}: footer overlaps preview`);
      if (result.popover) {
        assert(result.popover.top >= result.visibleTop && result.popover.bottom <= result.visibleTop + result.visibleHeight, `${name}: popover outside viewport`);
        assert(result.actions.top >= result.popover.top && result.actions.bottom <= result.popover.bottom, `${name}: unreachable Apply/Cancel`);
      }
    }
    return result;
  };
  try {
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['#/', '#/objects?view=table', '#/systems/gwr', '#/tables/t-gwr-gebaeude?tab=rows', '#/search?q=GWR', '#/manual']) {
        await visit(route); await settle(page);
        if (route.startsWith('#/tables/')) {
          await page.locator('[data-tab="rows"]').click();
          assert((await page.locator('.ob-detail-rows tbody tr').count()) > 0, 'The field table must be loaded');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}/${route}: catalog page overflow`);
      }
    }
    for (const [width, height] of [[320, 568], [390, 844], [844, 390], [768, 1024], [1024, 768], [1280, 600], [390, 280]]) {
      await page.setViewportSize({ width, height }); await visit('#/objects'); await open();
      await record(`print-${width}-${height}`);
      await page.locator('.ob-export-tools-panel').evaluate(el => { el.open = true; });
      await page.locator('#diagram-scope-panel').evaluate(el => { el.open = true; });
      await settle(page); await record(`print-open-${width}-${height}`);
      if (check) {
        await page.locator('.ob-export-dialog').evaluate(el => { el.scrollTop = el.scrollHeight; }); await settle(page);
        const footer = await page.locator('.ob-export-dialog > .ob-footer').boundingBox();
        assert(footer.y + footer.height <= height + 1 && footer.y >= 0, 'Footer is reachable by scrolling');
        await record(`print-scrolled-${width}-${height}`);
      }
      await page.locator('.ob-export-tools-panel').evaluate(el => { el.open = false; });
      await page.locator('[data-diagram-action="filters"]').click(); await record(`print-filter-${width}-${height}`);
      await page.keyboard.press('Escape');
      await page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
    }
    await page.setViewportSize({ width: 390, height: 844 }); await visit('#/objects'); await open();
    await page.locator('[data-diagram-action="filters"]').click(); await page.locator('#diagram-filter-find').focus();
    await page.evaluate(() => {
      window.reviewFilter = document.activeElement;
      Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => 280 });
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, get: () => 24 });
      visualViewport.dispatchEvent(new Event('resize')); visualViewport.dispatchEvent(new Event('scroll'));
    });
    await settle(page); await record('print-keyboard');
    if (check) {
      assert(await page.evaluate(() => document.activeElement === window.reviewFilter && window.reviewFilter.isConnected), 'Keyboard fitting preserves the focused input');
      await page.locator('#diagram-filter-find').fill('Status');
      await page.locator('[data-diagram-facet="status"] input').first().check();
      await page.locator('#diagram-settings-form [type="submit"]').tap();
      assert.equal(await page.locator('#diagram-popover:popover-open').count(), 0);
      await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event('resize')); });
      await settle(page);
      await choose('#diagram-language', 'fr'); await settle(page);
      await page.setViewportSize({ width: 320, height: 568 }); await settle(page);
      await record('print-french-320');
      await page.locator('[data-diagram-action="filters"]').tap(); await record('print-french-filters');
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 1280, height: 390 }); await settle(page);
      await record('print-short-laptop');
      await page.setViewportSize({ width: 1600, height: 1000 }); await settle(page);
      assert.equal(await page.locator('.ob-export-dialog.is-compact').count(), 0);
      assert.equal(await page.locator('#diagram-language').inputValue(), 'fr');
      assert((await page.evaluate(() => Object.values(printTest.settings.filters).flat().length)) > 0, 'Rotation/language changes preserve filters');
    }
    assert.deepEqual(test.errors, []);
    console.log(check ? `PASS: 18 catalog layouts and ${report.length} responsive print states; touch targets, scrolling, keyboard viewport, Apply/Cancel and retained language/filters` : JSON.stringify(report.map(({ name, canvas, footer, small, popover }) => ({ name, canvas: canvas?.height, bottom: footer?.bottom, small: small.map(r => r.name), popoverBottom: popover?.bottom }))));
  } finally {
    fs.writeFileSync(path.join(output, `print-mobile-${check ? 'after' : 'before'}.json`), JSON.stringify(report, null, 2));
    await test.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
