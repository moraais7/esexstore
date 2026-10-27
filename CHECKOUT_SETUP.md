# Frete, pagamento e checkout

As mudanças devem chegar ao Base44 pela sincronização do GitHub. Publique pelo painel do Base44 após configurar e testar. Não use `base44 deploy` neste projeto: ele contorna a sincronização do repositório (ver README).

## Configuração necessária

No Base44, cadastre os segredos apenas no painel, nunca no GitHub nem nos campos públicos de SiteSettings:

| Segredo | Uso |
| --- | --- |
| `STRIPE_SECRET_KEY` | Chave da conta Stripe. Comece com `sk_test_...`. |
| `STRIPE_WEBHOOK_SECRET` | Assinatura do endpoint `stripeWebhook` no ambiente correspondente. |
| `STORE_PUBLIC_URL` | URL pública HTTPS da loja, recomendada para os retornos do pagamento. Se ausente, utiliza o cabeçalho fornecido pelo Base44. |
| `MELHOR_ENVIO_TOKEN` | Token com permissão de cotação; necessário apenas ao escolher Melhor Envio. |
| `MELHOR_ENVIO_CONTACT` | E-mail de contato da integração, enviado no User-Agent do Melhor Envio. |
| `RESEND_API_KEY` | Chave para e-mails transacionais a clientes, inclusive sem cadastro na loja. |
| `ORDER_EMAIL_FROM` | Remetente autorizado em domínio verificado no Resend, por exemplo `Loja <pedidos@seu-dominio.com.br>`. |

`BASE44_APP_ID` é fornecido pelo runtime. A implementação usa o SDK 0.8.57, igual ao lockfile do frontend, com `filter(query, options)` e atualizações condicionais por ID.

Em **Admin → Configurações**:

1. Escolha Melhor Envio e informe o CEP de origem. Cadastre peso em kg e altura/largura/comprimento em cm em **cada variação**; dados ausentes bloqueiam a cotação. O código não inventa dimensões ou tarifas.
2. Alternativamente, escolha tarifa única e informe preço e prazo que a loja efetivamente consegue cumprir para todos os CEPs do Brasil. Zero representa frete grátis; nenhum preço ou prazo é presumido.
3. Habilite frete e pagamento depois de cadastrar os serviços. O checkout bloqueia a compra quando faltam as configurações. O toggle de pagamento não indica se a chave Stripe é de teste ou produção.
4. Se necessário, use **Corrigir vínculos das variações importadas**. A rotina exige admin, percorre o catálogo paginado e só associa correspondências exatas e únicas por identificador de origem, slug ou SKU padrão. Casos ambíguos ficam para revisão manual. Não cria produtos nem altera preços.

O Melhor Envio retorna as opções disponíveis e o checkout usa `custom_price` e `custom_delivery_time`, com fallback para os campos padrão. O modo sandbox precisa corresponder ao token. Uma cotação sandbox não pode iniciar uma cobrança com `sk_live_...`. A integração calcula o frete; comprar etiquetas e rastrear entregas são operações separadas.

## Webhook do Stripe

Cadastre o endereço da função `stripeWebhook` publicado pelo Base44 como endpoint público no Stripe, com estes eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`

A URL exata da função deve ser copiada do painel Base44 do app. Use o segredo `whsec_...` desse endpoint e ambiente. O handler verifica a assinatura do corpo bruto e a tolerância de cinco minutos. A página de sucesso consulta o banco; ela não confirma pagamentos.

O total cobrado inclui produtos e frete. Preços, disponibilidade, quantidades e cotação são validados no servidor. A cotação dura 15 minutos e deixa de valer se mudar o CEP, o carrinho, o preço ou a configuração de frete. A tentativa de pagamento dura cerca de 31 minutos.

A sessão Stripe é criada primeiro, sem divulgar sua URL. Sua referência é persistida e só então o estoque é reservado por atualizações condicionais de cada variação; a URL é liberada ao comprador somente depois da reserva completa. Uma trava temporária por pedido serializa tentativas simultâneas. Marcadores por pedido impedem nova baixa em tentativas repetidas e devolução duplicada. Expiração ou retorno pelo botão de cancelamento encerra a sessão Stripe e libera a reserva. Reenvios do mesmo checkout utilizam o mesmo pedido e chave de idempotência. Uma falha de rede antes de persistir a referência Stripe não reserva estoque. Se a falha ocorrer depois de persistir a referência e durante a reserva, a sessão é encerrada antes de devolver as unidades já reservadas; se o Stripe estiver indisponível, a referência permanece para expiração pelo webhook ou cancelamento administrativo. Conflitos de idempotência e limites temporários do Stripe mantêm o pedido pendente, sem cancelar uma sessão válida concorrente.

O carrinho permanece durante o pagamento e o cancelamento. A página de confirmação remove as quantidades compradas somente após o banco indicar pagamento aprovado, uma vez por sessão neste navegador.

Estorno integral confirmado cancela o pedido e devolve o estoque uma única vez. Estornos parciais exigem revisão administrativa e não devolvem todo o estoque. O painel não executa estornos: faça essa operação na conta Stripe. Pedidos antigos que não possuem `payment_intent` gravado precisam ser conciliados manualmente em caso de estorno.

O e-mail é solicitado somente após pagamento confirmado. Falhas ficam em `confirmation_email_error` no pedido; falhas temporárias de envio fazem o webhook responder com erro para o Stripe tentar novamente. Ausência de configuração é registrada, mas não desfaz o pagamento. Para reenviar após corrigir a configuração, reenvie o evento de pagamento no Stripe. O Resend utiliza uma chave de idempotência por pedido; sua janela de deduplicação é definida pelo provedor.

## Validação local

```sh
npm ci --ignore-scripts
npm test
npm run lint
npm run build
npm run typecheck
```

Os testes usam provedores e entidades simulados: não movimentam dinheiro nem enviam e-mails reais. Cobrem total com frete, manipulação/expiração da cotação, repetições, assinaturas, reserva concorrente, cancelamento, estorno, falhas de rede e reparação de vínculos.

O projeto já possuía erros de tipagem em componentes JavaScript e em wrappers da interface antes destas mudanças. O `typecheck` global continua exigindo uma correção separada; não foi desativado para esconder os erros.

## Homologação no Base44 antes de aceitar vendas

1. Publique os schemas, funções e frontend sincronizados pelo GitHub. Confira permissões: `Order` e `ShippingQuote` são restritos a admin; os compradores os acessam somente pelas funções necessárias.
2. Com Stripe em teste, confirme cotação, endereço completo e igualdade dos valores no resumo, no Stripe e no pedido.
3. Pague com cartão de teste; confirme status, uma única reserva de estoque e recebimento do e-mail. Reenvie o evento assinado e confira que o estoque não muda novamente.
4. Cancele outra compra pelo Stripe e confirme preservação do carrinho e devolução da reserva. Teste também expiração, dois compradores disputando a última unidade, e estorno integral.
5. Para produção, use credenciais de produção de ambos os serviços, desative sandbox e confira o endpoint de webhook da conta Stripe. Não teste usando cartão real enquanto estiver homologando.

Nenhuma credencial, conta externa, configuração de produção ou publicação no Base44 foi alterada por este commit. A compilação local sem VITE_BASE44_APP_ID serve apenas para verificar o código; o ambiente publicado precisa das variáveis do próprio Base44.

Referências: [Base44 SDK](https://github.com/base44/skills), [cotação Melhor Envio](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos), [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create), [Resend](https://resend.com/docs/api-reference/emails/send-email).
