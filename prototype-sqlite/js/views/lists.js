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
