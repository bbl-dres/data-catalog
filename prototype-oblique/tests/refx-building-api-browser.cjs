/* Read-only UI verification. Default: isolated snapshot from refx-building-api-import.cjs. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer,chromium,settle}=require('./browser-helpers.cjs');
(async()=>{const server=createServer({catalogProvider:'supabase'});let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.REFX_LIVE_READ!=='1'){
  const snapshot=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'refx-building-import-snapshot.json'),'utf8'));
  await page.route('https://zicluerzbevodlmtbxow.supabase.co/**',route=>{
   if(['/rest/v1/rpc/read_snapshot','/rest/v1/rpc/read_catalog_index'].includes(new URL(route.request().url()).pathname))return route.fulfill({json:snapshot});
   throw Error('Unexpected hosted request');
  });
 }
 const base=`http://127.0.0.1:${server.address().port}/`;
 const visit=async filter=>{await page.goto(base+'#/apis/api-sap-building?tab=rows'+(filter?'&filter='+encodeURIComponent(filter):''));await page.locator('#panel-rows tbody tr').first().waitFor();await settle(page);};
 await visit('');assert.match(await page.locator('#tab-rows').innerText(),/378/);
 assert.equal(await page.locator('#panel-rows tbody tr').count(),50);
 assert.equal(await page.locator('#panel-rows tbody tr').first().locator('td').first().innerText(),'BUILDING');
 assert.equal(await page.evaluate(()=>DK.data.get('apis','api-sap-building').fields.length),378);
 await visit('OBJECT_ADDRESS');assert.equal(await page.locator('#panel-rows tbody tr').count(),17);assert.match(await page.locator('#panel-rows').innerText(),/COUNTRY/);
 await visit('PROP_TAX');assert.equal(await page.locator('#panel-rows tbody tr').count(),16);assert.match(await page.locator('#panel-rows').innerText(),/MEMO_CHANGE_OF_DATA/);
 await visit('Eingabeparameter');assert.equal(await page.locator('#panel-rows tbody tr').count(),1);assert.match(await page.locator('#panel-rows').innerText(),/BUILDING_ID/);
 await visit('');
 const layout=await page.evaluate(async()=>{
  const api={...DK.data.get('apis','api-sap-building'),kind:'apis'},snapshot=DK.diagram.snapshot({entity:api},{kind:'apis',title:api.name},'de');
  const settings=DK.diagram.defaults(snapshot),assets=await DK.pdf.load(),layout=DK.diagram.layout(snapshot,settings,DK.pdf.measure(assets));
  return {rows:layout.pages.flatMap(p=>p.flatMap(c=>c.rows.filter(r=>!r.empty))).length,pages:layout.pages.length,orientation:settings.orientation};
 });
 assert.equal(layout.rows,378);assert.equal(layout.orientation,'landscape');
 const output=path.join(os.tmpdir(),'refx-building-api-'+(process.env.REFX_LIVE_READ==='1'?'live':'local'));fs.mkdirSync(output,{recursive:true});
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await settle(page);await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({mode:process.env.REFX_LIVE_READ==='1'?'live-read':'isolated',fields:378,groups:26,address_fields:17,tax_fields:16,input_fields:1,pdf:layout,errors},null,2));
 console.log('RE-FX browser: 378 fields, default groups, group searches, '+layout.pages+' PDF pages and desktop/mobile passed. '+output);
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
