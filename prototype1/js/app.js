(function() {
'use strict';

// ============================================================
// State
// ============================================================
let db = null;
let currentSection = 'vocabulary';
let currentEntityId = null;
let currentCollectionId = null;
let currentTab = 'overview';
let lastListTab = 'table';
const grouping = { vocabulary: 'domain', terms: 'domain', codelists: 'domain', systems: 'none', products: 'none' };
const STATUS_LABELS = { approved: 'Freigegeben', draft: 'Entwurf', in_review: 'In Prüfung', deprecated: 'Veraltet' };
let searchQuery = '';
let lang = 'de';
const expandedSections = new Set(['vocabulary']);
let recents = [];
let sidebarCounts = null; // cached sidebar counts
let relGraphData = null; // relationship graph data (replaces relGraphData)
let relCleanup = null; // cleanup function for relationship graph event listeners

const LANG_LABELS = { de: 'DE', fr: 'FR', it: 'IT', en: 'EN' };
const SECTION_LABELS = {
  vocabulary: { de: 'Geschäftsobjekte', fr: 'Objets métier', it: 'Oggetti di business', en: 'Business Objects' },
  terms: { de: 'Begriffe', fr: 'Termes', it: 'Termini', en: 'Terms' },
  codelists: { de: 'Codelisten', fr: 'Listes de codes', it: 'Liste di codici', en: 'Code Lists' },
  systems: { de: 'Systeme', fr: 'Systemes', it: 'Sistemi', en: 'Systems' },
  products: { de: 'Datensammlungen', fr: 'Collections de données', it: 'Raccolte di dati', en: 'Data Collections' }
};
const SECTION_ICONS = {
  vocabulary: 'box',
  terms: 'book-open',
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

function nameCol(prefix) {
  const validLangs = ['de', 'fr', 'it', 'en'];
  const l = validLangs.includes(lang) ? lang : 'en';
  return `${prefix}_${l}`;
}

function n(row, prefix) {
  const col = nameCol(prefix);
  return row[col] || row[prefix + '_en'] || row[prefix + '_de'] || '';
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

function breadcrumbHome() {
  return '<a class="breadcrumb-link" href="#/home">Home</a><span class="breadcrumb-separator"> / </span>';
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

function sortTableByColumn(th) {
  const table = th.closest('table');
  const tbody = table?.querySelector('tbody');
  if (!tbody) return;
  const idx = Array.from(th.parentNode.children).indexOf(th);
  const allThs = th.parentNode.querySelectorAll('th');

  // Determine direction: toggle if same column, else asc
  const wasAsc = th.classList.contains('sort-asc');
  const dir = wasAsc ? 'desc' : 'asc';

  // Clear all sort classes
  allThs.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
  th.classList.add('sort-' + dir);

  const rows = Array.from(tbody.rows);
  rows.sort((a, b) => {
    const aVal = (a.cells[idx]?.textContent || '').trim();
    const bVal = (b.cells[idx]?.textContent || '').trim();
    // Try numeric comparison
    const aNum = parseFloat(aVal.replace(/[^\d.-]/g, ''));
    const bNum = parseFloat(bVal.replace(/[^\d.-]/g, ''));
    if (!isNaN(aNum) && !isNaN(bNum) && aVal.match(/^[\d.,% –-]+$/)) {
      return dir === 'asc' ? aNum - bNum : bNum - aNum;
    }
    // String comparison (locale-aware)
    const cmp = aVal.localeCompare(bVal, 'de', { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
  rows.forEach(r => tbody.appendChild(r));
}

function statusBadge(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  let cls = 'badge-draft', label = status;
  if (s === 'approved' || s === 'certified') {
    cls = 'badge-certified'; label = 'Freigegeben';
  } else if (s === 'in_review' || s === 'in review') {
    cls = 'badge-review'; label = 'In Pr\u00fcfung';
  } else if (s === 'active') {
    cls = 'badge-certified'; label = 'Aktiv';
  } else if (s === 'deprecated') {
    cls = 'badge-deprecated'; label = 'Veraltet';
  } else {
    cls = 'badge-draft'; label = 'Entwurf';
  }
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
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
  const hash = window.location.hash || '#/home';
  const parts = hash.replace('#/', '').split('/');
  const section = parts[0] || 'home';

  if (section === 'search') {
    const qIdx = hash.indexOf('?q=');
    searchQuery = qIdx >= 0 ? decodeURIComponent(hash.slice(qIdx + 3)) : '';
    return { section: 'search', entityId: null, tab: null, subEntityId: null };
  }

  // Handle systems/:id/datasets/:did/:tab
  if (section === 'systems' && parts.length >= 4 && parts[2] === 'datasets') {
    return { section: 'systems', entityId: parts[1], subSection: 'datasets', subEntityId: parts[3], tab: parts[4] || 'overview' };
  }

  // Collection filter: #/vocabulary/collection/:collId/:tab
  if (parts[1] === 'collection' && parts[2]) {
    return { section, entityId: null, collectionId: parts[2], tab: parts[3] || 'table', subEntityId: null };
  }

  // List-level tabs (table/diagram) — not an entity ID
  const listTabs = ['table', 'diagram'];
  if (parts[1] && listTabs.includes(parts[1])) {
    return { section, entityId: null, collectionId: null, tab: parts[1], subEntityId: null };
  }

  return {
    section,
    entityId: parts[1] || null,
    collectionId: null,
    tab: parts[2] || 'overview',
    subEntityId: null
  };
}

function handleRoute() {
  if (relCleanup) { relCleanup(); relCleanup = null; }
  const route = parseRoute();
  currentSection = route.section;
  currentEntityId = route.entityId;
  currentCollectionId = route.collectionId || null;
  currentTab = route.tab || 'overview';

  // Auto-expand the active section in sidebar
  if (currentSection) expandedSections.add(currentSection);

  renderSidebar();

  if (route.section === 'home') {
    const main = document.getElementById('main-content');
    main.innerHTML = renderHome();
  } else if (route.section === 'search') {
    renderSearchResults();
  } else if (route.subEntityId) {
    currentTab = route.tab || 'overview';
    renderDatasetDetail(route.subEntityId, route.entityId);
  } else if (route.entityId) {
    renderDetailView(route.section, route.entityId, route.tab || 'overview');
  } else {
    renderListView(route.section, route.tab || 'table', route.collectionId);
  }

  const mainEl = document.getElementById('main-content');
  const sidebarEl = document.getElementById('sidebar');
  if (mainEl) lucide.createIcons({ nodes: [mainEl] });
  if (sidebarEl) lucide.createIcons({ nodes: [sidebarEl] });
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
function renderSidebar() {
  if (!sidebarCounts) {
    sidebarCounts = {
      vocabulary: query("SELECT COUNT(*) as c FROM concept")[0]?.c || 0,
      terms: query("SELECT COUNT(*) as c FROM term")[0]?.c || 0,
      codelists: query("SELECT COUNT(*) as c FROM code_list")[0]?.c || 0,
      systems: query("SELECT COUNT(*) as c FROM system")[0]?.c || 0,
      products: query("SELECT COUNT(*) as c FROM data_product")[0]?.c || 0,
    };
  }
  const counts = sidebarCounts;

  let html = '';

  // Home item
  const homeActive = currentSection === 'home';
  html += `<div class="nav-item${homeActive ? ' active' : ''}" data-nav="home" role="link">
    <i data-lucide="home" style="width:16px;height:16px;flex-shrink:0;"></i>
    <span>Home</span>
  </div>`;
  html += '<div class="nav-divider"></div>';

  ['terms', 'vocabulary', 'codelists', 'systems', 'products'].forEach(sec => {
    const isActive = currentSection === sec;
    const isExpanded = expandedSections.has(sec);
    const label = SECTION_LABELS[sec][lang] || SECTION_LABELS[sec]['en'];

    // Section header — active whenever user is anywhere in this section
    const headerClass = 'nav-item' + (isActive ? ' active' : '');

    html += `<div class="${headerClass}" data-nav="${sec}" role="link">
      <i data-lucide="${SECTION_ICONS[sec]}" style="width:16px;height:16px;flex-shrink:0;"></i>
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
// ============================================================
// Home View
// ============================================================
function renderHome() {
  const conceptCount = query("SELECT COUNT(*) as c FROM concept")[0]?.c || 0;
  const termCount = query("SELECT COUNT(*) as c FROM term")[0]?.c || 0;
  const codelistCount = query("SELECT COUNT(*) as c FROM code_list")[0]?.c || 0;
  const systemCount = query("SELECT COUNT(*) as c FROM system")[0]?.c || 0;
  const productCount = query("SELECT COUNT(*) as c FROM data_product")[0]?.c || 0;

  const approvedCount = query("SELECT COUNT(*) as c FROM concept WHERE status = 'approved'")[0]?.c || 0;
  const draftCount = conceptCount - approvedCount;
  const valueCount = query("SELECT COUNT(*) as c FROM code_list_value")[0]?.c || 0;
  const fieldCount = query("SELECT COUNT(*) as c FROM field")[0]?.c || 0;
  const distCount = query("SELECT COUNT(*) as c FROM distribution")[0]?.c || 0;

  // Recent activity: 5 most recently modified concepts
  const recentConcepts = query(`SELECT c.id, c.${nameCol('name')} as cname, c.status, c.modified_at,
    col.${nameCol('name')} as col_name
    FROM concept c
    LEFT JOIN collection col ON c.collection_id = col.id
    ORDER BY c.modified_at DESC LIMIT 5`);

  // Domains
  const domains = query(`SELECT col.id, col.${nameCol('name')} as cname, COUNT(c.id) as concept_count
    FROM collection col
    LEFT JOIN concept c ON c.collection_id = col.id
    GROUP BY col.id ORDER BY col.sort_order`);

  // Quality averages
  const quality = queryOne(`SELECT
    ROUND(AVG(completeness_score), 1) as avg_completeness,
    ROUND(AVG(format_validity_score), 1) as avg_validity,
    ROUND(AVG(null_percentage), 1) as avg_null
    FROM data_profile`);

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb"><span class="breadcrumb-current">Home</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title"><i data-lucide="home" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>Home</div>
    <div class="section-subtitle">BBL Datenkatalog</div>
  </div></div>`;

  // KPI cards
  html += '<div class="home-kpi-grid">';
  html += renderKpiCard('box', conceptCount, 'Geschäftsobjekte', `${approvedCount} Freigegeben \u00b7 ${draftCount} Entwurf`, '#/vocabulary/table');
  html += renderKpiCard('book-open', termCount, 'Begriffe', 'Fachbegriffe & Definitionen', '#/terms');
  html += renderKpiCard('list-ordered', codelistCount, 'Codelisten', `${valueCount} Werte`, '#/codelists');
  html += renderKpiCard('database', systemCount, 'Systeme', `${fieldCount} Felder`, '#/systems/table');
  html += renderKpiCard('package', productCount, 'Datensammlungen', `${distCount} Distributionen`, '#/products/table');
  html += '</div>';

  // Recent activity
  html += '<div class="content-section"><div class="section-label">LETZTE AKTIVIT\u00c4T</div>';
  if (recentConcepts.length > 0) {
    html += '<table class="data-table"><colgroup><col style="width:35%"><col style="width:25%"><col style="width:20%"><col style="width:20%"></colgroup><thead><tr>';
    html += '<th scope="col">Name</th><th scope="col">Domäne</th><th scope="col">Status</th><th scope="col">Geändert</th>';
    html += '</tr></thead><tbody>';
    recentConcepts.forEach(c => {
      html += `<tr class="clickable-row" data-href="#/vocabulary/${c.id}">
        <td>${escapeHtml(c.cname)}</td>
        <td>${c.col_name ? escapeHtml(c.col_name) : '&ndash;'}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${formatDate(c.modified_at)}</td>
      </tr>`;
    });
    html += '</tbody></table>';
  } else {
    html += '<p style="color:var(--color-text-secondary);">Keine Aktivit\u00e4t</p>';
  }
  html += '</div>';

  // Bottom row: domains + quality
  html += '<div class="home-bottom-grid">';

  // Domains card
  html += '<div class="content-section"><div class="section-label">DOM\u00c4NEN</div>';
  domains.forEach(d => {
    html += `<div class="home-domain-row clickable-row" data-href="#/vocabulary/table">
      <span>${escapeHtml(d.cname)}</span>
      <span class="home-domain-count">${d.concept_count} ${d.concept_count === 1 ? 'Geschäftsobjekt' : 'Geschäftsobjekte'}</span>
    </div>`;
  });
  html += '</div>';

  // Quality card — 6 dimensions
  html += '<div class="content-section"><div class="section-label">DATENQUALIT\u00c4T</div>';
  const dims = [
    { icon: 'check-circle', label: 'Vollständigkeit', score: quality?.avg_completeness },
    { icon: 'clock', label: 'Aktualität', score: null },
    { icon: 'target', label: 'Genauigkeit', score: null },
    { icon: 'git-compare', label: 'Konsistenz', score: null },
    { icon: 'shield-check', label: 'Formatkonformität', score: quality?.avg_validity },
    { icon: 'fingerprint', label: 'Eindeutigkeit', score: null }
  ];
  dims.forEach(d => {
    const hasScore = d.score != null;
    const pct = hasScore ? Math.round(d.score * 100) : null;
    const scoreColor = hasScore ? (pct >= 80 ? 'var(--color-quality-complete)' : pct >= 50 ? 'var(--color-quality-null)' : 'var(--color-status-error, #DC0018)') : null;
    html += `<div class="quality-bar-container">
      <i data-lucide="${d.icon}" style="width:15px;height:15px;color:var(--color-text-secondary);flex-shrink:0;"></i>
      <span class="quality-bar-label">${d.label}</span>
      <div class="quality-bar">`;
    if (hasScore) {
      html += `<div class="quality-bar-fill-complete" style="width:${pct}%;background:${scoreColor};"></div>`;
    }
    html += `</div>
      <span class="quality-bar-value">${hasScore ? pct + '%' : '&ndash;'}</span>
    </div>`;
  });
  html += '</div>';

  html += '</div>'; // close bottom grid
  html += '</div>'; // close content-wrapper
  return html;
}

function renderKpiCard(icon, count, label, subtitle, href) {
  return `<div class="home-kpi-card clickable-row" data-href="${href}">
    <div class="home-kpi-icon"><i data-lucide="${icon}" style="width:20px;height:20px;"></i></div>
    <div class="home-kpi-count">${count}</div>
    <div class="home-kpi-label">${escapeHtml(label)}</div>
    <div class="home-kpi-sub">${escapeHtml(subtitle)}</div>
  </div>`;
}



function renderListView(section, listTab, collectionId) {
  const main = document.getElementById('main-content');
  if (!listTab || (listTab !== 'table' && listTab !== 'diagram')) listTab = 'table';
  switch(section) {
    case 'vocabulary': main.innerHTML = renderVocabularyList(listTab, collectionId); break;
    case 'terms': main.innerHTML = renderTermsList(listTab); break;
    case 'codelists': main.innerHTML = renderCodeListsList(listTab); break;
    case 'systems': main.innerHTML = renderSystemsList(listTab); break;
    case 'products': main.innerHTML = renderProductsList(listTab); break;
    default: main.innerHTML = renderVocabularyList(listTab);
  }
}

function renderListTabBar(routeBase, activeTab, groupingOptions, activeGrouping) {
  let html = '<div class="tab-bar" role="tablist">';
  const tabs = [
    { id: 'table', label: '\u00dcbersicht' },
    { id: 'diagram', label: 'Diagramm' }
  ];
  tabs.forEach(t => {
    const isActive = t.id === activeTab;
    html += `<button class="tab${isActive ? ' active' : ''}" data-list-tab="${t.id}" data-list-route="#/${routeBase}/${t.id}" role="tab" aria-selected="${isActive}">${t.label}</button>`;
  });
  if (groupingOptions) {
    const activeLabel = groupingOptions.find(o => o.id === activeGrouping)?.label || groupingOptions[0].label;
    html += '<div class="tab-bar-spacer"></div>';
    html += '<div class="grouping-dropdown">';
    html += `<button class="grouping-btn" id="grouping-btn">Gruppierung: ${activeLabel} <i data-lucide="chevron-down" style="width:14px;height:14px;"></i></button>`;
    html += '<div class="grouping-menu" id="grouping-menu">';
    groupingOptions.forEach(o => {
      html += `<div class="grouping-option${o.id === activeGrouping ? ' active' : ''}" data-grouping="${o.id}" data-grouping-section="${routeBase}">${o.label}</div>`;
    });
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}



function renderVocabularyDiagram(collections, conceptsByCollection, ungrouped) {
  let html = '<div class="diagram-canvas">';

  // Determine layout: smaller collections (<=3) can sit side by side
  const large = [];
  const small = [];
  collections.forEach((col, i) => {
    const concepts = conceptsByCollection[col.id] || [];
    if (concepts.length <= 3) {
      small.push({ col, concepts, colorIdx: i });
    } else {
      large.push({ col, concepts, colorIdx: i });
    }
  });

  // Render large domain groups (full width)
  large.forEach(g => {
    html += renderDomainGroup(g.col, g.concepts);
  });

  // Render small domain groups side by side
  if (small.length > 0) {
    html += '<div class="diagram-row">';
    small.forEach(g => {
      html += renderDomainGroup(g.col, g.concepts);
    });
    html += '</div>';
  }

  // Ungrouped concepts
  if (ungrouped.length > 0) {
    html += renderDomainGroup({ id: 'ungrouped', ['name_' + lang]: 'Ungrouped', concept_count: ungrouped.length }, ungrouped);
  }

  html += '</div>';
  return html;
}

function renderVocabularyDiagramFlat(allConcepts) {
  let html = '<div class="diagram-canvas">';
  html += renderDomainGroup({ id: 'all', ['name_' + lang]: 'Alle Geschäftsobjekte', concept_count: allConcepts.length }, allConcepts);
  html += '</div>';
  return html;
}

function renderDomainGroup(col, concepts) {
  let html = `<div class="domain-group">`;
  html += `<div class="domain-group-header">`;
  html += `<span class="domain-group-title">${escapeHtml(n(col, 'name'))}</span>`;
  html += `<span class="domain-group-count">${concepts.length}</span>`;
  html += `</div>`;
  html += '<div class="domain-group-concepts">';
  concepts.forEach(c => {
    const def = getDefinitionText(c.definition, lang);
    const tooltip = def ? escapeHtml(n(c, 'name')) + '&#10;&#10;' + escapeHtml(def.substring(0, 150)) + (def.length > 150 ? '...' : '') : escapeHtml(n(c, 'name'));
    html += `<a class="concept-box" href="${c.href || '#/vocabulary/' + c.id}" title="${tooltip}">`;
    html += `<span class="concept-box-name">${escapeHtml(n(c, 'name'))}</span>`;
    html += `</a>`;
  });
  html += '</div></div>';
  return html;
}


function renderVocabularyList(listTab, collectionId) {
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

  // If filtered by collection
  const activeCollection = collectionId ? collections.find(c => c.id === collectionId) : null;
  const filteredCollections = activeCollection ? [activeCollection] : collections;
  const filteredUngrouped = activeCollection ? [] : ungrouped;
  const filteredCount = activeCollection ? (conceptsByCollection[collectionId] || []).length : totalConcepts;
  const tabBaseRoute = activeCollection ? 'vocabulary/collection/' + collectionId : 'vocabulary';

  let html = '<div class="content-wrapper">';
  // Breadcrumb
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome();
  if (activeCollection) {
    html += `<a class="breadcrumb-link" href="#/vocabulary">${SECTION_LABELS.vocabulary[lang]}</a>`;
    html += '<span class="breadcrumb-separator"> / </span>';
    html += `<span class="breadcrumb-current">${escapeHtml(n(activeCollection, 'name'))}</span>`;
  } else {
    html += `<span class="breadcrumb-current">${SECTION_LABELS.vocabulary[lang]}</span>`;
  }
  html += '</nav>';

  html += `<div class="section-header"><div>
    <div class="section-title"><i data-lucide="${SECTION_ICONS.vocabulary}" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>${activeCollection ? escapeHtml(n(activeCollection, 'name')) : SECTION_LABELS.vocabulary[lang]} (${filteredCount})</div>
    <div class="section-subtitle">Lösungsneutrale Geschäftsobjekte und ihre fachlichen Attribute.</div>
  </div></div>`;

  const vocabGroupOpts = activeCollection ? null : [
    { id: 'domain', label: 'Domäne' },
    { id: 'status', label: 'Status' },
    { id: 'steward', label: 'Verantwortlich' },
    { id: 'none', label: 'Keine' }
  ];
  html += renderListTabBar(tabBaseRoute, listTab, vocabGroupOpts, grouping.vocabulary);

  // Build collection lookup
  const collectionMap = {};
  collections.forEach(col => { collectionMap[col.id] = col; });


  // Build generic groups based on grouping.vocabulary
  function getGroupKey(c) {
    if (grouping.vocabulary === 'domain') {
      const col = c.collection_id ? collectionMap[c.collection_id] : null;
      return col ? n(col, 'name') : 'Ohne Domäne';
    }
    if (grouping.vocabulary === 'status') return STATUS_LABELS[c.status] || c.status || 'Unbekannt';
    if (grouping.vocabulary === 'steward') return c.steward_name || 'Nicht zugewiesen';
    return null;
  }

  // Diagram
  if (listTab === 'diagram') {
    if (!activeCollection && grouping.vocabulary === 'none') {
      html += renderVocabularyDiagramFlat(allConcepts);
    } else if (!activeCollection && grouping.vocabulary !== 'domain') {
      // Generic grouped diagram
      const groups = {};
      allConcepts.forEach(c => { const k = getGroupKey(c); if (!groups[k]) groups[k] = []; groups[k].push(c); });
      html += '<div class="diagram-canvas">';
      Object.keys(groups).forEach(k => {
        html += renderDomainGroup({ id: k, ['name_' + lang]: k, concept_count: groups[k].length }, groups[k]);
      });
      html += '</div>';
    } else {
      html += renderVocabularyDiagram(filteredCollections, conceptsByCollection, filteredUngrouped);
    }
    html += '</div>';
    return html;
  }

  if (allConcepts.length === 0) {
    html += renderEmptyState('book-open', 'Keine Geschäftsobjekte', 'Es wurden noch keine Geschäftsobjekte angelegt.');
    html += '</div>';
    return html;
  }

  html += '<div class="list-panel">';

  // Row renderer — always includes Domäne column
  function conceptRow(c) {
    const desc = getDefinitionText(c.definition, lang);
    const col = c.collection_id ? collectionMap[c.collection_id] : null;
    const domainName = col ? n(col, 'name') : '–';
    return `<tr class="clickable-row" data-href="#/vocabulary/${c.id}">
      <td>${escapeHtml(n(c, 'name'))}</td>
      <td>${escapeHtml(domainName)}</td>
      <td>${desc ? escapeHtml(desc.substring(0, 80)) + (desc.length > 80 ? '...' : '') : '&ndash;'}</td>
      <td>${c.mapping_count > 0 ? c.mapping_count : '&ndash;'}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.steward_name ? escapeHtml(c.steward_name) : '&ndash;'}</td>
    </tr>`;
  }

  const colgroup = '<colgroup><col style="width:17%"><col style="width:15%"><col style="width:28%"><col style="width:8%"><col style="width:10%"><col style="width:22%"></colgroup>';
  const thead = '<thead><tr><th scope="col">Name</th><th scope="col">Domäne</th><th scope="col">Beschreibung</th><th scope="col">Felder</th><th scope="col">Status</th><th scope="col">Verantwortlich</th></tr></thead>';

  if (activeCollection || grouping.vocabulary === 'none') {
    // Flat table
    const concepts = activeCollection ? (conceptsByCollection[collectionId] || []) : allConcepts;
    html += `<table class="data-table">${colgroup}${thead}<tbody>`;
    concepts.forEach(c => { html += conceptRow(c); });
    html += '</tbody></table>';
  } else if (grouping.vocabulary === 'domain') {
    // Grouped by collection
    filteredCollections.forEach(col => {
      const concepts = conceptsByCollection[col.id] || [];
      html += `<div class="group-header" data-toggle-group="${col.id}">
        <i data-lucide="chevron-down" style="width:16px;height:16px;" class="group-chevron"></i>
        <span class="group-header-title">${escapeHtml(n(col, 'name'))} (${col.concept_count})</span>
      </div>`;
      html += `<div class="group-content" data-group="${col.id}">`;
      html += `<table class="data-table">${colgroup}${thead}<tbody>`;
      concepts.forEach(c => { html += conceptRow(c); });
      html += '</tbody></table></div>';
    });

    if (filteredUngrouped.length > 0) {
      html += `<div class="group-header"><i data-lucide="chevron-down" style="width:16px;height:16px;"></i>
        <span class="group-header-title">Ohne Domäne (${filteredUngrouped.length})</span></div>`;
      html += `<div class="group-content"><table class="data-table">${colgroup}${thead}<tbody>`;
      filteredUngrouped.forEach(c => { html += conceptRow(c); });
      html += '</tbody></table></div>';
    }
  } else {
    // Generic grouping (status, steward)
    const groups = {};
    allConcepts.forEach(c => { const k = getGroupKey(c); if (!groups[k]) groups[k] = []; groups[k].push(c); });
    Object.keys(groups).sort().forEach(k => {
      const items = groups[k];
      html += `<div class="group-header" data-toggle-group="g-${k}">
        <i data-lucide="chevron-down" style="width:16px;height:16px;" class="group-chevron"></i>
        <span class="group-header-title">${escapeHtml(k)} (${items.length})</span>
      </div>`;
      html += `<div class="group-content" data-group="g-${k}">`;
      html += `<table class="data-table">${colgroup}${thead}<tbody>`;
      items.forEach(c => { html += conceptRow(c); });
      html += '</tbody></table></div>';
    });
  }

  html += '</div>'; // close list-panel
  html += '</div>'; // close content-wrapper
  return html;
}

function renderCodeListsList(listTab) {
  if (!listTab || (listTab !== 'table' && listTab !== 'diagram')) listTab = 'table';
  // Fetch codelists with domain via concept_attribute → concept → collection
  const codeLists = query(`SELECT cl.*,
    COALESCE(vc.value_count, 0) as value_count,
    COALESCE(vc.deprecated_count, 0) as deprecated_count,
    dom.domain_name
    FROM code_list cl
    LEFT JOIN (
      SELECT code_list_id,
        COUNT(*) as value_count,
        SUM(CASE WHEN deprecated = 1 THEN 1 ELSE 0 END) as deprecated_count
      FROM code_list_value GROUP BY code_list_id
    ) vc ON vc.code_list_id = cl.id
    LEFT JOIN (
      SELECT ca.code_list_id, MIN(col.${nameCol('name')}) as domain_name
      FROM concept_attribute ca
      JOIN concept c ON ca.concept_id = c.id
      JOIN collection col ON c.collection_id = col.id
      GROUP BY ca.code_list_id
    ) dom ON dom.code_list_id = cl.id
    ORDER BY cl.${nameCol('name')}`);

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome() + '<span class="breadcrumb-current">' + SECTION_LABELS.codelists[lang] + '</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title"><i data-lucide="${SECTION_ICONS.codelists}" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>${SECTION_LABELS.codelists[lang]} (${codeLists.length})</div>
    <div class="section-subtitle">Standardisierte Wertelisten für Attribute der Geschäftsobjekte.</div>
  </div></div>`;

  const groupingOpts = [
    { id: 'domain', label: 'Domäne' },
    { id: 'source', label: 'Quelle' },
    { id: 'none', label: 'Keine' }
  ];
  html += renderListTabBar('codelists', listTab, groupingOpts, grouping.codelists);

  if (codeLists.length === 0) {
    html += renderEmptyState('list-ordered', 'Keine Codelisten', 'Es wurden noch keine Codelisten angelegt.');
    html += '</div>';
    return html;
  }

  function getClGroupKey(cl) {
    if (grouping.codelists === 'domain') return cl.domain_name || 'Ohne Domäne';
    if (grouping.codelists === 'source') return cl.source_ref || 'Andere';
    return null;
  }

  if (listTab === 'diagram') {
    html += '<div class="diagram-canvas">';
    if (grouping.codelists === 'none') {
      html += renderDomainGroup({ id: 'all', ['name_' + lang]: 'Alle Codelisten', concept_count: codeLists.length }, codeLists.map(cl => ({ id: cl.id, ['name_' + lang]: n(cl, 'name'), href: '#/codelists/' + cl.id })));
    } else {
      const groups = {};
      codeLists.forEach(cl => { const k = getClGroupKey(cl); if (!groups[k]) groups[k] = []; groups[k].push(cl); });
      const large = [], small = [];
      Object.keys(groups).sort().forEach(k => {
        const mapped = groups[k].map(cl => ({ id: cl.id, ['name_' + lang]: n(cl, 'name'), href: '#/codelists/' + cl.id }));
        if (mapped.length > 3) large.push({ k, items: mapped }); else small.push({ k, items: mapped });
      });
      large.forEach(g => { html += renderDomainGroup({ id: g.k, ['name_' + lang]: g.k, concept_count: g.items.length }, g.items); });
      if (small.length) { html += '<div class="diagram-row">'; small.forEach(g => { html += renderDomainGroup({ id: g.k, ['name_' + lang]: g.k, concept_count: g.items.length }, g.items); }); html += '</div>'; }
    }
    html += '</div></div>';
    return html;
  }

  const colgroup = '<colgroup><col style="width:18%"><col style="width:14%"><col style="width:25%"><col style="width:8%"><col style="width:12%"><col style="width:23%"></colgroup>';
  const thead = '<thead><tr><th scope="col">Name</th><th scope="col">Domäne</th><th scope="col">Beschreibung</th><th scope="col">Werte</th><th scope="col">Status</th><th scope="col">Verantwortlich</th></tr></thead>';

  function clRow(cl) {
    const desc = getDefinitionText(cl.description, lang);
    const clStatus = (cl.value_count > 0 && cl.deprecated_count === cl.value_count) ? 'deprecated' : 'approved';
    return `<tr class="clickable-row" data-href="#/codelists/${cl.id}">
      <td>${escapeHtml(n(cl, 'name'))}</td>
      <td>${cl.domain_name ? escapeHtml(cl.domain_name) : '&ndash;'}</td>
      <td>${desc ? escapeHtml(desc.substring(0, 80)) + (desc.length > 80 ? '...' : '') : '&ndash;'}</td>
      <td>${cl.value_count}</td>
      <td>${statusBadge(clStatus)}</td>
      <td><span style="color:var(--color-text-placeholder);font-size:var(--text-small);">Nicht zugewiesen</span></td>
    </tr>`;
  }

  html += '<div class="list-panel">';
  if (grouping.codelists === 'none') {
    html += `<table class="data-table">${colgroup}${thead}<tbody>`;
    codeLists.forEach(cl => { html += clRow(cl); });
    html += '</tbody></table>';
  } else {
    const groups = {};
    codeLists.forEach(cl => { const k = getClGroupKey(cl); if (!groups[k]) groups[k] = []; groups[k].push(cl); });
    Object.keys(groups).sort().forEach(k => {
      const items = groups[k];
      html += `<div class="group-header" data-toggle-group="cl-${k}">
        <i data-lucide="chevron-down" style="width:16px;height:16px;" class="group-chevron"></i>
        <span class="group-header-title">${escapeHtml(k)} (${items.length})</span>
      </div>`;
      html += `<div class="group-content" data-group="cl-${k}">`;
      html += `<table class="data-table">${colgroup}${thead}<tbody>`;
      items.forEach(cl => { html += clRow(cl); });
      html += '</tbody></table></div>';
    });
  }
  html += '</div></div>';
  return html;
}

function renderTermsList(listTab) {
  if (!listTab || (listTab !== 'table' && listTab !== 'diagram')) listTab = 'table';
  // Fetch terms with domain name via concept_term → concept → collection
  const terms = query(`SELECT t.*,
    MIN(col.${nameCol('name')}) as domain_name
    FROM term t
    LEFT JOIN concept_term ct ON ct.term_id = t.id
    LEFT JOIN concept c ON ct.concept_id = c.id
    LEFT JOIN collection col ON c.collection_id = col.id
    GROUP BY t.id
    ORDER BY t.${nameCol('name')}`);
  const totalCount = terms.length;

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome() + '<span class="breadcrumb-current">' + SECTION_LABELS.terms[lang] + '</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title"><i data-lucide="${SECTION_ICONS.terms}" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>${SECTION_LABELS.terms[lang]} (${totalCount})</div>
    <div class="section-subtitle">Fachbegriffe und Definitionen aus Standards, Gesetzen und Normen.</div>
  </div></div>`;

  const groupingOpts = [
    { id: 'domain', label: 'Domäne' },
    { id: 'status', label: 'Status' },
    { id: 'none', label: 'Keine' }
  ];
  html += renderListTabBar('terms', listTab, groupingOpts, grouping.terms);

  if (totalCount === 0) {
    html += renderEmptyState('book-open', 'Keine Begriffe', 'Es wurden noch keine Begriffe angelegt.');
    html += '</div>';
    return html;
  }



  function getTermGroupKey(t) {
    if (grouping.terms === 'domain') return t.domain_name || 'Ohne Domäne';
    if (grouping.terms === 'status') return STATUS_LABELS[t.status] || t.status || 'Unbekannt';
    return null;
  }

  if (listTab === 'diagram') {
    html += '<div class="diagram-canvas">';
    if (grouping.terms === 'none') {
      html += renderDomainGroup({ id: 'all', ['name_' + lang]: 'Alle Begriffe' }, terms.map(t => ({ ...t, href: '#/terms/' + t.id })));
    } else {
      const groups = {};
      terms.forEach(t => { const k = getTermGroupKey(t); if (!groups[k]) groups[k] = []; groups[k].push(t); });
      const large = [], small = [];
      Object.keys(groups).sort().forEach(k => {
        if (groups[k].length > 3) large.push({ src: k, items: groups[k] }); else small.push({ src: k, items: groups[k] });
      });
      large.forEach(g => { html += renderDomainGroup({ id: g.src, ['name_' + lang]: g.src }, g.items.map(t => ({ ...t, href: '#/terms/' + t.id }))); });
      if (small.length) { html += '<div class="diagram-row">'; small.forEach(g => { html += renderDomainGroup({ id: g.src, ['name_' + lang]: g.src }, g.items.map(t => ({ ...t, href: '#/terms/' + t.id }))); }); html += '</div>'; }
    }
    html += '</div></div>';
    return html;
  }

  const colgroup = '<colgroup><col style="width:18%"><col style="width:15%"><col style="width:35%"><col style="width:12%"><col style="width:20%"></colgroup>';
  const thead = '<thead><tr><th scope="col">Name</th><th scope="col">Domäne</th><th scope="col">Beschreibung</th><th scope="col">Status</th><th scope="col">Standard</th></tr></thead>';

  html += '<div class="list-panel">';

  function termRow(t) {
    const def = getDefinitionText(t.definition, lang);
    return `<tr class="clickable-row" data-href="#/terms/${t.id}">
      <td>${escapeHtml(n(t, 'name'))}</td>
      <td>${t.domain_name ? escapeHtml(t.domain_name) : '&ndash;'}</td>
      <td>${def ? escapeHtml(def.substring(0, 100)) + (def.length > 100 ? '...' : '') : '&ndash;'}</td>
      <td>${statusBadge(t.status)}</td>
      <td>${t.standard_ref ? escapeHtml(t.standard_ref) : '&ndash;'}</td>
    </tr>`;
  }

  if (grouping.terms === 'none') {
    html += `<table class="data-table">${colgroup}${thead}<tbody>`;
    terms.forEach(t => { html += termRow(t); });
    html += '</tbody></table>';
  } else {
    const activeGroups = {};
    terms.forEach(t => { const k = getTermGroupKey(t); if (!activeGroups[k]) activeGroups[k] = []; activeGroups[k].push(t); });
    Object.keys(activeGroups).sort().forEach(k => {
      const items = activeGroups[k];
      html += `<div class="group-header" data-toggle-group="t-${k}">
        <i data-lucide="chevron-down" style="width:16px;height:16px;" class="group-chevron"></i>
        <span class="group-header-title">${escapeHtml(k)} (${items.length})</span>
      </div>`;
      html += `<div class="group-content" data-group="t-${k}">`;
      html += `<table class="data-table">${colgroup}${thead}<tbody>`;
      items.forEach(t => { html += termRow(t); });
      html += '</tbody></table></div>';
    });
  }

  html += '</div></div>';
  return html;
}



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

function renderSystemsList(listTab) {
  if (!listTab || (listTab !== 'table' && listTab !== 'diagram')) listTab = 'table';
  const systems = query(`SELECT s.*,
    c.name as owner_name, c.organisation as owner_org,
    COALESCE(ds_counts.dataset_count, 0) as dataset_count
    FROM system s
    LEFT JOIN contact c ON s.owner_id = c.id
    LEFT JOIN (SELECT sc.system_id, COUNT(*) as dataset_count FROM dataset d JOIN schema_ sc ON d.schema_id = sc.id GROUP BY sc.system_id) ds_counts ON ds_counts.system_id = s.id
    ORDER BY s.${nameCol('name')}`);

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome() + '<span class="breadcrumb-current">' + SECTION_LABELS.systems[lang] + '</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title"><i data-lucide="${SECTION_ICONS.systems}" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>${SECTION_LABELS.systems[lang]} (${systems.length})</div>
    <div class="section-subtitle">Physische Quellsysteme mit Tabellen, Datasets und Feldern.</div>
  </div></div>`;

  const groupingOpts = [
    { id: 'technology', label: 'Technologie' },
    { id: 'status', label: 'Status' },
    { id: 'none', label: 'Keine' }
  ];
  html += renderListTabBar('systems', listTab, groupingOpts, grouping.systems);

  if (systems.length === 0) {
    html += renderEmptyState('database', 'Keine Systeme', 'Es wurden noch keine Systeme registriert.');
    html += '</div>';
    return html;
  }

  if (listTab === 'diagram') {
    html += '<div class="diagram-canvas">';
    if (grouping.systems === 'none') {
      html += renderDomainGroup({ id: 'all', ['name_' + lang]: 'Alle Systeme', concept_count: systems.length }, systems.map(s => ({ id: s.id, ['name_' + lang]: n(s, 'name'), href: '#/systems/' + s.id })));
    } else {
      const groups = {};
      systems.forEach(s => {
        const k = grouping.systems === 'technology' ? (s.technology_stack || 'Unbekannt') : (s.active ? 'Aktiv' : 'Veraltet');
        if (!groups[k]) groups[k] = [];
        groups[k].push(s);
      });
      const large = [], small = [];
      Object.keys(groups).sort().forEach(k => {
        const mapped = groups[k].map(s => ({ id: s.id, ['name_' + lang]: n(s, 'name'), href: '#/systems/' + s.id }));
        if (mapped.length > 3) large.push({ k, items: mapped }); else small.push({ k, items: mapped });
      });
      large.forEach(g => { html += renderDomainGroup({ id: g.k, ['name_' + lang]: g.k, concept_count: g.items.length }, g.items); });
      if (small.length) { html += '<div class="diagram-row">'; small.forEach(g => { html += renderDomainGroup({ id: g.k, ['name_' + lang]: g.k, concept_count: g.items.length }, g.items); }); html += '</div>'; }
    }
    html += '</div></div>';
    return html;
  }

  const colgroup = '<colgroup><col style="width:18%"><col style="width:28%"><col style="width:14%"><col style="width:10%"><col style="width:10%"><col style="width:20%"></colgroup>';
  const thead = '<thead><tr><th scope="col">Name</th><th scope="col">Beschreibung</th><th scope="col">Technologie</th><th scope="col">Tabellen</th><th scope="col">Status</th><th scope="col">Verantwortlich</th></tr></thead>';

  function sysRow(s) {
    const desc = getDefinitionText(s.description, lang);
    return `<tr class="clickable-row" data-href="#/systems/${s.id}">
      <td>${escapeHtml(n(s, 'name'))}</td>
      <td>${desc ? escapeHtml(desc.substring(0, 80)) + (desc.length > 80 ? '...' : '') : '&ndash;'}</td>
      <td>${s.technology_stack ? escapeHtml(s.technology_stack) : '&ndash;'}</td>
      <td>${s.dataset_count}</td>
      <td>${s.active ? statusBadge('active') : statusBadge('deprecated')}</td>
      <td>${s.owner_name ? escapeHtml(s.owner_name) : '&ndash;'}</td>
    </tr>`;
  }

  html += '<div class="list-panel">';
  if (grouping.systems === 'none') {
    html += `<table class="data-table">${colgroup}${thead}<tbody>`;
    systems.forEach(s => { html += sysRow(s); });
    html += '</tbody></table>';
  } else {
    const groups = {};
    systems.forEach(s => {
      const k = grouping.systems === 'technology' ? (s.technology_stack || 'Unbekannt') : (s.active ? 'Aktiv' : 'Veraltet');
      if (!groups[k]) groups[k] = [];
      groups[k].push(s);
    });
    Object.keys(groups).sort().forEach(k => {
      const items = groups[k];
      html += `<div class="group-header" data-toggle-group="sys-${k}">
        <i data-lucide="chevron-down" style="width:16px;height:16px;" class="group-chevron"></i>
        <span class="group-header-title">${escapeHtml(k)} (${items.length})</span>
      </div>`;
      html += `<div class="group-content" data-group="sys-${k}">`;
      html += `<table class="data-table">${colgroup}${thead}<tbody>`;
      items.forEach(s => { html += sysRow(s); });
      html += '</tbody></table></div>';
    });
  }
  html += '</div></div>';
  return html;
}

function renderProductsList(listTab) {
  if (!listTab || (listTab !== 'table' && listTab !== 'diagram')) listTab = 'table';
  const products = query(`SELECT dp.*,
    COALESCE(dc.dist_count, 0) as dist_count
    FROM data_product dp
    LEFT JOIN (SELECT data_product_id, COUNT(*) as dist_count FROM distribution GROUP BY data_product_id) dc ON dc.data_product_id = dp.id
    ORDER BY dp.${nameCol('name')}`);

  // Pre-fetch all formats in one query
  const allFormats = query("SELECT data_product_id, GROUP_CONCAT(DISTINCT format) as formats FROM distribution WHERE format IS NOT NULL GROUP BY data_product_id");
  const formatMap = {};
  allFormats.forEach(f => { formatMap[f.data_product_id] = f.formats || ''; });

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome() + '<span class="breadcrumb-current">' + SECTION_LABELS.products[lang] + '</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title"><i data-lucide="${SECTION_ICONS.products}" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>${SECTION_LABELS.products[lang]} (${products.length})</div>
    <div class="section-subtitle">Aufbereitete und publizierte Datensammlungen mit Distributionen.</div>
  </div></div>`;

  const groupingOpts = [
    { id: 'publisher', label: 'Herausgeber' },
    { id: 'status', label: 'Status' },
    { id: 'none', label: 'Keine' }
  ];
  html += renderListTabBar('products', listTab, groupingOpts, grouping.products);

  if (products.length === 0) {
    html += renderEmptyState('package', 'Keine Datenprodukte', 'Es wurden noch keine Datenprodukte angelegt.');
    html += '</div>';
    return html;
  }

  function getProductGroupKey(dp) {
    if (grouping.products === 'publisher') return dp.publisher || 'Unbekannt';
    if (grouping.products === 'status') return dp.certified ? 'Zertifiziert' : 'Nicht zertifiziert';
    return null;
  }

  if (listTab === 'diagram') {
    html += '<div class="diagram-canvas">';
    if (grouping.products === 'none') {
      html += renderDomainGroup({ id: 'all', ['name_' + lang]: 'Alle Datensammlungen', concept_count: products.length }, products.map(dp => ({ id: dp.id, ['name_' + lang]: n(dp, 'name'), href: '#/products/' + dp.id })));
    } else {
      const groups = {};
      products.forEach(dp => { const k = getProductGroupKey(dp); if (!groups[k]) groups[k] = []; groups[k].push(dp); });
      const large = [], small = [];
      Object.keys(groups).sort().forEach(k => {
        const mapped = groups[k].map(dp => ({ id: dp.id, ['name_' + lang]: n(dp, 'name'), href: '#/products/' + dp.id }));
        if (mapped.length > 3) large.push({ k, items: mapped }); else small.push({ k, items: mapped });
      });
      large.forEach(g => { html += renderDomainGroup({ id: g.k, ['name_' + lang]: g.k, concept_count: g.items.length }, g.items); });
      if (small.length) { html += '<div class="diagram-row">'; small.forEach(g => { html += renderDomainGroup({ id: g.k, ['name_' + lang]: g.k, concept_count: g.items.length }, g.items); }); html += '</div>'; }
    }
    html += '</div></div>';
    return html;
  }

  const colgroup = '<colgroup><col style="width:18%"><col style="width:27%"><col style="width:13%"><col style="width:12%"><col style="width:10%"><col style="width:20%"></colgroup>';
  const thead = '<thead><tr><th scope="col">Name</th><th scope="col">Beschreibung</th><th scope="col">Formate</th><th scope="col">Häufigkeit</th><th scope="col">Status</th><th scope="col">Verantwortlich</th></tr></thead>';

  function productRow(dp) {
    const desc = getDefinitionText(dp.description, lang);
    const formatStr = (formatMap[dp.id] || '').split(',').map(f => escapeHtml(f.trim())).filter(Boolean).join(', ');
    return `<tr class="clickable-row" data-href="#/products/${dp.id}">
      <td>${escapeHtml(n(dp, 'name'))}</td>
      <td>${desc ? escapeHtml(desc.substring(0, 80)) + (desc.length > 80 ? '...' : '') : '&ndash;'}</td>
      <td>${formatStr || '&ndash;'}</td>
      <td>${dp.update_frequency ? escapeHtml(dp.update_frequency) : '&ndash;'}</td>
      <td>${certifiedBadge(dp.certified)}</td>
      <td>${dp.publisher ? escapeHtml(dp.publisher) : '&ndash;'}</td>
    </tr>`;
  }

  html += '<div class="list-panel">';
  if (grouping.products === 'none') {
    html += `<table class="data-table">${colgroup}${thead}<tbody>`;
    products.forEach(dp => { html += productRow(dp); });
    html += '</tbody></table>';
  } else {
    const groups = {};
    products.forEach(dp => { const k = getProductGroupKey(dp); if (!groups[k]) groups[k] = []; groups[k].push(dp); });
    Object.keys(groups).sort().forEach(k => {
      const items = groups[k];
      html += `<div class="group-header" data-toggle-group="dp-${k}">
        <i data-lucide="chevron-down" style="width:16px;height:16px;" class="group-chevron"></i>
        <span class="group-header-title">${escapeHtml(k)} (${items.length})</span>
      </div>`;
      html += `<div class="group-content" data-group="dp-${k}">`;
      html += `<table class="data-table">${colgroup}${thead}<tbody>`;
      items.forEach(dp => { html += productRow(dp); });
      html += '</tbody></table></div>';
    });
  }
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

function renderRelGraph(centerLabel, satellites) {
  if (satellites.length === 0) return '';
  let html = '<div class="content-section" style="padding:0;overflow:hidden;">';
  html += '<div id="rel-viewport" class="rel-viewport" style="width:100%;height:calc(100vh - 240px);min-height:400px;">';
  html += '<div id="rel-canvas"></div>';
  html += '<div id="rel-tooltip" class="rel-tooltip"></div>';
  html += '<div id="rel-panel" class="rel-panel"></div>';
  html += '</div></div>';
  relGraphData = { conceptName: centerLabel, satellites };
  setTimeout(initRelationshipSVG, 50);
  return html;
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

function initRelationshipSVG() {
  const viewport = document.getElementById('rel-viewport');
  const canvas = document.getElementById('rel-canvas');
  const panel = document.getElementById('rel-panel');
  if (!viewport || !canvas || !relGraphData) return;

  const { conceptName, satellites } = relGraphData;

  const canvasSize = 1000;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const orbitRadius = 300;
  const minOuterR = 70;
  const perItemR = 25; // extra radius per item
  const ringGap = 20; // constant gap between outer and inner ring (all circles)

  canvas.style.width = canvasSize + 'px';
  canvas.style.height = canvasSize + 'px';
  canvas.style.position = 'absolute';

  // Calculate dynamic radius per satellite based on item count
  // Badge always at -135° (top-left) from satellite center, constant offset from outer ring
  const badgeOffset = 18; // gap from outer ring edge to badge center
  const badgeAngleFixed = -Math.PI * 3 / 4; // -135° = top-left

  const satData = satellites.map((sat, i) => {
    const outerR = Math.max(minOuterR, 50 + sat.items.length * perItemR);
    const innerR = outerR - ringGap;
    const angle = (2 * Math.PI * i / satellites.length) - Math.PI / 2;
    const x = cx + orbitRadius * Math.cos(angle);
    const y = cy + orbitRadius * Math.sin(angle);
    return { sat, x, y, outerR, innerR, angle };
  });

  // SVG: connector lines (center→satellite) + badge connector lines (badge→outer ring)
  let svg = `<svg class="rel-svg" width="${canvasSize}" height="${canvasSize}" xmlns="http://www.w3.org/2000/svg">`;
  satData.forEach(s => {
    // Line from center to satellite
    svg += `<line x1="${cx}" y1="${cy}" x2="${s.x}" y2="${s.y}" stroke="#D8D8D5" stroke-width="1.5"/>`;
    // Badge connector: line from badge center to outer ring edge (both at -135°)
    const badgeDist = s.outerR + badgeOffset;
    const bx = s.x + badgeDist * Math.cos(badgeAngleFixed);
    const by = s.y + badgeDist * Math.sin(badgeAngleFixed);
    const ringX = s.x + s.outerR * Math.cos(badgeAngleFixed);
    const ringY = s.y + s.outerR * Math.sin(badgeAngleFixed);
    svg += `<line x1="${bx}" y1="${by}" x2="${ringX}" y2="${ringY}" stroke="#6B6B66" stroke-width="1.5"/>`;
  });
  svg += '</svg>';

  let html = svg;

  // Center node — use same ringGap
  const centerInnerR = 34;
  const centerOuterR = centerInnerR + ringGap;
  html += `<div class="rel-center" style="left:${cx}px;top:${cy}px;">`;
  html += `<div class="rel-center-outer" style="width:${centerOuterR*2}px;height:${centerOuterR*2}px;">`;
  html += `<div class="rel-center-inner" style="width:${centerInnerR*2}px;height:${centerInnerR*2}px;">`;
  html += '<i data-lucide="box" style="width:26px;height:26px;color:#fff;"></i>';
  html += '</div></div>';
  html += `<div class="rel-center-label">${escapeHtml(conceptName)}</div>`;
  html += '</div>';

  // Satellites
  satData.forEach(s => {
    const outerD = s.outerR * 2;
    const innerD = s.innerR * 2;

    html += `<div class="rel-satellite" data-group="${escapeHtml(s.sat.title)}" style="left:${s.x}px;top:${s.y}px;width:${outerD}px;height:${outerD}px;">`;
    html += `<div class="rel-satellite-outer" style="width:${outerD}px;height:${outerD}px;">`;
    html += `<div class="rel-satellite-inner" style="width:${innerD}px;height:${innerD}px;">`;
    html += '<div class="rel-satellite-items">';

    s.sat.items.forEach(item => {
      const tag = item.href ? 'a' : 'div';
      const hrefAttr = item.href ? ` href="${item.href}/relationships"` : '';
      const meta = item.meta || '';
      html += `<${tag} class="rel-item" data-rel-info="${escapeHtml(item.label)}" data-rel-type="${escapeHtml(s.sat.title)}" data-rel-meta="${escapeHtml(meta)}"${hrefAttr}>`;
      html += `<i data-lucide="${item.icon}" style="width:22px;height:22px;color:${s.sat.color};"></i>`;
      html += `<span class="rel-item-label">${escapeHtml(item.label.length > 14 ? item.label.substring(0, 13) + '\u2026' : item.label)}</span>`;
      html += `</${tag}>`;
    });

    html += '</div></div></div>';
    // Count badge — top-left 45°, constant offset from outer ring
    const badgeDist = s.outerR + badgeOffset;
    const badgeLocalX = s.outerR + badgeDist * Math.cos(badgeAngleFixed) - 12;
    const badgeLocalY = s.outerR + badgeDist * Math.sin(badgeAngleFixed) - 12;
    html += `<div class="rel-satellite-count" style="left:${badgeLocalX}px;top:${badgeLocalY}px;">${s.sat.items.length}</div>`;
    html += `<div class="rel-satellite-title">${escapeHtml(s.sat.title)}</div>`;
    html += '</div>';
  });

  canvas.innerHTML = html;

  // --- Right panel: search + show checkboxes ---
  let panelHtml = '<div class="rel-panel-nav">';
  panelHtml += '<button class="rel-panel-btn" id="rel-zoom-in" title="Zoom in"><i data-lucide="zoom-in" style="width:16px;height:16px;"></i></button>';
  panelHtml += '<button class="rel-panel-btn" id="rel-zoom-out" title="Zoom out"><i data-lucide="zoom-out" style="width:16px;height:16px;"></i></button>';
  panelHtml += '<button class="rel-panel-btn" id="rel-reset" title="Reset"><i data-lucide="maximize-2" style="width:16px;height:16px;"></i></button>';
  panelHtml += '</div>';
  panelHtml += '<input type="text" class="rel-panel-search" id="rel-search" placeholder="Find...">';
  panelHtml += '<div class="rel-panel-title">Show</div>';
  satellites.forEach(sat => {
    panelHtml += `<label class="rel-panel-item">
      <input type="checkbox" checked data-rel-toggle="${escapeHtml(sat.title)}">
      <span>${escapeHtml(sat.title)}</span>
    </label>`;
  });
  panel.innerHTML = panelHtml;

  lucide.createIcons({ nodes: [canvas] });

  // --- Zoom & Pan ---
  let scale = 1, panX = 0, panY = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;

  function applyTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    canvas.style.transformOrigin = '0 0';
  }
  function centerCanvas() {
    const vw = viewport.offsetWidth;
    const vh = viewport.offsetHeight;
    panX = (vw - canvasSize) / 2;
    panY = (vh - canvasSize) / 2;
    applyTransform();
  }
  centerCanvas();

  viewport.addEventListener('wheel', function(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.3, scale * delta));
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    panX = mx - (mx - panX) * (newScale / scale);
    panY = my - (my - panY) * (newScale / scale);
    scale = newScale;
    applyTransform();
  }, { passive: false });

  viewport.addEventListener('mousedown', function(e) {
    if (e.target.closest('a') || e.target.closest('.rel-panel')) return;
    isDragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    panStartX = panX; panStartY = panY;
  });
  const onMouseMove = function(e) {
    if (!isDragging) return;
    panX = panStartX + (e.clientX - dragStartX);
    panY = panStartY + (e.clientY - dragStartY);
    applyTransform();
  };
  const onMouseUp = function() { isDragging = false; };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  relCleanup = function() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  // --- Tooltip (dark info box) ---
  const tooltip = document.getElementById('rel-tooltip');
  canvas.addEventListener('mouseover', function(e) {
    const item = e.target.closest('[data-rel-info]');
    if (item && tooltip) {
      const name = item.dataset.relInfo;
      const type = item.dataset.relType || '';
      const meta = item.dataset.relMeta || '';
      tooltip.innerHTML = '<div style="font-weight:600;margin-bottom:2px;">' + escapeHtml(name) + '</div>'
        + (type ? '<div style="opacity:0.7;font-size:11px;">Type: ' + escapeHtml(type) + '</div>' : '')
        + (meta ? '<div style="opacity:0.7;font-size:11px;">' + escapeHtml(meta) + '</div>' : '');
      tooltip.style.display = 'block';
    }
  });
  canvas.addEventListener('mousemove', function(e) {
    if (tooltip && tooltip.style.display === 'block') {
      const rect = viewport.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
    }
  });
  canvas.addEventListener('mouseout', function(e) {
    if (e.target.closest('[data-rel-info]') && tooltip) tooltip.style.display = 'none';
  });

  // --- Panel: toggle visibility ---
  panel.addEventListener('change', function(e) {
    const cb = e.target;
    if (!cb.dataset.relToggle) return;
    const groupName = cb.dataset.relToggle;
    const satellite = canvas.querySelector('[data-group="' + groupName + '"]');
    if (satellite) {
      satellite.style.display = cb.checked ? '' : 'none';
    }
    // Also hide/show the SVG line for this group
    const idx = satellites.findIndex(s => s.title === groupName);
    const lines = canvas.querySelector('.rel-svg');
    if (lines && lines.children[idx]) {
      lines.children[idx].style.display = cb.checked ? '' : 'none';
    }
  });

  // --- Panel: search filter ---
  const searchInput = document.getElementById('rel-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const q = this.value.toLowerCase();
      canvas.querySelectorAll('.rel-item').forEach(item => {
        const name = (item.dataset.relInfo || '').toLowerCase();
        item.style.display = !q || name.includes(q) ? '' : 'none';
      });
    });
  }

  // --- Panel: zoom/reset buttons ---
  function zoomBy(factor) {
    const newScale = Math.min(3, Math.max(0.3, scale * factor));
    const vw = viewport.offsetWidth;
    const vh = viewport.offsetHeight;
    // Zoom toward center of viewport
    panX = vw / 2 - (vw / 2 - panX) * (newScale / scale);
    panY = vh / 2 - (vh / 2 - panY) * (newScale / scale);
    scale = newScale;
    applyTransform();
  }
  document.getElementById('rel-zoom-in')?.addEventListener('click', function() { zoomBy(1.25); });
  document.getElementById('rel-zoom-out')?.addEventListener('click', function() { zoomBy(0.8); });
  document.getElementById('rel-reset')?.addEventListener('click', function() { scale = 1; centerCanvas(); });

  lucide.createIcons({ nodes: [panel] });
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
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome() + '<span class="breadcrumb-current">Suche</span></nav>';
  html += `<div class="section-header"><div>
    <div class="section-title">Suchergebnisse</div>
    <div class="section-subtitle">${totalResults} Ergebnisse fur "${escapeHtml(q)}"</div>
  </div></div>`;

  html += '<div class="list-panel">';
  if (concepts.length > 0) {
    html += '<div class="search-group-label">CONCEPTS</div>';
    concepts.forEach(c => {
      html += `<div class="search-result-item" data-href="#/vocabulary/${c.id}">
        <div class="search-result-icon"><i data-lucide="box" style="width:16px;height:16px;"></i></div>
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
  if (!target.closest('.grouping-dropdown')) {
    document.getElementById('grouping-menu')?.classList.remove('open');
  }

  // Grouping dropdown toggle
  if (target.closest('#grouping-btn')) {
    e.preventDefault();
    document.getElementById('grouping-menu')?.classList.toggle('open');
    return;
  }
  // Grouping option click
  const groupOpt = target.closest('.grouping-option[data-grouping]');
  if (groupOpt) {
    const section = (groupOpt.dataset.groupingSection || '').split('/')[0];
    if (grouping.hasOwnProperty(section)) grouping[section] = groupOpt.dataset.grouping;
    document.getElementById('grouping-menu')?.classList.remove('open');
    handleRoute();
    return;
  }

  // Header logo
  if (target.closest('#header-logo')) {
    e.preventDefault();
    navigate('#/vocabulary');
    return;
  }

  // Sidebar nav (section click — toggles expand + navigates)
  const navItem = target.closest('.nav-item[data-nav]');
  if (navItem) {
    const sec = navItem.dataset.nav;
    if (sec === 'home') { navigate('#/home'); return; }
    // If already on this section, toggle expand/collapse
    if (currentSection === sec && !currentEntityId) {
      if (expandedSections.has(sec)) {
        expandedSections.delete(sec);
      } else {
        expandedSections.add(sec);
      }
      renderSidebar();
      lucide.createIcons();
      return;
    }
    // Navigate to section, expand it
    expandedSections.add(sec);
    const tab = (currentTab === 'diagram' || currentTab === 'table') ? currentTab : lastListTab;
    navigate('#/' + sec + '/' + tab);
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
    lastListTab = listTabBtn.dataset.listTab;
    navigate(listTabBtn.dataset.listRoute);
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

  // Table column sorting
  const th = target.closest('.data-table thead th');
  if (th) {
    sortTableByColumn(th);
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
      window.location.hash = '#/home';
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
