import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/format') return { shortCircuit: true, url: new URL('../src/lib/format.js', import.meta.url).href };
    return next(specifier, context);
  },
});
