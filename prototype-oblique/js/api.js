/* Lazy API-reference loading and Swagger-owned DOM lifecycle. */
(function (DK) {
  'use strict';
  let loading = null;
  const mounts = new WeakSet();

  function load() {
    if (typeof window.SwaggerUIBundle === 'function') return Promise.resolve();
    if (!loading) loading = new Promise((resolve, reject) => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'vendor/swagger-ui/swagger-ui.css';
      // Application overrides follow the vendor stylesheet.
      document.head.insertBefore(stylesheet, document.getElementById('main-css'));
      const script = document.createElement('script');
      script.src = 'vendor/swagger-ui/swagger-ui-bundle.js';
      const fail = () => {
        clearTimeout(timer);
        loading = null; script.remove(); stylesheet.remove();
        reject(new Error('swagger-ui-bundle.js could not be loaded'));
      };
      const timer = setTimeout(fail, 20000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = fail;
      document.head.appendChild(script);
    });
    return loading;
  }

  async function loadSpec() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('data/swagger.json', { signal: controller.signal });
      if (!response.ok) throw new Error(`API documentation request failed (${response.status})`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  function connection(spec) {
    const config = DK.catalogConfig;
    if (config?.provider !== 'supabase') return null;
    if (!config.publishableKey?.startsWith('sb_publishable_')) throw new Error('API documentation requires a publishable key');
    const base = new URL('/rest/v1/', config.url);
    spec.servers = [{ url: base.href.replace(/\/$/, ''), description: 'Supabase catalog Data API' }];
    return { base, key: config.publishableKey };
  }

  function prepareRequest(request, spec, target) {
    if (!target) throw new Error('Live API requests are disabled in offline fixture mode');
    const url = new URL(request.url), method = request.method.toLowerCase();
    const path = '/' + url.pathname.slice(target.base.pathname.length);
    if (url.origin !== target.base.origin || !url.pathname.startsWith(target.base.pathname)
      || !(method === 'get' && spec.paths[path]?.get || method === 'post' && path === '/rpc/read_snapshot' && spec.paths[path]?.post)) {
      throw new Error('Only documented catalog reads are allowed');
    }
    const headers = new Headers(request.headers);
    const key = headers.get('apikey') || target.key;
    if (!key.startsWith('sb_publishable_')) throw new Error('Use a publishable key for public catalog reads');
    headers.set('apikey', key);
    headers.delete('Authorization');
    headers.delete('Accept-Profile'); headers.delete('Content-Profile');
    headers.set(method === 'get' ? 'Accept-Profile' : 'Content-Profile', 'catalog');
    headers.set('Accept', 'application/json');
    if (method === 'post') headers.set('Content-Type', 'application/json');
    request.headers = Object.fromEntries(headers);
    request.credentials = 'omit';
    return request;
  }

  DK.api = {
    async mount(host) {
      if (!host) return;
      if (mounts.has(host)) {
        const label = host.querySelector('.ob-loading-label');
        if (label && label.textContent !== DK.ui.t('api.loading')) label.textContent = DK.ui.t('api.loading');
        return;
      }
      mounts.add(host); // Include pending mounts to prevent concurrent duplicates.
      host.innerHTML = DK.ui.loading(DK.ui.t('api.loading'));
      const content = document.createElement('div');
      content.className = 'ob-swagger-content';
      content.setAttribute('aria-busy', 'true');
      content.hidden = true;
      host.appendChild(content);
      try {
        const [, spec] = await Promise.all([load(), loadSpec()]);
        if (!host.isConnected) return;
        const target = connection(spec);
        const swagger = window.SwaggerUIBundle({
          spec, domNode: content, deepLinking: false,
          docExpansion: 'list', defaultModelsExpandDepth: 1, filter: true,
          supportedSubmitMethods: target ? ['get', 'post'] : [], validatorUrl: null,
          requestInterceptor: request => prepareRequest(request, spec, target),
          persistAuthorization: false,
          presets: [window.SwaggerUIBundle.presets.apis],
          onComplete: () => queueMicrotask(() => {
            if (!host.isConnected) return;
            if (target) swagger.preauthorizeApiKey('PublishableKey', target.key);
            host.querySelector('.ob-loading')?.remove();
            content.setAttribute('aria-busy', 'false');
            content.hidden = false;
          }),
        });
      } catch (error) {
        console.error(error);
        mounts.delete(host); // Permit retry on the next render.
        if (host.isConnected) host.innerHTML = DK.ui.empty(DK.ui.t('api.unavailable'));
      }
    },
  };
  DK.api.prepareRequest = prepareRequest;
})(window.DK);
