/* Public connection settings. Never put a secret key or database password here.
   Loaded first: it creates the DK namespace so boot.js can start the catalog request. */
window.DK = window.DK || {};
window.DK.catalogConfig = Object.freeze({
  provider: 'supabase',
  authRecovery: 'administrator',
  url: 'https://zicluerzbevodlmtbxow.supabase.co',
  publishableKey: 'sb_publishable_i-F2Z-SvidOUNYK92vps8g_qf0oTRfT',
});
