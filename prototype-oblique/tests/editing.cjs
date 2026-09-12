/* Browser + real PostgreSQL commands, with only hosted transport/Auth intercepted. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {database}=require('./catalog-test-helpers.cjs');
const {configureIdentity,request,uid}=require('./editing-sql.cjs');
const {createServer,chromium,settle}=require('./browser-helpers.cjs');
const project='https://zicluerzbevodlmtbxow.supabase.co';
const identity={id:uid,email:'editor@example.org',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=()=>[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.test';
(async()=>{
 const db=await database(),server=createServer({catalogProvider:'supabase'});let browser;
 try{
  await configureIdentity(db);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  let saves=[],failAfterSave=false,failReload=false,holdSave=null,authCalls=[];
  await context.route(project+'/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/rest/v1/rpc/read_snapshot'){
    assert.equal(req.headers().authorization,undefined);
    if(failReload)return route.abort();
    return route.fulfill({json:(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s});
   }
   if(url.pathname==='/rest/v1/rpc/edit_capabilities'){assert(req.headers().authorization?.startsWith('Bearer '));return route.fulfill({json:{version:1,can_edit:true}});}
   if(url.pathname==='/rest/v1/rpc/save_entry'){
    assert(req.headers().authorization?.startsWith('Bearer '));assert.equal(req.headers()['content-profile'],'catalog');
    const args=req.postDataJSON();saves.push(args);if(holdSave)await holdSave;
    try{const result=await request(db,args);if(failAfterSave){failAfterSave=false;return route.abort();}return route.fulfill({json:result});}
    catch(e){return route.fulfill({status:e.code==='40001'?409:400,json:{code:e.code,message:e.message}});}
   }
   authCalls.push(url.pathname);
   if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:jwt(),refresh_token:crypto.randomUUID(),token_type:'bearer',expires_in:3600,user:identity}});
   if(url.pathname==='/auth/v1/user')return route.fulfill({json:identity});
   if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
   throw Error('Unexpected request '+url.pathname);
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const edit=async()=>{await page.locator('[data-edit="start"]').click();await page.locator('#catalog-editor').waitFor();};
  const field=key=>page.locator('#catalog-editor > fieldset > .ob-edit-title [data-edit-field="'+key+'"]');
  const click=action=>page.locator('[data-edit="'+action+'"]').first().click();
  const save=async()=>{await click('save');await page.locator('#catalog-editor').waitFor({state:'detached'});};
  const message=key=>page.waitForFunction(key=>document.querySelector('#edit-message')?.textContent===DK.ui.t(key),key);
  await page.goto(base+'#/objects/gebaeude');await page.locator('#page-content h1').waitFor();
  assert.equal(await page.locator('[data-edit="start"]').count(),0);
  await page.locator('[data-action="auth-open"]').click();await page.locator('[data-auth="reset"]').click();
  assert.equal(await page.locator('#auth-email').count(),0);assert.equal(authCalls.length,0,'Administrator recovery sends no mail');
  await page.locator('[data-auth="login"]').click();await page.locator('#auth-email').fill(identity.email);await page.locator('#auth-password').fill('Strong password 123!');await page.locator('#auth-form [type="submit"]').click();
  await page.locator('#auth-dialog').waitFor({state:'hidden'});await edit();await field('name').waitFor();
  const original=await field('name').inputValue();assert(await page.locator('[data-edit="save"]').isDisabled());
  await field('description').fill('Browser edit description');
  await page.locator('[data-edit-field="comment"]').fill('Local test comment');
  assert.equal(await page.locator('#edit-unsaved').innerText(),'2 ungespeicherte Änderungen');
  await page.locator('#edit-language').selectOption('fr');await field('name').fill('Bâtiment modifié');
  await page.locator('#edit-language').selectOption('de');assert.equal(await field('name').inputValue(),original);
  await page.locator('[data-edit="tab"][data-tab="rows"]').click();
  await click('add-row');const newRow=page.locator('tr[data-edit-row]').last();await newRow.locator('[data-edit-field="name"]').fill('Browser attribute');await newRow.locator('[data-edit-field="valueType"]').selectOption('integer');
  await click('save');await page.locator('#catalog-editor').waitFor({state:'detached'});
  let object=(await db.query("SELECT * FROM catalog.business_object WHERE identifier='gebaeude'")).rows[0];assert.equal(object.name_de,original,'Editing FR never writes DE');assert.equal(object.name_fr,'Bâtiment modifié');assert.equal(object.description_de,'Browser edit description');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM catalog.business_attribute WHERE name_de='Browser attribute'")).rows[0].n,1);
  await edit();await page.locator('[data-edit="tab"][data-tab="rows"]').click();
  const firstId=await page.locator('[data-edit-row]').first().getAttribute('data-edit-row');await page.locator(`[data-edit="down"][data-row="${firstId}"]`).click();
  await save();assert.equal((await db.query('SELECT sort_order FROM catalog.business_attribute WHERE id=$1',[firstId])).rows[0].sort_order,2);
  await edit();await field('name').fill('Unsaved draft');
  await page.evaluate(()=>{location.hash='#/refs';});await page.locator('.ob-edit-confirm').waitFor();await click('keep');assert(await field('name').isVisible());assert.equal(await field('name').inputValue(),'Unsaved draft');
  await click('discard');await click('confirm');assert.equal(await page.locator('#catalog-editor').count(),0);
  await edit();const domain=page.locator('[data-edit-field="domain_id"]'),domainId=await domain.inputValue();await domain.selectOption('');await click('save');await message('edit.validation');assert.equal(await domain.getAttribute('aria-invalid'),'true');await domain.selectOption(domainId);
  // The database, not the browser, detects a concurrent edit.
  await field('description').fill('Draft after conflict');
  await db.query('UPDATE catalog.business_object SET comment=$1 WHERE id=$2',['Concurrent administrator edit',object.id]);
  await click('save');await message('edit.conflict');assert.equal(await field('description').inputValue(),'Draft after conflict');
  await click('discard');await click('confirm');await edit();
  assert.equal(await page.locator('[data-edit-field="comment"]').inputValue(),'Concurrent administrator edit','New draft fetches current data');
  await field('description').fill('Idempotent browser save');failAfterSave=true;await click('save');await message('edit.network');
  const retry=saves.at(-1).p_command_id;await save();assert.equal(saves.at(-1).p_command_id,retry,'Lost response retries the same command');
  await edit();await field('description').fill('Persisted despite reload error');failReload=true;await click('save');await message('edit.savedReloadFailed');
  assert(await field('description').isDisabled());const before=saves.length;await page.locator('[data-edit="reload"]').focus();await page.keyboard.press('Control+s');await settle(page);assert.equal(saves.length,before,'A saved draft cannot resubmit through the keyboard');failReload=false;await click('reload');await page.locator('#catalog-editor').waitFor({state:'detached'});assert.equal(saves.length,before);
  // Screenshot and responsive checks include the real editor with translations.
  const output=path.join(os.tmpdir(),'oblique-editing');fs.mkdirSync(output,{recursive:true});
  await edit();await page.evaluate(()=>document.getElementById('toasts').replaceChildren());await page.screenshot({path:path.join(output,'overview-desktop.png'),fullPage:true});
  await page.locator('[data-edit="tab"][data-tab="rows"]').click();await page.screenshot({path:path.join(output,'rows-desktop.png'),fullPage:true});
  const archivedId=await page.locator('[data-edit-row]').first().getAttribute('data-edit-row');await page.locator(`[data-edit="archive"][data-row="${archivedId}"]`).click();await save();
  assert.equal((await db.query('SELECT is_archived FROM catalog.business_attribute WHERE id=$1',[archivedId])).rows[0].is_archived,true);
  await edit();await page.locator('[data-edit="tab"][data-tab="rows"]').click();await page.locator('[data-edit-archived]').check();await page.locator(`[data-edit="restore"][data-row="${archivedId}"]`).click();await save();
  for(const lang of ['de','fr','it','en']){
   await page.evaluate(l=>{DK.ui.setDictionary(DK.data.i18n,l);DK.app.state.lang=l;DK.app.render();},lang);await page.setViewportSize({width:375,height:812});await edit();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow at '+lang);
   assert.equal(await page.locator('#catalog-editor').evaluate(el=>/edit\.[a-zA-Z]/.test(el.textContent)),false,'No untranslated edit keys');
   await page.evaluate(()=>document.getElementById('toasts').replaceChildren());await page.screenshot({path:path.join(output,`overview-mobile-${lang}.png`),fullPage:true});await click('discard');
  }
  await page.setViewportSize({width:1440,height:1050});await page.evaluate(()=>{DK.ui.setDictionary(DK.data.i18n,'de');DK.app.state.lang='de';location.hash='#/refs';});await page.locator('[data-edit="create"]').waitFor();await click('create');
  await field('name').fill('Browser new code list');await page.locator('[data-edit="tab"][data-tab="rows"]').click();await click('add-row');await page.locator('[data-edit-field="code"]').fill('0007');await page.locator('tr[data-edit-row] [data-edit-field="name"]').fill('Exact code');await save();
  assert.equal((await db.query("SELECT code FROM catalog.code_value WHERE name_de='Exact code'")).rows[0].code,'0007');
  // Endpoint rows do not have translated names. Verify their real SQL defaults,
  // inline validation, persistence and public projection through the same UI.
  await page.evaluate(()=>{location.hash='#/apis';});await page.locator('[data-edit="create"]').waitFor();await click('create');await page.locator('#catalog-editor').waitFor();
  await field('name').fill('Browser API');await page.locator('[data-edit="tab"][data-tab="rows"]').click();await click('add-row');await click('save');await message('edit.validation');
  await page.locator('[data-edit-field="url"]').fill('https://example.org/catalog');await page.locator('[data-edit-field="http_method"]').selectOption('GET');await save();
  assert.equal((await db.query("SELECT url FROM catalog.service_endpoint WHERE url='https://example.org/catalog'")).rows.length,1);
  // Losing the session keeps the draft. Signing back into the same account
  // restores saving; anonymous users never get a working save button.
  await edit();await field('description').fill('Session-safe draft');
  await page.locator('[data-action="auth-open"]').click();await page.locator('#auth-form [type="submit"]').click();await page.locator('#auth-dialog').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('[data-edit="save"]').disabled);
  assert.equal(await field('description').inputValue(),'Session-safe draft');await click('login');
  await page.locator('#auth-email').fill(identity.email);await page.locator('#auth-password').fill('Local test password!123');await page.locator('#auth-form [type="submit"]').click();await page.locator('#auth-dialog').waitFor({state:'hidden'});
  await page.waitForFunction(()=>!document.querySelector('[data-edit="save"]').disabled);
  let releaseSave;holdSave=new Promise(resolve=>{releaseSave=resolve;});const previousSaves=saves.length;
  await click('save');await page.waitForFunction(()=>document.querySelector('#catalog-editor').getAttribute('aria-busy')==='true');
  await page.locator('#catalog-editor').evaluate(el=>el.querySelector('[data-edit="save"]').dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await page.evaluate(()=>{location.hash='#/domains';});await settle(page);
  assert(await page.locator('#catalog-editor').isVisible(),'Navigation stays on the pending save');
  releaseSave();holdSave=null;await page.locator('#catalog-editor').waitFor({state:'detached'});assert.equal(saves.length,previousSaves+1,'Busy save cannot be duplicated');
  for(const kind of ['domains','systems','objects','tables','products']){
   await page.evaluate(kind=>{location.hash='#/'+kind;},kind);await page.locator('[data-edit="create"]').waitFor();await click('create');await page.locator('#catalog-editor').waitFor();await field('name').fill('Browser new '+kind);
   if(kind==='objects')await page.locator('[data-edit-field="domain_id"]').selectOption({index:1});
   if(kind==='tables')await page.locator('[data-edit-field="system_id"]').selectOption({index:1});
   if(kind==='tables'||kind==='products'){
    await page.locator('[data-edit="tab"][data-tab="rows"]').click();await click('add-row');await page.locator('tr[data-edit-row] [data-edit-field="name"]').fill('Owned '+kind);
    if(kind==='tables')await page.locator('[data-edit-field="technical_name"]').fill('TEST_FIELD');
    else await page.locator('[data-edit-field="valueType"]').selectOption('text');
   }
   await save();assert.equal(await page.locator('#page-content h1').innerText(),'Browser new '+kind);
  }
  assert.deepEqual(errors,[]);
  console.log('Editing browser: login, administrator recovery, profile/row saves, translations, reorder, archive/restore, discard/navigation, validation, conflict, safe retry, reload failure, creation and four-language mobile checks passed. Screenshots: '+output);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
