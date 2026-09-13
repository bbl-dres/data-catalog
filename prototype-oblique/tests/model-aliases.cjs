/* Canonical Markdown -> actual SQL metadata, OpenAPI, UI definitions and XLSX cells. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), os = require('node:os');
const { read, root } = require('../scripts/model-contract.cjs');
const { bindings } = require('../scripts/model-alias-bindings.cjs');
const { generate: labels } = require('../scripts/sync-model-aliases.cjs');
const { generate: openapi } = require('../supabase/generate-openapi.cjs');
const { database, runtime } = require('./catalog-test-helpers.cjs');
const ExcelJS = require('../vendor/exceljs/exceljs.min.js');
(async()=>{
  const model = read(), db = await database();
  try {
    for (const [file,expected] of labels().files) assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),expected,'Regenerate '+file);
    const spec = await openapi(db);
    const columns = (await db.query("SELECT c.relname AS table_name,a.attname AS column_name,col_description(c.oid,a.attnum) AS description FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='catalog' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped")).rows;
    for (const c of columns) {
      const d = model.column(c.table_name,c.column_name), property = spec.components.schemas[c.table_name].properties[c.column_name];
      assert.equal(property.title,d.en,d.id);
      assert.deepEqual(property['x-aliases'],{en:d.en,de:d.de},d.id);
      assert.equal(property['x-canonical-property'],d.id);
      assert(c.description.startsWith(d.en+'. '),c.table_name+'.'+c.column_name+' SQL alias');
      assert(c.description.includes('Alias (DE): '+d.de+'.'),d.id+' SQL German alias');
      assert.equal(c.description,`${d.en}. ${d.description} Alias (DE): ${d.de}. Canonical: ${d.id}.`,d.id+' canonical SQL description');
    }
    for (const table of Object.keys(model.byTable)) for (const [name,p] of Object.entries(spec.components.schemas[table].properties)) {
      const nested = p.items?.properties || p.properties;
      for (const field of Object.values(nested || {})) assert.deepEqual(field['x-aliases'],((d)=>({en:d.en,de:d.de}))(model.get(field['x-canonical-property'])));
    }
    // Use different real stored values to expose the former service/definition-version confusion.
    await db.exec("UPDATE catalog.data_service SET version='catalog-3',version_date='2026-09-13',service_version='interface-7' WHERE id=(SELECT id FROM catalog.data_service LIMIT 1)");
    const snapshot = (await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
    const { DK, context } = runtime(snapshot); context.window.location = {href:'https://catalog.example/'}; await DK.data.load('data/');
    for (const file of ['edit-schema','diagram-content']) vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),context);
    const names = ['objects','tables','domains','systems','refs','products','apis','attrs','fields','values','productAttrs'];
    for (const language of ['de','en']) {
      DK.ui.setDictionary(DK.data.i18n,language);
      const alias = (id,selected=false) => model.label(id,language,selected);
      for (const kind of names) assert.equal(DK.ui.t(DK.presentation.definitions(kind).find(f=>f.id==='name').label),alias('Actor.name_de',true),kind+' Name');
      for (const [kind,id,canonical] of [['attrs','type','ValueSpecification.valueType'],['productAttrs','type','ValueSpecification.valueType'],['fields','type','DataField.sourceDataType'],['fields','key','DataField.keyRoles'],['attrs','key','Presentation.businessKeyRole'],['refs','responsibleOrg','CodeList.authorityOrganisation'],['objects','responsibleOrg','BusinessObject.responsibleOrganisation'],['apis','serviceVersion','DataService.serviceVersion']]) {
        assert.equal(DK.ui.t(DK.presentation.definitions(kind).find(f=>f.id===id).label),alias(canonical),kind+'.'+id);
      }
      for (const kind of names) for (const f of DK.presentation.definitions(kind)) if (bindings[f.label]) {
        const b=bindings[f.label];assert.equal(DK.ui.t(f.label),alias(b.id,b.selected));
      }
      for (const table of [...Object.values(DK.editSchema.kinds),'service_endpoint','business_attribute','data_field','product_attribute','code_value']) for (const [,fields] of DK.editSchema.groups(table)) for (const f of fields) {
        assert(bindings[f.label], 'Unmapped editor field: '+table+'.'+f.key+' ('+f.label+')');
        const b=bindings[f.label];assert.equal(DK.ui.t(f.label),alias(b.id,b.selected));
      }
      for (const table of ['business_attribute','product_attribute']) {
        const field = DK.editSchema.groups(table).flatMap(([,fields])=>fields).find(f=>f.key==='valueType');
        assert.equal(DK.ui.t(field.label),alias('ValueSpecification.valueType'),table+' semantic value-type label');
      }
      const service = DK.data.apis.find(e=>e._record.version==='catalog-3');
      assert.equal(service.version,'catalog-3');assert.equal(DK.data.serviceVersionOf(service),'interface-7');
      const facts = DK.detail.facts({...service,kind:'apis'});
      assert.equal(facts.metadata.find(f=>f.label===alias('DataService.version')).value,'catalog-3');
      assert.equal(facts.primary.find(f=>f.label===alias('DataService.serviceVersion')).value,'interface-7');
      const plan = DK.excel.plan({view:'list',kind:'objects'},{isList:true,kind:'objects',state:{},groups:[]},'https://catalog.example/',{scope:'catalog'});
      for (const s of plan.sheets.filter(s=>!['overview','relations'].includes(s.kind))) {
        const byKey = Object.fromEntries(s.columns.map(c=>[c.key,c]));
        assert.equal(byKey.name.label,alias(s.kind==='endpoints'?'Presentation.endpointName':'Actor.name_de',s.kind!=='endpoints'));
        assert.equal(byKey.identifier.label,alias('Actor.identifier'));
        if (byKey.sortOrder) assert.equal(byKey.sortOrder.label,alias('BusinessAttribute.sortOrder'));
        if (byKey.createdOn) assert.equal(byKey.createdOn.label,alias('Actor.createdOn'));
        if (byKey.valueType) assert.equal(byKey.valueType.label,alias('ValueSpecification.valueType'));
        if (byKey.sourceDataType) assert.equal(byKey.sourceDataType.label,alias('DataField.sourceDataType'));
        if (byKey.accessNotes) assert.equal(byKey.accessNotes.label,alias('DataProduct.accessNotes'));
        if (byKey.licenseNotes) assert.equal(byKey.licenseNotes.label,alias('DataProduct.licenseNotes'));
        if (s.kind==='values') for (const lang of ['de','fr','it','en']) assert.equal(byKey['name_'+lang].label,alias('CodeValue.name_'+lang));
      }
      const book = DK.excel.createWorkbook(plan,ExcelJS), bytes = await book.xlsx.writeBuffer(), reopened = new ExcelJS.Workbook();
      await reopened.xlsx.load(bytes);
      for (const s of plan.sheets) assert.deepEqual(Array.from(reopened.getWorksheet(s.name).getRow(2).values).slice(1),Array.from(s.columns,c=>c.label),s.name+' actual XLSX labels');
      fs.writeFileSync(path.join(os.tmpdir(),'catalog-aliases-'+language+'.xlsx'),bytes);
      for (const kind of ['objects','tables','refs','products','apis']) {
        const print = DK.diagram.snapshot({kind},{kind,title:'Aliases',isList:true,groups:[{items:DK.data.list(kind)}]},language);
        assert.equal(print.entityFields.find(f=>f.id==='name').labelText,alias('Actor.name_de',true));
        assert(print.labels.legend.includes(alias('Actor.identifier') + ':'), 'Print legend uses the canonical identifier alias');
        if (['objects','tables','products'].includes(kind)) assert.equal(print.rowFields.find(f=>f.id==='type').labelText,alias(kind==='tables'?'DataField.sourceDataType':kind==='products'?'Presentation.productComponentType':'ValueSpecification.valueType'));
      }
    }
    console.log(`Canonical aliases: ${columns.length} SQL/API columns, owned JSON labels, ${Object.keys(bindings).length} EN/DE bindings, forms, print snapshots, actual XLSX headers and distinct service versions passed.`);
  } finally { await db.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
