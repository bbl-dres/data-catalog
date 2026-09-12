/* ui.js – small rendering helpers shared by all views (no app state here). */
(function (DK) {
  'use strict';

  const ui = {};
  let dict = {};

  /** Pick one language from the i18n table (key → { de, fr, it, en }); a missing or empty translation falls back to `fallback`. */
  ui.setDictionary = function (table, lang, fallback) {
    dict = {};
    Object.keys(table || {}).forEach(key => {
      const v = table[key];
      if (!v || typeof v !== 'object') return;
      dict[key] = v[lang] || v[fallback || 'de'] || key;
    });
  };

  /** Translate a UI key; `{name}` placeholders are replaced from params. Unknown keys return the key itself. */
  ui.t = function (key, params) {
    let s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (params) Object.keys(params).forEach(k => { s = s.split('{' + k + '}').join(String(params[k])); });
    return s;
  };

  ui.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  /** SVG icon (CSS mask, coloured by currentColor). size: xs|sm|lg|xl|2xl|3xl */
  ui.icon = function (name, size, cls) {
    return `<span class="ob-icon ob-icon-${name}${size ? ' ob-icon--' + size : ''}${cls ? ' ' + cls : ''}" aria-hidden="true"></span>`;
  };

  /** Pill chip. tone: success|warning|error|info|neutral */
  ui.chip = function (label, tone) {
    return `<span class="ob-chip ob-chip--${tone || 'neutral'}">${ui.esc(label)}</span>`;
  };

  /** Link to a catalog entity inside a table cell. `labelHtml` is used verbatim when given (already escaped). */
  ui.entityLink = (href, label, labelHtml) => `<a class="ob-table-entity-link" href="${ui.esc(href)}">${labelHtml || ui.esc(label)}</a>`;

  /** Escaped text with every occurrence of `query` wrapped in <mark>, case- and diacritic-insensitive. */
  ui.highlight = function (text, query) {
    const s = String(text == null ? '' : text);
    const fold = x => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q = fold((query || '').trim());
    const f = fold(s);
    if (!q || f.length !== s.length) return ui.esc(s); // folding changed the length: no safe offsets
    let out = '', pos = 0, i;
    while ((i = f.indexOf(q, pos)) >= 0) {
      out += ui.esc(s.slice(pos, i)) + '<mark class="ob-mark">' + ui.esc(s.slice(i, i + q.length)) + '</mark>';
      pos = i + q.length;
    }
    return out + ui.esc(s.slice(pos));
  };

  /** Sort options for `ui.table`: the stored sort of `key`, else the default. */
  ui.tableOptions = (state, key, defaultSort) => ({ key, sort: state.tableSorts[key] || defaultSort || null });

  /** Empty state block with a title and optional hint. */
  ui.empty = (title, hint) => `<div class="ob-empty"><div class="ob-empty-title">${ui.esc(title)}</div>${hint ? `<div>${hint}</div>` : ''}</div>`;

  /** ISO date (yyyy-mm-dd) → Swiss short date (d.m.yyyy). */
  ui.fmtDate = function (iso) {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${+m[3]}.${+m[2]}.${m[1]}` : iso;
  };

  /** Stable, locale-aware table sort. `getValues(row)` returns one raw value per column. */
  ui.sortRows = function (rows, sort, getValues) {
    if (!sort || !Number.isInteger(sort.column)) return rows.slice();
    const collator = new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' });
    const direction = sort.direction === 'desc' ? -1 : 1;
    const value = row => (getValues(row) || [])[sort.column];
    const empty = v => v == null || String(v).trim() === '' || String(v).trim() === '–';
    return rows.map((row, index) => ({ row, index })).sort((a, b) => {
      const av = value(a.row), bv = value(b.row);
      if (empty(av) && empty(bv)) return a.index - b.index;
      if (empty(av)) return 1;
      if (empty(bv)) return -1;
      const result = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : collator.compare(String(av).trim(), String(bv).trim());
      return result ? result * direction : a.index - b.index;
    }).map(item => item.row);
  };

  /** Table shell. Options `{ key, sort }` make column headers sortable. */
  ui.table = function (columns, rowsHtml, options) {
    const opts = options || {};
    const head = columns.map((c, i) => {
      const sortable = !!opts.key && c.sortable !== false;
      const active = sortable && opts.sort && opts.sort.column === i;
      const direction = active ? opts.sort.direction : null;
      const ariaSort = direction === 'desc' ? 'descending' : 'ascending';
      const next = active && direction === 'asc' ? 'descending' : 'ascending';
      const content = sortable
        ? `<button type="button" class="ob-table-sort" data-action="sort-table" data-sort-key="${ui.esc(opts.key)}" data-sort-column="${i}" aria-label="${ui.esc(ui.t('sort.' + next, { column: c.label }))}"><span class="ob-table-sort-label">${ui.esc(c.label)}</span>${ui.icon('chevron_down', 'sm', 'ob-table-sort-icon')}</button>`
        : ui.esc(c.label);
      return `<th scope="col"${active ? ` aria-sort="${ariaSort}"` : ''}${c.width ? ` style="width:${c.width}"` : ''}>${content}</th>`;
    }).join('');
    return `<div class="ob-table-wrap"><table class="ob-table"><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  };

  /** Table row. cells: html string | {html, cls}. Column labels support mobile cards. */
  ui.tr = function (cells, href, columns) {
    const tds = cells.map((c, i) => {
      const o = c && typeof c === 'object' ? c : { html: c };
      const label = o.label || (columns && columns[i] && columns[i].label) || '';
      return `<td${label ? ` data-label="${ui.esc(label)}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}>${o.html == null ? '' : o.html}</td>`;
    }).join('');
    return `<tr${href ? ` class="is-clickable" data-href="${ui.esc(href)}"` : ''}>${tds}</tr>`;
  };

  /** Transient status message (bottom right). tone: info|success|warning */
  ui.toast = function (message, tone) {
    const region = document.getElementById('toasts');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'ob-alert' + (tone ? ' ob-alert--' + tone : '');
    el.innerHTML = `<span>${ui.esc(message)}</span><button type="button" class="ob-alert-close" aria-label="${ui.esc(ui.t('toast.close'))}" data-action="toast-close">${ui.icon('xmark', 'sm')}</button>`;
    region.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 6000);
  };

  /** Download rows as a semicolon-separated CSV (UTF-8 with BOM, Excel-friendly). */
  ui.downloadCsv = function (filename, header, rows) {
    const q = v => { const s = String(v == null ? '' : v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [header].concat(rows).map(r => r.map(q).join(';'));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** Stable ASCII slug for names (ä→ae etc.), same rule as the data generator. */
  ui.slug = function (s) {
    return String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  /** Technical field name for an attribute name (Gebäudehöhe → GEBAEUDEHOEHE), same rule as the data generator. */
  ui.fieldName = function (s) {
    return String(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/(^_|_$)/g, '');
  };

  DK.ui = ui;
})(window.DK = window.DK || {});
