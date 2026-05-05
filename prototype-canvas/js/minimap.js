/**
 * Minimap — bottom-right overview window with a viewport rectangle that
 * tracks the main canvas. A click anywhere inside the minimap pans the
 * canvas so its centre lands on the picked point. Hovering does nothing.
 *
 * Coordinate spaces:
 *   world    — canvas (state) coords, the same as node.x / node.y
 *   minimap  — SVG viewBox coords, fixed at WIDTH × HEIGHT
 *   client   — pixel coords inside the rendered SVG element on screen
 *
 * Subscribes to State for graph changes (replace/reset/nodes/edges/filter)
 * and to Canvas.onTransform for pan/zoom changes. Both paths are rAF-coalesced
 * — Canvas pan can fire 60+ events/sec.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.Minimap = (function () {

    var State = null;
    var Canvas = null;

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var WIDTH = 240;
    var HEIGHT = 160;
    // World-space margin around the node bbox so nodes near the edge don't
    // kiss the minimap border. Big enough to feel like breathing room at any
    // graph size.
    var WORLD_PADDING = 80;
    // Default node size used as a fallback when DOM hasn't measured yet
    // (initial paint, before Canvas.renderAll has appended elements).
    // Once the DOM is ready, nodeRectForMinimap delegates to
    // Canvas.getNodeRect which reads the real offsetWidth/Height.
    var DEFAULT_NODE_W = 320;
    var DEFAULT_NODE_H = 200;

    var rootEl = null;
    var svgEl = null;
    var nodesGroup = null;
    var systemsGroup = null;
    var viewportRect = null;
    var canvasEl = null;

    var renderQueued = false;
    var viewportQueued = false;

    // Two distinct minimap interactions:
    //   1. Click on the minimap *outside* the viewport rectangle → one-shot
    //      pan: the canvas centres on the clicked world point. No drag, no
    //      hold-to-track. Zoom is preserved.
    //   2. Press AND HOLD on the viewport rectangle → drag-pan: the
    //      rectangle follows the cursor with the original grab offset
    //      preserved, so the rectangle doesn't jump under the cursor. The
    //      canvas pans continuously while the pointer is held.
    //
    // Hit-test is geometry-based against viewportBounds (cached in
    // updateViewport) — the viewport <rect> has pointer-events: none in
    // CSS, so e.target on its area resolves to the SVG itself either way.
    var isMinimapDragging = false;
    var dragPointerId = null;
    var lastDragEvent = null;
    var dragRafQueued = false;
    // Grab offset in WORLD coords: (cursor world point at drag start) −
    // (viewport top-left at drag start). Preserved while dragging so the
    // viewport's top-left stays at cursor − offset, no jump-to-centre.
    var dragGrabOffset = null;
    // Cached viewport-rect geometry in MINIMAP coords. Used by the
    // pointerdown hit-test to decide click-mode vs drag-mode.
    var viewportBounds = null;

    // Cached world → minimap mapping. Recomputed each render().
    var mapScale = 1;
    var mapOffsetX = 0;
    var mapOffsetY = 0;
    var bounds = null;

    var inited = false;
    function init() {
        // Idempotent guard — protects against accidental double-bootstrap
        // (HMR, a second DOMContentLoaded path) which would otherwise add
        // a second ResizeObserver and double up every pointer listener.
        if (inited) return;
        inited = true;
        State = window.CanvasApp.State;
        Canvas = window.CanvasApp.Canvas;
        rootEl = document.getElementById('minimap');
        svgEl = document.getElementById('minimap-svg');
        nodesGroup = document.getElementById('minimap-nodes');
        systemsGroup = document.getElementById('minimap-systems');
        viewportRect = document.getElementById('minimap-viewport');
        canvasEl = document.getElementById('canvas');
        if (!rootEl || !svgEl || !nodesGroup || !systemsGroup || !viewportRect) {
            inited = false; // allow a retry once the DOM is ready
            return;
        }

        svgEl.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + HEIGHT);

        State.on(function (reason) {
            if (reason === 'replace' || reason === 'reset' ||
                reason === 'nodes' || reason === 'edges' || reason === 'filter') {
                scheduleRender();
            }
        });
        Canvas.onTransform(scheduleViewport);

        // Press pans the main canvas to centre on the picked point; holding
        // and dragging tracks the cursor. setPointerCapture on pointerdown
        // guarantees pointerup is delivered even if the pointer leaves the
        // SVG mid-drag (the prior "pans on hover" bug came from a missed
        // pointerup leaving isDragging stuck true — capture closes that hole,
        // and pointercancel below covers OS-level gesture interruption).
        svgEl.addEventListener('pointerdown', onPointerDown);
        svgEl.addEventListener('pointermove', onPointerMove);
        svgEl.addEventListener('pointerup', onPointerEnd);
        svgEl.addEventListener('pointercancel', onPointerEnd);
        // Stop wheel events on the minimap from also panning/zooming the
        // main canvas behind it.
        svgEl.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });

        // The viewport rect math depends on canvasEl.getBoundingClientRect()
        // — i.e. how many pixels of canvas are currently visible. That
        // changes on window resize *and* when the info panel slides in /
        // out / drag-resizes, neither of which fires a Canvas transform
        // event. ResizeObserver on the canvas element catches all three.
        if (window.ResizeObserver && canvasEl) {
            var ro = new ResizeObserver(scheduleViewport);
            ro.observe(canvasEl);
        } else {
            window.addEventListener('resize', scheduleViewport);
        }

        // Initial paint — Canvas hasn't necessarily rendered yet, so node
        // rects fall back to the default 220×80 inside getNodeRect. We
        // re-render after the first State emit anyway.
        scheduleRender();
    }

    function scheduleRender() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(function () {
            renderQueued = false;
            render();
        });
    }

    function scheduleViewport() {
        if (viewportQueued) return;
        viewportQueued = true;
        requestAnimationFrame(function () {
            viewportQueued = false;
            updateViewport();
        });
    }

    /**
     * World-space rect for one node — matches what's rendered on the main
     * canvas. We delegate to Canvas.getNodeRect which reads offsetWidth /
     * offsetHeight from the cached DOM element; when the DOM isn't ready
     * yet (initial paint) it returns 220×80, and we substitute our larger
     * defaults so empty placeholder rects don't make the minimap look
     * sparse on a freshly-loaded canvas.
     *
     * Layout-cost note: this reads `offsetHeight` for every node, but
     * within a single rAF the browser computes layout once and caches; the
     * 256-node IBPDI minimap render doesn't trigger 256 individual layout
     * passes — just one. The earlier "fixed default" optimisation was a
     * micro-optimisation that traded accuracy for a perf gain that the
     * browser layout cache already provides.
     */
    function nodeRectForMinimap(n) {
        if (Canvas && Canvas.getNodeRect) {
            var r = Canvas.getNodeRect(n);
            // Canvas's fallback (220×80) is for a node whose DOM hasn't
            // mounted yet — substitute our larger minimap defaults so the
            // first paint isn't visibly thin.
            return {
                x: r.x,
                y: r.y,
                w: r.w > 220 ? r.w : DEFAULT_NODE_W,
                h: r.h > 80  ? r.h : DEFAULT_NODE_H
            };
        }
        return { x: n.x || 0, y: n.y || 0, w: DEFAULT_NODE_W, h: DEFAULT_NODE_H };
    }

    /**
     * Bounding box of every drawn node (filters respected when active).
     * Local re-implementation of Canvas.getWorldBounds that uses
     * stored sizes — same reason as nodeRectForMinimap.
     */
    function computeBounds() {
        var nodes = State.getNodes();
        var filtersActive = State.hasActiveFilters();
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        var any = false;
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.type === 'codelist') continue;
            if (filtersActive && !State.matchesFilters(n)) continue;
            var r = nodeRectForMinimap(n);
            any = true;
            if (r.x < minX) minX = r.x;
            if (r.y < minY) minY = r.y;
            if (r.x + r.w > maxX) maxX = r.x + r.w;
            if (r.y + r.h > maxY) maxY = r.y + r.h;
        }
        if (!any) return null;
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    function render() {
        if (!rootEl) return;
        bounds = computeBounds();
        if (!bounds) {
            // Empty canvas — clear and bail.
            nodesGroup.innerHTML = '';
            systemsGroup.innerHTML = '';
            viewportRect.setAttribute('width', 0);
            viewportRect.setAttribute('height', 0);
            return;
        }
        // Pad the world bbox so nodes near the edge have breathing room.
        var pw = bounds.w + WORLD_PADDING * 2;
        var ph = bounds.h + WORLD_PADDING * 2;
        var px = bounds.x - WORLD_PADDING;
        var py = bounds.y - WORLD_PADDING;
        // Uniform scale, letterbox the dead axis.
        mapScale = Math.min(WIDTH / pw, HEIGHT / ph);
        mapOffsetX = (WIDTH  - pw * mapScale) / 2 - px * mapScale;
        mapOffsetY = (HEIGHT - ph * mapScale) / 2 - py * mapScale;

        renderSystems();
        renderNodes();
        updateViewport();
    }

    function renderSystems() {
        systemsGroup.innerHTML = '';
        var nodes = State.getNodes();
        var filtersActive = State.hasActiveFilters();
        var bySystem = Object.create(null);
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.type === 'codelist') continue;
            // When filters are active, mirror the canvas: only the matching
            // subset shows, so empty systems drop their rectangle entirely.
            if (filtersActive && !State.matchesFilters(n)) continue;
            var sys = (n.system || '').trim();
            if (!sys) continue;
            (bySystem[sys] = bySystem[sys] || []).push(n);
        }
        Object.keys(bySystem).forEach(function (sys) {
            var members = bySystem[sys];
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (var i = 0; i < members.length; i++) {
                var r = nodeRectForMinimap(members[i]);
                if (r.x < minX) minX = r.x;
                if (r.y < minY) minY = r.y;
                if (r.x + r.w > maxX) maxX = r.x + r.w;
                if (r.y + r.h > maxY) maxY = r.y + r.h;
            }
            if (minX === Infinity) return;
            var rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', worldToMapX(minX));
            rect.setAttribute('y', worldToMapY(minY));
            rect.setAttribute('width',  Math.max(1, (maxX - minX) * mapScale));
            rect.setAttribute('height', Math.max(1, (maxY - minY) * mapScale));
            rect.setAttribute('class', 'minimap-system-rect');
            systemsGroup.appendChild(rect);
        });
    }

    function renderNodes() {
        nodesGroup.innerHTML = '';
        var nodes = State.getNodes();
        // Note: we used to short-circuit above 100 nodes (rendered only
        // the system rectangles) on the assumption that individual rects
        // overlap into illegible pixel-soup at IBPDI scale. In practice
        // they're still useful — discrete coloured marks read as "node
        // density" and let the user spot tall hub clusters that the
        // system rectangle alone hides. Cost (~256 setAttribute calls
        // per render) is fine because minimap renders are rAF-coalesced
        // and only fire on state events, not on every pan/zoom tick.
        var filtersActive = State.hasActiveFilters();
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.type === 'codelist') continue;
            if (filtersActive && !State.matchesFilters(n)) continue;
            var r = nodeRectForMinimap(n);
            var rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', worldToMapX(r.x));
            rect.setAttribute('y', worldToMapY(r.y));
            rect.setAttribute('width',  Math.max(1, r.w * mapScale));
            rect.setAttribute('height', Math.max(1, r.h * mapScale));
            rect.setAttribute('class', 'minimap-node-rect minimap-node-rect--' + (n.type || 'table'));
            nodesGroup.appendChild(rect);
        }
    }

    function updateViewport() {
        if (!bounds || !viewportRect || !canvasEl) return;
        var t = Canvas.getTransform();
        var cr = canvasEl.getBoundingClientRect();
        // Top-left of canvas viewport in world coords.
        // clientToCanvas inverse at (0, 0): world = (0 - translate) / scale.
        var wx = -t.translateX / t.scale;
        var wy = -t.translateY / t.scale;
        var ww = cr.width  / t.scale;
        var wh = cr.height / t.scale;
        var mx = worldToMapX(wx);
        var my = worldToMapY(wy);
        var mw = Math.max(2, ww * mapScale);
        var mh = Math.max(2, wh * mapScale);
        viewportRect.setAttribute('x', mx);
        viewportRect.setAttribute('y', my);
        viewportRect.setAttribute('width',  mw);
        viewportRect.setAttribute('height', mh);
        // Cached for the pointerdown hit-test (drag-mode vs click-mode).
        viewportBounds = { x: mx, y: my, w: mw, h: mh };
    }

    function worldToMapX(x) { return x * mapScale + mapOffsetX; }
    function worldToMapY(y) { return y * mapScale + mapOffsetY; }

    function clientToMap(e) {
        // The SVG viewBox is fixed at WIDTH × HEIGHT but the element can be
        // any pixel size; scale client → viewBox.
        var r = svgEl.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (WIDTH  / r.width),
            y: (e.clientY - r.top)  * (HEIGHT / r.height)
        };
    }

    function mapToWorld(mx, my) {
        return {
            x: (mx - mapOffsetX) / mapScale,
            y: (my - mapOffsetY) / mapScale
        };
    }

    /**
     * Hit-test: did the pointerdown land inside the cached viewport-rect
     * bounds? Drives the click-vs-drag mode split.
     */
    function isOverViewport(e) {
        if (!viewportBounds) return false;
        var m = clientToMap(e);
        return m.x >= viewportBounds.x &&
               m.x <= viewportBounds.x + viewportBounds.w &&
               m.y >= viewportBounds.y &&
               m.y <= viewportBounds.y + viewportBounds.h;
    }

    function onPointerDown(e) {
        if (!bounds) return;
        // Primary button only — ignore right-click / middle-click / browser-back.
        if (e.button !== 0) return;
        e.preventDefault();

        if (isOverViewport(e)) {
            // ---- Drag mode ----
            // Held inside the rectangle: pan continuously while dragging,
            // preserving the cursor offset within the rectangle.
            isMinimapDragging = true;
            dragPointerId = e.pointerId;
            svgEl.classList.add('is-dragging');
            // Capture so fast drags that exit the SVG bounds still deliver
            // pointermove / pointerup. try/catch — can throw on detached
            // elements during HMR.
            try { svgEl.setPointerCapture(e.pointerId); } catch (err) {}
            // Capture grab offset in WORLD coords so the rectangle's grab
            // point stays under the cursor while dragging.
            var t = Canvas.getTransform();
            var viewportLeftWorld = -t.translateX / t.scale;
            var viewportTopWorld  = -t.translateY / t.scale;
            var m = clientToMap(e);
            var w = mapToWorld(m.x, m.y);
            dragGrabOffset = {
                x: w.x - viewportLeftWorld,
                y: w.y - viewportTopWorld
            };
            // No pan on the down — wait for movement so a click-without-move
            // is a no-op rather than a re-centre.
            return;
        }

        // ---- Click-to-pan mode ----
        // Outside the rectangle: one-shot pan, no continuous tracking.
        // Zoom is preserved (panToEvent only updates translate).
        panToEvent(e);
    }

    function onPointerMove(e) {
        if (!isMinimapDragging) {
            // Hover-state cursor hint: 'move' over the viewport rect (drag
            // available), default 'pointer' elsewhere (click-to-pan). We
            // use a class toggle rather than inline style so the rule
            // composes cleanly with .is-dragging during a drag.
            if (svgEl) {
                svgEl.classList.toggle('is-over-viewport', isOverViewport(e));
            }
            return;
        }
        if (e.pointerId !== dragPointerId) return;
        e.preventDefault();
        lastDragEvent = e;
        if (dragRafQueued) return;
        dragRafQueued = true;
        requestAnimationFrame(flushDragFrame);
    }

    function flushDragFrame() {
        dragRafQueued = false;
        var e = lastDragEvent;
        lastDragEvent = null;
        if (!e || !isMinimapDragging || !dragGrabOffset) return;
        // Clamp the cursor's map coordinates to the minimap viewBox so the
        // viewport rectangle stops at the minimap edge instead of trailing
        // the cursor off-screen. Pointer capture (setPointerCapture in
        // onPointerDown) keeps pointermove firing even when the cursor
        // exits the SVG bounds — without this clamp, the canvas would
        // pan further with every pixel of cursor travel beyond the
        // minimap, which the user reads as "main view follows the mouse"
        // and feels broken.
        var m = clientToMap(e);
        if (m.x < 0)      m.x = 0;
        if (m.x > WIDTH)  m.x = WIDTH;
        if (m.y < 0)      m.y = 0;
        if (m.y > HEIGHT) m.y = HEIGHT;
        // Pan so the viewport's top-left tracks (cursor − grab offset).
        var w = mapToWorld(m.x, m.y);
        var newLeftWorld = w.x - dragGrabOffset.x;
        var newTopWorld  = w.y - dragGrabOffset.y;
        var t = Canvas.getTransform();
        Canvas.setTransform({
            translateX: -newLeftWorld * t.scale,
            translateY: -newTopWorld  * t.scale
        });
    }

    function onPointerEnd(e) {
        if (e.pointerId !== dragPointerId && dragPointerId !== null) return;
        isMinimapDragging = false;
        dragPointerId = null;
        lastDragEvent = null;
        dragGrabOffset = null;
        if (svgEl) svgEl.classList.remove('is-dragging');
        try { svgEl.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    /**
     * One-shot pan to centre the canvas on the clicked world point.
     * Used by click-mode only; drag-mode does its own grab-offset math.
     */
    function panToEvent(e) {
        var m = clientToMap(e);
        var w = mapToWorld(m.x, m.y);
        if (!canvasEl) return;
        var cr = canvasEl.getBoundingClientRect();
        var t = Canvas.getTransform();
        Canvas.setTransform({
            translateX: cr.width  / 2 - w.x * t.scale,
            translateY: cr.height / 2 - w.y * t.scale
        });
    }

    return {
        init: init,
        render: render
    };
})();
