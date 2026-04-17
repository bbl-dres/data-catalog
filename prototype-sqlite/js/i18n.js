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
  not_found:              { de: 'Nicht gefunden',      fr: 'Introuvable',       it: 'Non trovato',       en: 'Not found' }
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
