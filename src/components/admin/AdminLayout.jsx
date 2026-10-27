import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/admin", label: "Visão geral", end: true },
  { to: "/admin/produtos", label: "Produtos" },
  { to: "/admin/categorias", label: "Categorias" },
  { to: "/admin/pedidos", label: "Pedidos" },
  { to: "/admin/importar", label: "Importar CSV" },
  { to: "/admin/imagens", label: "Imagens" },
  { to: "/admin/paginas", label: "Conteúdo" },
  { to: "/admin/configuracoes", label: "Configurações" },
  { to: "/admin/plataforma", label: "Plataforma e migração" },
];

export default function AdminLayout() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    base44.auth
      .me()
      .then((me) => {
        setUser(me);
        setStatus(me?.role === "admin" ? "ready" : "denied");
      })
      .catch((error) => {
        if (error?.status === 401) {
          base44.auth.redirectToLogin(window.location.href);
          return;
        }
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-foreground text-background">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-foreground px-6 text-background">
        <div className="max-w-md space-y-4 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-gold" strokeWidth={1.4} />
          <h1 className="font-heading text-2xl">
            {status === "denied" ? "Acesso restrito a administradores" : "Não foi possível verificar seu acesso"}
          </h1>
          <p className="text-sm text-background/70">
            {status === "denied"
              ? `Você está conectado como ${user?.email || "outro usuário"}. Peça a um administrador para conceder acesso de administrador à sua conta.`
              : "Tente novamente em instantes ou volte para a loja."}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button asChild variant="outline" className="rounded-xl border-background/30 text-background hover:bg-background/10">
              <Link to="/">Voltar para a loja</Link>
            </Button>
            <Button variant="ghost" className="rounded-xl text-background hover:bg-background/10" onClick={() => base44.auth.logout("/")}>
              <LogOut className="mr-2 h-4 w-4" strokeWidth={1.6} /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell min-h-screen bg-foreground text-background">
      <header className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-background/60 hover:text-background">
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} /> Loja
              </Link>
              <span className="font-display text-lg tracking-[0.22em]">Painel Esex</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-background/60">
              <span className="hidden sm:inline">{user?.email}</span>
              <button type="button" onClick={() => base44.auth.logout("/")} className="inline-flex items-center gap-1.5 hover:text-background">
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} /> Sair
              </button>
            </div>
          </div>
          <nav className="flex gap-5 overflow-x-auto pb-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap text-xs uppercase tracking-[0.18em] transition-colors ${
                    isActive ? "text-gold" : "text-background/60 hover:text-background"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}