import test from 'node:test';
import assert from 'node:assert/strict';
import { variantNumericFields } from '../src/lib/variantNumericFields.js';
import { variantUnitPrice } from '../base44/shared/orders.ts';
import { shippingOptions } from '../base44/shared/shipping.ts';

const saved = { price: 25, promo_price: 10, weight_kg: .2, height_cm: 5, width_cm: 10, length_cm: 16 };

test('removing an admin promotion stops charging the old discounted price', () => {
  const updated = { ...saved, ...variantNumericFields({ ...saved, promo_price: '' }) };
  assert.equal(variantUnitPrice(updated), 25);
  assert.equal(updated.promo_price, null);
});

test('removing an admin price leaves the variant unavailable rather than selling at its previous price', () => {
  const updated = { ...saved, ...variantNumericFields({ ...saved, price: '', promo_price: '' }) };
  assert.equal(variantUnitPrice(updated), 0);
  assert.equal(updated.price, null);
});

test('removing a shipping measurement prevents quoting with its stale saved value', async () => {
  for (const field of ['weight_kg', 'height_cm', 'width_cm', 'length_cm']) {
    const updated = { ...saved, ...variantNumericFields({ ...saved, [field]: '' }) };
    await assert.rejects(shippingOptions(
      { orderItems: [{ variant_id: 'v1', product_name: 'Produto', quantity: 1, unit_price: 25 }], variants: [updated] },
      '31000000',
      { shipping_configured: true, shipping_provider: 'melhor_envio', shipping_origin_postal_code: '32000000' },
      () => 'test-only',
      async () => Response.json([{ id: 1, price: '20', delivery_time: 5 }]),
    ), /peso e medidas/);
  }
});

test('admin saves numeric inputs as finite positive numbers and clears invalid values', () => {
  assert.deepEqual(variantNumericFields({ price: '25.90', promo_price: '20', weight_kg: '0.15', height_cm: '5', width_cm: '10', length_cm: '16' }), {
    price: 25.9, promo_price: 20, weight_kg: .15, height_cm: 5, width_cm: 10, length_cm: 16,
  });
  for (const invalid of ['', null, undefined, 0, -1, 'invalid', Infinity]) {
    const values = Object.fromEntries(Object.keys(saved).map(field => [field, invalid]));
    assert.ok(Object.values(variantNumericFields(values)).every(value => value === null));
    assert.equal(Object.keys(variantNumericFields(values)).length, 6);
  }
});
