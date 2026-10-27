import React, { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { variantLabel } from "@/lib/format";

export default function ImageListEditor({ images, onChange, variants = [], productName = "" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const update = (index, field, value) => {
    onChange(images.map((image, position) => (position === index ? { ...image, [field]: value } : image)));
  };

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((image, position) => ({ ...image, sort_order: position })));
  };

  const add = () => onChange([...images, { url: "", alt: productName, variant_sku: "", sort_order: images.length }]);

  const remove = (index) => onChange(images.filter((_, position) => position !== index));

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
        uploaded.push({ url: file_url, alt: productName, variant_sku: "", sort_order: images.length + uploaded.length });
      }
      onChange([...images, ...uploaded]);
    } catch (err) {
      setError(err?.message || "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {images.map((image, index) => (
          <div key={`${image.url}-${index}`} className="flex flex-wrap items-center gap-3 border border-white/10 p-3">
            <div className="h-16 w-14 shrink-0 overflow-hidden border border-white/10 bg-white/5">
              {image.url ? (
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-widest text-background/40">
                  sem foto
                </span>
              )}
            </div>
            <Input
              value={image.url || ""}
              onChange={(event) => update(index, "url", event.target.value)}
              placeholder="Endereço da imagem (https://)"
              className="min-w-[240px] flex-1 rounded-xl border-white/15 bg-white/5 text-background"
            />
            <Input
              value={image.alt || ""}
              onChange={(event) => update(index, "alt", event.target.value)}
              placeholder="Descrição para acessibilidade"
              className="w-[220px] rounded-xl border-white/15 bg-white/5 text-background"
            />
            <Select value={image.variant_sku || "todas"} onValueChange={(value) => update(index, "variant_sku", value === "todas" ? "" : value)}>
              <SelectTrigger className="w-[190px] rounded-xl border-white/15 bg-white/5 text-background">
                <SelectValue placeholder="Variação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as variações</SelectItem>
                {variants.map((variant) => (
                  <SelectItem key={variant.sku} value={variant.sku}>
                    {variant.sku}
                    {variantLabel(variant) ? ` — ${variantLabel(variant)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(index, -1)} className="text-background/60 hover:text-background" aria-label="Mover para cima">
                <ArrowUp className="h-4 w-4" strokeWidth={1.6} />
              </button>
              <button type="button" onClick={() => move(index, 1)} className="text-background/60 hover:text-background" aria-label="Mover para baixo">
                <ArrowDown className="h-4 w-4" strokeWidth={1.6} />
              </button>
              <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80" aria-label="Remover imagem">
                <Trash2 className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>
          </div>
        ))}
        {!images.length && <p className="text-xs text-background/45">Nenhuma imagem associada. As fotos são importadas em uma etapa separada.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10" onClick={add}>
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.8} /> Adicionar por endereço
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" strokeWidth={1.8} />}
          {uploading ? "Enviando…" : "Enviar arquivos de imagem"}
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}