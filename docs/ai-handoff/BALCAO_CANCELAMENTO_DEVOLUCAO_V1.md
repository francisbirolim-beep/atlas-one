# Venda Balcão — Cancelamento e Devolução V1

## Contexto
A Venda Balcão V1 já está integrada na `main` com venda, orçamento, consulta de preço, histórico, caixa, contas a receber, relatórios, estoque multiunidade e atendimento entre lojas.

Esta evolução cobre a principal pendência pós-V1: **cancelamento e devolução com estorno auditável de estoque, caixa e financeiro**, sem apagar histórico e sem permitir dupla movimentação.

## Objetivo
Permitir corrigir uma venda após finalização de forma segura, com trilha de auditoria e regras distintas conforme o estágio da mercadoria e do pagamento.

## Regras gerais
1. Nunca apagar a venda original.
2. Cancelamento/devolução gera evento próprio, com usuário, data/hora, motivo e observações.
3. Toda movimentação é idempotente: repetir a mesma ação não pode baixar/devolver estoque nem movimentar caixa duas vezes.
4. Não alterar custo, preço ou margens históricas da venda original.
5. Venda com NF/NFC-e futura deve respeitar a política fiscal quando esse módulo existir; nesta V1 o Atlas deixa marcador fiscal pendente, sem emitir documento automaticamente.
6. Cancelamento total e devolução parcial são operações diferentes.
7. Operação exige permissão gerencial de Venda Balcão.

## Cancelamento total
- item local já entregue/baixado: gerar movimento inverso de entrada no mesmo local de origem;
- item reservado em outra unidade e ainda não saiu: liberar a reserva, sem alterar saldo físico;
- item `separando`: liberar a reserva, sem alterar saldo físico;
- item `em_entrega`: exigir retorno físico e gerar entrada no local definido para devolução;
- item `entregue`: cancelar somente com confirmação de retorno da mercadoria e gerar entrada de devolução.

## Devolução parcial
- selecionar itens e quantidades devolvidas;
- quantidade devolvida nunca excede quantidade líquida vendida menos devoluções anteriores;
- gerar entrada apenas da quantidade devolvida;
- calcular valor líquido devolvido com base no valor efetivamente vendido;
- desconto global da venda é rateado proporcionalmente entre os itens;
- preservar venda original e registrar saldo líquido após devoluções.

## Financeiro
### Pagamento imediato já recebido
- dinheiro/PIX podem gerar saída/estorno no caixa quando houver reembolso pelo caixa;
- cartão/débito/crédito externo fica `reembolso_pendente` até confirmação manual, sem fingir estorno do adquirente.

### Boleto / a prazo
- parcelas abertas: cancelar/reduzir saldo proporcionalmente;
- parcelas já recebidas: manter histórico e gerar crédito/reembolso;
- devolução parcial reduz primeiro parcelas abertas futuras e depois trata valor já recebido.

### Caixa
- saída de dinheiro exige caixa aberto e movimento próprio;
- estorno externo pode permanecer pendente sem movimento de caixa até confirmação.

## Status
Venda: `finalizada`, `parcialmente_devolvida`, `cancelada`.
Evento: `cancelamento_total`, `devolucao_parcial`, `reembolso_pendente`, `reembolso_concluido`.

## Auditoria
Criar eventos com venda, tipo, status, motivo, observações, valor, usuário, timestamps e itens do evento com quantidade, valor líquido e local de retorno.

## API / UI
No detalhe de `/balcao/historico`:
- mostrar status e eventos anteriores;
- botão `Cancelar / Devolver` para usuário gerencial;
- motivo obrigatório;
- cancelamento total ou devolução parcial;
- quantidade por item;
- local de retorno quando houver entrada física;
- mostrar impacto previsto em estoque, reservas, financeiro e reembolso antes de confirmar.

## Implementação segura
A operação crítica deve ficar em RPC/transação server-side. A RPC trava a venda, confere saldo devolvível, cria evento, movimenta/libera estoque, ajusta financeiro sem apagar histórico, gera caixa quando aplicável e atualiza status líquido da venda. RPC restrita a `service_role` e endpoint autenticado valida permissão.

## Critérios de aceite
1. Cancelar venda local já baixada devolve exatamente uma vez o estoque.
2. Cancelar venda remota ainda reservada libera reserva sem alterar físico.
3. Item em entrega exige retorno físico e gera entrada sem recriar reserva.
4. Devolução parcial de 2 de 5 devolve exatamente 2 e mantém 3 líquidas vendidas.
5. Segunda tentativa não duplica estoque/caixa/financeiro.
6. Parcelas abertas são canceladas/reduzidas sem apagar histórico.
7. Recebimento já realizado permanece auditável e vira crédito/reembolso quando aplicável.
8. Cartão não é marcado como estornado sem confirmação.
9. Venda original continua consultável com eventos.
10. Usuário sem permissão gerencial não cancela/devolve.

## Ordem de implementação
1. migration/tabelas + RPC transacional;
2. endpoint `/api/balcao/vendas/cancelar-devolver`;
3. ampliar GET da venda para eventos/devoluções;
4. UI no histórico;
5. testes com `ROLLBACK`;
6. Build Validation + preview;
7. aplicar migration após a auditoria W.Vetro sair da chamada pesada;
8. validar em produção sem criar venda fictícia permanente.

## Depois desta entrega
- emissão/NFC-e após definição fiscal;
- tela administrativa de pontos de caixa por unidade;
- transferência física opcional entre unidades antes da retirada.
