/* Reproductions from the September whole-prototype review; isolated database only. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { database, runtime } = require('./catalog-test-helpers.cjs');
const { configureIdentity, request, command } = require('./editing-sql.cjs');
const { write, command: apiCommand } = require('./rest-crud.cjs');
(async () => {
  const db = await database(), failures = [];
  const check = async (name, fn) => { try { await fn(); console.log('PASS '+name); } catch (e) { failures.push(name+': '+e.message); } };
  try {
    await configureIdentity(db);
    const read = async (table,id) => (await db.query(`SELECT * FROM catalog.${table} WHERE id=$1`,[id])).rows[0];
    const attr = (await db.query('SELECT * FROM catalog.business_attribute LIMIT 1')).rows[0];
    const rule = await write(db,apiCommand('quality_requirement',{identifier:'catalog-editor-required',name_en:'Required',description_en:'Required value',status:'valid',rule_type:'required',dimension:'completeness'}));
    await write(db,apiCommand('business_attribute',{quality_requirement_ids:[rule.id]},attr));
    await write(db,apiCommand('quality_requirement',{},rule,'delete'));
    await check('Archived requirements do not appear mandatory',async()=>{
      const snapshot=(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
      const {DK}=runtime(snapshot);await DK.data.load('data/');
      const entity=DK.data.objects.flatMap(o=>o.attributes).find(a=>a._record.id===attr.id);
      assert.equal(entity.mandatory,null);
    });
    await check('The required checkbox creates an active rule without reviving archived assignments',async()=>{
      await request(db,command('business_attribute',await read('business_attribute',attr.id),{required:true}));
      const active=(await db.query("SELECT q.* FROM catalog.quality_requirement q JOIN catalog.business_attribute_quality_requirement a ON a.quality_requirement_id=q.id WHERE a.business_attribute_id=$1 AND q.rule_type='required' AND q.status<>'retired' AND NOT q.is_archived",[attr.id])).rows;
      assert.equal(active.length,1);assert.notEqual(active[0].id,rule.id);
      assert.equal((await read('quality_requirement',rule.id)).is_archived,true);
      await request(db,command('business_attribute',await read('business_attribute',attr.id),{required:false}));
      assert.equal((await db.query('SELECT count(*)::int AS n FROM catalog.business_attribute_quality_requirement WHERE business_attribute_id=$1 AND quality_requirement_id=$2',[attr.id,rule.id])).rows[0].n,1,'Historical assignment is preserved');
    });
    const {createHandler}=await import('../supabase/functions/catalog-api/index.ts');
    let sent, calls=0;
    const handler=createHandler({url:'https://catalog.example',publicKey:'sb_publishable_test',fetcher:async(url,init)=>{
      calls++;if(url.pathname==='/auth/v1/user')return Response.json({id:crypto.randomUUID()});
      sent=JSON.parse(init.body);return Response.json({id:crypto.randomUUID(),row_version:1});
    }});
    const send=body=>handler(new Request('https://catalog.example/functions/v1/catalog-api/quality_requirement',{method:'POST',headers:{Authorization:'Bearer test.payload.signature','Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body}));
    await check('REST preserves the original exact decimal token',async()=>{
      assert.equal((await send('{"comparison_value":9007199254740993.1234567890123456789}')).status,201);
      assert.equal(sent.p_body.comparison_value,'9007199254740993.1234567890123456789');
    });
    await check('Malformed UTF-8 is rejected before Auth or SQL calls',async()=>{
      const before=calls;
      const body=Buffer.concat([Buffer.from('{"name_en":"'),Buffer.from([0xc3,0x28]),Buffer.from('"}')]);
      assert.equal((await send(body)).status,400);assert.equal(calls,before);
    });
    assert.deepEqual(failures,[]);
  } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
