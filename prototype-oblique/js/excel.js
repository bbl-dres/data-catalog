/* Review workbooks: explicit scope, stable keys and saved row order. ExcelJS loads on demand. */
(function (DK) {
  'use strict';
  const { ui, data, router } = DK, t = ui.t, excel = {};
  const libraryUrl = typeof document === 'undefined' ? '' : new URL('../vendor/exceljs/exceljs.min.js', document.currentScript.src).href;
  let loading;
  const kinds = ['domains','systems','objects','attrs','tables','fields','refs','values','products','apis','apiFields','endpoints'];
  const colours = { domains:'1D4ED8',systems:'1D4ED8',objects:'C2410C',attrs:'C2410C',tables:'596978',fields:'596978',refs:'047857',values:'047857',products:'6D28D9',apis:'6D28D9',apiFields:'6D28D9',endpoints:'6D28D9' };
  const labels = { domains:'excel.domains',systems:'excel.systems',objects:'print.kind.objects',tables:'print.kind.tables',refs:'print.kind.refs',products:'print.kind.products',attrs:'col.attributes', fields:'col.fields', values:'col.values', apis:'excel.apis', apiFields:'apiFields.title', endpoints:'excel.endpoints' };
  const nameLabel = { domains:'fact.domain',systems:'fact.system',objects:'col.object',attrs:'col.attribute',tables:'fact.table',fields:'col.field',refs:'col.codeList',values:'col.label',products:'excel.product',apis:'excel.api',endpoints:'excel.endpoint' };
  const sheetName = kind => labels[kind] ? t(labels[kind]) : data.kindDef(kind).plural;
  const empty = value => value == null ? null : typeof value === 'object' ? JSON.stringify(value) : value;
  const actorName = value => typeof value === 'string' ? value : value?.name;
  const definition = kind => ui.language()==='de' && data.model.kinds[kind]?.description ? data.model.kinds[kind].description : t('excel.definition.'+kind);
  const alpha = (kind, items) => ui.sortRows(items, {column:0,direction:'asc'}, e=>[data.displayName(kind,e)]);
  const identity = e => e?._record?.id || e?.id || null;
  const canonicalId = e => e?._record?.identifier || e?.identifier || null;
  const lookup = (kind,id) => kind==='attrs' ? data.attr(id) : kind==='fields' ? data.field(id) : data.get(kind,id);
  function columns(kind) {
    if(kind==='apiFields')return columns('fields').map(c=>c.key==='dataTableId'?{...c,key:'dataServiceId',label:t('excel.dataService')}:c.key==='dataTableName'?{...c,key:'dataServiceName',label:t('excel.dataService')}:c);
    const out=[];
    const c=(key,label,width=24,block='content',type,hidden=false)=>{out.push({key,label:t(label),width,block,type,hidden});};
    const ref=(key,label)=>{c(key+'Id',label,32,'context',undefined,true);c(key+'Name',label,25,'context');};
    if(!['domains','systems','values','endpoints'].includes(kind))ref('domain','fact.domain');
    if(['tables','fields','apis'].includes(kind))ref('system','fact.system');
    if(kind==='domains')ref('parentDomain','edit.parentDomain');
    if(kind==='attrs'){ref('businessObject','col.object');ref('dataProduct','excel.product');}
    if(kind==='fields')ref('dataTable','fact.table');
    if(kind==='values')ref('codeList','col.codeList');
    if(kind==='endpoints')ref('dataService','excel.dataService');
    if(['attrs','fields','values','endpoints','tables'].includes(kind))c('sortOrder','excel.sortOrder',18,'entry','number');
    if(['attrs','fields'].includes(kind))c('propertyGroup','fact.propertyGroup',24,'entry');
    c('id','excel.internalId',36,'entry',undefined,true);
    c('identifier','fact.identifier',28,'entry');
    if(kind==='values')c('code','col.code',16,'entry');
    c('name',kind==='endpoints'?'excel.endpoint':'col.name',30,'entry');out.at(-1).freeze=true;
    if(['tables','fields','apis'].includes(kind))c('technicalName','fact.technicalName',24,'entry');
    if(!['endpoints'].includes(kind)) {
      c('responsibleOrganisationName',['refs','values'].includes(kind)?'fact.authorityOrganisation':'col.responsibility',32,'responsibility');
      if(!['refs','values'].includes(kind)) {
        for(const [key,label] of [['dataOwner','detail.owner'],['dataSteward','detail.steward'],...(['systems','tables','fields','apis'].includes(kind)?[['dataCustodian','detail.dataCustodian']]:[])]) {
          c(key+'Id',label,36,'responsibility',undefined,true);c(key+'Name',label,24,'responsibility');
        }
      }
      c('description','col.description',60);
    }
    if(['objects','attrs'].includes(kind)) {
      c('systemOfRecordId','fact.systemOfRecord',36,'content',undefined,true);
      c('effectiveSystemOfRecordId','fact.effectiveSystemOfRecord',36,'content',undefined,true);
      c('systemOfRecordName','fact.systemOfRecord',28);
      if(kind==='attrs')c('systemOfRecordInherited','excel.inherited',16,'content','boolean');
    }
    const specs={
      domains:[],systems:[['systemType','edit.systemType'],['technology','fact.technology']],
      objects:[['normativeReferences','fact.normReference']],
      attrs:[['semanticName','edit.semanticName'],['valueType','excel.valueType'],['unit','edit.unit'],['keyRole','fact.businessKey'],['required','fact.requiredRule','boolean'],['codeListId','col.codeList'],['codeListName','col.codeList']],
      tables:[['databaseName','edit.databaseName'],['schemaName','edit.schemaName']],
      fields:[['sourceDataType','excel.dataType'],['sourcePath','edit.sourcePath'],['keyRoles','fact.key'],['isRequired','fact.mandatory','boolean'],['isNullable','edit.nullable','boolean'],['codeListId','col.codeList'],['codeListName','col.codeList']],
      refs:[['normativeReferences','fact.normReference']],
      values:[['name_de','excel.labelDe'],['name_fr','excel.labelFr'],['name_it','excel.labelIt'],['name_en','excel.labelEn']],
      products:[['accessMode','edit.accessMode'],['accessNotes','edit.accessNotes'],['formats','fact.format'],['licenseUri','edit.licenseUrl'],['licenseNotes','edit.licenseNotes'],['updateFrequency','edit.frequency']],
      apis:[['serviceVersion','edit.serviceVersion'],['accessMode','edit.accessMode'],['accessNotes','edit.accessNotes']],
      endpoints:[['url','excel.url','link'],['protocol','edit.protocol'],['httpMethod','edit.httpMethod'],['operationName','edit.operationName'],['relativePath','edit.relativePath'],['environment','edit.environment'],['isReadOnly','edit.readOnly','boolean'],['supportsBulk','edit.bulk','boolean'],['authenticationMethods','edit.authenticationMethods']]
    };
    (specs[kind]||[]).forEach(([key,label,type])=>c(key,label,type==='link'?44:24,'content',type));
    if(kind!=='endpoints') {
      c('comment','fact.comment',45);c('documentationLinks','fact.moreInformation',44,'source','link');
      c('status','fact.status',18,'status');c('version','fact.version',16,'status');
    }
    c('createdOn','fact.created',18,'status');
    c('remark','excel.remark',36,'feedback');
    out.forEach(c=>{if(c.key==='id' || c.key.endsWith('Id'))c.hidden=true;});
    return out;
  }
  function rowValues(kind,e,parent) {
    const r=e._record || (kind==='endpoints'?e:{}), pr=parent?._record || {};
    const dom=data.domainForEntity(parent?.kind || kind,parent || e), sys=data.sysOf(e.system || parent?.system);
    const values={id:identity(e),identifier:canonicalId(e),name:(kind==='fields'?e.label:null) || e.name || e.label || e.operation_name || e.identifier || e.url,
      domainId:identity(dom),domainName:dom?.name,systemId:identity(sys),systemName:sys?.name,
      sortOrder:r.sort_order ?? e.sortOrder ?? null,propertyGroup:r.property_group ?? e.propertyGroup ?? null,description:e.description,
      responsibleOrganisationName:e.responsibleOrg || (['values','attrs'].includes(kind)?parent?.responsibleOrg:null),
      technicalName:r.technical_name ?? e.technicalName,comment:r.comment ?? e.comment ?? e.note,
      documentationLinks:(e.informationUrls || []).join('; '), status:e.status,version:e._record?r.version:e.version,createdOn:r.created_on ?? e.created,
      normativeReferences:r.normative_references?.join('; ') ?? e.normReference,remark:''};
    for(const role of ['dataOwner','dataSteward','dataCustodian']) {
      const snake=role.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())+'_id';
      values[role+'Id']=r[snake] || (parent ? pr[snake] : null);
      values[role+'Name']=actorName(role==='dataCustodian' ? data.custodianOf(kind,e) : e[role] || parent?.[role]);
      if(role==='dataCustodian' && ['tables','fields'].includes(kind))values[role+'Id'] ||= sys?._record?.data_custodian_id;
    }
    for(const [key,col] of [['systemType','system_type'],['technology','technology'],['semanticName','semantic_name'],['sourceDataType','source_data_type'],['sourcePath','source_path'],['databaseName','database_name'],['schemaName','schema_name'],['accessMode','access_mode'],['accessNotes','access_notes'],['licenseUri','license_uri'],['licenseNotes','license_notes'],['updateFrequency','update_frequency']]) values[key]=r[col] ?? e[key];
    values.formats=r.formats?.join('; ') ?? e.format;
    values.accessNotes ??= e.accessRights;values.licenseNotes ??= e.license;values.updateFrequency ??= e.accrualPeriodicity;
    values.valueType=r.value_specification?.valueType ?? e.valueType;values.unit=r.value_specification?.unit ?? e.unit;
    values.required=typeof e.mandatory==='boolean'?e.mandatory:null;values.keyRole=e.keyRole;
    values.sourceDataType ??= e.dataType;values.isRequired=r.is_required ?? e.mandatory;values.isNullable=r.is_nullable ?? e.nullable;values.keyRoles=r.key_roles?.join('; ') ?? e.keyRole;
    const codes=data.get('refs',e.codeList);values.codeListId=r.code_list_id ?? identity(codes);values.codeListName=codes?.name;
    if(parent) {
      const key={objects:'businessObject',products:'dataProduct',tables:'dataTable',refs:'codeList',apis:'dataService'}[parent.kind];
      if(key){values[key+'Id']=identity(parent) || parent.identifier;values[key+'Name']=parent.name;}
    }
    if(kind==='domains'){const parentDomain=data.get('domains',e.parentDomain || data.catalogSnapshot?.domain.find(x=>x.id===r.parent_domain_id)?.identifier);values.parentDomainId=r.parent_domain_id;values.parentDomainName=parentDomain?.name;}
    if(kind==='values') {
      values.code=String(e.code??'');for(const lang of ['de','fr','it','en']) values['name_'+lang]=r['name_'+lang] ?? e.labels?.[lang] ?? (lang==='de'?e.label:null);
      values.status=parent?.status;values.version=parent?.version;
    }
    if(kind==='attrs' && parent?.kind==='products'){values.status=parent.status;values.version=parent.version;}
    if(['objects','attrs'].includes(kind)) {
      const system=data.systemOfRecordOf(e);values.systemOfRecordId=r.system_of_record_id;
      values.effectiveSystemOfRecordId=identity(system);values.systemOfRecordName=system?.name;
      values.systemOfRecordInherited=system?!!e.systemOfRecordInheritedFrom:null;
    }
    if(kind==='apis')values.serviceVersion=data.serviceVersionOf(e);
    if(kind==='endpoints')for(const key of ['url','protocol','httpMethod','operationName','relativePath','environment','isReadOnly','supportsBulk','authenticationMethods']) {
      const v=r[key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())];values[key]=Array.isArray(v)?v.join('; '):v;
    }
    return values;
  }
  /** Freeze scope, language and values before asynchronous writer loading. */
  excel.plan=function(route,ctx,baseUrl=window.location.href,{scope='selection'}={}) {
    if(!['selection','catalog'].includes(scope))throw new Error('Unknown Excel export scope: '+scope);
    const catalog=scope==='catalog',collection=ctx.isList ?? route.view==='list',title=catalog?t('excel.catalog'):ctx.title;
    const rootKind=ctx.kind || route.kind, state={...ctx.state,tableSorts:ctx.state?.tableSorts || {}};
    const roots=catalog?data.kinds.flatMap(kind=>alpha(kind,data.list(kind)).map(e=>({...e,kind})))
      :!collection&&route.entity?[{...route.entity,kind:route.entity.kind || route.kind}]:(ctx.groups || []).flatMap(g=>DK.presentation.sort(rootKind,g.items,DK.presentation.sortOptions(state,`list:${rootKind}`,rootKind).sort).map(e=>({...e,kind:rootKind})));
    const byKind=new Map(), relationSources=new Map(), accessOwners=new Map();
    const relate=(kind,e)=>relationSources.set(`${kind}:${canonicalId(e)}`,{...e,kind});
    const add=(kind,e,parent)=>{if(!byKind.has(kind))byKind.set(kind,[]);byKind.get(kind).push(rowValues(kind==='apiFields'?'fields':kind,e,parent));if(DK.accessOptions?.supports(kind))accessOwners.set(kind+':'+identity(e),{...e,kind});};
    const children=(e)=> {
      if(e.kind==='apis') {
        const fields=(e.fields || []).map((field,index)=>data.apiFieldEntity(e,field,index));
        const sort=!catalog&&route.entity?.identifier===e.identifier ? state.tableSorts?.['detail:apis:rows'] : null;
        (sort?DK.presentation.sort('fields',fields,sort):fields).forEach(field=>add('apiFields',field,e));
      }
      const items=e.kind==='domains'?alpha('objects',data.membersOfDomain('objects',e)):e.kind==='systems'?alpha('tables',data.tablesOfSystem(e))
        :e.kind==='objects'||e.kind==='products'?e.attributes:e.kind==='tables'?e.fields:e.kind==='refs'?e.values:e.kind==='apis'?e.endpoints || []:[];
      const childKind={domains:'objects',systems:'tables',objects:'attrs',products:'attrs',tables:'fields',refs:'values',apis:'endpoints'}[e.kind];
      const enriched=items.map((item,position)=>e.kind==='objects'?data.attributeEntity(e,item):e.kind==='tables'?data.fieldEntity(e,item,position):item);
      const sort=!catalog&&e.kind!=='apis'&&route.entity?.identifier===e.identifier ? state.tableSorts?.[`detail:${e.kind}:rows`] : null;
      const ordered=sort?DK.presentation.sort(e.kind==='products'?'productAttrs':childKind,enriched,sort):enriched;
      ordered.forEach(item=>{add(childKind,item,e);if(['objects','tables'].includes(childKind) || childKind==='fields' || childKind==='attrs'&&e.kind==='objects')relate(childKind,item);});
    };
    roots.forEach(e=> {
      const parent=e.kind==='attrs'?{...data.objOf(e.object),kind:'objects'}:e.kind==='fields'?{...data.get('tables',e.table),kind:'tables'}:null;
      add(e.kind,e,parent);
      if(catalog || !collection){relate(e.kind,e);if(!catalog || !['domains','systems'].includes(e.kind))children(e);}
    });
    // An empty filtered list still has its fixed schema, with no invented records.
    if(collection&&!catalog&&!byKind.has(rootKind))byKind.set(rootKind,[]);
    const col=(key,label,width=24,type)=>({key,label:t(label),width,type});
    const overview={kind:'overview',name:t('detail.tab.overview'),color:'344154',columns:[col('property','excel.property',32),col('value','excel.value',100)],rows:[
      [t('excel.selection'),title],[t('excel.exported'),new Date().toISOString()],[t('excel.filter'),catalog?'':ctx.filter || ''],
      [t('excel.selectedCount'),roots.length],[t('excel.scope'),t(catalog?'excel.catalogScopeNote':'excel.scopeNote')],[t('excel.contents'),t('excel.reviewNote')]]};
    const sheets=[overview];
    kinds.forEach(kind=>{if(!byKind.has(kind))return;const cols=columns(kind),rows=byKind.get(kind).map(r=>cols.map(c=>empty(c.type==='boolean'?typeof r[c.key]==='boolean'?t(r[c.key]?'yes':'no'):null:r[c.key])));
      sheets.push({kind,name:sheetName(kind),color:colours[kind],columns:cols,rows});overview.rows.push([sheetName(kind),definition(kind)]);
    });
    const accessColumns = [{...col('ownerId','excel.internalId',36),hidden:true},col('ownerIdentifier','fact.identifier',30),{...col('ownerName','access.parent',30),freeze:true},
      {...col('id','excel.internalId',36),hidden:true},col('name','col.name',30),...['de','fr','it','en'].map(lang=>col('name_'+lang,'excel.label'+lang[0].toUpperCase()+lang.slice(1),30)),
      col('format','access.format',20),col('status','fact.status',16),col('accessUrl','access.accessUrl',50,'link'),col('downloadUrl','access.downloadUrl',50,'link'),
      col('accessNotes','access.accessNotes',50),col('license','access.license',40),col('comment','fact.comment',45),{...col('remark','excel.remark',36),block:'feedback'}];
    const accessRows = [...accessOwners.values()].flatMap(owner=>DK.accessOptions.authored(owner).map(option=>{
      const values={...option,ownerId:identity(owner),ownerIdentifier:canonicalId(owner),ownerName:data.displayName(owner.kind,owner),name:ui.localized(option,'name_'),status:t('edit.value.'+option.status),remark:''};
      return accessColumns.map(column=>values[column.key] ?? '');
    }));
    if(accessRows.length){const sheet={kind:'accessOptions',name:t('access.title'),color:colours.tables,columns:accessColumns,rows:accessRows};sheets.push(sheet);overview.rows.push([sheet.name,t('access.exportDescription')]);}
    const relations={kind:'relations',name:t('detail.tab.relations'),color:'828E9A',columns:[col('sourceKind','excel.sourceType'),col('sourceId','excel.sourceId',36),col('sourceIdentifier','excel.sourceIdentifier',32),col('sourceName','excel.sourceName',30),col('relationship','excel.relationship',30),col('targetKind','excel.targetType'),col('targetId','excel.targetId',36),col('targetIdentifier','excel.targetIdentifier',32),col('targetName','excel.targetName',30),col('comment','fact.comment',45),{...col('remark','excel.remark',36),block:'feedback'}],rows:[]};
    relations.columns.forEach(c=>{if(['sourceId','targetId'].includes(c.key))c.hidden=true;if(c.key==='sourceName')c.freeze=true;});
    relationSources.forEach(e=>data.relations(e.kind,e).forEach(g=>g.items.forEach(item=>{const targetRoute=router.parse(item.href),target=lookup(targetRoute.kind,targetRoute.id);relations.rows.push([t(nameLabel[e.kind]),identity(e),canonicalId(e),e.name,g.title,targetRoute.kind?t(nameLabel[targetRoute.kind]):null,identity(target),canonicalId(target) || targetRoute.id,item.name,item.sub,'']);})));
    if(relations.rows.length){sheets.push(relations);overview.rows.push([relations.name,t('excel.definition.relations')]);}
    const date=new Date().toISOString().slice(0,10),fileScope=catalog?'gesamt':ui.slug(title)||'ansicht';
    return {filename:`datenkatalog_${fileScope}_${date}.xlsx`,title,sheets,longTextName:t('excel.longTexts'),continuation:t('excel.continuation'),
      longColumns:[col('identifier','fact.identifier'),col('sheet','excel.sheet'),col('row','excel.row',12,'number'),col('column','excel.column'),col('part','excel.part',12,'number'),col('text','excel.value',100)]};
  };
  excel.createWorkbook=function(plan,ExcelJS) {
    const workbook=new ExcelJS.Workbook();workbook.creator='BBL Datenkatalog';workbook.title=plan.title;
    const used=new Set(['history']),nameOf=proposed=>{const base=proposed.replace(/[\\/*?:\[\]]/g,' ').replace(/^'+|'+$/g,'').slice(0,31)||'Sheet';let name=base,n=1;while(used.has(name.toLowerCase())){const suffix=` (${++n})`;name=base.slice(0,31-suffix.length)+suffix;}used.add(name.toLowerCase());return name;};
    const longTexts=[];let longTextName;
    const add=(s,reservedName)=> {
      if(s.rows.length>1048574)throw new Error('Excel worksheet row limit exceeded');
      const ws=workbook.addWorksheet(reservedName||nameOf(s.name),{properties:{tabColor:{argb:'FF'+(s.color||'344154')}},views:[{state:'frozen',ySplit:2,xSplit:Math.max(0,s.columns.findIndex(c=>c.freeze)+1),showGridLines:false}]});
      ws.columns=s.columns.map(c=>({width:c.width,hidden:!!c.hidden}));
      for(const key of ['key','label']){const header=ws.addRow();s.columns.forEach((c,i)=>header.getCell(i+1).value=c[key] || `column${i+1}`);}
      s.rows.forEach((values,index)=>{
        const row=ws.addRow();let height=30;
        values.forEach((value,i)=>{
          const c=s.columns[i],cell=row.getCell(i+1);let v=empty(value);if(v==='')v=null;
          if(typeof v==='string'&&v.length>32767){longTextName ||= nameOf(plan.longTextName);const id=`T${longTexts.length+1}`;
            for(let start=0,part=1;start<v.length;part++){let end=Math.min(start+32000,v.length);if(end<v.length&&/[\uD800-\uDBFF]/.test(v[end-1]))end--;longTexts.push([id,ws.name,index+3,c.key||c.label,part,v.slice(start,end)]);start=end;}
            v=`${Array.from(v).slice(0,1000).join('')}\n[${plan.continuation}: ${longTextName} / ${id}]`;
          }
          cell.value=c.type==='link'&&typeof v==='string'&&/^https?:\/\/[^\s;]+$/i.test(v)&&ui.safeHref(v)?{text:v,hyperlink:v}:v;
          cell.font={name:'Arial',size:11,...(cell.hyperlink?{color:{argb:'FF005EA8'},underline:true}:{})};
          cell.alignment={vertical:'top',horizontal:typeof v==='number'?'right':'left',wrapText:true};
          if(typeof v==='string')cell.numFmt='@';
          if(c.block==='feedback')cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF1F2'}};
          else if(c.block==='context')cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F9FB'}};
          if(!c.hidden)height=Math.max(height,Math.min(409,Math.max(...String(v??'').split('\n').map(line=>Math.ceil(line.length/Math.max(8,c.width-2))))*15+12));
        });row.height=height;
      });
      for(const n of [1,2]){const row=ws.getRow(n);row.height=n===1?32:42;row.eachCell(cell=>{cell.font={name:'Arial',size:n===1?10:11,bold:n===2,color:{argb:n===1?'FF596978':'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:n===1?'FFF0F4F7':'FF344154'}};cell.alignment={vertical:'middle',horizontal:'left',wrapText:true};});}
      ws.autoFilter={from:{row:2,column:1},to:{row:Math.max(2,ws.rowCount),column:s.columns.length}};
      return ws;
    };
    plan.sheets.forEach(s=>add(s));
    if(longTexts.length)add({name:longTextName,columns:plan.longColumns || ['ID','Sheet','Row','Column','Part','Text'].map((label,i)=>({key:label.toLowerCase(),label,width:i===5?100:24})),rows:longTexts},longTextName);
    return workbook;
  };

  excel.load = function () {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    loading ||= DK.resources.asset(libraryUrl, { ready: () => !!window.ExcelJS })
      .then(() => window.ExcelJS).catch(error => { loading = null; throw error; });
    return loading;
  };

  excel.download = async function (plan) {
    const ExcelJS = await excel.load();
    const workbook = excel.createWorkbook(plan, ExcelJS);
    const buffer = await workbook.xlsx.writeBuffer();
    ui.downloadBlob(plan.filename, new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };
  DK.excel = excel;
})(window.DK = window.DK || {});
