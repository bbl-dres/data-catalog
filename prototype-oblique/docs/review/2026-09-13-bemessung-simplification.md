# Applied: Bemessung and business-attribute naming cleanup

**Later follow-up, 13 September:** [Standard now has a five-choice value list](2026-09-13-bemessung-standard.md). It uses value type code, with edition and rule details documented in Quelle. The 52-command evidence below records the earlier cleanup, when Standard retained the structured definition.

13 September 2026; Supabase project `zicluerzbevodlmtbxow`. This changes catalog definitions, not operational building or measurement records.

## Applied content

Bemessung now has **11 active attributes**: Bemessung-ID, Bemessungsart, Wert, Einheit, Quelle, FID, Gültig ab, Gültig bis, Genauigkeit, Standard, Ermittlungsart.

- Archived Bezeichnung, Status, Bemessungsumfang, Bezugsobjekttyp and Bezugsobjekt-ID. Their identities, definitions, assigned rules and historical references remain present.
- Reused all five measuredFor relationships to Gebäude, Geschoss, Raum, Grundstück and Zone. Rule notes require one identified target per operational assertion. Aussenfläche does not yet exist as a separate catalog object.
- Archived the unused scope list and its three codes. Updated GF/GV and other dependent vocabulary/profile notes: selection derives from object, valid hierarchy and measurement kind. Existing totals and ambiguous historical partial values retain their source evidence; no numeric aggregation or conversion was performed.
- Added FID and Genauigkeit. Accuracy uses the user-approved categories **Unbekannt / Geschätzt / Toleranz dokumentiert**, with exact tolerance in the source. These are evidence categories, not an invented numerical ranking.
- Bound the existing Ermittlungsart to a five-value draft list. Standard reuses Bemessungsgrundlage's identity and structured rule reference; the applied edition, category and exceptions remain necessary.
- Renamed Grenzgeometrie to **Geometrie** and Geschossstatus, Raumstatus and Zonenstatus to **Status**. Gebäude uses **Status (GWR)** with an actual foreign-key binding to the existing **GWR Gebäudestatus (GSTAT)** list. Geometriebezug and Bewirtschaftungsstatus retain their distinct meanings. No technical identifier or semantic name was renamed.

## Verification and preservation

A full live snapshot was captured before editing. The same **52 commands** passed a transaction ending in ROLLBACK; the original snapshot fingerprint was then rechecked. The commands were applied in one transaction through the guarded `catalog.api_write` boundary, with original-row/revision checks and audit assertions.

This was an administrative MCP content operation explicitly requested by the project's sole permanent app user. Transaction-local identity/session context was taken from that existing active account to use the ordinary audited command boundary; no token was read, generated or published. No Auth records, grants, RLS policies or schema definitions were changed. The metadata in the public manifest contains no session or account credentials.

The verified result contains 40 explicitly updated records, one additional owner whose revision was advanced by child writes, 12 created definitions/vocabulary records and 52 public audit events. All 3,228 other identified content records, 474 previous history events and all 179 business-attribute rule assignments were preserved. Each command has exactly one private receipt and attribution record. The original 3,922 public rows remain; 64 rows were added, giving 3,986. No rows were deleted.

The current localhost app shows Attribute (11) for Bemessung and **Status (GWR)** linked to **GWR Gebäudestatus (GSTAT)**. The SQL result was compared field-by-field against the before snapshot and expected command bodies. The preview also verified restoration of the entire original state by rollback. Earlier browser save/history/restore verification remains documented in the security review; this content batch does not claim a new browser-authored save.

[Exact applied manifest](2026-09-13-content-cleanup/manifest.json) and [verification](2026-09-13-content-cleanup/verification.json) retain original rows, IDs, command IDs and patches. They are evidence, not schema migrations or a script to rerun. To reverse content later, first read the current revision, then issue fresh audited commands restoring only the reviewed fields; archive new definitions rather than deleting their history. Reconcile subsequent user changes before reversal.

## Remaining domain work

Aussenfläche needs an agreed definition and relation target. Operational interval conventions, exact standard editions and tolerance values belong to the actual source records; no values were invented. The 20 profile selections describe intended views and do not implement an automatic aggregation engine or structured PropertySets.

## Later follow-up

The [catalog refinement](2026-09-13-catalog-refinement.md) adds EBF and SIA 380 / SIA 416/1 (seven current standard choices), replaces the accuracy categories with Geschätzt / Gemessen / Aggregiert / Unbekannt, and simplifies building measurements/storey counts. The command counts and before/after evidence above describe the original batch and remain historical.
