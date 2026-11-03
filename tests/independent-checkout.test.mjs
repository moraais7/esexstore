import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createApplication } from '../server/http.js';
import quoteShipping from '../server/functions/quoteShipping/entry.ts';
import createCheckout from '../server/functions/createCheckout/entry.ts';
import stripeWebhook from '../server/functions/stripeWebhook/entry.ts';

const publicUrl = 'https://store.example';
const customer = { name: 'Cliente Teste', email: 'test@example.com', phone: '31999999999' };
const shipping_address = { postal_code: '32241340', street: 'Rua Teste', number: '1', district: 'Centro', city: 'Contagem', state: 'MG' };
async function application(t, stock = 5) {
  const realFetch = globalThis.fetch;
  const providerCalls = [];
  let sessions = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.stripe.com/')) {
      providerCalls.push({ url, options });
      if (String(url).endsWith('/expire')) return Response.json({ status: 'expired' });
      sessions++;
      return Response.json({ id: `cs_test_${sessions}`, url: `https://checkout.stripe.com/c/pay/${sessions}` });
    }
    if (String(url) === 'https://api.resend.com/emails') { providerCalls.push({ url, options }); return Response.json({ id: 'email1' }); }
    return realFetch(url, options);
  };
  const app = createApplication({ publicUrl, env: { STORE_PUBLIC_URL: publicUrl, STORE_ID: 'test-store', STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture', RESEND_API_KEY: 'fixture', ORDER_EMAIL_FROM: 'Store <orders@example.com>' }, handlers: { quoteShipping, createCheckout, stripeWebhook } });
  await app.store.entities.Product.create({ id: 'p1', name: 'Produto', slug: 'produto', status: 'active', visible: true });
  await app.store.entities.ProductVariant.create({ id: 'v1', product_id: 'p1', active: true, price: 25, stock, weight_kg: .2, height_cm: 5, width_cm: 10, length_cm: 16 });
  await app.store.entities.SiteSettings.create({ key: 'main', shipping_configured: true, payments_configured: true, shipping_provider: 'fixed', shipping_fixed_price: 12.34, shipping_fixed_days: 5 });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { globalThis.fetch = realFetch; await app.close(); });
  const post = async (name, body) => realFetch(`${endpoint}/api/functions/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: publicUrl }, body: JSON.stringify(body) });
  const quote = async () => {
    const response = await post('quoteShipping', { items: [{ variant_id: 'v1', quantity: 1 }], postal_code: '32241340' });
    assert.equal(response.status, 200);
    const data = await response.json();
    return { customer, shipping_address, items: [{ variant_id: 'v1', quantity: 1 }], shipping_quote_token: data.token, shipping_option_id: 'fixed' };
  };
  return { app, realFetch, endpoint, providerCalls, post, quote };
}

test('independent HTTP checkout with real SQLite validates totals, reserves once and confirms a signed payment', async t => {
  const { app, realFetch, endpoint, providerCalls, post, quote } = await application(t);
  const body = await quote();
  const started = await post('createCheckout', { ...body, total: .01 });
  assert.equal(started.status, 200, await started.clone().text());
  const result = await started.json();
  const order = await app.store.entities.Order.get(result.order_id);
  assert.equal(order.total, 37.34);
  assert.equal((await app.store.entities.ProductVariant.get('v1')).stock, 4);
  assert.equal((await post('createCheckout', body)).status, 200);
  assert.equal(await app.store.entities.Order.count({}), 1);
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: order.payment_reference, payment_status: 'paid', amount_total: 3734, currency: 'brl', payment_intent: 'pi_test', metadata: { store_id: 'test-store', order_id: order.id } } } });
  const signature = createHmac('sha256', 'whsec_fixture').update(`${timestamp}.${payload}`).digest('hex');
  const notify = () => realFetch(`${endpoint}/api/functions/stripeWebhook`, { method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` }, body: payload });
  assert.equal((await notify()).status, 200);
  assert.equal((await notify()).status, 200);
  assert.equal((await app.store.entities.Order.get(order.id)).payment_status, 'paid');
  assert.equal((await app.store.entities.ProductVariant.get('v1')).stock, 4);
  assert.equal(providerCalls.filter(call => call.url === 'https://api.resend.com/emails').length, 1);
});

test('independent SQLite checkouts competing for the last unit only release one payment URL', async t => {
  const { app, post, quote } = await application(t, 1);
  const bodies = await Promise.all([quote(), quote()]);
  const responses = await Promise.all(bodies.map(body => post('createCheckout', body)));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal((await app.store.entities.ProductVariant.get('v1')).stock, 0);
  assert.equal(await app.store.entities.Order.count({ stock_committed: true }), 1);
});
