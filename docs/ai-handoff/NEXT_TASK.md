# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
A Engenharia Fase 3 foi concluida no PR #69 e a migration `20260811192000_engenharia_conferencia_tecnica_v1.sql` foi aplicada e validada no Supabase.

## PROXIMA TAREFA — ENGENHARIA FASE 4
Transformar `Liberado para producao` em uma liberacao operacional real, sem duplicar obra/card.

Escopo recomendado:
1. registrar quem liberou a obra e quando;
2. ao entrar em `Liberado para producao`, criar ou atualizar de forma idempotente a entrada correspondente na Producao;
3. preservar vinculo com orcamento, Medicao Final e card da Engenharia;
4. impedir duplicidade na Producao;
5. manter bloqueio caso a conferencia tecnica deixe de estar completa;
6. permitir retorno controlado para Engenharia se houver revisao tecnica;
7. manter acesso direto ao detalhe da Medicao Final e ao historico tecnico.

## DEPOIS DA FASE 4
- criar base de receitas por tipologia;
- mapear perfis, acessorios, reforcos e vidros;
- implementar calculos/MEE;
- gerar lista de materiais e lista de corte;
- otimizar barras e preparar liberacao automatizada para Producao.

## JA NA MAIN
- Medicao Final V2 PRs #54 a #56.
- Redesign profissional PRs #57 a #63.
- Engenharia Fase 1 PR #64, com entrada automatica apos aprovacao da Medicao Final.
- Engenharia Fase 2 PR #66, com rota `/engenharia`, KPIs, quatro etapas e detalhe das pecas.
- Engenharia Fase 3 PR #69, com conferencia tecnica persistente por peca e bloqueio de liberacao incompleta; migration aplicada.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- Migration: dry-run em PR antes de apply controlado.
- Nao iniciar formulas de MEE antes de fechar a liberacao real Engenharia -> Producao.
- Vercel pode continuar sujeita a cota diaria; Build Validation confirma o codigo, mas producao depende do deploy.
