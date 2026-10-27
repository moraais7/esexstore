import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/store/ProductCard";

const SORTS = [
  { value: "recentes", label: "Novidades" },
  { value: "preco-asc", label: "Menor preço" },
  { value: "preco-desc", label: "Maior preço" },
  { value: "nome", label: "Nome (A–Z)" },
];

const SORT_MAP = {
  recentes: "-created_date",
  "preco-asc": "price_from",
  "preco-desc": "-price_from",
  nome: "name",
};

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const categoria = params.get("categoria") || "";
  const ordenar = params.get("ordenar") || "recentes";
  const min = params.get("min") || "";
  const max = params.get("max") || "";

  const [term, setTerm] = useState(q);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => setTerm(q), [q]);

  useEffect(() => {
    base44.entities.Category.filter({ active: true }, { sort: "sort_order", limit: 60 })
      .then(({ items }) => setCategories(items || []))
      .catch(() => setCategories([]));
  }, []);

  const query = useMemo(() => {
    const built = { visible: true, status: "active" };
    if (q) built.name = { $regex: q, $options: "i" };
    if (categoria) built.categories = categoria;
    if (min || max) {
      built.price_from = {};
      if (min) built.price_from.$gte = Number(min);
      if (max) built.price_from.$lte = Number(max);
    }
    return built;
  }, [q, categoria, min, max]);

  const sortValue = SORT_MAP[ordenar] || SORT_MAP.recentes;

  useEffect(() => {
    let active = true;
    setLoading(true);
    base44.entities.Product.filter(query, { sort: sortValue, limit: 24 })
      .then((page) => {
        if (!active) return;
        setProducts(page.items || []);
        setCursor(page.next_cursor || null);
        setHasMore(Boolean(page.has_more));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    base44.entities.Product.count(query)
      .then((value) => {
        if (active) setTotal(value);
      })
      .catch(() => {
        if (active) setTotal(null);
      });
    return () => {
      active = false;
    };
  }, [query, sortValue]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await base44.entities.Product.filter(query, { sort: sortValue, limit: 24, cursor });
      setProducts((previous) => [...previous, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(Boolean(page.has_more));
    } finally {
      setLoadingMore(false);
    }
  };

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setParams(next, { replace: true });
  };

  const tops = categories.filter((category) => !category.parent_slug);
  const childrenOf = (slug) => categories.filter((category) => category.parent_slug === slug);
  const activeCategory = categories.find((category) => category.slug === categoria);
  const hasFilters = Boolean(q || categoria || min || max);

  const FilterPanel = () => (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="eyebrow">Categorias</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => update({ categoria: "" })}
            className={`text-left text-sm transition-colors ${!categoria ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Todas
          </button>
          {tops.map((category) => (
            <div key={category.id} className="space-y-2">
              <button
                type="button"
                onClick={() => update({ categoria: category.slug })}
                className={`text-left text-sm transition-colors ${categoria === category.slug ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {category.name}
              </button>
              {childrenOf(category.slug).map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => update({ categoria: child.slug })}
                  className={`block pl-4 text-left text-sm transition-colors ${categoria === child.slug ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {child.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-6">
        <p className="eyebrow">Faixa de preço</p>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="0"
            placeholder="De"
            defaultValue={min}
            onBlur={(event) => update({ min: event.target.value })}
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            min="0"
            placeholder="Até"
            defaultValue={max}
            onBlur={(event) => update({ max: event.target.value })}
          />
        </div>
      </div>

      {hasFilters && (
        <Button variant="outline" className="w-full rounded-xl" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
          Limpar filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="shell py-14 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 className="mt-2 font-heading text-3xl sm:text-4xl">{activeCategory ? activeCategory.name : "Todos os produtos"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {total === null ? "Carregando produtos…" : `${total} ${total === 1 ? "produto" : "produtos"} encontrados`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              update({ q: term.trim() });
            }}
            className="flex flex-1 gap-2 sm:flex-none"
          >
            <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar no catálogo" className="sm:w-56" />
            <Button type="submit" variant="outline" className="rounded-xl">
              Buscar
            </Button>
          </form>
          <Select value={ordenar} onValueChange={(value) => update({ ordenar: value })}>
            <SelectTrigger className="w-[168px] rounded-xl">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((sort) => (
                <SelectItem key={sort.value} value={sort.value}>
                  {sort.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="rounded-xl lg:hidden">
                <SlidersHorizontal className="mr-2 h-4 w-4" strokeWidth={1.6} /> Filtros
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86%] max-w-sm overflow-y-auto p-6">
              <SheetTitle className="font-heading text-2xl">Filtros</SheetTitle>
              <div className="mt-6">
                <FilterPanel />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-6">
          {q && (
            <button type="button" onClick={() => update({ q: "" })} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Busca: {q} <X className="h-3 w-3" />
            </button>
          )}
          {activeCategory && (
            <button type="button" onClick={() => update({ categoria: "" })} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              {activeCategory.name} <X className="h-3 w-3" />
            </button>
          )}
          {(min || max) && (
            <button type="button" onClick={() => update({ min: "", max: "" })} className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              Preço {min || "0"} — {max || "∞"} <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div className="grid gap-10 pt-10 lg:grid-cols-[220px_1fr]">
        <aside className="cine-panel hidden p-6 lg:block">
          <FilterPanel />
        </aside>

        <div>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {loading && Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="aspect-square w-full" />)}
            {!loading &&
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryName={categories.find((category) => (product.categories || []).includes(category.slug))?.name}
                />
              ))}
          </div>

          {!loading && !products.length && (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-14 text-center">
              <p className="font-heading text-2xl">Nenhum produto encontrado</p>
              <p className="mt-2 text-sm text-muted-foreground">Ajuste a busca ou os filtros para ver outros itens.</p>
              {hasFilters && (
                <Button variant="outline" className="mt-6 rounded-xl" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Limpar filtros
                </Button>
              )}
            </div>
          )}

          {hasMore && (
            <div className="pt-14 text-center">
              <Button variant="outline" className="h-12 rounded-xl px-8" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Carregando…" : "Carregar mais"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}