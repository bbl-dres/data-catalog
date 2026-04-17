#!/usr/bin/env python3
"""One-shot migration: add `key_role` column value to every concept_attribute INSERT row in seed-data.sql.

Uses a paren-aware parser (not regex) because some definition strings contain `)` characters
(e.g. "Type of calculation (gross floor area, etc.)").
"""
import re
from pathlib import Path

# Classification by uuid-cattr-NNN id. Any id not listed → NULL.
KEY_ROLES = {
    # PKs
    'uuid-cattr-001': 'PK',  # Areal-ID
    'uuid-cattr-006': 'PK',  # Kampus-ID
    'uuid-cattr-010': 'PK',  # Grundbuch-Nr
    'uuid-cattr-015': 'PK',  # EGID
    'uuid-cattr-020': 'PK',  # NE-Nummer
    'uuid-cattr-024': 'PK',  # Geschoss-Nr
    'uuid-cattr-028': 'PK',  # Raum-Nr
    'uuid-cattr-036': 'PK',  # MO-Nummer
    'uuid-cattr-040': 'PK',  # Vertrags-Nr
    'uuid-cattr-049': 'PK',  # HZ-Nummer
    'uuid-cattr-053': 'PK',  # Zähler-Nr
    'uuid-cattr-069': 'PK',  # UID
    'uuid-cattr-073': 'PK',  # WE-Nummer
    'uuid-cattr-077': 'PK',  # Buchungskreis-Nr
    # FKs (references another concept or a code list)
    'uuid-cattr-017': 'FK',  # Gebäudekategorie → codelist
    'uuid-cattr-019': 'FK',  # Energieträger → codelist
    'uuid-cattr-021': 'FK',  # Nutzungsart → codelist
    'uuid-cattr-045': 'FK',  # Konditionsart → codelist
    'uuid-cattr-050': 'FK',  # Heizzentrale Typ → codelist
    'uuid-cattr-061': 'FK',  # Zähler-Referenz → Stromzähler
    'uuid-cattr-075': 'FK',  # Buchungskreis → Buchungskreis concept
    # UKs (alternate unique keys)
    'uuid-cattr-011': 'UK',  # EGRID (alongside Grundbuch-Nr as PK)
    'uuid-cattr-062': 'UK',  # AHV-Nr (optional but unique when present)
}

seed_path = Path(__file__).parent / 'seed-data.sql'
text = seed_path.read_text(encoding='utf-8')

# 1) Update the INSERT column list (once)
OLD_COLS = "INSERT INTO concept_attribute (id, concept_id, name_en, name_de, name_fr, name_it, definition, value_type, code_list_id, required, standard_ref, sort_order) VALUES"
NEW_COLS = "INSERT INTO concept_attribute (id, concept_id, name_en, name_de, name_fr, name_it, definition, value_type, code_list_id, required, standard_ref, sort_order, key_role) VALUES"
assert text.count(OLD_COLS) == 1, f"Expected exactly one INSERT; found {text.count(OLD_COLS)}"
idx = text.index(OLD_COLS) + len(OLD_COLS)
text = text[:text.index(OLD_COLS)] + NEW_COLS + text[idx:]

# 2) Parse tuples one at a time, paren-aware and string-aware.
start_pos = text.index(NEW_COLS) + len(NEW_COLS)
out = [text[:start_pos]]
last_emitted = start_pos  # position in source text we've consumed through
i = start_pos
cattr_id_re = re.compile(r"'uuid-cattr-(\d{3})'")
count = 0
while True:
    # Skip whitespace, commas, SQL line comments
    while i < len(text):
        c = text[i]
        if c in ' \t\r\n,':
            i += 1
        elif text.startswith('--', i):
            nl = text.find('\n', i)
            i = nl + 1 if nl != -1 else len(text)
        else:
            break
    if i >= len(text) or text[i] == ';':
        out.append(text[last_emitted:])
        break
    if text[i] != '(':
        out.append(text[last_emitted:])
        break
    tuple_start = i
    depth = 0
    in_str = False
    j = i
    while j < len(text):
        c = text[j]
        if in_str:
            if c == "'":
                if j + 1 < len(text) and text[j+1] == "'":
                    j += 2  # escaped quote
                    continue
                in_str = False
        else:
            if c == "'":
                in_str = True
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    break
        j += 1
    if depth != 0:
        raise RuntimeError(f"Unbalanced parens starting at offset {tuple_start}")
    tuple_body = text[tuple_start:j]
    m = cattr_id_re.search(tuple_body)
    if not m:
        raise RuntimeError(f"No uuid-cattr-NNN found in tuple: {tuple_body[:80]}...")
    attr_id = f"uuid-cattr-{m.group(1)}"
    role = KEY_ROLES.get(attr_id)
    val = f"'{role}'" if role else "NULL"
    # Emit verbatim gap from last_emitted to tuple_start, then the mutated tuple.
    out.append(text[last_emitted:tuple_start])
    out.append(tuple_body)
    out.append(f", {val}")
    out.append(')')
    last_emitted = j + 1
    i = j + 1
    count += 1

assert count == 80, f"Expected 80 concept_attribute rows; parsed {count}"

seed_path.write_text(''.join(out), encoding='utf-8')
print(f"Updated {count} rows in {seed_path}")
print(f"  PK:   {sum(1 for v in KEY_ROLES.values() if v == 'PK')}")
print(f"  FK:   {sum(1 for v in KEY_ROLES.values() if v == 'FK')}")
print(f"  UK:   {sum(1 for v in KEY_ROLES.values() if v == 'UK')}")
print(f"  NULL: {80 - len(KEY_ROLES)}")
