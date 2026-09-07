/* Multi-device capture behind the 2026-09-07 design review: screenshots and layout measurements
   of 18 representative states from 320 px phones to 2560 px desktops. Diagnostic, not an assertion
   suite: compare two runs (for example before and after a layout change) by their measurements.json.
   Output: oblique-design-review in the OS temporary directory. See docs/review/2026-09-07-mobile-design-review.md. */
const fs = require('node:fs');
const path = require('node:path');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const server = createServer();
const dir = path.join(process.env.TEMP || '/tmp', 'oblique-design-review');
const print = [{ click: '[data-export="diagram-pdf"]' }, { wait: '.ob-export-page' }, { sleep: 400 }];
const showGraph = { eval: "document.getElementById('graph-shell').scrollIntoView()" };
const views = [
  { name: 'objects-320', hash: '#/objects', width: 320, height: 568, mobile: true },
  { name: 'objects-table-1366x768', hash: '#/objects?view=table', width: 1366, height: 768 },
  { name: 'objects-1024x768-touch', hash: '#/objects', width: 1024, height: 768, mobile: true },
  { name: 'home-1366x768', hash: '#/', width: 1366, height: 768, actions: [{ scroll: 220 }] },
  { name: 'gebaeude-1093x615', hash: '#/objects/gebaeude', width: 1093, height: 615 },
  { name: 'gebaeude-rows-360', hash: '#/objects/gebaeude', tab: 'rows', width: 360, height: 780, mobile: true },
  { name: 'relations-390', hash: '#/objects/gebaeude', tab: 'relations', width: 390, height: 844, mobile: true, actions: [showGraph] },
  { name: 'relations-320-selected', hash: '#/objects/gebaeude', tab: 'relations', width: 320, height: 568, mobile: true, actions: [{ eval: "document.querySelector('.ob-graph-node').click()" }, { sleep: 200 }, showGraph] },
  { name: 'relations-1280x720', hash: '#/objects/gebaeude', tab: 'relations', width: 1280, height: 720, actions: [showGraph] },
  { name: 'relations-2560x1440', hash: '#/objects/gebaeude', tab: 'relations', width: 2560, height: 1440 },
  { name: 'print-1093x615', hash: '#/objects', width: 1093, height: 615, actions: print },
  { name: 'print-390', hash: '#/objects', width: 390, height: 844, mobile: true, actions: print },
  { name: 'drawer-844x390', hash: '#/objects/gebaeude', width: 844, height: 390, mobile: true, actions: [{ click: '[data-action="open-navigation"]' }] },
  { name: 'footer-320', hash: '#/objects/gebaeude', width: 320, height: 568, mobile: true, actions: [{ eval: 'window.scrollTo(0, document.documentElement.scrollHeight)' }, { sleep: 300 }] },
  { name: 'search-1920', hash: '#/search?q=Geb%C3%A4ude', width: 1920, height: 1080 },
  { name: 'manual-390', hash: '#/manual', width: 390, height: 844, mobile: true },
  { name: 'api-320', hash: '#/api', width: 320, height: 568, mobile: true, actions: [{ eval: "document.querySelector('.models')?.scrollIntoView()" }, { click: '.models > h4' }, { sleep: 400 }] },
  { name: 'objects-2560', hash: '#/objects', width: 2560, height: 1440, actions: [{ scroll: 900 }, { sleep: 300 }] },
];

/** Layout facts of the current state; interactive elements below 44 px matter on the touch views only. */
const measure = () => {
  const rect = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const visible = el => el.checkVisibility() && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  const describe = el => ({ tag: el.tagName.toLowerCase(), class: String(el.className).slice(0, 60), text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), ...rect(el) });
  const root = document.documentElement, vw = root.clientWidth, cs = el => getComputedStyle(el);
  const controls = [...document.querySelectorAll('a[href], button, input, select, [role="tab"], [role="menuitem"]')].filter(el => visible(el) && !el.disabled && !el.closest('[inert]') && !el.matches('.ob-inline-link, .ob-fact-link, p a, li a, td a, .ob-breadcrumb a, .ob-footer a, .ob-skip-link, .ob-tile a, .ob-table-region a'));
  const h1 = document.querySelector('h1'), header = document.getElementById('header'), footer = document.getElementById('footer');
  const tokens = Object.fromEntries(['--ob-content-padding-x', '--ob-control-height', '--ob-header-identity-height', '--ob-facts-label-width', '--ob-footer-height'].map(k => [k, cs(root).getPropertyValue(k).trim()]));
  const tiles = [...document.querySelectorAll('.ob-tile')].filter(visible).map(rect);
  return {
    viewport: { w: vw, h: innerHeight }, overflowX: root.scrollWidth - vw, documentHeight: root.scrollHeight,
    header: header && rect(header), footer: footer && rect(footer),
    h1: h1 && { text: h1.textContent.trim().slice(0, 60), ...rect(h1), lines: Math.round(h1.getBoundingClientRect().height / parseFloat(cs(h1).lineHeight)) },
    tokens, tileColumns: new Set(tiles.map(t => t.x)).size,
    tables: [...document.querySelectorAll('.ob-table-region')].filter(visible).map(el => ({ cards: el.classList.contains('is-cards'), ...rect(el) })),
    smallTargets: controls.filter(el => { const r = rect(el); return r.w < 44 || r.h < 44; }).slice(0, 20).map(describe),
    outside: [...document.querySelectorAll('#page-content *, #header *, #footer *')].filter(el => visible(el) && cs(el).position !== 'fixed' && (el.getBoundingClientRect().right > vw + 1 || el.getBoundingClientRect().left < -1)).slice(0, 10).map(describe),
    graph: (() => { const shell = document.getElementById('graph-shell'), win = document.getElementById('graph'); return shell && win ? { shell: rect(shell).h, window: rect(win).h, zoom: document.getElementById('graph-zoom')?.textContent, toolbarRows: new Set([...document.querySelectorAll('.ob-graph-toolbar .ob-button')].map(b => Math.round(b.getBoundingClientRect().top))).size } : null; })(),
  };
};

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  const results = [];
  try {
    for (const [index, view] of views.entries()) {
      const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: !!view.mobile, isMobile: !!view.mobile });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}?review=${index}${view.hash}`);
      await page.locator('#page-content').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (view.hash.startsWith('#/api')) await page.locator('.swagger-ui .opblock').first().waitFor({ timeout: 30000 });
      if (view.tab) await page.locator(`[data-tab="${view.tab}"]`).click();
      await settle(page);
      for (const action of view.actions || []) {
        if (action.click) await page.locator(action.click).first().click();
        else if (action.wait) await page.locator(action.wait).first().waitFor();
        else if (action.scroll != null) await page.evaluate(y => window.scrollTo(0, y), action.scroll);
        else if (action.eval) await page.evaluate(action.eval);
        else if (action.sleep) await page.waitForTimeout(action.sleep);
        await settle(page);
      }
      const facts = await page.evaluate(measure);
      await page.screenshot({ path: path.join(dir, `${view.name}.png`) });
      results.push({ name: view.name, hash: view.hash, tab: view.tab, mobile: !!view.mobile, errors, ...facts });
      console.log(`${view.name}: ${view.width}×${view.height} overflow ${facts.overflowX} px, h1 ${facts.h1?.lines ?? '–'} line(s), ${facts.smallTargets.length} small targets${facts.graph ? `, diagram ${facts.graph.window} px at ${facts.graph.zoom}` : ''}`);
      await context.close();
    }
    fs.writeFileSync(path.join(dir, 'measurements.json'), JSON.stringify(results, null, 2));
    console.log(`Captured ${results.length} states to ${dir}`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
