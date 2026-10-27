import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { secrets } from 'base44:runtime';
import { sendPaymentEmail } from '../../shared/email.ts';
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
      if (!result.ok) return Response.json({ error: 'Este pedido não pode ser confirmado neste estado.' }, { status: 409 });
      await sendPaymentEmail(service, result.order, name => secrets.get(name)).catch(error => console.error('email', error.message));
      return Response.json({ order: result.order || order, mismatch: Boolean(result?.mismatch) });
    }

    if (action === 'cancel') {
      if (Number(order.checkout_lock_until || 0) > Date.now()) return Response.json({ error: 'O checkout está sendo preparado. Aguarde antes de cancelar.' }, { status: 409 });
      if (order.payment_status === 'paid') return Response.json({ error: 'Estorne o pagamento no Stripe antes de cancelar.' }, { status: 409 });
      if (order.stock_reserved && !order.payment_reference) return Response.json({ error: 'A tentativa de pagamento ainda precisa ser conciliada. Tente novamente pelo checkout antes de cancelar.' }, { status: 409 });
      if (order.payment_reference?.startsWith('cs_')) {
        const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(order.payment_reference)}/expire`, { method: 'POST', headers: { Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}` }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) return Response.json({ error: 'Não foi possível encerrar o pagamento no Stripe. Confira o pedido antes de cancelar.' }, { status: 409 });
      }
      const result = await cancelOrder(base44, order, `Pedido cancelado por ${user.email}.`);
      return Response.json({ order: result.order });
    }

    if (action === 'set_shipping') {
      if (order.payment_reference || order.stock_reserved || order.payment_status === 'paid') return Response.json({ error: 'O frete de um checkout emitido não pode ser alterado.' }, { status: 409 });
      const shippingTotal = Number(body.shipping_total);
      if (!Number.isFinite(shippingTotal) || shippingTotal < 0) return Response.json({ error: 'Valor de frete inválido.' }, { status: 400 });
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
      if (['paid', 'cancelled', 'pending_payment', 'shipping_quote'].includes(status)) return Response.json({ error: 'Use as ações de confirmar pagamento ou cancelar.' }, { status: 400 });
      if (order.payment_status !== 'paid' || order.status === 'cancelled') return Response.json({ error: 'Confirme o pagamento antes de preparar ou enviar.' }, { status: 409 });
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