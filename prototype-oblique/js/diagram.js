/* Immutable diagram content, physical page layout and shared SVG document template. */
(function (DK) {
  'use strict';
  const { ui, diagram } = DK;
  const text = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/gu, ' ').trim();

  /** Physical text wrapping also splits long technical identifiers without inserting hyphens. */
  diagram.wrap = function (value, width, size, bold, measure) {
    const words = text(value).split(' '), lines = [];
    let line = '';
    for (const word of words) {
      if (measure((line ? line + ' ' : '') + word, size, bold) <= width) { line += (line ? ' ' : '') + word; continue; }
      if (line) { lines.push(line); line = ''; }
      if (measure(word, size, bold) <= width) { line = word; continue; }
      for (const character of word) {
        if (line && measure(line + character, size, bold) > width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    if (line || !lines.length) lines.push(line);
    return lines;
  };

  diagram.manifest = (snapshot, settings) => {
    const entities = diagram.exportEntities(snapshot, settings);
    return { templateVersion: diagram.templateVersion,
      renderer: { jspdf: '4.2.1', svg2pdf: '2.8.1', fontCommit: 'ffebf8c1ee449e544955a7e813c54f9b73848eac' },
      snapshot: { ...snapshot, entities }, settings: { ...settings, filters: { ...settings.filters }, selected: entities.map(entity => entity.id) } };
  };
  DK.diagram = diagram;
})(window.DK);
