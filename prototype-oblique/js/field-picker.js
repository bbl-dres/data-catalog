/* Immediate visibility choices shared by collection and print controls. */
(function (DK) {
  'use strict';
  const { ui, presentation } = DK, esc = ui.esc;
  let active;
  const label = kind => `${ui.t('visibility.label')} (${presentation.selected(kind).length})`;
  const checklist = (fields, selected, { name = 'visible-field', translate = ui.t } = {}) => fields.map(f => `<label class="ob-check"><input type="checkbox" name="${esc(name)}" value="${esc(f.id)}"${f.required || selected.includes(f.id) ? ' checked' : ''}${f.required ? ' disabled data-fixed' : ''}><span>${esc(f.labelText || translate(f.label))}${f.required ? ` <span class="ob-field-required">${esc(translate('visibility.fixed'))}</span>` : ''}</span></label>`).join('');
  function close(restore = false) {
    if (!active) return;
    const { node, trigger, events } = active; active = null; events.abort(); node.remove();
    trigger.setAttribute('aria-expanded', 'false');
    if (restore && trigger.isConnected) trigger.focus({ preventScroll: true });
  }
  function open(trigger, kind, applied) {
    close();
    const definitions = presentation.choices(kind), node = document.createElement('div'), events = new AbortController();
    const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: events.signal });
    node.className = 'ob-field-picker'; node.popover = 'auto'; node.setAttribute('role', 'dialog'); node.setAttribute('aria-labelledby', 'field-picker-title');
    node.innerHTML = `<h3 id="field-picker-title">${esc(ui.t('visibility.title'))}</h3><div class="ob-field-picker-body">${checklist(definitions, presentation.selected(kind))}</div><div class="ob-field-picker-actions"><button type="button" class="ob-button" data-fields-reset>${esc(ui.t('visibility.reset'))}</button><button type="button" class="ob-button" data-fields-close>${esc(ui.t('visibility.close'))}</button></div>`;
    active = { node, trigger, events }; document.body.appendChild(node); trigger.setAttribute('aria-expanded', 'true');
    const update = () => {
      presentation.save(kind, [...node.querySelectorAll('input:checked')].map(input => input.value));
      applied();
      trigger.querySelector('.ob-button-label').textContent = label(kind);
      position();
    };
    const position = () => {
      if (!trigger.isConnected) { close(); return; }
      const box = trigger.getBoundingClientRect(), styles = getComputedStyle(document.documentElement);
      const inset = parseFloat(styles.getPropertyValue('--ob-space-sm'));
      const viewport = window.visualViewport, top = viewport?.scale === 1 ? viewport.offsetTop : 0;
      const bottom = top + (viewport?.scale === 1 ? viewport.height : innerHeight);
      const below = bottom - box.bottom - inset * 2, above = box.top - top - inset * 2;
      node.style.maxHeight = Math.min(parseFloat(styles.getPropertyValue('--ob-field-picker-max-height')), Math.max(above, below), bottom - top - inset * 2) + 'px';
      node.style.left = Math.max(inset, Math.min(box.right - node.offsetWidth, innerWidth - node.offsetWidth - inset)) + 'px';
      const preferredTop = node.offsetHeight <= below ? box.bottom + inset : box.top - node.offsetHeight - inset;
      node.style.top = Math.max(top + inset, Math.min(preferredTop, bottom - node.offsetHeight - inset)) + 'px';
    };
    listen(node, 'click', event => {
      event.stopPropagation();
      if (event.target.closest('[data-fields-close]')) close(true);
      if (event.target.closest('[data-fields-reset]')) {
        node.querySelectorAll('input').forEach(input => { input.checked = presentation.defaults(kind).includes(input.value); }); update();
      }
    });
    listen(node, 'change', event => { event.stopPropagation(); update(); });
    listen(node, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } });
    listen(node, 'toggle', event => { if (event.newState === 'closed') close(false); });
    listen(window, 'resize', position); listen(window, 'scroll', position);
    if (window.visualViewport) { listen(visualViewport, 'resize', position); listen(visualViewport, 'scroll', position); }
    node.showPopover(); position(); node.querySelector('input:not(:disabled)')?.focus();
  }
  const button = kind => `<button type="button" class="ob-button ob-button--menu" data-action="field-picker" data-field-picker="${esc(kind)}" aria-haspopup="dialog" aria-expanded="false">${ui.buttonContent(label(kind), { menu: true })}</button>`;
  DK.fieldPicker = { checklist, button, open, close };
})(window.DK);
