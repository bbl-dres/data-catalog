/* Shared request deadlines and retryable, single-flight browser assets. */
(function (DK) {
  'use strict';
  const pending = new Map();
  function catalogConnection(config) {
    const url = new URL(config.url);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) throw new Error('Supabase requires HTTPS');
    if (url.username || url.password || typeof config.publishableKey !== 'string' || !config.publishableKey.startsWith('sb_publishable_')) throw new Error('Use a Supabase publishable key in the browser configuration');
    return { base: new URL('/rest/v1/', url), key: config.publishableKey };
  }
  async function read(url, { format = 'json', timeout = 20000, ...init } = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw Object.assign(new Error(`${url}: HTTP ${response.status}`), { status: response.status, code: detail?.code });
      }
      return await response[format === 'binary' ? 'arrayBuffer' : format === 'text' ? 'text' : 'json']();
    } finally { clearTimeout(timer); }
  }
  function asset(url, { stylesheet = false, before = null, ready = () => true, timeout = 20000 } = {}) {
    const key = (stylesheet ? 'style:' : 'script:') + new URL(url, document.baseURI).href;
    if (pending.has(key)) return pending.get(key);
    const promise = new Promise((resolve, reject) => {
      const element = document.createElement(stylesheet ? 'link' : 'script');
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true; clearTimeout(timer); element.onload = element.onerror = null;
        if (error) { element.remove(); reject(error); } else resolve();
      };
      const fail = () => finish(new Error(`Asset could not be loaded: ${url}`));
      const timer = setTimeout(fail, timeout);
      element.onload = () => { try { ready() ? finish() : fail(); } catch { fail(); } };
      element.onerror = fail;
      if (stylesheet) { element.rel = 'stylesheet'; element.href = url; } else element.src = url;
      document.head.insertBefore(element, before);
    }).catch(error => { pending.delete(key); throw error; });
    pending.set(key, promise);
    return promise;
  }
  // Cache only public, versioned reads. A cached value is never used without server revalidation.
  // Storage denial/quota failures leave the ordinary network path available.
  const catalogReads = new Map();
  async function catalogRead(config, rpc, body = {}) {
    const target = catalogConnection(config), url = new URL('rpc/' + rpc, target.base);
    const cacheUrl = new URL(url);
    Object.entries(body).forEach(([key, value]) => cacheUrl.searchParams.set(key, value));
    const key = cacheUrl.href;
    if (catalogReads.has(key)) return catalogReads.get(key);
    const promise = (async () => {
      let cache, cached;
      try {
        cache = await globalThis.caches?.open('dk-catalog-v1');
        cached = await (await cache?.match(key))?.json();
        if (cached?.schemaVersion !== 1 || !cached.catalogVersion || cached.notModified
          || cached.scope !== (rpc === 'read_catalog_index' ? 'index' : 'record')
          || rpc === 'read_record' && (cached.recordId !== body.record_id || cached.recordTable !== body.record_table)) cached = null;
      } catch { cached = null; }
      const fetchValue = args => read(url, { method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: { apikey: target.key, 'Content-Profile': 'catalog', 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
      let value = await fetchValue({ ...body, ...(cached ? { if_version: cached.catalogVersion } : {}) });
      if (value?.notModified) {
        if (cached && value.catalogVersion === cached.catalogVersion) return cached;
        value = await fetchValue(body);
        if (value?.notModified) throw new Error('Unexpected conditional catalog response');
      }
      if (cache && value?.schemaVersion === 1 && value.catalogVersion && value.scope) {
        try {
          await cache.put(key, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
          const keys = await cache.keys();
          for (const expired of keys.slice(0, Math.max(0, keys.length - 64))) await cache.delete(expired);
        } catch { /* Public reads still work when browser storage is unavailable. */ }
      }
      return value;
    })().finally(() => catalogReads.delete(key));
    catalogReads.set(key, promise);
    return promise;
  }
  DK.resources = { read, asset, catalogConnection, catalogRead };
})(window.DK = window.DK || {});
