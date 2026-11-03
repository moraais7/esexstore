/** One-time, read-only public catalog migration. No authentication is accepted. */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const fields = {
 Product: 'id,source_id,name,slug,summary,description,categories,brand,tags,seo_title,seo_description,status,visible,featured,composition,care_instructions,images,price_from,price_from_promo,total_stock,sku_default,sex,age_range,mpn,physical',
 ProductVariant: 'id,product_id,source_id,sku,option1_name,option1_value,option2_name,option2_value,option3_name,option3_value,price,promo_price,stock,weight_kg,height_cm,width_cm,length_cm,barcode,active,position',
 Category: 'id,name,slug,parent_slug,description,image_url,sort_order,active,source_id',
 ContentPage: 'id,title,slug,subtitle,body,status,show_in_footer,sort_order',
 Redirect: 'id,from_path,to_path,active',
 SiteSettings: 'id,key,store_name,tagline,announcement,whatsapp_number,whatsapp_message,contact_email,instagram,address,about_short,logo_url',
};
const args=Object.fromEntries(process.argv.slice(2).map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
const origin=args['--source-url'] || process.env.CATALOG_SOURCE_URL;
const appId=args['--app-id'] || process.env.CATALOG_SOURCE_APP_ID;
if(!origin || !appId) throw new Error('Use --source-url=https://… --app-id=… [--csv=…] [--branding=private.json]');
const root=process.cwd(), privateDir=path.join(root,'.superpowers/sdd/independent-store');
await Promise.all([mkdir(privateDir,{recursive:true}),mkdir('public/media',{recursive:true}),mkdir('server/data',{recursive:true})]);
const report={generated_at:new Date().toISOString(),counts:{},csv:{matched:0,enriched:0,ambiguous:0,unmatched:0},assets:[],unresolved:[]};
const seed={};
for(const [entity,fieldList] of Object.entries(fields)) {
 const url=new URL(`/api/apps/${encodeURIComponent(appId)}/entities/${entity}/v2/list`,origin);url.searchParams.set('limit','500');url.searchParams.set('fields',fieldList);
 const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw new Error(`${entity}: HTTP ${response.status}`);
 const data=await response.json();const rows=Array.isArray(data)?data:data.items;
 if(!Array.isArray(rows))throw new Error(`${entity}: unexpected response`);
 if(rows.length>=500 || data.next_cursor)throw new Error(`${entity}: pagination required; refuse truncated export`);
 seed[entity]=rows.map(row=>Object.fromEntries(fieldList.split(',').filter(k=>row[k]!==undefined).map(k=>[k,row[k]])));
}
seed.Product=seed.Product.filter(p=>p.status==='active'&&p.visible===true);
const ids=new Set(seed.Product.map(p=>p.id));
seed.ProductVariant=seed.ProductVariant.filter(v=>ids.has(v.product_id));
seed.Category=seed.Category.filter(c=>c.active!==false);
seed.ContentPage=seed.ContentPage.filter(p=>p.status==='published');
seed.Redirect=seed.Redirect.filter(r=>r.active!==false&&/^\//.test(r.from_path)&&/^\/(?!\/)/.test(r.to_path));
if(!seed.SiteSettings.length)seed.SiteSettings=[{id:'settings-main',key:'main',store_name:'Esex Store'}];
for(const s of seed.SiteSettings)Object.assign(s,{payments_configured:false,shipping_configured:false,shipping_origin_postal_code:'32241340',shipping_provider:'melhor_envio',shipping_sandbox:false,demo_mode:false});
if(args['--csv']){
 const {registerHooks}=await import('node:module');
 registerHooks({resolve(specifier,context,next){if(specifier==='@/lib/format')return{shortCircuit:true,url:pathToFileURL(path.join(root,'src/lib/format.js')).href};return next(specifier,context);}});
 const parser=await import(pathToFileURL(path.join(root,'src/lib/csv.js')));
 const parsed=parser.parseDelimited(parser.decodeCsvBuffer(await readFile(args['--csv'])),parser.detectDelimiter(parser.decodeCsvBuffer(await readFile(args['--csv']))));
 const catalog=parser.buildCatalog(parsed.rows,parser.autoMap(parsed.columns),{markDraft:false});
 const tuple=v=>[v.sku,...[1,2,3].flatMap(n=>[v[`option${n}_value`]?v[`option${n}_name`]||'':'',v[`option${n}_value`]||''])].join('\u0000');
 const details=[];
 for(const v of seed.ProductVariant){const p=seed.Product.find(p=>p.id===v.product_id);const matches=catalog.products.filter(c=>(p.source_id&&c.source_id===p.source_id)||(p.slug&&c.slug===p.slug)).flatMap(c=>c.variants.filter(cv=>tuple(cv)===tuple(v)));if(matches.length!==1){report.csv[matches.length?'ambiguous':'unmatched']++;continue;} report.csv.matched++;const c=matches[0];const changed=[];for(const f of ['weight_kg','height_cm','width_cm','length_cm'])if(!(Number(v[f])>0)&&Number(c[f])>0){v[f]=c[f];changed.push(f);}if(changed.length)report.csv.enriched++;details.push({variant_id:v.id,product_id:p.id,source_id:p.source_id,sku:v.sku,fields:changed});}
 await writeFile(path.join(privateDir,'dimension-matches.json'),JSON.stringify(details,null,2));
}
const signatures=b=>b[0]===255&&b[1]===216&&b[2]===255?'jpg':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'webp':/^GIF8[79]a/.test(b.toString('ascii',0,6))?'gif':b.toString('ascii',4,8)==='ftyp'&&/avif|avis/.test(b.toString('ascii',8,24))?'avif':null;
const requests=new Map();
function collect(value,key=''){if(Array.isArray(value)){for(const v of value)collect(v,key);}else if(value&&typeof value==='object'){for(const [k,v]of Object.entries(value))collect(v,k);}else if(typeof value==='string'){if(['url','image_url','logo_url'].includes(key)&&/^https?:\/\//.test(value))requests.set(value,null);for(const m of value.matchAll(/(?:src=["'])(https?:\/\/[^"']+)/gi))requests.set(m[1],null);}}
collect(seed);
const branding=args['--branding']?JSON.parse(await readFile(args['--branding'],'utf8')):{};
for(const url of Object.values(branding)){if(!/^https?:\/\//.test(url))throw new Error('Branding sources must be absolute public URLs');requests.set(url,null);}
let cache={};try{cache=JSON.parse(await readFile(path.join(privateDir,'media-provenance.json'),'utf8'));}catch{}
const queue=[...requests.keys()];let done=0;
async function download(url){
 if(cache[url]){try{const info=await stat(path.join('public',cache[url].local));if(info.size===cache[url].bytes){report.assets.push(cache[url]);return cache[url].local;}}catch{}}
 const candidates=[url];const original=new URL(url);if(original.pathname.includes('/files/mp/public/')&&original.origin!==new URL(origin).origin)candidates.push(new URL(original.pathname,origin).href);
 let error='';
 for(const candidate of candidates){try{const r=await fetch(candidate,{signal:AbortSignal.timeout(22000),headers:{accept:'image/*'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);if(!/^image\//i.test(r.headers.get('content-type')||''))throw new Error('non-image content type');if(Number(r.headers.get('content-length'))>15_000_000)throw new Error('image too large');const b=Buffer.from(await r.arrayBuffer());if(b.length>15_000_000)throw new Error('image too large');const ext=signatures(b);if(!ext)throw new Error('invalid image signature');const local=`/media/${createHash('sha256').update(b).digest('hex').slice(0,24)}.${ext}`;await writeFile(path.join('public',local),b);const item={source:url,retrieved_from:candidate,local,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};cache[url]=item;report.assets.push(item);return local;}catch(e){error=e.message;}}
 report.unresolved.push({source:url,error});return '';
}
await Promise.all(Array.from({length:6},async()=>{while(queue.length){const url=queue.shift();requests.set(url,await download(url));done++;if(done%50===0){console.log(`Images: ${done}/${requests.size}`);await writeFile(path.join(privateDir,'media-provenance.json'),JSON.stringify(cache,null,2));}}}));
function rewrite(value){if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)]));if(typeof value==='string'){if(requests.has(value))return requests.get(value);for(const [remote,local]of requests)if(value.includes(remote))value=value.replaceAll(remote,local);return value;}return value;}
const output=rewrite(seed);
report.products_with_failed_images=output.Product.filter(p=>(p.images||[]).some(i=>!i.url)).map(p=>({id:p.id,name:p.name,remaining_images:p.images.filter(i=>i.url).length}));
for(const p of output.Product)if(Array.isArray(p.images))p.images=p.images.filter(i=>i.url);
report.products_without_images=output.Product.filter(p=>!(p.images||[]).length).map(p=>p.id);
for(const [entity,rows] of Object.entries(output)){
 const ids=new Set();for(const row of rows){if(!row.id||ids.has(row.id))throw new Error(`${entity}: missing or duplicate ID`);ids.add(row.id);}
}
const publicIds=new Set(output.Product.map(p=>p.id));
if(output.ProductVariant.some(v=>!publicIds.has(v.product_id)))throw new Error('Orphan variant in export');
if(Object.values(output).flat().some(row=>Object.keys(row).some(k=>['cost','stock_order_ids','stock_release_ids','created_by','created_date','updated_date'].includes(k))))throw new Error('Private field in export');
for(const [filename,url]of Object.entries(branding)){const local=requests.get(url);if(local){await writeFile(path.join('public/media',path.basename(filename)),await readFile(path.join('public',local)));report.assets.push({alias:`/media/${path.basename(filename)}`,local,bytes:(await stat(path.join('public',local))).size});}}
for(const [k,v]of Object.entries(output))report.counts[k]=v.length;
report.csv.physical_missing_dimensions=output.ProductVariant.filter(v=>output.Product.find(p=>p.id===v.product_id)?.physical!==false&&!['weight_kg','height_cm','width_cm','length_cm'].every(k=>Number(v[k])>0)).map(v=>v.id);
report.total_bytes=report.assets.reduce((sum,a)=>sum+a.bytes,0);
await writeFile('server/data/catalog.json',JSON.stringify(output,null,2)+'\n');
await writeFile(path.join(privateDir,'media-provenance.json'),JSON.stringify(cache,null,2));
await writeFile(path.join(privateDir,'catalog-migration-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({counts:report.counts,csv:{...report.csv,physical_missing_dimensions:report.csv.physical_missing_dimensions.length},assets:report.assets.length,bytes:report.total_bytes,unresolved:report.unresolved.length}));
if(report.unresolved.length)process.exitCode=2;
