/* PDF points are physical document units, independent of screen and preview zoom. */
(function (DK) {
  'use strict';
  const { diagram, ui } = DK;
  const pt = mm => mm * 72 / 25.4;
  const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
  diagram.layout = function (snapshot, settings, measure) {
    if (!diagram.papers[settings.paper] || !['portrait', 'landscape'].includes(settings.orientation) || !['tiles', 'grid', 'list'].includes(settings.layout)) throw new Error('Invalid print layout');
    const tiles = settings.layout === 'tiles';
    const size = diagram.papers[settings.paper].map(pt), [width, height] = settings.orientation === 'landscape' ? size.reverse() : size;
    const margin = 36, gap = 18, pad = 8, fontSize = 9, lineHeight = 12, printableWidth = width - margin * 2;
    const t = (key, params) => diagram.t(snapshot, key, params);
    const wrap = (value, available, size = fontSize, bold = false) => diagram.wrap(value, available, size, bold, measure);
    const countSummary = (entries, rows) => [
      `${entries} ${t(snapshot.kind === 'apis' ? 'unit.apis' : 'print.kind.' + snapshot.kind)}`,
      diagram.usesRows(settings) ? `${rows} ${t({ objects: 'col.attributes', tables: 'col.fields', refs: 'col.values', apis: 'visibility.endpoints' }[snapshot.kind] || 'print.rows')}` : '',
    ].filter(Boolean).join(' · ');
    const entities = diagram.exportEntities(snapshot, settings), groups = diagram.groups(snapshot, settings.groupBy, entities);
    const fieldCount = entities.reduce((sum, e) => sum + e.rows.length, 0), profile = !tiles && settings.layout !== 'list' && entities.length === 1;
    const documentStatus = t('print.status.' + settings.documentStatus);
    const classificationCode = diagram.classification(settings.classification) || entities.map(e => diagram.classification(e.classification)).filter(Boolean)
      .sort((a, b) => diagram.classifications.indexOf(b) - diagram.classifications.indexOf(a))[0] || '';
    const classification = diagram.classificationLabel(snapshot, classificationCode);
    const sourceDates = entities.map(e => e.versionDate || e.modified).filter(Boolean).sort();
    const sourceDate = sourceDates.at(-1) || '—';
    const date = new Intl.DateTimeFormat('de-CH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Zurich' }).format(new Date(snapshot.createdAt));
    const titleWidth = printableWidth * .55, brandWidth = printableWidth - titleWidth - gap;
    const title = wrap(settings.title || snapshot.title, titleWidth, 16, true);
    const scopeText = [snapshot.scopeTitle || snapshot.scope, snapshot.filter, diagram.filterSummary(snapshot, settings),
      countSummary(entities.length, fieldCount),
      settings.groupBy === 'none' ? '' : `${t('toolbar.group')}: ${snapshot.groupings.find(g => g.id === settings.groupBy)?.label}`].filter(Boolean).join(' · ');
    const scope = wrap(scopeText, titleWidth, 8);
    const organisation = wrap(snapshot.organisation, brandWidth - 36, 9, true);
    const bodyTop = margin + Math.max(organisation.length * 12 + 20, title.length * 20 + scope.length * 11) + 18;
    const footerWidths = [printableWidth * .33, printableWidth * .51, printableWidth * .12];
    const footer = [
      wrap(`${settings.title || snapshot.title} · ${t('diagram.documentId')}: ${clean(settings.documentId) || '—'} · ${t('diagram.version')}: ${clean(settings.version) || '—'} · ${documentStatus}`, footerWidths[0], 7.5),
      wrap(`${t('diagram.created')}: ${date} (Europe/Zurich) · ${snapshot.creator || '—'} · ${snapshot.application} · ${t('print.dataDate')}: ${sourceDate}`, footerWidths[1], 7.5),
    ];
    const footerHeight = Math.max(...footer.map(lines => lines.length)) * 10;
    const legend = wrap(tiles ? t('print.tilesHint') : snapshot.labels.legend, printableWidth, 7.5), footerY = height - margin - footerHeight;
    const legendY = footerY - 18 - legend.length * 10, bodyBottom = legendY - 18, bodyHeight = bodyBottom - bodyTop;
    if (bodyHeight < 120) throw new Error(snapshot.labels.tooLong);
    const list = settings.layout === 'list' || profile, continuousList = settings.layout === 'list';
    const detailTitle = t({ objects: 'col.attributes', tables: 'col.fields', refs: 'col.values', apis: 'visibility.endpoints' }[snapshot.kind] || 'print.rows');
    const entityFields = diagram.selectedFields(snapshot, settings, true), rowFields = diagram.selectedFields(snapshot, settings);
    // Long entry descriptions belong in the introduction, not on every attribute row.
    const tableFields = tiles ? [] : [...(continuousList ? entityFields.filter(f => f.id !== 'description').map(f => ({ ...f, id: 'entity.' + f.id,
      labelText: f.id === 'name' ? snapshot.entityLabel : rowFields.some(row => row.id === f.id) ? t('visibility.entryField', { field: f.labelText }) : f.labelText })) : []), ...rowFields]
      .sort((a, b) => (a.id === 'entity.name' ? -2 : a.order) - (b.id === 'entity.name' ? -2 : b.order));
    const keys = tableFields.map(f => f.id), columnLabels = tableFields.map(f => f.labelText);
    const minima = columnLabels.map(label => measure(label, 8, true) + 12);
    // Prefer readable text columns; fewer cards per row are better than letter-by-letter wrapping.
    const preferredWidth = tableFields.reduce((sum, f, i) => sum + Math.max(minima[i], f.sizing.minEm * fontSize), 0);
    const columns = list ? 1 : Math.max(1, Math.floor((printableWidth + gap) / ((tiles ? 240 : Math.max(340, preferredWidth)) + gap)));
    const columnWidth = (printableWidth - (columns - 1) * gap) / columns;
    const value = (entity, row, key) => (key.startsWith('entity.') ? entity.display[key.slice(7)] : row.display?.[key]) ?? '—';
    const tableWidths = (fields, available, values) => {
      const metrics = fields.map(f => {
        const compact = ['number', 'boolean', 'status', 'date'].includes(f.type) || /(?:^|\.)key$/.test(f.id);
        const texts = [...new Set(values(f).map(clean))], header = measure(f.labelText, 8, true) + 12;
        const limit = f.sizing.minEm * fontSize * 1.5;
        const complete = texts.reduce((max, text) => Math.max(max, measure(text, fontSize)), 0);
        const word = texts.reduce((max, text) => text.split(' ').reduce((max, word) => Math.max(max, measure(word, fontSize)), max), 0);
        const minimum = Math.max(header, compact ? Math.min(complete, limit) + 12 : 0);
        const preferred = Math.max(minimum, Math.min(word, limit) + 12);
        const maximum = f.type === 'long' ? Infinity : Math.max(preferred, Math.min(complete, limit) + 12);
        return { minimum, preferred, maximum: compact ? minimum : maximum, weight: f.sizing.weight };
      });
      const minimum = metrics.reduce((sum, m) => sum + m.minimum, 0), preferred = metrics.reduce((sum, m) => sum + m.preferred, 0);
      if (minimum > available) throw new Error(t('print.columnsTooWide'));
      const ratio = preferred > minimum ? Math.min(1, (available - minimum) / (preferred - minimum)) : 1;
      const widths = metrics.map(m => m.minimum + (m.preferred - m.minimum) * ratio);
      // Keep short values intact; prose receives space after other columns reach their useful width.
      let remaining = available - widths.reduce((sum, width) => sum + width, 0);
      while (remaining > .01) {
        let active = metrics.map((m, i) => widths[i] < m.maximum - .01 ? i : -1).filter(i => i >= 0);
        const bounded = active.length > 0;
        if (!bounded) active = fields.map((_, i) => i);
        if (!active.length) break;
        const weight = active.reduce((sum, i) => sum + metrics[i].weight, 0), spare = remaining;
        for (const i of active) {
          const extra = Math.min(spare * metrics[i].weight / weight, bounded ? metrics[i].maximum - widths[i] : Infinity);
          widths[i] += extra; remaining -= extra;
        }
      }
      return widths;
    };
    const cellWidths = tableWidths(tableFields, columnWidth, f => f.id.startsWith('entity.')
      ? entities.map(entity => value(entity, {}, f.id)) : entities.flatMap(entity => entity.rows.map(row => value(entity, row, f.id))));
    const pages = [], pageHeadings = [], listHeadings = [];
    const summaries = [], summaryFields = [
      { ...snapshot.entityFields.find(f => f.id === 'name'), id: 'name', labelText: t('col.name') },
      { id: 'type', labelText: t('col.type'), type: 'text', sizing: { minEm: 9, weight: 1.2 } },
      ...entityFields.filter(f => f.id === 'description'),
    ], summaryHeadingHeight = 51, entries = new Map();
    if (continuousList) {
      for (const entity of entities) for (const context of entity.contexts || []) entries.set(context.id, context);
      for (const entity of entities) entries.set(`${snapshot.kind}:${entity.id}`, {
        id: `${snapshot.kind}:${entity.id}`, name: entity.display.name, type: snapshot.entityLabel, description: entity.display.description,
      });
    }
    const summaryWidths = tableWidths(summaryFields, printableWidth, f => [...entries.values()].map(entry => entry[f.id] || '—'));
    if (entries.size) {
      const startSummary = () => { summaries.push([]); pages.push([]); pageHeadings.push([]); listHeadings.push([]); return bodyTop + summaryHeadingHeight; };
      let top = startSummary();
      for (const entry of entries.values()) {
        const cells = summaryFields.map((f, i) => wrap(entry[f.id] || '—', summaryWidths[i] - 12));
        const lines = Math.max(...cells.map(cell => cell.length));
        for (let offset = 0; offset < lines;) {
          if (top + lineHeight + 3 > bodyBottom) top = startSummary();
          const end = Math.min(lines, offset + Math.floor((bodyBottom - top - 3) / lineHeight)), height = (end - offset) * lineHeight + 3;
          summaries.at(-1).push({ id: entry.id, cells: cells.map(cell => cell.slice(offset, end)), y: top, height });
          top += height; offset = end;
        }
      }
    }
    let y, column, currentSection, pageRow = 0;
    const sections = groups.map(group => {
      const fields = group.items.reduce((sum, e) => sum + e.rows.length, 0);
      const heading = settings.groupBy === 'none' ? [] : wrap(group.title, printableWidth * .48, 11, true);
      const summary = countSummary(group.items.length, fields), details = wrap(summary, printableWidth * .48, 8);
      return { ...group, fields, summary, heading, details,
        headingHeight: (continuousList ? 30 : 0) + (heading.length ? Math.max(heading.length * 14 + 14, details.length * 11) + 16 : 0) };
    });
    const startPage = section => {
      pages.push([]); pageHeadings.push([]); listHeadings.push([]); column = 0; pageRow = 0; y = bodyTop + section.headingHeight;
      if (section.headingHeight) pageHeadings.at(-1).push({ groupId: section.id, title: continuousList ? detailTitle : '', lines: section.heading, details: section.details,
        label: snapshot.groupings.find(g => g.id === settings.groupBy)?.label, x: margin, y: bodyTop, width: printableWidth, height: section.headingHeight - 8 });
      if (continuousList) { listHeadings.at(-1).push({ x: margin, y, width: printableWidth, height: 21 }); y += 21; }
    };
    const nextColumn = () => { column++; y = bodyTop + currentSection.headingHeight; if (column >= columns) startPage(currentSection); };
    const placeTiles = section => {
      const inset = pad * 1.5, contentWidth = columnWidth - inset * 2;
      const cards = section.items.map(entity => {
        const heading = wrap(entity.display.name, contentWidth, 11, true), technical = [];
        const description = entityFields.some(f => f.id === 'description') ? wrap(entity.display.description, contentWidth) : [];
        const counts = entityFields.filter(f => f.type === 'number');
        const summary = counts.length ? wrap(counts.map(f => `${entity.display[f.id]} ${f.labelText}`).join(' · '), contentWidth * .55, 8) : [];
        const status = entityFields.some(f => f.id === 'status') ? wrap(entity.display.status, contentWidth * .4 - 12, 8, true) : [];
        const facts = entityFields.filter(f => !['name', 'description', 'status'].includes(f.id) && f.type !== 'number')
          .map(f => ({ label: f.labelText, lines: wrap(`${f.labelText}: ${entity.display[f.id]}`, contentWidth) }));
        const footerHeight = Math.max(summary.length, status.length) * 11 + (summary.length || status.length ? 6 : 0);
        const contentHeight = heading.length * 15 + 10 + description.length * lineHeight + facts.reduce((sum, f) => sum + f.lines.length * lineHeight + 4, 0);
        return { entity, groupId: section.id, heading, technical, description, summary, status, footerHeight, inset,
          rows: [], facts, part: 1, parts: 1, width: columnWidth, height: Math.max(entityFields.length > 2 ? 150 : 60, inset * 2 + contentHeight + 18 + footerHeight),
          badgeWidth: Math.max(0, ...status.map(value => measure(value, 8, true))) + 12 };
      });
      // Keep cards in reading order, with a shared height within each row.
      for (let offset = 0; offset < cards.length; offset += columns) {
        const row = cards.slice(offset, offset + columns), rowHeight = Math.max(...row.map(card => card.height));
        if (rowHeight > bodyHeight - section.headingHeight) throw new Error(snapshot.labels.tooLong);
        if (y + rowHeight > bodyBottom + .01) startPage(section);
        row.forEach((card, index) => pages.at(-1).push({ ...card, x: margin + index * (columnWidth + gap), y, height: rowHeight }));
        y += rowHeight + gap;
      }
    };
    for (const section of sections) {
      if (!section.items.length) continue;
      currentSection = section; startPage(section);
      if (tiles) { placeTiles(section); continue; }
      for (const entity of section.items) {
        if (continuousList) {
          const rows = (entity.rows.length ? entity.rows : [{ id: '', empty: true, display: {} }]).map(row => {
            const cells = keys.map((key, i) => wrap(value(entity, row, key), cellWidths[i] - 12));
            return { ...row, cells, height: Math.max(...cells.map(cell => cell.length)) * lineHeight + 3 };
          });
          const parts = []; let offset = 0;
          while (offset < rows.length) {
            if (rows[offset].height > bodyHeight - section.headingHeight - 21) throw new Error(snapshot.labels.tooLong);
            if (y + rows[offset].height > bodyBottom + .01) startPage(section);
            const start = offset, top = y, visible = [];
            while (offset < rows.length && y + rows[offset].height <= bodyBottom + .01) {
              const row = { ...rows[offset++], zebra: pageRow++ % 2 === 0 }; visible.push(row); y += row.height;
            }
            const card = { entity, groupId: section.id, rows: visible, heading: [], context: [], facts: [], start: start + 1, end: offset,
              part: parts.length + 1, parts: 1, headerHeight: 0, rowHeaderHeight: 0, width: columnWidth, height: y - top, x: margin, y: top };
            pages.at(-1).push(card); parts.push(card);
          }
          parts.forEach(card => { card.parts = parts.length; });
          continue;
        }
        const heading = wrap(entity.display.name, columnWidth - pad * 2, 11, true), context = [];
        const facts = entityFields.filter(f => f.id !== 'name').map(f => ({ label: f.labelText, lines: wrap(entity.display[f.id], columnWidth * .74 - pad * 2, 9) }));
        const baseHeaderHeight = pad * 2 + heading.length * 15 + 12;
        const factsHeight = facts.reduce((sum, fact) => sum + fact.lines.length * 12 + 4, 0);
        const rowHeaderHeight = 21, emptyHeight = 26;
        const rows = entity.rows.map(row => {
          const cells = keys.map((key, index) => { const cell = value(entity, row, key); return wrap(cell === '' || cell === null || cell === undefined ? '—' : cell, cellWidths[index] - 12); });
          return { ...row, cells, height: Math.max(...cells.map(cell => cell.length)) * lineHeight + 3 };
        });
        const capacity = bodyHeight - section.headingHeight - baseHeaderHeight - rowHeaderHeight - (continuousList ? 21 : 0);
        if (capacity < emptyHeight || rows.some(row => row.height > capacity)) throw new Error(snapshot.labels.tooLong);
        let offset = 0; const parts = [];
        do {
          const cardFacts = parts.length ? [] : facts, headerHeight = baseHeaderHeight + (parts.length ? 0 : factsHeight);
          if (headerHeight + rowHeaderHeight + (rows[offset]?.height || emptyHeight) > bodyHeight - section.headingHeight - (continuousList ? 21 : 0)) throw new Error(snapshot.labels.tooLong);
          const minimum = rows.slice(offset, offset + 5).reduce((sum, row) => sum + row.height, 0) || emptyHeight;
          const required = headerHeight + rowHeaderHeight + Math.min(minimum, capacity - (parts.length ? 0 : factsHeight));
          if (y + required > bodyBottom + .01) nextColumn();
          let used = headerHeight + rowHeaderHeight, end = offset;
          while (end < rows.length && y + used + rows[end].height <= bodyBottom + .01) used += rows[end++].height;
          if (rows.length && end === offset) throw new Error(snapshot.labels.tooLong);
          const card = { entity, groupId: section.id, heading, context, facts: cardFacts, rows: rows.slice(offset, end), start: offset + 1, end,
            part: parts.length + 1, parts: 1, headerHeight, rowHeaderHeight, width: columnWidth, height: used + (rows.length ? 0 : emptyHeight),
            x: margin + column * (columnWidth + gap), y };
          pages.at(-1).push(card); parts.push(card); offset = end; y += card.height + (continuousList ? 0 : gap);
          if (offset < rows.length) nextColumn();
        } while (offset < rows.length);
        parts.forEach(card => { card.parts = parts.length; });
      }
    }
    const entityPages = new Map(), groupPages = new Map();
    pages.forEach((cards, index) => {
      for (const [map, ids] of [[entityPages, cards.map(card => card.entity.id)], [groupPages, cards.map(card => card.groupId)]]) {
        for (const id of new Set(ids)) { if (!map.has(id)) map.set(id, []); map.get(id).push(index); }
      }
    });
    const overviewRows = sections.filter(section => section.items.length).flatMap(section => [
      { id: settings.groupBy === 'none' ? continuousList ? 'details' : 'entries' : section.id,
        title: settings.groupBy === 'none' ? continuousList ? detailTitle : snapshot.scope : [continuousList ? detailTitle : '', section.title].filter(Boolean).join(' · '),
        summary: section.summary, pages: groupPages.get(section.id) || [] },
      ...section.items.map(entity => ({ id: `entity:${entity.id}`, title: entity.display.name, summary: '', indent: true, pages: entityPages.get(entity.id) || [] })),
    ]);
    if (summaries.length) overviewRows.unshift({ id: 'summary', title: t('print.descriptionSummary'), summary: '', pages: summaries.map((_, index) => index) });
    const overview = [];
    // Reserve page references before pagination; at most one contents page is needed per entry.
    const lastPageBound = pages.length + overviewRows.length;
    const overviewHeading = { label: t('col.name'), height: 58,
      pageWidth: Math.max(54, measure(`${lastPageBound}–${lastPageBound}`, 10) + pad * 2, measure(t('diagram.page'), 9, true) + pad * 2) };
    if (entities.length && (settings.overview === 'yes' || settings.overview === 'auto' && pages.length > 1)) {
      let rows = [], used = overviewHeading.height;
      const textWidth = printableWidth - overviewHeading.pageWidth - gap - pad * 2;
      for (const section of overviewRows) {
        const lines = wrap(section.title, textWidth - (section.indent ? gap : 0), 11, true), details = section.summary ? wrap(section.summary, textWidth - (section.indent ? gap : 0), 9) : [];
        const row = { ...section, lines, details, height: lines.length * 15 + details.length * 12 + 18 };
        if (used + row.height > bodyHeight && rows.length) { overview.push(rows); rows = []; used = overviewHeading.height; }
        if (used + row.height > bodyHeight) throw new Error(snapshot.labels.tooLong);
        rows.push(row); used += row.height;
      }
      if (rows.length) overview.push(rows);
      for (let index = 0; index < overview.length; index++) { pages.unshift([]); pageHeadings.unshift([]); listHeadings.unshift([]); }
    }
    return { width, height, margin, gap, pad, fontSize, lineHeight, bodyTop, bodyBottom, columns, keys, cellWidths, columnLabels,
      tableFields, title, scope, organisation, titleWidth, brandWidth, footer, footerWidths, footerY, legend, legendY, classification,
      pages, pageHeadings, listHeadings, continuousList, tiles, overview, overviewHeading, summaries, summaryFields, summaryWidths, summaryHeadingHeight, entityCount: entities.length, fieldCount,
      emptyMessage: diagram.filteredEntities(snapshot, settings).length ? snapshot.labels.noSelection : snapshot.labels.noFilterMatches };
  };

  diagram.pageLinks = (layout, pageIndex) => {
    let y = layout.bodyTop + layout.overviewHeading.height;
    return (layout.overview[pageIndex] || []).map(row => {
      const link = { x: layout.margin, y, width: layout.width - layout.margin * 2, height: row.height,
        targetPage: row.pages[0] + layout.overview.length };
      y += row.height; return link;
    });
  };

  diagram.pageSvg = function (snapshot, settings, layout, pageIndex, palette, logo) {
    const { width, height, margin, pad, lineHeight, fontSize } = layout, shapes = [], t = (key, params) => diagram.t(snapshot, key, params);
    const rect = (x, y, w, h, fill, stroke = 'none') => shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`);
    const line = (x1, y1, x2, y2, color = palette.border, weight = .5) => shapes.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${weight}"/>`);
    const write = (lines, x, y, size, bold = false, color = palette.text, leading = size * 1.4, anchor = 'start') => lines.forEach((value, i) => shapes.push(`<text x="${x}" y="${y + i * leading}" font-size="${size}" font-weight="${bold ? 700 : 400}" fill="${color}" text-anchor="${anchor}">${ui.esc(value)}</text>`));
    const columnHeader = (x, y, w, h, fields = layout.tableFields, widths = layout.cellWidths) => {
      rect(x, y, w, h, palette.surface);
      fields.forEach((field, index) => {
        const numeric = field.type === 'number';
        write([field.labelText], x + (numeric ? widths[index] - 6 : 6), y + 14, 8, true, palette.text, 11, numeric ? 'end' : 'start');
        x += widths[index];
      });
    };
    rect(0, 0, width, height, '#ffffff');
    shapes.push(`<g transform="translate(${margin},${margin}) scale(0.48)">${logo}</g>`);
    write(layout.organisation, margin + 30, margin + 9, 9, true, palette.text, 12);
    write([snapshot.application], margin + 30, margin + layout.organisation.length * 12 + 9, 8);
    write(layout.title, width - margin, margin + 16, 16, true, palette.text, 20, 'end');
    write(layout.scope, width - margin, margin + layout.title.length * 20 + 9, 8, false, palette.secondary, 11, 'end');
    line(margin, layout.bodyTop - 9, width - margin, layout.bodyTop - 9, palette.text, 1.5);
    for (const heading of layout.pageHeadings[pageIndex]) {
      shapes.push(`<g data-group-id="${ui.esc(heading.groupId)}">`);
      if (heading.title) write([heading.title], heading.x, heading.y + 16, 14, true);
      const top = heading.y + (heading.title ? 30 : 0);
      if (heading.lines.length) {
        write([heading.label], heading.x, top + 10, 8, false, palette.secondary);
        write(heading.lines, heading.x, top + 26, 11, true, palette.text, 14);
        write(heading.details, heading.x + heading.width, top + 10, 8, false, palette.secondary, 11, 'end');
      }
      shapes.push('</g>');
    }
    if (layout.overview[pageIndex]) {
      const left = margin + pad, right = width - margin - pad;
      write([t('print.overview')], margin, layout.bodyTop + 16, 14, true);
      write([layout.overviewHeading.label], left, layout.bodyTop + 42, 9, true);
      write([t('diagram.page')], right, layout.bodyTop + 42, 9, true, palette.text, 12, 'end');
      line(margin, layout.bodyTop + 50, width - margin, layout.bodyTop + 50);
      let y = layout.bodyTop + layout.overviewHeading.height;
      for (const row of layout.overview[pageIndex]) {
        const target = row.pages[0] + layout.overview.length;
        shapes.push(`<a href="#diagram-page-${target}" data-diagram-target-page="${target}" data-contents-group="${ui.esc(row.id)}" aria-label="${ui.esc(row.title)} · ${ui.esc(t('diagram.page'))} ${target + 1}">`);
        rect(margin, y, width - margin * 2, row.height, 'transparent');
        const textX = left + (row.indent ? layout.gap : 0);
        write(row.lines, textX, y + 16, 11, true, palette.text, 15);
        write(row.details, textX, y + row.lines.length * 15 + 16, 9, false, palette.secondary, 12);
        const first = row.pages[0] + layout.overview.length + 1, last = row.pages.at(-1) + layout.overview.length + 1;
        write([`${first}${last === first ? '' : '–' + last}`], right, y + 16, 10, false, palette.text, 12, 'end');
        y += row.height;
        line(margin, y, width - margin, y);
        shapes.push('</a>');
      }
    }
    const summary = layout.summaries[pageIndex - layout.overview.length];
    if (summary) {
      write([t('print.descriptionSummary')], margin, layout.bodyTop + 16, 14, true);
      columnHeader(margin, layout.bodyTop + layout.summaryHeadingHeight - 21, width - margin * 2, 21, layout.summaryFields, layout.summaryWidths);
      for (const [index, row] of summary.entries()) {
        shapes.push(`<g data-summary-id="${ui.esc(row.id)}">`);
        if (index % 2 === 0) rect(margin, row.y, width - margin * 2, row.height, palette.zebra);
        let x = margin;
        row.cells.forEach((cell, i) => { write(cell, x + 6, row.y + fontSize + 1, fontSize, false, palette.text, lineHeight); x += layout.summaryWidths[i]; });
        line(margin, row.y + row.height, width - margin, row.y + row.height);
        shapes.push('</g>');
      }
    }
    for (const header of layout.listHeadings[pageIndex]) columnHeader(header.x, header.y, header.width, header.height);
    for (const card of layout.pages[pageIndex]) {
      const { x, y } = card;
      shapes.push(`<g data-entity-id="${ui.esc(card.entity.id)}" data-part="${card.part}">`);
      if (layout.tiles) {
        rect(x, y, card.width, card.height, palette.surface);
        const left = x + card.inset;
        write(card.heading, left, y + card.inset + 11, 11, true, palette.text, 15);
        let textY = y + card.inset + card.heading.length * 15;
        write(card.technical, left, textY + 8, 8, false, palette.secondary, 11); textY += card.technical.length * 11 + 10;
        write(card.description, left, textY + fontSize, fontSize, false, palette.text, lineHeight);
        textY += card.description.length * lineHeight;
        for (const fact of card.facts) { textY += 4; write(fact.lines, left, textY + fontSize, fontSize, false, palette.text, lineHeight); textY += fact.lines.length * lineHeight; }
        const footerTop = y + card.height - card.inset - card.footerHeight;
        write(card.summary, left, footerTop + 10, 8, false, palette.secondary, 11);
        const badgeX = x + card.width - card.inset - card.badgeWidth, badgeHeight = card.status.length * 11 + 4;
        if (card.status.length) shapes.push(`<rect x="${badgeX}" y="${footerTop}" width="${card.badgeWidth}" height="${badgeHeight}" rx="${badgeHeight / 2}" fill="${palette[card.entity.statusTone] || palette.text}"/>`);
        write(card.status, badgeX + 6, footerTop + 10, 8, true, '#ffffff', 11);
        shapes.push('</g>'); continue;
      }
      if (!layout.continuousList) {
      rect(x, y, card.width, card.headerHeight, palette.surface);
      write(card.heading, x + pad, y + pad + 11, 11, true, palette.text, 15);
      let textY = y + pad + card.heading.length * 15 + 8;
      write(card.context, x + pad, textY, 8, false, palette.secondary, 11); textY += card.context.length * 11 + 4;
      for (const fact of card.facts) {
        write([fact.label], x + pad, textY, 9, true, palette.secondary, 12);
        write(fact.lines, x + card.width * .26, textY, 9, false, palette.secondary, 12);
        textY += fact.lines.length * 12 + 4;
      }
      const range = card.parts > 1 ? `${card.part > 1 ? t('print.continued') + ' · ' : ''}${t('print.rows')} ${card.start}–${card.end} / ${card.entity.rows.length}` : `${card.entity.rows.length} ${t('print.rows')}`;
      write([range], x + pad, y + card.headerHeight - 5, 8, false, palette.secondary);
      }
      let rowY = y + card.headerHeight;
      if (card.rowHeaderHeight) columnHeader(x, rowY, card.width, card.rowHeaderHeight);
      let cellX = x;
      rowY += card.rowHeaderHeight;
      if (!card.rows.length) write([snapshot.labels.emptyFields], x + pad, rowY + 16, fontSize, false, palette.secondary);
      for (const [index, row] of card.rows.entries()) {
        if (row.zebra ?? index % 2 === 0) rect(x, rowY, card.width, row.height, palette.zebra);
        shapes.push(`<g data-row-id="${ui.esc(row.id)}">`); cellX = x;
        row.cells.forEach((cell, i) => {
          const numeric = layout.tableFields[i].type === 'number';
          write(cell, cellX + (numeric ? layout.cellWidths[i] - 6 : 6), rowY + fontSize + 1, fontSize, false, palette.text, lineHeight, numeric ? 'end' : 'start');
          cellX += layout.cellWidths[i];
        });
        shapes.push('</g>'); rowY += row.height;
      }
      if (layout.continuousList) line(x, y + card.height, x + card.width, y + card.height, palette.border);
      else rect(x, y, card.width, card.height, 'none', palette.border);
      shapes.push('</g>');
    }
    write(layout.legend, margin, layout.legendY, 7.5, false, palette.secondary, 10);
    line(margin, layout.footerY - 10, width - margin, layout.footerY - 10, palette.text, .75);
    write(layout.footer[0], margin, layout.footerY, 7.5, false, palette.text, 10);
    write(layout.footer[1], margin + (width - margin * 2) * .35, layout.footerY, 7.5, false, palette.secondary, 10);
    write([t('print.pageCount', { page: pageIndex + 1, total: layout.pages.length })], width - margin, layout.footerY, 7.5, false, palette.secondary, 10, 'end');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}" font-family="Noto Sans Export" letter-spacing="0" font-kerning="none" role="${layout.overview[pageIndex] ? 'group' : 'img'}" aria-label="${ui.esc(settings.title || snapshot.title)} · ${ui.esc(t('diagram.page'))} ${pageIndex + 1}"><title>${ui.esc(settings.title || snapshot.title)}</title>${shapes.join('')}</svg>`;
  };
})(window.DK);
