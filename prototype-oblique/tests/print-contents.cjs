const assert = require('node:assert/strict');
const { workspace } = require('./print-test-helpers.cjs');
(async () => {
  const test = await workspace(), { page, visit, open, choose, settle, scrollToPage, download } = test;
  try {
    await visit('#/domains/bau?tab=table'); await open();
    const url = page.url();
    assert.deepEqual(await page.evaluate(() => printTest.layout.overview.flat().filter(row => !row.indent).map(row => row.id)), ['summary', 'details'], 'Ungrouped list has two main sections');
    assert.equal(await page.evaluate(() => printTest.layout.overview.flat().filter(row => row.indent).length), 9, 'Each business object has its own second-level entry');
    const contents = page.locator('[data-diagram-page="0"]');
    assert((await contents.innerText()).includes('Inhaltsverzeichnis'));
    for (const [id, keyboard] of [['summary', false], ['details', true], ['entity:gebaeude', true]]) {
      await scrollToPage(0);
      const link = contents.locator(`[data-contents-group="${id}"]`);
      const target = Number(await link.getAttribute('data-diagram-target-page'));
      if (keyboard) { await link.focus(); await page.keyboard.press('Enter'); } else await link.click();
      await settle(page);
      assert.equal(page.url(), url, 'Preview navigation must not alter the catalog route');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.diagramPage), String(target));
      assert((await page.locator('#diagram-summary').innerText()).includes(`Seite ${target + 1} von`));
      const heading = await page.locator(`[data-diagram-page="${target}"]`).innerText();
      assert(heading.includes(id === 'summary' ? 'Einträge und Kontext' : 'Attribute'));
    }
    await choose('[data-diagram-setting="groupBy"]', 'resp');
    await scrollToPage(0);
    const group = contents.locator('[data-contents-group^="objects:resp:"]').first();
    const target = Number(await group.getAttribute('data-diagram-target-page'));
    await group.click(); await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.diagramPage), String(target));
    await download('linked-contents');
    await choose('#diagram-language', 'fr');
    await scrollToPage(0);
    assert((await contents.innerText()).includes('Table des matières'));
    await contents.locator('[data-contents-group="entity:gebaeude"]').click(); await settle(page);
    assert.equal(page.url(), url);
    await download('linked-contents-fr');
    assert.deepEqual(test.errors, []);
    console.log('PASS: simple TOC in ungrouped List; mouse/keyboard/group links, retained route, section headings and translated PDF destinations');
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
