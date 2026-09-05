/* Visual regression behaviors: wrapping, control states and high-contrast rendering. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const base = `http://127.0.0.1:${server.address().port}/`;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
    const dir = path.join(process.env.TEMP || '/tmp', 'oblique-design-review');
    fs.mkdirSync(dir, { recursive: true });
    const visit = async (hash, tab) => {
      await page.goto(base + hash); await page.locator('#page-content').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (tab) await page.click(`[data-tab="${tab}"]`);
      await settle(page);
    };
    const paint = selector => page.locator(selector).first().evaluate(el => {
      const css = getComputedStyle(el);
      return { background: css.backgroundColor, border: css.borderColor, color: css.color, cursor: css.cursor,
        height: el.getBoundingClientRect().height, font: css.fontSize, line: css.lineHeight,
        outline: css.outlineStyle, outlineWidth: parseFloat(css.outlineWidth) };
    });

    await visit('#/');
    const disabled = await paint('#search-submit');
    await page.hover('#search-submit');
    assert.deepEqual(await paint('#search-submit'), disabled, 'disabled submit must not react visually to hover');
    await page.screenshot({ path: path.join(dir, 'after-home.png') });
    await visit('#/objects');
    await page.click('[data-menu="actions"]');
    await page.locator('[data-export="xlsx"]').evaluate(el => { el.disabled = true; });
    const before = await paint('[data-export="xlsx"]');
    await page.hover('[data-export="xlsx"]');
    assert.deepEqual(await paint('[data-export="xlsx"]'), before, 'disabled export must not show hover feedback');
    assert.equal(before.cursor, 'default');
    await page.keyboard.press('Escape');

    for (const width of [320, 820, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await visit('#/objects');
      await page.locator('.ob-tile-name').first().evaluate(el => { el.textContent = 'UnbrokenCatalogIdentifier'.repeat(14); });
      await settle(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `long card title overflows at ${width}`);
      assert.equal(await page.locator('.ob-tile').first().evaluate(el => el.scrollWidth > el.clientWidth), false);
      const widths = await page.locator('.ob-tile').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().width)));
      assert(Math.max(...widths) - Math.min(...widths) <= 1, 'tile widths must stay consistent across groups');
    }
    await visit('#/objects');
    await page.screenshot({ path: path.join(dir, 'after-tiles-wide.png') });
    await page.setViewportSize({ width: 740, height: 1000 });
    await visit('#/objects/gebaeude', 'rows');
    const pager = await paint('.ob-page-size select'), sort = await paint('.ob-table-card-sort select');
    for (const key of ['height', 'font', 'border', 'color']) assert.equal(pager[key], sort[key], `select ${key} differs at tablet width`);
    assert(pager.height >= 44); assert.equal(pager.font, '16px');
    await page.setViewportSize({ width: 390, height: 844 });
    await visit('#/tables/t-gwr-gebaeude/fields/EGID');
    const description = await paint('.ob-detail-description');
    assert.equal(description.font, '15px'); assert.equal(description.line, '24px');
    await page.screenshot({ path: path.join(dir, 'after-field-phone.png') });
    console.log('PASS: disabled controls, long labels, equal card widths, consistent selects and reading typography');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await visit('#/objects');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.keyboard.press('Tab'); await page.locator('[data-menu="actions"]').focus();
    const focus = await paint('[data-menu="actions"]');
    assert.equal(focus.outline, 'solid'); assert(focus.outlineWidth >= 2);
    const icon = await paint('.ob-export-icon');
    assert.equal(icon.background, icon.color, 'mask silhouette must follow the system text color');
    assert.notEqual(icon.background, focus.background, 'icon must remain visible against its button');
    const navColors = await page.locator('#main-nav .ob-main-nav-item').evaluateAll(els => els.map(el => getComputedStyle(el).borderBottomColor));
    assert.notEqual(navColors[0], navColors[1], 'active navigation must remain distinguishable');
    await page.screenshot({ path: path.join(dir, 'after-forced-colors.png') });
    await page.locator('#view-tab-tiles').focus();
    assert.equal((await paint('#view-tab-tiles')).outline, 'solid');
    await page.locator('#collection-filter').focus();
    assert.equal((await paint('#collection-filter')).outline, 'solid');
    await page.emulateMedia({ forcedColors: 'none' });
    const touch = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true });
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(base + '#/systems/gwr'); await touch.locator('#tab-relations').click(); await settle(touch);
    const targets = await touch.locator('.ob-graph-group-pager button').evaluateAll(els => els.map(el => {
      const css = getComputedStyle(el); return [parseFloat(css.minWidth), parseFloat(css.minHeight)];
    }));
    assert(targets.length > 0); assert(targets.every(([w, h]) => w >= 44 && h >= 44), 'unscaled graph pager targets must honor touch sizing');
    assert.deepEqual(errors, []);
    console.log('PASS: forced-color icons/focus/navigation, touch pager sizing and clean browser resources');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
