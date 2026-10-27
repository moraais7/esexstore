import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { secrets } from 'base44:runtime';
import { expireOrder } from '../../shared/orders.ts';

// Possession of the random cancellation token only permits closing this unpaid checkout.
export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token : '';
    if (!/^[0-9a-f-]{36}$/.test(token)) return Response.json({ error: 'Link inválido.' }, { status: 400 });
    const base44 = createClientFromRequest(req);
    const { items } = await base44.asServiceRole.entities.Order.filter({ checkout_cancel_token: token }, { limit: 1 });
    const order = items?.[0];
    if (!order || order.payment_status === 'paid' || order.payment_status === 'refunded') return Response.json({ cancelled: false });
    if (order.payment_status === 'expired') {
      await expireOrder(base44, order, 'Checkout encerrado.');
      return Response.json({ cancelled: true });
    }
    if (!order.payment_reference?.startsWith('cs_')) return Response.json({ error: 'Confira a situação do pedido com a loja.' }, { status: 409 });
    const url = `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(order.payment_reference)}`;
    const headers = { Authorization: `Bearer ${secrets.get('STRIPE_SECRET_KEY')}` };
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Stripe indisponível');
    const session = await response.json();
    if (session.status === 'complete') return Response.json({ cancelled: false });
    if (session.status === 'open') {
      const expired = await fetch(`${url}/expire`, { method: 'POST', headers, signal: AbortSignal.timeout(10000) });
      if (!expired.ok) throw new Error('Não foi possível encerrar a sessão');
    } else if (session.status !== 'expired') return Response.json({ cancelled: false });
    await expireOrder(base44, order, 'Pagamento encerrado pelo cliente.');
    return Response.json({ cancelled: true });
  } catch (error) {
    console.error('cancelCheckout', error.message);
    return Response.json({ error: 'Não foi possível encerrar a tentativa anterior. Aguarde ou fale com a loja.' }, { status: 502 });
  }
}
