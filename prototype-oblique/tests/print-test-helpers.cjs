const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const output = path.join(os.tmpdir(), 'oblique-diagram-export');
fs.mkdirSync(output, { recursive: true });

async function workspace(options = {}) {
  const database = process.env.DIAGRAM_SUPABASE === '1';
  const server = createServer({ catalogProvider: database ? 'supabase' : 'json' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, ...options });
  if (database) {
    const db = await require('./catalog-test-helpers.cjs').database();
    try {
      const snapshot = (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot;
      await page.route('**/rest/v1/rpc/read_snapshot', route => route.fulfill({ json: snapshot }));
    } finally { await db.close(); }
  }
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let visits = 0;
  const visit = async route => {
    await page.goto(`http://127.0.0.1:${server.address().port}/?print-test=${++visits}${route}`);
    await page.locator('#page-content h1').waitFor();
    await page.evaluate(() => {
      const layout = DK.diagram.layout;
      DK.diagram.layout = (...args) => { const result = layout(...args); window.printTest = { snapshot: args[0], settings: args[1], layout: result }; return result; };
    });
  };
  const open = async () => {
    await page.locator('.ob-page-actions > [data-export="diagram-pdf"]').click();
    await page.waitForFunction(() => !!(document.querySelector('#diagram-sheets svg') || document.querySelector('#diagram-error:not([hidden])')));
    await settle(page);
  };
  const download = async name => {
    const expected = await page.evaluate(() => {
      const { snapshot, settings, layout } = window.printTest;
      const texts = layout.pages.map((_, index) => {
        const svg = new DOMParser().parseFromString(DK.diagram.pageSvg(snapshot, settings, layout, index, DK.pdf.palette(), ''), 'image/svg+xml');
        return [...svg.querySelectorAll('text')].map(node => node.textContent);
      });
      return { manifest: DK.diagram.manifest(snapshot, settings), width: layout.width, height: layout.height, texts };
    });
    const pending = page.waitForEvent('download'); await page.locator('[data-diagram-action="download"]').click();
    await (await pending).saveAs(path.join(output, name + '.pdf'));
    await page.waitForFunction(() => document.getElementById('diagram-busy').hidden);
    fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(expected));
  };
  const close = async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); };
  const choose = async (selector, value) => {
    if (selector === '[data-diagram-setting="layout"]') { await page.locator(`[data-diagram-layout="${value}"]`).click(); return; }
    const select = typeof selector === 'string' ? page.locator(selector) : selector;
    const index = await select.evaluate((el, value) => [...el.options].findIndex(option => option.value === String(value)), value);
    if (index < 0) throw new Error(`Missing select option: ${value}`);
    await select.locator('..').locator(':scope > button').click();
    await page.locator(`.ob-menu--select [data-select-option="${index}"]`).click();
  };
  const scrollToPage = async index => {
    await page.locator(`[data-diagram-page="${index}"]`).evaluate((el, index) => {
      const canvas = document.querySelector('#diagram-canvas');
      canvas.scrollTop = index === 0 ? 0 : canvas.scrollTop + el.getBoundingClientRect().top - canvas.getBoundingClientRect().top;
    }, index);
    await settle(page);
  };
  const clearSelection = async () => {
    await page.locator('#diagram-scope-panel').evaluate(el => { el.open = true; });
    const kind = await page.evaluate(() => window.printTest.snapshot.kind);
    const branches = page.locator(`[data-diagram-toggle^="${kind}:"][aria-expanded="false"]`);
    while (await branches.count()) await branches.first().click();
    const selected = await page.locator('[data-diagram-entity]:checked').evaluateAll(els => els.map(el => el.dataset.diagramEntity));
    for (const id of selected) await page.locator(`[data-diagram-entity="${id}"]`).uncheck();
  };
  return { page, errors, visit, open, download, close, output, settle, choose, scrollToPage, clearSelection };
}
module.exports = { workspace, output };
