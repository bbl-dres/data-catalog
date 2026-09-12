/* In-memory catalog drafts and the authenticated, atomic save command. */
(function (DK) {
  'use strict';
  const ui = DK.ui, t = ui.t, esc = ui.esc, schema = DK.editSchema;
  let draft = null, capability = false, capabilityUser = null, checking = null, confirmDialog = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const snapshot = () => DK.data.catalogSnapshot;
  const label = record => ui.localized(record,'name_') || record.identifier || '';
  const button = (action,text,attrs = '',primary = false) => `<button type="button" class="ob-button${primary ? ' ob-button--primary' : ''}" data-edit="${action}" ${attrs}>${esc(t(text))}</button>`;
  const iconButton = (action,text,glyph,attrs = '') => `<button type="button" class="ob-button ob-edit-icon" data-edit="${action}" title="${esc(t(text))}" aria-label="${esc(t(text))}" ${attrs}>${glyph}</button>`;
  function patch(row) {
    return Object.fromEntries(Object.entries(row.value).filter(([key,value])=>key !== 'id' && key !== 'identifier' && !['row_version','created_on','modified_on','edited_at'].includes(key) &&
      !['business_object_id','data_table_id','data_product_id','data_service_id'].includes(key) && !(key === 'code_list_id' && row.table === 'code_value') &&
      (row.original ? !same(value,row.original[key]) : value != null)));
  }
  function dirtyCount() { return draft ? [draft.root,...draft.rows].reduce((n,row)=>n + (row.original ? Object.keys(patch(row)).length : 1),0) : 0; }
  function row(table,value,original = true) {
    const r = clone(value);
    if (table === 'business_attribute') r.required = snapshot().business_attribute_quality_requirement.some(a=>a.business_attribute_id === r.id && snapshot().quality_requirement.some(q=>q.id === a.quality_requirement_id && q.rule_type === 'required' && q.status !== 'retired'));
    return {table,value:r,original:original ? clone(r) : null};
  }
  const rootForRoute = route => route.kind && schema.kinds[route.kind];
  const routeKey = route => `${route.view}:${route.kind}:${route.id || ''}`;
  function render(focus) { DK.app.render(); if (focus) document.getElementById(focus)?.focus({preventScroll:true}); }
  function stop() { draft = null; render(); document.querySelector('[data-edit="start"], [data-edit="create"]')?.focus({preventScroll:true}); }
  async function checkCapability(force = false) {
    const id = DK.auth.user?.id || null;
    if (!force && id === capabilityUser) return checking;
    capabilityUser = id; capability = false;
    if (!id) { if (DK.app && DK.data.config) render(); return; }
    checking = (async()=>{
      try { const result = await DK.auth.editRequest('edit_capabilities'); if (DK.auth.user?.id === id) capability = result.version === 1 && result.can_edit === true; }
      catch { /* Missing migration or lost session must never enable editing. */ }
      finally { if (DK.app && DK.data.config) render(); }
    })();
    return checking;
  }
  async function start(create) {
    if (draft) return;
    const requestedRoute = routeKey(DK.app.route), requestedUser = DK.auth.user?.id;
    await checkCapability(true);
    if (!capability) { ui.toast(t('edit.unavailable')); return; }
    try { await DK.data.load('data/'); }
    catch { ui.toast(t('edit.network')); return; }
    if (draft || requestedRoute !== routeKey(DK.app.route) || requestedUser !== DK.auth.user?.id) return;
    DK.app.render();
    const route = DK.app.route, table = rootForRoute(route);
    if (!table || !snapshot()) return;
    const original = create ? schema.defaults(table,ui.language(), route.params.domain ? snapshot().domain.find(x=>x.identifier === route.params.domain) : null) : route.entity?._record;
    if (!original) return;
    const child = schema.children[table];
    draft = {root:row(table,original,!create),rows:child ? snapshot()[child[0]].filter(x=>x[child[1]] === original.id).map(x=>row(child[0],x)).sort((a,b)=>(a.value.sort_order || 0)-(b.value.sort_order || 0)) : [],
      routeKey:routeKey(route),hash:location.hash,kind:route.kind,entity:create ? null : route.entity,lang:ui.language(),tab:'overview',page:0,filter:'',showArchived:false,expanded:new Set(),errors:{},busy:false,saved:null,request:null,userId:DK.auth.user.id};
    render(`edit-${draft.root.value.id}-name`);
  }
  function optionLabel(value) { const key = 'edit.value.'+value; return t(key) === key ? value : t(key); }
  function control(row,f) {
    const r = row.value, id = `edit-${r.id}-${f.key}`, value = schema.read(r,f.key,draft.lang,row.table);
    const changed = !row.original || !same(value,schema.read(row.original,f.key,draft.lang,row.table));
    const error = draft.errors[id];
    const attrs = `id="${id}" data-edit-record="${r.id}" data-edit-field="${f.key}" data-edit-lang="${draft.lang}" aria-invalid="${!!error}"${error ? ` aria-describedby="${id}-error"` : ''}`;
    let input;
    if (['select','reference','boolean','keys'].includes(f.type)) {
      let options = f.type === 'reference' ? snapshot()[f.table].filter(x=>x.id !== r.id && (!x.is_archived || x.id === value)).map(x=>[x.id,label(x)])
        : f.type === 'boolean' ? [['true',t('yes')],['false',t('no')]]
        : f.type === 'keys' ? [['primary','PK'],['foreign','FK'],['unique','UK'],['primary\nforeign','PK + FK']]
        : f.options.map(x=>[x,optionLabel(x)]);
      if (value !== '' && !options.some(([v])=>String(v) === String(value))) options.push([value,String(value)]);
      input = `<select class="ob-select" ${attrs}><option value="">${esc(t('edit.unspecified'))}</option>${options.map(([v,l])=>`<option value="${esc(v)}"${String(value) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    } else if (f.type === 'checkbox') input = `<input type="checkbox" ${attrs}${value ? ' checked' : ''}>`;
    else if (['textarea','lines','urls'].includes(f.type)) input = `<textarea class="ob-input" rows="${f.key === 'description' ? 3 : 2}" ${attrs}>${esc(value)}</textarea>`;
    else input = `<input class="ob-input" type="${['date','url'].includes(f.type) ? f.type : 'text'}" value="${esc(value)}" ${attrs}>`;
    return `<div class="ob-edit-field${changed ? ' is-changed' : ''}" data-edit-wrapper="${id}"><label for="${id}">${esc(t(f.label))}${f.required ? ' *' : ''}<span class="ob-edit-changed"${changed ? '' : ' hidden'}>${esc(t('edit.changed'))}</span></label>${input}<span id="${id}-error" class="ob-edit-field-error"${error ? '' : ' hidden'}>${error ? esc(t(error)) : ''}</span></div>`;
  }
  const titleFields = row => [schema.field('name','edit.name','text',{required:true}),schema.field('description','edit.description','textarea')].map(f=>control(row,f)).join('');
  function overview(row) {
    return `<div class="ob-edit-sections">${schema.groups(row.table).map(([name,fields])=>`<section><h2>${esc(t(name))}</h2>${fields.map(f=>control(row,f)).join('')}</section>`).join('')}
      <section class="ob-edit-system"><h2>${esc(t('detail.system'))}</h2><p>${esc(t('edit.systemHint'))}</p><dl class="ob-facts"><dt>${esc(t('fact.identifier'))}</dt><dd>${esc(row.original?.identifier || t('edit.assignedOnSave'))}</dd><dt>${esc(t('edit.revision'))}</dt><dd>${esc(row.original?.row_version || '—')}</dd><dt>${esc(t('fact.modified'))}</dt><dd>${esc(ui.fmtDate(row.original?.modified_on) || '—')}</dd></dl></section></div>`;
  }
  function rowFields(table) {
    const all = schema.groups(table).flatMap(([,f])=>f);
    const keys = table === 'service_endpoint' ? ['url','operation_name','http_method','environment'] : table === 'code_value' ? ['code','name'] : table === 'data_field' ? ['name','technical_name','source_data_type','is_required','code_list_id'] : table === 'business_attribute' ? ['name','valueType','keyRole','required','code_list_id'] : ['name','valueType','is_required'];
    return keys.map(k=>k === 'name' ? schema.field('name','edit.name','text',{required:true}) : all.find(f=>f.key === k));
  }
  function matchingRows() { return draft.rows.filter(r=>(draft.showArchived || !r.value.is_archived) && (!draft.filter || [label(r.value),r.value.code,r.value.technical_name,r.value.url,r.value.operation_name].join(' ').toLocaleLowerCase().includes(draft.filter.toLocaleLowerCase()))); }
  function rowsPanel() {
    const matches = matchingRows(), pages = Math.max(1,Math.ceil(matches.length/25)); draft.page = Math.min(draft.page,pages-1);
    const childTable = schema.children[draft.root.table][0], fields = rowFields(childTable);
    const rows = matches.slice(draft.page*25,(draft.page+1)*25);
    return `<div class="ob-edit-row-tools"><label>${esc(t('edit.searchRows'))}<input class="ob-input" type="search" id="edit-row-search" value="${esc(draft.filter)}" data-edit-filter></label><label><input type="checkbox" data-edit-archived${draft.showArchived ? ' checked' : ''}> ${esc(t('edit.showArchived'))}</label>${button('add-row','edit.addRow')}</div>
      <div class="ob-edit-table-scroll" tabindex="0" role="region" aria-label="${esc(t('edit.rows'))}"><table class="ob-edit-table"><thead><tr><th>${esc(t('edit.order'))}</th>${fields.map(f=>`<th>${esc(t(f.label))}</th>`).join('')}<th>${esc(t('edit.actions'))}</th></tr></thead><tbody>${rows.map(r=>{
        const pos = draft.rows.indexOf(r), archived = r.value.is_archived;
        return `<tr data-edit-row="${r.value.id}"${archived ? ' class="is-archived"' : ''}><td><div class="ob-edit-order">${iconButton('up','edit.up','↑',`data-row="${r.value.id}"${pos === 0 || draft.filter ? ' disabled' : ''}`)}${iconButton('down','edit.down','↓',`data-row="${r.value.id}"${pos === draft.rows.length-1 || draft.filter ? ' disabled' : ''}`)}<button type="button" class="ob-button ob-edit-drag" draggable="true" data-drag-row="${r.value.id}" aria-label="${esc(t('edit.drag'))}">⋮⋮</button></div></td>${fields.map(f=>`<td>${control(r,f)}</td>`).join('')}<td><div class="ob-edit-row-actions">${button('row-details','edit.details',`data-row="${r.value.id}" aria-expanded="${draft.expanded.has(r.value.id)}"`)}${iconButton(archived ? 'restore' : 'archive',archived ? 'edit.restore' : 'edit.remove',archived ? '↶' : '×',`data-row="${r.value.id}"`)}</div>${!r.original ? `<span class="ob-edit-changed">${esc(t('edit.new'))}</span>` : archived ? `<span>${esc(t('edit.archived'))}</span>` : ''}</td></tr>
        ${draft.expanded.has(r.value.id) ? `<tr><td colspan="${fields.length+2}"><div class="ob-edit-row-detail">${r.table === 'service_endpoint' ? '' : control(r,schema.field('description','edit.description','textarea'))}${schema.groups(r.table).map(([name,group])=>`<section><h3>${esc(t(name))}</h3>${group.filter(f=>!fields.some(x=>x.key === f.key)).map(f=>control(r,f)).join('')}</section>`).join('')}</div></td></tr>` : ''}`;
      }).join('')}</tbody></table></div>${!rows.length ? `<p>${esc(t('edit.noRows'))}</p>` : ''}
      <div class="ob-edit-pagination">${button('previous','edit.previous',draft.page === 0 ? 'disabled' : '')}<span>${draft.page+1} / ${pages} · ${matches.length} ${esc(t('edit.rows'))}</span>${button('next','edit.next',draft.page+1 >= pages ? 'disabled' : '')}</div><p class="ob-edit-hint">${esc(t('edit.archiveHint'))}</p>`;
  }
  function renderEditor(route,state) {
    const count = dirtyCount(), canSave = capability && DK.auth.user?.id === draft.userId;
    const tabs = [['overview','detail.tab.overview'],...(schema.children[draft.root.table] ? [['rows','edit.rows']] : []),...(draft.entity ? [['relations','detail.tab.relations'],['history','detail.tab.history']] : [])];
    const panel = draft.tab === 'overview' ? overview(draft.root) : draft.tab === 'rows' ? rowsPanel() : draft.tab === 'relations' ? `<p class="ob-edit-hint">${esc(t('edit.relationsReadOnly'))}</p>${DK.detail.relations(draft.entity,state)}` : DK.detail.history(draft.entity,state);
    return `<div id="catalog-editor" class="ob-editor" aria-busy="${draft.busy}"><div class="ob-edit-toolbar"><h1>${esc(t(draft.root.original ? 'edit.editEntry' : 'edit.createEntry'))}</h1><div class="ob-edit-save-actions"><span id="edit-unsaved" role="status" aria-live="polite">${esc(t('edit.unsaved',{count}))}</span>${button('discard','edit.discard',draft.busy ? 'disabled' : '')}${button(draft.saved ? 'reload' : 'save',draft.saved ? 'edit.reload' : draft.busy ? 'edit.saving' : 'edit.save',draft.busy || !canSave || (!count && !draft.saved) ? 'disabled' : '',true)}</div></div>
      ${!canSave ? `<p class="ob-edit-notice" role="alert">${esc(t('edit.sessionLost'))} ${button('login','auth.signIn')}</p>` : ''}
      <p id="edit-message" class="ob-edit-notice" role="alert"${draft.message ? '' : ' hidden'}>${draft.message ? esc(t(draft.message)) : ''}</p>
      <fieldset class="ob-edit-form"${draft.busy || draft.saved ? ' disabled' : ''}><legend class="ob-sr-only">${esc(t('edit.editEntry'))}</legend><div class="ob-edit-language"><label for="edit-language">${esc(t('edit.language'))}</label><select id="edit-language" class="ob-select" data-edit-language>${schema.languages.map(lang=>`<option value="${lang}"${lang === draft.lang ? ' selected' : ''}>${lang.toUpperCase()}</option>`).join('')}</select><span>${esc(t('edit.languageHint'))}</span></div>
      <div class="ob-edit-title">${titleFields(draft.root)}</div><div class="ob-tabs" role="tablist">${tabs.map(([id,key])=>`<button type="button" class="ob-tab" id="edit-tab-${id}" role="tab" aria-selected="${draft.tab === id}" aria-controls="edit-panel" tabindex="${draft.tab === id ? 0 : -1}" data-edit="tab" data-tab="${id}">${esc(t(key))}</button>`).join('')}</div>
      <div id="edit-panel" role="tabpanel" aria-labelledby="edit-tab-${draft.tab}">${panel}</div></fieldset></div>`;
  }
  function fieldFor(row,key) { return ['name','description'].includes(key) ? schema.field(key,'edit.'+key,key === 'description' ? 'textarea' : 'text') : schema.groups(row.table).flatMap(([,f])=>f).find(f=>f.key === key); }
  function updateControl(input) {
    if (!draft || draft.busy || draft.saved || !input.isConnected) return;
    const r = [draft.root,...draft.rows].find(x=>x.value.id === input.dataset.editRecord), f = r && fieldFor(r,input.dataset.editField);
    if (!f) return;
    const language = input.dataset.editLang;
    schema.write(r.value,f,input.type === 'checkbox' ? input.checked : input.value,language,r.table);
    draft.request = null; draft.message = null;
    const wrapper = input.closest('.ob-edit-field'), changed = !r.original || !same(schema.read(r.value,f.key,language,r.table),schema.read(r.original,f.key,language,r.table));
    wrapper.classList.toggle('is-changed',changed); wrapper.querySelector('.ob-edit-changed').hidden = !changed;
    delete draft.errors[input.id]; input.setAttribute('aria-invalid','false'); wrapper.querySelector('.ob-edit-field-error').hidden = true;
    document.getElementById('edit-unsaved').textContent = t('edit.unsaved',{count:dirtyCount()});
    const save = document.querySelector('[data-edit="save"]'); if (save) save.disabled = !dirtyCount() || !capability || draft.userId !== DK.auth.user?.id;
  }
  function validate() {
    draft.errors = {};
    const error = (r,key,msg='edit.required') => { draft.errors[`edit-${r.value.id}-${key}`] = msg; };
    const all = [draft.root,...draft.rows];
    for (const r of all) {
      if (r.value.is_archived) continue;
      if (r.table !== 'service_endpoint' && !schema.languages.some(l=>r.value['name_'+l]?.trim())) error(r,'name');
      if (r.table === 'service_endpoint' && ![r.value.url,r.value.relative_path,r.value.operation_name].some(x=>x?.trim())) error(r,'url','edit.endpointRequired');
      for (const [,fields] of schema.groups(r.table)) for (const f of fields) {
        const value = schema.read(r.value,f.key,draft.lang,r.table);
        if (f.required && !String(value).trim()) error(r,f.key);
        if (f.type === 'reference' && value && !snapshot()[f.table].some(x=>x.id === value)) error(r,f.key,'edit.invalidReference');
        if (f.type === 'url' && value && !validUrl(value) || f.type === 'urls' && String(value).split('\n').some(x=>x && !validUrl(x))) error(r,f.key,'edit.invalidUrl');
      }
      if (r.value.version && !r.value.version_date && (!r.original || r.value.version !== r.original.version)) error(r,'version_date');
      if (['domain','business_object','business_attribute'].includes(r.table) && r.value.status === 'valid' && !schema.languages.some(l=>r.value['description_'+l]?.trim())) error(r,'description');
      if (r.table === 'business_attribute' && (r.value.status === 'valid' || !r.original) && !r.value.value_specification?.valueType) error(r,'valueType');
      if (r.value.value_specification && !r.value.value_specification.valueType) error(r,'valueType');
      if (r.table === 'data_field' && !!r.value.source_data_type !== !!r.value.data_type_scope) error(r,r.value.source_data_type ? 'data_type_scope' : 'source_data_type');
      const org = r.value[r.table === 'code_list' ? 'authority_organisation' : 'responsible_organisation'];
      if (org && !schema.languages.some(l=>org['name_'+l])) error(r,'organisationName');
    }
    const unique = new Map();
    for (const r of draft.rows) {
      const key = r.table === 'code_value' ? 'code' : ['business_attribute','product_attribute'].includes(r.table) ? 'semantic_name' : null;
      if (key && r.value[key]) { if (unique.has(r.value[key])) { error(r,key,'edit.duplicate'); error(unique.get(r.value[key]),key,'edit.duplicate'); } else unique.set(r.value[key],r); }
    }
    const first = Object.keys(draft.errors)[0];
    if (!first) return true;
    const target = all.find(r=>first.startsWith('edit-'+r.value.id+'-'));
    if (target !== draft.root) { draft.tab = 'rows'; draft.filter=''; draft.showArchived=true; draft.page=Math.floor(draft.rows.indexOf(target)/25); draft.expanded.add(target.value.id); }
    else draft.tab='overview';
    draft.message='edit.validation'; render(first); return false;
  }
  function validUrl(value) { try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password && !/[\s\\]/.test(value); } catch { return false; } }
  function errorMessage(error) {
    if (error.code === '40001') return 'edit.conflict';
    if (['42501','PGRST301','PGRST303'].includes(error.code)) return 'edit.denied';
    if (error.code === '23505') return 'edit.duplicateServer';
    if (['23514','23502','23503','22023','22P02'].includes(error.code)) return 'edit.invalidServer';
    if (['PGRST202','42883'].includes(error.code)) return 'edit.unavailable';
    return 'edit.network';
  }
  async function reloadSaved(owner) {
    owner.busy = true; render();
    try {
      await DK.data.load('data/');
      if (draft !== owner) return;
      const target = owner.root.original ? null : DK.router.entityHref(owner.kind,owner.saved.identifier);
      draft = null;
      if (target) DK.router.navigate(target); else { DK.app.render(); document.getElementById('page-content')?.focus({preventScroll:true}); }
      ui.toast(t('edit.saved'),'success');
    } catch { owner.busy=false; owner.message='edit.savedReloadFailed'; render(); }
  }
  async function save() {
    if (!draft || draft.busy || draft.saved || !capability || draft.userId !== DK.auth.user?.id || !dirtyCount() || !validate()) return;
    const owner = draft;
    if (!owner.request) owner.request = {p_command_id:crypto.randomUUID(),p_table:owner.root.table,p_id:owner.root.value.id,p_expected_version:owner.root.original?.row_version || 0,p_patch:patch(owner.root),
      p_children:owner.rows.filter(r=>!r.original || Object.keys(patch(r)).length).map(r=>({id:r.value.id,expected_version:r.original?.row_version || 0,patch:patch(r)}))};
    owner.busy=true;owner.message=null;render();
    try { owner.saved = await DK.auth.editRequest('save_entry',owner.request); await reloadSaved(owner); }
    catch (error) { if (draft !== owner) return; owner.busy=false;owner.message=errorMessage(error);render();document.getElementById('edit-message')?.scrollIntoView({block:'nearest'}); }
  }
  function confirmDiscard(next = stop) {
    if (!draft || draft.busy) return;
    if (!dirtyCount() || draft.saved) { next(); return; }
    if (confirmDialog?.open) return;
    const focus = document.activeElement;
    confirmDialog = document.createElement('dialog'); confirmDialog.className='ob-edit-confirm';confirmDialog.setAttribute('aria-labelledby','edit-discard-title');
    confirmDialog.innerHTML=`<h2 id="edit-discard-title">${esc(t('edit.discardTitle'))}</h2><p>${esc(t('edit.discardHint',{count:dirtyCount()}))}</p><div>${button('keep','edit.keepEditing')}${button('confirm','edit.discard','',true)}</div>`;
    document.body.append(confirmDialog);
    const close = accepted => {confirmDialog.close();confirmDialog.remove();confirmDialog=null;if (accepted) next();else focus?.focus({preventScroll:true});};
    confirmDialog.addEventListener('cancel',event=>{event.preventDefault();close(false);});
    confirmDialog.addEventListener('keydown',event=>event.stopPropagation());
    confirmDialog.addEventListener('click',event=>{event.stopPropagation();const action=event.target.closest('[data-edit]')?.dataset.edit;if(action)close(action==='confirm');});
    confirmDialog.showModal();confirmDialog.querySelector('button').focus();
  }
  function reorder(id,to) {
    if (!draft || draft.busy || draft.saved) return;
    const from = draft.rows.findIndex(r=>r.value.id === id);if(from<0 || to<0 || to>=draft.rows.length || draft.filter)return;
    draft.rows.splice(to,0,draft.rows.splice(from,1)[0]);draft.rows.forEach((r,i)=>r.value.sort_order=i+1);draft.request=null;render();
    document.querySelector(`[data-edit="up"][data-row="${id}"]`)?.focus({preventScroll:true});
  }
  function click(event) {
    if (event.target.closest('.ob-edit-confirm')) return;
    const el = event.target.closest('[data-edit]'); if (!el) return;
    event.preventDefault();event.stopPropagation();
    const action=el.dataset.edit;
    if(action==='start'||action==='create'){start(action==='create');return;}
    if(!draft || draft.busy)return;
    const r=draft.rows.find(r=>r.value.id===el.dataset.row);
    if(action==='save')save();
    else if(action==='reload')reloadSaved(draft);
    else if(action==='discard')confirmDiscard();
    else if(action==='login')DK.auth.open();
    else if(action==='tab'){draft.tab=el.dataset.tab;render('edit-tab-'+draft.tab);}
    else if(action==='add-row'){
      const table=schema.children[draft.root.table][0],value=schema.defaults(table,draft.lang);value.sort_order=draft.rows.length ? Math.max(...draft.rows.map(x=>x.value.sort_order||0))+1 : 1;
      draft.rows.push(row(table,value,false));draft.filter='';draft.showArchived=false;draft.page=Math.floor((matchingRows().length-1)/25);draft.request=null;render(`edit-${value.id}-${table==='code_value'?'code':table==='service_endpoint'?'url':'name'}`);
    } else if(action==='archive'||action==='restore'){
      if(!r)return;
      if(!r.original && action==='archive')draft.rows=draft.rows.filter(x=>x!==r);else r.value.is_archived=action==='archive';
      draft.request=null;render();document.querySelector('[data-edit="add-row"]')?.focus({preventScroll:true});
    } else if(action==='up'||action==='down')reorder(el.dataset.row,draft.rows.indexOf(r)+(action==='up'?-1:1));
    else if(action==='row-details'){if(draft.expanded.has(el.dataset.row))draft.expanded.delete(el.dataset.row);else draft.expanded.add(el.dataset.row);render();}
    else if(action==='previous'||action==='next'){draft.page+=action==='next'?1:-1;render();document.querySelector(`[data-edit="${action}"]`)?.focus();}
  }
  DK.editor={
    get active(){return !!draft;},
    actions(ctx){
      if(!DK.auth.user || !snapshot() || !rootForRoute(ctx.route || DK.app.route))return '';
      const route=ctx.route || DK.app.route;
      if(route.view==='detail')return button('start','edit.edit');
      if(route.view==='list')return button('create','edit.create');
      return '';
    },
    activeFor:route=>!!draft && draft.routeKey===routeKey(route), render:renderEditor,
    onAuthChange:()=>checkCapability(),
    guardRoute(){
      if(!draft)return false;
      const route=DK.router.parse();if(routeKey(route)===draft.routeKey){draft.hash=location.hash;return false;}
      if(!dirtyCount()&&!draft.busy){draft=null;return false;}
      const target=location.hash;history.replaceState(history.state,'',location.pathname+location.search+draft.hash);
      confirmDiscard(()=>{draft=null;DK.router.navigate(target);});return true;
    },
    mount(){
      document.addEventListener('click',click,true);
      document.addEventListener('input',event=>{
        if(event.target.matches('[data-edit-field]'))updateControl(event.target);
        if(draft && event.target.matches('[data-edit-filter]')){const pos=event.target.selectionStart;draft.filter=event.target.value;draft.page=0;render('edit-row-search');document.getElementById('edit-row-search')?.setSelectionRange?.(pos,pos);}
      });
      document.addEventListener('change',event=>{
        if(event.target.matches('select[data-edit-field],input[type="checkbox"][data-edit-field]'))updateControl(event.target);
        if(!draft)return;
        if(event.target.matches('[data-edit-language]')){draft.lang=event.target.value;draft.errors={};render('edit-language');}
        if(event.target.matches('[data-edit-archived]')){draft.showArchived=event.target.checked;draft.page=0;render();}
      });
      document.addEventListener('keydown',event=>{
        if(!draft || !event.target.closest('#catalog-editor'))return;
        if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save();}
        if(event.target.matches('[data-edit="tab"]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
          event.preventDefault();event.stopPropagation();const tabs=[...document.querySelectorAll('[data-edit="tab"]')],i=tabs.indexOf(event.target),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();
        }
      },true);
      let dragged=null;
      document.addEventListener('dragstart',event=>{dragged=event.target.dataset.dragRow || null;if(dragged)event.dataTransfer.setData('text/plain',dragged);});
      document.addEventListener('dragover',event=>{if(draft && dragged && event.target.closest('[data-edit-row]'))event.preventDefault();});
      document.addEventListener('drop',event=>{if(!draft||!dragged)return;const target=event.target.closest('[data-edit-row]');if(target){event.preventDefault();reorder(dragged,draft.rows.findIndex(r=>r.value.id===target.dataset.editRow));}dragged=null;});
      document.addEventListener('dragend',()=>{dragged=null;});
      window.addEventListener('beforeunload',event=>{if(draft && (dirtyCount()||draft.busy)&&!draft.saved){event.preventDefault();event.returnValue='';}});
      checkCapability();
    },
  };
})(window.DK);
