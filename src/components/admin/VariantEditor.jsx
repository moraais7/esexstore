import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const emptyVariant = () => ({
  id: null,
  sku: "",
  option1_name: "",
  option1_value: "",
  option2_name: "",
  option2_value: "",
  option3_name: "",
  option3_value: "",
  price: "",
  promo_price: "",
  stock: 0,
  weight_kg: "",
  height_cm: "",
  width_cm: "",
  length_cm: "",
  barcode: "",
});

export { emptyVariant };

export default function VariantEditor({ variants, onChange }) {
  const update = (index, field, value) => {
    onChange(variants.map((variant, position) => (position === index ? { ...variant, [field]: value } : variant)));
  };

  const remove = (index) => onChange(variants.filter((_, position) => position !== index));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-white/10">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
            <tr>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Opção 1 (nome / valor)</th>
              <th className="px-3 py-2">Opção 2 (nome / valor)</th>
              <th className="px-3 py-2">Preço</th>
              <th className="px-3 py-2">Promocional</th>
              <th className="px-3 py-2">Estoque</th>
              <th className="px-3 py-2">Peso (kg)</th>
              <th className="px-3 py-2">A×L×C (cm)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {variants.map((variant, index) => (
              <tr key={variant.id || `new-${index}`}>
                <td className="px-3 py-2">
                  <Input
                    value={variant.sku || ""}
                    onChange={(event) => update(index, "sku", event.target.value)}
                    className="h-9 w-32 rounded-xl border-white/15 bg-white/5 text-background"
                  />
                </td>
                {[1, 2].map((slot) => (
                  <td key={slot} className="px-3 py-2">
                    <div className="flex gap-2">
                      <Input
                        value={variant[`option${slot}_name`] || ""}
                        onChange={(event) => update(index, `option${slot}_name`, event.target.value)}
                        placeholder="nome"
                        className="h-9 w-24 rounded-xl border-white/15 bg-white/5 text-background"
                      />
                      <Input
                        value={variant[`option${slot}_value`] || ""}
                        onChange={(event) => update(index, `option${slot}_value`, event.target.value)}
                        placeholder="valor"
                        className="h-9 w-24 rounded-xl border-white/15 bg-white/5 text-background"
                      />
                    </div>
                  </td>
                ))}
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={variant.price ?? ""}
                    onChange={(event) => update(index, "price", event.target.value)}
                    className="h-9 w-24 rounded-xl border-white/15 bg-white/5 text-background"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={variant.promo_price ?? ""}
                    onChange={(event) => update(index, "promo_price", event.target.value)}
                    className="h-9 w-24 rounded-xl border-white/15 bg-white/5 text-background"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={variant.stock ?? 0}
                    onChange={(event) => update(index, "stock", event.target.value)}
                    className="h-9 w-20 rounded-xl border-white/15 bg-white/5 text-background"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    step="0.001"
                    value={variant.weight_kg ?? ""}
                    onChange={(event) => update(index, "weight_kg", event.target.value)}
                    className="h-9 w-20 rounded-xl border-white/15 bg-white/5 text-background"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {["height_cm", "width_cm", "length_cm"].map((field) => (
                      <Input
                        key={field}
                        type="number"
                        step="0.1"
                        value={variant[field] ?? ""}
                        onChange={(event) => update(index, field, event.target.value)}
                        className="h-9 w-16 rounded-xl border-white/15 bg-white/5 text-background"
                      />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80" aria-label="Remover variação">
                    <Trash2 className="h-4 w-4" strokeWidth={1.6} />
                  </button>
                </td>
              </tr>
            ))}
            {!variants.length && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-background/50">
                  Nenhuma variação cadastrada. Adicione ao menos uma para poder vender.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10"
        onClick={() => onChange([...variants, emptyVariant()])}
      >
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.8} /> Adicionar variação
      </Button>
      <p className="text-xs text-background/45">
        Deixe o preço em branco quando o valor ainda não estiver confirmado: o produto fica marcado como “preço a confirmar” na loja.
      </p>
    </div>
  );
}