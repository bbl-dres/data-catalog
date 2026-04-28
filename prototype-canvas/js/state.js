/**
 * State — single source of truth for the canvas.
 *
 * Shape:
 *   nodes: [{ id, type, label, system, schema, x, y, tags, columns }]
 *   edges: [{ id, from, to, label }]
 *   view:  'diagram' | 'table' | 'api'
 *   mode:  'view' | 'edit'
 *
 * Persistence: a snapshot of { nodes, edges } is mirrored to localStorage so
 * the canvas survives a refresh. View and mode are session-only.
 */
window.CanvasApp = window.CanvasApp || {};

window.CanvasApp.State = (function () {

    var STORAGE_KEY = 'canvas.state.v1';
    // Old separate layout key from a previous iteration — drop on load if
    // present so it can't leak stale positions.
    var LEGACY_LAYOUT_KEY = 'canvas.layout.v1';
    var SEED_PATH = 'data/canvas.json';

    var state = {
        nodes: [],
        edges: [],
        view: 'diagram',
        mode: 'view',
        // Tagged-union selection. Exactly one of node / edge / system / attribute,
        // or null. Mutually exclusive across kinds.
        //   { kind: 'node',      id: '<nodeId>' }
        //   { kind: 'edge',      id: '<edgeId>' }
        //   { kind: 'system',    name: '<systemName>' }
        //   { kind: 'attribute', nodeId: '<nodeId>', name: '<columnName>' }
        selection: null,
        snapshot: null           // {nodes, edges} captured on entering edit; live data is the draft
    };

    // Undo stack for destructive / hard-to-redo edits. Pushed by deleteNode,
    // deleteEdge, and updateNode (whenever called via the public API). Capped at
    // 50 frames — enough for "oops, undo that delete" without unbounded memory.
    // Cleared on mode-change/load/replaceAll, since the snapshot semantics make
    // an undo across those states meaningless.
    var UNDO_LIMIT = 50;
    var undoStack = [];

    var listeners = [];

    function on(fn) { listeners.push(fn); }
    function emit(reason) {
        listeners.forEach(function (fn) { try { fn(reason); } catch (e) { console.error(e); } });
    }

    // ---- Loading -------------------------------------------------------

    function load() {
        // Migrate from the old two-key layout (if a previous version of the
        // app stored positions separately). The current main state owns
        // positions outright.
        try { localStorage.removeItem(LEGACY_LAYOUT_KEY); } catch (e) {}

        var stored = readStorage();
        if (stored && Array.isArray(stored.nodes)) {
            state.nodes = stored.nodes;
            state.edges = stored.edges || [];
            return Promise.resolve();
        }
        return fetch(SEED_PATH)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                state.nodes = data.nodes || [];
                state.edges = (data.edges || []).map(function (e, i) {
                    return Object.assign({ id: e.id || ('e' + i) }, e);
                });
                persist();
            })
            .catch(function (err) {
                console.error('Failed to load seed data', err);
                state.nodes = [];
                state.edges = [];
            });
    }

    function readStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function persist() {
        // Draft mode: don't touch the main state key. Live state is the
        // working copy; snapshot is the rollback point until commitDraft().
        if (state.snapshot) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                nodes: state.nodes,
                edges: state.edges
            }));
        } catch (e) { /* quota — ignore */ }
    }

    /**
     * Persist position changes into the main state JSON without committing
     * any draft data edits. Reads the existing main-state, copies live x/y
     * into it, writes back.
     *
     * Skips nodes that don't exist in main state yet (e.g. a node added in
     * the current draft and immediately dragged) — those will be persisted
     * normally on commitDraft().
     */
    function persistPositions() {
        if (!state.snapshot) {
            // Not in draft — a normal persist() writes everything anyway.
            persist();
            return;
        }
        var existing = readStorage();
        if (!existing || !Array.isArray(existing.nodes)) return;
        var posByNode = {};
        state.nodes.forEach(function (n) {
            posByNode[n.id] = { x: n.x || 0, y: n.y || 0 };
        });
        existing.nodes.forEach(function (n) {
            if (posByNode[n.id]) {
                n.x = posByNode[n.id].x;
                n.y = posByNode[n.id].y;
            }
        });
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        } catch (e) { /* quota */ }
    }

    function reset() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        state.snapshot = null;
        return load().then(function () { emit('reset'); });
    }

    // ---- Accessors -----------------------------------------------------

    function get() { return state; }
    function getNodes() { return state.nodes; }
    function getEdges() { return state.edges; }
    function getNode(id) {
        for (var i = 0; i < state.nodes.length; i++) {
            if (state.nodes[i].id === id) return state.nodes[i];
        }
        return null;
    }
    function getMode() { return state.mode; }
    function getView() { return state.view; }

    // ---- Mutations -----------------------------------------------------

    function setMode(mode) {
        if (mode !== 'view' && mode !== 'edit') return;
        if (state.mode === mode) return;
        if (mode === 'edit' && !state.snapshot) {
            // Capture rollback point. Live state becomes the draft.
            state.snapshot = deepClone({ nodes: state.nodes, edges: state.edges });
        } else if (mode === 'view' && state.snapshot) {
            // Defensive: leaving edit mode without commit/revert silently discards
            // the snapshot (live data wins). Normal UI flow always calls one of the
            // two paths, so this is a safety net.
            state.snapshot = null;
        }
        // Undo history is scoped to a single edit session.
        undoStack = [];
        state.mode = mode;
        emit('mode');
    }

    // ---- Undo ----------------------------------------------------------

    /** Snapshot live nodes/edges onto the undo stack. */
    function pushUndo(label) {
        undoStack.push({
            label: label || '',
            nodes: deepClone(state.nodes),
            edges: deepClone(state.edges),
            selection: state.selection ? deepClone(state.selection) : null
        });
        if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    }

    /** Pop the latest undo frame. Returns the label of the reversed action. */
    function undo() {
        var frame = undoStack.pop();
        if (!frame) return null;
        state.nodes = frame.nodes;
        state.edges = frame.edges;
        state.selection = frame.selection;
        // Rebroadcast as a wholesale replace so every surface re-renders.
        persist();
        emit('replace');
        return frame.label;
    }

    function canUndo() { return undoStack.length > 0; }
    function getUndoCount() { return undoStack.length; }

    function commitDraft() {
        if (!state.snapshot) return;
        state.snapshot = null;
        persist();
        emit('committed');
    }

    function revertDraft() {
        if (!state.snapshot) return;
        state.nodes = state.snapshot.nodes;
        state.edges = state.snapshot.edges;
        state.snapshot = null;
        state.selection = null;
        undoStack = [];
        emit('replace');
    }

    function hasUnsavedChanges() {
        return getUnsavedChangeCount() > 0;
    }

    /**
     * Count distinct dirty entities (nodes + edges) vs. the snapshot.
     * Layout-only edits (x/y) don't count — they auto-persist via persistPositions().
     */
    function getUnsavedChangeCount() {
        if (!state.snapshot) return 0;
        var stripPos = function (n) {
            var c = Object.assign({}, n); delete c.x; delete c.y; return c;
        };
        var byId = function (arr) {
            var m = Object.create(null);
            arr.forEach(function (x) { m[x.id] = x; });
            return m;
        };
        var count = 0;
        var liveNodes = byId(state.nodes.map(stripPos));
        var snapNodes = byId(state.snapshot.nodes.map(stripPos));
        Object.keys(liveNodes).forEach(function (id) {
            if (!snapNodes[id]) count += 1;
            else if (JSON.stringify(liveNodes[id]) !== JSON.stringify(snapNodes[id])) count += 1;
        });
        Object.keys(snapNodes).forEach(function (id) {
            if (!liveNodes[id]) count += 1;
        });
        var liveEdges = byId(state.edges);
        var snapEdges = byId(state.snapshot.edges);
        Object.keys(liveEdges).forEach(function (id) {
            if (!snapEdges[id]) count += 1;
            else if (JSON.stringify(liveEdges[id]) !== JSON.stringify(snapEdges[id])) count += 1;
        });
        Object.keys(snapEdges).forEach(function (id) {
            if (!liveEdges[id]) count += 1;
        });
        return count;
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function setView(view) {
        if (['diagram', 'table', 'api'].indexOf(view) === -1) return;
        state.view = view;
        emit('view');
    }

    // ---- Selection (tagged union) -------------------------------------

    function getSelection() { return state.selection; }

    function setSelection(sel) {
        state.selection = sel || null;
        emit('selection');
    }

    function clearSelection() {
        if (state.selection !== null) {
            state.selection = null;
            emit('selection');
        }
    }

    // Back-compat helpers — return non-null only when selection's kind matches
    function getSelectedId() {
        return state.selection && state.selection.kind === 'node' ? state.selection.id : null;
    }
    function getSelectedEdgeId() {
        return state.selection && state.selection.kind === 'edge' ? state.selection.id : null;
    }
    function getSelectedSystem() {
        return state.selection && state.selection.kind === 'system' ? state.selection.name : null;
    }
    function getSelectedAttribute() {
        return state.selection && state.selection.kind === 'attribute' ? state.selection : null;
    }

    function setSelected(id) {
        state.selection = id ? { kind: 'node', id: id } : null;
        emit('selection');
    }
    function setSelectedEdge(id) {
        state.selection = id ? { kind: 'edge', id: id } : null;
        emit('selection');
    }
    function setSelectedSystem(name) {
        state.selection = name ? { kind: 'system', name: name } : null;
        emit('selection');
    }
    function setSelectedAttribute(nodeId, columnName) {
        state.selection = (nodeId && columnName)
            ? { kind: 'attribute', nodeId: nodeId, name: columnName }
            : null;
        emit('selection');
    }

    /** Drop the current selection if it points at something that no longer exists. */
    function pruneSelection() {
        var sel = state.selection;
        if (!sel) return;
        if (sel.kind === 'node' && !getNode(sel.id)) state.selection = null;
        else if (sel.kind === 'edge' && !getEdge(sel.id)) state.selection = null;
        else if (sel.kind === 'system') {
            var has = state.nodes.some(function (n) { return n.system === sel.name; });
            if (!has) state.selection = null;
        }
        else if (sel.kind === 'attribute') {
            var n = getNode(sel.nodeId);
            var col = n && (n.columns || []).some(function (c) { return c.name === sel.name; });
            if (!col) state.selection = null;
        }
    }

    function getEdge(id) {
        for (var i = 0; i < state.edges.length; i++) {
            if (state.edges[i].id === id) return state.edges[i];
        }
        return null;
    }

    function updateEdge(id, patch) {
        var e = getEdge(id);
        if (!e) return;
        // Reject self-loops and duplicates
        var nextFrom = patch.from != null ? patch.from : e.from;
        var nextTo   = patch.to   != null ? patch.to   : e.to;
        if (nextFrom === nextTo) return;
        var dup = state.edges.some(function (other) {
            return other !== e && other.from === nextFrom && other.to === nextTo;
        });
        if (dup && (patch.from || patch.to)) return; // silently reject retarget that creates a duplicate
        Object.assign(e, patch);
        persist();
        emit('edges');
    }

    function moveNode(id, x, y) {
        var n = getNode(id);
        if (!n) return;
        n.x = x;
        n.y = y;
        // Mirror into the snapshot so cancel-from-edit doesn't revert layout.
        if (state.snapshot) {
            for (var i = 0; i < state.snapshot.nodes.length; i++) {
                if (state.snapshot.nodes[i].id === id) {
                    state.snapshot.nodes[i].x = x;
                    state.snapshot.nodes[i].y = y;
                    break;
                }
            }
        }
        // Layout is a UI preference: always-persist into the main state JSON,
        // but only the position fields — draft edits stay drafts.
        persistPositions();
        // Note: emit kept lightweight — caller (canvas drag) updates DOM directly.
    }

    function updateNode(id, patch) {
        var n = getNode(id);
        if (!n) return;
        // Snapshot before any structural column edit (add/remove/reorder/set
        // rename). Pure label/system/schema/tag/type edits don't push undo —
        // they're cheap to redo by hand and would flood the stack.
        if (patch && Array.isArray(patch.columns)) pushUndo('Attribute geändert');
        Object.assign(n, patch);
        pruneSelection();
        persist();
        emit('nodes');
    }

    function addNode(node) {
        var id = node.id || generateId(node.label || 'node');
        var fresh = Object.assign({
            id: id,
            type: 'table',
            label: id,
            system: '',
            schema: '',
            tags: [],
            columns: [],
            x: 100,
            y: 100
        }, node, { id: id });
        state.nodes.push(fresh);
        persist();
        emit('nodes');
        return fresh;
    }

    function deleteNode(id) {
        var n = getNode(id);
        pushUndo('Knoten "' + (n ? (n.label || n.id) : id) + '" gelöscht');
        state.nodes = state.nodes.filter(function (n) { return n.id !== id; });
        state.edges = state.edges.filter(function (e) { return e.from !== id && e.to !== id; });
        pruneSelection();
        persist();
        emit('nodes');
    }

    function addEdge(edge) {
        if (!edge.from || !edge.to || edge.from === edge.to) return null;
        // Deduplicate
        var exists = state.edges.some(function (e) {
            return e.from === edge.from && e.to === edge.to && (e.label || '') === (edge.label || '');
        });
        if (exists) return null;
        var fresh = Object.assign({
            id: 'e_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            label: ''
        }, edge);
        state.edges.push(fresh);
        persist();
        emit('edges');
        return fresh;
    }

    function deleteEdge(id) {
        pushUndo('Beziehung gelöscht');
        state.edges = state.edges.filter(function (e) { return e.id !== id; });
        pruneSelection();
        persist();
        emit('edges');
    }

    function replaceAll(payload) {
        state.nodes = payload.nodes || [];
        state.edges = payload.edges || [];
        state.selection = null;
        state.snapshot = null; // import discards any in-flight draft
        undoStack = [];        // and any in-flight undo history
        persist();
        emit('replace');
    }

    // ---- Helpers -------------------------------------------------------

    function generateId(label) {
        var base = String(label).toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '') || 'node';
        var id = base;
        var i = 2;
        while (getNode(id)) { id = base + '_' + i; i++; }
        return id;
    }

    /**
     * Property sets are derived from the distinct `column.set` free-text values
     * in node.columns, in first-appearance order. There is no separate
     * propertySets array on the node — the set name on each column IS the source
     * of truth.
     */
    function derivePropertySets(node) {
        if (!node || !node.columns) return [];
        var seen = Object.create(null);
        var out = [];
        node.columns.forEach(function (c) {
            var s = c && c.set;
            if (!s || seen[s]) return;
            seen[s] = true;
            out.push({ name: s });
        });
        return out;
    }

    return {
        load: load,
        reset: reset,
        on: on,
        get: get,
        getNodes: getNodes,
        getEdges: getEdges,
        getNode: getNode,
        getEdge: getEdge,
        getMode: getMode,
        getView: getView,
        getSelection: getSelection,
        getSelectedId: getSelectedId,
        getSelectedEdgeId: getSelectedEdgeId,
        getSelectedSystem: getSelectedSystem,
        getSelectedAttribute: getSelectedAttribute,
        setMode: setMode,
        commitDraft: commitDraft,
        revertDraft: revertDraft,
        hasUnsavedChanges: hasUnsavedChanges,
        getUnsavedChangeCount: getUnsavedChangeCount,
        undo: undo,
        canUndo: canUndo,
        getUndoCount: getUndoCount,
        pushUndo: pushUndo,
        setView: setView,
        setSelection: setSelection,
        clearSelection: clearSelection,
        setSelected: setSelected,
        setSelectedEdge: setSelectedEdge,
        setSelectedSystem: setSelectedSystem,
        setSelectedAttribute: setSelectedAttribute,
        moveNode: moveNode,
        updateNode: updateNode,
        addNode: addNode,
        deleteNode: deleteNode,
        addEdge: addEdge,
        updateEdge: updateEdge,
        deleteEdge: deleteEdge,
        replaceAll: replaceAll,
        generateId: generateId,
        persist: persist,
        derivePropertySets: derivePropertySets
    };
})();
