import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Instagram, Mail, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { whatsappLink } from "@/lib/format";

export default function Footer() {
  const { settings } = useStoreSettings();
  const [pages, setPages] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    base44.entities.ContentPage.filter({ status: "published", show_in_footer: true }, { sort: "sort_order", limit: 12 })
      .then(({ items }) => setPages(items || []))
      .catch(() => setPages([]));
    base44.entities.Category.filter({ active: true }, { sort: "sort_order", limit: 8 })
      .then(({ items }) => setCategories(items || []))
      .catch(() => setCategories([]));
  }, []);

  const wa = whatsappLink(settings.whatsapp_number, settings.whatsapp_message);

  return (
    <footer className="cine-foot mt-20 border-t border-gold">
      <div className="shell grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] lg:gap-14">
        <div>
          <p className="font-heading text-[22px] tracking-[0.18em]">{settings.store_name}</p>
          <p className="mt-4 max-w-[340px] text-[13.5px] leading-[1.8] text-muted-foreground">
            {settings.about_short || settings.tagline}
          </p>
          <div className="mt-4">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-gold" strokeWidth={1.6} /> WhatsApp
              </a>
            )}
            {settings.contact_email && (
              <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gold" strokeWidth={1.6} /> {settings.contact_email}
              </a>
            )}
            {settings.instagram && (
              <a
                href={`https://instagram.com/${String(settings.instagram).replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Instagram className="h-4 w-4 text-gold" strokeWidth={1.6} /> @{String(settings.instagram).replace("@", "")}
              </a>
            )}
          </div>
        </div>

        <div>
          <p className="eyebrow text-gold">Comprar</p>
          <div>
            <Link to="/catalogo">Todos os produtos</Link>
            {categories.map((category) => (
              <Link key={category.id} to={`/catalogo?categoria=${category.slug}`}>
                {category.name}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow text-gold">Institucional</p>
          <div>
            {pages.map((page) => (
              <Link key={page.id} to={`/pagina/${page.slug}`}>
                {page.title}
              </Link>
            ))}
            <Link to="/contato">Contato</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-gold/30">
        <div className="shell flex flex-col gap-4 py-5 text-xs leading-[1.7] text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p>
              © {new Date().getFullYear()} {settings.store_name}. {settings.address || "Endereço a configurar."}
            </p>
            <p>Pagamento processado pelo Stripe. {settings.shipping_note}</p>
          </div>
          <Link to="/admin" className="underline hover:text-gold">
            Área administrativa
          </Link>
        </div>
      </div>
    </footer>
  );
}