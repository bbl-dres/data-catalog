# Gebäudezustand and Schutz-/Denkmalstatus — 13 September 2026

The user approved these two additions and explicitly excluded NF/HNF and Anzahl Wohnungen. Applied **four audited commands** in Supabase project zicluerzbevodlmtbxow: two BusinessAttributes and two candidate represents relationships.

| Attribute | Group / rank | Responsibility | Candidate source |
|---|---|---|---|
| Gebäudezustand | Bewirtschaftung / 910 | BBL Objektmanagement | RE-FX BUILDING_CONDITION |
| Schutz-/Denkmalstatus | Klassifikation und Nutzung / 440 | BBL Immobilienmanagement | RE-FX HAS_HIST_SITE_PROTECTION |

Both definitions use **text provisionally**, preserving the original source wording. Neither source field has a documented code list in the catalog. An optional representation question was left open; the conservative interim choice does not invent an official BBL/SAP vocabulary. Both entries remain drafts with no new mandatory requirement. Link approved source lists later without replacing their identities.

Gebäudezustand calls for the assessment date and method. Schutz-/Denkmalstatus calls for its source, applicable scope and recorded status/date. Missing data does not mean good condition or no protection. No actual assessment or legal status was assigned to an asset. The RE-FX protection indicator is a candidate source for the broader attribute; its encoding and coverage remain unverified. GIS KGS categories were not turned into a generic protection-status list.

Source evidence: existing BUILDING_CONDITION and HAS_HIST_SITE_PROTECTION field definitions in the [preserved RE-FX inventory](../sources/sap-refx/sap-refx-import-report.json). No live SAP values or undocumented codes were imported. Both relationships are **candidate / coverage unknown**.

Verification: complete-snapshot guard; rollback preview; exact before/after preservation; identical atomic commit; independent postflight read. All existing records, mappings, code lists, values, assignments and history are unchanged except the expected building owner revisions. Four new records and four audit events were added. Commands used the guarded catalog.api_write boundary with private attribution to the existing permanent app user through the authorized administrative MCP operation; no token was read or minted.

Current totals: **227 BusinessAttributes**, **117 relationships** (five represents candidates), 187 business-attribute rule assignments. Gebäude has **34 direct active definitions + five referenced measurements = 39 active definitions**. The pre-existing retired Energieträger remains an additional visible row. The seven reviewed profiles now contain **107 direct definitions** and 17 conceptual measurement selections.

Evidence: [manifest](2026-09-13-building-condition-heritage/manifest.json), [rollback verification](2026-09-13-building-condition-heritage/preview-verification.json), [postflight verification](2026-09-13-building-condition-heritage/postflight-verification.json). Verified in the fresh localhost preview: both new attribute headings, text representation, the correct BBL organisations, and Gebäudezustand links to the RE-FX table and BUILDING_CONDITION field. No schema/RLS/authentication changes, commit or push.
