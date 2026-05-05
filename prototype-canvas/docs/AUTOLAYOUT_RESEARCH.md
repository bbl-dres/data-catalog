# Auto-Layout Strategies for the Architecture Canvas

**Status:** Research notes (2026-05, revised after validation pass)
**Audience:** developers planning the next iteration of the canvas auto-layout
**Scope:** survey of algorithms, JavaScript libraries, and production tools, with a recommendation for our specific constraints

---

## Table of contents

1. [Context and constraints](#1-context-and-constraints)
2. [Algorithm taxonomy](#2-algorithm-taxonomy)
3. [Browser-side library landscape](#3-browser-side-library-landscape)
4. [How production ER and architecture tools handle it](#4-how-production-er-and-architecture-tools-handle-it)
5. [Design heuristics for our case](#5-design-heuristics-for-our-case)
6. [Recommendation and roadmap](#6-recommendation-and-roadmap)
7. [References](#7-references)

---

## 1. Context and constraints

The canvas now has two distinct workloads to design for:

- **Curated BBL canvas** — ~25 nodes across 4 systems (`AFM`, `SAP RE-FX`, `BBL GIS`, `BFS GWR`), with one extreme-height SAP BAPI node (1500+ px). This is the original target the v1 of this doc was scoped against; layout quality matters less because positions are hand-curated.
- **IBPDI Real Estate CDM import** (added May 2026) — 256 entities / 1977 attributes / 384 FK edges across 7 clusters (DigitalTwin, OrganisationalManagement, EnergyAndResources, …). **Hub-and-spoke topology**: most entities are masters or leaves rather than mid-rank pipeline nodes; many have no intra-cluster FKs at all. This is the de-facto stress-test workload and the one that exposed the limits of the v1 approach (see §6.4).

Open questions:

- **What auto-layout strategies fit ER-style schemas with very tall, variable-height nodes and explicit clustering by source system?**
- **Which browser libraries can deliver this without breaking our zero-build, vanilla-JS, single-CDN-dep stance?**
- **What design heuristics keep the diagram readable in practice — beyond raw algorithmic quality?**

A first attempt at auto-layout (Gitter / Nach System / Hierarchisch as in-house algorithms) produced poor results in real data. This research informs the next attempt.

---

## 2. Algorithm taxonomy

### 2.1 Force-directed (spring-electrical)

Treats the graph as a physical system: nodes repel, edges pull as springs, iterate to low energy.

**Notable algorithms:** Fruchterman-Reingold (1991), Kamada-Kawai (1989), ForceAtlas2 (2014). Barnes-Hut approximation reduces repulsion from O(n²) to O(n log n). **Stress majorization** (Gansner, Koren & North, GD 2004) is a more stable cousin that minimizes a weighted stress function rather than simulating physics — it underpins WebCola/cola.js and is generally preferred over Fruchterman-Reingold for ER-style graphs.

**Strengths:** organic look, no DAG requirement, dense graphs settle reasonably.

**Weaknesses for our use case:**
- Ignores semantic direction (FKs are directional, force layouts aren't)
- Treats nodes as points or uniform circles — large rectangles cause collisions or massive whitespace
- **Non-deterministic**: small graph edits cause large layout shifts ("jitter") → users lose their mental map
- Cluster awareness only via custom forces or post-processing

**Verdict:** poor fit for ER-style schemas. Fine for fuzzy network views; wrong tool here.

### 2.2 Hierarchical / layered (Sugiyama framework)

The dominant choice for directed graph drawings. Four-phase pipeline (Sugiyama, Tagawa, Toda 1981):

1. **Cycle removal** — reverse minimum feedback arc set (NP-hard, heuristics exist).
2. **Layer assignment** — longest-path (fast, wide), Coffman-Graham (bounded width), or **network simplex** (Gansner et al. 1993, used in Graphviz `dot`) — minimizes total edge length.
3. **Crossing reduction** — order nodes within layers; NP-hard in general (Garey & Johnson 1983), solved by **barycenter** / **median** heuristics with multi-pass layer-sweep.
4. **Coordinate assignment** — modern standard is **Brandes-Köpf (2001)** "Fast and Simple Horizontal Coordinate Assignment", which produces vertical-edge-friendly placements. Brandes-Köpf solves only phase 4; the other phases have their own canonical algorithms.

**Strengths:**
- Honors edge direction
- **Highly stable** — same input produces same output, small edits localize
- Variable-height nodes respected per layer
- Compound graph extensions exist (ELK Layered) — first-class clusters
- **Port-anchored edges**: ELK Layered with `portConstraints=FIXED_ORDER` attaches edges to specific attribute rows, not table centers — the production-grade ER pattern

**Weaknesses:**
- Wants a DAG; cycles are tolerated by reversal but quality degrades
- Single very tall node (e.g. our BAPI with 25 sets) inflates the entire layer's height — mitigated by collapsing before layout (see §5)

**Verdict:** the right baseline for our directional FK-style edges. The dominant choice in Graphviz `dot`, `@dagrejs/dagre`, ELK, yFiles, Mermaid. For ER specifically with port-anchored attribute-row edges, ELK Layered is the strongest output of any browser-side library.

### 2.3 Orthogonal

All edges drawn as horizontal/vertical segments with right-angle bends. Goals: minimize bends, area, crossings.

**Notable algorithms:** Tamassia's **Topology-Shape-Metrics (TSM)** framework (1987) — planarization → orthogonalization (bend min via min-cost flow) → compaction. Kandinsky model (Fößmeier & Kaufmann 1995) extends TSM to high-degree nodes. For object-avoiding *connector routing* (distinct from layout), the canonical algorithm is **libavoid** (Wybrow, Marriott, Stuckey 2009) — available in browser as **libavoid-js** (Emscripten/WASM port). ELK 0.10 (March 2025) integrates libavoid as an optional edge-routing post-pass.

**Strengths:**
- The look users associate with **dbdiagram.io, drawSQL, Lucidchart ER, yEd Orthogonal**
- Right-angle edges read as "data flow"
- Handles large variable-height nodes well — boundaries are axis-aligned
- Crow's-foot cardinality glyphs are easier to read

**Weaknesses:**
- Polynomial only for planar graphs with a fixed embedding (Tamassia's flow formulation); NP-hard in general (Garg & Tamassia 2001)
- Pure orthogonal placement (without an underlying layered placement) can produce dense bend-heavy diagrams
- True object-avoiding routing (libavoid) is a separate concern from layout; treat them as two passes

**Verdict:** ideal **edge routing style** on top of layered placement. Layered placement + libavoid routing is the production-grade combination behind JointJS+, Sprotty, and (post-0.10) ELK with the libavoid integration enabled.

### 2.4 Constraint-based and compound-graph layouts

Force-directed + linear constraints (alignment, separation, containment), with first-class support for grouping nodes inside compound parents.

**Notable algorithms:**
- **IPSEP-CoLa** (Dwyer, Koren, Marriott 2006) — used in WebCola; constraint-based stress majorization.
- **CoSE / fCoSE** (Dogrusoz et al., Bilkent) — Compound Spring Embedder; spectral seeding plus force-directed refinement, *handles compound (clustered) nodes natively*. fCoSE 2.x added fixed-position, alignment, and relative-placement constraints. For a four-cluster ER canvas, this is the single algorithm most directly aimed at our problem.
- **PRISM** (Gansner & Hu 2009) — stress-based with explicit overlap removal for variable node sizes.
- **CiSE** (Circular in Spring Embedder, Dogrusoz et al.) — cluster-aware circular layout for the rare case where you want cluster-as-ring.

**Strengths:**
- Containment constraints map directly to our **system frames**
- Variable rectangle sizes handled natively (vs forces' point assumption)
- Compound-graph hierarchies are a first-class concept, not a post-processing afterthought

**Weaknesses:**
- Iterative, slower than layered — irrelevant at ~20 nodes
- Original WebCola is largely unmaintained (no npm release since 2018); fcose has had no release since 2022 but the algorithm itself is sound

**Verdict:** the strongest fit for "Miro-style clustered ER canvas" in the OSS browser space. fcose specifically is what I'd reach for first.

### 2.5 Circular / radial / tree

- **Circular** — nodes on a ring; emphasizes membership over flow.
- **Radial** — root at center, rooted hierarchies / ontologies.
- **Reingold-Tilford trees** (1981) — optimal for pure trees; production code usually implements Buchheim-Jünger-Leipert (2002), which is *O(n)*.

**Verdict:** poor fit. Schemas aren't trees; FK relationships form DAGs/cyclic graphs. Skip except for tiny overview diagrams.

### 2.6 Modern / hybrid

- **ELK Layered** — Sugiyama + constraint-aware compound layout + port constraints (essential for column-level FK edges) + optional libavoid edge routing since ELK 0.10.
- **Magnetic-spring models** (Sugiyama & Misue 1995) — force-directed with a magnetic field aligning edges to a preferred direction.
- **PivotMDS / sparse stress** (Brandes & Pich 2007; Ortmann et al. 2017) — scale stress majorization to large graphs.
- **Edge bundling** (Holten 2006 hierarchical, Holten & van Wijk 2009 force-directed) — not a layout algorithm but a routing post-pass that turns hairballs into readable flow diagrams. Used by every serious data-lineage tool.

### 2.7 ML / LLM tangents

Two strands worth one paragraph each in 2026:

**Neural graph drawing** — DeepDrawing (Wang et al., TVCG 2020), GNN-based imitators of force-directed equilibria (Tiezzi et al. 2022), DeepGD (Wang et al. 2023). Research-grade, not production-grade. Not relevant for a 20-node canvas.

**LLM as layout *consumer*** — "Graph Drawing for LLMs: An Empirical Evaluation" (Di Bartolomeo et al., May 2025) shows that the *choice of layout paradigm* materially affects multimodal-LLM accuracy on graph reasoning tasks. **Orthogonal and Sugiyama layouts outperform straight-line force-directed** for path-finding and connection queries. Practical implication: if our canvas is ever screenshotted into Claude or GPT-5 for explanation/refactoring (a realistic future workflow), choose layered+orthogonal over force-directed for that reason alone.

**LLM as layout *producer*** — DiagrammerGPT (Zala et al. 2023/24) and similar prompt the model to emit bounding boxes. Every published evaluation as of mid-2025 shows worse results than handing the same graph to dagre or ELK. Use LLMs to generate *Mermaid/DBML text* (production-ready) and seed *cluster assignments* (useful) — let a deterministic algorithm place the boxes.

---

## 3. Browser-side library landscape

### 3.1 Recommended for our use case

| Library | Algorithm | Size / license | CDN | Compound | Variable sizes | Determinism | Verdict |
|---------|-----------|----------------|-----|----------|----------------|-------------|---------|
| **`@dagrejs/dagre`** v2.0 (Nov 2024) | Sugiyama (network-simplex + Brandes-Köpf) | ~38 KB min / MIT | ✓ ESM and IIFE bundles | ✓ via `setParent()` | ✓ exact | deterministic, one-shot | Boring, proven, tiny — the **default baseline**. Note: legacy `dagre` package on npm is dormant; use `@dagrejs/dagre`. |
| **elkjs** (Eclipse Layout Kernel) v0.10 (March 2025) | `layered` (Sugiyama with much better edge routing than dagre), plus `force`, `mrtree`, `radial`, `box`, `rectpacking`; optional libavoid post-pass | ~280 KB gz / EPL-2.0 | ✓ `elk.bundled.js`, can run in Web Worker | **best-in-class** — hierarchies, ports, port constraints, hierarchical edge routing | ✓ port-aware | deterministic | Strictly more capable than dagre for ER. Pay the bundle size for **port-anchored FK edges into specific table rows**. EPL-2.0 is weak-copyleft — flag for legal review if mixing with proprietary code. |
| **Cytoscape.js + fcose** | fast compound force (CoSE family) — designed around compound clusters | core ~110 KB gz, plugin ~35 KB gz / MIT | ✓ separate UMD per plugin | **first-class** via `parent` field | ✓ honors real dimensions | iterative but seeded (reproducible) | Arguably the **best out-of-the-box fit for "Miro-style clustered ER canvas"**. Other layouts (`klay`, `cola`, `dagre`, `elk` adapter) swap in via the same Cytoscape setup. **Caveat:** fcose has had no release since 2022 and a recent type-compat issue with cytoscape 3.33.x (issue #3416, Sep 2025). Algorithm sound, maintenance pace slow. |

### 3.2 Modern node-editor frameworks (and why most don't fit our stance)

This category exploded 2023-2025 and deserves an explicit "considered and ruled out" entry rather than silence.

| Framework | What it is | Why it doesn't fit *our* case |
|-----------|------------|-------------------------------|
| **xyflow / React Flow / Svelte Flow** | The dominant React/Svelte node-editor library; Svelte Flow 1.0 (Svelte 5) shipped 2025 | React/Svelte-only; assumes a build step. **xyflow does no auto-layout itself** — its docs explicitly tell you to "bring your own layouting library" and pair with dagre or elkjs. Inappropriate for our zero-build vanilla-JS stance, but if we ever migrate to a build-step stack, it's the obvious canvas+interaction layer. |
| **tldraw** | Infinite-canvas whiteboard with excellent interaction polish and an AI/MCP story | No graph auto-layout; manual placement only. Perfect when "manual + great UX" beats "auto + readable", which isn't our problem. |
| **Excalidraw** | Hand-drawn aesthetic whiteboard | Same as tldraw — no auto-layout, manual placement. Notable in 2026 as an LLM target format. |
| **Rete.js v2** | Plugin-architecture node editor with React/Vue/Angular adapters; `rete-auto-arrange-plugin` wraps elkjs | Build-step, framework-coupled. Niche. |
| **JointJS / JointJS+** | Mature MIT-core (commercial JointJS+) diagramming framework with built-in ELK adapter and a libavoid-js orthogonal-routing demo | The most production-grade option for ER/UML rendering with ports, but heavy and assumes a build pipeline. *The* mature pick if we abandon zero-build. |
| **GoJS** | Commercial; built-in layered, force, tree, circular layouts plus orthogonal AvoidsNodes routing | License almost certainly disqualifies it for federal OSS-friendly delivery. |
| **maxGraph** | TypeScript fork and successor to mxGraph (which has been **archived since 2020**); MIT | Build-step, more weight than we need. Mention it instead of mxGraph. |
| **diagram-js / bpmn-js** (Camunda) | The OSS heart of bpmn.io; ELK-based auto-layout | BPMN-shaped, not ER-shaped, but architecturally informative. |

The cross-cutting observation: **the entire React/Svelte node-editor ecosystem assumes a build step.** Our zero-build, single-CDN-dep stance structurally rules them all out regardless of merit. If that constraint ever softens, xyflow + elkjs is the obvious 2026 default.

### 3.3 WASM and Rust layout engines

A 2024-2026 development worth one short table. Bundle sizes are large enough that none of these are first-pick for 20 nodes, but they exist:

| Engine | Backing | Notes |
|--------|---------|-------|
| **@antv/layout-wasm** | Rust → WASM, optional `wasm-bindgen-rayon` multithreading | ~17× faster than JS graphology on 1k-node ForceAtlas2; threaded build needs `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` headers (real deployment cost). |
| **layout-rs** | Pure-Rust Graphviz-compatible layered layout with SVG backend | Compiles to WASM; small. Replacement for Graphviz-WASM if you want Rust-only. |
| **forceatlas2-rs** | Rust ForceAtlas2 + Barnes-Hut | **AGPL** — license dealbreaker for many embeds. |
| **fdg** (Grant Handy) | Rust Fruchterman-Reingold, n-dimensional, ForceAtlas2/Kamada-Kawai planned | Pre-1.0; experimental. |
| **libavoid-js** | Emscripten/WASM port of Adaptagrams libavoid | ~250-400 KB WASM. **LGPL-2.1.** Best-in-class object-avoiding orthogonal connector routing — directly relevant for FK edges. Used by JointJS+ and sprotty-routing-libavoid. |
| **@viz-js/viz** (Graphviz WASM) | Graphviz compiled to WASM via Emscripten | ~2 MB. EPL/CPL. Unbeatable layered+cluster output if you accept Graphviz-rendered SVG. |

For our case: at 20 nodes none of these is needed for *performance*. The one to consider on *capability* grounds is **libavoid-js** for orthogonal FK-edge routing.

### 3.4 Conditional

| Library | When it makes sense | Trade-off |
|---------|---------------------|-----------|
| **G6 (AntV)** v5 (2024) | Batteries-included graph viz from Alibaba; "combos" (clusters) first-class; pairs with @antv/layout-wasm | ~500 KB; bigger surface area than fcose alone. Improving fast in 2025. |
| **WebCola / cola.js** | Constraint-based stress majorization with first-class `groups` containment | **No npm release since 2018** ("3.4.0"); upstream Adaptagrams C++ (libcola) remains active. Treat as legacy. Prefer fcose for compound + constraint needs. |
| **Sigma.js v3 / v4** | WebGL rendering for 10k+ node networks; pairs with graphology layouts | Wrong shape — meant for big-graph network views, not ER schemas. |

### 3.5 Skip for our use case

- **d3-force** — wrong tool for tall rectangles; `forceCollide(radius)` is circular, ignores ER geometry.
- **mxGraph** — **archived since 2020**. Use **maxGraph** (TypeScript fork) if you want the same layout suite.
- **vis.js / vis-network** — superseded on every axis we care about.

---

## 4. How production ER and architecture tools handle it

### 4.1 ER-modeling tools

| Tool | Strategy | Tall-table handling | Clustering | Common complaints |
|------|----------|---------------------|------------|-------------------|
| **dbdiagram.io / dbdocs** | No real auto-layout — grid by declaration order, then manual drag | None — towers force vertical scroll | `TableGroup` only colors the header | "Auto-arrange" stacks tables tightly, ignores edge crossings; most users hand-place |
| **drawSQL** | Force-directed pass on first load, then snapshot | **Column collapse** added explicitly because users complained | Color groups, no spatial enforcement | Force layout puts unrelated tables far apart |
| **Lucidchart ER** | Hierarchical (Sugiyama) for tree-ish, organic (force) for cyclic | Shapes scale | User-drawn frames as containers | — |
| **Miro / Mural** | No auto-layout for ER; manual + snap-to-grid; "Smart Diagramming" added 2024 but ER isn't first-class | Tables built from stacked rows | **Frames as swimlanes** — children move with frame (the killer feature) | — |
| **Mermaid ER** (v11.x) | **Default: dagre.** ELK is opt-in via the **separate `@mermaid-js/layout-elk` package** registered with `mermaid.registerLayoutLoaders` — it is *not* bundled in the default mermaid distribution and *not* the default for ER. New `tidy-tree` layout also opt-in via plugin. | Treats node as one rectangle → very tall tables push entire ranks apart | **No first-class subgraph/cluster construct in ER** as of late 2025. Community workaround is invisible flowchart subgraphs around tables. | "Tables stack vertically forever," "no way to group by schema" |
| **DBeaver ER** | Modified Sugiyama, left-to-right | **Attribute visibility toggle** (keys only / all / none) | Schemas as separate diagrams | Generally tolerated; keys-only toggle is praised |
| **PlantUML** | Graphviz `dot` (Sugiyama family); recent versions also ship `smetana` pure-Java engine | Aligned ranks → 80-row entity creates massive gaps | `package` / `frame` produce true clusters via `cluster_*` subgraphs | Cluster handling is the best of the open-source tools |
| **Hackolade, erwin, PowerDesigner** | Multiple layouts: hierarchical, orthogonal, symmetric, circular + "layout selected only" | **Universal: collapse to PK/FK only and collapse to header** | Subject Areas / Packages — first-class containers | Auto-layout rarely used after initial import; users prefer "layout subset" on selection |
| **drawio / diagrams.net** | mxGraph internal: hierarchical, organic, tree, circle, fast organic; integrated Mermaid 10.9.1+ with ELK layout for inserted Mermaid diagrams (2024) | Hierarchical respects shape height; organic ignores it | Containers/swimlanes first-class, layouts can run *within* a container | Default auto-layout rarely the final state |

### 4.2 Newer ER tools (2024-2026 vintage)

| Tool | Distinguishing move |
|------|---------------------|
| **Azimutt** | Open-source ER explorer aimed at very large schemas (10⁴+ tables). Per-canvas saved "layouts" (subsets of the schema), AI-assisted exploration, supports relational + document DBs. Mostly user-driven layout. |
| **ChartDB** | Open-source, in-browser; schema-from-database via single query; AI ER diagram generator; DBML editor; "AutoSync." Built on xyflow / React Flow. |
| **drawDB** | Open-source, single-page in-browser ER tool; significant 2024-2025 mind-share. |
| **Atlas (Ariga)** v0.31 (Feb 2025) | Added **multi-project ER diagrams** stitching schema objects across Atlas projects. Server-rendered SVG, not interactive canvas. |

### 4.3 Lineage and data-catalog tools

The pattern these tools converge on is more important than any individual implementation:

| Tool | Strategy | Key heuristic |
|------|----------|---------------|
| **DataHub** (Acryl/LinkedIn) | In-house React component, horizontal layered, expand-on-demand; column-level lineage with on-demand expansion (v0.13+) | **Never render the whole graph.** Anchor on one node and expand by hops. |
| **OpenMetadata** v1.8 (June 2025) | React Flow-based; column-level lineage with 1-hop expansion default | Same. |
| **Marquez** (OpenLineage UI) | dagre-based DAG | Simple, works; no clustering. |
| **dbt Cloud lineage** | Hierarchical/force-directed hybrid, closed-source | Same expand-on-demand pattern. |
| **Atlan, Collibra, Alation, Castor, Select Star** | Various; all commercial | Converge on focus+context, lazy expansion, column-level expand/collapse, edge bundling for cross-system connections. |

**The takeaway for an ER canvas:** modern lineage tools have abandoned "show everything auto-laid-out" in favor of focus+context and per-node expansion. At 20 nodes we can still afford the global view, but we should design for the day we can't.

### 4.4 Cross-cutting observations

- **Edge routing — orthogonal wins.** Every commercial ER tool defaults to orthogonal (right-angle) routing with rounded corners. Splines look elegant in academic papers but obscure cardinality endpoints; orthogonal makes crow's-foot symbols readable and supports parallel edge bundling. Best-in-class object-avoiding orthogonal routing comes from libavoid (now usable in browsers via libavoid-js, and in ELK 0.10+).
- **Compound layout, not flat.** Tools that handle source-system clustering well (PlantUML/Graphviz, drawio, ELK-based, Cytoscape+fcose) all run **layout-within-cluster, then layout-of-clusters**. Single global passes consistently produce worse results.
- **Collapse modes are universal.** Every commercial ER tool has at least two of: header-only, PK/FK-only, full. Hand-rolled "show all attributes" is the #1 source of complaints.
- **Auto-layout is a one-shot, not a mode.** No production tool runs continuous force simulation — users must keep their mental map after data refreshes.
- **Lineage tools succeed by constraining the problem** (DAG, fixed direction, expand-on-demand). Pure ER can't constrain that hard, so it has to lean harder on collapse + clustering instead.

---

## 5. Design heuristics for our case

Distilled from commercial-tool analysis, the validation pass, and our prior abandoned attempt:

1. **Frame-as-swimlane.** Source systems are first-class containers (Miro frames). Children move with the frame; frame title is sticky. Apply layout *inside* a frame independently. Cross-system edges are routed *around* frames, not through them.

2. **Compound layout, not flat — and pick the inner algorithm by graph shape.** Run layout *within* each system, then a coarser pass to arrange systems. Never run a single global pass. fcose's compound-graph mode and ELK's `hierarchyHandling=INCLUDE_CHILDREN` both implement this directly. Within each compound, choose the algorithm to match the cluster's topology: pipeline-shaped (sources → intermediates → sinks) → layered Sugiyama; **hub-and-spoke** (most entities are masters or leaves, few intermediate ranks) → compound force-directed (fcose) or ELK's `INCLUDE_CHILDREN` with rectpacking. Validation on the IBPDI 256-node import (May 2026) showed that running layered Sugiyama on a hub-spoke cluster collapses orphans into rank 0 and produces narrow towers — see §6.4.

3. **Level-of-detail rendering for variable-height nodes.** Three states per node: header-only, PK/FK-only, full. **Auto-collapse to PK/FK when a table exceeds ~15 attributes** — this is the single biggest readability win and every commercial tool does it. Specifically: auto-collapse the SAP BAPI and any 200+ column node before laying out. Bind the collapse state to zoom level (semantic zoom): full detail when zoomed in, header-only when zoomed out. The 100 px vs 1500 px node-height range in our brief is the canonical motivator for LOD.

4. **Orthogonal edge routing with bundling.** Right-angle edges, rounded corners, bundle parallel FKs between the same two tables. Cardinality glyphs at endpoints, no mid-edge labels except role names. **Treat layout and routing as two passes:** layered placement first, then orthogonal object-avoiding routing (libavoid-js, ELK's libavoid integration, or Graphviz `splines=ortho` for simpler cases).

5. **Stable layouts.** Persist node positions per user / per saved canvas. Auto-layout only on first open or explicit "Re-Layout selected." Users must never lose their mental map after a data refresh. Mental-map preservation has a 30-year literature behind it (Misue, Eades, Lai, Sugiyama 1995); fcose has incremental "draft" mode and ELK has `INCREMENTAL` for exactly this.

6. **Cross-system edges are special.** Render inter-cluster FKs in a distinct style (dashed or different weight). ELK's `hierarchyHandling=INCLUDE_CHILDREN` does this naturally.

7. **Direction defaults: left→right for lineage-like flows, top→bottom for pure ER.** Allow per-frame override. Codelists/lookup tables pin to a "reference" lane on one side. **Parent→child convention for FKs** (one-to-many flowing left-to-right or top-to-bottom) — Mermaid, dbdiagram.io, and DataHub all default this way.

8. **Manual override is sacred.** Auto-layout is a starting point and a per-selection "tidy" action — never a continuous simulation. Snap-to-grid and Miro-style alignment guides matter more than algorithmic perfection.

9. **Aesthetic priorities aren't just edge crossings.** Purchase et al.'s user studies (1997, 2002) found that *bend count* and *edge length variance* matter as much as crossings for human comprehension. Bartolomeo et al.'s 2025 evaluation found that for *multimodal-LLM* comprehension of graph diagrams, **orthogonal and Sugiyama layouts outperform straight-line force-directed** — relevant if our canvas will ever be screenshotted into an LLM for explanation.

10. **Accessibility from day one.** SVG nodes should attach `<title>` and `<desc>` for screen readers. Tab order through nodes needs application-layer logic — none of the libraries derive a sensible reading order automatically. WCAG AA contrast for PK/FK colors. Canvas-based renderers (sigma WebGL, cytoscape-canvas) can't host accessible SVG attributes — prefer SVG renderers if accessibility matters.

---

## 6. Recommendation and roadmap

### 6.1 Top picks for our constraints

| Rank | Pick | Why it fits | Trade-off |
|------|------|-------------|-----------|
| 1 | **Cytoscape.js + `fcose`** | Compound clusters first-class, respects rectangle sizes, single CDN, MIT, animation optional. Closest to "Miro-style ER with system groups" out of the box. Layouts swap to `klay` / `cola` / `elk` within the same setup. | ~145 KB gz total; styling ER tables means custom HTML overlays on top of Cytoscape nodes. fcose has had no release since 2022; algorithm sound but maintenance pace slow. |
| 2 | **elkjs (`layered`, hierarchical mode)** | Best edge routing for FK relationships, **port-anchored edges** into specific table rows, deterministic, handles compound graphs cleanly. ELK 0.10 (March 2025) added optional libavoid edge-routing post-pass. | ~280 KB gz bundle, run in Web Worker, learning curve on options. **EPL-2.0 weak-copyleft** — flag for legal review if mixing with proprietary code. |
| 3 | **`@dagrejs/dagre`** v2.0 | Tiny, deterministic, trivial to integrate with hand-rolled HTML/SVG nodes of arbitrary size. Good baseline before reaching for heavier tools. New ESM build (Nov 2024). | Edge routing weaker than ELK; cluster visuals minimal. Note: legacy unscoped `dagre` package is dormant — use `@dagrejs/dagre`. |
| 4 | **@viz-js/viz** (Graphviz WASM) | Unbeatable layered + cluster output for ER. | ~2 MB; awkward if nodes are live HTML rather than SVG. EPL/CPL license. |
| 5 | **libavoid-js** | Best-in-class orthogonal connector routing as a separate pass. | ~250-400 KB WASM; **LGPL-2.1**; pairs with one of the layout libraries above, doesn't replace them. |

**Default recommendation, workload-aware:**

- **Hub-spoke shape or 100+ nodes** (the IBPDI workload from §1): skip dagre; go directly to **ELK Layered with `hierarchyHandling=INCLUDE_CHILDREN`** or **Cytoscape + fcose**. Validation (§6.4) confirmed that layered Sugiyama is the wrong inner algorithm for hub-spoke clusters, and that a per-cluster + macro-stack architecture on top of dagre inherits the same failure modes — the apparent simplicity savings cost more in re-implementation when the dataset grows. ELK pays for itself the first time inter-cluster edges need to route around clusters rather than through them.
- **Pipeline-shaped or <30 nodes** (the curated BBL canvas): `@dagrejs/dagre` alone is fine. Tiny, deterministic, integrates trivially with hand-rolled HTML nodes. System frames remain visually hand-rolled (acceptable at this scale).

If port-anchored FK edges into specific table rows become important on either workload, ELK is the only browser-side option that delivers them. If FK edge readability becomes the long pole, layer libavoid-js on top of either backbone as a routing-only post-pass.

### 6.2 Suggested phases

**Phase 1 — Auto-collapse and semantic zoom.** *(Status: deferred. IBPDI's 5–15 attrs/entity doesn't yet bite; revisit when SAP-BAPI-sized nodes show up.)*
Implement the three collapse modes (header / PK+FK / full) with auto-collapse for nodes exceeding a column threshold, bound to zoom level. **This alone will solve the majority of the readability problem before any new layout algorithm is involved.** Independent of which layout library we pick.

**Phase 2 — ELK Layered with compound graphs.** *(Status: in progress, May 2026.)*
Add `elkjs` (~280 KB gz) as a single CDN dep on the **main thread**. Treat each system as an ELK compound child of a single root graph; `elk.algorithm=layered` per compound for intra-cluster lineage; `elk.hierarchyHandling=INCLUDE_CHILDREN` at the root so cross-cluster edges route around unrelated compounds. ELK manages its own internal Worker for heavy computation, so `elk.layout()` is async without blocking the main thread — *don't* wrap ELK in your own Worker (see §6.4 / §6.5). Optionally enable ELK's libavoid integration (0.10+) for tighter orthogonal edge routing.

**Phase 3 — Editor refinements.** *(Status: not started.)*
Snap-to-grid, alignment guides, "Re-Layout selected" action. Mental-map preservation on incremental edits via ELK's `INCREMENTAL` mode. Manual layout always wins; auto-layout is the assistant.

> **Note on the deleted "Phase 2 (vanilla-JS Sugiyama)".** A previous version of this doc proposed an interim "per-system layered layout, no library" written in vanilla JS as a stepping stone. Validation (§6.4) showed two problems: (a) layered Sugiyama is the wrong inner algorithm for IBPDI's hub-spoke topology regardless of who implements it, and (b) the same per-cluster + macro-stack architecture on top of dagre also produced unreadable results, so the vanilla-JS variant would have inherited those failure modes without earning anything. Phase 2 is now ELK directly; the old Phase 3 became Phase 2; the old Phase 4 became Phase 3.

### 6.3 Anti-patterns to avoid

- Single global force-directed pass → tall ER tables overlap, clusters tear apart, layouts unstable across runs
- Algorithmic re-layout on every data change → users lose mental map
- Hierarchical layout without auto-collapse → one 1500 px node inflates entire ranks
- Pure orthogonal placement without layered backbone → dense bend-heavy diagrams
- Treating system frames as cosmetic colors instead of layout-aware containers → cross-system edges thread through unrelated tables
- Treating layout and edge routing as one concern → either you get good placement and bad routing, or vice versa; do them as two passes
- Reaching for a React/Svelte node-editor framework (xyflow, Rete, JointJS) inside a zero-build vanilla-JS codebase → architectural mismatch, not a layout solution

### 6.4 Validation findings (May 2026)

The canvas was stress-tested with the IBPDI Real Estate CDM import (256 nodes / 1977 attributes / 384 FK edges across 7 clusters) — see §1. Documenting what was tried and what happened so the next pass doesn't repeat the path:

**Tried — dagre per-cluster + vertical macro-stack.** First implementation pass per the original doc's Phase 2 sketch, but with dagre rather than hand-rolled Sugiyama: each `node.system` got its own dagre subgraph (LR), and cluster bounding boxes were stacked vertically by node count. **Visually unreadable on IBPDI scale** — each cluster turned into a narrow vertical tower because hub-spoke entities collapsed into rank 0, and vertical macro-stacking compounded the height. Abandoned.

**Tried — cross-cluster edges as straight lines** between independent dagre passes. This was effectively required by the per-cluster architecture (dagre can't route between disjoint subgraphs). On a 384-edge dataset they thread through unrelated clusters and become noise. Confirmed that compound-graph layout (ELK `INCLUDE_CHILDREN`) isn't a nice-to-have at this scale — it's the only way cross-cluster edges remain readable.

**Tried — wrapping ELK in our own Web Worker.** Failed: `new ELK()` threw `_Worker is not a constructor` from inside a nested worker context. ELK already manages its own internal Worker for layout computation; wrapping it in a second Worker is both unnecessary and broken on most browsers (nested-Worker restrictions). **Run ELK on the main thread; let ELK's internal worker handle the heavy lifting.** The main thread stays responsive because `elk.layout()` is async.

**Confirmed kept — `State.applyLayoutTransform`** (single undo frame for batch position changes). Architectural primitive that holds across layout backends. Captures originals, applies the new positions via `moveNode` in a loop, pushes one undo closure that restores everything. Avoids N undo frames + N `replace` renders that node-by-node moves would produce.

**Confirmed kept — edit-mode + filter-aware as the trigger boundary.** Auto-layout mutates positions, so it must be undoable (= edit mode only). Hidden / filtered-out nodes stay where they are (= filter-aware) — moving content the user can't see would be surprising. The "auto-layout only on visible nodes" decision held up.

**Confirmed — async layout is non-negotiable at IBPDI scale.** ELK on 256 nodes / 384 edges takes seconds. Whether the async-ness comes from ELK's own internal worker (current) or from wrapping ELK in a custom worker (broken — see above), the main thread must not block during layout.

### 6.5 ELK integration gotchas (for the next implementor)

Notes that aren't in ELK's docs but matter when integrating into a vanilla-JS browser app:

- **Run ELK on the main thread.** `elk.bundled.js` includes everything ELK needs to manage its own internal Worker; instantiate `new ELK()` from the main thread, not from inside another Worker. Calling `new ELK()` from a nested worker context fails with `_Worker is not a constructor`. The `elk.layout()` Promise is non-blocking on the main thread because the actual work happens in ELK's internal worker.
- **Lazy-init the ELK instance.** The constructor spawns the internal worker; defer to first user click rather than module init so page load isn't penalised.
- **Compound child positions are parent-relative.** ELK returns `x, y` for each child relative to its parent compound, not absolute. Walk the result tree accumulating offsets to get absolute coords for the canvas.
- **`elk.padding` for system overlay.** Top padding on each compound needs ~60 world-units to leave room for the big system-name overlay that fades in at low zoom: `'elk.padding': '[top=60,left=30,bottom=30,right=30]'`.
- **Self-loops crash `layered`.** Filter `e.from === e.to` out of the edge payload before sending to ELK; the layered algorithm rejects them.
- **First-call latency.** ELK's internal worker spawns lazily on the first `layout()` call (~hundreds of ms cold start, plus the actual layout time). The button should disable + show a busy state during the call. Subsequent calls reuse the warm worker.
- **License flag.** ELK is **EPL-2.0** (weak copyleft). Probably fine for federal-administration OSS delivery, but worth flagging if the canvas ever bundles into a proprietary distribution.

---

## 7. References

### Foundational papers

- Sugiyama, K., Tagawa, S., Toda, M. (1981). "Methods for Visual Understanding of Hierarchical System Structures." *IEEE Trans. on Systems, Man, and Cybernetics*.
- Reingold, E.M., Tilford, J.S. (1981). "Tidier Drawings of Trees." *IEEE Trans. Software Eng.* (Walker 1990 and Buchheim, Jünger, Leipert 2002 for the *O(n)* practical implementation.)
- Tamassia, R. (1987). "On Embedding a Graph in the Grid with the Minimum Number of Bends." *SIAM J. Comput.*
- Kamada, T., Kawai, S. (1989). "An algorithm for drawing general undirected graphs." *Information Processing Letters*.
- Fruchterman, T.M.J., Reingold, E.M. (1991). "Graph Drawing by Force-directed Placement." *Software: Practice and Experience*.
- Gansner, E.R., Koutsofios, E., North, S.C., Vo, K.-P. (1993). "A Technique for Drawing Directed Graphs." *IEEE Trans. Software Eng.* — the Graphviz `dot` algorithm.
- Misue, K., Eades, P., Lai, W., Sugiyama, K. (1995). "Layout adjustment and the mental map." *J. Visual Languages and Computing*.
- Brandes, U., Köpf, B. (2001). "Fast and Simple Horizontal Coordinate Assignment." *Graph Drawing*.
- Gansner, E.R., Koren, Y., North, S.C. (2004). "Graph Drawing by Stress Majorization." *Graph Drawing*.
- Dwyer, T., Koren, Y., Marriott, K. (2006). "IPSep-CoLa: An Incremental Procedure for Separation Constraint Layout of Graphs." *IEEE TVCG*.
- Holten, D. (2006). "Hierarchical edge bundles." *IEEE TVCG*.
- Wybrow, M., Marriott, K., Stuckey, P.J. (2009). "Orthogonal connector routing." *Graph Drawing*. — the libavoid algorithm.
- Gansner, E.R., Hu, Y. (2009). "Efficient Node Overlap Removal Using a Proximity Stress Model." *Graph Drawing* — PRISM.
- Jacomy, M., Venturini, T., Heymann, S., Bastian, M. (2014). "ForceAtlas2, a Continuous Graph Layout Algorithm." *PLOS ONE*.
- Di Bartolomeo, S., Didimo, W., Liotta, G., Montecchiani, F. (2025). "Graph Drawing for LLMs: An Empirical Evaluation." arXiv 2505.03678.

### Library homepages

- `@dagrejs/dagre` — github.com/dagrejs/dagre
- ELK / elkjs — eclipse.dev/elk · github.com/kieler/elkjs
- Cytoscape.js — js.cytoscape.org
- cytoscape.js-fcose — github.com/iVis-at-Bilkent/cytoscape.js-fcose
- Graphviz / @viz-js/viz — graphviz.org
- libavoid / libavoid-js — adaptagrams.org · github.com/Aksem/libavoid-js
- xyflow (React Flow / Svelte Flow) — xyflow.com
- tldraw — tldraw.dev
- JointJS — jointjs.com
- maxGraph — github.com/maxGraph/maxGraph
- @antv/layout-wasm — github.com/antvis/layout
- G6 (AntV) — g6.antv.antgroup.com

### Production tools studied

dbdiagram.io, drawSQL, dbdesigner.net, Lucidchart, Miro, Mermaid (v11.x), DBeaver, PlantUML, Hackolade, erwin, PowerDesigner, drawio/diagrams.net, Azimutt, ChartDB, drawDB, Atlas (Ariga), DataHub, OpenMetadata, Marquez, dbt Cloud lineage.