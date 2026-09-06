/* On-demand PDF assets and vector conversion; diagram-layout.js owns page content. */
(function (DK) {
  'use strict';
  const pdf = {}, scripts = new Map();
  let loading;
  function script(url) {
    if (!scripts.has(url)) scripts.set(url, new Promise((resolve, reject) => {
      const el = document.createElement('script');
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true; clearTimeout(timer); scripts.delete(url); el.remove(); reject(new Error('PDF asset could not be loaded: ' + url));
      };
      const timer = setTimeout(fail, 20000);
      el.onload = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } };
      el.onerror = fail; el.src = url; document.head.appendChild(el);
    }));
    return scripts.get(url);
  }
  async function asset(url, binary = false) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('PDF asset request failed: ' + url);
      return await (binary ? response.arrayBuffer() : response.text());
    } finally { clearTimeout(timer); }
  }
  function base64(buffer) {
    const bytes = new Uint8Array(buffer); let result = '';
    for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(result);
  }
  pdf.load = function () {
    if (!loading) loading = (async () => {
      const [fonts, logo] = await Promise.all([
        Promise.all(['Regular', 'Bold'].map(async (weight, i) => {
          const buffer = await asset(`assets/fonts/pdf/NotoSans-${weight}.ttf`, true);
          const face = await new FontFace('Noto Sans Export', buffer, { weight: i ? '700' : '400' }).load();
          return { face, file: `NotoSans-${weight}.ttf`, style: i ? 'bold' : 'normal', data: base64(buffer) };
        })),
        asset('assets/swiss-logo-flag.svg'),
        (async () => { await script('vendor/jspdf/jspdf.umd.min.js'); await script('vendor/svg2pdf.js/svg2pdf.umd.min.js'); })(),
      ]);
      fonts.forEach(font => document.fonts.add(font.face));
      const svg = new DOMParser().parseFromString(logo, 'image/svg+xml');
      const logoPaths = [...svg.querySelectorAll('path')].map(path => `<path d="${DK.ui.esc(path.getAttribute('d'))}" fill="${DK.ui.esc(path.getAttribute('fill'))}"/>`).join('');
      return { fonts, logo: logoPaths };
    })().catch(error => { loading = null; throw error; });
    return loading;
  };
  pdf.create = function (assets, layout = { width: 1190.55, height: 841.89 }) {
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: [layout.width, layout.height], orientation: layout.width > layout.height ? 'landscape' : 'portrait', putOnlyUsedFonts: true, compress: true });
    for (const font of assets.fonts) { doc.addFileToVFS(font.file, font.data); doc.addFont(font.file, 'Noto Sans Export', font.style); }
    return doc;
  };
  pdf.measure = assets => {
    const doc = pdf.create(assets), widths = new Map();
    return (value, size, bold = false) => {
      const text = String(value), key = `${size}:${bold ? 1 : 0}:${text}`;
      if (widths.has(key)) return widths.get(key);
      doc.setFont('Noto Sans Export', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      const width = doc.getTextWidth(text);
      // Bounded per workspace; changing language or closing cannot retain a global catalog cache.
      if (widths.size >= 5000) widths.delete(widths.keys().next().value);
      widths.set(key, width);
      return width;
    };
  };
  pdf.palette = () => {
    const css = getComputedStyle(document.documentElement);
    return Object.fromEntries(Object.entries({ text: 'text', secondary: 'text-secondary', surface: 'surface', border: 'border-strong', zebra: 'ancestor', success: 'success', warning: 'warning', neutral: 'neutral' }).map(([key, token]) => [key, css.getPropertyValue('--ob-color-' + token).trim()]));
  };
  pdf.generate = async function (assets, snapshot, settings, layout, palette, { active = () => true, progress = () => {} } = {}) {
    const assertActive = () => { if (!active()) throw new DOMException('Export cancelled', 'AbortError'); };
    assertActive();
    const doc = pdf.create(assets, layout), source = DK.diagram.manifest(snapshot, settings);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(source)));
    const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    assertActive();
    doc.setCreationDate(new Date(snapshot.createdAt));
    doc.setProperties({ title: settings.title || snapshot.title, author: snapshot.organisation, subject: snapshot.scope,
      creator: snapshot.application, keywords: `documentId=${settings.documentId}; version=${settings.version}; template=${source.templateVersion}; snapshot-sha256=${hash}` });
    doc.setLanguage(snapshot.language);
    const host = document.createElement('div'); host.className = 'ob-pdf-render'; host.setAttribute('aria-hidden', 'true'); document.body.appendChild(host);
    try {
      for (let i = 0; i < layout.pages.length; i++) {
        assertActive();
        progress(i + 1, layout.pages.length);
        if (i) doc.addPage([layout.width, layout.height], settings.orientation);
        host.innerHTML = DK.diagram.pageSvg(snapshot, settings, layout, i, palette, assets.logo);
        await doc.svg(host.firstElementChild, { x: 0, y: 0, width: layout.width, height: layout.height });
        assertActive();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      assertActive();
      return doc.output('blob');
    } finally { host.remove(); }
  };
  DK.pdf = pdf;
})(window.DK);
