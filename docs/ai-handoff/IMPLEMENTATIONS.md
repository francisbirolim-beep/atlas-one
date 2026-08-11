# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Base funcional
Cadastros, Kanban de orcamentos, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes. Status: em uso.

## Infraestrutura Supabase / migrations — 2026-08-11
Session Pooler IPv4, audit/dry-run em PR, historico local/remoto reconciliado e V20 da Medicao Final aplicada/validada.

## Medicao Final V2 — PRs #54 a #56
- #54: responsavel, status operacional, liberar/iniciar/concluir/aprovar, pendencias e bloqueios.
- #55: checklist normalizado por peca/tipologia/secao, respostas e fotos categorizadas.
- #56: link externo seguro com token-hash, expiracao/revogacao, medidas, checklist, fotos e conclusao para revisao interna.

## Build Validation — GitHub Actions
Workflow de `npm install` + `npm run build` criado para validar compilacao/TypeScript quando a Vercel esta bloqueada por cota diaria.

## Redesign profissional mergeado
- PR #57: Home executiva + Topbar + KPIs/workspace.
- PR #58: Sidebar desktop escura em padrao ERP.
- PR #59: Kanban Comercial profissional.
- PR #60: Central e Pesquisa de Orcamentos profissionais.
- PR #61: Medicao Final profissional, mantendo toda a logica V2.
- PR #62: Producao profissional, mantendo drag-and-drop e CRUD existentes.

## Base profissional de setores — branch atual
Branch `feat/atlas-professional-setores-base-v1`:
- estiliza `app/setor/[slug]/page.tsx`, usado pelos setores sem rota propria;
- cria `app/atlas-setor-professional.css`;
- preserva permissoes `oculto/consulta/edicao`, drag-and-drop, CRUD e redirecionamento de setores ativos;
- melhora imediatamente a apresentacao da Engenharia quando ela usa o setor generico.

Importante: isso NAO significa que o MEE/Engenharia especializado foi implementado. O repositorio ainda nao possui uma rota funcional propria para esse modulo.

## Pontos funcionais ainda pendentes
- Modulo especializado de Engenharia/MEE e liberacao persistente apos Medicao Final aprovada.
- Confirmacao de Venda Fase 1 precisa de validacao funcional completa.
- Parser/importacao PDF W.Vetro ainda precisa de fluxo estruturado e conferivel.
- Regras condicionais/foto obrigatoria do checklist V2 ainda pendentes.
- Entidade persistente `vendas`/`obras` ainda nao existe.

## Proximas evolucoes recomendadas
1. validar e mergear a base profissional dos setores;
2. decidir/implementar a fundacao funcional real de Engenharia/MEE em tarefa separada;
3. continuar padronizacao dos demais modulos existentes;
4. retomar validacoes e evolucoes funcionais pendentes.
