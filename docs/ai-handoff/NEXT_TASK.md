# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Branch: `feat/engenharia-modulo-v1`.

Objetivo: concluir a Fase 2 funcional da Engenharia com rota dedicada e fluxo tecnico inicial, sem MEE ou lista de corte.

Escopo implementado:
1. rota `/engenharia`;
2. fonte unica de dados permanece no Kanban do setor;
3. KPIs operacionais;
4. etapas Recebidas, Conferencia tecnica, Em desenvolvimento e Liberado para producao;
5. drag-and-drop conforme permissoes;
6. detalhe da obra com Medicao Final aprovada e 6 medidas finais por peca;
7. migration ativa a rota do setor Engenharia e padroniza as etapas.

### Proxima acao obrigatoria
1. integrar o PR apos Build Validation e dry-run verdes;
2. aplicar a migration de rota/etapas no Supabase por fluxo operacional controlado;
3. validar historico de migrations;
4. em branch separada, iniciar a Fase 3 da Engenharia.

## FASE 3 RECOMENDADA
Criar a estrutura tecnica por obra/peca para conferencia de Engenharia, preparando o futuro MEE:
- estado de conferencia por peca;
- observacoes tecnicas;
- responsavel tecnico;
- revisao/pendencia;
- liberacao da obra para Producao somente apos conferencia concluida.

Ainda nao implementar formulas de perfis, acessorios ou lista de corte nessa etapa.

## JA NA MAIN
- Redesign profissional PRs #57 a #63.
- Medicao Final V2 PRs #54 a #56.
- Entrada automatica Medicao Final aprovada -> Engenharia no PR #64, com migration aplicada.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- Migration: dry-run em PR antes de apply controlado.
- Vercel pode continuar sujeita a cota diaria; Build Validation confirma o codigo, mas producao depende do deploy.
