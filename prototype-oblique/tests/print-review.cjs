/* Regressions found during the print code review, including queued callbacks and omitted source content. */
const assert = require('node:assert/strict');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace(), { page, choose, visit, open, download, settle, scrollToPage, clearSelection } = test;
  const close = () => page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
  const scope = name => page.locator('#diagram-tree .ob-tree-link').filter({ has: page.getByText(name, { exact: true }) }).click();
  try {
    await visit('#/tables'); await open();
    await scrollToPage(2);
    assert((await page.locator('#diagram-summary').innerText()).includes('Seite 3 von'));
    await page.locator('#diagram-find').fill('GWR');
    // Queue a scroll callback, then rebuild the language UI before that frame can run.
    await page.evaluate(() => {
      document.querySelector('#diagram-canvas').dispatchEvent(new Event('scroll'));
      const language = document.querySelector('#diagram-language'); language.value = 'fr'; language.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle(page);
    assert.equal(await page.locator('.ob-export-dialog').getAttribute('lang'), 'fr');
    assert.equal(await page.locator('#diagram-find').inputValue(), 'GWR');
    await choose('#diagram-zoom-mode', '100');
    await scrollToPage(0);
    await page.locator('#diagram-canvas').evaluate(el => { el.scrollTop = el.scrollHeight; }); await settle(page);
    const last = (await page.locator('[data-diagram-page]').count()) - 1;
    assert((await page.locator('#diagram-summary').innerText()).includes(`Page ${last + 1} sur`));
    await page.locator('[data-diagram-action="document"]').click();
    const classification = page.locator('[data-diagram-setting="classification"]');
    assert((await classification.innerText()).includes('confidentiel'));
    assert(!(await classification.innerText()).includes('vertraulich'));
    await choose(classification, 'confidential');
    await page.locator('#diagram-settings-form [type="submit"]').click();
    assert.equal(await page.evaluate(() => window.printTest.layout.classification), 'confidentiel');
    assert.equal(await page.evaluate(() => DK.ui.t('print.scope')), 'Exportbereich');
    await close();
    console.log('PASS: queued scroll survives language changes; page feedback and classification are translated');

    await visit('#/systems/gwr'); await open();
    await choose('[data-diagram-setting="layout"]', 'list');
    const countLabel = await page.locator('[data-diagram-action="columns"]').innerText();
    const [selectedCount] = countLabel.match(/\d+/g).map(Number);
    await page.locator('[data-diagram-action="columns"]').click();
    await page.locator('[name="column"][value="description"]').uncheck();
    assert.equal(await page.locator('[data-diagram-action="columns"]').innerText(), `(${selectedCount - 1})`);
    await page.locator('[data-diagram-action="reset-columns"]').click();
    assert.equal(await page.locator('[data-diagram-action="columns"]').innerText(), countLabel);
    await page.locator('[data-diagram-action="dismiss"]').click();
    assert.equal(await page.locator('[data-diagram-action="columns"]').innerText(), countLabel);
    assert(await page.evaluate(() => window.printTest.layout.pages.every((cards, index) => !cards.length || window.printTest.layout.listHeadings[index].length === 1)));
    await choose('[data-diagram-setting="orientation"]', 'landscape');
    await scope('Referenzdaten');
    assert.equal(await page.locator('[data-diagram-setting="orientation"]').inputValue(), 'landscape', 'Explicit paper orientation survives scope changes');
    assert.equal(await page.locator('[data-diagram-layout][aria-pressed="true"]').getAttribute('data-diagram-layout'), 'list');
    await close();

    await visit('#/tables'); await open();
    await scope('Referenzdaten');
    assert.equal(await page.locator('[data-diagram-layout][aria-pressed="true"]').getAttribute('data-diagram-layout'), 'tiles', 'The originating collection layout survives scope changes');
    await scope('API-Verzeichnis');
    assert.equal(await page.locator('[data-diagram-layout][aria-pressed="true"]').getAttribute('data-diagram-layout'), 'tiles');
    await choose('[data-diagram-setting="layout"]', 'list');
    await scope('Referenzdaten');
    assert.equal(await page.locator('[data-diagram-layout][aria-pressed="true"]').getAttribute('data-diagram-layout'), 'list', 'Explicit layout overrides section defaults');
    await close();
    console.log('PASS: continuous List headers, column reset/count and section defaults preserve explicit choices');

    await visit('#/systems/gwr'); await open();
    await page.evaluate(() => { window.printTest.settings.filters.status = ['missing-status']; });
    await choose('[data-diagram-setting="paper"]', 'A4');
    await page.locator('[data-diagram-action="filters"]').click();
    await page.locator('#diagram-filter-find').fill('Status');
    assert(await page.locator('[data-diagram-facet="status"]').isVisible(), 'Filter search matches facet headings');
    await page.locator('#diagram-filter-find').fill('');
    await page.locator('[data-diagram-action="dismiss"]').click();
    assert.equal(await page.evaluate(() => window.printTest.layout.entityCount), 0, 'Opening/closing a filter must not silently drop an unmatched selection');
    assert(await page.locator('[data-diagram-action="download"]').isDisabled());
    await page.locator('[data-diagram-action="parent-scope"]').click();
    assert.equal(await page.evaluate(() => window.printTest.layout.entityCount), 0, 'Broadening scope preserves filters');
    await page.locator('.ob-export-filterbar [data-diagram-action="reset-filters"]').click();
    assert.equal(await page.evaluate(() => window.printTest.layout.entityCount), 30);
    await clearSelection();
    assert(await page.locator('.ob-export-empty [data-diagram-action="all"]').isVisible());
    await page.locator('.ob-export-empty [data-diagram-action="all"]').click();
    assert(await page.locator('#diagram-canvas').evaluate(el => el === document.activeElement));
    assert.equal(await page.evaluate(() => window.printTest.layout.entityCount), 30);
    await page.evaluate(() => { window.normalLayout = DK.diagram.layout; DK.diagram.layout = () => { throw new Error('Simulated layout failure'); }; });
    await choose('[data-diagram-setting="paper"]', 'A3');
    assert(await page.locator('#diagram-zoom-mode').isDisabled());
    assert.equal(await page.locator('#diagram-summary').innerText(), 'Vorschau nicht verfügbar');
    assert.equal(await page.locator('#diagram-sheets svg').count(), 0);
    await page.evaluate(() => { DK.diagram.layout = window.normalLayout; });
    await choose('[data-diagram-setting="paper"]', 'A4');
    assert(await page.locator('#diagram-zoom-mode').isEnabled());
    await close();
    console.log('PASS: unmatched filters remain restrictive; empty and failed previews recover without stale controls');

    await visit('#/products'); await open();
    const content = await page.evaluate(async () => {
      const { snapshot, settings, layout } = window.printTest;
      const problems = [];
      for (const item of DK.data.products) {
        const exported = snapshot.entities.find(e => e.id === item.identifier);
        const references = ['basedOn', 'sourcedFrom', 'servedBy'].flatMap(key => [...new Set(item[key])]);
        if (exported.rows.length !== item.attributes.length + references.length) problems.push(item.name);
      }
      const assets = await DK.pdf.load(), measure = DK.pdf.measure(assets);
      const catalogs = DK.diagram.capture({ params: {} }, { isList: true, kind: 'products', title: 'Products', groups: [{ items: DK.data.products }] }, 'de').catalogs;
      const endpoint = DK.data.apis.flatMap(e => e.endpoints || []).find(e => e.http_method);
      const apiRows = catalogs.de.apis.entities.flatMap(e => e.rows);
      const details = endpoint && apiRows.find(e => e.uuid === endpoint.id)?.description;
      if (endpoint && ![endpoint.http_method, endpoint.relative_path, endpoint.operation_name].every(value => !value || details?.includes(value))) problems.push('Missing API operation details');
      const table = { ...DK.data.tables.find(e => e.realizes), kind: 'tables' };
      const profile = DK.diagram.capture({ entity: table, params: { domain: 'bau' } }, { kind: 'tables', isList: false, title: table.name }, 'de');
      const scoped = DK.diagram.scoped(profile.catalogs, 'de', profile.scope);
      if (scoped.entities.length !== 1 || scoped.entities[0].id !== table.identifier) problems.push('Detail domain parameter changed export scope');
      const example = structuredClone(catalogs.de.objects);
      example.entities = [{ ...example.entities[0], rows: [{ id: 'review-id', display: { name: '<script>bad()</script>', type: 'Text', key: 'ID', required: 'Ja', codeList: 'Example codes' } }] }];
      const exampleSettings = { ...DK.diagram.defaults(example), columns: ['name', 'type', 'key', 'required', 'codeList'], groupBy: 'none', selected: [example.entities[0].id] };
      // Two entities exercise Grid; one entity intentionally becomes a full-width profile.
      example.entities.push({ ...example.entities[0], id: 'review-copy' }); exampleSettings.selected.push('review-copy');
      const exampleLayout = DK.diagram.layout(example, exampleSettings, measure);
      const svg = new DOMParser().parseFromString(DK.diagram.pageSvg(example, exampleSettings, exampleLayout, 0, DK.pdf.palette(), ''), 'image/svg+xml');
      if (svg.querySelector('script, parsererror') || !['<script>bad()</script>', 'ID', 'Ja', 'Example codes'].every(value => svg.documentElement.textContent.includes(value))) problems.push('Grid lost values or failed to escape source text');
      let combinations = 0;
      for (const language of ['de', 'fr', 'it', 'en']) for (const kind of ['objects', 'refs', 'products', 'apis']) for (const paper of ['A4', 'A3']) for (const mode of ['grid', 'list']) {
        const snapshot = catalogs[language][kind], settings = { ...DK.diagram.defaults(snapshot), entityColumns: ['name'], columns: ['name', 'code', 'type'], paper, layout: mode };
        const result = DK.diagram.layout(snapshot, settings, measure), pages = result.pages;
        for (const cards of pages) for (const card of cards) {
          if (card.y < result.bodyTop || card.y + card.height > result.bodyBottom + .1 || card.x + card.width > result.width - result.margin + .1) problems.push('Out-of-bounds section card');
          if (cards.some(other => other !== card && card.x < other.x + other.width - 1 && card.x + card.width > other.x + 1 && card.y < other.y + other.height - 1 && card.y + card.height > other.y + 1)) problems.push('Overlapping section cards');
        }
        for (const entity of snapshot.entities) {
          const rows = pages.flat().filter(card => card.entity.id === entity.id).flatMap(card => card.rows.filter(row => !row.empty).map(row => row.id));
          if (JSON.stringify(rows) !== JSON.stringify(entity.rows.map(row => row.id))) problems.push('Missing rows: ' + entity.name);
        }
        combinations++;
      }
      window.printTest = { snapshot, settings, layout };
      return { problems, combinations, endpointsChecked: Boolean(endpoint), references: snapshot.entities.flatMap(e => e.rows).filter(r => r.source).length };
    });
    assert.deepEqual(content.problems, []); assert.equal(content.combinations, 64); assert(content.references > 0);
    if (process.env.DIAGRAM_SUPABASE === '1') assert(content.endpointsChecked);
    await download('review-products');
    await close();
    console.log('PASS: source product links, API operations, detail scope and 64 additional section layouts');

    await visit('#/tables');
    await page.evaluate(() => { window.normalLoad = DK.pdf.load; window.pendingLoads = []; DK.pdf.load = () => new Promise(resolve => window.pendingLoads.push(resolve)); });
    await page.locator('.ob-page-actions > [data-export="diagram-pdf"]').click();
    await close();
    await page.locator('.ob-page-actions > [data-export="diagram-pdf"]').click();
    await page.evaluate(async () => { window.pendingLoads[0](await window.normalLoad()); }); await settle(page);
    assert.equal(await page.locator('#diagram-sheets svg').count(), 0, 'An old load cannot populate the replacement workspace');
    await page.evaluate(async () => { window.pendingLoads[1](await window.normalLoad()); DK.pdf.load = window.normalLoad; });
    await page.locator('#diagram-sheets svg').first().waitFor();
    await page.evaluate(() => { DK.pdf.generate = async (...args) => { await new Promise(resolve => window.resumeExport = resolve); if (!args[5].active()) throw new DOMException('Cancelled', 'AbortError'); return new Blob(['unexpected']); }; });
    let downloads = 0; page.on('download', () => downloads++);
    await page.locator('[data-diagram-action="download"]').click(); await page.waitForFunction(() => window.resumeExport);
    await close(); await open();
    await page.evaluate(() => window.resumeExport()); await settle(page);
    assert.equal(downloads, 0); assert.equal(await page.locator('#diagram-error-message').innerText(), '');
    await page.evaluate(() => { location.hash = '#/objects'; }); await settle(page);
    assert.equal(await page.locator('.ob-export-dialog').count(), 0);
    assert.deepEqual(test.errors, []);
    console.log('PASS: close/reopen discards old loads and exports; route changes clean up the workspace');
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
