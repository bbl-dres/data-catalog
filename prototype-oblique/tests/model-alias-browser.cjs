/* Visible EN/DE aliases, responsive profiles, actual PDF/XLSX exports. */
'use strict';
const assert = require('node:assert/strict'), path = require('node:path');
const { read } = require('../scripts/model-contract.cjs');
const { workspace } = require('./print-test-helpers.cjs');
const { readWorkbook } = require('./excel-helpers.cjs');
(async()=>{
  const model = read(), test = await workspace(), {page,visit,open,download,close,output,settle} = test;
  try {
    const setLanguage = async language => {
      await page.evaluate(lang=>{DK.app.state.lang=lang;DK.ui.setDictionary(DK.data.i18n,lang);DK.app.render();},language);
      await settle(page);
    };
    for (const language of ['de','en']) {
      const alias = (id,selected=false) => model.label(id,language,selected);
      await visit('#/objects/gebaeude?tab=rows');await setLanguage(language);
      for (const width of [320,390,1280]) {
        await page.setViewportSize({width,height:1000});await settle(page);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,language+' '+width);
        const headers = await page.locator('#panel-rows thead th').allTextContents();
        for (const label of [alias('Actor.name_de',true),alias('ValueSpecification.valueType'),alias('Presentation.businessKeyRole'),alias('BusinessAttribute.codeListId')]) assert(headers.includes(label),label);
      }
      await page.setViewportSize({width:1600,height:1000});await open();
      assert.equal(await page.locator('#diagram-error-message').innerText(),'');
      const labels = await page.evaluate(()=>printTest.layout.columnLabels);
      assert(labels.includes(alias('ValueSpecification.valueType')));
      assert(labels.includes(alias('Presentation.businessKeyRole')));
      await download('canonical-aliases-'+language);
      await page.locator('.ob-export-header [data-diagram-action="close"]').click();
      await page.click('[data-menu="actions"]');
      const pending = page.waitForEvent('download');await page.click('[data-export="xlsx"]');
      const book = await readWorkbook(await (await pending).path());
      const sheet = book.worksheets.find(s=>s.getRow(1).values.includes('valueType'));
      const field = key => sheet.getCell(2,sheet.getRow(1).values.indexOf(key)).value;
      assert.equal(field('sortOrder'),alias('BusinessAttribute.sortOrder'));
      assert.equal(field('name'),alias('Actor.name_de',true));
      assert.equal(field('valueType'),alias('ValueSpecification.valueType'));
      await visit('#/tables/t-gwr-gebaeude/fields/EGID');await setLanguage(language);
      const facts = await page.locator('.ob-core-facts dt').allTextContents();
      for (const label of [alias('Actor.name_de',true),alias('DataField.sourceDataType'),alias('DataField.keyRoles')]) assert(facts.includes(label),label);
      await page.setViewportSize({width:390,height:1000});await settle(page);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(output,'canonical-aliases-'+language+'-profile.png'),fullPage:true});
      await visit('#/refs/r-gwr-kat?tab=overview');await setLanguage(language);
      assert((await page.locator('.ob-responsibility dt').allTextContents()).includes(alias('CodeList.authorityOrganisation')));
      console.log('PASS canonical '+language.toUpperCase()+' aliases in profiles, 320/390/1280px rows, PDF and downloaded XLSX');
    }
    assert.deepEqual(test.errors,[]);
  } finally { await close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
