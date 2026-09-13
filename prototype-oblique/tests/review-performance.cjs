/* Isolate the removed lookup loop; timings are diagnostic, work counts are assertions. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {database,runtime}=require('./catalog-test-helpers.cjs');
(async()=>{
  const db=await database();
  try {
    const snapshot=(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
    const {DK}=runtime(snapshot);await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'de');
    const table=DK.data.tables.find(t=>t.fields.length),seed=table.fields[0],enrich=DK.data.fieldEntity,results=[];
    for(const size of [250,1000,3000]) {
      let reads=0;
      table.fields=Array.from({length:size},(_,i)=>{const row={...seed,_record:{...seed._record,id:crypto.randomUUID()}};Object.defineProperty(row,'identifier',{get(){reads++;return 'field-'+i;}});return row;});
      const measure=legacy=>{
        DK.data.fieldEntity=legacy?(parent,field)=>enrich(parent,field,parent.fields.findIndex(f=>DK.data.fieldId(f)===DK.data.fieldId(field))):enrich;
        const samples=[];let work;
        for(let n=0;n<4;n++){reads=0;const start=performance.now();const result=DK.detail.rowsData({...table,kind:'tables'});samples.push(performance.now()-start);work=reads;assert.equal(result.rows.length,size);}
        return {medianMs:samples.slice(1).sort((a,b)=>a-b)[1],identifierReads:work};
      };
      const before=measure(true),after=measure(false);
      assert(after.identifierReads<size*15);assert(before.identifierReads>size*size);
      results.push({rows:size,before,after});
    }
    const file=path.join(os.tmpdir(),'oblique-review-performance.json');fs.writeFileSync(file,JSON.stringify(results,null,2));
    console.log(JSON.stringify(results));console.log('PASS linear child enrichment; report: '+file);
  } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
