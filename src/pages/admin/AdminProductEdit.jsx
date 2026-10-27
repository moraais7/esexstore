import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ImageListEditor from "@/components/admin/ImageListEditor";
import VariantEditor, { emptyVariant } from "@/components/admin/VariantEditor";
import { slugify } from "@/lib/format";

const EMPTY_FORM = {
  name: "",
  slug: "",
  source_id: "",
  summary: "",
  description: "",
  categories: [],
  brand: "",
  tags: "",
  seo_title: "",
  seo_description: "",
  status: "draft",
  visible: false,
  featured: false,
  physical: true,
  composition: "",
  care_instructions: "",
  sex: "",
  age_range: "",
  mpn: "",
  cost: "",
  needs_review: false,
  review_notes: [],
  images: [],
};

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export default function AdminProductEdit() {
  const { id } = useParams();
  const isNew = !id || id === "novo";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [variants, setVariants] = useState([emptyVariant()]);
  const [removedVariantIds, setRemovedVariantIds] = useState([]);

  useEffect(() => {
    base44.entities.Category.filter({ active: true }, { sort: "sort_order", limit: 100 })
      .then(({ items }) => setCategories(items || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const product = await base44.entities.Product.get(id).catch((err) => (err?.status === 404 ? null : Promise.reject(err)));
      if (!active) return;
      if (!product) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const { items } = await base44.entities.ProductVariant.filter({ product_id: product.id }, { sort: "position", limit: 200 });
      if (!active) return;
      setForm({
        ...EMPTY_FORM,
        ...product,
        categories: product.categories || [],
        tags: (product.tags || []).join(", "),
        review_notes: product.review_notes || [],
        images: product.images || [],
      });
      setVariants((items || []).length ? items.map((variant) => ({ ...variant })) : [emptyVariant()]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, isNew]);

  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  const toggleCategory = (slug) => {
    setForm((previous) => ({
      ...previous,
      categories: previous.categories.includes(slug)
        ? previous.categories.filter((item) => item !== slug)
        : [...previous.categories, slug],
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    if (!variants.length) {
      setError("Cadastre ao menos uma variação para o produto poder ser vendido.");
      return;
    }
    const slug = slugify(form.slug || form.name);
    setSaving(true);
    try {
      const prices = variants.map((variant) => Number(variant.price) || 0).filter((value) => value > 0);
      const promos = variants
        .map((variant) => (Number(variant.promo_price) > 0 ? Number(variant.promo_price) : Number(variant.price) || 0))
        .filter((value) => value > 0);

      const payload = {
        source_id: form.source_id || slug,
        name: form.name.trim(),
        slug,
        summary: form.summary,
        description: form.description,
        categories: form.categories,
        brand: form.brand,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        seo_title: form.seo_title || `${form.name.trim()} | Esex Store`,
        seo_description: form.seo_description || form.summary,
        status: form.status,
        visible: Boolean(form.visible),
        featured: Boolean(form.featured),
        physical: Boolean(form.physical),
        composition: form.composition,
        care_instructions: form.care_instructions,
        sex: form.sex,
        age_range: form.age_range,
        mpn: form.mpn,
        needs_review: Boolean(form.needs_review),
        review_notes: form.review_notes || [],
        images: form.images.filter((image) => image.url),
        price_from: prices.length ? Math.min(...prices) : null,
        price_from_promo: promos.length ? Math.min(...promos) : null,
        total_stock: variants.reduce((total, variant) => total + (Number(variant.stock) || 0), 0),
        sku_default: variants[0].sku || "",
      };
      const cost = num(form.cost);
      payload.cost = cost || 0;

      let productId = isNew ? null : id;
      if (productId) {
        await base44.entities.Product.update(productId, payload);
      } else {
        const created = await base44.entities.Product.create({ ...payload, is_demo: false });
        productId = created.id;
      }

      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
        const variantPayload = {
          product_id: productId,
          source_id: payload.source_id,
          sku: variant.sku?.trim() || `${slug}-${index + 1}`,
          option1_name: variant.option1_name || "",
          option1_value: variant.option1_value || "",
          option2_name: variant.option2_name || "",
          option2_value: variant.option2_value || "",
          option3_name: variant.option3_name || "",
          option3_value: variant.option3_value || "",
          stock: Math.max(0, Math.round(Number(variant.stock) || 0)),
          barcode: variant.barcode || "",
          active: true,
          position: index,
        };
        const price = num(variant.price);
        const promo = num(variant.promo_price);
        if (price) variantPayload.price = price;
        if (promo) variantPayload.promo_price = promo;
        ["weight_kg", "height_cm", "width_cm", "length_cm"].forEach((field) => {
          const value = Number(variant[field]);
          if (Number.isFinite(value) && value > 0) variantPayload[field] = value;
        });
        if (variant.id) await base44.entities.ProductVariant.update(variant.id, variantPayload);
        else await base44.entities.ProductVariant.create(variantPayload);
      }

      if (removedVariantIds.length) {
        await base44.entities.ProductVariant.deleteMany({ id: { $in: removedVariantIds } });
        setRemovedVariantIds([]);
      }

      navigate("/admin/produtos");
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async () => {
    if (!window.confirm("Excluir este produto e suas variações? Esta ação não pode ser desfeita.")) return;
    await base44.entities.ProductVariant.deleteMany({ product_id: id });
    await base44.entities.Product.delete(id);
    navigate("/admin/produtos");
  };

  const onVariantsChange = (next) => {
    const removed = variants.filter((variant) => variant.id && !next.some((item) => item.id === variant.id)).map((variant) => variant.id);
    if (removed.length) setRemovedVariantIds((previous) => [...previous, ...removed]);
    setVariants(next);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-background/60">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando produto…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="border border-white/10 p-10 text-center">
        <h1 className="font-heading text-2xl">Produto não encontrado</h1>
        <Button asChild variant="outline" className="mt-6 rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10">
          <Link to="/admin/produtos">Voltar para produtos</Link>
        </Button>
      </div>
    );
  }

  const field = "rounded-xl border-white/15 bg-white/5 text-background placeholder:text-background/40";
  const label = "text-[11px] uppercase tracking-[0.14em] text-background/50";

  return (
    <form onSubmit={save} className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/admin/produtos" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-background/50 hover:text-background">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} /> Produtos
          </Link>
          <h1 className="mt-3 font-heading text-3xl">{isNew ? "Novo produto" : form.name || "Editar produto"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isNew && form.slug && (
            <a
              href={`/produto/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-background/60 hover:text-background"
            >
              Ver na loja <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
            </a>
          )}
          <Button type="submit" disabled={saving} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" strokeWidth={1.8} />}
            {saving ? "Salvando…" : "Salvar produto"}
          </Button>
          {!isNew && (
            <Button type="button" variant="outline" className="rounded-xl border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10" onClick={removeProduct}>
              <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.6} /> Excluir
            </Button>
          )}
        </div>
      </div>

      {error && <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div>
            <Label className={label}>Nome do produto</Label>
            <Input value={form.name} onChange={(event) => update("name", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label className={label}>Endereço amigável (URL)</Label>
              <Input value={form.slug} onChange={(event) => update("slug", event.target.value)} placeholder="usado no link da loja" className={`mt-2 ${field}`} />
              <p className="mt-2 text-xs text-background/45">Mantenha o endereço original da Nuvemshop para não perder as URLs atuais.</p>
            </div>
            <div>
              <Label className={label}>Identificador de origem</Label>
              <Input value={form.source_id} onChange={(event) => update("source_id", event.target.value)} className={`mt-2 ${field}`} />
            </div>
          </div>
          <div>
            <Label className={label}>Resumo (aparece nos cards)</Label>
            <Input value={form.summary} onChange={(event) => update("summary", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Descrição (aceita HTML)</Label>
            <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={8} className={`mt-2 ${field}`} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label className={label}>Composição</Label>
              <Textarea value={form.composition} onChange={(event) => update("composition", event.target.value)} rows={4} className={`mt-2 ${field}`} />
            </div>
            <div>
              <Label className={label}>Cuidados e uso</Label>
              <Textarea value={form.care_instructions} onChange={(event) => update("care_instructions", event.target.value)} rows={4} className={`mt-2 ${field}`} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <Label className={label}>Situação</Label>
            <Select value={form.status} onValueChange={(value) => update("status", value)}>
              <SelectTrigger className={`mt-2 ${field}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="active">Publicado</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {[
            { field: "visible", label: "Visível na loja" },
            { field: "featured", label: "Destacar na página inicial" },
            { field: "physical", label: "Produto físico" },
            { field: "needs_review", label: "Manter aviso de revisão" },
          ].map((toggle) => (
            <div key={toggle.field} className="flex items-center justify-between border border-white/10 px-4 py-3">
              <span className="text-sm text-background/80">{toggle.label}</span>
              <Switch checked={Boolean(form[toggle.field])} onCheckedChange={(value) => update(toggle.field, value)} />
            </div>
          ))}
          <div>
            <Label className={label}>Categorias</Label>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto border border-white/10 p-4">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-3 text-sm text-background/80">
                  <Checkbox checked={form.categories.includes(category.slug)} onCheckedChange={() => toggleCategory(category.slug)} />
                  <span>
                    {category.parent_slug ? `${categories.find((item) => item.slug === category.parent_slug)?.name || ""} › ` : ""}
                    {category.name}
                  </span>
                </label>
              ))}
              {!categories.length && <p className="text-xs text-background/50">Nenhuma categoria cadastrada.</p>}
            </div>
          </div>
          <div>
            <Label className={label}>Tags (separadas por vírgula)</Label>
            <Input value={form.tags} onChange={(event) => update("tags", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Marca</Label>
            <Input value={form.brand} onChange={(event) => update("brand", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Custo (uso interno)</Label>
            <Input type="number" step="0.01" value={form.cost ?? ""} onChange={(event) => update("cost", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label className={label}>Título para SEO</Label>
              <Input value={form.seo_title} onChange={(event) => update("seo_title", event.target.value)} className={`mt-2 ${field}`} />
            </div>
            <div>
              <Label className={label}>Descrição para SEO</Label>
              <Input value={form.seo_description} onChange={(event) => update("seo_description", event.target.value)} className={`mt-2 ${field}`} />
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4 border-t border-white/10 pt-8">
        <h2 className="font-heading text-2xl">Variações, preço e estoque</h2>
        <VariantEditor variants={variants} onChange={onVariantsChange} />
      </section>

      <section className="space-y-4 border-t border-white/10 pt-8">
        <h2 className="font-heading text-2xl">Fotos do produto</h2>
        <ImageListEditor images={form.images || []} onChange={(images) => update("images", images)} variants={variants} productName={form.name} />
      </section>

      <div className="border-t border-white/10 pt-6">
        <Button type="submit" disabled={saving} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" strokeWidth={1.8} />}
          {saving ? "Salvando…" : "Salvar produto"}
        </Button>
      </div>
    </form>
  );
}