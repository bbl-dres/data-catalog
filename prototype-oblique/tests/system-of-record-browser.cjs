/* Real browser controls + local SQL; every hosted Auth/catalog request is intercepted. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { database } = require('./catalog-test-helpers.cjs');
const { configureIdentity, request, uid } = require('./editing-sql.cjs');
const { createServer, chromium } = require('./browser-helpers.cjs');
const project = 'https://zicluerzbevodlmtbxow.supabase.co';
(async () => {
  const db = await database(), server = createServer({ catalogProvider: 'supabase' });
  let browser;
  try {
    await configureIdentity(db);
    const snapshot = async () => (await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
    const s = await snapshot(), [system, other] = s.system;
    const object = s.business_object.find(r => r.identifier === 'gebaeude');
    const attribute = s.business_attribute.find(r => r.business_object_id === object.id);
    const identity = { id: uid, email: 'editor@example.org', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
    const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: uid, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 }].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.test';
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    const saves = [];
    await context.route(project+'/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      if (path === '/rest/v1/rpc/read_snapshot') return route.fulfill({ json: await snapshot() });
      if (path === '/rest/v1/rpc/edit_capabilities') return route.fulfill({ json: { version: 1, can_edit: true } });
      if (path === '/rest/v1/rpc/save_entry') {
        const args = req.postDataJSON(); saves.push(args);
        try { return route.fulfill({ json: await request(db, args) }); }
        catch (e) { return route.fulfill({ status: 400, json: { code: e.code, message: e.message } }); }
      }
      if (path === '/auth/v1/token') return route.fulfill({ json: { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user: identity } });
      if (path === '/auth/v1/user') return route.fulfill({ json: identity });
      throw Error('Unexpected hosted request: '+path);
    });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    const edit = async () => { await page.locator('[data-edit="start"]').click(); await page.locator('#catalog-editor').waitFor(); };
    const selector = () => page.locator('#catalog-editor [data-edit-field="system_of_record_id"]');
    const save = async () => { await page.locator('[data-edit="save"]').click(); await page.locator('#catalog-editor').waitFor({ state: 'detached' }); };
    await page.goto(base+'#/objects/gebaeude'); await page.locator('#page-content h1').waitFor();
    await page.locator('[data-action="auth-open"]').click();
    await page.locator('#auth-email').fill(identity.email); await page.locator('#auth-password').fill('Local test password 123!');
    await page.locator('#auth-form [type="submit"]').click(); await page.locator('#auth-dialog').waitFor({ state: 'hidden' });
    await edit();
    assert.equal(await selector().evaluate(e => e.tagName), 'SELECT');
    assert.deepEqual(await selector().locator('option').evaluateAll(xs => xs.map(x => x.value).filter(Boolean).sort()), s.system.map(x => x.id).sort());
    await selector().selectOption(system.id); await save();
    assert.equal(saves.at(-1).p_patch.system_of_record_id, system.id);
    await page.locator('.ob-core-facts a').filter({ hasText: system.name_de }).first().click();
    assert(page.url().includes('/systems/'+system.identifier), 'Designation links to the actual system');
    const childPath = await page.evaluate(({ object, attribute }) => {
      const parent = DK.data.get('objects', object.identifier), child = parent.attributes.find(r => r._record.id === attribute.id);
      return DK.router.entityHref('attrs', parent.identifier+'/'+child.identifier);
    }, { object, attribute });
    await page.goto(base+childPath); await page.locator('.ob-core-facts').waitFor();
    assert((await page.locator('.ob-core-facts').innerText()).includes('vom Geschäftsobjekt übernommen'));
    await edit(); assert.equal(await selector().inputValue(), '', 'Inherited value is not copied into the stored field');
    assert((await selector().locator('option[value=""]').innerText()).includes('Geschäftsobjekt'));
    await selector().selectOption(other.id); await save();
    assert.equal(saves.at(-1).p_patch.system_of_record_id, other.id);
    assert(!(await page.locator('.ob-core-facts').innerText()).includes('vom Geschäftsobjekt übernommen'));
    await edit(); await selector().selectOption(''); await save();
    assert.equal(saves.at(-1).p_patch.system_of_record_id, null);
    assert((await page.locator('.ob-core-facts').innerText()).includes('vom Geschäftsobjekt übernommen'));
    await page.setViewportSize({ width: 390, height: 844 }); await edit();
    assert(await selector().isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), 'No mobile overflow');
    assert.deepEqual(errors, []);
    console.log('System-of-record browser: UUID-only selection, save/reload, linked system, attribute override/clear/inheritance and mobile form passed.');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
