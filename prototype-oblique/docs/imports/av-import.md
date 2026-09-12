# Amtliche Vermessung: reviewed catalog import

Reviewed on 5 September 2026. Scope: **Bodenabdeckung / Bodenbedeckung and Liegenschaften**, their essential identifiers, update records and enumerations. The catalog contains metadata, not parcel records. Existing business-object definitions and GIS IMMO records are unchanged.

## Model and service boundaries

The official model spells the topic **Bodenbedeckung**. The catalog keeps the user's preferred display term **Bodenabdeckung** and preserves the exact technical topic/class names. A building footprint is represented by `BoFlaeche.Art = Gebaeude`; it does not turn the AV class into a complete building master record. The optional EGID belongs to the related `Gebaeudenummer` class. These distinctions come from the [official LV95 INTERLIS model](https://models.geo.admin.ch/V_D/DM.01-AV-CH_LV95_24d_ili1.ili).

DM.01 is the AV exchange model, including geometry. [eCH-0153 / eGRISDM](https://www.ech.ch/de/ech/ech-0153/1.0) describes the conceptual structure of the **electronic land register**. Its specification is public; access to actual register data is a separate issue. No ownership, encumbrance or register records were imported, and eGRISDM is not treated as a polygon service.

The selected authoritative source is `DM01AVCH24LV95D`, version 24, INTERLIS 1, LV95, model date 2004-06-04. The model bytes match the checksum in the official repository index. This old model date is distinct from today's catalog capture and from any canton’s data currency. Swisstopo says DM.01 will be replaced by DMAV by **31 December 2027**; a DMAV import should be versioned separately. See [model documentation](https://www.cadastre-manual.admin.ch/de/modelldokumentation-dm01-av-ch).

## Imported inventory

One source-system entry, **Amtliche Vermessung (AV)**, represents the distributed cantonal inventory. It is not described as a central BBL application. Responsibility stays with the cantonal AV bodies; federal oversight and model authority are identified separately as swisstopo. All new catalog entries use **Entwurf**, consistent with the existing non-GWR policy.

| Display name | Exact technical name | Fields | Scope |
|---|---|---:|---|
| Bodenabdeckung – DM.01 | `Bodenbedeckung.BoFlaeche` | 4 | Model class |
| Gebäudenummer – DM.01 | `Bodenbedeckung.Gebaeudenummer` | 3 | Model class |
| Nachführung Bodenabdeckung – DM.01 | `Bodenbedeckung.BBNachfuehrung` | 7 | Model class |
| Grundstück – DM.01 | `Liegenschaften.Grundstueck` | 8 | Model class |
| Liegenschaft – DM.01 | `Liegenschaften.Liegenschaft` | 4 | Model class |
| Nachführung Liegenschaften – DM.01 | `Liegenschaften.LSNachfuehrung` | 9 | Model class |
| Bodenabdeckung – geodienste.ch | `LCSF` | 6 | WFS service projection |
| Liegenschaften – geodienste.ch | `RESF` | 8 | WFS service projection |

Total: **8 entries, 49 fields**. Technical model and service names are documented identifiers, not claims about physical database tables. Descriptions and readable field aliases are catalog summaries; full source declarations are preserved. Unknown descriptions remain empty. The schema remains authoritative for exact type names, capitalization and optionality.

The model's `IDENT` constraints are retained without labeling them physical primary keys. `Liegenschaft_von` and other model references are preserved as model references, not invented database foreign keys. `Geometrie.LINEATTR.Linienart` stays nested inside geometry metadata; it is not flattened into a fictitious polygon column.

Only current area, identity and necessary update classes are imported. Projected classes, text placement/symbol classes, survey points, and the separate rights/mine geometries are excluded from this focused inventory; the report lists every omitted class in the two topics. No other AV topics are imported. The complete Grundstücksart enumeration still includes rights and mines because that is its actual source domain.

## Value lists

| Source enumeration | Values | Meaning |
|---|---:|---|
| `Bodenbedeckung.BBArt` | 26 | Leaf values, preserving the full hierarchy |
| `Qualitaetsstandard` | 5 | AV93, PV74, PN, PEP, weitere |
| `Status` | 2 | Update status: projektiert, gueltig |
| `Liegenschaften.Grundstuecksart` | 6 | Property types, including nested independent rights |
| `Grundstueck.Gueltigkeit` | 2 | rechtskraeftig, streitig |
| `Grundstueck.Vollstaendigkeit` | 2 | Vollstaendig, unvollstaendig |
| `Liegenschaft.Geometrie.Linienart` | 2 | streitig, unvollstaendig |

Total: **7 lists, 45 values**, extracted from the [INTERLIS model](https://models.geo.admin.ch/V_D/DM.01-AV-CH_LV95_24d_ili1.ili). Codes are symbolic paths, for example `humusiert.Intensivkultur.Reben`. Group headings are not extra selectable leaf codes. `sourceOrdinal` records source order only; it is not presented as a numeric business code. Some `weitere` categories are extension placeholders in the source, not evidence that such values occur in current data.

Model fields link to their exact value lists. Service fields with similar names deliberately have no asserted code-list link: the WFS schema gives strings, without enumerating their wire values. Service-to-model code mapping needs a verified service dictionary or representative data. An empty `codeList` is shown as “—”.

## Verified services and layer names

The [geodienste.ch specifications](https://geodienste.ch/services/av/info) publish separate WMS, WFS and OGC API Features interfaces. The catalog now has three entries for these interfaces and two GeoAdmin entries for REST and map display.

| Interface | Verified identifier / endpoint | Result and use |
|---|---|---|
| geodienste.ch WMS | `https://geodienste.ch/db/av_0/deu`, layers `LCSF`, `RESF` | Capabilities retrieved; GetMap is raster display |
| geodienste.ch WFS | Same service base, feature types `ms:LCSF`, `ms:RESF` | WFS 2.0 capabilities and WFS 1.1 DescribeFeatureType captured; GetFeature data delivery not tested |
| geodienste.ch OGC API Features | `https://geodienste.ch/db/av_0/deu/ogcapi` | Collection metadata retrieved; bounded item requests returned **403** in this environment |
| GeoAdmin REST | `ch.swisstopo-vd.amtliche-vermessung` | One GetFeatures request returned Polygon with EGRID properties |
| GeoAdmin REST | `ch.kantone.cadastralwebmap-farbe` | One GetFeatures request returned Polygon with EGRID properties |
| GeoAdmin WMS / WMTS | `https://wms.geo.admin.ch/`, CadastralWebMap layer above | Map service documented; no claim of polygon extraction from raster |

`RESFPROJ` and `LCSFPROJ` are the **projected** geodienste.ch collections. They must not be silently mixed with `RESF` / `LCSF`. Collection metadata advertises storage CRS **EPSG:2056** and also other output CRSs. The WFS XSD uses `gml:GeometryPropertyType`, which does not independently certify Polygon-only storage. The REST polygon checks used explicit `sr=2056`, `geometryFormat=geojson`, `returnGeometry=true`. Requests, response hashes and outcomes are in [service-checks.json](../sources/av/service-checks.json); parcel geometries were not saved.

The two successful REST samples establish that polygon delivery works for those features. They do **not** prove nationwide coverage, absence of simplification, original survey precision or current legal validity. The 403 responses likewise do not establish that geodienste.ch is unavailable to the user's configured clients. Access and cantonal terms remain to be checked in that environment.

## Recommended parcel retrieval strategy

1. Use WMS/WMTS as the map background. For geometry, use a documented vector endpoint or a dated vector download. geodienste.ch offers GeoPackage and INTERLIS alongside its services; [availability and terms vary by canton](https://geodienste.ch/downloads/av).
2. Retain **EGRID** as the cross-system property identifier when supplied. In DM.01 it is optional; the model's declared property identity is `(NBIdent, Nummer)`. Parcel number alone is insufficient. A service feature ID must remain separate from EGRID.
3. Fetch the actual geometry, not the search result's bounding box or location coordinate. GeoAdmin [SearchServer](https://docs.geo.admin.ch/access-data/search.html) locates parcels; [GetFeatures](https://docs.geo.admin.ch/access-data/get-features.html) retrieves a selected feature. Do not assume a search ID is a usable feature ID in every layer.
4. Request and record the CRS explicitly. LV95/EPSG:2056 is the appropriate native frame documented here. A GeoAdmin GeoJSON-shaped response requested in LV95 uses projected coordinates; it must not be interpreted as ordinary WGS84 longitude/latitude GeoJSON. Follow each protocol's CRS/axis rules. For CadastralWebMap display, swisstopo [recommends LV95 or LV03](https://docs.geo.admin.ch/visualize-data/wmts.html).
5. Preserve all parts, rings and holes. DM.01 permits several Liegenschaft parts per Grundstück and curved segments. Keep the declared `Flaechenmass`; any area calculated from a converted polygon is a separate derived value. Check whether the chosen endpoint clips or simplifies geometry before relying on it for parcel measurements.
6. Keep legal validity, completeness and currency separate. `Vollstaendigkeit` can signal a property crossing the delivered perimeter. Use the canton's metadata/update history to assess suitability; a catalog import date does not establish parcel currency.
7. For bulk processing, prefer a dated canton/package snapshot. WFS advertises paging but **PagingIsTransactionSafe=FALSE**. GeoAdmin [Identify](https://docs.geo.admin.ch/access-data/identify-features.html) is bounded (documented limit up to 200 per request) and is not a whole-country export. Do not silently stop after the first page or combine changing pages as a certified snapshot.

This is an integration strategy, not a new requirement added to the Geschäftsobjekt or a completed live data pipeline.

## Reproduction and checks

[sources/sources.json](../sources/av/sources.json) records the source URLs, capture date and derived extracts. [av-import-report.json](../sources/av/av-import-report.json) records SHA-256 hashes, scope and counts. Import requires Python's standard library only:

```powershell
python prototype-oblique/scripts/import-av.py --captured 2026-09-05
```

The import is offline, deterministic for the same capture and sources, preserves local comments/documentation links, and refuses to overwrite an unrelated record with a colliding ID. It does not regenerate GWR, SAP, GIS IMMO or business-object data. Source updates require a fresh source review. `check-av-services.py` can repeat the small read-only service checks; it stores only result summaries.

Core tests verify source hashes, class/field scope, nested geometry metadata, enumeration paths, optional EGRID, separate service types and safe missing-value rendering. Browser checks cover AV navigation, local field search, reference-data links, mobile overflow and complete Excel metadata. Existing GIS and field-profile checks cover the changed empty-fact behavior across other systems.
