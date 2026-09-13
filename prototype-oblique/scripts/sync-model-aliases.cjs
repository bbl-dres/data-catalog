/* Regenerate EN/DE labels from the canonical Markdown, preserving maintained FR/IT translations. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { read, root } = require('./model-contract.cjs');
const { bindings, core, extensions } = require('./model-alias-bindings.cjs');
const newTranslations = {
  'print.componentType': {fr:'Type',it:'Tipo'},
  'fact.businessKey': {fr:'Rôle de clé',it:'Ruolo della chiave'},
  'fact.requiredRule': {fr:'Obligatoire',it:'Obbligatorio'},
  'fact.authorityOrganisation': {fr:'Autorité source',it:'Autorità della fonte'},
  'edit.organisationName': {fr:'Nom de l’organisation',it:'Nome dell’organizzazione'},
  'fact.effectiveSystemOfRecord': {fr:'Système de référence effectif',it:'Sistema di riferimento effettivo'},
  'excel.dataService': {fr:'Service de données',it:'Servizio dati'},
  'excel.sourceType': {fr:'Type de source',it:'Tipo di origine'},
  'excel.sourceId': {fr:'ID source',it:'ID origine'},
  'excel.sourceIdentifier': {fr:'Identifiant source',it:'Identificatore origine'},
  'excel.sourceName': {fr:'Nom de la source',it:'Nome dell’origine'},
  'excel.targetName': {fr:'Nom de la cible',it:'Nome della destinazione'}
};
function generate() {
  const model = read(), files = new Map();
  const file = path.join(root, 'data/i18n.json'), original = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const dictionary = JSON.parse(original); let text = original;
  for (const [key, {id, selected}] of Object.entries(bindings)) {
    const value = { ...(dictionary[key] || newTranslations[key]), en: model.label(id, 'en', selected), de: model.label(id, 'de', selected) };
    if (!value.fr || !value.it) throw new Error('Maintain FR/IT translations for ' + key);
    const line = '  ' + JSON.stringify(key) + ': ' + JSON.stringify(value);
    const old = text.split('\n').find(line => line.startsWith('  ' + JSON.stringify(key) + ':'));
    if (old) text = text.replace(old, line + (old.endsWith(',') ? ',' : ''));
    else text = text.replace(/\n}\s*$/, ',\n' + line + '\n}\n');
    dictionary[key] = value;
  }
  JSON.parse(text); files.set(file, text);
  const modelFile = path.join(root, 'data/model.json');
  let modelText = fs.readFileSync(modelFile, 'utf8').replace(/\r\n/g, '\n');
  modelText = modelText.split('\n').map(line => {
    const field = /"field":\s*"([^"]+)"/.exec(line)?.[1], key = core[field];
    if (!key) return line;
    const result = line.replace(/"label":\s*"[^"]*"/, '"label": ' + JSON.stringify(dictionary[key].de));
    return /"labelKey":/.test(result) ? result.replace(/"labelKey":\s*"[^"]*"/, '"labelKey": ' + JSON.stringify(key)) : result.replace(/"label":\s*"[^"]*"/, '$&'+', "labelKey": '+JSON.stringify(key));
  }).join('\n');
  modelText = modelText.replace(/("extensions": \{)([\s\S]*?)(\n  \})/, (_, start, body, end) => start + body.split('\n').map(line => {
    const match = /^(\s*"([^"\n]+)":\s*)(\[.*\])(,?)$/.exec(line);
    if (!match) return line;
    const entries = JSON.parse(match[3]).map(([field, label, previousKey]) => {
      const key = field === 'keyRole' && match[2] === 'fields' ? 'fact.key' : field === 'mandatory' && match[2] === 'attrs' ? 'fact.requiredRule' : extensions[field] || previousKey;
      return key ? [field,dictionary[key].de,key] : [field,label];
    });
    return match[1] + JSON.stringify(entries) + match[4];
  }).join('\n') + end);
  JSON.parse(modelText); files.set(modelFile, modelText);
  return { files, count: Object.keys(bindings).length };
}
async function sqlMigration(filename) {
  const target = path.resolve(root, filename), directory = path.join(root, 'supabase/migrations') + path.sep;
  if (!target.startsWith(directory) || !/^\d{14}_[a-z_]+\.sql$/.test(path.basename(target)) || fs.existsSync(target)) throw new Error('Choose a new timestamped migration under supabase/migrations; applied files are never overwritten');
  const { database } = require('../supabase/local-database.cjs'), db = await database({includeData:false});
  try {
    const columns = (await db.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='catalog' ORDER BY table_name,ordinal_position")).rows;
    const model = read(), quote = text => "'" + text.replaceAll("'", "''") + "'";
    const comments = columns.map(({table_name, column_name}) => {
      const d = model.column(table_name, column_name);
      return `COMMENT ON COLUMN catalog.${table_name}.${column_name} IS ${quote(`${d.en}. ${d.description} Alias (DE): ${d.de}. Canonical: ${d.id}.`)};`;
    });
    fs.writeFileSync(target, '-- Canonical aliases and descriptions from docs/data-model.md. No row, permission or constraint changes.\nBEGIN;\nSET LOCAL search_path = pg_catalog;\nSET LOCAL lock_timeout = \'10s\';\n' + comments.join('\n') + "\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n");
    console.log(`Prepared ${columns.length} canonical column comments in ${path.relative(root,target)}`);
  } finally { await db.close(); }
}
async function main() {
  const args = process.argv.slice(2), check = args.includes('--check');
  if (args[0] === '--migration' && args.length === 2) return sqlMigration(args[1]);
  if (args.some(a=>a!=='--check')) throw new Error('Usage: node scripts/sync-model-aliases.cjs [--check | --migration supabase/migrations/NEW_TIMESTAMP_catalog_aliases.sql]');
  const { files, count } = generate();
  for (const [file, text] of files) {
    if (check) { if (fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n') !== text) throw new Error('Stale canonical labels: '+path.relative(root,file)); }
    else fs.writeFileSync(file,text);
  }
  console.log(`${check?'Verified':'Generated'} ${count} canonical EN/DE label bindings and handbook labels`);
}
if (require.main === module) main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports = { generate };
