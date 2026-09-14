const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {database,runtime}=require('./catalog-test-helpers.cjs');
const {inventory,sqlFor,ownerId,importId,source}=require('../scripts/refx-building-mmb-import.cjs');
const api=require('../docs/sources/sap-refx/2026-09-14-building-api-fields.json');
(async()=>{const db=await database();try{
 // Bring the legacy fixture's field revisions to the reviewed live baseline.
 await db.exec(`UPDATE catalog.data_field SET edited_at=now() WHERE data_table_id='${ownerId}' AND row_version=1;`);
 // API records are independent fixtures. The import must preserve every one.
 for(const f of api.fields){const record={...f.patch,id:f.id,identifier:'fixture-'+f.id,data_service_id:'47bcb613-759b-5882-9833-9a7239cdba2d'};
  const cols=Object.keys(record).map(k=>'"'+k+'"').join(',');
  await db.query(`INSERT INTO catalog.data_field(${cols}) SELECT ${cols} FROM jsonb_populate_record(NULL::catalog.data_field,$1)`,[JSON.stringify(record)]);
 }
 const baseline=(await db.query('SELECT catalog.read_snapshot(true) s,md5(catalog.read_snapshot(true)::text) hash')).rows[0];
 const version=baseline.s.data_table.find(t=>t.id===ownerId).row_version,options={baselineHash:baseline.hash,version};
 const plan=inventory();assert.deepEqual(plan.counts,{active:150,assigned:61,candidate:39,unmatched:50,reused:11,created:139,archived:55,groups:11});
 assert.deepEqual(plan.fields.map(f=>f.patch.name_de),source.fields.map(f=>f.source.Name));
 assert.equal(new Set(plan.fields.map(f=>f.id)).size,150);
 assert(plan.fields.every(f=>f.patch.status==='draft'&&f.patch.is_required===null&&f.patch.key_roles===null));
 assert(plan.fields.filter(f=>f.match_status!=='assigned').every(f=>f.patch.technical_name_kind==='modelAttribute'&&f.patch.source_path===null&&f.patch.property_group===null));
 const preview=await db.exec(sqlFor(options));
 assert.equal((await db.query('SELECT md5(catalog.read_snapshot(true)::text) h')).rows[0].h,baseline.hash,'Rollback must preserve full snapshot');
 await assert.rejects(db.exec(sqlFor({...options,baselineHash:'0'.repeat(32),commit:true})),/Catalog changed/);await db.exec('ROLLBACK');
 await db.exec(sqlFor({...options,commit:true}));
 const after=(await db.query('SELECT catalog.read_snapshot(true) s')).rows[0].s;
 const active=after.data_field.filter(f=>f.data_table_id===ownerId&&!f.is_archived).sort((a,b)=>a.sort_order-b.sort_order);
 assert.deepEqual(active.map(f=>f.name_de),source.fields.map(f=>f.source.Name));
 assert.equal(after.data_field.filter(f=>f.data_table_id===ownerId&&f.is_archived).length,55);
 for(const f of baseline.s.data_field.filter(f=>f.data_table_id!==ownerId))assert.deepEqual(after.data_field.find(a=>a.id===f.id),f);
 assert.deepEqual(after.relationship,baseline.s.relationship);
 for(const f of plan.archived){const before=baseline.s.data_field.find(b=>b.id===f.id),now=after.data_field.find(b=>b.id===f.id);const omit=o=>Object.fromEntries(Object.entries(o).filter(([k])=>!['is_archived','row_version','edited_at','modified_on'].includes(k)));assert.deepEqual(omit(now),omit(before));}
 const events=after.change_event.filter(e=>e.import_id===importId);assert.equal(events.length,1);assert.equal(events[0].record_data_table_id,ownerId);
 assert.equal(events[0].before.fields.length,66);assert.equal(events[0].after.fields.length,205);assert.equal(events[0].actor_name_de,'Codex (MCP-Import)');
 assert.equal(after.change_event.length,baseline.s.change_event.length+1);
 assert.equal((await db.query('SELECT count(*) n FROM auth.users')).rows[0].n,0,'Administrative import does not need or create an Auth user');
 assert.equal((await db.query('SELECT count(*) n FROM catalog_private.edit_event_actor')).rows[0].n,0,'Do not invent user attribution');
 const changedHash=(await db.query('SELECT md5(catalog.read_snapshot(true)::text) h')).rows[0].h;
 await assert.rejects(db.exec(sqlFor({baselineHash:changedHash,version:version+1,commit:true})),/already imported/);await db.exec('ROLLBACK');
 const {DK}=runtime(after);await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'de');
 const table={...DK.data.tables.find(t=>t.identifier==='t-sap-building'),kind:'tables'};
 assert.equal(table.fields.length,150);assert.deepEqual(Array.from(table.fields,f=>f.name),source.fields.map(f=>f.source.Name));
 const rows=DK.detail.rowsData(table);assert.equal(rows.rows.length,150);
 assert.equal(rows.rows[0].values.propertyGroup,'BUILDING');
 const exportPlan=DK.excel.plan({view:'detail',kind:'tables',entity:table,params:{}},{state:{},title:table.name},'http://localhost/');
 assert(exportPlan.sheets.some(s=>s.rows.length===150),'Excel projection contains all 150 rows');
 fs.writeFileSync(path.join(os.tmpdir(),'refx-building-mmb-snapshot.json'),JSON.stringify(after));
 console.log('MMB import passed: exact 150 names/order, 61 matches, unresolved candidates, 11 reused/139 new/55 archived, one batch event, before/after inventory, independent API/relations preserved, rollback/stale/repeat guards, no Auth changes, UI/Excel projection.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
