# Component classification and warranty attributes — completed, 13 September 2026

Added the following six draft definitions to **Bauteil**, **Technische Komponente** and **Technische Anlage** (18 additions):

| Attribute | Value type | sortOrder |
|---|---|---:|
| eBKP-H Code | code | 400 |
| Einbaudatum | date | 710 |
| Garant | text | 800 |
| Garantiebeginn | date | 810 |
| Garantieende (2-Jahresfrist) | date | 820 |
| Garantieende (5-Jahresfrist) | date | 830 |

Short German descriptions, empty comments, consistent semantic names and source documentation links. Existing ID and FK attributes keep their names and ordering. These are catalog definitions, not operational equipment records.

## Sources and local choices

[CRB eBKP-H](https://www.crb.ch/de/normen-standards/baukostenplane/baukostenplan-hochbau-ebkp-h) identifies the Baukostenplan Hochbau as SN 506 511 (2020 edition). The catalog currently has 14 separate main-group lists, with no combined list. No single main group is imposed on the general eBKP-H Code attributes. Existing lists and values are unchanged; code validation against a complete vocabulary and automatic IFC classification are not implemented.

The installation and warranty definitions adapt the [SBB Fachdatenkatalog](https://fdk.app.sbb.ch/de/objects) extract supplied by the user. Einbaudatum means installation at the current location. Garant remains the requested text attribute. Unknown or inapplicable dates remain empty; the SBB-specific 01.01.1900 and n.a. placeholders are not adopted. Warranty end dates record the applicable agreed dates, with no automatic calculation or assertion of statutory deadlines. No source-system warranty data was imported.

## Applied verification

Supabase project zicluerzbevodlmtbxow: a guarded rollback preview passed, the full baseline hash was restored, and the same 18 audited create commands committed atomically. Independent readback verified all fields, 18 new history events, exactly three owner revision updates, 3,387 unchanged records and all prior history. No existing source field, relationship, code list or code value changed.

The real frontend projection verifies all three profiles (9 Bauteil / 10 Technische Komponente / 8 Technische Anlage attributes), PK ordering, draft status, types and no broken references. A fresh localhost Bauteil table visibly verifies all six additions, Datum for date fields, ID/FKs first and Status last. The existing UI renders an unrestricted code as Text.

Result: 42 business objects (38 active), 295 business attributes, 95 code lists, 2,120 code values, 121 relationships and 1,206 history events. No schema, auth or permission changes. Prior repository work preserved; no commit or push.

Evidence: [manifest and verification summaries](2026-09-13-component-attributes/). Repository API/alias consistency checks are recorded with the final task verification.

Repository checks passed: generated API contract (36 paths, 19 schemas, 84 read/write operations), 165 canonical EN/DE bindings and git diff --check. Swagger was regenerated only to refresh the canonical document hash for the content-count update.
