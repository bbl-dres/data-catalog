// ============================================================
// State
// ============================================================
let db = null;
let currentSection = 'vocabulary';
let currentEntityId = null;
let currentCollectionId = null;
let currentTab = 'overview';
let lastListTab = 'table';
const grouping = { vocabulary: 'domain', terms: 'domain', codelists: 'domain', systems: 'none', products: 'none' };
const STATUS_LABELS = { approved: 'Freigegeben', draft: 'Entwurf', in_review: 'In Prüfung', deprecated: 'Veraltet' };
let searchQuery = '';
let lang = 'de';
const expandedSections = new Set(['vocabulary']);
let recents = [];
let sidebarCounts = null; // cached sidebar counts
let relGraphData = null; // relationship graph data (replaces relGraphData)
let relCleanup = null; // cleanup function for relationship graph event listeners

const LANG_LABELS = { de: 'DE', fr: 'FR', it: 'IT', en: 'EN' };
const SECTION_LABELS = {
  vocabulary: { de: 'Geschäftsobjekte', fr: 'Objets métier', it: 'Oggetti di business', en: 'Business Objects' },
  terms: { de: 'Begriffe', fr: 'Termes', it: 'Termini', en: 'Terms' },
  codelists: { de: 'Codelisten', fr: 'Listes de codes', it: 'Liste di codici', en: 'Code Lists' },
  systems: { de: 'Systeme', fr: 'Systemes', it: 'Sistemi', en: 'Systems' },
  products: { de: 'Datensammlungen', fr: 'Collections de données', it: 'Raccolte di dati', en: 'Data Collections' }
};
const SECTION_ICONS = {
  vocabulary: 'box',
  terms: 'book-open',
  codelists: 'list-ordered',
  systems: 'database',
  products: 'package'
};
