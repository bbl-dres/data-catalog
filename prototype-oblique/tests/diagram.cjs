/* Source fidelity, physical layouts, real PDFs, language, responsive controls and cancellation. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');
(async () => {
  const test = await workspace(), { page, choose, visit, open, download, settle, output, scrollToPage } = test;
  try {
    await visit('#/tables');
    const tiles = await page.locator('.ob-tile').evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, name: node.querySelector('.ob-tile-name')?.textContent, footer: node.querySelector('.ob-tile-footer')?.textContent })));
    assert(tiles.length > 20 && tiles.every(tile => tile.footer));
    assert(Math.max(...tiles.map(t => t.width)) - Math.min(...tiles.map(t => t.width)) < 1);
    assert(tiles.some(tile => tile.name === 'Gebäude (VIBDBU)'));
    await page.screenshot({ path: path.join(output, 'tiles-desktop.png') });
    await visit('#/systems/gwr?tab=rows'); await open();
    assert.equal(await page.locator('#diagram-error-message').innerText(), '');
    assert.equal(await page.evaluate(() => window.printTest.layout.entityCount), 7);
    assert.equal(await page.evaluate(() => window.printTest.layout.fieldCount), 146);
    assert.equal(await page.locator('[data-diagram-setting="scale"]').count(), 0);
    await download('gwr-grid');
    const count = await page.locator('[data-diagram-page]').count(); assert(count > 1);
    await choose('#diagram-zoom-mode', '100');
    await scrollToPage(count - 1);
    assert((await page.locator('#diagram-summary').innerText()).includes(`Seite ${count} von ${count}`));
    assert(await page.locator('.ob-export-page-svg svg').count() <= 4);
    await page.locator('#diagram-canvas').hover(); await page.mouse.wheel(0, -100000); await settle(page);
    assert((await page.locator('#diagram-summary').innerText()).includes(`Seite 1 von ${count}`));
    await choose('#diagram-zoom-mode', 'width');
    const zoom = await page.locator('#diagram-zoom').innerText();
    await page.setViewportSize({ width: 1280, height: 900 }); await settle(page);
    assert.notEqual(await page.locator('#diagram-zoom').innerText(), zoom);
    assert.equal(await page.locator('[data-diagram-page]').count(), count, 'Preview zoom never repaginates');
    await page.setViewportSize({ width: 1600, height: 1000 });
    await choose('[data-diagram-setting="layout"]', 'list');
    assert.equal(await page.locator('[data-diagram-setting="orientation"]').inputValue(), 'portrait');
    await download('gwr-list');
    await page.locator('[data-diagram-action="columns"]').click();
    await page.locator('[name="column"][value="description"]').uncheck();
    assert(await page.locator('[name="column"][value="entity.name"]').isDisabled());
    await page.locator('[data-diagram-action="dismiss"]').click();
    assert(!(await page.evaluate(() => window.printTest.layout.keys)).includes('entity.description'));
    await page.locator('[data-diagram-action="document"]').click();
    await page.locator('[name="title"]').fill('Reviewed inventory');
    await page.locator('[name="documentId"]').fill('BBL-2026-001');
    await page.locator('[name="version"]').fill('1.0');
    await choose('[data-diagram-setting="classification"]', 'confidential');
    await page.locator('#diagram-settings-form [type="submit"]').click();
    assert(!(await page.locator('[data-diagram-page="0"]').innerText()).includes('vertraulich'), 'Classification is retained in settings, not printed as a label');
    await choose('#diagram-language', 'fr'); await settle(page);
    assert.equal(await page.locator('#diagram-error-message').innerText(), '');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'de');
    assert.equal(await page.evaluate(() => DK.ui.t('print.scope')), 'Exportbereich');
    assert.equal(await page.evaluate(() => window.printTest.settings.title), 'Reviewed inventory');
    await download('gwr-fr');
    await page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
    await visit('#/tables/t-geb-gis?tab=rows&filter=EGID'); await open();
    assert.equal(await page.evaluate(() => window.printTest.layout.fieldCount), 74, 'Single-entity export includes all fields');
    await download('gis-building');
    await page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
    await visit('#/objects'); await open(); await download('objects-overview');
    assert((await page.evaluate(() => window.printTest.layout.overview.length)) > 0);
    const contents = page.locator('[data-diagram-page="0"]');
    assert((await contents.innerText()).includes('Inhaltsverzeichnis'));
    assert(!(await contents.locator('[data-contents-group]').allTextContents()).join(' ').includes('Immobilienmanagement'));
    await page.screenshot({ path: path.join(output, 'print-contents.png') });
    console.log('PASS: tiles, scopes, real PDFs, zoom, virtual scrolling, document metadata and language isolation');

    const contentsReview = await page.evaluate(async () => {
      const measure = DK.pdf.measure(await DK.pdf.load()), problems = []; let count = 0;
      for (const language of ['de', 'fr', 'it', 'en']) {
        const snapshot = DK.diagram.snapshot({ kind: 'objects' }, { kind: 'objects', isList: true, title: 'Contents review', groups: [{ items: DK.data.objects }] }, language);
        snapshot.entities = Array.from({ length: 40 }, (_, index) => ({ ...snapshot.entities[0], id: `entity-${index}`, responsibility: 'OWNERSHIP MUST NOT APPEAR HERE' }));
        snapshot.groupings = [{ id: 'domain', label: 'Domain', groups: snapshot.entities.map((entity, index) => ({ id: `group-${index}`,
          title: `${index + 1}. ${'A long section name with accents Gebäude & Grundstück '.repeat(3)}`, entityIds: [entity.id] })) }];
        for (const mode of ['tiles', 'grid', 'list']) {
          const settings = { ...DK.diagram.defaults(snapshot), paper: 'A4', orientation: 'portrait', layout: mode, groupBy: 'domain', overview: 'yes',
            listRows: false, entityColumns: ['name'], columns: ['name'], filters: {} };
          const layout = DK.diagram.layout(snapshot, settings, measure), rows = layout.overview.flat(); count++;
          if (layout.overview.length < 2 || rows.length !== snapshot.entities.length) problems.push('Contents pagination lost sections');
          for (const [index, pageRows] of layout.overview.entries()) {
            const svg = new DOMParser().parseFromString(DK.diagram.pageSvg(snapshot, settings, layout, index, DK.pdf.palette(), ''), 'image/svg+xml');
            let y = layout.bodyTop + layout.overviewHeading.height;
            for (const row of pageRows) {
              const references = layout.pages.flatMap((cards, pageIndex) => cards.some(card => card.groupId === row.id) ? [pageIndex + 1] : []);
              const texts = [...svg.querySelector(`[data-contents-group="${row.id}"]`).querySelectorAll('text')];
              const expected = `${references[0]}${references.length > 1 ? '–' + references.at(-1) : ''}`;
              if (texts.at(-1).textContent !== expected) problems.push('Wrong page reference after contents pagination');
              if (row.details.join(' ').includes('OWNERSHIP')) problems.push('Ownership mixed with counts');
              if ((mode === 'grid') !== row.summary.includes(DK.diagram.t(snapshot, 'col.attributes'))) problems.push('Counts do not match printed detail level');
              if (texts.some(node => Number(node.getAttribute('y')) > y + row.height)) problems.push('Contents row text overlaps next row');
              const textWidth = layout.width - layout.margin * 2 - layout.overviewHeading.pageWidth - layout.gap - layout.pad * 2;
              if (row.lines.some(text => measure(text, 11, true) > textWidth + .1)) problems.push('Section title overlaps page reference');
              y += row.height;
            }
            if (y > layout.bodyBottom + .1) problems.push('Contents crosses footer');
          }
          if (DK.diagram.layout(snapshot, { ...settings, overview: 'no' }, measure).overview.length) problems.push('Contents cannot be disabled');
        }
      }
      return { count, problems: [...new Set(problems)] };
    });
    assert.deepEqual(contentsReview.problems, []); assert.equal(contentsReview.count, 12);
    console.log('PASS: contents in three layouts and four languages; long headings, multiple contents pages, correct page references and counts');

    const matrix = await page.evaluate(async () => {
      const assets = await DK.pdf.load(), measure = DK.pdf.measure(assets), problems = []; let count = 0;
      for (const language of ['de', 'fr', 'it', 'en']) {
        const snapshot = DK.diagram.snapshot({ kind: 'tables' }, { kind: 'tables', isList: true, title: 'All tables', groups: [{ items: DK.data.tables }] }, language);
        for (const paper of Object.keys(DK.diagram.papers)) for (const orientation of ['portrait', 'landscape']) for (const mode of ['grid', 'list']) for (const groupBy of snapshot.groupings.map(g => g.id)) {
          const settings = { ...DK.diagram.defaults(snapshot), entityColumns: ['name'], columns: ['name', 'type', 'key'], paper, orientation, layout: mode, groupBy };
          const layout = DK.diagram.layout(snapshot, settings, measure), cards = layout.pages.flat();
          count++;
          for (const entity of snapshot.entities) {
            const actual = cards.filter(c => c.entity.id === entity.id).flatMap(c => c.rows.filter(r => !r.empty).map(r => r.id));
            if (JSON.stringify(actual) !== JSON.stringify(entity.rows.map(r => r.id))) problems.push('Lost/duplicated rows: ' + entity.id);
          }
          layout.pages.forEach((cards, index) => {
            if (new Set(cards.map(c => c.groupId)).size > 1) problems.push('Mixed groups');
            for (const card of cards) {
              if (card.y < layout.bodyTop || card.y + card.height > layout.bodyBottom + .1 || card.x + card.width > layout.width - layout.margin + .1) problems.push('Out of page');
              for (const other of cards) if (card !== other && card.x < other.x + other.width - 1 && card.x + card.width > other.x + 1 && card.y < other.y + other.height - 1 && card.y + card.height > other.y + 1) problems.push('Overlapping cards');
            }
            if (groupBy !== 'none' && cards.length && !layout.pageHeadings[index].length) problems.push('Missing group heading');
          });
        }
      }
      return { count, problems: [...new Set(problems)] };
    });
    assert.deepEqual(matrix.problems, []); assert.equal(matrix.count, 320);
    console.log('PASS: 320 page/language/layout/grouping combinations preserve every field once, without overlap');
    for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport); await settle(page);
      const bounds = await page.evaluate(() => ({ width: document.querySelector('.ob-export-dialog').scrollWidth, viewport: innerWidth, canvas: document.querySelector('#diagram-canvas').getBoundingClientRect().height }));
      assert(bounds.width <= bounds.viewport + 1, JSON.stringify(bounds)); assert(bounds.canvas > 60, JSON.stringify(bounds));
      if (!await page.locator('.ob-export-tools-panel').evaluate(el => el.open)) await page.locator('.ob-export-tools-panel > summary').click();
      await page.locator('[data-diagram-action="document"]').click();
      const box = await page.locator('#diagram-popover').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= viewport.width + 1 && box.y >= 0 && box.y + box.height <= viewport.height + 1);
      await page.keyboard.press('Escape'); assert.equal(await page.locator('.ob-export-dialog').count(), 1);
      if (viewport.width <= 960) await page.locator('.ob-export-tools-panel > summary').click();
      if (viewport.width === 390) await page.screenshot({ path: path.join(output, 'print-mobile.png') });
    }
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.ob-export-dialog').count(), 0);
    for (const width of [320, 390, 768, 1920]) {
      await page.setViewportSize({ width, height: 900 }); await settle(page);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    await visit('#/tables');
    await page.evaluate(() => { window.savedLoad = DK.pdf.load; DK.pdf.load = () => Promise.reject(new Error('Simulated asset failure')); });
    await open(); assert(await page.locator('#diagram-error').isVisible());
    await page.evaluate(() => { DK.pdf.load = window.savedLoad; });
    await page.locator('[data-diagram-action="retry"]').click(); await page.locator('#diagram-sheets svg').first().waitFor();
    await page.evaluate(() => { DK.pdf.generate = async (...args) => { await new Promise(resolve => window.resumePrint = resolve); if (!args[5].active()) throw new DOMException('Cancelled', 'AbortError'); return new Blob(['unexpected']); }; });
    let downloads = 0; page.on('download', () => downloads++);
    await page.locator('[data-diagram-action="download"]').click();
    await page.waitForFunction(() => window.resumePrint);
    await page.locator('.ob-export-header [data-diagram-action="close"]').first().click(); await page.evaluate(() => window.resumePrint()); await settle(page);
    assert.equal(downloads, 0); assert.equal(await page.locator('.ob-export-dialog').count(), 0);
    assert.deepEqual(test.errors, []);
    console.log('PASS: narrow screens, keyboard dismissal, asset retry and cancellation without a download');
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
