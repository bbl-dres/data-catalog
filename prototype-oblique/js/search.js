/* Shared search scope and a deterministic AI-answer demonstration. No model or network calls. */
(function (DK) {
  'use strict';
  const { data } = DK;
  const search = {};

  search.kinds = () => [...data.searchKinds];
  search.domains = () => data.list('domains').map(d => d.identifier);
  search.selectedKinds = options => options?.kinds == null ? search.kinds() : search.kinds().filter(kind => options.kinds.includes(kind));
  search.selectedDomains = options => options?.domains == null ? search.domains() : search.domains().filter(id => options.domains.includes(id));
  search.options = (params = {}) => ({
    kinds: params.types == null ? search.kinds() : search.kinds().filter(kind => String(params.types).split(',').includes(kind)),
    // Keep the default lazy: app state is created before the catalog has loaded.
    domains: params.domains == null ? null : search.domains().filter(id => String(params.domains).split(',').includes(id)),
    ai: params.ai !== '0',
  });
  search.params = options => {
    const kinds = search.selectedKinds(options), domains = search.selectedDomains(options);
    return {
      types: kinds.length === search.kinds().length ? null : kinds.join(',') || 'none',
      domains: domains.length === search.domains().length ? null : domains.join(',') || 'none',
      ai: options?.ai === false ? '0' : null,
    };
  };
  search.canSubmit = (query, options) => !!query.trim() && search.selectedKinds(options).length > 0 && search.selectedDomains(options).length > 0;

  function domainFilter(options) {
    const domains = new Set(search.selectedDomains(options));
    // The unrestricted search also includes records without a domain assignment.
    if (domains.size === search.domains().length) return () => true;
    const belongs = (kind, e) => domains.has(data.domainForEntity(kind, e)?.identifier);
    // Systems span domains through their tables and APIs, rather than owning a domain.
    const systems = new Set(['tables', 'apis'].flatMap(kind => data.list(kind).filter(e => belongs(kind, e)).map(e => e.system)));
    return (kind, e) => kind === 'systems' ? systems.has(e.identifier) : belongs(kind, e);
  }

  // Question fallback requires every significant term to match one record.
  const questionStart = /^(was|wer|wie|wo|welche\w*|womit|woraus|what|who|where|how|which|qu['’]est|quel\w*|comment|où|chi|che|cosa|quale|quali|come|dove)\b/i;
  const stopWords = new Set(('was wer wie wo welche welcher welches welchen ist sind ein eine einer eines einem einen der die das den dem des und oder ich wir man finde finden gibt es zu zum zur im in von für mit sich kann können wird werden ' +
    'what who where how which is are a an the and or i can find do does of for in about ' +
    'qu est est-ce ce que quel quelle quels quelles comment où le la les un une des du de et ou je trouve trouver dans pour sur ' +
    'chi che cosa quale quali come dove è sono un uno una il lo la i gli le di del della e o per in').split(/\s+/));
  const terms = query => {
    if (!questionStart.test(query) && !/[?？]$/.test(query)) return [];
    return [...new Set((query.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || []).filter(word => word.length > 1 && !stopWords.has(word)))];
  };
  const score = (e, query) => data.relevance(e, query) || terms(query).reduce((sum, term) => sum + data.relevance(e, term), 0);

  search.results = function (query, options) {
    const q = query.trim(), kinds = search.selectedKinds(options);
    if (!search.canSubmit(q, options)) return [];
    const inDomain = domainFilter(options);
    const rankGroups = groups => groups.filter(g => g.items.length).sort((a, b) => b.best - a.best || kinds.indexOf(a.kind) - kinds.indexOf(b.kind));
    const exact = rankGroups(data.search(q, kinds).map(g => {
      const items = g.items.filter(e => inDomain(g.kind, e));
      return { ...g, items, total: items.length, best: items.length ? score(items[0], q) : 0 };
    }));
    if (exact.length) return exact;
    const words = terms(q);
    if (!words.length) return [];
    return rankGroups(kinds.map(kind => {
      const items = data.list(kind).filter(e => inDomain(kind, e) && words.every(word => data.match(e, word)))
        .sort((a, b) => score(b, q) - score(a, q) || a.name.localeCompare(b.name, 'de'));
      return { kind, title: data.kindDef(kind).plural, icon: data.kindDef(kind).icon, items, total: items.length, best: items.length ? score(items[0], q) : 0 };
    }));
  };
  search.suggest = (query, options) => search.results(query, options).map(g => ({ ...g, items: g.items.slice(0, 4) }));

  search.sorts = Object.freeze(['relevance', 'name', 'modified']);

  /** Rank every match together before slicing. Types never partition the result order. */
  search.page = function (groups, query, params = {}) {
    const sort = search.sorts.includes(params.sort) ? params.sort : 'relevance';
    const collator = new Intl.Collator('de-CH', { numeric: true, sensitivity: 'base' });
    const items = groups.flatMap(g => g.items.map(e => ({ kind: g.kind, e, score: score(e, query) })));
    items.sort((a, b) => {
      let primary = 0;
      if (sort === 'modified') primary = String(b.e.modified || '').localeCompare(String(a.e.modified || ''));
      else if (sort === 'relevance') primary = b.score - a.score || a.e.name.length - b.e.name.length;
      return primary || collator.compare(data.displayName(a.kind, a.e), data.displayName(b.kind, b.e))
        || search.kinds().indexOf(a.kind) - search.kinds().indexOf(b.kind) || a.e.identifier.localeCompare(b.e.identifier);
    });
    const paging = DK.ui.pageState(items.length, params, [20, 50, 100]);
    return { ...paging, sort, items: items.slice(Math.max(0, paging.from - 1), paging.to) };
  };

  /** A few answerable examples for an empty combobox, constrained by its current scope. */
  search.examples = options => [
    { query: DK.ui.t('search.example.gwr'), type: 'question' },
    // Catalog names remain German, like the records they search in every UI language.
    ...['Gebäude', 'Energieverbrauch', 'Bauprojekt'].map(query => ({ query, type: 'keyword' })),
  ].filter(example => search.results(example.query, options).length);
  search.canSuggest = (query, options) => query.trim() ? search.canSubmit(query, options) : search.examples(options).length > 0;

  /** Short, verbatim excerpts from actual matches, with explicit catalog citations. */
  search.answer = function (query, options, groups = search.results(query, options)) {
    if (options?.ai === false || !search.canSubmit(query, options)) return null;
    const allowed = new Set(search.selectedKinds(options)), inDomain = domainFilter(options);
    const candidates = groups.filter(g => allowed.has(g.kind)).flatMap(g => g.items.map(e => ({ kind: g.kind, e })))
      .filter(({ kind, e }) => inDomain(kind, e) && typeof e.description === 'string' && e.description.trim())
      .sort((a, b) => score(b.e, query) - score(a.e, query) || Number(!!b.e.provenance) - Number(!!a.e.provenance));
    const seen = new Set(), sources = [];
    for (const { kind, e } of candidates) {
      // Cite only top-ranked definitions; weaker keyword matches would dilute the answer.
      if (score(e, query) < score(candidates[0].e, query)) break;
      const description = e.description.trim().replace(/\s+/g, ' ');
      if (seen.has(description)) continue;
      seen.add(description);
      let excerpt = description;
      if (excerpt.length > 320) {
        const end = excerpt.lastIndexOf(' ', 320);
        excerpt = excerpt.slice(0, end > 0 ? end : 320) + '…';
      }
      sources.push({ kind, id: e.identifier, title: data.displayName(kind, e), excerpt, status: data.statusOf(kind, e) });
      if (sources.length === 3) break;
    }
    return { sources };
  };

  DK.search = search;
})(window.DK);
