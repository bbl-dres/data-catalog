/* Row movement and saved-order restoration in a real browser, using local SQL only. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { database } = require('./catalog-test-helpers.cjs');
const { configureIdentity, request, uid } = require('./editing-sql.cjs');
const { createServer, chromium, settle } = require('./browser-helpers.cjs');
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

    await page.locator('[data-edit="tab"][data-tab="rows"]').click();
    const ids=()=>page.locator('[data-edit-row]').evaluateAll(xs=>xs.map(x=>x.dataset.editRow));
    const initial=await ids();
    await page.locator('[data-edit="archive"][data-row="'+initial[1]+'"]').click();
    const before=await ids();
    await page.locator('[data-edit="down"][data-row="'+initial[0]+'"]').click();
    const after=await ids();
    assert.equal(after[0],before[1]);assert.equal(after[1],before[0],'Movement skips a hidden archived row');
    await save();
    await page.locator('#tab-rows').click();
    const names=()=>page.locator('.ob-detail-rows tbody [data-field="name"]').allTextContents();
    const saved=await names();assert(saved.length>2);
    await page.locator('[data-sort-field="name"]').click();
    assert(await page.locator('[data-action="restore-row-order"]').isEnabled());
    await page.reload();await page.locator('.ob-detail-rows tbody').waitFor();
    assert(page.url().includes('sort=name'));
    await page.locator('[data-action="restore-row-order"]').click();
    assert.deepEqual(await names(),saved);assert(!page.url().includes('sort='));
    assert(await page.locator('[data-action="restore-row-order"]').isDisabled());
    await page.setViewportSize({width:390,height:844});await settle(page);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,
      JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('#page-content *')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().right>innerWidth+1).slice(0,10).map(e=>({class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})))));
    await edit();await page.locator('[data-edit="tab"][data-tab="rows"]').click();
    await page.locator('[data-edit-filter]').fill('unmatched filter');
    assert.equal(await page.locator('[data-edit-row]').count(),0);
    await page.locator('[data-edit-filter]').fill('');
    await page.locator('[data-edit-archived]').check();
    const all=await ids();assert.equal(all[1],initial[1],'Archived row retains its slot');
    await page.locator('[data-edit="discard"]').click();
    await page.goto(base+'#/tables/t-gwr-gebaeude');await page.locator('#page-content h1').waitFor();
    await edit();await page.locator('[data-edit="tab"][data-tab="rows"]').click();
    await page.locator('[data-edit="next"]').click();
    const crossing=(await ids())[0];
    await page.locator('[data-edit="up"][data-row="'+crossing+'"]').click();
    assert((await ids()).includes(crossing),'Moved row remains visible across page boundaries');
    assert(await page.locator('[data-edit="previous"]').isDisabled(),'Moving up from page two follows the row to page one');
    assert.deepEqual(errors,[]);
    console.log('Row-order browser: hidden archives, movement, saved order, URL/reload reset, filtering and mobile passed.');
  } finally {if(browser)await browser.close();server.close();await db.close();}
})().catch(e=>{console.error(e);process.exit(1)});
