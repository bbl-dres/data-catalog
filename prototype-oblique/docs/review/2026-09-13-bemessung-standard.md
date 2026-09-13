# Applied: Bemessung Standard value list

Applied 13 September 2026 to Supabase project zicluerzbevodlmtbxow (Data Catalog). This is a separate content follow-up after the cleanup and attribute-order batches.

## Change

No suitable general measurement-standard list existed. Created draft **BBL Bemessungsstandard** (profile-bemessungsstandard) and these five values, ordered 10–50:

| Code | Standard |
|---|---|
| `SIA_416` | SIA 416 |
| `DIN_277` | DIN 277 |
| `IPMS` | IPMS |
| `BBL_REGEL` | BBL-Regel |
| `ANDERE_REGEL` | Andere dokumentierte Regel |

Bound the existing Standard attribute (bemessung/bemessungsgrundlage) and changed its value specification from structured to code. Its ID, semantic name measurementBasis, sortOrder 1220, lifecycle, rules and other references stay unchanged. Bemessungsart still has its existing twelve choices; the standard remains a separate measurement property.

The actual edition, category, boundaries, deductions and deviations must remain documented in Quelle. Unknown basis stays open; Andere dokumentierte Regel is for a known, identified rule. BBL-Regel is a local grouping, not a claim that one universal BBL standard exists. This updates catalog definitions only, with no conversion of operational measurement records and no schema or permission changes.

The official publisher references are attached to the three corresponding code values: [SIA 416](https://www.shop.sia.ch/normenwerk/architekt/sia%20416/dfi/D/Product/), [DIN 277](https://www.dinmedia.de/en/standard/din-277/342217323), [IPMS](https://ipmsc.org/standards/). These help identify the standard family; they do not assert which edition was used for any measurement. IPMS source descriptions explicitly preserve older measurements' actual document and edition.

## Verification

- Seven commands: one code list, five code values, one attribute update. Previewed through the guarded catalog.api_write boundary in a rollback-only transaction; the subsequent full-catalog hash matched the original baseline.
- Applied the identical commands atomically after checking the full snapshot and every original target row. Expected revision and command UUIDs protect against concurrent changes and duplicate writes.
- Administrative MCP operation authorized by the project's sole active permanent app user. Used that existing account/session context for guarded RPC authorization and audit attribution; no JWT/token was read or minted and no authentication records were modified. The records were authored administratively, not by a browser save.
- Independent post-commit readback verified the five codes, binding, rank and all patch values. The Standard attribute and its owning business object have the expected revision increments. 3279 other identified records, all 743 previous history events and all 179 rule assignments remained unchanged. Exactly seven new public audit events and seven private receipts/attributions were checked.
- Current totals: 93 code lists, 2,093 values, 217 business attributes, 750 history events. Bemessung retains eleven active attributes.
- In the signed-in localhost app, opened Standard, followed BBL Bemessungsstandard and verified the five displayed values. This check did not perform another browser save.

Evidence: [command manifest](2026-09-13-bemessung-standard/manifest.json) and [independent readback verification](2026-09-13-bemessung-standard/verification.json). These are records of applied work, not migrations to rerun. No commit or push performed.

## Later follow-up

The [catalog refinement](2026-09-13-catalog-refinement.md) adds EBF and SIA 380 / SIA 416/1 (seven current standard choices), replaces the accuracy categories with Geschätzt / Gemessen / Aggregiert / Unbekannt, and simplifies building measurements/storey counts. The command counts and before/after evidence above describe the original batch and remain historical.
