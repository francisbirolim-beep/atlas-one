# Implementação — Cliente 360 como painel principal

- 2026-09-04: `/clientes/[id]` passou a renderizar o painel `Cliente360Dashboard`.
- O painel consolida posição financeira, contas a receber, recebimentos, obras, orçamentos, vendas balcão, assistências, medições, documentos e histórico.
- O fluxo existente de recebimento por obra permite valores parciais ou totais e atualiza as parcelas abertas sem criar um segundo lançamento financeiro.
- Não houve alteração de schema nem migration.
