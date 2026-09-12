/* sidebar.js – desktop splitter; changes geometry without re-rendering the tree. */
(function (DK) {
  'use strict';
  const root = document.documentElement;
  let preferred = null, drag = null, frame = null, tokens = null, applied = null;
  const sidebar = {};
  // The width tokens are constants of tokens.css: reading them once per resize avoids a style
  // recalculation on every render, which sync() runs right after the page markup was replaced.
  const readTokens = () => {
    const css = getComputedStyle(root);
    const px = name => parseFloat(css.getPropertyValue(name));
    return { min: px('--ob-sidebar-min-width'), max: px('--ob-sidebar-max-width'), contentMin: px('--ob-sidebar-content-min-width'), initial: px('--ob-sidebar-default-width'), step: px('--ob-space-default') };
  };
  const bounds = () => {
    tokens ||= readTokens();
    const available = document.querySelector('.ob-workspace')?.clientWidth || root.clientWidth;
    return { min: tokens.min, max: Math.max(tokens.min, Math.min(tokens.max, available - tokens.contentMin)), initial: tokens.initial, step: tokens.step };
  };
  const clamp = (width, limits) => Math.round(Math.max(limits.min, Math.min(limits.max, width)));
  const apply = (width, limits = bounds()) => {
    const actual = clamp(width ?? preferred ?? limits.initial, limits);
    // An unchanged width is not written: the root property invalidates the whole document's styles.
    if (actual !== applied) { root.style.setProperty('--ob-sidebar-width', actual + 'px'); applied = actual; }
    const handle = document.getElementById('sidebar-resizer');
    if (handle) {
      handle.setAttribute('aria-valuemin', limits.min);
      handle.setAttribute('aria-valuemax', limits.max);
      handle.setAttribute('aria-valuenow', actual);
      handle.setAttribute('aria-valuetext', DK.ui.t('navigation.width', { width: actual }));
    }
    return actual;
  };
  const persist = () => DK.preferences.write('sidebarWidth', preferred);
  function finish(commit) {
    if (!drag) return;
    const ended = drag;
    drag = null;
    if (frame != null) { cancelAnimationFrame(frame); frame = null; }
    root.classList.remove('ob-sidebar-resizing');
    if (ended.handle.hasPointerCapture(ended.pointerId)) ended.handle.releasePointerCapture(ended.pointerId);
    if (commit && ended.moved) { preferred = ended.width; persist(); }
    apply();
  }
  const reset = () => { finish(false); preferred = null; persist(); apply(); };
  sidebar.cancel = () => finish(false);
  sidebar.sync = () => { if (drag) finish(false); apply(); };
  sidebar.onKeydown = event => {
    if (drag && event.key === 'Escape') { event.preventDefault(); finish(false); return true; }
    if (!event.target.matches('#sidebar-resizer')) return false;
    const limits = bounds();
    const width = Number(event.target.getAttribute('aria-valuenow'));
    let next;
    if (event.key === 'ArrowLeft') next = width - limits.step;
    else if (event.key === 'ArrowRight') next = width + limits.step;
    else if (event.key === 'Home') next = limits.min;
    else if (event.key === 'End') next = limits.max;
    else if (event.key === 'Enter') { event.preventDefault(); reset(); return true; }
    else return false;
    event.preventDefault();
    preferred = clamp(next, limits); persist(); apply();
    return true;
  };
  sidebar.init = function () {
    const saved = DK.preferences.read('sidebarWidth'), number = Number(saved);
    if (saved?.trim() && Number.isFinite(number) && number > 0) preferred = number;
    document.addEventListener('pointerdown', event => {
      const handle = event.target.closest('#sidebar-resizer');
      if (!handle || event.button !== 0 || !['mouse', 'pen'].includes(event.pointerType) || !handle.getClientRects().length) return;
      event.preventDefault();
      finish(false);
      const width = Number(handle.getAttribute('aria-valuenow'));
      drag = { handle, pointerId: event.pointerId, x: event.clientX, start: width, width, moved: false, limits: bounds() };
      handle.setPointerCapture(event.pointerId);
      handle.focus({ preventScroll: true });
      root.classList.add('ob-sidebar-resizing');
    });
    document.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!(event.buttons & 1)) { finish(false); return; }
      drag.moved ||= event.clientX !== drag.x;
      drag.width = clamp(drag.start + event.clientX - drag.x, drag.limits);
      if (frame == null) frame = requestAnimationFrame(() => { frame = null; if (drag) apply(drag.width, drag.limits); });
    });
    document.addEventListener('pointerup', event => { if (event.pointerId === drag?.pointerId) finish(true); });
    document.addEventListener('pointercancel', event => { if (event.pointerId === drag?.pointerId) finish(false); });
    document.addEventListener('lostpointercapture', event => { if (event.pointerId === drag?.pointerId) finish(false); });
    document.addEventListener('dblclick', event => { if (event.target.closest('#sidebar-resizer')) { event.preventDefault(); reset(); } });
    window.addEventListener('blur', sidebar.cancel);
    // Clamp the visible width for a small laptop without overwriting the desktop preference.
    window.addEventListener('resize', () => { tokens = null; sidebar.sync(); }, { passive: true });
  };
  DK.sidebar = sidebar;
})(window.DK);
