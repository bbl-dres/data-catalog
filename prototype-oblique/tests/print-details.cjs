/* Collection print must include all child rows and keep summaries and grouping in sync. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace(), { page, visit, open, choose, download, output } = test;
  try {
    for (const kind of ['objects', 'tables', 'refs', 'products', 'apis', 'domains', 'systems']) {
      await visit(`#/${kind}?view=table&group=resp`);
      assert.equal(await page.evaluate(() => DK.router.parse().params.group), 'resp');
      const groups = await page.locator('.ob-group-title').allTextContents();
      await page.locator('[data-menu="group"]').click();
      assert.equal(await page.locator('[data-action="set-group"][data-group="resp"]').innerText(), 'Verantwortung');
      await page.locator('[data-action="set-group"][data-group="resp"]').click();
      if (['domains', 'systems'].includes(kind)) continue;
      await open();
      assert.equal(await page.locator('#diagram-error-message').innerText(), '', kind);
      assert.equal(await page.evaluate(() => printTest.settings.groupBy), 'resp');
      const result = await page.evaluate(() => {
        const { snapshot, settings, layout } = printTest;
        return { groups: DK.diagram.groups(snapshot, settings.groupBy).map(group => group.title),
          summaries: layout.summaries.flat().map(row => row.id), keys: layout.keys,
          entities: snapshot.entities.map(entity => ({ id: entity.id, rows: entity.rows.map(row => row.id),
            printed: layout.pages.flat().filter(card => card.entity.id === entity.id).flatMap(card => card.rows.filter(row => !row.empty).map(row => row.id)) })) };
      });
      assert.deepEqual(result.groups.map(title => title === 'Nicht angegeben' ? '–' : title), groups, kind + ': same responsibility grouping');
      assert(result.summaries.length > 0 && !result.keys.includes('entity.description'));
      for (const entity of result.entities) {
        assert(result.summaries.includes(`${kind}:${entity.id}`), entity.id + ': selected entry in summary');
        assert.deepEqual(entity.printed, entity.rows, entity.id + ': every child row exactly once');
      }
      await page.locator('.ob-export-header [data-diagram-action="close"]').click();
    }
    for (const hash of ['#/domains/bau?tab=table', '#/systems/gwr?tab=rows', '#/tables/t-gwr-gebaeude?tab=rows&filter=EGID']) {
      await visit(hash); await open();
      assert.equal(await page.locator('#diagram-error-message').innerText(), '', hash);
      const result = await page.evaluate(() => {
        const { snapshot, settings, layout } = printTest;
        return { mode: settings.layout, count: layout.pages.flat().reduce((sum, card) => sum + card.rows.filter(row => !row.empty).length, 0),
          expected: snapshot.entities.reduce((sum, entity) => sum + entity.rows.length, 0), summaries: layout.summaries.flat().map(row => row.id) };
      });
      assert.equal(result.mode, 'list'); assert.equal(result.count, result.expected);
      assert(result.summaries.some(id => id.startsWith('domains:')), 'Domain descriptions are captured');
      if (hash.includes('gwr')) assert(result.summaries.includes('systems:gwr'), 'System description is captured');
      if (hash.includes('/systems/')) {
        await download('gwr-detail-list');
        await page.screenshot({ path: path.join(output, 'gwr-detail-list.png') });
      }
      await page.locator('.ob-export-header [data-diagram-action="close"]').click();
    }
    await visit('#/objects?view=table&group=resp'); await open();
    await download('responsibility-list');
    const matrix = await page.evaluate(async () => {
      const measure = DK.pdf.measure(await DK.pdf.load()), problems = []; let count = 0;
      for (const language of ['de', 'fr', 'it', 'en']) {
        const snapshot = DK.diagram.snapshot({ kind: 'objects' }, { kind: 'objects', isList: true, title: 'Review', groups: [{ items: DK.data.objects }] }, language);
        snapshot.entities[0].display.description = Array.from({ length: 300 }, (_, index) => `Summary word ${index}`).join(' ');
        for (const orientation of ['portrait', 'landscape']) {
          const settings = { ...DK.diagram.defaults(snapshot), layout: 'list', paper: 'A4', orientation, overview: 'yes', groupBy: 'resp',
            entityColumns: ['name', 'description'], columns: ['name', 'description'] };
          const layout = DK.diagram.layout(snapshot, settings, measure); count++;
          const summaries = layout.summaries.flat();
          const descriptionIndex = layout.summaryFields.findIndex(field => field.id === 'description');
          const longDescription = summaries.filter(row => row.id === `objects:${snapshot.entities[0].id}`).flatMap(row => row.cells[descriptionIndex]).join(' ');
          if (longDescription !== snapshot.entities[0].display.description) problems.push('Truncated summary across pages');
          for (const rows of layout.summaries) {
            let bottom = layout.bodyTop + layout.summaryHeadingHeight;
            for (const row of rows) {
              if (row.y < bottom - .1 || row.y + row.height > layout.bodyBottom + .1) problems.push('Summary overlaps another row or footer');
              row.cells.forEach((cell, i) => { if (cell.some(text => measure(text, 9) > layout.summaryWidths[i] - 12 + .1)) problems.push('Summary text exceeds column'); });
              bottom = row.y + row.height;
            }
          }
          for (const [index, rows] of layout.overview.entries()) {
            const svg = new DOMParser().parseFromString(DK.diagram.pageSvg(snapshot, settings, layout, index, DK.pdf.palette(), ''), 'image/svg+xml');
            for (const row of rows) {
              const pages = row.id === 'summary' ? layout.summaries.map((_, index) => layout.overview.length + index + 1)
                : layout.pages.flatMap((cards, index) => cards.some(card => row.id === 'details' || (row.indent ? `entity:${card.entity.id}` === row.id : card.groupId === row.id)) ? [index + 1] : []);
              const text = [...svg.querySelector(`[data-contents-group="${row.id}"]`).querySelectorAll('text')].at(-1).textContent;
              if (text !== `${pages[0]}${pages.length > 1 ? '–' + pages.at(-1) : ''}`) problems.push('Wrong contents reference');
            }
          }
          const hidden = DK.diagram.layout(snapshot, { ...settings, entityColumns: ['name'] }, measure);
          if (hidden.summaryFields.some(field => field.id === 'description')) problems.push('Hidden description remains in summary');
        }
      }
      return { count, problems: [...new Set(problems)] };
    });
    assert.equal(matrix.count, 8); assert.deepEqual(matrix.problems, []);
    assert.deepEqual(test.errors, []);
    console.log('PASS: responsibility grouping in seven collections and five print kinds; full detailed lists, frozen context summaries, eight translated pagination cases and actual PDFs');
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
