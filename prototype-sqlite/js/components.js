// ============================================================
// components: presentational render helpers.
//
// Pure, stateless template-literal builders shared across
// views. Helpers that depend on app state (active filters,
// recents) stay in app.js; anything here should be safe to
// call from any render function.
//
// Depends on i18n.js (tr, tStatus, n) being loaded first.
// Reads the app.js globals `activeFilters` / `currentSection`
// only through the helper isFilterValueActive().
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Breadcrumbs ─────────────────────────────────────────────

// Build a breadcrumb trail from a list of segments.
// Each segment is either { href, label } (link) or { label } (current).
// The Home crumb is prepended automatically; pass `{ noHome: true }` to skip.
function renderBreadcrumb(segments, opts) {
  const parts = [];
  if (!opts || !opts.noHome) {
    parts.push(`<a class="breadcrumb-link" href="#/home">${escapeHtml(tr('home'))}</a>`);
  }
  (segments || []).forEach(seg => {
    if (seg.href) {
      parts.push(`<a class="breadcrumb-link" href="${escapeHtml(seg.href)}">${escapeHtml(seg.label)}</a>`);
    } else {
      parts.push(`<span class="breadcrumb-current">${escapeHtml(seg.label)}</span>`);
    }
  });
  return '<nav class="breadcrumb" aria-label="Breadcrumb">' + parts.join('<span class="breadcrumb-separator"> / </span>') + '</nav>';
}

// Legacy helper kept for callers that build breadcrumbs by concatenation.
// Prefer renderBreadcrumb().
function breadcrumbHome() {
  return `<a class="breadcrumb-link" href="#/home">${escapeHtml(tr('home'))}</a><span class="breadcrumb-separator"> / </span>`;
}

// ── Tables ──────────────────────────────────────────────────

// Render a sortable data table with optional row click-through.
//
//   columns: [{ label, width?, render: (row) => html, cellClass? }, ...]
//   rows:    array of data objects
//   opts.rowHref(row)     → if set, the row becomes a clickable-row with data-href
//   opts.rowClass(row)    → optional extra tr class
//
// The component emits the same .data-table markup the existing app
// uses, so styling and sort-on-click (via sortTableByColumn) keep
// working unchanged.
function renderDataTable(columns, rows, opts) {
  opts = opts || {};
  const colgroup = '<colgroup>' + columns.map(c =>
    c.width ? `<col style="width:${c.width}">` : '<col>'
  ).join('') + '</colgroup>';
  const thead = '<thead><tr>' + columns.map(c =>
    `<th scope="col">${escapeHtml(c.label)}</th>`
  ).join('') + '</tr></thead>';
  const body = rows.map(row => {
    const href = opts.rowHref && opts.rowHref(row);
    const cls = ['clickable-row', opts.rowClass && opts.rowClass(row)].filter(Boolean).join(' ');
    const openTag = href
      ? `<tr class="${cls}" data-href="${escapeHtml(href)}">`
      : `<tr${cls ? ` class="${cls}"` : ''}>`;
    const cells = columns.map(c => {
      const cc = c.cellClass ? ` class="${c.cellClass}"` : '';
      return `<td${cc}>${c.render(row)}</td>`;
    }).join('');
    return openTag + cells + '</tr>';
  }).join('');
  // Wrap in a scroll container so narrow viewports scroll the table
  // instead of cramping every column. The table's own min-width comes
  // from CSS so cells stay readable when scrolled horizontally.
  return `<div class="data-table-wrap"><table class="data-table">${colgroup}${thead}<tbody>${body}</tbody></table></div>`;
}

function sortTableByColumn(th) {
  const table = th.closest('table');
  const tbody = table?.querySelector('tbody');
  if (!tbody) return;
  const idx = Array.from(th.parentNode.children).indexOf(th);
  const allThs = th.parentNode.querySelectorAll('th');

  const wasAsc = th.classList.contains('sort-asc');
  const dir = wasAsc ? 'desc' : 'asc';

  allThs.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
  th.classList.add('sort-' + dir);

  const rows = Array.from(tbody.rows);
  rows.sort((a, b) => {
    const aVal = (a.cells[idx]?.textContent || '').trim();
    const bVal = (b.cells[idx]?.textContent || '').trim();
    const aNum = parseFloat(aVal.replace(/[^\d.-]/g, ''));
    const bNum = parseFloat(bVal.replace(/[^\d.-]/g, ''));
    if (!isNaN(aNum) && !isNaN(bNum) && aVal.match(/^[\d.,% –-]+$/)) {
      return dir === 'asc' ? aNum - bNum : bNum - aNum;
    }
    const cmp = aVal.localeCompare(bVal, 'de', { sensitivity: 'base' });
    return dir === 'asc' ? cmp : -cmp;
  });
  rows.forEach(r => tbody.appendChild(r));
}

// Render a key/value metadata table. Rows whose value is null/undefined
// are skipped so callers can use inline conditions without boilerplate.
//
//   rows: [{ label, value }, ...]
//     label is escaped; value is treated as HTML so badges/links pass
//     through. Callers wrap plain text with escapeHtml() themselves.
function renderMetadataTable(rows) {
  const cells = rows.filter(r => r && r.value != null && r.value !== '')
    .map(r => `<tr><td>${escapeHtml(r.label)}</td><td>${r.value}</td></tr>`)
    .join('');
  return `<table class="props-table"><tbody>${cells}</tbody></table>`;
}

// Render a detail-page tab bar. `tabs` is an array of { id, label };
// active tab id is compared against `activeTab`. `base` is the hash
// prefix (e.g. "#/vocabulary/<id>") that tab clicks will navigate to.
function renderTabBar(tabs, activeTab, base) {
  const buttons = tabs.map(t => {
    const isActive = t.id === activeTab;
    return `<button class="tab${isActive ? ' active' : ''}" data-tab="${escapeHtml(t.id)}" data-base="${escapeHtml(base)}" role="tab" aria-selected="${isActive}">${escapeHtml(t.label)}</button>`;
  }).join('');
  return `<div class="tab-bar" role="tablist">${buttons}</div>`;
}

// ── Badges ──────────────────────────────────────────────────

// Map a status code to its badge CSS class + i18n key.
function statusBadgeMeta(status) {
  const s = (status || '').toLowerCase();
  if (s === 'approved' || s === 'certified') return { cls: 'badge-certified', key: 'approved' };
  if (s === 'in_review' || s === 'in review') return { cls: 'badge-review',    key: 'in_review' };
  if (s === 'active')                          return { cls: 'badge-certified', key: 'active' };
  if (s === 'deprecated')                      return { cls: 'badge-deprecated', key: 'deprecated' };
  return { cls: 'badge-draft', key: 'draft' };
}

function statusBadge(status, filterDim) {
  if (!status) return '';
  const { cls, key } = statusBadgeMeta(status);
  const label = tStatus(key);
  if (filterDim) {
    const active = isFilterValueActive(filterDim, status);
    const aria = tr(active ? 'filter_remove_aria' : 'filter_apply_aria', { label });
    return `<button type="button" class="badge ${cls} badge-filterable" data-filter-add-dim="${escapeHtml(filterDim)}" data-filter-add-value="${escapeHtml(status)}" aria-pressed="${active}" aria-label="${escapeHtml(aria)}">${escapeHtml(label)}</button>`;
  }
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function certifiedBadge(isCertified, filterDim) {
  return statusBadge(isCertified ? 'approved' : 'draft', filterDim);
}

// Generic filterable cell badge (Domäne, Technologie, Herausgeber, Quelle, …)
// variant maps to a CSS class that controls color; defaults to .badge-domain (grey).
function filterBadge(text, filterDim, value, variant) {
  if (text == null || text === '') return '&ndash;';
  const cls = variant || 'badge-domain';
  const safeText = escapeHtml(String(text));
  const active = isFilterValueActive(filterDim, value);
  const aria = tr(active ? 'filter_remove_aria' : 'filter_apply_aria', { label: String(text) });
  return `<button type="button" class="badge ${cls} badge-filterable" data-filter-add-dim="${escapeHtml(filterDim)}" data-filter-add-value="${escapeHtml(String(value))}" aria-pressed="${active}" aria-label="${escapeHtml(aria)}">${safeText}</button>`;
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

// ── Small helpers ───────────────────────────────────────────

function sectionCountLabel(totalCount, filteredCount, filterCtx) {
  if (filterCtx && filterCtx.count > 0) return `${filteredCount} / ${totalCount}`;
  return String(totalCount);
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Empty / locked states ───────────────────────────────────

function renderEmptyState(icon, title, description) {
  return `<div class="empty-state">
    <i data-lucide="${escapeHtml(icon)}" class="empty-state-icon" style="width:48px;height:48px;"></i>
    <h3 class="empty-state-title">${escapeHtml(title)}</h3>
    <p class="empty-state-description">${escapeHtml(description)}</p>
  </div>`;
}

function renderLockedContent() {
  return `<div class="locked-content-message">
    <i data-lucide="lock" style="width:48px;height:48px;"></i>
    <h3>${escapeHtml(tr('access_restricted'))}</h3>
    <p>${escapeHtml(tr('access_restricted_body'))}</p>
    <a class="btn btn-ghost" href="mailto:datenkatalog@bbl.admin.ch?subject=Zugriffsanfrage">${escapeHtml(tr('request_access'))} &rarr;</a>
  </div>`;
}
