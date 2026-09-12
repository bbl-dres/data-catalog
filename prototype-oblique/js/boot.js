/* boot.js – starts the dictionary and catalog downloads while the application scripts are still
   arriving. Loaded right after catalog-config.js, before the application scripts; data.js and
   catalog.js consume the responses through DK.boot.take(), and repeat the request themselves when
   no early one exists. */
(function (DK) {
  'use strict';
  const pending = new Map();
  const key = url => new URL(url, document.baseURI).href;
  const start = (url, init) => {
    const controller = new AbortController();
    try { pending.set(key(url), { response: fetch(url, { ...init, signal: controller.signal }), controller }); }
    catch { /* the loader repeats the request and reports its failure */ }
  };
  DK.boot = {
    /** The early { response, controller } of a URL, handed out once; later loads fetch normally. */
    take(url) { const early = pending.get(key(url)) || null; pending.delete(key(url)); return early; },
  };
  const config = DK.catalogConfig;
  if (!config) return;
  // The UI files data.load() always needs, resolved against the same 'data/' base.
  ['config.json', 'i18n.json', 'model.json', 'manual.json'].forEach(file => start('data/' + file));
  if (config.provider !== 'supabase' || typeof config.url !== 'string' || typeof config.publishableKey !== 'string' || !config.publishableKey.startsWith('sb_publishable_')) return;
  let url;
  try { url = new URL('/rest/v1/rpc/read_snapshot', config.url); } catch { return; }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) return;
  // Same request and the same guards as catalog.connection()/load(); an invalid configuration sends nothing and fails there.
  start(url.href, { method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
    headers: { apikey: config.publishableKey, 'Content-Profile': 'catalog', 'Content-Type': 'application/json' }, body: '{}' });
})(window.DK);
