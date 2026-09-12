const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { database } = require('./catalog-test-helpers.cjs');
const uid = '8c965b13-447c-4a66-bb17-7b9e0b791cb0';
async function configureIdentity(db) {
  await db.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;`);
}
async function request(db, args, {role='authenticated',user=uid,anonymous=false}={}) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user || '',JSON.stringify({is_anonymous:anonymous})]);
  await db.exec('SET ROLE '+role);
  try { return (await db.query('SELECT catalog.save_entry($1,$2,$3,$4,$5,$6) AS result',[args.p_command_id,args.p_table,args.p_id,args.p_expected_version,args.p_patch,args.p_children || []])).rows[0].result; }
  finally { await db.exec('RESET ROLE'); }
}
const command = (table,r,patch,children=[]) => ({p_command_id:crypto.randomUUID(),p_table:table,p_id:r.id,p_expected_version:r.row_version || 0,p_patch:patch,p_children:children});
async function run() {
 const db = await database();
 try {
  await configureIdentity(db);
  let snap = (await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
  const object = snap.business_object.find(r=>r.identifier==='gebaeude');
  const read = async(table,id)=>(await db.query(`SELECT * FROM catalog.${table} WHERE id=$1`,[id])).rows[0];
  const edit = command('business_object',object,{comment:'Edited locally'});
  for(const identity of [{role:'anon',user:null},{user:null},{anonymous:true}]) await assert.rejects(request(db,edit,identity),e=>e.code==='42501');
  for(const patch of [{id:crypto.randomUUID()},{row_version:999},{identifier:'hijack'},{edited_at:'2026-09-12'},{record_actor_id:uid}]) await assert.rejects(request(db,command('business_object',object,patch)),e=>e.code==='42501');
  await assert.rejects(request(db,command('relationship',{id:snap.relationship[0].id,row_version:1},{comment:'no'})),e=>e.code==='22023');
  const termLinks=object.documentation_links.filter(x=>x.purpose==='terminology');
  if(termLinks.length)await assert.rejects(request(db,command('business_object',object,{documentation_links:[]})),e=>e.code==='42501');
  const result=await request(db,edit);
  assert.equal(result.row_version,object.row_version+1);
  assert.equal((await read('business_object',object.id)).comment,'Edited locally');
  assert.deepEqual(await request(db,edit),result,'Same command can be retried');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM catalog.change_event WHERE identifier LIKE 'edit-%'")).rows[0].n,1);
  await assert.rejects(request(db,{...edit,p_patch:{comment:'different'}}),e=>e.code==='22023');
  await assert.rejects(request(db,command('business_object',object,{comment:'stale'})),e=>e.code==='40001');
  let current=await read('business_object',object.id);
  const child=snap.business_attribute.find(r=>r.business_object_id===object.id);
  const unrelated=snap.business_attribute.find(r=>r.business_object_id!==object.id);
  await assert.rejects(request(db,command('business_object',current,{comment:'must roll back'},[{id:unrelated.id,expected_version:unrelated.row_version,patch:{comment:'wrong owner'}}])),e=>e.code==='42501');
  assert.equal((await read('business_object',object.id)).comment,'Edited locally','Root changes roll back with child errors');
  const beforeChild=await read('business_attribute',child.id);
  const childSave=await request(db,command('business_object',current,{},[{id:child.id,expected_version:child.row_version,patch:{name_fr:'Nom français',sort_order:1,required:true}}]));
  assert.equal(childSave.row_version,current.row_version+1,'Child save invalidates owner drafts');
  const afterChild=await read('business_attribute',child.id);
  assert.equal(afterChild.name_de,beforeChild.name_de);
  assert.equal(afterChild.name_fr,'Nom français');
  assert.equal(afterChild.row_version,beforeChild.row_version+1);
  const unchanged=await request(db,command('business_object',{...current,row_version:childSave.row_version},{},[{id:child.id,expected_version:afterChild.row_version,patch:{name_fr:'Nom français'}}]));
  assert.equal(unchanged.row_version,childSave.row_version,'No-op child patch creates no owner revision');
  assert((await db.query('SELECT * FROM catalog.business_attribute_quality_requirement WHERE business_attribute_id=$1',[child.id])).rows.length>0);
  current=await read('business_object',object.id);
  await assert.rejects(request(db,command('business_object',current,{},[{id:child.id,expected_version:beforeChild.row_version,patch:{comment:'stale row'}}])),e=>e.code==='40001');
  await request(db,command('business_object',current,{},[{id:child.id,expected_version:afterChild.row_version,patch:{is_archived:true}}]));
  assert.equal((await read('business_attribute',child.id)).is_archived,true);
  const createId=crypto.randomUUID(),rowId=crypto.randomUUID();
  const created=await request(db,command('code_list',{id:createId},{name_en:'Test list'},[{id:rowId,expected_version:0,patch:{name_en:'Leading zero',code:'001',sort_order:1}}]));
  assert.equal(created.id,createId);assert.equal((await read('code_value',rowId)).code,'001');
  await assert.rejects(request(db,command('code_list',{id:createId,row_version:1},{},[{id:crypto.randomUUID(),expected_version:0,patch:{name_en:'Duplicate',code:'001'}}])),e=>e.code==='23505');
  // Every supported collection accepts a minimal, honest draft. Child types have
  // their own native requirements; no generated value may invent business facts.
  for(const table of ['domain','system','business_object','data_table','data_product','data_service']){
   const id=crypto.randomUUID(), patch={name_en:'New '+table,status:'draft'};
   if(table==='business_object')patch.domain_id=snap.domain[0].id;
   if(table==='data_table')patch.system_id=snap.system[0].id;
   const saved=await request(db,command(table,{id},patch),{user:crypto.randomUUID()});
   assert.equal(saved.row_version,1,'Any signed-in user can create '+table);
  }
  const api=snap.data_service[0],endpointId=crypto.randomUUID();
  await request(db,command('data_service',api,{},[{id:endpointId,expected_version:0,patch:{url:'https://example.org/records',http_method:'GET',sort_order:1}}]));
  let endpoint=await read('service_endpoint',endpointId);
  assert.equal(endpoint.row_version,1);assert.equal(endpoint.verification_status,'notChecked');
  await request(db,command('data_service',await read('data_service',api.id),{},[{id:endpointId,expected_version:1,patch:{relative_path:'/records',is_archived:true}}]));
  endpoint=await read('service_endpoint',endpointId);assert.equal(endpoint.row_version,2);assert.equal(endpoint.is_archived,true);
  assert.equal((await db.query("SELECT record_data_service_id FROM catalog.change_event WHERE after->>'id'=$1 ORDER BY occurred_at DESC LIMIT 1",[endpointId])).rows[0].record_data_service_id,api.id);
  await assert.rejects(request(db,command('data_service',await read('data_service',api.id),{},[{id:endpointId,expected_version:2,patch:{verification_status:'sampleChecked'}}])),e=>e.code==='42501');
  const field=snap.data_field[0],owner=await read('data_table',field.data_table_id);
  await request(db,command('data_field',field,{comment:'Standalone field edit'}));
  assert.equal((await read('data_table',owner.id)).row_version,owner.row_version+1);
  await assert.rejects(request(db,command('data_table',owner,{comment:'stale owner'})),e=>e.code==='40001');
  const objectId=crypto.randomUUID(),duplicate=()=>({id:crypto.randomUUID(),expected_version:0,patch:{name_en:'Key',semantic_name:'duplicate-name',is_identifier:true}});
  await assert.rejects(request(db,command('business_object',{id:objectId},{name_en:'Atomic create',domain_id:snap.domain[0].id},[duplicate(),duplicate()])),e=>e.code==='23505');
  assert.equal(await read('business_object',objectId),undefined,'Failed creation leaves no partial entry');
  for(const patch of [{contains_personal_data:'false'},{documentation_links:{}},{status:17}])await assert.rejects(request(db,command('business_object',await read('business_object',object.id),patch)),e=>e.code==='22023');
  await assert.rejects(request(db,command('domain',snap.domain[0],{parent_domain_id:snap.domain[0].id})),e=>e.code==='23514');
  const audit=(await db.query('SELECT count(*)::int AS n FROM catalog_private.edit_event_actor a JOIN catalog_private.edit_receipt r ON r.command_id=a.command_id AND r.user_id=a.user_id')).rows[0].n;
  assert.equal(audit,(await db.query("SELECT count(*)::int AS n FROM catalog.change_event WHERE identifier LIKE 'edit-%'")).rows[0].n,'Every edit event has private authenticated attribution');
  const count=(await db.query('SELECT count(*)::int AS n FROM catalog_private.edit_receipt')).rows[0].n;assert(count>=4);
  await db.exec('SET ROLE authenticated');
  try {
   await assert.rejects(db.query('UPDATE catalog.business_object SET comment=$1 WHERE id=$2',['direct',object.id]),e=>e.code==='42501');
   await assert.rejects(db.query('SELECT * FROM catalog_private.edit_receipt'),e=>e.code==='42501');
   await assert.rejects(db.query('SELECT * FROM catalog_private.edit_event_actor'),e=>e.code==='42501');
   await assert.rejects(db.query("SELECT catalog_private.apply_entry_edit('business_object',$1,1,'{}')",[object.id]),e=>e.code==='42501');
  }finally{await db.exec('RESET ROLE');}
  console.log('Editing SQL: authorization, immutable fields, relation exclusion, atomicity, revisions, retries, translations, owned rows, required rules and archive passed');
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={configureIdentity,request,command,uid};
