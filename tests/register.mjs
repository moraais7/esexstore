import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/format') return { shortCircuit: true, url: new URL('../src/lib/format.js', import.meta.url).href };
    if (specifier.startsWith('npm:@base44/sdk@')) return { shortCircuit: true, url: 'data:text/javascript,export const createClientFromRequest = req => globalThis.__checkoutClient(req);' };
    if (specifier === 'base44:runtime') return { shortCircuit: true, url: 'data:text/javascript,export const secrets = {get: name => globalThis.__checkoutSecrets[name]};' };
    return next(specifier, context);
  },
});
