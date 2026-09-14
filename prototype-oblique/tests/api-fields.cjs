/* Independent owners, optional correspondences and free-text groups through actual SQL commands. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const {database,runtime,root}=require('./catalog-test-helpers.cjs');
const {configureIdentity,request,command}=require('./editing-sql.cjs');
const {write,command:api}=require('./rest-crud.cjs');
(async()=>{const db=await database();try{
 await configureIdentity(db);
 const read=async(table,id)=>(await db.query(`SELECT * FROM catalog.${table} WHERE id=$1`,[id])).rows[0];
 const snap=(await db.query('SELECT catalog.read_snapshot(true) s')).rows[0].s;
 const service=snap.data_service[0], otherService=snap.data_service[1],table=snap.data_table[0],tableField=snap.data_field.find(f=>f.data_table_id===table.id),attribute=snap.business_attribute[0];
 assert.equal(snap.data_field.filter(f=>f.data_service_id).length,0,'No inferred copies or moves');
 assert(snap.data_field.every(f=>f.property_group===null));assert(snap.business_attribute.every(f=>f.property_group===null));
 const id=crypto.randomUUID(),endpointId=crypto.randomUUID();
 const create=command('data_service',service,{},[
  {table:'data_field',id,expected_version:0,patch:{name_de:'Antwortfeld',technical_name:'wireName',technical_name_kind:'apiField',source_path:'response.BUILDING.wireName',source_data_type:'string',data_type_scope:'serviceSchema',property_group:'BUILDING',is_required:false,is_nullable:true}},
  {id:endpointId,expected_version:0,patch:{operation_name:'Local endpoint'}}
 ]);
 for(const identity of [{role:'anon',user:null},{user:null},{anonymous:true}])await assert.rejects(request(db,create,identity),e=>e.code==='42501');
 const saved=await request(db,create);assert.deepEqual(await request(db,create),saved,'Idempotent multi-row save');
 let field=await read('data_field',id);assert.equal(field.data_service_id,service.id);assert.equal(field.data_table_id,null);assert.equal(field.sort_order,1);assert.equal(field.property_group,'BUILDING');
 assert.deepEqual(await read('data_field',tableField.id),tableField,'Separate fields do not alter table records');
 assert.equal((await read('service_endpoint',endpointId)).data_service_id,service.id);
 assert.equal((await read('data_service',service.id)).row_version,service.row_version+1);
 assert.equal((await db.query('SELECT count(*)::int n FROM catalog.relationship')).rows[0].n,snap.relationship.length,'No relations required or inferred');
 for(const body of [{data_table_id:table.id},{data_service_id:otherService.id}])await assert.rejects(write(db,api('data_field',body,field)),e=>e.code==='42501');
 await assert.rejects(db.query('UPDATE catalog.data_field SET data_service_id=$1 WHERE id=$2',[otherService.id,id]),e=>e.code==='23514');
 for(const body of [{},{data_table_id:table.id,data_service_id:service.id}])await assert.rejects(write(db,api('data_field',{...body,name_en:'Bad owner',technical_name:'x',technical_name_kind:'apiField',sort_order:0})),e=>e.code==='23514');
 await assert.rejects(write(db,api('data_field',{data_service_id:service.id,name_en:'Bad scope',technical_name:'x',technical_name_kind:'physicalColumn'})),e=>e.code==='23514');
 const owned=(id,patch)=>({table:'data_field',id,expected_version:1,patch});
 await assert.rejects(request(db,command('data_service',await read('data_service',otherService.id),{},[owned(field.id,{name_de:'Stolen'})])),e=>e.code==='42501');
 await assert.rejects(request(db,command('data_service',await read('data_service',service.id),{},[owned(tableField.id,{name_de:'Stolen'})])),e=>e.code==='42501');
 await assert.rejects(request(db,command('data_table',table,{},[owned(field.id,{name_de:'Stolen'})])),e=>['22023','42501'].includes(e.code));
 await assert.rejects(request(db,command('data_service',await read('data_service',service.id),{},[{table:'actor',id:crypto.randomUUID(),expected_version:0,patch:{name_en:'Bad'}}])),e=>e.code==='22023');
 let api2=await write(db,api('data_field',{data_service_id:service.id,name_de:'Zweites Feld',technical_name:'other',technical_name_kind:'apiField',property_group:'Beliebige Gruppe / Ü'}));
 assert.equal(api2.sort_order,2);assert.equal(api2.property_group,'Beliebige Gruppe / Ü');
 let before=await read('data_service',service.id);
 await request(db,command('data_field',api2,{property_group:null}));api2=await read('data_field',api2.id);assert.equal(api2.property_group,null);assert.equal((await read('data_service',service.id)).row_version,before.row_version+1);
 for(const [kind,entry,group] of [['business_attribute',attribute,'Pset_Test'],['data_field',tableField,'REBDBUFLDS'],['data_field',api2,'OBJECT_ADDRESS']]){
  const value=await write(db,api(kind,{property_group:group},await read(kind,entry.id)));assert.equal(value.property_group,group);
  await assert.rejects(write(db,api(kind,{property_group:''},value)),e=>e.code==='23514');
  await assert.rejects(write(db,api(kind,{property_group:42},value)),e=>e.code==='22023');
 }
 const link=await write(db,api('relationship',{source_data_field_id:id,target_data_field_id:tableField.id,relationship_type:'correspondsTo',coverage:'unknown'}));assert.equal(link.verification_status,'candidate');
 field=await write(db,api('data_field',{property_group:'API-only edit'},field));assert.equal((await read('data_field',tableField.id)).property_group,'REBDBUFLDS');
 const legacy=(await db.query('SELECT catalog.read_snapshot() s')).rows[0].s;
 assert(legacy.data_field.every(f=>f.data_table_id && !f.data_service_id),'Legacy clients only receive table-owned fields');
 assert(!legacy.relationship.some(r=>r.id===link.id),'Legacy snapshots omit assertions to excluded API fields');
 assert(!legacy.change_event.some(e=>e.record_data_field_id===id||e.record_relationship_id===link.id),'Legacy history has no missing field/assertion targets');
 let snapshot=(await db.query('SELECT catalog.read_snapshot(true) s')).rows[0].s;
 const {DK,context}=runtime(snapshot);await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'de');
 const entity={...DK.data.apis.find(s=>s._record.id===service.id),kind:'apis'};
 assert.equal(entity.fields.length,2);assert.equal(DK.detail.tabs(entity).find(t=>t[0]==='rows')[1],'Felder');
 const rows=DK.detail.rowsData(entity);assert.equal(rows.kind,'fields');assert.equal(rows.rows.length,2);assert.equal(rows.rows[0].values.propertyGroup,'API-only edit');assert.equal(rows.rows[0].values.required,false);assert.equal(rows.rows[0].values.nullable,true);
 assert(rows.rows.every(r=>r.href===null),'Rows never link to a same-named table field');
 assert.equal(DK.detail.rowsContext(entity,{params:{filter:'API-only edit'}},{tableSorts:{}}).matched,1);
 for(const kind of ['attrs','fields']){assert(DK.presentation.defaults(kind).includes('propertyGroup'));DK.presentation.save(kind,DK.presentation.defaults(kind).filter(k=>k!=='propertyGroup'));assert(!DK.presentation.selected(kind).includes('propertyGroup'));}
 assert(DK.data.history('apis',entity.identifier).some(e=>e._record.record_data_field_id===id));
 assert(!DK.data.history('tables',table.identifier).some(e=>e._record.record_data_field_id===id));
 const plan=DK.excel.plan({view:'detail',kind:'apis',entity,params:{}},{state:{},title:entity.name},'http://localhost/');
 const sheet=plan.sheets.find(s=>s.kind==='apiFields');assert.equal(sheet.rows.length,2);assert(sheet.columns.some(c=>c.key==='propertyGroup'));assert(sheet.columns.some(c=>c.key==='dataServiceName'));assert(!sheet.columns.some(c=>c.key==='dataTableName'));assert(plan.sheets.some(s=>s.kind==='endpoints'));
 assert(sheet.rows.some(r=>r[sheet.columns.findIndex(c=>c.key==='propertyGroup')]==='API-only edit'));
 context.window.location={href:'http://localhost/'};vm.runInContext(fs.readFileSync(root+'/js/diagram-content.js','utf8'),context);
 const printed=DK.diagram.snapshot({entity},{kind:'apis',title:entity.name},'de').entities.find(e=>e.id===entity.identifier);assert.equal(printed.rows.length,2);assert.equal(printed.rows[0].display.propertyGroup,'API-only edit');
 field=await write(db,api('data_field',{},field,'delete'));assert(field.is_archived);assert(await read('relationship',link.id));
 field=await write(db,api('data_field',{is_archived:false},field));assert.equal(field.is_archived,false);
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_table_privilege($1,'catalog.data_field','INSERT,UPDATE,DELETE,TRUNCATE') allowed",[role])).rows[0].allowed,false);
 console.log('API fields and groups: independent ownership, optional relations, CRUD, revisions, retries, security, projection, searching, visibility and exports passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
