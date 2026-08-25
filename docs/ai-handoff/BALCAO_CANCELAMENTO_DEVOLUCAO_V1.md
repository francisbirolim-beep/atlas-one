# Venda Balcão — Cancelamento e Devolução V1

## Objetivo

Corrigir uma venda finalizada de forma auditável, sem apagar a venda original e sem criar dupla movimentação de estoque, caixa ou financeiro.

## Entrega

- cancelamento total;
- devolução parcial por item e quantidade;
- saldo devolvível descontando eventos anteriores;
- retorno físico ao estoque no local definido;
- liberação de reserva sem alterar físico quando mercadoria ainda não saiu;
- valor líquido devolvido com desconto global rateado;
- redução/cancelamento de contas a receber abertas;
- reembolso pelo caixa quando elegível;
- reembolso pendente para cartão/externalidade ou valor ainda não devolvido;
- confirmação posterior de reembolso externo ou por caixa;
- trilha de eventos e itens;
- idempotência por chave de operação;
- permissão gerencial.

## Banco

Tabelas:

- `balcao_venda_eventos`;
- `balcao_venda_evento_itens`.

RPCs:

- `processar_cancelamento_devolucao_balcao(...)`;
- overload idempotente com `p_chave_idempotencia`;
- `concluir_reembolso_balcao(...)`.

Migrations:

- `20260825174254_balcao_cancelamento_devolucao_v1.sql`;
- `20260825174749_balcao_cancelamento_idempotencia.sql`.

RLS está ativo; `anon` e `authenticated` não acessam as tabelas diretamente. Operação passa por endpoint autenticado server-side e `service_role`.

## Regras de estoque

- item `entregue` ou `em_entrega`: devolução/cancelamento com retorno físico gera `entrada` em `estoque_movimentos` e recompõe `estoque_saldos`;
- item `reservado_outra_unidade` ou `separando`: cancelamento libera `estoque_reservas` e reduz `quantidade_reservada`, sem alterar a quantidade física;
- devolução parcial de item ainda reservado/separando é bloqueada; nesse estágio deve-se cancelar o saldo ou concluir o atendimento antes da devolução física;
- custo histórico da entrada de devolução usa `custo_unitario_snapshot` da venda.

## Regras financeiras

1. calcula o valor líquido devolvido proporcionalmente ao desconto da venda;
2. reduz primeiro contas a receber abertas/vencidas, começando pelas parcelas futuras;
3. valores já recebidos permanecem no histórico e viram necessidade de reembolso;
4. quando solicitado e possível, o Atlas gera `estorno` como saída no caixa aberto;
5. saldo não reembolsado imediatamente cria evento `reembolso_pendente`;
6. reembolso pendente pode ser confirmado depois como externo ou pelo caixa;
7. cartão nunca é tratado como estornado no adquirente apenas porque a venda foi cancelada.

## Idempotência

Cada cancelamento/devolução recebe uma `chave_idempotencia`. A RPC usa lock transacional e índice único. Se a mesma chave for reenviada, retorna o evento existente sem repetir estoque, caixa ou financeiro.

## UI

Em `/balcao/historico`:

- coluna de status da venda;
- detalhe mostra saldo devolvido/cancelado e saldo líquido de cada item;
- histórico de eventos e reembolsos;
- botão `Cancelar / Devolver` apenas para gestão;
- escolha entre cancelamento total e devolução parcial;
- quantidade e local de retorno na devolução parcial;
- motivo obrigatório;
- estimativa do valor líquido e aviso de impacto;
- opção de reembolso imediato pelo caixa quando houver caixa aberto;
- ações para concluir reembolso pendente.

## Permissão

A operação exige acesso à Venda Balcão e nível `edicao` em `relatorios-balcao`. Usuário `master` é tratado como edição.

## Testes transacionais

Executados em produção dentro de `BEGIN ... ROLLBACK`, sem dados persistentes:

1. devolução parcial 2/5 recompôs exatamente 2 unidades;
2. venda mudou para `devolvida_parcial`;
3. repetição da mesma chave não duplicou estoque;
4. cancelamento das 3 restantes recompôs o saldo completo e mudou a venda para `cancelada`;
5. total devolvido nos eventos fechou exatamente 5/5;
6. cancelamento de item apenas reservado liberou reserva e manteve estoque físico inalterado;
7. conta a receber aberta vinculada à venda foi cancelada corretamente.

## Pendências fora desta V1

- integração com NFC-e/documento fiscal;
- tela administrativa de pontos de caixa por unidade;
- transferência física opcional entre unidades antes da retirada.
