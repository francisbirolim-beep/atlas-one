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

## Engenharia Fases 1 a 4 — PRs #64, #66, #69 e #73
- entrada automatica da Medicao Final aprovada na Engenharia;
- rota dedicada `/engenharia` e fluxo operacional;
- conferencia tecnica persistente por peca;
- bloqueio de liberacao incompleta;
- liberacao transacional/idempotente Engenharia -> Producao.

## Kanban — fotos coletadas em campo — PRs #104 a #106 — 2026-08-13
- #104 restaurou `Iniciar orçamento` e preservou referencias de foto do pedido.
- #105 criou `Fotos coletadas em campo`, multiplas miniaturas e `Adicionar fotos` sem apagar anteriores.
- #106 identifica `foto_larguras_url` como `LARGURA` e `foto_alturas_url` como `ALTURA`; fotos gerais ficam separadas sem duplicacao.

## Kanban — leitura automatica da trena — PRs #107 e #108 — 2026-08-13
- #107 reutiliza `/api/medicao-final/ler-trena` para ler as fotos do medidor, converter para mm e sugerir seis medidas;
- so preenche automaticamente quando as tres leituras do eixo sao reconhecidas;
- nao sobrescreve automaticamente eixo com valor manual;
- falha da IA nao remove a foto;
- #108 corrige a inversao `Baixo`/`Cima` observada na LARGURA em teste real; ALTURA nao foi alterada.

## Kanban — anexo original W.Vetro — branch `feat/anexo-wvetro-kanban` — 2026-08-13
- o bloco de anexos ja tinha upload funcional via Supabase Storage, mas exigia titulo manual antes de habilitar o seletor de arquivo;
- a rota `/kanban` passa a preencher automaticamente o titulo vazio com `Orçamento W.Vetro (original)`;
- isso libera o botao `Anexar` sem digitacao manual e padroniza o anexo que sera usado como fonte do futuro espelho Atlas;
- o PDF W.Vetro original continua preservado; leitura/espelhamento automatico ainda nao faz parte desta etapa.

## Pontos funcionais ainda pendentes
- Gerar `Orçamento Atlas` como espelho do PDF W.Vetro, com leitura estruturada + revisao antes de finalizar.
- Engenharia Fase 5: base de receitas tecnicas por tipologia.
- MEE/calculos automaticos, perfis/acessorios, lista de materiais, lista de corte e otimizacao.
- Confirmacao de Venda Fase 1 precisa de validacao funcional completa.
- Regras condicionais/foto obrigatoria do checklist V2 ainda pendentes.
- Entidade persistente `vendas`/`obras` ainda nao existe.
