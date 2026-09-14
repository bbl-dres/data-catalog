/* Browser editing and display backed by isolated SQL; no hosted writes or credentials. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {database}=require('./catalog-test-helpers.cjs'),{configureIdentity,request,uid}=require('./editing-sql.cjs');
const {createServer,chromium,settle}=require('./browser-helpers.cjs');
const project='https://zicluerzbevodlmtbxow.supabase.co',identity={id:uid,email:'editor@example.org',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=()=>[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.test';
(async()=>{const db=await database(),server=createServer({catalogProvider:'supabase'});let browser;try{
 await configureIdentity(db);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
 await context.route(project+'/**',async route=>{const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/rest/v1/rpc/read_catalog_index')return route.fulfill({json:(await db.query('SELECT catalog.read_catalog_index($1) s',[req.postDataJSON().if_version || null])).rows[0].s});
  if(url.pathname==='/rest/v1/rpc/read_record'){const b=req.postDataJSON();return route.fulfill({json:(await db.query('SELECT catalog.read_record($1,$2,$3) s',[b.record_table,b.record_id,b.if_version || null])).rows[0].s});}
  if(url.pathname==='/rest/v1/rpc/read_history'){const b=req.postDataJSON();return route.fulfill({json:(await db.query('SELECT catalog.read_history($1,$2) s',[b.record_table,b.record_id])).rows[0].s});}
  if(url.pathname==='/rest/v1/rpc/read_snapshot')return route.fulfill({json:(await db.query('SELECT catalog.read_snapshot(true) s')).rows[0].s});
  if(url.pathname==='/rest/v1/rpc/edit_capabilities')return route.fulfill({json:{version:1,can_edit:true,access_options:true,api_fields:true,property_groups:true}});
  if(url.pathname==='/rest/v1/rpc/save_entry'){try{return route.fulfill({json:await request(db,req.postDataJSON())});}catch(e){return route.fulfill({status:400,json:{code:e.code,message:e.message}});}}
  if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:jwt(),refresh_token:crypto.randomUUID(),token_type:'bearer',expires_in:3600,user:identity}});
  if(url.pathname==='/auth/v1/user')return route.fulfill({json:identity});
  throw Error('Unexpected hosted request '+url.pathname);
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const goto=async hash=>{await page.goto(base+hash);await page.locator('#page-content h1').waitFor();await page.waitForFunction(()=>!DK.app.route.recordState?.loading);await settle(page);};
 const tab=async name=>page.locator(`[data-edit="tab"][data-tab="${name}"]`).click();
 const edit=async()=>{await page.locator('[data-edit="start"]').click();await page.locator('#catalog-editor').waitFor();};
 const save=async()=>{await page.locator('[data-edit="save"]').click();await page.locator('#catalog-editor').waitFor({state:'detached'});};
 const groupHeader=()=>page.locator('#panel-rows th').filter({hasText:/^(Gruppe|Groupe|Gruppo|Group)$/});
 await goto('#/apis/api-sap-building?tab=rows');assert.match(await page.locator('#panel-rows').innerText(),/Noch keine API-Felder/);
 await page.locator('[data-action="auth-open"]').click();await page.locator('#auth-email').fill(identity.email);await page.locator('#auth-password').fill('Local test password');await page.locator('#auth-form [type="submit"]').click();await page.locator('#auth-dialog').waitFor({state:'hidden'});
 await edit();await tab('rows');await page.locator('[data-edit="add-row"]').click();
 let row=page.locator('tr[data-edit-row]').last();await row.locator('[data-edit-field="name"]').fill('API-Gebäudename');await row.locator('[data-edit-field="technical_name"]').fill('BUILDING_TEXT');await row.locator('[data-edit-field="property_group"]').fill('BUILDING');await row.locator('[data-edit-field="source_data_type"]').fill('string');
 await tab('endpoints');assert.equal(await page.locator('tr[data-edit-row]').count(),1,'Existing endpoint has its own tab');await row.locator('[data-edit-field="operation_name"]').fill('Unchanged ownership');
 await tab('rows');assert.equal(await row.locator('[data-edit-field="property_group"]').inputValue(),'BUILDING');await save();
 const apiField=(await db.query("SELECT * FROM catalog.data_field WHERE data_service_id IS NOT NULL")).rows[0];assert.equal(apiField.property_group,'BUILDING');assert.equal(apiField.data_type_scope,'serviceSchema');assert.equal(apiField.data_table_id,null);
 assert.equal((await db.query('SELECT count(*)::int n FROM catalog.data_field WHERE data_table_id IS NOT NULL')).rows[0].n,621);
 assert.equal(await groupHeader().count(),1);assert.match(await page.locator('#panel-rows').innerText(),/BUILDING_TEXT/);
 await page.locator('[data-action="field-picker"]').click();await page.locator('.ob-field-picker input[value="propertyGroup"]').uncheck();await page.locator('[data-fields-close]').click();assert.equal(await groupHeader().count(),0);
 await page.reload();await page.locator('#panel-rows').waitFor();assert.equal(await groupHeader().count(),0,'Explicit hiding survives reload');
 await page.locator('[data-action="field-picker"]').click();await page.locator('[data-fields-reset]').click();await page.locator('[data-fields-close]').click();assert.equal(await groupHeader().count(),1);
 await edit();await tab('rows');await page.locator('[data-edit="add-row"]').click();row=page.locator('tr[data-edit-row]').last();await row.locator('[data-edit-field="name"]').fill('API-Ort');await row.locator('[data-edit-field="technical_name"]').fill('CITY');await row.locator('[data-edit-field="property_group"]').fill('OBJECT_ADDRESS');await save();
 await edit();await tab('rows');const first=page.locator('tr[data-edit-row]').first();await first.locator('[data-edit="down"]').click();await save();
 assert.deepEqual((await db.query('SELECT technical_name FROM catalog.data_field WHERE data_service_id IS NOT NULL ORDER BY sort_order')).rows.map(r=>r.technical_name),['CITY','BUILDING_TEXT']);
 await edit();await tab('rows');await page.locator('tr[data-edit-row]').first().locator('[data-edit="archive"]').click();await save();
 assert.equal((await db.query('SELECT count(*)::int n FROM catalog.data_field WHERE data_service_id IS NOT NULL AND is_archived')).rows[0].n,1);
 await edit();await tab('rows');await page.locator('[data-edit-archived]').check();await page.locator('[data-edit="restore"]').click();await save();
 const output=path.join(os.tmpdir(),'oblique-api-fields');fs.mkdirSync(output,{recursive:true});await page.evaluate(()=>document.getElementById('toasts').replaceChildren());await page.screenshot({path:path.join(output,'apis-1440.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await settle(page);assert.equal(await groupHeader().count(),1);await page.screenshot({path:path.join(output,'apis-390.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile page has no overflow outside the scrollable table');
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('.ob-page-actions > [data-export="diagram-pdf"]').click();
 await page.waitForFunction(()=>document.querySelector('#diagram-sheets svg')||document.querySelector('#diagram-error:not([hidden])'));
 assert.equal(await page.locator('#diagram-error-message').innerText(),'','PDF preview loaded');
 await page.locator('[data-diagram-layout="list"]').click();
 const printText=await page.locator('#diagram-sheets').innerText();
 for(const value of ['Gruppe','OBJECT_ADDRESS','BUILDING','CITY','BUILDING_TEXT'])assert(printText.includes(value),'PDF preview includes '+value);
 assert(!printText.includes('2 Endpunkte'),'API field count uses the field label');
 const pdfDownload=page.waitForEvent('download');await page.locator('[data-diagram-action="download"]').click();
 const pdfPath=path.join(output,'api-fields.pdf');await(await pdfDownload).saveAs(pdfPath);assert.equal(fs.readFileSync(pdfPath).subarray(0,5).toString(),'%PDF-');
 await page.waitForFunction(()=>document.getElementById('diagram-busy').hidden);await page.locator('.ob-export-header [data-diagram-action="close"]').first().click();
 for(const [hash,expected] of [['#/tables/t-sap-building?tab=rows','REBDBUFLDS'],['#/objects/gebaeude?tab=rows','Pset_BuildingCommon']]){
  await goto(hash);assert.equal(await groupHeader().count(),1);await edit();await tab('rows');await page.locator('tr[data-edit-row]').first().locator('[data-edit-field="property_group"]').fill(expected);await save();assert.match(await page.locator('#panel-rows').innerText(),new RegExp(expected));
 }
 await goto('#/apis/api-sap-building?tab=rows');
 for(const [language,label] of [['de','Gruppe'],['fr','Groupe'],['it','Gruppo'],['en','Group']]){
  await page.locator('#language-host [data-menu="language"]').click();await page.locator(`#language-host [data-action="set-language"][data-lang="${language}"]`).click();
  assert.equal(await groupHeader().innerText(),label);await edit();await tab('rows');
  assert.equal(await page.locator('tr[data-edit-row]').first().locator('[data-edit-field="property_group"]').inputValue(),'OBJECT_ADDRESS','Group values remain authored text across UI languages');
  await page.locator('[data-edit="discard"]').click();
 }
 assert.deepEqual(errors,[]);console.log('API fields browser: independent field/endpoint saves, groups across all owners, default/hide/reset, reorder/archive/restore, PDF download and desktop/mobile layout passed. Evidence: '+output);
}finally{await browser?.close();await db.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
