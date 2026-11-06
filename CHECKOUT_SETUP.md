# Configuração do checkout

A loja usa servidor próprio. As instruções atualizadas de execução, variáveis de ambiente, webhooks, frete, e-mail, backup e homologação estão em [README.md](README.md).

Credenciais ficam somente no ambiente seguro da nova hospedagem. Configurações públicas ficam no painel administrativo próprio. Origem dos envios: 32241-340. O domínio e a loja atual não devem ser alterados antes da homologação.

A retirada de um preço ou medida deve limpar o valor anterior; produtos sem preço válido não podem ser cobrados e medidas ausentes impedem cotação real. Os valores do carrinho são recalculados no servidor. O webhook assinado confirma o pagamento, e cancelamentos/expiração liberam reservas sem devolução duplicada.
