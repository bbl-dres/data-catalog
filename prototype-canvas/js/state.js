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

    var state = {
        nodes: [],
        edges: [],
        sets: [],            // global property-set registry — see canvas.json
        systems: [],         // per-system metadata (Phase 2 RPC), keyed by name
        // Multi-canvas (v0.4):
        //   canvases — overview list (id, slug, label_de, …) for the landing view
        //   currentCanvasSlug — null when on the overview, otherwise the loaded canvas
        //   currentCanvas — { id, slug, label, description, visibility } from the RPC
        canvases: [],
        currentCanvasSlug: null,
        currentCanvas: null,
        // Curated entry-point view (scale + bbox-centre in world coords).
        // null = no curated view; Canvas.goHome falls back to initialView.
        // Treated as layout (always-saved, mirrored into snapshot) so that
        // pressing Cancel after setting a home view doesn't undo it — same
        // pattern as node positions.
        homeView: null,
        view: 'overview',
        mode: 'view',
        // Tagged-union selection. Exactly one of node / edge / system /
        // attribute / set, or null. Mutually exclusive across kinds.
        //   { kind: 'node',      id: '<nodeId>' }
        //   { kind: 'edge',      id: '<edgeId>' }
        //   { kind: 'system',    name: '<systemName>' }
        //   { kind: 'attribute', nodeId: '<nodeId>', name: '<columnName>' }
        //   { kind: 'set',       id: '<setId>' }       // Datenpaket from the registry
        selection: null,
        // String describing a Supabase load failure, or null on success.
        // Set by load() so views can render an in-place error overlay.
        loadError: null,
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

    // Event-reason vocabulary. Listeners typically do `if (reason === 'nodes' || reason === 'edges' …)`;
    // the string-typo failure mode there is "listener silently never fires"
    // — easy to introduce, hard to spot. Exposing the set as constants
    // (and on the public surface as State.EVENTS) lets call sites use
    // identifiers that fail loudly when mistyped.
    //
    // Payload contract per reason:
    //   'nodes' / 'edges'   → optional id (string) of the single mutated entity.
    //                         Absent payload means "bulk change, listeners
    //                         should rebuild from getNodes/getEdges". See
    //                         canvas.js renderNodeIncremental for the
    //                         payload-driven path.
    //   'replace' / 'reset' → no payload. Major data flip (canvas swap, undo,
    //                         server reload).
    //   All others          → no payload.
    var EVENTS = {
        REPLACE:    'replace',
        RESET:      'reset',
        NODES:      'nodes',
        EDGES:      'edges',
        MODE:       'mode',
        SELECTION:  'selection',
        FILTER:     'filter',
        VIEW:       'view',
        CANVAS:     'canvas',
        HOME:       'home',
        COMMITTING: 'committing',
        COMMITTED:  'committed',
        LOADING:    'loading'
    };

    function on(fn) { listeners.push(fn); }
    // Optional `payload` lets a mutator scope its emit to a single id (e.g.
    // updateNode passes the affected node id). Listeners that don't care
    // ignore the extra arg — the signature is fully backward-compatible.
    function emit(reason, payload) {
        listeners.forEach(function (fn) {
            try { fn(reason, payload); } catch (e) { console.error(e); }
        });
    }

    // ---- Loading -------------------------------------------------------

    // Supabase is the only source of truth. No localStorage seed cache, no
    // canvas.json fallback — those would risk showing stale or wrong data
    // after the DB updates. On failure (offline, RPC error, ...) we surface
    // an error message via state.loadError; the views render an overlay.
    //
    // load() dispatches based on the current view:
    //   * view = 'overview'  → fetch the canvas list via listCanvases()
    //   * view ∈ {diagram, table, api} with a slug → fetch canvas_export(slug)
    //   * any other shape → empty
    // Loading flag — true while State.load()'s underlying RPC is in flight.
    // Lets UI distinguish "still fetching" from "fetched and empty". Without
    // it, the canvas-empty placeholder briefly flashes during the boot
    // sequence (initial state has 0 nodes, load() runs, page paints, data
    // arrives, paints again).
    var loading = false;
    function isLoading() { return loading; }

    // Monotonic load counter — every call to load() bumps it. Inner
    // promise continuations (loadCanvasContent's .then in particular)
    // check whether their captured count still matches before mutating
    // state.* — this prevents a slow-resolving fetch for canvas A from
    // overwriting freshly-loaded canvas B data after the user clicked B.
    //
    // Without this gate the same-tab race went: load(A) starts → user
    // clicks B → load(B) starts → B resolves first, paints → A resolves
    // afterwards, overwrites state.nodes with A's data, fires
    // 'replace' → graph view rebuilds against A's stale nodes while the
    // breadcrumb says B. The Diagramm view appeared to "work" because
    // its explicit render in app.js loadAndRender is loadToken-gated; the
    // graph view was hit because its rebuild fires from the listener-
    // driven 'replace' path.
    var loadCounter = 0;
    function isCurrentLoad(myCount) { return myCount === loadCounter; }

    function load() {
        try { localStorage.removeItem(LEGACY_LAYOUT_KEY); } catch (e) {}
        try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (e) {}
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

        var myCount = ++loadCounter;

        if (!window.CanvasApp.SupabaseClient) {
            state.loadError = 'SupabaseClient nicht geladen.';
            clearCanvasData();
            state.canvases = [];
            // Emit 'replace' so listener-driven views (Graph, Panel, etc.)
            // re-render against the now-cleared state. Without this, modules
            // that bootstrap via listeners (rather than the explicit calls
            // in app.js loadAndRender) get stranded showing stale data.
            emit('replace');
            return Promise.resolve();
        }

        loading = true;
        emit('loading');
        var p = (state.view === 'overview' || !state.currentCanvasSlug)
            ? loadCanvasList(myCount)
            : loadCanvasContent(state.currentCanvasSlug, myCount);
        return p.then(function () {
            // Stale guard — a newer load() has bumped loadCounter past
            // myCount, so the inner mutation already bailed and we must
            // also suppress the emit (otherwise the listener-driven
            // re-render would run with whatever state.nodes happens to
            // hold, which is the newer load's data — harmless in this
            // direction, but the duplicate render is wasted work).
            if (!isCurrentLoad(myCount)) return;
            loading = false;
            emit('loading');
            // Tell view modules data has been wholesale replaced. Critical
            // for two paths that don't go through app.js loadAndRender's
            // explicit render calls:
            //   1. Initial direct-load on /graph — Graph listener gates on
            //      'replace' to schedule its layout post-fetch.
            //   2. Post-import re-render — commitImport returns load() and
            //      relies entirely on this emit to propagate the new data.
            emit('replace');
        }, function (err) {
            if (!isCurrentLoad(myCount)) return;
            loading = false;
            emit('loading');
            throw err;
        });
    }

    function loadCanvasList(myCount) {
        return window.CanvasApp.SupabaseClient.listCanvases()
            .then(function (canvases) {
                if (!isCurrentLoad(myCount)) return; // newer load took over
                state.loadError = null;
                state.canvases = canvases || [];
                clearCanvasData();
            })
            .catch(function (err) {
                if (!isCurrentLoad(myCount)) return;
                console.error('Failed to list canvases', err);
                state.loadError = err && err.message
                    ? String(err.message)
                    : 'Unbekannter Fehler beim Laden der Canvas-Übersicht.';
                state.canvases = [];
                clearCanvasData();
            });
    }

    function loadCanvasContent(slug, myCount) {
        return window.CanvasApp.SupabaseClient.loadCanvas(slug)
            .then(function (data) {
                // Stale-load gate: a newer load() bumped loadCounter past
                // ours, so its mutations are already on state. Ours are
                // expired and must NOT touch state — otherwise the older
                // canvas's data would clobber the newer canvas's data
                // (see the long comment on `loadCounter` above for the
                // race scenario this prevents).
                if (!isCurrentLoad(myCount)) return;
                if (!data) {
                    state.loadError = 'Canvas "' + slug + '" wurde nicht gefunden.';
                    clearCanvasData();
                    return;
                }
                state.loadError = null;
                state.currentCanvas = data.canvas || { slug: slug, label: slug };
                state.nodes = data.nodes || [];
                state.edges = (data.edges || []).map(function (e, i) {
                    return Object.assign({ id: e.id || ('e' + i) }, e);
                });
                state.sets = data.sets || [];
                // Phase 2: per-system metadata (technology_stack, base_url, …)
                // keyed off the same label that distributions carry in their
                // `system` field. The system panel looks these up by name.
                state.systems = data.systems || [];
                state.homeView = isValidHomeView(data.homeView) ? data.homeView : null;
                rebuildIndex();
            })
            .catch(function (err) {
                if (!isCurrentLoad(myCount)) return;
                console.error('Failed to load canvas from Supabase', err);
                state.loadError = err && err.message
                    ? String(err.message)
                    : 'Unbekannter Fehler beim Laden der Daten.';
                clearCanvasData();
            });
    }

    function clearCanvasData() {
        state.nodes = []; state.edges = []; state.sets = []; state.systems = [];
        state.currentCanvas = null;
        state.homeView = null;
        rebuildIndex();
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
    /** Phase 2: per-system metadata keyed by the label string used in
     *  distribution.system. Returns null when no entry exists (e.g. the
     *  current data hasn't populated system_meta yet). */
    function getSystems()      { return state.systems || []; }
    function getSystemMeta(name) {
        if (!name) return null;
        var arr = state.systems || [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].name === name) return arr[i];
        }
        return null;
    }
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
            // homeView is included so a Cancel after "Standardansicht
            // speichern" actually undoes the new home view.
            state.snapshot = deepClone({
                nodes: state.nodes,
                edges: state.edges,
                homeView: state.homeView
            });
            dirtyMap.clear();
        } else if (mode === 'view' && state.snapshot) {
            // Reached by the "Save with no changes" path (app.js btn-save):
            // user entered edit mode, made no edits, clicked Save → snapshot
            // is set, hasUnsavedChanges() returned false, so we skip the
            // RPC and just transition back to view. The snapshot can be
            // dropped silently because there's nothing to preserve.
            // Other safety-net cases (a hypothetical caller bypassing
            // commit/revert) get the same treatment.
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

    // Re-entrancy guard for commit/import. Set true while an applyCanvas RPC
    // is in flight; mutator functions check this and reject so a fast click
    // mid-save can't slip an edit into `state.nodes` between the payload
    // being serialised and the success handler clearing dirtyMap (which
    // would silently erase the new edit's dirty mark and orphan its data).
    // Exposed via isCommitting() so the UI can disable Save+Edit affordances.
    var committing = false;
    function isCommitting() { return committing; }

    // Defensive mutator gate. The UI disables Save/Cancel/Undo during a
    // commit; this is a second line of defence for paths that bypass the
    // toolbar — drag-in-progress that started before commit, keyboard
    // shortcuts, programmatic mutations from extensions, etc.
    function guardMutation(name) {
        if (committing) {
            // Don't throw — a thrown error from a pointer handler can leave
            // gestures stuck (drag/pan never gets its post-handler). Quiet
            // noop, with a console warning for the rare case it surfaces.
            console.warn('State.' + name + ' ignored: commit in flight.');
            return true;
        }
        return false;
    }

    /**
     * Server-side commit. Serialises the current (draft) state into the
     * DB-shape payload accepted by the canvas_apply() RPC, posts it, and
     * only on success closes the snapshot + clears dirty marks.
     *
     * Returns a Promise so the Speichern UI can await + handle errors —
     * on rejection the snapshot is *kept* so the user doesn't lose work.
     */
    function commitDraft() {
        if (!state.snapshot) return Promise.resolve();
        if (committing) {
            return Promise.reject(new Error('Speichern läuft bereits.'));
        }
        var slug = state.currentCanvasSlug;
        if (!slug) return Promise.reject(new Error('Kein Canvas geladen.'));
        var Sb = window.CanvasApp.SupabaseClient;
        if (!Sb || !Sb.applyCanvas) {
            return Promise.reject(new Error('Supabase nicht verfügbar.'));
        }
        var payload = serializeDraftToPayload();
        committing = true;
        emit('committing'); // let UI disable Save / Edit / etc.
        return Sb.applyCanvas(slug, payload).then(function () {
            state.snapshot = null;
            dirtyMap.clear();
            // No localStorage persist — server is the source of truth now.
            // schedulePersist's existing draft-mode-no-write semantics still
            // hold; on the next mutation outside edit mode (none expected
            // immediately after commit), the localStorage cache will refresh.
            committing = false;
            emit('committed');
        }, function (err) {
            committing = false;
            emit('committing'); // clear UI guard
            throw err;
        });
    }

    /**
     * Atomic server-side replace from a parsed Excel payload (frontend-shape:
     * { nodes, edges, sets, homeView? }). Bypasses the snapshot/draft model —
     * Excel import is meant to be a single transactional save, not something
     * the user reviews node-by-node.
     *
     * Implementation: temporarily install the parsed data into state, run
     * the existing serializeDraftToPayload over it, restore the original
     * state, then fire applyCanvas. On success, load() pulls server-truth
     * back which triggers the normal re-render path.
     */
    function commitImport(parsed) {
        if (!parsed || !Array.isArray(parsed.nodes)) {
            return Promise.reject(new Error('Ungültiges Import-Format.'));
        }
        if (committing) {
            return Promise.reject(new Error('Speichern läuft bereits.'));
        }
        var slug = state.currentCanvasSlug;
        if (!slug) return Promise.reject(new Error('Kein Canvas geladen.'));
        var Sb = window.CanvasApp.SupabaseClient;
        if (!Sb || !Sb.applyCanvas) {
            return Promise.reject(new Error('Supabase nicht verfügbar.'));
        }

        // Build the import payload *without* mutating live state. The
        // previous "install → serialise → restore" pattern briefly broke
        // every reactive consumer (panel, minimap rAFs running mid-mutation
        // saw the parsed payload as live data, then the original came back).
        // serializeDraftToPayload now accepts an explicit source.
        var payload = serializeDraftToPayload({
            nodes: parsed.nodes,
            edges: (parsed.edges || []).map(function (e, i) {
                return Object.assign({ id: e.id || ('e' + i) }, e);
            }),
            sets: Array.isArray(parsed.sets) ? parsed.sets : state.sets,
            homeView: parsed.hasOwnProperty('homeView')
                ? (isValidHomeView(parsed.homeView) ? parsed.homeView : null)
                : state.homeView
        });

        committing = true;
        emit('committing');
        return Sb.applyCanvas(slug, payload).then(function () {
            // Server now holds the imported content; pull it back as truth.
            state.snapshot = null;
            dirtyMap.clear();
            committing = false;
            return load();
        }, function (err) {
            committing = false;
            emit('committing');
            throw err;
        });
    }

    /**
     * Translate the in-memory draft into the DB-shape payload accepted by
     * canvas_apply(). The frontend stores a denormalised view (column lists
     * inline on each node, system as a label rather than a node, etc.); the
     * payload re-derives the explicit catalog rows.
     *
     * Decomposition: each helper below owns one section of the payload. The
     * orchestrator threads slug-by-name maps between them so cross-section
     * edges (system→distribution, attribute→pset) reference consistent ids.
     *
     * KNOWN DATA LOSSES on round-trip — the frontend doesn't represent
     * these, so a save WILL delete them from the DB. Each lossy field is
     * documented at the helper that omits it; collected here as a punch
     * list:
     *   - serializeDistributions — `standard_reference` nodes (the frontend
     *     models only `distribution` and `code_list` kinds).
     *   - serializeFlowEdges — `derives_from`, `replaces`, `fk_references`,
     *     `values_from` edge types (frontend collapses inter-node edges to
     *     `flows_into`).
     *   - serializeDistributions — multiple psets per attribute (frontend
     *     stores a single `setId`).
     *   - serializeSystems — per-system `technology_stack`, `base_url`,
     *     `security_zone` metadata (frontend stores only the system label).
     */
    function serializeDraftToPayload(source) {
        // Default source = live state. commitImport passes an explicit
        // source so it can serialise the parsed Excel payload without
        // mutating live state mid-flight (which used to flicker every
        // reactive consumer for the duration of the serialisation).
        var srcNodes    = source ? source.nodes    : state.nodes;
        var srcEdges    = source ? source.edges    : state.edges;
        var srcSets     = source ? source.sets     : state.sets;
        var srcHomeView = source ? source.homeView : state.homeView;

        // 1. Systems — derive slugs from unique labels.
        var sysOut = serializeSystems(srcNodes);
        // 2. Psets — pure slug-by-id from the registry.
        var psetOut = serializePsets(srcSets);
        // 3. Distributions + codelists + their attributes / entries.
        var distOut = serializeDistributions(srcNodes, sysOut.sysSlugByLabel, psetOut.psetSlugById);
        // 4. Inter-node flows_into edges.
        var flowEdges = serializeFlowEdges(srcNodes, srcEdges);
        // 5. Optional canvas-level metadata (home view).
        var canvasMeta = serializeCanvasMeta(srcHomeView);

        return {
            canvas:            canvasMeta,
            nodes:             sysOut.nodes
                                 .concat(psetOut.nodes)
                                 .concat(distOut.nodes),
            system_meta:       sysOut.system_meta,
            distribution_meta: distOut.distribution_meta,
            attribute_meta:    distOut.attribute_meta,
            code_list_entry:   distOut.code_list_entry,
            edges:             distOut.edges.concat(flowEdges)
        };
    }

    /**
     * Section 1: derive `sys:<slug>` nodes from the unique system labels in
     * use across `srcNodes`. Returns the new node rows, the side-table
     * meta rows, and a label→slug map for downstream "publishes" edges.
     *
     * LOSSY: per-system `technology_stack`, `base_url`, `security_zone` —
     * the frontend stores only the label string, so `system_meta` rows
     * carry no extra fields. Re-import from DB restores those columns,
     * but a save-from-frontend overwrites them with empty.
     */
    function serializeSystems(srcNodes) {
        var sysSlugByLabel = Object.create(null);
        srcNodes.forEach(function (n) {
            var sys = (n.system || '').trim();
            if (!sys || sysSlugByLabel[sys]) return;
            sysSlugByLabel[sys] = 'sys:' + slugify(sys);
        });
        var nodes = [];
        var system_meta = [];
        Object.keys(sysSlugByLabel).forEach(function (label) {
            var slug = sysSlugByLabel[label];
            nodes.push({
                slug: slug, kind: 'system',
                label_de: label,
                lifecycle_status: 'produktiv'
            });
            // Minimal row — preserves the side-table-exists invariant
            // without making up data the frontend doesn't track.
            system_meta.push({ node_slug: slug });
        });
        return { nodes: nodes, system_meta: system_meta, sysSlugByLabel: sysSlugByLabel };
    }

    /**
     * Section 2: emit a `pset:<id>` node per registry entry. The seed
     * format concatenates description + lineage with "\n\nLineage: "
     * (canvas_export's splitter relies on that exact separator on round-
     * trip). Returns the new node rows + an id→slug map.
     */
    function serializePsets(srcSets) {
        var psetSlugById = Object.create(null);
        var nodes = [];
        (srcSets || []).forEach(function (s) {
            var slug = 'pset:' + s.id;
            psetSlugById[s.id] = slug;
            var description = s.description || '';
            if (s.lineage) {
                description = description
                    ? description + '\n\nLineage: ' + s.lineage
                    : 'Lineage: ' + s.lineage;
            }
            nodes.push({
                slug: slug, kind: 'pset',
                label_de: s.label || s.id,
                description_de: description || null,
                lifecycle_status: 'produktiv'
            });
        });
        return { nodes: nodes, psetSlugById: psetSlugById };
    }

    /**
     * Section 3: per node, emit either a `distribution` or `code_list`
     * row, the matching side-table row, the `publishes` edge from its
     * system, and one row per column (attributes for distributions,
     * code_list_entry for codelists). Pulls in slug maps from sections
     * 1 + 2 for the cross-references.
     *
     * LOSSY:
     *  - `standard_reference` kind (frontend only models distribution +
     *    code_list).
     *  - Multiple psets per attribute (frontend stores a single
     *    `c.setId`; multi-pset memberships in the DB get squashed to one
     *    on the next save).
     */
    function serializeDistributions(srcNodes, sysSlugByLabel, psetSlugById) {
        var nodes = [];
        var distribution_meta = [];
        var attribute_meta = [];
        var code_list_entry = [];
        var edges = [];

        srcNodes.forEach(function (n) {
            var isCodelist = n.type === 'codelist';
            var nodeSlug = (isCodelist ? 'cl:' : 'dist:') + n.id;

            nodes.push({
                slug: nodeSlug, kind: isCodelist ? 'code_list' : 'distribution',
                label_de: n.label || n.id,
                tags: Array.isArray(n.tags) ? n.tags : [],
                x: n.x != null ? n.x : null,
                y: n.y != null ? n.y : null,
                lifecycle_status: 'produktiv'
            });

            if (!isCodelist) {
                distribution_meta.push({
                    node_slug: nodeSlug,
                    type: n.type || 'table',
                    schema_name: n.schema || null
                });
            }

            // System → distribution `publishes` edge.
            var sysLabel = (n.system || '').trim();
            if (sysLabel && sysSlugByLabel[sysLabel]) {
                edges.push({
                    from_slug: sysSlugByLabel[sysLabel],
                    to_slug:   nodeSlug,
                    edge_type: 'publishes'
                });
            }

            // Columns: attributes for distributions, entries for codelists.
            (n.columns || []).forEach(function (c, idx) {
                if (isCodelist) {
                    code_list_entry.push({
                        code_list_node_slug: nodeSlug,
                        code:     c.name,
                        label_de: c.type, // codelist convention: name=code, type=label
                        sort_order: idx
                    });
                    return;
                }
                var attrName = c.name || ('col_' + idx);
                var safeName = slugifyAttrPart(attrName);
                var safeStruct = c.sourceStructure ? slugifyAttrPart(c.sourceStructure) : '';
                var attrSlug = 'attr:' + n.id + (safeStruct ? '.' + safeStruct : '') + '.' + safeName;
                nodes.push({
                    slug: attrSlug, kind: 'attribute',
                    label_de: attrName,
                    lifecycle_status: 'produktiv'
                });
                attribute_meta.push({
                    node_slug: attrSlug,
                    technical_name: attrName,
                    data_type: c.type || null,
                    key_role:  (c.key && c.key !== '-') ? c.key : null,
                    source_structure: c.sourceStructure || null,
                    sort_order: idx
                });
                edges.push({
                    from_slug: nodeSlug,
                    to_slug:   attrSlug,
                    edge_type: 'contains'
                });
                if (c.setId && psetSlugById[c.setId]) {
                    edges.push({
                        from_slug: attrSlug,
                        to_slug:   psetSlugById[c.setId],
                        edge_type: 'in_pset'
                    });
                }
            });
        });

        return {
            nodes: nodes,
            distribution_meta: distribution_meta,
            attribute_meta: attribute_meta,
            code_list_entry: code_list_entry,
            edges: edges
        };
    }

    /**
     * Section 4: inter-node `flows_into` edges. We resolve endpoint kind
     * from the source node array (NOT the live `nodesById` index, which
     * only knows about live state — an import payload would miss).
     *
     * LOSSY: `derives_from`, `replaces`, `fk_references`, `values_from`
     * edge types. The frontend collapses all inter-node relationships to
     * `flows_into` because those are the only ones the diagram visualises.
     */
    function serializeFlowEdges(srcNodes, srcEdges) {
        var srcNodesById = Object.create(null);
        for (var i = 0; i < srcNodes.length; i++) {
            srcNodesById[srcNodes[i].id] = srcNodes[i];
        }
        var edges = [];
        srcEdges.forEach(function (e) {
            var fromN = srcNodesById[e.from];
            var toN   = srcNodesById[e.to];
            if (!fromN || !toN) return;
            var fp = fromN.type === 'codelist' ? 'cl:' : 'dist:';
            var tp = toN.type   === 'codelist' ? 'cl:' : 'dist:';
            edges.push({
                from_slug: fp + e.from,
                to_slug:   tp + e.to,
                edge_type: 'flows_into',
                label_de:  e.label || null
            });
        });
        return edges;
    }

    /**
     * Section 5: optional canvas-level metadata. Stringifies the home-view
     * floats because the canvas table stores them as TEXT (so the same
     * column accepts the freeform other-meta fields the schema also uses).
     */
    function serializeCanvasMeta(srcHomeView) {
        if (!srcHomeView) return null;
        return {
            home_scale:    String(srcHomeView.scale),
            home_center_x: String(srcHomeView.centerX),
            home_center_y: String(srcHomeView.centerY)
        };
    }

    function slugify(s) {
        return String(s || '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }
    /**
     * Slug fragment normaliser for attribute slugs — preserves more characters
     * than slugify() because the seed uses uppercase + underscores in
     * technical names (OBJECT_ID, MEASUREMENT) and we want round-trip
     * stability with the existing data.
     */
    function slugifyAttrPart(s) {
        return String(s || '').replace(/[^A-Za-z0-9_.-]+/g, '_');
    }

    function revertDraft() {
        if (!state.snapshot) return;
        state.nodes = state.snapshot.nodes;
        state.edges = state.snapshot.edges;
        // Restore homeView too — Cancel after "Standardansicht speichern"
        // should undo the new home view in addition to nodes/edges.
        // Snapshot may not have the field if it was created pre-fix; treat
        // missing as null (no home view) rather than leaving the live one.
        state.homeView = state.snapshot.hasOwnProperty('homeView')
            ? (state.snapshot.homeView || null)
            : null;
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
        // structuredClone is faster + handles cycles, Map/Set, typed
        // arrays, dates, etc. Fallback to JSON for the rare environment
        // (very old WebView) without it. Our payloads are plain JSON so
        // the fallback is functionally identical.
        if (typeof structuredClone === 'function') {
            return structuredClone(obj);
        }
        return JSON.parse(JSON.stringify(obj));
    }

    function setView(view) {
        if (['overview', 'diagram', 'table', 'graph', 'api'].indexOf(view) === -1) return;
        state.view = view;
        emit('view');
    }

    function getCurrentCanvasSlug() { return state.currentCanvasSlug; }
    function getCurrentCanvas()     { return state.currentCanvas; }
    function getCanvases()          { return state.canvases; }

    function setCurrentCanvasSlug(slug) {
        var next = slug || null;
        if (state.currentCanvasSlug === next) return;

        // The draft snapshot belongs to the canvas we're leaving — once the
        // current slug changes, the snapshot would point at nodes that no
        // longer exist (or that mean something different in the new canvas).
        // Reset edit-mode state to keep the in-memory model consistent.
        // The user-facing "Ungespeicherte Änderungen verwerfen?" prompt
        // happens at the navigation entry points (App.wireHomeLink, etc.) —
        // by the time we reach this setter the user has already opted in.
        if (state.snapshot) {
            state.snapshot = null;
            dirtyMap.clear();
            undoStack = [];
            if (state.mode !== 'view') {
                state.mode = 'view';
                emit('mode');
            }
        }

        state.currentCanvasSlug = next;
        // Drop any per-canvas in-memory state so a stale node from a previous
        // canvas can't bleed into the new one before load() runs.
        if (next === null) {
            clearCanvasData();
        }
        emit('canvas');
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
        if (guardMutation('updateEdge')) return;
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
        emit('edges', id);
    }

    /**
     * Apply a batch of (id, x, y) layout positions in one shot, with a single
     * undo frame so Ctrl+Z restores everything atomically. Used by Auto-Layout
     * — node-by-node moveNode() works but produces N undo frames and N
     * 'replace' renders, neither of which is desirable for a wholesale
     * re-arrange.
     *
     * Unlike a plain drag (which uses moveNode directly and is treated as
     * auto-saved layout), auto-layout is a substantial reorganisation the
     * user explicitly triggered — they expect Speichern to commit it. So
     * each moved node also gets a dirty mark, and the undo closure clears
     * the marks WE added (without disturbing dirty entries from unrelated
     * prior edits).
     *
     * moveNode still mirrors positions into state.snapshot, so a Cancel
     * after Auto-Layout *keeps* the new positions but discards data edits
     * — same trade-off as drag. Use Ctrl+Z to specifically undo the layout.
     */
    function applyLayoutTransform(label, positions) {
        if (!Array.isArray(positions) || !positions.length) return;
        // Capture originals so undo can restore them in one batch.
        var originals = [];
        positions.forEach(function (p) {
            var n = getNode(p.id);
            if (!n) return;
            originals.push({ id: p.id, x: n.x || 0, y: n.y || 0 });
        });
        if (!originals.length) return;

        // Track which dirty marks WE added (vs ones already there from
        // prior edits) so undo can clean up cleanly. Sequence is load-
        // bearing here:
        //   1. moveNode(p.id, …) updates x/y but is layout-only — it does
        //      NOT call markModified, so dirtyMap is unchanged.
        //   2. We check `dirtyMap.has(key)` — true means a prior edit
        //      already dirtied this node; we don't claim ownership.
        //   3. markModified runs AFTER the check and adds the key.
        // If moveNode ever starts dirtying positions, step 2 needs to
        // move BEFORE moveNode (or capture a pre-loop snapshot). Easy to
        // get wrong; this comment is the assertion.
        var addedDirtyKeys = [];
        positions.forEach(function (p) {
            moveNode(p.id, p.x, p.y);
            if (state.snapshot) {
                var key = dkey('node', p.id);
                if (!dirtyMap.has(key)) addedDirtyKeys.push(key);
                markModified('node', p.id);
            }
        });

        pushUndoOp(label || 'Auto-Layout', function () {
            originals.forEach(function (p) { moveNode(p.id, p.x, p.y); });
            // Clear dirty marks the forward pass introduced — positions are
            // back to what they were, so Speichern shouldn't claim there's
            // anything to save (assuming no other edits).
            addedDirtyKeys.forEach(function (k) { dirtyMap.delete(k); });
            emit('replace');
        });
        // One emit at the end so Canvas re-renders edges + group frames once.
        emit('replace');
    }

    function moveNode(id, x, y) {
        // Drag in progress at commit-start would otherwise keep streaming
        // moveNode calls into state. Quiet skip — drag handler in canvas.js
        // will repaint correctly on next pointermove or end-drag.
        if (guardMutation('moveNode')) return;
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
        if (guardMutation('updateNode')) return;
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
        emit('nodes', id);
    }

    function addNode(node) {
        if (guardMutation('addNode')) return null;
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
        emit('nodes', id);
        return fresh;
    }

    function deleteNode(id) {
        if (guardMutation('deleteNode')) return;
        var n = getNode(id);
        if (!n) return;
        // Capture just the affected node + its edges for undo — full-graph
        // clone was the previous shape and dominated edit-mode memory.
        var savedNode = deepClone(n);
        var savedEdges = state.edges
            .filter(function (e) { return e.from === id || e.to === id; })
            .map(deepClone);
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
        // Cascade-deleted edges are handled by the canvas listener (it drops
        // any DOM edge group whose endpoint matches the gone id), so a single
        // 'nodes' emit is enough — no need to fire one 'edges' per cascaded
        // edge.
        emit('nodes', id);
    }

    function addEdge(edge) {
        if (guardMutation('addEdge')) return null;
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
        emit('edges', fresh.id);
        return fresh;
    }

    function deleteEdge(id) {
        if (guardMutation('deleteEdge')) return;
        var e = getEdge(id);
        if (!e) return;
        var savedEdge = deepClone(e);
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
        emit('edges', id);
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
     * Capture / clear the curated entry-point view. The change becomes part
     * of the current draft — `dirtyMap` is bumped under a `canvas:<slug>`
     * key so the Speichern button enables and `commitDraft` ships the new
     * home view to the canvas table via canvas_apply. Cancel reverts to
     * the snapshot. Pass null to clear.
     */
    function setHomeView(v) {
        var prev = state.homeView;
        if (v === null) {
            state.homeView = null;
        } else if (isValidHomeView(v)) {
            state.homeView = { scale: v.scale, centerX: v.centerX, centerY: v.centerY };
        } else {
            return; // silently reject malformed input
        }
        // Field-by-field change detection. Was JSON.stringify-equality
        // before, which produces false negatives if either side ever
        // gains a different key order — both sides happen to be built
        // here in a fixed order, but the dependency was implicit and
        // brittle. Direct compare makes it explicit.
        var changed =
            (prev === null) !== (state.homeView === null) ||
            (prev !== null && state.homeView !== null && (
                prev.scale   !== state.homeView.scale ||
                prev.centerX !== state.homeView.centerX ||
                prev.centerY !== state.homeView.centerY
            ));
        if (changed && state.snapshot) {
            // Tag the canvas itself as modified so it counts toward
            // hasUnsavedChanges. The slug-keyed entry collapses cleanly
            // when the user toggles home view back to the original.
            var slug = state.currentCanvasSlug || 'default';
            markModified('canvas', slug);
            emit('home');
        }
        persistPositions(); // session-only memory; localStorage gets wiped on load
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

    function getLoadError() { return state.loadError; }

    return {
        EVENTS: EVENTS,
        load: load,
        reset: reset,
        on: on,
        get: get,
        getLoadError: getLoadError,
        getCanvases: getCanvases,
        getCurrentCanvas: getCurrentCanvas,
        getCurrentCanvasSlug: getCurrentCanvasSlug,
        setCurrentCanvasSlug: setCurrentCanvasSlug,
        getNodes: getNodes,
        getEdges: getEdges,
        getNode: getNode,
        getEdge: getEdge,
        getSets: getSets,
        getSet: getSet,
        getSetLabel: getSetLabel,
        getSystems: getSystems,
        getSystemMeta: getSystemMeta,
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
        commitImport: commitImport,
        isCommitting: isCommitting,
        isLoading: isLoading,
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
        applyLayoutTransform: applyLayoutTransform,
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
