/* Layering and floating-surface contracts: every z-index resolves to a layer-map token, anchored popovers share
   one trigger offset and never cover their trigger, and wrapping buttons keep the control height as a minimum. */
const assert = require('node:assert/strict');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace(), { page, visit, open, settle } = test;
  const style = (selector, pseudo) => page.evaluate(([selector, pseudo]) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error('missing ' + selector);
    const css = getComputedStyle(el, pseudo || null);
    return { zIndex: css.zIndex, position: css.position, boxShadow: css.boxShadow, paddingBlock: css.paddingBlock, whiteSpace: css.whiteSpace, className: el.className };
  }, [selector, pseudo]);
  const token = name => page.evaluate(name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)), name);
  const box = selector => page.evaluate(selector => {
    const el = document.querySelector(selector);
    if (!el) throw new Error('missing ' + selector);
    const r = el.getBoundingClientRect();
    return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, height: r.height };
  }, selector);
  const near = (actual, expected, label) => assert(Math.abs(actual - expected) < 0.5, `${label}: ${actual} should be ${expected}`);
  try {
    // Layer map: the tokens and the elements that use them.
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit('#/tables/t-gwr-gebaeude');
    await page.locator('[data-tab="rows"]').click(); await settle(page);
    const z = {};
    for (const name of ['local', 'controls', 'layout', 'widget', 'overlay', 'overlay-top', 'toast']) z[name] = await token('--ob-z-' + name);
    assert.deepEqual(z, { local: 1, controls: 10, layout: 101, widget: 200, overlay: 1005, 'overlay-top': 1010, toast: 1400 });
    for (const [selector, layer] of [['.ob-header', 'layout'], ['.ob-tree-panel', 'controls'], ['.ob-sidebar-resizer', 'controls'], ['.ob-back-to-top', 'widget'], ['.ob-toast-region', 'toast'], ['#loading', 'overlay'], ['.ob-skip-link', 'overlay'], ['.ob-header-search > button', 'local']]) {
      assert.equal(Number((await style(selector)).zIndex), z[layer], selector);
    }
    assert.equal((await style('.ob-sidebar-resizer', '::before')).zIndex, String(z.local), 'sidebar grip');
    assert.equal((await style('.ob-table-scroll', '::after')).zIndex, 'auto', 'edge shadows paint above the in-flow table without a z-index');
    // Focusable scroll regions and controls inside them share the inset ring.
    await page.locator('.ob-table-wrap').first().focus();
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    const ring = await page.evaluate(() => ({ el: document.activeElement.className, shadow: getComputedStyle(document.activeElement).boxShadow }));
    assert.equal(ring.el, 'ob-table-wrap');
    assert.match(ring.shadow, /inset$/);
    // One trigger offset for every floating surface: suggestions, field picker, select menu and print popover.
    const offset = await token('--ob-menu-offset'), inset = await token('--ob-space-sm');
    await visit('#/');
    await page.locator('#search-input').fill('GWR'); await settle(page);
    near((await box('.ob-suggest')).top - (await box('.ob-search-input')).bottom, offset, 'suggestion gap');
    await visit('#/objects?view=table');
    await page.locator('[data-field-picker="objects"]').click(); await settle(page);
    const picker = await box('.ob-field-picker'), pickerTrigger = await box('[data-field-picker="objects"]');
    near(picker.top - pickerTrigger.bottom, offset, 'field picker gap');
    near(picker.right, pickerTrigger.right, 'field picker end alignment');
    for (const button of await page.locator('.ob-choice-popover-actions .ob-button').all()) {
      const css = await button.evaluate(el => ({ ...getComputedStyle(el), height: el.offsetHeight }));
      assert(css.height >= 32 && css.whiteSpace === 'normal' && css.paddingBlock === '4px', 'popover actions wrap and keep the control height');
    }
    await page.keyboard.press('Escape'); await settle(page);
    await visit('#/objects');
    await open();
    assert.equal((await style('.ob-export-header-actions > .ob-export-control > span')).className, 'ob-sr-only', 'hidden captions use the shared class');
    await page.locator('[data-diagram-action="columns"]').click(); await settle(page);
    near((await box('#diagram-popover')).top - (await box('[data-diagram-action="columns"]')).bottom, offset, 'print popover gap');
    await page.evaluate(() => document.querySelector('#diagram-popover').hidePopover()); await settle(page);
    const select = page.locator('.ob-export-toolbar .ob-select-menu > button').first();
    await select.click(); await settle(page);
    near((await box('.ob-menu--select')).top - (await select.evaluate(el => el.getBoundingClientRect().bottom)), offset, 'select menu gap');
    await page.keyboard.press('Escape'); await settle(page);
    // A short viewport caps the popover to the room below and never covers the trigger.
    await page.setViewportSize({ width: 1280, height: 420 }); await settle(page);
    await page.evaluate(() => { const panel = document.querySelector('.ob-export-tools-panel'); if (panel) panel.open = true; });
    await page.locator('[data-diagram-action="columns"]').scrollIntoViewIfNeeded(); await settle(page);
    await page.locator('[data-diagram-action="columns"]').click(); await settle(page);
    const short = await box('#diagram-popover'), shortTrigger = await box('[data-diagram-action="columns"]');
    near(short.top, shortTrigger.bottom + offset, 'short viewport popover below its trigger');
    assert(short.bottom <= 420 - inset + 0.5, `short viewport popover ends inside the viewport (${short.bottom})`);
    await page.evaluate(() => document.querySelector('#diagram-popover').hidePopover()); await settle(page);
    await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
    const download = await style('[data-diagram-action="download"]');
    assert.match(download.className, /ob-button--wrap/);
    assert((await box('[data-diagram-action="download"]')).height >= 44, 'phone download button keeps the touch target');
    await page.locator('[data-diagram-action="close"]').click(); await settle(page);
    // Drawer above its backdrop.
    await visit('#/objects');
    await page.locator('.ob-navigation-toggle').click(); await settle(page);
    assert.equal(Number((await style('.ob-tree-panel.is-mobile-open')).zIndex), z['overlay-top']);
    assert.equal(Number((await style('.ob-drawer-backdrop')).zIndex), z.overlay);
    await page.keyboard.press('Escape'); await settle(page);
    // Account dialog submit wraps with the shared modifier.
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit('#/');
    await page.locator('.ob-auth-trigger').first().click();
    await page.locator('.ob-auth-submit').waitFor();
    const submit = await style('.ob-auth-submit');
    assert.match(submit.className, /ob-button--wrap/);
    assert.equal(submit.whiteSpace, 'normal');
    assert.deepEqual(test.errors, []);
    console.log('layering: ok');
  } finally {
    await test.close();
  }
})();
