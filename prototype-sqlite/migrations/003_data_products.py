"""
One-shot migration: replace the two placeholder data_product rows in
catalog.db with 11 richer entries sourced from
prototype-main/data/datasets.json.

Also replaces all distribution rows and rebuilds data_product_dataset,
data_product_contact, and data_product_classification joins.

Source dataset -> data_product mapping (where a source exists in our
catalog; empty source is OK for external systems like CDE Bund / DALA):

  1 Gebäude (SAP)                     -> uuid-ds-001 (VIBDBU)
  2 Grundstücke (SAP)                 -> (none – VIBDGR not modelled yet)
  3 Bauprojekte (SAP Projektcontr.)   -> (none – external)
  4 Mietverträge (SAP RE-FX)          -> uuid-ds-003 (VIBDMV)
  5 Geb.-technische Anlagen (SAP PM)  -> (none – external)
  6 Projektdaten Bauprojekte (CDE)    -> (none – CDE Bund not modelled)
  7 Geodaten Bauprojekte (GIS IMMO)   -> uuid-ds-010 (CONSTRUCTION_PROJECT)
  8 Geodaten Bodenabdeckung (GIS IMMO)-> uuid-ds-008 (LAND_COVER)
  9 Bauwerksdokumentation (DALA)      -> (none – external)
 10 Geodaten Grundstücke (GIS IMMO)   -> uuid-ds-007 (PARCEL)
 11 Geodaten Gebäude (GIS IMMO)       -> uuid-ds-006 (BUILDING)

Frequency keys in the source JSON use short codes (monthly, quarterly,
weekly, on_change). We store them as-is (the UI already handles the EU
frequency URI fallback for legacy rows).

Classification mapping: public→uuid-class-001, internal→uuid-class-002,
confidential→uuid-class-003.
"""

import json
import re
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "data" / "catalog.db"
SRC = Path(r"C:/Users/DavidRasner/Documents/GitHub/data-catalog/prototype-main/data/datasets.json")


# -- dataset.id (from datasets.json) -> source dataset UUID in catalog.db
DS_TO_CATALOG_DATASETS = {
    "1":  ["uuid-ds-001"],
    "2":  [],
    "3":  [],
    "4":  ["uuid-ds-003"],
    "5":  [],
    "6":  [],
    "7":  ["uuid-ds-010"],
    "8":  ["uuid-ds-008"],
    "9":  [],
    "10": ["uuid-ds-007"],
    "11": ["uuid-ds-006"],
}


CLASS_MAP = {
    "public":       "uuid-class-001",
    "internal":     "uuid-class-002",
    "confidential": "uuid-class-003",
    "secret":       "uuid-class-004",
}


# German month name -> ISO number. Source uses "10. Mai 2025" style.
DE_MONTHS = {
    "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4,
    "mai": 5, "juni": 6, "juli": 7, "august": 8, "september": 9,
    "oktober": 10, "november": 11, "dezember": 12,
}


def parse_de_date(s):
    if not s:
        return None
    m = re.match(r"\s*(\d{1,2})\.\s*([A-Za-zäöü]+)\s*(\d{4})", s)
    if not m:
        return None
    day, month_name, year = m.groups()
    month = DE_MONTHS.get(month_name.lower())
    if not month:
        return None
    return f"{year}-{month:02d}-{int(day):02d}"


def infer_access_type(fileformat):
    f = (fileformat or "").upper()
    if f in {"JSON", "GEOJSON", "XML"}:
        return "rest_api"
    if f == "PDF":
        return "report"
    return "file_export"


def infer_media_type(fileformat):
    f = (fileformat or "").upper()
    return {
        "JSON":    "application/json",
        "GEOJSON": "application/geo+json",
        "XML":     "application/xml",
        "CSV":     "text/csv",
        "XLSX":    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "PDF":     "application/pdf",
        "ZIP":     "application/zip",
    }.get(f, "application/octet-stream")


def pick(d, key):
    """Return a 4-locale dict from a node that is either a str or {de,fr,it,en}."""
    v = d.get(key)
    if isinstance(v, dict):
        return v
    return {"de": v or "", "fr": v or "", "it": v or "", "en": v or ""}


def build_description_json(dataset):
    short = pick(dataset, "description")
    long_ = pick(dataset, "fullDescription")
    out = {}
    for lc in ("de", "fr", "it", "en"):
        short_text = (short.get(lc) or "").strip()
        long_text  = (long_.get(lc) or "").strip()
        if long_text:
            out[lc] = long_text
        elif short_text:
            out[lc] = short_text
        else:
            out[lc] = ""
    return json.dumps(out, ensure_ascii=False)


def main():
    with open(SRC, encoding="utf-8") as fh:
        source = json.load(fh)

    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys = ON")
    cur = con.cursor()

    # --- 1. Wipe out existing data_product-related rows ---------------
    cur.execute("DELETE FROM data_product_dataset")
    cur.execute("DELETE FROM data_product_contact")
    cur.execute("DELETE FROM data_product_classification")
    cur.execute("DELETE FROM data_product_policy")
    cur.execute("DELETE FROM distribution")
    # relationship_edge rows referencing old dp-001/002
    cur.execute("DELETE FROM relationship_edge WHERE source_id LIKE 'uuid-dp-%' OR target_id LIKE 'uuid-dp-%'")
    cur.execute("DELETE FROM data_product")

    # --- 2. Insert the 11 new data products ---------------------------
    for d in source:
        src_id = d["id"]
        dp_id = f"uuid-dp-{int(src_id):03d}"
        title = d.get("title") or {}
        meta = d.get("meta") or {}
        theme = meta.get("thema") or {}
        theme_str = theme.get("de") if isinstance(theme, dict) else theme
        freq = meta.get("aktualisierungsintervall") or ""
        issued = parse_de_date(meta.get("ausgabedatum"))
        status = meta.get("status") or ""
        certified = 1 if status == "published" else 0
        tags = ", ".join(d.get("tags") or [])

        cur.execute(
            """
            INSERT INTO data_product
            (id, name_en, name_de, name_fr, name_it, description, publisher,
             license, theme, keyword, spatial_coverage, temporal_start,
             temporal_end, update_frequency, certified, issued, modified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            """,
            (
                dp_id,
                title.get("en"),
                title.get("de"),
                title.get("fr"),
                title.get("it"),
                build_description_json(d),
                "BBL – DRES",             # publisher (placeholder; rp lookup is below)
                None,                       # license lives on distribution level
                theme_str,
                tags,
                "CH",                       # default spatial coverage
                None,
                None,
                freq,
                certified,
                issued,
            ),
        )

        # --- 3. Distributions ----------------------------------------
        for di, dist in enumerate(d.get("distributions") or [], start=1):
            dist_id = f"uuid-dist-{int(src_id):03d}-{di:02d}"
            dname = dist.get("name") or {}
            if isinstance(dname, str):
                dname = {"de": dname, "en": dname, "fr": dname, "it": dname}
            fileformat = dist.get("dateiformat") or dist.get("format") or ""
            access_type = infer_access_type(fileformat)
            # bemerkungen may be either string or a {de,fr,it,en} dict;
            # store multilingual blobs as JSON, plain strings as-is.
            bem = dist.get("bemerkungen")
            if isinstance(bem, dict):
                description_val = json.dumps(bem, ensure_ascii=False)
            else:
                description_val = bem or None
            cur.execute(
                """
                INSERT INTO distribution
                (id, data_product_id, name_en, name_de, name_fr, name_it,
                 access_url, download_url, media_type, access_type, format,
                 byte_size, conformsTo, description, availability)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'available')
                """,
                (
                    dist_id, dp_id,
                    dname.get("en"), dname.get("de"), dname.get("fr"), dname.get("it"),
                    dist.get("zugriffsUrl") or None,
                    dist.get("downloadUrl") or None,
                    infer_media_type(fileformat),
                    access_type,
                    fileformat,
                    description_val,
                ),
            )

        # --- 4. data_product_dataset links ---------------------------
        for src_ds_id in DS_TO_CATALOG_DATASETS.get(src_id, []):
            cur.execute(
                "INSERT OR REPLACE INTO data_product_dataset (data_product_id, dataset_id) "
                "VALUES (?, ?)", (dp_id, src_ds_id),
            )

        # --- 5. Classification join ----------------------------------
        cls_id = CLASS_MAP.get(meta.get("klassifizierung") or "internal",
                               "uuid-class-002")
        cur.execute(
            "INSERT OR REPLACE INTO data_product_classification "
            "(data_product_id, classification_id) VALUES (?, ?)",
            (dp_id, cls_id),
        )

        # --- 6. Contact links ----------------------------------------
        # Source admindirIds don't resolve to our catalog's contact UUIDs,
        # so we synthesize plausible assignments. Every data product gets
        # a Data Owner and a Data Steward; stewards rotate between the two
        # available stewards (contact-002, contact-003) so the UI doesn't
        # show the same person on every detail page. Publisher is pinned
        # to the single data_custodian contact for simplicity.
        stewards = ["uuid-contact-002", "uuid-contact-003"]
        steward = stewards[(int(src_id) - 1) % len(stewards)]
        default_contacts = [
            ("uuid-contact-001", "data_owner"),
            (steward,            "data_steward"),
            ("uuid-contact-005", "publisher"),
        ]
        for contact_id, role_key in default_contacts:
            cur.execute(
                "INSERT OR REPLACE INTO data_product_contact "
                "(data_product_id, contact_id, role) VALUES (?, ?, ?)",
                (dp_id, contact_id, role_key),
            )

        # --- 7. Relationship edges (data product -> source datasets) --
        for src_ds_id in DS_TO_CATALOG_DATASETS.get(src_id, []):
            cur.execute(
                """
                INSERT OR REPLACE INTO relationship_edge
                (source_id, source_type, target_id, target_type, rel_type,
                 weight, derived_from, refreshed_at)
                VALUES (?, 'data_product', ?, 'dataset', 'derived_from', 1.0,
                        'data_product_dataset',
                        strftime('%Y-%m-%dT%H:%M:%fZ','now'))
                """,
                (dp_id, src_ds_id),
            )

    con.commit()

    # ---------------------------- summary ----------------------------
    print("== data_product rows ==")
    for r in cur.execute(
        "SELECT id, name_de, update_frequency, certified, issued FROM data_product ORDER BY id"
    ):
        n_dist = cur.execute(
            "SELECT COUNT(*) FROM distribution WHERE data_product_id=?", (r[0],)
        ).fetchone()[0]
        n_src = cur.execute(
            "SELECT COUNT(*) FROM data_product_dataset WHERE data_product_id=?", (r[0],)
        ).fetchone()[0]
        print(f"  {r[0]:14} {r[1][:48]:48} freq={r[2] or '':10} cert={r[3]}  dist={n_dist} sources={n_src}")
    con.close()


if __name__ == "__main__":
    main()
