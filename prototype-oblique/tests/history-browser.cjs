/* On-demand history in the browser: the app loads the lean snapshot, reads one owner's history per
   profile, shares it with attribute profiles, and shows loading and failure states. Requires
   Playwright and PGlite; every hosted request is intercepted. */
const assert = require('node:assert/strict');
const { database } = require('./catalog-test-helpers.cjs');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');

(async () => {
  const db = await database();
  const server = createServer({ catalogProvider: 'supabase' });
  let browser;
  try {
    const lean = (await db.query('SELECT catalog.read_snapshot(true, false) AS s')).rows[0].s;
    const full = (await db.query('SELECT catalog.read_snapshot(true) AS s')).rows[0].s;
    assert.equal(lean.change_event, undefined, 'The initial load carries no change events');
    const attributesOf = object => full.business_attribute.filter(a => a.business_object_id === object.id);
    const eventsOf = object => full.change_event.filter(e => e.record_business_object_id === object.id || attributesOf(object).some(a => a.id === e.record_business_attribute_id));
    const object = full.business_object.filter(o => !o.is_archived && attributesOf(o).length).sort((a, b) => eventsOf(b).length - eventsOf(a).length)[0];
    const expected = eventsOf(object).length;
    assert(expected > 0, 'The fixture has an object with history');

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [], snapshotBodies = [], historyBodies = [];
    let failHistory = false, holdHistory = null;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://zicluerzbevodlmtbxow.supabase.co/rest/v1/rpc/read_{snapshot,catalog_index}', route => { snapshotBodies.push(route.request().postDataJSON()); return route.fulfill({ json: lean }); });
    await page.route('https://zicluerzbevodlmtbxow.supabase.co/rest/v1/rpc/read_history', async route => {
      const body = route.request().postDataJSON();
      historyBodies.push(body);
      if (failHistory) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
      if (holdHistory) await holdHistory;
      return route.fulfill({ json: (await db.query('SELECT catalog.read_history($1, $2) AS h', [body.record_table, body.record_id])).rows[0].h });
    });
    const visit = async hash => {
      await page.goto(base + hash);
      await page.locator('#page-content h1').waitFor();
      await settle(page);
    };
    // Hash-only navigation stays in the same document and keeps the loaded history; a fresh document starts over.
    const fresh = async hash => { await page.goto('about:blank'); await visit(hash); };
    const historyTab = () => page.locator('#tab-history');
    const until = async (condition, message) => { for (let i = 0; i < 500 && !condition(); i++) await new Promise(resolve => setTimeout(resolve, 10)); assert(condition(), message); };
    const loaded = () => page.waitForFunction(() => /\(\d+\)$/.test(document.getElementById('tab-history')?.textContent || ''));

    await visit(`#/objects/${encodeURIComponent(object.identifier)}`);
    assert.deepEqual(snapshotBodies, [{}], 'The index request accepts a complete fixture without history');
    assert.deepEqual(await page.evaluate(() => [DK.data.historyLoaded, DK.data.changelog.length]), [false, 0]);
    await loaded();
    assert.equal(await historyTab().textContent(), `Verlauf (${expected})`, 'The tab count arrives with the owner history');
    assert.deepEqual(historyBodies, [{ record_table: 'business_object', record_id: object.id }], 'One read for the owning record');
    await historyTab().click();
    await settle(page);
    assert.ok(await page.locator('#panel-history tbody tr').count() > 0, 'History rows render from the on-demand read');
    assert.equal(historyBodies.length, 1, 'Switching tabs reuses the loaded history');

    const attribute = attributesOf(object)[0];
    const href = await page.evaluate(([objectId, attributeId]) => {
      const entity = DK.data.get('objects', objectId);
      return DK.router.entityHref('attrs', DK.data.childId(objectId, entity.attributes.find(a => a._record.id === attributeId)?.identifier || entity.attributes[0].identifier), { tab: 'history' });
    }, [object.identifier, attribute.id]);
    await page.goto(base + href);
    await page.locator('#panel-history').waitFor();
    await settle(page);
    assert.equal(historyBodies.length, 1, 'An attribute profile inherits the loaded object history without another read');
    assert.equal(await page.locator('#panel-history .ob-context-note').count(), 1, 'The inherited-history note remains');
    assert.ok(await page.locator('#panel-history tbody tr').count() > 0);

    // A held response shows the loading state, then the rows.
    let release;
    holdHistory = new Promise(resolve => { release = resolve; });
    await fresh(`#/objects/${encodeURIComponent(object.identifier)}?tab=history`);
    await until(() => historyBodies.length === 2, 'A fresh page load reads history again');
    assert.match(await historyTab().textContent(), /\(…\)$/, 'The count waits for the read');
    assert.equal(await page.locator('#panel-history .ob-loading').count(), 1, 'The panel shows the loading state');
    release();
    holdHistory = null;
    await loaded();
    await page.locator('#panel-history tbody tr').first().waitFor();
    assert.equal(await historyTab().textContent(), `Verlauf (${expected})`);

    // A failed read reports the panel as unavailable without breaking the profile.
    failHistory = true;
    await fresh(`#/objects/${encodeURIComponent(object.identifier)}?tab=history`);
    await page.locator('#panel-history .ob-empty').waitFor();
    assert.match(await page.locator('#panel-history .ob-empty').innerText(), /Verlauf konnte nicht geladen werden/);
    assert.equal(await historyTab().textContent(), 'Verlauf (0)');
    assert.ok(await page.locator('#tab-overview').count(), 'The profile itself stays usable');
    assert.deepEqual(errors, [], 'No page errors');
    console.log(`history-browser: ${historyBodies.length} history reads, ${expected} events for ${object.identifier}`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
