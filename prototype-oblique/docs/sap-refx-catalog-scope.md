# Focused SAP RE-FX catalog — 2026-09-05

## Recommended scope

Keep recognizable core objects and a few supporting datasets. A BW DataSource, API response structure and physical table are different things; alternate extraction views should not automatically become catalog entries. SAP's [master-data overview](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/3683a11901b74d8fa71f35d86abaaae1/e35ad0531d8b4208e10000000a174cb4.html?locale=de-DE&state=PRODUCTION&version=2023.latest) distinguishes fixed usage objects from configurable architectural types. Earlier exclusions concern the unreliable Innovator classes, not the existence of SAP's usage-object model.

| Priority | Entry | Role and evidence |
|---|---|---|
| Core | Wirtschaftseinheit (VIBDBE) | Organizational context; nine documented extraction fields. |
| Core | Grundstück | Land/property identity; technical table ID remains unconfirmed in this catalog. |
| Core | Gebäude (VIBDBU) | Building identity; fields describe the supplied BUILDING API projection. |
| Core | Mietobjekt (VIBDRO) | Rentable object and type; twelve documented extraction fields. |
| Core | Vertrag (VICNCN) | Contract type, term and termination; nine documented extraction fields. |
| Core for the BBL CAD workflow | Architektonisches Objekt (VIBDAO) | Architectural identity, including Ebene and Raum. Diagram fields remain type-specific evidence. |
| Supporting | Bemessungen (VIBDMEAS) | Measurement type, value, unit and validity. Sample fields retained; local AOID mapping needs verification. |
| Supporting, next candidate | Konditionen | Amounts, calculation rules and validity. The extractor spans several tables. |

Add partner assignments or occupancy datasets when a concrete use case needs them. Avoid standalone entries for every text extractor, code table, alternate hierarchy or monthly reporting view. Keep translations with labels, codes with reference data and relationships with their objects.

## Mietobjekt and Vertrag implemented

Reviewed inventories are stored in [sap-refx-data-sources.json](sap-refx-data-sources.json) and selected in [sap-refx-catalog-curation.json](sap-refx-catalog-curation.json):

- [RE: Mietobjekt (Attribute)](https://help.sap.com/docs/SAP_ERP_SPV/d91b9ba4593d4466bfc484ac34ab743d/3219895360b93d58e10000000a174cb4.html?locale=de-DE): `0RENTOBJECT_ATTR`, source table `VIBDRO`, 12 fields. Identifier `t-sap-rental-object`, domain `miete`, realizes `mietobjekt`.
- [RE: Vertrag (Attribute)](https://help.sap.com/docs/SAP_ERP_SPV/d91b9ba4593d4466bfc484ac34ab743d/3b19895360b93d58e10000000a174cb4.html?locale=de-DE): `0RECONTRACT_ATTR`, source table `VICNCN`, 9 fields. Identifier `t-sap-contract`, domain `miete`. `realizes` is unset because the existing Mietvertrag business object is narrower than the general contract inventory; review that mapping with the business model.

German field labels follow the inventories. Both entries declare `fieldScope: "datasource-projection"`. The sources identify extraction fields and source tables, without a separate physical-column mapping or types, keys and mandatory constraints. Missing properties are not inferred. Prose mentioning release-dependent fields does not supply missing technical IDs. Neither entry establishes exposure through the building SOAP API. Both remain Entwurf; the rejected diagram classes remain archived.

## Validity and history

| Concern | Treatment |
|---|---|
| Business validity | Retain valid-from/to with measurements, conditions and assignments: what was valid on a given date? |
| Technical change history | Keep who changed a record and when as audit metadata, unless a specific audit dataset is needed. |
| Calculated period views | Document as derived reporting views when needed, not as another master object. |
| Delta extraction | An extraction capability, distinct from both business validity and audit history. |

[RE: Bemessungen](https://help.sap.com/docs/SAP_ERP_SPV/d91b9ba4593d4466bfc484ac34ab743d/6b19895360b93d58e10000000a174cb4.html?locale=de-DE) documents values, units and validity in VIBDMEAS. [RE: Konditionen](https://help.sap.com/docs/SAP_ERP_SPV/d91b9ba4593d4466bfc484ac34ab743d/6819895360b93d58e10000000a174cb4.html?locale=de-DE) combines condition/calculation tables and derives some daily/monthly amounts. [Belegung (Periodensicht)](https://help.sap.com/docs/SAP_ERP_SPV/d91b9ba4593d4466bfc484ac34ab743d/97136d67cc28470b879074e343af8d48.html?locale=de-DE) produces occupancy periods and calculated measures. These contain meaningful business data, beyond a history of edits.

## Fläche, AOID and DWG geometry

The owner describes BBL's workflow as DWG drawings managed with Korasoft, with an AOID on measurement rows linking to geometry such as rooms or floor-area polygons. This is owner-provided operational knowledge, not a verified claim about every SAP installation or every standard VIBDMEAS row.

[Korasoft Draw](https://www.korasoft.net/en/korasoft-draw-autocad-plug-in/) documents AutoCAD preparation, synchronization with SAP master data and effective-date handling. This supports the workflow's plausibility but does not establish BBL's AOID storage, join columns, geometry identifiers or cardinality.

The Innovator class `Fläche` contains only `Energieverbrauch`, `M2` and `ID`, and an association to `Mieteinheit`. It provides no coordinates, polygon encoding, drawing identifier or explicit AOID mapping. Its name could describe a space, measured area or local integration concept. There is insufficient evidence to rename it Geometry or certify it as a physical RE-FX table. Its draft identity and fields remain unchanged; a visible comment records the uncertainty.

For the next business-model review, distinguish architectural identity, a typed measurement value with unit/validity, drawing geometry with its drawing/version context, and the links between them. A square-metre value is not itself polygon geometry. Do not assume one-to-one cardinality or rename AOID to SAP OBJNR. Verify the actual measurement source/view, AOID column, drawing object key, key scope across drawings/versions and date-alignment rules. Requirements for those links must come from business use cases.

## Navigation and documentation

Seven tables now use descriptions reviewed against SAP Help: Wirtschaftseinheit, Grundstück, Gebäude, Mietobjekt, Vertrag, Architektonisches Objekt and Bemessungen. [sap-refx-definitions.json](sap-refx-definitions.json) stores short excerpts and explicitly marked summaries with source URLs and the reviewed release. Kerndaten identifies excerpts versus summaries. These descriptions explain SAP concepts; they do not validate field inventories or update the business-object definitions. The Grundstück comment explicitly flags the unresolved mapping of its architectural diagram fields to the documented SAP concept.

All entity kinds support an optional plain-text `comment`, shown as Kommentar in Kerndaten and included in Excel metadata. Comments preserve line breaks, escape HTML and are not inherited by fields or attributes. SAP imports retain existing comments and documentation links. Initial comments record inventory limits, the wider scope of Mietobjekt/Vertrag, the owner's AOID explanation and the unresolved BIT/SAP table-name discrepancy. No specific conflicting identifier pair has been established; the owner plans to check the SAP frontend. No identifier was changed on that basis.

Tree groups and members sort by displayed labels with German Swiss collation, case-insensitively and with natural numeric order. Top-level navigation categories and the overview shortcut retain their established positions. Sorting presentation lists does not reorder source fields or datasets.

Tables support optional `informationUrls: string[]`, shown as **Weitere Informationen** in Kerndaten. Multiple HTTP(S) links wrap on narrow screens. A source URL already in this list is not duplicated as Quelldokument. SAP imports populate known documentation links and preserve additional curated links. The array remains in Excel metadata. See [data-model.md](data-model.md).

## Verification

Checks cover source inventories and definitions, comments and their preservation, references, excluded-class preservation, import repeatability, table/field schemas, tree ordering, documentation-link escaping, field search, detail navigation, Excel export and layouts at 1600, 768, 390 and 320 pixels.
