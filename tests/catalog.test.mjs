import test from 'node:test';
import assert from 'node:assert/strict';
import { autoMap, buildCatalog, parseDelimited } from '../src/lib/csv.js';
import importCatalog from '../base44/functions/importCatalog/entry.ts';

const columns = ['Identificador URL', 'Nome', 'SKU', 'Nome da variação 1', 'Valor da variação 1', 'Preço', 'Estoque', 'Peso (kg)', 'Altura (cm)', 'Largura (cm)', 'Comprimento (cm)'];
const row = (index, values) => ({ index, cells: columns.map(c => values[c] ?? '') });
const variant = (value, stock) => ({ sku: 'SHARED', option1_name: 'Cor', option1_value: value, price: 25, stock });
const product = variants => ({ source_id: 'produto-original-123', name: 'Produto', slug: 'produto-original-123', variants });
const request = products => new Request('https://store.example.com/functions/importCatalog', { method: 'POST', body: JSON.stringify({ products }) });
function fixture(initial = []) {
  const db = { Product: [{ id: 'p1', source_id: 'produto-original-123', slug: 'produto-original-123', images: [] }], ProductVariant: structuredClone(initial), Category: [] };
  const matches = (r, q) => Object.entries(q).every(([k, v]) => v && typeof v === 'object' ? v.$in.includes(r[k]) : r[k] === v);
  const entities = Object.fromEntries(Object.entries(db).map(([name, records]) => [name, {
    async list({ limit = 400, cursor } = {}) { return this.filter({}, { limit, cursor }); },
    async filter(query, { limit = 400, cursor } = {}) { const all = records.filter(r => matches(r, query)); const offset = Number(cursor || 0); return { items: structuredClone(all.slice(offset, offset + limit)), next_cursor: offset + limit < all.length ? String(offset + limit) : null }; },
    async create(data) { const r = { id: `${name}-${records.length + 1}`, ...structuredClone(data) }; records.push(r); return structuredClone(r); },
    async update(id, data) { const r = records.find(r => r.id === id); Object.assign(r, structuredClone(data)); return structuredClone(r); },
    async bulkCreate(data) { return Promise.all(data.map(d => this.create(d))); },
    async bulkUpdate(data) { return Promise.all(data.map(({ id, ...values }) => this.update(id, values))); },
  }]));
  globalThis.__checkoutClient = () => ({ auth: { me: async () => ({ role: 'admin' }) }, asServiceRole: { entities } });
  return db;
}

test('CSV keeps distinct options that share a SKU and preserves their stock', () => {
  const catalog = buildCatalog([
    row(2, { 'Identificador URL': 'produto-original-123', Nome: 'Produto', SKU: 'SHARED', 'Nome da variação 1': 'Cor', 'Valor da variação 1': 'Pink', Preço: '25.00', Estoque: '1' }),
    row(3, { 'Identificador URL': 'produto-original-123', SKU: 'SHARED', 'Nome da variação 1': 'Cor', 'Valor da variação 1': 'Roxo', Preço: '25.00', Estoque: '3' }),
  ], autoMap(columns));
  assert.equal(catalog.stats.variants, 2); assert.equal(catalog.products[0].variants.reduce((n, v) => n + v.stock, 0), 4);
  assert.deepEqual(catalog.products[0].variants.map(v => v.sku), ['SHARED', 'SHARED']);
});

test('CSV preserves original Nuvemshop product URL instead of deriving it from the name', () => {
  const catalog = buildCatalog([row(2, { 'Identificador URL': 'produto-original-123', Nome: 'Nome novo', SKU: 'X', Preço: '25.00', Estoque: '1' })], autoMap(columns));
  assert.equal(catalog.products[0].slug, 'produto-original-123');
});

test('reimport updates each shared-SKU option separately without collapsing or duplicating variants', async () => {
  const db = fixture([{ id: 'v1', product_id: 'p1', ...variant('Pink', 1) }, { id: 'v2', product_id: 'p1', ...variant('Roxo', 2) }]);
  const response = await importCatalog(request([product([variant('Pink', 4), variant('Roxo', 7)])]));
  assert.equal(response.status, 200); assert.equal(db.ProductVariant.length, 2);
  assert.equal(db.ProductVariant.find(v => v.id === 'v1').stock, 4); assert.equal(db.ProductVariant.find(v => v.id === 'v2').stock, 7);
  assert.equal(db.ProductVariant.find(v => v.id === 'v1').option1_value, 'Pink');
});

test('reimport recovers a previously dropped option without overwriting the retained option', async () => {
  const db = fixture([{ id: 'v1', product_id: 'p1', ...variant('Pink', 1) }]);
  await importCatalog(request([product([variant('Pink', 4), variant('Roxo', 7)])]));
  assert.equal(db.ProductVariant.length, 2); assert.equal(db.ProductVariant.find(v => v.id === 'v1').option1_value, 'Pink');
  assert.equal(db.ProductVariant.find(v => v.option1_value === 'Roxo').stock, 7);
});

test('clearing a promotional price on reimport removes the previous discount', async () => {
  const db = fixture([{ id: 'v1', product_id: 'p1', ...variant('Pink', 1), promo_price: 10 }]);
  await importCatalog(request([product([{ ...variant('Pink', 1), promo_price: null }])]));
  assert.equal(db.ProductVariant[0].promo_price, null);
});

test('missing weight or dimensions is flagged for review rather than assumed valid', () => {
  const catalog = buildCatalog([row(2, { 'Identificador URL': 'produto-original-123', Nome: 'Produto', SKU: 'X', Preço: '25.00', Estoque: '1', 'Peso (kg)': '0', 'Altura (cm)': '1', 'Largura (cm)': '1', 'Comprimento (cm)': '1' })], autoMap(columns));
  assert.ok(catalog.products[0].review_notes.some(note => /peso|medidas/i.test(note)));
});

test('ambiguous persisted variants leave the whole product unchanged', async () => {
  const db = fixture([{ id: 'v1', product_id: 'p1', ...variant('Pink', 5) }, { id: 'v2', product_id: 'p1', ...variant('Pink', 5) }]);
  db.Product[0] = { ...db.Product[0], total_stock: 10, price_from: 25, status: 'active', visible: true };
  const before = structuredClone(db);
  const response = await importCatalog(request([product([{ ...variant('Pink', 1), price: 40 }])]));
  assert.equal(response.status, 200); const { summary } = await response.json();
  assert.equal(summary.errors[0].code, 'variacao_ambigua');
  assert.deepEqual(db.Product, before.Product); assert.deepEqual(db.ProductVariant, before.ProductVariant);
});
