import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, ImageOff, PackageCheck, Receipt, Tags, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { brl, formatDateTime } from "@/lib/format";

export default function AdminDashboard() {
  const { settings } = useStoreSettings();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [
        published,
        drafts,
        review,
        variants,
        pendingPayment,
        paid,
        paidSum,
        productPage,
        orderPage,
      ] = await Promise.all([
        base44.entities.Product.count({ visible: true, status: "active" }),
        base44.entities.Product.count({ status: "draft" }),
        base44.entities.Product.count({ needs_review: true }),
        base44.entities.ProductVariant.count(),
        base44.entities.Order.count({ payment_status: "pending" }),
        base44.entities.Order.count({ payment_status: "paid" }),
        base44.entities.Order.aggregate({ query: { payment_status: "paid" }, sum: ["total"] }),
        base44.entities.Product.filter({}, { sort: "-created_date", limit: 300 }),
        base44.entities.Order.list({ sort: "-created_date", limit: 6 }),
      ]);
      if (!active) return;
      const products = productPage.items || [];
      setStats({
        published,
        drafts,
        review,
        variants,
        pendingPayment,
        paid,
        paidTotal: paidSum?.rows?.[0]?.sum_total || 0,
        withoutImage: products.filter((product) => !(product.images || []).length).length,
        demoProducts: products.filter((product) => product.is_demo).length,
      });
      setOrders(Array.isArray(orderPage) ? orderPage : orderPage.items || []);
    };
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const cards = stats
    ? [
        { icon: PackageCheck, label: "Produtos publicados", value: stats.published, hint: `${stats.drafts} em rascunho` },
        { icon: Tags, label: "Variações cadastradas", value: stats.variants, hint: `${stats.review} produtos em revisão` },
        { icon: Receipt, label: "Pedidos aguardando pagamento", value: stats.pendingPayment, hint: `${stats.paid} pagos` },
        { icon: Truck, label: "Total confirmado", value: brl(stats.paidTotal), hint: "Somatório dos pedidos pagos" },
      ]
    : [];

  const pendencies = stats
    ? [
        { show: !settings.shipping_configured, text: "Frete ainda não configurado: o checkout combina o envio depois, sem cobrar entrega." },
        { show: stats.withoutImage > 0, text: `${stats.withoutImage} produtos sem foto — use a etapa de importação de imagens.` },
        { show: stats.review > 0, text: `${stats.review} produtos marcados para revisão (preço, descrição ou composição).` },
        { show: stats.demoProducts > 0, text: `${stats.demoProducts} registros de demonstração no catálogo — substituir pelo catálogo real.` },
      ].filter((item) => item.show)
    : [];

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-background/50">Painel</p>
        <h1 className="mt-2 font-heading text-3xl">Visão geral da loja</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full bg-white/10" />)}
        {!loading &&
          cards.map((card) => (
            <div key={card.label} className="border border-white/10 bg-white/[0.03] p-5">
              <card.icon className="h-4 w-4 text-gold" strokeWidth={1.5} />
              <p className="mt-4 font-heading text-2xl">{card.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-background/50">{card.label}</p>
              <p className="mt-2 text-xs text-background/40">{card.hint}</p>
            </div>
          ))}
      </div>

      {pendencies.length > 0 && (
        <div className="border border-gold/30 bg-gold/[0.06] p-6">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gold">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.6} /> Pendências antes de vender
          </p>
          <ul className="mt-4 space-y-2 text-sm text-background/80">
            {pendencies.map((item) => (
              <li key={item.text}>• {item.text}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="border border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-heading text-xl">Últimos pedidos</h2>
            <Link to="/admin/pedidos" className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-background/60 hover:text-background">
              Ver todos <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-background/50">Nenhum pedido registrado ainda.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
                  <div>
                    <p>{order.order_number}</p>
                    <p className="text-xs text-background/50">
                      {order.customer_name} · {formatDateTime(order.created_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p>{brl(order.total)}</p>
                    <p className="text-xs text-background/50">
                      {order.payment_status === "paid" ? "pago" : order.payment_status === "pending" ? "aguardando pagamento" : order.payment_status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="border border-white/10 p-5">
          <h2 className="font-heading text-xl">Atalhos</h2>
          <div className="mt-5 flex flex-col gap-3 text-sm">
            <Link to="/admin/importar" className="inline-flex items-center justify-between border-b border-white/10 pb-3 text-background/80 hover:text-background">
              Importar catálogo do CSV <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            <Link to="/admin/imagens" className="inline-flex items-center justify-between border-b border-white/10 pb-3 text-background/80 hover:text-background">
              Associar fotos aos produtos <ImageOff className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            <Link to="/admin/produtos" className="inline-flex items-center justify-between border-b border-white/10 pb-3 text-background/80 hover:text-background">
              Revisar produtos e preços <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
            <Link to="/admin/configuracoes" className="inline-flex items-center justify-between text-background/80 hover:text-background">
              WhatsApp, contato e avisos <ArrowRight className="h-4 w-4" strokeWidth={1.6} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}