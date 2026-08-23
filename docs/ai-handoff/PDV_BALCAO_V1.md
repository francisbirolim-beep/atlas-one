# PDV Venda Balcão v1 — Atlas One

Data: 2026-08-23
PR: #256
Branch: `feat/pdv-balcao-v1`
Base atual: `main` após integração da PR #255.

## Objetivo

Criar um ambiente de balcão separado do restante do ERP, simples para o operador e integrado a Produtos, Estoque, Clientes e Financeiro.

## Telas da v1

- `/balcao` — Venda rápida / PDV.
- `/balcao/orcamentos` e `/balcao/orcamentos/novo` — orçamento balcão sem movimentar estoque/caixa.
- `/balcao/consulta-preco` — consulta de preço e disponibilidade.
- `/balcao/historico` — histórico de vendas.
- `/balcao/caixa` — abertura, suprimento, sangria, movimentos e fechamento.
- `/balcao/contas-receber` — recebimentos a prazo.
- `/balcao/relatorios` — indicadores gerenciais restritos por permissão.
- `/balcao/clientes/novo` — cadastro rápido de cliente.

## Regras comerciais permanentes

- Tipologias/esquadrias usam `produtos.custo`; a margem é aplicada no orçamento da esquadria.
- Venda balcão usa `produtos.preco` / preço promocional e margem própria do produto.
- `margem_percentual` significa margem real, não markup.
- Custo e margem ficam ocultos para operador sem permissão gerencial.
- Venda abaixo do preço mínimo exige bloqueio/autorização conforme permissão.

## Regras transacionais

- Orçamento balcão não movimenta estoque, caixa ou Contas a Receber.
- Venda finalizada registra itens e pagamentos congelados no momento da venda.
- Pagamento pode ser misto.
- Venda a prazo gera Contas a Receber.
- Venda finalizada baixa estoque e cria movimento auditável.
- Operações do caixa: abertura, suprimento, sangria, recebimentos e fechamento.
- Relatórios e indicadores são separados da tela operacional do balcão e protegidos por permissão.

## Segurança

- Rotas do PDV exigem sessão Atlas válida.
- Permissões independentes para operação de venda, caixa e relatórios/gestão.
- Tabelas transacionais novas devem permanecer com RLS habilitado e operações críticas devem ser server-side/RPC.
- Cancelamento/devolução não deve apagar venda; deve gerar estorno auditável em evolução posterior.

## Migrações da PR #256

- `20260823211000_pdv_balcao_v1.sql`
- `20260823211500_pdv_balcao_recebimento_rpc.sql`
- `20260823211600_pdv_balcao_vencimentos.sql`

Aplicar somente após preview final da PR passar. Depois rodar advisors de segurança/performance antes do merge.

## Validação operacional antes de uso real

1. abrir caixa com saldo inicial;
2. consultar produto e estoque;
3. montar orçamento e confirmar que não altera saldo;
4. realizar uma venda teste com pagamento simples;
5. realizar venda teste com pagamento misto;
6. confirmar baixa de estoque e movimentos de caixa/financeiro;
7. testar venda a prazo e Contas a Receber;
8. executar sangria e suprimento;
9. fechar caixa e conferir diferença;
10. validar que operador comum não enxerga relatórios, custo e margem gerencial.
