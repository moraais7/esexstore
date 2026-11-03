import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { mkdir, readFile, writeFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStore, validateData } from './database.js';
import { createAuth, bootstrapAdmin } from './auth.js';
import { withRequestContext } from './runtime.js';
const failure=(status,message)=>Object.assign(new Error(message),{status});
const PUBLIC_FIELDS={
 Product:'id created_date updated_date name slug summary description categories brand tags seo_title seo_description status visible featured composition care_instructions images price_from price_from_promo total_stock sku_default sex age_range mpn physical',
 ProductVariant:'id created_date updated_date product_id sku option1_name option1_value option2_name option2_value option3_name option3_value price promo_price stock weight_kg height_cm width_cm length_cm barcode active position',
 Category:'id created_date updated_date name slug parent_slug description image_url sort_order active',
 ContentPage:'id created_date updated_date title slug subtitle body status show_in_footer sort_order',
 Redirect:'id from_path to_path active',
 SiteSettings:'id key store_name tagline announcement whatsapp_number whatsapp_message contact_email instagram address about_short logo_url payments_configured payments_note shipping_configured shipping_note demo_mode shipping_provider shipping_fixed_price shipping_fixed_days'
};
const fields=Object.fromEntries(Object.entries(PUBLIC_FIELDS).map(([name,keys])=>[name,new Set(keys.split(' '))]));
function redact(name,row){if(!row)return row;const out=Object.fromEntries(Object.entries(row).filter(([key])=>fields[name].has(key)));if(name==='Product'&&Array.isArray(out.images))out.images=out.images.map(image=>Object.fromEntries(Object.entries(image).filter(([key])=>['url','alt','variant_sku','sort_order'].includes(key))));return out;}
function publicQuery(name,query){for(const[key,value]of Object.entries(query)){if(key==='$or'||key==='$and'){if(!Array.isArray(value))throw failure(400,'Consulta inválida');value.forEach(q=>publicQuery(name,q));}else if(!fields[name].has(key))throw failure(403,'Campo privado');}}
async function publicScope(name,store){switch(name){case 'Product':return {visible:true,status:'active'};case 'ProductVariant':{let cursor;const ids=[];do{const page=await store.entities.Product.filter({visible:true,status:'active'},{limit:5000,cursor});ids.push(...page.items.map(r=>r.id));cursor=page.next_cursor;}while(cursor);return {active:true,product_id:{$in:ids}};}case 'Category':case 'Redirect':return {active:true};case 'ContentPage':return {status:'published'};case 'SiteSettings':return {key:'main'};default:throw failure(403,'Acesso negado');}}
async function readBody(req,limit=1048576){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw failure(413,'Arquivo ou requisição muito grande');chunks.push(chunk);}return Buffer.concat(chunks);}
function jsonBody(bytes){try{const data=bytes.length?JSON.parse(bytes.toString('utf8')):{};if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();validateData(data);return data;}catch{throw failure(400,'JSON inválido');}}
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
async function fileResponse(root,relative){if(!root)return null;try{const base=await realpath(root);const target=await realpath(path.resolve(base,relative));if(!target.startsWith(base+path.sep)||relative.split(/[\\/]/).some(p=>p.startsWith('.'))||!(await stat(target)).isFile())return null;return new Response(await readFile(target),{headers:{'Content-Type':MIME[path.extname(target).toLowerCase()]||'application/octet-stream','Cache-Control':'public, max-age=3600'}});}catch{return null;}}
function rasterType(bytes){
 if(bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0)return 'png';
 if(bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217)return 'jpg';
 if(bytes.length>=14&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))&&bytes.readUInt16LE(6)>0&&bytes.readUInt16LE(8)>0&&bytes.at(-1)===59)return 'gif';
 if(bytes.length>=20&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length)return 'webp';
 return null;
}
function normalizedIP(value){
 const ip=String(value||'').trim();if(!isIP(ip)||ip.includes('%'))return null;
 if(isIP(ip)===4)return ip;
 const canonical=new URL(`http://[${ip}]/`).hostname.slice(1,-1);
 // Canonical URL serialization expresses mapped IPv4 as two hex groups.
 const mapped=canonical.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
 if(mapped){const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);return `${high>>8}.${high&255}.${low>>8}.${low&255}`;}
 return canonical;
}
function trustedProxies(value){
 const ips=String(value||'').split(',').map(ip=>ip.trim()).filter(Boolean);
 const normalized=ips.map(normalizedIP);if(normalized.some(ip=>!ip))throw new Error('TRUSTED_PROXY_IPS must contain exact IP addresses separated by commas');return new Set(normalized);
}
function clientIP(req,trusted){
 const peer=normalizedIP(req.socket.remoteAddress)||'unknown';if(!trusted.has(peer))return peer;
 const forwarded=req.headers['x-forwarded-for'];if(typeof forwarded!=='string'||forwarded.length>2048)return peer;
 const hops=forwarded.split(',').map(normalizedIP);if(hops.some(ip=>!ip))return peer;
 let current=peer;for(let i=hops.length-1;i>=0&&trusted.has(current);i--)current=hops[i];return current;
}
export function createApplication({databasePath=':memory:',publicUrl='http://localhost:3000',handlers={},env={},distDir,uploadsDir=path.resolve('data/uploads')}={}){
 const origin=new URL(publicUrl).origin;const store=createStore(databasePath);const auth=createAuth(store,{...env,PUBLIC_URL:publicUrl});
 if(env.ADMIN_EMAIL&&env.ADMIN_PASSWORD)bootstrapAdmin(store,env.ADMIN_EMAIL,env.ADMIN_PASSWORD);
 const trusted=trustedProxies(env.TRUSTED_PROXY_IPS);
 const limits=new Map();
 function rate(key,max,period){const now=Date.now();if(limits.size>10000)for(const[k,bucket]of limits)if(bucket.until<now)limits.delete(k);const bucket=limits.get(key);if(!bucket||bucket.until<now){limits.set(key,{count:1,until:now+period});return;}if(++bucket.count>max)throw failure(429,'Muitas tentativas. Tente novamente mais tarde.');}
 const secure=new URL(publicUrl).protocol==='https:';
 const cookie=(token,remove=false)=>`store_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${remove?0:7*86400}${secure?'; Secure':''}`;
 const server=createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,publicUrl);let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{throw failure(400,'Caminho inválido');}
 const method=req.method||'GET';const mutating=!['GET','HEAD','OPTIONS'].includes(method);const user=await auth.currentUser(req.headers.cookie);const admin=user?.role==='admin';
 if(mutating){const incoming=req.headers.origin;if((incoming&&incoming!==origin)||req.headers['sec-fetch-site']==='cross-site'||(user&&!incoming&&req.headers['sec-fetch-site']!=='same-origin'))throw failure(403,'Origem inválida');}
 let response;
 if(pathname.startsWith('/api/')){
 const ip=clientIP(req,trusted);
 // Stripe signatures still authenticate the raw request in its handler. A separate
 // bounded bucket keeps storefront traffic from starving payment notifications.
 if(pathname==='/api/functions/stripeWebhook')rate(`webhook:${ip}`,1200,60000);else rate(`api:${ip}`,600,60000);
 if(pathname.startsWith('/api/auth/')){
 const action=pathname.slice(10);if(action==='me'&&method==='GET'){if(!user)throw failure(401,'Autenticação necessária');response=Response.json(user);}else {
 if(method!=='POST')throw failure(405,'Método inválido');rate(`auth:${ip}`,30,15*60000);const body=jsonBody(await readBody(req,16384));
 if(action==='login'){const {token,user:logged}=await auth.login(body);response=Response.json(logged,{headers:{'Set-Cookie':cookie(token)}});}
 else if(action==='logout'){await auth.logout(req.headers.cookie);response=Response.json({ok:true},{headers:{'Set-Cookie':cookie('',true)}});}
 else if(action==='register')response=Response.json(await auth.register(body));
 else if(action==='verify'){const {token,user:verified}=await auth.verify(body);response=Response.json(verified,{headers:{'Set-Cookie':cookie(token)}});}
 else if(action==='resend')response=Response.json(await auth.resend(body));
 else if(action==='forgot-password')response=Response.json(await auth.forgotPassword(body));
 else if(action==='reset-password')response=Response.json(await auth.resetPassword(body));
 else throw failure(404,'Rota não encontrada');
 }
 }else if(pathname==='/api/uploads'||pathname==='/api/upload'){
 if(!user)throw failure(401,'Autenticação necessária');if(!admin)throw failure(403,'Acesso negado');if(method!=='POST')throw failure(405,'Método inválido');rate(`upload:${user.id}`,20,60000);
 const body=await readBody(req,8*1024*1024);let form;try{form=await new Request(url,{method:'POST',headers:{'Content-Type':req.headers['content-type']||''},body}).formData();}catch{throw failure(400,'Upload inválido');}
 const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function')throw failure(400,'Arquivo obrigatório');const bytes=Buffer.from(await file.arrayBuffer());const ext=rasterType(bytes);if(!ext)throw failure(400,'Imagem inválida');await mkdir(uploadsDir,{recursive:true});const name=`${randomUUID()}.${ext}`;await writeFile(path.join(uploadsDir,name),bytes,{flag:'wx'});response=Response.json({file_url:`/uploads/${name}`});
 }else if(pathname.startsWith('/api/entities/')){
 const parts=pathname.slice(14).split('/');const [name,action]=parts;const entity=store.entities[name];if(!Object.hasOwn(store.entities,name)||parts.length>2)throw failure(404,'Entidade não encontrada');
 const read=method==='GET'||method==='POST'&&['query','count','aggregate'].includes(action);
 if(!read&&!user)throw failure(401,'Autenticação necessária');if(!read&&!admin)throw failure(403,'Acesso negado');if(!admin&&!fields[name])throw failure(403,'Acesso negado');
 const body=method==='POST'||method==='PATCH'?jsonBody(await readBody(req)):{};
 const scope=admin?{}:await publicScope(name,store);
 if(method==='POST'&&['query','count','aggregate'].includes(action)){
 const query=body.query||{};if(!admin)publicQuery(name,query);const combined={$and:[query,scope]};
 if(action==='query'){const options=body.options||{};if(!admin&&options.sort){const key=typeof options.sort==='string'?options.sort.replace(/^-/,''):Object.keys(options.sort)[0];if(!fields[name].has(key))throw failure(403,'Campo privado');}const page=await entity.filter(combined,options);response=Response.json(admin?page:{...page,items:page.items.map(row=>redact(name,row))});}
 else if(action==='count')response=Response.json(await entity.count(combined));
 else {if(!admin)for(const field of body.sum||[])if(!fields[name].has(field))throw failure(403,'Campo privado');response=Response.json(await entity.aggregate({query:combined,sum:body.sum||[]}));}
 }else if(!action&&method==='POST')response=Response.json(await entity.create(body),{status:201});
 else if(action==='delete-many'&&method==='POST')response=Response.json(await entity.deleteMany(body.query||{}));
 else if(action&&method==='GET'){let row=await entity.get(action);if(row&&!admin){const page=await entity.filter({$and:[{id:action},scope]},{limit:1});row=page.items[0];}if(!row)throw failure(404,'Registro não encontrado');response=Response.json(admin?row:redact(name,row));}
 else if(action&&method==='PATCH'){const row=await entity.update(action,body);if(!row)throw failure(404,'Registro não encontrado');response=Response.json(row);}
 else if(action&&method==='DELETE')response=Response.json(await entity.delete(action));
 else throw failure(405,'Método inválido');
 }else if(pathname.startsWith('/api/functions/')){
 if(method!=='POST')throw failure(405,'Método inválido');const name=pathname.slice(15);if(!Object.hasOwn(handlers,name)||typeof handlers[name]!=='function')throw failure(404,'Função não encontrada');
 const bytes=await readBody(req);const request=new Request(url,{method,headers:req.headers,body:bytes});response=await withRequestContext(request,{store,user,env},()=>handlers[name](request));if(!(response instanceof Response))throw failure(500,'Resposta inválida');
 }else throw failure(404,'Rota não encontrada');
 }else {
 if(!['GET','HEAD'].includes(method))throw failure(405,'Método inválido');
 if(pathname.startsWith('/uploads/'))response=await fileResponse(uploadsDir,pathname.slice(9));
 else response=await fileResponse(distDir,pathname==='/'?'index.html':pathname.slice(1));
 if(!response&&!pathname.startsWith('/uploads/')&&!path.extname(pathname)&&!pathname.split('/').some(p=>p.startsWith('.')))response=await fileResponse(distDir,'index.html');
 if(!response)throw failure(404,'Arquivo não encontrado');
 }
 res.statusCode=response.status;for(const[key,value]of response.headers)res.setHeader(key,value);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');if(pathname.startsWith('/api/'))res.setHeader('Cache-Control','no-store');if(pathname.startsWith('/uploads/'))res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.end(method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch(error){res.statusCode=Number.isInteger(error.status)?error.status:400;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:error.status?error.message:'Requisição inválida'}));}
 });
 return {server,store,async close(){if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));store.close();}};
}
