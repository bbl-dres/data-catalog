/* Execute the actual migration in an isolated PostgreSQL engine; no hosted credentials. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260906000000_catalog_schema.sql'), 'utf8');
const model = fs.readFileSync(path.join(__dirname, '../docs/data-model.md'), 'utf8');
const snake = value => value.replace(/(?<!^)[A-Z]/g, letter => '_' + letter).toLowerCase();
const id = number => `'00000000-0000-0000-0000-${String(number).padStart(12, '0')}'`;

async function main() {
  const db = new PGlite();
  let passed = 0;
  const run = async (label, sql) => {
    try { await db.exec(sql); passed++; }
    catch (error) { throw new Error(label + ': ' + error.message, { cause: error }); }
  };
  const reject = async (label, sql, code = '23514') => {
    await assert.rejects(db.exec(sql), error => {
      assert.ok([].concat(code).includes(error.code), label + ': ' + error.message + ' [' + error.code + ']');
      return true;
    }, label);
    passed++;
  };
  const check = async (label, sql, expected) => {
    const result = await db.query(sql);
    assert.deepEqual(result.rows, expected, label);
    passed++;
  };
  try {
    // Model Supabase's database roles/default grants, not its Auth or REST services.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
    await run('fresh migration', migration);
    await check('19 physical tables', "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='catalog'", [{ count: 19 }]);
    await check('RLS enabled on every table', "SELECT bool_and(relrowsecurity) AS enabled FROM pg_class WHERE relnamespace='catalog'::regnamespace AND relkind='r'", [{ enabled: true }]);

    const actual = (await db.query("SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema='catalog'")).rows;
    let section;
    let dictionaries = 0;
    const owned = new Set(['LocalizedTextFields', 'RecordReference', 'OrganisationDetails', 'DocumentationLink', 'ValueSpecification']);
    for (const line of model.split('\n')) {
      if (line.startsWith('### ')) section = line.slice(4).trim();
      if (!line.startsWith('| `') || owned.has(section)) continue;
      const cells = line.trim().slice(1, -1).split('|').map(cell => cell.trim());
      if (cells.length !== 6) continue;
      const property = cells[0].replaceAll('`', '');
      if (property === 'id') dictionaries++;
      const table = snake(section);
      if (['source', 'target', 'record'].includes(property)) {
        assert.ok(actual.some(c => c.table_name === table && c.column_name.startsWith(property + '_')), section + '.' + property);
      } else if (property === 'qualityRequirementIds') {
        assert.ok(actual.some(c => c.table_name === table + '_quality_requirement'));
      } else if (property === 'endpoints') {
        assert.ok(actual.some(c => c.table_name === 'service_endpoint' && c.column_name === 'data_service_id'));
      } else {
        const column = actual.find(c => c.table_name === table && c.column_name === snake(property));
        assert.ok(column, section + '.' + property);
        if (cells[4] === '1') assert.equal(column.is_nullable, 'NO', section + '.' + property + ' required');
      }
    }
    assert.equal(dictionaries, 16);
    passed++;

    await run('four languages and organisation-only responsibility', `
      INSERT INTO catalog.actor(id,identifier,name_en,actor_type) VALUES (${id(1)},'editor','Editor','person');
      INSERT INTO catalog.domain(id,identifier,name_it) VALUES (${id(10)},'construction','Costruzione');
      INSERT INTO catalog.domain(id,identifier,name_fr,parent_domain_id) VALUES (${id(11)},'buildings','Bâtiments',${id(10)});
      INSERT INTO catalog.system(id,identifier,name_de) VALUES (${id(20)},'gwr','GWR');
      INSERT INTO catalog.business_object(id,identifier,name_de,domain_id,responsible_organisation)
        VALUES (${id(30)},'building','Gebäude',${id(10)},'{"name_de":"Bundesamt für Statistik","websiteUrl":"https://www.bfs.admin.ch/"}');
      INSERT INTO catalog.code_list(id,identifier,name_en) VALUES (${id(40)},'building-status','Building status'), (${id(41)},'other','Other');
      INSERT INTO catalog.code_value(id,identifier,name_en,code_list_id,code) VALUES
        (${id(42)},'status-01','Existing',${id(40)},'01'), (${id(43)},'status-1','Other',${id(40)},'1'),
        (${id(44)},'child','Child',${id(40)},'01.a');
      INSERT INTO catalog.data_table(id,identifier,name_de,system_id,technical_name) VALUES
        (${id(50)},'gwr-building','Gebäude',${id(20)},'GWR_GEBAEUDE'), (${id(51)},'sap-building','Gebäude',${id(20)},NULL);
      INSERT INTO catalog.data_field(id,identifier,name_en,data_table_id,technical_name,technical_name_kind) VALUES
        (${id(60)},'gwr-building-egid','EGID',${id(50)},'EGID','physicalColumn'),
        (${id(61)},'sap-building-egid','EGID',${id(51)},'EGID','unknown');
      INSERT INTO catalog.business_attribute(id,identifier,name_en,business_object_id,semantic_name,value_specification) VALUES
        (${id(70)},'building-height','Height',${id(30)},'height','{"valueType":"decimal","unit":"m"}'),
        (${id(71)},'building-name','Name',${id(30)},'name','{"valueType":"text"}'),
        (${id(72)},'building-other','Other',${id(30)},'other',NULL);
      INSERT INTO catalog.quality_requirement(id,identifier,name_en,rule_type,comparison_value,dimension) VALUES
        (${id(80)},'positive','Greater than zero','greaterThan',0,'validity'),
        (${id(81)},'mandatory','Required','required',NULL,'completeness');
      INSERT INTO catalog.data_product(id,identifier,name_en) VALUES (${id(90)},'report','Report');
      INSERT INTO catalog.product_attribute(id,identifier,name_en,data_product_id,semantic_name) VALUES (${id(91)},'report-height','Height',${id(90)},'height');
      INSERT INTO catalog.data_service(id,identifier,name_en,service_version) VALUES (${id(100)},'gwr-api','GWR API','5.0'),(${id(101)},'other-api','Other API',NULL);
      INSERT INTO catalog.service_endpoint(id,identifier,data_service_id,relative_path) VALUES
        (${id(110)},'detail',${id(100)},'/building/{id}'), (${id(111)},'detail',${id(101)},'/building/{id}');
    `);
    await reject('blank name', `INSERT INTO catalog.domain(identifier,name_en) VALUES ('blank',E' \n\t ')`);
    await reject('all names missing', "INSERT INTO catalog.domain(identifier) VALUES ('unnamed')");
    await reject('trim identifier', "INSERT INTO catalog.domain(identifier,name_en) VALUES (' padded','Name')");
    await reject('unknown status', "INSERT INTO catalog.domain(identifier,name_en,status) VALUES ('status','Name','approved')");
    await reject('valid domain needs a definition', `UPDATE catalog.domain SET status='valid' WHERE id=${id(10)}`);
    await run('valid definition in one language', `UPDATE catalog.domain SET status='valid',description_fr='Définition' WHERE id=${id(10)}`);
    await reject('valid business attribute needs a value type', `UPDATE catalog.business_attribute SET status='valid',description_en='Meaning' WHERE id=${id(72)}`);
    await reject('date ordering', `UPDATE catalog.domain SET created_on='2026-09-06',modified_on='2026-09-05' WHERE id=${id(10)}`);
    await reject('infinite dates', `UPDATE catalog.domain SET created_on='infinity' WHERE id=${id(10)}`);
    await reject('safe integer bounds', `INSERT INTO catalog.domain(identifier,name_en,row_version) VALUES ('revision','Name',9007199254740992)`);
    await reject('positive revision', "INSERT INTO catalog.domain(identifier,name_en,row_version) VALUES ('revision','Name',0)");
    await reject('missing domain reference', `INSERT INTO catalog.business_object(identifier,name_en,domain_id) VALUES ('orphan','Orphan',${id(999)})`, '23503');
    await reject('required parent', "INSERT INTO catalog.data_field(identifier,name_en,technical_name,technical_name_kind) VALUES ('orphan','Orphan','A','unknown')", '23502');
    await reject('duplicate semantic name within owner', `INSERT INTO catalog.business_attribute(identifier,name_en,business_object_id,semantic_name) VALUES ('duplicate','Duplicate',${id(30)},'height')`, '23505');
    await reject('duplicate exact code', `INSERT INTO catalog.code_value(identifier,name_en,code_list_id,code) VALUES ('duplicate','Duplicate',${id(40)},'01')`, '23505');
    await run('case-sensitive codes', `INSERT INTO catalog.code_value(identifier,name_en,code_list_id,code) VALUES ('code-upper','Upper',${id(40)},'A'), ('code-lower','Lower',${id(40)},'a')`);
    await run('same code in another list', `INSERT INTO catalog.code_value(id,identifier,name_en,code_list_id,code) VALUES (${id(45)},'other-code','Other',${id(41)},'01')`);
    await reject('parent code from another list', `UPDATE catalog.code_value SET parent_code_value_id=${id(45)} WHERE id=${id(44)}`, '23503');
    await run('same-list parent', `UPDATE catalog.code_value SET parent_code_value_id=${id(42)} WHERE id=${id(44)}`);
    await reject('code cycle', `UPDATE catalog.code_value SET parent_code_value_id=${id(44)} WHERE id=${id(42)}`);
    await reject('domain cycle', `UPDATE catalog.domain SET parent_domain_id=${id(11)} WHERE id=${id(10)}`);
    await reject('immutable owner', `UPDATE catalog.data_field SET data_table_id=${id(51)} WHERE id=${id(60)}`);
    await reject('immutable identifier', `UPDATE catalog.domain SET identifier='renamed' WHERE id=${id(10)}`);
    await reject('retain identity', `DELETE FROM catalog.domain WHERE id=${id(10)}`);
    await check('unknown field constraints remain unknown', `SELECT key_roles IS NULL AND is_required IS NULL AND is_nullable IS NULL AS unknown FROM catalog.data_field WHERE id=${id(60)}`, [{ unknown: true }]);
    await run('documented no key', `UPDATE catalog.data_field SET key_roles='{}' WHERE id=${id(60)}`);
    await check('empty key set differs from unknown', `SELECT cardinality(key_roles) AS size FROM catalog.data_field WHERE id=${id(60)}`, [{ size: 0 }]);
    await reject('duplicate key role', `UPDATE catalog.data_field SET key_roles=ARRAY['primary','primary'] WHERE id=${id(60)}`);
    await reject('null array member', `UPDATE catalog.data_field SET key_roles=ARRAY['primary',NULL] WHERE id=${id(60)}`);
    await reject('multidimensional array', `UPDATE catalog.data_field SET key_roles=ARRAY[['primary'],['foreign']] WHERE id=${id(60)}`);
    await reject('unknown role token', `UPDATE catalog.data_field SET key_roles=ARRAY['PK'] WHERE id=${id(60)}`);
    await reject('source type needs scope', `UPDATE catalog.data_field SET source_data_type='NUMBER(10)' WHERE id=${id(60)}`);
    await run('exact source type and documented type names', `UPDATE catalog.data_field SET source_data_type='NUMBER(10)',data_type_scope='unknown',applies_to_type_names=ARRAY['Gebäude_AS'] WHERE id=${id(60)}`);
    await reject('scope without source type', `UPDATE catalog.data_field SET data_type_scope='unknown' WHERE id=${id(61)}`);

    await reject('organisation requires name', `UPDATE catalog.business_object SET responsible_organisation='{}' WHERE id=${id(30)}`);
    await reject('organisation rejects unknown keys', `UPDATE catalog.business_object SET responsible_organisation='{"name_en":"Office","email":"a@example.com"}' WHERE id=${id(30)}`);
    await reject('JSON null translation', `UPDATE catalog.business_object SET responsible_organisation='{"name_en":"Office","name_de":null}' WHERE id=${id(30)}`);
    await reject('blank translation', `UPDATE catalog.business_object SET responsible_organisation='{"name_en":"Office","name_de":" "}' WHERE id=${id(30)}`);
    await run('documentation link with missing translations', `UPDATE catalog.business_object SET documentation_links='[{"url":"https://example.com/docs?q=@test","purpose":"definition","title_de":"Definition","language":"de-CH"}]' WHERE id=${id(30)}`);
    await reject('unsafe scheme', `UPDATE catalog.business_object SET documentation_links='[{"url":"javascript:alert(1)","purpose":"definition"}]' WHERE id=${id(30)}`);
    await reject('URL credentials', `UPDATE catalog.business_object SET documentation_links='[{"url":"https://user:secret@example.com/","purpose":"definition"}]' WHERE id=${id(30)}`);
    await reject('missing URL host', `UPDATE catalog.actor SET website_url='https:///docs' WHERE id=${id(1)}`);
    await reject('out-of-range URL port', `UPDATE catalog.actor SET website_url='https://example.com:99999' WHERE id=${id(1)}`);
    await run('IPv6 URL', `UPDATE catalog.actor SET website_url='https://[::1]:8443/docs' WHERE id=${id(1)}`);
    await reject('duplicate URL/purpose', `UPDATE catalog.business_object SET documentation_links='[{"url":"https://example.com","purpose":"definition"},{"url":"https://example.com","purpose":"definition","title_en":"Other"}]' WHERE id=${id(30)}`);
    await reject('null link member', `UPDATE catalog.business_object SET documentation_links='[null]' WHERE id=${id(30)}`);
    await reject('link requires purpose', `UPDATE catalog.business_object SET documentation_links='[{"url":"https://example.com"}]' WHERE id=${id(30)}`);
    await reject('business attribute cannot contain product bounds', `UPDATE catalog.business_attribute SET value_specification='{"valueType":"decimal","minimumValue":"0"}' WHERE id=${id(70)}`);
    await run('exact product decimals and negative scale', `UPDATE catalog.product_attribute SET value_specification='{"valueType":"decimal","minimumValue":"0","maximumValue":"9007199254740993.01","precision":3,"scale":-2}' WHERE id=${id(91)}`);
    await run('source scale above precision', `UPDATE catalog.product_attribute SET value_specification='{"valueType":"decimal","precision":2,"scale":5}' WHERE id=${id(91)}`);
    await reject('JSON decimal numbers forbidden', `UPDATE catalog.product_attribute SET value_specification='{"valueType":"decimal","minimumValue":0}' WHERE id=${id(91)}`);
    await reject('decimal exponent forbidden', `UPDATE catalog.product_attribute SET value_specification='{"valueType":"decimal","minimumValue":"1e3"}' WHERE id=${id(91)}`);
    await reject('inverted numeric bounds', `UPDATE catalog.product_attribute SET value_specification='{"valueType":"decimal","minimumValue":"2","maximumValue":"1"}' WHERE id=${id(91)}`);
    await reject('geometry constraint on text', `UPDATE catalog.product_attribute SET value_specification='{"valueType":"text","geometryType":"Polygon"}' WHERE id=${id(91)}`);
    await reject('fractional length', `UPDATE catalog.product_attribute SET value_specification='{"valueType":"text","minimumLength":1.5}' WHERE id=${id(91)}`);
    await reject('negative length', `UPDATE catalog.product_attribute SET value_specification='{"valueType":"text","maximumLength":-1}' WHERE id=${id(91)}`);

    await reject('numeric rule needs threshold', "INSERT INTO catalog.quality_requirement(identifier,name_en,rule_type,dimension) VALUES ('invalid','Invalid','greaterThan','validity')");
    await reject('non-numeric rule forbids threshold', "INSERT INTO catalog.quality_requirement(identifier,name_en,rule_type,dimension,comparison_value) VALUES ('invalid','Invalid','unique','uniqueness',0)");
    await reject('NaN threshold', `UPDATE catalog.quality_requirement SET comparison_value='NaN' WHERE id=${id(80)}`);
    await reject('infinite threshold', `UPDATE catalog.quality_requirement SET comparison_value='Infinity' WHERE id=${id(80)}`);
    await run('numeric rule on numeric and unknown business types', `INSERT INTO catalog.business_attribute_quality_requirement VALUES (${id(70)},${id(80)}),(${id(72)},${id(80)})`);
    await reject('numeric rule on known text type', `INSERT INTO catalog.business_attribute_quality_requirement VALUES (${id(71)},${id(80)})`);
    await reject('type edit must check existing assignments', `UPDATE catalog.business_attribute SET value_specification='{"valueType":"text"}' WHERE id=${id(70)}`);
    await run('required rule on text', `INSERT INTO catalog.business_attribute_quality_requirement VALUES (${id(71)},${id(81)})`);
    await reject('shared rule edit must check all assignments', `UPDATE catalog.quality_requirement SET rule_type='greaterThan',comparison_value=0 WHERE id=${id(81)}`);
    await run('source mismatch does not erase expectation', `UPDATE catalog.data_field SET source_data_type='VARCHAR',data_type_scope='physicalSchema' WHERE id=${id(60)}; INSERT INTO catalog.data_field_quality_requirement VALUES (${id(60)},${id(80)})`);
    await reject('duplicate rule assignment', `INSERT INTO catalog.data_field_quality_requirement VALUES (${id(60)},${id(80)})`, '23505');
    await reject('missing rule reference', `INSERT INTO catalog.data_field_quality_requirement VALUES (${id(61)},${id(999)})`, '23503');
    await run('retire existing rule without cascading', `UPDATE catalog.quality_requirement SET status='retired' WHERE id=${id(81)}`);
    await reject('new assignment to retired rule', `INSERT INTO catalog.data_field_quality_requirement VALUES (${id(61)},${id(81)})`);

    await run('candidate realization', `INSERT INTO catalog.relationship(id,identifier,source_data_table_id,target_business_object_id,relationship_type,coverage) VALUES (${id(120)},'realizes-building',${id(50)},${id(30)},'realizes','unknown')`);
    await reject('duplicate relationship', `INSERT INTO catalog.relationship(identifier,source_data_table_id,target_business_object_id,relationship_type,coverage) VALUES ('duplicate',${id(50)},${id(30)},'realizes','unknown')`, '23505');
    await reject('wrong relationship signature', `INSERT INTO catalog.relationship(identifier,source_data_service_id,target_business_object_id,relationship_type,coverage) VALUES ('wrong',${id(100)},${id(30)},'realizes','unknown')`);
    await reject('missing coverage', `INSERT INTO catalog.relationship(identifier,source_data_field_id,target_business_attribute_id,relationship_type) VALUES ('missing',${id(60)},${id(70)},'represents')`);
    await reject('multiple sources', `INSERT INTO catalog.relationship(identifier,source_data_field_id,source_data_table_id,target_business_attribute_id,relationship_type,coverage) VALUES ('multi',${id(60)},${id(50)},${id(70)},'represents','unknown')`);
    await reject('self relationship', `INSERT INTO catalog.relationship(identifier,source_business_object_id,target_business_object_id,relationship_type) VALUES ('self',${id(30)},${id(30)},'measuredFor')`);
    await reject('partial coverage needs notes', `UPDATE catalog.relationship SET coverage='partial' WHERE id=${id(120)}`);
    await reject('confirmation needs basis', `UPDATE catalog.relationship SET verification_status='confirmed' WHERE id=${id(120)}`);
    await run('confirmation with notes', `UPDATE catalog.relationship SET verification_status='confirmed',rule_notes_en='Documented mapping' WHERE id=${id(120)}`);
    await reject('scope cannot change', `UPDATE catalog.relationship SET source_data_table_id=${id(51)} WHERE id=${id(120)}`);
    await run('obsolete assertion retains identity', `UPDATE catalog.relationship SET verification_status='obsolete' WHERE id=${id(120)}`);
    await reject('obsolete assertion still prevents duplicates', `INSERT INTO catalog.relationship(identifier,source_data_table_id,target_business_object_id,relationship_type,coverage) VALUES ('duplicate',${id(50)},${id(30)},'realizes','unknown')`, '23505');
    await reject('restore must return to candidate', `UPDATE catalog.relationship SET verification_status='confirmed' WHERE id=${id(120)}`);
    await run('explicit restoration', `UPDATE catalog.relationship SET verification_status='candidate' WHERE id=${id(120)}`);
    await reject('assessment requires endpoint', `INSERT INTO catalog.relationship(identifier,source_data_service_id,target_business_attribute_id,relationship_type,support_status) VALUES ('assessment',${id(100)},${id(70)},'assesses','notAssessed')`);
    await reject('endpoint belongs to source service', `INSERT INTO catalog.relationship(identifier,source_data_service_id,source_endpoint_id,target_business_attribute_id,relationship_type,support_status) VALUES ('assessment',${id(100)},${id(111)},${id(70)},'assesses','notAssessed')`, '23503');
    await run('scoped missing requirement', `INSERT INTO catalog.relationship(id,identifier,source_data_service_id,source_endpoint_id,target_business_attribute_id,relationship_type,support_status,rule_notes_en) VALUES (${id(121)},'missing-height',${id(100)},${id(110)},${id(70)},'assesses','missing','The documented response omits height')`);
    await reject('cannot remove referenced endpoint', `DELETE FROM catalog.service_endpoint WHERE id=${id(110)}`, ['23001', '23503']);
    await reject('endpoint owner immutable', `UPDATE catalog.service_endpoint SET data_service_id=${id(101)} WHERE id=${id(110)}`);
    await reject('endpoint needs an address or operation', `INSERT INTO catalog.service_endpoint(identifier,data_service_id) VALUES ('empty',${id(100)})`);
    await run('unscoped exposure', `INSERT INTO catalog.relationship(identifier,source_data_service_id,target_data_table_id,relationship_type,coverage) VALUES ('exposure',${id(100)},${id(50)},'exposes','unknown')`);
    await reject('unscoped exposure uniqueness', `INSERT INTO catalog.relationship(identifier,source_data_service_id,target_data_table_id,relationship_type,coverage) VALUES ('exposure-duplicate',${id(100)},${id(50)},'exposes','unknown')`, '23505');
    await run('endpoint exposure distinct from service exposure', `INSERT INTO catalog.relationship(identifier,source_data_service_id,source_endpoint_id,target_data_table_id,relationship_type,coverage) VALUES ('endpoint-exposure',${id(100)},${id(110)},${id(50)},'exposes','unknown')`);
    await reject('confirmation needs the known service release', `UPDATE catalog.relationship SET verification_status='confirmed' WHERE id=${id(121)}`);
    await reject('confirmation rejects a different service release', `UPDATE catalog.relationship SET verification_status='confirmed',assessed_service_version='4.0' WHERE id=${id(121)}`);
    await run('confirm current service scope', `UPDATE catalog.relationship SET verification_status='confirmed',assessed_service_version='5.0' WHERE id=${id(121)}`);
    await run('later service release does not rewrite historical assessment', `UPDATE catalog.data_service SET service_version='6.0' WHERE id=${id(100)}`);
    await check('recorded assessment remains unchanged', `SELECT assessed_service_version::text AS release FROM catalog.relationship WHERE id=${id(121)}`, [{ release: '5.0' }]);
    await run('associations and directional correspondence', `
      INSERT INTO catalog.business_object(id,identifier,name_en,domain_id) VALUES (${id(31)},'measurement','Measurement',${id(10)});
      INSERT INTO catalog.relationship(identifier,source_data_product_id,target_business_object_id,relationship_type) VALUES ('product-concept',${id(90)},${id(30)},'basedOn');
      INSERT INTO catalog.relationship(identifier,source_data_product_id,target_data_table_id,relationship_type) VALUES ('product-table',${id(90)},${id(50)},'sourcedFrom');
      INSERT INTO catalog.relationship(identifier,source_data_product_id,target_data_service_id,relationship_type) VALUES ('product-api',${id(90)},${id(100)},'servedBy');
      INSERT INTO catalog.relationship(identifier,source_business_object_id,target_business_object_id,relationship_type) VALUES ('measured-for',${id(31)},${id(30)},'measuredFor');
      INSERT INTO catalog.relationship(identifier,source_data_field_id,target_data_field_id,relationship_type,coverage) VALUES ('field-correspondence',${id(60)},${id(61)},'correspondsTo','unknown');
      INSERT INTO catalog.relationship(identifier,source_data_field_id,target_business_attribute_id,relationship_type,coverage) VALUES ('field-meaning',${id(60)},${id(70)},'represents','unknown');
    `);
    await reject('association forbids coverage', "UPDATE catalog.relationship SET coverage='full' WHERE identifier='product-concept'");
    await reject('association forbids endpoint scope', `UPDATE catalog.relationship SET source_endpoint_id=${id(110)} WHERE identifier='product-api'`);
    await run('retire relationship target', `UPDATE catalog.business_object SET status='retired' WHERE id=${id(30)}`);
    await reject('cannot confirm link to retired target', `UPDATE catalog.relationship SET verification_status='confirmed' WHERE id=${id(120)}`);
    await reject('cannot add link to retired target', `INSERT INTO catalog.relationship(identifier,source_data_table_id,target_business_object_id,relationship_type,coverage) VALUES ('retired-target',${id(51)},${id(30)},'realizes','unknown')`);
    await run('restore target without cascading relationships', `UPDATE catalog.business_object SET status='draft' WHERE id=${id(30)}`);

    await run('table lineage', `INSERT INTO catalog.lineage_relation(id,identifier,source_data_table_id,target_data_table_id,operation) VALUES (${id(130)},'copy-building',${id(50)},${id(51)},'copy')`);
    await reject('mixed lineage types', `INSERT INTO catalog.lineage_relation(identifier,source_data_table_id,target_data_field_id,operation) VALUES ('mixed',${id(50)},${id(61)},'unknown')`);
    await reject('self lineage', `INSERT INTO catalog.lineage_relation(identifier,source_data_field_id,target_data_field_id,operation) VALUES ('self',${id(60)},${id(60)},'copy')`);
    await reject('lineage confirmation requires basis', `UPDATE catalog.lineage_relation SET verification_status='confirmed' WHERE id=${id(130)}`);
    await reject('confirmed transformation needs note even with link', `UPDATE catalog.lineage_relation SET verification_status='confirmed',operation='transform',documentation_links='[{"url":"https://example.com","purpose":"documentation"}]' WHERE id=${id(130)}`);
    await run('confirmed transformation', `UPDATE catalog.lineage_relation SET verification_status='confirmed',operation='transform',transformation_notes_en='Convert units' WHERE id=${id(130)}`);
    await reject('lineage scope immutable', `UPDATE catalog.lineage_relation SET source_data_table_id=${id(51)},target_data_table_id=${id(50)} WHERE id=${id(130)}`);
    await run('inactive lineage retains uniqueness', `UPDATE catalog.lineage_relation SET verification_status='obsolete' WHERE id=${id(130)}`);
    await reject('obsolete lineage pair cannot duplicate', `INSERT INTO catalog.lineage_relation(identifier,source_data_table_id,target_data_table_id,operation) VALUES ('duplicate-lineage',${id(50)},${id(51)},'copy')`, '23505');

    await run('legacy date-only history', `INSERT INTO catalog.change_event(id,identifier,record_actor_id,actor_id,actor_name_en,occurred_on,action,summary_en) VALUES (${id(140)},'actor-created',${id(1)},${id(1)},'Editor','2026-09-06','created','Imported historical event')`);
    await reject('event must target exactly one record', `INSERT INTO catalog.change_event(identifier,occurred_on,action,summary_en) VALUES ('missing','2026-09-06','created','Missing target')`);
    await reject('event date is UTC date', `INSERT INTO catalog.change_event(identifier,record_domain_id,occurred_on,occurred_at,action,summary_en) VALUES ('date',${id(10)},'2026-09-06','2026-09-06T00:30:00+02:00','updated','Wrong UTC date')`);
    await reject('history cannot be edited', `UPDATE catalog.change_event SET summary_en='Rewrite' WHERE id=${id(140)}`);
    await reject('history cannot be deleted', `DELETE FROM catalog.change_event WHERE id=${id(140)}`);
    await run('actor rename', `UPDATE catalog.actor SET name_en='New editor name' WHERE id=${id(1)}`);
    await check('historical actor name stays unchanged', `SELECT actor_name_en::text AS name FROM catalog.change_event WHERE id=${id(140)}`, [{ name: 'Editor' }]);
    await reject('new version requires a date', "INSERT INTO catalog.domain(identifier,name_en,version) VALUES ('new-version','New','1')");
    await run('legacy version date remains unknown', "BEGIN; SET LOCAL catalog.import_legacy='on'; INSERT INTO catalog.domain(id,identifier,name_en,version) VALUES ('00000000-0000-0000-0000-000000000150','legacy','Legacy','1'); COMMIT;");
    await run('ordinary edit keeps unknown legacy date', `UPDATE catalog.domain SET comment='Reviewed' WHERE id=${id(150)}`);
    await reject('changed version needs date', `UPDATE catalog.domain SET version='2' WHERE id=${id(150)}`);
    await run('assign version with date', `UPDATE catalog.domain SET version='2',version_date='2026-09-06' WHERE id=${id(150)}`);
    await reject('known version date cannot disappear', `UPDATE catalog.domain SET version_date=NULL WHERE id=${id(150)}`);
    await reject('date without version', `UPDATE catalog.domain SET version=NULL WHERE id=${id(150)}`);
    await run('clear version pair', `UPDATE catalog.domain SET version=NULL,version_date=NULL WHERE id=${id(150)}`);
    await check('revision advances once per changed row update', `SELECT row_version::int AS revision FROM catalog.domain WHERE id=${id(150)}`, [{ revision: 4 }]);
    await run('no-op edit', `UPDATE catalog.domain SET comment='Reviewed' WHERE id=${id(150)}`);
    await check('no-op keeps revision', `SELECT row_version::int AS revision FROM catalog.domain WHERE id=${id(150)}`, [{ revision: 4 }]);
    await check('stale compare-and-swap changes no rows', `UPDATE catalog.domain SET comment='Stale overwrite' WHERE id=${id(150)} AND row_version=1 RETURNING id`, []);

    await db.exec('BEGIN;');
    await run('first operation in batch', `UPDATE catalog.domain SET comment='Partial batch' WHERE id=${id(150)}`);
    await reject('second operation fails', `UPDATE catalog.relationship SET coverage=NULL WHERE id=${id(120)}`);
    await db.exec('ROLLBACK;');
    await check('failed batch leaves no partial change', `SELECT comment::text AS comment,row_version::int AS revision FROM catalog.domain WHERE id=${id(150)}`, [{ comment: 'Reviewed', revision: 4 }]);
    await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ;');
    await reject('reject stale-snapshot isolation for cross-record checks', `UPDATE catalog.domain SET comment='Unsafe isolation' WHERE id=${id(150)}`, '25000');
    await db.exec('ROLLBACK;');

    await db.exec('BEGIN; SET LOCAL ROLE anon;');
    await reject('anonymous reads denied', 'SELECT * FROM catalog.domain', '42501');
    await db.exec('ROLLBACK; BEGIN; SET LOCAL ROLE authenticated;');
    await reject('sign-in alone grants no catalog access', 'SELECT * FROM catalog.domain', '42501');
    await db.exec('ROLLBACK; BEGIN; SET LOCAL ROLE service_role;');
    await check('trusted backend can read', `SELECT identifier::text AS identifier FROM catalog.domain WHERE id=${id(10)}`, [{ identifier: 'construction' }]);
    await reject('backend direct writes disabled until audited API exists', `UPDATE catalog.domain SET name_en='Overwrite' WHERE id=${id(10)}`, '42501');
    await db.exec('ROLLBACK;');
    await reject('no truncate grant for API role', "SET ROLE service_role; TRUNCATE catalog.domain", '42501');
    await db.exec('RESET ROLE;');
    await reject('repeat application cannot replace existing schema', migration, '42P06');
    await db.exec('ROLLBACK;');
    await check('failed second migration preserves data', `SELECT identifier::text AS identifier FROM catalog.domain WHERE id=${id(10)}`, [{ identifier: 'construction' }]);
    console.log(`${passed} catalog schema checks passed (PostgreSQL via PGlite).`);
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
