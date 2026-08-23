# Estoque Multiunidade V1 — Atlas One

Data: 2026-08-23
Branch: `feat/estoque-multiunidade-enderecamento`

## Decisões permanentes

1. O cadastro de produtos é único para toda a empresa. Nunca duplicar um produto apenas porque ele existe em outra loja/unidade.
2. O saldo físico pertence a uma unidade/local/endereço.
3. Estrutura: `Unidade operacional → Local de estoque → Endereço físico`.
4. Endereço físico pode usar somente os níveis necessários: zona, corredor, estante, prateleira, caixa/gaveta.
5. Saldo disponível = saldo físico − quantidade reservada.
6. Todas as unidades podem futuramente consultar o estoque da rede conforme permissões; vender produto de outra unidade deve reservar o saldo na origem antes de prometer ao cliente.
7. Transferência entre unidades é rastreável: `solicitada → separação → em trânsito → recebida`; nunca ajustar dois estoques manualmente para simular transferência.
8. Endereçar um produto dentro do mesmo local não altera o estoque total nem o custo; apenas desloca o saldo entre endereços.
9. Hoje a operação pode continuar apenas com `Matriz / Esquadrifácio → Estoque Geral`. A arquitetura já aceita futuras lojas, fábrica, depósitos e produto acabado.
10. Caixas por unidade serão vinculados a esta mesma estrutura quando o PDV for integrado: Caixa Balcão, Caixa Esquadrias e futuros caixas de cada loja.

## Implementação desta branch

### Banco
- `unidades_operacionais`;
- `estoque_locais`;
- `estoque_enderecos`;
- `estoque_reservas`;
- `estoque_transferencias`;
- `estoque_transferencia_itens`;
- `estoque_saldos` evolui de uma linha por produto para saldo por `produto + local + endereço`;
- `quantidade_reservada` separada do saldo físico;
- `estoque_movimentos` ganha origem/destino de local/endereço;
- view `estoque_disponibilidade_rede` com `security_invoker`;
- local padrão criado: `MATRIZ → GERAL`.

### Funções atômicas
- `reservar_estoque_local`: pode distribuir uma reserva entre vários endereços do mesmo local;
- `cancelar_reserva_estoque`;
- `criar_transferencia_estoque`: cria transferência e reserva todos os itens na origem na mesma transação;
- `avancar_transferencia_estoque`: separação, envio, recebimento e cancelamento;
- `movimentar_estoque_interno`: endereça saldo dentro do mesmo local sem alterar o total físico.

### Telas/APIs
- `/estoque`: visão da rede com unidade, local, endereço, físico, reservado e disponível;
- `/estoque/estrutura`: cadastro de unidades, locais e endereços físicos;
- `/estoque/enderecar`: move saldo para corredor/prateleira/caixa;
- `/estoque/transferencias`: solicita, separa, envia, recebe e cancela transferências;
- `/api/estoque/reservas`: base para o futuro PDV reservar estoque de outra loja.

## Regras de segurança
- novas tabelas com RLS habilitado;
- acesso direto de `anon` e `authenticated` revogado;
- operações passam pelas APIs server-side autenticadas e funções restritas ao `service_role`;
- custo médio não muda em mera transferência interna entre endereços;
- transferência conserva o custo do item enviado e recalcula média apenas no local de destino quando necessário;
- quantidade já reservada não pode ser movida ou prometida novamente.

## Próximas integrações
- após esta fundação ser validada/mergeada, sincronizar a PR do PDV e vincular cada caixa a uma unidade operacional;
- no PDV, quando a loja atual não tiver saldo, mostrar outras unidades e permitir `reservar para entrega/retirada posterior`;
- permitir escolher `retirada em outra loja`, `transferir para esta loja` ou `entrega direta da origem`;
- futuramente classificar produtos acabados e criar ordem de produção para estoque de portas, venezianas e outros itens prontos.
