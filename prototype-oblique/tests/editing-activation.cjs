/* Apply the generated administrator bundle to an existing catalog, without reimporting it. */
'use strict';
const assert = require('node:assert/strict');
const { database } = require('./catalog-test-helpers.cjs');
const { generate, shapeQuery } = require('../supabase/prepare-editing-activation.cjs');
const { configureIdentity, request, command, uid } = require('./editing-sql.cjs');

(async()=>{
  const sql = await generate(), db = await database({bundle:true});
  try {
    // Existing editorial changes must survive activation, including their existing versions/history.
    await db.exec("UPDATE catalog.business_object SET comment='Previously curated content' WHERE identifier='gebaeude'");
    const snapshot = async() => (await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
    const before = await snapshot(), initialShape = (await db.query(shapeQuery)).rows[0].shape;
    const refuse = async(script,code) => { await assert.rejects(db.exec(script),e=>e.code===code);await db.exec('ROLLBACK'); };
    await db.exec('SET ROLE authenticated');await refuse(sql,'42501');await db.exec('RESET ROLE');
    await db.exec('ALTER TABLE catalog.business_object ADD COLUMN unexpected boolean');
    await refuse(sql,'55000');assert.equal((await db.query("SELECT to_regprocedure('catalog.edit_capabilities()') AS f")).rows[0].f,null);
    await db.exec('ALTER TABLE catalog.business_object DROP COLUMN unexpected');
    const failure = sql.replace('DO $verify$',()=>"DO $$ BEGIN RAISE EXCEPTION 'Test rollback' USING ERRCODE='P0001'; END $$;\nDO $verify$");
    await refuse(failure,'P0001');assert.deepEqual((await db.query(shapeQuery)).rows[0].shape,initialShape,'DDL rollback restores the baseline');
    assert.deepEqual(await snapshot(),before,'Failed activation preserves existing content');
    await db.exec(sql);
    const after = await snapshot();
    for (const table of Object.keys(initialShape)) {
      assert.equal(after[table].length,before[table].length,table+' count');
      const original = new Map(before[table].map(row=>[row.id || JSON.stringify(row),row]));
      for (const row of after[table]) {
        const previous = Object.fromEntries(initialShape[table].map(key=>[key,row[key]]));
        assert.deepEqual(previous,original.get(row.id || JSON.stringify(previous)),table+' content');
      }
    }
    await refuse(sql,'55000');assert.deepEqual(await snapshot(),after,'A rerun changes nothing');
    await configureIdentity(db);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[uid]);
    await db.exec('SET ROLE authenticated');
    assert.deepEqual((await db.query('SELECT catalog.edit_capabilities() AS c')).rows[0].c,{version:1,can_edit:true,access_options:true});
    await db.exec('RESET ROLE');
    const owner=after.business_object.find(row=>row.identifier==='gebaeude');
    const result=await request(db,command('business_object',owner,{comment:'Verified after activation'}));
    assert.equal(result.row_version,owner.row_version+1);
    assert((await snapshot()).change_event.length>after.change_event.length,'Save creates history');
    await assert.rejects(request(db,command('business_object',result,{comment:'Denied'}),{role:'anon',user:null}),e=>e.code==='42501');
    await db.exec('SET ROLE anon');assert.equal((await snapshot()).business_object.length,after.business_object.length);await db.exec('RESET ROLE');
    console.log('PASS: atomic activation, baseline/role/rerun guards, full rollback, existing content/identity/version preservation, authenticated capability/save/history and public reads.');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
