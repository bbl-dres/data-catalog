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
      script.onload = resolve;
      script.onerror = () => {
        loading = null; script.remove(); stylesheet.remove();
        reject(new Error('swagger-ui-bundle.js could not be loaded'));
      };
      document.head.appendChild(script);
    });
    return loading;
  }

  DK.api = {
    async mount(host) {
      if (!host || mounts.has(host)) return;
      mounts.add(host); // Include pending mounts to prevent concurrent duplicates.
      try { await load(); } catch (error) { console.error(error); }
      if (!host.isConnected) return;
      if (typeof window.SwaggerUIBundle !== 'function') {
        mounts.delete(host); // Permit retry on the next render.
        host.setAttribute('aria-busy', 'false');
        host.innerHTML = DK.ui.empty(DK.ui.t('api.unavailable'));
        return;
      }
      window.SwaggerUIBundle({
        url: 'data/swagger.json', domNode: host, deepLinking: false,
        docExpansion: 'list', defaultModelsExpandDepth: 1, filter: true,
        supportedSubmitMethods: [], validatorUrl: null,
        presets: [window.SwaggerUIBundle.presets.apis],
        onComplete: () => host.setAttribute('aria-busy', 'false'),
      });
    },
  };
})(window.DK);
