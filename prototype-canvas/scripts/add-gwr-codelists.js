#!/usr/bin/env node
/**
 * One-shot enrichment: append example GWR codelist nodes (Wertelisten)
 * to data/canvas.json plus FK-style edges from the gwr_* tables that
 * reference them. Idempotent — re-runnable without producing duplicates.
 *
 * Source: BFS GWR Merkmalskatalog v4.3 (final). The xlsx in
 * assets/GWR.xlsx is a structural metadata document and does NOT carry
 * the actual code values, so the values below are transcribed from the
 * official BFS catalog at https://www.housing-stat.ch/catalog/de/4.3/final
 *
 * Convention used for codelist columns (matches how the canvas renders
 * `type=codelist` nodes — the table-tab even renames the count column
 * "Codes"):
 *   col.name → the code itself (e.g. "1010")
 *   col.type → the human label (e.g. "Gebäude mit ausschliesslicher Wohnnutzung")
 *
 * That way the canvas's two-line `name | type` row layout reads as
 * `code | description`, no schema overload required.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'data', 'canvas.json');

// Common shape: each codelist has id, label, code/label rows, plus some
// edges from gwr_gebaeude / gwr_wohnung that reference it.
//
// Layout: place the codelists in a row at y=4900, x stepping by ~500.
// Existing GWR nodes occupy y 2895–4433.
const BASE_Y = 4900;
const STEP_X = 500;
const X0 = -4100;

// Helper: build the columns array from [code, label] tuples.
function rows(pairs) {
    return pairs.map(function (p) {
        return { name: String(p[0]), type: p[1], key: '' };
    });
}

const CODELISTS = [
    {
        id: 'gwr_gkat',
        label: 'GKAT — Gebäudekategorie',
        rows: rows([
            ['1010', 'Gebäude mit ausschliesslicher Wohnnutzung'],
            ['1020', 'Andere Wohngebäude (Wohngebäude mit Nebennutzung)'],
            ['1030', 'Gebäude mit teilweiser Wohnnutzung'],
            ['1040', 'Gebäude ohne Wohnnutzung'],
            ['1060', 'Sonderbauten']
        ]),
        tags: ['codelist', 'gwr', 'gebäude']
    },
    {
        id: 'gwr_gklas',
        label: 'GKLAS — Gebäudeklasse',
        rows: rows([
            ['1110', 'Gebäude mit einer Wohnung'],
            ['1121', 'Gebäude mit zwei Wohnungen'],
            ['1122', 'Gebäude mit drei oder mehr Wohnungen'],
            ['1130', 'Wohngebäude für Gemeinschaften'],
            ['1211', 'Hotelgebäude'],
            ['1212', 'Andere Gebäude für die kurzfristige Beherbergung'],
            ['1220', 'Bürogebäude'],
            ['1230', 'Gross- und Einzelhandelsgebäude'],
            ['1241', 'Gebäude des Verkehrs- und Nachrichtenwesens'],
            ['1242', 'Garagengebäude'],
            ['1251', 'Industriegebäude'],
            ['1252', 'Behälter, Silos und Lagergebäude'],
            ['1261', 'Gebäude für Kultur- und Freizeitzwecke'],
            ['1262', 'Museen und Bibliotheken'],
            ['1263', 'Schul- und Hochschulgebäude, Forschungseinrichtungen'],
            ['1264', 'Krankenhäuser und Facheinrichtungen des Gesundheitswesens'],
            ['1265', 'Sporthallen'],
            ['1271', 'Landwirtschaftliche Betriebsgebäude'],
            ['1272', 'Kirchen und sonstige Kult-/Andachtsstätten'],
            ['1273', 'Denkmäler oder unter Schutz gestellte Bauwerke'],
            ['1274', 'Sonstige Hochbauten, anderweitig nicht genannt'],
            ['1275', 'Sonstige Hochbauten für Wohnzwecke']
        ]),
        tags: ['codelist', 'gwr', 'gebäude']
    },
    {
        id: 'gwr_gstat',
        label: 'GSTAT — Gebäudestatus',
        rows: rows([
            ['1001', 'Projektiert'],
            ['1002', 'Bewilligt'],
            ['1003', 'Im Bau'],
            ['1004', 'Bestehend'],
            ['1005', 'Nicht nutzbar'],
            ['1007', 'Abgebrochen'],
            ['1008', 'Nicht realisiert']
        ]),
        tags: ['codelist', 'gwr', 'lifecycle']
    },
    {
        id: 'gwr_gbaup',
        label: 'GBAUP — Bauperiode',
        rows: rows([
            ['8011', 'Vor 1919'],
            ['8012', '1919–1945'],
            ['8013', '1946–1960'],
            ['8014', '1961–1970'],
            ['8015', '1971–1980'],
            ['8016', '1981–1985'],
            ['8017', '1986–1990'],
            ['8018', '1991–1995'],
            ['8019', '1996–2000'],
            ['8020', '2001–2005'],
            ['8021', '2006–2010'],
            ['8022', '2011–2015'],
            ['8023', 'Nach 2015']
        ]),
        tags: ['codelist', 'gwr', 'gebäude']
    },
    {
        id: 'gwr_gheiz',
        label: 'GHEIZ — Heizungsart',
        rows: rows([
            ['7400', 'Keine'],
            ['7410', 'Einzelraumheizung'],
            ['7420', 'Etagenheizung'],
            ['7430', 'Zentralheizung für ein Gebäude'],
            ['7431', 'Zentralheizung für mehrere Gebäude'],
            ['7440', 'Wärmepumpe für ein Gebäude'],
            ['7441', 'Wärmepumpe für mehrere Gebäude'],
            ['7450', 'Andere']
        ]),
        tags: ['codelist', 'gwr', 'energie']
    },
    {
        id: 'gwr_genh',
        label: 'GENH1 — Energieträger Heizung',
        rows: rows([
            ['7500', 'Heizöl'],
            ['7501', 'Kohle'],
            ['7510', 'Gas'],
            ['7511', 'Holz'],
            ['7512', 'Wärmepumpe'],
            ['7513', 'Sonnenkollektor'],
            ['7520', 'Elektrizität'],
            ['7530', 'Fernwärme'],
            ['7540', 'Andere'],
            ['7560', 'Keiner']
        ]),
        tags: ['codelist', 'gwr', 'energie']
    },
    {
        id: 'gwr_wstat',
        label: 'WSTAT — Wohnungsstatus',
        rows: rows([
            ['3001', 'Projektiert'],
            ['3002', 'Bewilligt'],
            ['3003', 'Im Bau'],
            ['3004', 'Bestehend'],
            ['3007', 'Abgebrochen'],
            ['3008', 'Nicht realisiert']
        ]),
        tags: ['codelist', 'gwr', 'lifecycle']
    },
    {
        id: 'gwr_wkche',
        label: 'WKCHE — Kocheinrichtung',
        rows: rows([
            ['3030', 'Kocheinrichtung'],
            ['3031', 'Keine Kocheinrichtung']
        ]),
        tags: ['codelist', 'gwr', 'wohnung']
    }
];

// FK-style edges showing which fields on the GWR tables reference each
// codelist. Edge labels carry the field name so the diagram reads as a
// lineage map.
const EDGES = [
    { from: 'gwr_gebaeude', to: 'gwr_gkat',  label: 'Gebäudekategorie' },
    { from: 'gwr_gebaeude', to: 'gwr_gklas', label: 'Gebäudeklasse' },
    { from: 'gwr_gebaeude', to: 'gwr_gstat', label: 'Gebäudestatus' },
    { from: 'gwr_gebaeude', to: 'gwr_gbaup', label: 'Bauperiode' },
    { from: 'gwr_gebaeude', to: 'gwr_gheiz', label: 'Heizungsart' },
    { from: 'gwr_gebaeude', to: 'gwr_genh',  label: 'Energieträger Heizung' },
    { from: 'gwr_wohnung',  to: 'gwr_wstat', label: 'Wohnungsstatus' },
    { from: 'gwr_wohnung',  to: 'gwr_wkche', label: 'Kocheinrichtung' }
];

function main() {
    const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    const existingIds = new Set(data.nodes.map(n => n.id));

    let nodesAdded = 0;
    CODELISTS.forEach((cl, i) => {
        if (existingIds.has(cl.id)) {
            console.log('skip (exists):', cl.id);
            return;
        }
        data.nodes.push({
            id: cl.id,
            label: cl.label,
            type: 'codelist',
            system: 'BFS GWR',
            schema: '',
            tags: cl.tags || [],
            x: X0 + i * STEP_X,
            y: BASE_Y,
            columns: cl.rows
        });
        existingIds.add(cl.id);
        nodesAdded += 1;
    });

    const existingEdgeKey = new Set(
        data.edges.map(e => e.from + '→' + e.to + ':' + (e.label || ''))
    );
    let edgesAdded = 0;
    EDGES.forEach((e, i) => {
        if (!existingIds.has(e.to)) return; // codelist target wasn't added (skipped)
        const key = e.from + '→' + e.to + ':' + (e.label || '');
        if (existingEdgeKey.has(key)) return;
        data.edges.push({
            id: 'e_gwr_cl_' + i,
            from: e.from,
            to: e.to,
            label: e.label
        });
        existingEdgeKey.add(key);
        edgesAdded += 1;
    });

    fs.writeFileSync(SRC, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log('Done.', nodesAdded, 'codelist nodes added,', edgesAdded, 'edges added.');
    console.log('Total nodes:', data.nodes.length, '· Total edges:', data.edges.length);
}

main();
