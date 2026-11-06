import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { store } from '../src/api/storeClient.js';

test('HTTP client preserves entity, function, auth and upload contracts using cookie credentials', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    return new Response(JSON.stringify(url.endsWith('/count') ? 3 : url.includes('/functions/') ? { ok: true } : { items: [], next_cursor: null }), { status: 200 });
  };
  try {
    assert.deepEqual(await store.entities.Product.filter({ visible: true }, { limit: 2, cursor: 'next' }), { items: [], next_cursor: null });
    assert.equal(await store.entities.Product.count({ active: true }), 3);
    await store.entities.Order.aggregate({ query: { payment_status: 'paid' }, sum: ['total'] });
    await store.entities.Product.get('id/with space');
    await store.entities.Product.create({ name: 'Produto' });
    await store.entities.Product.update('one', { visible: true });
    await store.entities.Product.delete('one');
    await store.entities.Product.deleteMany({ id: { $in: ['one'] } });
    assert.deepEqual(await store.functions.invoke('quoteShipping', { postal_code: '32241340' }), { data: { ok: true } });
    await store.auth.me();
    await store.auth.loginViaEmailPassword('a@example.com', 'secret');
    await store.auth.register({ email: 'a@example.com', password: 'secret' });
    await store.auth.verifyOtp({ email: 'a@example.com', otpCode: '123456', password: 'owner-password-123' });
    await store.auth.resendOtp('a@example.com');
    await store.auth.resetPasswordRequest('a@example.com');
    await store.auth.resetPassword({ resetToken: 'abc', newPassword: 'newpassword' });
    await store.auth.logout();
    await store.integrations.Core.UploadPublicFile({ file: new Blob(['image'], { type: 'image/png' }) });
    assert.ok(calls.every(call => call.url.startsWith('/api/') && call.credentials === 'same-origin'));
    assert.deepEqual(JSON.parse(calls[0].body), { query: { visible: true }, options: { limit: 2, cursor: 'next' } });
    assert.equal(calls[3].url, '/api/entities/Product/id%2Fwith%20space');
    assert.equal(calls[5].method, 'PATCH');
    assert.equal(calls[6].method, 'DELETE');
    assert.deepEqual(JSON.parse(calls[2].body), { query: { payment_status: 'paid' }, sum: ['total'] });
    assert.deepEqual(calls.slice(9, 17).map(call => call.url), ['/api/auth/me', '/api/auth/login', '/api/auth/register', '/api/auth/verify', '/api/auth/resend', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/logout']);
    assert.deepEqual(JSON.parse(calls[12].body), { email: 'a@example.com', otpCode: '123456', password: 'owner-password-123' });
    assert.equal(calls[17].url, '/api/uploads');
    assert.ok(calls[17].body instanceof FormData);
    assert.equal(calls[17].headers?.['Content-Type'], undefined);
  } finally { globalThis.fetch = original; }
});

test('HTTP errors expose status and backend data for checkout and auth consumers', async () => {
  const original = globalThis.fetch;
  try {
    const data = { error: 'Entrega indisponível', code: 'shipping_disabled' };
    globalThis.fetch = async () => new Response(JSON.stringify(data), { status: 409 });
    await assert.rejects(store.functions.invoke('createCheckout', {}), error => error.status === 409 && error.message === data.error && error.response.data.code === data.code);
    globalThis.fetch = async () => new Response('Upstream unavailable', { status: 503 });
    await assert.rejects(store.auth.me(), error => error.status === 503 && Boolean(error.response.data.error));
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await store.entities.Product.delete('one'), null);
  } finally { globalThis.fetch = original; }
});

test('frontend runtime has no former SDK, token persistence or unsupported OAuth controls', async () => {
  async function files(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : `${dir}/${entry.name}`))).flat();
  }
  for (const path of await files(new URL('../src', import.meta.url).pathname)) {
    if (!/\.(jsx?|tsx?)$/.test(path)) continue;
    const source = await readFile(path, 'utf8');
    assert.doesNotMatch(source, /base44|loginWithProvider|setToken\(/i, path);
  }
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /isLoadingPublicSettings|UserNotRegisteredError/);
  assert.match(app, /path="\/checkout" element={<Checkout \/>}/);
  const auth = await readFile(new URL('../src/lib/AuthContext.jsx', import.meta.url), 'utf8');
  assert.match(auth, /store\.auth\.me\(\)/);
  assert.doesNotMatch(auth, /appParams|localStorage/);
});

test('password reset links and verification follow the independent auth contract', async () => {
  const reset = await readFile(new URL('../src/pages/ResetPassword.jsx', import.meta.url), 'utf8');
  assert.match(reset, /searchParams\.get\("resetToken"\)/);
  const register = await readFile(new URL('../src/pages/Register.jsx', import.meta.url), 'utf8');
  assert.match(register, /await store\.auth\.verifyOtp\(\{ email, otpCode, password \}\)/);
  assert.match(register, /window\.location\.href = safeReturnTo\(\)/);
});
