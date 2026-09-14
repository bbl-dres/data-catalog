# RE-FX Gebäude: Excel import and API matching

Applied to Supabase on 14 September 2026. Owner revision 70 → 71. One batch event (`refx-building-mmb-20260914-v1`); no per-field events. [Verification](2026-09-14-refx-building-mmb/verification.json) and [live browser checks](2026-09-14-refx-building-mmb/browser-verification.json) passed, including exact Excel names and source order, 150 Draft fields, 55 archived fields, unchanged 378 API fields and 121 relationship records. Workbook checksum is unchanged. Existing relationships targeting archived fields remain stored and become inactive in the frontend.

Source: EFD-BBL Modelle (MMB).xlsx, AttributeApplicationClass!A1:AL151. SHA-256: `7003d5a07a6c7966f1518528d5078d53605bc33065d139f01edbcdf8fd099d3e`.

150 exact Excel names, all Draft, in source order. 11 existing identities reused, 139 created, 55 old fields archived.
61 API IDs assigned as working matches; 39 candidates remain unresolved; 50 have no reliable match.

API IDs and groups describe the documented API schema; they do not establish physical SAP columns or tables. Unresolved rows keep their exact Excel name as a modelAttribute because the existing schema requires a name. No candidate is written as an API ID. No new relations are inferred.

The workbook has no ALIAS column. Its ID columns are empty. Business-key flags are retained in comments, without inventing physical primary keys. Pflichtfeld n/a remains unknown. The one model type is preserved with modelDefinition scope. Source file is unchanged.

One table-level batch history entry contains complete before/after inventories. Existing relationships and history remain intact. No Auth identity or session is used for this administrator import.

| Excel row | Exact field name | API working match / candidates | Result |
| --- | --- | --- | --- |
| 2 | Bezeichnung des GE | BUILDING.BUILDING_TEXT | assigned |
| 3 | Buchungskreis | BUILDING.COMP_CODE | assigned |
| 4 | WirtschaftseinheitID | BUILDING.BUSINESS_ENTITY | assigned |
| 5 | GebäudeID | BUILDING.BUILDING | assigned |
| 6 | EGID | — | unmatched |
| 7 | EDID | — | unmatched |
| 8 | Strasse | OBJECT_ADDRESS.STREET_LNG | assigned |
| 9 | Hausnummer | OBJECT_ADDRESS.HOUSE_NO | assigned |
| 10 | Postleitzahl | OBJECT_ADDRESS.POSTL_COD1 | assigned |
| 11 | Ort | OBJECT_ADDRESS.CITY | assigned |
| 12 | Gültig ab | BUILDING.OBJECT_VALID_FROM; BUILDING.REAL_VALID_FROM | candidate |
| 13 | Gültig bis | BUILDING.OBJECT_VALID_TO; BUILDING.REAL_VALID_TO | candidate |
| 14 | Gültig ab übergeordnetes Objekt | BUILDING.REAL_VALID_FROM | candidate |
| 15 | Gültig bis übergeordnetes Objekt | BUILDING.REAL_VALID_TO | candidate |
| 16 | System- und Anwenderstatus | STATUS.STATUS_TEXT; STATUS.STATUS_DSCR; STATUS.IS_SYSTEM_STATUS | candidate |
| 17 | Baujahr | BUILDING.CONSTRUCTION_YEAR | assigned |
| 18 | Umbaujahr | BUILDING.MODERNIZATION_YEAR; BUILDING.RECONSTRUCTION_YEAR | candidate |
| 19 | Gemeindeschlüssel | BUILDING.MUNICIPALITY_KEY | assigned |
| 20 | Gemeinde | BUILDING.MUNICIPALITY_KEY | candidate |
| 21 | Kreis | OBJECT_ADDRESS.DISTRICT | candidate |
| 22 | Bundesland | OBJECT_ADDRESS.REGION | assigned |
| 23 | Anzahl Geschosse | BUILDING.FLOORS | assigned |
| 24 | Untergeschosse | BUILDING.BASEMENTS | assigned |
| 25 | Textfeld zu Anzahl | — | unmatched |
| 26 | Erbbaurecht | BUILDING.HERITABLE_BLDG_RIGHT_IND | assigned |
| 27 | Denkmalschutz | BUILDING.HAS_HIST_SITE_PROTECTION | assigned |
| 28 | Raumschuldnerprinzip | BUILDING.HAS_CURR_OCC_PRINC | assigned |
| 29 | Detail | — | unmatched |
| 30 | Bezeichnung Merkmalsklasse | — | unmatched |
| 31 | Bezeichnung Merkmalsgruppe | — | unmatched |
| 32 | Merkmal | CHARACT.FIX_FIT_CHARACT | assigned |
| 33 | Zusatzwert | CHARACT.ADDITIONAL_VALUE | assigned |
| 34 | Zutreffend | CHARACT.IS_APPLICABLE | assigned |
| 35 | Geb. zugeordnet | — | unmatched |
| 36 | Bezeichnung Merkmal | CHARACT.FIX_FIT_CHARACT | candidate |
| 37 | Gültig ab_1702 | CHARACT.VALID_FROM | candidate |
| 38 | Gültig bis_1703 | CHARACT.VALID_TO | candidate |
| 39 | Anzahl Merkmal | CHARACT.CHARACT_COUNT | assigned |
| 40 | Zusatzinfo | CHARACT.SUPPLEMENTINFO | assigned |
| 41 | Merkmalsklasse | — | unmatched |
| 42 | Merkmalsgruppe | — | unmatched |
| 43 | Notiz | — | unmatched |
| 44 | Obsolet | — | unmatched |
| 45 | Bemessungsart | MEASUREMENT.MEASUREMENT | assigned |
| 46 | Bemessungsart Bezeichnung Mittel | MEASUREMENT.MEASUREMENT | candidate |
| 47 | Verfügbare Bemessungsgrösse | MEASUREMENT.VALUE_AVAIL | assigned |
| 48 | Bemessungseinheit | MEASUREMENT.UNIT | assigned |
| 49 | Bemessung gültig ab | MEASUREMENT.VALID_FROM | assigned |
| 50 | Bemessung gültig bis | MEASUREMENT.VALID_TO | assigned |
| 51 | Summenbemessung | MEASUREMENT.TOTAL_MEASUREMENT | assigned |
| 52 | Gültig | TERM_ORG_ASSIGNMENT.VALID_FROM; TERM_ORG_ASSIGNMENT.VALID_TO | candidate |
| 53 | Geschäftsbereich | TERM_ORG_ASSIGNMENT.BUS_AREA | assigned |
| 54 | Profitcenter | TERM_ORG_ASSIGNMENT.PROFIT_CTR | assigned |
| 55 | Geschäftspartnerrolle | PARTNER.ROLE_TYPE | assigned |
| 56 | Beginn Beziehung | PARTNER.VALID_FROM | assigned |
| 57 | Ende Beziehung | PARTNER.VALID_TO | assigned |
| 58 | Adressart | PARTNER.ADDRESS_TYPE | assigned |
| 59 | Rollenart | PARTNER.ROLE_SUBTYPE | assigned |
| 60 | Bruchteilseigentum | PARTNER.PROP_FRACT_SHARE | assigned |
| 61 | Umrechnungsfaktor für Bruchteilseigentum | PARTNER.CONV_FACTOR_FRACT_SHARE | assigned |
| 62 | Miteigentumsanteil | PARTNER.CO_OWNERSHIP_SHARE | assigned |
| 63 | Eigentumsanteil | PARTNER.OWNERSHIP_SHARE | assigned |
| 64 | Anlagen/Aufträge/Technische Plätze | OBJ_ASSIGN.ASSIGNMNT_OBJECT_ID; OBJ_ASSIGN.ASSIGNMNT_OBJECT_TYPE | candidate |
| 65 | Zuordnung ab | OBJ_ASSIGN.VALID_FROM; ARCH_REL.VALID_FROM | candidate |
| 66 | Zuordnung bis | OBJ_ASSIGN.VALID_TO; ARCH_REL.VALID_TO | candidate |
| 67 | Bezeichnung architektonisches Objekt | ARCH_REL.ARCH_OBJECT_ID | candidate |
| 68 | Identifikation arch. Objekt | ARCH_REL.ARCH_OBJECT_ID | assigned |
| 69 | Nummer arch. Objekt | ARCH_REL.ARCH_OBJECT_ID | candidate |
| 70 | Gültig ab_1735 | ARCH_REL.VALID_FROM; ARCH_RELMS.VALID_FROM | candidate |
| 71 | Gültig bis_1736 | ARCH_REL.VALID_TO; ARCH_RELMS.VALID_TO | candidate |
| 72 | Identifikationsnummer der Wiedervorlageregel | RESUBM_RULE.RESUBM_RULE_NO; RESUBM_DATE.RESUBM_RULE_NO | candidate |
| 73 | Beschreibung der Wiedervorlageregel | — | unmatched |
| 74 | Wiedervorlageregel | RESUBM_RULE.RESUBM_RULE; RESUBM_DATE.RESUBM_RULE | candidate |
| 75 | Wiedervorlagegrund | RESUBM_RULE.RESUBM_REASON; RESUBM_DATE.RESUBM_REASON | candidate |
| 76 | Notiz vorhanden? | — | unmatched |
| 77 | Notiz zur Wiedervorlageregel | RESUBM_DATE.RESUBM_DATE_INFO | candidate |
| 78 | Bezeichnung des Wiedervorlagegrundes | RESUBM_RULE.RESUBM_REASON; RESUBM_DATE.RESUBM_REASON | candidate |
| 79 | Zusatztext 4 | — | unmatched |
| 80 | Übersichtsliste erstellter Dokus | — | unmatched |
| 81 | ESTAT | STATUS.STATUS_TEXT; STATUS.STATUS_DSCR | candidate |
| 82 | Archivwürdiges Objekt | — | unmatched |
| 83 | Sensitives Objekt | — | unmatched |
| 84 | Historische Ausstattung | — | unmatched |
| 85 | Abgl. RE/FI-AA | — | unmatched |
| 86 | Region Geb.Fakt. | CUS_DATA_BU3.FAKGEAUS | assigned |
| 87 | Eigentumsart | — | unmatched |
| 88 | Gebäudeart Stufe 1 | BUILDING.BUILDING_TYPE | candidate |
| 89 | Gebäudeart Stufe 2 | BUILDING.BUILDING_TYPE | candidate |
| 90 | Zusatztext 1 | — | unmatched |
| 91 | Zusatztext 2 | — | unmatched |
| 92 | Zusatztext 3 | — | unmatched |
| 93 | Zusatztext 5 | — | unmatched |
| 94 | Gebäudekategorie | BUILDING.BUILDING_TYPE | candidate |
| 95 | Perimeter | — | unmatched |
| 96 | Schätzdatum | — | unmatched |
| 97 | Teilportfolio | — | unmatched |
| 98 | Mietermodell | CUS_DATA_0MM.MIMOD | assigned |
| 99 | Im Speedikon | — | unmatched |
| 100 | Datum von | CUS_DATA_0MM.VALIDFROM; CUS_DATA_BU1.MDATVON; CUS_DATA_BU3.MDATVON | candidate |
| 101 | Datum bis | CUS_DATA_0MM.VALIDTO; CUS_DATA_BU1.MDATBIS; CUS_DATA_BU3.MDATBIS | candidate |
| 102 | Anzahl m2 | MEASUREMENT.VALUE_AVAIL; MEASUREMENT.VALUE_COMPL | candidate |
| 103 | Datum von_1769 | CUS_DATA_BU1.MDATVON; CUS_DATA_BU3.MDATVON | candidate |
| 104 | Datum bis_1770 | CUS_DATA_BU1.MDATBIS; CUS_DATA_BU3.MDATBIS | candidate |
| 105 | Text | CUS_DATA_BU1.TEXT | candidate |
| 106 | Bezeichnung | — | unmatched |
| 107 | Stand | — | unmatched |
| 108 | AP Makro HNF 2.9 | — | unmatched |
| 109 | AP Ist | — | unmatched |
| 110 | MJ/m2 EBF | — | unmatched |
| 111 | Objektstrategie | — | unmatched |
| 112 | Zustand | BUILDING.BUILDING_CONDITION | candidate |
| 113 | UH-Kategorie | — | unmatched |
| 114 | Spezialfall | — | unmatched |
| 115 | Wirtschaftlichkeit | — | unmatched |
| 116 | Kunde | — | unmatched |
| 117 | Bewirtschaftung | — | unmatched |
| 118 | Geb.spezifikation | — | unmatched |
| 119 | Energie/Nachh. | — | unmatched |
| 120 | Lage | — | unmatched |
| 121 | Betrieb | — | unmatched |
| 122 | Total gewichtet 2010 | — | unmatched |
| 123 | Total gewichtet 2024 | — | unmatched |
| 124 | Bemerkung | CUS_DATA_7GE.BEMER_04; CUS_DATA_7GE.BEM04 | candidate |
| 125 | Bezeichnung Grundstück | CUS_DATA_BU2.SGRNR | candidate |
| 126 | Gebäudeanteil % | CUS_DATA_BU2.PGEBANT | assigned |
| 127 | Gültig ab_1794 | CUS_DATA_BU2.DGULTAB | candidate |
| 128 | Gefährdungszone | — | unmatched |
| 129 | Massn. erforderlich | — | unmatched |
| 130 | Massnahmen | — | unmatched |
| 131 | Massnahmen umgesetzt | — | unmatched |
| 132 | Umsetzungsart | — | unmatched |
| 133 | Repräsentationsfunktion | CUS_DATA_0BU.PMA00 | assigned |
| 134 | Datum Sicherheitskonzept | CUS_DATA_0BU.PMA06 | assigned |
| 135 | Lift vorhanden | CUS_DATA_0BU.PMA02 | assigned |
| 136 | Anz. Parkplatz gedeckt | CUS_DATA_0BU.PMA04 | assigned |
| 137 | Anz. Parkplatz ungedeckt | CUS_DATA_0BU.PMA05 | assigned |
| 138 | Möblierung durch | CUS_DATA_0BU.MOB00 | assigned |
| 139 | Residenz Möbl. repräsentativ | CUS_DATA_0BU.MOB01 | assigned |
| 140 | Residenz/DW Möbl. priv. Teil | CUS_DATA_0BU.MOB02 | assigned |
| 141 | Kanzlei Möblierung | CUS_DATA_0BU.MOB03 | assigned |
| 142 | Letztes Möblierungskonzept | CUS_DATA_0BU.MOB04 | assigned |
| 143 | Teilersatz-/Ergänzungsmöblierung vom | CUS_DATA_0BU.MOB05 | assigned |
| 144 | BAK-Leihgabe | CUS_DATA_0BU.MOB06 | assigned |
| 145 | Residenz Standardliste Nr. | CUS_DATA_0BU.MOB09 | assigned |
| 146 | Inventarliste Möblierung | CUS_DATA_0BU.MOB07 | assigned |
| 147 | Datum Photodokumentation | CUS_DATA_0BU.MOB08 | assigned |
| 148 | Schadstoffbericht | CUS_DATA_0BU.SAF00 | assigned |
| 149 | Asbest letzte Meldung | CUS_DATA_0BU.SAF01 | assigned |
| 150 | Asbest letzter Bericht | CUS_DATA_0BU.SAF02 | assigned |
| 151 | Asbest letzte Massnahme | CUS_DATA_0BU.SAF03 | assigned |

## Old fields archived

- t-sap-building/IDENT_KEY
- t-sap-building/IDENT_OBJECT_TYPE
- t-sap-building/MANDATE_OBJECT_ID
- t-sap-building/MANDATE_MNG_OBJECT_ID
- t-sap-building/MANDATE_CR_OBJECT_ID
- t-sap-building/BUILDING_TYPE
- t-sap-building/MAIN_USAGE_TYPE
- t-sap-building/FUNCTION
- t-sap-building/LOCATION_CLASS
- t-sap-building/STAT_PROF
- t-sap-building/BUILDING_CONDITION
- t-sap-building/BEGIN_CONSTRUCTION_YEAR
- t-sap-building/COMPLETION_DATE
- t-sap-building/READY_FOR_OCCUPANCY_DATE
- t-sap-building/FINAL_INSPECTION_DATE
- t-sap-building/MODERNIZATION_YEAR
- t-sap-building/RECONSTRUCTION_YEAR
- t-sap-building/PLANNING_INQUIRY_DATE
- t-sap-building/BUILDING_PERMIT_APPLIC_DATE
- t-sap-building/PRIOR_NOTICE_DATE
- t-sap-building/BUILDING_PERMIT_DATE
- t-sap-building/BUILDING_PERMIT_NOTE
- t-sap-building/TRANSF_USE_AND_ENCUMBR_DATE
- t-sap-building/PLANNED_SALE_DATE
- t-sap-building/SALE_DATE
- t-sap-building/USAGE_END_DATE
- t-sap-building/PUBLIC_FUNDING_FROM
- t-sap-building/PUBLIC_FUNDING_TO
- t-sap-building/RESPONSIBLE
- t-sap-building/AUTHORIZATION_GROUP
- t-sap-building/USES_REPR_LIST_OF_RENTS
- t-sap-building/REPR_LIST_OF_RENTS
- t-sap-building/TOP_FLOOR
- t-sap-building/ELEVATOR_TO_FLOOR
- t-sap-building/UNIT_VOLUME
- t-sap-building/UNIT_VOLUME_ISO
- t-sap-building/CURRENCY
- t-sap-building/CURRENCY_ISO
- t-sap-building/BUILDING_VALUE
- t-sap-building/CURRENT_BUILDING_VALUE
- t-sap-building/ASSESSMENT_VALUE
- t-sap-building/ASSESSMENT_VALUE_YEAR
- t-sap-building/INSURANCE_VALUE_TYPE
- t-sap-building/INSURANCE_VALUE
- t-sap-building/AMOUNT_PER_VOLUME
- t-sap-building/OBJECT_VALID_FROM
- t-sap-building/OBJECT_VALID_TO
- t-sap-building/REAL_VALID_FROM
- t-sap-building/REAL_VALID_TO
- t-sap-building/CREATION_DATE
- t-sap-building/CREATION_TIME
- t-sap-building/CREATION_USER
- t-sap-building/LASTCHANGE_DATE
- t-sap-building/LASTCHANGE_TIME
- t-sap-building/LASTCHANGE_USER
