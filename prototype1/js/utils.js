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
