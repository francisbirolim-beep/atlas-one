# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Branch: `feat/atlas-professional-medicao-final-v1`.
PR: #61.

Objetivo: concluir a quinta onda do redesign profissional sem alterar regras da Medicao Final V2.

Escopo implementado:
1. painéis de progresso/status, acesso externo e checklist agrupados em `atlas-medicao-tools`;
2. nova camada `app/atlas-medicao-professional.css`;
3. refinamento da tela de detalhe e responsividade;
4. nenhuma regra, permissao, persistencia ou fluxo alterado.

Validacao: Build Validation do GitHub Actions passou com sucesso.

### Proxima acao obrigatoria
1. revisar o diff final do PR #61;
2. mergear na `main`;
3. iniciar branch separada para o redesign profissional de Producao.

## REDESIGN PROFISSIONAL JA NA MAIN
- PR #57: Home executiva + Topbar + KPIs/workspace;
- PR #58: Sidebar desktop escura em padrao ERP;
- PR #59: Kanban Comercial profissional;
- PR #60: Central e Pesquisa de Orcamentos profissionais.

A regra continua sendo preservar logica existente e modernizar por camada visual sempre que possivel.

## MEDICAO FINAL V2 JA NA MAIN
- V20 aplicada e validada no Supabase;
- responsavel/status/liberar/iniciar/concluir/aprovar;
- pendencias e bloqueios;
- checklist normalizado por peca/tipologia/secao;
- fotos categorizadas;
- compatibilidade com checklist legado;
- link externo seguro com token-hash, expiracao/revogacao, medidas, checklist, fotos e conclusao para revisao interna.

## PROXIMOS BLOCOS RECOMENDADOS
Depois do PR #61:
1. padronizar Producao;
2. padronizar Engenharia;
3. validar funcionalmente Confirmacao de Venda Fase 1;
4. definir motor simples de regras condicionais e `exigir_foto_quando`;
5. criar liberacao persistente para Engenharia apos aprovacao;
6. Fase 2 PDF W.Vetro -> Orcamento Atlas estruturado e conferivel.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- A Vercel esta com cota diaria de builds; o workflow `Build Validation` do GitHub Actions valida `npm run build`, mas o deploy de producao continua dependendo da Vercel.
- Nao reinterpretar automaticamente medicoes ja concluidas.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
- Nao alterar formulas/regras durante tarefas puramente visuais.
