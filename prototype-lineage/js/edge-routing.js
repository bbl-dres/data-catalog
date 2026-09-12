/**
 * Edge Routing — Bezier curve computation for table-level and column-level edges.
 */
window.LineageApp = window.LineageApp || {};

window.LineageApp.EdgeRouting = (function () {

    /**
     * Compute a cubic bezier SVG path between two node rects, honouring the
     * current layout direction so edges exit the correct face of each box.
     *
     * @param {{x:number, y:number, width:number, height:number}} src
     * @param {{x:number, y:number, width:number, height:number}} tgt
     * @param {'LR'|'RL'|'TB'|'BT'} [direction='LR']
     * @returns {string} SVG path d attribute
     */
    function computeEdgePath(src, tgt, direction) {
        direction = direction || 'LR';

        var x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y, delta;

        switch (direction) {
            case 'TB':
                x1 = src.x + src.width / 2;
                y1 = src.y + src.height;
                x2 = tgt.x + tgt.width / 2;
                y2 = tgt.y;
                delta = Math.max(Math.abs(y2 - y1) * 0.5, 60);
                cp1x = x1; cp1y = y1 + delta;
                cp2x = x2; cp2y = y2 - delta;
                break;
            case 'BT':
                x1 = src.x + src.width / 2;
                y1 = src.y;
                x2 = tgt.x + tgt.width / 2;
                y2 = tgt.y + tgt.height;
                delta = Math.max(Math.abs(y2 - y1) * 0.5, 60);
                cp1x = x1; cp1y = y1 - delta;
                cp2x = x2; cp2y = y2 + delta;
                break;
            case 'RL':
                x1 = src.x;
                y1 = src.y + src.height / 2;
                x2 = tgt.x + tgt.width;
                y2 = tgt.y + tgt.height / 2;
                delta = Math.max(Math.abs(x2 - x1) * 0.5, 60);
                cp1x = x1 - delta; cp1y = y1;
                cp2x = x2 + delta; cp2y = y2;
                break;
            case 'LR':
            default:
                x1 = src.x + src.width;
                y1 = src.y + src.height / 2;
                x2 = tgt.x;
                y2 = tgt.y + tgt.height / 2;
                delta = Math.max(Math.abs(x2 - x1) * 0.5, 60);
                cp1x = x1 + delta; cp1y = y1;
                cp2x = x2 - delta; cp2y = y2;
                break;
        }

        return 'M ' + x1 + ' ' + y1 +
               ' C ' + cp1x + ' ' + cp1y +
               ', ' + cp2x + ' ' + cp2y +
               ', ' + x2 + ' ' + y2;
    }

    /**
     * Compute a cubic bezier SVG path between two port positions (column-level).
     * Column ports live on the left/right of each row, so these edges stay
     * horizontal regardless of the overall layout direction.
     * @param {{x:number, y:number}} from
     * @param {{x:number, y:number}} to
     * @returns {string} SVG path d attribute
     */
    function computeColumnEdgePath(from, to) {
        var dx = Math.max(Math.abs(to.x - from.x) * 0.4, 40);
        return 'M ' + from.x + ' ' + from.y +
               ' C ' + (from.x + dx) + ' ' + from.y +
               ', ' + (to.x - dx) + ' ' + to.y +
               ', ' + to.x + ' ' + to.y;
    }

    /**
     * Get the graph-space position of a column port element.
     * @param {string} nodeId
     * @param {string} columnName
     * @param {'left'|'right'} side
     * @param {{translateX:number, translateY:number, scale:number}} transform - current pan/zoom
     * @returns {{x:number, y:number}|null}
     */
    function getColumnPortPosition(nodeId, columnName, side, transform) {
        var nodeEl = document.querySelector('[data-node-id="' + nodeId + '"]');
        if (!nodeEl) return null;

        var colEl = nodeEl.querySelector('[data-column="' + columnName + '"]');
        if (!colEl) return null;

        var portEl = colEl.querySelector('.node__column-port--' + side);
        if (!portEl) return null;

        var portRect = portEl.getBoundingClientRect();
        var containerRect = document.getElementById('graph-container').getBoundingClientRect();

        var graphX = (portRect.left + portRect.width / 2 - containerRect.left - transform.translateX) / transform.scale;
        var graphY = (portRect.top + portRect.height / 2 - containerRect.top - transform.translateY) / transform.scale;

        return { x: graphX, y: graphY };
    }

    /**
     * Get the center-left or center-right position of a node in graph space.
     * @param {{x:number, y:number, width:number, height:number}} nodeRect
     * @param {'left'|'right'} side
     * @returns {{x:number, y:number}}
     */
    function getNodeEdgeCenter(nodeRect, side) {
        if (side === 'right') {
            return { x: nodeRect.x + nodeRect.width, y: nodeRect.y + nodeRect.height / 2 };
        }
        return { x: nodeRect.x, y: nodeRect.y + nodeRect.height / 2 };
    }

    return {
        computeEdgePath: computeEdgePath,
        computeColumnEdgePath: computeColumnEdgePath,
        getColumnPortPosition: getColumnPortPosition,
        getNodeEdgeCenter: getNodeEdgeCenter
    };
})();
