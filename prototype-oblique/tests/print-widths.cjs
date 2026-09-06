/* Measure printed cell widths with the embedded font, including complete short values. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');
(async () => {
  const test = await workspace(), { page, visit, open, download, output } = test;
  try {
    await visit('#/domains/bau?tab=table&fields=name,description,responsibleOrg,attributeCount,status'); await open();
    const result = await page.evaluate(async () => {
      const measure = DK.pdf.measure(await DK.pdf.load()), current = printTest, { snapshot, settings } = current, results = [];
      for (const orientation of ['portrait', 'landscape']) {
        const layout = DK.diagram.layout(snapshot, { ...settings, paper: 'A3', orientation }, measure);
        const metrics = {};
        for (const id of ['entity.name', 'name', 'description', 'entity.responsibleOrg', 'entity.status', 'entity.attributeCount']) {
          const index = layout.keys.indexOf(id), rows = layout.pages.flat().flatMap(card => card.rows);
          metrics[id] = { width: layout.cellWidths[index], lines: Math.max(...rows.map(row => row.cells[index].length)) };
        }
        const statusIndex = layout.keys.indexOf('entity.status'), ownerIndex = layout.keys.indexOf('entity.responsibleOrg');
        const fits = (index, field) => snapshot.entities.every(entity => measure(entity.display[field], 9) <= layout.cellWidths[index] - 12 + .01);
        results.push({ orientation, metrics, statusFits: fits(statusIndex, 'status'), responsibilityFits: fits(ownerIndex, 'responsibleOrg') });
      }
      window.printTest = current;
      return results;
    });
    fs.writeFileSync(path.join(output, `print-widths-${process.env.REPORT_ONLY ? 'before' : 'after'}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (!process.env.REPORT_ONLY) {
      assert(result.every(result => result.statusFits && result.responsibilityFits), 'Status and responsibility values must fit in A3 without splitting words');
      await download('objects-column-widths');
      assert.deepEqual(test.errors, []);
    }
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
