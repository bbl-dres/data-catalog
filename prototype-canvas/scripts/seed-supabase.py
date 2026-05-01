#!/usr/bin/env python3
"""
Generate a seed SQL file from data/canvas.json (v2) for the v0.3 Supabase
schema (docs/DATAMODEL.sql).

Output: migrations/001_seed_v0_3.sql

Usage: python scripts/seed-supabase.py

The output is meant to be pasted into the Supabase SQL Editor (which runs
as superuser and bypasses RLS) or executed via psql against the project DB.
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "canvas.json"
OUT_DIR = ROOT / "migrations"
OUT = OUT_DIR / "001_seed_v0_3.sql"

# Known BBL system mappings (slug + technology stack), matching DATAMODEL.md §6.3
SYSTEM_MAP = {
    "SAP RE-FX": ("sys:refx", "SAP S/4HANA"),
    "BBL GIS":   ("sys:bbl_gis", "ArcGIS Online"),
    "BFS GWR":   ("sys:gwr", "PostgreSQL (BFS)"),
    "AV GIS":    ("sys:av_gis", "ArcGIS / kantonale Geodaten"),
    "Grundbuch": ("sys:grundbuch", "kantonale Grundbuchsysteme"),
}


def slug_safe(s: str) -> str:
    """Restrict to slug-allowed chars: A-Za-z0-9_.-"""
    return re.sub(r"[^A-Za-z0-9_.\-]", "_", s).strip("_") or "x"


def sql_str(s) -> str:
    """Render a Python value as a SQL literal. None → NULL; strings get '' escape."""
    if s is None or s == "":
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def sql_array(items) -> str:
    if not items:
        return "ARRAY[]::text[]"
    return "ARRAY[" + ",".join(sql_str(x) for x in items) + "]"


def main():
    with SRC.open(encoding="utf-8") as f:
        canvas = json.load(f)

    OUT_DIR.mkdir(exist_ok=True)

    out = []
    p = out.append

    p("-- =============================================================================")
    p(f"-- BBL Architektur-Canvas — seed data from canvas.json v{canvas.get('version','?')}")
    p(f"-- Generated:    {datetime.now().isoformat(timespec='seconds')}")
    p("-- Target schema: docs/DATAMODEL.sql v0.3")
    p("--")
    p("-- Apply via Supabase SQL Editor (runs as superuser, bypasses RLS) or psql.")
    p("-- Wraps the whole seed in a transaction so partial loads roll back.")
    p("-- =============================================================================")
    p("")
    p("BEGIN;")
    p("")

    # -----------------------------------------------------------------------
    # 1. Systems
    # -----------------------------------------------------------------------
    p("-- ---------- 1. Systems (kind=system) ----------")
    systems = sorted({n.get("system", "") for n in canvas["nodes"] if n.get("system")})
    sys_slug_map = {}

    for sys_name in systems:
        slug, tech_stack = SYSTEM_MAP.get(sys_name, (f"sys:{slug_safe(sys_name).lower()}", None))
        sys_slug_map[sys_name] = slug
        p(f"INSERT INTO node (slug, kind, label_de, lifecycle_status) "
          f"VALUES ({sql_str(slug)}, 'system', {sql_str(sys_name)}, 'produktiv');")
        p(f"INSERT INTO system_meta (node_id, technology_stack) "
          f"SELECT id, {sql_str(tech_stack)} FROM node WHERE slug = {sql_str(slug)};")
    p("")

    # -----------------------------------------------------------------------
    # 2. Psets (Datenpakete)
    # -----------------------------------------------------------------------
    p("-- ---------- 2. Psets (Datenpakete, kind=pset) ----------")
    pset_slug_map = {}
    for pset in canvas.get("sets", []):
        slug = f"pset:{pset['id']}"
        pset_slug_map[pset["id"]] = slug
        label = pset.get("label", pset["id"])
        desc = pset.get("description")
        lineage = pset.get("lineage")
        if lineage and desc:
            full_desc = f"{desc}\n\nLineage: {lineage}"
        elif lineage:
            full_desc = f"Lineage: {lineage}"
        else:
            full_desc = desc
        p(f"INSERT INTO node (slug, kind, label_de, description_de, lifecycle_status) "
          f"VALUES ({sql_str(slug)}, 'pset', {sql_str(label)}, {sql_str(full_desc)}, 'produktiv');")
    p("")

    # -----------------------------------------------------------------------
    # 3. Distributions
    # -----------------------------------------------------------------------
    p("-- ---------- 3. Distributions (kind=distribution) ----------")
    dist_slug_map = {}
    for n in canvas["nodes"]:
        if n["type"] not in ("table", "view", "api", "file"):
            continue
        slug = f"dist:{n['id']}"
        dist_slug_map[n["id"]] = slug

        cols = ["slug", "kind", "label_de", "lifecycle_status"]
        vals = [sql_str(slug), "'distribution'", sql_str(n.get("label", n["id"])), "'produktiv'"]

        tags = n.get("tags") or []
        if tags:
            cols.append("tags"); vals.append(sql_array(tags))
        if n.get("x") is not None and n.get("y") is not None:
            cols.extend(["x", "y"])
            vals.extend([f"{float(n['x']):.2f}", f"{float(n['y']):.2f}"])

        p(f"INSERT INTO node ({', '.join(cols)}) VALUES ({', '.join(vals)});")
        p(f"INSERT INTO distribution_meta (node_id, technical_name, type, schema_name) "
          f"SELECT id, {sql_str(n['id'])}, {sql_str(n['type'])}, {sql_str(n.get('schema'))} "
          f"FROM node WHERE slug = {sql_str(slug)};")

        sys_slug = sys_slug_map.get(n.get("system"))
        if sys_slug:
            p(f"INSERT INTO edge (from_node_id, to_node_id, edge_type) "
              f"SELECT s.id, d.id, 'publishes' "
              f"FROM node s, node d "
              f"WHERE s.slug = {sql_str(sys_slug)} AND d.slug = {sql_str(slug)};")
    p("")

    # -----------------------------------------------------------------------
    # 4. Code lists
    # -----------------------------------------------------------------------
    p("-- ---------- 4. Code Lists (kind=code_list) ----------")
    cl_slug_map = {}
    for n in canvas["nodes"]:
        if n["type"] != "codelist":
            continue
        slug = f"cl:{n['id']}"
        cl_slug_map[n["id"]] = slug

        cols = ["slug", "kind", "label_de", "lifecycle_status"]
        vals = [sql_str(slug), "'code_list'", sql_str(n.get("label", n["id"])), "'produktiv'"]

        tags = n.get("tags") or []
        if tags:
            cols.append("tags"); vals.append(sql_array(tags))
        if n.get("x") is not None and n.get("y") is not None:
            cols.extend(["x", "y"])
            vals.extend([f"{float(n['x']):.2f}", f"{float(n['y']):.2f}"])

        p(f"INSERT INTO node ({', '.join(cols)}) VALUES ({', '.join(vals)});")

        sys_slug = sys_slug_map.get(n.get("system"))
        if sys_slug:
            p(f"INSERT INTO edge (from_node_id, to_node_id, edge_type) "
              f"SELECT s.id, c.id, 'publishes' "
              f"FROM node s, node c "
              f"WHERE s.slug = {sql_str(sys_slug)} AND c.slug = {sql_str(slug)};")
    p("")

    # -----------------------------------------------------------------------
    # 5. Code list entries
    # -----------------------------------------------------------------------
    p("-- ---------- 5. Code list entries ----------")
    entry_count = 0
    for n in canvas["nodes"]:
        if n["type"] != "codelist":
            continue
        cl_slug = cl_slug_map[n["id"]]
        for col in n.get("columns", []):
            code = col.get("name")
            label = col.get("type") or code
            if code is None:
                continue
            p(f"INSERT INTO code_list_entry (code_list_node_id, code, label_de) "
              f"SELECT id, {sql_str(code)}, {sql_str(label)} "
              f"FROM node WHERE slug = {sql_str(cl_slug)};")
            entry_count += 1
    p("")

    # -----------------------------------------------------------------------
    # 6. Attributes (+ contains + in_pset edges)
    # -----------------------------------------------------------------------
    p("-- ---------- 6. Attributes (kind=attribute) + contains/in_pset edges ----------")
    attr_count = 0
    in_pset_edges = 0
    for n in canvas["nodes"]:
        if n["type"] not in ("table", "view", "api", "file"):
            continue
        dist_slug = dist_slug_map[n["id"]]

        seen_slugs = set()  # dedupe within distribution if column repeats
        for idx, col in enumerate(n.get("columns", [])):
            col_name = col.get("name")
            if not col_name:
                continue
            ss = col.get("sourceStructure") or "_"
            path = f"{n['id']}.{ss}.{col_name}"
            attr_slug = f"attr:{slug_safe(path)}"
            if attr_slug in seen_slugs:
                # extremely rare — same name+substructure repeats. Add idx suffix.
                attr_slug = f"{attr_slug}.{idx}"
            seen_slugs.add(attr_slug)

            key_role = col.get("key") or None
            if key_role and key_role not in ("PK", "FK", "UK"):
                key_role = None

            p(f"INSERT INTO node (slug, kind, label_de, lifecycle_status) "
              f"VALUES ({sql_str(attr_slug)}, 'attribute', {sql_str(col_name)}, 'produktiv');")
            p(f"INSERT INTO attribute_meta "
              f"(node_id, technical_name, data_type, key_role, source_structure, sort_order) "
              f"SELECT id, {sql_str(col_name)}, {sql_str(col.get('type'))}, "
              f"{sql_str(key_role)}, {sql_str(col.get('sourceStructure'))}, {idx} "
              f"FROM node WHERE slug = {sql_str(attr_slug)};")
            p(f"INSERT INTO edge (from_node_id, to_node_id, edge_type) "
              f"SELECT d.id, a.id, 'contains' "
              f"FROM node d, node a "
              f"WHERE d.slug = {sql_str(dist_slug)} AND a.slug = {sql_str(attr_slug)};")

            set_id = col.get("setId")
            if set_id and set_id in pset_slug_map:
                pset_slug = pset_slug_map[set_id]
                p(f"INSERT INTO edge (from_node_id, to_node_id, edge_type) "
                  f"SELECT a.id, p.id, 'in_pset' "
                  f"FROM node a, node p "
                  f"WHERE a.slug = {sql_str(attr_slug)} AND p.slug = {sql_str(pset_slug)};")
                in_pset_edges += 1

            attr_count += 1
    p("")

    # -----------------------------------------------------------------------
    # 7. Edges from canvas.edges[] — diagram-level relationships
    # -----------------------------------------------------------------------
    p("-- ---------- 7. Edges from canvas.edges[] (defaulted to flows_into) ----------")
    edge_count = 0
    skipped_edges = 0
    for edge in canvas.get("edges", []):
        from_id = edge.get("from")
        to_id = edge.get("to")
        from_slug = dist_slug_map.get(from_id) or cl_slug_map.get(from_id)
        to_slug = dist_slug_map.get(to_id) or cl_slug_map.get(to_id)

        if not from_slug or not to_slug:
            p(f"-- SKIP edge {edge.get('id')!r}: unresolved {from_id!r} -> {to_id!r}")
            skipped_edges += 1
            continue

        cols = ["from_node_id", "to_node_id", "edge_type"]
        vals = ["f.id", "t.id", "'flows_into'"]
        if edge.get("label"):
            cols.append("label_de"); vals.append(sql_str(edge["label"]))

        p(f"INSERT INTO edge ({', '.join(cols)}) "
          f"SELECT {', '.join(vals)} "
          f"FROM node f, node t "
          f"WHERE f.slug = {sql_str(from_slug)} AND t.slug = {sql_str(to_slug)};")
        edge_count += 1
    p("")

    p("COMMIT;")
    p("")
    p("-- End of seed")

    OUT.write_text("\n".join(out), encoding="utf-8")

    print(f"Wrote {OUT}")
    print(f"  Systems              : {len(systems)}")
    print(f"  Psets                : {len(canvas.get('sets', []))}")
    print(f"  Distributions        : {len(dist_slug_map)}")
    print(f"  Code lists           : {len(cl_slug_map)}")
    print(f"  Code list entries    : {entry_count}")
    print(f"  Attributes           : {attr_count}")
    print(f"  in_pset edges        : {in_pset_edges}")
    print(f"  Diagram edges        : {edge_count} ({skipped_edges} skipped)")
    print(f"  Output file size     : {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
