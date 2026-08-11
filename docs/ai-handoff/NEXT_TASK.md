# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
A Engenharia Fase 2 foi concluida no PR #66 e a migration `20260811183500_engenharia_modulo_v1.sql` foi aplicada e validada no Supabase.

## PROXIMA TAREFA — ENGENHARIA FASE 3
Criar conferencia tecnica persistente por obra/peca, preparando o futuro MEE sem implementar formulas ainda.

Escopo recomendado:
1. estado de conferencia por peca;
2. responsavel tecnico por obra;
3. observacoes tecnicas por peca;
4. pendencias/revisoes tecnicas;
5. registrar quem conferiu e quando;
6. bloquear a etapa `Liberado para producao` enquanto existir peca nao conferida ou pendencia aberta;
7. registrar quem liberou a obra e quando;
8. manter acesso direto à Medicao Final original.

## DEPOIS DA FASE 3
- criar base de receitas por tipologia;
- mapear perfis, acessorios, reforcos e vidros;
- implementar calculos/MEE;
- gerar lista de materiais e lista de corte;
- otimizar barras e preparar liberacao automatizada para Producao.

## JA NA MAIN
- Medicao Final V2 PRs #54 a #56.
- Redesign profissional PRs #57 a #63.
- Engenharia Fase 1 PR #64, com entrada automatica apos aprovacao da Medicao Final.
- Engenharia Fase 2 PR #66, com rota `/engenharia`, KPIs, quatro etapas e detalhe das pecas; migration aplicada.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- Migration: dry-run em PR antes de apply controlado.
- Nao iniciar formulas de MEE antes de fechar a estrutura de conferencia tecnica da Fase 3.
- Vercel pode continuar sujeita a cota diaria; Build Validation confirma o codigo, mas producao depende do deploy.
