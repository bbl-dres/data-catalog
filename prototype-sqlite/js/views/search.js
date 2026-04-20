// ============================================================
// views/search: global search (header typeahead dropdown + /search
// results page), plus the chat-view placeholder.
//
// Depends on i18n.js (tr, n, nameCol, formatDate), db.js (query),
// components.js (escapeHtml, renderEmptyState, statusBadge, n()).
// ============================================================

// Runs the 5 entity LIKE queries shared by the header dropdown and the /search page.
function searchCatalog(q, limit) {
  const likeQ = `%${q}%`;
  const all = [likeQ, likeQ, likeQ, likeQ];
  return {
    terms: query(`SELECT id, name_en, name_de, name_fr, name_it, standard_ref FROM term
      WHERE name_en LIKE ? OR name_de LIKE ? OR name_fr LIKE ? OR name_it LIKE ? LIMIT ${limit}`, all),
    concepts: query(`SELECT id, name_en, name_de, name_fr, name_it, status FROM concept
      WHERE name_en LIKE ? OR name_de LIKE ? OR name_fr LIKE ? OR name_it LIKE ? LIMIT ${limit}`, all),
    codeLists: query(`SELECT id, name_en, name_de, name_fr, name_it FROM code_list
      WHERE name_en LIKE ? OR name_de LIKE ? OR name_fr LIKE ? OR name_it LIKE ? LIMIT ${limit}`, all),
    products: query(`SELECT id, name_en, name_de, name_fr, name_it, publisher FROM data_product
      WHERE name_en LIKE ? OR name_de LIKE ? OR name_fr LIKE ? OR name_it LIKE ? LIMIT ${limit}`, all),
    systems: query(`SELECT id, name_en, name_de, name_fr, name_it, technology_stack FROM system
      WHERE name_en LIKE ? OR name_de LIKE ? OR name_fr LIKE ? OR name_it LIKE ? LIMIT ${limit}`, all)
  };
}

function syncHeaderSearch(q) {
  const input = document.getElementById('search-input');
  if (input && input.value !== q) input.value = q;
  const clearBtn = document.getElementById('search-clear');
  const shortcut = document.getElementById('search-shortcut');
  if (clearBtn) clearBtn.hidden = q.length === 0;
  if (shortcut) shortcut.hidden = q.length > 0;
}

function renderSearchResults() {
  const main = document.getElementById('main-content');
  const q = searchQuery.trim();
  syncHeaderSearch(q);

  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome() + '<span class="breadcrumb-current">Suche</span></nav>';

  if (!q) {
    const counts = sidebarCounts || { terms: 0, vocabulary: 0, codelists: 0, datasets: 0, systems: 0 };
    html += `<div class="section-header"><div>
      <h2 class="section-title"><i data-lucide="search" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>${escapeHtml(tr('search_title'))}</h2>
      <div class="section-subtitle">${escapeHtml(tr('search_subtitle'))}</div>
    </div></div>`;

    html += '<div class="content-section"><div class="section-label">' + tr('sec_search_by_type') + '</div>';
    html += '<div class="home-kpi-grid">';
    html += renderKpiCard('book-open',    counts.terms,      tSection('terms'),      tr('home_subtitle_terms'),             '#/terms');
    html += renderKpiCard('box',          counts.vocabulary, tSection('vocabulary'), tr('search_kpi_concepts_subtitle'),    '#/vocabulary/table');
    html += renderKpiCard('list-ordered', counts.codelists,  tSection('codelists'),  tr('search_kpi_codelists_subtitle'),   '#/codelists');
    html += renderKpiCard('package',      counts.datasets,   tSection('datasets'),   tr('search_kpi_datasets_subtitle'),    '#/datasets/table');
    html += renderKpiCard('database',     counts.systems,    tSection('systems'),    tr('search_kpi_systems_subtitle'),     '#/systems/table');
    html += '</div></div>';

    html += '</div>';
    main.innerHTML = html;
    lucide.createIcons({ nodes: [main] });
    document.getElementById('search-input')?.focus();
    return;
  }

  const LIMIT = 20;
  const { terms, concepts, codeLists, products, systems } = searchCatalog(q, LIMIT);
  const likeQ = `%${q}%`;
  const datasets = query(`SELECT d.id, d.name, d.display_name, d.dataset_type,
    s.${nameCol('name')} as sys_name, sc.system_id as sys_id
    FROM dataset d
    JOIN schema_ sc ON d.schema_id = sc.id
    JOIN system s ON sc.system_id = s.id
    WHERE d.name LIKE ? OR d.display_name LIKE ? LIMIT ${LIMIT}`,
    [likeQ, likeQ]);

  const totalResults = terms.length + concepts.length + codeLists.length + products.length + systems.length + datasets.length;

  const resultsNoun = totalResults === 1 ? tr('search_result_singular') : tr('search_result_plural');
  html += `<div class="section-header"><div>
    <h2 class="section-title"><i data-lucide="search" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>${escapeHtml(tr('search_results_title'))}</h2>
    <div class="section-subtitle">${escapeHtml(tr('search_results_count', { count: totalResults, noun: resultsNoun, query: q }))}</div>
  </div></div>`;

  if (totalResults === 0) {
    html += '<div class="list-panel">';
    html += renderEmptyState('search', tr('no_results'), tr('search_empty_body', { query: q }));
    html += '</div>';
    html += '</div>';
    main.innerHTML = html;
    lucide.createIcons({ nodes: [main] });
    return;
  }

  html += '<div class="list-panel">';

  function group(label, icon, items, mapper) {
    if (!items.length) return '';
    let h = `<div class="search-group-label">${label} <span style="color:var(--color-text-placeholder);font-weight:500;margin-left:4px;">${items.length}</span></div>`;
    items.forEach(it => {
      const m = mapper(it);
      h += `<div class="search-result-item" data-href="${m.href}">
        <div class="search-result-icon"><i data-lucide="${icon}" style="width:16px;height:16px;"></i></div>
        <div>
          <div class="search-result-name">${escapeHtml(m.name)}</div>
          <div class="search-result-type">${m.meta}</div>
        </div>
      </div>`;
    });
    return h;
  }

  html += group(tSection('terms'), 'book-open', terms, t => ({
    href: '#/terms/' + t.id,
    name: n(t, 'name'),
    meta: escapeHtml(t.standard_ref || tr('entity_term_singular'))
  }));
  html += group(tSection('vocabulary'), 'box', concepts, c => ({
    href: '#/vocabulary/' + c.id,
    name: n(c, 'name'),
    meta: tr('entity_concept_singular') + ' ' + statusBadge(c.status)
  }));
  html += group(tSection('codelists'), 'list-ordered', codeLists, cl => ({
    href: '#/codelists/' + cl.id,
    name: n(cl, 'name'),
    meta: tr('entity_codelist_singular')
  }));
  html += group(tSection('datasets'), 'package', products, dp => ({
    href: '#/datasets/' + dp.id,
    name: n(dp, 'name'),
    meta: tr('entity_dataset_singular') + (dp.publisher ? ' · ' + escapeHtml(dp.publisher) : '')
  }));
  html += group(tSection('systems'), 'database', systems, s => ({
    href: '#/systems/' + s.id,
    name: n(s, 'name'),
    meta: tr('entity_system_singular') + (s.technology_stack ? ' · ' + escapeHtml(s.technology_stack) : '')
  }));
  html += group(tr('col_tables'), 'table-2', datasets, d => ({
    href: '#/systems/' + d.sys_id + '/datasets/' + d.id,
    name: d.display_name || d.name,
    meta: escapeHtml(d.dataset_type || tr('entity_table_singular')) + ' · ' + escapeHtml(d.sys_name)
  }));

  html += '</div>'; // close list-panel
  html += '</div>'; // close content-wrapper
  main.innerHTML = html;
  lucide.createIcons({ nodes: [main] });
}

// ── View: Chat (placeholder) ───────────────────────────────
function renderChatView() {
  const main = document.getElementById('main-content');
  let html = '<div class="content-wrapper">';
  html += '<nav class="breadcrumb" aria-label="Breadcrumb">' + breadcrumbHome() + '<span class="breadcrumb-current">KI-Assistent</span></nav>';
  html += `<div class="section-header"><div>
    <h2 class="section-title"><i data-lucide="sparkles" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>KI-Assistent</h2>
    <div class="section-subtitle">Stellen Sie Fragen zum BBL Datenkatalog. Diese Funktion ist ein Platzhalter.</div>
  </div></div>`;
  html += `<div class="chat-placeholder">
    <div class="chat-placeholder-body">
      <i data-lucide="message-square-text" style="width:56px;height:56px;"></i>
      <h3 class="chat-placeholder-title">Chat-Funktion noch nicht verfügbar</h3>
      <p class="chat-placeholder-description">In einer zukünftigen Version können Sie hier mit einem KI-Assistenten über die Inhalte des Datenkatalogs sprechen. Der Assistent wird Begriffe erklären, Zusammenhänge zwischen Geschäftsobjekten aufzeigen und Sie bei der Navigation durch den Katalog unterstützen.</p>
    </div>
    <div class="chat-placeholder-input">
      <input type="text" disabled placeholder="Stellen Sie eine Frage zum Datenmodell…">
      <button class="btn btn-primary" disabled>Senden</button>
    </div>
  </div>`;
  html += '</div>';
  main.innerHTML = html;
}

// ── Search Dropdown ────────────────────────────────────────
let searchDropdownDebounce = null;

function renderDropdownGroup(label, icon, items, mapper) {
  let h = `<div class="search-dropdown-group">
    <div class="search-dropdown-group-label">${label}</div>`;
  items.forEach(item => {
    const m = mapper(item);
    h += `<div class="search-dropdown-item" data-href="${m.href}" role="option">
      <div class="search-dropdown-item-icon"><i data-lucide="${icon}" style="width:16px;height:16px;"></i></div>
      <div>
        <div class="search-dropdown-item-name">${escapeHtml(m.name)}</div>
        <div class="search-dropdown-item-meta">${escapeHtml(m.meta)}</div>
      </div>
    </div>`;
  });
  h += `</div>`;
  return h;
}

function renderSearchDropdown(q) {
  const dropdown = document.getElementById('search-dropdown');
  if (!dropdown) return;

  const trimmed = (q || '').trim();
  const ctaSubtitle = trimmed
    ? tr('search_ask_ai_send', { query: trimmed })
    : tr('search_ask_ai_prompt');

  let html = `<div class="search-dropdown-cta" data-href="#/chat" role="option">
    <div class="search-dropdown-cta-icon"><i data-lucide="sparkles" style="width:16px;height:16px;"></i></div>
    <div>
      <div class="search-dropdown-cta-title">${escapeHtml(tr('search_ask_ai'))}</div>
      <div class="search-dropdown-cta-subtitle">${escapeHtml(ctaSubtitle)}</div>
    </div>
  </div>`;

  if (trimmed) {
    const { terms, concepts, codeLists, products, systems } = searchCatalog(trimmed, 5);
    const total = terms.length + concepts.length + codeLists.length + products.length + systems.length;

    if (total === 0) {
      html += `<div class="search-dropdown-empty">${escapeHtml(tr('search_dropdown_empty', { query: trimmed }))}</div>`;
    } else {
      if (terms.length) html += renderDropdownGroup(tSection('terms'), 'book-open', terms, t => ({
        href: '#/terms/' + t.id,
        name: n(t, 'name'),
        meta: t.standard_ref || tr('entity_term_singular')
      }));
      if (concepts.length) html += renderDropdownGroup(tSection('vocabulary'), 'box', concepts, c => ({
        href: '#/vocabulary/' + c.id,
        name: n(c, 'name'),
        meta: tr('entity_concept_singular')
      }));
      if (codeLists.length) html += renderDropdownGroup(tSection('codelists'), 'list-ordered', codeLists, cl => ({
        href: '#/codelists/' + cl.id,
        name: n(cl, 'name'),
        meta: tr('entity_codelist_singular')
      }));
      if (products.length) html += renderDropdownGroup(tSection('datasets'), 'package', products, dp => ({
        href: '#/datasets/' + dp.id,
        name: n(dp, 'name'),
        meta: dp.publisher || tr('entity_dataset_singular')
      }));
      if (systems.length) html += renderDropdownGroup(tSection('systems'), 'database', systems, s => ({
        href: '#/systems/' + s.id,
        name: n(s, 'name'),
        meta: s.technology_stack || tr('entity_system_singular')
      }));
    }
    html += `<div class="search-dropdown-footer"><kbd>Enter</kbd> ${escapeHtml(tr('search_dropdown_footer'))}</div>`;
  }

  dropdown.innerHTML = html;
  dropdown.hidden = false;
  lucide.createIcons({ nodes: [dropdown] });
}

function hideSearchDropdown() {
  if (searchDropdownDebounce) {
    clearTimeout(searchDropdownDebounce);
    searchDropdownDebounce = null;
  }
  const dropdown = document.getElementById('search-dropdown');
  if (dropdown && !dropdown.hidden) {
    dropdown.hidden = true;
    dropdown.innerHTML = '';
  }
}

// Mark one option as visually-selected (via aria-selected + CSS class)
// and clear the others. Focus stays on the search input — this is a
// typeahead-style listbox, not a menu.
function setSearchDropdownActive(items, idx) {
  items.forEach((el, i) => {
    const active = i === idx;
    el.setAttribute('aria-selected', String(active));
    el.classList.toggle('search-dropdown-item-active', active);
  });
  items[idx]?.scrollIntoView({ block: 'nearest' });
}
