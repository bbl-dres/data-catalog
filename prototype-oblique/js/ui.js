/* ui.js – small rendering helpers shared by all views (no app state here). */
(function (DK) {
  'use strict';

  const ui = {};
  let dict = {};

  /** Install the active language dictionary (data/i18n.json → one language). */
  ui.setDictionary = function (d) { dict = d || {}; };

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

  /** ISO date (yyyy-mm-dd) → Swiss short date (d.m.yyyy). */
  ui.fmtDate = function (iso) {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${+m[3]}.${+m[2]}.${m[1]}` : iso;
  };

  /** Table shell. columns: [{label, width}], rowsHtml: string of <tr>…</tr>. */
  ui.table = function (columns, rowsHtml) {
    const head = columns.map(c => `<th scope="col"${c.width ? ` style="width:${c.width}"` : ''}>${ui.esc(c.label)}</th>`).join('');
    return `<div class="ob-table-wrap"><table class="ob-table"><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  };

  /** Table row. cells: html string | {html, cls}. href makes the whole row clickable. */
  ui.tr = function (cells, href) {
    const tds = cells.map(c => {
      const o = c && typeof c === 'object' ? c : { html: c };
      return `<td${o.cls ? ` class="${o.cls}"` : ''}>${o.html == null ? '' : o.html}</td>`;
    }).join('');
    return `<tr${href ? ` class="is-clickable" data-href="${ui.esc(href)}"` : ''}>${tds}</tr>`;
  };

  /** Transient status message (bottom right). tone: info|success|warning */
  ui.toast = function (message, tone) {
    const region = document.getElementById('toasts');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'ob-alert' + (tone ? ' ob-alert--' + tone : '');
    el.innerHTML = `<span>${ui.esc(message)}</span><button type="button" class="ob-alert-close" aria-label="Schliessen" data-action="toast-close">${ui.icon('xmark', 'sm')}</button>`;
    region.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 6000);
  };

  /** Download rows as a semicolon-separated CSV (UTF-8 with BOM, Excel-friendly). */
  ui.downloadCsv = function (filename, header, rows) {
    const q = v => { const s = String(v == null ? '' : v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [header].concat(rows).map(r => r.map(q).join(';'));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
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

  DK.ui = ui;
})(window.DK = window.DK || {});
