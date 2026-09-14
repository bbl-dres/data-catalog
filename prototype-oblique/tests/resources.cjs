const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),elements=[];
const context={window:{},URL,AbortController,setTimeout,clearTimeout,document:{baseURI:'https://catalog.example/app/',createElement:tag=>({tag,remove(){this.removed=true;}}),head:{insertBefore:e=>elements.push(e)}},fetch:async()=>{throw new Error('offline');}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'js/resources.js'),'utf8'),context);
const resources=context.window.DK.resources;
(async()=>{
  const unhandled=[];const observe=e=>unhandled.push(e);
  process.on('unhandledRejection',observe);
  try {
    context.window.DK.catalogConfig={provider:'json'};
    vm.runInContext(fs.readFileSync(path.join(root,'js/boot.js'),'utf8'),context);
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(unhandled.length,0,'An early request may fail before data.js arrives');
    for(const name of ['config','i18n','model','manual'])await assert.rejects(context.window.DK.boot.take('data/'+name+'.json'),/offline/);
    assert.equal(context.window.DK.boot.take('data/config.json'),null);
  } finally {process.off('unhandledRejection',observe);}
  context.fetch=async(url,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError'))))});
  await assert.rejects(resources.read('hung-body',{timeout:5}),{name:'AbortError'});
  let ready=false;
  const first=resources.asset('vendor.js',{ready:()=>ready});
  assert.equal(resources.asset('vendor.js'),first);assert.equal(elements.length,1);
  const lateLoad=elements[0].onload;
  elements[0].onerror();await assert.rejects(first,/could not be loaded/);assert(elements[0].removed);
  const retry=resources.asset('vendor.js',{ready:()=>ready});
  lateLoad();ready=true;elements[1].onload();await retry;
  assert.equal(elements[1].removed,undefined,'An old failure cannot remove the retry');
  const missing=resources.asset('empty.js',{ready:()=>false});elements[2].onload();await assert.rejects(missing);
  const css=resources.asset('vendor.css',{stylesheet:true});elements[3].onerror();await assert.rejects(css);
  const cssRetry=resources.asset('vendor.css',{stylesheet:true});elements[4].onload();await cssRetry;
  for(const url of ['http://remote.example','https://user:password@catalog.example','ftp://localhost'])assert.throws(()=>resources.catalogConnection({url,publishableKey:'sb_publishable_test'}));
  for(const callback of ['?keep=1&code=private&sb_flow_id=flow#/objects','?keep=1&error=denied&error_description=private#/objects','?keep=1#access_token=private&refresh_token=private&type=invite']) {
    const location={href:'https://catalog.example/app/'+callback};
    const authContext={window:{DK:{ui:{},catalogConfig:{provider:'supabase'},catalog:{connection:()=>({})},resources:{asset:()=>new Promise(()=>{})}}},URL,URLSearchParams,location,
      history:{replaceState:(state,title,url)=>{location.href=new URL(url,location.href).href;}}};
    vm.runInNewContext(fs.readFileSync(path.join(root,'js/auth.js'),'utf8'),authContext);
    assert(!/private|sb_flow_id|error_description/.test(location.href),'Callback secrets are scrubbed before waiting for the SDK');
    assert.equal(new URL(location.href).search,'?keep=1','Unrelated hosting parameters are retained');
  }
  const storage = new Map(), requests = [];
  context.Response = Response;
  context.caches = { open: async () => ({
    match: async key => storage.get(String(key))?.clone(),
    put: async (key, response) => { storage.set(String(key), response); },
    keys: async () => [...storage.keys()], delete: async key => storage.delete(String(key)),
  }) };
  const config = { url:'https://cache.example', publishableKey:'sb_publishable_test' };
  const value = { schemaVersion:1, scope:'index', catalogVersion:'9007199254740993', childCounts:{} };
  let answer = value, release;
  context.fetch = async (url, options) => {
    requests.push({url:String(url),body:JSON.parse(options.body),headers:options.headers});
    if(release==='wait')await new Promise(resolve=>{release=resolve;});
    return {ok:true,json:async()=>answer};
  };
  assert.deepEqual(await resources.catalogRead(config,'read_catalog_index'),value);
  answer = {schemaVersion:1,catalogVersion:value.catalogVersion,notModified:true};
  assert.deepEqual(await resources.catalogRead(config,'read_catalog_index'),value);
  assert.deepEqual(requests.at(-1).body,{if_version:'9007199254740993'},'Exact bigint revision survives browser storage');
  release='wait';
  const readA=resources.catalogRead(config,'read_catalog_index'),readB=resources.catalogRead(config,'read_catalog_index');
  while(typeof release!=='function')await new Promise(resolve=>setTimeout(resolve,0));
  release();await Promise.all([readA,readB]);
  assert.equal(requests.length,3,'Concurrent conditional reads share one request');
  assert.equal(requests[0].headers.Authorization,undefined,'Public cache requests carry no session credentials');
  answer=value;
  await resources.catalogRead({...config,url:'https://other.example'},'read_catalog_index');
  assert.deepEqual(requests.at(-1).body,{},'Project URL partitions the cache');
  context.caches.open=async()=>{throw new Error('Storage denied');};
  assert.deepEqual(await resources.catalogRead(config,'read_catalog_index'),value);
  assert.deepEqual(requests.at(-1).body,{},'Unavailable storage falls back to a network read');
  console.log('Resources: early rejection, body timeout, asset retry, Auth callback cleanup, conditional public caching, exact revisions, project isolation, deduplication and storage denial passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
