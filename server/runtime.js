import { AsyncLocalStorage } from 'node:async_hooks';
const requests=new WeakMap();const context=new AsyncLocalStorage();
export function bindRequest(req,value){requests.set(req,Object.freeze({...value}));return req;}
export function withRequestContext(req,value,callback){bindRequest(req,value);return context.run(requests.get(req),callback);}
export function createClientFromRequest(req){const value=requests.get(req);if(!value?.store)throw new Error('Unbound request');return {asServiceRole:{entities:value.store.entities},auth:{me:async()=>value.user??null}};}
export const secrets=Object.freeze({get(name){return context.getStore()?.env?.[name];}});
