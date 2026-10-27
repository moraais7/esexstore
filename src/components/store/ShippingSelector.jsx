import React, { useId } from 'react';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { brl } from '@/lib/format';

export default function ShippingSelector({ shipping, postalCode, onPostalCodeChange, showInput = true }) {
  const id = useId();
  return (
    <section className="space-y-3 border-t border-border pt-5" aria-label="Opções de entrega">
      <p className="flex items-center gap-2 text-sm font-medium"><Truck className="h-4 w-4 text-gold" /> Entrega</p>
      <div className="flex items-end gap-2">
        {showInput && <div className="flex-1"><label htmlFor={id} className="text-xs text-muted-foreground">CEP de entrega</label><Input id={id} value={postalCode} onChange={e => onPostalCodeChange(e.target.value)} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" maxLength={9} className="mt-1 rounded-xl" /></div>}
        <Button type="button" variant="outline" className="rounded-xl" disabled={shipping.loading} onClick={shipping.calculate}>{shipping.loading ? 'Calculando…' : 'Calcular frete'}</Button>
      </div>
      <div aria-live="polite">
        {shipping.error && <p role="alert" className="text-xs text-destructive">{shipping.error}</p>}
        {shipping.expired && <p className="text-xs text-muted-foreground">A cotação expirou. Calcule novamente.</p>}
        {shipping.quote?.sandbox && <p className="mb-2 text-xs text-destructive">Cotação de teste. Indisponível para compras reais.</p>}
        {shipping.quote && <fieldset className="space-y-2"><legend className="sr-only">Escolha a entrega</legend>{shipping.quote.options.map(option => (
          <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
            <input type="radio" name={`shipping-${id}`} value={option.id} checked={shipping.selectedId === option.id} onChange={() => shipping.setSelectedId(option.id)} className="mt-1 accent-current" />
            <span className="flex-1"><span className="block">{[option.company, option.name].filter(Boolean).join(' — ')}</span><span className="text-xs text-muted-foreground">{option.delivery_days} dia(s) útil(eis) após a postagem</span></span>
            <span className="whitespace-nowrap font-medium">{option.price === 0 ? 'Grátis' : brl(option.price)}</span>
          </label>
        ))}</fieldset>}
      </div>
    </section>
  );
}
