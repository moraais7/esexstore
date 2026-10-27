import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import { CURRENCY, buildOrderNumber, variantLabelOf, variantUnitPrice } from '../../shared/orders.ts';

const MAX_LINES = 20;
const MAX_QUANTITY = 10;

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) return Response.json({ error: 'O carrinho está vazio.' }, { status: 400 });
    if (rawItems.length > MAX_LINES) return Response.json({ error: 'Muitos itens diferentes no carrinho.' }, { status: 400 });

    const items = rawItems
      .map((item) => ({
        variant_id: String(item?.variant_id || '').trim(),
        quantity: Math.floor(Number(item?.quantity) || 0),
      }))
      .filter((item) => item.variant_id && item.quantity > 0 && item.quantity <= MAX_QUANTITY);
    if (!items.length) return Response.json({ error: 'Quantidades inválidas no carrinho.' }, { status: 400 });

    const customer = body.customer || {};
    const name = String(customer.name || '').trim().slice(0, 120);
    const email = String(customer.email || '').trim().slice(0, 160);
    const phone = String(customer.phone || '').trim().slice(0, 40);
    const document = String(customer.document || '').trim().slice(0, 40);
    if (!name || !email || !phone) {
      return Response.json({ error: 'Informe nome, e-mail e telefone para continuar.' }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: 'E-mail inválido.' }, { status: 400 });

    const service = base44.asServiceRole;
    const variantIds = items.map((item) => item.variant_id);
    const { items: variants } = await service.entities.ProductVariant.filter({ id: { $in: variantIds }, active: true }, { limit: 60 });
    const variantById = new Map((variants || []).map((variant) => [variant.id, variant]));

    const productIds = Array.from(new Set((variants || []).map((variant) => variant.product_id))).filter(Boolean);
    if (!productIds.length) return Response.json({ error: 'Um dos itens não está mais disponível.' }, { status: 409 });
    const { items: products } = await service.entities.Product.filter(
      { id: { $in: productIds }, visible: true, status: 'active' },
      { limit: 60 }
    );
    const productById = new Map((products || []).map((product) => [product.id, product]));

    const orderItems = [];
    const lineItems = [];
    let subtotal = 0;

    for (const item of items) {
      const variant = variantById.get(item.variant_id);
      if (!variant) return Response.json({ error: 'Um dos itens não está mais disponível. Atualize o carrinho.' }, { status: 409 });
      const product = productById.get(variant.product_id);
      if (!product) return Response.json({ error: 'Um dos produtos saiu do ar. Atualize o carrinho.' }, { status: 409 });

      const unitPrice = variantUnitPrice(variant);
      if (!unitPrice) {
        return Response.json({ error: `O produto "${product.name}" está com o preço em revisão.` }, { status: 409 });
      }
      if (Number(variant.stock || 0) < item.quantity) {
        return Response.json({ error: `Estoque insuficiente para "${product.name}".` }, { status: 409 });
      }

      const label = variantLabelOf(variant);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        variant_id: variant.id,
        sku: variant.sku,
        variant_label: label,
        unit_price: unitPrice,
        quantity: item.quantity,
        line_total: lineTotal,
      });
      lineItems.push({
        name: `${product.name}${label ? ` — ${label}` : ''}`.slice(0, 120),
        unit_amount: Math.round(unitPrice * 100),
        quantity: item.quantity,
      });
    }

    const shipping = body.shipping_address || {};
    const order = await service.entities.Order.create({
      order_number: buildOrderNumber(),
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      customer_document: document,
      items: orderItems,
      items_count: orderItems.reduce((total, item) => total + item.quantity, 0),
      subtotal,
      discount_total: 0,
      shipping_total: 0,
      total: subtotal,
      currency: 'BRL',
      status: 'pending_payment',
      payment_status: 'pending',
      payment_provider: 'stripe',
      shipping_status: 'quote_pending',
      shipping_address: {
        postal_code: String(shipping.postal_code || '').slice(0, 20),
        street: String(shipping.street || '').slice(0, 160),
        number: String(shipping.number || '').slice(0, 20),
        complement: String(shipping.complement || '').slice(0, 80),
        district: String(shipping.district || '').slice(0, 80),
        city: String(shipping.city || '').slice(0, 80),
        state: String(shipping.state || '').slice(0, 40),
        country: 'Brasil',
      },
      notes: String(customer.notes || '').slice(0, 500),
      stock_committed: false,
    });

    const appOrigin = req.headers.get('X-Base44-App-Url');
    if (!appOrigin) {
      console.error('createCheckout: header X-Base44-App-Url ausente');
      return Response.json({ error: 'Não foi possível montar o link de retorno do pagamento.' }, { status: 500 });
    }

    const stripeSecret = secrets.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      console.error('createCheckout: STRIPE_SECRET_KEY ausente');
      return Response.json({ error: 'O meio de pagamento ainda não está configurado.' }, { status: 500 });
    }

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `${appOrigin}/pedido/sucesso?session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${appOrigin}/carrinho`);
    params.set('customer_email', email);
    params.set('client_reference_id', order.id);
    params.set('metadata[base44_app_id]', secrets.get('BASE44_APP_ID') || '');
    params.set('metadata[order_id]', order.id);
    params.set('metadata[order_number]', order.order_number);
    lineItems.forEach((line, index) => {
      params.set(`line_items[${index}][price_data][currency]`, CURRENCY);
      params.set(`line_items[${index}][price_data][product_data][name]`, line.name);
      params.set(`line_items[${index}][price_data][unit_amount]`, String(line.unit_amount));
      params.set(`line_items[${index}][quantity]`, String(line.quantity));
    });

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Stripe-Version': '2025-10-29.clover',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: params.toString(),
      signal: AbortSignal.timeout(20000),
    });
    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error('createCheckout: falha no Stripe', session?.error?.message);
      await service.entities.Order.update(order.id, {
        status: 'cancelled',
        payment_status: 'failed',
        admin_notes: `Falha ao abrir o pagamento: ${session?.error?.message || 'erro desconhecido'}`,
      });
      return Response.json({ error: 'Não foi possível iniciar o pagamento. Tente novamente.' }, { status: 502 });
    }

    await service.entities.Order.update(order.id, {
      payment_reference: session.id,
      checkout_url: session.url || '',
    });

    return Response.json({ url: session.url, order_id: order.id, order_number: order.order_number });
  } catch (error) {
    console.error('createCheckout falhou', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}