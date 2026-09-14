/* Real browser forms + isolated SQL; no requests reach hosted authentication or writes. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {database}=require('./catalog-test-helpers.cjs');
const {configureIdentity,request,uid}=require('./editing-sql.cjs');
const {createServer,chromium,settle}=require('./browser-helpers.cjs');
const identity={id:uid,email:'review@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=()=>[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.test';
(async()=>{
 const db=await database(),server=createServer({catalogProvider:'supabase'});let browser;
 try{
  await configureIdentity(db);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/`,out=path.join(os.tmpdir(),'oblique-access-options');fs.mkdirSync(out,{recursive:true});
  const owners=[];
  for(const [table,kind] of [['data_table','tables'],['data_product','products'],['data_service','apis']]){
   const owner=(await db.query(`SELECT * FROM catalog.${table} WHERE NOT is_archived ORDER BY identifier LIMIT 1`)).rows[0];
   // Deliberately reuse the owner's UUID to verify namespaced form identity.
   const values=[{id:owner.id,name_de:'Excel-Export',name_fr:'Export Excel',name_it:'Esportazione Excel',name_en:'Excel export',format:'XLSX',status:'valid',isArchived:false,accessUrl:'https://example.invalid/access',downloadUrl:'https://example.invalid/data.xlsx',accessNotes:'Zugriff über die zuständige Stelle anfordern.',license:'Interne Nutzung'},
     {id:crypto.randomUUID(),name_de:'Daten im Fachsystem',format:'Datenbank',status:'draft',isArchived:false,accessNotes:'Im Fachsystem unter Stammdaten verfügbar.'}];
   await db.query(`UPDATE catalog.${table} SET access_options=$1 WHERE id=$2`,[values,owner.id]);owners.push({table,kind,owner,values});
  }
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});let oldSchema=false,saves=0;
  await context.route('https://zicluerzbevodlmtbxow.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(['/rest/v1/rpc/read_snapshot','/rest/v1/rpc/read_catalog_index'].includes(url.pathname)){
    const snapshot=(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
    if(oldSchema)for(const table of ['data_table','data_product','data_service'])snapshot[table].forEach(r=>delete r.access_options);
    return route.fulfill({json:snapshot});
   }
   if(url.pathname==='/rest/v1/rpc/edit_capabilities')return route.fulfill({json:{version:1,can_edit:true,access_options:!oldSchema}});
   if(url.pathname==='/rest/v1/rpc/save_entry'){
    saves++;try{return route.fulfill({json:await request(db,req.postDataJSON())});}catch(e){return route.fulfill({status:400,json:{code:e.code,message:e.message}});}
   }
   if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:jwt(),refresh_token:crypto.randomUUID(),token_type:'bearer',expires_in:3600,user:identity}});
   if(url.pathname==='/auth/v1/user')return route.fulfill({json:identity});
   if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
   throw Error('Unexpected request: '+url.pathname);
  });
  const page=await context.newPage(),errors=[],measurements=[];page.on('pageerror',e=>errors.push(e.message));
  let visitCount=0;
  const visit=async item=>{await page.goto(base+`?access-test=${++visitCount}#/${item.kind}/${encodeURIComponent(item.owner.identifier)}`);await page.locator('#page-content h1').waitFor();await page.evaluate(()=>document.fonts.ready);await settle(page);};
  const measure=async(name)=>{await settle(page);const value=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,panels:[...document.querySelectorAll('.ob-access-option,.ob-edit-access-option')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,width:r.width};})}));assert.equal(value.width,value.documentWidth,name);measurements.push({name,...value});};
  for(const item of owners){
   await visit(item);const buttons=page.locator('.ob-access-option .ob-detail-section-toggle');assert(await buttons.count()>=2);
   await buttons.first().focus();await page.keyboard.press('Enter');assert.equal(await buttons.first().getAttribute('aria-expanded'),'true');assert.equal(await buttons.nth(1).getAttribute('aria-expanded'),'false');
   const sectionButton=page.locator('#ob-access-options-toggle'),sectionContent=page.locator('#ob-access-options-content');
   assert.equal(await sectionButton.getAttribute('aria-expanded'),'true');
   assert(await sectionButton.locator('.ob-icon').count(),'Section has the shared chevron');
   const bounds=await sectionButton.evaluate(el=>({button:el.getBoundingClientRect().width,section:el.closest('section').getBoundingClientRect().width}));
   assert(Math.abs(bounds.button-bounds.section)<2,'Heading fills the available section width');
   await sectionButton.click();assert(await sectionContent.isHidden(),'Click collapses the complete section');
   await page.emulateMedia({media:'print'});assert(await page.locator('.ob-access-option dl').nth(1).isVisible(),'Print reveals collapsed parent and child sections');await page.emulateMedia({media:'screen'});
   await sectionButton.focus();await page.keyboard.press('Space');assert(await sectionContent.isVisible(),'Space expands section');
   assert.equal(await buttons.first().getAttribute('aria-expanded'),'true','Child choice survives parent collapse');
   await page.locator('.ob-access-options').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,item.kind+'-1440.png')});
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await measure(item.kind+'-'+width);if(width===390){await page.locator('.ob-access-options').evaluate(el=>scrollBy(0,el.getBoundingClientRect().top-document.querySelector('#header').getBoundingClientRect().bottom-16));await page.screenshot({path:path.join(out,item.kind+'-390.png')});}}
   await page.emulateMedia({media:'print'});assert(await page.locator('.ob-access-option dl').nth(1).isVisible(),'Print reveals collapsed descriptions');await page.emulateMedia({media:'screen'});
   await page.setViewportSize({width:1440,height:1000});
   await page.locator('.ob-page-actions > [data-export="diagram-pdf"]').click();
   await page.waitForFunction(()=>!!document.querySelector('#diagram-sheets svg,#diagram-error:not([hidden])'));
   await page.locator('[data-diagram-action="columns"]').click();
   const choice=page.locator('[name="column"][value$="accessOptions"]');assert.equal(await choice.count(),1);assert(!await choice.isChecked(),'Hidden by default');await choice.check();
   await page.locator('[data-diagram-action="dismiss"]').click();await settle(page);
   assert.equal(await page.locator('#diagram-error-message').innerText(),'');
   const download=page.waitForEvent('download');await page.locator('[data-diagram-action="download"]').click();await(await download).saveAs(path.join(out,`access-options-${item.kind}.pdf`));
   await page.waitForFunction(()=>document.getElementById('diagram-busy').hidden);await page.locator('.ob-export-header [data-diagram-action="close"]').click();
  }
  for(const language of ['fr','it','en','de'])for(const width of [320,1440]){
   await page.evaluate(language=>DK.preferences.write('language',language),language);await page.setViewportSize({width,height:900});await visit(owners[0]);
   assert.equal(await page.evaluate(()=>DK.ui.language()),language);
   const title=await page.locator('#access-options-title').innerText();assert(!title.includes('?'),'Translated heading retains accents');await measure('profile-'+language+'-'+width);
  }
  await page.setViewportSize({width:1440,height:1000});await visit(owners[0]);await page.locator('[data-action=auth-open]').click();await page.locator('#auth-email').fill(identity.email);await page.locator('#auth-password').fill('Local test');await page.locator('#auth-form [type=submit]').click();
  const edit=async()=>{await page.locator('[data-edit=start]').click();await page.locator('[data-edit=tab][data-tab=access]').click();};
  const save=async()=>{await page.locator('[data-edit=save]').click();await page.locator('#catalog-editor').waitFor({state:'detached'});};
  for(const item of owners){
   await visit(item);await edit();
   const name=page.locator('[data-edit-table=access_option][data-edit-field=name]').first();await name.fill('Bearbeitete Bereitstellung');
   assert.equal(await page.locator('.ob-edit-title [data-edit-field=name]').inputValue(),item.owner.name_de || '', 'Access UUID cannot edit owner name');
   await save();let stored=(await db.query(`SELECT * FROM catalog.${item.table} WHERE id=$1`,[item.owner.id])).rows[0];assert.equal(stored.access_options[0].name_de,'Bearbeitete Bereitstellung');
  }
  await visit(owners[0]);await edit();await page.locator('[data-edit=access-add]').click();
  const last=page.locator('.ob-edit-access-option').last();await last.locator('[data-edit-field=name]').fill('Neue Bereitstellung');
  await last.locator('[data-edit-field=status]').evaluate(el=>{el.value='valid';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const prior=saves;await page.locator('[data-edit=save]').click();assert.equal(saves,prior,'Missing location is rejected before request');
  await page.locator('[data-edit-table=access_option][data-edit-field=accessNotes]').last().fill('In SAP: Transaktion ZDATA öffnen.');
  assert.equal(await page.locator('[data-edit-table=access_option][data-edit-field=accessUrl]').last().getAttribute('aria-invalid'),'false','Instructions clear the location error');
  await page.locator('[data-edit=access-up]').last().click();
  await page.evaluate(()=>document.getElementById('toasts').replaceChildren());await page.locator('.ob-edit-access-tools').first().evaluate(el=>scrollBy(0,el.getBoundingClientRect().top-document.querySelector('#header').getBoundingClientRect().bottom-16));
  await page.screenshot({path:path.join(out,'editor-1440.png')});
  for(const language of ['de','fr','it','en'])for(const width of [320,390,1440]){
   await page.locator('#edit-language').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},language);
   await page.setViewportSize({width,height:844});await measure('editor-'+language+'-'+width);
   if(width===390&&language==='de'){await page.locator('.ob-edit-access-tools').first().evaluate(el=>scrollBy(0,el.getBoundingClientRect().top-document.querySelector('#header').getBoundingClientRect().bottom-16));await page.screenshot({path:path.join(out,'editor-390.png')});}
  }
  await save();await edit();await page.locator('[data-edit=access-archive]').first().click();await save();
  let stored=(await db.query('SELECT access_options FROM catalog.data_table WHERE id=$1',[owners[0].owner.id])).rows[0].access_options;assert(stored[0].isArchived);assert.equal(stored[1].name_de,'Neue Bereitstellung');
  await edit();await page.locator('[data-edit=access-show-archived]').click();await page.locator('[data-edit=access-restore]').click();await save();
  stored=(await db.query('SELECT access_options FROM catalog.data_table WHERE id=$1',[owners[0].owner.id])).rows[0].access_options;assert(!stored[0].isArchived);
  oldSchema=true;await visit(owners[0]);assert(await page.locator('.ob-access-options').isVisible());await edit();assert.equal(await page.locator('[data-edit=access-add]').count(),0,'Old database cannot send unsupported fields');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify({measurements,errors},null,2));
  console.log('PASS: expandable profiles, keyboard/print, all three editors, validation, name isolation, ordering, archive/restore, four languages, mobile bounds and old-schema compatibility. Evidence: '+out);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
