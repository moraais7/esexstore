# Loja independente

## Objetivo e autorização
Migrar o código da loja existente para funcionamento independente do fornecedor anterior, preservando visual, catálogo, painel, carrinho e regras de checkout. O usuário delegou a execução e as decisões necessárias, com prioridade para rapidez e cuidado. A loja atual e o domínio esexstore.com.br não serão alterados nem publicados nesta migração.

## Decisões de implementação
Manter React/Vite; usar Node.js 24, SQLite persistente e sessões em cookies HttpOnly. Um servidor atende a API e o frontend compilado. Docker oferece execução portável com volume para banco e uploads. É uma implantação de instância única: múltiplas réplicas exigiriam outro banco. Escolha do implementador, não uma preferência expressa do usuário. Um serviço externo gerenciado exigiria nova dependência/conta; uma loja apenas estática não executaria pagamento e estoque seguros.

## Contratos
- API sob `/api`, mesmo domínio da aplicação; não guardar tokens de sessão no localStorage.
- `src/api/storeClient.js` exporta `store`: entities.<Name>.{filter(query,options),get(id),list(options),count(query),aggregate(spec),create(data),update(id,data),delete(id),deleteMany(query)}; functions.invoke(name,body) retorna `{data}`; integrations.Core.UploadPublicFile({file}) retorna `{file_url}`.
- Auth: POST `/api/auth/login` {email,password}, `/register` {email,password}, `/verify` {email,otpCode}, `/resend` {email}, `/forgot-password` {email}, `/reset-password` {resetToken,newPassword}, `/logout`; GET `/api/auth/me`. Registro verificado por e-mail. Login Google só aparece se implementado/configurado, nunca botão sem função.
- Entidades: POST `/api/entities/:name/query` {query,options} retorna `{items,next_cursor}`; POST `/count` {query} retorna número; POST `/aggregate` {query,sum} retorna objeto com agregados; GET/PATCH/DELETE `/:id`; POST coleção cria; POST `/delete-many` {query}.
- Backend `server/runtime.js` exporta `createClientFromRequest(req)` e `secrets.get(name)`. Cliente usa contexto de requisição validado; `asServiceRole.entities` é exclusivo de funções internas, nunca recebe privilégios do corpo/cabeçalhos do cliente.
- Funções em `server/functions/<name>/entry.ts`; lógica compartilhada em `server/shared/`; runtime import relativo `../../runtime.js`. As funções preservam suas assinaturas Request→Response e as garantias já testadas.
- Servidor aceita mapa de handlers; exporta `createApplication({databasePath,publicUrl,handlers,env,distDir,uploadsDir})` retornando `{server,store,close}`. SQLite `createStore(databasePath)` retorna `{entities,db,close}`. `bindRequest(req,{store,user,env})` associa contexto privado por WeakMap para as funções.

## Dados e proteção
Importar somente catálogo público para seed versionado, sem custos internos, clientes, pedidos, credenciais ou produtos ocultos. Aproveitar dimensões confirmadas do CSV por correspondência exata; não inventar dados faltantes. Migrar imagens públicas para arquivos próprios. CEP de origem confirmado: 32241340. Frete e pagamento começam desabilitados até configuração real.

Administradores têm CRUD; visitantes só leem produtos visíveis/ativos, variações ativas de produtos públicos, categorias ativas, páginas publicadas, redirects ativos e configurações públicas. Nunca expor Order, ShippingQuote, ImportBatch, usuários, custo de compra ou marcadores de reserva. Validar origem de mutações autenticadas, limitar autenticação e uploads; senhas com scrypt; sessões aleatórias persistidas por hash; uploads só imagens raster com assinatura válida e nomes aleatórios. Webhook Stripe mantém assinatura sobre corpo bruto.

## Entrega e limites
Entregar código, imagens recuperadas, testes, configuração por variáveis de ambiente, bootstrap de administrador, instruções e Docker via PR no GitHub. Nenhuma credencial será incluída. Uma compilação/testes locais não equivalem à homologação com provedores reais. Contas antigas não incluem senhas exportáveis; novos acessos usam o sistema independente. Dados privados/pedidos antigos só migram com exportação autorizada. Não tocar no DNS ou realizar cobranças reais.
