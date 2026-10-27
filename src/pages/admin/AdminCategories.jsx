import React, { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/format";

const EMPTY = { name: "", slug: "", parent_slug: "", description: "", sort_order: 0, active: true };

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { items } = await base44.entities.Category.filter({}, { sort: "sort_order", limit: 200 });
    setCategories(items || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, sort_order: categories.length + 1 });
    setOpen(true);
  };

  const startEdit = (category) => {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      parent_slug: category.parent_slug || "",
      description: category.description || "",
      sort_order: category.sort_order || 0,
      active: category.active !== false,
    });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        slug: slugify(form.slug || form.name),
        sort_order: Number(form.sort_order) || 0,
      };
      if (editing) await base44.entities.Category.update(editing.id, payload);
      else await base44.entities.Category.create(payload);
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (category) => {
    await base44.entities.Category.update(category.id, { active: !category.active });
    await load();
  };

  const remove = async (category) => {
    if (!window.confirm(`Excluir a categoria "${category.name}"? Os produtos continuam existindo, mas perdem esta categoria.`)) return;
    await base44.entities.Category.delete(category.id);
    await load();
  };

  const field = "rounded-xl border-white/15 bg-white/5 text-background placeholder:text-background/40";
  const label = "text-[11px] uppercase tracking-[0.14em] text-background/50";
  const tops = categories.filter((category) => !category.parent_slug);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-background/50">Organização</p>
          <h1 className="mt-2 font-heading text-3xl">Categorias</h1>
        </div>
        <Button onClick={startCreate} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.8} /> Nova categoria
        </Button>
      </div>

      <div className="overflow-x-auto border border-white/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
            <tr>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Endereço</th>
              <th className="px-4 py-3">Ordem</th>
              <th className="px-4 py-3">Na loja</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-background/50">Carregando categorias…</td>
              </tr>
            )}
            {!loading && !categories.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-background/50">Nenhuma categoria cadastrada.</td>
              </tr>
            )}
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-3">
                  {category.parent_slug ? (
                    <span className="text-background/60">
                      {categories.find((item) => item.slug === category.parent_slug)?.name || category.parent_slug} › {category.name}
                    </span>
                  ) : (
                    category.name
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-background/50">/{category.slug}</td>
                <td className="px-4 py-3 text-xs text-background/50">{category.sort_order ?? 0}</td>
                <td className="px-4 py-3">
                  <Switch checked={category.active !== false} onCheckedChange={() => toggleActive(category)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button type="button" onClick={() => startEdit(category)} className="inline-flex items-center gap-1 text-xs text-background/70 hover:text-background">
                      <Pencil className="h-4 w-4" strokeWidth={1.6} /> editar
                    </button>
                    <button type="button" onClick={() => remove(category)} className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" strokeWidth={1.6} /> excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-foreground text-background">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-5">
            <div>
              <Label className={label}>Nome</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`mt-2 ${field}`} />
            </div>
            <div>
              <Label className={label}>Endereço amigável</Label>
              <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="gerado a partir do nome" className={`mt-2 ${field}`} />
            </div>
            <div>
              <Label className={label}>Categoria principal (para categorias internas)</Label>
              <select
                value={form.parent_slug}
                onChange={(event) => setForm({ ...form, parent_slug: event.target.value })}
                className="mt-2 h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-background"
              >
                <option value="">Nenhuma (categoria principal)</option>
                {tops.filter((category) => category.id !== editing?.id).map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className={label}>Descrição</Label>
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`mt-2 ${field}`} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className={label}>Ordem de exibição</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
                  className={`mt-2 ${field}`}
                />
              </div>
              <div className="flex items-center justify-between border border-white/10 px-4 py-3">
                <span className="text-sm text-background/80">Ativa na loja</span>
                <Switch checked={form.active} onCheckedChange={(value) => setForm({ ...form, active: value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
                {saving ? "Salvando…" : "Salvar categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}