/* Read canonical labels from Markdown. No runtime dependency or schema inference from UI copy. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), source = path.join(root, 'docs/data-model.md');
const snake = value => value.replace(/(?<!^)[A-Z]/g, c => '_' + c).toLowerCase();
const tables = ['Actor','BusinessAttribute','BusinessObject','CatalogState','ChangeEvent','CodeList','CodeValue','DataField','DataProduct','DataService','DataTable','Domain','LineageRelation','ProductAttribute','QualityRequirement','Relationship','System','ServiceEndpoint'];
function read(text = fs.readFileSync(source, 'utf8')) {
  const definitions = {}, projections = {};
  let section;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('### ')) section = line.slice(4);
    if (!line.startsWith('| `')) continue;
    const cells = line.slice(1, -1).split('|').map(v => v.trim());
    if (cells.length === 7 && cells[0].match(/^`[^`]+`$/)) {
      const property = cells[0].slice(1, -1), id = `${section}.${property}`;
      if (definitions[id]) throw new Error('Duplicate canonical field: ' + id);
      if (!cells[1] || !cells[2]) throw new Error('Missing canonical alias: ' + id);
      definitions[id] = { id, entity: section, property, en: cells[1], de: cells[2], description: cells[6] };
    } else if (section === 'Alias contract across surfaces' && cells.length === 4) {
      const property = cells[0].slice(1, -1), id = `Presentation.${property}`;
      definitions[id] = projections[property] = { id, entity: 'Presentation', property, en: cells[1], de: cells[2], description: cells[3] };
    }
  }
  const get = id => { if (!definitions[id]) throw new Error('Unknown canonical alias: ' + id); return definitions[id]; };
  const label = (id, language, selected = false) => {
    const value = get(id)[language];
    return selected ? value.replace(/ \((DE|FR|IT|EN)\)$/, '') : value;
  };
  const byTable = Object.fromEntries(tables.map(entity => [snake(entity), entity]));
  // Shared UI keys require shared wording. A future entity-specific alias needs an explicit split.
  const shared = new Map();
  for (const d of Object.values(definitions).filter(d => tables.includes(d.entity))) {
    const previous = shared.get(d.property);
    if (previous && (previous.en !== d.en || previous.de !== d.de)) throw new Error(`Aliases for ${d.property} diverge between ${previous.entity} and ${d.entity}; split their presentation bindings explicitly`);
    shared.set(d.property, d);
  }
  function column(table, name) {
    const entity = byTable[table];
    const direct = Object.values(definitions).find(d => d.entity === entity && snake(d.property) === name);
    if (direct) return direct;
    const reference = /^(record|source|target)_.+_id$/.exec(name);
    if (reference) return get(`${entity}.${reference[1]}`);
    const junction = /^(business_attribute|data_field)_quality_requirement$/.exec(table);
    if (junction) return get(`${byTable[junction[1]]}.qualityRequirementIds`);
    throw new Error(`Unmapped SQL column: ${table}.${name}`);
  }
  const owned = { responsible_organisation: 'OrganisationDetails', authority_organisation: 'OrganisationDetails', documentation_links: 'DocumentationLink', access_options: 'AccessOption', value_specification: 'ValueSpecification' };
  return { definitions, projections, get, label, column, byTable, owned };
}
module.exports = { read, root, source, snake };
