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
        window.SwaggerUIBundle({
          spec, domNode: content, deepLinking: false,
          docExpansion: 'list', defaultModelsExpandDepth: 1, filter: true,
          supportedSubmitMethods: [], validatorUrl: null,
          presets: [window.SwaggerUIBundle.presets.apis],
          onComplete: () => {
            host.querySelector('.ob-loading')?.remove();
            content.setAttribute('aria-busy', 'false');
            content.hidden = false;
          },
        });
      } catch (error) {
        console.error(error);
        mounts.delete(host); // Permit retry on the next render.
        if (host.isConnected) host.innerHTML = DK.ui.empty(DK.ui.t('api.unavailable'));
      }
    },
  };
})(window.DK);
