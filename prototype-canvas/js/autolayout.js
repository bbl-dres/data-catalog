/**
 * AutoLayout — compound-graph layout via ELK on the main thread.
 *
 * Strategy (Phase 2 from docs/AUTOLAYOUT_RESEARCH.md): treat each
 * `node.system` as an ELK compound child of a single root graph. ELK's
 * `layered` algorithm + `hierarchyHandling: INCLUDE_CHILDREN` does in one
 * pass what the abandoned dagre-per-cluster approach tried to fake:
 *
 *   - Layered placement INSIDE each compound (intra-cluster FK lineage
 *     reads as left → right)
 *   - Layered placement OF the compounds at the root level
 *   - Cross-cluster edges route AROUND unrelated compounds rather than
 *     straight-lining through them
 *
 * Threading: ELK manages its own internal Worker for the actual layout
 * computation, so we just call `elk.layout()` on the main thread and
 * await the Promise — the main thread stays responsive while ELK churns.
 * (We tried wrapping ELK in our own Web Worker first; ELK's auto-spawned
 * internal Worker can't be created from a nested worker context, so
 * `new ELK()` threw `_Worker is not a constructor`. See §6.4 of the
 * research doc.)
 *
 * Visibility-aware: only nodes that pass current filters are sent to ELK;
 * filtered-out nodes keep their existing positions. Edit-mode-only — all
 * mutations go through State.applyLayoutTransform so Ctrl+Z undoes the
 * whole batch in one shot.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.AutoLayout = (function () {

    var State = null;
    var elk = null;
    var inFlight = false;

    var FALLBACK_NODE_W = 320;
    var FALLBACK_NODE_H = 200;
    var NO_SYSTEM_KEY   = '__no_system__';

    // Edge labels render in a 180 px-wide foreignObject (see LBL_W in
    // canvas.js) anchored at the midpoint of a straight line. Inter-layer
    // spacing must comfortably exceed that width or adjacent edges' labels
    // will sit on top of each other — the original 60 px cluster value made
    // labels unreadable on dense IBPDI clusters.
    var ROOT_OPTIONS = {
        'elk.algorithm':                                  'layered',
        'elk.direction':                                  'RIGHT',
        // INCLUDE_CHILDREN lets ELK route inter-cluster edges around
        // unrelated compounds (the whole reason we picked ELK).
        'elk.hierarchyHandling':                          'INCLUDE_CHILDREN',
        // Generous spacing between compounds so clusters read as discrete
        // groups rather than a single soup.
        'elk.spacing.nodeNode':                           '180',
        'elk.layered.spacing.nodeNodeBetweenLayers':      '240',
        // componentComponent applies to disconnected subgraphs. After
        // junction-table pruning many leaf entities have zero edges and
        // each becomes its own component — the previous 180 px stacked
        // them into a tall vertical stripe of empty space. 60 px keeps
        // them visually distinct without wasting canvas.
        'elk.spacing.componentComponent':                 '60',
        'elk.spacing.edgeEdge':                           '40',
        'elk.spacing.edgeNode':                           '40',
        // Aspect-ratio hint nudges ELK toward a roughly 16:10 bounding box
        // instead of an unbounded tall column when there are many small
        // disconnected components. ELK treats this as a soft preference,
        // so well-connected dense clusters still get the layout they need.
        'elk.aspectRatio':                                '1.6'
    };

    var CLUSTER_OPTIONS = {
        'elk.algorithm':                                  'layered',
        'elk.direction':                                  'RIGHT',
        // Horizontal lane gap — at least 220 px so a 180 px-wide edge label
        // anchored at the midpoint clears the nodes on either side.
        'elk.layered.spacing.nodeNodeBetweenLayers':      '220',
        'elk.spacing.nodeNode':                           '60',
        'elk.spacing.edgeEdge':                           '24',
        'elk.spacing.edgeNode':                           '24',
        // Top padding accommodates the system-name overlay that fades in at
        // low zoom; left/right/bottom give visual breathing room.
        'elk.padding':                                    '[top=60,left=30,bottom=30,right=30]'
    };

    function init() {
        State = window.CanvasApp.State;
        var btn = document.getElementById('btn-auto-layout');
        if (btn) btn.addEventListener('click', run);
    }

    /** Lazy-init the ELK instance — first construction creates the internal
     *  worker, so we defer it to first click rather than page load. */
    function getElk() {
        if (elk) return elk;
        if (typeof ELK !== 'function') return null;
        try {
            elk = new ELK();
            return elk;
        } catch (err) {
            console.error('Auto-Layout: ELK construction failed', err);
            return null;
        }
    }

    function run() {
        if (inFlight) return;
        if (State.getMode() !== 'edit') {
            // Button is edit-only via CSS; defensive guard for future paths.
            toast('Auto-Layout ist nur im Bearbeiten-Modus verfügbar.', 'error');
            return;
        }
        var elkInstance = getElk();
        if (!elkInstance) {
            toast('Auto-Layout-Bibliothek nicht verfügbar. Bitte Seite neu laden.', 'error');
            return;
        }

        var visible = State.getNodes().filter(function (n) {
            return State.matchesFilters(n);
        });
        if (!visible.length) {
            toast('Keine sichtbaren Knoten zum Anordnen.', 'error');
            return;
        }

        var graph;
        try {
            graph = buildElkGraph(visible, State.getEdges());
        } catch (err) {
            console.error('Auto-Layout: graph build failed', err);
            toast('Auto-Layout fehlgeschlagen: ' + err.message, 'error');
            return;
        }

        setBusy(true);
        toast('Auto-Layout wird berechnet…', 'success');

        elkInstance.layout(graph).then(function (result) {
            setBusy(false);
            try {
                var positions = collectPositions(result);
                if (!positions.length) {
                    toast('Auto-Layout: keine Positionen erhalten.', 'error');
                    return;
                }
                State.applyLayoutTransform('Auto-Layout', positions);
                toast('Auto-Layout angewendet · ' + positions.length + ' Knoten', 'success');
            } catch (err) {
                console.error('Auto-Layout: apply failed', err);
                toast('Auto-Layout konnte nicht angewendet werden.', 'error');
            }
        }).catch(function (err) {
            setBusy(false);
            var msg = err && err.message ? err.message : 'unbekannter Fehler';
            console.error('Auto-Layout: ELK error', err);
            toast('Auto-Layout fehlgeschlagen: ' + msg, 'error');
        });
    }

    /**
     * Build the compound ELK graph: root → one compound per system → leaf
     * nodes. Edges sit at the root and reference leaf ids; ELK figures out
     * the hierarchy and routes accordingly.
     */
    function buildElkGraph(visibleNodes, allEdges) {
        var bySystem = Object.create(null);
        visibleNodes.forEach(function (n) {
            var key = (n.system || '').trim() || NO_SYSTEM_KEY;
            (bySystem[key] = bySystem[key] || []).push(n);
        });

        var systemContainers = Object.keys(bySystem).map(function (key) {
            return {
                id: 'sys::' + key,
                layoutOptions: CLUSTER_OPTIONS,
                children: bySystem[key].map(function (n) {
                    var s = nodeSize(n.id);
                    return { id: n.id, width: s.w, height: s.h };
                })
            };
        });

        var visibleIds = Object.create(null);
        visibleNodes.forEach(function (n) { visibleIds[n.id] = true; });

        var edges = [];
        allEdges.forEach(function (e, i) {
            if (!visibleIds[e.from] || !visibleIds[e.to]) return;
            // ELK's layered algorithm rejects self-loops.
            if (e.from === e.to) return;
            edges.push({
                id:      'e' + i,
                sources: [e.from],
                targets: [e.to]
            });
        });

        return {
            id:            'root',
            layoutOptions: ROOT_OPTIONS,
            children:      systemContainers,
            edges:         edges
        };
    }

    /**
     * Walk the ELK result tree and emit absolute (x, y) for every leaf.
     * Compound child coords are relative to their parent, so we accumulate
     * offsets through the recursion.
     */
    function collectPositions(result) {
        var positions = [];
        function walk(node, parentX, parentY) {
            var absX = parentX + (node.x || 0);
            var absY = parentY + (node.y || 0);
            var isCompound = node.id === 'root' ||
                (typeof node.id === 'string' && node.id.indexOf('sys::') === 0);
            if (!isCompound) {
                positions.push({ id: node.id, x: absX, y: absY });
            }
            if (Array.isArray(node.children)) {
                node.children.forEach(function (c) { walk(c, absX, absY); });
            }
        }
        walk(result, 0, 0);
        return positions;
    }

    function nodeSize(id) {
        if (window.CSS && window.CSS.escape) {
            var el = document.querySelector('[data-node-id="' + window.CSS.escape(id) + '"]');
            if (el && el.offsetWidth) {
                return { w: el.offsetWidth, h: el.offsetHeight };
            }
        }
        return { w: FALLBACK_NODE_W, h: FALLBACK_NODE_H };
    }

    function setBusy(busy) {
        inFlight = busy;
        var btn = document.getElementById('btn-auto-layout');
        if (btn) btn.disabled = busy;
    }

    function toast(msg, kind) {
        if (window.CanvasApp.App && window.CanvasApp.App.toast) {
            window.CanvasApp.App.toast(msg, kind);
        }
    }

    return {
        init: init,
        run:  run
    };
})();
