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
    const entities = diagram.exportEntities(snapshot, settings), groups = diagram.groups(snapshot, settings.groupBy, entities);
    const fieldCount = entities.reduce((sum, e) => sum + e.rows.length, 0), profile = !tiles && entities.length === 1;
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
      `${entities.length} ${snapshot.scope} · ${tiles ? t('print.tiles') : fieldCount + ' ' + t('print.rows')}`,
      settings.groupBy === 'none' ? '' : `${t('toolbar.group')}: ${snapshot.groupings.find(g => g.id === settings.groupBy)?.label}`].filter(Boolean).join(' · ');
    const scope = wrap(scopeText, titleWidth, 8);
    const organisation = wrap(snapshot.organisation, brandWidth - 36, 9, true);
    const confidential = ['confidential', 'secret'].includes(classificationCode);
    const bodyTop = margin + Math.max(organisation.length * 12 + 20, title.length * 20 + scope.length * 11 + (confidential ? 16 : 0)) + 18;
    const footerWidths = [printableWidth * .33, printableWidth * .51, printableWidth * .12];
    const footer = [
      wrap(`${settings.title || snapshot.title} · ${t('diagram.documentId')}: ${clean(settings.documentId) || '—'} · ${t('diagram.version')}: ${clean(settings.version) || '—'} · ${documentStatus}`, footerWidths[0], 7.5),
      wrap(`${t('diagram.created')}: ${date} (Europe/Zurich) · ${snapshot.creator || '—'} · ${snapshot.application} · ${t('print.dataDate')}: ${sourceDate} · ${classification}`, footerWidths[1], 7.5),
    ];
    const footerHeight = Math.max(...footer.map(lines => lines.length)) * 10;
    const legend = wrap(tiles ? t('print.tilesHint') : snapshot.labels.legend, printableWidth, 7.5), footerY = height - margin - footerHeight;
    const legendY = footerY - 18 - legend.length * 10, bodyBottom = legendY - 18, bodyHeight = bodyBottom - bodyTop;
    if (bodyHeight < 120) throw new Error(snapshot.labels.tooLong);
    const list = settings.layout === 'list' || profile, continuousList = list && !profile;
    const columns = list ? 1 : Math.max(1, Math.floor((printableWidth + gap) / ((tiles ? 240 : 340) + gap)));
    const columnWidth = (printableWidth - (columns - 1) * gap) / columns;
    const requestedColumns = new Set(settings.columns);
    const keys = tiles ? [] : list ? diagram.columnKeys.filter(key => key === 'name' || requestedColumns.has(key)) : diagram.gridKeys(snapshot.kind);
    const weights = { name: 2.4, code: 1.6, type: 1.5, required: 1, key: 1, codeList: 1.8, description: 3.3, unit: 1.2, source: 2, modified: 1.3 };
    const columnLabels = keys.map(key => list ? t('print.column.' + key) : snapshot.labels[key]);
    const minima = columnLabels.map(label => measure(label, 8, true) + 12);
    const remaining = columnWidth - minima.reduce((sum, n) => sum + n, 0);
    if (remaining < 0) throw new Error(t('print.columnsTooWide'));
    const totalWeight = keys.reduce((sum, key) => sum + weights[key], 0);
    const cellWidths = !tiles && !list && snapshot.kind === 'tables' ? [columnWidth - 92 - Math.max(44, minima[2]), 92, Math.max(44, minima[2])]
      : keys.map((key, index) => minima[index] + remaining * weights[key] / totalWeight);
    const value = (row, key) => key === 'name' ? [(list || snapshot.kind === 'refs' ? row.label : row.name),
      !list && !keys.includes('key') && row.key ? `[${row.key}]` : '', !list && !keys.includes('key') && row.required ? '*' : ''].filter(Boolean).join(' ')
      : key === 'required' ? row.required === null ? '—' : t(row.required ? 'print.yes' : 'print.no')
      : key === 'key' ? [row.key, !list && row.required ? '*' : ''].filter(Boolean).join(' ') : row[key];
    const pages = [], pageHeadings = [], listHeadings = [];
    let y, column, currentSection;
    const sections = groups.map(group => {
      const fields = group.items.reduce((sum, e) => sum + e.rows.length, 0);
      const responsibility = [...new Set(group.items.map(e => e.responsibility).filter(Boolean))].join(', ');
      const heading = settings.groupBy === 'none' ? [] : wrap(group.title, printableWidth * .48, 11, true);
      const details = wrap(`${group.items.length} ${snapshot.scope} · ${fields} ${t('print.rows')}${responsibility ? ' · ' + responsibility : ''}`, printableWidth * .48, 8);
      return { ...group, fields, responsibility, heading, details, headingHeight: heading.length ? Math.max(heading.length * 14 + 14, details.length * 11) + 16 : 0 };
    });
    const startPage = section => {
      pages.push([]); pageHeadings.push([]); listHeadings.push([]); column = 0; y = bodyTop + section.headingHeight;
      if (section.heading.length) pageHeadings.at(-1).push({ groupId: section.id, lines: section.heading, details: section.details,
        label: `${t('print.group')} · ${snapshot.groupings.find(g => g.id === settings.groupBy)?.label}`, x: margin, y: bodyTop, width: printableWidth, height: section.headingHeight - 8 });
      if (continuousList) { listHeadings.at(-1).push({ x: margin, y, width: printableWidth, height: 21 }); y += 21; }
    };
    const nextColumn = () => { column++; y = bodyTop + currentSection.headingHeight; if (column >= columns) startPage(currentSection); };
    const placeTiles = section => {
      const inset = pad * 1.5, contentWidth = columnWidth - inset * 2;
      const cards = section.items.map(entity => {
        const heading = wrap(entity.label || entity.name, contentWidth, 11, true);
        const technical = entity.technicalName && entity.technicalName !== entity.label ? wrap(entity.technicalName, contentWidth, 8) : [];
        const description = wrap(entity.description || '—', contentWidth);
        const summary = wrap(entity.tileSummary || '—', contentWidth * .5, 8);
        const status = wrap(entity.status || '—', contentWidth * .45 - 12, 8, true);
        const footerHeight = Math.max(summary.length, status.length) * 11 + 6;
        const contentHeight = heading.length * 15 + technical.length * 11 + 10 + description.length * lineHeight;
        return { entity, groupId: section.id, heading, technical, description, summary, status, footerHeight, inset,
          rows: [], facts: [], part: 1, parts: 1, width: columnWidth, height: Math.max(150, inset * 2 + contentHeight + 18 + footerHeight),
          badgeWidth: Math.max(...status.map(value => measure(value, 8, true))) + 12 };
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
        const heading = wrap(entity.label || entity.name, columnWidth - pad * 2, 11, true);
        const context = wrap([entity.technicalName, `${t('diagram.version')}: ${entity.version || '—'}`, entity.status].filter(Boolean).join(' · '), columnWidth - pad * 2, 8);
        const factEntries = profile ? [
          ['col.description', entity.description], ['fact.technicalName', entity.technicalName],
          ...(snapshot.kind === 'tables' ? [['fact.object', entity.businessObject], ['group.system', entity.system]] : []),
          ['group.domain', entity.domain], ['group.resp', entity.responsibility], ['fact.classification', diagram.classificationLabel(snapshot, entity.classification)],
          ...(snapshot.kind === 'refs' ? [] : [['fact.personalData', entity.personalData === null ? '—' : t(entity.personalData ? 'print.yes' : 'print.no')]])
        ] : [];
        const facts = factEntries.map(([key, value]) => ({ label: t(key), lines: wrap(value || '—', columnWidth * .74 - pad * 2, 9) }));
        const baseHeaderHeight = pad * 2 + heading.length * 15 + context.length * 11 + 12;
        const factsHeight = facts.reduce((sum, fact) => sum + fact.lines.length * 12 + 4, 0);
        const rowHeaderHeight = continuousList ? 0 : 21, emptyHeight = 26;
        const rows = entity.rows.map(row => {
          const cells = keys.map((key, index) => { const cell = value(row, key); return wrap(cell === '' || cell === null || cell === undefined ? '—' : cell, cellWidths[index] - 12); });
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
    const overviewRows = sections.map(section => ({ ...section, pages: pages.map((cards, index) => cards.some(card => card.groupId === section.id) ? index : -1).filter(index => index >= 0) }));
    const overview = [];
    if (entities.length && settings.groupBy !== 'none' && (settings.overview === 'yes' || settings.overview === 'auto' && groups.length >= 3)) {
      let rows = [], used = 32;
      for (const section of overviewRows) {
        const lines = wrap(section.title, printableWidth * .34, 11, true);
        const details = wrap(`${section.items.length} ${snapshot.scope} · ${section.fields} ${t('print.rows')} · ${section.responsibility || '—'}`, printableWidth * .46, 9);
        const row = { ...section, lines, details, height: Math.max(lines.length * 15, details.length * 12) + 16 };
        if (used + row.height > bodyHeight && rows.length) { overview.push(rows); rows = []; used = 32; }
        if (used + row.height > bodyHeight) throw new Error(snapshot.labels.tooLong);
        rows.push(row); used += row.height;
      }
      if (rows.length) overview.push(rows);
      for (let index = 0; index < overview.length; index++) { pages.unshift([]); pageHeadings.unshift([]); listHeadings.unshift([]); }
    }
    return { width, height, margin, gap, pad, fontSize, lineHeight, bodyTop, bodyBottom, columns, keys, cellWidths, columnLabels,
      title, scope, organisation, titleWidth, brandWidth, footer, footerWidths, footerY, legend, legendY, classification, confidential,
      pages, pageHeadings, listHeadings, continuousList, tiles, overview, entityCount: entities.length, fieldCount,
      emptyMessage: diagram.filteredEntities(snapshot, settings).length ? snapshot.labels.noSelection : snapshot.labels.noFilterMatches };
  };

  diagram.pageSvg = function (snapshot, settings, layout, pageIndex, palette, logo) {
    const { width, height, margin, pad, lineHeight, fontSize } = layout, shapes = [], t = (key, params) => diagram.t(snapshot, key, params);
    const rect = (x, y, w, h, fill, stroke = 'none') => shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`);
    const line = (x1, y1, x2, y2, color = palette.border, weight = .5) => shapes.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${weight}"/>`);
    const write = (lines, x, y, size, bold = false, color = palette.text, leading = size * 1.4, anchor = 'start') => lines.forEach((value, i) => shapes.push(`<text x="${x}" y="${y + i * leading}" font-size="${size}" font-weight="${bold ? 700 : 400}" fill="${color}" text-anchor="${anchor}">${ui.esc(value)}</text>`));
    const columnHeader = (x, y, w, h) => {
      rect(x, y, w, h, palette.surface);
      layout.columnLabels.forEach((label, index) => { write([label], x + 6, y + 14, 8, true); x += layout.cellWidths[index]; });
    };
    rect(0, 0, width, height, '#ffffff');
    shapes.push(`<g transform="translate(${margin},${margin}) scale(0.48)">${logo}</g>`);
    write(layout.organisation, margin + 30, margin + 9, 9, true, palette.text, 12);
    write([snapshot.application], margin + 30, margin + layout.organisation.length * 12 + 9, 8);
    write(layout.title, width - margin, margin + 16, 16, true, palette.text, 20, 'end');
    write(layout.scope, width - margin, margin + layout.title.length * 20 + 9, 8, false, palette.secondary, 11, 'end');
    if (layout.confidential) write([layout.classification], width - margin, layout.bodyTop - 19, 9, true, palette.text, 12, 'end');
    line(margin, layout.bodyTop - 9, width - margin, layout.bodyTop - 9, palette.text, 1.5);
    for (const heading of layout.pageHeadings[pageIndex]) {
      shapes.push(`<g data-group-id="${ui.esc(heading.groupId)}">`);
      rect(heading.x, heading.y, heading.width, heading.height, palette.text);
      write([heading.label], heading.x + pad, heading.y + 12, 7.5, false, '#ffffff');
      write(heading.lines, heading.x + pad, heading.y + 26, 11, true, '#ffffff', 14);
      write(heading.details, heading.x + heading.width - pad, heading.y + 12, 8, false, '#ffffff', 11, 'end');
      shapes.push('</g>');
    }
    if (layout.overview[pageIndex]) {
      write([t('print.overview')], margin, layout.bodyTop + 16, 14, true);
      let y = layout.bodyTop + 32;
      for (const [index, row] of layout.overview[pageIndex].entries()) {
        if (index % 2 === 0) rect(margin, y, width - margin * 2, row.height, palette.zebra);
        write(row.lines, margin + pad, y + 16, 11, true, palette.text, 15);
        write(row.details, margin + (width - margin * 2) * .36, y + 15, 9, false, palette.secondary, 12);
        const first = row.pages[0] + layout.overview.length + 1, last = row.pages.at(-1) + layout.overview.length + 1;
        write([`${t('diagram.page')} ${first}${last === first ? '' : '–' + last}`], width - margin - pad, y + 16, 9, false, palette.text, 12, 'end');
        y += row.height;
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
        const footerTop = y + card.height - card.inset - card.footerHeight;
        write(card.summary, left, footerTop + 10, 8, false, palette.secondary, 11);
        const badgeX = x + card.width - card.inset - card.badgeWidth, badgeHeight = card.status.length * 11 + 4;
        shapes.push(`<rect x="${badgeX}" y="${footerTop}" width="${card.badgeWidth}" height="${badgeHeight}" rx="${badgeHeight / 2}" fill="${palette[card.entity.statusTone] || palette.text}"/>`);
        write(card.status, badgeX + 6, footerTop + 10, 8, true, '#ffffff', 11);
        shapes.push('</g>'); continue;
      }
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
      let rowY = y + card.headerHeight;
      if (card.rowHeaderHeight) columnHeader(x, rowY, card.width, card.rowHeaderHeight);
      let cellX = x;
      rowY += card.rowHeaderHeight;
      if (!card.rows.length) write([snapshot.labels.emptyFields], x + pad, rowY + 16, fontSize, false, palette.secondary);
      for (const [index, row] of card.rows.entries()) {
        if (index % 2 === 0) rect(x, rowY, card.width, row.height, palette.zebra);
        shapes.push(`<g data-row-id="${ui.esc(row.id)}">`); cellX = x;
        row.cells.forEach((cell, i) => { write(cell, cellX + 6, rowY + fontSize + 1, fontSize, false, palette.text, lineHeight); cellX += layout.cellWidths[i]; });
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
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}" font-family="Noto Sans Export" letter-spacing="0" font-kerning="none" role="img" aria-label="${ui.esc(settings.title || snapshot.title)} · ${ui.esc(t('diagram.page'))} ${pageIndex + 1}"><title>${ui.esc(settings.title || snapshot.title)}</title>${shapes.join('')}</svg>`;
  };
})(window.DK);
