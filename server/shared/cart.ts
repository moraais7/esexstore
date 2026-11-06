import { variantLabelOf, variantUnitPrice } from './orders.ts';

export class CheckoutError extends Error {
  status: number;
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const cents = (value) => Math.round(Number(value) * 100);
export const postalCode = (value) => String(value || '').replace(/\D/g, '');

export function normalizeItems(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20) {
    throw new CheckoutError('O carrinho deve ter entre 1 e 20 itens diferentes.');
  }
  const merged = new Map();
  for (const item of raw) {
    const id = typeof item?.variant_id === 'string' ? item.variant_id.trim() : '';
    const quantity = item?.quantity;
    if (!id || id.length > 160 || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new CheckoutError('Quantidades inválidas. Use de 1 a 10 unidades por variação.');
    }
    const total = (merged.get(id) || 0) + quantity;
    if (total > 10) throw new CheckoutError('O limite é de 10 unidades por variação.');
    merged.set(id, total);
  }
  return [...merged].sort(([a], [b]) => a.localeCompare(b)).map(([variant_id, quantity]) => ({ variant_id, quantity }));
}

export async function loadCart(service, raw) {
  const items = normalizeItems(raw);
  const { items: variants } = await service.entities.ProductVariant.filter(
    { id: { $in: items.map(i => i.variant_id) }, active: true }, { limit: 20 }
  );
  const byId = new Map((variants || []).map(v => [v.id, v]));
  const ids = [...new Set((variants || []).map(v => v.product_id).filter(Boolean))];
  if (!ids.length) throw new CheckoutError('Produtos indisponíveis. Atualize o carrinho.', 409);
  const { items: products } = await service.entities.Product.filter(
    { id: { $in: ids }, visible: true, status: 'active' }, { limit: 20 }
  );
  const byProduct = new Map((products || []).map(p => [p.id, p]));
  const orderItems = items.map(item => {
    const variant = byId.get(item.variant_id);
    const product = variant && byProduct.get(variant.product_id);
    if (!product) throw new CheckoutError('Um produto está indisponível. Atualize o carrinho.', 409);
    const unit = cents(variantUnitPrice(variant));
    if (!Number.isSafeInteger(unit) || unit <= 0) throw new CheckoutError(`Preço em revisão: ${product.name}.`, 409);
    if (Number(variant.stock || 0) < item.quantity) throw new CheckoutError(`Estoque insuficiente: ${product.name}.`, 409);
    return {
      product_id: product.id, product_name: product.name, product_slug: product.slug,
      variant_id: variant.id, sku: variant.sku, variant_label: variantLabelOf(variant),
      unit_price: unit / 100, quantity: item.quantity, line_total: unit * item.quantity / 100,
    };
  });
  const subtotal = orderItems.reduce((sum, item) => sum + cents(item.line_total), 0) / 100;
  return { items, orderItems, variants: items.map(i => byId.get(i.variant_id)), subtotal };
}

// Server prices and physical data are part of the quote identity.
export const cartFingerprint = (cart) => JSON.stringify(cart.orderItems.map((item, index) => ({
  id: item.variant_id, quantity: item.quantity, price: cents(item.unit_price),
  dimensions: ['weight_kg', 'height_cm', 'width_cm', 'length_cm'].map(k => cart.variants[index][k] ?? null),
})));

export function validateCustomer(customer = {}, address = {}) {
  const text = (v, max) => String(v ?? '').trim().slice(0, max);
  const name = text(customer.name, 120);
  const email = text(customer.email, 160);
  const phone = postalCode(customer.phone);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^\d{10,15}$/.test(phone)) {
    throw new CheckoutError('Informe nome, e-mail e telefone válidos.');
  }
  const shipping = {
    postal_code: postalCode(address.postal_code), street: text(address.street, 160),
    number: text(address.number, 20), complement: text(address.complement, 80),
    district: text(address.district, 80), city: text(address.city, 80), state: text(address.state, 2).toUpperCase(), country: 'Brasil',
  };
  const states = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  if (!/^\d{8}$/.test(shipping.postal_code) || !shipping.street || !shipping.number || !shipping.district || !shipping.city || !states.includes(shipping.state)) {
    throw new CheckoutError('Preencha o endereço completo, com CEP de 8 dígitos e UF válida.');
  }
  return { name, email, phone, document: text(customer.document, 40), notes: text(customer.notes, 500), shipping };
}
