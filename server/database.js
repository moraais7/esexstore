import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export const ENTITY_NAMES = ['Product','ProductVariant','Category','ContentPage','Redirect','SiteSettings','Order','ShippingQuote','ImportBatch'];
const forbidden=new Set(['__proto__','prototype','constructor']);
export function validateData(value,depth=0){
 if(depth>24)throw new Error('Data too deeply nested');
 if(value && typeof value==='object')for(const [key,item] of Object.entries(value)) {if(forbidden.has(key)||key.includes('\0'))throw new Error('Unsafe key');validateData(item,depth+1);}
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const contains=(a,b)=>Array.isArray(a)?a.some(x=>equal(x,b)):equal(a,b);
const operators=new Set(['$eq','$ne','$in','$nin','$gt','$gte','$lt','$lte','$exists','$regex','$options']);
function checkQuery(query,depth=0){
 validateData(query);if(!query||Array.isArray(query)||typeof query!=='object'||depth>12)throw new Error('Invalid query');
 for(const [key,value] of Object.entries(query)){
  if(key==='$or'||key==='$and'){if(!Array.isArray(value)||value.length>100)throw new Error('Invalid logical query');value.forEach(q=>checkQuery(q,depth+1));continue;}
  if(key.startsWith('$')||key.includes('.'))throw new Error('Unsupported query key');
  if(value&&typeof value==='object'&&!Array.isArray(value))for(const [op,operand]of Object.entries(value)){
   if(!operators.has(op))throw new Error('Unsupported operator');
   if((op==='$in'||op==='$nin')&&(!Array.isArray(operand)||operand.length>2000))throw new Error('Invalid membership');
   // Search is deliberately literal: no arbitrary user-supplied regular expressions.
   if(op==='$regex'&&(typeof operand!=='string'||operand.length>120))throw new Error('Invalid search');
   if(op==='$options'&&!['','i'].includes(operand))throw new Error('Invalid search options');
  }
 }
}
function matches(row,query){return Object.entries(query).every(([key,wanted])=>{
 if(key==='$or')return wanted.some(q=>matches(row,q));if(key==='$and')return wanted.every(q=>matches(row,q));
 const actual=row[key];if(!wanted||typeof wanted!=='object'||Array.isArray(wanted))return contains(actual,wanted);
 return Object.entries(wanted).every(([op,v])=>{switch(op){case '$eq':return contains(actual,v);case '$ne':return !contains(actual,v);case '$in':return v.some(x=>contains(actual,x));case '$nin':return !v.some(x=>contains(actual,x));case '$gt':return actual>v;case '$gte':return actual>=v;case '$lt':return actual<v;case '$lte':return actual<=v;case '$exists':return (actual!==undefined)===Boolean(v);case '$options':return true;case '$regex':return String(actual??'').toLowerCase().includes(v.toLowerCase());default:return false;}});
});}
function patchRow(row,patch){
 validateData(patch);const result={...row};
 if(Object.keys(patch).some(k=>k.startsWith('$'))){
 for(const[op,fields]of Object.entries(patch)){
 if(!['$set','$unset','$inc','$addToSet','$pull'].includes(op)||!fields||Array.isArray(fields)||typeof fields!=='object')throw new Error('Unsupported update');
 for(const[key,value]of Object.entries(fields)){
 if(key.startsWith('$')||key.includes('.')||['id','created_date'].includes(key))throw new Error('Invalid update field');
 if(op==='$set')result[key]=value;
 if(op==='$unset')delete result[key];
 if(op==='$inc'){if(typeof value!=='number'||!Number.isFinite(value)||typeof(result[key]??0)!=='number')throw new Error('Invalid increment');result[key]=(result[key]??0)+value;}
 if(op==='$addToSet'){const values=result[key]??[];if(!Array.isArray(values))throw new Error('Invalid array');result[key]=values.some(v=>equal(v,value))?values:[...values,value];}
 if(op==='$pull'){if(!Array.isArray(result[key]??[]))throw new Error('Invalid array');result[key]=(result[key]??[]).filter(v=>!equal(v,value));}
 }
 }
 }else {for(const key of Object.keys(patch))if(key.startsWith('$')||key.includes('.'))throw new Error('Invalid field');Object.assign(result,patch);}
 result.id=row.id;result.created_date=row.created_date;result.updated_date=new Date().toISOString();return result;
}
export function createStore(databasePath=':memory:'){
 if(databasePath!==':memory:')mkdirSync(dirname(databasePath),{recursive:true});
 const db=new DatabaseSync(databasePath);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records(entity TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(entity,id));');
 const read=db.prepare('SELECT data FROM records WHERE entity=? ORDER BY rowid');const put=db.prepare('UPDATE records SET data=? WHERE entity=? AND id=?');
 const entities={};
 for(const entity of ENTITY_NAMES){
 const rows=()=>read.all(entity).map(r=>JSON.parse(r.data));
 const insert=data=>{validateData(data);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid record');const now=new Date().toISOString();const row={...data,id:data.id||randomUUID(),created_date:data.created_date||now,updated_date:now};if(typeof row.id!=='string'||row.id.length>200)throw new Error('Invalid id');db.prepare('INSERT INTO records(entity,id,data)VALUES(?,?,?)').run(entity,row.id,JSON.stringify(row));return row;};
 const selected=query=>{checkQuery(query);return rows().filter(r=>matches(r,query));};
 const transactional=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
 entities[entity]={
 async create(data){return insert(data);},
 async bulkCreate(records){if(!Array.isArray(records)||records.length>2000)throw new Error('Invalid batch');return transactional(()=>records.map(insert));},
 async bulkUpdate(records){if(!Array.isArray(records)||records.length>2000)throw new Error('Invalid batch');return transactional(()=>records.map(data=>{validateData(data);const row=rows().find(r=>r.id===data.id);if(!row)throw new Error('Record not found');const next=patchRow(row,data);put.run(JSON.stringify(next),entity,row.id);return next;}));},
 async get(id){const r=db.prepare('SELECT data FROM records WHERE entity=? AND id=?').get(entity,id);return r?JSON.parse(r.data):null;},
 async filter(query={},options={}){let items=selected(query);const sort=options.sort; if(sort){const field=typeof sort==='string'?sort.replace(/^-/,''):Object.keys(sort)[0];const direction=typeof sort==='string'?(sort.startsWith('-')?-1:1):(sort[field]<0?-1:1);items.sort((a,b)=>(a[field]>b[field]?1:a[field]<b[field]?-1:0)*direction);}
 const offset=Number(options.cursor||0);if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Invalid cursor');const limit=Math.max(1,Math.min(5000,Number(options.limit)||100));const next_cursor=offset+limit<items.length?String(offset+limit):null;return {items:items.slice(offset,offset+limit),next_cursor,has_more:Boolean(next_cursor)};},
 async list(options={}){return this.filter({},options);},async count(query={}){return selected(query).length;},
 async aggregate({query={},sum=[]}={}){const items=selected(query),out={count:items.length};if(!Array.isArray(sum)||sum.length>30)throw new Error('Invalid aggregate');for(const key of sum){if(typeof key!=='string'||forbidden.has(key))throw new Error('Invalid aggregate');out[key]=items.reduce((n,r)=>n+(Number(r[key])||0),0);}out.rows=[Object.fromEntries(sum.map(key=>[`sum_${key}`,out[key]]))];return out;},
 async update(id,data){return transactional(()=>{const row=rows().find(r=>r.id===id);if(!row)return null;const next=patchRow(row,data);put.run(JSON.stringify(next),entity,id);return next;});},
 async updateMany(query,patch){return transactional(()=>{const items=selected(query);let modified=0;for(const row of items){const next=patchRow(row,patch);put.run(JSON.stringify(next),entity,row.id);modified++;}return {updated:modified,has_more:false,matched_count:items.length,modified_count:modified,matchedCount:items.length,modifiedCount:modified};});},
 async delete(id){const result=db.prepare('DELETE FROM records WHERE entity=? AND id=?').run(entity,id);return {deleted_count:result.changes};},
 async deleteMany(query={}){return transactional(()=>{const items=selected(query);for(const row of items)db.prepare('DELETE FROM records WHERE entity=? AND id=?').run(entity,row.id);return {deleted_count:items.length};});}
 };
 }
 return {entities,db,close:()=>db.close()};
}
