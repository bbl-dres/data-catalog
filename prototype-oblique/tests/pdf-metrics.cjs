const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ window: { DK: { diagram: {}, ui: {} } } });
for (const file of ['diagram', 'pdf']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), context);
const { diagram, pdf } = context.window.DK;

// Exercise fitting words, oversized identifiers, whitespace and Unicode with predictable metrics.
const measure = text => [...text].length;
for (const [text, width, expected] of [
  ['', 5, ['']], ['  one\n two  ', 7, ['one two']], ['one two three', 7, ['one two', 'three']],
  ['ABCDEFGHIJ', 4, ['ABCD', 'EFGH', 'IJ']], ['one ABCDEFG two', 5, ['one', 'ABCDE', 'FG', 'two']],
  ['äé🙂猫äé🙂猫', 3, ['äé🙂', '猫äé', '🙂猫']], ['x', 0.5, ['x']],
]) assert.deepEqual(Array.from(diagram.wrap(text, width, 10, false, measure)), expected);

let calls = 0, font, size;
pdf.create = () => ({
  setFont: (_, style) => { font = style; }, setFontSize: value => { size = value; },
  getTextWidth: value => { calls++; return value.length * size * (font === 'bold' ? 2 : 1); },
});
const widths = pdf.measure({});
assert.equal(widths('Name', 10), 40);
assert.equal(widths('Name', 10), 40);
assert.equal(calls, 1, 'Repeated text is measured once');
assert.equal(widths('Name', 12), 48);
assert.equal(widths('Name', 10, true), 80);
assert.equal(widths('', 10), 0);
assert.equal(widths('', 10), 0);
assert.equal(calls, 4, 'Size, weight and zero-width values are independent cache entries');
for (let i = 0; i < 5000; i++) widths('Item ' + i, 10);
const before = calls;
assert.equal(widths('Name', 10), 40);
assert.equal(calls, before + 1, 'The oldest entry is evicted when the bound is reached');
assert.equal(pdf.measure({})('Name', 10), 40);
assert.equal(calls, before + 2, 'A new workspace owns a separate metric cache');
console.log('PDF wrapping, font metrics and bounded-cache checks passed.');
