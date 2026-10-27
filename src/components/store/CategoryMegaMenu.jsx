import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { buildCategoryTree, orderNiches } from "@/lib/categoryTree";

export default function CategoryMegaMenu({ categories }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const { pathname } = useLocation();
  const niches = orderNiches(buildCategoryTree(categories));

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!niches.length) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 text-[13px] tracking-[0.08em] text-[color:var(--cine-nav)] transition-colors hover:text-[color:var(--cine-accent)]"
      >
        Categorias
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.6}
        />
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-7 max-h-[78vh] w-[min(88vw,760px)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-gold/35 bg-card shadow-2xl">
          <div className="grid gap-x-10 gap-y-7 p-7 sm:grid-cols-2">
            {niches.map((niche) => (
              <div key={niche.id}>
                <Link
                  to={`/catalogo?categoria=${niche.slug}`}
                  className="font-heading text-[17px] leading-[1.2] text-foreground transition-colors hover:text-gold"
                >
                  {niche.name}
                </Link>
                {niche.children.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Subcategorias</p>
                    <div className="mt-2 flex flex-col gap-2 border-l border-gold/25 pl-3">
                      {niche.children.map((child) => (
                        <Link
                          key={child.id}
                          to={`/catalogo?categoria=${child.slug}`}
                          className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-gold/25 px-7 py-4">
            <Link to="/catalogo" className="cine-link">
              Ver catálogo completo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}