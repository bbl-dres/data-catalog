// Workers don't expose `location` or `document` — sql.js (Emscripten)
// reads both during WASM init to locate the .wasm file. We stub them
// here so sql.js can finish initialising; the stub URL is never fetched
// because the worker passes its own `instantiateWasm` callback.
//
// This file MUST be imported before `sql.js`. ES-module imports are
// evaluated in source order for side-effect imports, so put this first.

if (typeof globalThis.location === 'undefined') {
  globalThis.location = new URL('https://localhost/');
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { currentScript: { src: 'https://localhost/' } };
}
