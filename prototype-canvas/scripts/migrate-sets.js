#!/usr/bin/env node
/**
 * One-shot migration: column.set string → setId reference + global sets[]
 * registry. The SAP API node (refx_gebaeude_api) is special-cased — its
 * groupings reflect SAP BAPI substructures, not BBL data packages, so
 * those values move to a per-column `sourceStructure` field and the node
 * gets `groupBy: "sourceStructure"`. Where a substructure cleanly maps
 * to a BBL package (OBJECT_ADDRESS → address, etc.) the column also
 * gets a `setId` so the lineage view stays cross-cutting.
 *
 * Reads:  data/canvas.json
 * Writes: data/canvas.json (in place)
 *
 * Reference: previous turn's analysis — drops generic taxonomy
 * (Stammdaten, Klassifikation, Merkmale, …), consolidates over-fragmented
 * groups (Flächen/Volumen/Geschosse → dimensions; Schutz-variants →
 * safety_risk; Heizung/Warmwasser/Energie → energy), promotes
 * single-node sets to first-class registry entries.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'canvas.json');

// ---- Canonical set registry ---------------------------------------------
const SETS = [
    {
        id: 'address',
        label: 'Adresse',
        description: 'Strukturadresse, Geokoordinaten und administrative Zuordnung.',
        lineage: 'Adressdienst (kantonale Verzeichnisse + GWR). Folgt eCH-0010 (Postadresse), eCH-0129 (Gebäudeadresse) und der Adressierungsverordnung SR 510.625.'
    },
    {
        id: 'ownership',
        label: 'Eigentum',
        description: 'Eigentums- und Nutzungsrechte am Objekt.',
        lineage: 'Grundbuch und kantonale Register'
    },
    {
        id: 'valuation',
        label: 'Bewertung',
        description: 'Verkehrswert, Versicherungswert, Buchwert und zugehörige Kennzahlen.',
        lineage: 'BBL-Bewertung und externe Schätzungen'
    },
    {
        id: 'dimensions',
        label: 'Bemessung',
        description: 'Flächen, Volumen, Geschosszahl und vergleichbare geometrische Kennzahlen.',
        lineage: 'Geometrische Vermessung / GIS'
    },
    {
        id: 'resubmission',
        label: 'Wiedervorlage',
        description: 'Termine und Regeln für wiederkehrende fachliche Prüfungen.',
        lineage: 'BBL-internes Workflow-Management'
    },
    {
        id: 'plant_assignment',
        label: 'Anlagenzuordnung',
        description: 'Zuordnung zu organisatorischen oder technischen Anlagen.',
        lineage: 'BBL-Anlagenstruktur'
    },
    {
        id: 'architecture',
        label: 'Architektur',
        description: 'Strukturelle Architekturverknüpfungen zwischen Objekten.',
        lineage: 'BBL-Architekturmodell'
    },
    {
        id: 'business_partner',
        label: 'Geschäftspartner',
        description: 'Verknüpfung zu Personen, Firmen und Rollen.',
        lineage: 'Partner-Stamm'
    },
    {
        id: 'timestamps',
        label: 'Zeitpunkte',
        description: 'Audit- und Lifecycle-Zeitstempel (erstellt, geändert, gültig-ab, …).',
        lineage: 'Erfassungssystem-immanent'
    },
    {
        id: 'safety_risk',
        label: 'Schutz und Gefahren',
        description: 'Schutzkennzeichen, Risikoklassen und Sicherheitsangaben.',
        lineage: 'Gefahrenkataster und BBL-Risikomanagement'
    },
    {
        id: 'energy',
        label: 'Energie',
        description: 'Energieträger, Heizung, Warmwasser und Verbrauchskennzahlen.',
        lineage: 'BFE, kantonale Energiedatenbanken und Eigenmessung'
    },
    {
        id: 'speedikon_legacy',
        label: 'Speedikon (Legacy)',
        description: 'Felder, die aus dem abgelösten Speedikon-System migriert wurden.',
        lineage: 'Migration aus Speedikon (Stand 2018)'
    },
    {
        id: 'usage',
        label: 'Nutzung',
        description: 'Nutzungsart und -kategorisierung.',
        lineage: 'BBL-Nutzungskatalog'
    },

    // Single-node sets promoted to first-class registry entries — once
    // the registry exists, the marginal cost of an entry is one row.
    { id: 'client',             label: 'Auftraggeber',                description: 'Auftraggebende Stelle eines Bauprojekts.' },
    { id: 'building_structure', label: 'Bauwerk',                     description: 'Bauwerk-spezifische Beschreibungen im Projektkontext.' },
    { id: 'project',            label: 'Projekt',                     description: 'Projekt-spezifische Metadaten (Phase, Status, Verantwortung).' },
    { id: 'occupancy',          label: 'Belegung',                    description: 'Belegung von Wohn- und Nutzungseinheiten.' },
    { id: 'furnishings',        label: 'Möblierung',                  description: 'Mobile und feste Möblierung von Räumen und Einheiten.' },
    { id: 'cleaning',           label: 'Reinigung',                   description: 'Reinigungs- und Unterhaltsangaben.' },
    { id: 'workspaces',         label: 'Arbeitsplätze',               description: 'Anzahl und Klassifizierung von Arbeitsplätzen.' },
    { id: 'local_codes',        label: 'Lokalcodes',                  description: 'Lokal- und Raumcodes (Raumnummer, Geschoss, Lage).' },
    { id: 'pollutants',         label: 'Schadstoffe',                 description: 'Schadstoffbelastung und zugehörige Untersuchungen.' },
    { id: 'master_units',       label: 'Stammeinheiten',              description: 'Untergeordnete Stammeinheiten der Wirtschaftseinheit.' },
    { id: 'construction_data',  label: 'Baudaten',                    description: 'Bauliche Stammdaten (Baujahr, Bauart, Konstruktion).' },
    { id: 'extensions',         label: 'Umbauten und Erweiterungen',  description: 'Historie von Umbauten, Sanierungen und Erweiterungen.' },
    { id: 'building_reference', label: 'Bezug zum Gebäude',           description: 'Verknüpfung von Grundstücks-Daten zum übergeordneten Gebäude.' },
    { id: 'parcel_reference',   label: 'Bezug zum Grundstück',        description: 'Verknüpfung von Gebäude-Daten zum übergeordneten Grundstück.' }
];

// ---- Rename / consolidation map (legacy string → setId | null) ----------
// `null` means "drop the set, column becomes ungrouped" — the engineer's
// principle: not every attribute needs a set.
const RENAME = {
    // -- Drop (generic taxonomy that adds no information) --
    'Stammdaten': null,
    'Klassifikation': null,
    'Merkmale': null,
    'Technisch': null,
    'Bauliches': null,
    'Freitext': null,
    'Bezeichnung': null,
    'Beschreibung': null,
    'Ausstattung': null,
    'Ausstattung und Infrastruktur': null,
    'Geometrie': null,
    'Kosten': null,
    // "Organisation" lumps SAP CO dimensions (Geschäftsbereich, Profitcenter)
    // with business-partner relationship fields (Rollenart, Beginn/Ende
    // Beziehung) — two different concepts under one label. Drop it; the
    // columns can later be reassigned individually if needed.
    'Organisation': null,

    // -- Direct rename --
    'Adresse und Verortung': 'address',
    'Eigentum': 'ownership',
    'Bewertung': 'valuation',
    'Wiedervorlage': 'resubmission',
    'Anlagenzuordnung': 'plant_assignment',
    'Architektur': 'architecture',
    'Geschäftspartner': 'business_partner',
    'Zeitpunkte': 'timestamps',
    'Speedikon (Legacy)': 'speedikon_legacy',
    'Nutzung': 'usage',
    'Auftraggeber': 'client',
    'Bauwerk': 'building_structure',
    'Projekt': 'project',
    'Belegung': 'occupancy',
    'Möblierung': 'furnishings',
    'Reinigung': 'cleaning',
    'Arbeitsplätze': 'workspaces',
    'Lokalcodes': 'local_codes',
    'Schadstoffe': 'pollutants',
    'Stammeinheiten': 'master_units',
    'Baudaten': 'construction_data',
    'Umbauten und Erweiterungen': 'extensions',
    'Bezug zum Gebäude': 'building_reference',
    'Bezug zum Grundstück': 'parcel_reference',

    // -- Consolidate (over-fragmented groups → one canonical set) --
    'Bemessung': 'dimensions',
    'Flächen': 'dimensions',
    'Volumen': 'dimensions',
    'Geschosse': 'dimensions',
    'Flächen und Volumen': 'dimensions',

    'Schutz und Gefahren': 'safety_risk',
    'Schutz und Kennzeichen': 'safety_risk',
    'Gefährdung und Sicherheit': 'safety_risk',

    'Heizung': 'energy',
    'Warmwasser': 'energy',
    'Energie': 'energy'
};

// ---- SAP API node (refx_gebaeude_api) special-case mapping --------------
// The 22 BAPI substructure groupings are NOT global sets — they're the
// SAP RE-FX source contract. Each becomes a `sourceStructure` value on
// the column; some also carry a setId where the substructure cleanly
// maps to a BBL package (so cross-cutting lineage queries still work).
//
// Format of the raw string in the source: "<KEY> (<German label>)"
// e.g. "BUILDING (Gebäudedaten)" → key BUILDING, label "Gebäudedaten".
const API_NODE_ID = 'refx_gebaeude_api';

// Substructures that map to a BBL package. Anything not listed here gets
// `sourceStructure` set but no `setId`.
const SAP_TO_BBL_SET = {
    OBJECT_ADDRESS: 'address',
    ARCH_REL: 'architecture',
    ARCH_RELMS: 'architecture',
    MEASUREMENT: 'dimensions',
    OBJ_ASSIGN: 'plant_assignment',
    TERM_ORG_ASSIGNMENT: 'plant_assignment',
    RESUBM_DATE: 'resubmission',
    RESUBM_RULE: 'resubmission',
    PARTNER: 'business_partner'
};

// Parses "BUILDING (Gebäudedaten)" → { key: 'BUILDING', label: 'Gebäudedaten' }
function parseSapSetString(s) {
    const m = /^([A-Z0-9_]+)\s*\(([^)]+)\)\s*$/.exec(s);
    if (!m) return { key: s, label: '' };
    return { key: m[1], label: m[2] };
}

// ---- Run ---------------------------------------------------------------
function main() {
    const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

    const knownSetIds = new Set(SETS.map(s => s.id));
    const seenLegacy = new Set();
    const dropped = new Map();   // setName → cols affected
    const renamed = new Map();   // setName → cols affected
    const sapSubs = new Map();   // sapKey → label

    let bblColsTouched = 0;
    let apiColsTouched = 0;
    const orphans = [];

    for (const node of data.nodes) {
        const isApi = node.id === API_NODE_ID;
        if (isApi) node.groupBy = 'sourceStructure';

        for (const col of (node.columns || [])) {
            const legacy = col.set;
            if (!legacy) continue;
            seenLegacy.add(legacy);

            if (isApi) {
                const { key, label } = parseSapSetString(legacy);
                col.sourceStructure = key;
                if (label) sapSubs.set(key, label);
                const bblId = SAP_TO_BBL_SET[key];
                if (bblId) col.setId = bblId;
                delete col.set;
                apiColsTouched += 1;
                continue;
            }

            // BBL node — apply RENAME map.
            if (legacy in RENAME) {
                const target = RENAME[legacy];
                if (target == null) {
                    // Drop: column becomes ungrouped.
                    dropped.set(legacy, (dropped.get(legacy) || 0) + 1);
                } else {
                    if (!knownSetIds.has(target)) {
                        orphans.push({ node: node.id, col: col.name, legacy, mappedTo: target });
                    }
                    col.setId = target;
                    renamed.set(legacy, (renamed.get(legacy) || 0) + 1);
                }
            } else {
                // Legacy value not in the map — keep as a free string for
                // visibility; surface as orphan so we notice.
                orphans.push({ node: node.id, col: col.name, legacy, mappedTo: '(no mapping)' });
            }
            delete col.set;
            bblColsTouched += 1;
        }
    }

    // Inject the registry at the top of the document, right above nodes.
    const out = {
        version: 2,
        sets: SETS,
        nodes: data.nodes,
        edges: data.edges
    };
    // Preserve any other top-level keys (defensive).
    for (const k of Object.keys(data)) {
        if (k !== 'nodes' && k !== 'edges' && k !== 'sets' && k !== 'version') {
            out[k] = data[k];
        }
    }

    // Attach the SAP substructure registry to the API node so renderers
    // can show German labels next to the SAP keys when grouping by
    // sourceStructure. Keeps it scoped — this is per-node metadata.
    const apiNode = out.nodes.find(n => n.id === API_NODE_ID);
    if (apiNode) {
        apiNode.sourceStructures = [...sapSubs.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([id, label]) => ({ id, label }));
    }

    fs.writeFileSync(SRC, JSON.stringify(out, null, 2) + '\n', 'utf8');

    // ---- Report ----
    console.log('Migration complete.\n');
    console.log('Sets registry:        ', SETS.length, 'entries');
    console.log('SAP substructures:    ', sapSubs.size, 'entries (on', API_NODE_ID + ')');
    console.log('BBL columns rewritten:', bblColsTouched);
    console.log('API columns rewritten:', apiColsTouched);
    console.log('Distinct legacy strings seen:', seenLegacy.size);
    console.log();
    console.log('Renamed (legacy → setId):');
    [...renamed.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
        console.log('  ' + k.padEnd(34) + ' (' + n + ' cols)  → ' + RENAME[k]);
    });
    console.log();
    console.log('Dropped (became ungrouped):');
    [...dropped.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
        console.log('  ' + k.padEnd(34) + ' (' + n + ' cols)');
    });
    if (orphans.length) {
        console.log();
        console.log('Orphans (no rule matched — left as free string for review):');
        orphans.slice(0, 50).forEach(o => {
            console.log('  ' + o.node + ' :: ' + o.col + ' = "' + o.legacy + '" → ' + o.mappedTo);
        });
        if (orphans.length > 50) console.log('  … and', orphans.length - 50, 'more');
    }
}

main();
