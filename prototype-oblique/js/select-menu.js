/* Native selects retain values/form integration; their visible controls reuse catalog menus. */
(function (DK) {
  'use strict';
  const { ui } = DK;
  ui.selectMenus = function (root, signal) {
    const buttons = new WeakMap();
    let active = null;
    const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal });
    function close(restore = false) {
      if (!active) return false;
      const { button, menu } = active; active = null;
      button.setAttribute('aria-expanded', 'false');
      menu.remove();
      if (restore && button.isConnected) button.focus({ preventScroll: true });
      return true;
    }
    function position() {
      if (!active) return;
      const { button, menu } = active;
      if (!button.isConnected || !button.checkVisibility()) { close(); return; }
      const bounds = button.getBoundingClientRect(), viewport = window.visualViewport;
      const inset = parseFloat(getComputedStyle(root).getPropertyValue('--ob-space-sm'));
      const top = viewport?.scale === 1 ? viewport.offsetTop : 0;
      const height = viewport?.scale === 1 ? viewport.height : innerHeight;
      menu.style.maxHeight = Math.max(0, height - inset * 2) + 'px';
      menu.style.minWidth = Math.min(bounds.width, innerWidth - inset * 2) + 'px';
      menu.style.left = Math.max(inset, Math.min(bounds.left, innerWidth - menu.offsetWidth - inset)) + 'px';
      const below = bounds.bottom + inset;
      const y = below + menu.offsetHeight <= top + height - inset ? below : bounds.top - menu.offsetHeight - inset;
      menu.style.top = Math.max(top + inset, Math.min(y, top + height - menu.offsetHeight - inset)) + 'px';
    }
    function show(select, button, last = false) {
      if (button.disabled) return;
      if (active?.button === button) { close(true); return; }
      close();
      const menu = document.createElement('div');
      menu.className = 'ob-menu ob-menu--select'; menu.setAttribute('popover', 'auto'); menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', select.parentElement.dataset.selectLabel);
      menu.innerHTML = [...select.options].map((option, index) => option.hidden ? '' : `<button type="button" class="ob-menu-item${option.selected ? ' is-active' : ''}" role="menuitemradio" aria-checked="${option.selected}" tabindex="-1" data-select-option="${index}"${option.disabled ? ' disabled' : ''}>${ui.esc(option.label)}</button>`).join('');
      // Nested settings menus must remain inside the parent popover's top-layer hierarchy.
      (select.closest('[popover]') || root).appendChild(menu);
      active = { select, button, menu }; button.setAttribute('aria-expanded', 'true');
      menu.showPopover(); position();
      const items = menu.querySelectorAll('button:not(:disabled)');
      (last ? items[items.length - 1] : menu.querySelector('[aria-checked="true"]:not(:disabled)') || items[0])?.focus();
      menu.addEventListener('toggle', event => { if (event.newState === 'closed' && active?.menu === menu) close(); });
    }
    function refresh() {
      root.querySelectorAll('.ob-select-menu > select').forEach(select => {
        let button = buttons.get(select);
        if (!button) {
          button = document.createElement('button'); button.type = 'button';
          button.className = 'ob-button ob-button--menu'; button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
          select.setAttribute('aria-hidden', 'true'); select.tabIndex = -1;
          select.after(button); buttons.set(select, button);
        }
        const host = select.parentElement, label = select.selectedOptions[0]?.label || '—';
        const content = ui.buttonContent(label, { icon: host.dataset.selectIcon, menu: true });
        if (button.innerHTML !== content) button.innerHTML = content;
        if (button.disabled !== select.disabled) button.disabled = select.disabled;
        const accessibleLabel = `${host.dataset.selectLabel}: ${label}`;
        if (button.getAttribute('aria-label') !== accessibleLabel) button.setAttribute('aria-label', accessibleLabel);
      });
      if (active && (!active.button.isConnected || active.button.disabled)) close();
      if (active) {
        active.menu.querySelectorAll('[data-select-option]').forEach(item => {
          const selected = Number(item.dataset.selectOption) === active.select.selectedIndex;
          if (item.getAttribute('aria-checked') !== String(selected)) {
            item.setAttribute('aria-checked', String(selected)); item.classList.toggle('is-active', selected);
          }
        });
        position();
      }
    }
    listen(root, 'click', event => {
      const trigger = event.target.closest('.ob-select-menu > button');
      if (trigger) { event.stopPropagation(); show(trigger.previousElementSibling, trigger); return; }
      const option = event.target.closest('[data-select-option]');
      if (!option || !active || option.disabled) return;
      event.stopPropagation();
      const { select } = active;
      select.selectedIndex = Number(option.dataset.selectOption);
      close(true); refresh();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, { capture: true });
    listen(root, 'keydown', event => {
      const trigger = event.target.closest('.ob-select-menu > button');
      if (trigger && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); show(trigger.previousElementSibling, trigger, event.key === 'ArrowUp'); return;
      }
      if (!active) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'Tab') close(true);
      else if (active.menu.contains(event.target)) ui.menuKeydown(event, active.menu);
    }, { capture: true });
    listen(root, 'scroll', event => { if (!active?.menu.contains(event.target)) position(); }, { capture: true, passive: true });
    listen(window, 'resize', position);
    if (window.visualViewport) {
      listen(visualViewport, 'resize', position); listen(visualViewport, 'scroll', position);
    }
    signal.addEventListener('abort', () => close(), { once: true });
    refresh();
    return { refresh, close, focus: select => buttons.get(select)?.focus({ preventScroll: true }) };
  };
})(window.DK);
