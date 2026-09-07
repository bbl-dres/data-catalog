/* Immutable diagram content, physical page layout and shared SVG document template. */
(function (DK) {
  'use strict';
  const { ui, diagram } = DK;
  const text = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/gu, ' ').trim();

  /** Physical text wrapping also splits long technical identifiers without inserting hyphens.
   *  Widths are additive (the measurer sums glyph advances), so each word is measured once and lines
   *  accumulate; measuring every growing line prefix defeated the measurer's cache. */
  diagram.wrap = function (value, width, size, bold, measure) {
    const words = text(value).split(' '), lines = [], space = measure(' ', size, bold), fit = 1e-6; // summed widths differ from whole-line widths by rounding only
    let line = '', lineWidth = 0;
    const push = () => { lines.push(line); line = ''; lineWidth = 0; };
    for (const word of words) {
      const wordWidth = measure(word, size, bold), joinedWidth = line ? lineWidth + space + wordWidth : wordWidth;
      if (joinedWidth <= width + fit) { line += (line ? ' ' : '') + word; lineWidth = joinedWidth; continue; }
      if (line) push();
      if (wordWidth <= width + fit) { line = word; lineWidth = wordWidth; continue; }
      for (const character of word) {
        const characterWidth = measure(character, size, bold);
        if (line && lineWidth + characterWidth > width + fit) push();
        line += character; lineWidth += characterWidth;
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
