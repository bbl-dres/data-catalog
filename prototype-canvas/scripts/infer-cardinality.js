#!/usr/bin/env node
/**
 * One-shot enrichment: infer Crow's Foot cardinality on existing edges
 * from patterns in their labels (e.g. "(n:1, via EGID)" → from='many',
 * to='one'). Idempotent — only fills empty fromCardinality / toCardinality;
 * pre-set values are preserved.
 *
 * Vocabulary stored on each edge:
 *   one        — exactly one
 *   zero-one   — zero or one (optional)
 *   many       — one or more
 *   zero-many  — zero or more
 *   null       — no marker (default for edges without inferable patterns)
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'canvas.json');

// Map a single side token to the canonical kind.
function tokenToKind(tok) {
    var t = String(tok).trim().toLowerCase();
    if (!t) return null;
    // Direct words
    if (t === 'n' || t === 'm' || t === '*' || t === 'many') return 'many';
    if (t === '1' || t === 'one') return 'one';
    // 0..1 / 0..n / 0..*
    var mZeroN = t.match(/^0\s*\.\.\s*([1n*m])$/);
    if (mZeroN) return mZeroN[1] === '1' ? 'zero-one' : 'zero-many';
    // 1..* / 1..n / 1..m
    if (/^1\s*\.\.\s*[*nm]$/.test(t)) return 'many';
    // *..* / n..m
    if (/^[*nm]\s*\.\.\s*[*nm]$/.test(t)) return 'many';
    // Bare 0 → zero-many (rare but seen)
    if (t === '0') return 'zero-many';
    return null;
}

// Find an "(X:Y, ...)" or "(X..Y, ...)" pattern anywhere in the label.
// Returns { from, to } kinds or null.
function inferFromLabel(label) {
    if (!label) return null;

    // "(1:1)" / "(n:1)" / "(n:m)" / "(0..1:n)" — colon-separated.
    var mColon = label.match(/[(\[]\s*([0-9*nNmM]+(?:\s*\.\.\s*[0-9*nNmM]+)?)\s*[:×x]\s*([0-9*nNmM]+(?:\s*\.\.\s*[0-9*nNmM]+)?)\s*[,)\]]/);
    if (mColon) {
        var from = tokenToKind(mColon[1]);
        var to   = tokenToKind(mColon[2]);
        if (from || to) return { from: from, to: to };
    }

    // Loose forms like "1:1" anywhere in the label (no parens). Less
    // safe — only trigger on a strict colon-flanked pair to avoid
    // false positives like time stamps.
    var mLoose = label.match(/(?:^|[^a-z0-9])([0-9*nNmM])\s*:\s*([0-9*nNmM])(?:[^a-z0-9]|$)/);
    if (mLoose) {
        var f2 = tokenToKind(mLoose[1]);
        var t2 = tokenToKind(mLoose[2]);
        if (f2 || t2) return { from: f2, to: t2 };
    }

    return null;
}

// ---- Apply -------------------------------------------------------------

var data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

var inferred = 0;
var alreadySet = 0;
var noPattern  = 0;
var samples = [];

(data.edges || []).forEach(function (e) {
    var hasFrom = e.fromCardinality;
    var hasTo   = e.toCardinality;
    if (hasFrom && hasTo) { alreadySet += 1; return; }

    var inf = inferFromLabel(e.label || '');
    if (!inf) { noPattern += 1; return; }

    var changed = false;
    if (!hasFrom && inf.from) { e.fromCardinality = inf.from; changed = true; }
    if (!hasTo   && inf.to)   { e.toCardinality   = inf.to;   changed = true; }

    if (changed) {
        inferred += 1;
        if (samples.length < 10) {
            samples.push('  ' + (e.label || '(no label)') +
                '  →  ' + (e.fromCardinality || '–') + ' / ' + (e.toCardinality || '–'));
        }
    }
});

if (inferred === 0) {
    console.log('No cardinality patterns found to infer (or all edges already set).');
    console.log('  already-set: ' + alreadySet + ', no-pattern: ' + noPattern);
    process.exit(0);
}

var json = JSON.stringify(data, null, 2);
if (!json.endsWith('\n')) json += '\n';
fs.writeFileSync(FILE, json, 'utf8');

console.log('Cardinality inference:');
console.log('  inferred from label:  ' + inferred);
console.log('  already set:          ' + alreadySet);
console.log('  no pattern detected:  ' + noPattern);
console.log('\n  sample inferences:');
samples.forEach(function (s) { console.log(s); });
