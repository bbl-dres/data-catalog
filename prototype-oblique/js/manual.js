/* Handbook rendering and chapter identifiers. Visible content comes from manual.json. */
(function (DK) {
  'use strict';
  const { ui, data, router } = DK;
  const { t, esc } = ui;
  const manual = {};
  const join = parts => parts.join('');

  // Only reference links are markup: [readable label][source-id]. All text is
  // escaped and destinations go through the shared URL guard; no raw HTML.
  manual.text = value => {
    const valueText = String(value ?? '');
    let html = '', offset = 0;
    for (const match of valueText.matchAll(/\[([^\]\r\n]+)\]\[([a-z0-9-]+)\]/g)) {
      const source = data.manual.references.find(entry => entry.id === match[2]);
      html += esc(valueText.slice(offset, match.index));
      html += source ? ui.link(source.url, esc(match[1]), { external: true }) : esc(match[0]);
      offset = match.index + match[0].length;
    }
    return html + esc(valueText.slice(offset));
  };

  manual.video = video => video ? `<figure class="ob-manual-video">
    <button type="button" class="ob-video-preview" data-action="manual-video-preview" aria-label="${esc(video.actionLabel)}" aria-controls="manual-video-transcript" aria-describedby="manual-video-caption">
      <img src="assets/manual-explainer-placeholder.jpg" width="1672" height="941" alt="" decoding="async">
      <span class="ob-video-title" aria-hidden="true"><span class="ob-video-avatar">BBL</span>${esc(video.title)}</span>
      <span class="ob-video-play" aria-hidden="true"><span class="ob-video-triangle"></span></span>
      <span class="ob-video-timeline" aria-hidden="true"></span>
      <span class="ob-video-bar" aria-hidden="true"><span class="ob-video-triangle"></span><span class="ob-video-volume"></span><span>0:00 / ${esc(video.duration)}</span>${ui.icon('expand', 'sm')}</span>
    </button>
    <figcaption id="manual-video-caption">${esc(video.caption)}</figcaption>
    <details id="manual-video-transcript" class="ob-video-transcript"><summary>${esc(video.transcriptTitle)}</summary><ol class="ob-list">${video.scenes.map(scene => `<li><strong>${esc(scene.time)} · ${esc(scene.title)}</strong><p>${manual.text(scene.text)}</p></li>`).join('')}</ol></details>
  </figure>` : '';

  // Legacy IDs are data aliases, not renderer names or DOM identifiers.
  manual.resolveChapter = id => (data.manual.chapters.find(chapter => chapter.id === id || (chapter.legacyId && chapter.legacyId === id)) || data.manual.chapters[0]).id;
  manual.anchorId = id => 'manual-' + id;
  manual.tree = state => `<ul class="ob-tree">${data.manual.chapters.map((chapter, index) => `<li><div class="ob-tree-row ob-tree-row--chapter${state.chapter === chapter.id ? ' is-active' : ''}" style="--level:1"><a class="ob-tree-link" href="${esc(router.href('/manual', { ch: chapter.id }))}"${state.chapter === chapter.id ? ' aria-current="location"' : ''} data-action="chapter" data-chapter="${esc(chapter.id)}"><span class="ob-tree-label" title="${esc(chapter.title)}">${index + 1}. ${esc(chapter.title)}</span></a></div></li>`).join('')}</ul>`;

  manual.render = function (headerHtml) {
    const content = data.manual, model = data.model, text = manual.text;
    const roleColumns = [{ label: t('manual.col.inCatalog'), width: '26%' }, { label: t('manual.col.nadb'), width: '28%' }, { label: t('manual.col.task') }];
    const coreColumns = [{ label: t('manual.col.field') }, { label: t('manual.col.inCatalog') }];
    const renderers = {
      introduction: chapter => `<div><p>${text(chapter.intro)}</p><ul class="ob-list">${join(chapter.questions.map(question => `<li>${text(question)}</li>`))}</ul></div>${manual.video(chapter.video)}${join(chapter.sections.map(section => `<div><h3>${esc(section.title)}</h3><p>${text(section.text)}</p></div>`))}`,
      governance: chapter => {
        const roles = ui.table(roleColumns, join(chapter.roles.map(role => ui.tr([{ html: esc(role.label), cls: 'ob-cell-strong' }, text(role.nadb), text(role.task)], null, roleColumns))));
        return `<div><p>${text(chapter.intro)}</p>${roles}</div><div><h3>${esc(chapter.workflowTitle)}</h3><p>${text(chapter.workflowIntro)}</p><ol class="ob-list">${join(chapter.workflow.map(step => `<li><strong>${esc(step.title)}</strong> (${esc(step.who)}): ${text(step.text)}</li>`))}</ol></div><div><h3>${esc(chapter.reportTitle)}</h3><p>${text(chapter.reportText)}</p></div>`;
      },
      model: chapter => {
        const extensions = Object.keys(model.kinds).map(kind => ({ type: model.kinds[kind].singular, en: model.kinds[kind].en, fields: (model.extensions[kind] || []).map(([field, label]) => `${field} (${['valueType', 'dataType'].includes(field) ? t('fact.format') : label})`).join(', ') }));
        const core = ui.table(coreColumns, join(model.core.map(field => ui.tr([{ html: esc(field.field), cls: 'ob-cell-nowrap' }, esc(field.label)], null, coreColumns))));
        return `<div><p>${text(chapter.intro)}</p><ul class="ob-list">${join(chapter.layers.map(layer => `<li><strong>${esc(layer.title)}</strong> (${esc(layer.layer)}): ${text(layer.text)} ${esc(t('manual.example'))}: ${text(layer.example)}.</li>`))}</ul></div>
          <div><h3>${esc(chapter.coreTitle)}</h3><p>${text(chapter.coreIntro)}</p>${core}</div>
          <div><h3>${esc(chapter.extTitle)}</h3><ul class="ob-list">${join(extensions.map(extension => `<li><strong>${esc(extension.type)}</strong> (${esc(extension.en)}): ${esc(extension.fields)}</li>`))}</ul></div>
          <div><h3>${esc(chapter.statusTitle)}</h3><p>${text(chapter.statusNote)}</p><ul class="ob-list">${join(Object.entries(model.statuses).map(([status, definition]) => `<li><strong>${esc(status)}</strong>: ${esc(definition.text)}</li>`))}</ul></div>`;
      },
      usage: chapter => `<ol class="ob-list">${join(chapter.steps.map(step => `<li><strong>${esc(step.title)}</strong>: ${text(step.text)}</li>`))}</ol>`,
      retrieval: chapter => `<ul class="ob-list"><li><strong>Export</strong>: ${text(chapter.export)}</li><li><strong>API</strong>: ${text(chapter.api)} <a href="#/api">${esc(t('manual.toApi'))}</a></li></ul>`,
      faq: entries => `<ul class="ob-list ob-list--loose">${join(entries.map(entry => `<li><strong>${esc(entry.q)}</strong><br>${text(entry.a)}</li>`))}</ul>`,
      glossary: entries => `<ul class="ob-list">${join(entries.map(entry => `<li><strong>${text(entry.term)}</strong>: ${text(entry.text)}</li>`))}</ul>`,
      references: entries => `<ul class="ob-list">${join(entries.map(entry => `<li>${ui.link(entry.url, esc(entry.title), { external: true })} (${esc(entry.source)})</li>`))}</ul>`,
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
