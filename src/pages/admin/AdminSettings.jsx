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
  const [error, setError] = useState("");
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState("");

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
      .catch(() => { setError("Não foi possível carregar as configurações."); })
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
    setSaved(false); setError("");
    try {
      if (settings.shipping_configured && settings.shipping_provider === "melhor_envio" && digitsOnly(settings.shipping_origin_postal_code).length !== 8) throw new Error("Informe o CEP de origem com 8 dígitos.");
      if (settings.shipping_configured && settings.shipping_provider === "fixed" && (settings.shipping_fixed_price === "" || settings.shipping_fixed_price == null || !Number.isFinite(Number(settings.shipping_fixed_price)) || Number(settings.shipping_fixed_price) < 0 || !Number.isInteger(Number(settings.shipping_fixed_days)) || Number(settings.shipping_fixed_days) < 1)) throw new Error("Informe a tarifa e um prazo de entrega válido.");
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
        shipping_provider: settings.shipping_provider,
        shipping_origin_postal_code: digitsOnly(settings.shipping_origin_postal_code),
        shipping_sandbox: Boolean(settings.shipping_sandbox),
        ...(settings.shipping_fixed_price !== "" && settings.shipping_fixed_price != null ? { shipping_fixed_price: Number(settings.shipping_fixed_price) } : {}),
        ...(settings.shipping_fixed_days !== "" && settings.shipping_fixed_days != null ? { shipping_fixed_days: Number(settings.shipping_fixed_days) } : {}),
        demo_mode: Boolean(settings.demo_mode),
      };
      if (recordId) {
        await base44.entities.SiteSettings.update(recordId, payload);
      } else {
        const created = await base44.entities.SiteSettings.create(payload);
        setRecordId(created.id);
      }
      setSaved(true);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const repairVariants = async () => {
    setRepairing(true); setRepairResult(""); setError("");
    try {
      let cursor;
      let fixed = 0; let unresolved = 0;
      do {
        const { data } = await base44.functions.invoke("relinkVariants", { cursor });
        fixed += data.fixed; unresolved += data.unresolved; cursor = data.next_cursor;
      } while (cursor);
      setRepairResult(`${fixed} vínculo(s) corrigido(s). ${unresolved} variação(ões) precisam de revisão manual.`);
    } catch (err) { setError(err?.response?.data?.error || err.message); }
    finally { setRepairing(false); }
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

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
          O checkout cobra produtos e frete juntos pelo Stripe. Habilite o pagamento após configurar as credenciais e o webhook no Base44. O frete precisa estar habilitado para aceitar compras.
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
              Com o frete desligado, novas compras ficam bloqueadas até a configuração da entrega.
            </p>
          </div>
        </div>
        <div className="grid gap-5 border border-white/10 p-4 lg:grid-cols-2">
          <div><Label className={label}>Serviço de frete</Label><select value={settings.shipping_provider} onChange={e => update("shipping_provider", e.target.value)} className={`mt-2 w-full rounded-xl p-3 ${field}`}><option className="text-black" value="melhor_envio">Melhor Envio — cotação por CEP</option><option className="text-black" value="fixed">Tarifa única — todos os CEPs do Brasil</option></select></div>
          {settings.shipping_provider === "melhor_envio" ? <>
            <div><Label className={label}>CEP de origem</Label><Input value={settings.shipping_origin_postal_code || ""} onChange={e => update("shipping_origin_postal_code", e.target.value)} maxLength={9} className={`mt-2 ${field}`} /></div>
            <div className="flex items-center justify-between gap-4"><span className="text-sm">Melhor Envio em sandbox (teste)</span><Switch checked={Boolean(settings.shipping_sandbox)} onCheckedChange={value => update("shipping_sandbox", value)} /></div>
            <p className="text-xs text-background/60">Cadastre MELHOR_ENVIO_TOKEN e MELHOR_ENVIO_CONTACT nos segredos do Base44. Confira peso e medidas de cada variação. Cotações de teste não aceitam cobranças reais.</p>
          </> : <>
            <div><Label className={label}>Tarifa da loja (R$)</Label><Input type="number" min="0" step="0.01" value={settings.shipping_fixed_price ?? ""} onChange={e => update("shipping_fixed_price", e.target.value)} className={`mt-2 ${field}`} /></div>
            <div><Label className={label}>Prazo de transporte (dias úteis)</Label><Input type="number" min="1" step="1" value={settings.shipping_fixed_days ?? ""} onChange={e => update("shipping_fixed_days", e.target.value)} className={`mt-2 ${field}`} /></div>
            <p className="text-xs text-background/60">Use apenas se a loja puder atender todos os CEPs com este preço e prazo. Zero significa frete grátis.</p>
          </>}
        </div>
        <div className="space-y-3 border border-white/10 p-4">
          <p className="text-sm">Confirmação por e-mail</p><p className="text-xs text-background/60">Configure RESEND_API_KEY e ORDER_EMAIL_FROM (remetente com domínio verificado) nos segredos do Base44. A confirmação será enviada após o pagamento aprovado. Falhas ficam registradas no pedido.</p>
          <Button type="button" variant="outline" className="rounded-xl bg-transparent" disabled={repairing} onClick={repairVariants}>{repairing ? "Verificando catálogo…" : "Corrigir vínculos das variações importadas"}</Button>
          {repairResult && <p role="status" className="text-xs text-gold">{repairResult}</p>}
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