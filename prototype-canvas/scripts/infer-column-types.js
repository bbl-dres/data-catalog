#!/usr/bin/env node
/**
 * One-shot enrichment: educated guesses for `column.type` across
 * data/canvas.json. Idempotent — safe to re-run.
 *
 * Two passes per column:
 *   1. NORMALIZE — map any pre-existing type (SAP-native CHAR(45) /
 *      NUMC(3) / DATS(8) / DEC(23) / etc., legacy "decimal" / "text" /
 *      "datetime" from earlier runs) into the project's simplified
 *      vocabulary. Unknown values pass through untouched.
 *   2. INFER — if the column ends up with an empty type after
 *      normalization, run heuristic name matching.
 *
 * Project vocabulary (kept deliberately small):
 *   string    — short text, names, identifiers, codes, status enums
 *   double    — floats, areas, volumes, money, coordinates, quantities
 *   integer   — whole numbers, years, counts, BFS-Nr
 *   boolean   — ja/nein, ist*, hat*, *vorhanden, *kennzeichen
 *   date      — calendar date or date+time (one type for both —
 *               the catalog isn't tracking that distinction)
 *   geometry  — Polygon / Punkt / Linien-Geometrie
 *
 * Codelist nodes are skipped — their `column.type` slot stores the
 * human-readable label (e.g. "Gebäude mit ausschliesslicher Wohn-
 * nutzung"), not a data type.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'canvas.json');

// ---- Normalization map -------------------------------------------------
// SAP RE-FX BAPI metadata exposes ABAP data types like CHAR(45), NUMC(3),
// DATS(8), DEC(23) etc. Earlier inference passes also emitted "decimal"
// and "text". Normalize all of those into the simplified vocabulary so
// the catalog reads consistently.

function normalizeType(raw) {
    if (raw == null) return '';
    var t = String(raw).trim();
    if (!t) return '';

    // Already canonical — return as-is.
    if (/^(string|double|integer|boolean|date|geometry)$/.test(t)) return t;

    // Legacy / synonym mappings from earlier inference runs.
    if (t === 'decimal')  return 'double';
    if (t === 'text')     return 'string';
    if (t === 'datetime') return 'date';

    // SAP ABAP / DDIC type codes — extract the head and map.
    // CHAR(n)   → string
    // NUMC(n)   → integer (numeric-character; semantically a count)
    // DEC(n)    → double  (packed decimal)
    // DATS(n)   → date
    // TIMS(n)   → string  (time-of-day; we don't have a `time` type)
    // CLNT(n)   → string  (mandant / client)
    // LANG(n)   → string  (language key)
    // QUAN(n)   → double  (quantity)
    // CURR(n)   → double  (currency)
    // UNIT(n)   → string  (UoM key)
    // CUKY(n)   → string  (currency key)
    // INT1/INT2/INT4 → integer
    var head = (t.split('(')[0] || '').toUpperCase();
    switch (head) {
        case 'CHAR': case 'CLNT': case 'LANG': case 'UNIT':
        case 'CUKY': case 'TIMS': case 'STRG': case 'STR':
            return 'string';
        case 'NUMC':
            return 'integer';
        case 'INT1': case 'INT2': case 'INT4': case 'INT': case 'INT8':
            return 'integer';
        case 'DEC': case 'QUAN': case 'CURR': case 'FLTP':
            return 'double';
        case 'DATS':
            return 'date';
    }

    // Bad data: a column had `type: "Ja"` (a German "yes" value leaked
    // in as a type). Treat as string.
    if (/^(ja|nein|true|false)$/i.test(t)) return 'string';

    // Unknown — leave alone so we don't lose information silently.
    return t;
}

// ---- Inference rules (only applied when type is empty post-normalize) --
// Order matters: first match wins.

var rx = function (pattern, flags) { return new RegExp(pattern, flags || 'i'); };

var RULES = [
    // Geometry — explicit
    { type: 'geometry', test: rx('^(geometrie|strassengeometrie)$') },

    // Boolean — INTERLIS-style flags appearing in AV / Grundbuch
    { type: 'boolean',  test: rx('^vollständigkeit$|^gueltigereintrag$|^gültigereintrag$') },
    { type: 'boolean',  test: rx('^ist[A-ZÄÖÜ]') },
    { type: 'boolean',  test: rx('vorhanden') },
    { type: 'boolean',  test: rx('^has_') },
    { type: 'boolean',  test: rx('\\?$') },
    { type: 'boolean',  test: rx('^kennzeichen ') },
    { type: 'boolean',  test: rx('^obsolet$') },
    { type: 'boolean',  test: rx('^im speedikon$') },
    { type: 'boolean',  test: rx('^abgleich ') },
    { type: 'boolean',  test: rx('zuordnungsbezogen|zutreffend') },
    { type: 'boolean',  test: rx('^mehrgeschossige ') },
    { type: 'boolean',  test: rx('beilage zum bauprojekt') },

    // Dates — *datum*, geburtstag, valid_from/to, datum von/bis
    // (no separate datetime: kept simple — both collapse to `date`)
    { type: 'date',     test: rx('datumzeit|tagebuchdatum') },
    { type: 'date',     test: rx('etl[ _]?zeitstempel') },
    { type: 'date',     test: rx('^datum( |_|$)') },
    { type: 'date',     test: rx(' datum( |$)') },
    { type: 'date',     test: rx('^geburtstag$') },
    { type: 'date',     test: rx('aktualisierungsdatum|schätzdatum') },
    { type: 'date',     test: rx('asvald?ate|valid[ _]?(from|to)') },
    { type: 'date',     test: rx('^datum (von|bis|der|baubeginn|bauende|baueingabe|baubewilligung|sisitierung|nichtrealisierung|rückzug|ablehnung|photodokumentation|sicherheitskonzept|baueing|kg)') },
    { type: 'date',     test: rx('letzte[rs]? meldung|letzter bericht|letzte massnahme|letzte belegung|erste belegung') },
    { type: 'date',     test: rx('beginn beziehung|ende beziehung') },
    { type: 'date',     test: rx('zuordnung (ab|bis)') },
    { type: 'date',     test: rx('^datum von_?\\d*$|^datum bis_?\\d*$') },
    { type: 'date',     test: rx('gültig (ab|bis)') },
    { type: 'date',     test: rx('bemessung gültig') },

    // Year-as-integer
    { type: 'integer',  test: rx('jahr$|^baujahr|^abbruchjahr|^verkaufsjahr|^umbaujahr|construction_year|^baumonat$') },
    { type: 'integer',  test: rx('^bauperiode$') },

    // Federal / cantonal IDs — string (CHE-/CH-prefixed values, mixed alpha)
    { type: 'string',   test: rx('^(egid|egrid|egbpid|egbtbid|ereid|eproid|esid|edid|estat|estnr|gdenr|egaid|ewid|esid_dplz4)') },
    { type: 'string',   test: rx('^egid[+ _]ewid|egid_eproid|egid\\+edid') },
    { type: 'string',   test: rx('^uid$|^uid_|^iban$') },
    { type: 'string',   test: rx('egris[ _]?egrid') },

    // Counts / numbers (integer)
    { type: 'integer',  test: rx('^anzahl ') },
    { type: 'integer',  test: rx('^bfsnr$|^bfs[ -]?nummer$|gemeinde[nr]*nummer|gemeinde[nr]*$') },
    { type: 'integer',  test: rx('^postleitzahl$|^plz') },
    { type: 'integer',  test: rx('^stockwerk$') },
    { type: 'integer',  test: rx('^anz\\. parkplatz') },
    { type: 'integer',  test: rx('^geschosse ') },
    { type: 'integer',  test: rx('^ap (ist|soll|reserve|makro)') },

    // Coordinates / measurements / areas / volumes — double
    { type: 'double',   test: rx('^lv95 |^wgs84 |^pos$|^ori$|^hali$|^vali$') },
    { type: 'double',   test: rx('koordinate|gebäudekoordinate|eingangskoordinate') },
    { type: 'double',   test: rx('^egm höhe$|^höhe$|hoehe$') },
    { type: 'double',   test: rx('^flächenmass$|fläche$|fläche_|^flaeche|fläche\\b') },
    { type: 'double',   test: rx('volumen|^gv\\b') },
    { type: 'double',   test: rx('^anteil|anteil %$|anteil$') },
    { type: 'double',   test: rx('^umrechnungsfaktor') },
    { type: 'double',   test: rx('^bemessung|^bemessungs') },
    { type: 'double',   test: rx('^mj/m2 ebf$|^total gewichtet') },
    { type: 'double',   test: rx('wert$|kosten|preis|amount|price') },

    // Catch-all string fall-throughs
    { type: 'string',   test: rx('^bemerkung|bemerkungen$|^bemerkung_|^bem(erkung)?_?\\d*$') },
    { type: 'string',   test: rx('^notiz|^beschreibung|^kommentar|^freitextfeld') },
    { type: 'string',   test: rx('^memo|^message|address_text') },
    { type: 'string',   test: rx('umschreibung bauprojekt') },
    { type: 'string',   test: rx('^übersichtsliste|^inventarliste') },
    { type: 'string',   test: rx('^status\\b') },
    { type: 'string',   test: rx('^typ\\b|^art\\b|kategorie$|klasse$') },
    { type: 'string',   test: rx('^geschlecht$|^rechtsform') },
    { type: 'string',   test: rx('name|bezeichnung|stichwort|zusatz|adresse|strasse|ort|region|land|sitz|heimatort') },
    { type: 'string',   test: rx('mietmodell|portfolio|merkmal|sprache|währung|currency') }
];

var FALLBACK_TYPE = 'string';

// ---- Authoritative overrides ------------------------------------------
// Force a specific type regardless of what's currently stored. Use only
// when the convention is unambiguous and prior runs may have set it
// wrong (the inference's "only fill empty types" policy means we'd
// otherwise be stuck with stale values from earlier passes).
//
// Keyed on lowercased column name.

var FORCE_TYPE = {
    // INTERLIS DM.01-AV-CH flags — boolean per the model definition.
    'vollständigkeit':  'boolean',
    'gueltigereintrag': 'boolean',
    'gültigereintrag':  'boolean'
};

function inferType(name) {
    if (!name) return null;
    var trimmed = String(name).trim();
    for (var i = 0; i < RULES.length; i++) {
        if (RULES[i].test.test(trimmed)) return RULES[i].type;
    }
    return FALLBACK_TYPE;
}

// ---- Apply -------------------------------------------------------------

var data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

var normalized = 0;
var inferred   = 0;
var forced     = 0;
var unchanged  = 0;
var codelistSkip = 0;
var unknownLeftover = {}; // type → count, for inspection

data.nodes.forEach(function (n) {
    if (!Array.isArray(n.columns) || n.columns.length === 0) return;
    if (n.type === 'codelist') {
        codelistSkip += n.columns.length;
        return;
    }
    n.columns.forEach(function (c) {
        var before = c.type || '';
        var after  = normalizeType(before);

        if (after !== before) {
            c.type = after;
            normalized += 1;
        }
        if (!c.type) {
            var t = inferType(c.name);
            if (t) {
                c.type = t;
                inferred += 1;
            }
        } else if (after === before) {
            unchanged += 1;
        }

        // Authoritative overrides for known unambiguous names.
        var forceKey = String(c.name || '').toLowerCase();
        if (FORCE_TYPE[forceKey] && c.type !== FORCE_TYPE[forceKey]) {
            c.type = FORCE_TYPE[forceKey];
            forced += 1;
        }

        // Track anything that escaped the canonical vocabulary so we
        // can tighten the normaliser if needed.
        if (c.type && !/^(string|double|integer|boolean|date|geometry)$/.test(c.type)) {
            unknownLeftover[c.type] = (unknownLeftover[c.type] || 0) + 1;
        }
    });
});

var json = JSON.stringify(data, null, 2);
if (!json.endsWith('\n')) json += '\n';
fs.writeFileSync(FILE, json, 'utf8');

console.log('Type pass:');
console.log('  normalized:        ' + normalized);
console.log('  inferred (empty):  ' + inferred);
console.log('  forced (override): ' + forced);
console.log('  already canonical: ' + unchanged);
console.log('  codelist skipped:  ' + codelistSkip);

var leftover = Object.keys(unknownLeftover);
if (leftover.length) {
    console.log('\n  ⚠ types outside canonical vocabulary still present:');
    leftover.sort().forEach(function (t) {
        console.log('    ' + t + '  (' + unknownLeftover[t] + ' occurrences)');
    });
} else {
    console.log('\n  ✓ all column types are now in the canonical vocabulary');
}
