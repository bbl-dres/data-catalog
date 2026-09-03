(function() {
    // === STATE ===
    const state = {
        data: { concept: [], dataset: [] },
        contentLoaded: {},
        i18n: {}
    };

    // === CONFIG ===
    let cachedLang = 'de';

    const config = {
        views: ['view-concept-catalog', 'view-dataset-catalog', 'view-concept-detail', 'view-dataset-detail', 'view-about', 'view-manual'],
        typeLabels: { concept: 'type.concept', dataset: 'type.dataset' },
        spreadsheetFormats: ['Excel', 'XLSX', 'XLS', 'CSV'],
        metaFields: {
            concept: [
                { key: 'fachliche_id', label: 'meta.id', type: 'text' },
                { key: 'termdat', label: 'meta.termdat', type: 'link' },
                { key: 'fachbereich', label: 'meta.domain', type: 'text', localized: true },
                { key: 'system', label: 'meta.system', type: 'pill' },
                { key: 'klassifizierung', label: 'meta.classification', type: 'enum', enumPrefix: 'enum.classification' },
                { key: 'personenbezogen', label: 'meta.personaldata', type: 'enum', enumPrefix: 'enum.personaldata' },
                { key: 'kommentar', label: 'meta.comment', type: 'text', localized: true },
                { key: 'version', label: 'meta.version', type: 'text' }
            ],
            dataset: [
                { key: 'kontaktstelle', label: 'meta.contact', type: 'text' },
                { key: 'ausgabedatum', label: 'meta.issued', type: 'text' },
                { key: 'aktualisierungsintervall', label: 'meta.frequency', type: 'enum', enumPrefix: 'enum.frequency' },
                { key: 'status', label: 'meta.status', type: 'enum', enumPrefix: 'enum.status' },
                { key: 'klassifizierung', label: 'meta.classification', type: 'enum', enumPrefix: 'enum.classification' },
                { key: 'personenbezogen', label: 'meta.personaldata', type: 'enum', enumPrefix: 'enum.personaldata' },
                { key: 'archivwuerdig', label: 'meta.archival', type: 'enum', enumPrefix: 'enum.archival' },
                { key: 'thema', label: 'meta.theme', type: 'text', localized: true },
                { key: 'rechtsgrundlage', label: 'meta.legal_basis', type: 'text', localized: true },
                { key: 'kommentar', label: 'meta.comment', type: 'text', localized: true }
            ]
        },
        distributionFields: [
            { key: 'identifikator', label: 'dist.identifier' },
            { key: 'titel', label: 'dist.title', fallback: 'name' },
            { key: 'zugriffsUrl', label: 'dist.access_url', isLink: true },
            { key: 'downloadUrl', label: 'dist.download_url', isLink: true },
            { key: 'status', label: 'dist.status', enumPrefix: 'enum.status' },
            { key: 'dateiformat', label: 'dist.format', fallback: 'format' },
            { key: 'lizenz', label: 'dist.license' },
            { key: 'bemerkungen', label: 'dist.remarks', localized: true }
        ],
        shareUrls: {
            facebook: 'https://www.facebook.com/sharer/sharer.php?u=',
            twitter: 'https://twitter.com/intent/tweet?url=',
            linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=',
            xing: 'https://www.xing.com/spi/shares/new?url=',
            whatsapp: 'https://wa.me/?text='
        }
    };

    // === UTILITIES ===
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

    // === i18n ENGINE ===
    function getCurrentLang() { return cachedLang; }

    function syncLangFromUrl() {
        const hash = location.hash.slice(1) || '';
        const queryPart = hash.split('?')[1] || '';
        const params = new URLSearchParams(queryPart);
        cachedLang = params.get('lang') || localStorage.getItem('catalog-lang') || 'de';
    }

    function t(key) {
        if (typeof key === 'object' && key !== null) return key[cachedLang] || key['de'] || '';
        if (typeof key === 'string') return state.i18n[key]?.[cachedLang] || state.i18n[key]?.['de'] || key;
        return String(key ?? '');
    }

    const i18nAttrMap = [
        ['data-i18n', 'textContent'],
        ['data-i18n-placeholder', 'placeholder'],
        ['data-i18n-title', 'title'],
        ['data-i18n-alt', 'alt']
    ];

    function applyTranslations() {
        syncLangFromUrl();
        document.documentElement.lang = cachedLang;

        for (const [attr, prop] of i18nAttrMap) {
            $$(`[${attr}]`).forEach(el => {
                const val = state.i18n[el.getAttribute(attr)]?.[cachedLang];
                if (val) el[prop] = val;
            });
        }
        $$('[data-i18n-aria]').forEach(el => {
            const val = state.i18n[el.getAttribute('data-i18n-aria')]?.[cachedLang];
            if (val) el.setAttribute('aria-label', val);
        });

        const titleVal = state.i18n['meta.title']?.[cachedLang];
        if (titleVal) document.title = titleVal;

        $$('.language-switcher__btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === cachedLang);
        });
    }

    function switchLanguage(lang) {
        cachedLang = lang;
        localStorage.setItem('catalog-lang', lang);
        updateUrl({ lang }, true);
        state.contentLoaded = {};
        applyTranslations();
        handleRoute();
    }

    // === URL PARSING ===
    function parseHash() {
        const hash = location.hash.slice(1) || '/concept';
        const [pathPart, queryPart] = hash.split('?');
        const params = new URLSearchParams(queryPart || '');

        const pathSegments = pathPart.split('/').filter(Boolean);
        const type = pathSegments[0] || 'concept';
        const id = pathSegments[1] || null;

        return {
            type,
            id,
            lang: params.get('lang') || localStorage.getItem('catalog-lang') || 'de',
            tags: params.get('tags')?.split(',').filter(Boolean) || [],
            view: params.get('view') || 'grid',
            filter: params.get('filter') === 'open',
            system: params.get('system') || '',
            personenbezogen: params.get('personenbezogen') || '',
            klassifizierung: params.get('klassifizierung') || ''
        };
    }

    function buildHash(type, id = null, params = {}) {
        let hash = `#/${type}`;
        if (id) hash += `/${id}`;

        const urlParams = new URLSearchParams();
        const lang = params.lang || getCurrentLang();
        if (lang && lang !== 'de') urlParams.set('lang', lang);
        if (params.tags?.length) urlParams.set('tags', params.tags.join(','));
        if (params.view && params.view !== 'grid') urlParams.set('view', params.view);
        if (params.filter) urlParams.set('filter', 'open');
        if (params.system) urlParams.set('system', params.system);
        if (params.personenbezogen) urlParams.set('personenbezogen', params.personenbezogen);
        if (params.klassifizierung) urlParams.set('klassifizierung', params.klassifizierung);

        const queryString = urlParams.toString();
        return queryString ? `${hash}?${queryString}` : hash;
    }

    function updateUrl(params, replace = false) {
        const current = parseHash();
        const newHash = buildHash(
            params.type ?? current.type,
            params.id ?? current.id,
            {
                lang: params.lang ?? current.lang,
                tags: params.tags ?? current.tags,
                view: params.view ?? current.view,
                filter: params.filter ?? current.filter,
                system: params.system ?? current.system,
                personenbezogen: params.personenbezogen ?? current.personenbezogen,
                klassifizierung: params.klassifizierung ?? current.klassifizierung
            }
        );

        if (replace) {
            history.replaceState(null, '', newHash);
        } else {
            location.hash = newHash;
        }
    }

    // === TAG MANAGEMENT ===
    function getAllTags(type) {
        const tags = new Set();
        state.data[type].forEach(item => {
            (item.tags || []).forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort((a, b) => t('tag.' + a).localeCompare(t('tag.' + b), getCurrentLang()));
    }

    function addTag(tag) {
        const current = parseHash();
        if (!current.tags.includes(tag)) {
            updateUrl({ tags: [...current.tags, tag] });
        }
    }

    function removeTag(tag) {
        const current = parseHash();
        updateUrl({ tags: current.tags.filter(t => t !== tag) });
    }

    function clearTags() {
        updateUrl({ tags: [] });
    }

    function clearAllFilters() {
        updateUrl({ tags: [], system: '', personenbezogen: '', klassifizierung: '' });
    }

    // === FORMATTING UTILITIES ===
    function formatMetaValue(val, fieldDef) {
        if (!val || val === '-') return '-';
        if (fieldDef.type === 'enum' && fieldDef.enumPrefix) {
            return `<span class="badge">${t(fieldDef.enumPrefix + '.' + val)}</span>`;
        }
        if (fieldDef.type === 'pill') return `<span class="badge">${val}</span>`;
        if (fieldDef.localized && typeof val === 'object') return t(val);
        if (fieldDef.type === 'link' && typeof val === 'string' && val.startsWith('http')) {
            return `<a href="${val}" target="_blank">${val}</a>`;
        }
        return typeof val === 'object' ? t(val) : val;
    }

    function createDataRow(label, value) {
        return `<div class="data-row"><div class="data-row__key">${label}</div><div class="data-row__value">${value}</div></div>`;
    }

    function createTags(tagKeys, activeTags = []) {
        return tagKeys.map(key => {
            const isActive = activeTags.includes(key);
            return `<span class="badge${isActive ? ' badge--active' : ''}" data-tag="${key}">${t('tag.' + key)}</span>`;
        }).join('');
    }

    function renderResponsiblePersons(type, persons) {
        const placeholder = $(`#responsible-placeholder-${type}`);
        const listSection = $(`#responsible-list-${type}`);
        const listContainer = $(`#responsible-list-${type} .box-section__list`);

        if (!persons || persons.length === 0) {
            placeholder.classList.remove('hidden');
            listSection.classList.add('hidden');
            return;
        }

        placeholder.classList.add('hidden');
        listSection.classList.remove('hidden');

        const html = persons.map(person => {
            const admindirUrl = `https://admindir.verzeichnisse.admin.ch/person/${person.admindirId}`;
            return `
                <div class="data-row">
                    <div class="data-row__key">AdminDir ID: <a href="${admindirUrl}" target="_blank" class="link">${person.admindirId}</a></div>
                    <div class="data-row__value"><span class="badge">${person.role}</span></div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = html;
    }

    // === FILTERING ===
    function filterItems(items, searchText, filters) {
        const { tags = [], system = '', personenbezogen = '', klassifizierung = '' } = filters;

        return items.filter(item => {
            const text = searchText.toLowerCase();
            const titleText = t(item.title).toLowerCase();
            const descText = t(item.description).toLowerCase();
            const matchesText = !text || titleText.includes(text) || descText.includes(text);

            const itemTags = item.tags || [];
            const matchesTags = tags.length === 0 || tags.every(tag => itemTags.includes(tag));

            const meta = item.meta || {};
            const matchesSystem = !system || meta.system === system;
            const matchesPersonenbezogen = !personenbezogen || meta.personenbezogen === personenbezogen;
            const matchesKlassifizierung = !klassifizierung || meta.klassifizierung === klassifizierung;

            return matchesText && matchesTags && matchesSystem && matchesPersonenbezogen && matchesKlassifizierung;
        });
    }

    function getUniqueSystems() {
        const systems = new Set();
        state.data.concept.forEach(item => {
            if (item.meta?.system) systems.add(item.meta.system);
        });
        return Array.from(systems).sort((a, b) => a.localeCompare(b, getCurrentLang()));
    }

    // === DATA LOADING ===
    async function loadData() {
        try {
            const [conceptRes, datasetRes, i18nRes] = await Promise.all([
                fetch('data/concepts.json'),
                fetch('data/datasets.json').catch(() => ({ ok: false })),
                fetch('data/i18n.json')
            ]);

            state.data.concept = await conceptRes.json();
            state.data.dataset = datasetRes.ok ? await datasetRes.json() : [];
            state.i18n = await i18nRes.json();
        } catch (e) {
            console.error('Data load failed:', e);
        }
    }

    async function loadContent(type) {
        const lang = getCurrentLang();
        const cacheKey = `${type}-${lang}`;
        if (state.contentLoaded[cacheKey]) return;
        try {
            const res = await fetch(`content/${type}-${lang}.html`);
            if (res.ok) {
                $(`#${type}-content`).innerHTML = await res.text();
                state.contentLoaded[cacheKey] = true;
            } else {
                // Fallback to German
                const fallback = await fetch(`content/${type}-de.html`);
                if (fallback.ok) {
                    $(`#${type}-content`).innerHTML = await fallback.text();
                    state.contentLoaded[cacheKey] = true;
                }
            }
        } catch (e) {
            console.error(`Failed to load ${type}-${lang}.html:`, e);
        }
    }

    // === FILTER PANEL RENDERING ===
    function renderFilterPanel(type) {
        const { tags, filter, system, personenbezogen, klassifizierung } = parseHash();
        const panel = $(`#filter-panel-${type}`);
        const countEl = $(`#filter-count-${type}`);
        const filterBtn = $(`.btn-filter[data-type="${type}"]`);
        const resetBtn = $(`.btn-reset[data-type="${type}"]`);
        const inputField = $(`.tag-input-field[data-type="${type}"]`);
        const searchInput = $(`.tag-search-input[data-type="${type}"]`);

        panel.classList.toggle('hidden', !filter);

        filterBtn.classList.toggle('active', filter);

        let activeFilterCount = tags.length;
        if (system) activeFilterCount++;
        if (personenbezogen) activeFilterCount++;
        if (klassifizierung) activeFilterCount++;

        if (activeFilterCount > 0) {
            countEl.textContent = activeFilterCount;
            countEl.classList.remove('hidden');
        } else {
            countEl.classList.add('hidden');
        }

        resetBtn.classList.toggle('hidden', activeFilterCount === 0);

        const existingPills = inputField.querySelectorAll('.badge-filter--active');
        existingPills.forEach(pill => pill.remove());

        tags.forEach(tag => {
            const pill = document.createElement('span');
            pill.className = 'badge-filter--active';
            pill.innerHTML = `${t('tag.' + tag)}<span class="remove" data-tag="${tag}">×</span>`;
            inputField.insertBefore(pill, searchInput);
        });

        searchInput.placeholder = tags.length > 0 ? t('filter.keyword_placeholder') : t('filter.keyword_choose');

        // Populate system dropdown (only for concepts)
        if (type === 'concept') {
            const systemSelect = $(`#filter-system-${type}`);
            if (systemSelect) {
                const systems = getUniqueSystems();
                systemSelect.innerHTML = `<option value="">${t('filter.all')}</option>` +
                    systems.map(s => `<option value="${s}"${s === system ? ' selected' : ''}>${s}</option>`).join('');
            }
        }

        const personenbezogenSelect = $(`#filter-personenbezogen-${type}`);
        if (personenbezogenSelect) personenbezogenSelect.value = personenbezogen;

        const klassifizierungSelect = $(`#filter-klassifizierung-${type}`);
        if (klassifizierungSelect) klassifizierungSelect.value = klassifizierung;

        // Translate dropdown option labels
        applyTranslations();
    }

    function renderTagDropdown(type, filterText = '') {
        const { tags } = parseHash();
        const dropdown = $(`#tag-dropdown-${type}`);
        const allTags = getAllTags(type);

        const availableTags = allTags.filter(tag =>
            !tags.includes(tag) &&
            t('tag.' + tag).toLowerCase().includes(filterText.toLowerCase())
        );

        if (availableTags.length === 0) {
            dropdown.innerHTML = `<div class="tag-option-empty">${t('filter.nomatch')}</div>`;
        } else {
            dropdown.innerHTML = availableTags
                .map(tag => `<div class="tag-option" data-tag="${tag}">${t('tag.' + tag)}</div>`)
                .join('');
        }
    }

    // === CATALOG RENDERING ===
    function renderCatalog(type) {
        const { tags, view, system, personenbezogen, klassifizierung } = parseHash();
        const searchText = $(`#search-${type}`)?.value || '';
        const items = filterItems(state.data[type], searchText, { tags, system, personenbezogen, klassifizierung });
        const isGrid = view === 'grid';
        const gridEl = $(`#${type}-grid`);
        const listEl = $(`#${type}-list`);

        gridEl.classList.toggle('hidden', !isGrid);
        listEl.classList.toggle('hidden', isGrid);

        $$(`[data-type="${type}"].toggle-icon`).forEach(btn => {
            const isActive = btn.dataset.view === view;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('inactive', !isActive);
        });

        if (items.length === 0) {
            const noResults = `
                <div class="no-results">
                    <div class="no-results__icon"><span class="material-symbols-rounded" style="font-size:48px">search_off</span></div>
                    <div class="no-results__text">${t('noresults.text')}</div>
                </div>
            `;
            if (isGrid) {
                gridEl.innerHTML = noResults;
            } else {
                $('tbody', listEl).innerHTML = `<tr><td colspan="3">${noResults}</td></tr>`;
            }
            return;
        }

        const typeLabel = t(config.typeLabels[type]);

        if (isGrid) {
            gridEl.innerHTML = items.map(item => `
                <div class="card" data-id="${item.id}">
                    <div class="card__image">
                        <img src="${item.image}" class="card__img" alt="${t(item.title)}">
                        <div class="card__badges"><span class="badge--overlay">${typeLabel}</span></div>
                    </div>
                    <div class="card__body">
                        <h3 class="card__title">${t(item.title)}</h3>
                        <p class="card__description">${t(item.description)}</p>
                        <div class="card__footer">
                            <div class="card__tags">${createTags((item.tags || []).slice(0, 3), tags)}</div>
                            <div class="card__action"><span class="material-symbols-rounded">arrow_forward</span></div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            $('tbody', listEl).innerHTML = items.map(item => `
                <tr data-id="${item.id}">
                    <td class="col-title">${t(item.title)}</td>
                    <td class="col-desc">${t(item.description)}</td>
                    <td class="col-tags">${createTags(item.tags || [], tags)}</td>
                </tr>
            `).join('');
        }

        renderFilterPanel(type);
    }

    // === DETAIL RENDERING ===
    function renderDetail(type, id) {
        const item = state.data[type].find(x => x.id === id);
        if (!item) return navigate(type);

        showView(`view-${type}-detail`);
        setActiveTab(type);
        setBreadcrumbs(`${type}-detail`, t(item.title));

        $(`#detail-${type}-title`).textContent = t(item.title);
        $(`#detail-${type}-desc`).textContent = t(item.fullDescription) || t(item.description);
        $(`#detail-${type}-img`).src = item.image || 'data:,';
        $(`#detail-${type}-img`).alt = t(item.title);
        $(`#detail-${type}-tags`).innerHTML = createTags(item.tags || []);

        renderResponsiblePersons(type, item.responsiblePersons);

        // Metadata
        const metaHtml = item.meta
            ? config.metaFields[type].map(f => {
                const rawVal = item.meta[f.key];
                const displayVal = formatMetaValue(rawVal, f);
                return createDataRow(t(f.label), displayVal);
            }).join('')
            : `<div class="data-row">${t('detail.no_metadata')}</div>`;
        $(`#detail-${type}-meta`).innerHTML = metaHtml;

        if (type === 'concept') {
            renderConceptSpecific(item);
        } else {
            renderDatasetSpecific(item);
        }
    }

    function renderConceptSpecific(item) {
        const stdHtml = item.standards?.length
            ? item.standards.map(s => {
                const displayValue = Array.isArray(s.value) ? s.value.join('<br>') : s.value;
                return createDataRow(s.name, displayValue);
            }).join('')
            : `<div class="data-row">${t('detail.no_standards')}</div>`;
        $('#detail-concept-standards').innerHTML = stdHtml;

        const attrHtml = item.attributes?.length
            ? item.attributes.map(a => `
                <tr>
                    <td>${t(a.name)}</td>
                    <td>${a.format}</td>
                    <td>${a.key}</td>
                    <td>${a.list}</td>
                    <td>${t(a.desc)}</td>
                </tr>
            `).join('')
            : `<tr><td colspan="5">${t('detail.no_attributes')}</td></tr>`;
        $('#detail-concept-attrs').innerHTML = attrHtml;
    }

    function renderDatasetSpecific(item) {
        const distContainer = $('#detail-dataset-distributions');
        if (item.distributions?.length) {
            distContainer.innerHTML = item.distributions.map((d, i) => {
                const icon = config.spreadsheetFormats.includes(d.format) ? 'description' : 'code';
                const detailRows = config.distributionFields.map(f => {
                    let val = d[f.key] || (f.fallback ? d[f.fallback] : '') || '';
                    let display;
                    if (f.localized && typeof val === 'object') {
                        display = t(val) || '-';
                    } else if (f.enumPrefix && val) {
                        display = t(f.enumPrefix + '.' + val);
                    } else if (f.isLink && val) {
                        display = `<a href="${val}" target="_blank">${val}</a>`;
                    } else {
                        display = val || '-';
                    }
                    return `<div class="accordion__detail-row"><div class="accordion__detail-key">${t(f.label)}</div><div class="accordion__detail-val">${display}</div></div>`;
                }).join('');

                return `
                    <div class="accordion__item" data-index="${i}">
                        <div class="accordion__button">
                            <div class="accordion__title">${t(d.name)}</div>
                            <div class="accordion__meta">
                                <span class="material-symbols-rounded">${icon}</span>
                                <span class="accordion__format">${d.format}</span>
                                <span class="material-symbols-rounded accordion__arrow">expand_more</span>
                            </div>
                        </div>
                        <div class="accordion__drawer">${detailRows}</div>
                    </div>
                `;
            }).join('');
        } else {
            distContainer.innerHTML = `<div class="data-row">${t('detail.no_distributions')}</div>`;
        }

        const pubHtml = item.publications?.length
            ? item.publications.map(p => createDataRow(t(p.catalog), t(p.value))).join('')
            : `<div class="data-row">${t('detail.no_publications')}</div>`;
        $('#detail-dataset-publications').innerHTML = pubHtml;
    }

    // === NAVIGATION ===
    function showView(viewId) {
        config.views.forEach(id => $(`#${id}`).classList.add('hidden'));
        $(`#${viewId}`).classList.remove('hidden');
    }

    function setActiveTab(page) {
        $$('.nav-link').forEach(tab => tab.classList.remove('active'));
        const tabPage = (page === 'concept-detail') ? 'concept' : (page === 'dataset-detail') ? 'dataset' : page;
        $(`.nav-link[data-page="${tabPage}"]`)?.classList.add('active');
    }

    function setBreadcrumbs(page, title = '') {
        const crumbs = {
            concept: t('nav.concepts'),
            dataset: t('nav.datasets'),
            about: t('nav.about'),
            manual: t('nav.manual')
        };

        let html = `<a href="#/concept">${t('breadcrumb.home')}</a> <span>&gt;</span> `;

        if (page.includes('-detail')) {
            const type = page.replace('-detail', '');
            html += `<a href="#/${type}">${crumbs[type]}</a> <span>&gt;</span> ${title}`;
        } else {
            html += crumbs[page] || page;
        }

        $('#breadcrumb').innerHTML = html;
    }

    function navigate(page) {
        showView(`view-${page}-catalog`);
        setActiveTab(page);
        setBreadcrumbs(page);
        renderCatalog(page);
    }

    async function handleRoute() {
        const { type, id } = parseHash();
        applyTranslations();

        if (type === 'concept' && id) {
            renderDetail('concept', id);
        } else if (type === 'dataset' && id) {
            renderDetail('dataset', id);
        } else if (type === 'about') {
            await loadContent('about');
            showView('view-about');
            setActiveTab('about');
            setBreadcrumbs('about');
        } else if (type === 'manual') {
            await loadContent('manual');
            showView('view-manual');
            setActiveTab('manual');
            setBreadcrumbs('manual');
        } else if (type === 'dataset') {
            navigate('dataset');
        } else {
            navigate('concept');
        }
    }

    // === SHARE MODAL ===
    function openShareModal() {
        const modal = $('#share-modal');
        const urlInput = $('#share-url-input');
        const copyBtn = $('#btn-copy-url');

        urlInput.value = window.location.href;
        copyBtn.textContent = t('share.copy');
        copyBtn.classList.remove('copied');

        modal.classList.add('visible');

        const currentUrl = encodeURIComponent(window.location.href);
        $$('.share-icon-link').forEach(link => {
            const platform = link.dataset.share;
            if (config.shareUrls[platform]) {
                link.href = config.shareUrls[platform] + currentUrl;
                link.target = '_blank';
            }
        });
    }

    function closeShareModal() {
        $('#share-modal').classList.remove('visible');
    }

    function copyUrlToClipboard() {
        const urlInput = $('#share-url-input');
        const copyBtn = $('#btn-copy-url');

        navigator.clipboard.writeText(urlInput.value).then(() => {
            copyBtn.textContent = t('share.copied');
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.textContent = t('share.copy');
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            urlInput.select();
        });
    }

    // === EVENT HANDLERS ===
    function setupEventListeners() {
        // Navigation tabs
        $('#nav-tabs').addEventListener('click', e => {
            const tab = e.target.closest('.nav-link');
            if (tab) location.hash = `#/${tab.dataset.page}`;
        });

        // Language switcher
        $('#language-switcher').addEventListener('click', e => {
            const btn = e.target.closest('.language-switcher__btn');
            if (btn && !btn.classList.contains('active')) {
                switchLanguage(btn.dataset.lang);
            }
        });

        // Print button
        $('#btn-print').addEventListener('click', () => window.print());

        // Share button
        $('#btn-share').addEventListener('click', openShareModal);

        // Close modal
        $('#modal__close').addEventListener('click', closeShareModal);

        // Click outside modal to close
        $('#share-modal').addEventListener('click', e => {
            if (e.target === e.currentTarget) closeShareModal();
        });

        // Escape key to close modal
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && $('#share-modal').classList.contains('visible')) closeShareModal();
        });

        // Copy URL button
        $('#btn-copy-url').addEventListener('click', copyUrlToClipboard);

        // Filter button toggle
        document.addEventListener('click', e => {
            const filterBtn = e.target.closest('.btn-filter');
            if (filterBtn) {
                const current = parseHash();
                updateUrl({ filter: !current.filter });
            }
        });

        // Filter reset button (in panel)
        document.addEventListener('click', e => {
            if (e.target.closest('.filter-reset')) clearAllFilters();
        });

        // Reset button (in toolbar)
        document.addEventListener('click', e => {
            if (e.target.closest('.btn-reset')) clearAllFilters();
        });

        // Filter dropdown change handlers
        document.addEventListener('change', e => {
            const select = e.target.closest('.filter-select');
            if (select) {
                const id = select.id;
                if (id.startsWith('filter-system-')) updateUrl({ system: select.value });
                else if (id.startsWith('filter-personenbezogen-')) updateUrl({ personenbezogen: select.value });
                else if (id.startsWith('filter-klassifizierung-')) updateUrl({ klassifizierung: select.value });
            }
        });

        // View toggles
        document.addEventListener('click', e => {
            const toggle = e.target.closest('.toggle-icon');
            if (!toggle || toggle.classList.contains('active')) return;
            updateUrl({ view: toggle.dataset.view });
        });

        // Tag input field focus
        document.addEventListener('focusin', e => {
            const input = e.target.closest('.tag-search-input');
            if (input) {
                const type = input.dataset.type;
                renderTagDropdown(type, input.value);
                $(`#tag-dropdown-${type}`).classList.remove('hidden');
            }
        });

        // Tag search input
        document.addEventListener('input', e => {
            const input = e.target.closest('.tag-search-input');
            if (input) renderTagDropdown(input.dataset.type, input.value);
        });

        // Tag dropdown option click
        document.addEventListener('click', e => {
            const option = e.target.closest('.tag-option');
            if (option) {
                addTag(option.dataset.tag);
                const type = parseHash().type;
                const input = $(`.tag-search-input[data-type="${type}"]`);
                if (input) input.value = '';
                $(`#tag-dropdown-${type}`).classList.add('hidden');
            }
        });

        // Remove tag pill
        document.addEventListener('click', e => {
            const removeBtn = e.target.closest('.badge-filter--active .remove');
            if (removeBtn) {
                e.stopPropagation();
                removeTag(removeBtn.dataset.tag);
            }
        });

        // Click outside dropdown to close
        document.addEventListener('click', e => {
            if (!e.target.closest('.tag-form__group')) {
                $$('.tag-dropdown').forEach(d => d.classList.add('hidden'));
            }
        });

        // Tag pill click
        document.addEventListener('click', e => {
            const tagPill = e.target.closest('.badge[data-tag]');
            if (tagPill && !e.target.closest('.tag-form__group')) {
                e.stopPropagation();
                const tag = tagPill.dataset.tag;
                const current = parseHash();

                const detailView = e.target.closest('[id^="view-"][id$="-detail"]');
                if (detailView) {
                    const type = detailView.id.includes('concept') ? 'concept' : 'dataset';
                    location.hash = buildHash(type, null, { tags: [tag], view: current.view });
                } else {
                    if (!current.tags.includes(tag)) {
                        updateUrl({ tags: [...current.tags, tag] });
                    }
                }
            }
        });

        // Card/row clicks
        document.addEventListener('click', e => {
            if (e.target.closest('.badge')) return;
            const card = e.target.closest('.card');
            const row = e.target.closest('tr[data-id]');
            const target = card || row;
            if (!target) return;
            const container = target.closest('[id^="view-"]');
            if (!container) return;
            const type = container.id.includes('concept') ? 'concept' : 'dataset';
            window.location.hash = `#/${type}/${target.dataset.id}`;
        });

        // Distribution accordion
        document.addEventListener('click', e => {
            const header = e.target.closest('.accordion__button');
            if (header) header.closest('.accordion__item').classList.toggle('expanded');
        });

        // Search inputs (debounced)
        let searchTimer;
        ['concept', 'dataset'].forEach(type => {
            $(`#search-${type}`)?.addEventListener('input', () => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => renderCatalog(type), 150);
            });
        });

        // Hash change
        window.addEventListener('hashchange', handleRoute);
    }

    // === INIT ===
    async function init() {
        syncLangFromUrl();
        await loadData();
        setupEventListeners();
        handleRoute();
    }

    init();

    window.catalogState = state;
})();
