/* Real vendored Supabase SDK + browser UI; all Auth and catalog responses stay local. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const os = require('node:os');
const { database } = require('./catalog-test-helpers.cjs');
const { createServer, settle, chromium } = require('./browser-helpers.cjs');
const project = 'https://zicluerzbevodlmtbxow.supabase.co';
const storageKey = 'sb-zicluerzbevodlmtbxow-auth-token';
const identity = { id: '8c965b13-447c-4a66-bb17-7b9e0b791cb0', email: 'member@example.org', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const jwt = expiry => [ { alg: 'HS256', typ: 'JWT' }, { sub: identity.id, role: 'authenticated', exp: expiry } ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.test-signature';
const session = () => ({ access_token: jwt(Math.floor(Date.now() / 1000) + 3600), refresh_token: crypto.randomUUID(), token_type: 'bearer', expires_in: 3600, user: identity });

(async () => {
  const db = await database();
  const server = createServer({ catalogProvider: 'supabase' });
  let browser;
  try {
    const snapshot = (await db.query('SELECT catalog.read_snapshot() AS snapshot')).rows[0].snapshot;
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    // Keep coverage for the optional SMTP recovery flow; editing.cjs tests the
    // shipped administrator-managed recovery mode without sending email.
    await context.route('**/js/catalog-config.js', async route => {
      const response = await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace("authRecovery: 'administrator'","authRecovery: 'email'")});
    });
    const requests = [], errors = [];
    let responseError = null, gate = null, resetChallenge = null;
    context.on('page', page => { page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(10000); });
    await context.route(project + '/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/rest/v1/rpc/read_snapshot') {
        assert.equal(request.headers().authorization, undefined, 'Public catalog requests stay anonymous');
        return route.fulfill({ json: snapshot });
      }
      if (url.pathname === '/rest/v1/rpc/edit_capabilities') return route.fulfill({json:{version:1,can_edit:true}});
      assert(url.pathname.startsWith('/auth/v1/'), 'Only expected Supabase endpoints are used');
      assert(request.headers().apikey.startsWith('sb_publishable_'));
      const body = request.postDataJSON();
      requests.push({ pathname: url.pathname, grant: url.searchParams.get('grant_type'), body, url: url.href });
      if (gate) await gate;
      if (responseError) return route.fulfill({ status: responseError.status, headers: { 'x-supabase-api-version': '2024-01-01', 'access-control-expose-headers': 'x-supabase-api-version' }, json: { code: responseError.code, message: '<img src=x onerror=alert(1)>' } });
      if (url.pathname === '/auth/v1/token') {
        if (url.searchParams.get('grant_type') === 'pkce') {
          assert.equal(crypto.createHash('sha256').update(body.code_verifier).digest('base64url'), resetChallenge, 'Recovery uses the original PKCE verifier');
        }
        return route.fulfill({ json: session() });
      }
      if (url.pathname === '/auth/v1/recover') {
        assert.equal(body.code_challenge_method, 's256');
        resetChallenge = body.code_challenge;
        return route.fulfill({ json: {} });
      }
      if (url.pathname === '/auth/v1/logout') {
        assert.equal(url.searchParams.get('scope'), 'local');
        return route.fulfill({ status: 204, body: '' });
      }
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: identity });
      throw new Error('Unexpected Auth request: ' + url.pathname);
    });
    const page = await context.newPage();
    const trigger = '[data-action="auth-open"]';
    const visit = async (target = base + '#/objects/gebaeude?tab=rows') => {
      // Email redirects and reloads initialize Auth in a new document, not a same-page hash navigation.
      await page.goto('about:blank');
      await page.goto(target);
      await page.locator('#page-content h1').waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-action="auth-open"]').disabled);
    };
    const submit = () => page.locator('#auth-form [type="submit"]').click();
    const fillLogin = async () => { await page.locator('#auth-email').fill('member@example.org'); await page.locator('#auth-password').fill('Test password!123'); };
    const close = () => page.locator('[data-auth="close"]').click();
    const expectMessage = async key => {
      try { await page.waitForFunction(key => document.querySelector('#auth-message')?.textContent === DK.ui.t(key), key); }
      catch (error) {
        console.error({ expected: key, actual: await page.evaluate(() => document.querySelector('#auth-message')?.textContent), requests: requests.map(({ pathname, grant }) => ({ pathname, grant })), errors });
        throw error;
      }
    };

    await visit();
    assert.equal(requests.length, 0, 'Anonymous browsing makes no Auth request');
    const originalHash = new URL(page.url()).hash;
    await page.locator(trigger).click();
    assert.equal(await page.locator('#auth-email').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('[data-auth="close"]').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('[data-auth="reset"]').evaluate(el => el === document.activeElement), true, 'Native modal traps focus');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator(trigger).evaluate(el => el === document.activeElement), true);
    await page.locator(trigger).click();
    await submit();
    assert.equal(requests.length, 0, 'Empty required fields never send a request');
    await fillLogin();
    responseError = { status: 400, code: 'invalid_credentials' };
    await submit();
    await expectMessage('auth.errorCredentials');
    assert.equal(await page.locator('#auth-message img').count(), 0);
    assert.equal(await page.locator('#auth-password').inputValue(), '');
    assert.equal(await page.locator('#auth-email').inputValue(), identity.email);
    responseError = { status: 429, code: 'over_request_rate_limit' };
    await fillLogin(); await submit(); await expectMessage('auth.errorRate');
    responseError = null;
    let release;
    gate = new Promise(resolve => { release = resolve; });
    await fillLogin(); await submit();
    await page.waitForFunction(() => document.querySelector('#auth-dialog').getAttribute('aria-busy') === 'true');
    const before = requests.length;
    await page.evaluate(() => document.querySelector('#auth-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(requests.length, before, 'Pending submission cannot be duplicated');
    await page.keyboard.press('Escape');
    assert(await page.locator('#auth-dialog').isVisible(), 'Pending login cannot be dismissed and misreported');
    release(); gate = null;
    await page.locator('#auth-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator(trigger).textContent(), 'Konto');
    assert.equal(new URL(page.url()).hash, originalHash);
    assert.equal(await page.locator('#auth-password').count(), 0);
    console.log('PASS: public reads, keyboard focus, validation, safe errors, rate limits, duplicate guard and login without route loss');

    await visit(page.url());
    assert.equal(await page.locator(trigger).textContent(), 'Konto', 'Session survives reload');
    const second = await context.newPage();
    await second.goto(base);
    await second.waitForFunction(() => DK.auth.user?.email === 'member@example.org');
    await page.locator(trigger).click();
    responseError = { status: 500, code: 'unexpected_failure' };
    await submit(); await expectMessage('auth.signOutUnconfirmed');
    assert.equal(await page.locator(trigger).textContent(), 'Anmelden', 'SDK clears local credentials even when remote revocation fails');
    await second.waitForFunction(() => DK.auth.user === null);
    responseError = null;
    await fillLogin(); await submit();
    await page.locator('#auth-dialog').waitFor({ state: 'hidden' });
    await second.waitForFunction(() => DK.auth.user !== null);
    await page.locator(trigger).click();
    await submit();
    await page.locator('#auth-dialog').waitFor({ state: 'hidden' });
    await second.waitForFunction(() => DK.auth.user === null);
    assert.equal(await second.locator(trigger).textContent(), 'Anmelden');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null);
    assert.equal(new URL(page.url()).hash, originalHash);
    await second.close();
    console.log('PASS: persistent session, honest failed sign-out, local sign-out and cross-tab synchronization');

    await page.locator(trigger).click();
    await page.locator('#auth-email').fill(identity.email);
    await page.locator('[data-auth="reset"]').click();
    assert.equal(await page.locator('#auth-email').inputValue(), identity.email);
    responseError = { status: 400, code: 'email_address_invalid' };
    await submit(); await expectMessage('auth.errorEmail');
    responseError = { status: 400, code: 'email_address_not_authorized' };
    await submit(); await expectMessage('auth.errorEmailDelivery');
    responseError = null;
    await submit(); await expectMessage('auth.resetSent');
    const reset = requests.findLast(request => request.pathname === '/auth/v1/recover');
    const redirect = new URL(new URL(reset.url).searchParams.get('redirect_to'));
    assert.equal(redirect.origin, new URL(base).origin);
    assert.equal(redirect.hash, originalHash);
    redirect.searchParams.set('code', 'test-recovery-code');
    await visit(redirect.href);
    await page.locator('#auth-confirm').waitFor();
    assert.equal(new URL(page.url()).searchParams.has('code'), false);
    assert.equal(new URL(page.url()).hash, originalHash);
    await page.locator('#auth-password').fill('A changed password!123');
    await page.locator('#auth-confirm').fill('A different password');
    const updatesBefore = requests.filter(request => request.pathname === '/auth/v1/user').length;
    await submit(); await expectMessage('auth.passwordMismatch');
    assert.equal(requests.filter(request => request.pathname === '/auth/v1/user').length, updatesBefore);
    await page.locator('#auth-confirm').fill('A changed password!123');
    await submit(); await expectMessage('auth.passwordSaved');
    assert.equal(requests.findLast(request => request.pathname === '/auth/v1/user').body.password, 'A changed password!123');
    await submit(); await page.locator('#auth-dialog').waitFor({ state: 'hidden' });
    await visit(base + '?code=expired#/objects/gebaeude?tab=rows');
    await expectMessage('auth.errorLink');
    assert.equal(new URL(page.url()).searchParams.has('code'), false);
    await close();
    await visit(base + '#error=access_denied&error_code=otp_expired&error_description=Expired');
    await expectMessage('auth.errorLink');
    assert.equal(new URL(page.url()).hash, '#/');
    await close();
    console.log('PASS: PKCE recovery, matching password validation, password update and invalid callback recovery');

    await page.locator(trigger).click(); await fillLogin(); await submit();
    await page.locator('#auth-dialog').waitFor({ state: 'hidden' });
    await page.evaluate(({ key, expiredToken }) => {
      const stored = JSON.parse(localStorage.getItem(key));
      stored.expires_at = Math.floor(Date.now() / 1000) - 60;
      stored.access_token = expiredToken;
      localStorage.setItem(key, JSON.stringify(stored));
    }, { key: storageKey, expiredToken: jwt(Math.floor(Date.now() / 1000) - 60) });
    const refreshesBefore = requests.filter(request => request.grant === 'refresh_token').length;
    await visit(page.url());
    assert.equal(requests.filter(request => request.grant === 'refresh_token').length, refreshesBefore + 1);
    assert.equal(await page.locator(trigger).textContent(), 'Konto');
    await page.locator(trigger).click(); await submit(); await page.locator('#auth-dialog').waitFor({ state: 'hidden' });
    console.log('PASS: expired sessions refresh using the SDK');

    const invitation = session();
    const inviteFragment = new URLSearchParams({ access_token: invitation.access_token, refresh_token: invitation.refresh_token, token_type: 'bearer', type: 'invite' });
    const userChecksBefore = requests.filter(request => request.pathname === '/auth/v1/user').length;
    await visit(base + '#' + inviteFragment);
    await page.locator('#auth-confirm').waitFor();
    assert.equal(new URL(page.url()).hash, '#/', 'Invitation tokens are removed from the URL');
    assert.equal(requests.filter(request => request.pathname === '/auth/v1/user').length, userChecksBefore + 1, 'Auth validates the invited identity');
    assert.equal(await page.evaluate(() => DK.auth.user.email), identity.email);
    await page.locator('#auth-password').fill('My invitation password!123');
    await page.locator('#auth-confirm').fill('My invitation password!123');
    await submit(); await expectMessage('auth.passwordSaved');
    await submit(); await page.locator('#auth-dialog').waitFor({ state: 'hidden' });
    responseError = { status: 401, code: 'bad_jwt' };
    await visit(base + '#' + inviteFragment);
    await expectMessage('auth.errorLink');
    assert.equal(await page.evaluate(() => DK.auth.user), null, 'Rejected invitation does not authenticate');
    assert.equal(new URL(page.url()).hash, '#/');
    responseError = null;
    await close();
    await visit(base + '#access_token=invalid&type=invite');
    await expectMessage('auth.errorLink');
    assert.equal(new URL(page.url()).hash, '#/', 'Incomplete token fragments are removed too');
    await close();
    console.log('PASS: dashboard invitations validate the session, remove URL tokens and let users set a password; rejected/incomplete links fail safely');

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 480 : 900 });
      for (const lang of ['de', 'fr', 'it', 'en']) {
        // Use the actual language control; preference keys remain an app implementation detail.
        if (width <= 960) await page.locator('[data-action="open-navigation"]').click();
        const host = width <= 960 ? '#drawer-language-host' : '#language-host';
        await page.locator(host + ' [data-action="menu"]').click();
        await page.locator(host + ' [data-lang="' + lang + '"]').click();
        if (width <= 960) await page.locator('#navigation-panel [data-action="close-navigation"]').click();
        await page.locator(trigger).click();
        await settle(page);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Page fits ${width}px/${lang}`);
        const bounds = await page.locator('#auth-dialog').boundingBox();
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
        assert.equal(await page.locator('#auth-dialog').evaluate(el => el.scrollWidth > el.clientWidth), false);
        assert.equal(await page.locator('#auth-title').textContent(), await page.evaluate(() => DK.ui.t('auth.signIn')));
        if (lang === 'de' && [320, 1440].includes(width)) await page.screenshot({ path: path.join(os.tmpdir(), `oblique-auth-${width}.png`) });
        await close();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(trigger).click();
    await fillLogin();
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: 320 });
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 100 });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await settle(page);
    const keyboardBounds = await page.locator('#auth-dialog').boundingBox();
    assert(keyboardBounds.y >= 100 && keyboardBounds.y + keyboardBounds.height <= 420, 'Dialog fits the simulated keyboard viewport');
    assert.equal(await page.locator('#auth-email').inputValue(), identity.email);
    assert.equal(await page.locator('#auth-password').inputValue(), 'Test password!123', 'Keyboard resizing does not clear credentials');
    await page.evaluate(() => {
      delete visualViewport.height;
      delete visualViewport.offsetTop;
      visualViewport.dispatchEvent(new Event('resize'));
    });
    let forwarded = false;
    page.on('request', request => { if (request.url().startsWith('https://credential-redirect.invalid/')) forwarded = true; });
    await page.route(project + '/auth/v1/token?grant_type=password', route => route.fulfill({ status: 307, headers: { location: 'https://credential-redirect.invalid/' }, body: '' }));
    await submit(); await expectMessage('auth.errorRequest');
    assert.equal(forwarded, false, 'Credentials are never forwarded to redirected endpoints');
    await page.unroute(project + '/auth/v1/token?grant_type=password');
    await close();

    const restricted = await context.newPage();
    await restricted.addInitScript(() => {
      Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = () => { throw new DOMException('Storage disabled', 'SecurityError'); };
    });
    await restricted.goto(base);
    await restricted.locator('#page-content h1').waitFor();
    await restricted.locator(trigger).click();
    await restricted.locator('#auth-email').fill(identity.email);
    await restricted.locator('#auth-password').fill('Test password!123');
    await restricted.locator('#auth-form [type="submit"]').click();
    await restricted.locator('#auth-dialog').waitFor({ state: 'hidden' });
    assert.equal(await restricted.evaluate(() => DK.auth.user.email), identity.email);
    await restricted.reload();
    await restricted.locator('#page-content h1').waitFor();
    assert.equal(await restricted.evaluate(() => DK.auth.user), null, 'Denied storage falls back to a memory-only session');
    await restricted.close();
    console.log('PASS: fragment error callbacks, refused credential redirects and usable memory sessions when storage is blocked');
    assert.deepEqual(errors, []);
    console.log('PASS: translated login at 320–1440px, scrollable short-screen dialog and no uncaught browser errors');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
