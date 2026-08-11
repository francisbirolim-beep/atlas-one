# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Engenharia Fase 3 no PR #69.

Escopo implementado:
1. conferencia tecnica persistente por peca;
2. status `pendente`, `conferida` e `pendencia`;
3. observacao tecnica por peca;
4. responsavel e data de conferencia por peca;
5. progresso de conferencia na tela da Engenharia;
6. bloqueio visual da liberacao incompleta;
7. trigger no banco impedindo mover para `Liberado para producao` enquanto todas as pecas nao estiverem conferidas.

Migration: `20260811192000_engenharia_conferencia_tecnica_v1.sql`.

### Proxima acao obrigatoria
1. validar o head final do PR #69 apos atualizacao dos handoffs;
2. mergear somente com Build Validation e Supabase dry-run verdes;
3. aplicar a migration por workflow operacional controlado;
4. validar historico local/remoto;
5. iniciar branch separada para a proxima camada.

## PROXIMA CAMADA RECOMENDADA
Antes do MEE, fechar a governanca da obra na Engenharia:
- responsavel tecnico no nivel da obra;
- registrar quem liberou a obra para Producao e quando;
- historico de revisoes/retornos tecnicos;
- acao explicita de liberar para Producao, em vez de depender somente do drag-and-drop;
- preparar a futura entidade `obra` sem duplicar dados atuais.

Depois disso iniciar a base de receitas por tipologia e o MEE.

## DEPOIS
- receitas por tipologia;
- perfis, acessorios, reforcos e vidros;
- calculos/MEE;
- lista de materiais e lista de corte;
- otimizacao de barras;
- integracao automatizada com Producao.

## JA NA MAIN
- Medicao Final V2 PRs #54 a #56.
- Redesign profissional PRs #57 a #63.
- Engenharia Fase 1 PR #64.
- Engenharia Fase 2 PR #66.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- Migration: dry-run em PR antes de apply controlado.
- Nao iniciar formulas de MEE antes de fechar a governanca tecnica da obra.
- Vercel pode continuar sujeita a cota diaria; Build Validation confirma o codigo, mas producao depende do deploy.
