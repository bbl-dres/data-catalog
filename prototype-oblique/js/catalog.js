/* Supabase transport and read-only projection into the existing catalog UI contract. */
(function (DK) {
  'use strict';
  const tables = ['actor', 'domain', 'system', 'business_object', 'business_attribute', 'data_table', 'data_field', 'code_list', 'code_value', 'data_product', 'product_attribute', 'data_service', 'service_endpoint', 'quality_requirement', 'business_attribute_quality_requirement', 'data_field_quality_requirement', 'relationship', 'lineage_relation', 'change_event'];
  const kinds = { domains: 'domain', systems: 'system', objects: 'business_object', tables: 'data_table', refs: 'code_list', products: 'data_product', apis: 'data_service' };
  const labels = (record, base = 'name') => Object.fromEntries(['de', 'it', 'fr', 'en'].filter(lang => record[`${base}_${lang}`]).map(lang => [lang, record[`${base}_${lang}`]]));
  const text = (record, base) => DK.ui.localized(labels(record, base));
  const status = { draft: 'Entwurf', valid: 'Gültig', retired: 'Archiviert' };
  const classification = { internal: 'intern', public: 'öffentlich', confidential: 'vertraulich', secret: 'geheim' };
  const valueTypes = { text: 'Text', identifier: 'Text', integer: 'Ganzzahl', decimal: 'Dezimal', date: 'Datum', dateTime: 'Datum / Zeit', year: 'Jahr', code: 'Code', geometry: 'Geometrie', boolean: 'Boolean', structured: 'Strukturiert' };
  const frequencies = { continuous: 'kontinuierlich', daily: 'täglich', weekly: 'wöchentlich', monthly: 'monatlich', quarterly: 'quartalsweise', annually: 'jährlich', onChange: 'bei Änderung', onDemand: 'bei Bedarf', irregular: 'unregelmässig' };
  const localized = (value, getters) => Object.defineProperties(value, Object.fromEntries(Object.entries(getters).map(([key, get]) => [key, { enumerable: true, configurable: true, get }])));

  function project(snapshot) {
    if (snapshot?.schemaVersion !== 1) throw new Error('Unsupported catalog schema version');
    const maps = {};
    for (const table of tables) {
      if (!Array.isArray(snapshot[table])) throw new Error(`Catalog snapshot is missing ${table}`);
      maps[table] = new Map();
      for (const record of snapshot[table]) {
        if (!record || typeof record !== 'object') throw new Error(`Invalid ${table} record`);
        if (record.id) {
          if (maps[table].has(record.id)) throw new Error(`Duplicate ${table} ID`);
          maps[table].set(record.id, record);
        }
      }
    }
    const resolve = (table, id) => {
      if (!id) return null;
      const record = maps[table].get(id);
      if (!record) throw new Error(`Broken ${table} reference: ${id}`);
      return record;
    };
    const ref = (table, id) => resolve(table, id)?.identifier;
    const actor = id => {
      const a = resolve('actor', id);
      return a ? { name: text(a, 'name'), type: a.actor_type, url: a.website_url } : undefined;
    };
    const base = r => localized({ identifier: r.identifier, labels: labels(r), _record: r,
      _relationships: snapshot.relationship.filter(link => Object.entries(link).some(([key, value]) => /^(source|target)_.+_id$/.test(key) && value === r.id)),
      status: status[r.status], version: r.version, versionDate: r.version_date, created: r.created_on, modified: r.modified_on,
      comment: r.comment, classification: classification[r.classification], personalData: r.contains_personal_data,
      informationUrls: (r.documentation_links || []).filter(l => l.purpose !== 'terminology').map(l => l.url),
      documentationLinks: r.documentation_links || [], contact: { url: (r.responsible_organisation || r.authority_organisation)?.websiteUrl },
      domain: ref('domain', r.domain_id), system: ref('system', r.system_id), normReference: r.normative_references?.join('; ')
    }, { name: () => text(r, 'name'), description: () => text(r, 'description'),
      responsibleOrg: () => text(r.responsible_organisation || r.authority_organisation || {}, 'name'),
      dataOwner: () => actor(r.data_owner_id), dataSteward: () => actor(r.data_steward_id), dataCustodian: () => actor(r.data_custodian_id) });
    const childId = (r, parent) => r.identifier.startsWith(parent.identifier + '/') ? r.identifier.slice(parent.identifier.length + 1) : r.identifier;
    const active = r => {
      if (!['candidate', 'confirmed'].includes(r.verification_status)) return false;
      for (const [key, id] of Object.entries(r)) if (/^(source|target)_.+_id$/.test(key) && key !== 'source_endpoint_id' && id) {
        const target = resolve(key.replace(/^(source|target)_/, '').replace(/_id$/, ''), id);
        if (target.status === 'retired') return false;
      }
      return true;
    };
    const relationships = snapshot.relationship.filter(active);
    const linked = (r, type, targetTable) => relationships.filter(link => link.relationship_type === type && [link.source_data_product_id, link.source_data_table_id].includes(r.id)).map(link => ref(targetTable, link[`target_${targetTable}_id`])).filter(Boolean);
    const result = { catalogSnapshot: snapshot };
    for (const [kind, table] of Object.entries(kinds)) result[kind] = snapshot[table].map(base);
    const byId = Object.fromEntries(Object.entries(kinds).map(([kind, table]) => [table, new Map(result[kind].map(e => [e._record.id, e]))]));
    const owner = (table, id) => {
      const entity = byId[table].get(id);
      if (!entity) throw new Error(`Missing ${table} owner`);
      return entity;
    };
    result.systems.forEach(e => Object.assign(e, { technology: e._record.technology, informationUrl: e.informationUrls[0] }));
    result.objects.forEach(e => Object.assign(e, { attributes: [], termdat: e.documentationLinks.filter(l => l.purpose === 'terminology').map(l => localized({ id: l.externalIdentifier, url: l.url }, { name: () => text(l, 'title') || l.url })) }));
    result.tables.forEach(e => Object.assign(e, { fields: [], technicalName: e._record.technical_name, realizes: linked(e._record, 'realizes', 'business_object')[0] }));
    result.refs.forEach(e => Object.assign(e, { values: [], businessObject: ref('business_object', e._record.business_object_id) }));
    result.products.forEach(e => Object.assign(e, { attributes: [], basedOn: linked(e._record, 'basedOn', 'business_object'), sourcedFrom: linked(e._record, 'sourcedFrom', 'data_table'), servedBy: linked(e._record, 'servedBy', 'data_service'),
      accessRights: e._record.access_notes || e._record.access_mode, license: e._record.license_notes || e._record.license_uri, format: e._record.formats.join(', '), accrualPeriodicity: frequencies[e._record.update_frequency] }));
    for (const r of snapshot.business_attribute) {
      const parent = owner('business_object', r.business_object_id), e = base(r);
      const requirements = snapshot.business_attribute_quality_requirement.filter(a => a.business_attribute_id === r.id).map(a => resolve('quality_requirement', a.quality_requirement_id));
      Object.assign(e, { identifier: childId(r, parent), valueType: valueTypes[r.value_specification?.valueType], keyRole: r.is_identifier ? 'PK' : null,
        mandatory: requirements.some(q => q.rule_type === 'required' && q.status !== 'retired') ? true : null, qualityRequirements: requirements, codeList: ref('code_list', r.code_list_id) });
      parent.attributes.push(e);
    }
    for (const r of snapshot.data_field) {
      const parent = owner('data_table', r.data_table_id), e = base(r);
      Object.assign(e, { identifier: childId(r, parent), technicalName: r.technical_name, dataType: r.source_data_type, technicalNameKind: r.technical_name_kind, dataTypeKind: r.data_type_scope,
        keyRoles: r.key_roles, keyRole: r.key_roles?.includes('primary') ? 'PK' : r.key_roles?.includes('foreign') ? 'FK' : null, mandatory: r.is_required, codeList: ref('code_list', r.code_list_id), appliesToObjectTypes: r.applies_to_type_names });
      parent.fields.push(e);
    }
    for (const r of snapshot.code_value) {
      const parent = owner('code_list', r.code_list_id), e = base(r);
      Object.assign(e, { code: r.code, shortLabels: labels(r, 'short_name'), note: r.comment });
      localized(e, { label: () => text(r, 'name') });
      parent.values.push(e);
    }
    for (const r of snapshot.product_attribute) {
      const parent = owner('data_product', r.data_product_id), e = base(r);
      Object.assign(e, { valueType: valueTypes[r.value_specification?.valueType], mandatory: r.is_required });
      parent.attributes.push(e);
    }
    result.apis.forEach(e => {
      const endpoints = snapshot.service_endpoint.filter(endpoint => endpoint.data_service_id === e._record.id);
      const endpoint = endpoints.find(x => x.identifier === 'primary') || endpoints[0];
      Object.assign(e, { endpoints, version: e._record.service_version, protocol: endpoint?.protocol, endpointURL: endpoint?.url, documentation: e.informationUrls[0], accessRights: e._record.access_notes || e._record.access_mode });
    });
    result.changelog = snapshot.change_event.map(r => {
      const target = Object.entries(kinds).find(([, table]) => r[`record_${table}_id`]);
      const [kind, table] = target || ['other', Object.keys(r).find(key => key.startsWith('record_') && r[key])?.slice(7, -3)];
      const identifier = ref(table, r[`record_${table}_id`]);
      return localized({ identifier: r.identifier, entity: `${kind}:${identifier}`, date: r.occurred_on, action: { created: 'Erstellt', updated: 'Geändert', imported: 'Importiert', retired: 'Archiviert', restored: 'Wiederhergestellt' }[r.action], importId: r.import_id, _record: r }, { detail: () => text(r, 'summary'), user: () => text(r, 'actor_name') });
    });
    return result;
  }

  async function load(config) {
    const url = new URL(config.url);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Supabase requires HTTPS');
    if (url.username || url.password || !config.publishableKey?.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable key in the browser configuration');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(new URL('/rest/v1/rpc/read_snapshot', url), { method: 'POST', cache: 'no-store', credentials: 'omit', signal: controller.signal,
        headers: { apikey: config.publishableKey, 'Content-Profile': 'catalog', 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        const hint = detail.code === 'PGRST106' ? 'Expose the catalog schema in Supabase Data API settings.' : detail.code === 'PGRST202' ? 'Apply the catalog public-read and import migrations.' : 'Check the catalog migrations and read policies.';
        throw new Error(`Supabase HTTP ${response.status}. ${hint}`);
      }
      return project(await response.json());
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Supabase did not respond within 20 seconds. Please retry.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  DK.catalog = { load, project };
})(window.DK);
