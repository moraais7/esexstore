import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductMedia from "@/components/store/ProductMedia";
import { useCart } from "@/context/CartContext";
import ShippingSelector from "@/components/store/ShippingSelector";
import { savedShippingCep, useShipping } from "@/hooks/useShipping";
import { brl } from "@/lib/format";

export default function Cart() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const [postalCode, setPostalCode] = useState(savedShippingCep);
  const shipping = useShipping(items, postalCode);

  const displayItems = items.map(item => ({ ...item, ...shipping.quote?.items?.find(line => line.variant_id === item.variant_id) }));

  if (!items.length) {
    return (
      <div className="shell py-24 text-center">
        <p className="eyebrow">Carrinho</p>
        <h1 className="mt-3 font-heading text-3xl">Seu carrinho está vazio</h1>
        <p className="mt-3 text-sm text-muted-foreground">Escolha um produto para começar.</p>
        <Button asChild className="mt-8 rounded-xl">
          <Link to="/catalogo">Ver catálogo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="shell py-14 lg:py-20">
      <p className="eyebrow">Carrinho</p>
      <h1 className="mt-2 font-heading text-3xl sm:text-4xl">Sua seleção</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_360px]">
        <div className="divide-y divide-border border-t border-border">
          {displayItems.map((item) => (
            <div key={item.variant_id} className="flex gap-5 py-6">
              <Link to={`/produto/${item.product_slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-clay">
                <ProductMedia src={item.image_url} alt={item.product_name} placeholderLabel="Foto" />
              </Link>
              <div className="flex flex-1 flex-col justify-between gap-3">
                <div>
                  <Link to={`/produto/${item.product_slug}`} className="font-heading text-lg leading-snug hover:opacity-70">
                    {item.product_name}
                  </Link>
                  {item.variant_label && <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.variant_label}</p>}
                  {item.sku && <p className="mt-1 text-xs text-muted-foreground">SKU {item.sku}</p>}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center rounded-full border border-border">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={() => updateQuantity(item.variant_id, item.quantity - 1)}
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                    <span className="w-10 text-center text-sm">{item.quantity}</span>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                      onClick={() => updateQuantity(item.variant_id, Math.min(item.quantity + 1, item.max_stock || 10, 10))}
                      disabled={item.quantity >= Math.min(item.max_stock || 10, 10)}
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                  </div>
                  <div className="flex items-center gap-5">
                    <span className="text-sm">{brl(item.unit_price * item.quantity)}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.variant_id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="cine-panel h-fit p-6 lg:sticky lg:top-32">
          <h2 className="font-heading text-2xl">Resumo</h2>
          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{brl(shipping.quote?.subtotal ?? subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete</span>
              <span className="text-right text-xs text-muted-foreground">{shipping.option ? brl(shipping.option.price) : "calcule abaixo"}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 font-medium">
              <span>{shipping.option ? "Total" : "Subtotal de produtos"}</span>
              <span>{brl((shipping.quote?.subtotal ?? subtotal) + (shipping.option?.price || 0))}</span>
            </div>
          </div>
          <div className="mt-4"><ShippingSelector shipping={shipping} postalCode={postalCode} onPostalCodeChange={setPostalCode} /></div>
          <Button asChild className="mt-6 h-12 w-full rounded-xl">
            <Link to="/checkout">Finalizar compra</Link>
          </Button>
          <Button asChild variant="ghost" className="mt-2 h-11 w-full rounded-xl">
            <Link to="/catalogo">Continuar comprando</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}