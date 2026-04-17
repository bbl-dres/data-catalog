// ============================================================
// filters: URL-backed multi-dimension filter engine.
//
// Filter definition: { id, label, options: [{value, label}], match: (item, values) => bool }
// Active filters:    { [dimId]: [value, value, ...] }  (AND across dims, OR within a dim)
//
// Reads app.js globals activeFilters, currentSection, filterPanelOpen,
// attrsMode, pendingFocus. Produces HTML fragments (toggle / panel /
// pill row) that callers splice into their view.
//
// Depends on i18n.js (tr) and components.js (escapeHtml).
// ============================================================

function isFilterValueActive(filterDim, value) {
  const vals = activeFilters[currentSection]?.[filterDim];
  if (!vals) return false;
  return vals.some(v => String(v) === String(value));
}

const RESERVED_QUERY_KEYS = new Set(['q', 'attrs']); // never treated as filter dimensions

function parseFilterQuery(queryStr) {
  const out = {};
  if (!queryStr) return out;
  queryStr.split('&').forEach(pair => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
    const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : '';
    if (!k || RESERVED_QUERY_KEYS.has(k)) return;
    out[k] = v ? v.split(',').filter(Boolean) : [];
  });
  return out;
}

function parseAttrsMode(queryStr) {
  if (!queryStr) return 'show';
  return /(^|&)attrs=0(&|$)/.test(queryStr) ? 'hide' : 'show';
}

function buildFullQuery(filters, mode) {
  const filterPart = buildFilterQuery(filters);
  if (mode === 'show') return filterPart; // default state: no attrs param needed
  return filterPart ? filterPart + '&attrs=0' : '?attrs=0';
}

function buildFilterQuery(filters) {
  const parts = [];
  Object.keys(filters || {}).forEach(k => {
    const vals = filters[k];
    if (vals && vals.length) {
      parts.push(encodeURIComponent(k) + '=' + vals.map(encodeURIComponent).join(','));
    }
  });
  return parts.length ? '?' + parts.join('&') : '';
}

function getCurrentPathPart() {
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  return qIdx >= 0 ? hash.slice(0, qIdx) : hash;
}

function navigateWithFilters(filters) {
  pendingFocus = captureFilterFocus();
  window.location.hash = getCurrentPathPart() + buildFullQuery(filters, attrsMode);
}

function navigateWithAttrsMode(mode) {
  pendingFocus = captureFilterFocus();
  const currentFilters = activeFilters[currentSection] || {};
  window.location.hash = getCurrentPathPart() + buildFullQuery(currentFilters, mode);
}

// Capture focus descriptor before a filter navigation so we can restore
// it after re-render. The selector covers filter UI, the diagram attrs
// toggle, and concept-card expansion buttons.
function captureFilterFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  if (el.id) return { sel: '#' + el.id };
  if (el.dataset.filterDim) return { sel: `.filter-checkbox[data-filter-dim="${el.dataset.filterDim}"][data-filter-value="${CSS.escape(el.dataset.filterValue || '')}"]` };
  if (el.dataset.filterAddDim) return { sel: `[data-filter-add-dim="${el.dataset.filterAddDim}"][data-filter-add-value="${CSS.escape(el.dataset.filterAddValue || '')}"]` };
  if (el.hasAttribute('data-attrs-toggle')) return { sel: '[data-attrs-toggle]' };
  if (el.dataset.toggleConcept) return { sel: `[data-toggle-concept="${CSS.escape(el.dataset.toggleConcept)}"]` };
  // For pill-remove: the pill disappears; send focus to the filter toggle as a reasonable fallback.
  if (el.dataset.filterRemoveDim) return { sel: '#filter-toggle' };
  return null;
}

function restorePendingFocus() {
  if (pendingFocus) {
    const { sel } = pendingFocus;
    pendingFocus = null;
    try {
      const el = document.querySelector(sel);
      if (el) { el.focus({ preventScroll: true }); return; }
    } catch { /* invalid selector — fall through to default focus */ }
  }
  // Default: move focus to <main> so screen readers and keyboard users
  // land on the freshly-rendered content instead of <body>.
  document.getElementById('main-content')?.focus({ preventScroll: true });
}

// Announce filtered result count to screen readers via the permanent #sr-live region.
function announceFilterResult(sectionLabel, filteredCount, totalCount, filterCount) {
  const live = document.getElementById('sr-live');
  if (!live) return;
  if (filterCount > 0) {
    live.textContent = tr('filter_live_message', {
      filtered: filteredCount, total: totalCount, section: sectionLabel, count: filterCount
    });
  } else {
    live.textContent = '';
  }
}

function applyFilterDefs(items, filterDefs, filters) {
  if (!filters || !Object.keys(filters).length) return items;
  return items.filter(item => {
    for (const def of filterDefs) {
      const vals = filters[def.id];
      if (!vals || !vals.length) continue;
      if (!def.match(item, vals)) return false;
    }
    return true;
  });
}

function countActiveFilters(filters) {
  let n = 0;
  Object.keys(filters || {}).forEach(k => { n += (filters[k] || []).length; });
  return n;
}

// Returns { toggleHtml, panelHtml, pillsHtml, queryStr, count, filters, filterDefs }.
// Pure renderers — caller places pieces wherever it wants.
function createFilterContext(filterDefs, filters) {
  const queryStr = buildFilterQuery(filters);
  const count = countActiveFilters(filters);

  const toggleHtml = `<button type="button" class="grouping-btn filter-toggle${filterPanelOpen ? ' open' : ''}" id="filter-toggle" aria-expanded="${filterPanelOpen}" aria-controls="filter-panel" aria-label="${escapeHtml(tr('filter'))}">
    <i data-lucide="sliders-horizontal" style="width:14px;height:14px;"></i>
    <span>${escapeHtml(tr('filter'))}</span>${count > 0 ? `<span class="filter-toggle-badge">${count}</span>` : ''}
    <i data-lucide="chevron-down" style="width:14px;height:14px;" class="filter-toggle-chevron"></i>
  </button>`;

  let panelHtml = `<div class="filter-panel" id="filter-panel"${filterPanelOpen ? '' : ' hidden'}>`;
  filterDefs.forEach(def => {
    const active = new Set((filters[def.id] || []).map(String));
    panelHtml += '<div class="filter-group">';
    panelHtml += `<div class="filter-group-label">${escapeHtml(def.label)}</div>`;
    panelHtml += '<div class="filter-group-options">';
    def.options.forEach(opt => {
      const val = String(opt.value);
      const checked = active.has(val);
      panelHtml += `<label class="filter-chip${checked ? ' active' : ''}">
        <input type="checkbox" class="filter-checkbox" data-filter-dim="${escapeHtml(def.id)}" data-filter-value="${escapeHtml(val)}"${checked ? ' checked' : ''}>
        <span>${escapeHtml(opt.label)}</span>
      </label>`;
    });
    panelHtml += '</div></div>';
  });
  panelHtml += '</div>';

  let pillsHtml = '';
  if (count > 0) {
    pillsHtml = `<div class="filter-pill-row"${filterPanelOpen ? ' hidden' : ''}>`;
    filterDefs.forEach(def => {
      const vals = filters[def.id] || [];
      if (!vals.length) return;
      const optMap = {};
      def.options.forEach(o => { optMap[String(o.value)] = o.label; });
      vals.forEach(v => {
        const label = optMap[String(v)] || v;
        pillsHtml += `<span class="filter-pill">
          <span class="filter-pill-dim">${escapeHtml(def.label)}:</span>
          <span class="filter-pill-val">${escapeHtml(label)}</span>
          <button type="button" class="filter-pill-remove" data-filter-remove-dim="${escapeHtml(def.id)}" data-filter-remove-value="${escapeHtml(String(v))}" aria-label="${escapeHtml(tr('filter_remove_aria', { label: def.label + ': ' + label }))}">
            <i data-lucide="x" style="width:12px;height:12px;"></i>
          </button>
        </span>`;
      });
    });
    pillsHtml += `<button type="button" class="filter-reset" id="filter-reset">${escapeHtml(tr('filter_reset'))}</button>`;
    pillsHtml += '</div>';
  }

  return { toggleHtml, panelHtml, pillsHtml, queryStr, count, filters, filterDefs };
}
