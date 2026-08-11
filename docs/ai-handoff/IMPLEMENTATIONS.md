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

## Redesign profissional
- PR #57: Home executiva + Topbar + KPIs/workspace.
- PR #58: Sidebar desktop escura em padrao ERP.
- PR #59: Kanban Comercial profissional.
- PR #60: Central e Pesquisa de Orcamentos profissionais.
- PR #61: Medicao Final profissional, mantendo toda a logica V2.

## Producao profissional — branch atual
Branch `feat/atlas-professional-producao-v1`:
- escopo visual `atlas-producao-professional` no AppShell;
- nova folha `app/atlas-producao-professional.css`;
- cabecalho legado ocultado dentro do AppShell;
- toolbar, colunas, cards e modais refinados;
- responsividade/mobile melhorados;
- drag-and-drop, criacao/renomeacao/exclusao de colunas e CRUD de cards preservados.

## Pontos funcionais ainda pendentes
- Confirmacao de Venda Fase 1 precisa de validacao funcional completa.
- Parser/importacao PDF W.Vetro ainda precisa de fluxo estruturado e conferivel.
- Regras condicionais/foto obrigatoria do checklist V2 ainda pendentes.
- Liberacao persistente para Engenharia apos aprovacao ainda pendente.
- Entidade persistente `vendas`/`obras` ainda nao existe.

## Proximas evolucoes recomendadas
1. validar e mergear Producao profissional;
2. aplicar Design System em Engenharia;
3. continuar padronizacao dos demais modulos;
4. retomar validacoes e evolucoes funcionais pendentes.
