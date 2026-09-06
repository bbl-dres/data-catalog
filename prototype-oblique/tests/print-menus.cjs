/* Print uses the catalog menu appearance without changing selection or form behavior. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');
(async () => {
  const test = await workspace(), { page, visit, open, choose, settle, output, clearSelection } = test;
  const trigger = selector => page.locator(selector).locator('..').locator(':scope > button');
  const visual = locator => locator.evaluate(el => {
    const css = getComputedStyle(el);
    return [css.height, css.padding, css.border, css.borderRadius, css.fontSize, css.fontWeight, css.gap,
      getComputedStyle(el.querySelector('.ob-icon-chevron_down')).maskImage];
  });
  try {
    await visit('#/objects');
    const mainStyle = await visual(page.locator('[data-menu="group"]'));
    const mainFooter = await page.locator('#footer').innerHTML();
    await open();
    const values = selector => page.locator(selector).evaluate(el => [...el.options].filter(option => !option.hidden).map(option => option.value));
    assert.deepEqual(await values('[data-diagram-setting="orientation"]'), ['portrait', 'landscape']);
    assert.deepEqual(await values('[data-diagram-setting="paper"]'), ['A4', 'A3', 'A2', 'A1', 'A0']);
    assert.deepEqual(await values('#diagram-zoom-mode'), ['fit', 'width', '50', '75', '100', '150', '200']);
    await choose('[data-diagram-setting="orientation"]', 'landscape');
    assert.deepEqual(await values('[data-diagram-setting="orientation"]'), ['portrait', 'landscape'], 'Selection never reorders options');
    assert.equal(await page.locator('.ob-export-page-tools, .ob-export-selection-actions, .ob-export-footer, #diagram-page').count(), 0);
    assert.equal(await page.locator('.ob-export-header [data-diagram-action="close"]').count(), 1);
    assert.equal(await page.locator('.ob-export-dialog > .ob-footer').innerHTML(), mainFooter);
    for (const action of ['document', 'columns', 'filters']) {
      assert.equal(await page.locator(`[data-diagram-action="${action}"] .ob-icon:not(.ob-icon-chevron_down)`).count(), 0);
    }
    for (const setting of ['paper', 'orientation']) {
      assert.equal(await trigger(`[data-diagram-setting="${setting}"]`).locator('.ob-icon:not(.ob-icon-chevron_down)').count(), 0);
    }
    assert(await page.locator('.ob-export-filterbar [data-diagram-action="reset-filters"]').isHidden());
    const footerStyle = selector => page.locator(selector).evaluate(el => {
      const css = getComputedStyle(el); return [css.fontSize, css.color, css.backgroundColor, css.padding];
    });
    assert.deepEqual(await footerStyle('.ob-export-dialog > .ob-footer'), await footerStyle('#footer'));
    assert.deepEqual(await visual(trigger('[data-diagram-setting="groupBy"]')), mainStyle);
    for (const [width, language] of [[1600, 'de'], [1024, 'fr'], [390, 'it'], [320, 'en']]) {
      await page.setViewportSize({ width, height: 740 }); await settle(page);
      await choose('#diagram-language', language); await settle(page);
      assert.equal(await page.locator('.ob-export-dialog > .ob-footer').innerHTML(), mainFooter, 'Document language does not change the app footer');
      await page.locator('.ob-export-tools-panel').evaluate(el => { el.open = true; });
      const zoom = trigger('#diagram-zoom-mode');
      await zoom.focus(); await page.keyboard.press('ArrowDown');
      const menu = page.locator('.ob-menu--select');
      assert(await menu.isVisible());
      await page.keyboard.press('End');
      assert.equal(await page.locator(':focus').innerText(), '200%');
      await page.keyboard.press('Home');
      assert.equal(await page.locator(':focus').getAttribute('data-select-option'), '0');
      const r = await menu.boundingBox();
      assert(r.x >= 0 && r.x + r.width <= width && r.y >= 0 && r.y + r.height <= 740);
      assert.equal(await menu.evaluate(el => el.scrollWidth > el.clientWidth), false);
      await page.screenshot({ path: path.join(output, `print-menus-${width}.png`) });
      await page.keyboard.press('Escape');
      assert.equal(await menu.count(), 0); assert(await zoom.evaluate(el => el === document.activeElement));
      assert(await page.locator('.ob-export-dialog').isVisible());
      await choose('#diagram-zoom-mode', '100');
      assert.equal(await trigger('#diagram-zoom-mode').innerText(), '100%');
      await page.locator('[data-diagram-action="zoom-in"]').click();
      assert.equal(await trigger('#diagram-zoom-mode').innerText(), '110%');
    }
    await page.setViewportSize({ width: 1600, height: 1000 }); await settle(page);
    await choose('#diagram-zoom-mode', '100');
    await trigger('#diagram-zoom-mode').click();
    await page.locator('#diagram-canvas').evaluate(el => { el.scrollTop = el.scrollHeight; }); await settle(page);
    assert.equal(await page.locator('.ob-menu--select [aria-checked="true"]').innerText(), '100%', 'Scrolling preserves the open zoom menu');
    await page.keyboard.press('Escape');
    await trigger('[data-diagram-setting="paper"]').click();
    await page.keyboard.press('a'); assert((await page.locator(':focus').innerText()).startsWith('A'));
    await page.keyboard.press('Tab'); assert.equal(await page.locator('.ob-menu--select').count(), 0);
    await trigger('[data-diagram-setting="paper"]').click();
    await page.locator('#diagram-export-title').click(); await page.locator('.ob-menu--select').waitFor({ state: 'detached' });
    await page.locator('[data-diagram-action="document"]').click();
    await choose('[data-diagram-setting="classification"]', 'confidential');
    assert(await page.locator('#diagram-popover').isVisible());
    await trigger('[data-diagram-setting="classification"]').click(); await page.keyboard.press('Escape');
    assert(await page.locator('#diagram-popover').isVisible());
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#diagram-popover:popover-open').count(), 0);
    await clearSelection();
    assert(await trigger('#diagram-zoom-mode').isDisabled());
    await page.locator('.ob-export-empty [data-diagram-action="all"]').click();
    assert.equal(await trigger('#diagram-zoom-mode').isDisabled(), false);
    await page.emulateMedia({ forcedColors: 'active' });
    await trigger('[data-diagram-setting="paper"]').focus(); await page.keyboard.press('ArrowDown');
    assert.notEqual(await page.locator('.ob-menu--select :focus').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    await page.keyboard.press('Escape');
    await page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
    assert.equal(await page.locator('.ob-menu--select').count(), 0);
    assert.equal(await page.locator('footer.ob-footer').count(), 1, 'Closing removes the workspace copy of the shared footer');
    assert.deepEqual(test.errors, []);
    console.log('PASS: catalog/print dropdown styles, four widths/languages, keyboard/typeahead, outside dismissal, nested settings, scrolling, custom zoom, disabled states and high contrast');
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
