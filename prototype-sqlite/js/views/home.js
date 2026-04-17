// ============================================================
// views/home: dashboard view (renderHome + renderKpiCard).
//
// Depends on i18n.js (tr, n, nameCol, formatDate), db.js (query,
// queryOne), components.js (escapeHtml, statusBadge).
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
    ROUND(AVG(completeness_score), 2) as avg_completeness,
    ROUND(AVG(format_validity_score), 2) as avg_validity,
    ROUND(AVG(timeliness_score), 2) as avg_timeliness,
    ROUND(AVG(accuracy_score), 2) as avg_accuracy,
    ROUND(AVG(consistency_score), 2) as avg_consistency,
    ROUND(AVG(uniqueness_score), 2) as avg_uniqueness,
    ROUND(AVG(null_percentage), 2) as avg_null
    FROM data_profile`);

  let html = '<div class="content-wrapper">';
  html += `<nav class="breadcrumb" aria-label="Breadcrumb"><span class="breadcrumb-current">${escapeHtml(tr('home'))}</span></nav>`;
  html += `<div class="section-header"><div>
    <h2 class="section-title"><i data-lucide="home" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>${escapeHtml(tr('home'))}</h2>
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
    html += '<th scope="col">Name</th><th scope="col">Domäne</th><th scope="col">Freigabe</th><th scope="col">Geändert</th>';
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
    html += `<p style="color:var(--color-text-secondary);">${escapeHtml(tr('no_activity'))}</p>`;
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
    { icon: 'clock', label: 'Aktualität', score: quality?.avg_timeliness },
    { icon: 'target', label: 'Genauigkeit', score: quality?.avg_accuracy },
    { icon: 'git-compare', label: 'Konsistenz', score: quality?.avg_consistency },
    { icon: 'shield-check', label: 'Formatkonformität', score: quality?.avg_validity },
    { icon: 'fingerprint', label: 'Eindeutigkeit', score: quality?.avg_uniqueness }
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
