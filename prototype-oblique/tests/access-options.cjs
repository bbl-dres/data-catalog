/* Owned access metadata through real SQL, authenticated commands and export projections. */
const assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { database, runtime, root } = require('./catalog-test-helpers.cjs');
const { configureIdentity, request, command } = require('./editing-sql.cjs');
const { write, command: apiCommand } = require('./rest-crud.cjs');
const { generate } = require('../supabase/generate-openapi.cjs');
const ExcelJS = require('../vendor/exceljs/exceljs.min.js');
const option = (name = 'Excel export') => ({ id: crypto.randomUUID(), name_de: name, name_en: 'Data export', status: 'valid', isArchived: false,
  format: 'XLSX', accessUrl: 'https://example.invalid/access', downloadUrl: 'https://example.invalid/data.xlsx', accessNotes: 'Request access from the owner.', license: 'Internal use', comment: 'Reviewed source' });
(async () => {
  const db = await database();
  try {
    await configureIdentity(db);
    const read = async (table,id) => (await db.query(`SELECT * FROM catalog.${table} WHERE id=$1`,[id])).rows[0];
    const snapshot = (await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
    const owners = {};
    for (const [table,kind] of [['data_table','tables'],['data_product','products'],['data_service','apis']]) {
      const owner = snapshot[table][0], first = option('Excel <export>'), second = option('API data');
      assert.deepEqual(owner.access_options,[]);
      const add = command(table,owner,{access_options:[first,second]});
      for (const identity of [{role:'anon',user:null},{user:null},{anonymous:true}]) await assert.rejects(request(db,add,identity),e=>e.code==='42501');
      const saved = await request(db,add); assert.equal(saved.row_version,owner.row_version+1);
      assert.deepEqual(await request(db,add),saved,'Idempotent save');
      await assert.rejects(request(db,command(table,owner,{access_options:[first,second]})),e=>e.code==='40001','Stale revision');
      let current = await read(table,owner.id);
      for (const invalid of [null,{},[first,first],[{...first,unknown:true}],[{...first,name_de:'',name_en:''}],[{...first,isArchived:'false'}],
        [{...first,id:'bad-id'}],[{...first,accessUrl:'javascript:alert(1)'}],[{...first,downloadUrl:'https://user:secret@example.invalid/file'}]]) {
        await assert.rejects(request(db,command(table,current,{access_options:invalid})),e=>['22023','23514','23502'].includes(e.code));
      }
      await assert.rejects(write(db,apiCommand(table,{access_options:[]},current)),e=>e.code==='23514','Saved identities cannot disappear');
      await write(db,apiCommand(table,{access_options:[second,{...first,isArchived:true}]},current));
      current = await read(table,owner.id); assert.equal(current.access_options[0].id,second.id); assert(current.access_options[1].isArchived);
      await write(db,apiCommand(table,{access_options:[second,first]},current));
      current = await read(table,owner.id); assert(!current.access_options[1].isArchived);
      owners[kind] = current;
      const created = await write(db,apiCommand(table,{name_de:'New access owner',status:'draft',
        ...(table==='data_table' ? {system_id:owner.system_id} : {}),access_options:[option()]}));
      assert.equal(created.access_options.length,1,'REST creation accepts owned access entries');
      const history = (await db.query(`SELECT after FROM catalog.change_event WHERE record_${table}_id=$1 AND after::text LIKE '%access_options%'`,[owner.id])).rows;
      assert(history.length>=3,'Owner history includes access metadata');
    }
    const incomplete = {id:crypto.randomUUID(),name_de:'Draft',status:'draft',isArchived:false};
    const valid = async value => (await db.query('SELECT catalog_private.valid_access_options($1) AS valid',[value])).rows[0].valid;
    assert.equal(await valid([incomplete]),true);
    assert.equal(await valid([{...incomplete,status:'valid'}]),false);
    assert.equal(await valid([{...incomplete,status:'valid',accessNotes:'Open transaction ZDATA in SAP'}]),true);
    const snap = (await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
    const { DK, context } = runtime(snap); context.window.location = {href:'https://catalog.example/'}; await DK.data.load('data/');
    vm.runInContext(fs.readFileSync(path.join(root,'js/diagram-content.js'),'utf8'),context);
    for (const kind of Object.keys(owners)) {
      const entity = {...DK.data.get(kind,owners[kind].identifier),kind};
      const entries = DK.accessOptions.entries(entity); assert(entries.length>=2);
      const html = DK.accessOptions.render(entity); assert(html.includes('aria-expanded="false"')); assert(html.includes('Excel &lt;export&gt;')); assert(!html.includes('Excel <export>'));
      assert(DK.presentation.display(kind,entity).accessOptions.includes('https://example.invalid/data.xlsx'));
      assert(DK.presentation.choices(kind).some(f=>f.id==='accessOptions' && !f.defaultVisible));
      const plan = DK.excel.plan({view:'detail',kind,entity},{kind,title:entity.name,isList:false,state:{tableSorts:{}}});
      const sheet = plan.sheets.find(s=>s.kind==='accessOptions'); assert.equal(sheet.rows.length,2);
      assert(sheet.rows[0].includes('Data export'),'Other languages remain in Excel');
      const workbook = DK.excel.createWorkbook(plan, ExcelJS), reopened = new ExcelJS.Workbook();
      await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
      const ws = reopened.getWorksheet(sheet.name), keys = Array.from(sheet.columns,c=>c.key);
      assert.equal(ws.getCell(3,keys.indexOf('downloadUrl')+1).hyperlink,'https://example.invalid/data.xlsx');
      assert.equal(ws.getCell(3,keys.indexOf('name_en')+1).value,'Data export');
      assert(ws.getColumn(keys.indexOf('id')+1).hidden,'Nested identity is retained but hidden');
      assert.equal(ws.views[0].ySplit,2);
      const frozen = DK.diagram.snapshot({view:'detail',kind,entity},{kind,title:entity.name,isList:false},'de');
      assert(frozen.entities[0].display.accessOptions.includes('Internal use'),'Print projection includes access metadata');
    }
    const hostile = {kind:'tables',accessOptions:[{...option(),name_de:'<img src=x onerror=alert(1)>',accessUrl:'javascript:alert(1)',downloadUrl:'https://user:pass@example.invalid'}]};
    const html = DK.accessOptions.render(hostile); assert(!html.includes('<img')); assert(!html.includes('href="javascript:')); assert(!html.includes('href="https://user:'));
    const contract = await generate(db);
    for (const table of ['data_table','data_product','data_service']) {
      assert.equal(contract.components.schemas[table].properties.access_options.type,'array');
      assert.equal(contract.components.schemas[table].properties.access_options.items.additionalProperties,false);
      assert((await db.query('SELECT catalog_private.api_columns($1,false) AS columns',[table])).rows[0].columns.includes('access_options'));
    }
    console.log('PASS: access options for all three owners; validation, denial, revisions, retries, archive/restore/order, history, safe links, Excel, print and API schema.');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
