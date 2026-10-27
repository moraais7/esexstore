import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { publicOrderView } from '../../shared/orders.ts';

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || '').trim();
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return Response.json({ error: 'Sessão de pagamento inválida.' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const { items } = await base44.asServiceRole.entities.Order.filter({ payment_reference: sessionId }, { limit: 1 });
    const order = items?.[0];
    if (!order) return Response.json({ order: null });

    return Response.json({ order: publicOrderView(order) });
  } catch (error) {
    console.error('checkoutStatus falhou', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}