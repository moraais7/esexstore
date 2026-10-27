import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { secrets } from 'base44:runtime';
import { buildOrderNumber, cancelOrder, reserveOrderStock } from '../../shared/orders.ts';
import { cents, CheckoutError, loadCart, normalizeItems, validateCustomer } from '../../shared/cart.ts';
import { getSettings, resolveShipping } from '../../shared/shipping.ts';

export default async function (req) {
  let order;
  let base44;
  let stripeAttempted = false;
  let lockToken;
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const body = await req.json().catch(() => ({}));
    const customer = validateCustomer(body.customer, body.shipping_address);
    const items = normalizeItems(body.items);
    const stripeSecret = secrets.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) throw new CheckoutError('O pagamento ainda não está configurado.', 503);
    const appUrl = secrets.get('STORE_PUBLIC_URL') || req.headers.get('X-Base44-App-Url');
    let origin;
    try {
      const url = new URL(appUrl);
      if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error();
      origin = url.origin;
    } catch { throw new CheckoutError('O endereço de retorno do pagamento precisa ser configurado.', 503); }
    base44 = createClientFromRequest(req);
    const service = base44.asServiceRole;
    const settings = await getSettings(service);
    if (!settings.payments_configured) throw new CheckoutError('O pagamento ainda não foi habilitado pela loja.', 503);
    const fingerprint = JSON.stringify({ items, customer, option: body.shipping_option_id });
    const token = typeof body.shipping_quote_token === 'string' ? body.shipping_quote_token : '';
    const previous = token && token.length <= 100 ? await service.entities.ShippingQuote.filter({ token }, { limit: 1 }) : null;
    const previousId = previous?.items?.[0]?.checkout_order_id;
    if (previousId && previousId !== 'creating') {
      order = await service.entities.Order.get(previousId);
      if (order.checkout_fingerprint !== fingerprint) throw new CheckoutError('Os dados mudaram. Calcule o frete novamente.', 409);
      if (order.payment_status !== 'pending' || order.status === 'cancelled' || Date.parse(order.checkout_expires_at) <= Date.now()) throw new CheckoutError('Este pagamento já foi concluído ou expirou. Calcule o frete novamente.', 409);
      if (order.checkout_url) return Response.json({ url: order.checkout_url, order_id: order.id, order_number: order.order_number });
    } else {
      const cart = await loadCart(service, items);
      const { quote, option } = await resolveShipping(service, cart, body, customer.shipping, settings);
      if (stripeSecret.startsWith('sk_live_') && quote.sandbox) throw new CheckoutError('Frete em teste não pode ser usado em pagamentos reais.', 409);
      const claimed = await service.entities.ShippingQuote.updateMany(
        { id: quote.id, checkout_order_id: '' }, { $set: { checkout_order_id: 'creating' } }
      );
      if (claimed.updated !== 1) throw new CheckoutError('Esta cotação está sendo utilizada. Aguarde e tente novamente ou recalcule o frete.', 409);
      order = await service.entities.Order.create({
        order_number: buildOrderNumber(), customer_name: customer.name, customer_email: customer.email,
        customer_phone: customer.phone, customer_document: customer.document, notes: customer.notes,
        items: cart.orderItems, items_count: items.reduce((n, i) => n + i.quantity, 0), subtotal: cart.subtotal,
        discount_total: 0, shipping_total: option.price, total: (cents(cart.subtotal) + cents(option.price)) / 100,
        currency: 'BRL', status: 'pending_payment', payment_status: 'pending', payment_provider: 'stripe',
        shipping_status: 'quoted', shipping_method: [option.company, option.name].filter(Boolean).join(' — '),
        shipping_delivery_days: option.delivery_days, shipping_address: customer.shipping,
        stock_committed: false, stock_reserved: false, checkout_lock_until: 0, checkout_lock_token: "", checkout_fingerprint: fingerprint, checkout_cancel_token: crypto.randomUUID(),
        checkout_origin: origin, checkout_expires_at: new Date(Date.now() + 31 * 60 * 1000).toISOString(),
      });
      await service.entities.ShippingQuote.update(quote.id, { checkout_order_id: order.id });
    }
    lockToken = crypto.randomUUID();
    const locked = await service.entities.Order.updateMany(
      { id: order.id, checkout_lock_until: { $lte: Date.now() }, payment_status: 'pending', status: { $ne: 'cancelled' } },
      { $set: { checkout_lock_until: Date.now() + 180000, checkout_lock_token: lockToken } }
    );
    if (locked.updated !== 1) throw new CheckoutError('O pagamento está sendo preparado. Aguarde e tente novamente.', 409);
    const params = new URLSearchParams({
      mode: 'payment', locale: 'pt-BR', customer_email: order.customer_email,
      success_url: `${order.checkout_origin}/pedido/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${order.checkout_origin}/checkout?cancelled=1&cancel_token=${order.checkout_cancel_token}`, client_reference_id: order.id,
      expires_at: String(Math.floor(Date.parse(order.checkout_expires_at) / 1000)),
      'metadata[base44_app_id]': secrets.get('BASE44_APP_ID') || '',
      'metadata[order_id]': order.id, 'metadata[order_number]': order.order_number,
      'payment_intent_data[metadata][order_id]': order.id,
      'payment_intent_data[metadata][base44_app_id]': secrets.get('BASE44_APP_ID') || '',
    });
    order.items.forEach((item, index) => {
      params.set(`line_items[${index}][price_data][currency]`, 'brl');
      params.set(`line_items[${index}][price_data][product_data][name]`, `${item.product_name}${item.variant_label ? ` — ${item.variant_label}` : ''}`.slice(0, 120));
      params.set(`line_items[${index}][price_data][unit_amount]`, String(cents(item.unit_price)));
      params.set(`line_items[${index}][quantity]`, String(item.quantity));
    });
    params.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
    params.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(cents(order.shipping_total)));
    params.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'brl');
    params.set('shipping_options[0][shipping_rate_data][display_name]', order.shipping_method.slice(0, 100));
    stripeAttempted = true;
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST', headers: { Authorization: `Bearer ${stripeSecret}`, 'Stripe-Version': '2025-10-29.clover', 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `checkout-${order.id}` },
      body: params.toString(), signal: AbortSignal.timeout(20000),
    });
    const session = await response.json();
    if (!response.ok) {
      // 5xx is ambiguous: retry with the same idempotency key, keeping the reservation.
      if (response.status < 500 && ![409, 429].includes(response.status) && !order.payment_reference) {
        await cancelOrder(base44, order, 'Falha ao iniciar o pagamento.');
        await service.entities.Order.update(order.id, { payment_status: 'failed' });
      }
      throw new CheckoutError('Não foi possível abrir o pagamento. Tente novamente; se persistir, recalcule o frete.', 502);
    }
    if (!session.url || !session.id) throw new CheckoutError('Resposta incompleta do pagamento. Tente novamente.', 502);
    // Persist a recoverable Stripe reference before touching stock. A timeout
    // before session creation can never strand a reservation without a session.
    const referenced = await service.entities.Order.updateMany(
      { id: order.id, checkout_lock_token: lockToken, payment_status: 'pending', status: { $ne: 'cancelled' } },
      { $set: { payment_reference: session.id, stock_reserved: true } }
    );
    if (referenced.updated !== 1) throw new CheckoutError('A tentativa mudou de estado. Confira o pedido antes de continuar.', 409);
    order = await service.entities.Order.get(order.id);
    try {
      await reserveOrderStock(base44, order);
    } catch (stockError) {
      // The URL has not been returned. Close it before rolling back any partial
      // reservation. If Stripe is unreachable, keep the reference for recovery.
      const closed = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}/expire`, {
        method: 'POST', headers: { Authorization: `Bearer ${stripeSecret}` }, signal: AbortSignal.timeout(10000),
      });
      if (closed.ok) await cancelOrder(base44, order, 'Não foi possível reservar todos os produtos.');
      throw new CheckoutError(closed.ok ? 'O estoque mudou. Atualize o carrinho e calcule o frete novamente.' : 'A loja precisa conferir a tentativa de pagamento. Tente novamente em instantes.', 409);
    }
    const ready = await service.entities.Order.updateMany(
      { id: order.id, checkout_lock_token: lockToken, payment_status: 'pending', status: { $ne: 'cancelled' }, stock_committed: true },
      { $set: { checkout_url: session.url } }
    );
    if (ready.updated !== 1) throw new CheckoutError('Não foi possível liberar o checkout. Confira a situação do pedido.', 409);
    return Response.json({ url: session.url, order_id: order.id, order_number: order.order_number });
  } catch (error) {
    console.error('createCheckout', error.message);
    if (order && base44 && !stripeAttempted && !(error instanceof CheckoutError)) {
      await cancelOrder(base44, order, 'Não foi possível reservar os produtos.').catch(e => console.error('rollback', e.message));
    }
    return Response.json({ error: error instanceof CheckoutError ? error.message : 'Não foi possível iniciar o pagamento. Verifique o estoque e tente novamente.' }, { status: error instanceof CheckoutError ? error.status : 500 });
  } finally {
    if (order && base44 && lockToken) await base44.asServiceRole.entities.Order.updateMany(
      { id: order.id, checkout_lock_token: lockToken },
      { $set: { checkout_lock_until: 0, checkout_lock_token: '' } }
    ).catch(error => console.error('checkout lock release', error.message));
  }
}
