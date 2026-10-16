# Conferência dos totais W.Vetro — orçamento #572 (Shayla) — 16/10/2026

Status: implementação isolada em branch `feat/validacao-totais-venda-wvetro-20261016`, SEM publicação, SEM alteração do banco.

## Evidência fornecida
- W.Vetro na captura: venda R$ 9.450,00, custo sem sobra R$ 4.872,49, com sobra R$ 6.003,50.
- Atlas na captura: venda R$ 8.782,11, custo sem sobra R$ 4.399,99, com sobra R$ 5.531,00.
- Diferenças: venda R$ 667,89; custos R$ 472,50 em cada total.
- Materiais (perfis, acessórios e vidros), perdas e sobra JÁ aprovados: não modificar.

## Implementado e preservado
1. Nova categoria de revisão `total_uso` no módulo existente de CMV. Mantém `total` para valor **com sobra** e não modifica outras categorias ou o custo realizado.
2. Na aba Custos/CMV, cards separados com valor original importado e revisado, botões de validar/corrigir para **ambos** os totais; histórico por usuário/justificativa já registrado via `agente_memorias`; sinaliza quando os revisados deixam de conciliar com a sobra.
3. Conferência do preço de venda, exibindo preço importado e venda atual, válida/corrige com justificativa e histórico. A validação usa a referência que o Atlas tem no histórico W.Vetro — esta referência pode estar desatualizada e **não deve ser presumida como igual ao print**. A correção manual permite o valor comprovado.
4. Endpoint de venda apenas Master; migration aditiva com função transacional (lock na venda, preço anterior conferido, histórico `venda_obra_revisoes`, atualiza somente `vendas_obras.valor_venda`). Nenhum item, orçamento, compra, estoque, NF, contas ou recebimento é regravado.
5. Cabeçalho da venda recarrega e recalcula margem/markup após confirmação; discrepância com parcelas financeiras é alertada.

## Validação técnica
- `npm run typecheck` PASS
- `node scripts/test-venda-conferencia-totais-wvetro.cjs` PASS
- `npm run test:venda-cmv-revisao` PASS
- `npm run test:cmv-wvetro-valores` PASS
- `npm run test:venda-fluxo` PASS
- `npm run build` PASS (ambiente de build com valores fictícios para as variáveis Supabase; **não constitui teste integrado**).

## Pendências e gates
- Migration `20261016112500_venda_conferencia_valor_wvetro_v1.sql` criada, **não executada**.
- Sem teste autenticado, não consultar ou regravar a Shayla em produção automaticamente; valores do print são referência apenas.
- Antes de homologar, executar migration num banco de teste compatível, verificar perfil Master e perfis sem permissão; testar concorrência, histórico, custos 2/2, margens, financeiro com e sem recebíveis, fonte W.Vetro desatualizada, descontos.
- Não disparar Vercel Preview ou produção sem aprovação explícita. Integrar a alteração por revisão de diff contra a versão mais recente e regressão em Perfis, Acessórios, Vidros, Materiais, Compras, Produção e Kanbans.
- Se aprovado, backup e rollback antes de publicar, com monitoramento pós-implantação.
