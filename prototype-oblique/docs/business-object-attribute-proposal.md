# Compact business-object attribute proposal

Review date: 5 September 2026. **Proposal for business review; `objects.json` has not been changed.**

Recommend **7 attributes for Gebäude, 7 for Grundstück, 6 for Wirtschaftseinheit and 8 for Bemessung**. Related objects, responsibilities and portfolio assignments belong in explicit relationships. The scope is identification, property management, register matching and reliable area/volume information for BBL.

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
| [Reviewed SAP definitions and scope](imports/sap-refx-catalog-scope.md) | Economic grouping; distinction between object identity, measurement and geometry | Wirtschaftseinheit should not be defined as a Profit Center. The current measurement field sample is not a verified full inventory. |
| [AV model review](imports/av-import.md) | Official parcel identity and geometry semantics | Complements IBPDI where Swiss parcel requirements are more specific. |

The current business model has three material gaps: Gebäude identity depends entirely on EGID; Wirtschaftseinheit is defined through SAP and Profit Center; Bemessung has neither a value nor a unit or measurement type. Address these in the business model before preparing system changes.

## Reading the proposal

**Core** means needed for the intended business use. **Conditional** means needed when applicable, with missing values recorded as a completeness issue. **Optional** means useful but not a gate for that use. These are proposed business completeness rules, not database constraints. Existing unknown values must remain unknown.

Each object needs stable identity. An existing BBL number may satisfy that requirement if its scope, uniqueness and stability are confirmed. The GIS workbook describes `bbl_id` as a combination of company code, WE and subobject; in the footprint group it can contain several concatenated IDs. It is therefore not yet a proven permanent identifier for one physical building. Preserve operational numbers as references if they change when an object is reassigned; do not require a new identifier format in the conceptual model.

German names below are proposed business labels. Descriptions are newly written BBL working definitions, not official quotations. The existing catalog's definition, Kommentar, data owner, catalog status and edit timestamps remain catalog metadata. **Gebäudestatus and Bewirtschaftungsstatus describe real objects; Entwurf describes review of the catalog definition.**

## Gebäude — 7 attributes

Proposed working definition: **Ein dauerhaftes, überdachtes Bauwerk, das für die Bewirtschaftung als eigenständiges physisches Objekt betrachtet wird.** Its existence does not depend on being represented in a particular register or application.

| Attribute | Business meaning | Presence |
|---|---|---|
| Gebäude-ID | Stable identification of the building across its lifecycle and changes in management assignment. | Core |
| Bezeichnung | Readable building name or short designation. | Core |
| EGID | Official GWR identifier used to reconcile the building with register and geospatial information. | Conditional: where assigned/applicable |
| Gebäudestatus | Physical lifecycle, such as planned, existing or demolished; distinct from acquisition, sale and catalog review. | Core |
| Hauptnutzung | Predominant use of the building, sufficient for the first portfolio overview. Detailed mixed use belongs to its spaces/use units. | Conditional: where determined |
| Baujahr | Year of completion, with year precision. A planned completion date would be a separate fact. | Conditional: completed building, where known |
| Gebäudekategorie (GWR) | The register's classification, retained separately from BBL use classifications. | Conditional: applicable GWR record |

Use the available GWR reference data for GWR concepts. Review the BBL use classification before mapping `bbl_gbda1`/`bbl_gbda2` or adopting IBPDI's commercial-property enumeration. No new value list is proposed here.

**Essential relationships:** Grundstück, Wirtschaftseinheit, address/entrance, Bemessungen and building footprint. Responsibility and ownership/tenure are covered by the shared relationship profile below. A building can relate to several parcels; do not represent that relationship as one mandatory EGRID field. A footprint of Bodenabdeckung type Gebäude describes geometry and remains distinct from the building master object.

**Defer from this compact profile:** heating fuel, renovation events, condition assessments, heritage details and facility equipment. These are meaningful topics, but need their own scope and temporal semantics. The existing Energieträger attribute should be reviewed with the energy model rather than carried forward as one universally applicable building value.

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
| Gebäude ↔ Grundstück | Allow multiple associations and retain their validity. A physical building and a parcel remain independently identified. |
| Gebäude / Grundstück → Bemessung | Retrieve typed values and distinguish official, calculated and aggregated quantities. |
| Objekt → Eigentümer / Vertragspartner | Party, role, applicable right or contract, share where relevant, and validity. Derive a simple BBL ownership/tenure display from this context. |
| Objekt / Wirtschaftseinheit → Verantwortlich | Object manager, portfolio manager or responsible organisation, with a defined role. This differs from ownership of the catalog definition. |
| Gebäude / Grundstück → Portfolio | Preserve the actual assignment. Do not assume all members inherit one portfolio from the WE without a BBL rule. |
| Gebäude → Adresse; Grundstück → Gemeinde | Reuse identifiable location concepts. Support multiple building addresses/entrances when needed. |

The GIS inventory already contains ownership category, object responsibility and portfolio assignments. Keep those business capabilities. Its Eigentum Art needs a reviewed vocabulary: the existing business attribute combines ownership form and building rights, while IBPDI `TypeOfOwnership` only distinguishes owner and tenant. These are not interchangeable classifications.

## Decisions for the next data update

1. **Identity:** confirm whether BBL object numbers survive reassignment, and establish the scope of WE numbers. Preserve EGID/EGRID as official identifiers where applicable. Do not require GWR presence for every BBL building.
2. **Vocabulary:** agree the compact BBL Hauptnutzung and Bewirtschaftungsstatus meanings; reconcile ownership/tenure semantics. Do not recreate previously deleted value lists as placeholders.
3. **Scope:** start Grundstück with land parcels. If other legal property types are required, extend its definition and type model explicitly; do not assume every type has parcel geometry.
4. **Mappings:** only after the business proposal is accepted, map each requirement to available data and mark it covered, partial, absent from the documented interface, or unverified. Keep API exposure and physical persistence as separate checks.

For example, **“Identify the same building across BBL, GWR and AV”** is the business requirement behind EGID. The documented building API does not include EGID; this establishes a documented-interface gap, not that SAP cannot store it or that a particular physical column must be added. Similarly, **“Retrieve the applicable area/volume value with its basis and related geometry”** leads the measurement requirement; AOID is one integration detail to verify afterwards.

No catalog attributes, object definitions, reference lists or relationship implementations were changed as part of this proposal.
