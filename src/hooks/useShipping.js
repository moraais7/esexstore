import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

export const savedShippingCep = () => {
  try { return window.sessionStorage.getItem('esex_shipping_cep') || ''; } catch { return ''; }
};

export function useShipping(items, postalCode) {
  const key = JSON.stringify([String(postalCode || '').replace(/\D/g, ''), items.map(i => [i.variant_id, i.quantity, i.unit_price])]);
  const currentKey = useRef(key);
  currentKey.current = key;
  const sequence = useRef(0);
  const [quote, setQuote] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    sequence.current += 1;
    setQuote(null); setSelectedId(''); setError(''); setLoading(false);
  }, [key]);
  useEffect(() => {
    if (!quote) return undefined;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, Date.parse(quote.expires_at) - Date.now() + 50));
    return () => window.clearTimeout(timeout);
  }, [quote]);
  useEffect(() => () => { sequence.current += 1; }, []);

  const valid = quote?.key === key && Date.parse(quote.expires_at) > Math.max(now, Date.now());
  const option = valid ? quote.options.find(o => o.id === selectedId) : null;
  const calculate = async () => {
    const requestedKey = key;
    const requestId = ++sequence.current;
    setLoading(true); setError(''); setQuote(null); setSelectedId('');
    try {
      const cep = String(postalCode || '').replace(/\D/g, '');
      if (!/^\d{8}$/.test(cep)) throw new Error('Informe um CEP com 8 dígitos.');
      const { data } = await base44.functions.invoke('quoteShipping', { postal_code: cep, items: items.map(i => ({ variant_id: i.variant_id, quantity: i.quantity })) });
      if (currentKey.current !== requestedKey || requestId !== sequence.current) return;
      if (!data?.token || !data.options?.length) throw new Error(data?.error || 'Nenhuma opção de entrega disponível.');
      setQuote({ ...data, key: requestedKey });
      setSelectedId(data.options[0].id);
      try { window.sessionStorage.setItem('esex_shipping_cep', cep); } catch { /* optional */ }
    } catch (err) {
      if (currentKey.current === requestedKey && requestId === sequence.current) setError(err?.response?.data?.error || err.message || 'Não foi possível calcular o frete.');
    } finally {
      if (requestId === sequence.current) setLoading(false);
    }
  };
  return { quote: valid ? quote : null, option, selectedId, setSelectedId, calculate, loading, error, expired: quote?.key === key && !valid };
}
