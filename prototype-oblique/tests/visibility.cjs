const assert = require('node:assert/strict');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace(), { page, visit, open, choose, download, settle, output } = test;
  try {
    const selectFields = async (kind, selected) => {
      await page.locator(`[data-field-picker="${kind}"]`).click();
      for (const input of await page.locator('.ob-field-picker input:not(:disabled)').all()) await input.setChecked(selected.includes(await input.inputValue()));
      assert.equal(await page.locator('.ob-field-picker:popover-open').count(), 1);
      assert.equal(await page.locator('.ob-field-picker [type="submit"]').count(), 0);
      await page.locator('[data-fields-close]').click();
    };
    await visit('#/domains/bau?tab=table');
    const rowFields = () => page.locator('tbody tr').first().locator('[data-field]').evaluateAll(nodes => nodes.map(node => node.dataset.field));
    await page.locator('[data-field-picker="objects"]').click();
    for (const field of ['domain', 'normReference']) await page.locator(`.ob-field-picker [value="${field}"]`).locator('..').click();
    assert.deepEqual(await rowFields(), ['name', 'description', 'domain', 'responsibleOrg', 'normReference', 'attributeCount', 'status'], 'Checkboxes immediately use the shared field order');
    assert.equal(await page.locator('[data-field-picker="objects"]').innerText(), 'Ansicht (7)');
    const norm = page.locator('.ob-field-picker [value="normReference"]');
    await norm.focus();
    await norm.evaluate(input => { window.retainedChoice = input; window.pickerScroll = input.closest('.ob-field-picker-body').scrollTop; });
    await page.keyboard.press('Space');
    assert(!(await rowFields()).includes('normReference'), 'Keyboard selection is immediate');
    assert(await norm.evaluate(input => input === window.retainedChoice && document.activeElement === input && input.closest('.ob-field-picker-body').scrollTop === window.pickerScroll));
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    await page.locator('[data-view="tiles"]').click();
    await page.reload(); await page.locator('.ob-tile').first().waitFor();
    for (const field of ['domain', 'normReference']) assert.equal(await page.locator('.ob-tile').first().locator(`[data-field="${field}"]`).count(), 1);
    await page.locator('[data-field-picker="objects"]').click();
    await page.locator('[data-fields-reset]').click();
    await page.locator('[data-fields-close]').click();
    for (const kind of ['objects', 'tables', 'domains', 'systems', 'refs', 'products', 'apis']) {
      await visit('#/' + kind);
      await selectFields(kind, ['description', 'status', 'responsibleOrg']);
      const tileFields = await page.locator('.ob-tile').first().locator('[data-field]').evaluateAll(nodes => nodes.map(n => n.dataset.field).sort());
      assert.deepEqual(tileFields, ['description', 'name', 'responsibleOrg', 'status']);
      const tileName = await page.locator('.ob-tile-name').first().innerText();
      await page.locator('[data-view="table"]').click();
      assert.deepEqual(await page.locator('tbody tr').first().locator('[data-field]').evaluateAll(nodes => nodes.map(n => n.dataset.field).sort()), tileFields);
      assert.equal(await page.locator('tbody tr [data-field="name"]').first().innerText(), tileName);
      assert.equal(new URLSearchParams(page.url().split('#')[1].split('?')[1]).get('fields'), 'name,description,responsibleOrg,status');
      await page.evaluate(kind => DK.presentation.save(kind, DK.presentation.defaults(kind)), kind);
      await page.reload(); await page.locator('[data-field-picker]').waitFor();
      assert.equal(await page.evaluate(kind => DK.presentation.selected(kind).length, kind), 4, 'URL takes precedence over a different browser preference');
      await page.locator('[data-field-picker]').click();
      assert(await page.locator('.ob-field-picker [value="name"]').isDisabled());
      await page.locator('[data-fields-reset]').click();
      assert(await page.evaluate(kind => JSON.stringify(DK.presentation.selected(kind)) === JSON.stringify(DK.presentation.defaults(kind)), kind), 'Reset saves immediately');
      await page.locator('[data-fields-close]').click();
      const widths = await page.locator('.ob-table--fields').first().evaluate(table => {
        const headers = [...table.querySelectorAll('th')];
        const width = id => headers.find(th => th.querySelector(`[data-sort-field="${id}"]`))?.getBoundingClientRect().width;
        return { description: width('description'), name: width('name'), numbers: headers.filter(th => th.classList.contains('ob-cell-numeric')).map(th => th.getBoundingClientRect().width),
          overflow: table.scrollWidth > table.clientWidth + 1, nowrap: headers.every(th => getComputedStyle(th).whiteSpace === 'nowrap') };
      });
      assert(widths.description > widths.name && widths.numbers.every(width => width < widths.name), kind + ': more room for prose, compact counts: ' + JSON.stringify(widths));
      assert(widths.nowrap && !widths.overflow, kind + ': headers fit without wrapping');
    }
    await visit('#/objects?view=table&group=none');
    await page.locator('[data-sort-field="attributeCount"]').click();
    await selectFields('objects', ['description', 'attributeCount', 'status']);
    assert.equal(await page.locator('[data-sort-field="attributeCount"]').locator('..').getAttribute('aria-sort'), 'ascending', 'Hiding a preceding column preserves sorting');
    const names = await page.locator('tbody tr [data-field="name"]').allInnerTexts();
    await page.locator('[data-view="tiles"]').click();
    assert.deepEqual(await page.locator('.ob-tile-name').allInnerTexts(), names, 'Layouts keep one ordering');
    await open();
    assert.deepEqual(await page.evaluate(() => window.printTest.snapshot.entities.map(entity => entity.name)), names, 'Print keeps the sorted entry order');
    await page.locator('.ob-export-header [data-diagram-action="close"]').click();
    await selectFields('objects', ['description', 'status']);
    assert.equal(await page.evaluate(() => DK.app.state.tableSorts['list:objects'].field), 'name');
    await visit('#/domains/bau?tab=tiles');
    assert.equal(await page.locator('[data-field-picker="objects"]').count(), 1, 'Domain members share object preferences');
    await selectFields('objects', ['version', 'status']);
    await open();
    assert.equal(await page.locator('#diagram-error-message').innerText(), '');
    assert.equal(await page.evaluate(() => window.printTest.settings.layout), 'tiles', 'Print inherits the current collection layout');
    assert.equal(await page.evaluate(() => window.printTest.settings.groupBy), 'none', 'Print inherits domain grouping');
    assert.equal(await page.locator('[data-diagram-layout]').count(), 2);
    await page.locator('[data-diagram-layout="list"]').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('[data-diagram-layout="list"]').getAttribute('aria-pressed'), 'true', 'Visible layout selector supports keyboard activation');
    assert.deepEqual(await page.evaluate(() => window.printTest.layout.keys.filter(key => key.startsWith('entity.'))), ['entity.name', 'entity.version', 'entity.status'], 'Collection List retains the selected parent metadata');
    assert.equal(await page.evaluate(() => window.printTest.layout.pages.flat().flatMap(card => card.rows).length), 41, 'Collection List includes every business attribute');
    await download('visibility-entries');
    await page.locator('.ob-export-header [data-diagram-action="close"]').click();
    await page.locator('[data-view="table"]').click();
    const inheritedFields = await rowFields();
    await open();
    assert.equal(await page.evaluate(() => window.printTest.settings.layout), 'list', 'Web Table opens print List');
    assert.deepEqual(await page.evaluate(() => window.printTest.layout.keys.filter(key => key.startsWith('entity.')).map(key => key.replace('entity.', ''))), inheritedFields);
    await page.locator('.ob-export-header [data-diagram-action="close"]').click();
    await visit('#/objects/gebaeude?tab=rows');
    await page.locator('[data-tab="rows"]').click();
    await open();
    assert(await page.evaluate(() => DK.diagram.usesRows(window.printTest.settings)), 'Attribute tables retain detailed print rows');
    await choose('[data-diagram-setting="orientation"]', 'landscape');
    assert.equal(await page.locator('#diagram-error-message').innerText(), '');
    let result = await page.evaluate(() => {
      const { snapshot, settings, layout } = window.printTest;
      return { keys: layout.keys, headers: layout.pages.flat().map(c => c.headerHeight),
        rows: layout.pages.flat().flatMap(c => c.rows.map(row => ({ cells: row.cells, name: c.entity.display.name }))),
        headerCounts: layout.listHeadings.map(h => h.length), pages: layout.pages.length,
        expected: snapshot.entities.reduce((n, e) => n + e.rows.length, 0), count: layout.fieldCount, settings };
    });
    assert(result.keys.includes('entity.name') && result.keys.includes('entity.version') && result.keys.includes('entity.status'));
    assert(result.headers.every(h => h === 0), 'No per-entity header bands');
    assert(result.rows.every(row => row.cells[0].join(' ') === row.name), 'Every row identifies its entity');
    assert.equal(result.count, result.expected);
    assert(result.headerCounts.filter(n => n === 1).length > 0, 'Detailed pages have column headers');
    const position = await page.evaluate(() => {
      const preview = document.querySelector('.ob-export-preview-tools').getBoundingClientRect();
      const end = document.querySelector('.ob-export-toolbar-end').getBoundingClientRect();
      return { previewRight: preview.right, controlsLeft: end.left };
    });
    assert(position.previewRight <= position.controlsLeft, 'Preview left, presentation controls right');
    await page.locator('[data-diagram-action="columns"]').click();
    assert.match(await page.locator('[data-diagram-action="columns"]').innerText(), /^\(\d+\)$/);
    assert.equal(await page.locator('#diagram-settings-form [type="submit"]').count(), 0);
    assert.equal(await page.locator('[name="column"][value="description"]').count(), 1, 'A single shared description choice');
    assert.equal(await page.locator('#diagram-popover legend').count(), 0, 'One flat list without entity sections');
    assert(await page.locator('[name="column"][value="entity.name"]').isDisabled());
    assert(await page.locator('[name="column"][value="name"]').isDisabled());
    assert(await page.locator('[name="column"][value="version"]').evaluate(input => input.indeterminate));
    const before = await page.evaluate(() => ({ objects: DK.presentation.selected('objects'), attrs: DK.presentation.selected('attrs') }));
    await page.locator('[data-diagram-action="dismiss"]').click();
    assert.deepEqual(await page.evaluate(() => ({ objects: DK.presentation.selected('objects'), attrs: DK.presentation.selected('attrs') })), before, 'Unchanged mixed choices preserve independent selections');
    await page.locator('[data-diagram-action="columns"]').click();
    for (const field of ['version', 'description']) {
      const choice = page.locator(`[name="column"][value="${field}"]`);
      assert(await choice.evaluate(input => input.indeterminate));
      await choice.check(); await choice.uncheck();
      assert(await choice.evaluate(input => document.activeElement === input && input.closest('#diagram-popover').matches(':popover-open')), 'Print choice stays focused and open');
      assert(!(await page.evaluate(() => window.printTest.layout.keys)).some(key => key === field || key === 'entity.' + field), 'Shared choices immediately update both levels');
    }
    await page.locator('[data-diagram-action="dismiss"]').click();
    assert(!(await page.evaluate(() => window.printTest.layout.keys)).includes('entity.version'));
    assert(!(await page.evaluate(() => DK.presentation.selected('objects'))).includes('version'));
    assert(!(await page.evaluate(() => DK.presentation.selected('attrs'))).includes('description'));
    assert(!(await page.evaluate(() => DK.presentation.selected('attrs'))).includes('version'));
    assert(!(await page.evaluate(() => DK.presentation.selected('objects'))).includes('description'));
    await download('visibility-list');
    await page.screenshot({ path: path.join(output, 'visibility-print.png') });
    await page.locator('.ob-export-header [data-diagram-action="close"]').click();
    await visit('#/objects/gebaeude?tab=rows');
    await page.locator('[data-tab="rows"]').click();
    assert.equal(await page.locator('[data-field-picker="attrs"]').count(), 1);
    assert.equal(await page.locator('tbody [data-field="description"]').count(), 0, 'Print row visibility is shared with detail tables');
    await visit('#/systems/gwr?tab=rows');
    await page.locator('[data-tab="rows"]').click();
    assert.equal(await page.locator('[data-field-picker="tables"]').count(), 1);
    await visit('#/tables/t-gwr-gebaeude?tab=rows');
    await page.locator('[data-tab="rows"]').click();
    await selectFields('fields', ['required', 'nullable', 'codeList']);
    assert.equal(await page.locator('tbody tr').first().locator('td').count(), 4);
    await visit('#/objects');
    for (const width of [320, 390, 768, 1600]) {
      await page.setViewportSize({ width, height: 844 }); await settle(page);
      await page.locator('[data-field-picker]').click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), width + ' page overflow');
      assert(await page.locator('.ob-field-picker').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
      if (width === 320 || width === 1600) await page.screenshot({ path: path.join(output, `visibility-picker-${width}.png`) });
      await page.keyboard.press('Escape');
      assert(await page.locator('[data-field-picker]').evaluate(el => el === document.activeElement));
    }
    const printCases = await page.evaluate(async () => {
      const measure = DK.pdf.measure(await DK.pdf.load());
      const snapshot = DK.diagram.snapshot({ kind: 'tables' }, { kind: 'tables', isList: true, title: 'Empty table', groups: [{ items: DK.data.tables }] }, 'de');
      const entity = snapshot.entities[0];
      entity.rows = []; entity.display.fieldCount = '0';
      const settings = { ...DK.diagram.defaults(snapshot), layout: 'list', groupBy: 'none', selected: [entity.id], entityColumns: ['name', 'fieldCount'], columns: ['name'] };
      const layout = DK.diagram.layout(snapshot, settings, measure);
      const row = layout.pages.flat()[0].rows[0];
      const svg = new DOMParser().parseFromString(DK.diagram.pageSvg(snapshot, settings, layout, layout.pages.findIndex(cards => cards.length), DK.pdf.palette(), ''), 'image/svg+xml');
      const zero = [...svg.querySelectorAll('text')].find(node => node.textContent === '0');
      let tooWide = false;
      try { DK.diagram.layout(snapshot, { ...settings, paper: 'A4', orientation: 'portrait', entityColumns: snapshot.entityFields.map(f => f.id), columns: snapshot.rowFields.map(f => f.id) }, measure); }
      catch (error) { tooWide = error.message === DK.diagram.t(snapshot, 'print.columnsTooWide'); }
      const geometry = ['tiles', 'grid', 'list'].map(mode => {
        const options = { ...settings, layout: mode, classification: 'confidential' };
        const classified = DK.diagram.layout(snapshot, options, measure);
        const plain = DK.diagram.layout(snapshot, { ...options, classification: 'public' }, measure);
        const svg = DK.diagram.pageSvg(snapshot, options, classified, 0, DK.pdf.palette(), '');
        return { same: classified.bodyTop === plain.bodyTop && classified.footerY === plain.footerY, label: svg.includes('vertraulich') };
      });
      return { empty: row.empty, count: layout.fieldCount, cells: row.cells, name: entity.display.name, alignment: zero?.getAttribute('text-anchor'), tooWide, geometry };
    });
    assert(printCases.empty && printCases.count === 0);
    assert.deepEqual(printCases.cells, [[printCases.name], ['—'], ['0']], 'Empty tables remain identifiable without inventing fields; counts follow names');
    assert.equal(printCases.alignment, 'end');
    assert(printCases.tooWide, 'Overfull print columns produce an actionable error');
    assert(printCases.geometry.every(result => result.same && !result.label), 'Every layout omits classification labels without changing page spacing');
    await open();
    const childBefore = await page.evaluate(() => DK.presentation.selected('attrs'));
    await page.locator('[data-diagram-action="columns"]').click();
    await page.locator('[data-diagram-action="reset-columns"]').click();
    assert.deepEqual(await page.evaluate(() => DK.presentation.selected('attrs')), childBefore, 'Reset in Tiles keeps child preferences');
    await page.locator('[data-diagram-action="dismiss"]').click();
    await choose('[data-diagram-setting="layout"]', 'list');
    await page.locator('[data-diagram-action="columns"]').click();
    await page.locator('[data-diagram-action="reset-columns"]').click();
    for (const kind of ['objects', 'attrs']) assert(await page.evaluate(kind => JSON.stringify(DK.presentation.selected(kind)) === JSON.stringify(DK.presentation.defaults(kind)), kind), 'Reset immediately restores both levels, including partially selected defaults');
    await page.locator('[data-diagram-action="dismiss"]').click();
    assert.deepEqual(test.errors, []);
    console.log('PASS: seven entity kinds, immediate choices/reset, retained focus, shared layouts/order, persisted selections, parent/child print synchronization, flat PDF rows, compact counts and 320–1600 px picker layouts.');
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
