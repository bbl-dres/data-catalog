// ========================================
// SVG Icons
// ========================================
const icons = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    panelLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',
    server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>',
    hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    hammer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>',
    cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-9 5-9-5V8l9-5 9 5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>',
    expandAll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg>',
    collapseAll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5-5 5 5"/><path d="m7 9 5 5 5-5"/></svg>',
    sortAsc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/></svg>',
    sortDesc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
    externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>'
};

// ========================================
// Utilities
// ========================================

// Current language setting (default: German)
let currentLang = 'de';

// Get text from MultiLang object or plain string
function getText(value, lang = currentLang) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        // Return requested language, fallback to German, then any available
        return value[lang] || value.de || value.en || value.fr || value.it || '';
    }
    return String(value);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Safe DOM element getter with error handling
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id "${id}" not found`);
    }
    return element;
}

// Safe innerHTML setter with error handling
function setInnerHTML(elementOrId, html) {
    try {
        const element = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;
        if (element) {
            element.innerHTML = html;
            return true;
        }
        console.warn(`Cannot set innerHTML: element not found`);
        return false;
    } catch (error) {
        console.error('Error setting innerHTML:', error);
        return false;
    }
}

// Safe class manipulation
function toggleClass(elementOrId, className, force) {
    try {
        const element = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;
        if (element) {
            return element.classList.toggle(className, force);
        }
        return false;
    } catch (error) {
        console.error('Error toggling class:', error);
        return false;
    }
}

// ========================================
// Data Loading
// ========================================
const data = {
    catalogs: [],
    domains: [],
    entities: [],
    systems: [],
    schemas: [],
    enumerations: [],
    attributes: [],
    columns: []
};

async function loadData() {
    try {
        console.time('⏱️ Total loadData');
        console.time('⏱️ Fetch JSON files');
        const [catalogs, domains, entities, systems, schemas, enumerations, attributes, columns, relationships] = await Promise.all([
            fetch('data/catalogs.json').then(r => r.json()),
            fetch('data/domains.json').then(r => r.json()),
            fetch('data/entities.json').then(r => r.json()),
            fetch('data/systems.json').then(r => r.json()),
            fetch('data/schemas.json').then(r => r.json()),
            fetch('data/enumerations.json').then(r => r.json()),
            fetch('data/attributes.json').then(r => r.json()),
            fetch('data/columns.json').then(r => r.json()),
            fetch('data/relationships.json').then(r => r.json())
        ]);
        console.timeEnd('⏱️ Fetch JSON files');

        data.catalogs = catalogs;
        data.domains = domains;
        data.entities = entities;
        data.systems = systems;
        data.schemas = schemas;
        data.enumerations = enumerations;
        data.attributes = attributes;
        data.columns = columns;
        data.relationships = relationships;

        console.time('⏱️ Process data relationships');
        // Attach attributes to entities
        data.entities.forEach(entity => {
            entity.attributes = data.attributes
                .filter(attr => attr.entity_id === entity.id)
                .sort((a, b) => a.display_order - b.display_order)
                .map(attr => ({
                    name: attr.name,
                    type: attr.type,
                    nullable: attr.nullable,
                    key: attr.key,
                    enumeration: attr.enumeration_id,
                    description: attr.description
                }));
        });

        // Attach columns to schemas
        data.schemas.forEach(schema => {
            schema.columns = data.columns
                .filter(col => col.schema_id === schema.id)
                .sort((a, b) => a.display_order - b.display_order)
                .map(col => ({
                    name: col.name,
                    type: col.type,
                    nullable: col.nullable,
                    key: col.key,
                    table: col.table,
                    description: col.description
                }));
        });
        console.timeEnd('⏱️ Process data relationships');

        console.timeEnd('⏱️ Total loadData');
        return true;
    } catch (error) {
        console.error('Failed to load data:', error);
        return false;
    }
}

// ========================================
// State Management
// ========================================
let state = {
    currentCatalog: null,
    currentLayer: 'logical',
    currentView: 'wiki',
    catalogView: 'details',
    selectedItem: null,
    selectedAttribute: null,
    expandedNodes: new Set(['dom-immo', 'sys-sap']),
    expandedLayers: new Set(['logical', 'physical']),
    theme: 'light',
    sidebarCollapsed: false,
    searchQuery: '',
    searchResults: [],
    showCatalogsOverview: true,
    groupBy: 'layer',
    treeSearchQuery: '',
    treeSort: 'name-asc',
    allExpanded: true
};

// ========================================
// URL Routing
// ========================================
function parseRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = new URLSearchParams(queryString || '');

    return { parts, params };
}

function navigateTo(path, replace = false) {
    const method = replace ? 'replaceState' : 'pushState';
    // Preserve current tab parameter
    const tabParam = state.currentView && state.currentView !== 'wiki' ? `?tab=${state.currentView}` : '';
    history[method](null, '', `#${path}${tabParam}`);
    handleRoute();
}

function updateUrlWithTab(tabId) {
    const hash = window.location.hash.slice(1) || '/';
    const [path] = hash.split('?');
    const newUrl = tabId === 'wiki' ? `#${path}` : `#${path}?tab=${tabId}`;
    history.replaceState(null, '', newUrl);
}

function handleRoute() {
    const { parts, params } = parseRoute();

    if (parts.length === 0) {
        // Default route - show catalogs overview
        state.currentLayer = 'logical';
        state.selectedItem = null;
        state.currentCatalog = null;
        state.showCatalogsOverview = true;
    } else if (parts.length === 1) {
        // Layer route: /logical, /physical
        if (['logical', 'physical'].includes(parts[0])) {
            state.currentLayer = parts[0];
            state.selectedItem = null;
            state.showCatalogsOverview = false;
        }
    } else if (parts.length >= 2) {
        // Entity route: /logical/domain/dom-immo or /catalog/proj-id
        const [layer, type, id] = parts;
        state.showCatalogsOverview = false;
        if (['logical', 'physical'].includes(layer)) {
            state.currentLayer = layer;
            if (id) {
                const item = findItemById(id);
                if (item) {
                    state.selectedItem = item;
                    expandParents(item);
                }
            }
        } else if (layer === 'catalog' && type) {
            const catalog = data.catalogs.find(c => c.id === type);
            if (catalog) {
                state.currentCatalog = catalog;
                state.selectedItem = catalog;
            }
        }
    }

    // Handle query params
    if (params.has('tab')) {
        state.currentView = params.get('tab');
    }

    updateLayoutForView();
    renderAll();
}

function expandParents(item) {
    // Expand parent nodes in tree
    if (item.domain) state.expandedNodes.add(item.domain);
    if (item.system) state.expandedNodes.add(item.system);
}

// ========================================
// Utility Functions
// ========================================
function findItemById(id) {
    for (const catalog of data.catalogs) {
        if (catalog.id === id) return catalog;
    }
    for (const domain of data.domains) {
        if (domain.id === id) return domain;
    }
    for (const entity of data.entities) {
        if (entity.id === id) return entity;
    }
    for (const system of data.systems) {
        if (system.id === id) return system;
    }
    for (const schema of data.schemas) {
        if (schema.id === id) return schema;
    }
    return null;
}

function getEntitiesForDomain(domainId) {
    return data.entities.filter(e => e.domain === domainId);
}

function getSchemasForSystem(systemId) {
    return data.schemas.filter(s => s.system === systemId);
}

function getParentChain(item) {
    const chain = [];
    if (item.layer === 'logical') {
        if (item.type === 'entity') {
            const domain = data.domains.find(d => d.id === item.domain);
            if (domain) chain.push(domain);
        }
    } else if (item.layer === 'physical') {
        if (item.type === 'schema') {
            const system = data.systems.find(sys => sys.id === item.system);
            if (system) chain.push(system);
        }
    }
    return chain;
}

function getTypeLabel(type) {
    const labels = {
        catalog: 'Katalog',
        domain: 'Domäne',
        entity: 'Logische Entität',
        system: 'System',
        schema: 'Schema'
    };
    return labels[type] || type;
}

function getLayerLabel(layer) {
    const labels = {
        logical: 'Logisch',
        physical: 'Physisch'
    };
    return labels[layer] || layer;
}

function getStatusLabel(status) {
    const labels = {
        active: 'Aktiv',
        draft: 'Entwurf',
        deprecated: 'Veraltet',
        planned: 'Geplant'
    };
    return labels[status] || status;
}

function getRoleLabel(role) {
    const labels = {
        owner: 'Katalogverantwortliche',
        steward: 'Data Steward',
        engineer: 'Data Engineer',
        analyst: 'Business Analyst',
        viewer: 'Betrachter'
    };
    return labels[role] || role;
}

function getRoleDescription(role) {
    const descriptions = {
        owner: 'Vollständiger Administratorzugriff, kann Benutzer und Einstellungen verwalten',
        steward: 'Kann Metadateneinträge erstellen, bearbeiten und genehmigen',
        engineer: 'Kann physische Schicht-Entitäten und Zuordnungen verwalten',
        analyst: 'Kann konzeptuelle Schicht-Einträge erstellen und bearbeiten',
        viewer: 'Lesezugriff auf alle Katalogdaten'
    };
    return descriptions[role] || '';
}

function getUserAvatar(name) {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
}

function getTypeIcon(type) {
    const iconMap = {
        catalog: 'K',
        domain: 'D',
        entity: 'E',
        system: 'S',
        schema: 'S'
    };
    return iconMap[type] || '?';
}

function getTreeIcon(type) {
    const iconMap = {
        domain: icons.folder,
        entity: icons.cube,
        system: icons.server,
        schema: icons.database
    };
    return iconMap[type] || '';
}

// ========================================
// Search with Debounce
// ========================================
let searchTimeout = null;

function handleSearch(query) {
    clearTimeout(searchTimeout);
    state.searchQuery = query;

    if (!query || query.length < 2) {
        state.searchResults = [];
        renderSearchResults();
        return;
    }

    searchTimeout = setTimeout(() => {
        const q = query.toLowerCase();
        state.searchResults = getAllItems()
            .filter(item =>
                getText(item.name).toLowerCase().includes(q) ||
                getText(item.description).toLowerCase().includes(q) ||
                getText(item.name, 'de').toLowerCase().includes(q) ||
                getText(item.name, 'en').toLowerCase().includes(q)
            )
            .slice(0, 10);
        renderSearchResults();
    }, 300);
}

function getAllItems() {
    return [
        ...data.catalogs,
        ...data.domains,
        ...data.entities,
        ...data.systems,
        ...data.schemas
    ];
}

// ========================================
// Render Functions
// ========================================
function renderAll() {
    renderVersionSelector();
    renderTree();
    renderContent();
}

function renderApp() {
    const app = document.getElementById('app');
    app.className = 'app-container';
    app.innerHTML = `
        <!-- Header -->
        <header class="header" role="banner">
            <a href="#/" class="logo" onclick="goToCatalogsOverview(); return false;">
                <div class="logo-icon" aria-hidden="true">${icons.layers}</div>
                <span>Meta-Atlas</span>
            </a>
            <div class="header-branding">
                <span>Bundesamt für Bauten und Logistik</span>
                <span>Abteilung für Digital Real Estate und Support</span>
            </div>

            <div class="header-right">
                <div class="search-container">
                    <button class="search-toggle" id="searchToggle" aria-label="Search">
                        ${icons.search}
                    </button>
                    <div class="search-wrapper">
                        <input type="search"
                               class="search-input"
                               id="searchInput"
                               placeholder="Suchen..."
                               aria-label="Metadatenkatalog durchsuchen"
                               autocomplete="off">
                        <div class="search-results" id="searchResults" role="listbox"></div>
                    </div>
                </div>
                <button class="icon-btn" id="themeToggle" aria-label="Toggle dark/light theme">
                    ${icons.sun}
                </button>
                <select class="lang-selector" id="headerLangSelector" aria-label="Language">
                    <option value="de" ${currentLang === 'de' ? 'selected' : ''}>DE</option>
                    <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
                    <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>FR</option>
                    <option value="it" ${currentLang === 'it' ? 'selected' : ''}>IT</option>
                </select>
                <button class="btn-login" id="loginBtn">
                    ${icons.logIn}
                    <span>Anmelden</span>
                </button>
            </div>
        </header>

        <!-- Main Layout -->
        <div class="main-layout">
            <div class="sidebar-overlay" id="sidebarOverlay"></div>

            <!-- Sidebar -->
            <aside class="sidebar" id="sidebar" role="navigation" aria-label="Entity navigation">
                <div class="sidebar-header">
                    <!-- Search Input -->
                    <div class="sidebar-search">
                        <span class="sidebar-search-icon">${icons.search}</span>
                        <input type="text" class="sidebar-search-input" id="treeSearch" placeholder="Suchen..." aria-label="Search entities">
                        <button class="sidebar-search-clear" id="treeSearchClear" aria-label="Clear search">${icons.x}</button>
                    </div>
                </div>
                <div class="sidebar-header">
                    <!-- Controls Row -->
                    <div class="sidebar-controls">
                        <div class="group-by-dropdown" id="groupByDropdown">
                            <button class="group-by-trigger" id="groupByTrigger" aria-haspopup="listbox" aria-expanded="false">
                                <span class="group-by-trigger-icon">${icons.layers}</span>
                                <span class="group-by-trigger-text">Nach Schicht</span>
                                <span class="group-by-trigger-arrow">${icons.chevronDown}</span>
                            </button>
                            <div class="group-by-menu" id="groupByMenu" role="listbox">
                                <button class="group-by-option selected" data-value="layer" role="option">
                                    <span class="group-by-option-icon">${icons.layers}</span>
                                    <span>Nach Schicht</span>
                                </button>
                                <button class="group-by-option" data-value="system" role="option">
                                    <span class="group-by-option-icon">${icons.server}</span>
                                    <span>Nach System</span>
                                </button>
                                <button class="group-by-option" data-value="domain" role="option">
                                    <span class="group-by-option-icon">${icons.folder}</span>
                                    <span>Nach Domäne</span>
                                </button>
                            </div>
                        </div>
                        <button class="sidebar-control-btn" id="expandCollapseToggle" aria-label="Expand all" title="Alle erweitern">
                            ${icons.expandAll}
                        </button>
                        <div class="sort-dropdown" id="sortDropdown">
                            <button class="sidebar-control-btn" id="sortTrigger" aria-haspopup="listbox" aria-expanded="false" title="Sortieren">
                                ${icons.sortAsc}
                            </button>
                            <div class="sort-menu" id="sortMenu" role="listbox">
                                <button class="sort-option selected" data-value="name-asc" role="option">
                                    <span class="sort-option-icon">${icons.sortAsc}</span>
                                    <span>Name A-Z</span>
                                </button>
                                <button class="sort-option" data-value="name-desc" role="option">
                                    <span class="sort-option-icon">${icons.sortDesc}</span>
                                    <span>Name Z-A</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tree-container" id="treeContainer" role="tree">
                    <!-- Tree will be rendered here -->
                </div>
                <div class="sidebar-footer">
                    <select class="version-selector" id="versionSelector" aria-label="Select version">
                        <!-- Version options will be rendered here -->
                    </select>
                </div>
                <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar">
                    ${icons.panelLeft}
                </button>
            </aside>

            <!-- Main Content -->
            <main class="main-content" id="main-content">
                <nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb">
                    <!-- Breadcrumb will be rendered here -->
                </nav>
                <div id="contentBody">
                    <!-- Content will be rendered here -->
                </div>
            </main>
        </div>

        <!-- Footer -->
        <footer class="footer" role="contentinfo">
            <div class="footer-left">
                <a href="https://github.com/davras5/meta-atlas" target="_blank" rel="noopener noreferrer" class="footer-link">Quellcode</a>
                <span class="footer-separator">·</span>
                <a href="#" class="footer-link footer-link-disabled" title="Bald verfügbar">API</a>
                <span class="footer-separator">·</span>
                <a href="#" class="footer-link footer-link-disabled" title="Bald verfügbar">Kontakt</a>
            </div>
            <span class="footer-version">v0.1.0</span>
        </footer>
    `;
}

function renderVersionSelector() {
    const versionSelector = document.getElementById('versionSelector');
    if (!versionSelector) return;

    const versions = [
        { id: 'main', label: 'main' },
        { id: 'draft', label: 'draft' },
        { id: 'v1.0', label: 'v1.0' }
    ];
    versionSelector.innerHTML = versions.map(v =>
        `<option value="${v.id}" ${v.id === 'main' ? 'selected' : ''}>${v.label}</option>`
    ).join('');
}

function attachVersionSelectorListeners() {
    const versionSelector = document.getElementById('versionSelector');
    if (!versionSelector) return;

    versionSelector.addEventListener('change', (e) => {
        console.log('Version changed to:', e.target.value);
    });
}

// Helper function to filter items by search query
function filterItems(items, query) {
    if (!query) return items;
    return items.filter(item =>
        getText(item.name).toLowerCase().includes(query) ||
        getText(item.description).toLowerCase().includes(query)
    );
}

// Helper function to sort items
function sortItems(items, sortType) {
    const sorted = [...items];
    switch (sortType) {
        case 'name-asc':
            sorted.sort((a, b) => getText(a.name).localeCompare(getText(b.name)));
            break;
        case 'name-desc':
            sorted.sort((a, b) => getText(b.name).localeCompare(getText(a.name)));
            break;
    }
    return sorted;
}

function renderTree() {
    try {
        const container = getElement('treeContainer');
        if (!container) return;

        let html = '';
        const query = state.treeSearchQuery;
    const sortType = state.treeSort;

    // Get filtered and sorted data
    const filteredDomains = sortItems(filterItems(data.domains, query), sortType);
    const filteredEntities = sortItems(filterItems(data.entities, query), sortType);
    const filteredSystems = sortItems(filterItems(data.systems, query), sortType);

    // Also filter schemas if searching
    const hasLogicalMatches = filteredDomains.length > 0 || filteredEntities.length > 0;
    const hasPhysicalMatches = filteredSystems.length > 0 ||
        (query && data.schemas.some(s => getText(s.name).toLowerCase().includes(query)));

    // Logical Layer Section (Domains → Entities)
    const isLogicalExpanded = state.expandedLayers.has('logical');
    const showLogical = !query || hasLogicalMatches;
    if (showLogical) {
        html += `
            <div class="layer-section">
                <div class="layer-section-header logical ${!isLogicalExpanded ? 'collapsed' : ''}" data-layer="logical">
                    <span class="layer-toggle">${icons.chevronDown}</span>
                    <span>Logisch</span>
                </div>
                <div class="layer-section-content ${!isLogicalExpanded ? 'collapsed' : ''}">
        `;
        for (const domain of filteredDomains) {
            let entities = getEntitiesForDomain(domain.id);
            if (query) {
                entities = sortItems(filterItems(entities, query), sortType);
            } else {
                entities = sortItems(entities, sortType);
            }
            html += renderTreeItem(domain, entities);
        }
        html += `</div></div>`;
    }

    // Physical Layer Section
    const isPhysicalExpanded = state.expandedLayers.has('physical');
    const showPhysical = !query || hasPhysicalMatches;
    if (showPhysical) {
        html += `
            <div class="layer-section">
                <div class="layer-section-header physical ${!isPhysicalExpanded ? 'collapsed' : ''}" data-layer="physical">
                    <span class="layer-toggle">${icons.chevronDown}</span>
                    <span>Physisch</span>
                </div>
                <div class="layer-section-content ${!isPhysicalExpanded ? 'collapsed' : ''}">
        `;
        for (const system of filteredSystems) {
            let schemas = getSchemasForSystem(system.id);
            if (query) {
                schemas = sortItems(filterItems(schemas, query), sortType);
            } else {
                schemas = sortItems(schemas, sortType);
            }
            html += renderTreeItemWithSchemas(system, schemas);
        }
        html += `</div></div>`;
    }

    // Show empty state if no results
    if (!showLogical && !showPhysical) {
        html = `
            <div class="tree-empty-state">
                <span class="tree-empty-icon">${icons.search}</span>
                <span class="tree-empty-text">Keine Ergebnisse für "${escapeHtml(state.treeSearchQuery)}"</span>
            </div>
        `;
    }

    container.innerHTML = html;
        // Event delegation handles tree listeners
    } catch (error) {
        console.error('Error rendering tree:', error);
    }
}

function renderTreeItem(item, children) {
    const isExpanded = state.expandedNodes.has(item.id);
    const isSelected = state.selectedItem?.id === item.id;
    const hasChildren = children && children.length > 0;

    let childrenHtml = '';
    if (hasChildren) {
        for (const child of children) {
            childrenHtml += renderTreeLeaf(child);
        }
    }

    return `
        <div class="tree-item" data-id="${escapeHtml(item.id)}">
            <div class="tree-node ${escapeHtml(item.layer)} ${isSelected ? 'selected ' + escapeHtml(item.layer) : ''}"
                 data-id="${escapeHtml(item.id)}"
                 data-layer="${escapeHtml(item.layer)}"
                 role="treeitem"
                 aria-expanded="${isExpanded}"
                 aria-selected="${isSelected}">
                <span class="tree-toggle ${isExpanded ? 'expanded' : ''}" aria-hidden="true">
                    ${hasChildren ? icons.chevronRight : ''}
                </span>
                <span class="tree-icon">${getTreeIcon(item.type)}</span>
                <span class="tree-label">${escapeHtml(getText(item.name))}</span>
                ${hasChildren ? `<span class="tree-count">${children.length}</span>` : ''}
            </div>
            <div class="tree-children ${isExpanded ? 'expanded' : ''}" role="group" data-parent="${escapeHtml(item.id)}">
                ${childrenHtml}
            </div>
        </div>
    `;
}

function renderTreeItemWithSchemas(system, schemas) {
    const isExpanded = state.expandedNodes.has(system.id);
    const isSelected = state.selectedItem?.id === system.id;
    const hasChildren = schemas && schemas.length > 0;

    // Calculate total column count across all schemas
    const totalColumns = schemas.reduce((sum, schema) => sum + (schema.columns?.length || 0), 0);

    let schemasHtml = '';
    for (const schema of schemas) {
        schemasHtml += renderTreeSchemaWithColumns(schema);
    }

    return `
        <div class="tree-item" data-id="${escapeHtml(system.id)}">
            <div class="tree-node ${escapeHtml(system.layer)} ${isSelected ? 'selected ' + escapeHtml(system.layer) : ''}"
                 data-id="${escapeHtml(system.id)}"
                 data-layer="${escapeHtml(system.layer)}"
                 role="treeitem"
                 aria-expanded="${isExpanded}"
                 aria-selected="${isSelected}">
                <span class="tree-toggle ${isExpanded ? 'expanded' : ''}" aria-hidden="true">
                    ${hasChildren ? icons.chevronRight : ''}
                </span>
                <span class="tree-icon">${getTreeIcon(system.type)}</span>
                <span class="tree-label">${escapeHtml(getText(system.name))}</span>
                ${totalColumns > 0 ? `<span class="tree-count">${totalColumns}</span>` : ''}
            </div>
            <div class="tree-children ${isExpanded ? 'expanded' : ''}" role="group" data-parent="${escapeHtml(system.id)}">
                ${schemasHtml}
            </div>
        </div>
    `;
}

function renderTreeLeaf(item) {
    // For entities with attributes, use the expanded view
    if (item.type === 'entity' && item.attributes && item.attributes.length > 0) {
        return renderTreeEntityWithAttributes(item);
    }

    const isSelected = state.selectedItem?.id === item.id;
    return `
        <div class="tree-item" data-id="${escapeHtml(item.id)}">
            <div class="tree-node ${escapeHtml(item.layer)} ${isSelected ? 'selected ' + escapeHtml(item.layer) : ''}"
                 data-id="${escapeHtml(item.id)}"
                 data-layer="${escapeHtml(item.layer)}"
                 role="treeitem"
                 aria-selected="${isSelected}">
                <span class="tree-toggle" aria-hidden="true"></span>
                <span class="tree-icon">${getTreeIcon(item.type)}</span>
                <span class="tree-label">${escapeHtml(getText(item.name))}</span>
            </div>
        </div>
    `;
}

function renderTreeEntityWithAttributes(entity) {
    const isExpanded = state.expandedNodes.has(entity.id);
    const isSelected = state.selectedItem?.id === entity.id;
    const attributes = entity.attributes || [];
    const hasChildren = attributes.length > 0;

    let attributesHtml = '';
    if (hasChildren) {
        for (const attr of attributes) {
            attributesHtml += renderTreeAttribute(attr, entity.id);
        }
    }

    return `
        <div class="tree-item" data-id="${escapeHtml(entity.id)}">
            <div class="tree-node ${escapeHtml(entity.layer)} ${isSelected ? 'selected ' + escapeHtml(entity.layer) : ''}"
                 data-id="${escapeHtml(entity.id)}"
                 data-layer="${escapeHtml(entity.layer)}"
                 role="treeitem"
                 aria-expanded="${isExpanded}"
                 aria-selected="${isSelected}">
                <span class="tree-toggle ${isExpanded ? 'expanded' : ''}" aria-hidden="true">
                    ${hasChildren ? icons.chevronRight : ''}
                </span>
                <span class="tree-icon">${getTreeIcon(entity.type)}</span>
                <span class="tree-label">${escapeHtml(getText(entity.name))}</span>
                ${hasChildren ? `<span class="tree-count">${attributes.length}</span>` : ''}
            </div>
            <div class="tree-children ${isExpanded ? 'expanded' : ''}" role="group" data-parent="${escapeHtml(entity.id)}">
                ${attributesHtml}
            </div>
        </div>
    `;
}

function renderTreeAttribute(attr, entityId) {
    const attrName = getText(attr.name);
    const attrId = `${entityId}-attr-${attrName}`;
    const isSelected = getText(state.selectedAttribute?.attr?.name) === attrName &&
                       state.selectedAttribute?.parentItem?.id === entityId;
    return `
        <div class="tree-item tree-attribute" data-id="${escapeHtml(attrId)}" data-entity="${escapeHtml(entityId)}" data-attr-name="${escapeHtml(attrName)}">
            <div class="tree-node attribute-node ${isSelected ? 'selected' : ''}"
                 data-id="${escapeHtml(attrId)}"
                 data-entity="${escapeHtml(entityId)}"
                 data-attr-name="${escapeHtml(attrName)}"
                 role="treeitem"
                 aria-selected="${isSelected}">
                <span class="tree-toggle" aria-hidden="true"></span>
                <span class="tree-icon">${icons.hash}</span>
                <span class="tree-label">${escapeHtml(attrName)}</span>
            </div>
        </div>
    `;
}

function renderTreeSchemaWithColumns(schema) {
    const isExpanded = state.expandedNodes.has(schema.id);
    const isSelected = state.selectedItem?.id === schema.id;
    const columns = schema.columns || [];
    const hasChildren = columns.length > 0;

    let columnsHtml = '';
    if (hasChildren) {
        for (const col of columns) {
            columnsHtml += renderTreeColumn(col, schema.id);
        }
    }

    return `
        <div class="tree-item" data-id="${escapeHtml(schema.id)}">
            <div class="tree-node ${escapeHtml(schema.layer)} ${isSelected ? 'selected ' + escapeHtml(schema.layer) : ''}"
                 data-id="${escapeHtml(schema.id)}"
                 data-layer="${escapeHtml(schema.layer)}"
                 role="treeitem"
                 aria-expanded="${isExpanded}"
                 aria-selected="${isSelected}">
                <span class="tree-toggle ${isExpanded ? 'expanded' : ''}" aria-hidden="true">
                    ${hasChildren ? icons.chevronRight : ''}
                </span>
                <span class="tree-icon">${getTreeIcon(schema.type)}</span>
                <span class="tree-label">${escapeHtml(getText(schema.name))}</span>
                ${hasChildren ? `<span class="tree-count">${columns.length}</span>` : ''}
            </div>
            <div class="tree-children ${isExpanded ? 'expanded' : ''}" role="group" data-parent="${escapeHtml(schema.id)}">
                ${columnsHtml}
            </div>
        </div>
    `;
}

function renderTreeColumn(col, schemaId) {
    const colId = `${schemaId}-col-${col.name}`;
    const isSelected = state.selectedAttribute?.attr?.name === col.name &&
                       state.selectedAttribute?.parentItem?.id === schemaId;
    return `
        <div class="tree-item tree-column" data-id="${escapeHtml(colId)}" data-schema="${escapeHtml(schemaId)}" data-col-name="${escapeHtml(col.name)}">
            <div class="tree-node column-node ${isSelected ? 'selected' : ''}"
                 data-id="${escapeHtml(colId)}"
                 data-schema="${escapeHtml(schemaId)}"
                 data-col-name="${escapeHtml(col.name)}"
                 role="treeitem"
                 aria-selected="${isSelected}">
                <span class="tree-toggle" aria-hidden="true"></span>
                <span class="tree-icon">${icons.hash}</span>
                <span class="tree-label">${escapeHtml(col.name)}</span>
            </div>
        </div>
    `;
}

function renderBreadcrumb(item) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    let html = '';

    // Always show "Alle Kataloge" as the first breadcrumb item
    html += `<span class="breadcrumb-home" data-action="home" tabindex="0">${icons.home} Alle Kataloge</span>`;

    if (!item) {
        breadcrumb.innerHTML = html;
        // Event delegation handles breadcrumb listeners
        return;
    }

    // Add separator after "Alle Kataloge"
    html += `<span class="breadcrumb-separator" aria-hidden="true">/</span>`;

    // If we have a current catalog and the item is not the catalog itself, show the catalog
    if (state.currentCatalog && item.type !== 'catalog') {
        html += `<span class="breadcrumb-item" data-id="${escapeHtml(state.currentCatalog.id)}" tabindex="0">${escapeHtml(getText(state.currentCatalog.name))}</span>`;
        html += `<span class="breadcrumb-separator" aria-hidden="true">/</span>`;
    }

    // If item is a catalog, just show it as current
    if (item.type === 'catalog') {
        html += `<span class="breadcrumb-current" aria-current="page">${escapeHtml(getText(item.name))}</span>`;
        breadcrumb.innerHTML = html;
        // Event delegation handles breadcrumb listeners
        return;
    }

    // Add layer indicator
    if (item.layer) {
        html += `<span class="breadcrumb-item layer-${escapeHtml(item.layer)}" data-layer="${escapeHtml(item.layer)}" tabindex="0">${escapeHtml(getLayerLabel(item.layer))}</span>`;
        html += `<span class="breadcrumb-separator" aria-hidden="true">/</span>`;
    }

    // Add parent chain
    const chain = getParentChain(item);
    html += chain.map(parent =>
        `<span class="breadcrumb-item" data-id="${escapeHtml(parent.id)}" tabindex="0">${escapeHtml(getText(parent.name))}</span>
         <span class="breadcrumb-separator" aria-hidden="true">/</span>`
    ).join('');

    html += `<span class="breadcrumb-current" aria-current="page">${escapeHtml(getText(item.name))}</span>`;
    breadcrumb.innerHTML = html;
    // Event delegation handles breadcrumb listeners
}

function goToCatalogsOverview() {
    state.currentCatalog = null;
    state.selectedItem = null;
    state.showCatalogsOverview = true;
    updateLayoutForView();
    navigateTo('/');
}

function updateLayoutForView() {
    const appContainer = document.querySelector('.app-container');
    if (state.showCatalogsOverview) {
        appContainer?.classList.add('catalogs-overview-mode');
    } else {
        appContainer?.classList.remove('catalogs-overview-mode');
    }
}

function renderCatalogsOverview() {
    try {
        const container = getElement('contentBody');
        if (!container) return;

        container.innerHTML = `
            <div class="catalogs-overview">
                <div class="catalogs-header">
                    <div class="catalogs-header-top">
                        <h1 class="catalogs-title">Alle Kataloge</h1>
                        <button class="btn-new-catalog" id="newCatalogBtn">
                            ${icons.plus}
                            <span>Neuer Katalog</span>
                        </button>
                    </div>
                </div>
                <div class="catalogs-list">
                    ${data.catalogs.map(catalog => renderCatalogCard(catalog)).join('')}
                </div>
            </div>
        `;
        // Event delegation handles catalog card listeners
    } catch (error) {
        console.error('Error rendering catalogs overview:', error);
    }
}

function renderCatalogCard(catalog) {
    // Calculate entity count from domains
    const catalogEntities = data.entities.filter(e => catalog.domains?.includes(e.domain));
    const entityCount = catalogEntities.length;

    // Calculate table count from entities' physicalTables
    const tableIds = new Set();
    catalogEntities.forEach(e => {
        (e.physicalTables || []).forEach(tId => tableIds.add(tId));
    });
    const tableCount = tableIds.size;

    return `
        <div class="catalog-card" data-id="${escapeHtml(catalog.id)}" style="--catalog-color: ${escapeHtml(catalog.color || '#3B82F6')}">
            <div class="catalog-card-header">
                <div class="catalog-info">
                    <div class="catalog-name">${escapeHtml(getText(catalog.name))}</div>
                </div>
                <span class="catalog-status ${escapeHtml(catalog.status)}">${getStatusLabel(catalog.status)}</span>
            </div>
            <p class="catalog-description">${escapeHtml(getText(catalog.description))}</p>
            <div class="catalog-meta">
                <div class="catalog-meta-item">
                    ${icons.box}
                    <span class="catalog-meta-value">${entityCount}</span> Entitäten
                </div>
                <div class="catalog-meta-item">
                    ${icons.database}
                    <span class="catalog-meta-value">${tableCount}</span> Schemas
                </div>
                <div class="catalog-activity">
                    Letzte Aktivität : ${escapeHtml(catalog.lastActivity || catalog.updated || catalog.created)}
                </div>
            </div>
        </div>
    `;
}

function selectCatalog(catalogId) {
    const catalog = data.catalogs.find(c => c.id === catalogId);
    if (catalog) {
        state.currentCatalog = catalog;
        state.selectedItem = catalog;
        state.showCatalogsOverview = false;
        updateLayoutForView();
        navigateTo(`/catalog/${catalog.id}`);
    }
}

function renderStatisticsCard(item) {
    const kpis = getEntityKPIs(item);
    if (!kpis || kpis.length === 0) return '';

    return `
        <div class="card">
            <div class="card-header" data-card="statistics" aria-expanded="true">
                <span class="card-title">Statistiken</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content">
                <div class="catalog-stats-grid">
                    ${kpis.map(kpi => `
                        <div class="catalog-stat-item">
                            <span class="catalog-stat-icon">${kpi.icon}</span>
                            <div class="catalog-stat-content">
                                <span class="catalog-stat-value">${kpi.value}</span>
                                <span class="catalog-stat-label">${kpi.label}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function getEntityKPIs(item) {
    switch (item.type) {
        case 'domain':
            return []; // No KPI cards for domains
        case 'entity':
            const attributes = item.attributes || [];
            return [
                { label: 'Attribute', value: attributes.length, icon: icons.hash }
            ];
        case 'system':
            const schemasInSystem = data.schemas.filter(s => s.system === item.id);
            const columnsInSystem = schemasInSystem.reduce((sum, s) => sum + (s.columns?.length || 0), 0);
            return [
                { label: 'Schemas', value: schemasInSystem.length, icon: icons.database },
                { label: 'Spalten', value: columnsInSystem, icon: icons.hash }
            ];
        case 'schema':
            const columns = item.columns || [];
            return [
                { label: 'Spalten', value: columns.length, icon: icons.hash }
            ];
        default:
            return [];
    }
}

function renderContent() {
    try {
        const contentBody = getElement('contentBody');
        if (!contentBody) return;

        // Show catalogs overview when on root route
        if (state.showCatalogsOverview) {
            renderBreadcrumb(null);
            renderCatalogsOverview();
            return;
        }

    // If we have a catalog selected but no specific item, show the catalog detail
    if (!state.selectedItem && state.currentCatalog) {
        state.selectedItem = state.currentCatalog;
    }

    const item = state.selectedItem;

    if (!item) {
        renderBreadcrumb(null);
        document.getElementById('contentBody').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">${icons.database}</div>
                <h2 class="empty-state-title">Element auswählen</h2>
                <p>Wählen Sie ein Element aus der Navigation, um dessen Details anzuzeigen</p>
            </div>
        `;
        return;
    }

    renderBreadcrumb(item);

    const container = document.getElementById('contentBody');

    // Catalog-specific view with Details, Users, Settings tabs
    if (item.type === 'catalog') {
        container.innerHTML = `
            <div class="entity-header">
                <h1 class="entity-title">${escapeHtml(getText(item.name))}</h1>
                <p class="entity-subtitle">${escapeHtml(getText(item.description))}</p>
            </div>

            <div class="view-tabs" role="tablist">
                <button class="view-tab ${state.catalogView === 'details' ? 'active' : ''}" data-catalog-view="details" role="tab" aria-selected="${state.catalogView === 'details'}">Details</button>
                <button class="view-tab ${state.catalogView === 'users' ? 'active' : ''}" data-catalog-view="users" role="tab" aria-selected="${state.catalogView === 'users'}">Benutzer</button>
                <button class="view-tab ${state.catalogView === 'settings' ? 'active' : ''}" data-catalog-view="settings" role="tab" aria-selected="${state.catalogView === 'settings'}">Einstellungen</button>
            </div>

            <div class="view-content" role="tabpanel">
                ${renderCatalogTabContent(item)}
            </div>
        `;
        // Event delegation handles catalog tab listeners
        return;
    }

    const tabs = [
        { id: 'wiki', label: 'Details' },
        { id: 'diagram', label: 'Diagramm' },
        { id: 'history', label: 'Verlauf' }
    ];

    container.innerHTML = `
        <div class="entity-header">
            <div class="entity-badges">
                <span class="badge badge-layer ${escapeHtml(item.layer)}">${getTypeLabel(item.type)}</span>
            </div>
            <h1 class="entity-title">${escapeHtml(getText(item.name))}</h1>
            <p class="entity-subtitle">${escapeHtml(getText(item.description))}</p>
        </div>

        <div class="view-tabs" role="tablist">
            ${tabs.map(tab => `
                <button class="view-tab ${state.currentView === tab.id ? 'active' : ''}"
                        data-view="${tab.id}"
                        role="tab"
                        aria-selected="${state.currentView === tab.id}">
                    ${tab.label}
                </button>
            `).join('')}
        </div>

        <div class="view-content" role="tabpanel">
            ${state.currentView === 'wiki' ? renderWikiView(item) :
              state.currentView === 'diagram' ? renderDiagramView(item) :
              renderPlaceholderView(state.currentView)}
        </div>
    `;
        // Event delegation handles content and view tab listeners
    } catch (error) {
        console.error('Error rendering content:', error);
    }
}

function renderWikiView(item) {
    let html = '';

    // Statistics Card (first card)
    html += renderStatisticsCard(item);

    // Basic Information Card
    html += `
        <div class="card">
            <div class="card-header" data-card="basic" aria-expanded="true">
                <span class="card-title">Grundinformationen</span>
                <div class="card-header-actions">
                    <select class="lang-selector" id="langSelector" aria-label="Sprache wählen">
                        <option value="de" ${currentLang === 'de' ? 'selected' : ''}>DE</option>
                        <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
                        <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>FR</option>
                        <option value="it" ${currentLang === 'it' ? 'selected' : ''}>IT</option>
                    </select>
                    <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
                </div>
            </div>
            <div class="card-content">
                <div class="meta-grid">
                    <span class="meta-label">Name :</span>
                    <span class="meta-value">${escapeHtml(getText(item.name))}</span>
                    <span class="meta-label">Beschreibung :</span>
                    <span class="meta-value">${escapeHtml(getText(item.description) || '—')}</span>
                    ${item.synonyms ? `
                        <span class="meta-label">Synonyme :</span>
                        <span class="meta-value">${item.synonyms.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</span>
                    ` : ''}
                    ${item.termdatUrl ? `
                        <span class="meta-label">TERMDAT :</span>
                        <span class="meta-value"><a href="${escapeHtml(item.termdatUrl)}" target="_blank" rel="noopener noreferrer" class="external-link"><span class="link-icon">${icons.externalLink}</span> Glossareintrag öffnen</a></span>
                    ` : ''}
                    ${item.owner ? `
                        <span class="meta-label">Verantwortlich :</span>
                        <span class="meta-value">${escapeHtml(getText(item.owner))}</span>
                    ` : ''}
                    ${item.technology ? `
                        <span class="meta-label">Technologie :</span>
                        <span class="meta-value"><span class="tag tag-mono">${escapeHtml(item.technology)}</span></span>
                    ` : ''}
                    ${item.rowCount ? `
                        <span class="meta-label">Zeilenanzahl :</span>
                        <span class="meta-value">${item.rowCount.toLocaleString()}</span>
                    ` : ''}
                    ${item.status ? `
                        <span class="meta-label">Status :</span>
                        <span class="meta-value">
                            <span class="status-indicator">
                                <span class="status-dot ${escapeHtml(item.status)}" aria-hidden="true"></span>
                                ${getStatusLabel(item.status)}
                            </span>
                        </span>
                    ` : ''}
                    ${item.created ? `
                        <span class="meta-label">Erstellt :</span>
                        <span class="meta-value">${escapeHtml(item.created)}</span>
                    ` : ''}
                    ${item.updated ? `
                        <span class="meta-label">Letzte Änderung :</span>
                        <span class="meta-value">${escapeHtml(item.updated)}</span>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    // Concepts Panel (for domains only)
    if (item.type === 'domain') {
        const domainEntities = data.entities.filter(e => e.domain === item.id);
        html += `
            <div class="card">
                <div class="card-header" data-card="entities" aria-expanded="true">
                    <span class="card-title">Logische Entitäten (${domainEntities.length})</span>
                    <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
                </div>
                <div class="card-content card-content--flush">
                    ${domainEntities.length > 0 ? `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Beschreibung</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${domainEntities.map(entity => `
                                    <tr class="clickable-row" data-id="${escapeHtml(entity.id)}">
                                        <td>${escapeHtml(getText(entity.name))}</td>
                                        <td>${escapeHtml(getText(entity.description) || '—')}</td>
                                        <td><span class="tag">${getStatusLabel(entity.status || 'active')}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-list-message">Keine Entitäten in dieser Domäne</div>'}
                </div>
            </div>
        `;
    }

    // Schemas Panel (for systems only)
    if (item.type === 'system') {
        const systemSchemas = data.schemas.filter(s => s.system === item.id);
        html += `
            <div class="card">
                <div class="card-header" data-card="schemas" aria-expanded="true">
                    <span class="card-title">Schemas (${systemSchemas.length})</span>
                    <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
                </div>
                <div class="card-content card-content--flush">
                    ${systemSchemas.length > 0 ? `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Beschreibung</th>
                                    <th>Spalten</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${systemSchemas.map(schema => `
                                    <tr class="clickable-row" data-id="${escapeHtml(schema.id)}">
                                        <td>${escapeHtml(getText(schema.name))}</td>
                                        <td>${escapeHtml(getText(schema.description) || '—')}</td>
                                        <td>${schema.columns?.length || 0}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-list-message">Keine Schemas in diesem System</div>'}
                </div>
            </div>
        `;
    }

    // Compliance Panel (for entities only)
    if (item.type === 'entity') {
        html += `
            <div class="card">
                <div class="card-header" data-card="compliance" aria-expanded="true">
                    <span class="card-title">Compliance & Recht</span>
                    <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
                </div>
                <div class="card-content">
                    <div class="meta-grid">
                        ${item.legalRefs && item.legalRefs.length ? `
                            <span class="meta-label">Rechtliche Grundlagen :</span>
                            <span class="meta-value">${item.legalRefs.map(r => `<span class="tag">${escapeHtml(r)}</span>`).join('')}</span>
                        ` : ''}
                        ${item.standards && item.standards.length ? `
                            <span class="meta-label">Standards :</span>
                            <span class="meta-value">${item.standards.map(s => `<span class="tag tag-mono">${escapeHtml(s)}</span>`).join('')}</span>
                        ` : ''}
                        <span class="meta-label">Klassifikation :</span>
                        <span class="meta-value">
                            <span class="badge badge-compliance internal">Intern</span>
                        </span>
                        <span class="meta-label">Personendaten :</span>
                        <span class="meta-value">Nein</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Attributes Panel (for entities and tables)
    if (item.attributes || item.columns) {
        const attrs = item.attributes || item.columns;
        const isAttribute = !!item.attributes;
        html += `
            <div class="card">
                <div class="card-header" data-card="attributes" aria-expanded="true">
                    <span class="card-title">${isAttribute ? 'Attribute' : 'Spalten'} (${attrs.length})</span>
                    <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
                </div>
                <div class="card-content card-content--flush">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Typ</th>
                                <th>Schlüssel</th>
                                <th>Werteliste</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${attrs.map(attr => {
                                const enumId = attr.enumeration_id || attr.enumeration;
                                const enumItem = enumId ? data.enumerations.find(e => e.id === enumId) : null;
                                const enumName = enumItem ? getText(enumItem.name) : null;
                                return `
                                <tr class="clickable-row" data-attr-name="${escapeHtml(getText(attr.name))}" data-parent-id="${escapeHtml(item.id)}" data-parent-type="${escapeHtml(item.type)}">
                                    <td>${escapeHtml(getText(attr.name))}</td>
                                    <td>${escapeHtml(attr.type)}</td>
                                    <td>${attr.key ? `<span class="tag">${escapeHtml(attr.key)}</span>` : '—'}</td>
                                    <td>${enumName || '—'}</td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Cross-Layer Mappings
    html += renderMappingsPanel(item);

    return html;
}

function renderAttributeDetailView(attr, parentItem) {
    const isAttribute = parentItem.type === 'entity';
    const itemLabel = isAttribute ? 'Attribut' : 'Spalte';
    const parentLabel = isAttribute ? 'Entität' : 'Tabelle';

    // Find enumeration if exists
    const enumeration = attr.enumeration ? data.enumerations.find(e => e.id === attr.enumeration) : null;

    let html = `
        <div class="entity-header">
            <div class="entity-badges">
                <span class="badge badge-layer ${escapeHtml(parentItem.layer)}">${itemLabel}</span>
            </div>
            <h1 class="entity-title">${escapeHtml(getText(attr.name))}</h1>
            <p class="entity-subtitle">${escapeHtml(getText(attr.description))}</p>
        </div>

        <div class="view-content" role="tabpanel">
    `;

    // Grundinformationen Card
    html += `
        <div class="card">
            <div class="card-header" data-card="basic" aria-expanded="true">
                <span class="card-title">Grundinformationen</span>
                <div class="card-header-actions">
                    <select class="lang-selector" id="langSelector" aria-label="Sprache wählen">
                        <option value="de" ${currentLang === 'de' ? 'selected' : ''}>DE</option>
                        <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
                        <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>FR</option>
                        <option value="it" ${currentLang === 'it' ? 'selected' : ''}>IT</option>
                    </select>
                    <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
                </div>
            </div>
            <div class="card-content">
                <div class="meta-grid">
                    <span class="meta-label">Name :</span>
                    <span class="meta-value">${escapeHtml(getText(attr.name))}</span>
                    <span class="meta-label">Beschreibung :</span>
                    <span class="meta-value">${escapeHtml(getText(attr.description) || '—')}</span>
                    <span class="meta-label">Datentyp :</span>
                    <span class="meta-value">${escapeHtml(attr.type)}</span>

                    <span class="meta-label">Nullable :</span>
                    <span class="meta-value">${attr.nullable ? 'Ja' : 'Nein'}</span>

                    <span class="meta-label">Schlüssel :</span>
                    <span class="meta-value">${attr.key ? `<span class="tag">${escapeHtml(attr.key)}</span>` : '—'}</span>

                    <span class="meta-label">${parentLabel} :</span>
                    <span class="meta-value"><a href="#" class="attr-parent-link" data-id="${escapeHtml(parentItem.id)}">${escapeHtml(getText(parentItem.name))}</a></span>

                    ${enumeration ? `
                        <span class="meta-label">Enumeration :</span>
                        <span class="meta-value">${escapeHtml(getText(enumeration.name))}</span>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    // Compliance & Recht Card
    html += `
        <div class="card">
            <div class="card-header" data-card="compliance" aria-expanded="true">
                <span class="card-title">Compliance & Recht</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content">
                <div class="meta-grid">
                    <span class="meta-label">Klassifikation :</span>
                    <span class="meta-value"><span class="badge badge-compliance internal">Intern</span></span>

                    <span class="meta-label">Personendaten :</span>
                    <span class="meta-value">${getText(attr.name).toLowerCase().includes('name') || getText(attr.name).toLowerCase().includes('email') ? 'Ja' : 'Nein'}</span>

                    <span class="meta-label">Aufbewahrungsfrist :</span>
                    <span class="meta-value">10 Jahre</span>

                    <span class="meta-label">Rechtsgrundlage :</span>
                    <span class="meta-value">DSG Art. 6</span>
                </div>
            </div>
        </div>
    `;

    // Reference Data Card (only if enumeration exists)
    if (enumeration) {
        html += `
            <div class="card">
                <div class="card-header" data-card="reference" aria-expanded="true">
                    <span class="card-title">Referenzdaten (${enumeration.values?.length || 0})</span>
                    <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
                </div>
                <div class="card-content card-content--flush">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Bezeichnung</th>
                                <th>Beschreibung</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(enumeration.values || []).map(val => `
                                <tr>
                                    <td>${escapeHtml(val.code)}</td>
                                    <td>${escapeHtml(getText(val.label))}</td>
                                    <td>${escapeHtml(getText(val.description) || '—')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

function renderMappingsPanel(item) {
    const mappings = { logical: [], physical: [] };

    if (item.type === 'domain') {
        const entities = data.entities.filter(e => e.domain === item.id);
        mappings.logical = entities;
    } else if (item.type === 'entity') {
        // Get parent domain
        if (item.domain) {
            const domain = findItemById(item.domain);
            if (domain) mappings.logical.push(domain);
        }
        item.physicalTables?.forEach(tId => {
            const table = findItemById(tId);
            if (table) mappings.physical.push(table);
        });
    } else if (item.type === 'schema') {
        // Get entities that map to this schema
        const mappedEntities = data.entities.filter(e =>
            e.physicalTables?.includes(item.id)
        );
        mappings.logical = mappedEntities;
    }

    const hasMappings = mappings.logical.length || mappings.physical.length;
    if (!hasMappings) return '';

    return `
        <div class="card">
            <div class="card-header" data-card="mappings" aria-expanded="true">
                <span class="card-title">Zuordnungen</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content">
                ${mappings.logical.length ? `
                    <div class="mapping-section">
                        <div class="mapping-section-header">Logische Schicht</div>
                        ${mappings.logical.map(m => renderMappingCard(m)).join('')}
                    </div>
                ` : ''}
                ${mappings.physical.length ? `
                    <div class="mapping-section">
                        <div class="mapping-section-header">Physische Schicht</div>
                        ${mappings.physical.map(m => renderMappingCard(m)).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderMappingCard(item) {
    return `
        <div class="mapping-card ${escapeHtml(item.layer)}" data-id="${escapeHtml(item.id)}" tabindex="0" role="button">
            <div class="mapping-icon ${escapeHtml(item.layer)}">${getTypeIcon(item.type)}</div>
            <div class="mapping-info">
                <div class="mapping-title">${escapeHtml(getText(item.name))}</div>
                <div class="mapping-subtitle">${getTypeLabel(item.type)}</div>
            </div>
            <span class="mapping-arrow" aria-hidden="true">${icons.arrowRight}</span>
        </div>
    `;
}

// Catalog Tab Content Rendering
function renderCatalogTabContent(catalog) {
    switch (state.catalogView) {
        case 'details':
            return renderCatalogDetailsTab(catalog);
        case 'users':
            return renderCatalogMembersTab(catalog);
        case 'settings':
            return renderCatalogSettingsTab(catalog);
        default:
            return renderCatalogDetailsTab(catalog);
    }
}

function renderCatalogDetailsTab(catalog) {
    // Count all entities (simplified for prototype)
    const catalogDomains = data.domains || [];
    const catalogEntities = data.entities || [];
    const catalogSystems = data.systems || [];
    const catalogSchemas = data.schemas || [];
    const catalogEnumerations = data.enumerations || [];
    const catalogVersions = data.versions || [];

    // Count attributes (from entities) and columns (from schemas)
    const totalAttributes = catalogEntities.reduce((sum, e) => sum + (e.attributes?.length || 0), 0);
    const totalColumns = catalogSchemas.reduce((sum, s) => sum + (s.columns?.length || 0), 0);

    return `
        <div class="card">
            <div class="card-header" data-card="statistics" aria-expanded="true">
                <span class="card-title">Statistiken</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content">
                <div class="catalog-stats-grid">
                    <div class="catalog-stat-item">
                        <span class="catalog-stat-icon">${icons.folder}</span>
                        <div class="catalog-stat-content">
                            <span class="catalog-stat-value">${catalogDomains.length}</span>
                            <span class="catalog-stat-label">Domänen</span>
                        </div>
                    </div>
                    <div class="catalog-stat-item">
                        <span class="catalog-stat-icon">${icons.cube}</span>
                        <div class="catalog-stat-content">
                            <span class="catalog-stat-value">${catalogEntities.length}</span>
                            <span class="catalog-stat-label">Entitäten</span>
                        </div>
                    </div>
                    <div class="catalog-stat-item">
                        <span class="catalog-stat-icon">${icons.list}</span>
                        <div class="catalog-stat-content">
                            <span class="catalog-stat-value">${totalAttributes}</span>
                            <span class="catalog-stat-label">Attribute</span>
                        </div>
                    </div>
                    <div class="catalog-stat-item">
                        <span class="catalog-stat-icon">${icons.tag}</span>
                        <div class="catalog-stat-content">
                            <span class="catalog-stat-value">${catalogEnumerations.length}</span>
                            <span class="catalog-stat-label">Wertedomänen</span>
                        </div>
                    </div>
                    <div class="catalog-stat-item">
                        <span class="catalog-stat-icon">${icons.server}</span>
                        <div class="catalog-stat-content">
                            <span class="catalog-stat-value">${catalogSystems.length}</span>
                            <span class="catalog-stat-label">Systeme</span>
                        </div>
                    </div>
                    <div class="catalog-stat-item">
                        <span class="catalog-stat-icon">${icons.database}</span>
                        <div class="catalog-stat-content">
                            <span class="catalog-stat-value">${catalogSchemas.length}</span>
                            <span class="catalog-stat-label">Schemas</span>
                        </div>
                    </div>
                    <div class="catalog-stat-item">
                        <span class="catalog-stat-icon">${icons.table}</span>
                        <div class="catalog-stat-content">
                            <span class="catalog-stat-value">${totalColumns}</span>
                            <span class="catalog-stat-label">Spalten</span>
                        </div>
                    </div>
                    <div class="catalog-stat-item">
                        <span class="catalog-stat-icon">${icons.history}</span>
                        <div class="catalog-stat-content">
                            <span class="catalog-stat-value">${catalogVersions.length}</span>
                            <span class="catalog-stat-label">Versionen</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header" data-card="overview" aria-expanded="true">
                <span class="card-title">Grundinformationen</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content">
                <div class="meta-grid">
                    <span class="meta-label">Name :</span>
                    <span class="meta-value">${escapeHtml(getText(catalog.name, 'de'))}</span>
                    <span class="meta-label">Beschreibung :</span>
                    <span class="meta-value">${escapeHtml(getText(catalog.description) || '—')}</span>
                    <span class="meta-label">Verantwortlich :</span>
                    <span class="meta-value">${escapeHtml(getText(catalog.owner) || '—')}</span>
                    <span class="meta-label">Erstellt :</span>
                    <span class="meta-value">${escapeHtml(catalog.created || '—')}</span>
                    <span class="meta-label">Status :</span>
                    <span class="meta-value">
                        <span class="status-indicator">
                            <span class="status-dot ${escapeHtml(catalog.status)}" aria-hidden="true"></span>
                            ${getStatusLabel(catalog.status) || 'Unbekannt'}
                        </span>
                    </span>
                </div>
            </div>
        </div>
    `;
}

function renderCatalogMembersTab(catalog) {
    const members = catalog.members || [];

    return `
        <div class="card">
            <div class="card-header" data-card="team" aria-expanded="true">
                <span class="card-title">Teammitglieder (${members.length})</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content card-content--flush">
                ${members.length > 0 ? `
                    <div class="members-list">
                        ${members.map(member => `
                            <div class="member-item">
                                <div class="member-avatar">${getUserAvatar(member.name)}</div>
                                <div class="member-info">
                                    <span class="member-name">${escapeHtml(member.name)}</span>
                                    <span class="member-email text-secondary">${escapeHtml(member.email)}</span>
                                </div>
                                <span class="member-role badge badge-outline">${getRoleLabel(member.role)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-list-message">Keine Teammitglieder zugewiesen</div>'}
            </div>
        </div>
    `;
}

function renderCatalogSettingsTab(catalog) {
    return `
        <div class="card">
            <div class="card-header" data-card="general" aria-expanded="true">
                <span class="card-title">Allgemeine Einstellungen</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content">
                <div class="settings-form">
                    <div class="setting-row">
                        <label class="setting-label">Katalogname :</label>
                        <input type="text" class="setting-input" value="${escapeHtml(getText(catalog.name))}" readonly />
                    </div>
                    <div class="setting-row">
                        <label class="setting-label">Katalog-ID :</label>
                        <input type="text" class="setting-input" value="${escapeHtml(catalog.id)}" readonly />
                    </div>
                    <div class="setting-row">
                        <label class="setting-label">Standardsprache :</label>
                        <select class="setting-select" disabled>
                            <option value="de" selected>Deutsch (DE)</option>
                            <option value="en">Englisch (EN)</option>
                            <option value="fr">Französisch (FR)</option>
                            <option value="it">Italienisch (IT)</option>
                        </select>
                    </div>
                    <div class="setting-row">
                        <label class="setting-label">Sichtbarkeit :</label>
                        <select class="setting-select" disabled>
                            <option value="internal" selected>Intern (Bundesebene)</option>
                            <option value="public">Öffentlich</option>
                            <option value="restricted">Eingeschränkt</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header" data-card="notifications" aria-expanded="true">
                <span class="card-title">Benachrichtigungen</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content">
                <div class="settings-form">
                    <div class="setting-row setting-toggle-row">
                        <div class="setting-toggle-info">
                            <span class="setting-label">E-Mail-Benachrichtigungen</span>
                            <span class="setting-desc text-secondary">E-Mail-Updates bei Änderungen erhalten</span>
                        </div>
                        <label class="toggle">
                            <input type="checkbox" checked disabled />
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="setting-row setting-toggle-row">
                        <div class="setting-toggle-info">
                            <span class="setting-label">Wöchentliche Zusammenfassung</span>
                            <span class="setting-desc text-secondary">Zusammenfassung aller Änderungen der letzten Woche</span>
                        </div>
                        <label class="toggle">
                            <input type="checkbox" disabled />
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="setting-row setting-toggle-row">
                        <div class="setting-toggle-info">
                            <span class="setting-label">Genehmigungsanfragen</span>
                            <span class="setting-desc text-secondary">Benachrichtigung bei ausstehenden Genehmigungen</span>
                        </div>
                        <label class="toggle">
                            <input type="checkbox" checked disabled />
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header" data-card="danger" aria-expanded="true">
                <span class="card-title">Gefahrenzone</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content">
                <div class="danger-zone">
                    <div class="danger-item">
                        <div class="danger-info">
                            <span class="danger-title">Katalog archivieren</span>
                            <span class="danger-desc text-secondary">Dieses Katalog archivieren. Kann später wiederhergestellt werden.</span>
                        </div>
                        <button class="btn btn-outline-danger" disabled>Archivieren</button>
                    </div>
                    <div class="danger-item">
                        <div class="danger-info">
                            <span class="danger-title">Katalog löschen</span>
                            <span class="danger-desc text-secondary">Diesen Katalog und alle Daten dauerhaft löschen.</span>
                        </div>
                        <button class="btn btn-danger" disabled>Löschen</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPlaceholderView(view) {
    const viewInfo = {
        diagram: { icon: icons.box, title: 'Entitätsdiagramm', desc: 'Visuelles Entity-Relationship-Diagramm' },
        lineage: { icon: icons.arrowRight, title: 'Datenherkunft', desc: 'Datenfluss von Quelle zu Ziel' },
        history: { icon: icons.hash, title: 'Versionsverlauf', desc: 'Änderungsprotokoll und Versionierung' }
    };
    const info = viewInfo[view] || { icon: '?', title: view, desc: '' };
    return `
        <div class="placeholder-view">
            <div class="placeholder-icon" aria-hidden="true">${info.icon}</div>
            <h3 class="placeholder-title">${info.title}</h3>
            <p class="placeholder-desc">${info.desc}</p>
            <p class="coming-soon-hint">Demnächst verfügbar</p>
        </div>
    `;
}

function renderDiagramView(item) {
    const diagramId = `diagram-${Date.now()}`;
    const diagramResult = generateDiagram(item);

    // Schedule diagram rendering after DOM update
    setTimeout(() => {
        const element = document.getElementById(diagramId);
        if (element) {
            element.innerHTML = diagramResult.svg;
            initDiagramControls(diagramId);
        }
    }, 0);

    return `
        <div class="card diagram-card">
            <div class="card-header" data-card="diagram" aria-expanded="true">
                <span class="card-title">${getDiagramTitle(item)}</span>
                <span class="card-toggle" aria-hidden="true">${icons.chevronDown}</span>
            </div>
            <div class="card-content diagram-content">
                <div class="diagram-viewport" id="${diagramId}-viewport">
                    <div id="${diagramId}" class="diagram-container"></div>
                </div>
                <div class="diagram-controls">
                    <button class="diagram-control-btn" data-action="zoom-in" title="Vergrössern">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                    </button>
                    <button class="diagram-control-btn" data-action="zoom-out" title="Verkleinern">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                    </button>
                    <button class="diagram-control-btn" data-action="reset" title="Zurücksetzen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                        </svg>
                    </button>
                    <button class="diagram-control-btn" data-action="fullscreen" title="Vollbild">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="diagram-legend">
                ${renderDiagramLegend(item)}
            </div>
        </div>
    `;
}

// Initialize diagram pan/zoom controls
function initDiagramControls(diagramId) {
    const viewport = document.getElementById(`${diagramId}-viewport`);
    const container = document.getElementById(diagramId);
    if (!viewport || !container) return;

    // State for zoom and pan
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    const minScale = 0.25;
    const maxScale = 3;
    const zoomStep = 0.25;

    function updateTransform() {
        container.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        container.style.transformOrigin = 'center center';
    }

    // Mouse wheel zoom
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
        const newScale = Math.min(maxScale, Math.max(minScale, scale + delta));

        if (newScale !== scale) {
            // Zoom towards mouse position
            const rect = viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;

            const scaleDiff = newScale / scale;
            panX = mouseX - (mouseX - panX) * scaleDiff;
            panY = mouseY - (mouseY - panY) * scaleDiff;
            scale = newScale;
            updateTransform();
        }
    }, { passive: false });

    // Mouse pan
    viewport.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
            isPanning = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
            viewport.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            panX = e.clientX - startX;
            panY = e.clientY - startY;
            updateTransform();
        }
    });

    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            viewport.style.cursor = 'grab';
        }
    });

    // Touch pan support
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lastTouchDistance = 0;

    viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isPanning = true;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            // Pinch zoom start
            lastTouchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isPanning) {
            const dx = e.touches[0].clientX - lastTouchX;
            const dy = e.touches[0].clientY - lastTouchY;
            panX += dx;
            panY += dy;
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
            updateTransform();
        } else if (e.touches.length === 2) {
            // Pinch zoom
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = (distance - lastTouchDistance) * 0.01;
            scale = Math.min(maxScale, Math.max(minScale, scale + delta));
            lastTouchDistance = distance;
            updateTransform();
        }
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
        isPanning = false;
    });

    // Set initial cursor
    viewport.style.cursor = 'grab';

    // Control buttons
    const card = viewport.closest('.diagram-card');
    if (!card) return;

    const controls = card.querySelector('.diagram-controls');
    if (!controls) return;

    controls.addEventListener('click', (e) => {
        const btn = e.target.closest('.diagram-control-btn');
        if (!btn) return;

        const action = btn.dataset.action;

        switch (action) {
            case 'zoom-in':
                scale = Math.min(maxScale, scale + zoomStep);
                updateTransform();
                break;
            case 'zoom-out':
                scale = Math.max(minScale, scale - zoomStep);
                updateTransform();
                break;
            case 'reset':
                scale = 1;
                panX = 0;
                panY = 0;
                updateTransform();
                break;
            case 'fullscreen':
                toggleFullscreen(card);
                break;
        }
    });
}

// Toggle fullscreen mode for diagram
function toggleFullscreen(element) {
    if (!document.fullscreenElement) {
        element.requestFullscreen().catch(err => {
            console.warn('Fullscreen not available:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

function getDiagramTitle(item) {
    switch (item.layer) {
        case 'logical':
            return item.type === 'domain' ? 'Domänenstruktur' : 'Entity-Relationship-Diagramm';
        case 'physical':
            return 'Tabellen- und Spaltenzuordnungen';
        default:
            return 'Strukturdiagramm';
    }
}

function getDiagramSubtitle(item) {
    switch (item.layer) {
        case 'logical':
            return item.type === 'domain'
                ? 'Übersicht der Entitäten in dieser Domäne'
                : 'Beziehungen zwischen Entitäten und Zuordnung zu physischen Tabellen';
        case 'physical':
            return 'Spaltenstruktur und Zuordnung zu logischen Attributen';
        default:
            return '';
    }
}

function generateDiagram(item) {
    switch (item.layer) {
        case 'logical':
            if (item.type === 'domain') {
                // Domain diagrams use custom SVG flowchart
                return { type: 'custom', svg: generateDomainDiagram(item) };
            }
            // Entity diagrams use custom SVG
            return generateEntityDiagram(item);
        case 'physical':
            if (item.type === 'system') {
                // System diagrams use custom SVG
                return generateSystemDiagram(item);
            }
            // Schema diagrams use custom SVG
            return generateSchemaDiagram(item);
        default:
            return { type: 'custom', svg: generateEmptyDiagram() };
    }
}

// Simple empty state diagram
function generateEmptyDiagram() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#9CA3AF' : '#6B7280';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="240" height="60">
        <rect x="20" y="10" width="200" height="40" fill="none" stroke="${textColor}" stroke-width="1.5" stroke-dasharray="6,4" rx="8"/>
        <text x="120" y="35" text-anchor="middle" font-family="'Inter', sans-serif" font-size="13" fill="${textColor}">Kein Diagramm verfügbar</text>
    </svg>`;
}

// Empty state diagram with title and message
function generateEmptyStateDiagram(title, message, layer = 'logical') {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const headerBg = layer === 'physical'
        ? (isDark ? '#F5A524' : '#E09412')
        : (isDark ? '#22C997' : '#0FA87C');
    const headerText = isDark ? '#0F1419' : '#FFFFFF';
    const borderColor = layer === 'physical'
        ? (isDark ? '#FFBA42' : '#F5A524')
        : (isDark ? '#3DDBA8' : '#22C997');
    const textColor = isDark ? '#9CA3AF' : '#6B7280';
    const bgColor = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)';

    const width = Math.max(200, title.length * 10 + 40);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + 40} 100" width="${width + 40}" height="100">
        <rect x="20" y="10" width="${width}" height="80" fill="${bgColor}" stroke="${borderColor}" stroke-width="2" rx="8"/>
        <rect x="20" y="10" width="${width}" height="32" fill="${headerBg}" rx="8"/>
        <rect x="20" y="34" width="${width}" height="8" fill="${headerBg}"/>
        <text x="${20 + width / 2}" y="32" text-anchor="middle" font-family="'Inter', sans-serif" font-size="13" font-weight="600" fill="${headerText}">${escapeHtml(title)}</text>
        <text x="${20 + width / 2}" y="65" text-anchor="middle" font-family="'Inter', sans-serif" font-size="12" fill="${textColor}">${escapeHtml(message)}</text>
    </svg>`;
}

// Custom SVG flowchart for domain diagrams
function generateDomainDiagram(domain) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const entities = getEntitiesForDomain(domain.id);

    // Colors
    const domainBorderColor = isDark ? '#3DDBA8' : '#22C997';
    const domainBgColor = isDark ? 'rgba(34, 201, 151, 0.08)' : 'rgba(15, 168, 124, 0.05)';
    const domainHeaderBg = isDark ? '#22C997' : '#0FA87C';
    const domainHeaderText = isDark ? '#0F1419' : '#FFFFFF';
    const entityBg = isDark ? '#1F2328' : '#FFFFFF';
    const entityBorder = isDark ? '#4B5563' : '#B8C0CC';
    const entityText = isDark ? '#E5E7EB' : '#1A1F26';
    const connectionColor = isDark ? '#6B7280' : '#9CA3AF';

    // Layout constants
    const padding = 20;
    const headerHeight = 36;
    const entityHeight = 36;
    const entityMinWidth = 140;
    const entityPadding = 16;
    const entityGapX = 24;
    const entityGapY = 16;
    const maxPerRow = 3;

    // Calculate entity dimensions
    const entityDims = entities.map(e => {
        const name = getText(e.name);
        const width = Math.max(entityMinWidth, name.length * 8 + entityPadding * 2);
        return { entity: e, name, width, height: entityHeight };
    });

    // Layout entities in rows
    const rows = [];
    let currentRow = [];
    let currentRowWidth = 0;

    entityDims.forEach(dim => {
        if (currentRow.length >= maxPerRow) {
            rows.push(currentRow);
            currentRow = [dim];
            currentRowWidth = dim.width;
        } else {
            currentRow.push(dim);
            currentRowWidth += dim.width + (currentRow.length > 1 ? entityGapX : 0);
        }
    });
    if (currentRow.length > 0) rows.push(currentRow);

    // Calculate total dimensions
    const maxRowWidth = Math.max(...rows.map(row =>
        row.reduce((sum, d) => sum + d.width, 0) + (row.length - 1) * entityGapX
    ), 200);
    const totalEntityHeight = rows.length * entityHeight + (rows.length - 1) * entityGapY;

    const containerWidth = maxRowWidth + padding * 2;
    const containerHeight = headerHeight + totalEntityHeight + padding * 2;
    const svgWidth = containerWidth + 40;
    const svgHeight = containerHeight + 40;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">`;
    svg += '<defs>';
    svg += `<marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><circle cx="3" cy="3" r="2" fill="${connectionColor}"/></marker>`;
    svg += '</defs>';

    const containerX = 20;
    const containerY = 20;

    // Domain container
    svg += `<rect x="${containerX}" y="${containerY}" width="${containerWidth}" height="${containerHeight}" fill="${domainBgColor}" stroke="${domainBorderColor}" stroke-width="2" rx="8"/>`;

    // Domain header
    svg += `<rect x="${containerX}" y="${containerY}" width="${containerWidth}" height="${headerHeight}" fill="${domainHeaderBg}" rx="8"/>`;
    svg += `<rect x="${containerX}" y="${containerY + headerHeight - 8}" width="${containerWidth}" height="8" fill="${domainHeaderBg}"/>`;
    svg += `<text x="${containerX + containerWidth / 2}" y="${containerY + headerHeight / 2 + 5}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="14" font-weight="600" fill="${domainHeaderText}">${escapeHtml(getText(domain.name))}</text>`;

    if (entities.length === 0) {
        // Empty state
        svg += `<text x="${containerX + containerWidth / 2}" y="${containerY + headerHeight + padding + 18}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="13" fill="${entityText}" opacity="0.6">Keine Entitäten</text>`;
    } else {
        // Calculate entity positions
        const entityPositions = [];
        let yOffset = containerY + headerHeight + padding;

        rows.forEach(row => {
            const rowWidth = row.reduce((sum, d) => sum + d.width, 0) + (row.length - 1) * entityGapX;
            let xOffset = containerX + (containerWidth - rowWidth) / 2;

            row.forEach(dim => {
                entityPositions.push({
                    ...dim,
                    x: xOffset,
                    y: yOffset,
                    cx: xOffset + dim.width / 2,
                    cy: yOffset + dim.height / 2
                });
                xOffset += dim.width + entityGapX;
            });
            yOffset += entityHeight + entityGapY;
        });

        // Find and draw connections from relationships.json
        const connections = [];
        const entityIds = entities.map(e => e.id);

        // Look up relationships from data.relationships (only logical type)
        (data.relationships || []).filter(rel => rel.type === 'logical').forEach(rel => {
            const sourceIdx = entityIds.indexOf(rel.source);
            const targetIdx = entityIds.indexOf(rel.target);
            // Only draw if both entities are in this domain's diagram
            if (sourceIdx !== -1 && targetIdx !== -1) {
                connections.push([sourceIdx, targetIdx]);
            }
        });

        // Draw connections
        connections.forEach(([fromIdx, toIdx]) => {
            const from = entityPositions[fromIdx];
            const to = entityPositions[toIdx];
            svg += `<line x1="${from.cx}" y1="${from.cy}" x2="${to.cx}" y2="${to.cy}" stroke="${connectionColor}" stroke-width="2" marker-start="url(#arrow)" marker-end="url(#arrow)"/>`;
        });

        // Draw entity boxes
        entityPositions.forEach(pos => {
            svg += `<rect x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" fill="${entityBg}" stroke="${entityBorder}" stroke-width="1.5" rx="6"/>`;
            svg += `<text x="${pos.x + pos.width / 2}" y="${pos.y + pos.height / 2 + 5}" text-anchor="middle" font-family="'JetBrains Mono', 'Consolas', monospace" font-size="13" font-weight="500" fill="${entityText}">${escapeHtml(pos.name)}</text>`;
        });
    }

    svg += '</svg>';
    return svg;
}

// Custom SVG table renderer with full Unicode support and proper styling
function renderCustomSqlTable(name, rows, headerColor, x = 0, y = 0) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Styling - optimized for readability
    const rowHeight = 26;
    const headerHeight = 30;
    const padding = 10;
    const fontSize = 12;
    const minColWidth = 90;

    // Calculate column widths based on content
    let nameColWidth = minColWidth;
    let typeColWidth = 70;
    let keyColWidth = 36;

    rows.forEach(row => {
        const nameWidth = row.name.length * 7.5 + padding * 2;
        const typeWidth = row.type.length * 7 + padding * 2;
        if (nameWidth > nameColWidth) nameColWidth = nameWidth;
        if (typeWidth > typeColWidth) typeColWidth = typeWidth;
    });

    const tableWidth = nameColWidth + typeColWidth + keyColWidth;
    const tableHeight = headerHeight + rows.length * rowHeight;

    // Colors - high contrast for readability
    const borderColor = isDark ? '#4B5563' : '#B8C0CC';
    const lineColor = isDark ? '#374151' : '#D4D9E1';
    const headerTextColor = isDark ? '#111827' : '#FFFFFF';
    const rowEvenBg = isDark ? '#1F2328' : '#FFFFFF';
    const rowOddBg = isDark ? '#262B32' : '#F3F4F6';
    const textColor = isDark ? '#F3F4F6' : '#111827';           // High contrast text
    const typeColor = isDark ? '#D1D5DB' : '#374151';           // Darker type text
    const keyColor = isDark ? '#9CA3AF' : '#4B5563';            // Darker key text

    let svg = `<g transform="translate(${x}, ${y})">`;

    // Table background with rounded corners
    svg += `<rect x="0" y="0" width="${tableWidth}" height="${tableHeight}" fill="${rowEvenBg}" stroke="${borderColor}" stroke-width="1" rx="4"/>`;

    // Header background
    svg += `<rect x="0.5" y="0.5" width="${tableWidth - 1}" height="${headerHeight}" fill="${headerColor}" rx="4"/>`;
    svg += `<rect x="0.5" y="${headerHeight - 4}" width="${tableWidth - 1}" height="4" fill="${headerColor}"/>`;

    // Header text - bold and readable
    svg += `<text x="${tableWidth / 2}" y="${headerHeight / 2 + 4}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="${fontSize + 1}" font-weight="600" fill="${headerTextColor}">${escapeHtml(name)}</text>`;

    // Header bottom line
    svg += `<line x1="0" y1="${headerHeight}" x2="${tableWidth}" y2="${headerHeight}" stroke="${borderColor}" stroke-width="1"/>`;

    // Rows
    rows.forEach((row, idx) => {
        const rowY = headerHeight + idx * rowHeight;
        const bgColor = idx % 2 === 0 ? rowEvenBg : rowOddBg;
        const isLast = idx === rows.length - 1;

        // Row background
        if (isLast) {
            // Last row needs rounded bottom corners
            svg += `<path d="M0,${rowY} h${tableWidth} v${rowHeight - 4} q0,4 -4,4 h-${tableWidth - 8} q-4,0 -4,-4 z" fill="${bgColor}"/>`;
        } else {
            svg += `<rect x="0" y="${rowY}" width="${tableWidth}" height="${rowHeight}" fill="${bgColor}"/>`;
        }

        // Row separator line (except for last row)
        if (!isLast) {
            svg += `<line x1="0" y1="${rowY + rowHeight}" x2="${tableWidth}" y2="${rowY + rowHeight}" stroke="${lineColor}" stroke-width="1"/>`;
        }

        // Name column text - primary, bold for emphasis
        svg += `<text x="${padding}" y="${rowY + rowHeight / 2 + 4}" font-family="'JetBrains Mono', 'Consolas', monospace" font-size="${fontSize}" font-weight="500" fill="${textColor}">${escapeHtml(row.name)}</text>`;

        // Type column text - secondary
        svg += `<text x="${nameColWidth + padding}" y="${rowY + rowHeight / 2 + 4}" font-family="'JetBrains Mono', 'Consolas', monospace" font-size="${fontSize}" fill="${typeColor}">${escapeHtml(row.type)}</text>`;

        // Key column text - tertiary
        if (row.key) {
            svg += `<text x="${nameColWidth + typeColWidth + padding}" y="${rowY + rowHeight / 2 + 4}" font-family="'JetBrains Mono', 'Consolas', monospace" font-size="${fontSize}" font-weight="500" fill="${keyColor}">${escapeHtml(row.key)}</text>`;
        }
    });

    // Full-height column separator lines (from header bottom to table bottom)
    svg += `<line x1="${nameColWidth}" y1="${headerHeight}" x2="${nameColWidth}" y2="${tableHeight}" stroke="${lineColor}" stroke-width="1"/>`;
    svg += `<line x1="${nameColWidth + typeColWidth}" y1="${headerHeight}" x2="${nameColWidth + typeColWidth}" y2="${tableHeight}" stroke="${lineColor}" stroke-width="1"/>`;

    // Outer border (re-apply for crisp edges)
    svg += `<rect x="0" y="0" width="${tableWidth}" height="${tableHeight}" fill="none" stroke="${borderColor}" stroke-width="1" rx="4"/>`;

    svg += `</g>`;

    return { svg, width: tableWidth, height: tableHeight };
}

function generateEntityDiagram(entity) {
    // Custom SVG for entity diagram with system grouping
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const logicalColor = isDark ? '#22C997' : '#0FA87C';
    const physicalColor = isDark ? '#F5A524' : '#E09412';
    const lineColor = isDark ? '#6B7280' : '#9CA3AF';
    const labelColor = isDark ? '#9CA3AF' : '#6B7280';
    const boxBgColor = isDark ? 'rgba(245, 165, 36, 0.08)' : 'rgba(224, 148, 18, 0.06)';
    const boxBorderColor = isDark ? 'rgba(245, 165, 36, 0.3)' : 'rgba(224, 148, 18, 0.25)';
    const systemLabelColor = isDark ? '#F5A524' : '#B8780E';

    // Build logical entity table data
    const entityName = getText(entity.name);
    const entityRows = (entity.attributes || []).map(attr => ({
        name: getText(attr.name),
        type: attr.type,
        key: attr.key || ''
    }));

    // Build physical schema tables data grouped by system
    const physicalTablesBySystem = {};
    if (entity.physicalSchemas && entity.physicalSchemas.length > 0) {
        entity.physicalSchemas.forEach(schemaId => {
            const schema = data.schemas.find(s => s.id === schemaId);
            if (schema) {
                const system = data.systems.find(s => s.id === schema.system);
                const systemId = system ? system.id : 'unknown';
                const systemLabel = system ? getText(system.name) : 'Unknown System';

                if (!physicalTablesBySystem[systemId]) {
                    physicalTablesBySystem[systemId] = {
                        systemLabel,
                        tables: []
                    };
                }
                physicalTablesBySystem[systemId].tables.push({
                    name: schema.name,
                    rows: (schema.columns || []).map(col => ({
                        name: col.name,
                        type: col.type.split('(')[0],
                        key: col.key || ''
                    }))
                });
            }
        });
    }

    // Render logical entity
    const logicalTable = renderCustomSqlTable(entityName, entityRows, logicalColor, 0, 0);

    // Layout constants
    const gap = 80; // Gap between logical and physical layer
    const systemPadding = 15; // Padding inside system bounding box
    const systemLabelHeight = 24; // Height reserved for system label
    const tableGap = 20; // Gap between tables within a system
    const systemGap = 40; // Gap between system boxes
    const physicalStartY = logicalTable.height + gap;

    // Render physical tables grouped by system
    let physicalSvg = '';
    let boundingBoxesSvg = '';
    let totalPhysicalWidth = 0;
    let maxPhysicalHeight = 0;
    const systemMeta = []; // Track system boxes for connection lines

    Object.keys(physicalTablesBySystem).forEach((systemId, systemIdx) => {
        const systemData = physicalTablesBySystem[systemId];
        const systemStartX = totalPhysicalWidth;
        let systemTablesWidth = 0;
        let systemMaxHeight = 0;
        const tableMeta = [];

        // Render each table in this system
        systemData.tables.forEach((table, tableIdx) => {
            const tableX = systemStartX + systemPadding + systemTablesWidth;
            const tableY = physicalStartY + systemLabelHeight + systemPadding;
            const rendered = renderCustomSqlTable(table.name, table.rows, physicalColor, tableX, tableY);
            physicalSvg += rendered.svg;

            tableMeta.push({
                x: tableX,
                y: tableY,
                width: rendered.width,
                height: rendered.height
            });

            systemTablesWidth += rendered.width + (tableIdx < systemData.tables.length - 1 ? tableGap : 0);
            if (rendered.height > systemMaxHeight) systemMaxHeight = rendered.height;
        });

        // Calculate bounding box dimensions
        const boxX = systemStartX;
        const boxY = physicalStartY;
        const boxWidth = systemTablesWidth + systemPadding * 2;
        const boxHeight = systemLabelHeight + systemPadding * 2 + systemMaxHeight;

        // Draw system bounding box
        boundingBoxesSvg += `<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}"
            fill="${boxBgColor}" stroke="${boxBorderColor}" stroke-width="1.5" rx="8" ry="8"/>`;

        // Draw system label (top-left inside the box)
        boundingBoxesSvg += `<text x="${boxX + systemPadding}" y="${boxY + 16}"
            font-family="'Inter', sans-serif" font-size="11" font-weight="600"
            fill="${systemLabelColor}">${escapeHtml(systemData.systemLabel)}</text>`;

        // Store system meta for connection lines
        systemMeta.push({
            systemLabel: systemData.systemLabel,
            boxX,
            boxY,
            boxWidth,
            boxHeight,
            tables: tableMeta
        });

        totalPhysicalWidth += boxWidth + systemGap;
        if (boxHeight > maxPhysicalHeight) maxPhysicalHeight = boxHeight;
    });

    // Remove trailing gap
    if (totalPhysicalWidth > 0) totalPhysicalWidth -= systemGap;

    // Center the logical table above physical tables
    const logicalX = totalPhysicalWidth > 0 ? Math.max(0, (totalPhysicalWidth - logicalTable.width) / 2) : 0;

    // Calculate SVG dimensions
    const svgWidth = Math.max(logicalTable.width, totalPhysicalWidth) + 40;
    const svgHeight = totalPhysicalWidth > 0 ? physicalStartY + maxPhysicalHeight + 30 : logicalTable.height + 20;

    // Build connection lines with ER notation and relationship labels
    let connectionsSvg = '';
    systemMeta.forEach((system, systemIdx) => {
        system.tables.forEach((table, tableIdx) => {
            const startX = logicalX + logicalTable.width / 2;
            const startY = logicalTable.height;
            const endX = table.x + table.width / 2;
            const endY = table.y;

            // Straight connection line
            connectionsSvg += `<line x1="${startX}" y1="${startY}" x2="${startX}" y2="${startY + 20}" stroke="${lineColor}" stroke-width="1.5"/>`;
            connectionsSvg += `<line x1="${startX}" y1="${startY + 20}" x2="${endX}" y2="${endY - 20}" stroke="${lineColor}" stroke-width="1.5"/>`;
            connectionsSvg += `<line x1="${endX}" y1="${endY - 20}" x2="${endX}" y2="${endY}" stroke="${lineColor}" stroke-width="1.5"/>`;

            // ER notation: "One" at top (perpendicular line)
            connectionsSvg += `<line x1="${startX - 8}" y1="${startY + 10}" x2="${startX + 8}" y2="${startY + 10}" stroke="${lineColor}" stroke-width="1.5"/>`;

            // ER notation: "Many" at bottom (crow's foot)
            const crowFootY = endY - 12;
            connectionsSvg += `<line x1="${endX}" y1="${endY - 20}" x2="${endX - 8}" y2="${crowFootY}" stroke="${lineColor}" stroke-width="1.5"/>`;
            connectionsSvg += `<line x1="${endX}" y1="${endY - 20}" x2="${endX + 8}" y2="${crowFootY}" stroke="${lineColor}" stroke-width="1.5"/>`;
            connectionsSvg += `<line x1="${endX}" y1="${endY - 20}" x2="${endX}" y2="${crowFootY}" stroke="${lineColor}" stroke-width="1.5"/>`;

            // Relationship label on the line
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const labelText = 'implements';

            // Background for label readability
            const labelWidth = labelText.length * 8 + 16;
            const labelHeight = 22;
            const bgColor = isDark ? '#0F1419' : '#FFFFFF';
            connectionsSvg += `<rect x="${midX - labelWidth/2}" y="${midY - labelHeight/2}" width="${labelWidth}" height="${labelHeight}"
                fill="${bgColor}" stroke="${isDark ? '#374151' : '#E5E7EB'}" stroke-width="1" rx="4"/>`;
            connectionsSvg += `<text x="${midX}" y="${midY + 5}"
                font-family="'Inter', sans-serif" font-size="13" font-weight="500"
                fill="${isDark ? '#D1D5DB' : '#374151'}" text-anchor="middle">${labelText}</text>`;
        });
    });

    // Reassemble logical table with correct position
    const logicalTableRepositioned = renderCustomSqlTable(entityName, entityRows, logicalColor, logicalX, 0);

    // Build final SVG - order matters: boxes first, then lines, then tables
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
        ${logicalTableRepositioned.svg}
        ${boundingBoxesSvg}
        ${connectionsSvg}
        ${physicalSvg}
    </svg>`;

    return { type: 'custom', svg };
}

function generateSystemDiagram(system) {
    // Get all schemas for this system
    let schemas = data.schemas.filter(s => s.system === system.id);

    if (schemas.length === 0) {
        // Custom SVG for empty state
        return { type: 'custom', svg: generateEmptyStateDiagram(getText(system.name), 'Keine Schemas', 'physical') };
    }

    // Order schemas by connection count (hub-based layout)
    // Most connected schema goes in the center for cleaner edge routing
    const schemaIds = new Set(schemas.map(s => s.id));
    const relationships = (data.relationships || []).filter(rel =>
        rel.type === 'physical' && schemaIds.has(rel.source) && schemaIds.has(rel.target)
    );

    // Count connections per schema
    const connectionCount = {};
    schemas.forEach(s => connectionCount[s.id] = 0);
    relationships.forEach(rel => {
        connectionCount[rel.source] = (connectionCount[rel.source] || 0) + 1;
        connectionCount[rel.target] = (connectionCount[rel.target] || 0) + 1;
    });

    // Sort by connection count (descending)
    const sortedSchemas = [...schemas].sort((a, b) =>
        connectionCount[b.id] - connectionCount[a.id]
    );

    // Place most connected in center, others alternating left/right
    const orderedSchemas = [];
    const centerIdx = Math.floor(schemas.length / 2);
    let left = centerIdx - 1;
    let right = centerIdx + 1;

    sortedSchemas.forEach((schema, i) => {
        if (i === 0) {
            orderedSchemas[centerIdx] = schema; // Hub in center
        } else if (i % 2 === 1 && left >= 0) {
            orderedSchemas[left--] = schema;
        } else if (right < schemas.length) {
            orderedSchemas[right++] = schema;
        } else if (left >= 0) {
            orderedSchemas[left--] = schema;
        }
    });

    // Fill any gaps and use ordered schemas
    schemas = orderedSchemas.filter(s => s);

    // Custom SVG for system diagram
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const physicalColor = isDark ? '#F5A524' : '#E09412';

    // Render all schemas as tables
    const tableMeta = [];
    let totalWidth = 0;
    let maxHeight = 0;
    const gap = 40;

    schemas.forEach((schema, idx) => {
        const rows = (schema.columns || []).map(col => ({
            name: col.name,
            type: col.type.split('(')[0],
            key: col.key || ''
        }));

        const rendered = renderCustomSqlTable(schema.name, rows, physicalColor, totalWidth, 0);
        tableMeta.push({
            svg: rendered.svg,
            x: totalWidth,
            width: rendered.width,
            height: rendered.height,
            name: schema.name
        });
        totalWidth += rendered.width + gap;
        if (rendered.height > maxHeight) maxHeight = rendered.height;
    });

    const svgWidth = totalWidth - gap + 40;
    const svgHeight = maxHeight + 60; // Extra space for relationship lines

    // Find relationships between schemas using data.relationships
    const connectionColor = isDark ? '#6B7280' : '#9CA3AF';
    let connectionsSvg = '';

    // Build a map of schema IDs to their index in tableMeta
    const schemaIdToIdx = {};
    schemas.forEach((schema, idx) => {
        schemaIdToIdx[schema.id] = idx;
    });

    // Track connections per schema edge for offset calculation
    const edgeConnections = {}; // key: "schemaIdx-side" -> count
    const getEdgeKey = (idx, side) => `${idx}-${side}`;
    const getEdgeOffset = (idx, side) => {
        const key = getEdgeKey(idx, side);
        edgeConnections[key] = (edgeConnections[key] || 0) + 1;
        return (edgeConnections[key] - 1) * 20; // 20px offset per connection
    };

    // Draw relationships with smart anchor positioning (reuse relationships from ordering)
    relationships.forEach(rel => {
        const sourceIdx = schemaIdToIdx[rel.source];
        const targetIdx = schemaIdToIdx[rel.target];

        if (sourceIdx !== undefined && targetIdx !== undefined && sourceIdx !== targetIdx) {
            const sourceMeta = tableMeta[sourceIdx];
            const targetMeta = tableMeta[targetIdx];

            // Determine which schema is left/right
            const sourceIsLeft = sourceMeta.x < targetMeta.x;

            // Calculate connection points on left/right edges
            let sourceX, targetX, sourceSide, targetSide;
            if (sourceIsLeft) {
                sourceSide = 'right';
                targetSide = 'left';
                sourceX = sourceMeta.x + sourceMeta.width;
                targetX = targetMeta.x;
            } else {
                sourceSide = 'left';
                targetSide = 'right';
                sourceX = sourceMeta.x;
                targetX = targetMeta.x + targetMeta.width;
            }

            // Get vertical offsets for multiple connections to same edge
            const sourceOffset = getEdgeOffset(sourceIdx, sourceSide);
            const targetOffset = getEdgeOffset(targetIdx, targetSide);

            // Y position: start from 40% down the table, offset for multiple connections
            const sourceY = sourceMeta.height * 0.4 + sourceOffset;
            const targetY = targetMeta.height * 0.4 + targetOffset;

            // Calculate control points for smooth bezier curve
            const controlOffset = Math.abs(targetX - sourceX) * 0.4;
            const cp1x = sourceIsLeft ? sourceX + controlOffset : sourceX - controlOffset;
            const cp2x = sourceIsLeft ? targetX - controlOffset : targetX + controlOffset;

            // Draw smooth bezier curve
            connectionsSvg += `<path d="M ${sourceX} ${sourceY} C ${cp1x} ${sourceY}, ${cp2x} ${targetY}, ${targetX} ${targetY}" fill="none" stroke="${connectionColor}" stroke-width="1.5"/>`;
            connectionsSvg += `<circle cx="${sourceX}" cy="${sourceY}" r="3" fill="${connectionColor}"/>`;
            connectionsSvg += `<circle cx="${targetX}" cy="${targetY}" r="3" fill="${connectionColor}"/>`;

            // Draw FK name label at curve midpoint
            const labelX = (sourceX + targetX) / 2;
            const labelY = (sourceY + targetY) / 2 - 8;
            const labelBg = isDark ? '#1F2937' : '#FFFFFF';
            const labelText = isDark ? '#9CA3AF' : '#6B7280';
            const labelWidth = rel.name.length * 6 + 8;
            connectionsSvg += `<rect x="${labelX - labelWidth/2}" y="${labelY - 8}" width="${labelWidth}" height="14" fill="${labelBg}" rx="2"/>`;
            connectionsSvg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="9" fill="${labelText}">${rel.name}</text>`;
        }
    });

    // Combine all table SVGs
    let tablesSvg = '';
    tableMeta.forEach(meta => {
        tablesSvg += meta.svg;
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
        ${connectionsSvg}
        ${tablesSvg}
    </svg>`;

    return { type: 'custom', svg };
}

function generateSchemaDiagram(schema) {
    // Custom SVG for schema diagram
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const physicalColor = isDark ? '#F5A524' : '#E09412';

    const rows = (schema.columns || []).map(col => ({
        name: col.name,
        type: col.type.split('(')[0],
        key: col.key || ''
    }));

    const rendered = renderCustomSqlTable(schema.name, rows, physicalColor, 0, 0);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rendered.width + 20} ${rendered.height + 20}" width="${rendered.width + 20}" height="${rendered.height + 20}">
        ${rendered.svg}
    </svg>`;

    return { type: 'custom', svg };
}

function renderDiagramLegend(item) {
    const legends = {
        logical: [
            { color: 'var(--color-logical)', label: 'Domäne' },
            { color: 'var(--color-logical)', label: 'Entität', border: true },
            { color: 'var(--color-physical)', label: 'Physische Tabelle' },
            { symbol: 'PK', label: 'Primärschlüssel' },
            { symbol: 'FK', label: 'Fremdschlüssel' }
        ],
        physical: [
            { color: 'var(--color-physical)', label: 'Schema' },
            { color: 'var(--color-logical)', label: 'Logische Entität' },
            { symbol: 'PK', label: 'Primärschlüssel' },
            { symbol: 'FK', label: 'Fremdschlüssel' }
        ]
    };

    const items = legends[item.layer] || legends.logical;

    return `
        <div class="legend-items">
            ${items.map(l => l.color
                ? `<div class="legend-item">
                    <span class="legend-color" style="background: ${l.color}"></span>
                    <span class="legend-label">${l.label}</span>
                   </div>`
                : `<div class="legend-item">
                    <span class="legend-symbol">${l.symbol}</span>
                    <span class="legend-label">${l.label}</span>
                   </div>`
            ).join('')}
        </div>
    `;
}

function renderSearchResults() {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (!state.searchResults.length) {
        container.classList.remove('active');
        return;
    }

    container.innerHTML = `
        <div class="search-results-header">${state.searchResults.length} Ergebnisse</div>
        ${state.searchResults.map(item => `
            <div class="search-result-item ${escapeHtml(item.layer)}" data-id="${escapeHtml(item.id)}" role="option" tabindex="0">
                <span class="tree-icon ${escapeHtml(item.layer)}">${getTypeIcon(item.type)}</span>
                <div class="search-result-info">
                    <div class="search-result-name">${escapeHtml(getText(item.name))}</div>
                    <div class="search-result-meta">${getTypeLabel(item.type)} · ${getLayerLabel(item.layer)}</div>
                </div>
            </div>
        `).join('')}
    `;

    container.classList.add('active');
    // Event delegation handles search result item listeners
}

// ========================================
// Event Handlers
// ========================================
function selectItem(id) {
    const item = findItemById(id);
    if (item) {
        state.selectedItem = item;
        state.selectedAttribute = null; // Clear any selected attribute
        // Preserve current view (tab) when navigating between items
        if (item.layer !== state.currentLayer) {
            state.currentLayer = item.layer;
        }
        expandParents(item);
        // Auto-expand item if it has children
        if (itemHasChildren(item)) {
            state.expandedNodes.add(item.id);
        }
        navigateTo(`/${item.layer}/${item.type}/${item.id}`);
    }
}

function itemHasChildren(item) {
    if (item.type === 'domain') {
        return data.entities.some(e => e.domain === item.id);
    }
    if (item.type === 'system') {
        return data.schemas.some(s => s.system === item.id);
    }
    if (item.type === 'entity') {
        return item.attributes && item.attributes.length > 0;
    }
    if (item.type === 'schema') {
        return item.columns && item.columns.length > 0;
    }
    return false;
}

function showAttributeDetail(attr, parentItem) {
    state.selectedAttribute = { attr, parentItem };
    state.selectedItem = null; // Clear item selection
    const container = document.getElementById('contentBody');
    container.innerHTML = renderAttributeDetailView(attr, parentItem);
    renderAttributeBreadcrumb(attr, parentItem);
    // Event delegation handles attribute detail listeners
    renderTree(); // Re-render tree to show selected attribute
}

function renderAttributeBreadcrumb(attr, parentItem) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    let html = '';
    html += `<span class="breadcrumb-home" data-action="home" tabindex="0">${icons.home} Alle Kataloge</span>`;
    html += `<span class="breadcrumb-separator" aria-hidden="true">/</span>`;

    // Add catalog name if available
    if (state.currentCatalog) {
        html += `<span class="breadcrumb-item" data-id="${escapeHtml(state.currentCatalog.id)}" tabindex="0">${escapeHtml(getText(state.currentCatalog.name))}</span>`;
        html += `<span class="breadcrumb-separator" aria-hidden="true">/</span>`;
    }

    // Add layer
    if (parentItem.layer) {
        html += `<span class="breadcrumb-item layer-${escapeHtml(parentItem.layer)}" data-layer="${escapeHtml(parentItem.layer)}" tabindex="0">${escapeHtml(getLayerLabel(parentItem.layer))}</span>`;
        html += `<span class="breadcrumb-separator" aria-hidden="true">/</span>`;
    }

    // Add parent item
    html += `<span class="breadcrumb-item" data-id="${escapeHtml(parentItem.id)}" tabindex="0">${escapeHtml(getText(parentItem.name))}</span>`;
    html += `<span class="breadcrumb-separator" aria-hidden="true">/</span>`;

    // Add attribute name as current
    html += `<span class="breadcrumb-current" aria-current="page">${escapeHtml(getText(attr.name))}</span>`;

    breadcrumb.innerHTML = html;
    // Event delegation handles breadcrumb listeners
}

function toggleNode(id) {
    if (state.expandedNodes.has(id)) {
        state.expandedNodes.delete(id);
    } else {
        state.expandedNodes.add(id);
    }
    renderTree();
}

// ========================================
// Keyboard Shortcuts
// ========================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // "/" to focus search
        if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
            const searchInput = document.getElementById('searchInput');
            if (document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput?.focus();
            }
        }

        // "[" to collapse sidebar
        if (e.key === '[' && !e.ctrlKey && !e.metaKey) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !state.sidebarCollapsed) {
                state.sidebarCollapsed = true;
                sidebar.classList.add('collapsed');
            }
        }

        // "]" to expand sidebar
        if (e.key === ']' && !e.ctrlKey && !e.metaKey) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && state.sidebarCollapsed) {
                state.sidebarCollapsed = false;
                sidebar.classList.remove('collapsed');
            }
        }

        // Escape to close search
        if (e.key === 'Escape') {
            const searchResults = document.getElementById('searchResults');
            if (searchResults?.classList.contains('active')) {
                searchResults.classList.remove('active');
                document.getElementById('searchInput').blur();
            }
        }
    });
}

// ========================================
// Event Delegation Setup
// ========================================
function setupDelegatedEvents() {
    const app = document.getElementById('app');
    if (!app) return;

    // Delegated click handler for the entire app
    app.addEventListener('click', (e) => {
        try {
            const target = e.target;

            // Tree node clicks
            const treeNode = target.closest('.tree-node');
            if (treeNode) {
                handleTreeNodeClick(e, treeNode);
                return;
            }

        // Layer section header clicks (toggle)
        const layerHeader = target.closest('.layer-section-header');
        if (layerHeader) {
            const layer = layerHeader.dataset.layer;
            if (state.expandedLayers.has(layer)) {
                state.expandedLayers.delete(layer);
            } else {
                state.expandedLayers.add(layer);
            }
            renderTree();
            return;
        }

        // Breadcrumb home click
        const breadcrumbHome = target.closest('.breadcrumb-home');
        if (breadcrumbHome) {
            goToCatalogsOverview();
            return;
        }

        // Breadcrumb item click
        const breadcrumbItem = target.closest('.breadcrumb-item');
        if (breadcrumbItem) {
            if (breadcrumbItem.dataset.id) {
                selectItem(breadcrumbItem.dataset.id);
            } else if (breadcrumbItem.dataset.layer) {
                state.currentLayer = breadcrumbItem.dataset.layer;
                renderAll();
            }
            return;
        }

        // Catalog card clicks
        const catalogCard = target.closest('.catalog-card');
        if (catalogCard) {
            selectCatalog(catalogCard.dataset.id);
            return;
        }

        // Card header clicks (toggle)
        const cardHeader = target.closest('.card-header');
        if (cardHeader) {
            const card = cardHeader.closest('.card');
            if (card) {
                card.classList.toggle('collapsed');
                cardHeader.setAttribute('aria-expanded', !card.classList.contains('collapsed'));
            }
            return;
        }

        // Mapping card clicks
        const mappingCard = target.closest('.mapping-card');
        if (mappingCard) {
            selectItem(mappingCard.dataset.id);
            return;
        }

        // Clickable table row clicks
        const clickableRow = target.closest('.clickable-row');
        if (clickableRow) {
            handleClickableRowClick(clickableRow);
            return;
        }

        // View tab clicks
        const viewTab = target.closest('.view-tab');
        if (viewTab) {
            if (viewTab.dataset.view) {
                state.currentView = viewTab.dataset.view;
                updateUrlWithTab(state.currentView);
                renderContent();
            } else if (viewTab.dataset.catalogView) {
                state.catalogView = viewTab.dataset.catalogView;
                renderContent();
            }
            return;
        }

        // Search result item clicks
        const searchResultItem = target.closest('.search-result-item');
        if (searchResultItem) {
            selectItem(searchResultItem.dataset.id);
            document.getElementById('searchInput').value = '';
            state.searchResults = [];
            document.getElementById('searchResults')?.classList.remove('active');
            return;
        }

        // Attribute parent link clicks
        const attrParentLink = target.closest('.attr-parent-link');
        if (attrParentLink) {
            e.preventDefault();
            selectItem(attrParentLink.dataset.id);
            return;
        }

        // Layer tab clicks
            const layerTab = target.closest('.layer-tab');
            if (layerTab) {
                state.currentLayer = layerTab.dataset.layer;
                state.selectedItem = null;
                state.currentView = 'wiki';
                navigateTo(`/${state.currentLayer}`);
                return;
            }
        } catch (error) {
            console.error('Error handling click event:', error);
        }
    });

    // Delegated keydown handler for the entire app
    app.addEventListener('keydown', (e) => {
        try {
            const target = e.target;

            // Tree node keydown
            const treeNode = target.closest('.tree-node');
            if (treeNode && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                handleTreeNodeKeydown(e, treeNode);
                return;
            }

        // Breadcrumb home keydown
        const breadcrumbHome = target.closest('.breadcrumb-home');
        if (breadcrumbHome && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            goToCatalogsOverview();
            return;
        }

        // Breadcrumb item keydown
        const breadcrumbItem = target.closest('.breadcrumb-item');
        if (breadcrumbItem && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            if (breadcrumbItem.dataset.id) {
                selectItem(breadcrumbItem.dataset.id);
            }
            return;
        }

        // Mapping card keydown
            const mappingCard = target.closest('.mapping-card');
            if (mappingCard && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                selectItem(mappingCard.dataset.id);
                return;
            }
        } catch (error) {
            console.error('Error handling keydown event:', error);
        }
    });
}

// Helper function for tree node click handling
function handleTreeNodeClick(e, node) {
    const id = node.dataset.id;

    // Handle attribute clicks
    if (node.classList.contains('attribute-node')) {
        const entityId = node.dataset.entity;
        const attrName = node.dataset.attrName;
        if (entityId && attrName) {
            const parentItem = findItemById(entityId);
            if (parentItem) {
                const attrs = parentItem.attributes || [];
                const attr = attrs.find(a => getText(a.name) === attrName);
                if (attr) {
                    showAttributeDetail(attr, parentItem);
                }
            }
        }
        return;
    }

    // Handle column clicks
    if (node.classList.contains('column-node')) {
        const schemaId = node.dataset.schema;
        const colName = node.dataset.colName;
        if (schemaId && colName) {
            const parentItem = findItemById(schemaId);
            if (parentItem) {
                const cols = parentItem.columns || [];
                const col = cols.find(c => c.name === colName);
                if (col) {
                    showAttributeDetail(col, parentItem);
                }
            }
        }
        return;
    }

    // Toggle or select
    if (e.target.closest('.tree-toggle')) {
        toggleNode(id);
    } else {
        selectItem(id);
    }
}

// Helper function for tree node keydown handling
function handleTreeNodeKeydown(e, node) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();

        // Handle attribute keydown
        if (node.classList.contains('attribute-node')) {
            const entityId = node.dataset.entity;
            const attrName = node.dataset.attrName;
            if (entityId && attrName) {
                const parentItem = findItemById(entityId);
                if (parentItem) {
                    const attrs = parentItem.attributes || [];
                    const attr = attrs.find(a => getText(a.name) === attrName);
                    if (attr) {
                        showAttributeDetail(attr, parentItem);
                    }
                }
            }
            return;
        }

        // Handle column keydown
        if (node.classList.contains('column-node')) {
            const schemaId = node.dataset.schema;
            const colName = node.dataset.colName;
            if (schemaId && colName) {
                const parentItem = findItemById(schemaId);
                if (parentItem) {
                    const cols = parentItem.columns || [];
                    const col = cols.find(c => c.name === colName);
                    if (col) {
                        showAttributeDetail(col, parentItem);
                    }
                }
            }
            return;
        }

        selectItem(node.dataset.id);
    } else if (e.key === 'ArrowRight') {
        state.expandedNodes.add(node.dataset.id);
        renderTree();
    } else if (e.key === 'ArrowLeft') {
        state.expandedNodes.delete(node.dataset.id);
        renderTree();
    }
}

// Helper function for clickable row click handling
function handleClickableRowClick(row) {
    const attrName = row.dataset.attrName;
    const parentId = row.dataset.parentId;
    if (attrName && parentId) {
        const parentItem = findItemById(parentId);
        if (parentItem) {
            const attrs = parentItem.attributes || parentItem.columns || [];
            const attr = attrs.find(a => getText(a.name) === attrName);
            if (attr) {
                showAttributeDetail(attr, parentItem);
                return;
            }
        }
    }
    const itemId = row.dataset.id;
    if (itemId) {
        selectItem(itemId);
    }
}

// ========================================
// Initialization
// ========================================
async function init() {
    console.time('⏱️ Total init');
    const loaded = await loadData();

    if (!loaded) {
        document.getElementById('app').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${icons.database}</div>
                <h2 class="empty-state-title">Daten konnten nicht geladen werden</h2>
                <p>Bitte prüfen Sie, ob die Datendateien im Ordner /data vorhanden sind.</p>
            </div>
        `;
        return;
    }

    console.time('⏱️ renderApp');
    renderApp();
    console.timeEnd('⏱️ renderApp');

    console.time('⏱️ Setup events');
    setupDelegatedEvents();
    setupKeyboardShortcuts();
    attachVersionSelectorListeners();
    console.timeEnd('⏱️ Setup events');

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = state.theme;
        document.getElementById('themeToggle').innerHTML = state.theme === 'light' ? icons.sun : icons.moon;
    });

    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
        document.getElementById('sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
    });

    // Sidebar overlay (mobile)
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
        state.sidebarCollapsed = true;
        document.getElementById('sidebar').classList.add('collapsed');
    });

    // Expanding Search
    const searchContainer = document.querySelector('.search-container');
    const searchToggle = document.getElementById('searchToggle');
    const searchInput = document.getElementById('searchInput');

    searchToggle.addEventListener('click', () => {
        searchContainer.classList.add('expanded');
        setTimeout(() => searchInput.focus(), 50);
    });

    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            document.getElementById('searchResults')?.classList.remove('active');
            // Collapse if empty
            if (!searchInput.value) {
                searchContainer.classList.remove('expanded');
            }
        }, 200);
    });

    // Close search on Escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            searchInput.blur();
            searchContainer.classList.remove('expanded');
            handleSearch('');
        }
    });

    // Group-by dropdown
    const groupByDropdown = document.getElementById('groupByDropdown');
    const groupByTrigger = document.getElementById('groupByTrigger');
    const groupByMenu = document.getElementById('groupByMenu');

    groupByTrigger.addEventListener('click', () => {
        groupByDropdown.classList.toggle('open');
        groupByTrigger.setAttribute('aria-expanded', groupByDropdown.classList.contains('open'));
    });

    // Close dropdown when clicking outside
    const sortDropdown = document.getElementById('sortDropdown');
    const sortTrigger = document.getElementById('sortTrigger');
    const sortMenu = document.getElementById('sortMenu');

    document.addEventListener('click', (e) => {
        if (!groupByDropdown.contains(e.target)) {
            groupByDropdown.classList.remove('open');
            groupByTrigger.setAttribute('aria-expanded', 'false');
        }
        if (sortDropdown && !sortDropdown.contains(e.target)) {
            sortDropdown.classList.remove('open');
            sortTrigger?.setAttribute('aria-expanded', 'false');
        }
    });

    // Handle option selection
    groupByMenu.querySelectorAll('.group-by-option').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;
            const text = option.querySelector('span:last-child').textContent;
            const iconHtml = option.querySelector('.group-by-option-icon').innerHTML;

            // Update trigger text and icon
            groupByTrigger.querySelector('.group-by-trigger-text').textContent = text;
            groupByTrigger.querySelector('.group-by-trigger-icon').innerHTML = iconHtml;

            // Update selected state
            groupByMenu.querySelectorAll('.group-by-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Close dropdown
            groupByDropdown.classList.remove('open');
            groupByTrigger.setAttribute('aria-expanded', 'false');

            // Update state and re-render tree
            state.groupBy = value;
            renderTree();
        });
    });

    // Tree search functionality
    const treeSearch = document.getElementById('treeSearch');
    const treeSearchClear = document.getElementById('treeSearchClear');

    treeSearch?.addEventListener('input', (e) => {
        state.treeSearchQuery = e.target.value.toLowerCase();
        renderTree();
    });

    treeSearchClear?.addEventListener('click', () => {
        treeSearch.value = '';
        state.treeSearchQuery = '';
        renderTree();
    });

    // Expand/Collapse all toggle
    const expandCollapseToggle = document.getElementById('expandCollapseToggle');
    expandCollapseToggle?.addEventListener('click', () => {
        state.allExpanded = !state.allExpanded;

        if (state.allExpanded) {
            // Expand all layers and nodes
            state.expandedLayers = new Set(['logical', 'physical']);
            // Expand all domain and system nodes
            data.domains.forEach(d => state.expandedNodes.add(d.id));
            data.systems.forEach(s => state.expandedNodes.add(s.id));
            data.entities.forEach(e => state.expandedNodes.add(e.id));
            expandCollapseToggle.innerHTML = icons.expandAll;
            expandCollapseToggle.setAttribute('title', 'Alle erweitern');
            expandCollapseToggle.setAttribute('aria-label', 'Expand all');
        } else {
            // Collapse all
            state.expandedLayers.clear();
            state.expandedNodes.clear();
            expandCollapseToggle.innerHTML = icons.collapseAll;
            expandCollapseToggle.setAttribute('title', 'Alle reduzieren');
            expandCollapseToggle.setAttribute('aria-label', 'Collapse all');
        }

        renderTree();
    });

    // Sort dropdown functionality
    sortTrigger?.addEventListener('click', () => {
        sortDropdown.classList.toggle('open');
        sortTrigger.setAttribute('aria-expanded', sortDropdown.classList.contains('open'));
    });

    sortMenu?.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.dataset.value;

            // Update trigger icon
            const iconHtml = option.querySelector('.sort-option-icon').innerHTML;
            sortTrigger.innerHTML = iconHtml;

            // Update selected state
            sortMenu.querySelectorAll('.sort-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Close dropdown
            sortDropdown.classList.remove('open');
            sortTrigger.setAttribute('aria-expanded', 'false');

            // Update state and re-render tree
            state.treeSort = value;
            renderTree();
        });
    });

    // Handle URL routing
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // If no specific route, show catalogs overview (landing page)
    if (!state.selectedItem && !state.currentCatalog) {
        renderCatalogsOverview();
    }

    console.timeEnd('⏱️ Total init');
    console.log('📊 Data loaded:', {
        catalogs: data.catalogs.length,
        domains: data.domains.length,
        entities: data.entities.length,
        systems: data.systems.length,
        schemas: data.schemas.length,
        enumerations: data.enumerations.length,
        attributes: data.attributes.length,
        columns: data.columns.length
    });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
