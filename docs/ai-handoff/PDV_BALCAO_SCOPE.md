# PDV Balcão — Escopo funcional inicial

Base: PR #255 (`feat/compras-estoque-financeiro`).

## Regra central

- Tipologias/esquadrias usam `produtos.custo` e margem global do orçamento.
- Venda balcão usa `produtos.preco`, `preco_promocional`, `preco_minimo` e margem real do produto.
- Orçamento balcão não baixa estoque, não movimenta caixa e não registra último preço vendido.
- Venda finalizada baixa estoque e gera financeiro/caixa de forma auditável.

## Telas

- `/balcao` — Venda Balcão (PDV principal)
- `/balcao/orcamentos` — Orçamentos balcão
- `/balcao/consulta-preco` — Consulta sem movimentação
- `/balcao/historico` — Histórico de vendas
- `/balcao/caixa` — Abertura, suprimento, sangria e fechamento
- `/balcao/relatorios` — Gestão restrita por permissão

## Permissões

Setores dedicados:
- `venda-balcao`: operação de venda/orçamento/consulta;
- `caixa-balcao`: abertura, sangria, suprimento e fechamento;
- `relatorios-balcao`: custos, margens e relatórios gerenciais.

Master tem edição total. Usuário comum depende de `permissoes.nivel`.

## Financeiro e estoque

Venda finalizada deve registrar, na mesma operação lógica:
1. venda + itens com preço congelado;
2. pagamentos;
3. saída de estoque para produtos com saldo operacional;
4. movimento de caixa quando aplicável;
5. conta a receber para pagamento a prazo/boleto quando aplicável.

Cancelamento/devolução será evoluído em etapa própria; venda finalizada nunca deve ser apagada silenciosamente.
