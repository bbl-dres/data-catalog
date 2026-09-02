/* router.js – hash routing. URL is the source of truth for view, entity,
   tab, page, grouping, view mode and search query.

   #/                                  home
   #/objects  #/tables  #/refs …       section list      ?view=tiles|table&group=<id>
   #/objects/gebaeude                  detail            ?tab=overview|rows|relations|history&page=n
   #/objects/gebaeude/attributes/egid  attribute detail
   #/search?q=…                        search results
   #/manual?ch=<chapter>               handbook
   #/api                               API documentation
   Any route accepts ?nav=entity|container to override the tree model. */
(function (DK) {
  'use strict';

  const KINDS = ['domains', 'systems', 'objects', 'tables', 'refs', 'products', 'apis'];
  const router = {};

  router.parse = function (hash) {
    hash = hash == null ? location.hash : hash;
    if (!hash || hash === '#') hash = '#/';
    let path = hash.replace(/^#/, '');
    let query = '';
    const qi = path.indexOf('?');
    if (qi >= 0) { query = path.slice(qi + 1); path = path.slice(0, qi); }
    const params = {};
    new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
    const seg = path.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    const r = { view: 'home', kind: null, id: null, params, path, hash };
    if (!seg.length) return r;
    if (seg[0] === 'search') { r.view = 'search'; return r; }
    if (seg[0] === 'manual') { r.view = 'manual'; return r; }
    if (seg[0] === 'api') { r.view = 'api'; return r; }
    if (KINDS.includes(seg[0])) {
      r.kind = seg[0];
      if (seg.length === 1) { r.view = 'list'; return r; }
      r.view = 'detail';
      r.id = seg[1];
      if (seg[0] === 'objects' && seg[2] === 'attributes' && seg[3]) { r.kind = 'attrs'; r.id = seg[1] + '/' + seg[3]; }
      return r;
    }
    r.view = 'notfound';
    return r;
  };

  router.build = function (path, params) {
    const qs = params ? Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
    return '#' + path + (qs ? '?' + qs : '');
  };
  router.homeHref = '#/';
  router.listHref = (kind, params) => router.build('/' + kind, params);
  router.entityHref = function (kind, id, params) {
    if (kind === 'attrs') {
      const i = id.indexOf('/');
      return router.build('/objects/' + encodeURIComponent(id.slice(0, i)) + '/attributes/' + encodeURIComponent(id.slice(i + 1)), params);
    }
    return router.build('/' + kind + '/' + encodeURIComponent(id), params);
  };
  router.searchHref = q => router.build('/search', { q });

  /** Go to a hash; re-renders even when the hash is unchanged. */
  router.navigate = function (hash) {
    if (location.hash === hash) DK.app.onRoute();
    else location.hash = hash;
  };

  /** Patch query params of the current route without firing hashchange (caller re-renders). */
  router.replaceParams = function (patch) {
    const r = router.parse();
    const params = Object.assign({}, r.params, patch);
    Object.keys(params).forEach(k => { if (params[k] == null || params[k] === '') delete params[k]; });
    const h = router.build(r.path, params);
    history.replaceState(null, '', location.pathname + location.search + h);
    return h;
  };

  DK.router = router;
})(window.DK);
