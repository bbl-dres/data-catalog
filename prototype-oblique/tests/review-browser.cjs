/* Browser reproductions and editor work counts; mocked identity, no hosted writes. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {workspace}=require('./print-test-helpers.cjs');
(async()=>{
  const test=await workspace(),{page,visit,close,settle,output}=test;
  try {
    await visit('#/');
    let releaseSdk;const sdkGate=new Promise(resolve=>{releaseSdk=resolve;});
    await page.route('**/vendor/supabase/supabase.js',async route=>{await sdkGate;await route.continue();});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#page-content h1').waitFor();
    assert.equal(await page.locator('[data-action="auth-open"]').isDisabled(),true);
    releaseSdk();await page.waitForFunction(()=>!document.querySelector('[data-action="auth-open"]').disabled);
    await page.unroute('**/vendor/supabase/supabase.js');
    console.log('PASS public catalog renders while the Auth SDK download is pending');

    await page.route('**/vendor/swagger-ui/swagger-ui.css',r=>r.fulfill({status:503,body:'unavailable'}));
    await page.evaluate(()=>DK.router.navigate('#/api'));await page.locator('#swagger-ui .ob-empty').waitFor();
    assert.equal(await page.locator('#swagger-ui .swagger-ui').count(),0);
    await page.unroute('**/vendor/swagger-ui/swagger-ui.css');
    await page.evaluate(()=>DK.api.mount(document.getElementById('swagger-ui')));
    await page.locator('.swagger-ui .opblock').first().waitFor();
    assert.equal(await page.locator('link[href="vendor/swagger-ui/swagger-ui.css"]').count(),1);
    console.log('PASS failed Swagger stylesheet gives a retryable error');

    await visit('#/tables/t-gwr-gebaeude');
    await page.waitForFunction(()=>!document.querySelector('[data-action="auth-open"]').disabled);await settle(page);
    await page.evaluate(()=>{
      const table=DK.data.get('tables','t-gwr-gebaeude')._record,snapshot=DK.data.catalogSnapshot;
      const seed=snapshot.data_field.find(f=>f.data_table_id===table.id);
      snapshot.data_field=snapshot.data_field.filter(f=>f.data_table_id!==table.id).concat(Array.from({length:1000},(_,i)=>({...seed,id:crypto.randomUUID(),identifier:'review-'+i,technical_name:'REVIEW_'+i,sort_order:i+1})));
      window.reviewUser={id:'review-user-a'};Object.defineProperty(DK.auth,'user',{get:()=>reviewUser});
      window.reviewLoads=0;window.reviewCapabilities=0;
      DK.data.load=async()=>{reviewLoads++;};
      DK.auth.editRequest=async()=>{reviewCapabilities++;await new Promise(r=>setTimeout(r,20));return {version:1,can_edit:true};};
      DK.app.render();const start=document.querySelector('[data-edit="start"]');start.click();start.click();
    });
    await page.locator('#catalog-editor').waitFor();
    assert.deepEqual(await page.evaluate(()=>[reviewLoads,reviewCapabilities]),[1,1]);
    const work=await page.evaluate(()=>{
      const stringify=JSON.stringify,input=document.querySelector('[data-edit-field="name"]'),original=input.value;
      let calls=0;JSON.stringify=(...args)=>{calls++;return stringify(...args);};
      const start=performance.now();
      try {input.value=original+' review';input.dispatchEvent(new Event('input',{bubbles:true}));}
      finally {JSON.stringify=stringify;}
      const ms=performance.now()-start,count=document.getElementById('edit-unsaved').textContent;
      return {rows:1000,stringifyCalls:calls,ms,count};
    });
    assert(work.stringifyCalls<200,JSON.stringify(work));
    assert.equal(await page.locator('[data-edit="save"]').isDisabled(),false);
    fs.writeFileSync(path.join(output,'review-editor-performance.json'),JSON.stringify(work,null,2));
    console.log('PASS single edit opening and bounded keystroke work: '+JSON.stringify(work));
    await page.evaluate(async()=>{
      const pending=[];DK.auth.editRequest=()=>new Promise(resolve=>pending.push(resolve));
      reviewUser=null;await DK.editor.onAuthChange();
      reviewUser={id:'review-user-a'};const oldA=DK.editor.onAuthChange();
      reviewUser={id:'review-user-b'};const b=DK.editor.onAuthChange();
      reviewUser={id:'review-user-a'};const latestA=DK.editor.onAuthChange();
      pending[2]({version:1,can_edit:false});await latestA;
      pending[1]({version:1,can_edit:true});await b;
      pending[0]({version:1,can_edit:true});await oldA;
    });
    assert.equal(await page.locator('[data-edit="save"]').isDisabled(),true);
    assert(await page.locator('.ob-edit-notice').first().isVisible());
    console.log('PASS an older capability response cannot override the latest result after account changes');
    assert.deepEqual(test.errors,[]);
  } finally {await close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
