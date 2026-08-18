# PR #175 — Importação do PDF correto no orçamento vendido

Data: 2026-08-18

Estado: **concluído e em produção**.

Merge da PR #175: `96bef292486254fa34622f2539972aa176544df2`.

Arquivo funcional alterado: `app/api/importar-itens-orcamento/route.ts`.

## Correção consolidada

- anexos com exclusão lógica (`excluido_em`) são ignorados;
- somente PDFs ativos participam da seleção;
- quando existem PDFs externos, o PDF externo ativo mais recente tem prioridade sobre PDFs gerados pelo Atlas;
- quando existem somente PDFs Atlas, é usado o PDF Atlas ativo mais recente;
- `anexoUrl` opcional só é aceito se pertencer aos anexos ativos do próprio orçamento;
- a resposta informa `anexo_usado` para auditoria/diagnóstico;
- o parser W.Vetro não foi alterado.

## Validação

No head exato `ba08278780ca977829fe91cafe580655129b66fc`, o Build Validation #240 ficou verde. A PR foi mergeada somente após ficar mergeável contra a `main` atual e o Vercel liberar o gate. O deploy de produção do merge `96bef292486254fa34622f2539972aa176544df2` foi confirmado com status Vercel `success`.

## Segurança

- sem migration;
- sem alteração de schema;
- sem alteração manual de dados de orçamento durante a validação;
- sem reimportação ou gravação de dados fora do comportamento existente da rota.

## Regra permanente

Na importação de orçamento vendido, não voltar a escolher o primeiro PDF do histórico. A seleção deve respeitar a prioridade descrita acima e nunca considerar anexos logicamente excluídos.
