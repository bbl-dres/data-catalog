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
