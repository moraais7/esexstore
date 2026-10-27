import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/store/ProductCard";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { whatsappLink } from "@/lib/format";

const HERO_IMAGE = "https://base44.app/api/apps/6adfa4dcd5a6331f0bfc3bfa/files/mp/public/6adfa4dcd5a6331f0bfc3bfa/8cebe7e33_esex-banner-desktop.jpg";
const HERO_IMAGE_MOBILE = "https://base44.app/api/apps/6adfa4dcd5a6331f0bfc3bfa/files/mp/public/6adfa4dcd5a6331f0bfc3bfa/59a5fe5a9_esex-banner-mobile.jpg";
const BRAND_IMAGE = "https://base44.app/api/apps/6adfa4dcd5a6331f0bfc3bfa/files/mp/public/6adfa4dcd5a6331f0bfc3bfa/062473ca6_esex-boutique.webp";

const SEALS = [
{ icon: ShieldCheck, title: "Pagamento seguro", text: "Processado pelo Stripe, sem guardar dados do cartão na loja." },
{ icon: MessageCircle, title: "Atendimento próximo", text: "Consultoria pelo WhatsApp para escolher com tranquilidade." },
{ icon: Truck, title: "Envio e trocas", text: "Regras de frete e trocas publicadas nas páginas institucionais." }];


export default function Home() {
  const { settings } = useStoreSettings();
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasDemo, setHasDemo] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [catPage, featuredPage] = await Promise.all([
      base44.entities.Category.filter({ active: true }, { sort: "sort_order", limit: 60 }),
      base44.entities.Product.filter({ visible: true, status: "active", featured: true }, { sort: "-created_date", limit: 8 })]
      );
      let products = featuredPage.items || [];
      if (!products.length) {
        const latest = await base44.entities.Product.filter({ visible: true, status: "active" }, { sort: "-created_date", limit: 8 });
        products = latest.items || [];
      }
      const tops = (catPage.items || []).filter((category) => !category.parent_slug);
      const counts = await Promise.all(
        tops.map((category) => base44.entities.Product.count({ visible: true, status: "active", categories: category.slug }).catch(() => 0))
      );
      if (!active) return;
      setCategories(tops.map((category, index) => ({ ...category, count: counts[index] })));
      setFeatured(products);
      setHasDemo(products.some((product) => product.is_demo));
    };
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const wa = whatsappLink(settings.whatsapp_number, settings.whatsapp_message);
  const categoryName = (product) =>
  categories.find((category) => (product.categories || []).includes(category.slug))?.name || "";

  return (
    <div>
      <section className="relative isolate flex min-h-[400px] flex-col items-center justify-center overflow-hidden bg-background px-6 py-10 text-center sm:min-h-[420px] sm:px-10 lg:min-h-[400px] lg:px-[140px]">
        <div className="cine-hero-bg">
          <Image
            src={HERO_IMAGE_MOBILE}
            alt="Banner Esex Store com a caixa e a mensagem o que tem nela é segredo nosso"
            className="sm:hidden" />
          
          <Image
            src={HERO_IMAGE}
            alt="Banner Esex Store com a caixa e a mensagem o que tem nela é segredo nosso"
            className="hidden sm:block" />
          
        </div>

        <div className="relative z-[1] flex flex-col items-center">
          <div className="cine-rule" />
          <h1 className="cine-rise my-6 max-w-[820px] font-heading text-[38px] leading-[1.06] text-foreground sm:text-[48px] lg:text-[52px]">
            Cuidado, prazer e discrição em cada detalhe
          </h1>
          <div className="cine-rule" />
          <p className="cine-fade mt-5 max-w-[520px] text-[15px] leading-[1.7] text-foreground/85">
            {settings.tagline}
          </p>
          <p className="cine-fade mt-2.5 max-w-[520px] text-[15px] leading-[1.7] text-foreground/85 [animation-delay:.5s]">
            {settings.about_short || "Curadoria de produtos de bem-estar íntimo, com atendimento próximo e compra simples."}
          </p>
          <div className="cine-fade mt-7 flex flex-wrap items-center justify-center gap-4 [animation-delay:.8s]">
            <Link to="/catalogo" className="cine-btn cine-btn-fill">
              Explorar o catálogo
            </Link>
            {wa &&
            <a href={wa} target="_blank" rel="noopener noreferrer" className="cine-btn cine-btn-line">
                <MessageCircle className="h-4 w-4" strokeWidth={1.6} /> Falar com a loja
              </a>
            }
          </div>
        </div>
      </section>

      {hasDemo &&
      <div className="border-y border-gold/25 bg-secondary px-6 py-3.5 text-center text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Catálogo de demonstração: produtos, preços e estoques exibidos são exemplos até a importação do catálogo real.
        </div>
      }

      <section className="py-20 lg:py-24">
        <div className="shell mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-gold">Navegue por</p>
            <h2 className="mt-3 font-heading text-3xl leading-[1.05] sm:text-[42px]">Categorias</h2>
          </div>
          <Link to="/catalogo" className="cine-link">
            Ver catálogo completo
          </Link>
        </div>
        <div className="cine-band px-5 py-11 sm:px-8">
          <div className="shell grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
            {loading &&
            Array.from({ length: 8 }).map((_, index) =>
            <Skeleton key={index} className="h-[140px] w-full bg-foreground/10" />
            )}
            {!loading &&
            categories.map((category) =>
            <Link key={category.id} to={`/catalogo?categoria=${category.slug}`} className="cine-glass">
                  <b className="font-heading text-[18px] font-normal leading-[1.2]">{category.name}</b>
                  <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-gold">
                    {category.count > 0 ? `${category.count} ${category.count === 1 ? "item" : "itens"}` : "Em breve"}
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </span>
                </Link>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-gold/20 py-20 lg:py-24">
        <div className="shell">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-gold">Seleção da casa</p>
              <h2 className="mt-3 font-heading text-3xl leading-[1.05] sm:text-[42px]">Produtos em destaque</h2>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {loading &&
            Array.from({ length: 4 }).map((_, index) =>
            <Skeleton key={index} className="aspect-square w-full bg-foreground/10" />
            )}
            {!loading &&
            featured.map((product) =>
            <ProductCard key={product.id} product={product} categoryName={categoryName(product)} />
            )}
          </div>
          {!loading && !featured.length &&
          <p className="mt-8 text-sm text-muted-foreground">
              Nenhum produto publicado ainda. Importe o catálogo na área administrativa para começar.
            </p>
          }
        </div>
      </section>

      <section className="cine-band px-5 py-20 sm:px-8 lg:py-[90px]">
        <div className="shell relative z-[1]">
          <div className="grid overflow-hidden rounded-2xl border border-gold/30 bg-card lg:grid-cols-2">
            <div className="aspect-[4/5] overflow-hidden bg-muted">
              <Image src={BRAND_IMAGE} alt="Modelo com body de couro ecológico preto" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col justify-center px-6 py-10 lg:px-12 lg:py-[54px]">
              <p className="eyebrow text-gold">A boutique</p>
              <h2 className="mt-3 font-heading text-3xl leading-[1.05] sm:text-[38px]">Uma curadoria pensada para o seu bem-estar</h2>
              <p className="mt-6 border-l border-gold pl-5 text-[15px] leading-[1.8] text-muted-foreground">
                {settings.about_short ||
                "A Esex Store reúne produtos de bem-estar íntimo escolhidos um a um, com orientação próxima e um processo de compra discreto."}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/pagina/sobre" className="cine-btn cine-btn-line">
                  Conhecer a loja
                </Link>
                <Link to="/catalogo" className="cine-btn cine-btn-fill">
                  Ver produtos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="shell">
          <div className="grid overflow-hidden rounded-2xl border border-gold/30 sm:grid-cols-3">
            {SEALS.map((seal) =>
            <div
              key={seal.title}
              className="border-gold/30 px-8 py-10 max-sm:border-b max-sm:last:border-b-0 sm:border-r sm:last:border-r-0">
              
                <seal.icon className="h-6 w-6 text-gold" strokeWidth={1.4} />
                <h3 className="mb-2.5 mt-[18px] font-heading text-2xl">{seal.title}</h3>
                <p className="text-[13.5px] leading-[1.75] text-muted-foreground">{seal.text}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>);

}