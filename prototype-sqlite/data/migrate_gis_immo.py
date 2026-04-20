"""
One-shot migration: update tables and fields of the GIS IMMO system
(uuid-sys-002) in catalog.db to reflect the real data model published
in property-inventory/docs/DATAMODEL.json.

- Consolidates into a single schema (BBL_GIS_IMMO) and drops the obsolete
  ENERGY schema.
- Rewires uuid-ds-006 (Building), uuid-ds-007 (Parcel), and repurposes
  uuid-ds-008 (was ENERGY_METER) as LAND_COVER.
- Adds two new DEV datasets: BUILDING_ENVELOPE and CONSTRUCTION_PROJECT.
- Replaces every field under those datasets.
- Cleans up stale concept_mappings / lineage_link / relationship_edge
  entries pointing to removed fields or datasets and recreates mappings
  where the Building / Land Parcel concepts still apply.
"""

import json
import sqlite3
from pathlib import Path

DB = Path(__file__).with_name("catalog.db")
MODEL = Path(r"C:/Users/DavidRasner/Documents/GitHub/property-inventory/docs/DATAMODEL.json")

SYSTEM_ID = "uuid-sys-002"
SCHEMA_ID = "uuid-schema-003"   # rename this one; drop uuid-schema-005
OBSOLETE_SCHEMA_ID = "uuid-schema-005"

# Map DATAMODEL.json entity id -> existing-or-new dataset id + dataset_type
ENTITY_DATASETS = {
    "building":             ("uuid-ds-006", "gis_layer"),
    "parcel":               ("uuid-ds-007", "gis_layer"),
    "land_cover":           ("uuid-ds-008", "gis_layer"),
    "building_envelope":    ("uuid-ds-009", "gis_layer"),
    "construction_project": ("uuid-ds-010", "gis_layer"),
}


FORMAT_TO_SQL = {
    "String":  "VARCHAR(100)",
    "Integer": "INTEGER",
    "Double":  "DECIMAL(18,3)",
    "Date":    "TIMESTAMP",
    "Boolean": "BOOLEAN",
    "Array":   "TEXT",
}


def sql_type_for(attr):
    fmt = (attr.get("format") or "").strip()
    base = FORMAT_TO_SQL.get(fmt, "VARCHAR(100)")
    # Tighter widths for known identifiers
    name = attr["field"]
    if base == "VARCHAR(100)":
        if name in {"av_egrid"}:
            return "VARCHAR(14)"
        if name in {"adr_land"}:
            return "VARCHAR(2)"
        if name in {"kgs_kat", "bbl_hist", "bbl_arch", "garea_acu", "gvol_acu",
                    "gastw_acu", "larea_acu"}:
            return "VARCHAR(20)"
        if name.startswith("bbl_") or name.startswith("adr_") or name.startswith("av_") \
                or name.startswith("bfs_") or name.startswith("fid"):
            return "VARCHAR(50)"
    return base


def field_id(dataset_id, attr):
    # Stable deterministic id: uuid-fld-<ds-suffix>-<sort>
    ds_suffix = dataset_id.split("-")[-1]
    return f"uuid-fld-{ds_suffix}-{attr['sort']:03d}"


def build_field_row(dataset_id, attr):
    key = (attr.get("key") or "").strip().upper()
    is_pk = 1 if key == "PK" else 0
    is_fk = 1 if key == "FK" else 0
    # Nullable: PKs are NOT NULL, everything else nullable
    nullable = 0 if is_pk else 1
    description = {
        "de": attr.get("description_de") or "",
        "en": attr.get("description_en") or "",
        "group": attr.get("group") or "",
        "source": attr.get("source") or "",
        "status": attr.get("status") or "",
        "value_list": attr.get("value_list") or "",
    }
    display_name = attr.get("alias_de") or attr.get("field")
    return {
        "id": field_id(dataset_id, attr),
        "dataset_id": dataset_id,
        "name": attr["field"],
        "display_name": display_name,
        "data_type": sql_type_for(attr),
        "description": json.dumps(description, ensure_ascii=False),
        "nullable": nullable,
        "is_primary_key": is_pk,
        "is_foreign_key": is_fk,
        "references_field_id": None,
        "sample_values": None,
        "sort_order": attr["sort"],
    }


def dataset_description(entity):
    n_live = sum(1 for a in entity["attributes"] if a.get("status") == "LIVE")
    n_dev  = sum(1 for a in entity["attributes"] if a.get("status") == "DEV")
    parts = [f"{n_live} LIVE Felder"]
    if n_dev:
        parts.append(f"{n_dev} DEV Felder")
    field_count = " / ".join(parts)
    de = (f"GIS-IMMO Feature-Layer '{entity['name_de']}' "
          f"({entity['geometry']}, Status {entity['status']}). {field_count}.")
    en = (f"GIS IMMO feature layer '{entity['name_en']}' "
          f"({entity['geometry']}, status {entity['status']}). {field_count}.")
    return json.dumps({"de": de, "en": en}, ensure_ascii=False)


def dataset_display_name(entity):
    return entity["name_de"]


def main():
    with open(MODEL, encoding="utf-8") as fh:
        model = json.load(fh)
    entities = {e["id"]: e for e in model["entities"]}
    for eid in ENTITY_DATASETS:
        if eid not in entities:
            raise RuntimeError(f"Expected entity '{eid}' missing from DATAMODEL.json")

    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys = ON")
    cur = con.cursor()

    ds_ids = [ds for ds, _ in ENTITY_DATASETS.values()]
    placeholders = ",".join("?" for _ in ds_ids)

    # --- 1. Drop concept_mappings tied to existing fields in these datasets
    cur.execute(
        f"DELETE FROM concept_mapping WHERE field_id IN ("
        f" SELECT id FROM field WHERE dataset_id IN ({placeholders}))",
        ds_ids,
    )

    # --- 2. Drop all fields belonging to these datasets (fresh insert)
    cur.execute(
        f"DELETE FROM field WHERE dataset_id IN ({placeholders})",
        ds_ids,
    )

    # --- 3. Update system description
    system_desc = {
        "de": ("Geoinformationssystem fuer die Bundesimmobilien (BBL GIS IMMO). "
               "Enthaelt die flaechen- und punktbezogenen Feature-Layer Gebaeude, "
               "Grundstueck, Bodenabdeckung sowie in Entwicklung Gebaeudehuelle und Bauprojekt."),
        "en": ("Geographic information system for federal real estate (BBL GIS IMMO). "
               "Provides the feature layers Building, Parcel, and Land Cover; "
               "Building Envelope and Construction Project are in development."),
    }
    cur.execute(
        "UPDATE system SET description=? WHERE id=?",
        (json.dumps(system_desc, ensure_ascii=False), SYSTEM_ID),
    )

    # --- 4. Consolidate schema (rename SPATIAL -> BBL_GIS_IMMO, drop ENERGY)
    cur.execute(
        "UPDATE schema_ SET name=?, display_name=?, description=? WHERE id=?",
        (
            "BBL_GIS_IMMO",
            "BBL GIS IMMO",
            "Einheitlicher GIS-Workspace fuer Bundesimmobilien "
            "(Gebaeude, Grundstueck, Bodenabdeckung, Gebaeudehuelle, Bauprojekt).",
            SCHEMA_ID,
        ),
    )
    # Reparent any datasets still under the obsolete schema (safety net)
    cur.execute(
        "UPDATE dataset SET schema_id=? WHERE schema_id=?",
        (SCHEMA_ID, OBSOLETE_SCHEMA_ID),
    )
    cur.execute("DELETE FROM schema_ WHERE id=?", (OBSOLETE_SCHEMA_ID,))

    # --- 5. Upsert datasets
    for entity_id, (ds_id, ds_type) in ENTITY_DATASETS.items():
        entity = entities[entity_id]
        display = dataset_display_name(entity)
        desc = dataset_description(entity)
        # entity name as UPPER_SNAKE for 'name'
        name = entity_id.upper()
        exists = cur.execute("SELECT 1 FROM dataset WHERE id=?", (ds_id,)).fetchone()
        if exists:
            cur.execute(
                """
                UPDATE dataset SET
                    schema_id=?, name=?, display_name=?, dataset_type=?,
                    description=?, certified=?, modified_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
                WHERE id=?
                """,
                (SCHEMA_ID, name, display, ds_type, desc,
                 1 if entity["status"] == "LIVE" else 0, ds_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO dataset
                (id, schema_id, name, display_name, dataset_type, description,
                 certified, egid, egrid, row_count_approx, source_url, owner_id,
                 created_at, modified_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL,
                        strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                        strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                """,
                (ds_id, SCHEMA_ID, name, display, ds_type, desc,
                 1 if entity["status"] == "LIVE" else 0),
            )

    # --- 6. Insert all fields
    for entity_id, (ds_id, _) in ENTITY_DATASETS.items():
        entity = entities[entity_id]
        for attr in entity["attributes"]:
            row = build_field_row(ds_id, attr)
            cur.execute(
                """
                INSERT INTO field
                (id, dataset_id, name, display_name, data_type, description,
                 nullable, is_primary_key, is_foreign_key, references_field_id,
                 sample_values, sort_order)
                VALUES (:id, :dataset_id, :name, :display_name, :data_type,
                        :description, :nullable, :is_primary_key, :is_foreign_key,
                        :references_field_id, :sample_values, :sort_order)
                """,
                row,
            )

    # --- 7. Recreate concept_mappings for concepts that still apply
    #   uuid-concept-004 'Building' (EGID-relevant) -> BUILDING.bbl_id (PK), BUILDING.av_egid, LAND_COVER.av_egid
    #   uuid-concept-003 'Land Parcel' (EGRID-relevant) -> PARCEL.bbl_id (PK), PARCEL.av_egrid, BUILDING.av_egrid, LAND_COVER.av_egrid
    def find_field_id(dataset_id, field_name):
        row = cur.execute(
            "SELECT id FROM field WHERE dataset_id=? AND name=?",
            (dataset_id, field_name),
        ).fetchone()
        return row[0] if row else None

    mappings = [
        ("uuid-concept-004", "uuid-ds-006", "bbl_id",   "exact"),
        ("uuid-concept-004", "uuid-ds-006", "av_egid",  "exact"),
        ("uuid-concept-004", "uuid-ds-008", "av_egid",  "exact"),
        ("uuid-concept-003", "uuid-ds-007", "bbl_id",   "exact"),
        ("uuid-concept-003", "uuid-ds-007", "av_egrid", "exact"),
        ("uuid-concept-003", "uuid-ds-006", "av_egrid", "partial"),
        ("uuid-concept-003", "uuid-ds-008", "av_egrid", "exact"),
    ]
    for i, (concept_id, ds_id, field_name, match_type) in enumerate(mappings, start=1):
        fid = find_field_id(ds_id, field_name)
        if not fid:
            continue
        mapping_id = f"uuid-cmap-gis-{i:03d}"
        cur.execute(
            """
            INSERT OR REPLACE INTO concept_mapping
            (id, concept_id, field_id, match_type, transformation_note, verified,
             created_by, created_at)
            VALUES (?, ?, ?, ?, NULL, 1, 'uuid-user-002',
                    strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            """,
            (mapping_id, concept_id, fid, match_type),
        )

    # --- 8. Drop stale energy-era lineage/edges that no longer apply,
    #       then replace with a Parcel -> Land Cover lineage (survey-driven).
    cur.execute("DELETE FROM lineage_link WHERE id='uuid-lin-004'")  # was ENERGY_METER -> BUILDING
    cur.execute(
        """
        INSERT OR REPLACE INTO lineage_link
        (id, source_dataset_id, target_dataset_id, transformation_type, tool_name,
         job_name, description, frequency, recorded_at, recorded_by)
        VALUES ('uuid-lin-004', 'uuid-ds-007', 'uuid-ds-008', 'spatial_overlay',
                'ArcGIS Enterprise', 'av_landcover_overlay',
                'Land-Cover-Polygone werden ueber av_egrid/av_egid mit Parzellen und Gebaeuden verknuepft.',
                'daily', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'uuid-user-002')
        """
    )

    # Refresh relationship_edge rows: drop stale ENERGY_METER-specific edges
    cur.execute(
        """
        DELETE FROM relationship_edge
         WHERE (source_id='uuid-ds-008' AND target_id='uuid-ds-006'
                AND rel_type='lineage_downstream')
        """
    )
    cur.execute(
        """
        INSERT OR REPLACE INTO relationship_edge
        (source_id, source_type, target_id, target_type, rel_type, weight,
         derived_from, refreshed_at)
        VALUES
        ('uuid-ds-008','dataset','uuid-ds-006','dataset','sibling',1.0,'gis_immo_schema',
         strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        ('uuid-ds-008','dataset','uuid-ds-007','dataset','lineage_upstream',1.0,'gis_immo_schema',
         strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        ('uuid-ds-007','dataset','uuid-ds-008','dataset','lineage_downstream',1.0,'gis_immo_schema',
         strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        """
    )

    con.commit()

    # --- Summary ---
    print("== Datasets for GIS IMMO ==")
    for ds_id, name, disp, dtype in cur.execute(
        "SELECT id, name, display_name, dataset_type FROM dataset "
        "WHERE schema_id=? ORDER BY name", (SCHEMA_ID,)
    ):
        n = cur.execute("SELECT COUNT(*) FROM field WHERE dataset_id=?", (ds_id,)).fetchone()[0]
        print(f"  {ds_id:12s} {name:22s} {disp:30s} {dtype:10s} fields={n}")
    con.close()


if __name__ == "__main__":
    main()
