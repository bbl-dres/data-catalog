/* Cold links and history must restore the rendered state, independently of previous visits. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { workspace } = require('./print-test-helpers.cjs');

(async () => {
  const test = await workspace(), { page, visit, open, settle, output } = test, results = [];
  const params = () => page.evaluate(() => ({ ...DK.router.parse().params }));
  const go = async hash => { await page.evaluate(hash => DK.router.navigate(hash), hash); await settle(page); };
  const check = async (name, run) => {
    try { await run(); results.push({ name, passed: true }); console.log('PASS: ' + name); }
    catch (error) { results.push({ name, passed: false, error: error.message }); console.error('FAIL: ' + name + ': ' + error.message); }
  };
  try {
    for (const tab of ['rows', 'relations', 'history']) await check('cold detail link and reload: ' + tab, async () => {
      await visit('#/objects/gebaeude?tab=' + tab);
      assert.equal(await page.locator('#tab-' + tab).getAttribute('aria-selected'), 'true');
      await page.reload(); await page.locator('#tab-' + tab).waitFor();
      assert.equal(await page.locator('#tab-' + tab).getAttribute('aria-selected'), 'true');
    });
    await check('history restores an overview after another profile selected rows', async () => {
      await visit('#/objects/gebaeude');
      await go('#/objects/areal?tab=rows');
      await page.goBack(); await settle(page);
      assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'), 'true');
    });
    await check('history restores source row order rather than a later sort', async () => {
      await visit('#/tables/t-gwr-gebaeude?tab=rows&fields=name');
      const names = await page.locator('#panel-rows tbody [data-field="name"]').allTextContents();
      await go('#/tables/t-geb-gis?tab=rows&fields=name&sort=name:desc');
      await page.goBack(); await settle(page);
      assert.deepEqual(await page.locator('#panel-rows tbody [data-field="name"]').allTextContents(), names);
      assert.equal((await params()).sort, undefined);
    });
    await check('detail pagination clamps the URL and survives reload', async () => {
      await visit('#/tables/t-geb-gis?tab=rows&fields=name&page=999&size=17');
      const lastPage = await page.evaluate(() => String(Math.ceil(DK.data.get('tables', 't-geb-gis').fields.length / 50)));
      assert.equal((await params()).page, lastPage);
      assert.equal((await params()).size, undefined);
      const names = await page.locator('#panel-rows tbody [data-field="name"]').allTextContents();
      await page.reload(); await page.locator('#panel-rows').waitFor();
      assert.deepEqual(await page.locator('#panel-rows tbody [data-field="name"]').allTextContents(), names);
    });
    await check('invalid presentation parameters normalize without leaking previous sort', async () => {
      await visit('#/objects?view=table&group=none&fields=name&sort=name:desc');
      await go('#/objects?view=invalid&group=invalid&fields=name,name,missing&sort=name:desc:extra');
      const state = await params();
      assert.equal(state.view, 'tiles'); assert.equal(state.group, 'domain');
      assert.equal(state.fields, 'name'); assert.equal(state.sort, 'name:asc');
    });
    await check('search scope canonicalization retains explicit empty selection', async () => {
      await visit('#/search?q=GWR&types=tables,tables,missing&domains=bau,bau,missing&ai=invalid&page=-2&size=17&sort=invalid');
      const state = await params();
      assert.equal(state.types, 'tables'); assert.equal(state.domains, 'bau');
      for (const key of ['ai', 'page', 'size', 'sort']) assert.equal(state[key], undefined);
      await go('#/search?q=GWR&types=none&domains=none&ai=0');
      assert.equal((await params()).types, 'none'); assert.equal((await params()).domains, 'none');
      assert.equal(await page.locator('#search-submit').isDisabled(), true);
    });
    await check('handbook without a chapter has matching content, selection and URL', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await visit('#/manual?ch=model'); await go('#/'); await go('#/manual');
      assert.equal(await page.evaluate(() => DK.app.state.chapter), 'introduction');
      assert.equal((await params()).ch, 'introduction');
    });
    await check('chapter links, scroll tracking and modified clicks respect browser history', async () => {
      await visit('#/manual?ch=introduction');
      await page.locator('a[data-chapter="model"]').click(); await settle(page);
      assert.equal((await params()).ch, 'model');
      await page.goBack(); await settle(page);
      assert.equal((await params()).ch, 'introduction');
      await page.goForward(); await settle(page);
      assert.equal((await params()).ch, 'model');
      assert.equal(await page.evaluate(() => {
        let prevented;
        window.addEventListener('click', event => { prevented = event.defaultPrevented; event.preventDefault(); }, { once: true });
        document.querySelector('[data-chapter="glossary"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
        return prevented;
      }), false, 'Ctrl-click remains a native link action');
      await page.locator('#manual-glossary').evaluate(el => el.scrollIntoView()); await settle(page);
      assert.equal((await params()).ch, 'glossary');
    });
    await check('navigation-model override survives detail, header and footer links', async () => {
      await visit('#/tables/t-gwr-gebaeude?tab=rows&nav=container&fields=name');
      const field = page.locator('#panel-rows tbody a').first();
      assert((await field.getAttribute('href')).includes('nav=container'));
      await field.click(); await settle(page);
      assert.equal(await page.evaluate(() => DK.data.navModel()), 'container');
      for (const selector of ['#brand-link', '#main-nav a', '#footer a[href^="#/"]', '.ob-breadcrumb a']) {
        assert((await page.locator(selector).evaluateAll(links => links.every(link => link.getAttribute('href').includes('nav=container')))), selector);
      }
    });
    await check('parameter updates preserve deployment path and outer query', async () => {
      await visit('#/objects?view=table&group=none');
      await page.evaluate(() => history.replaceState(null, '', location.pathname + '?host=keep' + location.hash));
      await page.locator('#collection-filter').fill('Gebäude & Grundstück');
      assert.equal(new URL(page.url()).search, '?host=keep');
      assert.equal((await params()).filter, 'Gebäude & Grundstück');
    });
    await check('malformed routes and injection-shaped values render safely', async () => {
      for (const hash of ['#/objects/%E0%A4%A', '#/objects/missing', '#/tables/t-geb-gis/fields/missing', '#/api/extra']) {
        await visit(hash); assert.equal(await page.evaluate(() => DK.router.parse().view === 'notfound' || document.querySelector('#page-content h1').textContent === DK.ui.t('notfound.title')), true);
      }
      await visit('#/objects?view=table&filter=%3Csvg%20onload%3Dalert(1)%3E&fields=__proto__,name');
      assert.equal(await page.locator('#collection-filter').inputValue(), '<svg onload=alert(1)>');
      assert.equal((await params()).fields, 'name');
      assert.equal(await page.locator('#collection-view-panel svg[onload]').count(), 0);
    });
    await check('print inherits a restored collection URL without changing its history entry', async () => {
      await visit('#/domains/bau?tab=table&group=none&fields=name,description,status&sort=name:desc&filter=Geb');
      const hash = new URL(page.url()).hash;
      const names = await page.locator('#collection-view-panel tbody [data-field="name"]').allTextContents();
      await open();
      const printed = await page.evaluate(() => ({ mode: printTest.settings.layout, group: printTest.settings.groupBy,
        names: printTest.snapshot.entities.map(entity => entity.name), fields: printTest.settings.entityColumns }));
      assert.equal(printed.mode, 'list'); assert.equal(printed.group, 'none');
      assert.deepEqual(printed.names, names); assert.deepEqual(printed.fields, ['name', 'description', 'status']);
      await page.locator('.ob-export-header [data-diagram-action="close"]').click();
      assert.equal(new URL(page.url()).hash, hash);
    });
    await check('print preserves URL sorting from system tables and field lists', async () => {
      for (const hash of ['#/systems/sap?tab=rows&fields=name&sort=name:desc', '#/tables/t-gwr-gebaeude?tab=rows&fields=name&sort=name:desc']) {
        await visit(hash);
        const names = await page.locator('#panel-rows tbody [data-field="name"]').allTextContents();
        await open();
        const printed = await page.evaluate(() => DK.router.parse().kind === 'systems'
          ? printTest.snapshot.entities.map(entity => entity.display.name)
          : printTest.snapshot.entities[0].rows.map(row => row.display.name));
        assert.deepEqual(printed, names);
        await page.locator('.ob-export-header [data-diagram-action="close"]').click();
      }
    });
    await check('all catalog route families and their supported tabs open directly', async () => {
      await visit('#/');
      const paths = await page.evaluate(() => DK.data.kinds.flatMap(kind => {
        const entity = { ...DK.data.list(kind)[0], kind };
        return [{ href: DK.router.listHref(kind), view: 'list' }, ...DK.detail.tabs(entity).map(([tab]) => ({
          href: DK.router.entityHref(kind, entity.identifier, { tab }), view: 'detail', tab, domain: kind === 'domains'
        }))]; }));
      for (const { href, view, tab, domain } of paths) {
        await visit(href);
        assert.equal(await page.evaluate(() => DK.router.parse().view), view, href);
        if (tab) assert.equal(await page.locator(`#${domain ? 'view-tab' : 'tab'}-${tab}`).getAttribute('aria-selected'), 'true', href);
      }
      for (const href of ['#/objects/gebaeude/attributes/egid?tab=history', '#/tables/t-gwr-gebaeude/fields/EGID?tab=relations']) {
        await visit(href);
        assert.equal(await page.locator('#tab-' + (await params()).tab).getAttribute('aria-selected'), 'true');
      }
    });
    const report = { phase: process.env.REPORT_ONLY ? 'before' : 'after', results, errors: test.errors };
    fs.writeFileSync(path.join(output, `routing-${report.phase}.json`), JSON.stringify(report, null, 2));
    if (!process.env.REPORT_ONLY) { assert.deepEqual(results.filter(result => !result.passed), []); assert.deepEqual(test.errors, []); }
  } finally { await test.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
