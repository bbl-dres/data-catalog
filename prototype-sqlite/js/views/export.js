// ============================================================
// views/export: "Workflows & API" page (/#/export).
//
// Three equal tiles across the top — Excel Export, Excel Import,
// SQL Datenbank — and the REST API section below. All four data
// transfer surfaces are visible on one page.
//
// Depends on i18n.js (tr), components.js (escapeHtml, renderBreadcrumb,
// renderEmptyState), xlsx_io.js (catalogStats, exportFullCatalog,
// exportDatabase).
// ============================================================

function renderExportView() {
  addRecent(tr('workflows_api'), '#/export');
  const main = document.getElementById('main-content');
  const stats = catalogStats();

  let html = '<div class="content-wrapper"><article>';

  html += renderBreadcrumb([{ label: tr('workflows_api') }]);

  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="workflow" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<h1 class="title-block-name">${escapeHtml(tr('workflows_api'))}</h1>`;
  html += '</div></div>';

  html += '<div class="tab-content">';

  // ── Row of three data-transfer tiles ─────────────────────
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-4);">';

  // Excel Export
  html += `<div class="content-section">
    <div class="section-label">${escapeHtml(tr('export_excel_label'))}</div>
    <p style="color:var(--color-text-secondary);margin-bottom:var(--space-4);">${escapeHtml(tr('export_excel_intro'))}</p>
    <p style="color:var(--color-text-placeholder);font-size:var(--text-small);margin-bottom:var(--space-4);">
      ${stats.tableCount} ${escapeHtml(tr('export_tables'))} · ${stats.rowCount} ${escapeHtml(tr('export_rows'))}
    </p>
    <button type="button" class="btn btn-ghost" data-export-full>
      <i data-lucide="download" style="width:14px;height:14px;"></i>
      <span>${escapeHtml(tr('export_download_xlsx'))}</span>
    </button>
  </div>`;

  // Excel Import (placeholder)
  html += `<div class="content-section">
    <div class="section-label">${escapeHtml(tr('import_excel_label'))}</div>
    <p style="color:var(--color-text-secondary);margin-bottom:var(--space-4);">${escapeHtml(tr('import_excel_intro'))}</p>
    <p style="color:var(--color-text-placeholder);font-size:var(--text-small);margin-bottom:var(--space-4);">
      ${escapeHtml(tr('import_coming_soon'))}
    </p>
    <button type="button" class="btn btn-ghost" disabled>
      <i data-lucide="upload" style="width:14px;height:14px;"></i>
      <span>${escapeHtml(tr('import_choose_file'))}</span>
    </button>
  </div>`;

  // SQL Datenbank Download
  html += `<div class="content-section">
    <div class="section-label">${escapeHtml(tr('db_download_label'))}</div>
    <p style="color:var(--color-text-secondary);margin-bottom:var(--space-4);">${escapeHtml(tr('db_download_intro'))}</p>
    <p style="color:var(--color-text-placeholder);font-size:var(--text-small);margin-bottom:var(--space-4);">
      SQLite · .db
    </p>
    <button type="button" class="btn btn-ghost" data-export-db>
      <i data-lucide="database" style="width:14px;height:14px;"></i>
      <span>${escapeHtml(tr('db_download_button'))}</span>
    </button>
  </div>`;

  html += '</div>'; // tile row

  // ── REST API section (full-width) ────────────────────────
  html += '<div class="content-section">';
  html += '<div class="section-label">' + escapeHtml(tr('rest_api_label')) + '</div>';
  html += `<p style="color:var(--color-text-secondary);margin-bottom:var(--space-4);">${escapeHtml(tr('rest_api_intro'))}</p>`;
  html += `<a class="btn btn-ghost" href="#/api-docs">
    <i data-lucide="book-open" style="width:14px;height:14px;"></i>
    <span>${escapeHtml(tr('rest_api_open_docs'))}</span>
  </a>`;
  html += '</div>';

  html += '</div>'; // tab-content
  html += '</article></div>';
  main.innerHTML = html;
}

// Minimal stub for /#/api-docs — the real Swagger UI will live here.
function renderApiDocsView() {
  addRecent(tr('api_docs_title'), '#/api-docs');
  const main = document.getElementById('main-content');

  let html = '<div class="content-wrapper"><article>';
  html += renderBreadcrumb([
    { href: '#/export', label: tr('workflows_api') },
    { label: tr('api_docs_title') }
  ]);

  html += '<div class="title-block">';
  html += '<div class="title-block-icon"><i data-lucide="book-open" style="width:24px;height:24px;"></i></div>';
  html += '<div class="title-block-content">';
  html += `<h1 class="title-block-name">${escapeHtml(tr('api_docs_title'))}</h1>`;
  html += '</div></div>';

  html += '<div class="tab-content">';
  html += '<div class="content-section">';
  html += renderEmptyState('clock', tr('api_docs_title'), tr('api_docs_coming_soon'));
  html += '</div>';
  html += '</div>';

  html += '</article></div>';
  main.innerHTML = html;
}
