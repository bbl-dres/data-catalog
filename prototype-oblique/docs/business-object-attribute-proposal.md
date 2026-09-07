# Business-object attribute proposal

Initial review: 5 September 2026. Building/parcel revision: **7 September 2026**, following a closer review of GIS IMMO, BBL RE-FX and GWR. **Proposal for business review; catalog records and `objects.json` have not been changed.**

The revised working list has **14 attributes for Gebäude, 7 for Grundstück, 6 for Wirtschaftseinheit and 8 for Bemessung**. Gebäude also needs explicit location, structure and management relationships. Wirtschaftseinheit and Bemessung retain their previous profiles. The scope is identification, property management, register matching and reliable area/volume information for BBL; the attribute count is a consequence of that scope, not a fixed limit.

The [building review](review/2026-09-07-building-attribute-review.md) records field-level evidence, source limitations and the reasons for the additions. **Gebäudehülle (AO) remains in the GIS IMMO catalog scope.**

These are proposed business requirements, informed by the current BBL inventories. A field's presence in a spreadsheet does not make it a requirement; its absence from an API does not remove a business need. No physical columns, keys, lengths or integration protocols are prescribed here.

## Evidence and interpretation

The supplied workbook is `C:\Users\david\Downloads\202404_IBPDI_Real_Estate_CDM.xlsx`, sheet `IBPDI_Real_Estate_CDM`: 1,977 attribute rows, 256 distinct cluster/entity combinations and seven clusters. SHA-256: `4eb31075e726c63a9864be3f3505b9843ac4ae251a37732e91dee61c5f722428`. Row references below are Excel row numbers, including the header. This is the supplied April 2024 snapshot; it is not claimed to be the latest release.

[IBPDI describes its CDM as modular and extensible](https://ibpdi.org/cdm-for-real-estate/). Selective reuse fits this request. The workbook contains implementation and exchange conventions as well as business concepts; those conventions should not automatically become BBL requirements.

| Evidence | Useful contribution | Interpretation for BBL |
|---|---|---|
| IBPDI `Building`, rows 219–241 | Identity, name, use, construction year and lifecycle | Good starting point. `PrimaryTypeOfBuilding` describes use; it is not an established mapping to GWR Gebäudekategorie or BBL Gebäudeart. |
| IBPDI `Land`, rows 1058–1069 | Land identity, designation and parcel reference | Broader than a cadastral parcel: examples include parks and gardens. Use AV evidence for parcel identification and boundaries. |
| IBPDI `Site`, rows 1190–1196; `Unit`, 1339–1344; `Portfolio`, 1552–1565 | Several forms of grouping | No explicit Wirtschaftseinheit equivalent was found. None establishes the BBL economic grouping by itself. |
| IBPDI `AreaMeasurement`, rows 173–180; subject links, 181–194 | Measurement type, value, unit, basis, validity and related object | Strong foundation for Bemessung. Extend the area-only concept to BBL's area and volume needs. |
| [GIS IMMO inventory](imports/gis-immo-import.md), particularly `t-geb-gis` and `t-parzelle` | BBL numbers, designations, WE assignment, ownership category, portfolio, responsibility, EGID/EGRID and measured quantities | Evidence of actual BBL work. Mapping to the conceptual concepts still needs semantic review. |
| [Reviewed SAP definitions and scope](imports/sap-refx-catalog-scope.md), [BBL API inventory](sources/sap-refx/sap-refx-import-report.json) | Separate usage/architectural contexts; building types, condition, dates, partial architectural links and dated parcel associations | A commercial building record, an architectural object and a physical building must be reconciled. Wirtschaftseinheit is not a Profit Center. The measurement field sample is not a verified full inventory. |
| [GWR import](imports/gwr-import.md), including the saved 5.0.0 revised feature descriptions | Physical building identity, status, categories/classes, dates, entrances and counting rules | Preserve register semantics and source versions. GWR's selected parcel reference is not a complete relationship set; its storey count is not a generic total. |
| [AV model review](imports/av-import.md) | Official parcel identity and geometry semantics | Complements IBPDI where Swiss parcel requirements are more specific. |

The current business model has three material gaps: Gebäude identity depends entirely on EGID; Wirtschaftseinheit is defined through SAP and Profit Center; Bemessung has neither a value nor a unit or measurement type. The first seven-attribute building proposal also omitted BBL building classification, commercial lifecycle, age precision and structural counts. Address these in the business model before preparing system changes.

## Reading the proposal

**Core** means needed for the intended business use. **Conditional** means needed when applicable, with missing values recorded as a completeness issue. **Optional** means useful but not a gate for that use. These are proposed business completeness rules, not database constraints. Existing unknown values must remain unknown.

Each object needs stable identity. An existing BBL number may satisfy that requirement if its scope, uniqueness and stability are confirmed. The GIS workbook describes `bbl_id` as a combination of company code, WE and subobject; in the footprint group it can contain several concatenated IDs. It is therefore not yet a proven permanent identifier for one physical building. Preserve operational numbers as references if they change when an object is reassigned; do not require a new identifier format in the conceptual model.

German names below are proposed business labels. Descriptions are newly written BBL working definitions, not official quotations. The existing catalog's definition, Kommentar, data owner, catalog status and edit timestamps remain catalog metadata. **Gebäudestatus and Bewirtschaftungsstatus describe real objects; Entwurf describes review of the catalog definition.**

## Gebäude — 14 attributes and related information

Proposed working definition: **Ein baulich abgegrenztes, dauerhaftes und überdachtes Bauwerk, das als eigenständiges physisches Objekt identifiziert und bewirtschaftet wird.** Its existence does not depend on a register entry or one commercial assignment. The physical boundary must be established explicitly: management grouping, address count and geometry-record count are insufficient substitutes.

### Distinguish the objects before matching attributes

| Perspective | What it describes | Consequence for the business model |
|---|---|---|
| Physical Gebäude | The building and its lifecycle | Own stable identity; a group of buildings is an explicit grouping. |
| BBL/SAP managed building | Commercial identity scoped by the operational system; assignments and use | Preserve BBL/SAP numbers as scoped references. Their correspondence to the physical building needs review. |
| Architektonisches Objekt | Spatial structure and its parts | Keep typed, dated links, including partial correspondence where documented. Do not merge an architectural object with a usage object merely because both are labelled Gebäude. |
| GIS footprint / envelope | A geometric representation with its own scope and source | Bodenabdeckung type Gebäude and Gebäudehülle (AO) remain distinct inventories. One geometry record can contain several BBL IDs in the supplied workbook. |
| GWR building / entrance | Register-defined building boundary and separately identified entrances | Assign EGID to the matching physical extent; an entrance's EDID is scoped by EGID. Multiple entrances do not imply multiple buildings. |

The GWR/AV guidance illustrates both separate buildings connected through a garage and one complex building with several entrances. These cases justify explicit boundary review. They do not establish a universal one-to-one mapping between BBL, SAP, GIS and GWR records. See the [review evidence](review/2026-09-07-building-attribute-review.md#building-identity-and-extent).

### Proposed attributes

| Attribute | Business meaning | Presence |
|---|---|---|
| Gebäude-ID | Stable identification of the physical building across its lifecycle and management reassignments. Existing BBL numbers may qualify after their scope/stability is confirmed. | Core |
| Bezeichnung | Readable building name or short designation. | Core |
| Gebäudeart (BBL) | BBL building classification, preserving the available hierarchy of levels 1 and 2. This is one classification value with hierarchy context, not two unrelated types or an assumed use classification. | Conditional: within the agreed BBL classification scope |
| Hauptnutzung | Predominant actual use for the portfolio overview. Define how predominance is assessed; detailed mixed use remains with spaces/use assignments. | Conditional: where determined |
| Gebäudestatus (physisch) | Physical lifecycle. Preserve distinctions such as planned, approved, under construction, existing, unusable, demolished and unrealized when using GWR semantics. | Core |
| Bewirtschaftungsstatus (Gebäude) | Business management state of the building in the BBL portfolio, with applicable date. Agree its vocabulary separately from physical status, ownership/tenure and raw SAP system/user statuses. | Core for buildings within BBL management scope |
| Baujahr | Year of physical completion. Renovation, use conversion and a planned completion date are separate facts. | Conditional: completed building, where known |
| Bauperiode | Known construction period when an exact year is unavailable, or an explicitly derived reporting classification. Record the period scheme and distinguish known from derived values. Never invent a year from the middle of a period. | Conditional: only a period is known or reporting needs it |
| Abbruchjahr | Year of complete physical demolition. Sale, withdrawal from management and end of use do not establish demolition. Partial demolition belongs to a dated event. | Conditional: demolished building, where known |
| Anzahl oberirdische Geschosse | Count above ground under an agreed rule, explicitly covering ground floor, roof levels and mezzanines. Retain source/date and the rule used. | Conditional: where known for the structural overview |
| Anzahl unterirdische Geschosse | Count below ground under the same agreed structural rules. Unknown is different from a confirmed zero. | Conditional: where known for the structural overview |
| EGID | Official GWR identifier for the reconciled physical building. Keep operational BBL/SAP references separately. Several candidate EGIDs signal a boundary/mapping issue, not a comma-separated identifier. | Conditional: applicable Swiss register object with confirmed correspondence |
| Gebäudekategorie (GWR) | GWR category, including its distinction by residential/non-residential purpose. | Conditional: applicable GWR record |
| Gebäudeklasse (GWR) | The more detailed GWR/Eurostat-based building classification. Retain independently of GKAT, BBL building type and BBL primary use. | Conditional: applicable GWR record and available classification |

The additions to the first proposal are **Gebäudeart (BBL), Bewirtschaftungsstatus, Bauperiode, Abbruchjahr, two storey counts and Gebäudeklasse (GWR)**. Source evidence and candidate correspondences are in the [attribute review](review/2026-09-07-building-attribute-review.md#attribute-evidence-and-recommendations). These are proposed requirements; source availability alone does not make every value mandatory.

Three mapping decisions need explicit review. First, GIS `bbl_gbda1`/`bbl_gbda2`, SAP `BUILDING_TYPE`/`MAIN_USAGE_TYPE`, GWR `GKAT`/`GKLAS` and IBPDI `PrimaryTypeOfBuilding` are not interchangeable. Second, GWR `GASTW` has a use/heating-dependent rule for some roof/basement levels; do not equate it with GIS `gastw`, `gastw_og`, `gastw_ug` or SAP `FLOORS`/`BASEMENTS`. Third, the existing GKLAS list is from the supplied 4.2 workbook and is not verified as a 5.0 vocabulary. No new value list or approved mapping is created by this proposal.

### Related information needed for a usable building profile

| Information | Minimum business content and rule |
|---|---|
| Location and entrances | Country, location and applicable address/entrance records; preserve several entrances and their identities. At least one usable location is needed for management, even when there is no street address. A coordinate needs its reference system, source and meaning (building point versus entrance). |
| Structure and representations | Building/part/level/room context as needed; links to usage objects, architectural objects, footprint and envelope with extent, source/version and validity. Do not prescribe one-to-one cardinality before reviewing BBL cases. |
| Grundstück | All relevant parcel associations and their validity. An available share needs its definition/denominator. GWR `GEGRID` is a selected register reference, not an exhaustive list; a building-right reference does not automatically identify a land-parcel polygon. |
| Management and rights | WE membership, actual portfolio assignment, object strategy, responsible roles, ownership/tenure and relevant contracts. Preserve applicable dates. Distinguish responsibility for the building from ownership of its catalog definition. |
| Bemessungen | Typed values with unit, basis, validity and geometry/document context under the unchanged Bemessung profile. A footprint area, summed floor area, energy-reference area and building volume are different assertions. |
| Events and assessments | Renovation, reconstruction, acquisition/disposal and condition assessment with their own dates and meanings. Keep a condition rating with assessment date, scale and source; do not rename it physical lifecycle status. |
| Protection and technical installations | Relevant protection designation/inventory reference and its scope; equipment and energy-supply relationships where required. KGS classification and monument-protection assertions require separate semantic checks. |

These relationships are part of the business requirements; their absence is not excused by the small scalar attribute list. This document does not implement new relationship types in the catalog schema. Operational identifiers, ownership shares, financial values and geometry locators keep their actual scopes rather than becoming generic building attributes.

**Energy scope:** retain heating/energy information through a dedicated model rather than one universal Energieträger value. The imported GWR 5.0 inventory has a separate Wärmeerzeugungsanlage entity; older GIS heating fields must not be silently treated as an equivalent schema. Facility details remain a later scoped extension, with applicable source and date.

## Grundstück — 7 attributes

Proposed first-profile scope: **Eine grundbuchlich geführte Landparzelle mit eigener Identität und räumlicher Abgrenzung.** This deliberately covers the parcel use case requested for AV. The wider property/right model is a separate scope decision; a building right must not be flattened into a land-parcel polygon.

| Attribute | Business meaning | Presence |
|---|---|---|
| Grundstück-ID | Stable BBL identification of the parcel, with a relationship to the official identity. | Core |
| Bezeichnung | Readable local designation, where one is used. | Optional |
| EGRID | Official cross-system property identifier. | Conditional: where assigned/available |
| Grundstücksnummer | Official parcel number, preserved as an identifier including any letters or leading zeros. | Core for a registered parcel |
| Nummerierungsbereich | Context in which the official parcel number is unique. | Core with Grundstücksnummer |
| Grenzgeometrie | Actual parcel boundary, including its parts and holes. | Core for the BBL spatial use case |
| Rechtsstand | Reported legal validity of the parcel boundary, distinct from ownership, delivery completeness and catalog status. | Conditional: supplied by the authoritative source |

The [official DM.01 model](https://models.geo.admin.ch/V_D/DM.01-AV-CH_LV95_24d_ili1.ili), `Liegenschaften.Grundstueck` and `Liegenschaft`, distinguishes number plus numbering area, optional EGRID, validity, completeness and potentially several geometry parts. A municipality name alone is not a substitute for that numbering context.

**Essential relationships:** Standortgemeinde, Gebäude, Wirtschaftseinheit and Bemessungen. Keep **amtliche Grundstücksfläche** as a typed Bemessung available from the parcel. An area calculated from geometry is a separate measurement; it must not overwrite the official area. Ownership/tenure uses the shared profile below.

Grenzgeometrie is a structured business value: retain its reference system, source/version, applicable date and completeness. This context is necessary to judge whether a boundary can be used. It does not prescribe WFS, DWG or a storage format. An absent or partial boundary remains a visible gap; a map image, centre point or bounding box is not a completed boundary requirement.

**GIS/RE-FX/GWR refinements:** retain the seven attributes, with the following qualifications from the [parcel review](review/2026-09-07-building-attribute-review.md#grundstück-and-buildingparcel-relationships):

- GIS includes international locations and explicitly scopes EGRID to Switzerland. For a foreign parcel, preserve the applicable register's identity and numbering context through a register reference; do not require or fabricate an EGRID.
- The GIS parcel coordinates describe a point within a polygon. They do not supply Grenzgeometrie. The undocumented `av_stat` meaning is insufficient to map it to Rechtsstand.
- Keep complete building/parcel relationships separately from GWR's selected `GEGRID`. The BBL API documents dated building/parcel associations and a percentage in `CUS_DATA_BU2`; verify the share's meaning before treating it as ownership or geometric overlap.
- Portfolio, tenure, financial values, building-zone designations and hazards remain related management or spatial information with source and validity. They must remain discoverable without being confused with parcel identity or boundary validity.

## Wirtschaftseinheit — 6 attributes

Proposed working definition: **Eine nach wirtschaftlichen Bewirtschaftungskriterien abgegrenzte Zusammenfassung von Immobilienobjekten.** The grouping can include buildings and parcels; it need not coincide with a campus, parcel boundary or physical building.

| Attribute | Business meaning | Presence |
|---|---|---|
| Wirtschaftseinheit-ID | Stable business identification; the existing WE number may fulfil this once its scope is established. | Core |
| Bezeichnung | Readable name of the economic management unit. | Core |
| Bewirtschaftungszweck | Short explanation of why the objects are managed together and where the grouping ends. | Core |
| Bewirtschaftungsstatus | Whether the unit is planned, active or closed. These are proposed meanings, pending the BBL vocabulary. | Core |
| Gültig ab | Start of the economic grouping's business validity. | Core once established |
| Gültig bis | End of the grouping's validity; may remain open. | Optional until closure |

**Essential relationships:** assigned Gebäude/Grundstücke, responsible organisation/person, portfolio and relevant contracts. Membership has business validity: a reassignment should not change the identity of the physical building or rewrite historical membership.

Buchungskreis and Profit Center remain financial assignments or system mappings when required by a process. They do not define the business object's identity or require a one-to-one correspondence. The [reviewed SAP definition](sources/sap-refx/sap-refx-definitions.json) supports economic and/or location-based grouping; the supplied GIS description of `bbl_we` likewise explains a commercial grouping. Neither establishes an identity with Profit Center.

## Bemessung — 8 attributes

Proposed working definition: **Ein fachlich bestimmter Flächen- oder Volumenwert für ein Bezugsobjekt, mit Einheit, Bemessungsgrundlage und zeitlicher Gültigkeit.**

| Attribute | Business meaning | Presence |
|---|---|---|
| Bemessung-ID | Stable identification of the measurement; revisions remain traceable. | Core |
| Bemessungsart | What is quantified, for example Geschossfläche, Nutzfläche, Gebäudevolumen or amtliche Grundstücksfläche. | Core |
| Wert | Numeric quantity. Unknown is distinct from zero. | Core for a usable measurement |
| Einheit | Unit consistent with the measurement kind, principally m² or m³ for this scope. | Core |
| Bemessungsgrundlage | Definition/rule and its version: for example an applicable SIA 416 edition, AV basis or an explicitly documented BBL rule. | Core; missing basis is a quality gap |
| Ermittlungsart | Whether the value was measured, calculated, aggregated or estimated. | Conditional: where known |
| Gültig ab | Date from which the value applies to the object. | Core for effective-date reporting; unknown dates remain unknown |
| Gültig bis | End of applicability; open-ended values need no invented end date. | Optional |

**Required relationship: exactly one Bezugsobjekt per measurement assertion.** It may be a building, parcel, floor, room or another relevant business object. An aggregate refers to the aggregate object and can additionally identify its contributing measurements. This is a proposed modelling rule, not a claim about SAP storage or IBPDI cardinalities.

**Supporting relationship: Messgrundlage/Geometriebezug.** Link the relevant geometry or document revision where needed to explain or reproduce the value. For the described BBL CAD workflow this relationship is essential. AOID, drawing filename and CAD entity handles remain implementation mappings with their actual key scope; they are not the business definition of Bemessung.

IBPDI needs three deliberate adaptations: its `AreaMeasurement.Unit` is area-only; its listed standards omit SIA 416; and `Accuracy` contains derivation categories rather than numeric accuracy. Hence the broader BBL scope, explicit rule/version and label Ermittlungsart. Its `ValidFrom` description refers to when a measurement was taken; BBL should distinguish that observation date from business validity. Add Ermittelt am later only if the process needs it; do not invent it from Gültig ab.

A separate editable Bezeichnung is unnecessary for the compact measurement profile: a readable label can be derived from kind and subject. Catalog status remains available on the definition. Operational meter readings and energy time series remain the separate business topic Betriebsmesswert.

## Shared relationships needed for BBL work

These complement the small attribute sets; they must not disappear merely to reduce the attribute count. They are business relationships, not a request to add UI features in this proposal.

| Relationship | Scope and business rule |
|---|---|
| Wirtschaftseinheit → Gebäude / Grundstück | Group membership with validity. Confirm permitted overlapping memberships before imposing a single-parent rule. |
| Gebäude ↔ Grundstück | Allow multiple associations and retain their validity. Preserve the meaning of any recorded share. A physical building and a parcel remain independently identified; GWR's selected parcel reference is not a full association list. |
| Gebäude / Grundstück → Bemessung | Retrieve typed values and distinguish official, calculated and aggregated quantities. |
| Objekt → Eigentümer / Vertragspartner | Party, role, applicable right or contract, share where relevant, and validity. Derive a simple BBL ownership/tenure display from this context. |
| Objekt / Wirtschaftseinheit → Verantwortlich | Object manager, portfolio manager or responsible organisation, with a defined role. This differs from ownership of the catalog definition. |
| Gebäude / Grundstück → Portfolio | Preserve the actual assignment. Do not assume all members inherit one portfolio from the WE without a BBL rule. |
| Gebäude → Adresse/Eingang; Grundstück → Gemeinde | Reuse identifiable location concepts with international scope. Support multiple building addresses/entrances; EGID + EDID identifies a GWR entrance. |
| Gebäude ↔ Nutzungsobjekt / Architektonisches Objekt / Geometrie | Distinguish correspondence from part-whole structure. Preserve partial mappings, their evidence, source/version and validity. Footprint and Gebäudehülle remain separate source inventories. |

The GIS inventory already contains ownership category, object responsibility and portfolio assignments. Keep those business capabilities. Its Eigentum Art needs a reviewed vocabulary: the existing business attribute combines ownership form and building rights, while IBPDI `TypeOfOwnership` only distinguishes owner and tenant. These are not interchangeable classifications.

## Decisions for the next data update

1. **Identity and extent:** review examples of a building group, a building with several entrances, a partial commercial/architectural association and an international building. Confirm physical boundaries, whether BBL numbers survive reassignment and the scope of WE numbers. Preserve EGID/EGRID where applicable; do not require GWR presence for every BBL building.
2. **Vocabulary and counting:** agree BBL Gebäudeart levels, Hauptnutzung and building/WE Bewirtschaftungsstatus meanings; reconcile ownership/tenure semantics. Review storey-counting rules and the GKLAS source version. Do not recreate previously deleted value lists as placeholders.
3. **Scope:** start Grundstück with land parcels. If other legal property types are required, extend its definition and type model explicitly; do not assume every type has parcel geometry.
4. **Mappings:** only after the business proposal is accepted, map each requirement to available data and mark it covered, partial, absent from the documented interface, or unverified. Keep API exposure and physical persistence as separate checks.

For example, **“Identify the same building across BBL, GWR and AV”** is the business requirement behind EGID. The documented building API does not include EGID; this establishes a documented-interface gap, not that SAP cannot store it or that a particular physical column must be added. Similarly, **“Retrieve the applicable area/volume value with its basis and related geometry”** leads the measurement requirement; AOID is one integration detail to verify afterwards.

This revision updates the proposed business requirements only. No catalog attributes, object definitions, reference lists, GIS datasets or relationship implementations were changed. The first SQL draft was not applied; content SQL should follow the revised scope.
