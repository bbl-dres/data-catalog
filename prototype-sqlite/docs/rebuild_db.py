#!/usr/bin/env python3
"""Rebuild prototype-sqlite/data/catalog.db from init-schema.sql + seed-data.sql."""
import sqlite3
from pathlib import Path

here = Path(__file__).parent
schema_path = here / 'init-schema.sql'
seed_path = here / 'seed-data.sql'
db_path = here.parent / 'data' / 'catalog.db'

# Safety: don't clobber if the SQL files fail to parse.
tmp_path = db_path.with_suffix('.db.tmp')
if tmp_path.exists():
    tmp_path.unlink()

conn = sqlite3.connect(str(tmp_path))
try:
    # Disable FK enforcement during bulk seed — rows can reference siblings not yet inserted
    # (same behavior the original db was built under).
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.executescript(schema_path.read_text(encoding='utf-8'))
    conn.execute("PRAGMA foreign_keys = OFF")  # schema turned it back on
    conn.executescript(seed_path.read_text(encoding='utf-8'))
    # Integrity sanity check (report but don't fail)
    conn.execute("PRAGMA foreign_keys = ON")
    violations = list(conn.execute("PRAGMA foreign_key_check"))
    if violations:
        print(f"WARNING: {len(violations)} FK violations in seed data")
        for v in violations[:5]:
            print(f"  {v}")
    conn.commit()
finally:
    conn.close()

# Atomic swap
if db_path.exists():
    db_path.unlink()
tmp_path.rename(db_path)

# Quick verify
conn = sqlite3.connect(str(db_path))
c = conn.execute("SELECT COUNT(*), SUM(CASE WHEN key_role='PK' THEN 1 ELSE 0 END), SUM(CASE WHEN key_role='FK' THEN 1 ELSE 0 END), SUM(CASE WHEN key_role='UK' THEN 1 ELSE 0 END) FROM concept_attribute").fetchone()
conn.close()
print(f"Rebuilt {db_path}")
print(f"  concept_attribute rows: {c[0]}   PK: {c[1]}   FK: {c[2]}   UK: {c[3]}")
