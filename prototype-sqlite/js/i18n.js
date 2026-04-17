// ============================================================
// i18n: current language, translation dictionaries, and locale
// helpers for multilingual DB rows.
//
// All user-visible strings that are not data should go through
// t(), tStatus(), or tSection(). Data-row language columns
// (name_de, name_fr, …) are resolved through nameCol/n.
// ============================================================

let lang = 'de';

const LANG_LABELS = { de: 'DE', fr: 'FR', it: 'IT', en: 'EN' };

const SECTION_LABELS = {
  vocabulary: { de: 'Geschäftsobjekte', fr: 'Objets métier',       it: 'Oggetti di business', en: 'Business Objects' },
  terms:      { de: 'Begriffe',         fr: 'Termes',              it: 'Termini',             en: 'Terms' },
  codelists:  { de: 'Codelisten',       fr: 'Listes de codes',     it: 'Liste di codici',     en: 'Code Lists' },
  systems:    { de: 'Systeme',          fr: 'Systèmes',            it: 'Sistemi',             en: 'Systems' },
  products:   { de: 'Datensammlungen',  fr: 'Collections de données', it: 'Raccolte di dati', en: 'Data Collections' }
};

const SECTION_ICONS = {
  vocabulary: 'box',
  terms: 'book-open',
  codelists: 'list-ordered',
  systems: 'database',
  products: 'package'
};

const STATUS_LABELS = {
  approved:   { de: 'Freigegeben', fr: 'Approuvé',   it: 'Approvato',    en: 'Approved' },
  draft:      { de: 'Entwurf',     fr: 'Brouillon',  it: 'Bozza',        en: 'Draft' },
  in_review:  { de: 'In Prüfung',  fr: 'En revue',   it: 'In revisione', en: 'In review' },
  deprecated: { de: 'Veraltet',    fr: 'Obsolète',   it: 'Obsoleto',     en: 'Deprecated' },
  active:     { de: 'Aktiv',       fr: 'Actif',      it: 'Attivo',       en: 'Active' }
};

// General chrome strings. Keep keys short and kebab-free for grep-ability.
const I18N = {
  home:                   { de: 'Home',                fr: 'Accueil',           it: 'Home',              en: 'Home' },
  filter:                 { de: 'Filter',              fr: 'Filtres',           it: 'Filtri',            en: 'Filters' },
  filter_reset:           { de: 'Alle Filter zurücksetzen', fr: 'Réinitialiser tous les filtres', it: 'Reimposta tutti i filtri', en: 'Reset all filters' },
  filter_apply_aria:      { de: 'Filter {label} anwenden',  fr: 'Appliquer le filtre {label}',  it: 'Applica filtro {label}',  en: 'Apply filter {label}' },
  filter_remove_aria:     { de: 'Filter {label} entfernen', fr: 'Retirer le filtre {label}',    it: 'Rimuovi filtro {label}',  en: 'Remove filter {label}' },
  filter_live_message:    { de: '{filtered} von {total} {section} angezeigt, {count} Filter aktiv.', fr: '{filtered} sur {total} {section} affichés, {count} filtres actifs.', it: '{filtered} di {total} {section} mostrati, {count} filtri attivi.', en: '{filtered} of {total} {section} shown, {count} filters active.' },
  no_hits_title:          { de: 'Keine Treffer',       fr: 'Aucun résultat',    it: 'Nessun risultato',  en: 'No matches' },
  no_entries:             { de: 'Keine Einträge',      fr: 'Aucune entrée',     it: 'Nessuna voce',      en: 'No entries' },
  no_attributes:          { de: 'Keine Attribute',     fr: 'Aucun attribut',    it: 'Nessun attributo',  en: 'No attributes' },
  no_values:              { de: 'Keine Werte',         fr: 'Aucune valeur',     it: 'Nessun valore',     en: 'No values' },
  no_tables:              { de: 'Keine Tabellen',      fr: 'Aucune table',      it: 'Nessuna tabella',   en: 'No tables' },
  no_activity:            { de: 'Keine Aktivität',     fr: 'Aucune activité',   it: 'Nessuna attività',  en: 'No activity' },
  no_bookmarks:           { de: 'Keine Lesezeichen',   fr: 'Aucun signet',      it: 'Nessun segnalibro', en: 'No bookmarks' },
  access_restricted:      { de: 'Zugriff eingeschränkt', fr: 'Accès restreint', it: 'Accesso limitato',  en: 'Access restricted' },
  access_restricted_body: { de: 'Dieser Inhalt ist klassifiziert. Zugriff anfordern, um die Details einzusehen.', fr: 'Ce contenu est classifié. Demandez l\'accès pour consulter les détails.', it: 'Questo contenuto è riservato. Richiedi l\'accesso per visualizzare i dettagli.', en: 'This content is classified. Request access to view the details.' },
  request_access:         { de: 'Zugriff anfordern',   fr: 'Demander l\'accès', it: 'Richiedi accesso',  en: 'Request access' },
  unknown:                { de: 'Unbekannt',           fr: 'Inconnu',           it: 'Sconosciuto',       en: 'Unknown' },
  not_found:              { de: 'Nicht gefunden',      fr: 'Introuvable',       it: 'Non trovato',       en: 'Not found' },
  sidebar_collapse:       { de: 'Seitenleiste einklappen', fr: 'Réduire la barre latérale', it: 'Riduci la barra laterale', en: 'Collapse sidebar' },
  sidebar_expand:         { de: 'Seitenleiste ausklappen', fr: 'Développer la barre latérale', it: 'Espandi la barra laterale', en: 'Expand sidebar' },

  // ── Workflows & API ─────────────────────────────────────
  workflows_api:          { de: 'Workflows & API',     fr: 'Workflows & API',   it: 'Workflows & API',   en: 'Workflows & API' },

  // Excel export section
  export_excel_label:     { de: 'EXCEL EXPORT',        fr: 'EXPORT EXCEL',      it: 'ESPORTAZIONE EXCEL', en: 'EXCEL EXPORT' },
  export_excel_intro:     { de: 'Den gesamten Katalog als eine Excel-Datei herunterladen — eine Registerkarte pro Tabelle.', fr: 'Télécharger tout le catalogue dans un seul fichier Excel — un onglet par table.', it: 'Scarica l\'intero catalogo come unico file Excel — una scheda per tabella.', en: 'Download the full catalog as a single Excel file — one sheet per table.' },
  export_tables:          { de: 'Tabellen',            fr: 'tables',            it: 'tabelle',           en: 'tables' },
  export_rows:            { de: 'Zeilen',              fr: 'lignes',            it: 'righe',             en: 'rows' },
  export_download_xlsx:   { de: 'Excel herunterladen', fr: 'Télécharger Excel', it: 'Scarica Excel',     en: 'Download Excel' },

  // Excel import section (placeholder until Phase 2)
  import_excel_label:     { de: 'EXCEL IMPORT',        fr: 'IMPORT EXCEL',      it: 'IMPORTAZIONE EXCEL', en: 'EXCEL IMPORT' },
  import_excel_intro:     { de: 'Eine zuvor exportierte und bearbeitete Excel-Datei hochladen, um Änderungen in den Katalog zu übernehmen.', fr: 'Téléverser un fichier Excel exporté puis modifié pour appliquer les changements au catalogue.', it: 'Carica un file Excel precedentemente esportato e modificato per applicare le modifiche al catalogo.', en: 'Upload a previously exported and edited Excel file to apply changes to the catalog.' },
  import_choose_file:     { de: 'Datei auswählen',     fr: 'Choisir un fichier', it: 'Scegli file',      en: 'Choose file' },
  import_coming_soon:     { de: 'Wird in einer späteren Version unterstützt.', fr: 'Disponible dans une version ultérieure.', it: 'Disponibile in una versione futura.', en: 'Available in a later version.' },

  // SQL database download section
  db_download_label:      { de: 'SQL DATENBANK DOWNLOAD', fr: 'TÉLÉCHARGEMENT DE LA BASE SQL', it: 'DOWNLOAD DATABASE SQL', en: 'SQL DATABASE DOWNLOAD' },
  db_download_intro:      { de: 'Laden Sie die aktuelle SQLite-Datenbank zur Sicherung oder Offline-Analyse herunter.', fr: 'Téléchargez la base SQLite actuelle pour sauvegarde ou analyse hors ligne.', it: 'Scarica il database SQLite corrente per backup o analisi offline.', en: 'Download the current SQLite database for backup or offline analysis.' },
  db_download_button:     { de: 'catalog.db herunterladen', fr: 'Télécharger catalog.db', it: 'Scarica catalog.db', en: 'Download catalog.db' },

  // REST API section
  rest_api_label:         { de: 'REST API',            fr: 'API REST',          it: 'API REST',          en: 'REST API' },
  rest_api_intro:         { de: 'Programmatischer Zugriff auf den Katalog über eine REST-Schnittstelle. Die OpenAPI/Swagger-Dokumentation beschreibt alle verfügbaren Endpunkte.', fr: 'Accès programmatique au catalogue via une interface REST. La documentation OpenAPI/Swagger décrit tous les points de terminaison disponibles.', it: 'Accesso programmatico al catalogo tramite un\'interfaccia REST. La documentazione OpenAPI/Swagger descrive tutti gli endpoint disponibili.', en: 'Programmatic access to the catalog via a REST interface. The OpenAPI/Swagger documentation describes all available endpoints.' },
  rest_api_open_docs:     { de: 'API-Dokumentation öffnen', fr: 'Ouvrir la documentation API', it: 'Apri la documentazione API', en: 'Open API documentation' },

  // API docs stub page
  api_docs_title:         { de: 'API-Dokumentation',   fr: 'Documentation API', it: 'Documentazione API', en: 'API documentation' },
  api_docs_coming_soon:   { de: 'Die Swagger-UI mit der OpenAPI-Spezifikation folgt in einer späteren Version.', fr: 'L\'interface Swagger avec la spécification OpenAPI suivra dans une version ultérieure.', it: 'L\'interfaccia Swagger con la specifica OpenAPI arriverà in una versione futura.', en: 'The Swagger UI with the OpenAPI specification will follow in a later version.' }
};

function tr(key, vars) {
  const entry = I18N[key];
  let str = entry ? (entry[lang] || entry.en || entry.de || key) : key;
  if (vars) {
    for (const k in vars) str = str.split(`{${k}}`).join(vars[k]);
  }
  return str;
}

function tStatus(status) {
  const entry = STATUS_LABELS[status];
  if (!entry) return status || '';
  return entry[lang] || entry.en || entry.de || status;
}

function tSection(section) {
  const entry = SECTION_LABELS[section];
  if (!entry) return section || '';
  return entry[lang] || entry.en || entry.de || section;
}

// Locale column helpers — used to read *_de/_fr/_it/_en columns from
// SQLite rows. Fallback order: active lang → en → de → ''.
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

// Resolve a JSONB-style {de:..,fr:..,...} blob against a given locale.
function getDefinitionText(jsonStr, locale) {
  const obj = parseJSON(jsonStr);
  if (!obj) return '';
  return obj[locale] || obj['en'] || obj['de'] || '';
}

function formatNumber(num) {
  if (num == null || num === '') return '';
  const locale = lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : lang === 'it' ? 'it-CH' : 'en-CH';
  return new Intl.NumberFormat(locale).format(num);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const locale = lang === 'de' ? 'de-CH' : lang === 'fr' ? 'fr-CH' : lang === 'it' ? 'it-CH' : 'en-CH';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
  } catch { return isoStr; }
}
