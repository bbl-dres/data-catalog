const test=require('node:test'),assert=require('node:assert/strict');
const {database,runtime}=require('./catalog-test-helpers.cjs');
test('Explicit attribute mappings connect tables and fields without inventing equivalence',async()=>{
 const db=await database({bundle:true});
 try{
  const snapshot=(await db.query('SELECT catalog.read_snapshot() AS s')).rows[0].s;
  const attribute=snapshot.business_attribute.find(a=>a.identifier==='gebaeude/baujahr');
  const fields=['t-geb-gis/bbl_bjahr','t-sap-building/CONSTRUCTION_YEAR','t-gwr-gebaeude/GBAUJ'].map(id=>snapshot.data_field.find(f=>f.identifier===id));
  assert(fields.every(Boolean)&&attribute);
  const rows=fields.map((f,i)=>({id:'mapping-'+i,source_data_field_id:f.id,target_business_attribute_id:attribute.id,relationship_type:'represents',verification_status:i===1?'confirmed':'candidate',is_archived:false}));
  const {DK}=runtime(snapshot);await DK.data.load('data/');DK.ui.setDictionary(DK.data.i18n,'de');
  const group=(kind,e,key)=>DK.data.relations(kind,e).find(g=>g.key===key).items;
  const attr=()=>DK.data.attr(attribute.identifier);
  assert.equal(group('attrs',attr(),'mappedTables').length,0,'Names alone never map fields');
  snapshot.relationship.push(...rows);await DK.data.load('data/');
  assert.equal(group('attrs',attr(),'mappedTables').length,3);
  const links=group('attrs',attr(),'realizedInFields');assert.equal(links.length,3);
  assert(links.some(l=>l.sub.includes('Bestätigt')));assert.equal(links.filter(l=>l.sub.includes('Zu prüfen')).length,2);
  for(const field of fields){
   const e=DK.data.field(field.identifier),table=DK.data.get('tables',e.table);
   assert.equal(group('fields',e,'representedAttributes')[0].href,DK.router.entityHref('attrs',attribute.identifier));
   assert.equal(group('tables',table,'representedAttributes').length,1,'Table links back to the business attribute');
  }
  const extra=snapshot.data_field.find(f=>f.data_table_id===fields[0].data_table_id&&f.id!==fields[0].id);
  snapshot.relationship.push({...rows[0],id:'same-table',source_data_field_id:extra.id});await DK.data.load('data/');
  assert.equal(group('attrs',attr(),'mappedTables').length,3,'Multiple fields do not duplicate the table');
  assert.equal(group('attrs',attr(),'realizedInFields').length,4);
  rows[1].verification_status='rejected';rows[2].is_archived=true;await DK.data.load('data/');
  assert.equal(group('attrs',attr(),'mappedTables').length,1,'Rejected and archived mappings are excluded');
  assert.equal(group('fields',DK.data.field(fields[1].identifier),'representedAttributes').length,0);
  fields[0].status='retired';extra.is_archived=true;await DK.data.load('data/');
  assert.equal(group('attrs',attr(),'mappedTables').length,0,'Retired or archived fields are excluded');
  fields[0].status='draft';snapshot.data_table.find(t=>t.id===fields[0].data_table_id).status='retired';await DK.data.load('data/');
  assert.equal(group('attrs',attr(),'mappedTables').length,0,'Retired source tables are excluded');
  snapshot.data_table.find(t=>t.id===fields[0].data_table_id).status='draft';attribute.status='retired';await DK.data.load('data/');
  assert.equal(group('attrs',attr(),'mappedTables').length,0,'Retired target attributes are excluded');
  assert.equal(group('fields',DK.data.field(fields[0].identifier),'representedAttributes').length,0);
 }finally{await db.close();}
});
