import React, { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SETTINGS } from "@/hooks/useStoreSettings";
import { digitsOnly } from "@/lib/format";

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    base44.entities.SiteSettings.filter({ key: "main" }, { limit: 1 })
      .then(({ items }) => {
        if (!active) return;
        const record = items?.[0];
        if (record) {
          setRecordId(record.id);
          setSettings({ ...DEFAULT_SETTINGS, ...record });
        } else {
          setSettings({ ...DEFAULT_SETTINGS });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const update = (field, value) => setSettings((previous) => ({ ...previous, [field]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        key: "main",
        store_name: settings.store_name,
        tagline: settings.tagline,
        announcement: settings.announcement,
        whatsapp_number: digitsOnly(settings.whatsapp_number),
        whatsapp_message: settings.whatsapp_message,
        contact_email: settings.contact_email,
        instagram: settings.instagram,
        address: settings.address,
        about_short: settings.about_short,
        logo_url: settings.logo_url,
        payments_configured: Boolean(settings.payments_configured),
        payments_note: settings.payments_note,
        shipping_configured: Boolean(settings.shipping_configured),
        shipping_note: settings.shipping_note,
        demo_mode: Boolean(settings.demo_mode),
      };
      if (recordId) {
        await base44.entities.SiteSettings.update(recordId, payload);
      } else {
        const created = await base44.entities.SiteSettings.create(payload);
        setRecordId(created.id);
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const field = "rounded-xl border-white/15 bg-white/5 text-background placeholder:text-background/40";
  const label = "text-[11px] uppercase tracking-[0.14em] text-background/50";

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-3 text-background/60">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando configurações…
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-background/50">Loja</p>
          <h1 className="mt-2 font-heading text-3xl">Configurações</h1>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-gold">Configurações salvas.</span>}
          <Button type="submit" disabled={saving} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" strokeWidth={1.8} />}
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <Label className={label}>Nome da loja</Label>
            <Input value={settings.store_name || ""} onChange={(event) => update("store_name", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Assinatura curta</Label>
            <Input value={settings.tagline || ""} onChange={(event) => update("tagline", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Faixa de aviso no topo</Label>
            <Input value={settings.announcement || ""} onChange={(event) => update("announcement", event.target.value)} className={`mt-2 ${field}`} />
            <p className="mt-2 text-xs text-background/45">Deixe em branco para esconder a faixa.</p>
          </div>
          <div>
            <Label className={label}>Texto curto sobre a loja</Label>
            <Textarea value={settings.about_short || ""} onChange={(event) => update("about_short", event.target.value)} rows={4} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Endereço</Label>
            <Input value={settings.address || ""} onChange={(event) => update("address", event.target.value)} className={`mt-2 ${field}`} />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <Label className={label}>WhatsApp (somente números, com país e DDD)</Label>
            <Input
              value={settings.whatsapp_number || ""}
              onChange={(event) => update("whatsapp_number", event.target.value)}
              placeholder="5531999999999"
              className={`mt-2 ${field}`}
            />
            <p className="mt-2 text-xs text-background/45">Usado no botão flutuante, no rodapé e nos contatos.</p>
          </div>
          <div>
            <Label className={label}>Mensagem inicial do WhatsApp</Label>
            <Textarea value={settings.whatsapp_message || ""} onChange={(event) => update("whatsapp_message", event.target.value)} rows={3} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>E-mail de contato</Label>
            <Input value={settings.contact_email || ""} onChange={(event) => update("contact_email", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Instagram (sem @)</Label>
            <Input value={settings.instagram || ""} onChange={(event) => update("instagram", event.target.value)} className={`mt-2 ${field}`} />
          </div>
          <div>
            <Label className={label}>Endereço do logo (opcional)</Label>
            <Input value={settings.logo_url || ""} onChange={(event) => update("logo_url", event.target.value)} className={`mt-2 ${field}`} />
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-white/10 pt-8">
        <h2 className="font-heading text-2xl">Pagamento e frete</h2>
        <p className="text-sm text-background/60">
          O checkout usa o Stripe para cobrar os produtos. O frete ainda não tem cálculo automático: enquanto não houver uma
          integração de frete configurada, o valor é combinado com o cliente e registrado no pedido pelo painel.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-background/80">Pagamento configurado (Stripe)</span>
              <Switch checked={Boolean(settings.payments_configured)} onCheckedChange={(value) => update("payments_configured", value)} />
            </div>
            <Textarea
              value={settings.payments_note || ""}
              onChange={(event) => update("payments_note", event.target.value)}
              rows={3}
              className={field}
            />
          </div>
          <div className="space-y-3 border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-background/80">Frete configurado</span>
              <Switch checked={Boolean(settings.shipping_configured)} onCheckedChange={(value) => update("shipping_configured", value)} />
            </div>
            <Textarea
              value={settings.shipping_note || ""}
              onChange={(event) => update("shipping_note", event.target.value)}
              rows={3}
              className={field}
            />
            <p className="text-xs text-background/45">
              Enquanto esta opção estiver desligada, o site informa que o frete será combinado, sem simular valores de entrega.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border border-white/10 px-4 py-3">
          <div>
            <span className="text-sm text-background/80">Aviso de catálogo de demonstração</span>
            <p className="text-xs text-background/45">Mostra a faixa informando que os produtos exibidos são exemplos.</p>
          </div>
          <Switch checked={Boolean(settings.demo_mode)} onCheckedChange={(value) => update("demo_mode", value)} />
        </div>
      </section>
    </form>
  );
}