export const CURRENCY = 'brl';
export const variantUnitPrice = (variant) => {
  const promo = Number(variant?.promo_price || 0);
  const price = Number(variant?.price || 0);
  if (Number.isFinite(promo) && promo > 0 && price > 0 && promo < price) return promo;
  return Number.isFinite(price) && price > 0 ? price : 0;
};
export const variantLabelOf = (variant) => [variant?.option1_value, variant?.option2_value, variant?.option3_value].filter(Boolean).join(' / ');
export const buildOrderNumber = () => `ES-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;

const refreshProducts = async (service, items) => {
  for (const productId of new Set(items.map(i => i.product_id))) {
    let cursor;
    let total = 0;
    do {
      const page = await service.entities.ProductVariant.filter({ product_id: productId, active: true }, { limit: 200, cursor });
      total += page.items.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
      cursor = page.next_cursor;
    } while (cursor);
    await service.entities.Product.update(productId, { total_stock: total });
  }
};

// Single-ID conditional writes: concurrent checkouts cannot reserve the same last unit.
// The order marker makes retries safe even if an earlier response was lost.
export async function reserveOrderStock(base44, order) {
  const service = base44.asServiceRole;
  for (const item of order.items || []) {
    const result = await service.entities.ProductVariant.updateMany(
      { id: item.variant_id, active: true, stock: { $gte: item.quantity }, stock_order_ids: { $ne: order.id } },
      { $inc: { stock: -item.quantity }, $addToSet: { stock_order_ids: order.id } }
    );
    if (result.updated !== 1) {
      const current = await service.entities.ProductVariant.get(item.variant_id);
      if (!current.stock_order_ids?.includes(order.id)) throw new Error(`Estoque insuficiente: ${item.product_name}.`);
    }
  }
  await service.entities.Order.update(order.id, { stock_committed: true, stock_reserved: true });
  await refreshProducts(service, order.items || []);
}

export async function releaseOrderStock(base44, order) {
  const service = base44.asServiceRole;
  if (order.stock_reserved) {
    for (const item of order.items || []) {
      await service.entities.ProductVariant.updateMany(
        { id: item.variant_id, stock_order_ids: order.id },
        { $inc: { stock: item.quantity }, $pull: { stock_order_ids: order.id } }
      );
    }
  } else if (order.stock_committed) {
    for (const item of order.items || []) {
      await service.entities.ProductVariant.updateMany(
        { id: item.variant_id, stock_release_ids: { $ne: order.id } },
        { $inc: { stock: item.quantity }, $addToSet: { stock_release_ids: order.id } }
      );
    }
  }
  await service.entities.Order.update(order.id, { stock_committed: false });
  await refreshProducts(service, order.items || []);
}

export const confirmOrderPayment = async (base44, initial, { provider = 'stripe', reference = '', amountTotal = null, currency = '', paymentIntent = '', note = '' } = {}) => {
  const service = base44.asServiceRole;
  const order = await service.entities.Order.get(initial.id);
  if (amountTotal != null && Number(amountTotal) !== Math.round(Number(order.total) * 100)) return { ok: false, mismatch: true, expected: Math.round(Number(order.total) * 100), received: Number(amountTotal) };
  if (currency && String(currency).toLowerCase() !== CURRENCY) return { ok: false, mismatch: true, expected: CURRENCY, received: currency };
  if (order.payment_status === 'paid') return { ok: true, already: true, order };
  if (order.status === 'cancelled' || order.payment_status === 'refunded') return { ok: false, finalized: true };
  if (!order.stock_committed) await reserveOrderStock(base44, order);
  const result = await service.entities.Order.updateMany(
    { id: order.id, payment_status: { $in: ['pending', 'failed'] }, status: { $ne: 'cancelled' } },
    { $set: { payment_status: 'paid', status: 'paid', payment_provider: provider, payment_reference: reference || order.payment_reference || '', payment_intent: paymentIntent || order.payment_intent || '', paid_at: new Date().toISOString(), stock_committed: true, admin_notes: note ? `${order.admin_notes || ''}\n${note}`.trim() : order.admin_notes || '' } }
  );
  return { ok: true, already: result.updated !== 1, order: await service.entities.Order.get(order.id) };
};

export const cancelOrder = async (base44, initial, reason = '') => {
  const service = base44.asServiceRole;
  const order = await service.entities.Order.get(initial.id);
  // Operational cancellation of a paid order is not a financial refund.
  if (order.payment_status === 'paid' && !reason.startsWith('Estorno integral')) throw new Error('Estorne o pagamento no Stripe antes de cancelar este pedido.');
  await service.entities.Order.update(order.id, { status: 'cancelled', admin_notes: reason ? `${order.admin_notes || ''}\n${reason}`.trim() : order.admin_notes || '' });
  await releaseOrderStock(base44, order);
  return { ok: true, order: await service.entities.Order.get(order.id) };
};
export const expireOrder = async (base44, order, reason = '') => {
  const result = await base44.asServiceRole.entities.Order.updateMany(
    { id: order.id, payment_status: { $in: ['pending', 'failed', 'expired'] } },
    { $set: { status: 'cancelled', payment_status: 'expired', admin_notes: reason } }
  );
  if (result.updated) await releaseOrderStock(base44, order);
  return { ok: true };
};
export const publicOrderView = (order) => ({
  order_number: order.order_number, status: order.status, payment_status: order.payment_status,
  shipping_status: order.shipping_status, shipping_method: order.shipping_method, shipping_delivery_days: order.shipping_delivery_days,
  customer_name: order.customer_name, items: order.items || [], items_count: order.items_count,
  subtotal: order.subtotal, shipping_total: order.shipping_total, total: order.total, created_date: order.created_date,
});
