/* Measured contrast of current views/states; REPORT_ONLY=1 records the baseline. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const { installContrast } = require('./contrast-helpers.cjs');
const server = createServer();
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const base = `http://127.0.0.1:${server.address().port}/`;
    const report = { views: [], states: [], focus: [], errors: [] };
    page.on('pageerror', error => report.errors.push(error.message));
    const dir = path.join(process.env.TEMP || '/tmp', 'oblique-contrast-review'); fs.mkdirSync(dir, { recursive: true });
    const phase = process.env.REPORT_ONLY ? 'before' : 'after';
    const visit = async (hash, tab) => {
      await page.goto(base + hash); await page.locator('#page-content').waitFor();
      if (hash === '#/api') await page.locator('.swagger-ui .opblock').first().waitFor();
      if (tab) await page.click(`[data-tab="${tab}"]`);
      await page.evaluate(installContrast); await settle(page);
    };
    const scan = async name => report.views.push({ name, ...await page.evaluate(() => window.contrast.scan()) });
    const sample = async (name, selector, property = 'color', threshold = 4.5, pseudo = null) => {
      const result = await page.locator(selector).first().evaluate((el, { property, pseudo }) => {
        const css = getComputedStyle(el, pseudo);
        return window.contrast.measure(el, css[property], pseudo ? Number(css.opacity) : 1);
      }, { property, pseudo });
      report.states.push({ name, threshold, ...result });
    };
    const focus = async (name, selector) => {
      await page.keyboard.press('Shift');
      await page.locator(selector).first().evaluate(el => el.focus({ preventScroll: true }));
      await page.waitForTimeout(350); // Let Swagger's existing 300 ms button transition finish.
      report.focus.push({ name, ...await page.locator(selector).first().evaluate(el => {
        const css = getComputedStyle(el), token = getComputedStyle(document.documentElement).getPropertyValue('--ob-color-focus').trim();
        const probe = document.createElement('i'); probe.style.color = token; el.appendChild(probe);
        const color = getComputedStyle(probe).color; probe.remove();
        const outlined = css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0;
        return { focused: el.matches(':focus-visible'), shadow: css.boxShadow, outline: css.outlineStyle, outlineColor: css.outlineColor, color,
          indicator: css.boxShadow.includes(color) || outlined,
          ratio: window.contrast.measure(el, outlined ? css.outlineColor : color).ratio };
      }) });
    };
    const routes = [['#/', null], ['#/objects', null], ['#/objects?view=table', null], ['#/objects/gebaeude', null], ['#/objects/gebaeude', 'rows'], ['#/objects/gebaeude', 'relations'], ['#/objects/gebaeude', 'history'], ['#/search?q=Geb%C3%A4ude', null], ['#/manual', null], ['#/tables/t-gwr-gebaeude/fields/EGID', null], ['#/api', null]];
    for (const width of [390, 768, 1440, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [route, tab] of routes) {
        await visit(route, tab); await scan(`${width} ${route} ${tab || ''}`);
        if (width === 390 && (route === '#/' || route === '#/api')) {
          await page.screenshot({ path: path.join(dir, `${phase}-mobile-${route === '#/' ? 'home' : 'api'}.png`) });
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await visit('#/');
    await sample('KPI supporting label / default', '.ob-kpi-unit');
    await page.locator('.ob-kpi').first().hover();
    await sample('KPI supporting label / hover', '.ob-kpi-unit');
    await sample('Resize grip / idle', '#sidebar-resizer', 'borderLeftColor', 3, '::before');
    await sample('Search placeholder', '#search-input', 'color', 4.5, '::placeholder');
    await sample('Input boundary', '#search-input', 'borderTopColor', 3);
    await page.locator('.ob-table-sort').nth(1).hover();
    await page.waitForTimeout(150); // Complete the existing 100 ms opacity transition.
    await sample('Unsorted column arrow / hover', '.ob-table-sort:hover .ob-table-sort-icon', 'color', 3);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await settle(page);
    await sample('Footer supporting text', '.ob-footer-meta');
    await visit('#/manual');
    await page.evaluate(() => window.scrollTo(0, 1800)); await settle(page);
    await page.locator('#back-to-top').waitFor({state:'visible'});
    await focus('Back to top', '#back-to-top');
    await page.screenshot({ path: path.join(dir, phase + '-home-focus.png') });
    await visit('#/systems/gwr', 'relations');
    await sample('Relationship connector', '.ob-graph-line', 'stroke', 3);
    await sample('Relationship count', '.ob-graph-count');
    await focus('Selected graph tool', '[data-action="graph-pan"]');
    await page.screenshot({ path: path.join(dir, phase + '-diagram.png') });
    await visit('#/objects');
    await page.locator('[data-menu="actions"]').click(); await scan('Export menu');
    await page.locator('[data-menu="actions"]').click();
    await page.locator('[data-action="help-toggle"]').first().click(); await scan('Help popover');
    await visit('#/api');
    await sample('API version badge', '.info .title small pre');
    await sample('API specification badge', '.info .title small.version-stamp pre');
    await sample('API documentation link', '.info a');
    await sample('API authorization button', '.btn.authorize');
    await sample('API authorization icon', '.authorization__btn svg', 'fill', 3);
    await sample('API filter boundary', '.operation-filter-input', 'borderTopColor', 3);
    await sample('API method badge', '.opblock-summary-method');
    await focus('API authorization button', '.btn.authorize');
    await page.screenshot({ path: path.join(dir, phase + '-api-overview.png') });
    await page.locator('.opblock-summary-control').first().click(); await settle(page);
    await scan('API expanded operation');
    await page.locator('.opblock-summary-control').nth(1).click(); await settle(page);
    await scan('API required path parameter');
    await sample('API required label', '.parameter__name.required', 'color', 4.5, '::after');
    await sample('API parameter location', '.parameter__in');
    const number = page.locator('.microlight span').filter({ hasText: /^\d+$/ }).first();
    report.states.push({ name: 'API example number', threshold: 4.5, ...await number.evaluate(el => window.contrast.measure(el)) });
    await focus('API operation disclosure', '.opblock-summary-control');
    await page.screenshot({ path: path.join(dir, phase + '-api.png') });
    // Populated source models exercise the vendor's type/constraint labels.
    await sample('API expand schema control', '.json-schema-2020-12-expand-deep-button');
    const schemas = page.locator('.models .json-schema-2020-12-expand-deep-button');
    assert(await schemas.count(), 'Current API must render schema controls');
    await schemas.evaluateAll(els => els.forEach(el => el.click()));
    await settle(page); await scan('API all schemas expanded');
    await sample('API schema format badge', '.json-schema-2020-12__constraint--string');
    await sample('API schema required marker', '.json-schema-2020-12-property--required > .json-schema-2020-12:first-of-type > .json-schema-2020-12-head .json-schema-2020-12__title', 'color', 4.5, '::after');
    await page.locator('.btn.authorize').first().click(); await settle(page);
    await scan('API authorization dialog');
    await focus('API dialog authorization button', '.dialog-ux .btn.authorize');
    const failures = [...report.views.flatMap(view => view.failures.map(f => ({ view: view.name, ...f }))), ...report.states.filter(s => s.ratio < s.threshold)];
    fs.writeFileSync(path.join(dir, phase + '.json'), JSON.stringify(report, null, 2));
    const distinct = [...new Map(failures.map(f => [[f.selector || f.name, f.foreground, f.background].join('|'), f])).values()];
    console.log(JSON.stringify({ views: report.views.length, samples: report.views.reduce((n, v) => n + v.samples, 0), states: report.states.map(s => ({name:s.name,ratio:+s.ratio.toFixed(3),threshold:s.threshold})), failures: distinct, focus: report.focus, errors: report.errors }, null, 2));
    if (!process.env.REPORT_ONLY) {
      assert.deepEqual(failures, [], 'Measured text/essential graphics below the contrast threshold');
      assert(report.focus.every(f => f.focused && f.indicator && f.ratio >= 3), 'Focus must remain visible and contrasting despite elevation or selected styles');
      assert.deepEqual(report.errors, []);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
