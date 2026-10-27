import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { cancelOrder, confirmOrderPayment, expireOrder } from '../../shared/orders.ts';

const timingSafeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
};

const verifyStripeSignature = async (payload, header, secret) => {
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach((part) => {
    const [key, value] = part.split('=');
    if (!key || !value) return;
    parts[key] = parts[key] || [];
    parts[key].push(value);
  });
  const timestamp = parts.t?.[0];
  if (!timestamp) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return (parts.v1 || []).some((candidate) => timingSafeEqual(candidate, expected));
};

const findOrder = async (service, session) => {
  const orderId = session?.metadata?.order_id;
  if (orderId) {
    const order = await service.entities.Order.get(orderId).catch((error) => (error.status === 404 ? null : Promise.reject(error)));
    if (order) return order;
  }
  const { items } = await service.entities.Order.filter({ payment_reference: session.id }, { limit: 1 });
  return items?.[0] || null;
};

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const payload = await req.text();
    const webhookSecret = secrets.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('stripeWebhook: STRIPE_WEBHOOK_SECRET ausente');
      return Response.json({ error: 'Webhook não configurado' }, { status: 500 });
    }
    if (!(await verifyStripeSignature(payload, req.headers.get('stripe-signature'), webhookSecret))) {
      console.error('stripeWebhook: assinatura inválida');
      return Response.json({ error: 'Assinatura inválida' }, { status: 400 });
    }

    const event = JSON.parse(payload);
    const session = event?.data?.object || {};
    const base44 = createClientFromRequest(req);
    const service = base44.asServiceRole;

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (session?.metadata?.base44_test_checkout === 'true') {
        return Response.json({ received: true, ignored: 'teste interno da plataforma' });
      }
      if (session.payment_status !== 'paid') {
        console.log(`stripeWebhook: sessão ${session.id} ainda não paga (${session.payment_status})`);
        return Response.json({ received: true, ignored: 'pagamento não confirmado' });
      }
      const order = await findOrder(service, session);
      if (!order) {
        console.error(`stripeWebhook: pedido não encontrado para a sessão ${session.id}`);
        return Response.json({ received: true, ignored: 'pedido não encontrado' });
      }
      const result = await confirmOrderPayment(base44, order, {
        provider: 'stripe',
        reference: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        note: 'Pagamento confirmado pelo Stripe.',
      });
      if (result?.mismatch) {
        console.error(
          `stripeWebhook: divergência de valor no pedido ${order.order_number} — esperado ${result.expected}, recebido ${result.received}`
        );
        await service.entities.Order.update(order.id, {
          admin_notes: `${order.admin_notes ? `${order.admin_notes}\n` : ''}Atenção: valor pago diferente do total do pedido. Conferir manualmente.`,
        });
      }
      return Response.json({ received: true, order: order.order_number });
    }

    if (event.type === 'checkout.session.expired') {
      const order = await findOrder(service, session);
      if (order && order.payment_status !== 'paid') await expireOrder(base44, order, 'Sessão de pagamento expirou.');
      return Response.json({ received: true });
    }

    if (event.type === 'checkout.session.async_payment_failed' || event.type === 'payment_intent.payment_failed') {
      const order = session?.id ? await findOrder(service, session) : null;
      if (order && order.payment_status === 'pending') {
        await service.entities.Order.update(order.id, {
          payment_status: 'failed',
          admin_notes: `${order.admin_notes ? `${order.admin_notes}\n` : ''}Pagamento não aprovado pelo Stripe.`,
        });
      }
      return Response.json({ received: true });
    }

    if (event.type === 'charge.refunded') {
      const paymentIntent = event?.data?.object?.payment_intent;
      if (paymentIntent) {
        const { items } = await service.entities.Order.filter({ payment_reference: paymentIntent }, { limit: 1 });
        const order = items?.[0];
        if (order) {
          await cancelOrder(base44, order, 'Pagamento estornado pelo Stripe.');
          await service.entities.Order.update(order.id, { payment_status: 'refunded' });
        }
      }
      return Response.json({ received: true });
    }

    return Response.json({ received: true, ignored: event.type });
  } catch (error) {
    console.error('stripeWebhook falhou', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}