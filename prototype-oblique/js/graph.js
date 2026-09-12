/* graph.js — relationship layout and viewport interactions. No third-party graph dependency. */
(function (DK) {
  'use strict';
  const ui = DK.ui, data = DK.data, t = ui.t, esc = ui.esc, icon = ui.icon;
  const graph = {}, PAGE_SIZE = 6, PHONE_PAGE_SIZE = 3, PAD = 24;
  // Geometry is shared with CSS through canvas custom properties, in unscaled pixels.
  // A node holds a 22px icon above two 16px label lines inside its padding and border.
  const NODE_WIDTH = 96, NODE_HEIGHT = 64, NODE_GAP = 8, HALO = 16;
  const HUB_SIZE = 100, LABEL_WIDTH = 220, LABEL_HEIGHT = 20, LABEL_GAP = 8, PAGER_HEIGHT = 48;
  let current = null, observer = null, drag = null, fullscreen = null, suppressClick = false, pinch = null;
  const touches = new Map();
  const $ = id => document.getElementById(id);
  graph.createState = () => ({ x: 0, y: 0, zoom: 1, autoFit: true, mode: 'pan', selected: null, pages: {} });

  /** Orbit spacing accounts for whole bubbles, their captions and paging controls. */
  graph.layout = function (entity, state = {}, narrow = false, availableWidth = 640, availableHeight = 640) {
    const groups = data.relations(entity.kind, entity).filter(g => g.items.length);
    const pageSize = narrow ? PHONE_PAGE_SIZE : PAGE_SIZE;
    const panels = groups.map(group => {
      const count = Math.min(pageSize, group.items.length), columns = Math.min(2, count), rows = Math.ceil(count / columns);
      const gridWidth = columns * NODE_WIDTH + (columns - 1) * NODE_GAP;
      const gridHeight = rows * NODE_HEIGHT + (rows - 1) * NODE_GAP;
      // The complete grid rectangle fits within the inner circle, including focus rings.
      const diameter = Math.ceil(Math.hypot(gridWidth, gridHeight) + 2 * HALO + 8);
      const pages = Math.ceil(group.items.length / pageSize);
      const page = Math.max(0, Math.min(pages - 1, state.pages?.[group.key] || 0));
      return { group, width: Math.max(LABEL_WIDTH, diameter), height: diameter + LABEL_GAP + LABEL_HEIGHT + (pages > 1 ? PAGER_HEIGHT : 0), diameter, gridWidth, gridHeight, page, pages, pageSize };
    });
    const hub = { x: -LABEL_WIDTH / 2, y: -HUB_SIZE / 2, width: LABEL_WIDTH, height: HUB_SIZE + LABEL_GAP + LABEL_HEIGHT, diameter: HUB_SIZE };
    if (narrow) {
      // Keep circular groups readable on phones instead of shrinking the entire orbit.
      const width = Math.max(LABEL_WIDTH, ...panels.map(p => p.width)) + PAD * 2;
      hub.x = (width - hub.width) / 2; hub.y = PAD;
      let y = hub.y + hub.height + PAD;
      panels.forEach(p => { p.x = (width - p.width) / 2; p.y = y; y += p.height + PAD; });
      return { panels, hub, width, height: y + PAD, narrow: true, availableWidth, availableHeight };
    }
    const overlaps = (a, b) => a.x < b.x + b.width + PAD && b.x < a.x + a.width + PAD && a.y < b.y + b.height + PAD && b.y < a.y + a.height + PAD;
    const aspect = Math.sqrt(Math.max(1, Math.min(2, availableWidth / Math.max(1, availableHeight))));
    const position = radius => panels.forEach((p, i) => {
      const angle = (2 * Math.PI * i / panels.length) + (panels.length === 2 ? Math.PI : -Math.PI / 2);
      p.x = radius * aspect * Math.cos(angle) - p.width / 2;
      p.y = radius / aspect * Math.sin(angle) - p.diameter / 2;
    });
    let radius = 160;
    position(radius);
    while (panels.some((p, i) => overlaps(p, hub) || panels.slice(i + 1).some(other => overlaps(p, other)))) position(radius += 8);
    const boxes = [hub, ...panels];
    const left = Math.min(...boxes.map(p => p.x)), top = Math.min(...boxes.map(p => p.y));
    const width = Math.max(...boxes.map(p => p.x + p.width)) - left + PAD * 2;
    const height = Math.max(...boxes.map(p => p.y + p.height)) - top + PAD * 2;
    boxes.forEach(p => { p.x += PAD - left; p.y += PAD - top; });
    return { panels, hub, width, height, narrow: false, availableWidth, availableHeight };
  };

  const control = (action, glyph, label, extra = '') => `<button type="button" class="ob-button ob-button--icon" data-action="graph-${action}" aria-label="${esc(t('graph.' + label))}" title="${esc(t('graph.' + label))}"${extra}>${icon(glyph, 'lg')}</button>`;
  graph.render = function (entity, state) {
    return `<section class="ob-graph-shell" id="graph-shell" aria-label="${esc(t('graph.label'))}">
      <div class="ob-graph-toolbar" role="group" aria-label="${esc(t('graph.controls'))}">
        <div class="ob-graph-toolbar-group">${control('zoom-in', 'zoom_in', 'zoomIn')}${control('zoom-out', 'zoom_out', 'zoomOut')}${control('fit', 'graph_fit', 'fit')}<button type="button" class="ob-button ob-graph-zoom" data-action="graph-actual" title="${esc(t('graph.actual'))}" aria-label="${esc(t('graph.actual'))}"><output id="graph-zoom">100%</output></button></div>
        <div class="ob-graph-toolbar-group">${control('pan', 'graph_pan', 'pan', ` aria-pressed="${state.mode === 'pan'}"`)}${control('select', 'graph_select', 'select', ` aria-pressed="${state.mode === 'select'}"`)}</div>
        <div class="ob-graph-toolbar-group ob-graph-pan-pad" role="group" aria-label="${esc(t('graph.pan'))}">${control('left', 'chevron_left', 'left')}${control('up', 'chevron_right', 'up')}${control('down', 'chevron_right', 'down')}${control('right', 'chevron_right', 'right')}</div>
        ${control('fullscreen', 'expand', 'fullscreen', ' aria-expanded="false"')}
      </div>
      <div class="ob-graph" id="graph" tabindex="0" role="region" aria-label="${esc(t('graph.label'))}" aria-describedby="graph-hint" data-mode="${state.mode}">
        <div class="ob-graph-canvas" id="graph-canvas"></div>
      </div>
      <div class="ob-graph-selection" id="graph-selection" role="status" aria-live="polite"></div>
      <p class="ob-graph-hint" id="graph-hint">${esc(t('graph.hint'))}</p>
    </section>`;
  };

  function canvasHtml(layout, state) {
    const { hub, panels, width, height } = layout;
    const cx = hub.x + hub.width / 2, cy = hub.y + hub.diameter / 2;
    const edges = panels.map(p => {
      const x = p.x + p.width / 2, y = p.y + p.diameter / 2;
      // On phones each association curves around preceding bubbles to the same hub.
      const path = layout.narrow ? `M${cx},${cy} C0,${cy} 0,${y} ${x},${y}` : `M${cx},${cy} L${x},${y}`;
      return `<path class="ob-graph-line${state.selected?.group === p.group.key ? ' is-selected' : ''}" d="${path}"/>`;
    }).join('');
    const center = `<div class="ob-graph-hub" title="${esc(current.entity.name)}" style="left:${hub.x}px;top:${hub.y}px;width:${hub.width}px;height:${hub.height}px"><div class="ob-graph-hub-orbit"><div class="ob-graph-hub-circle">${icon(data.kindDef(current.entity.kind).icon, '3xl')}</div></div><strong>${esc(current.entity.name)}</strong></div>`;
    const cards = panels.map(p => {
      const from = p.page * p.pageSize;
      const items = p.group.items.slice(from, from + p.pageSize).map((item, i) => {
        const selected = state.selected?.group === p.group.key && state.selected.index === from + i;
        return `<button type="button" class="ob-graph-node${selected ? ' is-selected' : ''}" data-action="graph-node" data-group="${esc(p.group.key)}" data-index="${from + i}" aria-pressed="${selected}" title="${esc(item.name + (item.sub ? ' · ' + item.sub : ''))}">${icon(p.group.icon, '2xl')}<span>${esc(item.name)}</span></button>`;
      }).join('');
      const pager = p.pages > 1 ? `<div class="ob-graph-group-pager"><span>${esc(t('graph.range', { from: from + 1, to: Math.min(from + p.pageSize, p.group.items.length), total: p.group.items.length }))}</span><button type="button" class="ob-button ob-button--icon" data-action="graph-page" data-group="${esc(p.group.key)}" data-page="${p.page - 1}" aria-label="${esc(t('graph.previous', { group: p.group.title }))}"${p.page === 0 ? ' disabled' : ''}>${icon('chevron_left', 'sm')}</button><button type="button" class="ob-button ob-button--icon" data-action="graph-page" data-group="${esc(p.group.key)}" data-page="${p.page + 1}" aria-label="${esc(t('graph.next', { group: p.group.title }))}"${p.page === p.pages - 1 ? ' disabled' : ''}>${icon('chevron_right', 'sm')}</button></div>` : '';
      return `<section class="ob-graph-group" data-group="${esc(p.group.key)}" aria-label="${esc(p.group.title)}" style="left:${p.x}px;top:${p.y}px;width:${p.width}px;height:${p.height}px;--ob-graph-bubble-size:${p.diameter}px;--ob-graph-grid-width:${p.gridWidth}px;--ob-graph-grid-height:${p.gridHeight}px">
        <div class="ob-graph-bubble"><div class="ob-graph-bubble-inner"><div class="ob-graph-nodes">${items}</div></div><span class="ob-graph-count">${p.group.items.length}</span></div>
        <h3 title="${esc(p.group.title)}">${esc(p.group.title)}</h3>${pager}</section>`;

    }).join('');
    return `<svg class="ob-graph-svg" width="${width}" height="${height}" aria-hidden="true">${edges}</svg>${center}${cards}`;
  }

  function draw() {
    if (!current || !$('graph-canvas')) return;
    const { state, entity } = current;
    current.layout = graph.layout(entity, state, $('graph').clientWidth < 640, $('graph').clientWidth, $('graph').clientHeight);
    const canvas = $('graph-canvas');
    canvas.dataset.narrow = String(current.layout.narrow);
    const metrics = { 'node-width': NODE_WIDTH, 'node-height': NODE_HEIGHT, 'node-gap': NODE_GAP, halo: HALO, 'hub-size': HUB_SIZE, 'label-height': LABEL_HEIGHT, 'label-gap': LABEL_GAP, 'pager-height': PAGER_HEIGHT };
    Object.entries(metrics).forEach(([key, value]) => canvas.style.setProperty('--ob-graph-' + key, value + 'px'));
    canvas.style.width = current.layout.width + 'px'; canvas.style.height = current.layout.height + 'px';
    canvas.innerHTML = canvasHtml(current.layout, state);
    selection();
  }
  function selection() {
    const chosen = current.state.selected;
    const group = current.layout.panels.find(p => p.group.key === chosen?.group)?.group;
    const item = group?.items[chosen.index];
    $('graph-selection').innerHTML = item
      ? `<div><strong>${esc(item.name)}</strong><span>${esc(group.title)}${item.sub ? ' · ' + esc(item.sub) : ''}</span></div><div class="ob-graph-selection-actions">${ui.link(item.href, `${esc(t('graph.open'))}&nbsp;${icon(item.external ? 'link_external' : 'arrow_right', 'sm')}`, { className: 'ob-inline-link', external: item.external })}<button type="button" class="ob-button ob-button--icon" data-action="graph-clear" aria-label="${esc(t('graph.clear'))}">${icon('xmark')}</button></div>`
      : `<span>${esc(t(current.layout.panels.length ? 'graph.choose' : 'detail.noRelations'))}</span>`;
  }

  function transform() {
    if (!current || !$('graph-canvas')) return;
    const g = current.state;
    $('graph-canvas').style.transform = `translate(${g.x}px, ${g.y}px) scale(${g.zoom})`;
    $('graph-zoom').textContent = Math.round(g.zoom * 100) + '%';
    $('graph').dataset.mode = g.mode;
    document.querySelectorAll('[data-action="graph-pan"], [data-action="graph-select"]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.action === 'graph-' + g.mode)));
    document.querySelector('[data-action="graph-zoom-in"]').disabled = g.zoom >= 2;
    document.querySelector('[data-action="graph-zoom-out"]').disabled = g.zoom <= 0.15;
  }
  /** Fits the layout at up to 100 %, but never below the CSS fit floor: a diagram that would become illegible starts at its first group, centred on the hub, and pans instead. */
  function fit() {
    if (!current || !$('graph')?.clientWidth) return;
    const viewport = $('graph'), g = current.state, layout = current.layout;
    const floor = parseFloat(getComputedStyle($('graph-shell')).getPropertyValue('--ob-graph-fit-min-zoom')) || 0.15;
    const fitted = Math.min(1, (viewport.clientWidth - (layout.narrow ? 0 : 32)) / layout.width, layout.narrow ? 1 : (viewport.clientHeight - 32) / layout.height);
    g.zoom = Math.max(0.15, floor, fitted);
    const overflow = g.zoom > fitted && !layout.narrow;
    g.x = overflow ? viewport.clientWidth / 2 - (layout.hub.x + layout.hub.width / 2) * g.zoom : (viewport.clientWidth - layout.width * g.zoom) / 2;
    g.y = layout.narrow || overflow ? 16 : (viewport.clientHeight - layout.height * g.zoom) / 2;
    g.autoFit = true; transform();
  }
  function zoom(value, x, y) {
    if (!current) return;
    const viewport = $('graph'), g = current.state, next = Math.max(0.15, Math.min(2, value));
    x = x ?? viewport.clientWidth / 2; y = y ?? viewport.clientHeight / 2;
    g.x = x - (x - g.x) * next / g.zoom; g.y = y - (y - g.y) * next / g.zoom;
    g.zoom = next; g.autoFit = false; transform();
  }
  function pan(dx, dy) { const g = current.state; g.x += dx; g.y += dy; g.autoFit = false; transform(); }

  /** The inline shell grows with its content; its minimum is the remaining viewport height, capped once the whole layout fits at 100 %. */
  function bound() {
    const shell = $('graph-shell'), viewport = $('graph');
    if (fullscreen) { shell.style.minHeight = ''; return; }
    const remaining = window.innerHeight - Math.max(0, shell.getBoundingClientRect().top);
    const chrome = shell.offsetHeight - viewport.clientHeight;
    // CSS owns the floor and the bottom spacing; JS supplies viewport and layout geometry.
    shell.style.minHeight = `max(var(--ob-graph-min-height), min(calc(${remaining}px - var(--ob-space-default)), ${current.layout.height + chrome + 2 * PAD}px))`;
  }
  graph.resize = function () {
    if (!current || !$('graph-shell')?.checkVisibility()) return;
    const viewport = $('graph'), changed = () => current.layout.availableWidth !== viewport.clientWidth || current.layout.availableHeight !== viewport.clientHeight;
    bound();
    // A new window size can change the orbit's aspect ratio and, with it, the cap.
    if (changed()) { draw(); current.state.autoFit = true; bound(); }
    if (current.state.autoFit) fit();
  };
  graph.mount = function (entity, state) {
    observer?.disconnect();
    if (!$('graph-shell') || !$('graph-shell').checkVisibility()) { current = null; return; }
    if (fullscreen && current?.entity.identifier === entity?.identifier) {
      current.state = state; observer.observe($('graph')); graph.resize(); return;
    }
    current = { entity, state, layout: null };
    draw(); graph.resize(); transform();
    observer = observer || new ResizeObserver(() => { if (current?.state.autoFit) fit(); });
    observer.observe($('graph'));
    // Ctrl+wheel zoom needs preventDefault, so this listener cannot be passive: it belongs to the viewport, not the document,
    // where it would delay every page scroll. The viewport node is new for every mount and moves as a whole into fullscreen.
    $('graph').addEventListener('wheel', graph.onWheel, { passive: false });
  };

  /** Full-window modal workspace, including on phones; browser chrome is retained. */
  function openFullscreen() {
    if (fullscreen) { graph.closeFullscreen(); return; }
    const shell = $('graph-shell'), placeholder = document.createElement('div'), dialog = document.createElement('dialog');
    placeholder.id = 'graph-placeholder'; placeholder.style.height = shell.offsetHeight + 'px';
    dialog.className = 'ob-graph-fullscreen'; dialog.setAttribute('aria-label', t('graph.label'));
    shell.replaceWith(placeholder); dialog.appendChild(shell); document.body.appendChild(dialog);
    fullscreen = { shell, placeholder, dialog };
    dialog.addEventListener('cancel', e => { e.preventDefault(); graph.closeFullscreen(); });
    document.documentElement.classList.add('ob-graph-modal-open');
    dialog.showModal();
    const button = dialog.querySelector('[data-action="graph-fullscreen"]');
    button.innerHTML = icon('xmark', 'lg'); button.setAttribute('aria-label', t('graph.exitFullscreen')); button.title = t('graph.exitFullscreen'); button.setAttribute('aria-expanded', 'true'); button.focus();
    graph.resize(); fit();
  }
  graph.closeFullscreen = function (restoreFocus = true) {
    if (!fullscreen) return false;
    graph.onPointerUp();
    const { shell, placeholder, dialog } = fullscreen;
    fullscreen = null; placeholder.replaceWith(shell); dialog.close(); dialog.remove();
    document.documentElement.classList.remove('ob-graph-modal-open');
    const button = shell.querySelector('[data-action="graph-fullscreen"]');
    button.innerHTML = icon('expand', 'lg'); button.setAttribute('aria-label', t('graph.fullscreen')); button.title = t('graph.fullscreen'); button.setAttribute('aria-expanded', 'false');
    graph.resize(); fit(); if (restoreFocus) button.focus({ preventScroll: true });
    return true;
  };
  graph.restoreFullscreen = function () {
    // The application can rerender its background at a responsive breakpoint.
    if (fullscreen) document.querySelector('#main #graph-shell')?.replaceWith(fullscreen.placeholder);
  };

  graph.action = function (el, event) {
    if (!current) return;
    const action = el.dataset.action.slice(6), g = current.state;
    if (suppressClick && action === 'node') { event.preventDefault(); return; }
    if (action === 'zoom-in') zoom(g.zoom * 1.2);
    else if (action === 'zoom-out') zoom(g.zoom / 1.2);
    else if (action === 'fit') fit();
    else if (action === 'actual') zoom(1);
    else if (action === 'pan' || action === 'select') { g.mode = action; transform(); }
    else if (action === 'fullscreen') openFullscreen();
    else if (action === 'left') pan(80, 0);
    else if (action === 'right') pan(-80, 0);
    else if (action === 'up') pan(0, 80);
    else if (action === 'down') pan(0, -80);
    else if (action === 'page') {
      g.pages[el.dataset.group] = Number(el.dataset.page);
      const group = el.dataset.group, page = el.dataset.page;
      draw(); if (g.autoFit) fit();
      const panel = document.querySelector(`.ob-graph-group[data-group="${CSS.escape(group)}"]`);
      (panel.querySelector(`[data-page="${CSS.escape(page)}"]:not(:disabled)`) || panel.querySelector('.ob-graph-node'))?.focus({ preventScroll: true });
    } else if (action === 'node' || action === 'clear') {
      g.selected = action === 'node' ? { group: el.dataset.group, index: Number(el.dataset.index) } : null;
      const selector = action === 'node' ? `[data-action="graph-node"][data-group="${CSS.escape(el.dataset.group)}"][data-index="${el.dataset.index}"]` : '#graph';
      draw(); document.querySelector(selector)?.focus({ preventScroll: true });
    }
  };

  graph.onPointerDown = function (e) {
    if (!current || e.button !== 0 || !e.target.closest('#graph') || e.target.closest('button:not(.ob-graph-node)')) return;
    if (e.pointerType === 'touch' && fullscreen) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()], rect = $('graph').getBoundingClientRect(), g = current.state;
        pinch = { distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), zoom: g.zoom, x: ((a.x + b.x) / 2 - rect.left - g.x) / g.zoom, y: ((a.y + b.y) / 2 - rect.top - g.y) / g.zoom };
        drag = null; return;
      }
    }
    if (current.state.mode !== 'pan') return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, px: current.state.x, py: current.state.y, moved: false };
    // Inline touch gestures preserve document scrolling. Fullscreen permits direct canvas panning.
    if (e.pointerType !== 'touch') e.preventDefault();
  };
  graph.onPointerMove = function (e) {
    if (touches.has(e.pointerId) && current) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size === 2) {
        const [a, b] = [...touches.values()], rect = $('graph').getBoundingClientRect(), g = current.state;
        g.zoom = Math.max(.15, Math.min(2, pinch.zoom * Math.hypot(b.x - a.x, b.y - a.y) / pinch.distance));
        g.x = (a.x + b.x) / 2 - rect.left - pinch.x * g.zoom; g.y = (a.y + b.y) / 2 - rect.top - pinch.y * g.zoom;
        g.autoFit = false; suppressClick = true; transform(); return;
      }
    }
    if (!drag || drag.id !== e.pointerId || !current) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; $('graph').setPointerCapture(e.pointerId); $('graph').classList.add('is-dragging');
    current.state.x = drag.px + dx; current.state.y = drag.py + dy; current.state.autoFit = false; transform();
  };
  graph.onPointerUp = function (e) {
    if (e) touches.delete(e.pointerId); else touches.clear();
    if (pinch) { pinch = null; setTimeout(() => { suppressClick = false; }, 250); }
    if (!drag) return;
    suppressClick = drag.moved; setTimeout(() => { suppressClick = false; }, 0);
    const viewport = $('graph');
    if (viewport?.hasPointerCapture(drag.id)) viewport.releasePointerCapture(drag.id);
    viewport?.classList.remove('is-dragging'); drag = null;
  };
  graph.onKeydown = function (e) {
    if (!current || !e.target.closest('#graph-shell')) return false;
    if (e.key === 'Escape' && fullscreen) { e.preventDefault(); graph.closeFullscreen(); return true; }
    if (e.key === 'Escape' && current.state.selected) {
      e.preventDefault(); current.state.selected = null; draw(); $('graph').focus({ preventScroll: true }); return true;
    }
    if (!e.target.closest('#graph') || e.ctrlKey || e.metaKey || e.altKey) return false;
    const actions = { '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', '0': 'fit', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (!actions[e.key]) return false;
    e.preventDefault(); graph.action({ dataset: { action: 'graph-' + actions[e.key] } }, e); return true;
  };
  graph.onWheel = function (e) {
    if (!current || !e.target.closest('#graph') || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); const rect = $('graph').getBoundingClientRect();
    zoom(current.state.zoom * Math.exp(-e.deltaY * 0.002), e.clientX - rect.left, e.clientY - rect.top);
  };
  graph.onFocusin = function (e) {
    if (!current || !e.target.closest('#graph-canvas')) return;
    const viewport = $('graph').getBoundingClientRect(), rect = e.target.getBoundingClientRect();
    const dx = rect.left < viewport.left + 8 ? viewport.left + 8 - rect.left : rect.right > viewport.right - 8 ? viewport.right - 8 - rect.right : 0;
    const dy = rect.top < viewport.top + 8 ? viewport.top + 8 - rect.top : rect.bottom > viewport.bottom - 8 ? viewport.bottom - 8 - rect.bottom : 0;
    if (dx || dy) pan(dx, dy);
  };
  DK.graph = graph;
})(window.DK);
