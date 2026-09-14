/* Read-only UI verification; hosted writes are never sent by this check. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer,chromium,settle}=require('./browser-helpers.cjs');
const {source,importId}=require('../scripts/refx-building-mmb-import.cjs');
(async()=>{const server=createServer({catalogProvider:'supabase'});let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const live=process.env.MMB_LIVE_READ==='1';
 const snapshot=live?null:JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'refx-building-mmb-snapshot.json'),'utf8'));
 await page.route('https://zicluerzbevodlmtbxow.supabase.co/**',route=>{
  assert.equal(new URL(route.request().url()).pathname,'/rest/v1/rpc/read_snapshot','Only snapshot reads allowed');
  return live?route.continue():route.fulfill({json:snapshot});
 });
 const base=`http://127.0.0.1:${server.address().port}/`;
 const visit=async filter=>{await page.goto(base+'#/tables/t-sap-building?tab=rows'+(filter?'&filter='+encodeURIComponent(filter):''));await page.locator('#panel-rows tbody tr').first().waitFor();await settle(page);};
 await visit('');assert.match(await page.locator('#tab-rows').innerText(),/150/);
 const actual=await page.evaluate(()=>DK.data.get('tables','t-sap-building').fields.map(f=>({name:f.name,status:f.status,group:f.propertyGroup})));
 assert.deepEqual(actual.map(f=>f.name),source.fields.map(f=>f.source.Name));
 assert.equal(await page.locator('#panel-rows tbody tr').count(),50);
 assert.equal(await page.locator('#panel-rows tbody tr').first().locator('td').first().innerText(),'BUILDING');
 assert.match(await page.locator('#panel-rows tbody tr').first().innerText(),/Bezeichnung des GE/);
 await visit('CUS_DATA_0BU');assert.equal(await page.locator('#panel-rows tbody tr').count(),19);
 await visit('Gültig ab_1702');assert.equal(await page.locator('#panel-rows tbody tr').count(),1);
 const history=await page.evaluate(id=>DK.data.history('tables','t-sap-building').filter(e=>e.importId===id),importId);assert.equal(history.length,1);
 assert.equal(await page.evaluate(()=>DK.data.get('apis','api-sap-building').fields.length),378);
 await visit('');
 const output=path.join(os.tmpdir(),'refx-building-mmb-'+(live?'live':'local'));fs.mkdirSync(output,{recursive:true});
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await settle(page);await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({mode:live?'live-read':'isolated',fields:150,exact_names:true,group_filter_rows:19,batch_history_events:1,api_fields_unchanged:378,errors},null,2));
 console.log('MMB browser passed: 150 exact Excel names, default groups, group and original-suffix search, one batch history entry, 378 independent API fields, desktop/mobile. '+output);
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
