import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { cancelOrder, confirmOrderPayment } from '../../shared/orders.ts';

const ALLOWED_STATUS = ['pending_payment', 'paid', 'shipping_quote', 'awaiting_shipment', 'shipped', 'cancelled'];
const ALLOWED_SHIPPING_STATUS = ['quote_pending', 'quoted', 'arranged'];

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((error) => (error.status === 401 ? null : Promise.reject(error)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id || '').trim();
    const action = String(body.action || '').trim();
    if (!orderId || !action) return Response.json({ error: 'order_id e action são obrigatórios.' }, { status: 400 });

    const service = base44.asServiceRole;
    const order = await service.entities.Order.get(orderId).catch((error) => (error.status === 404 ? null : Promise.reject(error)));
    if (!order) return Response.json({ error: 'Pedido não encontrado.' }, { status: 404 });

    if (action === 'mark_paid') {
      const result = await confirmOrderPayment(base44, order, {
        provider: order.payment_provider || 'manual',
        reference: order.payment_reference || '',
        note: `Pagamento confirmado manualmente por ${user.email}.`,
      });
      return Response.json({ order: result.order || order, mismatch: Boolean(result?.mismatch) });
    }

    if (action === 'cancel') {
      const result = await cancelOrder(base44, order, `Pedido cancelado por ${user.email}.`);
      return Response.json({ order: result.order });
    }

    if (action === 'set_shipping') {
      const shippingTotal = Number(body.shipping_total) || 0;
      if (shippingTotal < 0) return Response.json({ error: 'Valor de frete inválido.' }, { status: 400 });
      const shippingStatus = ALLOWED_SHIPPING_STATUS.includes(body.shipping_status) ? body.shipping_status : 'quoted';
      const updated = await service.entities.Order.update(order.id, {
        shipping_total: shippingTotal,
        shipping_method: String(body.shipping_method || '').slice(0, 120),
        shipping_status: shippingStatus,
        total: Number(order.subtotal || 0) - Number(order.discount_total || 0) + shippingTotal,
        admin_notes: body.note ? `${order.admin_notes ? `${order.admin_notes}\n` : ''}${String(body.note).slice(0, 400)}` : order.admin_notes,
      });
      return Response.json({ order: updated });
    }

    if (action === 'set_status') {
      const status = String(body.status || '');
      if (!ALLOWED_STATUS.includes(status)) return Response.json({ error: 'Status inválido.' }, { status: 400 });
      const updated = await service.entities.Order.update(order.id, {
        status,
        admin_notes: body.note ? `${order.admin_notes ? `${order.admin_notes}\n` : ''}${String(body.note).slice(0, 400)}` : order.admin_notes,
      });
      return Response.json({ order: updated });
    }

    if (action === 'set_notes') {
      const updated = await service.entities.Order.update(order.id, {
        admin_notes: String(body.admin_notes || '').slice(0, 2000),
      });
      return Response.json({ order: updated });
    }

    return Response.json({ error: 'Ação não suportada.' }, { status: 400 });
  } catch (error) {
    console.error('manageOrder falhou', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}