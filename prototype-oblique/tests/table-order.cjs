const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {database,runtime,root}=require('./catalog-test-helpers.cjs');
const {configureIdentity,request,command}=require('./editing-sql.cjs');const {write,command:api}=require('./rest-crud.cjs');
(async()=>{const db=await database();try{await configureIdentity(db);
const get=async()=>(await db.query('SELECT * FROM catalog.data_table ORDER BY identifier LIMIT 1')).rows[0];let row=await get();assert.equal(row.sort_order,0);
for(const identity of [{role:'anon',user:null},{user:null},{anonymous:true}])await assert.rejects(write(db,api('data_table',{sort_order:100},row),identity),e=>e.code==='42501');
for(const sort_order of [null,-1,1.5,'100',2147483648])await assert.rejects(write(db,api('data_table',{sort_order},row)));
const cmd=api('data_table',{sort_order:400},row),saved=await write(db,cmd);assert.equal(saved.sort_order,400);assert.deepEqual(await write(db,cmd),saved);
await assert.rejects(write(db,api('data_table',{sort_order:500},row)),e=>e.code==='40001');
row=await get();await request(db,command('data_table',row,{sort_order:200}));row=await get();assert.equal(row.sort_order,200);
const before=(await db.query('SELECT count(*)::int n FROM catalog.change_event')).rows[0].n;await write(db,api('data_table',{sort_order:200},row));assert.equal((await db.query('SELECT count(*)::int n FROM catalog.change_event')).rows[0].n,before);
for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_table_privilege($1,'catalog.data_table','INSERT,UPDATE,DELETE,TRUNCATE') allowed",[role])).rows[0].allowed,false);
const s=(await db.query('SELECT catalog.read_snapshot() s')).rows[0].s;const {DK,context}=runtime(s);await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'de');
assert.equal(DK.presentation.sortOptions({tableSorts:{}},'list:tables','tables').sort.field,'sortOrder');assert(!DK.presentation.defaults('tables').includes('sortOrder'));assert(DK.presentation.choices('tables').some(f=>f.id==='sortOrder'));
for(const kind of ['attrs','fields']){
 const choices=[...DK.presentation.choices(kind)].map(f=>f.id);
 assert.equal(choices[0],'sortOrder');assert.equal(choices.at(-1),'status');
 assert.deepEqual([...DK.presentation.fields(kind,choices)].map(f=>f.id),choices,'Dropdown and table share column order');
 assert.equal(DK.presentation.fields(kind,['name','sortOrder'])[0].id,'sortOrder');
}
const shared=DK.presentation.choices('attrs').map(f=>f.id).filter(id=>DK.presentation.choices('fields').some(f=>f.id===id));
assert.deepEqual([...DK.presentation.choices('fields')].map(f=>f.id).filter(id=>shared.includes(id)),[...shared]);
const list=[{name:'Z',sortOrder:100},{name:'A',sortOrder:200}];assert.equal(DK.presentation.sort('tables',list,{field:'sortOrder',direction:'asc'})[0].name,'Z');assert.equal(DK.presentation.sort('tables',list,{field:'name',direction:'asc'})[0].name,'A');
context.crypto=require('node:crypto').webcrypto;vm.runInContext(fs.readFileSync(root+'/js/edit-schema.js','utf8'),context);const f=DK.editSchema.groups('data_table').flatMap(g=>g[1]).find(f=>f.key==='sort_order');assert(f);const value={};DK.editSchema.write(value,f,'1200','de','data_table');assert.equal(value.sort_order,1200);assert.equal(DK.editSchema.defaults('data_table','de').sort_order,0);
const table={...DK.data.tables.find(t=>t._record.id===row.id),kind:'tables'},plan=DK.excel.plan({view:'detail',kind:'tables',entity:table,params:{}},{title:table.name,state:{}},'http://localhost/');const sheet=plan.sheets.find(s=>s.kind==='tables');assert(sheet.columns.some(c=>c.key==='sortOrder'&&c.type==='number'));
console.log('DataTable ordering: guarded browser/REST writes, invalid values, retries, revisions, default sorting, editor numeric values, exports and unchanged write denials passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
