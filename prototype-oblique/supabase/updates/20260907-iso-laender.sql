-- ISO 3166-1 Land: one new reference list with the 249 officially assigned alpha-2
-- country codes and German short names, for the Land part of addresses. Bound to the
-- Land attributes of Gebäude and Grundstück (both valueType code, previously unbound)
-- and to the country-coded source fields (GIS adr_land, GWR PAGLAND, SAP Land).
-- The agreed country vocabulary of the Fachprofil now has a concrete list.
-- Standalone content update AFTER referenzdaten-namen-20260907-v1; not a schema/app migration.
-- Run the ENTIRE file as postgres in Supabase SQL Editor.
-- 260 record changes: 1 list, 249 values, 2 attribute bindings, 8 field bindings.
-- PREVIEW: replace only the FINAL COMMIT with ROLLBACK and inspect the result tables.
-- Repeating identical applied content is a no-op; stale baselines/collisions abort.

BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(18427, 1);

DO $laender$
DECLARE
  operation_id constant text := 'iso-laender-20260907-v1';
  edited_on constant date := (transaction_timestamp() AT TIME ZONE 'UTC')::date;
  proposal constant jsonb := $proposal$
{
  "revision": 1,
  "source": "ISO 3166-1 Alpha-2 (249 offiziell zugeteilte Codes); Ergänzung 7. September 2026",
  "requiresOperation": "referenzdaten-namen-20260907-v1",
  "expectedChanges": 260,
  "list": {
    "id": "r-iso-land",
    "name": "ISO 3166-1 Land",
    "description": "Länder- und Gebietscodes nach ISO 3166-1 (Alpha-2) für Adressangaben.",
    "comment": "Alpha-2-Codes nach ISO 3166-1 mit deutschen Kurzbezeichnungen; in SAP (LAND1), GIS (adr_land) und GWR (z. B. PAGLAND) verwendet. Bezeichnungen gegen das offizielle Staatenverzeichnis (BFS/eCH-0072) zu prüfen.",
    "standards": [
      "ISO 3166-1"
    ],
    "authority": {
      "name_de": "Internationale Organisation für Normung (ISO)",
      "websiteUrl": "https://www.iso.org/iso-3166-country-codes.html"
    },
    "values": [
      {
        "code": "AD",
        "name": "Andorra"
      },
      {
        "code": "AE",
        "name": "Vereinigte Arabische Emirate"
      },
      {
        "code": "AF",
        "name": "Afghanistan"
      },
      {
        "code": "AG",
        "name": "Antigua und Barbuda"
      },
      {
        "code": "AI",
        "name": "Anguilla"
      },
      {
        "code": "AL",
        "name": "Albanien"
      },
      {
        "code": "AM",
        "name": "Armenien"
      },
      {
        "code": "AO",
        "name": "Angola"
      },
      {
        "code": "AQ",
        "name": "Antarktis"
      },
      {
        "code": "AR",
        "name": "Argentinien"
      },
      {
        "code": "AS",
        "name": "Amerikanisch-Samoa"
      },
      {
        "code": "AT",
        "name": "Österreich"
      },
      {
        "code": "AU",
        "name": "Australien"
      },
      {
        "code": "AW",
        "name": "Aruba"
      },
      {
        "code": "AX",
        "name": "Åland"
      },
      {
        "code": "AZ",
        "name": "Aserbaidschan"
      },
      {
        "code": "BA",
        "name": "Bosnien und Herzegowina"
      },
      {
        "code": "BB",
        "name": "Barbados"
      },
      {
        "code": "BD",
        "name": "Bangladesch"
      },
      {
        "code": "BE",
        "name": "Belgien"
      },
      {
        "code": "BF",
        "name": "Burkina Faso"
      },
      {
        "code": "BG",
        "name": "Bulgarien"
      },
      {
        "code": "BH",
        "name": "Bahrain"
      },
      {
        "code": "BI",
        "name": "Burundi"
      },
      {
        "code": "BJ",
        "name": "Benin"
      },
      {
        "code": "BL",
        "name": "Saint-Barthélemy"
      },
      {
        "code": "BM",
        "name": "Bermuda"
      },
      {
        "code": "BN",
        "name": "Brunei Darussalam"
      },
      {
        "code": "BO",
        "name": "Bolivien"
      },
      {
        "code": "BQ",
        "name": "Bonaire, Sint Eustatius und Saba"
      },
      {
        "code": "BR",
        "name": "Brasilien"
      },
      {
        "code": "BS",
        "name": "Bahamas"
      },
      {
        "code": "BT",
        "name": "Bhutan"
      },
      {
        "code": "BV",
        "name": "Bouvetinsel"
      },
      {
        "code": "BW",
        "name": "Botsuana"
      },
      {
        "code": "BY",
        "name": "Belarus"
      },
      {
        "code": "BZ",
        "name": "Belize"
      },
      {
        "code": "CA",
        "name": "Kanada"
      },
      {
        "code": "CC",
        "name": "Kokosinseln"
      },
      {
        "code": "CD",
        "name": "Kongo (Demokratische Republik)"
      },
      {
        "code": "CF",
        "name": "Zentralafrikanische Republik"
      },
      {
        "code": "CG",
        "name": "Kongo (Republik)"
      },
      {
        "code": "CH",
        "name": "Schweiz"
      },
      {
        "code": "CI",
        "name": "Côte d’Ivoire"
      },
      {
        "code": "CK",
        "name": "Cookinseln"
      },
      {
        "code": "CL",
        "name": "Chile"
      },
      {
        "code": "CM",
        "name": "Kamerun"
      },
      {
        "code": "CN",
        "name": "China"
      },
      {
        "code": "CO",
        "name": "Kolumbien"
      },
      {
        "code": "CR",
        "name": "Costa Rica"
      },
      {
        "code": "CU",
        "name": "Kuba"
      },
      {
        "code": "CV",
        "name": "Cabo Verde"
      },
      {
        "code": "CW",
        "name": "Curaçao"
      },
      {
        "code": "CX",
        "name": "Weihnachtsinsel"
      },
      {
        "code": "CY",
        "name": "Zypern"
      },
      {
        "code": "CZ",
        "name": "Tschechien"
      },
      {
        "code": "DE",
        "name": "Deutschland"
      },
      {
        "code": "DJ",
        "name": "Dschibuti"
      },
      {
        "code": "DK",
        "name": "Dänemark"
      },
      {
        "code": "DM",
        "name": "Dominica"
      },
      {
        "code": "DO",
        "name": "Dominikanische Republik"
      },
      {
        "code": "DZ",
        "name": "Algerien"
      },
      {
        "code": "EC",
        "name": "Ecuador"
      },
      {
        "code": "EE",
        "name": "Estland"
      },
      {
        "code": "EG",
        "name": "Ägypten"
      },
      {
        "code": "EH",
        "name": "Westsahara"
      },
      {
        "code": "ER",
        "name": "Eritrea"
      },
      {
        "code": "ES",
        "name": "Spanien"
      },
      {
        "code": "ET",
        "name": "Äthiopien"
      },
      {
        "code": "FI",
        "name": "Finnland"
      },
      {
        "code": "FJ",
        "name": "Fidschi"
      },
      {
        "code": "FK",
        "name": "Falklandinseln"
      },
      {
        "code": "FM",
        "name": "Mikronesien"
      },
      {
        "code": "FO",
        "name": "Färöer"
      },
      {
        "code": "FR",
        "name": "Frankreich"
      },
      {
        "code": "GA",
        "name": "Gabun"
      },
      {
        "code": "GB",
        "name": "Vereinigtes Königreich"
      },
      {
        "code": "GD",
        "name": "Grenada"
      },
      {
        "code": "GE",
        "name": "Georgien"
      },
      {
        "code": "GF",
        "name": "Französisch-Guayana"
      },
      {
        "code": "GG",
        "name": "Guernsey"
      },
      {
        "code": "GH",
        "name": "Ghana"
      },
      {
        "code": "GI",
        "name": "Gibraltar"
      },
      {
        "code": "GL",
        "name": "Grönland"
      },
      {
        "code": "GM",
        "name": "Gambia"
      },
      {
        "code": "GN",
        "name": "Guinea"
      },
      {
        "code": "GP",
        "name": "Guadeloupe"
      },
      {
        "code": "GQ",
        "name": "Äquatorialguinea"
      },
      {
        "code": "GR",
        "name": "Griechenland"
      },
      {
        "code": "GS",
        "name": "Südgeorgien und die Südlichen Sandwichinseln"
      },
      {
        "code": "GT",
        "name": "Guatemala"
      },
      {
        "code": "GU",
        "name": "Guam"
      },
      {
        "code": "GW",
        "name": "Guinea-Bissau"
      },
      {
        "code": "GY",
        "name": "Guyana"
      },
      {
        "code": "HK",
        "name": "Hongkong"
      },
      {
        "code": "HM",
        "name": "Heard und McDonaldinseln"
      },
      {
        "code": "HN",
        "name": "Honduras"
      },
      {
        "code": "HR",
        "name": "Kroatien"
      },
      {
        "code": "HT",
        "name": "Haiti"
      },
      {
        "code": "HU",
        "name": "Ungarn"
      },
      {
        "code": "ID",
        "name": "Indonesien"
      },
      {
        "code": "IE",
        "name": "Irland"
      },
      {
        "code": "IL",
        "name": "Israel"
      },
      {
        "code": "IM",
        "name": "Insel Man"
      },
      {
        "code": "IN",
        "name": "Indien"
      },
      {
        "code": "IO",
        "name": "Britisches Territorium im Indischen Ozean"
      },
      {
        "code": "IQ",
        "name": "Irak"
      },
      {
        "code": "IR",
        "name": "Iran"
      },
      {
        "code": "IS",
        "name": "Island"
      },
      {
        "code": "IT",
        "name": "Italien"
      },
      {
        "code": "JE",
        "name": "Jersey"
      },
      {
        "code": "JM",
        "name": "Jamaika"
      },
      {
        "code": "JO",
        "name": "Jordanien"
      },
      {
        "code": "JP",
        "name": "Japan"
      },
      {
        "code": "KE",
        "name": "Kenia"
      },
      {
        "code": "KG",
        "name": "Kirgisistan"
      },
      {
        "code": "KH",
        "name": "Kambodscha"
      },
      {
        "code": "KI",
        "name": "Kiribati"
      },
      {
        "code": "KM",
        "name": "Komoren"
      },
      {
        "code": "KN",
        "name": "St. Kitts und Nevis"
      },
      {
        "code": "KP",
        "name": "Korea (Nord)"
      },
      {
        "code": "KR",
        "name": "Korea (Süd)"
      },
      {
        "code": "KW",
        "name": "Kuwait"
      },
      {
        "code": "KY",
        "name": "Kaimaninseln"
      },
      {
        "code": "KZ",
        "name": "Kasachstan"
      },
      {
        "code": "LA",
        "name": "Laos"
      },
      {
        "code": "LB",
        "name": "Libanon"
      },
      {
        "code": "LC",
        "name": "St. Lucia"
      },
      {
        "code": "LI",
        "name": "Liechtenstein"
      },
      {
        "code": "LK",
        "name": "Sri Lanka"
      },
      {
        "code": "LR",
        "name": "Liberia"
      },
      {
        "code": "LS",
        "name": "Lesotho"
      },
      {
        "code": "LT",
        "name": "Litauen"
      },
      {
        "code": "LU",
        "name": "Luxemburg"
      },
      {
        "code": "LV",
        "name": "Lettland"
      },
      {
        "code": "LY",
        "name": "Libyen"
      },
      {
        "code": "MA",
        "name": "Marokko"
      },
      {
        "code": "MC",
        "name": "Monaco"
      },
      {
        "code": "MD",
        "name": "Moldova"
      },
      {
        "code": "ME",
        "name": "Montenegro"
      },
      {
        "code": "MF",
        "name": "Saint-Martin (französischer Teil)"
      },
      {
        "code": "MG",
        "name": "Madagaskar"
      },
      {
        "code": "MH",
        "name": "Marshallinseln"
      },
      {
        "code": "MK",
        "name": "Nordmazedonien"
      },
      {
        "code": "ML",
        "name": "Mali"
      },
      {
        "code": "MM",
        "name": "Myanmar"
      },
      {
        "code": "MN",
        "name": "Mongolei"
      },
      {
        "code": "MO",
        "name": "Macao"
      },
      {
        "code": "MP",
        "name": "Nördliche Marianen"
      },
      {
        "code": "MQ",
        "name": "Martinique"
      },
      {
        "code": "MR",
        "name": "Mauretanien"
      },
      {
        "code": "MS",
        "name": "Montserrat"
      },
      {
        "code": "MT",
        "name": "Malta"
      },
      {
        "code": "MU",
        "name": "Mauritius"
      },
      {
        "code": "MV",
        "name": "Malediven"
      },
      {
        "code": "MW",
        "name": "Malawi"
      },
      {
        "code": "MX",
        "name": "Mexiko"
      },
      {
        "code": "MY",
        "name": "Malaysia"
      },
      {
        "code": "MZ",
        "name": "Mosambik"
      },
      {
        "code": "NA",
        "name": "Namibia"
      },
      {
        "code": "NC",
        "name": "Neukaledonien"
      },
      {
        "code": "NE",
        "name": "Niger"
      },
      {
        "code": "NF",
        "name": "Norfolkinsel"
      },
      {
        "code": "NG",
        "name": "Nigeria"
      },
      {
        "code": "NI",
        "name": "Nicaragua"
      },
      {
        "code": "NL",
        "name": "Niederlande"
      },
      {
        "code": "NO",
        "name": "Norwegen"
      },
      {
        "code": "NP",
        "name": "Nepal"
      },
      {
        "code": "NR",
        "name": "Nauru"
      },
      {
        "code": "NU",
        "name": "Niue"
      },
      {
        "code": "NZ",
        "name": "Neuseeland"
      },
      {
        "code": "OM",
        "name": "Oman"
      },
      {
        "code": "PA",
        "name": "Panama"
      },
      {
        "code": "PE",
        "name": "Peru"
      },
      {
        "code": "PF",
        "name": "Französisch-Polynesien"
      },
      {
        "code": "PG",
        "name": "Papua-Neuguinea"
      },
      {
        "code": "PH",
        "name": "Philippinen"
      },
      {
        "code": "PK",
        "name": "Pakistan"
      },
      {
        "code": "PL",
        "name": "Polen"
      },
      {
        "code": "PM",
        "name": "St. Pierre und Miquelon"
      },
      {
        "code": "PN",
        "name": "Pitcairninseln"
      },
      {
        "code": "PR",
        "name": "Puerto Rico"
      },
      {
        "code": "PS",
        "name": "Palästina"
      },
      {
        "code": "PT",
        "name": "Portugal"
      },
      {
        "code": "PW",
        "name": "Palau"
      },
      {
        "code": "PY",
        "name": "Paraguay"
      },
      {
        "code": "QA",
        "name": "Katar"
      },
      {
        "code": "RE",
        "name": "Réunion"
      },
      {
        "code": "RO",
        "name": "Rumänien"
      },
      {
        "code": "RS",
        "name": "Serbien"
      },
      {
        "code": "RU",
        "name": "Russland"
      },
      {
        "code": "RW",
        "name": "Ruanda"
      },
      {
        "code": "SA",
        "name": "Saudi-Arabien"
      },
      {
        "code": "SB",
        "name": "Salomoninseln"
      },
      {
        "code": "SC",
        "name": "Seychellen"
      },
      {
        "code": "SD",
        "name": "Sudan"
      },
      {
        "code": "SE",
        "name": "Schweden"
      },
      {
        "code": "SG",
        "name": "Singapur"
      },
      {
        "code": "SH",
        "name": "St. Helena, Ascension und Tristan da Cunha"
      },
      {
        "code": "SI",
        "name": "Slowenien"
      },
      {
        "code": "SJ",
        "name": "Svalbard und Jan Mayen"
      },
      {
        "code": "SK",
        "name": "Slowakei"
      },
      {
        "code": "SL",
        "name": "Sierra Leone"
      },
      {
        "code": "SM",
        "name": "San Marino"
      },
      {
        "code": "SN",
        "name": "Senegal"
      },
      {
        "code": "SO",
        "name": "Somalia"
      },
      {
        "code": "SR",
        "name": "Suriname"
      },
      {
        "code": "SS",
        "name": "Südsudan"
      },
      {
        "code": "ST",
        "name": "São Tomé und Príncipe"
      },
      {
        "code": "SV",
        "name": "El Salvador"
      },
      {
        "code": "SX",
        "name": "Sint Maarten (niederländischer Teil)"
      },
      {
        "code": "SY",
        "name": "Syrien"
      },
      {
        "code": "SZ",
        "name": "Eswatini"
      },
      {
        "code": "TC",
        "name": "Turks- und Caicosinseln"
      },
      {
        "code": "TD",
        "name": "Tschad"
      },
      {
        "code": "TF",
        "name": "Französische Süd- und Antarktisgebiete"
      },
      {
        "code": "TG",
        "name": "Togo"
      },
      {
        "code": "TH",
        "name": "Thailand"
      },
      {
        "code": "TJ",
        "name": "Tadschikistan"
      },
      {
        "code": "TK",
        "name": "Tokelau"
      },
      {
        "code": "TL",
        "name": "Timor-Leste"
      },
      {
        "code": "TM",
        "name": "Turkmenistan"
      },
      {
        "code": "TN",
        "name": "Tunesien"
      },
      {
        "code": "TO",
        "name": "Tonga"
      },
      {
        "code": "TR",
        "name": "Türkei"
      },
      {
        "code": "TT",
        "name": "Trinidad und Tobago"
      },
      {
        "code": "TV",
        "name": "Tuvalu"
      },
      {
        "code": "TW",
        "name": "Taiwan"
      },
      {
        "code": "TZ",
        "name": "Tansania"
      },
      {
        "code": "UA",
        "name": "Ukraine"
      },
      {
        "code": "UG",
        "name": "Uganda"
      },
      {
        "code": "UM",
        "name": "Kleinere Inselbesitzungen der Vereinigten Staaten"
      },
      {
        "code": "US",
        "name": "Vereinigte Staaten"
      },
      {
        "code": "UY",
        "name": "Uruguay"
      },
      {
        "code": "UZ",
        "name": "Usbekistan"
      },
      {
        "code": "VA",
        "name": "Vatikanstadt"
      },
      {
        "code": "VC",
        "name": "St. Vincent und die Grenadinen"
      },
      {
        "code": "VE",
        "name": "Venezuela"
      },
      {
        "code": "VG",
        "name": "Britische Jungferninseln"
      },
      {
        "code": "VI",
        "name": "Amerikanische Jungferninseln"
      },
      {
        "code": "VN",
        "name": "Vietnam"
      },
      {
        "code": "VU",
        "name": "Vanuatu"
      },
      {
        "code": "WF",
        "name": "Wallis und Futuna"
      },
      {
        "code": "WS",
        "name": "Samoa"
      },
      {
        "code": "YE",
        "name": "Jemen"
      },
      {
        "code": "YT",
        "name": "Mayotte"
      },
      {
        "code": "ZA",
        "name": "Südafrika"
      },
      {
        "code": "ZM",
        "name": "Sambia"
      },
      {
        "code": "ZW",
        "name": "Simbabwe"
      }
    ]
  },
  "bind": [
    {
      "attribute": "gebaeude/land",
      "revision": 2
    },
    {
      "attribute": "grundstueck/land",
      "revision": 2
    }
  ],
  "bindFields": [
    {
      "field": "t-boden/adr_land",
      "revision": 1
    },
    {
      "field": "t-geb-gis/adr_land",
      "revision": 1
    },
    {
      "field": "t-gis-green-area/adr_land",
      "revision": 1
    },
    {
      "field": "t-huelle/adr_land",
      "revision": 1
    },
    {
      "field": "t-parzelle/adr_land",
      "revision": 1
    },
    {
      "field": "t-proj/adr_land",
      "revision": 1
    },
    {
      "field": "t-gwr-bauprojekt/PAGLAND",
      "revision": 1
    },
    {
      "field": "t-sap-land-architecture/Land",
      "revision": 1
    }
  ]
}
  $proposal$::jsonb;
  item jsonb;
  child jsonb;
  raw_before jsonb;
  list_uuid uuid;
  record_uuid uuid;
  fingerprint text;
  previous_fingerprint text;
  change_count integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the complete country-list update as postgres';
  END IF;
  fingerprint := encode(sha256(convert_to(proposal::text, 'UTF8')), 'hex');
  SELECT b.fingerprint INTO previous_fingerprint FROM catalog_private.import_batch b WHERE b.identifier = operation_id;
  IF FOUND THEN
    IF previous_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'Country operation already applied with different content; prepare a new incremental update';
    END IF;
    RAISE NOTICE 'ISO 3166-1 Land already applied; no new edits';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT FROM catalog_private.import_batch WHERE identifier = proposal->>'requiresOperation') THEN
    RAISE EXCEPTION 'Apply the Referenzdaten naming convention first';
  END IF;

  -- Validate the entire scope before changing any row.
  IF EXISTS (SELECT FROM catalog.code_list WHERE identifier = proposal->'list'->>'id' OR name_de = proposal->'list'->>'name')
    OR EXISTS (SELECT FROM catalog.code_value WHERE identifier IN
      (SELECT (proposal->'list'->>'id') || '/' || (v->>'code') FROM jsonb_array_elements(proposal->'list'->'values') v)) THEN
    RAISE EXCEPTION 'A proposed list/value identifier or name already exists; refusing to overwrite it';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(proposal->'list'->'values')) <> 249
    OR (SELECT count(DISTINCT v->>'code') FROM jsonb_array_elements(proposal->'list'->'values') v) <> 249 THEN
    RAISE EXCEPTION 'Expected 249 unique alpha-2 codes';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'bind') LOOP
    SELECT to_jsonb(a) INTO raw_before FROM catalog.business_attribute a WHERE a.identifier = item->>'attribute' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'code_list_id' IS NOT NULL
      OR raw_before->'value_specification'->>'valueType' IS DISTINCT FROM 'code' THEN
      RAISE EXCEPTION 'Expected unbound code attribute % at its reviewed revision', item->>'attribute';
    END IF;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'bindFields') LOOP
    SELECT to_jsonb(f) INTO raw_before FROM catalog.data_field f WHERE f.identifier = item->>'field' FOR UPDATE;
    IF raw_before IS NULL OR (raw_before->>'row_version')::bigint <> (item->>'revision')::bigint
      OR raw_before->>'code_list_id' IS NOT NULL THEN
      RAISE EXCEPTION 'Expected unbound source field % at its reviewed revision', item->>'field';
    END IF;
  END LOOP;

  INSERT INTO catalog.code_list AS l
    (identifier, name_de, description_de, comment, status, created_on, modified_on, normative_references, authority_organisation)
  VALUES (proposal->'list'->>'id', proposal->'list'->>'name', proposal->'list'->>'description',
    proposal->'list'->>'comment', 'draft', edited_on, edited_on,
    ARRAY(SELECT jsonb_array_elements_text(proposal->'list'->'standards')), proposal->'list'->'authority')
  RETURNING l.id INTO list_uuid;
  change_count := change_count + 1;

  FOR child IN SELECT * FROM jsonb_array_elements(proposal->'list'->'values') LOOP
    INSERT INTO catalog.code_value AS v
      (identifier, code_list_id, code, name_de, created_on, modified_on)
    VALUES ((proposal->'list'->>'id') || '/' || (child->>'code'), list_uuid, child->>'code', child->>'name', edited_on, edited_on)
    RETURNING v.id INTO record_uuid;
    change_count := change_count + 1;
  END LOOP;
  IF (SELECT count(*) FROM catalog.code_value WHERE code_list_id = list_uuid) <> 249 THEN
    RAISE EXCEPTION 'Unexpected country value count; rolling back';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'bind') LOOP
    UPDATE catalog.business_attribute AS a SET code_list_id = list_uuid, modified_on = edited_on
      WHERE a.identifier = item->>'attribute' AND a.row_version = (item->>'revision')::bigint AND a.code_list_id IS NULL
      RETURNING to_jsonb(a) INTO STRICT raw_before;
    change_count := change_count + 1;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(proposal->'bindFields') LOOP
    UPDATE catalog.data_field AS f SET code_list_id = list_uuid, modified_on = edited_on
      WHERE f.identifier = item->>'field' AND f.row_version = (item->>'revision')::bigint AND f.code_list_id IS NULL
      RETURNING to_jsonb(f) INTO STRICT raw_before;
    change_count := change_count + 1;
  END LOOP;

  IF change_count <> (proposal->>'expectedChanges')::integer THEN
    RAISE EXCEPTION 'Unexpected record change count; rolling back';
  END IF;
  INSERT INTO catalog_private.import_batch(identifier, fingerprint) VALUES (operation_id, fingerprint);
END;
$laender$;

-- Country list and bindings: these queries also work after COMMIT and on a repeat run.
SELECT l.identifier, l.name_de, count(v.id) AS werte
FROM catalog.code_list l LEFT JOIN catalog.code_value v ON v.code_list_id = l.id
WHERE l.identifier = 'r-iso-land' GROUP BY l.identifier, l.name_de;

SELECT a.identifier, l.identifier AS referenzliste
FROM catalog.business_attribute a JOIN catalog.code_list l ON l.id = a.code_list_id
WHERE a.identifier IN ('gebaeude/land','grundstueck/land') ORDER BY a.identifier;

SELECT f.identifier, l.identifier AS referenzliste
FROM catalog.data_field f JOIN catalog.code_list l ON l.id = f.code_list_id
WHERE l.identifier = 'r-iso-land' ORDER BY f.identifier;

COMMIT;
