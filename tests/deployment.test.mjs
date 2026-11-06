import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentEnvironment } from '../server/config.js';
import { createApplication } from '../server/http.js';

test('deployment propagates the external HTTPS URL into payment and auth configuration', () => {
  const env = deploymentEnvironment({ NODE_ENV: 'production', RENDER_EXTERNAL_URL: 'https://esex-test.onrender.com', STORE_ID: 'esex' });
  assert.equal(env.STORE_PUBLIC_URL, 'https://esex-test.onrender.com');
  assert.equal(env.STORE_ID, 'esex');
  assert.equal(deploymentEnvironment({ NODE_ENV: 'production', STORE_PUBLIC_URL: 'https://store.example/', RENDER_EXTERNAL_URL: 'https://old.example' }).STORE_PUBLIC_URL, 'https://store.example');
  assert.equal(deploymentEnvironment({ PORT: '3001' }).STORE_PUBLIC_URL, 'http://localhost:3001');
  for (const value of ['', 'http://store.example', 'https://user:secret@store.example', 'not-a-url']) {
    assert.throws(() => deploymentEnvironment({ NODE_ENV: 'production', STORE_PUBLIC_URL: value }));
  }
});

test('health endpoint verifies the database without disclosing configuration or records', async t => {
  const app = createApplication({ env: { STRIPE_SECRET_KEY: 'not-public' } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const url = `http://127.0.0.1:${app.server.address().port}/api/health`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(url, { method: 'HEAD' })).status, 200);
  const prepare = app.store.db.prepare;
  app.store.db.prepare = () => { throw new Error('database unavailable'); };
  try {
    const unavailable = await fetch(url);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { status: 'unavailable' });
  } finally { app.store.db.prepare = prepare; }
});

test('explicit single ingress hop prevents spoofed left-hand IPs from resetting rate limits', async t => {
  const app = createApplication({ publicUrl: 'http://localhost', env: { TRUSTED_PROXY_HOPS: '1' } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const url = `http://127.0.0.1:${app.server.address().port}/api/auth/login`;
  const request = forwarded => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'X-Forwarded-For': forwarded }, body: JSON.stringify({ email: 'nobody@example.com', password: 'incorrect-password' }) });
  for (let i = 1; i <= 30; i++) assert.equal((await request(`198.51.100.${i}, 203.0.113.20`)).status, 401);
  assert.equal((await request('198.51.100.99, 203.0.113.20')).status, 429);
  assert.equal((await request('203.0.113.21')).status, 401);
});
