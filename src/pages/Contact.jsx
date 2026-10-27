import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { whatsappLink } from "@/lib/format";

export default function Contact() {
  const { settings } = useStoreSettings();
  const wa = whatsappLink(settings.whatsapp_number, settings.whatsapp_message);

  return (
    <div className="shell max-w-4xl py-16 lg:py-20">
      <p className="eyebrow">Atendimento</p>
      <h1 className="mt-3 font-heading text-3xl sm:text-4xl">Fale com a Esex Store</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        O atendimento é feito pelo WhatsApp, com orientação sobre produtos, tamanhos e formas de envio. Também
        respondemos por e-mail quando informado.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="cine-panel p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-secondary/50 text-gold">
            <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <h2 className="mt-4 font-heading text-xl">WhatsApp</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {settings.whatsapp_number ? "Atendimento direto com a loja." : "Número ainda não configurado pela loja."}
          </p>
          {wa ? (
            <Button asChild className="mt-5 h-11 rounded-xl">
              <a href={wa} target="_blank" rel="noopener noreferrer">Abrir conversa</a>
            </Button>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">O número é configurado na área administrativa.</p>
          )}
        </div>

        <div className="cine-panel p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-secondary/50 text-gold">
            <Mail className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <h2 className="mt-4 font-heading text-xl">E-mail</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {settings.contact_email || "E-mail ainda não configurado pela loja."}
          </p>
          {settings.contact_email && (
            <a href={`mailto:${settings.contact_email}`} className="mt-5 inline-block text-sm underline underline-offset-4">
              Enviar e-mail
            </a>
          )}
        </div>

        <div className="cine-panel p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-secondary/50 text-gold">
            <Instagram className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <h2 className="mt-4 font-heading text-xl">Instagram</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {settings.instagram ? `@${String(settings.instagram).replace("@", "")}` : "Perfil ainda não configurado pela loja."}
          </p>
          {settings.instagram && (
            <a
              href={`https://instagram.com/${String(settings.instagram).replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block text-sm underline underline-offset-4"
            >
              Abrir perfil
            </a>
          )}
        </div>

        <div className="cine-panel p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/25 bg-secondary/50 text-gold">
            <MapPin className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <h2 className="mt-4 font-heading text-xl">Endereço</h2>
          <p className="mt-2 text-sm text-muted-foreground">{settings.address || "Endereço a configurar pela loja."}</p>
        </div>
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <p className="text-sm text-muted-foreground">
          Dúvidas sobre pagamento, frete ou trocas? Veja as{" "}
          <Link to="/pagina/duvidas-frequentes" className="underline underline-offset-4 hover:text-foreground">
            dúvidas frequentes
          </Link>{" "}
          ou as páginas institucionais no rodapé.
        </p>
      </div>
    </div>
  );
}