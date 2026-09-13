# Gebäude classification bindings — 13 September 2026

Applied to **zicluerzbevodlmtbxow (Data Catalog)** through five audited catalog.api_write commands. The user requested two separate RE-FX Gebäudeart attributes, plus the existing GWR lists for Bauperiode and Gebäudeklasse. No schema change or code-list import was needed.

| Business attribute | Existing value list | Entries |
|---|---|---:|
| Gebäudeart 1 | BBL Gebäudeart 1 | 21 |
| Gebäudeart 2 | BBL Gebäudeart 2 | 100 |
| Bauperiode | GWR Bauperiode (GBAUP) | 13 |
| Gebäudeklasse (GWR) | GWR Gebäudeklasse (GKLAS) | 26 |

The two RE-FX levels are documented in the [preserved BBL model](../sources/sap-refx/sap-refx-model.json) and [SAP F4 transcription](../sources/sap-refx/2026-09-07-sap-f4-referenzdaten.json). The GIS fields bbl_gbda1/bbl_gbda2 already reference the same lists. Generic RE-FX BUILDING_TYPE and MAIN_USAGE_TYPE were not declared equivalent to these two levels. No new source-field mappings or cross-level validation rule was invented.

Created **gebaeude/gebaeudeart-1** and **gebaeude/gebaeudeart-2** as code attributes, with ranks 400 and 405. Both reuse the existing conditional completeness requirement. The combined structured **gebaeude/gebaeudeart** definition is archived at 9030, retaining its UUID, definition, references and history. Other classification ranks remain unchanged.

Bauperiode retains its UUID, semantic name and rank 720; its value specification is now code and links to r-gwr-gbaup. Its definition describes the period of completion without inventing an exact year. Gebäudeklasse retains its UUID, rank 420 and code type and now links to r-gwr-gklas.

**Source versions remain unchanged:** GBAUP is cataloged as 5.0.0; GKLAS remains 4.2. The user-authorized GKLAS binding does not certify equivalence to GWR 5.0. Existing version caveats remain in the list and attribute. The BBL lists retain the known incomplete/truncated source-capture notes.

The final five-command batch passed a rollback preview, complete snapshot-hash comparison, atomic commit and independent postflight verification. Every command has a receipt, private attribution and public audit event. All previous records, source inventories, values, mappings and audit history were verified unchanged except the declared attribute patches, two new definitions, two requirement assignments and exact parent revisions. This is an administrative MCP operation attributed through the guarded edit boundary to the project's existing permanent app user, not a browser-authored edit. No token was read or minted.

Current catalog: **225 BusinessAttributes**, **187 business-attribute rule assignments**. Gebäude has **32 direct active definitions + five referenced measurements = 37 active definitions**; the pre-existing retired Energieträger remains an additional visible row. The seven reviewed profiles have **105 direct definitions** and 17 conceptual measurement selections.

Evidence: [manifest](2026-09-13-building-classifications/manifest.json), [rollback verification](2026-09-13-building-classifications/preview-verification.json), [independent postflight](2026-09-13-building-classifications/postflight-verification.json). Verified in the fresh localhost preview: the two separate Gebäudeart rows, their respective value-list links, the GBAUP/GKLAS links, and the Gebäudeart 1 overview binding. The shared UI renders code values as Text while displaying their bound vocabulary separately. No commit or push.

## Later additions

The [condition/heritage follow-up](2026-09-13-building-condition-heritage.md) adds two further direct definitions. The counts above describe the classification batch; current totals are 107 direct definitions across the seven profiles and 39 active Gebäude definitions.
