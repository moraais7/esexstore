import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, formatDateTime } from "@/lib/format";

const STATUS_FILTERS = [
  { value: "todos", label: "Todos os status" },
  { value: "active", label: "Publicados" },
  { value: "draft", label: "Rascunhos" },
  { value: "archived", label: "Arquivados" },
];

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const buildQuery = () => {
    const query = {};
    if (search) query.name = { $regex: search, $options: "i" };
    if (statusFilter !== "todos") query.status = statusFilter;
    return query;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    base44.entities.Product.filter(buildQuery(), { sort: "-updated_date", limit: 30 })
      .then((page) => {
        if (!active) return;
        setProducts(page.items || []);
        setCursor(page.next_cursor || null);
        setHasMore(Boolean(page.has_more));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, statusFilter]);

  const loadMore = async () => {
    if (!cursor) return;
    const page = await base44.entities.Product.filter(buildQuery(), { sort: "-updated_date", limit: 30, cursor });
    setProducts((previous) => [...previous, ...(page.items || [])]);
    setCursor(page.next_cursor || null);
    setHasMore(Boolean(page.has_more));
  };

  const toggleVisibility = async (product) => {
    setBusyId(product.id);
    const nextVisible = !product.visible;
    try {
      await base44.entities.Product.update(product.id, {
        visible: nextVisible,
        status: nextVisible ? "active" : "draft",
      });
      setProducts((previous) =>
        previous.map((item) => (item.id === product.id ? { ...item, visible: nextVisible, status: nextVisible ? "active" : "draft" } : item))
      );
    } finally {
      setBusyId(null);
    }
  };

  const clearReview = async (product) => {
    setBusyId(product.id);
    try {
      await base44.entities.Product.update(product.id, { needs_review: false, review_notes: [] });
      setProducts((previous) => previous.map((item) => (item.id === product.id ? { ...item, needs_review: false, review_notes: [] } : item)));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (product) => {
    if (!window.confirm(`Excluir "${product.name}" e suas variações? Esta ação não pode ser desfeita.`)) return;
    setBusyId(product.id);
    try {
      await base44.entities.ProductVariant.deleteMany({ product_id: product.id });
      await base44.entities.Product.delete(product.id);
      setProducts((previous) => previous.filter((item) => item.id !== product.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-background/50">Catálogo</p>
          <h1 className="mt-2 font-heading text-3xl">Produtos</h1>
        </div>
        <Button asChild className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
          <Link to="/admin/produtos/novo">
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.8} /> Novo produto
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form
          className="flex flex-1 items-center gap-2 sm:max-w-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(term.trim());
          }}
        >
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar por nome"
            className="rounded-xl border-white/15 bg-white/5 text-background placeholder:text-background/40"
          />
          <Button type="submit" variant="outline" className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10">
            <Search className="h-4 w-4" strokeWidth={1.6} />
          </Button>
        </form>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[190px] rounded-xl border-white/15 bg-white/5 text-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto border border-white/10">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase tracking-[0.14em] text-background/50">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Estoque</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Atualizado</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-background/50">
                  Carregando produtos…
                </td>
              </tr>
            )}
            {!loading && !products.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-background/50">
                  Nenhum produto encontrado. Importe o CSV da Nuvemshop ou crie um produto manualmente.
                </td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-10 shrink-0 overflow-hidden border border-white/10 bg-white/5">
                      {product.images?.[0]?.url ? (
                        <img src={product.images[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-background/40">
                          sem foto
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="max-w-[280px] leading-snug">{product.name}</p>
                      <p className="mt-1 text-xs text-background/45">
                        {product.sku_default || "sem SKU"} · /{product.slug}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {product.is_demo && <span className="text-[10px] uppercase tracking-[0.14em] text-background/50">demonstração</span>}
                        {product.needs_review && <span className="text-[10px] uppercase tracking-[0.14em] text-gold">revisar</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {product.price_from ? brl(product.price_from_promo || product.price_from) : <span className="text-gold">a confirmar</span>}
                </td>
                <td className="px-4 py-4">{product.total_stock ?? 0}</td>
                <td className="px-4 py-4">
                  <span className="text-xs uppercase tracking-[0.14em] text-background/60">
                    {product.status === "active" ? "publicado" : product.status === "draft" ? "rascunho" : "arquivado"}
                  </span>
                </td>
                <td className="px-4 py-4 text-xs text-background/50">{formatDateTime(product.updated_date)}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {product.needs_review && (
                      <button
                        type="button"
                        onClick={() => clearReview(product)}
                        disabled={busyId === product.id}
                        className="inline-flex items-center gap-1 text-xs text-background/70 hover:text-background"
                        title="Marcar conteúdo como revisado"
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.6} /> revisado
                      </button>
                    )}
                    <Link to={`/admin/produtos/${product.id}`} className="inline-flex items-center gap-1 text-xs text-background/70 hover:text-background">
                      <Pencil className="h-4 w-4" strokeWidth={1.6} /> editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleVisibility(product)}
                      disabled={busyId === product.id}
                      className="inline-flex items-center gap-1 text-xs text-background/70 hover:text-background"
                    >
                      {product.visible ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
                      {product.visible ? "despublicar" : "publicar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(product)}
                      disabled={busyId === product.id}
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.6} /> excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10" onClick={loadMore}>
            Carregar mais produtos
          </Button>
        </div>
      )}
    </div>
  );
}