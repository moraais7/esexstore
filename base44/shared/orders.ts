export const CURRENCY = "brl";

export const variantUnitPrice = (variant) => {
  const promo = Number(variant?.promo_price || 0);
  const price = Number(variant?.price || 0);
  if (promo > 0 && price > 0 && promo < price) return promo;
  return price > 0 ? price : 0;
};

export const variantLabelOf = (variant) =>
  [variant?.option1_value, variant?.option2_value, variant?.option3_value].filter(Boolean).join(" / ");

export const buildOrderNumber = () =>
  `ES-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;

const applyStockDelta = async (base44, order, direction) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const variantIds = items.map((item) => item.variant_id).filter(Boolean);
  if (!variantIds.length) return;

  const { items: variants } = await base44.asServiceRole.entities.ProductVariant.filter(
    { id: { $in: variantIds } },
    { limit: 200 }
  );
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const updates = [];
  items.forEach((item) => {
    const variant = byId.get(item.variant_id);
    if (!variant) return;
    const next = Math.max(0, Number(variant.stock || 0) + direction * Number(item.quantity || 0));
    updates.push({ id: variant.id, stock: next });
  });
  if (updates.length) await base44.asServiceRole.entities.ProductVariant.bulkUpdate(updates);

  const productIds = Array.from(new Set(items.map((item) => item.product_id).filter(Boolean)));
  for (const productId of productIds) {
    const { items: productVariants } = await base44.asServiceRole.entities.ProductVariant.filter(
      { product_id: productId },
      { limit: 200 }
    );
    const total = productVariants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
    await base44.asServiceRole.entities.Product.update(productId, { total_stock: total });
  }
};

/**
 * Confirma o pagamento de um pedido e baixa o estoque. Só deve ser chamada
 * a partir de uma confirmação verificada (webhook assinado) ou por um admin.
 */
export const confirmOrderPayment = async (
  base44,
  order,
  { provider = "stripe", reference = "", amountTotal = null, currency = "", note = "" } = {}
) => {
  if (order.payment_status === "paid") return { ok: true, already: true };

  if (amountTotal !== null && amountTotal !== undefined) {
    const expected = Math.round(Number(order.total || 0) * 100);
    if (Number(amountTotal) !== expected) {
      return { ok: false, mismatch: true, expected, received: Number(amountTotal) };
    }
  }
  if (currency && String(currency).toLowerCase() !== CURRENCY) {
    return { ok: false, mismatch: true, expected: CURRENCY, received: currency };
  }

  if (!order.stock_committed) await applyStockDelta(base44, order, -1);

  const updated = await base44.asServiceRole.entities.Order.update(order.id, {
    payment_status: "paid",
    status: "paid",
    payment_provider: provider,
    payment_reference: reference || order.payment_reference || "",
    paid_at: new Date().toISOString(),
    stock_committed: true,
    admin_notes: note ? `${order.admin_notes ? `${order.admin_notes}\n` : ""}${note}` : order.admin_notes,
  });
  return { ok: true, order: updated };
};

export const cancelOrder = async (base44, order, reason = "") => {
  if (order.stock_committed) await applyStockDelta(base44, order, 1);
  const updated = await base44.asServiceRole.entities.Order.update(order.id, {
    status: "cancelled",
    stock_committed: false,
    admin_notes: reason ? `${order.admin_notes ? `${order.admin_notes}\n` : ""}${reason}` : order.admin_notes,
  });
  return { ok: true, order: updated };
};

export const expireOrder = async (base44, order, reason = "") => {
  const updated = await base44.asServiceRole.entities.Order.update(order.id, {
    status: "cancelled",
    payment_status: "expired",
    admin_notes: reason ? `${order.admin_notes ? `${order.admin_notes}\n` : ""}${reason}` : order.admin_notes,
  });
  return { ok: true, order: updated };
};

export const publicOrderView = (order) => ({
  order_number: order.order_number,
  status: order.status,
  payment_status: order.payment_status,
  shipping_status: order.shipping_status,
  customer_name: order.customer_name,
  items: order.items || [],
  items_count: order.items_count,
  subtotal: order.subtotal,
  shipping_total: order.shipping_total,
  total: order.total,
  created_date: order.created_date,
});