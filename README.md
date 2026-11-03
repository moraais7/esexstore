# Esex Store

Loja independente com frontend React/Vite, API Node.js 24, SQLite persistente, administração própria e integrações diretas com Stripe, Melhor Envio e Resend. O código, o catálogo público inicial e as imagens ficam neste repositório. Não exige o editor ou o backend que originou o projeto.

## Executar localmente

Requisitos: Node.js 24.12 ou superior da linha 24 e npm.

```sh
npm ci --ignore-scripts
cp .env.example .env
npm run dev
```

A loja abre em http://localhost:5173; a API local usa a porta 3001. `npm run dev` inicia os dois processos. Configure o primeiro administrador em `.env` usando `ADMIN_EMAIL` e `ADMIN_PASSWORD` com pelo menos 12 caracteres. O bootstrap só cria uma conta nova: não promove clientes existentes nem troca sua senha a cada reinício. Remova a senha de bootstrap do ambiente depois da criação.

Para servir a compilação pelo próprio servidor:

```sh
npm run build
npm start
```

Abra http://localhost:3000. `npm run preview` serve apenas o frontend compilado e não substitui o servidor da aplicação.

## Dados e mídia

O primeiro início importa `server/data/catalog.json` apenas se o banco ainda não tiver produtos. A importação é transacional; reiniciar não sobrescreve preços, pedidos, configurações ou estoque. O seed contém 272 produtos públicos, 328 variações (incluindo 88 inativas), 20 categorias e 6 páginas. As imagens são arquivos próprios em `public/media/`.

A origem dos envios é o CEP confirmado 32241-340. Foram aproveitadas medidas existentes por correspondência de produto, SKU e opções; 60 variações ativas continuam com algum peso/medida ausente. Esses produtos exigem revisão antes de cotar pelo Melhor Envio. Não foram inventadas medidas nem preços. Duas imagens de origem não puderam ser recuperadas; todos os produtos preservam ao menos uma imagem.

O banco fica em `DATA_DIR/store.sqlite` e os uploads administrativos em `DATA_DIR/uploads`. Esse diretório contém dados privados e não deve ser versionado. O seed não inclui custos internos, clientes, pedidos antigos ou senhas. Dados privados antigos precisam de uma exportação específica para migração; contas de usuários usam o novo sistema de acesso.

## Configurar integrações

Copie `.env.example` para o ambiente do servidor. Nunca coloque credenciais em código, commits, campos públicos do painel ou mensagens.

| Variável | Finalidade |
| --- | --- |
| `STORE_PUBLIC_URL` | URL HTTPS da nova hospedagem; use o endereço de teste antes da migração do domínio. |
| `STORE_ID` | Identificador estável da loja usado nos metadados do pagamento. |
| `STRIPE_SECRET_KEY` | Comece com uma chave de teste `sk_test_...`. |
| `STRIPE_WEBHOOK_SECRET` | Segredo do endpoint `/api/functions/stripeWebhook` no mesmo ambiente Stripe. |
| `MELHOR_ENVIO_TOKEN` | Token com permissão de cotação de frete. |
| `MELHOR_ENVIO_CONTACT` | E-mail de contato técnico da integração. |
| `RESEND_API_KEY` | Envio de confirmação de pedido e autenticação por e-mail. |
| `ORDER_EMAIL_FROM` | Remetente autorizado de um domínio verificado no Resend. |

Em `/admin/configuracoes`, configure frete, CEP e ambiente correspondente ao token. Frete e pagamento começam desativados. Cadastro e recuperação de senha exigem envio de e-mail configurado; o bootstrap administrativo funciona sem um envio inicial. Checkout de visitante não exige criar uma conta.

No Stripe, cadastre o webhook `https://SEU-ENDERECO-DE-TESTE/api/functions/stripeWebhook` para `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` e `charge.refunded`. A assinatura valida o corpo bruto; a página de retorno não confirma pagamentos. Produtos e frete são recalculados no servidor e o estoque usa reservas condicionais. A integração Melhor Envio faz cotações; compra de etiquetas e rastreamento automático não fazem parte desta versão.

## Hospedagem independente

Use um servidor ou serviço de contêiner com disco persistente e HTTPS. Esta arquitetura usa uma única instância SQLite; não use múltiplas réplicas nem um ambiente com filesystem descartável. Em um proxy HTTPS, encaminhe as rotas da loja e `/api` para o mesmo servidor e configure `STORE_PUBLIC_URL` com o endereço externo correto.

Configure `TRUSTED_PROXY_IPS` com os IPs exatos dos proxies que se conectam à API, separados por vírgula (por exemplo, `127.0.0.1,::1` somente se esses forem os pares reais). O padrão vazio ignora `X-Forwarded-For`. Não use `*`, CIDRs ou redes inteiras. O proxy deve substituir ou acrescentar corretamente o endereço real de quem se conecta; a API percorre a cadeia da direita para a esquerda e para no primeiro endereço não confiável. Em contêiner, confirme o IP que a API realmente recebe como par: ele pode ser o gateway da rede, não o loopback do host. Restrinja acesso direto à API para que somente o proxy autorizado alcance a porta. Esses endereços identificam cada cliente nos limites de requisições; o webhook Stripe mantém um limite separado e exige assinatura válida.

```sh
docker compose up --build -d
```

O Compose expõe a aplicação apenas em `127.0.0.1:3000`, para ficar atrás do proxy HTTPS, e mantém o banco/uploads no volume `store-data`. O `.env` usado pelo Compose deve conter a URL HTTPS real e as credenciais necessárias. Recriar o contêiner conserva o volume; remover o volume apaga os dados.

Não aponte esexstore.com.br para essa hospedagem antes da homologação. A loja atual permanece operando enquanto a nova loja é testada em endereço separado. A troca de DNS e qualquer publicação de produção são etapas posteriores.

## Backup e recuperação

```sh
npm run backup
```

Cria uma cópia consistente do banco em `BACKUP_DIR` (padrão `./backups`). Copie também `DATA_DIR/uploads` e guarde backups fora do servidor. O catálogo/mídia inicial já fica no Git. Para restaurar, pare a aplicação, preserve uma cópia do diretório atual, restaure o banco e uploads, e só então reinicie. Não substitua o banco com o servidor em execução.

## Verificação e homologação

```sh
npm test
npm run lint
npm run build
npm run check:independent
npm run typecheck
```

Os testes cobrem a API HTTP com SQLite real, autenticação, permissões, upload, persistência, importação, preço/frete, concorrência de estoque e webhook assinado. As chamadas externas são simuladas: esses testes não cobram dinheiro nem comprovam configuração real dos provedores. O typecheck global possui diagnósticos anteriores em componentes JavaScript; não foi desativado para escondê-los.

O seed é uma fotografia do catálogo exportado, não uma sincronização contínua com a loja atual. Antes de habilitar vendas, concilie preços e estoque com a operação em funcionamento e revise as variações sem medidas.

Antes de aceitar vendas: testar compra com Stripe em teste, cotações reais para diferentes CEPs, e-mail, retorno, cancelamento, expiração, disputa da última unidade, estorno integral, dispositivos móveis e recuperação de backup. Não há publicação automática: o workflow do GitHub verifica testes, lint, build e independência, sem trocar domínio ou implantar a loja.
