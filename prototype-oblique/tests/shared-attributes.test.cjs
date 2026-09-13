const test=require('node:test'),assert=require('node:assert/strict'),{database,runtime}=require('./catalog-test-helpers.cjs');
test('Confirmed specializations share canonical attributes, vocabularies and live translations',async()=>{
 const db=await database();try{
 const snapshot=(await db.query('SELECT catalog.read_snapshot() s')).rows[0].s;
 const parent=snapshot.business_object.find(o=>o.identifier==='gebaeude'),a={...parent,id:'child-a',identifier:'child-a',name_de:'Child A'},b={...a,id:'child-b',identifier:'child-b'},c={...a,id:'child-c',identifier:'child-c'};
 snapshot.business_object.push(a,b,c);
 const edge=(source,target,status='confirmed')=>({id:source.id+target.id,source_business_object_id:source.id,target_business_object_id:target.id,relationship_type:'specializes',verification_status:status,is_archived:false});
 const edges=[edge(a,parent),edge(b,parent),edge(c,a),edge(c,b)];snapshot.relationship.push(...edges);
 const {DK}=runtime(snapshot);await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'de');
 const get=id=>DK.data.get('objects',id),expected=get(parent.identifier).attributes.filter(a=>a.status!=='Archiviert');
 for(const object of [a,b,c]){
  const actual=get(object.identifier);assert.equal(actual.attributes.length,expected.length,'Diamond inheritance deduplicates original UUIDs');
  const rows=DK.detail.rowsData({...actual,kind:'objects'}).rows;
  assert(rows.every(r=>r.entity.object===parent.identifier&&r.href.startsWith('#/objects/gebaeude/attributes/')));
  assert.deepEqual(Array.from(actual.attributes,a=>a.codeList),Array.from(expected,a=>a.codeList));
 }
 const source=snapshot.business_attribute.find(a=>a.business_object_id===parent.id&&!a.is_archived&&a.status!=='retired');source.name_de='Changed at parent';source.name_fr='Modifié chez le parent';
 await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'fr');
 assert.equal(get(a.identifier).attributes.find(a=>a._record.id===source.id).name,'Modifié chez le parent');
 DK.ui.setDictionary(DK.data.i18n,'de');assert.equal(get(a.identifier).attributes.find(a=>a._record.id===source.id).name,'Changed at parent');
 assert.equal(DK.ui.t('rel.specializationOf'),'Spezialisierung von');
 edges[0].verification_status='candidate';edges[1].is_archived=true;await DK.data.load('data/');
 assert.equal(get(a.identifier).attributes.length,0,'Candidate assertions do not inherit');assert.equal(get(c.identifier).attributes.length,0,'Archived assertions do not inherit');
 assert.equal(DK.data.validate().length,0);
 }finally{await db.close();}
});
