/* boot.js – starts the dictionary and catalog downloads while the application scripts are still
   arriving. Loaded after catalog-config.js and resources.js; data.js and
   catalog.js consume the parsed results through DK.boot.take(), and request them when
   no early one exists. */
(function (DK) {
  'use strict';
  if (window.self !== window.top) return;
  const pending = new Map();
  const key = url => new URL(url, document.baseURI).href;
  const start = (url, init) => {
    const promise = DK.resources.read(url, init);
    // Observe rejection immediately, while scripts are still arriving. The same
    // rejected promise remains available to the loader for its error display.
    promise.catch(() => {});
    pending.set(key(url), promise);
  };
  DK.boot = {
    /** The early parsed-result promise, handed out once; later loads fetch normally. */
    take(url) { const early = pending.get(key(url)) || null; pending.delete(key(url)); return early; },
  };
  const config = DK.catalogConfig;
  if (!config) return;
  // The UI files data.load() always needs, resolved against the same 'data/' base.
  ['config.json', 'i18n.json', 'model.json', 'manual.json'].forEach(file => start('data/' + file, file === 'i18n.json' ? { cache: 'no-cache' } : undefined));
  if (config.provider !== 'supabase') return;
  let target;
  try { target = DK.resources.catalogConnection(config); } catch { return; }
  start(new URL('rpc/read_snapshot', target.base), { method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
    headers: { apikey: target.key, 'Content-Profile': 'catalog', 'Content-Type': 'application/json' }, body: '{"include_api_fields":true}' });
})(window.DK);
