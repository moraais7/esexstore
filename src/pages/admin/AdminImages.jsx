import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slugify, variantLabel } from "@/lib/format";

export default function AdminImages() {
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [pending, setPending] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    base44.entities.Product.filter({}, { sort: "name", limit: 300 }).then(({ items }) => setProducts(items || []));
    base44.entities.ProductVariant.filter({}, { limit: 500 }).then(({ items }) => setVariants(items || []));
  }, []);

  const suggest = (name) => {
    const key = slugify(String(name).replace(/\.[a-z0-9]+$/i, ""));
    if (!key) return { product_id: "", variant_sku: "" };
    const bySku = variants.find((variant) => variant.sku && key.includes(slugify(variant.sku)));
    if (bySku) return { product_id: bySku.product_id, variant_sku: bySku.sku };
    const byProduct = products.find((product) => key.includes(product.slug) || slugify(product.name) === key);
    if (byProduct) return { product_id: byProduct.id, variant_sku: "" };
    return { product_id: "", variant_sku: "" };
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const rows = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        const guess = suggest(file.name);
        const product = products.find((item) => item.id === guess.product_id);
        rows.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file_url,
          file_name: file.name,
          product_id: guess.product_id,
          variant_sku: guess.variant_sku,
          alt: product ? `${product.name} — foto do produto` : "",
          saving: false,
        });
      }
      setPending((previous) => [...previous, ...rows]);
    } catch (err) {
      setError(err?.message || "Não foi possível enviar os arquivos.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const updateRow = (id, changes) => setPending((previous) => previous.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  const attach = async (row) => {
    const product = products.find((item) => item.id === row.product_id);
    if (!product) {
      setError("Escolha o produto que recebe esta foto.");
      return;
    }
    updateRow(row.id, { saving: true });
    const images = [
      ...(product.images || []),
      {
        url: row.file_url,
        alt: row.alt || product.name,
        variant_sku: row.variant_sku || "",
        sort_order: (product.images || []).length,
      },
    ];
    const reviewNotes = (product.review_notes || []).filter((note) => !note.startsWith("Fotos"));
    await base44.entities.Product.update(product.id, { images, review_notes: reviewNotes });
    setProducts((previous) => previous.map((item) => (item.id === product.id ? { ...item, images, review_notes: reviewNotes } : item)));
    setPending((previous) => previous.filter((item) => item.id !== row.id));
  };

  const withoutImages = products.filter((product) => !(product.images || []).length);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-background/50">Fotos</p>
        <h1 className="mt-2 font-heading text-3xl">Importar e associar imagens</h1>
        <p className="mt-2 max-w-3xl text-sm text-background/60">
          As imagens não vêm no CSV da Nuvemshop. Envie os arquivos aqui, escolha o produto de cada foto (e a variação, quando
          a foto for específica) e descreva a imagem para acessibilidade. As fotos ficam em endereço público, para aparecerem
          na loja.
        </p>
      </div>

      <div className="border border-dashed border-white/20 p-10 text-center">
        <ImageOff className="mx-auto h-7 w-7 text-gold" strokeWidth={1.4} />
        <h2 className="mt-4 font-heading text-2xl">Envie os arquivos de imagem</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-background/60">
          Pode enviar várias fotos de uma vez. Quando o nome do arquivo contiver o SKU do produto, a associação é sugerida
          automaticamente.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" strokeWidth={1.8} />}
            {uploading ? "Enviando…" : "Escolher imagens"}
          </Button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      {error && <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {pending.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-heading text-2xl">Fotos aguardando associação</h2>
          <div className="space-y-3">
            {pending.map((row) => {
              const productVariants = variants.filter((variant) => variant.product_id === row.product_id);
              return (
                <div key={row.id} className="flex flex-wrap items-center gap-4 border border-white/10 p-4">
                  <div className="h-16 w-14 shrink-0 overflow-hidden border border-white/10 bg-white/5">
                    <img src={row.file_url} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <p className="truncate text-sm text-background/80">{row.file_name}</p>
                  </div>
                  <Select
                    value={row.product_id || ""}
                    onValueChange={(value) => updateRow(row.id, { product_id: value, variant_sku: "" })}
                  >
                    <SelectTrigger className="w-[240px] rounded-xl border-white/15 bg-white/5 text-background">
                      <SelectValue placeholder="Escolha o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={row.variant_sku || "todas"} onValueChange={(value) => updateRow(row.id, { variant_sku: value === "todas" ? "" : value })}>
                    <SelectTrigger className="w-[210px] rounded-xl border-white/15 bg-white/5 text-background">
                      <SelectValue placeholder="Variação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as variações</SelectItem>
                      {productVariants.map((variant) => (
                        <SelectItem key={variant.sku} value={variant.sku}>
                          {variant.sku}
                          {variantLabel(variant) ? ` — ${variantLabel(variant)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={row.alt}
                    onChange={(event) => updateRow(row.id, { alt: event.target.value })}
                    placeholder="Descrição da imagem"
                    className="w-[240px] rounded-xl border-white/15 bg-white/5 text-background placeholder:text-background/40"
                  />
                  <Button
                    onClick={() => attach(row)}
                    disabled={row.saving || !row.product_id}
                    className="rounded-xl bg-gold text-foreground hover:bg-gold/90"
                  >
                    {row.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Associar
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-heading text-2xl">Produtos sem foto ({withoutImages.length})</h2>
        {withoutImages.length === 0 ? (
          <p className="text-sm text-background/60">Todos os produtos têm pelo menos uma foto associada.</p>
        ) : (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categorias</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {withoutImages.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      <p>{product.name}</p>
                      <p className="text-xs text-background/45">/{product.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-background/50">{(product.categories || []).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-xs text-background/60">
                      {product.status === "active" ? "publicado" : "rascunho"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/produtos/${product.id}`} className="text-xs text-background/70 hover:text-background">
                        abrir produto
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}