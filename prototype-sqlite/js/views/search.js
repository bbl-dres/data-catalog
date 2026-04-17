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
    const counts = sidebarCounts || { terms: 0, vocabulary: 0, codelists: 0, products: 0, systems: 0 };
    html += `<div class="section-header"><div>
      <h2 class="section-title"><i data-lucide="search" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>Suche</h2>
      <div class="section-subtitle">Geben Sie oben einen Suchbegriff ein. Tipp: mit Ctrl+K öffnen Sie die Suche jederzeit.</div>
    </div></div>`;

    html += '<div class="content-section"><div class="section-label">NACH TYP DURCHSUCHEN</div>';
    html += '<div class="home-kpi-grid">';
    html += renderKpiCard('book-open', counts.terms, 'Begriffe', 'Fachbegriffe & Definitionen', '#/terms');
    html += renderKpiCard('box', counts.vocabulary, 'Geschäftsobjekte', 'Lösungsneutrale Objekte', '#/vocabulary/table');
    html += renderKpiCard('list-ordered', counts.codelists, 'Codelisten', 'Standardisierte Wertelisten', '#/codelists');
    html += renderKpiCard('package', counts.products, 'Datensammlungen', 'Publizierte Daten', '#/products/table');
    html += renderKpiCard('database', counts.systems, 'Systeme', 'Quellsysteme', '#/systems/table');
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

  html += `<div class="section-header"><div>
    <h2 class="section-title"><i data-lucide="search" style="width:24px;height:24px;vertical-align:-4px;margin-right:8px;"></i>Suchergebnisse</h2>
    <div class="section-subtitle">${totalResults} ${totalResults === 1 ? 'Ergebnis' : 'Ergebnisse'} für „${escapeHtml(q)}"</div>
  </div></div>`;

  if (totalResults === 0) {
    html += '<div class="list-panel">';
    html += renderEmptyState('search', 'Keine Ergebnisse', 'Keine Einträge gefunden für „' + escapeHtml(q) + '". Versuchen Sie einen anderen Begriff oder fragen Sie den KI-Assistenten.');
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

  html += group('Begriffe', 'book-open', terms, t => ({
    href: '#/terms/' + t.id,
    name: n(t, 'name'),
    meta: escapeHtml(t.standard_ref || 'Fachbegriff')
  }));
  html += group('Geschäftsobjekte', 'box', concepts, c => ({
    href: '#/vocabulary/' + c.id,
    name: n(c, 'name'),
    meta: 'Geschäftsobjekt ' + statusBadge(c.status)
  }));
  html += group('Codelisten', 'list-ordered', codeLists, cl => ({
    href: '#/codelists/' + cl.id,
    name: n(cl, 'name'),
    meta: 'Codeliste'
  }));
  html += group('Datensammlungen', 'package', products, dp => ({
    href: '#/products/' + dp.id,
    name: n(dp, 'name'),
    meta: 'Datensammlung' + (dp.publisher ? ' · ' + escapeHtml(dp.publisher) : '')
  }));
  html += group('Systeme', 'database', systems, s => ({
    href: '#/systems/' + s.id,
    name: n(s, 'name'),
    meta: 'System' + (s.technology_stack ? ' · ' + escapeHtml(s.technology_stack) : '')
  }));
  html += group('Tabellen', 'table-2', datasets, d => ({
    href: '#/systems/' + d.sys_id + '/datasets/' + d.id,
    name: d.display_name || d.name,
    meta: escapeHtml(d.dataset_type || 'Tabelle') + ' · ' + escapeHtml(d.sys_name)
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
    ? `„${escapeHtml(trimmed)}" an den Assistenten senden`
    : 'Stellen Sie eine Frage zum Datenmodell';

  let html = `<div class="search-dropdown-cta" data-href="#/chat" role="option">
    <div class="search-dropdown-cta-icon"><i data-lucide="sparkles" style="width:16px;height:16px;"></i></div>
    <div>
      <div class="search-dropdown-cta-title">KI-Assistent fragen</div>
      <div class="search-dropdown-cta-subtitle">${ctaSubtitle}</div>
    </div>
  </div>`;

  if (trimmed) {
    const { terms, concepts, codeLists, products, systems } = searchCatalog(trimmed, 5);
    const total = terms.length + concepts.length + codeLists.length + products.length + systems.length;

    if (total === 0) {
      html += `<div class="search-dropdown-empty">Keine Ergebnisse für „${escapeHtml(trimmed)}"</div>`;
    } else {
      if (terms.length) html += renderDropdownGroup('Begriffe', 'book-open', terms, t => ({
        href: '#/terms/' + t.id,
        name: n(t, 'name'),
        meta: t.standard_ref || 'Fachbegriff'
      }));
      if (concepts.length) html += renderDropdownGroup('Geschäftsobjekte', 'box', concepts, c => ({
        href: '#/vocabulary/' + c.id,
        name: n(c, 'name'),
        meta: 'Geschäftsobjekt'
      }));
      if (codeLists.length) html += renderDropdownGroup('Codelisten', 'list-ordered', codeLists, cl => ({
        href: '#/codelists/' + cl.id,
        name: n(cl, 'name'),
        meta: 'Codeliste'
      }));
      if (products.length) html += renderDropdownGroup('Datensammlungen', 'package', products, dp => ({
        href: '#/products/' + dp.id,
        name: n(dp, 'name'),
        meta: dp.publisher || 'Datensammlung'
      }));
      if (systems.length) html += renderDropdownGroup('Systeme', 'database', systems, s => ({
        href: '#/systems/' + s.id,
        name: n(s, 'name'),
        meta: s.technology_stack || 'System'
      }));
    }
    html += `<div class="search-dropdown-footer"><kbd>Enter</kbd> für alle Ergebnisse</div>`;
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
