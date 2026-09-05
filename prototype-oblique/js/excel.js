/* excel.js – scoped, multi-sheet catalog workbooks. ExcelJS loads only on export. */
(function (DK) {
  'use strict';
  const { ui, data, router } = DK;
  const t = ui.t;
  const excel = {};
  const libraryUrl = typeof document === 'undefined' ? '' : new URL('../vendor/exceljs/exceljs.min.js', document.currentScript.src).href;
  let loading;

  /** Build a plain-data snapshot before any asynchronous work or route/language change. */
  excel.plan = function (route, ctx, baseUrl = window.location.href) {
    const roots = route.entity ? [route.entity] : ctx.groups.flatMap(g => {
      const sort = ui.tableOptions(ctx.state, `list:${route.kind}`, { column: 0, direction: 'asc' }).sort;
      const items = ctx.mode === 'table' ? ui.sortRows(g.items, sort, e => [e.name, ...data.cols(route.kind, e), data.statusOf(route.kind, e)]) : g.items;
      return items.map(e => ({ ...e, kind: route.kind }));
    });
    const records = new Map();
    const add = (kind, e) => { if (e) records.set(`${kind}:${e.identifier}`, { ...e, kind }); };
    roots.forEach(e => add(e.kind, e));
    // Expand owned content, not every neighbour in the relationship graph.
    roots.forEach(e => {
      if (e.kind === 'domains') ['objects', 'tables', 'refs', 'products', 'apis'].forEach(kind => data.membersOfDomain(kind, e).forEach(x => add(kind, x)));
      if (e.kind === 'systems') {
        data.tablesOfSystem(e).forEach(x => add('tables', x));
        data.apisOfSystem(e).forEach(x => add('apis', x));
      }
    });
    [...records.values()].filter(e => e.kind === 'objects').forEach(e => {
      data.tables.filter(x => x.realizes === e.identifier).forEach(x => add('tables', x));
      data.refs.filter(x => x.businessObject === e.identifier).forEach(x => add('refs', x));
    });
    [...records.values()].forEach(e => {
      const fields = e.kind === 'tables' ? e.fields : ['fields', 'attrs'].includes(e.kind) ? [e] : [];
      fields.forEach(f => add('refs', data.get('refs', f.codeList)));
    });
    const rootKeys = new Set(roots.map(e => `${e.kind}:${e.identifier}`));
    const link = (kind, id) => new URL(router.entityHref(kind, id), baseUrl).href;
    const sheets = [];
    const col = (key, width = 24, type) => ({ label: t(key), width, type });
    const sheet = (name, columns) => { const s = { name, columns, rows: [] }; sheets.push(s); return s; };
    const overview = sheet(t('detail.tab.overview'), [col('excel.property', 30), col('excel.value', 100)]);
    overview.rows.push([t('excel.selection'), ctx.title], [t('excel.exported'), new Date().toISOString()], [t('excel.view'), baseUrl],
      [t('excel.filter'), ctx.filter || ''], [t('excel.selectedCount'), roots.length], [t('excel.scope'), t('excel.scopeNote')]);
    const metadata = { name: t('excel.metadata'), columns: [col('col.type'), col('fact.identifier', 36), col('col.name', 36), col('excel.property', 40), col('excel.value', 90)], rows: [] };
    const documentation = { name: t('detail.sourceDocumentation'), columns: [col('fact.table', 36), col('col.field'), col('excel.section', 38), col('excel.value', 100), col('fact.sourceDocument', 60, 'link')], rows: [] };
    const relationships = { name: t('detail.tab.relations'), columns: [col('col.type'), col('fact.identifier', 36), col('col.name', 36), col('excel.relationship', 36), col('excel.target', 45), col('col.details', 45), col('excel.link', 60, 'link')], rows: [] };
    const history = { name: t('detail.tab.history'), columns: [col('col.type'), col('fact.identifier', 36), col('col.name', 36), col('col.date'), col('col.change'), col('col.details', 80), col('col.editedBy')], rows: [] };
    // Remaining metadata is flattened without guessing data types or dropping unknown fields.
    const flatten = (kind, id, name, value, path = '') => {
      if (value == null) return;
      if (typeof value === 'object' && !Array.isArray(value)) Object.entries(value).forEach(([k, v]) => flatten(kind, id, name, v, path ? `${path}.${k}` : k));
      else metadata.rows.push([kind, String(id), name, path, Array.isArray(value) ? JSON.stringify(value) : value]);
    };
    const meta = (e, kindLabel) => Object.entries(e).filter(([k]) => !['kind', 'attributes', 'fields', 'values', 'catalogMetadata'].includes(k)).forEach(([k, v]) => flatten(kindLabel, e.identifier, e.name, v, k));
    const kinds = [...new Set([...roots.map(e => e.kind), ...data.kinds])].filter(k => !['attrs', 'fields'].includes(k));
    kinds.forEach(kind => {
      const items = [...records.values()].filter(e => e.kind === kind);
      if (!items.length && !(route.view === 'list' && route.kind === kind)) return;
      const s = sheet(data.kindDef(kind).plural, [col('fact.identifier', 34), col('col.name', 40), col('col.description', 85), col('col.status', 20), col('fact.version', 18), col('col.domain', 30), col('col.system', 25), col('col.responsibility', 40), col('excel.selection', 20), col('excel.link', 60, 'link')]);
      items.forEach(e => {
        s.rows.push([String(e.identifier), data.displayName(kind, e), e.description, e.status, e.version, data.domainForEntity(kind, e)?.name,
          data.sysOf(e.system)?.name, e.responsibleOrg, t(rootKeys.has(`${kind}:${e.identifier}`) ? 'excel.selected' : 'excel.included'), link(kind, e.identifier)]);
      });
    });
    const attrs = { name: t('col.attributes'), columns: [col('excel.parentType'), col('excel.parentId', 32), col('excel.parent', 35), col('fact.identifier', 32), col('col.name', 34), col('col.description', 80), col('col.valueType'), col('col.key'), col('col.mandatory'), col('fact.position', 20, 'number'), col('col.status'), col('col.codeList', 32), col('excel.link', 60, 'link')], rows: [] };
    const fields = { name: t('col.fields'), columns: [col('excel.parentId', 32), col('fact.table', 38), col('fact.identifier', 32), col('fact.technicalName', 25), col('col.label', 45), col('col.description', 80), col('col.dataType'), col('col.key'), col('col.mandatory'), col('fact.position', 20, 'number'), col('col.codeList', 32), col('fact.registerAccess', 28), col('fact.masterData', 25), col('col.status'), col('fact.sourceDocument', 60, 'link'), col('excel.link', 60, 'link')], rows: [] };
    const values = { name: t('col.values'), columns: [col('excel.parentId', 32), col('col.codeList', 44), col('col.code', 20), col('col.label', 65), ...['fr', 'it', 'en'].map(lang => ({ label: `${t('col.label')} (${lang})`, width: 50 })), col('col.details', 75), col('fact.version'), col('excel.sourceRow', 20, 'number')], rows: [] };
    const children = new Map();
    const addChild = (e, parent, kind) => children.set(`${kind}:${e.identifier}`, { e, parent, kind });
    const orderedChildren = (e, items) => {
      if (route.entity?.kind !== e.kind || route.entity.identifier !== e.identifier) return items;
      const rows = DK.detail.rowsData(e).rows;
      const sort = ui.tableOptions(ctx.state, `detail:${e.kind}:rows`).sort;
      return ui.sortRows(items.map((item, i) => ({ item, text: rows[i]?.text || [] })), sort, r => r.text).map(r => r.item);
    };
    [...records.values()].forEach(e => {
      if (e.kind === 'objects') orderedChildren(e, e.attributes).forEach(a => addChild(data.attr(`${e.identifier}/${a.identifier}`), e, 'attrs'));
      if (e.kind === 'products') orderedChildren(e, e.attributes).forEach(a => addChild({ ...a, identifier: `${e.identifier}/${e.attributes.indexOf(a) + 1}`, position: e.attributes.indexOf(a) + 1, status: e.status }, e, 'productAttrs'));
      if (e.kind === 'tables') orderedChildren(e, e.fields).forEach(f => addChild(data.field(`${e.identifier}/${data.fieldId(f)}`), e, 'fields'));
      if (e.kind === 'attrs') addChild(e, { ...data.objOf(e.object), kind: 'objects' }, 'attrs');
      if (e.kind === 'fields') addChild(e, { ...data.get('tables', e.table), kind: 'tables' }, 'fields');
      if (e.kind === 'refs') orderedChildren(e, e.values).forEach(v => {
        values.rows.push([String(e.identifier), e.name, String(v.code ?? ''), v.label, v.labels?.fr, v.labels?.it, v.labels?.en, v.note, v.sourceVersion || e.version, v.sourceRow]);
        flatten(data.kindDef('refs').singular, `${e.identifier}/${v.code}`, v.label, v);
      });
      if (!['attrs', 'fields'].includes(e.kind)) meta(e, data.kindDef(e.kind).singular);
      data.relations(e.kind, e).forEach(g => g.items.forEach(item => relationships.rows.push([data.kindDef(e.kind).singular, String(e.identifier), e.name, g.title, item.name, item.sub, new URL(item.href, baseUrl).href])));
      data.history(e.kind, e.identifier).forEach(h => history.rows.push([data.kindDef(e.kind).singular, String(e.identifier), e.name, h.date, h.action, h.detail, h.user]));
    });
    children.forEach(({ e, parent, kind }) => {
      const mandatory = typeof e.mandatory === 'boolean' ? t(e.mandatory ? 'yes' : 'no') : '';
      if (kind === 'fields') {
        fields.rows.push([String(parent.identifier), data.displayName('tables', parent), String(e.fieldId), e.technicalName, e.label, e.description, e.dataType, e.keyRole, mandatory, e.position, e.codeList,
          e.catalogMetadata?.['Zugriff auf die Daten'], e.catalogMetadata?.Stammdaten, e.status, e.sourceUrl, link('fields', e.identifier)]);
        Object.entries(e.catalogMetadata || {}).forEach(([section, text]) => documentation.rows.push([String(parent.identifier), e.technicalName, section, text, e.sourceUrl]));
      } else attrs.rows.push([data.kindDef(parent.kind).singular, String(parent.identifier), parent.name, String(e.attrId || e.identifier), e.name, e.description, e.valueType, e.keyRole, mandatory, e.position, e.status, e.codeList, kind === 'attrs' ? link('attrs', e.identifier) : link('products', parent.identifier)]);
      meta(e, data.kindDef(kind === 'productAttrs' ? 'attrs' : kind).singular);
    });
    [attrs, fields, values, metadata, documentation, relationships, history].forEach(s => { if (s.rows.length) sheets.push(s); });
    sheets.slice(1).forEach(s => overview.rows.push([s.name, s.rows.length]));
    return { filename: `${ui.slug(ctx.title) || 'katalog'}.xlsx`, title: ctx.title, sheets, longTextName: t('excel.longTexts'), continuation: t('excel.continuation'),
      longColumns: [col('fact.identifier'), col('excel.sheet'), col('excel.row', 20, 'number'), col('excel.column'), col('excel.part', 20, 'number'), col('excel.value', 100)] };
  };

  /** Workbook construction is separate from browser loading/downloading for round-trip tests. */
  excel.createWorkbook = function (plan, ExcelJS) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BBL Datenkatalog'; workbook.title = plan.title;
    const used = new Set();
    const nameOf = proposed => {
      const base = proposed.replace(/[\\/*?:\[\]]/g, ' ').replace(/^'+|'+$/g, '').slice(0, 31) || 'Sheet';
      let name = base, n = 1;
      while (used.has(name.toLowerCase())) { const suffix = ` (${++n})`; name = base.slice(0, 31 - suffix.length) + suffix; }
      used.add(name.toLowerCase()); return name;
    };
    const longTexts = [];
    let longTextName;
    const add = (s, reservedName) => {
      if (s.rows.length > 1048575) throw new Error('Excel worksheet row limit exceeded');
      const ws = workbook.addWorksheet(reservedName || nameOf(s.name), { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = s.columns.map(c => ({ header: c.label, width: c.width }));
      s.rows.forEach((values, index) => {
        const safe = values.map((v, colIndex) => {
          if (v == null) return null;
          // Catalog objects are never handed to ExcelJS as formula/hyperlink instructions.
          if (typeof v === 'object') v = JSON.stringify(v);
          if (typeof v === 'string' && v.length > 32767) {
            longTextName ||= nameOf(plan.longTextName);
            const id = `T${longTexts.length + 1}`;
            for (let start = 0, part = 1; start < v.length; part++) {
              let end = Math.min(start + 32000, v.length);
              if (end < v.length && /[\uD800-\uDBFF]/.test(v[end - 1])) end--;
              longTexts.push([id, ws.name, index + 2, s.columns[colIndex].label, part, v.slice(start, end)]);
              start = end;
            }
            return `${Array.from(v).slice(0, 1000).join('')}\n[${plan.continuation}: ${longTextName} / ${id}]`;
          }
          if (s.columns[colIndex].type === 'link' && typeof v === 'string' && /^https?:\/\//i.test(v) && ui.safeHref(v)) return { text: v, hyperlink: v };
          return v;
        });
        const row = ws.addRow();
        safe.forEach((value, i) => { row.getCell(i + 1).value = value; });
        row.eachCell(cell => {
          cell.font = { name: 'Arial', size: 11, ...(cell.hyperlink ? { color: { argb: 'FF005EA8' }, underline: true } : {}) };
          cell.alignment = { vertical: 'top', horizontal: typeof cell.value === 'number' ? 'right' : 'left', wrapText: true };
          if (typeof cell.value === 'string') cell.numFmt = '@';
        });
      });
      ws.getRow(1).height = 30;
      ws.getRow(1).eachCell((cell, i) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF344154' } };
        cell.alignment = { vertical: 'middle', horizontal: s.columns[i - 1].type === 'number' ? 'right' : 'left', wrapText: false };
      });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ws.rowCount), column: s.columns.length } };
      return ws;
    };
    plan.sheets.forEach(s => add(s));
    if (longTexts.length) add({ name: longTextName, columns: plan.longColumns || ['ID', 'Sheet', 'Row', 'Column', 'Part', 'Text'].map((label, i) => ({ label, width: i === 5 ? 100 : 24, type: [2, 4].includes(i) ? 'number' : undefined })), rows: longTexts }, longTextName);
    return workbook;
  };

  excel.load = function () {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const finish = error => {
        clearTimeout(timer); script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); } else resolve(window.ExcelJS);
      };
      const timer = setTimeout(() => finish(new Error('ExcelJS loading timed out')), 20000);
      script.src = libraryUrl;
      script.onload = () => finish(window.ExcelJS ? null : new Error('ExcelJS is unavailable'));
      script.onerror = () => finish(new Error('ExcelJS failed to load'));
      document.head.appendChild(script);
    }).catch(error => { loading = null; throw error; });
    return loading;
  };

  excel.download = async function (plan) {
    const ExcelJS = await excel.load();
    const workbook = excel.createWorkbook(plan, ExcelJS);
    const buffer = await workbook.xlsx.writeBuffer();
    ui.downloadBlob(plan.filename, new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };
  DK.excel = excel;
})(window.DK = window.DK || {});
