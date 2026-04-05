// ============================================================
// Detail Views
// ============================================================
function renderDetailView(section, entityId, tab) {
  const main = document.getElementById('main-content');
  switch(section) {
    case 'vocabulary': renderConceptDetail(entityId, tab, main); break;
    case 'terms': renderTermDetail(entityId, tab, main); break;
    case 'codelists': renderCodeListDetail(entityId, tab, main); break;
    case 'systems': renderSystemDetail(entityId, tab, main); break;
    case 'products': renderProductDetail(entityId, tab, main); break;
    default: main.innerHTML = '<p>Not found</p>';
  }
}

// ============================================================
// Concept Detail
// ============================================================
function renderConceptDetail(conceptId, tab, main) {
  const concept = queryOne("SELECT c.*, col.id as col_id FROM concept c LEFT JOIN collection col ON c.collection_id = col.id WHERE c.id = ?", [conceptId]);
  if (!concept) { main.innerHTML = '<p>Concept not found</p>'; return; }

  const collection = concept.col_id ? queryOne("SELECT * FROM collection WHERE id = ?", [concept.col_id]) : null;
  const vocab = queryOne("SELECT * FROM vocabulary WHERE id = ?", [concept.vocabulary_id]);
  const steward = concept.steward_id ? queryOne('SELECT * FROM "user" WHERE id = ?', [concept.steward_id]) : null;


  addRecent(n(concept, 'name') || concept.name_en, `#/vocabulary/${conceptId}`);

  const tabs = ['overview', 'fields', 'mappings', 'relationships', 'history'];

  const tabLabels = { overview: 'Übersicht', fields: 'Felder', mappings: 'Mappings', relationships: 'Relationen', history: 'History' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  // Breadcrumb
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome();
  html += `<a class="breadcrumb-link" href="#/vocabulary">${SECTION_LABELS.vocabulary[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  if (collection) {
    html += `<a class="breadcrumb-link" href="#/vocabulary">${escapeHtml(n(collection, 'name'))}</a>`;
    html += '<span class="breadcrumb-separator"> / </span>';
  }
  html += `<span class="breadcrumb-current">${escapeHtml(n(concept, 'name'))}</span>`;
  html += '</nav>';

  // Title block
  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="box" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(concept, 'name'))}</div>`;
  html += '</div>';
  html += '<div class="title-block-actions">';
  html += ' <button class="header-icon-btn" aria-label="Bearbeiten" title="Bearbeiten"><i data-lucide="pencil" style="width:18px;height:18px;"></i></button>';
  html += ' <button class="header-icon-btn" aria-label="Kommentare" title="Kommentare"><i data-lucide="message-square" style="width:18px;height:18px;"></i></button>';
  html += '</div>';
  html += '</div>';

  // Tab bar with ARIA
  html += '<div class="tab-bar" role="tablist">';
  tabs.forEach(t => {
    const isActive = t === tab;
    html += `<button class="tab${isActive ? ' active' : ''}" data-tab="${t}" data-base="#/vocabulary/${conceptId}" role="tab" aria-selected="${isActive}">${tabLabels[t]}</button>`;
  });
  html += '</div>';

  // Tab content
  html += '<div class="tab-content">';
  switch(tab) {
    case 'overview': html += renderConceptOverview(concept, collection, vocab, steward); break;
    case 'fields': html += renderConceptContents(conceptId); break;
    case 'mappings': html += renderConceptMappings(conceptId); break;
    case 'relationships': html += renderConceptRelationships(conceptId); break;
    case 'history': html += renderHistoryTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderHistoryTab() {
  return '<div class="content-section">' + renderEmptyState('clock', '\u00c4nderungsprotokoll', 'Das \u00c4nderungsprotokoll wird in einer zuk\u00fcnftigen Version verf\u00fcgbar sein.') + '</div>';
}

function renderCodeListRelationships(codeListId, cl) {
  // Concepts that use this code list via concept_attribute
  const concepts = query(`SELECT DISTINCT c.id, c.${nameCol('name')} as cname FROM concept c JOIN concept_attribute ca ON ca.concept_id = c.id WHERE ca.code_list_id = ?`, [codeListId]);

  const satellites = [];
  if (concepts.length) {
    satellites.push({ title: 'Geschäftsobjekte', items: concepts.map(c => ({ label: c.cname, href: '#/vocabulary/' + c.id, icon: 'box', meta: '' })), color: '#6366F1' });
  }

  if (satellites.length === 0) return '<div class="content-section">' + renderEmptyState('git-branch', 'Keine Beziehungen', 'Diese Codeliste hat noch keine Beziehungen zu anderen Entitäten.') + '</div>';
  return renderRelGraph(n(cl, 'name'), satellites);
}

function renderSystemRelationships(systemId, sys) {
  // Schemas and datasets in this system
  const schemas = query(`SELECT sc.id, sc.name FROM schema_ sc WHERE sc.system_id = ?`, [systemId]);
  const datasets = query(`SELECT d.id, d.name, d.display_name, sc.id as schema_id FROM dataset d JOIN schema_ sc ON d.schema_id = sc.id WHERE sc.system_id = ?`, [systemId]);

  // Concepts mapped to datasets in this system
  const concepts = query(`SELECT DISTINCT c.id, c.${nameCol('name')} as cname
    FROM concept c
    JOIN concept_mapping cm ON cm.concept_id = c.id
    JOIN field f ON cm.field_id = f.id
    JOIN dataset d ON f.dataset_id = d.id
    JOIN schema_ sc ON d.schema_id = sc.id
    WHERE sc.system_id = ?`, [systemId]);

  // Data products using datasets from this system
  const products = query(`SELECT DISTINCT dp.id, dp.${nameCol('name')} as dp_name
    FROM data_product dp
    JOIN data_product_dataset dpd ON dpd.data_product_id = dp.id
    JOIN dataset d ON dpd.dataset_id = d.id
    JOIN schema_ sc ON d.schema_id = sc.id
    WHERE sc.system_id = ?`, [systemId]);

  const satellites = [];
  if (datasets.length) {
    satellites.push({ title: 'Datasets', items: datasets.map(d => ({ label: d.display_name || d.name, href: '#/systems/' + systemId + '/datasets/' + d.id, icon: 'table-2', meta: '' })), color: '#C9820B' });
  }
  if (concepts.length) {
    satellites.push({ title: 'Geschäftsobjekte', items: concepts.map(c => ({ label: c.cname, href: '#/vocabulary/' + c.id, icon: 'box', meta: '' })), color: '#6366F1' });
  }
  if (products.length) {
    satellites.push({ title: 'Datenprodukte', items: products.map(dp => ({ label: dp.dp_name, href: '#/products/' + dp.id, icon: 'package', meta: '' })), color: '#8B5CF6' });
  }

  if (satellites.length === 0) return '<div class="content-section">' + renderEmptyState('git-branch', 'Keine Beziehungen', 'Dieses System hat noch keine Beziehungen zu anderen Entitäten.') + '</div>';
  return renderRelGraph(n(sys, 'name'), satellites);
}

function renderDatasetRelationships(datasetId, ds) {
  // System
  const sys = queryOne(`SELECT s.id, s.${nameCol('name')} as sname FROM system s JOIN schema_ sc ON sc.system_id = s.id WHERE sc.id = ?`, [ds.schema_id]);

  // Mapped concepts
  const concepts = query(`SELECT DISTINCT c.id, c.${nameCol('name')} as cname
    FROM concept c JOIN concept_mapping cm ON cm.concept_id = c.id
    JOIN field f ON cm.field_id = f.id WHERE f.dataset_id = ?`, [datasetId]);

  // Data products
  const products = query(`SELECT DISTINCT dp.id, dp.${nameCol('name')} as dp_name
    FROM data_product dp JOIN data_product_dataset dpd ON dpd.data_product_id = dp.id
    WHERE dpd.dataset_id = ?`, [datasetId]);

  // Lineage: upstream
  const upstream = query(`SELECT d.id, d.name, d.display_name FROM lineage_link ll JOIN dataset d ON ll.source_dataset_id = d.id JOIN schema_ sc ON d.schema_id = sc.id WHERE ll.target_dataset_id = ?`, [datasetId]);
  // Lineage: downstream
  const downstream = query(`SELECT d.id, d.name, d.display_name FROM lineage_link ll JOIN dataset d ON ll.target_dataset_id = d.id JOIN schema_ sc ON d.schema_id = sc.id WHERE ll.source_dataset_id = ?`, [datasetId]);

  const satellites = [];
  if (sys) {
    satellites.push({ title: 'System', items: [{ label: sys.sname, href: '#/systems/' + sys.id, icon: 'database', meta: '' }], color: '#059669' });
  }
  if (concepts.length) {
    satellites.push({ title: 'Geschäftsobjekte', items: concepts.map(c => ({ label: c.cname, href: '#/vocabulary/' + c.id, icon: 'box', meta: '' })), color: '#6366F1' });
  }
  if (products.length) {
    satellites.push({ title: 'Datenprodukte', items: products.map(dp => ({ label: dp.dp_name, href: '#/products/' + dp.id, icon: 'package', meta: '' })), color: '#8B5CF6' });
  }
  if (upstream.length) {
    satellites.push({ title: 'Upstream', items: upstream.map(d => ({ label: d.display_name || d.name, href: '#/systems/' + ds.system_id + '/datasets/' + d.id, icon: 'arrow-left', meta: '' })), color: '#2E6EB5' });
  }
  if (downstream.length) {
    satellites.push({ title: 'Downstream', items: downstream.map(d => ({ label: d.display_name || d.name, href: '#/systems/' + ds.system_id + '/datasets/' + d.id, icon: 'arrow-right', meta: '' })), color: '#C9820B' });
  }

  if (satellites.length === 0) return '<div class="content-section">' + renderEmptyState('git-branch', 'Keine Beziehungen', 'Dieses Dataset hat noch keine Beziehungen zu anderen Entitäten.') + '</div>';
  return renderRelGraph(ds.display_name || ds.name, satellites);
}

function renderProductRelationships(productId, dp) {
  // Source datasets
  const sources = query(`SELECT d.id, d.name, d.display_name, s.${nameCol('name')} as sys_name, s.id as sys_id
    FROM data_product_dataset dpd
    JOIN dataset d ON dpd.dataset_id = d.id
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE dpd.data_product_id = ?`, [productId]);

  // Distributions
  const dists = query("SELECT id, name, format FROM distribution WHERE data_product_id = ?", [productId]);

  const satellites = [];
  if (sources.length) {
    satellites.push({ title: 'Quelldatasets', items: sources.map(s => ({ label: s.display_name || s.name, href: '#/systems/' + s.sys_id + '/datasets/' + s.id, icon: 'table-2', meta: s.sys_name })), color: '#C9820B' });
  }
  if (dists.length) {
    satellites.push({ title: 'Distributionen', items: dists.map(d => ({ label: d.name || d.format, icon: 'file-output', meta: d.format || '' })), color: '#0891B2' });
  }

  if (satellites.length === 0) return '<div class="content-section">' + renderEmptyState('git-branch', 'Keine Beziehungen', 'Dieses Datenprodukt hat noch keine Beziehungen zu anderen Entitäten.') + '</div>';
  return renderRelGraph(n(dp, 'name'), satellites);
}

function renderConceptOverview(concept, collection, vocab, steward) {
  let html = '';

  // Definition
  const def = getDefinitionText(concept.definition, lang);
  html += `<div class="content-section"><div class="section-label">DEFINITION</div>`;
  html += `<div class="prose">${def ? '<p>' + escapeHtml(def) + '</p>' : '<p style="color:var(--color-text-placeholder);">Keine Definition vorhanden.</p>'}</div></div>`;

  // Begriffe (linked terms)
  const linkedTerms = query(`SELECT t.id, t.${nameCol('name')} as tname, t.standard_ref FROM term t JOIN concept_term ct ON ct.term_id = t.id WHERE ct.concept_id = ?`, [concept.id]);
  if (linkedTerms.length > 0) {
    html += '<div class="content-section"><div class="section-label">BEGRIFFE</div>';
    html += '<div class="domain-group-concepts">';
    linkedTerms.forEach(t => {
      html += `<a class="concept-box" href="#/terms/${t.id}">`;
      html += `<span class="concept-box-name">${escapeHtml(t.tname)}</span>`;
      html += `</a>`;
    });
    html += '</div></div>';
  }

  // Metadata
  html += '<div class="content-section"><div class="section-label">METADATA</div>';
  html += '<table class="props-table">';
  if (collection) html += `<tr><td>Domäne</td><td>${escapeHtml(n(collection, 'name'))}</td></tr>`;
  html += `<tr><td>Status</td><td>${statusBadge(concept.status)}</td></tr>`;
  if (vocab) html += `<tr><td>Vocabulary</td><td>${escapeHtml(n(vocab, 'name'))} ${vocab.version ? 'v' + escapeHtml(vocab.version) : ''}</td></tr>`;
  html += `<tr><td>Erstellt</td><td>${formatDate(concept.created_at)}</td></tr>`;
  html += `<tr><td>Geändert</td><td>${formatDate(concept.modified_at)}</td></tr>`;
  if (concept.approved_at) html += `<tr><td>Freigegeben</td><td>${formatDate(concept.approved_at)}</td></tr>`;
  html += '</table></div>';

  // Verantwortliche
  html += '<div class="content-section"><div class="section-label">VERANTWORTLICHE</div>';
  if (steward) {
    html += renderStakeholderCard(steward.name, 'Data Steward · ' + (steward.department || ''), steward.email);
  } else {
    html += '<p style="color:var(--color-text-secondary);font-size:var(--text-small);">Keine Verantwortlichen zugewiesen.</p>';
  }
  html += '</div>';

  return html;
}

function renderConceptContents(conceptId) {
  const attrs = query(`SELECT ca.*, cl.${nameCol('name')} as code_list_name, cl.id as cl_id
    FROM concept_attribute ca
    LEFT JOIN code_list cl ON ca.code_list_id = cl.id
    WHERE ca.concept_id = ?
    ORDER BY ca.sort_order, ca.${nameCol('name')}`, [conceptId]);

  if (attrs.length === 0) return '<div class="content-section">' + renderEmptyState('list', 'Keine Attribute', 'Diesem Konzept sind noch keine Attribute zugeordnet.') + '</div>';

  let html = '<div class="content-section"><div class="section-label">FIELDS</div>';
  html += '<table class="data-table"><thead><tr>';
  html += '<th scope="col">Name</th><th scope="col">Type</th><th scope="col">Required</th><th scope="col">Code List</th><th scope="col">Description</th>';
  html += '</tr></thead><tbody>';
  attrs.forEach(a => {
    const def = getDefinitionText(a.definition, lang);
    html += `<tr>
      <td class="cell-mono">${escapeHtml(n(a, 'name'))}</td>
      <td class="cell-mono">${escapeHtml(a.value_type)}</td>
      <td>${a.required ? 'Yes' : 'No'}</td>
      <td>${a.cl_id ? '<a href="#/codelists/' + a.cl_id + '">' + escapeHtml(a.code_list_name || '') + '</a>' : '&ndash;'}</td>
      <td>${escapeHtml(def || '')}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

function renderConceptMappings(conceptId) {
  const mappings = query(`SELECT cm.*, f.name as field_name, f.data_type,
    d.name as dataset_name, d.id as dataset_id,
    s.${nameCol('name')} as system_name, s.id as system_id,
    sc.id as schema_id
    FROM concept_mapping cm
    JOIN field f ON cm.field_id = f.id
    JOIN dataset d ON f.dataset_id = d.id
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE cm.concept_id = ?
    ORDER BY s.name_en, d.name`, [conceptId]);

  if (mappings.length === 0) return '<div class="content-section">' + renderEmptyState('link', 'Keine Mappings', 'Es gibt noch keine physischen Felder, die dieses Konzept realisieren.') + '</div>';

  let html = `<div class="content-section"><div class="section-label">MAPPINGS &mdash; ${mappings.length} fields</div>`;
  html += '<table class="data-table"><thead><tr>';
  html += '<th scope="col">Field</th><th scope="col">Dataset / System</th><th scope="col">Match</th><th scope="col">Verified</th>';
  html += '</tr></thead><tbody>';
  mappings.forEach(m => {
    const matchLabel = (m.match_type || '').replace('skos:', '').replace('Match', '');
    html += `<tr>
      <td class="cell-mono">${escapeHtml(m.field_name)}</td>
      <td><a href="#/systems/${m.system_id}/datasets/${m.dataset_id}">${escapeHtml(m.dataset_name)}</a> &middot; ${escapeHtml(m.system_name)}</td>
      <td>${escapeHtml(matchLabel.charAt(0).toUpperCase() + matchLabel.slice(1))}</td>
      <td>${m.verified ? '<span class="verified-check"><i data-lucide="check-circle" style="width:16px;height:16px;"></i></span>' : '<span class="unverified"><i data-lucide="circle" style="width:16px;height:16px;"></i></span>'}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}



function renderConceptRelationships(conceptId) {
  const concept = queryOne("SELECT * FROM concept WHERE id = ?", [conceptId]);

  // Mapped fields → datasets → systems
  const mappings = query(`SELECT cm.match_type, f.name as field_name, f.id as field_id,
    d.name as dataset_name, d.display_name, d.id as dataset_id,
    s.${nameCol('name')} as system_name, s.id as system_id, s.technology_stack
    FROM concept_mapping cm
    JOIN field f ON cm.field_id = f.id
    JOIN dataset d ON f.dataset_id = d.id
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE cm.concept_id = ?`, [conceptId]);

  // Stakeholder (steward)
  const steward = concept.steward_id ? queryOne('SELECT * FROM "user" WHERE id = ?', [concept.steward_id]) : null;

  // Data products linked through mapped datasets
  const datasetIds = [...new Set(mappings.map(m => m.dataset_id))];
  let products = [];
  if (datasetIds.length > 0) {
    const placeholders = datasetIds.map(() => '?').join(',');
    products = query(`SELECT DISTINCT dp.id, dp.${nameCol('name')} as dp_name
      FROM data_product dp
      JOIN data_product_dataset dpd ON dpd.data_product_id = dp.id
      WHERE dpd.dataset_id IN (${placeholders})`, datasetIds);
  }

  // Build satellite groups
  const satellites = [];

  // Begriffe (linked terms)
  const linkedTerms = query(`SELECT t.id, t.${nameCol('name')} as tname, t.standard_ref FROM term t JOIN concept_term ct ON ct.term_id = t.id WHERE ct.concept_id = ?`, [conceptId]);
  if (linkedTerms.length) {
    satellites.push({ title: 'Begriffe', items: linkedTerms.map(t => ({ label: t.tname, href: '#/terms/' + t.id, icon: 'book-open', meta: t.standard_ref ? 'Standard: ' + t.standard_ref : '' })), color: '#2E6EB5' });
  }

  // Codelisten (concept_attribute → code_list)
  const codeLists = query(`SELECT DISTINCT cl.id, cl.${nameCol('name')} as clname FROM concept_attribute ca JOIN code_list cl ON ca.code_list_id = cl.id WHERE ca.concept_id = ?`, [conceptId]);
  if (codeLists.length) {
    satellites.push({ title: 'Codelisten', items: codeLists.map(cl => ({ label: cl.clname, href: '#/codelists/' + cl.id, icon: 'list-ordered', meta: '' })), color: '#0891B2' });
  }

  // Tabellen (datasets)
  const datasets = [];
  const seenDs = new Set();
  mappings.forEach(m => {
    if (!seenDs.has(m.dataset_id)) {
      seenDs.add(m.dataset_id);
      datasets.push({ label: m.display_name || m.dataset_name, href: '#/systems/' + m.system_id + '/datasets/' + m.dataset_id, icon: 'table-2', meta: 'System: ' + m.system_name });
    }
  });
  if (datasets.length) satellites.push({ title: 'Tabellen', items: datasets, color: '#C9820B' });

  // Benutzer
  if (steward) {
    satellites.push({ title: 'Benutzer', items: [{ label: steward.name, icon: 'user', meta: 'Role: Data Steward' }], color: '#1A9E55' });
  }

  // Datensammlungen
  if (products.length) {
    satellites.push({ title: 'Datensammlungen', items: products.map(dp => ({ label: dp.dp_name, href: '#/products/' + dp.id, icon: 'package', meta: '' })), color: '#8B5CF6' });
  }

  if (satellites.length === 0) return '<div class="content-section">' + renderEmptyState('git-branch', 'Keine Beziehungen', 'Dieses Konzept hat noch keine Beziehungen.') + '</div>';
  return renderRelGraph(n(concept, 'name'), satellites);
}

// ============================================================
// Code List Detail
// ============================================================
function renderCodeListDetail(codeListId, tab, main) {
  const cl = queryOne("SELECT * FROM code_list WHERE id = ?", [codeListId]);
  if (!cl) { main.innerHTML = '<p>Code list not found</p>'; return; }

  const clCounts = queryOne("SELECT COUNT(*) as total, SUM(CASE WHEN deprecated = 1 THEN 1 ELSE 0 END) as dep FROM code_list_value WHERE code_list_id = ?", [codeListId]);
  const valueCount = clCounts?.total || 0;
  const deprecatedCount = clCounts?.dep || 0;

  addRecent(n(cl, 'name') || cl.name_en, `#/codelists/${codeListId}`);

  const tabs = ['overview', 'contents', 'mappings', 'relationships', 'history'];
  const tabLabels = { overview: 'Übersicht', contents: 'Werte', mappings: 'Mappings', relationships: 'Relationen', history: 'History' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  // Breadcrumb
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome();
  html += `<a class="breadcrumb-link" href="#/codelists">${SECTION_LABELS.codelists[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<span class="breadcrumb-current">${escapeHtml(n(cl, 'name'))}</span>`;
  html += '</nav>';

  // Title
  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="list-ordered" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(cl, 'name'))}</div>`;
  html += '</div>';
  html += '<div class="title-block-actions">';
  html += ' <button class="header-icon-btn" aria-label="Bearbeiten" title="Bearbeiten"><i data-lucide="pencil" style="width:18px;height:18px;"></i></button>';
  html += ' <button class="header-icon-btn" aria-label="Kommentare" title="Kommentare"><i data-lucide="message-square" style="width:18px;height:18px;"></i></button>';
  html += '</div></div>';

  // Tab bar with ARIA
  html += '<div class="tab-bar" role="tablist">';
  tabs.forEach(t => {
    const isActive = t === tab;
    html += `<button class="tab${isActive ? ' active' : ''}" data-tab="${t}" data-base="#/codelists/${codeListId}" role="tab" aria-selected="${isActive}">${tabLabels[t]}</button>`;
  });
  html += '</div>';

  html += '<div class="tab-content">';
  switch(tab) {
    case 'overview': html += renderCodeListOverview(cl, valueCount, deprecatedCount); break;
    case 'contents': html += renderCodeListContents(codeListId); break;
    case 'mappings': html += renderCodeListMappings(codeListId); break;
    case 'relationships': html += renderCodeListRelationships(codeListId, cl); break;
    case 'history': html += renderHistoryTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderCodeListOverview(cl, valueCount, deprecatedCount) {
  let html = '';

  // Definition
  const def = getDefinitionText(cl.description, lang);
  html += '<div class="content-section"><div class="section-label">DEFINITION</div>';
  html += `<div class="prose">${def ? '<p>' + escapeHtml(def) + '</p>' : '<p style="color:var(--color-text-placeholder);">Keine Definition vorhanden.</p>'}</div></div>`;

  // Derive domain from linked concepts
  const clDomain = queryOne(`SELECT col.${nameCol('name')} as dname FROM concept_attribute ca
    JOIN concept c ON ca.concept_id = c.id
    JOIN collection col ON c.collection_id = col.id
    WHERE ca.code_list_id = ? LIMIT 1`, [cl.id]);
  const clStatus = (valueCount > 0 && deprecatedCount === valueCount) ? 'deprecated' : 'approved';

  // Metadata
  html += '<div class="content-section"><div class="section-label">METADATA</div>';
  html += '<table class="props-table">';
  if (clDomain) html += `<tr><td>Domäne</td><td>${escapeHtml(clDomain.dname)}</td></tr>`;
  html += `<tr><td>Status</td><td>${statusBadge(clStatus)}</td></tr>`;
  if (cl.version) html += `<tr><td>Version</td><td>${escapeHtml(cl.version)}</td></tr>`;
  html += `<tr><td>Werte</td><td>${valueCount} (${valueCount - deprecatedCount} aktiv${deprecatedCount > 0 ? ' &middot; ' + deprecatedCount + ' veraltet' : ''})</td></tr>`;
  if (cl.source_ref) html += `<tr><td>Quelle</td><td>${escapeHtml(cl.source_ref)}</td></tr>`;
  if (cl.concept_id) {
    const concept = queryOne(`SELECT ${nameCol('name')} as cname FROM concept WHERE id = ?`, [cl.concept_id]);
    if (concept) html += `<tr><td>Geschäftsobjekt</td><td><a href="#/vocabulary/${cl.concept_id}">${escapeHtml(concept.cname)}</a></td></tr>`;
  }
  html += '</table></div>';

  // Verantwortliche
  html += '<div class="content-section"><div class="section-label">VERANTWORTLICHE</div>';
  html += '<p style="color:var(--color-text-secondary);font-size:var(--text-small);">Keine Verantwortlichen zugewiesen.</p>';
  html += '</div>';

  return html;
}

function renderCodeListContents(codeListId) {
  const values = query(`SELECT * FROM code_list_value WHERE code_list_id = ? ORDER BY sort_order, code`, [codeListId]);

  if (values.length === 0) return '<div class="content-section">' + renderEmptyState('list-ordered', 'Keine Werte', 'Diese Codeliste enth\u00e4lt noch keine Werte.') + '</div>';

  let html = '<div class="content-section">';
  html += `<div style="margin-bottom:var(--space-3);font-size:var(--text-small);color:var(--color-text-secondary);">
    ${values.length} Werte
  </div>`;

  html += '<table class="data-table"><colgroup><col style="width:20%"><col style="width:30%"><col style="width:50%"></colgroup><thead><tr>';
  html += '<th scope="col">Code</th><th scope="col">Bezeichnung</th><th scope="col">Beschreibung</th>';
  html += '</tr></thead><tbody>';
  values.forEach(v => {
    const isDeprecated = v.deprecated === 1;
    const style = isDeprecated ? ' style="color:var(--color-text-placeholder);font-style:italic;"' : '';
    const label = v['label_' + lang] || v.label_de || v.label_en || '';
    const desc = getDefinitionText(v.description, lang);
    html += `<tr${style}>
      <td class="cell-mono">${escapeHtml(v.code)}</td>
      <td>${escapeHtml(label)}</td>
      <td>${desc ? escapeHtml(desc) : '&ndash;'}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

function renderCodeListMappings(codeListId) {
  // Concept attributes using this code list
  const attrs = query(`SELECT ca.*, c.${nameCol('name')} as concept_name, c.id as concept_id
    FROM concept_attribute ca
    JOIN concept c ON ca.concept_id = c.id
    WHERE ca.code_list_id = ?`, [codeListId]);

  let html = '<div class="content-section">';
  if (attrs.length > 0) {
    html += '<div class="section-label">USED BY CONCEPTS</div>';
    html += '<table class="data-table"><thead><tr><th scope="col">Concept</th><th scope="col">Attribute</th></tr></thead><tbody>';
    attrs.forEach(a => {
      html += `<tr>
        <td><a href="#/vocabulary/${a.concept_id}">${escapeHtml(a.concept_name)}</a></td>
        <td>${escapeHtml(n(a, 'name'))}</td>
      </tr>`;
    });
    html += '</tbody></table>';
  }

  if (attrs.length === 0) {
    html += renderEmptyState('link', 'Keine Mappings', 'Diese Codeliste wird von keinem Konzeptattribut referenziert.');
  }
  html += '</div>';
  return html;
}

// ============================================================
// System Detail
// ============================================================
function renderSystemDetail(systemId, tab, main) {
  const sys = queryOne("SELECT s.*, c.name as owner_name, c.organisation as owner_org, c.email as owner_email FROM system s LEFT JOIN contact c ON s.owner_id = c.id WHERE s.id = ?", [systemId]);
  if (!sys) { main.innerHTML = '<p>System not found</p>'; return; }

  const schemas = query("SELECT * FROM schema_ WHERE system_id = ? ORDER BY name", [systemId]);
  const datasetCount = query("SELECT COUNT(*) as c FROM dataset d JOIN schema_ sc ON d.schema_id = sc.id WHERE sc.system_id = ?", [systemId])[0]?.c || 0;

  addRecent(n(sys, 'name') || sys.name_en, `#/systems/${systemId}`);

  const tabs = ['overview', 'contents', 'relationships', 'stakeholders', 'history'];
  const tabLabels = { overview: 'Übersicht', contents: 'Tabellen', relationships: 'Relationen', stakeholders: 'Verantwortliche', history: 'History' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome();
  html += `<a class="breadcrumb-link" href="#/systems">${SECTION_LABELS.systems[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<span class="breadcrumb-current">${escapeHtml(n(sys, 'name'))}</span>`;
  html += '</nav>';

  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="database" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(sys, 'name'))}</div>`;
  html += '</div>';
  html += '<div class="title-block-actions">';
  html += ' <button class="header-icon-btn" aria-label="Bearbeiten" title="Bearbeiten"><i data-lucide="pencil" style="width:18px;height:18px;"></i></button>';
  html += ' <button class="header-icon-btn" aria-label="Kommentare" title="Kommentare"><i data-lucide="message-square" style="width:18px;height:18px;"></i></button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="tab-bar" role="tablist">';
  tabs.forEach(t => {
    const isActive = t === tab;
    html += `<button class="tab${isActive ? ' active' : ''}" data-tab="${t}" data-base="#/systems/${systemId}" role="tab" aria-selected="${isActive}">${tabLabels[t]}</button>`;
  });
  html += '</div>';

  html += '<div class="tab-content">';
  switch(tab) {
    case 'overview': html += renderSystemOverview(sys, schemas, datasetCount); break;
    case 'contents': html += renderSystemContents(systemId, schemas); break;
    case 'relationships': html += renderSystemRelationships(systemId, sys); break;
    case 'stakeholders': html += renderSystemStakeholders(sys); break;
    case 'history': html += renderHistoryTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderSystemOverview(sys, schemas, datasetCount) {
  let html = '';

  // Definition
  const desc = getDefinitionText(sys.description, lang);
  html += '<div class="content-section"><div class="section-label">DEFINITION</div>';
  html += `<div class="prose">${desc ? '<p>' + escapeHtml(desc) + '</p>' : '<p style="color:var(--color-text-placeholder);">Keine Beschreibung vorhanden.</p>'}</div></div>`;

  // Metadata
  html += '<div class="content-section"><div class="section-label">METADATA</div>';
  html += '<table class="props-table">';
  html += `<tr><td>Status</td><td>${sys.active ? statusBadge('approved') : statusBadge('deprecated')}</td></tr>`;
  if (sys.technology_stack) html += `<tr><td>Technologie</td><td>${escapeHtml(sys.technology_stack)}</td></tr>`;
  html += `<tr><td>Tabellen</td><td>${datasetCount}</td></tr>`;
  html += `<tr><td>Erstellt</td><td>${formatDate(sys.created_at)}</td></tr>`;
  if (sys.last_scanned_at) html += `<tr><td>Letzter Scan</td><td>${formatDate(sys.last_scanned_at)}</td></tr>`;
  html += '</table></div>';

  // Verantwortliche (owner)
  html += '<div class="content-section"><div class="section-label">VERANTWORTLICHE</div>';
  if (sys.owner_name) {
    html += renderStakeholderCard(sys.owner_name, sys.owner_org || '', sys.owner_email);
  } else {
    html += '<p style="color:var(--color-text-secondary);font-size:var(--text-small);">Keine Verantwortlichen zugewiesen.</p>';
  }
  html += '</div>';

  return html;
}

function renderSystemContents(systemId, schemas) {
  // Flat list of all datasets across all schemas
  const datasets = query(`SELECT d.*,
    sc.name as schema_name, sc.display_name as schema_display_name,
    COALESCE(fc.field_count, 0) as field_count
    FROM dataset d
    JOIN schema_ sc ON d.schema_id = sc.id
    LEFT JOIN (SELECT dataset_id, COUNT(*) as field_count FROM field GROUP BY dataset_id) fc ON fc.dataset_id = d.id
    WHERE sc.system_id = ?
    ORDER BY d.name`, [systemId]);

  if (datasets.length === 0) {
    return '<div class="content-section">' + renderEmptyState('table-2', 'Keine Tabellen', 'Diesem System sind noch keine Tabellen zugeordnet.') + '</div>';
  }

  let html = '<div class="content-section">';
  html += '<table class="data-table"><colgroup><col style="width:30%"><col style="width:30%"><col style="width:15%"><col style="width:10%"><col style="width:15%"></colgroup><thead><tr>';
  html += '<th scope="col">Name</th><th scope="col">Beschreibung</th><th scope="col">Typ</th><th scope="col">Felder</th><th scope="col">Status</th>';
  html += '</tr></thead><tbody>';
  datasets.forEach(d => {
    const desc = getDefinitionText(d.description, lang);
    html += `<tr class="clickable-row" data-href="#/systems/${systemId}/datasets/${d.id}">
      <td>${escapeHtml(d.display_name || d.name)}</td>
      <td>${desc ? escapeHtml(desc.substring(0, 80)) + (desc.length > 80 ? '...' : '') : '&ndash;'}</td>
      <td>${escapeHtml(d.dataset_type)}</td>
      <td>${d.field_count}</td>
      <td>${certifiedBadge(d.certified)}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

function renderSystemStakeholders(sys) {
  // System role groups per wireframe: Data Owner, Data Custodian
  const roleDescs = {
    data_owner: { label: 'Dateneigent\u00fcmer', desc: 'Accountable for existence, quality standards, and use of this data.' },
    data_custodian: { label: 'Datenbetreuer', desc: 'Technically operates the system: access management, backup, availability.' }
  };

  let html = '<div class="content-section"><div class="section-label">STAKEHOLDERS</div>';

  // Data Owner
  html += `<div class="stakeholder-section">
    <div class="stakeholder-role-title">${roleDescs.data_owner.label}</div>
    <div class="stakeholder-role-desc">${roleDescs.data_owner.desc}</div>`;
  if (sys.owner_name) {
    html += renderStakeholderCard(sys.owner_name, sys.owner_org, sys.owner_email);
  } else {
    html += `<div style="font-size:var(--text-small);color:var(--color-text-placeholder);padding:var(--space-3) 0;">Kein(e) ${roleDescs.data_owner.label} zugewiesen</div>`;
  }
  html += '</div>';

  // Data Custodian
  html += `<div class="stakeholder-section">
    <div class="stakeholder-role-title">${roleDescs.data_custodian.label}</div>
    <div class="stakeholder-role-desc">${roleDescs.data_custodian.desc}</div>
    <div style="font-size:var(--text-small);color:var(--color-text-placeholder);padding:var(--space-3) 0;">Kein(e) ${roleDescs.data_custodian.label} zugewiesen</div>
  </div>`;

  html += '</div>';
  return html;
}

// ============================================================
// Dataset Detail
// ============================================================
function renderDatasetDetail(datasetId, systemId) {
  const ds = queryOne(`SELECT d.*, sc.name as schema_name, sc.display_name as schema_display_name,
    sc.system_id, s.${nameCol('name')} as system_name
    FROM dataset d
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE d.id = ?`, [datasetId]);
  if (!ds) { document.getElementById('main-content').innerHTML = '<p>Dataset not found</p>'; return; }

  const fieldCount = query("SELECT COUNT(*) as c FROM field WHERE dataset_id = ?", [datasetId])[0]?.c || 0;
  const mappingCount = query(`SELECT COUNT(DISTINCT cm.concept_id) as c FROM concept_mapping cm
    JOIN field f ON cm.field_id = f.id WHERE f.dataset_id = ?`, [datasetId])[0]?.c || 0;
  const hasContacts = query("SELECT COUNT(*) as c FROM dataset_contact WHERE dataset_id = ?", [datasetId])[0]?.c > 0;

  // Classification
  const classification = queryOne(`SELECT dc.* FROM data_classification dc
    JOIN dataset_classification dsc ON dc.id = dsc.classification_id
    WHERE dsc.dataset_id = ?`, [datasetId]);

  addRecent((ds.display_name || ds.name), `#/systems/${ds.system_id}/datasets/${datasetId}`);

  // Check if access-restricted
  const restricted = classification && classification.sensitivity_level >= 2;

  const tab = currentTab || 'overview';
  const tabs = ['overview', 'contents', 'lineage', 'quality', 'relationships', 'stakeholders', 'history'];

  const tabLabels = { overview: 'Übersicht', contents: 'Inhalt', lineage: 'Lineage', quality: 'Datenqualität', relationships: 'Relationen', stakeholders: 'Verantwortliche', history: 'History' };
  if (!tabs.includes(currentTab)) currentTab = 'overview';

  const main = document.getElementById('main-content');
  let html = '<div class="content-wrapper"><article>';

  // Breadcrumb
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome();
  html += `<a class="breadcrumb-link" href="#/systems">${SECTION_LABELS.systems[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<a class="breadcrumb-link" href="#/systems/${ds.system_id}">${escapeHtml(ds.system_name)}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<span class="breadcrumb-current">${escapeHtml(ds.display_name || ds.name)}</span>`;
  html += '</nav>';

  // Title
  html += '<div class="title-block">';
  html += `<div class="title-block-icon"><i data-lucide="${restricted ? 'lock' : 'table-2'}" style="width:24px;height:24px;"></i></div>`;
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name${restricted ? ' locked-name' : ''}">${escapeHtml(ds.display_name || ds.name)}${restricted ? '<span class="locked-icon"><i data-lucide="lock" style="width:16px;height:16px;"></i></span>' : ''}</div>`;
  html += '</div>';
  html += '<div class="title-block-actions">';
  html += ' <button class="header-icon-btn" aria-label="Bearbeiten" title="Bearbeiten"><i data-lucide="pencil" style="width:18px;height:18px;"></i></button>';
  html += ' <button class="header-icon-btn" aria-label="Kommentare" title="Kommentare"><i data-lucide="message-square" style="width:18px;height:18px;"></i></button>';
  html += '</div>';
  html += '</div>';

  if (restricted) {
    // Access-restricted: show locked content message instead of tabs
    html += renderLockedContent();
    html += '</article></div>';
    main.innerHTML = html;
    return;
  }

  // Tab bar with ARIA
  html += '<div class="tab-bar" role="tablist">';
  tabs.forEach(t => {
    const isActive = t === currentTab;
    html += `<button class="tab${isActive ? ' active' : ''}" data-tab="${t}" data-base="#/systems/${ds.system_id}/datasets/${datasetId}" role="tab" aria-selected="${isActive}">${tabLabels[t]}</button>`;
  });
  html += '</div>';

  html += '<div class="tab-content">';
  switch(currentTab) {
    case 'overview': html += renderDatasetOverview(ds, fieldCount, mappingCount, classification); break;
    case 'contents': html += renderDatasetContents(datasetId); break;
    case 'lineage': html += renderDatasetLineage(datasetId, ds); break;
    case 'quality': html += renderDatasetQuality(datasetId); break;
    case 'relationships': html += renderDatasetRelationships(datasetId, ds); break;
    case 'stakeholders': html += renderDatasetStakeholders(datasetId); break;
    case 'history': html += renderHistoryTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderDatasetOverview(ds, fieldCount, mappingCount, classification) {
  let html = '';

  // Definition
  const desc = getDefinitionText(ds.description, lang);
  html += '<div class="content-section"><div class="section-label">DEFINITION</div>';
  html += `<div class="prose">${desc ? '<p>' + escapeHtml(desc) + '</p>' : '<p style="color:var(--color-text-placeholder);">Keine Beschreibung vorhanden.</p>'}</div></div>`;

  // Metadata
  html += '<div class="content-section"><div class="section-label">METADATA</div>';
  html += '<table class="props-table">';
  html += `<tr><td>Status</td><td>${certifiedBadge(ds.certified)}</td></tr>`;
  html += `<tr><td>System</td><td>${escapeHtml(ds.system_name)}</td></tr>`;
  html += `<tr><td>Typ</td><td>${escapeHtml(ds.dataset_type)}</td></tr>`;
  if (ds.row_count_approx) html += `<tr><td>Datensätze (ca.)</td><td>${formatNumber(ds.row_count_approx)}</td></tr>`;
  html += `<tr><td>Felder</td><td>${fieldCount}</td></tr>`;
  if (classification) {
    html += `<tr><td>Klassifizierung</td><td>${classificationBadge(classification)}</td></tr>`;
  }
  html += `<tr><td>Erstellt</td><td>${formatDate(ds.created_at)}</td></tr>`;
  html += `<tr><td>Geändert</td><td>${formatDate(ds.modified_at)}</td></tr>`;
  html += '</table></div>';

  // Linked concepts
  if (mappingCount > 0) {
    html += '<div class="content-section"><div class="section-label">VERKNÜPFTE GESCHÄFTSOBJEKTE</div>';
    const concepts = query(`SELECT DISTINCT c.id, c.${nameCol('name')} as cname
      FROM concept c
      JOIN concept_mapping cm ON cm.concept_id = c.id
      JOIN field f ON cm.field_id = f.id
      WHERE f.dataset_id = ?`, [ds.id]);
    html += '<div class="domain-group-concepts">';
    concepts.forEach(c => {
      html += `<a class="concept-box" href="#/vocabulary/${c.id}">${escapeHtml(c.cname)}</a>`;
    });
    html += '</div></div>';
  }
  return html;
}

function renderDatasetContents(datasetId) {
  const fields = query(`SELECT f.*,
    (SELECT GROUP_CONCAT(c.${nameCol('name')}, ', ') FROM concept_mapping cm JOIN concept c ON cm.concept_id = c.id WHERE cm.field_id = f.id) as mapped_concepts
    FROM field f WHERE f.dataset_id = ? ORDER BY f.sort_order, f.name`, [datasetId]);

  if (fields.length === 0) return '<div class="content-section">' + renderEmptyState('table-2', 'Keine Felder', 'Diesem Dataset sind noch keine Felder zugeordnet.') + '</div>';

  let html = '<div class="content-section"><div class="section-label">FIELDS</div>';
  html += '<table class="data-table"><thead><tr>';
  html += '<th scope="col">Name</th><th scope="col">Typ</th><th scope="col">Nullable</th><th scope="col">Key</th><th scope="col">Geschäftsobjekte</th>';
  html += '</tr></thead><tbody>';
  fields.forEach(f => {
    let keyLabel = '&ndash;';
    if (f.is_primary_key) keyLabel = 'PK';
    else if (f.is_foreign_key) keyLabel = 'FK';
    html += `<tr>
      <td class="cell-mono">${escapeHtml(f.name)}</td>
      <td class="cell-mono">${escapeHtml(f.data_type)}</td>
      <td>${f.nullable ? 'Yes' : 'No'}</td>
      <td>${keyLabel}</td>
      <td>${f.mapped_concepts ? escapeHtml(f.mapped_concepts) : '&ndash;'}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

function renderDatasetLineage(datasetId, ds) {
  const upstream = query(`SELECT ll.*, d.name as ds_name, d.display_name, d.id as ds_id,
    s.${nameCol('name')} as sys_name
    FROM lineage_link ll
    JOIN dataset d ON ll.source_dataset_id = d.id
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE ll.target_dataset_id = ?`, [datasetId]);

  const downstream = query(`SELECT ll.*, d.name as ds_name, d.display_name, d.id as ds_id,
    s.${nameCol('name')} as sys_name, sc.system_id as sys_id
    FROM lineage_link ll
    JOIN dataset d ON ll.target_dataset_id = d.id
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE ll.source_dataset_id = ?`, [datasetId]);

  let html = '<div class="content-section"><div class="section-label">LINEAGE</div>';
  html += '<div class="lineage-tree-visual">';

  // Upstream section
  html += '<div class="lineage-section">';
  html += '<h4>Upstream (Quellen)</h4>';
  if (upstream.length === 0) {
    html += `<div style="padding:var(--space-3);font-size:var(--text-body);color:var(--color-text-secondary);">${escapeHtml(ds.display_name || ds.name)} ist eine Prim\u00e4rquelle ohne Upstream-Abh\u00e4ngigkeiten</div>`;
  } else {
    upstream.forEach(u => {
      html += `<div class="lineage-node-item" data-href="#/systems/${ds.system_id}/datasets/${u.ds_id}">
        <i data-lucide="database" class="lineage-node-icon" style="width:16px;height:16px;"></i>
        <span class="lineage-node-name">${escapeHtml(u.display_name || u.ds_name)}</span>
        <span class="lineage-node-meta">${escapeHtml(u.sys_name)}${u.tool_name ? ' &middot; ' + escapeHtml(u.tool_name) : ''}${u.frequency ? ' &middot; ' + escapeHtml(u.frequency) : ''}</span>
      </div>`;
    });
  }
  html += '</div>';

  // Current node
  html += `<div class="lineage-current-node">
    <i data-lucide="table-2" style="width:16px;height:16px;"></i>
    ${escapeHtml(ds.display_name || ds.name)}
  </div>`;

  // Downstream section
  html += '<div class="lineage-section">';
  html += '<h4>Downstream (Abgeleitet)</h4>';
  if (downstream.length === 0) {
    html += '<div style="padding:var(--space-3);font-size:var(--text-body);color:var(--color-text-secondary);">Keine abgeleiteten Datasets</div>';
  } else {
    downstream.forEach(d => {
      html += `<div class="lineage-node-item" data-href="#/systems/${d.sys_id}/datasets/${d.ds_id}">
        <i data-lucide="database" class="lineage-node-icon" style="width:16px;height:16px;"></i>
        <span class="lineage-node-name">${escapeHtml(d.display_name || d.ds_name)}</span>
        <span class="lineage-node-meta">${escapeHtml(d.sys_name)}${d.tool_name ? ' &middot; ' + escapeHtml(d.tool_name) : ''}${d.frequency ? ' &middot; ' + escapeHtml(d.frequency) : ''}</span>
      </div>`;
    });
  }
  html += '</div></div></div>';
  return html;
}

function renderDatasetQuality(datasetId) {
  const profile = queryOne("SELECT * FROM data_profile WHERE dataset_id = ? ORDER BY profiled_at DESC LIMIT 1", [datasetId]);

  const dimensions = [
    { key: 'completeness', icon: 'check-circle', label: 'Vollständigkeit', desc: 'Anteil der befüllten Pflichtfelder am Gesamtbestand.', score: profile?.completeness_score },
    { key: 'timeliness', icon: 'clock', label: 'Aktualität', desc: 'Alter der Daten im Vergleich zum erwarteten Aktualisierungszyklus.', score: null },
    { key: 'accuracy', icon: 'target', label: 'Genauigkeit', desc: 'Übereinstimmung der Werte mit autoritativen Quellen (z.\u00a0B. GWR, Grundbuch).', score: null },
    { key: 'consistency', icon: 'git-compare', label: 'Konsistenz', desc: 'Systemübergreifende Übereinstimmung (z.\u00a0B. gleiche EGID = gleiche Adresse).', score: null },
    { key: 'validity', icon: 'shield-check', label: 'Formatkonformität', desc: 'Anteil der Werte, die dem erwarteten Format, Wertebereich oder der Codeliste entsprechen.', score: profile?.format_validity_score },
    { key: 'uniqueness', icon: 'fingerprint', label: 'Eindeutigkeit', desc: 'Anteil der Datensätze ohne unbeabsichtigte Duplikate.', score: null }
  ];

  let html = '<div class="content-section"><div class="section-label">DATENQUALITÄT</div>';

  if (profile) {
    html += `<div style="font-size:var(--text-small);color:var(--color-text-secondary);margin-bottom:var(--space-4);">
      Letztes Profiling: ${formatDate(profile.profiled_at)}${profile.profiler ? ' &middot; ' + escapeHtml(profile.profiler) : ''}
      ${profile.row_count ? ' &middot; ' + formatNumber(profile.row_count) + ' Datensätze' : ''}
    </div>`;
  }

  html += '<div class="dq-grid">';
  dimensions.forEach(d => {
    const hasScore = d.score != null;
    const pct = hasScore ? Math.round(d.score * 100) : null;
    const scoreColor = hasScore ? (pct >= 80 ? 'var(--color-quality-complete)' : pct >= 50 ? 'var(--color-quality-null)' : 'var(--color-status-error, #DC0018)') : null;

    html += '<div class="dq-card">';
    html += `<div class="dq-card-header">`;
    html += `<i data-lucide="${d.icon}" style="width:18px;height:18px;color:var(--color-text-secondary);"></i>`;
    html += `<span class="dq-card-title">${d.label}</span>`;
    html += '</div>';
    html += `<div class="dq-card-desc">${d.desc}</div>`;

    if (hasScore) {
      html += `<div class="dq-card-score" style="color:${scoreColor};">${pct}%</div>`;
      html += `<div class="quality-bar"><div class="quality-bar-fill-complete" style="width:${pct}%;background:${scoreColor};"></div></div>`;
    } else {
      html += '<div class="dq-card-score dq-card-score--empty">&ndash;</div>';
      html += '<div class="quality-bar"></div>';
      html += '<div class="dq-card-empty">Noch nicht gemessen</div>';
    }

    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

function renderDatasetStakeholders(datasetId) {
  const contacts = query(`SELECT c.*, dc.role FROM dataset_contact dc JOIN contact c ON dc.contact_id = c.id WHERE dc.dataset_id = ?`, [datasetId]);

  // Dataset role groups per wireframe: Data Owner, Data Steward, Data Custodian, Subject Matter Expert
  const roleDescs = {
    data_owner: { label: 'Dateneigent\u00fcmer', desc: 'Accountable for existence, quality standards, and use of this data.' },
    data_steward: { label: 'Datenverantwortliche', desc: 'Maintains the catalog entry, enforces standards, approves mappings.' },
    data_custodian: { label: 'Datenbetreuer', desc: 'Technically operates the system: access management, backup, availability.' },
    subject_matter_expert: { label: 'Fachexperte', desc: 'Provides domain knowledge about the data\'s meaning and edge cases.' },
  };

  let html = '<div class="content-section"><div class="section-label">STAKEHOLDERS</div>';

  // Group by role
  const byRole = {};
  contacts.forEach(c => {
    if (!byRole[c.role]) byRole[c.role] = [];
    byRole[c.role].push(c);
  });

  Object.keys(roleDescs).forEach(role => {
    const rd = roleDescs[role];
    // Skip roles that have no contacts assigned
    html += `<div class="stakeholder-section">
      <div class="stakeholder-role-title">${rd.label}</div>
      <div class="stakeholder-role-desc">${rd.desc}</div>`;
    if (byRole[role]) {
      byRole[role].forEach(c => {
        html += renderStakeholderCard(c.name, c.organisation, c.email);
      });
    } else {
      html += `<div style="font-size:var(--text-small);color:var(--color-text-placeholder);padding:var(--space-3) 0;">Kein(e) ${rd.label} zugewiesen</div>`;
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ============================================================
// Data Product Detail
// ============================================================
function renderProductDetail(productId, tab, main) {
  const dp = queryOne("SELECT * FROM data_product WHERE id = ?", [productId]);
  if (!dp) { main.innerHTML = '<p>Data product not found</p>'; return; }

  const distCount = query("SELECT COUNT(*) as c FROM distribution WHERE data_product_id = ?", [productId])[0]?.c || 0;
  const hasContacts = query("SELECT COUNT(*) as c FROM data_product_contact WHERE data_product_id = ?", [productId])[0]?.c > 0;

  addRecent(n(dp, 'name') || dp.name_en, `#/products/${productId}`);

  const tabs = ['overview', 'contents', 'lineage', 'relationships', 'stakeholders', 'history'];

  const tabLabels = { overview: 'Übersicht', contents: 'Inhalt', lineage: 'Lineage', relationships: 'Relationen', stakeholders: 'Verantwortliche', history: 'History' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome();
  html += `<a class="breadcrumb-link" href="#/products">${SECTION_LABELS.products[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<span class="breadcrumb-current">${escapeHtml(n(dp, 'name'))}</span>`;
  html += '</nav>';

  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="package" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(dp, 'name'))}</div>`;
  html += '</div>';
  html += '<div class="title-block-actions">';
  html += ' <button class="header-icon-btn" aria-label="Bearbeiten" title="Bearbeiten"><i data-lucide="pencil" style="width:18px;height:18px;"></i></button>';
  html += ' <button class="header-icon-btn" aria-label="Kommentare" title="Kommentare"><i data-lucide="message-square" style="width:18px;height:18px;"></i></button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="tab-bar" role="tablist">';
  tabs.forEach(t => {
    const isActive = t === tab;
    html += `<button class="tab${isActive ? ' active' : ''}" data-tab="${t}" data-base="#/products/${productId}" role="tab" aria-selected="${isActive}">${tabLabels[t]}</button>`;
  });
  html += '</div>';

  html += '<div class="tab-content">';
  switch(tab) {
    case 'overview': html += renderProductOverview(dp); break;
    case 'contents': html += renderProductContents(productId); break;
    case 'lineage': html += renderProductLineage(productId); break;
    case 'relationships': html += renderProductRelationships(productId, dp); break;
    case 'stakeholders': html += renderProductStakeholders(productId); break;
    case 'history': html += renderHistoryTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderProductOverview(dp) {
  let html = '';

  // Definition
  const desc = getDefinitionText(dp.description, lang);
  html += '<div class="content-section"><div class="section-label">DEFINITION</div>';
  html += `<div class="prose">${desc ? '<p>' + escapeHtml(desc) + '</p>' : '<p style="color:var(--color-text-placeholder);">Keine Beschreibung vorhanden.</p>'}</div></div>`;

  // Metadata
  html += '<div class="content-section"><div class="section-label">METADATA</div>';
  html += '<table class="props-table">';
  html += `<tr><td>Status</td><td>${certifiedBadge(dp.certified)}</td></tr>`;
  if (dp.publisher) html += `<tr><td>Herausgeber</td><td>${escapeHtml(dp.publisher)}</td></tr>`;
  if (dp.update_frequency) html += `<tr><td>Aktualisierung</td><td>${escapeHtml(dp.update_frequency)}</td></tr>`;
  if (dp.license) html += `<tr><td>Lizenz</td><td>${escapeHtml(dp.license)}</td></tr>`;
  if (dp.issued) html += `<tr><td>Erstellt</td><td>${formatDate(dp.issued)}</td></tr>`;
  if (dp.modified) html += `<tr><td>Geändert</td><td>${formatDate(dp.modified)}</td></tr>`;
  html += '</table></div>';

  // Distributions summary
  const dists = query("SELECT * FROM distribution WHERE data_product_id = ? ORDER BY name_en", [dp.id]);
  if (dists.length > 0) {
    html += '<div class="content-section"><div class="section-label">DISTRIBUTIONEN</div>';
    dists.forEach(d => {
      const icon = d.access_type === 'rest_api' || d.access_type === 'odata' ? 'link-2' :
                   d.access_type === 'file_export' ? 'file' : 'share-2';
      html += `<div class="distribution-item">
        <div class="distribution-icon"><i data-lucide="${icon}" style="width:16px;height:16px;"></i></div>
        <div>
          <div class="distribution-name">${escapeHtml(n(d, 'name'))}</div>
          <div class="distribution-url">${escapeHtml(d.access_url || '')}</div>
          <div class="distribution-meta">${escapeHtml(d.access_type || '')}${d.format ? ' &middot; ' + escapeHtml(d.format) : ''}${d.availability ? ' &middot; ' + escapeHtml(d.availability) : ''}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  return html;
}

function renderProductContents(productId) {
  const dists = query("SELECT * FROM distribution WHERE data_product_id = ? ORDER BY name_en", [productId]);
  if (dists.length === 0) return '<div class="content-section">' + renderEmptyState('share-2', 'Keine Distributionen', 'Diesem Datenprodukt sind noch keine Distributionen zugeordnet.') + '</div>';

  let html = '<div class="content-section"><div class="section-label">DISTRIBUTIONS</div>';
  html += '<table class="data-table"><thead><tr>';
  html += '<th scope="col">Name</th><th scope="col">Type</th><th scope="col">Format</th><th scope="col">URL</th><th scope="col">Availability</th>';
  html += '</tr></thead><tbody>';
  dists.forEach(d => {
    html += `<tr>
      <td>${escapeHtml(n(d, 'name'))}</td>
      <td>${escapeHtml(d.access_type || '')}</td>
      <td>${escapeHtml(d.format || '')}</td>
      <td><a href="${escapeHtml(d.access_url || '#')}" target="_blank">${escapeHtml(d.access_url || '')}</a></td>
      <td>${escapeHtml(d.availability || '')}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

function renderProductLineage(productId) {
  const sources = query(`SELECT d.*, s.${nameCol('name')} as sys_name, sc.system_id as sys_id
    FROM data_product_dataset dpd
    JOIN dataset d ON dpd.dataset_id = d.id
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE dpd.data_product_id = ?`, [productId]);

  if (sources.length === 0) return '<div class="content-section">' + renderEmptyState('git-branch', 'Keine Quelldatasets', 'Diesem Datenprodukt sind noch keine Quelldatasets zugeordnet.') + '</div>';

  let html = '<div class="content-section"><div class="section-label">SOURCE DATASETS</div>';
  html += '<table class="data-table"><thead><tr>';
  html += '<th scope="col">Dataset</th><th scope="col">System</th><th scope="col">Type</th>';
  html += '</tr></thead><tbody>';
  sources.forEach(s => {
    html += `<tr class="clickable-row" data-href="#/systems/${s.sys_id}/datasets/${s.id}">
      <td>${escapeHtml(s.display_name || s.name)}</td>
      <td>${escapeHtml(s.sys_name)}</td>
      <td>${escapeHtml(s.dataset_type)}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

function renderProductStakeholders(productId) {
  const contacts = query(`SELECT c.*, dpc.role FROM data_product_contact dpc JOIN contact c ON dpc.contact_id = c.id WHERE dpc.data_product_id = ?`, [productId]);

  // Data Product role groups per wireframe: Data Owner, Data Steward, Publisher
  const roleDescs = {
    data_owner: { label: 'Dateneigent\u00fcmer', desc: 'Accountable for existence, quality standards, and use of this data.' },
    data_steward: { label: 'Datenverantwortliche', desc: 'Maintains the catalog entry, enforces standards, approves mappings.' },
    publisher: { label: 'Herausgeber', desc: 'Publishes and distributes the data product.' },
  };

  let html = '<div class="content-section"><div class="section-label">STAKEHOLDERS</div>';

  const byRole = {};
  contacts.forEach(c => {
    if (!byRole[c.role]) byRole[c.role] = [];
    byRole[c.role].push(c);
  });

  Object.keys(roleDescs).forEach(role => {
    const rd = roleDescs[role];
    html += `<div class="stakeholder-section">
      <div class="stakeholder-role-title">${rd.label}</div>
      <div class="stakeholder-role-desc">${rd.desc}</div>`;
    if (byRole[role]) {
      byRole[role].forEach(c => {
        html += renderStakeholderCard(c.name, c.organisation, c.email);
      });
    } else {
      html += `<div style="font-size:var(--text-small);color:var(--color-text-placeholder);padding:var(--space-3) 0;">Kein(e) ${rd.label} zugewiesen</div>`;
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ============================================================
// Search
// ============================================================

function renderTermDetail(termId, tab, main) {
  const term = queryOne("SELECT * FROM term WHERE id = ?", [termId]);
  if (!term) { main.innerHTML = '<p>Begriff nicht gefunden</p>'; return; }
  addRecent(n(term, 'name') || term.name_de, '#/terms/' + termId);

  const tabs = ['overview', 'relationships', 'history'];
  const tabLabels = { overview: 'Übersicht', relationships: 'Relationen', history: 'History' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome();
  html += `<a class="breadcrumb-link" href="#/terms">${SECTION_LABELS.terms[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<span class="breadcrumb-current">${escapeHtml(n(term, 'name'))}</span>`;
  html += '</nav>';

  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="book-open" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(term, 'name'))}</div>`;
  html += '</div>';
  html += '<div class="title-block-actions">';
  html += ' <button class="header-icon-btn" aria-label="Bearbeiten" title="Bearbeiten"><i data-lucide="pencil" style="width:18px;height:18px;"></i></button>';
  html += ' <button class="header-icon-btn" aria-label="Kommentare" title="Kommentare"><i data-lucide="message-square" style="width:18px;height:18px;"></i></button>';
  html += '</div></div>';

  // Tab bar
  html += '<div class="tab-bar" role="tablist">';
  tabs.forEach(t => {
    const isActive = t === tab;
    html += `<button class="tab${isActive ? ' active' : ''}" data-tab="${t}" data-base="#/terms/${termId}" role="tab" aria-selected="${isActive}">${tabLabels[t]}</button>`;
  });
  html += '</div>';

  html += '<div class="tab-content">';
  switch(tab) {
    case 'overview': html += renderTermOverview(term); break;
    case 'relationships': html += renderTermRelationships(termId, term); break;
    case 'history': html += renderHistoryTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderTermOverview(term) {
  let html = '';
  const def = getDefinitionText(term.definition, lang);
  html += '<div class="content-section"><div class="section-label">DEFINITION</div>';
  html += `<div class="prose">${def ? '<p>' + escapeHtml(def) + '</p>' : '<p style="color:var(--color-text-placeholder);">Keine Definition vorhanden.</p>'}</div></div>`;

  // Derive domain from linked concepts
  const termDomain = queryOne(`SELECT col.${nameCol('name')} as dname FROM concept_term ct
    JOIN concept c ON ct.concept_id = c.id
    JOIN collection col ON c.collection_id = col.id
    WHERE ct.term_id = ? LIMIT 1`, [term.id]);

  const sourceLabels = { standard: 'Standard', law: 'Gesetz', regulation: 'Verordnung', norm: 'Norm' };
  html += '<div class="content-section"><div class="section-label">METADATA</div>';
  html += '<table class="props-table">';
  if (termDomain) html += `<tr><td>Domäne</td><td>${escapeHtml(termDomain.dname)}</td></tr>`;
  html += `<tr><td>Status</td><td>${statusBadge(term.status)}</td></tr>`;
  html += `<tr><td>Erstellt</td><td>${formatDate(term.created_at)}</td></tr>`;
  html += `<tr><td>Geändert</td><td>${formatDate(term.modified_at)}</td></tr>`;
  html += `<tr><td>Quellentyp</td><td>${escapeHtml(sourceLabels[term.source_type] || term.source_type)}</td></tr>`;
  if (term.standard_ref) html += `<tr><td>Standard</td><td>${escapeHtml(term.standard_ref)}</td></tr>`;
  if (term.source_document) html += `<tr><td>Quelldokument</td><td>${escapeHtml(term.source_document)}</td></tr>`;
  html += '</table></div>';

  // Linked concepts
  const linkedConcepts = query(`SELECT c.id, c.${nameCol('name')} as cname FROM concept c JOIN concept_term ct ON ct.concept_id = c.id WHERE ct.term_id = ?`, [term.id]);
  if (linkedConcepts.length > 0) {
    html += '<div class="content-section"><div class="section-label">VERKNÜPFTE GESCHÄFTSOBJEKTE</div>';
    html += '<div class="domain-group-concepts">';
    linkedConcepts.forEach(c => {
      html += `<a class="concept-box" href="#/vocabulary/${c.id}">`;
      html += `<span class="concept-box-name">${escapeHtml(c.cname)}</span>`;
      html += `</a>`;
    });
    html += '</div></div>';
  }

  return html;
}

function renderTermRelationships(termId, term) {
  // Linked concepts via concept_term
  const linkedConcepts = query(`SELECT c.id, c.${nameCol('name')} as cname FROM concept c JOIN concept_term ct ON ct.concept_id = c.id WHERE ct.term_id = ?`, [termId]);

  const satellites = [];

  if (linkedConcepts.length) {
    satellites.push({ title: 'Geschäftsobjekte', items: linkedConcepts.map(c => ({ label: c.cname, href: '#/vocabulary/' + c.id, icon: 'box', meta: '' })), color: '#6366F1' });
  }

  if (satellites.length === 0) return '<div class="content-section">' + renderEmptyState('git-branch', 'Keine Beziehungen', 'Dieser Begriff hat noch keine Beziehungen zu anderen Entitäten.') + '</div>';
  return renderRelGraph(n(term, 'name'), satellites);
}

