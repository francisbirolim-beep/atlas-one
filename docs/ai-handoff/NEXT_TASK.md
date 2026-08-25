# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — concluir PR #271: Cancelamento e Devolução da Venda Balcão

### Base já integrada

- Compras + Estoque + Financeiro de entrada e custo médio;
- estoque multiunidade, endereçamento, reservas e transferências;
- Venda Balcão V1 com venda, orçamento, consulta, histórico, caixa, contas a receber, relatórios e atendimento entre unidades;
- integração/auditoria W.Vetro;
- orçamento visual com tipologias e referências de variáveis W.Vetro;
- correção do Service Worker para não cachear APIs nem manter bundles antigos após deploy.

### W.Vetro — estado validado em 25/08/2026

A auditoria completa já foi encerrada. **Não executar novamente a auditoria inteira sem necessidade.**

Resumo atual no banco:

- 1.307 perfis W.Vetro;
- 1.174 acessórios W.Vetro;
- 111 tipologias referência, 109 mapeadas;
- 119 linhas referência;
- 1.529 códigos de perfil observados no histórico;
- 1.294 códigos de acessório observados no histórico;
- 14 vidros referência;
- 2.481 produtos consultados na API;
- 1.287 imagens copiadas para o Atlas.

As imagens de produtos/perfis/acessórios foram copiadas quando disponíveis. Imagens visuais de tipologias continuam sendo tratadas separadamente; não inventar croquis para substituir imagem oficial.

## PR #271 — Venda Balcão: cancelamento e devolução

Branch: `feat/balcao-cancelamento-devolucao-v3`

Implementado:

1. cancelamento total sem apagar a venda original;
2. devolução parcial por item e quantidade;
3. cálculo do valor líquido devolvido com desconto global rateado;
4. item físico devolvido gera entrada de estoque no local de retorno;
5. item apenas reservado/separando libera reserva sem alterar estoque físico;
6. saldo devolvível considera devoluções anteriores;
7. contas a receber abertas/vencidas são reduzidas/canceladas antes de criar reembolso;
8. valores já recebidos podem ser reembolsados pelo caixa quando elegíveis;
9. saldo não reembolsado imediatamente vira `reembolso_pendente`;
10. reembolso pendente pode ser confirmado depois como externo ou pelo caixa;
11. eventos e itens de auditoria preservam usuário, data, motivo, valor e impacto;
12. proteção idempotente por chave evita duplicar estoque/financeiro/caixa em repetição da mesma operação;
13. ação restrita à gestão (`relatorios-balcao = edicao`; Master tem edição);
14. Histórico mostra status, saldo líquido, eventos e botão `Cancelar / Devolver`;
15. UI mostra impacto previsto antes da confirmação.

Migrations já aplicadas e alinhadas ao histórico do Supabase:

- `20260825174254_balcao_cancelamento_devolucao_v1.sql`;
- `20260825174749_balcao_cancelamento_idempotencia.sql`.

### Testes transacionais já aprovados com ROLLBACK

- devolução 2 de 5: estoque retorna exatamente 2 e venda vira `devolvida_parcial`;
- repetição com a mesma chave: estoque não movimenta novamente;
- cancelamento do saldo restante: estoque total restaurado e venda vira `cancelada`;
- cancelamento de item reservado em outra unidade: reserva liberada e estoque físico inalterado;
- conta a receber aberta: cancelada/reduzida sem apagar histórico.

Nenhum dado fictício desses testes permaneceu no banco.

## Gates antes do merge #271

1. `Build Validation` verde no HEAD final;
2. `Supabase Database Control` verde no HEAD final;
3. preview Vercel `READY` no HEAD final;
4. confirmar PR mergeable;
5. merge somente após os três gates.

## Teste funcional depois do merge

Em `Venda Balcão > Histórico`:

1. abrir uma venda real/controlada;
2. conferir botão `Cancelar / Devolver` para usuário gerencial;
3. conferir saldo devolvível por item;
4. testar devolução parcial apenas quando houver uma venda apropriada para teste;
5. validar movimento correspondente no estoque e evento no histórico;
6. validar título financeiro/reembolso conforme a forma de pagamento;
7. confirmar que uma venda cancelada continua consultável e auditável.

## Próximas evoluções já conhecidas da Venda Balcão

Após a PR #271 e validação do usuário:

1. administração de pontos de caixa/caixas por unidade;
2. transferência física opcional entre unidades antes da retirada;
3. NFC-e/fiscal após definição do provedor e regras fiscais.

O usuário informou que apresentará uma nova ideia após a conclusão desta etapa; avaliar a ideia contra o código real antes de alterar o backlog.

## Regras invioláveis

- GitHub é a fonte da verdade do código.
- Não apagar venda, pagamento, movimento ou histórico para efetuar estorno.
- Estoque, caixa e financeiro devem ser movimentados por transação auditável.
- Operações críticas devem ser idempotentes.
- Venda original preserva preço, custo e margem históricos.
- Cartão não pode ser marcado como estornado externamente sem confirmação real.
- W.Vetro é referência; regra técnica Atlas validada sempre tem prioridade.
