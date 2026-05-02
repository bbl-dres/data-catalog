/**
 * Minimap — bottom-right overview window with a draggable viewport rectangle.
 *
 * Renders a scaled SVG of every on-canvas node plus a faint frame per system,
 * with a viewport rect tracking the main canvas. Click or drag inside the
 * minimap pans the canvas so its centre lands on the picked point.
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

    var rootEl = null;
    var svgEl = null;
    var nodesGroup = null;
    var systemsGroup = null;
    var viewportRect = null;
    var canvasEl = null;

    var renderQueued = false;
    var viewportQueued = false;

    // Cached world → minimap mapping. Recomputed each render().
    var mapScale = 1;
    var mapOffsetX = 0;
    var mapOffsetY = 0;
    var bounds = null;

    var dragging = false;

    function init() {
        State = window.CanvasApp.State;
        Canvas = window.CanvasApp.Canvas;
        rootEl = document.getElementById('minimap');
        svgEl = document.getElementById('minimap-svg');
        nodesGroup = document.getElementById('minimap-nodes');
        systemsGroup = document.getElementById('minimap-systems');
        viewportRect = document.getElementById('minimap-viewport');
        canvasEl = document.getElementById('canvas');
        if (!rootEl || !svgEl || !nodesGroup || !systemsGroup || !viewportRect) return;

        svgEl.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + HEIGHT);

        State.on(function (reason) {
            if (reason === 'replace' || reason === 'reset' ||
                reason === 'nodes' || reason === 'edges' || reason === 'filter') {
                scheduleRender();
            }
        });
        Canvas.onTransform(scheduleViewport);

        svgEl.addEventListener('pointerdown', onPointerDown);
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

    function render() {
        if (!rootEl) return;
        bounds = Canvas.getWorldBounds();
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
        var bySystem = Object.create(null);
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.type === 'codelist') continue;
            var sys = (n.system || '').trim();
            if (!sys) continue;
            (bySystem[sys] = bySystem[sys] || []).push(n);
        }
        Object.keys(bySystem).forEach(function (sys) {
            var members = bySystem[sys];
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (var i = 0; i < members.length; i++) {
                var r = Canvas.getNodeRect(members[i]);
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
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.type === 'codelist') continue;
            var r = Canvas.getNodeRect(n);
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
        viewportRect.setAttribute('x', worldToMapX(wx));
        viewportRect.setAttribute('y', worldToMapY(wy));
        viewportRect.setAttribute('width',  Math.max(2, ww * mapScale));
        viewportRect.setAttribute('height', Math.max(2, wh * mapScale));
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

    function onPointerDown(e) {
        if (!bounds) return;
        e.preventDefault();
        dragging = true;
        try { svgEl.setPointerCapture(e.pointerId); } catch (_) {}
        panToEvent(e);
        svgEl.addEventListener('pointermove', onPointerMove);
        svgEl.addEventListener('pointerup', onPointerUp);
        svgEl.addEventListener('pointercancel', onPointerUp);
    }
    function onPointerMove(e) {
        if (!dragging) return;
        panToEvent(e);
    }
    function onPointerUp(e) {
        dragging = false;
        try { svgEl.releasePointerCapture(e.pointerId); } catch (_) {}
        svgEl.removeEventListener('pointermove', onPointerMove);
        svgEl.removeEventListener('pointerup', onPointerUp);
        svgEl.removeEventListener('pointercancel', onPointerUp);
    }

    function panToEvent(e) {
        var m = clientToMap(e);
        var w = mapToWorld(m.x, m.y);
        if (!canvasEl) return;
        var cr = canvasEl.getBoundingClientRect();
        var t = Canvas.getTransform();
        // Centre canvas on (w.x, w.y): we want clientToCanvas(centerClient) = w
        //   w.x = (centerClient.x - translateX) / scale
        //   centerClient.x = canvasRect.width / 2  (canvas-local)
        //   → translateX = canvasRect.width/2 - w.x * scale
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
