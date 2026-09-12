/* Measured controls, dividers and content spacing across laptop wrap thresholds. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace();
  const { page, visit, settle, output } = test;
  const report = { cases: [], errors: test.errors };
  const scenarios = [
    [390, 844], [830, 600], [961, 600], [1024, 768], [1025, 768],
    [1064, 768], [1065, 768], [1093, 615], [1280, 720],
    [1304, 768], [1305, 768], [1366, 768], [1600, 900], [1920, 1080]
  ].map(([width, height]) => ({ width, height, sidebar: 360 }));
  for (const width of [1280, 1366, 1600]) scenarios.push({ width, height: 720, sidebar: 480 });
  const routes = [
    '#/objects?view=table', '#/domains/bau?tab=table',
    '#/objects/areal?tab=rows', '#/objects/areal?tab=relations',
    '#/tables/t-gwr-gebaeude?tab=rows', '#/tables/t-gwr-gebaeude/fields/GKAT'
  ];
  try {
    for (const scenario of scenarios) {
      const { width, height, sidebar } = scenario;
      await page.setViewportSize({ width, height });
      for (const language of ['de', 'fr']) {
        await visit('#/objects');
        await page.evaluate(({ sidebar, language }) => {
          DK.preferences.write('sidebarWidth', sidebar);
          DK.preferences.write('language', language);
        }, { sidebar, language });
        for (const route of routes) {
          await visit(route);
          await page.evaluate(() => document.fonts.ready);
          await settle(page);
          const metrics = await page.evaluate(() => {
            const box = el => {
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
            };
            const issues = [];
            if (document.documentElement.scrollWidth > innerWidth) issues.push('page overflow');
            const title = document.querySelector('#brand-org'), notice = document.querySelector('#header-notice');
            const range = document.createRange(); range.selectNodeContents(title);
            const a = range.getBoundingClientRect(), b = box(notice);
            if (title.checkVisibility() && a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom) issues.push('header text overlap');
            const controls = [...document.querySelectorAll('.ob-detail-controls, .ob-collection-controls')].map(outer => {
              const tabs = outer.querySelector('[role="tablist"]'), frame = outer.querySelector('.ob-tabs-frame');
              const tabBox = box(tabs);
              const dividers = [outer, frame, tabs].filter(el => parseFloat(getComputedStyle(el).borderBottomWidth) > 0);
              if (dividers.length !== 1) issues.push('expected one tab divider');
              if (!dividers.some(el => Math.abs(box(el).bottom - tabBox.bottom) <= 1)) issues.push('tab divider below actions');
              const panel = document.getElementById(tabs.querySelector('[aria-selected="true"]').getAttribute('aria-controls'));
              const panelGap = box(panel).top - box(outer).bottom;
              if (Math.abs(panelGap - 24) > 0.5) issues.push('controls-to-panel gap: ' + panelGap);
              const actions = outer.querySelector('.ob-local-actions');
              const inputs = actions && [...actions.querySelectorAll('button, input, select')].filter(el => el.checkVisibility());
              const actionBottom = inputs?.length ? Math.max(...inputs.map(el => box(el).bottom)) : null;
              const visibleGap = actionBottom === null ? null : box(panel).top - actionBottom;
              if (visibleGap !== null && Math.abs(visibleGap - 29) > 0.5) issues.push('visible-action-to-panel gap: ' + visibleGap);
              return { outer: box(outer), tabs: tabBox, actions: actions && box(actions), panel: box(panel), panelGap, visibleGap };
            });
            for (const label of document.querySelectorAll('.ob-table-region .ob-table-sort-label')) {
              const r = box(label), th = box(label.closest('th'));
              if (r.right > th.right + 1 || r.left < th.left - 1) issues.push('clipped table heading: ' + label.textContent);
            }
            const contacts = document.querySelector('.ob-responsibility'), facts = document.querySelector('.ob-detail-facts');
            if (contacts && facts && box(contacts).top > box(facts).top + 1) issues.push('responsibility below facts');
            return { controls, issues };
          });
          report.cases.push({ ...scenario, language, route, ...metrics });
          if (sidebar === 360 && language === 'de' && [1024, 1280, 1600].includes(width) && route.startsWith('#/objects/areal?')) {
            await page.screenshot({ path: path.join(output, `laptop-${width}-${route.endsWith('rows') ? 'rows' : 'relations'}.png`) });
          }
        }
      }
    }

    // A live resize must keep search focus, the filter and its result rows.
    await page.setViewportSize({ width: 1304, height: 768 });
    await page.evaluate(() => { DK.preferences.write('sidebarWidth', 360); DK.preferences.write('language', 'de'); });
    await visit('#/objects/areal?tab=rows');
    const input = page.locator('#collection-filter');
    await input.fill('Areal');
    const before = await page.locator('#panel-rows tbody').innerText();
    for (const width of [1305, 1024, 1600, 1304]) {
      await page.setViewportSize({ width, height: 768 });
      await settle(page);
      assert.equal(await input.evaluate(el => el === document.activeElement), true, 'Search lost focus on wrap');
      assert.equal(await input.inputValue(), 'Areal');
      assert.equal(await page.locator('#panel-rows tbody').innerText(), before, 'Resize changed filtered rows');
      assert.equal(await page.locator('#collection-filter-status').isVisible(), true);
    }
    await page.setViewportSize({ width: 1024, height: 768 });
    await visit('#/objects/areal?tab=relations');
    await page.locator('.ob-relations-toggle').click();
    assert.equal(await page.locator('.ob-relations-list').isVisible(), true);
    await page.locator('#tab-relations').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#tab-rows').getAttribute('aria-selected'), 'true');

    fs.writeFileSync(path.join(output, 'laptop-layout.json'), JSON.stringify(report, null, 2));
    const failures = report.cases.filter(c => c.issues.length);
    assert.deepEqual(report.errors, [], 'Browser errors');
    assert.equal(failures.length, 0, JSON.stringify(failures.slice(0, 5), null, 2));
    console.log(`PASS: ${report.cases.length} laptop/phone/desktop layouts, single tab dividers, 24/29 px gaps, header/table bounds, contacts, live filter/focus and relationship navigation`);
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
