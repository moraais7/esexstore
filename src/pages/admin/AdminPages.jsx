import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/format";

const EMPTY = {
  title: "",
  slug: "",
  subtitle: "",
  body: "",
  status: "draft",
  show_in_footer: true,
  sort_order: 0,
  needs_review: true,
};

export default function AdminPages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { items } = await base44.entities.ContentPage.filter({}, { sort: "sort_order", limit: 100 });
    setPages(items || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, sort_order: pages.length + 1 });
    setOpen(true);
  };

  const startEdit = (page) => {
    setEditing(page);
    setForm({ ...EMPTY, ...page });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        sort_order: Number(form.sort_order) || 0,
      };
      if (editing) await base44.entities.ContentPage.update(editing.id, payload);
      else await base44.entities.ContentPage.create({ ...payload, is_demo: false });
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (page) => {
    const next = page.status === "published" ? "draft" : "published";
    await base44.entities.ContentPage.update(page.id, { status: next });
    await load();
  };

  const remove = async (page) => {
    if (!window.confirm(`Excluir a página "${page.title}"?`)) return;
    await base44.entities.ContentPage.delete(page.id);
    await load();
  };

  const field = "rounded-xl border-white/15 bg-white/5 text-background placeholder:text-background/40";
  const label = "text-[11px] uppercase tracking-[0.14em] text-background/50";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-background/50">Institucional</p>
          <h1 className="mt-2 font-heading text-3xl">Conteúdo das páginas</h1>
          <p className="mt-2 max-w-2xl text-sm text-background/60">
            Textos de trocas, privacidade, termos, entrega e dúvidas frequentes. Os conteúdos de demonstração continuam
            marcados como “em revisão” até você validá-los.
          </p>
        </div>
        <Button onClick={startCreate} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
          <Plus className="mr-2 h-4 w-4" strokeWidth={1.8} /> Nova página
        </Button>
      </div>

      <div className="overflow-x-auto border border-white/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
            <tr>
              <th className="px-4 py-3">Página</th>
              <th className="px-4 py-3">Endereço</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Rodapé</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-background/50">Carregando páginas…</td>
              </tr>
            )}
            {!loading && !pages.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-background/50">Nenhuma página cadastrada.</td>
              </tr>
            )}
            {pages.map((page) => (
              <tr key={page.id}>
                <td className="px-4 py-3">
                  <p>{page.title}</p>
                  {page.needs_review && <span className="text-[10px] uppercase tracking-[0.14em] text-gold">em revisão</span>}
                </td>
                <td className="px-4 py-3 text-xs text-background/50">/pagina/{page.slug}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-[0.14em] text-background/60">
                  {page.status === "published" ? "publicada" : "rascunho"}
                </td>
                <td className="px-4 py-3 text-xs text-background/50">{page.show_in_footer ? "sim" : "não"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <a
                      href={`/pagina/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-background/60 hover:text-background"
                    >
                      ver
                    </a>
                    <button type="button" onClick={() => toggleStatus(page)} className="inline-flex items-center gap-1 text-xs text-background/70 hover:text-background">
                      {page.status === "published" ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
                      {page.status === "published" ? "despublicar" : "publicar"}
                    </button>
                    <button type="button" onClick={() => startEdit(page)} className="inline-flex items-center gap-1 text-xs text-background/70 hover:text-background">
                      <Pencil className="h-4 w-4" strokeWidth={1.6} /> editar
                    </button>
                    <button type="button" onClick={() => remove(page)} className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80">
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
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto bg-foreground text-background">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{editing ? "Editar página" : "Nova página"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className={label}>Título</Label>
                <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={`mt-2 ${field}`} />
              </div>
              <div>
                <Label className={label}>Endereço amigável</Label>
                <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} className={`mt-2 ${field}`} />
              </div>
            </div>
            <div>
              <Label className={label}>Linha de apoio (subtítulo)</Label>
              <Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} className={`mt-2 ${field}`} />
            </div>
            <div>
              <Label className={label}>Conteúdo (aceita HTML simples)</Label>
              <Textarea
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                rows={12}
                className={`mt-2 ${field}`}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label className={label}>Situação</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger className={`mt-2 ${field}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={label}>Ordem no rodapé</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
                  className={`mt-2 ${field}`}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center justify-between gap-4 border border-white/10 px-4 py-3">
                <span className="text-sm text-background/80">Mostrar no rodapé</span>
                <Switch checked={Boolean(form.show_in_footer)} onCheckedChange={(value) => setForm({ ...form, show_in_footer: value })} />
              </div>
              <div className="flex items-center justify-between gap-4 border border-white/10 px-4 py-3">
                <span className="text-sm text-background/80">Conteúdo revisado</span>
                <Switch checked={!form.needs_review} onCheckedChange={(value) => setForm({ ...form, needs_review: !value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
                {saving ? "Salvando…" : "Salvar página"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}