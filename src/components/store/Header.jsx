import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCart } from "@/context/CartContext";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ThemeToggle from "@/components/store/ThemeToggle";
import CategoryMegaMenu from "@/components/store/CategoryMegaMenu";
import { buildCategoryTree, orderNiches } from "@/lib/categoryTree";

const NAV = [
  { to: "/", label: "Início" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/contato", label: "Contato" },
];

const LOGO_URL = "https://base44.app/api/apps/6adfa4dcd5a6331f0bfc3bfa/files/mp/public/6adfa4dcd5a6331f0bfc3bfa/8fafc6dca_logo-esex.webp";

const SEARCH_FIELD =
  "rounded-xl border-gold/35 bg-secondary text-xs tracking-[0.06em] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-gold focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

export default function Header({ theme, onToggleTheme }) {
  const { settings } = useStoreSettings();
  const { count } = useCart();
  const [categories, setCategories] = useState([]);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    base44.entities.Category.filter({ active: true }, { sort: "sort_order", limit: 30 })
      .then(({ items }) => setCategories(items || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const categoryTree = orderNiches(buildCategoryTree(categories));

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(term.trim() ? `/catalogo?q=${encodeURIComponent(term.trim())}` : "/catalogo");
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
      {settings.announcement && (
        <div className="cine-bar py-2.5 text-center text-[11px] uppercase tracking-[0.24em]">
          {settings.announcement}
        </div>
      )}

      <div className="border-b border-gold/35">
        <div className="shell flex h-[76px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" strokeWidth={1.6} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[86%] max-w-sm p-0">
                <SheetTitle className="sr-only">Menu da loja</SheetTitle>
                <div className="flex h-full flex-col gap-6 p-6">
                  <Image
                    src={settings.logo_url || LOGO_URL}
                    alt={settings.store_name}
                    fittingType="fit"
                    className={`h-10 w-[66px] object-contain ${theme === "dark" ? "brightness-0 invert" : ""}`}
                  />
                  <form onSubmit={submitSearch} className="flex gap-2">
                    <Input
                      value={term}
                      onChange={(event) => setTerm(event.target.value)}
                      placeholder="Buscar produto"
                      className={`${SEARCH_FIELD} h-[34px] w-full`}
                    />
                    <Button type="submit" size="icon" variant="outline" className="h-[34px] w-[34px] rounded-full border-gold/35" aria-label="Buscar">
                      <Search className="h-4 w-4" strokeWidth={1.6} />
                    </Button>
                  </form>
                  <nav className="cine-nav flex flex-col gap-4">
                    {NAV.map((item) => (
                      <Link key={item.to} to={item.to} className="font-heading text-xl">
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="space-y-4 border-t border-gold/25 pt-5">
                    <p className="eyebrow text-gold">Categorias</p>
                    <div className="cine-nav flex flex-col gap-5">
                      {categoryTree.map((niche) => (
                        <div key={niche.id}>
                          <Link to={`/catalogo?categoria=${niche.slug}`} className="text-[14px]">
                            {niche.name}
                          </Link>
                          {niche.children.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2 border-l border-gold/25 pl-3">
                              {niche.children.map((child) => (
                                <Link
                                  key={child.id}
                                  to={`/catalogo?categoria=${child.slug}`}
                                  className="text-[12.5px] text-muted-foreground"
                                >
                                  {child.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Link to="/" aria-label={settings.store_name} className="inline-flex">
              <Image
                src={settings.logo_url || LOGO_URL}
                alt={settings.store_name}
                fittingType="fit"
                className={`h-10 w-[66px] object-contain ${theme === "dark" ? "brightness-0 invert" : ""}`}
              />
            </Link>
          </div>

          <nav className="cine-nav hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
            <CategoryMegaMenu categories={categories} />
          </nav>

          <div className="flex items-center gap-2">
            <form onSubmit={submitSearch} className="hidden items-center lg:flex">
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Buscar produto"
                className={`${SEARCH_FIELD} h-[34px] w-[170px]`}
              />
            </form>
            <Link to="/catalogo" className="lg:hidden" aria-label="Catálogo">
              <Button variant="ghost" size="icon">
                <Search className="h-5 w-5" strokeWidth={1.6} />
              </Button>
            </Link>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <Link to="/carrinho" aria-label="Carrinho">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-medium text-background">
                    {count}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </div>

    </header>
  );
}