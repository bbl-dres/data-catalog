/* Generate read and authenticated CRUD contracts from executed SQL. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { database, migrationFiles, root, migrations } = require('./local-database.cjs');
const { read: readModel, source: modelSource } = require('../scripts/model-contract.cjs');

// New exposed tables require an explicit documentation decision.
const tags = {
  domain: 'Domains', system: 'Systems', business_object: 'Business objects', business_attribute: 'Business objects',
  business_attribute_quality_requirement: 'Business objects', data_table: 'Data tables', data_field: 'Data tables', data_field_quality_requirement: 'Data tables',
  code_list: 'Reference data', code_value: 'Reference data', data_product: 'Data products', product_attribute: 'Data products',
  data_service: 'APIs', service_endpoint: 'APIs', actor: 'Governance', quality_requirement: 'Governance',
  relationship: 'Governance', lineage_relation: 'Governance', change_event: 'Governance', catalog_state: 'Governance'
};
const output = path.join(root, 'data/swagger.json');
const ref = name => ({ $ref: '#/components/schemas/' + name });
const param = name => ({ $ref: '#/components/parameters/' + name });

function config() {
  const context = { window: { DK: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/catalog-config.js'), 'utf8'), context);
  return context.window.DK.catalogConfig;
}

function columnSchema(column) {
  const types = {
    uuid: { type: 'string', format: 'uuid' }, text: { type: 'string' }, date: { type: 'string', format: 'date' },
    timestamptz: { type: 'string', format: 'date-time' }, int8: { type: 'integer', format: 'int64' }, int4: { type: 'integer', format: 'int32' },
    numeric: { type: 'number' }, bool: { type: 'boolean' }, jsonb: {}, _text: { type: 'array', items: { type: 'string' } }
  };
  if (!Object.hasOwn(types, column.base_type)) throw new Error(`Unsupported SQL type: ${column.sql_type}`);
  const schema = { ...types[column.base_type], description: column.description || column.name,
    'x-postgresql-type': column.sql_type, 'x-postgresql-not-null': column.not_null };
  if (column.domain === 'safe_integer') Object.assign(schema, { minimum: -9007199254740991, maximum: 9007199254740991 });
  if (['nonempty_text', 'identifier', 'http_url'].includes(column.domain)) schema.minLength = 1;
  if (!column.not_null && schema.type) schema.type = [schema.type, 'null'];
  if (column.default_expression) schema['x-postgresql-default'] = column.default_expression;
  return schema;
}

async function generate(db) {
  const model = readModel();
  const aliases = d => ({ title: d.en, 'x-aliases': { en: d.en, de: d.de }, 'x-canonical-property': d.id });
  const documentedColumn = field => {
    const schema = { ...columnSchema(field), ...aliases(model.column(field.table_name, field.name)) };
    const owned = model.owned[field.name];
    if (owned) {
      const businessSpec = field.table_name === 'business_attribute' && owned === 'ValueSpecification';
      const properties = Object.fromEntries(Object.values(model.definitions).filter(d => d.entity === owned && (!businessSpec || ['valueType','format','unit','geometryType','coordinateReferenceSystem'].includes(d.property)))
        .map(d => [d.property, { ...aliases(d), description: d.description }]));
      if (field.name === 'access_options') {
        for (const [key, property] of Object.entries(properties)) Object.assign(property, key === 'isArchived' ? { type: 'boolean' } : { type: 'string', minLength: 1, pattern: '\\S' });
        Object.assign(properties.id, { format: 'uuid', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' });
        properties.status.enum = ['draft', 'valid', 'retired'];
        properties.accessUrl.format = properties.downloadUrl.format = 'uri';
        schema.type = 'array';
        schema.items = { type: 'object', additionalProperties: false, properties, required: ['id','status','isArchived'],
          anyOf: ['de','fr','it','en'].map(language => ({ required: ['name_' + language] })),
          allOf: [{ if: { properties: { status: { const: 'valid' } }, required: ['status'] }, then: { anyOf: ['accessUrl','downloadUrl','accessNotes'].map(key => ({ required: [key] })) } }] };
      }
      else if (field.name === 'documentation_links') schema.items = { properties };
      else schema.properties = properties;
    }
    return schema;
  };
  const tables = (await db.query(`SELECT c.relname AS name, obj_description(c.oid) AS description
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='catalog' AND c.relkind='r' AND has_table_privilege('anon', c.oid, 'SELECT') ORDER BY c.relname`)).rows;
  if (tables.length !== Object.keys(tags).length || tables.some(table => !Object.hasOwn(tags, table.name))) throw new Error('Public table inventory changed; review the documented table allowlist');
  const columns = (await db.query(`SELECT c.relname AS table_name, a.attname AS name, a.attnotnull AS not_null,
    format_type(a.atttypid, a.atttypmod) AS sql_type, coalesce(bt.typname,t.typname) AS base_type,
    CASE WHEN t.typtype='d' THEN t.typname END AS domain, col_description(c.oid,a.attnum) AS description,
    pg_get_expr(d.adbin,d.adrelid) AS default_expression
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_type t ON t.oid=a.atttypid LEFT JOIN pg_type bt ON bt.oid=t.typbasetype
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='catalog' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`)).rows;
  // Nullability is already represented by column schemas/required; omit version-specific named NOT NULL constraints.
  const constraints = (await db.query(`SELECT c.relname AS table_name, k.contype AS type, k.conname AS name,
    pg_get_constraintdef(k.oid) AS definition,
    ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY AS key(num,idx) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=key.num ORDER BY key.idx) AS columns,
    target.relname AS target_table,
    ARRAY(SELECT a.attname FROM unnest(k.confkey) WITH ORDINALITY AS key(num,idx) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=key.num ORDER BY key.idx) AS target_columns
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_class target ON target.oid=k.confrelid WHERE n.nspname='catalog' AND k.contype <> 'n' ORDER BY c.relname,k.conname`)).rows;
  const rpc = (await db.query(`SELECT p.proname, p.provolatile, p.prosecdef, p.pronargs, p.prorettype::regtype::text AS result,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS executable FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='catalog' AND p.proname IN ('read_snapshot','read_history','read_catalog_index','read_record')`)).rows;
  if (rpc.map(r=>`${r.proname}/${r.pronargs}`).sort().join() !== 'read_catalog_index/1,read_history/3,read_record/3,read_snapshot/0,read_snapshot/2'
    || rpc.some(r=>r.provolatile !== 's' || r.prosecdef || r.result !== 'jsonb' || !r.executable)) throw new Error('Read RPC contract changed');

  const sourceFiles = migrationFiles().filter(file => !file.endsWith('_catalog_import.sql'));
  const sources = sourceFiles.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(migrations, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex') }));
  const schemas = {}, paths = {};
  const query = (name, description, schema, example) => ({ name, in: 'query', description, required: false, schema, ...(example === undefined ? {} : { example }) });
  const parameters = {
    AcceptProfile: { name: 'Accept-Profile', in: 'header', required: true, description: 'Select the catalog schema for GET requests.', schema: { type: 'string', enum: ['catalog'], default: 'catalog' } },
    ContentProfile: { name: 'Content-Profile', in: 'header', required: true, description: 'Select the catalog schema for the snapshot POST request.', schema: { type: 'string', enum: ['catalog'], default: 'catalog' } },
    Select: query('select', 'Columns to return, optionally with PostgREST aliases or related-resource embedding. Omit for all columns. Projection changes the response shape shown below.', { type: 'string' }, '*'),
    Order: query('order', 'Comma-separated column ordering, e.g. name_de.asc,id.asc. Include a unique key for stable pagination.', { type: 'string' }),
    Limit: query('limit', 'Maximum rows to return. Set a small value when exploring; the project also enforces a maximum response size.', { type: 'integer', minimum: 0 }, 20),
    Offset: query('offset', 'Rows to skip. Use with a stable order when paging.', { type: 'integer', minimum: 0 }, 0),
    Or: query('or', 'PostgREST OR expression, e.g. (name_de.ilike.*Haus*,name_en.ilike.*house*).', { type: 'string' }),
    Prefer: { name: 'Prefer', in: 'header', required: false, description: 'Request a total in Content-Range. Exact counts can cost more on large tables.', schema: { type: 'string', enum: ['count=exact', 'count=planned', 'count=estimated'] } }
  };
  schemas.ApiError = { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {}, hint: {} } };
  const errors = { default: { description: 'Gateway or PostgREST error; inspect the HTTP status and response message.', content: { 'application/json': { schema: ref('ApiError') } } } };
  for (const table of tables) {
    const fields = columns.filter(column => column.table_name === table.name), rules = constraints.filter(rule => rule.table_name === table.name);
    schemas[table.name] = {
      type: 'object', description: table.description || `Catalog ${table.name} record. SQL checks and triggers enforce additional rules; x-postgresql annotations are descriptive, not JSON Schema validation rules.`,
      properties: Object.fromEntries(fields.map(field => [field.name, documentedColumn(field)])),
      'x-postgresql-primary-key': rules.find(rule => rule.type === 'p')?.columns || [],
      'x-postgresql-foreign-keys': rules.filter(rule => rule.type === 'f').map(rule => ({ columns: rule.columns, table: rule.target_table, referencedColumns: rule.target_columns })),
      'x-postgresql-constraints': rules.map(rule => ({ name: rule.name, definition: rule.definition }))
    };
    const response = { description: 'Array of catalog records. Selected columns and embedded resources can change its shape.', headers: { 'Content-Range': { description: 'Returned row range and requested total (or *).', schema: { type: 'string' } } }, content: { 'application/json': { schema: { type: 'array', items: ref(table.name) } } } };
    paths['/' + table.name] = { get: { security: [],
      tags: [tags[table.name]], operationId: 'list_' + table.name, summary: `Read ${table.name}`,
      description: `${table.description || 'Read public catalog metadata.'} Column filters use PostgREST operator prefixes such as eq., ilike., in. or is.null; multiple filters combine with AND.`,
      parameters: [param('PublishableKey'), param('AcceptProfile'), ...['Select', 'Order', 'Limit', 'Offset', 'Or', 'Prefer'].map(param), ...fields.map(field => query(field.name, `Filter ${field.name}: operator.value (for example eq.value or is.null). ${field.description || ''}`, { type: 'string' }))],
      responses: { '200': response, '206': response, ...errors }
    } };
  }
  schemas.SnapshotQualityRequirement = { ...schemas.quality_requirement, properties: { ...schemas.quality_requirement.properties,
    comparison_value: { ...schemas.quality_requirement.properties.comparison_value, type: ['string', 'null'], description: 'Exact numeric comparison value serialized as a decimal string by read_snapshot().' } } };
  const snapshotTables = tables.filter(table => table.name !== 'catalog_state');
  schemas.CatalogSnapshot = { type: 'object', description: 'Legacy catalog collections. change_event is present unless include_history=false. CatalogState is exposed separately.', required: ['schemaVersion', ...snapshotTables.filter(table => table.name !== 'change_event').map(table => table.name)], properties: {
    schemaVersion: { type: 'integer', const: 1 }, ...Object.fromEntries(snapshotTables.map(table => [table.name, { type: 'array', items: ref(table.name === 'quality_requirement' ? 'SnapshotQualityRequirement' : table.name) }]))
  } };
  schemas.HistoryEvent = { type: 'object', description: 'One change event as returned by read_history: the change_event record without its before/after states.',
    properties: Object.fromEntries(Object.entries(schemas.change_event.properties).filter(([name]) => !['before', 'after'].includes(name))) };
  paths['/rpc/read_snapshot'] = { post: { security: [],
    tags: ['Snapshot'], operationId: 'read_snapshot', summary: 'Read a consistent catalog snapshot',
    description: 'Read-only SQL STABLE function for complete catalog exports and legacy clients. Pass include_api_fields=true for independent API fields; include_history=false omits change_event. The app starts with read_catalog_index and loads profiles through read_record. An empty request preserves the table-field-only legacy snapshot. No records are modified; table pagination parameters do not apply.',
    parameters: [param('PublishableKey'), param('ContentProfile')], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { include_api_fields: { type: 'boolean', default: false }, include_history: { type: 'boolean', default: true, description: 'false omits change_event. Only accepted together with include_api_fields.' } }, additionalProperties: false }, example: { include_api_fields: true, include_history: false } } } },
    responses: { '200': { description: 'One snapshot object; numeric quality thresholds are exact decimal strings.', content: { 'application/json': { schema: ref('CatalogSnapshot') } } }, ...errors }
  } };
  paths['/rpc/read_history'] = { post: { security: [],
    tags: ['Governance'], operationId: 'read_history', summary: 'Read one record’s history',
    description: 'Read-only SQL STABLE function. Returns the change events of one owning record and of its owned attributes, fields or values, newest first and without before/after states, under the caller’s RLS permissions. Complete events remain readable through the change_event collection.',
    parameters: [param('PublishableKey'), param('ContentProfile')], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['record_table', 'record_id'], properties: {
      record_table: { type: 'string', enum: ['domain', 'system', 'business_object', 'data_table', 'code_list', 'data_product', 'data_service'], description: 'Owning table of the record.' },
      record_id: { type: 'string', format: 'uuid', description: 'Internal UUID of the owning record.' },
      max_events: { type: 'integer', minimum: 1, maximum: 5000, default: 1000, description: 'Newest events to return.' } }, additionalProperties: false },
      example: { record_table: 'business_object', record_id: '00000000-0000-0000-0000-000000000000' } } } },
    responses: { '200': { description: 'History events, newest first.', content: { 'application/json': { schema: { type: 'array', items: ref('HistoryEvent') } } } }, ...errors }
  } };
  const revision = { type: 'string', pattern: '^[1-9][0-9]*$', description: 'Exact bigint revision encoded as decimal text.' };
  const versionProperties = { schemaVersion: { type: 'integer', const: 1 }, catalogVersion: revision };
  schemas.CatalogNotModified = { type: 'object', required: ['schemaVersion','catalogVersion','notModified'],
    properties: { ...versionProperties, notModified: { const: true } } };
  const parentTables = ['actor','domain','system','business_object','data_table','code_list','data_product','data_service','service_endpoint','quality_requirement'];
  const structural = { ...schemas.relationship,
    properties: Object.fromEntries(Object.entries(schemas.relationship.properties).filter(([key]) => !['comment','rule_notes_de','rule_notes_fr','rule_notes_it','rule_notes_en','documentation_links'].includes(key))) };
  schemas.CatalogIndex = { type: 'object', required: ['schemaVersion','catalogVersion','scope','childCounts','relationship',...parentTables],
    properties: { ...versionProperties, scope: { const: 'index' }, childCounts: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } },
      relationship: { type: 'array', items: structural }, ...Object.fromEntries(parentTables.map(table => [table, schemas.CatalogSnapshot.properties[table]])) } };
  schemas.CatalogCounterpart = { type: 'object', required: ['id','identifier','_counterpart'], description: 'Minimal child for relationship labels. Its owner inventory must be loaded before editing or showing the child profile.',
    properties: { _counterpart: { const: true }, id: { type: 'string', format: 'uuid' }, identifier: { type: 'string' },
      ...Object.fromEntries(['name_de','name_fr','name_it','name_en','status','technical_name'].map(key => [key, { type: ['string','null'] }])),
      is_archived: { type: 'boolean' }, ...Object.fromEntries(['business_object_id','data_table_id','data_service_id','code_list_id','data_product_id'].map(key => [key, { type: ['string','null'], format: 'uuid' }])) } };
  const ownerSchema = { type: 'string', enum: ['domain','system','business_object','data_table','code_list','data_product','data_service'] };
  schemas.CatalogRecord = { type: 'object', required: ['schemaVersion','catalogVersion','scope','recordTable','recordId','inheritedAttributes'],
    properties: { ...versionProperties, scope: { const: 'record' }, recordTable: ownerSchema, recordId: { type: 'string', format: 'uuid' },
      inheritedAttributes: { type: 'object', description: 'Inherited attribute UUID to defining business object UUID.', additionalProperties: { type: 'string', format: 'uuid' } },
      ...Object.fromEntries(snapshotTables.filter(t => t.name !== 'change_event').map(({ name }) => [name, { type: 'array', items:
        ['business_attribute','data_field','code_value','product_attribute'].includes(name) ? { anyOf: [ref(name),ref('CatalogCounterpart')] } : ref(name) }])) } };
  for (const [rpcName, responseSchema, properties, required] of [
    ['read_catalog_index','CatalogIndex',{ if_version: revision },[]],
    ['read_record','CatalogRecord',{ record_table: ownerSchema, record_id: { type: 'string', format: 'uuid' }, if_version: revision },['record_table','record_id']]
  ]) paths['/rpc/' + rpcName] = { post: { security: [], tags: ['Snapshot'], operationId: rpcName,
    summary: rpcName === 'read_catalog_index' ? 'Read the catalog index' : 'Read one profile bundle',
    description: 'Public STABLE SECURITY INVOKER read. Revalidate a cached response with if_version; an unchanged catalog returns CatalogNotModified. Merge bundles only with an index at the same revision. The index contains parents/counts; bundles include archived owned rows, inherited attributes, evidence and minimal counterpart children. No catalog content is modified.',
    parameters: [param('PublishableKey'),param('ContentProfile')],
    requestBody: { required: required.length > 0, content: { 'application/json': { schema: { type: 'object', properties, required, additionalProperties: false } } } },
    responses: { '200': { description: 'Versioned content or an unchanged revision.', content: { 'application/json': { schema: { oneOf: [ref(responseSchema),ref('CatalogNotModified')] } } } }, ...errors } } };
  parameters.PublishableKey = {name:'apikey',in:'header',required:true,description:'Public project key, not a user credential. This page supplies it automatically; no login or user token is required.',schema:{type:'string',pattern:'^sb_publishable_'}};
  const restServer = [{url:new URL('/functions/v1/catalog-api',config().url).href,description:'Catalog REST API'}];
  parameters.RecordId = {name:'id',in:'path',required:true,description:'Internal UUID returned by the read/create operation.',schema:{type:'string',format:'uuid'}};
  parameters.IfMatch = {name:'If-Match',in:'header',required:true,description:'Quoted current row_version, for example "3". A stale revision returns 412; read and reconcile before issuing a new command.',schema:{type:'string',pattern:'^"[1-9][0-9]*"$'},example:'"1"'};
  parameters.IdempotencyKey = {name:'Idempotency-Key',in:'header',required:true,description:'A new UUID for each write. Retry an uncertain request with the same key, body and revision. A key cannot be reused for a different command.',schema:{type:'string',format:'uuid'}};
  for(const table of tables){
    const {rows:[editable]}=await db.query('SELECT catalog_private.api_columns($1,true) AS create, catalog_private.api_columns($1,false) AS update',[table.name]);
    if(!editable.create.length)continue;
    const fields=columns.filter(column=>column.table_name===table.name);
    const schemaName=table.name+'WriteResult';
    const quality=editable.update.includes('quality_requirement_ids') ? {quality_requirement_ids:{...aliases(model.get(model.byTable[table.name]+'.qualityRequirementIds')),type:'array',items:{type:'string',format:'uuid'},uniqueItems:true,maxItems:2000,description:'Complete set of assigned quality requirement UUIDs. Updating this array atomically replaces the owned collection; rule records and history are retained.'}} : {};
    schemas[schemaName]={...schemas[table.name],properties:{...schemas[table.name].properties,...quality}};
    for(const mode of ['create','update']){
      const properties=Object.fromEntries(editable[mode].map(key=>[key,quality[key] || schemas[table.name].properties[key]]));
      for(const field of fields.filter(f=>f.base_type==='numeric'&&properties[f.name]))properties[field.name]={...properties[field.name],type:field.not_null?['number','string']:['number','string','null'],description:properties[field.name].description+' Send a decimal string to preserve exact precision.'};
      const required=mode==='create'?fields.filter(f=>editable.create.includes(f.name)&&f.not_null&&!f.default_expression&&!['id','identifier'].includes(f.name)).map(f=>f.name):[];
      schemas[table.name+'_'+mode]={type:'object',additionalProperties:false,properties,...(required.length?{required}:{})};
      if(mode==='create'&&properties.name_de)schemas[table.name+'_'+mode].anyOf=['de','fr','it','en'].map(lang=>({required:['name_'+lang],properties:{['name_'+lang]:{type:'string',minLength:1}}}));
    }
    const singleResponse={description:'Catalog record, including its current row_version and archival flag.',headers:{ETag:{description:'Quoted current row_version for If-Match.',schema:{type:'string'}}},content:{'application/json':{schema:ref(schemaName)}}};
    const writeBase={tags:[tags[table.name]],servers:restServer,'x-catalog-write':true,security:[{BearerAuth:[]}],responses:{'200':singleResponse,'401':{description:'Missing, invalid or expired app token.'},'403':{description:'Not a permanent app user or a managed/immutable property was supplied.'},'409':{description:'Duplicate identity or unique value.'},'412':{description:'Stale revision; the write was not applied.'},'422':{description:'Model validation failed; nothing was committed.'},'428':{description:'If-Match revision is required.'},...errors}};
    paths['/'+table.name].post={...writeBase,operationId:'create_'+table.name,summary:'Create '+table.name,description:'Create one record. ID and identifier are assigned if omitted. All writes are atomic and audited. No Supabase dashboard account is needed.',parameters:[param('IdempotencyKey')],requestBody:{required:true,content:{'application/json':{schema:ref(table.name+'_create')}}},responses:{...writeBase.responses,'200':undefined,'201':{...singleResponse,headers:{...singleResponse.headers,Location:{description:'Created resource path.',schema:{type:'string'}}}}}};
    delete paths['/'+table.name].post.responses['200'];
    paths['/'+table.name+'/{id}']={
      get:{tags:[tags[table.name]],servers:restServer,security:[],operationId:'get_'+table.name,summary:'Read one '+table.name,description:'Returns the record and its revision, including archived records so they can be restored. Quality assignments are included on attributes and fields.',parameters:[param('RecordId')],responses:{'200':singleResponse,'404':{description:'Record not found.'},...errors}},
      patch:{...writeBase,operationId:'update_'+table.name,summary:'Update '+table.name,description:'Change only supplied properties. IDs, owning parents and assertion endpoints are immutable. Use is_archived: false to restore an archived record. Keep the same Idempotency-Key only when retrying the same command.',parameters:[param('RecordId'),param('IfMatch'),param('IdempotencyKey')],requestBody:{required:true,content:{'application/json':{schema:ref(table.name+'_update')}}}},
      delete:{...writeBase,operationId:'archive_'+table.name,summary:'Archive '+table.name,description:'Soft deletion: sets is_archived to true, retaining identity, references and audit history. No cascade or physical deletion. Reads can still return this record; filter is_archived=eq.false for active records.',parameters:[param('RecordId'),param('IfMatch'),param('IdempotencyKey')]}
    };
  }
  return { openapi: '3.1.0', info: {
    title: 'BBL Catalog API', version: '2.0.0',
    description: 'Browse the catalog. Sign in to create, edit or archive entries.',
  }, servers: [{ url: new URL('/rest/v1', config().url).href, description: 'Supabase catalog Data API' }],
  tags: [...new Set(Object.values(tags)), 'Snapshot'].map(name => ({ name })), security: [],
  paths, components: { securitySchemes: { BearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT',description:'Current app access token from Account. Never enter a refresh token, database password, secret key or service-role key.'} }, parameters, schemas },
  'x-generated-from': { generator: 'supabase/generate-openapi.cjs', canonicalModel: { file:'docs/data-model.md', sha256:createHash('sha256').update(fs.readFileSync(modelSource,'utf8').replace(/\r\n/g,'\n')).digest('hex') }, schema: 'catalog', readRole: 'anon', writeRole:'authenticated', snapshotSchemaVersion: 1, migrations: sources }
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node supabase/generate-openapi.cjs [--check]');
  const db = await database({ includeData: false });
  try {
    const spec = await generate(db), text = JSON.stringify(spec, null, 2) + '\n';
    if (args.includes('--check')) {
      if (fs.readFileSync(output, 'utf8').replace(/\r\n/g, '\n') !== text) throw new Error('OpenAPI file is stale; run the generator and review its diff');
    } else fs.writeFileSync(output, text);
    console.log(`${args.includes('--check') ? 'Verified' : 'Generated'} ${Object.keys(spec.paths).length} API paths and ${Object.keys(tags).length} table schemas`);
  } finally { await db.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { generate, config, output };
