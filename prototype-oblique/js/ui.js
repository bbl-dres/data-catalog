/* ui.js – small rendering helpers shared by all views (no app state here). */
(function (DK) {
  'use strict';

  const ui = {};
  let dict = {};
  let language = 'de', fallbackLanguage = 'de';

  /** Resolve labels or prefixed SQL columns without copying their translations. */
  ui.localized = (labels, prefix = '') => labels?.[prefix + language] || labels?.[prefix + fallbackLanguage]
    || labels?.[prefix + 'de'] || labels?.[prefix + 'en'] || labels?.[prefix + 'fr'] || labels?.[prefix + 'it'] || '';

  /** Resolve translations with a fallback language for missing labels. */
  ui.setDictionary = function (table, lang, fallback) {
    language = lang;
    fallbackLanguage = fallback || 'de';
    dict = {};
    Object.keys(table || {}).forEach(key => {
      const v = table[key];
      if (!v || typeof v !== 'object') return;
      dict[key] = ui.localized(v) || key;
    });
  };

  /** Capture translated content synchronously without changing the application language. */
  ui.withLanguage = function (table, lang, callback) {
    const previous = { dict, language, fallbackLanguage };
    try { ui.setDictionary(table, lang, fallbackLanguage); return callback(); }
    finally { ({ dict, language, fallbackLanguage } = previous); }
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

  /** HTML escaping alone does not make a URL safe. Relative links use the page's HTTP(S) origin. */
  ui.safeHref = function (value) {
    if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;
    const href = value.trim();
    try {
      const url = new URL(href, 'https://catalog.invalid/');
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? href : null;
    } catch (err) { return null; }
  };

  /** labelHtml must already be escaped. An invalid destination stays readable as plain text. */
  ui.link = function (href, labelHtml, options = {}) {
    const safe = ui.safeHref(href);
    const attrs = (options.className ? ` class="${ui.esc(options.className)}"` : '') + (options.title ? ` title="${ui.esc(options.title)}"` : '');
    return safe
      ? `<a${attrs} href="${ui.esc(safe)}"${options.external ? ' target="_blank" rel="noopener"' : ''}>${labelHtml}</a>`
      : `<span${attrs}>${labelHtml}</span>`;
  };

  /** SVG icon (CSS mask, coloured by currentColor). size: xs|sm|lg|xl|2xl|3xl */
  ui.icon = function (name, size, cls) {
    return `<span class="${ui.esc(`ob-icon ob-icon-${name}${size ? ' ob-icon--' + size : ''}${cls ? ' ' + cls : ''}`)}" aria-hidden="true"></span>`;
  };

  /** Shared label/icon composition; callers retain their button semantics and actions. */
  ui.buttonContent = (label, options = {}) => `${options.icon ? ui.icon(options.icon, null, options.iconClass) : ''}<span class="ob-button-label${options.labelClass ? ' ' + ui.esc(options.labelClass) : ''}">${ui.esc(label)}</span>${options.menu ? ui.icon('chevron_down', 'sm', options.chevronClass) : ''}`;

  ui.menuKeydown = (event, menu) => {
    const items = [...menu.querySelectorAll('.ob-menu-item:not(:disabled)')], current = items.indexOf(event.target);
    let next;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      next = items[index];
    } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      next = items.slice(current + 1).concat(items.slice(0, current + 1)).find(item => item.textContent.trim().toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
    }
    if (!next) return false;
    event.preventDefault(); next.focus(); return true;
  };

  /** Shared pagination state. Validate URL values before slicing any result set. */
  ui.pageState = function (total, params = {}, sizes = [50, 100, 200]) {
    const size = sizes.includes(Number(params.size)) ? Number(params.size) : sizes[0];
    const pages = Math.max(1, Math.ceil(total / size));
    const requested = Number(params.page);
    const page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
    return { total, size, sizes, pages, page, from: total ? (page - 1) * size + 1 : 0, to: Math.min(page * size, total) };
  };

  ui.pageRange = ({ from, to, total }, announce = false) => `<span class="ob-pager-range"${announce ? ' role="status"' : ''}>${ui.esc(ui.t('detail.rowRange', { from, to, total }))}</span>`;
  ui.pageParams = ({ page, size, sizes }) => ({ page: page === 1 ? null : page, size: size === sizes[0] ? null : size });

  /** Search can display its range separately above the table. */
  ui.pager = function (paging, { position = 'bottom', showRange = true } = {}) {
    const top = position === 'top';
    const { total, size, sizes, pages, page } = paging;
    if (!total || (top && pages === 1)) return '';
    const t = ui.t, esc = ui.esc;
    const range = showRange ? ui.pageRange(paging, top || pages === 1) : '';
    const buttons = [['prev', page - 1, page <= 1, 'left'], ['next', page + 1, page >= pages, 'right']].map(([key, target, disabled, icon]) =>
      `<button type="button" class="ob-button ob-button--pager" aria-label="${esc(t('detail.' + key))}" data-action="set-page" data-page="${target}" data-focus="page-${key}${top ? '-top' : ''}"${disabled ? ' disabled' : ''}>${ui.icon('chevron_' + icon, 'sm')}</button>`).join('');
    return `<nav class="ob-pager${top ? ' ob-pager--top' : ''}${showRange ? '' : ' ob-pager--no-range'}" aria-label="${esc(t('detail.pagination'))}">${top ? range :
      `<span class="ob-pager-current" aria-current="page">${page}</span><span>${esc(t(pages === 1 ? 'detail.page' : 'detail.pagePlural', { n: pages }))}</span>`}${buttons}${top ? '' :
      `<label class="ob-page-size">${esc(t('detail.pageSize'))}<select class="ob-select" data-action="set-page-size" aria-label="${esc(t('detail.pageSize'))}">${sizes.map(n => `<option value="${n}"${n === size ? ' selected' : ''}>${n}</option>`).join('')}</select></label>${range}`}</nav>`;
  };

  ui.chip = function (label, tone) {
    return `<span class="ob-chip ob-chip--${ui.esc(tone || 'neutral')}">${ui.esc(label)}</span>`;
  };

  /** Link to a catalog entity inside a table cell. `labelHtml` is used verbatim when given (already escaped). */
  ui.entityLink = (href, label, labelHtml) => ui.link(href, labelHtml || ui.esc(label), { className: 'ob-table-entity-link' });

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

  ui.tableOptions = (state, key, defaultSort) => ({ key, sort: state.tableSorts[key] || defaultSort || null });

  /** Hint and actions are already escaped markup, just like table cell content. */
  ui.empty = (title, hint, options = {}) => `<div class="ob-empty${options.className ? ' ' + ui.esc(options.className) : ''}"><div class="ob-empty-title">${ui.esc(title)}</div>${hint ? `<div>${hint}</div>` : ''}${options.actions ? `<div class="ob-empty-action">${options.actions}</div>` : ''}</div>`;

  ui.loading = label => `<div class="ob-loading" role="status" aria-live="polite" aria-atomic="true"><div class="ob-loading-content"><span class="ob-spinner" aria-hidden="true"></span><span class="ob-loading-label">${ui.esc(label)}</span></div></div>`;

  ui.setLoading = function (label = '') {
    const host = document.getElementById('loading');
    const text = host.querySelector('.ob-loading-label');
    if (text.textContent !== label) text.textContent = label;
    host.hidden = !label;
  };

  /** Shared local search for collections and detail rows; only one is mounted per page. */
  ui.collectionSearch = (filter, panel) => `<div class="ob-collection-search" role="search" aria-label="${ui.esc(ui.t('collection.search.label'))}">
    ${ui.icon('search', 'lg', 'ob-search-icon')}
    <input type="search" class="ob-input ob-search-input" id="collection-filter" value="${ui.esc(filter)}" placeholder="${ui.esc(ui.t('collection.search.placeholder'))}" aria-label="${ui.esc(ui.t('collection.search.label'))}" aria-controls="${ui.esc(panel)}" aria-describedby="collection-filter-status" autocomplete="off" spellcheck="false" enterkeyhint="search">
    <button type="button" class="ob-icon-button ob-search-clear" id="collection-filter-clear" data-action="clear-collection-filter" aria-label="${ui.esc(ui.t('collection.search.clear'))}"${filter ? '' : ' hidden'}>${ui.icon('xmark')}</button>
  </div>`;
  ui.collectionCount = ({ matched, total }) => ui.t('collection.search.count', { n: matched, total });
  ui.collectionStatus = ctx => `<p id="collection-filter-status" class="${ctx.filter ? 'ob-collection-status' : 'ob-sr-only'}" role="status" aria-atomic="true">${ui.esc(ui.collectionCount(ctx))}</p>`;
  ui.collectionEmpty = filter => ui.empty(ui.t('collection.search.none'), filter ? ui.esc(ui.t('collection.search.hint')) : '', {
    actions: filter ? `<button type="button" class="ob-button" data-action="clear-collection-filter">${ui.esc(ui.t('collection.search.clear'))}</button>` : ''
  });

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
    return rows.map((row, index) => {
      const value = (getValues(row) || [])[sort.column], text = String(value ?? '').trim();
      return { row, index, value, text, empty: !text || text === '–' };
    }).sort((a, b) => {
      const av = a.value, bv = b.value;
      if (a.empty && b.empty) return a.index - b.index;
      if (a.empty) return 1;
      if (b.empty) return -1;
      const result = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : collator.compare(a.text, b.text);
      return result ? result * direction : a.index - b.index;
    }).map(item => item.row);
  };

  /** Table shell. Columns declare numeric alignment and compact sizing; options `{ key, sort }` enable sorting. */
  ui.table = function (columns, rowsHtml, options) {
    const opts = options || {};
    const sized = columns.length && columns.every(c => c.sizing);
    const minima = sized ? columns.map(c => Math.max(c.sizing.minEm, c.label.length * .45 + 2.5)) : [];
    const minimumEm = minima.reduce((sum, width) => sum + width, 0);
    const head = columns.map((c, i) => {
      const sortable = !!opts.key && c.sortable !== false;
      const active = sortable && opts.sort && (opts.sort.field ? opts.sort.field === c.id : opts.sort.column === i);
      const direction = active ? opts.sort.direction : null;
      const ariaSort = direction === 'desc' ? 'descending' : 'ascending';
      const next = active && direction === 'asc' ? 'descending' : 'ascending';
      const content = sortable
        ? `<button type="button" class="ob-table-sort" data-action="sort-table" data-sort-key="${ui.esc(opts.key)}" data-sort-column="${i}"${c.id ? ` data-sort-field="${ui.esc(c.id)}"` : ''} data-focus="sort-table:${ui.esc(opts.key)}:${ui.esc(opts.instance || '')}:${i}" aria-label="${ui.esc(ui.t('sort.' + next, { column: c.label }))}"><span class="ob-table-sort-label">${ui.esc(c.label)}</span>${ui.icon('chevron_down', 'sm', 'ob-table-sort-icon')}</button>`
        : ui.esc(c.label);
      const cls = [c.numeric ? 'ob-cell-numeric' : '', c.compact ? 'ob-col-compact' : ''].filter(Boolean).join(' ');
      return `<th role="columnheader" scope="col"${cls ? ` class="${cls}"` : ''}${active ? ` aria-sort="${ariaSort}"` : ''}${sized ? ` data-column-min-em="${minima[i]}" data-column-weight="${c.sizing.weight}"` : c.width ? ` style="width:${c.width}"` : ''}>${content}${sortable ? `<span class="ob-table-heading-label">${ui.esc(c.label)}</span>` : ''}</th>`;
    }).join('');
    const sortChoices = columns.flatMap((c, i) => c.sortable === false ? [] : ['asc', 'desc'].map(direction => {
      const label = ui.t('sort.' + (direction === 'asc' ? 'ascending' : 'descending'), { column: c.label });
      return `<option value="${c.id || i}:${direction}"${(opts.sort?.field ? opts.sort.field === c.id : opts.sort?.column === i) && opts.sort.direction === direction ? ' selected' : ''}>${ui.esc(label)}</option>`;
    })).join('');
    const cardSort = opts.key ? `<label class="ob-table-card-sort" hidden><span>${ui.esc(ui.t('sort.label'))}</span><select class="ob-select ob-select--comfortable" data-action="sort-cards" data-sort-key="${ui.esc(opts.key)}" data-focus="sort-cards:${ui.esc(opts.key)}:${ui.esc(opts.instance || '')}">${!opts.sort ? `<option value="" selected disabled>${ui.esc(ui.t('sort.choose'))}</option>` : ''}${sortChoices}</select></label>` : '';
    const minWidth = opts.minWidth || (columns.length >= 6 ? 880 : columns.length >= 5 ? 720 : 640);
    return `<div class="ob-table-region" data-table-min-width="${minWidth}"${sized ? ` data-table-min-em="${Math.max(36, minimumEm)}"` : ''}>${cardSort}<div class="ob-table-wrap"><table class="ob-table${sized ? ' ob-table--fields' : ''}" role="table"><thead role="rowgroup"><tr role="row">${head}</tr></thead><tbody role="rowgroup">${rowsHtml}</tbody></table></div></div>`;
  };

  /** Table row. cells: html string | {html, cls}. Column labels support mobile cards. */
  ui.tr = function (cells, href, columns) {
    const tds = cells.map((c, i) => {
      const o = c && typeof c === 'object' ? c : { html: c };
      const label = o.label || (columns && columns[i] && columns[i].label) || '';
      const primary = columns?.some(c => c.primary) ? columns[i]?.primary : i === 0;
      const cls = [o.cls, primary ? 'is-primary' : '', columns?.[i]?.numeric ? 'ob-cell-numeric' : ''].filter(Boolean).join(' ');
      return `<td role="cell"${columns?.[i]?.id ? ` data-field="${ui.esc(columns[i].id)}"` : ''}${label ? ` data-label="${ui.esc(label)}"` : ''}${cls ? ` class="${cls}"` : ''}><span class="ob-cell-value">${o.html == null ? '' : o.html}</span></td>`;
    }).join('');
    return `<tr role="row"${href ? ` class="is-clickable" data-href="${ui.esc(href)}"` : ''}>${tds}</tr>`;
  };

  /** Transient status message (bottom right). tone: info|success|warning */
  ui.toast = function (message, tone) {
    const region = document.getElementById('toasts');
    if (!region) return;
    const el = document.createElement('div');
    el.className = 'ob-alert' + (tone ? ' ob-alert--' + tone : '');
    el.innerHTML = `<span>${ui.esc(message)}</span><button type="button" class="ob-icon-button ob-alert-close" aria-label="${ui.esc(ui.t('toast.close'))}" data-action="toast-close">${ui.icon('xmark', 'sm')}</button>`;
    region.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 6000);
  };

  /** Download a generated local artifact; object URLs are released after the click. */
  ui.downloadBlob = function (filename, blob) {
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

  /** Attribute-name transliteration matches the data generator. */
  ui.fieldName = function (s) {
    return String(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/(^_|_$)/g, '');
  };

  DK.ui = ui;
})(window.DK = window.DK || {});
