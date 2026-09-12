/* Summary tiles must preserve entity metadata without rendering field rows. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace(), { page, choose, visit, open, settle, download, output } = test;
  try {
    await visit('#/objects'); await open();
    await choose('[data-diagram-setting="layout"]', 'tiles');
    assert(await page.locator('#diagram-columns-host').isVisible());
    assert.equal(await page.locator('#diagram-sheets [data-row-id]').count(), 0);
    assert((await page.locator('#diagram-selection-hint').innerText()).includes('nicht aufgelistet'));
    for (const key of ['groupBy']) {
      assert(await page.locator(`[data-diagram-setting="${key}"]`).locator('..').locator('.ob-icon').first().isVisible());
    }
    for (const action of ['document', 'filters']) {
      const trigger = page.locator(`[data-diagram-action="${action}"]`);
      assert.equal(await trigger.locator('.ob-icon').count(), 1, 'Only the dropdown chevron remains');
      await trigger.click(); assert(await page.locator('#diagram-popover').isVisible());
      await page.keyboard.press('Escape');
    }
    await choose('[data-diagram-setting="groupBy"]', 'none');
    for (const width of [1600, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 }); await settle(page);
      await page.locator('.ob-export-tools-panel').evaluate(el => { el.open = true; });
      const geometry = await page.locator('.ob-export-layout').evaluate(el => {
        const elements = [...el.querySelectorAll('button')], buttons = elements.map(button => button.getBoundingClientRect());
        return {
          contained: buttons.every(r => r.x >= 0 && r.right <= innerWidth),
          horizontal: buttons.every(r => r.top === buttons[0].top), count: buttons.length,
          joined: buttons.every((r, i) => !i || Math.abs(r.left - buttons[i - 1].right) <= 1),
          icons: elements.every(button => button.querySelectorAll('.ob-icon[aria-hidden="true"]').length === 1),
          activeShadow: getComputedStyle(el.querySelector('[aria-pressed="true"]')).boxShadow
        };
      });
      if (!geometry.contained) await page.screenshot({ path: path.join(output, 'print-menu-overflow.png') });
      assert(geometry.contained && geometry.horizontal && geometry.count === 2, JSON.stringify({ width, geometry }));
      assert(geometry.joined && geometry.icons && geometry.activeShadow === 'none', JSON.stringify({ width, geometry }));
    }
    await page.setViewportSize({ width: 1600, height: 1000 }); await settle(page);
    await choose('#diagram-language', 'fr'); await settle(page);
    assert.equal(await page.locator('[data-diagram-layout][aria-pressed="true"]').getAttribute('data-diagram-layout'), 'tiles');
    assert((await page.locator('#diagram-selection-hint').innerText()).includes('Tuiles'));
    await choose('#diagram-language', 'de'); await settle(page);
    await download('objects-tiles');
    await page.screenshot({ path: path.join(output, 'print-tiles.png') });

    await page.locator('[data-diagram-toggle="objects:domain:bau"]').click();
    await page.locator('[data-diagram-entity]').first().locator('..').click();
    assert.equal(await page.evaluate(() => printTest.layout.entityCount), 24);
    await page.locator('[data-diagram-entity]').first().check();
    const leaf = page.locator('[data-diagram-entity]').first();
    await leaf.locator('xpath=ancestor::div[contains(@class,"ob-tree-row")]').locator('.ob-tree-link').click();
    assert.equal(await page.evaluate(() => printTest.layout.pages.flat().length), 1);
    assert.equal(await page.locator('#diagram-sheets [data-row-id]').count(), 0, 'Single-entity scope stays a tile');
    assert(await page.locator('#diagram-columns-host').isVisible());
    await choose('[data-diagram-setting="layout"]', 'list');
    assert(await page.locator('#diagram-columns-host').isVisible());
    assert((await page.locator('#diagram-sheets [data-row-id]').count()) > 0, 'Switching back restores attributes');
    await page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
    await visit('#/systems/gwr'); await open();
    await choose('[data-diagram-setting="layout"]', 'tiles');
    await download('gwr-tiles');

    const matrix = await page.evaluate(async () => {
      const measure = DK.pdf.measure(await DK.pdf.load()), problems = []; let count = 0;
      for (const kind of DK.diagram.kinds) for (const language of ['de', 'fr', 'it', 'en']) {
        const snapshot = DK.diagram.snapshot({ kind }, { kind, isList: true, title: 'Summary', groups: [{ items: DK.data.list(kind) }] }, language);
        for (const paper of Object.keys(DK.diagram.papers)) for (const orientation of ['portrait', 'landscape']) {
          const settings = { ...DK.diagram.defaults(snapshot), layout: 'tiles', paper, orientation };
          const layout = DK.diagram.layout(snapshot, settings, measure), cards = layout.pages.flat(); count++;
          if (cards.length !== snapshot.entities.length || new Set(cards.map(c => c.entity.id)).size !== cards.length) problems.push('Entity lost/duplicated');
          if (new Set(cards.map(c => c.width)).size !== 1) problems.push('Inconsistent tile widths');
          for (const page of layout.pages) for (const card of page) {
            if (card.rows.length) problems.push('Unexpected detail rows');
            const selected = DK.diagram.selectedFields(snapshot, settings, true).filter(f => !['name', 'description', 'status'].includes(f.id) && f.type !== 'number');
            if (card.facts.length !== selected.length) problems.push('Missing selected metadata');
            if (card.description.join('').replace(/\s/g, '') !== (card.entity.description || '—').replace(/\s/g, '')) problems.push('Description lost');
            if (card.y < layout.bodyTop || card.y + card.height > layout.bodyBottom + .1 || card.x + card.width > layout.width - layout.margin + .1) problems.push('Out of bounds');
            for (const other of page) if (card !== other && card.x < other.x + other.width - 1 && card.x + card.width > other.x + 1 && card.y < other.y + other.height - 1 && card.y + card.height > other.y + 1) problems.push('Overlapping cards');
          }
        }
      }
      const { snapshot, settings } = printTest;
      if (DK.diagram.layout(snapshot, { ...settings, selected: [], groupBy: 'none' }, measure).pages.length) problems.push('Empty selection has pages');
      return { count, problems: [...new Set(problems)] };
    });
    assert.deepEqual(matrix.problems, []);
    assert.deepEqual(test.errors, []);
    console.log(`PASS: ${matrix.count} tile layouts, icons at 320–1600px, translations, selection, single tiles, detail restoration and two actual PDFs`);
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
