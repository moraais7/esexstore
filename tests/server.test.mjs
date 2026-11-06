import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const database = await import('../server/database.js').catch(()=>({}));
const http = await import('../server/http.js').catch(()=>({}));
const runtime = await import('../server/runtime.js').catch(()=>({}));
const auth = await import('../server/auth.js').catch(()=>({}));
test('persistent store conditionally reserves inventory once and supports safe query operators',async()=>{
 assert.equal(typeof database.createStore,'function');
 const dir=await mkdtemp(path.join(tmpdir(),'store-')); const file=path.join(dir,'db.sqlite');
 let store=database.createStore(file);
 try { const v=await store.entities.ProductVariant.create({id:'v',stock:1,active:true});
 const result=await Promise.all([1,2].map(()=>store.entities.ProductVariant.updateMany({id:v.id,stock:{$gte:1},stock_order_ids:{$ne:'o'}},{$inc:{stock:-1},$addToSet:{stock_order_ids:'o'}})));
 assert.equal(result.reduce((n,r)=>n+r.modified_count,0),1);assert.equal(result.reduce((n,r)=>n+r.updated,0),1);assert.equal(result[0].has_more,false); store.close();store=database.createStore(file);
 assert.equal((await store.entities.ProductVariant.get('v')).stock,0);
 assert.equal(await store.entities.ProductVariant.count({stock_order_ids:'o'}),1);
 await assert.rejects(async()=>store.entities.ProductVariant.filter({$where:'evil'}));
 await assert.rejects(async()=>store.entities.ProductVariant.update('v',JSON.parse('{"__proto__":{"polluted":true}}')));
 } finally {store.close(); await rm(dir,{recursive:true,force:true});}
});
test('request runtime isolates environment across concurrent asynchronous handlers',async()=>{
 assert.equal(typeof runtime.withRequestContext,'function');
 const store={entities:{}}; const a=new Request('http://localhost');const b=new Request('http://localhost');
 const run=(req,key,ms)=>runtime.withRequestContext(req,{store,user:{id:key},env:{KEY:key}},async()=>{await new Promise(r=>setTimeout(r,ms));return [runtime.secrets.get('KEY'),(await runtime.createClientFromRequest(req).auth.me()).id]});
 assert.deepEqual(await Promise.all([run(a,'a',15),run(b,'b',1)]),[['a','a'],['b','b']]);
 assert.throws(()=>runtime.createClientFromRequest(new Request('http://localhost')));
});
test('HTTP protects private entities, sessions, CSRF, upload signatures and filesystem paths',async()=>{
 assert.equal(typeof http.createApplication,'function');
 const dir=await mkdtemp(path.join(tmpdir(),'http-store-'));await mkdir(path.join(dir,'dist'));await writeFile(path.join(dir,'dist/index.html'),'frontend');
 const app=http.createApplication({databasePath:path.join(dir,'db.sqlite'),publicUrl:'http://localhost',distDir:path.join(dir,'dist'),uploadsDir:path.join(dir,'uploads'),env:{},handlers:{echo:async req=>Response.json({key:runtime.secrets.get('KEY')})}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
 const request=(url,body,headers={})=>fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 try {
 await app.store.entities.Product.create({id:'visible',visible:true,status:'active',name:'Public',purchase_cost:99,stock_order_ids:['private']});
 await app.store.entities.Product.create({id:'hidden',visible:false,status:'active',name:'Hidden'});
 await app.store.entities.ProductVariant.create({id:'variant',product_id:'visible',active:true,stock:2,cost:30,stock_order_ids:['secret']});
 assert.equal((await request('/api/entities/Order/query',{})).status,403);
 let res=await request('/api/entities/Product/query',{});let data=await res.json();assert.equal(data.items.length,1);assert.equal(data.items[0].purchase_cost,undefined);
 assert.equal((await request('/api/entities/Product/hidden')).status,404);
 data=await (await request('/api/entities/ProductVariant/query',{})).json();assert.equal(data.items[0].cost,undefined);assert.equal(data.items[0].stock_order_ids,undefined);
 assert.equal((await request('/api/entities/Product',{name:'bad'})).status,401);
 await auth.bootstrapAdmin(app.store,'admin@example.com','strong-password-123');
 res=await request('/api/auth/login',{email:'admin@example.com',password:'strong-password-123'});assert.equal(res.status,200);const cookie=res.headers.get('set-cookie').split(';')[0];assert.match(res.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await request('/api/auth/me',undefined,{Cookie:cookie})).status,200);
 assert.equal((await request('/api/entities/Product',{name:'bad'},{Cookie:cookie,Origin:'https://attacker.invalid'})).status,403);
 assert.equal((await request('/api/entities/Product',{name:'new'},{Cookie:cookie,Origin:'http://localhost'})).status,201);
 assert.equal((await request('/api/auth/me',undefined,{Cookie:'store_session=invalid'})).status,401);
 const form=new FormData();form.append('file',new Blob(['<script>bad</script>'],{type:'image/png'}),'x.png');
 assert.equal((await fetch(base+'/api/upload',{method:'POST',body:form,headers:{Cookie:cookie,Origin:'http://localhost'}})).status,400);
 assert.equal((await fetch(base+'/uploads/%2e%2e/db.sqlite')).status,404);
 assert.equal((await request('/api/auth/logout',{}, {Cookie:cookie,Origin:'http://localhost'})).status,200);
 assert.equal((await request('/api/auth/me',undefined,{Cookie:cookie})).status,401);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
test('registration requires emailed OTP and reset tokens are single-use',async()=>{
 assert.equal(typeof auth.createAuth,'function');const store=database.createStore();let messages=[];
 const api=auth.createAuth(store,{PUBLIC_URL:'http://localhost',RESEND_API_KEY:'test',EMAIL_FROM:'Store <store@example.com>'},async(url,init)=>{messages.push(JSON.parse(init.body));return Response.json({id:'message'});});
 try {
 await api.register({email:'customer@example.com',password:'customer-password'});
 await assert.rejects(()=>api.login({email:'customer@example.com',password:'customer-password'}));
 const otp=messages.at(-1).text.match(/\b\d{6}\b/)[0];
 const verified=await api.verify({email:'customer@example.com',otpCode:otp,password:'customer-password'});assert.ok(verified.token);assert.equal(verified.user.email,'customer@example.com');
 const {token,user}=await api.login({email:'customer@example.com',password:'customer-password'});assert.equal(user.role,'customer');assert.ok(await api.currentUser(`store_session=${token}`));
 assert.equal(JSON.stringify(store.db.prepare('SELECT * FROM auth_sessions').all()).includes(token),false);
 await api.forgotPassword({email:'customer@example.com'});const reset=messages.at(-1).text.match(/resetToken=([a-zA-Z0-9_-]+)/)[1];
 await api.resetPassword({resetToken:reset,newPassword:'new-password-strong'});
 await assert.rejects(()=>api.resetPassword({resetToken:reset,newPassword:'another-password'}));
 assert.equal(await api.currentUser(`store_session=${token}`),null);
 assert.ok((await api.login({email:'customer@example.com',password:'new-password-strong'})).token);
 }finally{store.close();}
});
test('aggregates match dashboard contract and failed multi-record updates roll back completely',async()=>{
 const store=database.createStore();try{
 await store.entities.Order.create({id:'one',total:20,payment_status:'paid'});await store.entities.Order.create({id:'two',total:30,payment_status:'paid'});
 assert.deepEqual((await store.entities.Order.aggregate({query:{payment_status:'paid'},sum:['total']})).rows,[{sum_total:50}]);
 await store.entities.ProductVariant.create({id:'one',stock:2});await store.entities.ProductVariant.create({id:'two',stock:'invalid'});
 await assert.rejects(()=>store.entities.ProductVariant.updateMany({},{$inc:{stock:1}}));assert.equal((await store.entities.ProductVariant.get('one')).stock,2);
 }finally{store.close();}
});
test('email uses shared ORDER_EMAIL_FROM configuration',async()=>{
 const store=database.createStore();let message;
 const api=auth.createAuth(store,{RESEND_API_KEY:'test',ORDER_EMAIL_FROM:'store@example.com'},async(url,init)=>{message=JSON.parse(init.body);return Response.json({id:'sent'});});
 try{await api.register({email:'user@example.com',password:'long-password-123'});assert.equal(message.from,'store@example.com');}finally{store.close();}
});
test('catalog importer batches are atomic and preserve stable identifiers',async()=>{
 const store=database.createStore();try{
 assert.equal(typeof store.entities.ProductVariant.bulkCreate,'function');assert.equal(typeof store.entities.ProductVariant.bulkUpdate,'function');
 await store.entities.ProductVariant.bulkCreate([{id:'a',sku:'a',stock:1},{id:'b',sku:'b',stock:2}]);
 await store.entities.ProductVariant.bulkUpdate([{id:'a',stock:3},{id:'b',stock:4}]);assert.equal((await store.entities.ProductVariant.get('a')).stock,3);
 await assert.rejects(()=>store.entities.ProductVariant.bulkCreate([{id:'c',stock:1},{id:'a',stock:2}]));assert.equal(await store.entities.ProductVariant.get('c'),null);
 await assert.rejects(()=>store.entities.ProductVariant.bulkUpdate([{id:'a',stock:10},{id:'missing',stock:1}]));assert.equal((await store.entities.ProductVariant.get('a')).stock,3);
 }finally{store.close();}
});
test('HTTP verifies email into a persistent session, preserves raw function bodies and accepts only raster uploads',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'http-security-'));const databasePath=path.join(dir,'db.sqlite');
 const make=()=>http.createApplication({databasePath,publicUrl:'https://store.example',uploadsDir:path.join(dir,'uploads'),env:{KEY:'request-only'},handlers:{raw:async req=>Response.json({body:await req.text(),secret:runtime.secrets.get('KEY'),user:await runtime.createClientFromRequest(req).auth.me()})}});
 let app=make();const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${app.server.address().port}`;};let base=await start();
 try{
 let email;const api=auth.createAuth(app.store,{RESEND_API_KEY:'test',ORDER_EMAIL_FROM:'store@example.com'},async(url,init)=>{email=JSON.parse(init.body).text;return Response.json({id:'ok'});});
 await api.register({email:'person@example.com',password:'long-password-123'});const code=email.match(/\b\d{6}\b/)[0];
 const verified=await fetch(base+'/api/auth/verify',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://store.example'},body:JSON.stringify({email:'person@example.com',otpCode:code,password:'long-password-123'})});assert.equal(verified.status,200);const cookie=verified.headers.get('set-cookie');assert.match(cookie,/Secure/);assert.equal((await verified.json()).email,'person@example.com');
 const customerCookie=cookie.split(';')[0];
 assert.equal((await fetch(base+'/api/entities/Product',{method:'POST',headers:{Cookie:customerCookie,Origin:'https://store.example','Content-Type':'application/json'},body:'{}'})).status,403);
 const raw=' { "amount": 1 }\n';const rawResponse=await fetch(base+'/api/functions/raw',{method:'POST',body:raw,headers:{Origin:'https://store.example'}});assert.deepEqual(await rawResponse.json(),{body:raw,secret:'request-only',user:null});
 await app.close();app=make();base=await start();assert.equal((await fetch(base+'/api/auth/me',{headers:{Cookie:customerCookie}})).status,200);
 auth.bootstrapAdmin(app.store,'admin@example.com','admin-password-123');const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://store.example'},body:JSON.stringify({email:'admin@example.com',password:'admin-password-123'})});const adminCookie=login.headers.get('set-cookie').split(';')[0];
 const form=new FormData();const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64');form.append('file',new Blob([png],{type:'image/png'}),'image.png');const upload=await fetch(base+'/api/uploads',{method:'POST',headers:{Cookie:adminCookie,Origin:'https://store.example'},body:form});assert.equal(upload.status,200);const {file_url}=await upload.json();const image=await fetch(base+file_url);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 for(let i=0;i<32;i++){const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:'https://store.example','Content-Type':'application/json'},body:JSON.stringify({email:'none@example.com',password:'incorrect'})});if(i===31)assert.equal(response.status,429);}
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

test('email owner chooses the final password despite registrations before or after their own',async()=>{
 const store=database.createStore();const messages=[];
 const api=auth.createAuth(store,{RESEND_API_KEY:'test',ORDER_EMAIL_FROM:'store@example.com'},async(url,init)=>{messages.push(JSON.parse(init.body));return Response.json({id:'ok'});});
 try {
 for(const position of ['before','after']){
 const email=`owner-${position}@example.com`;
 if(position==='before')await api.register({email,password:'attacker-password'});
 await api.register({email,password:'owner-password-123'});
 if(position==='after')await api.register({email,password:'attacker-password'});
 const otpCode=messages.at(-1).text.match(/\b\d{6}\b/)[0];
 await assert.rejects(()=>api.verify({email,otpCode}));
 await assert.rejects(()=>api.verify({email,otpCode,password:'short'}));
 await assert.rejects(()=>api.verify({email,otpCode:'000000',password:'owner-password-123'}));
 await assert.rejects(()=>api.verify({email:'different@example.com',otpCode,password:'owner-password-123'}));
 await api.verify({email,otpCode,password:'owner-password-123'});
 await assert.rejects(()=>api.login({email,password:'attacker-password'}));
 assert.ok((await api.login({email,password:'owner-password-123'})).token);
 await assert.rejects(()=>api.verify({email,otpCode,password:'attacker-password'}));
 await api.register({email,password:'attacker-password'});
 await assert.rejects(()=>api.verify({email,otpCode,password:'attacker-password'}));
 assert.ok((await api.login({email,password:'owner-password-123'})).token);
 }
 }finally{store.close();}
});

test('SQLite pagination advertises every page through has_more',async()=>{
 const store=database.createStore();try{
 for(let i=0;i<53;i++)await store.entities.Product.create({id:`product-${i}`,visible:true,status:'active'});
 const ids=[];let cursor;let page;
 do{page=await store.entities.Product.filter({visible:true},{limit:24,cursor});assert.equal(page.has_more,Boolean(page.next_cursor));ids.push(...page.items.map(row=>row.id));cursor=page.next_cursor;}while(page.has_more);
 assert.equal(page.has_more,false);assert.equal(ids.length,53);assert.equal(new Set(ids).size,53);
 }finally{store.close();}
});

test('HTTP proxy trust isolates clients, rejects spoofed identities and separates webhook traffic',async()=>{
 for(const trusted of [true,false]){
 const app=http.createApplication({env:{TRUSTED_PROXY_IPS:trusted?'127.0.0.1':''},handlers:{stripeWebhook:async req=>new Response('signed-webhook',{status:req.headers.get('stripe-signature')==='test-signature'?200:400})}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
 const login=ip=>fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':ip},body:JSON.stringify({email:'nobody@example.com',password:'invalid-password'})});
 try{
 for(let i=0;i<30;i++)assert.equal((await login(trusted?'198.51.100.1':`198.51.100.${i+1}`)).status,401);
 assert.equal((await login('198.51.100.1')).status,429);
 assert.equal((await login('198.51.100.2')).status,trusted?401:429);
 if(trusted){
 // The nearest untrusted hop wins; the leftmost address cannot reset its limit.
 assert.equal((await login('203.0.113.1, 198.51.100.1')).status,429);
 assert.equal((await login('198.51.100.3, 127.0.0.1')).status,401);
 // IPv4-mapped addresses identify the same client, not a second bucket.
 assert.equal((await login('::ffff:198.51.100.1')).status,429);
 for(let i=0;i<601;i++)await fetch(base+'/api/missing',{headers:{'X-Forwarded-For':'198.51.100.4'}});
 assert.equal((await fetch(base+'/api/missing',{headers:{'X-Forwarded-For':'198.51.100.4'}})).status,429);
 const webhook=await fetch(base+'/api/functions/stripeWebhook',{method:'POST',headers:{'X-Forwarded-For':'198.51.100.4','stripe-signature':'test-signature'},body:'raw signed payload'});assert.equal(webhook.status,200);
 assert.equal((await fetch(base+'/api/functions/stripeWebhook',{method:'POST',headers:{'X-Forwarded-For':'198.51.100.4'},body:'invalid'})).status,400);
 }
 }finally{await app.close();}
 }
});


test('HTTP catalog pagination exposes all visible products and excludes hidden rows',async()=>{
 const app=http.createApplication();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
 try{
 await app.store.entities.Product.bulkCreate(Array.from({length:53},(_,i)=>({id:`public-${i}`,name:`Product ${i}`,visible:true,status:'active'})));
 await app.store.entities.Product.create({id:'hidden-product',visible:false,status:'active'});
 const ids=[];let cursor;let page;
 do{const response=await fetch(base+'/api/entities/Product/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:{},options:{limit:24,cursor}})});assert.equal(response.status,200);page=await response.json();assert.equal(page.has_more,Boolean(page.next_cursor));ids.push(...page.items.map(row=>row.id));cursor=page.next_cursor;}while(page.has_more);
 assert.equal(page.has_more,false);assert.equal(new Set(ids).size,53);assert.equal(ids.includes('hidden-product'),false);
 }finally{await app.close();}
});
