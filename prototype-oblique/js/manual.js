/* Handbook rendering and chapter identifiers. Visible content comes from manual.json. */
(function (DK) {
  'use strict';
  const { ui, data, router } = DK;
  const { t, esc } = ui;
  const manual = {};
  const join = parts => parts.join('');

  // Legacy IDs are data aliases, not renderer names or DOM identifiers.
  manual.resolveChapter = id => (data.manual.chapters.find(chapter => chapter.id === id || (chapter.legacyId && chapter.legacyId === id)) || data.manual.chapters[0]).id;
  manual.anchorId = id => 'manual-' + id;
  manual.tree = state => `<ul class="ob-tree">${data.manual.chapters.map((chapter, index) => `<li><div class="ob-tree-row ob-tree-row--chapter${state.chapter === chapter.id ? ' is-active' : ''}" style="--level:1"><a class="ob-tree-link" href="${esc(router.href('/manual', { ch: chapter.id }))}"${state.chapter === chapter.id ? ' aria-current="location"' : ''} data-action="chapter" data-chapter="${esc(chapter.id)}"><span class="ob-tree-label" title="${esc(chapter.title)}">${index + 1}. ${esc(chapter.title)}</span></a></div></li>`).join('')}</ul>`;

  manual.render = function (headerHtml) {
    const content = data.manual, model = data.model;
    const roleColumns = [{ label: t('manual.col.inCatalog'), width: '26%' }, { label: t('manual.col.nadb'), width: '28%' }, { label: t('manual.col.task') }];
    const coreColumns = [{ label: t('manual.col.field') }, { label: t('manual.col.inCatalog') }, { label: t('manual.col.dcat') }, { label: t('manual.col.archimate') }, { label: t('manual.col.dmbok') }];
    const renderers = {
      introduction: chapter => `<div><p>${esc(chapter.intro)}</p><ul class="ob-list">${join(chapter.questions.map(question => `<li>${esc(question)}</li>`))}</ul></div>${join(chapter.sections.map(section => `<div><h3>${esc(section.title)}</h3><p>${esc(section.text)}</p></div>`))}`,
      governance: chapter => {
        const roles = ui.table(roleColumns, join(chapter.roles.map(role => ui.tr([{ html: esc(role.label), cls: 'ob-cell-strong' }, esc(role.nadb), esc(role.task)], null, roleColumns))));
        return `<div><p>${esc(chapter.intro)}</p>${roles}</div><div><h3>${esc(chapter.workflowTitle)}</h3><p>${esc(chapter.workflowIntro)}</p><ol class="ob-list">${join(chapter.workflow.map(step => `<li><strong>${esc(step.title)}</strong> (${esc(step.who)}): ${esc(step.text)}</li>`))}</ol></div><div><h3>${esc(chapter.reportTitle)}</h3><p>${esc(chapter.reportText)}</p></div>`;
      },
      model: chapter => {
        const extensions = Object.keys(model.kinds).map(kind => ({ type: model.kinds[kind].singular, en: model.kinds[kind].en, fields: (model.extensions[kind] || []).map(([field, label]) => `${field} (${label})`).join(', ') }));
        const core = ui.table(coreColumns, join(model.core.map(field => ui.tr([{ html: esc(field.field), cls: 'ob-cell-nowrap' }, esc(field.label), esc(field.dcat), esc(field.archimate), esc(field.dmbok)], null, coreColumns))));
        return `<div><p>${esc(chapter.intro)}</p><ul class="ob-list">${join(chapter.layers.map(layer => `<li><strong>${esc(layer.title)}</strong> (${esc(layer.layer)}): ${esc(layer.text)} ${esc(t('manual.example'))}: ${esc(layer.example)}.</li>`))}</ul></div>
          <div><h3>${esc(chapter.coreTitle)}</h3><p>${esc(chapter.coreIntro)}</p>${core}</div>
          <div><h3>${esc(chapter.extTitle)}</h3><ul class="ob-list">${join(extensions.map(extension => `<li><strong>${esc(extension.type)}</strong> (${esc(extension.en)}): ${esc(extension.fields)}</li>`))}</ul></div>
          <div><h3>${esc(chapter.statusTitle)}</h3><ul class="ob-list">${join(Object.entries(model.statuses).map(([status, definition]) => `<li><strong>${esc(status)}</strong>: ${esc(definition.text)}</li>`))}</ul></div>`;
      },
      usage: chapter => `<ol class="ob-list">${join(chapter.steps.map(step => `<li><strong>${esc(step.title)}</strong>: ${esc(step.text)}</li>`))}</ol>`,
      retrieval: chapter => `<ul class="ob-list"><li><strong>Export</strong>: ${esc(chapter.export)}</li><li><strong>API</strong>: ${esc(chapter.api)} <a href="#/api">${esc(t('manual.toApi'))}</a></li></ul>`,
      faq: entries => `<ul class="ob-list ob-list--loose">${join(entries.map(entry => `<li><strong>${esc(entry.q)}</strong><br>${esc(entry.a)}</li>`))}</ul>`,
      glossary: entries => `<ul class="ob-list">${join(entries.map(entry => `<li><strong>${esc(entry.term)}</strong>: ${esc(entry.text)}</li>`))}</ul>`,
      references: entries => `<ul class="ob-list">${join(entries.map(entry => `<li><strong>${esc(entry.title)}</strong> (${esc(entry.source)}): ${ui.link(entry.url, esc(entry.url), { external: true })}</li>`))}</ul>`,
    };
    const chapters = content.chapters.map((chapter, index) => {
      const render = Object.hasOwn(renderers, chapter.id) ? renderers[chapter.id] : null;
      if (!render || content[chapter.id] == null) return '';
      return `<section id="${esc(manual.anchorId(chapter.id))}" class="ob-chapter" data-chapter="${esc(chapter.id)}"><h2>${index + 1}. ${esc(chapter.title)}</h2>${render(content[chapter.id])}</section>`;
    }).join('');
    return `<div class="ob-manual-content">${headerHtml}<div class="ob-manual-chapters">${chapters}</div></div>`;
  };
  DK.manual = manual;
})(window.DK);
