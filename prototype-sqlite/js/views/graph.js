// ============================================================
// views/graph: relationship-graph renderer (SVG + zoom/pan canvas).
//
// Exposes renderRelGraph(centerLabel, satellites) and the async
// initializer initRelationshipSVG(). Manages its own DOM event
// listeners and stores a cleanup function in the app.js global
// `relCleanup` so handleRoute can tear down on route change.
//
// Reads the app.js globals relGraphData and relCleanup.
// Depends on components.js (escapeHtml).
// ============================================================

// ── Views: Relationship Graph ─────────────────────────────
function renderRelGraph(centerLabel, satellites) {
  if (satellites.length === 0) return '';
  let html = '<div class="content-section" style="padding:0;overflow:hidden;">';
  html += '<div id="rel-viewport" class="rel-viewport" style="width:100%;height:calc(100vh - 240px);min-height:400px;">';
  html += '<div id="rel-canvas"></div>';
  html += '<div id="rel-tooltip" class="rel-tooltip"></div>';
  html += '<div id="rel-panel" class="rel-panel"></div>';
  html += '</div></div>';
  relGraphData = { conceptName: centerLabel, satellites };
  setTimeout(initRelationshipSVG, 50);
  return html;
}

function initRelationshipSVG() {
  const viewport = document.getElementById('rel-viewport');
  const canvas = document.getElementById('rel-canvas');
  const panel = document.getElementById('rel-panel');
  if (!viewport || !canvas || !relGraphData) return;

  const { conceptName, satellites } = relGraphData;

  const canvasSize = 1000;
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const orbitRadius = 300;
  const minOuterR = 70;
  const perItemR = 25; // extra radius per item
  const ringGap = 20; // constant gap between outer and inner ring (all circles)

  canvas.style.width = canvasSize + 'px';
  canvas.style.height = canvasSize + 'px';
  canvas.style.position = 'absolute';

  // Calculate dynamic radius per satellite based on item count
  // Badge always at -135° (top-left) from satellite center, constant offset from outer ring
  const badgeOffset = 18; // gap from outer ring edge to badge center
  const badgeAngleFixed = -Math.PI * 3 / 4; // -135° = top-left

  const satData = satellites.map((sat, i) => {
    const outerR = Math.max(minOuterR, 50 + sat.items.length * perItemR);
    const innerR = outerR - ringGap;
    const angle = (2 * Math.PI * i / satellites.length) - Math.PI / 2;
    const x = cx + orbitRadius * Math.cos(angle);
    const y = cy + orbitRadius * Math.sin(angle);
    return { sat, x, y, outerR, innerR, angle };
  });

  // SVG: connector lines (center→satellite) + badge connector lines (badge→outer ring)
  let svg = `<svg class="rel-svg" width="${canvasSize}" height="${canvasSize}" xmlns="http://www.w3.org/2000/svg">`;
  satData.forEach(s => {
    // Line from center to satellite
    svg += `<line x1="${cx}" y1="${cy}" x2="${s.x}" y2="${s.y}" stroke="#D8D8D5" stroke-width="1.5"/>`;
    // Badge connector: line from badge center to outer ring edge (both at -135°)
    const badgeDist = s.outerR + badgeOffset;
    const bx = s.x + badgeDist * Math.cos(badgeAngleFixed);
    const by = s.y + badgeDist * Math.sin(badgeAngleFixed);
    const ringX = s.x + s.outerR * Math.cos(badgeAngleFixed);
    const ringY = s.y + s.outerR * Math.sin(badgeAngleFixed);
    svg += `<line x1="${bx}" y1="${by}" x2="${ringX}" y2="${ringY}" stroke="#6B6B66" stroke-width="1.5"/>`;
  });
  svg += '</svg>';

  let html = svg;

  // Center node — use same ringGap
  const centerInnerR = 34;
  const centerOuterR = centerInnerR + ringGap;
  html += `<div class="rel-center" style="left:${cx}px;top:${cy}px;">`;
  html += `<div class="rel-center-outer" style="width:${centerOuterR*2}px;height:${centerOuterR*2}px;">`;
  html += `<div class="rel-center-inner" style="width:${centerInnerR*2}px;height:${centerInnerR*2}px;">`;
  html += '<i data-lucide="box" style="width:26px;height:26px;color:#fff;"></i>';
  html += '</div></div>';
  html += `<div class="rel-center-label">${escapeHtml(conceptName)}</div>`;
  html += '</div>';

  // Satellites
  satData.forEach(s => {
    const outerD = s.outerR * 2;
    const innerD = s.innerR * 2;

    html += `<div class="rel-satellite" data-group="${escapeHtml(s.sat.title)}" style="left:${s.x}px;top:${s.y}px;width:${outerD}px;height:${outerD}px;">`;
    html += `<div class="rel-satellite-outer" style="width:${outerD}px;height:${outerD}px;">`;
    html += `<div class="rel-satellite-inner" style="width:${innerD}px;height:${innerD}px;">`;
    html += '<div class="rel-satellite-items">';

    s.sat.items.forEach(item => {
      const tag = item.href ? 'a' : 'div';
      const hrefAttr = item.href ? ` href="${item.href}/relationships"` : '';
      const meta = item.meta || '';
      html += `<${tag} class="rel-item" data-rel-info="${escapeHtml(item.label)}" data-rel-type="${escapeHtml(s.sat.title)}" data-rel-meta="${escapeHtml(meta)}"${hrefAttr}>`;
      html += `<i data-lucide="${item.icon}" style="width:22px;height:22px;color:${s.sat.color};"></i>`;
      html += `<span class="rel-item-label">${escapeHtml(item.label.length > 14 ? item.label.substring(0, 13) + '\u2026' : item.label)}</span>`;
      html += `</${tag}>`;
    });

    html += '</div></div></div>';
    // Count badge — top-left 45°, constant offset from outer ring
    const badgeDist = s.outerR + badgeOffset;
    const badgeLocalX = s.outerR + badgeDist * Math.cos(badgeAngleFixed) - 12;
    const badgeLocalY = s.outerR + badgeDist * Math.sin(badgeAngleFixed) - 12;
    html += `<div class="rel-satellite-count" style="left:${badgeLocalX}px;top:${badgeLocalY}px;">${s.sat.items.length}</div>`;
    html += `<div class="rel-satellite-title">${escapeHtml(s.sat.title)}</div>`;
    html += '</div>';
  });

  canvas.innerHTML = html;

  // --- Right panel: search + show checkboxes ---
  let panelHtml = '<div class="rel-panel-nav">';
  panelHtml += '<button class="rel-panel-btn" id="rel-zoom-in" title="Zoom in"><i data-lucide="zoom-in" style="width:16px;height:16px;"></i></button>';
  panelHtml += '<button class="rel-panel-btn" id="rel-zoom-out" title="Zoom out"><i data-lucide="zoom-out" style="width:16px;height:16px;"></i></button>';
  panelHtml += '<button class="rel-panel-btn" id="rel-reset" title="Reset"><i data-lucide="maximize-2" style="width:16px;height:16px;"></i></button>';
  panelHtml += '</div>';
  panelHtml += '<input type="text" class="rel-panel-search" id="rel-search" placeholder="Find...">';
  panelHtml += '<div class="rel-panel-title">Show</div>';
  satellites.forEach(sat => {
    panelHtml += `<label class="rel-panel-item">
      <input type="checkbox" checked data-rel-toggle="${escapeHtml(sat.title)}">
      <span>${escapeHtml(sat.title)}</span>
    </label>`;
  });
  panel.innerHTML = panelHtml;

  lucide.createIcons({ nodes: [canvas] });

  // --- Zoom & Pan ---
  let scale = 1, panX = 0, panY = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;

  function applyTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    canvas.style.transformOrigin = '0 0';
  }
  function centerCanvas() {
    const vw = viewport.offsetWidth;
    const vh = viewport.offsetHeight;
    panX = (vw - canvasSize) / 2;
    panY = (vh - canvasSize) / 2;
    applyTransform();
  }
  centerCanvas();

  viewport.addEventListener('wheel', function(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(3, Math.max(0.3, scale * delta));
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    panX = mx - (mx - panX) * (newScale / scale);
    panY = my - (my - panY) * (newScale / scale);
    scale = newScale;
    applyTransform();
  }, { passive: false });

  viewport.addEventListener('mousedown', function(e) {
    if (e.target.closest('a') || e.target.closest('.rel-panel')) return;
    isDragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    panStartX = panX; panStartY = panY;
  });
  const onMouseMove = function(e) {
    if (!isDragging) return;
    panX = panStartX + (e.clientX - dragStartX);
    panY = panStartY + (e.clientY - dragStartY);
    applyTransform();
  };
  const onMouseUp = function() { isDragging = false; };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  relCleanup = function() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  // --- Tooltip (dark info box) ---
  const tooltip = document.getElementById('rel-tooltip');
  canvas.addEventListener('mouseover', function(e) {
    const item = e.target.closest('[data-rel-info]');
    if (item && tooltip) {
      const name = item.dataset.relInfo;
      const type = item.dataset.relType || '';
      const meta = item.dataset.relMeta || '';
      tooltip.innerHTML = '<div style="font-weight:600;margin-bottom:2px;">' + escapeHtml(name) + '</div>'
        + (type ? '<div style="opacity:0.7;font-size:11px;">Type: ' + escapeHtml(type) + '</div>' : '')
        + (meta ? '<div style="opacity:0.7;font-size:11px;">' + escapeHtml(meta) + '</div>' : '');
      tooltip.style.display = 'block';
    }
  });
  canvas.addEventListener('mousemove', function(e) {
    if (tooltip && tooltip.style.display === 'block') {
      const rect = viewport.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
      tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
    }
  });
  canvas.addEventListener('mouseout', function(e) {
    if (e.target.closest('[data-rel-info]') && tooltip) tooltip.style.display = 'none';
  });

  // --- Panel: toggle visibility ---
  panel.addEventListener('change', function(e) {
    const cb = e.target;
    if (!cb.dataset.relToggle) return;
    const groupName = cb.dataset.relToggle;
    const satellite = canvas.querySelector('[data-group="' + groupName + '"]');
    if (satellite) {
      satellite.style.display = cb.checked ? '' : 'none';
    }
    // Also hide/show the SVG line for this group
    const idx = satellites.findIndex(s => s.title === groupName);
    const lines = canvas.querySelector('.rel-svg');
    if (lines && lines.children[idx]) {
      lines.children[idx].style.display = cb.checked ? '' : 'none';
    }
  });

  // --- Panel: search filter ---
  const searchInput = document.getElementById('rel-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const q = this.value.toLowerCase();
      canvas.querySelectorAll('.rel-item').forEach(item => {
        const name = (item.dataset.relInfo || '').toLowerCase();
        item.style.display = !q || name.includes(q) ? '' : 'none';
      });
    });
  }

  // --- Panel: zoom/reset buttons ---
  function zoomBy(factor) {
    const newScale = Math.min(3, Math.max(0.3, scale * factor));
    const vw = viewport.offsetWidth;
    const vh = viewport.offsetHeight;
    // Zoom toward center of viewport
    panX = vw / 2 - (vw / 2 - panX) * (newScale / scale);
    panY = vh / 2 - (vh / 2 - panY) * (newScale / scale);
    scale = newScale;
    applyTransform();
  }
  document.getElementById('rel-zoom-in')?.addEventListener('click', function() { zoomBy(1.25); });
  document.getElementById('rel-zoom-out')?.addEventListener('click', function() { zoomBy(0.8); });
  document.getElementById('rel-reset')?.addEventListener('click', function() { scale = 1; centerCanvas(); });

  lucide.createIcons({ nodes: [panel] });
}
