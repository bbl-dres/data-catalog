#!/usr/bin/env node
/**
 * One-shot enrichment: append AV GIS (amtliche Vermessung GIS) and
 * Grundbuch (cantonal land register) nodes to data/canvas.json.
 * Idempotent — re-runnable without producing duplicates.
 *
 * Sources:
 *   prototype-canvas/assets/AV_GIS.xlsx     (Datenobjekte / Datenfelder)
 *   prototype-canvas/assets/Grundbuch.xlsx  (Datenobjekte / Datenfelder)
 *
 * Both spreadsheets only document column names + responsibilities
 * (DateneignerIn / DatenverwalterIn / DatenhalterIn / DatenerfasserIn,
 * all "Extern" — external register data). Column types and keys are
 * not in the source; we mark only the obvious PKs (EGID, EGRID, EREID,
 * EGBPID, EGBTBID) and leave the rest empty for the curator to fill in.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'canvas.json');

// ---- Layout ---------------------------------------------------------
// Existing canvas spans x: -4210..3719, y: 1154..4900 (codelists). The
// two new systems land to the right in their own columns so they
// don't overlap with the SAP / BBL GIS / GWR clusters. Each node is
// 320px wide; vertical spacing 460px keeps them readable at 25% zoom.

const AV_GIS_X = 4500;
const GRUNDBUCH_X = 5500;
const ROW_Y_START = 1200;
const ROW_Y_STEP = 460;

// ---- Helpers --------------------------------------------------------

function snakeId(label) {
    return String(label)
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

function col(name, key) {
    return { name: name, type: '', key: key || '' };
}

// Column lists transcribed verbatim from the Datenfelder sheets.

// ---- AV GIS ---------------------------------------------------------

const AV_GIS_TABLES = [
    {
        label: 'AV GIS Liegenschaft',
        columns: [
            col('NBIdent'),
            col('NummerTeilGrundstück'),
            col('EGRIS_EGRID'),
            col('Vollständigkeit'),
            col('Flächenmass'),
            col('Geometrie'),
            col('GueltigerEintrag'),
            col('BFSNr')
        ]
    },
    {
        label: 'AV GIS LiegenschaftProj',
        columns: [
            col('NBIdent'),
            col('NummerTeilGrundstück'),
            col('EGRIS_EGRID'),
            col('Vollständigkeit'),
            col('Flächenmass'),
            col('Geometrie'),
            col('GueltigerEintrag'),
            col('BFSNr')
        ]
    },
    {
        label: 'AV IS Liegenschaft_Position',
        columns: [
            col('NBIdent'),
            col('NummerTeilGrundstueck'),
            col('Pos'),
            col('Ori'),
            col('HAli'),
            col('VAli'),
            col('BFSNr')
        ]
    },
    {
        label: 'AV IS LiegenschaftProj_Position',
        columns: [
            col('NBIdent'),
            col('NummerTeilGrundstueck'),
            col('Pos'),
            col('Ori'),
            col('HAli'),
            col('VAli'),
            col('BFSNr')
        ]
    },
    {
        label: 'Bodenbedeckung',
        columns: [
            col('Geometrie'),
            col('Qualität'),
            col('Art'),
            col('GWR_EGID'),
            col('GueltigerEintrag'),
            col('BFSNr')
        ]
    },
    {
        label: 'Bodenbedeckung_TextPosition',
        columns: [
            col('Number_Name'),
            col('Type'),
            col('Pos'),
            col('Ori'),
            col('HAli'),
            col('VAli'),
            col('BFSNr')
        ]
    }
];

// ---- Grundbuch ------------------------------------------------------

const GRUNDBUCH_TABLES = [
    {
        label: 'Gebäude',
        columns: [
            col('EGID', 'PK'),
            col('Flächenmass'),
            col('GebäudeartCode'),
            col('GebäudeartStichwort'),
            col('GebäudeartZusatz'),
            col('istProjektiert'),
            col('istUnterirdisch'),
            col('Nummer')
        ]
    },
    {
        label: 'GB_Grundstück',
        columns: [
            col('EGRID', 'PK'),
            col('BFSNr'),
            col('Flächenmass'),
            col('Führungsart'),
            col('istKopie'),
            col('KantonaleUnterartStichwort'),
            col('Typ')
        ]
    },
    {
        label: 'GB_Person',
        columns: [
            col('EGBPID', 'PK'),
            col('Firmennummer'),
            col('Geburtstag'),
            col('Geschlecht'),
            col('Heimatort'),
            col('Name'),
            col('Name_Firma'),
            col('Rechtsform'),
            col('RechtsformZusatz'),
            col('Sitz'),
            col('Staatsangehörigkeit'),
            col('Typ'),
            col('UID'),
            col('Vorname')
        ]
    },
    {
        label: 'Hauptbuch',
        // Datenfelder sheet lists no fields for Hauptbuch — kept as a
        // placeholder so the System frame still picks it up. Curator
        // can flesh out columns later.
        columns: []
    },
    {
        label: 'Recht',
        columns: [
            col('EREID', 'PK'),
            col('alteNummer'),
            col('Art'),
            col('ArtStichwort'),
            col('istKopie'),
            col('Typ')
        ]
    },
    {
        label: 'Tagebuch_Anmeldung',
        columns: [
            col('EGBTBID', 'PK'),
            col('Bemerkungen'),
            col('DossierNummer'),
            col('GeschäftsfallbeschreibungStichwort'),
            col('GeschäftsfallbeschreibungZusatz'),
            col('Geschäftstyp'),
            col('TagebuchDatumZeit'),
            col('TagebuchNummer')
        ]
    }
];

// ---- Build node objects --------------------------------------------

function buildSystem(tables, system, schema, tags, x) {
    return tables.map(function (t, i) {
        var id = snakeId(t.label);
        return {
            id: id,
            label: t.label,
            type: 'table',
            system: system,
            schema: schema,
            tags: tags,
            x: x,
            y: ROW_Y_START + i * ROW_Y_STEP,
            propertySets: [],
            columns: t.columns
        };
    });
}

const NEW_NODES = []
    .concat(buildSystem(AV_GIS_TABLES,    'AV GIS',    'av', ['geo', 'extern', 'register'], AV_GIS_X))
    .concat(buildSystem(GRUNDBUCH_TABLES, 'Grundbuch', 'gb', ['extern', 'register'],         GRUNDBUCH_X));

// ---- Apply ---------------------------------------------------------

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const existingIds = new Set(data.nodes.map(function (n) { return n.id; }));

let added = 0;
let skipped = 0;
NEW_NODES.forEach(function (n) {
    if (existingIds.has(n.id)) {
        skipped += 1;
        return;
    }
    data.nodes.push(n);
    added += 1;
});

if (added === 0) {
    console.log('Nothing to do — all ' + NEW_NODES.length + ' target nodes already exist.');
    process.exit(0);
}

let json = JSON.stringify(data, null, 2);
if (!json.endsWith('\n')) json += '\n';
fs.writeFileSync(FILE, json, 'utf8');

console.log('AV GIS + Grundbuch enrichment:');
console.log('  added:   ' + added + ' nodes');
console.log('  skipped: ' + skipped + ' (already present)');
console.log('  total nodes now: ' + data.nodes.length);
