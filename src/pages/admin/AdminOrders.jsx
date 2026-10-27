import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { brl, formatDateTime } from "@/lib/format";

const PAYMENT_FILTERS = [
  { value: "todos", label: "Todos os pagamentos" },
  { value: "pending", label: "Aguardando pagamento" },
  { value: "paid", label: "Pagos" },
  { value: "failed", label: "Falhas" },
  { value: "expired", label: "Expirados" },
];

const paymentLabel = {
  pending: "aguardando",
  paid: "pago",
  failed: "falhou",
  expired: "expirado",
  refunded: "estornado",
};

const statusLabel = {
  pending_payment: "aguardando pagamento",
  paid: "pago",
  shipping_quote: "frete a combinar",
  awaiting_shipment: "a enviar",
  shipped: "enviado",
  cancelled: "cancelado",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentFilter, setPaymentFilter] = useState("todos");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shipping, setShipping] = useState({ total: "", method: "", note: "" });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const query = paymentFilter === "todos" ? {} : { payment_status: paymentFilter };
    try {
      const page = await base44.entities.Order.filter(query, { sort: "-created_date", limit: 50 });
      setOrders(page.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentFilter]);

  const openOrder = (order) => {
    setSelected(order);
    setShipping({ total: order.shipping_total || "", method: order.shipping_method || "", note: "" });
    setNotes(order.admin_notes || "");
  };

  const runAction = async (action, payload = {}) => {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const response = await base44.functions.invoke("manageOrder", { order_id: selected.id, action, ...payload });
      const updated = response?.data?.order;
      if (updated) {
        setSelected(updated);
        setOrders((previous) => previous.map((order) => (order.id === updated.id ? updated : order)));
        setNotes(updated.admin_notes || "");
      }
    } catch (err) { setError(err?.response?.data?.error || err.message); } finally {
      setBusy(false);
    }
  };

  const field = "rounded-xl border-white/15 bg-white/5 text-background placeholder:text-background/40";
  const label = "text-[11px] uppercase tracking-[0.14em] text-background/50";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-background/50">Vendas</p>
          <h1 className="mt-2 font-heading text-3xl">Pedidos</h1>
        </div>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[220px] rounded-xl border-white/15 bg-white/5 text-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto border border-white/10">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
            <tr>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Itens</th>
              <th className="px-4 py-3">Total produtos</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Frete</th>
              <th className="px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-background/50">Carregando pedidos…</td>
              </tr>
            )}
            {!loading && !orders.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-background/50">Nenhum pedido neste filtro.</td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order.id} className="cursor-pointer hover:bg-white/[0.04]" onClick={() => openOrder(order)}>
                <td className="px-4 py-4">{order.order_number}</td>
                <td className="px-4 py-4">
                  <p>{order.customer_name}</p>
                  <p className="text-xs text-background/50">{order.customer_email}</p>
                </td>
                <td className="px-4 py-4">{order.items_count || 0}</td>
                <td className="px-4 py-4">{brl(order.total)}</td>
                <td className="px-4 py-4">
                  <Badge
                    variant="outline"
                    className={`rounded-xl border-white/20 text-[10px] uppercase tracking-[0.14em] ${
                      order.payment_status === "paid" ? "text-gold" : "text-background/60"
                    }`}
                  >
                    {paymentLabel[order.payment_status] || order.payment_status}
                  </Badge>
                </td>
                <td className="px-4 py-4 text-xs text-background/60">
                  {order.shipping_status === "quote_pending" ? "a combinar" : order.shipping_status}
                </td>
                <td className="px-4 py-4 text-xs text-background/50">{formatDateTime(order.created_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto bg-foreground text-background">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading text-2xl">Pedido {selected.order_number}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 text-sm">
                {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
                {selected.confirmation_email_error && <p className="text-xs text-destructive">E-mail: {selected.confirmation_email_error}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className={label}>Cliente</p>
                    <p className="mt-1">{selected.customer_name}</p>
                    <p className="text-xs text-background/60">{selected.customer_email}</p>
                    <p className="text-xs text-background/60">{selected.customer_phone}</p>
                    {selected.customer_document && <p className="text-xs text-background/60">Doc: {selected.customer_document}</p>}
                  </div>
                  <div>
                    <p className={label}>Entrega</p>
                    <p className="mt-1 text-xs leading-relaxed text-background/60">
                      {[
                        selected.shipping_address?.street,
                        selected.shipping_address?.number,
                        selected.shipping_address?.complement,
                        selected.shipping_address?.district,
                        selected.shipping_address?.city,
                        selected.shipping_address?.state,
                        selected.shipping_address?.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Endereço não informado"}
                    </p>
                  </div>
                </div>

                <div className="border border-white/10">
                  <div className="divide-y divide-white/10">
                    {(selected.items || []).map((item, index) => (
                      <div key={`${item.sku}-${index}`} className="flex items-start justify-between gap-4 px-4 py-3">
                        <div>
                          <p>{item.product_name}</p>
                          <p className="text-xs text-background/60">
                            {item.variant_label ? `${item.variant_label} · ` : ""}SKU {item.sku} · {item.quantity} × {brl(item.unit_price)}
                          </p>
                        </div>
                        <span>{brl(item.line_total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 border-t border-white/10 px-4 py-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-background/60">Produtos</span>
                      <span>{brl(selected.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-background/60">Frete registrado</span>
                      <span>{selected.shipping_status === "quote_pending" ? "não definido" : brl(selected.shipping_total)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{brl(selected.total)}</span>
                    </div>
                  </div>
                </div>

                {selected.notes && (
                  <div>
                    <p className={label}>Observações do cliente</p>
                    <p className="mt-1 text-xs leading-relaxed text-background/60">{selected.notes}</p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className={label}>Situação</p>
                    <p className="mt-1 text-xs">
                      {statusLabel[selected.status] || selected.status} · {paymentLabel[selected.payment_status] || selected.payment_status}
                    </p>
                    <p className="mt-1 text-xs text-background/60">
                      Referência de pagamento: {selected.payment_reference || "—"}
                    </p>
                    <p className="text-xs text-background/60">Pago em: {selected.paid_at ? formatDateTime(selected.paid_at) : "—"}</p>
                  </div>
                  <div className="space-y-3">
                    <Select value={selected.status} onValueChange={(value) => runAction("set_status", { status: value })}>
                      <SelectTrigger className={field}>
                        <SelectValue placeholder="Alterar situação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selected.status} disabled>{statusLabel[selected.status]}</SelectItem>
                        <SelectItem value="awaiting_shipment">A enviar</SelectItem>
                        <SelectItem value="shipped">Enviado</SelectItem>
                      </SelectContent>
                    </Select>
                    {["pending", "failed"].includes(selected.payment_status) && selected.status !== "cancelled" && (
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction("mark_paid")}
                        className="w-full rounded-xl bg-gold text-foreground hover:bg-gold/90"
                      >
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirmar pagamento manualmente
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/10 pt-5">
                  <p className={label}>Frete do pedido</p>
                  <p className="text-xs text-background/60">{selected.shipping_method || "Sem modalidade definida"}{selected.shipping_delivery_days != null ? ` · ${selected.shipping_delivery_days} dia(s) útil(eis)` : ""}. O valor fica bloqueado após a emissão do checkout.</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Valor do frete"
                      value={shipping.total}
                      onChange={(event) => setShipping({ ...shipping, total: event.target.value })}
                      className={field}
                    />
                    <Input
                      placeholder="Forma de envio"
                      value={shipping.method}
                      onChange={(event) => setShipping({ ...shipping, method: event.target.value })}
                      className={field}
                    />
                    <Input
                      placeholder="Observação"
                      value={shipping.note}
                      onChange={(event) => setShipping({ ...shipping, note: event.target.value })}
                      className={field}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10"
                    disabled={busy || Boolean(selected.payment_reference) || Boolean(selected.stock_reserved) || selected.payment_status === "paid"}
                    onClick={() =>
                      runAction("set_shipping", {
                        shipping_total: Number(shipping.total) || 0,
                        shipping_method: shipping.method,
                        shipping_status: "quoted",
                        note: shipping.note,
                      })
                    }
                  >
                    Salvar frete do pedido
                  </Button>
                </div>

                <div className="space-y-3 border-t border-white/10 pt-5">
                  <p className={label}>Anotações internas</p>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={field} />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10"
                      onClick={() => runAction("set_notes", { admin_notes: notes })}
                    >
                      Salvar anotações
                    </Button>
                    {selected.status !== "cancelled" && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        className="rounded-xl border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (window.confirm("Cancelar este pedido? O estoque reservado volta ao catálogo.")) runAction("cancel");
                        }}
                      >
                        Cancelar pedido
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}