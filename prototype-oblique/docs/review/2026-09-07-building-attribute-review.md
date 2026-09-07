# Building attribute review — GIS IMMO, RE-FX and GWR

Review date: 7 September 2026. This supports the revised [business-object proposal](../business-object-attribute-proposal.md). It changes proposed requirements, not catalog records. Wirtschaftseinheit and Bemessung retain their previous profiles. **Gebäudehülle (AO) remains in scope.**

**Subsequent owner clarification:** the worldwide portfolio uses a SAP-based **Building ID as its business PK**, with EGID as an optional GWR reference. The current proposal adds seven separate address components and WGS84 latitude/longitude, giving **23 building attributes**. The 14-attribute recommendation below records the preceding source review; the prepared SQL follows the updated owner requirements.

## Evidence used

| Source | Reviewed material and limits |
|---|---|
| GIS IMMO | The preserved [workbook rows](../sources/gis-immo/gis-immo-import-report.json): Gebäude 74 fields, Bodenabdeckung type Gebäude 46, Gebäudehülle (AO) 30, Grundstück 42. These are the supplied model inventory, including LIVE/DEV declarations; they do not certify a deployed schema or current record contents. |
| BBL RE-FX | The preserved [building API inventory](../sources/sap-refx/sap-refx-import-report.json): 66 `BUILDING` fields within 25 response structures and 377 fields overall. Response structures describe separate contexts, not 25 database tables. Documented fields establish interface evidence; actual BBL population, meanings and physical mappings remain to be verified. |
| SAP product documentation | [Building](https://help.sap.com/docs/SAP_ERP/d91b9ba4593d4466bfc484ac34ab743d/495bd0531d8b4208e10000000a174cb4.html?locale=de-DE) and [master-data views](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/3683a11901b74d8fa71f35d86abaaae1/e35ad0531d8b4208e10000000a174cb4.html?locale=de-DE&state=PRODUCTION&version=2023.latest), checked through official indexed content. Generic product behavior does not establish BBL's configuration. |
| GWR | The imported **5.0.0 revised** catalog, with detailed field descriptions preserved in [tables.json](../../data/tables.json) under `catalogMetadata`, and its [import record](../imports/gwr-import.md). Public [5.0 catalog content](https://www.housing-stat.ch/catalog/index.html?final=true&lang=de&version=5.0) was also checked through indexed results; the dynamic page itself exposes little text to the reader. This is not a new release/compatibility verification. |
| GWR/AV building boundaries | BFS/swisstopo [building capture guidance, version 1.1 (2021)](https://www.housing-stat.ch/files/1754-2100.pdf), especially printed pp. 4, 22, 27–29 and 32–37. |

## Building identity and extent

The sources describe different objects under similar names. SAP's usage view provides fixed commercial master-object types, while the architectural view can be configured to describe spatial structure. Its building can support rental activity, accounting and links to architectural objects. This supports keeping the physical building definition independent of commercial organization. [SAP master-data views](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/3683a11901b74d8fa71f35d86abaaae1/e35ad0531d8b4208e10000000a174cb4.html?locale=de-DE&state=PRODUCTION&version=2023.latest), [SAP building](https://help.sap.com/docs/SAP_ERP/d91b9ba4593d4466bfc484ac34ab743d/495bd0531d8b4208e10000000a174cb4.html?locale=de-DE).

GIS building row 3 defines `bbl_id` using company code, WE and subobject; row 6 places the subobject number within the WE. The footprint's row 76 explicitly allows several BBL IDs concatenated into one value. This proves that a geometry record can refer to several operational IDs; it does **not** prove the precise building/geometry cardinality or that the IDs describe the same physical extent. The [owner's footprint classification](../imports/gis-immo-import.md#bodenabdeckung-and-geometry) remains authoritative for this inventory.

RE-FX strengthens that distinction: `ARCH_REL` carries architectural object type/ID, validity and `IS_PARTIAL`; `ARCH_RELMS` adds partial/full measurement quantities and units. These are documented support for partial, dated associations. Do not collapse a building, a usage object, an architectural object, a room and a geometry revision into a single identifier. The evidence is the API structure/field inventory, not the previously excluded Innovator usage classes.

The GWR/AV guidance gives different outcomes for connected buildings: its underground-parking example has several building identities, while its multilayer office-complex example has one identity and several entrances. Separation depends on building boundaries and structural criteria. Its extension examples also distinguish independent from non-independent additions. Consequently, address count, a connected outline and a BBL management number are insufficient identity tests. These examples describe the guidance's cases, not universal cardinalities for BBL. [BFS/swisstopo guidance](https://www.housing-stat.ch/files/1754-2100.pdf).

**Proposed consequence:** identify the physical building first. Keep scoped operational identifiers and reviewed mappings separately. A single EGID can appear on the profile once the physical extent matches the GWR object. Several candidate EGIDs require boundary review; concatenating them into a scalar attribute hides the unresolved scope. A managed building group needs an explicit grouping, not a silently broadened building definition.

## Attribute evidence and recommendations

Row numbers below refer to the original GIS worksheet, including its header. API references identify response structure and exact field; they are candidates for later mapping.

| Topic | GIS IMMO / RE-FX / GWR evidence | Recommendation |
|---|---|---|
| BBL building classification | GIS rows 27–28: `bbl_gbda1`, `bbl_gbda2`; API `BUILDING.BUILDING_TYPE`. The latter's equivalence to the two BBL levels is unverified. | Add **Gebäudeart (BBL)** as a hierarchical classification. Preserve its level/code context. |
| Use | API `BUILDING.MAIN_USAGE_TYPE`; extension `CUS_DATA_7GE.NUTZU` is explicitly described as multivalued name/use. GWR has both `GKAT` and `GKLAS`. | Keep **Hauptnutzung**, add **Gebäudeklasse (GWR)**, retain **Gebäudekategorie (GWR)**. Do not equate these with the BBL building classification; detailed mixed use needs dated assignments to spaces. |
| Management status | GIS `bbl_stat` (row 2); API `STATUS` includes profile, individual status, inactive flag and system-status flag. | Add a business-level **Bewirtschaftungsstatus (Gebäude)**. Its agreed display must be distinguished from the raw, potentially multiple SAP statuses. No approved BBL vocabulary is present in the reviewed inventory. |
| Physical lifecycle | GWR `GSTAT` distinguishes planning, approval, construction, existing, unusable, demolished and unrealized. | Keep physical status separate from management, ownership, technical record activity and catalog approval. A renovation does not by itself turn an existing building into a new building under construction. |
| Age and demolition | GIS `bbl_bjahr` versus `bbl_vjahr` (rows 21–22); API has construction, modernization, reconstruction, completion, sale and use-end dates; GWR `GBAUJ`, `GBAUM`, `GBAUP`, `GABBJ`. | Add **Bauperiode** when only a period is known and **Abbruchjahr**. Sale/use-end is not demolition; modernization is a dated event, not a replacement construction year. Preserve known date precision. |
| Storeys | GIS `gastw`, `gastw_og`, `gastw_ug` (rows 68–70); API `FLOORS`, `BASEMENTS`; GWR `GASTW`. | Add separate above-/below-ground counts with a documented counting rule. Do not copy one source's total into another source's count. |
| Location | GIS address components, country and coordinates; API `OBJECT_ADDRESS`; GWR separates building and entrance coordinates and has `EDID`. | Treat location/entrances as a required part of the building profile, even though they are related values rather than extra scalar building attributes. A reference point does not establish footprint geometry. |
| Condition and protection | API `BUILDING_CONDITION`, `HAS_HIST_SITE_PROTECTION`; GIS `kgs_kat`, `kgs_nr`, and the two conflicting `bbl_hist` names. | Keep these in explicit assessment/protection records with scope, source and date. A KGS inventory classification does not automatically establish the same assertion as a monument-protection flag. |
| Strategy, tenure and finance | GIS `bbl_ostr`, `bbl_mietm`, `bbl_eigen`, portfolio, owner roles and monetary values; API `PARTNER`, `TERM_ORG_ASSIGNMENT`, dated `CUS_DATA_0MM.MIMOD`. | Preserve these capabilities in a dated management context. A currency amount needs value kind and effective date; an ownership category needs reviewed legal/role semantics. |

The imported GWR description of `GASTW` includes selected roof/basement levels according to use/heating and excludes cellar levels. It is therefore not a reliable synonym for either GIS total storeys or above-ground storeys. The [official 2022 catalog, GASTW, p. 67](https://www.housing-stat.ch/files/881-2200.pdf) corroborates this counting distinction. The exact GIS/SAP counting rules remain unknown.

The existing GKLAS value list was imported from the supplied **4.2** workbook. Its compatibility with the saved 5.0 catalog has not been confirmed. Adding the business requirement must retain that limitation; it does not approve a new binding to that list. See [GWR import source choices](../imports/gwr-import.md#content).

## Grundstück and building/parcel relationships

The seven parcel attributes remain a reasonable starting set. Three qualifications are needed:

1. **International scope:** GIS includes country/international region and describes EGRID/EGID as Swiss references. International parcels need the applicable register's identifier and numbering context. Do not require an EGRID for a foreign parcel or convert its identifier into one.
2. **Geometry:** the GIS parcel coordinate description is a point within the polygon (rows 138–139). Neither that point nor `ao_id` supplies the actual legal boundary, reference system, version or completeness. `av_stat` has no description here, so it cannot be certified as **Rechtsstand**.
3. **Relationship completeness:** the saved GWR `GEGRID` description selects a parcel under specified rules where a building occupies several parcels; it can also refer to a building right. It is not an exhaustive parcel association list or proof that the referenced property is a land polygon. The public catalog gives the same selection context. [GWR catalog, GEGRID](https://www.housing-stat.ch/catalog/index.html?final=true&lang=de&version=5.0).

The BBL API's `CUS_DATA_BU2` records building/parcel identifiers, an applicable-from date, a percentage (`PGEBANT`) and an end flag. This makes building/parcel associations with validity and a defined share a concrete investigation priority. The percentage's denominator/meaning is not established by its label; do not treat it as ownership share or geometry overlap without review. No API occurrence proves complete coverage of all parcels.

## Scope of the revised proposal

Recommend **14 building attributes**, including a hierarchical BBL classification, together with the related location, structure, management, measurement and assessment information. This is a proposed business profile, not a demand for 14 physical columns or a fully specified edit schema.

Keep the **7 parcel attributes**, refining their scope and relationships. Keep **6 Wirtschaftseinheit** and **8 Bemessung** attributes unchanged. Gebäudehülle (AO) remains an independent source inventory; repeated area/volume fields there do not establish equivalence to the building or footprint.

The [prepared content update](../../supabase/updates/20260907-business-object-profiles.sql) records the revised definitions as drafts while retaining unresolved boundaries, vocabularies and mapping questions. Settle these before approving definitions or implementation mappings. The earlier seven-attribute SQL draft was not applied. No source fixtures or hosted catalog records were changed while preparing or locally testing the revision.
