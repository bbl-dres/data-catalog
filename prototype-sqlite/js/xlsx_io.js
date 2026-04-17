// ============================================================
// xlsx_io: schema-driven single-workbook export + raw DB download.
//
// The exporter introspects the live SQLite schema via sqlite_master
// and PRAGMA queries — no hand-maintained column lists — so it
// stays in sync with schema changes automatically.
//
// Per table we emit one sheet. Per column we emit:
//   - the column as-is for plain types,
//   - four _de / _fr / _it / _en columns when the column holds a
//     locale-keyed JSONB blob (list below),
//   - an extra <fk>_name companion column for every foreign key
//     whose target table has a "name-ish" column, so Excel users
//     don't have to cross-reference UUIDs.
//
// Tables excluded by policy:
//   - user              (IAM / privacy)
//   - relationship_edge (materialised — regenerated from scans)
//
// Depends on db.js (query), i18n.js (lang, nameCol).
// Requires the SheetJS global `XLSX` (loaded via CDN in index.html).
// ============================================================

const EXCLUDED_TABLES = new Set([
  'user',
  'relationship_edge',
]);

// JSONB columns keyed by locale ({"de": ..., "fr": ..., ...}). Each
// gets exploded into four _de/_fr/_it/_en columns. Array-valued JSON
// columns (related_terms, sample_values, theme) pass through as-is.
const LOCALE_JSON_COLUMNS = new Set([
  'description',
  'alt_names',
  'definition',
  'scope_note',
  'keyword',
  'rule_definition',
]);

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

// sqlite_master → table list, minus our exclusions and internal tables.
function getExportableTables() {
  const rows = query(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  return rows.map(r => r.name).filter(n => !EXCLUDED_TABLES.has(n));
}

// PRAGMA doesn't accept bound params — only call with sqlite_master names.
function getTableColumns(tableName) {
  return query(`PRAGMA table_info(${quoteIdent(tableName)})`);
}

function getForeignKeys(tableName) {
  return query(`PRAGMA foreign_key_list(${quoteIdent(tableName)})`);
}

// Pick the most useful "name" column the target table offers, in
// fallback order: current-locale → en → de → plain name → display_name.
function bestNameColumn(tableName) {
  const cols = getTableColumns(tableName).map(c => c.name);
  const locale = nameCol('name');
  if (cols.includes(locale)) return locale;
  if (cols.includes('name_en')) return 'name_en';
  if (cols.includes('name_de')) return 'name_de';
  if (cols.includes('name')) return 'name';
  if (cols.includes('display_name')) return 'display_name';
  return null;
}

// Build the SELECT for one table: JSON expansion + FK name joins.
// Returns the query result (rows ready for XLSX.json_to_sheet).
function buildSheetRows(tableName) {
  const cols = getTableColumns(tableName);
  const fks = getForeignKeys(tableName);
  const fkByFromCol = {};
  fks.forEach(fk => { fkByFromCol[fk.from] = fk; });

  const selectParts = [];
  const joins = [];
  let joinCount = 0;

  cols.forEach(c => {
    const name = c.name;

    // Emit the column (or its locale explosion)
    if (LOCALE_JSON_COLUMNS.has(name)) {
      ['de', 'fr', 'it', 'en'].forEach(l => {
        selectParts.push(
          `json_extract(t.${quoteIdent(name)}, '$.${l}') AS ${quoteIdent(name + '_' + l)}`
        );
      });
    } else {
      selectParts.push(`t.${quoteIdent(name)}`);
    }

    // If this column is a FK, add a companion _name column
    const fk = fkByFromCol[name];
    if (!fk) return;
    if (EXCLUDED_TABLES.has(fk.table)) return;
    const target = fk.table;
    const targetName = bestNameColumn(target);
    if (!targetName) return;

    joinCount += 1;
    const alias = `fk${joinCount}`;
    joins.push(
      `LEFT JOIN ${quoteIdent(target)} ${alias} ON ${alias}.${quoteIdent(fk.to || 'id')} = t.${quoteIdent(name)}`
    );
    const outputName = name.endsWith('_id')
      ? name.slice(0, -3) + '_name'
      : name + '_name';
    selectParts.push(`${alias}.${quoteIdent(targetName)} AS ${quoteIdent(outputName)}`);
  });

  const sql =
    `SELECT ${selectParts.join(', ')} FROM ${quoteIdent(tableName)} t` +
    (joins.length ? ' ' + joins.join(' ') : '');

  return query(sql);
}

// First sheet of the workbook: human-readable overview so the Excel
// file is self-documenting without requiring the reader to know the
// catalog structure.
function buildReadmeSheet(tableNames, rowCounts) {
  const exportedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);
  const rows = [
    ['BBL Datenkatalog — Vollständiger Export'],
    ['Exportiert am', exportedAt],
    ['Anzahl Tabellen', tableNames.length],
    ['Anzahl Zeilen gesamt', totalRows],
    [],
    ['Hinweise zum Inhalt:'],
    ['• Jede Registerkarte entspricht einer Tabelle in der Datenbank.'],
    ['• Spaltennamen sind die technischen Datenbank-Spalten (snake_case).'],
    ['• _id Spalten sind UUID-Fremdschlüssel; _name Spalten sind schreibgeschützte Auflösungen.'],
    ['• Sprachspezifische JSON-Felder (description, definition, scope_note, …) sind in _de / _fr / _it / _en aufgetrennt.'],
    ['• Die Tabellen "user" (Benutzer) und "relationship_edge" (abgeleitet) sind nicht enthalten.'],
    [],
    ['Registerkarte', 'Zeilenanzahl']
  ];
  tableNames.forEach(t => rows.push([t, rowCounts[t] ?? 0]));
  return XLSX.utils.aoa_to_sheet(rows);
}

// Count rows cheaply (no joins, no JSON expansion) for README stats
// and UI footer.
function countRows(tableName) {
  const r = query(`SELECT COUNT(*) AS c FROM ${quoteIdent(tableName)}`)[0];
  return r?.c || 0;
}

// ── Catalog-wide stats used by the export view ──────────────
function catalogStats() {
  const tables = getExportableTables();
  let totalRows = 0;
  tables.forEach(t => { totalRows += countRows(t); });
  return { tableCount: tables.length, rowCount: totalRows };
}

// Trigger download of a single workbook: README + one sheet per
// exportable table.
function exportFullCatalog() {
  if (typeof XLSX === 'undefined') {
    alert('Excel-Bibliothek noch nicht geladen. Bitte Seite neu laden.');
    return;
  }

  const tables = getExportableTables();
  const rowCounts = {};
  const sheetRows = {};
  tables.forEach(t => {
    sheetRows[t] = buildSheetRows(t);
    rowCounts[t] = sheetRows[t].length;
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildReadmeSheet(tables, rowCounts), 'README');

  tables.forEach(t => {
    const rows = sheetRows[t];
    const ws = rows.length
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([['(keine Daten)']]);
    XLSX.utils.book_append_sheet(wb, ws, t);
  });

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `bbl-datenkatalog-${date}.xlsx`);
}

// Raw SQLite file download — no external library needed, sql.js
// exposes db.export() as a Uint8Array.
function exportDatabase() {
  if (!db) return;
  const buffer = db.export();
  const blob = new Blob([buffer], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `catalog-${date}.db`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
