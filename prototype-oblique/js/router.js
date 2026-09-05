/* Hash routes and URL state. Route formats are documented in docs/architecture.md. */
(function (DK) {
  'use strict';

  const KINDS = DK.data.kinds;
  const router = {};

  router.parse = function (hash) {
    hash = hash == null ? location.hash : hash;
    if (!hash || hash === '#') hash = '#/';
    let path = hash.replace(/^#/, '');
    let query = '';
    const qi = path.indexOf('?');
    if (qi >= 0) { query = path.slice(qi + 1); path = path.slice(0, qi); }
    const params = Object.create(null);
    new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
    const r = { view: 'home', kind: null, id: null, params, path, hash };
    let seg;
    try { seg = path.split('/').filter(Boolean).map(decodeURIComponent); }
    catch (e) { r.view = 'notfound'; return r; }
    if (!seg.length) return r;
    if (seg.length === 1 && ['search', 'manual', 'api'].includes(seg[0])) { r.view = seg[0]; return r; }
    if (KINDS.includes(seg[0])) {
      r.kind = seg[0];
      if (seg.length === 1) { r.view = 'list'; return r; }
      if (seg.length === 2) { r.view = 'detail'; r.id = seg[1]; return r; }
      if (seg.length === 4 && seg[0] === 'objects' && seg[2] === 'attributes') {
        r.view = 'detail'; r.kind = 'attrs'; r.id = seg[1] + '/' + seg[3]; return r;
      }
      if (seg.length === 4 && seg[0] === 'tables' && seg[2] === 'fields') {
        r.view = 'detail'; r.kind = 'fields'; r.id = seg[1] + '/' + seg[3]; return r;
      }
    }
    r.view = 'notfound';
    return r;
  };

  router.build = function (path, params) {
    const qs = params ? Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
    return '#' + path + (qs ? '?' + qs : '');
  };
  router.listHref = (kind, params) => router.build('/' + kind, params);
  router.domainListHref = (kind, domain, params) => router.listHref(kind, { domain, group: 'domain', ...params });
  router.entityHref = function (kind, id, params) {
    if (kind === 'attrs' || kind === 'fields') {
      const i = id.indexOf('/');
      const parent = kind === 'attrs' ? 'objects' : 'tables', child = kind === 'attrs' ? 'attributes' : 'fields';
      return router.build('/' + parent + '/' + encodeURIComponent(id.slice(0, i)) + '/' + child + '/' + encodeURIComponent(id.slice(i + 1)), params);
    }
    return router.build('/' + kind + '/' + encodeURIComponent(id), params);
  };
  router.searchHref = (q, params = {}) => router.build('/search', { q, ...params });

  /** Go to a hash; re-renders even when the hash is unchanged. */
  router.navigate = function (hash) {
    if (location.hash === hash) DK.app.onRoute();
    else location.hash = hash;
  };

  // Both update modes leave rendering to the caller; only push creates a history entry.
  function writeParams(patch, method) {
    const r = router.parse();
    const params = Object.assign(Object.create(null), r.params, patch);
    Object.keys(params).forEach(k => { if (params[k] == null || params[k] === '') delete params[k]; });
    const h = router.build(r.path, params);
    if (h !== location.hash) history[method](null, '', location.pathname + location.search + h);
    return h;
  }
  router.replaceParams = patch => writeParams(patch, 'replaceState');
  router.pushParams = patch => writeParams(patch, 'pushState');

  DK.router = router;
})(window.DK);
