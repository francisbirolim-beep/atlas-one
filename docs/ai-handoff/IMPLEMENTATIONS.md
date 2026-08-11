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
Workflow de `npm install` + `npm run build` para validar compilacao/TypeScript independentemente da cota da Vercel.

## Redesign profissional — PRs #57 a #63
- #57: Home executiva + Topbar + KPIs/workspace.
- #58: Sidebar desktop escura em padrao ERP.
- #59: Kanban Comercial profissional.
- #60: Central e Pesquisa de Orcamentos profissionais.
- #61: Medicao Final profissional.
- #62: Producao profissional.
- #63: base profissional para setores sem modulo proprio.

## Engenharia Fase 1 — PR #64
- Medicao Final aprovada cria ou atualiza de forma atomica/idempotente a entrada correspondente na Engenharia.
- Card leva cliente, local e as 6 medidas finais por peca.
- Usa `orcamento_id` para evitar duplicidade.
- Migration `20260811181300_engenharia_entrada_automatica.sql` aplicada e validada no Supabase.

## Engenharia Fase 2 — PR #66 (branch atual)
- cria rota dedicada `/engenharia`;
- mantem `setor_kanban_itens` como fonte unica de cards;
- exibe KPIs e as etapas Recebidas, Conferencia tecnica, Em desenvolvimento e Liberado para producao;
- drag-and-drop respeita permissoes;
- detalhe da obra mostra Medicao Final aprovada e as 6 medidas finais de cada peca;
- migration ativa a rota `/engenharia` no setor e padroniza as quatro etapas;
- sem MEE, receitas, lista de corte ou otimizacao nesta fase.

## Pontos funcionais ainda pendentes
- Engenharia Fase 3: conferencia tecnica persistente por peca, responsavel, observacoes e bloqueio/liberacao para Producao.
- MEE/calculos automaticos, receitas de tipologias, perfis/acessorios e lista de corte.
- Confirmacao de Venda Fase 1 precisa de validacao funcional completa.
- Parser/importacao PDF W.Vetro ainda precisa de fluxo estruturado e conferivel.
- Regras condicionais/foto obrigatoria do checklist V2 ainda pendentes.
- Entidade persistente `vendas`/`obras` ainda nao existe.
