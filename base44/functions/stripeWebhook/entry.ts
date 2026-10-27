import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { secrets } from 'base44:runtime';
import { sendPaymentEmail } from '../../shared/email.ts';
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
  if (!timestamp || !Number.isFinite(Number(timestamp))) return false;
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
    const appId = secrets.get('BASE44_APP_ID');
    if (event.type?.startsWith('checkout.session.') && session.metadata?.base44_app_id !== appId) return Response.json({ received: true, ignored: 'outro app' });
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
      if (order.payment_reference && order.payment_reference !== session.id) return Response.json({ error: 'Sessão não corresponde ao pedido.' }, { status: 409 });
      const result = await confirmOrderPayment(base44, order, {
        provider: 'stripe',
        reference: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '',
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
      if (result.ok && result.order) await sendPaymentEmail(service, result.order, name => secrets.get(name));
      return Response.json({ received: true, order: order.order_number });
    }

    if (event.type === 'checkout.session.expired') {
      const order = await findOrder(service, session);
      if (order && (!order.payment_reference || order.payment_reference === session.id) && order.payment_status !== 'paid') await expireOrder(base44, order, 'Sessão de pagamento expirou.');
      return Response.json({ received: true });
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const order = session?.id ? await findOrder(service, session) : null;
      if (order && (!order.payment_reference || order.payment_reference === session.id) && order.payment_status === 'pending') {
        await cancelOrder(base44, order, 'Pagamento não aprovado pelo Stripe.');
        await service.entities.Order.update(order.id, { payment_status: 'failed' });
      }
      return Response.json({ received: true });
    }

    if (event.type === 'charge.refunded' && session.refunded === true) {
      const paymentIntent = event?.data?.object?.payment_intent;
      if (paymentIntent) {
        const { items } = await service.entities.Order.filter({ payment_intent: paymentIntent }, { limit: 1 });
        let order = items?.[0];
        if (!order) {
          const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntent)}`, { headers: { Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}` }, signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error('Não foi possível consultar o estorno.');
          const intent = await response.json();
          if (intent.metadata?.base44_app_id === appId && intent.metadata?.order_id) order = await service.entities.Order.get(intent.metadata.order_id);
        }
        if (order) {
          await cancelOrder(base44, order, 'Estorno integral confirmado pelo Stripe.');
          await service.entities.Order.update(order.id, { payment_status: 'refunded' });
        }
      }
      return Response.json({ received: true });
    }

    return Response.json({ received: true, ignored: event.type });
  } catch (error) {
    console.error('stripeWebhook falhou', error?.message);
    return Response.json({ error: 'Falha temporária ao processar o evento.' }, { status: 500 });
  }
}