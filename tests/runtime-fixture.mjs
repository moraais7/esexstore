import { withRequestContext } from '../server/runtime.js';
export const withFixtureContext = handler => async req => {
  const client = globalThis.__checkoutClient(req);
  const user = await client.auth.me().catch(() => null);
  return withRequestContext(req, { store: { entities: client.asServiceRole.entities }, user, env: globalThis.__checkoutSecrets || {} }, () => handler(req));
};
