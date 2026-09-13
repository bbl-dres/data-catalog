const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {database,runtime}=require('./catalog-test-helpers.cjs');
const {configureIdentity,uid}=require('./editing-sql.cjs');
test('Specializations preserve typed, acyclic, audited and authenticated relationships',async()=>{
 const db=await database();
 try {
  await configureIdentity(db);
  const snapshot=(await db.query('SELECT catalog.read_snapshot() s')).rows[0].s;
  const [a,b,c]=snapshot.business_object.filter(o=>o.status!=='retired').slice(0,3);
  const api=async(operation,body,row=null,role='authenticated')=>{
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid,JSON.stringify({role,session_id:uid,is_anonymous:false})]);
   await db.exec('SET ROLE '+role);
   try{return (await db.query('SELECT catalog.api_write($1,$2,$3,$4,$5,$6) r',[operation,'relationship',row?.id||null,row?.row_version||0,body,randomUUID()])).rows[0].r;}
   finally{await db.exec('RESET ROLE');}
  };
  const edge=(from,to,extra={})=>({id:randomUUID(),identifier:'specialization-test:'+randomUUID(),source_business_object_id:from.id,target_business_object_id:to.id,relationship_type:'specializes',verification_status:'candidate',...extra});
  await assert.rejects(api('create',edge(a,b),null,'anon'),e=>e.code==='42501');
  await assert.rejects(api('create',edge(a,a)),e=>e.code==='23514');
  await assert.rejects(api('create',edge(a,b,{source_business_object_id:null,source_data_table_id:snapshot.data_table[0].id})),e=>e.code==='23514');
  await assert.rejects(api('create',edge(a,b,{coverage:'full'})),e=>e.code==='23514');
  const ab=await api('create',edge(a,b));
  await assert.rejects(api('create',edge(a,b)),e=>e.code==='23505');
  await assert.rejects(api('create',edge(b,a)),e=>e.code==='23514');
  await api('create',edge(b,c));
  await assert.rejects(api('create',edge(c,a)),e=>e.code==='23514');
  let inactive=await api('create',edge(c,a,{verification_status:'rejected'}));
  await assert.rejects(api('update',{verification_status:'candidate'},inactive),e=>e.code==='23514');
  let archived=await api('create',edge(b,a,{is_archived:true}));
  await assert.rejects(api('update',{is_archived:false},archived),e=>e.code==='23514');
  await api('create',edge(c,a,{relationship_type:'measuredFor'}));
  const latest=(await db.query('SELECT catalog.read_snapshot() s')).rows[0].s;
  const {DK}=runtime(latest);await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'de');
  const groups=id=>DK.data.relations('objects',DK.data.get('objects',id));
  assert.equal(groups(a.identifier).find(g=>g.key==='specializationOf').items.length,1);
  assert.equal(groups(b.identifier).find(g=>g.key==='specializations').items.length,1);
  assert.equal(groups(c.identifier).find(g=>g.key==='specializationOf').items.length,0,'Inactive edges hidden');
  const oldAttrs=snapshot.business_attribute;assert.deepEqual(latest.business_attribute,oldAttrs,'No implicit attribute changes');
  assert.deepEqual(latest.business_object,snapshot.business_object,'No implicit owner changes');
  const functionOid=(await db.query("SELECT 'catalog_private.guard_specialization()'::regprocedure::oid oid")).rows[0].oid;
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);
   assert((await db.query('SELECT count(*) FROM catalog.relationship')).rows[0].count>0);
   await assert.rejects(db.query('UPDATE catalog.relationship SET comment=$1 WHERE id=$2',['direct',ab.id]),e=>e.code==='42501');
   assert.equal((await db.query("SELECT has_function_privilege(current_user,$1::oid,'EXECUTE') p",[functionOid])).rows[0].p,false);
   await db.exec('RESET ROLE');
  }
  assert.equal(latest.change_event.length-snapshot.change_event.length,5,'Five successful commands, failed writes leave no history');
 }finally{await db.close();}
});
