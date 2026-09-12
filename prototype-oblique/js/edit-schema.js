/* Curated editable properties. Database commands independently enforce the boundary. */
(function (DK) {
  'use strict';
  const kinds = { domains: 'domain', systems: 'system', objects: 'business_object', attrs: 'business_attribute', tables: 'data_table', fields: 'data_field', refs: 'code_list', products: 'data_product', apis: 'data_service' };
  const children = { business_object: ['business_attribute', 'business_object_id'], data_table: ['data_field', 'data_table_id'], code_list: ['code_value', 'code_list_id'], data_product: ['product_attribute', 'data_product_id'], data_service: ['service_endpoint', 'data_service_id'] };
  const field = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
  const select = (key, label, options, extra = {}) => field(key, label, 'select', { options, ...extra });
  const ref = (key, label, table, required = false) => field(key, label, 'reference', { table, required });
  const languages = ['de', 'fr', 'it', 'en'];
  const valueTypes = ['text', 'identifier', 'integer', 'decimal', 'boolean', 'date', 'dateTime', 'year', 'code', 'geometry', 'structured'];
  const protection = [select('classification','fact.classification',['public','internal','confidential','secret']),field('contains_personal_data','fact.personalData','boolean')];
  const governance = [field('organisationName','detail.organisation'),field('organisationUrl','edit.organisationUrl','url'),ref('data_owner_id','detail.owner','actor'),ref('data_steward_id','detail.steward','actor'),ref('contact_actor_id','edit.contact','actor')];
  const formats = [select('valueType','fact.format',valueTypes),field('valueFormat','edit.valueFormat'),field('unit','edit.unit'),field('geometryType','edit.geometryType'),field('coordinateReferenceSystem','edit.coordinateReferenceSystem')];
  const specs = {
    domain: [ref('parent_domain_id','edit.parentDomain','domain')],
    system: [select('system_type','edit.systemType',['application','register','modelRepository','distributedSource']),field('technology','fact.technology')],
    business_object: [ref('domain_id','fact.domain','domain',true),field('normative_references','fact.normReference','lines')],
    business_attribute: [field('semantic_name','edit.semanticName','text',{required:true}),...formats,select('keyRole','fact.key',['PK','FK','UK','none']),field('required','fact.mandatory','checkbox'),ref('code_list_id','col.codeList','code_list')],
    data_table: [ref('system_id','fact.system','system',true),ref('domain_id','fact.domain','domain'),field('technical_name','fact.technicalName'),field('database_name','edit.databaseName'),field('schema_name','edit.schemaName')],
    data_field: [field('technical_name','fact.technicalName','text',{required:true}),select('technical_name_kind','edit.technicalNameKind',['physicalColumn','modelAttribute','apiField','dataSourceField','unknown'],{required:true}),field('source_path','edit.sourcePath'),field('source_data_type','edit.sourceDataType'),select('data_type_scope','edit.dataTypeScope',['physicalSchema','modelDefinition','serviceSchema','unknown']),field('is_required','fact.mandatory','boolean'),field('is_nullable','edit.nullable','boolean'),field('key_roles','fact.key','keys'),ref('code_list_id','col.codeList','code_list'),field('applies_to_type_names','edit.appliesTo','lines')],
    code_list: [ref('domain_id','fact.domain','domain'),field('organisationName','detail.organisation'),field('organisationUrl','edit.organisationUrl','url'),field('normative_references','fact.normReference','lines')],
    code_value: [field('code','col.code','text',{required:true}),field('shortName','edit.shortName')],
    data_product: [ref('domain_id','fact.domain','domain'),select('access_mode','edit.accessMode',['public','internal','restricted']),field('access_notes','edit.accessNotes','textarea'),field('landing_page_url','edit.landingPage','url'),field('formats','edit.formats','lines'),field('license_uri','edit.licenseUrl','url'),field('license_notes','edit.licenseNotes'),select('update_frequency','edit.frequency',['continuous','daily','weekly','monthly','quarterly','annually','onChange','onDemand','irregular'])],
    product_attribute: [field('semantic_name','edit.semanticName','text',{required:true}),...formats,field('is_required','fact.mandatory','boolean')],
    data_service: [ref('system_id','fact.system','system'),ref('domain_id','fact.domain','domain'),field('technical_name','fact.technicalName'),field('service_version','edit.serviceVersion'),select('purpose','edit.purpose',['recordAccess','featureAccess','mapImage','download','mixed']),select('access_mode','edit.accessMode',['public','internal','restricted']),field('access_notes','edit.accessNotes','textarea'),field('endpoint_description_urls','edit.endpointDocs','urls')],
  };
  const endpointFields = [field('url','edit.endpointUrl','url'),field('relative_path','edit.relativePath'),field('operation_name','edit.operationName'),field('protocol','edit.protocol'),select('http_method','edit.httpMethod',['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']),select('environment','edit.environment',['production','test','development']),field('is_read_only','edit.readOnly','boolean'),field('supports_bulk','edit.bulk','boolean'),field('authentication_methods','edit.authenticationMethods','lines')];
  function groups(table) {
    if (table === 'service_endpoint') return [['detail.facts',endpointFields]];
    const status = !['code_value','product_attribute'].includes(table);
    const controlled = !['code_list','code_value','product_attribute'].includes(table);
    return [
      ['detail.facts', [...(status ? [select('status','fact.status',['draft','valid','retired'],{required:true})] : []), ...(specs[table] || []),field('links','fact.moreInformation','urls'),field('comment','fact.comment','textarea')]],
      ...(!['domain','code_list','code_value','product_attribute'].includes(table) ? [['detail.protection',protection]] : []),
      ...(controlled ? [['detail.contacts',[...governance,...(['system','data_table','data_field','data_service'].includes(table) ? [ref('data_custodian_id','detail.dataCustodian','actor')] : [])]]] : []),
      ...(status ? [['edit.definitionVersion',[field('version','fact.version'),field('version_date','edit.versionDate','date')]]] : []),
    ];
  }
  function defaults(table, lang, parent) {
    if (table === 'service_endpoint') return {id:crypto.randomUUID(),sort_order:0,is_archived:false,authentication_methods:[]};
    const r = { id: crypto.randomUUID(), name_de:null,name_fr:null,name_it:null,name_en:null, description_de:null,description_fr:null,description_it:null,description_en:null, comment:null, documentation_links:[] };
    if (!['code_value','product_attribute'].includes(table)) Object.assign(r,{status:'draft',version:null,version_date:null});
    for (const [, fields] of groups(table)) for (const f of fields) {
      if (!(f.key in r) && !['organisationName','organisationUrl','links','shortName','keyRole','valueType','valueFormat','unit','geometryType','coordinateReferenceSystem'].includes(f.key)) r[f.key] = ['lines','urls'].includes(f.type) ? [] : f.type === 'checkbox' ? false : null;
    }
    if (Object.values(children).some(([t]) => t === table)) Object.assign(r,{sort_order:0,is_archived:false});
    if (table === 'business_attribute' || table === 'product_attribute') Object.assign(r,{semantic_name:'attribute-'+r.id.slice(0,8),value_specification:null});
    if (table === 'data_field') r.technical_name_kind = 'unknown';
    if (table === 'business_object') r.domain_id = parent?.domain_id || parent?.id || null;
    return r;
  }
  function read(r, key, lang, table) {
    const org = r[table === 'code_list' ? 'authority_organisation' : 'responsible_organisation'] || {};
    const spec = r.value_specification || {};
    if (key === 'name' || key === 'description') return r[key+'_'+lang] || '';
    if (key === 'shortName') return r['short_name_'+lang] || '';
    if (key === 'organisationName') return org['name_'+lang] || '';
    if (key === 'organisationUrl') return org.websiteUrl || '';
    if (key === 'links') return (r.documentation_links || []).filter(x=>x.purpose !== 'terminology').map(x=>x.url).join('\n');
    if (key === 'keyRole') return r.is_identifier ? 'PK' : /(?:^|\n)Schlüsselrolle: (FK|UK)(?:\n|$)/.exec(r.comment || '')?.[1] || 'none';
    if (['valueType','unit','geometryType','coordinateReferenceSystem'].includes(key)) return spec[key] || '';
    if (key === 'valueFormat') return spec.format || '';
    return Array.isArray(r[key]) ? r[key].join('\n') : r[key] ?? '';
  }
  const blank = value => value.trim() || null;
  function write(r, f, value, lang, table) {
    const key = f.key;
    if (['name','description','shortName'].includes(key)) { r[(key === 'shortName' ? 'short_name' : key)+'_'+lang] = blank(value); return; }
    if (['organisationName','organisationUrl'].includes(key)) {
      const prop = table === 'code_list' ? 'authority_organisation' : 'responsible_organisation';
      const org = {...r[prop]}, subkey = key === 'organisationName' ? 'name_'+lang : 'websiteUrl';
      if (blank(value)) org[subkey] = blank(value); else delete org[subkey];
      r[prop] = Object.keys(org).length ? org : null; return;
    }
    if (key === 'links') {
      const old = r.documentation_links || [];
      r.documentation_links = [...old.filter(x=>x.purpose === 'terminology'),...value.split('\n').map(x=>x.trim()).filter(Boolean).map(url=>old.find(x=>x.url === url && x.purpose !== 'terminology') || {url,purpose:'documentation'})]; return;
    }
    if (key === 'keyRole') {
      r.is_identifier = value === 'PK';
      const comment = (r.comment || '').replace(/(?:^|\n)Schlüsselrolle: (?:FK|UK)(?=\n|$)/g,'').trim();
      r.comment = [comment,...(['FK','UK'].includes(value) ? ['Schlüsselrolle: '+value] : [])].filter(Boolean).join('\n') || null; return;
    }
    if (['valueType','valueFormat','unit','geometryType','coordinateReferenceSystem'].includes(key)) {
      const spec = {...r.value_specification}, prop = key === 'valueFormat' ? 'format' : key;
      if (blank(value)) spec[prop] = blank(value); else delete spec[prop];
      if (key === 'valueType' && value !== 'geometry') { delete spec.geometryType; delete spec.coordinateReferenceSystem; }
      r.value_specification = Object.keys(spec).length ? spec : null; return;
    }
    r[key] = f.type === 'checkbox' ? value : f.type === 'boolean' ? value === '' ? null : value === 'true'
      : ['lines','urls','keys'].includes(f.type) ? value.split('\n').map(x=>x.trim()).filter(Boolean) : blank(value);
  }
  DK.editSchema = { kinds, children, groups, defaults, read, write, languages, field };
})(window.DK);
