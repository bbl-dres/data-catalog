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

  let spec = null; // the parsed contract is reused by every later visit; a failed load is forgotten so a retry fetches again
  function loadSpec() {
    spec ||= (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch('data/swagger.json', { signal: controller.signal });
        if (!response.ok) throw new Error(`API documentation request failed (${response.status})`);
        return await response.json();
      } catch (error) { spec = null; throw error; }
      finally { clearTimeout(timer); }
    })();
    return spec;
  }

  function connection(spec) {
    const config = DK.catalogConfig;
    if (config?.provider !== 'supabase') return null;
    const target = DK.catalog.connection(config);
    spec.servers = [{ url: target.base.href.replace(/\/$/, ''), description: 'Supabase catalog Data API' }];
    for (const item of Object.values(spec.paths)) for (const operation of Object.values(item)) {
      if (operation.servers) operation.servers = [{url:new URL('/functions/v1/catalog-api',target.base.origin).href,description:'Catalog REST API'}];
    }
    return target;
  }

  function requestOperation(request, spec, target) {
    if (!target) throw new Error('Live API requests are disabled in offline fixture mode');
    const url = new URL(request.url), method = request.method.toLowerCase();
    const commandBase = new URL('/functions/v1/catalog-api/',target.base.origin);
    const command = url.pathname.startsWith(commandBase.pathname);
    const base = command ? commandBase : target.base;
    const path = '/' + url.pathname.slice(base.pathname.length);
    const template = Object.keys(spec.paths).find(pattern => pattern === path || (pattern.endsWith('/{id}') && path.startsWith(pattern.slice(0,-4)) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path.slice(pattern.length-4))));
    const operation = spec.paths[template]?.[method];
    if (url.username || url.password || url.origin !== target.base.origin || !url.pathname.startsWith(base.pathname)
      || !operation || command !== !!operation.servers || !['get','post','patch','delete'].includes(method)) {
      throw new Error('Only documented catalog operations on the configured server are allowed');
    }
    return {method,command,operation};
  }
  function prepareRequest(request, spec, target, accessToken = null) {
    const {method,command,operation}=requestOperation(request,spec,target);
    const headers = new Headers(request.headers);
    const key = headers.get('apikey') || target.key;
    if (!key.startsWith('sb_publishable_')) throw new Error('Use a publishable key for public catalog reads');
    headers.set('apikey', key);
    if (operation['x-catalog-write']) {
      const bearer = headers.get('Authorization') || (accessToken ? 'Bearer '+accessToken : '');
      if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer)) throw new Error('Sign in or authorize with a current app access token to write');
      headers.set('Authorization',bearer);
    } else headers.delete('Authorization');
    headers.delete('Accept-Profile'); headers.delete('Content-Profile');
    if (!command) headers.set(method === 'get' ? 'Accept-Profile' : 'Content-Profile', 'catalog');
    headers.set('Accept', 'application/json');
    if (['post','patch'].includes(method)) headers.set('Content-Type', 'application/json');
    request.headers = Object.fromEntries(headers);
    request.credentials = 'omit';
    request.redirect = 'error';
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
          spec, domNode: content, deepLinking: false, queryConfigEnabled: false,
          docExpansion: 'list', defaultModelsExpandDepth: 0, filter: true,
          supportedSubmitMethods: target ? ['get', 'post', 'patch', 'delete'] : [], validatorUrl: null,
          requestInterceptor: async request => {
            // Validate the destination before requesting a token. Session tokens
            // are injected just in time, never retained in Swagger authorization.
            const {operation}=requestOperation(request,spec,target);
            const token=operation['x-catalog-write'] && !new Headers(request.headers).has('Authorization') ? await DK.auth.accessToken() : null;
            return prepareRequest(request,spec,target,token);
          },
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
