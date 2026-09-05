/* Browser preferences; failures must not prevent browsing or resizing. */
(function (DK) {
  'use strict';

  // Keep existing storage keys so saved preferences survive code refactors.
  const keys = Object.freeze({
    language: 'datenkatalog.lang',
    sidebarCollapsed: 'datenkatalog.sidebarCollapsed',
    sidebarWidth: 'datenkatalog.sidebarWidth',
  });
  DK.preferences = {
    read(name) {
      try { return localStorage.getItem(keys[name]); }
      catch { return null; }
    },
    write(name, value) {
      try {
        if (value == null) localStorage.removeItem(keys[name]);
        else localStorage.setItem(keys[name], String(value));
      } catch { /* Preferences are optional when browser storage is blocked. */ }
    },
  };
})(window.DK);
