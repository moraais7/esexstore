import React, { useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { store } from "@/api/storeClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";


export default function AdminPlatform() {
  const [redirects, setRedirects] = useState([]);
  const [form, setForm] = useState({ from_path: "", to_path: "", note: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { items } = await store.entities.Redirect.filter({}, { sort: "-created_date", limit: 300 });
    setRedirects(items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (event) => {
    event.preventDefault();
    if (!form.from_path.trim() || !form.to_path.trim()) return;
    setSaving(true);
    try {
      const normalize = (value) => (value.startsWith("/") ? value : `/${value}`);
      await store.entities.Redirect.create({
        from_path: normalize(form.from_path).replace("/produto/", ""),
        to_path: normalize(form.to_path),
        note: form.note,
        active: true,
      });
      setForm({ from_path: "", to_path: "", note: "" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (redirect) => {
    await store.entities.Redirect.update(redirect.id, { active: !redirect.active });
    await load();
  };

  const remove = async (redirect) => {
    if (!window.confirm(`Remover o redirecionamento ${redirect.from_path}?`)) return;
    await store.entities.Redirect.delete(redirect.id);
    await load();
  };

  const exportCsv = () => {
    const lines = ["origem;destino;observacao", ...redirects.map((item) => `${item.from_path};${item.to_path};"${item.note || ""}"`)];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mapa-de-redirecionamentos-esex.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const field = "rounded-xl border-white/15 bg-white/5 text-background placeholder:text-background/40";
  const label = "text-[11px] uppercase tracking-[0.14em] text-background/50";

  return (
    <div className="space-y-12">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-background/50">Técnico</p>
        <h1 className="mt-2 font-heading text-3xl">Redirecionamentos</h1>
        <p className="mt-2 max-w-3xl text-sm text-background/60">
          Mantenha os endereços antigos dos produtos funcionando quando seus endereços mudarem.
        </p>
      </div>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl">Mapa de redirecionamentos</h2>
            <p className="mt-1 max-w-2xl text-sm text-background/60">
              Informe o endereço antigo do produto (sem a parte <span className="text-background/80">/produto/</span>) e para
              onde ele deve levar agora. A loja usa esta tabela quando alguém abre um endereço que não existe mais.
            </p>
          </div>
          {redirects.length > 0 && (
            <Button variant="outline" className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" strokeWidth={1.8} /> Exportar mapa (CSV)
            </Button>
          )}
        </div>

        <form onSubmit={add} className="grid gap-4 border border-white/10 p-5 sm:grid-cols-4">
          <div>
            <Label className={label}>Endereço antigo</Label>
            <Input value={form.from_path} onChange={(event) => setForm({ ...form, from_path: event.target.value })} placeholder="batat-bullet-antigo" className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Novo endereço</Label>
            <Input value={form.to_path} onChange={(event) => setForm({ ...form, to_path: event.target.value })} placeholder="/produto/novo-endereco" className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Observação</Label>
            <Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="motivo da mudança" className={`mt-2 ${field}`} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={saving} className="w-full rounded-xl bg-gold text-foreground hover:bg-gold/90">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.8} /> Adicionar
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto border border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
              <tr>
                <th className="px-4 py-3">Endereço antigo</th>
                <th className="px-4 py-3">Novo endereço</th>
                <th className="px-4 py-3">Observação</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {!redirects.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-background/50">
                    Nenhum redirecionamento registrado. Os produtos importados mantêm o endereço original da Nuvemshop, então
                    normalmente não há o que redirecionar.
                  </td>
                </tr>
              )}
              {redirects.map((redirect) => (
                <tr key={redirect.id}>
                  <td className="px-4 py-3 text-xs text-background/70">/produto/{redirect.from_path}</td>
                  <td className="px-4 py-3 text-xs text-background/70">{redirect.to_path}</td>
                  <td className="px-4 py-3 text-xs text-background/50">{redirect.note || "—"}</td>
                  <td className="px-4 py-3">
                    <Switch checked={redirect.active !== false} onCheckedChange={() => toggle(redirect)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => remove(redirect)} className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" strokeWidth={1.6} /> remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-background/45">
          Observação: redirecionamentos permanentes (301) podem ser configurados no servidor. Aqui o
          redirecionamento acontece quando o visitante abre o endereço antigo dentro da loja.
        </p>
      </section>
    </div>
  );
}