/* Shared access descriptions for profiles and exports; endpoint URLs retain their source. */
(function (DK) {
  'use strict';
  const { ui } = DK, t = ui.t, esc = ui.esc;
  const supports = kind => ['tables', 'products', 'apis'].includes(kind);
  const authored = (entity, kind = entity.kind) => supports(kind) ? (entity._record?.access_options || entity.accessOptions || []).filter(item => !item.isArchived) : [];
  const httpUrl = value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !/[\s\\]/.test(value) ? value : null; }
    catch { return null; }
  };
  const field = (key, value, link = false) => ({ label: t(key), value, link });
  function entries(entity, kind = entity.kind) {
    if (!supports(kind)) return [];
    const result = authored(entity, kind).map(item => ({ id: 'access-' + item.id, name: ui.localized(item, 'name_'), format: item.format,
      fields: [field('access.format', item.format), field('fact.status', t('edit.value.' + item.status)),
        field('access.accessUrl', item.accessUrl, true), field('access.downloadUrl', item.downloadUrl, true),
        field('access.accessNotes', item.accessNotes), field('access.license', item.license), field('fact.comment', item.comment)] }));
    if (kind === 'apis') {
      const endpoints = entity.endpoints?.length ? entity.endpoints : entity.endpointURL ? [{ identifier: 'primary', url: entity.endpointURL, protocol: entity.protocol }] : [];
      endpoints.filter(endpoint => !endpoint.is_archived).forEach((endpoint, index) => result.push({
        id: 'endpoint-' + (endpoint.id || index), name: endpoint.operation_name || endpoint.identifier || t('excel.endpoint'), format: endpoint.protocol,
        fields: [field('edit.protocol', endpoint.protocol), field('edit.endpointUrl', endpoint.url, true),
          field('edit.relativePath', endpoint.relative_path), field('edit.operationName', endpoint.operation_name), field('edit.httpMethod', endpoint.http_method),
          field('edit.environment', endpoint.environment ? t('edit.value.' + endpoint.environment) : null),
          field('edit.readOnly', typeof endpoint.is_read_only === 'boolean' ? t(endpoint.is_read_only ? 'yes' : 'no') : null),
          field('edit.bulk', typeof endpoint.supports_bulk === 'boolean' ? t(endpoint.supports_bulk ? 'yes' : 'no') : null),
          field('edit.authenticationMethods', endpoint.authentication_methods?.join(', ')), field('access.accessNotes', entity.accessRights)]
      }));
    }
    return result;
  }
  const value = f => f.value == null || f.value === '' ? '—' : String(f.value);
  const summary = (entity, kind = entity.kind) => entries(entity, kind).map(entry => [entry.name, ...entry.fields.filter(f => f.value != null && f.value !== '').map(f => `${f.label}: ${value(f)}`)].join('\n')).join('\n\n');
  function render(entity, state = {}) {
    if (!supports(entity.kind)) return '';
    const items = entries(entity), sectionExpanded = state.detailSections?.['ob-access-options'] ?? true;
    return `<section class="ob-access-options" aria-labelledby="access-options-title"><h2 id="access-options-title"><button type="button" id="ob-access-options-toggle" class="ob-detail-section-toggle" data-action="toggle-detail-section" data-section="ob-access-options" aria-expanded="${sectionExpanded}" aria-controls="ob-access-options-content">${esc(t('access.title'))}${ui.icon('chevron_down', 'sm')}</button></h2><div id="ob-access-options-content"${sectionExpanded ? '' : ' hidden'}>${items.length ? `<div class="ob-access-options-list">${items.map(item => {
      const id = 'ob-' + item.id, expanded = state.detailSections?.[id] === true;
      const rows = item.fields.map(f => `<dt>${esc(f.label)}</dt><dd>${f.link && httpUrl(f.value) ? ui.link(f.value, `${esc(f.value)} ${ui.icon('link_external', 'sm')}`, { external: true, className: 'ob-inline-link' }) : esc(value(f))}</dd>`).join('');
      return `<section class="ob-access-option"><h3><button type="button" id="${esc(id)}-toggle" class="ob-detail-section-toggle" data-action="toggle-detail-section" data-section="${esc(id)}" aria-expanded="${expanded}" aria-controls="${esc(id)}-content"><span class="ob-access-option-title">${esc(item.name)}</span>${item.format ? `<span class="ob-access-option-format">${esc(item.format)}</span>` : ''}${ui.icon('chevron_down', 'sm')}</button></h3><dl class="ob-facts" id="${esc(id)}-content"${expanded ? '' : ' hidden'}>${rows}</dl></section>`;
    }).join('')}</div>` : `<p class="ob-context-note">${esc(t('access.empty'))}</p>`}</div></section>`;
  }
  DK.accessOptions = { supports, authored, entries, summary, render, httpUrl };
})(window.DK);
