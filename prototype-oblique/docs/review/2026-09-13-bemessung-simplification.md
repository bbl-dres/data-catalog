# Queued: simplify Bemessung

13 September 2026. Requested after completion of the database activation/security review. **Proposal only; no Bemessung content was changed.** This concerns business-attribute definitions and relationships in the catalog, not the creation of a physical measurement-data table.

## Current state

Read-only Supabase inspection found 14 unarchived attributes: Bemessung-ID, Bemessungsart, Bemessungsgrundlage, Bemessungsumfang, Bezeichnung, Bezugsobjekt-ID, Bezugsobjekttyp, Einheit, Ermittlungsart, Gültig ab, Gültig bis, Quelle and Wert.

Bezeichnung and Status already say in their comments that they were removed from the business profile, but they remain unarchived and visible. Ermittlungsart already captures DWG/IFC derivation, manual measurement, adoption from evidence, calculation and estimation. Reuse its identity rather than creating a duplicate. The current profile deliberately distinguishes overall, above-ground and below-ground measurements.

## Recommended target

Keep a small required core and group optional provenance/quality fields separately. Twelve business attributes plus an explicit measured-object relationship are sufficient for the stated scope:

| Field | Recommendation |
|---|---|
| Bemessung-ID | Stable identity. |
| Bemessungsart | Controlled vocabulary: what quantity is determined. |
| Wert | Numeric value; unknown is not zero. |
| Einheit | Controlled unit compatible with the measurement kind. |
| Bemessungsumfang | Retain: Gesamt / oberirdisch / unterirdisch. Other subsets need an explicit documented boundary. Do not infer Gesamt when unknown. |
| Gültig ab | When the value applies to the measured object; do not substitute a catalog edit date. |
| Gültig bis | Optional open end; agree whether the end is inclusive or exclusive. |
| Quelle | Concrete source/document/model and its revision; allow a measurement protocol for manual work. |
| Geometrie-ID (FID) | Optional source-scoped reference. Retain source file/dataset, layer where applicable, revision and identifier. IFC GlobalId, DWG entity handles and GIS FIDs are different identifier schemes. |
| Standard / Bemessungsregel | Controlled rule reference including its actual edition/category, e.g. SIA 416, DIN 277, IPMS or a documented BBL rule. Preserve boundary/deduction exceptions from the existing Bemessungsgrundlage as source/rule details. |
| Ermittlungsart | Controlled method: model-derived, measured, adopted from evidence, calculated, estimated. DWG/IFC identifies the source format; typing a number manually does not describe how it was measured. |
| Genauigkeitsklasse | Optional controlled quality class with defined criteria and an unknown state. Avoid arbitrary high/medium/low labels. If a numeric uncertainty/tolerance is required, model it explicitly with its unit rather than inventing a class. |

**Object relation:** each measurement statement targets one identified measured object (Gebäude, Geschoss, Raum, Zone, Grundstück, Aussenfläche, etc.). Replace the separate type/ID presentation with a typed relationship. The source geometry identifier does not replace the business-object relationship. An aggregate targets an explicitly identified aggregate/zone; do not ambiguously attach one scalar to several independent objects. The catalog can document the permitted relationships now; enforcement on actual operational measurement records belongs to the consuming system.

No additional default business fields are recommended. Measurement date may be useful when distinct from validity and source revision; retain it in provenance unless reporting requires a separate searchable field. Calculation inputs/formula remain provenance details where needed. Generic name, catalog workflow status and edit timestamps should not duplicate business attributes.

This is a design recommendation informed by [OGC's observation model](https://docs.ogc.org/as/20-082r4/20-082r4.html), which separates the observed property, result, target, procedure, time and quality, and [buildingSMART's IfcElementQuantity](https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcElementQuantity.htm), which distinguishes a quantity's meaning from its method of measurement. It is not a claim that the proposed local fields establish compliance with any named measurement standard.

## Work queued

1. Settle vocabulary semantics (especially accuracy criteria, standard editions and source identifier scope) and the measured-object relationships.
2. Archive the two already superseded definitions; preserve UUIDs, history and any incoming references. Reuse continuing definitions and map the two current object-reference attributes to the relationship model. Preserve Bemessungsumfang and the existing source/method requirements.
3. Update the reviewed business-object proposal, dependent object profiles and reference vocabularies together. Check all mappings, rules and relations before retiring definitions; add Aussenfläche only when the corresponding catalog object/reference is established.
4. Apply only the reviewed content changes through the audited command API, with revisions and reversible verification. This does not require replaying any schema migration or import.

The reduction is chiefly conceptual: 12 attributes with clear optionality instead of 14 partly duplicated fields, plus an explicit relationship. Do not trade necessary meaning for a lower field count.
