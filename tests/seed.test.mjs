import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/database.js';
import { seedIfEmpty } from '../server/seed.js';

test('catalog seed keeps persisted stock and settings on a second startup', async () => {
  const store = createStore();
  try {
    const seed = { Product: [{ id: 'p1', name: 'Produto' }], ProductVariant: [{ id: 'v1', product_id: 'p1', stock: 5 }], SiteSettings: [{ id: 's1', key: 'main', shipping_origin_postal_code: '32241340' }] };
    assert.equal(await seedIfEmpty(store, seed), true);
    await store.entities.ProductVariant.update('v1', { stock: 2 });
    await store.entities.SiteSettings.update('s1', { shipping_configured: true });
    assert.equal(await seedIfEmpty(store, seed), false);
    assert.equal((await store.entities.ProductVariant.get('v1')).stock, 2);
    assert.equal((await store.entities.SiteSettings.get('s1')).shipping_configured, true);
  } finally { store.close(); }
});

test('failed seed rolls back every catalog write so startup can retry safely', async () => {
  const store = createStore();
  try {
    await assert.rejects(seedIfEmpty(store, { Product: [{ id: 'p1' }, { id: 'p1' }] }));
    assert.equal(await store.entities.Product.count(), 0);
    assert.equal(await seedIfEmpty(store, { Product: [{ id: 'p1' }] }), true);
  } finally { store.close(); }
});

test('seeding a fresh catalog preserves an existing main settings record', async () => {
  const store = createStore();
  try {
    await store.entities.SiteSettings.create({ id: 'existing', key: 'main', contact_email: 'store@example.com' });
    await seedIfEmpty(store, { Product: [{ id: 'p1' }], SiteSettings: [{ id: 'seed', key: 'main' }] });
    assert.equal(await store.entities.SiteSettings.count({ key: 'main' }), 1);
    assert.equal((await store.entities.SiteSettings.get('existing')).contact_email, 'store@example.com');
  } finally { store.close(); }
});
