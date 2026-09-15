/* Immediate visibility choices shared by collection and print controls. */
(function (DK) {
  'use strict';
  const { ui, presentation } = DK, esc = ui.esc;
  let active, dismissed = null; // { trigger, at }: light dismiss by a press on the trigger; its click must not re-open
  const label = kind => `${ui.t('visibility.label')} (${presentation.selected(kind).length})`;
  const checklist = (fields, selected, { name = 'visible-field', translate = ui.t } = {}) => fields.map(f => `<label class="ob-check"><input type="checkbox" name="${esc(name)}" value="${esc(f.id)}"${f.required || selected.includes(f.id) ? ' checked' : ''}${f.required ? ' disabled data-fixed' : ''}><span>${esc(f.labelText || translate(f.label))}${f.required ? ` <span class="ob-field-required">${esc(translate('visibility.fixed'))}</span>` : ''}</span></label>`).join('');
  function close(restore = false) {
    if (!active) return;
    const { node, trigger, events } = active; active = null; events.abort(); node.remove();
    trigger.setAttribute('aria-expanded', 'false');
    if (restore && trigger.isConnected) trigger.focus({ preventScroll: true });
  }
  function open(trigger, kind, applied) {
    if (dismissed?.trigger === trigger && performance.now() - dismissed.at < 1000) { dismissed = null; return; }
    dismissed = null;
    if (active?.trigger === trigger) { close(true); return; } // keyboard activation of the open trigger
    close();
    const definitions = presentation.choices(kind), node = document.createElement('div'), events = new AbortController();
    const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: events.signal });
    node.className = 'ob-field-picker ob-choice-popover'; node.popover = 'auto'; node.setAttribute('role', 'dialog'); node.setAttribute('aria-labelledby', 'field-picker-title');
    node.innerHTML = `<h3 id="field-picker-title">${esc(ui.t('visibility.title'))}</h3><div class="ob-field-picker-body ob-choice-popover-body">${checklist(definitions, presentation.selected(kind))}</div><div class="ob-field-picker-actions ob-choice-popover-actions"><button type="button" class="ob-button" data-fields-reset>${esc(ui.t('visibility.reset'))}</button><button type="button" class="ob-button" data-fields-close>${esc(ui.t('visibility.close'))}</button></div>`;
    active = { node, trigger, events }; document.body.appendChild(node); trigger.setAttribute('aria-expanded', 'true');
    const update = () => {
      presentation.save(kind, [...node.querySelectorAll('input:checked')].map(input => input.value));
      applied();
      trigger.querySelector('.ob-button-label').textContent = label(kind);
      position();
    };
    const position = () => {
      if (!trigger.isConnected) { close(); return; }
      const maxHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ob-field-picker-max-height'));
      ui.anchorPopover(node, trigger, { align: 'end', maxHeight }); // the trigger ends the local actions row
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
    let pressedTrigger = false;
    listen(document, 'pointerdown', event => { pressedTrigger = trigger.contains(event.target); }, { capture: true });
    listen(node, 'toggle', event => { if (event.newState === 'closed') { if (pressedTrigger) dismissed = { trigger, at: performance.now() }; close(false); } });
    listen(window, 'resize', position); listen(window, 'scroll', position);
    if (window.visualViewport) { listen(visualViewport, 'resize', position); listen(visualViewport, 'scroll', position); }
    node.showPopover(); position(); node.querySelector('input:not(:disabled)')?.focus();
  }
  const button = kind => `<button type="button" class="ob-button ob-button--menu" data-action="field-picker" data-field-picker="${esc(kind)}" aria-haspopup="dialog" aria-expanded="false">${ui.buttonContent(label(kind), { menu: true })}</button>`;
  DK.fieldPicker = { checklist, button, open, close };
})(window.DK);
