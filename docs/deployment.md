# Hospedagem e homologação

## Proposta preparada

O arquivo `render.yaml` configura uma instância Node.js com disco persistente de 1 GB, usando a branch `codex/independent-store`. A criação do serviço é opcional e paga; nenhum serviço foi contratado ou publicado por adicionar este arquivo.

O preço consultado em 03/11/2026 foi US$ 7/mês para a instância 0.5 CPU/512 MB, mais US$ 0,25/mês para 1 GB de disco. Base estimada: US$ 7,25/mês, antes de tributos, câmbio, uso excedente e serviços externos. Confira o valor apresentado no provedor antes de confirmar.

Não há domínio próprio no blueprint. A primeira publicação deve usar somente a URL temporária HTTPS `onrender.com`, fornecida pelo serviço. A loja em esexstore.com.br deve continuar na hospedagem atual durante toda a homologação.

## Preparação antes de criar o serviço

1. Aprovar o custo e conectar a conta do Render ao repositório correto.
2. Usar o blueprint da branch independente. A publicação automática fica desligada.
3. Informar `ADMIN_EMAIL` e `ADMIN_PASSWORD` no painel seguro do provedor. A senha inicial precisa de pelo menos 12 caracteres. Remova a senha de bootstrap depois do primeiro acesso; isso não remove a conta criada.
4. Confirmar o disco em `/var/data` e manter uma única instância. O banco e os uploads devem ficar nesse volume, que é disponibilizado na inicialização, depois do build.

## URL e proxy

Se `STORE_PUBLIC_URL` estiver ausente, o servidor usa `RENDER_EXTERNAL_URL`, fornecida pelo Render. O valor resolvido é usado tanto pela API quanto pelos retornos de pagamento e links de recuperação. Se a URL explícita estiver configurada, ela tem prioridade. Em produção, o servidor exige HTTPS e rejeita URLs com credenciais.

O blueprint usa `TRUSTED_PROXY_HOPS=1` para o ingresso controlado pelo balanceador do Render. A política seleciona o último endereço do cabeçalho encaminhado e ignora endereços arbitrários acrescentados à esquerda. Esta configuração só é segura quando todos os acessos passam por esse ingresso. Em VPS com acesso direto, use o padrão zero; atrás de um proxy próprio, prefira a lista exata `TRUSTED_PROXY_IPS`. Não configure ambas as políticas ao mesmo tempo.

## Conferir a primeira publicação

1. `GET /api/health` deve responder 200 com `{"status":"ok"}`. Uma indisponibilidade do banco responde 503, sem revelar configuração ou registros.
2. Abrir início, catálogo, produto e carrinho. Confirmar 272 produtos públicos e que o botão de carregar mais permite percorrer o catálogo completo.
3. Entrar no painel próprio com a conta administrativa inicial. Manter pagamento e frete desabilitados até configurar os provedores e revisar o catálogo.
4. Fazer uma alteração descartável em ambiente de teste, reiniciar o serviço e conferir persistência. Gerar backup com `npm run backup`, copiar banco e uploads para fora do serviço e testar recuperação em ambiente separado.

## Próximas etapas da homologação

- Exportar novamente o catálogo da loja ativa e conciliar preços, estoque, produtos ocultos e variações. O seed é uma fotografia, não uma sincronização contínua. Não publicar o CSV original com custos internos no GitHub.
- Preencher os campos reais das 60 variações ativas listadas em [catalog-review.md](catalog-review.md). Não inferir medidas.
- Cadastrar no ambiente seguro do servidor as chaves Stripe de teste, segredo do webhook, token e e-mail do Melhor Envio, chave Resend e remetente verificado. Cadastro/recuperação por e-mail exigem o Resend; o primeiro administrador não depende de enviar uma mensagem inicial.
- Copiar para o Stripe a URL HTTPS temporária seguida de `/api/functions/stripeWebhook` e conferir os eventos indicados no README. Não usar a URL da loja atual para esse endpoint.
- Habilitar as configurações apenas durante os testes controlados. Conferir valor com frete, aprovação, e-mail, cancelamento, expiração, concorrência e estorno.
- Testar navegação e compra em celular antes de qualquer mudança de domínio.

## Referências do provedor

- [Preços](https://render.com/pricing)
- [Disco persistente](https://render.com/docs/disks)
- [Blueprints](https://render.com/docs/blueprint-spec)
- [Variáveis automáticas](https://render.com/docs/environment-variables)
- [Autenticação atrás do balanceador](https://render.com/articles/how-to-implement-authentication-and-authorization)

Discos persistentes impõem uma única instância e uma breve parada durante novas publicações. Use backup consistente do SQLite, além de copiar uploads; uma cópia informal do arquivo enquanto há escritas não substitui o comando de backup.
