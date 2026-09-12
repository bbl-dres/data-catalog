/* Loading feedback under delayed/failed requests, including mobile and reduced motion. */
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();

async function defer(page, pattern) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(pattern, async route => { await gate; await route.continue(); });
  return release;
}

async function assertCentered(page, selector, bounds) {
  const box = await page.locator(selector).boundingBox();
  assert(box, `${selector} must be visible`);
  assert(Math.abs(box.x + box.width / 2 - (bounds.x + bounds.width / 2)) < 2, 'horizontal center');
  assert(Math.abs(box.y + box.height / 2 - (bounds.y + bounds.height / 2)) < 2, 'vertical center');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const base = `http://127.0.0.1:${server.address().port}/`;
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    const release = await defer(page, '**/data/config.json');
    try {
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const loading = page.locator('#loading');
      await loading.waitFor();
      assert.equal(await loading.getAttribute('role'), 'status');
      assert.equal(await page.locator('#main').getAttribute('aria-busy'), 'true');
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
        await page.setViewportSize(viewport);
        await settle(page);
        await assertCentered(page, '#loading .ob-loading-content', { x: 0, y: 0, ...viewport });
      }
      assert.equal(await loading.locator('.ob-spinner').evaluate(el => getComputedStyle(el).animationName), 'ob-spin');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await loading.locator('.ob-spinner').evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.emulateMedia({ forcedColors: 'active' });
      const colors = await loading.locator('.ob-spinner').evaluate(el => {
        const css = getComputedStyle(el);
        return [css.borderTopColor, css.borderBottomColor];
      });
      assert.notEqual(colors[0], colors[1], 'spinner retains its visible segment in high contrast');
      await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' });
      await page.screenshot({ path: path.join(os.tmpdir(), 'catalog-loading-mobile.png') });
    } finally { release(); }
    await page.locator('.ob-kpi').first().waitFor();
    assert(await page.locator('#loading').isHidden());
    assert.equal(await page.locator('#main').getAttribute('aria-busy'), 'false');
    console.log('PASS: centered startup feedback at 320, 390 and 1440px, reduced motion and high contrast');

    await page.unroute('**/data/config.json');
    await page.route('**/data/config.json', route => route.fulfill({ status: 503, body: '' }));
    await page.reload();
    await page.locator('#main .ob-empty').waitFor();
    assert(await page.locator('#loading').isHidden());
    assert.equal(await page.locator('#main').getAttribute('aria-busy'), 'false');
    await page.unroute('**/data/config.json');
    await page.reload();
    await page.locator('.ob-kpi').first().waitFor();
    console.log('PASS: startup failure clears loading feedback');

    await page.setViewportSize({ width: 1440, height: 900 });
    const releaseSpec = await defer(page, '**/data/swagger.json');
    try {
      await page.goto(base + '#/api');
      await page.locator('#swagger-ui .ob-spinner').waitFor();
      await page.waitForFunction(() => typeof window.SwaggerUIBundle === 'function');
      const bounds = await page.locator('#swagger-ui > .ob-loading').boundingBox();
      await assertCentered(page, '#swagger-ui .ob-loading-content', bounds);
      await page.evaluate(() => { DK.app.render(); DK.app.render(); });
      assert.equal(await page.locator('#swagger-ui .ob-spinner').count(), 1);
      await page.screenshot({ path: path.join(os.tmpdir(), 'catalog-loading-api.png') });
    } finally { releaseSpec(); }
    await page.locator('#swagger-ui .opblock').first().waitFor();
    assert.equal(await page.locator('#swagger-ui .ob-loading').count(), 0);
    assert.equal(await page.locator('.ob-swagger-content').getAttribute('aria-busy'), 'false');
    await page.unroute('**/data/swagger.json');
    console.log('PASS: API spinner remains through the specification request and clears after rendering');

    await page.route('**/data/swagger.json', route => route.fulfill({ status: 503, body: '' }));
    await page.reload();
    await page.locator('#swagger-ui .ob-empty').waitFor();
    assert.equal(await page.locator('#swagger-ui .ob-loading').count(), 0);
    await page.unroute('**/data/swagger.json');
    await page.evaluate(() => DK.app.render());
    await page.locator('#swagger-ui .opblock').first().waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: API failure clears the spinner and permits retry');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
