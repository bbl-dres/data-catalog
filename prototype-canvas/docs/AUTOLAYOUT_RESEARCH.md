# Auto-Layout Strategies for the Architecture Canvas

**Status:** Research notes (2026-04)
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

The canvas currently holds ~20 nodes of varying height (some 100 px, some 1500+ px for the SAP BAPI), grouped into 4 source systems (`AFM`, `SAP RE-FX`, `BBL GIS`, `BFS GWR`), connected by directional FK-style edges. Open questions:

- **What auto-layout strategies fit ER-style schemas with very tall, variable-height nodes and explicit clustering by source system?**
- **Which browser libraries can deliver this without breaking our zero-build, vanilla-JS, single-CDN-dep stance?**
- **What design heuristics keep the diagram readable in practice — beyond raw algorithmic quality?**

A first attempt at auto-layout (Gitter / Nach System / Hierarchisch as in-house algorithms) produced poor results in real data. This research informs the next attempt.

---

## 2. Algorithm taxonomy

### 2.1 Force-directed (spring-electrical)

Treats the graph as a physical system: nodes repel, edges pull as springs, iterate to low energy.

**Notable algorithms:** Fruchterman-Reingold (1991), Kamada-Kawai (1989), ForceAtlas2 (2014). Barnes-Hut approximation reduces repulsion from O(n²) to O(n log n).

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
3. **Crossing reduction** — order nodes within layers; NP-hard, solved by **barycenter** / **median** heuristics with multi-pass layer-sweep.
4. **Coordinate assignment** — modern standard is **Brandes-Köpf (2001)** "Fast and Simple Horizontal Coordinate Assignment", which produces vertical-edge-friendly placements.

**Strengths:**
- Honors edge direction
- **Highly stable** — same input produces same output, small edits localize
- Variable-height nodes respected per layer
- Compound graph extensions exist (ELK Layered) — first-class clusters

**Weaknesses:**
- Wants a DAG; cycles are tolerated by reversal but quality degrades
- Single very tall node (e.g. our BAPI with 25 sets) inflates the entire layer's height

**Verdict:** the right baseline for our directional FK-style edges. The dominant choice in Graphviz `dot`, dagre, ELK, yFiles, mermaid.

### 2.3 Orthogonal

All edges drawn as horizontal/vertical segments with right-angle bends. Goals: minimize bends, area, crossings.

**Notable algorithms:** Tamassia's **Topology-Shape-Metrics (TSM)** framework (1987) — planarization → orthogonalization (bend min via min-cost flow) → compaction. Kandinsky model (Fößmeier & Kaufmann 1995) extends TSM to high-degree nodes.

**Strengths:**
- The look users associate with **dbdiagram.io, drawSQL, Lucidchart ER, yEd Orthogonal**
- Right-angle edges read as "data flow"
- Handles large variable-height nodes well — boundaries are axis-aligned
- Crow's-foot cardinality glyphs are easier to read

**Weaknesses:**
- Polynomial only for planar graphs; NP-hard in general
- Pure orthogonal placement (without an underlying layered placement) can produce dense bend-heavy diagrams

**Verdict:** ideal **edge routing style** on top of layered placement — the combination matches commercial ER tools.

### 2.4 Constraint-based

Force-directed + linear constraints (alignment, separation, containment).

**Notable algorithms:** **IPSEP-CoLa** (Dwyer, Koren, Marriott 2006) — used in WebCola; stress majorization (Gansner et al. 2005) — more stable than spring embedders.

**Strengths:**
- Containment constraints map directly to our **system frames**
- Variable rectangle sizes handled natively (vs forces' point assumption)

**Weaknesses:**
- Iterative, slower than layered
- WebCola is largely unmaintained since ~2020

**Verdict:** strong on paper for clustered ER, but the maintained options (Cytoscape's `cola` plugin, fcose) wrap it anyway.

### 2.5 Circular / radial / tree

- **Circular** — nodes on a ring; emphasizes membership over flow.
- **Radial** — root at center, rooted hierarchies / ontologies.
- **Reingold-Tilford trees** (1981) — optimal for pure trees.

**Verdict:** poor fit. Schemas aren't trees; FK relationships form DAGs/cyclic graphs. Skip except for tiny overview diagrams.

### 2.6 Modern / hybrid

- **ELK Layered** — Sugiyama + constraint-aware compound layout + port constraints (essential for column-level FK edges).
- **Magnetic-spring models** (Sugiyama & Misue 1995) — force-directed with a magnetic field aligning edges to a preferred direction.
- **PRISM** (Gansner & Hu 2010) — stress-based with explicit overlap removal for variable node sizes.

---

## 3. Browser-side library landscape

### 3.1 Recommended

| Library | Algorithm | Size / license | CDN | Compound | Variable sizes | Determinism | Verdict for our case |
|---------|-----------|----------------|-----|----------|----------------|-------------|----------------------|
| **dagre** | Sugiyama (network-simplex + Brandes-Köpf) | ~80 KB / MIT | ✓ single UMD | ✓ via `setParent()` | ✓ exact | deterministic, one-shot | Boring, proven, tiny — the **default baseline**. Used by Mermaid (flowcharts), GitLab, Backstage. Cluster visuals are minimal. |
| **elkjs** (Eclipse Layout Kernel) | `layered` (Sugiyama with much better edge routing than dagre), plus `force`, `mrtree`, `radial`, `box`, `rectpacking` | ~1.5 MB / EPL-2.0 | ✓ `elk.bundled.js`, can run in Web Worker | **best-in-class** — hierarchies, ports, port constraints, hierarchical edge routing | ✓ port-aware | deterministic | Strictly more capable than dagre for ER. Pay the bundle size for **port-anchored FK edges into specific table rows**. Used in Sprotty, Theia, parts of drawio's advanced layouts, post-2024 Mermaid. |
| **Cytoscape.js + fcose** | fast compound force (2020+) — designed around compound clusters | core ~400 KB, plugin ~150 KB / MIT | ✓ separate UMD per plugin | **first-class** via `parent` field | ✓ honors real dimensions | iterative but seeded (reproducible) | Arguably the **best out-of-the-box fit for "Miro-style clustered ER canvas"**. Other layouts (`klay`, `cola`, `dagre`, `elk` adapter) swap in via the same Cytoscape setup. |

### 3.2 Conditional

| Library | When it makes sense | Trade-off |
|---------|---------------------|-----------|
| **Viz.js / @viz-js/viz** (Graphviz WASM) | Unbeatable layout quality for clustered ER if you accept Graphviz-rendered SVG | ~1-2 MB; awkward if your nodes are live HTML/CSS components rather than SVG |
| **WebCola / cola.js** | Constraint-based stress majorization with first-class `groups` containment | ~150 KB; largely unmaintained since 2020 — prefer fcose/cytoscape wrapping |
| **G6 (AntV)** | Batteries-included graph viz suite from Alibaba; "combos" first-class | ~500 KB; bigger surface area than fcose alone |

### 3.3 Skip for our use case

- **d3-force** — wrong tool for tall rectangles; `forceCollide(radius)` is circular, ignores ER geometry
- **mxGraph / drawio** — full diagramming framework, too much surface for "just layout"
- **Sigma.js + graphology** — optimized for big-graph network views (10k+ nodes), not ER schemas
- **vis.js / vis-network** — superseded by Cytoscape+fcose and ELK on every axis we care about

---

## 4. How production ER and architecture tools handle it

### 4.1 Tool-by-tool

| Tool | Strategy | Tall-table handling | Clustering | Common complaints |
|------|----------|---------------------|------------|-------------------|
| **dbdiagram.io / dbdocs** | No real auto-layout — grid by declaration order, then manual drag | None — towers force vertical scroll | `TableGroup` only colors the header | "Auto-arrange" stacks tables tightly, ignores edge crossings; most users hand-place |
| **drawSQL** | Force-directed pass on first load, then snapshot | **Column collapse** added explicitly because users complained | Color groups, no spatial enforcement | Force layout puts unrelated tables far apart |
| **Lucidchart ER** | Hierarchical (Sugiyama) for tree-ish, organic (force) for cyclic | Shapes scale | User-drawn frames as containers | — |
| **Miro / Mural** | No auto-layout for ER; manual + snap-to-grid | Tables built from stacked rows | **Frames as swimlanes** — children move with frame (the killer feature) | — |
| **Mermaid ER** | dagre — orthogonal edges with rounded corners | Treats node as one rectangle → very tall tables push entire ranks apart | No subgraph clustering for ER | "Tables stack vertically forever," "no way to group by schema" |
| **DBeaver ER** | Modified Sugiyama, left-to-right | **Attribute visibility toggle** (keys only / all / none) | Schemas as separate diagrams | Generally tolerated; keys-only toggle is praised |
| **PlantUML (IE/Chen)** | Graphviz `dot` (Sugiyama family) | Aligned ranks → 80-row entity creates massive gaps | `package` / `frame` produce true clusters via `cluster_*` subgraphs | Cluster handling is the best of the open-source tools |
| **Hackolade, erwin, PowerDesigner** | Multiple layouts: hierarchical, orthogonal, symmetric, circular + "layout selected only" | **Universal: collapse to PK/FK only and collapse to header** | Subject Areas / Packages — first-class containers | Auto-layout rarely used after initial import; users prefer "layout subset" on selection |
| **drawio / diagrams.net** | mxGraph: hierarchical, organic, tree, circle, fast organic | Hierarchical respects shape height; organic ignores it | Containers/swimlanes first-class, layouts can run *within* a container | Default auto-layout rarely the final state |
| **Lineage tools (OpenLineage UI, Marquez, dbt Cloud)** | Strict left-to-right Sugiyama (dagre or ELK) | Dataset-sized nodes — tall-table problem doesn't exist | Limited; dbt Cloud has no source-system grouping | **Insight:** lineage tools succeed by constraining the problem (DAG, fixed direction). Pure ER can't. |

### 4.2 Cross-cutting observations

- **Edge routing — orthogonal wins.** Every commercial ER tool defaults to orthogonal (right-angle) routing with rounded corners. Splines look elegant in academic papers but obscure cardinality endpoints; orthogonal makes crow's-foot symbols readable and supports parallel edge bundling.
- **Compound layout, not flat.** Tools that handle source-system clustering well (PlantUML/Graphviz, drawio, ELK-based) all run **layout-within-cluster, then layout-of-clusters**. Single global passes consistently produce worse results.
- **Collapse modes are universal.** Every commercial ER tool has at least two of: header-only, PK/FK-only, full. Hand-rolled "show all attributes" is the #1 source of complaints.
- **Auto-layout is a one-shot, not a mode.** No production tool runs continuous force simulation — users must keep their mental map after data refreshes.

---

## 5. Design heuristics for our case

Distilled from commercial-tool analysis and our prior abandoned attempt:

1. **Frame-as-swimlane.** Source systems are first-class containers (Miro frames). Children move with the frame; frame title is sticky. Apply layout *inside* a frame independently. Cross-system edges are routed *around* frames, not through them.
2. **Compound layout, not flat.** Run a layered pass per system, then a coarser layered pass to arrange systems. Never run a single global force pass.
3. **Collapsible nodes by default.** Three states per node: header-only, PK/FK-only, full. **Auto-collapse to PK/FK when a table exceeds ~15 attributes** — this is the single biggest readability win and every commercial tool does it. Specifically: auto-collapse the SAP BAPI and any 200+ column node before laying out.
4. **Orthogonal edge routing with bundling.** Right-angle edges, rounded corners, bundle parallel FKs between the same two tables. Cardinality glyphs at endpoints, no mid-edge labels except role names.
5. **Stable layouts.** Persist node positions per user / per saved canvas. Auto-layout only on first open or explicit "Re-Layout selected." Users must never lose their mental map after a data refresh.
6. **Cross-system edges are special.** Render inter-cluster FKs in a distinct style (dashed or different weight). ELK's `hierarchyHandling: INCLUDE_CHILDREN` does this naturally.
7. **Direction defaults: left→right for lineage-like flows, top→bottom for pure ER.** Allow per-frame override. Codelists/lookup tables pin to a "reference" lane on one side.
8. **Manual override is sacred.** Auto-layout is a starting point and a per-selection "tidy" action — never a continuous simulation. Snap-to-grid and Miro-style alignment guides matter more than algorithmic perfection.

---

## 6. Recommendation and roadmap

### 6.1 Top picks for our constraints

| Rank | Pick | Why it fits | Trade-off |
|------|------|-------------|-----------|
| 1 | **Cytoscape.js + `fcose`** | Compound clusters first-class, respects rectangle sizes, single CDN, MIT, actively maintained, animation optional. Closest to "Miro-style ER with system groups" out of the box. Layouts swap to `klay` / `cola` / `elk` within the same setup. | ~600 KB total; styling ER tables means custom HTML overlays on top of Cytoscape nodes. |
| 2 | **elkjs (`layered`, hierarchical mode)** | Best edge routing for FK relationships, **port-anchored edges** into specific table rows, deterministic, handles compound graphs cleanly. | ~1.5 MB bundle, run in Web Worker, learning curve on options. |
| 3 | **dagre standalone** | Tiny, deterministic, trivial to integrate with hand-rolled HTML/SVG nodes of arbitrary size. Good baseline before reaching for heavier tools. | Edge routing weaker than ELK; cluster visuals minimal. |
| 4 | **@viz-js/viz** (Graphviz WASM) | Unbeatable layout quality for clustered ER. | Awkward if nodes are live HTML rather than SVG. |

**Default recommendation:** **start with Cytoscape + fcose for the clustered Miro feel.** If port-anchored FK edges into specific table rows become important, swap the layout to the **`elk` adapter** within the same Cytoscape setup — minimal code churn, maximum layout quality. If we want to stay vanilla and tiny, **dagre alone** suffices for a v1 — the limitation will be cluster visuals (system frames remain hand-rolled, which is OK).

### 6.2 Suggested phases

**Phase 1 — Auto-collapse before layout.**
Implement the three collapse modes (header / PK+FK / full) with auto-collapse for nodes exceeding a column threshold. **This alone will solve the majority of the readability problem before any new layout algorithm is involved.** Independent of which layout library we eventually pick.

**Phase 2 — Per-system layered layout, no library.**
Per system, sort nodes topologically by FK direction; place in left→right Sugiyama columns using Brandes-Köpf-style coordinate assignment. System frames place left→right. ~300 LOC vanilla JS, deterministic, no dependency. This is the "second attempt at the previously abandoned feature."

**Phase 3 — Switch to ELK if port-anchored edges and inter-cluster routing become important.**
Add `elkjs` as a single CDN dep, run layout in a Web Worker. Edges anchor to specific attribute rows (PK/FK columns). Compound layout handles cross-system edges natively.

**Phase 4 — Editor refinements.**
Snap-to-grid, alignment guides, "Re-Layout selected" action. Manual layout always wins; auto-layout is the assistant.

### 6.3 Anti-patterns to avoid

- Single global force-directed pass → tall ER tables overlap, clusters tear apart, layouts unstable across runs
- Algorithmic re-layout on every data change → users lose mental map
- Hierarchical layout without auto-collapse → one 1500 px node inflates entire ranks
- Pure orthogonal placement without layered backbone → dense bend-heavy diagrams
- Treating system frames as cosmetic colors instead of layout-aware containers → cross-system edges thread through unrelated tables

---

## 7. References

### Foundational papers

- Sugiyama, K., Tagawa, S., Toda, M. (1981). "Methods for Visual Understanding of Hierarchical System Structures." *IEEE Trans. on Systems, Man, and Cybernetics*.
- Reingold, E.M., Tilford, J.S. (1981). "Tidier Drawings of Trees." *IEEE Trans. Software Eng.*
- Tamassia, R. (1987). "On Embedding a Graph in the Grid with the Minimum Number of Bends." *SIAM J. Comput.*
- Kamada, T., Kawai, S. (1989). "An algorithm for drawing general undirected graphs." *Information Processing Letters*.
- Fruchterman, T.M.J., Reingold, E.M. (1991). "Graph Drawing by Force-directed Placement." *Software: Practice and Experience*.
- Gansner, E.R., Koutsofios, E., North, S.C., Vo, K.-P. (1993). "A Technique for Drawing Directed Graphs." *IEEE Trans. Software Eng.* — the Graphviz `dot` algorithm.
- Brandes, U., Köpf, B. (2001). "Fast and Simple Horizontal Coordinate Assignment." *Graph Drawing*.
- Dwyer, T., Koren, Y., Marriott, K. (2006). "IPSep-CoLa: An Incremental Procedure for Separation Constraint Layout of Graphs." *IEEE TVCG*.
- Jacomy, M., Venturini, T., Heymann, S., Bastian, M. (2014). "ForceAtlas2, a Continuous Graph Layout Algorithm." *PLOS ONE*.

### Library homepages

- dagre — github.com/dagrejs/dagre
- ELK / elkjs — eclipse.dev/elk
- Cytoscape.js — js.cytoscape.org
- Graphviz / @viz-js/viz — graphviz.org
- WebCola — github.com/tgdwyer/WebCola
- G6 (AntV) — g6.antv.antgroup.com

### Production tools studied

dbdiagram.io, drawSQL, dbdesigner.net, Lucidchart, Miro, Mermaid, DBeaver, PlantUML, Hackolade, erwin, PowerDesigner, drawio/diagrams.net, OpenLineage UI, Marquez, dbt Cloud lineage.
