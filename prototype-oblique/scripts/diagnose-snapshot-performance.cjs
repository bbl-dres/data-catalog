/* Read-only, bounded browser measurements. No catalog writes or credentials. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer,chromium}=require('../tests/browser-helpers.cjs');
(async()=>{const server=createServer({catalogProvider:'supabase'});let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage(),requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfinished',r=>{if(r.url().includes('/rpc/read_snapshot'))requests.push({body:r.postData(),timing:r.timing()});});
 page.on('requestfailed',r=>{if(r.url().includes('/rpc/read_snapshot'))requests.push({body:r.postData(),timing:r.timing(),failure:r.failure()});});
 await page.goto(`http://127.0.0.1:${server.address().port}/#/tables/t-sap-building?tab=rows`);
 await page.waitForFunction(()=>window.DK?.data?.catalogSnapshot||document.body.innerText.includes('Datenkatalog konnte nicht geladen werden'),{},{timeout:25000});
 const report=await page.evaluate(()=>{
  const s=DK.data.catalogSnapshot,r=performance.getEntriesByType('resource').find(r=>r.name.includes('/rpc/read_snapshot'));
  const start=performance.now();if(s)DK.catalog.project(s);const projectMs=performance.now()-start;
  return {loaded:!!s,fields:s?.data_field.length,history:s?.change_event.length,projectMs,
   request:r?.toJSON(),collections:s?Object.entries(s).filter(([k,v])=>Array.isArray(v)).map(([key,v])=>({key,rows:v.length,bytes:new TextEncoder().encode(JSON.stringify(v)).length})).sort((a,b)=>b.bytes-a.bytes):[]};
 });
 report.requests=requests;report.errors=errors;
 const output=path.join(os.tmpdir(),'catalog-snapshot-performance.json');fs.writeFileSync(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));console.log(output);
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
