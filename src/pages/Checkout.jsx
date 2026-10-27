import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Lock, ShieldCheck, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ProductMedia from "@/components/store/ProductMedia";
import { useCart } from "@/context/CartContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { brl } from "@/lib/format";

const FIELDS = [
  { name: "name", label: "Nome completo", required: true, autoComplete: "name" },
  { name: "email", label: "E-mail", type: "email", required: true, autoComplete: "email" },
  { name: "phone", label: "Telefone / WhatsApp", required: true, autoComplete: "tel" },
  { name: "document", label: "CPF (opcional)", autoComplete: "off" },
  { name: "postal_code", label: "CEP", required: true, autoComplete: "postal-code" },
  { name: "street", label: "Endereço", required: true, autoComplete: "address-line1" },
  { name: "number", label: "Número", required: true },
  { name: "complement", label: "Complemento" },
  { name: "district", label: "Bairro" },
  { name: "city", label: "Cidade", required: true, autoComplete: "address-level2" },
  { name: "state", label: "Estado", required: true, autoComplete: "address-level1" },
];

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { settings } = useStoreSettings();
  const [form, setForm] = useState({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!items.length) return;
    const missing = FIELDS.filter((field) => field.required && !String(form[field.name] || "").trim());
    if (missing.length) {
      setError(`Preencha ${missing.map((field) => field.label.toLowerCase()).join(", ")}.`);
      return;
    }

    const isFramed = window.self !== window.top;
    const checkoutTab = isFramed ? window.open("", "_blank") : null;
    if (isFramed && !checkoutTab) {
      setError("Libere pop-ups para continuar o pagamento.");
      return;
    }
    if (checkoutTab) checkoutTab.opener = null;

    setSubmitting(true);
    try {
      const response = await base44.functions.invoke("createCheckout", {
        items: items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          document: form.document,
          notes,
        },
        shipping_address: {
          postal_code: form.postal_code,
          street: form.street,
          number: form.number,
          complement: form.complement,
          district: form.district,
          city: form.city,
          state: form.state,
        },
      });
      const data = response?.data || {};
      if (!data.url) throw new Error(data.error || "Não foi possível iniciar o pagamento.");
      clear();
      if (checkoutTab) checkoutTab.location.replace(data.url);
      else window.location.assign(data.url);
    } catch (err) {
      if (checkoutTab) checkoutTab.close();
      setError(
        err?.response?.data?.error || err?.message || "Não foi possível iniciar o pagamento. Tente novamente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <div className="shell py-24 text-center">
        <p className="eyebrow">Checkout</p>
        <h1 className="mt-3 font-heading text-3xl">Nada para finalizar</h1>
        <p className="mt-3 text-sm text-muted-foreground">Seu carrinho está vazio.</p>
        <Button asChild className="mt-8 rounded-xl">
          <Link to="/catalogo">Ver catálogo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="shell py-14 lg:py-20">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-2 font-heading text-3xl sm:text-4xl">Dados para entrega e contato</h1>

      <form onSubmit={handleSubmit} className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <div className="grid gap-5 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.name} className={field.name === "street" || field.name === "complement" ? "sm:col-span-2" : ""}>
                <Label htmlFor={field.name} className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {field.label}
                </Label>
                <Input
                  id={field.name}
                  type={field.type || "text"}
                  autoComplete={field.autoComplete}
                  value={form[field.name] || ""}
                  onChange={(event) => update(field.name, event.target.value)}
                  className="mt-2 rounded-xl"
                  required={field.required}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Label htmlFor="notes" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Observações do pedido
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-2 rounded-xl"
                rows={3}
                placeholder="Preferências de entrega, horário, referências…"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-8">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-gold" strokeWidth={1.6} />
              <div>
                <p className="text-sm font-medium">Pagamento pelo Stripe</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Você será levado para o ambiente seguro do Stripe para concluir o pagamento com cartão.
                  {settings.payments_configured ? " O ambiente está em modo de teste até a loja entrar no ar." : ""}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 h-4 w-4 text-gold" strokeWidth={1.6} />
              <div>
                <p className="text-sm font-medium">Frete ainda não calculado</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{settings.shipping_note}</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="cine-panel h-fit p-6 lg:sticky lg:top-32">
          <h2 className="font-heading text-2xl">Resumo do pedido</h2>
          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <div key={item.variant_id} className="flex gap-4">
                <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-clay">
                  <ProductMedia src={item.image_url} alt={item.product_name} placeholderLabel="" />
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-snug">{item.product_name}</p>
                  {item.variant_label && <p className="text-xs text-muted-foreground">{item.variant_label}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.quantity} × {brl(item.unit_price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{brl(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frete</span>
              <span className="text-xs text-muted-foreground">a combinar</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 font-medium">
              <span>Total de produtos</span>
              <span>{brl(subtotal)}</span>
            </div>
          </div>

          {error && <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}

          <Button type="submit" className="mt-6 h-12 w-full rounded-xl" disabled={submitting}>
            {submitting ? (
              "Abrindo o pagamento…"
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" strokeWidth={1.6} /> Ir para o pagamento
              </>
            )}
          </Button>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Ao continuar, seus dados de contato e endereço são enviados com o pedido. Os valores são recalculados no servidor
            a partir do catálogo antes de gerar o pagamento.
          </p>
        </aside>
      </form>
    </div>
  );
}