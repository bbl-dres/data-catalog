/* Supabase Auth owns tokens, persistence, refresh and cross-tab session events.
   This module owns only account presentation; catalog access is enforced by SQL RLS. */
(function (DK) {
  'use strict';
  const ui = DK.ui, t = ui.t, esc = ui.esc;
  let client = null, user = null, ready = false, unavailable = false;
  let dialog = null, mode = 'login', busy = false, recovery = false, refreshHeader = () => {};
  let initialization;
  let tokenVisible = false, tokenBusy = false;

  function tokenPanel() {
    return `<section class="ob-auth-api" aria-labelledby="auth-api-title"><h3 id="auth-api-title">${esc(t('auth.apiToken'))}</h3><p>${esc(t('auth.apiTokenHint'))}</p><div class="ob-auth-api-actions"><button type="button" class="ob-button" data-auth="show-token">${esc(t('auth.showToken'))}</button><button type="button" class="ob-button" data-auth="copy-token">${esc(t('auth.copyToken'))}</button></div><textarea id="auth-api-token" class="ob-input" readonly rows="4" spellcheck="false" aria-label="${esc(t('auth.apiToken'))}" hidden></textarea><p id="auth-api-expiry" hidden></p><p id="auth-api-message" role="status" aria-live="polite"></p></section>`;
  }
  async function accessSession() {
    await initialization;
    const id = user?.id;
    if (!client || !id) throw new Error('Sign in to use the API');
    const {data,error} = await client.auth.getSession();
    const session = data?.session;
    if (error || !session?.access_token || !session.expires_at || session.expires_at * 1000 <= Date.now() || session.user.id !== id || user?.id !== id) throw new Error('Session unavailable');
    return session;
  }
  function tokenDetails(session) {
    if (!dialog?.open || mode !== 'account') return;
    const input = dialog.querySelector('#auth-api-token'), expiry = dialog.querySelector('#auth-api-expiry');
    if (!input || !expiry) return;
    input.value = tokenVisible ? session.access_token : ''; input.hidden = !tokenVisible;
    expiry.textContent = t('auth.tokenExpires',{time:new Date(session.expires_at * 1000).toLocaleString(ui.language())}); expiry.hidden = false;
    dialog.querySelector('[data-auth="show-token"]').textContent = t(tokenVisible ? 'auth.hideToken' : 'auth.showToken');
  }
  async function useToken(copy) {
    if (tokenBusy || busy || mode !== 'account') return;
    if (!copy && tokenVisible) {
      tokenVisible = false; dialog.querySelector('#auth-api-token').value=''; dialog.querySelector('#auth-api-token').hidden=true;
      dialog.querySelector('[data-auth="show-token"]').textContent=t('auth.showToken'); return;
    }
    const id = user?.id, panel = dialog.querySelector('.ob-auth-api');
    tokenBusy = true; panel.querySelectorAll('button').forEach(button=>button.disabled=true);
    try {
      const session = await accessSession();
      if (!dialog.open || !panel.isConnected || user?.id !== id) return;
      let copied = false;
      if (copy) {
        try { await navigator.clipboard.writeText(session.access_token); copied = true; }
        catch { /* Show and select the token for manual copying below. */ }
      }
      if (!dialog.open || !panel.isConnected || user?.id !== id) return;
      if (!copy || !copied) tokenVisible=true;
      if (copy) panel.querySelector('#auth-api-message').textContent=t(copied ? 'auth.tokenCopied' : 'auth.tokenCopyManual');
      tokenDetails(session);
      if (tokenVisible) { panel.querySelector('textarea').focus(); panel.querySelector('textarea').select(); }
    } catch { if (panel.isConnected) panel.querySelector('#auth-api-message').textContent=t('auth.errorSession'); }
    finally { tokenBusy=false; if(panel.isConnected) panel.querySelectorAll('button').forEach(button=>button.disabled=busy); }
  }

  // Apply the same URL/key restrictions as the catalog and never follow credential-bearing redirects.
  function authFetch(input, init) {
    const timeout = AbortSignal.timeout(20000);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, credentials: 'omit', redirect: 'error', signal });
  }

  function notify(event, session) {
    const previousId=user?.id;
    user = session?.user ? { id: session.user.id, email: session.user.email || '' } : null;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') recovery = false;
    refreshHeader();
    if (session && tokenVisible && previousId===user?.id) tokenDetails(session);
    setTimeout(() => DK.editor?.onAuthChange(), 0);
    // Keep the SDK callback synchronous: calling another auth method here can deadlock its lock.
    if (dialog && !busy) {
      if (event === 'PASSWORD_RECOVERY') show('password');
      else if (dialog.open && ((user && mode === 'login') || (!user && ['account', 'password'].includes(mode)) || (user && previousId!==user.id && mode==='account'))) show(user ? 'account' : 'login');
    }
  }

  async function initialize() {
    if (DK.catalogConfig?.provider !== 'supabase') { ready = true; return; }
    const url = new URL(location.href);
    const code = url.searchParams.get('code');
    const fragment = new URLSearchParams(url.hash.startsWith('#/') ? '' : url.hash.slice(1));
    const emailCallback = fragment.has('access_token') || fragment.has('refresh_token');
    const emailType = fragment.get('type');
    const fragmentError = fragment.has('error');
    const callbackError = url.searchParams.has('error') || fragmentError;
    if (fragmentError || emailCallback) {
      // Dashboard invitations use an implicit email callback, not the app's PKCE reset flow.
      // Remove credentials before the router or an export can capture the page URL.
      url.hash = '#/';
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
    try {
      const target = DK.catalog.connection(DK.catalogConfig);
      client = window.supabase.createClient(target.base.origin, target.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
        global: { fetch: authFetch },
      });
      client.auth.onAuthStateChange(notify);
      // setSession verifies an email callback with Auth before exposing its user to the UI.
      let result;
      if (emailCallback) {
        const supported = ['invite', 'recovery', 'magiclink', 'signup', 'email_change'].includes(emailType);
        result = supported && !code && !callbackError && fragment.get('access_token') && fragment.get('refresh_token')
          ? await client.auth.setSession({ access_token: fragment.get('access_token'), refresh_token: fragment.get('refresh_token') })
          : { error: new Error('Invalid email callback') };
      } else result = code ? await client.auth.exchangeCodeForSession(code) : await client.auth.getSession();
      if (result.error || callbackError) {
        if (code || emailCallback || callbackError) recovery = 'error';
      } else {
        if (emailCallback && result.data.session && ['invite', 'recovery'].includes(emailType)) recovery = true;
        notify('RESTORED', result.data.session);
      }
    } catch {
      if (client && (code || emailCallback || callbackError)) recovery = 'error';
      else unavailable = true;
    }
    finally {
      if (code || callbackError) {
        ['code', 'sb_flow_id', 'error', 'error_code', 'error_description'].forEach(key => url.searchParams.delete(key));
        if (fragmentError) url.hash = '#/';
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
      }
      ready = true;
      refreshHeader();
    }
  }

  function message(key, error = false) {
    const target = dialog.querySelector('#auth-message');
    target.classList.toggle('is-error', error);
    target.setAttribute('role', error ? 'alert' : 'status');
    target.textContent = key ? t(key) : '';
    target.hidden = !key;
  }

  function errorKey(error) {
    if (error?.status === 429 || ['over_request_rate_limit', 'over_email_send_rate_limit'].includes(error?.code)) return 'auth.errorRate';
    if (error?.code === 'email_address_invalid') return 'auth.errorEmail';
    if (error?.code === 'email_address_not_authorized') return 'auth.errorEmailDelivery';
    if (error?.code === 'email_not_confirmed') return 'auth.errorUnconfirmed';
    if (['weak_password', 'same_password'].includes(error?.code)) return 'auth.errorPassword';
    if (error?.code === 'invalid_credentials') return 'auth.errorCredentials';
    if (['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error?.code)) return 'auth.errorSession';
    return 'auth.errorRequest';
  }

  function setBusy(value) {
    busy = value;
    dialog.setAttribute('aria-busy', String(value));
    dialog.querySelectorAll('input, button').forEach(control => { control.disabled = value; });
    const submit = dialog.querySelector('[type="submit"]');
    if (submit) submit.textContent = t(value ? 'auth.working' : submit.dataset.label);
  }

  function close() {
    if (busy) return;
    dialog.close();
    tokenVisible = false;
    dialog.innerHTML = ''; // Password fields are never retained after closing.
    document.querySelector('[data-action="auth-open"]')?.focus({ preventScroll: true });
  }

  function field(id, label, type, autocomplete) {
    return `<label class="ob-auth-field" for="${id}"><span>${esc(t(label))}</span><input class="ob-input" id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" required${type === 'email' ? ' autocapitalize="none" spellcheck="false"' : ''}></label>`;
  }

  function show(nextMode) {
    if (!dialog || busy) return;
    mode = nextMode;
    tokenVisible = false;
    const titles = { login: 'auth.signIn', reset: 'auth.reset', account: 'auth.account', password: 'auth.newPassword' };
    const submit = { login: 'auth.signIn', reset: 'auth.sendReset', account: 'auth.signOut', password: 'auth.savePassword' }[mode];
    const adminRecovery = mode === 'reset' && DK.catalogConfig.authRecovery !== 'email';
    const description = mode === 'account' ? 'auth.publicAccount' : mode === 'reset' ? adminRecovery ? 'auth.adminRecovery' : 'auth.resetHint' : mode === 'password' ? 'auth.passwordHint' : 'auth.loginHint';
    const content = mode === 'account'
      ? `<p class="ob-auth-email">${esc(user?.email)}</p>`
      : mode === 'password'
        ? field('auth-password', 'auth.newPassword', 'password', 'new-password') + field('auth-confirm', 'auth.confirmPassword', 'password', 'new-password')
        : field('auth-email', 'auth.email', 'email', 'username') + (mode === 'login' ? field('auth-password', 'auth.password', 'password', 'current-password') : '');
    dialog.innerHTML = `<div class="ob-auth-heading"><h2 id="auth-title">${esc(t(titles[mode]))}</h2><button type="button" class="ob-button ob-button--icon" data-auth="close" aria-label="${esc(t('auth.close'))}">${ui.icon('xmark', 'lg')}</button></div>
      <p id="auth-description" class="ob-auth-description">${esc(t(description))}</p>
      <form id="auth-form"><div class="ob-auth-fields">${adminRecovery ? '' : content}</div>
        <p id="auth-message" class="ob-auth-message" role="status" aria-live="polite" aria-atomic="true" hidden></p>
        ${adminRecovery ? '' : `<button type="submit" class="ob-button ob-button--primary ob-auth-submit" data-label="${submit}">${esc(t(submit))}</button>`}
      </form>
      <div class="ob-auth-secondary">${mode === 'login' ? `<button type="button" class="ob-button ob-button--link" data-auth="reset">${esc(t('auth.forgotPassword'))}</button>` : mode === 'reset' ? `<button type="button" class="ob-button ob-button--link" data-auth="login">${esc(t('auth.backToLogin'))}</button>` : mode === 'account' ? `<button type="button" class="ob-button ob-button--link" data-auth="password">${esc(t('auth.changePassword'))}</button>` : ''}</div>${mode === 'account' ? tokenPanel() : ''}`;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('input, [type="submit"], [data-auth="login"]')?.focus();
    if (unavailable || !client) {
      message('auth.unavailable', true);
      const button = dialog.querySelector('[type="submit"]'); if (button) button.disabled = true;
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || !client || unavailable) return;
    if (mode === 'reset' && DK.catalogConfig.authRecovery !== 'email') return;
    const submittedMode = mode;
    const email = dialog.querySelector('#auth-email')?.value.trim();
    let password = dialog.querySelector('#auth-password')?.value;
    if (mode === 'password' && password !== dialog.querySelector('#auth-confirm').value) {
      message('auth.passwordMismatch', true);
      dialog.querySelector('#auth-confirm').focus();
      return;
    }
    message('');
    setBusy(true);
    let failure = null;
    try {
      let result;
      if (mode === 'login') result = await client.auth.signInWithPassword({ email, password });
      if (mode === 'reset') {
        // Same application path works on localhost and in a GitHub Pages subdirectory.
        const redirect = new URL(location.href);
        ['code', 'sb_flow_id', 'error', 'error_code', 'error_description'].forEach(key => redirect.searchParams.delete(key));
        result = await client.auth.resetPasswordForEmail(email, { redirectTo: redirect.href });
      }
      if (mode === 'account') result = await client.auth.signOut({ scope: 'local' });
      if (mode === 'password') result = await client.auth.updateUser({ password });
      if (result.error) throw result.error;
    } catch (error) { failure = errorKey(error); }
    finally {
      password = null;
      dialog.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; });
      setBusy(false);
    }
    if (failure) {
      // The SDK clears local credentials even when the server cannot revoke the session.
      if (submittedMode === 'account' && !user) { show('login'); failure = 'auth.signOutUnconfirmed'; }
      if (submittedMode === 'password' && !user) { show('login'); failure = 'auth.errorSession'; }
      message(failure, true);
      dialog.querySelector('input, [type="submit"]')?.focus();
    } else if (submittedMode === 'reset') {
      message('auth.resetSent');
      dialog.querySelector('[type="submit"]').focus();
    } else if (submittedMode === 'password') {
      recovery = false;
      show('account');
      message('auth.passwordSaved');
    } else {
      close();
      ui.toast(t(submittedMode === 'login' ? 'auth.signedIn' : 'auth.signedOut'), 'success');
    }
  }

  DK.auth = {
    get user() { return user; },
    async accessToken() { return (await accessSession()).access_token; },
    async editRequest(name, args = {}) {
      await initialization;
      if (!client || !user || !['edit_capabilities','save_entry'].includes(name)) throw { code: '42501' };
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const result = await client.schema('catalog').rpc(name,args).abortSignal(controller.signal);
        if (result.error) throw result.error;
        return result.data;
      } finally { clearTimeout(timeout); }
    },
    header() {
      const label = user ? t('auth.account') : t('auth.signIn');
      return `<button type="button" class="ob-button ob-auth-trigger${user ? ' is-active' : ''}" data-action="auth-open" aria-haspopup="dialog" aria-label="${esc(user ? label + ': ' + user.email : label)}"${!ready ? ' disabled' : ''}>${esc(label)}</button>`;
    },
    open() { show(recovery === true ? 'password' : user ? 'account' : 'login'); },
    mount(onChange) {
      refreshHeader = onChange;
      dialog = document.createElement('dialog');
      dialog.id = 'auth-dialog';
      dialog.className = 'ob-auth-dialog';
      dialog.setAttribute('aria-labelledby', 'auth-title');
      dialog.setAttribute('aria-describedby', 'auth-description');
      document.body.append(dialog);
      dialog.addEventListener('submit', submit);
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const controls = [...dialog.querySelectorAll('input:not(:disabled), textarea:not(:disabled):not([hidden]), button:not(:disabled)')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      });
      dialog.addEventListener('click', event => {
        event.stopPropagation();
        const action = event.target.closest('[data-auth]')?.dataset.auth;
        if (action === 'close') close();
        else if (action === 'show-token' || action === 'copy-token') useToken(action === 'copy-token');
        else if (action && !busy) {
          const email = dialog.querySelector('#auth-email')?.value || '';
          show(action);
          const input = dialog.querySelector('#auth-email');
          if (input) input.value = email;
        }
      });
      initialization.then(() => {
        refreshHeader();
        if (recovery === true) show('password');
        if (recovery === 'error') { recovery = false; show('reset'); message('auth.errorLink', true); }
      });
    },
  };
  initialization = initialize();
})(window.DK);
