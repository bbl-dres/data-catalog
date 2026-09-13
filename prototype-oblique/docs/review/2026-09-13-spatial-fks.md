# Spatial hierarchy and FK attributes — completed, 13 September 2026

Added only missing attribute definitions with the existing **FK** label. The user explicitly requested no structured reference targets and no model expansion. **Areal remains separate and optional.** No target column, new relationship type, operational table or frontend behavior was deployed.

## Applied content

| Geschäftsobjekt | Added FK attributes |
|---|---|
| Gebäude | Grundstück-IDs |
| Areal | Grundstück-IDs |
| Kampus | Gebäude-IDs |
| Nutzungseinheit | Gebäude-ID; Raum-IDs |
| Zone | Raum-IDs |
| Parkplatz | Geschoss-ID; Grundstück-IDs |
| Bodenbedeckung | Grundstück-IDs |
| Bauteil | Gebäude-ID; Geschoss-ID |
| Technische Anlage | Versorgte Gebäude-IDs |
| Technische Komponente | Technische Anlage-IDs; Gebäude-ID; Raum-ID |
| Wohnung | Gebäude-ID; Raum-IDs |
| CAFM Basisplan | Geschoss-ID |
| Heizzentrale | Versorgte Gebäude-IDs; Gebäude-ID; Raum-ID |
| Stromzähler | Gebäude-ID; Raum-ID |

All 23 additions are draft definitions, placed at ranks 200–220 after identity. Collections use the existing structured value type with the format “Liste vollständiger IDs”; this is a catalog description, not comma-separated operational storage. The only new comment is the existing display marker Schlüsselrolle: FK. The 38 active business objects retain one effective PK named ID at rank 100.

## Review decisions

| Area | Outcome |
|---|---|
| Gebäude → Geschoss → Raum | Existing Geschoss.Gebäude-ID and Raum.Geschoss-ID are correct and unchanged. One primary parent at each level; a multi-storey space retains one primary storey. |
| Grundstück / Gebäude | Added Grundstück-IDs alongside the existing EGRID register reference. Multiple parcel assignments are allowed; a cadastral parcel is not forced to be a single IFC site or a mandatory unique spatial parent. |
| Areal / Kampus | Optional geographic/functional groupings. No Areal-ID was added to Gebäude and neither grouping is required above a building. |
| Nutzungseinheit / Wohnung | Building reference plus room membership. May span storeys without replacing each room's primary Geschoss reference. |
| Zone | Room membership can overlap. No single Zone-ID was added to Raum; Nettofläche stays the selected minimum. The catalog's geometry can be a derived room union; independent IFC shape would require considering IfcSpatialZone. |
| Parkplatz / Bodenbedeckung | Interior parking has a storey reference; external parking and land cover have parcel references. No invented storey for an outdoor object. |
| Bauteil / technical equipment | Separate primary physical location from system membership or buildings served. Use a specific room/storey when available and derive ancestors; broader building references are fallbacks. Cross-level references do not establish multiple primary containers. |
| CAFM-Basisplan | References the described storey; the document is not a spatial parent. |
| Baurecht / Dienstbarkeit | Legal concepts, not IFC spatial containers. No artificial containment attributes added. Legal-right reference completeness was not assessed by this IFC review. |
| Bemessung / Betriebsmesswert | Observations, not spatial hierarchy levels. Bemessung retains its seven target-type definition links; operating-time-series subject completeness is outside this hierarchy pass. |
| Mietobjekt, finance, partners, projects and document concepts | Commercial, administrative or information structures, not additional mandatory physical hierarchy levels. Existing definitions remain unchanged. |

The primary-source review used [IFC4 IfcSpace](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifcproductextension/lexical/ifcspace.htm), [IfcSite](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifcproductextension/lexical/ifcsite.htm), [IfcZone](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifcproductextension/lexical/ifczone.htm), [spatial containment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifcproductextension/lexical/ifcrelcontainedinspatialstructure.htm) and [spatial references](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifcproductextension/lexical/ifcrelreferencedinspatialstructure.htm). These distinguish composition, containment and grouping. The BBL choices above are a simpler local profile, not a claim of complete IFC/ISO 16739 conformance.

[SBB's object catalog](https://fdk.app.sbb.ch/de/objects), release 17.0.0 dated 1 July 2026, lists Gebäude, Geschoss, Raum, Grundstück and Zone under Hochbau / Struktur. Its [Geschoss profile](https://fdk.app.sbb.ch/de/objects/OBJ_HB_002) was inspected in the browser and maps to IfcBuildingStorey. Its organization-specific identifiers and large property sets were not copied.

## Verification and limits

Both the measurement and FK batches ran rollback previews, checked the unchanged catalog hash, then committed exactly the verified commands. Independent readbacks checked every retained row, every requested field and every audit event. Across both batches: 42 commands/events, 30 new business attributes, two code values and two measuredFor links. Final snapshot: 42 business objects (38 active), 277 business attributes, 95 code lists, 2,120 code values, 121 relationships and 1,188 history events.

The real frontend projection verifies all 23 new FK labels, all seven quantity definitions/units, ID ordering, existing spatial FKs and no broken references. Localhost shows Raum's three quantities and Zone's Raum-IDs/FK plus Nettofläche, with ID first and Status last. The schema remains **19 tables / 477 columns**; all catalog tables have RLS, public snapshot reads work, anon cannot execute write RPCs and API roles have no direct writes. No auth/signup settings changed. Evidence: [manifests, rollback/readback and projection checks](2026-09-13-measurements-spatial/).

No operational building, room, parcel or measurement instances were imported or validated. FK labels describe references; operational referential integrity, membership dates, spatial containment, outdoor-equipment locations and IFC import/export conformance are not enforced by this catalog. Source inventories and prior uncommitted repository work are preserved. No commit or push.

Repository checks passed: canonical EN/DE alias check, generated API contract (84 read/write operations), and git diff --check. The generated Swagger change only refreshes the canonical document hash relative to the pre-task working version.

Later user-requested simplification: Technische Anlage now has Gebäude-ID; Heizzentrale retains one Gebäude-ID and its separate supplied-buildings definition is archived. See [the applied follow-up](2026-09-13-simple-attributes.md). The batch history above records the original additions.
