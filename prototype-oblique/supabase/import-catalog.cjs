/* One-time, deterministic migration of the reviewed JSON catalog. No network access. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const files = { domains: 'domains', systems: 'systems', objects: 'objects', tables: 'tables', refs: 'codelists', products: 'products', apis: 'apis', changelog: 'changelog' };
const kinds = { domains: 'domain', systems: 'system', objects: 'business_object', tables: 'data_table', refs: 'code_list', products: 'data_product', apis: 'data_service', attrs: 'business_attribute', fields: 'data_field' };
const languages = ['de', 'it', 'fr', 'en'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const uuid = value => {
  const bytes = crypto.createHash('sha1').update('bbl-catalog-json-import-v1\0' + value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// JSON.parse silently overwrites duplicate keys. Reject them before conversion to JSONB.
function parseJson(text, file) {
  let at = 0;
  const whitespace = () => { while (/\s/.test(text[at] || '') && at < text.length) at++; };
  const string = () => {
    const start = at++;
    while (at < text.length) {
      if (text[at++] === '"') return JSON.parse(text.slice(start, at));
      if (text[at - 1] === '\\') at++;
    }
    throw new Error(`${file}: unterminated string`);
  };
  const value = () => {
    whitespace();
    if (text[at] === '{') {
      at++; whitespace(); const keys = new Set();
      while (text[at] !== '}') {
        if (text[at] !== '"') throw new Error(`${file}: expected key at ${at}`);
        const key = string();
        if (keys.has(key)) throw new Error(`${file}: duplicate key ${key}`);
        keys.add(key); whitespace();
        if (text[at++] !== ':') throw new Error(`${file}: expected colon`);
        value(); whitespace();
        if (text[at] !== ',') break;
        at++; whitespace();
      }
      if (text[at++] !== '}') throw new Error(`${file}: expected object end`);
    } else if (text[at] === '[') {
      at++; whitespace();
      while (text[at] !== ']') {
        value(); whitespace(); if (text[at] !== ',') break; at++;
      }
      if (text[at++] !== ']') throw new Error(`${file}: expected array end`);
    } else if (text[at] === '"') string();
    else {
      const match = text.slice(at).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      if (!match) throw new Error(`${file}: invalid value at ${at}`);
      at += match[0].length;
    }
  };
  value(); whitespace();
  if (at !== text.length) throw new Error(`${file}: trailing content`);
  return JSON.parse(text);
}

function build(source) {
  const schema = fs.readFileSync(path.join(__dirname, 'migrations/20260906000000_catalog_schema.sql'), 'utf8');
  const columns = Object.fromEntries([...schema.matchAll(/CREATE TABLE catalog\.(\w+) \(([\s\S]*?)\n\);/g)].map(m => [m[1], [...m[2].matchAll(/^  ([a-z][a-z_]+) /gm)].map(x => x[1])]));
  const records = Object.fromEntries(Object.keys(columns).map(table => [table, []]));
  const manifest = {}, seen = new Set();
  const id = (table, identifier) => uuid(table + ':' + identifier);
  const add = (table, identifier, values) => {
    const key = table + ':' + identifier;
    if (seen.has(key)) throw new Error('Duplicate migration identity: ' + key);
    seen.add(key);
    const row = { id: id(table, identifier), identifier, ...values };
    if (columns[table].includes('row_version')) row.row_version = 1;
    for (const field of Object.keys(row)) if (!columns[table].includes(field)) throw new Error(`${table}: unexpected ${field}`);
    records[table].push(row);
    manifest[key] = row.id;
    return row;
  };
  const reference = (kind, identifier) => {
    if (!identifier) return null;
    if (!source[kind]?.some(e => e.identifier === identifier)) throw new Error(`Unresolved reference ${kind}:${identifier}`);
    return id(kinds[kind], identifier);
  };
  const translated = (base, scalar, labels = {}) => {
    if (scalar && labels.de && scalar !== labels.de) throw new Error(`Conflicting German ${base}: ${scalar} / ${labels.de}`);
    const values = { ...(scalar ? { de: scalar } : {}), ...labels };
    for (const lang of Object.keys(values)) if (!languages.includes(lang)) throw new Error('Unsupported language: ' + lang);
    return Object.fromEntries(Object.entries(values).filter(([, v]) => v != null && v !== '').map(([lang, v]) => [base + '_' + lang, v]));
  };
  const textFields = e => ({ ...translated('name', e.name, e.labels), ...translated('description', e.description), ...(e.comment ? { comment: e.comment } : {}) });
  const links = e => {
    const values = [];
    const addLink = (url, purpose = 'documentation', title, externalIdentifier) => {
      if (!url) return;
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid documentation URL');
      if (values.some(x => x.url === url && x.purpose === purpose)) return;
      values.push({ url, purpose, ...(title ? { title_de: title } : {}), ...(externalIdentifier != null ? { externalIdentifier: String(externalIdentifier) } : {}) });
    };
    addLink(e.descriptionSource?.url, 'documentation', e.descriptionSource?.title);
    for (const url of [...(e.informationUrls || []), e.informationUrl, e.sourceUrl, e.fieldsSourceUrl, e.technicalNameSource, e.documentation, e.wsdlDocumentation]) addLink(url);
    for (const term of e.termdat || []) addLink(term.url, 'terminology', term.name, term.id);
    return values;
  };
  const token = (map, value, fallback = null) => {
    if (value == null || value === '') return fallback;
    if (!Object.hasOwn(map, value)) throw new Error('Unmapped token: ' + value);
    return map[value];
  };
  const status = e => token({ Entwurf: 'draft', Gültig: 'valid', Archiviert: 'retired' }, e.status, 'draft');
  const valueTypes = { Text: 'text', Code: 'code', Datum: 'date', Dezimal: 'decimal', Ganzzahl: 'integer', Geometrie: 'geometry' };
  const organisation = e => e.responsibleOrg ? { name_de: e.responsibleOrg, ...(e.contact?.url ? { websiteUrl: e.contact.url } : {}) } : null;
  const actors = new Map();
  const actor = (value, defaultType) => {
    if (!value) return null;
    const a = typeof value === 'string' ? { name: value, type: defaultType } : value;
    const key = JSON.stringify([a.type, a.name, a.url || null]);
    if (!actors.has(key)) {
      const r = add('actor', 'actor-' + hash(key).slice(0, 20), { name_de: a.name, actor_type: a.type, website_url: a.url || null });
      actors.set(key, r.id);
    }
    return actors.get(key);
  };
  const common = (table, e) => {
    const values = { ...textFields(e), documentation_links: links(e), status: status(e), created_on: e.created || null, modified_on: e.modified || null, version: e.version || null,
      responsible_organisation: organisation(e),
      classification: token({ intern: 'internal', öffentlich: 'public', vertraulich: 'confidential', geheim: 'secret' }, e.classification), contains_personal_data: e.personalData ?? null };
    for (const [key, target, type] of [['dataOwner', 'data_owner_id', 'person'], ['dataSteward', 'data_steward_id', 'person'], ['dataCustodian', 'data_custodian_id', 'organisation']]) {
      if (columns[table].includes(target)) values[target] = actor(e[key], type);
    }
    return Object.fromEntries(Object.entries(values).filter(([key]) => columns[table].includes(key)));
  };
  for (const [kind, table] of Object.entries(kinds).filter(([kind]) => source[kind])) {
    for (const e of source[kind]) {
      const values = common(table, e);
      if (columns[table].includes('domain_id')) values.domain_id = reference('domains', e.domain);
      if (columns[table].includes('system_id')) values.system_id = reference('systems', e.system);
      if (columns[table].includes('normative_references')) values.normative_references = e.normReference ? [e.normReference] : [];
      if (kind === 'systems') values.technology = e.technology || null;
      if (kind === 'tables') values.technical_name = e.technicalName || null;
      if (kind === 'refs') Object.assign(values, { business_object_id: reference('objects', e.businessObject), authority_organisation: organisation(e) });
      if (kind === 'products') Object.assign(values, { access_notes: e.accessRights || null, license_notes: e.license || null,
        formats: e.format ? e.format.split(',').map(s => s.trim()) : [],
        update_frequency: token({ täglich: 'daily', monatlich: 'monthly', jährlich: 'annually', quartalsweise: 'quarterly', 'bei Bedarf': 'onDemand' }, e.accrualPeriodicity) });
      if (kind === 'apis') Object.assign(values, { version: null, service_version: e.version || null, technical_name: e.technicalName || null, access_notes: e.accessRights || null,
        purpose: token({ 'map-image': 'mapImage', 'vector-features': 'featureAccess' }, e.servicePurpose) });
      add(table, e.identifier, values);
    }
  }
  const required = add('quality_requirement', 'required', { name_de: 'Pflichtwert', name_en: 'Required value', description_de: 'Das Attribut muss vorhanden sein. Aus dem bisherigen Pflichtkennzeichen übernommen; keine Aussage zur Zulässigkeit von null.', status: 'draft', rule_type: 'required', dimension: 'completeness' });
  for (const parent of source.objects) for (const a of parent.attributes) {
    const row = add('business_attribute', `${parent.identifier}/${a.identifier}`, { ...textFields(a), status: status(parent), business_object_id: reference('objects', parent.identifier), semantic_name: a.identifier,
      value_specification: a.valueType ? { valueType: token(valueTypes, a.valueType) } : null, is_identifier: a.keyRole === 'PK' ? true : null });
    if (a.mandatory === true) records.business_attribute_quality_requirement.push({ business_attribute_id: row.id, quality_requirement_id: required.id });
  }
  for (const parent of source.tables) for (const f of parent.fields) {
    const local = f.identifier ?? f.technicalName;
    add('data_field', `${parent.identifier}/${local}`, { ...textFields(f), status: status(parent), documentation_links: links(f), data_table_id: reference('tables', parent.identifier),
      technical_name: f.technicalName, technical_name_kind: token({ 'model-attribute': 'modelAttribute', 'api-field': 'apiField', 'datasource-field': 'dataSourceField', 'physical-column': 'physicalColumn' }, f.technicalNameKind, 'unknown'),
      source_data_type: f.dataType || null, data_type_scope: token({ 'model-type': 'modelDefinition', 'service-schema': 'serviceSchema', 'physical-schema': 'physicalSchema' }, f.dataTypeKind, f.dataType ? 'unknown' : null),
      key_roles: f.keyRole ? [token({ PK: 'primary', FK: 'foreign', UK: 'unique' }, f.keyRole)] : null,
      is_required: f.mandatory ?? null, code_list_id: reference('refs', f.codeList), applies_to_type_names: f.appliesToObjectTypes || [] });
  }
  for (const parent of source.refs) for (const v of parent.values) {
    if (typeof v.code !== 'string') throw new Error(`Non-string code: ${parent.identifier}/${v.code}`);
    add('code_value', `${parent.identifier}/${v.code}`, { ...textFields({ name: v.label, labels: v.labels, comment: v.note }), ...translated('short_name', null, v.shortLabels), code_list_id: reference('refs', parent.identifier), code: v.code });
  }
  for (const parent of source.products) for (const a of parent.attributes) {
    const local = 'attribute-' + hash(a.name).slice(0, 20);
    add('product_attribute', `${parent.identifier}/${local}`, { ...textFields(a), data_product_id: reference('products', parent.identifier), semantic_name: local, value_specification: a.valueType ? { valueType: token(valueTypes, a.valueType) } : null });
  }
  for (const service of source.apis) {
    add('service_endpoint', service.identifier + '/primary', { identifier: 'primary', data_service_id: reference('apis', service.identifier), url: service.endpointURL || null, protocol: service.protocol || null,
      relative_path: service.documentedPath || null, operation_name: service.operation || null, http_method: service.httpMethod || null,
      is_read_only: service.readOnly ?? null, supports_bulk: service.bulkSupported ?? null, authentication_methods: (service.authentication || []).map(a => a.method), verification_status: 'notChecked' });
  }
  const relationship = (type, fromKind, from, toKind, to, extra = {}) => {
    const identifier = `${type}:${fromKind}:${from}:${toKind}:${to}`;
    if (seen.has('relationship:' + identifier)) return;
    add('relationship', identifier, { relationship_type: type, [`source_${kinds[fromKind]}_id`]: reference(fromKind, from),
      [`target_${kinds[toKind]}_id`]: toKind === 'fields' ? id('data_field', to) : reference(toKind, to),
      verification_status: 'candidate', ...(['realizes', 'exposes'].includes(type) ? { coverage: 'unknown' } : {}), ...extra });
  };
  for (const table of source.tables) if (table.realizes) relationship('realizes', 'tables', table.identifier, 'objects', table.realizes);
  for (const p of source.products) for (const [type, kind] of [['basedOn', 'objects'], ['sourcedFrom', 'tables'], ['servedBy', 'apis']]) for (const target of p[type]) relationship(type, 'products', p.identifier, kind, target);
  for (const service of source.apis) for (const m of service.documentedFieldMappings || []) {
    const table = source.tables.find(t => t.identifier === m.table);
    const field = table?.fields.find(f => (f.identifier ?? f.technicalName) === m.fieldId);
    if (!field) throw new Error(`Unresolved API mapping: ${service.identifier}/${m.table}/${m.fieldId}`);
    relationship('exposes', 'apis', service.identifier, 'fields', `${m.table}/${m.fieldId}`, {
      source_endpoint_id: id('service_endpoint', service.identifier + '/primary'), assessed_service_version: service.version || null,
      rule_notes_en: `Documented API field ${m.structure}.${m.field}. Physical column mapping is not confirmed.`, documentation_links: links(service) });
  }
  const eventOccurrences = new Map();
  for (const event of source.changelog) {
    const split = event.entity.indexOf(':'), kind = event.entity.slice(0, split), target = event.entity.slice(split + 1);
    const digest = hash(JSON.stringify(event)), occurrence = (eventOccurrences.get(digest) || 0) + 1;
    eventOccurrences.set(digest, occurrence);
    const action = event.action === 'Erstellt' ? 'created' : /importiert|Importiert|Abgeglichen/.test(event.action) ? 'imported' : 'updated';
    add('change_event', `legacy-${digest}-${occurrence}`, { [`record_${kinds[kind]}_id`]: reference(kind, target), occurred_on: event.date, action,
      actor_name_de: event.user || null, summary_de: [event.action, event.detail].filter(Boolean).join(': '), import_id: event.importId || null });
  }
  for (const [table, rows] of Object.entries(records)) for (const row of rows) {
    if (columns[table].includes('documentation_links')) row.documentation_links ||= [];
  }
  return { records, manifest, columns };
}

function sqlLiteral(value) { return "'" + value.replaceAll("'", "''") + "'"; }
function seedSql(records, fingerprint) {
  const lines = ['-- Generated by import-catalog.cjs. Existing catalog data is never overwritten.', 'BEGIN;', "SET LOCAL catalog.import_legacy = 'on';", "SET LOCAL standard_conforming_strings = on;", 'DO $catalog_import$', 'BEGIN', "  PERFORM pg_advisory_xact_lock(18427, 1);",
    `  IF EXISTS (SELECT 1 FROM catalog_private.import_batch WHERE identifier = 'json-catalog-v1' AND fingerprint = '${fingerprint}') THEN RETURN; END IF;`,
    "  IF EXISTS (SELECT 1 FROM catalog_private.import_batch WHERE identifier = 'json-catalog-v1') THEN RAISE EXCEPTION 'Import fingerprint changed; prepare a reviewed incremental migration'; END IF;"];
  for (const table of Object.keys(records)) lines.push(`  IF EXISTS (SELECT 1 FROM catalog.${table}) THEN RAISE EXCEPTION 'Initial import requires an empty catalog (${table})'; END IF;`);
  const order = Object.keys(records).filter(table => table !== 'service_endpoint');
  order.splice(order.indexOf('relationship'), 0, 'service_endpoint');
  for (const table of order) {
    const rows = records[table];
    if (!rows.length) continue;
    const fields = [...new Set(rows.flatMap(Object.keys))];
    const payload = JSON.stringify(rows);
    if (payload.includes('$catalog_import$')) throw new Error('Reserved SQL delimiter in input');
    lines.push(`  INSERT INTO catalog.${table} (${fields.join(', ')})\n  SELECT ${fields.join(', ')} FROM jsonb_populate_recordset(NULL::catalog.${table}, ${sqlLiteral(payload)}::jsonb);`);
  }
  lines.push(`  INSERT INTO catalog_private.import_batch (identifier, fingerprint) VALUES ('json-catalog-v1', '${fingerprint}');`, 'END;', '$catalog_import$;', 'COMMIT;', "NOTIFY pgrst, 'reload schema';", '');
  return lines.join('\n');
}

function generate() {
  const source = {}, hashes = {};
  for (const [kind, file] of Object.entries(files)) {
    const bytes = fs.readFileSync(path.join(root, 'data', file + '.json'));
    hashes[file + '.json'] = hash(bytes);
    source[kind] = parseJson(bytes.toString('utf8'), file);
  }
  const { records, manifest } = build(source);
  const payloadFingerprint = hash(JSON.stringify(records));
  const fingerprint = hash(JSON.stringify({ hashes, payloadFingerprint }));
  const output = { formatVersion: 1, fingerprint, payloadFingerprint, sourceFiles: hashes, counts: Object.fromEntries(Object.entries(records).map(([k, v]) => [k, v.length])), identities: manifest };
  const manifestFile = path.join(__dirname, 'import-manifest.json');
  if (fs.existsSync(manifestFile)) {
    const previous = JSON.parse(fs.readFileSync(manifestFile));
    if (JSON.stringify(previous.sourceFiles) !== JSON.stringify(hashes) || (previous.payloadFingerprint && previous.payloadFingerprint !== payloadFingerprint)) throw new Error('The frozen initial import changed. Create an incremental migration instead of regenerating the baseline.');
  }
  fs.writeFileSync(manifestFile, JSON.stringify(output, null, 2) + '\n');
  const seed = seedSql(records, fingerprint);
  fs.writeFileSync(path.join(__dirname, 'migrations/20260906030000_catalog_import.sql'), seed);
  const publicRead = fs.readFileSync(path.join(__dirname, 'migrations/20260906020000_catalog_public_read.sql'), 'utf8');
  const body = sql => sql.replace(/^BEGIN;\r?\n/m, '').replace(/^COMMIT;\r?\n/m, '').replace(/^NOTIFY pgrst, 'reload schema';\r?\n?/m, '');
  fs.writeFileSync(path.join(__dirname, 'seed.sql'), '-- Paste this entire file into Supabase SQL Editor as postgres.\n-- Prerequisite: the catalog schema and member RLS scripts are already applied.\n-- One transaction; no existing catalog data is overwritten. Run once.\nBEGIN;\n' + body(publicRead) + '\n' + body(seed) + "\nCOMMIT;\nNOTIFY pgrst, 'reload schema';\n");
  console.log(JSON.stringify(output.counts, null, 2));
}
if (require.main === module) generate();
module.exports = { build, parseJson, seedSql, files };
