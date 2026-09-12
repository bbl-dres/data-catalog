const assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path'),os=require('node:os');
const {database}=require('../supabase/local-database.cjs');
const {configureIdentity,uid}=require('./editing-sql.cjs');
const {write}=require('./rest-crud.cjs');
const {createServer,chromium,settle}=require('./browser-helpers.cjs');
const project='https://zicluerzbevodlmtbxow.supabase.co';
const identity={id:uid,email:'api-user@example.org',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=()=>[{alg:'HS256',typ:'JWT'},{sub:uid,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.test-signature';
(async()=>{
 const db=await database(),server=createServer({catalogProvider:'supabase'});let browser;
 try{
  await configureIdentity(db);const {createHandler}=await import('../supabase/functions/catalog-api/index.ts');
  let currentToken=jwt(),writes=[];
  const handler=createHandler({url:project,publicKey:'sb_publishable_test',fetcher:async(url,init)=>{
   if(url.pathname==='/auth/v1/user')return Response.json(identity);
   if(url.pathname==='/rest/v1/rpc/api_write'){assert.equal(init.headers.Authorization,'Bearer '+currentToken);const args=JSON.parse(init.body);writes.push(args);try{return Response.json(await write(db,args));}catch(e){return Response.json({code:e.code,message:e.message},{status:400});}}
   const table=url.pathname.split('/').pop(),id=url.searchParams.get('id')?.slice(3);return Response.json((await db.query(`SELECT * FROM catalog.${table} WHERE id=$1`,[id])).rows);
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{window.copiedToken=null;Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(window.clipboardDenied)throw Error('Clipboard unavailable');window.copiedToken=value;}}});});
  await context.route(project+'/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/rest/v1/rpc/read_snapshot')return route.fulfill({json:(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s});
   if(url.pathname==='/rest/v1/rpc/edit_capabilities')return route.fulfill({json:{version:1,can_edit:true}});
   if(url.pathname==='/auth/v1/token')return route.fulfill({json:{access_token:currentToken,refresh_token:crypto.randomUUID(),token_type:'bearer',expires_in:3600,user:identity}});
   if(url.pathname==='/auth/v1/user')return route.fulfill({json:identity});
   if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
   if(url.pathname.startsWith('/functions/v1/catalog-api/')){
    const response=await handler(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.postData()?{body:req.postData()}:{} )}));
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
   }
   throw Error('Unexpected '+url.pathname);
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#/api');await page.locator('#swagger-ui .ob-swagger-content[aria-busy="false"]').waitFor();
  await page.locator('[data-action="auth-open"]').click();await page.locator('#auth-email').fill(identity.email);await page.locator('#auth-password').fill('Local test password!123');await page.locator('#auth-form [type="submit"]').click();await page.locator('#auth-dialog').waitFor({state:'hidden'});
  await page.locator('[data-action="auth-open"]').click();assert.equal(await page.locator('#auth-api-token').inputValue(),'');
  await page.locator('[data-auth="show-token"]').click();await page.waitForFunction(()=>!document.querySelector('#auth-api-token').hidden);assert.equal(await page.locator('#auth-api-token').inputValue(),currentToken);assert(await page.locator('#auth-api-expiry').isVisible());
  await page.locator('[data-auth="copy-token"]').click();await page.waitForFunction(()=>window.copiedToken!==null);assert.equal(await page.evaluate(()=>window.copiedToken),currentToken);
  await page.locator('[data-auth="show-token"]').click();await page.evaluate(()=>window.clipboardDenied=true);
  await page.locator('[data-auth="copy-token"]').click();await page.waitForFunction(()=>!document.querySelector('#auth-api-token').hidden);assert.equal(await page.locator('#auth-api-token').inputValue(),currentToken);
  assert(await page.evaluate(()=>{const t=document.querySelector('#auth-api-token');return t.selectionStart===0&&t.selectionEnd===t.value.length;}),'Clipboard fallback selects the complete token');
  for(const width of [390,320]){await page.setViewportSize({width,height:700});await settle(page);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#auth-dialog').screenshot({path:path.join(os.tmpdir(),'catalog-api-account-'+width+'.png')});}
  await page.locator('[data-auth="show-token"]').click();assert.equal(await page.locator('#auth-api-token').inputValue(),'');await page.locator('[data-auth="close"]').click();assert.equal(await page.locator('#auth-api-token').count(),0);
  await page.setViewportSize({width:1440,height:1000});
  const open=async id=>{const op=page.locator('#operations-Domains-'+id+'_domain');await op.locator('.opblock-summary-control').click();await op.getByRole('button',{name:'Try it out',exact:true}).click();return op;};
  const fill=async(op,name,value)=>op.locator(`tr[data-param-name="${name}"] input`).fill(value);
  const execute=async op=>{await op.getByRole('button',{name:'Execute',exact:true}).click();await op.locator('.live-responses-table').waitFor();};
  const create=await open('create');await fill(create,'Idempotency-Key',crypto.randomUUID());await create.locator('textarea.body-param__text').fill(JSON.stringify({name_en:'Swagger created domain'}));await execute(create);
  assert.match(await create.locator('.live-responses-table').innerText(),/201/);const record=(await db.query("SELECT * FROM catalog.domain WHERE name_en='Swagger created domain'")).rows[0];assert(record);
  await create.locator('.opblock-summary-control').click();
  const update=await open('update');await fill(update,'id',record.id);await fill(update,'If-Match','"1"');await fill(update,'Idempotency-Key',crypto.randomUUID());await update.locator('textarea.body-param__text').fill(JSON.stringify({comment:'Swagger update'}));await execute(update);assert.equal((await db.query('SELECT comment FROM catalog.domain WHERE id=$1',[record.id])).rows[0].comment,'Swagger update');
  await update.locator('.opblock-summary-control').click();const archive=await open('archive');await fill(archive,'id',record.id);await fill(archive,'If-Match','"2"');await fill(archive,'Idempotency-Key',crypto.randomUUID());await execute(archive);assert.equal((await db.query('SELECT is_archived FROM catalog.domain WHERE id=$1',[record.id])).rows[0].is_archived,true);
  assert.equal(writes.length,3);assert.deepEqual(errors,[]);
  await page.locator('[data-action="auth-open"]').click();await page.locator('#auth-form [type="submit"]').click();await page.locator('#auth-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#auth-api-token').count(),0);
  console.log('REST browser: account token reveal/hide/copy/expiry, responsive modal, credential clearing, real Swagger POST/PATCH/DELETE with current session and audited SQL saves passed.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
