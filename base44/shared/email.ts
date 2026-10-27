const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// Resend accepts guest customers; Base44 Core.SendEmail only accepts registered users.
export async function sendPaymentEmail(service, order, getSecret, request = fetch) {
  if (order.confirmation_email_sent_at || order.payment_status !== 'paid') return;
  const key = getSecret('RESEND_API_KEY');
  const from = getSecret('ORDER_EMAIL_FROM');
  if (!key || !from) {
    await service.entities.Order.update(order.id, { confirmation_email_error: 'Configure RESEND_API_KEY e ORDER_EMAIL_FROM.' });
    return;
  }
  const text = [
    `Olá, ${order.customer_name}.`, `Pagamento confirmado para o pedido ${order.order_number}.`,
    `Produtos: ${money(order.subtotal)}`, `Frete: ${money(order.shipping_total)} (${order.shipping_method || 'a combinar'})`,
    `Total pago: ${money(order.total)}`, order.shipping_delivery_days != null ? `Prazo estimado de transporte: ${order.shipping_delivery_days} dias úteis após a postagem.` : '',
    'A loja dará sequência à preparação do seu pedido.',
  ].filter(Boolean).join('\n');
  try {
    const response = await request('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `payment-confirmed-${order.id}` },
      body: JSON.stringify({ from, to: [order.customer_email], subject: `Pagamento confirmado — ${order.order_number}`, text }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Resend: HTTP ${response.status}`);
    await service.entities.Order.update(order.id, { confirmation_email_sent_at: new Date().toISOString(), confirmation_email_error: '' });
  } catch (error) {
    await service.entities.Order.update(order.id, { confirmation_email_error: String(error.message).slice(0, 200) });
    // Non-2xx webhook response asks Stripe to retry; payment is already recorded safely.
    throw error;
  }
}
