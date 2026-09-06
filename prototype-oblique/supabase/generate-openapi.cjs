/* Generate the public read contract from executed SQL, without hosted administrator access. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { database, migrationFiles, root, migrations } = require('./local-database.cjs');

// New exposed tables require an explicit documentation decision.
const tags = {
  domain: 'Domains', system: 'Systems', business_object: 'Business objects', business_attribute: 'Business objects',
  business_attribute_quality_requirement: 'Business objects', data_table: 'Data tables', data_field: 'Data tables', data_field_quality_requirement: 'Data tables',
  code_list: 'Reference data', code_value: 'Reference data', data_product: 'Data products', product_attribute: 'Data products',
  data_service: 'APIs', service_endpoint: 'APIs', actor: 'Governance', quality_requirement: 'Governance',
  relationship: 'Governance', lineage_relation: 'Governance', change_event: 'Governance'
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
  const constraints = (await db.query(`SELECT c.relname AS table_name, k.contype AS type, k.conname AS name,
    pg_get_constraintdef(k.oid) AS definition,
    ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY AS key(num,idx) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=key.num ORDER BY key.idx) AS columns,
    target.relname AS target_table,
    ARRAY(SELECT a.attname FROM unnest(k.confkey) WITH ORDINALITY AS key(num,idx) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=key.num ORDER BY key.idx) AS target_columns
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_class target ON target.oid=k.confrelid WHERE n.nspname='catalog' ORDER BY c.relname,k.conname`)).rows;
  const rpc = (await db.query(`SELECT p.provolatile, p.prosecdef, p.pronargs, p.prorettype::regtype::text AS result,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS executable FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='catalog' AND p.proname='read_snapshot'`)).rows;
  if (rpc.length !== 1 || rpc[0].provolatile !== 's' || rpc[0].prosecdef || rpc[0].pronargs || rpc[0].result !== 'jsonb' || !rpc[0].executable) throw new Error('Snapshot RPC contract changed');

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
      properties: Object.fromEntries(fields.map(field => [field.name, columnSchema(field)])),
      'x-postgresql-primary-key': rules.find(rule => rule.type === 'p')?.columns || [],
      'x-postgresql-foreign-keys': rules.filter(rule => rule.type === 'f').map(rule => ({ columns: rule.columns, table: rule.target_table, referencedColumns: rule.target_columns })),
      'x-postgresql-constraints': rules.map(rule => ({ name: rule.name, definition: rule.definition }))
    };
    const response = { description: 'Array of catalog records. Selected columns and embedded resources can change its shape.', headers: { 'Content-Range': { description: 'Returned row range and requested total (or *).', schema: { type: 'string' } } }, content: { 'application/json': { schema: { type: 'array', items: ref(table.name) } } } };
    paths['/' + table.name] = { get: {
      tags: [tags[table.name]], operationId: 'list_' + table.name, summary: `Read ${table.name}`,
      description: `${table.description || 'Read public catalog metadata.'} Column filters use PostgREST operator prefixes such as eq., ilike., in. or is.null; multiple filters combine with AND.`,
      parameters: [param('AcceptProfile'), ...['Select', 'Order', 'Limit', 'Offset', 'Or', 'Prefer'].map(param), ...fields.map(field => query(field.name, `Filter ${field.name}: operator.value (for example eq.value or is.null). ${field.description || ''}`, { type: 'string' }))],
      responses: { '200': response, '206': response, ...errors }
    } };
  }
  schemas.SnapshotQualityRequirement = { ...schemas.quality_requirement, properties: { ...schemas.quality_requirement.properties,
    comparison_value: { type: ['string', 'null'], description: 'Exact numeric comparison value serialized as a decimal string by read_snapshot().' } } };
  schemas.CatalogSnapshot = { type: 'object', required: ['schemaVersion', ...tables.map(table => table.name)], properties: {
    schemaVersion: { type: 'integer', const: 1 }, ...Object.fromEntries(tables.map(table => [table.name, { type: 'array', items: ref(table.name === 'quality_requirement' ? 'SnapshotQualityRequirement' : table.name) }]))
  } };
  paths['/rpc/read_snapshot'] = { post: {
    tags: ['Snapshot'], operationId: 'read_snapshot', summary: 'Read a consistent catalog snapshot',
    description: 'Read-only SQL STABLE function used by the prototype. Returns all catalog collections in one statement under the caller’s RLS permissions. It accepts no arguments and does not modify records. Table pagination parameters do not apply; prefer individual table reads for integrations needing a subset.',
    parameters: [param('ContentProfile')], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', additionalProperties: false }, example: {} } } },
    responses: { '200': { description: 'One snapshot object; numeric quality thresholds are exact decimal strings.', content: { 'application/json': { schema: ref('CatalogSnapshot') } } }, ...errors }
  } };
  return { openapi: '3.1.0', info: {
    title: 'BBL Catalog API', version: '1.0.0',
    description: 'Public, read-only catalog metadata served by Supabase PostgREST. This API describes catalog records, not access to the underlying business data. Use the publishable key in the apikey header and select the catalog schema. Names and descriptions retain their _de, _fr, _it and _en columns; no automatic translation fallback is applied. Search and Excel/PDF export in the app run in the browser and are not REST endpoints. This specification is generated from the repository SQL migrations; regenerate after schema changes. No login is required for current public reads.',
  }, servers: [{ url: new URL('/rest/v1', config().url).href, description: 'Supabase catalog Data API' }],
  tags: [...new Set(Object.values(tags)), 'Snapshot'].map(name => ({ name })), security: [{ PublishableKey: [] }],
  paths, components: { securitySchemes: { PublishableKey: { type: 'apiKey', in: 'header', name: 'apikey', description: 'Supabase publishable key (sb_publishable_…). The app supplies its configured public key. Do not enter a secret or service-role key.' } }, parameters, schemas },
  'x-generated-from': { generator: 'supabase/generate-openapi.cjs', schema: 'catalog', role: 'anon', snapshotSchemaVersion: 1, migrations: sources }
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
    console.log(`${args.includes('--check') ? 'Verified' : 'Generated'} ${Object.keys(spec.paths).length} public paths and ${Object.keys(tags).length} table schemas`);
  } finally { await db.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { generate, config, output };
