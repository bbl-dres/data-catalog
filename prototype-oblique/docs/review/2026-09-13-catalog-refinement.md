# Catalog refinement — 13 September 2026

Applied to Supabase project **zicluerzbevodlmtbxow (Data Catalog)**. The local app reflects the current catalog. No commit or push was performed.

## Applied and preserved

| Batch | Audited commands | Result |
|---|---:|---|
| Building profile and accuracy | 28 | Six new attributes, two archived storey definitions, EBF, standard extensions, four accuracy categories and scoped quality requirements |
| Comment cleanup | 128 | Reviewed 241 populated comments; shortened 128, including 15 cleared; 113 already concise comments retained |
| BBL responsibilities | 138 | Organisation assignments with explicit source/document exceptions |
| Baujahr mappings | 3 | Candidate links from GIS IMMO, RE-FX and GWR fields to Gebäude/Baujahr |

Each batch checked the complete catalog snapshot hash, previewed in a rollback-only transaction, verified exact before/after rows and then committed the identical commands atomically through catalog.api_write. Independent reads verified the result. The administrative MCP operations used the existing guarded edit boundary and its private attribution to the project's sole permanent app user; they were administrative operations, not browser-authored edits. No JWT was read or minted. Three mapping creates initially failed a rollback preview because create revision was null; the required revision zero was used for the successful preview and commit.

All previous rows, references and audit events were compared, with only the declared patches, new rows and exact owner revision bumps permitted. Every command has its receipt, attribution and public event. The four batches added **297 audit events** (750 → 1047); the initial Standard batch's seven events precede this baseline. No RLS, schema, grants, signup, or authentication configuration changed. No source inventory import was rerun. No one-off migration SQL was added to supabase.

Evidence is stored in [2026-09-13-catalog-refinement/](2026-09-13-catalog-refinement/): each batch's manifest, rollback verification and independent postflight verification. Existing identifiers remain stable. New definitions remain drafts; archived entries retain history.

## Building profile

Gebäude now exposes **Geschossfläche (GF), Gebäudegrundfläche (GGF), Vermietbare Fläche (VMF), Energiebezugsfläche (EBF), Gebäudevolumen (GV)** at sortOrder 1100–1140. These are catalog definitions for referenced Bemessungen, not imported asset values or a calculation engine. VMF and EBF have conditional quality requirements. GGF is a footprint; GF is not its synonym. Source-specific measurement bases, units and validity remain necessary.

**Anzahl Geschosse** is a new total-count definition at sortOrder 740. The original above-/below-ground definitions are archived, without repurposing their UUIDs or inventing a sum. Gebäude has **31 direct active definitions + 5 referenced measurement definitions**. The table currently shows 37 rows because the pre-existing retired Energieträger definition remains visible; 37 does not mean 37 active definitions. Across the seven reviewed profiles: **104 direct definitions and 17 conceptual measurement selections**.

| Preserved source inventory | Relevant evidence | Interpretation |
|---|---|---|
| GIS IMMO | garea_gf, larea_ggf, garea_vmf, garea_ebf, gvol_gv; gastw, gastw_og, gastw_ug | Supports the five selected quantities and a total-storey candidate; source partitions retained |
| RE-FX | BUILDING FLOORS/BASEMENTS/CONSTRUCTION_YEAR; MEASUREMENT identity, kind, dates, units, VALUE_AVAIL/VALUE_COMPL and calculation indicators | Exact measurement codes and choice of available/capacity value remain unconfirmed |
| GWR | GAREA, GVOL, GASTW, GEBF plus norm/source/method metadata | Register categories and counting rules require scope review before source equivalence |

Reviewed the saved [GIS import report](../sources/gis-immo/gis-immo-import-report.json), [RE-FX import report](../sources/sap-refx/sap-refx-import-report.json), and preserved GWR table/field documentation. No operational GIS, SAP or GWR records were queried. GWR GASTW counts certain roof/underground levels according to use/heating and excludes cellar levels; it is not automatically the BBL physical total ([GWR catalog, p. 67](https://www.housing-stat.ch/files/881-2200.pdf)).

The EBF definition retains the actual energy-area standard and edition. SIA 380 includes energy-reference-area rules ([publisher preview, section 3.2](https://shop.sia.ch/b1eced21-4220-4350-b516-55b1cda934de/F/DownloadAnhang)); the stored GWR 5.0 source references SIA 416/1:2007. Therefore **SIA_380 and SIA_416_1** were added to BBL Bemessungsstandard, bringing it to seven options, while BBL Bemessungsart now has thirteen kinds including EBF. DIN 277 and IPMS remain separate standard choices ([DIN publisher](https://www.dinmedia.de/en/standard/din-277/342217323), [IPMS publisher](https://ipmsc.org/standards/)); labels do not certify conformance.

Useful later additions, if a business need is agreed: NF/HNF for utilization, dated condition/protection assessments, and apartment count where residential. None was added during this deliberately small profile refinement. Existing source fields remain available.

## BBL Genauigkeit

The user explicitly chose to replace this list: **Geschätzt / Gemessen / Aggregiert / Unbekannt**, ordered 10/20/30/40. Existing estimate/unknown identities are retained. Toleranz dokumentiert is archived, not converted to Gemessen. Exact tolerance stays in Quelle. These qualitative categories do not guarantee precision; aggregated inputs may include estimates. BBL Ermittlungsart remains unchanged as a separate five-option list.

## Comments

Comment text decreased from 29,451 to 11,275 characters (about 62%); the longest remaining comment is 126 characters. Definitions, evidence links, property-set markers, key-role markers and previous history were preserved. No blanket deletion or truncation rule was applied. Example: Gebäude now says “Basisbemessungen werden aus Bemessung referenziert.”

## Responsibilities

| Scope | Assigned organisation |
|---|---|
| Architektonische Sicht, with exceptions below | BBL Immobilienmanagement |
| Mietermanagement | BBL Liegenschaften |
| Teilportfolio, Objektstrategie and related portfolio fields | BBL Portfoliomanagement |
| Bauprojekte | BBL Projektmanagement |
| FM, energy, building automation and technical operation | BBL Objektmanagement |
| Future early development/definition entries | BBL Projektentwicklung — no dedicated current entry to update |

Of 138 updates, 70 assign Immobilienmanagement, 18 Portfoliomanagement, 32 Objektmanagement, 12 Liegenschaften and 6 Projektmanagement. Attribute/field exceptions preserve the broader parent scope. Two existing organisation actor labels were normalized; their IDs and all person actors remain intact. All document-domain records and external GWR/AV source organisations were excluded from this batch and verified unchanged. Organisation cleanup did not interpret external standard publication as BBL authorship. Legacy authority labels on r-sia-flaeche and r-kanton need separate review; other unclassified domains retain existing assignments.

## Attribute ↔ table relationships

The existing **DataField → BusinessAttribute represents** model is sufficient; no schema migration was needed. Added three candidates to **gebaeude/baujahr**:

| Table | Field | State |
|---|---|---|
| GIS IMMO Gebäude | bbl_bjahr | Candidate / coverage unknown |
| SAP RE-FX Gebäude (VIBDBU) | CONSTRUCTION_YEAR | Candidate / coverage unknown |
| GWR Gebäude (GWR_GEBAEUDE) | GBAUJ | Candidate / coverage unknown |

Each has source-specific review notes. GWR Wohnungsbaujahr, RE-FX construction start and reconstruction year were excluded because they describe different subjects or events. No string-similarity mapping or operational coverage claim was introduced.

Attribute profiles show deduplicated mapped tables and individual source fields. Fields and tables link back to attributes. The list, diagram tooltip and selection details identify candidate versus confirmed status; rejected/archived links and retired endpoints are excluded. Baujahr shows seven context entries: one parent, three tables and three fields, representing three stored mapping assertions. Source-to-target equivalence still needs steward confirmation. The existing browser has no relationship editor; authored assertions remain accessible through the guarded REST/RPC boundary.

## Presentation and verification

Detail overviews always use one column, Verantwortlich first and System last. Bereitstellungsformen uses the same full-width chevron button as other sections, starts expanded, and collapses on click/Enter/Space. Child choices survive parent collapse; printing includes collapsed content.

Verified in the actual localhost app: building quantities and total-storey row; responsibility above facts; concise comment; four accuracy values; preserved external BFS responsibility; three Baujahr tables/fields and candidate labels; reciprocal table link; and access-section width, chevron and collapse/reopen. Tests cover explicit mapping states, duplicate-table suppression and retired endpoints; section keyboard/print behavior, all three access editors, four languages and 320–1440 px layouts; detail layouts at 320/390/1440/1920 px. All 49 core and mapping tests passed. The core suite's previous invalid-version and maximum-column expectations were updated for the already introduced v2/status feature.

Still unverified: live source value equivalence, SAP measurement code/value-field decisions, BBL-specific storey counting details, and browser editing of mappings (no such editor exists). Projektentwicklung needs a defined catalog entry before a targeted assignment. The separately queued Edge Function deployment issue is unaffected.

## Later classification correction

The [Gebäude classification follow-up](2026-09-13-building-classifications.md) splits Gebäudeart into two list-bound attributes and binds GBAUP/GKLAS. It adds one net active direct definition; the 104/36 counts above describe this earlier batch. Current totals are 105 direct definitions across the seven profiles and 37 active Gebäude definitions.
