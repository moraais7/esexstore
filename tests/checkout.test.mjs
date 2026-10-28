import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import quoteShipping from '../base44/functions/quoteShipping/entry.ts';
import createCheckout from '../base44/functions/createCheckout/entry.ts';
import stripeWebhook from '../base44/functions/stripeWebhook/entry.ts';
import cancelCheckout from '../base44/functions/cancelCheckout/entry.ts';
import manageOrder from '../base44/functions/manageOrder/entry.ts';
import relinkVariants from '../base44/functions/relinkVariants/entry.ts';
import { normalizeItems } from '../base44/shared/cart.ts';
import { shippingOptions } from '../base44/shared/shipping.ts';
import { reserveOrderStock, expireOrder, confirmOrderPayment } from '../base44/shared/orders.ts';
import { sendPaymentEmail } from '../base44/shared/email.ts';

const clone = value => structuredClone(value);
const matches = (record, query) => Object.entries(query).every(([key, expected]) => {
  const value = record[key];
  if (expected && typeof expected === 'object') return Object.entries(expected).every(([op, target]) => {
    if (op === '$in') return target.includes(value);
    if (op === '$ne') return Array.isArray(value) ? !value.includes(target) : value !== target;
    if (op === '$gte') return value >= target;
    if (op === '$lte') return value <= target;
    throw new Error(`Unsupported operator ${op}`);
  });
  return Array.isArray(value) ? value.includes(expected) : value === expected;
});
function fixture({ stock = 5 } = {}) {
  const db = { Product: [{ id: 'p1', name: 'Produto', slug: 'produto', source_id: 'original-p1', visible: true, status: 'active', total_stock: stock }], ProductVariant: [{ id: 'v1', product_id: 'p1', sku: 'SKU1', price: 19.99, stock, active: true, weight_kg: .2, height_cm: 5, width_cm: 10, length_cm: 16 }], SiteSettings: [{ id: 'settings', key: 'main', payments_configured: true, shipping_configured: true, shipping_provider: 'fixed', shipping_fixed_price: 12.34, shipping_fixed_days: 5, shipping_sandbox: false }], ShippingQuote: [], Order: [] };
  const entities = Object.fromEntries(Object.entries(db).map(([name, records]) => [name, {
    async get(id) { const record = records.find(r => r.id === id); if (!record) throw Object.assign(new Error('not found'), { status: 404 }); return clone(record); },
    async filter(query = {}, options = {}) { const result = records.filter(r => matches(r, query)); const offset = Number(options.cursor || 0); const end = offset + (options.limit || 200); return { items: clone(result.slice(offset, end)), next_cursor: end < result.length ? String(end) : null }; },
    async list(options) { return this.filter({}, options); },
    async create(data) { const record = { id: `${name}-${records.length + 1}`, ...clone(data) }; records.push(record); return clone(record); },
    async update(id, data) { const r = records.find(r => r.id === id); assert.ok(r); Object.assign(r, clone(data)); return clone(r); },
    async updateMany(query, ops) {
      let updated = 0;
      for (const r of records) {
        if (!matches(r, query)) continue;
        for (const [op, data] of Object.entries(ops)) for (const [key, value] of Object.entries(data)) {
          if (op === '$set') r[key] = clone(value);
          else if (op === '$inc') r[key] = (r[key] || 0) + value;
          else if (op === '$addToSet') r[key] = [...new Set([...(r[key] || []), value])];
          else if (op === '$pull') r[key] = (r[key] || []).filter(v => v !== value);
          else throw new Error(`Unsupported update ${op}`);
        }
        updated++;
      }
      return { updated, has_more: false };
    },
  }]));
  const client = { asServiceRole: { entities }, auth: { me: async () => ({ role: 'admin', email: 'admin@example.com' }) } };
  globalThis.__checkoutClient = () => client;
  globalThis.__checkoutSecrets = { STRIPE_SECRET_KEY: 'sk_test_mock', STRIPE_WEBHOOK_SECRET: 'whsec_mock', BASE44_APP_ID: 'app1', STORE_PUBLIC_URL: 'https://store.example.com' };
  return { db, client, entities };
}
const post = body => new Request('https://store.example.com/functions/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const customer = { name: 'Cliente Teste', email: 'cliente@example.com', phone: '31999999999' };
const shipping_address = { postal_code: '32000-000', street: 'Rua Teste', number: '10', district: 'Centro', city: 'Contagem', state: 'MG' };
async function quoted(quantity = 2) {
  const response = await quoteShipping(post({ items: [{ variant_id: 'v1', quantity }], postal_code: shipping_address.postal_code }));
  assert.equal(response.status, 200);
  const quote = await response.json();
  return { items: [{ variant_id: 'v1', quantity }], customer, shipping_address, shipping_quote_token: quote.token, shipping_option_id: 'fixed', shipping_total: 0, total: .01 };
}
function mockStripe() {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: 'cs_test_123', url: 'https://checkout.stripe.com/test' });
  };
  return calls;
}
async function signed(event, secret = 'whsec_mock', age = 0) {
  const raw = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000) - age;
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return stripeWebhook(new Request('https://store.example.com/functions/stripeWebhook', { method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` }, body: raw }));
}
const paidEvent = order => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_123', payment_status: 'paid', amount_total: 5232, currency: 'brl', payment_intent: 'pi_123', metadata: { order_id: order.id, base44_app_id: 'app1' } } } });

test('invalid or duplicate quantities cannot bypass item limits', () => {
  for (const quantity of [0, -1, 1.5, 11, '2', NaN, Infinity]) assert.throws(() => normalizeItems([{ variant_id: 'v1', quantity }]));
  assert.throws(() => normalizeItems([{ variant_id: 'v1', quantity: 6 }, { variant_id: 'v1', quantity: 5 }]));
  assert.deepEqual(normalizeItems([{ variant_id: 'v1', quantity: 2 }, { variant_id: 'v1', quantity: 3 }]), [{ variant_id: 'v1', quantity: 5 }]);
});

test('checkout charges server prices plus quoted shipping, reuses session, reserves once', async () => {
  const { db } = fixture(); const calls = mockStripe(); const body = await quoted();
  assert.equal((await createCheckout(post(body))).status, 200);
  assert.equal(db.Order[0].total, 52.32);
  const params = new URLSearchParams(calls[0].options.body);
  assert.equal(params.get('line_items[0][price_data][unit_amount]'), '1999');
  assert.equal(params.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '1234');
  assert.ok(params.get('cancel_url').includes('cancel_token='));
  assert.equal(db.ProductVariant[0].stock, 3);
  assert.equal((await createCheckout(post(body))).status, 200);
  assert.equal(calls.length, 1); assert.equal(db.Order.length, 1); assert.equal(db.ProductVariant[0].stock, 3);
});

test('quote rejects a changed CEP, changed quantities, changed price, expired quote and invented service', async () => {
  for (const kind of ['cep', 'quantity', 'price', 'expired', 'service']) {
    const { db } = fixture(); const calls = mockStripe(); const body = await quoted();
    if (kind === 'cep') body.shipping_address = { ...shipping_address, postal_code: '31000000' };
    if (kind === 'quantity') body.items[0].quantity = 1;
    if (kind === 'price') db.ProductVariant[0].price = 20;
    if (kind === 'expired') db.ShippingQuote[0].expires_at = '2000-01-01T00:00:00Z';
    if (kind === 'service') body.shipping_option_id = 'free';
    const response = await createCheckout(post(body)); assert.ok([400, 409].includes(response.status), kind);
    assert.equal(calls.length, 0); assert.equal(db.Order.length, 0);
  }
});

test('disabled/unconfigured shipping blocks checkout and missing dimensions never invent a rate', async () => {
  const { db } = fixture(); db.SiteSettings[0].shipping_configured = false;
  assert.equal((await quoteShipping(post({ postal_code: '32000000', items: [{ variant_id: 'v1', quantity: 1 }] }))).status, 503);
  const settings = { shipping_configured: true, shipping_provider: 'melhor_envio', shipping_origin_postal_code: '32000000' };
  const cart = { orderItems: [{ variant_id: 'v1', product_name: 'Produto', quantity: 1, unit_price: 10 }], variants: [{}] };
  await assert.rejects(shippingOptions(cart, '31000000', settings, () => 'secret'), /peso e medidas/);
});

test('Melhor Envio uses custom price/time, drops unavailable carriers, sends kg/cm and unit insurance', async () => {
  const cart = { orderItems: [{ variant_id: 'v1', product_name: 'Produto', quantity: 2, unit_price: 10 }], variants: [{ weight_kg: .2, height_cm: 5, width_cm: 10, length_cm: 16 }] };
  const options = await shippingOptions(cart, '31000000', { shipping_configured: true, shipping_provider: 'melhor_envio', shipping_origin_postal_code: '32000000' }, () => 'secret', async (url, init) => {
    assert.ok(url.startsWith('https://www.melhorenvio.com.br/'));
    const body = JSON.parse(init.body); assert.equal(body.products[0].weight, .2); assert.equal(body.products[0].insurance_value, 10); assert.equal(body.products[0].quantity, 2);
    return Response.json([{ id: 1, name: 'PAC', company: { name: 'Correios' }, price: '25', custom_price: '20.50', delivery_time: 8, custom_delivery_time: 6 }, { id: 2, error: 'indisponível' }]);
  });
  assert.deepEqual(options, [{ id: '1', name: 'PAC', company: 'Correios', price: 20.5, delivery_days: 6 }]);
});

test('two customers cannot reserve the same last unit; retries cannot double decrement', async () => {
  const { db, client } = fixture({ stock: 1 });
  const data = { payment_status: 'pending', status: 'pending_payment', items: [{ variant_id: 'v1', product_id: 'p1', product_name: 'Produto', quantity: 1 }], stock_reserved: true };
  db.Order.push({ id: 'a', ...clone(data) }, { id: 'b', ...clone(data) });
  const results = await Promise.allSettled(db.Order.map(order => reserveOrderStock(client, clone(order))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(db.ProductVariant[0].stock, 0);
  const winner = db.Order.find(o => o.stock_committed);
  await reserveOrderStock(client, clone(winner)); assert.equal(db.ProductVariant[0].stock, 0);
  await expireOrder(client, winner); await expireOrder(client, winner); assert.equal(db.ProductVariant[0].stock, 1);
});

test('expiry during a multi-item reservation cannot leave later items reserved', async () => {
  const { db, client, entities } = fixture();
  db.ProductVariant.push({ ...clone(db.ProductVariant[0]), id: 'v2', sku: 'SKU2' });
  mockStripe();
  const items = [{ variant_id: 'v1', quantity: 1 }, { variant_id: 'v2', quantity: 1 }];
  const quoteResponse = await quoteShipping(post({ items, postal_code: shipping_address.postal_code }));
  assert.equal(quoteResponse.status, 200);
  const quote = await quoteResponse.json();
  const updateVariants = entities.ProductVariant.updateMany;
  let expired = false;
  entities.ProductVariant.updateMany = async (query, operations) => {
    const result = await updateVariants(query, operations);
    if (!expired && operations.$inc?.stock === -1) {
      expired = true;
      await expireOrder(client, clone(db.Order[0]), 'Expired while reserving');
    }
    return result;
  };
  const response = await createCheckout(post({ items, customer, shipping_address, shipping_quote_token: quote.token, shipping_option_id: 'fixed' }));
  assert.equal(response.status, 409);
  assert.deepEqual(db.ProductVariant.map(variant => variant.stock), [5, 5]);
  assert.ok(db.ProductVariant.every(variant => !variant.stock_order_ids?.length));
  assert.equal(db.Order[0].stock_committed, false);
  assert.equal(db.Order[0].status, 'cancelled');
  assert.equal(db.Order[0].checkout_url, undefined);
});

test('signed webhook confirms once, sends once, rejects wrong totals and protects paid order from expiry', async () => {
  const { db, client } = fixture(); mockStripe(); const body = await quoted(); await createCheckout(post(body));
  const wrong = paidEvent(db.Order[0]); wrong.data.object.amount_total = 1;
  assert.equal((await signed(wrong)).status, 200); assert.equal(db.Order[0].payment_status, 'pending');
  globalThis.__checkoutSecrets.RESEND_API_KEY = 'test'; globalThis.__checkoutSecrets.ORDER_EMAIL_FROM = 'store@example.com';
  let emails = 0; globalThis.fetch = async () => { emails++; return Response.json({ id: 'email1' }); };
  const event = paidEvent(db.Order[0]);
  assert.equal((await signed(event)).status, 200); assert.equal((await signed(event)).status, 200);
  assert.equal(db.Order[0].payment_status, 'paid'); assert.equal(db.Order[0].payment_intent, 'pi_123'); assert.equal(emails, 1); assert.equal(db.ProductVariant[0].stock, 3);
  await expireOrder(client, db.Order[0]); assert.equal(db.ProductVariant[0].stock, 3); assert.equal(db.Order[0].payment_status, 'paid');
});

test('invalid/stale webhook signature cannot change an order', async () => {
  const { db } = fixture(); mockStripe(); await createCheckout(post(await quoted()));
  assert.equal((await signed(paidEvent(db.Order[0]), 'wrong')).status, 400);
  assert.equal((await signed(paidEvent(db.Order[0]), 'whsec_mock', 600)).status, 400);
  assert.equal(db.Order[0].payment_status, 'pending');
});

test('full refunds restore once; partial refunds do not cancel or restore stock', async () => {
  const { db } = fixture(); mockStripe(); await createCheckout(post(await quoted())); await signed(paidEvent(db.Order[0]));
  const refund = { type: 'charge.refunded', data: { object: { payment_intent: 'pi_123', refunded: false } } };
  await signed(refund); assert.equal(db.Order[0].payment_status, 'paid'); assert.equal(db.ProductVariant[0].stock, 3);
  refund.data.object.refunded = true; await signed(refund); await signed(refund);
  assert.equal(db.Order[0].payment_status, 'refunded'); assert.equal(db.ProductVariant[0].stock, 5);
});

test('Stripe rejection rolls back reservation; timeout retry uses same order and idempotency key', async () => {
  let f = fixture(); let body = await quoted();
  globalThis.fetch = async () => Response.json({ error: 'invalid' }, { status: 400 });
  assert.equal((await createCheckout(post(body))).status, 502); assert.equal(f.db.ProductVariant[0].stock, 5);
  f = fixture(); body = await quoted(); let key;
  globalThis.fetch = async (_url, options) => { key = options.headers['Idempotency-Key']; throw new Error('timeout'); };
  assert.equal((await createCheckout(post(body))).status, 500); assert.equal(f.db.ProductVariant[0].stock, 5);
  globalThis.fetch = async (_url, options) => { assert.equal(options.headers['Idempotency-Key'], key); return Response.json({ id: 'cs_test_123', url: 'https://checkout.stripe.com/test' }); };
  assert.equal((await createCheckout(post(body))).status, 200); assert.equal(f.db.Order.length, 1); assert.equal(f.db.ProductVariant[0].stock, 3);
});

test('cancel return closes Stripe session and restores stock; invalid token cannot cancel', async () => {
  const { db } = fixture(); mockStripe(); await createCheckout(post(await quoted()));
  assert.equal((await cancelCheckout(post({ token: 'wrong' }))).status, 400);
  globalThis.fetch = async (url) => Response.json({ status: url.endsWith('/expire') ? 'expired' : 'open' });
  const response = await cancelCheckout(post({ token: db.Order[0].checkout_cancel_token }));
  assert.equal(response.status, 200); assert.equal(db.Order[0].payment_status, 'expired'); assert.equal(db.ProductVariant[0].stock, 5);
});

test('admin cannot rewrite charged freight or mark refunded/cancelled orders paid through status dropdown', async () => {
  const { db, client } = fixture(); mockStripe(); await createCheckout(post(await quoted())); const id = db.Order[0].id;
  assert.equal((await manageOrder(post({ order_id: id, action: 'set_shipping', shipping_total: 0 }))).status, 409);
  assert.equal((await manageOrder(post({ order_id: id, action: 'set_status', status: 'paid' }))).status, 400);
  assert.equal((await manageOrder(post({ order_id: id, action: 'set_status', status: 'shipped' }))).status, 409);
  await expireOrder(client, db.Order[0]); assert.equal((await confirmOrderPayment(client, db.Order[0])).ok, false);
});

test('catalog relinking fixes unique exact matches and leaves ambiguous records for review', async () => {
  const { db } = fixture(); db.ProductVariant.push({ id: 'orphan1', product_id: 'old-id', source_id: 'original-p1', active: true, stock: 1 }, { id: 'orphan2', product_id: 'missing', source_id: 'ambiguous', active: true, stock: 1 });
  db.Product.push({ id: 'p2', source_id: 'ambiguous' }, { id: 'p3', source_id: 'ambiguous' });
  const response = await relinkVariants(post({})); assert.equal(response.status, 200); const data = await response.json();
  assert.equal(data.fixed, 1); assert.equal(data.unresolved, 1); assert.equal(db.ProductVariant[1].product_id, 'p1'); assert.equal(db.ProductVariant[2].product_id, 'missing');
});

test('email failure is recorded and retryable without undoing payment', async () => {
  const { db, entities } = fixture(); const order = { id: 'o1', payment_status: 'paid', customer_email: 'client@example.com' }; db.Order.push(order);
  await assert.rejects(sendPaymentEmail({ entities }, order, () => 'test', async () => Response.json({}, { status: 503 })));
  assert.equal(db.Order[0].payment_status, 'paid'); assert.ok(db.Order[0].confirmation_email_error);
});

test('asynchronous payment failure releases the held stock once', async () => {
  const { db } = fixture(); mockStripe(); await createCheckout(post(await quoted()));
  const event = paidEvent(db.Order[0]); event.type = 'checkout.session.async_payment_failed'; event.data.object.payment_status = 'unpaid';
  assert.equal((await signed(event)).status, 200); assert.equal((await signed(event)).status, 200);
  assert.equal(db.Order[0].payment_status, 'failed'); assert.equal(db.Order[0].status, 'cancelled'); assert.equal(db.ProductVariant[0].stock, 5);
});

test('a refund arriving before completion is reconciled by PaymentIntent metadata', async () => {
  const { db } = fixture(); mockStripe(); await createCheckout(post(await quoted()));
  globalThis.fetch = async () => Response.json({ metadata: { order_id: db.Order[0].id, base44_app_id: 'app1' } });
  const event = { type: 'charge.refunded', data: { object: { payment_intent: 'pi_123', refunded: true } } };
  assert.equal((await signed(event)).status, 200);
  assert.equal(db.Order[0].payment_status, 'refunded'); assert.equal(db.ProductVariant[0].stock, 5);
  await signed(paidEvent(db.Order[0])); assert.equal(db.Order[0].payment_status, 'refunded'); assert.equal(db.ProductVariant[0].stock, 5);
});

test('concurrent checkout retries never cancel a successful pending Stripe request', async () => {
  const { db } = fixture(); const body = await quoted();
  let firstStarted; const started = new Promise(resolve => { firstStarted = resolve; });
  let finishFirst; const finish = new Promise(resolve => { finishFirst = resolve; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) { firstStarted(); await finish; return Response.json({ id: 'cs_test_123', url: 'https://checkout.stripe.com/test' }); }
    return Response.json({ error: { code: 'idempotency_key_in_use' } }, { status: 409 });
  };
  const first = createCheckout(post(body)); await started;
  const second = await createCheckout(post(body));
  finishFirst(); const successful = await first;
  assert.equal(successful.status, 200); assert.ok([409, 502].includes(second.status));
  assert.equal(db.Order[0].payment_status, 'pending'); assert.equal(db.Order[0].status, 'pending_payment');
  assert.equal(db.ProductVariant[0].stock, 3);
  await signed(paidEvent(db.Order[0])); assert.equal(db.Order[0].payment_status, 'paid');
});

test('ambiguous creation without a Stripe reference holds no inventory and remains administratively cancellable', async () => {
  const { db } = fixture(); const body = await quoted();
  globalThis.fetch = async () => { throw new Error('connection failed before session creation'); };
  assert.equal((await createCheckout(post(body))).status, 500);
  assert.equal(db.ProductVariant[0].stock, 5); assert.equal(db.Order[0].stock_committed, false);
  assert.equal(db.Order[0].stock_reserved, false);
  db.Order[0].checkout_expires_at = '2000-01-01T00:00:00Z';
  assert.equal((await createCheckout(post(body))).status, 409);
  assert.equal((await manageOrder(post({ order_id: db.Order[0].id, action: 'cancel' }))).status, 200);
  assert.equal(db.ProductVariant[0].stock, 5);
});

test('database failure persisting the Stripe reference cannot strand a stock reservation', async () => {
  const { db, entities } = fixture(); const body = await quoted(); mockStripe();
  const updateMany = entities.Order.updateMany.bind(entities.Order);
  entities.Order.updateMany = async (query, ops) => {
    if (ops.$set?.payment_reference) throw new Error('database unavailable');
    return updateMany(query, ops);
  };
  assert.equal((await createCheckout(post(body))).status, 500);
  assert.equal(db.ProductVariant[0].stock, 5); assert.equal(db.Order[0].stock_committed, false);
});
