#!/usr/bin/env node
/**
 * One-shot enrichment: add edges that bind Amtliche Vermessung +
 * Grundbuch into the rest of the catalog (BBL GIS, SAP RE-FX, GWR).
 * Idempotent — keyed on (from, to, label) so re-runs don't duplicate.
 *
 * Direction convention follows the existing canvas: newer / dependent
 * record → older / upstream master. So a Grundbuch entity that quotes
 * an EGID/EGRID points at the federal-register node that owns the
 * identifier (GWR / RE-FX), not the other way around.
 *
 * Sources & rationale:
 *   - Grundbuch internal model: Verordnung über das Grundbuch + eGRIS
 *     standard. Hauptbuch is the per-Grundbuchkreis container; entries
 *     enter via Tagebuch-Anmeldungen and become canonical when posted.
 *   - AV internal model: INTERLIS DM.01-AV-CH (Liegenschaft, Bodenbe-
 *     deckung, projected variants).
 *   - Cross-register links (EGID / EGRID) follow the same 1:1 pattern
 *     already used by GWR↔GIS↔RE-FX in the seed canvas.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'canvas.json');

const EDGES = [
    // ---- Within Grundbuch (eGRIS structure) ----
    { from: 'gb_grundstueck',    to: 'hauptbuch',         label: 'gehört zum Hauptbuch (Grundbuchkreis)' },
    { from: 'recht',             to: 'gb_grundstueck',    label: 'belastet Grundstück (n:m, via EGRID)' },
    { from: 'recht',             to: 'gb_person',         label: 'Berechtigter (n:m, via EGBPID)' },
    { from: 'gebaeude',          to: 'gb_grundstueck',    label: 'Gebäude steht auf Grundstück (n:1, via EGID)' },
    { from: 'tagebuch_anmeldung',to: 'hauptbuch',         label: 'Anmeldung wird im Hauptbuch eingetragen' },

    // ---- Within Amtliche Vermessung (INTERLIS DM.01-AV-CH) ----
    { from: 'av_gis_liegenschaftproj', to: 'av_gis_liegenschaft', label: 'Projekt-/geplante Version von Liegenschaft' },

    // ---- Cross-system (user-specified) ----
    { from: 'av_gis_liegenschaft', to: 'gis_grundstueck',  label: 'Quelle Polygon-Geometrie (via EGRID)' },
    { from: 'av_gis_liegenschaft', to: 'refx_grundstueck', label: 'liefert Flächenmass / Grundstücksfläche (via EGRID)' },
    { from: 'bodenbedeckung',      to: 'gis_bodenabdeckung', label: 'Quelle Bodenabdeckung (Master)' },
    { from: 'gb_grundstueck',      to: 'refx_grundstueck', label: 'Eigentum aus Grundbuch (via EGRID)' },
    { from: 'recht',               to: 'refx_grundstueck', label: 'Eigentumsdetails / Bruchteile aus Recht' },

    // ---- Cross-system (natural additions, parallel to existing GWR↔GIS↔RE-FX) ----
    { from: 'gb_grundstueck', to: 'av_gis_liegenschaft', label: 'gemeinsame Parzelle (1:1, EGRID)' },
    { from: 'gebaeude',       to: 'gwr_gebaeude',        label: 'gemeinsames Gebäude (1:1, EGID-Match)' },
    { from: 'gebaeude',       to: 'refx_gebaeude',       label: 'gemeinsames Gebäude (1:1, EGID-Match)' },

    // ---- Cross-system (speculative, column-name match) ----
    // Bodenbedeckung.GWR_EGID → GWR Gebäude. EGID is also shared with
    // GB Gebäude / RE-FX Gebäude, but the explicit column naming makes
    // the GWR link the canonical one.
    { from: 'bodenbedeckung', to: 'gwr_gebaeude', label: 'Art="Gebäude": GWR_EGID → EGID' }
];

// ---- Apply ---------------------------------------------------------

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const nodeIds = new Set(data.nodes.map(function (n) { return n.id; }));
const edgeKey = function (e) { return e.from + '|' + e.to + '|' + (e.label || ''); };
const existingKeys = new Set((data.edges || []).map(edgeKey));
const existingIds  = new Set((data.edges || []).map(function (e) { return e.id; }));

function nextId() {
    // Match the in-app generator shape (e_<ts>_<rand>) so an edge
    // added by this script is indistinguishable from one drawn in the
    // editor.
    let id;
    do {
        id = 'e_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    } while (existingIds.has(id));
    existingIds.add(id);
    return id;
}

let added = 0;
let skippedMissing = 0;
let skippedDup = 0;

EDGES.forEach(function (e) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
        console.warn('  skip — missing node: ' + e.from + ' → ' + e.to);
        skippedMissing += 1;
        return;
    }
    if (existingKeys.has(edgeKey(e))) {
        skippedDup += 1;
        return;
    }
    data.edges = data.edges || [];
    data.edges.push({
        id:    nextId(),
        from:  e.from,
        to:    e.to,
        label: e.label
    });
    existingKeys.add(edgeKey(e));
    added += 1;
});

if (added === 0) {
    console.log('Nothing to add — every target edge already present (or nodes missing).');
    process.exit(0);
}

let json = JSON.stringify(data, null, 2);
if (!json.endsWith('\n')) json += '\n';
fs.writeFileSync(FILE, json, 'utf8');

console.log('AV + Grundbuch edge enrichment:');
console.log('  added:           ' + added);
console.log('  skipped (dup):   ' + skippedDup);
console.log('  skipped (miss):  ' + skippedMissing);
console.log('  total edges now: ' + data.edges.length);
