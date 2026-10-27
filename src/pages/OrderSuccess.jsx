import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, MessageCircle, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/context/CartContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { brl, whatsappLink } from "@/lib/format";

export default function OrderSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id") || "";
  const { settings } = useStoreSettings();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { removePurchased } = useCart();

  useEffect(() => {
    if (!sessionId) {
      setStatus("empty");
      return undefined;
    }
    let active = true;
    let attempts = 0;
    let timer;
    setError(null); setStatus("loading");

    const fetchStatus = async () => {
      if (!active) return;
      try {
        const response = await base44.functions.invoke("checkoutStatus", { session_id: sessionId });
        const data = response?.data || {};
        if (!active) return;
        if (data.order) {
          setOrder(data.order);
          setStatus("ready");
          if (["pending", "failed"].includes(data.order.payment_status) && data.order.status !== "cancelled" && attempts < 30) {
            attempts += 1;
            timer = window.setTimeout(fetchStatus, 4000);
          }
        } else {
          if (attempts < 10) { attempts += 1; timer = window.setTimeout(fetchStatus, 3000); } else setStatus("empty");
        }
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.error || err?.message || "Não foi possível consultar o pedido.");
        setStatus("error");
      }
    };

    fetchStatus();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [sessionId, refresh]);

  useEffect(() => {
    if (order?.payment_status !== "paid" || !sessionId) return;
    const key = `esex_completed_${sessionId}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
      removePurchased(order.items || []);
    } catch { /* Keep the cart when storage is unavailable. */ }
  }, [order, sessionId, removePurchased]);

  const wa = whatsappLink(
    settings.whatsapp_number,
    order ? `Olá! Acabei de fazer o pedido ${order.order_number} e gostaria de ajuda.` : settings.whatsapp_message
  );

  const failed = order && (["failed", "expired", "refunded"].includes(order.payment_status) || order.status === "cancelled");

  return (
    <div className="shell max-w-3xl py-14 lg:py-20">
      {status === "loading" && (
        <div className="space-y-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {(status === "empty" || status === "error") && (
        <div className="cine-panel p-12 text-center">
          <p className="eyebrow">Pedido</p>
          <h1 className="mt-3 font-heading text-3xl">Não encontramos os dados deste pedido</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error || "Abra o link enviado na finalização da compra ou fale com a loja pelo WhatsApp."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button type="button" variant="outline" onClick={() => setRefresh(n => n + 1)}>Consultar novamente</Button>
            <Button asChild className="rounded-xl">
              <Link to="/catalogo">Voltar ao catálogo</Link>
            </Button>
            {wa && (
              <Button asChild variant="outline" className="rounded-xl">
                <a href={wa} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
              </Button>
            )}
          </div>
        </div>
      )}

      {status === "ready" && order && (
        <div>
          <div className="flex items-center gap-3">
            {order.payment_status === "paid" ? (
              <CheckCircle2 className="h-6 w-6 text-gold" strokeWidth={1.5} />
            ) : failed ? <AlertCircle className="h-6 w-6 text-destructive" /> : (
              <Clock className="h-6 w-6 text-gold" strokeWidth={1.5} />
            )}
            <p className="eyebrow">{order.payment_status === "paid" ? "Pagamento confirmado" : failed ? "Pagamento não concluído ou estornado" : "Pagamento em processamento"}</p>
          </div>
          <h1 className="mt-4 font-heading text-3xl sm:text-4xl">
            {order.payment_status === "paid" ? `Obrigado, ${order.customer_name.split(" ")[0]}!` : `Pedido ${order.order_number} registrado`}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {order.payment_status === "paid"
              ? "Recebemos a confirmação do pagamento. Seu pedido seguirá para preparação e envio pela modalidade escolhida."
              : failed ? "Confira a situação com a loja ou volte ao carrinho para iniciar outra compra." : "Estamos aguardando a confirmação do Stripe. Use o botão Atualizar situação para consultar novamente, se necessário."}
          </p>

          <div className="cine-panel mt-10 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <span className="text-sm">Pedido</span>
              <span className="font-medium">{order.order_number}</span>
            </div>
            <div className="divide-y divide-border">
              {(order.items || []).map((item, index) => (
                <div key={`${item.sku}-${index}`} className="flex items-start justify-between gap-6 px-6 py-4 text-sm">
                  <div>
                    <p>{item.product_name}</p>
                    {item.variant_label && <p className="text-xs text-muted-foreground">{item.variant_label}</p>}
                    <p className="text-xs text-muted-foreground">{item.quantity} × {brl(item.unit_price)}</p>
                  </div>
                  <span>{brl(item.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-border px-6 py-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Produtos</span>
                <span>{brl(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span className="text-xs text-muted-foreground">{order.shipping_status === "quote_pending" ? "a combinar" : brl(order.shipping_total)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3 font-medium">
                <span>Total do pedido</span>
                <span>{brl(order.total)}</span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{order.shipping_method}{order.shipping_delivery_days != null ? ` · Prazo estimado: ${order.shipping_delivery_days} dia(s) útil(eis) após a postagem.` : ""}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            {order.payment_status !== "paid" && <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => setRefresh(n => n + 1)}>Atualizar situação</Button>}
            {wa && (
              <Button asChild className="h-12 rounded-xl">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" strokeWidth={1.6} /> Falar com a loja
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="h-12 rounded-xl">
              <Link to="/catalogo">Continuar comprando</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}