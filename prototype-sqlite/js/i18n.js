// ============================================================
// i18n: current language, translation dictionaries, and locale
// helpers for multilingual DB rows.
//
// Dictionaries live in `data/i18n.json` and are loaded once during
// app boot via `loadI18n()`. The module-level vars below start empty
// and are populated in place so existing `tr()` / `tSection()` /
// `tStatus()` call sites keep working unchanged.
//
// All user-visible strings that are not data should go through
// tr(), tStatus(), or tSection(). Data-row language columns
// (name_de, name_fr, …) are resolved through nameCol/n.
// ============================================================

let lang = 'de';

// Populated by loadI18n() from data/i18n.json. Kept as let so the
// assignment is visible to the helpers below without module rebinding.
let LANG_LABELS    = { de: 'DE', fr: 'FR', it: 'IT', en: 'EN' };
let SECTION_LABELS = {};
let STATUS_LABELS  = {};
let I18N           = {};

// Icons are not translation data — keep them next to the labels so
// the sidebar renderer has a single source of mapping.
const SECTION_ICONS = {
  vocabulary: 'box',
  terms: 'book-open',
  codelists: 'list-ordered',
  systems: 'database',
  datasets: 'package'
};

async function loadI18n() {
  try {
    const resp = await fetch('data/i18n.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data.langLabels)    LANG_LABELS    = data.langLabels;
    if (data.sectionLabels) SECTION_LABELS = data.sectionLabels;
    if (data.statusLabels)  STATUS_LABELS  = data.statusLabels;
    if (data.keys)          I18N           = data.keys;
  } catch (e) {
    console.error('Failed to load data/i18n.json:', e.message);
    // Empty dicts fall through — tr() returns the key, which is at
    // least a legible identifier for debugging.
  }
}

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
