/* Install a computed-color sampler in the test page. No runtime dependency. */
function installContrast() {
  const parse = value => {
    if (value.startsWith('#')) {
      const hex = value.slice(1); return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(1);
    }
    const channels = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
    return channels.length === 3 ? [...channels, 1] : channels;
  };
  const over = (front, back) => {
    const alpha = front[3] + back[3] * (1 - front[3]);
    return [0, 1, 2].map(i => alpha ? (front[i] * front[3] + back[i] * back[3] * (1 - front[3])) / alpha : 0).concat(alpha);
  };
  const luminance = rgb => rgb.slice(0, 3).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const values = [luminance(a), luminance(b)].sort((x, y) => x - y); return (values[1] + 0.05) / (values[0] + 0.05); };
  const measure = (el, color = getComputedStyle(el).color, opacity = 1) => {
    const path = []; for (let node = el; node; node = node.parentElement) path.unshift(getComputedStyle(node));
    const paint = (index, foreground) => {
      const css = path[index];
      // A CSS mask paints only its glyph; its background color is the ink.
      let layer = index === path.length - 1 && css.maskImage !== 'none' ? [0, 0, 0, 0] : parse(css.backgroundColor);
      if (index < path.length - 1) layer = over(paint(index + 1, foreground), layer);
      else if (foreground) { const ink = parse(color); ink[3] *= opacity; layer = over(ink, layer); }
      layer[3] *= Number(css.opacity); return layer;
    };
    const background = over(paint(0, false), [255, 255, 255, 1]);
    const foreground = over(paint(0, true), [255, 255, 255, 1]);
    return { ratio: ratio(foreground, background), foreground: foreground.slice(0, 3), background: background.slice(0, 3), complex: path.some(css => css.backgroundImage !== 'none') };
  };
  const scan = () => {
    const samples = [], seen = new Set();
    const add = (el, text, css = getComputedStyle(el), opacity = 1) => {
      if (!text.trim() || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || !el.getBoundingClientRect().height || el.closest(':disabled, [aria-disabled="true"], [aria-hidden="true"], script, style, option')) return;
      const result = measure(el, css.color, opacity);
      const threshold = parseFloat(css.fontSize) >= 24 || (parseFloat(css.fontSize) >= 18.6667 && Number(css.fontWeight) >= 700) ? 3 : 4.5;
      const key = [el.className, css.color, result.background, threshold].join('|');
      if (seen.has(key)) return; seen.add(key);
      samples.push({ label: text.trim().slice(0, 65), selector: el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(/\s+/).join('.'), threshold, ...result });
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) add(walker.currentNode.parentElement, walker.currentNode.textContent);
    document.querySelectorAll('input, textarea').forEach(el => {
      if (el.value) add(el, el.value);
      else if (el.placeholder) { const css = getComputedStyle(el, '::placeholder'); add(el, el.placeholder, css, Number(css.opacity)); }
    });
    return { samples: samples.length, failures: samples.filter(s => !s.complex && s.ratio < s.threshold), complex: samples.filter(s => s.complex) };
  };
  window.contrast = { measure, scan, ratio, parse };
}
module.exports = { installContrast };
