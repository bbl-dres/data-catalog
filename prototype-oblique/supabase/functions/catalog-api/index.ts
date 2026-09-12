/* Standard HTTP routes over the audited SQL command boundary. No service-role key.
   Importable in Node tests; Deno is used only by the production entry point. */
export const resources = ['actor','domain','system','business_object','business_attribute','data_table','data_field','code_list','code_value','data_product','product_attribute','data_service','service_endpoint','quality_requirement','relationship','lineage_relation'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,if-match,idempotency-key','Access-Control-Expose-Headers':'ETag,Location,Content-Range','Cache-Control':'no-store'};
const json = (body: unknown, status=200, headers: Record<string,string>={}) => Response.json(body,{status,headers:{...cors,...headers}});
const failure = (status: number,code: string,message: string) => json({code,message},status);
function errorStatus(code: string, fallback: number) {
  if (code==='40001') return 412;
  if (code==='P0002') return 404;
  if (code==='42501') return 403;
  if (code==='23505') return 409;
  if (['23514','23502','23503','22023','22P02','22003','22007','22008'].includes(code)) return 422;
  return fallback>=400 ? fallback : 500;
}
export function createHandler({url,publicKey,fetcher=fetch}: {url: string,publicKey: string,fetcher?: typeof fetch}) {
  const project = new URL(url);
  if (!publicKey?.startsWith('sb_publishable_') || project.username || project.password || (project.protocol!=='https:' && !(project.protocol==='http:' && ['localhost','127.0.0.1'].includes(project.hostname)))) throw new Error('Configure the public project URL and publishable key');
  async function upstream(path: string, init: {method?: string,headers?: Record<string,string>,body?: string}={}) {
    return await fetcher(new URL(path,project),{...init,redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000),headers:{apikey:publicKey,...init.headers}});
  }
  return async (request: Request) => {
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
    try {
      const incoming=new URL(request.url);
      const match=/^\/(?:functions\/v1\/)?catalog-api\/([a-z_]+)(?:\/([0-9a-f-]+))?\/?$/i.exec(incoming.pathname);
      if (!match || !resources.includes(match[1]) || (match[2] && !uuid.test(match[2]))) return failure(404,'not_found','Unknown catalog resource');
      const [,table,id]=match, method=request.method;
      if (!['GET','POST','PATCH','DELETE'].includes(method) || (method==='POST' && id) || (['PATCH','DELETE'].includes(method) && !id)) return failure(405,'method_not_allowed','Use GET for reads, POST on a collection, and PATCH/DELETE on a record');
      if (method==='GET') {
        if (id && incoming.search) return failure(400,'invalid_query','Single-record reads do not accept query parameters');
        const assignment=['business_attribute','data_field'].includes(table) ? table+'_quality_requirement' : null;
        const query = id ? '?id=eq.'+id+'&limit=1'+(assignment?'&select=*,'+assignment+'(quality_requirement_id)':'') : incoming.search;
        const response=await upstream('/rest/v1/'+table+query,{headers:{'Accept-Profile':'catalog','Accept':'application/json'}});
        if (!response.ok) return json(await response.json(),response.status);
        const raw=await response.text(),rows=JSON.parse(raw);
        if (id && !rows.length) return failure(404,'not_found','Record not found');
        if (id && assignment) { rows[0].quality_requirement_ids=(rows[0][assignment] || []).map((row: {quality_requirement_id: string})=>row.quality_requirement_id).sort(); delete rows[0][assignment]; }
        const headers: Record<string,string>=id ? {ETag:'"'+rows[0].row_version+'"'} : response.headers.has('Content-Range') ? {'Content-Range':response.headers.get('Content-Range')!} : {};
        // Preserve native JSON numeric precision while proxying ordinary reads.
        if (!assignment || !id) return new Response(id ? raw.trim().slice(1,-1) : raw,{status:response.status,headers:{...cors,...headers,'Content-Type':'application/json'}});
        return json(rows[0],response.status,headers);
      }
      if (incoming.search) return failure(400,'invalid_query','Writes target one record; query filters are not accepted');
      const authorization=request.headers.get('Authorization');
      if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization || '')) return failure(401,'authentication_required','Use the access token from your app account');
      const command=request.headers.get('Idempotency-Key');
      if (!uuid.test(command || '')) return failure(400,'idempotency_key_required','Supply a UUID Idempotency-Key; keep it when retrying the same request');
      let expected=0;
      if (method!=='POST') {
        const revision=/^"([1-9][0-9]*)"$/.exec(request.headers.get('If-Match') || '');
        if (!revision || !Number.isSafeInteger(Number(revision[1]))) return failure(428,'revision_required','Supply If-Match with the quoted row_version from the record read');
        expected=Number(revision[1]);
      }
      const limit=2097152;
      if (Number(request.headers.get('Content-Length'))>limit) return failure(413,'body_too_large','Maximum request size is 2 MiB');
      const reader=request.body?.getReader();let size=0;const chunks: Uint8Array[]=[];
      if (reader) while(true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return failure(413,'body_too_large','Maximum request size is 2 MiB');}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const text=new TextDecoder().decode(bytes);
      if (method==='DELETE' && text.trim()) return failure(400,'invalid_body','DELETE accepts no body');
      if (method!=='DELETE' && !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return failure(415,'json_required','Use Content-Type: application/json');
      let body={};try{if(method!=='DELETE')body=JSON.parse(text);}catch{return failure(400,'invalid_json','Request body must be a JSON object');}
      if (!body || Array.isArray(body) || typeof body!=='object') return failure(400,'invalid_body','Request body must be a JSON object');
      // Auth verifies signature, expiration and the existing app user; the Data API
      // then verifies the forwarded token again and SQL checks its permanent role.
      const identity=await upstream('/auth/v1/user',{headers:{Authorization:authorization!}});
      if (!identity.ok) return failure(identity.status>=500 ? 503 : 401,'invalid_token','Sign in and copy a current access token');
      const user=await identity.json();
      if (!user.id || user.is_anonymous) return failure(403,'permanent_account_required','A permanent app account is required');
      const operations: Record<string,string>={POST:'create',PATCH:'update',DELETE:'delete'};
      const response=await upstream('/rest/v1/rpc/api_write',{method:'POST',headers:{Authorization:authorization!,'Content-Profile':'catalog','Content-Type':'application/json'},body:JSON.stringify({p_operation:operations[method],p_table:table,p_id:id || null,p_expected_version:expected,p_body:body,p_command_id:command})});
      const raw=await response.text(),result=JSON.parse(raw);
      if(!response.ok) return failure(errorStatus(result.code,response.status),result.code || 'write_failed',result.message || 'The write failed');
      const headers: Record<string,string>={ETag:'"'+result.row_version+'"'};
      if(method==='POST')headers.Location=incoming.pathname.replace(/\/$/,'')+'/'+result.id;
      return new Response(raw,{status:method==='POST'?201:200,headers:{...cors,...headers,'Content-Type':'application/json'}});
    } catch { return failure(503,'temporarily_unavailable','The request could not be confirmed. Retry writes with the same Idempotency-Key and body.'); }
  };
}
if (typeof Deno !== 'undefined') {
  // PUBLIC_CATALOG_KEY is the same public key shipped by the app, not a secret.
  Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL')!,publicKey:Deno.env.get('PUBLIC_CATALOG_KEY')!}));
}
