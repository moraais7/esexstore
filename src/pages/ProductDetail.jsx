import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, MessageCircle, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductMedia from "@/components/store/ProductMedia";
import { useCart } from "@/context/CartContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { brl, hasPromo, variantLabel, variantOptionPairs, variantPrice, whatsappLink } from "@/lib/format";
import { sanitizeHtml } from "@/lib/sanitize";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { settings } = useStoreSettings();

  const [status, setStatus] = useState("loading");
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState({});
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    (async () => {
      const { items } = await base44.entities.Product.filter({ slug }, { limit: 1 });
      if (!active) return;
      const found = items?.[0];
      if (!found) {
        const redirect = await base44.entities.Redirect.filter({ from_path: slug, active: true }, { limit: 1 });
        const target = redirect.items?.[0]?.to_path;
        if (target) {
          navigate(target.startsWith("/") ? target : `/${target}`, { replace: true });
          return;
        }
        setStatus("missing");
        return;
      }
      const [variantPage, categoryPage] = await Promise.all([
        base44.entities.ProductVariant.filter({ product_id: found.id, active: true }, { sort: "position", limit: 100 }),
        base44.entities.Category.filter({ active: true }, { limit: 60 }),
      ]);
      if (!active) return;
      const list = variantPage.items || [];
      setProduct(found);
      setVariants(list);
      setCategories(categoryPage.items || []);
      const first = list.find((variant) => Number(variant.stock) > 0) || list[0];
      if (first) {
        const initial = {};
        variantOptionPairs(first).forEach((pair) => {
          initial[pair.name] = pair.value;
        });
        setSelected(initial);
      }
      setStatus("ready");
    })();
    return () => {
      active = false;
    };
  }, [slug, navigate]);

  useEffect(() => {
    if (status !== "missing") return undefined;
    const meta = document.createElement("meta");
    meta.name = "prerender-status-code";
    meta.content = "404";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [status]);

  useEffect(() => {
    if (product) document.title = product.seo_title || `${product.name} | ${settings.store_name}`;
  }, [product, settings.store_name]);

  const optionGroups = useMemo(() => {
    const groups = [];
    for (let index = 1; index <= 3; index += 1) {
      const name = variants.find((variant) => variant[`option${index}_name`])?.[`option${index}_name`];
      if (!name) continue;
      const values = Array.from(new Set(variants.map((variant) => variant[`option${index}_value`]).filter(Boolean)));
      if (values.length) groups.push({ name, index, values });
    }
    return groups;
  }, [variants]);

  const currentVariant = useMemo(() => {
    if (!variants.length) return null;
    if (!optionGroups.length) return variants[0];
    return (
      variants.find((variant) => optionGroups.every((group) => variant[`option${group.index}_value`] === selected[group.name])) ||
      null
    );
  }, [variants, optionGroups, selected]);

  const price = currentVariant ? variantPrice(currentVariant) : null;
  const promo = currentVariant ? hasPromo(currentVariant) : false;
  const stock = currentVariant ? Number(currentVariant.stock) || 0 : 0;
  const images = useMemo(
    () => [...(product?.images || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [product]
  );
  const categoryNames = (product?.categories || [])
    .map((item) => categories.find((category) => category.slug === item)?.name)
    .filter(Boolean);
  const wa = whatsappLink(
    settings.whatsapp_number,
    `${settings.whatsapp_message} (${product?.name || ""})`
  );

  const handleAdd = () => {
    if (!product || !currentVariant || !price) return;
    addItem({
      variant_id: currentVariant.id,
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      variant_label: variantLabel(currentVariant),
      sku: currentVariant.sku,
      unit_price: price,
      image_url: images[0]?.url || "",
      max_stock: stock,
    });
    setAdded(true);
  };

  if (status === "loading") {
    return (
      <div className="shell grid gap-12 py-14 lg:grid-cols-2 lg:py-20">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="shell py-24 text-center">
        <p className="eyebrow">Página não encontrada</p>
        <h1 className="mt-3 font-heading text-3xl">Este produto não está mais disponível</h1>
        <p className="mt-3 text-sm text-muted-foreground">Ele pode ter sido despublicado ou removido do catálogo.</p>
        <Button asChild className="mt-8 rounded-xl">
          <Link to="/catalogo">Ver catálogo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="shell py-14 lg:py-20">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Início</Link>
        <span>/</span>
        <Link to="/catalogo" className="hover:text-foreground">Catálogo</Link>
        {categoryNames[0] && (
          <>
            <span>/</span>
            <span>{categoryNames[0]}</span>
          </>
        )}
      </nav>

      <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-clay">
            <ProductMedia
              src={images[activeImage]?.url}
              alt={images[activeImage]?.alt || product.name}
              placeholderLabel="Foto do produto a importar"
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto">
              {images.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${index === activeImage ? "border-gold" : "border-border/60 hover:border-foreground"}`}
                >
                  <ProductMedia src={image.url} alt={image.alt || product.name} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-32 lg:self-start">
          {categoryNames.length > 0 && <p className="eyebrow">{categoryNames.join(" · ")}</p>}
          <h1 className="mt-3 font-heading text-3xl leading-tight sm:text-4xl">{product.name}</h1>

          {product.needs_review && (
            <p className="mt-4 border-l-2 border-gold pl-3 text-xs text-muted-foreground">
              Conteúdo em revisão pela loja: informações de composição, cuidados e fotos podem ser atualizadas.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            {price ? (
              <>
                <span className="font-heading text-3xl">{brl(price)}</span>
                {promo && <span className="text-sm text-muted-foreground line-through">{brl(currentVariant.price)}</span>}
                {promo && <span className="rounded-full bg-gold/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold">Promoção</span>}
              </>
            ) : (
              <span className="font-heading text-2xl text-muted-foreground">Preço a confirmar</span>
            )}
          </div>

          {optionGroups.map((group) => (
            <div key={group.name} className="mt-8">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{group.name}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const active = selected[group.name] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelected((previous) => ({ ...previous, [group.name]: value }))}
                      className={`min-h-11 rounded-full border px-5 text-sm transition-colors ${
                        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              {currentVariant
                ? stock > 0
                  ? `Disponível${stock <= 3 ? ` — últimas ${stock} unidades` : ""}`
                  : "Esgotado nesta variação"
                : "Combinação indisponível — escolha outra opção."}
            </p>
            <Button
              className="h-12 w-full rounded-xl"
              disabled={!currentVariant || stock <= 0 || !price}
              onClick={handleAdd}
            >
              {price ? "Adicionar ao carrinho" : "Preço em revisão"}
            </Button>
            {added && (
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-gold" strokeWidth={1.8} /> Adicionado ao carrinho.{" "}
                <Link to="/carrinho" className="underline underline-offset-4">Ver carrinho</Link>
              </p>
            )}
            {!price && wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                <MessageCircle className="h-4 w-4" strokeWidth={1.6} /> Confirmar preço com a loja no WhatsApp
              </a>
            )}
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.6} /> Pagamento processado pelo Stripe. {settings.shipping_note}
            </p>
          </div>

          <Tabs defaultValue="descricao" className="mt-10">
            <TabsList className="h-auto w-full justify-start gap-1 rounded-full border-0 bg-secondary/60 p-1">
              <TabsTrigger value="descricao" className="rounded-full px-5">Descrição</TabsTrigger>
              <TabsTrigger value="composicao" className="rounded-full px-5">Composição</TabsTrigger>
              <TabsTrigger value="cuidados" className="rounded-full px-5">Cuidados</TabsTrigger>
            </TabsList>
            <TabsContent value="descricao" className="pt-6">
              {product.summary && <p className="mb-4 text-sm leading-relaxed text-foreground">{product.summary}</p>}
              {product.description ? (
                <div className="prose-store text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }} />
              ) : (
                <p className="text-sm text-muted-foreground">Descrição ainda não cadastrada pela loja.</p>
              )}
            </TabsContent>
            <TabsContent value="composicao" className="pt-6">
              {product.composition ? (
                <div className="prose-store text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.composition) }} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Informação de composição ainda não cadastrada. A loja está revisando este conteúdo antes de publicar.
                </p>
              )}
            </TabsContent>
            <TabsContent value="cuidados" className="pt-6">
              {product.care_instructions ? (
                <div className="prose-store text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.care_instructions) }} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Recomendações de uso e cuidados ainda não cadastradas. Em caso de dúvida, fale com a loja pelo WhatsApp.
                </p>
              )}
            </TabsContent>
          </Tabs>

          {currentVariant && (
            <p className="mt-8 text-xs text-muted-foreground">
              SKU {currentVariant.sku}
              {currentVariant.barcode ? ` · Código de barras ${currentVariant.barcode}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}