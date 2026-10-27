import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { sanitizeHtml } from "@/lib/sanitize";

export default function InstitutionalPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    base44.entities.ContentPage.filter({ slug, status: "published" }, { limit: 1 })
      .then(({ items }) => {
        if (!active) return;
        if (items?.[0]) {
          setPage(items[0]);
          setStatus("ready");
        } else {
          setStatus("missing");
        }
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (status !== "missing") return undefined;
    const meta = document.createElement("meta");
    meta.name = "prerender-status-code";
    meta.content = "404";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [status]);

  useEffect(() => {
    if (page) document.title = `${page.title} | Esex Store`;
  }, [page]);

  if (status === "loading") {
    return (
      <div className="shell max-w-3xl py-14 lg:py-20">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-8 h-40 w-full" />
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="shell max-w-2xl py-24 text-center">
        <p className="eyebrow">Página não encontrada</p>
        <h1 className="mt-3 font-heading text-3xl">Este conteúdo não está disponível</h1>
        <p className="mt-3 text-sm text-muted-foreground">Ele pode ter sido despublicado ou estar em revisão pela loja.</p>
        <Button asChild className="mt-8 rounded-xl">
          <Link to="/">Voltar para a loja</Link>
        </Button>
      </div>
    );
  }

  return (
    <article className="shell max-w-3xl py-16 lg:py-20">
      <p className="eyebrow">{page.subtitle || "Institucional"}</p>
      <h1 className="mt-3 font-heading text-3xl sm:text-4xl">{page.title}</h1>
      {page.needs_review && (
        <p className="mt-5 border-l-2 border-gold pl-3 text-xs text-muted-foreground">
          Conteúdo em revisão pela loja.
        </p>
      )}
      <div className="prose-store mt-8 text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }} />
      <div className="mt-12 border-t border-border pt-8">
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/contato">Falar com a loja</Link>
        </Button>
      </div>
    </article>
  );
}