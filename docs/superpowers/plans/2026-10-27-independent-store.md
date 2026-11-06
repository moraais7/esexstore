# Independent Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a loja em código independente, preservando a experiência existente e sem alterar a loja em operação.
**Architecture:** React/Vite + Node.js 24 + SQLite em volume persistente, API de mesma origem, sessões HttpOnly e integrações diretas.
**Tech Stack:** React, Vite, Node HTTP/crypto/sqlite, Docker.
**Spec:** docs/superpowers/specs/2026-10-27-independent-store-design.md

## Global Constraints
- Nenhuma publicação, troca de DNS, cobrança real ou inclusão de credenciais.
- Preservar visual e garantias de preço, cotação, estoque e webhook.
- Todos os contratos de API são os da especificação; dados privados não entram no seed público.
- Node.js 24; SQLite persistente em instância única.

## Review Focus
- Visitante tentando consultar dados privados ou escrever entidades: negar.
- Duas reservas/expiração concorrentes: não perder nem duplicar estoque.
- Sessão inválida e mutação de outra origem: negar sem autenticar.
- Upload disfarçado/rota fora do diretório público: negar.
- Reinício/reimportação: preservar banco, pedidos e catálogo existente.

### Task 1: Backend persistente e autenticação
**Files:** server/database.js, server/runtime.js, server/auth.js, server/http.js, tests/server.test.mjs.
**Interfaces:** produzir createStore, bindRequest e createApplication com contratos da especificação; consumir mapa de funções injetado, sem importar handlers na camada HTTP.
- [ ] Testar primeiro persistência, updateMany condicional, leitura pública restrita, CRUD admin, autenticação/session/csrf, uploads e paths.
- [ ] Implementar SQLite e API, auth por e-mail, cookies, limites e redigir configuração sem segredos.
- [ ] Executar testes locais e registrar evidência.

### Task 2: Frontend independente
**Files:** src/**, index.html; tests/client.test.mjs.
**Interfaces:** consumir API especificada via storeClient.js; imagens usar /media conforme manifesto de migração posterior.
- [ ] Testar erros e formato do cliente HTTP e credenciais cookie.
- [ ] Substituir SDK/imports/auth, remover páginas/controles exclusivos da plataforma e portar textos de autenticação para português.
- [ ] Preservar rotas públicas e administrativas; checkout não exige login de cliente.
- [ ] Verificar build e ausência de runtime anterior em src.

### Task 3: Catálogo e mídia
**Files:** scripts de migração, server/data/catalog.json, public/media/**; relatório privado de correspondências.
**Interfaces:** produzir seed `{Product:[],ProductVariant:[],Category:[],ContentPage:[],Redirect:[],SiteSettings:[]}`; assets em /media e mapeamento privado para atualizar componentes.
- [ ] Exportar apenas campos públicos autorizados; validar IDs/relacionamentos e excluir custos/clientes/pedidos.
- [ ] Baixar mídia pública com limites, validar conteúdo, reescrever URLs; usar CSV apenas para dados confirmados correspondentes.
- [ ] Conferir contagens e medidas faltantes; testar seed idempotente sem sobrescrever estado persistente.

### Task 4: Integração, execução e entrega
**Files:** server/functions/**, server/shared/**, server/index.js, scripts/**, package.json, vite.config.js, Dockerfile, compose.yaml, README.md, .env.example, testes existentes.
**Interfaces:** consumir runtime, cliente e seed anteriores. Migrar funções e schemas para server; trocar metadados por store_id e STORE_ID.
- [ ] Redirecionar testes existentes para funções independentes e observar ausência das dependências antigas antes da implementação.
- [ ] Portar funções para runtime próprio, remover SDK/plugin/configurações antigas, conectar seed e bootstrap admin.
- [ ] Rodar suíte completa, lint, build, verificação de dependências e integração HTTP real usando SQLite temporário.
- [ ] Revisão independente; corrigir achados importantes com regressões; criar PR revisável no GitHub.
