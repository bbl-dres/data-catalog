/* App-wide component consistency; source fixtures and browser state remain local. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');
const { installContrast } = require('./contrast-helpers.cjs');

(async () => {
  const test = await workspace(), { page, visit, open, settle, output, clearSelection } = test;
  const phase = process.env.REPORT_ONLY ? 'before' : 'after';
  const shot = name => page.screenshot({ path: path.join(output, `${phase}-polish-${name}.png`) });
  const buttonStates = async selector => {
    const button = page.locator(selector);
    const sample = () => button.evaluate(el => {
      const css = getComputedStyle(el);
      return { background: css.backgroundColor, color: css.color, border: css.borderColor, opacity: css.opacity, contrast: window.contrast.measure(el).ratio };
    });
    await page.evaluate(installContrast);
    await page.mouse.move(0, 0);
    const normal = await sample();
    await button.hover(); const hover = await sample();
    await page.mouse.down();
    const active = await sample();
    await page.mouse.move(0, 0); await page.mouse.up();
    for (const state of [normal, hover, active]) assert(state.contrast >= 4.5, JSON.stringify(state));
    assert.notEqual(normal.background, hover.background);
    assert.notEqual(hover.background, active.background);
    return [normal, hover, active];
  };
  const marker = selector => page.locator(selector).evaluate(el => {
    const css = getComputedStyle(el, '::before');
    return { width: css.width, height: css.height, mask: css.maskImage, transform: css.transform };
  });
  try {
    for (const [name, route, tab] of [
      ['home', '#/'], ['objects', '#/objects'], ['tables', '#/tables?view=table'], ['refs', '#/refs'], ['products', '#/products'], ['apis', '#/apis'],
      ['domain', '#/domains/bau?tab=overview'], ['system', '#/systems/gwr'], ['object', '#/objects/gebaeude'],
      ['fields', '#/tables/t-gwr-gebaeude', 'rows'], ['field', '#/tables/t-gwr-gebaeude/fields/EGID'],
      ['attribute', '#/objects/gebaeude/attributes/egid'], ['relations', '#/objects/gebaeude', 'relations'],
      ['code-list', '#/refs/r-gwr-kat'], ['product', '#/products/p-gebaeudebestand'], ['api-entry', '#/apis/api-energie'], ['history', '#/objects/gebaeude', 'history'],
      ['search', '#/search?q=GWR'], ['manual', '#/manual'], ['api', '#/api'], ['empty', '#/objects?filter=NoMatchingCatalogEntry']
    ]) {
      await visit(route);
      if (tab) await page.locator(`[data-tab="${tab}"]`).click();
      if (name === 'api') await page.locator('.swagger-ui .opblock').first().waitFor();
      await settle(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name);
      await shot(name);
    }
    await visit('#/');
    await page.locator('#search-input').fill('GWR');
    await page.keyboard.press('Escape');
    const searchStates = process.env.REPORT_ONLY ? null : await buttonStates('#search-submit');
    await page.locator('#search-submit').hover(); await shot('search-action');
    if (!process.env.REPORT_ONLY) {
      for (const width of [360, 1600]) {
        await page.setViewportSize({ width, height: 1000 });
        await visit('#/search?q=GWR');
        await page.locator('#search-options-toggle').click();
        const panels = await page.locator('.ob-search-options-panel, .ob-search-answer').evaluateAll(els => els.map(el => {
          const css = getComputedStyle(el);
          return [css.padding, css.border, css.borderRadius, css.backgroundColor];
        }));
        assert.equal(panels.length, 2);
        assert.deepEqual(panels[0], panels[1], `panel styles at ${width}`);
        assert.equal(panels[0][0], width === 360 ? '16px' : '24px');
        const answer = await page.locator('.ob-search-answer').boundingBox();
        const table = await page.locator('.ob-table-region').boundingBox();
        assert(Math.abs(answer.width - table.width) < 1, `answer/table width at ${width}`);
        await shot(`search-panels-${width}`);
      }
    }
    await visit('#/objects/gebaeude'); await shot('metadata');
    assert.deepEqual(await page.locator('.ob-detail-facts h2').allTextContents(), ['Kerndaten', 'Schutz und Datenschutz', 'System']);
    assert(await page.locator('.ob-system-facts dl').isVisible());
    await visit('#/objects?filter=NoMatchingCatalogEntry');
    const emptyType = await page.locator('.ob-empty-title').evaluate(el => {
      const css = getComputedStyle(el); return [css.fontSize, css.fontWeight, css.lineHeight, css.marginBottom];
    });
    await visit('#/objects/gebaeude');
    await open();
    if (!process.env.REPORT_ONLY) {
      assert.deepEqual(await buttonStates('[data-diagram-action="download"]'), searchStates, 'primary action states');
      await page.setViewportSize({ width: 960, height: 1000 }); await settle(page);
      await page.locator('.ob-export-tools-panel').evaluate(el => { el.open = true; document.getElementById('diagram-scope-panel').open = true; });
      await settle(page);
      assert.deepEqual(await marker('#diagram-scope-panel > summary'), await marker('.ob-export-tools-panel > summary'), 'print disclosure markers in the same state');
      await page.setViewportSize({ width: 1600, height: 1000 }); await settle(page);
      const checkSize = await page.locator('.ob-export-tree-check input').first().evaluate(el => [el.offsetWidth, el.offsetHeight]);
      await page.locator('[data-diagram-action="filters"]').click();
      await page.locator('[data-diagram-action="all-facets"]').click();
      assert.deepEqual(await page.locator('.ob-export-facet-list input[type="checkbox"]:visible').first().evaluate(el => [el.offsetWidth, el.offsetHeight]), checkSize);
      await page.keyboard.press('Escape');
    }
    await clearSelection(); await shot('empty-print');
    if (!process.env.REPORT_ONLY) {
      assert.deepEqual(await page.locator('.ob-export-empty .ob-empty-title').evaluate(el => {
        const css = getComputedStyle(el); return [css.fontSize, css.fontWeight, css.lineHeight, css.marginBottom];
      }), emptyType);
      const download = page.locator('[data-diagram-action="download"]');
      assert(await download.isDisabled());
      const colors = () => download.evaluate(el => { const css = getComputedStyle(el); return [css.color, css.backgroundColor, css.opacity]; });
      await page.mouse.move(0, 0); const disabled = await colors();
      await download.hover(); assert.deepEqual(await colors(), disabled);
      assert.equal(disabled[2], '1');
      await page.setViewportSize({ width: 360, height: 740 }); await settle(page);
      await shot('empty-print-phone');
      const scopeLabel = page.locator('.ob-export-chip--scope > span');
      assert.equal(await scopeLabel.evaluate(el => el.getClientRects().length), 1, 'scope caption stays on one line');
      assert.equal(await page.locator('.ob-export-dialog').evaluate(el => el.scrollWidth > el.clientWidth), false);
      await page.locator('.ob-export-empty [data-diagram-action="all"]').click();
      assert.equal(await page.locator('.ob-export-empty').count(), 0);
      await page.setViewportSize({ width: 1600, height: 1000 }); await settle(page);
    }
    await page.locator('[data-diagram-action="document"]').click(); await shot('print-document');
    await page.keyboard.press('Escape');
    await page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
    assert.deepEqual(test.errors, []);
    console.log(`PASS: ${phase} whole-app visual inventory (21 views), shared action states/contrast, panels, disclosures, checkbox sizing and empty-state recovery`);
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
