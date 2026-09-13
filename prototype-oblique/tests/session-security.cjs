const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {database}=require('../supabase/local-database.cjs');
const {configureIdentity,uid,registerIdentity}=require('./editing-sql.cjs');
(async()=>{
 const db=await database();
 try{
  await configureIdentity(db);
  const other=crypto.randomUUID();await registerIdentity(db,other);
  const snapshot=async()=>(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
  const before=await snapshot(),row=before.business_object[0];
  const saveId=crypto.randomUUID(),apiId=crypto.randomUUID();
  const save=()=>db.query('SELECT catalog.save_entry($1,$2,$3,$4,$5) AS r',[saveId,'business_object',row.id,row.row_version,{comment:'Session security verification'}]);
  const api=()=>db.query('SELECT catalog.api_write($1,$2,$3,$4,$5,$6) AS r',['update','business_object',row.id,row.row_version,{comment:'Session security verification'},apiId]);
  const claims={role:'authenticated',session_id:uid,is_anonymous:false};
  async function asUser(claimsValue,fn,user=uid,role='authenticated'){
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user||'',JSON.stringify(claimsValue)]);
   await db.exec('SET ROLE '+role);
   try{return await fn();}finally{await db.exec('RESET ROLE');}
  }
  async function denied(label,claim=claims,user=uid){
   await asUser(claim,async()=>{
    assert.equal((await db.query('SELECT catalog.edit_capabilities() AS c')).rows[0].c.can_edit,false,label);
    await assert.rejects(save(),e=>e.code==='42501',label+' browser');
    await assert.rejects(api(),e=>e.code==='42501',label+' REST');
   },user);
  }
  await denied('No subject',claims,null);
  await denied('Unknown user',claims,crypto.randomUUID());
  await denied('Anonymous JWT',{...claims,is_anonymous:true});
  await denied('Missing anonymous claim',{role:'authenticated',session_id:uid});
  await denied('Missing session',{role:'authenticated',is_anonymous:false});
  await denied('Malformed session',{...claims,session_id:'not-a-uuid'});
  await denied('Unknown session',{...claims,session_id:crypto.randomUUID()});
  await denied('Another account session',{...claims,session_id:other});
  await denied('Role spoofed in editable metadata',{session_id:uid,is_anonymous:false,user_metadata:{role:'authenticated',admin:true}});
  for(const [label,change,restore] of [
   ['Anonymous account','UPDATE auth.users SET is_anonymous=true WHERE id=$1','UPDATE auth.users SET is_anonymous=false WHERE id=$1'],
   ['Banned account',"UPDATE auth.users SET banned_until=now()+interval '1 hour' WHERE id=$1",'UPDATE auth.users SET banned_until=NULL WHERE id=$1'],
   ['Soft-deleted account','UPDATE auth.users SET deleted_at=now() WHERE id=$1','UPDATE auth.users SET deleted_at=NULL WHERE id=$1'],
   ['Expired session',"UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=$1",'UPDATE auth.sessions SET not_after=NULL WHERE id=$1'],
  ]){await db.query(change,[uid]);await denied(label);await db.query(restore,[uid]);}
  await db.query('DELETE FROM auth.sessions WHERE id=$1',[uid]);await denied('Revoked session');await registerIdentity(db);
  assert.deepEqual(await snapshot(),before,'All denied requests preserve the catalog');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM catalog_private.edit_receipt')).rows[0].n,0);
  // Expired bans do not remove access. A successful command is still blocked
  // after revocation: the authorization check precedes idempotency receipts.
  await db.query("UPDATE auth.users SET banned_until=now()-interval '1 second' WHERE id=$1",[uid]);
  await asUser(claims,async()=>{
   assert.equal((await db.query('SELECT catalog.edit_capabilities() AS c')).rows[0].c.can_edit,true);
   const result=await save();assert.equal(result.rows[0].r.row_version,row.row_version+1);
   assert.deepEqual(await save(),result);
  });
  await db.query('DELETE FROM auth.sessions WHERE id=$1',[uid]);await denied('Replayed receipt after logout');
  await registerIdentity(db);
  await db.query('DELETE FROM auth.users WHERE id=$1',[uid]);await denied('Deleted account');
  await registerIdentity(db);
  const current=(await snapshot()).business_object.find(x=>x.id===row.id);
  await asUser(claims,async()=>{
   const restored=(await db.query('SELECT catalog.api_write($1,$2,$3,$4,$5,$6) AS r',['update','business_object',row.id,current.row_version,{comment:row.comment},crypto.randomUUID()])).rows[0].r;
   assert.equal(restored.comment,row.comment);assert.equal(restored.row_version,row.row_version+2);
   for(const sql of ['SELECT * FROM auth.users','SELECT * FROM auth.sessions','SELECT * FROM catalog_private.edit_event_actor','SELECT catalog_private.has_catalog_access(\'editor\')','UPDATE catalog.business_object SET comment=\'direct\'','DELETE FROM catalog.change_event','CREATE TABLE catalog.untrusted(id int)'])await assert.rejects(db.query(sql),e=>e.code==='42501',sql);
  });
  for(const role of ['anon','service_role'])await asUser(claims,async()=>{
   assert((await snapshot()).business_object.length>0);
   await assert.rejects(save(),e=>e.code==='42501');await assert.rejects(api(),e=>e.code==='42501');
   await assert.rejects(db.query('SELECT catalog_private.can_edit_catalog()'),e=>e.code==='42501');
  },uid,role);
  for(const schema of ['catalog','catalog_private','public']){
   await db.exec(`CREATE TABLE ${schema}.security_probe(id int);CREATE FUNCTION ${schema}.security_probe() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;CREATE SEQUENCE ${schema}.security_probe_seq;`);
   for(const role of ['anon','authenticated','service_role']){
    const p=(await db.query(`SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS t,has_function_privilege($1,$3,'EXECUTE') AS f,has_sequence_privilege($1,$4,'USAGE,SELECT,UPDATE') AS s`,[role,schema+'.security_probe',schema+'.security_probe()',schema+'.security_probe_seq'])).rows[0];assert.deepEqual(p,{t:false,f:false,s:false},schema+'/'+role);
   }
  }
  assert.equal((await db.query("SELECT count(*)::int AS n FROM catalog.change_event WHERE identifier LIKE 'edit-%' OR identifier LIKE 'api-%'")).rows[0].n,2,'Only two authorized changes enter history');
  console.log('PASS: browser/REST live account and session checks, revoked receipt replay, ban expiry, public reads, private Auth/audit isolation, direct-write denial and closed future grants.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
