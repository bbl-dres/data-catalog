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

    // Bumped from v1 → v2 when the global `sets` registry was introduced
    // and column.set strings were replaced by column.setId references.
    // v1-shaped state in localStorage triggers a fresh seed load.
    var STORAGE_KEY = 'canvas.state.v2';
    // Drop the v1 key on load if present so the old shape can't leak.
    var LEGACY_STORAGE_KEY = 'canvas.state.v1';
    // Old separate layout key from an earlier iteration — drop too.
    var LEGACY_LAYOUT_KEY = 'canvas.layout.v1';
    var SEED_PATH = 'data/canvas.json';

    var state = {
        nodes: [],
        edges: [],
        sets: [],            // global property-set registry — see canvas.json
        // Curated entry-point view (scale + bbox-centre in world coords).
        // null = no curated view; Canvas.goHome falls back to initialView.
        // Treated as layout (always-saved, mirrored into snapshot) so that
        // pressing Cancel after setting a home view doesn't undo it — same
        // pattern as node positions.
        homeView: null,
        view: 'diagram',
        mode: 'view',
        // Tagged-union selection. Exactly one of node / edge / system /
        // attribute / set, or null. Mutually exclusive across kinds.
        //   { kind: 'node',      id: '<nodeId>' }
        //   { kind: 'edge',      id: '<edgeId>' }
        //   { kind: 'system',    name: '<systemName>' }
        //   { kind: 'attribute', nodeId: '<nodeId>', name: '<columnName>' }
        //   { kind: 'set',       id: '<setId>' }       // Datenpaket from the registry
        selection: null,
        // Faceted filter state — OR within a dimension, AND between dimensions.
        // Persisted via URL params (f.system, f.type, f.set, f.tag) so links
        // are shareable and the filter survives refresh. Independent of
        // selection and from the edit-mode draft snapshot.
        filters: { system: [], type: [], set: [], tag: [] },
        snapshot: null           // {nodes, edges} captured on entering edit; live data is the draft
    };

    var FILTER_DIMENSIONS = ['system', 'type', 'set', 'tag'];

    // Id-keyed indexes — getNode / getEdge / getSet are called from many hot
    // paths (edge rendering, drag, panel, isolation), so a linear scan was
    // the wrong shape. Rebuilt wholesale on load / replaceAll / undo /
    // revertDraft; patched on add / delete.
    var nodesById = Object.create(null);
    var edgesById = Object.create(null);
    var setsById  = Object.create(null);

    function rebuildIndex() {
        nodesById = Object.create(null);
        edgesById = Object.create(null);
        setsById  = Object.create(null);
        for (var i = 0; i < state.nodes.length; i++) nodesById[state.nodes[i].id] = state.nodes[i];
        for (var j = 0; j < state.edges.length; j++) edgesById[state.edges[j].id] = state.edges[j];
        for (var k = 0; k < state.sets.length;  k++) setsById[state.sets[k].id]   = state.sets[k];
    }

    // Undo stack for destructive / hard-to-redo edits. Frames now hold a
    // targeted inverse-op closure plus the captured selection — so a column
    // edit clones one node, not the entire graph. Capped at 50 frames.
    // Cleared on mode-change / load / replaceAll.
    var UNDO_LIMIT = 50;
    var undoStack = [];

    // Dirty tracking — replaces a per-emit JSON.stringify compare of every
    // node + edge against the snapshot. Map<key, 'added'|'modified'|'removed'>;
    // size === user-visible "ungespeicherte Änderungen" count. Approximate at
    // the edges (e.g. add-then-delete same id collapses to no-op; rename then
    // rename back stays as 1) but the dirty/clean signal is exact and the
    // perf is O(1) per mutation instead of O(N×M) per emit.
    var dirtyMap = new Map();
    function dkey(kind, id) { return kind + ':' + id; }
    function markAdded(kind, id) {
        // If we just added something we hadn't touched, mark as added.
        // (If it was previously 'removed', that means we re-added — treat as modified.)
        var k = dkey(kind, id);
        var cur = dirtyMap.get(k);
        if (cur === 'removed') dirtyMap.set(k, 'modified');
        else if (!cur) dirtyMap.set(k, 'added');
    }
    function markModified(kind, id) {
        var k = dkey(kind, id);
        if (dirtyMap.get(k) === 'added') return; // stays 'added'
        dirtyMap.set(k, 'modified');
    }
    function markRemoved(kind, id) {
        var k = dkey(kind, id);
        if (dirtyMap.get(k) === 'added') {
            // Net no-op: added in this draft, then removed.
            dirtyMap.delete(k);
            return;
        }
        dirtyMap.set(k, 'removed');
    }

    var listeners = [];

    function on(fn) { listeners.push(fn); }
    function emit(reason) {
        listeners.forEach(function (fn) { try { fn(reason); } catch (e) { console.error(e); } });
    }

    // ---- Loading -------------------------------------------------------

    function load() {
        // Migrate from earlier storage shapes (separate layout key, v1
        // schema without sets registry). Drop both so they can't leak.
        try { localStorage.removeItem(LEGACY_LAYOUT_KEY); } catch (e) {}
        try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (e) {}

        var stored = readStorage();
        // Require sets to be present — v1 state without it forces a re-seed
        // so the registry doesn't end up empty after an upgrade.
        if (stored && Array.isArray(stored.nodes) && Array.isArray(stored.sets)) {
            state.nodes = stored.nodes;
            state.edges = stored.edges || [];
            state.sets  = stored.sets;
            state.homeView = isValidHomeView(stored.homeView) ? stored.homeView : null;
            rebuildIndex();
            return Promise.resolve();
        }
        return fetch(SEED_PATH)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                state.nodes = data.nodes || [];
                state.edges = (data.edges || []).map(function (e, i) {
                    return Object.assign({ id: e.id || ('e' + i) }, e);
                });
                state.sets = data.sets || [];
                state.homeView = isValidHomeView(data.homeView) ? data.homeView : null;
                rebuildIndex();
                schedulePersist();
                flushPendingPersist(); // first paint write is fine to do synchronously
            })
            .catch(function (err) {
                console.error('Failed to load seed data', err);
                state.nodes = [];
                state.edges = [];
                state.sets = [];
                rebuildIndex();
            });
    }

    function readStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    // Persistence is debounced — every mutation used to drive a synchronous
    // ~150 KB JSON.stringify + localStorage.setItem; during inline editing
    // and node drag this dominated the main thread. Now: schedule a write,
    // coalesce within 200ms, flush on pagehide and commitDraft.
    var PERSIST_DEBOUNCE_MS = 200;
    var persistTimer = null;
    var persistPositionsPending = false;

    function schedulePersist() {
        if (persistTimer) return;
        persistTimer = setTimeout(function () {
            persistTimer = null;
            doPersist();
        }, PERSIST_DEBOUNCE_MS);
    }

    function flushPendingPersist() {
        if (persistTimer) {
            clearTimeout(persistTimer);
            persistTimer = null;
            doPersist();
        }
    }

    function doPersist() {
        // Draft-mode dual-write semantics:
        //   - Full state writes (everything except positions) are skipped while
        //     a draft is open — commitDraft / revertDraft drives those.
        //   - Position-only writes still flow through during edit so layout is
        //     auto-saved (matches prior behaviour).
        if (state.snapshot) {
            if (persistPositionsPending) {
                writePositionsOnly();
                persistPositionsPending = false;
            }
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                nodes: state.nodes,
                edges: state.edges,
                sets:  state.sets,
                homeView: state.homeView
            }));
        } catch (e) { /* quota — ignore */ }
        persistPositionsPending = false;
    }

    function persist() { schedulePersist(); }

    /**
     * Persist position changes into the main state JSON without committing
     * any draft data edits. Reads the existing main-state, copies live x/y
     * into it, writes back. Debounced so a 60 fps drag fires one write,
     * not 60.
     */
    function persistPositions() {
        if (!state.snapshot) {
            schedulePersist();
            return;
        }
        persistPositionsPending = true;
        schedulePersist();
    }

    function writePositionsOnly() {
        var existing = readStorage();
        if (!existing || !Array.isArray(existing.nodes)) return;
        var posByNode = Object.create(null);
        for (var i = 0; i < state.nodes.length; i++) {
            var n = state.nodes[i];
            posByNode[n.id] = { x: n.x || 0, y: n.y || 0 };
        }
        for (var j = 0; j < existing.nodes.length; j++) {
            var en = existing.nodes[j];
            var p = posByNode[en.id];
            if (p) { en.x = p.x; en.y = p.y; }
        }
        // homeView is layout, not data — same always-saved policy as
        // node positions, so it survives a Cancel from edit mode.
        existing.homeView = state.homeView;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        } catch (e) { /* quota */ }
    }

    // Don't lose work on tab close mid-debounce.
    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pagehide', flushPendingPersist);
        window.addEventListener('beforeunload', flushPendingPersist);
    }

    function reset() {
        if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        state.snapshot = null;
        dirtyMap.clear();
        return load().then(function () { emit('reset'); });
    }

    // ---- Accessors -----------------------------------------------------

    function get() { return state; }
    function getNodes() { return state.nodes; }
    function getEdges() { return state.edges; }
    function getNode(id) { return nodesById[id] || null; }
    function getSets()   { return state.sets; }
    function getSet(id)  { return id ? (setsById[id] || null) : null; }
    /** Convenience: setId → display label, falls back to the raw id. */
    function getSetLabel(id) {
        if (!id) return '';
        var s = setsById[id];
        return s ? (s.label || id) : id;
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
            dirtyMap.clear();
        } else if (mode === 'view' && state.snapshot) {
            // Defensive: leaving edit mode without commit/revert silently discards
            // the snapshot (live data wins). Normal UI flow always calls one of the
            // two paths, so this is a safety net.
            state.snapshot = null;
            dirtyMap.clear();
        }
        // Undo history is scoped to a single edit session.
        undoStack = [];
        state.mode = mode;
        emit('mode');
    }

    // ---- Undo ----------------------------------------------------------

    /**
     * Push a targeted inverse of the operation about to happen. Each frame
     * holds a closure that, when invoked, reverts just the affected entities
     * — so a column rename clones one node, not the entire graph.
     */
    function pushUndoOp(label, undoFn) {
        undoStack.push({
            label: label || '',
            undoFn: undoFn,
            selection: state.selection ? deepClone(state.selection) : null
        });
        if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    }

    /** Pop the latest undo frame. Returns the label of the reversed action. */
    function undo() {
        var frame = undoStack.pop();
        if (!frame) return null;
        try { frame.undoFn(); } catch (e) { console.error('undo failed', e); }
        state.selection = frame.selection;
        rebuildIndex();
        schedulePersist();
        emit('replace');
        return frame.label;
    }

    function canUndo() { return undoStack.length > 0; }
    function getUndoCount() { return undoStack.length; }

    function commitDraft() {
        if (!state.snapshot) return;
        state.snapshot = null;
        dirtyMap.clear();
        schedulePersist();
        flushPendingPersist();
        emit('committed');
    }

    function revertDraft() {
        if (!state.snapshot) return;
        state.nodes = state.snapshot.nodes;
        state.edges = state.snapshot.edges;
        state.snapshot = null;
        state.selection = null;
        undoStack = [];
        dirtyMap.clear();
        rebuildIndex();
        emit('replace');
    }

    function hasUnsavedChanges() { return dirtyMap.size > 0; }

    /**
     * Distinct dirty-entity count (nodes + edges) accumulated from mutation
     * APIs since enter-edit. Approximate at the edges (rename then rename back
     * still counts as 1) but the dirty/clean signal is exact, and replacing
     * the per-emit JSON.stringify-compare made the Save indicator effectively
     * free.
     */
    function getUnsavedChangeCount() {
        if (!state.snapshot) return 0;
        return dirtyMap.size;
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
    function getSelectedSet() {
        return state.selection && state.selection.kind === 'set' ? state.selection.id : null;
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
    function setSelectedSet(id) {
        state.selection = id ? { kind: 'set', id: id } : null;
        emit('selection');
    }

    // ---- Filters -------------------------------------------------------

    function getFilters() { return state.filters; }
    function getFilter(dim) {
        return (state.filters && state.filters[dim]) ? state.filters[dim].slice() : [];
    }
    function hasActiveFilters() {
        for (var i = 0; i < FILTER_DIMENSIONS.length; i++) {
            if ((state.filters[FILTER_DIMENSIONS[i]] || []).length > 0) return true;
        }
        return false;
    }
    function getFilterDimensions() { return FILTER_DIMENSIONS.slice(); }

    function setFilter(dim, values) {
        if (FILTER_DIMENSIONS.indexOf(dim) === -1) return;
        state.filters[dim] = Array.isArray(values) ? values.slice() : [];
        emit('filter');
    }

    /** Toggle a single value on/off in the given dimension. */
    function toggleFilter(dim, value) {
        if (FILTER_DIMENSIONS.indexOf(dim) === -1) return;
        var list = state.filters[dim] || [];
        var idx = list.indexOf(value);
        if (idx === -1) list.push(value);
        else list.splice(idx, 1);
        state.filters[dim] = list;
        emit('filter');
    }

    function removeFilterValue(dim, value) {
        if (FILTER_DIMENSIONS.indexOf(dim) === -1) return;
        var list = state.filters[dim] || [];
        var idx = list.indexOf(value);
        if (idx === -1) return;
        list.splice(idx, 1);
        state.filters[dim] = list;
        emit('filter');
    }

    function clearFilters() {
        var changed = hasActiveFilters();
        FILTER_DIMENSIONS.forEach(function (k) { state.filters[k] = []; });
        if (changed) emit('filter');
    }

    /**
     * Whether `node` satisfies the current filter set. AND across
     * dimensions, OR within. Empty dimension = no constraint. The set
     * dimension is special-cased: a node matches if any of its columns
     * has setId in the active filter — that's the lineage-atlas
     * semantic ("show every node touched by Adresse").
     */
    function matchesFilters(node) {
        if (!node) return false;
        var f = state.filters;
        if (f.system.length && f.system.indexOf(node.system || '') === -1) return false;
        if (f.type.length   && f.type.indexOf(node.type || '')     === -1) return false;
        if (f.tag.length) {
            var tags = node.tags || [];
            var hit = false;
            for (var i = 0; i < f.tag.length; i++) {
                if (tags.indexOf(f.tag[i]) !== -1) { hit = true; break; }
            }
            if (!hit) return false;
        }
        if (f.set.length) {
            var cols = node.columns || [];
            var sHit = false;
            for (var j = 0; j < cols.length; j++) {
                var sid = cols[j].setId;
                if (sid && f.set.indexOf(sid) !== -1) { sHit = true; break; }
            }
            if (!sHit) return false;
        }
        return true;
    }

    /**
     * Drop the current selection if it points at something that no longer
     * exists (or never did — e.g. a stale `selected=` from a shared URL).
     * Emits a `selection` event when it actually changes anything so the
     * URL sync + panel re-render in the same tick.
     */
    function pruneSelection() {
        var sel = state.selection;
        if (!sel) return;
        var prune = false;
        if (sel.kind === 'node' && !getNode(sel.id)) prune = true;
        else if (sel.kind === 'edge' && !getEdge(sel.id)) prune = true;
        else if (sel.kind === 'system') {
            var has = state.nodes.some(function (n) { return n.system === sel.name; });
            if (!has) prune = true;
        }
        else if (sel.kind === 'attribute') {
            var n = getNode(sel.nodeId);
            var col = n && (n.columns || []).some(function (c) { return c.name === sel.name; });
            if (!col) prune = true;
        }
        else if (sel.kind === 'set') {
            if (!getSet(sel.id)) prune = true;
        }
        if (prune) {
            state.selection = null;
            emit('selection');
        }
    }

    function getEdge(id) { return edgesById[id] || null; }

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
        markModified('edge', id);
        schedulePersist();
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
        // but only the position fields — draft edits stay drafts. Persist is
        // debounced so a 60 fps drag fires one localStorage write, not 60.
        persistPositions();
        // Note: emit kept lightweight — caller (canvas drag) updates DOM directly.
    }

    function updateNode(id, patch) {
        var n = getNode(id);
        if (!n) return;
        // Snapshot before any structural column edit (add/remove/reorder/set
        // rename). Pure label/system/schema/tag/type edits don't push undo —
        // they're cheap to redo by hand and would flood the stack.
        if (patch && Array.isArray(patch.columns)) {
            var beforeCols = (n.columns || []).map(function (c) { return Object.assign({}, c); });
            pushUndoOp('Attribute geändert', function () {
                var target = nodesById[id];
                if (target) target.columns = beforeCols;
            });
        }
        // Layout-only patches (x/y) don't dirty — drag has its own path.
        var isLayoutOnly = patch && Object.keys(patch).every(function (k) { return k === 'x' || k === 'y'; });
        Object.assign(n, patch);
        if (!isLayoutOnly) markModified('node', id);
        pruneSelection();
        schedulePersist();
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
        nodesById[id] = fresh;
        markAdded('node', id);
        schedulePersist();
        emit('nodes');
        return fresh;
    }

    function deleteNode(id) {
        var n = getNode(id);
        if (!n) return;
        // Capture just the affected node + its edges for undo — full-graph
        // clone was the previous shape and dominated edit-mode memory.
        var savedNode = JSON.parse(JSON.stringify(n));
        var savedEdges = state.edges
            .filter(function (e) { return e.from === id || e.to === id; })
            .map(function (e) { return JSON.parse(JSON.stringify(e)); });
        var savedDirtyForNode = dirtyMap.get(dkey('node', id));
        var savedDirtyForEdges = savedEdges.map(function (e) { return [e.id, dirtyMap.get(dkey('edge', e.id))]; });

        pushUndoOp('Knoten "' + (n.label || n.id) + '" gelöscht', function () {
            state.nodes.push(savedNode);
            for (var i = 0; i < savedEdges.length; i++) state.edges.push(savedEdges[i]);
            // Restore dirty marks so Save count behaves intuitively after undo.
            if (savedDirtyForNode) dirtyMap.set(dkey('node', id), savedDirtyForNode);
            else dirtyMap.delete(dkey('node', id));
            for (var j = 0; j < savedDirtyForEdges.length; j++) {
                var k = dkey('edge', savedDirtyForEdges[j][0]);
                if (savedDirtyForEdges[j][1]) dirtyMap.set(k, savedDirtyForEdges[j][1]);
                else dirtyMap.delete(k);
            }
        });

        state.nodes = state.nodes.filter(function (x) { return x.id !== id; });
        delete nodesById[id];
        var droppedEdgeIds = [];
        state.edges = state.edges.filter(function (e) {
            if (e.from === id || e.to === id) { droppedEdgeIds.push(e.id); return false; }
            return true;
        });
        for (var k = 0; k < droppedEdgeIds.length; k++) {
            delete edgesById[droppedEdgeIds[k]];
            markRemoved('edge', droppedEdgeIds[k]);
        }
        markRemoved('node', id);
        pruneSelection();
        schedulePersist();
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
        edgesById[fresh.id] = fresh;
        markAdded('edge', fresh.id);
        schedulePersist();
        emit('edges');
        return fresh;
    }

    function deleteEdge(id) {
        var e = getEdge(id);
        if (!e) return;
        var savedEdge = JSON.parse(JSON.stringify(e));
        var savedDirty = dirtyMap.get(dkey('edge', id));

        pushUndoOp('Beziehung gelöscht', function () {
            state.edges.push(savedEdge);
            if (savedDirty) dirtyMap.set(dkey('edge', id), savedDirty);
            else dirtyMap.delete(dkey('edge', id));
        });

        state.edges = state.edges.filter(function (x) { return x.id !== id; });
        delete edgesById[id];
        markRemoved('edge', id);
        pruneSelection();
        schedulePersist();
        emit('edges');
    }

    function replaceAll(payload) {
        state.nodes = payload.nodes || [];
        state.edges = payload.edges || [];
        // sets registry is preserved across import unless the imported
        // payload explicitly carries one. The set names referenced by
        // imported columns must match registry ids (validated at import).
        if (Array.isArray(payload.sets)) state.sets = payload.sets;
        // homeView: only overwrite if the payload carries a valid one.
        // Excel imports don't include homeView, so the existing curated
        // entry-point survives a re-import of the data sheets. JSON
        // imports can carry homeView and it wins when present.
        if (payload.hasOwnProperty('homeView')) {
            state.homeView = isValidHomeView(payload.homeView) ? payload.homeView : null;
        }
        state.selection = null;
        state.snapshot = null; // import discards any in-flight draft
        undoStack = [];        // and any in-flight undo history
        dirtyMap.clear();
        rebuildIndex();
        schedulePersist();
        emit('replace');
    }

    // ---- Home view -----------------------------------------------------

    function isValidHomeView(v) {
        return !!v
            && typeof v.scale   === 'number' && isFinite(v.scale)   && v.scale > 0
            && typeof v.centerX === 'number' && isFinite(v.centerX)
            && typeof v.centerY === 'number' && isFinite(v.centerY);
    }

    function getHomeView() { return state.homeView; }

    /**
     * Capture / clear the curated entry-point view. Persists immediately
     * (always-saved, like node positions) so a Cancel from edit mode
     * doesn't undo it. Pass null to clear.
     */
    function setHomeView(v) {
        if (v === null) {
            state.homeView = null;
        } else if (isValidHomeView(v)) {
            state.homeView = { scale: v.scale, centerX: v.centerX, centerY: v.centerY };
        } else {
            return; // silently reject malformed input
        }
        persistPositions(); // reuses the layout-merge path so draft state is OK
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
     * Property sets shown for a node. Each entry is `{ id, label, kind }`,
     * where `kind` is 'set' for entries from the global registry and
     * 'sap' for SAP BAPI substructures on the API node.
     *
     * Default grouping (`node.groupBy === 'setId'`, the implicit case) reads
     * `column.setId` and looks the label up in the global registry. The SAP
     * API node uses `node.groupBy === 'sourceStructure'` — its columns group
     * by `column.sourceStructure` instead, with labels from the per-node
     * `node.sourceStructures` map. Sets are emitted in first-appearance
     * order so the panel/canvas UI is stable across renders.
     */
    function derivePropertySets(node) {
        if (!node || !node.columns) return [];
        var groupBy = node.groupBy === 'sourceStructure' ? 'sourceStructure' : 'setId';
        var seen = Object.create(null);
        var out = [];

        if (groupBy === 'sourceStructure') {
            // Build a per-node label lookup from node.sourceStructures (array
            // of { id, label }) so the canvas can show "ARCH_REL" with the
            // German "Architekturverknüpfung" subtitle when needed.
            var sapLabels = Object.create(null);
            (node.sourceStructures || []).forEach(function (s) { sapLabels[s.id] = s.label; });
            for (var i = 0; i < node.columns.length; i++) {
                var key = node.columns[i].sourceStructure;
                if (!key || seen[key]) continue;
                seen[key] = true;
                out.push({ id: key, label: sapLabels[key] || key, kind: 'sap' });
            }
            return out;
        }

        // Default: setId-based grouping via the global registry.
        for (var j = 0; j < node.columns.length; j++) {
            var setId = node.columns[j].setId;
            if (!setId || seen[setId]) continue;
            seen[setId] = true;
            out.push({ id: setId, label: getSetLabel(setId), kind: 'set' });
        }
        return out;
    }

    /** Which column field this node groups by. UI uses this to read the right field. */
    function getGroupKey(node) {
        return node && node.groupBy === 'sourceStructure' ? 'sourceStructure' : 'setId';
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
        getSets: getSets,
        getSet: getSet,
        getSetLabel: getSetLabel,
        getGroupKey: getGroupKey,
        getMode: getMode,
        getView: getView,
        getSelection: getSelection,
        getSelectedId: getSelectedId,
        getSelectedEdgeId: getSelectedEdgeId,
        getSelectedSystem: getSelectedSystem,
        getSelectedAttribute: getSelectedAttribute,
        getSelectedSet: getSelectedSet,
        setMode: setMode,
        commitDraft: commitDraft,
        revertDraft: revertDraft,
        hasUnsavedChanges: hasUnsavedChanges,
        getUnsavedChangeCount: getUnsavedChangeCount,
        undo: undo,
        canUndo: canUndo,
        getUndoCount: getUndoCount,
        setView: setView,
        setSelection: setSelection,
        clearSelection: clearSelection,
        setSelected: setSelected,
        setSelectedEdge: setSelectedEdge,
        setSelectedSystem: setSelectedSystem,
        setSelectedAttribute: setSelectedAttribute,
        setSelectedSet: setSelectedSet,
        getFilters: getFilters,
        getFilter: getFilter,
        getFilterDimensions: getFilterDimensions,
        hasActiveFilters: hasActiveFilters,
        setFilter: setFilter,
        toggleFilter: toggleFilter,
        removeFilterValue: removeFilterValue,
        clearFilters: clearFilters,
        matchesFilters: matchesFilters,
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
        pruneSelection: pruneSelection,
        getHomeView: getHomeView,
        setHomeView: setHomeView,
        derivePropertySets: derivePropertySets
    };
})();
