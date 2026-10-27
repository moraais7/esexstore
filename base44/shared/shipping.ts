import { cartFingerprint, cents, CheckoutError, postalCode } from './cart.ts';

export const getSettings = async (service) => {
  const { items } = await service.entities.SiteSettings.filter({ key: 'main' }, { limit: 1 });
  return items?.[0] || {};
};

export async function shippingOptions(cart, destination, settings, getSecret, request = fetch) {
  const cep = postalCode(destination);
  if (!/^\d{8}$/.test(cep)) throw new CheckoutError('Informe um CEP com 8 dígitos.');
  if (!settings.shipping_configured) throw new CheckoutError('A loja ainda está configurando as entregas. Fale com o atendimento.', 503);
  if (settings.shipping_provider === 'fixed') {
    const price = settings.shipping_fixed_price;
    const days = settings.shipping_fixed_days;
    if (price === null || price === undefined || price === '' || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(days)) || Number(days) < 1) {
      throw new CheckoutError('A tarifa e o prazo de entrega precisam ser configurados pela loja.', 503);
    }
    return [{ id: 'fixed', name: 'Entrega da loja', company: '', price: cents(price) / 100, delivery_days: Number(days) }];
  }
  if (settings.shipping_provider !== 'melhor_envio') throw new CheckoutError('Selecione um serviço de frete nas configurações.', 503);
  const token = getSecret('MELHOR_ENVIO_TOKEN');
  const origin = postalCode(settings.shipping_origin_postal_code);
  const contact = getSecret('MELHOR_ENVIO_CONTACT');
  if (!token || !contact || !/^\d{8}$/.test(origin)) throw new CheckoutError('O serviço de frete ainda não está configurado.', 503);
  const products = cart.orderItems.map((item, index) => {
    const variant = cart.variants[index];
    if (['weight_kg', 'height_cm', 'width_cm', 'length_cm'].some(k => !Number.isFinite(Number(variant[k])) || Number(variant[k]) <= 0)) {
      throw new CheckoutError(`A loja precisa revisar peso e medidas de "${item.product_name}".`, 409);
    }
    return { id: item.variant_id, width: Number(variant.width_cm), height: Number(variant.height_cm), length: Number(variant.length_cm), weight: Number(variant.weight_kg), insurance_value: item.unit_price, quantity: item.quantity };
  });
  const sandbox = settings.shipping_sandbox === true;
  const response = await request(`https://${sandbox ? 'sandbox' : 'www'}.melhorenvio.com.br/api/v2/me/shipment/calculate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': `EsexStore (${contact})` },
    body: JSON.stringify({ from: { postal_code: origin }, to: { postal_code: cep }, products, options: { receipt: false, own_hand: false } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new CheckoutError('Não foi possível consultar o frete. Tente novamente.', 502);
  const result = await response.json();
  if (!Array.isArray(result)) throw new CheckoutError('Resposta inválida do serviço de frete.', 502);
  const options = result.filter(o => !o.error && o.id != null).map(o => ({
    id: String(o.id), name: String(o.name || 'Entrega'), company: String(o.company?.name || ''),
    price: o.custom_price !== '' && o.custom_price != null ? Number(o.custom_price) : o.price !== '' && o.price != null ? Number(o.price) : NaN, delivery_days: o.custom_delivery_time !== '' && o.custom_delivery_time != null ? Number(o.custom_delivery_time) : o.delivery_time !== '' && o.delivery_time != null ? Number(o.delivery_time) : NaN,
  })).filter(o => Number.isFinite(o.price) && o.price >= 0 && Number.isInteger(o.delivery_days) && o.delivery_days >= 0)
    .map(o => ({ ...o, price: cents(o.price) / 100 })).sort((a, b) => a.price - b.price);
  if (!options.length) throw new CheckoutError('Não há entrega disponível para este CEP. Fale com o atendimento.', 422);
  return options;
}

export async function resolveShipping(service, cart, body, address, settings) {
  const token = typeof body.shipping_quote_token === 'string' ? body.shipping_quote_token : '';
  if (!token || token.length > 100) throw new CheckoutError('Calcule e selecione o frete antes de pagar.');
  const { items } = await service.entities.ShippingQuote.filter({ token }, { limit: 1 });
  const quote = items?.[0];
  if (!quote || !Number.isFinite(Date.parse(quote.expires_at)) || Date.parse(quote.expires_at) < Date.now()) throw new CheckoutError('A cotação expirou. Calcule o frete novamente.', 409);
  if (!settings.shipping_configured || quote.settings_fingerprint !== JSON.stringify([settings.shipping_provider, settings.shipping_origin_postal_code, settings.shipping_fixed_price, settings.shipping_fixed_days, settings.shipping_sandbox])) {
    throw new CheckoutError('As condições de entrega mudaram. Calcule o frete novamente.', 409);
  }
  if (quote.postal_code !== address.postal_code || quote.cart_fingerprint !== cartFingerprint(cart)) {
    throw new CheckoutError('O CEP, os produtos ou os preços mudaram. Calcule o frete novamente.', 409);
  }
  const option = quote.options?.find(o => o.id === body.shipping_option_id);
  if (!option) throw new CheckoutError('Selecione uma opção de entrega válida.');
  return { quote, option };
}
