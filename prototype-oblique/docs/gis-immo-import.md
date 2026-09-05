# GIS IMMO workbook import — 2026-09-05

## Source and scope

Source: owner-supplied `BBL GIS IMMO - Modellbeschreibung - Kopie.xlsx`, sheet **Attribute**, Excel table `Table2` (`A1:L276`). The 275 non-empty data rows describe seven model groups. The workbook's internal modification timestamp is **2025-03-02 10:28:54**; this is file metadata, not a verified deployment date or model version. Import capture date is **2026-09-05**.

SHA-256: `0b66440714c1ffa8dea48c034231304a16df8e1913c05733b70ae0cf54751197`.

The current prototype's five GIS sample entries did not represent the supplied inventory. Their original records, fields and history are archived in [gis-immo-import-report.json](gis-immo-import-report.json). Four names map directly to existing entries, and the owner's explicit classification determines Bodenabdeckung. Existing table IDs and product links remain valid. Raum and Grünfläche are added. Business-object definitions, SAP/GWR records, code lists, products and API claims are not rewritten.

| Workbook group | Catalog entry | Stable ID | Fields | Source status |
|---|---|---|---:|---|
| BBL Gebäude | Gebäude | `t-geb-gis` | 74 | 72 LIVE, 2 DEV |
| BBL Gebäude (AO) | Bodenabdeckung → type Gebäude | `t-boden` | 46 | 18 LIVE, 28 DEV |
| BBL Grundstück | Grundstück | `t-parzelle` | 42 | 41 LIVE, 1 DEV |
| BBL Gebäudehülle (AO) | Gebäudehülle (AO) | `t-huelle` | 30 | 30 DEV |
| BBL Raum | Raum | `t-gis-room` | 32 | 32 DEV |
| BBL Bauprojekt | Bauprojekt | `t-proj` | 27 | 27 DEV |
| BBL Grünfläche | Grünfläche | `t-gis-green-area` | 24 | 23 DEV, 1 unspecified |

Total: **275 field rows — 131 LIVE, 143 DEV, one unspecified**. All catalog records remain **Entwurf** under the existing policy. Field profiles show the source's LIVE/DEV value separately as **Status in Quelle**. Missing source status stays unspecified.

## Bodenabdeckung and geometry

The owner clarified that the source group `BBL Gebäude (AO)` is the **Gebäude** type of **Bodenabdeckung**, representing **Gebäudegrundfläche as a polygon**. The existing `t-boden` entry is retained, with `realizes: "bodenbedeckung"` referring to the existing business-object ID. The business object's own definition/name remains unchanged.

`objectTypes` records the type name Gebäude, its Polygon geometry, its original source class, and its 46 field IDs. Every field has `appliesToObjectTypes: ["Gebäude"]`, visible in field Kerndaten and retained in Excel. These fields are not asserted to apply to all possible Bodenabdeckung types. The owner supplied the polygon classification; the workbook does not specify a physical geometry column, geometry storage, coordinate reference system or table name. No separate Gebäude (AO) table is created and no additional types are inferred from the other groups.

The workbook explicitly describes `ao_id` as an architecture-object identifier used with geometry from external databases, and `ao_src` as its geometry source. Raum names **BBL SAP Korasoft** as the origin of these fields. This supports the earlier AOID discussion, but does not establish an exact join to SAP VIBDMEAS, uniqueness, cardinality or drawing/version rules. Those remain separate verification questions. The Grünfläche group additionally documents `ao_type` and `ao_area`.

## Mapping rules

- `Merkmal DB` becomes `technicalName`, preserving exact case and spelling.
- German and available English aliases become `labels.de` and `labels.en`. Missing translations are omitted; the existing German fallback applies.
- `Beschreibung DE` is copied unchanged; 69 missing descriptions remain empty. Table descriptions are concise summaries of field groups, identified as such in comments, because the workbook provides no entity definitions.
- `Format` is retained verbatim as `dataType`, with `dataTypeKind: "model-type"`. String, Double, Integer, Boolean and Date are not converted into invented SQL declarations.
- `Status` becomes `sourceStatus` on fields, independently of the catalog lifecycle status.
- `Herkunft` becomes the field's `source` when present and is also retained in `catalogMetadata.origin`. The original group, source row/ID and formula values remain in metadata and the import report.
- Table `fieldScope: "model-inventory"` and field `technicalNameKind: "model-attribute"` identify documented model entries, not a live database-schema inspection.

The workbook provides **no physical table IDs**. The previous sample names BUILDING, BUILDING_ENVELOPE, PARCEL, LAND_COVER and CONSTRUCTION_PROJECT are therefore archived and omitted from the updated display. Technical field IDs are available and shown as **Alias (technical name)**. No primary/foreign keys, nullability, required flags, column lengths, code-list bindings, geometry columns or API-to-field mappings are inferred. Existing business-object associations are catalog mappings, not physical foreign-key declarations.

Existing governance contacts and classification remain catalog metadata; they are not certified by this workbook. The invented sample version and unsupported `personalData: false` statements are omitted from refreshed source records. Existing comments and curated information URLs are preserved on repeat imports. A local workbook path is not manufactured into an official web documentation link.

## Source issues retained for review

| Finding | Evidence | Treatment |
|---|---|---|
| Duplicate `bbl_hist` | Building rows 42 and 43, source IDs 41 and 42: historical equipment versus archival value | Preserve both rows with explicit catalog IDs `bbl_hist-source-41` and `bbl_hist-source-42`; do not invent a corrected technical name. Both field profiles contain review comments. |
| DB Len is not storage length | All 275 values use `=LEN(Table2[[#This Row],[Merkmal DB]])` | Preserve formula/cached value as source evidence only. Never use this value as VARCHAR length. |
| BUF/UUF naming mismatch | Rows 149–150 pair processed BUF with `larea_uuf`, and unprocessed UUF with `larea_buf` | Preserve names, aliases and descriptions; add review comments. |
| AGRID label versus EGRID field | Rows 79 and 167 label `av_egrid` as AV AGRID | Preserve both source values and flag the label for review. |
| Missing source IDs | All 24 Grünfläche rows | Keep `sourceId: null`; use the technical field name for catalog identity. |
| Missing source status | Row 260, Grünfläche `bbl_port` | Leave status unknown and add a comment. |
| Incomplete descriptions/translations/origins | 69 descriptions, 31 English aliases and four origins absent | Preserve gaps without invented values. |
| Counterintuitive formats | WGS84 coordinates and some heating-update dates are String | Retain the reported format; do not silently normalize by the field's apparent meaning. |

No field rows are dropped. The two duplicate technical names remain independently navigable and exportable. The original ID and worksheet row are distinct from any database primary key. Existing sample field bookmarks are not silently remapped by semantic similarity to new source columns; table bookmarks remain stable.

## Reproduction

```powershell
python prototype-oblique/docs/import-gis-immo.py `
  --workbook 'C:\Users\david\Downloads\BBL GIS IMMO - Modellbeschreibung - Kopie.xlsx' `
  --captured 2026-09-05
```

Requires `openpyxl`. The importer validates the source sheet, headers, required values, formula meaning, application/status vocabulary, group mapping and unique catalog identities before writing. An unexpected group or conflicting catalog table causes a review error. It updates `tables.json`, `systems.json`, `changelog.json` and the generated report. Original sample history is archived; subsequent import events and unrelated history are retained. Repeating the same import yields byte-identical outputs.

The report stores source rows using English property names, the original header mapping, file hash, source timestamp, completeness findings and the archived sample records. Author names and unrelated workbook properties are not imported as stewardship assertions.

## Verification

Core checks compare every imported row with its source, including aliases, formats, descriptions, source status, duplicate identities and Bodenabdeckung type scope. Browser checks cover navigation, 74-field pagination/search, both `bbl_hist` details, typed AO fields, complete 275-field Excel export and layouts at 1600, 768, 390 and 320 pixels. Repeated imports and table/field/system schemas are also checked. The mock-search test now validates sources against the selected result scope instead of assuming a specific GWR record always ranks first as catalog content grows.
