/* Expanded print-tree names, selection and scope must share one row at every width. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace(), { page, visit, open, settle, output } = test;
  const checkRows = async () => {
    const rows = await page.locator('[data-diagram-entity]').evaluateAll(inputs => inputs.map(input => {
      const row = input.closest('.ob-tree-row'), link = row.querySelector('.ob-tree-link'), label = row.querySelector('.ob-tree-label');
      const r = row.getBoundingClientRect(), i = input.getBoundingClientRect(), l = link.getBoundingClientRect(), n = label.getBoundingClientRect();
      return { name: label.textContent, labelWidth: n.width, height: r.height, linkHeight: l.height,
        aligned: Math.abs(i.y + i.height / 2 - l.y - l.height / 2) < 1,
        contained: l.x >= r.x && l.right <= r.right + 1 && i.right <= l.x + 1 };
    }));
    assert(rows.length > 0);
    for (const row of rows) {
      assert(row.name && row.labelWidth >= 80, JSON.stringify(row));
      assert(row.aligned && row.contained && Math.abs(row.height - row.linkHeight) < 1, JSON.stringify(row));
    }
  };
  try {
    for (const [route, branch] of [['#/objects', 'objects:domain:bau'], ['#/systems/gwr', 'tables:system:gwr']]) {
      await page.setViewportSize({ width: 1600, height: 1000 }); await visit(route); await open();
      const toggle = page.locator(`[data-diagram-toggle="${branch}"]`);
      if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
      for (const width of [1600, 1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 }); await settle(page);
        if (!await page.locator('#diagram-scope-panel').evaluate(el => el.open)) await page.locator('#diagram-scope-panel > summary').click();
        await checkRows();
      }
      await page.setViewportSize({ width: 1600, height: 1000 }); await settle(page);
      const before = await page.evaluate(() => window.printTest.layout.entityCount), url = page.url();
      const first = page.locator('[data-diagram-entity]').first();
      const id = await first.getAttribute('data-diagram-entity');
      await first.locator('..').click();
      assert.equal(await page.evaluate(() => window.printTest.layout.entityCount), before - 1);
      assert.equal(page.url(), url, 'Selecting a checkbox must not navigate');
      const checkbox = page.locator(`[data-diagram-entity="${id}"]`);
      await checkbox.focus(); await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => window.printTest.layout.entityCount), before);
      await checkbox.locator('xpath=ancestor::div[contains(@class,"ob-tree-row")]').locator('.ob-tree-link').click();
      assert.equal(await page.evaluate(() => window.printTest.layout.entityCount), 1, 'The name still opens the entity export scope');
      await checkRows();
      await page.screenshot({ path: path.join(output, route === '#/objects' ? 'print-tree-objects.png' : 'print-tree-tables.png') });
      await page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
    }
    assert.deepEqual(test.errors, []);
    console.log('PASS: expanded object/field trees retain visible names and aligned controls at 320–1600px; mouse/keyboard selection and scope clicks remain independent');
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
