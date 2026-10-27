import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TARGET_FIELDS, autoMap, buildCatalog, decodeCsvBuffer, detectDelimiter, parseDelimited } from "@/lib/csv";
import { brl } from "@/lib/format";

const CHUNK_SIZE = 40;

export default function AdminImport() {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState([]);
  const [options, setOptions] = useState({ updateExisting: true, markDraft: true });
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const preview = useMemo(
    () => (rows.length && mapping.length ? buildCatalog(rows, mapping, { markDraft: options.markDraft }) : null),
    [rows, mapping, options.markDraft]
  );

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReading(true);
    setError(null);
    setReport(null);
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeCsvBuffer(buffer);
      const delimiter = detectDelimiter(text);
      const parsed = parseDelimited(text, delimiter);
      if (!parsed.columns.length || !parsed.rows.length) throw new Error("arquivo sem linhas");
      setFileName(file.name);
      setColumns(parsed.columns);
      setRows(parsed.rows);
      setMapping(autoMap(parsed.columns));
      setStep(2);
    } catch (err) {
      setError("Não foi possível ler o arquivo. Use o CSV exportado da Nuvemshop, com cabeçalho na primeira linha.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const runImport = async () => {
    if (!preview?.products?.length) return;
    if (preview.errors.length) { setError("Corrija as inconsistências indicadas antes de importar. Nenhum produto foi gravado."); return; }
    setStep(3);
    setError(null);
    const totals = { products_created: 0, products_updated: 0, variants_created: 0, variants_updated: 0, categories_created: 0, errors: [] };
    setProgress({ done: 0, total: preview.products.length });
    try {
      for (let index = 0; index < preview.products.length; index += CHUNK_SIZE) {
        const chunk = preview.products.slice(index, index + CHUNK_SIZE);
        const response = await base44.functions.invoke("importCatalog", {
          products: chunk,
          options: { updateExisting: options.updateExisting },
        });
        const summary = response?.data?.summary;
        if (!summary) throw new Error(response?.data?.error || "A importação foi interrompida.");
        totals.products_created += summary.products_created || 0;
        totals.products_updated += summary.products_updated || 0;
        totals.variants_created += summary.variants_created || 0;
        totals.variants_updated += summary.variants_updated || 0;
        totals.categories_created += summary.categories_created || 0;
        totals.errors.push(...(summary.errors || []));
        setProgress({ done: Math.min(preview.products.length, index + chunk.length), total: preview.products.length });
      }

      await base44.entities.ImportBatch.create({
        file_name: fileName,
        mode: options.updateExisting ? "atualizar_existentes" : "apenas_novos",
        rows_total: preview.stats.rows,
        products_created: totals.products_created,
        products_updated: totals.products_updated,
        variants_created: totals.variants_created,
        variants_updated: totals.variants_updated,
        rows_failed: totals.errors.length,
        errors: totals.errors.slice(0, 60),
        status: "completed",
        image_step_pending: true,
        notes: `${preview.stats.products} produtos e ${preview.stats.variants} variações analisados do arquivo.`,
      });

      setReport({ ...totals, stats: preview.stats, columns: columns.length });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Não foi possível concluir a importação.");
    } finally {
      setProgress(null);
    }
  };

  const downloadErrors = () => {
    const lines = ["linha;codigo;mensagem", ...(report?.errors || []).map((item) => `${item.row};${item.code};"${String(item.message).replace(/"/g, '""')}"`)];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-importacao-esex.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep(1);
    setFileName("");
    setColumns([]);
    setRows([]);
    setMapping([]);
    setReport(null);
    setError(null);
  };

  const selectStyle = "rounded-xl border-white/15 bg-white/5 text-background";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-background/50">Importação</p>
        <h1 className="mt-2 font-heading text-3xl">Catálogo da Nuvemshop</h1>
        <p className="mt-2 max-w-3xl text-sm text-background/60">
          O arquivo é lido no seu navegador, você confere o mapeamento das colunas e só então gravamos os produtos. As
          variações entram agrupadas no produto certo, com identificação de duplicidades e relatório de erros. As fotos são
          importadas em uma etapa separada.
        </p>
      </div>

      <div className="flex flex-wrap gap-6 border-b border-white/10 pb-4 text-xs uppercase tracking-[0.16em]">
        {["1. Arquivo", "2. Mapeamento e prévia", "3. Importação"].map((label, index) => (
          <span key={label} className={step === index + 1 ? "text-gold" : "text-background/40"}>
            {label}
          </span>
        ))}
      </div>

      {error && <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {step === 1 && (
        <div className="border border-dashed border-white/20 p-12 text-center">
          <FileSpreadsheet className="mx-auto h-8 w-8 text-gold" strokeWidth={1.4} />
          <h2 className="mt-4 font-heading text-2xl">Envie o CSV exportado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-background/60">
            Aceita o arquivo da Nuvemshop com separador por ponto e vírgula e acentuação em ISO-8859-1. Tamanho máximo
            recomendado: 10 MB.
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={reading}
              className="rounded-xl bg-gold text-foreground hover:bg-gold/90"
            >
              {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" strokeWidth={1.8} />}
              {reading ? "Lendo arquivo…" : "Escolher arquivo CSV"}
            </Button>
          </div>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-background/70">
              {fileName} · {rows.length} linhas · {columns.length} colunas
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10" onClick={reset}>
                Trocar arquivo
              </Button>
              <Button onClick={runImport} disabled={preview.errors.length > 0} className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
                Importar {preview.stats.products} produtos
              </Button>
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Produtos identificados", value: preview.stats.products },
              { label: "Variações encontradas", value: preview.stats.variants },
              { label: "Produtos com fotos no arquivo", value: preview.stats.withImages },
              { label: "Duplicidades no arquivo", value: preview.stats.duplicateRows },
              { label: "Sem preço informado", value: preview.stats.withoutPrice },
            ].map((card) => (
              <div key={card.label} className="border border-white/10 p-4">
                <p className="font-heading text-2xl">{card.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-background/50">{card.label}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="flex items-center justify-between border border-white/10 p-4">
              <div>
                <p className="text-sm text-background/80">Atualizar produtos que já existem</p>
                <p className="text-xs text-background/45">Casa pelo identificador de origem e pelo SKU, sem duplicar.</p>
              </div>
              <Switch checked={options.updateExisting} onCheckedChange={(value) => setOptions({ ...options, updateExisting: value })} />
            </div>
            <div className="flex items-center justify-between border border-white/10 p-4">
              <div>
                <p className="text-sm text-background/80">Importar como rascunho</p>
                <p className="text-xs text-background/45">Nada aparece na loja até você revisar e publicar.</p>
              </div>
              <Switch checked={options.markDraft} onCheckedChange={(value) => setOptions({ ...options, markDraft: value })} />
            </div>
            <div className="border border-white/10 p-4 text-xs text-background/60">
              {preview.stats.withImages > 0
                ? `O arquivo traz endereços de foto para ${preview.stats.withImages} produto(s) e elas entram junto na importação. As fotos que existem apenas como arquivo no seu computador vão na `
                : "As fotos não vêm neste arquivo. Depois de importar, use a "}
              <Link to="/admin/imagens" className="underline underline-offset-4 hover:text-background">
                etapa de imagens
              </Link>
              .
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-2xl">Mapeamento das colunas</h2>
            <div className="overflow-x-auto border border-white/10">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
                  <tr>
                    <th className="px-4 py-3">Coluna do arquivo</th>
                    <th className="px-4 py-3">Exemplo</th>
                    <th className="px-4 py-3">Campo na loja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {columns.map((column, index) => (
                    <tr key={`${column}-${index}`}>
                      <td className="px-4 py-3 text-background/80">{column || `coluna ${index + 1}`}</td>
                      <td className="max-w-[280px] truncate px-4 py-3 text-xs text-background/45">
                        {String(rows[0]?.cells[index] || "").slice(0, 60) || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={mapping[index] || "ignore"}
                          onValueChange={(value) => setMapping(mapping.map((field, position) => (position === index ? value : field)))}
                        >
                          <SelectTrigger className={`w-[260px] ${selectStyle}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_FIELDS.map((field) => (
                              <SelectItem key={field.key} value={field.key}>
                                {field.group === "—" ? field.label : `${field.group} · ${field.label}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-2xl">Prévia antes de confirmar</h2>
            {preview.errors.length > 0 && (
              <div className="border border-gold/30 bg-gold/[0.06] p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-gold">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.6} /> {preview.errors.length} inconsistências que precisam ser corrigidas antes da importação
                </p>
                <ul className="mt-3 space-y-1 text-xs text-background/70">
                  {preview.errors.slice(0, 6).map((item, index) => (
                    <li key={`${item.row}-${index}`}>linha {item.row}: {item.message}</li>
                  ))}
                </ul>
                {preview.errors.length > 6 && <p className="mt-2 text-xs text-background/50">e mais {preview.errors.length - 6} avisos…</p>}
              </div>
            )}

            {preview.notices.length > 0 && <p className="text-xs text-background/70">{preview.notices.length} registro(s) usam SKU compartilhado por opções diferentes. As opções serão preservadas com seus respectivos estoques.</p>}

            <div className="overflow-x-auto border border-white/10">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Categorias</th>
                    <th className="px-4 py-3">Variações</th>
                    <th className="px-4 py-3">Preço</th>
                    <th className="px-4 py-3">Estoque</th>
                    <th className="px-4 py-3">Pontos a revisar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {preview.products.slice(0, 12).map((product) => {
                    const prices = product.variants.map((variant) => variant.price || variant.promo_price).filter(Boolean);
                    return (
                      <tr key={product.slug}>
                        <td className="max-w-[260px] px-4 py-3">
                          <p className="truncate">{product.name}</p>
                          <p className="text-xs text-background/45">/{product.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-background/60">
                          {product.categories.map((category) => category.name).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-background/60">{product.variants.length}</td>
                        <td className="px-4 py-3">{prices.length ? brl(Math.min(...prices)) : <span className="text-gold">a confirmar</span>}</td>
                        <td className="px-4 py-3 text-xs text-background/60">
                          {product.variants.reduce((total, variant) => total + (Number(variant.stock) || 0), 0)}
                        </td>
                        <td className="px-4 py-3 text-xs text-background/50">{product.review_notes.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.products.length > 12 && (
              <p className="text-xs text-background/50">
                Mostrando 12 de {preview.products.length} produtos. Todos serão importados ao confirmar.
              </p>
            )}
          </section>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          {progress && (
            <div className="space-y-4 border border-white/10 p-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold" />
              <p className="font-heading text-2xl">Gravando o catálogo…</p>
              <p className="text-sm text-background/60">
                {progress.done} de {progress.total} produtos processados
              </p>
              <Progress value={Math.round((progress.done / Math.max(1, progress.total)) * 100)} className="h-1" />
            </div>
          )}

          {report && (
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-gold" strokeWidth={1.5} />
                <h2 className="font-heading text-3xl">Importação concluída</h2>
              </div>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Produtos criados", value: report.products_created },
                  { label: "Produtos atualizados", value: report.products_updated },
                  { label: "Variações criadas", value: report.variants_created },
                  { label: "Variações atualizadas", value: report.variants_updated },
                ].map((card) => (
                  <div key={card.label} className="border border-white/10 p-4">
                    <p className="font-heading text-2xl">{card.value}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-background/50">{card.label}</p>
                  </div>
                ))}
              </section>

              {report.stats.withImages > 0 && (
                <p className="text-sm text-background/60">
                  {report.stats.withImages} produto(s) já receberam as fotos indicadas no arquivo. As demais fotos entram na
                  etapa de imagens.
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-xl bg-gold text-foreground hover:bg-gold/90">
                  <Link to="/admin/imagens">
                    Importar as fotos agora <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.8} />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10">
                  <Link to="/admin/produtos">Revisar produtos</Link>
                </Button>
                {report.errors.length > 0 && (
                  <Button variant="outline" className="rounded-xl border-white/20 bg-transparent text-background hover:bg-white/10" onClick={downloadErrors}>
                    <Download className="mr-2 h-4 w-4" strokeWidth={1.8} /> Baixar relatório de erros
                  </Button>
                )}
                <Button variant="ghost" className="rounded-xl text-background/70 hover:bg-white/10 hover:text-background" onClick={reset}>
                  Importar outro arquivo
                </Button>
              </div>

              {report.errors.length > 0 && (
                <section className="space-y-3">
                  <h3 className="font-heading text-xl">Relatório de erros e avisos</h3>
                  <div className="max-h-72 overflow-y-auto border border-white/10">
                    <table className="w-full text-sm">
                      <thead className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.14em] text-background/45">
                        <tr>
                          <th className="px-4 py-2">Linha</th>
                          <th className="px-4 py-2">Código</th>
                          <th className="px-4 py-2">Detalhe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {report.errors.map((item, index) => (
                          <tr key={`${item.row}-${index}`}>
                            <td className="px-4 py-2 text-xs text-background/50">{item.row || "—"}</td>
                            <td className="px-4 py-2 text-xs text-background/70">{item.code}</td>
                            <td className="px-4 py-2 text-xs text-background/60">{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-background/45">
                    Os produtos importados entram como rascunho e marcados para revisão quando faltar preço, descrição ou foto.
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}