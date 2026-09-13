# Simple building references and Bemessung — completed, 13 September 2026

- Technische Anlage: Versorgte Gebäude-IDs becomes **Gebäude-ID**, a single identifier at rank 200. Stable record ID and URL identifier retained; concise assignment description.
- Heizzentrale: retain **Gebäude-ID** at rank 200 and archive the extra Versorgte Gebäude-IDs definition. Raum-ID remains available. This is the user-requested simplified local profile; supplied buildings are no longer modeled separately.
- Bemessung: archive **Ermittlungsart** and rename **FID** to **FID (AOID)**. The label includes the user's SAP terminology, Architectural Object ID; the existing identifier, source-reference meaning and other metadata are unchanged. No identifier conversion is implied.

Bemessung now has ten active attributes: ID, Bemessungsart, Wert, Einheit, Quelle, FID (AOID), Standard, Genauigkeit, Gültig ab, Gültig bis. Detailed method evidence can remain in Quelle. The former Ermittlungsart list, its values and shared quality requirements remain intact; only the attribute is removed from the active profile.

Five guarded audited updates passed a rollback preview, an unchanged full-catalog hash check and independent committed readback. All 3,400 untouched records, source inventories, relationships, value lists and prior history were verified unchanged. Two definitions are archived with history, with no hard deletion or operational instance data affected. Total stored attributes remain 295 (including archives); history now contains 1,211 events. No schema or security changes.

The actual frontend projection checks all three profiles, one active Gebäude-ID per relevant profile, unchanged ID ordering and no broken references. A fresh localhost Bemessung table shows ten entries, FID (AOID), and no Ermittlungsart. The FID name-only edit preserves its previous key-role projection; the existing comment does not contain a standalone FK display marker.

Other naming candidates **explicitly skipped by the user**, not pending and not applied: Technische Anlage-IDs → Technische Anlage-ID; Region / Kanton / Bundesstaat → Region; Raumnutzung → Nutzung. Plural-to-singular naming should keep any required multiple assignments explicit in the underlying definition.

Evidence: [manifest and verification summaries](2026-09-13-simple-attributes/). Prior repository work preserved. No commit or push.
