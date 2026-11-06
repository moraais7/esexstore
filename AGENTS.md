# AGENTS.md

## Projeto
Esex Store independente: React/Vite em src/, API Node.js 24 e SQLite em server/. Preserve o visual e as regras de catálogo/checkout. Leia README.md para execução e configuração.

## Trabalho
- Mudanças pelo repositório GitHub, em branch revisável; não publicar nem alterar DNS sem instrução explícita.
- `npm run dev` inicia frontend e API local; `npm run build && npm start` serve a compilação pela API.
- Código do cliente em src/api/storeClient.js usa /api e cookies HttpOnly; não armazenar tokens de sessão no navegador.
- API pública deve filtrar visibilidade e campos; operações administrativas e uploads exigem papel admin.
- Funções em server/functions/ usam contexto privado de requisição em server/runtime.js; nunca aceitar privilégios do cliente.
- Banco e uploads em DATA_DIR são privados e persistentes. Não versionar .env, dados operacionais, custos internos, clientes, pedidos ou senhas.
- Seed e mídia versionados contêm somente catálogo público autorizado. Não inventar medidas ou preços.
- Execute testes, lint, build e check:independent antes de concluir. Typecheck tem pendências anteriores que devem ser reportadas, não ocultadas.
- SQLite exige uma única instância com disco persistente. Não configurar implantação efêmera ou múltiplas réplicas.
