"""
One-shot migration: update SAP RE-FX (uuid-sys-001) in catalog.db with
real attributes from the SOAP API documentation in `D:/SAP RE-FX.txt`.

Scope (as flagged by the user): only Gebaeude, Wirtschaftseinheit,
Bemessungen. The remaining tables (VIBDAU Mietobjekt, VIBDMV
Mietvertrag, VIBDKD Kondition, VIBDBP Geschaeftspartner) are left alone
for a future update.

Changes:
  - uuid-ds-001 VIBDBE -> renamed to VIBDBU "Gebaeude" with real BUILDING
    attributes (from ZAPI_X4AI_BAPI_RE_BU_GET_DET).
  - New uuid-ds-011 VIBDBE "Wirtschaftseinheit" with BUS_ENTITY
    attributes (from ZAPI_X4AI_BAPI_RE_BE_GET_DET).
  - New uuid-ds-012 VIBDME "Bemessungen" with MEASUREMENT attributes
    (from ZAPI_X4AI_BAPI_RE_BU_MEAS_EDM).

Notes on typing:
  The BUILDING block in the source doc has shifted Typ/Laenge columns
  (visual artifact); corrected values follow the SAP RE-FX BAPI schema.
"""

import json
import sqlite3
from pathlib import Path

DB = Path(__file__).with_name("catalog.db")

SYSTEM_ID = "uuid-sys-001"   # SAP RE-FX
VIBD_SCHEMA_ID = "uuid-schema-001"

GEBAEUDE_DS_ID = "uuid-ds-001"            # existing VIBDBE -> repurposed as VIBDBU
WE_DS_ID       = "uuid-ds-011"            # new WE dataset
BEMESS_DS_ID   = "uuid-ds-012"            # new Bemessungen dataset


# SAP -> SQL type mapping
def sap_to_sql(sap_type, length):
    t = sap_type.upper()
    if t == "CHAR":   return f"VARCHAR({length})"
    if t == "NUMC":   return f"VARCHAR({length})"            # SAP NUMC is numeric string
    if t == "DATS":   return "DATE"
    if t == "TIMS":   return "TIME"
    if t == "QUAN":   return f"DECIMAL({length},3)"
    if t == "DEC":    return f"DECIMAL({length},2)"
    if t == "UNIT":   return f"VARCHAR({length})"
    if t == "CUKY":   return f"VARCHAR({length})"
    if t == "CURR":   return f"DECIMAL({length},2)"
    if t == "INT1":   return "TINYINT"
    if t == "INT4":   return "INTEGER"
    if t == "CLNT":   return f"VARCHAR({length})"
    if t == "LANG":   return "VARCHAR(1)"
    return f"VARCHAR({length})"


# ---------------------------------------------------------------- BUILDING
# Source: ZAPI_X4AI_BAPI_RE_BU_GET_DET "Attribute BUILDING" (lines 1317..).
# PK: BUILDING (composite with COMP_CODE + BUSINESS_ENTITY in SAP, but
# we flag BUILDING as PK and the rest as FK, matching other SAP-table
# entries in this catalog).
BUILDING_FIELDS = [
    ("COMP_CODE",                  "Buchungskreis",                                       "CHAR", 4,   "FK"),
    ("BUSINESS_ENTITY",            "Nummer der Wirtschaftseinheit",                       "CHAR", 8,   "FK"),
    ("BUILDING",                   "Nummer des Gebaeudes",                                "CHAR", 8,   "PK"),
    ("IDENT_OBJECT_TYPE",          "Ident-Teil Objektart, z.B. 'IS' (Immobilienvertrag)", "CHAR", 2,   ""),
    ("IDENT_KEY",                  "Ident-Teil Schluessel, z.B. '1000/123'",              "CHAR", 45,  ""),
    ("CREATION_USER",              "Erfasser",                                            "CHAR", 12,  ""),
    ("CREATION_DATE",              "Zuerst erfasst am",                                   "DATS", 8,   ""),
    ("CREATION_TIME",              "Angelegt um",                                         "TIMS", 6,   ""),
    ("LASTCHANGE_USER",            "Mitarbeiterkennung",                                  "CHAR", 12,  ""),
    ("LASTCHANGE_DATE",            "Zuletzt bearbeitet am",                               "DATS", 8,   ""),
    ("LASTCHANGE_TIME",            "Uhrzeit der letzten Bearbeitung",                     "TIMS", 6,   ""),
    ("BUILDING_TEXT",              "Bezeichnung des Gebaeudes",                           "CHAR", 60,  ""),
    ("BUILDING_TYPE",              "Art des Gebaeudes",                                   "NUMC", 2,   ""),
    ("BUILDING_CONDITION",         "Allgemeiner Gebaeudezustand",                         "NUMC", 2,   ""),
    ("CONSTRUCTION_YEAR",          "Baujahr",                                             "NUMC", 4,   ""),
    ("MODERNIZATION_YEAR",         "Jahr der Modernisierung",                             "NUMC", 4,   ""),
    ("RECONSTRUCTION_YEAR",        "Jahr Wiederaufbau",                                   "NUMC", 4,   ""),
    ("BEGIN_CONSTRUCTION_YEAR",    "Datum Baubeginn",                                     "DATS", 8,   ""),
    ("READY_FOR_OCCUPANCY_DATE",   "Bezugsfertigkeit",                                    "DATS", 8,   ""),
    ("COMPLETION_DATE",            "Fertigstellung",                                      "DATS", 8,   ""),
    ("FINAL_INSPECTION_DATE",      "Schlussabnahme",                                      "DATS", 8,   ""),
    ("PLANNING_INQUIRY_DATE",      "Datum Bauvoranfrage",                                 "DATS", 8,   ""),
    ("PRIOR_NOTICE_DATE",          "Datum Vorbescheid",                                   "DATS", 8,   ""),
    ("BUILDING_PERMIT_APPLIC_DATE","Antrag Baugenehmigung",                               "DATS", 8,   ""),
    ("BUILDING_PERMIT_DATE",       "Baugenehmigung",                                      "DATS", 8,   ""),
    ("TRANSF_USE_AND_ENCUMBR_DATE","Uebergang Nutzung / Lasten",                          "DATS", 8,   ""),
    ("SALE_DATE",                  "Verkaufsdatum",                                       "DATS", 8,   ""),
    ("PLANNED_SALE_DATE",          "Geplanter Verkauf",                                   "DATS", 8,   ""),
    ("USAGE_END_DATE",             "Nutzungsende",                                        "DATS", 8,   ""),
    ("BUILDING_PERMIT_NOTE",       "Anmerkung zur Baugenehmigung",                        "CHAR", 30,  ""),
    ("BUILDING_VALUE",             "BAPI: Bauwert",                                       "DEC",  23,  ""),
    ("CURRENT_BUILDING_VALUE",     "BAPI: Aktueller Bauwert",                             "DEC",  23,  ""),
    ("AMOUNT_PER_VOLUME",          "BAPI: Betrag pro Raumeinheit",                        "DEC",  23,  ""),
    ("HAS_HIST_SITE_PROTECTION",   "Denkmalschutz",                                       "CHAR", 1,   ""),
    ("ASSESSMENT_VALUE",           "BAPI: Einheitswert des Gebaeudes",                    "DEC",  23,  ""),
    ("ASSESSMENT_VALUE_YEAR",      "Basisjahr des Einheitswertes",                        "NUMC", 4,   ""),
    ("INSURANCE_VALUE",            "BAPI: Betrag des Versicherungswertes",                "DEC",  23,  ""),
    ("INSURANCE_VALUE_TYPE",       "Art des Versicherungswertes",                         "NUMC", 1,   ""),
    ("HERITABLE_BLDG_RIGHT_IND",   "Kennzeichen Erbbaurecht",                             "CHAR", 1,   ""),
    ("REPR_LIST_OF_RENTS",         "Mietspiegel",                                         "CHAR", 6,   ""),
    ("LOCATION_CLASS",             "Lageklasse",                                          "CHAR", 6,   ""),
    ("MAIN_USAGE_TYPE",            "Ueberwiegende Nutzungsart",                           "CHAR", 8,   ""),
    ("PUBLIC_FUNDING_FROM",        "Oeffentliche Foerderung von",                         "DATS", 8,   ""),
    ("PUBLIC_FUNDING_TO",          "Oeffentliche Foerderung bis",                         "DATS", 8,   ""),
    ("FLOORS",                     "Anzahl der Geschosse",                                "DEC",  4,   ""),
    ("BASEMENTS",                  "Anzahl Untergeschosse",                               "DEC",  2,   ""),
    ("TOP_FLOOR",                  "Oberstes Geschoss eines Gebaeudes",                   "NUMC", 3,   ""),
    ("ELEVATOR_TO_FLOOR",          "Lift bis Geschoss im Gebaeude",                       "NUMC", 3,   ""),
    ("MUNICIPALITY_KEY",           "Gemeindeschluessel",                                  "CHAR", 8,   ""),
    ("HAS_CURR_OCC_PRINC",         "Nutzt das Raumschuldnerprinzip",                      "CHAR", 1,   ""),
    ("UNIT_VOLUME",                "Einheit fuer Rauminhalt",                             "UNIT", 3,   ""),
    ("UNIT_VOLUME_ISO",            "ISO-Code Masseinheit",                                "CHAR", 3,   ""),
    ("CURRENCY",                   "Waehrungsschluessel",                                 "CUKY", 5,   ""),
    ("CURRENCY_ISO",               "Iso-Code Waehrung",                                   "CHAR", 3,   ""),
    ("AUTHORIZATION_GROUP",        "Berechtigungsgruppe",                                 "CHAR", 40,  ""),
    ("OBJECT_VALID_FROM",          "Datum: Objekt gueltig ab",                            "DATS", 8,   ""),
    ("OBJECT_VALID_TO",            "Datum: Objekt gueltig bis",                           "DATS", 8,   ""),
    ("REAL_VALID_FROM",            "Datum: Gueltig ab (effektiv)",                        "DATS", 8,   ""),
    ("REAL_VALID_TO",              "Datum: Gueltig bis (effektiv)",                       "DATS", 8,   ""),
    ("RESPONSIBLE",                "Verantwortlicher",                                    "CHAR", 12,  ""),
    ("STAT_PROF",                  "Statusschema",                                        "CHAR", 8,   ""),
    ("MANDATE_OBJECT_ID",          "Ident-Teil des Mandatsobjekts im Mandatsbukrs",       "CHAR", 45,  ""),
    ("MANDATE_MNG_OBJECT_ID",      "Ident-Teil des Mandatsobjekts im Verwaltungsbukrs",   "CHAR", 45,  ""),
    ("MANDATE_CR_OBJECT_ID",       "Ident-Teil des Mandatsobjekts im Sondereigentumsbukrs","CHAR", 45, ""),
    ("USES_REPR_LIST_OF_RENTS",    "Mietspiegel wird verwendet",                          "CHAR", 1,   ""),
    ("FUNCTION",                   "Funktion des Objektes",                               "CHAR", 4,   ""),
]

# ---------------------------------------------------------------- BUS_ENTITY
# Source: ZAPI_X4AI_BAPI_RE_BE_GET_DET "Attribute BUS_ENTITY" (lines 445..485).
BUS_ENTITY_FIELDS = [
    ("COMP_CODE",              "Buchungskreis",                                                          "CHAR", 4,   "FK"),
    ("BUSINESS_ENTITY",        "Nummer der Wirtschaftseinheit",                                          "CHAR", 8,   "PK"),
    ("IDENT_OBJECT_TYPE",      "Ident-Teil Objektart, z.B. 'IS' (Immobilienvertrag)",                    "CHAR", 2,   ""),
    ("IDENT_KEY",              "Ident-Teil Schluessel, z.B. '1000/123'",                                 "CHAR", 45,  ""),
    ("CREATION_USER",          "Erfasser",                                                               "CHAR", 12,  ""),
    ("CREATION_DATE",          "Zuerst erfasst am",                                                      "DATS", 8,   ""),
    ("CREATION_TIME",          "Angelegt um",                                                            "TIMS", 6,   ""),
    ("LASTCHANGE_USER",        "Mitarbeiterkennung",                                                     "CHAR", 12,  ""),
    ("LASTCHANGE_DATE",        "Zuletzt bearbeitet am",                                                  "DATS", 8,   ""),
    ("LASTCHANGE_TIME",        "Uhrzeit der letzten Bearbeitung",                                        "TIMS", 6,   ""),
    ("BUSINESS_ENTITY_TEXT",   "Bezeichnung der Wirtschaftseinheit",                                     "CHAR", 60,  ""),
    ("MAINTENANCE_AREA",       "Instandhaltungsbezirk",                                                  "NUMC", 5,   ""),
    ("TRANSPORT_CONNECTION",   "Verkehrsanbindung der WE",                                               "CHAR", 1,   ""),
    ("LOCATION",               "Nummer Lage der WE",                                                     "NUMC", 4,   ""),
    ("DISTRICT_LOCATION",      "Kennzeichen Ortslage des Objektes",                                      "NUMC", 2,   ""),
    ("REGIONAL_LOCATION",      "Standort",                                                               "CHAR", 10,  ""),
    ("REPR_LIST_OF_RENTS",     "Mietspiegel",                                                            "CHAR", 6,   ""),
    ("UNIT_AREA",              "Flaecheneinheit",                                                        "UNIT", 3,   ""),
    ("UNIT_AREA_ISO",          "ISO-Code Masseinheit",                                                   "CHAR", 3,   ""),
    ("UNIT_VOLUME",            "Einheit fuer Rauminhalt",                                                "UNIT", 3,   ""),
    ("UNIT_VOLUME_ISO",        "ISO-Code Masseinheit",                                                   "CHAR", 3,   ""),
    ("UNIT_LENGTH",            "Laengeneinheit",                                                         "UNIT", 3,   ""),
    ("UNIT_LENGTH_ISO",        "ISO-Code Masseinheit",                                                   "CHAR", 3,   ""),
    ("TENANCY_LAW",            "Mietrecht",                                                              "CHAR", 5,   ""),
    ("PREDEF_OPERATION_COSTS", "Vorbelegung Betriebskosten-Abrechnungsvariante",                         "CHAR", 4,   ""),
    ("PREDEF_HEATING_EXPENSES","Vorbelegung Heizkosten-Abrechnungsvariante",                             "CHAR", 4,   ""),
    ("AUTHORIZATION_GROUP",    "Berechtigungsgruppe",                                                    "CHAR", 40,  ""),
    ("AUTO_FUNC_LOC_DISABLED", "Verbietet das automatische Anlegen von Technischen Plaetzen",            "CHAR", 1,   ""),
    ("OBJECT_VALID_FROM",      "Datum: Gueltig ab",                                                      "DATS", 8,   ""),
    ("OBJECT_VALID_TO",        "Datum: Gueltig bis",                                                     "DATS", 8,   ""),
    ("RESPONSIBLE",            "Verantwortlicher",                                                       "CHAR", 12,  ""),
    ("STAT_PROF",              "Statusschema",                                                           "CHAR", 8,   ""),
    ("NEIGHBORHOOD_01",        "Gegend",                                                                 "CHAR", 30,  ""),
    ("NEIGHBORHOOD_02",        "Gegend",                                                                 "CHAR", 30,  ""),
    ("NEIGHBORHOOD_03",        "Gegend",                                                                 "CHAR", 30,  ""),
    ("MANDATE_OBJECT_ID",      "Ident-Teil des Mandatsobjekts im Mandatsbukrs",                          "CHAR", 45,  ""),
    ("MANDATE_MNG_OBJECT_ID",  "Ident-Teil des Mandatsobjekts im Verwaltungsbukrs",                      "CHAR", 45,  ""),
    ("MANDATE_CR_OBJECT_ID",   "Ident-Teil des Mandatsobjekts im Sondereigentumsbukrs",                  "CHAR", 45,  ""),
    ("FUNCTION",               "Funktion des Objektes",                                                  "CHAR", 4,   ""),
]

# ---------------------------------------------------------------- MEASUREMENT
# Source: ZAPI_X4AI_BAPI_RE_BU_MEAS_EDM "Attribute MEASUREMENT" (lines 114..127).
# Composite PK in SAP: OBJECT_TYPE + OBJECT_ID + MEASUREMENT + VALID_FROM.
MEASUREMENT_FIELDS = [
    ("OBJECT_TYPE",           "Business-Objektart des Objekts",                          "CHAR", 2,  "PK"),
    ("OBJECT_ID",             "Ident-Teil des Objekts",                                  "CHAR", 45, "PK"),
    ("MEASUREMENT",           "Bemessungsart",                                           "CHAR", 4,  "PK"),
    ("VALID_FROM",            "Datum: Bemessung gueltig ab",                             "DATS", 8,  "PK"),
    ("VALID_TO",              "Datum: Bemessung gueltig bis",                            "DATS", 8,  ""),
    ("VALUE_AVAIL",           "Bemessungsgroesse: Verfuegbare",                          "QUAN", 17, ""),
    ("UNIT",                  "Bemessungseinheit",                                       "UNIT", 3,  ""),
    ("UNIT_ISO",              "ISO-Code Masseinheit",                                    "CHAR", 3,  ""),
    ("VALUE_COMPL",           "Bemessungsgroesse: Kapazitaet",                           "QUAN", 17, ""),
    ("VALUE_SET_MANUALLY",    "Kennzeichen: Bemessung ist manuell ueberschrieben",       "CHAR", 1,  ""),
    ("VALUE_IS_HIERARCHICAL", "Kennzeichen: Es existieren hierarchisch unterg. Objekte", "CHAR", 1,  ""),
    ("TOTAL_MEASUREMENT",     "Kennzeichen: Summenbemessung",                            "CHAR", 1,  ""),
]


def build_field_row(dataset_id, idx, field_def):
    name, desc_de, sap_type, length, key = field_def
    is_pk = 1 if key == "PK" else 0
    is_fk = 1 if key == "FK" else 0
    nullable = 0 if is_pk else 1
    description = {
        "de": desc_de,
        "sap_type": sap_type,
        "length": length,
    }
    return {
        "id": f"uuid-fld-{dataset_id.split('-')[-1]}-{idx:03d}",
        "dataset_id": dataset_id,
        "name": name,
        "display_name": name,
        "data_type": sap_to_sql(sap_type, length),
        "description": json.dumps(description, ensure_ascii=False),
        "nullable": nullable,
        "is_primary_key": is_pk,
        "is_foreign_key": is_fk,
        "references_field_id": None,
        "sample_values": None,
        "sort_order": idx,
    }


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys = ON")
    cur = con.cursor()

    # --- 1. Drop all concept_mappings for the target datasets (about to rewrite)
    for ds in (GEBAEUDE_DS_ID, WE_DS_ID, BEMESS_DS_ID):
        cur.execute(
            "DELETE FROM concept_mapping WHERE field_id IN "
            "(SELECT id FROM field WHERE dataset_id=?)",
            (ds,),
        )
    # --- 2. Null out any incoming field.references_field_id pointers into
    #       these datasets (the field names change; stale FK links are kept
    #       as plain fields without a cross-table pointer).
    for ds in (GEBAEUDE_DS_ID, WE_DS_ID, BEMESS_DS_ID):
        cur.execute(
            "UPDATE field SET references_field_id = NULL WHERE references_field_id IN "
            "(SELECT id FROM field WHERE dataset_id=?)",
            (ds,),
        )
    # --- 3. Drop fields (fresh rewrite)
    for ds in (GEBAEUDE_DS_ID, WE_DS_ID, BEMESS_DS_ID):
        cur.execute("DELETE FROM field WHERE dataset_id=?", (ds,))

    # --- 3. Repurpose uuid-ds-001 as VIBDBU Gebaeude
    cur.execute(
        """
        UPDATE dataset SET
            name = 'VIBDBU',
            display_name = 'Gebaeude',
            dataset_type = 'table',
            description = ?,
            certified = 1,
            modified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?
        """,
        (
            json.dumps({
                "de": "SAP RE-FX Stammdatentabelle fuer Gebaeude (BUILDING). "
                      "Exponiert ueber ZAPI_X4AI_BAPI_RE_BU_GET_DET.",
                "en": "SAP RE-FX master data table for buildings (BUILDING node), "
                      "exposed via ZAPI_X4AI_BAPI_RE_BU_GET_DET.",
            }, ensure_ascii=False),
            GEBAEUDE_DS_ID,
        ),
    )

    # --- 4. Insert VIBDBE Wirtschaftseinheit
    cur.execute(
        """
        INSERT OR REPLACE INTO dataset
        (id, schema_id, name, display_name, dataset_type, description, certified,
         egid, egrid, row_count_approx, source_url, owner_id,
         created_at, modified_at)
        VALUES (?, ?, 'VIBDBE', 'Wirtschaftseinheit', 'table', ?, 1,
                NULL, NULL, NULL, NULL, NULL,
                strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        """,
        (
            WE_DS_ID, VIBD_SCHEMA_ID,
            json.dumps({
                "de": "SAP RE-FX Stammdatentabelle fuer Wirtschaftseinheiten "
                      "(BUS_ENTITY). Exponiert ueber ZAPI_X4AI_BAPI_RE_BE_GET_DET.",
                "en": "SAP RE-FX master data table for business entities "
                      "(BUS_ENTITY node), exposed via ZAPI_X4AI_BAPI_RE_BE_GET_DET.",
            }, ensure_ascii=False),
        ),
    )

    # --- 5. Insert VIBDME Bemessungen
    cur.execute(
        """
        INSERT OR REPLACE INTO dataset
        (id, schema_id, name, display_name, dataset_type, description, certified,
         egid, egrid, row_count_approx, source_url, owner_id,
         created_at, modified_at)
        VALUES (?, ?, 'VIBDME', 'Bemessungen', 'table', ?, 1,
                NULL, NULL, NULL, NULL, NULL,
                strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        """,
        (
            BEMESS_DS_ID, VIBD_SCHEMA_ID,
            json.dumps({
                "de": "SAP RE-FX Bemessungsdaten zu Immobilienobjekten "
                      "(MEASUREMENT). Exponiert ueber ZAPI_X4AI_BAPI_RE_BU_MEAS_EDM.",
                "en": "SAP RE-FX measurement records for real estate objects "
                      "(MEASUREMENT node), exposed via ZAPI_X4AI_BAPI_RE_BU_MEAS_EDM.",
            }, ensure_ascii=False),
        ),
    )

    # --- 6. Insert fields
    def insert_fields(dataset_id, field_defs):
        for i, fd in enumerate(field_defs, start=1):
            row = build_field_row(dataset_id, i, fd)
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

    insert_fields(GEBAEUDE_DS_ID, BUILDING_FIELDS)
    insert_fields(WE_DS_ID,       BUS_ENTITY_FIELDS)
    insert_fields(BEMESS_DS_ID,   MEASUREMENT_FIELDS)

    # --- 7. Concept mappings (Building, Business Entity, Dimensional Assessment)
    def fid(dataset_id, field_name):
        row = cur.execute(
            "SELECT id FROM field WHERE dataset_id=? AND name=?",
            (dataset_id, field_name),
        ).fetchone()
        return row[0] if row else None

    mappings = [
        # Building concept
        ("uuid-concept-004", GEBAEUDE_DS_ID, "BUILDING",          "exact"),
        ("uuid-concept-004", GEBAEUDE_DS_ID, "BUILDING_TEXT",     "partial"),
        ("uuid-concept-004", GEBAEUDE_DS_ID, "CONSTRUCTION_YEAR", "partial"),
        # Business Entity concept
        ("uuid-concept-018", WE_DS_ID,       "BUSINESS_ENTITY",      "exact"),
        ("uuid-concept-018", WE_DS_ID,       "BUSINESS_ENTITY_TEXT", "partial"),
        # Company Code concept
        ("uuid-concept-019", WE_DS_ID,       "COMP_CODE", "exact"),
        ("uuid-concept-019", GEBAEUDE_DS_ID, "COMP_CODE", "exact"),
        # Dimensional Assessment (Bemessung) concept
        ("uuid-concept-008", BEMESS_DS_ID,   "MEASUREMENT", "exact"),
        ("uuid-concept-008", BEMESS_DS_ID,   "VALUE_AVAIL", "partial"),
        ("uuid-concept-008", BEMESS_DS_ID,   "VALUE_COMPL", "partial"),
    ]
    for i, (concept_id, ds, field_name, match_type) in enumerate(mappings, start=1):
        f = fid(ds, field_name)
        if not f:
            continue
        cur.execute(
            """
            INSERT OR REPLACE INTO concept_mapping
            (id, concept_id, field_id, match_type, transformation_note, verified,
             created_by, created_at)
            VALUES (?, ?, ?, ?, NULL, 1, 'uuid-user-002',
                    strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            """,
            (f"uuid-cmap-refx-{i:03d}", concept_id, f, match_type),
        )

    # --- 8. Relationship edges: the three new SAP RE-FX tables cluster together
    cur.execute(
        """
        INSERT OR REPLACE INTO relationship_edge
        (source_id, source_type, target_id, target_type, rel_type, weight,
         derived_from, refreshed_at)
        VALUES
        (?, 'dataset', ?, 'dataset', 'sibling', 1.0, 're_fx_schema',
         strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        (?, 'dataset', ?, 'dataset', 'sibling', 1.0, 're_fx_schema',
         strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        (?, 'dataset', ?, 'dataset', 'sibling', 1.0, 're_fx_schema',
         strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        """,
        (
            WE_DS_ID,       GEBAEUDE_DS_ID,
            GEBAEUDE_DS_ID, BEMESS_DS_ID,
            WE_DS_ID,       BEMESS_DS_ID,
        ),
    )

    con.commit()

    # ---- Summary ----
    rows = cur.execute(
        "SELECT id, name, display_name, dataset_type, certified FROM dataset "
        "WHERE schema_id=? ORDER BY name",
        (VIBD_SCHEMA_ID,),
    ).fetchall()
    print("== SAP RE-FX VIBD datasets ==")
    for r in rows:
        ds_id = r[0]
        n = cur.execute("SELECT COUNT(*) FROM field WHERE dataset_id=?", (ds_id,)).fetchone()[0]
        print(f"  {ds_id:12} {r[1]:8} {r[2]:22} certified={r[4]}  fields={n}")
    con.close()


if __name__ == "__main__":
    main()
