import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { secrets } from 'base44:runtime';
import { cartFingerprint, CheckoutError, loadCart, postalCode } from '../../shared/cart.ts';
import { getSettings, shippingOptions } from '../../shared/shipping.ts';

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const body = await req.json().catch(() => ({}));
    const service = createClientFromRequest(req).asServiceRole;
    const cart = await loadCart(service, body.items);
    const settings = await getSettings(service);
    const options = await shippingOptions(cart, body.postal_code, settings, name => secrets.get(name));
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await service.entities.ShippingQuote.create({ token, postal_code: postalCode(body.postal_code), cart_fingerprint: cartFingerprint(cart), subtotal: cart.subtotal, options, expires_at: expiresAt, checkout_order_id: '', settings_fingerprint: JSON.stringify([settings.shipping_provider, settings.shipping_origin_postal_code, settings.shipping_fixed_price, settings.shipping_fixed_days, settings.shipping_sandbox]), sandbox: settings.shipping_provider === 'melhor_envio' && settings.shipping_sandbox === true });
    return Response.json({ token, options, items: cart.orderItems, subtotal: cart.subtotal, expires_at: expiresAt, sandbox: settings.shipping_provider === 'melhor_envio' && settings.shipping_sandbox === true });
  } catch (error) {
    console.error('quoteShipping', error.message);
    return Response.json({ error: error instanceof CheckoutError ? error.message : 'Não foi possível calcular o frete. Tente novamente.' }, { status: error instanceof CheckoutError ? error.status : 500 });
  }
}
