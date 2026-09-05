/* graph.js — relationship layout and viewport interactions. No third-party graph dependency. */
(function (DK) {
  'use strict';
  const ui = DK.ui, data = DK.data, t = ui.t, esc = ui.esc, icon = ui.icon;
  const graph = {}, PAGE_SIZE = 6, PANEL = 320, HUB = 216, GAP = 80, PAD = 24;
  let current = null, observer = null, drag = null, fullscreen = null, suppressClick = false, pinch = null;
  const touches = new Map();
  const $ = id => document.getElementById(id);
  graph.createState = () => ({ x: 0, y: 0, zoom: 1, autoFit: true, mode: 'pan', selected: null, pages: {} });

  /** Panels have bounded heights; the two columns are balanced without intersecting the hub. */
  graph.layout = function (entity, state = {}, narrow = false, availableWidth = PANEL + PAD * 2) {
    const groups = data.relations(entity.kind, entity).filter(g => g.items.length);
    const columns = [[], []], heights = [0, 0];
    const panels = groups.map(group => {
      const rows = Math.ceil(Math.min(PAGE_SIZE, group.items.length) / (narrow ? 1 : 2));
      const height = 60 + rows * (narrow ? 48 : 60) + (group.items.length > PAGE_SIZE ? (narrow ? 48 : 40) : 0);
      const side = heights[0] <= heights[1] ? 0 : 1;
      const pages = Math.ceil(group.items.length / PAGE_SIZE);
      const page = Math.max(0, Math.min(pages - 1, state.pages?.[group.key] || 0));
      const panel = { group, width: PANEL, height, side, page, pages, y: heights[side] };
      columns[side].push(panel); heights[side] += height + 24;
      return panel;
    });
    if (narrow) {
      const width = Math.max(240, Math.min(PANEL + PAD * 2, availableWidth - 32));
      const hub = { x: (width - HUB) / 2, y: PAD, width: HUB, height: 116 };
      let y = hub.y + hub.height + 32;
      panels.forEach(p => { p.x = 12; p.y = y; p.side = 2; p.width = width - 24; y += p.height + 24; });
      return { panels, hub, width, height: y + PAD, narrow: true, availableWidth };
    }
    const height = Math.max(240, ...heights.map(h => h ? h - 24 : 0)) + PAD * 2;
    const width = (columns[0].length ? PANEL + GAP : 0) + (columns[1].length ? PANEL + GAP : 0) + HUB + PAD * 2;
    const hub = { x: PAD + (panels.length ? PANEL + GAP : 0), y: (height - 116) / 2, width: HUB, height: 116 };
    columns.forEach((column, side) => column.forEach(panel => {
      panel.x = side ? hub.x + HUB + GAP : PAD;
      panel.y += (height - (heights[side] - 24)) / 2;
    }));
    return { panels, hub, width, height, narrow: false };
  };

  const control = (action, glyph, label, extra = '') => `<button type="button" class="ob-button ob-button--icon" data-action="graph-${action}" aria-label="${esc(t('graph.' + label))}" title="${esc(t('graph.' + label))}"${extra}>${icon(glyph, 'lg')}</button>`;
  graph.render = function (entity, state) {
    return `<section class="ob-graph-shell" id="graph-shell" aria-label="${esc(t('graph.label'))}">
      <div class="ob-graph-toolbar" role="group" aria-label="${esc(t('graph.controls'))}">
        ${control('zoom-in', 'zoom_in', 'zoomIn')}${control('zoom-out', 'zoom_out', 'zoomOut')}${control('fit', 'graph_fit', 'fit')}
        <button type="button" class="ob-button ob-graph-zoom" data-action="graph-actual" title="${esc(t('graph.actual'))}" aria-label="${esc(t('graph.actual'))}"><output id="graph-zoom">100%</output></button>
        <span class="ob-graph-toolbar-divider" aria-hidden="true"></span>
        ${control('pan', 'graph_pan', 'pan', ` aria-pressed="${state.mode === 'pan'}"`)}${control('select', 'graph_select', 'select', ` aria-pressed="${state.mode === 'select'}"`)}
        <div class="ob-graph-pan-pad" role="group" aria-label="${esc(t('graph.pan'))}">${control('left', 'chevron_left', 'left')}${control('up', 'chevron_right', 'up')}${control('down', 'chevron_right', 'down')}${control('right', 'chevron_right', 'right')}</div>
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
    const edges = panels.map(p => {
      if (layout.narrow) return `<path class="ob-graph-line${state.selected?.group === p.group.key ? ' is-selected' : ''}" d="M${hub.x},${hub.y + hub.height / 2} H8 V${p.y + p.height / 2} H${p.x}"/>`;
      const fromX = p.side ? hub.x + hub.width : hub.x;
      const toX = p.side ? p.x : p.x + p.width;
      const midX = (fromX + toX) / 2;
      return `<path class="ob-graph-line${state.selected?.group === p.group.key ? ' is-selected' : ''}" d="M${fromX},${hub.y + hub.height / 2} H${midX} V${p.y + p.height / 2} H${toX}"/>`;
    }).join('');
    const center = `<div class="ob-graph-hub" title="${esc(current.entity.name)}" style="left:${hub.x}px;top:${hub.y}px;width:${hub.width}px;height:${hub.height}px">${icon(data.kindDef(current.entity.kind).icon, '2xl')}<strong>${esc(current.entity.name)}</strong><span>${esc(data.kindDef(current.entity.kind).singular)}</span></div>`;
    const cards = panels.map(p => {
      const from = p.page * PAGE_SIZE;
      const items = p.group.items.slice(from, from + PAGE_SIZE).map((item, i) => {
        const selected = state.selected?.group === p.group.key && state.selected.index === from + i;
        return `<button type="button" class="ob-graph-node${selected ? ' is-selected' : ''}" data-action="graph-node" data-group="${esc(p.group.key)}" data-index="${from + i}" aria-pressed="${selected}" title="${esc(item.name + (item.sub ? ' · ' + item.sub : ''))}">${icon(p.group.icon)}<span>${esc(item.name)}</span></button>`;
      }).join('');
      const pager = p.pages > 1 ? `<div class="ob-graph-group-pager"><span>${esc(t('graph.range', { from: from + 1, to: Math.min(from + PAGE_SIZE, p.group.items.length), total: p.group.items.length }))}</span><button type="button" class="ob-button ob-button--icon" data-action="graph-page" data-group="${esc(p.group.key)}" data-page="${p.page - 1}" aria-label="${esc(t('graph.previous', { group: p.group.title }))}"${p.page === 0 ? ' disabled' : ''}>${icon('chevron_left', 'sm')}</button><button type="button" class="ob-button ob-button--icon" data-action="graph-page" data-group="${esc(p.group.key)}" data-page="${p.page + 1}" aria-label="${esc(t('graph.next', { group: p.group.title }))}"${p.page === p.pages - 1 ? ' disabled' : ''}>${icon('chevron_right', 'sm')}</button></div>` : '';
      return `<section class="ob-graph-group" data-group="${esc(p.group.key)}" style="left:${p.x}px;top:${p.y}px;width:${p.width}px;height:${p.height}px"><h3>${icon(p.group.icon)}<span>${esc(p.group.title)}</span><span class="ob-graph-count">${p.group.items.length}</span></h3><div class="ob-graph-nodes">${items}</div>${pager}</section>`;
    }).join('');
    return `<svg class="ob-graph-svg" width="${width}" height="${height}" aria-hidden="true">${edges}</svg>${center}${cards}`;
  }

  function draw() {
    if (!current || !$('graph-canvas')) return;
    const { state, entity } = current;
    current.layout = graph.layout(entity, state, $('graph').clientWidth < 640, $('graph').clientWidth);
    const canvas = $('graph-canvas');
    canvas.dataset.narrow = String(current.layout.narrow);
    canvas.style.width = current.layout.width + 'px'; canvas.style.height = current.layout.height + 'px';
    canvas.innerHTML = canvasHtml(current.layout, state);
    selection();
  }
  function selection() {
    const chosen = current.state.selected;
    const group = current.layout.panels.find(p => p.group.key === chosen?.group)?.group;
    const item = group?.items[chosen.index];
    $('graph-selection').innerHTML = item
      ? `<div><strong>${esc(item.name)}</strong><span>${esc(group.title)}${item.sub ? ' · ' + esc(item.sub) : ''}</span></div>${ui.link(item.href, `${esc(t('graph.open'))} ${icon(item.external ? 'link_external' : 'arrow_right', 'sm')}`, { className: 'ob-inline-link', external: item.external })}<button type="button" class="ob-button ob-button--icon" data-action="graph-clear" aria-label="${esc(t('graph.clear'))}">${icon('xmark')}</button>`
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
  function fit() {
    if (!current || !$('graph')?.clientWidth) return;
    const viewport = $('graph'), g = current.state, layout = current.layout;
    g.zoom = Math.max(0.15, Math.min(1, (viewport.clientWidth - 32) / layout.width, layout.narrow ? 1 : (viewport.clientHeight - 32) / layout.height));
    g.x = (viewport.clientWidth - layout.width * g.zoom) / 2;
    g.y = layout.narrow ? 16 : (viewport.clientHeight - layout.height * g.zoom) / 2;
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

  graph.resize = function () {
    if (!current || !$('graph-shell')?.checkVisibility()) return;
    const shell = $('graph-shell');
    // CSS owns the minimum height and bottom spacing; JS supplies viewport geometry.
    if (!fullscreen) shell.style.height = `calc(${window.innerHeight - Math.max(0, shell.getBoundingClientRect().top)}px - var(--ob-space-default))`;
    if (current.layout.narrow !== ($('graph').clientWidth < 640) || (current.layout.narrow && current.layout.availableWidth !== $('graph').clientWidth)) { draw(); current.state.autoFit = true; }
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
