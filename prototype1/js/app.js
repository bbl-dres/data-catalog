(function() {
'use strict';

// ============================================================
// State
// ============================================================
let db = null;
let currentSection = 'vocabulary';
let currentEntityId = null;
let currentTab = 'overview';
let searchQuery = '';
let lang = 'de';
let recents = [];

const LANG_LABELS = { de: 'DE', fr: 'FR', it: 'IT', en: 'EN' };
const SECTION_LABELS = {
  vocabulary: { de: 'Vokabular', fr: 'Vocabulaire', it: 'Vocabolario', en: 'Vocabulary' },
  codelists: { de: 'Codelisten', fr: 'Listes de codes', it: 'Liste di codici', en: 'Code Lists' },
  systems: { de: 'Systeme', fr: 'Systemes', it: 'Sistemi', en: 'Systems' },
  products: { de: 'Datenprodukte', fr: 'Produits de donnees', it: 'Prodotti di dati', en: 'Data Products' }
};
const SECTION_ICONS = {
  vocabulary: 'book-open',
  codelists: 'list-ordered',
  systems: 'database',
  products: 'package'
};

// ============================================================
// Utility: Run SQL query, return array of objects
// ============================================================
function query(sql, params) {
  try {
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (e) {
    console.error('SQL Error:', e.message, '\nQuery:', sql);
    return [];
  }
}

function queryOne(sql, params) {
  const r = query(sql, params);
  return r.length > 0 ? r[0] : null;
}

function exec(sql) {
  try { db.exec(sql); } catch(e) { console.error('SQL exec error:', e.message); }
}

// Safe column name for lang
function nameCol(prefix) {
  const validLangs = ['de', 'fr', 'it', 'en'];
  const l = validLangs.includes(lang) ? lang : 'en';
  return `${prefix}_${l}`;
}

function n(row, prefix) {
  const col = nameCol(prefix);
  return row[col] || row[prefix + '_en'] || row[prefix + '_de'] || '';
}

function labelCol() {
  const validLangs = ['de', 'fr', 'it', 'en'];
  const l = validLangs.includes(lang) ? lang : 'en';
  return `label_${l}`;
}

function parseJSON(val) {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

function getDefinitionText(jsonStr, locale) {
  const obj = parseJSON(jsonStr);
  if (!obj) return '';
  return obj[locale] || obj['en'] || obj['de'] || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatNumber(num) {
  if (num == null || num === '') return '';
  return new Intl.NumberFormat(lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : lang === 'it' ? 'it-CH' : 'en-CH').format(num);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat(lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : 'en-CH', { dateStyle: 'medium' }).format(d);
  } catch { return isoStr; }
}

function statusBadge(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  let cls = 'badge-draft', dot = 'status-dot-draft', label = status;
  if (s === 'approved' || s === 'certified' || s === 'active') {
    cls = 'badge-certified'; dot = 'status-dot-certified';
    label = s === 'active' ? 'Active' : 'Certified';
  } else if (s === 'deprecated') {
    cls = 'badge-deprecated'; dot = 'status-dot-deprecated'; label = 'Deprecated';
  } else {
    label = 'Draft';
  }
  return `<span class="badge ${cls}"><span class="status-dot ${dot}"></span> ${escapeHtml(label)}</span>`;
}

function certifiedBadge(isCertified) {
  if (isCertified) return statusBadge('approved');
  return statusBadge('draft');
}

function classificationBadge(row) {
  if (!row) return '';
  const lvl = row.sensitivity_level;
  const name = n(row, 'name');
  if (lvl === 0) return `<span class="badge badge-public">${escapeHtml(name)}</span>`;
  if (lvl === 1) return `<span class="badge badge-internal">${escapeHtml(name)}</span>`;
  if (lvl === 2) return `<span class="badge badge-confidential">${escapeHtml(name)}</span>`;
  return `<span class="badge badge-restricted">${escapeHtml(name)}</span>`;
}

function addRecent(title, hash) {
  recents = recents.filter(r => r.hash !== hash);
  recents.unshift({ title, hash });
  if (recents.length > 4) recents.length = 4;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================================
// Router
// ============================================================
function navigate(hash) {
  window.location.hash = hash;
}

function parseRoute() {
  const hash = window.location.hash || '#/vocabulary';
  const parts = hash.replace('#/', '').split('/');
  const section = parts[0] || 'vocabulary';

  if (section === 'search') {
    const qIdx = hash.indexOf('?q=');
    searchQuery = qIdx >= 0 ? decodeURIComponent(hash.slice(qIdx + 3)) : '';
    return { section: 'search', entityId: null, tab: null, subEntityId: null };
  }

  // Handle systems/:id/datasets/:did/:tab
  if (section === 'systems' && parts.length >= 4 && parts[2] === 'datasets') {
    return { section: 'systems', entityId: parts[1], subSection: 'datasets', subEntityId: parts[3], tab: parts[4] || 'overview' };
  }

  // List-level tabs (table/diagram) — not an entity ID
  const listTabs = ['table', 'diagram'];
  if (parts[1] && listTabs.includes(parts[1])) {
    return { section, entityId: null, tab: parts[1], subEntityId: null };
  }

  return {
    section,
    entityId: parts[1] || null,
    tab: parts[2] || 'overview',
    subEntityId: null
  };
}

function handleRoute() {
  const route = parseRoute();
  currentSection = route.section;
  currentEntityId = route.entityId;
  currentTab = route.tab || 'overview';

  renderSidebar();

  if (route.section === 'search') {
    renderSearchResults();
  } else if (route.subEntityId) {
    // Dataset detail under system
    currentTab = route.tab || 'overview';
    renderDatasetDetail(route.subEntityId, route.entityId);
  } else if (route.entityId) {
    renderDetailView(route.section, route.entityId, route.tab || 'overview');
  } else {
    renderListView(route.section, route.tab || 'table');
  }

  lucide.createIcons();
}

window.addEventListener('hashchange', handleRoute);

// ============================================================
// Sidebar
// ============================================================
// ============================================================
// Reusable empty state renderer
// ============================================================
function renderEmptyState(icon, title, description) {
  return `<div class="empty-state">
    <i data-lucide="${escapeHtml(icon)}" class="empty-state-icon" style="width:48px;height:48px;"></i>
    <h3 class="empty-state-title">${escapeHtml(title)}</h3>
    <p class="empty-state-description">${escapeHtml(description)}</p>
  </div>`;
}

// ============================================================
// Reusable locked content message
// ============================================================
function renderLockedContent() {
  return `<div class="locked-content-message">
    <i data-lucide="lock" style="width:48px;height:48px;"></i>
    <h3>Zugriff eingeschr&auml;nkt</h3>
    <p>Dieser Inhalt ist klassifiziert. Zugriff anfordern, um die Details einzusehen.</p>
    <a class="btn btn-ghost" href="mailto:datenkatalog@bbl.admin.ch?subject=Zugriffsanfrage">Zugriff anfordern &rarr;</a>
  </div>`;
}

// ============================================================
// Check if entity is access-restricted (sensitivity_level >= 2)
// ============================================================
function isAccessRestricted(datasetId) {
  const cls = queryOne(`SELECT dc.sensitivity_level FROM data_classification dc
    JOIN dataset_classification dsc ON dc.id = dsc.classification_id
    WHERE dsc.dataset_id = ?`, [datasetId]);
  return cls && cls.sensitivity_level >= 2;
}

function renderSidebar() {
  const counts = {
    vocabulary: query("SELECT COUNT(*) as c FROM concept")[0]?.c || 0,
    codelists: query("SELECT COUNT(*) as c FROM code_list")[0]?.c || 0,
    systems: query("SELECT COUNT(*) as c FROM system")[0]?.c || 0,
    products: query("SELECT COUNT(*) as c FROM data_product")[0]?.c || 0,
  };

  let html = '';
  ['vocabulary', 'codelists', 'systems', 'products'].forEach(sec => {
    const active = currentSection === sec;
    const activeClass = active ? ' active' : '';
    const ariaCurrent = active ? ' aria-current="page"' : '';
    const label = SECTION_LABELS[sec][lang] || SECTION_LABELS[sec]['en'];
    html += `<div class="nav-item${activeClass}" data-nav="${sec}" role="link"${ariaCurrent}>
      <i data-lucide="${SECTION_ICONS[sec]}" style="width:16px;height:16px;"></i>
      <span>${escapeHtml(label)}</span>
      <span class="nav-count">${counts[sec]}</span>
    </div>`;
  });

  if (recents.length > 0) {
    html += '<div class="nav-divider"></div>';
    html += '<div class="nav-section-label">Recents</div>';
    recents.forEach(r => {
      html += `<div class="nav-recent-item" data-hash="${escapeHtml(r.hash)}">${escapeHtml(r.title)}</div>`;
    });
  }

  html += '<div class="nav-divider"></div>';
  html += '<div class="nav-section-label">Bookmarks</div>';
  html += '<div style="padding: var(--space-1) var(--space-3); font-size: 13px; color: var(--color-text-placeholder);">Keine Lesezeichen</div>';

  document.getElementById('sidebar').innerHTML = html;
}

// ============================================================
// List Views
// ============================================================
function renderListView(section, listTab) {
  const main = document.getElementById('main-content');
  if (!listTab || (listTab !== 'table' && listTab !== 'diagram')) listTab = 'table';
  switch(section) {
    case 'vocabulary': main.innerHTML = renderVocabularyList(listTab); break;
    case 'codelists': main.innerHTML = renderCodeListsList(listTab); break;
    case 'systems': main.innerHTML = renderSystemsList(listTab); break;
    case 'products': main.innerHTML = renderProductsList(listTab); break;
    default: main.innerHTML = renderVocabularyList(listTab);
  }
}

function renderListTabBar(section, activeTab) {
  let html = '<div class="tab-bar" role="tablist">';
  const tabs = [
    { id: 'table', label: '\u00dcbersicht', icon: 'table-2' },
    { id: 'diagram', label: 'Diagramm', icon: 'network' }
  ];
  tabs.forEach(t => {
    const isActive = t.id === activeTab;
    html += `<button class="tab${isActive ? ' active' : ''}" data-list-tab="${t.id}" data-list-section="${section}" role="tab" aria-selected="${isActive}"><i data-lucide="${t.icon}" style="width:14px;height:14px;margin-right:4px;vertical-align:-2px;"></i>${t.label}</button>`;
  });
  html += '</div>';
  return html;
}

function renderDiagramPlaceholder(section) {
  const labels = {
    vocabulary: { title: 'Konzept-Diagramm', desc: 'Visuelle Darstellung der Konzepte und ihrer Beziehungen.' },
    codelists: { title: 'Codelisten-Diagramm', desc: 'Visuelle Darstellung der Codelisten und Referenzen.' },
    systems: { title: 'System-Diagramm', desc: 'Visuelle Darstellung der Systeme und Datenfl\u00fcsse.' },
    products: { title: 'Datenprodukt-Diagramm', desc: 'Visuelle Darstellung der Datenprodukte und Distributionen.' }
  };
  const l = labels[section] || labels.vocabulary;
  return '<div class="content-section">' + renderEmptyState('network', l.title, l.desc + ' Wird in einer zuk\u00fcnftigen Version verf\u00fcgbar sein.') + '</div>';
}

function renderVocabularyList(listTab) {
  const totalConcepts = query("SELECT COUNT(*) as c FROM concept")[0]?.c || 0;

  // Single query with LEFT JOIN to get collection concept counts (fix N+1)
  const collections = query(`SELECT col.*,
    COUNT(c.id) as concept_count
    FROM collection col
    LEFT JOIN concept c ON c.collection_id = col.id
    GROUP BY col.id
    ORDER BY col.sort_order, col.${nameCol('name')}`);

  // Pre-fetch all concepts with mapping counts and steward name in one query
  const allConcepts = query(`SELECT c.*,
    COALESCE(mc.mapping_count, 0) as mapping_count,
    u.name as steward_name
    FROM concept c
    LEFT JOIN (SELECT concept_id, COUNT(*) as mapping_count FROM concept_mapping GROUP BY concept_id) mc ON mc.concept_id = c.id
    LEFT JOIN "user" u ON c.steward_id = u.id
    ORDER BY c.${nameCol('name')}`);

  // Group concepts by collection_id
  const conceptsByCollection = {};
  const ungrouped = [];
  allConcepts.forEach(c => {
    if (c.collection_id) {
      if (!conceptsByCollection[c.collection_id]) conceptsByCollection[c.collection_id] = [];
      conceptsByCollection[c.collection_id].push(c);
    } else {
      ungrouped.push(c);
    }
  });

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb"><span class="breadcrumb-current">' + SECTION_LABELS.vocabulary[lang] + '</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title">${SECTION_LABELS.vocabulary[lang]}</div>
    <div class="section-subtitle">${totalConcepts} Konzepte</div>
  </div></div>`;

  html += renderListTabBar('vocabulary', listTab);

  if (listTab === 'diagram') {
    html += renderDiagramPlaceholder('vocabulary');
    html += '</div>';
    return html;
  }

  if (collections.length === 0 && ungrouped.length === 0) {
    html += renderEmptyState('book-open', 'Keine Konzepte', 'Es wurden noch keine Konzepte angelegt.');
    html += '</div>';
    return html;
  }

  html += '<div class="list-panel">';
  collections.forEach(col => {
    const concepts = (conceptsByCollection[col.id] || []).slice(0, 5);
    const isExpanded = concepts.length > 0;
    html += `<div class="group-header" data-toggle-group="${col.id}">
      <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" style="width:16px;height:16px;" class="group-chevron"></i>
      <span class="group-header-title">${escapeHtml(n(col, 'name'))}</span>
      <span class="group-header-count">${col.concept_count} Konzepte</span>
    </div>`;

    html += `<div class="group-content" data-group="${col.id}" ${isExpanded ? '' : 'style="display:none"'}>`;
    html += '<table class="data-table"><colgroup><col style="width:20%"><col style="width:30%"><col style="width:10%"><col style="width:10%"><col style="width:15%"><col style="width:15%"></colgroup><thead><tr>';
    html += '<th scope="col">Name</th><th scope="col">Description</th><th scope="col">Status</th><th scope="col">Fields</th><th scope="col">Standard</th><th scope="col">Data Owner</th>';
    html += '</tr></thead><tbody>';
    concepts.forEach(c => {
      const desc = getDefinitionText(c.definition, lang);
      html += `<tr class="clickable-row" data-href="#/vocabulary/${c.id}">
        <td>${escapeHtml(n(c, 'name'))}</td>
        <td>${desc ? escapeHtml(desc.substring(0, 80)) + (desc.length > 80 ? '...' : '') : '&ndash;'}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${c.mapping_count > 0 ? c.mapping_count : '&ndash;'}</td>
        <td>${escapeHtml(c.standard_ref || '&ndash;')}</td>
        <td>${c.steward_name ? escapeHtml(c.steward_name) : '&ndash;'}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    if (col.concept_count > 5) {
      html += `<div style="padding: var(--space-2) 0;"><a href="#/vocabulary" class="breadcrumb-link"
        onclick="event.preventDefault();" style="font-size:var(--text-small);">Alle ${col.concept_count} Konzepte anzeigen</a></div>`;
    }
    html += '</div>';
  });

  if (ungrouped.length > 0) {
    html += `<div class="group-header"><i data-lucide="chevron-down" style="width:16px;height:16px;"></i>
      <span class="group-header-title">Ungrouped</span>
      <span class="group-header-count">${ungrouped.length} Konzepte</span></div>`;
    html += '<div class="group-content"><table class="data-table"><colgroup><col style="width:20%"><col style="width:30%"><col style="width:10%"><col style="width:10%"><col style="width:15%"><col style="width:15%"></colgroup><thead><tr>';
    html += '<th scope="col">Name</th><th scope="col">Description</th><th scope="col">Status</th><th scope="col">Fields</th><th scope="col">Standard</th><th scope="col">Data Owner</th>';
    html += '</tr></thead><tbody>';
    ungrouped.forEach(c => {
      const desc = getDefinitionText(c.definition, lang);
      html += `<tr class="clickable-row" data-href="#/vocabulary/${c.id}">
        <td>${escapeHtml(n(c, 'name'))}</td>
        <td>${desc ? escapeHtml(desc.substring(0, 80)) + (desc.length > 80 ? '...' : '') : '&ndash;'}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${c.mapping_count > 0 ? c.mapping_count : '&ndash;'}</td>
        <td>${escapeHtml(c.standard_ref || '&ndash;')}</td>
        <td>${c.steward_name ? escapeHtml(c.steward_name) : '&ndash;'}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  html += '</div>'; // close list-panel
  html += '</div>'; // close content-wrapper
  return html;
}

function renderCodeListsList(listTab) {
  // Single query with LEFT JOIN and GROUP BY to get value counts (fix N+1)
  const codeLists = query(`SELECT cl.*,
    COALESCE(vc.value_count, 0) as value_count,
    COALESCE(vc.deprecated_count, 0) as deprecated_count
    FROM code_list cl
    LEFT JOIN (
      SELECT code_list_id,
        COUNT(*) as value_count,
        SUM(CASE WHEN deprecated = 1 THEN 1 ELSE 0 END) as deprecated_count
      FROM code_list_value GROUP BY code_list_id
    ) vc ON vc.code_list_id = cl.id
    ORDER BY cl.source_ref, cl.${nameCol('name')}`);

  const totalCount = codeLists.length;

  // Group by source_ref
  const groups = {};
  codeLists.forEach(cl => {
    const src = cl.source_ref || 'Other';
    if (!groups[src]) groups[src] = [];
    groups[src].push(cl);
  });

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb"><span class="breadcrumb-current">' + SECTION_LABELS.codelists[lang] + '</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title">${SECTION_LABELS.codelists[lang]}</div>
    <div class="section-subtitle">${totalCount} Codelisten</div>
  </div></div>`;

  html += renderListTabBar('codelists', listTab);

  if (listTab === 'diagram') {
    html += renderDiagramPlaceholder('codelists');
    html += '</div>';
    return html;
  }

  if (totalCount === 0) {
    html += renderEmptyState('list-ordered', 'Keine Codelisten', 'Es wurden noch keine Codelisten angelegt.');
    html += '</div>';
    return html;
  }

  html += '<div class="list-panel">';
  Object.keys(groups).forEach(src => {
    const items = groups[src];
    html += `<div class="group-header" data-toggle-group="cl-${src}">
      <i data-lucide="chevron-down" style="width:16px;height:16px;" class="group-chevron"></i>
      <span class="group-header-title">${escapeHtml(src)}</span>
      <span class="group-header-count">${items.length} Listen</span>
    </div>`;
    html += `<div class="group-content" data-group="cl-${src}">`;
    html += '<table class="data-table"><colgroup><col style="width:35%"><col style="width:35%"><col style="width:15%"><col style="width:15%"></colgroup><thead><tr>';
    html += '<th scope="col">Name (EN)</th><th scope="col">Name (DE)</th><th scope="col">Values</th><th scope="col">Version</th>';
    html += '</tr></thead><tbody>';
    items.forEach(cl => {
      html += `<tr class="clickable-row" data-href="#/codelists/${cl.id}">
        <td>${escapeHtml(cl.name_en)}</td>
        <td>${escapeHtml(cl.name_de || '')}</td>
        <td>${cl.value_count} values</td>
        <td>${escapeHtml(cl.version || '&ndash;')}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  });

  html += '</div>'; // close list-panel
  html += '</div>'; // close content-wrapper
  return html;
}

function renderSystemsList(listTab) {
  // Single query with JOINs to get schema_count and dataset_count (fix N+1)
  const systems = query(`SELECT s.*,
    c.name as owner_name, c.organisation as owner_org,
    COALESCE(sc_counts.schema_count, 0) as schema_count,
    COALESCE(ds_counts.dataset_count, 0) as dataset_count
    FROM system s
    LEFT JOIN contact c ON s.owner_id = c.id
    LEFT JOIN (SELECT system_id, COUNT(*) as schema_count FROM schema_ GROUP BY system_id) sc_counts ON sc_counts.system_id = s.id
    LEFT JOIN (SELECT sc.system_id, COUNT(*) as dataset_count FROM dataset d JOIN schema_ sc ON d.schema_id = sc.id GROUP BY sc.system_id) ds_counts ON ds_counts.system_id = s.id
    ORDER BY s.${nameCol('name')}`);

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb"><span class="breadcrumb-current">' + SECTION_LABELS.systems[lang] + '</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title">${SECTION_LABELS.systems[lang]}</div>
    <div class="section-subtitle">${systems.length} Systeme</div>
  </div></div>`;

  html += renderListTabBar('systems', listTab);

  if (listTab === 'diagram') {
    html += renderDiagramPlaceholder('systems');
    html += '</div>';
    return html;
  }

  if (systems.length === 0) {
    html += renderEmptyState('database', 'Keine Systeme', 'Es wurden noch keine Systeme registriert.');
    html += '</div>';
    return html;
  }

  html += '<div class="list-panel">';
  html += '<table class="data-table"><colgroup><col style="width:25%"><col style="width:20%"><col style="width:12%"><col style="width:12%"><col style="width:10%"><col style="width:21%"></colgroup><thead><tr>';
  html += '<th scope="col">Name</th><th scope="col">Technology</th><th scope="col">Schemas</th><th scope="col">Datasets</th><th scope="col">Status</th><th scope="col">Owner</th>';
  html += '</tr></thead><tbody>';
  systems.forEach(s => {
    html += `<tr class="clickable-row" data-href="#/systems/${s.id}">
      <td>${escapeHtml(n(s, 'name'))}</td>
      <td>${escapeHtml(s.technology_stack || '&ndash;')}</td>
      <td>${s.schema_count}</td>
      <td>${s.dataset_count}</td>
      <td>${s.active ? statusBadge('active') : statusBadge('deprecated')}</td>
      <td>${s.owner_name ? escapeHtml(s.owner_name) : '&ndash;'}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  html += '</div></div>';
  return html;
}

function renderProductsList(listTab) {
  const products = query(`SELECT dp.*,
    (SELECT COUNT(*) FROM distribution dist WHERE dist.data_product_id = dp.id) as dist_count
    FROM data_product dp ORDER BY dp.${nameCol('name')}`);

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb"><span class="breadcrumb-current">' + SECTION_LABELS.products[lang] + '</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title">${SECTION_LABELS.products[lang]}</div>
    <div class="section-subtitle">${products.length} Datenprodukte</div>
  </div></div>`;

  html += renderListTabBar('products', listTab);

  if (listTab === 'diagram') {
    html += renderDiagramPlaceholder('products');
    html += '</div>';
    return html;
  }

  if (products.length === 0) {
    html += renderEmptyState('package', 'Keine Datenprodukte', 'Es wurden noch keine Datenprodukte angelegt.');
    html += '</div>';
    return html;
  }

  html += '<div class="list-panel">';
  html += '<table class="data-table"><colgroup><col style="width:25%"><col style="width:15%"><col style="width:12%"><col style="width:15%"><col style="width:10%"><col style="width:23%"></colgroup><thead><tr>';
  html += '<th scope="col">Name</th><th scope="col">Frequency</th><th scope="col">Distributions</th><th scope="col">Formats</th><th scope="col">Status</th><th scope="col">Publisher</th>';
  html += '</tr></thead><tbody>';
  products.forEach(dp => {
    const formats = query("SELECT DISTINCT format FROM distribution WHERE data_product_id = ? AND format IS NOT NULL", [dp.id]);
    const formatStr = formats.map(f => escapeHtml(f.format)).join(', ');
    html += `<tr class="clickable-row" data-href="#/products/${dp.id}">
      <td>${escapeHtml(n(dp, 'name'))}</td>
      <td>${dp.update_frequency ? escapeHtml(dp.update_frequency) : '&ndash;'}</td>
      <td>${dp.dist_count}</td>
      <td>${formatStr || '&ndash;'}</td>
      <td>${certifiedBadge(dp.certified)}</td>
      <td>${escapeHtml(dp.publisher || '&ndash;')}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  html += '</div></div>';
  return html;
}

// ============================================================
// Detail Views
// ============================================================
function renderDetailView(section, entityId, tab) {
  const main = document.getElementById('main-content');
  switch(section) {
    case 'vocabulary': renderConceptDetail(entityId, tab, main); break;
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

  // Check if has code list
  const codeList = queryOne("SELECT * FROM code_list WHERE concept_id = ?", [conceptId]);
  // Check if has attributes
  const attrCount = query("SELECT COUNT(*) as c FROM concept_attribute WHERE concept_id = ?", [conceptId])[0]?.c || 0;
  // Mappings
  const mappingCount = query("SELECT COUNT(*) as c FROM concept_mapping WHERE concept_id = ?", [conceptId])[0]?.c || 0;
  // Relations
  const relCount = query("SELECT COUNT(*) as c FROM concept_relation WHERE source_concept_id = ? OR target_concept_id = ?", [conceptId, conceptId])[0]?.c || 0;
  // Contacts
  const hasContacts = steward != null;

  addRecent(n(concept, 'name') || concept.name_en, `#/vocabulary/${conceptId}`);

  const tabs = ['overview'];
  if (attrCount > 0) tabs.push('contents');
  if (mappingCount > 0) tabs.push('mappings');
  if (codeList) tabs.push('values');
  if (relCount > 0) tabs.push('relationships');
  tabs.push('stakeholders');
  tabs.push('feedback');

  const tabLabels = { overview: 'Overview', contents: 'Contents', mappings: 'Mappings', values: 'Values', relationships: 'Relationships', stakeholders: 'Stakeholders', feedback: 'Feedback' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  // Breadcrumb
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">';
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
  html += '<div class="title-block-icon"><i data-lucide="file-text" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(concept, 'name'))}</div>`;
  html += '</div>';
  html += `<div class="title-block-badge">${statusBadge(concept.status)}</div>`;
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
    case 'overview': html += renderConceptOverview(concept, vocab); break;
    case 'contents': html += renderConceptContents(conceptId); break;
    case 'mappings': html += renderConceptMappings(conceptId); break;
    case 'values': html += renderConceptValues(conceptId, codeList); break;
    case 'relationships': html += renderConceptRelationships(conceptId); break;
    case 'stakeholders': html += renderConceptStakeholders(concept); break;
    case 'feedback': html += renderFeedbackTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderTranslationGap(val) {
  if (!val || val.trim() === '') {
    return ' <span class="translation-gap">&#9888; &Uuml;bersetzung fehlt</span>';
  }
  return '';
}

function renderFeedbackTab() {
  return '<div class="content-section">' + renderEmptyState('message-circle', 'Feedback & Kommentare', 'Feedback & Kommentare werden in einer zuk\u00fcnftigen Version verf\u00fcgbar sein.') + '</div>';
}

function renderConceptOverview(concept, vocab) {
  let html = '';
  // Names with translation gap indicators
  html += '<div class="content-section"><div class="section-label">NAMES</div>';
  html += '<table class="names-table">';
  ['en', 'de', 'fr', 'it'].forEach(l => {
    const val = concept['name_' + l];
    html += `<tr><td>${l.toUpperCase()}</td><td>${val ? escapeHtml(val) : '<span style="color:var(--color-text-placeholder);">&ndash;</span>'}${renderTranslationGap(val)}</td></tr>`;
  });
  html += '</table></div>';

  // Definition
  const def = getDefinitionText(concept.definition, lang);
  html += `<div class="content-section"><div class="section-label">DEFINITION</div>`;
  html += `<div class="prose">${def ? '<p>' + escapeHtml(def) + '</p>' : '<p style="color:var(--color-text-placeholder);">No definition available.</p>'}</div></div>`;

  // Properties
  html += '<div class="content-section"><div class="section-label">PROPERTIES</div>';
  html += '<table class="props-table">';
  if (concept.standard_ref) html += `<tr><td>Standard reference</td><td>${escapeHtml(concept.standard_ref)}</td></tr>`;
  html += `<tr><td>EGID relevant</td><td>${concept.egid_relevant ? 'Yes' : 'No'}</td></tr>`;
  html += `<tr><td>EGRID relevant</td><td>${concept.egrid_relevant ? 'Yes' : 'No'}</td></tr>`;
  html += `<tr><td>Status</td><td>${statusBadge(concept.status)}</td></tr>`;
  if (vocab) html += `<tr><td>Vocabulary</td><td>${escapeHtml(n(vocab, 'name'))} ${vocab.version ? 'v' + escapeHtml(vocab.version) : ''}</td></tr>`;
  html += '</table></div>';
  return html;
}

function renderConceptContents(conceptId) {
  const attrs = query(`SELECT ca.*, cl.${nameCol('name')} as code_list_name, cl.id as cl_id
    FROM concept_attribute ca
    LEFT JOIN code_list cl ON ca.code_list_id = cl.id
    WHERE ca.concept_id = ?
    ORDER BY ca.sort_order, ca.${nameCol('name')}`, [conceptId]);

  if (attrs.length === 0) return '<div class="content-section">' + renderEmptyState('list', 'Keine Attribute', 'Diesem Konzept sind noch keine Attribute zugeordnet.') + '</div>';

  let html = '<div class="content-section"><div class="section-label">ATTRIBUTES</div>';
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

function renderConceptValues(conceptId, codeList) {
  if (!codeList) return '<div class="content-section">' + renderEmptyState('list-ordered', 'Keine Codeliste', 'Diesem Konzept ist keine Codeliste zugeordnet.') + '</div>';

  const values = query(`SELECT * FROM code_list_value WHERE code_list_id = ? AND deprecated = 0 ORDER BY sort_order, code LIMIT 10`, [codeList.id]);
  const totalCount = query("SELECT COUNT(*) as c FROM code_list_value WHERE code_list_id = ?", [codeList.id])[0]?.c || 0;

  let html = `<div class="content-section"><div class="section-label">VALUES &mdash; linked to ${escapeHtml(n(codeList, 'name'))}</div>`;
  html += `<div style="margin-bottom:var(--space-3);font-size:var(--text-small);color:var(--color-text-secondary);">
    Source: ${escapeHtml(codeList.source_ref || '')} &middot; ${totalCount} values &middot; Version ${escapeHtml(codeList.version || '')}
    <br><a href="#/codelists/${codeList.id}">View full code list</a>
  </div>`;

  html += '<table class="data-table"><thead><tr>';
  html += '<th scope="col">Code</th><th scope="col">Label (DE)</th><th scope="col">Label (FR)</th>';
  html += '</tr></thead><tbody>';
  values.forEach(v => {
    html += `<tr>
      <td class="cell-mono">${escapeHtml(v.code)}</td>
      <td>${escapeHtml(v.label_de || '')}</td>
      <td>${escapeHtml(v.label_fr || '')}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  if (totalCount > 10) {
    html += `<div style="padding:var(--space-3) 0;"><a href="#/codelists/${codeList.id}/contents">View all ${totalCount} values</a></div>`;
  }
  html += '</div>';
  return html;
}

function renderConceptRelationships(conceptId) {
  const rels = query(`SELECT cr.*,
    c1.${nameCol('name')} as source_name, c1.id as source_id,
    c2.${nameCol('name')} as target_name, c2.id as target_id
    FROM concept_relation cr
    JOIN concept c1 ON cr.source_concept_id = c1.id
    JOIN concept c2 ON cr.target_concept_id = c2.id
    WHERE cr.source_concept_id = ? OR cr.target_concept_id = ?`, [conceptId, conceptId]);

  if (rels.length === 0) return '<div class="content-section">' + renderEmptyState('git-branch', 'Keine Beziehungen', 'Dieses Konzept hat noch keine Beziehungen zu anderen Konzepten.') + '</div>';

  let html = '<div class="content-section"><div class="section-label">RELATIONSHIPS</div>';
  html += '<table class="data-table"><thead><tr>';
  html += '<th scope="col">Relation</th><th scope="col">Concept</th>';
  html += '</tr></thead><tbody>';
  rels.forEach(r => {
    const isSource = r.source_concept_id === conceptId;
    const otherName = isSource ? r.target_name : r.source_name;
    const otherId = isSource ? r.target_id : r.source_id;
    const relLabel = (r.relation_type || '').replace('skos:', '');
    html += `<tr>
      <td>${escapeHtml(relLabel)}</td>
      <td><a href="#/vocabulary/${otherId}">${escapeHtml(otherName)}</a></td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

function renderConceptStakeholders(concept) {
  const steward = concept.steward_id ? queryOne('SELECT * FROM "user" WHERE id = ?', [concept.steward_id]) : null;
  let html = '<div class="content-section"><div class="section-label">STAKEHOLDERS</div>';

  // Concept role groups per wireframe: Data Owner, Data Steward, Subject Matter Expert
  const roleDescs = {
    data_owner: { label: 'Dateneigent\u00fcmer', desc: 'Accountable for existence, quality standards, and use of this data.' },
    data_steward: { label: 'Datenverantwortliche', desc: 'Maintains the catalog entry, enforces standards, approves mappings.' },
    subject_matter_expert: { label: 'Fachexperte', desc: 'Provides domain knowledge about the data\'s meaning and edge cases.' }
  };

  Object.keys(roleDescs).forEach(role => {
    const rd = roleDescs[role];
    html += `<div class="stakeholder-section">`;
    html += `<div class="stakeholder-role-title">${rd.label}</div>`;
    html += `<div class="stakeholder-role-desc">${rd.desc}</div>`;
    if (role === 'data_steward' && steward) {
      html += renderStakeholderCard(steward.name, steward.department, steward.email);
    } else {
      html += `<div style="font-size:var(--text-small);color:var(--color-text-placeholder);padding:var(--space-3) 0;">Kein(e) ${rd.label} zugewiesen</div>`;
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderStakeholderCard(name, org, email) {
  return `<div class="stakeholder-card">
    <div class="stakeholder-avatar">${getInitials(name)}</div>
    <div>
      <div class="stakeholder-name">${escapeHtml(name)}</div>
      ${org ? '<div class="stakeholder-org">' + escapeHtml(org) + '</div>' : ''}
      ${email ? '<div class="stakeholder-email"><a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></div>' : ''}
    </div>
  </div>`;
}

// ============================================================
// Code List Detail
// ============================================================
function renderCodeListDetail(codeListId, tab, main) {
  const cl = queryOne("SELECT * FROM code_list WHERE id = ?", [codeListId]);
  if (!cl) { main.innerHTML = '<p>Code list not found</p>'; return; }

  const valueCount = query("SELECT COUNT(*) as c FROM code_list_value WHERE code_list_id = ?", [codeListId])[0]?.c || 0;
  const deprecatedCount = query("SELECT COUNT(*) as c FROM code_list_value WHERE code_list_id = ? AND deprecated = 1", [codeListId])[0]?.c || 0;

  addRecent(n(cl, 'name') || cl.name_en, `#/codelists/${codeListId}`);

  const tabs = ['overview', 'contents', 'mappings', 'stakeholders', 'feedback'];
  const tabLabels = { overview: 'Overview', contents: 'Contents', mappings: 'Mappings', stakeholders: 'Stakeholders', feedback: 'Feedback' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  // Breadcrumb
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">';
  html += `<a class="breadcrumb-link" href="#/codelists">${SECTION_LABELS.codelists[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<span class="breadcrumb-current">${escapeHtml(n(cl, 'name'))}</span>`;
  html += '</nav>';

  // Title
  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="list-ordered" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(cl, 'name'))}</div>`;
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
    case 'stakeholders': html += renderCodeListStakeholders(cl); break;
    case 'feedback': html += renderFeedbackTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderCodeListOverview(cl, valueCount, deprecatedCount) {
  let html = '';
  // Names with translation gap indicators
  html += '<div class="content-section"><div class="section-label">NAMES</div>';
  html += '<table class="names-table">';
  ['en', 'de', 'fr', 'it'].forEach(l => {
    const val = cl['name_' + l];
    html += `<tr><td>${l.toUpperCase()}</td><td>${val ? escapeHtml(val) : '<span style="color:var(--color-text-placeholder);">&ndash;</span>'}${renderTranslationGap(val)}</td></tr>`;
  });
  html += '</table></div>';

  // Properties
  html += '<div class="content-section"><div class="section-label">PROPERTIES</div>';
  html += '<table class="props-table">';
  if (cl.source_ref) html += `<tr><td>Source</td><td>${escapeHtml(cl.source_ref)}</td></tr>`;
  if (cl.version) html += `<tr><td>Version</td><td>${escapeHtml(cl.version)}</td></tr>`;
  html += `<tr><td>Total values</td><td>${valueCount} (${valueCount - deprecatedCount} active${deprecatedCount > 0 ? ' &middot; ' + deprecatedCount + ' deprecated' : ''})</td></tr>`;

  // Used by concepts
  if (cl.concept_id) {
    const concept = queryOne(`SELECT ${nameCol('name')} as cname FROM concept WHERE id = ?`, [cl.concept_id]);
    if (concept) html += `<tr><td>Used by concept</td><td><a href="#/vocabulary/${cl.concept_id}">${escapeHtml(concept.cname)}</a></td></tr>`;
  }
  html += '</table></div>';
  return html;
}

function renderCodeListContents(codeListId) {
  const values = query(`SELECT * FROM code_list_value WHERE code_list_id = ? ORDER BY sort_order, code`, [codeListId]);

  if (values.length === 0) return '<div class="content-section">' + renderEmptyState('list-ordered', 'Keine Werte', 'Diese Codeliste enth\u00e4lt noch keine Werte.') + '</div>';

  let html = '<div class="content-section">';
  html += `<div style="margin-bottom:var(--space-3);font-size:var(--text-small);color:var(--color-text-secondary);">
    ${values.length} values
  </div>`;

  html += '<table class="data-table"><thead><tr>';
  html += '<th scope="col">Code</th><th scope="col">Label (DE)</th><th scope="col">Label (FR)</th><th scope="col">Label (EN)</th>';
  html += '</tr></thead><tbody>';
  values.forEach(v => {
    const isDeprecated = v.deprecated === 1;
    const style = isDeprecated ? ' style="color:var(--color-text-placeholder);font-style:italic;"' : '';
    html += `<tr${style}>
      <td class="cell-mono">${escapeHtml(v.code)}</td>
      <td>${escapeHtml(v.label_de || '')}</td>
      <td>${escapeHtml(v.label_fr || '')}</td>
      <td>${escapeHtml(v.label_en || '')}</td>
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

function renderCodeListStakeholders(cl) {
  // Code List role groups per wireframe: Data Steward, Data Custodian
  const roleDescs = {
    data_steward: { label: 'Datenverantwortliche', desc: 'Maintains the catalog entry, enforces standards, approves mappings.' },
    data_custodian: { label: 'Datenbetreuer', desc: 'Technically operates the system: access management, backup, availability.' }
  };

  let html = '<div class="content-section"><div class="section-label">STAKEHOLDERS</div>';

  Object.keys(roleDescs).forEach(role => {
    const rd = roleDescs[role];
    html += `<div class="stakeholder-section">
      <div class="stakeholder-role-title">${rd.label}</div>
      <div class="stakeholder-role-desc">${rd.desc}</div>
      <div style="font-size:var(--text-small);color:var(--color-text-placeholder);padding:var(--space-3) 0;">Kein(e) ${rd.label} zugewiesen</div>
    </div>`;
  });

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

  const tabs = ['overview', 'contents', 'stakeholders'];
  const tabLabels = { overview: 'Overview', contents: 'Contents', stakeholders: 'Stakeholders' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">';
  html += `<a class="breadcrumb-link" href="#/systems">${SECTION_LABELS.systems[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<span class="breadcrumb-current">${escapeHtml(n(sys, 'name'))}</span>`;
  html += '</nav>';

  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="database" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(sys, 'name'))}</div>`;
  html += '</div>';
  html += `<div class="title-block-badge">${sys.active ? statusBadge('active') : statusBadge('deprecated')}</div>`;
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
    case 'stakeholders': html += renderSystemStakeholders(sys); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderSystemOverview(sys, schemas, datasetCount) {
  let html = '';
  const desc = getDefinitionText(sys.description, lang);
  if (desc) {
    html += '<div class="content-section"><div class="section-label">DESCRIPTION</div>';
    html += `<div class="prose"><p>${escapeHtml(desc)}</p></div></div>`;
  }

  html += '<div class="content-section"><div class="section-label">PROPERTIES</div>';
  html += '<table class="props-table">';
  if (sys.technology_stack) html += `<tr><td>Technology</td><td>${escapeHtml(sys.technology_stack)}</td></tr>`;
  html += `<tr><td>Schemas</td><td>${schemas.length}</td></tr>`;
  html += `<tr><td>Datasets</td><td>${datasetCount}</td></tr>`;
  html += `<tr><td>Status</td><td>${sys.active ? 'Active' : 'Inactive'}</td></tr>`;
  if (sys.last_scanned_at) html += `<tr><td>Last scanned</td><td>${formatDate(sys.last_scanned_at)}</td></tr>`;
  html += '</table></div>';
  return html;
}

function renderSystemContents(systemId, schemas) {
  let html = '<div class="content-section"><div class="section-label">SCHEMAS & DATASETS</div>';

  schemas.forEach(sc => {
    const datasets = query(`SELECT d.*,
      (SELECT COUNT(*) FROM field f WHERE f.dataset_id = d.id) as field_count
      FROM dataset d WHERE d.schema_id = ? ORDER BY d.name`, [sc.id]);

    html += `<div class="group-header" data-toggle-group="sc-${sc.id}">
      <i data-lucide="chevron-down" style="width:16px;height:16px;" class="group-chevron"></i>
      <i data-lucide="layers" style="width:16px;height:16px;color:var(--color-text-secondary);"></i>
      <span class="group-header-title">${escapeHtml(sc.display_name || sc.name)}</span>
      <span class="group-header-count">${datasets.length} datasets</span>
    </div>`;
    html += `<div class="group-content" data-group="sc-${sc.id}">`;
    html += '<table class="data-table"><thead><tr>';
    html += '<th scope="col">Name</th><th scope="col">Type</th><th scope="col">Fields</th><th scope="col">Status</th>';
    html += '</tr></thead><tbody>';
    datasets.forEach(d => {
      html += `<tr class="clickable-row" data-href="#/systems/${systemId}/datasets/${d.id}">
        <td>${escapeHtml(d.display_name || d.name)}</td>
        <td>${escapeHtml(d.dataset_type)}</td>
        <td>${d.field_count}</td>
        <td>${certifiedBadge(d.certified)}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  });

  if (schemas.length === 0) {
    html += '<div class="empty-state"><div class="empty-state-title">No schemas found</div></div>';
  }
  html += '</div>';
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
  const hasLineage = query("SELECT COUNT(*) as c FROM lineage_link WHERE source_dataset_id = ? OR target_dataset_id = ?", [datasetId, datasetId])[0]?.c > 0;
  const hasProfile = query("SELECT COUNT(*) as c FROM data_profile WHERE dataset_id = ?", [datasetId])[0]?.c > 0;
  const hasContacts = query("SELECT COUNT(*) as c FROM dataset_contact WHERE dataset_id = ?", [datasetId])[0]?.c > 0;

  // Classification
  const classification = queryOne(`SELECT dc.* FROM data_classification dc
    JOIN dataset_classification dsc ON dc.id = dsc.classification_id
    WHERE dsc.dataset_id = ?`, [datasetId]);

  addRecent((ds.display_name || ds.name), `#/systems/${ds.system_id}/datasets/${datasetId}`);

  // Check if access-restricted
  const restricted = classification && classification.sensitivity_level >= 2;

  const tab = currentTab || 'overview';
  const tabs = ['overview', 'contents'];
  if (hasLineage) tabs.push('lineage');
  if (hasProfile) tabs.push('quality');
  tabs.push('stakeholders');
  tabs.push('feedback');

  const tabLabels = { overview: 'Overview', contents: 'Contents', lineage: 'Lineage', quality: 'Quality', stakeholders: 'Stakeholders', feedback: 'Feedback' };
  if (!tabs.includes(currentTab)) currentTab = 'overview';

  const main = document.getElementById('main-content');
  let html = '<div class="content-wrapper"><article>';

  // Breadcrumb
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">';
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
  html += '<div class="title-block-badge">';
  html += certifiedBadge(ds.certified);
  if (restricted) html += ' <span class="badge badge-warning">Zugriff eingeschr&auml;nkt</span>';
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
    case 'stakeholders': html += renderDatasetStakeholders(datasetId); break;
    case 'feedback': html += renderFeedbackTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderDatasetOverview(ds, fieldCount, mappingCount, classification) {
  let html = '';
  const desc = getDefinitionText(ds.description, lang);
  if (desc) {
    html += '<div class="content-section"><div class="section-label">DESCRIPTION</div>';
    html += `<div class="prose"><p>${escapeHtml(desc)}</p></div></div>`;
  }

  html += '<div class="content-section"><div class="section-label">PROPERTIES</div>';
  html += '<table class="props-table">';
  html += `<tr><td>System</td><td>${escapeHtml(ds.system_name)}</td></tr>`;
  html += `<tr><td>Schema</td><td>${escapeHtml(ds.schema_display_name || ds.schema_name)}</td></tr>`;
  html += `<tr><td>Type</td><td>${escapeHtml(ds.dataset_type)}</td></tr>`;
  if (ds.row_count_approx) html += `<tr><td>Approx. row count</td><td>${formatNumber(ds.row_count_approx)}</td></tr>`;
  if (classification) {
    html += `<tr><td>Classification</td><td>${classificationBadge(classification)}</td></tr>`;
  }
  html += `<tr><td>EGID</td><td>${ds.egid ? escapeHtml(ds.egid) : 'N/A'}</td></tr>`;
  html += '</table></div>';

  if (mappingCount > 0) {
    html += '<div class="content-section"><div class="section-label">CONCEPT MAPPINGS</div>';
    const concepts = query(`SELECT DISTINCT c.id, c.${nameCol('name')} as cname
      FROM concept c
      JOIN concept_mapping cm ON cm.concept_id = c.id
      JOIN field f ON cm.field_id = f.id
      WHERE f.dataset_id = ?`, [ds.id]);
    html += '<div style="margin-bottom:var(--space-4);">';
    html += `<div style="font-size:var(--text-small);color:var(--color-text-secondary);margin-bottom:var(--space-2);">
      Fields in this dataset realize ${concepts.length} concepts:</div>`;
    concepts.forEach(c => {
      html += `<a class="concept-pill" href="#/vocabulary/${c.id}">${escapeHtml(c.cname)}</a>`;
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
  html += '<th scope="col">Name</th><th scope="col">Type</th><th scope="col">Nullable</th><th scope="col">Key</th><th scope="col">Mapped Concepts</th>';
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
  if (!profile) return '<div class="content-section">' + renderEmptyState('bar-chart-3', 'Keine Qualit\u00e4tsdaten', 'F\u00fcr dieses Dataset sind noch keine Profiling-Daten verf\u00fcgbar.') + '</div>';

  let html = '<div class="content-section"><div class="section-label">QUALITY</div>';
  html += `<div style="font-size:var(--text-small);color:var(--color-text-secondary);margin-bottom:var(--space-4);">
    Last profiled: ${formatDate(profile.profiled_at)}${profile.profiler ? ' &middot; ' + escapeHtml(profile.profiler) : ''}
  </div>`;

  // Summary bars
  if (profile.completeness_score != null) {
    const pct = Math.round(profile.completeness_score * 100);
    html += `<div class="quality-bar-container">
      <div class="quality-bar-label">Completeness</div>
      <div class="quality-bar"><div class="quality-bar-fill-complete" style="width:${pct}%"></div></div>
      <div class="quality-bar-value">${pct}%</div>
    </div>`;
  }
  if (profile.format_validity_score != null) {
    const pct = Math.round(profile.format_validity_score * 100);
    html += `<div class="quality-bar-container">
      <div class="quality-bar-label">Format validity</div>
      <div class="quality-bar"><div class="quality-bar-fill-complete" style="width:${pct}%"></div></div>
      <div class="quality-bar-value">${pct}%</div>
    </div>`;
  }
  if (profile.null_percentage != null) {
    const pct = Math.round(profile.null_percentage * 100);
    html += `<div class="quality-bar-container">
      <div class="quality-bar-label">Null rate</div>
      <div class="quality-bar"><div class="quality-bar-fill-null" style="width:${pct}%"></div></div>
      <div class="quality-bar-value">${pct}%</div>
    </div>`;
  }
  if (profile.row_count) {
    html += `<div style="font-size:var(--text-small);color:var(--color-text-secondary);margin-top:var(--space-2);">Total rows: ${formatNumber(profile.row_count)}</div>`;
  }

  html += '</div>';
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
  const hasLineage = query("SELECT COUNT(*) as c FROM data_product_dataset WHERE data_product_id = ?", [productId])[0]?.c > 0;
  const hasContacts = query("SELECT COUNT(*) as c FROM data_product_contact WHERE data_product_id = ?", [productId])[0]?.c > 0;

  addRecent(n(dp, 'name') || dp.name_en, `#/products/${productId}`);

  const tabs = ['overview', 'contents'];
  if (hasLineage) tabs.push('lineage');
  tabs.push('stakeholders');
  tabs.push('feedback');

  const tabLabels = { overview: 'Overview', contents: 'Contents', lineage: 'Lineage', stakeholders: 'Stakeholders', feedback: 'Feedback' };
  if (!tabs.includes(tab)) tab = 'overview';
  currentTab = tab;

  let html = '<div class="content-wrapper"><article>';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">';
  html += `<a class="breadcrumb-link" href="#/products">${SECTION_LABELS.products[lang]}</a>`;
  html += '<span class="breadcrumb-separator"> / </span>';
  html += `<span class="breadcrumb-current">${escapeHtml(n(dp, 'name'))}</span>`;
  html += '</nav>';

  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="package" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<div class="title-block-name">${escapeHtml(n(dp, 'name'))}</div>`;
  html += '</div>';
  html += `<div class="title-block-badge">${certifiedBadge(dp.certified)}</div>`;
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
    case 'stakeholders': html += renderProductStakeholders(productId); break;
    case 'feedback': html += renderFeedbackTab(); break;
  }
  html += '</div></article></div>';
  main.innerHTML = html;
}

function renderProductOverview(dp) {
  let html = '';
  // Names with translation gap indicators
  html += '<div class="content-section"><div class="section-label">NAMES</div>';
  html += '<table class="names-table">';
  ['en', 'de', 'fr', 'it'].forEach(l => {
    const val = dp['name_' + l];
    html += `<tr><td>${l.toUpperCase()}</td><td>${val ? escapeHtml(val) : '<span style="color:var(--color-text-placeholder);">&ndash;</span>'}${renderTranslationGap(val)}</td></tr>`;
  });
  html += '</table></div>';

  // Description
  const desc = getDefinitionText(dp.description, lang);
  if (desc) {
    html += '<div class="content-section"><div class="section-label">DESCRIPTION</div>';
    html += `<div class="prose"><p>${escapeHtml(desc)}</p></div></div>`;
  }

  // Distributions summary
  const dists = query("SELECT * FROM distribution WHERE data_product_id = ? ORDER BY name_en", [dp.id]);
  if (dists.length > 0) {
    html += '<div class="content-section"><div class="section-label">DISTRIBUTIONS</div>';
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
function renderSearchResults() {
  const main = document.getElementById('main-content');
  const q = searchQuery.trim();
  if (!q) {
    main.innerHTML = '<div class="content-wrapper"><div class="section-header"><div><div class="section-title">Suche</div><div class="section-subtitle">Bitte geben Sie einen Suchbegriff ein.</div></div></div></div>';
    return;
  }

  const likeQ = `%${q}%`;

  const concepts = query(`SELECT id, name_en, name_de, name_fr, name_it, status FROM concept
    WHERE name_en LIKE ? OR name_de LIKE ? OR name_fr LIKE ? OR name_it LIKE ? LIMIT 10`,
    [likeQ, likeQ, likeQ, likeQ]);

  const codeLists = query(`SELECT id, name_en, name_de, name_fr, name_it FROM code_list
    WHERE name_en LIKE ? OR name_de LIKE ? OR name_fr LIKE ? OR name_it LIKE ? LIMIT 10`,
    [likeQ, likeQ, likeQ, likeQ]);

  const datasets = query(`SELECT d.id, d.name, d.display_name, d.dataset_type,
    s.${nameCol('name')} as sys_name, sc.system_id as sys_id
    FROM dataset d
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE d.name LIKE ? OR d.display_name LIKE ? LIMIT 10`,
    [likeQ, likeQ]);

  const products = query(`SELECT id, name_en, name_de, name_fr, name_it, publisher FROM data_product
    WHERE name_en LIKE ? OR name_de LIKE ? OR name_fr LIKE ? OR name_it LIKE ? LIMIT 10`,
    [likeQ, likeQ, likeQ, likeQ]);

  const totalResults = concepts.length + codeLists.length + datasets.length + products.length;

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb"><span class="breadcrumb-current">Suche</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title">Suchergebnisse</div>
    <div class="section-subtitle">${totalResults} Ergebnisse fur "${escapeHtml(q)}"</div>
  </div></div>`;

  html += '<div class="list-panel">';
  if (concepts.length > 0) {
    html += '<div class="search-group-label">CONCEPTS</div>';
    concepts.forEach(c => {
      html += `<div class="search-result-item" data-href="#/vocabulary/${c.id}">
        <div class="search-result-icon"><i data-lucide="file-text" style="width:16px;height:16px;"></i></div>
        <div>
          <div class="search-result-name">${escapeHtml(n(c, 'name'))}</div>
          <div class="search-result-type">Concept ${statusBadge(c.status)}</div>
        </div>
      </div>`;
    });
  }

  if (codeLists.length > 0) {
    html += '<div class="search-group-label">CODE LISTS</div>';
    codeLists.forEach(cl => {
      html += `<div class="search-result-item" data-href="#/codelists/${cl.id}">
        <div class="search-result-icon"><i data-lucide="list-ordered" style="width:16px;height:16px;"></i></div>
        <div>
          <div class="search-result-name">${escapeHtml(n(cl, 'name'))}</div>
          <div class="search-result-type">Code List</div>
        </div>
      </div>`;
    });
  }

  if (datasets.length > 0) {
    html += '<div class="search-group-label">DATASETS</div>';
    datasets.forEach(d => {
      html += `<div class="search-result-item" data-href="#/systems/${d.sys_id}/datasets/${d.id}">
        <div class="search-result-icon"><i data-lucide="table-2" style="width:16px;height:16px;"></i></div>
        <div>
          <div class="search-result-name">${escapeHtml(d.display_name || d.name)}</div>
          <div class="search-result-type">${escapeHtml(d.dataset_type)} &middot; ${escapeHtml(d.sys_name)}</div>
        </div>
      </div>`;
    });
  }

  if (products.length > 0) {
    html += '<div class="search-group-label">DATA PRODUCTS</div>';
    products.forEach(dp => {
      html += `<div class="search-result-item" data-href="#/products/${dp.id}">
        <div class="search-result-icon"><i data-lucide="package" style="width:16px;height:16px;"></i></div>
        <div>
          <div class="search-result-name">${escapeHtml(n(dp, 'name'))}</div>
          <div class="search-result-type">Data Product &middot; ${escapeHtml(dp.publisher || '')}</div>
        </div>
      </div>`;
    });
  }

  if (totalResults === 0) {
    html += renderEmptyState('search', 'Keine Ergebnisse', 'Keine Eintr\u00e4ge gefunden f\u00fcr "' + q + '".');
  }

  html += '</div>'; // close list-panel
  html += '</div>'; // close content-wrapper
  main.innerHTML = html;
}

// ============================================================
// Event Delegation
// ============================================================
document.addEventListener('click', function(e) {
  const target = e.target;

  // Language dropdown
  if (target.closest('#lang-btn')) {
    e.preventDefault();
    document.getElementById('lang-dropdown').classList.toggle('open');
    return;
  }
  if (target.closest('.lang-option')) {
    const newLang = target.closest('.lang-option').dataset.lang;
    if (newLang) {
      lang = newLang;
      document.getElementById('lang-label').textContent = LANG_LABELS[lang];
      document.getElementById('lang-dropdown').classList.remove('open');
      // Update active state
      document.querySelectorAll('.lang-option').forEach(el => el.classList.toggle('active', el.dataset.lang === lang));
      handleRoute();
    }
    return;
  }
  // Close dropdown on outside click
  if (!target.closest('.lang-switcher')) {
    document.getElementById('lang-dropdown')?.classList.remove('open');
  }

  // Header logo
  if (target.closest('#header-logo')) {
    e.preventDefault();
    navigate('#/vocabulary');
    return;
  }

  // Sidebar nav
  const navItem = target.closest('.nav-item[data-nav]');
  if (navItem) {
    navigate('#/' + navItem.dataset.nav);
    return;
  }

  // Sidebar recents
  const recentItem = target.closest('.nav-recent-item[data-hash]');
  if (recentItem) {
    navigate(recentItem.dataset.hash);
    return;
  }

  // List tab clicks (Übersicht / Diagramm)
  const listTabBtn = target.closest('.tab[data-list-tab]');
  if (listTabBtn) {
    const section = listTabBtn.dataset.listSection;
    const tab = listTabBtn.dataset.listTab;
    navigate('#/' + section + '/' + tab);
    return;
  }

  // Detail tab clicks
  const tabBtn = target.closest('.tab[data-tab]');
  if (tabBtn) {
    const base = tabBtn.dataset.base;
    const tabName = tabBtn.dataset.tab;
    navigate(base + '/' + tabName);
    return;
  }

  // Clickable rows (table rows, cards, search results)
  const clickable = target.closest('[data-href]');
  if (clickable) {
    navigate(clickable.dataset.href);
    return;
  }

  // Group toggle
  const groupHeader = target.closest('.group-header[data-toggle-group]');
  if (groupHeader) {
    const groupId = groupHeader.dataset.toggleGroup;
    const groupContent = document.querySelector(`[data-group="${groupId}"]`);
    if (groupContent) {
      const isHidden = groupContent.style.display === 'none';
      groupContent.style.display = isHidden ? '' : 'none';
      const chevron = groupHeader.querySelector('.group-chevron');
      if (chevron) {
        chevron.setAttribute('data-lucide', isHidden ? 'chevron-down' : 'chevron-right');
        lucide.createIcons({ nodes: [chevron] });
      }
    }
    return;
  }

  // Lineage nodes
  const lineageNode = target.closest('.lineage-node[data-href]');
  if (lineageNode) {
    navigate(lineageNode.dataset.href);
    return;
  }
});

// ============================================================
// Search: Ctrl+K and Enter
// ============================================================
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
    return;
  }
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
    return;
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        const q = this.value.trim();
        if (q) {
          searchQuery = q;
          navigate('#/search?q=' + encodeURIComponent(q));
        }
      }
      if (e.key === 'Escape') {
        this.blur();
      }
    });
  }
});

// ============================================================
// Init: Load SQL.js + schema + seed data
// ============================================================
async function initApp() {
  try {
    const SQL = await initSqlJs({
      locateFile: () => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/sql-wasm.wasm'
    });

    // Try to load pre-built database file first
    let dbLoaded = false;
    try {
      const dbResp = await fetch('data/catalog.db');
      if (dbResp.ok) {
        const buffer = await dbResp.arrayBuffer();
        db = new SQL.Database(new Uint8Array(buffer));
        dbLoaded = true;
        console.log('Loaded pre-built catalog.db');
      }
    } catch(e) {
      console.info('No catalog.db found, falling back to SQL files');
    }

    // Fallback: load from init-schema.sql + seed-data.sql
    if (!dbLoaded) {
      db = new SQL.Database();

      // Load and execute schema
      const schemaResp = await fetch('data/init-schema.sql');
      if (!schemaResp.ok) throw new Error('Failed to load init-schema.sql: ' + schemaResp.status);
      let schemaSql = await schemaResp.text();
      // Remove WAL pragma (not supported in sql.js in-memory mode)
      schemaSql = schemaSql.replace(/PRAGMA journal_mode\s*=\s*WAL\s*;?/gi, '');
      db.exec(schemaSql);

      // Load and execute seed data
      try {
        const seedResp = await fetch('data/seed-data.sql');
        if (seedResp.ok) {
          let seedSql = await seedResp.text();
          // Fix table name: seed data uses "schema" but DDL uses "schema_"
          seedSql = seedSql.replace(/INSERT INTO schema /g, 'INSERT INTO schema_ ');
          // Execute each statement individually to handle partial failures gracefully
          const statements = seedSql.split(/;\s*\n/).filter(s => s.trim());
          for (const stmt of statements) {
            const trimmed = stmt.trim();
            if (trimmed && !trimmed.startsWith('--')) {
              try { db.exec(trimmed + ';'); } catch(e2) { console.warn('Seed statement error:', e2.message, '\n', trimmed.slice(0, 100)); }
            }
          }
        }
      } catch(e) {
        console.warn('No seed-data.sql found or failed to load:', e.message);
      }
    }

    // Hide loading, show app
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app').style.display = '';

    // Set default lang option active
    document.querySelectorAll('.lang-option').forEach(el => el.classList.toggle('active', el.dataset.lang === lang));

    // Initial render
    lucide.createIcons();
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      window.location.hash = '#/vocabulary';
    } else {
      handleRoute();
    }
  } catch(err) {
    console.error('Init error:', err);
    document.getElementById('loading-screen').innerHTML = `
      <div style="text-align:center;padding:40px;">
        <p style="color:var(--color-error);font-weight:500;margin-bottom:8px;">Fehler beim Laden</p>
        <p style="color:var(--color-text-secondary);font-size:14px;">${escapeHtml(err.message)}</p>
      </div>`;
  }
}

initApp();

})();
