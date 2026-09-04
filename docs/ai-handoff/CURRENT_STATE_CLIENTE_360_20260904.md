# Estado — Cliente 360 painel principal — 2026-09-04

Branch `feat/cliente-360-painel-principal`.

A rota principal do cliente (`/clientes/[id]`) passou a usar o `Cliente360Dashboard`, tornando visível a central já existente com visão consolidada de obras, orçamentos/vendas, financeiro, assistências, documentos, histórico, relatórios e IA do cliente.

A estrutura financeira existente já suporta recebimento parcial ou total quando o valor é vinculado a uma obra: o recebimento é distribuído pelas parcelas em aberto por ordem de vencimento e o saldo parcial permanece em `valor_pago` até a quitação completa.

Sem migration nesta entrega. Próximo passo: validar preview Vercel e, após autorização já dada para subir, integrar na main se o build estiver aprovado.
