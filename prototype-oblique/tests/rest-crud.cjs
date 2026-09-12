const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {database}=require('../supabase/local-database.cjs');
const {configureIdentity,uid}=require('./editing-sql.cjs');
async function write(db,args,{user=uid,role='authenticated',anonymous=false}={}){
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user||'',JSON.stringify({is_anonymous:anonymous})]);await db.exec('SET ROLE '+role);
 try{return(await db.query('SELECT catalog.api_write($1,$2,$3,$4,$5,$6) AS result',[args.p_operation,args.p_table,args.p_id,args.p_expected_version,args.p_body,args.p_command_id])).rows[0].result;}finally{await db.exec('RESET ROLE');}
}
const command=(table,body={},record=null,operation=record?'update':'create')=>({p_table:table,p_operation:operation,p_id:record?.id||null,p_expected_version:record?.row_version||0,p_body:body,p_command_id:crypto.randomUUID()});
async function run(){
 const db=await database();
 try{
  await configureIdentity(db);const {createHandler,resources}=await import('../supabase/functions/catalog-api/index.ts');
  for(const url of ['ftp://localhost','http://catalog.example','https://user:password@catalog.example'])assert.throws(()=>createHandler({url,publicKey:'sb_publishable_test'}));
  const snap=(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
  const read=async(table,id)=>(await db.query(`SELECT * FROM catalog.${table} WHERE id=$1`,[id])).rows[0];
  const createdByType={};
  for(const table of resources){
   const sample=snap[table][0] || {source_data_table_id:snap.data_table[0].id,target_data_table_id:snap.data_table[1].id,operation:'copy'},keys=(await db.query('SELECT catalog_private.api_columns($1,true) AS keys',[table])).rows[0].keys;
   const body=Object.fromEntries(Object.entries(sample).filter(([k])=>keys.includes(k)&&!['id','identifier','version','version_date'].includes(k)));
   if(body.code)body.code='000'+crypto.randomUUID();if(body.semantic_name)body.semantic_name=crypto.randomUUID();
   if(['relationship','lineage_relation'].includes(table))for(const key of Object.keys(body)){const m=/^source_(.+)_id$/.exec(key);if(m&&body[key]&&createdByType[m[1]])body[key]=createdByType[m[1]].id;}
   const create=command(table,body),created=await write(db,create);assert.equal(created.row_version,1,table+' created');
   assert.deepEqual(await write(db,create),created,table+' retry');
   const change=table==='service_endpoint'?{operation_name:'API test operation'}:table==='lineage_relation'?{transformation_notes_en:'API test note'}:{comment:'API test comment'};
   const updated=await write(db,command(table,change,created));assert.equal(updated.row_version,2,table+' updated');
   assert.equal((await write(db,command(table,change,updated))).row_version,2,'No-op');
   await assert.rejects(write(db,command(table,change,created)),e=>e.code==='40001');
   const archived=await write(db,command(table,{},updated,'delete'));assert(archived.is_archived);assert.equal(archived.row_version,3);
   assert(await read(table,created.id),'DELETE retains identity');
   const restored=await write(db,command(table,{is_archived:false},archived));assert.equal(restored.is_archived,false);assert.equal(restored.row_version,4);
   createdByType[table]=restored;
  }
  const object=snap.business_object[0];let current=await read('business_object',object.id);
  for(const identity of [{user:null},{role:'anon',user:null},{anonymous:true}])await assert.rejects(write(db,command('business_object',{comment:'denied'},current),identity),e=>e.code==='42501');
  for(const body of [{row_version:100},{id:crypto.randomUUID()},{identifier:'rename'},{edited_at:'2026-09-12'}, {unknown:'x'}])await assert.rejects(write(db,command('business_object',body,current)),e=>e.code==='42501');
  for(const table of ['change_event','edit_receipt','anything'])await assert.rejects(write(db,command(table,{})),e=>e.code==='22023');
  const attr=snap.business_attribute[0],attrCurrent=await read('business_attribute',attr.id),ownerBefore=await read('business_object',attr.business_object_id);
  const beforeEvents=(await db.query('SELECT count(*)::int AS n FROM catalog.change_event')).rows[0].n;
  await assert.rejects(write(db,command('business_attribute',{name_en:'Must roll back',quality_requirement_ids:[crypto.randomUUID()]},attrCurrent)),e=>e.code==='23503');
  assert.equal((await read('business_attribute',attr.id)).name_en,attrCurrent.name_en);assert.equal((await db.query('SELECT count(*)::int AS n FROM catalog.change_event')).rows[0].n,beforeEvents);
  const required=await write(db,command('quality_requirement',{name_en:'New required rule',rule_type:'required',dimension:'completeness'}));
  const assigned=await write(db,command('business_attribute',{quality_requirement_ids:[required.id]},attrCurrent));assert.deepEqual(assigned.quality_requirement_ids,[required.id]);
  assert.equal((await read('business_object',attr.business_object_id)).row_version,ownerBefore.row_version+1,'Owned API edits invalidate editor drafts');
  await write(db,command('business_attribute',{quality_requirement_ids:[]},assigned));
  const audit=(await db.query("SELECT count(*)::int AS n FROM catalog.change_event e JOIN catalog_private.edit_event_actor a ON a.event_id=e.id JOIN catalog_private.edit_receipt r ON r.command_id=a.command_id AND r.user_id=a.user_id WHERE e.identifier LIKE 'api-%'")).rows[0].n;
  assert.equal(audit,(await db.query("SELECT count(*)::int AS n FROM catalog.change_event WHERE identifier LIKE 'api-%'")).rows[0].n);
  await db.exec('SET ROLE authenticated');try{await assert.rejects(db.exec("UPDATE catalog.domain SET comment='direct'"),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
  // The actual Edge handler runs with native Request/Response and the real SQL
  // command; transport intercepts avoid any hosted writes or external credentials.
  const token='test.payload.signature',calls=[];
  const handler=createHandler({url:'https://catalog.example',publicKey:'sb_publishable_test',fetcher:async(url,init)=>{
   calls.push({url:String(url),init});assert.equal(init.redirect,'error');assert.equal(init.headers.apikey,'sb_publishable_test');
   if(url.pathname==='/auth/v1/user')return Response.json({id:uid,is_anonymous:false},{status:init.headers.Authorization==='Bearer '+token?200:401});
   if(url.pathname==='/rest/v1/rpc/api_write'){assert.equal(init.headers.Authorization,'Bearer '+token);try{return Response.json(await write(db,JSON.parse(init.body)));}catch(e){return Response.json({code:e.code,message:e.message},{status:400});}}
   const table=url.pathname.split('/').pop(),id=url.searchParams.get('id')?.slice(3);return Response.json(id?[await read(table,id)].filter(Boolean):[]);
  }});
  const send=(path,method='GET',body,headers={})=>handler(new Request('https://catalog.example/functions/v1/catalog-api/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  assert.equal((await send('domain','OPTIONS')).status,204);assert.equal((await send('domain','POST',{name_en:'No auth'},{Authorization:''})).status,401);
  assert.equal((await send('domain','POST',{name_en:'Expired'},{Authorization:'Bearer bad.payload.token'})).status,401);
  assert.equal((await send('domain','POST',{name_en:'No retry key'},{'Idempotency-Key':''})).status,400);
  assert.equal((await send('domain/'+object.id,'PATCH',{name_en:'No revision'})).status,428);
  assert.equal((await send('domain?anything=eq.any','DELETE')).status,405);
  const response=await send('domain','POST',{name_en:'HTTP domain'});assert.equal(response.status,201);assert.equal(response.headers.get('ETag'),'"1"');const record=await response.json();
  assert.equal((await send('domain/'+record.id)).headers.get('ETag'),'"1"');
  assert.equal((await send('domain/'+record.id,'PATCH',{comment:'changed'},{'If-Match':'"1"'})).status,200);
  assert.equal((await send('domain/'+record.id,'PATCH',{comment:'stale'},{'If-Match':'"1"'})).status,412);
  const deleted=await send('domain/'+record.id,'DELETE',undefined,{'If-Match':'"2"'});assert.equal(deleted.status,200);assert.equal((await deleted.json()).is_archived,true);
  const {runtime}=require('./catalog-test-helpers.cjs');
  // Archive referenced containers with live children; records and history remain,
  // while browsing must not acquire broken links to hidden entries.
  const archivedRecords=[];
  for(const table of ['domain','system','business_object','code_list']){
   const before=await read(table,snap[table][0].id);
   archivedRecords.push([table,await write(db,command(table,{},before,'delete'))]);
  }
  const projection=runtime((await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s);await projection.DK.data.load('data/');
  assert(!projection.DK.data.domains.some(r=>r._record.id===record.id),'Archived roots are hidden from public browsing');
  assert.equal(projection.DK.data.validate().length,0,'Archiving referenced parents does not break browsing');
  for(const [table,archived] of archivedRecords){assert(projection.DK.data.catalogSnapshot[table].some(r=>r.id===archived.id));await write(db,command(table,{is_archived:false},archived));}
  const restoredProjection=runtime((await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s);await restoredProjection.DK.data.load('data/');
  assert.equal(restoredProjection.DK.data.objects.length,projection.DK.data.objects.length+1,'Restoring a parent restores its public entry');
  const before=calls.length;assert.equal((await send('change_event','POST',{})).status,404);assert.equal(calls.length,before);
  console.log('REST CRUD: 16 resource lifecycles, archive/restore, auth, revisions, retries, immutable fields, owned quality rules, rollback, audit, denied direct writes and actual HTTP routing passed.');
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={write,command};
