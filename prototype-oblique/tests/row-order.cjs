/* Ordering contract through real SQL, projection and workbook round trips. */
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {database,runtime}=require('./catalog-test-helpers.cjs');
const {configureIdentity,request,command}=require('./editing-sql.cjs');
const {write,command:api}=require('./rest-crud.cjs');
const ExcelJS=require('../vendor/exceljs/exceljs.min.js');
(async()=>{const db=await database();try{
  await configureIdentity(db);
  const snapshot=async()=>(await db.query('SELECT catalog.read_snapshot() s')).rows[0].s;
  const initial=await snapshot();
  for(const [table,parent] of Object.entries({business_attribute:'business_object',data_field:'data_table',code_value:'code_list',product_attribute:'data_product',service_endpoint:'data_service'})){
    assert(initial[table].every(r=>r.sort_order===0),'Migration preserves existing order values');
    const sample=initial[table][0],allowed=(await db.query('SELECT catalog_private.api_columns($1,true) k',[table])).rows[0].k;
    const body=Object.fromEntries(Object.entries(sample).filter(([k])=>allowed.includes(k)&&!['id','identifier','sort_order','version','version_date'].includes(k)));
    if(body.semantic_name)body.semantic_name=crypto.randomUUID();if(body.code)body.code='000'+crypto.randomUUID();
    const create=api(table,body),first=await write(db,create);assert.equal(first.sort_order,1,table);
    assert.deepEqual(await write(db,create),first,'Retry does not append twice');
    await write(db,api(table,{},first,'delete'));
    if(body.semantic_name)body.semantic_name=crypto.randomUUID();if(body.code)body.code='000'+crypto.randomUUID();
    const second=await write(db,api(table,body));assert.equal(second.sort_order,2,'Append includes archived positions');
    for(const sort_order of [null,-1,1.5,'3',2147483648])await assert.rejects(write(db,api(table,{sort_order},second)));
    const high=await write(db,api(table,{sort_order:100},second));assert.equal(high.sort_order,100);
    const owner=(await db.query(`SELECT * FROM catalog.${parent} WHERE id=$1`,[sample[parent+'_id']])).rows[0];
    const editKeys=(await db.query('SELECT catalog_private.edit_columns($1) k',[table])).rows[0].k;
    const patch=Object.fromEntries(Object.entries(body).filter(([k])=>editKeys.includes(k)));
    // Browser creation assigns its own semantic identifier; code values require a unique code.
    if(patch.semantic_name)patch.semantic_name=crypto.randomUUID();
    if(table==='code_value')patch.code='browser-'+crypto.randomUUID();
    const childId=crypto.randomUUID();
    await request(db,command(parent,owner,{},[{id:childId,expected_version:0,patch}]));
    assert.equal((await db.query(`SELECT sort_order FROM catalog.${table} WHERE id=$1`,[childId])).rows[0].sort_order,101,'Omitted browser RPC rank appends too');
  }
  let s=await snapshot();const object=s.business_object.find(r=>r.identifier==='gebaeude'),attrs=s.business_attribute.filter(r=>r.business_object_id===object.id);
  await request(db,command('business_object',object,{},attrs.map((r,i)=>({id:r.id,expected_version:r.row_version,patch:{sort_order:(attrs.length-i)*10}}))));
  s=await snapshot();s.business_attribute.reverse();
  const {DK}=runtime(s);await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'de');
  const e={...DK.data.objOf('gebaeude'),kind:'objects'},state={tableSorts:{}};
  const plan=()=>DK.excel.plan({view:'detail',kind:e.kind,entity:e,params:{}},{kind:e.kind,title:e.name,state},'http://localhost/');
  let p=plan(),sheet=p.sheets.find(s=>s.kind==='attrs');
  const records=sheet=>Array.from(sheet.rows,r=>Object.fromEntries(sheet.columns.map((c,i)=>[c.key,r[i]])));
  assert.deepEqual(records(sheet).map(r=>r.sortOrder),Array.from(e.attributes,a=>a._record.sort_order));
  assert.deepEqual(p.sheets.map(s=>s.kind).sort().join(','),'attrs,objects,overview,relations');
  state.tableSorts['detail:objects:rows']={field:'name',direction:'asc'};
  const sorted=records(plan().sheets.find(s=>s.kind==='attrs'));
  const orders=new Map(records(sheet).map(r=>[r.id,r.sortOrder]));assert(sorted.every(r=>orders.get(r.id)===r.sortOrder),'View sorting never renumbers saved order');
  const keys=Array.from(sheet.columns,c=>c.key);
  for(const lang of ['fr','it','en']){DK.ui.setDictionary(DK.data.i18n,lang);assert.deepEqual(Array.from(plan().sheets.find(s=>s.kind==='attrs').columns,c=>c.key),keys);}
  const wb=DK.excel.createWorkbook(p,ExcelJS),reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await wb.xlsx.writeBuffer());
  const ws=reopened.getWorksheet(sheet.name);assert.equal(ws.getCell(3,keys.indexOf('sortOrder')+1).value,records(sheet)[0].sortOrder);assert.equal(ws.getCell(3,keys.indexOf('sortOrder')+1).type,ExcelJS.ValueType.Number);
  assert.equal(ws.views[0].ySplit,2);assert.equal(Number(ws.autoFilter.from?.row || ws.autoFilter.split(':')[0].replace(/\D/g,'')),2);
  require('node:fs').writeFileSync(require('node:path').join(require('node:os').tmpdir(),'catalog-review-order.xlsx'),await wb.xlsx.writeBuffer());
  console.log('Row order: five child types, browser/REST append, archive positions, retries, invalid values, projection and Excel values/types/languages passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exit(1)});
