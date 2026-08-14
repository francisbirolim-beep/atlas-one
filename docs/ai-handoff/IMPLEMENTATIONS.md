# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Base funcional
Cadastros, Kanban de orcamentos, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes. Status: em uso.

## Infraestrutura Supabase / migrations — 2026-08-11
Session Pooler IPv4, audit/dry-run em PR, historico local/remoto reconciliado e migrations operacionais controladas.

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

## Engenharia Fase 2 — PR #66
- rota dedicada `/engenharia`;
- `setor_kanban_itens` permanece como fonte unica de cards;
- KPIs e etapas Recebidas, Conferencia tecnica, Em desenvolvimento e Liberado para producao;
- detalhe da obra com Medicao Final aprovada e as 6 medidas finais por peca.

## Engenharia Fase 3 — PR #69
- conferencia tecnica persistente por peca;
- status Pendente, Conferida e Pendencia;
- observacao e responsavel pela conferencia;
- progresso da conferencia por obra;
- bloqueio visual e de banco para impedir liberacao incompleta.

## Engenharia Fase 4 — PR #73
- liberacao operacional real de Engenharia para Producao;
- ao mover para `Liberado para producao`, RPC transacional revalida a conferencia tecnica;
- registra quem liberou e quando no card da Engenharia;
- cria ou atualiza de forma idempotente o card correspondente em `producao_itens` usando `orcamento_id`;
- preserva titulo/descricao derivados da Medicao Final e evita duplicidade;
- serializa liberacoes concorrentes do mesmo orcamento;
- migration `20260811200000_engenharia_liberacao_producao_v1.sql` aplicada e validada no Supabase.

## Kanban — fotos coletadas em campo — 2026-08-13
- a primeira coluna continua exigindo `Iniciar orçamento` antes da edicao;
- cada esquadria passa a exibir todas as fotos vinculadas ao item antes dos campos de medidas;
- a galeria consolida `foto_urls`, `foto_url`, `foto_larguras_url` e `foto_alturas_url` sem duplicar URLs;
- o comando de foto passa a ser `Adicionar fotos`, aceitando multiplos arquivos e preservando as imagens anteriores;
- clicar em uma miniatura abre a imagem em tamanho maior;
- leitura automatica da trena continua fora deste ajuste.

## Pontos funcionais ainda pendentes
- Engenharia Fase 5: base de receitas tecnicas por tipologia.
- MEE/calculos automaticos, perfis/acessorios, lista de materiais, lista de corte e otimizacao.
- Confirmacao de Venda Fase 1 precisa de validacao funcional completa.
- Parser/importacao PDF W.Vetro ainda precisa de fluxo estruturado e conferivel.
- Regras condicionais/foto obrigatoria do checklist V2 ainda pendentes.
- Entidade persistente `vendas`/`obras` ainda nao existe.
